import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { EntityRenderer } from '@/core/registries/renderer-registry';

/** 速率→颜色映射（蓝→红） */
function speedToColor(speed: number, maxSpeed: number): string {
  const ratio = Math.min(speed / maxSpeed, 1);
  const r = Math.floor(66 + ratio * 189); // 66 → 255
  const g = Math.floor(165 - ratio * 165); // 165 → 0
  const b = Math.floor(245 - ratio * 195); // 245 → 50
  return `rgb(${r},${g},${b})`;
}

/** 直方图颜色 */
const HIST_FILL = 'rgba(33, 150, 243, 0.4)';
const HIST_STROKE = '#1976D2';
const HIST_THEORY = '#F44336';

/**
 * 气体分子渲染器
 *
 * 绘制内容：
 * 1. 彩色小圆点（蓝→红 速度映射）
 * 2. 右侧速率分布直方图
 * 3. 温度/分子数标注
 */
const gasMoleculesRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const props = entity.properties;

  const count = (props.count as number) ?? 200;
  const temperature = (props.temperature as number) ?? 300;
  const positions = (props.positions as number[]) ?? [];
  const velocities = (props.velocities as number[]) ?? [];
  const speedHistogram = (props.speedHistogram as number[]) ?? [];
  const histogramBins = (props.histogramBins as number[]) ?? [];
  const containerW = (props.containerWidth as number) ?? 4;
  const containerH = (props.containerHeight as number) ?? 3;

  const c = ctx.ctx;
  c.save();

  // 计算最大速率
  let maxSpeed = 0;
  for (let i = 0; i < velocities.length; i += 2) {
    const vx = velocities[i] ?? 0;
    const vy = velocities[i + 1] ?? 0;
    const spd = Math.sqrt(vx * vx + vy * vy);
    if (spd > maxSpeed) maxSpeed = spd;
  }
  if (maxSpeed === 0) maxSpeed = 1;

  // 1. 绘制分子
  const moleculeRadius = Math.max(2, worldLengthToScreen(0.03, coordinateTransform));
  for (let i = 0; i < positions.length; i += 2) {
    const wx = position.x - containerW / 2 + (positions[i] ?? 0);
    const wy = position.y - containerH / 2 + (positions[i + 1] ?? 0);
    const screen = worldToScreen({ x: wx, y: wy }, coordinateTransform);

    const vx = velocities[i] ?? 0;
    const vy = velocities[i + 1] ?? 0;
    const spd = Math.sqrt(vx * vx + vy * vy);

    c.fillStyle = speedToColor(spd, maxSpeed);
    c.beginPath();
    c.arc(screen.x, screen.y, moleculeRadius, 0, Math.PI * 2);
    c.fill();
  }

  // 2. 信息标注
  const containerScreen = worldToScreen(
    { x: position.x, y: position.y + containerH / 2 },
    coordinateTransform,
  );
  drawTextLabel(c, `T = ${temperature.toFixed(0)} K  N = ${count}`, {
    x: containerScreen.x,
    y: containerScreen.y + 18,
  }, {
    color: '#1565C0',
    fontSize: 12,
    align: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 3,
  });

  // 3. 速率分布直方图
  if (speedHistogram.length > 0) {
    const chartX = worldToScreen(
      { x: position.x + containerW / 2 + 0.5, y: position.y + containerH / 2 },
      coordinateTransform,
    );
    drawHistogram(c, chartX.x, chartX.y - 140, speedHistogram, histogramBins, temperature);
  }

  c.restore();
};

function drawHistogram(
  c: CanvasRenderingContext2D,
  x: number, y: number,
  histogram: number[],
  bins: number[],
  temperature: number,
): void {
  const w = 150;
  const h = 120;
  const m = 20;

  // 背景
  c.fillStyle = 'rgba(255,255,255,0.95)';
  c.strokeStyle = '#E0E0E0';
  c.lineWidth = 1;
  c.fillRect(x, y, w + m * 2, h + m * 2);
  c.strokeRect(x, y, w + m * 2, h + m * 2);

  const ox = x + m;
  const oy = y + m + h;

  // 坐标轴
  c.strokeStyle = '#424242';
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(ox, oy);
  c.lineTo(ox + w, oy);
  c.moveTo(ox, oy);
  c.lineTo(ox, oy - h);
  c.stroke();

  drawTextLabel(c, 'v', { x: ox + w + 8, y: oy }, {
    color: '#616161', fontSize: 10, align: 'center',
  });
  drawTextLabel(c, 'f(v)', { x: ox, y: oy - h - 10 }, {
    color: '#616161', fontSize: 10, align: 'center',
  });

  if (histogram.length === 0) {
    c.restore();
    return;
  }

  const maxCount = Math.max(...histogram, 1);
  const barW = w / histogram.length;

  // 直方图柱
  for (let i = 0; i < histogram.length; i++) {
    const barH = ((histogram[i] ?? 0) / maxCount) * h * 0.9;
    c.fillStyle = HIST_FILL;
    c.fillRect(ox + i * barW, oy - barH, barW - 1, barH);
    c.strokeStyle = HIST_STROKE;
    c.lineWidth = 0.5;
    c.strokeRect(ox + i * barW, oy - barH, barW - 1, barH);
  }

  // 理论曲线（简化的麦克斯韦分布形状）
  if (bins.length > 1 && temperature > 0) {
    c.strokeStyle = HIST_THEORY;
    c.lineWidth = 1.5;
    c.beginPath();
    const vMax = bins[bins.length - 1] ?? 1;
    for (let i = 0; i <= 50; i++) {
      const v = (i / 50) * vMax;
      // f(v) ∝ v² exp(-v²/(2kT/m)) — 归一化形状
      const vp = vMax * 0.45; // 最概然速率近似
      const fv = (v * v) / (vp * vp * vp) * Math.exp(-v * v / (2 * vp * vp));
      const maxFv = (1 / vp) * Math.exp(-0.5) * 0.67; // 归一化
      const px = ox + (v / vMax) * w;
      const py = oy - (fv / (maxFv || 1)) * h * 0.85;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.stroke();
  }

  // 温度标注
  drawTextLabel(c, `T = ${temperature.toFixed(0)} K`, {
    x: ox + w / 2, y: y + 12,
  }, { color: '#D32F2F', fontSize: 10, align: 'center' });
}

export function registerGasMoleculesRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'gas-molecules',
    renderer: gasMoleculesRenderer,
    layer: 'object',
  });
}
