import type { ObliquePyramidParams } from '@/types/geometry';
import type { PolyhedronResult, Vec3 } from '../types';

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function buildObliquePyramid(params: ObliquePyramidParams): PolyhedronResult {
  const { sides, sideLength, height, apexOffsetX, apexOffsetZ } = params;
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

  vertices.push({
    position: [apexOffsetX, height, apexOffsetZ],
    label: 'P',
  });

  const faces: number[][] = [];

  const bottomFace: number[] = [];
  for (let i = n - 1; i >= 0; i--) {
    bottomFace.push(i);
  }
  faces.push(bottomFace);

  for (let i = 0; i < n; i++) {
    faces.push([i, (i + 1) % n, n]);
  }

  const edges: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    edges.push([i, (i + 1) % n]);
  }
  for (let i = 0; i < n; i++) {
    edges.push([i, n]);
  }

  return { kind: 'polyhedron', vertices, faces, edges };
}
