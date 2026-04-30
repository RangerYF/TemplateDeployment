export type VoltageResistanceMeasurementPosition = 'measure-rx' | 'measure-r0';

export type VoltageResistanceMeterMode = 'ideal' | 'real';

export interface VoltageResistanceMethodParams {
  E: number;
  R0: number;
  Rx: number;
  Rv: number;
  measurementPosition: VoltageResistanceMeasurementPosition;
}

export interface VoltageResistanceMethodReading {
  meterMode: VoltageResistanceMeterMode;
  measurementPosition: VoltageResistanceMeasurementPosition;
  totalCurrent: number;
  totalResistance: number;
  measuredElementResistance: number;
  effectiveMeasuredResistance: number;
  seriesElementResistance: number;
  voltmeterReading: number;
  measuredVoltage: number;
  seriesVoltage: number;
  estimatedResistance: number;
  relativeError: number;
  loadingRatio: number;
}

export interface VoltageResistancePositionComparison {
  measurementPosition: VoltageResistanceMeasurementPosition;
  ideal: VoltageResistanceMethodReading;
  real: VoltageResistanceMethodReading;
}

export interface VoltageResistanceCurvePoint {
  Rx: number;
  idealVoltage: number;
  realVoltage: number;
  idealEstimatedResistance: number;
  realEstimatedResistance: number;
  idealErrorPercent: number;
  realErrorPercent: number;
}

export interface VoltageResistanceMethodResult {
  current: VoltageResistancePositionComparison;
  measureRx: VoltageResistancePositionComparison;
  measureR0: VoltageResistancePositionComparison;
  recommendedPosition: VoltageResistanceMeasurementPosition;
  recommendReason: string;
}

function clampNonNegative(value: number, fallback = 0): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, value);
}

function clampPositive(value: number, minimum = 1e-6): number {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(minimum, value);
}

function parallelResistance(a: number, b: number): number {
  const safeA = clampPositive(a);
  const safeB = clampPositive(b);
  return (safeA * safeB) / (safeA + safeB);
}

function computeVoltageResistanceMethodReading(
  params: VoltageResistanceMethodParams,
  measurementPosition: VoltageResistanceMeasurementPosition,
  meterMode: VoltageResistanceMeterMode,
): VoltageResistanceMethodReading {
  const E = clampNonNegative(params.E);
  const R0 = clampPositive(params.R0);
  const Rx = clampPositive(params.Rx);
  const Rv = clampPositive(params.Rv);

  const measuringRx = measurementPosition === 'measure-rx';
  const measuredElementResistance = measuringRx ? Rx : R0;
  const seriesElementResistance = measuringRx ? R0 : Rx;
  const effectiveMeasuredResistance =
    meterMode === 'ideal'
      ? measuredElementResistance
      : parallelResistance(measuredElementResistance, Rv);
  const totalResistance = seriesElementResistance + effectiveMeasuredResistance;
  const totalCurrent = E <= 1e-9 ? 0 : E / Math.max(totalResistance, 1e-9);
  const voltmeterReading = totalCurrent * effectiveMeasuredResistance;
  const estimatedResistance =
    E <= 1e-9
      ? 0
      : measuringRx
        ? (R0 * voltmeterReading) / Math.max(E - voltmeterReading, 1e-9)
        : R0 * (E / Math.max(voltmeterReading, 1e-9) - 1);

  return {
    meterMode,
    measurementPosition,
    totalCurrent,
    totalResistance,
    measuredElementResistance,
    effectiveMeasuredResistance,
    seriesElementResistance,
    voltmeterReading,
    measuredVoltage: voltmeterReading,
    seriesVoltage: Math.max(E - voltmeterReading, 0),
    estimatedResistance,
    relativeError: (estimatedResistance - Rx) / Math.max(Rx, 1e-9),
    loadingRatio: effectiveMeasuredResistance / Math.max(measuredElementResistance, 1e-9),
  };
}

function computeVoltageResistancePositionComparison(
  params: VoltageResistanceMethodParams,
  measurementPosition: VoltageResistanceMeasurementPosition,
): VoltageResistancePositionComparison {
  return {
    measurementPosition,
    ideal: computeVoltageResistanceMethodReading(params, measurementPosition, 'ideal'),
    real: computeVoltageResistanceMethodReading(params, measurementPosition, 'real'),
  };
}

export function computeVoltageResistanceMethod(
  params: VoltageResistanceMethodParams,
): VoltageResistanceMethodResult {
  const measureRx = computeVoltageResistancePositionComparison(params, 'measure-rx');
  const measureR0 = computeVoltageResistancePositionComparison(params, 'measure-r0');
  const current =
    params.measurementPosition === 'measure-rx'
      ? measureRx
      : measureR0;

  const measureRxError = Math.abs(measureRx.real.relativeError);
  const measureR0Error = Math.abs(measureR0.real.relativeError);
  const recommendedPosition =
    measureRxError <= measureR0Error ? 'measure-rx' : 'measure-r0';

  return {
    current,
    measureRx,
    measureR0,
    recommendedPosition,
    recommendReason:
      recommendedPosition === 'measure-rx'
        ? `测 Rx 两端时真实误差更小：|e|=${(measureRxError * 100).toFixed(2)}%，优于测 R0 两端的 ${(measureR0Error * 100).toFixed(2)}%。`
        : `测 R0 两端时真实误差更小：|e|=${(measureR0Error * 100).toFixed(2)}%，优于测 Rx 两端的 ${(measureRxError * 100).toFixed(2)}%。`,
  };
}

export function buildVoltageResistanceMethodCurve(
  params: VoltageResistanceMethodParams,
  maxRx: number,
  pointCount = 81,
): VoltageResistanceCurvePoint[] {
  const safeMaxRx = clampPositive(maxRx, 1);
  const safePointCount = Math.max(2, Math.floor(pointCount));
  const curve: VoltageResistanceCurvePoint[] = [];

  for (let index = 0; index < safePointCount; index += 1) {
    const ratio = index / (safePointCount - 1);
    const displayRx = safeMaxRx * ratio;
    const sampleRx = Math.max(displayRx, 1e-6);
    const sampleParams: VoltageResistanceMethodParams = {
      ...params,
      Rx: sampleRx,
    };
    const ideal = computeVoltageResistanceMethodReading(
      sampleParams,
      params.measurementPosition,
      'ideal',
    );
    const real = computeVoltageResistanceMethodReading(
      sampleParams,
      params.measurementPosition,
      'real',
    );

    curve.push({
      Rx: displayRx,
      idealVoltage: ideal.voltmeterReading,
      realVoltage: real.voltmeterReading,
      idealEstimatedResistance: ideal.estimatedResistance,
      realEstimatedResistance: real.estimatedResistance,
      idealErrorPercent: ideal.relativeError * 100,
      realErrorPercent: real.relativeError * 100,
    });
  }

  return curve;
}
