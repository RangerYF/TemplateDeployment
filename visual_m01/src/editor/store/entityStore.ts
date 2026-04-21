import { create } from 'zustand';
import type { Entity, EntityType, EntityPropertiesMap, PointProperties, SegmentProperties } from '../entities/types';
import { signals } from '../signals';
import type { BuilderResult, PolyhedronResult, SurfaceResult } from '../../engine/types';

interface EntityStoreState {
  entities: Record<string, Entity>;
  nextId: number;
  activeGeometryId: string | null;

  // CRUD
  createEntity<T extends EntityType>(type: T, properties: EntityPropertiesMap[T]): Entity<T>;
  deleteEntity(id: string): void;
  updateProperties<T extends EntityType>(id: string, patch: Partial<EntityPropertiesMap[T]>): void;
  getEntity(id: string): Entity | undefined;

  // 查询快捷方法
  getActiveGeometry(): Entity<'geometry'> | undefined;
  getCoordinateSystem(): Entity<'coordinateSystem'> | undefined;
  getCircumSphere(): Entity<'circumSphere'> | undefined;
  getEntitiesByType<T extends EntityType>(type: T): Entity<T>[];
  getBuiltInEntities(geometryId: string): Entity[];
  getRelatedEntities(geometryId: string): Entity[];

  // 点/线段查找（截面复用）
  findPointAtVertex(geometryId: string, vertexIndex: number): Entity<'point'> | undefined;
  findPointOnEdge(geometryId: string, edgeStart: number, edgeEnd: number, t: number, tolerance?: number): Entity<'point'> | undefined;
  findSegmentByPoints(startPointId: string, endPointId: string): Entity<'segment'> | undefined;

  // 按 label 查找点
  findPointByLabel(label: string): Entity<'point'> | undefined;
  findPointsByLabels(labels: string[]): Map<string, Entity<'point'> | undefined>;

  // 引用查询
  getReferencingEntities(entityId: string): Entity[];

  // 级联删除
  cascadeDelete(entityId: string): Entity[];

  // 恢复（undo 专用）
  restoreEntity(entity: Entity): void;
  restoreEntities(entities: Entity[]): void;

  // 批量操作
  createBuiltInEntities(geometryId: string, builderResult: BuilderResult): void;
  rebuildBuiltInEntities(geometryId: string, builderResult: BuilderResult): void;

  // activeGeometryId 管理
  setActiveGeometryId(id: string | null): void;

  // 可见性 / 锁定
  toggleVisible(id: string): void;
  toggleLocked(id: string): void;

  // 快照：导入/导出
  getSnapshot(): { entities: Record<string, Entity>; nextId: number; activeGeometryId: string | null };
  loadSnapshot(snapshot: { entities: Record<string, Entity>; nextId: number; activeGeometryId: string | null }): void;
}

/** 检查实体 properties 中是否引用了目标 entityId */
function entityReferences(entity: Entity, targetId: string): boolean {
  const p = entity.properties as unknown as Record<string, unknown>;

  // segment.startPointId / endPointId
  if (p.startPointId === targetId || p.endPointId === targetId) return true;

  // face.pointIds
  if (Array.isArray(p.pointIds) && (p.pointIds as string[]).includes(targetId)) return true;

  // face.source.definingPointIds
  const source = p.source as { definingPointIds?: string[] } | undefined;
  if (source?.definingPointIds?.includes(targetId)) return true;

  // coordinateSystem.originPointId
  if (p.originPointId === targetId) return true;

  // circumCircle.pointIds（tuple）
  // 已被上面的 pointIds 检查覆盖

  // angleMeasurement.entityIds
  if (Array.isArray(p.entityIds) && (p.entityIds as string[]).includes(targetId)) return true;

  return false;
}

/** 收集实体直接引用的子实体 ID */
function collectChildIds(entity: Entity): string[] {
  const ids: string[] = [];
  const p = entity.properties as unknown as Record<string, unknown>;

  if (typeof p.startPointId === 'string') ids.push(p.startPointId);
  if (typeof p.endPointId === 'string') ids.push(p.endPointId);
  if (Array.isArray(p.pointIds)) ids.push(...(p.pointIds as string[]));

  const source = p.source as { definingPointIds?: string[] } | undefined;
  if (source?.definingPointIds) ids.push(...source.definingPointIds);

  if (typeof p.originPointId === 'string') ids.push(p.originPointId);

  if (Array.isArray(p.entityIds)) ids.push(...(p.entityIds as string[]));

  return [...new Set(ids)];
}

/** 下标数字 → Unicode 下标映射 */
const SUBSCRIPT_MAP: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
};

/** Unicode 下标 → 普通数字映射 */
const SUBSCRIPT_REVERSE: Record<string, string> = {};
for (const [k, v] of Object.entries(SUBSCRIPT_MAP)) {
  SUBSCRIPT_REVERSE[v] = k;
}

/**
 * 标准化标签：大写 + Unicode 下标转为普通数字，用于匹配比较
 * 例如 "A₁" → "A1"，"a1" → "A1"
 */
function normalizeLabel(label: string): string {
  let result = '';
  for (const ch of label) {
    if (SUBSCRIPT_REVERSE[ch]) {
      result += SUBSCRIPT_REVERSE[ch];
    } else {
      result += ch.toUpperCase();
    }
  }
  return result;
}

export const useEntityStore = create<EntityStoreState>()((set, get) => ({
  entities: {},
  nextId: 1,
  activeGeometryId: null,

  // ─── CRUD ───

  createEntity<T extends EntityType>(type: T, properties: EntityPropertiesMap[T]): Entity<T> {
    const state = get();
    const id = String(state.nextId);
    const entity: Entity<T> = { id, type, properties, visible: true };

    set({
      entities: { ...state.entities, [id]: entity as Entity },
      nextId: state.nextId + 1,
    });

    signals.entityCreated.emit({ entity: entity as Entity });
    return entity;
  },

  deleteEntity(id: string): void {
    const state = get();
    const entity = state.entities[id];
    if (!entity) return;

    const newEntities = { ...state.entities };
    delete newEntities[id];
    set({ entities: newEntities });

    signals.entityDeleted.emit({ entity });
  },

  updateProperties<T extends EntityType>(id: string, patch: Partial<EntityPropertiesMap[T]>): void {
    const state = get();
    const entity = state.entities[id];
    if (!entity) return;

    const updated: Entity = {
      ...entity,
      properties: { ...entity.properties, ...patch },
    };

    set({ entities: { ...state.entities, [id]: updated } });

    signals.entityUpdated.emit({ entity: updated, changes: Object.keys(patch) });
  },

  getEntity(id: string): Entity | undefined {
    return get().entities[id];
  },

  // ─── 查询快捷方法 ───

  getActiveGeometry(): Entity<'geometry'> | undefined {
    const { activeGeometryId, entities } = get();
    if (!activeGeometryId) return undefined;
    const e = entities[activeGeometryId];
    return e?.type === 'geometry' ? (e as Entity<'geometry'>) : undefined;
  },

  getCoordinateSystem(): Entity<'coordinateSystem'> | undefined {
    return Object.values(get().entities).find(
      (e) => e.type === 'coordinateSystem'
    ) as Entity<'coordinateSystem'> | undefined;
  },

  getCircumSphere(): Entity<'circumSphere'> | undefined {
    return Object.values(get().entities).find(
      (e) => e.type === 'circumSphere'
    ) as Entity<'circumSphere'> | undefined;
  },

  getEntitiesByType<T extends EntityType>(type: T): Entity<T>[] {
    return Object.values(get().entities).filter(
      (e) => e.type === type
    ) as Entity<T>[];
  },

  getBuiltInEntities(geometryId: string): Entity[] {
    return Object.values(get().entities).filter((e) => {
      if (e.type !== 'point' && e.type !== 'segment' && e.type !== 'face') return false;
      const p = e.properties as { builtIn?: boolean; geometryId?: string };
      return p.builtIn === true && p.geometryId === geometryId;
    });
  },

  getRelatedEntities(geometryId: string): Entity[] {
    return Object.values(get().entities).filter((e) => {
      const p = e.properties as { geometryId?: string };
      return p.geometryId === geometryId;
    });
  },

  // ─── 点/线段查找（截面复用） ───

  findPointAtVertex(geometryId: string, vertexIndex: number): Entity<'point'> | undefined {
    return Object.values(get().entities).find((e) => {
      if (e.type !== 'point') return false;
      const p = e.properties as PointProperties;
      return p.geometryId === geometryId
        && p.constraint.type === 'vertex'
        && p.constraint.vertexIndex === vertexIndex;
    }) as Entity<'point'> | undefined;
  },

  findPointOnEdge(geometryId: string, edgeStart: number, edgeEnd: number, t: number, tolerance = 1e-6): Entity<'point'> | undefined {
    return Object.values(get().entities).find((e) => {
      if (e.type !== 'point') return false;
      const p = e.properties as PointProperties;
      if (p.geometryId !== geometryId || p.constraint.type !== 'edge') return false;
      const c = p.constraint;
      // 同向匹配
      if (c.edgeStart === edgeStart && c.edgeEnd === edgeEnd && Math.abs(c.t - t) < tolerance) return true;
      // 反向匹配
      if (c.edgeStart === edgeEnd && c.edgeEnd === edgeStart && Math.abs(c.t - (1 - t)) < tolerance) return true;
      return false;
    }) as Entity<'point'> | undefined;
  },

  findSegmentByPoints(startPointId: string, endPointId: string): Entity<'segment'> | undefined {
    return Object.values(get().entities).find((e) => {
      if (e.type !== 'segment') return false;
      const p = e.properties as SegmentProperties;
      return (p.startPointId === startPointId && p.endPointId === endPointId)
        || (p.startPointId === endPointId && p.endPointId === startPointId);
    }) as Entity<'segment'> | undefined;
  },

  // ─── 按 label 查找点 ───

  findPointByLabel(label: string): Entity<'point'> | undefined {
    const normalized = normalizeLabel(label);
    return Object.values(get().entities).find((e) => {
      if (e.type !== 'point') return false;
      const p = e.properties as PointProperties;
      return p.label && normalizeLabel(p.label) === normalized;
    }) as Entity<'point'> | undefined;
  },

  findPointsByLabels(labels: string[]): Map<string, Entity<'point'> | undefined> {
    const result = new Map<string, Entity<'point'> | undefined>();
    for (const label of labels) {
      result.set(label, get().findPointByLabel(label));
    }
    return result;
  },

  // ─── 引用查询 ───

  getReferencingEntities(entityId: string): Entity[] {
    return Object.values(get().entities).filter(
      (e) => e.id !== entityId && entityReferences(e, entityId)
    );
  },

  // ─── 级联删除 ───

  cascadeDelete(entityId: string): Entity[] {
    const state = get();
    const entity = state.entities[entityId];
    if (!entity) return [];

    const deleted: Entity[] = [];
    const childIds = collectChildIds(entity);

    // 先删除自身
    get().deleteEntity(entityId);
    deleted.push(entity);

    // 检查子实体是否孤立
    for (const childId of childIds) {
      const child = get().getEntity(childId);
      if (!child) continue;

      const refs = get().getReferencingEntities(childId);
      if (refs.length === 0) {
        // 递归级联删除孤立子实体
        const cascaded = get().cascadeDelete(childId);
        deleted.push(...cascaded);
      }
    }

    return deleted;
  },

  // ─── 恢复（undo 专用） ───

  restoreEntity(entity: Entity): void {
    const state = get();
    const numericId = Number(entity.id);
    const newNextId = numericId >= state.nextId ? numericId + 1 : state.nextId;

    set({
      entities: { ...state.entities, [entity.id]: entity },
      nextId: newNextId,
    });

    signals.entityCreated.emit({ entity });
  },

  restoreEntities(entities: Entity[]): void {
    const state = get();
    const newEntities = { ...state.entities };
    let maxId = state.nextId;

    for (const entity of entities) {
      newEntities[entity.id] = entity;
      const numericId = Number(entity.id);
      if (numericId >= maxId) {
        maxId = numericId + 1;
      }
    }

    set({ entities: newEntities, nextId: maxId });

    for (const entity of entities) {
      signals.entityCreated.emit({ entity });
    }
  },

  // ─── 批量操作 ───

  createBuiltInEntities(geometryId: string, builderResult: BuilderResult): void {
    const store = get();

    if (builderResult.kind === 'polyhedron') {
      const poly = builderResult as PolyhedronResult;

      // 创建顶点 Point
      const pointIds: string[] = [];
      for (let i = 0; i < poly.vertices.length; i++) {
        const point = store.createEntity('point', {
          builtIn: true,
          geometryId,
          constraint: { type: 'vertex', vertexIndex: i },
          label: poly.vertices[i].label,
        });
        pointIds.push(point.id);
      }

      // 创建棱线 Segment
      for (const [startIdx, endIdx] of poly.edges) {
        store.createEntity('segment', {
          builtIn: true,
          geometryId,
          startPointId: pointIds[startIdx],
          endPointId: pointIds[endIdx],
          style: { color: '#000000', dashed: false },
        });
      }

      // 创建面 Face
      for (let i = 0; i < poly.faces.length; i++) {
        store.createEntity('face', {
          builtIn: true,
          geometryId,
          pointIds: poly.faces[i].map((idx) => pointIds[idx]),
          source: { type: 'geometry', faceIndex: i },
        });
      }
    } else {
      const surface = builderResult as SurfaceResult;

      // 1. 创建特征点
      for (let i = 0; i < surface.featurePoints.length; i++) {
        store.createEntity('point', {
          builtIn: true,
          geometryId,
          constraint: { type: 'vertex', vertexIndex: i },
          label: surface.featurePoints[i].label,
        });
      }

      // 2. 为每条线创建 Segment Entity（使用 curvePoints 渲染）
      for (let i = 0; i < surface.lines.length; i++) {
        store.createEntity('segment', {
          builtIn: true,
          geometryId,
          startPointId: '',
          endPointId: '',
          style: { color: '#000000', dashed: false },
          curvePoints: surface.lines[i].points as [number, number, number][],
          lineIndex: i,
        });
      }

      // 3. 为每个面创建 Face Entity
      for (let i = 0; i < surface.faces.length; i++) {
        store.createEntity('face', {
          builtIn: true,
          geometryId,
          pointIds: [],
          source: { type: 'surface', surfaceType: surface.faces[i].surfaceType, faceIndex: i },
        });
      }
    }
  },

  rebuildBuiltInEntities(geometryId: string, builderResult: BuilderResult): void {
    const store = get();

    // 1. 收集所有 builtIn 子实体
    const builtInEntities = store.getBuiltInEntities(geometryId);

    // 2. 删除 builtIn 子实体并级联清理引用了旧顶点的用户实体
    for (const entity of builtInEntities) {
      if (store.getEntity(entity.id)) {
        store.cascadeDelete(entity.id);
      }
    }

    // 3. 根据新 BuilderResult 重新创建
    store.createBuiltInEntities(geometryId, builderResult);
  },

  toggleVisible(id: string): void {
    const state = get();
    const entity = state.entities[id];
    if (!entity) return;
    set({
      entities: { ...state.entities, [id]: { ...entity, visible: !entity.visible } },
    });
  },

  toggleLocked(id: string): void {
    const state = get();
    const entity = state.entities[id];
    if (!entity) return;
    set({
      entities: { ...state.entities, [id]: { ...entity, locked: !entity.locked } },
    });
  },

  setActiveGeometryId(id: string | null): void {
    set({ activeGeometryId: id });
  },

  getSnapshot() {
    const { entities, nextId, activeGeometryId } = get();
    return { entities, nextId, activeGeometryId };
  },

  loadSnapshot(snapshot) {
    set({
      entities: snapshot.entities,
      nextId: snapshot.nextId,
      activeGeometryId: snapshot.activeGeometryId,
    });
  },
}));
