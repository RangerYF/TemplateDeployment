import type { GeometryType } from '@/types/geometry';
import type { Vec3 } from '../types';
import type { PolyhedronResult } from '../types';
import type { EscribedSphereItem } from './types';
import { buildGeometry } from '../builders';
import { calculate } from './index';

const SUPPORTED_TYPES: Set<GeometryType> = new Set([
  'regularTetrahedron',
  'cornerTetrahedron',
  'isoscelesTetrahedron',
  'orthogonalTetrahedron',
]);

export function isEscribedSphereSupported(type: GeometryType): boolean {
  return SUPPORTED_TYPES.has(type);
}

export function findBuilderFaceIndex(
  type: GeometryType,
  params: Record<string, number>,
  pointLabels: string[],
): number | null {
  const result = buildGeometry(type, params as never);
  if (!result || result.kind !== 'polyhedron') return null;
  const poly = result as PolyhedronResult;
  const target = new Set(pointLabels);
  for (let i = 0; i < poly.faces.length; i++) {
    const fl = new Set(poly.faces[i].map((vi) => poly.vertices[vi].label));
    if (fl.size === target.size && [...target].every((l) => fl.has(l))) return i;
  }
  return null;
}

export function computeEscribedSpheres(
  type: GeometryType,
  params: Record<string, number>,
): EscribedSphereItem[] | null {
  if (!SUPPORTED_TYPES.has(type)) return null;

  const result = buildGeometry(type, params as never);
  if (!result || result.kind !== 'polyhedron') return null;
  const poly = result as PolyhedronResult;

  const calcResult = calculate(type, params);
  if (!calcResult) return null;
  const volume = calcResult.volume.value.numeric;
  if (volume <= 0) return null;

  const verts = poly.vertices.map((v) => v.position);
  const { faces } = poly;

  const faceAreas = faces.map((face) => computeFaceArea(verts, face));
  const totalArea = faceAreas.reduce((a, b) => a + b, 0);

  const items: EscribedSphereItem[] = [];

  for (let k = 0; k < faces.length; k++) {
    const denom = totalArea - 2 * faceAreas[k];
    if (denom <= 1e-10) continue;

    const radius = (3 * volume) / denom;
    const center = computeExCenter(verts, faces, faceAreas, k);
    const faceLabel = buildFaceLabel(poly, k);

    items.push({ faceIndex: k, faceLabel, center, radius, radiusLatex: fmtNum(radius) });
  }

  return items.length > 0 ? items : null;
}

function buildFaceLabel(poly: PolyhedronResult, faceIndex: number): string {
  const face = poly.faces[faceIndex];
  if (face.length > 4) return '底面';
  return face.map((vi) => poly.vertices[vi].label).join('');
}

function computeFaceArea(verts: Vec3[], face: number[]): number {
  if (face.length < 3) return 0;
  let area = 0;
  const p0 = verts[face[0]];
  for (let i = 1; i < face.length - 1; i++) {
    const p1 = verts[face[i]];
    const p2 = verts[face[i + 1]];
    const e1: Vec3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
    const e2: Vec3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    area += Math.sqrt(cx * cx + cy * cy + cz * cz);
  }
  return area / 2;
}

function computeExCenter(
  verts: Vec3[],
  faces: number[][],
  faceAreas: number[],
  k: number,
): Vec3 {
  const normals = faces.map((face, i) => computeOutwardNormal(verts, face, faces, i));
  const facePoints = faces.map((face) => faceCentroid(verts, face));

  const r_k = faceAreas.reduce((a, b) => a + b, 0) - 2 * faceAreas[k];
  if (r_k <= 1e-10) return [0, 0, 0];
  const radius = (3 * computePolyVolume(verts, faces)) / r_k;

  // d_i = dot(n_i, p_i) is the signed distance of the face plane from origin
  // For the exsphere center E_k:
  //   dot(n_k, E_k) = d_k + r (outside face k)
  //   dot(n_j, E_k) = d_j - r (inside other faces)
  // Use 3 equations from faces j != k to solve for E_k
  const otherFaces = [];
  for (let j = 0; j < faces.length; j++) {
    if (j !== k) otherFaces.push(j);
  }
  if (otherFaces.length < 3) return [0, 0, 0];

  const j0 = otherFaces[0], j1 = otherFaces[1], j2 = otherFaces[2];
  const n0 = normals[j0], n1 = normals[j1], n2 = normals[j2];
  const d0 = dot3(n0, facePoints[j0]) - radius;
  const d1 = dot3(n1, facePoints[j1]) - radius;
  const d2 = dot3(n2, facePoints[j2]) - radius;

  return solve3x3(
    [n0[0], n0[1], n0[2]],
    [n1[0], n1[1], n1[2]],
    [n2[0], n2[1], n2[2]],
    [d0, d1, d2],
  );
}

function computeOutwardNormal(
  verts: Vec3[],
  face: number[],
  allFaces: number[][],
  _faceIdx: number,
): Vec3 {
  const p0 = verts[face[0]], p1 = verts[face[1]], p2 = verts[face[2]];
  const e1: Vec3 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2: Vec3 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  let nx = e1[1] * e2[2] - e1[2] * e2[1];
  let ny = e1[2] * e2[0] - e1[0] * e2[2];
  let nz = e1[0] * e2[1] - e1[1] * e2[0];
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-12) return [0, 1, 0];
  nx /= len; ny /= len; nz /= len;

  // Orient outward: normal should point away from polyhedron centroid
  const centroid = polyCentroid(verts, allFaces);
  const fc = faceCentroid(verts, face);
  const toCentroid: Vec3 = [centroid[0] - fc[0], centroid[1] - fc[1], centroid[2] - fc[2]];
  if (nx * toCentroid[0] + ny * toCentroid[1] + nz * toCentroid[2] > 0) {
    nx = -nx; ny = -ny; nz = -nz;
  }

  return [nx, ny, nz];
}

function polyCentroid(verts: Vec3[], faces: number[][]): Vec3 {
  const allIdx = new Set<number>();
  for (const f of faces) for (const i of f) allIdx.add(i);
  let cx = 0, cy = 0, cz = 0;
  for (const i of allIdx) { cx += verts[i][0]; cy += verts[i][1]; cz += verts[i][2]; }
  const n = allIdx.size;
  return [cx / n, cy / n, cz / n];
}

function faceCentroid(verts: Vec3[], face: number[]): Vec3 {
  let cx = 0, cy = 0, cz = 0;
  for (const i of face) { cx += verts[i][0]; cy += verts[i][1]; cz += verts[i][2]; }
  const n = face.length;
  return [cx / n, cy / n, cz / n];
}

function computePolyVolume(verts: Vec3[], faces: number[][]): number {
  let vol = 0;
  for (const face of faces) {
    const p0 = verts[face[0]];
    for (let i = 1; i < face.length - 1; i++) {
      const p1 = verts[face[i]];
      const p2 = verts[face[i + 1]];
      vol += p0[0] * (p1[1] * p2[2] - p2[1] * p1[2])
           - p1[0] * (p0[1] * p2[2] - p2[1] * p0[2])
           + p2[0] * (p0[1] * p1[2] - p1[1] * p0[2]);
    }
  }
  return Math.abs(vol) / 6;
}

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function solve3x3(
  r0: [number, number, number],
  r1: [number, number, number],
  r2: [number, number, number],
  rhs: [number, number, number],
): Vec3 {
  const det =
    r0[0] * (r1[1] * r2[2] - r1[2] * r2[1]) -
    r0[1] * (r1[0] * r2[2] - r1[2] * r2[0]) +
    r0[2] * (r1[0] * r2[1] - r1[1] * r2[0]);
  if (Math.abs(det) < 1e-12) return [0, 0, 0];
  const x =
    (rhs[0] * (r1[1] * r2[2] - r1[2] * r2[1]) -
     r0[1] * (rhs[1] * r2[2] - r1[2] * rhs[2]) +
     r0[2] * (rhs[1] * r2[1] - r1[1] * rhs[2])) / det;
  const y =
    (r0[0] * (rhs[1] * r2[2] - r1[2] * rhs[2]) -
     rhs[0] * (r1[0] * r2[2] - r1[2] * r2[0]) +
     r0[2] * (r1[0] * rhs[2] - rhs[1] * r2[0])) / det;
  const z =
    (r0[0] * (r1[1] * rhs[2] - rhs[1] * r2[1]) -
     r0[1] * (r1[0] * rhs[2] - rhs[1] * r2[0]) +
     rhs[0] * (r1[0] * r2[1] - r1[1] * r2[0])) / det;
  return [x, y, z];
}

function fmtNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const r4 = Math.round(n * 10000) / 10000;
  if (Number.isInteger(r4)) return String(r4);
  return String(r4);
}
