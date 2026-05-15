import type { ThermoState, SceneModule, RenderContext, StateDisplayData, CalcStep } from '../types';
import { COLORS, CANVAS_FONTS } from '../theme';
import { clamp } from '../params';
import { drawBallAtScreen } from '../renderHelpers';

const g = 9.8;

function drawGasMolecules(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
  count: number, time: number,
) {
  if (h < 10 || w < 10) return;
  for (let i = 0; i < count; i++) {
    const bx = x + (w * 0.12) + (w * 0.76) * ((i * 0.618 + 0.1) % 1);
    const by = y + (h * 0.12) + (h * 0.76) * ((i * 0.382 + 0.3) % 1);
    const jx = Math.sin(time * 2.5 + i * 7.31) * 5;
    const jy = Math.cos(time * 1.8 + i * 4.97) * 5;
    const px = clamp(bx + jx, x + 6, x + w - 6);
    const py = clamp(by + jy, y + 6, y + h - 6);
    drawBallAtScreen(ctx, px, py, 5, '#42A5F5', { alpha: 0.75 });
  }
}

export const pistonCylinderScene: SceneModule = {
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

    const mode = String(params.pcMode) || '单活塞';
    const orientation = String(params.cylinderOrientation) || '竖直';
    const T1 = Number(params.pcT1) || 300;
    const T2 = Number(params.pcT2) || 450;
    const pistonMass = Number(params.pcPistonMass) || 1.0;
    const S = Number(params.pcArea) || 10;
    const L1 = Number(params.pcL1) || 20;
    const P0 = Number(params.pcPAtm) || 101;

    const canW = rctx.canvasWidth;
    const canH = rctx.canvasHeight;
    const anim = clamp(state.animProgress || 0, 0, 1);

    if (mode === '双活塞') {
      renderDualPiston(ctx, canW, canH, params, anim, state.t);
    } else if (orientation === '竖直') {
      renderVerticalSingle(ctx, canW, canH, T1, T2, pistonMass, S, L1, P0, anim, state.t);
    } else {
      renderHorizontalSingle(ctx, canW, canH, T1, T2, pistonMass, S, L1, P0, anim, state.t);
    }

    drawThermometer(ctx, 30, 60, T1, T2, anim);
  },

  getStateDisplay(params): StateDisplayData {
    const mode = String(params.pcMode) || '单活塞';
    const orientation = String(params.cylinderOrientation) || '竖直';
    const T1 = Number(params.pcT1) || 300;
    const T2 = Number(params.pcT2) || 450;
    const pistonMass = Number(params.pcPistonMass) || 1.0;
    const S = Number(params.pcArea) || 10;
    const L1 = Number(params.pcL1) || 20;
    const P0 = Number(params.pcPAtm) || 101;

    const result = solvePC(mode, orientation, T1, T2, pistonMass, S, L1, P0, params);
    const entries: { label: string; value: string; highlight?: boolean }[] = [
      { label: 'P₁', value: `${result.P1.toFixed(2)} kPa` },
    ];
    if (mode === '双活塞') {
      entries.push({ label: 'L左₂', value: `${result.L2Left.toFixed(2)} cm`, highlight: true });
      entries.push({ label: 'L右₂', value: `${result.L2Right.toFixed(2)} cm`, highlight: true });
    } else {
      entries.push({ label: 'L₂', value: `${result.L2.toFixed(2)} cm`, highlight: true });
    }
    entries.push({ label: 'V₂', value: `${result.V2.toFixed(1)} cm³`, highlight: true });
    return {
      p: result.P1,
      V: result.V1,
      T: T1,
      pvOverT: result.P1 * result.V1 / T1,
      customEntries: entries,
    };
  },

  getCalcSteps(params): CalcStep[] {
    const mode = String(params.pcMode) || '单活塞';
    const orientation = String(params.cylinderOrientation) || '竖直';
    const T1 = Number(params.pcT1) || 300;
    const T2 = Number(params.pcT2) || 450;
    const pistonMass = Number(params.pcPistonMass) || 1.0;
    const S = Number(params.pcArea) || 10;
    const L1 = Number(params.pcL1) || 20;
    const P0 = Number(params.pcPAtm) || 101;

    return buildCalcSteps(mode, orientation, T1, T2, pistonMass, S, L1, P0, params);
  },
};

interface PCResult {
  P1: number; P2: number; L2: number; V1: number; V2: number;
  L2Left: number; L2Right: number;
}

function solvePC(
  mode: string, orientation: string,
  T1: number, T2: number, pistonMass: number,
  S: number, L1: number, P0: number,
  params: Record<string, number | string | boolean>,
): PCResult {
  const Sm2 = S * 1e-4;

  if (mode === '双活塞') {
    const heatPos = String(params.pcHeatPosition) || '中间';
    const P1 = P0;
    let L2Left: number, L2Right: number;
    if (heatPos === '左') {
      L2Left = L1 * T2 / T1;
      L2Right = L1;
    } else if (heatPos === '右') {
      L2Left = L1;
      L2Right = L1 * T2 / T1;
    } else {
      L2Left = L1 * T2 / T1;
      L2Right = L1 * T2 / T1;
    }
    const V1 = 2 * L1 * S;
    const V2 = (L2Left + L2Right) * S;
    return { P1, P2: P1, L2: (L2Left + L2Right) / 2, V1, V2, L2Left, L2Right };
  }

  let P1: number;
  if (orientation === '竖直') {
    const mgOverS = (pistonMass * g) / Sm2 / 1000;
    P1 = P0 + mgOverS;
  } else {
    P1 = P0;
  }
  const P2 = P1;
  const L2 = L1 * T2 / T1;
  return { P1, P2, L2, V1: L1 * S, V2: L2 * S, L2Left: L2, L2Right: L2 };
}

function drawCylinderWalls(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number,
) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.10)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  ctx.fillStyle = COLORS.canvasBg;
  ctx.fillRect(x, y, w, h);
  ctx.restore();

  const fillGrad = ctx.createLinearGradient(x, y, x, y + h);
  fillGrad.addColorStop(0, 'rgba(144,202,249,0.03)');
  fillGrad.addColorStop(1, 'rgba(144,202,249,0.08)');
  ctx.fillStyle = fillGrad;
  ctx.fillRect(x, y, w, h);

  const wallGrad = ctx.createLinearGradient(x, y, x + w, y);
  wallGrad.addColorStop(0, 'rgba(0,0,0,0.14)');
  wallGrad.addColorStop(0.04, 'rgba(0,0,0,0.04)');
  wallGrad.addColorStop(0.96, 'rgba(0,0,0,0.04)');
  wallGrad.addColorStop(1, 'rgba(0,0,0,0.14)');
  ctx.fillStyle = wallGrad;
  ctx.fillRect(x - 3, y, 5, h);
  ctx.fillRect(x + w - 2, y, 5, h);

  ctx.strokeStyle = COLORS.containerBorder;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y); ctx.lineTo(x, y + h);
  ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y);
  ctx.stroke();
}

function drawPiston(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number,
  isHorizontal: boolean,
) {
  const thickness = 16;
  const grad = isHorizontal
    ? ctx.createLinearGradient(x, y, x + thickness, y)
    : ctx.createLinearGradient(x, y, x, y + thickness);
  grad.addColorStop(0, '#A1887F');
  grad.addColorStop(0.3, '#8D6E63');
  grad.addColorStop(0.7, COLORS.piston);
  grad.addColorStop(1, '#4E342E');

  if (isHorizontal) {
    ctx.fillStyle = grad;
    ctx.fillRect(x, y + 3, thickness, w - 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 6);
    ctx.lineTo(x + 2, y + w - 6);
    ctx.stroke();
  } else {
    ctx.fillStyle = grad;
    ctx.fillRect(x + 3, y, w - 6, thickness);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 6, y + 2);
    ctx.lineTo(x + w - 6, y + 2);
    ctx.stroke();
    const nubW = 18, nubH = 7;
    const cx = x + w / 2;
    ctx.fillStyle = '#6D4C41';
    ctx.fillRect(cx - nubW / 2, y - nubH, nubW, nubH);
  }
}

function drawForceArrow(
  ctx: CanvasRenderingContext2D, x: number, y1: number, y2: number,
  color: string, label: string, labelSide: 'left' | 'right',
) {
  const down = y2 > y1;
  const len = Math.abs(y2 - y1);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x, y1);
  ctx.lineTo(x, y2);
  ctx.stroke();

  const headLen = Math.min(10, len * 0.35);
  ctx.beginPath();
  ctx.moveTo(x - 6, y2 + (down ? -headLen : headLen));
  ctx.lineTo(x, y2);
  ctx.lineTo(x + 6, y2 + (down ? -headLen : headLen));
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width;
  const padH = 6, padV = 4;
  const lx = labelSide === 'left' ? x - tw / 2 - padH - 12 : x + tw / 2 + padH + 12;
  const ly = (y1 + y2) / 2;

  ctx.fillStyle = color.replace(')', ',0.1)').replace('rgb(', 'rgba(');
  ctx.beginPath();
  ctx.roundRect(lx - tw / 2 - padH, ly - 9 - padV, tw + padH * 2, 18 + padV * 2, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(label, lx, ly + 5);
}

function drawForceArrows(
  ctx: CanvasRenderingContext2D, cx: number, pistonY: number,
  _P0: number, _pistonMass: number, _S: number, _P1: number,
) {
  drawForceArrow(ctx, cx - 24, pistonY - 4, pistonY + 32, COLORS.arrowForce, 'mg', 'left');
  drawForceArrow(ctx, cx + 24, pistonY - 48, pistonY - 12, COLORS.arrowPressure, 'P₀S', 'right');
  drawForceArrow(ctx, cx, pistonY + 26, pistonY - 8, COLORS.accentGreen, 'PS', 'left');
}

function drawHForceArrow(
  ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number,
  color: string, label: string, labelAbove: boolean,
) {
  const right = x2 > x1;
  const len = Math.abs(x2 - x1);

  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x1, y);
  ctx.lineTo(x2, y);
  ctx.stroke();

  const headLen = Math.min(10, len * 0.35);
  ctx.beginPath();
  ctx.moveTo(x2 + (right ? -headLen : headLen), y - 6);
  ctx.lineTo(x2, y);
  ctx.lineTo(x2 + (right ? -headLen : headLen), y + 6);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'center';
  const tw = ctx.measureText(label).width;
  const padH = 6, padV = 4;
  const lx = (x1 + x2) / 2;
  const ly = labelAbove ? y - 18 : y + 18;

  ctx.fillStyle = color.replace(')', ',0.1)').replace('rgb(', 'rgba(');
  ctx.beginPath();
  ctx.roundRect(lx - tw / 2 - padH, ly - 9 - padV, tw + padH * 2, 18 + padV * 2, 4);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillText(label, lx, ly + 5);
}

function drawHeatingWaves(
  ctx: CanvasRenderingContext2D, x: number, y: number, h: number, time: number,
) {
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const wave_y = y + h * 0.2 + h * 0.3 * i;
    const alpha = 0.6 + 0.4 * Math.sin(time * 3 + i * 2);
    ctx.strokeStyle = `rgba(230,81,0,${alpha.toFixed(2)})`;
    ctx.beginPath();
    for (let px = 0; px < 40; px++) {
      const wx = x + px;
      const wy = wave_y + Math.sin((px + time * 60 + i * 20) * 0.25) * 5;
      if (px === 0) ctx.moveTo(wx, wy); else ctx.lineTo(wx, wy);
    }
    ctx.stroke();
  }
}

function renderVerticalSingle(
  ctx: CanvasRenderingContext2D, canW: number, canH: number,
  T1: number, T2: number, pistonMass: number,
  S: number, L1: number, P0: number, anim: number, time: number,
) {
  const Sm2 = S * 1e-4;
  const mgOverS = (pistonMass * g) / Sm2 / 1000;
  const P1 = P0 + mgOverS;
  const L2 = L1 * T2 / T1;
  const animL2 = L1 + (L2 - L1) * anim;

  const cylW = 130;
  const maxCylH = Math.min(280, canH - 160);
  const maxL = Math.max(L1, L2, 1) * 1.3;
  const cylTop = 50;
  const cylBottom = cylTop + maxCylH;

  function drawCyl(cx: number, gasLen: number, label: string, temp: number, showForces: boolean) {
    const cylLeft = cx - cylW / 2;
    const gasPixH = (gasLen / maxL) * maxCylH;
    const gasTop = cylBottom - gasPixH;

    drawCylinderWalls(ctx, cylLeft, cylTop, cylW, maxCylH);

    // Closed bottom — metallic rim
    ctx.strokeStyle = COLORS.containerBorder;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(cylLeft, cylBottom); ctx.lineTo(cylLeft + cylW, cylBottom);
    ctx.stroke();

    // Heating waves at bottom
    if (showForces && T2 > T1) {
      drawHeatingWaves(ctx, cylLeft + cylW / 2 - 20, cylBottom + 6, 24, time);
    }

    // Gas
    ctx.fillStyle = COLORS.gasFill;
    ctx.fillRect(cylLeft + 2, gasTop, cylW - 4, cylBottom - gasTop - 2);
    drawGasMolecules(ctx, cylLeft + 2, gasTop + 16, cylW - 4, cylBottom - gasTop - 18, 10, time);

    // Piston
    drawPiston(ctx, cylLeft, gasTop - 16, cylW, false);

    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = CANVAS_FONTS.annotation;
    ctx.textAlign = 'center';
    ctx.fillText(`m=${pistonMass}kg`, cx, gasTop - 22);

    if (showForces) {
      drawForceArrows(ctx, cx, gasTop, P0, pistonMass, S, P1);
    }

    // Dimension line
    ctx.strokeStyle = COLORS.dimensionLine;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(cylLeft + cylW + 14, gasTop);
    ctx.lineTo(cylLeft + cylW + 14, cylBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(cylLeft + cylW + 8, gasTop); ctx.lineTo(cylLeft + cylW + 20, gasTop);
    ctx.moveTo(cylLeft + cylW + 8, cylBottom); ctx.lineTo(cylLeft + cylW + 20, cylBottom);
    ctx.stroke();
    ctx.fillStyle = COLORS.dimensionLine;
    ctx.font = CANVAS_FONTS.label;
    ctx.textAlign = 'left';
    ctx.fillText(`${gasLen.toFixed(1)}cm`, cylLeft + cylW + 22, (gasTop + cylBottom) / 2 + 5);

    // Labels below
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = CANVAS_FONTS.title;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, cylBottom + 26);
    ctx.font = CANVAS_FONTS.annotation;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`T = ${temp.toFixed(0)} K`, cx, cylBottom + 44);
    ctx.fillText(`P = ${P1.toFixed(2)} kPa`, cx, cylBottom + 60);
    ctx.fillText(`V = ${(gasLen * S).toFixed(1)} cm³`, cx, cylBottom + 76);
  }

  drawCyl(canW * 0.22, L1, '初始状态', T1, true);
  drawCyl(canW * 0.55, animL2, T2 > T1 ? '加热后' : '冷却后', T1 + (T2 - T1) * anim, false);

  if (T2 !== T1) {
    drawTransitionArrow(ctx, canW * 0.35, canW * 0.42, cylTop + maxCylH / 2, T2 > T1 ? '加热' : '冷却');
  }
}

function renderHorizontalSingle(
  ctx: CanvasRenderingContext2D, canW: number, _canH: number,
  T1: number, T2: number, _pistonMass: number,
  S: number, L1: number, P0: number, anim: number, time: number,
) {
  const L2 = L1 * T2 / T1;
  const animL2 = L1 + (L2 - L1) * anim;

  const maxCylW = Math.min(300, (canW - 100) / 2);
  const cylH = 110;
  const maxL = Math.max(L1, L2, 1) * 1.3;

  function drawHCyl(cx: number, gasLen: number, label: string, temp: number, showForces: boolean) {
    const hLeft = cx - maxCylW / 2;
    const hTop = 80;
    const hBot = hTop + cylH;
    const gasPixW = (gasLen / maxL) * maxCylW;

    drawCylinderWalls(ctx, hLeft, hTop, maxCylW, cylH);

    // Closed left wall — metallic
    ctx.strokeStyle = COLORS.containerBorder;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(hLeft, hTop); ctx.lineTo(hLeft, hBot);
    ctx.stroke();

    // Heating waves
    if (T2 > T1) {
      drawHeatingWaves(ctx, hLeft - 42, hTop + 12, cylH - 24, time);
    }

    // Gas
    ctx.fillStyle = COLORS.gasFill;
    ctx.fillRect(hLeft + 2, hTop + 2, gasPixW - 2, cylH - 4);
    drawGasMolecules(ctx, hLeft + 4, hTop + 4, gasPixW - 8, cylH - 8, 10, time);

    // Piston
    drawPiston(ctx, hLeft + gasPixW, hTop, cylH, true);

    // Horizontal force arrows on the piston
    if (showForces) {
      const pistonCx = hLeft + gasPixW + 8;
      const pistonMidY = hTop + cylH / 2;
      drawHForceArrow(ctx, pistonCx - 40, pistonCx - 4, pistonMidY - 16, COLORS.accentGreen, 'PS', true);
      drawHForceArrow(ctx, pistonCx + 40, pistonCx + 4, pistonMidY + 16, COLORS.arrowPressure, 'P₀S', false);
    }

    // Labels
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = CANVAS_FONTS.title;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, hBot + 26);
    ctx.font = CANVAS_FONTS.annotation;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`T=${temp.toFixed(0)}K  P=${P0.toFixed(1)}kPa  L=${gasLen.toFixed(1)}cm`, cx, hBot + 44);
    ctx.fillText(`V=${(gasLen * S).toFixed(1)} cm³`, cx, hBot + 60);
  }

  drawHCyl(canW * 0.22, L1, '初始状态', T1, true);
  drawHCyl(canW * 0.58, animL2, T2 > T1 ? '加热后' : '冷却后', T1 + (T2 - T1) * anim, false);
}

function renderDualPiston(
  ctx: CanvasRenderingContext2D, canW: number, _canH: number,
  params: Record<string, number | string | boolean>, anim: number, time: number,
) {
  const T1 = Number(params.pcT1) || 300;
  const T2 = Number(params.pcT2) || 450;
  const S = Number(params.pcArea) || 10;
  const L1 = Number(params.pcL1) || 20;
  const mLeft = Number(params.pcPistonMassLeft) || 1.0;
  const mRight = Number(params.pcPistonMassRight) || 1.0;
  const heatPos = String(params.pcHeatPosition) || '中间';

  const result = solvePC('双活塞', '', T1, T2, 0, S, L1, Number(params.pcPAtm) || 101, params);
  const animLLeft = L1 + (result.L2Left - L1) * anim;
  const animLRight = L1 + (result.L2Right - L1) * anim;

  const frameW = Math.min(300, (canW - 60) / 2);
  const frameH = 110;
  const pistonW = 16;
  const maxHL = Math.max(result.L2Left, result.L2Right, L1, 1) * 1.3;

  function drawDualState(
    cx: number, leftLen: number, rightLen: number,
    label: string, leftTemp: number, rightTemp: number, showForces: boolean,
  ) {
    const gasPixLeft = (leftLen / maxHL) * (frameW / 2 - pistonW);
    const gasPixRight = (rightLen / maxHL) * (frameW / 2 - pistonW);
    const left = cx - frameW / 2;
    const top = 80;
    const midX = left + frameW / 2;

    drawCylinderWalls(ctx, left, top, frameW, frameH);

    // Central divider
    ctx.strokeStyle = COLORS.containerBorder;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(midX, top + 2);
    ctx.lineTo(midX, top + frameH - 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Left gas
    ctx.fillStyle = COLORS.gasFill;
    ctx.fillRect(midX - gasPixLeft, top + 2, gasPixLeft, frameH - 4);
    drawGasMolecules(ctx, midX - gasPixLeft + 2, top + 4, gasPixLeft - 4, frameH - 8, 6, time);

    // Right gas
    ctx.fillStyle = COLORS.gasFill;
    ctx.fillRect(midX, top + 2, gasPixRight, frameH - 4);
    drawGasMolecules(ctx, midX + 2, top + 4, gasPixRight - 4, frameH - 8, 6, time + 100);

    // Left piston
    const lpx = midX - gasPixLeft - pistonW;
    const lGrad = ctx.createLinearGradient(lpx, top, lpx + pistonW, top);
    lGrad.addColorStop(0, '#4E342E');
    lGrad.addColorStop(0.3, COLORS.piston);
    lGrad.addColorStop(0.7, '#8D6E63');
    lGrad.addColorStop(1, '#A1887F');
    ctx.fillStyle = lGrad;
    ctx.fillRect(lpx, top + 3, pistonW, frameH - 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(lpx + pistonW - 2, top + 6);
    ctx.lineTo(lpx + pistonW - 2, top + frameH - 6);
    ctx.stroke();

    // Right piston
    const rpx = midX + gasPixRight;
    const rGrad = ctx.createLinearGradient(rpx, top, rpx + pistonW, top);
    rGrad.addColorStop(0, '#A1887F');
    rGrad.addColorStop(0.3, '#8D6E63');
    rGrad.addColorStop(0.7, COLORS.piston);
    rGrad.addColorStop(1, '#4E342E');
    ctx.fillStyle = rGrad;
    ctx.fillRect(rpx, top + 3, pistonW, frameH - 6);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(rpx + 2, top + 6);
    ctx.lineTo(rpx + 2, top + frameH - 6);
    ctx.stroke();

    // Heating waves on the correct side
    if (T2 > T1) {
      if (heatPos === '左' || heatPos === '中间') {
        drawHeatingWaves(ctx, left - 42, top + 12, frameH - 24, time);
      }
      if (heatPos === '右' || heatPos === '中间') {
        drawHeatingWaves(ctx, left + frameW + 4, top + 12, frameH - 24, time);
      }
    }

    // Force arrows on initial state
    if (showForces) {
      const midY = top + frameH / 2;
      const lpCx = lpx + pistonW / 2;
      drawHForceArrow(ctx, lpCx - 36, lpCx - 2, midY - 14, COLORS.arrowPressure, 'P₀S', true);
      drawHForceArrow(ctx, lpCx + 2, lpCx + 30, midY + 14, COLORS.accentGreen, 'PS', false);
      const rpCx = rpx + pistonW / 2;
      drawHForceArrow(ctx, rpCx - 30, rpCx - 2, midY - 14, COLORS.accentGreen, 'PS', true);
      drawHForceArrow(ctx, rpCx + 2, rpCx + 36, midY + 14, COLORS.arrowPressure, 'P₀S', false);
    }

    // Mass labels
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = CANVAS_FONTS.annotation;
    ctx.textAlign = 'center';
    ctx.fillText(`M₁=${mLeft}kg`, lpx + pistonW / 2, top - 10);
    ctx.fillText(`M₂=${mRight}kg`, rpx + pistonW / 2, top - 10);

    // Temperature labels per side
    ctx.fillStyle = COLORS.textDim;
    ctx.font = CANVAS_FONTS.small;
    ctx.fillText(`${leftTemp.toFixed(0)}K`, midX - gasPixLeft / 2, top + frameH - 8);
    ctx.fillText(`${rightTemp.toFixed(0)}K`, midX + gasPixRight / 2, top + frameH - 8);

    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = CANVAS_FONTS.title;
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, top + frameH + 26);
    ctx.font = CANVAS_FONTS.annotation;
    ctx.fillStyle = COLORS.textSecondary;
    const totalL = leftLen + rightLen;
    ctx.fillText(`L左=${leftLen.toFixed(1)}  L右=${rightLen.toFixed(1)}  V=${(totalL*S).toFixed(1)}cm³`, cx, top + frameH + 44);
  }

  const leftTempInit = T1, rightTempInit = T1;
  const leftTempFinal = (heatPos === '左' || heatPos === '中间') ? T2 : T1;
  const rightTempFinal = (heatPos === '右' || heatPos === '中间') ? T2 : T1;

  drawDualState(canW * 0.22, L1, L1, '初始状态', leftTempInit, rightTempInit, true);
  drawDualState(
    canW * 0.58, animLLeft, animLRight,
    T2 > T1 ? '加热后' : '冷却后',
    leftTempInit + (leftTempFinal - leftTempInit) * anim,
    rightTempInit + (rightTempFinal - rightTempInit) * anim,
    false,
  );

  if (T2 !== T1) {
    drawTransitionArrow(ctx, canW * 0.37, canW * 0.43, 122, T2 > T1 ? '加热' : '冷却');
  }
}

function drawTransitionArrow(
  ctx: CanvasRenderingContext2D, x1: number, x2: number, y: number, label: string,
) {
  ctx.strokeStyle = COLORS.arrowHeating;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x1, y); ctx.lineTo(x2, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2 - 9, y - 6); ctx.lineTo(x2, y); ctx.lineTo(x2 - 9, y + 6);
  ctx.fillStyle = COLORS.arrowHeating;
  ctx.fill();
  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.arrowHeating;
  ctx.fillText(label, (x1 + x2) / 2, y - 12);
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
  ctx.strokeRect(x + 2, y, thermW - 4, thermH);

  // Scale marks
  ctx.strokeStyle = COLORS.textDim;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const my = y + thermH - 4 - (thermH - 8) * (i / 4);
    ctx.beginPath();
    ctx.moveTo(x + thermW - 4, my);
    ctx.lineTo(x + thermW + 4, my);
    ctx.stroke();
  }

  ctx.fillStyle = '#E53935';
  ctx.beginPath();
  ctx.arc(x + thermW / 2, y + thermH + bulbR, bulbR - 2, 0, Math.PI * 2);
  ctx.fill();

  const fillH = fill * (thermH - 4);
  ctx.fillStyle = '#E53935';
  ctx.fillRect(x + 5, y + thermH - 2 - fillH, thermW - 10, fillH + 2);

  ctx.fillStyle = COLORS.textPrimary;
  ctx.font = CANVAS_FONTS.label;
  ctx.textAlign = 'center';
  ctx.fillText(`${currentT.toFixed(0)}K`, x + thermW / 2, y - 8);
}

function buildCalcSteps(
  mode: string, orientation: string,
  T1: number, T2: number, pistonMass: number,
  S: number, L1: number, P0: number,
  params: Record<string, number | string | boolean>,
): CalcStep[] {
  const steps: CalcStep[] = [];
  const Sm2 = S * 1e-4;

  if (mode === '双活塞') {
    const heatPos = String(params.pcHeatPosition) || '中间';
    steps.push({ text: '双活塞模型' });
    steps.push({ text: `外界压强 P₀ = ${P0} kPa` });
    steps.push({ text: `T₁ = ${T1} K, T₂ = ${T2} K` });
    steps.push({ text: `每侧初始气柱 L₁ = ${L1} cm, S = ${S} cm²` });
    steps.push({ text: `加热位置: ${heatPos}` });
    steps.push({ text: '' });
    steps.push({ text: '各活塞自由移动，外侧大气压 P₀' });
    steps.push({ text: '→ 各侧独立等压变化' });
    steps.push({ text: '' });

    let L2Left: number, L2Right: number;
    if (heatPos === '左') {
      steps.push({ text: '左侧加热: T₁→T₂，等压膨胀' });
      L2Left = L1 * T2 / T1;
      steps.push({ text: `L左₂ = L₁ × T₂/T₁ = ${L1}×${T2}/${T1}` });
      steps.push({ text: `L左₂ = ${L2Left.toFixed(2)} cm`, highlight: true });
      steps.push({ text: '' });
      L2Right = L1;
      steps.push({ text: '右侧未加热: 温度不变 T₁' });
      steps.push({ text: `L右₂ = L₁ = ${L1} cm` });
    } else if (heatPos === '右') {
      L2Left = L1;
      steps.push({ text: '左侧未加热: 温度不变 T₁' });
      steps.push({ text: `L左₂ = L₁ = ${L1} cm` });
      steps.push({ text: '' });
      steps.push({ text: '右侧加热: T₁→T₂，等压膨胀' });
      L2Right = L1 * T2 / T1;
      steps.push({ text: `L右₂ = L₁ × T₂/T₁ = ${L1}×${T2}/${T1}` });
      steps.push({ text: `L右₂ = ${L2Right.toFixed(2)} cm`, highlight: true });
    } else {
      L2Left = L1 * T2 / T1;
      L2Right = L2Left;
      steps.push({ text: '两侧同时加热: T₁→T₂' });
      steps.push({ text: `L左₂ = L右₂ = L₁ × T₂/T₁ = ${L1}×${T2}/${T1}` });
      steps.push({ text: `     = ${L2Left.toFixed(2)} cm`, highlight: true });
    }

    steps.push({ text: '' });
    const V1 = 2 * L1 * S;
    const V2 = (L2Left + L2Right) * S;
    steps.push({ text: `V₂ = (L左₂+L右₂)×S = (${L2Left.toFixed(2)}+${L2Right.toFixed(2)})×${S}` });
    steps.push({ text: `V₂ = ${V2.toFixed(1)} cm³`, highlight: true });
    steps.push({ text: '' });
    steps.push({ text: `验证: P₀V₁/T₁ = ${(P0*V1/T1).toFixed(4)}` });
    steps.push({ text: `各侧独立守恒 (等压过程 PV/T = const)` });
    return steps;
  }

  steps.push({ text: `单活塞 · ${orientation}放置` });
  steps.push({ text: `P₀ = ${P0} kPa, m = ${pistonMass} kg, S = ${S} cm²` });
  steps.push({ text: '' });

  let P1: number;
  if (orientation === '竖直') {
    const mgOverS = (pistonMass * g) / Sm2 / 1000;
    P1 = P0 + mgOverS;
    steps.push({ text: `P = P₀ + mg/S` });
    steps.push({ text: `  = ${P0} + ${pistonMass}×${g}/(${S}×10⁻⁴)/1000` });
    steps.push({ text: `  = ${P0} + ${mgOverS.toFixed(2)} = ${P1.toFixed(2)} kPa` });
  } else {
    P1 = P0;
    steps.push({ text: `P = P₀ = ${P0} kPa (水平, 重力不影响)` });
  }

  steps.push({ text: '' });
  steps.push({ text: `T₁ = ${T1} K, T₂ = ${T2} K` });
  steps.push({ text: `L₁ = ${L1} cm` });
  steps.push({ text: '' });
  steps.push({ text: '活塞可自由移动 → 等压过程' });
  steps.push({ text: `P₁ = P₂ = ${P1.toFixed(2)} kPa` });
  steps.push({ text: '' });
  steps.push({ text: 'L₂ = L₁ × T₂ / T₁' });
  const L2 = L1 * T2 / T1;
  const V1 = L1 * S;
  const V2 = L2 * S;
  steps.push({ text: `   = ${L1} × ${T2} / ${T1}` });
  steps.push({ text: `L₂ = ${L2.toFixed(2)} cm`, highlight: true });
  steps.push({ text: `V₂ = L₂·S = ${V2.toFixed(1)} cm³` });

  steps.push({ text: '' });
  steps.push({ text: `验证: PV₁/T₁ = ${(P1*V1/T1).toFixed(4)}` });
  steps.push({ text: `      PV₂/T₂ = ${(P1*V2/T2).toFixed(4)}` });

  return steps;
}
