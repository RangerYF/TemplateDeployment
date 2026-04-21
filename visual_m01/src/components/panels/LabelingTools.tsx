import { useMemo } from 'react';
import { useEntityStore, useHistoryStore, DeleteEntityCascadeCommand } from '@/editor';
import type { Entity, PointProperties, SegmentProperties } from '@/editor/entities/types';
import { COLORS } from '@/styles/tokens';

const CONSTRAINT_LABELS: Record<string, string> = {
  vertex: '顶点',
  edge: '棱上',
  curve: '曲线上',
  coordinate: '坐标',
  free: '自由',
};

export function LabelingTools() {
  const entities = useEntityStore((s) => s.entities);

  // 用户创建的点（非 builtIn）
  const userPoints = useMemo(() => {
    return Object.values(entities).filter((e): e is Entity<'point'> => {
      if (e.type !== 'point') return false;
      return !(e.properties as PointProperties).builtIn;
    });
  }, [entities]);

  // 有标签的线段（builtIn 有标签 + 用户线段）
  const labeledSegments = useMemo(() => {
    return Object.values(entities).filter((e): e is Entity<'segment'> => {
      if (e.type !== 'segment') return false;
      const props = e.properties as SegmentProperties;
      return !props.builtIn || (props.label != null && props.label.length > 0);
    });
  }, [entities]);

  // 获取点标签
  const getPointLabel = (pointId: string): string => {
    const pt = useEntityStore.getState().getEntity(pointId);
    return pt?.type === 'point' ? (pt.properties as PointProperties).label : '?';
  };

  return (
    <div className="space-y-3">
      <p className="text-sm" style={{ color: COLORS.textMuted }}>
        右键点击线段或曲线，可取点、命名
      </p>

      {/* 已命名的线段列表 */}
      {labeledSegments.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium" style={{ color: COLORS.textMuted }}>
            已命名线段
          </p>
          {labeledSegments.map((seg) => {
            const props = seg.properties as SegmentProperties;
            const startLabel = getPointLabel(props.startPointId);
            const endLabel = getPointLabel(props.endPointId);
            return (
              <div
                key={seg.id}
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ background: COLORS.bgMuted }}
              >
                <span className="text-sm font-semibold" style={{ color: '#f59e0b' }}>
                  {props.label || `${startLabel}${endLabel}`}
                </span>
                <span className="text-sm" style={{ color: COLORS.textMuted }}>
                  {startLabel}—{endLabel}
                </span>
                {!props.builtIn && (
                  <button
                    onClick={() => {
                      useHistoryStore.getState().execute(
                        new DeleteEntityCascadeCommand(seg.id),
                      );
                    }}
                    className="text-sm px-2 py-1 rounded hover:bg-red-100"
                    style={{ color: COLORS.textMuted }}
                  >
                    ×
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 用户创建的点列表 */}
      {userPoints.length > 0 && (
        <div className="space-y-1">
          <p className="text-sm font-medium" style={{ color: COLORS.textMuted }}>
            已添加的点
          </p>
          {userPoints.map((pt) => {
            const props = pt.properties as PointProperties;
            const constraintDesc = CONSTRAINT_LABELS[props.constraint.type] ?? props.constraint.type;
            let detail = constraintDesc;
            if (props.constraint.type === 'edge') {
              detail = `棱上 t=${props.constraint.t.toFixed(2)}`;
            } else if (props.constraint.type === 'curve') {
              detail = `曲线上 t=${props.constraint.t.toFixed(2)}`;
            }
            return (
              <div
                key={pt.id}
                className="flex items-center justify-between px-2 py-1 rounded"
                style={{ background: COLORS.bgMuted }}
              >
                <span className="text-sm font-semibold" style={{ color: '#ef4444' }}>
                  {props.label}
                </span>
                <span className="text-sm" style={{ color: COLORS.textMuted }}>
                  {detail}
                </span>
                <button
                  onClick={() => {
                    useHistoryStore.getState().execute(
                      new DeleteEntityCascadeCommand(pt.id),
                    );
                  }}
                  className="text-sm px-2 py-1 rounded hover:bg-red-100"
                  style={{ color: COLORS.textMuted }}
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
