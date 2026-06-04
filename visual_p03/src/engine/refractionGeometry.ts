import type { Point, BoundaryHit, FiberGeometry, AngleMark, RaySegment } from '@/data/refractionData';

// ── Constants & basic math ──────────────────────────────────────────

export const deg = (r: number): number => r * 180 / Math.PI;
export const rad = (d: number): number => d * Math.PI / 180;
export const fmt = (v: number | null | undefined, digits: number = 2): string =>
  typeof v === 'number' && Number.isFinite(v) ? v.toFixed(digits) : '—';
export const clamp = (v: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, v));

export const EPS = 1e-6;

// ── Vector math ─────────────────────────────────────────────────────

export function add(a: Point, b: Point): Point { return { x: a.x + b.x, y: a.y + b.y }; }
export function sub(a: Point, b: Point): Point { return { x: a.x - b.x, y: a.y - b.y }; }
export function mul(a: Point, s: number): Point { return { x: a.x * s, y: a.y * s }; }
export function dot(a: Point, b: Point): number { return a.x * b.x + a.y * b.y; }
export function len(a: Point): number { return Math.hypot(a.x, a.y); }
export function norm(a: Point): Point {
  const l = len(a) || 1;
  return { x: a.x / l, y: a.y / l };
}
export function pointFromAngle(angleDeg: number): Point {
  const a = rad(angleDeg);
  return { x: Math.cos(a), y: Math.sin(a) };
}
export function angleFromVector(v: Point): number {
  return deg(Math.atan2(v.y, v.x));
}
export function angleAgainstNormal(dir: Point, normal: Point): number {
  return deg(Math.acos(clamp(Math.abs(dot(norm(dir), norm(normal))), -1, 1)));
}

// ── Ray operations ──────────────────────────────────────────────────

export function reflect(dir: Point, normal: Point): Point {
  const oriented = dot(dir, normal) > 0 ? mul(normal, -1) : normal;
  return norm(sub(dir, mul(oriented, 2 * dot(dir, oriented))));
}

export function refract(dir: Point, normal: Point, n1: number, n2: number): { dir: Point | null; tir: boolean } {
  let n = dot(dir, normal) > 0 ? mul(normal, -1) : normal;
  const cosI = -dot(n, dir);
  const eta = n1 / n2;
  const k = 1 - eta * eta * (1 - cosI * cosI);
  if (k < 0) return { dir: null, tir: true };
  return { dir: norm(add(mul(dir, eta), mul(n, eta * cosI - Math.sqrt(k)))), tir: false };
}

export function extendRay(start: Point, dir: Point, length: number = 1400): RaySegment {
  return { from: start, to: add(start, mul(norm(dir), length)), kind: 'incident' };
}

// ── Intersection functions ──────────────────────────────────────────

export function intersectRayHorizontal(start: Point, dir: Point, y: number, xMin: number, xMax: number): Point | null {
  if (Math.abs(dir.y) < 1e-6) return null;
  const t = (y - start.y) / dir.y;
  if (t <= 1e-6) return null;
  const x = start.x + dir.x * t;
  return x >= xMin && x <= xMax ? { x, y } : null;
}

export function intersectRayVertical(start: Point, dir: Point, x: number, yMin: number, yMax: number): Point | null {
  if (Math.abs(dir.x) < 1e-6) return null;
  const t = (x - start.x) / dir.x;
  if (t <= 1e-6) return null;
  const y = start.y + dir.y * t;
  return y >= yMin && y <= yMax ? { x, y } : null;
}

export function intersectRayCircle(start: Point, dir: Point, center: Point, radius: number, predicate?: (p: Point) => boolean): Point | null {
  const d = norm(dir);
  const f = sub(start, center);
  const a = dot(d, d);
  const b = 2 * dot(f, d);
  const c = dot(f, f) - radius * radius;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const roots = [(-b - s) / (2 * a), (-b + s) / (2 * a)].filter((t) => t > 1e-6).sort((m, n) => m - n);
  for (const t of roots) {
    const p = add(start, mul(d, t));
    if (!predicate || predicate(p)) return p;
  }
  return null;
}

// ── Containment tests ───────────────────────────────────────────────

export function pointInRect(point: Point, left: number, right: number, top: number, bottom: number): boolean {
  return point.x > left && point.x < right && point.y > top && point.y < bottom;
}

export function pointInHalfDisk(point: Point, center: Point, radius: number): boolean {
  return point.y >= center.y && len(sub(point, center)) < radius;
}

export function pointInFiberCore(point: Point, geom: FiberGeometry): boolean {
  return point.x >= geom.left && point.x <= geom.right && Math.abs(point.y - fiberCenterY(geom, point.x)) <= geom.coreHalf;
}

// ── Boundary hit helpers ────────────────────────────────────────────

export function uniqueBoundaryHits(hits: BoundaryHit[]): BoundaryHit[] {
  const out: BoundaryHit[] = [];
  hits.forEach((hit) => {
    const exists = out.some((item) => len(sub(item.point, hit.point)) < 0.8);
    if (!exists) out.push(hit);
  });
  return out.sort((a, b) => a.distance - b.distance);
}

export function intersectRayRectBoundary(start: Point, dir: Point, left: number, right: number, top: number, bottom: number): BoundaryHit | null {
  const begin = add(start, mul(norm(dir), 0.001));
  const candidates: BoundaryHit[] = [];
  const topHit = intersectRayHorizontal(begin, dir, top, left, right);
  if (topHit) candidates.push({ point: topHit, normal: { x: 0, y: -1 }, edge: 'top', distance: len(sub(topHit, start)) });
  const bottomHit = intersectRayHorizontal(begin, dir, bottom, left, right);
  if (bottomHit) candidates.push({ point: bottomHit, normal: { x: 0, y: 1 }, edge: 'bottom', distance: len(sub(bottomHit, start)) });
  const leftHit = intersectRayVertical(begin, dir, left, top, bottom);
  if (leftHit) candidates.push({ point: leftHit, normal: { x: -1, y: 0 }, edge: 'left', distance: len(sub(leftHit, start)) });
  const rightHit = intersectRayVertical(begin, dir, right, top, bottom);
  if (rightHit) candidates.push({ point: rightHit, normal: { x: 1, y: 0 }, edge: 'right', distance: len(sub(rightHit, start)) });
  const deduped = uniqueBoundaryHits(candidates);
  return deduped[0] || null;
}

export function intersectRayHalfBoundary(start: Point, dir: Point, center: Point, radius: number): BoundaryHit | null {
  const begin = add(start, mul(norm(dir), 0.001));
  const candidates: BoundaryHit[] = [];
  const flat = intersectRayHorizontal(begin, dir, center.y, center.x - radius, center.x + radius);
  if (flat) candidates.push({ point: flat, normal: { x: 0, y: -1 }, edge: 'top', distance: len(sub(flat, start)) });
  const arc = intersectRayCircle(begin, dir, center, radius, (p) => p.y >= center.y - 0.5);
  if (arc) candidates.push({ point: arc, normal: norm(sub(arc, center)), edge: 'arc', distance: len(sub(arc, start)) });
  const deduped = uniqueBoundaryHits(candidates);
  return deduped[0] || null;
}

// ── Angle mark helper ───────────────────────────────────────────────

export function makeArcMark(at: Point, normal: Point, rayDir: Point, label: string, radius: number): AngleMark {
  const n = dot(rayDir, normal) >= 0 ? normal : mul(normal, -1);
  return {
    at,
    normalAngleDeg: angleFromVector(n),
    rayAngleDeg: angleFromVector(rayDir),
    label,
    radius,
  };
}

// ── Fiber geometry ──────────────────────────────────────────────────

export function makeFiberGeometry(settings: { elementCenterX?: number; elementCenterY?: number; fiberBendRadiusCm?: number; fiberModel?: string }): FiberGeometry {
  const center: Point = { x: settings.elementCenterX ?? 560, y: settings.elementCenterY ?? 290 };
  const width = 520;
  const bendRadius = settings.fiberBendRadiusCm ?? 14;
  const bendT = clamp((30 - bendRadius) / 28, 0, 1);
  return {
    center,
    left: center.x - width / 2,
    right: center.x + width / 2,
    width,
    coreHalf: 18,
    claddingHalf: 28,
    amplitude: (settings.fiberModel ?? 'straight') === 'bent' ? bendT * 78 : 0,
  };
}

export function fiberCenterY(geom: FiberGeometry, x: number): number {
  const t = clamp((x - geom.left) / geom.width, 0, 1);
  return geom.center.y + geom.amplitude * Math.sin(t * Math.PI * 2);
}

export function fiberSlopeAt(geom: FiberGeometry, x: number): number {
  const t = clamp((x - geom.left) / geom.width, 0, 1);
  return geom.amplitude * (Math.PI * 2 / geom.width) * Math.cos(t * Math.PI * 2);
}

export function fiberBoundaryY(geom: FiberGeometry, x: number, edge: 'top' | 'bottom', half: number = geom.coreHalf): number {
  return fiberCenterY(geom, x) + (edge === 'top' ? -half : half);
}

export function fiberBoundaryNormal(geom: FiberGeometry, x: number, edge: 'top' | 'bottom'): Point {
  const slope = fiberSlopeAt(geom, x);
  return edge === 'top' ? norm({ x: slope, y: -1 }) : norm({ x: -slope, y: 1 });
}

export function buildFiberBoundaryPath(geom: FiberGeometry, edge: 'top' | 'bottom', half: number, steps: number = 72): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = geom.left + geom.width * (i / steps);
    const y = fiberBoundaryY(geom, x, edge, half);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(' ');
}

export function buildFiberBandPath(geom: FiberGeometry, half: number, steps: number = 72): string {
  const points: Point[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = geom.left + geom.width * (i / steps);
    points.push({ x, y: fiberBoundaryY(geom, x, 'top', half) });
  }
  for (let i = steps; i >= 0; i -= 1) {
    const x = geom.left + geom.width * (i / steps);
    points.push({ x, y: fiberBoundaryY(geom, x, 'bottom', half) });
  }
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ') + ' Z';
}

export function buildFiberCenterPath(geom: FiberGeometry, steps: number = 72): string {
  const parts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const x = geom.left + geom.width * (i / steps);
    const y = fiberCenterY(geom, x);
    parts.push(`${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  return parts.join(' ');
}

export function findFiberBoundaryHit(pos: Point, dir: Point, geom: FiberGeometry, edge: 'top' | 'bottom'): BoundaryHit | null {
  const d = norm(dir);
  const step = 3;
  const maxT = 1500;
  const signed = (point: Point): number => point.y - fiberBoundaryY(geom, point.x, edge);
  const isPastBoundary = (value: number): boolean => edge === 'top' ? value <= 0 : value >= 0;
  let prevT = 0.5;
  let prev = add(pos, mul(d, prevT));
  let prevValue = signed(prev);

  for (let t = prevT + step; t <= maxT; t += step) {
    const next = add(pos, mul(d, t));
    if (next.x < geom.left - 2 || next.x > geom.right + 2) {
      if (next.x > geom.right + 2) break;
      prevT = t;
      prev = next;
      prevValue = signed(prev);
      continue;
    }
    const nextValue = signed(next);
    if (!isPastBoundary(prevValue) && isPastBoundary(nextValue)) {
      let lo = prevT;
      let hi = t;
      for (let i = 0; i < 16; i += 1) {
        const mid = (lo + hi) / 2;
        const midPoint = add(pos, mul(d, mid));
        if (isPastBoundary(signed(midPoint))) hi = mid;
        else lo = mid;
      }
      const hitPoint = add(pos, mul(d, hi));
      return {
        point: hitPoint,
        normal: fiberBoundaryNormal(geom, hitPoint.x, edge),
        edge,
        distance: len(sub(hitPoint, pos)),
      };
    }
    prevT = t;
    prev = next;
    prevValue = nextValue;
  }
  return null;
}
