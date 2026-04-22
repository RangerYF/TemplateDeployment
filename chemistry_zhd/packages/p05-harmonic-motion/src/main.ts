import '@physics/core/styles.css';
import {
  createLayout,
  ParameterPanel,
  defineParams,
  PlaybackControls,
  SimLoop,
  CanvasManager,
  ArrowRenderer,
  ARROW_COLORS,
  GridRenderer,
  SyncedGraph,
  GRAVITY,
  rk4Step,
} from '@physics/core';
import type { SimState, GraphTrace, DerivativeFunction } from '@physics/core';

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
interface HarmonicState extends SimState {
  x: number;   // spring: displacement from equilibrium (m); pendulum: angle theta (rad)
  v: number;   // spring: velocity (m/s); pendulum: angular velocity (rad/s)
  // Coupled pendulums extra state
  x2: number;  // second pendulum angle (rad)
  v2: number;  // second pendulum angular velocity (rad/s)
}

type SceneType = '弹簧振子' | '单摆' | '竖直弹簧振子' | '多摆耦合';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-05 简谐运动');

// ---------------------------------------------------------------------------
// Parameters
// ---------------------------------------------------------------------------
const paramDefs = defineParams([
  {
    key: 'scene', label: '场景', type: 'select',
    default: '弹簧振子', options: ['弹簧振子', '单摆', '竖直弹簧振子', '多摆耦合'],
  },
  // Spring oscillator params
  { key: 'mass', label: '质量 m', unit: 'kg', min: 0.1, max: 5, step: 0.1, default: 1, scenes: ['弹簧振子', '单摆', '竖直弹簧振子', '多摆耦合'] },
  { key: 'springK', label: '弹簧刚度 k', unit: 'N/m', min: 1, max: 100, step: 1, default: 20, scenes: ['弹簧振子', '竖直弹簧振子'] },
  { key: 'amplitude', label: '振幅 A', unit: 'm', min: 0.1, max: 3, step: 0.1, default: 1.5, scenes: ['弹簧振子', '竖直弹簧振子'] },
  { key: 'phase', label: '初相 \u03c6', unit: 'rad', min: 0, max: 6.28, step: 0.01, default: 0, scenes: ['弹簧振子'] },
  // Pendulum params
  { key: 'pendulumL', label: '摆长 L', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 2, scenes: ['单摆', '多摆耦合'] },
  { key: 'theta0', label: '初始角度 \u03b8\u2080', unit: '\u00b0', min: 1, max: 90, step: 1, default: 15, scenes: ['单摆'] },
  // Coupled pendulums params
  { key: 'couplingK', label: '耦合弹簧 k_c', unit: 'N/m', min: 0.1, max: 10, step: 0.1, default: 1.0, scenes: ['多摆耦合'] },
  { key: 'coupledAmplitude', label: '初始振幅 (摆1)', unit: '\u00b0', min: 1, max: 30, step: 1, default: 10, scenes: ['多摆耦合'] },
  // Display
  { key: 'showVectors', label: '显示矢量', type: 'checkbox', default: true, scenes: ['弹簧振子', '单摆', '竖直弹簧振子'] },
  { key: 'showPhaseCircle', label: '参考圆(弹簧)', type: 'checkbox', default: true, scenes: ['弹簧振子'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);

// ---------------------------------------------------------------------------
// Canvas
// ---------------------------------------------------------------------------
const cm = new CanvasManager({ container: layout.canvas });
cm.setScale(80);

function updateOrigin(): void {
  cm.setOrigin(cm.getWidth() / 2, cm.getHeight() / 2);
}

const arrows = new ArrowRenderer(cm);
const grid = new GridRenderer(cm);

// ---------------------------------------------------------------------------
// Graphs  (3 for spring, 1 for pendulum, 3 for vertical spring, 2 for coupled)
// ---------------------------------------------------------------------------
const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
graphContainer.style.display = 'flex';
graphContainer.style.flexDirection = 'column';
graphContainer.style.gap = '2px';
layout.bottomPanel.appendChild(graphContainer);

// We create graph wrappers; we'll swap visibility per scene
const graphWrapSpring = document.createElement('div');
graphWrapSpring.style.display = 'flex';
graphWrapSpring.style.flex = '1';
graphWrapSpring.style.gap = '4px';
graphContainer.appendChild(graphWrapSpring);

const graphWrapPendulum = document.createElement('div');
graphWrapPendulum.style.display = 'none';
graphWrapPendulum.style.flex = '1';
graphWrapPendulum.style.gap = '4px';
graphContainer.appendChild(graphWrapPendulum);

const graphWrapVertSpring = document.createElement('div');
graphWrapVertSpring.style.display = 'none';
graphWrapVertSpring.style.flex = '1';
graphWrapVertSpring.style.gap = '4px';
graphContainer.appendChild(graphWrapVertSpring);

const graphWrapCoupled = document.createElement('div');
graphWrapCoupled.style.display = 'none';
graphWrapCoupled.style.flex = '1';
graphWrapCoupled.style.gap = '4px';
graphContainer.appendChild(graphWrapCoupled);

// Spring graphs: x-t, v-t, a-t
function makeGraphCol(parent: HTMLElement): HTMLDivElement {
  const d = document.createElement('div');
  d.style.flex = '1';
  d.style.minWidth = '0';
  parent.appendChild(d);
  return d;
}

const xtCol = makeGraphCol(graphWrapSpring);
const vtCol = makeGraphCol(graphWrapSpring);
const atCol = makeGraphCol(graphWrapSpring);

const graphXt = new SyncedGraph({
  container: xtCol,
  title: 'x-t \u4f4d\u79fb',
  xLabel: 't (s)',
  yLabel: 'x (m)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

const graphVt = new SyncedGraph({
  container: vtCol,
  title: 'v-t \u901f\u5ea6',
  xLabel: 't (s)',
  yLabel: 'v (m/s)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

const graphAt = new SyncedGraph({
  container: atCol,
  title: 'a-t \u52a0\u901f\u5ea6',
  xLabel: 't (s)',
  yLabel: 'a (m/s\u00b2)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

// Pendulum graph: theta-t
const pendGraphCol = makeGraphCol(graphWrapPendulum);

const graphTheta = new SyncedGraph({
  container: pendGraphCol,
  title: '\u03b8-t \u89d2\u5ea6',
  xLabel: 't (s)',
  yLabel: '\u03b8 (\u00b0)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

// Period info panel for pendulum
const pendInfoCol = makeGraphCol(graphWrapPendulum);
const periodInfoDiv = document.createElement('div');
periodInfoDiv.style.cssText =
  'color:#e2e8f0;font-size:16px;padding:16px;line-height:2;background:#12122a;border-radius:4px;height:100%;';
pendInfoCol.appendChild(periodInfoDiv);

// Vertical spring graphs: x-t, v-t, a-t
const vsXtCol = makeGraphCol(graphWrapVertSpring);
const vsVtCol = makeGraphCol(graphWrapVertSpring);
const vsAtCol = makeGraphCol(graphWrapVertSpring);

const graphVsXt = new SyncedGraph({
  container: vsXtCol,
  title: 'x-t \u4f4d\u79fb (离平衡位置)',
  xLabel: 't (s)',
  yLabel: 'x (m)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

const graphVsVt = new SyncedGraph({
  container: vsVtCol,
  title: 'v-t \u901f\u5ea6',
  xLabel: 't (s)',
  yLabel: 'v (m/s)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

const graphVsAt = new SyncedGraph({
  container: vsAtCol,
  title: 'a-t \u52a0\u901f\u5ea6',
  xLabel: 't (s)',
  yLabel: 'a (m/s\u00b2)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

// Coupled pendulums graphs: theta1-t, theta2-t
const cpTheta1Col = makeGraphCol(graphWrapCoupled);
const cpTheta2Col = makeGraphCol(graphWrapCoupled);

const graphCpTheta1 = new SyncedGraph({
  container: cpTheta1Col,
  title: '\u03b8\u2081-t \u6446\u2460',
  xLabel: 't (s)',
  yLabel: '\u03b8\u2081 (\u00b0)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

const graphCpTheta2 = new SyncedGraph({
  container: cpTheta2Col,
  title: '\u03b8\u2082-t \u6446\u2461',
  xLabel: 't (s)',
  yLabel: '\u03b8\u2082 (\u00b0)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

// ---------------------------------------------------------------------------
// Graph data buffers
// ---------------------------------------------------------------------------
const tData: number[] = [];
const xData: number[] = [];
const vData: number[] = [];
const aData: number[] = [];
const thetaDegData: number[] = [];
// Vertical spring data
const vsXData: number[] = [];
const vsVData: number[] = [];
const vsAData: number[] = [];
// Coupled pendulums data
const cpTheta1Data: number[] = [];
const cpTheta2Data: number[] = [];

function clearGraphData(): void {
  tData.length = 0;
  xData.length = 0;
  vData.length = 0;
  aData.length = 0;
  thetaDegData.length = 0;
  vsXData.length = 0;
  vsVData.length = 0;
  vsAData.length = 0;
  cpTheta1Data.length = 0;
  cpTheta2Data.length = 0;
}

function trimData(maxPts = 600): void {
  if (tData.length > maxPts) {
    const excess = tData.length - maxPts;
    tData.splice(0, excess);
    xData.splice(0, excess);
    vData.splice(0, excess);
    aData.splice(0, excess);
    thetaDegData.splice(0, excess);
    vsXData.splice(0, excess);
    vsVData.splice(0, excess);
    vsAData.splice(0, excess);
    cpTheta1Data.splice(0, excess);
    cpTheta2Data.splice(0, excess);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getScene(): SceneType {
  return panel.getValue<string>('scene') as SceneType;
}

function getInitialState(): HarmonicState {
  const scene = getScene();
  if (scene === '弹簧振子') {
    const A = panel.getValue<number>('amplitude');
    const phi = panel.getValue<number>('phase');
    const k = panel.getValue<number>('springK');
    const m = panel.getValue<number>('mass');
    const omega = Math.sqrt(k / m);
    return {
      x: A * Math.sin(phi),
      v: A * omega * Math.cos(phi),
      x2: 0,
      v2: 0,
    };
  } else if (scene === '单摆') {
    const theta0 = panel.getValue<number>('theta0') * (Math.PI / 180);
    return { x: theta0, v: 0, x2: 0, v2: 0 };
  } else if (scene === '竖直弹簧振子') {
    // Displacement from equilibrium; start at +A (pulled down from equilibrium)
    const A = panel.getValue<number>('amplitude');
    return { x: A, v: 0, x2: 0, v2: 0 };
  } else {
    // Coupled pendulums: pendulum 1 starts at amplitude, pendulum 2 at rest
    const theta1_0 = panel.getValue<number>('coupledAmplitude') * (Math.PI / 180);
    return { x: theta1_0, v: 0, x2: 0, v2: 0 };
  }
}

// ---------------------------------------------------------------------------
// Physics step functions
// ---------------------------------------------------------------------------
function createStepFn() {
  const scene = getScene();
  const m = panel.getValue<number>('mass');
  const k = panel.getValue<number>('springK');
  const L = panel.getValue<number>('pendulumL');

  if (scene === '弹簧振子') {
    // x'' = -(k/m)x  =>  state = [x, v],  deriv = [v, -(k/m)x]
    const omega2 = k / m;
    return (_t: number, dt: number, state: HarmonicState): HarmonicState => {
      const derivFn: DerivativeFunction = (_tt, s) => [s[1], -omega2 * s[0]];
      const next = rk4Step(derivFn, _t, [state.x, state.v], dt);
      return { x: next[0], v: next[1], x2: 0, v2: 0 };
    };
  } else if (scene === '单摆') {
    // Pendulum: theta'' = -(g/L)*sin(theta)  -- large angle, RK4
    return (_t: number, dt: number, state: HarmonicState): HarmonicState => {
      const derivFn: DerivativeFunction = (_tt, s) => [s[1], -(GRAVITY / L) * Math.sin(s[0])];
      const next = rk4Step(derivFn, _t, [state.x, state.v], dt);
      return { x: next[0], v: next[1], x2: 0, v2: 0 };
    };
  } else if (scene === '竖直弹簧振子') {
    // Vertical spring: displacement x measured from equilibrium position
    // At equilibrium, spring extension = mg/k, net force = 0
    // Displacement x from equilibrium: F_net = -kx  =>  x'' = -(k/m)x
    // Identical equation to horizontal spring!
    const omega2 = k / m;
    return (_t: number, dt: number, state: HarmonicState): HarmonicState => {
      const derivFn: DerivativeFunction = (_tt, s) => [s[1], -omega2 * s[0]];
      const next = rk4Step(derivFn, _t, [state.x, state.v], dt);
      return { x: next[0], v: next[1], x2: 0, v2: 0 };
    };
  } else {
    // Coupled pendulums: two pendulums connected by a coupling spring
    // theta1'' = -(g/L)*theta1 - (k_c*L/m)*(theta1 - theta2)
    // theta2'' = -(g/L)*theta2 - (k_c*L/m)*(theta2 - theta1)
    // State vector: [theta1, omega1, theta2, omega2]
    const kc = panel.getValue<number>('couplingK');
    const gOverL = GRAVITY / L;
    const coupling = kc / m;
    return (_t: number, dt: number, state: HarmonicState): HarmonicState => {
      const derivFn: DerivativeFunction = (_tt, s) => [
        s[1],
        -gOverL * s[0] - coupling * (s[0] - s[2]),
        s[3],
        -gOverL * s[2] - coupling * (s[2] - s[0]),
      ];
      const next = rk4Step(derivFn, _t, [state.x, state.v, state.x2, state.v2], dt);
      return { x: next[0], v: next[1], x2: next[2], v2: next[3] };
    };
  }
}

// ---------------------------------------------------------------------------
// Drawing helpers
// ---------------------------------------------------------------------------

/** Draw the phase (reference) circle for spring oscillator */
function drawPhaseCircle(
  ctx: CanvasRenderingContext2D,
  centerX: number, centerY: number,
  radius: number,
  A: number, omega: number, t: number, phi: number,
): void {
  const angle = omega * t + phi;

  // circle outline
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.stroke();

  // rotating point
  const circAngle = angle; // wt + phi
  const dotX = centerX + radius * Math.cos(circAngle);
  const dotY = centerY - radius * Math.sin(circAngle);

  // radius line
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(centerX, centerY);
  ctx.lineTo(dotX, dotY);
  ctx.stroke();

  // dot
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
  ctx.fill();

  // projection line to spring position (horizontal)
  const projX = centerX;
  const projY = centerY - radius * Math.sin(circAngle);
  ctx.strokeStyle = 'rgba(251,191,36,0.5)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(dotX, dotY);
  ctx.lineTo(projX, projY);
  ctx.stroke();
  ctx.setLineDash([]);

  // projection dot
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.arc(projX, projY, 4, 0, Math.PI * 2);
  ctx.fill();

  // Labels
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('参考圆', centerX, centerY - radius - 10);

  // angle label
  const labelR = radius * 0.5;
  const midAngle = circAngle / 2;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(
    `\u03c9t+\u03c6=${(circAngle % (2 * Math.PI)).toFixed(1)}`,
    centerX + labelR * Math.cos(midAngle) + 20,
    centerY - labelR * Math.sin(midAngle),
  );
}

// ---------------------------------------------------------------------------
// Scene visibility management
// ---------------------------------------------------------------------------
function updateSceneUI(): void {
  const scene = getScene();
  graphWrapSpring.style.display = scene === '弹簧振子' ? 'flex' : 'none';
  graphWrapPendulum.style.display = scene === '单摆' ? 'flex' : 'none';
  graphWrapVertSpring.style.display = scene === '竖直弹簧振子' ? 'flex' : 'none';
  graphWrapCoupled.style.display = scene === '多摆耦合' ? 'flex' : 'none';
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------
function renderScene(t: number, state: HarmonicState): void {
  const scene = getScene();
  const m = panel.getValue<number>('mass');
  const k = panel.getValue<number>('springK');
  const A = panel.getValue<number>('amplitude');
  const phi = panel.getValue<number>('phase');
  const L = panel.getValue<number>('pendulumL');
  const theta0deg = panel.getValue<number>('theta0');
  const showVectors = panel.getValue<boolean>('showVectors');
  const showPhase = panel.getValue<boolean>('showPhaseCircle');

  updateOrigin();
  cm.clear('#070b14');

  const ctx = cm.ctx;

  if (scene === '弹簧振子') {
    renderSpringScene(t, state, ctx, m, k, A, phi, showVectors, showPhase);
  } else if (scene === '单摆') {
    renderPendulumScene(t, state, ctx, m, L, theta0deg, showVectors);
  } else if (scene === '竖直弹簧振子') {
    renderVerticalSpringScene(t, state, ctx, m, k, A, showVectors);
  } else {
    renderCoupledPendulumScene(t, state, ctx, m, L);
  }

  // --- Update graphs ---
  if (scene === '弹簧振子') {
    const acc = -(k / m) * state.x;

    tData.push(t);
    xData.push(state.x);
    vData.push(state.v);
    aData.push(acc);
    thetaDegData.push(0);
    vsXData.push(0); vsVData.push(0); vsAData.push(0);
    cpTheta1Data.push(0); cpTheta2Data.push(0);
    trimData();

    const tracesX: GraphTrace[] = [
      { x: tData, y: xData, name: 'x (m)', color: '#60a5fa' },
    ];
    const tracesV: GraphTrace[] = [
      { x: tData, y: vData, name: 'v (m/s)', color: ARROW_COLORS.velocity },
    ];
    const tracesA: GraphTrace[] = [
      { x: tData, y: aData, name: 'a (m/s\u00b2)', color: ARROW_COLORS.acceleration },
    ];

    graphXt.setTraces(tracesX);
    graphXt.updateCurrentTime(t);
    graphXt.render();

    graphVt.setTraces(tracesV);
    graphVt.updateCurrentTime(t);
    graphVt.render();

    graphAt.setTraces(tracesA);
    graphAt.updateCurrentTime(t);
    graphAt.render();
  } else if (scene === '单摆') {
    // Pendulum
    const thetaDeg = state.x * (180 / Math.PI);
    tData.push(t);
    thetaDegData.push(thetaDeg);
    xData.push(0); vData.push(0); aData.push(0);
    vsXData.push(0); vsVData.push(0); vsAData.push(0);
    cpTheta1Data.push(0); cpTheta2Data.push(0);
    trimData();

    const tracesTheta: GraphTrace[] = [
      { x: tData, y: thetaDegData, name: '\u03b8 (\u00b0)', color: '#fbbf24' },
    ];
    graphTheta.setTraces(tracesTheta);
    graphTheta.updateCurrentTime(t);
    graphTheta.render();

    // Period info
    const analyticT = 2 * Math.PI * Math.sqrt(L / GRAVITY);
    const numericalT = measureNumericalPeriod();
    periodInfoDiv.innerHTML = `
      <div style="font-size:20px;font-weight:700;margin-bottom:12px;color:#fbbf24;">周期对比</div>
      <div><b>摆长 L</b> = ${L.toFixed(1)} m</div>
      <div><b>初始角度 \u03b8\u2080</b> = ${theta0deg}\u00b0</div>
      <div><b>质量 m</b> = ${m.toFixed(1)} kg</div>
      <hr style="border-color:rgba(255,255,255,0.1);margin:8px 0;">
      <div style="color:#4ade80;"><b>解析周期</b> (小角度)</div>
      <div>T = 2\u03c0\u221a(L/g) = <b>${analyticT.toFixed(4)} s</b></div>
      <hr style="border-color:rgba(255,255,255,0.1);margin:8px 0;">
      <div style="color:#60a5fa;"><b>数值周期</b> (RK4)</div>
      <div>T \u2248 <b>${numericalT !== null ? numericalT.toFixed(4) + ' s' : '测量中...'}</b></div>
      ${numericalT !== null ? `<div style="color:#f87171;font-size:14px;">相对误差: ${(Math.abs(numericalT - analyticT) / analyticT * 100).toFixed(2)}%</div>` : ''}
    `;
  } else if (scene === '竖直弹簧振子') {
    // Vertical spring: x is displacement from equilibrium
    const acc = -(k / m) * state.x;

    tData.push(t);
    xData.push(0); vData.push(0); aData.push(0);
    thetaDegData.push(0);
    vsXData.push(state.x);
    vsVData.push(state.v);
    vsAData.push(acc);
    cpTheta1Data.push(0); cpTheta2Data.push(0);
    trimData();

    const tracesX: GraphTrace[] = [
      { x: tData, y: vsXData, name: 'x (m)', color: '#60a5fa' },
    ];
    const tracesV: GraphTrace[] = [
      { x: tData, y: vsVData, name: 'v (m/s)', color: ARROW_COLORS.velocity },
    ];
    const tracesA: GraphTrace[] = [
      { x: tData, y: vsAData, name: 'a (m/s\u00b2)', color: ARROW_COLORS.acceleration },
    ];

    graphVsXt.setTraces(tracesX);
    graphVsXt.updateCurrentTime(t);
    graphVsXt.render();

    graphVsVt.setTraces(tracesV);
    graphVsVt.updateCurrentTime(t);
    graphVsVt.render();

    graphVsAt.setTraces(tracesA);
    graphVsAt.updateCurrentTime(t);
    graphVsAt.render();
  } else {
    // Coupled pendulums
    const theta1Deg = state.x * (180 / Math.PI);
    const theta2Deg = state.x2 * (180 / Math.PI);

    tData.push(t);
    xData.push(0); vData.push(0); aData.push(0);
    thetaDegData.push(0);
    vsXData.push(0); vsVData.push(0); vsAData.push(0);
    cpTheta1Data.push(theta1Deg);
    cpTheta2Data.push(theta2Deg);
    trimData();

    const tracesT1: GraphTrace[] = [
      { x: tData, y: cpTheta1Data, name: '\u03b8\u2081 (\u00b0)', color: '#60a5fa' },
    ];
    const tracesT2: GraphTrace[] = [
      { x: tData, y: cpTheta2Data, name: '\u03b8\u2082 (\u00b0)', color: '#f87171' },
    ];

    graphCpTheta1.setTraces(tracesT1);
    graphCpTheta1.updateCurrentTime(t);
    graphCpTheta1.render();

    graphCpTheta2.setTraces(tracesT2);
    graphCpTheta2.updateCurrentTime(t);
    graphCpTheta2.render();
  }

  controls.updateTime(t);
}

// ---------------------------------------------------------------------------
// Render: Spring oscillator
// ---------------------------------------------------------------------------
function renderSpringScene(
  t: number, state: HarmonicState, ctx: CanvasRenderingContext2D,
  m: number, k: number, A: number, phi: number,
  showVectors: boolean, showPhase: boolean,
): void {
  const omega = Math.sqrt(k / m);
  const x = state.x;  // displacement from equilibrium
  const v = state.v;
  const acc = -(k / m) * x;

  // World setup: origin = equilibrium position of mass center
  // Wall on the left, spring horizontal, mass block slides right/left
  const wallWorldX = -3.5;
  const eqWorldX = 0; // equilibrium at origin
  const blockWorldX = x; // current position
  const worldY = 0;

  // Draw grid lightly
  grid.draw({ majorSpacing: 1, showLabels: true, labelUnit: 'm' });

  // --- Wall ---
  cm.drawWall(wallWorldX, -1.2, 1.2, 'right');

  // --- Surface (frictionless) ---
  cm.drawTexturedGround(wallWorldX, 4, -0.5, 'concrete');

  // --- Spring (zigzag from wall to block) ---
  const blockHalfW = 0.3125; // world units (25px / 80 scale)
  const blockHalfH = 0.25;   // world units (20px / 80 scale)
  cm.drawSpring(wallWorldX, worldY, blockWorldX - blockHalfW, worldY, 10, 14);

  // --- Mass block ---
  cm.drawCrate(blockWorldX, -0.5, blockHalfW, blockHalfH);

  // mass label
  cm.drawText(`${m.toFixed(1)}kg`, blockWorldX, worldY, { color: '#e2e8f0', bg: true });

  // --- Equilibrium dashed line ---
  cm.drawLine(eqWorldX, 1.5, eqWorldX, -1.5, 'rgba(255,255,255,0.2)', 1, true);
  cm.drawText('O (平衡位置)', eqWorldX, -1.5, { color: 'rgba(255,255,255,0.4)', offsetY: 16 });

  // --- Displacement label ---
  if (Math.abs(x) > 0.01) {
    cm.drawText(`x = ${x.toFixed(2)} m`, blockWorldX, worldY, { color: '#60a5fa', offsetY: -36, bg: true });
  }

  // --- Force / velocity / acceleration arrows ---
  if (showVectors) {
    const arrowScale = 0.015; // scale force arrows to world units
    const velScale = 0.3;
    const accScale = 0.02;

    // Force arrow (green): F = -kx
    const F = -k * x;
    if (Math.abs(F) > 0.05) {
      arrows.draw(blockWorldX, worldY + 0.45, F * arrowScale, 0, {
        color: ARROW_COLORS.force,
        label: `F=${F.toFixed(1)}N`,
        labelOffset: -18,
      });
    }

    // Velocity arrow (blue)
    if (Math.abs(v) > 0.01) {
      arrows.draw(blockWorldX, worldY - 0.45, v * velScale, 0, {
        color: ARROW_COLORS.velocity,
        label: `v=${v.toFixed(2)}m/s`,
        labelOffset: 18,
      });
    }

    // Acceleration arrow (red): a = -(k/m)x
    if (Math.abs(acc) > 0.01) {
      arrows.draw(blockWorldX, worldY + 0.9, acc * accScale, 0, {
        color: ARROW_COLORS.acceleration,
        label: `a=${acc.toFixed(1)}m/s\u00b2`,
        labelOffset: -18,
      });
    }
  }

  // --- Phase circle (reference circle) ---
  if (showPhase) {
    const circCx = cm.getWidth() - 120;
    const circCy = 120;
    const circR = 70;
    drawPhaseCircle(ctx, circCx, circCy, circR, A, omega, t, phi);
  }

  // --- Info text ---
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  const infoX = 16;
  let infoY = 24;
  ctx.fillText(`\u03c9 = \u221a(k/m) = ${omega.toFixed(2)} rad/s`, infoX, infoY); infoY += 22;
  const T = (2 * Math.PI) / omega;
  ctx.fillText(`T = 2\u03c0/\u03c9 = ${T.toFixed(3)} s`, infoX, infoY); infoY += 22;
  const f = 1 / T;
  ctx.fillText(`f = ${f.toFixed(3)} Hz`, infoX, infoY);
}

// ---------------------------------------------------------------------------
// Render: Pendulum
// ---------------------------------------------------------------------------
function renderPendulumScene(
  t: number, state: HarmonicState, ctx: CanvasRenderingContext2D,
  m: number, L: number, theta0deg: number,
  showVectors: boolean,
): void {
  const theta = state.x;
  const omega = state.v;

  // Pivot at top center of canvas
  const pivotWorldX = 0;
  const pivotWorldY = 2.5;

  // Set up canvas for pendulum view
  cm.setOrigin(cm.getWidth() / 2, 60);
  cm.setScale(80);

  cm.clear('#070b14');

  // Light grid
  grid.draw({ majorSpacing: 1, showLabels: false });

  const [pivSx, pivSy] = cm.toScreen(pivotWorldX, pivotWorldY);

  // Pivot mount
  roundRect(ctx, pivSx - 40, pivSy - 8, 80, 8, 3);
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bob position in world coords
  const bobWorldX = pivotWorldX + L * Math.sin(theta);
  const bobWorldY = pivotWorldY - L * Math.cos(theta);
  const [bobSx, bobSy] = cm.toScreen(bobWorldX, bobWorldY);

  // String
  cm.drawLine(pivotWorldX, pivotWorldY, bobWorldX, bobWorldY, '#94a3b8', 2, false);

  // Vertical reference (dashed)
  cm.drawLine(pivotWorldX, pivotWorldY, pivotWorldX, pivotWorldY - L, 'rgba(255,255,255,0.15)', 1, true);

  // Angle arc
  if (Math.abs(theta) > 0.01) {
    const arcR = 40;
    ctx.strokeStyle = 'rgba(251,191,36,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    const vertAngle = Math.PI / 2; // straight down in screen
    const stringAngle = Math.atan2(bobSy - pivSy, bobSx - pivSx);
    if (theta > 0) {
      ctx.arc(pivSx, pivSy, arcR, vertAngle, stringAngle, false);
    } else {
      ctx.arc(pivSx, pivSy, arcR, stringAngle, vertAngle, false);
    }
    ctx.stroke();

    // Angle label
    const midA = (vertAngle + stringAngle) / 2;
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `\u03b8=${(theta * 180 / Math.PI).toFixed(1)}\u00b0`,
      pivSx + (arcR + 20) * Math.cos(midA),
      pivSy + (arcR + 20) * Math.sin(midA),
    );
  }

  // Bob
  const bobRadius = Math.max(14, m * 10);
  cm.drawBall(bobWorldX, bobWorldY, bobRadius, '#60a5fa', { label: `${m.toFixed(1)}kg`, glow: true });

  // Vectors
  if (showVectors) {
    // Tangential velocity
    const vTangential = L * omega;
    if (Math.abs(vTangential) > 0.01) {
      const tangDx = Math.cos(theta);
      const tangDy = Math.sin(theta);
      const vScale = 0.15;
      arrows.draw(
        bobWorldX, bobWorldY,
        tangDx * vTangential * vScale, tangDy * vTangential * vScale,
        {
          color: ARROW_COLORS.velocity,
          label: `v=${Math.abs(vTangential).toFixed(2)}`,
          labelOffset: 18,
        },
      );
    }

    // Gravity force (downward)
    const gForce = m * GRAVITY;
    const gScale = 0.008;
    arrows.draw(bobWorldX, bobWorldY, 0, -gForce * gScale, {
      color: ARROW_COLORS.force,
      label: 'mg',
      labelOffset: -18,
    });

    // Restoring force component along tangent
    const fTangential = -m * GRAVITY * Math.sin(theta);
    if (Math.abs(fTangential) > 0.05) {
      const fScale = 0.012;
      const ftDx = Math.cos(theta) * fTangential * fScale;
      const ftDy = Math.sin(theta) * fTangential * fScale;
      arrows.draw(bobWorldX, bobWorldY, ftDx, ftDy, {
        color: '#4ade80',
        label: 'F\u5207',
        labelOffset: -18,
        dashed: true,
      });
    }
  }

  // Height reference line
  const lowestY = pivotWorldY - L;
  cm.drawLine(-5, lowestY, 5, lowestY, 'rgba(255,255,255,0.1)', 1, true);
  cm.drawText('最低点 (h=0)', 5, lowestY, { color: 'rgba(255,255,255,0.3)', offsetY: -6 });

  // Height of bob above lowest point
  const h = L * (1 - Math.cos(theta));
  cm.drawText(`h = ${h.toFixed(3)} m`, bobWorldX, bobWorldY, { color: '#e2e8f0', offsetX: bobRadius + 12, offsetY: -8, bg: true });
  cm.drawText(`\u03c9 = ${omega.toFixed(3)} rad/s`, bobWorldX, bobWorldY, { color: '#e2e8f0', offsetX: bobRadius + 12, offsetY: 14, bg: true });

  // Info text
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  const analyticT = 2 * Math.PI * Math.sqrt(L / GRAVITY);
  let iy = 24;
  ctx.fillText(`L = ${L.toFixed(1)} m`, 16, iy); iy += 22;
  ctx.fillText(`T(解析) = 2\u03c0\u221a(L/g) = ${analyticT.toFixed(3)} s`, 16, iy); iy += 22;
  ctx.fillText(`g = ${GRAVITY} m/s\u00b2`, 16, iy);

  // Reset origin for next frame
  updateOrigin();
  cm.setScale(80);
}

// ---------------------------------------------------------------------------
// Render: Vertical Spring Oscillator (竖直弹簧振子)
// ---------------------------------------------------------------------------
function renderVerticalSpringScene(
  t: number, state: HarmonicState, ctx: CanvasRenderingContext2D,
  m: number, k: number, A: number,
  showVectors: boolean,
): void {
  const omega = Math.sqrt(k / m);
  const x = state.x;  // displacement from equilibrium (positive = downward)
  const v = state.v;
  const acc = -(k / m) * x;

  // Equilibrium extension
  const x0 = m * GRAVITY / k;

  // Set up canvas: ceiling at top, spring hangs vertically
  cm.setOrigin(cm.getWidth() / 2, 50);
  cm.setScale(80);
  cm.clear('#070b14');

  // Light grid
  grid.draw({ majorSpacing: 1, showLabels: false });

  // World coordinates: y-axis points down for this scene
  // Ceiling at top of canvas
  const ceilingWorldX = 0;
  const ceilingWorldY = 2.5; // top in world (y increases upward in world)

  const [ceilSx, ceilSy] = cm.toScreen(ceilingWorldX, ceilingWorldY);

  // --- Ceiling ---
  roundRect(ctx, ceilSx - 80, ceilSy - 8, 160, 8, 3);
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Equilibrium position in world coords (below ceiling by natural length + x0)
  // We place equilibrium at a fixed visual position
  const eqWorldY = ceilingWorldY - 2.5; // equilibrium position in world
  const blockWorldY = eqWorldY - x; // current block position (x>0 means below eq, so lower worldY)

  // --- Spring from ceiling to block ---
  const blockHalfH = 0.25;  // world units (20px / 80 scale)
  const blockHalfW = 0.3125; // world units (25px / 80 scale)
  cm.drawSpring(ceilingWorldX, ceilingWorldY, ceilingWorldX, blockWorldY + blockHalfH, 10, 14);

  // --- Mass block ---
  cm.drawMetalBlock(ceilingWorldX, blockWorldY - blockHalfH, blockHalfW, blockHalfH);

  // mass label
  cm.drawText(`${m.toFixed(1)}kg`, ceilingWorldX, blockWorldY, { color: '#e2e8f0', bg: true });

  // --- Equilibrium dashed line ---
  const [eqSx, eqSy] = cm.toScreen(ceilingWorldX, eqWorldY);
  ctx.strokeStyle = 'rgba(74,222,128,0.5)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(eqSx - 120, eqSy);
  ctx.lineTo(eqSx + 120, eqSy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#4ade80';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`平衡位置 x\u2080 = mg/k = ${x0.toFixed(3)} m`, eqSx + 130, eqSy + 5);

  // --- 最高点 and 最低点 markers ---
  const highWorldY = eqWorldY + A; // highest point (A above equilibrium, higher worldY)
  const lowWorldY = eqWorldY - A;  // lowest point (A below equilibrium, lower worldY)
  const [, highSy] = cm.toScreen(0, highWorldY);
  const [, lowSy] = cm.toScreen(0, lowWorldY);

  // Highest point marker
  ctx.strokeStyle = 'rgba(251,191,36,0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(eqSx - 100, highSy);
  ctx.lineTo(eqSx + 100, highSy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Lowest point marker
  ctx.beginPath();
  ctx.setLineDash([3, 3]);
  ctx.moveTo(eqSx - 100, lowSy);
  ctx.lineTo(eqSx + 100, lowSy);
  ctx.stroke();
  ctx.setLineDash([]);

  // Labels for 最高点 / 最低点 with dynamic colors based on proximity
  const distToHigh = Math.abs(x + A); // x = -A at highest point
  const distToLow = Math.abs(x - A);  // x = +A at lowest point
  const distToEq = Math.abs(x);
  const threshold = A * 0.15;

  // 最高点 label
  const highColor = distToHigh < threshold ? '#fbbf24' : 'rgba(251,191,36,0.5)';
  ctx.fillStyle = highColor;
  ctx.font = distToHigh < threshold ? 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif' : '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('最高点', eqSx - 110, highSy + 4);
  if (distToHigh < threshold) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('a=max(向下), v=0', eqSx - 110, highSy + 18);
  }

  // 最低点 label
  const lowColor = distToLow < threshold ? '#f87171' : 'rgba(248,113,113,0.5)';
  ctx.fillStyle = lowColor;
  ctx.font = distToLow < threshold ? 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif' : '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('最低点', eqSx - 110, lowSy + 4);
  if (distToLow < threshold) {
    ctx.fillStyle = '#f87171';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('a=max(向上), v=0', eqSx - 110, lowSy + 18);
  }

  // Equilibrium annotation when near
  if (distToEq < threshold) {
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('v=max, a=0', eqSx + 130, eqSy + 20);
  }

  // --- Symmetry annotation (位移对称) ---
  // Draw double arrow showing symmetric displacement
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  const annoX = eqSx + 110;
  ctx.beginPath();
  ctx.moveTo(annoX, highSy);
  ctx.lineTo(annoX, lowSy);
  ctx.stroke();
  // Arrow heads
  ctx.beginPath();
  ctx.moveTo(annoX - 4, highSy + 6);
  ctx.lineTo(annoX, highSy);
  ctx.lineTo(annoX + 4, highSy + 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(annoX - 4, lowSy - 6);
  ctx.lineTo(annoX, lowSy);
  ctx.lineTo(annoX + 4, lowSy - 6);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('位移对称', annoX + 6, (highSy + lowSy) / 2 - 6);
  ctx.fillText('加速度对称', annoX + 6, (highSy + lowSy) / 2 + 8);

  // --- Displacement label ---
  if (Math.abs(x) > 0.01) {
    cm.drawText(`x = ${x.toFixed(3)} m`, ceilingWorldX, blockWorldY, { color: '#60a5fa', offsetX: 36, offsetY: -10, bg: true });
  }

  // --- Vectors ---
  if (showVectors) {
    const velScale = 0.3;
    const accScale = 0.02;

    // Velocity arrow (vertical, blue)
    if (Math.abs(v) > 0.01) {
      // v > 0 means moving downward (positive x direction), so arrow points down (negative worldY)
      arrows.draw(ceilingWorldX + 0.5, blockWorldY, 0, -v * velScale, {
        color: ARROW_COLORS.velocity,
        label: `v=${v.toFixed(2)}m/s`,
        labelOffset: 18,
      });
    }

    // Acceleration arrow (vertical, red)
    if (Math.abs(acc) > 0.01) {
      // acc > 0 means acceleration in positive x (downward), so arrow down
      arrows.draw(ceilingWorldX - 0.5, blockWorldY, 0, -acc * accScale, {
        color: ARROW_COLORS.acceleration,
        label: `a=${acc.toFixed(1)}m/s\u00b2`,
        labelOffset: -18,
      });
    }

    // Restoring force arrow (green)
    const F = -k * x;
    const fScale = 0.008;
    if (Math.abs(F) > 0.05) {
      arrows.draw(ceilingWorldX - 0.9, blockWorldY, 0, -F * fScale, {
        color: ARROW_COLORS.force,
        label: `F=${F.toFixed(1)}N`,
        labelOffset: -18,
      });
    }
  }

  // --- Info text ---
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  let iy = 24;
  ctx.fillText(`\u03c9 = \u221a(k/m) = ${omega.toFixed(2)} rad/s`, 16, iy); iy += 22;
  const T = (2 * Math.PI) / omega;
  ctx.fillText(`T = 2\u03c0/\u03c9 = ${T.toFixed(3)} s`, 16, iy); iy += 22;
  ctx.fillText(`x\u2080 = mg/k = ${x0.toFixed(3)} m`, 16, iy); iy += 22;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('关键: \u03c9 = \u221a(k/m) 与水平弹簧相同!', 16, iy);

  // Reset origin
  updateOrigin();
  cm.setScale(80);
}

// ---------------------------------------------------------------------------
// Render: Coupled Pendulums (多摆耦合)
// ---------------------------------------------------------------------------
function renderCoupledPendulumScene(
  t: number, state: HarmonicState, ctx: CanvasRenderingContext2D,
  m: number, L: number,
): void {
  const theta1 = state.x;
  const omega1 = state.v;
  const theta2 = state.x2;
  const omega2 = state.v2;
  const kc = panel.getValue<number>('couplingK');

  // Set up canvas: ceiling at top
  cm.setOrigin(cm.getWidth() / 2, 60);
  cm.setScale(80);
  cm.clear('#070b14');

  // Light grid
  grid.draw({ majorSpacing: 1, showLabels: false });

  // Pivots
  const pivot1WorldX = -1.5;
  const pivot2WorldX = 1.5;
  const pivotWorldY = 2.5;

  const [piv1Sx, piv1Sy] = cm.toScreen(pivot1WorldX, pivotWorldY);
  const [piv2Sx, piv2Sy] = cm.toScreen(pivot2WorldX, pivotWorldY);

  // --- Ceiling ---
  const ceilLeft = Math.min(piv1Sx, piv2Sx) - 40;
  const ceilRight = Math.max(piv1Sx, piv2Sx) + 40;
  roundRect(ctx, ceilLeft, piv1Sy - 8, ceilRight - ceilLeft, 8, 3);
  ctx.fillStyle = '#334155';
  ctx.fill();
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Bob positions
  const bob1WorldX = pivot1WorldX + L * Math.sin(theta1);
  const bob1WorldY = pivotWorldY - L * Math.cos(theta1);
  const bob2WorldX = pivot2WorldX + L * Math.sin(theta2);
  const bob2WorldY = pivotWorldY - L * Math.cos(theta2);

  const [bob1Sx, bob1Sy] = cm.toScreen(bob1WorldX, bob1WorldY);
  const [bob2Sx, bob2Sy] = cm.toScreen(bob2WorldX, bob2WorldY);

  // --- Strings ---
  cm.drawLine(pivot1WorldX, pivotWorldY, bob1WorldX, bob1WorldY, '#94a3b8', 2, false);
  cm.drawLine(pivot2WorldX, pivotWorldY, bob2WorldX, bob2WorldY, '#94a3b8', 2, false);

  // --- Coupling spring between bobs ---
  cm.drawSpring(bob1WorldX, bob1WorldY, bob2WorldX, bob2WorldY, 6, 8);

  // --- Bobs ---
  const bobRadius = Math.max(14, m * 10);

  // Bob 1 (blue)
  cm.drawBall(bob1WorldX, bob1WorldY, bobRadius, '#60a5fa', { label: 'm\u2081', glow: true });

  // Bob 2 (red)
  cm.drawBall(bob2WorldX, bob2WorldY, bobRadius, '#f87171', { label: 'm\u2082', glow: true });

  // --- Pivot labels ---
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('摆\u2460', piv1Sx, piv1Sy - 14);
  ctx.fillText('摆\u2461', piv2Sx, piv2Sy - 14);

  // --- Angle labels ---
  ctx.fillStyle = '#60a5fa';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(
    `\u03b8\u2081=${(theta1 * 180 / Math.PI).toFixed(1)}\u00b0`,
    bob1Sx - bobRadius - 8, bob1Sy - 8,
  );

  ctx.fillStyle = '#f87171';
  ctx.textAlign = 'left';
  ctx.fillText(
    `\u03b8\u2082=${(theta2 * 180 / Math.PI).toFixed(1)}\u00b0`,
    bob2Sx + bobRadius + 8, bob2Sy - 8,
  );

  // --- Normal mode info ---
  const omega_in = Math.sqrt(GRAVITY / L);
  const omega_anti = Math.sqrt(GRAVITY / L + 2 * kc / m);
  const T_beat = (2 * Math.PI) / Math.abs(omega_anti - omega_in);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '15px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  let iy = 24;
  ctx.fillText(`L = ${L.toFixed(1)} m,  m = ${m.toFixed(1)} kg,  k_c = ${kc.toFixed(1)} N/m`, 16, iy); iy += 22;
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`同相模式 \u03c9\u2081 = \u221a(g/L) = ${omega_in.toFixed(3)} rad/s`, 16, iy); iy += 22;
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`反相模式 \u03c9\u2082 = \u221a(g/L+2k_cL/m) = ${omega_anti.toFixed(3)} rad/s`, 16, iy); iy += 22;
  ctx.fillStyle = '#f87171';
  ctx.fillText(`拍频周期 T_beat = ${T_beat.toFixed(2)} s`, 16, iy); iy += 22;
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('能量在两摆之间周期性转移', 16, iy);

  // --- Energy bar indicators ---
  // KE1 = 0.5 * m * (L*omega1)^2, KE2 = 0.5 * m * (L*omega2)^2
  const KE1 = 0.5 * m * L * L * omega1 * omega1;
  const KE2 = 0.5 * m * L * L * omega2 * omega2;
  const PE1 = m * GRAVITY * L * (1 - Math.cos(theta1));
  const PE2 = m * GRAVITY * L * (1 - Math.cos(theta2));
  const E1 = KE1 + PE1;
  const E2 = KE2 + PE2;
  const Etotal = E1 + E2;

  if (Etotal > 1e-6) {
    const barX = cm.getWidth() - 100;
    const barY = 40;
    const barH = 120;
    const barW = 20;

    // Energy bar for pendulum 1
    const frac1 = E1 / Etotal;
    ctx.fillStyle = 'rgba(96,165,250,0.3)';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#60a5fa';
    ctx.fillRect(barX, barY + barH * (1 - frac1), barW, barH * frac1);
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);
    ctx.fillStyle = '#60a5fa';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('E\u2081', barX + barW / 2, barY - 6);
    ctx.fillText(`${(frac1 * 100).toFixed(0)}%`, barX + barW / 2, barY + barH + 14);

    // Energy bar for pendulum 2
    const frac2 = E2 / Etotal;
    const bar2X = barX + 35;
    ctx.fillStyle = 'rgba(248,113,113,0.3)';
    ctx.fillRect(bar2X, barY, barW, barH);
    ctx.fillStyle = '#f87171';
    ctx.fillRect(bar2X, barY + barH * (1 - frac2), barW, barH * frac2);
    ctx.strokeStyle = '#fca5a5';
    ctx.lineWidth = 1;
    ctx.strokeRect(bar2X, barY, barW, barH);
    ctx.fillStyle = '#f87171';
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('E\u2082', bar2X + barW / 2, barY - 6);
    ctx.fillText(`${(frac2 * 100).toFixed(0)}%`, bar2X + barW / 2, barY + barH + 14);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('能量', barX + barW + 7, barY - 20);
  }

  // Reset origin
  updateOrigin();
  cm.setScale(80);
}

// ---------------------------------------------------------------------------
// Measure numerical period from collected theta data
// ---------------------------------------------------------------------------
function measureNumericalPeriod(): number | null {
  // Find two consecutive positive-going zero crossings of theta
  if (thetaDegData.length < 20) return null;

  const crossings: number[] = [];
  for (let i = 1; i < thetaDegData.length; i++) {
    // positive-going zero crossing
    if (thetaDegData[i - 1] < 0 && thetaDegData[i] >= 0) {
      // linear interpolation for precise crossing time
      const frac = -thetaDegData[i - 1] / (thetaDegData[i] - thetaDegData[i - 1]);
      const tc = tData[i - 1] + frac * (tData[i] - tData[i - 1]);
      crossings.push(tc);
    }
  }

  if (crossings.length >= 2) {
    // Use the last two crossings for the most recent period
    return crossings[crossings.length - 1] - crossings[crossings.length - 2];
  }
  return null;
}

// ---------------------------------------------------------------------------
// SimLoop
// ---------------------------------------------------------------------------
const sim = new SimLoop<HarmonicState>({
  dt: 1 / 120,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: getInitialState(),
});

// ---------------------------------------------------------------------------
// Playback controls
// ---------------------------------------------------------------------------
const controls = new PlaybackControls(layout.controlBar);

controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => {
  clearGraphData();
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
  controls.setPlaying(false);
  updateSceneUI();
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

// ---------------------------------------------------------------------------
// Parameter change handler
// ---------------------------------------------------------------------------
panel.setOnChange((values) => {
  clearGraphData();
  updateSceneUI();
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
updateSceneUI();
renderScene(0, getInitialState());

// Auto-play on load
setTimeout(() => { sim.play(); controls.setPlaying(true); }, 100);

// Resize graphs on window resize
window.addEventListener('resize', () => {
  const xtW = xtCol.clientWidth;
  const vtW = vtCol.clientWidth;
  const atW = atCol.clientWidth;
  if (xtW > 0) graphXt.resize(xtW);
  if (vtW > 0) graphVt.resize(vtW);
  if (atW > 0) graphAt.resize(atW);

  const pendW = pendGraphCol.clientWidth;
  if (pendW > 0) graphTheta.resize(pendW);

  const vsXtW = vsXtCol.clientWidth;
  const vsVtW = vsVtCol.clientWidth;
  const vsAtW = vsAtCol.clientWidth;
  if (vsXtW > 0) graphVsXt.resize(vsXtW);
  if (vsVtW > 0) graphVsVt.resize(vsVtW);
  if (vsAtW > 0) graphVsAt.resize(vsAtW);

  const cpT1W = cpTheta1Col.clientWidth;
  const cpT2W = cpTheta2Col.clientWidth;
  if (cpT1W > 0) graphCpTheta1.resize(cpT1W);
  if (cpT2W > 0) graphCpTheta2.resize(cpT2W);
});

// ---------------------------------------------------------------------------
// Helpers: roundRect
// ---------------------------------------------------------------------------
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
