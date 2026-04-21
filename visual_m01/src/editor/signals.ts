import type { Entity } from './entities/types';

// ─── Signal 类 ───

export class Signal<T = void> {
  private listeners = new Set<(data: T) => void>();

  subscribe(listener: (data: T) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(data: T): void {
    for (const listener of this.listeners) {
      listener(data);
    }
  }

  clear(): void {
    this.listeners.clear();
  }
}

// ─── Command 占位类型（阶段2回补） ───

export interface CommandLike {
  type: string;
  label: string;
}

// ─── 全局 Signal 实例 ───

export const signals = {
  entityCreated: new Signal<{ entity: Entity }>(),
  entityUpdated: new Signal<{ entity: Entity; changes: string[] }>(),
  entityDeleted: new Signal<{ entity: Entity }>(),

  selectionChanged: new Signal<{ selectedIds: string[]; primaryId: string | null }>(),

  toolChanged: new Signal<{ toolId: string }>(),

  commandExecuted: new Signal<{ command: CommandLike; direction: 'do' | 'undo' | 'redo' }>(),

  geometryRebuilt: new Signal<{ geometryId: string }>(),
};
