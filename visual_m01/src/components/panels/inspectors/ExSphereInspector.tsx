import { useMemo } from 'react';
import type { Entity, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor';
import { computeEscribedSpheres } from '@/engine/math/escribedSphere';
import { COLORS } from '@/styles/tokens';
import { registerInspector } from './registry';
import { InspectorHeader } from './InspectorCommon';

function ExSphereInspector({ entity }: { entity: Entity }) {
  const esEntity = entity as Entity<'exSphere'>;
  const { geometryId, faceIndex } = esEntity.properties;

  const geometryEntity = useEntityStore((s) => s.entities[geometryId]);

  const sphere = useMemo(() => {
    if (!geometryEntity || geometryEntity.type !== 'geometry') return null;
    const props = geometryEntity.properties as GeometryProperties;
    const all = computeEscribedSpheres(
      props.geometryType,
      props.params as unknown as Record<string, number>,
    );
    return all?.find((s) => s.faceIndex === faceIndex) ?? null;
  }, [geometryEntity, faceIndex]);

  return (
    <div className="space-y-2">
      <InspectorHeader
        entity={entity}
        typeName="旁切球"
        displayName={sphere ? `旁切球 · 面${sphere.faceLabel}` : '旁切球'}
        canDelete={true}
        deleteLabel="删除旁切球"
        canRename={false}
      />

      {sphere && (
        <div className="text-sm space-y-1" style={{ color: COLORS.textMuted }}>
          <div>
            对应面：<span style={{ fontWeight: 500, color: COLORS.text }}>{sphere.faceLabel}</span>
          </div>
          <div>半径：{sphere.radius.toFixed(4)}</div>
          <div>
            球心：({sphere.center[0].toFixed(2)}, {sphere.center[1].toFixed(2)}, {sphere.center[2].toFixed(2)})
          </div>
        </div>
      )}
      {!sphere && (
        <div className="text-sm" style={{ color: COLORS.warning }}>
          当前几何体不支持旁切球
        </div>
      )}
    </div>
  );
}

registerInspector('exSphere', ExSphereInspector);

export { ExSphereInspector };
