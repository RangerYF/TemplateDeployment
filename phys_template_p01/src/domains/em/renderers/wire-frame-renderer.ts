import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 线框边框颜色 */
const WIRE_COLOR = '#D97706';
/** 有电流时的高亮色 */
const WIRE_ACTIVE_COLOR = '#F59E0B';
/** 电流流动箭头颜色 */
const CURRENT_ARROW_COLOR = '#F59E0B';

/**
 * 矩形线框渲染器
 *
 * 绘制内容：
 * 1. 矩形线框（实线边框）
 * 2. 当有电流时，在线框四边上绘制循环流动箭头
 */
const wireFrameRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 1;
  const height = (entity.properties.height as number) ?? 0.8;
  const current = (entity.properties.current as number) ?? 0;

  // 物理坐标：position 为左下角
  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  const hasCurrent = Math.abs(current) > 1e-6;
  const wireColor = hasCurrent ? WIRE_ACTIVE_COLOR : WIRE_COLOR;

  // 1. 矩形边框
  c.strokeStyle = wireColor;
  c.lineWidth = hasCurrent ? 3 : 2;
  c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  // 2. 电流流动箭头（有电流时）
  if (hasCurrent) {
    const clockwise = current > 0;
    drawCurrentArrows(c, screenTopLeft.x, screenTopLeft.y, screenW, screenH, clockwise);
  }

  // 3. 标签
  if (entity.label) {
    c.fillStyle = wireColor;
    c.font = '12px Inter, sans-serif';
    c.textAlign = 'center';
    c.fillText(
      entity.label,
      screenTopLeft.x + screenW / 2,
      screenTopLeft.y + screenH + 16,
    );
  }

  c.restore();
};

/**
 * 在矩形四边上绘制电流方向箭头
 * clockwise = true 表示屏幕坐标系下顺时针
 */
function drawCurrentArrows(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  clockwise: boolean,
): void {
  c.fillStyle = CURRENT_ARROW_COLOR;
  c.strokeStyle = CURRENT_ARROW_COLOR;
  c.lineWidth = 1.5;

  const arrowSize = 6;
  // 四边中点
  const midPoints = [
    { x: x + w / 2, y: y }, // 上边中点
    { x: x + w, y: y + h / 2 }, // 右边中点
    { x: x + w / 2, y: y + h }, // 下边中点
    { x: x, y: y + h / 2 }, // 左边中点
  ];

  // 顺时针方向角度（屏幕坐标系）：上→右(0)、右→下(π/2)、下→左(π)、左→上(-π/2)
  const cwAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  const ccwAngles = [Math.PI, -Math.PI / 2, 0, Math.PI / 2];
  const angles = clockwise ? cwAngles : ccwAngles;

  for (let i = 0; i < 4; i++) {
    const pt = midPoints[i]!;
    const angle = angles[i]!;
    drawSmallArrow(c, pt.x, pt.y, angle, arrowSize);
  }
}

/** 绘制小三角箭头 */
function drawSmallArrow(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  size: number,
): void {
  c.beginPath();
  c.moveTo(cx + size * Math.cos(angle), cy + size * Math.sin(angle));
  c.lineTo(
    cx + size * Math.cos(angle + (2.5 * Math.PI) / 3),
    cy + size * Math.sin(angle + (2.5 * Math.PI) / 3),
  );
  c.lineTo(
    cx + size * Math.cos(angle - (2.5 * Math.PI) / 3),
    cy + size * Math.sin(angle - (2.5 * Math.PI) / 3),
  );
  c.closePath();
  c.fill();
}

export function registerWireFrameRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'wire-frame',
    renderer: wireFrameRenderer,
    layer: 'object',
  });
}
