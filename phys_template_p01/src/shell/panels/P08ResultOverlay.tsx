import { useState } from 'react';
import { useSimulationStore } from '@/store';
import { COLORS, RADIUS } from '@/styles/tokens';
import { getP08SceneSummary } from './p08SceneSummary';
import { getP08FloatingCardStyle, getP08SceneTheme, toAlpha } from '@/shell/p08/p08Theme';

interface P08ResultOverlayProps {
  presetId: string;
}

export function P08ResultOverlay({ presetId }: P08ResultOverlayProps) {
  const [collapsed, setCollapsed] = useState(true);
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
  const theme = getP08SceneTheme(presetId);

  if (collapsed) {
    return (
      <button
        onClick={(event) => {
          event.stopPropagation();
          setCollapsed(false);
        }}
        style={{
          position: 'absolute',
          right: 16,
          bottom: 16,
          zIndex: 55,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderRadius: RADIUS.pill,
          color: COLORS.text,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 700,
          ...getP08FloatingCardStyle(presetId),
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: RADIUS.full,
            backgroundColor: theme.accent,
            boxShadow: `0 0 0 5px ${toAlpha(theme.accent, 0.12)}`,
          }}
        />
        实时结果
      </button>
    );
  }

  return (
    <aside
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        zIndex: 55,
        width: 320,
        borderRadius: RADIUS.md,
        overflow: 'hidden',
        ...getP08FloatingCardStyle(presetId),
      }}
    >
      <div
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${theme.border}`,
          background: `linear-gradient(180deg, ${toAlpha(theme.accent, 0.08)} 0%, rgba(255,255,255,0) 100%)`,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: theme.accentStrong }}>
            {summary.moduleTitle ?? 'P-08'} 实时结果
          </div>
          <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
            {summary.modelTitle}
          </div>
        </div>
        <button
          onClick={() => setCollapsed(true)}
          style={{
            border: 'none',
            background: 'none',
            color: theme.accentStrong,
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            padding: 0,
            flexShrink: 0,
          }}
        >
          收起
        </button>
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
                Δφ = {summary.potentialMeasurement.deltaV}
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
            电场线看方向，等势线看等值，电势分布看整体高低变化。左下角立体电势图支持拖拽旋转、滚轮缩放和一键重置视角。
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
