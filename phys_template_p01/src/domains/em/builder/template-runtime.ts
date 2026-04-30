import type { Entity, ParamValues, PhysicsResult } from '@/core/types';
import { resolveMeterConversionBuilderAnalysis } from './template-analysis';

interface TemplateRuntimeParams {
  familyId: string | null;
  variantId: string | null;
  entities: Map<string, Entity>;
  builderParamValues: ParamValues;
}

interface TemplateRuntimeEvaluation {
  result: PhysicsResult | null;
  error: string | null;
}

export function evaluateBuilderTemplateRuntime(
  params: TemplateRuntimeParams,
): TemplateRuntimeEvaluation | null {
  if (params.familyId !== 'meter-conversion' || !params.variantId) {
    return null;
  }

  const analysis = resolveMeterConversionBuilderAnalysis({
    variantId: params.variantId,
    entities: params.entities,
    builderParamValues: params.builderParamValues,
  });
  if (!analysis) {
    return {
      result: null,
      error: '电表改装模板缺少表头、改装电阻或改装后的仪表',
    };
  }

  const source = findFirstEntity(params.entities, 'dc-source');
  const { galvanometer, accessory, convertedMeter, result } = analysis;

  galvanometer.properties.reading = toGalvanometerStoredReading(
    result.meterCurrent,
    galvanometer.properties.range,
  );
  galvanometer.properties.overRange = result.isUnsafe;
  galvanometer.properties.current = result.meterCurrent;
  galvanometer.properties.voltage = result.meterVoltage;
  galvanometer.properties.deflectionRatio = result.usedPointerRatio;

  accessory.properties.resistance = result.actualAccessoryResistance;
  accessory.properties.current =
    result.mode === 'ammeter' ? result.shuntCurrent : result.meterCurrent;
  accessory.properties.voltage =
    result.mode === 'ammeter' ? result.meterVoltage : result.accessoryVoltage;
  accessory.properties.power = result.accessoryPower;

  convertedMeter.properties.reading = result.indicatedValue;
  convertedMeter.properties.overRange = result.isOverRange || result.isUnsafe;
  convertedMeter.properties.current =
    result.mode === 'ammeter' ? result.operatingInput : result.meterCurrent;
  convertedMeter.properties.voltage =
    result.mode === 'ammeter' ? result.meterVoltage : result.operatingInput;

  if (result.mode === 'ammeter') {
    convertedMeter.properties.internalResistance = result.equivalentResistanceActual;
  } else {
    convertedMeter.properties.internalResistance = result.inputResistanceActual;
  }

  if (source) {
    source.properties.totalCurrent =
      result.mode === 'ammeter' ? result.operatingInput : result.meterCurrent;
    source.properties.terminalVoltage =
      result.mode === 'ammeter' ? result.meterVoltage : result.operatingInput;
    source.properties.operatingInput = result.operatingInput;
    source.properties.targetRange = result.targetRange;
    source.properties.originalFullScale = result.originalFullScale;
    source.properties.pointerRatio = result.pointerRatio;
    source.properties.usedPointerRatio = result.usedPointerRatio;
    source.properties.currentErrorPercent = result.currentErrorPercent;
    source.properties.fullScaleErrorPercent = result.fullScaleErrorPercent;
    source.properties.idealAccessoryResistance = result.idealAccessoryResistance;
    source.properties.actualAccessoryResistance = result.actualAccessoryResistance;
    source.properties.isUnsafe = result.isUnsafe;
    source.properties.isOverRange = result.isOverRange;
    source.properties.scaleMarks = result.scaleMarks;
    source.properties.curve = result.curve;

    if (result.mode === 'ammeter') {
      source.properties.equivalentResistanceActual = result.equivalentResistanceActual;
      source.properties.equivalentResistanceIdeal = result.equivalentResistanceIdeal;
    } else {
      source.properties.inputResistanceActual = result.inputResistanceActual;
      source.properties.inputResistanceIdeal = result.inputResistanceIdeal;
    }
  }

  return {
    result: {
      time: 0,
      forceAnalyses: new Map(),
      motionStates: new Map(),
    } satisfies PhysicsResult,
    error: null,
  };
}

function findFirstEntity(
  entities: Map<string, Entity>,
  type: string,
): Entity | undefined {
  for (const entity of entities.values()) {
    if (entity.type === type) return entity;
  }
  return undefined;
}

function toGalvanometerStoredReading(currentAmpere: number, rawRange: unknown): number {
  const range = typeof rawRange === 'number' && Number.isFinite(rawRange) ? rawRange : 0;
  return range > 1 ? currentAmpere * 1e6 : currentAmpere;
}
