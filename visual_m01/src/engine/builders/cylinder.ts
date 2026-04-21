import type { CylinderParams } from '@/types/geometry';
import type { SurfaceResult, Vec3, SurfaceLine, SurfaceFace } from '../types';

/**
 * 圆柱 Builder
 * 底面在 y=0 平面，顶面在 y=height，底面圆心在原点
 */
export function buildCylinder(params: CylinderParams): SurfaceResult {
  const { radius, height } = params;

  // 特征点
  const featurePoints = [
    { position: [0, 0, 0] as Vec3, label: 'O' },          // 底面圆心
    { position: [0, height, 0] as Vec3, label: 'O₁' },    // 顶面圆心
  ];

  const lines: SurfaceLine[] = [];

  // 母线：4 条，90° 均匀分布
  const numGeneratrices = 4;
  for (let i = 0; i < numGeneratrices; i++) {
    const angle = (i * 2 * Math.PI) / numGeneratrices;
    const x = radius * Math.cos(angle);
    const z = radius * Math.sin(angle);
    lines.push({
      type: 'generatrix',
      points: [
        [x, 0, z],
        [x, height, z],
      ],
    });
  }

  // 底面圆轮廓线
  const circleSegments = 64;
  const baseCirclePoints: Vec3[] = [];
  for (let i = 0; i <= circleSegments; i++) {
    const angle = (i * 2 * Math.PI) / circleSegments;
    baseCirclePoints.push([
      radius * Math.cos(angle),
      0,
      radius * Math.sin(angle),
    ]);
  }
  lines.push({ type: 'baseCircle', points: baseCirclePoints });

  // 顶面圆轮廓线
  const topCirclePoints: Vec3[] = [];
  for (let i = 0; i <= circleSegments; i++) {
    const angle = (i * 2 * Math.PI) / circleSegments;
    topCirclePoints.push([
      radius * Math.cos(angle),
      height,
      radius * Math.sin(angle),
    ]);
  }
  lines.push({ type: 'topCircle', points: topCirclePoints });

  // 面
  const faces: SurfaceFace[] = [
    { surfaceType: 'disk', samplePoints: baseCirclePoints.slice(0, -1) }, // 底面（去掉闭合重复点）
    { surfaceType: 'disk', samplePoints: topCirclePoints.slice(0, -1) },  // 顶面
    { surfaceType: 'lateral' },                                            // 侧面
  ];

  return {
    kind: 'surface',
    geometryType: 'cylinder',
    // CylinderGeometry 在 SurfaceRenderer 中解构为 (a0, a0, a1, a2)
    // 即 (radiusTop, radiusBottom, height, segments)
    geometryArgs: [radius, height, 64],
    // CylinderGeometry 默认中心在原点，偏移使底面对齐 y=0
    positionOffset: [0, height / 2, 0],
    featurePoints,
    lines,
    faces,
  };
}
