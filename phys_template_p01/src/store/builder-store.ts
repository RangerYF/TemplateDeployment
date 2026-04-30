import { create } from 'zustand';
import { loadPreset } from '@/core/engine/preset-loader';
import { entityRegistry } from '@/core/registries/entity-registry';
import { presetRegistry } from '@/core/registries/preset-registry';
import { solverRegistry } from '@/core/registries/solver-registry';
import type {
  CoordinateTransform,
  Entity,
  EntityId,
  ParamValues,
  PhysicsResult,
  PresetData,
  Relation,
  RelationId,
  SceneDefinition,
  Vec2,
} from '@/core/types';
import {
  getProtectedBuilderEntityIds,
  validateBuilderTemplateContext,
} from '@/domains/em/builder/template-library';
import { evaluateBuilderTemplateRuntime } from '@/domains/em/builder/template-runtime';
import { isCurrentMeter } from '@/domains/em/logic/circuit-solver-utils';

// ─── 交互状态类型 ───

export type BuilderInteraction =
  | { type: 'idle' }
  | { type: 'dragging-new'; entityType: string; position: Vec2 }
  | { type: 'moving'; entityId: EntityId; offset: Vec2 }
  | {
      type: 'wiring';
      fromEntityId: EntityId;
      fromPortSide: 'top' | 'bottom' | 'left' | 'right';
      mousePos: Vec2;
    }
  | { type: 'selecting' };

export interface BuilderClipboardBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  width: number;
  height: number;
}

export interface BuilderClipboardData {
  type: 'entity' | 'scene';
  entities: Entity[];
  relations: Relation[];
  sourceBounds: BuilderClipboardBounds | null;
  pasteCount: number;
}

export interface BuilderPasteResult {
  type: BuilderClipboardData['type'];
  insertedEntityIds: EntityId[];
  selectedEntityId: EntityId | null;
}

// ─── Store State ───

export type BuilderWorkspaceId = 'primary' | 'secondary';
export type BuilderLayoutMode = 'single' | 'dual';

export interface BuilderWorkspaceState {
  entities: Map<EntityId, Entity>;
  relations: Relation[];
  builderParamValues: ParamValues;
  currentTemplateFamilyId: string | null;
  currentTemplateVariantId: string | null;
  selectedEntityId: EntityId | null;
  interaction: BuilderInteraction;
  canvasTransform: CoordinateTransform;
  currentResult: PhysicsResult | null;
  isRunning: boolean;
  solverError: string | null;
}

export interface BuilderStoreState {
  workspaces: Record<BuilderWorkspaceId, BuilderWorkspaceState>;
  activeWorkspaceId: BuilderWorkspaceId;
  layoutMode: BuilderLayoutMode;
  builderClipboard: BuilderClipboardData | null;
}

// ─── Store Actions ───

export interface BuilderStoreActions {
  selectWorkspace(workspaceId: BuilderWorkspaceId): void;
  setLayoutMode(mode: BuilderLayoutMode): void;
  copyWorkspaceToWorkspace(sourceId: BuilderWorkspaceId, targetId: BuilderWorkspaceId): void;
  clearWorkspace(workspaceId: BuilderWorkspaceId): void;

  addEntity(type: string, position: Vec2, workspaceId?: BuilderWorkspaceId): EntityId | null;
  removeEntity(id: EntityId, workspaceId?: BuilderWorkspaceId): void;
  moveEntity(id: EntityId, position: Vec2, workspaceId?: BuilderWorkspaceId): void;
  updateEntityProperty(
    id: EntityId,
    key: string,
    value: unknown,
    workspaceId?: BuilderWorkspaceId,
  ): void;
  updateBuilderParam(
    key: string,
    value: number | boolean | string,
    workspaceId?: BuilderWorkspaceId,
  ): void;
  loadPresetTemplate(presetId: string, workspaceId?: BuilderWorkspaceId): void;
  setTemplateContext(
    familyId: string | null,
    variantId: string | null,
    workspaceId?: BuilderWorkspaceId,
  ): void;
  copySelectedEntity(workspaceId?: BuilderWorkspaceId): boolean;
  copyScene(workspaceId?: BuilderWorkspaceId): boolean;
  pasteClipboard(workspaceId?: BuilderWorkspaceId): BuilderPasteResult | null;
  replaceEntityType(
    entityId: EntityId,
    newType: string,
    nextProperties?: Record<string, unknown>,
    workspaceId?: BuilderWorkspaceId,
  ): EntityId | null;

  addConnection(
    sourceId: EntityId,
    targetId: EntityId,
    sourcePort?: string,
    targetPort?: string,
    workspaceId?: BuilderWorkspaceId,
  ): void;
  removeConnection(relationId: RelationId, workspaceId?: BuilderWorkspaceId): void;

  selectEntity(id: EntityId | null, workspaceId?: BuilderWorkspaceId): void;
  setInteraction(interaction: BuilderInteraction, workspaceId?: BuilderWorkspaceId): void;

  runCircuit(workspaceId?: BuilderWorkspaceId): void;
  stopCircuit(workspaceId?: BuilderWorkspaceId): void;
  clearAll(workspaceId?: BuilderWorkspaceId): void;

  setCanvasTransform(transform: CoordinateTransform, workspaceId?: BuilderWorkspaceId): void;
}

// ─── 内部计数器 ───

let nextRelationId = 1;

export const DEFAULT_BUILDER_PARAM_VALUES: ParamValues = {
  method: 'internal',
  activeCurrentMeterId: '',
  activeVoltmeterId: '',
};

export const BUILDER_WORKSPACE_IDS: BuilderWorkspaceId[] = ['primary', 'secondary'];

const DEFAULT_CANVAS_TRANSFORM: CoordinateTransform = {
  scale: 120,
  origin: { x: 500, y: 350 },
};

export function createEmptyBuilderWorkspaceState(): BuilderWorkspaceState {
  return {
    entities: new Map(),
    relations: [],
    builderParamValues: { ...DEFAULT_BUILDER_PARAM_VALUES },
    currentTemplateFamilyId: null,
    currentTemplateVariantId: null,
    selectedEntityId: null,
    interaction: { type: 'idle' },
    canvasTransform: cloneCoordinateTransform(DEFAULT_CANVAS_TRANSFORM),
    currentResult: null,
    isRunning: false,
    solverError: null,
  };
}

function createBuilderWorkspaces(): Record<BuilderWorkspaceId, BuilderWorkspaceState> {
  return {
    primary: createEmptyBuilderWorkspaceState(),
    secondary: createEmptyBuilderWorkspaceState(),
  };
}

function resolveWorkspaceId(
  state: BuilderStoreState,
  workspaceId?: BuilderWorkspaceId,
): BuilderWorkspaceId {
  return workspaceId ?? state.activeWorkspaceId;
}

function getWorkspace(
  state: BuilderStoreState,
  workspaceId: BuilderWorkspaceId,
): BuilderWorkspaceState {
  return state.workspaces[workspaceId];
}

function patchWorkspace(
  state: BuilderStoreState,
  workspaceId: BuilderWorkspaceId,
  patch: Partial<BuilderWorkspaceState>,
): Partial<BuilderStoreState> {
  return {
    workspaces: {
      ...state.workspaces,
      [workspaceId]: {
        ...getWorkspace(state, workspaceId),
        ...patch,
      },
    },
  };
}

function cloneCoordinateTransform(transform: CoordinateTransform): CoordinateTransform {
  return {
    scale: transform.scale,
    origin: { ...transform.origin },
  };
}

function cloneBuilderParamValues(paramValues: ParamValues): ParamValues {
  return cloneBuilderRecord(paramValues as Record<string, unknown>) as ParamValues;
}

function cloneWorkspaceForTransfer(
  workspace: BuilderWorkspaceState,
): BuilderWorkspaceState {
  return {
    entities: new Map(
      Array.from(workspace.entities.values(), (entity) => [entity.id, cloneBuilderEntitySnapshot(entity)]),
    ),
    relations: workspace.relations.map(cloneBuilderRelationSnapshot),
    builderParamValues: cloneBuilderParamValues(workspace.builderParamValues),
    currentTemplateFamilyId: workspace.currentTemplateFamilyId,
    currentTemplateVariantId: workspace.currentTemplateVariantId,
    selectedEntityId: null,
    interaction: { type: 'idle' },
    canvasTransform: cloneCoordinateTransform(workspace.canvasTransform),
    currentResult: null,
    isRunning: false,
    solverError: null,
  };
}

// ─── Store 创建 ───

export const useBuilderStore = create<BuilderStoreState & BuilderStoreActions>(
  (set, get) => ({
    // ─── 初始状态 ───
    workspaces: createBuilderWorkspaces(),
    activeWorkspaceId: 'primary',
    layoutMode: 'single',
    builderClipboard: null,

    selectWorkspace(workspaceId) {
      set({ activeWorkspaceId: workspaceId });
    },

    setLayoutMode(mode) {
      set((state) => {
        if (mode !== 'dual' || state.layoutMode === 'dual') {
          return { layoutMode: mode };
        }

        const primaryWorkspace = getWorkspace(state, 'primary');
        const secondaryWorkspace = getWorkspace(state, 'secondary');
        const primaryHasContent = primaryWorkspace.entities.size > 0;
        const secondaryHasContent = secondaryWorkspace.entities.size > 0;

        if (primaryHasContent === secondaryHasContent) {
          return { layoutMode: mode };
        }

        const sourceId: BuilderWorkspaceId = primaryHasContent ? 'primary' : 'secondary';
        const targetId: BuilderWorkspaceId = sourceId === 'primary' ? 'secondary' : 'primary';

        return {
          layoutMode: mode,
          workspaces: {
            ...state.workspaces,
            [targetId]: cloneWorkspaceForTransfer(getWorkspace(state, sourceId)),
          },
        };
      });
    },

    copyWorkspaceToWorkspace(sourceId, targetId) {
      if (sourceId === targetId) return;

      set((state) => ({
        workspaces: {
          ...state.workspaces,
          [targetId]: cloneWorkspaceForTransfer(getWorkspace(state, sourceId)),
        },
      }));
    },

    clearWorkspace(workspaceId) {
      get().clearAll(workspaceId);
    },

    // ─── 实体操作 ───

    addEntity(type, position, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      const registration = entityRegistry.get(type);
      if (!registration) return null;

      const entity = registration.createEntity({
        transform: { position, rotation: 0 },
      });

      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);
        const newEntities = new Map(workspace.entities);
        newEntities.set(entity.id, entity);
        return patchWorkspace(state, resolvedWorkspaceId, {
          entities: newEntities,
          builderParamValues: normalizeBuilderParamValues(newEntities, workspace.builderParamValues),
          currentResult: null,
          isRunning: false,
          solverError: null,
        });
      });

      return entity.id;
    },

    removeEntity(id, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);

        if (workspace.currentTemplateFamilyId && workspace.currentTemplateVariantId) {
          const protectedIds = getProtectedBuilderEntityIds({
            familyId: workspace.currentTemplateFamilyId,
            variantId: workspace.currentTemplateVariantId,
            entities: workspace.entities,
          });
          if (protectedIds.has(id)) {
            return patchWorkspace(state, resolvedWorkspaceId, {
              solverError: '当前模板的核心元件不可删除，请先切换模板或调整非核心元件',
            });
          }
        }

        const newEntities = new Map(workspace.entities);
        newEntities.delete(id);
        const newRelations = workspace.relations.filter(
          (r) => r.sourceEntityId !== id && r.targetEntityId !== id,
        );

        return patchWorkspace(state, resolvedWorkspaceId, {
          entities: newEntities,
          relations: newRelations,
          builderParamValues: normalizeBuilderParamValues(newEntities, workspace.builderParamValues),
          selectedEntityId: workspace.selectedEntityId === id ? null : workspace.selectedEntityId,
          currentResult: null,
          isRunning: false,
          solverError: null,
        });
      });
    },

    moveEntity(id, position, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);
        const entity = workspace.entities.get(id);
        if (!entity) return state;

        const updated: Entity = {
          ...entity,
          transform: { ...entity.transform, position },
        };
        const newEntities = new Map(workspace.entities);
        newEntities.set(id, updated);
        return patchWorkspace(state, resolvedWorkspaceId, { entities: newEntities });
      });
    },

    updateEntityProperty(id, key, value, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);
        const entity = workspace.entities.get(id);
        if (!entity) return state;

        const updated: Entity = {
          ...entity,
          properties: { ...entity.properties, [key]: value },
        };
        const newEntities = new Map(workspace.entities);
        newEntities.set(id, updated);
        const builderParamValues = normalizeBuilderParamValues(
          newEntities,
          workspace.builderParamValues,
        );

        const needResolve = workspace.isRunning;
        if (needResolve) {
          const result = evaluateBuilderScene({
            entities: newEntities,
            relations: workspace.relations,
            builderParamValues,
            currentTemplateFamilyId: workspace.currentTemplateFamilyId,
            currentTemplateVariantId: workspace.currentTemplateVariantId,
          });
          return patchWorkspace(state, resolvedWorkspaceId, {
            entities: newEntities,
            builderParamValues,
            isRunning: result.error === null,
            currentResult: result.result,
            solverError: result.error,
          });
        }

        return patchWorkspace(state, resolvedWorkspaceId, {
          entities: newEntities,
          builderParamValues,
        });
      });
    },

    updateBuilderParam(key, value, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);
        const builderParamValues = normalizeBuilderParamValues(
          workspace.entities,
          { ...workspace.builderParamValues, [key]: value },
        );

        if (workspace.isRunning) {
          const result = evaluateBuilderScene({
            entities: workspace.entities,
            relations: workspace.relations,
            builderParamValues,
            currentTemplateFamilyId: workspace.currentTemplateFamilyId,
            currentTemplateVariantId: workspace.currentTemplateVariantId,
          });
          return patchWorkspace(state, resolvedWorkspaceId, {
            builderParamValues,
            isRunning: result.error === null,
            currentResult: result.result,
            solverError: result.error,
          });
        }

        return patchWorkspace(state, resolvedWorkspaceId, { builderParamValues });
      });
    },

    loadPresetTemplate(presetId, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      const preset = presetRegistry.get(presetId);
      if (!preset) return;

      const loaded = loadPreset(preset as PresetData);
      const entities = new Map(loaded.scene.entities);
      const relations = [...loaded.scene.relations];
      const builderParamValues = getBuilderParamValuesForPreset(preset, entities);
      const selectedEntityId = findPreferredSourceId(entities);
      const canvasTransform = {
        scale: preset.displayConfig?.scale ?? 120,
        origin: { x: 0, y: 0 },
      };

      set((state) =>
        patchWorkspace(state, resolvedWorkspaceId, {
          entities,
          relations,
          builderParamValues,
          selectedEntityId,
          interaction: { type: 'idle' },
          canvasTransform,
          currentResult: null,
          isRunning: false,
          solverError: null,
        }),
      );

      get().runCircuit(resolvedWorkspaceId);
    },

    setTemplateContext(familyId, variantId, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) =>
        patchWorkspace(state, resolvedWorkspaceId, {
          currentTemplateFamilyId: familyId,
          currentTemplateVariantId: variantId,
        }),
      );
    },

    copySelectedEntity(workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      const workspace = getWorkspace(get(), resolvedWorkspaceId);
      const { selectedEntityId, entities } = workspace;
      if (!selectedEntityId) return false;

      const entity = entities.get(selectedEntityId);
      if (!entity) return false;

      set({
        builderClipboard: buildBuilderClipboard({
          type: 'entity',
          entities: [entity],
          relations: [],
        }),
      });
      return true;
    },

    copyScene(workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      const workspace = getWorkspace(get(), resolvedWorkspaceId);
      const { entities, relations } = workspace;
      if (entities.size === 0) return false;

      const copiedEntities = Array.from(entities.values());
      const copiedEntityIds = new Set(copiedEntities.map((entity) => entity.id));
      const copiedRelations = relations.filter((relation) =>
        copiedEntityIds.has(relation.sourceEntityId) &&
        copiedEntityIds.has(relation.targetEntityId),
      );

      set({
        builderClipboard: buildBuilderClipboard({
          type: 'scene',
          entities: copiedEntities,
          relations: copiedRelations,
        }),
      });
      return true;
    },

    pasteClipboard(workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      let pasteResult: BuilderPasteResult | null = null;

      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);
        const clipboard = state.builderClipboard;
        if (!clipboard || clipboard.entities.length === 0) return state;

        const offset = resolveBuilderClipboardPasteOffset({
          clipboard,
          existingEntities: workspace.entities,
        });
        const remappedEntities = remapBuilderClipboardEntities(clipboard.entities, offset);
        if (remappedEntities.entities.length === 0) return state;

        const remappedRelations = remapBuilderClipboardRelations(
          clipboard.relations,
          remappedEntities.idMap,
        );

        const nextEntities = new Map(workspace.entities);
        for (const entity of remappedEntities.entities) {
          nextEntities.set(entity.id, entity);
        }

        const insertedEntityMap = new Map(
          remappedEntities.entities.map((entity) => [entity.id, entity]),
        );
        const selectedEntityId =
          clipboard.type === 'entity'
            ? remappedEntities.entities[0]?.id ?? null
            : findPreferredSourceId(insertedEntityMap) ?? remappedEntities.entities[0]?.id ?? null;

        pasteResult = {
          type: clipboard.type,
          insertedEntityIds: remappedEntities.entities.map((entity) => entity.id),
          selectedEntityId,
        };

        return {
          ...patchWorkspace(state, resolvedWorkspaceId, {
            entities: nextEntities,
            relations: [...workspace.relations, ...remappedRelations],
            builderParamValues: normalizeBuilderParamValues(nextEntities, workspace.builderParamValues),
            selectedEntityId,
            currentResult: null,
            isRunning: false,
            solverError: null,
          }),
          builderClipboard: {
            ...clipboard,
            pasteCount: clipboard.pasteCount + 1,
          },
        };
      });

      return pasteResult;
    },

    replaceEntityType(entityId, newType, nextProperties = {}, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      const wasRunning = getWorkspace(get(), resolvedWorkspaceId).isRunning;
      let nextEntityId: EntityId | null = null;

      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);
        const currentEntity = workspace.entities.get(entityId);
        const registration = entityRegistry.get(newType);
        if (!currentEntity || !registration || currentEntity.type === newType) {
          return state;
        }

        const newEntity = registration.createEntity({
          transform: { ...currentEntity.transform },
          properties: nextProperties,
          label: currentEntity.label,
        });
        nextEntityId = newEntity.id;

        const entities = new Map(workspace.entities);
        entities.delete(entityId);
        entities.set(newEntity.id, newEntity);

        const relations = workspace.relations.map((relation) => ({
          ...relation,
          sourceEntityId: relation.sourceEntityId === entityId ? newEntity.id : relation.sourceEntityId,
          targetEntityId: relation.targetEntityId === entityId ? newEntity.id : relation.targetEntityId,
        }));

        const nextBuilderParams = {
          ...workspace.builderParamValues,
          ...(workspace.builderParamValues.activeCurrentMeterId === entityId
            ? { activeCurrentMeterId: isCurrentMeter(newType) ? newEntity.id : '' }
            : {}),
          ...(workspace.builderParamValues.activeVoltmeterId === entityId
            ? { activeVoltmeterId: newType === 'voltmeter' ? newEntity.id : '' }
            : {}),
        };

        return patchWorkspace(state, resolvedWorkspaceId, {
          entities,
          relations,
          builderParamValues: normalizeBuilderParamValues(entities, nextBuilderParams),
          selectedEntityId: newEntity.id,
          currentResult: null,
          isRunning: false,
          solverError: null,
        });
      });

      if (nextEntityId && wasRunning) {
        get().runCircuit(resolvedWorkspaceId);
      }

      return nextEntityId;
    },

    // ─── 连线操作 ───

    addConnection(sourceId, targetId, sourcePort?, targetPort?, workspaceId?) {
      if (sourceId === targetId) return;
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);

      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);
        const exists = workspace.relations.some((r) => {
          const sameForward =
            r.sourceEntityId === sourceId && r.targetEntityId === targetId &&
            r.properties.sourcePort === (sourcePort ?? undefined) &&
            r.properties.targetPort === (targetPort ?? undefined);
          const sameReverse =
            r.sourceEntityId === targetId && r.targetEntityId === sourceId &&
            r.properties.sourcePort === (targetPort ?? undefined) &&
            r.properties.targetPort === (sourcePort ?? undefined);
          return sameForward || sameReverse;
        });
        if (exists) return state;

        const relation: Relation = {
          id: `builder-rel-${nextRelationId++}`,
          type: 'connection',
          sourceEntityId: sourceId,
          targetEntityId: targetId,
          properties: {
            ...(sourcePort ? { sourcePort } : {}),
            ...(targetPort ? { targetPort } : {}),
          },
        };

        return patchWorkspace(state, resolvedWorkspaceId, {
          relations: [...workspace.relations, relation],
          currentResult: null,
          isRunning: false,
          solverError: null,
        });
      });
    },

    removeConnection(relationId, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) => {
        const workspace = getWorkspace(state, resolvedWorkspaceId);
        return patchWorkspace(state, resolvedWorkspaceId, {
          relations: workspace.relations.filter((r) => r.id !== relationId),
          currentResult: null,
          isRunning: false,
          solverError: null,
        });
      });
    },

    // ─── 选择 ───

    selectEntity(id, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) => patchWorkspace(state, resolvedWorkspaceId, { selectedEntityId: id }));
    },

    setInteraction(interaction, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) => patchWorkspace(state, resolvedWorkspaceId, { interaction }));
    },

    // ─── 运行控制 ───

    runCircuit(workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      const workspace = getWorkspace(get(), resolvedWorkspaceId);
      const {
        entities,
        relations,
        builderParamValues,
        currentTemplateFamilyId,
        currentTemplateVariantId,
      } = workspace;
      const normalizedParams = normalizeBuilderParamValues(entities, builderParamValues);
      if (currentTemplateFamilyId && currentTemplateVariantId) {
        const validation = validateBuilderTemplateContext({
          familyId: currentTemplateFamilyId,
          variantId: currentTemplateVariantId,
          entities,
          activeCurrentMeterId: String(normalizedParams.activeCurrentMeterId ?? ''),
          activeVoltmeterId: String(normalizedParams.activeVoltmeterId ?? ''),
          builderParamValues: normalizedParams,
        });

        if (validation.errors.length > 0) {
          set((state) =>
            patchWorkspace(state, resolvedWorkspaceId, {
              builderParamValues: normalizedParams,
              isRunning: false,
              currentResult: null,
              solverError: validation.errors[0]!,
            }),
          );
          return;
        }
      }

      const result = evaluateBuilderScene({
        entities,
        relations,
        builderParamValues: normalizedParams,
        currentTemplateFamilyId,
        currentTemplateVariantId,
      });
      set((state) =>
        patchWorkspace(state, resolvedWorkspaceId, {
          builderParamValues: normalizedParams,
          isRunning: result.error === null,
          currentResult: result.result,
          solverError: result.error,
        }),
      );
    },

    stopCircuit(workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) =>
        patchWorkspace(state, resolvedWorkspaceId, {
          isRunning: false,
          currentResult: null,
          solverError: null,
        }),
      );
    },

    clearAll(workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) => ({
        workspaces: {
          ...state.workspaces,
          [resolvedWorkspaceId]: createEmptyBuilderWorkspaceState(),
        },
      }));
    },

    setCanvasTransform(transform, workspaceId) {
      const resolvedWorkspaceId = resolveWorkspaceId(get(), workspaceId);
      set((state) =>
        patchWorkspace(state, resolvedWorkspaceId, {
          canvasTransform: cloneCoordinateTransform(transform),
        }),
      );
    },
  }),
);

export function getBuilderWorkspaceSnapshot(
  workspaceId: BuilderWorkspaceId,
  state: BuilderStoreState = useBuilderStore.getState(),
): BuilderWorkspaceState {
  return state.workspaces[workspaceId];
}

export function useBuilderWorkspace<T>(
  workspaceId: BuilderWorkspaceId,
  selector: (workspace: BuilderWorkspaceState) => T,
): T {
  return useBuilderStore((state) => selector(state.workspaces[workspaceId]));
}

const CENTER_BASED_BUILDER_ENTITY_TYPES = new Set([
  'ammeter',
  'voltmeter',
  'galvanometer',
  'bulb',
  'motor',
]);

function buildBuilderClipboard(params: {
  type: BuilderClipboardData['type'];
  entities: Iterable<Entity>;
  relations: Iterable<Relation>;
}): BuilderClipboardData {
  const entities = Array.from(params.entities, cloneBuilderEntitySnapshot);
  const entityIds = new Set(entities.map((entity) => entity.id));
  const relations = Array.from(params.relations)
    .filter((relation) =>
      entityIds.has(relation.sourceEntityId) &&
      entityIds.has(relation.targetEntityId),
    )
    .map(cloneBuilderRelationSnapshot);

  return {
    type: params.type,
    entities,
    relations,
    sourceBounds: computeBuilderEntityBounds(entities),
    pasteCount: 0,
  };
}

function cloneBuilderEntitySnapshot(entity: Entity): Entity {
  return {
    ...entity,
    transform: {
      ...entity.transform,
      position: { ...entity.transform.position },
    },
    properties: cloneBuilderRecord(entity.properties),
  };
}

function cloneBuilderRelationSnapshot(relation: Relation): Relation {
  return {
    ...relation,
    properties: cloneBuilderRecord(relation.properties),
  };
}

function cloneBuilderRecord<T extends Record<string, unknown>>(value: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function computeBuilderEntityBounds(
  entities: Iterable<Entity>,
): BuilderClipboardBounds | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasEntities = false;

  for (const entity of entities) {
    hasEntities = true;

    const position = entity.transform.position;
    const radius = entity.properties.radius as number | undefined;
    const width = (entity.properties.width as number | undefined) ?? radius ?? 0.5;
    const height = (entity.properties.height as number | undefined) ?? width;
    const isCenterBased = CENTER_BASED_BUILDER_ENTITY_TYPES.has(entity.type) || radius !== undefined;
    const centerX = isCenterBased ? position.x : position.x + width / 2;
    const centerY = isCenterBased ? position.y : position.y + height / 2;
    const halfWidth = radius ?? width / 2;
    const halfHeight = radius ?? height / 2;

    minX = Math.min(minX, centerX - halfWidth);
    maxX = Math.max(maxX, centerX + halfWidth);
    minY = Math.min(minY, centerY - halfHeight);
    maxY = Math.max(maxY, centerY + halfHeight);
  }

  if (!hasEntities || !Number.isFinite(minX)) {
    return null;
  }

  return {
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function resolveBuilderClipboardPasteOffset(params: {
  clipboard: BuilderClipboardData;
  existingEntities: Map<EntityId, Entity>;
}): Vec2 {
  if (params.existingEntities.size === 0) {
    return { x: 0, y: 0 };
  }

  if (params.clipboard.type === 'scene') {
    const currentBounds = computeBuilderEntityBounds(params.existingEntities.values());
    const sourceBounds = params.clipboard.sourceBounds;
    if (currentBounds && sourceBounds) {
      const horizontalGap = Math.max(0.8, sourceBounds.width * 0.25);
      const verticalOffset = Math.max(0.5, Math.min(sourceBounds.height * 0.2, 1.2));

      return {
        x: currentBounds.maxX + horizontalGap - sourceBounds.minX,
        y: currentBounds.maxY - verticalOffset - sourceBounds.maxY,
      };
    }
  }

  const sourceBounds = params.clipboard.sourceBounds;
  const pasteStep = params.clipboard.pasteCount + 1;
  const horizontalStep = Math.max(0.6, (sourceBounds?.width ?? 0.5) * 0.75);
  const verticalStep = Math.max(0.4, (sourceBounds?.height ?? 0.5) * 0.75);

  return {
    x: horizontalStep * pasteStep,
    y: -verticalStep * pasteStep,
  };
}

function remapBuilderClipboardEntities(
  entities: Entity[],
  offset: Vec2,
): { entities: Entity[]; idMap: Map<EntityId, EntityId> } {
  const idMap = new Map<EntityId, EntityId>();
  const remappedEntities: Entity[] = [];

  for (const entity of entities) {
    const registration = entityRegistry.get(entity.type);
    const transform = {
      position: {
        x: entity.transform.position.x + offset.x,
        y: entity.transform.position.y + offset.y,
      },
      rotation: entity.transform.rotation,
    };
    const properties = cloneBuilderRecord(entity.properties);
    const nextEntity = registration
      ? registration.createEntity({
          transform,
          properties,
          label: entity.label,
        })
      : {
          ...cloneBuilderEntitySnapshot(entity),
          id: `entity-${crypto.randomUUID().slice(0, 8)}`,
          transform,
          properties,
        };

    idMap.set(entity.id, nextEntity.id);
    remappedEntities.push(nextEntity);
  }

  return { entities: remappedEntities, idMap };
}

function remapBuilderClipboardRelations(
  relations: Relation[],
  idMap: Map<EntityId, EntityId>,
): Relation[] {
  const remappedRelations: Relation[] = [];

  for (const relation of relations) {
    const sourceEntityId = idMap.get(relation.sourceEntityId);
    const targetEntityId = idMap.get(relation.targetEntityId);
    if (!sourceEntityId || !targetEntityId) continue;

    remappedRelations.push({
      ...cloneBuilderRelationSnapshot(relation),
      id: `builder-rel-${nextRelationId++}`,
      sourceEntityId,
      targetEntityId,
    });
  }

  return remappedRelations;
}

// ─── 求解辅助函数 ───

/**
 * 根据画布中的实体类型组合，自动推断 solverQualifier 并匹配求解器
 *
 * 使用类族判定而非精确类型匹配：
 * - 线性电阻：fixed-resistor / resistance-box
 * - 可调电阻：slide-rheostat / resistance-box
 * - 电流计：ammeter / galvanometer
 */
export function inferQualifier(
  entities: Map<EntityId, Entity>,
): Record<string, string> | undefined {
  const types = new Set<string>();
  for (const e of entities.values()) {
    types.add(e.type);
  }

  // 必须有电源
  if (!types.has('dc-source')) return undefined;

  // 类族辅助判断
  const hasFixedR = types.has('fixed-resistor') || types.has('resistance-box');
  const hasSlideRheostat = types.has('slide-rheostat');
  const hasRangeSwitch = types.has('range-switch');
  const hasCurrentMeter = types.has('ammeter') || types.has('galvanometer');
  const hasVoltmeter = types.has('voltmeter');
  const hasResistance = hasFixedR || hasSlideRheostat;

  // 按特征元件组合推断电路类型（从最具体到最宽泛）
  if (types.has('motor')) return { circuit: 'motor-circuit' };
  if (types.has('bulb')) return { circuit: 'bulb-circuit' };

  // 惠斯通电桥：电流计 + ≥4 个线性电阻
  if (hasCurrentMeter && hasFixedR) {
    let fixedCount = 0;
    for (const e of entities.values()) {
      if (e.type === 'fixed-resistor' || e.type === 'resistance-box') fixedCount++;
    }
    if (fixedCount >= 4) return { circuit: 'wheatstone-bridge' };
  }

  let switchCount = 0;
  let fixedCount = 0;
  for (const e of entities.values()) {
    if (e.type === 'switch') switchCount++;
    if (e.type === 'resistance-box' || e.type === 'fixed-resistor') fixedCount++;
  }

  // 半偏法优先于其他电学模板识别
  if (hasCurrentMeter && !hasVoltmeter && switchCount >= 2 && fixedCount >= 1) {
    return { circuit: 'half-deflection-ammeter' };
  }
  if (hasVoltmeter && hasSlideRheostat && switchCount >= 2 && fixedCount >= 1) {
    return { circuit: 'half-deflection-voltmeter' };
  }

  // 有电流计 + 电压表 + 滑动变阻器 → 测 EMF
  if (hasCurrentMeter && hasVoltmeter && hasSlideRheostat) {
    return { circuit: 'measure-emf-r' };
  }

  // 有电流计 + 电压表 + 电阻（无滑动变阻器）→ 伏安法
  if (hasCurrentMeter && hasVoltmeter && hasResistance) {
    return { circuit: 'voltammetry-compare' };
  }

  // 欧姆表：电流计 + 滑动变阻器 + 另一个待测电阻（fixed-resistor 或 resistance-box）
  if (hasCurrentMeter && types.has('slide-rheostat') && hasFixedR) {
    return { circuit: 'ohmmeter' };
  }

  // 多量程欧姆表：电流计 + 量程开关 + 待测电阻
  if (hasCurrentMeter && hasRangeSwitch && hasFixedR) {
    return { circuit: 'multi-range-ohmmeter' };
  }

  // 有电流计 + 电阻（最简单串联电路）→ 通用电路兜底
  if (hasCurrentMeter && hasResistance) {
    return { circuit: 'general-circuit' };
  }

  // 仅有电源 + 电阻（无仪表）→ 通用电路兜底
  if (hasResistance) {
    return { circuit: 'general-circuit' };
  }

  return undefined;
}

function getFirstCurrentMeterId(entities: Map<EntityId, Entity>): string {
  for (const entity of entities.values()) {
    if (isCurrentMeter(entity.type)) return entity.id;
  }
  return '';
}

function getFirstVoltmeterId(entities: Map<EntityId, Entity>): string {
  for (const entity of entities.values()) {
    if (entity.type === 'voltmeter') return entity.id;
  }
  return '';
}

export function normalizeBuilderParamValues(
  entities: Map<EntityId, Entity>,
  paramValues: ParamValues,
): ParamValues {
  const next: ParamValues = {
    ...DEFAULT_BUILDER_PARAM_VALUES,
    ...paramValues,
  };

  const activeCurrentMeterId = String(next.activeCurrentMeterId ?? '');
  const activeVoltmeterId = String(next.activeVoltmeterId ?? '');
  const activeCurrentEntity = activeCurrentMeterId ? entities.get(activeCurrentMeterId) : undefined;
  const activeVoltmeterEntity = activeVoltmeterId ? entities.get(activeVoltmeterId) : undefined;

  next.activeCurrentMeterId =
    activeCurrentEntity && isCurrentMeter(activeCurrentEntity.type)
      ? activeCurrentMeterId
      : getFirstCurrentMeterId(entities);

  next.activeVoltmeterId =
    activeVoltmeterEntity?.type === 'voltmeter'
      ? activeVoltmeterId
      : getFirstVoltmeterId(entities);

  const method = String(next.method ?? 'internal');
  next.method = method === 'external' ? 'external' : 'internal';

  return next;
}

function getBuilderParamValuesForPreset(
  preset: PresetData,
  entities: Map<EntityId, Entity>,
): ParamValues {
  const next: ParamValues = {
    ...DEFAULT_BUILDER_PARAM_VALUES,
    ...preset.paramValues,
  };
  const presetMethod = preset.paramValues.method;
  const presetCircuit = preset.solverQualifier?.circuit;

  if (presetMethod === 'internal' || presetMethod === 'external') {
    next.method = presetMethod;
  } else if (presetCircuit === 'voltammetry-external') {
    next.method = 'external';
  } else if (presetCircuit === 'voltammetry-internal') {
    next.method = 'internal';
  }

  return normalizeBuilderParamValues(entities, next);
}

function evaluateBuilderScene(params: {
  entities: Map<EntityId, Entity>;
  relations: Relation[];
  builderParamValues: ParamValues;
  currentTemplateFamilyId: string | null;
  currentTemplateVariantId: string | null;
}): { result: PhysicsResult | null; error: string | null } {
  const templateRuntime = evaluateBuilderTemplateRuntime({
    familyId: params.currentTemplateFamilyId,
    variantId: params.currentTemplateVariantId,
    entities: params.entities,
    builderParamValues: params.builderParamValues,
  });
  if (templateRuntime) {
    return templateRuntime;
  }

  return solveScene(
    params.entities,
    params.relations,
    params.builderParamValues,
    resolveBuilderTemplateQualifier(
      params.currentTemplateFamilyId,
      params.currentTemplateVariantId,
    ),
  );
}

function resolveBuilderTemplateQualifier(
  familyId: string | null,
  variantId: string | null,
): Record<string, string> | undefined {
  if (familyId === 'voltammetry') {
    return {
      circuit: variantId === 'external' ? 'voltammetry-external' : 'voltammetry-internal',
    };
  }

  return undefined;
}

function findPreferredSourceId(entities: Map<EntityId, Entity>): EntityId | null {
  for (const entity of entities.values()) {
    if (entity.type === 'dc-source') return entity.id;
  }

  return entities.values().next().value?.id ?? null;
}

/**
 * 安全检查：检测危险电路配置
 */
function checkCircuitSafety(
  entities: Map<EntityId, Entity>,
): string | null {
  const types = new Set<string>();
  for (const e of entities.values()) {
    types.add(e.type);
  }

  if (!types.has('dc-source')) return null;

  // 有电源但没有任何具备电阻的元件 → 短路危险
  const hasResistance =
    types.has('fixed-resistor') ||
    types.has('slide-rheostat') ||
    types.has('resistance-box') ||
    types.has('bulb') ||
    types.has('motor') ||
    types.has('ammeter') ||
    types.has('galvanometer') ||
    types.has('capacitor');

  if (!hasResistance) {
    return '⚠ 安全警告：电路中没有电阻类元件，直接连接电源会导致短路！请添加电阻、灯泡或电动机';
  }

  return null;
}

function solveScene(
  entities: Map<EntityId, Entity>,
  relations: Relation[],
  builderParamValues: ParamValues,
  qualifierOverride?: Record<string, string>,
): { result: PhysicsResult | null; error: string | null } {
  if (entities.size === 0) {
    return { result: null, error: '画布为空，请添加元件' };
  }

  // 检查是否有连线
  const connectionCount = relations.filter((r) => r.type === 'connection').length;
  if (connectionCount === 0) {
    return { result: null, error: '请连接元件（选中元件后点击底部「连线」按钮）' };
  }

  // 安全检查
  const safetyWarning = checkCircuitSafety(entities);
  if (safetyWarning) {
    return { result: null, error: safetyWarning };
  }

  const scene: SceneDefinition = {
    entities,
    relations,
    paramGroups: [],
    paramValues: normalizeBuilderParamValues(entities, builderParamValues),
  };

  // 自动推断 qualifier
  const qualifier = qualifierOverride ?? inferQualifier(entities);

  let solvers = solverRegistry.match(scene, qualifier);

  // 专用求解器匹配失败 → 尝试通用电路求解器兜底
  if (solvers.length === 0 && qualifier) {
    solvers = solverRegistry.match(scene, { circuit: 'general-circuit' });
  }

  if (solvers.length === 0) {
    if (!qualifier) {
      return { result: null, error: '缺少关键元件（至少需要电源 + 用电器）' };
    }
    return { result: null, error: '电路元件组合无法识别，请检查元件是否齐全' };
  }

  const solver = solvers[0]!;
  try {
    const result = solver.solve(scene, 0, 0, null);
    return { result, error: null };
  } catch {
    return { result: null, error: '求解器执行出错，请检查参数是否合理' };
  }
}
