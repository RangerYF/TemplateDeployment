import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 电流表正常颜色 */
const AMMETER_COLOR = '#2980B9';
/** 超量程警告颜色 */
const OVER_RANGE_COLOR = '#E74C3C';
/** 表盘填充色 */
const DIAL_FILL = 'rgba(41, 128, 185, 0.06)';
const DIAL_FILL_OVER = 'rgba(231, 76, 60, 0.1)';

/**
 * 电流表渲染器
 *
 * 绘制内容：
 * 1. 圆形表盘
 * 2. 中心"A"字样
 * 3. 读数标注
 * 4. 超量程时变红
 */
const ammeterRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const radius = (entity.properties.radius as number) ?? 0.3;
  const reading = (entity.properties.reading as number) ?? 0;
  const overRange = (entity.properties.overRange as boolean) ?? false;
  const range = (entity.properties.range as number) ?? 0.6;

  const centerScreen = worldToScreen(position, coordinateTransform);
  const screenR = worldLengthToScreen(radius, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  const color = overRange ? OVER_RANGE_COLOR : AMMETER_COLOR;

  // 1. 圆形表盘
  c.fillStyle = overRange ? DIAL_FILL_OVER : DIAL_FILL;
  c.beginPath();
  c.arc(centerScreen.x, centerScreen.y, screenR, 0, Math.PI * 2);
  c.fill();

  c.strokeStyle = color;
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(centerScreen.x, centerScreen.y, screenR, 0, Math.PI * 2);
  c.stroke();

  // 2. 中心"A"
  c.fillStyle = color;
  c.font = `bold ${Math.max(14, screenR * 0.7)}px Inter, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('A', centerScreen.x, centerScreen.y);

  // 3. 读数标注
  const readingText = `${reading.toFixed(3)} A`;
  const rangeText = `量程 ${range}A`;
  drawTextLabel(
    c,
    readingText,
    { x: centerScreen.x, y: centerScreen.y + screenR + 14 },
    {
      color,
      fontSize: 12,
      align: 'center',
      backgroundColor: 'rgba(255,255,255,0.85)',
      padding: 3,
    },
  );
  drawTextLabel(
    c,
    rangeText,
    { x: centerScreen.x, y: centerScreen.y + screenR + 30 },
    { color: '#999', fontSize: 10, align: 'center' },
  );

  // 4. 超量程警告
  if (overRange) {
    drawTextLabel(
      c,
      '⚠ 超量程',
      { x: centerScreen.x, y: centerScreen.y - screenR - 10 },
      {
        color: OVER_RANGE_COLOR,
        fontSize: 11,
        align: 'center',
        backgroundColor: 'rgba(231,76,60,0.1)',
        padding: 3,
      },
    );
  }

  c.restore();
};

export function registerAmmeterRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'ammeter',
    renderer: ammeterRenderer,
    layer: 'object',
  });
}
