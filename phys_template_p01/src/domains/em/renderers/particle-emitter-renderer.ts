import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldLengthToScreen, worldToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

const EMITTER_FILL = '#FDBA74';
const EMITTER_STROKE = '#EA580C';
const EMITTER_TRAIL = 'rgba(234, 88, 12, 0.24)';

const particleEmitterRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const center = worldToScreen(entity.transform.position, coordinateTransform);
  const radius = worldLengthToScreen((entity.properties.radius as number) ?? 0.28, coordinateTransform);
  const launchAngleDeg = Number(entity.properties.launchAngleDeg ?? 0);
  const radians = (launchAngleDeg * Math.PI) / 180;
  const direction = { x: Math.cos(radians), y: -Math.sin(radians) };
  const normal = { x: -direction.y, y: direction.x };
  const nozzleLength = Math.max(radius * 1.8, 16);
  const mouthHalfWidth = Math.max(radius * 0.62, 7);
  const nozzleStart = {
    x: center.x - (direction.x * radius * 0.5),
    y: center.y - (direction.y * radius * 0.5),
  };
  const nozzleTip = {
    x: center.x + (direction.x * nozzleLength),
    y: center.y + (direction.y * nozzleLength),
  };
  const nozzleLeft = {
    x: nozzleStart.x + (normal.x * mouthHalfWidth),
    y: nozzleStart.y + (normal.y * mouthHalfWidth),
  };
  const nozzleRight = {
    x: nozzleStart.x - (normal.x * mouthHalfWidth),
    y: nozzleStart.y - (normal.y * mouthHalfWidth),
  };
  const c = ctx.ctx;

  c.save();

  c.beginPath();
  c.moveTo(nozzleLeft.x, nozzleLeft.y);
  c.lineTo(nozzleTip.x, nozzleTip.y);
  c.lineTo(nozzleRight.x, nozzleRight.y);
  c.closePath();
  c.fillStyle = EMITTER_TRAIL;
  c.fill();

  c.beginPath();
  c.arc(center.x, center.y, Math.max(radius * 0.72, 8), 0, Math.PI * 2);
  c.fillStyle = EMITTER_FILL;
  c.fill();
  c.strokeStyle = EMITTER_STROKE;
  c.lineWidth = 2;
  c.stroke();

  c.beginPath();
  c.moveTo(nozzleLeft.x, nozzleLeft.y);
  c.lineTo(nozzleTip.x, nozzleTip.y);
  c.lineTo(nozzleRight.x, nozzleRight.y);
  c.closePath();
  c.fillStyle = EMITTER_FILL;
  c.fill();
  c.stroke();

  const particleCount = Math.round(Number(entity.properties.particleCount ?? 0));
  if (entity.label) {
    c.fillStyle = EMITTER_STROKE;
    c.font = '12px Inter, sans-serif';
    c.textAlign = 'center';
    c.fillText(entity.label, center.x, center.y + Math.max(radius, 10) + 18);
  }
  if (particleCount > 0) {
    c.fillStyle = EMITTER_STROKE;
    c.font = '11px Inter, sans-serif';
    c.textAlign = 'center';
    c.fillText(`${particleCount} 粒子`, center.x, center.y - Math.max(radius, 10) - 12);
  }

  c.restore();
};

export function registerParticleEmitterRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'particle-emitter',
    renderer: particleEmitterRenderer,
    layer: 'object',
  });
}
