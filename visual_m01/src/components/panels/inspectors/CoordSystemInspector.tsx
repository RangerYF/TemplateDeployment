import type { Entity, PointProperties } from '@/editor/entities/types';
import { useEntityStore, useToolStore } from '@/editor';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

function CoordSystemInspector({ entity }: { entity: Entity }) {
  const csEntity = entity as Entity<'coordinateSystem'>;
  const { originPointId } = csEntity.properties;

  const originLabel = useEntityStore((s) => {
    const pt = s.entities[originPointId];
    return pt?.type === 'point' ? (pt.properties as PointProperties).label : '?';
  });

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName="坐标系"
        displayName="坐标系"
        canDelete={true}
        deleteLabel="删除坐标系"
        canRename={false}
      />

      <div className="text-sm" style={{ color: COLORS.textMuted }}>
        原点：<strong style={{ color: COLORS.text }}>{originLabel}</strong>
      </div>

      <button
        onClick={() => useToolStore.getState().setActiveTool('coordSystem')}
        className="px-2 py-1 rounded text-sm"
        style={{
          background: COLORS.bgMuted,
          color: COLORS.textMuted,
          border: `1px solid ${COLORS.border}`,
        }}
      >
        重选原点
      </button>
    </div>
  );
}

registerInspector('coordinateSystem', CoordSystemInspector);

export { CoordSystemInspector };
