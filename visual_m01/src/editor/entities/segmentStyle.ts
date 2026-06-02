import { getBuilderResult } from '@/editor/builderCache';
import { useEntityStore } from '@/editor/store/entityStore';
import type { Entity, GeometryProperties, PointProperties, SegmentProperties } from './types';

const DEFAULT_HELPER_SEGMENT_COLOR = '#ff0000';

function getGeometryProps(geometryId: string): GeometryProperties | null {
  const geometry = useEntityStore.getState().getEntity(geometryId);
  if (!geometry || geometry.type !== 'geometry') return null;
  return geometry.properties as GeometryProperties;
}

function isNativePolyhedronEdge(
  geometryId: string,
  startPoint: Entity<'point'>,
  endPoint: Entity<'point'>,
): boolean {
  const startConstraint = (startPoint.properties as PointProperties).constraint;
  const endConstraint = (endPoint.properties as PointProperties).constraint;
  if (startConstraint.type !== 'vertex' || endConstraint.type !== 'vertex') {
    return false;
  }

  const geometryProps = getGeometryProps(geometryId);
  if (!geometryProps) return false;

  const result = getBuilderResult(geometryId, geometryProps.geometryType, geometryProps.params);
  if (!result || result.kind !== 'polyhedron') return false;

  return result.edges.some(([a, b]) => (
    (a === startConstraint.vertexIndex && b === endConstraint.vertexIndex)
    || (a === endConstraint.vertexIndex && b === startConstraint.vertexIndex)
  ));
}

export function shouldDefaultDashedSegment(
  startPoint: Entity<'point'> | undefined,
  endPoint: Entity<'point'> | undefined,
): boolean {
  if (!startPoint || !endPoint) return true;

  const startProps = startPoint.properties as PointProperties;
  const endProps = endPoint.properties as PointProperties;
  if (startProps.geometryId !== endProps.geometryId) return true;

  return !isNativePolyhedronEdge(startProps.geometryId, startPoint, endPoint);
}

export function createDefaultHelperSegmentStyle(
  startPoint: Entity<'point'> | undefined,
  endPoint: Entity<'point'> | undefined,
  style?: Partial<SegmentProperties['style']>,
): SegmentProperties['style'] {
  const recommendedDashed = shouldDefaultDashedSegment(startPoint, endPoint);

  return {
    color: style?.color ?? DEFAULT_HELPER_SEGMENT_COLOR,
    dashed: style?.dashed ?? recommendedDashed,
  };
}
