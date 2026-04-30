import type { Entity, ParamValues } from '@/core/types';
import {
  calculateAmmeterConversion,
  calculateVoltmeterConversion,
  type AmmeterConversionResult,
  type MeterConversionMode,
  type VoltmeterConversionResult,
} from '@/domains/em/logic/meter-conversion';

const EPSILON = 1e-9;

export interface MeterConversionBuilderAnalysis {
  mode: MeterConversionMode;
  galvanometer: Entity;
  accessory: Entity;
  convertedMeter: Entity;
  operatingInput: number;
  operatingLabel: string;
  operatingUnit: string;
  operatingStep: number;
  maxOperatingInput: number;
  result: AmmeterConversionResult | VoltmeterConversionResult;
}

export interface OhmmeterRangeRow {
  label: string;
  seriesResistance: number;
  midResistance: number;
  suggestedMin: number;
  suggestedMax: number;
  selected: boolean;
}

export interface OhmmeterBuilderAnalysis {
  variant: 'basic' | 'multi-range';
  source: Entity;
  currentRx?: number;
  ohmReading?: number;
  midResistance?: number;
  deflectionRatio: number;
  isZeroed: boolean;
  isHalfDeflection: boolean;
  isMidResistance: boolean;
  canZero?: boolean;
  zeroingThetaAtRxZero?: number;
  currentHalfDeflectionResistance?: number;
  selectedRange?: string;
  selectedSeriesResistance?: number;
  rangeRows: OhmmeterRangeRow[];
}

export function resolveMeterConversionBuilderAnalysis(params: {
  variantId: string;
  entities: Map<string, Entity>;
  builderParamValues: ParamValues;
}): MeterConversionBuilderAnalysis | null {
  const mode = resolveMeterConversionMode(params.variantId);
  if (!mode) return null;

  const galvanometer = findFirstEntity(params.entities, 'galvanometer');
  const accessory = findFirstEntity(params.entities, 'fixed-resistor');
  const convertedMeter = findFirstEntity(
    params.entities,
    mode === 'ammeter' ? 'ammeter' : 'voltmeter',
  );

  if (!galvanometer || !accessory || !convertedMeter) return null;

  const rg = getFiniteNumber(galvanometer.properties.internalResistance, 120);
  let ig = getFiniteNumber(galvanometer.properties.range, mode === 'ammeter' ? 300 : 3000);
  if (ig > 1) {
    ig *= 1e-6;
  }

  const targetRange = getFiniteNumber(
    convertedMeter.properties.range,
    mode === 'ammeter' ? 0.6 : 15,
  );
  const maxOperatingInput = Math.max(targetRange * 1.2, targetRange + (mode === 'ammeter' ? 0.05 : 1));
  const rawOperatingInput = getFiniteNumber(
    params.builderParamValues.conversionOperatingInput,
    mode === 'ammeter' ? targetRange * 0.7 : targetRange * 0.6,
  );
  const operatingInput = clamp(rawOperatingInput, 0, maxOperatingInput);
  const actualAccessoryResistance = Math.max(
    getFiniteNumber(accessory.properties.resistance, mode === 'ammeter' ? 0.06 : 4880),
    EPSILON,
  );

  const idealAccessoryResistance =
    mode === 'ammeter'
      ? (ig / Math.max(targetRange - ig, EPSILON)) * rg
      : targetRange / Math.max(ig, EPSILON) - rg;
  const extraResistance = actualAccessoryResistance - idealAccessoryResistance;
  const result =
    mode === 'ammeter'
      ? calculateAmmeterConversion({
          rg,
          ig,
          targetCurrent: targetRange,
          operatingCurrent: operatingInput,
          extraResistance,
        })
      : calculateVoltmeterConversion({
          rg,
          ig,
          targetVoltage: targetRange,
          operatingVoltage: operatingInput,
          extraResistance,
        });

  return {
    mode,
    galvanometer,
    accessory,
    convertedMeter,
    operatingInput,
    operatingLabel: mode === 'ammeter' ? '工作电流 I' : '工作电压 U',
    operatingUnit: mode === 'ammeter' ? 'A' : 'V',
    operatingStep: mode === 'ammeter' ? currentStep(targetRange) : voltageStep(targetRange),
    maxOperatingInput,
    result,
  };
}

export function resolveOhmmeterBuilderAnalysis(params: {
  variantId: string;
  entities: Map<string, Entity>;
}): OhmmeterBuilderAnalysis | null {
  const source = findFirstEntity(params.entities, 'dc-source');
  if (!source) return null;

  const rangeSwitch = findFirstEntity(params.entities, 'range-switch');
  const galvanometer = findFirstCurrentMeter(params.entities);
  const midResistance = getOptionalNumber(source.properties.R_mid);
  const ohmReading = getOptionalNumber(source.properties.ohmReading);
  const currentRx =
    getOptionalNumber(source.properties.currentRx) ??
    getOptionalNumber(source.properties.trueRx) ??
    getOptionalNumber(findFirstEntity(params.entities, 'resistance-box')?.properties.resistance);

  const variant = params.variantId === 'multi-range' ? 'multi-range' : 'basic';
  const rangeRows =
    variant === 'multi-range' && rangeSwitch
      ? buildOhmmeterRangeRows(rangeSwitch, galvanometer)
      : midResistance != null
        ? [
            {
              label: '当前调零状态',
              seriesResistance: getOptionalNumber(source.properties.R_internal) ?? midResistance,
              midResistance,
              suggestedMin: midResistance / 4,
              suggestedMax: midResistance * 4,
              selected: true,
            },
          ]
        : [];

  return {
    variant,
    source,
    currentRx: currentRx ?? undefined,
    ohmReading: ohmReading ?? undefined,
    midResistance: midResistance ?? undefined,
    deflectionRatio: clamp(getFiniteNumber(source.properties.deflectionRatio, 0), 0, 1.2),
    isZeroed: Boolean(source.properties.isZeroed),
    isHalfDeflection: Boolean(source.properties.isHalfDeflection),
    isMidResistance: Boolean(source.properties.isMidResistance),
    canZero: getOptionalBoolean(source.properties.canZero),
    zeroingThetaAtRxZero: getOptionalNumber(source.properties.zeroingThetaAtRxZero) ?? undefined,
    currentHalfDeflectionResistance: getOptionalNumber(source.properties.currentHalfDeflectionResistance) ?? undefined,
    selectedRange: getOptionalString(source.properties.selectedRange) ?? undefined,
    selectedSeriesResistance: getOptionalNumber(source.properties.R_sel) ?? undefined,
    rangeRows,
  };
}

function buildOhmmeterRangeRows(rangeSwitch: Entity, galvanometer: Entity | undefined): OhmmeterRangeRow[] {
  const ranges = Array.isArray(rangeSwitch.properties.ranges)
    ? (rangeSwitch.properties.ranges as Array<{ label?: unknown; resistance?: unknown }>)
    : [];
  const selectedIndex = Number(rangeSwitch.properties.selectedIndex ?? 0);
  const rg = getFiniteNumber(galvanometer?.properties.internalResistance, 0);

  return ranges.map((range, index) => {
    const seriesResistance = getFiniteNumber(range.resistance, 0);
    const midResistance = rg + seriesResistance;
    return {
      label: String(range.label ?? `档位 ${index + 1}`),
      seriesResistance,
      midResistance,
      suggestedMin: midResistance / 4,
      suggestedMax: midResistance * 4,
      selected: index === selectedIndex,
    };
  });
}

function resolveMeterConversionMode(variantId: string): MeterConversionMode | null {
  if (variantId === 'ammeter') return 'ammeter';
  if (variantId === 'voltmeter') return 'voltmeter';
  return null;
}

function findFirstEntity(entities: Map<string, Entity>, type: string): Entity | undefined {
  for (const entity of entities.values()) {
    if (entity.type === type) return entity;
  }
  return undefined;
}

function findFirstCurrentMeter(entities: Map<string, Entity>): Entity | undefined {
  for (const entity of entities.values()) {
    if (entity.type === 'galvanometer' || entity.type === 'ammeter') return entity;
  }
  return undefined;
}

function getFiniteNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function getOptionalNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function getOptionalString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function getOptionalBoolean(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function currentStep(value: number): number {
  if (value < 0.02) return 0.0001;
  if (value < 0.2) return 0.001;
  if (value < 1) return 0.01;
  return 0.05;
}

function voltageStep(value: number): number {
  if (value < 10) return 0.1;
  if (value < 50) return 0.5;
  return 1;
}
