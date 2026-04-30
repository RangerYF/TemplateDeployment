export type MeterConversionMode = 'ammeter' | 'voltmeter';

export interface MeterScaleMark {
  ratio: number;
  division: number;
  originalValue: number;
  convertedValue: number;
}

export interface MeterConversionCurvePoint {
  input: number;
  thetaIdeal: number;
  thetaActual: number;
  indicatedIdeal: number;
  indicatedActual: number;
  errorPercent: number;
  overRange: boolean;
}

export interface AmmeterConversionParams {
  rg: number;
  ig: number;
  targetCurrent: number;
  operatingCurrent: number;
  extraResistance: number;
  sampleCount?: number;
}

export interface VoltmeterConversionParams {
  rg: number;
  ig: number;
  targetVoltage: number;
  operatingVoltage: number;
  extraResistance: number;
  sampleCount?: number;
}

export interface AmmeterConversionResult {
  mode: 'ammeter';
  rg: number;
  ig: number;
  originalFullScale: number;
  targetRange: number;
  operatingInput: number;
  rangeMultiplier: number;
  idealAccessoryResistance: number;
  actualAccessoryResistance: number;
  equivalentResistanceIdeal: number;
  equivalentResistanceActual: number;
  meterCurrent: number;
  shuntCurrent: number;
  meterVoltage: number;
  pointerRatio: number;
  usedPointerRatio: number;
  indicatedValue: number;
  rawIndicatedValue: number;
  fullScaleErrorPercent: number;
  currentErrorPercent: number;
  meterPower: number;
  accessoryPower: number;
  totalPower: number;
  loadResistance: number;
  isNearFullScale: boolean;
  isOverRange: boolean;
  isUnsafe: boolean;
  scaleMarks: MeterScaleMark[];
  curve: MeterConversionCurvePoint[];
}

export interface VoltmeterConversionResult {
  mode: 'voltmeter';
  rg: number;
  ig: number;
  originalFullScale: number;
  targetRange: number;
  operatingInput: number;
  rangeMultiplier: number;
  idealAccessoryResistance: number;
  actualAccessoryResistance: number;
  inputResistanceIdeal: number;
  inputResistanceActual: number;
  meterCurrent: number;
  meterVoltage: number;
  accessoryVoltage: number;
  extraVoltage: number;
  pointerRatio: number;
  usedPointerRatio: number;
  indicatedValue: number;
  rawIndicatedValue: number;
  fullScaleErrorPercent: number;
  currentErrorPercent: number;
  meterPower: number;
  accessoryPower: number;
  totalPower: number;
  sensitivityOhmsPerVoltIdeal: number;
  sensitivityOhmsPerVoltActual: number;
  isNearFullScale: boolean;
  isOverRange: boolean;
  isUnsafe: boolean;
  scaleMarks: MeterScaleMark[];
  curve: MeterConversionCurvePoint[];
}

const EPSILON = 1e-9;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildScaleMarks(originalFullScale: number, convertedFullScale: number): MeterScaleMark[] {
  return Array.from({ length: 11 }, (_, division) => {
    const ratio = division / 10;
    return {
      ratio,
      division,
      originalValue: originalFullScale * ratio,
      convertedValue: convertedFullScale * ratio,
    };
  });
}

function buildCurve(
  maxInput: number,
  sampleCount: number,
  calculatePoint: (input: number) => Omit<MeterConversionCurvePoint, 'input'>,
): MeterConversionCurvePoint[] {
  const safeCount = Math.max(sampleCount, 2);

  return Array.from({ length: safeCount }, (_, index) => {
    const ratio = index / (safeCount - 1);
    const input = maxInput * ratio;
    return {
      input,
      ...calculatePoint(input),
    };
  });
}

function calculateVisibleReading(pointerRatio: number, targetRange: number): number {
  return clamp(pointerRatio, 0, 1) * targetRange;
}

export function calculateAmmeterConversion(params: AmmeterConversionParams): AmmeterConversionResult {
  const rg = Math.max(params.rg, EPSILON);
  const ig = Math.max(params.ig, EPSILON);
  const targetCurrent = Math.max(params.targetCurrent, ig * 1.0001);
  const operatingCurrent = Math.max(params.operatingCurrent, 0);
  const idealAccessoryResistance = (ig / Math.max(targetCurrent - ig, EPSILON)) * rg;
  const actualAccessoryResistance = Math.max(idealAccessoryResistance + params.extraResistance, EPSILON);
  const equivalentResistanceIdeal =
    (rg * idealAccessoryResistance) / Math.max(rg + idealAccessoryResistance, EPSILON);
  const equivalentResistanceActual =
    (rg * actualAccessoryResistance) / Math.max(rg + actualAccessoryResistance, EPSILON);
  const meterCurrent = operatingCurrent * actualAccessoryResistance / Math.max(rg + actualAccessoryResistance, EPSILON);
  const shuntCurrent = Math.max(operatingCurrent - meterCurrent, 0);
  const meterVoltage = meterCurrent * rg;
  const pointerRatio = meterCurrent / ig;
  const indicatedValue = calculateVisibleReading(pointerRatio, targetCurrent);
  const rawIndicatedValue = Math.max(pointerRatio, 0) * targetCurrent;
  const currentErrorPercent =
    operatingCurrent > EPSILON
      ? ((indicatedValue - operatingCurrent) / operatingCurrent) * 100
      : 0;
  const fullScaleMeterCurrent = targetCurrent * actualAccessoryResistance / Math.max(rg + actualAccessoryResistance, EPSILON);
  const fullScaleErrorPercent = ((fullScaleMeterCurrent / ig) - 1) * 100;
  const meterPower = meterCurrent * meterCurrent * rg;
  const accessoryPower = shuntCurrent * shuntCurrent * actualAccessoryResistance;
  const totalPower = meterVoltage * operatingCurrent;
  const maxCurveInput = Math.max(targetCurrent * 1.15, operatingCurrent * 1.05, targetCurrent + ig);
  const curve = buildCurve(maxCurveInput, params.sampleCount ?? 81, (input) => {
    const thetaIdeal = input / targetCurrent;
    const actualMeterCurrent = input * actualAccessoryResistance / Math.max(rg + actualAccessoryResistance, EPSILON);
    const thetaActual = actualMeterCurrent / ig;
    const indicatedActual = calculateVisibleReading(thetaActual, targetCurrent);

    return {
      thetaIdeal,
      thetaActual,
      indicatedIdeal: calculateVisibleReading(thetaIdeal, targetCurrent),
      indicatedActual,
      errorPercent: input > EPSILON ? ((indicatedActual - input) / input) * 100 : 0,
      overRange: thetaActual > 1,
    };
  });

  return {
    mode: 'ammeter',
    rg,
    ig,
    originalFullScale: ig,
    targetRange: targetCurrent,
    operatingInput: operatingCurrent,
    rangeMultiplier: targetCurrent / ig,
    idealAccessoryResistance,
    actualAccessoryResistance,
    equivalentResistanceIdeal,
    equivalentResistanceActual,
    meterCurrent,
    shuntCurrent,
    meterVoltage,
    pointerRatio,
    usedPointerRatio: clamp(pointerRatio, 0, 1),
    indicatedValue,
    rawIndicatedValue,
    fullScaleErrorPercent,
    currentErrorPercent,
    meterPower,
    accessoryPower,
    totalPower,
    loadResistance: equivalentResistanceActual,
    isNearFullScale: pointerRatio >= 0.85 && pointerRatio <= 1.02,
    isOverRange: pointerRatio > 1,
    isUnsafe: meterCurrent > ig * 1.05,
    scaleMarks: buildScaleMarks(ig, targetCurrent),
    curve,
  };
}

export function calculateVoltmeterConversion(params: VoltmeterConversionParams): VoltmeterConversionResult {
  const rg = Math.max(params.rg, EPSILON);
  const ig = Math.max(params.ig, EPSILON);
  const originalFullScale = ig * rg;
  const targetVoltage = Math.max(params.targetVoltage, originalFullScale * 1.0001);
  const operatingVoltage = Math.max(params.operatingVoltage, 0);
  const idealAccessoryResistance = targetVoltage / ig - rg;
  const actualAccessoryResistance = Math.max(idealAccessoryResistance + params.extraResistance, EPSILON);
  const inputResistanceIdeal = rg + idealAccessoryResistance;
  const inputResistanceActual = rg + actualAccessoryResistance;
  const meterCurrent = operatingVoltage / Math.max(inputResistanceActual, EPSILON);
  const meterVoltage = meterCurrent * rg;
  const accessoryVoltage = meterCurrent * actualAccessoryResistance;
  const extraVoltage = meterCurrent * params.extraResistance;
  const pointerRatio = meterCurrent / ig;
  const indicatedValue = calculateVisibleReading(pointerRatio, targetVoltage);
  const rawIndicatedValue = Math.max(pointerRatio, 0) * targetVoltage;
  const currentErrorPercent =
    operatingVoltage > EPSILON
      ? ((indicatedValue - operatingVoltage) / operatingVoltage) * 100
      : 0;
  const fullScaleMeterCurrent = targetVoltage / Math.max(inputResistanceActual, EPSILON);
  const fullScaleErrorPercent = ((fullScaleMeterCurrent / ig) - 1) * 100;
  const meterPower = meterCurrent * meterCurrent * rg;
  const accessoryPower = meterCurrent * meterCurrent * actualAccessoryResistance;
  const totalPower = operatingVoltage * meterCurrent;
  const maxCurveInput = Math.max(targetVoltage * 1.15, operatingVoltage * 1.05, targetVoltage + originalFullScale);
  const curve = buildCurve(maxCurveInput, params.sampleCount ?? 81, (input) => {
    const thetaIdeal = input / targetVoltage;
    const actualMeterCurrent = input / Math.max(inputResistanceActual, EPSILON);
    const thetaActual = actualMeterCurrent / ig;
    const indicatedActual = calculateVisibleReading(thetaActual, targetVoltage);

    return {
      thetaIdeal,
      thetaActual,
      indicatedIdeal: calculateVisibleReading(thetaIdeal, targetVoltage),
      indicatedActual,
      errorPercent: input > EPSILON ? ((indicatedActual - input) / input) * 100 : 0,
      overRange: thetaActual > 1,
    };
  });

  return {
    mode: 'voltmeter',
    rg,
    ig,
    originalFullScale,
    targetRange: targetVoltage,
    operatingInput: operatingVoltage,
    rangeMultiplier: targetVoltage / originalFullScale,
    idealAccessoryResistance,
    actualAccessoryResistance,
    inputResistanceIdeal,
    inputResistanceActual,
    meterCurrent,
    meterVoltage,
    accessoryVoltage,
    extraVoltage,
    pointerRatio,
    usedPointerRatio: clamp(pointerRatio, 0, 1),
    indicatedValue,
    rawIndicatedValue,
    fullScaleErrorPercent,
    currentErrorPercent,
    meterPower,
    accessoryPower,
    totalPower,
    sensitivityOhmsPerVoltIdeal: inputResistanceIdeal / targetVoltage,
    sensitivityOhmsPerVoltActual: inputResistanceActual / targetVoltage,
    isNearFullScale: pointerRatio >= 0.85 && pointerRatio <= 1.02,
    isOverRange: pointerRatio > 1,
    isUnsafe: meterCurrent > ig * 1.05,
    scaleMarks: buildScaleMarks(originalFullScale, targetVoltage),
    curve,
  };
}
