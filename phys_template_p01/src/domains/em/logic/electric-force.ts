import type { Entity, Force, Vec2 } from '@/core/types';
import type { UniformEFieldCapacitorModel } from '../types';

export const EPSILON_0 = 8.854e-12;
const DEFAULT_DIRECTION: Vec2 = { x: 0, y: -1 };
const DEFAULT_DIELECTRIC = 1;
const PLATE_DEPTH = 1;

export type ResolvedUniformEFieldModel =
  | 'direct'
  | UniformEFieldCapacitorModel;

export interface UniformEFieldDerivedState {
  showPlates: boolean;
  gap: number;
  plateSpan: number;
  plateArea: number;
  dielectric: number;
  model: ResolvedUniformEFieldModel;
  effectiveE: number;
  voltage: number | null;
  plateCharge: number | null;
  capacitance: number | null;
}

export function getEFieldGap(field: Entity): number {
  const width = (field.properties.width as number) ?? 1;
  const height = (field.properties.height as number) ?? 1;
  const direction = (field.properties.direction as Vec2 | undefined) ?? DEFAULT_DIRECTION;
  return Math.abs(direction.x) >= Math.abs(direction.y) ? width : height;
}

export function getEFieldPlateSpan(field: Entity): number {
  const width = (field.properties.width as number) ?? 1;
  const height = (field.properties.height as number) ?? 1;
  const direction = (field.properties.direction as Vec2 | undefined) ?? DEFAULT_DIRECTION;
  return Math.abs(direction.x) >= Math.abs(direction.y) ? height : width;
}

export function isParallelPlateCapacitorField(field: Entity): boolean {
  const showPlates = (field.properties.showPlates as boolean) ?? false;
  if (!showPlates) return false;

  const model = field.properties.capacitorModel as UniformEFieldCapacitorModel | undefined;
  return (
    model === 'constant-voltage' ||
    model === 'constant-charge' ||
    field.properties.voltage != null ||
    field.properties.plateCharge != null
  );
}

export function getUniformEFieldModel(field: Entity): ResolvedUniformEFieldModel {
  if (!isParallelPlateCapacitorField(field)) {
    return 'direct';
  }

  const configuredModel = field.properties.capacitorModel as UniformEFieldCapacitorModel | undefined;
  if (configuredModel === 'constant-voltage' || configuredModel === 'constant-charge') {
    return configuredModel;
  }

  return field.properties.plateCharge != null && field.properties.voltage == null
    ? 'constant-charge'
    : 'constant-voltage';
}

export function getUniformEFieldModelLabel(model: ResolvedUniformEFieldModel): string {
  switch (model) {
    case 'constant-voltage':
      return '恒压模型';
    case 'constant-charge':
      return '定电荷模型';
    case 'direct':
    default:
      return '直接设定 E';
  }
}

export function getUniformEFieldDerivedState(field: Entity): UniformEFieldDerivedState {
  const showPlates = (field.properties.showPlates as boolean) ?? false;
  const gap = getEFieldGap(field);
  const plateSpan = getEFieldPlateSpan(field);
  const plateArea = Math.max(plateSpan, 0) * PLATE_DEPTH;
  const dielectric = Math.max((field.properties.dielectric as number) ?? DEFAULT_DIELECTRIC, 1e-9);
  const configuredMagnitude = (field.properties.magnitude as number) ?? 0;
  const configuredVoltage = field.properties.voltage as number | undefined;
  const configuredCharge = field.properties.plateCharge as number | undefined;
  const model = getUniformEFieldModel(field);

  if (model === 'direct') {
    return {
      showPlates,
      gap,
      plateSpan,
      plateArea,
      dielectric,
      model,
      effectiveE: configuredMagnitude,
      voltage: null,
      plateCharge: null,
      capacitance: null,
    };
  }

  const capacitance = gap > 0 && plateArea > 0
    ? (EPSILON_0 * dielectric * plateArea) / gap
    : 0;

  if (model === 'constant-charge') {
    const plateCharge = configuredCharge != null
      ? configuredCharge
      : capacitance > 0 && configuredVoltage != null
        ? capacitance * configuredVoltage
        : 0;
    const effectiveE = plateArea > 0
      ? plateCharge / (EPSILON_0 * dielectric * plateArea)
      : 0;
    const voltage = capacitance > 0
      ? plateCharge / capacitance
      : gap > 0
        ? effectiveE * gap
        : 0;

    return {
      showPlates,
      gap,
      plateSpan,
      plateArea,
      dielectric,
      model,
      effectiveE,
      voltage,
      plateCharge,
      capacitance,
    };
  }

  const voltage = configuredVoltage != null
    ? configuredVoltage
    : capacitance > 0 && configuredCharge != null
      ? configuredCharge / capacitance
      : 0;
  const effectiveE = gap > 0 ? voltage / gap : 0;
  const plateCharge = capacitance > 0
    ? capacitance * voltage
    : configuredCharge ?? 0;

  return {
    showPlates,
    gap,
    plateSpan,
    plateArea,
    dielectric,
    model,
    effectiveE,
    voltage,
    plateCharge,
    capacitance,
  };
}

/**
 * 获取匀强电场实体的有效场强
 * - 恒压模型：E = U / d
 * - 定电荷模型：E = Q / (ε0 εr S)
 * - 直接匀强场：E = magnitude
 */
export function getEffectiveE(field: Entity): number {
  return getUniformEFieldDerivedState(field).effectiveE;
}

/**
 * 电场力计算
 *
 * 物理公式：F = qE
 *
 * 计算带电粒子在所有匀强电场中受到的电场力之和。
 * 仅当粒子位于电场区域内时受力。
 */

export interface ElectricForceResult {
  /** 电场力 */
  force: Force;
  /** 力的分量 */
  fx: number;
  fy: number;
}

/**
 * 判断点是否在电场区域内
 */
function isInEFieldRegion(
  point: Vec2,
  fieldPosition: Vec2,
  fieldWidth: number,
  fieldHeight: number,
): boolean {
  return (
    point.x >= fieldPosition.x &&
    point.x <= fieldPosition.x + fieldWidth &&
    point.y >= fieldPosition.y &&
    point.y <= fieldPosition.y + fieldHeight
  );
}

/**
 * 计算单个带电粒子在所有电场中受到的电场力之和
 *
 * @param particlePosition - 粒子当前位置
 * @param charge - 电荷量 (C)
 * @param efieldEntities - 场景中所有 uniform-efield 实体
 * @returns 电场力结果，如果粒子不在任何电场中返回 null
 */
export function computeElectricForce(
  particlePosition: Vec2,
  charge: number,
  efieldEntities: Entity[],
): ElectricForceResult | null {
  let totalFx = 0;
  let totalFy = 0;
  let inField = false;

  for (const field of efieldEntities) {
    const fieldPos = field.transform.position;
    const fieldW = (field.properties.width as number) ?? 0;
    const fieldH = (field.properties.height as number) ?? 0;
    const fieldMag = getEffectiveE(field);
    const fieldDir = (field.properties.direction as Vec2) ?? { x: 0, y: 0 };

    if (!isInEFieldRegion(particlePosition, fieldPos, fieldW, fieldH)) {
      continue;
    }

    inField = true;

    // F = qE
    // E 方向为 fieldDir（单位向量），大小为 fieldMag
    totalFx += charge * fieldMag * fieldDir.x;
    totalFy += charge * fieldMag * fieldDir.y;
  }

  if (!inField) return null;

  const magnitude = Math.hypot(totalFx, totalFy);

  // 电磁力通常在 0.001~10N 量级，force-viewport 的对数映射以 100N 为参考上限
  // 乘以缩放因子使箭头长度能有效区分不同大小的电场力
  const EM_FORCE_DISPLAY_SCALE = 100;

  return {
    force: {
      type: 'electric',
      label: 'FE',
      magnitude,
      direction: magnitude > 0
        ? { x: totalFx / magnitude, y: totalFy / magnitude }
        : { x: 0, y: 0 },
      displayMagnitude: magnitude * EM_FORCE_DISPLAY_SCALE,
    },
    fx: totalFx,
    fy: totalFy,
  };
}
