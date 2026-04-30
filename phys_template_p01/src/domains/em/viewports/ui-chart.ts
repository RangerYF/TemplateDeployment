/**
 * U-I 图表绘制工具
 *
 * 在 Canvas 上绘制：
 * 1. 坐标轴（X=电流I, Y=电压U）
 * 2. 理论直线 U = ε - I·r（蓝色虚线）
 * 3. 当前工作点（红色实心圆，随滑片移动）
 * 4. 坐标标注和物理量
 */

import { drawTextLabel } from '@/renderer/primitives/text-label';

export interface UIChartData {
  /** 电源电动势 (V) */
  emf: number;
  /** 电源内阻 (Ω) */
  r: number;
  /** 当前电流 (A) */
  currentI: number;
  /** 当前端电压 (V) */
  currentU: number;
}

export interface UIChartRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const AXIS_COLOR = '#374151';
const THEORY_LINE_COLOR = '#3B82F6';
const POINT_COLOR = '#E74C3C';
const GRID_COLOR = '#E5E7EB';
const LABEL_COLOR = '#6B7280';

/**
 * 在指定矩形区域内绘制 U-I 图
 */
export function renderUIChart(
  c: CanvasRenderingContext2D,
  rect: UIChartRect,
  data: UIChartData,
): void {
  const { x, y, width, height } = rect;
  const { emf, r, currentI, currentU } = data;

  // 图表内边距
  const pad = { left: 40, right: 16, top: 20, bottom: 30 };
  const plotX = x + pad.left;
  const plotY = y + pad.top;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  // 坐标范围
  const maxI = r > 0 ? Math.ceil((emf / r) * 1.2 * 10) / 10 : 1;
  const maxU = Math.ceil(emf * 1.2);

  // 坐标映射
  const toScreenX = (i: number) => plotX + (i / maxI) * plotW;
  const toScreenY = (u: number) => plotY + plotH - (u / maxU) * plotH;

  c.save();

  // ── 0. 半透明背景 ──
  c.fillStyle = 'rgba(255, 255, 255, 0.92)';
  c.strokeStyle = '#D1D5DB';
  c.lineWidth = 1;
  c.beginPath();
  c.roundRect(x, y, width, height, 8);
  c.fill();
  c.stroke();

  // ── 1. 标题 ──
  c.fillStyle = AXIS_COLOR;
  c.font = 'bold 11px Inter, sans-serif';
  c.textAlign = 'left';
  c.fillText('U-I 关系图', x + 10, y + 14);

  // ── 2. 网格线 ──
  c.strokeStyle = GRID_COLOR;
  c.lineWidth = 0.5;

  // 水平网格
  const uStep = maxU <= 6 ? 1 : 2;
  for (let u = 0; u <= maxU; u += uStep) {
    const sy = toScreenY(u);
    c.beginPath();
    c.moveTo(plotX, sy);
    c.lineTo(plotX + plotW, sy);
    c.stroke();
  }

  // 垂直网格
  const iStep = maxI <= 1 ? 0.1 : maxI <= 3 ? 0.5 : 1;
  for (let i = 0; i <= maxI; i += iStep) {
    const sx = toScreenX(i);
    c.beginPath();
    c.moveTo(sx, plotY);
    c.lineTo(sx, plotY + plotH);
    c.stroke();
  }

  // ── 3. 坐标轴 ──
  c.strokeStyle = AXIS_COLOR;
  c.lineWidth = 1.5;

  // X 轴
  c.beginPath();
  c.moveTo(plotX, plotY + plotH);
  c.lineTo(plotX + plotW, plotY + plotH);
  c.stroke();

  // Y 轴
  c.beginPath();
  c.moveTo(plotX, plotY + plotH);
  c.lineTo(plotX, plotY);
  c.stroke();

  // 轴标签
  c.fillStyle = LABEL_COLOR;
  c.font = '10px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText('I/A', plotX + plotW + 8, plotY + plotH + 4);
  c.textAlign = 'left';
  c.fillText('U/V', plotX - 4, plotY - 6);

  // 刻度标注
  c.font = '9px Inter, sans-serif';
  c.textAlign = 'center';
  for (let i = iStep; i <= maxI; i += iStep) {
    c.fillText(i.toFixed(1), toScreenX(i), plotY + plotH + 12);
  }
  c.textAlign = 'right';
  for (let u = uStep; u <= maxU; u += uStep) {
    c.fillText(String(u), plotX - 4, toScreenY(u) + 3);
  }

  // ── 4. 理论直线 U = ε - I·r ──
  c.strokeStyle = THEORY_LINE_COLOR;
  c.lineWidth = 1.5;
  c.setLineDash([6, 4]);

  const i0 = 0;
  const u0 = emf;
  const iMax = r > 0 ? emf / r : maxI;
  const uMax = 0;

  c.beginPath();
  c.moveTo(toScreenX(i0), toScreenY(u0));
  c.lineTo(toScreenX(Math.min(iMax, maxI)), toScreenY(Math.max(uMax, 0)));
  c.stroke();
  c.setLineDash([]);

  // 理论线标注
  drawTextLabel(c,
    `U = ${emf.toFixed(1)} - ${r.toFixed(1)}·I`,
    { x: toScreenX(maxI * 0.5), y: toScreenY(emf * 0.6) - 8 },
    { color: THEORY_LINE_COLOR, fontSize: 9, align: 'center' },
  );

  // ── 5. 当前工作点 ──
  if (currentI > 0 && currentU > 0) {
    const px = toScreenX(currentI);
    const py = toScreenY(currentU);

    // 十字辅助线
    c.strokeStyle = 'rgba(231, 76, 60, 0.3)';
    c.lineWidth = 1;
    c.setLineDash([3, 3]);
    c.beginPath();
    c.moveTo(px, plotY + plotH);
    c.lineTo(px, py);
    c.lineTo(plotX, py);
    c.stroke();
    c.setLineDash([]);

    // 工作点圆
    c.fillStyle = POINT_COLOR;
    c.beginPath();
    c.arc(px, py, 5, 0, Math.PI * 2);
    c.fill();

    // 坐标标注
    c.fillStyle = POINT_COLOR;
    c.font = '9px Inter, sans-serif';
    c.textAlign = 'left';
    c.fillText(`(${currentI.toFixed(3)}, ${currentU.toFixed(2)})`, px + 8, py - 4);
  }

  // ── 6. 参数标注 ──
  c.fillStyle = LABEL_COLOR;
  c.font = '9px Inter, sans-serif';
  c.textAlign = 'left';
  drawTextLabel(c,
    `ε=${emf.toFixed(1)}V  r=${r.toFixed(1)}Ω`,
    { x: plotX + plotW - 60, y: plotY + 8 },
    { color: LABEL_COLOR, fontSize: 9, align: 'right' },
  );

  c.restore();
}
