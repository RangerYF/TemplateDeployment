import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, defineParams, PlaybackControls,
  SimLoop, CanvasManager, GridRenderer, SyncedGraph, GRAVITY,
} from '@physics/core';
import type { SimState, GraphTrace } from '@physics/core';

// --- State: array of particle y-positions and x-displacements ---
interface WaveState extends SimState {
  [key: string]: number; // y0..yN, dx0..dxN, t
}

const NUM_PARTICLES = 80;
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-06 波动演示台');

const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '横波传播',
    options: [
      '横波传播', '纵波传播', '横波纵波对比',
      '驻波', '多普勒效应', '干涉', '波的平移问题',
    ] },
  { key: 'amplitude', label: '振幅 A', unit: 'm', min: 0.1, max: 2, step: 0.1, default: 1,
    scenes: ['横波传播', '纵波传播', '横波纵波对比', '驻波', '干涉', '波的平移问题'] },
  { key: 'frequency', label: '频率 f', unit: 'Hz', min: 0.1, max: 3, step: 0.1, default: 1,
    scenes: ['横波传播', '纵波传播', '横波纵波对比', '驻波', '多普勒效应', '干涉', '波的平移问题'] },
  { key: 'wavelength', label: '波长 λ', unit: 'm', min: 1, max: 10, step: 0.5, default: 4,
    scenes: ['横波传播', '纵波传播', '横波纵波对比', '驻波', '多普勒效应', '干涉', '波的平移问题'] },
  { key: 'frequency2', label: '频率2 f₂', unit: 'Hz', min: 0.1, max: 3, step: 0.1, default: 1.2,
    scenes: ['干涉'] },
  { key: 'sourceSpeed', label: '声源速度 v_s', unit: 'm/s', min: 0, max: 8, step: 0.1, default: 2,
    scenes: ['多普勒效应'] },
  { key: 'selectedParticle', label: '观察质点', unit: '', min: 0, max: NUM_PARTICLES - 1, step: 1, default: 20,
    scenes: ['横波传播', '纵波传播', '横波纵波对比', '驻波', '干涉'] },
  { key: 'deltaT', label: 'Δt (周期倍数)', unit: 'T', min: 0, max: 1, step: 0.05, default: 0.25,
    scenes: ['波的平移问题'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });
function updateOrigin(): void {
  cm.setOrigin(80, cm.getHeight() / 2);
}
updateOrigin();
cm.setScale(40);
const grid = new GridRenderer(cm);

// Graphs
const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer);
const graph = new SyncedGraph({
  container: graphContainer,
  title: '质点振动图 y-t',
  xLabel: 't (s)',
  yLabel: 'y (m)',
  height: 260,
});

const timeData: number[] = [];
const ySelectedData: number[] = [];

const controls = new PlaybackControls(layout.controlBar);

function getScene() { return panel.getValue<string>('scene'); }

function createInitialState(): WaveState {
  const s: WaveState = { t: 0 };
  for (let i = 0; i < NUM_PARTICLES; i++) {
    s[`y${i}`] = 0;
    s[`dx${i}`] = 0;
  }
  return s;
}

function waveY(x: number, t: number, A: number, f: number, lambda: number): number {
  const k = 2 * Math.PI / lambda;
  const omega = 2 * Math.PI * f;
  return A * Math.sin(k * x - omega * t);
}

function createStepFn() {
  return (_t: number, dt: number, state: WaveState): WaveState => {
    const newState: WaveState = { t: state.t + dt };
    const scene = getScene();
    const A = panel.getValue<number>('amplitude');
    const f = panel.getValue<number>('frequency');
    const lambda = panel.getValue<number>('wavelength');
    const t = newState.t;
    const spacing = 0.25;

    for (let i = 0; i < NUM_PARTICLES; i++) {
      const x = i * spacing;
      newState[`dx${i}`] = 0;

      switch (scene) {
        case '横波传播':
          newState[`y${i}`] = waveY(x, t, A, f, lambda);
          break;
        case '纵波传播': {
          // Longitudinal: displacement is along x-direction
          newState[`y${i}`] = 0;
          newState[`dx${i}`] = waveY(x, t, A * 0.3, f, lambda);
          break;
        }
        case '横波纵波对比': {
          // Transverse part stored in y, longitudinal displacement in dx
          newState[`y${i}`] = waveY(x, t, A, f, lambda);
          newState[`dx${i}`] = waveY(x, t, A * 0.3, f, lambda);
          break;
        }
        case '驻波': {
          const y1 = waveY(x, t, A, f, lambda);
          const y2 = waveY(x, -t, A, f, lambda);
          newState[`y${i}`] = y1 + y2;
          break;
        }
        case '干涉': {
          const f2 = panel.getValue<number>('frequency2');
          const vWave = f * lambda;
          const lambda2 = vWave / f2;
          const y1 = waveY(x, t, A, f, lambda);
          const y2 = waveY(x, t, A, f2, lambda2);
          newState[`y${i}`] = y1 + y2;
          break;
        }
        case '多普勒效应':
          newState[`y${i}`] = 0;
          break;
        case '波的平移问题':
          newState[`y${i}`] = waveY(x, t, A, f, lambda);
          break;
      }
    }
    return newState;
  };
}

// ---- Drawing helpers ----

/** Draw a horizontal equilibrium line */
function drawEquilibriumLine(ctx: CanvasRenderingContext2D, yOff: number, spacing: number) {
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  const [lx1, ly1] = cm.toScreen(0, yOff);
  const [lx2, ly2] = cm.toScreen(NUM_PARTICLES * spacing, yOff);
  ctx.beginPath();
  ctx.moveTo(lx1, ly1);
  ctx.lineTo(lx2, ly2);
  ctx.stroke();
}

/** Draw the transverse wave particle chain */
function drawTransverseChain(
  ctx: CanvasRenderingContext2D, state: WaveState, spacing: number,
  yOffset: number, selP: number, showLabel: boolean, showArrows: boolean,
) {
  // Wave curve
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < NUM_PARTICLES; i++) {
    const x = i * spacing;
    const y = (state[`y${i}`] as number) + yOffset;
    const [sx, sy] = cm.toScreen(x, y);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  }
  ctx.stroke();

  // Particles and equilibrium ticks
  for (let i = 0; i < NUM_PARTICLES; i++) {
    const x = i * spacing;
    const y = (state[`y${i}`] as number) + yOffset;
    const [sx, sy] = cm.toScreen(x, y);
    const [, eqY] = cm.toScreen(x, yOffset);

    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(sx, eqY);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    const isSelected = i === selP;
    ctx.beginPath();
    ctx.arc(sx, sy, isSelected ? 7 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#fbbf24' : '#60a5fa';
    ctx.fill();

    // Arrows showing particle velocity direction (vertical for transverse)
    if (showArrows && (i % 10 === 0 || isSelected)) {
      // Compute actual transverse velocity: ∂y/∂t = -Aω cos(kx - ωt)
      const A_val = panel.getValue<number>('amplitude');
      const f_val = panel.getValue<number>('frequency');
      const lambda_val = panel.getValue<number>('wavelength');
      const k_val = 2 * Math.PI / lambda_val;
      const omega_val = 2 * Math.PI * f_val;
      const xPos = i * spacing; // actual x position in world coords
      const vyActual = -A_val * omega_val * Math.cos(k_val * xPos - omega_val * state.t);
      const arrowLen = Math.min(20, Math.abs(vyActual) / (A_val * omega_val) * 20);
      if (arrowLen > 2) {
        const dir = vyActual > 0 ? -1 : 1; // screen y is inverted
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx, sy + dir * arrowLen);
        ctx.stroke();
        // arrowhead
        ctx.beginPath();
        ctx.moveTo(sx - 4, sy + dir * (arrowLen - 5));
        ctx.lineTo(sx, sy + dir * arrowLen);
        ctx.lineTo(sx + 4, sy + dir * (arrowLen - 5));
        ctx.stroke();
      }
    }
  }

  if (showLabel) {
    const A = panel.getValue<number>('amplitude');
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [arrowX, arrowY] = cm.toScreen(NUM_PARTICLES * spacing / 2, yOffset + A + 0.5);
    ctx.fillText('波的传播方向 →', arrowX, arrowY);
  }
}

/** Draw the longitudinal wave particle chain */
function drawLongitudinalChain(
  ctx: CanvasRenderingContext2D, state: WaveState, spacing: number,
  yOffset: number, selP: number, showArrows: boolean,
  A: number, f: number, lambda: number,
) {
  drawEquilibriumLine(ctx, yOffset, spacing);

  // Draw particles displaced horizontally
  const particleScreenPositions: [number, number][] = [];
  for (let i = 0; i < NUM_PARTICLES; i++) {
    const xEq = i * spacing;
    const dx = state[`dx${i}`] as number;
    const xActual = xEq + dx;
    const [sx, sy] = cm.toScreen(xActual, yOffset);
    const [eqSx] = cm.toScreen(xEq, yOffset);
    particleScreenPositions.push([sx, sy]);

    // Horizontal line from equilibrium to current position
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(eqSx, sy);
    ctx.lineTo(sx, sy);
    ctx.stroke();

    const isSelected = i === selP;
    ctx.beginPath();
    ctx.arc(sx, sy, isSelected ? 7 : 4, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#fbbf24' : '#34d399';
    ctx.fill();

    // Arrows showing particle velocity direction (horizontal for longitudinal)
    if (showArrows && (i % 10 === 0 || isSelected)) {
      // Compute actual longitudinal velocity: ∂(dx)/∂t = -Aω cos(kx - ωt)
      const A_val = panel.getValue<number>('amplitude');
      const f_val = panel.getValue<number>('frequency');
      const lambda_val = panel.getValue<number>('wavelength');
      const k_val = 2 * Math.PI / lambda_val;
      const omega_val = 2 * Math.PI * f_val;
      const vxActual = -A_val * omega_val * Math.cos(k_val * xEq - omega_val * state.t);
      const arrowLen = Math.min(20, Math.abs(vxActual) / (A_val * omega_val) * 20);
      if (arrowLen > 2) {
        const dir = vxActual > 0 ? 1 : -1;
        ctx.strokeStyle = '#f87171';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + dir * arrowLen, sy);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(sx + dir * (arrowLen - 5), sy - 4);
        ctx.lineTo(sx + dir * arrowLen, sy);
        ctx.lineTo(sx + dir * (arrowLen - 5), sy + 4);
        ctx.stroke();
      }
    }
  }

  // Mark compression and rarefaction zones
  const k = 2 * Math.PI / lambda;
  const omega = 2 * Math.PI * f;
  const t = state.t;
  // Compression occurs where d(displacement)/dx < 0 (particles pushed together)
  // Rarefaction occurs where d(displacement)/dx > 0 (particles spread apart)
  // For displacement = A sin(kx - wt), derivative = Ak cos(kx - wt)
  // Compression centers: cos(kx - wt) = -1 → kx - wt = (2n+1)π
  // Rarefaction centers: cos(kx - wt) = 1 → kx - wt = 2nπ
  const maxX = NUM_PARTICLES * spacing;
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  for (let n = -10; n <= 10; n++) {
    // Compression: kx - wt = (2n+1)π → x = ((2n+1)π + wt) / k
    const xComp = ((2 * n + 1) * Math.PI + omega * t) / k;
    if (xComp >= 0 && xComp <= maxX) {
      const [cx, cy] = cm.toScreen(xComp, yOffset);
      ctx.fillStyle = 'rgba(248, 113, 113, 0.6)';
      ctx.fillText('压缩', cx, cy - 14);
    }
    // Rarefaction: kx - wt = 2nπ → x = (2nπ + wt) / k
    const xRare = (2 * n * Math.PI + omega * t) / k;
    if (xRare >= 0 && xRare <= maxX) {
      const [rx, ry] = cm.toScreen(xRare, yOffset);
      ctx.fillStyle = 'rgba(74, 222, 128, 0.6)';
      ctx.fillText('疏部', rx, ry - 14);
    }
  }

  // Propagation arrow
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  const [arrowX, arrowY] = cm.toScreen(NUM_PARTICLES * spacing / 2, yOffset + 1.0);
  ctx.fillText('波的传播方向 →', arrowX, arrowY);
}

function renderScene(t: number, state: WaveState): void {
  const scene = getScene();
  const A = panel.getValue<number>('amplitude');
  const f = panel.getValue<number>('frequency');
  const lambda = panel.getValue<number>('wavelength');
  const selP = Math.floor(panel.getValue<number>('selectedParticle'));
  updateOrigin();
  cm.clear('#070b14');

  const ctx = cm.ctx;
  const spacing = 0.25;

  if (scene === '多普勒效应') {
    // Doppler: draw concentric circles from moving source
    const vs = panel.getValue<number>('sourceSpeed');
    const vWave = f * lambda;
    const sourceX = 10 + vs * state.t;
    const [sx, sy] = cm.toScreen(sourceX % 20 - 5, 0);

    const numFronts = 15;
    for (let i = 1; i <= numFronts; i++) {
      const emitTime = state.t - i / f;
      if (emitTime < 0) continue;
      const emitX = 10 + vs * emitTime;
      const radius = vWave * (state.t - emitTime);
      const [cx, cy] = cm.toScreen(emitX % 20 - 5, 0);
      const rPx = radius * cm.getScale();
      if (rPx < 2 || rPx > 1000) continue;

      ctx.strokeStyle = `rgba(96, 165, 250, ${0.6 - i * 0.03})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.beginPath();
    ctx.arc(sx, sy, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#f87171';
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('声源', sx, sy - 18);
    ctx.fillText(`v_s = ${vs.toFixed(1)} m/s`, sx, sy + 28);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    const fObs_front = f * vWave / (vWave - vs);
    const fObs_back = f * vWave / (vWave + vs);
    ctx.fillText(`波速 v = fλ = ${vWave.toFixed(1)} m/s`, 20, cm.getHeight() - 80);
    ctx.fillText(`前方观测频率 f' = ${fObs_front.toFixed(2)} Hz`, 20, cm.getHeight() - 58);
    ctx.fillText(`后方观测频率 f' = ${fObs_back.toFixed(2)} Hz`, 20, cm.getHeight() - 36);

  } else if (scene === '纵波传播') {
    // ---- Longitudinal wave scene ----
    drawLongitudinalChain(ctx, state, spacing, 0, selP, true, A, f, lambda);

    // Teaching annotation
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('纵波: 质点振动方向 ∥ 波的传播方向', 20, cm.getHeight() - 58);
    ctx.fillText('密部 = 压缩区 (compression)  疏部 = 稀疏区 (rarefaction)', 20, cm.getHeight() - 36);

    // Selected particle info
    const selDx = state[`dx${selP}`] as number;
    const xSel = selP * spacing + selDx;
    const [spx, spy] = cm.toScreen(xSel, 0);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`质点 ${selP}`, spx + 12, spy - 8);
    ctx.fillText(`Δx = ${selDx.toFixed(3)} m`, spx + 12, spy + 8);

  } else if (scene === '横波纵波对比') {
    // ---- Transverse vs Longitudinal comparison ----
    // Top half: transverse wave (y offset = +2.5)
    const topY = 2.5;
    const botY = -2.5;

    // Labels
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    const [, labelTopY] = cm.toScreen(0, topY + A + 0.9);
    ctx.fillText('横波 (transverse) — 质点振动方向 ⊥ 传播方向', 20, labelTopY);

    ctx.fillStyle = '#34d399';
    const [, labelBotY] = cm.toScreen(0, botY + 1.2);
    ctx.fillText('纵波 (longitudinal) — 质点振动方向 ∥ 传播方向', 20, labelBotY);

    // Separator line
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);
    const [sepX1, sepY1] = cm.toScreen(-0.5, 0);
    const [sepX2, sepY2] = cm.toScreen(NUM_PARTICLES * spacing + 0.5, 0);
    ctx.beginPath();
    ctx.moveTo(sepX1, sepY1);
    ctx.lineTo(sepX2, sepY2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw transverse chain in upper half
    drawEquilibriumLine(ctx, topY, spacing);
    drawTransverseChain(ctx, state, spacing, topY, selP, false, true);

    // Draw longitudinal chain in lower half
    drawLongitudinalChain(ctx, state, spacing, botY, selP, true, A, f, lambda);

    // Propagation arrows
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [arrowX1, arrowY1] = cm.toScreen(NUM_PARTICLES * spacing / 2, topY + A + 0.5);
    ctx.fillText('传播方向 →', arrowX1, arrowY1);

  } else if (scene === '干涉') {
    // ---- Interference with stability comparison ----
    const f2 = panel.getValue<number>('frequency2');
    const sameFreq = Math.abs(f - f2) < 0.01;
    const vWave = f * lambda;

    drawEquilibriumLine(ctx, 0, spacing);

    // Draw wave curve
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const x = i * spacing;
      const y = state[`y${i}`] as number;
      const [sx2, sy2] = cm.toScreen(x, y);
      if (i === 0) ctx.moveTo(sx2, sy2);
      else ctx.lineTo(sx2, sy2);
    }
    ctx.stroke();

    // Draw particles
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const x = i * spacing;
      const y = state[`y${i}`] as number;
      const [sx2, sy2] = cm.toScreen(x, y);
      const [, eqY] = cm.toScreen(x, 0);

      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx2, eqY);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();

      const isSelected = i === selP;
      ctx.beginPath();
      ctx.arc(sx2, sy2, isSelected ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#fbbf24' : '#60a5fa';
      ctx.fill();
    }

    // Stability status and annotations
    if (sameFreq) {
      // Stable interference pattern
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('稳定干涉 (频率相同)', cm.getWidth() - 20, 30);

      // Mark fixed constructive and destructive positions
      // Two waves with same f, same lambda: y = 2A sin(kx - wt)
      // The pattern is just a single wave with double amplitude — always constructive
      // For demonstration with two sources, mark positions:
      const k = 2 * Math.PI / lambda;
      const omega = 2 * Math.PI * f;
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      const maxX = NUM_PARTICLES * spacing;
      for (let n = -10; n <= 10; n++) {
        // Constructive: kx = nπ → maximum envelope position for standing-like pattern
        // Since both waves travel same direction with same freq, superposition = 2A sin(kx-wt)
        // Every half-wavelength we can mark constructive maxima positions
        const xC = n * lambda / 2;
        if (xC >= 0 && xC <= maxX) {
          const [cx, cy] = cm.toScreen(xC, 0);
          if (n % 2 === 0) {
            ctx.fillStyle = 'rgba(74, 222, 128, 0.7)';
            ctx.fillText('加强', cx, cy + 20);
          }
        }
      }

      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('f₁ = f₂ → 加强/减弱位置固定不变', 20, cm.getHeight() - 36);
    } else {
      // Unstable interference pattern
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('不稳定 (频率不同)', cm.getWidth() - 20, 30);

      // Show beat frequency info
      const fBeat = Math.abs(f - f2);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`f₁ = ${f.toFixed(1)} Hz, f₂ = ${f2.toFixed(1)} Hz`, 20, cm.getHeight() - 80);
      ctx.fillText(`拍频 |f₁ - f₂| = ${fBeat.toFixed(2)} Hz`, 20, cm.getHeight() - 58);
      ctx.fillText('f₁ ≠ f₂ → 加强/减弱位置随时间变化', 20, cm.getHeight() - 36);
    }

    // Selected particle info
    const selY = state[`y${selP}`] as number;
    const [spx, spy] = cm.toScreen(selP * spacing, selY);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`质点 ${selP}`, spx + 12, spy - 8);
    ctx.fillText(`y = ${selY.toFixed(3)} m`, spx + 12, spy + 8);

    // Wave direction arrow
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [arrowX, arrowY] = cm.toScreen(NUM_PARTICLES * spacing / 2, A + 0.5);
    ctx.fillText('波的传播方向 →', arrowX, arrowY);

  } else if (scene === '波的平移问题') {
    // ---- Wave shift / translation problem ----
    const deltaT = panel.getValue<number>('deltaT');
    const T = 1 / f;
    const dt_actual = deltaT * T;
    const vWave = f * lambda;
    const shift = vWave * dt_actual; // distance the wave shape translates

    drawEquilibriumLine(ctx, 0, spacing);

    // Draw wave at current time t (blue, solid)
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const x = i * spacing;
      const y = state[`y${i}`] as number;
      const [sx, sy] = cm.toScreen(x, y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Draw wave at time t + Δt (orange, dashed) — shifted by vΔt to the right
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const x = i * spacing;
      // Wave at t + dt_actual is the same shape shifted right by shift
      const yShifted = waveY(x, state.t + dt_actual, A, f, lambda);
      const [sx, sy] = cm.toScreen(x, yShifted);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw particles at current time
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const x = i * spacing;
      const y = state[`y${i}`] as number;
      const [sx, sy] = cm.toScreen(x, y);

      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
    }

    // Shift arrow at bottom showing vΔt distance
    if (shift > 0.01) {
      const arrowBaseX = 3;
      const arrowEndX = arrowBaseX + shift;
      const arrowYPos = -A - 0.8;
      const [ax1, ay1] = cm.toScreen(arrowBaseX, arrowYPos);
      const [ax2, ay2] = cm.toScreen(Math.min(arrowEndX, NUM_PARTICLES * spacing - 1), arrowYPos);

      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ax1, ay1);
      ctx.lineTo(ax2, ay2);
      ctx.stroke();
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(ax2 - 8, ay2 - 5);
      ctx.lineTo(ax2, ay2);
      ctx.lineTo(ax2 - 8, ay2 + 5);
      ctx.stroke();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`vΔt = ${shift.toFixed(2)} m`, (ax1 + ax2) / 2, ay1 - 8);
    }

    // Legend and info
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';

    ctx.fillStyle = '#60a5fa';
    ctx.fillText('—— 当前时刻 t', 20, cm.getHeight() - 80);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText('- - - 时刻 t + Δt', 20, cm.getHeight() - 58);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(
      `Δt = ${deltaT.toFixed(2)}T = ${dt_actual.toFixed(3)} s,  v = ${vWave.toFixed(1)} m/s,  平移 = vΔt = ${shift.toFixed(2)} m`,
      20, cm.getHeight() - 36,
    );

    // Wave direction arrow
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [dArrowX, dArrowY] = cm.toScreen(NUM_PARTICLES * spacing / 2, A + 0.5);
    ctx.fillText('波的传播方向 →', dArrowX, dArrowY);

  } else {
    // ---- Default particle chain scenes: 横波传播, 驻波 ----
    drawEquilibriumLine(ctx, 0, spacing);

    // Draw wave curve
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const x = i * spacing;
      const y = state[`y${i}`] as number;
      const [sx2, sy2] = cm.toScreen(x, y);
      if (i === 0) ctx.moveTo(sx2, sy2);
      else ctx.lineTo(sx2, sy2);
    }
    ctx.stroke();

    // Draw particles
    for (let i = 0; i < NUM_PARTICLES; i++) {
      const x = i * spacing;
      const y = state[`y${i}`] as number;
      const [sx2, sy2] = cm.toScreen(x, y);
      const [, eqY] = cm.toScreen(x, 0);

      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx2, eqY);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();

      const isSelected = i === selP;
      ctx.beginPath();
      ctx.arc(sx2, sy2, isSelected ? 7 : 4, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? '#fbbf24' : '#60a5fa';
      ctx.fill();
    }

    // Selected particle info
    const selY = state[`y${selP}`] as number;
    const [spx, spy] = cm.toScreen(selP * spacing, selY);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`质点 ${selP}`, spx + 12, spy - 8);
    ctx.fillText(`y = ${selY.toFixed(3)} m`, spx + 12, spy + 8);

    // Standing wave: mark nodes and antinodes
    if (scene === '驻波') {
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const x = i * spacing;
        const frac = (2 * x / lambda) % 1;
        if (Math.abs(frac) < 0.03 || Math.abs(frac - 1) < 0.03) {
          const [nx, ny] = cm.toScreen(x, 0);
          ctx.fillStyle = '#4ade80';
          ctx.textAlign = 'center';
          ctx.fillText('波节', nx, ny + 18);
        }
        if (Math.abs(frac - 0.5) < 0.03) {
          const [nx, ny] = cm.toScreen(x, 0);
          ctx.fillStyle = '#f87171';
          ctx.textAlign = 'center';
          ctx.fillText('波腹', nx, ny + 18);
        }
      }
    }

    // Wave direction arrow
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [arrowX, arrowY] = cm.toScreen(NUM_PARTICLES * spacing / 2, A + 0.5);
    ctx.fillText('波的传播方向 →', arrowX, arrowY);
  }

  // Scene label
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(scene, 20, 30);

  // Graph data
  const selY2 = scene === '纵波传播'
    ? (state[`dx${selP}`] as number || 0)
    : (state[`y${selP}`] as number || 0);
  timeData.push(state.t);
  ySelectedData.push(selY2);
  const max = 500;
  if (timeData.length > max) {
    timeData.splice(0, timeData.length - max);
    ySelectedData.splice(0, ySelectedData.length - max);
  }

  const traces: GraphTrace[] = [
    { x: timeData, y: ySelectedData, name: `质点${selP} y(t)`, color: '#fbbf24' },
  ];

  // For longitudinal scenes, show dx in the graph label
  if (scene === '纵波传播') {
    graph.updateTitle('质点振动图 Δx-t (纵波位移)');
    traces[0] = {
      x: timeData,
      y: ySelectedData,
      name: `质点${selP} Δx(t)`,
      color: '#34d399',
    };
  } else {
    graph.updateTitle('质点振动图 y-t');
  }

  graph.setTraces(traces);
  graph.updateCurrentTime(state.t);
  graph.render();
  controls.updateTime(state.t);
}

const sim = new SimLoop<WaveState>({
  dt: 1 / 60,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: createInitialState(),
});

controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => {
  timeData.length = 0; ySelectedData.length = 0;
  sim.reset(createInitialState());
  sim.updateStepFn(createStepFn());
  controls.setPlaying(false);
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

panel.setOnChange(() => {
  timeData.length = 0; ySelectedData.length = 0;
  sim.reset(createInitialState());
  sim.updateStepFn(createStepFn());
});

renderScene(0, createInitialState());

// Auto-play on load
setTimeout(() => { sim.play(); controls.setPlaying(true); }, 100);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
