import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 开关颜色 */
const SWITCH_COLOR = '#2C3E50';
/** 闭合时接点颜色 */
const CONTACT_COLOR = '#27AE60';

/**
 * 开关渲染器
 *
 * 绘制内容：
 * - 闭合：水平连线 + 两端接点圆
 * - 断开：左端接点圆 + 翘起线段
 */
const switchRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 0.6;
  const height = (entity.properties.height as number) ?? 0.3;
  const closed = (entity.properties.closed as boolean) ?? true;

  const centerScreen = worldToScreen(
    { x: position.x + width / 2, y: position.y + height / 2 },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  const leftX = centerScreen.x - screenW / 2;
  const rightX = centerScreen.x + screenW / 2;
  const y = centerScreen.y;
  const dotR = 4;

  // 左端接点
  c.fillStyle = SWITCH_COLOR;
  c.beginPath();
  c.arc(leftX, y, dotR, 0, Math.PI * 2);
  c.fill();

  // 右端接点
  c.beginPath();
  c.arc(rightX, y, dotR, 0, Math.PI * 2);
  c.fill();

  if (closed) {
    // 闭合：水平连线
    c.strokeStyle = CONTACT_COLOR;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(leftX, y);
    c.lineTo(rightX, y);
    c.stroke();
  } else {
    // 断开：从左端翘起到右上方
    c.strokeStyle = SWITCH_COLOR;
    c.lineWidth = 2.5;
    c.beginPath();
    c.moveTo(leftX, y);
    c.lineTo(rightX - 4, y - screenW * 0.4);
    c.stroke();
  }

  // 标签
  const labelText = closed ? '闭合' : '断开';
  c.fillStyle = closed ? CONTACT_COLOR : '#999';
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText(labelText, centerScreen.x, y + 18);

  c.restore();
};

export function registerSwitchRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'switch',
    renderer: switchRenderer,
    layer: 'object',
  });
}
