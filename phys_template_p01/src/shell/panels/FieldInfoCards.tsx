import { useState } from 'react';
import type { Entity } from '@/core/types';
import { useSimulationStore } from '@/store';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { isStaticElectrostaticScene } from '@/domains/em/logic/static-electrostatic-scene';
import { getP08SceneSummary } from './p08SceneSummary';

function InfoCard({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.96)',
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        boxShadow: SHADOWS.sm,
        overflow: 'hidden',
        minWidth: 260,
        maxWidth: 320,
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(8px)',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '8px 12px',
          border: 'none',
          background: 'none',
          cursor: 'pointer',
          color: COLORS.text,
          fontSize: 12,
          fontWeight: 600,
          borderBottom: open ? `1px solid ${COLORS.border}` : 'none',
          flexShrink: 0,
        }}
      >
        <span>{title}</span>
        <span style={{ color: COLORS.textMuted, fontSize: 10 }}>
          {open ? '▲ 收起' : '▼ 展开'}
        </span>
      </button>
      {open && <div style={{ padding: 12, overflowY: 'auto' }}>{children}</div>}
    </div>
  );
}

export function FieldInfoCards({
  entities,
  presetId,
}: {
  entities: Map<string, Entity>;
  presetId: string;
}) {
  const result = useSimulationStore((s) => s.simulationState.currentResult);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const potentialProbeA = useSimulationStore((s) => s.potentialProbeA);
  const potentialProbeB = useSimulationStore((s) => s.potentialProbeB);
  const duration = useSimulationStore((s) => s.simulationState.timeline.duration);

  const summary = getP08SceneSummary({
    presetId,
    entities,
    result,
    paramValues,
    potentialProbeA,
    potentialProbeB,
  });

  if (!summary.isP08 || isStaticElectrostaticScene(entities.values(), duration)) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        top: 12,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxHeight: 'calc(100% - 24px)',
        pointerEvents: 'auto',
      }}
    >
      <InfoCard title="课堂提示">
        <div style={{ fontSize: 11, fontWeight: 600, color: COLORS.primary }}>
          {summary.moduleTitle ?? 'P-08'}
        </div>
        <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: COLORS.text }}>
          {summary.modelTitle}
        </div>

        {summary.formula && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              borderRadius: RADIUS.xs,
              backgroundColor: COLORS.primaryLight,
              border: `1px solid ${COLORS.primaryDisabled}`,
              fontFamily: '"Courier New", monospace',
              fontSize: 12,
              color: COLORS.primary,
              fontWeight: 600,
            }}
          >
            {summary.formula}
          </div>
        )}

        {summary.keyParameters.length > 0 && (
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {summary.keyParameters.slice(0, 4).map((row) => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{row.label}</span>
                <span style={{ fontSize: 11, color: COLORS.text, fontWeight: 500, textAlign: 'right' }}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {summary.potentialMeasurement && (
          <div
            style={{
              marginTop: 10,
              padding: '8px 10px',
              borderRadius: RADIUS.xs,
              backgroundColor: COLORS.bgMuted,
              fontSize: 11,
              lineHeight: 1.6,
              color: COLORS.textSecondary,
            }}
          >
            {summary.potentialMeasurement.prompt}
          </div>
        )}

        {summary.explanation && (
          <div style={{ marginTop: 10, fontSize: 11, lineHeight: 1.7, color: COLORS.textSecondary }}>
            {summary.explanation}
          </div>
        )}
      </InfoCard>
    </div>
  );
}
