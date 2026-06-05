import { useState, useRef, useMemo, useCallback } from 'react';
import type { Entity, PointProperties, SegmentProperties, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore, useHistoryStore, UpdatePropertiesCommand } from '@/editor';
import { getBuilderResult } from '@/editor/builderCache';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { usePointPosition } from '@/components/scene/renderers/usePointPosition';
import { Slider } from '@/components/ui/slider';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

const CONSTRAINT_LABELS: Record<string, string> = {
  vertex: '顶点',
  edge: '棱上点',
  curve: '曲线上点',
  segment: '线段上点',
  coordinate: '坐标点',
  free: '自由点',
  face: '面上点',
};

/** 坐标编辑子组件，通过 key={coords.join(',')} 实现外部同步 */
function CoordEditor({
  entityId,
  constraint,
}: {
  entityId: string;
  constraint: PointProperties['constraint'] & { type: 'coordinate' };
}) {
  const coords = constraint.coords;
  const [editX, setEditX] = useState(coords[0].toString());
  const [editY, setEditY] = useState(coords[1].toString());
  const [editZ, setEditZ] = useState(coords[2].toString());

  const commitCoords = useCallback(() => {
    const x = parseFloat(editX);
    const y = parseFloat(editY);
    const z = parseFloat(editZ);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return;
    if (coords[0] === x && coords[1] === y && coords[2] === z) return;
    useHistoryStore.getState().execute(
      new UpdatePropertiesCommand(
        entityId,
        { constraint: { ...constraint, coords } },
        { constraint: { ...constraint, coords: [x, y, z] as [number, number, number] } },
      ),
    );
  }, [entityId, constraint, coords, editX, editY, editZ]);

  const coordInputStyle: React.CSSProperties = {
    width: 56,
    padding: '2px 4px',
    borderRadius: 3,
    border: `1px solid ${COLORS.border}`,
    fontSize: 12,
    textAlign: 'center',
    background: COLORS.bg,
    color: COLORS.text,
  };

  return (
    <div className="space-y-1">
      <div className="text-sm" style={{ color: COLORS.textMuted }}>坐标</div>
      <div className="flex items-center gap-1" style={{ fontSize: 12 }}>
        <span style={{ color: COLORS.textMuted }}>x</span>
        <input
          type="number"
          value={editX}
          onChange={(e) => setEditX(e.target.value)}
          onBlur={commitCoords}
          onKeyDown={(e) => e.key === 'Enter' && commitCoords()}
          style={coordInputStyle}
          step="0.1"
        />
        <span style={{ color: COLORS.textMuted }}>y</span>
        <input
          type="number"
          value={editY}
          onChange={(e) => setEditY(e.target.value)}
          onBlur={commitCoords}
          onKeyDown={(e) => e.key === 'Enter' && commitCoords()}
          style={coordInputStyle}
          step="0.1"
        />
        <span style={{ color: COLORS.textMuted }}>z</span>
        <input
          type="number"
          value={editZ}
          onChange={(e) => setEditZ(e.target.value)}
          onBlur={commitCoords}
          onKeyDown={(e) => e.key === 'Enter' && commitCoords()}
          style={coordInputStyle}
          step="0.1"
        />
      </div>
    </div>
  );
}

function PointInspector({ entity }: { entity: Entity }) {
  const ptEntity = entity as Entity<'point'>;
  const { builtIn, constraint, label } = ptEntity.properties;
  const position = usePointPosition(ptEntity);

  // 检查是否存在坐标系
  const entities = useEntityStore((s) => s.entities);
  const hasCoordSystem = useMemo(() => {
    return Object.values(entities).some((e) => e.type === 'coordinateSystem');
  }, [entities]);

  const isCoordPoint = constraint.type === 'coordinate';
  const hasSlider = constraint.type === 'edge' || constraint.type === 'curve' || constraint.type === 'segment';

  const segmentDisplayInfo = useMemo(() => {
    if (constraint.type !== 'segment') return null;
    const seg = entities[constraint.segmentId];
    if (!seg || seg.type !== 'segment') return null;
    const segProps = seg.properties as SegmentProperties;
    const startPt = entities[segProps.startPointId];
    const endPt = entities[segProps.endPointId];
    if (!startPt || startPt.type !== 'point' || !endPt || endPt.type !== 'point') return null;

    const startLabel = (startPt.properties as PointProperties).label;
    const endLabel = (endPt.properties as PointProperties).label;

    let segmentLength: number | null = null;
    const geoEntity = entities[segProps.geometryId];
    if (geoEntity && geoEntity.type === 'geometry') {
      const geoProps = geoEntity.properties as GeometryProperties;
      const result = getBuilderResult(segProps.geometryId, geoProps.geometryType, geoProps.params);
      if (result) {
        const startPos = computePointPosition(startPt.properties as PointProperties, result);
        const endPos = computePointPosition(endPt.properties as PointProperties, result);
        if (startPos && endPos) {
          const dx = endPos[0] - startPos[0], dy = endPos[1] - startPos[1], dz = endPos[2] - startPos[2];
          segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
        }
      }
    }

    return { startLabel, endLabel, segmentLength };
  }, [constraint, entities]);

  // t 值编辑（连续操作）
  const beforeTRef = useRef<number | null>(null);

  const handleTSliderChange = useCallback((newT: number) => {
    if (constraint.type !== 'edge' && constraint.type !== 'curve' && constraint.type !== 'segment') return;
    if (beforeTRef.current === null) {
      beforeTRef.current = constraint.t;
    }
    useEntityStore.getState().updateProperties(ptEntity.id, {
      constraint: { ...constraint, t: newT },
    });
  }, [ptEntity.id, constraint]);

  const handleTSliderCommit = useCallback((newT: number) => {
    if (beforeTRef.current === null) return;
    const oldConstraint = { ...constraint, t: beforeTRef.current };
    const newConstraint = { ...constraint, t: newT };
    useHistoryStore.getState().execute(
      new UpdatePropertiesCommand(
        ptEntity.id,
        { constraint: oldConstraint },
        { constraint: newConstraint },
      ),
    );
    beforeTRef.current = null;
  }, [ptEntity.id, constraint]);

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName="点"
        displayName={label}
        canDelete={!builtIn}
        deleteLabel="删除点"
      />

      {/* 约束类型 */}
      <div className="text-xs" style={{ color: COLORS.textMuted }}>
        {segmentDisplayInfo
          ? `位于线段 ${segmentDisplayInfo.startLabel}${segmentDisplayInfo.endLabel} 上`
          : `约束：${CONSTRAINT_LABELS[constraint.type] ?? constraint.type}`}
      </div>

      {/* 坐标点编辑 — key 驱动外部同步 */}
      {isCoordPoint && constraint.type === 'coordinate' && (
        <CoordEditor
          key={constraint.coords.join(',')}
          entityId={ptEntity.id}
          constraint={constraint}
        />
      )}

      {/* 位置坐标（仅在有坐标系时显示，坐标点已有编辑区不重复） */}
      {hasCoordSystem && !isCoordPoint && position && (
        <div className="text-sm" style={{ color: COLORS.textMuted }}>
          位置：({position[0].toFixed(2)}, {position[1].toFixed(2)}, {position[2].toFixed(2)})
        </div>
      )}

      {/* t 值滑块 */}
      {hasSlider && (constraint.type === 'edge' || constraint.type === 'curve' || constraint.type === 'segment') && (
        <div className="space-y-1">
          <div className="text-sm" style={{ color: COLORS.textMuted }}>
            {constraint.type === 'segment' && segmentDisplayInfo
              ? `位置：${Math.round(constraint.t * 100)}%` +
                (segmentDisplayInfo.segmentLength != null
                  ? `（距 ${segmentDisplayInfo.startLabel} 点 ${(constraint.t * segmentDisplayInfo.segmentLength).toFixed(2)}）`
                  : '')
              : `参数 t：${constraint.t.toFixed(3)}`}
          </div>
          <Slider
            value={[constraint.t]}
            onValueChange={([v]) => handleTSliderChange(v)}
            onValueCommit={([v]) => handleTSliderCommit(v)}
            min={0.01}
            max={0.99}
            step={0.01}
          />
        </div>
      )}

    </div>
  );
}

registerInspector('point', PointInspector);

export { PointInspector };
