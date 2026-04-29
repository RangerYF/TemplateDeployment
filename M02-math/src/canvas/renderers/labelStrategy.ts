/**
 * labelStrategy — Unified label placement & collision avoidance
 *
 * Provides a per-frame LabelPlacer that tracks placed labels and can:
 *  - Find the best direction (8 candidates) for a new label
 *  - Skip labels that would still overlap after all candidates are tried
 *  - Respect canvas boundaries (flip to opposite side near edges)
 *  - Support priority levels: high-priority labels always placed first
 *
 * Usage per render frame:
 *   const placer = new LabelPlacer(canvasWidth, canvasHeight);
 *   placer.place({ ... });  // returns null if no valid position
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface LabelRequest {
  /** Text to render */
  text: string;
  /** Anchor point (pixel) — the element the label describes */
  anchorX: number;
  anchorY: number;
  /** Approximate text width in px (use ctx.measureText) */
  textWidth: number;
  /** Text height in px (typically fontSize * 1.2) */
  textHeight: number;
  /** Base offset from anchor in px (default 10) */
  offset?: number;
  /** Preferred direction index 0-7 (see DIRECTIONS); -1 = auto */
  preferredDir?: number;
  /** Priority 0 = highest; labels with lower priority placed first.
   *  If omitted, defaults to 1. */
  priority?: number;
}

export interface PlacedLabel {
  x: number;
  y: number;
  hw: number;   // half-width
  hh: number;   // half-height
  text: string;
  dirIndex: number;
}

export type PlaceResult = {
  x: number;
  y: number;
  textAlign: CanvasTextAlign;
  textBaseline: CanvasTextBaseline;
} | null;

// ─── Direction table ────────────────────────────────────────────────────────
//  0: right      1: top-right  2: top        3: top-left
//  4: left       5: bot-left   6: bottom     7: bot-right

const DIRECTIONS: { dx: number; dy: number; align: CanvasTextAlign; baseline: CanvasTextBaseline }[] = [
  { dx:  1, dy:  0, align: 'left',   baseline: 'middle'     },  // right
  { dx:  1, dy: -1, align: 'left',   baseline: 'bottom'     },  // top-right
  { dx:  0, dy: -1, align: 'center', baseline: 'bottom'     },  // top
  { dx: -1, dy: -1, align: 'right',  baseline: 'bottom'     },  // top-left
  { dx: -1, dy:  0, align: 'right',  baseline: 'middle'     },  // left
  { dx: -1, dy:  1, align: 'right',  baseline: 'top'        },  // bot-left
  { dx:  0, dy:  1, align: 'center', baseline: 'top'        },  // bottom
  { dx:  1, dy:  1, align: 'left',   baseline: 'top'        },  // bot-right
];

// ─── Tuning constants (exported for external override) ──────────────────────

/** Extra gap between any two placed labels (px) */
export const LABEL_GAP = 4;

/** Margin from canvas edge (px) */
export const EDGE_MARGIN = 8;

// ─── LabelPlacer ────────────────────────────────────────────────────────────

export class LabelPlacer {
  private placed: PlacedLabel[] = [];
  private canvasW: number;
  private canvasH: number;

  constructor(canvasWidth: number, canvasHeight: number) {
    this.canvasW = canvasWidth;
    this.canvasH = canvasHeight;
  }

  /** Try to place a label. Returns position+alignment or null if impossible. */
  place(req: LabelRequest): PlaceResult {
    const offset = req.offset ?? 10;
    const hw = req.textWidth / 2;
    const hh = req.textHeight / 2;

    // Build candidate order: preferred direction first, then rotate through others
    const preferred = req.preferredDir ?? 0;
    const order: number[] = [];
    if (preferred >= 0 && preferred < 8) order.push(preferred);
    for (let i = 0; i < 8; i++) {
      if (i !== preferred) order.push(i);
    }

    for (const di of order) {
      const dir = DIRECTIONS[di];
      const cx = req.anchorX + dir.dx * (offset + hw);
      const cy = req.anchorY + dir.dy * (offset + hh);

      // Boundary check
      if (cx - hw < EDGE_MARGIN || cx + hw > this.canvasW - EDGE_MARGIN) continue;
      if (cy - hh < EDGE_MARGIN || cy + hh > this.canvasH - EDGE_MARGIN) continue;

      // Collision check
      if (this.wouldOverlap(cx, cy, hw, hh)) continue;

      // Accept
      this.placed.push({ x: cx, y: cy, hw, hh, text: req.text, dirIndex: di });
      return { x: cx, y: cy, textAlign: dir.align, textBaseline: dir.baseline };
    }

    return null; // all candidates overlap
  }

  /** Register an externally-placed rectangle (e.g. a point glyph). */
  reserve(cx: number, cy: number, hw: number, hh: number): void {
    this.placed.push({ x: cx, y: cy, hw, hh, text: '', dirIndex: -1 });
  }

  /** Check if a rectangle overlaps any placed label. */
  wouldOverlap(cx: number, cy: number, hw: number, hh: number): boolean {
    for (const p of this.placed) {
      if (
        Math.abs(cx - p.x) < hw + p.hw + LABEL_GAP &&
        Math.abs(cy - p.y) < hh + p.hh + LABEL_GAP
      ) {
        return true;
      }
    }
    return false;
  }

  /** Clear all placed labels (call at start of each frame). */
  reset(): void {
    this.placed.length = 0;
  }

  /** Current placed labels (read-only). */
  get labels(): readonly PlacedLabel[] {
    return this.placed;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Choose preferred direction index for a label near the unit circle,
 * based on the angle (radians) of the anchor point from the origin.
 * Returns the "outward" direction (away from center).
 */
export function preferredDirForAngle(angleRad: number): number {
  // Normalize to [0, 2π)
  const a = ((angleRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  // Map angle to nearest direction index
  // 0 = right (angle ~0), 1 = top-right (~π/4), etc.
  // Canvas Y is flipped, so top = negative y
  const sector = Math.round(a / (Math.PI / 4)) % 8;
  // Mapping: math sector → direction index (accounting for Y-flip)
  //  math 0 (right) → dir 0 (right)
  //  math 1 (π/4, Q1 upper) → dir 1 (top-right, canvas)
  //  math 2 (π/2, up) → dir 2 (top)
  //  etc.
  return sector;
}

/**
 * Pick direction index that avoids a specific zone.
 * `avoidAngle` is the canvas-space angle (radians) of the element to avoid.
 */
export function avoidDirection(avoidAngleRad: number): number {
  // Pick the opposite direction
  const sector = Math.round(avoidAngleRad / (Math.PI / 4)) % 8;
  return (sector + 4) % 8;
}
