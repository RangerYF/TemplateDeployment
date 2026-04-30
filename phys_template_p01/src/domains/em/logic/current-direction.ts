import type { Entity, Vec2 } from '@/core/types';

export type StraightCurrentDirection = 'up' | 'down';
export type LoopCurrentDirection = 'clockwise' | 'counterclockwise';
export type SolenoidCurrentDirection = 'leftward' | 'rightward';

export function getStraightWireCurrentDirection(entity: Entity): StraightCurrentDirection {
  const configured = entity.properties.currentDirectionMode as StraightCurrentDirection | undefined;
  if (configured === 'up' || configured === 'down') {
    return configured;
  }

  const vector = (entity.properties.wireDirection as Partial<Vec2> | undefined) ?? { y: 1 };
  return (vector.y ?? 1) >= 0 ? 'up' : 'down';
}

export function getStraightWireDirectionVector(entity: Entity): Vec2 {
  return getStraightWireCurrentDirection(entity) === 'up'
    ? { x: 0, y: 1 }
    : { x: 0, y: -1 };
}

export function getStraightWireCurrentDirectionLabel(entity: Entity): string {
  return getStraightWireCurrentDirection(entity) === 'up' ? '向上' : '向下';
}

export function getStraightWireFieldRotationLabel(entity: Entity): string {
  return getStraightWireCurrentDirection(entity) === 'up'
    ? '俯视逆时针'
    : '俯视顺时针';
}

export function getLoopCurrentDirection(entity: Entity): LoopCurrentDirection {
  const configured = entity.properties.currentDirectionMode as LoopCurrentDirection | undefined;
  if (configured === 'clockwise' || configured === 'counterclockwise') {
    return configured;
  }
  return ((entity.properties.current as number) ?? 1) >= 0 ? 'counterclockwise' : 'clockwise';
}

export function getLoopCurrentDirectionLabel(entity: Entity): string {
  return getLoopCurrentDirection(entity) === 'counterclockwise' ? '逆时针' : '顺时针';
}

export function getLoopCrossSectionDirections(entity: Entity): {
  left: 'into' | 'out';
  right: 'into' | 'out';
  centerField: 'left' | 'right';
} {
  const isCounterclockwise = getLoopCurrentDirection(entity) === 'counterclockwise';
  return {
    left: isCounterclockwise ? 'into' : 'out',
    right: isCounterclockwise ? 'out' : 'into',
    centerField: isCounterclockwise ? 'right' : 'left',
  };
}

export function getLoopCenterFieldDirectionLabel(entity: Entity): string {
  return getLoopCrossSectionDirections(entity).centerField === 'right' ? '轴线向右' : '轴线向左';
}

export function getSolenoidCurrentDirection(entity: Entity): SolenoidCurrentDirection {
  const configured = entity.properties.currentDirectionMode as SolenoidCurrentDirection | undefined;
  if (configured === 'leftward' || configured === 'rightward') {
    return configured;
  }
  return ((entity.properties.current as number) ?? 1) >= 0 ? 'rightward' : 'leftward';
}

export function getSolenoidCurrentDirectionLabel(entity: Entity): string {
  return getSolenoidCurrentDirection(entity) === 'rightward' ? '上侧向右' : '上侧向左';
}

export function getSolenoidFieldDirection(entity: Entity): 'left' | 'right' {
  return getSolenoidCurrentDirection(entity) === 'rightward' ? 'right' : 'left';
}

export function getSolenoidFieldDirectionLabel(entity: Entity): string {
  return getSolenoidFieldDirection(entity) === 'right' ? '向右' : '向左';
}
