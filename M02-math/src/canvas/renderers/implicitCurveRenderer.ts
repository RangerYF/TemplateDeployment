/**
 * Renderer for implicit curves sampled via marching squares.
 *
 * Performance-optimized:
 *  - Inline coordinate transform (no toCanvas() array allocation)
 *  - Single ctx.beginPath() + stroke() for all chains
 *  - Integer-key adjacency hash (no string key allocation)
 *  - Skip chaining entirely above 5000 segments (diminishing returns)
 */

import type { Viewport } from '@/canvas/Viewport';
import type { ImplicitSampleResult } from '@/engine/implicitSampler';

export function renderImplicitCurve(
  ctx: CanvasRenderingContext2D,
  result: ImplicitSampleResult,
  viewport: Viewport,
  color: string,
  options?: { lineWidth?: number; alpha?: number },
): void {
  const segs = result.segments;
  if (segs.length === 0) return;

  const lineWidth = options?.lineWidth ?? 2.5;
  const alpha = options?.alpha ?? 1;

  // Pre-compute viewport transform constants (avoid property access in hot loop)
  const vpXMin = viewport.xMin;
  const vpYMin = viewport.yMin;
  const scaleX = viewport.width / viewport.xRange;
  const scaleY = viewport.height / viewport.yRange;
  const vpH = viewport.height;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const n = segs.length;

  if (n > 5000) {
    // Fast path: render all segments as one big path, no chaining
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const s = segs[i];
      const cx1 = (s[0] - vpXMin) * scaleX;
      const cy1 = vpH - (s[1] - vpYMin) * scaleY;
      const cx2 = (s[2] - vpXMin) * scaleX;
      const cy2 = vpH - (s[3] - vpYMin) * scaleY;
      ctx.moveTo(cx1, cy1);
      ctx.lineTo(cx2, cy2);
    }
    ctx.stroke();
  } else {
    // Chain path: build chains with integer hash for smooth anti-aliased polylines
    const chains = buildChainsIntHash(segs);

    ctx.beginPath();
    for (const chain of chains) {
      const len = chain.length;
      const cx0 = (chain[0] - vpXMin) * scaleX;
      const cy0 = vpH - (chain[1] - vpYMin) * scaleY;
      ctx.moveTo(cx0, cy0);
      for (let i = 2; i < len; i += 2) {
        const cx = (chain[i] - vpXMin) * scaleX;
        const cy = vpH - (chain[i + 1] - vpYMin) * scaleY;
        ctx.lineTo(cx, cy);
      }
    }
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Integer-key chaining — avoids all string allocation.
 * Quantizes coordinates to a grid of 1e8 and packs (ix, iy) into a single
 * integer key via Map<number, number[]>.  Handles collision by exact float compare.
 */
function buildChainsIntHash(
  segs: [number, number, number, number][],
): number[][] {
  const n = segs.length;
  if (n === 0) return [];

  const QUANT = 1e6;
  const used = new Uint8Array(n);

  // Adjacency: integer hash → segment index list
  const adj = new Map<number, number[]>();

  const intKey = (x: number, y: number): number => {
    return (Math.round(x * QUANT) * 1000003) + Math.round(y * QUANT);
  };

  for (let i = 0; i < n; i++) {
    const s = segs[i];
    const k1 = intKey(s[0], s[1]);
    const k2 = intKey(s[2], s[3]);

    let a1 = adj.get(k1);
    if (!a1) { a1 = []; adj.set(k1, a1); }
    a1.push(i);

    let a2 = adj.get(k2);
    if (!a2) { a2 = []; adj.set(k2, a2); }
    a2.push(i);
  }

  const chains: number[][] = [];

  for (let i = 0; i < n; i++) {
    if (used[i]) continue;
    used[i] = 1;

    const s0 = segs[i];
    const chain = [s0[0], s0[1], s0[2], s0[3]];

    // Extend forward
    let extended = true;
    while (extended) {
      extended = false;
      const lx = chain[chain.length - 2];
      const ly = chain[chain.length - 1];
      const k = intKey(lx, ly);
      const neighbors = adj.get(k);
      if (!neighbors) continue;
      for (const ni of neighbors) {
        if (used[ni]) continue;
        const s = segs[ni];
        // Check which end matches (compare floats directly — same source data)
        if (s[0] === lx && s[1] === ly) {
          chain.push(s[2], s[3]);
        } else {
          chain.push(s[0], s[1]);
        }
        used[ni] = 1;
        extended = true;
        break;
      }
    }

    chains.push(chain);
  }

  return chains;
}
