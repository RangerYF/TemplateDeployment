const EPSILON = 1e-9;

export interface OhmmeterSystemParams {
  emf: number;
  fullScaleCurrent: number;
  galvanometerResistance: number;
  batteryInternalResistance: number;
  seriesResistance: number;
}

function sanitizeResistance(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(value, 0);
}

function sanitizePositive(value: number): number {
  if (!Number.isFinite(value)) return EPSILON;
  return Math.max(value, EPSILON);
}

export function computeInternalResistance(
  galvanometerResistance: number,
  batteryInternalResistance: number,
  seriesResistance: number,
): number {
  return (
    sanitizeResistance(galvanometerResistance) +
    sanitizeResistance(batteryInternalResistance) +
    sanitizeResistance(seriesResistance)
  );
}

export function computeRmid(
  galvanometerResistance: number,
  batteryInternalResistance: number,
  seriesResistance: number,
): number {
  return computeInternalResistance(
    galvanometerResistance,
    batteryInternalResistance,
    seriesResistance,
  );
}

export function computeTheta(
  rx: number,
  galvanometerResistance: number,
  batteryInternalResistance: number,
  seriesResistance: number,
): number {
  const internalResistance = computeInternalResistance(
    galvanometerResistance,
    batteryInternalResistance,
    seriesResistance,
  );
  const resistance = Math.max(rx, 0);

  return internalResistance / Math.max(internalResistance + resistance, EPSILON);
}

export function computeCurrent(
  rx: number,
  emf: number,
  galvanometerResistance: number,
  batteryInternalResistance: number,
  seriesResistance: number,
): number {
  const resistance =
    computeInternalResistance(
      galvanometerResistance,
      batteryInternalResistance,
      seriesResistance,
    ) + Math.max(rx, 0);

  return Math.max(emf, 0) / Math.max(resistance, EPSILON);
}

export function computeActualTheta(system: OhmmeterSystemParams, rx: number): number {
  return (
    computeCurrent(
      rx,
      system.emf,
      system.galvanometerResistance,
      system.batteryInternalResistance,
      system.seriesResistance,
    ) / sanitizePositive(system.fullScaleCurrent)
  );
}

export function computeIdealInternalResistance(emf: number, fullScaleCurrent: number): number {
  return Math.max(emf, 0) / sanitizePositive(fullScaleCurrent);
}

export function computeZeroedSeriesResistance(
  emf: number,
  fullScaleCurrent: number,
  galvanometerResistance: number,
  batteryInternalResistance: number,
): number {
  return Math.max(
    computeIdealInternalResistance(emf, fullScaleCurrent) -
      sanitizeResistance(galvanometerResistance) -
      sanitizeResistance(batteryInternalResistance),
    0,
  );
}

export function canZeroExactly(
  emf: number,
  fullScaleCurrent: number,
  galvanometerResistance: number,
  batteryInternalResistance: number,
): boolean {
  return (
    computeIdealInternalResistance(emf, fullScaleCurrent) + EPSILON >=
    sanitizeResistance(galvanometerResistance) +
      sanitizeResistance(batteryInternalResistance)
  );
}

export function computeHalfDeflectionResistance(
  system: OhmmeterSystemParams,
): number {
  const internalResistance = computeInternalResistance(
    system.galvanometerResistance,
    system.batteryInternalResistance,
    system.seriesResistance,
  );
  const targetTwiceInternal = 2 * computeIdealInternalResistance(system.emf, system.fullScaleCurrent);

  return Math.max(targetTwiceInternal - internalResistance, 0);
}
