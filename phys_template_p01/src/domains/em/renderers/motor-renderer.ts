import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 电动机颜色 */
const MOTOR_COLOR = '#27AE60';
/** 电动机填充色 */
const MOTOR_FILL = 'rgba(39, 174, 96, 0.06)';

/**
 * 电动机渲染器
 *
 * 绘制内容：
 * 1. 圆形外框
 * 2. 中心"M"字样
 * 3. 功率分解标注（P_电、P_热、P_机）
 */
const motorRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const radius = (entity.properties.radius as number) ?? 0.35;
  const current = (entity.properties.current as number) ?? 0;
  const electricPower = (entity.properties.electricPower as number) ?? 0;
  const heatPower = (entity.properties.heatPower as number) ?? 0;
  const mechanicalPower = (entity.properties.mechanicalPower as number) ?? 0;
  const backEmf = (entity.properties.backEmf as number) ?? 2;
  const coilR = (entity.properties.coilResistance as number) ?? 1;

  const centerScreen = worldToScreen(position, coordinateTransform);
  const screenR = worldLengthToScreen(radius, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 1. 圆形外框
  c.fillStyle = MOTOR_FILL;
  c.beginPath();
  c.arc(centerScreen.x, centerScreen.y, screenR, 0, Math.PI * 2);
  c.fill();

  c.strokeStyle = MOTOR_COLOR;
  c.lineWidth = 2.5;
  c.beginPath();
  c.arc(centerScreen.x, centerScreen.y, screenR, 0, Math.PI * 2);
  c.stroke();

  // 2. 中心"M"
  c.fillStyle = MOTOR_COLOR;
  c.font = `bold ${Math.max(14, screenR * 0.7)}px Inter, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText('M', centerScreen.x, centerScreen.y);

  // 3. 参数标注
  const isRunning = Math.abs(current) > 0.001;
  if (isRunning) {
    drawTextLabel(
      c,
      `P电=${electricPower.toFixed(2)}W`,
      { x: centerScreen.x, y: centerScreen.y + screenR + 14 },
      { color: MOTOR_COLOR, fontSize: 11, align: 'center', backgroundColor: 'rgba(255,255,255,0.85)', padding: 2 },
    );
    drawTextLabel(
      c,
      `P热=${heatPower.toFixed(2)}W  P机=${mechanicalPower.toFixed(2)}W`,
      { x: centerScreen.x, y: centerScreen.y + screenR + 30 },
      { color: '#555', fontSize: 10, align: 'center' },
    );
  } else {
    // 静态参数
    drawTextLabel(
      c,
      `ε反=${backEmf}V  R=${coilR}Ω`,
      { x: centerScreen.x, y: centerScreen.y + screenR + 14 },
      { color: '#777', fontSize: 11, align: 'center' },
    );
  }

  c.restore();
};

export function registerMotorRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'motor',
    renderer: motorRenderer,
    layer: 'object',
  });
}
