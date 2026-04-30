import {
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  formatValue,
  type CircuitResult,
  type MeterErrorParams,
} from '@/domains/em/logic/meter-error-calculator';

export type ExperimentMode = 'ideal' | 'inner' | 'outer';

export interface ExperimentBoardTooltipData {
  title: string;
  readingText: string;
  rangeText: string;
  accent: string;
}

interface ExperimentBoardSceneProps {
  mode: ExperimentMode;
  params: MeterErrorParams;
  result: CircuitResult;
  closed: boolean;
  onMeterHover?: (
    tooltip: ExperimentBoardTooltipData,
    event: ReactMouseEvent<SVGGElement>,
  ) => void;
  onMeterLeave?: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface DragBounds {
  x: [number, number];
  y: [number, number];
}

interface WirePathProps {
  points: Point[];
  active: boolean;
}

interface MeterGeometry {
  bodyLeft: number;
  bodyTop: number;
  width: number;
  height: number;
  terminals: {
    common: Point;
    low: Point;
    high: Point;
  };
  rect: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface MeterProps {
  kind: 'ammeter' | 'voltmeter';
  center: Point;
  reading: number;
  rangeReading: number;
  params: MeterErrorParams;
  hoverEnabled: boolean;
  dragging: boolean;
  onHover?: (
    tooltip: ExperimentBoardTooltipData,
    event: ReactMouseEvent<SVGGElement>,
  ) => void;
  onLeave?: () => void;
}

interface KnifeSwitchProps {
  center: Point;
  closed: boolean;
}

interface PowerSupplyProps {
  center: Point;
  emf: number;
  sourceResistance: number;
}

interface ResistorFixtureProps {
  center: Point;
  resistance: number;
}

interface RheostatProps {
  center: Point;
  slider: Point;
  sliderActive: boolean;
  onSliderPointerDown?: (event: ReactPointerEvent<SVGRectElement>) => void;
}

interface SceneLayout {
  powerCenter: Point;
  switchCenter: Point;
  ammeterCenter: Point;
  voltmeterCenter: Point;
  resistorCenter: Point;
  rheostatCenter: Point;
  powerLeft: Point;
  powerRight: Point;
  switchLeft: Point;
  switchRight: Point;
  resistorLeft: Point;
  resistorRight: Point;
  rheostatLeft: Point;
  rheostatRight: Point;
  rheostatSlider: Point;
  ammeter: MeterGeometry;
  voltmeter: MeterGeometry;
  currentNode: Point;
  voltmeterNode: Point;
  branchLeft: Point;
  branchRight: Point;
}

type PartKey = 'power' | 'switch' | 'ammeter' | 'voltmeter' | 'resistor' | 'rheostat';
type DragKey = PartKey | 'slider';
type MeterKey = Extract<PartKey, 'ammeter' | 'voltmeter'>;

type OffsetMap = Record<PartKey, Point>;

interface DragState {
  key: DragKey;
  pointerId: number;
  startPointer: Point;
  startOffset: Point;
  startSliderRatio: number;
}

const SCENE_W = 450;
const SCENE_H = 300;
const METER_W = 102;
const METER_H = 92;

const palette = {
  paper: '#FFFFFF',
  fill: '#FFFFFF',
  fillSoft: '#F4F4F4',
  fillSide: '#E8E8E8',
  fillBase: '#EFEFEF',
  stroke: '#111111',
  strokeSoft: '#666666',
  text: '#111111',
  note: '#555555',
  wire: '#111111',
  wireOff: '#969696',
};

const ZERO_POINT: Point = { x: 0, y: 0 };

const OFFSET_LIMITS: Record<PartKey, { x: [number, number]; y: [number, number] }> = {
  power: { x: [-92, 96], y: [-52, 38] },
  switch: { x: [-72, 92], y: [-42, 52] },
  ammeter: { x: [-110, 116], y: [-54, 64] },
  voltmeter: { x: [-110, 108], y: [-52, 58] },
  resistor: { x: [-108, 108], y: [-48, 56] },
  rheostat: { x: [-90, 84], y: [-42, 30] },
};

// 电表只允许在各自上方留白区内移动，避免压到器材或干扰对比阅读。
const METER_SAFE_ZONES: Record<ExperimentMode, Record<MeterKey, DragBounds>> = {
  ideal: {
    ammeter: { x: [112, 184], y: [64, 114] },
    voltmeter: { x: [202, 290], y: [62, 114] },
  },
  inner: {
    ammeter: { x: [112, 184], y: [64, 114] },
    voltmeter: { x: [202, 290], y: [62, 114] },
  },
  outer: {
    ammeter: { x: [112, 184], y: [64, 114] },
    voltmeter: { x: [270, 366], y: [62, 114] },
  },
};

const SLIDER_TRACK_HALF = 16;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const angle = (angleDeg * Math.PI) / 180;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarPoint(cx, cy, r, startAngle);
  const end = polarPoint(cx, cy, r, endAngle);
  return `M ${start.x} ${start.y} A ${r} ${r} 0 0 1 ${end.x} ${end.y}`;
}

// 用圆角折线代替简单平滑插值，导线既经过既定拐点，也更自然。
function buildRoundedWirePath(points: Point[], radius = 12) {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0]!.x} ${points[0]!.y} L ${points[1]!.x} ${points[1]!.y}`;

  let d = `M ${points[0]!.x} ${points[0]!.y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1]!;
    const current = points[index]!;
    const next = points[index + 1]!;

    const inVector = { x: current.x - previous.x, y: current.y - previous.y };
    const outVector = { x: next.x - current.x, y: next.y - current.y };
    const inLength = Math.hypot(inVector.x, inVector.y);
    const outLength = Math.hypot(outVector.x, outVector.y);

    if (inLength < 1e-3 || outLength < 1e-3) {
      d += ` L ${current.x} ${current.y}`;
      continue;
    }

    const cross = inVector.x * outVector.y - inVector.y * outVector.x;
    if (Math.abs(cross) < 1e-3) {
      d += ` L ${current.x} ${current.y}`;
      continue;
    }

    const cornerRadius = Math.min(radius, inLength / 2, outLength / 2);
    const entry = {
      x: current.x - (inVector.x / inLength) * cornerRadius,
      y: current.y - (inVector.y / inLength) * cornerRadius,
    };
    const exit = {
      x: current.x + (outVector.x / outLength) * cornerRadius,
      y: current.y + (outVector.y / outLength) * cornerRadius,
    };

    d += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`;
  }

  const last = points[points.length - 1]!;
  d += ` L ${last.x} ${last.y}`;
  return d;
}

function getMeterRange(kind: 'ammeter' | 'voltmeter', _params: MeterErrorParams, reading: number) {
  if (kind === 'ammeter') {
    return Math.abs(reading) <= 0.6 ? 0.6 : 3;
  }

  return Math.abs(reading) <= 3 ? 3 : 15;
}

function getBaseCenters(mode: ExperimentMode): Record<PartKey, Point> {
  return {
    power: { x: 92, y: 242 },
    switch: { x: 62, y: 166 },
    ammeter: { x: 150, y: 92 },
    voltmeter: { x: mode === 'outer' ? 308 : 246, y: 88 },
    resistor: { x: 222, y: 170 },
    rheostat: { x: 338, y: 236 },
  };
}

function applyOffset(point: Point, offset: Point) {
  return { x: point.x + offset.x, y: point.y + offset.y };
}

function getMeterGeometry(center: Point): MeterGeometry {
  const bodyLeft = center.x - METER_W / 2;
  const bodyTop = center.y - METER_H / 2;
  const terminalY = bodyTop + METER_H - 8;

  return {
    bodyLeft,
    bodyTop,
    width: METER_W,
    height: METER_H,
    terminals: {
      common: { x: center.x - 24, y: terminalY },
      low: { x: center.x, y: terminalY },
      high: { x: center.x + 24, y: terminalY },
    },
    rect: {
      x: bodyLeft,
      y: bodyTop,
      width: METER_W,
      height: METER_H,
    },
  };
}

function getActiveTerminal(
  kind: 'ammeter' | 'voltmeter',
  params: MeterErrorParams,
  reading: number,
  geometry: MeterGeometry,
) {
  const activeRange = getMeterRange(kind, params, reading);
  if (kind === 'ammeter') {
    return activeRange <= 0.6 ? geometry.terminals.low : geometry.terminals.high;
  }

  return activeRange <= 3 ? geometry.terminals.low : geometry.terminals.high;
}

function getSceneLayout(
  mode: ExperimentMode,
  params: MeterErrorParams,
  result: CircuitResult,
  offsets: OffsetMap,
  sliderRatio: number,
): SceneLayout {
  const base = getBaseCenters(mode);
  const powerCenter = applyOffset(base.power, offsets.power);
  const switchCenter = applyOffset(base.switch, offsets.switch);
  const ammeterCenter = applyOffset(base.ammeter, offsets.ammeter);
  const voltmeterCenter = applyOffset(base.voltmeter, offsets.voltmeter);
  const resistorCenter = applyOffset(base.resistor, offsets.resistor);
  const rheostatCenter = applyOffset(base.rheostat, offsets.rheostat);

  const ammeter = getMeterGeometry(ammeterCenter);
  const voltmeter = getMeterGeometry(voltmeterCenter);
  const powerLeft = { x: powerCenter.x - 46, y: powerCenter.y - 24 };
  const powerRight = { x: powerCenter.x + 46, y: powerCenter.y - 24 };
  const switchLeft = { x: switchCenter.x - 18, y: switchCenter.y + 2 };
  const switchRight = { x: switchCenter.x + 18, y: switchCenter.y + 2 };
  const resistorLeft = { x: resistorCenter.x - 42, y: resistorCenter.y - 2 };
  const resistorRight = { x: resistorCenter.x + 42, y: resistorCenter.y - 2 };
  const rheostatLeft = { x: rheostatCenter.x - 42, y: rheostatCenter.y + 4 };
  const rheostatRight = { x: rheostatCenter.x + 42, y: rheostatCenter.y + 4 };
  const rheostatSlider = {
    x: rheostatCenter.x - SLIDER_TRACK_HALF + sliderRatio * (SLIDER_TRACK_HALF * 2),
    y: rheostatCenter.y - 18,
  };
  const currentNode = getActiveTerminal('ammeter', params, result.I, ammeter);
  const voltmeterNode = getActiveTerminal('voltmeter', params, result.V, voltmeter);
  const branchLeft =
    mode === 'outer'
      ? { x: resistorLeft.x - 8, y: resistorLeft.y }
      : { x: ammeter.terminals.common.x - 6, y: ammeter.terminals.common.y };

  return {
    powerCenter,
    switchCenter,
    ammeterCenter,
    voltmeterCenter,
    resistorCenter,
    rheostatCenter,
    powerLeft,
    powerRight,
    switchLeft,
    switchRight,
    resistorLeft,
    resistorRight,
    rheostatLeft,
    rheostatRight,
    rheostatSlider,
    ammeter,
    voltmeter,
    currentNode,
    voltmeterNode,
    branchLeft,
    branchRight: { x: resistorRight.x + 8, y: resistorRight.y },
  };
}

function clampOffset(mode: ExperimentMode, key: PartKey, point: Point) {
  if (key === 'ammeter' || key === 'voltmeter') {
    const safeZone = METER_SAFE_ZONES[mode][key];
    const baseCenter = getBaseCenters(mode)[key];
    const nextCenter = applyOffset(baseCenter, point);
    return {
      x: clamp(nextCenter.x, safeZone.x[0], safeZone.x[1]) - baseCenter.x,
      y: clamp(nextCenter.y, safeZone.y[0], safeZone.y[1]) - baseCenter.y,
    };
  }

  const limit = OFFSET_LIMITS[key];
  return {
    x: clamp(point.x, limit.x[0], limit.x[1]),
    y: clamp(point.y, limit.y[0], limit.y[1]),
  };
}

function routePowerToSwitch(powerLeft: Point, switchLeft: Point): Point[] {
  const railX = Math.min(powerLeft.x, switchLeft.x) - 14;
  const railY = Math.max(powerLeft.y + 10, switchLeft.y + 34);
  return [
    powerLeft,
    { x: railX, y: powerLeft.y },
    { x: railX, y: railY },
    { x: switchLeft.x - 12, y: railY },
    { x: switchLeft.x - 12, y: switchLeft.y },
    switchLeft,
  ];
}

function routeSwitchToAmmeter(switchRight: Point, ammeterCommon: Point): Point[] {
  const guideY = Math.min(switchRight.y, ammeterCommon.y) - 28;
  return [
    switchRight,
    { x: switchRight.x + 18, y: switchRight.y },
    { x: switchRight.x + 18, y: guideY },
    { x: ammeterCommon.x - 14, y: guideY },
    { x: ammeterCommon.x - 14, y: ammeterCommon.y },
    ammeterCommon,
  ];
}

function routeSeriesLink(start: Point, end: Point, bendDy = 14): Point[] {
  const guideY = Math.max(start.y, end.y) + bendDy;
  return [
    start,
    { x: start.x + 12, y: start.y },
    { x: start.x + 12, y: guideY },
    { x: end.x - 12, y: guideY },
    { x: end.x - 12, y: end.y },
    end,
  ];
}

function routeRheostatToPower(slider: Point, powerRight: Point): Point[] {
  const guideY = Math.max(slider.y, powerRight.y) + 22;
  return [
    slider,
    { x: slider.x, y: guideY },
    { x: powerRight.x + 18, y: guideY },
    { x: powerRight.x + 18, y: powerRight.y },
    powerRight,
  ];
}

function routeBranchToVoltmeter(branchLeft: Point, terminal: Point): Point[] {
  const guideY = Math.min(branchLeft.y, terminal.y) - 22;
  return [
    branchLeft,
    { x: branchLeft.x, y: guideY },
    { x: terminal.x - 14, y: guideY },
    { x: terminal.x - 14, y: terminal.y },
    terminal,
  ];
}

function routeVoltmeterToBranch(terminal: Point, branchRight: Point): Point[] {
  const guideY = Math.min(terminal.y, branchRight.y) - 18;
  return [
    terminal,
    { x: terminal.x + 14, y: terminal.y },
    { x: terminal.x + 14, y: guideY },
    { x: branchRight.x, y: guideY },
    branchRight,
  ];
}

function BevelBox({
  x,
  y,
  width,
  height,
  depth = 4,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  depth?: number;
  children?: React.ReactNode;
}) {
  return (
    <g>
      <polygon
        points={`${x},${y} ${x + width},${y} ${x + width + depth},${y - depth} ${x + depth},${y - depth}`}
        fill={palette.fillSoft}
        stroke={palette.stroke}
        strokeWidth="1"
      />
      <polygon
        points={`${x + width},${y} ${x + width + depth},${y - depth} ${x + width + depth},${y + height - depth} ${x + width},${y + height}`}
        fill={palette.fillSide}
        stroke={palette.stroke}
        strokeWidth="1"
      />
      <rect x={x} y={y} width={width} height={height} fill={palette.fill} stroke={palette.stroke} strokeWidth="1.2" />
      {children}
    </g>
  );
}

function WirePath({ points, active }: WirePathProps) {
  return (
    <path
      d={buildRoundedWirePath(points)}
      fill="none"
      stroke={active ? palette.wire : palette.wireOff}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function Terminal({ point, label }: { point: Point; label?: string }) {
  return (
    <g>
      <circle cx={point.x} cy={point.y} r={3.2} fill={palette.fill} stroke={palette.stroke} strokeWidth={1} />
      {label ? (
        <text x={point.x} y={point.y + 14} textAnchor="middle" fontSize="8" fill={palette.note}>
          {label}
        </text>
      ) : null}
    </g>
  );
}

function AnalogMeter({
  kind,
  center,
  reading,
  rangeReading,
  params,
  hoverEnabled,
  dragging,
  onHover,
  onLeave,
}: MeterProps) {
  const geometry = getMeterGeometry(center);
  const activeRange = getMeterRange(kind, params, rangeReading);
  const symbol = kind === 'ammeter' ? 'A' : 'V';
  const title = kind === 'ammeter' ? '电流表 A' : '电压表 V';
  const lowLabel = kind === 'ammeter' ? '0.6' : '3';
  const highLabel = kind === 'ammeter' ? '3' : '15';
  const ratio = clamp(Math.abs(reading) / Math.max(activeRange, 1e-6), 0, 1);
  const dialCx = center.x;
  const dialCy = geometry.bodyTop + 56;
  const dialR = 28;
  const needleAngle = -146 + ratio * 116;
  const tooltip: ExperimentBoardTooltipData = {
    title,
    readingText: `读数：${formatValue(reading)} ${kind === 'ammeter' ? 'A' : 'V'}`,
    rangeText: `量程：0~${formatValue(activeRange)} ${kind === 'ammeter' ? 'A' : 'V'}`,
    accent: palette.text,
  };

  return (
    <g
      onMouseMove={(event) => {
        if (hoverEnabled) onHover?.(tooltip, event);
      }}
      onMouseLeave={() => {
        if (hoverEnabled) onLeave?.();
      }}
      style={{ cursor: 'default' }}
    >
      <BevelBox
        x={geometry.bodyLeft}
        y={geometry.bodyTop + 2}
        width={geometry.width}
        height={geometry.height - 12}
        depth={4}
      />
      <rect
        x={geometry.bodyLeft + 10}
        y={geometry.bodyTop + 14}
        width={geometry.width - 20}
        height={geometry.height - 38}
        fill={palette.fill}
        stroke={palette.strokeSoft}
        strokeWidth={0.9}
      />
      <path
        d={describeArc(dialCx, dialCy, dialR, -146, -30)}
        fill="none"
        stroke={palette.stroke}
        strokeWidth={1}
      />
      {Array.from({ length: 13 }).map((_, index) => {
        const angle = -146 + index * (116 / 12);
        const outer = polarPoint(dialCx, dialCy, dialR, angle);
        const inner = polarPoint(dialCx, dialCy, dialR - (index % 2 === 0 ? 7 : 4), angle);
        return (
          <line
            key={angle}
            x1={outer.x}
            y1={outer.y}
            x2={inner.x}
            y2={inner.y}
            stroke={palette.stroke}
            strokeWidth={index % 2 === 0 ? 0.95 : 0.75}
          />
        );
      })}
      <text x={dialCx - dialR + 2} y={dialCy + 10} fontSize="7.5" fill={palette.note}>
        0
      </text>
      <text x={dialCx} y={dialCy - dialR + 3} textAnchor="middle" fontSize="7.5" fill={palette.note}>
        {formatValue(activeRange / 2)}
      </text>
      <text x={dialCx + dialR - 1} y={dialCy + 10} textAnchor="end" fontSize="7.5" fill={palette.note}>
        {formatValue(activeRange)}
      </text>
      <g
        transform={`rotate(${needleAngle} ${dialCx} ${dialCy})`}
        style={{ transition: dragging ? 'none' : 'transform 180ms ease-out' }}
      >
        <line
          x1={dialCx}
          y1={dialCy}
          x2={dialCx + dialR - 5}
          y2={dialCy}
          stroke={palette.stroke}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      </g>
      <circle cx={dialCx} cy={dialCy} r={2.2} fill={palette.stroke} />
      <text x={center.x} y={geometry.bodyTop + 28} textAnchor="middle" fontSize="12" fontWeight="700" fill={palette.text}>
        {symbol}
      </text>
      <Terminal point={geometry.terminals.common} label="0" />
      <Terminal point={geometry.terminals.low} label={lowLabel} />
      <Terminal point={geometry.terminals.high} label={highLabel} />
      <rect
        x={geometry.rect.x}
        y={geometry.rect.y}
        width={geometry.rect.width}
        height={geometry.rect.height}
        fill="transparent"
      />
    </g>
  );
}

function AnalogVoltmeter(props: Omit<MeterProps, 'kind'>) {
  return <AnalogMeter kind="voltmeter" {...props} />;
}

function AnalogAmmeter(props: Omit<MeterProps, 'kind'>) {
  return <AnalogMeter kind="ammeter" {...props} />;
}

function KnifeSwitch({ center, closed }: KnifeSwitchProps) {
  const left = { x: center.x - 18, y: center.y + 2 };
  const right = { x: center.x + 18, y: center.y + 2 };
  const bladeEnd = closed ? { x: right.x - 2, y: right.y } : { x: center.x + 10, y: center.y - 12 };

  return (
    <g>
      <BevelBox x={center.x - 28} y={center.y - 4} width={56} height={12} depth={3} />
      <circle cx={left.x} cy={left.y} r={2.6} fill={palette.fill} stroke={palette.stroke} strokeWidth={1} />
      <circle cx={right.x} cy={right.y} r={2.6} fill={palette.fill} stroke={palette.stroke} strokeWidth={1} />
      <line x1={left.x} y1={left.y} x2={bladeEnd.x} y2={bladeEnd.y} stroke={palette.stroke} strokeWidth={1.6} strokeLinecap="round" />
      <text x={center.x} y={center.y + 18} textAnchor="middle" fontSize="8.5" fill={palette.note}>
        S
      </text>
    </g>
  );
}

function PowerSupply({ center, emf, sourceResistance }: PowerSupplyProps) {
  return (
    <g>
      <BevelBox x={center.x - 58} y={center.y - 22} width={116} height={38} depth={4}>
        <line x1={center.x - 18} y1={center.y - 6} x2={center.x + 18} y2={center.y - 6} stroke={palette.strokeSoft} strokeWidth={0.8} />
      </BevelBox>
      <Terminal point={{ x: center.x - 46, y: center.y - 24 }} />
      <Terminal point={{ x: center.x + 46, y: center.y - 24 }} />
      <text x={center.x - 46} y={center.y - 34} textAnchor="middle" fontSize="8.5" fill={palette.text}>
        -
      </text>
      <text x={center.x + 46} y={center.y - 34} textAnchor="middle" fontSize="8.5" fill={palette.text}>
        +
      </text>
      <text x={center.x} y={center.y + 1} textAnchor="middle" fontSize="9.5" fill={palette.text}>
        E={formatValue(emf)}V
      </text>
      <text x={center.x} y={center.y + 28} textAnchor="middle" fontSize="8.5" fill={palette.note}>
        r={formatValue(sourceResistance)}Ω
      </text>
    </g>
  );
}

function ResistorFixture({ center, resistance }: ResistorFixtureProps) {
  return (
    <g>
      <line x1={center.x - 42} y1={center.y - 2} x2={center.x - 18} y2={center.y - 2} stroke={palette.stroke} strokeWidth={1.4} />
      <line x1={center.x + 18} y1={center.y - 2} x2={center.x + 42} y2={center.y - 2} stroke={palette.stroke} strokeWidth={1.4} />
      <BevelBox x={center.x - 18} y={center.y - 10} width={36} height={16} depth={3} />
      <Terminal point={{ x: center.x - 42, y: center.y - 2 }} />
      <Terminal point={{ x: center.x + 42, y: center.y - 2 }} />
      <text x={center.x} y={center.y - 16} textAnchor="middle" fontSize="8.5" fill={palette.text}>
        Rₓ
      </text>
      <text x={center.x} y={center.y + 18} textAnchor="middle" fontSize="8" fill={palette.note}>
        {formatValue(resistance)}Ω
      </text>
    </g>
  );
}

function Rheostat({ center, slider, sliderActive, onSliderPointerDown }: RheostatProps) {
  return (
    <g>
      <line x1={center.x - 42} y1={center.y + 4} x2={center.x - 28} y2={center.y + 4} stroke={palette.stroke} strokeWidth={1.4} />
      <line x1={center.x + 28} y1={center.y + 4} x2={center.x + 42} y2={center.y + 4} stroke={palette.stroke} strokeWidth={1.4} />
      <BevelBox x={center.x - 28} y={center.y - 8} width={56} height={16} depth={3} />
      {[-6, -1, 4, 9].map((offset) => (
        <line
          key={offset}
          x1={center.x - 22}
          y1={center.y + offset}
          x2={center.x + 22}
          y2={center.y + offset}
          stroke={palette.strokeSoft}
          strokeWidth={0.8}
        />
      ))}
      <line
        x1={slider.x}
        y1={slider.y}
        x2={slider.x - 10}
        y2={center.y - 2}
        stroke={palette.stroke}
        strokeWidth={1.2}
      />
      <rect
        x={slider.x - 6}
        y={slider.y - 4}
        width={12}
        height={4}
        fill={palette.fill}
        stroke={palette.stroke}
        strokeWidth={1}
        style={{ cursor: sliderActive ? 'grabbing' : 'ew-resize' }}
        onPointerDown={onSliderPointerDown}
      />
      <Terminal point={{ x: center.x - 42, y: center.y + 4 }} />
      <Terminal point={{ x: center.x + 42, y: center.y + 4 }} />
      <Terminal point={slider} />
      <text x={center.x} y={center.y + 24} textAnchor="middle" fontSize="8.5" fill={palette.note}>
        滑动变阻器
      </text>
    </g>
  );
}

function DraggableGroup({
  active,
  onPointerDown,
  children,
}: {
  active: boolean;
  onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <g onPointerDown={onPointerDown} style={{ cursor: active ? 'grabbing' : 'grab' }}>
      {children}
    </g>
  );
}

export function ExperimentBoardScene({
  mode,
  params,
  result,
  closed,
  onMeterHover,
  onMeterLeave,
}: ExperimentBoardSceneProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [offsets, setOffsets] = useState<OffsetMap>({
    power: ZERO_POINT,
    switch: ZERO_POINT,
    ammeter: ZERO_POINT,
    voltmeter: ZERO_POINT,
    resistor: ZERO_POINT,
    rheostat: ZERO_POINT,
  });
  const [sliderRatio, setSliderRatio] = useState(0.78);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const draggingKey = dragState?.key ?? null;

  const clientToSvg = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    return {
      x: ((clientX - rect.left) / rect.width) * SCENE_W,
      y: ((clientY - rect.top) / rect.height) * SCENE_H,
    };
  };

  useEffect(() => {
    if (!dragState) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerId !== dragState.pointerId) return;
      const nextPoint = clientToSvg(event.clientX, event.clientY);
      if (!nextPoint) return;

      if (dragState.key === 'slider') {
        const deltaX = nextPoint.x - dragState.startPointer.x;
        const nextRatio = clamp(
          dragState.startSliderRatio + deltaX / (SLIDER_TRACK_HALF * 2),
          0,
          1,
        );
        setSliderRatio(nextRatio);
        return;
      }

      const partKey = dragState.key;

      setOffsets((prev) => ({
        ...prev,
        [partKey]: clampOffset(mode, partKey, {
          x: dragState.startOffset.x + nextPoint.x - dragState.startPointer.x,
          y: dragState.startOffset.y + nextPoint.y - dragState.startPointer.y,
        }),
      }));
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerId === dragState.pointerId) {
        setDragState(null);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [dragState]);

  const startDrag =
    (key: PartKey) =>
    (event: ReactPointerEvent<SVGGElement>) => {
      const point = clientToSvg(event.clientX, event.clientY);
      if (!point) return;
      event.preventDefault();
      event.stopPropagation();
      onMeterLeave?.();
      setDragState({
        key,
        pointerId: event.pointerId,
        startPointer: point,
        startOffset: offsets[key],
        startSliderRatio: sliderRatio,
      });
    };

  const startSliderDrag = (event: ReactPointerEvent<SVGRectElement>) => {
    const point = clientToSvg(event.clientX, event.clientY);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    onMeterLeave?.();
    setDragState({
      key: 'slider',
      pointerId: event.pointerId,
      startPointer: point,
      startOffset: ZERO_POINT,
      startSliderRatio: sliderRatio,
    });
  };

  const liveCurrent = closed ? result.I : 0;
  const liveVoltage = closed ? result.V : 0;
  const layout = getSceneLayout(mode, params, result, offsets, sliderRatio);
  const guideText =
    mode === 'ideal'
      ? '理想接法'
      : mode === 'inner'
        ? '电压表跨接 A 与 Rₓ'
        : '电压表跨接 Rₓ';

  return (
    <div className="h-full w-full bg-white">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <rect x="0" y="0" width={SCENE_W} height={SCENE_H} fill={palette.paper} />
        <text x={SCENE_W / 2} y="22" textAnchor="middle" fontSize="9.5" fill={palette.note}>
          {guideText}
        </text>

        <WirePath
          active={closed}
          points={routePowerToSwitch(layout.powerLeft, layout.switchLeft)}
        />
        <WirePath
          active={closed}
          points={routeSwitchToAmmeter(layout.switchRight, layout.ammeter.terminals.common)}
        />
        <WirePath
          active={closed}
          points={routeSeriesLink(layout.currentNode, layout.resistorLeft, 14)}
        />
        <WirePath
          active={closed}
          points={routeSeriesLink(layout.resistorRight, layout.rheostatLeft, 20)}
        />
        <WirePath
          active={closed}
          points={routeRheostatToPower(layout.rheostatSlider, layout.powerRight)}
        />
        <WirePath
          active={closed}
          points={routeBranchToVoltmeter(layout.branchLeft, layout.voltmeter.terminals.common)}
        />
        <WirePath
          active={closed}
          points={routeVoltmeterToBranch(layout.voltmeterNode, layout.branchRight)}
        />

        <DraggableGroup active={draggingKey === 'power'} onPointerDown={startDrag('power')}>
          <PowerSupply center={layout.powerCenter} emf={params.E} sourceResistance={params.r} />
        </DraggableGroup>
        <DraggableGroup active={draggingKey === 'switch'} onPointerDown={startDrag('switch')}>
          <KnifeSwitch center={layout.switchCenter} closed={closed} />
        </DraggableGroup>
        <DraggableGroup active={draggingKey === 'resistor'} onPointerDown={startDrag('resistor')}>
          <ResistorFixture center={layout.resistorCenter} resistance={params.Rx} />
        </DraggableGroup>
        <DraggableGroup active={draggingKey === 'rheostat'} onPointerDown={startDrag('rheostat')}>
          <Rheostat
            center={layout.rheostatCenter}
            slider={layout.rheostatSlider}
            sliderActive={draggingKey === 'slider'}
            onSliderPointerDown={startSliderDrag}
          />
        </DraggableGroup>
        <DraggableGroup active={draggingKey === 'ammeter'} onPointerDown={startDrag('ammeter')}>
          <AnalogAmmeter
            center={layout.ammeterCenter}
            reading={liveCurrent}
            rangeReading={result.I}
            params={params}
            hoverEnabled={!dragState}
            dragging={draggingKey === 'ammeter'}
            onHover={onMeterHover}
            onLeave={onMeterLeave}
          />
        </DraggableGroup>
        <DraggableGroup active={draggingKey === 'voltmeter'} onPointerDown={startDrag('voltmeter')}>
          <AnalogVoltmeter
            center={layout.voltmeterCenter}
            reading={liveVoltage}
            rangeReading={result.V}
            params={params}
            hoverEnabled={!dragState}
            dragging={draggingKey === 'voltmeter'}
            onHover={onMeterHover}
            onLeave={onMeterLeave}
          />
        </DraggableGroup>

      </svg>
    </div>
  );
}
