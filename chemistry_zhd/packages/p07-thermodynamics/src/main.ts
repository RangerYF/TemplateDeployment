import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, defineParams, PlaybackControls,
  SimLoop, CanvasManager, SyncedGraph, GridRenderer,
} from '@physics/core';
import type { SimState, GraphTrace } from '@physics/core';

// ---------------------------------------------------------------------------
// State interface
// ---------------------------------------------------------------------------
interface ThermoState extends SimState {
  [key: string]: number;
  // px0..pxN, py0..pyN, vx0..vyN for particles
  // brownX, brownY for Brownian particle
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const NUM_PARTICLES = 100;
const BOX_W = 12; // world units
const BOX_H = 8;
const PARTICLE_R = 0.12;
const BROWN_R = 0.4;

type SceneName = '理想气体' | '布朗运动' | '气体定律' | '液柱密封模型' | '气缸活塞模型';

// ---------------------------------------------------------------------------
// Layout & UI
// ---------------------------------------------------------------------------
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-07 热力学模拟器');

const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '理想气体',
    options: ['理想气体', '布朗运动', '气体定律', '液柱密封模型', '气缸活塞模型'] },
  // --- Ideal gas / Brownian ---
  { key: 'temperature', label: '温度 T', unit: 'K', min: 1, max: 2000, step: 10, default: 300,
    scenes: ['理想气体', '布朗运动'] },
  { key: 'numParticles', label: '粒子数', unit: '', min: 20, max: 200, step: 10, default: 100,
    scenes: ['理想气体', '布朗运动'] },
  { key: 'showVelocity', label: '显示速度箭头', type: 'checkbox', default: false,
    scenes: ['理想气体', '布朗运动'] },
  { key: 'showDistribution', label: '显示速率分布', type: 'checkbox', default: true,
    scenes: ['理想气体', '布朗运动'] },
  // --- Gas Laws ---
  { key: 'gasProcess', label: '气体过程', type: 'select', default: '等温过程',
    options: ['等温过程', '等压过程', '等容过程'],
    scenes: ['气体定律'] },
  { key: 'gasT', label: '温度 T', unit: 'K', min: 1, max: 1500, step: 10, default: 300,
    scenes: ['气体定律'] },
  { key: 'gasV', label: '体积 V', unit: 'L', min: 0.5, max: 50, step: 0.5, default: 10,
    scenes: ['气体定律'] },
  { key: 'gasP', label: '压强 P', unit: 'kPa', min: 10, max: 1000, step: 10, default: 100,
    scenes: ['气体定律'] },
  // --- Liquid Column ---
  { key: 'tubeOrientation', label: '管方向', type: 'select', default: '竖直开口向上',
    options: ['竖直开口向上', '竖直开口向下', '水平'],
    scenes: ['液柱密封模型'] },
  { key: 'lcT1', label: '初始温度 T1', unit: 'K', min: 1, max: 1000, step: 5, default: 300,
    scenes: ['液柱密封模型'] },
  { key: 'lcT2', label: '末温度 T2', unit: 'K', min: 1, max: 1000, step: 5, default: 400,
    scenes: ['液柱密封模型'] },
  { key: 'lcL1', label: '气柱长 L1', unit: 'cm', min: 2, max: 60, step: 1, default: 20,
    scenes: ['液柱密封模型'] },
  { key: 'lcH', label: '液柱长 h', unit: 'cm', min: 1, max: 50, step: 1, default: 10,
    scenes: ['液柱密封模型'] },
  { key: 'lcPAtm', label: '大气压 P0', unit: 'cmHg', min: 50, max: 100, step: 1, default: 76,
    scenes: ['液柱密封模型'] },
  // --- Piston-Cylinder ---
  { key: 'cylinderOrientation', label: '气缸方向', type: 'select', default: '竖直',
    options: ['竖直', '水平'],
    scenes: ['气缸活塞模型'] },
  { key: 'pcT1', label: '初始温度 T', unit: 'K', min: 1, max: 1000, step: 5, default: 300,
    scenes: ['气缸活塞模型'] },
  { key: 'pcDeltaT', label: '加热 deltaT', unit: 'K', min: -200, max: 500, step: 5, default: 100,
    scenes: ['气缸活塞模型'] },
  { key: 'pcPistonMass', label: '活塞质量 m', unit: 'kg', min: 0, max: 20, step: 0.5, default: 2,
    scenes: ['气缸活塞模型'] },
  { key: 'pcArea', label: '截面积 S', unit: 'cm2', min: 5, max: 200, step: 5, default: 50,
    scenes: ['气缸活塞模型'] },
  { key: 'pcL1', label: '初始气柱长 L', unit: 'cm', min: 5, max: 60, step: 1, default: 20,
    scenes: ['气缸活塞模型'] },
  { key: 'pcPAtm', label: '大气压 P0', unit: 'kPa', min: 50, max: 200, step: 1, default: 101,
    scenes: ['气缸活塞模型'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });
function updateOrigin(): void {
  cm.setOrigin(80, cm.getHeight() - 60);
}
updateOrigin();
cm.setScale(45);
const controls = new PlaybackControls(layout.controlBar);

// Graph
const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer);
const graph = new SyncedGraph({
  container: graphContainer,
  title: '速率分布',
  xLabel: 'v (m/s)',
  yLabel: '频次',
  height: 260,
});

// ---------------------------------------------------------------------------
// Conditional parameter visibility
// ---------------------------------------------------------------------------
const sceneParamMap: Record<string, string[]> = {
  '理想气体': ['temperature', 'numParticles', 'showVelocity', 'showDistribution'],
  '布朗运动': ['temperature', 'numParticles', 'showVelocity', 'showDistribution'],
  '气体定律': ['gasProcess', 'gasT', 'gasV', 'gasP'],
  '液柱密封模型': ['tubeOrientation', 'lcT1', 'lcT2', 'lcL1', 'lcH', 'lcPAtm'],
  '气缸活塞模型': ['cylinderOrientation', 'pcT1', 'pcDeltaT', 'pcPistonMass', 'pcArea', 'pcL1', 'pcPAtm'],
};

function updateParamVisibility(): void {
  const scene = panel.getValue<string>('scene');
  const visibleKeys = new Set(sceneParamMap[scene] ?? []);
  visibleKeys.add('scene'); // always show scene selector

  // Walk through all param rows in the sidebar
  const rows = (layout.sidebar as HTMLElement).querySelectorAll('.param-row');
  for (const row of rows) {
    const input = row.querySelector('[data-key]') as HTMLElement | null;
    if (!input) continue;
    const key = input.dataset.key!;
    (row as HTMLElement).style.display = visibleKeys.has(key) ? '' : 'none';
  }
}

// ---------------------------------------------------------------------------
// Per-scene data
// ---------------------------------------------------------------------------
const timeData: number[] = [];
const pressureData: number[] = [];
let wallCollisions = 0;

function getN(): number { return Math.min(200, Math.floor(panel.getValue<number>('numParticles'))); }

// ---------------------------------------------------------------------------
// Ideal gas / Brownian initial state
// ---------------------------------------------------------------------------
function createParticleState(): ThermoState {
  const T = panel.getValue<number>('temperature');
  const n = getN();
  const kB = 1.38e-23;
  const m = 4.65e-26; // N2 molecule mass
  const vRms = Math.sqrt(3 * kB * T / m);
  // Scale so at T=300K, typical speed ≈ 4 world units/s (cross box in ~3s)
  // vRms(300K) ≈ 517 m/s → want 4 → factor = 4/517 ≈ 0.00774
  // At 50K: vRms ≈ 211 → speed ≈ 1.6 (slow, visible)
  // At 2000K: vRms ≈ 1334 → speed ≈ 10.3 (fast, energetic)
  const worldSpeedScale = 4.0 / Math.sqrt(3 * kB * 300 / m); // normalize to 300K → 4 units/s

  const s: ThermoState = {};
  for (let i = 0; i < n; i++) {
    s[`px${i}`] = Math.random() * (BOX_W - 2) + 1;
    s[`py${i}`] = Math.random() * (BOX_H - 2) + 1;
    const u1 = Math.random();
    const u2 = Math.random();
    // Box-Muller: gives N(0,1), multiply by vRms/√3 for per-component std dev, then scale
    const sigma = vRms / Math.sqrt(3) * worldSpeedScale;
    s[`vx${i}`] = sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const u3 = Math.random();
    const u4 = Math.random();
    s[`vy${i}`] = sigma * Math.sqrt(-2 * Math.log(u3)) * Math.cos(2 * Math.PI * u4);
  }
  s.brownX = BOX_W / 2;
  s.brownY = BOX_H / 2;
  s.brownVx = 0;
  s.brownVy = 0;
  s.t = 0;
  return s;
}

// ---------------------------------------------------------------------------
// Gas Laws initial state  (static diagram; we animate via parameter change)
// ---------------------------------------------------------------------------
function createGasLawState(): ThermoState {
  return { t: 0 };
}

// ---------------------------------------------------------------------------
// Liquid Column initial state
// ---------------------------------------------------------------------------
function createLiquidColumnState(): ThermoState {
  return { t: 0 };
}

// ---------------------------------------------------------------------------
// Piston-Cylinder initial state
// ---------------------------------------------------------------------------
function createPistonCylinderState(): ThermoState {
  return { t: 0 };
}

// ---------------------------------------------------------------------------
// Unified initial state factory
// ---------------------------------------------------------------------------
function createInitialState(): ThermoState {
  const scene = panel.getValue<string>('scene') as SceneName;
  switch (scene) {
    case '理想气体':
    case '布朗运动':
      return createParticleState();
    case '气体定律':
      return createGasLawState();
    case '液柱密封模型':
      return createLiquidColumnState();
    case '气缸活塞模型':
      return createPistonCylinderState();
    default:
      return createParticleState();
  }
}

// ---------------------------------------------------------------------------
// Step function – particles
// ---------------------------------------------------------------------------
function createParticleStepFn() {
  return (_t: number, dt: number, state: ThermoState): ThermoState => {
    const n = getN();
    const s: ThermoState = { ...state, t: state.t + dt };
    const isBrownian = panel.getValue<string>('scene') === '布朗运动';
    wallCollisions = 0;

    // Move particles
    for (let i = 0; i < n; i++) {
      s[`px${i}`] += s[`vx${i}`] * dt;
      s[`py${i}`] += s[`vy${i}`] * dt;

      if (s[`px${i}`] < PARTICLE_R) { s[`px${i}`] = PARTICLE_R; s[`vx${i}`] *= -1; wallCollisions++; }
      if (s[`px${i}`] > BOX_W - PARTICLE_R) { s[`px${i}`] = BOX_W - PARTICLE_R; s[`vx${i}`] *= -1; wallCollisions++; }
      if (s[`py${i}`] < PARTICLE_R) { s[`py${i}`] = PARTICLE_R; s[`vy${i}`] *= -1; wallCollisions++; }
      if (s[`py${i}`] > BOX_H - PARTICLE_R) { s[`py${i}`] = BOX_H - PARTICLE_R; s[`vy${i}`] *= -1; wallCollisions++; }
    }

    // Inter-particle elastic collisions
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = s[`px${j}`] - s[`px${i}`];
        const dy = s[`py${j}`] - s[`py${i}`];
        const distSq = dx * dx + dy * dy;
        const minDist = PARTICLE_R * 2;
        if (distSq < minDist * minDist && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const dvx = s[`vx${i}`] - s[`vx${j}`];
          const dvy = s[`vy${i}`] - s[`vy${j}`];
          const dvDotN = dvx * nx + dvy * ny;
          if (dvDotN > 0) {
            s[`vx${i}`] -= dvDotN * nx;
            s[`vy${i}`] -= dvDotN * ny;
            s[`vx${j}`] += dvDotN * nx;
            s[`vy${j}`] += dvDotN * ny;
          }
          const overlap = minDist - dist;
          if (overlap > 0) {
            s[`px${i}`] -= nx * overlap * 0.5;
            s[`py${i}`] -= ny * overlap * 0.5;
            s[`px${j}`] += nx * overlap * 0.5;
            s[`py${j}`] += ny * overlap * 0.5;
          }
        }
      }
    }

    // Brownian particle interactions
    if (isBrownian) {
      s.brownX += s.brownVx * dt;
      s.brownY += s.brownVy * dt;
      if (s.brownX < BROWN_R) { s.brownX = BROWN_R; s.brownVx *= -1; }
      if (s.brownX > BOX_W - BROWN_R) { s.brownX = BOX_W - BROWN_R; s.brownVx *= -1; }
      if (s.brownY < BROWN_R) { s.brownY = BROWN_R; s.brownVy *= -1; }
      if (s.brownY > BOX_H - BROWN_R) { s.brownY = BOX_H - BROWN_R; s.brownVy *= -1; }

      for (let i = 0; i < n; i++) {
        const dx = s[`px${i}`] - s.brownX;
        const dy = s[`py${i}`] - s.brownY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = PARTICLE_R + BROWN_R;
        if (dist < minDist && dist > 0) {
          const nx = dx / dist, ny = dy / dist;
          const massRatio = 0.1;
          const dvx = s[`vx${i}`] - s.brownVx;
          const dvy = s[`vy${i}`] - s.brownVy;
          const dvDotN = dvx * nx + dvy * ny;
          if (dvDotN < 0) {
            const j = 2 * dvDotN / (1 + massRatio);
            s[`vx${i}`] -= j * nx;
            s[`vy${i}`] -= j * ny;
            s.brownVx += j * nx * massRatio;
            s.brownVy += j * ny * massRatio;
          }
          const overlap = minDist - dist;
          s[`px${i}`] += nx * overlap * 0.5;
          s[`py${i}`] += ny * overlap * 0.5;
          s.brownX -= nx * overlap * 0.5;
          s.brownY -= ny * overlap * 0.5;
        }
      }
    }

    return s;
  };
}

// ---------------------------------------------------------------------------
// Step function – static scenes (gas laws, liquid column, piston)
// ---------------------------------------------------------------------------
function createStaticStepFn() {
  return (_t: number, dt: number, state: ThermoState): ThermoState => {
    const s: ThermoState = { ...state, t: state.t + dt };
    return s;
  };
}

// ---------------------------------------------------------------------------
// Unified step function factory
// ---------------------------------------------------------------------------
function createStepFn() {
  const scene = panel.getValue<string>('scene') as SceneName;
  switch (scene) {
    case '理想气体':
    case '布朗运动':
      return createParticleStepFn();
    default:
      return createStaticStepFn();
  }
}

// ---------------------------------------------------------------------------
// Brownian trail
// ---------------------------------------------------------------------------
const brownTrail: { x: number; y: number }[] = [];

// ===================================================================
// RENDER: Ideal Gas / Brownian (original scenes)
// ===================================================================
function renderParticleScene(_t: number, state: ThermoState): void {
  const scene = panel.getValue<string>('scene');
  const n = getN();
  const showV = panel.getValue<boolean>('showVelocity');
  const showDist = panel.getValue<boolean>('showDistribution');

  updateOrigin();
  cm.clear('#070b14');
  const ctx = cm.ctx;

  // Draw box with glow effect
  const [bx1, by1] = cm.toScreen(0, BOX_H);
  const [bx2, by2] = cm.toScreen(BOX_W, 0);
  // Outer glow
  ctx.shadowColor = 'rgba(96, 165, 250, 0.15)';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);
  ctx.shadowBlur = 0;
  // Main border
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(bx1, by1, bx2 - bx1, by2 - by1);
  // Corner highlights
  const cornerLen = 10;
  ctx.strokeStyle = 'rgba(96, 165, 250, 0.6)';
  ctx.lineWidth = 2;
  for (const [cx2, cy2] of [[bx1, by1], [bx2, by1], [bx1, by2], [bx2, by2]]) {
    const dx2 = cx2 === bx1 ? 1 : -1;
    const dy2 = cy2 === by1 ? 1 : -1;
    ctx.beginPath();
    ctx.moveTo(cx2, cy2 + dy2 * cornerLen);
    ctx.lineTo(cx2, cy2);
    ctx.lineTo(cx2 + dx2 * cornerLen, cy2);
    ctx.stroke();
  }

  // Temperature indicator with gradient background
  const T = panel.getValue<number>('temperature');
  // Temperature-dependent background tint inside box
  const tFracBg = Math.min(1, T / 2000);
  const bgR = Math.floor(tFracBg * 40);
  const bgB = Math.floor((1 - tFracBg) * 20);
  const boxGrad = ctx.createRadialGradient(
    (bx1 + bx2) / 2, (by1 + by2) / 2, 0,
    (bx1 + bx2) / 2, (by1 + by2) / 2, (bx2 - bx1) * 0.7
  );
  boxGrad.addColorStop(0, `rgba(${bgR + 10}, ${5 + bgR / 4}, ${bgB + 10}, 0.15)`);
  boxGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = boxGrad;
  ctx.fillRect(bx1, by1, bx2 - bx1, by2 - by1);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`T = ${T} K`, 20, 30);
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`粒子数: ${n}`, 20, 52);
  // Show theoretical RMS speed for N₂ molecule
  const kBDisplay = 1.38e-23;
  const mDisplay = 4.65e-26; // N₂
  const vRmsTheory = Math.sqrt(3 * kBDisplay * T / mDisplay);
  ctx.fillText(`v_rms = √(3kT/m) = ${vRmsTheory.toFixed(0)} m/s (N₂)`, 20, 70);

  const speeds: number[] = [];

  // Compute adaptive max speed for color mapping
  let totalSpeedSq = 0;
  for (let i = 0; i < n; i++) {
    const vx = state[`vx${i}`];
    const vy = state[`vy${i}`];
    totalSpeedSq += vx * vx + vy * vy;
  }
  const rmsSpeed = Math.sqrt(totalSpeedSq / Math.max(1, n));
  const maxSpeedForColor = rmsSpeed * 2.5; // map to 2.5x RMS

  for (let i = 0; i < n; i++) {
    const px = state[`px${i}`];
    const py = state[`py${i}`];
    const vx = state[`vx${i}`];
    const vy = state[`vy${i}`];
    const speed = Math.sqrt(vx * vx + vy * vy);
    speeds.push(speed);

    const [sx, sy] = cm.toScreen(px, py);
    const r = PARTICLE_R * cm.getScale();

    const frac = Math.min(1, speed / Math.max(1, maxSpeedForColor));
    // Cool (blue/cyan) -> warm (orange/red) color mapping
    const red = Math.floor(60 + frac * 195);
    const green = Math.floor(120 - frac * 80);
    const blue = Math.floor(255 - frac * 220);
    const particleColor = `rgb(${red}, ${green}, ${blue})`;

    // Glow for fast particles
    if (frac > 0.4) {
      ctx.save();
      ctx.shadowColor = particleColor;
      ctx.shadowBlur = 4 + frac * 10;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.fill();
      ctx.restore();
    } else {
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = particleColor;
      ctx.fill();
    }

    if (showV) {
      const arrowScale = Math.min(5, 3 / Math.max(0.1, rmsSpeed / 5));
      ctx.strokeStyle = `rgba(${red},${green},${blue},0.6)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + vx * arrowScale, sy - vy * arrowScale);
      ctx.stroke();
    }
  }

  // Brownian particle
  if (scene === '布朗运动') {
    const [bsx, bsy] = cm.toScreen(state.brownX, state.brownY);
    const br = BROWN_R * cm.getScale();

    brownTrail.push({ x: state.brownX, y: state.brownY });
    if (brownTrail.length > 800) brownTrail.shift();

    // Trail with fading gradient
    if (brownTrail.length > 1) {
      for (let i = 1; i < brownTrail.length; i++) {
        const alpha = (i / brownTrail.length) * 0.6;
        ctx.strokeStyle = `rgba(251, 191, 36, ${alpha.toFixed(3)})`;
        ctx.lineWidth = 0.5 + (i / brownTrail.length) * 2;
        const [tx1, ty1] = cm.toScreen(brownTrail[i - 1].x, brownTrail[i - 1].y);
        const [tx2, ty2] = cm.toScreen(brownTrail[i].x, brownTrail[i].y);
        ctx.beginPath();
        ctx.moveTo(tx1, ty1);
        ctx.lineTo(tx2, ty2);
        ctx.stroke();
      }
    }

    // Brownian particle with multi-layer glow
    ctx.save();
    ctx.shadowColor = 'rgba(251, 191, 36, 0.5)';
    ctx.shadowBlur = 15;
    const brownGrad = ctx.createRadialGradient(bsx - br * 0.2, bsy - br * 0.3, br * 0.1, bsx, bsy, br);
    brownGrad.addColorStop(0, '#fff7c2');
    brownGrad.addColorStop(0.4, '#fbbf24');
    brownGrad.addColorStop(1, '#b45309');
    ctx.beginPath();
    ctx.arc(bsx, bsy, br, 0, Math.PI * 2);
    ctx.fillStyle = brownGrad;
    ctx.fill();
    ctx.restore();

    // Specular highlight
    ctx.beginPath();
    ctx.ellipse(bsx - br * 0.2, bsy - br * 0.25, br * 0.35, br * 0.2, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('花粉颗粒', bsx, bsy - br - 10);
  }

  // Speed distribution graph with Maxwell-Boltzmann overlay
  if (showDist && speeds.length > 0) {
    const bins = 25;
    const maxGraphSpeed = maxSpeedForColor * 1.2;
    const binW = maxGraphSpeed / bins;
    const hist = new Array(bins).fill(0);
    for (const sp of speeds) {
      const idx = Math.min(bins - 1, Math.floor(sp / binW));
      hist[idx]++;
    }
    // Normalize histogram to probability density
    const total = speeds.length;
    const histNorm = hist.map((h: number) => h / (total * binW));
    const xData = histNorm.map((_: number, i: number) => (i + 0.5) * binW);

    // Maxwell-Boltzmann theoretical curve: f(v) = 4π n (m/(2πkT))^(3/2) v² exp(-mv²/(2kT))
    // In 2D: f(v) = (m/(kT)) * v * exp(-mv²/(2kT))
    const T = panel.getValue<number>('temperature');
    const kB = 1.38e-23;
    const mMol = 4.65e-26;
    const vScale = Math.sqrt(3 * kB * T / mMol) / 500;
    const effectiveKT = (vScale * 500) * (vScale * 500) * mMol / 3; // back-derive effective kT
    const mbX: number[] = [];
    const mbY: number[] = [];
    for (let i = 0; i < 100; i++) {
      const v = (i + 0.5) * maxGraphSpeed / 100;
      // 2D Maxwell-Boltzmann: f(v) = (m/(kT)) * v * exp(-mv²/(2kT))
      // Using scaled velocities: use effective temperature
      const mOverKT = mMol / effectiveKT;
      const fv = mOverKT * v * Math.exp(-mOverKT * v * v / 2);
      // Scale to match histogram normalization (our velocities are scaled)
      mbX.push(v);
      mbY.push(fv);
    }

    const traces: GraphTrace[] = [
      { x: xData, y: histNorm, name: '模拟分布', color: '#60a5fa' },
      { x: mbX, y: mbY, name: 'M-B理论', color: '#f87171' },
    ];
    graph.setTraces(traces);
    graph.updateTitle(`速率分布 (T=${T}K, N=${n})`);
  } else {
    timeData.push(state.t);
    pressureData.push(wallCollisions);
    if (timeData.length > 300) {
      timeData.splice(0, timeData.length - 300);
      pressureData.splice(0, pressureData.length - 300);
    }
    graph.setTraces([{ x: timeData, y: pressureData, name: '壁面碰撞次数', color: '#4ade80' }]);
  }
  graph.updateCurrentTime(state.t);
  graph.render();
}

// ===================================================================
// RENDER: Gas Laws (气体定律)
// ===================================================================
function renderGasLaws(_t: number, state: ThermoState): void {
  const ctx = cm.ctx;
  updateOrigin();
  cm.clear('#070b14');

  const process = panel.getValue<string>('gasProcess');
  const T = panel.getValue<number>('gasT');
  const V = panel.getValue<number>('gasV');
  const P = panel.getValue<number>('gasP');

  // Derived constant nR = PV/T  (in kPa * L / K)
  const nR = P * V / T;

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('气体定律 (Gas Laws)', cm.getWidth() / 2, 28);

  // ---- Left half: P-V diagram with piston cylinder ----
  // ---- Right half: Graph ----

  const midX = cm.getWidth() / 2;

  // =========================================================
  // Draw piston/cylinder diagram (left side)
  // =========================================================
  const cylLeft = 60;
  const cylTop = 60;
  const cylWidth = 180;
  const cylMaxH = 280;

  // Map V to cylinder height (V ranges 1..20, height ranges 40..cylMaxH)
  const vFrac = (V - 1) / 19;
  const gasH = 40 + vFrac * (cylMaxH - 40);
  const pistonY = cylTop + (cylMaxH - gasH);

  // Cylinder walls
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cylLeft, cylTop);
  ctx.lineTo(cylLeft, cylTop + cylMaxH);
  ctx.lineTo(cylLeft + cylWidth, cylTop + cylMaxH);
  ctx.lineTo(cylLeft + cylWidth, cylTop);
  ctx.stroke();

  // Gas fill
  ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
  ctx.fillRect(cylLeft + 2, pistonY, cylWidth - 4, cylTop + cylMaxH - pistonY);

  // Gas particles (animated decorative)
  ctx.fillStyle = 'rgba(96, 165, 250, 0.5)';
  const gasArea = cylWidth * gasH;
  const numDots = Math.min(60, Math.max(8, Math.floor(gasArea / 300)));
  // Use time-based animation for particle positions
  const animT = state.t;
  for (let i = 0; i < numDots; i++) {
    const seed = i * 7919 + Math.floor(V * 100);
    const baseRx = ((seed * 37) % (cylWidth - 20));
    const baseRy = ((seed * 53) % Math.max(1, gasH - 20));
    // Add sinusoidal jitter based on time to simulate thermal motion
    const speedFactor = T / 300; // faster at higher T
    const jitterX = Math.sin(animT * (2 + i * 0.3) * speedFactor + seed) * (4 + speedFactor * 3);
    const jitterY = Math.cos(animT * (1.5 + i * 0.2) * speedFactor + seed * 1.7) * (4 + speedFactor * 3);
    const rx = cylLeft + 10 + ((baseRx + jitterX + cylWidth - 20) % (cylWidth - 20));
    const ry = pistonY + 10 + Math.abs((baseRy + jitterY) % Math.max(1, gasH - 20));

    // Color based on temperature
    const tFrac = Math.min(1, T / 1500);
    const r2 = Math.floor(60 + tFrac * 195);
    const g2 = Math.floor(120 - tFrac * 60);
    const b2 = Math.floor(255 - tFrac * 200);

    ctx.save();
    if (tFrac > 0.3) {
      ctx.shadowColor = `rgba(${r2},${g2},${b2},0.4)`;
      ctx.shadowBlur = 4 + tFrac * 6;
    }
    ctx.beginPath();
    ctx.arc(rx, ry, 2 + tFrac, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${r2},${g2},${b2},0.7)`;
    ctx.fill();
    ctx.restore();
  }

  // Piston
  ctx.fillStyle = '#94a3b8';
  ctx.fillRect(cylLeft + 2, pistonY - 8, cylWidth - 4, 10);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1;
  ctx.strokeRect(cylLeft + 2, pistonY - 8, cylWidth - 4, 10);

  // Piston handle
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cylLeft + cylWidth / 2, pistonY - 8);
  ctx.lineTo(cylLeft + cylWidth / 2, pistonY - 30);
  ctx.stroke();

  // Labels on cylinder
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Gas', cylLeft + cylWidth / 2, pistonY + (cylTop + cylMaxH - pistonY) / 2 + 5);

  // =========================================================
  // PV/T verification display
  // =========================================================
  const infoX = 60;
  const infoY = cylTop + cylMaxH + 30;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`P = ${P.toFixed(1)} kPa`, infoX, infoY);
  ctx.fillText(`V = ${V.toFixed(1)} L`, infoX, infoY + 20);
  ctx.fillText(`T = ${T.toFixed(0)} K`, infoX, infoY + 40);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`PV/T = ${(P * V / T).toFixed(3)} kPa·L/K = nR`, infoX, infoY + 65);

  // =========================================================
  // Right side: appropriate graph
  // =========================================================
  const graphLeft = midX + 30;
  const graphTop = 60;
  const graphW = midX - 80;
  const graphH = 300;

  // Graph frame
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1;
  ctx.strokeRect(graphLeft, graphTop, graphW, graphH);

  // Axes
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(graphLeft, graphTop + graphH);
  ctx.lineTo(graphLeft + graphW, graphTop + graphH);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(graphLeft, graphTop);
  ctx.lineTo(graphLeft, graphTop + graphH);
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';

  if (process === '等温过程') {
    // p-V hyperbola: pV = const = P*V (from current values)
    const pv = nR * T; // = P * V
    ctx.fillText('V (L)', graphLeft + graphW / 2, graphTop + graphH + 18);
    ctx.save();
    ctx.translate(graphLeft - 16, graphTop + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('P (kPa)', 0, 0);
    ctx.restore();

    // Draw hyperbola
    const vMin = 0.5, vMax = 50;
    const pMax = pv / vMin;
    const pMin = pv / vMax;
    const pScale = graphH / (pMax * 1.1);

    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 200; i++) {
      const vi = vMin + (vMax - vMin) * i / 200;
      const pi = pv / vi;
      const sx = graphLeft + ((vi - vMin) / (vMax - vMin)) * graphW;
      const sy = graphTop + graphH - pi * pScale;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();

    // Current point
    const cpx = graphLeft + ((V - vMin) / (vMax - vMin)) * graphW;
    const cpy = graphTop + graphH - P * pScale;
    ctx.beginPath();
    ctx.arc(cpx, cpy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    // Label
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`等温过程 pV = ${pv.toFixed(0)} kPa·L (T=${T}K)`, graphLeft + graphW / 2, graphTop - 8);

    // Axis tick labels
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    for (let v = 2; v <= 20; v += 4) {
      const sx = graphLeft + ((v - vMin) / (vMax - vMin)) * graphW;
      ctx.fillText(v.toString(), sx, graphTop + graphH + 14);
    }
    ctx.textAlign = 'right';
    for (let p = 0; p <= pMax * 1.1; p += Math.ceil(pMax / 5 / 50) * 50) {
      if (p === 0) continue;
      const sy = graphTop + graphH - p * pScale;
      if (sy < graphTop) break;
      ctx.fillText(p.toFixed(0), graphLeft - 4, sy + 4);
    }

  } else if (process === '等压过程') {
    // V-T line through origin: V/T = const
    const vOverT = V / T;
    ctx.fillText('T (K)', graphLeft + graphW / 2, graphTop + graphH + 18);
    ctx.save();
    ctx.translate(graphLeft - 16, graphTop + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('V (L)', 0, 0);
    ctx.restore();

    const tMin = 0, tMax = 800;
    const vAtTMax = vOverT * tMax;
    const vGraphMax = Math.max(25, vAtTMax * 1.1);
    const vScale = graphH / vGraphMax;

    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(graphLeft, graphTop + graphH);
    const endV = vOverT * tMax;
    const endSy = graphTop + graphH - endV * vScale;
    ctx.lineTo(graphLeft + graphW, Math.max(graphTop, endSy));
    ctx.stroke();

    // Current point
    const cpx = graphLeft + (T / tMax) * graphW;
    const cpy = graphTop + graphH - V * vScale;
    ctx.beginPath();
    ctx.arc(cpx, cpy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`等压过程 V/T = ${vOverT.toFixed(4)} L/K (P=${P.toFixed(0)}kPa)`, graphLeft + graphW / 2, graphTop - 8);

    // Axis ticks
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    for (let tt = 100; tt <= tMax; tt += 100) {
      const sx = graphLeft + (tt / tMax) * graphW;
      ctx.fillText(tt.toString(), sx, graphTop + graphH + 14);
    }
    ctx.textAlign = 'right';
    for (let vv = 5; vv <= vGraphMax; vv += 5) {
      const sy = graphTop + graphH - vv * vScale;
      if (sy < graphTop) break;
      ctx.fillText(vv.toFixed(0), graphLeft - 4, sy + 4);
    }

  } else {
    // 等容过程: p-T line through origin: p/T = const
    const pOverT = P / T;
    ctx.fillText('T (K)', graphLeft + graphW / 2, graphTop + graphH + 18);
    ctx.save();
    ctx.translate(graphLeft - 16, graphTop + graphH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('P (kPa)', 0, 0);
    ctx.restore();

    const tMin = 0, tMax = 800;
    const pAtTMax = pOverT * tMax;
    const pGraphMax = Math.max(600, pAtTMax * 1.1);
    const pScale = graphH / pGraphMax;

    ctx.strokeStyle = '#f472b6';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(graphLeft, graphTop + graphH);
    const endP = pOverT * tMax;
    const endSy = graphTop + graphH - endP * pScale;
    ctx.lineTo(graphLeft + graphW, Math.max(graphTop, endSy));
    ctx.stroke();

    // Current point
    const cpx = graphLeft + (T / tMax) * graphW;
    const cpy = graphTop + graphH - P * pScale;
    ctx.beginPath();
    ctx.arc(cpx, cpy, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#f97316';
    ctx.fill();

    ctx.fillStyle = '#f472b6';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`等容过程 P/T = ${pOverT.toFixed(3)} kPa/K (V=${V.toFixed(1)}L)`, graphLeft + graphW / 2, graphTop - 8);

    // Axis ticks
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    for (let tt = 100; tt <= tMax; tt += 100) {
      const sx = graphLeft + (tt / tMax) * graphW;
      ctx.fillText(tt.toString(), sx, graphTop + graphH + 14);
    }
    ctx.textAlign = 'right';
    for (let pp = 100; pp <= pGraphMax; pp += 100) {
      const sy = graphTop + graphH - pp * pScale;
      if (sy < graphTop) break;
      ctx.fillText(pp.toFixed(0), graphLeft - 4, sy + 4);
    }
  }

  // Process label
  const processLabels: Record<string, string> = {
    '等温过程': '等温过程 (Isothermal): pV = const',
    '等压过程': '等压过程 (Isobaric): V/T = const',
    '等容过程': '等容过程 (Isochoric): p/T = const',
  };
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(processLabels[process] ?? '', 60, cm.getHeight() - 10);

  // Hide bottom graph for this scene
  graph.setTraces([]);
  graph.render();
}

// ===================================================================
// RENDER: Liquid Column Sealed Gas (液柱密封模型)
// ===================================================================
function renderLiquidColumn(_t: number, _state: ThermoState): void {
  const ctx = cm.ctx;
  updateOrigin();
  cm.clear('#070b14');

  const orientation = panel.getValue<string>('tubeOrientation');
  const T1 = panel.getValue<number>('lcT1');
  const T2 = panel.getValue<number>('lcT2');
  const L1 = panel.getValue<number>('lcL1'); // cm
  const h = panel.getValue<number>('lcH');   // cm, liquid column
  const P0 = panel.getValue<number>('lcPAtm'); // cmHg

  // Pressure calculation depends on orientation
  let P1: number; // gas pressure in cmHg
  let P2: number;
  let orientationLabel: string;

  if (orientation === '竖直开口向上') {
    // Gas at bottom, liquid above: P_gas = P_atm + rho*g*h = P0 + h
    P1 = P0 + h;
    // After temperature change, liquid column might shift but P_gas still = P0 + h
    // (assuming liquid doesn't spill; for sealed gas P2 stays same orientation)
    P2 = P0 + h;
    orientationLabel = '竖直开口向上 (gas at closed bottom)';
  } else if (orientation === '竖直开口向下') {
    // Gas at top (closed end), liquid below: P_gas = P_atm - h
    P1 = P0 - h;
    P2 = P0 - h;
    orientationLabel = '竖直开口向下 (gas at closed top)';
  } else {
    // Horizontal: P_gas = P_atm (liquid column doesn't affect pressure)
    P1 = P0;
    P2 = P0;
    orientationLabel = '水平 (horizontal)';
  }

  // Gas law: P1 * L1 / T1 = P2 * L2 / T2  =>  L2 = P1 * L1 * T2 / (T1 * P2)
  const L2 = (P1 * L1 * T2) / (T1 * P2);

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('液柱密封气体模型', cm.getWidth() / 2, 28);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(orientationLabel, cm.getWidth() / 2, 48);

  // =========================================================
  // Draw tubes side by side: initial state (T1) and final state (T2)
  // =========================================================
  const canW = cm.getWidth();
  const canH = cm.getHeight();

  // Scale: total tube content = gas + liquid + open portion
  const maxTubeContent = Math.max(L1, L2) + h + 10; // extra space for open end
  const tubePixelH = canH - 140; // pixels for tube
  const scale = tubePixelH / maxTubeContent; // pixels per cm

  const tubeW = 50;

  // --- Draw one tube ---
  function drawTube(cx: number, topY: number, gasLen: number, liqLen: number, label: string, temp: number, pGas: number) {
    const tubeLeft = cx - tubeW / 2;

    // Determine drawing order based on orientation
    let gasStartY: number, gasEndY: number;
    let liqStartY: number, liqEndY: number;

    if (orientation === '竖直开口向上') {
      // Bottom: closed end. Gas at bottom, liquid above, open top.
      const bottomY = topY + tubePixelH;
      gasStartY = bottomY - gasLen * scale;
      gasEndY = bottomY;
      liqStartY = gasStartY - liqLen * scale;
      liqEndY = gasStartY;

      // Closed bottom
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tubeLeft, topY);
      ctx.lineTo(tubeLeft, bottomY);
      ctx.lineTo(tubeLeft + tubeW, bottomY);
      ctx.lineTo(tubeLeft + tubeW, topY);
      ctx.stroke();

    } else if (orientation === '竖直开口向下') {
      // Top: closed end. Gas at top, liquid below, open bottom.
      gasStartY = topY;
      gasEndY = topY + gasLen * scale;
      liqStartY = gasEndY;
      liqEndY = gasEndY + liqLen * scale;

      const bottomY = topY + tubePixelH;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tubeLeft, topY);
      ctx.lineTo(tubeLeft, bottomY);
      ctx.lineTo(tubeLeft + tubeW, bottomY);
      ctx.lineTo(tubeLeft + tubeW, topY);
      ctx.stroke();

      // Closed top
      ctx.beginPath();
      ctx.moveTo(tubeLeft, topY);
      ctx.lineTo(tubeLeft + tubeW, topY);
      ctx.stroke();

    } else {
      // Horizontal: draw vertically but label as horizontal
      // For visualization still draw vertical tube, just note orientation
      const bottomY = topY + tubePixelH;
      gasStartY = bottomY - gasLen * scale;
      gasEndY = bottomY;
      liqStartY = gasStartY - liqLen * scale;
      liqEndY = gasStartY;

      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tubeLeft, topY);
      ctx.lineTo(tubeLeft, bottomY);
      ctx.lineTo(tubeLeft + tubeW, bottomY);
      ctx.lineTo(tubeLeft + tubeW, topY);
      ctx.stroke();
    }

    // Gas fill (light blue)
    ctx.fillStyle = 'rgba(96, 165, 250, 0.2)';
    ctx.fillRect(tubeLeft + 2, gasStartY, tubeW - 4, gasEndY - gasStartY);

    // Gas label
    ctx.fillStyle = 'rgba(96, 165, 250, 0.8)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Gas', cx, (gasStartY + gasEndY) / 2 + 4);

    // Liquid fill (darker blue)
    ctx.fillStyle = 'rgba(37, 99, 235, 0.5)';
    ctx.fillRect(tubeLeft + 2, liqStartY, tubeW - 4, liqEndY - liqStartY);

    // Liquid label
    ctx.fillStyle = 'rgba(37, 99, 235, 0.9)';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('液柱', cx, (liqStartY + liqEndY) / 2 + 4);

    // Dimension lines for gas column length
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(tubeLeft + tubeW + 8, gasStartY);
    ctx.lineTo(tubeLeft + tubeW + 8, gasEndY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Arrow heads
    ctx.beginPath();
    ctx.moveTo(tubeLeft + tubeW + 4, gasStartY);
    ctx.lineTo(tubeLeft + tubeW + 12, gasStartY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tubeLeft + tubeW + 4, gasEndY);
    ctx.lineTo(tubeLeft + tubeW + 12, gasEndY);
    ctx.stroke();

    ctx.fillStyle = '#fbbf24';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${gasLen.toFixed(1)}cm`, tubeLeft + tubeW + 14, (gasStartY + gasEndY) / 2 + 4);

    // Label below tube
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, topY + tubePixelH + 20);
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`T = ${temp} K`, cx, topY + tubePixelH + 38);
    ctx.fillText(`P_gas = ${pGas.toFixed(1)} cmHg`, cx, topY + tubePixelH + 54);
  }

  const tube1X = canW * 0.25;
  const tube2X = canW * 0.55;
  const tubeTopY = 70;

  drawTube(tube1X, tubeTopY, L1, h, '初始状态', T1, P1);
  drawTube(tube2X, tubeTopY, L2, h, '末状态', T2, P2);

  // =========================================================
  // Calculation steps on the right
  // =========================================================
  const calcX = canW * 0.75;
  let calcY = 80;
  const lineH = 22;

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('计算过程:', calcX - 40, calcY);
  calcY += lineH + 4;

  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#94a3b8';

  const steps = [
    `P_atm = ${P0} cmHg`,
    `液柱长 h = ${h} cm`,
    '',
  ];

  if (orientation === '竖直开口向上') {
    steps.push('气体在封闭底端:');
    steps.push(`P1 = P_atm + h = ${P0} + ${h} = ${P1} cmHg`);
  } else if (orientation === '竖直开口向下') {
    steps.push('气体在封闭顶端:');
    steps.push(`P1 = P_atm - h = ${P0} - ${h} = ${P1} cmHg`);
  } else {
    steps.push('水平放置:');
    steps.push(`P1 = P_atm = ${P0} cmHg`);
  }

  steps.push('');
  steps.push(`P2 = ${P2.toFixed(1)} cmHg`);
  steps.push('');
  steps.push('由气体定律:');
  steps.push(`P1·L1/T1 = P2·L2/T2`);
  steps.push(`${P1.toFixed(1)}×${L1}/${T1} = ${P2.toFixed(1)}×L2/${T2}`);
  steps.push('');
  steps.push(`L2 = P1·L1·T2 / (T1·P2)`);
  steps.push(`L2 = ${P1.toFixed(1)}×${L1}×${T2} / (${T1}×${P2.toFixed(1)})`);

  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  steps.push(`L2 = ${L2.toFixed(2)} cm`);

  for (const line of steps) {
    if (line === '') { calcY += 6; continue; }
    if (line.startsWith('L2 = ') && line.includes('.')) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    }
    ctx.fillText(line, calcX - 40, calcY);
    calcY += lineH;
  }

  // Verify
  calcY += 6;
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  const verify1 = (P1 * L1 / T1).toFixed(4);
  const verify2 = (P2 * L2 / T2).toFixed(4);
  ctx.fillText(`验证: P1L1/T1 = ${verify1}`, calcX - 40, calcY);
  calcY += lineH;
  ctx.fillText(`      P2L2/T2 = ${verify2}`, calcX - 40, calcY);

  graph.setTraces([]);
  graph.render();
}

// ===================================================================
// RENDER: Piston-Cylinder (气缸活塞模型)
// ===================================================================
function renderPistonCylinder(_t: number, _state: ThermoState): void {
  const ctx = cm.ctx;
  updateOrigin();
  cm.clear('#070b14');

  const orientation = panel.getValue<string>('cylinderOrientation');
  const T1 = panel.getValue<number>('pcT1');
  const deltaT = panel.getValue<number>('pcDeltaT');
  const T2 = T1 + deltaT;
  const pistonMass = panel.getValue<number>('pcPistonMass'); // kg
  const S = panel.getValue<number>('pcArea'); // cm2
  const L1 = panel.getValue<number>('pcL1'); // cm
  const P0_kPa = panel.getValue<number>('pcPAtm'); // kPa

  const g = 9.8; // m/s^2
  const S_m2 = S * 1e-4; // m^2

  // Pressure balance
  let P1: number; // kPa
  let pressureFormula: string;
  if (orientation === '竖直') {
    // Piston on top: P_gas = P_atm + mg/S
    const mgOverS = (pistonMass * g) / S_m2 / 1000; // kPa
    P1 = P0_kPa + mgOverS;
    pressureFormula = `P = P_atm + mg/S = ${P0_kPa} + ${mgOverS.toFixed(2)} = ${P1.toFixed(2)} kPa`;
  } else {
    // Horizontal: P_gas = P_atm (piston weight doesn't matter)
    P1 = P0_kPa;
    pressureFormula = `P = P_atm = ${P0_kPa} kPa (水平, 活塞重力不影响)`;
  }

  // After heating: piston can move freely, so pressure stays the same (isobaric)
  const P2 = P1;
  // Gas law: P1*V1/T1 = P2*V2/T2, with V = L*S (same S)
  // P1*L1/T1 = P2*L2/T2 => L2 = L1 * T2 / T1  (since P1 = P2)
  const L2 = L1 * T2 / T1;

  const V1 = L1 * S; // cm^3
  const V2 = L2 * S; // cm^3

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('气缸活塞模型', cm.getWidth() / 2, 28);

  const canW = cm.getWidth();
  const canH = cm.getHeight();

  // =========================================================
  // Draw two cylinders: initial and final state
  // =========================================================
  const cylW = 100;
  const maxCylH = 260;
  const cylTopBase = 70;

  function drawCylinder(cx: number, gasLen: number, label: string, temp: number, pressure: number, volume: number) {
    const cylLeft = cx - cylW / 2;

    // Scale gas length to pixel height
    const maxL = Math.max(L1, L2, 1);
    const gasPixH = (gasLen / (maxL * 1.3)) * maxCylH;
    const cylH = maxCylH;
    const cylTop = cylTopBase;
    const cylBottom = cylTop + cylH;

    if (orientation === '竖直') {
      // Vertical: gas at bottom, piston on top
      const gasTop = cylBottom - gasPixH;

      // Cylinder walls
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(cylLeft, cylTop);
      ctx.lineTo(cylLeft, cylBottom);
      ctx.lineTo(cylLeft + cylW, cylBottom);
      ctx.lineTo(cylLeft + cylW, cylTop);
      ctx.stroke();

      // Gas fill
      ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
      ctx.fillRect(cylLeft + 2, gasTop, cylW - 4, cylBottom - gasTop - 2);

      // Gas label
      ctx.fillStyle = 'rgba(96, 165, 250, 0.8)';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Gas', cx, (gasTop + cylBottom) / 2 + 4);

      // Piston (at gasTop)
      ctx.fillStyle = '#64748b';
      ctx.fillRect(cylLeft + 3, gasTop - 12, cylW - 6, 14);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(cylLeft + 3, gasTop - 12, cylW - 6, 14);

      // Piston mass label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`m=${pistonMass}kg`, cx, gasTop - 16);

      // Weight arrow on piston
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx, gasTop - 4);
      ctx.lineTo(cx, gasTop + 16);
      ctx.stroke();
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(cx - 4, gasTop + 12);
      ctx.lineTo(cx, gasTop + 18);
      ctx.lineTo(cx + 4, gasTop + 12);
      ctx.fill();
      ctx.fillStyle = '#f87171';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('mg', cx + 14, gasTop + 10);

      // Atmospheric pressure arrow
      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, gasTop - 36);
      ctx.lineTo(cx, gasTop - 14);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 3, gasTop - 18);
      ctx.lineTo(cx, gasTop - 12);
      ctx.lineTo(cx + 3, gasTop - 18);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('P_atm', cx + 16, gasTop - 24);

    } else {
      // Horizontal cylinder (draw horizontally)
      const hCylLeft = cx - maxCylH / 2;
      const hCylRight = hCylLeft + maxCylH;
      const hCylTop = cylTopBase + 60;
      const hCylBot = hCylTop + cylW;

      // Gas fills from left (closed end)
      const gasPixW = (gasLen / (maxL * 1.3)) * maxCylH;

      // Cylinder outline
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hCylLeft, hCylTop);
      ctx.lineTo(hCylRight, hCylTop);
      ctx.lineTo(hCylRight, hCylBot);
      ctx.lineTo(hCylLeft, hCylBot);
      ctx.lineTo(hCylLeft, hCylTop);
      ctx.stroke();

      // Gas fill
      ctx.fillStyle = 'rgba(96, 165, 250, 0.15)';
      ctx.fillRect(hCylLeft + 2, hCylTop + 2, gasPixW - 2, cylW - 4);

      ctx.fillStyle = 'rgba(96, 165, 250, 0.8)';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Gas', hCylLeft + gasPixW / 2, hCylTop + cylW / 2 + 4);

      // Piston
      ctx.fillStyle = '#64748b';
      ctx.fillRect(hCylLeft + gasPixW, hCylTop + 3, 14, cylW - 6);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(hCylLeft + gasPixW, hCylTop + 3, 14, cylW - 6);

      // Label
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`m=${pistonMass}kg`, hCylLeft + gasPixW + 7, hCylTop - 6);

      // Closed end marker
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(hCylLeft, hCylTop);
      ctx.lineTo(hCylLeft, hCylBot);
      ctx.stroke();
    }

    // Info below
    const infoY = orientation === '竖直' ? cylBottom + 16 : cylTopBase + 60 + cylW + 20;
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, cx, infoY);

    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(`T = ${temp.toFixed(0)} K`, cx, infoY + 18);
    ctx.fillText(`P = ${pressure.toFixed(2)} kPa`, cx, infoY + 36);
    ctx.fillText(`L = ${gasLen.toFixed(2)} cm`, cx, infoY + 54);
    ctx.fillText(`V = ${volume.toFixed(1)} cm³`, cx, infoY + 72);
  }

  const cyl1X = canW * 0.22;
  const cyl2X = canW * 0.52;
  drawCylinder(cyl1X, L1, '初始状态', T1, P1, V1);
  drawCylinder(cyl2X, L2 > 0 ? L2 : 0.1, '加热后', T2, P2, V2 > 0 ? V2 : 0);

  // =========================================================
  // Calculation panel on the right
  // =========================================================
  const calcX = canW * 0.76;
  let calcY = 80;
  const lineH = 21;

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('压强平衡与气体定律:', calcX - 20, calcY);
  calcY += lineH + 6;

  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#94a3b8';

  const calcLines: string[] = [
    pressureFormula,
    '',
    `T1 = ${T1} K, T2 = T1 + deltaT = ${T2} K`,
    `L1 = ${L1} cm, S = ${S} cm²`,
    '',
    '活塞可自由移动 => 等压过程',
    `P1 = P2 = ${P1.toFixed(2)} kPa`,
    '',
    'P1·L1·S / T1 = P2·L2·S / T2',
    '=> L2 = L1 × T2 / T1',
    `=> L2 = ${L1} × ${T2} / ${T1}`,
  ];

  for (const line of calcLines) {
    if (line === '') { calcY += 4; continue; }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(line, calcX - 20, calcY);
    calcY += lineH;
  }

  // Result
  calcY += 4;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`L2 = ${L2.toFixed(2)} cm`, calcX - 20, calcY);
  calcY += lineH;
  ctx.fillText(`V2 = L2·S = ${V2.toFixed(1)} cm³`, calcX - 20, calcY);
  calcY += lineH + 8;

  // Verification
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  const check1 = (P1 * V1 / T1).toFixed(4);
  const check2 = (P2 * V2 / T2).toFixed(4);
  ctx.fillText(`验证: PV/T`, calcX - 20, calcY);
  calcY += lineH;
  ctx.fillText(`  初态: ${check1} kPa·cm³/K`, calcX - 20, calcY);
  calcY += lineH;
  ctx.fillText(`  末态: ${check2} kPa·cm³/K`, calcX - 20, calcY);

  // Arrow between cylinders
  if (deltaT !== 0) {
    const arrowY = orientation === '竖直' ? cylTopBase + maxCylH / 2 : cylTopBase + 60 + cylW / 2;
    const ax1 = canW * 0.34;
    const ax2 = canW * 0.40;
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ax1, arrowY);
    ctx.lineTo(ax2, arrowY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ax2 - 6, arrowY - 4);
    ctx.lineTo(ax2, arrowY);
    ctx.lineTo(ax2 - 6, arrowY + 4);
    ctx.fillStyle = '#f97316';
    ctx.fill();
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(deltaT > 0 ? '加热' : '冷却', (ax1 + ax2) / 2, arrowY - 10);
  }

  graph.setTraces([]);
  graph.render();
}

// ===================================================================
// Unified render dispatcher
// ===================================================================
function renderScene(t: number, state: ThermoState): void {
  const scene = panel.getValue<string>('scene') as SceneName;
  switch (scene) {
    case '理想气体':
    case '布朗运动':
      renderParticleScene(t, state);
      break;
    case '气体定律':
      renderGasLaws(t, state);
      break;
    case '液柱密封模型':
      renderLiquidColumn(t, state);
      break;
    case '气缸活塞模型':
      renderPistonCylinder(t, state);
      break;
    default:
      renderParticleScene(t, state);
  }
  controls.updateTime(state.t);
}

// ---------------------------------------------------------------------------
// Simulation loop
// ---------------------------------------------------------------------------
const sim = new SimLoop<ThermoState>({
  dt: 1 / 60,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: createInitialState(),
});

controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => {
  timeData.length = 0; pressureData.length = 0; brownTrail.length = 0;
  sim.reset(createInitialState());
  sim.updateStepFn(createStepFn());
  controls.setPlaying(false);
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

panel.setOnChange(() => {
  updateParamVisibility();
  timeData.length = 0; pressureData.length = 0; brownTrail.length = 0;
  sim.reset(createInitialState());
  sim.updateStepFn(createStepFn());
});

// Initial visibility setup & render
updateParamVisibility();
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
