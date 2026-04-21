import type { Entity, PointProperties } from '@/editor/entities/types';
import { useEntityStore, useHistoryStore, useToolStore, DeleteEntityCascadeCommand } from '@/editor';
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
