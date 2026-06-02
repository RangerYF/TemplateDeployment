import { useMemo } from 'react';
import type { Entity, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore, useHistoryStore, UpdatePropertiesCommand } from '@/editor';
import { computeInscribedSphere, getInSphereConditionHint } from '@/engine/math/inscribedSphere';
import { Switch } from '@/components/ui/switch';
import { TeX } from '@/components/ui/TeX';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

function InSphereInspector({ entity }: { entity: Entity }) {
  const isEntity = entity as Entity<'inSphere'>;
  const { geometryId } = isEntity.properties;

  const geometryEntity = useEntityStore((s) => s.entities[geometryId]);

  const sphere = useMemo(() => {
    if (!geometryEntity || geometryEntity.type !== 'geometry') return null;
    const props = geometryEntity.properties as GeometryProperties;
    return computeInscribedSphere(
      props.geometryType,
      props.params as unknown as Record<string, number>,
    );
  }, [geometryEntity]);

  const conditionHint = useMemo(() => {
    if (sphere) return null;
    if (!geometryEntity || geometryEntity.type !== 'geometry') return null;
    const props = geometryEntity.properties as GeometryProperties;
    return getInSphereConditionHint(
      props.geometryType,
      props.params as unknown as Record<string, number>,
    );
  }, [sphere, geometryEntity]);

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName="内切球"
        displayName="内切球"
        canDelete={true}
        deleteLabel="删除内切球"
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
      {conditionHint && (
        <div className="text-sm" style={{ color: COLORS.warning }}>
          当前参数下不存在严格内切球，{conditionHint}
        </div>
      )}

      {sphere && (
        <div className="flex items-center justify-between">
          <span className="text-sm" style={{ color: COLORS.textMuted }}>显示辅助虚线</span>
          <Switch
            checked={!!isEntity.properties.showAuxLines}
            onCheckedChange={(checked) => {
              useHistoryStore.getState().execute(
                new UpdatePropertiesCommand<'inSphere'>(
                  isEntity.id,
                  { showAuxLines: isEntity.properties.showAuxLines },
                  { showAuxLines: checked },
                  '切换内切球辅助线',
                ),
              );
            }}
          />
        </div>
      )}
    </div>
  );
}

registerInspector('inSphere', InSphereInspector);

export { InSphereInspector };
