/**
 * rafAnimation — M04 Phase 6
 *
 * Lightweight RAF-based numeric animation utility.
 * Used by SpecialValuesTable to animate angle jumps on cell click.
 */

export interface AnimationOptions {
  from:       number;
  to:         number;
  duration:   number;           // ms
  easing:     (t: number) => number;
  onUpdate:   (value: number) => void;
  onComplete?: () => void;
}

/** Quadratic ease-out: fast start, slow finish. */
export function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/**
 * Start a RAF animation.
 * Returns a cancel function — call it to stop early (onComplete will NOT fire).
 */
export function startAnimation(options: AnimationOptions): () => void {
  const { from, to, duration, easing, onUpdate, onComplete } = options;

  let startTime: number | null = null;
  let rafId = 0;
  let cancelled = false;

  function tick(now: number) {
    if (cancelled) return;
    if (startTime === null) startTime = now;

    const elapsed = now - startTime;
    const t = Math.min(elapsed / duration, 1);
    onUpdate(from + (to - from) * easing(t));

    if (t < 1) {
      rafId = requestAnimationFrame(tick);
    } else {
      onComplete?.();
    }
  }

  rafId = requestAnimationFrame(tick);

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
  };
}
