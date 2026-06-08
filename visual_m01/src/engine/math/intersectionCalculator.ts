import type { Vec3, PolyhedronResult } from '@/engine/types';
import { sub, dot, cross, vecLen } from '@/editor/crossSectionHelper';

const EPS = 1e-8;

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

export function planeFromPoints(points: Vec3[]): { normal: Vec3; d: number } | null {
  if (points.length < 3) return null;
  for (let i = 0; i < points.length - 2; i++) {
    const v1 = sub(points[i + 1], points[i]);
    const v2 = sub(points[i + 2], points[i]);
    const n = cross(v1, v2);
    const len = vecLen(n);
    if (len > EPS) {
      const normal = scale(n, 1 / len);
      return { normal, d: dot(normal, points[i]) };
    }
  }
  return null;
}

export function lineLineIntersection(
  p1: Vec3, d1: Vec3, p2: Vec3, d2: Vec3,
): { point: Vec3; t1: number; t2: number } | null {
  const w = sub(p1, p2);
  const a = dot(d1, d1);
  const b = dot(d1, d2);
  const c = dot(d2, d2);
  const dw1 = dot(d1, w);
  const dw2 = dot(d2, w);
  const denom = a * c - b * b;

  if (Math.abs(denom) < EPS) return null;

  const t1 = (b * dw2 - c * dw1) / denom;
  const t2 = (a * dw2 - b * dw1) / denom;

  const point1 = add(p1, scale(d1, t1));
  const point2 = add(p2, scale(d2, t2));
  const dist = vecLen(sub(point1, point2));

  if (dist > EPS) return null;

  return { point: point1, t1, t2 };
}

export function linePlaneIntersection(
  lineStart: Vec3, lineDir: Vec3, normal: Vec3, d: number,
): { point: Vec3; t: number } | null {
  const denom = dot(lineDir, normal);
  if (Math.abs(denom) < EPS) return null;

  const t = (d - dot(normal, lineStart)) / denom;
  return { point: add(lineStart, scale(lineDir, t)), t };
}

export function planePlaneIntersectionLine(
  n1: Vec3, d1: number, n2: Vec3, d2: number,
): { point: Vec3; direction: Vec3 } | null {
  const direction = cross(n1, n2);
  const len = vecLen(direction);
  if (len < EPS) return null;

  const dir = scale(direction, 1 / len);

  const absX = Math.abs(dir[0]);
  const absY = Math.abs(dir[1]);
  const absZ = Math.abs(dir[2]);

  let point: Vec3;
  if (absX >= absY && absX >= absZ) {
    const det = n1[1] * n2[2] - n1[2] * n2[1];
    point = [0, (d1 * n2[2] - d2 * n1[2]) / det, (n1[1] * d2 - n2[1] * d1) / det];
  } else if (absY >= absX && absY >= absZ) {
    const det = n1[0] * n2[2] - n1[2] * n2[0];
    point = [(d1 * n2[2] - d2 * n1[2]) / det, 0, (n1[0] * d2 - n2[0] * d1) / det];
  } else {
    const det = n1[0] * n2[1] - n1[1] * n2[0];
    point = [(d1 * n2[1] - d2 * n1[1]) / det, (n1[0] * d2 - n2[0] * d1) / det, 0];
  }

  return { point, direction: dir };
}

export function clipLineToPolyhedron(
  linePoint: Vec3, lineDir: Vec3, result: PolyhedronResult,
): [Vec3, Vec3] | null {
  const vertices = result.vertices.map((v) => v.position);
  const centroid: Vec3 = [0, 0, 0];
  for (const v of vertices) {
    centroid[0] += v[0]; centroid[1] += v[1]; centroid[2] += v[2];
  }
  centroid[0] /= vertices.length;
  centroid[1] /= vertices.length;
  centroid[2] /= vertices.length;

  let tEnter = -1e12;
  let tExit = 1e12;

  for (const faceIndices of result.faces) {
    if (faceIndices.length < 3) continue;
    const faceVerts = faceIndices.map((i) => vertices[i]);
    const plane = planeFromPoints(faceVerts);
    if (!plane) continue;

    let { normal } = plane;
    if (dot(normal, sub(centroid, faceVerts[0])) > 0) {
      normal = scale(normal, -1);
    }

    const denom = dot(normal, lineDir);
    const num = dot(normal, sub(faceVerts[0], linePoint));

    if (Math.abs(denom) < EPS) {
      if (num < -EPS) return null;
      continue;
    }

    const t = num / denom;
    if (denom < 0) {
      if (t > tEnter) tEnter = t;
    } else {
      if (t < tExit) tExit = t;
    }
  }

  if (tEnter > tExit + EPS) return null;

  return [
    add(linePoint, scale(lineDir, tEnter)),
    add(linePoint, scale(lineDir, tExit)),
  ];
}
