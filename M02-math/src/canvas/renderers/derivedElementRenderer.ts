import type { Viewport } from '@/canvas/Viewport';
import type { ConicEntity } from '@/types';
import { COLORS } from '@/styles/colors';

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** Compute canvas coords for a line y = k·x + b at a given math x. */
function lineAtEdge(
  k: number, b: number, mathX: number, vp: Viewport,
): [number, number] {
  return vp.toCanvas(mathX, k * mathX + b);
}

/**
 * Format a number for canvas labels: integer → no decimal; otherwise 2dp.
 * `−` uses Unicode minus for visual consistency.
 */
function fmtCoord(n: number): string {
  const s = Number.isInteger(n) ? String(n) : n.toFixed(2);
  return s.startsWith('-') ? '\u2212' + s.slice(1) : s;
}

/**
 * Draw a small text label with a semi-transparent white pill background.
 * Anchored by its left edge at (cx, cy) in canvas pixels.
 */
function drawAnnotationLabel(
  ctx:   CanvasRenderingContext2D,
  text:  string,
  cx:    number,
  cy:    number,
  color: string,
  font = '12px monospace',
): void {
  ctx.font = font;
  const tw  = ctx.measureText(text).width;
  const pad = 3;
  const bh  = 13;

  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.beginPath();
  ctx.roundRect(cx - pad, cy - bh + 2, tw + pad * 2, bh, 2);
  ctx.fill();

  ctx.fillStyle    = color;
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(text, cx, cy);
}

// ─── Focal points ─────────────────────────────────────────────────────────────

/**
 * Draw filled amber dots at each focus of the entity, plus optional F₁/F₂ labels.
 *
 * | Entity type | Foci rendered |
 * |-------------|---------------|
 * | ellipse     | F₁, F₂       |
 * | hyperbola   | F₁, F₂       |
 * | parabola    | F             |
 * | circle      | (none)        |
 */
function renderFoci(
  ctx:        CanvasRenderingContext2D,
  entity:     ConicEntity,
  viewport:   Viewport,
  showLabels: boolean,
): void {
  ctx.save();

  const drawFocus = (mathX: number, mathY: number, label: string) => {
    const [cx, cy] = viewport.toCanvas(mathX, mathY);

    // Glow halo for projector visibility
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.focusPoint + '30';
    ctx.fill();

    // Solid focus dot (diameter 12px)
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.focusPoint;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    if (showLabels) {
      ctx.fillStyle    = COLORS.focusPoint;
      ctx.font         = '700 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
      ctx.textAlign    = 'left';
      ctx.textBaseline = 'bottom';
      ctx.fillText(label, cx + 9, cy - 5);
    }
  };

  switch (entity.type) {
    case 'ellipse':
    case 'hyperbola': {
      const [[f1x, f1y], [f2x, f2y]] = entity.derived.foci;
      drawFocus(f1x, f1y, 'F\u2081');
      drawFocus(f2x, f2y, 'F\u2082');
      break;
    }
    case 'parabola': {
      const [fx, fy] = entity.derived.focus;
      drawFocus(fx, fy, 'F');
      break;
    }
    case 'circle':
      break; // circles have no foci
  }

  ctx.restore();
}

// ─── Directrices ──────────────────────────────────────────────────────────────

/**
 * Draw blue dashed directrix lines with inline equation labels.
 *
 * Vertical directrix  (ellipse/hyperbola/horizontal parabola): x = d
 * Horizontal directrix (vertical parabola):                     y = d
 *
 * Labels are anchored at the top (vertical) or right (horizontal) of the
 * viewport so they are always visible regardless of zoom level.
 */
function renderDirectrices(
  ctx:      CanvasRenderingContext2D,
  entity:   ConicEntity,
  viewport: Viewport,
): void {
  const { xMin, xMax, yMin, yMax, width, height } = viewport;

  ctx.save();
  ctx.strokeStyle = COLORS.directrix;
  ctx.lineWidth   = 2;
  ctx.setLineDash([8, 5]);

  const drawVerticalDirectrix = (mathX: number) => {
    if (mathX < xMin || mathX > xMax) return;
    const [canvasX] = viewport.toCanvas(mathX, 0);
    ctx.beginPath();
    ctx.moveTo(canvasX, 0);
    ctx.lineTo(canvasX, height);
    ctx.stroke();

    // Equation label near top of viewport
    ctx.setLineDash([]);
    drawAnnotationLabel(ctx,
      `x = ${fmtCoord(mathX)}`,
      canvasX + 4, 13,
      COLORS.directrix,
    );
    ctx.setLineDash([8, 5]);
  };

  const drawHorizontalDirectrix = (mathY: number) => {
    if (mathY < yMin || mathY > yMax) return;
    const [, canvasY] = viewport.toCanvas(0, mathY);
    ctx.beginPath();
    ctx.moveTo(0,     canvasY);
    ctx.lineTo(width, canvasY);
    ctx.stroke();

    // Equation label near right edge of viewport
    ctx.setLineDash([]);
    const label = `y = ${fmtCoord(mathY)}`;
    ctx.font = '500 11px -apple-system,"Helvetica Neue",Arial,sans-serif';
    const tw  = ctx.measureText(label).width;
    drawAnnotationLabel(ctx, label, width - tw - 20, canvasY - 2, COLORS.directrix);
    ctx.setLineDash([8, 5]);
  };

  switch (entity.type) {
    case 'ellipse':
    case 'hyperbola': {
      const [d1, d2] = entity.derived.directrices;
      drawVerticalDirectrix(d1);
      drawVerticalDirectrix(d2);
      break;
    }
    case 'parabola':
      if (entity.derived.orientation === 'v') {
        drawHorizontalDirectrix(entity.derived.directrix);
      } else {
        drawVerticalDirectrix(entity.derived.directrix);
      }
      break;
    case 'circle':
      break; // circles have no directrix
  }

  ctx.restore();
}

// ─── Asymptotes ───────────────────────────────────────────────────────────────

/**
 * Draw pink dashed asymptote lines for hyperbolas, with equation labels.
 *
 * Labels appear near the right viewport edge for positive-slope lines,
 * and near the left edge for negative-slope lines, to avoid overlap.
 * No-op for all other entity types.
 */
function renderAsymptotes(
  ctx:      CanvasRenderingContext2D,
  entity:   ConicEntity,
  viewport: Viewport,
): void {
  if (entity.type !== 'hyperbola') return;

  ctx.save();
  ctx.strokeStyle = COLORS.asymptote;
  ctx.lineWidth   = 2;
  ctx.setLineDash([8, 5]);

  const { a, b, cx: hcx, cy: hcy } = entity.params;

  for (const { k, b: lineB } of entity.derived.asymptotes) {
    // Draw the line
    const [x1c, y1c] = lineAtEdge(k, lineB, viewport.xMin, viewport);
    const [x2c, y2c] = lineAtEdge(k, lineB, viewport.xMax, viewport);
    ctx.beginPath();
    ctx.moveTo(x1c, y1c);
    ctx.lineTo(x2c, y2c);
    ctx.stroke();

    // Build label: y = ±(b/a)x  [+ offset if hcx/hcy ≠ 0]
    const slopeSign = k >= 0 ? '' : '\u2212';
    const slopeAbs  = Math.abs(k);
    let label: string;
    if (hcx === 0 && hcy === 0) {
      // Centred at origin — simple form
      const rStr = (a === b)
        ? `${slopeSign}x`
        : `${slopeSign}(${fmtCoord(b)}/${fmtCoord(a)})x`;
      label = `y = ${rStr}`;
    } else {
      // General form y = k(x − cx) + cy
      const slopeStr = `${slopeSign}${fmtCoord(slopeAbs)}`;
      const interceptStr = hcy >= 0
        ? ` + ${fmtCoord(hcy)}`
        : ` \u2212 ${fmtCoord(Math.abs(hcy))}`;
      label = `y = ${slopeStr}(x\u2212${fmtCoord(hcx)})${interceptStr}`;
    }

    // Position: right edge for k≥0 (label at top-right), left edge for k<0
    ctx.setLineDash([]);
    let lx: number;
    let ly: number;
    if (k >= 0) {
      [lx, ly] = [x2c - 4, y2c - 4];
      ctx.font = '500 11px -apple-system,"Helvetica Neue",Arial,sans-serif';
      lx -= ctx.measureText(label).width + 4;
    } else {
      [lx, ly] = [x2c + 4, y2c - 4];
    }
    drawAnnotationLabel(ctx, label, lx, ly, COLORS.asymptote);
    ctx.setLineDash([8, 5]);
  }

  ctx.restore();
}

// ─── Vertices ─────────────────────────────────────────────────────────────────

/** Green dot colour for vertex points. */
const VERTEX_COLOR = '#22C55E';

/**
 * Draw green solid dots at the geometric vertices of the conic, labelled V₁…Vₙ.
 *
 * | Entity type | Vertices rendered                         |
 * |-------------|-------------------------------------------|
 * | ellipse     | (cx±a, cy) and (cx, cy±b) — 4 points     |
 * | hyperbola   | (cx±a, cy) — 2 real transverse vertices   |
 * | parabola    | (cx, cy)   — 1 vertex at the turning point|
 * | circle      | (none — no conventional discrete vertex)  |
 */
function renderVertices(
  ctx:        CanvasRenderingContext2D,
  entity:     ConicEntity,
  viewport:   Viewport,
  showLabels: boolean,
): void {
  ctx.save();

  const drawVertex = (mathX: number, mathY: number, label: string) => {
    const [px, py] = viewport.toCanvas(mathX, mathY);

    // Outer glow ring
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fillStyle = VERTEX_COLOR + '28';
    ctx.fill();

    // Solid dot
    ctx.beginPath();
    ctx.arc(px, py, 5, 0, Math.PI * 2);
    ctx.fillStyle   = VERTEX_COLOR;
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    if (showLabels) {
      drawAnnotationLabel(ctx, label, px + 8, py - 5, VERTEX_COLOR, '12px monospace');
    }
  };

  switch (entity.type) {
    case 'ellipse': {
      const { a, b, cx, cy } = entity.params;
      drawVertex(cx + a, cy,     'V\u2081');
      drawVertex(cx - a, cy,     'V\u2082');
      drawVertex(cx,     cy + b, 'V\u2083');
      drawVertex(cx,     cy - b, 'V\u2084');
      break;
    }
    case 'hyperbola': {
      const { a, cx, cy } = entity.params;
      drawVertex(cx + a, cy, 'V\u2081');
      drawVertex(cx - a, cy, 'V\u2082');
      break;
    }
    case 'parabola': {
      const { cx, cy } = entity.params;
      drawVertex(cx, cy, 'V');
      break;
    }
    case 'circle':
      break; // no conventional discrete vertex for a circle
  }

  ctx.restore();
}

// ─── Axes of symmetry ─────────────────────────────────────────────────────────

/** Colour for the conic's own axes of symmetry. */
const AXIS_COLOR = 'rgba(156, 163, 175, 0.60)';   // Tailwind gray-400 at 60%

/**
 * Draw the conic's own axes of symmetry as grey dashed lines through (cx, cy).
 *
 * | Entity type       | Axes drawn                                   |
 * |-------------------|----------------------------------------------|
 * | ellipse           | horizontal y = cy  +  vertical x = cx        |
 * | hyperbola         | horizontal y = cy  +  vertical x = cx        |
 * | parabola h (y²=…) | horizontal y = cy  (the focal axis)          |
 * | parabola v (x²=…) | vertical   x = cx  (the focal axis)          |
 * | circle            | horizontal y = cy  +  vertical x = cx        |
 */
function renderAxesOfSymmetry(
  ctx:      CanvasRenderingContext2D,
  entity:   ConicEntity,
  viewport: Viewport,
): void {
  const { width, height } = viewport;

  ctx.save();
  ctx.strokeStyle = AXIS_COLOR;
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 6]);

  const drawHAxis = (mathY: number) => {
    const [, cy] = viewport.toCanvas(0, mathY);
    ctx.beginPath();
    ctx.moveTo(0,     cy);
    ctx.lineTo(width, cy);
    ctx.stroke();
  };

  const drawVAxis = (mathX: number) => {
    const [cx] = viewport.toCanvas(mathX, 0);
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, height);
    ctx.stroke();
  };

  switch (entity.type) {
    case 'ellipse':
    case 'hyperbola':
    case 'circle': {
      const { cx, cy } = entity.params;
      drawHAxis(cy);
      drawVAxis(cx);
      break;
    }
    case 'parabola': {
      const { cx, cy, orientation = 'h' } = entity.params;
      if (orientation === 'v') {
        drawVAxis(cx);
      } else {
        drawHAxis(cy);
      }
      break;
    }
  }

  ctx.restore();
}

// ─── Equation label ───────────────────────────────────────────────────────────

/**
 * Format the standard-form equation of a conic as a single-line string.
 * Uses Unicode superscript ² (\u00B2) and minus sign (\u2212) for readability.
 */
function formatEquation(entity: ConicEntity): string {
  const n = (v: number) => {
    const abs = Math.abs(v);
    return abs % 1 === 0 ? `${abs}` : abs.toFixed(2);
  };

  switch (entity.type) {
    case 'ellipse': {
      const { a, b } = entity.params;
      return `x\u00B2/${n(a * a)} + y\u00B2/${n(b * b)} = 1`;
    }
    case 'hyperbola': {
      const { a, b } = entity.params;
      return `x\u00B2/${n(a * a)} \u2212 y\u00B2/${n(b * b)} = 1`;
    }
    case 'parabola': {
      const { p, orientation = 'h' } = entity.params;
      if (orientation === 'v') return `x\u00B2 = ${n(2 * p)}y`;
      return `y\u00B2 = ${n(2 * p)}x`;
    }
    case 'circle': {
      const { r } = entity.params;
      return `x\u00B2 + y\u00B2 = ${n(r * r)}`;
    }
  }
}

/**
 * Render the conic equation above the entity's topmost vertex.
 *
 * Anchor math coordinates:
 *   ellipse / hyperbola → (cx,  cy + b)
 *   parabola            → (cx,  cy + p)
 *   circle              → (cx,  cy + r)
 */
function renderEquationLabel(
  ctx:      CanvasRenderingContext2D,
  entity:   ConicEntity,
  viewport: Viewport,
): void {
  const FONT = '600 13px -apple-system,"Helvetica Neue",Arial,sans-serif';
  const PAD  = 5;
  const LIFT = 12;

  let anchorX: number;
  let anchorY: number;

  switch (entity.type) {
    case 'ellipse':
      anchorX = entity.params.cx; anchorY = entity.params.cy + entity.params.b; break;
    case 'hyperbola':
      anchorX = entity.params.cx; anchorY = entity.params.cy + entity.params.b; break;
    case 'parabola':
      anchorX = entity.params.cx; anchorY = entity.params.cy + entity.params.p; break;
    case 'circle':
      anchorX = entity.params.cx; anchorY = entity.params.cy + entity.params.r; break;
  }

  const [cx, cy] = viewport.toCanvas(anchorX, anchorY);
  const label    = formatEquation(entity);

  ctx.save();
  ctx.font = FONT;
  const textW = ctx.measureText(label).width;
  const boxW  = textW + PAD * 2;
  const boxH  = 16;
  const bx    = cx - boxW / 2;
  const by    = cy - boxH - LIFT;

  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  ctx.roundRect(bx, by, boxW, boxH, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle    = '#374151';
  ctx.textAlign    = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, bx + PAD, by + boxH / 2);

  ctx.restore();
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

/**
 * Draw all derived geometric elements of a conic entity in a single call.
 *
 * Rendering order (back → front):
 *   axes of symmetry → asymptotes → directrices → equation label
 *   → vertices → foci  (dots always on top of lines)
 *
 * @example
 * ```typescript
 * for (const entity of entities) {
 *   // ... render curve ...
 *   renderEntityDerivedElements(ctx, entity, vp, displayOptions);
 * }
 * ```
 */
export function renderEntityDerivedElements(
  ctx:      CanvasRenderingContext2D,
  entity:   ConicEntity,
  viewport: Viewport,
  options: {
    showFoci:           boolean;
    showDirectrices:    boolean;
    showAsymptotes:     boolean;
    showLabels:         boolean;
    showVertices:       boolean;
    showAxesOfSymmetry: boolean;
  },
): void {
  // Background lines (drawn first — lowest z-order)
  if (options.showAxesOfSymmetry) renderAxesOfSymmetry(ctx, entity, viewport);
  if (options.showAsymptotes)     renderAsymptotes    (ctx, entity, viewport);
  if (options.showDirectrices)    renderDirectrices   (ctx, entity, viewport);

  // Equation label below dots
  if (options.showLabels)         renderEquationLabel (ctx, entity, viewport);

  // Dots on top of all lines
  if (options.showVertices)       renderVertices      (ctx, entity, viewport, options.showLabels);
  if (options.showFoci)           renderFoci          (ctx, entity, viewport, options.showLabels);
}
