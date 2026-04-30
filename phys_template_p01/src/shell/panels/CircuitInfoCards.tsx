import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import type { Entity } from '@/core/types';
import { simulator } from '@/core/engine/simulator';
import { useSimulationStore } from '@/store';
import {
  findByFamily,
  findComponent,
  getEffectiveResistance,
  isCurrentMeter,
  isFixedResistance,
  isVariableResistor,
} from '@/domains/em/logic/circuit-solver-utils';
import {
  getHalfDeflectionModeLabel,
  isHalfDeflectionCircuitType,
  type HalfDeflectionMode,
} from '@/domains/em/logic/half-deflection-calculator';
import { solveBulbOperatingPoint } from '@/domains/em/solvers/bulb-circuit';

// ─── 可折叠卡片容器 ───

function InfoCard({
  title,
  children,
  defaultOpen = false,
  style,
  forceOpenToken,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  style?: React.CSSProperties;
  forceOpenToken?: string | number | boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (forceOpenToken !== undefined) {
      setOpen(true);
    }
  }, [forceOpenToken]);

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        boxShadow: SHADOWS.sm,
        overflow: 'hidden',
        minWidth: 200,
        ...style,
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
        }}
      >
        <span>{title}</span>
        <span style={{ color: COLORS.textMuted, fontSize: 10, marginLeft: 8 }}>
          {open ? '▲ 收起' : '▼ 展开'}
        </span>
      </button>
      {open && <div style={{ padding: '8px 12px' }}>{children}</div>}
    </div>
  );
}

function syncCircuitPanelStore(): void {
  const simState = simulator.getState();
  const result = simulator.getCurrentResult();
  const store = useSimulationStore.getState();

  store.setParamValues({ ...simState.scene.paramValues });
  store.setSimulationState({ scene: simState.scene });
  store.setCurrentResult(result);
}

function applySimulatorParams(updates: Array<[string, number | boolean | string]>): void {
  for (const [key, value] of updates) {
    simulator.updateParam(key, value);
  }
  syncCircuitPanelStore();
}

function formatResistance(value: number | undefined, digits = 0): string {
  if (value === undefined || !Number.isFinite(value)) return '∞ Ω';
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(digits > 0 ? digits : 1)} kΩ`;
  }
  return `${value.toFixed(digits)} Ω`;
}

function formatCurrent(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.01) return `${(value * 1000).toFixed(2)} mA`;
  return `${value.toFixed(3)} A`;
}

function formatVoltage(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(3)} V`;
}

function formatPower(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '—';
  return `${value.toFixed(3)} W`;
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1.2, value));
}

function getHalfDeflectionMode(circuitType: string): HalfDeflectionMode {
  return circuitType === 'half-deflection-voltmeter' ? 'voltmeter' : 'ammeter';
}

interface CircuitMetricItem {
  label: string;
  value: string;
  highlighted?: boolean;
}

function CircuitMetricList({
  metrics,
}: {
  metrics: CircuitMetricItem[];
}) {
  return (
    <div
      style={{
        borderRadius: RADIUS.sm,
        border: `1px solid ${COLORS.border}`,
        overflow: 'hidden',
        backgroundColor: COLORS.bg,
      }}
    >
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 14,
            padding: '8px 10px',
            borderTop: index === 0 ? 'none' : `1px solid ${COLORS.border}`,
            backgroundColor: metric.highlighted ? COLORS.primaryLight : COLORS.bg,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: metric.highlighted ? COLORS.primary : COLORS.textSecondary,
            }}
          >
            {metric.label}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: metric.highlighted ? COLORS.primary : COLORS.text,
              textAlign: 'right',
            }}
          >
            {metric.value}
          </span>
        </div>
      ))}
    </div>
  );
}

interface ExperimentDataRow {
  key: string | number;
  cells: React.ReactNode[];
}

interface ExperimentDataListItem {
  key: string | number;
  title: string;
  subtitle?: string;
  metrics: CircuitMetricItem[];
}

function ExperimentDataTable({
  columns,
  rows,
  emptyText = '暂无采样数据',
}: {
  columns: string[];
  rows: ExperimentDataRow[];
  emptyText?: string;
}) {
  if (rows.length === 0) {
    return (
      <div
        style={{
          borderRadius: RADIUS.sm,
          border: `1px dashed ${COLORS.border}`,
          backgroundColor: COLORS.bgMuted,
          padding: '10px 12px',
          fontSize: 10,
          color: COLORS.textMuted,
          textAlign: 'center',
        }}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div
      style={{
        borderRadius: RADIUS.sm,
        border: `1px solid ${COLORS.border}`,
        overflow: 'hidden',
        backgroundColor: COLORS.bg,
      }}
    >
      <div style={{ overflowX: 'auto', maxHeight: 220, overflowY: 'auto' }}>
        <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr style={{ backgroundColor: COLORS.bgMuted }}>
              {columns.map((column) => (
                <th
                  key={column}
                  style={{
                    padding: '7px 8px',
                    borderBottom: `1px solid ${COLORS.border}`,
                    color: COLORS.textSecondary,
                    fontWeight: 600,
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr
                key={row.key}
                style={{
                  backgroundColor: rowIndex % 2 === 0 ? COLORS.bg : COLORS.bgMuted,
                }}
              >
                {row.cells.map((cell, cellIndex) => (
                  <td
                    key={`${row.key}-${cellIndex}`}
                    style={{
                      padding: '7px 8px',
                      borderBottom:
                        rowIndex === rows.length - 1 ? 'none' : `1px solid ${COLORS.border}`,
                      color: COLORS.text,
                      verticalAlign: 'top',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExperimentDataList({
  items,
  emptyText = '暂无采样数据',
}: {
  items: ExperimentDataListItem[];
  emptyText?: string;
}) {
  if (items.length === 0) {
    return (
      <div
        style={{
          borderRadius: RADIUS.sm,
          border: `1px dashed ${COLORS.border}`,
          backgroundColor: COLORS.bgMuted,
          padding: '10px 12px',
          fontSize: 10,
          color: COLORS.textMuted,
          textAlign: 'center',
        }}
      >
        {emptyText}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
      {items.map((item) => (
        <div
          key={item.key}
          style={{
            borderRadius: RADIUS.sm,
            border: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.bg,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '8px 10px',
              borderBottom: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.bgMuted,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.text }}>{item.title}</div>
            {item.subtitle && (
              <div style={{ marginTop: 2, fontSize: 10, color: COLORS.textSecondary }}>{item.subtitle}</div>
            )}
          </div>
          <CircuitMetricList metrics={item.metrics} />
        </div>
      ))}
    </div>
  );
}

// ─── 公式推导卡片 ───

function FormulaCard({ circuitType, source }: { circuitType: string; source: Entity }) {
  const formulas = getFormulasForCircuit(circuitType, source);
  if (formulas.length === 0) return null;

  return (
    <InfoCard title="公式推导">
      {formulas.map((line, i) => (
        <div
          key={i}
          style={{
            fontFamily: '"Courier New", monospace',
            fontSize: 11,
            color: COLORS.text,
            lineHeight: 1.6,
          }}
        >
          {line}
        </div>
      ))}
    </InfoCard>
  );
}

// ─── 步骤引导卡片 ───

function StepGuideCard({ circuitType, source }: { circuitType: string; source: Entity }) {
  const lines = getStepGuideLines(circuitType, source);
  if (lines.length === 0) return null;

  return (
    <InfoCard title="步骤引导">
      {lines.map((line, i) => (
        <div
          key={i}
          style={{
            fontSize: 11,
            color: line.color,
            fontWeight: line.bold ? 600 : 400,
            lineHeight: 1.6,
          }}
        >
          {line.text}
        </div>
      ))}
    </InfoCard>
  );
}

export function OhmmeterTeachingCard({
  source,
  entities,
}: {
  source: Entity;
  entities: Map<string, Entity>;
}) {
  const rheostat = findComponent(entities, 'slide-rheostat');
  const R_mid = (source.properties.R_mid as number) ?? 0;
  const currentRx =
    (source.properties.currentRx as number | undefined) ??
    (source.properties.trueRx as number | undefined);
  const rawDeflectionRatio = (source.properties.deflectionRatio as number) ?? 0;
  const deflectionRatio = clampRatio(rawDeflectionRatio);
  const isMidResistance = Boolean(source.properties.isMidResistance);
  const isHalfDeflection = Boolean(source.properties.isHalfDeflection);
  const isZeroed = Boolean(source.properties.isZeroed);
  const midTolerance = (source.properties.midTolerance as number) ?? 1;
  const currentI = (source.properties.totalCurrent as number | undefined) ?? 0;
  const canZero = Boolean(source.properties.canZero);
  const zeroingThetaAtRxZero = (source.properties.zeroingThetaAtRxZero as number | undefined) ?? 0;
  const currentHalfDeflectionResistance =
    (source.properties.currentHalfDeflectionResistance as number | undefined) ?? 0;
  const zeroedSeriesResistance =
    (source.properties.zeroedSeriesResistance as number | undefined) ?? 0;
  const batteryInternalResistance =
    (source.properties.batteryInternalResistance as number | undefined) ?? 0;

  const angleForRatio = (ratio: number) => 160 + clampRatio(ratio) * (20 - 160);
  const polar = (angleDeg: number, radius: number, cx: number, cy: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
  };
  const resistanceToRatio = (resistance: number) => {
    if (!Number.isFinite(resistance)) return 0;
    if (R_mid <= 0) return 0;
    return clampRatio(R_mid / Math.max(R_mid + Math.max(resistance, 0), 1e-6));
  };

  const handleSetMidResistance = useCallback(() => {
    if (!Number.isFinite(R_mid) || R_mid <= 0) return;

    const updates: Array<[string, number | boolean | string]> = [];
    const maxResistance = (rheostat?.properties.maxResistance as number | undefined) ?? 0;

    if (canZero && maxResistance > 0 && Number.isFinite(zeroedSeriesResistance)) {
      const targetAdjRatio = Math.max(0.01, Math.min(1, zeroedSeriesResistance / maxResistance));
      updates.push(['adjRatio', targetAdjRatio]);
    }
    updates.push(['Rx', R_mid]);

    applySimulatorParams(updates);
  }, [R_mid, canZero, rheostat, zeroedSeriesResistance]);

  const scaleMarks = useMemo(() => {
    if (!Number.isFinite(R_mid) || R_mid <= 0) return [];
    return [
      { resistance: Number.POSITIVE_INFINITY, label: '∞' },
      { resistance: R_mid * 4, label: formatResistance(R_mid * 4) },
      { resistance: R_mid * 2, label: formatResistance(R_mid * 2) },
      { resistance: R_mid, label: 'R中' },
      { resistance: R_mid / 2, label: formatResistance(R_mid / 2) },
      { resistance: R_mid / 4, label: formatResistance(R_mid / 4) },
      { resistance: 0, label: '0' },
    ];
  }, [R_mid]);

  const arcPath = Array.from({ length: 33 }, (_, index) => {
    const angle = 160 + (index / 32) * (20 - 160);
    const point = polar(angle, 86, 170, 114);
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(' ');

  return (
    <InfoCard title="中值电阻半偏" defaultOpen style={{ minWidth: 372, maxWidth: 372 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.7 }}>
          调零的正确条件是短接表笔，即 Rx = 0 时调节 R0 使指针满偏。
          中值电阻定义为使指针半偏的被测电阻；理想调零后，R中 = Rg + r + R0。
          {!isZeroed && <span style={{ color: COLORS.warning }}> 当前未重新调零，设 Rx = R中 时不一定半偏。</span>}
        </div>

        <CircuitMetricList
          metrics={[
            {
              label: '当前被测电阻 Rx',
              value: formatResistance(currentRx, currentRx !== undefined && currentRx < 1000 ? 1 : 0),
              highlighted: isMidResistance,
            },
            {
              label: '中值电阻 R中',
              value: formatResistance(R_mid, R_mid < 1000 ? 1 : 0),
              highlighted: isMidResistance,
            },
            {
              label: '偏转比 θ',
              value: rawDeflectionRatio.toFixed(2),
              highlighted: isHalfDeflection,
            },
            {
              label: '回路电流 I',
              value: formatCurrent(currentI),
            },
          ]}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={() => { window.location.hash = 'ohmmeter-midpoint-compare'; }} style={experimentButtonStyle(false, true)}>
            专题对比
          </button>
          <button onClick={handleSetMidResistance} style={experimentButtonStyle(false)}>
            设 Rx = 中值电阻
          </button>
        </div>

        <div
          style={{
            borderRadius: RADIUS.sm,
            border: `1px solid ${isHalfDeflection ? COLORS.primary : COLORS.border}`,
            backgroundColor: isHalfDeflection ? COLORS.primaryLight : COLORS.bgMuted,
            padding: '8px 10px',
            color: isHalfDeflection ? COLORS.primary : COLORS.textSecondary,
            fontSize: 11,
            fontWeight: isHalfDeflection ? 700 : 500,
          }}
        >
          {isHalfDeflection && isMidResistance
            ? '当前为理想中值电阻，且指针半偏'
            : isMidResistance
              ? `Rx 已接近 R中（容差 ±${midTolerance.toFixed(0)}Ω），但当前 θ=${rawDeflectionRatio.toFixed(2)}`
              : `当前 Rx=0 时 θ=${zeroingThetaAtRxZero.toFixed(2)}，真正半偏发生在 Rx≈${formatResistance(currentHalfDeflectionResistance, 0)}`}
        </div>

        <svg viewBox="0 0 340 170" style={{ width: '100%', height: 170, display: 'block' }} aria-label="欧姆表非线性刻度示意">
          <rect x="10" y="12" width="320" height="146" rx="12" fill="#FFFFFF" stroke={COLORS.border} />
          <path d={arcPath} fill="none" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />

          {scaleMarks.map((mark) => {
            const ratio = resistanceToRatio(mark.resistance);
            const angle = angleForRatio(ratio);
            const outer = polar(angle, 86, 170, 114);
            const inner = polar(angle, mark.resistance === R_mid ? 71 : 76, 170, 114);
            const labelPoint = polar(angle, 102, 170, 114);
            const highlighted = mark.resistance === R_mid;

            return (
              <g key={`${mark.label}-${ratio}`}>
                <line
                  x1={outer.x}
                  y1={outer.y}
                  x2={inner.x}
                  y2={inner.y}
                  stroke={highlighted ? COLORS.primary : '#64748B'}
                  strokeWidth={highlighted ? 2.5 : 1.6}
                />
                <text
                  x={labelPoint.x}
                  y={labelPoint.y}
                  textAnchor="middle"
                  fontSize={highlighted ? 11 : 9}
                  fontWeight={highlighted ? 700 : 500}
                  fill={highlighted ? COLORS.primary : COLORS.textSecondary}
                >
                  {mark.label}
                </text>
              </g>
            );
          })}

          <line
            x1="170"
            y1="114"
            x2={polar(angleForRatio(deflectionRatio), 72, 170, 114).x}
            y2={polar(angleForRatio(deflectionRatio), 72, 170, 114).y}
            stroke={isHalfDeflection ? COLORS.primary : COLORS.text}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="170" cy="114" r="4.5" fill={isHalfDeflection ? COLORS.primary : COLORS.text} />
          <text x="170" y="142" textAnchor="middle" fontSize="11" fontWeight="700" fill={COLORS.text}>
            欧姆表非线性刻度
          </text>
          {isHalfDeflection && (
            <>
              <rect x="145" y="28" width="50" height="20" rx="10" fill={COLORS.primaryLight} stroke={COLORS.primary} />
              <text x="170" y="42" textAnchor="middle" fontSize="10" fontWeight="700" fill={COLORS.primary}>
                半偏
              </text>
            </>
          )}
        </svg>

        <CircuitMetricList
          metrics={[
            {
              label: '电池内阻 r',
              value: formatResistance(
                batteryInternalResistance,
                batteryInternalResistance < 1000 ? 0 : 1,
              ),
            },
            {
              label: '重新调零所需 R0',
              value: canZero
                ? formatResistance(
                    zeroedSeriesResistance,
                    zeroedSeriesResistance < 1000 ? 0 : 1,
                  )
                : '无法实现满偏调零',
              highlighted: canZero,
            },
          ]}
        />
      </div>
    </InfoCard>
  );
}

// ─── 测量结果 + 误差分析卡片 ───

function MeasurementCard({ circuitType, source }: { circuitType: string; source: Entity }) {
  const measuredR = source.properties.measuredR as number | undefined;
  const trueR = source.properties.trueR as number | undefined;
  const error = source.properties.error as number | undefined;

  if (measuredR === undefined || trueR === undefined || error === undefined) return null;

  const errorPercent = (error * 100).toFixed(2);
  const errorSign = Math.abs(error) <= 1e-9 ? '无误差' : error > 0 ? '偏大' : '偏小';

  const currentMethod = source.properties.currentMethod as string | undefined;
  const effectiveType = circuitType === 'voltammetry-compare' ? currentMethod : circuitType;

  let reason = '';
  if (effectiveType === 'voltammetry-internal' || effectiveType === 'internal') {
    reason = '原因：电压表跨 A+Rx，电流表内阻被计入测量值，所以 R测偏大';
  } else if (effectiveType === 'voltammetry-external' || effectiveType === 'external') {
    reason = '原因：电流表测总电流，电压表分流，所以 R测偏小';
  }

  return (
    <InfoCard title="测量结果">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <CircuitMetricList
          metrics={[
            { label: 'R测', value: `${measuredR.toFixed(2)} Ω`, highlighted: true },
            { label: 'R真', value: `${trueR.toFixed(2)} Ω` },
            { label: '相对误差', value: `${errorPercent}%` },
            { label: '误差方向', value: errorSign },
          ]}
        />
        {reason && (
          <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.7 }}>{reason}</div>
        )}
      </div>
    </InfoCard>
  );
}

// ─── 对比表卡片 ───

function CompareTableCard({ source }: { source: Entity }) {
  const showIdealModel = useSimulationStore((s) => Boolean(s.paramValues.showIdealModel ?? true));
  const showDerivation = useSimulationStore((s) => Boolean(s.paramValues.showErrorDerivation ?? false));
  const switchClosed = useSimulationStore((s) => Boolean(s.paramValues.switchClosed ?? true));

  const idealI = source.properties.idealI as number | undefined;
  const idealV = source.properties.idealV as number | undefined;
  const idealR = source.properties.idealMeasuredR as number | undefined;
  const idealErr = source.properties.idealError as number | undefined;
  const intI = source.properties.internalI as number | undefined;
  const intV = source.properties.internalV as number | undefined;
  const mR_int = source.properties.measuredR_internal as number | undefined;
  const err_int = source.properties.error_internal as number | undefined;
  const extI = source.properties.externalI as number | undefined;
  const extV = source.properties.externalV as number | undefined;
  const mR_ext = source.properties.measuredR_external as number | undefined;
  const err_ext = source.properties.error_external as number | undefined;
  const threshold = source.properties.threshold as number | undefined;
  const recommended = source.properties.recommendedMethod as string | undefined;
  const trueR = source.properties.trueR as number | undefined;

  if (!switchClosed) {
    return (
      <InfoCard
        title="内/外接法并列对比"
        defaultOpen
        forceOpenToken={`compare-${String(showIdealModel)}`}
        style={{ minWidth: 900, maxWidth: 900 }}
      >
        <div style={{ fontSize: 12, color: COLORS.textMuted, lineHeight: 1.8 }}>
          开关断开时仅显示电路结构。闭合开关后，本实验会同时给出理想模型、内接法、外接法三组结果，便于课堂上直接对照讲解。
        </div>
      </InfoCard>
    );
  }

  if (
    mR_int === undefined ||
    mR_ext === undefined ||
    intI === undefined ||
    intV === undefined ||
    extI === undefined ||
    extV === undefined ||
    trueR === undefined
  ) {
    return null;
  }

  const intErr = formatSignedComparePercent(err_int);
  const extErr = formatSignedComparePercent(err_ext);
  const idealErrText = formatSignedComparePercent(idealErr);
  const recommendedLabel = recommended === 'internal' ? '内接法' : '外接法';
  const cards = [
    showIdealModel && idealI !== undefined && idealV !== undefined && idealR !== undefined
      ? {
          key: 'ideal' as const,
          title: '理想模型',
          color: '#475569',
          subtitle: '理想电表：RA = 0，RV = ∞',
          I: idealI,
          U: idealV,
          R: idealR,
          error: idealErrText,
          conclusion: '应等于真实值',
        }
      : null,
    {
      key: 'inner' as const,
      title: '内接法',
      color: '#D97706',
      subtitle: 'V 表跨在 A 与 Rx 两端',
      I: intI,
      U: intV,
      R: mR_int,
      error: intErr,
      conclusion: `结论：${compareDirectionText(err_int)}`,
    },
    {
      key: 'outer' as const,
      title: '外接法',
      color: '#059669',
      subtitle: 'V 表只跨在 Rx 两端',
      I: extI,
      U: extV,
      R: mR_ext,
      error: extErr,
      conclusion: `结论：${compareDirectionText(err_ext)}`,
    },
  ].filter(Boolean) as Array<{
    key: 'ideal' | 'inner' | 'outer';
    title: string;
    color: string;
    subtitle: string;
    I: number;
    U: number;
    R: number;
    error: string;
    conclusion: string;
  }>;

  return (
    <InfoCard
      title="内/外接法并列对比"
      defaultOpen
      forceOpenToken={`compare-${String(showIdealModel)}`}
      style={{ minWidth: 900, maxWidth: 900 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ fontSize: 12, color: COLORS.textSecondary, lineHeight: 1.7 }}>
          当前实验不再单独切换接法，而是同时展示理想模型、内接法、外接法三组结果。先看表头读数和 R测，再看下方误差总览。
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${cards.length}, minmax(0, 1fr))`,
            gap: 12,
          }}
        >
          {cards.map((card) => (
            <div
              key={card.key}
              style={{
                border: `1px solid ${card.color}33`,
                borderRadius: RADIUS.sm,
                backgroundColor: '#FFFFFF',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  padding: '10px 12px',
                  borderBottom: `1px solid ${COLORS.border}`,
                  backgroundColor: `${card.color}12`,
                }}
              >
                <div style={{ fontSize: 16, fontWeight: 700, color: card.color }}>{card.title}</div>
                <div style={{ marginTop: 2, fontSize: 11, color: COLORS.textSecondary }}>{card.subtitle}</div>
              </div>

              <div style={{ padding: '10px 12px' }}>
                <CompareCircuitDiagram mode={card.key} color={card.color} />

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  <CompareMetric label="电流表读数 I" value={formatCurrent(card.I)} />
                  <CompareMetric label="电压表读数 U" value={formatVoltage(card.U)} />
                </div>

                <div
                  style={{
                    marginTop: 10,
                    borderRadius: RADIUS.sm,
                    border: `1px solid ${card.color}22`,
                    backgroundColor: `${card.color}0A`,
                    padding: '10px 12px',
                  }}
                >
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>
                    {card.key === 'ideal' ? '理想测得' : '按伏安法计算'}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: card.color, lineHeight: 1 }}>
                    {formatResistance(card.R, card.R < 100 ? 2 : 1)}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 10, color: COLORS.textMuted }}>R测 = U / I</div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <div style={{ fontSize: 11, color: COLORS.textSecondary }}>与真实值相比</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: card.color }}>{card.error}</div>
                </div>
                <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, color: COLORS.text }}>
                  {card.conclusion}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div
          style={{
            border: `1px solid ${COLORS.primaryDisabled}`,
            borderRadius: RADIUS.sm,
            backgroundColor: COLORS.primaryLight,
            padding: '14px 16px',
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.primary }}>误差对比总览</div>
          <div
            style={{
              marginTop: 12,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 12,
            }}
          >
            <CompareSummaryBlock title="[真实值]" accent={COLORS.text} lines={[`真实电阻：Rx = ${formatResistance(trueR, trueR < 100 ? 2 : 1)}`]} />
            <CompareSummaryBlock
              title="[内接法]"
              accent="#D97706"
              lines={[
                `测得电阻：R内 = ${formatResistance(mR_int, mR_int < 100 ? 2 : 1)}`,
                `误差率：${intErr}`,
                `结论：${compareDirectionText(err_int)}`,
              ]}
              emphasizeLine={1}
            />
            <CompareSummaryBlock
              title="[外接法]"
              accent="#059669"
              lines={[
                `测得电阻：R外 = ${formatResistance(mR_ext, mR_ext < 100 ? 2 : 1)}`,
                `误差率：${extErr}`,
                `结论：${compareDirectionText(err_ext)}`,
              ]}
              emphasizeLine={1}
            />
            <CompareSummaryBlock
              title="[自动判断]"
              accent={COLORS.primary}
              lines={[
                `当前更准确：${recommendedLabel}`,
                '原因：误差绝对值更小',
                threshold !== undefined
                  ? `教材判据：Rx ${trueR >= threshold ? '≥' : '<'} √(rA·rV)`
                  : '教材提示：大内小外',
              ]}
              emphasizeLine={0}
            />
          </div>
        </div>

        {showDerivation && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <AnalysisCard
              color="#D97706"
              title="内接法推导"
              lines={[
                '电压表跨在 Rx + rA 两端',
                "R内 = U / I = Rx + rA",
                `当前：R内 = ${formatResistance(mR_int, mR_int < 100 ? 2 : 1)}`,
                `误差率：${intErr}`,
              ]}
            />
            <AnalysisCard
              color="#059669"
              title="外接法推导"
              lines={[
                '电流表测总电流，含 V 表分流',
                'R外 = U / I = Rx ∥ rV',
                `当前：R外 = ${formatResistance(mR_ext, mR_ext < 100 ? 2 : 1)}`,
                `误差率：${extErr}`,
              ]}
            />
            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                backgroundColor: COLORS.bgMuted,
                padding: '10px 12px',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.text }}>教学提示</div>
              <div style={{ marginTop: 6, fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.8 }}>
                <div>· 内接法误差本质：电流表内阻被计入测量值，所以 R测偏大。</div>
                <div>· 外接法误差本质：电压表分流，所以 R测偏小。</div>
                <div>· 大电阻通常更适合内接法，小电阻通常更适合外接法。</div>
                {threshold !== undefined && (
                  <div>· 当前临界值：√(rA·rV) = {formatResistance(threshold, threshold < 100 ? 2 : 1)}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </InfoCard>
  );
}

function formatSignedComparePercent(error: number | undefined): string {
  if (error === undefined || !Number.isFinite(error)) return '—';
  const pct = error * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(2)}%`;
}

function compareDirectionText(error: number | undefined): string {
  if (error === undefined || !Number.isFinite(error)) return '无法判断';
  if (error > 1e-9) return '偏大';
  if (error < -1e-9) return '偏小';
  return '无误差';
}

function CompareMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.bgMuted,
        padding: '8px 10px',
      }}
    >
      <div style={{ fontSize: 10, color: COLORS.textSecondary }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: COLORS.text }}>{value}</div>
    </div>
  );
}

function AnalysisCard({ title, color, lines }: { title: string; color: string; lines: string[] }) {
  return (
    <div
      style={{
        border: `1px solid ${color}22`,
        borderRadius: RADIUS.sm,
        backgroundColor: COLORS.bg,
        padding: '10px 12px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color }}>{title}</div>
      {lines.map((line) => (
        <div key={`${title}-${line}`} style={{ marginTop: 6, fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.7 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function CompareSummaryBlock({
  title,
  accent,
  lines,
  emphasizeLine,
}: {
  title: string;
  accent: string;
  lines: string[];
  emphasizeLine?: number;
}) {
  return (
    <div
      style={{
        borderRadius: RADIUS.sm,
        border: `1px solid ${accent}22`,
        backgroundColor: COLORS.bg,
        padding: '12px 14px',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, color: accent }}>{title}</div>
      {lines.map((line, index) => (
        <div
          key={`${title}-${line}`}
          style={{
            marginTop: index === 0 ? 10 : 8,
            fontSize: emphasizeLine === index ? 24 : 13,
            fontWeight: emphasizeLine === index ? 800 : 600,
            color: emphasizeLine === index ? accent : COLORS.text,
            lineHeight: 1.25,
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function CompareCircuitDiagram({
  mode,
  color,
}: {
  mode: 'ideal' | 'inner' | 'outer';
  color: string;
}) {
  const meterRadius = 14;
  const leftX = 26;
  const rightX = 214;
  const topY = 44;
  const bottomY = 114;
  const aX = 72;
  const rLeft = 134;
  const rWidth = 36;
  const rRight = rLeft + rWidth;
  const vY = 86;
  const branchLeft = mode === 'inner' ? aX - meterRadius : rLeft;
  const branchRight = rRight;
  const voltmeterCenterX = mode === 'inner' ? 120 : (branchLeft + branchRight) / 2;
  const voltmeterLeft = voltmeterCenterX - meterRadius;
  const voltmeterRight = voltmeterCenterX + meterRadius;

  return (
    <svg viewBox="0 0 240 130" style={{ width: '100%', display: 'block' }}>
      <rect x="1" y="1" width="238" height="128" rx="12" fill="#FCFCFD" stroke={COLORS.border} />

      <line x1={leftX} y1={topY} x2={aX - meterRadius} y2={topY} stroke="#111827" strokeWidth="2" />
      <line x1={aX + meterRadius} y1={topY} x2={rLeft} y2={topY} stroke="#111827" strokeWidth="2" />
      <line x1={rRight} y1={topY} x2={rightX} y2={topY} stroke="#111827" strokeWidth="2" />
      <line x1={rightX} y1={topY} x2={rightX} y2={bottomY} stroke="#111827" strokeWidth="2" />
      <line x1={rightX} y1={bottomY} x2={leftX} y2={bottomY} stroke="#111827" strokeWidth="2" />
      <line x1={leftX} y1={topY} x2={leftX} y2={62} stroke="#111827" strokeWidth="2" />
      <line x1={leftX} y1={96} x2={leftX} y2={bottomY} stroke="#111827" strokeWidth="2" />

      <line x1={branchLeft} y1={topY} x2={branchLeft} y2={70} stroke={color} strokeWidth="2.4" />
      <line x1={branchRight} y1={topY} x2={branchRight} y2={70} stroke={color} strokeWidth="2.4" />
      <line x1={branchLeft} y1={70} x2={voltmeterLeft} y2={70} stroke={color} strokeWidth="2.4" />
      <line x1={voltmeterRight} y1={70} x2={branchRight} y2={70} stroke={color} strokeWidth="2.4" />
      <line x1={voltmeterLeft} y1={70} x2={voltmeterLeft} y2={vY} stroke={color} strokeWidth="2.4" />
      <line x1={voltmeterRight} y1={70} x2={voltmeterRight} y2={vY} stroke={color} strokeWidth="2.4" />

      <line x1={leftX - 10} y1={62} x2={leftX + 10} y2={62} stroke="#111827" strokeWidth="2" />
      <line x1={leftX - 6} y1={78} x2={leftX + 6} y2={78} stroke="#111827" strokeWidth="1.5" />

      <circle cx={aX} cy={topY} r={meterRadius} fill="#FFF" stroke="#111827" strokeWidth="2" />
      <text x={aX} y={topY + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">A</text>

      <rect x={rLeft} y={topY - 10} width={rWidth} height={20} fill="#FFF" stroke="#111827" strokeWidth="2" />
      <text x={(rLeft + rRight) / 2} y={24} textAnchor="middle" fontSize="10" fill="#4B5563">Rx</text>

      <circle cx={voltmeterCenterX} cy={vY} r={meterRadius} fill="#FFF" stroke={color} strokeWidth="2" />
      <text x={voltmeterCenterX} y={vY + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#111827">V</text>

      <text x={36} y={102} textAnchor="start" fontSize="10" fill="#4B5563">电源</text>
      <text x={voltmeterCenterX} y={122} textAnchor="middle" fontSize="10" fill={color}>
        {mode === 'ideal'
          ? 'V 并联在 Rx 两端'
          : mode === 'inner'
            ? 'V 跨 A 与 Rx'
            : 'V 并联在 Rx 两端'}
      </text>
    </svg>
  );
}

// ─── 测电源 EMF/内阻：采样 + 拟合 + 对比 ───

type MeasureSeriesKey = 'ideal' | 'inner' | 'outer';

interface MeasureSeriesPoint {
  I: number;
  U: number;
}

interface MeasureSample {
  id: number;
  sliderRatio: number;
  resistance: number;
  series: Record<MeasureSeriesKey, MeasureSeriesPoint>;
}

interface FitResult {
  intercept: number;
  slope: number;
  emf: number;
  r: number;
}

const SERIES_META: Record<MeasureSeriesKey, { label: string; color: string }> = {
  ideal: { label: '理想电源', color: '#2563EB' },
  inner: { label: '内接法', color: '#D97706' },
  outer: { label: '外接法', color: '#059669' },
};

function UIChartCard({ source, entities }: { source: Entity; entities: Map<string, Entity> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextIdRef = useRef(1);
  const prevSliderRatioRef = useRef<number | null>(null);
  const lastConfigRef = useRef<string | null>(null);

  const [samples, setSamples] = useState<MeasureSample[]>([]);
  const [sampleViewMode, setSampleViewMode] = useState<'list' | 'table'>('list');

  const rheostat = findByFamily(entities, isVariableResistor);
  const ammeter = findComponent(entities, 'ammeter');
  const voltmeter = findComponent(entities, 'voltmeter');

  const sliderRatio = useSimulationStore((s) =>
    Number(s.paramValues.sliderRatio ?? rheostat?.properties.sliderRatio ?? 0.5),
  );
  const maxResistance = useSimulationStore((s) =>
    Number(s.paramValues.maxR ?? rheostat?.properties.maxResistance ?? 50),
  );
  const switchClosed = useSimulationStore((s) => Boolean(s.paramValues.switchClosed ?? true));

  const emf = (source.properties.emf as number) ?? 0;
  const internalResistance = (source.properties.internalResistance as number) ?? 0;
  const ammeterResistance = (ammeter?.properties.internalResistance as number) ?? 0;
  const voltmeterResistance =
    (voltmeter?.properties.internalResistance as number) ?? Number.POSITIVE_INFINITY;
  const effectiveResistance = rheostat ? getEffectiveResistance(rheostat) : NaN;
  const measureMode = source.properties.measureMode as string | undefined;
  const externalBranchResistance = source.properties.externalBranchResistance as number | undefined;
  const currentOuterI = (source.properties.lastI as number) ?? 0;
  const currentOuterU = (source.properties.lastU as number) ?? 0;

  const currentSnapshot = useMemo(() => {
    if (!rheostat || !ammeter || !voltmeter) return null;
    const loadResistance =
      measureMode === 'divider' && Number.isFinite(externalBranchResistance)
        ? Math.max(Number(externalBranchResistance), 1e-6)
        : Number.isFinite(effectiveResistance) && effectiveResistance >= 0
          ? Math.max(effectiveResistance, 1e-6)
          : null;
    if (loadResistance == null) return null;

    const idealI = emf / Math.max(internalResistance + loadResistance, 1e-6);
    const idealU = idealI * loadResistance;

    const innerI = emf / Math.max(internalResistance + ammeterResistance + loadResistance, 1e-6);
    const innerU = innerI * loadResistance;

    const outerUFormula =
      emf /
      (1 +
        internalResistance / Math.max(loadResistance + ammeterResistance, 1e-6) +
        internalResistance / Math.max(voltmeterResistance, 1e-6));
    const outerIFormula = outerUFormula / Math.max(loadResistance + ammeterResistance, 1e-6);

    return {
      sliderRatio,
      resistance: loadResistance,
      series: {
        ideal: { I: idealI, U: idealU },
        inner: { I: innerI, U: innerU },
        outer: {
          I: currentOuterI > 0 ? currentOuterI : outerIFormula,
          U: currentOuterU > 0 ? currentOuterU : outerUFormula,
        },
      },
    };
  }, [
    ammeter,
    ammeterResistance,
    currentOuterI,
    currentOuterU,
    externalBranchResistance,
    effectiveResistance,
    emf,
    internalResistance,
    measureMode,
    rheostat,
    sliderRatio,
    voltmeter,
    voltmeterResistance,
  ]);

  const configSignature = [
    source.id,
    rheostat?.id ?? 'none',
    ammeter?.id ?? 'none',
    voltmeter?.id ?? 'none',
    emf.toFixed(6),
    internalResistance.toFixed(6),
    ammeterResistance.toFixed(6),
    voltmeterResistance.toFixed(6),
    maxResistance.toFixed(6),
  ].join('|');

  useEffect(() => {
    if (lastConfigRef.current === null) {
      lastConfigRef.current = configSignature;
      prevSliderRatioRef.current = sliderRatio;
      return;
    }

    if (lastConfigRef.current !== configSignature) {
      lastConfigRef.current = configSignature;
      prevSliderRatioRef.current = sliderRatio;
      nextIdRef.current = 1;
      setSamples([]);
    }
  }, [configSignature, sliderRatio]);

  useEffect(() => {
    if (prevSliderRatioRef.current === null) {
      prevSliderRatioRef.current = sliderRatio;
      return;
    }

    if (Math.abs(prevSliderRatioRef.current - sliderRatio) < 1e-9) return;
    prevSliderRatioRef.current = sliderRatio;

    if (!switchClosed || !currentSnapshot) return;

    setSamples((prev) => upsertMeasureSample(prev, currentSnapshot, nextIdRef));
  }, [currentSnapshot, sliderRatio, switchClosed]);

  const applyParam = useCallback((key: string, value: number | boolean | string) => {
    applySimulatorParams([[key, value]]);
  }, []);

  const handleSliderChange = useCallback(
    (value: number) => {
      applyParam('sliderRatio', Math.max(0.01, Math.min(1, value)));
    },
    [applyParam],
  );

  const handleRecordCurrent = useCallback(() => {
    if (!switchClosed || !currentSnapshot) return;
    setSamples((prev) => upsertMeasureSample(prev, currentSnapshot, nextIdRef));
  }, [currentSnapshot, switchClosed]);

  const handleClear = useCallback(() => {
    nextIdRef.current = 1;
    setSamples([]);
  }, []);

  const fits = useMemo<Record<MeasureSeriesKey, FitResult | null>>(
    () => ({
      ideal: fitMeasureSeries(samples, 'ideal'),
      inner: fitMeasureSeries(samples, 'inner'),
      outer: fitMeasureSeries(samples, 'outer'),
    }),
    [samples],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    const w = 360;
    const h = 240;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    c.scale(dpr, dpr);

    drawMeasureComparisonChart(
      c,
      { x: 0, y: 0, width: w, height: h },
      {
        samples,
        fits,
        emf,
        internalResistance,
        ammeterResistance,
        voltmeterResistance,
      },
    );
  }, [ammeterResistance, emf, fits, internalResistance, samples, voltmeterResistance]);

  const currentResistance = Number.isFinite(effectiveResistance)
    ? effectiveResistance
    : maxResistance * sliderRatio;
  const sampleRows = useMemo<ExperimentDataRow[]>(
    () =>
      samples.map((sample) => ({
        key: sample.id,
        cells: [
          `#${sample.id}`,
          `${sample.resistance.toFixed(2)} Ω`,
          sample.sliderRatio.toFixed(2),
          `${sample.series.ideal.U.toFixed(3)} V`,
          `${sample.series.ideal.I.toFixed(3)} A`,
          `${sample.series.inner.U.toFixed(3)} V`,
          `${sample.series.inner.I.toFixed(3)} A`,
          `${sample.series.outer.U.toFixed(3)} V`,
          `${sample.series.outer.I.toFixed(3)} A`,
        ],
      })),
    [samples],
  );
  const sampleListItems = useMemo<ExperimentDataListItem[]>(
    () =>
      samples.map((sample) => ({
        key: sample.id,
        title: `第 ${sample.id} 组`,
        subtitle: `接入电阻 ${sample.resistance.toFixed(2)} Ω · 滑片 ${sample.sliderRatio.toFixed(2)}`,
        metrics: [
          {
            label: '理想模型',
            value: `${sample.series.ideal.U.toFixed(3)} V / ${sample.series.ideal.I.toFixed(3)} A`,
          },
          {
            label: '内接法',
            value: `${sample.series.inner.U.toFixed(3)} V / ${sample.series.inner.I.toFixed(3)} A`,
          },
          {
            label: '外接法',
            value: `${sample.series.outer.U.toFixed(3)} V / ${sample.series.outer.I.toFixed(3)} A`,
          },
        ],
      })),
    [samples],
  );

  return (
    <InfoCard title="U-I 采样与拟合对比" defaultOpen style={{ minWidth: 392, maxWidth: 392 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'flex-start',
          }}
        >
          <div style={{ fontSize: 11, color: COLORS.text, lineHeight: 1.7 }}>
            <div>
              已采集 <strong>{samples.length}</strong> 组数据
            </div>
            <div>当前接入阻值：{currentResistance.toFixed(2)}Ω</div>
            <div>当前滑片位置：{sliderRatio.toFixed(2)}</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => { window.location.hash = 'measure-emf-compare'; }}
              style={experimentButtonStyle(false, true)}
            >
              专题对比
            </button>
            <button
              onClick={handleRecordCurrent}
              disabled={!switchClosed || !currentSnapshot}
              style={experimentButtonStyle(!switchClosed || !currentSnapshot)}
            >
              记录当前点
            </button>
            <button onClick={handleClear} style={experimentButtonStyle(false, true)}>
              清空数据
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 10,
              color: COLORS.textSecondary,
            }}
          >
            <span>滑动变阻器</span>
            <span>{switchClosed ? '拖动即自动采点' : '开关断开时不记录数据'}</span>
          </div>
          <input
            type="range"
            min={0.01}
            max={1}
            step={0.01}
            value={sliderRatio}
            onChange={(e) => handleSliderChange(Number(e.target.value))}
            style={{ width: '100%', accentColor: COLORS.primary }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {(['ideal', 'inner', 'outer'] as MeasureSeriesKey[]).map((key) => (
            <div
              key={key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '2px 8px',
                borderRadius: 999,
                backgroundColor: `${SERIES_META[key].color}12`,
                color: COLORS.text,
                fontSize: 10,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: SERIES_META[key].color,
                }}
              />
              <span>{SERIES_META[key].label}</span>
            </div>
          ))}
        </div>

        <canvas ref={canvasRef} style={{ display: 'block', width: 360, height: 240 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 10, color: COLORS.textSecondary }}>原始采样数据</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => setSampleViewMode('list')}
                style={experimentButtonStyle(false, sampleViewMode !== 'list')}
              >
                列表
              </button>
              <button
                onClick={() => setSampleViewMode('table')}
                style={experimentButtonStyle(false, sampleViewMode !== 'table')}
              >
                表格
              </button>
            </div>
          </div>
          {sampleViewMode === 'list' ? (
            <ExperimentDataList
              items={sampleListItems}
              emptyText="拖动滑片或点击“记录当前点”后，这里会按列表列出每组 U-I 数据。"
            />
          ) : (
            <ExperimentDataTable
              columns={['点', '接入电阻', '滑片', '理想 U', '理想 I', '内接 U', '内接 I', '外接 U', '外接 I']}
              rows={sampleRows}
              emptyText="拖动滑片或点击“记录当前点”后，这里会按表格列出每组 U-I 数据。"
            />
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {(['ideal', 'inner', 'outer'] as MeasureSeriesKey[]).map((key) => (
            <FitSummaryCard
              key={key}
              title={SERIES_META[key].label}
              color={SERIES_META[key].color}
              fit={fits[key]}
              trueEmf={emf}
              trueR={internalResistance}
              pointCount={samples.length}
            />
          ))}
        </div>
      </div>
    </InfoCard>
  );
}

function HalfDeflectionTeachingCard({
  source,
  entities,
  circuitType,
}: {
  source: Entity;
  entities: Map<string, Entity>;
  circuitType: string;
}) {
  const mode = getHalfDeflectionMode(circuitType);
  const halfResistor = findByFamily(entities, isFixedResistance);
  const meter =
    mode === 'ammeter'
      ? findByFamily(entities, isCurrentMeter)
      : findComponent(entities, 'voltmeter');
  const switchMain = useSimulationStore((s) => Boolean(s.paramValues.switchMain ?? true));
  const switchHalf = useSimulationStore((s) =>
    Boolean(s.paramValues.switchHalf ?? (mode === 'voltmeter')),
  );

  const referenceReading = (source.properties.referenceReading as number) ?? 0;
  const targetHalfReading = (source.properties.targetHalfReading as number) ?? 0;
  const currentReading = (source.properties.currentReading as number) ?? 0;
  const readingRatio = (source.properties.currentReadingRatio as number | undefined) ?? 0;
  const branchCurrent = (source.properties.parallelBranchCurrent as number | undefined) ?? 0;
  const currentHalfResistance =
    (source.properties.currentHalfResistance as number | undefined) ??
    ((halfResistor?.properties.resistance as number) ?? 0);
  const exactHalfResistance = (source.properties.exactHalfResistance as number) ?? 0;
  const currentErrorPercent = (source.properties.currentErrorPercent as number) ?? 0;
  const approximationNote = (source.properties.approximationNote as string | undefined) ?? '';
  const isHalfDeflection = Boolean(source.properties.isHalfDeflection);
  const topologyLeftNode = (source.properties.topologyLeftNode as string | undefined) ?? 'A_left';
  const topologyRightNode = (source.properties.topologyRightNode as string | undefined) ?? 'A_right';
  const topologyNote = (source.properties.topologyNote as string | undefined) ?? '';
  const branchCurrentNonZero = Boolean(source.properties.branchCurrentNonZero);
  const parallelAcrossMeter = Boolean(source.properties.parallelAcrossMeter);
  const trueInternalResistance =
    (source.properties.trueInternalResistance as number | undefined) ??
    ((source.properties.internalResistance as number | undefined) ?? 0);
  const meterInternalResistance =
    (source.properties.meterInternalResistance as number | undefined) ??
    ((meter?.properties.internalResistance as number) ?? 0);
  const rheostatResistance = (source.properties.rheostatResistance as number | undefined) ?? 0;
  const totalSeriesResistance = (source.properties.seriesResistance as number | undefined) ?? 0;

  const readingFormatter = mode === 'ammeter' ? formatCurrent : formatVoltage;
  const step2SwitchValue = mode === 'ammeter';
  const step1SwitchValue = !step2SwitchValue;
  const resistanceStep = mode === 'ammeter' ? 0.01 : 100;

  const applyHalfResistance = useCallback(
    (value: number) => {
      const rounded = Math.max(0, Math.round(value / resistanceStep) * resistanceStep);
      applySimulatorParams([
        ['switchMain', true],
        ['switchHalf', step2SwitchValue],
        ['Rhalf', rounded],
      ]);
    },
    [resistanceStep, step2SwitchValue],
  );

  const handleResetToBaseline = useCallback(() => {
    applySimulatorParams([
      ['switchMain', true],
      ['switchHalf', step1SwitchValue],
    ]);
  }, [step1SwitchValue]);

  if (mode === 'voltmeter') {
    return (
      <InfoCard
        title={`${getHalfDeflectionModeLabel(mode)} · 理想/真实对比`}
        defaultOpen
        style={{ minWidth: 392, maxWidth: 392 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.7 }}>
            按教材步骤：先闭合短接开关 S&apos;，调滑动变阻器得到基准电压 U0；再断开 S&apos;，
            调节 R&apos; 使电压表示数变为 U0/2。理想近似取 R&apos;≈rV，真实半偏值会更大。
          </div>

          <CircuitMetricList
            metrics={[
              {
                label: '基准电压 U0',
                value: readingFormatter(referenceReading),
              },
              {
                label: '当前电压 U',
                value: readingFormatter(currentReading),
                highlighted: !switchHalf,
              },
              {
                label: 'U / U0',
                value: referenceReading > 1e-9 ? (currentReading / referenceReading).toFixed(3) : '—',
                highlighted: isHalfDeflection,
              },
              {
                label: "当前电阻 R'",
                value: formatResistance(currentHalfResistance, 0),
                highlighted: !switchHalf,
              },
              {
                label: '目标半偏 U0/2',
                value: readingFormatter(targetHalfReading),
                highlighted: !switchHalf,
              },
              {
                label: '滑变阻值 R滑',
                value: formatResistance(rheostatResistance, 0),
              },
              {
                label: '串联总阻值 R滑+r',
                value: formatResistance(totalSeriesResistance, 0),
              },
              {
                label: '电压表内阻 rV',
                value: formatResistance(trueInternalResistance, 0),
              },
              {
                label: "严格半偏所需 R'",
                value: formatResistance(exactHalfResistance, 0),
              },
              {
                label: '估算误差',
                value: `${formatSignedPercent(currentErrorPercent)}%`,
              },
            ]}
          />

          <div
            style={{
              borderRadius: RADIUS.sm,
              border: `1px solid ${isHalfDeflection ? COLORS.primary : COLORS.border}`,
              backgroundColor: isHalfDeflection ? COLORS.primaryLight : COLORS.bgMuted,
              padding: '8px 10px',
              fontSize: 11,
              color: isHalfDeflection ? COLORS.primary : COLORS.text,
              lineHeight: 1.7,
            }}
          >
            <div>
              {switchHalf
                ? `当前 S' 闭合，记录基准电压 U0=${readingFormatter(referenceReading)}`
                : `当前示数：${readingFormatter(currentReading)}，目标半偏：${readingFormatter(targetHalfReading)}`}
            </div>
            <div>
              {switchHalf
                ? "S' 仍在短接 R'，下一步应断开 S' 再调 R'"
                : `真实模型下需要把 R' 调到 ${formatResistance(exactHalfResistance, 0)}，而不是只看 rV`}
            </div>
            <div>理想近似：R&apos;≈rV；严格模型：R&apos; = R滑 + r电源 + rV。</div>
            {isHalfDeflection && <div>已达到半偏状态，此时可对比教材近似值与真实值的差异。</div>}
          </div>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={handleResetToBaseline} style={experimentButtonStyle(false, true)}>
              回到步骤一
            </button>
            <button
              onClick={() => applyHalfResistance(trueInternalResistance)}
              style={experimentButtonStyle(false)}
            >
              设 R&apos; = rV
            </button>
            <button
              onClick={() => applyHalfResistance(exactHalfResistance)}
              style={experimentButtonStyle(false)}
            >
              设 R&apos; = 严格半偏值
            </button>
          </div>

          <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.8 }}>
            <div>步骤一：S闭合、S&apos;闭合，调滑动变阻器得到基准电压 U0。</div>
            <div>步骤二：断开 S&apos; 后调 R&apos;，使电压表示数变为 U0/2。</div>
            <div>与电流表半偏不同，这里真实半偏值会把滑变阻值和电源内阻一起计入。</div>
          </div>
        </div>
      </InfoCard>
    );
  }

  return (
    <InfoCard
      title="半偏法测电源内阻"
      defaultOpen
      style={{ minWidth: 392, maxWidth: 392 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.7 }}>
          按教材近似：先记录 A 表初始示数 I0，再把开关 S' 与并联电阻 R' 严格接到 A 表两端；
          调节到 I_A = I0/2 时，可取电源内阻 r ≈ R'。当前要求的并联节点为 {topologyLeftNode} ↔ {topologyRightNode}。
        </div>

        <CircuitMetricList
          metrics={[
            {
              label: '初始电流 I0',
              value: readingFormatter(referenceReading),
            },
            {
              label: '当前电流 I_A',
              value: readingFormatter(currentReading),
              highlighted: switchHalf,
            },
            {
              label: 'I_A / I0',
              value: referenceReading > 1e-9 ? readingRatio.toFixed(3) : '—',
              highlighted: isHalfDeflection,
            },
            {
              label: "并联电阻 R'",
              value: formatResistance(currentHalfResistance, 2),
              highlighted: switchHalf,
            },
            {
              label: '目标半偏 I0/2',
              value: readingFormatter(targetHalfReading),
              highlighted: switchHalf,
            },
            {
              label: "支路电流 I_R'",
              value: formatCurrent(branchCurrent),
              highlighted: branchCurrentNonZero,
            },
            {
              label: '并联节点',
              value: `${topologyLeftNode} ↔ ${topologyRightNode}`,
              highlighted: parallelAcrossMeter,
            },
            {
              label: '估测内阻 r测',
              value: formatResistance(currentHalfResistance, 2),
              highlighted: switchHalf,
            },
            {
              label: '真实内阻 r真',
              value: formatResistance(trueInternalResistance, 2),
            },
            {
              label: "严格半偏所需 R'",
              value: formatResistance(exactHalfResistance, 2),
            },
            {
              label: '估算误差',
              value: `${formatSignedPercent(currentErrorPercent)}%`,
            },
            {
              label: 'A表内阻',
              value: formatResistance(meterInternalResistance, 1),
            },
          ]}
        />

        <div
          style={{
            borderRadius: RADIUS.sm,
            border: `1px solid ${isHalfDeflection ? COLORS.primary : COLORS.border}`,
            backgroundColor: isHalfDeflection ? COLORS.primaryLight : COLORS.bgMuted,
            padding: '8px 10px',
            fontSize: 11,
            color: isHalfDeflection ? COLORS.primary : COLORS.text,
            lineHeight: 1.7,
          }}
        >
          <div>
            {switchMain ? `当前示数：${readingFormatter(currentReading)}，目标半偏：${readingFormatter(targetHalfReading)}` : '主开关断开'}
          </div>
          <div>当前拓扑：{topologyNote}</div>
          <div>{approximationNote}</div>
          {isHalfDeflection && <div>已达到半偏状态，此时可按教材近似取 r ≈ R'。</div>}
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <button onClick={handleResetToBaseline} style={experimentButtonStyle(false, true)}>
            回到步骤一
          </button>
          <button
            onClick={() => applyHalfResistance(trueInternalResistance)}
            style={experimentButtonStyle(false)}
          >
            设 R&apos; = r真
          </button>
          <button
            onClick={() => applyHalfResistance(exactHalfResistance)}
            style={experimentButtonStyle(false)}
          >
            设 R&apos; = 严格半偏值
          </button>
        </div>

        <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.8 }}>
          <div>步骤一：S闭合、S'断开，记录初始电流 I0。</div>
          <div>步骤二：闭合 S' 后调 R'，使 A 表读数变为 I0/2。</div>
          <div>按教材近似：若 A 表内阻远大于电源内阻，则半偏时可认为 r≈R'。</div>
        </div>
      </div>
    </InfoCard>
  );
}

function experimentButtonStyle(disabled: boolean, subtle = false): React.CSSProperties {
  return {
    padding: '4px 10px',
    borderRadius: 6,
    border: `1px solid ${subtle ? COLORS.border : COLORS.primary}`,
    backgroundColor: disabled ? COLORS.bgMuted : subtle ? COLORS.bg : COLORS.primaryLight,
    color: disabled ? COLORS.textMuted : subtle ? COLORS.textSecondary : COLORS.primary,
    fontSize: 10,
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.7 : 1,
  };
}

function FitSummaryCard({
  title,
  color,
  fit,
  trueEmf,
  trueR,
  pointCount,
}: {
  title: string;
  color: string;
  fit: FitResult | null;
  trueEmf: number;
  trueR: number;
  pointCount: number;
}) {
  const emfError = fit ? ((fit.emf - trueEmf) / Math.max(trueEmf, 1e-6)) * 100 : null;
  const rError = fit ? ((fit.r - trueR) / Math.max(trueR, 1e-6)) * 100 : null;

  return (
    <div
      style={{
        border: `1px solid ${color}30`,
        borderRadius: RADIUS.sm,
        padding: '8px 9px',
        backgroundColor: `${color}08`,
      }}
    >
      <div style={{ color, fontSize: 11, fontWeight: 600 }}>{title}</div>
      {fit && pointCount >= 2 ? (
        <div style={{ marginTop: 4, fontSize: 10, color: COLORS.text, lineHeight: 1.7 }}>
          <div>E ≈ {fit.emf.toFixed(3)} V</div>
          <div>r ≈ {fit.r.toFixed(3)} Ω</div>
          <div>ΔE {formatSignedPercent(emfError)}%</div>
          <div>Δr {formatSignedPercent(rError)}%</div>
        </div>
      ) : (
        <div style={{ marginTop: 4, fontSize: 10, color: COLORS.textMuted, lineHeight: 1.6 }}>
          至少采集 2 组点
          <br />
          才能完成拟合
        </div>
      )}
    </div>
  );
}

function upsertMeasureSample(
  samples: MeasureSample[],
  sample: Omit<MeasureSample, 'id'>,
  nextIdRef: React.MutableRefObject<number>,
): MeasureSample[] {
  const index = samples.findIndex((item) => Math.abs(item.sliderRatio - sample.sliderRatio) < 1e-6);
  if (index >= 0) {
    const copy = [...samples];
    copy[index] = { ...sample, id: copy[index]!.id };
    return copy.sort((a, b) => a.resistance - b.resistance);
  }

  const next = { ...sample, id: nextIdRef.current++ };
  return [...samples, next].sort((a, b) => a.resistance - b.resistance);
}

function fitMeasureSeries(samples: MeasureSample[], key: MeasureSeriesKey): FitResult | null {
  if (samples.length < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;

  for (const sample of samples) {
    const point = sample.series[key];
    sumX += point.I;
    sumY += point.U;
    sumXY += point.I * point.U;
    sumXX += point.I * point.I;
  }

  const n = samples.length;
  const denominator = n * sumXX - sumX * sumX;
  if (Math.abs(denominator) < 1e-12) return null;

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  return {
    intercept,
    slope,
    emf: intercept,
    r: -slope,
  };
}

function drawMeasureComparisonChart(
  c: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  data: {
    samples: MeasureSample[];
    fits: Record<MeasureSeriesKey, FitResult | null>;
    emf: number;
    internalResistance: number;
    ammeterResistance: number;
    voltmeterResistance: number;
  },
) {
  const { x, y, width, height } = rect;
  const { samples, fits, emf, internalResistance, ammeterResistance, voltmeterResistance } = data;

  const pad = { left: 42, right: 14, top: 12, bottom: 30 };
  const plotX = x + pad.left;
  const plotY = y + pad.top;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const outerTheoryEmf =
    (emf * voltmeterResistance) / Math.max(internalResistance + voltmeterResistance, 1e-6);
  const outerTheoryR =
    (internalResistance * voltmeterResistance) /
    Math.max(internalResistance + voltmeterResistance, 1e-6);
  const innerTheoryR = internalResistance + ammeterResistance;

  const allPoints = samples.flatMap((sample) => [
    sample.series.ideal,
    sample.series.inner,
    sample.series.outer,
  ]);
  const pointMaxI = allPoints.reduce((max, point) => Math.max(max, point.I), 0);
  const pointMaxU = allPoints.reduce((max, point) => Math.max(max, point.U), 0);

  const maxI = Math.max(0.5, pointMaxI * 1.15, (emf / Math.max(internalResistance, 0.05)) * 1.05);
  const maxU = Math.max(1, pointMaxU * 1.12, emf * 1.08, outerTheoryEmf * 1.08);

  const toScreenX = (current: number) => plotX + (current / maxI) * plotW;
  const toScreenY = (voltage: number) => plotY + plotH - (voltage / maxU) * plotH;

  c.clearRect(x, y, width, height);
  c.fillStyle = '#FFFFFF';
  c.fillRect(x, y, width, height);

  c.strokeStyle = '#E5E7EB';
  c.lineWidth = 0.6;
  const xTicks = 6;
  const yTicks = 6;
  for (let i = 0; i <= xTicks; i++) {
    const sx = plotX + (plotW * i) / xTicks;
    c.beginPath();
    c.moveTo(sx, plotY);
    c.lineTo(sx, plotY + plotH);
    c.stroke();
  }
  for (let i = 0; i <= yTicks; i++) {
    const sy = plotY + (plotH * i) / yTicks;
    c.beginPath();
    c.moveTo(plotX, sy);
    c.lineTo(plotX + plotW, sy);
    c.stroke();
  }

  c.strokeStyle = '#374151';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(plotX, plotY + plotH);
  c.lineTo(plotX + plotW, plotY + plotH);
  c.stroke();
  c.beginPath();
  c.moveTo(plotX, plotY + plotH);
  c.lineTo(plotX, plotY);
  c.stroke();

  c.fillStyle = '#6B7280';
  c.font = '10px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText('I / A', plotX + plotW / 2, plotY + plotH + 22);
  c.save();
  c.translate(plotX - 28, plotY + plotH / 2);
  c.rotate(-Math.PI / 2);
  c.fillText('U / V', 0, 0);
  c.restore();

  c.font = '9px Inter, sans-serif';
  c.textAlign = 'center';
  for (let i = 0; i <= xTicks; i++) {
    const value = (maxI * i) / xTicks;
    c.fillText(value.toFixed(maxI <= 2 ? 2 : 1), plotX + (plotW * i) / xTicks, plotY + plotH + 14);
  }
  c.textAlign = 'right';
  for (let i = 0; i <= yTicks; i++) {
    const value = maxU - (maxU * i) / yTicks;
    c.fillText(value.toFixed(1), plotX - 6, plotY + (plotH * i) / yTicks + 3);
  }

  drawTheoryLine(
    c,
    toScreenX,
    toScreenY,
    maxI,
    { intercept: emf, r: internalResistance },
    SERIES_META.ideal.color,
  );
  drawTheoryLine(
    c,
    toScreenX,
    toScreenY,
    maxI,
    { intercept: emf, r: innerTheoryR },
    SERIES_META.inner.color,
  );
  drawTheoryLine(
    c,
    toScreenX,
    toScreenY,
    maxI,
    { intercept: outerTheoryEmf, r: outerTheoryR },
    SERIES_META.outer.color,
  );

  for (const key of ['ideal', 'inner', 'outer'] as MeasureSeriesKey[]) {
    const meta = SERIES_META[key];
    const fit = fits[key];

    if (fit) {
      drawFitLine(c, toScreenX, toScreenY, maxI, fit, meta.color);
    }

    for (const sample of samples) {
      const point = sample.series[key];
      const px = toScreenX(point.I);
      const py = toScreenY(point.U);

      c.beginPath();
      c.fillStyle = meta.color;
      c.arc(px, py, 3.6, 0, Math.PI * 2);
      c.fill();
      c.beginPath();
      c.fillStyle = '#FFFFFF';
      c.arc(px, py, 1.2, 0, Math.PI * 2);
      c.fill();
    }
  }

  if (samples.length === 0) {
    c.fillStyle = COLORS.textMuted;
    c.font = '11px Inter, sans-serif';
    c.textAlign = 'center';
    c.fillText('拖动滑动变阻器后自动采点', plotX + plotW / 2, plotY + plotH / 2 - 8);
    c.fillText('采集至少 2 组数据可生成拟合直线', plotX + plotW / 2, plotY + plotH / 2 + 10);
  }
}

function drawTheoryLine(
  c: CanvasRenderingContext2D,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  maxI: number,
  line: { intercept: number; r: number },
  color: string,
) {
  const xIntercept = line.r > 1e-6 ? line.intercept / line.r : maxI;
  const endX = Math.min(maxI, Math.max(0, xIntercept));
  const endU = Math.max(0, line.intercept - line.r * endX);

  c.beginPath();
  c.strokeStyle = `${color}55`;
  c.lineWidth = 1.1;
  c.setLineDash([5, 4]);
  c.moveTo(toScreenX(0), toScreenY(line.intercept));
  c.lineTo(toScreenX(endX), toScreenY(endU));
  c.stroke();
  c.setLineDash([]);
}

function drawFitLine(
  c: CanvasRenderingContext2D,
  toScreenX: (x: number) => number,
  toScreenY: (y: number) => number,
  maxI: number,
  fit: FitResult,
  color: string,
) {
  const xIntercept = fit.r > 1e-6 ? fit.emf / fit.r : maxI;
  const endX = Math.min(maxI, Math.max(0, xIntercept));
  const endU = Math.max(0, fit.emf - fit.r * endX);

  c.beginPath();
  c.strokeStyle = color;
  c.lineWidth = 1.8;
  c.moveTo(toScreenX(0), toScreenY(fit.emf));
  c.lineTo(toScreenX(endX), toScreenY(endU));
  c.stroke();
}

function formatSignedPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}`;
}

interface BulbCurveSample {
  id: number;
  U: number;
  I: number;
  R: number;
}

function BulbVoltammetryCard({
  source,
  entities,
}: {
  source: Entity;
  entities: Map<string, Entity>;
}) {
  const bulb = findComponent(entities, 'bulb');
  const ammeter = findComponent(entities, 'ammeter');
  const sw = findComponent(entities, 'switch');

  if (!bulb) return null;

  return (
    <BulbVoltammetryCardContent
      source={source}
      bulb={bulb}
      ammeter={ammeter}
      sw={sw}
    />
  );
}

function BulbVoltammetryCardContent({
  source,
  bulb,
  ammeter,
  sw,
}: {
  source: Entity;
  bulb: Entity;
  ammeter?: Entity;
  sw?: Entity;
}) {

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nextIdRef = useRef(1);
  const lastConfigRef = useRef<string | null>(null);
  const [samples, setSamples] = useState<BulbCurveSample[]>([]);

  const switchClosed = sw ? (sw.properties.closed as boolean) !== false : true;
  const emf = (source.properties.emf as number) ?? 0;
  const internalResistance = (source.properties.internalResistance as number) ?? 0;
  const ammeterResistance = (ammeter?.properties.internalResistance as number) ?? 0;
  const ratedVoltage = (bulb.properties.ratedVoltage as number) ?? 3.8;
  const ratedPower = (bulb.properties.ratedPower as number) ?? 0.3;
  const coldResistance = (bulb.properties.coldResistance as number) ?? 2;
  const currentU = (bulb.properties.voltage as number) ?? 0;
  const currentI = (bulb.properties.current as number) ?? 0;
  const currentR = currentI > 1e-7 ? currentU / currentI : Number.POSITIVE_INFINITY;
  const currentPoint = useMemo<Omit<BulbCurveSample, 'id'> | null>(
    () => (
      switchClosed && Number.isFinite(currentU) && Number.isFinite(currentI)
        ? { U: currentU, I: currentI, R: currentR }
        : null
    ),
    [currentI, currentR, currentU, switchClosed],
  );

  const configSignature = [
    source.id,
    bulb.id,
    internalResistance.toFixed(6),
    ammeterResistance.toFixed(6),
    ratedVoltage.toFixed(6),
    ratedPower.toFixed(6),
    coldResistance.toFixed(6),
  ].join('|');

  useEffect(() => {
    if (lastConfigRef.current === null) {
      lastConfigRef.current = configSignature;
      return;
    }

    if (lastConfigRef.current !== configSignature) {
      lastConfigRef.current = configSignature;
      nextIdRef.current = 1;
      setSamples([]);
    }
  }, [configSignature]);

  const handleRecordCurrent = useCallback(() => {
    if (!currentPoint) return;
    setSamples((prev) => upsertBulbSample(prev, currentPoint, nextIdRef));
  }, [currentPoint]);

  const handleClear = useCallback(() => {
    nextIdRef.current = 1;
    setSamples([]);
  }, []);

  const handleGenerateExample = useCallback(() => {
    const sampleSourceVoltage = Math.max(emf, ratedVoltage * 1.6, 2);
    const generated = Array.from({ length: 8 }, (_, index) => {
      const point = solveBulbOperatingPoint({
        emf: (sampleSourceVoltage * (index + 1)) / 8,
        internalResistance,
        ammeterResistance,
        ratedVoltage,
        ratedPower,
        coldResistance,
      });
      return {
        id: index + 1,
        U: point.voltage,
        I: point.current,
        R: point.resistance,
      };
    }).filter((point, index, list) => index === 0 || Math.abs(point.U - list[index - 1]!.U) > 1e-4);

    nextIdRef.current = generated.length + 1;
    setSamples(generated);
  }, [ammeterResistance, coldResistance, emf, internalResistance, ratedPower, ratedVoltage]);
  const sampleRows = useMemo<ExperimentDataRow[]>(
    () =>
      samples.map((sample) => ({
        key: sample.id,
        cells: [
          `#${sample.id}`,
          `${sample.U.toFixed(3)} V`,
          `${sample.I.toFixed(3)} A`,
          `${sample.R.toFixed(2)} Ω`,
        ],
      })),
    [samples],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const c = canvas.getContext('2d');
    if (!c) return;

    const dpr = window.devicePixelRatio || 1;
    const width = 360;
    const height = 248;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    c.scale(dpr, dpr);

    drawBulbCharacteristicChart(
      c,
      { x: 0, y: 0, width, height },
      { samples, currentPoint, sourceVoltage: emf },
    );
  }, [currentPoint, emf, samples]);

  return (
    <InfoCard title="灯泡伏安特性曲线" defaultOpen style={{ minWidth: 392, maxWidth: 392 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CircuitMetricList
          metrics={[
            {
              label: '当前电压 U',
              value: `${currentU.toFixed(2)} V`,
            },
            {
              label: '当前电流 I',
              value: formatCurrent(currentI),
            },
            {
              label: '此时等效电阻',
              value: currentI > 1e-7 ? formatResistance(currentR, currentR < 1000 ? 1 : 0) : '—',
            },
          ]}
        />

        <div style={{ fontSize: 11, color: COLORS.textSecondary, lineHeight: 1.7 }}>
          调节电源电压后，当前工作点会自动更新；点击“记录当前数据”即可把该点加入伏安曲线。
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: COLORS.text }}>
            已记录 <strong>{samples.length}</strong> 个数据点
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={handleRecordCurrent}
              disabled={!currentPoint}
              style={experimentButtonStyle(!currentPoint)}
            >
              记录当前数据
            </button>
            <button onClick={handleClear} style={experimentButtonStyle(false, true)}>
              清空数据
            </button>
            <button onClick={handleGenerateExample} style={experimentButtonStyle(false, true)}>
              自动生成示例数据
            </button>
          </div>
        </div>

        <canvas ref={canvasRef} style={{ display: 'block', width: 360, height: 248 }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: COLORS.textSecondary }}>原始采样列表</div>
          <ExperimentDataTable
            columns={['点', 'U', 'I', '等效 R']}
            rows={sampleRows}
            emptyText="点击“记录当前数据”或“自动生成示例数据”后，这里会列出每个工作点。"
          />
        </div>
      </div>
    </InfoCard>
  );
}

function upsertBulbSample(
  samples: BulbCurveSample[],
  sample: Omit<BulbCurveSample, 'id'>,
  nextIdRef: React.MutableRefObject<number>,
): BulbCurveSample[] {
  const index = samples.findIndex((item) => Math.abs(item.U - sample.U) < 0.02);
  if (index >= 0) {
    const copy = [...samples];
    copy[index] = { ...sample, id: copy[index]!.id };
    return copy.sort((a, b) => a.U - b.U);
  }

  const next = { ...sample, id: nextIdRef.current++ };
  return [...samples, next].sort((a, b) => a.U - b.U);
}

function drawBulbCharacteristicChart(
  c: CanvasRenderingContext2D,
  rect: { x: number; y: number; width: number; height: number },
  data: {
    samples: BulbCurveSample[];
    currentPoint: Omit<BulbCurveSample, 'id'> | null;
    sourceVoltage: number;
  },
) {
  const { x, y, width, height } = rect;
  const { samples, currentPoint, sourceVoltage } = data;
  const orderedSamples = [...samples].sort((a, b) => a.U - b.U);
  const allPoints = currentPoint ? [...orderedSamples, currentPoint] : orderedSamples;

  const pad = { left: 46, right: 16, top: 18, bottom: 34 };
  const plotX = x + pad.left;
  const plotY = y + pad.top;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxU = Math.max(1, sourceVoltage * 1.05, ...allPoints.map((point) => point.U * 1.12));
  const maxI = Math.max(0.05, ...allPoints.map((point) => point.I * 1.18));
  const toScreenX = (voltage: number) => plotX + (voltage / maxU) * plotW;
  const toScreenY = (current: number) => plotY + plotH - (current / maxI) * plotH;
  const xTicks = 6;
  const yTicks = 5;
  const curveColor = '#D97706';
  const pointColor = '#B45309';
  const liveColor = COLORS.primary;

  c.clearRect(x, y, width, height);
  c.fillStyle = '#FFFFFF';
  c.fillRect(x, y, width, height);

  c.fillStyle = COLORS.text;
  c.font = '600 12px Inter, sans-serif';
  c.textAlign = 'left';
  c.fillText('灯泡伏安特性曲线', x + 12, y + 14);
  c.font = '10px Inter, sans-serif';
  c.fillStyle = COLORS.textSecondary;
  c.fillText('横轴 U / V，纵轴 I / A', x + 12, y + 30);

  c.strokeStyle = '#E5E7EB';
  c.lineWidth = 0.7;
  for (let index = 0; index <= xTicks; index++) {
    const sx = plotX + (plotW * index) / xTicks;
    c.beginPath();
    c.moveTo(sx, plotY);
    c.lineTo(sx, plotY + plotH);
    c.stroke();
  }
  for (let index = 0; index <= yTicks; index++) {
    const sy = plotY + (plotH * index) / yTicks;
    c.beginPath();
    c.moveTo(plotX, sy);
    c.lineTo(plotX + plotW, sy);
    c.stroke();
  }

  c.strokeStyle = '#374151';
  c.lineWidth = 1.4;
  c.beginPath();
  c.moveTo(plotX, plotY + plotH);
  c.lineTo(plotX + plotW, plotY + plotH);
  c.stroke();
  c.beginPath();
  c.moveTo(plotX, plotY + plotH);
  c.lineTo(plotX, plotY);
  c.stroke();

  c.fillStyle = COLORS.textSecondary;
  c.font = '9px Inter, sans-serif';
  c.textAlign = 'center';
  for (let index = 0; index <= xTicks; index++) {
    const value = (maxU * index) / xTicks;
    c.fillText(value.toFixed(maxU <= 6 ? 1 : 0), plotX + (plotW * index) / xTicks, plotY + plotH + 14);
  }
  c.textAlign = 'right';
  for (let index = 0; index <= yTicks; index++) {
    const value = maxI - (maxI * index) / yTicks;
    c.fillText(value.toFixed(maxI <= 1 ? 2 : 1), plotX - 6, plotY + (plotH * index) / yTicks + 3);
  }
  c.textAlign = 'center';
  c.fillText('U / V', plotX + plotW / 2, plotY + plotH + 28);
  c.save();
  c.translate(plotX - 30, plotY + plotH / 2);
  c.rotate(-Math.PI / 2);
  c.fillText('I / A', 0, 0);
  c.restore();

  if (orderedSamples.length >= 2) {
    c.beginPath();
    c.strokeStyle = curveColor;
    c.lineWidth = 2;
    orderedSamples.forEach((point, index) => {
      const px = toScreenX(point.U);
      const py = toScreenY(point.I);
      if (index === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    });
    c.stroke();
  }

  orderedSamples.forEach((point) => {
    const px = toScreenX(point.U);
    const py = toScreenY(point.I);
    c.beginPath();
    c.fillStyle = pointColor;
    c.arc(px, py, 3.8, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.fillStyle = '#FFFFFF';
    c.arc(px, py, 1.4, 0, Math.PI * 2);
    c.fill();
  });

  if (currentPoint) {
    const px = toScreenX(currentPoint.U);
    const py = toScreenY(currentPoint.I);
    c.strokeStyle = `${liveColor}66`;
    c.lineWidth = 1;
    c.setLineDash([4, 3]);
    c.beginPath();
    c.moveTo(px, plotY + plotH);
    c.lineTo(px, py);
    c.lineTo(plotX, py);
    c.stroke();
    c.setLineDash([]);

    c.beginPath();
    c.fillStyle = '#FFFFFF';
    c.arc(px, py, 5.2, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.strokeStyle = liveColor;
    c.lineWidth = 2.2;
    c.arc(px, py, 5.2, 0, Math.PI * 2);
    c.stroke();
    c.fillStyle = liveColor;
    c.font = '10px Inter, sans-serif';
    c.textAlign = 'left';
    c.fillText(`当前点 (${currentPoint.U.toFixed(2)}, ${currentPoint.I.toFixed(3)})`, px + 8, py - 6);
  }

  if (orderedSamples.length === 0) {
    c.fillStyle = COLORS.textMuted;
    c.font = '11px Inter, sans-serif';
    c.textAlign = 'center';
    c.fillText('调节电压后点击“记录当前数据”', plotX + plotW / 2, plotY + plotH / 2 - 8);
    c.fillText('即可逐步生成灯泡伏安特性曲线', plotX + plotW / 2, plotY + plotH / 2 + 10);
  } else {
    c.fillStyle = COLORS.textSecondary;
    c.font = '10px Inter, sans-serif';
    c.textAlign = 'right';
    c.fillText('曲线变缓表示灯丝升温、电阻增大', plotX + plotW, plotY + 10);
  }
}

function MotorTeachingCard({
  source,
  entities,
}: {
  source: Entity;
  entities: Map<string, Entity>;
}) {
  const motor = findComponent(entities, 'motor');
  if (!motor) return null;

  const current = (motor.properties.current as number) ?? 0;
  const voltage = (motor.properties.voltage as number) ?? 0;
  const electricPower = (motor.properties.electricPower as number) ?? 0;
  const heatPower = (motor.properties.heatPower as number) ?? 0;
  const mechanicalPower = (motor.properties.mechanicalPower as number) ?? 0;
  const backEmf = (motor.properties.backEmf as number) ?? 0;
  const coilResistance = (motor.properties.coilResistance as number) ?? 0;
  const sourceEmf = (source.properties.emf as number) ?? 0;
  const sourceResistance = (source.properties.internalResistance as number) ?? 0;
  const powerMax = Math.max(electricPower, heatPower, mechanicalPower, 0.001);
  const heatShare = electricPower > 1e-9 ? (heatPower / electricPower) * 100 : 0;
  const mechanicalShare = electricPower > 1e-9 ? (mechanicalPower / electricPower) * 100 : 0;

  return (
    <InfoCard title="电动机教学信息" defaultOpen style={{ minWidth: 392, maxWidth: 392 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CircuitMetricList
          metrics={[
            {
              label: '电流 I',
              value: formatCurrent(current),
            },
            {
              label: '两端电压 U',
              value: formatVoltage(voltage),
            },
            {
              label: '电功率 P电',
              value: formatPower(electricPower),
              highlighted: true,
            },
            {
              label: '热功率 P热',
              value: formatPower(heatPower),
            },
            {
              label: '机械功率 P机',
              value: formatPower(mechanicalPower),
            },
            {
              label: '机械占比',
              value: `${mechanicalShare.toFixed(1)}%`,
            },
          ]}
        />

        <div
          style={{
            borderRadius: RADIUS.sm,
            border: `1px solid ${COLORS.border}`,
            backgroundColor: COLORS.bgMuted,
            padding: '8px 10px',
            fontSize: 11,
            color: COLORS.text,
            lineHeight: 1.7,
          }}
        >
          <div>P电 ≈ P热 + P机 = {formatPower(heatPower + mechanicalPower)}</div>
          <div>当前热损耗占比 {heatShare.toFixed(1)}%，机械输出占比 {mechanicalShare.toFixed(1)}%</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height: 136 }}>
          {[
            { key: 'electric', label: 'P电', value: electricPower, color: '#2563EB' },
            { key: 'heat', label: 'P热', value: heatPower, color: '#F97316' },
            { key: 'mechanical', label: 'P机', value: mechanicalPower, color: '#16A34A' },
          ].map((item) => (
            <div key={item.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  height: 100,
                  borderRadius: RADIUS.sm,
                  backgroundColor: COLORS.bgMuted,
                  padding: '0 10px 8px',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    maxWidth: 64,
                    height: item.value > 0 ? `${Math.max(10, (item.value / powerMax) * 88)}px` : '0px',
                    borderRadius: 8,
                    backgroundColor: item.color,
                  }}
                />
              </div>
              <div style={{ textAlign: 'center', fontSize: 10, color: COLORS.textSecondary }}>
                <div style={{ fontWeight: 600, color: COLORS.text }}>{item.label}</div>
                <div>{formatPower(item.value)}</div>
              </div>
            </div>
          ))}
        </div>

        <CircuitMetricList
          metrics={[
            {
              label: '电源电动势 ε',
              value: `${sourceEmf.toFixed(2)} V`,
            },
            {
              label: '反电动势 ε反',
              value: `${backEmf.toFixed(2)} V`,
            },
            {
              label: '线圈电阻 R线圈',
              value: `${coilResistance.toFixed(2)} Ω`,
            },
            {
              label: '电源内阻 r',
              value: `${sourceResistance.toFixed(2)} Ω`,
            },
          ]}
        />

        <div style={{ fontSize: 10, color: COLORS.textSecondary, lineHeight: 1.7 }}>
          <div>参数趋势：增大电源电动势 ε，电流 I、两端电压 U 与输入功率 P电 通常同步增大。</div>
          <div>参数趋势：增大反电动势 ε反，会减小电流与热损耗；机械功率是否继续增大，要结合 ε 与 ε反 的相对大小判断。</div>
          <div>参数趋势：增大线圈电阻或电源内阻，会让总电流减小，因此 P热 与 P机 一般都会下降。</div>
        </div>
      </div>
    </InfoCard>
  );
}

// ─── 主入口：组装所有卡片 ───

export function CircuitInfoCards({ entities }: { entities: Map<string, Entity> }) {
  let source: Entity | undefined;
  for (const entity of entities.values()) {
    if (entity.type === 'dc-source') {
      source = entity;
      break;
    }
  }

  if (!source) return null;

  const circuitType = source.properties.circuitType as string | undefined;
  if (!circuitType) return null;
  const isHalfDeflection = isHalfDeflectionCircuitType(circuitType);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        maxHeight: 'calc(100% - 60px)',
        overflowY: 'auto',
        pointerEvents: 'auto',
      }}
    >
      {isHalfDeflection && (
        <HalfDeflectionTeachingCard
          source={source}
          entities={entities}
          circuitType={circuitType}
        />
      )}
      {circuitType === 'ohmmeter' && <OhmmeterTeachingCard source={source} entities={entities} />}
      {circuitType === 'bulb-circuit' && <BulbVoltammetryCard source={source} entities={entities} />}
      {circuitType === 'motor-circuit' && <MotorTeachingCard source={source} entities={entities} />}
      {circuitType !== 'voltammetry-compare' && <FormulaCard circuitType={circuitType} source={source} />}
      {!isHalfDeflection && circuitType !== 'voltammetry-compare' && (
        <MeasurementCard circuitType={circuitType} source={source} />
      )}
      {circuitType !== 'voltammetry-compare' && <StepGuideCard circuitType={circuitType} source={source} />}
      {circuitType === 'voltammetry-compare' && <CompareTableCard source={source} />}
      {circuitType === 'measure-emf-r' && <UIChartCard source={source} entities={entities} />}
    </div>
  );
}

// ─── 数据函数（从 circuit-viewport 搬过来） ───

function getFormulasForCircuit(circuitType: string, source: Entity): string[] {
  const method = source.properties.currentMethod as string | undefined;
  const measureMode = source.properties.measureMode as string | undefined;
  switch (circuitType) {
    case 'voltammetry-internal':
      return ['R测 = U_V / I_A = Rx + rA（偏大）', '适用条件：Rx > √(rA·rV)（大电阻用内接）'];
    case 'voltammetry-external':
      return ['R测 = U_V / I_A = Rx·rV/(Rx+rV)（偏小）', '适用条件：Rx < √(rA·rV)（小电阻用外接）'];
    case 'voltammetry-compare':
      return method === 'internal'
        ? ['当前：内接法 R测=Rx+rA（偏大）', '判据：Rx > √(rA·rV) 时优先内接']
        : ['当前：外接法 R测=Rx∥rV（偏小）', '判据：Rx < √(rA·rV) 时优先外接'];
    case 'measure-emf-r':
      return measureMode === 'divider'
        ? ['U = ε - I·r （U-I线性关系）', '分压式只负责改变外电路等效电阻，采样仍取端电压 U 与主支路电流 I', '滑片输出只是调节手段，不是测量量']
        : ['U = ε - I·r （U-I线性关系）', '斜率=-r  截距=ε', '调R改变I，测多组(U,I)数据'];
    case 'half-deflection-ammeter':
      return [
        '步骤一：I₀ = ε / (r + rA)',
        "步骤二：S'闭合后，A表支路与R'支路并联",
        "教材近似：I_A = I₀/2 时，可取 r ≈ R'",
        "严格模型：R'半偏 = r·rA / (r + rA)",
      ];
    case 'half-deflection-voltmeter':
      return [
        '基准：U₀ = ε·rV / (R滑 + r电源 + rV)',
        "理想半偏：R' ≈ rV（分压近似不变）",
        "真实半偏：R' = R滑 + r电源 + rV > rV",
      ];
    case 'ohmmeter':
      return [
        '电流：I = E / (Rg + r + R0 + Rx)',
        '调零：Rx = 0 时调 R0 使 I = Ig',
        '理想调零后：θ = I / Ig = (Rg + r + R0) / (Rg + r + R0 + Rx)',
        '中值电阻：Rx = R中 时 θ = 1/2，且 R中 = Rg + r + R0 = E / Ig',
      ];
    case 'wheatstone-bridge':
      return ['平衡条件：R₁/R₂ = R₃/R₄', 'Ig=0 → R₃ = R₁·R₄/R₂'];
    case 'bulb-circuit':
      return ['R热 = U²额/P额（热态电阻）', 'R随I非线性增大', 'I-U曲线为曲线（非直线）'];
    case 'motor-circuit':
      return ['I = (ε-ε反)/(R线圈+r)', 'P电=UI  P热=I²R  P机=ε反·I', '非纯电阻：P电 ≠ I²R'];
    default:
      return [];
  }
}

interface StepLine {
  text: string;
  color: string;
  bold?: boolean;
}

function getStepGuideLines(circuitType: string, source: Entity): StepLine[] {
  const step = source.properties.step as string | undefined;
  if (!step || step === 'off') return [];

  const lines: StepLine[] = [];

  if (circuitType === 'half-deflection-ammeter' || circuitType === 'half-deflection-voltmeter') {
    const mode = getHalfDeflectionMode(circuitType);
    const referenceReading = source.properties.referenceReading as number | undefined;
    const targetReading = source.properties.targetHalfReading as number | undefined;
    const currentReading = source.properties.currentReading as number | undefined;
    const currentHalfResistance = source.properties.currentHalfResistance as number | undefined;
    const trueInternalResistance = source.properties.trueInternalResistance as number | undefined;
    const readingFormatter = mode === 'ammeter' ? formatCurrent : formatVoltage;

    if (step === 'step1') {
      lines.push({
        text: mode === 'ammeter' ? '步骤一：记录基准电流 I0' : '步骤一：记录基准电压 U0',
        color: COLORS.text,
        bold: true,
      });
      lines.push({
        text:
          mode === 'ammeter'
            ? "S闭合、S'断开，仅保留A表主支路"
            : "S闭合、S'闭合（R'被短接），调节滑动变阻器得到合适示数",
        color: COLORS.textSecondary,
      });
      if (referenceReading !== undefined) {
        lines.push({
          text: `${mode === 'ammeter' ? '当前 I0' : '当前 U0'} = ${readingFormatter(referenceReading)}`,
          color: COLORS.primary,
        });
      }
    } else if (step === 'step2') {
      lines.push({
        text: mode === 'ammeter' ? "步骤二：闭合S'并调R'使A表半偏" : "步骤二：调R'使电压表半偏",
        color: COLORS.text,
        bold: true,
      });
      lines.push({
        text:
          mode === 'ammeter'
            ? "R'直接并联在A表两端，目标是 I_A = I0/2"
            : "断开S'，调R'使示数变为 U0/2",
        color: COLORS.textSecondary,
      });
      if (targetReading !== undefined) {
        lines.push({
          text: `${mode === 'ammeter' ? '目标 I0/2' : '目标 U0/2'} = ${readingFormatter(targetReading)}`,
          color: COLORS.warning,
        });
      }
      if (currentReading !== undefined) {
        lines.push({
          text: `${mode === 'ammeter' ? '当前示数' : '当前示数'} = ${readingFormatter(currentReading)}`,
          color: COLORS.textSecondary,
        });
      }
      const isHalf = source.properties.isHalfDeflection as boolean | undefined;
      if (
        isHalf &&
        currentHalfResistance !== undefined &&
        trueInternalResistance !== undefined
      ) {
        lines.push({ text: '✓ 已半偏', color: COLORS.primary });
        lines.push({
          text: mode === 'ammeter'
            ? `按教材近似：r≈R'=${formatResistance(currentHalfResistance, 2)}；真值 r=${formatResistance(trueInternalResistance, 2)}`
            : `R'=${formatResistance(currentHalfResistance, 0)}，内阻真值=${formatResistance(trueInternalResistance, 0)}`,
          color: COLORS.primary,
        });
      }
    }
  } else if (circuitType === 'ohmmeter') {
    const R_mid = source.properties.R_mid as number | undefined;
    const zeroingThetaAtRxZero = source.properties.zeroingThetaAtRxZero as number | undefined;
    const canZero = source.properties.canZero as boolean | undefined;
    if (step === 'zeroing') {
      lines.push({ text: '步骤一：调零', color: COLORS.text, bold: true });
      lines.push({ text: '短接红黑表笔（Rx=0）', color: COLORS.textSecondary });
      lines.push({ text: '调节调零旋钮使指针满偏', color: COLORS.textSecondary });
      if (zeroingThetaAtRxZero !== undefined)
        lines.push({ text: `当前 Rx=0 时偏转比 θ=${zeroingThetaAtRxZero.toFixed(2)}`, color: COLORS.warning });
      if (R_mid !== undefined)
        lines.push({ text: `理想中值电阻 R中=${Math.round(R_mid)}Ω`, color: COLORS.primary });
      if (canZero === false)
        lines.push({ text: '当前参数下无法通过非负 R0 调到满偏，请增大 E/Ig 或减小 Rg+r', color: COLORS.warning });
    } else if (step === 'measuring') {
      lines.push({ text: '步骤二：测量', color: COLORS.text, bold: true });
      lines.push({ text: '✓ 已调零，接入待测电阻Rx', color: COLORS.primary });
      const ohmR = source.properties.ohmReading as number | undefined;
      const trueRx = source.properties.trueRx as number | undefined;
      const isMidResistance = source.properties.isMidResistance as boolean | undefined;
      const isHalfDeflection = source.properties.isHalfDeflection as boolean | undefined;
      if (ohmR !== undefined && isFinite(ohmR))
        lines.push({ text: `表盘读数：${ohmR.toFixed(0)}Ω`, color: COLORS.primary });
      if (trueRx !== undefined)
        lines.push({ text: `真实值Rx=${trueRx}Ω`, color: COLORS.textSecondary });
      if (isMidResistance && isHalfDeflection) {
        lines.push({ text: '✓ 当前为中值电阻，指针半偏', color: COLORS.primary, bold: true });
      }
    }
  } else if (circuitType === 'wheatstone-bridge') {
    if (step === 'balancing') {
      lines.push({ text: '调节R₄使电流计归零', color: COLORS.text, bold: true });
      const theoR4 = source.properties.theoreticalR4 as number | undefined;
      if (theoR4 !== undefined)
        lines.push({ text: `理论平衡值 R₄=${theoR4.toFixed(0)}Ω`, color: COLORS.primary });
      lines.push({ text: '平衡条件：R₁/R₂ = R₃/R₄', color: COLORS.textSecondary });
    } else if (step === 'balanced') {
      lines.push({ text: '✓ 电桥已平衡', color: COLORS.primary, bold: true });
      const cond = source.properties.balanceCondition as string | undefined;
      if (cond) lines.push({ text: cond, color: COLORS.primary });
    }
  }

  return lines;
}
