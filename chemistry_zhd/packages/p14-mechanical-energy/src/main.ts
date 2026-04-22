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
  GRAVITY,
  rk4Step,
} from '@physics/core';
import type { SimState, GraphTrace, DerivativeFunction } from '@physics/core';

// --- State ---
interface MechEnergyState extends SimState {
  y: number;
  vy: number;
  heatAccum: number;
}

type SceneType = '自由落体' | '斜面滑行' | '弹簧振子' | '单摆' | '定滑轮双物体' | '轻杆圆周';

// --- Setup ---
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-14 机械能守恒');

// Parameters with scene-based visibility
const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '自由落体',
    options: ['自由落体', '斜面滑行', '弹簧振子', '单摆', '定滑轮双物体', '轻杆圆周'] },
  { key: 'mass', label: '质量 m', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 1,
    scenes: ['自由落体', '斜面滑行', '弹簧振子', '单摆'] },
  { key: 'height', label: '初始高度 h₀', unit: 'm', min: 0.5, max: 8, step: 0.1, default: 5,
    scenes: ['自由落体', '斜面滑行', '弹簧振子', '单摆', '定滑轮双物体'] },
  { key: 'friction', label: '摩擦系数 μ', unit: '', min: 0, max: 0.5, step: 0.01, default: 0,
    scenes: ['斜面滑行', '定滑轮双物体'] },
  { key: 'angle', label: '斜面角度 θ', unit: '°', min: 10, max: 80, step: 1, default: 30,
    scenes: ['斜面滑行'] },
  { key: 'springK', label: '弹簧刚度 k', unit: 'N/m', min: 1, max: 100, step: 1, default: 20,
    scenes: ['弹簧振子'] },
  { key: 'pendulumL', label: '摆长 L', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 2,
    scenes: ['单摆'] },
  { key: 'm1', label: '质量 m₁', unit: 'kg', min: 0.5, max: 10, step: 0.1, default: 3,
    scenes: ['定滑轮双物体', '轻杆圆周'] },
  { key: 'm2', label: '质量 m₂', unit: 'kg', min: 0.1, max: 10, step: 0.1, default: 1,
    scenes: ['定滑轮双物体', '轻杆圆周'] },
  { key: 'rodHalfL', label: '杆半长 L', unit: 'm', min: 0.5, max: 3, step: 0.1, default: 1.5,
    scenes: ['轻杆圆周'] },
  { key: 'omega0', label: '初始角速度 ω₀', unit: 'rad/s', min: 0.5, max: 10, step: 0.1, default: 4,
    scenes: ['轻杆圆周'] },
  { key: 'showVectors', label: '显示矢量', type: 'checkbox', default: true },
  { key: 'showTrail', label: '显示轨迹', type: 'checkbox', default: true },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);

// Canvas - auto-sizing with HiDPI
const cm = new CanvasManager({ container: layout.canvas });
cm.setScale(50);

const arrows = new ArrowRenderer(cm);
const grid = new GridRenderer(cm);

// Energy bar
const energyBar = new EnergyBar(layout.bottomPanel, 220, 260);

// Graphs
const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer);

const graph = new SyncedGraph({
  container: graphContainer,
  title: '能量-时间',
  xLabel: 't (s)',
  yLabel: 'E (J)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

// Graph data
const timeData: number[] = [];
const keData: number[] = [];
const peData: number[] = [];
const totalData: number[] = [];
const heatData: number[] = [];
const ke1Data: number[] = [];
const ke2Data: number[] = [];
const pe1Data: number[] = [];
const pe2Data: number[] = [];

// Playback
const controls = new PlaybackControls(layout.controlBar);

// --- Physics ---
function getScene(): SceneType {
  return panel.getValue<string>('scene') as SceneType;
}

function createStepFn() {
  const scene = getScene();
  const mass = panel.getValue<number>('mass');
  const mu = panel.getValue<number>('friction');
  const angle = panel.getValue<number>('angle') * Math.PI / 180;
  const k = panel.getValue<number>('springK');
  const L = panel.getValue<number>('pendulumL');

  return (t: number, dt: number, state: MechEnergyState): MechEnergyState => {
    let { y, vy, heatAccum } = state;

    switch (scene) {
      case '自由落体': {
        const a = -GRAVITY;
        vy += a * dt;
        y += vy * dt;
        if (y <= 0) { y = 0; vy = 0; }
        break;
      }
      case '斜面滑行': {
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        let a = -GRAVITY * sinA;
        if (vy < -0.001) a += GRAVITY * mu * cosA;
        else if (vy > 0.001) a -= GRAVITY * mu * cosA;
        else {
          const gravComp = GRAVITY * sinA;
          const maxStaticF = mu * GRAVITY * cosA;
          if (gravComp > maxStaticF) {
            a = -GRAVITY * sinA + GRAVITY * mu * cosA;
          } else {
            a = 0;
          }
        }
        vy += a * dt;
        y += vy * dt;
        if (y <= 0) { y = 0; vy = 0; }
        break;
      }
      case '弹簧振子': {
        const eq = panel.getValue<number>('height') - (mass * GRAVITY) / k;
        const disp = y - eq;
        const a = -k * disp / mass;
        vy += a * dt;
        y += vy * dt;
        break;
      }
      case '单摆': {
        const theta = y;
        const omega = vy;
        const derivFn: DerivativeFunction = (_tt, s) => [s[1], -(GRAVITY / L) * Math.sin(s[0])];
        const next = rk4Step(derivFn, t, [theta, omega], dt);
        y = next[0];
        vy = next[1];
        break;
      }
      case '定滑轮双物体': {
        const m1 = panel.getValue<number>('m1');
        const m2 = panel.getValue<number>('m2');
        const totalMass = m1 + m2;
        let a = (m1 - m2) * GRAVITY / totalMass;
        if (mu > 0) {
          const T = 2 * m1 * m2 * GRAVITY / totalMass;
          const frictionForce = mu * T;
          if (vy > 0.001) a -= frictionForce / totalMass;
          else if (vy < -0.001) a += frictionForce / totalMass;
          else {
            const netForce = (m1 - m2) * GRAVITY;
            if (Math.abs(netForce) > frictionForce) {
              a = (netForce - Math.sign(netForce) * frictionForce) / totalMass;
            } else { a = 0; }
          }
        }
        const derivAtwood: DerivativeFunction = (_tt, s) => [s[1], a];
        const nextA = rk4Step(derivAtwood, t, [y, vy], dt);
        const newY = nextA[0];
        const newVy = nextA[1];
        if (mu > 0) {
          const ds = Math.abs(newY - y);
          const T = 2 * m1 * m2 * GRAVITY / totalMass;
          heatAccum += mu * T * ds;
        }
        y = newY;
        vy = newVy;
        const h0 = panel.getValue<number>('height');
        if (y >= h0) { y = h0; vy = 0; }
        if (y <= 0) { y = 0; if (vy < 0) vy = 0; }
        break;
      }
      case '轻杆圆周': {
        const m1 = panel.getValue<number>('m1');
        const m2 = panel.getValue<number>('m2');
        const rodL = panel.getValue<number>('rodHalfL');
        const derivRod: DerivativeFunction = (_tt, s) => {
          const theta = s[0];
          const alpha = -(m1 - m2) * GRAVITY * Math.cos(theta) / ((m1 + m2) * rodL);
          return [s[1], alpha];
        };
        const nextR = rk4Step(derivRod, t, [y, vy], dt);
        y = nextR[0];
        vy = nextR[1];
        break;
      }
    }

    return { y, vy, heatAccum };
  };
}

function getInitialState(): MechEnergyState {
  const scene = getScene();
  const h0 = panel.getValue<number>('height');

  if (scene === '单摆') {
    const L = panel.getValue<number>('pendulumL');
    const cosTheta = Math.max(-1, Math.min(1, 1 - h0 / L));
    const theta0 = Math.acos(cosTheta);
    return { y: theta0, vy: 0, heatAccum: 0 };
  }
  if (scene === '定滑轮双物体') {
    return { y: 0, vy: 0, heatAccum: 0 };
  }
  if (scene === '轻杆圆周') {
    const omega0 = panel.getValue<number>('omega0');
    return { y: 0, vy: omega0, heatAccum: 0 };
  }
  return { y: h0, vy: 0, heatAccum: 0 };
}

function computeEnergy(state: MechEnergyState): {
  ke: number; pe: number; total: number; heat: number;
  ke1?: number; ke2?: number; pe1?: number; pe2?: number;
} {
  const mass = panel.getValue<number>('mass');
  const scene = getScene();
  const h0 = panel.getValue<number>('height');
  const k = panel.getValue<number>('springK');
  const L = panel.getValue<number>('pendulumL');

  let ke: number, pe: number;
  let ke1: number | undefined, ke2: number | undefined;
  let pe1: number | undefined, pe2: number | undefined;

  switch (scene) {
    case '自由落体':
    case '斜面滑行':
      ke = 0.5 * mass * state.vy * state.vy;
      pe = mass * GRAVITY * state.y;
      break;
    case '弹簧振子': {
      ke = 0.5 * mass * state.vy * state.vy;
      const eq = h0 - (mass * GRAVITY) / k;
      const disp = state.y - eq;
      pe = 0.5 * k * disp * disp + mass * GRAVITY * state.y;
      break;
    }
    case '单摆': {
      const theta = state.y;
      const omega = state.vy;
      ke = 0.5 * mass * (L * omega) * (L * omega);
      pe = mass * GRAVITY * L * (1 - Math.cos(theta));
      break;
    }
    case '定滑轮双物体': {
      const m1 = panel.getValue<number>('m1');
      const m2 = panel.getValue<number>('m2');
      const v = state.vy;
      pe1 = m1 * GRAVITY * (h0 - state.y);
      pe2 = m2 * GRAVITY * state.y;
      ke1 = 0.5 * m1 * v * v;
      ke2 = 0.5 * m2 * v * v;
      ke = ke1 + ke2;
      pe = pe1 + pe2;
      break;
    }
    case '轻杆圆周': {
      const m1 = panel.getValue<number>('m1');
      const m2 = panel.getValue<number>('m2');
      const rodL = panel.getValue<number>('rodHalfL');
      const theta = state.y;
      const omega = state.vy;
      const v = rodL * Math.abs(omega);
      ke1 = 0.5 * m1 * v * v;
      ke2 = 0.5 * m2 * v * v;
      ke = ke1 + ke2;
      pe1 = m1 * GRAVITY * rodL * Math.sin(theta);
      pe2 = -m2 * GRAVITY * rodL * Math.sin(theta);
      pe = pe1 + pe2;
      break;
    }
    default:
      ke = 0; pe = 0;
  }

  const total = ke + pe;
  let heat: number;
  if (scene === '定滑轮双物体') {
    heat = state.heatAccum || 0;
  } else if (scene === '轻杆圆周') {
    heat = 0;
  } else {
    const initial = mass * GRAVITY * h0;
    heat = Math.max(0, initial - total);
  }

  return { ke, pe, total, heat, ke1, ke2, pe1, pe2 };
}

// Trail
const trail: { x: number; y: number }[] = [];

// --- Interaction ---
// Allow dragging the ball to set initial height/position
cm.setMouseHandlers({
  onDown: (wx, wy, drag) => {
    if (drag.target && sim.isPlaying()) {
      sim.pause();
      controls.setPlaying(false);
    }
  },
  onMove: (wx, wy, drag) => {
    if (!drag.dragging || !drag.target) return;
    const scene = getScene();
    if (scene === '自由落体' && drag.target === 'ball') {
      const newH = Math.max(0.5, Math.min(8, wy));
      panel.setValue('height', Math.round(newH * 10) / 10);
      clearGraphData();
      trail.length = 0;
      sim.reset(getInitialState());
      sim.updateStepFn(createStepFn());
    }
    if (scene === '单摆' && drag.target === 'bob') {
      const L = panel.getValue<number>('pendulumL');
      const h0 = panel.getValue<number>('height');
      const pivotY = h0 + 1;
      const dx = wx;
      const dy = pivotY - wy;
      const theta = Math.atan2(dx, dy);
      const clampTheta = Math.max(-Math.PI * 0.8, Math.min(Math.PI * 0.8, theta));
      const height = L * (1 - Math.cos(clampTheta));
      panel.setValue('height', Math.round(height * 10) / 10);
      clearGraphData();
      trail.length = 0;
      sim.reset(getInitialState());
      sim.updateStepFn(createStepFn());
    }
  },
});

// --- Render ---
function updateOrigin(): void {
  const w = cm.getWidth();
  const h = cm.getHeight();
  cm.setOrigin(w / 2, h * 0.82);
}

function renderScene(t: number, state: MechEnergyState): void {
  const scene = getScene();
  const mass = panel.getValue<number>('mass');
  const showVectors = panel.getValue<boolean>('showVectors');
  const showTrail = panel.getValue<boolean>('showTrail');
  const h0 = panel.getValue<number>('height');
  const angle = panel.getValue<number>('angle') * Math.PI / 180;
  const k = panel.getValue<number>('springK');
  const L = panel.getValue<number>('pendulumL');

  updateOrigin();
  cm.clear('#070b14');
  grid.draw({ majorSpacing: 1, showLabels: true, labelUnit: 'm' });

  const ctx = cm.ctx;
  cm.clearHitTargets();

  switch (scene) {
    case '自由落体': {
      const radius = Math.max(14, mass * 10);

      // Trail
      if (showTrail && t > 0) {
        trail.push({ x: 0, y: state.y });
        if (trail.length > 300) trail.shift();
        ctx.save();
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.2)';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < trail.length; i++) {
          const [tx, ty] = cm.toScreen(trail[i].x, trail[i].y);
          if (i === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Ground
      cm.drawTexturedGround(-5, 5, 0, 'concrete');

      // Ball
      cm.drawBall(0, state.y, radius, '#60a5fa', { label: 'm' });
      cm.registerHitTarget('ball', 0, state.y, state.y > 0.3 ? 0.5 : 0);

      // Height dashed line
      if (state.y > 0.05) {
        cm.drawLine(-0.6, state.y, -0.6, 0, 'rgba(255,255,255,0.15)', 1, true);
        cm.drawText(`h = ${state.y.toFixed(2)} m`, 0, state.y,
          { offsetX: radius + 12, color: '#94d4fa', font: 'bold 13px -apple-system, sans-serif', bg: true });
      }
      cm.drawText(`v = ${Math.abs(state.vy).toFixed(2)} m/s`, 0, state.y,
        { offsetX: radius + 12, offsetY: 20, color: '#94d4fa', font: '12px -apple-system, sans-serif', bg: true });

      // Vectors
      if (showVectors) {
        if (state.y > 0) {
          arrows.draw(0, state.y, 0, -GRAVITY * mass * 0.02, {
            color: ARROW_COLORS.force, label: `G=${(mass * GRAVITY).toFixed(1)}N`,
          });
        }
        if (Math.abs(state.vy) > 0.01) {
          arrows.draw(0, state.y, 0, state.vy * 0.1, {
            color: ARROW_COLORS.velocity, label: 'v', labelOffset: -22,
          });
        }
      }
      break;
    }

    case '斜面滑行': {
      const rampLen = h0 / Math.sin(angle) + 1;

      // Ramp surface
      cm.drawIncline(0, 0, rampLen, angle, 'concrete');

      // Ground
      cm.drawTexturedGround(-1, rampLen + 1, 0, 'concrete');

      // Ball on slope
      const s = state.y / Math.sin(angle);
      const bxW = s * Math.cos(angle);
      const byW = state.y;
      const radius = Math.max(14, mass * 10);
      cm.drawBall(bxW, byW, radius, '#60a5fa', { label: 'm' });

      cm.drawText(`h = ${state.y.toFixed(2)} m`, bxW, byW,
        { offsetX: radius + 12, color: '#94d4fa', bg: true });
      break;
    }

    case '弹簧振子': {
      const eq = h0 - (mass * GRAVITY) / k;
      const anchorY = h0 + 1;
      const [ax, ay] = cm.toScreen(0, anchorY);

      // Anchor
      ctx.save();
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      roundRect(ctx, ax - 35, ay - 6, 70, 12, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Spring
      cm.drawSpring(0, anchorY, 0, state.y, 16, 0.28, '#fbbf24');

      // Ball
      const radius = Math.max(14, mass * 10);
      cm.drawBall(0, state.y, radius, '#60a5fa', { label: 'm' });

      // Equilibrium line
      cm.drawLine(-2, eq, 2, eq, 'rgba(255,255,255,0.15)', 1, true);
      cm.drawText('平衡', -2, eq, { offsetX: -30, color: '#64748b', font: '11px -apple-system, sans-serif' });

      cm.drawText(`y = ${state.y.toFixed(2)} m`, 0, state.y,
        { offsetX: radius + 12, color: '#94d4fa', bg: true });
      break;
    }

    case '单摆': {
      const theta = state.y;
      const pivotX = 0;
      const pivotY = h0 + 1;
      const [px, py] = cm.toScreen(pivotX, pivotY);

      // Pivot
      ctx.save();
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1;
      roundRect(ctx, px - 24, py - 5, 48, 10, 4);
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Bob position
      const bobWX = pivotX + L * Math.sin(theta);
      const bobWY = pivotY - L * Math.cos(theta);

      // String
      cm.drawLine(pivotX, pivotY, bobWX, bobWY, '#64748b', 2);

      // Bob
      const radius = Math.max(16, mass * 10);
      cm.drawBall(bobWX, bobWY, radius, '#60a5fa', { label: 'm' });
      cm.registerHitTarget('bob', bobWX, bobWY, 0.4);

      // Angle arc
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      const arcR = 35;
      ctx.beginPath();
      const startAngle = Math.PI / 2;
      const endAngle = Math.PI / 2 - theta;
      ctx.arc(px, py, arcR, Math.min(startAngle, endAngle), Math.max(startAngle, endAngle));
      ctx.stroke();
      ctx.restore();

      // Info
      const height = L * (1 - Math.cos(theta));
      cm.drawText(`θ = ${(theta * 180 / Math.PI).toFixed(1)}°`, bobWX, bobWY,
        { offsetX: radius + 12, color: '#94d4fa', bg: true });
      cm.drawText(`h = ${height.toFixed(2)} m`, bobWX, bobWY,
        { offsetX: radius + 12, offsetY: 18, color: '#7dd3fc', font: '12px -apple-system, sans-serif', bg: true });

      // Vertical reference (dashed)
      cm.drawLine(pivotX, pivotY, pivotX, pivotY - L, 'rgba(255,255,255,0.08)', 1, true);
      break;
    }

    case '定滑轮双物体': {
      const m1 = panel.getValue<number>('m1');
      const m2 = panel.getValue<number>('m2');
      const disp = state.y;
      const v = state.vy;
      const totalMass = m1 + m2;

      const pulleyX = 0;
      const pulleyY = h0 + 2;
      const pulleyR = 0.35;
      const [ppx, ppy] = cm.toScreen(pulleyX, pulleyY);

      // Support
      ctx.save();
      ctx.fillStyle = '#334155';
      roundRect(ctx, ppx - 40, ppy - 14, 80, 10, 4);
      ctx.fill();
      ctx.restore();

      // Pulley wheel
      cm.drawPulley(pulleyX, pulleyY, pulleyR);

      // Masses
      const m1Y = h0 - disp;
      const m2Y = disp;
      const leftX = -1.8;
      const rightX = 1.8;

      // Strings (ropes)
      cm.drawRope(leftX, pulleyY - pulleyR * 0.3, leftX, m1Y);
      cm.drawRope(rightX, pulleyY - pulleyR * 0.3, rightX, m2Y);

      // m1 ball
      const r1 = Math.max(16, m1 * 6);
      cm.drawBall(leftX, m1Y, r1, '#f87171', { label: 'm₁' });

      // m2 ball
      const r2 = Math.max(14, m2 * 6);
      cm.drawBall(rightX, m2Y, r2, '#60a5fa', { label: 'm₂' });

      // Ground
      cm.drawTexturedGround(-4, 4, 0, 'concrete');

      // Velocity arrows
      if (showVectors && Math.abs(v) > 0.01) {
        arrows.draw(leftX, m1Y, 0, -v * 0.15, {
          color: ARROW_COLORS.velocity, label: 'v₁', labelOffset: -25,
        });
        arrows.draw(rightX, m2Y, 0, v * 0.15, {
          color: ARROW_COLORS.velocity, label: 'v₂', labelOffset: -25,
        });
      }

      // Info panel
      const accel = (m1 - m2) * GRAVITY / totalMass;
      const T = 2 * m1 * m2 * GRAVITY / totalMass;
      const infoWX = 3.5;
      const infoWY = h0 + 1;
      cm.drawText(`a = ${accel.toFixed(2)} m/s²`, infoWX, infoWY,
        { color: '#94a3b8', font: '13px -apple-system, sans-serif' });
      cm.drawText(`T = ${T.toFixed(2)} N`, infoWX, infoWY,
        { offsetY: 18, color: '#94a3b8', font: '13px -apple-system, sans-serif' });
      cm.drawText(`v = ${Math.abs(v).toFixed(2)} m/s`, infoWX, infoWY,
        { offsetY: 36, color: '#7dd3fc', font: '13px -apple-system, sans-serif' });
      break;
    }

    case '轻杆圆周': {
      const m1 = panel.getValue<number>('m1');
      const m2 = panel.getValue<number>('m2');
      const rodL = panel.getValue<number>('rodHalfL');
      const theta = state.y;
      const omega = state.vy;

      const pivotWX = 0;
      const pivotWY = rodL + 1;
      const [pvx, pvy] = cm.toScreen(pivotWX, pivotWY);

      // Pivot
      ctx.save();
      ctx.fillStyle = '#334155';
      roundRect(ctx, pvx - 20, pvy - 5, 40, 10, 4);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(pvx, pvy, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#94a3b8';
      ctx.fill();
      ctx.restore();

      // Ball positions
      const b1WX = pivotWX + rodL * Math.cos(theta);
      const b1WY = pivotWY + rodL * Math.sin(theta);
      const b2WX = pivotWX - rodL * Math.cos(theta);
      const b2WY = pivotWY - rodL * Math.sin(theta);

      // Trail
      if (showTrail) {
        trail.push({ x: b1WX, y: b1WY });
        if (trail.length > 300) trail.shift();
        ctx.save();
        ctx.strokeStyle = 'rgba(248, 113, 113, 0.15)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < trail.length; i++) {
          const [tx, ty] = cm.toScreen(trail[i].x, trail[i].y);
          if (i === 0) ctx.moveTo(tx, ty);
          else ctx.lineTo(tx, ty);
        }
        ctx.stroke();
        ctx.restore();
      }

      // Circular guide
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.setLineDash([3, 5]);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(pvx, pvy, rodL * cm.getScale(), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Rod
      ctx.save();
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#a78bfa';
      ctx.shadowBlur = 6;
      const [b1x, b1y] = cm.toScreen(b1WX, b1WY);
      const [b2x, b2y] = cm.toScreen(b2WX, b2WY);
      ctx.beginPath();
      ctx.moveTo(b1x, b1y);
      ctx.lineTo(b2x, b2y);
      ctx.stroke();
      ctx.restore();

      // Balls
      const r1 = Math.max(14, m1 * 6);
      const r2 = Math.max(12, m2 * 6);
      cm.drawBall(b1WX, b1WY, r1, '#f87171', { label: 'm₁' });
      cm.drawBall(b2WX, b2WY, r2, '#60a5fa', { label: 'm₂' });

      // Velocity arrows
      if (showVectors && Math.abs(omega) > 0.01) {
        const vMag = rodL * omega;
        arrows.draw(b1WX, b1WY, -Math.sin(theta) * vMag * 0.12, Math.cos(theta) * vMag * 0.12, {
          color: ARROW_COLORS.velocity, label: 'v₁', labelOffset: -20,
        });
        arrows.draw(b2WX, b2WY, Math.sin(theta) * vMag * 0.12, -Math.cos(theta) * vMag * 0.12, {
          color: ARROW_COLORS.velocity, label: 'v₂', labelOffset: -20,
        });
      }

      // Rod force info
      const centripetal1 = m1 * omega * omega * rodL;
      const weightRadial1 = m1 * GRAVITY * Math.sin(theta);
      const rodForce = centripetal1 - weightRadial1;
      const forceLabel = rodForce >= 0 ? '拉力' : '压力';
      const forceColor = rodForce >= 0 ? '#4ade80' : '#fb923c';

      const infoWX2 = rodL + 1;
      const infoWY2 = pivotWY + 0.5;
      cm.drawText(`ω = ${omega.toFixed(2)} rad/s`, infoWX2, infoWY2,
        { color: '#94a3b8', font: '13px -apple-system, sans-serif' });
      cm.drawText(`v = ${(rodL * Math.abs(omega)).toFixed(2)} m/s`, infoWX2, infoWY2,
        { offsetY: 18, color: '#7dd3fc', font: '13px -apple-system, sans-serif' });
      cm.drawText(`杆: ${forceLabel} ${Math.abs(rodForce).toFixed(1)} N`, infoWX2, infoWY2,
        { offsetY: 36, color: forceColor, font: 'bold 13px -apple-system, sans-serif' });

      if (Math.sin(theta) > 0.8 && rodForce < 0) {
        cm.drawText('杆在压缩 (绳无法实现!)', infoWX2, infoWY2,
          { offsetY: 54, color: '#fbbf24', font: 'bold 12px -apple-system, sans-serif' });
      }
      break;
    }
  }

  // --- Energy bar ---
  const energy = computeEnergy(state);
  const isMultiBody = scene === '定滑轮双物体' || scene === '轻杆圆周';
  const maxE = (() => {
    if (scene === '弹簧振子') {
      const eq = h0 - (mass * GRAVITY) / k;
      return (0.5 * k * (h0 - eq) * (h0 - eq) + mass * GRAVITY * h0) * 1.2;
    }
    if (scene === '定滑轮双物体') {
      const m1 = panel.getValue<number>('m1');
      const m2 = panel.getValue<number>('m2');
      return (m1 * GRAVITY * h0 + m2 * GRAVITY * h0) * 1.2;
    }
    if (scene === '轻杆圆周') {
      const m1 = panel.getValue<number>('m1');
      const m2 = panel.getValue<number>('m2');
      const rodL = panel.getValue<number>('rodHalfL');
      const omega0 = panel.getValue<number>('omega0');
      return (0.5 * (m1 + m2) * (rodL * omega0) ** 2 + (m1 + m2) * GRAVITY * rodL) * 1.5;
    }
    return mass * GRAVITY * h0 * 1.2;
  })();

  let bars: { label: string; value: number; color: string }[];
  if (isMultiBody) {
    bars = [
      { label: 'Ep₁', value: energy.pe1 ?? 0, color: '#60a5fa' },
      { label: 'Ep₂', value: energy.pe2 ?? 0, color: '#38bdf8' },
      { label: 'Ek₁', value: energy.ke1 ?? 0, color: '#f87171' },
      { label: 'Ek₂', value: energy.ke2 ?? 0, color: '#fb923c' },
      { label: '总能 E', value: energy.total, color: '#94a3b8' },
    ];
    if (energy.heat > 0.01) bars.push({ label: '热量 Q', value: energy.heat, color: '#fbbf24' });
  } else {
    bars = [
      { label: '动能 Ek', value: energy.ke, color: '#f87171' },
      { label: '势能 Ep', value: energy.pe, color: '#60a5fa' },
      { label: '总能 E', value: energy.total, color: '#94a3b8' },
    ];
    if (energy.heat > 0.01) bars.push({ label: '热量 Q', value: energy.heat, color: '#fbbf24' });
  }
  energyBar.draw(bars, maxE, '能量柱状图');

  // --- Graph data ---
  timeData.push(t);
  keData.push(energy.ke);
  peData.push(energy.pe);
  totalData.push(energy.total);
  heatData.push(energy.heat);
  ke1Data.push(energy.ke1 ?? 0);
  ke2Data.push(energy.ke2 ?? 0);
  pe1Data.push(energy.pe1 ?? 0);
  pe2Data.push(energy.pe2 ?? 0);

  const max = 500;
  if (timeData.length > max) {
    const trim = timeData.length - max;
    timeData.splice(0, trim);
    keData.splice(0, trim);
    peData.splice(0, trim);
    totalData.splice(0, trim);
    heatData.splice(0, trim);
    ke1Data.splice(0, trim);
    ke2Data.splice(0, trim);
    pe1Data.splice(0, trim);
    pe2Data.splice(0, trim);
  }

  let traces: GraphTrace[];
  if (isMultiBody) {
    traces = [
      { x: timeData, y: ke1Data, name: 'Ek₁', color: '#f87171' },
      { x: timeData, y: ke2Data, name: 'Ek₂', color: '#fb923c' },
      { x: timeData, y: pe1Data, name: 'Ep₁', color: '#60a5fa' },
      { x: timeData, y: pe2Data, name: 'Ep₂', color: '#38bdf8' },
      { x: timeData, y: totalData, name: '总机械能', color: '#94a3b8' },
    ];
    if (heatData.some(v => v > 0.01)) {
      traces.push({ x: timeData, y: heatData, name: '摩擦热', color: '#fbbf24' });
    }
  } else {
    traces = [
      { x: timeData, y: keData, name: '动能 Ek', color: '#f87171' },
      { x: timeData, y: peData, name: '势能 Ep', color: '#60a5fa' },
      { x: timeData, y: totalData, name: '总机械能', color: '#94a3b8' },
    ];
    if (heatData.some(v => v > 0.01)) {
      traces.push({ x: timeData, y: heatData, name: '摩擦热', color: '#fbbf24' });
    }
  }

  graph.setTraces(traces);
  graph.updateCurrentTime(t);
  graph.render();
  controls.updateTime(t);
}

// --- SimLoop ---
const sim = new SimLoop<MechEnergyState>({
  dt: 1 / 60,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: getInitialState(),
});

// Wire controls
controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => {
  clearGraphData();
  trail.length = 0;
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
  trail.length = 0;
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
});

function clearGraphData(): void {
  timeData.length = 0;
  keData.length = 0;
  peData.length = 0;
  totalData.length = 0;
  heatData.length = 0;
  ke1Data.length = 0;
  ke2Data.length = 0;
  pe1Data.length = 0;
  pe2Data.length = 0;
}

// Initial render
renderScene(0, getInitialState());

// Auto-play on load
setTimeout(() => { sim.play(); controls.setPlaying(true); }, 100);

// Resize graph on window resize
window.addEventListener('resize', () => {
  const w = graphContainer.clientWidth;
  if (w > 0) graph.resize(w);
});

// Helper
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
