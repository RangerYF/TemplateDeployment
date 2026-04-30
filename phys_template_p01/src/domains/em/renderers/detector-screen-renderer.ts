import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldLengthToScreen, worldToScreen } from '@/renderer/coordinate';
import { useSimulationStore } from '@/store/simulation-store';
import type { Vec2 } from '@/core/types';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import { DETECTOR_SCREEN_TYPE } from '../logic/detector-screen';

const SCREEN_BORDER = '#475569';
const SCREEN_FILL = 'rgba(71, 85, 105, 0.10)';
const SCREEN_LINE = '#94A3B8';
const HIT_MARKER = '#F97316';

const detectorScreenRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = Math.max((entity.properties.width as number) ?? 0.18, 0.02);
  const height = Math.max((entity.properties.height as number) ?? 3.6, 0.1);
  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);
  const centerX = screenTopLeft.x + screenW / 2;
  const c = ctx.ctx;

  c.save();
  c.fillStyle = SCREEN_FILL;
  c.strokeStyle = SCREEN_BORDER;
  c.lineWidth = 2;
  c.fillRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);
  c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  c.setLineDash([4, 4]);
  c.strokeStyle = SCREEN_LINE;
  c.beginPath();
  c.moveTo(centerX, screenTopLeft.y);
  c.lineTo(centerX, screenTopLeft.y + screenH);
  c.stroke();
  c.setLineDash([]);

  if (entity.label) {
    c.fillStyle = SCREEN_BORDER;
    c.font = '12px Inter, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'bottom';
    c.fillText(entity.label, centerX, screenTopLeft.y - 6);
  }

  const hitPoint = findLatestHitPoint(entity.id);
  if (hitPoint) {
    const hitScreenPoint = worldToScreen(hitPoint, coordinateTransform);
    c.fillStyle = HIT_MARKER;
    c.beginPath();
    c.arc(hitScreenPoint.x, hitScreenPoint.y, 4, 0, Math.PI * 2);
    c.fill();

    c.font = '11px Inter, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(`y=${hitPoint.y.toFixed(2)} m`, hitScreenPoint.x + 8, hitScreenPoint.y);
  }

  c.restore();
};

function findLatestHitPoint(screenId: string): Vec2 | null {
  const entities = useSimulationStore.getState().simulationState.scene.entities;
  for (const entity of entities.values()) {
    if (entity.type !== 'point-charge') continue;
    if (entity.properties.stoppedOnScreen !== true) continue;
    if (entity.properties.screenHitEntityId !== screenId) continue;
    const hitPoint = entity.properties.screenHitPoint as Vec2 | undefined;
    if (hitPoint) return hitPoint;
  }
  return null;
}

export function registerDetectorScreenRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: DETECTOR_SCREEN_TYPE,
    renderer: detectorScreenRenderer,
    layer: 'object',
  });
}
