// ─── Types ───────────────────────────────────────────────────────────────────

export type EasingFn = (t: number) => number;

export interface AnimationConfig {
  from: number;
  to: number;
  duration: number;
  easing: EasingFn;
  onFrame: (value: number) => void;
  onComplete?: () => void;
}

/** Minimal config used by startMultiAnimation (easing + duration are global). */
export interface MultiAnimConfig {
  from: number;
  to: number;
  onFrame: (value: number) => void;
}

// ─── Easing functions ────────────────────────────────────────────────────────

/** Cubic ease-in-out (smooth start and end). */
export const easeInOut: EasingFn =
  (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

/** Cubic ease-out (natural deceleration — good for snap-back animations). */
export const easeOut: EasingFn =
  (t) => 1 - Math.pow(1 - t, 3);

/** Linear (constant rate). */
export const linear: EasingFn = (t) => t;

/** Cubic ease-in (accelerate). */
export const easeIn: EasingFn = (t) => t * t * t;

/** Damped spring (overshoots then settles). */
export const spring: EasingFn = (t) => {
  const c4 = (2 * Math.PI) / 3;
  return t === 0 ? 0 : t === 1 ? 1
    : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
};

/** Multi-bounce at end. */
export const bounce: EasingFn = (t) => {
  const n1 = 7.5625;
  const d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) { const t2 = t - 1.5 / d1; return n1 * t2 * t2 + 0.75; }
  if (t < 2.5 / d1) { const t2 = t - 2.25 / d1; return n1 * t2 * t2 + 0.9375; }
  const t2 = t - 2.625 / d1;
  return n1 * t2 * t2 + 0.984375;
};

// ─── Easing lookup maps ──────────────────────────────────────────────────────

export type EasingName = 'linear' | 'easeIn' | 'easeInOut' | 'easeOut' | 'spring' | 'bounce';

export const EASING_MAP: Record<EasingName, EasingFn> = {
  linear, easeIn, easeInOut, easeOut, spring, bounce,
};

export const EASING_LABELS: Record<EasingName, string> = {
  linear: '线性', easeIn: '加速', easeInOut: '平滑', easeOut: '减速', spring: '弹簧', bounce: '弹跳',
};

// ─── Single-value animation ───────────────────────────────────────────────────

/**
 * Start a single-value RAF animation.
 * Returns a cancel function — call it to stop the animation at any time.
 */
export function startAnimation(config: AnimationConfig): () => void {
  const startTime = performance.now();
  let rafId: number;

  function tick(now: number) {
    const rawT    = Math.min((now - startTime) / config.duration, 1);
    const easedT  = config.easing(rawT);
    config.onFrame(config.from + (config.to - config.from) * easedT);
    if (rawT < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      config.onComplete?.();
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

// ─── Multi-value parallel animation ──────────────────────────────────────────

/**
 * Animate multiple values in perfect lock-step (all share one RAF loop).
 * Used for viewport resets where all four bounds must interpolate together.
 * Returns a cancel function.
 */
export function startMultiAnimation(
  configs: MultiAnimConfig[],
  easing: EasingFn,
  duration: number,
  onComplete?: () => void,
): () => void {
  const startTime = performance.now();
  let rafId: number;

  function tick(now: number) {
    const rawT   = Math.min((now - startTime) / duration, 1);
    const easedT = easing(rawT);
    configs.forEach((c) => c.onFrame(c.from + (c.to - c.from) * easedT));
    if (rawT < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}

// ─── Controllable multi-value animation (pause / resume / cancel) ────────────

export interface AnimationControl {
  pause: () => void;
  resume: () => void;
  cancel: () => void;
}

/**
 * Like `startMultiAnimation` but returns an `AnimationControl` object
 * with pause/resume/cancel. Pause records elapsed time; resume adjusts
 * the start offset so easing picks up where it left off.
 */
export function startMultiAnimationControlled(
  configs: MultiAnimConfig[],
  easing: EasingFn,
  duration: number,
  onComplete?: () => void,
): AnimationControl {
  let startTime = performance.now();
  let rafId = 0;
  let paused = false;
  let elapsed = 0;
  let cancelled = false;

  function tick(now: number) {
    if (cancelled || paused) return;
    const rawT   = Math.min((now - startTime) / duration, 1);
    const easedT = easing(rawT);
    configs.forEach((c) => c.onFrame(c.from + (c.to - c.from) * easedT));
    if (rawT < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(tick);

  return {
    pause() {
      if (paused || cancelled) return;
      paused = true;
      elapsed = performance.now() - startTime;
      cancelAnimationFrame(rafId);
    },
    resume() {
      if (!paused || cancelled) return;
      paused = false;
      startTime = performance.now() - elapsed;
      rafId = requestAnimationFrame(tick);
    },
    cancel() {
      cancelled = true;
      cancelAnimationFrame(rafId);
    },
  };
}
