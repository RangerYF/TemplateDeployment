import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

const FILL_COLOR = '#EBF8FF';
const STROKE_COLOR = '#2B6CB0';
const CORNER_RADIUS = 4;

const blockRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const rotation = entity.transform.rotation ?? 0;
  const width = (entity.properties.width as number) ?? 0.5;
  const height = (entity.properties.height as number) ?? 0.5;

  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  if (Math.abs(rotation) > 1e-6) {
    // 有旋转：以物块物理中心为旋转原点
    // 物理中心 = position + R(rotation) * (0, height/2)
    const centerPhys = {
      x: position.x + (-Math.sin(rotation)) * (height / 2),
      y: position.y + Math.cos(rotation) * (height / 2),
    };
    const screenCenter = worldToScreen(centerPhys, coordinateTransform);

    c.translate(screenCenter.x, screenCenter.y);
    // 物理旋转逆时针为正，Canvas Y 翻转 → 屏幕旋转取负
    c.rotate(-rotation);

    // 阴影
    c.shadowColor = 'rgba(0, 0, 0, 0.1)';
    c.shadowBlur = 4;
    c.shadowOffsetY = 2;

    // 以中心为原点画矩形
    c.beginPath();
    c.roundRect(-screenW / 2, -screenH / 2, screenW, screenH, CORNER_RADIUS);
    c.fillStyle = FILL_COLOR;
    c.fill();

    c.shadowColor = 'transparent';
    c.strokeStyle = STROKE_COLOR;
    c.lineWidth = 2;
    c.stroke();

    // label
    if (entity.label) {
      c.fillStyle = STROKE_COLOR;
      c.font = '13px Inter, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(entity.label, 0, 0);
    }
  } else {
    // 无旋转：原有逻辑（保持不变，水平面场景零开销）
    const topLeft = worldToScreen(
      { x: position.x - width / 2, y: position.y + height },
      coordinateTransform,
    );

    // 阴影
    c.shadowColor = 'rgba(0, 0, 0, 0.1)';
    c.shadowBlur = 4;
    c.shadowOffsetY = 2;

    c.beginPath();
    c.roundRect(topLeft.x, topLeft.y, screenW, screenH, CORNER_RADIUS);
    c.fillStyle = FILL_COLOR;
    c.fill();

    c.shadowColor = 'transparent';
    c.strokeStyle = STROKE_COLOR;
    c.lineWidth = 2;
    c.stroke();

    if (entity.label) {
      c.fillStyle = STROKE_COLOR;
      c.font = '13px Inter, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(entity.label, topLeft.x + screenW / 2, topLeft.y + screenH / 2);
    }
  }

  c.restore();
};

export function registerBlockRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'block',
    renderer: blockRenderer,
    layer: 'object',
  });
}
