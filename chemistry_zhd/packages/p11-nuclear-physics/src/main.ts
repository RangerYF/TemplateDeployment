import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, defineParams, PlaybackControls,
  SimLoop, CanvasManager, SyncedGraph,
} from '@physics/core';
import type { SimState, GraphTrace } from '@physics/core';

interface NuclearState extends SimState {
  t: number;
  undecayed: number;
  [key: string]: number; // particle states
}

const MAX_PARTICLES = 200;
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-11 核物理演示');

const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '放射性衰变',
    options: ['放射性衰变', '光电效应', '玻尔模型', '链式反应'] },
  { key: 'halfLife', label: '半衰期 T_{1/2}', unit: 's', min: 0.5, max: 10, step: 0.5, default: 3,
    scenes: ['放射性衰变'] },
  { key: 'numNuclei', label: '初始核数', unit: '', min: 20, max: 200, step: 10, default: 100,
    scenes: ['放射性衰变'] },
  { key: 'decayType', label: '衰变类型', type: 'select', default: 'alpha',
    options: ['alpha', 'beta', 'gamma'], scenes: ['放射性衰变'] },
  { key: 'frequency', label: '入射光频率 f', unit: 'x10^14Hz', min: 1, max: 15, step: 0.1, default: 8,
    scenes: ['光电效应'] },
  { key: 'workFunction', label: '逸出功 W_0', unit: 'eV', min: 1, max: 5, step: 0.1, default: 2.3,
    scenes: ['光电效应'] },
  { key: 'stoppingVoltage', label: '遏止电压 U_s', unit: 'V', min: -3, max: 5, step: 0.1, default: 0,
    scenes: ['光电效应'] },
  { key: 'nLevel', label: '能级 n', unit: '', min: 1, max: 6, step: 1, default: 3,
    scenes: ['玻尔模型'] },
  { key: 'nTarget', label: '跃迁到 n\'', unit: '', min: 1, max: 5, step: 1, default: 1,
    scenes: ['玻尔模型'] },
  { key: 'neutronsPerFission', label: '每次裂变中子数', unit: '', min: 2, max: 3, step: 1, default: 2,
    scenes: ['链式反应'] },
  { key: 'fissionProbability', label: '裂变概率', unit: '', min: 0, max: 1, step: 0.05, default: 0.8,
    scenes: ['链式反应'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });
function updateOrigin(): void {
  cm.setOrigin(cm.getWidth() / 2, cm.getHeight() / 2);
}
updateOrigin();
cm.setScale(40);
const controls = new PlaybackControls(layout.controlBar);

const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer);
const graph = new SyncedGraph({
  container: graphContainer, title: '', xLabel: 't (s)', yLabel: 'N', height: 260,
});

const timeData: number[] = [];
const nData: number[] = [];

// ============================================================
// Decay visualization (放射性衰变)
// ============================================================
interface Nucleus { x: number; y: number; decayed: boolean; decayTime: number; }
let nuclei: Nucleus[] = [];

// Emitted particles from decay animation
interface EmittedParticle {
  x: number; y: number;
  vx: number; vy: number;
  type: 'alpha' | 'beta' | 'gamma';
  born: number;
}
let emittedParticles: EmittedParticle[] = [];

function initNuclei(): void {
  const n = Math.floor(panel.getValue<number>('numNuclei'));
  nuclei = [];
  emittedParticles = [];
  const cols = Math.ceil(Math.sqrt(n * 1.5));
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    nuclei.push({
      x: col * 0.5 - cols * 0.25,
      y: row * 0.5 - 3,
      decayed: false,
      decayTime: -1,
    });
  }
}

// ============================================================
// Chain reaction state (链式反应)
// ============================================================
interface ChainNucleus {
  x: number; y: number;
  fissioned: boolean;
  generation: number;
}
interface ChainNeutron {
  x: number; y: number;
  vx: number; vy: number;
  generation: number;
  active: boolean;
  hasTriggered: boolean;
}
interface ChainFragment {
  x: number; y: number;
  vx: number; vy: number;
  generation: number;
}

let chainNuclei: ChainNucleus[] = [];
let chainNeutrons: ChainNeutron[] = [];
let chainFragments: ChainFragment[] = [];
let chainGeneration = 0;
let chainTotalFissions = 0;
let chainTotalNeutrons = 0;
let chainStarted = false;
let chainStepTimer = 0;

function initChain(): void {
  chainNuclei = [{ x: 0, y: 0, fissioned: false, generation: 0 }];
  chainNeutrons = [];
  chainFragments = [];
  chainGeneration = 0;
  chainTotalFissions = 0;
  chainTotalNeutrons = 0;
  chainStarted = false;
  chainStepTimer = 0;
}

function getInitialState(): NuclearState {
  initNuclei();
  initChain();
  return { t: 0, undecayed: nuclei.length };
}

function createStepFn() {
  return (_t: number, dt: number, state: NuclearState): NuclearState => {
    const scene = panel.getValue<string>('scene');

    if (scene === '链式反应') {
      return stepChainReaction(dt, state);
    }

    if (scene !== '放射性衰变') return { ...state, t: state.t + dt };

    const T = panel.getValue<number>('halfLife');
    const decayProb = 1 - Math.pow(2, -dt / T);
    const decayType = panel.getValue<string>('decayType') as 'alpha' | 'beta' | 'gamma';

    let undecayed = 0;
    for (const nucleus of nuclei) {
      if (!nucleus.decayed) {
        if (Math.random() < decayProb) {
          nucleus.decayed = true;
          nucleus.decayTime = state.t + dt;
          // Spawn an emitted particle
          const angle = Math.random() * Math.PI * 2;
          const speed = 1.5 + Math.random() * 1.5;
          emittedParticles.push({
            x: nucleus.x, y: nucleus.y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            type: decayType,
            born: state.t + dt,
          });
        } else {
          undecayed++;
        }
      }
    }

    // Update emitted particles
    for (const p of emittedParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    // Remove old particles
    const maxAge = 4;
    const currentTime = state.t + dt;
    for (let i = emittedParticles.length - 1; i >= 0; i--) {
      if (currentTime - emittedParticles[i].born > maxAge) {
        emittedParticles.splice(i, 1);
      }
    }

    return { t: state.t + dt, undecayed };
  };
}

// ============================================================
// Chain reaction step logic
// ============================================================
function stepChainReaction(dt: number, state: NuclearState): NuclearState {
  const newT = state.t + dt;
  chainStepTimer += dt;

  const neutronsPerFission = Math.floor(panel.getValue<number>('neutronsPerFission'));
  const fissionProb = panel.getValue<number>('fissionProbability');

  // Auto-start: trigger first fission at t ~ 0.5s
  if (!chainStarted && newT > 0.5) {
    chainStarted = true;
    triggerFission(chainNuclei[0], neutronsPerFission);
  }

  // Move neutrons
  for (const n of chainNeutrons) {
    if (n.active) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
    }
  }

  // Move fragments
  for (const f of chainFragments) {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    // Slow down
    f.vx *= 0.995;
    f.vy *= 0.995;
  }

  // Every ~0.8 seconds, check if active neutrons can trigger new fissions
  if (chainStarted && chainStepTimer > 0.8) {
    chainStepTimer = 0;
    const activeNeutrons = chainNeutrons.filter(n => n.active && !n.hasTriggered);
    for (const neutron of activeNeutrons) {
      if (Math.random() < fissionProb) {
        neutron.active = false;
        neutron.hasTriggered = true;
        // Create a new nucleus at the neutron position and fission it
        const newNuc: ChainNucleus = {
          x: neutron.x, y: neutron.y,
          fissioned: false,
          generation: neutron.generation + 1,
        };
        chainNuclei.push(newNuc);
        chainGeneration = Math.max(chainGeneration, newNuc.generation);
        triggerFission(newNuc, neutronsPerFission);
      } else {
        neutron.active = false;
        neutron.hasTriggered = true;
      }
    }
  }

  // Cap to prevent runaway
  if (chainNeutrons.length > 500) {
    chainNeutrons = chainNeutrons.slice(-500);
  }
  if (chainFragments.length > 300) {
    chainFragments = chainFragments.slice(-300);
  }

  return { ...state, t: newT };
}

function triggerFission(nuc: ChainNucleus, neutronsPerFission: number): void {
  if (nuc.fissioned) return;
  nuc.fissioned = true;
  chainTotalFissions++;

  // Release neutrons
  for (let i = 0; i < neutronsPerFission; i++) {
    const angle = (Math.PI * 2 * i) / neutronsPerFission + (Math.random() - 0.5) * 0.5;
    const speed = 1.2 + Math.random() * 1.0;
    chainNeutrons.push({
      x: nuc.x, y: nuc.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      generation: nuc.generation,
      active: true,
      hasTriggered: false,
    });
    chainTotalNeutrons++;
  }

  // Release 2 fission fragments
  const fragAngle = Math.random() * Math.PI;
  for (let i = 0; i < 2; i++) {
    const a = fragAngle + i * Math.PI;
    const speed = 0.6 + Math.random() * 0.4;
    chainFragments.push({
      x: nuc.x, y: nuc.y,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      generation: nuc.generation,
    });
  }
}

// ============================================================
// Render dispatcher
// ============================================================
function renderScene(t: number, state: NuclearState): void {
  const scene = panel.getValue<string>('scene');
  updateOrigin();
  cm.clear('#070b14');
  const ctx = cm.ctx;

  switch (scene) {
    case '放射性衰变':
      renderDecay(ctx, state);
      break;
    case '光电效应':
      renderPhotoelectric(ctx, state.t);
      break;
    case '玻尔模型':
      renderBohr(ctx, state.t);
      break;
    case '链式反应':
      renderChainReaction(ctx, state);
      break;
  }

  controls.updateTime(state.t);
}

// ============================================================
// 放射性衰变 render (enhanced with decay equation & particle animation)
// ============================================================
function renderDecay(ctx: CanvasRenderingContext2D, state: NuclearState): void {
  const T = panel.getValue<number>('halfLife');
  const N0 = nuclei.length;
  const decayType = panel.getValue<string>('decayType');

  // Draw nuclei
  for (const n of nuclei) {
    const [sx, sy] = cm.toScreen(n.x, n.y);
    if (n.decayed) {
      ctx.beginPath();
      ctx.arc(sx, sy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#374151';
      ctx.fill();
      ctx.strokeStyle = 'rgba(248,113,113,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    } else {
      cm.drawBall(n.x, n.y, 6, '#4ade80');
    }
  }

  // Draw emitted particles
  for (const p of emittedParticles) {
    const [px, py] = cm.toScreen(p.x, p.y);
    const age = state.t - p.born;
    const alpha = Math.max(0, 1 - age / 4);
    ctx.globalAlpha = alpha;
    if (p.type === 'alpha') {
      ctx.shadowColor = '#f87171';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#f87171';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = '7px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('a', px, py + 3);
    } else if (p.type === 'beta') {
      ctx.shadowColor = '#60a5fa';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#60a5fa';
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      ctx.font = '6px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('e', px, py + 2);
    } else {
      // gamma - wavy line
      ctx.shadowColor = '#c084fc';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#c084fc';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < 12; i++) {
        const frac = i / 12;
        const wx = px + frac * 15;
        const wy = py + Math.sin(frac * Math.PI * 4) * 3;
        if (i === 0) ctx.moveTo(wx, wy);
        else ctx.lineTo(wx, wy);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  // Stats
  cm.drawText(`N = ${state.undecayed} / ${N0}`, 20, 30, { color: '#e2e8f0', font: 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif', bg: true });
  cm.drawText(`T_{1/2} = ${T} s`, 20, 52, { color: '#94a3b8', font: '14px -apple-system, BlinkMacSystemFont, sans-serif', bg: true });
  cm.drawText(`t = ${state.t.toFixed(1)} s`, 20, 72, { color: '#94a3b8', font: '14px -apple-system, BlinkMacSystemFont, sans-serif', bg: true });
  cm.drawText(`理论值 N = N_0 * 2^(-t/T) = ${(N0 * Math.pow(2, -state.t / T)).toFixed(0)}`, 20, 92, { color: '#94a3b8', font: '14px -apple-system, BlinkMacSystemFont, sans-serif', bg: true });

  // Decay equation display
  renderDecayEquation(ctx, decayType);

  // Legend
  ctx.fillStyle = '#4ade80';
  ctx.fillRect(cm.getWidth() - 140, 20, 12, 12);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('未衰变', cm.getWidth() - 122, 31);
  ctx.fillStyle = '#374151';
  ctx.fillRect(cm.getWidth() - 140, 38, 12, 12);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText('已衰变', cm.getWidth() - 122, 49);

  // Emitted particle legend
  const legendColors: Record<string, [string, string]> = {
    alpha: ['#f87171', 'a粒子'],
    beta: ['#60a5fa', 'b粒子'],
    gamma: ['#c084fc', 'g射线'],
  };
  const [lc, ln] = legendColors[decayType] || ['#fff', ''];
  ctx.fillStyle = lc;
  ctx.fillRect(cm.getWidth() - 140, 56, 12, 12);
  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(ln, cm.getWidth() - 122, 67);

  // Graph
  timeData.push(state.t);
  nData.push(state.undecayed);
  if (timeData.length > 500) {
    timeData.splice(0, timeData.length - 500);
    nData.splice(0, nData.length - 500);
  }

  // Add theoretical curve
  const theorX: number[] = [];
  const theorY: number[] = [];
  for (let i = 0; i <= 100; i++) {
    const tt = (state.t * i) / 100;
    theorX.push(tt);
    theorY.push(N0 * Math.pow(2, -tt / T));
  }

  graph.setTraces([
    { x: timeData, y: nData, name: '实际 N(t)', color: '#4ade80' },
    { x: theorX, y: theorY, name: '理论 N_0 * 2^(-t/T)', color: '#fbbf24' },
  ]);
  graph.updateCurrentTime(state.t);
  graph.render();
}

// ============================================================
// Decay equation rendering (衰变方程配平)
// ============================================================
function renderDecayEquation(ctx: CanvasRenderingContext2D, decayType: string): void {
  const eqY = cm.getHeight() - 90;
  const eqX = 20;

  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';

  // Label
  const typeLabel = decayType === 'alpha' ? 'a衰变' : decayType === 'beta' ? 'b衰变' : 'g衰变';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`衰变方程 (${typeLabel}):`, eqX, eqY);

  ctx.font = '16px monospace';
  let parent = '', arrow = ' -> ', daughter = '', particle = '';
  let parentColor = '#4ade80', daughterColor = '#60a5fa', particleColor = '#f87171';
  let verifyA = '', verifyZ = '';

  if (decayType === 'alpha') {
    // 238/92 U -> 234/90 Th + 4/2 He
    parent = '\u00B2\u00B3\u2078\u2089\u2082U';
    daughter = '\u00B2\u00B3\u2074\u2089\u2080Th';
    particle = '\u2074\u2082He';
    particleColor = '#f87171';
    verifyA = '质量数守恒: 238 = 234 + 4 \u2713';
    verifyZ = '电荷数守恒: 92 = 90 + 2 \u2713';
  } else if (decayType === 'beta') {
    // 14/6 C -> 14/7 N + 0/-1 e
    parent = '\u00B9\u2074\u2086C';
    daughter = '\u00B9\u2074\u2087N';
    particle = '\u2070\u208B\u2081e';
    particleColor = '#60a5fa';
    verifyA = '质量数守恒: 14 = 14 + 0 \u2713';
    verifyZ = '电荷数守恒: 6 = 7 + (-1) \u2713';
  } else {
    // gamma: A/Z X* -> A/Z X + gamma
    parent = '\u1D2C_Z X*';
    daughter = '\u1D2C_Z X';
    particle = '\u03B3';
    particleColor = '#c084fc';
    verifyA = '质量数守恒: A = A + 0 \u2713';
    verifyZ = '电荷数守恒: Z = Z + 0 \u2713';
  }

  // Render equation terms with colors
  let curX = eqX;
  const eqLineY = eqY + 24;
  ctx.font = 'bold 18px monospace';

  ctx.fillStyle = parentColor;
  ctx.fillText(parent, curX, eqLineY);
  curX += ctx.measureText(parent).width;

  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(arrow, curX, eqLineY);
  curX += ctx.measureText(arrow).width;

  ctx.fillStyle = daughterColor;
  ctx.fillText(daughter, curX, eqLineY);
  curX += ctx.measureText(daughter).width;

  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(' + ', curX, eqLineY);
  curX += ctx.measureText(' + ').width;

  ctx.fillStyle = particleColor;
  ctx.fillText(particle, curX, eqLineY);

  // Verification
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#86efac';
  ctx.fillText(verifyA, eqX, eqLineY + 22);
  ctx.fillText(verifyZ, eqX, eqLineY + 40);

  // Physics explanation
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  if (decayType === 'alpha') {
    ctx.fillText('a衰变: 释放 He-4 核, 质量数-4, 原子序数-2', eqX, eqLineY + 58);
  } else if (decayType === 'beta') {
    ctx.fillText('b衰变: 中子变质子, 释放电子, 质量数不变, 原子序数+1', eqX, eqLineY + 58);
  } else {
    ctx.fillText('g衰变: 激发态到基态, 释放g光子, A和Z不变', eqX, eqLineY + 58);
  }
}

// ============================================================
// 光电效应 render (enhanced with stopping voltage & I-U curve)
// ============================================================
function renderPhotoelectric(ctx: CanvasRenderingContext2D, simTime: number): void {
  const f = panel.getValue<number>('frequency') * 1e14;
  const W0 = panel.getValue<number>('workFunction');
  const Us = panel.getValue<number>('stoppingVoltage');
  const h = 6.626e-34;
  const eV = 1.602e-19;
  const hf_eV = h * f / eV;
  const thresholdF = W0 * eV / h;
  const canEmit = hf_eV >= W0;
  const Ek_max = canEmit ? hf_eV - W0 : 0;

  // Stopping voltage effect: electrons are stopped when eU_s >= Ek_max
  const theoreticalUs = canEmit ? Ek_max : 0; // U_s at which current drops to 0
  const electronsBlocked = Us >= theoreticalUs && theoreticalUs > 0;
  const effectiveEmission = canEmit && !electronsBlocked;

  // Metal surface
  const [mx, my] = cm.toScreen(-2, -2);
  ctx.fillStyle = '#475569';
  ctx.fillRect(mx, my, cm.getScale() * 8, cm.getScale() * 4);
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('金属板', ...cm.toScreen(2, -3.5) as [number, number]);

  // Show voltage plates if U_s != 0
  if (Us !== 0) {
    const plateColor = Us > 0 ? '#f87171' : '#60a5fa';
    // Left plate (near metal)
    const [plx, ply] = cm.toScreen(5, -2);
    ctx.fillStyle = plateColor;
    ctx.fillRect(plx, ply, 4, cm.getScale() * 4);
    // Right plate
    const [prx, pry] = cm.toScreen(8, -2);
    ctx.fillStyle = Us > 0 ? '#60a5fa' : '#f87171';
    ctx.fillRect(prx, pry, 4, cm.getScale() * 4);
    // Voltage label
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [vlx, vly] = cm.toScreen(6.5, -2.8);
    ctx.fillText(`U = ${Us > 0 ? '+' : ''}${Us.toFixed(1)} V`, vlx, vly);
    if (Us > 0) {
      // Electric field arrows (retarding)
      ctx.strokeStyle = 'rgba(248,113,113,0.5)';
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) {
        const [ax, ay] = cm.toScreen(7.5, -1 + i * 1);
        const [bx, by] = cm.toScreen(5.5, -1 + i * 1);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        // arrowhead
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.lineTo(bx + 6, by - 4);
        ctx.lineTo(bx + 6, by + 4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(248,113,113,0.5)';
        ctx.fill();
      }
    }
  }

  // Incoming photons
  const wl = 3e8 / f * 1e9; // wavelength in nm
  const color = wl >= 380 && wl <= 780 ?
    `hsl(${Math.floor(270 - (wl - 380) * 270 / 400)}, 100%, 60%)` : '#c084fc';

  for (let i = 0; i < 5; i++) {
    const px = -6 + i * 0.8;
    const py = 4 - i * 0.5;
    const [sx, sy] = cm.toScreen(px, py);
    const [ex2, ey2] = cm.toScreen(px + 3, py - 3);

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    // Wavy line for photon
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let j = 0; j < 20; j++) {
      const frac = j / 20;
      const mx2 = sx + (ex2 - sx) * frac;
      const my2 = sy + (ey2 - sy) * frac;
      ctx.lineTo(mx2 + Math.sin(frac * Math.PI * 6) * 4, my2 + Math.cos(frac * Math.PI * 6) * 4);
    }
    ctx.stroke();

    // Arrow
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ex2, ey2);
    ctx.lineTo(ex2 - 8, ey2 - 8);
    ctx.lineTo(ex2 + 4, ey2 - 4);
    ctx.closePath();
    ctx.fill();
  }

  // Emitted electrons
  if (effectiveEmission) {
    for (let i = 0; i < 3; i++) {
      const ex2 = 2 + i * 1.5;
      const ey2 = 2 + i * 0.5 + Math.sin(simTime * 3 + i) * 0.5;
      cm.drawBall(ex2, ey2, 5, '#60a5fa');
      const [esx, esy] = cm.toScreen(ex2, ey2);
      ctx.fillStyle = '#fff';
      ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('e-', esx, esy + 3);
    }
  } else if (canEmit && electronsBlocked) {
    // Show electrons being stopped near plate
    for (let i = 0; i < 2; i++) {
      const ex2 = 3.5 + i * 0.6;
      const ey2 = -0.5 + i * 0.8;
      const [esx, esy] = cm.toScreen(ex2, ey2);
      ctx.beginPath();
      ctx.arc(esx, esy, 5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(96,165,250,0.4)';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '8px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('e-', esx, esy + 3);
      // X mark
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(esx - 6, esy - 6);
      ctx.lineTo(esx + 6, esy + 6);
      ctx.moveTo(esx + 6, esy - 6);
      ctx.lineTo(esx - 6, esy + 6);
      ctx.stroke();
    }
  }

  // Info panel
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('光电效应', 20, 28);
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`入射光频率 f = ${(f / 1e14).toFixed(1)} x 10^14 Hz`, 20, 52);
  ctx.fillText(`光子能量 E = hf = ${hf_eV.toFixed(2)} eV`, 20, 72);
  ctx.fillText(`逸出功 W_0 = ${W0.toFixed(1)} eV`, 20, 92);
  ctx.fillText(`截止频率 f_0 = W_0/h = ${(thresholdF / 1e14).toFixed(2)} x 10^14 Hz`, 20, 112);

  if (canEmit) {
    ctx.fillStyle = '#4ade80';
    ctx.fillText(`最大初动能 Ek_max = hf - W_0 = ${Ek_max.toFixed(2)} eV`, 20, 138);
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`遏止电压 U_s = Ek_max/e = ${theoreticalUs.toFixed(2)} V`, 20, 158);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`U_s = (hf - W_0)/e  -- 只与频率有关, 与光强无关`, 20, 178);

    if (Us > 0) {
      ctx.fillStyle = electronsBlocked ? '#f87171' : '#4ade80';
      const statusText = electronsBlocked
        ? `电流 I = 0 (U = ${Us.toFixed(1)}V >= U_s = ${theoreticalUs.toFixed(2)}V)`
        : `电流 I > 0 (U = ${Us.toFixed(1)}V < U_s = ${theoreticalUs.toFixed(2)}V)`;
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(statusText, 20, 198);
    } else if (!effectiveEmission) {
      ctx.fillStyle = '#f87171';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('电子被遏止电压阻挡!', 20, 198);
    }
  } else {
    ctx.fillStyle = '#f87171';
    ctx.fillText(`不能发射! hf < W_0`, 20, 138);
  }

  // ============================================================
  // I-U characteristic curve (遏止电压曲线)
  // ============================================================
  renderIUCurve(ctx, canEmit, Ek_max, theoreticalUs);
}

function renderIUCurve(
  ctx: CanvasRenderingContext2D,
  canEmit: boolean,
  Ek_max: number,
  theoreticalUs: number,
): void {
  const Us = panel.getValue<number>('stoppingVoltage');
  // Draw I-U curve in bottom-right area
  const graphX = cm.getWidth() - 300;
  const graphY = 200;
  const graphW = 270;
  const graphH = 200;

  // Background
  ctx.fillStyle = 'rgba(15,23,42,0.8)';
  ctx.fillRect(graphX - 10, graphY - 10, graphW + 20, graphH + 30);

  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  // Border
  ctx.strokeRect(graphX, graphY, graphW, graphH);

  // Title
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('I-U 特性曲线', graphX + graphW / 2, graphY - 2);

  // Axes
  // U range: -3 to 4
  // I range: 0 to 1 (normalized)
  const uMin = -3, uMax = 4;
  const iMin = 0, iMax = 1.2;

  function mapU(u: number): number {
    return graphX + ((u - uMin) / (uMax - uMin)) * graphW;
  }
  function mapI(i: number): number {
    return graphY + graphH - ((i - iMin) / (iMax - iMin)) * graphH;
  }

  // Axis lines
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  // U axis (I=0 line)
  ctx.beginPath();
  ctx.moveTo(graphX, mapI(0));
  ctx.lineTo(graphX + graphW, mapI(0));
  ctx.stroke();
  // I axis (U=0 line)
  ctx.beginPath();
  ctx.moveTo(mapU(0), graphY);
  ctx.lineTo(mapU(0), graphY + graphH);
  ctx.stroke();

  // Axis labels
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('U (V)', graphX + graphW - 10, mapI(0) + 16);
  ctx.textAlign = 'right';
  ctx.fillText('I', mapU(0) - 6, graphY + 12);

  // Tick marks
  ctx.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  for (let u = -3; u <= 4; u++) {
    const ux = mapU(u);
    ctx.beginPath();
    ctx.moveTo(ux, mapI(0) - 3);
    ctx.lineTo(ux, mapI(0) + 3);
    ctx.stroke();
    if (u !== 0) ctx.fillText(String(u), ux, mapI(0) + 14);
  }

  // Draw I-U curve
  if (canEmit && theoreticalUs > 0) {
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.beginPath();
    let started = false;
    const saturationI = 1.0; // normalized saturation current
    for (let u = uMin; u <= uMax; u += 0.05) {
      let current: number;
      if (u >= 0) {
        // Forward: saturation
        current = saturationI;
      } else {
        // Reverse: current decreases, reaches 0 at U = -theoreticalUs
        if (-u >= theoreticalUs) {
          current = 0;
        } else {
          // Smooth curve: I = I_sat * (1 - (|U|/U_s))^2 approximately
          const ratio = (-u) / theoreticalUs;
          current = saturationI * (1 - ratio) * (1 - ratio * 0.3);
        }
      }
      const px = mapU(u);
      const py = mapI(current);
      if (!started) { ctx.moveTo(px, py); started = true; }
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Mark stopping voltage on the curve
    const usMarkX = mapU(-theoreticalUs);
    const usMarkY = mapI(0);
    ctx.strokeStyle = '#f87171';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(usMarkX, graphY);
    ctx.lineTo(usMarkX, graphY + graphH);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f87171';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`-U_s=${(-theoreticalUs).toFixed(1)}`, usMarkX, graphY + graphH + 16);

    // Mark current applied voltage
    if (Us !== 0) {
      const appliedX = mapU(-Us); // Our parameter is positive Us applied as reverse
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(appliedX, graphY);
      ctx.lineTo(appliedX, graphY + graphH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`U=${(-Us).toFixed(1)}`, appliedX, graphY - 2);
    }
  } else {
    // No emission or no threshold: flat line at 0
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(graphX, mapI(0));
    ctx.lineTo(graphX + graphW, mapI(0));
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('无光电流', graphX + graphW / 2, mapI(0) - 10);
  }

  graph.setTraces([]);
  graph.render();
}

// ============================================================
// 玻尔模型 render (unchanged)
// ============================================================
function renderBohr(ctx: CanvasRenderingContext2D, simTime: number): void {
  const n = Math.floor(panel.getValue<number>('nLevel'));
  const nTarget = Math.floor(panel.getValue<number>('nTarget'));
  const r1 = 0.8; // visual scale for n=1 orbit

  // Draw orbits
  const [cx, cy] = cm.toScreen(0, 0);
  for (let level = 1; level <= 6; level++) {
    const r = r1 * level * level;
    const rPx = r * cm.getScale();
    ctx.strokeStyle = level === n ? '#fbbf24' : level === nTarget ? '#4ade80' : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = level === n || level === nTarget ? 2 : 1;
    ctx.beginPath();
    ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
    ctx.stroke();

    // Energy level label
    const En = -13.6 / (level * level);
    ctx.fillStyle = level === n ? '#fbbf24' : '#94a3b8';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`n=${level}  E=${En.toFixed(2)}eV`, cx + rPx + 5, cy - 4);
  }

  // Nucleus
  cm.drawBall(0, 0, 8, '#f87171');
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('H+', cx, cy + 4);

  // Electron on current orbit
  const angle = (simTime * 2) % (Math.PI * 2);
  const eR = r1 * n * n * cm.getScale();
  const ex = cx + eR * Math.cos(angle);
  const ey = cy + eR * Math.sin(angle);
  const [ewx, ewy] = [(ex - cx) / cm.getScale(), -(ey - cy) / cm.getScale()];
  cm.drawBall(ewx, ewy, 6, '#60a5fa');

  // Transition arrow
  if (n !== nTarget) {
    const isEmission = nTarget < n;
    const r_from = r1 * n * n * cm.getScale();
    const r_to = r1 * nTarget * nTarget * cm.getScale();
    ctx.strokeStyle = isEmission ? '#c084fc' : '#fbbf24';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(cx + r_from * 0.7, cy - r_from * 0.7);
    ctx.lineTo(cx + r_to * 0.7, cy - r_to * 0.7);
    ctx.stroke();
    ctx.setLineDash([]);

    // Photon energy
    const E_n = -13.6 / (n * n);
    const E_target = -13.6 / (nTarget * nTarget);
    const deltaE = E_target - E_n;
    const photonE = Math.abs(deltaE);
    const hConst = 4.136e-15; // eV*s
    const fPhoton = photonE / hConst;
    const lambda = 3e8 / fPhoton * 1e9;

    // Wavy photon line
    const midR = (r_from + r_to) / 2;
    const photonColor = isEmission ? '#c084fc' : '#fbbf24';
    ctx.strokeStyle = photonColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    const startX = cx + midR * 0.7;
    const startY = cy - midR * 0.7;
    const dirX = isEmission ? 1 : -1; // emission: photon goes out; absorption: photon comes in
    for (let i = 0; i < 30; i++) {
      const frac2 = i / 30;
      ctx.lineTo(
        startX + dirX * frac2 * 100 + Math.sin(frac2 * Math.PI * 6) * 5,
        startY - frac2 * 60 + Math.cos(frac2 * Math.PI * 6) * 5
      );
    }
    ctx.stroke();
    ctx.fillStyle = photonColor;
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    const labelSuffix = isEmission ? '发射' : '吸收';
    ctx.fillText(`g ${labelSuffix} (l=${lambda.toFixed(0)}nm)`, startX + dirX * 110, startY - 60);

    // Info
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${isEmission ? '发射' : '吸收'}跃迁: n=${n} -> n=${nTarget}`, 20, 28);
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`dE = 13.6|1/n'^2 - 1/n^2| = ${photonE.toFixed(2)} eV`, 20, 50);
    ctx.fillText(`l = hc/dE = ${lambda.toFixed(0)} nm`, 20, 70);
    ctx.fillText(`f = ${(fPhoton / 1e14).toFixed(2)} x 10^14 Hz`, 20, 90);
    if (!isEmission) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText('需要入射光子能量恰好等于能级差', 20, 112);
    }
  }

  // Energy level diagram on right
  const diagX = cm.getWidth() - 160;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('能级图', diagX + 50, 28);

  for (let level = 1; level <= 6; level++) {
    const En = -13.6 / (level * level);
    const lineY = 50 + (En / -13.6) * 300;
    ctx.strokeStyle = level === n ? '#fbbf24' : level === nTarget ? '#4ade80' : 'rgba(255,255,255,0.3)';
    ctx.lineWidth = level === n || level === nTarget ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(diagX, lineY);
    ctx.lineTo(diagX + 100, lineY);
    ctx.stroke();

    ctx.fillStyle = ctx.strokeStyle;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`n=${level}  ${En.toFixed(2)}eV`, diagX + 105, lineY + 4);
  }

  graph.setTraces([]);
  graph.render();
}

// ============================================================
// 链式反应 render
// ============================================================
function renderChainReaction(ctx: CanvasRenderingContext2D, state: NuclearState): void {
  const neutronsPerFission = Math.floor(panel.getValue<number>('neutronsPerFission'));
  const fissionProb = panel.getValue<number>('fissionProbability');

  // Draw fission fragments (brownish)
  for (const frag of chainFragments) {
    cm.drawBall(frag.x, frag.y, 7, '#92400e');
  }

  // Draw nuclei
  for (const nuc of chainNuclei) {
    const [nx, ny] = cm.toScreen(nuc.x, nuc.y);
    if (!nuc.fissioned) {
      // Unfissioned uranium - large green circle with glow
      cm.drawBall(nuc.x, nuc.y, 12, '#4ade80');
      ctx.fillStyle = '#000';
      ctx.font = 'bold 8px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('U', nx, ny + 3);
    } else {
      // Fissioned - show explosion mark
      ctx.shadowColor = '#fbbf24';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(nx, ny, 10, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,191,36,0.3)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(251,191,36,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  // Draw neutrons (small bright dots)
  for (const n of chainNeutrons) {
    if (!n.active && n.hasTriggered) continue; // skip consumed neutrons
    if (n.active) {
      cm.drawBall(n.x, n.y, 3, '#fbbf24');
    } else {
      const [nx, ny] = cm.toScreen(n.x, n.y);
      ctx.beginPath();
      ctx.arc(nx, ny, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(251,191,36,0.3)';
      ctx.fill();
    }
  }

  // Info panel
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('链式反应 (铀-235 裂变)', 20, 30);

  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`第 ${chainGeneration} 代裂变, 累计裂变 ${chainTotalFissions} 次`, 20, 56);
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`累计释放中子: ${chainTotalNeutrons}`, 20, 76);
  ctx.fillText(`每次裂变释放中子数: ${neutronsPerFission}`, 20, 96);
  ctx.fillText(`裂变概率: ${(fissionProb * 100).toFixed(0)}%`, 20, 116);

  // Teaching point
  ctx.fillStyle = '#c084fc';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`理论第N代裂变次数 ~ ${neutronsPerFission}^N (指数增长)`, 20, 142);
  ctx.fillText(`临界质量: 中子数足够维持链式反应的最小质量`, 20, 162);

  // Exponential growth formula
  ctx.fillStyle = '#86efac';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  if (chainGeneration > 0) {
    const theoretical = Math.pow(neutronsPerFission, chainGeneration);
    ctx.fillText(
      `第${chainGeneration}代理论值: ${neutronsPerFission}^${chainGeneration} = ${theoretical}`,
      20, 182,
    );
  }

  if (!chainStarted) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('按播放键开始裂变...', cm.getWidth() / 2, cm.getHeight() / 2 + 40);
  }

  // Graph: show fission count vs generation
  if (chainGeneration > 0) {
    // Build generation histogram data
    const genCounts: number[] = new Array(chainGeneration + 1).fill(0);
    for (const nuc of chainNuclei) {
      if (nuc.fissioned && nuc.generation <= chainGeneration) {
        genCounts[nuc.generation]++;
      }
    }
    const genX: number[] = [];
    const genY: number[] = [];
    const theoX: number[] = [];
    const theoY: number[] = [];
    for (let g = 0; g <= chainGeneration; g++) {
      genX.push(g);
      genY.push(genCounts[g]);
      theoX.push(g);
      theoY.push(Math.pow(neutronsPerFission * fissionProb, g));
    }
    graph.setTraces([
      { x: genX, y: genY, name: '实际裂变数', color: '#4ade80' },
      { x: theoX, y: theoY, name: '理论 (kp)^N', color: '#fbbf24' },
    ]);
    graph.render();
  } else {
    graph.setTraces([]);
    graph.render();
  }
}

// ============================================================
// SimLoop setup
// ============================================================
const sim = new SimLoop<NuclearState>({
  dt: 1 / 30,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: getInitialState(),
});

controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => {
  timeData.length = 0; nData.length = 0;
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
  controls.setPlaying(false);
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

panel.setOnChange(() => {
  timeData.length = 0; nData.length = 0;
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
});

renderScene(0, getInitialState());

// Auto-play on load
setTimeout(() => { sim.play(); controls.setPlaying(true); }, 100);

// For non-simulation scenes, use SimLoop time for animations
// The SimLoop already handles RAF; for static scenes (光电效应/玻尔模型)
// we let the SimLoop run so simTime advances, which drives the animations.

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
