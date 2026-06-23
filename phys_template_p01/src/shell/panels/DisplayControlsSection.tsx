import { useSimulationStore } from '@/store';
import { COLORS, RADIUS } from '@/styles/tokens';
import { getP08SceneSummary } from './p08SceneSummary';

export function DisplayControlsSection({ presetId }: { presetId: string }) {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const result = useSimulationStore((s) => s.simulationState.currentResult);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const potentialProbeA = useSimulationStore((s) => s.potentialProbeA);
  const potentialProbeB = useSimulationStore((s) => s.potentialProbeB);
  const showFieldLines = useSimulationStore((s) => s.showFieldLines);
  const showEquipotentialLines = useSimulationStore((s) => s.showEquipotentialLines);
  const showPotentialMap = useSimulationStore((s) => s.showPotentialMap);
  const fieldLineDensity = useSimulationStore((s) => s.fieldLineDensity);
  const showTrajectory = useSimulationStore((s) => s.showTrajectory);
  const toggleFieldLines = useSimulationStore((s) => s.toggleFieldLines);
  const toggleEquipotentialLines = useSimulationStore((s) => s.toggleEquipotentialLines);
  const togglePotentialMap = useSimulationStore((s) => s.togglePotentialMap);
  const setFieldLineDensity = useSimulationStore((s) => s.setFieldLineDensity);
  const toggleTrajectory = useSimulationStore((s) => s.toggleTrajectory);
  const clearPotentialProbes = useSimulationStore((s) => s.clearPotentialProbes);

  const summary = getP08SceneSummary({
    presetId,
    entities,
    result,
    paramValues,
    potentialProbeA,
    potentialProbeB,
  });

  if (!summary.isP08) return null;

  const hasControls =
    summary.supportsFieldLineControls ||
    summary.supportsEquipotentialControls ||
    summary.supportsPotentialMapControl ||
    summary.supportsFieldDensityControl ||
    summary.supportsTrajectoryControl ||
    summary.supportsPotentialDifference;

  if (!hasControls) return null;

  const hasProbe = Boolean(potentialProbeA || potentialProbeB);

  return (
    <details open>
      <summary
        className="cursor-pointer select-none list-none text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--theme-text-muted)', letterSpacing: '0.06em' }}
      >
        显示设置
      </summary>

      <div className="mt-3 space-y-3">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {summary.supportsFieldLineControls && (
            <ToggleChip label="电场线" active={showFieldLines} onClick={toggleFieldLines} />
          )}
          {summary.supportsEquipotentialControls && (
            <ToggleChip label="等势线" active={showEquipotentialLines} onClick={toggleEquipotentialLines} />
          )}
          {summary.supportsPotentialMapControl && (
            <ToggleChip label="电势分布" active={showPotentialMap} onClick={togglePotentialMap} />
          )}
          {summary.supportsTrajectoryControl && (
            <ToggleChip label="轨迹留存" active={showTrajectory} onClick={toggleTrajectory} />
          )}
        </div>

        {summary.supportsFieldDensityControl && (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
              场线密度
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <DensityChip label="疏" active={fieldLineDensity === 'sparse'} onClick={() => setFieldLineDensity('sparse')} />
              <DensityChip label="标准" active={fieldLineDensity === 'standard'} onClick={() => setFieldLineDensity('standard')} />
              <DensityChip label="密" active={fieldLineDensity === 'dense'} onClick={() => setFieldLineDensity('dense')} />
            </div>
          </div>
        )}

        {summary.supportsPotentialMapControl && (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.text, marginBottom: 6 }}>
              图层说明
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              <LegendRow
                color="linear-gradient(90deg, #3182CE 0%, #E2E8F0 50%, #E53E3E 100%)"
                label="电势分布"
                text="红/橙为正电势高区，蓝为负电势低区。"
              />
              <LegendRow color="#E53E3E" label="电场线" text="箭头指向正试探电荷受力方向。" />
              <LegendRow color="#27AE60" label="等势线" text="沿线移动时电势不变。" />
            </div>
          </div>
        )}

        {summary.supportsPotentialDifference && (
          <div style={{ paddingTop: 8, borderTop: `1px solid ${COLORS.border}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text }}>两点电势差</span>
              <button
                onClick={clearPotentialProbes}
                style={{
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.xs,
                  backgroundColor: COLORS.bg,
                  color: COLORS.textSecondary,
                  fontSize: 11,
                  padding: '3px 8px',
                  cursor: 'pointer',
                }}
              >
                {hasProbe ? '清空 A/B' : '重置测点'}
              </button>
            </div>
            <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6, color: COLORS.textMuted }}>
              {summary.potentialMeasurement?.prompt ?? '点击画布依次放置 A / B 点。'}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}

function LegendRow({ color, label, text }: { color: string; label: string; text: string }) {
  const isGradient = color.startsWith('linear-gradient');
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 8, alignItems: 'start' }}>
      <div
        style={{
          height: 10,
          marginTop: 4,
          borderRadius: RADIUS.pill,
          border: `1px solid ${COLORS.border}`,
          background: isGradient ? color : undefined,
          backgroundColor: isGradient ? undefined : color,
        }}
      />
      <div style={{ fontSize: 11, lineHeight: 1.5, color: COLORS.textMuted }}>
        <span style={{ color: COLORS.text, fontWeight: 600 }}>{label}</span> {text}
      </div>
    </div>
  );
}

function ToggleChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        borderRadius: RADIUS.pill,
        backgroundColor: active ? COLORS.primaryLight : COLORS.bg,
        color: active ? COLORS.primary : COLORS.textSecondary,
        fontSize: 11,
        fontWeight: 500,
        padding: '5px 10px',
        cursor: 'pointer',
      }}
    >
      {label}：{active ? '显示' : '隐藏'}
    </button>
  );
}

function DensityChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        borderRadius: RADIUS.pill,
        backgroundColor: active ? COLORS.primaryLight : COLORS.bg,
        color: active ? COLORS.primary : COLORS.textSecondary,
        fontSize: 11,
        fontWeight: 500,
        padding: '5px 0',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
