import type { ObliquePrismParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const LABELS_SUB = ['A₁', 'B₁', 'C₁', 'D₁', 'E₁', 'F₁', 'G₁', 'H₁'];

export function buildObliquePrism(params: ObliquePrismParams): PolyhedronResult {
  const { sides, sideLength, height, topOffsetX, topOffsetZ } = params;
  const n = Math.max(3, Math.min(8, Math.round(sides)));

  const R = sideLength / (2 * Math.sin(Math.PI / n));

  const vertices: { position: Vec3; label: string }[] = [];

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    vertices.push({
      position: [R * Math.cos(angle), 0, R * Math.sin(angle)],
      label: LABELS[i],
    });
  }

  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    vertices.push({
      position: [R * Math.cos(angle) + topOffsetX, height, R * Math.sin(angle) + topOffsetZ],
      label: LABELS_SUB[i],
    });
  }

  const faces: number[][] = [];

  const bottomFace: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    bottomFace.push(i);
  }
  faces.push(bottomFace);

  const topFace: number[] = [];
  for (let i = 0; i < n; i++) {
    topFace.push(n + i);
  }
  faces.push(topFace);

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i]);
  }

  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    edges.push([i, (i + 1) % n]);
  }
  for (let i = 0; i < n; i++) {
    edges.push([n + i, n + ((i + 1) % n)]);
  }
  for (let i = 0; i < n; i++) {
    edges.push([i, n + i]);
  }

  return { kind: 'polyhedron', vertices, faces, edges };
}
