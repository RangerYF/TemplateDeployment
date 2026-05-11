export interface SimState {
  [key: string]: number;
}

/**
 * Ring buffer for storing simulation state history.
 * Supports rewinding and jumping to any stored frame.
 */
export class StateHistory<T extends SimState = SimState> {
  private buffer: { t: number; state: T }[];
  private head: number = 0;
  private count: number = 0;

  constructor(private capacity: number = 10000) {
    this.buffer = new Array(capacity);
  }

  push(t: number, state: T): void {
    this.buffer[this.head] = { t, state: { ...state } };
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  get length(): number {
    return this.count;
  }

  getAt(index: number): { t: number; state: T } | undefined {
    if (index < 0 || index >= this.count) return undefined;
    const start = this.count < this.capacity ? 0 : this.head;
    const realIndex = (start + index) % this.capacity;
    return this.buffer[realIndex];
  }

  getLatest(): { t: number; state: T } | undefined {
    if (this.count === 0) return undefined;
    const idx = (this.head - 1 + this.capacity) % this.capacity;
    return this.buffer[idx];
  }

  findClosest(t: number): { t: number; state: T } | undefined {
    if (this.count === 0) return undefined;
    let best = this.getAt(0)!;
    let bestDist = Math.abs(best.t - t);
    for (let i = 1; i < this.count; i++) {
      const entry = this.getAt(i)!;
      const dist = Math.abs(entry.t - t);
      if (dist < bestDist) {
        best = entry;
        bestDist = dist;
      }
    }
    return best;
  }

  truncateAfter(index: number): void {
    if (index < 0) {
      this.count = 0;
      this.head = 0;
      return;
    }
    if (index >= this.count) return;
    const start = this.count < this.capacity ? 0 : this.head;
    this.head = (start + index + 1) % this.capacity;
    this.count = index + 1;
  }

  clear(): void {
    this.count = 0;
    this.head = 0;
  }

  toArray(): { t: number; state: T }[] {
    const result: { t: number; state: T }[] = [];
    for (let i = 0; i < this.count; i++) {
      result.push(this.getAt(i)!);
    }
    return result;
  }
}
