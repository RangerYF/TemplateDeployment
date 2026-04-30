/**
 * 电路求解器公用工具函数
 *
 * 提供电路计算中的通用操作：并联电阻、超量程检测、元件查找。
 */

import type { Entity } from '@/core/types';

export type RheostatConnectionMode = 'variable' | 'divider';

/**
 * 计算两个电阻的并联等效电阻
 * R_parallel = (R1 * R2) / (R1 + R2)
 */
export function parallelResistance(r1: number, r2: number): number {
  if (r1 <= 0 || r2 <= 0) return 0;
  return (r1 * r2) / (r1 + r2);
}

/**
 * 检测仪表是否超量程，并更新实体 properties
 */
export function checkOverRange(
  entity: Entity,
  reading: number,
  range: number,
): boolean {
  const overRange = Math.abs(reading) > range;
  entity.properties.reading = reading;
  entity.properties.overRange = overRange;
  return overRange;
}

export function getRheostatConnectionMode(entity: Entity): RheostatConnectionMode {
  const mode = entity.properties.connectionMode as string | undefined;
  return mode === 'divider' ? 'divider' : 'variable';
}

export function getConfiguredResistance(entity: Entity): number {
  if (entity.type === 'fixed-resistor' || entity.type === 'resistance-box') {
    return (entity.properties.resistance as number) ?? 0;
  }

  if (entity.type === 'slide-rheostat') {
    const maxR = (entity.properties.maxResistance as number) ?? 50;
    const ratio = (entity.properties.sliderRatio as number) ?? 0.5;
    const mode = getRheostatConnectionMode(entity);
    return mode === 'divider' ? maxR : maxR * ratio;
  }

  return 0;
}

/**
 * 获取元件的等效电阻（考虑故障状态）
 *
 * - faultType = 'open'  → 断路，等效 R = Infinity
 * - faultType = 'short' → 短路，等效 R = 0
 * - 其他 → 返回元件本身的电阻值
 */
export function getEffectiveResistance(entity: Entity): number {
  const fault = entity.properties.faultType as string | undefined;
  if (fault === 'open') return Infinity;
  if (fault === 'short') return 0;

  return getConfiguredResistance(entity);
}

// ─── 元件类族判定 ───

/** 线性电阻元件（定值电阻、电阻箱） */
export function isFixedResistance(type: string): boolean {
  return type === 'fixed-resistor' || type === 'resistance-box';
}

/** 可调电阻元件（滑动变阻器、电阻箱） */
export function isVariableResistor(type: string): boolean {
  return type === 'slide-rheostat' || type === 'resistance-box';
}

/** 所有电阻性元件（定值电阻、电阻箱、滑动变阻器） */
export function isResistiveElement(type: string): boolean {
  return type === 'fixed-resistor' || type === 'resistance-box' || type === 'slide-rheostat';
}

/** 电流测量仪表（电流表、灵敏电流计） */
export function isCurrentMeter(type: string): boolean {
  return type === 'ammeter' || type === 'galvanometer';
}

// ─── 元件查找（精确类型） ───

/**
 * 在实体集合中查找指定类型的第一个实体
 */
export function findComponent(
  entities: Map<string, Entity>,
  type: string,
): Entity | undefined {
  for (const entity of entities.values()) {
    if (entity.type === type) return entity;
  }
  return undefined;
}

/**
 * 在实体集合中查找指定类型的所有实体
 */
export function findAllComponents(
  entities: Map<string, Entity>,
  type: string,
): Entity[] {
  const result: Entity[] = [];
  for (const entity of entities.values()) {
    if (entity.type === type) result.push(entity);
  }
  return result;
}

// ─── 元件查找（类族匹配） ───

/**
 * 按类族谓词查找第一个匹配的实体
 */
export function findByFamily(
  entities: Map<string, Entity>,
  predicate: (type: string) => boolean,
): Entity | undefined {
  for (const entity of entities.values()) {
    if (predicate(entity.type)) return entity;
  }
  return undefined;
}

export function findPreferredComponent(
  entities: Map<string, Entity>,
  type: string,
  preferredId?: string,
): Entity | undefined {
  if (preferredId) {
    const preferred = entities.get(preferredId);
    if (preferred?.type === type) return preferred;
  }
  return findComponent(entities, type);
}

export function findPreferredByFamily(
  entities: Map<string, Entity>,
  predicate: (type: string) => boolean,
  preferredId?: string,
): Entity | undefined {
  if (preferredId) {
    const preferred = entities.get(preferredId);
    if (preferred && predicate(preferred.type)) return preferred;
  }
  return findByFamily(entities, predicate);
}

export function setInstrumentActivity(
  entities: Map<string, Entity>,
  options: {
    activeCurrentMeterId?: string;
    activeVoltmeterId?: string;
  },
): void {
  const { activeCurrentMeterId, activeVoltmeterId } = options;

  for (const entity of entities.values()) {
    if (isCurrentMeter(entity.type)) {
      entity.properties.isActiveInstrument = entity.id === activeCurrentMeterId;
    } else if (entity.type === 'voltmeter') {
      entity.properties.isActiveInstrument = entity.id === activeVoltmeterId;
    }
  }
}

export function resetInactiveInstrumentReadings(
  entities: Map<string, Entity>,
  options: {
    activeCurrentMeterId?: string;
    activeVoltmeterId?: string;
  },
): void {
  const { activeCurrentMeterId, activeVoltmeterId } = options;

  for (const entity of entities.values()) {
    if (isCurrentMeter(entity.type) && activeCurrentMeterId && entity.id !== activeCurrentMeterId) {
      entity.properties.reading = 0;
      entity.properties.overRange = false;
      if ('deflectionRatio' in entity.properties) {
        entity.properties.deflectionRatio = 0;
      }
    }

    if (entity.type === 'voltmeter' && activeVoltmeterId && entity.id !== activeVoltmeterId) {
      entity.properties.reading = 0;
      entity.properties.overRange = false;
      if ('deflectionRatio' in entity.properties) {
        entity.properties.deflectionRatio = 0;
      }
    }
  }
}

/**
 * 按类族谓词查找所有匹配的实体
 */
export function findAllByFamily(
  entities: Map<string, Entity>,
  predicate: (type: string) => boolean,
): Entity[] {
  const result: Entity[] = [];
  for (const entity of entities.values()) {
    if (predicate(entity.type)) result.push(entity);
  }
  return result;
}
