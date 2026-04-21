import { create } from 'zustand';
import type { DemoEntity, DemoPoint, DemoVector, DemoVecOp, DemoBinding, DemoSnapshot } from './demoTypes';

// ─── Store 接口 ───

interface DemoEntityStoreState {
  entities: Record<string, DemoEntity>;
  bindings: DemoBinding[];
  nextId: number;

  // ─── CRUD ───
  addEntity(entity: DemoEntity): void;
  removeEntity(id: string): void;
  updateEntity(id: string, patch: Partial<DemoPoint> | Partial<DemoVector> | Partial<DemoVecOp>): void;

  // ─── 绑定 ───
  addBinding(b: DemoBinding): void;
  removeBinding(bindingId: string): void;
  getBoundPartner(pointId: string): string | null;
  getBoundGroup(pointId: string): string[];

  // ─── 快照（供 Import/Export 和撤销使用）───
  getSnapshot(): DemoSnapshot;
  loadSnapshot(snap: DemoSnapshot): void;

  // ─── 辅助 ───
  nextEntityId(): string;
}

export const useDemoEntityStore = create<DemoEntityStoreState>()((set, get) => ({
  entities: {},
  bindings: [],
  nextId: 1,

  addEntity(entity) {
    set((s) => ({
      entities: { ...s.entities, [entity.id]: entity },
    }));
  },

  removeEntity(id) {
    set((s) => {
      const next = { ...s.entities };
      delete next[id];
      return { entities: next };
    });
  },

  updateEntity(id, patch) {
    set((s) => {
      const existing = s.entities[id];
      if (!existing) return s;
      return {
        entities: {
          ...s.entities,
          [id]: { ...existing, ...patch } as DemoEntity,
        },
      };
    });
  },

  addBinding(b) {
    set((s) => ({ bindings: [...s.bindings, b] }));
  },

  removeBinding(bindingId) {
    set((s) => ({ bindings: s.bindings.filter((b) => b.id !== bindingId) }));
  },

  getBoundPartner(pointId) {
    const { bindings } = get();
    for (const b of bindings) {
      if (b.pointA === pointId) return b.pointB;
      if (b.pointB === pointId) return b.pointA;
    }
    return null;
  },

  getBoundGroup(pointId) {
    const { bindings } = get();
    const group = new Set<string>([pointId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const b of bindings) {
        if (group.has(b.pointA) && !group.has(b.pointB)) { group.add(b.pointB); changed = true; }
        if (group.has(b.pointB) && !group.has(b.pointA)) { group.add(b.pointA); changed = true; }
      }
    }
    group.delete(pointId);
    return [...group];
  },

  getSnapshot(): DemoSnapshot {
    const s = get();
    return {
      entities: JSON.parse(JSON.stringify(s.entities)) as Record<string, DemoEntity>,
      bindings: [...s.bindings],
      nextId: s.nextId,
    };
  },

  loadSnapshot(snap) {
    set({
      entities: JSON.parse(JSON.stringify(snap.entities)) as Record<string, DemoEntity>,
      bindings: snap.bindings ? [...snap.bindings] : [],
      nextId: snap.nextId,
    });
  },

  nextEntityId(): string {
    const state = get();
    const id = `demo_${state.nextId}`;
    set({ nextId: state.nextId + 1 });
    return id;
  },
}));
