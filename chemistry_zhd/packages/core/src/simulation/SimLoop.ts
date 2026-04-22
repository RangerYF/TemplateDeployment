import { StateHistory, SimState } from './StateHistory';

export type StepFunction<T extends SimState = SimState> = (t: number, dt: number, state: T) => T;

export interface SimLoopOptions<T extends SimState = SimState> {
  /** Physics timestep in seconds */
  dt: number;
  /** Step function: computes next state from current */
  stepFn: StepFunction<T>;
  /** Render callback: called each animation frame */
  renderFn: (t: number, state: T) => void;
  /** Initial state */
  initialState: T;
  /** History buffer capacity */
  historyCapacity?: number;
}

export class SimLoop<T extends SimState = SimState> {
  private dt: number;
  private stepFn: StepFunction<T>;
  private renderFn: (t: number, state: T) => void;
  private history: StateHistory<T>;

  private currentState: T;
  private currentTime: number = 0;
  private currentFrameIndex: number = -1;

  private playing: boolean = false;
  private speed: number = 1.0;
  private rafId: number = 0;
  private lastTimestamp: number = 0;
  private accumulator: number = 0;

  private onStateChange?: (t: number, state: T) => void;

  constructor(options: SimLoopOptions<T>) {
    this.dt = options.dt;
    this.stepFn = options.stepFn;
    this.renderFn = options.renderFn;
    this.currentState = { ...options.initialState };
    this.history = new StateHistory<T>(options.historyCapacity ?? 10000);
    this.history.push(0, this.currentState);
    this.currentFrameIndex = 0;

    // Debug hooks for e2e physics validation (Playwright can call these)
    if (typeof window !== 'undefined') {
      (window as any).__SIM_STATE__ = () => ({ t: this.currentTime, ...this.currentState });
      (window as any).__SIM_STEP__ = () => { this.stepForward(); return (window as any).__SIM_STATE__(); };
      (window as any).__SIM_RESET__ = () => this.reset();
      (window as any).__SIM_DT__ = this.dt;
    }
  }

  setOnStateChange(cb: (t: number, state: T) => void): void {
    this.onStateChange = cb;
  }

  getState(): T {
    return { ...this.currentState };
  }

  getTime(): number {
    return this.currentTime;
  }

  getHistory(): StateHistory<T> {
    return this.history;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getSpeed(): number {
    return this.speed;
  }

  setSpeed(s: number): void {
    this.speed = Math.max(0.1, Math.min(5, s));
  }

  play(): void {
    if (this.playing) return;
    this.playing = true;
    this.lastTimestamp = 0;
    this.accumulator = 0;
    this.rafId = requestAnimationFrame((ts) => this.tick(ts));
  }

  pause(): void {
    this.playing = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
  }

  toggle(): void {
    if (this.playing) this.pause();
    else this.play();
  }

  stepForward(): void {
    this.advanceOneStep();
    this.renderFn(this.currentTime, this.currentState);
    this.onStateChange?.(this.currentTime, this.currentState);
  }

  stepBackward(): void {
    if (this.currentFrameIndex <= 0) return;
    this.currentFrameIndex--;
    const entry = this.history.getAt(this.currentFrameIndex);
    if (entry) {
      this.currentTime = entry.t;
      this.currentState = { ...entry.state };
      this.renderFn(this.currentTime, this.currentState);
      this.onStateChange?.(this.currentTime, this.currentState);
    }
  }

  jumpTo(t: number): void {
    const entry = this.history.findClosest(t);
    if (entry) {
      this.currentTime = entry.t;
      this.currentState = { ...entry.state };
      // find the index
      for (let i = 0; i < this.history.length; i++) {
        if (this.history.getAt(i)!.t === entry.t) {
          this.currentFrameIndex = i;
          break;
        }
      }
      this.renderFn(this.currentTime, this.currentState);
      this.onStateChange?.(this.currentTime, this.currentState);
    }
  }

  reset(newState?: T): void {
    this.pause();
    this.currentState = newState ? { ...newState } : { ...this.currentState };
    this.currentTime = 0;
    this.history.clear();
    this.history.push(0, this.currentState);
    this.currentFrameIndex = 0;
    this.accumulator = 0;
    this.renderFn(this.currentTime, this.currentState);
    this.onStateChange?.(this.currentTime, this.currentState);
  }

  updateStepFn(fn: StepFunction<T>): void {
    this.stepFn = fn;
  }

  private advanceOneStep(): void {
    // If we're in the middle of history, truncate future
    if (this.currentFrameIndex < this.history.length - 1) {
      this.history.truncateAfter(this.currentFrameIndex);
    }
    this.currentState = this.stepFn(this.currentTime, this.dt, this.currentState);
    this.currentTime += this.dt;
    this.history.push(this.currentTime, this.currentState);
    this.currentFrameIndex = this.history.length - 1;
  }

  private tick(timestamp: number): void {
    if (!this.playing) return;

    if (this.lastTimestamp === 0) {
      this.lastTimestamp = timestamp;
    }

    const elapsed = ((timestamp - this.lastTimestamp) / 1000) * this.speed;
    this.lastTimestamp = timestamp;
    this.accumulator += elapsed;

    // Fixed timestep with accumulator
    let stepped = false;
    while (this.accumulator >= this.dt) {
      this.advanceOneStep();
      this.accumulator -= this.dt;
      stepped = true;
    }

    if (stepped) {
      this.renderFn(this.currentTime, this.currentState);
      this.onStateChange?.(this.currentTime, this.currentState);
    }

    this.rafId = requestAnimationFrame((ts) => this.tick(ts));
  }
}
