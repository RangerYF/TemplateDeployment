export type CurrentResistanceMeterMode = 'ideal' | 'real';
export type CurrentResistanceMeasurementTarget = 'known' | 'unknown';

export interface CurrentResistanceMethodParams {
  emf: number;
  knownResistance: number;
  unknownResistance: number;
  ammeterResistance: number;
  meterMode: CurrentResistanceMeterMode;
  measurementTarget: CurrentResistanceMeasurementTarget;
  sampleCount?: number;
}

export interface CurrentResistanceMeasurementSnapshot {
  measurementTarget: CurrentResistanceMeasurementTarget;
  displayedCurrent: number;
  idealDisplayedCurrent: number;
  knownBranchCurrent: number;
  unknownBranchCurrent: number;
  totalCurrent: number;
  measuredBranchResistance: number;
  displayedCurrentErrorPercent: number;
}

export interface CurrentResistanceSweepPoint {
  unknownResistance: number;
  knownCurrentIdeal: number;
  knownCurrentReal: number;
  unknownCurrentIdeal: number;
  unknownCurrentReal: number;
  inferredResistanceIdeal: number;
  inferredResistanceReal: number;
  correctedResistanceReal: number;
  relativeErrorPercent: number;
}

export interface CurrentResistanceMethodResult {
  idealKnownMeasurement: CurrentResistanceMeasurementSnapshot;
  idealUnknownMeasurement: CurrentResistanceMeasurementSnapshot;
  realKnownMeasurement: CurrentResistanceMeasurementSnapshot;
  realUnknownMeasurement: CurrentResistanceMeasurementSnapshot;
  activeIdealMeasurement: CurrentResistanceMeasurementSnapshot;
  activeRealMeasurement: CurrentResistanceMeasurementSnapshot;
  activeMeasurement: CurrentResistanceMeasurementSnapshot;
  inferredResistanceIdeal: number;
  inferredResistanceReal: number;
  correctedResistanceReal: number;
  relativeErrorPercent: number;
  sweep: CurrentResistanceSweepPoint[];
  currentPoint: CurrentResistanceSweepPoint;
  range: {
    minUnknownResistance: number;
    maxUnknownResistance: number;
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function toPercent(value: number): number {
  return value * 100;
}

function createMeasurementSnapshot(
  emf: number,
  knownResistance: number,
  unknownResistance: number,
  ammeterResistance: number,
  measurementTarget: CurrentResistanceMeasurementTarget,
): CurrentResistanceMeasurementSnapshot {
  const knownCurrent =
    measurementTarget === 'known'
      ? emf / Math.max(knownResistance + ammeterResistance, 1e-9)
      : emf / Math.max(knownResistance, 1e-9);
  const unknownCurrent =
    measurementTarget === 'unknown'
      ? emf / Math.max(unknownResistance + ammeterResistance, 1e-9)
      : emf / Math.max(unknownResistance, 1e-9);
  const displayedCurrent =
    measurementTarget === 'known' ? knownCurrent : unknownCurrent;
  const idealDisplayedCurrent =
    measurementTarget === 'known'
      ? emf / Math.max(knownResistance, 1e-9)
      : emf / Math.max(unknownResistance, 1e-9);

  return {
    measurementTarget,
    displayedCurrent,
    idealDisplayedCurrent,
    knownBranchCurrent: knownCurrent,
    unknownBranchCurrent: unknownCurrent,
    totalCurrent: knownCurrent + unknownCurrent,
    measuredBranchResistance:
      measurementTarget === 'known'
        ? knownResistance + ammeterResistance
        : unknownResistance + ammeterResistance,
    displayedCurrentErrorPercent: toPercent(
      (displayedCurrent - idealDisplayedCurrent) /
        Math.max(idealDisplayedCurrent, 1e-9),
    ),
  };
}

function inferResistanceByIdealFormula(
  knownResistance: number,
  knownCurrent: number,
  unknownCurrent: number,
): number {
  return (
    knownResistance * (knownCurrent / Math.max(unknownCurrent, 1e-9))
  );
}

function inferResistanceWithCorrection(
  knownResistance: number,
  ammeterResistance: number,
  knownCurrent: number,
  unknownCurrent: number,
): number {
  return (
    (knownResistance + ammeterResistance) *
      (knownCurrent / Math.max(unknownCurrent, 1e-9)) -
    ammeterResistance
  );
}

function createSweepPoint(
  emf: number,
  knownResistance: number,
  unknownResistance: number,
  ammeterResistance: number,
): CurrentResistanceSweepPoint {
  const idealKnownMeasurement = createMeasurementSnapshot(
    emf,
    knownResistance,
    unknownResistance,
    0,
    'known',
  );
  const idealUnknownMeasurement = createMeasurementSnapshot(
    emf,
    knownResistance,
    unknownResistance,
    0,
    'unknown',
  );
  const realKnownMeasurement = createMeasurementSnapshot(
    emf,
    knownResistance,
    unknownResistance,
    ammeterResistance,
    'known',
  );
  const realUnknownMeasurement = createMeasurementSnapshot(
    emf,
    knownResistance,
    unknownResistance,
    ammeterResistance,
    'unknown',
  );
  const inferredResistanceIdeal = inferResistanceByIdealFormula(
    knownResistance,
    idealKnownMeasurement.displayedCurrent,
    idealUnknownMeasurement.displayedCurrent,
  );
  const inferredResistanceReal = inferResistanceByIdealFormula(
    knownResistance,
    realKnownMeasurement.displayedCurrent,
    realUnknownMeasurement.displayedCurrent,
  );
  const correctedResistanceReal = inferResistanceWithCorrection(
    knownResistance,
    ammeterResistance,
    realKnownMeasurement.displayedCurrent,
    realUnknownMeasurement.displayedCurrent,
  );

  return {
    unknownResistance,
    knownCurrentIdeal: idealKnownMeasurement.displayedCurrent,
    knownCurrentReal: realKnownMeasurement.displayedCurrent,
    unknownCurrentIdeal: idealUnknownMeasurement.displayedCurrent,
    unknownCurrentReal: realUnknownMeasurement.displayedCurrent,
    inferredResistanceIdeal,
    inferredResistanceReal,
    correctedResistanceReal,
    relativeErrorPercent: toPercent(
      (inferredResistanceReal - unknownResistance) /
        Math.max(unknownResistance, 1e-9),
    ),
  };
}

function buildResistanceSamples(
  knownResistance: number,
  unknownResistance: number,
  sampleCount: number,
): { minUnknownResistance: number; maxUnknownResistance: number; values: number[] } {
  const count = Math.max(24, Math.round(sampleCount));
  const minUnknownResistance = Math.max(
    0.5,
    Math.min(knownResistance, unknownResistance) * 0.18,
  );
  const maxUnknownResistance = Math.max(
    knownResistance * 4,
    unknownResistance * 1.8,
    24,
  );
  const values: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = count === 1 ? 0 : index / (count - 1);
    values.push(
      minUnknownResistance +
        (maxUnknownResistance - minUnknownResistance) * t,
    );
  }

  return { minUnknownResistance, maxUnknownResistance, values };
}

export function computeCurrentResistanceMethod(
  params: CurrentResistanceMethodParams,
): CurrentResistanceMethodResult {
  const emf = Math.max(params.emf, 0.1);
  const knownResistance = Math.max(params.knownResistance, 0.1);
  const unknownResistance = Math.max(params.unknownResistance, 0.1);
  const ammeterResistance = Math.max(params.ammeterResistance, 0);
  const measurementTarget = params.measurementTarget;
  const sampleCount = clamp(params.sampleCount ?? 81, 24, 161);

  const idealKnownMeasurement = createMeasurementSnapshot(
    emf,
    knownResistance,
    unknownResistance,
    0,
    'known',
  );
  const idealUnknownMeasurement = createMeasurementSnapshot(
    emf,
    knownResistance,
    unknownResistance,
    0,
    'unknown',
  );
  const realKnownMeasurement = createMeasurementSnapshot(
    emf,
    knownResistance,
    unknownResistance,
    ammeterResistance,
    'known',
  );
  const realUnknownMeasurement = createMeasurementSnapshot(
    emf,
    knownResistance,
    unknownResistance,
    ammeterResistance,
    'unknown',
  );

  const inferredResistanceIdeal = inferResistanceByIdealFormula(
    knownResistance,
    idealKnownMeasurement.displayedCurrent,
    idealUnknownMeasurement.displayedCurrent,
  );
  const inferredResistanceReal = inferResistanceByIdealFormula(
    knownResistance,
    realKnownMeasurement.displayedCurrent,
    realUnknownMeasurement.displayedCurrent,
  );
  const correctedResistanceReal = inferResistanceWithCorrection(
    knownResistance,
    ammeterResistance,
    realKnownMeasurement.displayedCurrent,
    realUnknownMeasurement.displayedCurrent,
  );

  const { minUnknownResistance, maxUnknownResistance, values } =
    buildResistanceSamples(
      knownResistance,
      unknownResistance,
      sampleCount,
    );

  return {
    idealKnownMeasurement,
    idealUnknownMeasurement,
    realKnownMeasurement,
    realUnknownMeasurement,
    activeIdealMeasurement:
      measurementTarget === 'known'
        ? idealKnownMeasurement
        : idealUnknownMeasurement,
    activeRealMeasurement:
      measurementTarget === 'known'
        ? realKnownMeasurement
        : realUnknownMeasurement,
    activeMeasurement:
      params.meterMode === 'ideal'
        ? measurementTarget === 'known'
          ? idealKnownMeasurement
          : idealUnknownMeasurement
        : measurementTarget === 'known'
          ? realKnownMeasurement
          : realUnknownMeasurement,
    inferredResistanceIdeal,
    inferredResistanceReal,
    correctedResistanceReal,
    relativeErrorPercent: toPercent(
      (inferredResistanceReal - unknownResistance) /
        Math.max(unknownResistance, 1e-9),
    ),
    sweep: values.map((value) =>
      createSweepPoint(
        emf,
        knownResistance,
        value,
        ammeterResistance,
      ),
    ),
    currentPoint: createSweepPoint(
      emf,
      knownResistance,
      unknownResistance,
      ammeterResistance,
    ),
    range: {
      minUnknownResistance,
      maxUnknownResistance,
    },
  };
}
