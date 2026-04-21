import { useMemo } from 'react';
import type { Entity, PointProperties, FaceProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor';
import { useBuilderResult } from '@/editor/builderCache';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';
import type { Vec3 } from '@/engine/types';

/** 用叉积法计算多边形面积 */
function computePolygonArea(positions: Vec3[]): number {
  if (positions.length < 3) return 0;
  let nx = 0, ny = 0, nz = 0;
  for (let i = 0; i < positions.length; i++) {
    const curr = positions[i];
    const next = positions[(i + 1) % positions.length];
    nx += (curr[1] - next[1]) * (curr[2] + next[2]);
    ny += (curr[2] - next[2]) * (curr[0] + next[0]);
    nz += (curr[0] - next[0]) * (curr[1] + next[1]);
  }
  return Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
}

function FaceInspector({ entity }: { entity: Entity }) {
  const faceEntity = entity as Entity<'face'>;
  const { pointIds, source, geometryId } = faceEntity.properties;

  const entities = useEntityStore((s) => s.entities);
  const result = useBuilderResult(geometryId);

  // 构成顶点标签
  const pointLabels = useMemo(() => {
    return pointIds.map((pid) => {
      const pt = entities[pid];
      return pt?.type === 'point' ? (pt.properties as PointProperties).label : '?';
    });
  }, [entities, pointIds]);

  // 面积计算
  const area = useMemo(() => {
    if (!result) return null;
    const positions: Vec3[] = [];
    for (const pid of pointIds) {
      const pt = entities[pid];
      if (!pt || pt.type !== 'point') return null;
      const pos = computePointPosition(pt.properties as PointProperties, result);
      if (!pos) return null;
      positions.push(pos);
    }
    if (positions.length < 3) return null;
    return computePolygonArea(positions);
  }, [pointIds, entities, result]);

  // 面上取的点
  const facePoints = useMemo(() => {
    const result: { id: string; label: string }[] = [];
    for (const e of Object.values(entities)) {
      if (e.type !== 'point') continue;
      const constraint = (e.properties as PointProperties).constraint;
      if (constraint.type === 'face' && constraint.faceId === entity.id) {
        result.push({ id: e.id, label: (e.properties as PointProperties).label });
      }
    }
    return result;
  }, [entities, entity.id]);

  const sourceLabel = source.type === 'geometry' ? '几何体面' :
    source.type === 'crossSection' ? '截面' :
    source.type === 'surface' ? '曲面' : '自定义面';

  const faceName = pointLabels.join('');

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName={sourceLabel}
        displayName={faceName || '面'}
        canDelete={source.type === 'crossSection'}
        deleteLabel="删除截面"
        canRename={false}
      />

      {/* 顶点 */}
      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        顶点：{pointLabels.join(' · ')}
      </div>

      {/* 面积 */}
      {area != null && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          面积：{area.toFixed(4)}
        </div>
      )}

      {/* 面上的点 */}
      {facePoints.length > 0 && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          面上的点：{facePoints.map((p) => p.label).join(' · ')}
        </div>
      )}

      {/* 截面详情 */}
      {source.type === 'crossSection' && (
        <CrossSectionDetail source={source} pointLabels={pointLabels} />
      )}
    </div>
  );
}

function CrossSectionDetail({
  source,
  pointLabels,
}: {
  source: Extract<FaceProperties['source'], { type: 'crossSection' }>;
  pointLabels: string[];
}) {
  const entities = useEntityStore((s) => s.entities);

  const definingLabels = useMemo(() => {
    return source.definingPointIds.map((pid) => {
      const pt = entities[pid];
      return pt?.type === 'point' ? (pt.properties as PointProperties).label : '?';
    });
  }, [entities, source.definingPointIds]);

  return (
    <>
      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        定义点：{definingLabels.join(' · ')}
      </div>
      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        交点：{pointLabels.join(' · ')}
      </div>
    </>
  );
}

registerInspector('face', FaceInspector);

export { FaceInspector };
