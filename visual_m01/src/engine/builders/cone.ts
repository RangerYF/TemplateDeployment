import type { ConeParams } from '@/types/geometry';
import type { SurfaceResult, Vec3, SurfaceLine, SurfaceFace } from '../types';

/**
 * 圆锥 Builder
 * 底面在 y=0 平面，顶点在 y=height，底面圆心在原点
 */
export function buildCone(params: ConeParams): SurfaceResult {
  const { radius, height } = params;

  // 特征点
  const featurePoints = [
    { position: [0, height, 0] as Vec3, label: 'P' }, // 顶点
    { position: [0, 0, 0] as Vec3, label: 'O' },      // 底面圆心
  ];

  const lines: SurfaceLine[] = [];

  // 母线：4 条，均匀分布在 90° 间隔
  const numGeneratrices = 4;
  for (let i = 0; i < numGeneratrices; i++) {
    const angle = (i * 2 * Math.PI) / numGeneratrices;
    const basePoint: Vec3 = [
      radius * Math.cos(angle),
      0,
      radius * Math.sin(angle),
    ];
    lines.push({
      type: 'generatrix',
      points: [[0, height, 0], basePoint],
    });
  }

  // 底面圆轮廓线
  const circleSegments = 64;
  const circlePoints: Vec3[] = [];
  for (let i = 0; i <= circleSegments; i++) {
    const angle = (i * 2 * Math.PI) / circleSegments;
    circlePoints.push([
      radius * Math.cos(angle),
      0,
      radius * Math.sin(angle),
    ]);
  }
  lines.push({ type: 'baseCircle', points: circlePoints });

  // 面
  const faces: SurfaceFace[] = [
    { surfaceType: 'disk', samplePoints: circlePoints.slice(0, -1) }, // 底面（去掉闭合重复点）
    { surfaceType: 'lateral' },                                        // 侧面
  ];

  return {
    kind: 'surface',
    geometryType: 'cone',
    // ConeGeometry(radius, height, radialSegments)
    geometryArgs: [radius, height, 32],
    // ConeGeometry 默认中心在原点（从 -h/2 到 +h/2），偏移使底面在 y=0
    positionOffset: [0, height / 2, 0],
    featurePoints,
    lines,
    faces,
  };
}
