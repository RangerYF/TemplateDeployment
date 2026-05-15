import type { ThermoState, SceneModule, RenderContext, StateDisplayData, CalcStep } from '../types';
import { COLORS, CANVAS_FONTS } from '../theme';
import { clamp, isTiltedLiquidColumn, isNegativePressureLiquidColumn } from '../params';
import { drawBallAtScreen, drawScreenArrow } from '../renderHelpers';

export const liquidColumnScene: SceneModule = {
  createInitialState() {
    return { t: 0, animProgress: 0 };
  },

  createStepFn() {
    return (_t: number, dt: number, state: ThermoState): ThermoState => {
      const s: ThermoState = { ...state, t: state.t + dt };
      if (s.animProgress < 1) {
        s.animProgress = Math.min(1, s.animProgress + dt * 1.2);
      }
      return s;
    };
  },

  render(_t, state, rctx, params) {
    const { cm } = rctx;
    const ctx = cm.ctx;
    cm.clear(COLORS.canvasBg);

    const orientation = String(params.tubeOrientation) || '竖直开口向上';
    const T1 = Number(params.lcT1) || 300;
    const T2 = Number(params.lcT2) || 400;
    const L1 = Number(params.lcL1) || 20;
    const h = Number(params.lcH) || 10;
    const angle = Number(params.lcAngle) || 30;
    const area = Number(params.lcArea) || 1.0;
    const P0 = Number(params.lcPAtm) || 76;

    const canW = rctx.canvasWidth;
    const canH = rctx.canvasHeight;
    const anim = clamp(state.animProgress || 0, 0, 1);

    const result = solveLiquidColumn(orientation, T1, T2, L1, h, angle, area, P0);
    const teaching = buildTeaching(orientation, T1, T2, L1, h, angle, area, P0, result);

    if (orientation === 'U型管') {
      drawWorktableBackdrop(ctx, canW, canH);
      drawStageTitle(ctx, canW, orientation, teaching);
      drawUTube(ctx, canW, canH, L1, h, result, anim, state.t);
      drawAnalysisCards(ctx, canW * 0.68, 96, canW * 0.25, teaching);
      drawEquationCheck(ctx, canW * 0.68, 310, canW * 0.25, teaching);
      drawThermometer(ctx, canW * 0.92, 118, T1, T2, anim);
    } else if (orientation === '两端密封') {
      drawWorktableBackdrop(ctx, canW, canH);
      drawStageTitle(ctx, canW, orientation, teaching);
      drawDualSealedTube(ctx, canW, canH, L1, h, result, anim, state.t);
      drawAnalysisCards(ctx, canW * 0.68, 96, canW * 0.25, teaching);
      drawEquationCheck(ctx, canW * 0.68, 310, canW * 0.25, teaching);
      drawThermometer(ctx, canW * 0.92, 118, T1, T2, anim);
    } else {
      drawStandardTubes(ctx, canW, canH, orientation, L1, h, result, anim, angle, area, state.t, P0, T1, T2, teaching);
    }
  },

  getStateDisplay(params, state): StateDisplayData {
    const orientation = String(params.tubeOrientation) || '竖直开口向上';
    const T1 = Number(params.lcT1) || 300;
    const T2 = Number(params.lcT2) || 400;
    const L1 = Number(params.lcL1) || 20;
    const h = Number(params.lcH) || 10;
    const angle = Number(params.lcAngle) || 30;
    const area = Number(params.lcArea) || 1.0;
    const P0 = Number(params.lcPAtm) || 76;

    const result = solveLiquidColumn(orientation, T1, T2, L1, h, angle, area, P0);
    const teaching = buildTeaching(orientation, T1, T2, L1, h, angle, area, P0, result);

    return {
      p: result.P1,
      V: result.V1,
      T: T1,
      pUnit: 'cmHg',
      VUnit: 'cm³',
      customEntries: [
        { label: 'P₁', value: `${result.P1.toFixed(1)} cmHg` },
        { label: 'L₁', value: `${L1.toFixed(1)} cm` },
        { label: 'V₁', value: `${result.V1.toFixed(1)} cm³` },
        { label: 'L₂', value: `${result.L2.toFixed(2)} cm`, highlight: true },
        { label: 'V₂', value: `${result.V2.toFixed(1)} cm³`, highlight: true },
        { label: 'P₂', value: `${result.P2.toFixed(1)} cmHg` },
        { label: '压强关系', value: teaching.pressureFormula, highlight: true },
        { label: '方程左边', value: teaching.verifyLeft.toFixed(4) },
        { label: '方程右边', value: teaching.verifyRight.toFixed(4), highlight: true },
      ],
    };
  },

  getCalcSteps(params): CalcStep[] {
    const orientation = String(params.tubeOrientation) || '竖直开口向上';
    const T1 = Number(params.lcT1) || 300;
    const T2 = Number(params.lcT2) || 400;
    const L1 = Number(params.lcL1) || 20;
    const h = Number(params.lcH) || 10;
    const angle = Number(params.lcAngle) || 30;
    const area = Number(params.lcArea) || 1.0;
    const P0 = Number(params.lcPAtm) || 76;

    return buildCalcSteps(orientation, T1, T2, L1, h, angle, area, P0);
  },
};

interface LiquidColumnResult {
  P1: number; P2: number; L2: number; V1: number; V2: number;
  L2Left?: number; L2Right?: number; hLeft?: number; hRight?: number; deltaH?: number;
}

interface LiquidColumnTeaching {
  pressureFormula: string;
  pressureHint: string;
  equation: string;
  verifyLeft: number;
  verifyRight: number;
  modelHint: string;
}

function getEffectiveHeight(h: number, orientation: string, angle: number): number {
  if (isTiltedLiquidColumn(orientation)) return h * Math.sin(angle * Math.PI / 180);
  if (orientation === '水平') return 0;
  return h;
}

function buildTeaching(
  orientation: string,
  T1: number,
  T2: number,
  L1: number,
  h: number,
  angle: number,
  area: number,
  P0: number,
  result: LiquidColumnResult,
): LiquidColumnTeaching {
  const effH = getEffectiveHeight(h, orientation, angle);
  let pressureFormula = `P₁ = P₀`;
  let pressureHint = '液柱没有产生竖直压强差';
  let modelHint = '水平管中液柱只起封闭作用，气体近似等压变化。';

  if (orientation === '竖直开口向上') {
    pressureFormula = `P₁ = P₀ + h = ${P0} + ${effH.toFixed(1)} = ${result.P1.toFixed(1)} cmHg`;
    pressureHint = '液柱压在气体上，气体压强大于大气压';
    modelHint = '先把液柱看作受力平衡：气体向上顶，外界大气与液柱共同向下压。';
  } else if (orientation === '竖直开口向下') {
    pressureFormula = `P₁ = P₀ - h = ${P0} - ${effH.toFixed(1)} = ${result.P1.toFixed(1)} cmHg`;
    pressureHint = '液柱被气体托住，气体压强小于大气压';
    modelHint = '开口向下时液柱对气体的贡献反号，这是最容易错的地方。';
  } else if (orientation === '倾斜开口向上') {
    pressureFormula = `P₁ = P₀ + hsinθ = ${P0} + ${h}sin${angle}° = ${result.P1.toFixed(1)} cmHg`;
    pressureHint = `只取竖直高度差 hsinθ = ${effH.toFixed(1)} cm`;
    modelHint = '倾斜管不要直接用液柱长度 h，要换成竖直高度差 hsinθ。';
  } else if (orientation === '倾斜开口向下') {
    pressureFormula = `P₁ = P₀ - hsinθ = ${P0} - ${h}sin${angle}° = ${result.P1.toFixed(1)} cmHg`;
    pressureHint = `有效高度反向，hsinθ = ${effH.toFixed(1)} cm`;
    modelHint = '倾斜且开口向下时，既要取 hsinθ，又要注意压强贡献为减号。';
  } else if (orientation === 'U型管') {
    pressureFormula = `P₂ = P₀ + Δh = ${P0} + ${(result.deltaH ?? 0).toFixed(1)} = ${result.P2.toFixed(1)} cmHg`;
    pressureHint = 'U 型管关键看两臂液面高度差 Δh';
    modelHint = '密封气体膨胀会压低左液面、抬高开口端液面，压强差只由 Δh 决定。';
  } else if (orientation === '两端密封') {
    pressureFormula = `P左 = P右 = ${result.P2.toFixed(1)} cmHg`;
    pressureHint = '中间液柱最终受力平衡，两侧压强相等';
    modelHint = '两端密封题需要同时写两侧气体方程，再加液柱平衡条件。';
  }

  const verifyLeft = result.P1 * result.V1 / T1;
  const verifyRight = result.P2 * result.V2 / T2;
  return {
    pressureFormula,
    pressureHint,
    equation: 'P₁V₁/T₁ = P₂V₂/T₂',
    verifyLeft,
    verifyRight,
    modelHint,
  };
}

function solveLiquidColumn(
  orientation: string, T1: number, T2: number, L1: number, h: number,
  angle: number, area: number, P0: number
): LiquidColumnResult {
  const effH = getEffectiveHeight(h, orientation, angle);

  if (orientation === 'U型管') {
    const P1 = P0;
    const initialInvariant = P1 * L1 / T1;
    const minL = Math.max(1, L1 * 0.2);
    const maxL = Math.max(L1 * 4, L1 + P0);
    let lo = minL;
    let hi = maxL;
    for (let i = 0; i < 80; i++) {
      const mid = (lo + hi) / 2;
      const deltaH = Math.max(0, 2 * (mid - L1));
      const pMid = P0 + deltaH;
      const value = pMid * mid / T2;
      if (value < initialInvariant) lo = mid;
      else hi = mid;
    }
    const L2 = (lo + hi) / 2;
    const deltaH = Math.max(0, 2 * (L2 - L1));
    const P2 = P0 + deltaH;
    const baseLiquid = Math.max(h, deltaH + 2);
    const hLeft = Math.max(0.8, (baseLiquid - deltaH) / 2);
    const hRight = hLeft + deltaH;
    return { P1, P2, L2, V1: L1 * area, V2: L2 * area, hLeft, hRight, deltaH };
  }

  if (orientation === '两端密封') {
    const P1 = P0;
    const L2Left = (2 * L1 * T2) / (T1 + T2);
    const L2Right = (2 * L1 * T1) / (T1 + T2);
    const P2 = P1 * L1 * T2 / (T1 * L2Left);
    return { P1, P2, L2: L2Left, V1: L1 * area, V2: L2Left * area, L2Left, L2Right };
  }

  let P1: number;
  if (orientation === '竖直开口向上' || orientation === '倾斜开口向上') {
    P1 = P0 + effH;
  } else if (orientation === '竖直开口向下' || orientation === '倾斜开口向下') {
    P1 = P0 - effH;
  } else {
    P1 = P0;
  }
  const P2 = P1;
  const L2 = (P1 * L1 * T2) / (T1 * P2);
  return { P1, P2, L2, V1: L1 * area, V2: L2 * area };
}

function drawGasMolecules(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  count: number, time: number,
) {
  if (h < 10 || w < 10) return;
  for (let i = 0; i < count; i++) {
    const bx = x + (w * 0.15) + (w * 0.7) * ((i * 0.618 + 0.1) % 1);
    const by = y + (h * 0.15) + (h * 0.7) * ((i * 0.382 + 0.3) % 1);
    const jx = Math.sin(time * 2.5 + i * 7.31) * 4;
    const jy = Math.cos(time * 1.8 + i * 4.97) * 4;
    drawBallAtScreen(ctx,
      clamp(bx + jx, x + 6, x + w - 6),
      clamp(by + jy, y + 6, y + h - 6),
      4, '#42A5F5', { alpha: 0.75 },
    );
  }
}

function drawMercuryGradient(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
) {
  if (h < 1) return;
  const grad = ctx.createLinearGradient(x, y, x + w, y);
  grad.addColorStop(0, '#B0B0B0');
  grad.addColorStop(0.3, '#C8C8C8');
  grad.addColorStop(0.5, '#D8D8D8');
  grad.addColorStop(0.7, '#C0C0C0');
  grad.addColorStop(1, '#A0A0A0');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);

  // Meniscus (concave top)
  ctx.fillStyle = 'rgba(200,200,200,0.4)';
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.quadraticCurveTo(x + w / 2, y + Math.min(4, h * 0.3), x + w, y);
  ctx.lineTo(x + w, y + 2);
  ctx.lineTo(x, y + 2);
  ctx.closePath();
  ctx.fill();
}

function drawWorktableBackdrop(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, 'rgba(239,246,255,0.90)');
  grad.addColorStop(0.55, '#FFFFFF');
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

function drawStageTitle(ctx: CanvasRenderingContext2D, width: number, orientation: string, teaching: LiquidColumnTeaching): void {
  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  roundRect(ctx, 24, 18, width - 48, 44, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,23,42,0.08)';
  ctx.stroke();

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = 'bold 17px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`液柱密封模型 · ${orientation}`, 44, 40);

  ctx.fillStyle = COLORS.accentGreen;
  ctx.font = 'bold 13px -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(teaching.pressureHint, width - 44, 40);
}

function drawTubeCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  subtitle: string,
  color: string,
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.10)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  roundRect(ctx, x, y, w, h, 14);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = adjustAlpha(color, 0.22);
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, x + w / 2, y + 24);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '12px -apple-system, sans-serif';
  ctx.fillText(subtitle, x + w / 2, y + 44);
}

function drawAnalysisCards(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  teaching: LiquidColumnTeaching,
): void {
  drawInfoCard(ctx, x, y, w, 150, '压强分析', 'PRESSURE', teaching.pressureFormula, teaching.modelHint, COLORS.arrowPressure);
}

function drawEquationCheck(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  teaching: LiquidColumnTeaching,
): void {
  const err = Math.abs(teaching.verifyLeft - teaching.verifyRight);
  const ok = err < 0.02;
  const detail = `左边 = ${teaching.verifyLeft.toFixed(4)}\n右边 = ${teaching.verifyRight.toFixed(4)}\n${ok ? '两边近似相等' : '注意：当前模型需复核平衡条件'}`;
  drawInfoCard(ctx, x, y, w, 158, '状态方程验证', 'VERIFY', teaching.equation, detail, ok ? COLORS.accentGreen : COLORS.arrowHeating);
}

function drawInfoCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  tag: string,
  formula: string,
  detail: string,
  color: string,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = adjustAlpha(color, 0.22);
  ctx.stroke();
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = 'bold 11px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 14, y + 22);
  ctx.fillStyle = adjustAlpha(color, 0.12);
  roundRect(ctx, x + w - 76, y + 10, 62, 22, 11);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.fillText(tag, x + w - 45, y + 25);

  ctx.fillStyle = color;
  ctx.font = 'bold 14px "Courier New", monospace';
  ctx.textAlign = 'left';
  wrapText(ctx, formula, x + 14, y + 56, w - 28, 18);

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = '12px -apple-system, sans-serif';
  const lines = detail.split('\n');
  let ly = y + 92;
  for (const line of lines) {
    wrapText(ctx, line, x + 14, ly, w - 28, 16);
    ly += 18;
  }
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): void {
  let line = '';
  let currentY = y;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = ch;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}

function drawMiniResultStrip(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  items: string[],
  color: string,
): void {
  ctx.fillStyle = 'rgba(255,255,255,0.74)';
  roundRect(ctx, x, y, w, 36, 9);
  ctx.fill();
  ctx.strokeStyle = adjustAlpha(color, 0.18);
  ctx.stroke();
  const itemW = w / items.length;
  ctx.font = 'bold 12px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < items.length; i++) {
    ctx.fillStyle = i === 0 ? color : COLORS.textPrimary;
    ctx.fillText(items[i], x + itemW * (i + 0.5), y + 18);
  }
}

function drawPressureArrow(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  length: number, direction: 'up' | 'down', label: string, color: string,
) {
  const dy = direction === 'down' ? length : -length;
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y + dy);
  ctx.stroke();

  const tipY = y + dy;
  const arrowDir = direction === 'down' ? 1 : -1;
  ctx.beginPath();
  ctx.moveTo(x - 6, tipY - 8 * arrowDir);
  ctx.lineTo(x, tipY);
  ctx.lineTo(x + 6, tipY - 8 * arrowDir);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(label, x, direction === 'down' ? tipY + 18 : tipY - 10);
}

function drawDimensionLine(
  ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number,
  label: string, side: 'left' | 'right',
) {
  const offset = side === 'right' ? 10 : -10;
  const textOffset = side === 'right' ? 16 : -16;
  ctx.strokeStyle = COLORS.dimensionLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(x + offset, y1);
  ctx.lineTo(x + offset, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.moveTo(x + offset - 4, y1); ctx.lineTo(x + offset + 4, y1);
  ctx.moveTo(x + offset - 4, y2); ctx.lineTo(x + offset + 4, y2);
  ctx.stroke();

  ctx.fillStyle = COLORS.dimensionLine;
  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = side === 'right' ? 'left' : 'right';
  ctx.fillText(label, x + textOffset, (y1 + y2) / 2 + 4);
}

function drawStandardTubes(
  ctx: CanvasRenderingContext2D, canW: number, canH: number,
  orientation: string, L1: number, h: number, result: LiquidColumnResult,
  anim: number, angle: number, area: number, time: number, P0: number,
  T1: number, T2: number, teaching: LiquidColumnTeaching,
) {
  drawWorktableBackdrop(ctx, canW, canH);
  if (orientation === '水平') {
    drawHorizontalWorkbench(ctx, canW, canH, L1, h, result, anim, area, time, T1, T2, teaching);
    return;
  }
  if (isTiltedLiquidColumn(orientation)) {
    drawTiltedWorkbench(ctx, canW, canH, orientation, L1, h, result, anim, angle, area, time, T1, T2, teaching);
    return;
  }

  const maxContent = Math.max(L1, result.L2) + h + 8;
  const tubePixelH = Math.min(canH - 210, 470);
  const scale = tubePixelH / maxContent;
  const tubeW = 72;
  const tubeTopY = 96;
  const animL2 = L1 + (result.L2 - L1) * anim;

  const tube1X = canW * 0.26;
  const tube2X = canW * 0.52;

  drawStageTitle(ctx, canW, orientation, teaching);
  drawTubeCard(ctx, tube1X - 92, tubeTopY - 54, 184, tubePixelH + 142, '初始状态', `T₁ = ${T1} K`, COLORS.isochoricLine);
  drawTubeCard(ctx, tube2X - 92, tubeTopY - 54, 184, tubePixelH + 142, '末状态', `T₂ = ${T2} K`, COLORS.arrowHeating);
  drawSingleTube(ctx, tube1X, tubeTopY, tubePixelH, tubeW, scale, L1, h, orientation, '初始状态 T₁', result.P1, L1 * area, time, P0);
  drawSingleTube(ctx, tube2X, tubeTopY, tubePixelH, tubeW, scale, animL2, h, orientation, '末状态 T₂', result.P2, animL2 * area, time, P0);

  // Transition arrow
  const arrowY = tubeTopY + tubePixelH / 2;
  ctx.strokeStyle = COLORS.arrowHeating;
  ctx.lineWidth = 2;
  const ax1 = tube1X + tubeW / 2 + 20;
  const ax2 = tube2X - tubeW / 2 - 20;
  ctx.beginPath();
  ctx.moveTo(ax1, arrowY); ctx.lineTo(ax2, arrowY);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(ax2 - 7, arrowY - 5); ctx.lineTo(ax2, arrowY); ctx.lineTo(ax2 - 7, arrowY + 5);
  ctx.fillStyle = COLORS.arrowHeating;
  ctx.fill();
  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'center';
  ctx.fillText(T2 >= T1 ? '升温后气柱变化' : '降温后气柱变化', (ax1 + ax2) / 2, arrowY - 12);

  drawAnalysisCards(ctx, canW * 0.69, 96, canW * 0.25, teaching);
  drawEquationCheck(ctx, canW * 0.69, 310, canW * 0.25, teaching);
  drawThermometer(ctx, canW * 0.92, 118, T1, T2, anim);
}

function drawSingleTube(
  ctx: CanvasRenderingContext2D, cx: number, topY: number,
  tubePixelH: number, tubeW: number, scale: number,
  gasLen: number, liqLen: number, orientation: string,
  label: string, pGas: number, volume: number, time: number, P0: number,
) {
  const tubeLeft = cx - tubeW / 2;
  let gasStartY: number, gasEndY: number;
  let liqStartY: number, liqEndY: number;
  const bottomY = topY + tubePixelH;

  const isOpenDown = orientation === '竖直开口向下' || orientation === '倾斜开口向下';
  if (!isOpenDown) {
    gasEndY = bottomY;
    gasStartY = bottomY - gasLen * scale;
    liqEndY = gasStartY;
    liqStartY = gasStartY - liqLen * scale;
  } else {
    gasStartY = topY;
    gasEndY = topY + gasLen * scale;
    liqStartY = gasEndY;
    liqEndY = gasEndY + liqLen * scale;
  }

  // Tube walls with subtle gradient
  const wallGrad = ctx.createLinearGradient(tubeLeft, topY, tubeLeft + tubeW, topY);
  wallGrad.addColorStop(0, 'rgba(0,0,0,0.12)');
  wallGrad.addColorStop(0.1, 'rgba(0,0,0,0.04)');
  wallGrad.addColorStop(0.9, 'rgba(0,0,0,0.04)');
  wallGrad.addColorStop(1, 'rgba(0,0,0,0.12)');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(tubeLeft - 2, topY, 3, tubePixelH);
  ctx.fillRect(tubeLeft + tubeW - 1, topY, 3, tubePixelH);

  ctx.strokeStyle = COLORS.containerBorder;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(tubeLeft, topY);
  ctx.lineTo(tubeLeft, bottomY);
  ctx.lineTo(tubeLeft + tubeW, bottomY);
  ctx.lineTo(tubeLeft + tubeW, topY);
  ctx.stroke();

  if (isOpenDown) {
    ctx.beginPath();
    ctx.moveTo(tubeLeft, topY); ctx.lineTo(tubeLeft + tubeW, topY);
    ctx.stroke();
  }

  // Gas fill
  ctx.fillStyle = COLORS.gasFill;
  ctx.fillRect(tubeLeft + 2, gasStartY, tubeW - 4, gasEndY - gasStartY);

  // Gas molecules — more visible
  drawGasMolecules(ctx, tubeLeft + 2, gasStartY, tubeW - 4, gasEndY - gasStartY, 8, time);

  // Mercury with gradient
  drawMercuryGradient(ctx, tubeLeft + 2, liqStartY, tubeW - 4, liqEndY - liqStartY);

  // Dimension lines
  drawDimensionLine(ctx, tubeLeft + tubeW, gasStartY, gasEndY, `${gasLen.toFixed(1)} cm`, 'right');
  drawDimensionLine(ctx, tubeLeft, liqStartY, liqEndY, `${liqLen.toFixed(0)} cm`, 'left');

  // Pressure arrows — larger
  const arrowX = tubeLeft + tubeW / 2;
  if (!isOpenDown) {
    drawPressureArrow(ctx, arrowX - 16, liqStartY - 4, 35, 'down', 'P₀', COLORS.arrowPressure);
    drawPressureArrow(ctx, arrowX + 16, gasStartY + 4, 35, 'up', 'P_gas', COLORS.accentGreen);
  } else {
    drawPressureArrow(ctx, arrowX - 16, liqEndY + 4, 35, 'up', 'P₀', COLORS.arrowPressure);
    drawPressureArrow(ctx, arrowX + 16, gasEndY - 4, 35, 'down', 'P_gas', COLORS.accentGreen);
  }

  // Labels — larger fonts
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, bottomY + 22);

  ctx.font = CANVAS_FONTS.annotation;
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(`P = ${pGas.toFixed(1)} cmHg`, cx, bottomY + 40);
  ctx.fillText(`V = ${volume.toFixed(1)} cm³`, cx, bottomY + 58);
}

function drawHorizontalWorkbench(
  ctx: CanvasRenderingContext2D, canW: number, canH: number,
  L1: number, h: number, result: LiquidColumnResult,
  anim: number, area: number, time: number,
  T1: number, T2: number, teaching: LiquidColumnTeaching,
) {
  drawStageTitle(ctx, canW, '水平', teaching);
  const panelX = canW * 0.08;
  const panelY = 96;
  const panelW = canW * 0.61;
  const panelH = Math.min(420, canH - 150);
  drawTubeCard(ctx, panelX, panelY - 42, panelW, panelH + 82, '水平玻璃管', '液柱无竖直高度差：P = P₀', COLORS.accentGreen);

  const tubeX = panelX + 54;
  const tubeW = panelW - 108;
  const tubeH = 72;
  const y1 = panelY + 86;
  const y2 = panelY + 236;
  const maxLen = Math.max(result.L2, L1) + h + 10;
  const scale = tubeW / maxLen;
  const animL2 = L1 + (result.L2 - L1) * anim;

  drawHorizontalTube(ctx, tubeX, y1, tubeW, tubeH, scale, L1, h, '初始 T₁', result.P1, L1 * area, time, COLORS.isochoricLine);
  drawHorizontalTube(ctx, tubeX, y2, tubeW, tubeH, scale, animL2, h, '末状态 T₂', result.P2, animL2 * area, time, COLORS.arrowHeating);

  ctx.strokeStyle = COLORS.arrowHeating;
  ctx.lineWidth = 2;
  drawScreenArrow(ctx, tubeX + tubeW * 0.72, y1 + tubeH + 28, tubeX + tubeW * 0.72, y2 - 20, COLORS.arrowHeating, 2);
  ctx.fillStyle = COLORS.arrowHeating;
  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'center';
  ctx.fillText(T2 >= T1 ? '升温：气柱沿管伸长' : '降温：气柱沿管缩短', tubeX + tubeW * 0.72, (y1 + y2) / 2 + 12);

  drawLocalFormulaBadge(ctx, tubeX + 22, panelY + 18, '核心判断：P = P₀', '水平液柱不产生竖直液面差', COLORS.accentGreen);
  drawAnalysisCards(ctx, canW * 0.71, 96, canW * 0.24, teaching);
  drawEquationCheck(ctx, canW * 0.71, 310, canW * 0.24, teaching);
  drawThermometer(ctx, canW * 0.91, 116, T1, T2, anim);
}

function drawHorizontalTube(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, tubeH: number,
  scale: number, gasLen: number, liqLen: number,
  label: string, pGas: number, volume: number, time: number, accent: string,
) {
  const gasW = gasLen * scale;
  const liqW = liqLen * scale;
  const tubeY = y;
  roundRect(ctx, x, tubeY, w, tubeH, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fill();
  ctx.strokeStyle = COLORS.containerBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();

  ctx.fillStyle = COLORS.gasFill;
  ctx.fillRect(x + 3, tubeY + 3, gasW, tubeH - 6);
  drawGasMolecules(ctx, x + 3, tubeY + 3, gasW, tubeH - 6, 9, time);
  drawMercuryGradient(ctx, x + 3 + gasW, tubeY + 3, liqW, tubeH - 6);

  ctx.strokeStyle = 'rgba(35,45,55,0.28)';
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(x + 3 + gasW + liqW, tubeY + 8);
  ctx.lineTo(x + 3 + gasW + liqW, tubeY + tubeH - 8);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = accent;
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, tubeY - 16);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = CANVAS_FONTS.annotation;
  ctx.fillText(`L = ${gasLen.toFixed(1)} cm`, x + gasW / 2 - 24, tubeY + tubeH + 22);
  ctx.fillText(`液柱 ${liqLen.toFixed(0)} cm`, x + gasW + liqW / 2 - 28, tubeY + tubeH + 22);
  ctx.textAlign = 'right';
  ctx.fillText(`P = ${pGas.toFixed(1)} cmHg   V = ${volume.toFixed(1)} cm³`, x + w, tubeY - 16);
}

function drawTiltedWorkbench(
  ctx: CanvasRenderingContext2D, canW: number, canH: number,
  orientation: string, L1: number, h: number, result: LiquidColumnResult,
  anim: number, angle: number, area: number, time: number,
  T1: number, T2: number, teaching: LiquidColumnTeaching,
) {
  drawStageTitle(ctx, canW, orientation, teaching);
  const panelX = canW * 0.07;
  const panelY = 96;
  const panelW = canW * 0.62;
  const panelH = Math.min(440, canH - 150);
  drawTubeCard(ctx, panelX, panelY - 42, panelW, panelH + 82, '倾斜玻璃管', '压强只取竖直有效高度 hsinθ', COLORS.accentGreen);

  const lenPx = Math.min(560, panelW - 120);
  const tubeH = 72;
  const rad = angle * Math.PI / 180 * (orientation === '倾斜开口向上' ? -1 : 1);
  const maxLen = Math.max(result.L2, L1) + h + 8;
  const scale = lenPx / maxLen;
  const animL2 = L1 + (result.L2 - L1) * anim;
  const cx = panelX + panelW * 0.43;

  drawTiltedTube(ctx, cx, panelY + 150, lenPx, tubeH, rad, scale, L1, h, '初始 T₁', result.P1, L1 * area, time, COLORS.isochoricLine, angle);
  drawTiltedTube(ctx, cx, panelY + 318, lenPx, tubeH, rad, scale, animL2, h, '末状态 T₂', result.P2, animL2 * area, time, COLORS.arrowHeating, angle);

  const effH = getEffectiveHeight(h, orientation, angle);
  drawLocalFormulaBadge(ctx, panelX + 24, panelY + 18, `核心判断：h sinθ = ${effH.toFixed(1)} cm`, teaching.pressureFormula, COLORS.accentGreen);
  drawAnalysisCards(ctx, canW * 0.71, 96, canW * 0.24, teaching);
  drawEquationCheck(ctx, canW * 0.71, 310, canW * 0.24, teaching);
  drawThermometer(ctx, canW * 0.91, 116, T1, T2, anim);
}

function drawTiltedTube(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, lenPx: number, tubeH: number,
  rad: number, scale: number, gasLen: number, liqLen: number,
  label: string, pGas: number, volume: number, time: number, accent: string, angle: number,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rad);
  const x = -lenPx / 2;
  const y = -tubeH / 2;
  roundRect(ctx, x, y, lenPx, tubeH, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.72)';
  ctx.fill();
  ctx.strokeStyle = COLORS.containerBorder;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const gasW = gasLen * scale;
  const liqW = liqLen * scale;
  ctx.fillStyle = COLORS.gasFill;
  ctx.fillRect(x + 3, y + 3, gasW, tubeH - 6);
  drawGasMolecules(ctx, x + 3, y + 3, gasW, tubeH - 6, 8, time);
  drawMercuryGradient(ctx, x + 3 + gasW, y + 3, liqW, tubeH - 6);
  ctx.fillStyle = accent;
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x, y - 16);
  ctx.restore();

  const gasEndX = cx + Math.cos(rad) * (-lenPx / 2 + gasLen * scale);
  const gasEndY = cy + Math.sin(rad) * (-lenPx / 2 + gasLen * scale);
  const liqEndX = cx + Math.cos(rad) * (-lenPx / 2 + (gasLen + liqLen) * scale);
  const liqEndY = cy + Math.sin(rad) * (-lenPx / 2 + (gasLen + liqLen) * scale);
  ctx.strokeStyle = COLORS.dimensionLine;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(gasEndX, gasEndY);
  ctx.lineTo(liqEndX, liqEndY);
  ctx.moveTo(liqEndX, liqEndY);
  ctx.lineTo(liqEndX, gasEndY);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = COLORS.dimensionLine;
  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'left';
  ctx.fillText(`h = ${liqLen.toFixed(0)} cm`, (gasEndX + liqEndX) / 2 + 8, (gasEndY + liqEndY) / 2 - 8);
  ctx.fillText(`h sin${angle}°`, liqEndX + 8, (gasEndY + liqEndY) / 2);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = CANVAS_FONTS.annotation;
  ctx.fillText(`P = ${pGas.toFixed(1)} cmHg, V = ${volume.toFixed(1)} cm³`, cx - lenPx / 2, cy + tubeH / 2 + 34);
}

function drawLocalFormulaBadge(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  title: string, detail: string, color: string,
) {
  roundRect(ctx, x, y, 360, 64, 8);
  ctx.fillStyle = adjustAlpha(color, 0.12);
  ctx.fill();
  ctx.strokeStyle = adjustAlpha(color, 0.32);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 16px -apple-system, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(title, x + 14, y + 24);
  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = CANVAS_FONTS.annotation;
  ctx.fillText(detail.length > 34 ? `${detail.slice(0, 34)}...` : detail, x + 14, y + 46);
}

function drawUTube(
  ctx: CanvasRenderingContext2D, canW: number, canH: number,
  L1: number, h: number, result: LiquidColumnResult, anim: number, time: number,
) {
  const tubeW = 70;
  const armGap = 110;
  const cx = canW * 0.38;
  const topY = 118;
  const armHeight = Math.min(canH - 230, 470);

  const leftArmX = cx - armGap / 2 - tubeW;
  const rightArmX = cx + armGap / 2;
  const bottomY = topY + armHeight;
  const panelX = cx - armGap / 2 - tubeW - 74;
  const panelW = armGap + tubeW * 2 + 148;

  drawTubeCard(ctx, panelX, topY - 54, panelW, armHeight + 120, 'U 型管液柱模型', '看两臂液面高度差 Δh', COLORS.accentGreen);

  // U-tube walls
  ctx.strokeStyle = COLORS.containerBorder;
  ctx.lineWidth = 3;

  // Outer walls
  ctx.beginPath();
  ctx.moveTo(leftArmX, topY);
  ctx.lineTo(leftArmX, bottomY);
  ctx.arcTo(leftArmX, bottomY + 16, leftArmX + 16, bottomY + 16, 16);
  ctx.lineTo(rightArmX + tubeW - 16, bottomY + 16);
  ctx.arcTo(rightArmX + tubeW, bottomY + 16, rightArmX + tubeW, bottomY, 16);
  ctx.lineTo(rightArmX + tubeW, topY);
  ctx.stroke();

  // Inner walls
  ctx.beginPath();
  ctx.moveTo(leftArmX + tubeW, topY);
  ctx.lineTo(leftArmX + tubeW, bottomY - tubeW);
  ctx.lineTo(rightArmX, bottomY - tubeW);
  ctx.lineTo(rightArmX, topY);
  ctx.stroke();

  // Sealed end cap
  ctx.strokeStyle = COLORS.containerBorder;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(leftArmX, topY); ctx.lineTo(leftArmX + tubeW, topY);
  ctx.stroke();

  const scale = (armHeight - tubeW) / (L1 + h + 20);
  const hLeft = result.hLeft || h / 2;
  const hRight = result.hRight || h / 2;
  const animHL = h / 2 + (hLeft - h / 2) * anim;
  const animHR = h / 2 + (hRight - h / 2) * anim;
  const animL2 = L1 + ((result.L2 || L1) - L1) * anim;

  const liqBottomY = bottomY - tubeW;
  const leftLiqTop = liqBottomY - animHL * scale;
  const rightLiqTop = liqBottomY - animHR * scale;
  const deltaH = Math.abs(animHR - animHL);

  // Mercury in U-tube
  drawMercuryGradient(ctx, leftArmX + 2, leftLiqTop, tubeW - 4, liqBottomY - leftLiqTop);
  ctx.fillStyle = '#B0B0B0';
  ctx.fillRect(leftArmX + tubeW - 2, liqBottomY, rightArmX - leftArmX - tubeW + 4, tubeW - 2);
  drawMercuryGradient(ctx, rightArmX + 2, rightLiqTop, tubeW - 4, liqBottomY - rightLiqTop);

  // Gas
  const gasTopY = leftLiqTop - animL2 * scale;
  ctx.fillStyle = COLORS.gasFill;
  ctx.fillRect(leftArmX + 2, Math.max(topY + 2, gasTopY), tubeW - 4, leftLiqTop - Math.max(topY + 2, gasTopY));
  drawGasMolecules(ctx, leftArmX + 2, Math.max(topY + 2, gasTopY), tubeW - 4, leftLiqTop - Math.max(topY + 2, gasTopY), 5, time);

  // Labels
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('密封气体', leftArmX + tubeW / 2, topY - 18);
  ctx.fillText('开口端 P₀', rightArmX + tubeW / 2, topY - 18);

  // Dimension lines
  drawDimensionLine(ctx, leftArmX, Math.max(topY + 2, gasTopY), leftLiqTop, `L=${animL2.toFixed(1)}`, 'left');
  drawDimensionLine(ctx, rightArmX + tubeW, leftLiqTop, rightLiqTop, `Δh=${deltaH.toFixed(1)}`, 'right');

  ctx.strokeStyle = COLORS.arrowPressure;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]);
  ctx.beginPath();
  ctx.moveTo(leftArmX + tubeW + 8, leftLiqTop);
  ctx.lineTo(rightArmX - 8, leftLiqTop);
  ctx.moveTo(leftArmX + tubeW + 8, rightLiqTop);
  ctx.lineTo(rightArmX - 8, rightLiqTop);
  ctx.stroke();
  ctx.setLineDash([]);

  drawPressureArrow(ctx, rightArmX + tubeW / 2, rightLiqTop - 6, 36, 'down', 'P₀', COLORS.arrowPressure);
  drawPressureArrow(ctx, leftArmX + tubeW / 2, leftLiqTop + 6, 36, 'up', 'P_gas', COLORS.accentGreen);

  drawMiniResultStrip(ctx, panelX + 18, topY + armHeight + 78, panelW - 36, [
    `L₂ = ${animL2.toFixed(2)} cm`,
    `Δh = ${(result.deltaH ?? deltaH).toFixed(2)} cm`,
    `P₂ = ${result.P2.toFixed(1)} cmHg`,
  ], COLORS.accentGreen);
}

function drawDualSealedTube(
  ctx: CanvasRenderingContext2D, canW: number, canH: number,
  L1: number, h: number, result: LiquidColumnResult, anim: number, time: number,
) {
  const tubeW = 88;
  const topY = 118;
  const tubePixelH = Math.min(canH - 250, 470);
  const cx = canW * 0.38;

  const totalContent = L1 * 2 + h;
  const scale = tubePixelH / (totalContent * 1.2);

  const tubeLeft = cx - tubeW / 2;
  const bottomY = topY + tubePixelH;
  const panelX = cx - 150;
  const panelW = 300;

  drawTubeCard(ctx, panelX, topY - 54, panelW, tubePixelH + 120, '两端密封模型', '中间液柱平衡：P上 = P下', COLORS.arrowHeating);

  ctx.strokeStyle = COLORS.containerBorder;
  ctx.lineWidth = 3;
  ctx.strokeRect(tubeLeft, topY, tubeW, tubePixelH);

  // Sealed ends
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(tubeLeft, topY); ctx.lineTo(tubeLeft + tubeW, topY);
  ctx.moveTo(tubeLeft, bottomY); ctx.lineTo(tubeLeft + tubeW, bottomY);
  ctx.stroke();

  const L2Left = result.L2Left || L1;
  const L2Right = result.L2Right || L1;
  const animLLeft = L1 + (L2Left - L1) * anim;
  const animLRight = L1 + (L2Right - L1) * anim;

  const gasTopEndY = topY + animLLeft * scale;
  const liqTopY = gasTopEndY;
  const liqBottomY = liqTopY + h * scale;
  const gasBottomStartY = liqBottomY;

  // Top gas
  ctx.fillStyle = COLORS.gasFill;
  ctx.fillRect(tubeLeft + 2, topY + 2, tubeW - 4, gasTopEndY - topY - 2);
  drawGasMolecules(ctx, tubeLeft + 2, topY + 2, tubeW - 4, gasTopEndY - topY - 2, 5, time);

  // Mercury
  drawMercuryGradient(ctx, tubeLeft + 2, liqTopY, tubeW - 4, liqBottomY - liqTopY);

  // Bottom gas
  ctx.fillStyle = COLORS.gasFill;
  ctx.fillRect(tubeLeft + 2, gasBottomStartY, tubeW - 4, bottomY - gasBottomStartY - 2);
  drawGasMolecules(ctx, tubeLeft + 2, gasBottomStartY, tubeW - 4, bottomY - gasBottomStartY - 2, 5, time);

  // Dimension lines
  drawDimensionLine(ctx, tubeLeft + tubeW, topY, gasTopEndY, `L热=${animLLeft.toFixed(1)}`, 'right');
  drawDimensionLine(ctx, tubeLeft + tubeW, liqTopY, liqBottomY, `h=${h}`, 'right');
  drawDimensionLine(ctx, tubeLeft + tubeW, gasBottomStartY, bottomY, `L冷=${animLRight.toFixed(1)}`, 'right');

  // Labels
  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('加热端密封气体', cx, (topY + gasTopEndY) / 2 + 4);
  ctx.fillText('冷端密封气体', cx, (gasBottomStartY + bottomY) / 2 + 4);

  ctx.fillStyle = COLORS.arrowHeating;
  ctx.font = CANVAS_FONTS.label;
  ctx.fillText('↑ 加热', cx, topY - 12);

  drawPressureArrow(ctx, tubeLeft - 28, liqTopY + 8, 34, 'down', 'P热', COLORS.arrowPressure);
  drawPressureArrow(ctx, tubeLeft + tubeW + 28, liqBottomY - 8, 34, 'up', 'P冷', COLORS.accentGreen);
  drawMiniResultStrip(ctx, panelX + 18, topY + tubePixelH + 78, panelW - 36, [
    `L热=${animLLeft.toFixed(2)} cm`,
    `L冷=${animLRight.toFixed(2)} cm`,
    `P=${result.P2.toFixed(1)} cmHg`,
  ], COLORS.arrowHeating);
}

function drawThermometer(
  ctx: CanvasRenderingContext2D, x: number, y: number,
  T1: number, T2: number, anim: number,
) {
  const thermW = 20;
  const thermH = 100;
  const bulbR = 12;

  const currentT = T1 + (T2 - T1) * anim;
  const tMin = 200, tMax = 600;
  const fill = clamp((currentT - tMin) / (tMax - tMin), 0.05, 0.95);

  ctx.strokeStyle = COLORS.containerBorder;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(x + thermW / 2, y + thermH + bulbR, bulbR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(x + 3, y, thermW - 6, thermH);

  // Scale marks
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 0.8;
  for (let i = 0; i <= 4; i++) {
    const markY = y + thermH - (thermH * i / 4);
    ctx.beginPath();
    ctx.moveTo(x + thermW - 4, markY);
    ctx.lineTo(x + thermW + 2, markY);
    ctx.stroke();
  }

  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.arc(x + thermW / 2, y + thermH + bulbR, bulbR - 2, 0, Math.PI * 2);
  ctx.fill();

  const fillH = fill * (thermH - 4);
  ctx.fillStyle = '#E53935';
  ctx.fillRect(x + 5, y + thermH - 2 - fillH, thermW - 10, fillH + 2);

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'center';
  ctx.fillText(`${currentT.toFixed(0)}K`, x + thermW / 2, y - 8);
}

function buildCalcSteps(
  orientation: string, T1: number, T2: number, L1: number, h: number,
  angle: number, area: number, P0: number,
): CalcStep[] {
  const steps: CalcStep[] = [];
  const effH = getEffectiveHeight(h, orientation, angle);

  steps.push({ text: `已知条件:` });
  steps.push({ text: `  P₀ = ${P0} cmHg, h = ${h} cm, S = ${area.toFixed(1)} cm²` });
  steps.push({ text: `  T₁ = ${T1} K, T₂ = ${T2} K, L₁ = ${L1} cm` });

  if (orientation === 'U型管') {
    steps.push({ text: '' });
    steps.push({ text: 'U型管: 初始两臂液面等高，密封气体压强等于大气压' });
    steps.push({ text: `P₁ = P₀ = ${P0} cmHg` });
    steps.push({ text: '' });
    steps.push({ text: '升温后左液面下降 x，右液面上升 x，所以 Δh = 2x = 2(L₂-L₁)' });
    steps.push({ text: '末态压强: P₂ = P₀ + Δh' });
    steps.push({ text: '联立气体状态方程: P₁L₁/T₁ = P₂L₂/T₂' });
    const result = solveLiquidColumn(orientation, T1, T2, L1, h, angle, area, P0);
    steps.push({ text: `L₂ = ${result.L2.toFixed(2)} cm`, highlight: true });
    steps.push({ text: `Δh = ${(result.deltaH ?? 0).toFixed(2)} cm, P₂ = ${result.P2.toFixed(1)} cmHg`, highlight: true });
    steps.push({ text: `验证: ${(result.P1 * result.V1 / T1).toFixed(4)} = ${(result.P2 * result.V2 / T2).toFixed(4)}` });
    return steps;
  }

  if (orientation === '两端密封') {
    steps.push({ text: '' });
    steps.push({ text: '两端密封: 中间液柱两侧各有气柱' });
    steps.push({ text: `初始: L左 = L右 = ${L1} cm` });
    steps.push({ text: '' });
    steps.push({ text: '加热一端、另一端保持 T₁:' });
    steps.push({ text: '  P热·L₂热 / T₂ = P₁·L₁ / T₁  ...(1)' });
    steps.push({ text: '  P冷·L₂冷 / T₁ = P₁·L₁ / T₁  ...(2)' });
    steps.push({ text: '  P热 = P冷  ...(3) 液柱平衡' });
    steps.push({ text: '  L₂热 + L₂冷 = 2L₁  ...(4)' });
    steps.push({ text: '' });
    const result = solveLiquidColumn(orientation, T1, T2, L1, h, angle, area, P0);
    steps.push({ text: `联立求解:`, highlight: true });
    steps.push({ text: `  L₂热 = ${(result.L2Left || 0).toFixed(2)} cm`, highlight: true });
    steps.push({ text: `  L₂冷 = ${(result.L2Right || 0).toFixed(2)} cm`, highlight: true });
    steps.push({ text: `  P₂ = ${result.P2.toFixed(1)} cmHg`, highlight: true });
    steps.push({ text: `验证: ${(result.P1 * result.V1 / T1).toFixed(4)} = ${(result.P2 * result.V2 / T2).toFixed(4)}` });
    return steps;
  }

  steps.push({ text: '' });

  let pressureText: string;
  let P1: number;
  if (orientation === '竖直开口向上') {
    P1 = P0 + effH;
    pressureText = `P₁ = P₀ + h = ${P0} + ${effH.toFixed(1)} = ${P1.toFixed(1)} cmHg`;
  } else if (orientation === '竖直开口向下') {
    P1 = P0 - effH;
    pressureText = `P₁ = P₀ - h = ${P0} - ${effH.toFixed(1)} = ${P1.toFixed(1)} cmHg`;
  } else if (orientation === '倾斜开口向上') {
    P1 = P0 + effH;
    pressureText = `P₁ = P₀ + h·sinθ = ${P0} + ${h}×sin${angle}° = ${P1.toFixed(1)} cmHg`;
  } else if (orientation === '倾斜开口向下') {
    P1 = P0 - effH;
    pressureText = `P₁ = P₀ - h·sinθ = ${P0} - ${h}×sin${angle}° = ${P1.toFixed(1)} cmHg`;
  } else {
    P1 = P0;
    pressureText = `P₁ = P₀ = ${P0} cmHg (水平)`;
  }
  steps.push({ text: pressureText });
  steps.push({ text: `P₂ = P₁ = ${P1.toFixed(1)} cmHg (液柱长不变)` });

  steps.push({ text: '' });
  steps.push({ text: '由气体定律:' });
  steps.push({ text: `P₁·L₁/T₁ = P₂·L₂/T₂` });

  const L2 = P1 * L1 * T2 / (T1 * P1);
  const V1 = L1 * area;
  const V2 = L2 * area;

  steps.push({ text: `L₂ = P₁·L₁·T₂ / (T₁·P₂)` });
  steps.push({ text: `   = ${P1.toFixed(1)}×${L1}×${T2} / (${T1}×${P1.toFixed(1)})` });
  steps.push({ text: `L₂ = ${L2.toFixed(2)} cm`, highlight: true });
  steps.push({ text: `V₂ = L₂·S = ${L2.toFixed(2)}×${area.toFixed(1)} = ${V2.toFixed(1)} cm³` });

  steps.push({ text: '' });
  const check1 = (P1 * L1 / T1).toFixed(4);
  const check2 = (P1 * L2 / T2).toFixed(4);
  steps.push({ text: `验证: P₁L₁/T₁ = ${check1}` });
  steps.push({ text: `      P₂L₂/T₂ = ${check2}` });

  return steps;
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
