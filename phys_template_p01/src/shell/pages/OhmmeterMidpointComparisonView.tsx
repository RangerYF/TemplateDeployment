import { useMemo, useState } from 'react';
import { COLORS } from '@/styles/tokens';
import {
  calculateOhmmeterMidpointComparison,
  clampOhmmeterTheta,
} from '@/domains/em/logic/ohmmeter-midpoint-comparison';

interface OhmmeterPageParams {
  emf: number;
  fullScaleCurrent: number;
  galvanometerResistance: number;
  batteryInternalResistance: number;
  seriesResistance: number;
  rx: number;
}

const DEFAULT_PARAMS: OhmmeterPageParams = {
  emf: 1.5,
  fullScaleCurrent: 0.0001,
  galvanometerResistance: 1000,
  batteryInternalResistance: 200,
  seriesResistance: 15000,
  rx: 7500,
};

const pageStyle = {
  pageBg: COLORS.bgPage,
  panelBg: COLORS.bg,
  panelSoft: COLORS.bg,
  blockBg: COLORS.bg,
  blockSoft: COLORS.bgMuted,
  border: COLORS.border,
  borderStrong: COLORS.borderStrong,
  text: COLORS.text,
  muted: COLORS.textMuted,
  secondary: COLORS.textSecondary,
  accent: COLORS.primary,
  accentSoft: COLORS.primaryLight,
};

const DIAL_START_ANGLE = 160;
const DIAL_FULL_SCALE_ANGLE = 20;
const DIAL_OVERRANGE_ANGLE = 0;

interface Props {
  onBack: () => void;
  onOpenPreset: () => void;
}

export function OhmmeterMidpointComparisonView({ onBack, onOpenPreset }: Props) {
  const [params, setParams] = useState<OhmmeterPageParams>(DEFAULT_PARAMS);
  const result = useMemo(
    () =>
      calculateOhmmeterMidpointComparison({
        ...params,
        sampleCount: 121,
      }),
    [params],
  );

  const setParam = (key: keyof OhmmeterPageParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const handleZeroIdeal = () => {
    setParams((prev) => ({
      ...prev,
      rx: 0,
      seriesResistance: result.idealSystem.seriesResistance,
    }));
  };

  const handleSetMidResistance = () => {
    setParam('rx', result.idealMidpointResistance);
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ backgroundColor: pageStyle.pageBg }}>
      <header
        className="flex items-center gap-3 px-5 py-2.5"
        style={{ borderBottom: `1px solid ${pageStyle.border}`, backgroundColor: pageStyle.panelBg }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1 text-xs font-medium"
          style={{ color: pageStyle.text, border: `1px solid ${pageStyle.border}`, backgroundColor: pageStyle.blockBg }}
        >
          ← 返回
        </button>
        <button
          onClick={onOpenPreset}
          className="px-3 py-1 text-xs font-medium"
          style={{ color: pageStyle.accent, border: `1px solid ${pageStyle.accent}55`, backgroundColor: pageStyle.accentSoft }}
        >
          进入原实验
        </button>
        <h1 className="text-sm font-semibold" style={{ color: pageStyle.text }}>
          串联式欧姆表调零与中值电阻
        </h1>
        <span className="text-[11px]" style={{ color: pageStyle.muted }}>
          蓝线为已正确调零的理想系统，绿线为当前参数直接形成的系统
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <OhmLeftPanel
          params={params}
          result={result}
          onChangeParam={setParam}
          onZeroIdeal={handleZeroIdeal}
          onSetMidResistance={handleSetMidResistance}
        />
        <OhmCenterPanel result={result} />
        <OhmRightPanel result={result} params={params} />
      </div>
    </div>
  );
}

function OhmLeftPanel({
  params,
  result,
  onChangeParam,
  onZeroIdeal,
  onSetMidResistance,
}: {
  params: OhmmeterPageParams;
  result: ReturnType<typeof calculateOhmmeterMidpointComparison>;
  onChangeParam: (key: keyof OhmmeterPageParams, value: number) => void;
  onZeroIdeal: () => void;
  onSetMidResistance: () => void;
}) {
  const sliderMax = Math.max(result.idealMidpointResistance * 2.2, 30000);

  return (
    <div className="flex w-[300px] shrink-0 flex-col overflow-y-auto" style={{ backgroundColor: pageStyle.panelSoft, borderRight: `1px solid ${pageStyle.border}` }}>
      <div className="p-4">
        <div
          className="mb-4 rounded-lg p-3"
          style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}
        >
          <div className="text-xs font-semibold" style={{ color: pageStyle.text }}>
            调零审计
          </div>
          <div className="mt-1 text-[16px] font-semibold" style={{ color: result.zeroed ? COLORS.primary : COLORS.warning }}>
            {result.zeroed ? '当前已满足 Rx = 0 时满偏' : '当前未重新调零'}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            调零定义：当 Rx = 0 时，使表头满偏，即 θ = 1。当前系统在 Rx = 0 时的偏转比为 {formatTheta(result.zeroingThetaAtRxZero)}。
            {result.canZero
              ? ` 若要重新调零，应把 R0 调到 ${formatResistance(result.idealSystem.seriesResistance)}。`
              : ' 当前参数下 E/Ig 小于 Rg + r，串联电阻无法通过非负 R0 调到满偏。'}
          </div>
        </div>

        <SectionTitle title="参数控制" />
        <RangeControl label="电池电动势 E" value={params.emf} min={1} max={9} step={0.5} unit="V" onChange={(value) => onChangeParam('emf', value)} />
        <RangeControl label="满偏电流 Ig" value={params.fullScaleCurrent} min={0.00005} max={0.001} step={0.00001} unit="A" onChange={(value) => onChangeParam('fullScaleCurrent', value)} />
        <RangeControl label="表头内阻 Rg" value={params.galvanometerResistance} min={100} max={5000} step={10} unit="Ω" onChange={(value) => onChangeParam('galvanometerResistance', value)} />
        <RangeControl label="电池内阻 r" value={params.batteryInternalResistance} min={0} max={1000} step={10} unit="Ω" onChange={(value) => onChangeParam('batteryInternalResistance', value)} />
        <RangeControl label="串联电阻 R0" value={params.seriesResistance} min={0} max={sliderMax} step={10} unit="Ω" onChange={(value) => onChangeParam('seriesResistance', value)} />
        <RangeControl label="被测电阻 Rx" value={params.rx} min={0} max={Math.max(result.idealMidpointResistance * 4, 100)} step={1} unit="Ω" onChange={(value) => onChangeParam('rx', value)} />

        <div className="mt-4 flex flex-wrap gap-2">
          <PresetButton label="自动调零" onClick={onZeroIdeal} />
          <PresetButton label="设 Rx = R中" onClick={onSetMidResistance} />
        </div>
      </div>
    </div>
  );
}

function OhmCenterPanel({ result }: { result: ReturnType<typeof calculateOhmmeterMidpointComparison> }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ backgroundColor: pageStyle.panelBg }}>
      <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-2">
        <DialCard
          title="理想系统"
          color="#2563EB"
          ratio={result.idealThetaAtCurrentRx}
          Rmid={result.idealMidpointResistance}
          variant="ideal"
          internalResistance={result.idealMidpointResistance}
          zeroThetaAtRxZero={1}
          batteryInternalResistance={result.idealSystem.batteryInternalResistance}
          seriesResistance={result.idealSystem.seriesResistance}
        />
        <DialCard
          title="当前系统"
          color={COLORS.primary}
          ratio={result.actualThetaAtCurrentRx}
          Rmid={result.idealMidpointResistance}
          variant="actual"
          internalResistance={result.currentInternalResistance}
          zeroThetaAtRxZero={result.zeroingThetaAtRxZero}
          batteryInternalResistance={result.currentSystem.batteryInternalResistance}
          seriesResistance={result.currentSystem.seriesResistance}
        />
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
          <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
            偏转比 θ 与被测电阻 Rx
          </div>
          <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
            蓝线使用“已正确调零”的系统，所以 Rx = 0 时 θ = 1，Rx = R中 时 θ = 0.5。绿线使用当前参数直接计算，因此未重新调零时会偏离这两个条件。
          </div>
          <div className="mt-4">
            <OhmmeterCurveChart result={result} />
          </div>
        </div>
      </div>
    </div>
  );
}

function OhmRightPanel({
  result,
  params,
}: {
  result: ReturnType<typeof calculateOhmmeterMidpointComparison>;
  params: OhmmeterPageParams;
}) {
  const midpointMatch =
    Math.abs(params.rx - result.idealMidpointResistance) /
      Math.max(result.idealMidpointResistance, 1e-9) <
    0.02;
  const midpointDeviation = result.midpointRatioActual - 0.5;
  const dataRows = [
    { label: '理想中值电阻 R中', value: formatResistance(result.idealMidpointResistance), color: '#2563EB' },
    { label: '当前系统总内阻', value: formatResistance(result.currentInternalResistance) },
    { label: '当前系统真正半偏 Rx', value: formatResistance(result.currentHalfDeflectionResistance) },
    { label: '当前 Rx', value: formatResistance(params.rx), color: COLORS.primary },
    { label: '理想偏转比 θ', value: formatTheta(result.idealThetaAtCurrentRx) },
    { label: '当前偏转比 θ', value: formatTheta(result.actualThetaAtCurrentRx), color: COLORS.primary },
    { label: 'Rx = R中 时理想 θ', value: formatTheta(result.midpointRatioIdeal) },
    {
      label: 'Rx = R中 时当前 θ',
      value: formatTheta(result.midpointRatioActual),
      color: midpointDeviation === 0 ? COLORS.primary : COLORS.warning,
    },
  ];

  return (
    <div className="flex w-[340px] shrink-0 flex-col overflow-y-auto" style={{ backgroundColor: pageStyle.panelBg, borderLeft: `1px solid ${pageStyle.border}` }}>
      <div className="p-3">
        <PanelTitle title="关键数据列表" />
        <OhmDataTable rows={dataRows} />
        <div
          className="mt-2 rounded-lg border px-3 py-2 text-[10px]"
          style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockSoft, color: pageStyle.secondary, lineHeight: 1.7 }}
        >
          {midpointMatch ? '当前 Rx 已接近理想中值电阻 R中。' : '把 Rx 调到 R中，可直接观察理想半偏与当前偏离。'}
        </div>
      </div>

      <div className="px-3 pb-3">
        <PanelTitle title="教学表述" />
        <div className="rounded-xl border p-3" style={{ borderColor: `${COLORS.primary}55`, backgroundColor: COLORS.primaryLight }}>
          <div className="text-[11px] font-semibold" style={{ color: COLORS.primary }}>
            调零：当 Rx = 0 时，使表头满偏。
          </div>
          <div className="mt-1 text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
            中值电阻：使指针半偏（θ = 0.5）时的被测电阻。串联式欧姆表中，理想调零后中值电阻等于表内总电阻。
          </div>
        </div>
      </div>

      <div className="px-3 pb-4" style={{ borderTop: `1px solid ${pageStyle.border}`, paddingTop: 12 }}>
        <PanelTitle title="结论检查" />
        <InfoBlock
          title="R中 处的半偏关系"
          color={midpointDeviation === 0 ? COLORS.primary : COLORS.warning}
          lines={[
            `理想系统在 Rx = R中 时 θ = ${formatTheta(result.midpointRatioIdeal)}`,
            `当前系统在 Rx = R中 时 θ = ${formatTheta(result.midpointRatioActual)}`,
            `相对半偏的偏离量 = ${midpointDeviation >= 0 ? '+' : ''}${midpointDeviation.toFixed(2)}`,
            result.zeroed ? '当前系统已调零，理想与当前在 R中 处一致。' : '当前系统未调零，所以绿线在 R中 处不一定半偏。',
          ]}
        />
      </div>
    </div>
  );
}

function DialCard({
  title,
  color,
  ratio,
  Rmid,
  variant,
  internalResistance,
  zeroThetaAtRxZero,
  batteryInternalResistance,
  seriesResistance,
}: {
  title: string;
  color: string;
  ratio: number;
  Rmid: number;
  variant: 'ideal' | 'actual';
  internalResistance: number;
  zeroThetaAtRxZero: number;
  batteryInternalResistance: number;
  seriesResistance: number;
}) {
  const angle = thetaToDialAngle(ratio);
  const polar = (angleDeg: number, radius: number, cx: number, cy: number) => {
    const rad = (angleDeg * Math.PI) / 180;
    return { x: cx + Math.cos(rad) * radius, y: cy + Math.sin(rad) * radius };
  };
  const arcPath = Array.from({ length: 33 }, (_, index) => {
    const point = polar(
      DIAL_START_ANGLE + (index / 32) * (DIAL_FULL_SCALE_ANGLE - DIAL_START_ANGLE),
      88,
      180,
      120,
    );
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(' ');
  const overrangePath = Array.from({ length: 8 }, (_, index) => {
    const point = polar(
      DIAL_FULL_SCALE_ANGLE + (index / 7) * (DIAL_OVERRANGE_ANGLE - DIAL_FULL_SCALE_ANGLE),
      88,
      180,
      120,
    );
    return `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }).join(' ');
  const tip = polar(angle, 72, 180, 120);

  return (
    <div className="rounded-xl border p-3" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
      <div className="text-sm font-semibold" style={{ color }}>
        {title}
      </div>
      <div className="mt-2 text-[10px]" style={{ color: pageStyle.muted }}>
        当 Rx = R中 = {formatResistance(Rmid)} 时，理想应有 θ = 0.5。当前卡片显示的表盘角度、数值和图像均来自同一个 θ。
      </div>
      <div className="mt-3">
        <OhmmeterCircuitSketch
          color={color}
          variant={variant}
          internalResistance={internalResistance}
          zeroThetaAtRxZero={zeroThetaAtRxZero}
          batteryInternalResistance={batteryInternalResistance}
          seriesResistance={seriesResistance}
        />
      </div>
      <svg viewBox="0 0 360 200" style={{ width: '100%', height: 190, display: 'block' }}>
        <rect x="18" y="18" width="324" height="156" rx="12" fill="#FFFFFF" stroke={pageStyle.border} />
        <path d={arcPath} fill="none" stroke="#CBD5E1" strokeWidth="3" strokeLinecap="round" />
        <path d={overrangePath} fill="none" stroke="#FCA5A5" strokeWidth="3" strokeLinecap="round" />
        <text x="88" y="114" fontSize="10" fill={pageStyle.muted}>∞</text>
        <text x="176" y="54" textAnchor="middle" fontSize="10" fill={pageStyle.muted}>R中</text>
        <text x="272" y="114" fontSize="10" fill={pageStyle.muted}>0</text>
        <text x="301" y="94" fontSize="9" fill="#DC2626">超满偏</text>
        <line x1="180" y1="120" x2={tip.x} y2={tip.y} stroke={color} strokeWidth="3" strokeLinecap="round" />
        <circle cx="180" cy="120" r="4.5" fill={color} />
        <text x="180" y="154" textAnchor="middle" fontSize="12" fontWeight="700" fill={color}>
          θ = {formatTheta(ratio)}
        </text>
      </svg>
    </div>
  );
}

function OhmmeterCircuitSketch({
  color,
  variant,
  internalResistance,
  zeroThetaAtRxZero,
  batteryInternalResistance,
  seriesResistance,
}: {
  color: string;
  variant: 'ideal' | 'actual';
  internalResistance: number;
  zeroThetaAtRxZero: number;
  batteryInternalResistance: number;
  seriesResistance: number;
}) {
  const stroke = '#111827';
  const leftX = 34;
  const rightX = 286;
  const topY = 54;
  const bottomY = 132;

  return (
    <svg viewBox="0 0 320 170" style={{ width: '100%', height: 168, display: 'block' }} aria-label="欧姆表原理电路图">
      <rect x="1" y="1" width="318" height="168" fill="#FCFCFD" stroke={pageStyle.border} />

      <line x1={leftX} y1={topY} x2={86} y2={topY} stroke={stroke} strokeWidth="2" />
      <line x1={122} y1={topY} x2={154} y2={topY} stroke={stroke} strokeWidth="2" />
      <line x1={210} y1={topY} x2={rightX} y2={topY} stroke={stroke} strokeWidth="2" />
      <line x1={rightX} y1={topY} x2={rightX} y2={bottomY} stroke={stroke} strokeWidth="2" />
      <line x1={rightX} y1={bottomY} x2={214} y2={bottomY} stroke={stroke} strokeWidth="2" />
      <line x1={106} y1={bottomY} x2={leftX} y2={bottomY} stroke={stroke} strokeWidth="2" />
      <line x1={leftX} y1={topY} x2={leftX} y2={76} stroke={stroke} strokeWidth="2" />
      <line x1={leftX} y1={108} x2={leftX} y2={bottomY} stroke={stroke} strokeWidth="2" />

      <line x1={86} y1={topY} x2={210} y2={topY} stroke={color} strokeWidth="3" strokeLinecap="round" />

      <BatterySymbol x={leftX} top={76} bottom={108} stroke={stroke} />
      <MeterSymbol center={{ x: 104, y: topY }} letter="G" stroke={stroke} accent={color} />
      <ResistorSymbol x={154} y={topY - 12} width={56} height={24} stroke={stroke} accent={color} />
      <ResistorSymbol x={106} y={bottomY - 12} width={108} height={24} stroke={stroke} accent={variant === 'ideal' ? '#2563EB' : color} />

      <DiagramLabel x={52} y={124} text="电池 E 与内阻 r" />
      <DiagramLabel x={104} y={28} align="middle" text="表头 G" />
      <DiagramLabel x={182} y={28} align="middle" text="串联电阻 R0" />
      <DiagramLabel x={160} y={158} align="middle" text="被测电阻 Rx" />
      <DiagramLabel
        x={160}
        y={95}
        align="middle"
        text={
          variant === 'ideal'
            ? '理想调零：Rx = 0 时 θ = 1'
            : `当前：Rx = 0 时 θ = ${formatTheta(zeroThetaAtRxZero)}`
        }
        color={color}
      />
      <DiagramLabel
        x={160}
        y={108}
        align="middle"
        text={`R总内 = ${formatResistance(internalResistance)} = Rg + r + R0`}
        color={pageStyle.muted}
      />
      <DiagramLabel
        x={160}
        y={84}
        align="middle"
        text={`r = ${formatResistance(batteryInternalResistance)}，R0 = ${formatResistance(seriesResistance)}`}
        color={pageStyle.muted}
      />
    </svg>
  );
}

function BatterySymbol({
  x,
  top,
  bottom,
  stroke,
}: {
  x: number;
  top: number;
  bottom: number;
  stroke: string;
}) {
  const longPlateY = top + 6;
  const shortPlateY = top + 20;

  return (
    <>
      <line x1={x} y1={top} x2={x} y2={longPlateY} stroke={stroke} strokeWidth="2" />
      <line x1={x - 12} y1={longPlateY} x2={x + 12} y2={longPlateY} stroke={stroke} strokeWidth="2.2" />
      <line x1={x - 8} y1={shortPlateY} x2={x + 8} y2={shortPlateY} stroke={stroke} strokeWidth="1.6" />
      <line x1={x} y1={shortPlateY} x2={x} y2={bottom} stroke={stroke} strokeWidth="2" />
    </>
  );
}

function MeterSymbol({
  center,
  letter,
  stroke,
  accent,
}: {
  center: { x: number; y: number };
  letter: string;
  stroke: string;
  accent?: string;
}) {
  return (
    <>
      <circle cx={center.x} cy={center.y} r="18" fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
      {accent && <circle cx={center.x} cy={center.y} r="15" fill="none" stroke={accent} strokeWidth="1.5" />}
      <text x={center.x} y={center.y + 5} textAnchor="middle" fontSize="16" fontWeight="700" fill={stroke}>
        {letter}
      </text>
    </>
  );
}

function ResistorSymbol({
  x,
  y,
  width,
  height,
  stroke,
  accent,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
  accent: string;
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
      <rect x={x + 3} y={y + 3} width={width - 6} height={height - 6} fill="none" stroke={accent} strokeWidth="1.2" />
    </>
  );
}

function DiagramLabel({
  x,
  y,
  text,
  color = '#4B5563',
  align = 'start',
}: {
  x: number;
  y: number;
  text: string;
  color?: string;
  align?: 'start' | 'middle' | 'end';
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={align}
      fontSize="10.5"
      fill={color}
      style={{ fontFamily: '"Noto Serif SC", "Songti SC", serif' }}
    >
      {text}
    </text>
  );
}

function OhmmeterCurveChart({ result }: { result: ReturnType<typeof calculateOhmmeterMidpointComparison> }) {
  const width = 640;
  const height = 280;
  const pad = { left: 56, right: 20, top: 16, bottom: 36 };
  const plotX = pad.left;
  const plotY = pad.top;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxResistance = Math.max(
    ...result.curves.actual.map((point) => point.resistance),
    result.idealMidpointResistance,
    result.currentPoint.resistance,
  );
  const maxTheta = Math.max(
    1.05,
    ...result.curves.ideal.map((point) => point.theta),
    ...result.curves.actual.map((point) => point.theta),
    result.currentPoint.actualTheta,
  );
  const yMax = Math.min(Math.max(maxTheta * 1.05, 1.05), 1.25);
  const xTicks = 6;
  const yTicks = 5;

  const toX = (value: number) => plotX + (value / Math.max(maxResistance, 1)) * plotW;
  const toY = (value: number) => plotY + plotH - (clampOhmmeterTheta(value) / yMax) * plotH;

  const buildPath = (points: Array<{ resistance: number; theta: number }>) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(point.resistance)} ${toY(point.theta)}`).join(' ');

  const midpointDeviation = result.midpointRatioActual - 0.5;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
      <rect x="0" y="0" width={width} height={height} rx="12" fill="#FFFFFF" />

      {Array.from({ length: xTicks + 1 }).map((_, index) => {
        const x = plotX + (plotW * index) / xTicks;
        return <line key={`x-${index}`} x1={x} y1={plotY} x2={x} y2={plotY + plotH} stroke="#E5E7EB" strokeWidth="1" />;
      })}
      {Array.from({ length: yTicks + 1 }).map((_, index) => {
        const y = plotY + (plotH * index) / yTicks;
        return <line key={`y-${index}`} x1={plotX} y1={y} x2={plotX + plotW} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
      })}

      <line x1={plotX} y1={toY(0.5)} x2={plotX + plotW} y2={toY(0.5)} stroke="#F59E0B" strokeDasharray="6 4" strokeWidth="1.4" />
      <line x1={toX(result.idealMidpointResistance)} y1={plotY} x2={toX(result.idealMidpointResistance)} y2={plotY + plotH} stroke="#2563EB" strokeDasharray="6 4" strokeWidth="1.4" />
      <line x1={toX(result.currentPoint.resistance)} y1={plotY} x2={toX(result.currentPoint.resistance)} y2={plotY + plotH} stroke={COLORS.primary} strokeDasharray="5 5" strokeWidth="1.2" />
      <line x1={plotX} y1={toY(result.currentPoint.actualTheta)} x2={toX(result.currentPoint.resistance)} y2={toY(result.currentPoint.actualTheta)} stroke={COLORS.primary} strokeDasharray="5 5" strokeWidth="1.2" />

      <path d={buildPath(result.curves.ideal)} fill="none" stroke="#2563EB" strokeWidth="2.4" />
      <path d={buildPath(result.curves.actual)} fill="none" stroke={COLORS.primary} strokeWidth="2.4" />

      <circle cx={toX(result.idealMidpointResistance)} cy={toY(result.midpointRatioIdeal)} r="5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
      <circle cx={toX(result.idealMidpointResistance)} cy={toY(result.midpointRatioActual)} r="5" fill="#FFFFFF" stroke={COLORS.primary} strokeWidth="2" />
      <circle cx={toX(result.currentPoint.resistance)} cy={toY(result.currentPoint.idealTheta)} r="4.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
      <circle cx={toX(result.currentPoint.resistance)} cy={toY(result.currentPoint.actualTheta)} r="4.5" fill="#FFFFFF" stroke={COLORS.primary} strokeWidth="2" />

      <text x={toX(result.idealMidpointResistance) + 8} y={toY(result.midpointRatioIdeal) - 10} fontSize="10" fill="#2563EB">
        Rx = R中，θ = 0.50
      </text>
      <text x={toX(result.idealMidpointResistance) + 8} y={toY(result.midpointRatioActual) + 14} fontSize="10" fill={COLORS.primary}>
        当前偏离 {midpointDeviation >= 0 ? '+' : ''}{midpointDeviation.toFixed(2)}
      </text>
      <text x={toX(result.currentPoint.resistance) + 8} y={toY(result.currentPoint.actualTheta) - 8} fontSize="10" fill={COLORS.primary}>
        当前 Rx，当前 θ
      </text>

      {Array.from({ length: xTicks + 1 }).map((_, index) => {
        const value = (maxResistance * index) / xTicks;
        return (
          <text key={`xt-${index}`} x={plotX + (plotW * index) / xTicks} y={plotY + plotH + 18} textAnchor="middle" fontSize="10" fill={pageStyle.muted}>
            {value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0)}
          </text>
        );
      })}
      {Array.from({ length: yTicks + 1 }).map((_, index) => {
        const value = yMax - (yMax * index) / yTicks;
        return (
          <text key={`yt-${index}`} x={plotX - 8} y={plotY + (plotH * index) / yTicks + 3} textAnchor="end" fontSize="10" fill={pageStyle.muted}>
            {value.toFixed(2)}
          </text>
        );
      })}

      <text x={plotX + plotW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill={pageStyle.secondary}>
        Rx / Ω
      </text>
      <text x="20" y={plotY + plotH / 2} textAnchor="middle" fontSize="11" fill={pageStyle.secondary} transform={`rotate(-90 20 ${plotY + plotH / 2})`}>
        偏转比 θ
      </text>
    </svg>
  );
}

function InfoBlock({ title, color, lines }: { title: string; color: string; lines: string[] }) {
  return (
    <div className="mb-2 rounded-lg p-2.5" style={{ border: `1px solid ${color}33`, backgroundColor: `${color}10` }}>
      <div className="mb-1 text-[11px] font-semibold" style={{ color }}>
        {title}
      </div>
      {lines.map((line) => (
        <div key={line} className="text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function OhmDataTable({
  rows,
}: {
  rows: Array<{ label: string; value: string; color?: string }>;
}) {
  return (
    <div className="overflow-hidden rounded-xl border" style={{ borderColor: pageStyle.border }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 10.5 }}>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.label} style={{ backgroundColor: index % 2 === 0 ? pageStyle.blockBg : pageStyle.blockSoft }}>
              <td
                className="px-2 py-2"
                style={{
                  width: '52%',
                  color: pageStyle.secondary,
                  borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${pageStyle.border}`,
                }}
              >
                {row.label}
              </td>
              <td
                className="px-2 py-2 text-right"
                style={{
                  color: row.color ?? pageStyle.text,
                  fontWeight: 600,
                  borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${pageStyle.border}`,
                }}
              >
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-2 text-xs font-semibold" style={{ color: pageStyle.text }}>
      {title}
    </h2>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 text-[11px] font-semibold" style={{ color: pageStyle.secondary }}>
      {title}
    </div>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-[10px] font-medium"
      style={{ backgroundColor: pageStyle.accentSoft, color: pageStyle.accent, border: `1px solid ${pageStyle.accent}33` }}
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
        <span className="text-[11px]" style={{ color: pageStyle.secondary }}>
          {label}
        </span>
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
            className="w-24 rounded border px-1.5 py-0.5 text-right text-[11px]"
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

function thetaToDialAngle(theta: number): number {
  const limitedTheta = clampOhmmeterTheta(theta);
  if (limitedTheta <= 1) {
    return DIAL_START_ANGLE + limitedTheta * (DIAL_FULL_SCALE_ANGLE - DIAL_START_ANGLE);
  }

  return (
    DIAL_FULL_SCALE_ANGLE +
    ((limitedTheta - 1) / 0.2) * (DIAL_OVERRANGE_ANGLE - DIAL_FULL_SCALE_ANGLE)
  );
}

function formatResistance(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)} kΩ`;
  return `${value.toFixed(value >= 100 ? 0 : 2)} Ω`;
}

function formatTheta(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(2);
}
