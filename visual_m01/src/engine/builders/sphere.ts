import type { SphereParams } from '@/types/geometry';
import type { SurfaceResult, Vec3, SurfaceLine, SurfaceFace } from '../types';

/**
 * 球 Builder
 * 球底部对齐 y=0，球心在 (0, radius, 0)
 * 3 条经线 + 1 条赤道线
 */
export function buildSphere(params: SphereParams): SurfaceResult {
  const { radius } = params;
  const cy = radius; // 球心 y 坐标（底部对齐 y=0）

  // 特征点
  const featurePoints = [
    { position: [0, cy, 0] as Vec3, label: 'O' }, // 球心
  ];

  const lines: SurfaceLine[] = [];
  const segments = 64;

  // 经线 1：XY 平面（x-y 平面，z=0）
  const meridian1: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    meridian1.push([
      radius * Math.cos(angle),
      cy + radius * Math.sin(angle),
      0,
    ]);
  }
  lines.push({ type: 'meridian', points: meridian1 });

  // 经线 2：YZ 平面（y-z 平面，x=0）
  const meridian2: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    meridian2.push([
      0,
      cy + radius * Math.sin(angle),
      radius * Math.cos(angle),
    ]);
  }
  lines.push({ type: 'meridian', points: meridian2 });

  // 经线 3：45° 旋转平面
  const meridian3: Vec3[] = [];
  const cos45 = Math.cos(Math.PI / 4);
  const sin45 = Math.sin(Math.PI / 4);
  for (let i = 0; i <= segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    const r = radius * Math.cos(angle);
    meridian3.push([
      r * cos45,
      cy + radius * Math.sin(angle),
      r * sin45,
    ]);
  }
  lines.push({ type: 'meridian', points: meridian3 });

  // 赤道线：y=cy 平面上的大圆
  const equator: Vec3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i * 2 * Math.PI) / segments;
    equator.push([
      radius * Math.cos(angle),
      cy,
      radius * Math.sin(angle),
    ]);
  }
  lines.push({ type: 'equator', points: equator });

  // 面
  const faces: SurfaceFace[] = [
    { surfaceType: 'sphere' }, // 球面
  ];

  return {
    kind: 'surface',
    geometryType: 'sphere',
    // SphereGeometry(radius, widthSegments, heightSegments)
    geometryArgs: [radius, 64, 32],
    // 球默认中心在原点，偏移使底部对齐 y=0
    positionOffset: [0, cy, 0],
    featurePoints,
    lines,
    faces,
  };
}
