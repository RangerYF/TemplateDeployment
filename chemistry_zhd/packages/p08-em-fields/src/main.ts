import '@physics/core/styles.css';
import {
  createLayout, ParameterPanel, defineParams, PlaybackControls,
  SimLoop, CanvasManager, ArrowRenderer, ARROW_COLORS, SyncedGraph, GRAVITY,
} from '@physics/core';
import type { SimState, GraphTrace } from '@physics/core';

interface EMState extends SimState {
  px: number; py: number; vx: number; vy: number; t: number;
}

const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-08 电磁场可视化');

const paramDefs = defineParams([
  { key: 'scene', label: '场景', type: 'select', default: '电场线',
    options: ['电场线', '等势面', '洛伦兹力', '速度选择器', '回旋加速器',
              '电容器偏转', '磁场边界-直线', '磁场边界-圆形', '磁聚焦'] },
  { key: 'charge1', label: '电荷1 q₁', unit: 'μC', min: -10, max: 10, step: 0.5, default: 5,
    scenes: ['电场线', '等势面'] },
  { key: 'charge2', label: '电荷2 q₂', unit: 'μC', min: -10, max: 10, step: 0.5, default: -5,
    scenes: ['电场线', '等势面'] },
  { key: 'showCharge2', label: '显示电荷2', type: 'checkbox', default: false,
    scenes: ['电场线', '等势面'] },
  { key: 'B', label: '磁场 B', unit: 'T', min: 0.01, max: 2, step: 0.01, default: 0.5,
    scenes: ['洛伦兹力', '速度选择器', '回旋加速器', '磁场边界-直线', '磁场边界-圆形', '磁聚焦'] },
  { key: 'E', label: '电场 E', unit: '×10⁶V/m', min: 0.1, max: 10, step: 0.1, default: 1,
    scenes: ['速度选择器'] },
  { key: 'particleMass', label: '粒子质量 m', unit: '×10⁻²⁷kg', min: 1, max: 30, step: 0.5, default: 1.67,
    scenes: ['洛伦兹力', '速度选择器', '回旋加速器', '电容器偏转', '磁场边界-直线', '磁场边界-圆形', '磁聚焦'] },
  { key: 'particleCharge', label: '粒子电荷 q', unit: '×10⁻¹⁹C', min: 0.1, max: 5, step: 0.1, default: 1.6,
    scenes: ['洛伦兹力', '速度选择器', '回旋加速器', '电容器偏转', '磁场边界-直线', '磁场边界-圆形', '磁聚焦'] },
  { key: 'particleV', label: '粒子速度 v₀', unit: '×10⁶m/s', min: 0.1, max: 10, step: 0.1, default: 2,
    scenes: ['洛伦兹力', '速度选择器', '回旋加速器', '电容器偏转', '磁场边界-直线', '磁场边界-圆形', '磁聚焦'] },
  // Capacitor deflection parameters
  { key: 'plateVoltage', label: '极板电压 U', unit: 'V', min: 100, max: 5000, step: 100, default: 1000,
    scenes: ['电容器偏转'] },
  { key: 'plateLength', label: '极板长度 L', unit: 'cm', min: 2, max: 20, step: 1, default: 10,
    scenes: ['电容器偏转'] },
  { key: 'plateSep', label: '极板间距 d', unit: 'cm', min: 1, max: 10, step: 0.5, default: 4,
    scenes: ['电容器偏转'] },
  { key: 'screenDist', label: '荧幕距离 D', unit: 'cm', min: 5, max: 40, step: 1, default: 20,
    scenes: ['电容器偏转'] },
  // Magnetic boundary parameters
  { key: 'boundaryR', label: '圆形边界半径 R', unit: 'm', min: 1, max: 6, step: 0.5, default: 3,
    scenes: ['磁场边界-圆形'] },
  { key: 'entryAngle', label: '入射角度', unit: '°', min: 0, max: 80, step: 5, default: 30,
    scenes: ['磁场边界-直线', '磁场边界-圆形'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);
const cm = new CanvasManager({ container: layout.canvas });

function updateOrigin(): void {
  cm.setOrigin(cm.getWidth() / 2, cm.getHeight() / 2);
}
updateOrigin();
cm.setScale(40);
const arrows = new ArrowRenderer(cm);
const controls = new PlaybackControls(layout.controlBar);

const graphContainer = document.createElement('div');
graphContainer.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer);
const graph = new SyncedGraph({
  container: graphContainer, title: '粒子轨迹参数', xLabel: 't', yLabel: '', height: 260,
});

const trail: { x: number; y: number }[] = [];
const timeData: number[] = [];
const rData: number[] = [];

// Magnetic focusing: multiple particles stored globally (SimState only allows number values)
let focusParticles: { px: number; py: number; vx: number; vy: number }[] = [];
let focusTrails: { x: number; y: number }[][] = [];

function getScene() { return panel.getValue<string>('scene'); }

// Electric field from point charges
function electricField(x: number, y: number): [number, number] {
  const k = 8.99e9;
  const q1 = panel.getValue<number>('charge1') * 1e-6;
  const showQ2 = panel.getValue<boolean>('showCharge2');
  const q2 = panel.getValue<number>('charge2') * 1e-6;

  let ex = 0, ey = 0;
  // Charge 1 at (-2, 0)
  const dx1 = x - (-2), dy1 = y - 0;
  const r1sq = dx1 * dx1 + dy1 * dy1;
  if (r1sq > 0.01) {
    const r1 = Math.sqrt(r1sq);
    const E1 = k * q1 / r1sq;
    ex += E1 * dx1 / r1;
    ey += E1 * dy1 / r1;
  }

  if (showQ2) {
    const dx2 = x - 2, dy2 = y - 0;
    const r2sq = dx2 * dx2 + dy2 * dy2;
    if (r2sq > 0.01) {
      const r2 = Math.sqrt(r2sq);
      const E2 = k * q2 / r2sq;
      ex += E2 * dx2 / r2;
      ey += E2 * dy2 / r2;
    }
  }
  return [ex, ey];
}

function potential(x: number, y: number): number {
  const k = 8.99e9;
  const q1 = panel.getValue<number>('charge1') * 1e-6;
  const showQ2 = panel.getValue<boolean>('showCharge2');
  const q2 = panel.getValue<number>('charge2') * 1e-6;

  let V = 0;
  const r1 = Math.sqrt((x + 2) ** 2 + y ** 2);
  if (r1 > 0.1) V += k * q1 / r1;
  if (showQ2) {
    const r2 = Math.sqrt((x - 2) ** 2 + y ** 2);
    if (r2 > 0.1) V += k * q2 / r2;
  }
  return V;
}

function drawFieldLines(): void {
  const ctx = cm.ctx;
  const q1 = panel.getValue<number>('charge1');
  const showQ2 = panel.getValue<boolean>('showCharge2');
  const q2 = panel.getValue<number>('charge2');

  // Draw charges
  const [cx1, cy1] = cm.toScreen(-2, 0);
  const chargeColor1 = q1 > 0 ? '#f87171' : '#60a5fa';
  cm.drawBall(cx1, cy1, 15, chargeColor1, { glow: true });
  cm.drawText(q1 > 0 ? '+' : '−', cx1, cy1, { color: '#fff', font: 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif', align: 'center', baseline: 'middle' });
  cm.drawText(`q₁=${q1}μC`, cx1, cy1 + 24, { color: '#fff', font: 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif', align: 'center', bg: true });

  if (showQ2) {
    const [cx2, cy2] = cm.toScreen(2, 0);
    const chargeColor2 = q2 > 0 ? '#f87171' : '#60a5fa';
    cm.drawBall(cx2, cy2, 15, chargeColor2, { glow: true });
    cm.drawText(q2 > 0 ? '+' : '−', cx2, cy2, { color: '#fff', font: 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif', align: 'center', baseline: 'middle' });
    cm.drawText(`q₂=${q2}μC`, cx2, cy2 + 24, { color: '#fff', font: 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif', align: 'center', bg: true });
  }

  // Trace field lines from positive charges
  const numLines = 12;
  const sources: { x: number; y: number; q: number }[] = [];
  if (q1 > 0) sources.push({ x: -2, y: 0, q: q1 });
  else sources.push({ x: -2, y: 0, q: q1 });
  if (showQ2) {
    sources.push({ x: 2, y: 0, q: q2 });
  }

  for (const src of sources) {
    if (src.q === 0) continue;
    const startFromPositive = src.q > 0;
    for (let i = 0; i < numLines; i++) {
      const angle = (i / numLines) * Math.PI * 2;
      let x = src.x + 0.15 * Math.cos(angle);
      let y = src.y + 0.15 * Math.sin(angle);
      const ds = startFromPositive ? 0.08 : -0.08;

      ctx.strokeStyle = `rgba(251, 191, 36, 0.6)`;
      ctx.lineWidth = 1.5;
      ctx.shadowColor = 'rgba(251, 191, 36, 0.4)';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      const [sx, sy] = cm.toScreen(x, y);
      ctx.moveTo(sx, sy);

      for (let step = 0; step < 300; step++) {
        const [ex, ey] = electricField(x, y);
        const mag = Math.sqrt(ex * ex + ey * ey);
        if (mag < 1) break;
        x += (ex / mag) * ds;
        y += (ey / mag) * ds;
        if (Math.abs(x) > 8 || Math.abs(y) > 6) break;
        // Stop near other charge
        if (showQ2) {
          const d2 = Math.sqrt((x - 2) ** 2 + y ** 2);
          if (d2 < 0.15) break;
        }
        const d1 = Math.sqrt((x + 2) ** 2 + y ** 2);
        if (d1 < 0.15 && step > 5) break;

        const [px, py] = cm.toScreen(x, y);
        ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }
  }
}

function drawEquipotentials(): void {
  const ctx = cm.ctx;
  const w = cm.getWidth();
  const h = cm.getHeight();
  const res = 4; // pixel resolution

  // Compute potential grid
  const cols = Math.floor(w / res);
  const rows = Math.floor(h / res);
  const grid: number[][] = [];
  for (let r = 0; r < rows; r++) {
    grid[r] = [];
    for (let c = 0; c < cols; c++) {
      const [wx, wy] = cm.toWorld(c * res, r * res);
      grid[r][c] = potential(wx, wy);
    }
  }

  // Draw contour lines
  const levels = [-5e6, -2e6, -1e6, -5e5, -2e5, -1e5, 0, 1e5, 2e5, 5e5, 1e6, 2e6, 5e6];
  const colors = ['#3b82f6', '#3b82f6', '#60a5fa', '#60a5fa', '#93c5fd', '#93c5fd',
    '#94a3b8', '#fca5a5', '#fca5a5', '#f87171', '#f87171', '#ef4444', '#ef4444'];

  for (let li = 0; li < levels.length; li++) {
    const level = levels[li];
    ctx.strokeStyle = colors[li] || '#94a3b8';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.6;

    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const v00 = grid[r][c], v10 = grid[r][c + 1];
        const v01 = grid[r + 1][c], v11 = grid[r + 1][c + 1];

        // Simple marching squares - horizontal edge
        if ((v00 - level) * (v10 - level) < 0) {
          const frac = (level - v00) / (v10 - v00);
          const x1 = (c + frac) * res;
          const y1 = r * res;
          // Find matching edge
          if ((v01 - level) * (v11 - level) < 0) {
            const frac2 = (level - v01) / (v11 - v01);
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo((c + frac2) * res, (r + 1) * res);
            ctx.stroke();
          }
        }
        if ((v00 - level) * (v01 - level) < 0) {
          const frac = (level - v00) / (v01 - v00);
          const y1 = (r + frac) * res;
          if ((v10 - level) * (v11 - level) < 0) {
            const frac2 = (level - v10) / (v11 - v10);
            ctx.beginPath();
            ctx.moveTo(c * res, y1);
            ctx.lineTo((c + 1) * res, (r + frac2) * res);
            ctx.stroke();
          }
        }
      }
    }
    ctx.globalAlpha = 1;
  }

  // Draw charges on top
  drawFieldLines(); // reuse charge drawing
}

function createStepFn() {
  return (_t: number, dt: number, state: EMState): EMState => {
    const scene = getScene();
    let { px, py, vx, vy, t: st } = state;

    if (scene === '洛伦兹力' || scene === '回旋加速器') {
      const B = panel.getValue<number>('B');
      const m = panel.getValue<number>('particleMass') * 1e-27;
      const q = panel.getValue<number>('particleCharge') * 1e-19;
      const scale = 1e-6; // scale factor for visualization

      // Boris algorithm: preserves |v| for pure magnetic fields
      // B is in -z direction (into page)

      if (scene === '回旋加速器') {
        const gapWidth = 0.3;
        const inGap = Math.abs(px) < gapWidth;
        if (inGap) {
          const omega = q * B / m;
          const period = 2 * Math.PI / omega;
          const halfPeriod = period / 2;
          const phase = (st / halfPeriod) % 2;
          const eField = phase < 1 ? 1e3 : -1e3;
          // No B in gap for cyclotron: skip magnetic rotation
          vx += (q * eField / m) * dt * scale;
          px += vx * dt;
          py += vy * dt;
        } else {
          // Boris algorithm with E=0 in D regions
          // Step 1: half-step E acceleration (zero here)
          const vmx = vx;
          const vmy = vy;
          // Step 2: magnetic rotation
          const tz = -(q * B / m) * (dt / 2) * scale;
          const tMag2 = tz * tz;
          // v' = v⁻ + v⁻ × t  (2D: v⁻ × t has only x,y components from vx,vy crossed with tz)
          const vpx = vmx + vmy * tz;
          const vpy = vmy - vmx * tz;
          const sz = 2 * tz / (1 + tMag2);
          // v⁺ = v⁻ + v' × s
          vx = vmx + vpy * sz;
          vy = vmy - vpx * sz;
          // Step 3: half-step E acceleration (zero here)
          // Step 4: position update
          px += vx * dt;
          py += vy * dt;
        }
      } else {
        // 洛伦兹力: pure B field, no E
        // Boris algorithm
        // Step 1: half-step E acceleration (E=0, so v⁻ = v^n)
        const vmx = vx;
        const vmy = vy;
        // Step 2: magnetic rotation
        // t_vec = (qB/m)(dt/2) * scale, B in -z: t_vec = (0, 0, -qB/m * dt/2 * scale)
        const tz = -(q * B / m) * (dt / 2) * scale;
        const tMag2 = tz * tz;
        // v' = v⁻ + v⁻ × t  (cross product with t in z only)
        // (vmx, vmy, 0) × (0, 0, tz) = (vmy*tz, -vmx*tz, 0)
        const vpx = vmx + vmy * tz;
        const vpy = vmy - vmx * tz;
        const sz = 2 * tz / (1 + tMag2);
        // v⁺ = v⁻ + v' × s
        vx = vmx + vpy * sz;
        vy = vmy - vpx * sz;
        // Step 3: half-step E acceleration (E=0, no change)
        // Step 4: position update
        px += vx * dt;
        py += vy * dt;
      }
    } else if (scene === '速度选择器') {
      const B = panel.getValue<number>('B');
      const E = panel.getValue<number>('E') * 1e6; // convert ×10⁶V/m to V/m
      const m = panel.getValue<number>('particleMass') * 1e-27;
      const q = panel.getValue<number>('particleCharge') * 1e-19;
      const scale = 1e-6;

      // Boris algorithm with both E and B
      // E field downward: Ex=0, Ey=-E
      // B field into page: Bz=-B
      const Ex = 0;
      const Ey = -E;

      // Step 1: half-step electric acceleration
      const vmx = vx + (q * Ex / m) * (dt / 2) * scale;
      const vmy = vy + (q * Ey / m) * (dt / 2) * scale;

      // Step 2: magnetic rotation
      const tz = -(q * B / m) * (dt / 2) * scale;
      const tMag2 = tz * tz;
      // v' = v⁻ + v⁻ × t
      const vpx = vmx + vmy * tz;
      const vpy = vmy - vmx * tz;
      const sz = 2 * tz / (1 + tMag2);
      // v⁺ = v⁻ + v' × s
      const vplusx = vmx + vpy * sz;
      const vplusy = vmy - vpx * sz;

      // Step 3: half-step electric acceleration
      vx = vplusx + (q * Ex / m) * (dt / 2) * scale;
      vy = vplusy + (q * Ey / m) * (dt / 2) * scale;

      // Step 4: position update
      px += vx * dt;
      py += vy * dt;
    } else if (scene === '电容器偏转') {
      // Capacitor deflection: uniform E field between plates, free flight outside
      const U = panel.getValue<number>('plateVoltage');
      const L = panel.getValue<number>('plateLength') * 0.01; // cm -> m
      const d = panel.getValue<number>('plateSep') * 0.01;    // cm -> m
      const m = panel.getValue<number>('particleMass') * 1e-27;
      const q = panel.getValue<number>('particleCharge') * 1e-19;
      const Ecap = U / d; // electric field strength

      // World scale: 1 world unit = 0.02m (2cm)
      const ws = 0.02;
      const pxPhys = px * ws; // physical x in meters
      const halfL = L / 2;

      // Inside capacitor plates: apply E field (-y direction, from + plate to - plate)
      if (pxPhys >= -halfL && pxPhys <= halfL) {
        // E field points from + plate (top) to - plate (bottom) = -y direction
        // Force on positive charge is in -y direction (toward - plate)
        // acceleration in y: ay = -qE/m (physical m/s^2)
        // Convert to world coordinates: ay_world = ay / ws
        vy -= (q * Ecap / m) * dt * 1e-6 / ws;
      }
      // Position update (both inside and outside plates)
      px += vx * dt;
      py += vy * dt;
    } else if (scene === '磁场边界-直线' || scene === '磁场边界-圆形') {
      const B = panel.getValue<number>('B');
      const m = panel.getValue<number>('particleMass') * 1e-27;
      const q = panel.getValue<number>('particleCharge') * 1e-19;
      const scale = 1e-6;

      let inField = false;
      if (scene === '磁场边界-直线') {
        // Magnetic field exists only above y=0 (upper half)
        inField = py >= 0;
      } else {
        // Magnetic field exists inside circle of radius R centered at origin
        const R = panel.getValue<number>('boundaryR');
        inField = (px * px + py * py) <= R * R;
      }

      if (inField) {
        // Boris algorithm for magnetic field region
        const vmx = vx;
        const vmy = vy;
        const tz = -(q * B / m) * (dt / 2) * scale;
        const tMag2 = tz * tz;
        const vpx = vmx + vmy * tz;
        const vpy = vmy - vmx * tz;
        const sz = 2 * tz / (1 + tMag2);
        vx = vmx + vpy * sz;
        vy = vmy - vpx * sz;
      }
      // Outside field: straight line (no force)
      px += vx * dt;
      py += vy * dt;
    } else if (scene === '磁聚焦') {
      const B = panel.getValue<number>('B');
      const m = panel.getValue<number>('particleMass') * 1e-27;
      const q = panel.getValue<number>('particleCharge') * 1e-19;
      const scale = 1e-6;

      // Update all focus particles with Boris algorithm (pure B field)
      for (const p of focusParticles) {
        const vmx = p.vx;
        const vmy = p.vy;
        const tz = -(q * B / m) * (dt / 2) * scale;
        const tMag2 = tz * tz;
        const vpx2 = vmx + vmy * tz;
        const vpy2 = vmy - vmx * tz;
        const sz2 = 2 * tz / (1 + tMag2);
        p.vx = vmx + vpy2 * sz2;
        p.vy = vmy - vpx2 * sz2;
        p.px += p.vx * dt;
        p.py += p.vy * dt;
      }
      // Also update main particle (reference particle at angle=0)
      const vmx = vx;
      const vmy = vy;
      const tz = -(q * B / m) * (dt / 2) * scale;
      const tMag2 = tz * tz;
      const vpx3 = vmx + vmy * tz;
      const vpy3 = vmy - vmx * tz;
      const sz3 = 2 * tz / (1 + tMag2);
      vx = vmx + vpy3 * sz3;
      vy = vmy - vpx3 * sz3;
      px += vx * dt;
      py += vy * dt;
    }

    return { px, py, vx, vy, t: st + dt };
  };
}

function getInitialState(): EMState {
  const scene = getScene();
  const v0 = panel.getValue<number>('particleV');
  if (scene === '回旋加速器') {
    return { px: 0, py: 0, vx: v0 * 0.3, vy: 0, t: 0 };
  }
  if (scene === '速度选择器') {
    return { px: -8, py: 0, vx: v0, vy: 0, t: 0 };
  }
  if (scene === '电容器偏转') {
    // Particle enters from the left, moving right with v₀
    // Plates centered around x=0; particle starts well to the left
    return { px: -8, py: 0, vx: v0, vy: 0, t: 0 };
  }
  if (scene === '磁场边界-直线') {
    // Particle enters from below the boundary (y<0), moving upward at an angle
    const angle = panel.getValue<number>('entryAngle') * Math.PI / 180;
    return {
      px: -2, py: -0.1, vx: v0 * Math.sin(angle), vy: v0 * Math.cos(angle), t: 0,
    };
  }
  if (scene === '磁场边界-圆形') {
    // Particle enters the circular boundary from the left
    const R = panel.getValue<number>('boundaryR');
    const angle = panel.getValue<number>('entryAngle') * Math.PI / 180;
    return {
      px: -R - 0.5, py: 0, vx: v0 * Math.cos(angle), vy: v0 * Math.sin(angle), t: 0,
    };
  }
  if (scene === '磁聚焦') {
    // Multiple particles entering from left with same speed but different angles
    const angles = [-20, -10, 0, 10, 20]; // degrees
    focusParticles = angles.map(a => {
      const rad = a * Math.PI / 180;
      return {
        px: -6, py: 0,
        vx: v0 * Math.cos(rad), vy: v0 * Math.sin(rad),
      };
    });
    focusTrails = focusParticles.map(() => []);
    return { px: -6, py: 0, vx: v0, vy: 0, t: 0 };
  }
  return { px: -6, py: 0, vx: v0, vy: 0, t: 0 };
}

function renderScene(t: number, state: EMState): void {
  const scene = getScene();
  updateOrigin();
  cm.clear('#070b14');
  const ctx = cm.ctx;

  if (scene === '电场线') {
    drawFieldLines();
  } else if (scene === '等势面') {
    drawEquipotentials();
  } else if (scene === '洛伦兹力' || scene === '速度选择器' || scene === '回旋加速器') {
    // Original particle motion scenes
    trail.push({ x: state.px, y: state.py });
    if (trail.length > 2000) trail.shift();

    // Draw B field indicator (crosses = into page)
    const B = panel.getValue<number>('B');
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    for (let ix = -7; ix <= 7; ix += 2) {
      for (let iy = -4; iy <= 4; iy += 2) {
        const [sx2, sy2] = cm.toScreen(ix, iy);
        ctx.fillText('×', sx2, sy2);
      }
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`B = ${B} T (垂直纸面向里)`, 20, 30);

    if (scene === '速度选择器') {
      const E = panel.getValue<number>('E');
      const Eval = E * 1e6; // ×10⁶V/m
      ctx.fillStyle = '#f87171';
      ctx.fillRect(...cm.toScreen(-6, 3), cm.getScale() * 12, 3);
      ctx.fillStyle = '#60a5fa';
      ctx.fillRect(...cm.toScreen(-6, -3), cm.getScale() * 12, 3);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
      const [lx, ly] = cm.toScreen(-6, 3.2);
      ctx.fillText('+', lx, ly);
      const [lx2, ly2] = cm.toScreen(-6, -3.4);
      ctx.fillText('−', lx2, ly2);
      ctx.fillText(`E = ${E}×10⁶ V/m (↓)`, 20, 50);

      const vBalance = Eval / B;
      ctx.fillText(`v = E/B = ${(vBalance / 1e6).toFixed(2)}×10⁶ m/s 时直线通过`, 20, 70);
    }

    if (scene === '回旋加速器') {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      const r = 5 * cm.getScale();
      const [ox, oy] = cm.toScreen(0, 0);
      ctx.beginPath();
      ctx.arc(ox, oy, r, Math.PI / 2, -Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ox, oy, r, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(251,191,36,0.2)';
      const gapPx = 0.3 * cm.getScale();
      ctx.fillRect(ox - gapPx, oy - r, gapPx * 2, r * 2);
    }

    // Draw trail
    ctx.shadowColor = 'rgba(96, 165, 250, 0.4)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const [sx, sy] = cm.toScreen(trail[i].x, trail[i].y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw particle
    const [px2, py2] = cm.toScreen(state.px, state.py);
    cm.drawBall(px2, py2, 8, '#fbbf24', { glow: true });

    // Velocity arrow
    arrows.draw(state.px, state.py, state.vx * 0.3, state.vy * 0.3, {
      color: ARROW_COLORS.velocity, label: 'v',
    });

    // Radius info for Lorentz force
    if (scene === '洛伦兹力') {
      const B2 = panel.getValue<number>('B');
      const m = panel.getValue<number>('particleMass') * 1e-27;
      const q = panel.getValue<number>('particleCharge') * 1e-19;
      const v0 = panel.getValue<number>('particleV');
      const r = m * v0 * 1e6 / (q * B2);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 16px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`r = mv/(qB) = ${r.toExponential(2)} m`, 20, 50);
      ctx.fillText(`T = 2πm/(qB) = ${(2 * Math.PI * m / (q * B2) * 1e9).toFixed(2)} ns`, 20, 72);
    }

    // Graph data
    timeData.push(state.t);
    const r2 = Math.sqrt(state.px ** 2 + state.py ** 2);
    rData.push(r2);
    const max = 500;
    if (timeData.length > max) {
      timeData.splice(0, timeData.length - max);
      rData.splice(0, rData.length - max);
    }
    graph.setTraces([
      { x: timeData, y: rData, name: '径向距离 r', color: '#60a5fa' },
    ]);
  } else if (scene === '电容器偏转') {
    // === Capacitor Deflection Scene ===
    const U = panel.getValue<number>('plateVoltage');
    const L_cm = panel.getValue<number>('plateLength');
    const d_cm = panel.getValue<number>('plateSep');
    const D_cm = panel.getValue<number>('screenDist');
    const L = L_cm * 0.01;
    const d = d_cm * 0.01;
    const D = D_cm * 0.01;
    const m = panel.getValue<number>('particleMass') * 1e-27;
    const q = panel.getValue<number>('particleCharge') * 1e-19;
    const v0 = panel.getValue<number>('particleV') * 1e6;
    const Ecap = U / d;
    const ws = 0.02; // 1 world unit = 0.02m

    const halfLw = (L / 2) / ws;   // half plate length in world
    const halfDw = (d / 2) / ws;   // half plate sep in world
    const screenXw = halfLw + D / ws; // screen x in world

    // Draw plates
    ctx.fillStyle = '#f87171';
    const [p1x, p1y] = cm.toScreen(-halfLw, halfDw);
    const plateWidthPx = halfLw * 2 * cm.getScale();
    ctx.fillRect(p1x, p1y, plateWidthPx, 3);
    ctx.fillStyle = '#60a5fa';
    const [p2x, p2y] = cm.toScreen(-halfLw, -halfDw);
    ctx.fillRect(p2x, p2y, plateWidthPx, 3);

    // Plate labels
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [lblx1, lbly1] = cm.toScreen(0, halfDw + 0.6);
    ctx.fillText('+ 极板', lblx1, lbly1);
    const [lblx2, lbly2] = cm.toScreen(0, -halfDw - 0.6);
    ctx.fillText('− 极板', lblx2, lbly2);

    // Draw E field arrows between plates
    ctx.strokeStyle = 'rgba(251,191,36,0.4)';
    ctx.lineWidth = 1;
    for (let ix = -halfLw + 0.5; ix <= halfLw - 0.5; ix += 1.5) {
      const [ax, ay] = cm.toScreen(ix, halfDw * 0.7);
      const [bx, by] = cm.toScreen(ix, -halfDw * 0.7);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
      // arrowhead
      ctx.beginPath();
      ctx.moveTo(bx - 4, by - 8);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + 4, by - 8);
      ctx.stroke();
    }

    // Draw screen
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    const [scx1, scy1] = cm.toScreen(screenXw, -4);
    const [scx2, scy2] = cm.toScreen(screenXw, 4);
    ctx.beginPath();
    ctx.moveTo(scx1, scy1);
    ctx.lineTo(scx2, scy2);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    const [sclx, scly] = cm.toScreen(screenXw, 4.5);
    ctx.fillText('荧幕', sclx, scly);

    // Compute analytical results
    const y_defl = -(q * Ecap * L * L / (2 * m * v0 * v0));
    const tanTheta = -(q * Ecap * L / (m * v0 * v0));
    const theta = Math.atan(tanTheta);
    const y_screen = y_defl + tanTheta * D;

    // Draw analytical trajectory (dashed)
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = 'rgba(251,191,36,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    // Entry straight line
    const [elx, ely] = cm.toScreen(-8, 0);
    const [erx, ery] = cm.toScreen(-halfLw, 0);
    ctx.moveTo(elx, ely);
    ctx.lineTo(erx, ery);
    // Parabolic section inside plates
    const nSteps = 40;
    for (let i = 0; i <= nSteps; i++) {
      const frac = i / nSteps;
      const xp = -halfLw + frac * halfLw * 2;
      const xPhys = frac * L;
      const yp = -(q * Ecap / (2 * m * v0 * v0)) * xPhys * xPhys / ws;
      const [spx, spy] = cm.toScreen(xp, yp);
      ctx.lineTo(spx, spy);
    }
    // Exit straight line to screen
    const exitYw = y_defl / ws;
    const screenYw = y_screen / ws;
    const [exx, exy] = cm.toScreen(halfLw, exitYw);
    ctx.lineTo(exx, exy);
    const [scpx, scpy] = cm.toScreen(screenXw, screenYw);
    ctx.lineTo(scpx, scpy);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw trail
    trail.push({ x: state.px, y: state.py });
    if (trail.length > 2000) trail.shift();
    ctx.shadowColor = 'rgba(96, 165, 250, 0.4)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const [sx, sy] = cm.toScreen(trail[i].x, trail[i].y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw particle
    const [ppx, ppy] = cm.toScreen(state.px, state.py);
    cm.drawBall(ppx, ppy, 8, '#fbbf24', { glow: true });

    // Velocity arrow
    arrows.draw(state.px, state.py, state.vx * 0.3, state.vy * 0.3, {
      color: ARROW_COLORS.velocity, label: 'v',
    });

    // Display formulas and computed values
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`U = ${U} V, L = ${L_cm} cm, d = ${d_cm} cm, D = ${D_cm} cm`, 20, 30);
    ctx.fillText(`E = U/d = ${Ecap.toFixed(0)} V/m`, 20, 50);
    ctx.fillText(`偏转量 y = qEL²/(2mv₀²) = ${(Math.abs(y_defl) * 100).toFixed(3)} cm (向−极板)`, 20, 70);
    ctx.fillText(`偏转角 tan θ = qEL/(mv₀²) = ${Math.abs(tanTheta).toFixed(4)}`, 20, 90);
    ctx.fillText(`θ = ${(theta * 180 / Math.PI).toFixed(2)}°`, 20, 110);
    ctx.fillText(`荧幕偏移 Y = y + D·tan θ = ${(Math.abs(y_screen) * 100).toFixed(3)} cm`, 20, 130);

    // Graph data
    timeData.push(state.t);
    const r2 = Math.sqrt(state.px ** 2 + state.py ** 2);
    rData.push(r2);
    const max = 500;
    if (timeData.length > max) {
      timeData.splice(0, timeData.length - max);
      rData.splice(0, rData.length - max);
    }
    graph.setTraces([
      { x: timeData, y: rData, name: '径向距离 r', color: '#60a5fa' },
    ]);
  } else if (scene === '磁场边界-直线') {
    // === Straight-line Magnetic Boundary Scene ===
    trail.push({ x: state.px, y: state.py });
    if (trail.length > 2000) trail.shift();

    const B = panel.getValue<number>('B');
    const m = panel.getValue<number>('particleMass') * 1e-27;
    const q = panel.getValue<number>('particleCharge') * 1e-19;
    const v0 = panel.getValue<number>('particleV') * 1e6;
    const r = m * v0 / (q * B); // Larmor radius in meters

    // Draw boundary line at y=0
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    const [blx, bly] = cm.toScreen(-10, 0);
    const [brx, bry] = cm.toScreen(10, 0);
    ctx.beginPath();
    ctx.moveTo(blx, bly);
    ctx.lineTo(brx, bry);
    ctx.stroke();

    // Label boundary
    ctx.fillStyle = '#fbbf24';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    const [lbx, lby] = cm.toScreen(-9, 0.5);
    ctx.fillText('边界线', lbx, lby);

    // Draw B field indicators above boundary (field region)
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    for (let ix = -7; ix <= 7; ix += 2) {
      for (let iy = 1; iy <= 5; iy += 2) {
        const [sx2, sy2] = cm.toScreen(ix, iy);
        ctx.fillText('×', sx2, sy2);
      }
    }
    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'left';
    ctx.fillText(`B = ${B} T (上半区, 垂直纸面向里)`, 20, 30);

    // Draw "no field" label below
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    const [nfx, nfy] = cm.toScreen(0, -2);
    ctx.textAlign = 'center';
    ctx.fillText('无磁场区域', nfx, nfy);

    // Compute geometric properties for annotation
    // The entry point is where particle crosses y=0 going up
    // After circular arc in B region, it exits at another point on y=0
    // Entry and exit are symmetric about perpendicular from circle center to boundary
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`r = mv/(qB) = ${r.toExponential(2)} m`, 20, 50);
    ctx.fillText(`入射点和出射点关于圆心到边界的垂线对称`, 20, 70);

    // Attempt to find entry/exit points from trail for annotation
    let entryPt: { x: number; y: number } | null = null;
    let exitPt: { x: number; y: number } | null = null;
    for (let i = 1; i < trail.length; i++) {
      if (trail[i - 1].y < 0 && trail[i].y >= 0 && !entryPt) {
        entryPt = { x: trail[i].x, y: 0 };
      }
      if (trail[i - 1].y >= 0 && trail[i].y < 0) {
        exitPt = { x: trail[i].x, y: 0 };
      }
    }
    if (entryPt) {
      const [ex, ey] = cm.toScreen(entryPt.x, entryPt.y);
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#34d399';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('入射点', ex, ey + 18);
    }
    if (exitPt) {
      const [ex, ey] = cm.toScreen(exitPt.x, exitPt.y);
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#f472b6';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('出射点', ex, ey + 18);
    }
    // If both found, draw center perpendicular and radius
    if (entryPt && exitPt) {
      const midX = (entryPt.x + exitPt.x) / 2;
      // Draw dashed perpendicular from midpoint upward (center is above midpoint)
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      const [mx, my] = cm.toScreen(midX, 0);
      const [mtx, mty] = cm.toScreen(midX, 4);
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mtx, mty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('对称轴', mtx + 30, mty);

      // Mark chord
      ctx.strokeStyle = 'rgba(52,211,153,0.5)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      const [c1x, c1y] = cm.toScreen(entryPt.x, 0);
      const [c2x, c2y] = cm.toScreen(exitPt.x, 0);
      ctx.beginPath();
      ctx.moveTo(c1x, c1y - 5);
      ctx.lineTo(c2x, c2y - 5);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw trail
    ctx.shadowColor = 'rgba(96, 165, 250, 0.4)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const [sx, sy] = cm.toScreen(trail[i].x, trail[i].y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw particle
    const [ppx, ppy] = cm.toScreen(state.px, state.py);
    cm.drawBall(ppx, ppy, 8, '#fbbf24', { glow: true });

    arrows.draw(state.px, state.py, state.vx * 0.3, state.vy * 0.3, {
      color: ARROW_COLORS.velocity, label: 'v',
    });

    // Graph data
    timeData.push(state.t);
    const rDist = Math.sqrt(state.px ** 2 + state.py ** 2);
    rData.push(rDist);
    const max = 500;
    if (timeData.length > max) {
      timeData.splice(0, timeData.length - max);
      rData.splice(0, rData.length - max);
    }
    graph.setTraces([
      { x: timeData, y: rData, name: '径向距离 r', color: '#60a5fa' },
    ]);
  } else if (scene === '磁场边界-圆形') {
    // === Circular Magnetic Boundary Scene ===
    trail.push({ x: state.px, y: state.py });
    if (trail.length > 2000) trail.shift();

    const B = panel.getValue<number>('B');
    const m = panel.getValue<number>('particleMass') * 1e-27;
    const q = panel.getValue<number>('particleCharge') * 1e-19;
    const v0 = panel.getValue<number>('particleV') * 1e6;
    const R = panel.getValue<number>('boundaryR');
    const rLarmor = m * v0 / (q * B);

    // Draw circular boundary
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    const [ox, oy] = cm.toScreen(0, 0);
    const rPx = R * cm.getScale();
    ctx.beginPath();
    ctx.arc(ox, oy, rPx, 0, Math.PI * 2);
    ctx.stroke();

    // Fill interior lightly
    ctx.fillStyle = 'rgba(251,191,36,0.05)';
    ctx.beginPath();
    ctx.arc(ox, oy, rPx, 0, Math.PI * 2);
    ctx.fill();

    // Draw B field indicators inside circle
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    for (let ix = -R + 1; ix <= R - 1; ix += 2) {
      for (let iy = -R + 1; iy <= R - 1; iy += 2) {
        if (ix * ix + iy * iy < R * R * 0.8) {
          const [sx2, sy2] = cm.toScreen(ix, iy);
          ctx.fillText('×', sx2, sy2);
        }
      }
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`B = ${B} T (圆形区域内)`, 20, 30);
    ctx.fillText(`r = mv/(qB) = ${rLarmor.toExponential(2)} m`, 20, 50);
    ctx.fillText(`R = ${R} m (边界半径)`, 20, 70);

    // Find entry and exit points on the circle boundary from trail
    let entryPt: { x: number; y: number } | null = null;
    let exitPt: { x: number; y: number } | null = null;
    for (let i = 1; i < trail.length; i++) {
      const r1sq = trail[i - 1].x ** 2 + trail[i - 1].y ** 2;
      const r2sq = trail[i].x ** 2 + trail[i].y ** 2;
      const R2 = R * R;
      if (r1sq > R2 && r2sq <= R2 && !entryPt) {
        entryPt = { x: trail[i].x, y: trail[i].y };
      }
      if (r1sq <= R2 && r2sq > R2) {
        exitPt = { x: trail[i - 1].x, y: trail[i - 1].y };
      }
    }
    if (entryPt) {
      const [ex, ey] = cm.toScreen(entryPt.x, entryPt.y);
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#34d399';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('入射点', ex, ey + 18);
    }
    if (exitPt) {
      const [ex, ey] = cm.toScreen(exitPt.x, exitPt.y);
      ctx.beginPath();
      ctx.arc(ex, ey, 6, 0, Math.PI * 2);
      ctx.strokeStyle = '#f472b6';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#f472b6';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('出射点', ex, ey + 18);
    }
    // If both found, draw chord and deflection angle
    if (entryPt && exitPt) {
      // Draw chord
      ctx.strokeStyle = 'rgba(52,211,153,0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      const [c1x, c1y] = cm.toScreen(entryPt.x, entryPt.y);
      const [c2x, c2y] = cm.toScreen(exitPt.x, exitPt.y);
      ctx.beginPath();
      ctx.moveTo(c1x, c1y);
      ctx.lineTo(c2x, c2y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Chord length
      const chordLen = Math.sqrt(
        (exitPt.x - entryPt.x) ** 2 + (exitPt.y - entryPt.y) ** 2
      );
      const midX = (entryPt.x + exitPt.x) / 2;
      const midY = (entryPt.y + exitPt.y) / 2;
      const [mx, my] = cm.toScreen(midX, midY);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`弦长=${chordLen.toFixed(2)}`, mx, my - 10);

      // Deflection angle: angle between entry velocity and exit velocity
      ctx.fillText(`几何关系: 弦长, 偏转角与半径 r 相关`, 20, 90);
    }

    // Draw trail
    ctx.shadowColor = 'rgba(96, 165, 250, 0.4)';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = 'rgba(96, 165, 250, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < trail.length; i++) {
      const [sx, sy] = cm.toScreen(trail[i].x, trail[i].y);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.stroke();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Draw particle
    const [ppx, ppy] = cm.toScreen(state.px, state.py);
    cm.drawBall(ppx, ppy, 8, '#fbbf24', { glow: true });

    arrows.draw(state.px, state.py, state.vx * 0.3, state.vy * 0.3, {
      color: ARROW_COLORS.velocity, label: 'v',
    });

    // Graph data
    timeData.push(state.t);
    const rDist = Math.sqrt(state.px ** 2 + state.py ** 2);
    rData.push(rDist);
    const max = 500;
    if (timeData.length > max) {
      timeData.splice(0, timeData.length - max);
      rData.splice(0, rData.length - max);
    }
    graph.setTraces([
      { x: timeData, y: rData, name: '径向距离 r', color: '#60a5fa' },
    ]);
  } else if (scene === '磁聚焦') {
    // === Magnetic Focusing Scene ===
    const B = panel.getValue<number>('B');
    const m = panel.getValue<number>('particleMass') * 1e-27;
    const q = panel.getValue<number>('particleCharge') * 1e-19;
    const v0 = panel.getValue<number>('particleV') * 1e6;
    const r = m * v0 / (q * B);

    // Draw B field indicators
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    for (let ix = -7; ix <= 7; ix += 2) {
      for (let iy = -4; iy <= 4; iy += 2) {
        const [sx2, sy2] = cm.toScreen(ix, iy);
        ctx.fillText('×', sx2, sy2);
      }
    }

    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`B = ${B} T (垂直纸面向里)`, 20, 30);
    ctx.fillText(`r = mv/(qB) = ${r.toExponential(2)} m`, 20, 50);
    ctx.fillText(`磁聚焦: 相同速率不同角度的粒子汇聚于同一点`, 20, 70);
    ctx.fillText(`T = 2πm/(qB), 半周期后所有粒子汇聚`, 20, 90);

    // Draw source point
    const [srcx, srcy] = cm.toScreen(-6, 0);
    cm.drawBall(srcx, srcy, 6, '#34d399', { glow: true });
    cm.drawText('源点', srcx, srcy + 20, { color: '#34d399', font: '12px -apple-system, BlinkMacSystemFont, sans-serif', align: 'center', bg: true });

    // Draw focus point (after semicircle, all particles converge)
    // For the 0-degree particle, focus is at distance = diameter = 2r along x
    // But in world coordinates, the focus point depends on the simulation scale
    // We'll mark it once particles have traveled enough
    const particleColors = ['#f87171', '#fb923c', '#fbbf24', '#34d399', '#60a5fa'];

    // Draw trails and particles for all focus particles
    if (focusParticles.length > 0) {
      for (let pi = 0; pi < focusParticles.length; pi++) {
        const p = focusParticles[pi];
        if (!focusTrails[pi]) focusTrails[pi] = [];
        focusTrails[pi].push({ x: p.px, y: p.py });
        if (focusTrails[pi].length > 2000) focusTrails[pi].shift();

        // Draw trail
        ctx.strokeStyle = particleColors[pi % particleColors.length];
        ctx.shadowColor = particleColors[pi % particleColors.length];
        ctx.shadowBlur = 4;
        ctx.globalAlpha = 0.5;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < focusTrails[pi].length; i++) {
          const [sx, sy] = cm.toScreen(focusTrails[pi][i].x, focusTrails[pi][i].y);
          if (i === 0) ctx.moveTo(sx, sy);
          else ctx.lineTo(sx, sy);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;

        // Draw particle
        const [ppx, ppy] = cm.toScreen(p.px, p.py);
        cm.drawBall(ppx, ppy, 6, particleColors[pi % particleColors.length], { glow: true });
      }

      // Check convergence: if particles are close together, mark focus point
      const xs = focusParticles.map(p => p.px);
      const ys = focusParticles.map(p => p.py);
      const avgX = xs.reduce((a, b) => a + b, 0) / xs.length;
      const avgY = ys.reduce((a, b) => a + b, 0) / ys.length;
      const spread = Math.max(
        Math.max(...xs) - Math.min(...xs),
        Math.max(...ys) - Math.min(...ys)
      );
      if (spread < 0.5 && state.t > 1) {
        const [fx, fy] = cm.toScreen(avgX, avgY);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(fx, fy, 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('聚焦点', fx, fy + 24);
      }
    }

    // Graph data
    timeData.push(state.t);
    const rDist = Math.sqrt(state.px ** 2 + state.py ** 2);
    rData.push(rDist);
    const max = 500;
    if (timeData.length > max) {
      timeData.splice(0, timeData.length - max);
      rData.splice(0, rData.length - max);
    }
    graph.setTraces([
      { x: timeData, y: rData, name: '径向距离 r', color: '#60a5fa' },
    ]);
  }

  graph.updateCurrentTime(state.t);
  graph.render();
  controls.updateTime(state.t);

  // Scene label
  cm.drawText(scene, cm.getWidth() - 20, 30, { color: '#e2e8f0', font: 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif', align: 'right', bg: true });
}

const sim = new SimLoop<EMState>({
  dt: 1 / 60,
  stepFn: createStepFn(),
  renderFn: renderScene,
  initialState: getInitialState(),
});

controls.onPlay = () => { sim.play(); controls.setPlaying(true); };
controls.onPause = () => { sim.pause(); controls.setPlaying(false); };
controls.onReset = () => {
  trail.length = 0; timeData.length = 0; rData.length = 0;
  focusParticles = []; focusTrails = [];
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
  controls.setPlaying(false);
};
controls.onStepForward = () => sim.stepForward();
controls.onStepBackward = () => sim.stepBackward();
controls.onSpeedChange = (s) => sim.setSpeed(s);

panel.setOnChange(() => {
  trail.length = 0; timeData.length = 0; rData.length = 0;
  focusParticles = []; focusTrails = [];
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
