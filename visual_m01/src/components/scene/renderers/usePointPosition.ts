import { useMemo } from 'react';
import type { Entity, PointProperties, PointConstraint, CoordinateSystemProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import type { BuilderResult, Vec3 } from '@/engine/types';
import { evaluateCurveAtT } from '@/utils/curveProjection';

/**
 * 计算 Point Entity 的 3D 位置（纯函数版本）
 * 供 FaceEntityRenderer 等非 Hook 上下文使用
 */
export function computePointPosition(
  props: PointProperties,
  result: BuilderResult,
): Vec3 | null {
  const { constraint, positionOverride } = props;

  if (positionOverride) return positionOverride;

  return computeConstraintPosition(constraint, result);
}

function computeConstraintPosition(
  constraint: PointConstraint,
  result: BuilderResult,
): Vec3 | null {
  switch (constraint.type) {
    case 'vertex': {
      if (result.kind === 'polyhedron') {
        const v = result.vertices[constraint.vertexIndex];
        return v ? v.position : null;
      } else {
        const fp = result.featurePoints[constraint.vertexIndex];
        return fp ? fp.position : null;
      }
    }
    case 'edge': {
      if (result.kind !== 'polyhedron') return null;
      const va = result.vertices[constraint.edgeStart];
      const vb = result.vertices[constraint.edgeEnd];
      if (!va || !vb) return null;
      const t = constraint.t;
      return [
        va.position[0] + t * (vb.position[0] - va.position[0]),
        va.position[1] + t * (vb.position[1] - va.position[1]),
        va.position[2] + t * (vb.position[2] - va.position[2]),
      ];
    }
    case 'curve': {
      if (result.kind !== 'surface') return null;
      const line = result.lines[constraint.lineIndex];
      if (!line) return null;
      return evaluateCurveAtT(line.points, constraint.t);
    }
    case 'face': {
      // 面上点：用面的顶点位置 + (u, v) 参数计算
      const faceEntity = useEntityStore.getState().getEntity(constraint.faceId);
      if (!faceEntity || faceEntity.type !== 'face') return null;
      const facePointIds = (faceEntity.properties as { pointIds: string[] }).pointIds;
      if (facePointIds.length < 3) return null;

      // 获取面的前3个顶点位置
      const facePositions: Vec3[] = [];
      for (let i = 0; i < Math.min(3, facePointIds.length); i++) {
        const pe = useEntityStore.getState().getEntity(facePointIds[i]);
        if (!pe || pe.type !== 'point') return null;
        const pos = computePointPosition(
          pe.properties as PointProperties,
          result,
        );
        if (!pos) return null;
        facePositions.push(pos);
      }

      const [p0, p1, p2] = facePositions;
      // position = p0 + u * (p1 - p0) + v * (p2 - p0)
      return [
        p0[0] + constraint.u * (p1[0] - p0[0]) + constraint.v * (p2[0] - p0[0]),
        p0[1] + constraint.u * (p1[1] - p0[1]) + constraint.v * (p2[1] - p0[1]),
        p0[2] + constraint.u * (p1[2] - p0[2]) + constraint.v * (p2[2] - p0[2]),
      ];
    }
    case 'free':
      return constraint.position;
    case 'coordinate': {
      // 坐标系局部坐标 → 世界坐标变换：worldPos = origin + cx·axisX + cy·axisY + cz·axisZ
      const csEntity = useEntityStore.getState().getEntity(constraint.coordSystemId);
      if (!csEntity || csEntity.type !== 'coordinateSystem') return constraint.coords;
      const csProps = csEntity.properties as CoordinateSystemProperties;
      if (!csProps.axes) return constraint.coords;

      const originEntity = useEntityStore.getState().getEntity(csProps.originPointId);
      if (!originEntity || originEntity.type !== 'point') return constraint.coords;
      const originPos = computePointPosition(originEntity.properties as PointProperties, result);
      if (!originPos) return constraint.coords;

      const [ax, ay, az] = csProps.axes;
      const [cx, cy, cz] = constraint.coords;
      return [
        originPos[0] + cx * ax[0] + cy * ay[0] + cz * az[0],
        originPos[1] + cx * ax[1] + cy * ay[1] + cz * az[1],
        originPos[2] + cx * ax[2] + cy * ay[2] + cz * az[2],
      ];
    }
    default:
      return null;
  }
}

/**
 * React Hook：订阅 Point Entity 对应的几何体参数变化，自动计算 3D 位置
 */
export function usePointPosition(
  pointEntity: Entity<'point'> | undefined | null,
): Vec3 | null {
  const geometryId = pointEntity?.properties.geometryId;
  const result = useBuilderResult(geometryId);

  return useMemo(() => {
    if (!pointEntity || !result) return null;
    return computePointPosition(pointEntity.properties, result);
  }, [pointEntity, result]);
}
