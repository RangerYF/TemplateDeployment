import { useState, useRef, useMemo, useCallback } from 'react';
import type { Entity, PointProperties } from '@/editor/entities/types';
import { useEntityStore, useHistoryStore, UpdatePropertiesCommand } from '@/editor';
import { useAnimationStore, transientAnimationState } from '@/editor/store/animationStore';
import { usePointPosition } from '@/components/scene/renderers/usePointPosition';
import { Slider } from '@/components/ui/slider';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

const CONSTRAINT_LABELS: Record<string, string> = {
  vertex: '顶点',
  edge: '棱上点',
  curve: '曲线上点',
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
  const isAnimatable = constraint.type === 'edge' || constraint.type === 'curve';

  // 动画状态
  const playingPointId = useAnimationStore((s) => s.playingPointId);
  const animSpeed = useAnimationStore((s) => s.speed);
  const isPlaying = playingPointId === ptEntity.id;

  // t 值编辑（连续操作）
  const beforeTRef = useRef<number | null>(null);

  const handleTSliderChange = useCallback((newT: number) => {
    if (constraint.type !== 'edge' && constraint.type !== 'curve') return;
    // 手动拖动时自动暂停动画
    if (useAnimationStore.getState().playingPointId === ptEntity.id) {
      useAnimationStore.getState().pause();
    }
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

  const handlePlay = useCallback(() => {
    if (constraint.type !== 'edge' && constraint.type !== 'curve') return;
    if (isPlaying) {
      // 暂停：用 transient 的最新 t 值做最终同步和撤销命令
      const store = useAnimationStore.getState();
      const initialT = store.initialT;
      const finalT = transientAnimationState.pointId === ptEntity.id
        ? transientAnimationState.t
        : constraint.t;
      store.pause();
      // 最终同步到 store
      useEntityStore.getState().updateProperties(ptEntity.id, {
        constraint: { ...constraint, t: finalT },
      });
      if (initialT !== null && initialT !== finalT) {
        useHistoryStore.getState().execute(
          new UpdatePropertiesCommand(
            ptEntity.id,
            { constraint: { ...constraint, t: initialT } },
            { constraint: { ...constraint, t: finalT } },
          ),
        );
      }
    } else {
      useAnimationStore.getState().play(ptEntity.id, constraint.t);
    }
  }, [ptEntity.id, constraint, isPlaying]);

  const handleReset = useCallback(() => {
    if (constraint.type !== 'edge' && constraint.type !== 'curve') return;
    const store = useAnimationStore.getState();
    const initialT = store.initialT;
    const wasPlaying = store.playingPointId === ptEntity.id;
    if (wasPlaying) {
      store.reset();
    }
    // 重置到 t=0.5（中点位置）
    const resetT = initialT ?? 0.5;
    if (constraint.t !== resetT) {
      useHistoryStore.getState().execute(
        new UpdatePropertiesCommand(
          ptEntity.id,
          { constraint },
          { constraint: { ...constraint, t: resetT } },
        ),
      );
    }
  }, [ptEntity.id, constraint]);

  const handleSpeedChange = useCallback((newSpeed: number) => {
    useAnimationStore.getState().setSpeed(newSpeed);
  }, []);

  const btnStyle: React.CSSProperties = {
    padding: '3px 10px',
    borderRadius: 4,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bg,
    color: COLORS.text,
    fontSize: 12,
    cursor: 'pointer',
  };

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
        约束：{CONSTRAINT_LABELS[constraint.type] ?? constraint.type}
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

      {/* t 值编辑 */}
      {isAnimatable && (constraint.type === 'edge' || constraint.type === 'curve') && (
        <div className="space-y-1">
          <div className="text-sm" style={{ color: COLORS.textMuted }}>
            参数 t：{constraint.t.toFixed(3)}
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

      {/* 动点控制 */}
      {isAnimatable && (
        <div
          style={{
            padding: '6px 8px',
            borderRadius: 6,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bgHover,
          }}
          className="space-y-2"
        >
          <div className="text-xs font-medium" style={{ color: COLORS.textMuted }}>
            动点控制
          </div>

          {/* 播放/暂停 + 重置 */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePlay}
              style={{
                ...btnStyle,
                background: isPlaying ? '#ef4444' : '#3b82f6',
                color: '#fff',
                border: 'none',
              }}
            >
              {isPlaying ? '⏸ 暂停' : '▶ 播放'}
            </button>
            <button onClick={handleReset} style={btnStyle}>
              ⏹ 重置
            </button>
          </div>

          {/* 速度控制 */}
          <div className="space-y-1">
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              速度：{animSpeed.toFixed(1)}x
            </div>
            <Slider
              value={[animSpeed]}
              onValueChange={([v]) => handleSpeedChange(v)}
              min={0.1}
              max={3}
              step={0.1}
            />
          </div>
        </div>
      )}
    </div>
  );
}

registerInspector('point', PointInspector);

export { PointInspector };
