import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, defineParams, PlaybackControls,
  SimLoop, CanvasManager, SyncedGraph, GRAVITY,
} from '@physics/core';
import type { SimState, GraphTrace } from '@physics/core';

interface CelestialState extends SimState {
  x: number; y: number; vx: number; vy: number;
  x2: number; y2: number; vx2: number; vy2: number;
  t: number;
  // Pursuit scene: angular positions (radians)
  theta1: number; theta2: number;
  // Pursuit rendezvous flash timer
  flashTimer: number;
  // Kepler T^2/a^3 tracking
  orbitStartT: number; crossCount: number; lastY: number;
  measuredT: number; measuredA: number;
}

const G_CONST = 6.674e-11;
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-09 天体运动');

const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '椭圆轨道',
    options: ['椭圆轨道', '霍曼转移', '双星系统', '面积定律', '三宇宙速度', '天体追及'] },
  { key: 'centralMass', label: '中心天体质量 M', unit: '×10³⁰kg', min: 0.5, max: 5, step: 0.1, default: 2,
    scenes: ['椭圆轨道', '霍曼转移', '双星系统', '面积定律'] },
  { key: 'orbiterMass', label: '卫星质量 m', unit: '×10²⁴kg', min: 0.1, max: 10, step: 0.1, default: 1,
    scenes: ['双星系统'] },
  { key: 'initR', label: '初始距离 r₀', unit: 'AU', min: 0.5, max: 5, step: 0.1, default: 1,
    scenes: ['椭圆轨道', '霍曼转移', '双星系统', '面积定律'] },
  { key: 'initV', label: '初始速度 v₀', unit: 'v_circ', min: 0.5, max: 1.5, step: 0.01, default: 1.0,
    scenes: ['椭圆轨道', '霍曼转移', '双星系统', '面积定律'] },
  { key: 'eccentricity', label: '偏心率 e', unit: '', min: 0, max: 0.9, step: 0.01, default: 0.3,
    scenes: ['椭圆轨道', '面积定律'] },
  { key: 'showTrail', label: '显示轨迹', type: 'checkbox', default: true,
    scenes: ['椭圆轨道', '霍曼转移', '双星系统', '面积定律', '三宇宙速度'] },
  { key: 'showAreaSweep', label: '显示面积扫过', type: 'checkbox', default: false,
    scenes: ['面积定律'] },
  // Cosmic velocity scene params
  { key: 'launchV', label: '发射速度', unit: 'v₁', min: 0.5, max: 2.2, step: 0.01, default: 1.0,
    scenes: ['三宇宙速度'] },
  // Pursuit scene params
  { key: 'pursuitR1', label: '内轨半径 r₁', unit: 'AU', min: 0.5, max: 2, step: 0.1, default: 1.0,
    scenes: ['天体追及'] },
  { key: 'pursuitR2', label: '外轨半径 r₂', unit: 'AU', min: 1.5, max: 4, step: 0.1, default: 2.0,
    scenes: ['天体追及'] },
  { key: 'pursuitDTheta', label: '初始角间距 Δθ₀', unit: '°', min: 10, max: 180, step: 5, default: 60,
    scenes: ['天体追及'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });

function updateOrigin(): void {
  cm.setOrigin(cm.getWidth() / 2, cm.getHeight() / 2);
}
updateOrigin();
cm.setScale(80);

const controls = new PlaybackControls(layout.controlBar);

const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer);
const graph = new SyncedGraph({
  container: graphContainer, title: '轨道参数', xLabel: 't', yLabel: 'r', height: 260,
});

const trail: { x: number; y: number }[] = [];
const trail2: { x: number; y: number }[] = [];
const timeData: number[] = [];
const rData: number[] = [];
const thetaData: number[] = [];
const dthetaData: number[] = [];
const areaSegments: { x1: number; y1: number; x2: number; y2: number; t: number }[] = [];

// Kepler T^2/a^3 verification data
const keplerTable: { T: number; a: number; ratio: number }[] = [];

// Scaled units: 1 unit = 1 AU, G*M scaled so circular velocity = 1 at r=1
function getGM(): number {
  return 1; // normalized: v_circ = sqrt(GM/r) = 1 at r=1
}

function defaultState(): CelestialState {
  return {
    x: 1, y: 0, vx: 0, vy: 1,
    x2: 0, y2: 0, vx2: 0, vy2: 0,
    t: 0,
    theta1: 0, theta2: 0, flashTimer: 0,
    orbitStartT: 0, crossCount: 0, lastY: 0,
    measuredT: 0, measuredA: 0,
  };
}

function getInitialState(): CelestialState {
  const scene = getScene();
  const r0 = panel.getValue<number>('initR');
  const vFrac = panel.getValue<number>('initV');
  const vCirc = Math.sqrt(getGM() / r0);
  const v0 = vCirc * vFrac;

  if (scene === '双星系统') {
    const M = panel.getValue<number>('centralMass');
    const m_orb = panel.getValue<number>('orbiterMass');
    const mr = m_orb / (M + m_orb); // mass fraction of orbiter
    const d = r0;
    return {
      ...defaultState(),
      x: d * mr, y: 0, vx: 0, vy: v0 * mr,
      x2: -d * (1 - mr), y2: 0, vx2: 0, vy2: -v0 * (1 - mr),
    };
  }

  if (scene === '霍曼转移') {
    return { ...defaultState(), x: r0, y: 0, vx: 0, vy: vCirc };
  }

  if (scene === '三宇宙速度') {
    const R = 1.0; // planet radius in normalized units
    const v1 = Math.sqrt(getGM() / R);
    const launchFrac = panel.getValue<number>('launchV');
    const vLaunch = v1 * launchFrac;
    // Launch tangentially from planet surface (top of planet)
    return { ...defaultState(), x: R, y: 0, vx: 0, vy: vLaunch };
  }

  if (scene === '天体追及') {
    const r1 = panel.getValue<number>('pursuitR1');
    const r2 = panel.getValue<number>('pursuitR2');
    const dTheta = panel.getValue<number>('pursuitDTheta') * Math.PI / 180;
    return {
      ...defaultState(),
      theta1: 0,
      theta2: dTheta, // outer satellite starts ahead by dTheta
      x: r1, y: 0,       // inner satellite position (for graph reference)
      x2: r2 * Math.cos(dTheta), y2: r2 * Math.sin(dTheta),
    };
  }

  // Default: elliptical orbit / area law
  return { ...defaultState(), x: r0, y: 0, vx: 0, vy: v0, lastY: 0 };
}

function getScene() { return panel.getValue<string>('scene'); }

let hohmannBoosted = false;

function createStepFn() {
  hohmannBoosted = false;
  let prevVr = 0; // track previous radial velocity for apoapsis detection
  return (_t: number, dt: number, state: CelestialState): CelestialState => {
    const scene = getScene();
    let { x, y, vx, vy, x2, y2, vx2, vy2, t,
          theta1, theta2, flashTimer,
          orbitStartT, crossCount, lastY, measuredT, measuredA } = state;
    const GM = getGM();

    if (scene === '天体追及') {
      // Analytical circular orbits — no integration needed
      const r1 = panel.getValue<number>('pursuitR1');
      const r2 = panel.getValue<number>('pursuitR2');
      const omega1 = Math.sqrt(GM / (r1 * r1 * r1));
      const omega2 = Math.sqrt(GM / (r2 * r2 * r2));

      const prevTheta1 = theta1;
      const prevTheta2 = theta2;
      theta1 += omega1 * dt;
      theta2 += omega2 * dt;

      // Detect rendezvous: angular difference mod 2pi crosses 0
      const prevDiff = ((prevTheta1 - prevTheta2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      const currDiff = ((theta1 - theta2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
      if (prevDiff > Math.PI && currDiff < Math.PI && t > 0.5) {
        flashTimer = 1.0; // trigger flash
      }
      if (flashTimer > 0) flashTimer -= dt * 2;

      // Store positions for rendering
      x = r1 * Math.cos(theta1); y = r1 * Math.sin(theta1);
      x2 = r2 * Math.cos(theta2); y2 = r2 * Math.sin(theta2);

      return { x, y, vx, vy, x2, y2, vx2, vy2, t: t + dt,
               theta1, theta2, flashTimer,
               orbitStartT, crossCount, lastY, measuredT, measuredA };
    }

    if (scene === '双星系统') {
      // Two-body with Velocity Verlet
      const M = panel.getValue<number>('centralMass');
      const m_orb = panel.getValue<number>('orbiterMass');
      const mr = m_orb / (M + m_orb);

      const dx = x2 - x, dy = y2 - y;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r > 0.01) {
        const F = GM / (r * r);
        const fx = F * dx / r, fy = F * dy / r;

        vx += fx * mr * dt * 0.5; vy += fy * mr * dt * 0.5;
        vx2 -= fx * (1 - mr) * dt * 0.5; vy2 -= fy * (1 - mr) * dt * 0.5;

        x += vx * dt; y += vy * dt;
        x2 += vx2 * dt; y2 += vy2 * dt;

        const dx_new = x2 - x, dy_new = y2 - y;
        const r_new = Math.sqrt(dx_new * dx_new + dy_new * dy_new);
        const F_new = GM / (r_new * r_new);
        const fx_new = F_new * dx_new / r_new, fy_new = F_new * dy_new / r_new;

        vx += fx_new * mr * dt * 0.5; vy += fy_new * mr * dt * 0.5;
        vx2 -= fx_new * (1 - mr) * dt * 0.5; vy2 -= fy_new * (1 - mr) * dt * 0.5;
      } else {
        x += vx * dt; y += vy * dt;
        x2 += vx2 * dt; y2 += vy2 * dt;
      }
    } else if (scene === '三宇宙速度') {
      // Central body at origin — Velocity Verlet, with collision detection
      const R_planet = 1.0;
      const r = Math.sqrt(x * x + y * y);
      if (r > 0.05) {
        const a = -GM / (r * r * r);
        const ax_old = a * x;
        const ay_old = a * y;

        vx += ax_old * dt * 0.5;
        vy += ay_old * dt * 0.5;

        x += vx * dt;
        y += vy * dt;

        const r_new = Math.sqrt(x * x + y * y);
        // Stop if crashed into planet
        if (r_new < R_planet * 0.95) {
          // Clamp to planet surface
          const scale = R_planet * 0.95 / r_new;
          x *= scale; y *= scale;
          vx = 0; vy = 0;
        } else {
          const a_new = -GM / (r_new * r_new * r_new);
          vx += a_new * x * dt * 0.5;
          vy += a_new * y * dt * 0.5;
        }
      }
    } else {
      // Central body at origin — Velocity Verlet (elliptical, Hohmann, area law)
      const r = Math.sqrt(x * x + y * y);
      if (r > 0.01) {
        const a = -GM / (r * r * r);
        const ax_old = a * x;
        const ay_old = a * y;

        vx += ax_old * dt * 0.5;
        vy += ay_old * dt * 0.5;

        x += vx * dt;
        y += vy * dt;

        const r_new = Math.sqrt(x * x + y * y);
        const a_new = -GM / (r_new * r_new * r_new);

        vx += a_new * x * dt * 0.5;
        vy += a_new * y * dt * 0.5;
      } else {
        x += vx * dt;
        y += vy * dt;
      }

      // Hohmann: boost at apoapsis
      if (scene === '霍曼转移' && !hohmannBoosted) {
        const rCur = Math.sqrt(x * x + y * y);
        const vr = (x * vx + y * vy) / rCur;
        if (prevVr > 0 && vr <= 0 && t > 0.5) {
          const vCircTarget = Math.sqrt(GM / rCur);
          const currentSpeed = Math.sqrt(vx * vx + vy * vy);
          const boost = vCircTarget / currentSpeed;
          vx *= boost; vy *= boost;
          hohmannBoosted = true;
        }
        prevVr = vr;
      }

      // Kepler T^2/a^3 verification for elliptical orbit
      if (scene === '椭圆轨道') {
        // Detect y=0 upward crossing (complete orbit = two consecutive upward crossings)
        if (lastY < 0 && y >= 0 && t > 0.1) {
          crossCount++;
          if (crossCount === 1) {
            orbitStartT = t;
          } else if (crossCount >= 2) {
            // crossCount 1→2 is one full orbit
            measuredT = t - orbitStartT;
            // Compute semi-major axis from vis-viva: 1/a = 2/r - v^2/GM
            const rCur = Math.sqrt(x * x + y * y);
            const v2 = vx * vx + vy * vy;
            const oneOverA = 2 / rCur - v2 / GM;
            if (oneOverA > 0) {
              measuredA = 1 / oneOverA;
            }
            // Slide window: keep measuring
            orbitStartT = t;
            crossCount = 1;
          }
        }
        lastY = y;
      }
    }

    return { x, y, vx, vy, x2, y2, vx2, vy2, t: t + dt,
             theta1, theta2, flashTimer,
             orbitStartT, crossCount, lastY, measuredT, measuredA };
  };
}

function renderScene(t: number, state: CelestialState): void {
  const scene = getScene();
  const showTrail = panel.getValue<boolean>('showTrail');
  const showArea = panel.getValue<boolean>('showAreaSweep');

  updateOrigin();
  cm.clear('#070b14');
  const ctx = cm.ctx;

  // Stars background
  for (let i = 0; i < 60; i++) {
    const sx = ((i * 137.5) % cm.getWidth());
    const sy = ((i * 97.3 + i * i * 0.7) % cm.getHeight());
    ctx.fillStyle = `rgba(255,255,255,${0.2 + (i % 5) * 0.1})`;
    ctx.fillRect(sx, sy, 1.5, 1.5);
  }

  if (scene === '三宇宙速度') {
    renderCosmicVelocities(ctx, state);
  } else if (scene === '天体追及') {
    renderPursuit(ctx, state);
  } else if (scene === '双星系统') {
    // Trail for both bodies
    trail.push({ x: state.x, y: state.y });
    trail2.push({ x: state.x2, y: state.y2 });
    if (trail.length > 1000) trail.shift();
    if (trail2.length > 1000) trail2.shift();

    if (showTrail) {
      ctx.shadowColor = 'rgba(96,165,250,0.4)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(96,165,250,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const [sx, sy] = cm.toScreen(trail[i].x, trail[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;

      ctx.shadowColor = 'rgba(248,113,113,0.4)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(248,113,113,0.4)';
      ctx.beginPath();
      for (let i = 0; i < trail2.length; i++) {
        const [sx, sy] = cm.toScreen(trail2[i].x, trail2[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Body 1
    const [bx1, by1] = cm.toScreen(state.x, state.y);
    cm.drawBall(bx1, by1, 12, '#60a5fa', { glow: true });
    // Body 2
    const [bx2, by2] = cm.toScreen(state.x2, state.y2);
    cm.drawBall(bx2, by2, 10, '#f87171', { glow: true });

    // Center of mass (mass-weighted)
    const M = panel.getValue<number>('centralMass');
    const m_orb = panel.getValue<number>('orbiterMass');
    const cmx = (M * state.x + m_orb * state.x2) / (M + m_orb);
    const cmy = (M * state.y + m_orb * state.y2) / (M + m_orb);
    const [cmsx, cmsy] = cm.toScreen(cmx, cmy);
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cmsx - 6, cmsy); ctx.lineTo(cmsx + 6, cmsy);
    ctx.moveTo(cmsx, cmsy - 6); ctx.lineTo(cmsx, cmsy + 6);
    ctx.stroke();
  } else {
    // Central body
    const [cx, cy] = cm.toScreen(0, 0);
    cm.drawBall(cx, cy, 18, '#fbbf24', { glow: true });

    // Trail
    trail.push({ x: state.x, y: state.y });
    if (trail.length > 2000) trail.shift();

    if (showTrail) {
      ctx.shadowColor = 'rgba(96,165,250,0.4)';
      ctx.shadowBlur = 6;
      ctx.strokeStyle = 'rgba(96,165,250,0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (let i = 0; i < trail.length; i++) {
        const [sx, sy] = cm.toScreen(trail[i].x, trail[i].y);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    // Area sweep (Kepler's second law)
    if (showArea && scene === '面积定律') {
      if (trail.length > 1) {
        const prev = trail[trail.length - 2];
        areaSegments.push({
          x1: prev.x, y1: prev.y,
          x2: state.x, y2: state.y,
          t: state.t,
        });
        if (areaSegments.length > 500) areaSegments.shift();
      }

      const interval = 30;
      ctx.globalAlpha = 0.3;
      const sectorLabels: { sx: number; sy: number; area: number; color: string }[] = [];
      for (let i = 0; i < areaSegments.length; i += interval) {
        const seg = areaSegments[i];
        const [sx1, sy1] = cm.toScreen(seg.x1, seg.y1);
        const [sx2, sy2] = cm.toScreen(seg.x2, seg.y2);
        const colorIdx = Math.floor(i / interval) % 4;
        const colors = ['#60a5fa', '#4ade80', '#fbbf24', '#f87171'];
        ctx.fillStyle = colors[colorIdx];
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.closePath();
        ctx.fill();
        const triArea = 0.5 * Math.abs(seg.x1 * seg.y2 - seg.x2 * seg.y1);
        sectorLabels.push({ sx: (sx1 + sx2 + cx) / 3, sy: (sy1 + sy2 + cy) / 3, area: triArea, color: colors[colorIdx] });
      }
      ctx.globalAlpha = 1;
      for (let i = 0; i < sectorLabels.length; i += 3) {
        const s = sectorLabels[i];
        ctx.fillStyle = s.color;
        ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`A=${s.area.toFixed(4)}`, s.sx, s.sy);
      }
    }

    // Orbiter
    const [ox, oy] = cm.toScreen(state.x, state.y);
    cm.drawBall(ox, oy, 8, '#60a5fa', { glow: true });

    // Radius line
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ox, oy); ctx.stroke();
    ctx.setLineDash([]);

    // Info
    const r = Math.sqrt(state.x ** 2 + state.y ** 2);
    const v = Math.sqrt(state.vx ** 2 + state.vy ** 2);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`r = ${r.toFixed(3)} AU`, 20, 30);
    ctx.fillText(`v = ${v.toFixed(3)}`, 20, 50);
    if (scene === '霍曼转移') {
      ctx.fillText(hohmannBoosted ? '已变轨 (圆化)' : '等待远拱点变轨...', 20, 70);
    }

    // Kepler T^2/a^3 verification display for elliptical orbit
    if (scene === '椭圆轨道' && state.measuredT > 0 && state.measuredA > 0) {
      const T = state.measuredT;
      const a = state.measuredA;
      const ratio = (T * T) / (a * a * a);
      const theoretical = 4 * Math.PI * Math.PI / getGM();

      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText('--- 开普勒第三定律验证 ---', 20, 90);
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`T = ${T.toFixed(3)}`, 20, 110);
      ctx.fillText(`a = ${a.toFixed(3)} AU`, 20, 128);
      ctx.fillText(`T\u00B2/a\u00B3 = ${ratio.toFixed(4)}`, 20, 146);
      ctx.fillText(`4\u03C0\u00B2/(GM) = ${theoretical.toFixed(4)}`, 20, 164);

      // Comparison table header
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText('T\u00B2/a\u00B3 = 4\u03C0\u00B2/(GM) = const', 20, 186);

      // Show small comparison if we have multiple orbits measured
      // (Update kepler table)
      if (keplerTable.length === 0 || Math.abs(keplerTable[keplerTable.length - 1].T - T) > 0.01) {
        if (keplerTable.length >= 5) keplerTable.shift();
        keplerTable.push({ T, a, ratio });
      }
      if (keplerTable.length > 1) {
        ctx.font = '11px monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('  T       a      T\u00B2/a\u00B3', 20, 204);
        for (let i = 0; i < keplerTable.length; i++) {
          const row = keplerTable[i];
          ctx.fillText(
            `  ${row.T.toFixed(2)}    ${row.a.toFixed(2)}    ${row.ratio.toFixed(4)}`,
            20, 218 + i * 14,
          );
        }
      }
    }
  }

  // Graph
  if (scene === '天体追及') {
    const r1 = panel.getValue<number>('pursuitR1');
    const r2 = panel.getValue<number>('pursuitR2');
    const omega1 = Math.sqrt(getGM() / (r1 * r1 * r1));
    const omega2 = Math.sqrt(getGM() / (r2 * r2 * r2));
    const dTheta = ((state.theta1 - state.theta2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
    timeData.push(state.t);
    dthetaData.push(dTheta * 180 / Math.PI);
    if (timeData.length > 500) {
      timeData.splice(0, timeData.length - 500);
      dthetaData.splice(0, dthetaData.length - 500);
    }
    graph.setTraces([
      { x: timeData, y: dthetaData, name: 'Δθ(t) [°]', color: '#4ade80' },
    ]);
    graph.updateCurrentTime(state.t);
    graph.render();
  } else if (scene === '三宇宙速度') {
    const r = Math.sqrt(state.x ** 2 + state.y ** 2);
    timeData.push(state.t);
    rData.push(r);
    if (timeData.length > 500) {
      timeData.splice(0, timeData.length - 500);
      rData.splice(0, rData.length - 500);
    }
    graph.setTraces([{ x: timeData, y: rData, name: 'r(t)', color: '#60a5fa' }]);
    graph.updateCurrentTime(state.t);
    graph.render();
  } else {
    const r = Math.sqrt(state.x ** 2 + state.y ** 2);
    timeData.push(state.t);
    rData.push(r);
    if (timeData.length > 500) {
      timeData.splice(0, timeData.length - 500);
      rData.splice(0, rData.length - 500);
    }
    graph.setTraces([{ x: timeData, y: rData, name: 'r(t)', color: '#60a5fa' }]);
    graph.updateCurrentTime(state.t);
    graph.render();
  }

  controls.updateTime(state.t);
}

// ---------- Three Cosmic Velocities Scene ----------
function renderCosmicVelocities(ctx: CanvasRenderingContext2D, state: CelestialState): void {
  const R_planet = 1.0;
  const GM = getGM();
  const v1 = Math.sqrt(GM / R_planet);
  const v2 = v1 * Math.SQRT2;
  const launchFrac = panel.getValue<number>('launchV');
  const vLaunch = v1 * launchFrac;

  const [cx, cy] = cm.toScreen(0, 0);

  // Draw planet
  const planetScreenR = R_planet * 80; // scale factor
  const planetGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, planetScreenR);
  planetGrad.addColorStop(0, '#1e40af');
  planetGrad.addColorStop(0.7, '#1e3a8a');
  planetGrad.addColorStop(1, '#172554');
  ctx.beginPath();
  ctx.arc(cx, cy, planetScreenR, 0, Math.PI * 2);
  ctx.fillStyle = planetGrad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(96,165,250,0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Reference circular orbit (v1)
  ctx.strokeStyle = 'rgba(74,222,128,0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, planetScreenR, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Trail
  trail.push({ x: state.x, y: state.y });
  if (trail.length > 3000) trail.shift();

  // Determine trajectory type
  let trajectoryType = '';
  let trajectoryColor = '#60a5fa';
  const ratio = launchFrac;
  if (ratio < 1.0) {
    trajectoryType = '亚轨道 (v < v₁): 坠落回行星';
    trajectoryColor = '#f87171'; // red
  } else if (Math.abs(ratio - 1.0) < 0.02) {
    trajectoryType = '圆轨道 (v = v₁)';
    trajectoryColor = '#4ade80'; // green
  } else if (ratio < Math.SQRT2) {
    trajectoryType = '椭圆轨道 (v₁ < v < v₂)';
    trajectoryColor = '#60a5fa'; // blue
  } else if (Math.abs(ratio - Math.SQRT2) < 0.02) {
    trajectoryType = '抛物线逃逸 (v = v₂)';
    trajectoryColor = '#fbbf24'; // yellow
  } else {
    trajectoryType = '双曲线逃逸 (v > v₂)';
    trajectoryColor = '#f472b6'; // pink
  }

  // Draw trail
  if (panel.getValue<boolean>('showTrail') && trail.length > 1) {
    ctx.shadowColor = trajectoryColor;
    ctx.shadowBlur = 6;
    ctx.strokeStyle = trajectoryColor;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const [sx, sy] = cm.toScreen(trail[i].x, trail[i].y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  // Orbiter
  const [ox, oy] = cm.toScreen(state.x, state.y);
  cm.drawBall(ox, oy, 6, trajectoryColor, { glow: true });

  // Velocity vector
  const vScale = 30;
  ctx.strokeStyle = trajectoryColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(ox, oy);
  ctx.lineTo(ox + state.vx * vScale, oy - state.vy * vScale);
  ctx.stroke();

  // Info panel
  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';

  const r = Math.sqrt(state.x ** 2 + state.y ** 2);
  const v = Math.sqrt(state.vx ** 2 + state.vy ** 2);

  ctx.fillText('--- 三宇宙速度 ---', 20, 24);
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`v\u2081 = \u221A(GM/R) = ${v1.toFixed(3)}  (第一宇宙速度: 圆轨道)`, 20, 44);
  ctx.fillStyle = '#fbbf24';
  ctx.fillText(`v\u2082 = v\u2081\u00D7\u221A2 = ${v2.toFixed(3)}  (第二宇宙速度: 逃逸)`, 20, 62);
  ctx.fillStyle = '#f472b6';
  ctx.fillText(`v\u2083 \u2248 16.7 km/s  (第三宇宙速度: 脱离太阳系)`, 20, 80);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`当前: v = ${(launchFrac).toFixed(2)} v\u2081 = ${vLaunch.toFixed(3)}`, 20, 106);
  ctx.fillText(`r = ${r.toFixed(3)}   |v| = ${v.toFixed(3)}`, 20, 124);

  // Trajectory type label
  ctx.fillStyle = trajectoryColor;
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(trajectoryType, 20, 148);

  // Key teaching point
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('高轨低速大周期', 20, 174);
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Higher orbit \u2192 lower orbital speed \u2192 longer period', 20, 190);

  // Launch speed scale bar
  const barX = cm.getWidth() - 200;
  const barY = 30;
  const barH = 200;
  ctx.fillStyle = 'rgba(30,41,59,0.8)';
  ctx.fillRect(barX - 10, barY - 10, 190, barH + 40);
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 1;
  ctx.strokeRect(barX - 10, barY - 10, 190, barH + 40);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('发射速度标尺', barX + 80, barY + 6);

  // Scale markings
  const marks = [
    { frac: 0.5, label: '0.5v\u2081', color: '#f87171' },
    { frac: 1.0, label: 'v\u2081', color: '#4ade80' },
    { frac: Math.SQRT2, label: 'v\u2082=\u221A2\u00B7v\u2081', color: '#fbbf24' },
    { frac: 2.2, label: '2.2v\u2081', color: '#f472b6' },
  ];
  const minFrac = 0.5, maxFrac = 2.2;
  for (const m of marks) {
    const yPos = barY + 20 + (1 - (m.frac - minFrac) / (maxFrac - minFrac)) * (barH - 30);
    ctx.strokeStyle = m.color;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(barX, yPos);
    ctx.lineTo(barX + 100, yPos);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = m.color;
    ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(m.label, barX + 105, yPos + 4);
  }
  // Current value indicator
  const curY = barY + 20 + (1 - (launchFrac - minFrac) / (maxFrac - minFrac)) * (barH - 30);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(barX - 5, curY);
  ctx.lineTo(barX + 5, curY - 5);
  ctx.lineTo(barX + 5, curY + 5);
  ctx.closePath();
  ctx.fill();
}

// ---------- Satellite Pursuit / Rendezvous Scene ----------
function renderPursuit(ctx: CanvasRenderingContext2D, state: CelestialState): void {
  const GM = getGM();
  const r1 = panel.getValue<number>('pursuitR1');
  const r2 = panel.getValue<number>('pursuitR2');
  const omega1 = Math.sqrt(GM / (r1 * r1 * r1));
  const omega2 = Math.sqrt(GM / (r2 * r2 * r2));
  const dTheta0 = panel.getValue<number>('pursuitDTheta') * Math.PI / 180;

  const [cx, cy] = cm.toScreen(0, 0);

  // Central planet
  cm.drawBall(cx, cy, 14, '#fbbf24', { glow: true });

  // Inner orbit circle
  const r1Screen = r1 * 80;
  ctx.shadowColor = 'rgba(96,165,250,0.3)';
  ctx.shadowBlur = 4;
  ctx.strokeStyle = 'rgba(96,165,250,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.arc(cx, cy, r1Screen, 0, Math.PI * 2);
  ctx.stroke();

  // Outer orbit circle
  const r2Screen = r2 * 80;
  ctx.shadowColor = 'rgba(248,113,113,0.3)';
  ctx.strokeStyle = 'rgba(248,113,113,0.3)';
  ctx.beginPath();
  ctx.arc(cx, cy, r2Screen, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Inner satellite
  const [s1x, s1y] = cm.toScreen(state.x, state.y);
  cm.drawBall(s1x, s1y, 8, '#60a5fa', { glow: true });
  cm.drawText('S1', s1x, s1y + 3, { color: '#fff', font: 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif', align: 'center' });

  // Outer satellite
  const [s2x, s2y] = cm.toScreen(state.x2, state.y2);
  cm.drawBall(s2x, s2y, 8, '#f87171', { glow: true });
  cm.drawText('S2', s2x, s2y + 3, { color: '#fff', font: 'bold 9px -apple-system, BlinkMacSystemFont, sans-serif', align: 'center' });

  // Angular position arcs
  // Draw arc from positive x-axis to satellite angle
  ctx.strokeStyle = 'rgba(96,165,250,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 30, -state.theta1, 0, state.theta1 > 0);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(248,113,113,0.5)';
  ctx.beginPath();
  ctx.arc(cx, cy, 36, -state.theta2, 0, state.theta2 > 0);
  ctx.stroke();

  // Rendezvous flash
  if (state.flashTimer > 0) {
    ctx.globalAlpha = state.flashTimer;
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    const flashR = 20 + (1 - state.flashTimer) * 30;
    ctx.beginPath();
    ctx.arc(s1x, s1y, flashR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(s2x, s2y, flashR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RENDEZVOUS!', cx, cy - r2Screen - 20);
  }

  // Line connecting satellites
  ctx.strokeStyle = 'rgba(251,191,36,0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(s1x, s1y);
  ctx.lineTo(s2x, s2y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Info panel
  const dTheta = ((state.theta1 - state.theta2) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
  const dOmega = omega1 - omega2;

  // Time to next rendezvous: need dTheta_remaining / dOmega
  // Inner catches up; rendezvous when angular diff = 2*pi*n
  // Time = (2*pi - dTheta) / dOmega  (time until inner laps outer)
  const timeToNext = dOmega > 0 ? ((2 * Math.PI - dTheta) % (2 * Math.PI)) / dOmega : Infinity;

  ctx.fillStyle = '#e2e8f0';
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('--- 天体追及 ---', 20, 24);

  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#60a5fa';
  ctx.fillText(`S1: r\u2081=${r1.toFixed(1)} AU, \u03C9\u2081=${omega1.toFixed(4)} rad/s`, 20, 44);
  ctx.fillStyle = '#f87171';
  ctx.fillText(`S2: r\u2082=${r2.toFixed(1)} AU, \u03C9\u2082=${omega2.toFixed(4)} rad/s`, 20, 62);

  ctx.fillStyle = '#e2e8f0';
  ctx.fillText(`\u0394\u03C9 = \u03C9\u2081 - \u03C9\u2082 = ${dOmega.toFixed(4)} rad/s`, 20, 86);
  ctx.fillText(`\u0394\u03B8 = ${(dTheta * 180 / Math.PI).toFixed(1)}\u00B0`, 20, 104);
  ctx.fillStyle = '#4ade80';
  ctx.fillText(`下次追及: t = ${timeToNext.toFixed(2)}`, 20, 124);

  // Formula
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('追及条件: \u0394\u03C9 \u00D7 t = 2n\u03C0 + \u0394\u03B8\u2080', 20, 150);
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('\u03C9 = \u221A(GM/r\u00B3)  \u2192  内轨角速度更大', 20, 168);
  ctx.fillText('角速度差决定追及时间', 20, 184);
}

const sim = new SimLoop<CelestialState>({
  dt: 0.02,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: getInitialState(),
});

controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => {
  trail.length = 0; trail2.length = 0; areaSegments.length = 0;
  timeData.length = 0; rData.length = 0; dthetaData.length = 0;
  keplerTable.length = 0;
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
  controls.setPlaying(false);
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

panel.setOnChange(() => {
  trail.length = 0; trail2.length = 0; areaSegments.length = 0;
  timeData.length = 0; rData.length = 0; dthetaData.length = 0;
  keplerTable.length = 0;
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
});

renderScene(0, getInitialState());

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
