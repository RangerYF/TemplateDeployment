import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 活塞颜色 */
const PISTON_FILL = '#795548';
const PISTON_STROKE = '#5D4037';
const PISTON_HIGHLIGHT = '#8D6E63';

/**
 * 活塞渲染器
 *
 * 绘制内容：
 * 1. 棕色矩形活塞
 * 2. 质量标注
 */
const pistonRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const props = entity.properties;

  const mass = (props.mass as number) ?? 1.0;
  const w = (props.width as number) ?? 0.4;
  const thickness = (props.thickness as number) ?? 0.08;
  const positionOffset = (props.positionOffset as number) ?? 0;
  const orientation = (props.orientation as string) ?? 'vertical';

  const c = ctx.ctx;
  c.save();

  const center = worldToScreen(
    { x: position.x, y: position.y + positionOffset },
    coordinateTransform,
  );

  let sw: number, sh: number;
  if (orientation === 'horizontal') {
    sw = worldLengthToScreen(thickness, coordinateTransform);
    sh = worldLengthToScreen(w, coordinateTransform);
  } else {
    sw = worldLengthToScreen(w, coordinateTransform);
    sh = worldLengthToScreen(thickness, coordinateTransform);
  }

  // 活塞主体
  c.fillStyle = PISTON_FILL;
  c.fillRect(center.x - sw / 2, center.y - sh / 2, sw, sh);

  // 高光条
  c.fillStyle = PISTON_HIGHLIGHT;
  if (orientation === 'horizontal') {
    c.fillRect(center.x - sw / 2, center.y - sh / 2, sw, 3);
  } else {
    c.fillRect(center.x - sw / 2, center.y - sh / 2, sw, 3);
  }

  // 描边
  c.strokeStyle = PISTON_STROKE;
  c.lineWidth = 1.5;
  c.strokeRect(center.x - sw / 2, center.y - sh / 2, sw, sh);

  // 质量标注
  if (mass > 0) {
    drawTextLabel(c, `m = ${mass} kg`, {
      x: center.x,
      y: center.y + sh / 2 + 14,
    }, {
      color: '#5D4037',
      fontSize: 11,
      align: 'center',
      backgroundColor: 'rgba(255,255,255,0.85)',
      padding: 2,
    });
  }

  c.restore();
};

export function registerPistonRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'piston',
    renderer: pistonRenderer,
    layer: 'object',
  });
}
