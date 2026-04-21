import { useMemo } from 'react';
import { computeCircumscribedSphere } from '@/engine/math/circumscribedSphere';
import { Switch } from '@/components/ui/switch';
import { TeX } from '@/components/ui/TeX';
import { COLORS } from '@/styles/tokens';
import type { GeometryProperties } from '@/editor/entities/types';
import {
  useEntityStore,
  useHistoryStore,
  useUIStore,
  CreateEntityCommand,
  DeleteEntityCascadeCommand,
} from '@/editor';

export function AuxiliaryTools() {
  const entitiesMap = useEntityStore((s) => s.entities);
  const activeGeometryId = useEntityStore((s) => s.activeGeometryId);

  // 外接球 Entity
  const sphereEntity = useMemo(() => {
    for (const e of Object.values(entitiesMap)) {
      if (e.type === 'circumSphere') return e;
    }
    return undefined;
  }, [entitiesMap]);

  // 几何体类型
  const geometryType = useMemo(() => {
    if (!activeGeometryId) return undefined;
    const e = entitiesMap[activeGeometryId];
    return e?.type === 'geometry' ? (e.properties as GeometryProperties).geometryType : undefined;
  }, [activeGeometryId, entitiesMap]);

  const sphereAvailable = geometryType !== 'sphere';

  // 几何体参数
  const geometryParams = useMemo(() => {
    if (!activeGeometryId) return undefined;
    const e = entitiesMap[activeGeometryId];
    if (!e || e.type !== 'geometry') return undefined;
    return (e.properties as GeometryProperties).params;
  }, [activeGeometryId, entitiesMap]);

  // 外接球数据
  const sphereData = useMemo(() => {
    if (!sphereEntity || !sphereAvailable || !geometryType || !geometryParams) return null;
    return computeCircumscribedSphere(
      geometryType,
      geometryParams as unknown as Record<string, number>,
    );
  }, [sphereEntity, sphereAvailable, geometryType, geometryParams]);

  const unfoldingEnabled = useUIStore((s) => s.unfoldingEnabled);
  const setUnfoldingEnabled = useUIStore((s) => s.setUnfoldingEnabled);
  const threeViewEnabled = useUIStore((s) => s.threeViewEnabled);
  const setThreeViewEnabled = useUIStore((s) => s.setThreeViewEnabled);

  return (
    <div className="space-y-4">
      {/* ── 展开图 ── */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13, color: COLORS.text }}>
          展开图
        </span>
        <Switch checked={unfoldingEnabled} onCheckedChange={setUnfoldingEnabled} />
      </div>

      {/* ── 三视图 ── */}
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 13, color: COLORS.text }}>
          三视图
        </span>
        <Switch checked={threeViewEnabled} onCheckedChange={setThreeViewEnabled} />
      </div>

      {/* ── 外接球 ── */}
      <div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 13, color: COLORS.text }}>
            外接球
          </span>
          <Switch
            checked={!!sphereEntity}
            onCheckedChange={(checked) => {
              if (checked && activeGeometryId) {
                useHistoryStore.getState().execute(
                  new CreateEntityCommand('circumSphere', { geometryId: activeGeometryId }),
                );
              } else if (!checked && sphereEntity) {
                useHistoryStore.getState().execute(
                  new DeleteEntityCascadeCommand(sphereEntity.id),
                );
              }
            }}
            disabled={!sphereAvailable}
          />
        </div>
        {!sphereAvailable && (
          <div className="text-sm" style={{ color: COLORS.textPlaceholder }}>
            球体无外接球
          </div>
        )}
        {sphereData && (
          <div className="text-sm" style={{ color: COLORS.textMuted }}>
            R = <TeX math={sphereData.radiusLatex} /> ≈ {sphereData.radius.toFixed(2)}
          </div>
        )}
      </div>
    </div>
  );
}
