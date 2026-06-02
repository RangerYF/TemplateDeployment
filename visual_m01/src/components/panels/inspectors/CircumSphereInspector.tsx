import { useMemo } from 'react';
import type { Entity, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore, useHistoryStore, UpdatePropertiesCommand } from '@/editor';
import { computeCircumscribedSphere } from '@/engine/math/circumscribedSphere';
import { Switch } from '@/components/ui/switch';
import { TeX } from '@/components/ui/TeX';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

function CircumSphereInspector({ entity }: { entity: Entity }) {
  const csEntity = entity as Entity<'circumSphere'>;
  const { geometryId } = csEntity.properties;

  // 只取稳定引用，不在 selector 中创建新对象
  const geometryEntity = useEntityStore((s) => s.entities[geometryId]);

  const sphere = useMemo(() => {
    if (!geometryEntity || geometryEntity.type !== 'geometry') return null;
    const props = geometryEntity.properties as GeometryProperties;
    return computeCircumscribedSphere(
      props.geometryType,
      props.params as unknown as Record<string, number>,
    );
  }, [geometryEntity]);

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName="外接球"
        displayName="外接球"
        canDelete={true}
        deleteLabel="删除外接球"
        canRename={false}
      />

      {sphere && (
        <div className="text-sm space-y-1" style={{ color: COLORS.textMuted }}>
          <div>
            半径：<TeX math={sphere.radiusLatex} /> ≈ {sphere.radius.toFixed(4)}
          </div>
          <div>
            球心：({sphere.center[0].toFixed(2)}, {sphere.center[1].toFixed(2)}, {sphere.center[2].toFixed(2)})
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-sm" style={{ color: COLORS.textMuted }}>显示辅助虚线</span>
        <Switch
          checked={!!csEntity.properties.showAuxLines}
          onCheckedChange={(checked) => {
            useHistoryStore.getState().execute(
              new UpdatePropertiesCommand<'circumSphere'>(
                csEntity.id,
                { showAuxLines: csEntity.properties.showAuxLines },
                { showAuxLines: checked },
                '切换外接球辅助线',
              ),
            );
          }}
        />
      </div>
    </div>
  );
}

registerInspector('circumSphere', CircumSphereInspector);

export { CircumSphereInspector };
