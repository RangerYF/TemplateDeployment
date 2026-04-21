import { useSimulationStore } from '@/store';
import type { EntityId, Force, Vec2 } from '@/core/types';
import type { FloatingComponentProps } from '@/core/registries';
import {
  getForceInteractionState,
  setDecompositionTarget,
  clearDecomposition,
} from '../interactions/force-interaction-state';

/** 力是否沿坐标轴（夹角 < 5°） */
function isAlongAxis(force: Force, axis: Vec2): boolean {
  const dot = Math.abs(force.direction.x * axis.x + force.direction.y * axis.y);
  return dot > 0.996; // cos(5°) ≈ 0.9962
}

/** 生成力方向的自然语言描述 */
function describeDirection(dir: Vec2): string {
  const dx = dir.x;
  const dy = dir.y;
  const eps = 0.05;

  if (Math.abs(dx) < eps && dy < -eps) return '竖直向下';
  if (Math.abs(dx) < eps && dy > eps) return '竖直向上';
  if (dx > eps && Math.abs(dy) < eps) return '水平向右';
  if (dx < -eps && Math.abs(dy) < eps) return '水平向左';

  // 通用角度
  const angleDeg = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
  return `方向角 ${angleDeg}°`;
}

/**
 * 力浮动信息面板（力学域组件）
 * 显示力名称、数值、方向、分解选项
 */
export function ForcePopover({ data }: FloatingComponentProps) {
  const { entityId, forceIndex } = data as {
    entityId: EntityId;
    forceIndex: number;
  };

  const result = useSimulationStore((s) => s.simulationState.currentResult);
  if (!result) return null;

  const analysis = result.forceAnalyses.get(entityId);
  if (!analysis) return null;

  const force = analysis.forces[forceIndex];
  if (!force) return null;

  // 检查是否可分解
  const decomposition = analysis.decomposition;
  let canDecompose = false;
  if (decomposition) {
    const { axis1, axis2 } = decomposition;
    canDecompose = !isAlongAxis(force, axis1) && !isAlongAxis(force, axis2);
  }

  // 当前分解状态
  const interactionState = getForceInteractionState();
  const isDecomposing = interactionState.decompositionTarget?.entityId === entityId &&
    interactionState.decompositionTarget?.forceIndex === forceIndex &&
    interactionState.decompositionTarget?.direction === 'in';

  const handleDecompToggle = () => {
    if (isDecomposing) {
      clearDecomposition();
    } else {
      setDecompositionTarget(entityId, forceIndex);
    }
  };

  return (
    <div
      style={{
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        padding: '12px 16px',
        minWidth: '180px',
        maxWidth: '240px',
        fontSize: '13px',
        lineHeight: '1.6',
        border: '1px solid #E2E8F0',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* 标题行（拖拽手柄） */}
      <div
        data-drag-handle
        style={{
          fontWeight: 600,
          fontSize: '14px',
          color: '#1A202C',
          cursor: 'grab',
          userSelect: 'none',
          paddingBottom: '8px',
          marginBottom: '8px',
          borderBottom: '1px solid #E2E8F0',
        }}
      >
        {force.label} = {Number(force.magnitude.toFixed(1))} N
      </div>

      {/* 方向描述 */}
      <div style={{ color: '#64748B' }}>
        方向：{describeDirection(force.direction)}
      </div>

      {/* 分解选项 */}
      {canDecompose && (
        <>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              color: '#334155',
            }}
          >
            <input
              type="checkbox"
              checked={isDecomposing}
              onChange={handleDecompToggle}
              style={{ accentColor: '#3B82F6' }}
            />
            正交分解
          </label>
        </>
      )}
    </div>
  );
}
