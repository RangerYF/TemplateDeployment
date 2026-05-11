import type { SurfaceResult, Vec3 } from './types';

// ─── 多面体棱线遮挡 ───

export function isPolyhedronEdgeHidden(
  vertices: Vec3[],
  faces: number[][],
  vi: number,
  vj: number,
  cameraPos: Vec3,
): boolean {
  const adjacentFaces = findAdjacentFaces(faces, vi, vj);
  if (adjacentFaces.length === 0) return false;

  const centroid = computeCentroid(vertices);

  for (const faceIndices of adjacentFaces) {
    if (isFaceFrontFacing(vertices, faceIndices, cameraPos, centroid)) return false;
  }
  return true;
}

function computeCentroid(vertices: Vec3[]): Vec3 {
  let cx = 0, cy = 0, cz = 0;
  for (const v of vertices) { cx += v[0]; cy += v[1]; cz += v[2]; }
  const n = vertices.length;
  return [cx / n, cy / n, cz / n];
}

function findAdjacentFaces(faces: number[][], vi: number, vj: number): number[][] {
  const result: number[][] = [];
  for (const face of faces) {
    const hasVi = face.includes(vi);
    const hasVj = face.includes(vj);
    if (hasVi && hasVj) result.push(face);
  }
  return result;
}

function isFaceFrontFacing(vertices: Vec3[], face: number[], cameraPos: Vec3, centroid: Vec3): boolean {
  if (face.length < 3) return true;
  const p0 = vertices[face[0]];
  const p1 = vertices[face[1]];
  const p2 = vertices[face[2]];

  const e1x = p1[0] - p0[0], e1y = p1[1] - p0[1], e1z = p1[2] - p0[2];
  const e2x = p2[0] - p0[0], e2y = p2[1] - p0[1], e2z = p2[2] - p0[2];
  let nx = e1y * e2z - e1z * e2y;
  let ny = e1z * e2x - e1x * e2z;
  let nz = e1x * e2y - e1y * e2x;

  // 用面中心→质心方向确保法向量朝外（兼容不同绕序）
  let fcx = 0, fcy = 0, fcz = 0;
  for (const idx of face) { fcx += vertices[idx][0]; fcy += vertices[idx][1]; fcz += vertices[idx][2]; }
  fcx /= face.length; fcy /= face.length; fcz /= face.length;
  const toCx = centroid[0] - fcx, toCy = centroid[1] - fcy, toCz = centroid[2] - fcz;
  if (nx * toCx + ny * toCy + nz * toCz > 0) {
    nx = -nx; ny = -ny; nz = -nz;
  }

  const dx = cameraPos[0] - p0[0];
  const dy = cameraPos[1] - p0[1];
  const dz = cameraPos[2] - p0[2];

  return nx * dx + ny * dy + nz * dz > 0;
}

// ─── 曲面体曲线切分 ───

export interface CurveSplit {
  visibleSegments: Vec3[][];
  hiddenSegments: Vec3[][];
}

export function splitCurveByVisibility(
  points: Vec3[],
  cameraPos: Vec3,
  mode: 'radial' | 'spherical',
  sphereCenter?: Vec3,
): CurveSplit {
  if (points.length < 2) return { visibleSegments: [points], hiddenSegments: [] };

  const isVisible = (p: Vec3): boolean => {
    if (mode === 'radial') {
      return p[0] * cameraPos[0] + p[2] * cameraPos[2] > 0;
    }
    const cx = sphereCenter![0], cy = sphereCenter![1], cz = sphereCenter![2];
    const dx = p[0] - cx, dy = p[1] - cy, dz = p[2] - cz;
    const camDx = cameraPos[0] - cx, camDy = cameraPos[1] - cy, camDz = cameraPos[2] - cz;
    return dx * camDx + dy * camDy + dz * camDz > 0;
  };

  const isClosed = points.length > 2 &&
    Math.abs(points[0][0] - points[points.length - 1][0]) < 1e-6 &&
    Math.abs(points[0][1] - points[points.length - 1][1]) < 1e-6 &&
    Math.abs(points[0][2] - points[points.length - 1][2]) < 1e-6;

  const n = isClosed ? points.length - 1 : points.length;
  const vis: boolean[] = [];
  for (let i = 0; i < n; i++) vis.push(isVisible(points[i]));

  const allSame = vis.every(v => v === vis[0]);
  if (allSame) {
    return vis[0]
      ? { visibleSegments: [points], hiddenSegments: [] }
      : { visibleSegments: [], hiddenSegments: [points] };
  }

  const visibleSegments: Vec3[][] = [];
  const hiddenSegments: Vec3[][] = [];

  let currentSeg: Vec3[] = [points[0]];
  let currentVis = vis[0];

  for (let i = 1; i < n; i++) {
    if (vis[i] !== currentVis) {
      currentSeg.push(points[i]);
      if (currentSeg.length >= 2) {
        (currentVis ? visibleSegments : hiddenSegments).push(currentSeg);
      }
      currentSeg = [points[i]];
      currentVis = vis[i];
    } else {
      currentSeg.push(points[i]);
    }
  }

  if (isClosed) {
    currentSeg.push(points[0]);
    const targetArr = currentVis ? visibleSegments : hiddenSegments;
    const firstArr = vis[0] ? visibleSegments : hiddenSegments;
    if (currentVis === vis[0] && firstArr.length > 0 && firstArr[0] !== currentSeg) {
      firstArr[0] = [...currentSeg, ...firstArr[0].slice(1)];
    } else {
      targetArr.push(currentSeg);
    }
  } else {
    if (currentSeg.length >= 2) {
      (currentVis ? visibleSegments : hiddenSegments).push(currentSeg);
    }
  }

  return { visibleSegments, hiddenSegments };
}

export function splitSurfaceCircleByVisibility(
  points: Vec3[],
  cameraPos: Vec3,
  lineType: string | undefined,
  surface: SurfaceResult | null | undefined,
): CurveSplit {
  if (!surface) {
    return { visibleSegments: [points], hiddenSegments: [] };
  }

  if (surface.geometryType === 'sphere') {
    return splitSphereCurveByVisibility(points, cameraPos, surface.positionOffset);
  }

  const diskNormal = lineType === 'topCircle'
    ? ([0, 1, 0] as Vec3)
    : lineType === 'baseCircle'
      ? ([0, -1, 0] as Vec3)
      : null;

  if (diskNormal && isDiskFacingCamera(points[0], diskNormal, cameraPos)) {
    return { visibleSegments: [points], hiddenSegments: [] };
  }

  return splitPolylineByPredicate(points, (p) => isLateralFacingCamera(p, cameraPos, surface));
}

function splitSphereCurveByVisibility(points: Vec3[], cameraPos: Vec3, center: Vec3): CurveSplit {
  const toCamera = subtract(cameraPos, center);
  return splitPolylineByPredicate(points, (p) => {
    const radial = subtract(p, center);
    return dot(radial, toCamera) > 1e-6;
  });
}

export function splitSurfaceLineByVisibility(
  points: Vec3[],
  cameraPos: Vec3,
  surface: SurfaceResult | null | undefined,
  samplesPerSegment = 8,
): CurveSplit {
  if (points.length < 2) return { visibleSegments: [points], hiddenSegments: [] };
  if (!surface) return { visibleSegments: [points], hiddenSegments: [] };
  if (surface.geometryType === 'sphere') return { visibleSegments: [points], hiddenSegments: [] };

  const sampledPoints = resamplePolyline(points, samplesPerSegment);
  return splitPolylineByPredicate(sampledPoints, (p) => !isPointOccludedBySurface(p, cameraPos, surface));
}

function splitPolylineByPredicate(points: Vec3[], isVisible: (point: Vec3) => boolean): CurveSplit {
  const isClosed = points.length > 2 &&
    Math.abs(points[0][0] - points[points.length - 1][0]) < 1e-6 &&
    Math.abs(points[0][1] - points[points.length - 1][1]) < 1e-6 &&
    Math.abs(points[0][2] - points[points.length - 1][2]) < 1e-6;

  const n = isClosed ? points.length - 1 : points.length;
  const vis: boolean[] = [];
  for (let i = 0; i < n; i++) vis.push(isVisible(points[i]));

  const allSame = vis.every(v => v === vis[0]);
  if (allSame) {
    return vis[0]
      ? { visibleSegments: [points], hiddenSegments: [] }
      : { visibleSegments: [], hiddenSegments: [points] };
  }

  const visibleSegments: Vec3[][] = [];
  const hiddenSegments: Vec3[][] = [];
  let currentSeg: Vec3[] = [points[0]];
  let currentVis = vis[0];

  for (let i = 1; i < n; i++) {
    if (vis[i] !== currentVis) {
      const boundary = findVisibilityBoundary(points[i - 1], points[i], isVisible);
      currentSeg.push(boundary);
      if (currentSeg.length >= 2) {
        (currentVis ? visibleSegments : hiddenSegments).push(currentSeg);
      }
      currentSeg = [boundary, points[i]];
      currentVis = vis[i];
    } else {
      currentSeg.push(points[i]);
    }
  }

  if (isClosed) {
    currentSeg.push(points[0]);
    const targetArr = currentVis ? visibleSegments : hiddenSegments;
    const firstArr = vis[0] ? visibleSegments : hiddenSegments;
    if (currentVis === vis[0] && firstArr.length > 0 && firstArr[0] !== currentSeg) {
      firstArr[0] = [...currentSeg, ...firstArr[0].slice(1)];
    } else {
      targetArr.push(currentSeg);
    }
  } else if (currentSeg.length >= 2) {
    (currentVis ? visibleSegments : hiddenSegments).push(currentSeg);
  }

  return { visibleSegments, hiddenSegments };
}

function isDiskFacingCamera(pointOnDisk: Vec3, normal: Vec3, cameraPos: Vec3): boolean {
  return dot(normal, subtract(cameraPos, pointOnDisk)) > 1e-6;
}

function isLateralFacingCamera(point: Vec3, cameraPos: Vec3, surface: SurfaceResult): boolean {
  const normal = lateralNormalAt(point, surface);
  return dot(normal, subtract(cameraPos, point)) > 1e-6;
}

function lateralNormalAt(point: Vec3, surface: SurfaceResult): Vec3 {
  const radialLen = Math.hypot(point[0], point[2]);
  const cos = radialLen > 1e-8 ? point[0] / radialLen : 1;
  const sin = radialLen > 1e-8 ? point[2] / radialLen : 0;

  if (surface.geometryType === 'cone') {
    const [radius, height] = surface.geometryArgs;
    return normalize([cos, radius / height, sin]);
  }

  if (surface.geometryType === 'truncatedCone') {
    const [topRadius, bottomRadius, height] = surface.geometryArgs;
    return normalize([cos, (bottomRadius - topRadius) / height, sin]);
  }

  return [cos, 0, sin];
}

function isPointOccludedBySurface(point: Vec3, cameraPos: Vec3, surface: SurfaceResult): boolean {
  const hits = surface.geometryType === 'sphere'
    ? intersectSphere(cameraPos, point, surface)
    : intersectConicSurface(cameraPos, point, surface);

  return hits.some((t) => t > 1e-5 && t < 1 - 1e-4);
}

function intersectConicSurface(cameraPos: Vec3, point: Vec3, surface: SurfaceResult): number[] {
  const profile = getConicProfile(surface);
  if (!profile) return [];

  const { bottomRadius, topRadius, height } = profile;
  const dx = point[0] - cameraPos[0];
  const dy = point[1] - cameraPos[1];
  const dz = point[2] - cameraPos[2];
  const hits: number[] = [];

  collectConicLateralHits(cameraPos, [dx, dy, dz], bottomRadius, topRadius, height, hits);
  collectCapHit(cameraPos, [dx, dy, dz], 0, bottomRadius, hits);
  if (topRadius > 1e-8) {
    collectCapHit(cameraPos, [dx, dy, dz], height, topRadius, hits);
  }

  return hits.sort((a, b) => a - b);
}

function getConicProfile(surface: SurfaceResult): { bottomRadius: number; topRadius: number; height: number } | null {
  if (surface.geometryType === 'cone') {
    const [radius, height] = surface.geometryArgs;
    return { bottomRadius: radius, topRadius: 0, height };
  }
  if (surface.geometryType === 'cylinder') {
    const [radius, height] = surface.geometryArgs;
    return { bottomRadius: radius, topRadius: radius, height };
  }
  if (surface.geometryType === 'truncatedCone') {
    const [topRadius, bottomRadius, height] = surface.geometryArgs;
    return { bottomRadius, topRadius, height };
  }
  return null;
}

function collectConicLateralHits(
  origin: Vec3,
  dir: Vec3,
  bottomRadius: number,
  topRadius: number,
  height: number,
  hits: number[],
): void {
  const slope = (topRadius - bottomRadius) / height;
  const rAtOriginY = bottomRadius + slope * origin[1];
  const rSlope = slope * dir[1];

  const a = dir[0] * dir[0] + dir[2] * dir[2] - rSlope * rSlope;
  const b = 2 * (origin[0] * dir[0] + origin[2] * dir[2] - rAtOriginY * rSlope);
  const c = origin[0] * origin[0] + origin[2] * origin[2] - rAtOriginY * rAtOriginY;

  for (const t of solveQuadratic(a, b, c)) {
    const y = origin[1] + dir[1] * t;
    if (t >= 0 && t <= 1 && y >= -1e-6 && y <= height + 1e-6) {
      hits.push(t);
    }
  }
}

function collectCapHit(origin: Vec3, dir: Vec3, y: number, radius: number, hits: number[]): void {
  if (Math.abs(dir[1]) < 1e-10) return;
  const t = (y - origin[1]) / dir[1];
  if (t < 0 || t > 1) return;

  const x = origin[0] + dir[0] * t;
  const z = origin[2] + dir[2] * t;
  if (x * x + z * z <= radius * radius + 1e-6) hits.push(t);
}

function intersectSphere(cameraPos: Vec3, point: Vec3, surface: SurfaceResult): number[] {
  const [radius] = surface.geometryArgs;
  const center = surface.positionOffset;
  const ox = cameraPos[0] - center[0];
  const oy = cameraPos[1] - center[1];
  const oz = cameraPos[2] - center[2];
  const dx = point[0] - cameraPos[0];
  const dy = point[1] - cameraPos[1];
  const dz = point[2] - cameraPos[2];
  return solveQuadratic(
    dx * dx + dy * dy + dz * dz,
    2 * (ox * dx + oy * dy + oz * dz),
    ox * ox + oy * oy + oz * oz - radius * radius,
  ).filter((t) => t >= 0 && t <= 1);
}

function solveQuadratic(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) < 1e-12) return [];
    return [-c / b];
  }

  const discriminant = b * b - 4 * a * c;
  if (discriminant < -1e-10) return [];
  if (Math.abs(discriminant) <= 1e-10) return [-b / (2 * a)];

  const sqrtD = Math.sqrt(Math.max(0, discriminant));
  return [(-b - sqrtD) / (2 * a), (-b + sqrtD) / (2 * a)];
}

function resamplePolyline(points: Vec3[], samplesPerSegment: number): Vec3[] {
  if (points.length < 2) return points;
  const result: Vec3[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const samples = Math.max(1, samplesPerSegment);
    for (let j = 0; j < samples; j++) {
      if (i > 0 && j === 0) continue;
      result.push(lerpVec3(a, b, j / samples));
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

function findVisibilityBoundary(a: Vec3, b: Vec3, isVisible: (point: Vec3) => boolean): Vec3 {
  const aVisible = isVisible(a);
  let lo = 0;
  let hi = 1;

  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    const midPoint = lerpVec3(a, b, mid);
    if (isVisible(midPoint) === aVisible) {
      lo = mid;
    } else {
      hi = mid;
    }
  }

  return lerpVec3(a, b, (lo + hi) / 2);
}

function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function normalize(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]);
  return len > 1e-8 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 1, 0];
}
