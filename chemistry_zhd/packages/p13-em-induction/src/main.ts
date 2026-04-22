import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, defineParams, PlaybackControls,
  SimLoop, CanvasManager, SyncedGraph, GRAVITY, rk4Step,
} from '@physics/core';
import type { SimState, GraphTrace, DerivativeFunction } from '@physics/core';

// ---------------------------------------------------------------------------
// State interfaces
// ---------------------------------------------------------------------------
interface EMIState extends SimState {
  x: number;  // position of bar along rail
  v: number;  // velocity of bar
  I: number;  // current in circuit
  t: number;
}

interface DualRodState extends SimState {
  x1: number; v1: number;  // rod 1 (active)
  x2: number; v2: number;  // rod 2 (passive)
  I: number;
  t: number;
}

interface CapacitorState extends SimState {
  x: number;
  v: number;
  Uc: number;  // capacitor voltage
  I: number;
  t: number;
}

interface VerticalState extends SimState {
  y: number;   // distance fallen (positive downward)
  v: number;   // velocity (positive downward)
  I: number;
  t: number;
}

// ---------------------------------------------------------------------------
// Layout & params
// ---------------------------------------------------------------------------
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-13 电磁感应');

const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '导轨上的导体棒',
    options: ['导轨上的导体棒', '楞次定律演示', '感应电动势',
              '双棒模型', '含电容模型', '竖直导轨'] },
  { key: 'B', label: '磁场 B', unit: 'T', min: 0.1, max: 2, step: 0.1, default: 0.5 },
  { key: 'L', label: '导轨间距 L', unit: 'm', min: 0.2, max: 2, step: 0.1, default: 1 },
  { key: 'R', label: '电阻 R', unit: '\u03A9', min: 0.5, max: 20, step: 0.5, default: 2 },
  { key: 'mass', label: '导体棒质量 m', unit: 'kg', min: 0.01, max: 1, step: 0.01, default: 0.1,
    scenes: ['导轨上的导体棒', '感应电动势', '双棒模型', '含电容模型', '竖直导轨'] },
  { key: 'v0', label: '初速度 v\u2080', unit: 'm/s', min: 0, max: 10, step: 0.1, default: 5,
    scenes: ['导轨上的导体棒', '感应电动势', '双棒模型', '含电容模型'] },
  { key: 'F_ext', label: '外力 F', unit: 'N', min: 0, max: 5, step: 0.1, default: 0,
    scenes: ['导轨上的导体棒', '感应电动势'] },
  { key: 'friction', label: '摩擦力 f', unit: 'N', min: 0, max: 2, step: 0.1, default: 0,
    scenes: ['导轨上的导体棒', '感应电动势', '竖直导轨'] },
  { key: 'mass2', label: '棒2质量 m\u2082', unit: 'kg', min: 0.01, max: 1, step: 0.01, default: 0.1,
    scenes: ['双棒模型'] },
  { key: 'C', label: '电容 C', unit: '\u00B5F', min: 1, max: 1000, step: 1, default: 100,
    scenes: ['含电容模型'] },
  { key: 'showLenz', label: '显示楞次定律分析', type: 'checkbox', default: true,
    scenes: ['导轨上的导体棒', '楞次定律演示'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });
function updateOrigin(): void {
  cm.setOrigin(100, cm.getHeight() - 70);
}
updateOrigin();
cm.setScale(60);
const controls = new PlaybackControls(layout.controlBar);

const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer);
const graph = new SyncedGraph({
  container: graphContainer, title: 'v-t / I-t / EMF-t', xLabel: 't (s)', yLabel: '', height: 260,
});

// ---------------------------------------------------------------------------
// Graph data arrays (reused across scenes for first 3), plus new arrays
// ---------------------------------------------------------------------------
const timeData: number[] = [];
const vData: number[] = [];
const IData: number[] = [];
const emfData: number[] = [];
// Dual-rod extras
const v2Data: number[] = [];
// Capacitor extras
const UcData: number[] = [];

const ARROW_COLORS_LOCAL = {
  velocity: '#60a5fa',
  force: '#4ade80',
};

function clearGraphData() {
  timeData.length = 0; vData.length = 0; IData.length = 0; emfData.length = 0;
  v2Data.length = 0; UcData.length = 0;
}

function trimGraphData(max: number) {
  if (timeData.length > max) {
    const excess = timeData.length - max;
    timeData.splice(0, excess);
    vData.splice(0, excess);
    IData.splice(0, excess);
    emfData.splice(0, excess);
    v2Data.splice(0, excess);
    UcData.splice(0, excess);
  }
}

// ---------------------------------------------------------------------------
// Helper – get current scene string
// ---------------------------------------------------------------------------
function currentScene(): string {
  return panel.getValue<string>('scene');
}

// ---------------------------------------------------------------------------
// Initial states
// ---------------------------------------------------------------------------
function getInitialState(): EMIState {
  return { x: 0.5, v: panel.getValue<number>('v0'), I: 0, t: 0 };
}

function getInitialDualRodState(): DualRodState {
  return { x1: 2, v1: panel.getValue<number>('v0'), x2: 6, v2: 0, I: 0, t: 0 };
}

function getInitialCapacitorState(): CapacitorState {
  return { x: 0.5, v: panel.getValue<number>('v0'), Uc: 0, I: 0, t: 0 };
}

function getInitialVerticalState(): VerticalState {
  return { y: 0, v: 0, I: 0, t: 0 };
}

function getAnyInitialState(): SimState {
  const scene = currentScene();
  if (scene === '双棒模型') return getInitialDualRodState();
  if (scene === '含电容模型') return getInitialCapacitorState();
  if (scene === '竖直导轨') return getInitialVerticalState();
  return getInitialState();
}

// ---------------------------------------------------------------------------
// Step functions
// ---------------------------------------------------------------------------

// Original 3 scenes --------------------------------------------------------
function createStepFn() {
  return (_t: number, dt: number, state: EMIState): EMIState => {
    const B = panel.getValue<number>('B');
    const L = panel.getValue<number>('L');
    const R = panel.getValue<number>('R');
    const m = panel.getValue<number>('mass');
    const F_ext = panel.getValue<number>('F_ext');
    const f = panel.getValue<number>('friction');
    const scene = currentScene();

    if (scene === '感应电动势') {
      const v = state.v;
      const emf = B * L * v;
      const I = emf / R;
      return { x: state.x + v * dt, v, I, t: state.t + dt };
    }

    const derivFn: DerivativeFunction = (_tt: number, s: number[]) => {
      const [, v_s] = s;
      const emf_s = B * L * v_s;
      const I_s = emf_s / R;
      const F_amp = B * I_s * L;
      const frictionForce = v_s > 0 ? f : v_s < 0 ? -f : 0;
      const F_net = F_ext - F_amp - frictionForce;
      const a = F_net / m;
      return [v_s, a];
    };

    const next = rk4Step(derivFn, _t, [state.x, state.v], dt);
    let [x, v] = next;
    if (x < 0) { x = 0; v = 0; }

    const emf = B * L * v;
    const I = emf / R;
    return { x, v, I, t: state.t + dt };
  };
}

// Dual Rod step function ---------------------------------------------------
function createDualRodStepFn() {
  return (_t: number, dt: number, state: DualRodState): DualRodState => {
    const B = panel.getValue<number>('B');
    const L = panel.getValue<number>('L');
    const R = panel.getValue<number>('R');
    const m1 = panel.getValue<number>('mass');
    const m2 = panel.getValue<number>('mass2');
    const f = panel.getValue<number>('friction');

    // State vector: [x1, v1, x2, v2]
    const derivFn: DerivativeFunction = (_tt: number, s: number[]) => {
      const [, v1_s, , v2_s] = s;
      const emf = B * L * (v1_s - v2_s);
      const I = emf / R;
      const F_amp = B * I * L; // force magnitude on each rod

      // Friction on rod 1
      const f1 = v1_s > 1e-9 ? f : v1_s < -1e-9 ? -f : 0;
      // Friction on rod 2
      const f2 = v2_s > 1e-9 ? f : v2_s < -1e-9 ? -f : 0;

      // Rod 1 decelerates (安培力 opposes v1)
      const a1 = (-F_amp - f1) / m1;
      // Rod 2 accelerates (安培力 in direction of v1)
      const a2 = (F_amp - f2) / m2;

      return [v1_s, a1, v2_s, a2];
    };

    const next = rk4Step(derivFn, _t, [state.x1, state.v1, state.x2, state.v2], dt);
    const [x1, v1, x2, v2] = next;

    const emf = B * L * (v1 - v2);
    const I = emf / R;

    return { x1, v1, x2, v2, I, t: state.t + dt };
  };
}

// Capacitor step function --------------------------------------------------
function createCapacitorStepFn() {
  return (_t: number, dt: number, state: CapacitorState): CapacitorState => {
    const B = panel.getValue<number>('B');
    const L = panel.getValue<number>('L');
    const R = panel.getValue<number>('R');
    const m = panel.getValue<number>('mass');
    const C_uF = panel.getValue<number>('C');
    const C = C_uF * 1e-6; // convert to Farads
    const f = panel.getValue<number>('friction');

    // State vector: [x, v, q] where q is charge on capacitor
    // EMF = BLv, U_C = q/C
    // If R > 0: I = (EMF - U_C) / R  (RC circuit with EMF source)
    // dq/dt = I
    // F on rod = -BIL - friction
    // dv/dt = F/m

    const derivFn: DerivativeFunction = (_tt: number, s: number[]) => {
      const [, v_s, q_s] = s;
      const emf = B * L * v_s;
      const Uc = q_s / C;

      // With both R and C in circuit
      let I_s: number;
      if (R > 0.01) {
        // Series RC: I = (EMF - U_C) / R
        I_s = (emf - Uc) / R;
      } else {
        // Pure capacitor (no resistance): I = C * d(EMF)/dt = C * BL * a
        // This couples with acceleration; use approximate form
        // m*a = -BIL - f, I = C*BL*a => a = -(B*C*BL*a*L + f)/m
        // a(m + CB²L²) = -f => a = -f/(m + CB²L²)
        const frictionForce = v_s > 1e-9 ? f : v_s < -1e-9 ? -f : 0;
        const a = -frictionForce / (m + C * B * B * L * L);
        I_s = C * B * L * a;
        return [v_s, a, I_s];
      }

      const F_amp = B * I_s * L;
      const frictionForce = v_s > 1e-9 ? f : v_s < -1e-9 ? -f : 0;
      const a = (-F_amp - frictionForce) / m;

      return [v_s, a, I_s];
    };

    const q0 = state.Uc * C;
    const next = rk4Step(derivFn, _t, [state.x, state.v, q0], dt);
    const [x, v, q] = next;
    const Uc = q / C;
    const emf = B * L * v;
    let I: number;
    if (R > 0.01) {
      // RC circuit: I = (EMF - Uc) / R
      I = (emf - Uc) / R;
    } else {
      // Pure capacitor (R→0): EMF = Uc → BLv = q/C
      // I = C·d(BLv)/dt = C·BL·a, where a comes from F=ma: ma = -BIL
      // Substituting: ma = -B·(CBLa)·L = -CB²L²a → a(1 + CB²L²/m) = 0 at steady state
      // Use force balance directly: a = -B*I*L/m, I = C*BL*a → coupled
      // Best approximation: I = C * BL * (F_ext - friction) / (m + C*B²*L²)
      I = 0; // pure capacitor steady-state: current is zero
    }

    return { x, v, Uc, I, t: state.t + dt };
  };
}

// Vertical rails step function ---------------------------------------------
function createVerticalStepFn() {
  return (_t: number, dt: number, state: VerticalState): VerticalState => {
    const B = panel.getValue<number>('B');
    const L = panel.getValue<number>('L');
    const R = panel.getValue<number>('R');
    const m = panel.getValue<number>('mass');

    // y positive downward, v positive downward
    // Forces: mg downward, 安培力 = B²L²v/R upward (opposing downward motion)
    const derivFn: DerivativeFunction = (_tt: number, s: number[]) => {
      const [, v_s] = s;
      const F_amp = B * B * L * L * v_s / R; // opposing force (upward when v>0)
      const a = GRAVITY - F_amp / m;
      return [v_s, a];
    };

    const next = rk4Step(derivFn, _t, [state.y, state.v], dt);
    const [y, v] = next;

    const emf = B * L * v;
    const I = emf / R;

    return { y, v, I, t: state.t + dt };
  };
}

// ---------------------------------------------------------------------------
// Create appropriate step function for current scene
// ---------------------------------------------------------------------------
function createAnyStepFn(): (t: number, dt: number, state: any) => any {
  const scene = currentScene();
  if (scene === '双棒模型') return createDualRodStepFn();
  if (scene === '含电容模型') return createCapacitorStepFn();
  if (scene === '竖直导轨') return createVerticalStepFn();
  return createStepFn();
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

function drawMagneticField(ctx: CanvasRenderingContext2D, B: number, L: number,
                           xExtent: number, yExtent: number) {
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  for (let ix = 0; ix <= Math.ceil(xExtent * 2); ix++) {
    for (let iy = 0; iy <= Math.ceil(yExtent * 2); iy++) {
      const [sx, sy] = cm.toScreen(ix * 0.5, iy * 0.5);
      ctx.fillText('\u00D7', sx, sy);
    }
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`B = ${B} T (\u5782\u76F4\u7EB8\u9762\u5411\u91CC)`, 20, 25);
}

function drawHorizontalRails(ctx: CanvasRenderingContext2D, L: number, length: number) {
  cm.drawLine(0, L, length, L, { color: '#64748b', width: 4 });
  cm.drawLine(0, 0, length, 0, { color: '#64748b', width: 4 });
}

function drawResistor(ctx: CanvasRenderingContext2D, wx: number, wy: number, label: string) {
  const [rx, ry] = cm.toScreen(wx, wy);
  ctx.fillStyle = '#60a5fa';
  ctx.fillRect(rx - 8, ry - 15, 16, 30);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, rx, ry + 4);
}

function drawBar(ctx: CanvasRenderingContext2D, barX: number, L: number,
                 color: string, label: string) {
  cm.drawLine(barX, 0, barX, L, { color, width: 5 });

  const [bx, by] = cm.toScreen(barX, L / 2);
  ctx.fillStyle = color;
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, bx + 12, by);
}

function drawVelocityArrow(ctx: CanvasRenderingContext2D, barX: number,
                            yWorld: number, v: number, label: string) {
  if (Math.abs(v) < 0.01) return;
  const vScale = 0.15;
  ctx.strokeStyle = ARROW_COLORS_LOCAL.velocity;
  ctx.lineWidth = 2.5;
  const [vx1, vy1] = cm.toScreen(barX, yWorld);
  const [vx2] = cm.toScreen(barX + v * vScale, yWorld);
  ctx.beginPath(); ctx.moveTo(vx1, vy1); ctx.lineTo(vx2, vy1); ctx.stroke();
  const angle = v > 0 ? 0 : Math.PI;
  ctx.fillStyle = ARROW_COLORS_LOCAL.velocity;
  ctx.beginPath();
  ctx.moveTo(vx2, vy1);
  ctx.lineTo(vx2 - 10 * Math.cos(angle - 0.4), vy1 - 10 * Math.sin(angle - 0.4));
  ctx.lineTo(vx2 - 10 * Math.cos(angle + 0.4), vy1 - 10 * Math.sin(angle + 0.4));
  ctx.closePath();
  ctx.fill();
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`${label}=${v.toFixed(2)} m/s`, vx1, vy1 - 10);
}

function drawCurrentInfo(ctx: CanvasRenderingContext2D, B: number, L: number,
                         v: number, I: number, barX: number, yMid: number) {
  if (Math.abs(I) < 0.001) return;
  const emf = B * L * v;
  ctx.fillStyle = '#4ade80';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  const upward = v > 0;
  const [ix1, iy1] = cm.toScreen(barX - 0.3, yMid);
  ctx.fillText(upward ? '\u2191 I' : '\u2193 I', ix1, iy1);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  cm.drawText(`EMF = BLv = ${Math.abs(emf).toFixed(3)} V`, 20, 45, { color: '#e2e8f0', font: '14px -apple-system, BlinkMacSystemFont, sans-serif', bg: true });
  cm.drawText(`I = EMF/R = ${Math.abs(I).toFixed(3)} A`, 20, 65, { color: '#e2e8f0', font: '14px -apple-system, BlinkMacSystemFont, sans-serif', bg: true });
  cm.drawText(`F_\u5B89 = BIL = ${(B * Math.abs(I) * L).toFixed(3)} N`, 20, 85, { color: '#e2e8f0', font: '14px -apple-system, BlinkMacSystemFont, sans-serif', bg: true });
}

function drawLenzAnalysis(ctx: CanvasRenderingContext2D, v: number, L: number) {
  const [lx, ly] = cm.toScreen(6, L + 1.5);
  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  const dir = v > 0 ? '\u53F3' : '\u5DE6';
  const fluxChange = v > 0 ? '\u589E\u5927' : '\u51CF\u5C0F';
  const inducedB = v > 0 ? '\u5411\u5916' : '\u5411\u91CC';
  const currentDir = v > 0 ? '\u9006\u65F6\u9488' : '\u987A\u65F6\u9488';
  ctx.fillText('\u695E\u6B21\u5B9A\u5F8B\u5206\u6790:', lx, ly);
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`1. \u5BFC\u4F53\u68D2\u5411${dir}\u8FD0\u52A8`, lx, ly + 20);
  ctx.fillText(`2. \u7A7F\u8FC7\u56DE\u8DEF\u7684\u78C1\u901A\u91CF${fluxChange}`, lx, ly + 38);
  ctx.fillText(`3. \u611F\u5E94\u78C1\u573A\u65B9\u5411${inducedB}(\u963B\u7919\u53D8\u5316)`, lx, ly + 56);
  ctx.fillText(`4. \u611F\u5E94\u7535\u6D41${currentDir}`, lx, ly + 74);
}

// ---------------------------------------------------------------------------
// Main render
// ---------------------------------------------------------------------------
function renderScene(t: number, state: SimState): void {
  updateOrigin();
  const scene = currentScene();
  if (scene === '双棒模型') { renderDualRod(t, state as DualRodState); return; }
  if (scene === '含电容模型') { renderCapacitor(t, state as CapacitorState); return; }
  if (scene === '竖直导轨') { renderVertical(t, state as VerticalState); return; }
  renderOriginal(t, state as EMIState);
}

// ---------------------------------------------------------------------------
// Original scenes render
// ---------------------------------------------------------------------------
function renderOriginal(t: number, state: EMIState): void {
  const B = panel.getValue<number>('B');
  const L = panel.getValue<number>('L');
  const scene = currentScene();
  const showLenz = panel.getValue<boolean>('showLenz');

  cm.clear('#070b14');
  const ctx = cm.ctx;

  drawMagneticField(ctx, B, L, 6, L);
  drawHorizontalRails(ctx, L, 10);
  drawResistor(ctx, 0, L / 2, 'R');
  drawBar(ctx, state.x, L, '#fbbf24', '\u5BFC\u4F53\u68D2');
  drawVelocityArrow(ctx, state.x, L + 0.3, state.v, 'v');
  drawCurrentInfo(ctx, B, L, state.v, state.I, state.x, L / 2);

  if (showLenz && scene === '\u5BFC\u8F68\u4E0A\u7684\u5BFC\u4F53\u68D2') {
    drawLenzAnalysis(ctx, state.v, L);
  }

  // Terminal velocity analysis
  if (scene === '\u5BFC\u8F68\u4E0A\u7684\u5BFC\u4F53\u68D2') {
    const R2 = panel.getValue<number>('R');
    const F_ext2 = panel.getValue<number>('F_ext');
    const f2 = panel.getValue<number>('friction');
    if (F_ext2 > f2) {
      const vTerminal = (F_ext2 - f2) * R2 / (B * B * L * L);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`\u7EC8\u6001\u901F\u5EA6 v_\u221E = (F-f)R/(B\u00B2L\u00B2) = ${vTerminal.toFixed(2)} m/s`, 20, 105);
    }
  }

  // Graph
  timeData.push(state.t);
  vData.push(state.v);
  IData.push(state.I);
  emfData.push(B * L * state.v);
  trimGraphData(500);

  const traces: GraphTrace[] = [
    { x: timeData, y: vData, name: 'v (m/s)', color: '#60a5fa' },
    { x: timeData, y: IData, name: 'I (A)', color: '#4ade80' },
    { x: timeData, y: emfData, name: 'EMF (V)', color: '#fbbf24' },
  ];
  graph.setTraces(traces);
  graph.updateCurrentTime(state.t);
  graph.render();
  controls.updateTime(state.t);
}

// ---------------------------------------------------------------------------
// Dual Rod render
// ---------------------------------------------------------------------------
function renderDualRod(_t: number, state: DualRodState): void {
  const B = panel.getValue<number>('B');
  const L = panel.getValue<number>('L');
  const m1 = panel.getValue<number>('mass');
  const m2 = panel.getValue<number>('mass2');
  const v0 = panel.getValue<number>('v0');
  const showLenz = panel.getValue<boolean>('showLenz');
  const f = panel.getValue<number>('friction');

  cm.clear('#070b14');
  const ctx = cm.ctx;

  drawMagneticField(ctx, B, L, 6, L);
  drawHorizontalRails(ctx, L, 10);
  drawResistor(ctx, 0, L / 2, 'R');

  // Two bars
  drawBar(ctx, state.x1, L, '#fbbf24', '\u68D21 (\u4E3B\u52A8)');
  drawBar(ctx, state.x2, L, '#f472b6', '\u68D22 (\u88AB\u52A8)');

  // Velocity arrows
  drawVelocityArrow(ctx, state.x1, L + 0.3, state.v1, 'v\u2081');
  drawVelocityArrow(ctx, state.x2, L + 0.6, state.v2, 'v\u2082');

  // Physics info
  const emf = B * L * (state.v1 - state.v2);
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`EMF = BL(v\u2081-v\u2082) = ${Math.abs(emf).toFixed(3)} V`, 20, 45);
  ctx.fillText(`I = EMF/R = ${Math.abs(state.I).toFixed(3)} A`, 20, 65);
  ctx.fillText(`F_\u5B89 = BIL = ${(B * Math.abs(state.I) * L).toFixed(3)} N`, 20, 85);

  // Terminal velocity
  const vTerminal = m1 * v0 / (m1 + m2);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  if (f < 0.001) {
    ctx.fillText(`\u7EC8\u6001\u901F\u5EA6 v_f = m\u2081v\u2080/(m\u2081+m\u2082) = ${vTerminal.toFixed(2)} m/s`, 20, 105);
  } else {
    ctx.fillText(`\u6709\u6469\u64E6\u529B: f = ${f.toFixed(1)} N, \u7EC8\u6001\u6761\u4EF6\u4E0D\u540C`, 20, 105);
  }
  ctx.fillText(`v\u2081 = ${state.v1.toFixed(3)} m/s, v\u2082 = ${state.v2.toFixed(3)} m/s`, 20, 125);

  // Current direction indicator
  if (Math.abs(state.I) > 0.001) {
    ctx.fillStyle = '#4ade80';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const midX = (state.x1 + state.x2) / 2;
    const [cx, cy] = cm.toScreen(midX, L / 2);
    const dir = state.v1 > state.v2 ? '\u2191' : '\u2193';
    ctx.fillText(`${dir} I`, cx, cy);
  }

  // Lenz analysis
  if (showLenz) {
    const [lx, ly] = cm.toScreen(6, L + 1.5);
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('\u53CC\u68D2\u6A21\u578B\u5206\u6790:', lx, ly);
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('1. \u68D21\u53D7\u5B89\u57F9\u529B\u51CF\u901F, \u68D22\u53D7\u5B89\u57F9\u529B\u52A0\u901F', lx, ly + 20);
    ctx.fillText('2. \u52A8\u91CF\u5B88\u6052: m\u2081v\u2081\u2080 = m\u2081v\u2081 + m\u2082v\u2082', lx, ly + 38);
    ctx.fillText('3. \u7EC8\u6001: v\u2081 = v\u2082, \u7535\u6D41\u4E3A\u96F6', lx, ly + 56);
  }

  // Graph
  timeData.push(state.t);
  vData.push(state.v1);
  v2Data.push(state.v2);
  IData.push(state.I);
  emfData.push(emf);
  trimGraphData(500);

  const traces: GraphTrace[] = [
    { x: timeData, y: vData, name: 'v\u2081 (m/s)', color: '#60a5fa' },
    { x: timeData, y: v2Data, name: 'v\u2082 (m/s)', color: '#f472b6' },
    { x: timeData, y: IData, name: 'I (A)', color: '#4ade80' },
    { x: timeData, y: emfData, name: 'EMF (V)', color: '#fbbf24' },
  ];
  graph.setTraces(traces);
  graph.updateCurrentTime(state.t);
  graph.render();
  controls.updateTime(state.t);
}

// ---------------------------------------------------------------------------
// Capacitor scene render
// ---------------------------------------------------------------------------
function renderCapacitor(_t: number, state: CapacitorState): void {
  const B = panel.getValue<number>('B');
  const L = panel.getValue<number>('L');
  const R = panel.getValue<number>('R');
  const C_uF = panel.getValue<number>('C');
  const showLenz = panel.getValue<boolean>('showLenz');

  cm.clear('#070b14');
  const ctx = cm.ctx;

  drawMagneticField(ctx, B, L, 6, L);
  drawHorizontalRails(ctx, L, 10);

  // Draw resistor (if R > 0)
  if (R > 0.01) {
    drawResistor(ctx, 0, L * 0.7, 'R');
  }

  // Draw capacitor symbol on left side
  const [cx, cy] = cm.toScreen(0, L * 0.3);
  ctx.strokeStyle = '#facc15';
  ctx.lineWidth = 3;
  // Two parallel plates
  ctx.beginPath();
  ctx.moveTo(cx - 10, cy - 12); ctx.lineTo(cx - 10, cy + 12); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(cx + 10, cy - 12); ctx.lineTo(cx + 10, cy + 12); ctx.stroke();
  ctx.fillStyle = '#facc15';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('C', cx, cy + 25);

  drawBar(ctx, state.x, L, '#fbbf24', '\u5BFC\u4F53\u68D2');
  drawVelocityArrow(ctx, state.x, L + 0.3, state.v, 'v');

  // Physics info
  const emf = B * L * state.v;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`EMF = BLv = ${Math.abs(emf).toFixed(3)} V`, 20, 45);
  ctx.fillText(`U_C = ${state.Uc.toFixed(3)} V`, 20, 65);
  ctx.fillText(`I = ${Math.abs(state.I).toFixed(4)} A`, 20, 85);
  ctx.fillText(`C = ${C_uF} \u00B5F`, 20, 105);

  // Terminal state info
  const v0 = panel.getValue<number>('v0');
  if (R < 0.01) {
    // Pure LC-like: energy conservation, v_terminal from BLv_t = q_final/C
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('\u7EAF\u7535\u5BB9: \u65E0\u80FD\u91CF\u635F\u8017, \u68D2\u6700\u7EC8\u505C\u6B62 (v\u2192\u5404\u79CD)', 20, 125);
  } else {
    // RC circuit: eventually I -> 0, v -> constant, U_C = BLv_terminal
    // Energy analysis: terminal when F_amp = 0 (I = 0)
    // In RC+EMF: transient dies out, final state: U_C = BLv_f
    // With no friction/external force, rod decelerates to some v_f
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText(`\u7EC8\u6001: I\u21920, U_C = BLv_f`, 20, 125);
    ctx.fillText(`\u5F53\u524D U_C/BLv = ${(state.Uc / (B * L * state.v + 1e-12)).toFixed(3)}`, 20, 145);
  }

  // Capacitor voltage display on the circuit
  const [ucx, ucy] = cm.toScreen(0, L * 0.3);
  ctx.fillStyle = '#facc15';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`${state.Uc.toFixed(2)} V`, ucx, ucy - 18);

  // Lenz analysis
  if (showLenz) {
    const [lx, ly] = cm.toScreen(6, L + 1.5);
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('\u542B\u7535\u5BB9\u6A21\u578B\u5206\u6790:', lx, ly);
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('1. EMF = BLv \u5BF9\u7535\u5BB9\u5145\u7535', lx, ly + 20);
    ctx.fillText('2. q = C\u00B7BLv, I = dq/dt', lx, ly + 38);
    ctx.fillText('3. \u7EC8\u6001: I\u21920, \u68D2\u5339\u901F, U_C = BLv_f', lx, ly + 56);
    ctx.fillText('4. \u7535\u5BB9\u5145\u7535\u8FC7\u7A0B\u7C7B\u4F3CRC\u7535\u8DEF', lx, ly + 74);
  }

  // Graph
  timeData.push(state.t);
  vData.push(state.v);
  IData.push(state.I);
  UcData.push(state.Uc);
  emfData.push(emf);
  trimGraphData(500);

  const traces: GraphTrace[] = [
    { x: timeData, y: vData, name: 'v (m/s)', color: '#60a5fa' },
    { x: timeData, y: IData, name: 'I (A)', color: '#4ade80' },
    { x: timeData, y: UcData, name: 'U_C (V)', color: '#facc15' },
    { x: timeData, y: emfData, name: 'EMF (V)', color: '#fbbf24' },
  ];
  graph.setTraces(traces);
  graph.updateCurrentTime(state.t);
  graph.render();
  controls.updateTime(state.t);
}

// ---------------------------------------------------------------------------
// Vertical rails render
// ---------------------------------------------------------------------------
function renderVertical(_t: number, state: VerticalState): void {
  const B = panel.getValue<number>('B');
  const L = panel.getValue<number>('L');
  const R = panel.getValue<number>('R');
  const m = panel.getValue<number>('mass');
  const showLenz = panel.getValue<boolean>('showLenz');

  cm.clear('#070b14');
  const ctx = cm.ctx;

  // For vertical scene, reinterpret coordinates:
  // x-axis of canvas = horizontal (rail spacing L)
  // y-axis of canvas = vertical position of rod (falls downward)
  // We draw vertical rails and the rod slides down

  // Magnetic field (perpendicular to rail plane)
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  for (let ix = 0; ix <= Math.ceil(L * 2); ix++) {
    for (let iy = -1; iy <= 6; iy++) {
      const [sx, sy] = cm.toScreen(ix * 0.5, -iy * 0.5 + 2);
      ctx.fillText('\u00D7', sx, sy);
    }
  }
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`B = ${B} T (\u5782\u76F4\u7EB8\u9762\u5411\u91CC)`, 20, 25);

  // Vertical rails (drawn as vertical lines)
  cm.drawLine(0, 3, 0, -2, { color: '#64748b', width: 4 });
  cm.drawLine(L, 3, L, -2, { color: '#64748b', width: 4 });

  // Top connecting wire with resistor
  cm.drawLine(0, 3, L, 3, { color: '#64748b', width: 3 });
  drawResistor(ctx, L / 2, 3, 'R');

  // Rod position (maps y downward: rod at canvas y = 2 - scaled position)
  const rodCanvasY = 2 - state.y * 0.3; // scale down for visibility
  if (rodCanvasY > -1.8) {
    cm.drawLine(0, rodCanvasY, L, rodCanvasY, { color: '#fbbf24', width: 5 });

    // Label
    const [bx, by] = cm.toScreen(L / 2, rodCanvasY);
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('\u5BFC\u4F53\u68D2', bx, by + 20);

    // Gravity arrow (downward)
    const [gx, gy] = cm.toScreen(L + 0.5, rodCanvasY);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx, gy + 30);
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(gx, gy + 30);
    ctx.lineTo(gx - 5, gy + 22);
    ctx.lineTo(gx + 5, gy + 22);
    ctx.closePath();
    ctx.fill();
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('mg', gx + 8, gy + 20);

    // Ampere force arrow (upward, opposing gravity when falling)
    if (Math.abs(state.I) > 0.001) {
      const F_amp = B * B * L * L * state.v / R;
      const fScale = Math.min(F_amp / (m * GRAVITY) * 25, 25);
      ctx.strokeStyle = '#4ade80';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx + 40, gy);
      ctx.lineTo(gx + 40, gy - fScale);
      ctx.stroke();
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.moveTo(gx + 40, gy - fScale);
      ctx.lineTo(gx + 35, gy - fScale + 8);
      ctx.lineTo(gx + 45, gy - fScale + 8);
      ctx.closePath();
      ctx.fill();
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('F\u5B89', gx + 48, gy - fScale + 5);
    }
  }

  // Physics info
  const vTerminal = m * GRAVITY * R / (B * B * L * L);
  const emf = B * L * state.v;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`v = ${state.v.toFixed(3)} m/s (\u5411\u4E0B)`, 20, 45);
  ctx.fillText(`EMF = BLv = ${emf.toFixed(3)} V`, 20, 65);
  ctx.fillText(`I = ${Math.abs(state.I).toFixed(3)} A`, 20, 85);
  ctx.fillText(`F_\u5B89 = B\u00B2L\u00B2v/R = ${(B * B * L * L * state.v / R).toFixed(3)} N`, 20, 105);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`\u7EC8\u7AEF\u901F\u5EA6 v_\u221E = mgR/(B\u00B2L\u00B2) = ${vTerminal.toFixed(2)} m/s`, 20, 125);
  ctx.fillText(`v/v_\u221E = ${(state.v / vTerminal).toFixed(3)}`, 20, 145);

  // Current direction
  if (Math.abs(state.I) > 0.001) {
    ctx.fillStyle = '#4ade80';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [ix1, iy1] = cm.toScreen(L / 2, rodCanvasY);
    ctx.fillText(state.v > 0 ? '\u2192 I' : '\u2190 I', ix1, iy1 - 10);
  }

  // Lenz analysis
  if (showLenz) {
    const [lx, ly] = cm.toScreen(4, 3.5);
    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('\u7AD6\u76F4\u5BFC\u8F68\u5206\u6790:', lx, ly);
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.fillText('1. \u91CD\u529B\u9A71\u52A8\u68D2\u5411\u4E0B\u8FD0\u52A8', lx, ly + 20);
    ctx.fillText('2. \u611F\u5E94\u7535\u6D41\u4EA7\u751F\u5411\u4E0A\u7684\u5B89\u57F9\u529B', lx, ly + 38);
    ctx.fillText('3. \u7C7B\u4F3C\u7A7A\u6C14\u963B\u529B\u7684\u7EC8\u7AEF\u901F\u5EA6', lx, ly + 56);
    ctx.fillText('4. mg = B\u00B2L\u00B2v_\u221E/R \u65F6\u8FBE\u5E73\u8861', lx, ly + 74);
  }

  // Graph
  timeData.push(state.t);
  vData.push(state.v);
  IData.push(state.I);
  emfData.push(emf);
  trimGraphData(500);

  const traces: GraphTrace[] = [
    { x: timeData, y: vData, name: 'v (m/s)', color: '#60a5fa' },
    { x: timeData, y: IData, name: 'I (A)', color: '#4ade80' },
    { x: timeData, y: emfData, name: 'EMF (V)', color: '#fbbf24' },
  ];
  graph.setTraces(traces);
  graph.updateCurrentTime(state.t);
  graph.render();
  controls.updateTime(state.t);
}

// ---------------------------------------------------------------------------
// Sim loop
// ---------------------------------------------------------------------------
const sim = new SimLoop<SimState>({
  dt: 1 / 120,
  stepFn: createAnyStepFn(),
  renderFn: renderScene,
  initialState: getAnyInitialState(),
});

controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => {
  clearGraphData();
  sim.reset(getAnyInitialState());
  sim.updateStepFn(createAnyStepFn());
  controls.setPlaying(false);
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

panel.setOnChange(() => {
  clearGraphData();
  sim.reset(getAnyInitialState());
  sim.updateStepFn(createAnyStepFn());
});

renderScene(0, getAnyInitialState());

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
