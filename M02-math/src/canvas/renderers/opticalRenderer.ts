/**
 * Renders optical property visualization on the static canvas layer.
 *
 * - Static rays: lines showing light paths (incoming + reflected)
 * - Photon dots: animated glowing dots traveling along ray paths
 */

import type { Viewport } from '@/canvas/Viewport';
import type { OpticalRay } from '@/engine/opticalEngine';
import type { Photon } from '@/editor/store/opticalStore';

// ─── Ray colors ──────────────────────────────────────────────────────────────

const INCOMING_COLOR  = 'rgba(251, 191, 36, 0.55)';  // amber, incoming (boosted)
const REFLECTED_COLOR = 'rgba(251, 191, 36, 0.45)';  // amber, reflected
const PHOTON_GLOW     = '#FBBF24';                     // amber photon

// ─── Static ray paths ────────────────────────────────────────────────────────

export function renderOpticalRays(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  rays: OpticalRay[],
  entityColor: string,
): void {
  ctx.save();

  for (const ray of rays) {
    const [ix1, iy1] = viewport.toCanvas(ray.inStart[0], ray.inStart[1]);
    const [ix2, iy2] = viewport.toCanvas(ray.inEnd[0], ray.inEnd[1]);
    const [ox1, oy1] = viewport.toCanvas(ray.outStart[0], ray.outStart[1]);
    const [ox2, oy2] = viewport.toCanvas(ray.outEnd[0], ray.outEnd[1]);

    // Incoming ray (solid)
    ctx.beginPath();
    ctx.moveTo(ix1, iy1);
    ctx.lineTo(ix2, iy2);
    ctx.strokeStyle = INCOMING_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.stroke();

    // Reflected ray (dashed)
    ctx.beginPath();
    ctx.moveTo(ox1, oy1);
    ctx.lineTo(ox2, oy2);
    ctx.strokeStyle = REFLECTED_COLOR;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hit point dot
    const [hx, hy] = viewport.toCanvas(ray.hitPoint[0], ray.hitPoint[1]);
    ctx.beginPath();
    ctx.arc(hx, hy, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = entityColor + 'AA';
    ctx.fill();
  }

  ctx.restore();
}

// ─── Animated photon dots ────────────────────────────────────────────────────

export function renderPhotons(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  photons: Photon[],
): void {
  if (photons.length === 0) return;

  ctx.save();

  for (const photon of photons) {
    const [px, py] = viewport.toCanvas(photon.x, photon.y);

    // Outer glow
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, 2 * Math.PI);
    ctx.fillStyle = PHOTON_GLOW + '33';
    ctx.fill();

    // Inner glow
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, 2 * Math.PI);
    ctx.fillStyle = PHOTON_GLOW + '66';
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(px, py, 3, 0, 2 * Math.PI);
    ctx.fillStyle = PHOTON_GLOW;
    ctx.fill();
  }

  ctx.restore();
}

// ─── Combined render call ────────────────────────────────────────────────────

export function renderOpticalDemo(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  rays: OpticalRay[],
  photons: Photon[],
  entityColor: string,
): void {
  renderOpticalRays(ctx, viewport, rays, entityColor);
  renderPhotons(ctx, viewport, photons);
}
