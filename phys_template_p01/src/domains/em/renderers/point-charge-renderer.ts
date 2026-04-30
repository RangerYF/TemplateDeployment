import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { useSimulationStore } from '@/store/simulation-store';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import { isInactiveDynamicPointCharge } from '../logic/point-charge-role';
import { isStaticElectrostaticScene } from '../logic/static-electrostatic-scene';

const POSITIVE_COLOR = '#E53E3E'; // 红色
const NEGATIVE_COLOR = '#3182CE'; // 蓝色

const pointChargeRenderer: EntityRenderer = (entity, _result, ctx) => {
  if (isInactiveDynamicPointCharge(entity)) return;

  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const radius = (entity.properties.radius as number) ?? 0.15;
  const charge = (entity.properties.charge as number) ?? 1e-6;
  const state = useSimulationStore.getState().simulationState;
  const hideSceneAnnotations = isStaticElectrostaticScene(state.scene.entities.values(), state.timeline.duration);

  const screenPos = worldToScreen(position, coordinateTransform);
  const screenRadius = worldLengthToScreen(radius, coordinateTransform);
  const color = charge >= 0 ? POSITIVE_COLOR : NEGATIVE_COLOR;

  const c = ctx.ctx;
  c.save();

  // 圆形填充
  c.beginPath();
  c.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
  c.fillStyle = color + '20'; // 淡色填充
  c.fill();
  c.strokeStyle = color;
  c.lineWidth = 2;
  c.stroke();

  // 正负号
  c.fillStyle = color;
  c.font = `bold ${Math.max(14, screenRadius)}px Inter, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(charge >= 0 ? '+' : '−', screenPos.x, screenPos.y);

  // label
  if (entity.label && !hideSceneAnnotations) {
    c.fillStyle = color;
    c.font = '12px Inter, sans-serif';
    c.textAlign = 'center';
    c.fillText(entity.label, screenPos.x, screenPos.y + screenRadius + 14);
  }

  c.restore();
};

export function registerPointChargeRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'point-charge',
    renderer: pointChargeRenderer,
    layer: 'object',
  });
}
