import type { ThermoState, SceneModule, RenderContext, StateDisplayData } from '../types';
import { COLORS, CANVAS_FONTS } from '../theme';
import { clamp, createSeededRandom } from '../params';
import { drawBallAtScreen } from '../renderHelpers';

type ProcessKey = 'isothermal' | 'isobaric' | 'isochoric';
type FocusMode = '等温过程' | '等压过程' | '等容过程' | '三法对比';

interface GasLawProcess {
  key: ProcessKey;
  title: string;
  subtitle: string;
  graphTitle: string;
  color: string;
  T: number;
  V: number;
  P: number;
  law: string;
  invariant: string;
  invariantLabel: string;
  invariantValue: number;
  xLabel: string;
  yLabel: string;
  relationHint: string;
}

function buildProcesses(T: number, V: number, P: number): GasLawProcess[] {
  const nR = P * V / T;
  const pvConst = nR * T;
  const vtConst = nR / P;
  const ptConst = nR / V;
  return [
    {
      key: 'isothermal',
      title: '等温过程',
      subtitle: '控制 T 不变',
      graphTitle: 'p - V 图像',
      color: COLORS.isothermalLine,
      T,
      V,
      P: nR * T / V,
      law: `pV = ${pvConst.toFixed(1)}`,
      invariant: `T = ${T.toFixed(0)} K`,
      invariantLabel: '等温 pV',
      invariantValue: pvConst,
      xLabel: 'V',
      yLabel: 'p',
      relationHint: 'V 减小，p 增大',
    },
    {
      key: 'isobaric',
      title: '等压过程',
      subtitle: '控制 p 不变',
      graphTitle: 'V - T 图像',
      color: COLORS.isobaricLine,
      T,
      V: nR * T / P,
      P,
      law: `V/T = ${vtConst.toFixed(4)}`,
      invariant: `p = ${P.toFixed(0)} kPa`,
      invariantLabel: '等压 V/T',
      invariantValue: vtConst,
      xLabel: 'T',
      yLabel: 'V',
      relationHint: 'T 升高，V 增大',
    },
    {
      key: 'isochoric',
      title: '等容过程',
      subtitle: '控制 V 不变',
      graphTitle: 'p - T 图像',
      color: COLORS.isochoricLine,
      T,
      V,
      P: nR * T / V,
      law: `p/T = ${ptConst.toFixed(3)}`,
      invariant: `V = ${V.toFixed(1)} L`,
      invariantLabel: '等容 p/T',
      invariantValue: ptConst,
      xLabel: 'T',
      yLabel: 'p',
      relationHint: 'T 升高，p 增大',
    },
  ];
}

function focusToKey(focus: string): ProcessKey | null {
  if (focus === '等温过程') return 'isothermal';
  if (focus === '等压过程') return 'isobaric';
  if (focus === '等容过程') return 'isochoric';
  return null;
}

function getFocusHint(focus: string): string {
  if (focus === '等温过程') return '观察任务：调节体积 V，观察 p-V 双曲线上的当前点移动';
  if (focus === '等压过程') return '观察任务：调节温度 T，观察 V-T 直线关系';
  if (focus === '等容过程') return '观察任务：调节温度 T，观察 p-T 直线关系';
  return '观察任务：同时比较三种过程的不变量和图像形状';
}

export const gasLawsScene: SceneModule = {
  createInitialState() {
    return { t: 0 };
  },

  createStepFn() {
    return (_t: number, dt: number, state: ThermoState): ThermoState => ({ ...state, t: state.t + dt });
  },

  render(t, state, rctx, params) {
    const { cm } = rctx;
    const ctx = cm.ctx;
    cm.clear(COLORS.canvasBg);

    const T = Number(params.gasT) || 300;
    const V = Number(params.gasV) || 2.0;
    const P = Number(params.gasP) || 100;
    const focus = String(params.gasFocus || '三法对比') as FocusMode;
    const focusKey = focusToKey(focus);
    const processes = buildProcesses(T, V, P);

    const canW = rctx.canvasWidth;
    const canH = rctx.canvasHeight;
    drawLabBackdrop(ctx, canW, canH);

    const colGap = 24;
    const margin = 28;
    const colWidth = Math.max(180, (canW - margin * 2 - colGap * 2) / 3);
    const totalW = colWidth * 3 + colGap * 2;
    const startX = (canW - totalW) / 2;
    const colLefts = [startX, startX + colWidth + colGap, startX + (colWidth + colGap) * 2];

    const cardTop = 34;
    const cardBottom = canH - 18;
    const cylTop = cardTop + 62;
    const cylHeight = clamp(canH * 0.25, 175, 235);
    const graphTop = cylTop + cylHeight + 118;
    const graphHeight = Math.max(220, cardBottom - graphTop - 22);
    const cardH = cardBottom - cardTop;

    const minGasH = 36;
    const maxGasH = cylHeight - 18;
    const vMin = 0.5, vMax = 12;
    drawFocusBanner(ctx, startX, 6, totalW, getFocusHint(focus), focusKey ? processes.find(p => p.key === focusKey)?.color ?? COLORS.accentGreen : COLORS.accentGreen);

    for (let idx = 0; idx < 3; idx++) {
      const proc = processes[idx];
      const left = colLefts[idx];
      const cx = left + colWidth / 2;
      const isFocused = focusKey == null || proc.key === focusKey;
      ctx.save();
      ctx.globalAlpha = isFocused ? 1 : 0.42;
      drawProcessCard(ctx, left - 10, cardTop, colWidth + 20, cardH, proc, isFocused, focusKey != null && proc.key === focusKey);

      const volumeFrac = Math.sqrt(clamp((proc.V - vMin) / (12 - vMin), 0, 1));
      const gasH = minGasH + volumeFrac * (maxGasH - minGasH);
      const pistonY = cylTop + cylHeight - gasH;

      // Container with drop shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.08)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fillStyle = COLORS.canvasBg;
      ctx.fillRect(left, cylTop, colWidth, cylHeight);
      ctx.restore();

      // Container inner fill gradient
      const fillGrad = ctx.createLinearGradient(left, cylTop, left, cylTop + cylHeight);
      fillGrad.addColorStop(0, 'rgba(144,202,249,0.03)');
      fillGrad.addColorStop(1, 'rgba(144,202,249,0.08)');
      ctx.fillStyle = fillGrad;
      ctx.fillRect(left, cylTop, colWidth, cylHeight);

      // Container border — thicker
      ctx.strokeStyle = COLORS.containerBorder;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(left, cylTop, colWidth, cylHeight);

      // Gas fill
      ctx.fillStyle = COLORS.gasFill;
      ctx.fillRect(left + 2, pistonY, colWidth - 4, cylTop + cylHeight - pistonY - 2);

      // Animated particles with drawBallAtScreen
      const random = createSeededRandom(idx * 1000 + 42);
      const pCount = Math.min(20, Math.max(10, Math.floor((colWidth * gasH) / 600)));
      const speedFactor = proc.T / 300;
      for (let i = 0; i < pCount; i++) {
        const baseRx = random() * (colWidth - 28) + 14;
        const baseRy = random() * Math.max(1, gasH - 28) + 14;
        const jitterX = Math.sin(state.t * (1.8 + i * 0.25) * speedFactor + i * 6.151) * (2 + speedFactor * 2);
        const jitterY = Math.cos(state.t * (1.3 + i * 0.18) * speedFactor + i * 9.7) * (2 + speedFactor * 2);
        const rx = left + clamp(baseRx + jitterX, 12, colWidth - 12);
        const ry = pistonY + clamp(baseRy + jitterY, 12, gasH - 12);
        drawBallAtScreen(ctx, rx, ry, 4.5, proc.color, { alpha: 0.75 });
      }

      // Piston with metallic gradient + handle nub
      const pistonH = 14;
      const pistonGrad = ctx.createLinearGradient(left + 4, pistonY - pistonH, left + 4, pistonY + 2);
      pistonGrad.addColorStop(0, '#A1887F');
      pistonGrad.addColorStop(0.3, '#8D6E63');
      pistonGrad.addColorStop(0.7, COLORS.piston);
      pistonGrad.addColorStop(1, '#4E342E');
      ctx.fillStyle = pistonGrad;
      ctx.fillRect(left + 4, pistonY - pistonH, colWidth - 8, pistonH);
      // Specular line on piston
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(left + 8, pistonY - pistonH + 2);
      ctx.lineTo(left + colWidth - 8, pistonY - pistonH + 2);
      ctx.stroke();
      // Handle nub
      const nubW = 16, nubH = 6;
      ctx.fillStyle = '#6D4C41';
      ctx.fillRect(cx - nubW / 2, pistonY - pistonH - nubH, nubW, nubH);

      // Column title with color + underline
      drawStateStrip(ctx, left, cylTop + cylHeight + 18, colWidth, proc);

      // Mini graph
      if (graphHeight > 60) {
        const gLeft = left;
        const gBottom = graphTop + graphHeight;

        ctx.fillStyle = 'rgba(0,0,0,0.015)';
        ctx.fillRect(gLeft, graphTop, colWidth, graphHeight);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 1;
        ctx.strokeRect(gLeft, graphTop, colWidth, graphHeight);

        // Axes
        ctx.strokeStyle = 'rgba(0,0,0,0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(gLeft, gBottom); ctx.lineTo(gLeft + colWidth, gBottom);
        ctx.moveTo(gLeft, graphTop); ctx.lineTo(gLeft, gBottom);
        ctx.stroke();

        // Curve
        ctx.strokeStyle = proc.color;
        ctx.lineWidth = 3;

        if (proc.key === 'isothermal') {
          ctx.beginPath();
          for (let i = 0; i <= 180; i++) {
            const vi = vMin + (vMax - vMin) * i / 180;
            const pi = proc.invariantValue / vi;
            const pMax = proc.invariantValue / vMin;
            const x = gLeft + ((vi - vMin) / (vMax - vMin)) * colWidth;
            const y = gBottom - (pi / (pMax * 1.1)) * graphHeight;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.stroke();
          drawAxisLabels(ctx, gLeft, gBottom, colWidth, 'V', 'p');
        } else if (proc.key === 'isobaric') {
          const tMax = 1500;
          const vMaxGraph = proc.invariantValue * tMax * 1.1;
          ctx.beginPath();
          ctx.moveTo(gLeft, gBottom);
          ctx.lineTo(gLeft + colWidth, gBottom - (proc.invariantValue * tMax / vMaxGraph) * graphHeight);
          ctx.stroke();
          drawAxisLabels(ctx, gLeft, gBottom, colWidth, 'T', 'V');
        } else {
          const tMax = 1500;
          const pMaxGraph = proc.invariantValue * tMax * 1.1;
          ctx.beginPath();
          ctx.moveTo(gLeft, gBottom);
          ctx.lineTo(gLeft + colWidth, gBottom - (proc.invariantValue * tMax / pMaxGraph) * graphHeight);
          ctx.stroke();
          drawAxisLabels(ctx, gLeft, gBottom, colWidth, 'T', 'p');
        }

        // Current state dot — larger with glow
        const dotX = proc.key === 'isothermal'
          ? gLeft + clamp((proc.V - vMin) / (vMax - vMin), 0, 1) * colWidth
          : gLeft + (proc.T / 1500) * colWidth;
        const dotY = proc.key === 'isothermal'
          ? gBottom - (proc.P / (proc.invariantValue / vMin * 1.1)) * graphHeight
          : proc.key === 'isobaric'
            ? gBottom - (proc.V / (proc.invariantValue * 1500 * 1.1)) * graphHeight
            : gBottom - (proc.P / (proc.invariantValue * 1500 * 1.1)) * graphHeight;

        drawGraphGuides(ctx, dotX, dotY, gLeft, gBottom, graphTop, proc);

        ctx.save();
        ctx.shadowColor = COLORS.arrowHeating;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.arrowHeating;
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dotX, dotY, 7, 0, Math.PI * 2);
        ctx.stroke();

        drawGraphCaption(ctx, gLeft, graphTop, colWidth, proc);
      }
      ctx.restore();
    }

    cm.applyBloom(0.10);
  },

  getStateDisplay(params): StateDisplayData {
    const T = Number(params.gasT) || 300;
    const V = Number(params.gasV) || 2.0;
    const P = Number(params.gasP) || 100;
    const focus = String(params.gasFocus || '三法对比');
    const processes = buildProcesses(T, V, P);
    return {
      p: P,
      V,
      T,
      pvOverT: P * V / T,
      customEntries: processes.map(proc => ({
        label: proc.invariantLabel,
        value: proc.invariantValue.toFixed(proc.key === 'isothermal' ? 1 : 4),
        highlight: focusToKey(focus) == null || focusToKey(focus) === proc.key,
      })),
    };
  },
};

function drawLabBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, 'rgba(239,246,255,0.92)');
  grad.addColorStop(0.48, '#FFFFFF');
  grad.addColorStop(1, 'rgba(240,253,244,0.88)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = 'rgba(15,23,42,0.035)';
  ctx.lineWidth = 1;
  for (let x = 24; x < width; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 24; y < height; y += 34) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawProcessCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  proc: GasLawProcess,
  active: boolean,
  focused: boolean,
): void {
  ctx.save();
  ctx.shadowColor = focused ? adjustAlpha(proc.color, 0.22) : 'rgba(15,23,42,0.10)';
  ctx.shadowBlur = focused ? 26 : 18;
  ctx.shadowOffsetY = focused ? 10 : 8;
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = focused ? adjustAlpha(proc.color, 0.58) : adjustAlpha(proc.color, active ? 0.20 : 0.12);
  ctx.lineWidth = focused ? 2.2 : 1.2;
  ctx.stroke();

  ctx.fillStyle = proc.color;
  ctx.font = 'bold 16px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(proc.title, x + 16, y + 24);

  drawPill(ctx, x + w - 120, y + 12, 104, 24, proc.invariant, proc.color, adjustAlpha(proc.color, 0.10));
  ctx.font = '11px -apple-system, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(proc.subtitle, x + 16, y + 46);
  if (focused) {
    drawPill(ctx, x + 16, y + h - 32, 92, 22, '当前观察', proc.color, adjustAlpha(proc.color, 0.12));
  }
}

function drawFocusBanner(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  text: string,
  color: string,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  roundRect(ctx, x, y, w, 22, 11);
  ctx.fill();
  ctx.strokeStyle = adjustAlpha(color, 0.20);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 12px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + 11);
}

function drawStateStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  proc: GasLawProcess,
): void {
  drawPill(ctx, x + 8, y, w - 16, 24, proc.relationHint, proc.color, adjustAlpha(proc.color, 0.08));

  const itemY = y + 42;
  const itemW = (w - 20) / 3;
  const items = [
    { label: 'p', value: `${proc.P.toFixed(1)} kPa` },
    { label: 'V', value: `${proc.V.toFixed(1)} L` },
    { label: 'T', value: `${proc.T.toFixed(0)} K` },
  ];
  for (let i = 0; i < items.length; i++) {
    const ix = x + 6 + i * itemW;
    ctx.fillStyle = 'rgba(255,255,255,0.70)';
    roundRect(ctx, ix, itemY, itemW - 6, 36, 7);
    ctx.fill();
    ctx.strokeStyle = 'rgba(15,23,42,0.07)';
    ctx.stroke();
    ctx.font = '10px -apple-system, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    ctx.fillText(items[i].label, ix + (itemW - 6) / 2, itemY + 12);
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.fillStyle = COLORS.textPrimary;
    ctx.fillText(items[i].value, ix + (itemW - 6) / 2, itemY + 27);
  }

  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.fillStyle = proc.color;
  ctx.textAlign = 'center';
  ctx.fillText(proc.law, x + w / 2, y + 96);
}

function drawGraphGuides(
  ctx: CanvasRenderingContext2D,
  dotX: number,
  dotY: number,
  left: number,
  bottom: number,
  top: number,
  proc: GasLawProcess,
): void {
  ctx.save();
  ctx.strokeStyle = adjustAlpha(proc.color, 0.32);
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(dotX, dotY);
  ctx.lineTo(dotX, bottom);
  ctx.moveTo(dotX, dotY);
  ctx.lineTo(left, dotY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = adjustAlpha(proc.color, 0.10);
  roundRect(ctx, dotX - 24, top + 6, 48, 16, 8);
  ctx.fill();
  ctx.fillStyle = proc.color;
  ctx.font = 'bold 10px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('当前点', dotX, top + 14);
  ctx.restore();
}

function drawGraphCaption(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  proc: GasLawProcess,
): void {
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = 'bold 12px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(proc.graphTitle, x + 8, y - 8);
  ctx.fillStyle = proc.color;
  ctx.textAlign = 'right';
  ctx.fillText(proc.law, x + w - 8, y - 8);
}

function drawAxisLabels(ctx: CanvasRenderingContext2D, left: number, bottom: number, width: number, xLabel: string, yLabel: string): void {
  ctx.fillStyle = COLORS.textDim;
  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(xLabel, left + width - 8, bottom + 14);
  ctx.save();
  ctx.translate(left - 10, bottom - width / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yLabel, 0, 0);
  ctx.restore();
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  color: string,
  fill: string,
): void {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = adjustAlpha(color, 0.24);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function adjustAlpha(color: string, alpha: number): string {
  const m = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}
