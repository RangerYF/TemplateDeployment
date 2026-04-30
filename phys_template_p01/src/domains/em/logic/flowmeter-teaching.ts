import type { Entity, ParamValues } from '@/core/types';

export type FlowmeterTeachingStageId =
  | 'charge-separation'
  | 'induced-field-building'
  | 'dynamic-balance';

export interface FlowmeterTeachingState {
  stageId: FlowmeterTeachingStageId;
  stageIndex: 1 | 2 | 3;
  stageLabel: string;
  stageDescription: string;
  buildupRatio: number;
  currentElectricField: number;
  currentVoltage: number;
  targetElectricField: number;
  targetVoltage: number;
  balanceGap: number;
}

export interface FlowmeterSceneValues {
  speed: number;
  magneticField: number;
  pipeDiameter: number;
}

const FLOWMETER_BUILDUP_TIME = 1.6;
const STAGE_ONE_END_RATIO = 0.2;
const STAGE_TWO_END_RATIO = 0.92;

export function getFlowmeterSceneValues(
  entities: Iterable<Entity>,
  paramValues: ParamValues,
): FlowmeterSceneValues | null {
  const entityList = Array.from(entities);
  const efield = entityList.find((entity) => entity.type === 'uniform-efield');
  const bfield = entityList.find((entity) => entity.type === 'uniform-bfield');

  const hasFlowmeterParams =
    'v' in paramValues &&
    'B' in paramValues &&
    'L' in paramValues &&
    'U' in paramValues;

  if (!hasFlowmeterParams || !efield || !bfield) {
    return null;
  }

  return {
    speed: Math.max(readNumber(paramValues.v, 0), 0),
    magneticField: Math.max(
      readNumber(paramValues.B, (bfield.properties.magnitude as number) ?? 0),
      0,
    ),
    pipeDiameter: Math.max(
      readNumber(paramValues.L, (efield.properties.height as number) ?? 1),
      0.1,
    ),
  };
}

export function getFlowmeterTeachingState(input: {
  time: number;
  speed: number;
  magneticField: number;
  pipeDiameter: number;
}): FlowmeterTeachingState {
  const targetElectricField = Math.max(input.speed, 0) * Math.max(input.magneticField, 0);
  const targetVoltage = targetElectricField * Math.max(input.pipeDiameter, 0);
  const progress = clamp01(input.time / FLOWMETER_BUILDUP_TIME);
  const buildupRatio = smoothstep(progress);
  const currentElectricField = targetElectricField * buildupRatio;
  const currentVoltage = targetVoltage * buildupRatio;
  const balanceGap = targetElectricField - currentElectricField;

  if (buildupRatio < STAGE_ONE_END_RATIO) {
    return {
      stageId: 'charge-separation',
      stageIndex: 1,
      stageLabel: '阶段 1 · 正负电荷分离',
      stageDescription: '导电液体中的正负电荷先受 qvB 作用向两侧偏转，管壁开始积累异号电荷。',
      buildupRatio,
      currentElectricField,
      currentVoltage,
      targetElectricField,
      targetVoltage,
      balanceGap,
    };
  }

  if (buildupRatio < STAGE_TWO_END_RATIO) {
    return {
      stageId: 'induced-field-building',
      stageIndex: 2,
      stageLabel: '阶段 2 · 感应电场建立',
      stageDescription: '两侧分离电荷反向建立感应电场，E 逐步增大并逼近 vB，横向偏转开始被抵消。',
      buildupRatio,
      currentElectricField,
      currentVoltage,
      targetElectricField,
      targetVoltage,
      balanceGap,
    };
  }

  return {
    stageId: 'dynamic-balance',
    stageIndex: 3,
    stageLabel: '阶段 3 · 达到平衡',
    stageDescription: '达到平衡后 qE 与 qvB 大小相等，主流仍沿管道前进，此时 E = vB，U = BvL。',
    buildupRatio,
    currentElectricField: targetElectricField,
    currentVoltage: targetVoltage,
    targetElectricField,
    targetVoltage,
    balanceGap: 0,
  };
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function smoothstep(value: number): number {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function readNumber(value: ParamValues[string] | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
