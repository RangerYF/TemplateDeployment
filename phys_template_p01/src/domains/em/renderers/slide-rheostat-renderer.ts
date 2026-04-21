import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 变阻器外框颜色 */
const RHEOSTAT_COLOR = '#D35400';
/** 变阻器填充色 */
const RHEOSTAT_FILL = 'rgba(211, 84, 0, 0.08)';
/** 滑片箭头颜色 */
const SLIDER_COLOR = '#E74C3C';

/**
 * 滑动变阻器渲染器
 *
 * 绘制内容：
 * 1. 矩形方框（电阻体）
 * 2. 带箭头的斜线（滑片）
 * 3. R接入 标注
 */
const slideRheostatRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 1.0;
  const height = (entity.properties.height as number) ?? 0.5;
  const maxR = (entity.properties.maxResistance as number) ?? 50;
  const ratio = (entity.properties.sliderRatio as number) ?? 0.5;

  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 1. 矩形电阻体
  c.fillStyle = RHEOSTAT_FILL;
  c.fillRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);
  c.strokeStyle = RHEOSTAT_COLOR;
  c.lineWidth = 2;
  c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  // 2. 滑片位置（斜线 + 箭头）
  const sliderX = screenTopLeft.x + screenW * ratio;
  const arrowTop = screenTopLeft.y - 8;
  const arrowBottom = screenTopLeft.y + 4;

  c.strokeStyle = SLIDER_COLOR;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(sliderX, arrowBottom);
  c.lineTo(sliderX, arrowTop);
  c.stroke();

  // 箭头尖端
  c.fillStyle = SLIDER_COLOR;
  c.beginPath();
  c.moveTo(sliderX, arrowBottom);
  c.lineTo(sliderX - 4, arrowTop + 4);
  c.lineTo(sliderX + 4, arrowTop + 4);
  c.closePath();
  c.fill();

  // 3. 中心标注
  const centerX = screenTopLeft.x + screenW / 2;
  const centerY = screenTopLeft.y + screenH / 2;
  const R_eff = maxR * ratio;

  c.fillStyle = RHEOSTAT_COLOR;
  c.font = 'bold 12px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`R=${R_eff.toFixed(1)}Ω`, centerX, centerY);

  // 4. 底部标注
  drawTextLabel(
    c,
    `最大${maxR}Ω  滑片${(ratio * 100).toFixed(0)}%`,
    { x: centerX, y: screenTopLeft.y + screenH + 16 },
    { color: '#777', fontSize: 10, align: 'center' },
  );

  c.restore();
};

export function registerSlideRheostatRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'slide-rheostat',
    renderer: slideRheostatRenderer,
    layer: 'object',
  });
}
