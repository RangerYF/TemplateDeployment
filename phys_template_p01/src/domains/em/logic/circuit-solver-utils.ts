/**
 * 电路求解器公用工具函数
 *
 * 提供电路计算中的通用操作：并联电阻、超量程检测、元件查找。
 */

import type { Entity } from '@/core/types';

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
