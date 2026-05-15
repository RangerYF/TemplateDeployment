import { useMemo, useState, type ReactNode } from 'react';
import { COLORS, SHADOWS } from '@/styles/tokens';
import {
  buildMeasureEmfResistanceSamples,
  calculateMeasureEmfPoint,
  fitMeasureEmfPoints,
  resolveMeasureEmfResistance,
  type MeasureEmfCompareParams,
  type MeasureEmfFit,
  type MeasureEmfMode,
  type MeasureEmfPoint,
} from '@/domains/em/logic/measure-emf-r-comparison';

type MeasureEmfViewTab = 'variable' | 'divider' | 'chart';

interface Props {
  onBack: () => void;
}

interface SampleRecord {
  id: string;
  resistance: number;
  point: MeasureEmfPoint;
}

const DEFAULT_PARAMS: MeasureEmfCompareParams = {
  emf: 4.5,
  internalResistance: 0.5,
  ammeterResistance: 0.1,
  voltmeterResistance: 15000,
  maxResistance: 50,
  sliderRatio: 0.5,
  loadResistance: 20,
  sampleCount: 8,
};

const MODE_META: Record<
  MeasureEmfMode,
  {
    title: string;
    short: string;
    color: string;
    currentLabel: string;
    voltageLabel: string;
    circuitNote: string;
    lineStyle: 'solid' | 'dashed';
    modeLabel: string;
  }
> = {
  variable: {
    title: '限流接法',
    short: '限流',
    color: '#D97706',
    currentLabel: 'I',
    voltageLabel: 'U',
    circuitNote: '滑动变阻器串联在主回路中，改变主支路电流后读取电源端电压与电流表读数。',
    lineStyle: 'solid',
    modeLabel: '限流',
  },
  divider: {
    title: '分压接法',
    short: '分压',
    color: '#059669',
    currentLabel: 'I',
    voltageLabel: 'U',
    circuitNote: '滑动变阻器整段跨接在电源两端，滑片只负责改变外电路等效电阻；采样仍读取电源端电压与主支路电流。',
    lineStyle: 'dashed',
    modeLabel: '分压',
  },
};

const pageStyle = {
  pageBg: COLORS.bgPage,
  panelBg: COLORS.bg,
  panelSoft: COLORS.bg,
  blockBg: COLORS.bg,
  blockSoft: COLORS.bgMuted,
  border: COLORS.border,
  text: COLORS.text,
  muted: COLORS.textMuted,
  secondary: COLORS.textSecondary,
  accent: COLORS.primary,
  accentSoft: COLORS.primaryLight,
};

export function MeasureEmfComparisonView({ onBack }: Props) {
  const [params, setParams] = useState<MeasureEmfCompareParams>(DEFAULT_PARAMS);
  const [activeTab, setActiveTab] = useState<MeasureEmfViewTab>('chart');

  const sampleRecords = useMemo<Record<MeasureEmfMode, SampleRecord[]>>(() => {
    const resistances = buildMeasureEmfResistanceSamples(params.maxResistance, params.sampleCount ?? 8);
    return {
      variable: resistances.map((resistance, index) => ({
        id: `variable-${index}`,
        resistance,
        point: calculateMeasureEmfPoint('variable', params, resistance),
      })),
      divider: resistances.map((resistance, index) => ({
        id: `divider-${index}`,
        resistance,
        point: calculateMeasureEmfPoint('divider', params, resistance),
      })),
    };
  }, [params]);

  const activeMode: MeasureEmfMode = activeTab === 'chart' ? 'variable' : activeTab;
  const currentResistance = useMemo(
    () => resolveMeasureEmfResistance(params),
    [params],
  );

  const currentPoints = useMemo<Record<MeasureEmfMode, MeasureEmfPoint>>(() => ({
    variable: calculateMeasureEmfPoint('variable', params, currentResistance),
    divider: calculateMeasureEmfPoint('divider', params, currentResistance),
  }), [currentResistance, params]);

  const fitted = useMemo<Record<MeasureEmfMode, MeasureEmfFit | null>>(() => ({
    variable: fitMeasureEmfPoints(sampleRecords.variable.map((item) => item.point)),
    divider: fitMeasureEmfPoints(sampleRecords.divider.map((item) => item.point)),
  }), [sampleRecords]);

  const activeMeta = MODE_META[activeMode];
  const activePoint = currentPoints[activeMode];
  const activeFit = fitted[activeMode];

  const set = (key: keyof MeasureEmfCompareParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ backgroundColor: pageStyle.pageBg }}>
      <header
        className="flex items-center gap-3 px-5 py-3"
        style={{ borderBottom: `1px solid ${pageStyle.border}`, backgroundColor: pageStyle.panelBg }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1 text-xs font-medium"
          style={{
            color: pageStyle.text,
            border: `1px solid ${pageStyle.border}`,
            backgroundColor: pageStyle.blockBg,
          }}
        >
          ← 返回
        </button>
        <div>
          <h1 className="text-sm font-semibold" style={{ color: pageStyle.text }}>
            测电源电动势及内阻
          </h1>
          <div className="text-[11px]" style={{ color: pageStyle.muted }}>
            限流接法 / 分压接法 / U-I 图像法
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="flex w-[320px] shrink-0 flex-col overflow-y-auto border-r p-4"
          style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.panelSoft }}
        >
          <PanelSection title="实验方案切换">
            <div className="flex flex-wrap gap-2">
              <TabButton label="图像对比" active={activeTab === 'chart'} onClick={() => setActiveTab('chart')} color={pageStyle.accent} />
              <TabButton label="限流接法" active={activeTab === 'variable'} onClick={() => setActiveTab('variable')} color={MODE_META.variable.color} />
              <TabButton label="分压接法" active={activeTab === 'divider'} onClick={() => setActiveTab('divider')} color={MODE_META.divider.color} />
            </div>
          </PanelSection>

          <PanelSection title="电源参数">
            <RangeControl label="电动势 E" value={params.emf} min={1} max={12} step={0.1} unit="V" onChange={(value) => set('emf', value)} />
            <RangeControl label="内阻 r" value={params.internalResistance} min={0.1} max={5} step={0.1} unit="Ω" onChange={(value) => set('internalResistance', value)} />
          </PanelSection>

          <PanelSection title="仪表参数">
            <RangeControl label="电流表内阻 rA" value={params.ammeterResistance} min={0.01} max={1} step={0.01} unit="Ω" onChange={(value) => set('ammeterResistance', value)} />
            <RangeControl label="电压表内阻 rV" value={params.voltmeterResistance} min={1000} max={30000} step={100} unit="Ω" onChange={(value) => set('voltmeterResistance', value)} />
          </PanelSection>

          <PanelSection title="滑动变阻器与负载">
            <RangeControl label="滑变总阻值" value={params.maxResistance} min={10} max={200} step={1} unit="Ω" onChange={(value) => set('maxResistance', value)} />
            <RangeControl label="滑片位置" value={params.sliderRatio} min={0.05} max={1} step={0.01} unit="" onChange={(value) => set('sliderRatio', value)} />
            <RangeControl label="负载电阻" value={params.loadResistance} min={1} max={100} step={1} unit="Ω" onChange={(value) => set('loadResistance', value)} />
            <div
              className="mt-2 rounded-lg px-3 py-2 text-[11px]"
              style={{ backgroundColor: pageStyle.blockSoft, color: pageStyle.secondary, lineHeight: 1.7 }}
            >
              当前滑变总阻值：<strong style={{ color: pageStyle.text }}>{formatResistance(currentResistance, 2)}</strong>
            </div>
          </PanelSection>

          <PanelSection title="实验说明">
            <div className="space-y-1 text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.8 }}>
              <div>1. 这一页直接把限流、分压和 U-I 图像法放在同一实验里，不再拆成重复模块。</div>
              <div>2. 关键输出是把两种接法的 U-I 直线放在同一张图中对比截距与斜率。</div>
              <div>3. 限流接法里滑动变阻器串联在主回路中；分压接法里滑片只负责调节外电路等效电阻。</div>
              <div>4. 图上纵截距表示 E，斜率绝对值表示 r。</div>
            </div>
          </PanelSection>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <PanelCard
              title={activeTab === 'chart' ? '标准电路图（左：限流，右：分压）' : `${activeMeta.title}标准电路图`}
              subtitle={activeTab === 'chart' ? '两个接法放在同一实验页中对照，便于减少重复模块。' : activeMeta.circuitNote}
            >
              {activeTab === 'chart' ? (
                <div className="grid gap-5 lg:grid-cols-2">
                  <MeasureCircuitDiagram mode="variable" />
                  <MeasureCircuitDiagram mode="divider" />
                </div>
              ) : (
                <MeasureCircuitDiagram mode={activeMode} />
              )}
            </PanelCard>

            <PanelCard
              title="U-I 图像"
              subtitle="横轴 I，纵轴 U；纵截距表示 E，斜率绝对值表示内阻 r。"
            >
              <MeasureEmfChart
                activeTab={activeTab}
                currentPoints={currentPoints}
                fitted={fitted}
                sampleRecords={sampleRecords}
              />
            </PanelCard>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
            <PanelCard title="采样数据表" subtitle="自动给出两种接法的多组采样点，直接用于 U-I 直线对比。">
              <MeasureDataTable
                mode={activeMode}
                records={sampleRecords[activeMode]}
                fit={activeFit}
                trueEmf={params.emf}
                trueResistance={params.internalResistance}
              />
            </PanelCard>

            <PanelCard title="当前结论" subtitle="当前工作点、拟合结果和接法差异同步更新。">
              <ResultList
                rows={activeTab === 'chart'
                  ? [
                    { label: '当前方案', value: '图像对比' },
                    { label: '当前 R滑', value: formatResistance(currentResistance, 2) },
                    { label: '限流当前 I', value: formatCurrent(currentPoints.variable.I, 3) },
                    { label: '限流当前 U', value: formatVoltage(currentPoints.variable.U, 3) },
                    { label: '分压当前 I', value: formatCurrent(currentPoints.divider.I, 3) },
                    { label: '分压当前 U', value: formatVoltage(currentPoints.divider.U, 3) },
                    { label: '限流拟合 E', value: fitted.variable ? formatVoltage(fitted.variable.emf, 3) : '—' },
                    { label: '限流拟合 r', value: fitted.variable ? formatResistance(fitted.variable.r, 3) : '—' },
                    { label: '分压拟合 E', value: fitted.divider ? formatVoltage(fitted.divider.emf, 3) : '—' },
                    { label: '分压拟合 r', value: fitted.divider ? formatResistance(fitted.divider.r, 3) : '—' },
                    {
                      label: '限流 r 误差',
                      value: fitted.variable ? formatPercent(((fitted.variable.r - params.internalResistance) / Math.max(params.internalResistance, 1e-6)) * 100) : '—',
                    },
                    {
                      label: '分压 r 误差',
                      value: fitted.divider ? formatPercent(((fitted.divider.r - params.internalResistance) / Math.max(params.internalResistance, 1e-6)) * 100) : '—',
                    },
                    { label: '限流采样点', value: `${sampleRecords.variable.length} 个` },
                    { label: '分压采样点', value: `${sampleRecords.divider.length} 个` },
                  ]
                  : [
                    { label: '当前方案', value: activeMeta.title },
                    { label: '当前电流读数', value: formatCurrent(activePoint.I, 3) },
                    { label: '当前电压读数', value: formatVoltage(activePoint.U, 3) },
                    { label: '主回路总电流', value: formatCurrent(activePoint.state.totalCurrent, 3) },
                    { label: '采样点数', value: `${sampleRecords[activeMode].length} 个` },
                    { label: '拟合 E', value: activeFit ? formatVoltage(activeFit.emf, 3) : '—' },
                    { label: '拟合 r', value: activeFit ? formatResistance(activeFit.r, 3) : '—' },
                    {
                      label: 'r 相对误差',
                      value: activeFit ? formatPercent(((activeFit.r - params.internalResistance) / Math.max(params.internalResistance, 1e-6)) * 100) : '—',
                    },
                    {
                      label: activeMode === 'divider' ? '滑片输出电压' : '滑变两端电压',
                      value: formatVoltage(activePoint.state.outputVoltage, 3),
                    },
                    {
                      label: activeMode === 'divider' ? '负载支路电流' : '主支路电流',
                      value: formatCurrent(activePoint.state.outputCurrent, 3),
                    },
                  ]}
              />
            </PanelCard>
          </div>
        </main>
      </div>
    </div>
  );
}

function MeasureCircuitDiagram({
  mode,
}: {
  mode: MeasureEmfMode;
}) {
  const stroke = '#111111';
  const accent = MODE_META[mode].color;
  const isDivider = mode === 'divider';

  return (
    <svg viewBox="0 0 620 320" className="w-full">
      <rect x="1" y="1" width="618" height="318" rx="10" fill="#FFFFFF" stroke="#E5E7EB" />

      <g stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M56 68 V110" />
        <path d="M56 152 V256 H566 V68 H56" />
        <path d="M56 68 H120" />
        <path d="M160 68 H206" />
      </g>

      <BatterySymbol x={56} top={110} bottom={152} />
      <SwitchSymbol x1={120} x2={160} y={68} />
      <AmmeterSymbol cx={206} cy={68} label="A" color={accent} />

      {isDivider ? (
        <>
          <g stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M232 68 H286" />
            <path d="M406 68 H566 V256" />
            <path d="M360 32 V180 H428" />
            <path d="M514 180 H566" />
          </g>
          <DividerRheostatSymbol x={286} y={52} width={120} height={48} />
          <FixedResistorSymbol x={428} y={168} width={86} height={24} />
          <VoltmeterBranch x1={56} yTop={68} yBottom={256} meterCx={176} meterCy={218} />
        </>
      ) : (
        <>
          <g stroke={stroke} strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <path d="M232 68 H286" />
            <path d="M336 32 H566 V256" />
          </g>
          <SeriesRheostatSymbol x={286} y={52} width={120} height={48} />
          <VoltmeterBranch x1={56} yTop={68} yBottom={256} meterCx={176} meterCy={218} />
        </>
      )}
    </svg>
  );
}

function VoltmeterBranch({
  x1,
  yTop,
  yBottom,
  meterCx,
  meterCy,
}: {
  x1: number;
  yTop: number;
  yBottom: number;
  meterCx: number;
  meterCy: number;
}) {
  return (
    <>
      <g stroke="#2563EB" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d={`M ${x1} ${yTop} V 174 H ${meterCx} V ${meterCy - 22}`} />
        <path d={`M ${meterCx} ${meterCy + 22} V ${yBottom} H ${x1}`} />
      </g>
      <VoltmeterSymbol cx={meterCx} cy={meterCy} label="V" color="#2563EB" />
    </>
  );
}

function MeasureEmfChart({
  activeTab,
  currentPoints,
  fitted,
  sampleRecords,
}: {
  activeTab: MeasureEmfViewTab;
  currentPoints: Record<MeasureEmfMode, MeasureEmfPoint>;
  fitted: Record<MeasureEmfMode, MeasureEmfFit | null>;
  sampleRecords: Record<MeasureEmfMode, SampleRecord[]>;
}) {
  const modes: MeasureEmfMode[] = activeTab === 'chart'
    ? ['variable', 'divider']
    : [activeTab];
  const allPoints = modes.flatMap((mode) => [
    currentPoints[mode],
    ...sampleRecords[mode].map((item) => item.point),
  ]);
  const maxI = Math.max(0.2, ...allPoints.map((point) => point.I)) * 1.15;
  const maxU = Math.max(1, ...allPoints.map((point) => point.U)) * 1.18;
  const x0 = 70;
  const y0 = 260;
  const plotW = 520;
  const plotH = 210;
  const toX = (value: number) => x0 + (value / Math.max(maxI, 1e-6)) * plotW;
  const toY = (value: number) => y0 - (value / Math.max(maxU, 1e-6)) * plotH;

  return (
    <svg viewBox="0 0 620 320" className="w-full">
      <rect x="1" y="1" width="618" height="318" rx="18" fill="#FFFFFF" stroke={pageStyle.border} />

      {Array.from({ length: 7 }).map((_, index) => {
        const x = x0 + (plotW * index) / 6;
        return <line key={`x-${index}`} x1={x} y1={y0 - plotH} x2={x} y2={y0} stroke="#E5E7EB" strokeWidth="1" />;
      })}
      {Array.from({ length: 6 }).map((_, index) => {
        const y = y0 - (plotH * index) / 5;
        return <line key={`y-${index}`} x1={x0} y1={y} x2={x0 + plotW} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
      })}

      <line x1={x0} y1={y0} x2={x0 + plotW + 10} y2={y0} stroke="#111111" strokeWidth="2" />
      <line x1={x0} y1={y0} x2={x0} y2={y0 - plotH - 10} stroke="#111111" strokeWidth="2" />
      <text x={x0 + plotW + 16} y={y0 + 4} fontSize="12" fill="#111111">I</text>
      <text x={x0 - 10} y={y0 - plotH - 14} fontSize="12" fill="#111111">U</text>

      {modes.map((mode) => {
        const fit = fitted[mode];
        const meta = MODE_META[mode];
        const current = currentPoints[mode];
        const samplePoints = sampleRecords[mode].map((item) => item.point);
        const strokeDasharray = meta.lineStyle === 'dashed' ? '7 5' : undefined;
        const yStart = fit ? fit.emf : current.U;
        const shortCurrent = fit && fit.r > 1e-9 ? fit.emf / fit.r : null;
        return (
          <g key={mode}>
            {fit && (
              <line
                x1={toX(0)}
                y1={toY(yStart)}
                x2={toX(shortCurrent != null ? Math.min(shortCurrent, maxI) : maxI)}
                y2={toY(shortCurrent != null ? 0 : Math.max(yStart - fit.r * maxI, 0))}
                stroke={meta.color}
                strokeWidth="2.6"
                strokeDasharray={strokeDasharray}
              />
            )}
            {samplePoints.map((point, index) => (
              <circle key={`${mode}-${index}`} cx={toX(point.I)} cy={toY(point.U)} r="4.5" fill={meta.color} opacity="0.78" />
            ))}
            <circle cx={toX(current.I)} cy={toY(current.U)} r="6.2" fill="#FFFFFF" stroke={meta.color} strokeWidth="2.4" />
            <text x={toX(current.I) + 10} y={toY(current.U) - 8} fontSize="11" fill={meta.color}>
              {meta.short}
            </text>
          </g>
        );
      })}

      <text x={x0 + plotW / 2} y={302} textAnchor="middle" fontSize="12" fill={pageStyle.secondary}>
        横轴：I / A
      </text>
      <text x="18" y={y0 - plotH / 2} textAnchor="middle" fontSize="12" fill={pageStyle.secondary} transform={`rotate(-90 18 ${y0 - plotH / 2})`}>
        纵轴：U / V
      </text>
      <text x="390" y="32" fontSize="11" fill={pageStyle.muted}>
        截距表示 E，斜率绝对值表示 r
      </text>
    </svg>
  );
}

function MeasureDataTable({
  mode,
  records,
  fit,
  trueEmf,
  trueResistance,
}: {
  mode: MeasureEmfMode;
  records: SampleRecord[];
  fit: MeasureEmfFit | null;
  trueEmf: number;
  trueResistance: number;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 760 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${pageStyle.border}` }}>
            <HeadCell>序号</HeadCell>
            <HeadCell right>R滑 / Ω</HeadCell>
            <HeadCell right>I / A</HeadCell>
            <HeadCell right>U / V</HeadCell>
            <HeadCell right>{mode === 'divider' ? 'U输出 / V' : '滑变压降 / V'}</HeadCell>
            <HeadCell right>拟合 E / V</HeadCell>
            <HeadCell right>拟合 r / Ω</HeadCell>
            <HeadCell right>E 误差</HeadCell>
            <HeadCell right>r 误差</HeadCell>
          </tr>
        </thead>
        <tbody>
          {records.length === 0 ? (
            <tr>
              <td colSpan={9} className="px-4 py-6 text-center text-sm" style={{ color: pageStyle.muted }}>
                还没有记录采样点。先调节滑动变阻器，再点击“记录当前数据”。
              </td>
            </tr>
          ) : records.map((record, index) => (
            <tr key={record.id} style={{ borderBottom: `1px solid ${pageStyle.border}` }}>
              <BodyCell>{String(index + 1)}</BodyCell>
              <BodyCell>{formatResistance(record.resistance, 2)}</BodyCell>
              <BodyCell>{formatCurrent(record.point.I, 4)}</BodyCell>
              <BodyCell>{formatVoltage(record.point.U, 4)}</BodyCell>
              <BodyCell>{formatVoltage(record.point.state.outputVoltage, 4)}</BodyCell>
              <BodyCell>{fit ? formatVoltage(fit.emf, 4) : '—'}</BodyCell>
              <BodyCell>{fit ? formatResistance(fit.r, 4) : '—'}</BodyCell>
              <BodyCell>{fit ? formatPercent(((fit.emf - trueEmf) / Math.max(trueEmf, 1e-6)) * 100) : '—'}</BodyCell>
              <BodyCell>{fit ? formatPercent(((fit.r - trueResistance) / Math.max(trueResistance, 1e-6)) * 100) : '—'}</BodyCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 rounded-xl border p-3.5" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg, boxShadow: SHADOWS.sm }}>
      <div className="mb-3 text-xs font-semibold" style={{ color: pageStyle.secondary }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function PanelCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg, boxShadow: SHADOWS.sm }}>
      <div className="mb-3">
        <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>{title}</div>
        {subtitle && (
          <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            {subtitle}
          </div>
        )}
      </div>
      {children}
    </section>
  );
}

function ResultList({ rows }: { rows: Array<{ label: string; value: string }> }) {
  return (
    <div className="overflow-hidden rounded-lg border" style={{ borderColor: pageStyle.border }}>
      {rows.map((row, index) => (
        <div
          key={row.label}
          className="flex items-start justify-between gap-3 px-3 py-2"
          style={{
            backgroundColor: index % 2 === 0 ? '#FFFFFF' : pageStyle.blockSoft,
            borderTop: index === 0 ? 'none' : `1px solid ${pageStyle.border}`,
          }}
        >
          <span className="text-[11px]" style={{ color: pageStyle.secondary }}>{row.label}</span>
          <span className="text-right text-[11px] font-semibold" style={{ color: pageStyle.text }}>{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
  color,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  color: string;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
      style={{
        color: active ? '#FFFFFF' : color,
        backgroundColor: active ? color : `${color}12`,
        border: `1px solid ${color}44`,
      }}
    >
      {label}
    </button>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px]" style={{ color: pageStyle.secondary }}>{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isNaN(next)) onChange(Math.max(min, Math.min(max, next)));
            }}
            className="w-20 rounded border px-1.5 py-0.5 text-right text-[11px]"
            style={{ borderColor: pageStyle.border, color: pageStyle.text }}
          />
          <span className="text-[10px]" style={{ color: pageStyle.muted }}>{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: pageStyle.accent }}
      />
    </div>
  );
}

function HeadCell({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-2 py-2 ${right ? 'text-right' : 'text-left'}`}
      style={{ color: pageStyle.muted, fontWeight: 600, fontSize: 10.5 }}
    >
      {children}
    </th>
  );
}

function BodyCell({ children }: { children: ReactNode }) {
  return (
    <td
      className="px-2 py-2 text-right"
      style={{
        color: pageStyle.text,
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 10.5,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </td>
  );
}

function BatterySymbol({ x, top, bottom }: { x: number; top: number; bottom: number }) {
  return (
    <>
      <line x1={x} y1={top} x2={x} y2={top + 8} stroke="#111111" strokeWidth="2.2" />
      <line x1={x - 12} y1={top + 8} x2={x + 12} y2={top + 8} stroke="#111111" strokeWidth="2.4" />
      <line x1={x - 8} y1={top + 24} x2={x + 8} y2={top + 24} stroke="#111111" strokeWidth="1.8" />
      <line x1={x} y1={top + 24} x2={x} y2={bottom} stroke="#111111" strokeWidth="2.2" />
    </>
  );
}

function SwitchSymbol({ x1, x2, y }: { x1: number; x2: number; y: number }) {
  return (
    <>
      <circle cx={x1} cy={y} r="2.8" fill="#111111" />
      <circle cx={x2} cy={y} r="2.8" fill="#111111" />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke="#111111" strokeWidth="2.2" />
    </>
  );
}

function AmmeterSymbol({
  cx,
  cy,
  label,
  color,
}: {
  cx: number;
  cy: number;
  label: string;
  color: string;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r="22" fill="#FFFFFF" stroke="#111111" strokeWidth="2.2" />
      <circle cx={cx} cy={cy} r="18" fill="none" stroke={color} strokeWidth="1.8" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#111111">{label}</text>
    </>
  );
}

function VoltmeterSymbol({
  cx,
  cy,
  label,
  color,
}: {
  cx: number;
  cy: number;
  label: string;
  color: string;
}) {
  return (
    <>
      <circle cx={cx} cy={cy} r="22" fill="#FFFFFF" stroke="#111111" strokeWidth="2.2" />
      <circle cx={cx} cy={cy} r="18" fill="none" stroke={color} strokeWidth="1.8" />
      <text x={cx} y={cy + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill="#111111">{label}</text>
    </>
  );
}

function SeriesRheostatSymbol({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} rx="8" fill="#FFFFFF" stroke="#111111" strokeWidth="2.2" />
      <circle cx={x + 8} cy={y + height / 2} r="2.6" fill="#111111" />
      <circle cx={x + width - 8} cy={y + height / 2} r="2.6" fill="#111111" />
      <circle cx={x + width * 0.42} cy={y + height / 2} r="2.6" fill="#111111" />
      <line x1={x + width * 0.68} y1={y + 8} x2={x + width * 0.38} y2={y + height - 6} stroke="#111111" strokeWidth="2" />
      <polygon points={`${x + width * 0.68},${y + 8} ${x + width * 0.62},${y + 17} ${x + width * 0.73},${y + 15}`} fill="#111111" />
    </>
  );
}

function DividerRheostatSymbol({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} rx="8" fill="#FFFFFF" stroke="#111111" strokeWidth="2.2" />
      <circle cx={x + 8} cy={y + height / 2} r="2.6" fill="#111111" />
      <circle cx={x + width - 8} cy={y + height / 2} r="2.6" fill="#111111" />
      <circle cx={x + width * 0.62} cy={y + height / 2} r="2.6" fill="#111111" />
      <line x1={x + width * 0.72} y1={y + 8} x2={x + width * 0.54} y2={y + height - 6} stroke="#111111" strokeWidth="2" />
      <polygon points={`${x + width * 0.72},${y + 8} ${x + width * 0.66},${y + 17} ${x + width * 0.77},${y + 15}`} fill="#111111" />
      <line x1={x + width * 0.62} y1={y + height / 2} x2={x + width * 0.62} y2={y - 20} stroke="#111111" strokeWidth="2" />
    </>
  );
}

function FixedResistorSymbol({
  x,
  y,
  width,
  height,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} rx="6" fill="#FFFFFF" stroke="#111111" strokeWidth="2" />
    </>
  );
}

function formatVoltage(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)} V`;
}

function formatCurrent(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)} A`;
}

function formatResistance(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(digits)} kΩ`;
  }
  return `${value.toFixed(digits)} Ω`;
}

function formatPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}
