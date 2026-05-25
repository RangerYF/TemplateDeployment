import { useState } from 'react';
import { useSimulationStore } from '@/store';
import { COLORS, RADIUS } from '@/styles/tokens';
import { getP08SceneSummary } from './p08SceneSummary';
import { getP08FloatingCardStyle, getP08SceneTheme, toAlpha } from '@/shell/p08/p08Theme';

interface P08DisplayControlsProps {
  presetId: string;
}

export function P08DisplayControls({ presetId }: P08DisplayControlsProps) {
  const [collapsed, setCollapsed] = useState(false);
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
          top: 16,
          right: 16,
          zIndex: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderRadius: RADIUS.pill,
          color: theme.accentStrong,
          cursor: 'pointer',
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
        <span style={{ fontSize: 12, fontWeight: 700 }}>显示与测量</span>
      </button>
    );
  }

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 60,
        width: 260,
        padding: 12,
        borderRadius: RADIUS.md,
        ...getP08FloatingCardStyle(presetId),
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: COLORS.text,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
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
          显示与测量
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
          }}
        >
          收起
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {summary.supportsFieldLineControls && (
          <ToggleChip
            label="电场线"
            active={showFieldLines}
            onClick={toggleFieldLines}
          />
        )}
        {summary.supportsEquipotentialControls && (
          <ToggleChip
            label="等势线"
            active={showEquipotentialLines}
            onClick={toggleEquipotentialLines}
          />
        )}
        {summary.supportsPotentialMapControl && (
          <ToggleChip
            label="电势分布"
            active={showPotentialMap}
            onClick={togglePotentialMap}
          />
        )}
        {summary.supportsTrajectoryControl && (
          <ToggleChip
            label="轨迹留存"
            active={showTrajectory}
            onClick={toggleTrajectory}
          />
        )}
      </div>

      {summary.supportsFieldDensityControl && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            场线密度
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <DensityChip
              label="疏"
              active={fieldLineDensity === 'sparse'}
              onClick={() => setFieldLineDensity('sparse')}
            />
            <DensityChip
              label="标准"
              active={fieldLineDensity === 'standard'}
              onClick={() => setFieldLineDensity('standard')}
            />
            <DensityChip
              label="密"
              active={fieldLineDensity === 'dense'}
              onClick={() => setFieldLineDensity('dense')}
            />
          </div>
        </div>
      )}

      {summary.supportsPotentialMapControl && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: COLORS.text,
              marginBottom: 8,
            }}
          >
            图层说明
          </div>
          <div style={{ display: 'grid', gap: 6 }}>
            <LegendRow
              color="linear-gradient(90deg, #3182CE 0%, #E2E8F0 50%, #E53E3E 100%)"
              label="电势分布"
              text="整体高低变化；红/橙更接近正电势高区，蓝更接近负电势低区。"
            />
            <LegendRow
              color="#E53E3E"
              label="电场线"
              text="看受力方向，箭头指向正试探电荷受力方向。"
            />
            <LegendRow
              color="#27AE60"
              label="等势线"
              text="看同一电势值；沿线移动时电势不变。"
            />
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 10,
              lineHeight: 1.6,
              color: COLORS.textMuted,
            }}
          >
            左下角立体电势图可拖拽旋转，滚轮缩放，右上角按钮可重置视角。
          </div>
        </div>
      )}

      {summary.supportsPotentialDifference && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: COLORS.text }}>
              两点电势差
            </span>
            <button
              onClick={clearPotentialProbes}
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.xs,
                backgroundColor: COLORS.bg,
                color: COLORS.textSecondary,
                fontSize: 11,
                padding: '4px 8px',
                cursor: 'pointer',
              }}
            >
              {hasProbe ? '清空 A/B' : '重置测点'}
            </button>
          </div>
          <div
            style={{
              marginTop: 6,
              fontSize: 11,
              lineHeight: 1.6,
              color: COLORS.textMuted,
            }}
          >
            {summary.potentialMeasurement?.prompt ?? '点击画布依次放置 A / B 点。'}
          </div>
        </div>
      )}
    </div>
  );
}

function LegendRow({
  color,
  label,
  text,
}: {
  color: string;
  label: string;
  text: string;
}) {
  const isGradient = color.startsWith('linear-gradient');

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '56px 1fr',
        gap: 8,
        alignItems: 'start',
      }}
    >
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
        <span style={{ color: COLORS.text, fontWeight: 600 }}>{label}</span>
        {' '}
        {text}
      </div>
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        borderRadius: RADIUS.pill,
        backgroundColor: active ? COLORS.primaryLight : COLORS.bg,
        color: active ? COLORS.primary : COLORS.textSecondary,
        fontSize: 12,
        fontWeight: 500,
        padding: '6px 12px',
        cursor: 'pointer',
      }}
    >
      {label}：{active ? '显示' : '隐藏'}
    </button>
  );
}

function DensityChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        borderRadius: RADIUS.pill,
        backgroundColor: active ? COLORS.primaryLight : COLORS.bg,
        color: active ? COLORS.primary : COLORS.textSecondary,
        fontSize: 12,
        fontWeight: 500,
        padding: '6px 0',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}
