export type MeterReadingFamily = 'all' | 'ammeter' | 'voltmeter' | 'galvanometer';
export type MeterReadingMode = 'tick' | 'estimate';

export interface MeterTrainingSpec {
  id: string;
  family: Exclude<MeterReadingFamily, 'all'>;
  title: string;
  rangeLabel: string;
  unitLabel: string;
  minValue: number;
  maxValue: number;
  totalDivisions: number;
  majorTickEvery: number;
  labeledTickEvery: number;
  startAngle: number;
  endAngle: number;
  allowHalfStep: boolean;
  accent: string;
}

export interface MeterReadingQuestion {
  spec: MeterTrainingSpec;
  readingMode: MeterReadingMode;
  minorStep: number;
  inputStep: number;
  pointerDivision: number;
  value: number;
  precision: number;
  answerText: string;
  explanationLines: string[];
}

interface Point {
  x: number;
  y: number;
}

export interface MeterDialMark {
  division: number;
  value: number;
  isMajor: boolean;
  isLabeled: boolean;
  line: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
  label?: {
    x: number;
    y: number;
    text: string;
  };
}

export interface MeterDialGeometry {
  viewBoxWidth: number;
  viewBoxHeight: number;
  face: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
  };
  center: Point;
  arcPath: string;
  marks: MeterDialMark[];
  pointer: {
    angle: number;
    tip: Point;
    tail: Point;
  };
  titlePosition: Point;
  subtitlePosition: Point;
  unitPosition: Point;
  hubOuterRadius: number;
  hubInnerRadius: number;
}

const STANDARD_TOTAL_DIVISIONS = 30;
const STANDARD_START_ANGLE = 150;
const STANDARD_END_ANGLE = 30;

const DIAL_LAYOUT = {
  viewBoxWidth: 520,
  viewBoxHeight: 360,
  face: {
    x: 24,
    y: 20,
    width: 472,
    height: 304,
    radius: 20,
  },
  center: { x: 260, y: 250 },
  arcRadius: 182,
  tickOuterRadius: 170,
  tickMinorRadius: 154,
  tickMajorRadius: 145,
  tickLabeledRadius: 136,
  labelRadius: 118,
  pointerTipRadius: 132,
  pointerTailRadius: 16,
  titlePosition: { x: 260, y: 286 },
  subtitlePosition: { x: 260, y: 308 },
  unitPosition: { x: 260, y: 84 },
  hubOuterRadius: 10,
  hubInnerRadius: 4,
} as const;

const METER_TRAINING_SPECS: MeterTrainingSpec[] = [
  {
    id: 'ammeter-0.6',
    family: 'ammeter',
    title: '电流表',
    rangeLabel: '0 ~ 0.6 A',
    unitLabel: 'A',
    minValue: 0,
    maxValue: 0.6,
    totalDivisions: STANDARD_TOTAL_DIVISIONS,
    majorTickEvery: 5,
    labeledTickEvery: 5,
    startAngle: STANDARD_START_ANGLE,
    endAngle: STANDARD_END_ANGLE,
    allowHalfStep: true,
    accent: '#D97706',
  },
  {
    id: 'ammeter-3',
    family: 'ammeter',
    title: '电流表',
    rangeLabel: '0 ~ 3 A',
    unitLabel: 'A',
    minValue: 0,
    maxValue: 3,
    totalDivisions: STANDARD_TOTAL_DIVISIONS,
    majorTickEvery: 5,
    labeledTickEvery: 5,
    startAngle: STANDARD_START_ANGLE,
    endAngle: STANDARD_END_ANGLE,
    allowHalfStep: true,
    accent: '#B45309',
  },
  {
    id: 'voltmeter-3',
    family: 'voltmeter',
    title: '电压表',
    rangeLabel: '0 ~ 3 V',
    unitLabel: 'V',
    minValue: 0,
    maxValue: 3,
    totalDivisions: STANDARD_TOTAL_DIVISIONS,
    majorTickEvery: 5,
    labeledTickEvery: 5,
    startAngle: STANDARD_START_ANGLE,
    endAngle: STANDARD_END_ANGLE,
    allowHalfStep: true,
    accent: '#2563EB',
  },
  {
    id: 'voltmeter-15',
    family: 'voltmeter',
    title: '电压表',
    rangeLabel: '0 ~ 15 V',
    unitLabel: 'V',
    minValue: 0,
    maxValue: 15,
    totalDivisions: STANDARD_TOTAL_DIVISIONS,
    majorTickEvery: 5,
    labeledTickEvery: 10,
    startAngle: STANDARD_START_ANGLE,
    endAngle: STANDARD_END_ANGLE,
    allowHalfStep: true,
    accent: '#1D4ED8',
  },
  {
    id: 'galvanometer-300',
    family: 'galvanometer',
    title: '灵敏电流计',
    rangeLabel: '0 ~ 300 μA',
    unitLabel: 'μA',
    minValue: 0,
    maxValue: 300,
    totalDivisions: STANDARD_TOTAL_DIVISIONS,
    majorTickEvery: 5,
    labeledTickEvery: 10,
    startAngle: STANDARD_START_ANGLE,
    endAngle: STANDARD_END_ANGLE,
    allowHalfStep: true,
    accent: '#059669',
  },
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickOne<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)]!;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toRadians(angleDeg: number): number {
  return (angleDeg * Math.PI) / 180;
}

function polarFromMathAngle(center: Point, radius: number, angleDeg: number): Point {
  const angle = toRadians(angleDeg);
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y - Math.sin(angle) * radius,
  };
}

function trimTrailingZeros(text: string): string {
  return text.replace(/(\.\d*?[1-9])0+$/u, '$1').replace(/\.0+$/u, '').replace(/^-0$/u, '0');
}

export function getStepPrecision(step: number): number {
  const normalized = step.toFixed(6).replace(/0+$/u, '').replace(/\.$/u, '');
  const parts = normalized.split('.');
  return parts[1]?.length ?? 0;
}

export function formatMeterReadingValue(value: number, precision: number): string {
  return trimTrailingZeros(value.toFixed(precision));
}

export function getMeterMinorStep(spec: MeterTrainingSpec): number {
  return (spec.maxValue - spec.minValue) / spec.totalDivisions;
}

export function getMeterInputStep(
  spec: MeterTrainingSpec,
  readingMode: MeterReadingMode,
): number {
  const minorStep = getMeterMinorStep(spec);
  if (readingMode === 'estimate' && spec.allowHalfStep) return minorStep / 2;
  return minorStep;
}

export function getMeterValueAtDivision(
  spec: MeterTrainingSpec,
  division: number,
): number {
  return spec.minValue + division * getMeterMinorStep(spec);
}

export function getMeterPointerAngle(
  spec: MeterTrainingSpec,
  division: number,
): number {
  const ratio = clampNumber(division / spec.totalDivisions, 0, 1);
  return spec.startAngle + ratio * (spec.endAngle - spec.startAngle);
}

export function getMeterLabelPrecision(spec: MeterTrainingSpec): number {
  return getStepPrecision(getMeterMinorStep(spec) * spec.labeledTickEvery);
}

export function normalizeMeterAnswer(
  rawValue: number,
  precision: number,
): string | null {
  if (!Number.isFinite(rawValue)) return null;
  return formatMeterReadingValue(rawValue, precision);
}

export function isMeterAnswerAlignedToStep(
  question: MeterReadingQuestion,
  rawValue: number,
): boolean {
  if (!Number.isFinite(rawValue)) return false;
  const relative = (rawValue - question.spec.minValue) / question.inputStep;
  const nearest = Math.round(relative);
  return Math.abs(relative - nearest) < 1e-9;
}

export function isMeterReadingAnswerCorrect(
  question: MeterReadingQuestion,
  rawValue: number,
): boolean {
  if (!isMeterAnswerAlignedToStep(question, rawValue)) return false;
  const normalized = normalizeMeterAnswer(rawValue, question.precision);
  return normalized === question.answerText;
}

export function listMeterTrainingSpecs(
  family: MeterReadingFamily,
): MeterTrainingSpec[] {
  if (family === 'all') return METER_TRAINING_SPECS;
  return METER_TRAINING_SPECS.filter((spec) => spec.family === family);
}

export function createMeterReadingQuestion(config: {
  family: MeterReadingFamily;
  readingMode: MeterReadingMode;
}): MeterReadingQuestion {
  const specs = listMeterTrainingSpecs(config.family);
  const spec = pickOne(specs);
  const minorStep = getMeterMinorStep(spec);
  const inputStep = getMeterInputStep(spec, config.readingMode);
  const pointerDivision =
    config.readingMode === 'tick'
      ? randomInt(0, spec.totalDivisions)
      : randomInt(0, spec.totalDivisions - 1) + 0.5;
  const value = getMeterValueAtDivision(spec, pointerDivision);
  const precision = getStepPrecision(inputStep);
  const answerText = formatMeterReadingValue(value, precision);
  const divisionLabelPrecision = pointerDivision % 1 === 0 ? 0 : 1;

  const explanationLines = [
    `量程 ${spec.rangeLabel}，全表统一 ${spec.totalDivisions} 小格。`,
    `每小格 = (${formatMeterReadingValue(spec.maxValue, getStepPrecision(spec.maxValue))} - ${formatMeterReadingValue(spec.minValue, getStepPrecision(spec.minValue))}) ÷ ${spec.totalDivisions} = ${formatMeterReadingValue(minorStep, getStepPrecision(minorStep))} ${spec.unitLabel}。`,
    `指针位于第 ${formatMeterReadingValue(pointerDivision, divisionLabelPrecision)} 小格。`,
    `读数 = ${formatMeterReadingValue(pointerDivision, divisionLabelPrecision)} × ${formatMeterReadingValue(minorStep, getStepPrecision(minorStep))} = ${answerText} ${spec.unitLabel}。`,
  ];

  return {
    spec,
    readingMode: config.readingMode,
    minorStep,
    inputStep,
    pointerDivision,
    value,
    precision,
    answerText,
    explanationLines,
  };
}

export function buildMeterDialGeometry(
  question: MeterReadingQuestion,
): MeterDialGeometry {
  const spec = question.spec;
  const marks: MeterDialMark[] = [];

  for (let division = 0; division <= spec.totalDivisions; division += 1) {
    const angle = getMeterPointerAngle(spec, division);
    const isLabeled = division % spec.labeledTickEvery === 0;
    const isMajor = !isLabeled && division % spec.majorTickEvery === 0;
    const innerRadius = isLabeled
      ? DIAL_LAYOUT.tickLabeledRadius
      : isMajor
        ? DIAL_LAYOUT.tickMajorRadius
        : DIAL_LAYOUT.tickMinorRadius;
    const outer = polarFromMathAngle(DIAL_LAYOUT.center, DIAL_LAYOUT.tickOuterRadius, angle);
    const inner = polarFromMathAngle(DIAL_LAYOUT.center, innerRadius, angle);
    const value = getMeterValueAtDivision(spec, division);
    const label = isLabeled
      ? {
          ...polarFromMathAngle(DIAL_LAYOUT.center, DIAL_LAYOUT.labelRadius, angle),
          text: formatMeterReadingValue(value, getMeterLabelPrecision(spec)),
        }
      : undefined;

    marks.push({
      division,
      value,
      isMajor,
      isLabeled,
      line: {
        x1: outer.x,
        y1: outer.y,
        x2: inner.x,
        y2: inner.y,
      },
      label,
    });
  }

  const pointerAngle = getMeterPointerAngle(spec, question.pointerDivision);
  const pointerTip = polarFromMathAngle(
    DIAL_LAYOUT.center,
    DIAL_LAYOUT.pointerTipRadius,
    pointerAngle,
  );
  const pointerTail = polarFromMathAngle(
    DIAL_LAYOUT.center,
    DIAL_LAYOUT.pointerTailRadius,
    pointerAngle + 180,
  );

  const arcPoints = Array.from({ length: 61 }, (_, index) => {
    const angle =
      spec.startAngle +
      (index / 60) * (spec.endAngle - spec.startAngle);
    return polarFromMathAngle(DIAL_LAYOUT.center, DIAL_LAYOUT.arcRadius, angle);
  });
  const arcPath = arcPoints
    .map((point, index) => {
      const command = index === 0 ? 'M' : 'L';
      return `${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
    })
    .join(' ');

  return {
    viewBoxWidth: DIAL_LAYOUT.viewBoxWidth,
    viewBoxHeight: DIAL_LAYOUT.viewBoxHeight,
    face: DIAL_LAYOUT.face,
    center: DIAL_LAYOUT.center,
    arcPath,
    marks,
    pointer: {
      angle: pointerAngle,
      tip: pointerTip,
      tail: pointerTail,
    },
    titlePosition: DIAL_LAYOUT.titlePosition,
    subtitlePosition: DIAL_LAYOUT.subtitlePosition,
    unitPosition: DIAL_LAYOUT.unitPosition,
    hubOuterRadius: DIAL_LAYOUT.hubOuterRadius,
    hubInnerRadius: DIAL_LAYOUT.hubInnerRadius,
  };
}
