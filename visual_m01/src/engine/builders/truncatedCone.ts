import type { TruncatedConeParams } from '@/types/geometry';
import type { SurfaceResult, Vec3, SurfaceLine, SurfaceFace } from '../types';

/**
 * 圆台 Builder
 * 底面在 y=0 平面，顶面在 y=height，底面圆心在原点
 */
export function buildTruncatedCone(params: TruncatedConeParams): SurfaceResult {
  const { topRadius: r1, bottomRadius: r2, height: h } = params;

  // 特征点
  const featurePoints = [
    { position: [0, 0, 0] as Vec3, label: 'O' },       // 底面圆心
    { position: [0, h, 0] as Vec3, label: 'O₁' },      // 顶面圆心
  ];

  const lines: SurfaceLine[] = [];

  // 母线：4 条，90° 均匀分布（从底圆到顶圆）
  const numGeneratrices = 4;
  for (let i = 0; i < numGeneratrices; i++) {
    const angle = (i * 2 * Math.PI) / numGeneratrices;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    lines.push({
      type: 'generatrix',
      points: [
        [r2 * cos, 0, r2 * sin],
        [r1 * cos, h, r1 * sin],
      ],
    });
  }

  // 底面圆轮廓线
  const circleSegments = 64;
  const baseCirclePoints: Vec3[] = [];
  for (let i = 0; i <= circleSegments; i++) {
    const angle = (i * 2 * Math.PI) / circleSegments;
    baseCirclePoints.push([r2 * Math.cos(angle), 0, r2 * Math.sin(angle)]);
  }
  lines.push({ type: 'baseCircle', points: baseCirclePoints });

  // 顶面圆轮廓线
  const topCirclePoints: Vec3[] = [];
  for (let i = 0; i <= circleSegments; i++) {
    const angle = (i * 2 * Math.PI) / circleSegments;
    topCirclePoints.push([r1 * Math.cos(angle), h, r1 * Math.sin(angle)]);
  }
  lines.push({ type: 'topCircle', points: topCirclePoints });

  // 面
  const faces: SurfaceFace[] = [
    { surfaceType: 'disk', samplePoints: baseCirclePoints.slice(0, -1) }, // 底面
    { surfaceType: 'disk', samplePoints: topCirclePoints.slice(0, -1) },  // 顶面
    { surfaceType: 'lateral' },                                            // 侧面
  ];

  return {
    kind: 'surface',
    geometryType: 'truncatedCone',
    // CylinderGeometry 参数：radiusTop, radiusBottom, height, segments
    // 在 FaceEntityRenderer 中按 truncatedCone case 解构
    geometryArgs: [r1, r2, h, 64],
    // CylinderGeometry 默认中心在原点，偏移使底面对齐 y=0
    positionOffset: [0, h / 2, 0],
    featurePoints,
    lines,
    faces,
  };
}
