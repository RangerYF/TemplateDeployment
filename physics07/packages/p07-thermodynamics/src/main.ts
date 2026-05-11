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
const MIN_KELVIN = 1;
const GAS_VOLUME_MIN = 0.5;
const GAS_VOLUME_MAX = 50;
const GAS_CYLINDER_MIN_HEIGHT = 40;
const GAS_GRAPH_MAX_T = 1500;

type SceneName = '气体分子微观模拟' | '三种气体实验' | '液柱密封模型' | '气缸/双活塞模型' | '布朗运动';
type SnapshotPayload = {
  params: Record<string, number | string | boolean>;
  sim: {
    t: number;
    speed: number;
    seed: number;
    engineVersion: 'p07-thermo-v1';
    /** Legacy fallback for snapshots created before seed-based replay. */
    state?: ThermoState;
  };
  results: Record<string, never>;
};

type TemplateSnapshot = {
  envelope: {
    templateKey: 'p07';
    runtimeKey: 'physics-p07-thermodynamics';
    bridgeVersion: '1.0.0';
    snapshotSchemaVersion: 1;
    createdAt: string;
    updatedAt: string;
  };
  payload: SnapshotPayload;
};

type SnapshotValidationResult = {
  ok: boolean;
  errors: string[];
};

type TemplateBridge = {
  getDefaultSnapshot: () => TemplateSnapshot;
  getSnapshot: () => TemplateSnapshot;
  loadSnapshot: (snapshot: unknown) => SnapshotValidationResult;
  validateSnapshot: (snapshot: unknown) => SnapshotValidationResult;
};

declare global {
  interface Window {
    __EDUMIND_TEMPLATE_BRIDGE__?: TemplateBridge;
  }
}

const TEMPLATE_KEY = 'p07';
const RUNTIME_KEY = 'physics-p07-thermodynamics';
const BRIDGE_VERSION = '1.0.0';
const SNAPSHOT_SCHEMA_VERSION = 1;
const ENGINE_VERSION = 'p07-thermo-v1';

// ---------------------------------------------------------------------------
// Layout & UI
// ---------------------------------------------------------------------------
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-07 热力学模拟器');

const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '气体分子微观模拟',
    options: ['气体分子微观模拟', '三种气体实验', '液柱密封模型', '气缸/双活塞模型', '布朗运动'] },
  // --- Ideal gas / Brownian ---
  { key: 'temperature', label: '温度 T', unit: 'K', min: 1, max: 2000, step: 10, default: 300,
    scenes: ['气体分子微观模拟', '布朗运动'] },
  { key: 'numParticles', label: '粒子数', unit: '', min: 20, max: 200, step: 10, default: 100,
    scenes: ['气体分子微观模拟', '布朗运动'] },
  { key: 'showVelocity', label: '显示速度箭头', type: 'checkbox', default: false,
    scenes: ['气体分子微观模拟', '布朗运动'] },
  { key: 'showDistribution', label: '显示速率分布', type: 'checkbox', default: true,
    scenes: ['气体分子微观模拟', '布朗运动'] },
  // --- Gas Laws ---
  { key: 'gasT', label: '温度 T', unit: 'K', min: 1, max: 1500, step: 10, default: 300,
    scenes: ['三种气体实验'] },
  { key: 'gasV', label: '体积 V', unit: 'L', min: 0.5, max: 50, step: 0.5, default: 10,
    scenes: ['三种气体实验'] },
  { key: 'gasP', label: '压强 P', unit: 'kPa', min: 10, max: 1000, step: 10, default: 100,
    scenes: ['三种气体实验'] },
  // --- Liquid Column ---
  { key: 'tubeOrientation', label: '管方向', type: 'select', default: '竖直开口向上',
    options: ['竖直开口向上', '竖直开口向下', '水平', '倾斜开口向上', '倾斜开口向下'],
    scenes: ['液柱密封模型'] },
  { key: 'lcT1', label: '初始温度 T1', unit: 'K', min: 1, max: 1000, step: 5, default: 300,
    scenes: ['液柱密封模型'] },
  { key: 'lcT2', label: '末温度 T2', unit: 'K', min: 1, max: 1000, step: 5, default: 400,
    scenes: ['液柱密封模型'] },
  { key: 'lcL1', label: '气柱长 L1', unit: 'cm', min: 2, max: 60, step: 1, default: 20,
    scenes: ['液柱密封模型'] },
  { key: 'lcH', label: '液柱长 h', unit: 'cm', min: 1, max: 50, step: 1, default: 10,
    scenes: ['液柱密封模型'] },
  { key: 'lcAngle', label: '倾角 θ', unit: '°', min: 5, max: 85, step: 1, default: 30,
    scenes: ['液柱密封模型'] },
  { key: 'lcArea', label: '截面积 S', unit: 'cm2', min: 1, max: 20, step: 0.5, default: 4,
    scenes: ['液柱密封模型'] },
  { key: 'lcPAtm', label: '大气压 P0', unit: 'cmHg', min: 50, max: 100, step: 1, default: 76,
    scenes: ['液柱密封模型'] },
  // --- Piston-Cylinder ---
  { key: 'pcMode', label: '模型类型', type: 'select', default: '单活塞',
    options: ['单活塞', '双活塞对称'],
    scenes: ['气缸/双活塞模型'] },
  { key: 'cylinderOrientation', label: '气缸方向', type: 'select', default: '竖直',
    options: ['竖直', '水平'],
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcT1', label: '初始温度 T', unit: 'K', min: 1, max: 1000, step: 5, default: 300,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcDeltaT', label: '加热 deltaT', unit: 'K', min: -200, max: 500, step: 5, default: 100,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcPistonMass', label: '活塞质量 m', unit: 'kg', min: 0, max: 20, step: 0.5, default: 2,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcArea', label: '截面积 S', unit: 'cm2', min: 5, max: 200, step: 5, default: 50,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcL1', label: '初始气柱长 L', unit: 'cm', min: 5, max: 60, step: 1, default: 20,
    scenes: ['气缸/双活塞模型'] },
  { key: 'pcPAtm', label: '大气压 P0', unit: 'kPa', min: 50, max: 200, step: 1, default: 101,
    scenes: ['气缸/双活塞模型'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });
function updateOrigin(): void {
  cm.setOrigin(80, cm.getHeight() - 60);
}
updateOrigin();
cm.setScale(45);
const controls = new PlaybackControls(layout.controlBar);
let autoPlayTimer: number | undefined;
let currentSeed = Date.now() >>> 0;

const paramDefByKey = new Map(paramDefs.map((def) => [def.key, def]));

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
  '气体分子微观模拟': ['temperature', 'numParticles', 'showVelocity', 'showDistribution'],
  '布朗运动': ['temperature', 'numParticles', 'showVelocity', 'showDistribution'],
  '三种气体实验': ['gasT', 'gasV', 'gasP'],
  '液柱密封模型': ['tubeOrientation', 'lcT1', 'lcT2', 'lcL1', 'lcH', 'lcAngle', 'lcArea', 'lcPAtm'],
  '气缸/双活塞模型': ['pcMode', 'cylinderOrientation', 'pcT1', 'pcDeltaT', 'pcPistonMass', 'pcArea', 'pcL1', 'pcPAtm'],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isTiltedLiquidColumn(orientation: string): boolean {
  return orientation.startsWith('倾斜');
}

function getLiquidColumnEffectiveHeight(): number {
  const orientation = panel.getValue<string>('tubeOrientation');
  const liquidLength = panel.getValue<number>('lcH');
  if (!isTiltedLiquidColumn(orientation)) return liquidLength;
  const angleDeg = panel.getValue<number>('lcAngle');
  return liquidLength * Math.sin(angleDeg * Math.PI / 180);
}

function isNegativePressureLiquidColumn(orientation: string): boolean {
  return orientation === '竖直开口向下' || orientation === '倾斜开口向下';
}

function sanitizeLiquidColumnInputs(): void {
  if (panel.getValue<string>('scene') !== '液柱密封模型') return;

  const pAtm = panel.getValue<number>('lcPAtm');
  const orientation = panel.getValue<string>('tubeOrientation');
  if (!isNegativePressureLiquidColumn(orientation)) return;

  const liquidLength = panel.getValue<number>('lcH');
  const effectiveHeight = getLiquidColumnEffectiveHeight();
  if (effectiveHeight < pAtm) return;

  const angleDeg = panel.getValue<number>('lcAngle');
  const scale = isTiltedLiquidColumn(orientation)
    ? Math.max(0.01, Math.sin(angleDeg * Math.PI / 180))
    : 1;
  const maxLiquidLength = Math.max(1, (pAtm - 1) / scale);

  if (liquidLength > maxLiquidLength) {
    panel.setValue('lcH', Math.floor(maxLiquidLength));
  }
}

function sanitizePistonInputs(): void {
  if (panel.getValue<string>('scene') !== '气缸/双活塞模型') return;

  const T1 = panel.getValue<number>('pcT1');
  const deltaT = panel.getValue<number>('pcDeltaT');
  const step = 5;
  const minDeltaT = Math.ceil((MIN_KELVIN - T1) / step) * step;

  if (deltaT < minDeltaT) {
    panel.setValue('pcDeltaT', minDeltaT);
  }
}

function sanitizeSceneInputs(): void {
  sanitizeLiquidColumnInputs();
  sanitizePistonInputs();
}

function clampParamValue(key: string, value: number | string | boolean): number | string | boolean {
  const def = paramDefByKey.get(key);
  if (!def) return value;

  if (def.type === 'select') {
    return typeof value === 'string' && def.options?.includes(value) ? value : def.default;
  }

  if (def.type === 'checkbox') {
    return typeof value === 'boolean' ? value : Boolean(value);
  }

  const num = Number(value);
  if (!Number.isFinite(num)) return def.default;
  return clamp(num, def.min ?? num, def.max ?? num);
}

function setPanelValues(values: Record<string, number | string | boolean>): void {
  for (const def of paramDefs) {
    const nextValue = Object.prototype.hasOwnProperty.call(values, def.key)
      ? values[def.key]
      : def.default;
    panel.setValue(def.key, clampParamValue(def.key, nextValue));
  }
  sanitizeSceneInputs();
  updateParamVisibility();
}

function updateParamVisibility(): void {
  const scene = panel.getValue<string>('scene');
  const visibleKeys = new Set(sceneParamMap[scene] ?? []);
  visibleKeys.add('scene'); // always show scene selector
  const tubeOrientation = panel.getValue<string>('tubeOrientation');
  const showTiltAngle = scene === '液柱密封模型' && isTiltedLiquidColumn(tubeOrientation);
  const pcMode = panel.getValue<string>('pcMode');
  const showCylinderOrientation = scene === '气缸/双活塞模型' && pcMode === '单活塞';

  // Walk through all param rows in the sidebar
  const rows = (layout.sidebar as HTMLElement).querySelectorAll('.param-row');
  for (const row of rows) {
    const input = row.querySelector('[data-key]') as HTMLElement | null;
    if (!input) continue;
    const key = input.dataset.key!;
    let isVisible = visibleKeys.has(key);
    if (key === 'lcAngle') isVisible = isVisible && showTiltAngle;
    if (key === 'cylinderOrientation') isVisible = isVisible && showCylinderOrientation;
    (row as HTMLElement).style.display = isVisible ? '' : 'none';
  }
}

// ---------------------------------------------------------------------------
// Per-scene data
// ---------------------------------------------------------------------------
const timeData: number[] = [];
const pressureData: number[] = [];
let wallCollisions = 0;

function getN(): number { return Math.min(200, Math.floor(panel.getValue<number>('numParticles'))); }

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function getNumberParam(values: Record<string, number | string | boolean>, key: string): number {
  return Number(clampParamValue(key, values[key]));
}

function createParticleStateFromValues(values: Record<string, number | string | boolean>, seed = currentSeed): ThermoState {
  const random = createSeededRandom(seed);
  const T = getNumberParam(values, 'temperature');
  const n = Math.min(200, Math.floor(getNumberParam(values, 'numParticles')));
  const kB = 1.38e-23;
  const m = 4.65e-26; // N2 molecule mass
  const vRms = Math.sqrt(3 * kB * T / m);
  const worldSpeedScale = 4.0 / Math.sqrt(3 * kB * 300 / m);

  const s: ThermoState = {};
  for (let i = 0; i < n; i++) {
    s[`px${i}`] = random() * (BOX_W - 2) + 1;
    s[`py${i}`] = random() * (BOX_H - 2) + 1;
    const u1 = random();
    const u2 = random();
    const sigma = vRms / Math.sqrt(3) * worldSpeedScale;
    s[`vx${i}`] = sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    const u3 = random();
    const u4 = random();
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
// Ideal gas / Brownian initial state
// ---------------------------------------------------------------------------
function createParticleState(): ThermoState {
  return createParticleStateFromValues(panel.getValues(), currentSeed);
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
  return createInitialStateFromValues(panel.getValues(), scene);
}

function createInitialStateFromValues(
  values: Record<string, number | string | boolean>,
  scene = values.scene as SceneName,
  seed = currentSeed
): ThermoState {
  switch (scene) {
    case '气体分子微观模拟':
    case '布朗运动':
      return createParticleStateFromValues(values, seed);
    case '三种气体实验':
      return createGasLawState();
    case '液柱密封模型':
      return createLiquidColumnState();
    case '气缸/双活塞模型':
      return createPistonCylinderState();
    default:
      return createParticleStateFromValues(values, seed);
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
    case '气体分子微观模拟':
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
// RENDER: Gas Laws Comparison (三种气体实验)
// ===================================================================
function renderGasLaws(_t: number, state: ThermoState): void {
  const ctx = cm.ctx;
  updateOrigin();
  cm.clear('#070b14');

  const T = panel.getValue<number>('gasT');
  const V = panel.getValue<number>('gasV');
  const P = panel.getValue<number>('gasP');
  const nR = P * V / T;
  const pvConst = nR * T;
  const vtConst = nR / P;
  const ptConst = nR / V;

  const processes = [
    {
      key: 'isothermal',
      title: '等温',
      subtitle: 'T 不变，p 与 V 成反比',
      color: '#60a5fa',
      T,
      V,
      P: nR * T / V,
      law: `pV = ${pvConst.toFixed(1)} kPa·L`,
      invariant: `T = ${T.toFixed(0)} K`,
    },
    {
      key: 'isobaric',
      title: '等压',
      subtitle: 'P 不变，V 与 T 成正比',
      color: '#4ade80',
      T,
      V: nR * T / P,
      P,
      law: `V/T = ${vtConst.toFixed(4)} L/K`,
      invariant: `P = ${P.toFixed(1)} kPa`,
    },
    {
      key: 'isochoric',
      title: '等容',
      subtitle: 'V 不变，P 与 T 成正比',
      color: '#f472b6',
      T,
      V,
      P: nR * T / V,
      law: `P/T = ${ptConst.toFixed(3)} kPa/K`,
      invariant: `V = ${V.toFixed(1)} L`,
    },
  ] as const;

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('三种气体实验对比', cm.getWidth() / 2, 28);
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('同一组参考态下，并排观察等温、等压、等容三类变化关系', cm.getWidth() / 2, 48);

  function drawProcessCylinder(left: number, top: number, width: number, height: number, process: typeof processes[number]): void {
    const gasHeight = GAS_CYLINDER_MIN_HEIGHT + clamp((process.V - GAS_VOLUME_MIN) / (GAS_VOLUME_MAX - GAS_VOLUME_MIN), 0, 1) * (height - GAS_CYLINDER_MIN_HEIGHT);
    const pistonY = top + height - gasHeight;

    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, top, width, height);

    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fillRect(left, top, width, height);
    ctx.fillStyle = `${process.color}22`;
    ctx.fillRect(left + 2, pistonY, width - 4, top + height - pistonY - 2);

    const gasArea = width * gasHeight;
    const particleCount = Math.min(28, Math.max(10, Math.floor(gasArea / 1200)));
    for (let i = 0; i < particleCount; i++) {
      const seed = i * 6151 + process.title.charCodeAt(0) * 17;
      const baseRx = ((seed * 37) % Math.max(1, width - 26));
      const baseRy = ((seed * 53) % Math.max(1, gasHeight - 26));
      const speedFactor = process.T / 300;
      const jitterX = Math.sin(state.t * (1.8 + i * 0.25) * speedFactor + seed) * (2 + speedFactor * 2);
      const jitterY = Math.cos(state.t * (1.3 + i * 0.18) * speedFactor + seed * 1.9) * (2 + speedFactor * 2);
      const rx = left + 12 + ((baseRx + jitterX + width - 26) % Math.max(1, width - 26));
      const ry = pistonY + 12 + Math.abs((baseRy + jitterY) % Math.max(1, gasHeight - 26));

      ctx.beginPath();
      ctx.arc(rx, ry, 2.2, 0, Math.PI * 2);
      ctx.fillStyle = process.color;
      ctx.fill();
    }

    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(left + 4, pistonY - 8, width - 8, 10);
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.strokeRect(left + 4, pistonY - 8, width - 8, 10);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(process.title, left, top - 10);
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(process.subtitle, left, top + height + 18);
    ctx.fillStyle = process.color;
    ctx.fillText(process.invariant, left, top + height + 36);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillText(`P=${process.P.toFixed(1)} kPa`, left, top + height + 56);
    ctx.fillText(`V=${process.V.toFixed(1)} L`, left, top + height + 74);
    ctx.fillText(`T=${process.T.toFixed(0)} K`, left, top + height + 92);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(process.law, left, top + height + 112);
  }

  function drawMiniGraph(left: number, top: number, width: number, height: number, process: typeof processes[number]): void {
    const frameBottom = top + height;
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(left, top, width, height);

    ctx.strokeStyle = 'rgba(255,255,255,0.32)';
    ctx.beginPath();
    ctx.moveTo(left, frameBottom);
    ctx.lineTo(left + width, frameBottom);
    ctx.moveTo(left, top);
    ctx.lineTo(left, frameBottom);
    ctx.stroke();

    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#94a3b8';

    if (process.key === 'isothermal') {
      const vMin = GAS_VOLUME_MIN;
      const vMax = GAS_VOLUME_MAX;
      const pMax = pvConst / vMin;
      const pScale = height / (pMax * 1.1);

      ctx.strokeStyle = process.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i <= 180; i++) {
        const vi = vMin + (vMax - vMin) * i / 180;
        const pi = pvConst / vi;
        const x = left + ((vi - vMin) / (vMax - vMin)) * width;
        const y = frameBottom - pi * pScale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();

      const px = left + ((process.V - vMin) / (vMax - vMin)) * width;
      const py = frameBottom - process.P * pScale;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('V', left + width - 10, frameBottom + 14);
      ctx.save();
      ctx.translate(left - 12, top + height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('P', 0, 0);
      ctx.restore();
    } else if (process.key === 'isobaric') {
      const tMax = GAS_GRAPH_MAX_T;
      const vMax = Math.max(25, vtConst * tMax * 1.1);
      const vScale = height / vMax;

      ctx.strokeStyle = process.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, frameBottom);
      const endY = frameBottom - vtConst * tMax * vScale;
      ctx.lineTo(left + width, Math.max(top, endY));
      ctx.stroke();

      const px = left + (process.T / tMax) * width;
      const py = frameBottom - process.V * vScale;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('T', left + width - 10, frameBottom + 14);
      ctx.save();
      ctx.translate(left - 12, top + height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('V', 0, 0);
      ctx.restore();
    } else {
      const tMax = GAS_GRAPH_MAX_T;
      const pMax = Math.max(600, ptConst * tMax * 1.1);
      const pScale = height / pMax;

      ctx.strokeStyle = process.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(left, frameBottom);
      const endY = frameBottom - ptConst * tMax * pScale;
      ctx.lineTo(left + width, Math.max(top, endY));
      ctx.stroke();

      const px = left + (process.T / tMax) * width;
      const py = frameBottom - process.P * pScale;
      ctx.beginPath();
      ctx.arc(px, py, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#f97316';
      ctx.fill();

      ctx.fillStyle = '#94a3b8';
      ctx.fillText('T', left + width - 10, frameBottom + 14);
      ctx.save();
      ctx.translate(left - 12, top + height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('P', 0, 0);
      ctx.restore();
    }
  }

  const canW = cm.getWidth();
  const colGap = 34;
  const colWidth = (canW - 120 - colGap * 2) / 3;
  const colLefts = [60, 60 + colWidth + colGap, 60 + (colWidth + colGap) * 2];
  const cylinderTop = 90;
  const cylinderHeight = 180;
  const graphTop = 420;
  const graphHeight = 150;

  processes.forEach((process, index) => {
    const left = colLefts[index];
    drawProcessCylinder(left, cylinderTop, colWidth, cylinderHeight, process);
    drawMiniGraph(left, graphTop, colWidth, graphHeight, process);
  });

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`参考态: P = ${P.toFixed(1)} kPa, V = ${V.toFixed(1)} L, T = ${T.toFixed(0)} K`, 60, 610);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`统一状态方程: pV/T = ${nR.toFixed(3)} kPa·L/K`, 60, 632);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('调左侧参数后，三张卡片和三幅关系图同步更新，便于同屏比较三类过程。', 60, 652);

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
  const angle = panel.getValue<number>('lcAngle');
  const area = panel.getValue<number>('lcArea');
  const P0 = panel.getValue<number>('lcPAtm'); // cmHg
  const effectiveHeight = getLiquidColumnEffectiveHeight();

  // Pressure calculation depends on orientation
  let P1: number; // gas pressure in cmHg
  let P2: number;
  let orientationLabel: string;
  let pressureStepText: string;

  if (orientation === '竖直开口向上') {
    P1 = P0 + effectiveHeight;
    P2 = P1;
    orientationLabel = '竖直开口向上 (gas at closed bottom)';
    pressureStepText = `P1 = P_atm + h = ${P0} + ${effectiveHeight.toFixed(1)} = ${P1.toFixed(1)} cmHg`;
  } else if (orientation === '竖直开口向下') {
    P1 = P0 - effectiveHeight;
    P2 = P1;
    orientationLabel = '竖直开口向下 (gas at closed top)';
    pressureStepText = `P1 = P_atm - h = ${P0} - ${effectiveHeight.toFixed(1)} = ${P1.toFixed(1)} cmHg`;
  } else if (orientation === '倾斜开口向上') {
    P1 = P0 + effectiveHeight;
    P2 = P1;
    orientationLabel = `倾斜开口向上 (θ=${angle.toFixed(0)}°)`;
    pressureStepText = `P1 = P_atm + h·sinθ = ${P0} + ${h.toFixed(1)}×sin${angle.toFixed(0)}° = ${P1.toFixed(1)} cmHg`;
  } else if (orientation === '倾斜开口向下') {
    P1 = P0 - effectiveHeight;
    P2 = P1;
    orientationLabel = `倾斜开口向下 (θ=${angle.toFixed(0)}°)`;
    pressureStepText = `P1 = P_atm - h·sinθ = ${P0} - ${h.toFixed(1)}×sin${angle.toFixed(0)}° = ${P1.toFixed(1)} cmHg`;
  } else {
    P1 = P0;
    P2 = P0;
    orientationLabel = '水平 (horizontal)';
    pressureStepText = `P1 = P_atm = ${P0.toFixed(1)} cmHg`;
  }

  // Gas law: P1 * L1 / T1 = P2 * L2 / T2  =>  L2 = P1 * L1 * T2 / (T1 * P2)
  const L2 = (P1 * L1 * T2) / (T1 * P2);
  const V1 = L1 * area;
  const V2 = L2 * area;

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('液柱密封气体模型', cm.getWidth() / 2, 28);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(orientationLabel, cm.getWidth() / 2, 48);

  if (isTiltedLiquidColumn(orientation)) {
    const guideX = 70;
    const guideY = 92;
    const guideLen = 90;
    const dx = guideLen * Math.cos(angle * Math.PI / 180);
    const dy = guideLen * Math.sin(angle * Math.PI / 180);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(guideX, guideY + 20);
    ctx.lineTo(guideX + dx, guideY + 20 - dy);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(guideX, guideY + 20);
    ctx.lineTo(guideX + dx, guideY + 20);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(guideX, guideY + 20, 18, -Math.atan2(dy, dx), 0);
    ctx.strokeStyle = '#60a5fa';
    ctx.stroke();
    ctx.fillStyle = '#60a5fa';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`θ=${angle.toFixed(0)}°`, guideX + 22, guideY + 14);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`等效液柱高度 = h·sinθ = ${effectiveHeight.toFixed(1)} cm`, guideX, guideY + 42);
  }

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

    if (orientation === '竖直开口向上' || orientation === '倾斜开口向上') {
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

    } else if (orientation === '竖直开口向下' || orientation === '倾斜开口向下') {
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
    ctx.fillText(`V = ${(gasLen * area).toFixed(1)} cm³`, cx, topY + tubePixelH + 70);
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
    `截面积 S = ${area.toFixed(1)} cm²`,
    '',
  ];

  if (orientation === '竖直开口向上') {
    steps.push('气体在封闭底端:');
    steps.push(pressureStepText);
  } else if (orientation === '竖直开口向下') {
    steps.push('气体在封闭顶端:');
    steps.push(pressureStepText);
  } else if (orientation === '倾斜开口向上') {
    steps.push('倾斜管开口高端:');
    steps.push(`等效液柱高度 h_eff = h·sinθ = ${effectiveHeight.toFixed(1)} cm`);
    steps.push(pressureStepText);
  } else if (orientation === '倾斜开口向下') {
    steps.push('倾斜管开口低端:');
    steps.push(`等效液柱高度 h_eff = h·sinθ = ${effectiveHeight.toFixed(1)} cm`);
    steps.push(pressureStepText);
  } else {
    steps.push('水平放置:');
    steps.push(pressureStepText);
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
  steps.push(`V2 = L2·S = ${L2.toFixed(2)}×${area.toFixed(1)} = ${V2.toFixed(1)} cm³`);

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
  calcY += lineH;
  ctx.fillText(`      V1 = ${V1.toFixed(1)} cm³, V2 = ${V2.toFixed(1)} cm³`, calcX - 40, calcY);

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

  const mode = panel.getValue<string>('pcMode');
  const orientation = panel.getValue<string>('cylinderOrientation');
  const T1 = panel.getValue<number>('pcT1');
  const deltaT = panel.getValue<number>('pcDeltaT');
  const T2 = Math.max(MIN_KELVIN, T1 + deltaT);
  const pistonMass = panel.getValue<number>('pcPistonMass'); // kg
  const S = panel.getValue<number>('pcArea'); // cm2
  const L1 = panel.getValue<number>('pcL1'); // cm
  const P0_kPa = panel.getValue<number>('pcPAtm'); // kPa

  const g = 9.8; // m/s^2
  const S_m2 = S * 1e-4; // m^2
  const canW = cm.getWidth();
  const canH = cm.getHeight();

  if (mode === '双活塞对称') {
    const P1 = P0_kPa;
    const P2 = P0_kPa;
    const L2 = L1 * T2 / T1;
    const V1Total = 2 * L1 * S;
    const V2Total = 2 * L2 * S;

    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 20px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('气缸/双活塞模型', canW / 2, 28);
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('双活塞对称模式：两侧外界压强相同，升温时两活塞同步向外移动', canW / 2, 48);

    function drawDoublePistonState(cx: number, halfLen: number, label: string, temp: number, volume: number): void {
      const frameW = 250;
      const frameH = 92;
      const top = 150;
      const pistonW = 16;
      const maxHalfLen = Math.max(L1, L2, 1);
      const gasHalfPix = (halfLen / (maxHalfLen * 1.3)) * 84;
      const leftWall = cx - frameW / 2;
      const rightWall = cx + frameW / 2;
      const innerTop = top;
      const innerBottom = top + frameH;
      const gasLeft = cx - gasHalfPix;
      const gasRight = cx + gasHalfPix;

      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      ctx.strokeRect(leftWall, innerTop, frameW, frameH);

      ctx.fillStyle = 'rgba(96, 165, 250, 0.14)';
      ctx.fillRect(gasLeft, innerTop + 3, gasRight - gasLeft, frameH - 6);

      ctx.fillStyle = '#64748b';
      ctx.fillRect(gasLeft - pistonW, innerTop + 4, pistonW, frameH - 8);
      ctx.fillRect(gasRight, innerTop + 4, pistonW, frameH - 8);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.strokeRect(gasLeft - pistonW, innerTop + 4, pistonW, frameH - 8);
      ctx.strokeRect(gasRight, innerTop + 4, pistonW, frameH - 8);

      ctx.fillStyle = '#60a5fa';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Gas', cx, top + frameH / 2 + 4);

      ctx.strokeStyle = '#60a5fa';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(leftWall - 22, top + frameH / 2);
      ctx.lineTo(leftWall - 4, top + frameH / 2);
      ctx.moveTo(rightWall + 4, top + frameH / 2);
      ctx.lineTo(rightWall + 22, top + frameH / 2);
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(label, cx, top + frameH + 24);
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`T = ${temp.toFixed(0)} K`, cx, top + frameH + 42);
      ctx.fillText(`每侧气柱长 L = ${halfLen.toFixed(2)} cm`, cx, top + frameH + 60);
      ctx.fillText(`总容积 V = ${volume.toFixed(1)} cm³`, cx, top + frameH + 78);
      ctx.fillText(`两侧压强 P = ${P1.toFixed(2)} kPa`, cx, top + frameH + 96);
    }

    const state1X = canW * 0.24;
    const state2X = canW * 0.54;
    drawDoublePistonState(state1X, L1, '初始状态', T1, V1Total);
    drawDoublePistonState(state2X, L2, deltaT >= 0 ? '加热后' : '冷却后', T2, V2Total);

    if (deltaT !== 0) {
      const arrowY = 196;
      const ax1 = canW * 0.36;
      const ax2 = canW * 0.42;
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
      ctx.fillText(deltaT > 0 ? '两活塞向外' : '两活塞向内', (ax1 + ax2) / 2, arrowY - 10);
    }

    const calcX = canW * 0.77;
    let calcY = 90;
    const lineH = 22;
    const lines = [
      '双活塞对称模型',
      `外界压强相同: P_left = P_right = P0 = ${P0_kPa.toFixed(2)} kPa`,
      `初温 T1 = ${T1} K, 末温 T2 = ${T2} K`,
      `每侧初始气柱长 L1 = ${L1} cm, 截面积 S = ${S} cm²`,
      '',
      '总容积 V = 2LS',
      `V1 = 2×${L1}×${S} = ${V1Total.toFixed(1)} cm³`,
      '',
      '压强始终平衡 => 等压变化',
      'P1·V1/T1 = P2·V2/T2',
      'P0·(2L1S)/T1 = P0·(2L2S)/T2',
      '=> L2 = L1 × T2 / T1',
      `=> L2 = ${L1} × ${T2} / ${T1} = ${L2.toFixed(2)} cm`,
      `=> V2 = 2×${L2.toFixed(2)}×${S} = ${V2Total.toFixed(1)} cm³`,
      '',
      `移动方向: ${deltaT > 0 ? '两侧活塞同时向外' : deltaT < 0 ? '两侧活塞同时向内' : '活塞保持不动'}`,
      `末态压强: P_left = P_right = ${P2.toFixed(2)} kPa`,
    ];

    ctx.textAlign = 'left';
    for (const line of lines) {
      if (line === '') {
        calcY += 6;
        continue;
      }
      ctx.fillStyle = line.includes('=>') || line.includes('移动方向') || line.includes('末态压强')
        ? '#fbbf24'
        : '#94a3b8';
      ctx.font = line === '双活塞对称模型'
        ? 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif'
        : '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(line, calcX - 40, calcY);
      calcY += lineH;
    }

    calcY += 4;
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`验证: P1V1/T1 = ${(P1 * V1Total / T1).toFixed(4)}`, calcX - 40, calcY);
    calcY += lineH;
    ctx.fillText(`      P2V2/T2 = ${(P2 * V2Total / T2).toFixed(4)}`, calcX - 40, calcY);

    graph.setTraces([]);
    graph.render();
    return;
  }

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
    pressureFormula = `P = P_atm = ${P0_kPa} kPa (水平，活塞重力不影响)`;
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
  ctx.fillText('气缸/双活塞模型', cm.getWidth() / 2, 28);
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`单活塞模式 · ${orientation}放置`, cm.getWidth() / 2, 48);

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
    case '气体分子微观模拟':
    case '布朗运动':
      renderParticleScene(t, state);
      break;
    case '三种气体实验':
      renderGasLaws(t, state);
      break;
    case '液柱密封模型':
      renderLiquidColumn(t, state);
      break;
    case '气缸/双活塞模型':
      renderPistonCylinder(t, state);
      break;
    default:
      renderParticleScene(t, state);
  }
  controls.updateTime(state.t);
}

function createEnvelope(createdAt?: string): TemplateSnapshot['envelope'] {
  const now = new Date().toISOString();
  return {
    templateKey: TEMPLATE_KEY,
    runtimeKey: RUNTIME_KEY,
    bridgeVersion: BRIDGE_VERSION,
    snapshotSchemaVersion: SNAPSHOT_SCHEMA_VERSION,
    createdAt: createdAt ?? now,
    updatedAt: now,
  };
}

function createSnapshot(payload: SnapshotPayload, createdAt?: string): TemplateSnapshot {
  return {
    envelope: createEnvelope(createdAt),
    payload,
  };
}

function cloneState(state: ThermoState): ThermoState {
  return { ...state };
}

function getDefaultParams(): Record<string, number | string | boolean> {
  const values: Record<string, number | string | boolean> = {};
  for (const def of paramDefs) values[def.key] = def.default;
  return values;
}

function getDefaultSnapshot(): TemplateSnapshot {
  const params = getDefaultParams();
  const seed = 1;
  return createSnapshot({
    params,
    sim: {
      t: 0,
      speed: 1,
      seed,
      engineVersion: ENGINE_VERSION,
    },
    results: {},
  });
}

function getSnapshot(): TemplateSnapshot {
  return createSnapshot({
    params: panel.getValues(),
    sim: {
      t: sim.getTime(),
      speed: sim.getSpeed(),
      seed: currentSeed,
      engineVersion: ENGINE_VERSION,
    },
    results: {},
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function replayStateFromSnapshot(payload: SnapshotPayload): ThermoState {
  if (payload.sim.state) return cloneState(payload.sim.state);

  const targetTime = Math.max(0, payload.sim.t);
  let t = 0;
  let state = createInitialStateFromValues(payload.params, payload.params.scene as SceneName, payload.sim.seed);
  const stepFn = createStepFn();
  const dt = 1 / 60;
  const steps = Math.min(60 * 60 * 10, Math.round(targetTime / dt));

  for (let i = 0; i < steps; i++) {
    state = stepFn(t, dt, state);
    t += dt;
  }

  state.t = t;
  return state;
}

function validateSnapshot(snapshot: unknown): SnapshotValidationResult {
  const errors: string[] = [];
  if (!isPlainObject(snapshot)) {
    return { ok: false, errors: ['snapshot must be an object'] };
  }

  const envelope = snapshot.envelope;
  const payload = snapshot.payload;
  if (!isPlainObject(envelope)) errors.push('envelope must be an object');
  if (!isPlainObject(payload)) errors.push('payload must be an object');
  if (!isPlainObject(envelope) || !isPlainObject(payload)) return { ok: false, errors };

  if (envelope.templateKey !== TEMPLATE_KEY) errors.push(`envelope.templateKey must be ${TEMPLATE_KEY}`);
  if (typeof envelope.runtimeKey !== 'string') errors.push('envelope.runtimeKey must be a string');
  if (typeof envelope.bridgeVersion !== 'string') errors.push('envelope.bridgeVersion must be a string');
  if (envelope.snapshotSchemaVersion !== SNAPSHOT_SCHEMA_VERSION) {
    errors.push(`envelope.snapshotSchemaVersion must be ${SNAPSHOT_SCHEMA_VERSION}`);
  }

  if (!isPlainObject(payload.params)) {
    errors.push('payload.params must be an object');
  } else {
    for (const def of paramDefs) {
      const value = payload.params[def.key];
      if (value === undefined) continue;
      if (def.type === 'select') {
        if (typeof value !== 'string' || !def.options?.includes(value)) errors.push(`payload.params.${def.key} is invalid`);
      } else if (def.type === 'checkbox') {
        if (typeof value !== 'boolean') errors.push(`payload.params.${def.key} must be boolean`);
      } else if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`payload.params.${def.key} must be number`);
      }
    }
  }

  if (!isPlainObject(payload.sim)) {
    errors.push('payload.sim must be an object');
  } else {
    if (typeof payload.sim.t !== 'number' || !Number.isFinite(payload.sim.t)) errors.push('payload.sim.t must be number');
    if (typeof payload.sim.speed !== 'number' || !Number.isFinite(payload.sim.speed)) errors.push('payload.sim.speed must be number');
    if (
      payload.sim.state === undefined
      && (typeof payload.sim.seed !== 'number' || !Number.isInteger(payload.sim.seed))
    ) {
      errors.push('payload.sim.seed must be integer');
    }
    if (payload.sim.engineVersion !== undefined && payload.sim.engineVersion !== ENGINE_VERSION) {
      errors.push(`payload.sim.engineVersion must be ${ENGINE_VERSION}`);
    }
    if (payload.sim.state !== undefined && !isPlainObject(payload.sim.state)) {
      errors.push('payload.sim.state must be an object when provided');
    } else if (isPlainObject(payload.sim.state)) {
      for (const [key, value] of Object.entries(payload.sim.state)) {
        if (typeof value !== 'number' || !Number.isFinite(value)) errors.push(`payload.sim.state.${key} must be number`);
      }
    }
  }

  if (!isPlainObject(payload.results)) {
    errors.push('payload.results must be an object');
  }

  return { ok: errors.length === 0, errors };
}

function loadSnapshot(snapshot: unknown): SnapshotValidationResult {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) return validation;

  if (autoPlayTimer !== undefined) {
    clearTimeout(autoPlayTimer);
    autoPlayTimer = undefined;
  }

  const typedSnapshot = snapshot as TemplateSnapshot;
  const { payload } = typedSnapshot;
  currentSeed = typeof payload.sim.seed === 'number' ? payload.sim.seed >>> 0 : Date.now() >>> 0;
  setPanelValues(payload.params);

  timeData.length = 0;
  pressureData.length = 0;
  brownTrail.length = 0;
  wallCollisions = 0;

  const restoredState = replayStateFromSnapshot(payload);
  sim.setSpeed(payload.sim.speed);
  sim.updateStepFn(createStepFn());
  sim.loadState(restoredState.t, restoredState);
  controls.setPlaying(false);
  return { ok: true, errors: [] };
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
  currentSeed = Date.now() >>> 0;
  sanitizeSceneInputs();
  timeData.length = 0; pressureData.length = 0; brownTrail.length = 0;
  sim.reset(createInitialState());
  sim.updateStepFn(createStepFn());
  controls.setPlaying(false);
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

panel.setOnChange(() => {
  currentSeed = Date.now() >>> 0;
  sanitizeSceneInputs();
  updateParamVisibility();
  timeData.length = 0; pressureData.length = 0; brownTrail.length = 0;
  sim.reset(createInitialState());
  sim.updateStepFn(createStepFn());
});

window.__EDUMIND_TEMPLATE_BRIDGE__ = {
  getDefaultSnapshot,
  getSnapshot,
  loadSnapshot,
  validateSnapshot,
};

window.addEventListener('message', (event) => {
  const message = event.data;
  if (!isPlainObject(message) || message.source !== 'EDUMIND_HOST' || typeof message.requestId !== 'string') return;

  const respond = (payload: unknown, ok = true): void => {
    event.source?.postMessage({
      source: 'EDUMIND_TEMPLATE',
      requestId: message.requestId,
      type: `${String(message.type)}:response`,
      ok,
      payload,
    }, { targetOrigin: event.origin });
  };

  try {
    switch (message.type) {
      case 'getDefaultSnapshot':
        respond(getDefaultSnapshot());
        break;
      case 'getSnapshot':
        respond(getSnapshot());
        break;
      case 'loadSnapshot': {
        const result = loadSnapshot(message.snapshot);
        respond(result, result.ok);
        break;
      }
      case 'validateSnapshot':
        respond(validateSnapshot(message.snapshot));
        break;
      default:
        respond({ errors: [`Unsupported bridge message type: ${String(message.type)}`] }, false);
    }
  } catch (error) {
    respond({ errors: [error instanceof Error ? error.message : String(error)] }, false);
  }
});

// Initial visibility setup & render
sanitizeSceneInputs();
updateParamVisibility();
renderScene(0, createInitialState());

// Auto-play on load
autoPlayTimer = window.setTimeout(() => {
  autoPlayTimer = undefined;
  sim.play();
  controls.setPlaying(true);
}, 100);

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
