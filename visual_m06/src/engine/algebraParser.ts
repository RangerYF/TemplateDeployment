import { evalExact } from './exactMath';

export type ParsedEquation =
  | { kind: 'line'; slope: number; intercept: number }
  | { kind: 'verticalLine'; x: number }
  | { kind: 'circle'; cx: number; cy: number; r: number }
  | { kind: 'point'; x: number; y: number }
  | null;

export function parseEquation(input: string): ParsedEquation {
  const s = input.trim().replace(/\s+/g, '');
  if (!s) return null;

  // (x, y) 点
  const pointMatch = s.match(/^\(([^,]+),([^)]+)\)$/);
  if (pointMatch) {
    const x = evalExact(pointMatch[1]);
    const y = evalExact(pointMatch[2]);
    if (!isNaN(x) && !isNaN(y)) return { kind: 'point', x, y };
  }

  // x = c 竖直线
  const vertMatch = s.match(/^x=(.+)$/i);
  if (vertMatch && !s.includes('y')) {
    const x = evalExact(vertMatch[1]);
    if (!isNaN(x)) return { kind: 'verticalLine', x };
  }

  // (x-a)²+(y-b)²=r² 或 (x+a)²+(y+b)²=r² 圆方程
  const circleNorm = s.replace(/²/g, '^2');
  const circleMatch = circleNorm.match(
    /^\(x([+-][^)]*)\)\^2\+\(y([+-][^)]*)\)\^2=(.+)$/i,
  );
  if (circleMatch) {
    const cx = -evalExact(circleMatch[1]);
    const cy = -evalExact(circleMatch[2]);
    const r2 = evalExact(circleMatch[3]);
    if (!isNaN(cx) && !isNaN(cy) && !isNaN(r2) && r2 > 0) {
      return { kind: 'circle', cx, cy, r: Math.sqrt(r2) };
    }
  }

  // x²+y²=r² 圆心在原点
  const circleOriginMatch = circleNorm.match(/^x\^2\+y\^2=(.+)$/i);
  if (circleOriginMatch) {
    const r2 = evalExact(circleOriginMatch[1]);
    if (!isNaN(r2) && r2 > 0) {
      return { kind: 'circle', cx: 0, cy: 0, r: Math.sqrt(r2) };
    }
  }

  // y = expr(x) 直线/函数
  const lineMatch = s.match(/^y=(.+)$/i);
  if (lineMatch) {
    const expr = lineMatch[1];
    const atX0 = evalWithX(expr, 0);
    const atX1 = evalWithX(expr, 1);
    if (!isNaN(atX0) && !isNaN(atX1)) {
      const slope = atX1 - atX0;
      const intercept = atX0;
      return { kind: 'line', slope, intercept };
    }
  }

  return null;
}

function evalWithX(expr: string, xVal: number): number {
  let s = expr;
  s = s.replace(/(\d)x/g, '$1*x');
  s = s.replace(/x/gi, `(${xVal})`);
  return evalExact(s);
}
