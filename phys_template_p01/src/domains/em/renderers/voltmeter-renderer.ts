import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 电压表正常颜色 */
const VOLTMETER_COLOR = '#8E44AD';
/** 超量程警告颜色 */
const OVER_RANGE_COLOR = '#E74C3C';
/** 表盘填充色 */
const DIAL_FILL = 'rgba(142, 68, 173, 0.06)';
const DIAL_FILL_OVER = 'rgba(231, 76, 60, 0.1)';

/**
 * 电压表渲染器
 *
 * 绘制内容：
 * 1. 圆形表盘
 * 2. 中心"V"字样
 * 3. 读数标注
 * 4. 超量程时变红
 */
const voltmeterRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const radius = (entity.properties.radius as number) ?? 0.3;
  const reading = (entity.properties.reading as number) ?? 0;
  const overRange = (entity.properties.overRange as boolean) ?? false;
  const range = (entity.properties.range as number) ?? 3;

  const centerScreen = worldToScreen(position, coordinateTransform);
  const screenR = worldLengthToScreen(radius, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  const color = overRange ? OVER_RANGE_COLOR : VOLTMETER_COLOR;

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

  // 2. 中心"V"
  c.fillStyle = color;
  c.font = `bold ${Math.max(14, screenR * 0.7)}px Inter, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('V', centerScreen.x, centerScreen.y);

  // 3. 读数标注
  const readingText = `${reading.toFixed(3)} V`;
  const rangeText = `量程 ${range}V`;
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

export function registerVoltmeterRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'voltmeter',
    renderer: voltmeterRenderer,
    layer: 'object',
  });
}
