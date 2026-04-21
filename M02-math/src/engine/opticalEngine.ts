/**
 * opticalEngine.ts — Conic optical property computation.
 *
 * Ellipse reflection: light from F₁ → P reflects → F₂
 * Parabola reflection: light parallel to axis → P reflects → F
 *
 * Uses the gradient of the implicit equation as the surface normal:
 *   ∇F = (∂F/∂x, ∂F/∂y) at point P on the curve.
 *   Reflection: R = I - 2(I·N)N  where N = normalized outward normal.
 */

import type { ConicEntity, EllipseEntity, ParabolaEntity } from '@/types';
import { useOpticalStore } from '@/editor/store/opticalStore';
import type { Photon } from '@/editor/store/opticalStore';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface OpticalRay {
  /** Incoming ray: start → point on curve */
  inStart: [number, number];
  inEnd: [number, number];
  /** Reflected ray: point on curve → target */
  outStart: [number, number];
  outEnd: [number, number];
  /** Point on the conic where reflection occurs */
  hitPoint: [number, number];
}

// ─── Normal computation via implicit gradient ────────────────────────────────

function implicitGradient(
  entity: ConicEntity,
  x: number, y: number,
): [number, number] {
  switch (entity.type) {
    case 'ellipse': {
      const { a, b, cx, cy } = entity.params;
      const X = x - cx, Y = y - cy;
      return [2 * X / (a * a), 2 * Y / (b * b)];
    }
    case 'hyperbola': {
      const { a, b, cx, cy } = entity.params;
      const X = x - cx, Y = y - cy;
      return [2 * X / (a * a), -2 * Y / (b * b)];
    }
    case 'parabola': {
      const { p, cx, cy, orientation = 'h' } = entity.params;
      const X = x - cx, Y = y - cy;
      if (orientation === 'v') {
        return [2 * X, -2 * p];
      }
      return [-2 * p, 2 * Y];
    }
    case 'circle': {
      const { cx, cy } = entity.params;
      return [2 * (x - cx), 2 * (y - cy)];
    }
  }
}

// ─── Ray computation ─────────────────────────────────────────────────────────

/**
 * Compute optical rays for an ellipse: F₁ → P → F₂ reflection.
 */
export function computeEllipseRays(entity: EllipseEntity, rayCount: number): OpticalRay[] {
  const { a, b, cx, cy } = entity.params;
  const [[f1x, f1y], [f2x, f2y]] = entity.derived.foci;
  const rays: OpticalRay[] = [];

  for (let i = 0; i < rayCount; i++) {
    // Distribute points evenly around the ellipse
    const theta = (i / rayCount) * 2 * Math.PI;
    const px = cx + a * Math.cos(theta);
    const py = cy + b * Math.sin(theta);

    // Incoming ray: F₁ → P
    const inDx = px - f1x;
    const inDy = py - f1y;
    const inLen = Math.sqrt(inDx * inDx + inDy * inDy);
    if (inLen < 1e-8) continue;

    // For an ellipse, the reflection property guarantees F₁→P reflects to F₂.
    // We use the known F₂ position directly (mathematically equivalent to
    // computing R = I − 2(I·N)N and extending to F₂).
    rays.push({
      inStart: [f1x, f1y],
      inEnd: [px, py],
      outStart: [px, py],
      outEnd: [f2x, f2y],
      hitPoint: [px, py],
    });
  }

  return rays;
}

/**
 * Compute optical rays for a parabola: parallel to axis → P → F reflection.
 */
export function computeParabolaRays(entity: ParabolaEntity, rayCount: number): OpticalRay[] {
  const { p, cx, cy, orientation = 'h' } = entity.params;
  const [fx, fy] = entity.derived.focus;
  const rays: OpticalRay[] = [];

  for (let i = 0; i < rayCount; i++) {
    // Distribute points along the parabola
    const t = (i / (rayCount - 1) - 0.5) * 8; // parameter range [-4, 4]

    let px: number, py: number;
    let inStartX: number, inStartY: number;

    if (orientation === 'v') {
      // x² = 2p(y-cy): parametric x = cx + t, y = cy + t²/(2p)
      px = cx + t;
      py = cy + (t * t) / (2 * p);
      // Incoming ray: parallel to y-axis, from above
      inStartX = px;
      inStartY = py + 8; // extend upward
    } else {
      // y² = 2p(x-cx): parametric y = cy + t, x = cx + t²/(2p)
      px = cx + (t * t) / (2 * p);
      py = cy + t;
      // Incoming ray: parallel to x-axis, from the right
      inStartX = px + 8; // extend to the right
      inStartY = py;
    }

    // Normal at P
    const [gx, gy] = implicitGradient(entity, px, py);
    const gLen = Math.sqrt(gx * gx + gy * gy);
    if (gLen < 1e-10) continue;

    rays.push({
      inStart: [inStartX, inStartY],
      inEnd: [px, py],
      outStart: [px, py],
      outEnd: [fx, fy],
      hitPoint: [px, py],
    });
  }

  return rays;
}

/**
 * Compute optical rays for the active conic entity.
 * Returns null if the entity type doesn't support optical properties.
 */
export function computeOpticalRays(
  entity: ConicEntity,
  rayCount: number,
): OpticalRay[] | null {
  switch (entity.type) {
    case 'ellipse':
      return computeEllipseRays(entity, rayCount);
    case 'parabola':
      return computeParabolaRays(entity, rayCount);
    default:
      return null; // Circles and hyperbolas: not applicable for standard reflection demo
  }
}

// ─── Photon animation ────────────────────────────────────────────────────────

/**
 * Start photon animation along computed optical rays.
 * Returns a cancel function.
 */
export function startPhotonAnimation(
  rays: OpticalRay[],
  duration = 3000,
  onComplete?: () => void,
): () => void {
  const store = useOpticalStore.getState();
  store.setAnimating(true);

  let rafId: number;
  let stopped = false;
  let frameCount = 0;

  // Mutable start time for looping
  const options = { startTime: performance.now() };

  function loopTick(now: number) {
    if (stopped) return;

    const elapsed = now - options.startTime;
    const rawT = Math.min(elapsed / duration, 1);

    const photons: Photon[] = [];
    for (let i = 0; i < rays.length; i++) {
      const ray = rays[i];
      const stagger = (i / rays.length) * 0.3;
      const localT = Math.max(0, Math.min((rawT - stagger) / (1 - 0.3), 1));
      if (localT <= 0) continue;

      let x: number, y: number;
      let segment: 0 | 1;

      if (localT <= 0.5) {
        const segT = localT / 0.5;
        x = ray.inStart[0] + (ray.inEnd[0] - ray.inStart[0]) * segT;
        y = ray.inStart[1] + (ray.inEnd[1] - ray.inStart[1]) * segT;
        segment = 0;
      } else {
        const segT = (localT - 0.5) / 0.5;
        x = ray.outStart[0] + (ray.outEnd[0] - ray.outStart[0]) * segT;
        y = ray.outStart[1] + (ray.outEnd[1] - ray.outStart[1]) * segT;
        segment = 1;
      }

      photons.push({ x, y, t: localT, segment, rayIndex: i });
    }

    const optStore = useOpticalStore.getState();
    optStore.setPhotons(photons);

    frameCount++;
    if (frameCount % 2 === 0) {
      optStore.incrementRenderTick();
    }

    if (rawT < 1) {
      rafId = requestAnimationFrame(loopTick);
    } else {
      // Loop
      options.startTime = performance.now();
      frameCount = 0;
      rafId = requestAnimationFrame(loopTick);
    }
  }

  rafId = requestAnimationFrame(loopTick);

  return () => {
    stopped = true;
    cancelAnimationFrame(rafId);
    const optStore = useOpticalStore.getState();
    optStore.setAnimating(false);
    optStore.setPhotons([]);
    onComplete?.();
  };
}
