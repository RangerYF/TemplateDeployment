import { useMemo } from 'react';
import type { Entity, PointProperties } from '@/editor/entities/types';
import { useEntityStore, useHistoryStore, useToolStore, DeleteEntityCascadeCommand } from '@/editor';
import { computeCircumscribedCircle } from '@/engine/math/circumscribedCircle';
import { usePointPosition } from '@/components/scene/renderers/usePointPosition';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

function CircumCircleInspector({ entity }: { entity: Entity }) {
  const ccEntity = entity as Entity<'circumCircle'>;
  const [pid0, pid1, pid2] = ccEntity.properties.pointIds;

  const pointLabels = useEntityStore((s) => {
    const getLabel = (id: string) => {
      const e = s.entities[id];
      return e?.type === 'point' ? (e.properties as PointProperties).label : '?';
    };
    return [getLabel(pid0), getLabel(pid1), getLabel(pid2)];
  });

  const p0 = useEntityStore((s) => { const e = s.entities[pid0]; return e?.type === 'point' ? e as Entity<'point'> : undefined; });
  const p1 = useEntityStore((s) => { const e = s.entities[pid1]; return e?.type === 'point' ? e as Entity<'point'> : undefined; });
  const p2 = useEntityStore((s) => { const e = s.entities[pid2]; return e?.type === 'point' ? e as Entity<'point'> : undefined; });
  const pos0 = usePointPosition(p0);
  const pos1 = usePointPosition(p1);
  const pos2 = usePointPosition(p2);

  const circle = useMemo(() => {
    if (!pos0 || !pos1 || !pos2) return null;
    return computeCircumscribedCircle(pos0, pos1, pos2);
  }, [pos0, pos1, pos2]);

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName="外接圆"
        displayName="外接圆"
        canDelete={true}
        deleteLabel="删除外接圆"
        canRename={false}
      />

      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        定义点：
        <strong style={{ color: COLORS.text }}>
          {pointLabels[0]}, {pointLabels[1]}, {pointLabels[2]}
        </strong>
      </div>

      {circle && (
        <>
          <div className="text-sm" style={{ color: COLORS.textMuted }}>
            半径：<strong style={{ color: COLORS.text }}>{circle.radius.toFixed(4)}</strong>
          </div>
          <div className="text-sm" style={{ color: COLORS.textMuted }}>
            圆心：<strong style={{ color: COLORS.text }}>
              ({circle.center[0].toFixed(2)}, {circle.center[1].toFixed(2)}, {circle.center[2].toFixed(2)})
            </strong>
          </div>
        </>
      )}

      <button
        onClick={() => {
          useHistoryStore.getState().execute(
            new DeleteEntityCascadeCommand(ccEntity.id),
          );
          useToolStore.getState().setActiveTool('circumCircle');
        }}
        className="px-2 py-1 rounded text-sm"
        style={{
          background: COLORS.bgMuted,
          color: COLORS.textMuted,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        重新选点
      </button>
    </div>
  );
}

registerInspector('circumCircle', CircumCircleInspector);

export { CircumCircleInspector };
