import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 灵敏电流计正常颜色 */
const GALV_COLOR = '#16A085';
/** 超量程颜色 */
const OVER_RANGE_COLOR = '#E74C3C';
/** 表盘填充色 */
const DIAL_FILL = 'rgba(22, 160, 133, 0.06)';
const DIAL_FILL_OVER = 'rgba(231, 76, 60, 0.1)';
/** 指针颜色 */
const NEEDLE_COLOR = '#2C3E50';

/**
 * 灵敏电流计渲染器
 *
 * 绘制内容：
 * 1. 圆形表盘
 * 2. 中心"G"字样
 * 3. 指针（零点在中间，可左右偏转）
 * 4. 读数标注（μA，可正可负）
 */
const galvanometerRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const radius = (entity.properties.radius as number) ?? 0.3;
  const reading = (entity.properties.reading as number) ?? 0; // μA
  const overRange = (entity.properties.overRange as boolean) ?? false;
  const range = (entity.properties.range as number) ?? 500; // μA

  const centerScreen = worldToScreen(position, coordinateTransform);
  const screenR = worldLengthToScreen(radius, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  const color = overRange ? OVER_RANGE_COLOR : GALV_COLOR;

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

  // 2. 零点刻度线（表盘顶部中心）
  c.strokeStyle = '#999';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(centerScreen.x, centerScreen.y - screenR + 2);
  c.lineTo(centerScreen.x, centerScreen.y - screenR + 8);
  c.stroke();

  // 左右刻度线
  const tickAngle = Math.PI * 0.35;
  for (const sign of [-1, 1]) {
    const angle = -Math.PI / 2 + sign * tickAngle;
    const x1 = centerScreen.x + (screenR - 2) * Math.cos(angle);
    const y1 = centerScreen.y + (screenR - 2) * Math.sin(angle);
    const x2 = centerScreen.x + (screenR - 8) * Math.cos(angle);
    const y2 = centerScreen.y + (screenR - 8) * Math.sin(angle);
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
  }

  // 3. 指针（偏转角度由 reading/range 决定，最大±60°）
  // reading 和 range 可能同为 μA 或同为 A，只要单位一致偏转就正确
  const deflection = Math.max(-1, Math.min(1, range !== 0 ? reading / range : 0));
  const needleAngle = -Math.PI / 2 + deflection * (Math.PI / 3); // ±60°
  const needleLen = screenR * 0.75;

  c.strokeStyle = NEEDLE_COLOR;
  c.lineWidth = 2;
  c.beginPath();
  c.moveTo(centerScreen.x, centerScreen.y);
  c.lineTo(
    centerScreen.x + needleLen * Math.cos(needleAngle),
    centerScreen.y + needleLen * Math.sin(needleAngle),
  );
  c.stroke();

  // 指针底部圆点
  c.fillStyle = NEEDLE_COLOR;
  c.beginPath();
  c.arc(centerScreen.x, centerScreen.y, 3, 0, Math.PI * 2);
  c.fill();

  // 4. "G" 字样
  c.fillStyle = color;
  c.font = `bold ${Math.max(12, screenR * 0.5)}px Inter, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('G', centerScreen.x, centerScreen.y + screenR * 0.35);

  // 5. 读数标注（自动选择单位：如果 range < 1 说明单位是 A，转 μA 显示）
  const displayReading = range < 1 ? reading * 1e6 : reading;
  const displayUnit = range < 1 ? 'μA' : 'μA';
  const readingText = `${displayReading.toFixed(1)} ${displayUnit}`;
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

  // 6. 超量程警告
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

export function registerGalvanometerRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'galvanometer',
    renderer: galvanometerRenderer,
    layer: 'object',
  });
}
