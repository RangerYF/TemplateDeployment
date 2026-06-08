import { useMemo, useCallback } from 'react';
import type { Entity, PointProperties, FaceProperties } from '@/editor/entities/types';
import { useEntityStore, useHistoryStore, UpdatePropertiesCommand } from '@/editor';
import { useBuilderResult } from '@/editor/builderCache';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { Switch } from '@/components/ui/switch';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';
import type { Vec3 } from '@/engine/types';

const FACE_PRESET_COLORS = [
  { label: '灰', value: '#9ca3af' },
  { label: '蓝', value: '#3b82f6' },
  { label: '红', value: '#ef4444' },
  { label: '绿', value: '#22c55e' },
  { label: '紫', value: '#a855f7' },
  { label: '橙', value: '#f97316' },
  { label: '黄', value: '#facc15' },
  { label: '黑', value: '#000000' },
];

const DEFAULT_FACE_COLOR = '#9ca3af';
const DEFAULT_FACE_OPACITY = 0.12;

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
  const { pointIds, source, geometryId, style } = faceEntity.properties;

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

  const currentColor = style?.color ?? DEFAULT_FACE_COLOR;
  const currentOpacity = style?.opacity ?? DEFAULT_FACE_OPACITY;
  const hasCustomStyle = style != null;

  const handleColorChange = useCallback((color: string) => {
    const oldStyle = style ?? { color: DEFAULT_FACE_COLOR, opacity: DEFAULT_FACE_OPACITY };
    const newStyle = { ...oldStyle, color };
    useHistoryStore.getState().execute(
      new UpdatePropertiesCommand<'face'>(
        faceEntity.id,
        { style: style },
        { style: newStyle },
        '设置面颜色',
      ),
    );
  }, [faceEntity.id, style]);

  const handleOpacityChange = useCallback((opacity: number) => {
    const oldStyle = style ?? { color: DEFAULT_FACE_COLOR, opacity: DEFAULT_FACE_OPACITY };
    const newStyle = { ...oldStyle, opacity };
    useHistoryStore.getState().execute(
      new UpdatePropertiesCommand<'face'>(
        faceEntity.id,
        { style: style },
        { style: newStyle },
        '设置面不透明度',
      ),
    );
  }, [faceEntity.id, style]);

  const handleReset = useCallback(() => {
    if (!hasCustomStyle) return;
    useHistoryStore.getState().execute(
      new UpdatePropertiesCommand<'face'>(
        faceEntity.id,
        { style },
        { style: undefined },
        '重置面样式',
      ),
    );
  }, [faceEntity.id, style, hasCustomStyle]);

  const sourceLabel = source.type === 'geometry' ? '几何体面' :
    source.type === 'crossSection' ? '截面' :
    source.type === 'surface' ? '曲面' :
    source.type === 'perpendicularPlane' ? '垂面' : '自定义面';

  const faceName = pointLabels.join('');

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName={sourceLabel}
        displayName={faceName || '面'}
        canDelete={source.type === 'crossSection' || source.type === 'perpendicularPlane'}
        deleteLabel={source.type === 'perpendicularPlane' ? '删除垂面' : '删除截面'}
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

      {/* 垂面详情 */}
      {source.type === 'perpendicularPlane' && (
        <PerpendicularPlaneDetail source={source} />
      )}

      {/* 显示完整平面（截面/垂面） */}
      {(source.type === 'crossSection' || source.type === 'perpendicularPlane') && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: COLORS.textMuted }}>显示完整平面</span>
          <Switch
            checked={!!faceEntity.properties.showPlane}
            onCheckedChange={(checked) => {
              useHistoryStore.getState().execute(
                new UpdatePropertiesCommand<'face'>(
                  faceEntity.id,
                  { showPlane: faceEntity.properties.showPlane },
                  { showPlane: checked },
                  '切换截面完整平面',
                ),
              );
            }}
          />
        </div>
      )}

      {/* 外观设置 */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm" style={{ color: COLORS.textMuted }}>颜色</span>
          {FACE_PRESET_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => handleColorChange(c.value)}
              className="w-5 h-5 rounded-full border-2"
              style={{
                backgroundColor: c.value,
                borderColor: currentColor === c.value ? COLORS.primary : 'transparent',
              }}
              title={c.label}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm shrink-0" style={{ color: COLORS.textMuted }}>不透明度</span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(currentOpacity * 100)}
            onChange={(e) => handleOpacityChange(Number(e.target.value) / 100)}
            className="flex-1 h-1 accent-[#00C06B]"
          />
          <span className="text-xs w-8 text-right" style={{ color: COLORS.textMuted }}>
            {Math.round(currentOpacity * 100)}%
          </span>
        </div>

        {hasCustomStyle && (
          <button
            onClick={handleReset}
            className="text-xs px-2 py-0.5 rounded"
            style={{
              color: COLORS.textMuted,
              backgroundColor: COLORS.bgMuted,
            }}
          >
            重置默认
          </button>
        )}
      </div>
    </div>
  );
}

function PerpendicularPlaneDetail({
  source,
}: {
  source: Extract<FaceProperties['source'], { type: 'perpendicularPlane' }>;
}) {
  const entities = useEntityStore((s) => s.entities);
  const pointLabel = useMemo(() => {
    const pt = entities[source.pointId];
    return pt?.type === 'point' ? (pt.properties as PointProperties).label : '?';
  }, [entities, source.pointId]);

  return (
    <div className="text-sm" style={{ color: COLORS.textMuted }}>
      过点：{pointLabel}
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
