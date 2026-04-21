/**
 * Marching squares algorithm for implicit curves f(x,y) = 0.
 *
 * Performance-optimized:
 *  - Reuses grid buffer across frames (no allocation if grid size unchanged)
 *  - Inline edge interpolation (no function call per cell)
 *  - Pre-allocated segment buffer with reuse
 *  - NaN check via self-inequality (fastest path)
 */

export interface ImplicitSampleResult {
  segments: [number, number, number, number][];
}

// ─── Reusable buffers (survive across frames) ────────────────────────────────

let _valBuf: Float64Array | null = null;
let _valBufSize = 0;
let _segBuf: Float64Array | null = null;
let _segBufSize = 0;

// ─── Marching squares edge table ─────────────────────────────────────────────

// Packed: each entry is [e1a, e1b, e2a, e2b] or shorter
const CASE_EDGES: Int8Array[] = (() => {
  const C: (number[] | null)[] = [
    null, [3,0], [0,1], [3,1], [1,2], null, [0,2], [3,2],
    [2,3], [2,0], null, [2,1], [1,3], [1,0], [0,3], null,
  ];
  return C.map((c) => c ? new Int8Array(c) : new Int8Array(0));
})();

// ─── Public API ──────────────────────────────────────────────────────────────

export function sampleImplicitCurve(
  evaluator: (x: number, y: number) => number,
  xMin: number, xMax: number,
  yMin: number, yMax: number,
  gridSize = 200,
): ImplicitSampleResult {
  const cols = gridSize;
  const rows = gridSize;
  const dx = (xMax - xMin) / cols;
  const dy = (yMax - yMin) / rows;
  const stride = cols + 1;
  const valLen = stride * (rows + 1);

  // Reuse grid buffer if size matches
  if (!_valBuf || _valBufSize < valLen) {
    _valBuf = new Float64Array(valLen);
    _valBufSize = valLen;
  }
  const values = _valBuf;

  // Evaluate grid
  for (let j = 0; j <= rows; j++) {
    const y = yMin + j * dy;
    const rowOff = j * stride;
    for (let i = 0; i <= cols; i++) {
      values[rowOff + i] = evaluator(xMin + i * dx, y);
    }
  }

  // Reuse segment buffer
  const maxSegs = cols * rows * 2;
  const segBufLen = maxSegs * 4;
  if (!_segBuf || _segBufSize < segBufLen) {
    _segBuf = new Float64Array(segBufLen);
    _segBufSize = segBufLen;
  }
  const segBuf = _segBuf;
  let segCount = 0;

  for (let j = 0; j < rows; j++) {
    const rowOff = j * stride;
    const nextRowOff = (j + 1) * stride;
    const y0 = yMin + j * dy;
    const y1 = y0 + dy;

    for (let i = 0; i < cols; i++) {
      const fTL = values[rowOff + i];
      const fTR = values[rowOff + i + 1];
      const fBR = values[nextRowOff + i + 1];
      const fBL = values[nextRowOff + i];

      if (fTL !== fTL || fTR !== fTR || fBR !== fBR || fBL !== fBL) continue;

      const caseIdx =
        (fTL > 0 ? 1 : 0) |
        (fTR > 0 ? 2 : 0) |
        (fBR > 0 ? 4 : 0) |
        (fBL > 0 ? 8 : 0);

      if (caseIdx === 0 || caseIdx === 15) continue;

      const x0 = xMin + i * dx;
      const x1 = x0 + dx;

      // Inline edge interpolation
      const dTT = fTR - fTL;
      const ex0 = Math.abs(dTT) < 1e-12 ? (x0 + x1) * 0.5 : x0 + (x1 - x0) * (-fTL / dTT);
      const dRR = fBR - fTR;
      const ey1 = Math.abs(dRR) < 1e-12 ? (y0 + y1) * 0.5 : y0 + (y1 - y0) * (-fTR / dRR);
      const dBB = fBR - fBL;
      const ex2 = Math.abs(dBB) < 1e-12 ? (x0 + x1) * 0.5 : x0 + (x1 - x0) * (-fBL / dBB);
      const dLL = fBL - fTL;
      const ey3 = Math.abs(dLL) < 1e-12 ? (y0 + y1) * 0.5 : y0 + (y1 - y0) * (-fTL / dLL);

      // Edge points: 0=(ex0,y0) 1=(x1,ey1) 2=(ex2,y1) 3=(x0,ey3)
      const epx0 = ex0, epy0 = y0;
      const epx1 = x1,  epy1 = ey1;
      const epx2 = ex2, epy2 = y1;
      const epx3 = x0,  epy3 = ey3;

      if (caseIdx === 5 || caseIdx === 10) {
        const fCenter = evaluator((x0 + x1) * 0.5, (y0 + y1) * 0.5);
        let e1a: number, e1b: number, e2a: number, e2b: number;
        if (caseIdx === 5) {
          if (fCenter > 0) { e1a = 3; e1b = 2; e2a = 0; e2b = 1; }
          else              { e1a = 3; e1b = 0; e2a = 1; e2b = 2; }
        } else {
          if (fCenter > 0) { e1a = 0; e1b = 3; e2a = 1; e2b = 2; }
          else              { e1a = 0; e1b = 1; e2a = 2; e2b = 3; }
        }
        emit(e1a, e1b);
        emit(e2a, e2b);
        continue;
      }

      const edges = CASE_EDGES[caseIdx];
      if (edges.length >= 2) emit(edges[0], edges[1]);
      if (edges.length >= 4) emit(edges[2], edges[3]);

      function emit(ea: number, eb: number): void {
        const off = segCount * 4;
        segBuf[off]     = ea === 0 ? epx0 : ea === 1 ? epx1 : ea === 2 ? epx2 : epx3;
        segBuf[off + 1] = ea === 0 ? epy0 : ea === 1 ? epy1 : ea === 2 ? epy2 : epy3;
        segBuf[off + 2] = eb === 0 ? epx0 : eb === 1 ? epx1 : eb === 2 ? epx2 : epx3;
        segBuf[off + 3] = eb === 0 ? epy0 : eb === 1 ? epy1 : eb === 2 ? epy2 : epy3;
        segCount++;
      }
    }
  }

  const segments: [number, number, number, number][] = new Array(segCount);
  for (let i = 0; i < segCount; i++) {
    const off = i * 4;
    segments[i] = [segBuf[off], segBuf[off + 1], segBuf[off + 2], segBuf[off + 3]];
  }

  return { segments };
}
