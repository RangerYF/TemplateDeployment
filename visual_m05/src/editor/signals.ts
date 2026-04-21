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

// ─── Command 占位类型 ───

export interface CommandLike {
  type: string;
  label: string;
}

// ─── 全局 Signal 实例 ───

export const signals = {
  simulationCreated: new Signal<{ simId: string }>(),
  simulationUpdated: new Signal<{ simId: string; changes: string[] }>(),
  simulationRun: new Signal<{ simId: string }>(),
  simulationStopped: new Signal<{ simId: string }>(),
  simulationReset: new Signal<{ simId: string }>(),
  selectionChanged: new Signal<{ simId: string | null }>(),
  paramChanged: new Signal<{ simId: string; param: string }>(),
  commandExecuted: new Signal<{ command: CommandLike; direction: 'do' | 'undo' | 'redo' }>(),
};
