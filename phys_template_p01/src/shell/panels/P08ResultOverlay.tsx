import { useSimulationStore } from '@/store';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { getP08SceneSummary } from './p08SceneSummary';

interface P08ResultOverlayProps {
  presetId: string;
}

export function P08ResultOverlay({ presetId }: P08ResultOverlayProps) {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const result = useSimulationStore((s) => s.simulationState.currentResult);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const potentialProbeA = useSimulationStore((s) => s.potentialProbeA);
  const potentialProbeB = useSimulationStore((s) => s.potentialProbeB);

  const summary = getP08SceneSummary({
    presetId,
    entities,
    result,
    paramValues,
    potentialProbeA,
    potentialProbeB,
  });

  if (!summary.isP08 || summary.metrics.length === 0) return null;

  return (
    <aside
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        right: 12,
        bottom: 12,
        zIndex: 55,
        width: 320,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        boxShadow: SHADOWS.md,
        backdropFilter: 'blur(10px)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${COLORS.border}`,
          backgroundColor: COLORS.bg,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.primary }}>
          {summary.moduleTitle ?? 'P-08'} 实时结果
        </div>
        <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
          {summary.modelTitle}
        </div>
      </div>

      <div style={{ padding: 14 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
            gap: 10,
          }}
        >
          {summary.metrics.map((metric) => (
            <div
              key={metric.label}
              style={{
                padding: '10px 12px',
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                backgroundColor: COLORS.bgMuted,
              }}
            >
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>{metric.label}</div>
              <div style={{ marginTop: 4, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                {metric.value}
              </div>
            </div>
          ))}
        </div>

        {summary.potentialMeasurement && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: RADIUS.sm,
              backgroundColor: COLORS.primaryLight,
              border: `1px solid ${COLORS.primaryDisabled}`,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.primary }}>
              两点电势差
            </div>
            <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.6, color: COLORS.textSecondary }}>
              {summary.potentialMeasurement.prompt}
            </div>
            {summary.potentialMeasurement.deltaV && (
              <div style={{ marginTop: 6, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                ΔV = {summary.potentialMeasurement.deltaV}
              </div>
            )}
          </div>
        )}

        {summary.supportsPotentialMapControl && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: RADIUS.sm,
              backgroundColor: COLORS.bgMuted,
              fontSize: 11,
              lineHeight: 1.6,
              color: COLORS.textSecondary,
            }}
          >
            电场线看方向，等势线看等值，电势分布看整体高低变化。
          </div>
        )}

        {summary.explanation && (
          <div
            style={{
              marginTop: 12,
              fontSize: 11,
              lineHeight: 1.7,
              color: COLORS.textSecondary,
            }}
          >
            {summary.explanation}
          </div>
        )}
      </div>
    </aside>
  );
}
