import type { ViewportType } from '@/core/types';
import { useSimulationStore } from '@/store';
import { RADIUS } from '@/styles/tokens';
import { getP08SceneTheme, getP08FloatingCardStyle, toAlpha } from '@/shell/p08/p08Theme';
import { getP08SceneSummary } from './p08SceneSummary';

const VIEWPORT_LABELS: Record<ViewportType, string> = {
  field: '场',
  motion: '运动',
  force: '受力',
  circuit: '电路',
  energy: '能量',
  momentum: '动量',
};

export function P08StageHeader({
  presetId,
  viewport,
}: {
  presetId: string;
  viewport: ViewportType;
}) {
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

  if (!summary.isP08) return null;

  const theme = getP08SceneTheme(presetId);
  const subtitle = summary.summary || summary.explanation || '按左侧参数与右侧结果区配合演示当前规律。';

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 54,
        width: 'min(560px, calc(100% - 220px))',
        maxWidth: 'calc(100% - 220px)',
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          ...getP08FloatingCardStyle(presetId),
          borderRadius: 24,
          padding: '10px 14px 12px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: RADIUS.full,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: toAlpha(theme.accent, 0.12),
                color: theme.accentStrong,
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {theme.marker}
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: theme.accentStrong,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {summary.moduleTitle ?? 'P-08'}
              </div>
              <div
                style={{
                  marginTop: 2,
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#132238',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {summary.modelTitle}
              </div>
            </div>
          </div>

          <div
            style={{
              padding: '6px 10px',
              borderRadius: RADIUS.pill,
              backgroundColor: toAlpha(theme.accent, 0.08),
              color: theme.accentStrong,
              fontSize: 11,
              fontWeight: 700,
              flexShrink: 0,
            }}
          >
            {VIEWPORT_LABELS[viewport]}视角
          </div>
        </div>

        <div
          style={{
            marginTop: 8,
            fontSize: 11,
            lineHeight: 1.6,
            color: '#4B5563',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {subtitle}
        </div>
      </div>
    </div>
  );
}
