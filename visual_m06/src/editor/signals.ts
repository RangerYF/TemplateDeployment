// ─── Signal<T> 发布订阅系统（与 visual_template 一致）───

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

// ─── 全局 Signal 实例 ───

export const signals = {
  /** 向量状态变化 */
  vectorChanged: new Signal<{ key: string }>(),
  /** 预设加载 */
  presetLoaded: new Signal<{ presetId: string }>(),
  /** 运算类型切换 */
  operationChanged: new Signal<{ operation: string }>(),
  /** 命令执行（供 historyStore 使用） */
  commandExecuted: new Signal<{ label: string; direction: 'do' | 'undo' | 'redo' }>(),
};
