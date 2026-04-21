import { create } from 'zustand';
import type { AnyEntity, ViewportState } from '@/types';
import { DEFAULT_M03_VIEWPORT } from '@/types';

// ─── Tool ID ──────────────────────────────────────────────────────────────────

export type ActiveToolId = 'pan-zoom' | 'point-on-curve' | 'line-drag' | 'line-two-point' | 'movable-point';

// ─── Display options ──────────────────────────────────────────────────────────

export interface DisplayOptions {
  showGrid:            boolean;
  showFoci:            boolean;
  showDirectrices:     boolean;
  showAsymptotes:      boolean;
  showLabels:          boolean;
  showIntersections:   boolean;
  /** Render vertex points (green dots) at key conic vertices. */
  showVertices:        boolean;
  /** Render the conic's own axes of symmetry as grey dashed lines. */
  showAxesOfSymmetry:  boolean;
  /** Render the tangent line at the dynamic snap point (PointOnCurveTool). */
  showTangent:         boolean;
  /** Render the normal line at the dynamic snap point (PointOnCurveTool). */
  showNormal:          boolean;
  /** Render the focal chord through the dynamic snap point (PointOnCurveTool). */
  showFocalChord:      boolean;
}

// ─── State shape ──────────────────────────────────────────────────────────────

/** Focal constraint: when set, LineDragTool rotates line around this focus. */
export interface FocalConstraintState {
  fx: number;
  fy: number;
}

export interface EntityStoreSnapshot {
  entities: AnyEntity[];
  activeEntityId: string | null;
  viewport: ViewportState;
  displayOptions: DisplayOptions;
  activeTool: ActiveToolId;
  focalConstraint: FocalConstraintState | null;
}

export interface EntityStoreState {
  entities:       AnyEntity[];
  activeEntityId: string | null;
  hoveredEntityId: string | null;
  viewport:       ViewportState;
  displayOptions: DisplayOptions;
  activeTool:     ActiveToolId;
  focalConstraint: FocalConstraintState | null;

  addEntity:           (entity: AnyEntity) => void;
  removeEntity:        (id: string) => void;
  updateEntity:        (id: string, entity: AnyEntity) => void;
  /** Replace the entire entity list (used by PresetsPanel — not undoable). */
  replaceAllEntities:  (entities: AnyEntity[]) => void;
  setViewport:         (vp: ViewportState) => void;
  setActiveEntityId:   (id: string | null) => void;
  setHoveredEntityId:  (id: string | null) => void;
  setDisplayOption:    <K extends keyof DisplayOptions>(key: K, value: DisplayOptions[K]) => void;
  setActiveTool:       (id: ActiveToolId) => void;
  setFocalConstraint:  (fc: FocalConstraintState | null) => void;
  getSnapshot:         () => EntityStoreSnapshot;
  loadSnapshot:        (snapshot?: Partial<EntityStoreSnapshot>) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const DEFAULT_DISPLAY_OPTIONS: DisplayOptions = {
  showGrid:           true,
  showFoci:           true,
  showDirectrices:    true,
  showAsymptotes:     true,
  showLabels:         true,
  showIntersections:  true,
  showVertices:       true,
  showAxesOfSymmetry: false,
  showTangent:        false,
  showNormal:         false,
  showFocalChord:     false,
};

export const useEntityStore = create<EntityStoreState>((set, get) => ({
  entities:       [],
  activeEntityId: null,
  hoveredEntityId: null,
  viewport:       { ...DEFAULT_M03_VIEWPORT },
  displayOptions: { ...DEFAULT_DISPLAY_OPTIONS },
  activeTool: 'pan-zoom',
  focalConstraint: null,

  addEntity: (entity) =>
    set((s) => ({ entities: [...s.entities, entity] })),

  removeEntity: (id) =>
    set((s) => ({ entities: s.entities.filter((e) => e.id !== id) })),

  replaceAllEntities: (entities) =>
    set({ entities, activeEntityId: null }),

  updateEntity: (id, entity) =>
    set((s) => ({ entities: s.entities.map((e) => (e.id === id ? entity : e)) })),

  setViewport: (vp) => set({ viewport: vp }),

  setActiveEntityId: (id) => set({ activeEntityId: id }),

  setHoveredEntityId: (id) => set({ hoveredEntityId: id }),

  setDisplayOption: (key, value) =>
    set((s) => ({ displayOptions: { ...s.displayOptions, [key]: value } })),

  setActiveTool: (id) => set({ activeTool: id }),

  setFocalConstraint: (fc) => set({ focalConstraint: fc }),

  getSnapshot: () => {
    const state: EntityStoreState = get();
    return {
      entities: structuredClone(state.entities),
      activeEntityId: state.activeEntityId,
      viewport: structuredClone(state.viewport),
      displayOptions: structuredClone(state.displayOptions),
      activeTool: state.activeTool,
      focalConstraint: state.focalConstraint ? structuredClone(state.focalConstraint) : null,
    };
  },

  loadSnapshot: (snapshot) =>
    set({
      entities: snapshot?.entities ? structuredClone(snapshot.entities) : [],
      activeEntityId: snapshot?.activeEntityId ?? null,
      hoveredEntityId: null,
      viewport: snapshot?.viewport ? structuredClone(snapshot.viewport) : { ...DEFAULT_M03_VIEWPORT },
      displayOptions: snapshot?.displayOptions
        ? structuredClone(snapshot.displayOptions)
        : { ...DEFAULT_DISPLAY_OPTIONS },
      activeTool: snapshot?.activeTool ?? 'pan-zoom',
      focalConstraint: snapshot?.focalConstraint ? structuredClone(snapshot.focalConstraint) : null,
    }),
}));
