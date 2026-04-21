import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

const LINE_COLOR = '#4A5568';
const HATCH_COLOR = '#A0AEC0';
const HATCH_SPACING = 8; // px
const HATCH_HEIGHT = 12; // px

const surfaceRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const length = (entity.properties.length as number) ?? 6;

  const from = worldToScreen(position, coordinateTransform);
  const to = worldToScreen(
    { x: position.x + length, y: position.y },
    coordinateTransform,
  );

  const c = ctx.ctx;
  c.save();

  // 主线
  c.beginPath();
  c.moveTo(from.x, from.y);
  c.lineTo(to.x, to.y);
  c.strokeStyle = LINE_COLOR;
  c.lineWidth = 2;
  c.stroke();

  // 底部斜线填充（教材风格地面画法）
  c.strokeStyle = HATCH_COLOR;
  c.lineWidth = 1;
  const lineLength = to.x - from.x;
  const count = Math.ceil(lineLength / HATCH_SPACING);

  for (let i = 0; i <= count; i++) {
    const x = from.x + i * HATCH_SPACING;
    if (x > to.x) break;
    c.beginPath();
    c.moveTo(x, from.y);
    c.lineTo(x - HATCH_HEIGHT * 0.7, from.y + HATCH_HEIGHT);
    c.stroke();
  }

  c.restore();
};

export function registerSurfaceRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'surface',
    renderer: surfaceRenderer,
    layer: 'surface',
  });
}
