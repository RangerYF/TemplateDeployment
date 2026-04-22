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
  EnergyBar,
  SyncedGraph,
} from '@physics/core';
import type { SimState, GraphTrace } from '@physics/core';

// =============================================================================
// State
// =============================================================================

/**
 * Unified state for both scenes.
 * SimState requires all values to be numbers.
 *
 * 1D Collision:
 *   x1, x2       - positions of ball 1 and ball 2
 *   v1, v2       - velocities
 *   collided     - 0 or 1 flag (have they collided yet?)
 *
 * Person-Boat:
 *   xPerson      - person position on screen (world coords)
 *   xBoat        - boat center position
 *   vPerson      - person velocity
 *   vBoat        - boat velocity
 *   personLocal  - person position relative to boat left end
 *   walking      - 0 or 1 flag (is person still walking?)
 */
interface MomentumState extends SimState {
  x1: number;
  x2: number;
  v1: number;
  v2: number;
  collided: number;
  xPerson: number;
  xBoat: number;
  vPerson: number;
  vBoat: number;
  personLocal: number;
  walking: number;
}

// =============================================================================
// Scene type
// =============================================================================
type SceneType = '一维碰撞' | '人船模型';

// =============================================================================
// Layout
// =============================================================================
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-12 动量守恒');

// =============================================================================
// Parameters
// =============================================================================
const paramDefs = defineParams([
  {
    key: 'scene',
    label: '场景',
    type: 'select',
    default: '一维碰撞',
    options: ['一维碰撞', '人船模型'],
    scenes: ['一维碰撞', '人船模型'],
  },
  // -- 1D collision params --
  { key: 'm1', label: '物体1质量 m₁', unit: 'kg', min: 0.5, max: 10, step: 0.5, default: 2, scenes: ['一维碰撞'] },
  { key: 'm2', label: '物体2质量 m₂', unit: 'kg', min: 0.5, max: 10, step: 0.5, default: 3, scenes: ['一维碰撞'] },
  { key: 'v1i', label: '物体1初速度 v₁', unit: 'm/s', min: -5, max: 5, step: 0.1, default: 3, scenes: ['一维碰撞'] },
  { key: 'v2i', label: '物体2初速度 v₂', unit: 'm/s', min: -5, max: 5, step: 0.1, default: -1, scenes: ['一维碰撞'] },
  {
    key: 'restitution',
    label: '恢复系数 e',
    unit: '',
    min: 0,
    max: 1,
    step: 0.05,
    default: 1,
    scenes: ['一维碰撞'],
  },
  // -- Person-boat params --
  { key: 'mPerson', label: '人的质量', unit: 'kg', min: 30, max: 100, step: 5, default: 60, scenes: ['人船模型'] },
  { key: 'mBoat', label: '船的质量', unit: 'kg', min: 50, max: 500, step: 10, default: 200, scenes: ['人船模型'] },
  { key: 'boatLength', label: '船长', unit: 'm', min: 2, max: 8, step: 0.5, default: 4, scenes: ['人船模型'] },
  { key: 'walkSpeed', label: '人对船行走速度', unit: 'm/s', min: 0.5, max: 3, step: 0.1, default: 1.0, scenes: ['人船模型'] },
  // -- Shared --
  { key: 'showVectors', label: '显示动量矢量', type: 'checkbox', default: true, scenes: ['一维碰撞', '人船模型'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);

// =============================================================================
// Canvas
// =============================================================================
const cm = new CanvasManager({ container: layout.canvas });
function updateOrigin(): void {
  cm.setOrigin(cm.getWidth() / 2, cm.getHeight() * 0.64);
}
updateOrigin();
cm.setScale(60);

const arrows = new ArrowRenderer(cm);
const grid = new GridRenderer(cm);

// =============================================================================
// Momentum bar (reuse EnergyBar for momentum display)
// =============================================================================
const momentumBar = new EnergyBar(layout.bottomPanel, 240, 260);

// =============================================================================
// Graphs
// =============================================================================
const graphWrapper = document.createElement('div');
graphWrapper.style.flex = '1';
graphWrapper.style.display = 'flex';
graphWrapper.style.flexDirection = 'column';
graphWrapper.style.gap = '4px';
layout.bottomPanel.appendChild(graphWrapper);

const vtGraphContainer = document.createElement('div');
vtGraphContainer.style.flex = '1';
graphWrapper.appendChild(vtGraphContainer);

const ptGraphContainer = document.createElement('div');
ptGraphContainer.style.flex = '1';
graphWrapper.appendChild(ptGraphContainer);

let vtGraph: SyncedGraph;
let ptGraph: SyncedGraph;

// We create these after appending to DOM so clientWidth is available
setTimeout(() => {
  vtGraph = new SyncedGraph({
    container: vtGraphContainer,
    title: '速度-时间 (v-t)',
    xLabel: 't (s)',
    yLabel: 'v (m/s)',
    height: 125,
    onTimeClick: (t) => sim.jumpTo(t),
  });

  ptGraph = new SyncedGraph({
    container: ptGraphContainer,
    title: '动量-时间 (p-t)',
    xLabel: 't (s)',
    yLabel: 'p (kg·m/s)',
    height: 125,
    onTimeClick: (t) => sim.jumpTo(t),
  });

  // Initial render after graphs exist
  renderScene(0, getInitialState());
}, 0);

// Graph data arrays
const timeData: number[] = [];
const v1Data: number[] = [];
const v2Data: number[] = [];
const p1Data: number[] = [];
const p2Data: number[] = [];
const pTotalData: number[] = [];

// =============================================================================
// Playback Controls
// =============================================================================
const controls = new PlaybackControls(layout.controlBar);

// =============================================================================
// Helpers
// =============================================================================
function getScene(): SceneType {
  return panel.getValue<string>('scene') as SceneType;
}

function getInitialState(): MomentumState {
  const scene = getScene();

  if (scene === '一维碰撞') {
    const v1i = panel.getValue<number>('v1i');
    const v2i = panel.getValue<number>('v2i');
    // Start balls separated so they approach each other
    // Place them so they meet near center at some time
    const separation = 4; // world units apart
    return {
      x1: -separation / 2,
      x2: separation / 2,
      v1: v1i,
      v2: v2i,
      collided: 0,
      xPerson: 0,
      xBoat: 0,
      vPerson: 0,
      vBoat: 0,
      personLocal: 0,
      walking: 0,
    };
  } else {
    // Person-boat: person starts at left end of boat, boat at origin
    return {
      x1: 0,
      x2: 0,
      v1: 0,
      v2: 0,
      collided: 0,
      xPerson: 0,
      xBoat: 0,
      vPerson: 0,
      vBoat: 0,
      personLocal: 0, // person at left end of boat (relative offset from boat left)
      walking: 1,
    };
  }
}

// =============================================================================
// Physics step function
// =============================================================================
function createStepFn() {
  const scene = getScene();
  const m1 = panel.getValue<number>('m1');
  const m2 = panel.getValue<number>('m2');
  const v1i = panel.getValue<number>('v1i');
  const v2i = panel.getValue<number>('v2i');
  const e = panel.getValue<number>('restitution');
  const mPerson = panel.getValue<number>('mPerson');
  const mBoat = panel.getValue<number>('mBoat');
  const boatLen = panel.getValue<number>('boatLength');
  const walkSpd = panel.getValue<number>('walkSpeed');

  // Pre-compute post-collision velocities for 1D collision
  const v1f = ((m1 - e * m2) * v1i + (1 + e) * m2 * v2i) / (m1 + m2);
  const v2f = ((m2 - e * m1) * v2i + (1 + e) * m1 * v1i) / (m1 + m2);

  // Ball radii in world units (for collision detection)
  const r1 = 0.15 + m1 * 0.03;
  const r2 = 0.15 + m2 * 0.03;

  return (_t: number, dt: number, state: MomentumState): MomentumState => {
    const s = { ...state };

    if (scene === '一维碰撞') {
      // Check collision: balls overlap
      if (s.collided === 0) {
        // Move with initial velocities
        s.x1 += s.v1 * dt;
        s.x2 += s.v2 * dt;

        // Collision detection: absolute distance between centers <= sum of radii
        const dist = Math.abs(s.x2 - s.x1);
        if (dist <= r1 + r2) {
          // Collision! Apply analytic formulas
          s.v1 = v1f;
          s.v2 = v2f;
          s.collided = 1;

          // For completely inelastic (e=0), balls stick together
          if (e === 0) {
            // Place them touching
            const cx = (s.x1 * m1 + s.x2 * m2) / (m1 + m2);
            s.x1 = cx - r1;
            s.x2 = cx + r2;
          }
        }
      } else {
        // Post-collision motion
        if (e === 0) {
          // Completely inelastic: move together
          const vCommon = (m1 * v1i + m2 * v2i) / (m1 + m2);
          s.x1 += vCommon * dt;
          s.x2 += vCommon * dt;
          // Keep them touching at correct separation
          s.x2 = s.x1 + r1 + r2;
        } else {
          s.x1 += s.v1 * dt;
          s.x2 += s.v2 * dt;
        }
      }
    } else {
      // Person-boat model
      // Person walks along boat with speed walkSpd relative to boat
      // System momentum = 0 (starts from rest)
      // mPerson * vPerson + mBoat * vBoat = 0
      // vPerson_relative_to_boat = walkSpd (to the right)
      // vPerson = vBoat + walkSpd
      // mPerson * (vBoat + walkSpd) + mBoat * vBoat = 0
      // vBoat = -mPerson * walkSpd / (mPerson + mBoat)
      // vPerson = mBoat * walkSpd / (mPerson + mBoat)

      if (s.walking === 1) {
        const vBoatCalc = -mPerson * walkSpd / (mPerson + mBoat);
        const vPersonCalc = mBoat * walkSpd / (mPerson + mBoat);

        s.vBoat = vBoatCalc;
        s.vPerson = vPersonCalc;

        s.xBoat += s.vBoat * dt;
        s.xPerson += s.vPerson * dt;
        s.personLocal += walkSpd * dt;

        // Stop when person reaches right end of boat
        if (s.personLocal >= boatLen) {
          s.personLocal = boatLen;
          s.walking = 0;
          s.vBoat = 0;
          s.vPerson = 0;
        }
      }
      // When walking = 0, everything stays still (momentum already conserved, both at rest)
    }

    return s;
  };
}

// =============================================================================
// Rendering
// =============================================================================
function renderScene(t: number, state: MomentumState): void {
  const scene = getScene();
  const showVectors = panel.getValue<boolean>('showVectors');
  const ctx = cm.ctx;

  updateOrigin();
  cm.clear('#070b14');
  grid.draw({ majorSpacing: 1, showLabels: true, labelUnit: 'm' });

  if (scene === '一维碰撞') {
    renderCollision(t, state, ctx, showVectors);
  } else {
    renderPersonBoat(t, state, ctx, showVectors);
  }

  // Update graphs
  recordGraphData(t, state);
  renderGraphs(t);

  // Update momentum bar
  renderMomentumBar(state);

  controls.updateTime(t);
}

function renderCollision(
  _t: number,
  state: MomentumState,
  ctx: CanvasRenderingContext2D,
  showVectors: boolean,
): void {
  const m1 = panel.getValue<number>('m1');
  const m2 = panel.getValue<number>('m2');

  const r1 = 0.15 + m1 * 0.03;
  const r2 = 0.15 + m2 * 0.03;
  const r1px = r1 * cm.getScale();
  const r2px = r2 * cm.getScale();

  // Ground line
  cm.drawTexturedGround(-7, 7, 0, 'concrete');

  // Ball 1 (blue)
  cm.drawBall(state.x1, r1, r1px, '#60a5fa', { label: `m₁=${m1}kg`, glow: true });

  // Ball 2 (red/orange)
  cm.drawBall(state.x2, r2, r2px, '#fb923c', { label: `m₂=${m2}kg`, glow: true });

  // Velocity labels below balls
  cm.drawText(`v₁=${state.v1.toFixed(2)} m/s`, state.x1, r1, { color: '#94a3b8', offsetX: 0, offsetY: r1px + 36, bg: true });
  cm.drawText(`v₂=${state.v2.toFixed(2)} m/s`, state.x2, r2, { color: '#94a3b8', offsetX: 0, offsetY: r2px + 36, bg: true });

  // Momentum arrows above balls (purple)
  if (showVectors) {
    const p1 = m1 * state.v1;
    const p2 = m2 * state.v2;
    const momentumScale = 0.015; // scale factor for display

    if (Math.abs(p1) > 0.01) {
      arrows.draw(state.x1, r1 * 2 + 0.6, p1 * momentumScale, 0, {
        color: ARROW_COLORS.momentum,
        label: `p₁=${p1.toFixed(1)}`,
        labelOffset: -18,
      });
    }

    if (Math.abs(p2) > 0.01) {
      arrows.draw(state.x2, r2 * 2 + 0.6, p2 * momentumScale, 0, {
        color: ARROW_COLORS.momentum,
        label: `p₂=${p2.toFixed(1)}`,
        labelOffset: -18,
      });
    }

    // Velocity arrows (blue)
    const vScale = 0.08;
    if (Math.abs(state.v1) > 0.01) {
      arrows.draw(state.x1, r1, state.v1 * vScale, 0, {
        color: ARROW_COLORS.velocity,
        label: 'v₁',
        labelOffset: 16,
      });
    }
    if (Math.abs(state.v2) > 0.01) {
      arrows.draw(state.x2, r2, state.v2 * vScale, 0, {
        color: ARROW_COLORS.velocity,
        label: 'v₂',
        labelOffset: 16,
      });
    }
  }

  // Total system momentum text in top-right
  const pTotal = m1 * state.v1 + m2 * state.v2;
  ctx.fillStyle = '#c084fc';
  ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`系统总动量 p = ${pTotal.toFixed(2)} kg·m/s`, cm.getWidth() - 20, 30);

  // Kinetic energy comparison
  const Ek = 0.5 * m1 * state.v1 ** 2 + 0.5 * m2 * state.v2 ** 2;
  const v1i = panel.getValue<number>('v1i');
  const v2i = panel.getValue<number>('v2i');
  const Ek0 = 0.5 * m1 * v1i ** 2 + 0.5 * m2 * v2i ** 2;
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`Ek = ${Ek.toFixed(2)} J (初始 ${Ek0.toFixed(2)} J)`, cm.getWidth() - 20, 52);

  // Collision event indicator and energy info
  const eCoeff = panel.getValue<number>('restitution');
  if (state.collided === 1) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    const loss = Ek0 - Ek;
    ctx.fillText(`已碰撞 (e=${eCoeff})`, cm.getWidth() - 20, 72);
    if (loss > 0.001) {
      ctx.fillStyle = '#f87171';
      ctx.fillText(`动能损失 ΔEk = ${loss.toFixed(2)} J (${(loss / Ek0 * 100).toFixed(1)}%)`, cm.getWidth() - 20, 92);
    } else {
      ctx.fillStyle = '#4ade80';
      ctx.fillText('动能守恒 (完全弹性碰撞)', cm.getWidth() - 20, 92);
    }
  }
}

function renderPersonBoat(
  _t: number,
  state: MomentumState,
  ctx: CanvasRenderingContext2D,
  showVectors: boolean,
): void {
  const mPerson = panel.getValue<number>('mPerson');
  const mBoat = panel.getValue<number>('mBoat');
  const boatLen = panel.getValue<number>('boatLength');

  // Water surface
  cm.drawWater(-8, 8, -0.3, -1.5, _t);

  // Boat - rectangle
  const boatHeight = 0.4;
  const boatLeft = state.xBoat - boatLen / 2;
  const [blx, bly] = cm.toScreen(boatLeft, boatHeight);
  const [brx, bry] = cm.toScreen(boatLeft + boatLen, 0);
  const boatW = brx - blx;
  const boatH = bry - bly;

  // Boat body
  ctx.fillStyle = '#8b5e3c';
  ctx.strokeStyle = '#a0522d';
  ctx.lineWidth = 2;
  ctx.beginPath();
  // Slightly tapered boat shape
  const [bl, bt] = cm.toScreen(boatLeft, boatHeight);
  const [br, _] = cm.toScreen(boatLeft + boatLen, boatHeight);
  const [bbl, bbt] = cm.toScreen(boatLeft + 0.2, 0);
  const [bbr, bbr2] = cm.toScreen(boatLeft + boatLen - 0.2, 0);
  ctx.moveTo(bl, bt);
  ctx.lineTo(br, bt);
  ctx.lineTo(bbr, bbr2);
  ctx.lineTo(bbl, bbt);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Boat label
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  const [bcx, bcy] = cm.toScreen(state.xBoat, boatHeight / 2);
  ctx.fillText(`船 M=${mBoat}kg`, bcx, bcy + 4);

  // Person - stick figure on boat
  const personWorldX = boatLeft + state.personLocal;
  const personBaseY = boatHeight;
  const [px, py] = cm.toScreen(personWorldX, personBaseY);

  // Body
  const headR = 8;
  const bodyH = 30;
  const legH = 20;

  // Legs
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px, py - bodyH);
  ctx.lineTo(px - 8, py);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(px, py - bodyH);
  ctx.lineTo(px + 8, py);
  ctx.stroke();

  // Body
  ctx.beginPath();
  ctx.moveTo(px, py - bodyH);
  ctx.lineTo(px, py - bodyH - bodyH);
  ctx.stroke();

  // Arms
  ctx.beginPath();
  ctx.moveTo(px - 12, py - bodyH - 10);
  ctx.lineTo(px, py - bodyH - 20);
  ctx.lineTo(px + 12, py - bodyH - 10);
  ctx.stroke();

  // Head
  ctx.beginPath();
  ctx.arc(px, py - bodyH - bodyH - headR, headR, 0, Math.PI * 2);
  ctx.fillStyle = '#60a5fa';
  ctx.fill();

  // Person label
  ctx.fillStyle = '#e2e8f0';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`人 m=${mPerson}kg`, px, py - bodyH - bodyH - headR - 14);

  // Center of mass marker
  const xCM = (mPerson * state.xPerson + mBoat * state.xBoat) / (mPerson + mBoat);
  const [cmx, cmy] = cm.toScreen(xCM, boatHeight + 0.8);
  ctx.fillStyle = '#fbbf24';
  ctx.beginPath();
  ctx.moveTo(cmx, cmy + 10);
  ctx.lineTo(cmx - 6, cmy);
  ctx.lineTo(cmx + 6, cmy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('质心', cmx, cmy - 6);

  // Momentum arrows
  if (showVectors) {
    const pPerson = mPerson * state.vPerson;
    const pBoat = mBoat * state.vBoat;
    const momentumScale = 0.003;

    if (Math.abs(pPerson) > 0.1) {
      arrows.draw(personWorldX, personBaseY + 1.8, pPerson * momentumScale, 0, {
        color: ARROW_COLORS.momentum,
        label: `p人=${pPerson.toFixed(1)}`,
        labelOffset: -18,
      });
    }

    if (Math.abs(pBoat) > 0.1) {
      arrows.draw(state.xBoat, -0.1, pBoat * momentumScale, 0, {
        color: ARROW_COLORS.momentum,
        label: `p船=${pBoat.toFixed(1)}`,
        labelOffset: 18,
      });
    }
  }

  // Displacement annotations
  if (Math.abs(state.xBoat) > 0.001 || Math.abs(state.xPerson) > 0.001) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(
      `船位移: ${state.xBoat.toFixed(3)} m`,
      20,
      30,
    );
    ctx.fillText(
      `人位移: ${state.xPerson.toFixed(3)} m`,
      20,
      50,
    );
    ctx.fillText(
      `m人·Δx人 + m船·Δx船 = ${(mPerson * state.xPerson + mBoat * state.xBoat).toFixed(4)}`,
      20,
      70,
    );
    ctx.fillStyle = '#4ade80';
    ctx.fillText(
      `质心位移: ${xCM.toFixed(4)} m (不变)`,
      20,
      90,
    );
  }

  // Status
  if (state.walking === 0) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('人已到达船尾', cm.getWidth() - 20, 30);
  }
}

// =============================================================================
// Momentum bar display
// =============================================================================
function renderMomentumBar(state: MomentumState): void {
  const scene = getScene();

  if (scene === '一维碰撞') {
    const m1 = panel.getValue<number>('m1');
    const m2 = panel.getValue<number>('m2');
    const p1 = m1 * state.v1;
    const p2 = m2 * state.v2;
    const pTotal = p1 + p2;

    // For bar display, use absolute values but indicate sign
    const maxP = Math.max(Math.abs(p1), Math.abs(p2), Math.abs(pTotal), 1) * 1.3;

    // Use the energy bar component - showing absolute momentum
    // Since EnergyBar displays positive values, we show |p| with sign labels
    momentumBar.draw(
      [
        { label: `p₁ ${p1 >= 0 ? '→' : '←'}`, value: Math.abs(p1), color: '#60a5fa' },
        { label: `p₂ ${p2 >= 0 ? '→' : '←'}`, value: Math.abs(p2), color: '#fb923c' },
        { label: `p总 ${pTotal >= 0 ? '→' : '←'}`, value: Math.abs(pTotal), color: '#c084fc' },
      ],
      maxP,
      '动量 (kg·m/s)',
    );
  } else {
    const mPerson = panel.getValue<number>('mPerson');
    const mBoat = panel.getValue<number>('mBoat');
    const pP = mPerson * state.vPerson;
    const pB = mBoat * state.vBoat;
    const pTotal = pP + pB;

    const maxP = Math.max(Math.abs(pP), Math.abs(pB), 1) * 1.3;

    momentumBar.draw(
      [
        { label: `p人 ${pP >= 0 ? '→' : '←'}`, value: Math.abs(pP), color: '#60a5fa' },
        { label: `p船 ${pB >= 0 ? '→' : '←'}`, value: Math.abs(pB), color: '#8b5e3c' },
        { label: `p总`, value: Math.abs(pTotal), color: '#c084fc' },
      ],
      maxP,
      '动量 (kg·m/s)',
    );
  }
}

// =============================================================================
// Graph data recording
// =============================================================================
function recordGraphData(t: number, state: MomentumState): void {
  const scene = getScene();

  if (scene === '一维碰撞') {
    const m1 = panel.getValue<number>('m1');
    const m2 = panel.getValue<number>('m2');

    timeData.push(t);
    v1Data.push(state.v1);
    v2Data.push(state.v2);
    p1Data.push(m1 * state.v1);
    p2Data.push(m2 * state.v2);
    pTotalData.push(m1 * state.v1 + m2 * state.v2);
  } else {
    const mPerson = panel.getValue<number>('mPerson');
    const mBoat = panel.getValue<number>('mBoat');

    timeData.push(t);
    v1Data.push(state.vPerson);
    v2Data.push(state.vBoat);
    p1Data.push(mPerson * state.vPerson);
    p2Data.push(mBoat * state.vBoat);
    pTotalData.push(mPerson * state.vPerson + mBoat * state.vBoat);
  }

  // Trim
  const max = 500;
  if (timeData.length > max) {
    timeData.splice(0, timeData.length - max);
    v1Data.splice(0, v1Data.length - max);
    v2Data.splice(0, v2Data.length - max);
    p1Data.splice(0, p1Data.length - max);
    p2Data.splice(0, p2Data.length - max);
    pTotalData.splice(0, pTotalData.length - max);
  }
}

function renderGraphs(t: number): void {
  if (!vtGraph || !ptGraph) return;

  const scene = getScene();

  if (scene === '一维碰撞') {
    vtGraph.setTraces([
      { x: timeData, y: v1Data, name: 'v₁', color: '#60a5fa' },
      { x: timeData, y: v2Data, name: 'v₂', color: '#fb923c' },
    ]);

    ptGraph.setTraces([
      { x: timeData, y: p1Data, name: 'p₁', color: '#60a5fa' },
      { x: timeData, y: p2Data, name: 'p₂', color: '#fb923c' },
      { x: timeData, y: pTotalData, name: 'p总', color: '#c084fc' },
    ]);
  } else {
    vtGraph.setTraces([
      { x: timeData, y: v1Data, name: 'v人', color: '#60a5fa' },
      { x: timeData, y: v2Data, name: 'v船', color: '#8b5e3c' },
    ]);

    ptGraph.setTraces([
      { x: timeData, y: p1Data, name: 'p人', color: '#60a5fa' },
      { x: timeData, y: p2Data, name: 'p船', color: '#8b5e3c' },
      { x: timeData, y: pTotalData, name: 'p总', color: '#c084fc' },
    ]);
  }

  vtGraph.updateCurrentTime(t);
  ptGraph.updateCurrentTime(t);
  vtGraph.render();
  ptGraph.render();
}

// =============================================================================
// Clear graph data
// =============================================================================
function clearGraphData(): void {
  timeData.length = 0;
  v1Data.length = 0;
  v2Data.length = 0;
  p1Data.length = 0;
  p2Data.length = 0;
  pTotalData.length = 0;
}

// =============================================================================
// SimLoop
// =============================================================================
const sim = new SimLoop<MomentumState>({
  dt: 1 / 60,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: getInitialState(),
});

// =============================================================================
// Wire controls
// =============================================================================
controls.onPlay = () => {
  sim.play();
  controls.setPlaying(true);
};
controls.onPause = () => {
  sim.pause();
  controls.setPlaying(false);
};
controls.onReset = () => {
  clearGraphData();
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
  controls.setPlaying(false);
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

// Parameter changes reset simulation
panel.setOnChange(() => {
  clearGraphData();
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
});

// Initial render
renderScene(0, getInitialState());

// Auto-play on load
setTimeout(() => { sim.play(); controls.setPlaying(true); }, 100);

// Resize graphs on window resize
window.addEventListener('resize', () => {
  updateOrigin();
  const w = graphWrapper.clientWidth;
  if (w > 0 && vtGraph && ptGraph) {
    vtGraph.resize(w);
    ptGraph.resize(w);
  }
});

// =============================================================================
// roundRect helper
// =============================================================================
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
