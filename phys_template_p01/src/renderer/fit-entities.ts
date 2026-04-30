import type { Entity, Vec2 } from '@/core/types';

const CENTER_BASED_ENTITY_TYPES = new Set([
  'ammeter',
  'voltmeter',
  'galvanometer',
  'bulb',
  'motor',
]);

interface EntityBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function computeCenteredOrigin(params: {
  entities: Iterable<Entity>;
  scale: number;
  canvasWidth: number;
  canvasHeight: number;
}): Vec2 {
  const bounds = computeEntityBounds(params.entities);
  if (!bounds) {
    return {
      x: params.canvasWidth / 2,
      y: params.canvasHeight / 2,
    };
  }

  const worldCenterX = (bounds.minX + bounds.maxX) / 2;
  const worldCenterY = (bounds.minY + bounds.maxY) / 2;

  return {
    x: params.canvasWidth / 2 - worldCenterX * params.scale,
    y: params.canvasHeight / 2 + worldCenterY * params.scale,
  };
}

function computeEntityBounds(entities: Iterable<Entity>): EntityBounds | null {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  let hasEntities = false;

  for (const entity of entities) {
    hasEntities = true;
    const pos = entity.transform.position;
    const radius = entity.properties.radius as number | undefined;
    const width = (entity.properties.width as number | undefined) ?? radius ?? 0.5;
    const height = (entity.properties.height as number | undefined) ?? width;

    const isCenterBased = CENTER_BASED_ENTITY_TYPES.has(entity.type) || radius !== undefined;
    const cx = isCenterBased ? pos.x : pos.x + width / 2;
    const cy = isCenterBased ? pos.y : pos.y + height / 2;
    const halfW = radius ?? width / 2;
    const halfH = radius ?? height / 2;

    minX = Math.min(minX, cx - halfW);
    maxX = Math.max(maxX, cx + halfW);
    minY = Math.min(minY, cy - halfH);
    maxY = Math.max(maxY, cy + halfH);
  }

  return hasEntities && Number.isFinite(minX)
    ? { minX, maxX, minY, maxY }
    : null;
}
