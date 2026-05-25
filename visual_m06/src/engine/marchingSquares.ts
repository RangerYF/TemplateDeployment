export interface MarchingSquaresOptions {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  resolution: number;
}

const DEFAULTS: MarchingSquaresOptions = {
  xMin: -8, xMax: 8,
  yMin: -6, yMax: 6,
  resolution: 0.05,
};

type Seg = [number, number, number, number];

export function marchingSquares(
  f: (x: number, y: number) => number,
  opts?: Partial<MarchingSquaresOptions>,
): Seg[] {
  const o = { ...DEFAULTS, ...opts };
  const cols = Math.ceil((o.xMax - o.xMin) / o.resolution);
  const rows = Math.ceil((o.yMax - o.yMin) / o.resolution);
  const dx = (o.xMax - o.xMin) / cols;
  const dy = (o.yMax - o.yMin) / rows;

  const grid: number[][] = [];
  for (let j = 0; j <= rows; j++) {
    const row: number[] = [];
    const y = o.yMin + j * dy;
    for (let i = 0; i <= cols; i++) {
      row.push(f(o.xMin + i * dx, y));
    }
    grid.push(row);
  }

  const segs: Seg[] = [];

  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x0 = o.xMin + i * dx;
      const y0 = o.yMin + j * dy;
      const v0 = grid[j][i];
      const v1 = grid[j][i + 1];
      const v2 = grid[j + 1][i + 1];
      const v3 = grid[j + 1][i];

      if (!isFinite(v0) || !isFinite(v1) || !isFinite(v2) || !isFinite(v3)) continue;

      const idx =
        (v0 > 0 ? 8 : 0) |
        (v1 > 0 ? 4 : 0) |
        (v2 > 0 ? 2 : 0) |
        (v3 > 0 ? 1 : 0);

      if (idx === 0 || idx === 15) continue;

      const lerp = (a: number, b: number, va: number, vb: number) => {
        if (Math.abs(va - vb) < 1e-12) return (a + b) / 2;
        return a + (b - a) * (-va / (vb - va));
      };

      // Edge midpoints: top(0-1), right(1-2), bottom(3-2), left(0-3)
      const top: [number, number] = [lerp(x0, x0 + dx, v0, v1), y0];
      const right: [number, number] = [x0 + dx, lerp(y0, y0 + dy, v1, v2)];
      const bottom: [number, number] = [lerp(x0, x0 + dx, v3, v2), y0 + dy];
      const left: [number, number] = [x0, lerp(y0, y0 + dy, v0, v3)];

      const addSeg = (a: [number, number], b: [number, number]) => {
        segs.push([a[0], a[1], b[0], b[1]]);
      };

      switch (idx) {
        case 1: case 14: addSeg(bottom, left); break;
        case 2: case 13: addSeg(right, bottom); break;
        case 3: case 12: addSeg(right, left); break;
        case 4: case 11: addSeg(top, right); break;
        case 5: {
          const center = (v0 + v1 + v2 + v3) / 4;
          if (center > 0) { addSeg(top, right); addSeg(bottom, left); }
          else { addSeg(top, left); addSeg(bottom, right); }
          break;
        }
        case 6: case 9: addSeg(top, bottom); break;
        case 7: case 8: addSeg(top, left); break;
        case 10: {
          const center = (v0 + v1 + v2 + v3) / 4;
          if (center > 0) { addSeg(top, left); addSeg(bottom, right); }
          else { addSeg(top, right); addSeg(bottom, left); }
          break;
        }
      }
    }
  }

  return segs;
}
