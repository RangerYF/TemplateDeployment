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
  const viewportPrimary = useSimulationStore.getState().viewportState.primary;
  if (viewportPrimary === 'field') {
    const state = useSimulationStore.getState().simulationState;
    const isElectrostaticFieldScene = isStaticElectrostaticScene(
      state.scene.entities.values(),
      state.timeline.duration,
    );
    if (isElectrostaticFieldScene) {
      return;
    }
  }

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

  const highlightX = screenPos.x - (screenRadius * 0.34);
  const highlightY = screenPos.y - (screenRadius * 0.36);
  const shadowOffset = Math.max(4, screenRadius * 0.16);
  const sphereGradient = c.createRadialGradient(
    highlightX,
    highlightY,
    Math.max(2, screenRadius * 0.18),
    screenPos.x,
    screenPos.y,
    Math.max(screenRadius, 1),
  );
  if (charge >= 0) {
    sphereGradient.addColorStop(0, 'rgba(255, 248, 244, 0.98)');
    sphereGradient.addColorStop(0.28, '#FCA5A5');
    sphereGradient.addColorStop(0.7, '#EF4444');
    sphereGradient.addColorStop(1, '#991B1B');
  } else {
    sphereGradient.addColorStop(0, 'rgba(245, 250, 255, 0.98)');
    sphereGradient.addColorStop(0.28, '#93C5FD');
    sphereGradient.addColorStop(0.7, '#3B82F6');
    sphereGradient.addColorStop(1, '#1E3A8A');
  }

  c.fillStyle = 'rgba(15, 23, 42, 0.12)';
  c.beginPath();
  c.ellipse(
    screenPos.x,
    screenPos.y + shadowOffset + (screenRadius * 0.22),
    Math.max(6, screenRadius * 0.9),
    Math.max(3, screenRadius * 0.28),
    0,
    0,
    Math.PI * 2,
  );
  c.fill();

  c.beginPath();
  c.arc(screenPos.x, screenPos.y, screenRadius, 0, Math.PI * 2);
  c.fillStyle = sphereGradient;
  c.shadowColor = charge >= 0 ? 'rgba(239, 68, 68, 0.28)' : 'rgba(59, 130, 246, 0.28)';
  c.shadowBlur = Math.max(10, screenRadius * 0.32);
  c.shadowOffsetY = Math.max(2, screenRadius * 0.06);
  c.fill();
  c.shadowColor = 'transparent';
  c.strokeStyle = charge >= 0 ? 'rgba(127, 29, 29, 0.7)' : 'rgba(30, 58, 138, 0.7)';
  c.lineWidth = Math.max(1.5, screenRadius * 0.08);
  c.stroke();

  c.beginPath();
  c.arc(highlightX, highlightY, Math.max(2.4, screenRadius * 0.22), 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.74)';
  c.fill();

  // 正负号
  c.fillStyle = '#FFFFFF';
  c.font = `700 ${Math.max(14, screenRadius * 0.96)}px Inter, sans-serif`;
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
