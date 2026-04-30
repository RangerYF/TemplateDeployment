import {
  canZeroExactly,
  computeActualTheta,
  computeCurrent,
  computeHalfDeflectionResistance,
  computeRmid,
  computeTheta,
  computeZeroedSeriesResistance,
  type OhmmeterSystemParams,
} from './ohmmeter-physics';

export interface OhmmeterMidpointParams {
  emf: number;
  fullScaleCurrent: number;
  galvanometerResistance: number;
  batteryInternalResistance: number;
  seriesResistance: number;
  rx: number;
  sampleCount?: number;
}

export interface OhmmeterMidpointPoint {
  resistance: number;
  theta: number;
}

export interface OhmmeterMidpointCurveSet {
  ideal: OhmmeterMidpointPoint[];
  actual: OhmmeterMidpointPoint[];
}

export interface OhmmeterMidpointResult {
  idealSystem: OhmmeterSystemParams;
  currentSystem: OhmmeterSystemParams;
  idealMidpointResistance: number;
  currentInternalResistance: number;
  currentHalfDeflectionResistance: number;
  zeroed: boolean;
  zeroingThetaAtRxZero: number;
  canZero: boolean;
  idealThetaAtCurrentRx: number;
  actualThetaAtCurrentRx: number;
  currentReadingCurrent: number;
  currentReadingIdeal: number;
  midpointRatioIdeal: number;
  midpointRatioActual: number;
  currentPoint: {
    resistance: number;
    idealTheta: number;
    actualTheta: number;
  };
  curves: OhmmeterMidpointCurveSet;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function buildCurve(
  maxResistance: number,
  sampleCount: number,
  mapTheta: (resistance: number) => number,
): OhmmeterMidpointPoint[] {
  const count = Math.max(2, Math.round(sampleCount));
  const upper = Math.max(maxResistance, 1);
  const points: OhmmeterMidpointPoint[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = index / (count - 1);
    const resistance = upper * t;
    points.push({
      resistance,
      theta: mapTheta(resistance),
    });
  }

  return points;
}

export function calculateOhmmeterMidpointComparison(
  params: OhmmeterMidpointParams,
): OhmmeterMidpointResult {
  const emf = Math.max(params.emf, 0);
  const fullScaleCurrent = Math.max(params.fullScaleCurrent, 1e-9);
  const galvanometerResistance = Math.max(params.galvanometerResistance, 0);
  const batteryInternalResistance = Math.max(params.batteryInternalResistance, 0);
  const seriesResistance = Math.max(params.seriesResistance, 0);
  const rx = Math.max(params.rx, 0);

  const idealSeriesResistance = computeZeroedSeriesResistance(
    emf,
    fullScaleCurrent,
    galvanometerResistance,
    batteryInternalResistance,
  );

  const idealSystem: OhmmeterSystemParams = {
    emf,
    fullScaleCurrent,
    galvanometerResistance,
    batteryInternalResistance,
    seriesResistance: idealSeriesResistance,
  };
  const currentSystem: OhmmeterSystemParams = {
    emf,
    fullScaleCurrent,
    galvanometerResistance,
    batteryInternalResistance,
    seriesResistance,
  };

  const idealMidpointResistance = computeRmid(
    idealSystem.galvanometerResistance,
    idealSystem.batteryInternalResistance,
    idealSystem.seriesResistance,
  );
  const currentInternalResistance = computeRmid(
    currentSystem.galvanometerResistance,
    currentSystem.batteryInternalResistance,
    currentSystem.seriesResistance,
  );
  const zeroingThetaAtRxZero = computeActualTheta(currentSystem, 0);
  const zeroed = Math.abs(zeroingThetaAtRxZero - 1) < 0.02;
  const currentHalfDeflectionResistance = computeHalfDeflectionResistance(currentSystem);
  const canZero = canZeroExactly(
    emf,
    fullScaleCurrent,
    galvanometerResistance,
    batteryInternalResistance,
  );
  const sampleMaxResistance = Math.max(
    rx * 1.15,
    idealMidpointResistance * 4,
    currentHalfDeflectionResistance * 1.2,
    currentInternalResistance * 1.2,
    1,
  );

  const idealThetaAtCurrentRx = computeTheta(
    rx,
    idealSystem.galvanometerResistance,
    idealSystem.batteryInternalResistance,
    idealSystem.seriesResistance,
  );
  const actualThetaAtCurrentRx = computeActualTheta(currentSystem, rx);
  const midpointRatioIdeal = computeTheta(
    idealMidpointResistance,
    idealSystem.galvanometerResistance,
    idealSystem.batteryInternalResistance,
    idealSystem.seriesResistance,
  );
  const midpointRatioActual = computeActualTheta(
    currentSystem,
    idealMidpointResistance,
  );

  return {
    idealSystem,
    currentSystem,
    idealMidpointResistance,
    currentInternalResistance,
    currentHalfDeflectionResistance,
    zeroed,
    zeroingThetaAtRxZero,
    canZero,
    idealThetaAtCurrentRx,
    actualThetaAtCurrentRx,
    currentReadingCurrent: computeCurrent(
      rx,
      currentSystem.emf,
      currentSystem.galvanometerResistance,
      currentSystem.batteryInternalResistance,
      currentSystem.seriesResistance,
    ),
    currentReadingIdeal: computeCurrent(
      rx,
      idealSystem.emf,
      idealSystem.galvanometerResistance,
      idealSystem.batteryInternalResistance,
      idealSystem.seriesResistance,
    ),
    midpointRatioIdeal,
    midpointRatioActual,
    currentPoint: {
      resistance: rx,
      idealTheta: idealThetaAtCurrentRx,
      actualTheta: actualThetaAtCurrentRx,
    },
    curves: {
      ideal: buildCurve(
        sampleMaxResistance,
        params.sampleCount ?? 81,
        (resistance) =>
          computeTheta(
            resistance,
            idealSystem.galvanometerResistance,
            idealSystem.batteryInternalResistance,
            idealSystem.seriesResistance,
          ),
      ),
      actual: buildCurve(
        sampleMaxResistance,
        params.sampleCount ?? 81,
        (resistance) => computeActualTheta(currentSystem, resistance),
      ),
    },
  };
}

export function clampOhmmeterTheta(theta: number): number {
  return clamp(theta, 0, 1.2);
}
