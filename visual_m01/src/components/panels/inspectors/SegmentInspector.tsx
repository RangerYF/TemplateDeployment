import { useCallback, useMemo } from 'react';
import type { Entity, CoordinateSystemProperties, PointProperties } from '@/editor/entities/types';
import type { GeometryType } from '@/types/geometry';
import { useEntityStore, useHistoryStore, UpdatePropertiesCommand } from '@/editor';
import { usePointPosition, computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { useBuilderResult } from '@/editor/builderCache';
import { buildCoordinateSystem, buildCoordinateSystemFromAxes } from '@/engine/math/coordinates';
import { calculateLineEquation } from '@/engine/math/lineEquation';
import { TeX } from '@/components/ui/TeX';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';
import type { Vec3 } from '@/engine/types';

const PRESET_COLORS = [
  { label: '黑', value: '#000000' },
  { label: '红', value: '#ef4444' },
  { label: '蓝', value: '#3b82f6' },
  { label: '绿', value: '#22c55e' },
  { label: '紫', value: '#a855f7' },
  { label: '橙', value: '#f97316' },
];

function SegmentInspector({ entity }: { entity: Entity }) {
  const segEntity = entity as Entity<'segment'>;
  const { builtIn, startPointId, endPointId, style, label } = segEntity.properties;

  // 端点信息
  const startPoint = useEntityStore((s) => s.entities[startPointId]) as Entity<'point'> | undefined;
  const endPoint = useEntityStore((s) => s.entities[endPointId]) as Entity<'point'> | undefined;
  const startLabel = startPoint?.properties.label ?? '?';
  const endLabel = endPoint?.properties.label ?? '?';

  // 长度计算
  const startPos = usePointPosition(startPoint);
  const endPos = usePointPosition(endPoint);
  const length = startPos && endPos
    ? Math.sqrt(
        (endPos[0] - startPos[0]) ** 2 +
        (endPos[1] - startPos[1]) ** 2 +
        (endPos[2] - startPos[2]) ** 2,
      )
    : null;

  // 坐标系与直线方程
  const entitiesMap = useEntityStore((s) => s.entities);
  const csEntity = useMemo(() => {
    return Object.values(entitiesMap).find((e) => e.type === 'coordinateSystem') as
      Entity<'coordinateSystem'> | undefined;
  }, [entitiesMap]);
  const csProps = csEntity?.properties as CoordinateSystemProperties | undefined;

  const originPoint = useMemo(() => {
    if (!csProps?.originPointId) return undefined;
    const e = entitiesMap[csProps.originPointId];
    return e?.type === 'point' ? (e as Entity<'point'>) : undefined;
  }, [entitiesMap, csProps?.originPointId]);

  const result = useBuilderResult(csProps?.geometryId);

  const lineEquation = useMemo(() => {
    if (!csProps || !originPoint || !result || !startPos || !endPos) return null;

    // 计算坐标系
    const originPos = computePointPosition(originPoint.properties, result);
    if (!originPos) return null;

    let coordSystem: { origin: Vec3; axes: [Vec3, Vec3, Vec3] } | null = null;

    if (csProps.axes) {
      const axes = csProps.axes as [Vec3, Vec3, Vec3];
      coordSystem = buildCoordinateSystemFromAxes(originPos, axes, result);
    } else {
      const geoEntity = entitiesMap[csProps.geometryId];
      const geoType = geoEntity?.type === 'geometry'
        ? (geoEntity.properties as { geometryType: GeometryType }).geometryType
        : undefined;
      const constraint = (originPoint.properties as PointProperties).constraint;
      if (geoType && constraint.type === 'vertex') {
        coordSystem = buildCoordinateSystem(geoType, result, constraint.vertexIndex);
      }
    }

    if (!coordSystem) return null;

    const { origin, axes } = coordSystem;

    // 世界坐标 → 局部坐标
    const toLocal = (pos: Vec3): Vec3 => {
      const rel: Vec3 = [pos[0] - origin[0], pos[1] - origin[1], pos[2] - origin[2]];
      return [
        rel[0] * axes[0][0] + rel[1] * axes[0][1] + rel[2] * axes[0][2],
        rel[0] * axes[1][0] + rel[1] * axes[1][1] + rel[2] * axes[1][2],
        rel[0] * axes[2][0] + rel[1] * axes[2][1] + rel[2] * axes[2][2],
      ];
    };

    const startLocal = toLocal(startPos);
    const endLocal = toLocal(endPos);

    return calculateLineEquation(startLocal, endLocal);
  }, [csProps, originPoint, result, startPos, endPos, entitiesMap]);

  // 样式编辑
  const handleColorChange = useCallback((color: string) => {
    useHistoryStore.getState().execute(
      new UpdatePropertiesCommand(
        segEntity.id,
        { style: { ...style } },
        { style: { ...style, color } },
      ),
    );
  }, [segEntity.id, style]);

  const handleDashedToggle = useCallback(() => {
    useHistoryStore.getState().execute(
      new UpdatePropertiesCommand(
        segEntity.id,
        { style: { ...style } },
        { style: { ...style, dashed: !style.dashed } },
      ),
    );
  }, [segEntity.id, style]);

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName={builtIn ? '棱线' : '线段'}
        displayName={label || `${startLabel}${endLabel}`}
        canDelete={!builtIn}
        deleteLabel="删除线段"
      />

      {/* 端点 */}
      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        {startLabel} → {endLabel}
      </div>

      {/* 长度 */}
      {length !== null && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          长度：{length.toFixed(4)}
        </div>
      )}

      {/* 直线方程 */}
      <div
        className="space-y-1 rounded-md p-2 text-sm"
        style={{ backgroundColor: COLORS.bgMuted }}
      >
        <div style={{ color: COLORS.textMuted, fontWeight: 500 }}>直线方程</div>
        {lineEquation ? (
          <>
            <div style={{ fontSize: '16px', overflowWrap: 'break-word' }}>
              <TeX math={lineEquation.symmetric} />
            </div>
            <div style={{ color: COLORS.textMuted, fontSize: '12px' }}>
              方向向量 <TeX math={lineEquation.directionVector} />
            </div>
          </>
        ) : (
          <div style={{ color: COLORS.textPlaceholder, fontSize: '12px' }}>
            暂无坐标系，创建坐标系后显示方程
          </div>
        )}
      </div>

      {/* 样式编辑（仅用户线段） */}
      {!builtIn && (
        <div className="space-y-2">
          {/* 颜色 */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm" style={{ color: COLORS.textMuted }}>颜色</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => handleColorChange(c.value)}
                className="w-5 h-5 rounded-full border-2"
                style={{
                  backgroundColor: c.value,
                  borderColor: style.color === c.value ? COLORS.primary : 'transparent',
                }}
                title={c.label}
              />
            ))}
          </div>

          {/* 虚实线 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={style.dashed}
              onChange={handleDashedToggle}
              className="rounded"
            />
            <span className="text-sm" style={{ color: COLORS.textMuted }}>虚线</span>
          </label>
        </div>
      )}
    </div>
  );
}

registerInspector('segment', SegmentInspector);

export { SegmentInspector };
