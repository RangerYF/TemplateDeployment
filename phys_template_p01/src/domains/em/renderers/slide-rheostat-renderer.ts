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

  // 2. 滑片位置（竖线 + 大三角箭头，可拖拽）
  const sliderX = screenTopLeft.x + screenW * ratio;
  const arrowTip = screenTopLeft.y + screenH + 2;   // 箭头尖端指向电阻体底边
  const arrowBase = screenTopLeft.y + screenH + 18;  // 箭头底部
  const arrowHalf = 8;                                // 箭头半宽

  // 竖线：从箭头底延伸到电阻体上方
  c.strokeStyle = SLIDER_COLOR;
  c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(sliderX, screenTopLeft.y - 6);
  c.lineTo(sliderX, arrowBase);
  c.stroke();

  // 大三角箭头（朝上指向电阻体）
  c.fillStyle = SLIDER_COLOR;
  c.beginPath();
  c.moveTo(sliderX, arrowTip);
  c.lineTo(sliderX - arrowHalf, arrowBase);
  c.lineTo(sliderX + arrowHalf, arrowBase);
  c.closePath();
  c.fill();

  // 滑片手柄圆点（视觉提示可拖拽）
  c.beginPath();
  c.arc(sliderX, arrowBase + 6, 5, 0, Math.PI * 2);
  c.fillStyle = SLIDER_COLOR;
  c.fill();
  c.strokeStyle = '#FFF';
  c.lineWidth = 1.5;
  c.stroke();

  // 3. 中心标注
  const centerX = screenTopLeft.x + screenW / 2;
  const centerY = screenTopLeft.y + screenH / 2;
  const R_eff = maxR * ratio;

  c.fillStyle = RHEOSTAT_COLOR;
  c.font = 'bold 12px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(`R=${R_eff.toFixed(1)}Ω`, centerX, centerY);

  // 4. 故障叠加绘制
  const faultType = (entity.properties.faultType as string) ?? 'none';
  if (faultType === 'open') {
    c.strokeStyle = '#E74C3C';
    c.lineWidth = 3;
    const margin = Math.min(screenW, screenH) * 0.25;
    c.beginPath();
    c.moveTo(centerX - margin, centerY - margin);
    c.lineTo(centerX + margin, centerY + margin);
    c.moveTo(centerX + margin, centerY - margin);
    c.lineTo(centerX - margin, centerY + margin);
    c.stroke();
    drawTextLabel(
      c,
      '断路',
      { x: centerX, y: screenTopLeft.y - 14 },
      { color: '#E74C3C', fontSize: 11, align: 'center', backgroundColor: 'rgba(231,76,60,0.1)', padding: 2 },
    );
  } else if (faultType === 'short') {
    c.strokeStyle = '#E74C3C';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(screenTopLeft.x, centerY);
    c.lineTo(screenTopLeft.x + screenW, centerY);
    c.stroke();
    drawTextLabel(
      c,
      '短路',
      { x: centerX, y: screenTopLeft.y - 14 },
      { color: '#E74C3C', fontSize: 11, align: 'center', backgroundColor: 'rgba(231,76,60,0.1)', padding: 2 },
    );
  }

  // 5. 连接模式标记（变阻器模式：高亮 A-W 段）
  const connMode = (entity.properties.connectionMode as string) ?? 'variable';
  if (connMode === 'variable') {
    // 高亮左端到滑片位置（A-W 有效段）
    c.fillStyle = 'rgba(211, 84, 0, 0.15)';
    c.fillRect(screenTopLeft.x, screenTopLeft.y, screenW * ratio, screenH);
    // 端口标注：A 在左，W 在滑片位置
    c.fillStyle = '#999';
    c.font = '9px Inter, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'top';
    c.fillText('A', screenTopLeft.x + 6, screenTopLeft.y - 12);
    c.fillText('W', sliderX, screenTopLeft.y + screenH + 28);
  }

  // 6. 底部标注
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
