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

const INCOMING_COLOR  = 'rgba(251, 191, 36, 0.85)';  // amber, incoming
const REFLECTED_COLOR = 'rgba(251, 191, 36, 0.80)';  // amber, reflected
const PHOTON_GLOW     = '#FBBF24';                     // amber photon
const GUIDE_COLOR     = 'rgba(59, 130, 246, 0.28)';   // blue, construction guide

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
    ctx.lineWidth = 2.4;
    ctx.setLineDash([]);
    ctx.stroke();

    // Reflected ray (dashed)
    ctx.beginPath();
    ctx.moveTo(ox1, oy1);
    ctx.lineTo(ox2, oy2);
    ctx.strokeStyle = REFLECTED_COLOR;
    ctx.lineWidth = 2.4;
    ctx.setLineDash([7, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Hit point dot
    const [hx, hy] = viewport.toCanvas(ray.hitPoint[0], ray.hitPoint[1]);
    ctx.beginPath();
    ctx.arc(hx, hy, 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = entityColor + 'AA';
    ctx.fill();

    if (ray.inGuideFocus) {
      const [gx, gy] = viewport.toCanvas(ray.inGuideFocus[0], ray.inGuideFocus[1]);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(gx, gy);
      ctx.strokeStyle = GUIDE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (ray.outGuideFocus) {
      const [gx, gy] = viewport.toCanvas(ray.outGuideFocus[0], ray.outGuideFocus[1]);
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(gx, gy);
      ctx.strokeStyle = GUIDE_COLOR;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
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
    ctx.arc(px, py, 11, 0, 2 * Math.PI);
    ctx.fillStyle = PHOTON_GLOW + '44';
    ctx.fill();

    // Inner glow
    ctx.beginPath();
    ctx.arc(px, py, 7, 0, 2 * Math.PI);
    ctx.fillStyle = PHOTON_GLOW + '88';
    ctx.fill();

    // Core dot
    ctx.beginPath();
    ctx.arc(px, py, 4.2, 0, 2 * Math.PI);
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
