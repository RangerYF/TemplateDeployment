import { useMemo } from 'react';
import { computeCircumscribedSphere } from '@/engine/math/circumscribedSphere';
import { computeInscribedSphere, isInscribedSphereSupported, getInSphereConditionHint } from '@/engine/math/inscribedSphere';
import { isEscribedSphereSupported, findBuilderFaceIndex } from '@/engine/math/escribedSphere';
import { Switch } from '@/components/ui/switch';
import { TeX } from '@/components/ui/TeX';
import { COLORS } from '@/styles/tokens';
import type { GeometryProperties, ExSphereProperties } from '@/editor/entities/types';
import {
  useEntityStore,
  useHistoryStore,
  useUIStore,
  CreateEntityCommand,
  DeleteEntityCascadeCommand,
  UpdatePropertiesCommand,
} from '@/editor';
import { useSelectionStore } from '@/editor/store/selectionStore';

export function AuxiliaryTools() {
  const entitiesMap = useEntityStore((s) => s.entities);
  const activeGeometryId = useEntityStore((s) => s.activeGeometryId);
  const selectedIds = useSelectionStore((s) => s.selectedIds);

  // 外接球 Entity
  const circumSphereEntity = useMemo(() => {
    for (const e of Object.values(entitiesMap)) {
      if (e.type === 'circumSphere') return e;
    }
    return undefined;
  }, [entitiesMap]);

  // 内切球 Entity
  const inSphereEntity = useMemo(() => {
    for (const e of Object.values(entitiesMap)) {
      if (e.type === 'inSphere') return e;
    }
    return undefined;
  }, [entitiesMap]);

  // 旁切球 Entity
  const exSphereEntity = useMemo(() => {
    for (const e of Object.values(entitiesMap)) {
      if (e.type === 'exSphere') return e;
    }
    return undefined;
  }, [entitiesMap]);

  // 几何体类型
  const geometryType = useMemo(() => {
    if (!activeGeometryId) return undefined;
    const e = entitiesMap[activeGeometryId];
    return e?.type === 'geometry' ? (e.properties as GeometryProperties).geometryType : undefined;
  }, [activeGeometryId, entitiesMap]);

  const circumSphereAvailable = geometryType !== 'sphere';
  const inSphereAvailable = !!geometryType && isInscribedSphereSupported(geometryType);
  const exSphereAvailable = !!geometryType && isEscribedSphereSupported(geometryType);

  // 几何体参数
  const geometryParams = useMemo(() => {
    if (!activeGeometryId) return undefined;
    const e = entitiesMap[activeGeometryId];
    if (!e || e.type !== 'geometry') return undefined;
    return (e.properties as GeometryProperties).params;
  }, [activeGeometryId, entitiesMap]);

  // 外接球数据
  const circumSphereData = useMemo(() => {
    if (!circumSphereEntity || !circumSphereAvailable || !geometryType || !geometryParams) return null;
    return computeCircumscribedSphere(
      geometryType,
      geometryParams as unknown as Record<string, number>,
    );
  }, [circumSphereEntity, circumSphereAvailable, geometryType, geometryParams]);

  // 内切球数据
  const inSphereData = useMemo(() => {
    if (!inSphereEntity || !inSphereAvailable || !geometryType || !geometryParams) return null;
    return computeInscribedSphere(
      geometryType,
      geometryParams as unknown as Record<string, number>,
    );
  }, [inSphereEntity, inSphereAvailable, geometryType, geometryParams]);

  // 内切球参数条件提示（开关已开但参数不满足时）
  const inSphereHint = useMemo(() => {
    if (!inSphereEntity || !geometryType || !geometryParams) return null;
    if (inSphereData) return null;
    return getInSphereConditionHint(
      geometryType,
      geometryParams as unknown as Record<string, number>,
    );
  }, [inSphereEntity, inSphereData, geometryType, geometryParams]);

  // 当前选中的面 → 对应的 builder face index
  const selectedFaceInfo = useMemo(() => {
    if (!activeGeometryId || !geometryType || !geometryParams || !exSphereAvailable) return null;
    for (const id of selectedIds) {
      const e = entitiesMap[id];
      if (e?.type !== 'face') continue;
      const fp = e.properties as { geometryId?: string; pointIds?: string[] };
      if (fp.geometryId !== activeGeometryId || !fp.pointIds) continue;
      const labels = fp.pointIds.map((pid) => {
        const p = entitiesMap[pid];
        return (p?.properties as { label?: string })?.label || '';
      });
      if (labels.includes('')) continue;
      const faceIndex = findBuilderFaceIndex(
        geometryType,
        geometryParams as unknown as Record<string, number>,
        labels,
      );
      if (faceIndex !== null) return { faceLabel: labels.join(''), faceIndex };
    }
    return null;
  }, [selectedIds, activeGeometryId, geometryType, geometryParams, exSphereAvailable, entitiesMap]);

  const showExSphereSection = !!exSphereEntity || !!selectedFaceInfo;

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
            checked={!!circumSphereEntity}
            onCheckedChange={(checked) => {
              if (checked && activeGeometryId) {
                useHistoryStore.getState().execute(
                  new CreateEntityCommand('circumSphere', { geometryId: activeGeometryId }),
                );
              } else if (!checked && circumSphereEntity) {
                useHistoryStore.getState().execute(
                  new DeleteEntityCascadeCommand(circumSphereEntity.id),
                );
              }
            }}
            disabled={!circumSphereAvailable}
          />
        </div>
        {!circumSphereAvailable && (
          <div className="text-sm" style={{ color: COLORS.textPlaceholder }}>
            球体无外接球
          </div>
        )}
        {circumSphereData && (
          <div className="text-sm" style={{ color: COLORS.textMuted }}>
            R = <TeX math={circumSphereData.radiusLatex} /> ≈ {circumSphereData.radius.toFixed(2)}
          </div>
        )}
        {circumSphereEntity && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm" style={{ color: COLORS.textMuted }}>显示辅助虚线</span>
            <Switch
              checked={!!(circumSphereEntity.properties as { showAuxLines?: boolean }).showAuxLines}
              onCheckedChange={(checked) => {
                useHistoryStore.getState().execute(
                  new UpdatePropertiesCommand<'circumSphere'>(
                    circumSphereEntity.id,
                    { showAuxLines: (circumSphereEntity.properties as { showAuxLines?: boolean }).showAuxLines },
                    { showAuxLines: checked },
                    '切换外接球辅助线',
                  ),
                );
              }}
            />
          </div>
        )}
      </div>

      {/* ── 内切球 ── */}
      <div>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 13, color: COLORS.text }}>
            内切球
          </span>
          <Switch
            checked={!!inSphereEntity}
            onCheckedChange={(checked) => {
              if (checked && activeGeometryId) {
                useHistoryStore.getState().execute(
                  new CreateEntityCommand('inSphere', { geometryId: activeGeometryId }),
                );
              } else if (!checked && inSphereEntity) {
                useHistoryStore.getState().execute(
                  new DeleteEntityCascadeCommand(inSphereEntity.id),
                );
              }
            }}
            disabled={!inSphereAvailable}
          />
        </div>
        {!inSphereAvailable && (
          <div className="text-sm" style={{ color: COLORS.textPlaceholder }}>
            该几何体不存在内切球
          </div>
        )}
        {inSphereData && (
          <div className="text-sm" style={{ color: COLORS.textMuted }}>
            r = <TeX math={inSphereData.radiusLatex} /> ≈ {inSphereData.radius.toFixed(2)}
          </div>
        )}
        {inSphereHint && (
          <div className="text-sm" style={{ color: COLORS.warning }}>
            当前参数下不存在严格内切球，{inSphereHint}
          </div>
        )}
        {inSphereEntity && inSphereData && (
          <div className="flex items-center justify-between mt-1">
            <span className="text-sm" style={{ color: COLORS.textMuted }}>显示辅助虚线</span>
            <Switch
              checked={!!(inSphereEntity.properties as { showAuxLines?: boolean }).showAuxLines}
              onCheckedChange={(checked) => {
                useHistoryStore.getState().execute(
                  new UpdatePropertiesCommand<'inSphere'>(
                    inSphereEntity.id,
                    { showAuxLines: (inSphereEntity.properties as { showAuxLines?: boolean }).showAuxLines },
                    { showAuxLines: checked },
                    '切换内切球辅助线',
                  ),
                );
              }}
            />
          </div>
        )}
      </div>

      {/* ── 旁切球（需选中面才出现） ── */}
      {showExSphereSection && (
        <div>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: 13, color: COLORS.text }}>
              旁切球
              {selectedFaceInfo && (
                <span style={{ color: COLORS.textMuted, fontSize: 11, marginLeft: 4 }}>
                  面{selectedFaceInfo.faceLabel}
                </span>
              )}
            </span>
            <Switch
              checked={!!exSphereEntity}
              onCheckedChange={(checked) => {
                if (checked && activeGeometryId && selectedFaceInfo) {
                  if (exSphereEntity) {
                    useHistoryStore.getState().execute(
                      new DeleteEntityCascadeCommand(exSphereEntity.id),
                    );
                  }
                  useHistoryStore.getState().execute(
                    new CreateEntityCommand('exSphere', {
                      geometryId: activeGeometryId,
                      faceIndex: selectedFaceInfo.faceIndex,
                    }),
                  );
                } else if (!checked && exSphereEntity) {
                  useHistoryStore.getState().execute(
                    new DeleteEntityCascadeCommand(exSphereEntity.id),
                  );
                }
              }}
            />
          </div>
          {exSphereEntity && selectedFaceInfo &&
            (exSphereEntity.properties as ExSphereProperties).faceIndex !== selectedFaceInfo.faceIndex && (
            <button
              className="text-xs mt-1 px-2 py-0.5 rounded"
              style={{
                background: `${COLORS.primary}15`,
                color: COLORS.primary,
                border: `1px solid ${COLORS.primary}40`,
                cursor: 'pointer',
              }}
              onClick={() => {
                useHistoryStore.getState().execute(
                  new DeleteEntityCascadeCommand(exSphereEntity.id),
                );
                useHistoryStore.getState().execute(
                  new CreateEntityCommand('exSphere', {
                    geometryId: activeGeometryId!,
                    faceIndex: selectedFaceInfo.faceIndex,
                  }),
                );
              }}
            >
              切换到面 {selectedFaceInfo.faceLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
