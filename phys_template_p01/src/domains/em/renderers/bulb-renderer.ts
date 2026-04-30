import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 灯泡颜色 */
const BULB_COLOR = '#F39C12';
/** 灯泡填充色 */
const BULB_FILL = 'rgba(243, 156, 18, 0.06)';
/** 点亮发光色 */
const BULB_GLOW = 'rgba(243, 156, 18, 0.25)';

/**
 * 灯泡渲染器
 *
 * 绘制内容：
 * 1. 圆形外框
 * 2. 内部交叉线（灯泡符号 ×）
 * 3. 通电时发光效果
 * 4. U/I/P 标注
 */
const bulbRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const radius = (entity.properties.radius as number) ?? 0.3;
  const voltage = (entity.properties.voltage as number) ?? 0;
  const current = (entity.properties.current as number) ?? 0;
  const power = (entity.properties.power as number) ?? 0;
  const faultType = (entity.properties.faultType as string) ?? 'none';

  const centerScreen = worldToScreen(position, coordinateTransform);
  const screenR = worldLengthToScreen(radius, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  const isLit = Math.abs(current) > 0.001;

  // 1. 发光效果（通电时）
  if (isLit && faultType === 'none') {
    const brightness = Math.min(1, power / 1.0); // 归一化亮度
    c.fillStyle = `rgba(243, 156, 18, ${0.1 + brightness * 0.2})`;
    c.beginPath();
    c.arc(centerScreen.x, centerScreen.y, screenR * 1.3, 0, Math.PI * 2);
    c.fill();
  }

  // 2. 圆形外框
  c.fillStyle = isLit ? BULB_GLOW : BULB_FILL;
  c.beginPath();
  c.arc(centerScreen.x, centerScreen.y, screenR, 0, Math.PI * 2);
  c.fill();

  c.strokeStyle = BULB_COLOR;
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(centerScreen.x, centerScreen.y, screenR, 0, Math.PI * 2);
  c.stroke();

  // 3. 内部交叉线（灯泡符号）
  const crossSize = screenR * 0.55;
  c.strokeStyle = BULB_COLOR;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(centerScreen.x - crossSize, centerScreen.y - crossSize);
  c.lineTo(centerScreen.x + crossSize, centerScreen.y + crossSize);
  c.moveTo(centerScreen.x + crossSize, centerScreen.y - crossSize);
  c.lineTo(centerScreen.x - crossSize, centerScreen.y + crossSize);
  c.stroke();

  // 4. 故障绘制
  if (faultType === 'open') {
    c.strokeStyle = '#E74C3C';
    c.lineWidth = 3;
    const m = screenR * 0.4;
    c.beginPath();
    c.moveTo(centerScreen.x - m, centerScreen.y - m);
    c.lineTo(centerScreen.x + m, centerScreen.y + m);
    c.moveTo(centerScreen.x + m, centerScreen.y - m);
    c.lineTo(centerScreen.x - m, centerScreen.y + m);
    c.stroke();
    drawTextLabel(
      c,
      '断路',
      { x: centerScreen.x, y: centerScreen.y - screenR - 12 },
      { color: '#E74C3C', fontSize: 11, align: 'center', backgroundColor: 'rgba(231,76,60,0.1)', padding: 2 },
    );
  } else if (faultType === 'short') {
    c.strokeStyle = '#E74C3C';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(centerScreen.x - screenR, centerScreen.y);
    c.lineTo(centerScreen.x + screenR, centerScreen.y);
    c.stroke();
    drawTextLabel(
      c,
      '短路',
      { x: centerScreen.x, y: centerScreen.y - screenR - 12 },
      { color: '#E74C3C', fontSize: 11, align: 'center', backgroundColor: 'rgba(231,76,60,0.1)', padding: 2 },
    );
  }

  // 5. 读数标注
  if (isLit && faultType === 'none') {
    drawTextLabel(
      c,
      `U=${voltage.toFixed(2)}V I=${current.toFixed(3)}A P=${power.toFixed(2)}W`,
      { x: centerScreen.x, y: centerScreen.y + screenR + 14 },
      { color: BULB_COLOR, fontSize: 11, align: 'center', backgroundColor: 'rgba(255,255,255,0.85)', padding: 3 },
    );
  } else if (entity.label != null) {
    drawTextLabel(
      c,
      entity.label as string,
      { x: centerScreen.x, y: centerScreen.y + screenR + 14 },
      { color: '#555', fontSize: 12, align: 'center' },
    );
  }

  c.restore();
};

export function registerBulbRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'bulb',
    renderer: bulbRenderer,
    layer: 'object',
  });
}
