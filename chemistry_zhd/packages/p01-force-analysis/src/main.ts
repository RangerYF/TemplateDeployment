import '@physics/core/styles.css';
import {
  createLayout,
  ParameterPanel,
  defineParams,
  CanvasManager,
  ArrowRenderer,
  ARROW_COLORS,
  GridRenderer,
  GRAVITY,
} from '@physics/core';

// ============================================================
// P-01 受力分析 — Force Analysis
// ============================================================

type SceneType = '水平面' | '斜面' | '悬挂' | '圆周运动' | '浮力' | '连接体' | '传送带' | '弹簧' | '杆模型';

interface ForceEntry {
  name: string;
  magnitude: number;
  directionDeg: number;
  color: string;
  wx: number; wy: number;
  dx: number; dy: number;
}

const g = GRAVITY;

// ---- Layout ----
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-01 受力分析');

// ---- Parameters ----
const paramDefs = defineParams([
  { key: 'scene', label: '场景选择', type: 'select', default: '水平面',
    options: ['水平面', '斜面', '悬挂', '圆周运动', '浮力', '连接体', '传送带', '弹簧', '杆模型'] },

  { key: 'mass', label: '质量 m', unit: 'kg', min: 0.5, max: 20, step: 0.5, default: 5,
    scenes: ['水平面', '斜面', '悬挂', '圆周运动', '连接体', '传送带', '弹簧', '杆模型'] },

  { key: 'appliedF', label: '施加力 F', unit: 'N', min: 0, max: 100, step: 1, default: 20,
    scenes: ['水平面'] },
  { key: 'appliedAngle', label: '力的角度 θ', unit: '°', min: -60, max: 60, step: 1, default: 30,
    scenes: ['水平面'] },
  { key: 'mu', label: '摩擦系数 μ', unit: '', min: 0, max: 1, step: 0.05, default: 0.3,
    scenes: ['水平面', '斜面'] },
  { key: 'motionState', label: '运动状态', type: 'select', default: '静止',
    options: ['静止', '匀速', '加速'],
    scenes: ['水平面', '斜面'] },
  { key: 'accel', label: '加速度 a', unit: 'm/s²', min: 0, max: 10, step: 0.1, default: 2,
    scenes: ['水平面', '斜面'] },

  { key: 'slopeAngle', label: '斜面角度 α', unit: '°', min: 5, max: 75, step: 1, default: 30,
    scenes: ['斜面', '连接体'] },

  { key: 'ropeAngle1', label: '绳1角度 θ₁', unit: '°', min: 0, max: 90, step: 1, default: 45,
    scenes: ['悬挂'] },
  { key: 'ropeAngle2', label: '绳2角度 θ₂', unit: '°', min: 0, max: 90, step: 1, default: 45,
    scenes: ['悬挂'] },

  { key: 'velocity', label: '速度 v', unit: 'm/s', min: 1, max: 20, step: 0.5, default: 5,
    scenes: ['圆周运动'] },
  { key: 'radius', label: '半径 R', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 2,
    scenes: ['圆周运动'] },

  { key: 'objDensity', label: '物体密度 ρ_物', unit: 'kg/m³', min: 100, max: 5000, step: 100, default: 800,
    scenes: ['浮力'] },
  { key: 'fluidDensity', label: '流体密度 ρ_液', unit: 'kg/m³', min: 500, max: 2000, step: 100, default: 1000,
    scenes: ['浮力'] },
  { key: 'volume', label: '体积 V', unit: 'dm³', min: 0.5, max: 10, step: 0.5, default: 2,
    scenes: ['浮力'] },

  { key: 'mass2', label: '质量 m₂', unit: 'kg', min: 0.5, max: 20, step: 0.5, default: 3,
    scenes: ['连接体'] },
  { key: 'connAppliedF', label: '施加力 F', unit: 'N', min: 0, max: 200, step: 1, default: 40,
    scenes: ['连接体'] },
  { key: 'connMu', label: '摩擦系数 μ', unit: '', min: 0, max: 1, step: 0.05, default: 0.2,
    scenes: ['连接体'] },
  { key: 'connSurface', label: '表面类型', type: 'select', default: '水平面',
    options: ['水平面', '光滑水平面', '斜面'],
    scenes: ['连接体'] },

  { key: 'beltVelocity', label: '传送带速度 v_带', unit: 'm/s', min: -10, max: 10, step: 0.5, default: 4,
    scenes: ['传送带'] },
  { key: 'blockV0', label: '物块初速度 v₀', unit: 'm/s', min: -10, max: 10, step: 0.5, default: 0,
    scenes: ['传送带'] },
  { key: 'beltMu', label: '摩擦系数 μ', unit: '', min: 0.05, max: 1, step: 0.05, default: 0.3,
    scenes: ['传送带'] },

  { key: 'springK', label: '弹簧常数 k', unit: 'N/m', min: 10, max: 500, step: 10, default: 100,
    scenes: ['弹簧'] },
  { key: 'springDisp', label: '形变量 x', unit: 'm', min: 0.01, max: 1, step: 0.01, default: 0.1,
    scenes: ['弹簧'] },
  { key: 'springState', label: '弹簧状态', type: 'select', default: '竖直悬挂',
    options: ['竖直悬挂', '水平压缩', '水平拉伸'],
    scenes: ['弹簧'] },

  { key: 'rodVelocity', label: '速度 v', unit: 'm/s', min: 0, max: 20, step: 0.5, default: 3,
    scenes: ['杆模型'] },
  { key: 'rodRadius', label: '半径 R', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 2,
    scenes: ['杆模型'] },
  { key: 'rodPosition', label: '位置', type: 'select', default: '最高点',
    options: ['最高点', '最低点'],
    scenes: ['杆模型'] },

  { key: 'showDecomp', label: '显示力的分解', type: 'checkbox', default: false },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);

// ---- Canvas ----
const cm = new CanvasManager({ container: layout.canvas });

function updateOrigin(): void {
  cm.setOrigin(cm.getWidth() / 2, cm.getHeight() * 0.6);
}
updateOrigin();
cm.setScale(55);

const arrows = new ArrowRenderer(cm);
const grid = new GridRenderer(cm);

// ---- Force table in bottom panel ----
const forceTableContainer = document.createElement('div');
forceTableContainer.style.cssText =
  'flex:1; overflow-y:auto; padding:12px 16px; font-size:15px; color:#e2e8f0; font-family:monospace;';
layout.bottomPanel.appendChild(forceTableContainer);

// ---- Animation state for circular/rod scenes ----
let animAngle = 0; // current angle on circle (radians, 0 = bottom)
let animRunning = false;
let lastAnimTime = 0;

// ---- Helpers ----
function deg2rad(d: number): number { return d * Math.PI / 180; }

function getScene(): SceneType {
  return panel.getValue<string>('scene') as SceneType;
}

const FORCE_SCALE = 0.03;

function forceArrow(
  name: string, mag: number, angleDeg: number, color: string,
  ox: number, oy: number,
): ForceEntry {
  const rad = deg2rad(angleDeg);
  const dx = mag * FORCE_SCALE * Math.cos(rad);
  const dy = mag * FORCE_SCALE * Math.sin(rad);
  return { name, magnitude: mag, directionDeg: angleDeg, color, wx: ox, wy: oy, dx, dy };
}

// ============================================================
// Label collision avoidance
// ============================================================

interface LabelRect { x: number; y: number; w: number; h: number; }

function resolveLabels(labels: LabelRect[]): void {
  const padding = 4;
  for (let iter = 0; iter < 50; iter++) {
    let moved = false;
    for (let i = 0; i < labels.length; i++) {
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i], b = labels[j];
        const overlapX = Math.min(a.x + a.w + padding, b.x + b.w + padding) - Math.max(a.x - padding, b.x - padding);
        const overlapY = Math.min(a.y + a.h + padding, b.y + b.h + padding) - Math.max(a.y - padding, b.y - padding);
        if (overlapX > 0 && overlapY > 0) {
          // Push apart along the axis with less overlap
          if (overlapY < overlapX) {
            const push = (overlapY / 2) + 3;
            if (a.y < b.y) { a.y -= push; b.y += push; }
            else { a.y += push; b.y -= push; }
          } else {
            const push = (overlapX / 2) + 3;
            if (a.x < b.x) { a.x -= push; b.x += push; }
            else { a.x += push; b.x -= push; }
          }
          moved = true;
        }
      }
    }
    if (!moved) break;
  }
}

// ============================================================
// Modern drawing helpers
// ============================================================

function drawBlock(
  cx: number, cy: number, halfW: number, halfH: number,
  label: string, rotation?: number
): void {
  cm.drawCrate(cx, cy, halfW, halfH, label, rotation);
}

function drawRope(x1: number, y1: number, x2: number, y2: number): void {
  cm.drawRope(x1, y1, x2, y2);
}

function drawSpringWorld(
  wx1: number, wy1: number, wx2: number, wy2: number,
  coils: number, amplitude: number, color: string
): void {
  cm.drawSpring(wx1, wy1, wx2, wy2, coils, amplitude, color);
}

function drawCircularTrack(cx: number, cy: number, R: number, highlight?: number): void {
  const ctx = cm.ctx;
  const [sx, sy] = cm.toScreen(cx, cy);
  const rPx = R * cm.getScale();

  ctx.save();

  // Outer ambient glow
  const ambGrad = ctx.createRadialGradient(sx, sy, rPx * 0.8, sx, sy, rPx * 1.3);
  ambGrad.addColorStop(0, 'rgba(100, 160, 220, 0.02)');
  ambGrad.addColorStop(0.5, 'rgba(100, 160, 220, 0.04)');
  ambGrad.addColorStop(1, 'rgba(100, 160, 220, 0)');
  ctx.fillStyle = ambGrad;
  ctx.beginPath();
  ctx.arc(sx, sy, rPx * 1.3, 0, Math.PI * 2);
  ctx.fill();

  // Track rail (double line with metallic look)
  const trackW = 6;
  ctx.strokeStyle = 'rgba(80, 100, 130, 0.35)';
  ctx.lineWidth = trackW;
  ctx.beginPath();
  ctx.arc(sx, sy, rPx, 0, Math.PI * 2);
  ctx.stroke();

  // Inner rail highlight
  ctx.strokeStyle = 'rgba(140, 170, 210, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(sx, sy, rPx - trackW / 2 + 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // Outer rail edge
  ctx.strokeStyle = 'rgba(140, 170, 210, 0.15)';
  ctx.beginPath();
  ctx.arc(sx, sy, rPx + trackW / 2 - 0.5, 0, Math.PI * 2);
  ctx.stroke();

  // Tick marks at cardinal points
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI * 2) / 12;
    const major = i % 3 === 0;
    const inner = rPx - (major ? 8 : 5);
    const outer = rPx + (major ? 8 : 5);
    ctx.lineWidth = major ? 1.5 : 0.8;
    ctx.beginPath();
    ctx.moveTo(sx + Math.cos(a) * inner, sy + Math.sin(a) * inner);
    ctx.lineTo(sx + Math.cos(a) * outer, sy + Math.sin(a) * outer);
    ctx.stroke();
  }

  // Center dot with glow
  ctx.shadowColor = 'rgba(100, 170, 255, 0.5)';
  ctx.shadowBlur = 6;
  ctx.fillStyle = 'rgba(120, 170, 240, 0.6)';
  ctx.beginPath();
  ctx.arc(sx, sy, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Center crosshair
  ctx.strokeStyle = 'rgba(255,255,255,0.1)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(sx - 12, sy); ctx.lineTo(sx + 12, sy);
  ctx.moveTo(sx, sy - 12); ctx.lineTo(sx, sy + 12);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.restore();
}

function drawInfoPanel(lines: string[], highlightLine?: number): void {
  const ctx = cm.ctx;
  const x = 16, startY = 24;
  const lineH = 24;
  const padding = 14;
  const totalH = lines.length * lineH + padding * 2;

  // Calculate max width
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  let maxW = 0;
  for (const line of lines) {
    maxW = Math.max(maxW, ctx.measureText(line).width);
  }
  const panelW = maxW + padding * 2 + 14;

  ctx.save();

  // Panel background with glassmorphism
  const bgGrad = ctx.createLinearGradient(x - padding, startY - padding, x - padding, startY + totalH);
  bgGrad.addColorStop(0, 'rgba(15, 25, 45, 0.92)');
  bgGrad.addColorStop(1, 'rgba(10, 18, 35, 0.88)');
  ctx.fillStyle = bgGrad;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, x - padding, startY - padding - 4, panelW, totalH, 10);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Border with subtle gradient
  const borderGrad = ctx.createLinearGradient(x - padding, startY - padding, x + panelW, startY + totalH);
  borderGrad.addColorStop(0, 'rgba(100, 160, 255, 0.2)');
  borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.08)');
  borderGrad.addColorStop(1, 'rgba(140, 100, 255, 0.15)');
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 1;
  roundRect(ctx, x - padding, startY - padding - 4, panelW, totalH, 10);
  ctx.stroke();

  // Top accent line
  ctx.strokeStyle = 'rgba(100, 170, 255, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - padding + 12, startY - padding - 3);
  ctx.lineTo(x - padding + panelW - 12, startY - padding - 3);
  ctx.stroke();

  // Lines
  ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    if (highlightLine !== undefined && i === highlightLine) {
      ctx.fillStyle = 'rgba(192, 132, 252, 0.95)';
    } else {
      ctx.fillStyle = 'rgba(220, 230, 245, 0.8)';
    }
    ctx.fillText(line, x, startY + i * lineH);
  });
  ctx.restore();
}

function drawAngleArc(
  cx: number, cy: number, startAngle: number, endAngle: number,
  radiusPx: number, label: string, color: string
): void {
  const ctx = cm.ctx;
  const [sx, sy] = cm.toScreen(cx, cy);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(sx, sy, radiusPx, -endAngle, -startAngle);
  ctx.stroke();

  const midAngle = (startAngle + endAngle) / 2;
  const lx = sx + (radiusPx + 14) * Math.cos(midAngle);
  const ly = sy - (radiusPx + 14) * Math.sin(midAngle);
  ctx.fillStyle = color;
  ctx.font = '13px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, lx, ly);
  ctx.restore();
}

// ============================================================
// Physics solvers
// ============================================================

function solveHorizontal(): ForceEntry[] {
  const m = panel.getValue<number>('mass');
  const F = panel.getValue<number>('appliedF');
  const theta = panel.getValue<number>('appliedAngle');
  const mu = panel.getValue<number>('mu');
  const state = panel.getValue<string>('motionState');
  const aInput = panel.getValue<number>('accel');

  const thetaRad = deg2rad(theta);
  const G = m * g;
  const Fx = F * Math.cos(thetaRad);
  const Fy = F * Math.sin(thetaRad);
  const N = Math.max(0, G - Fy);

  let friction = 0;
  if (state === '静止') {
    friction = Fx;
    const maxFriction = mu * N;
    if (friction > maxFriction) friction = maxFriction;
  } else if (state === '匀速') {
    friction = Fx;
  } else {
    const netForce = m * aInput;
    friction = Fx - netForce;
    if (friction < 0) friction = 0;
  }

  const ox = 0, oy = 0.55;
  const forces: ForceEntry[] = [];
  forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));
  forces.push(forceArrow('N (支持力)', N, 90, '#4ade80', ox, oy));
  if (F > 0) forces.push(forceArrow('F (施加力)', F, theta, '#60a5fa', ox, oy));
  if (Math.abs(friction) > 0.01) {
    forces.push(forceArrow('f (摩擦力)', Math.abs(friction), friction > 0 ? 180 : 0, '#fbbf24', ox, oy));
  }
  return forces;
}

function solveIncline(): ForceEntry[] {
  const m = panel.getValue<number>('mass');
  const alpha = panel.getValue<number>('slopeAngle');
  const mu = panel.getValue<number>('mu');
  const state = panel.getValue<string>('motionState');
  const aInput = panel.getValue<number>('accel');
  const alphaRad = deg2rad(alpha);
  const G = m * g;
  const Gpar = G * Math.sin(alphaRad);
  const Gperp = G * Math.cos(alphaRad);
  const N = Gperp;

  let friction = 0;
  if (state === '静止') {
    friction = Gpar;
    const maxF = mu * N;
    if (friction > maxF) friction = maxF;
  } else if (state === '匀速') {
    friction = Gpar;
  } else {
    const netAlongSlope = m * aInput;
    friction = Gpar - netAlongSlope;
    if (friction < 0) friction = 0;
  }

  const ox = 0, oy = 0.5;
  const forces: ForceEntry[] = [];
  forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));
  forces.push(forceArrow('N (支持力)', N, 90 + alpha, '#4ade80', ox, oy));
  if (Math.abs(friction) > 0.01) {
    forces.push(forceArrow('f (摩擦力)', Math.abs(friction), 180 - alpha, '#fbbf24', ox, oy));
  }
  return forces;
}

function solveSuspension(): ForceEntry[] {
  const m = panel.getValue<number>('mass');
  const theta1 = panel.getValue<number>('ropeAngle1');
  const theta2 = panel.getValue<number>('ropeAngle2');
  const G = m * g;
  const t1Rad = deg2rad(theta1);
  const t2Rad = deg2rad(theta2);
  const forces: ForceEntry[] = [];
  const ox = 0, oy = 0;

  forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));

  if (theta1 === 0 && theta2 === 0) {
    forces.push(forceArrow('T (绳拉力)', G, 90, '#60a5fa', ox, oy));
  } else {
    if (theta1 === 0) {
      forces.push(forceArrow('T₁ (绳1)', G, 90, '#60a5fa', ox, oy));
    } else if (theta2 === 0) {
      forces.push(forceArrow('T₁ (绳1)', G, 90, '#60a5fa', ox, oy));
    } else {
      const sinSum = Math.sin(t1Rad + t2Rad);
      const T1 = sinSum > 0.001 ? G * Math.sin(t2Rad) / sinSum : G / 2;
      const T2 = sinSum > 0.001 ? G * Math.sin(t1Rad) / sinSum : G / 2;
      forces.push(forceArrow('T₁ (绳1)', T1, 90 + theta1, '#60a5fa', ox, oy));
      forces.push(forceArrow('T₂ (绳2)', T2, 90 - theta2, '#c084fc', ox, oy));
    }
  }
  return forces;
}

function solveCircular(posAngle: number): ForceEntry[] {
  const m = panel.getValue<number>('mass');
  const v = panel.getValue<number>('velocity');
  const R = panel.getValue<number>('radius');
  const G = m * g;
  const Fc = m * v * v / R;

  // posAngle: 0=bottom, PI/2=right, PI=top, 3PI/2=left (measured from bottom, CCW)
  // At any point, the centripetal direction is toward center
  // The normal force direction is also toward center (for a track)

  // Radial direction toward center (in standard math angle):
  // Object is at angle posAngle from bottom of circle
  // Object world position: (R*sin(posAngle), -R*cos(posAngle)) relative to center at (0,0)
  // Direction toward center: opposite of object position
  const objAngle = posAngle; // 0=bottom
  const towardCenterDeg = 90 + (objAngle * 180 / Math.PI); // degree angle pointing toward center

  // Gravity component along radial (toward center is positive)
  const gravRadial = G * Math.cos(objAngle); // component along radial toward center
  // At bottom: cos(0) = 1, gravity component toward center = -G (away from center), so N > G
  // At top: cos(PI) = -1, gravity component toward center = G (toward center)

  const forces: ForceEntry[] = [];
  const ox = R * Math.sin(objAngle);
  const oy = -R * Math.cos(objAngle);

  forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));

  // Simplified: compute N based on position
  // At angle θ from bottom: N - Gcosθ = mv²/R (where θ=0 is bottom)
  // Hmm, this gets complex for arbitrary angles. Let's keep it simple for the 3 positions:
  if (Math.abs(objAngle) < 0.01 || Math.abs(objAngle - 2 * Math.PI) < 0.01) {
    // Bottom: N - G = Fc => N = G + Fc
    const N = G + Fc;
    forces.push(forceArrow('N (支持力)', N, 90, '#4ade80', ox, oy));
  } else if (Math.abs(objAngle - Math.PI) < 0.01) {
    // Top: G + N = Fc (if track) or G - N = Fc (if support from outside)
    const N = Math.max(0, Fc - G);
    if (N > 0.01) forces.push(forceArrow('N (支持力)', N, -90, '#4ade80', ox, oy));
  } else if (Math.abs(objAngle - Math.PI / 2) < 0.1) {
    // Right side: N points left (toward center)
    const N = Fc;
    forces.push(forceArrow('N (支持力)', N, 180, '#4ade80', ox, oy));
  } else if (Math.abs(objAngle - 3 * Math.PI / 2) < 0.1) {
    // Left side: N points right (toward center)
    const N = Fc;
    forces.push(forceArrow('N (支持力)', N, 0, '#4ade80', ox, oy));
  }

  return forces;
}

function solveBuoyancy(): ForceEntry[] {
  const rhoObj = panel.getValue<number>('objDensity');
  const rhoFluid = panel.getValue<number>('fluidDensity');
  const Vdm3 = panel.getValue<number>('volume');
  const V = Vdm3 / 1000;
  const G = rhoObj * V * g;
  let Vsub: number;
  if (rhoObj >= rhoFluid) { Vsub = V; } else { Vsub = V * rhoObj / rhoFluid; }
  const Fb = rhoFluid * Vsub * g;

  const ox = 0, oy = 0;
  const forces: ForceEntry[] = [];
  forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));
  forces.push(forceArrow('F_浮 (浮力)', Fb, 90, '#60a5fa', ox, oy));
  if (rhoObj >= rhoFluid) {
    const net = G - Fb;
    if (net > 0.01) forces.push(forceArrow('F_net (合力↓)', net, -90, '#c084fc', ox, oy));
  }
  return forces;
}

function solveConnectedBodies(): ForceEntry[] {
  const m1 = panel.getValue<number>('mass');
  const m2 = panel.getValue<number>('mass2');
  const F = panel.getValue<number>('connAppliedF');
  const mu = panel.getValue<number>('connMu');
  const surface = panel.getValue<string>('connSurface');
  const G1 = m1 * g, G2 = m2 * g;
  const forces: ForceEntry[] = [];

  const ox1 = -1.8, oy1 = 0.5;
  const ox2 = 1.8, oy2 = 0.5;

  if (surface === '斜面') {
    const alpha = panel.getValue<number>('slopeAngle');
    const alphaRad = deg2rad(alpha);
    const N1 = G1 * Math.cos(alphaRad), N2 = G2 * Math.cos(alphaRad);
    const f1 = mu * N1, f2 = mu * N2;
    const Gp1 = G1 * Math.sin(alphaRad), Gp2 = G2 * Math.sin(alphaRad);
    const aSystem = (F - Gp1 - Gp2 - f1 - f2) / (m1 + m2);
    const T = m1 * aSystem + Gp1 + f1;

    forces.push(forceArrow('G₁', G1, -90, '#f87171', ox1, oy1));
    forces.push(forceArrow('N₁', N1, 90 + alpha, '#4ade80', ox1, oy1));
    if (Math.abs(f1) > 0.01) forces.push(forceArrow('f₁', f1, 180 - alpha, '#fbbf24', ox1, oy1));
    if (Math.abs(T) > 0.01) forces.push(forceArrow('T', Math.abs(T), T >= 0 ? -alpha : 180 - alpha, '#c084fc', ox1, oy1));

    forces.push(forceArrow('G₂', G2, -90, '#f87171', ox2, oy2));
    forces.push(forceArrow('N₂', N2, 90 + alpha, '#4ade80', ox2, oy2));
    if (Math.abs(f2) > 0.01) forces.push(forceArrow('f₂', f2, 180 - alpha, '#fbbf24', ox2, oy2));
    if (F > 0.01) forces.push(forceArrow('F', F, -alpha, '#60a5fa', ox2, oy2));
    if (Math.abs(T) > 0.01) forces.push(forceArrow("T'", Math.abs(T), T >= 0 ? 180 - alpha : -alpha, '#c084fc', ox2, oy2));
  } else {
    const muEff = surface === '光滑水平面' ? 0 : mu;
    const f1 = muEff * G1, f2 = muEff * G2;
    const aSystem = (F - f1 - f2) / (m1 + m2);
    const T = m1 * aSystem + f1;

    forces.push(forceArrow('G₁', G1, -90, '#f87171', ox1, oy1));
    forces.push(forceArrow('N₁', G1, 90, '#4ade80', ox1, oy1));
    if (Math.abs(f1) > 0.01) forces.push(forceArrow('f₁', f1, 180, '#fbbf24', ox1, oy1));
    if (Math.abs(T) > 0.01) forces.push(forceArrow('T', Math.abs(T), T >= 0 ? 0 : 180, '#c084fc', ox1, oy1));

    forces.push(forceArrow('G₂', G2, -90, '#f87171', ox2, oy2));
    forces.push(forceArrow('N₂', G2, 90, '#4ade80', ox2, oy2));
    if (Math.abs(f2) > 0.01) forces.push(forceArrow('f₂', f2, 180, '#fbbf24', ox2, oy2));
    if (F > 0.01) forces.push(forceArrow('F', F, 0, '#60a5fa', ox2, oy2));
    if (Math.abs(T) > 0.01) forces.push(forceArrow("T'", Math.abs(T), T >= 0 ? 180 : 0, '#c084fc', ox2, oy2));
  }
  return forces;
}

function solveConveyorBelt(): ForceEntry[] {
  const m = panel.getValue<number>('mass');
  const vBelt = panel.getValue<number>('beltVelocity');
  const v0 = panel.getValue<number>('blockV0');
  const mu = panel.getValue<number>('beltMu');
  const G = m * g;
  const ox = 0, oy = 0.5;
  const forces: ForceEntry[] = [];

  forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));
  forces.push(forceArrow('N (支持力)', G, 90, '#4ade80', ox, oy));

  const vRel = v0 - vBelt;
  if (Math.abs(vRel) > 0.01) {
    const fMag = mu * G;
    forces.push(forceArrow('f (摩擦力)', fMag, vRel > 0 ? 180 : 0, '#fbbf24', ox, oy));
  }
  return forces;
}

function solveSpring(): ForceEntry[] {
  const m = panel.getValue<number>('mass');
  const k = panel.getValue<number>('springK');
  const xDisp = panel.getValue<number>('springDisp');
  const state = panel.getValue<string>('springState');
  const G = m * g;
  const forces: ForceEntry[] = [];

  if (state === '竖直悬挂') {
    const x0 = G / k;
    const Fspring = k * x0;
    const ox = 0, oy = 0;
    forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));
    forces.push(forceArrow('F_弹 (弹力)', Fspring, 90, '#60a5fa', ox, oy));
  } else if (state === '水平压缩') {
    const Fspring = k * xDisp;
    const ox = 0.5, oy = 0.5;
    forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));
    forces.push(forceArrow('N (支持力)', G, 90, '#4ade80', ox, oy));
    forces.push(forceArrow('F_弹 (弹力)', Fspring, 0, '#60a5fa', ox, oy));
  } else {
    const Fspring = k * xDisp;
    const ox = 0.5, oy = 0.5;
    forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));
    forces.push(forceArrow('N (支持力)', G, 90, '#4ade80', ox, oy));
    forces.push(forceArrow('F_弹 (弹力)', Fspring, 180, '#60a5fa', ox, oy));
  }
  return forces;
}

function solveRod(): ForceEntry[] {
  const m = panel.getValue<number>('mass');
  const v = panel.getValue<number>('rodVelocity');
  const R = panel.getValue<number>('rodRadius');
  const pos = panel.getValue<string>('rodPosition');
  const G = m * g;
  const Fc = m * v * v / R;
  const ox = 0, oy = pos === '最高点' ? R : -R;
  const forces: ForceEntry[] = [];

  forces.push(forceArrow('G (重力)', G, -90, '#f87171', ox, oy));

  if (pos === '最高点') {
    const Nval = Fc - G;
    if (Math.abs(Nval) > 0.01) {
      if (Nval >= 0) {
        forces.push(forceArrow('N (杆拉力↓)', Math.abs(Nval), -90, '#4ade80', ox, oy));
      } else {
        forces.push(forceArrow('N (杆支持力↑)', Math.abs(Nval), 90, '#4ade80', ox, oy));
      }
    }
  } else {
    const N = G + Fc;
    forces.push(forceArrow('N (杆支持力↑)', N, 90, '#4ade80', ox, oy));
  }
  return forces;
}

// ============================================================
// Scene Rendering
// ============================================================

function drawSceneBackground(scene: SceneType): void {
  const ctx = cm.ctx;

  switch (scene) {
    case '水平面': {
      cm.drawTexturedGround(-5, 5, 0, 'concrete');
      drawBlock(0, 0.55, 0.5, 0.5, 'm');
      break;
    }

    case '斜面': {
      const alpha = panel.getValue<number>('slopeAngle');
      const alphaRad = deg2rad(alpha);
      const slopeLen = 4.5;

      // Use core incline renderer
      cm.drawIncline(0, 0, slopeLen, alphaRad, 'concrete');

      // Ground
      cm.drawTexturedGround(-1, slopeLen * Math.cos(alphaRad) + 1, 0);

      // Angle arc
      drawAngleArc(0, 0, 0, alphaRad, 35, `α=${alpha}°`, 'rgba(255,255,255,0.5)');

      // Object on slope
      const midS = 2.0;
      const objCx = midS * Math.cos(alphaRad);
      const objCy = midS * Math.sin(alphaRad);
      drawBlock(objCx, objCy + 0.35, 0.35, 0.35, 'm', alphaRad);
      break;
    }

    case '悬挂': {
      const theta1 = panel.getValue<number>('ropeAngle1');
      const theta2 = panel.getValue<number>('ropeAngle2');
      const t1Rad = deg2rad(theta1);
      const t2Rad = deg2rad(theta2);

      // Ceiling
      cm.drawTexturedGround(-3, 3, 2.5, 'concrete');

      // Object
      cm.drawBall(0, 0, 22, '#60a5fa', { label: 'm' });

      // Ropes
      if (theta1 === 0 && theta2 === 0) {
        drawRope(0, 0.35, 0, 2.5);
      } else {
        const ropeLen = 2.5;
        const r1x = -ropeLen * Math.sin(t1Rad);
        const r1y = ropeLen * Math.cos(t1Rad);
        const r2x = ropeLen * Math.sin(t2Rad);
        const r2y = ropeLen * Math.cos(t2Rad);
        drawRope(0, 0, r1x, r1y);
        drawRope(0, 0, r2x, r2y);

        // Anchor dots
        const [a1x, a1y] = cm.toScreen(r1x, r1y);
        const [a2x, a2y] = cm.toScreen(r2x, r2y);
        ctx.fillStyle = 'rgba(100, 116, 139, 0.7)';
        ctx.beginPath(); ctx.arc(a1x, a1y, 4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(a2x, a2y, 4, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }

    case '圆周运动': {
      const R = panel.getValue<number>('radius');
      const v = panel.getValue<number>('velocity');

      // Dynamic origin: center the track
      cm.setOrigin(cm.getWidth() / 2, cm.getHeight() / 2);

      drawCircularTrack(0, 0, R);

      // Animated object position
      const objX = R * Math.sin(animAngle);
      const objY = -R * Math.cos(animAngle);

      // Radius line
      cm.drawLine(0, 0, objX, objY, 'rgba(255,255,255,0.15)', 1, true);

      // Object
      cm.drawBall(objX, objY, 18, '#60a5fa', { label: 'm' });

      // Velocity arrow (tangential, CCW)
      const tangentAngle = animAngle + Math.PI / 2; // perpendicular to radius, CCW
      const vScale = 0.015;
      const vdx = v * vScale * Math.cos(tangentAngle);
      const vdy = -v * vScale * Math.sin(tangentAngle); // note: world y is up
      // Convert to world properly
      const vWorldDx = v * vScale * Math.sin(animAngle + Math.PI / 2);
      const vWorldDy = -v * vScale * Math.cos(animAngle + Math.PI / 2);
      // Simpler: tangent direction in world coords
      const tx = Math.cos(animAngle); // tangent x (world)
      const ty = Math.sin(animAngle); // tangent y (world) — but world y is up...
      // At animAngle=0 (bottom), tangent should be rightward: tx=1, ty=0 — cos(0)=1 ok
      // At animAngle=PI/2 (right), tangent should be upward: tx=0, ty=1 — cos(PI/2)=0, sin(PI/2)=1 ok
      arrows.draw(objX, objY, v * vScale * Math.cos(animAngle), v * vScale * Math.sin(animAngle), {
        color: ARROW_COLORS.velocity,
        label: `v = ${v.toFixed(1)} m/s`,
        labelOffset: 22,
      });

      // Center label
      cm.drawText('O', 0, 0, { color: 'rgba(148,163,184,0.6)', offsetX: 10, offsetY: -10 });
      break;
    }

    case '浮力': {
      const rhoObj = panel.getValue<number>('objDensity');
      const rhoFluid = panel.getValue<number>('fluidDensity');
      const waterTop = 1;

      // Water body using core method
      cm.drawWater(-5, 5, waterTop, -3, Date.now() * 0.001);

      // Object
      const halfW = 0.5, halfH = 0.5;
      const subFrac = rhoObj >= rhoFluid ? 1 : rhoObj / rhoFluid;
      const objBottom = waterTop - subFrac * (2 * halfH);
      const objCenterY = objBottom + halfH;

      drawBlock(0, objCenterY + halfH, halfW, halfH, 'm');

      cm.drawText(`浸没: ${(subFrac * 100).toFixed(0)}%`, halfW + 0.3, objCenterY, {
        color: '#94a3b8', font: '12px -apple-system, sans-serif', bg: true
      });
      cm.drawText(`ρ_液 = ${rhoFluid} kg/m³`, -3, -1.5, {
        color: '#3b82f6', font: '13px -apple-system, sans-serif', bg: true
      });
      break;
    }

    case '连接体': {
      const surface = panel.getValue<string>('connSurface');

      // Adjust origin for this scene to have more room
      cm.setOrigin(cm.getWidth() / 2, cm.getHeight() * 0.65);

      if (surface === '斜面') {
        const alpha = panel.getValue<number>('slopeAngle');
        const alphaRad = deg2rad(alpha);
        const slopeLen = 5.5;

        cm.drawIncline(-0.5, 0, slopeLen, alphaRad, 'concrete');
        cm.drawTexturedGround(-1.5, slopeLen * Math.cos(alphaRad), 0);

        const mid1 = 1.5, mid2 = 3.2;
        for (const [midS, label] of [[mid1, 'm₁'], [mid2, 'm₂']] as [number, string][]) {
          const cx = (midS - 0.5) * Math.cos(alphaRad);
          const cy = (midS - 0.5) * Math.sin(alphaRad);
          drawBlock(cx, cy + 0.3, 0.3, 0.3, label, alphaRad);
        }

        // Rope
        const r1x = mid1 * Math.cos(alphaRad);
        const r1y = mid1 * Math.sin(alphaRad);
        const r2x = (mid2 - 1) * Math.cos(alphaRad);
        const r2y = (mid2 - 1) * Math.sin(alphaRad);
        drawRope(r1x, r1y, r2x, r2y);
      } else {
        cm.drawTexturedGround(-4, 4, 0, 'concrete');
        drawBlock(-1.8, 0.5, 0.45, 0.45, 'm₁');
        drawBlock(1.8, 0.5, 0.45, 0.45, 'm₂');
        drawRope(-1.35, 0.5, 1.35, 0.5);
      }
      break;
    }

    case '传送带': {
      const vBelt = panel.getValue<number>('beltVelocity');
      const v0 = panel.getValue<number>('blockV0');

      // === Modern Conveyor Belt ===
      const beltLeft = -4.5, beltRight = 4.5;
      const beltTop = 0, beltBottom = -0.6;
      const rollerR = 0.35;

      // Belt body with metallic gradient
      const [bsx1, bsy1] = cm.toScreen(beltLeft + rollerR, beltTop);
      const [bsx2, bsy2] = cm.toScreen(beltRight - rollerR, beltBottom);
      const beltGrad = ctx.createLinearGradient(bsx1, bsy1, bsx1, bsy2);
      beltGrad.addColorStop(0, 'rgba(80, 80, 95, 0.95)');
      beltGrad.addColorStop(0.3, 'rgba(55, 55, 65, 0.95)');
      beltGrad.addColorStop(0.7, 'rgba(40, 40, 50, 0.95)');
      beltGrad.addColorStop(1, 'rgba(30, 30, 38, 0.95)');
      ctx.fillStyle = beltGrad;
      roundRect(ctx, bsx1, bsy1, bsx2 - bsx1, bsy2 - bsy1, 3);
      ctx.fill();

      // Belt surface texture: animated rubber strips
      const stripCount = 20;
      const bw = bsx2 - bsx1;
      const stripSpacing = bw / stripCount;
      const animOffset = (Date.now() * 0.04 * Math.abs(vBelt) / 4) % stripSpacing;
      const stripDir = vBelt >= 0 ? 1 : -1;
      ctx.strokeStyle = 'rgba(100, 100, 120, 0.4)';
      ctx.lineWidth = 1;
      for (let i = -1; i < stripCount + 2; i++) {
        const x = bsx1 + i * stripSpacing + animOffset * stripDir;
        if (x < bsx1 || x > bsx2) continue;
        ctx.beginPath();
        ctx.moveTo(x, bsy1 + 2);
        ctx.lineTo(x, bsy2 - 2);
        ctx.stroke();
      }

      // Top surface highlight (rubber sheen)
      const sheenGrad = ctx.createLinearGradient(bsx1, bsy1, bsx2, bsy1);
      sheenGrad.addColorStop(0, 'transparent');
      sheenGrad.addColorStop(0.3, 'rgba(255,255,255,0.04)');
      sheenGrad.addColorStop(0.5, 'rgba(255,255,255,0.08)');
      sheenGrad.addColorStop(0.7, 'rgba(255,255,255,0.04)');
      sheenGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = sheenGrad;
      ctx.fillRect(bsx1, bsy1, bsx2 - bsx1, 3);

      // Belt border
      ctx.strokeStyle = 'rgba(120, 120, 140, 0.5)';
      ctx.lineWidth = 1.5;
      roundRect(ctx, bsx1, bsy1, bsx2 - bsx1, bsy2 - bsy1, 3);
      ctx.stroke();

      // Rollers with metallic gradient and spinning spokes
      for (const wx of [beltLeft, beltRight]) {
        const [rx, ry] = cm.toScreen(wx, (beltTop + beltBottom) / 2);
        const rPx = rollerR * cm.getScale();

        // Roller shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.4)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;

        // Roller body metallic
        const rollerGrad = ctx.createRadialGradient(rx - rPx * 0.2, ry - rPx * 0.2, rPx * 0.1, rx, ry, rPx);
        rollerGrad.addColorStop(0, '#8a8a9a');
        rollerGrad.addColorStop(0.5, '#5a5a6a');
        rollerGrad.addColorStop(1, '#3a3a4a');
        ctx.beginPath();
        ctx.arc(rx, ry, rPx, 0, Math.PI * 2);
        ctx.fillStyle = rollerGrad;
        ctx.fill();
        ctx.restore();

        // Roller spokes (animated rotation)
        const spokeAngle = (Date.now() * 0.002 * vBelt) % (Math.PI * 2);
        ctx.strokeStyle = 'rgba(150,150,170,0.3)';
        ctx.lineWidth = 1;
        for (let s = 0; s < 4; s++) {
          const a = spokeAngle + s * Math.PI / 2;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + Math.cos(a) * rPx * 0.7, ry + Math.sin(a) * rPx * 0.7);
          ctx.stroke();
        }

        // Roller rim
        ctx.strokeStyle = 'rgba(130, 130, 150, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(rx, ry, rPx, 0, Math.PI * 2);
        ctx.stroke();

        // Specular highlight
        ctx.beginPath();
        ctx.ellipse(rx - rPx * 0.25, ry - rPx * 0.25, rPx * 0.3, rPx * 0.15, -0.5, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fill();

        // Center axle
        ctx.beginPath();
        ctx.arc(rx, ry, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a35';
        ctx.fill();
      }

      // Support legs
      ctx.strokeStyle = 'rgba(100, 100, 115, 0.6)';
      ctx.lineWidth = 3;
      for (const wx of [beltLeft + 0.8, beltRight - 0.8]) {
        const [lx, ly] = cm.toScreen(wx, beltBottom);
        const [, ly2] = cm.toScreen(wx, beltBottom - 1.5);
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx, ly2);
        ctx.stroke();
        // Foot
        ctx.beginPath();
        ctx.moveTo(lx - 6, ly2);
        ctx.lineTo(lx + 6, ly2);
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 3;
      }

      // Animated belt direction arrows (glowing)
      const arrowCount = 6;
      const arrowSpacing = (beltRight - beltLeft - 2 * rollerR) / arrowCount;
      const arrowAnimOffset = (Date.now() * 0.001 * vBelt) % arrowSpacing;
      for (let i = 0; i < arrowCount; i++) {
        const awx = beltLeft + rollerR + 0.3 + i * arrowSpacing + arrowAnimOffset;
        if (awx < beltLeft + rollerR || awx > beltRight - rollerR) continue;
        const [ax, ay] = cm.toScreen(awx, (beltTop + beltBottom) / 2);
        const alpha = 0.25 + 0.15 * Math.sin(Date.now() * 0.003 + i);
        ctx.fillStyle = `rgba(96, 165, 250, ${alpha})`;
        ctx.beginPath();
        if (vBelt >= 0) {
          ctx.moveTo(ax - 6, ay - 5);
          ctx.lineTo(ax + 6, ay);
          ctx.lineTo(ax - 6, ay + 5);
        } else {
          ctx.moveTo(ax + 6, ay - 5);
          ctx.lineTo(ax - 6, ay);
          ctx.lineTo(ax + 6, ay + 5);
        }
        ctx.fill();
      }

      // Belt velocity label with glass pill
      cm.drawText(`v_带 = ${vBelt.toFixed(1)} m/s`, 0, beltBottom - 0.7, {
        color: '#94a3b8', font: '13px -apple-system, sans-serif', bg: true, align: 'center'
      });

      // Block sitting ON belt surface (bottom of block at beltTop)
      const blockHalf = 0.5;
      drawBlock(0, beltTop + blockHalf, blockHalf, blockHalf, 'm');

      // Block velocity label
      if (Math.abs(v0) > 0.01) {
        cm.drawText(`v₀ = ${v0.toFixed(1)} m/s`, 0, beltTop + blockHalf * 2 + 0.4, {
          color: '#94a3b8', font: '13px -apple-system, sans-serif', bg: true, align: 'center'
        });
      }
      break;
    }

    case '弹簧': {
      const state = panel.getValue<string>('springState');
      const k = panel.getValue<number>('springK');
      const m = panel.getValue<number>('mass');
      const xDisp = panel.getValue<number>('springDisp');
      const x0 = m * g / k;

      if (state === '竖直悬挂') {
        // Ceiling - draw as a wall segment at the top
        cm.drawTexturedGround(-2, 2, 3, 'concrete');

        const springTop = 3;
        const springBottom = x0 > 2 ? 0.5 : 3 - x0 - 0.5;
        drawSpringWorld(0, springTop, 0, springBottom, 10, 14, '#60a5fa');

        // Extension label
        cm.drawText(`x₀ = ${x0.toFixed(3)} m`, 0.8, (springTop + springBottom) / 2, {
          color: '#94a3b8', font: '12px -apple-system, sans-serif', bg: true
        });

        // Equilibrium dashed line
        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.setLineDash([4, 4]);
        ctx.lineWidth = 1;
        const [eqx1, eqy] = cm.toScreen(-1.5, springBottom);
        const [eqx2] = cm.toScreen(1.5, springBottom);
        ctx.beginPath();
        ctx.moveTo(eqx1, eqy);
        ctx.lineTo(eqx2, eqy);
        ctx.stroke();
        ctx.setLineDash([]);

        cm.drawBall(0, springBottom - 0.4, 22, '#60a5fa', { label: 'm' });
      } else {
        const isCompressed = state === '水平压缩';
        cm.drawTexturedGround(-4, 4, 0, 'concrete');

        // Wall
        cm.drawWall(-2, 0, 1.5, 'left');

        const springLeft = -2;
        const springRight = isCompressed ? 0 : 1;
        drawSpringWorld(springLeft, 0.5, springRight, 0.5, 10, 12, '#60a5fa');

        const blockLeft = springRight;
        drawBlock(blockLeft + 0.5, 0.5, 0.45, 0.45, 'm');

        cm.drawText(isCompressed ? '压缩' : '拉伸', (springLeft + springRight) / 2, 1.3, {
          color: '#94a3b8', font: '12px -apple-system, sans-serif', bg: true
        });
        cm.drawText(`F_弹 = kx = ${(k * xDisp).toFixed(1)} N`, (springLeft + springRight) / 2, 1.0, {
          color: '#94a3b8', font: '12px -apple-system, sans-serif', bg: true
        });
      }
      break;
    }

    case '杆模型': {
      const R = panel.getValue<number>('rodRadius');
      const pos = panel.getValue<string>('rodPosition');
      const v = panel.getValue<number>('rodVelocity');
      const vCritical = Math.sqrt(g * R);

      cm.setOrigin(cm.getWidth() / 2, cm.getHeight() / 2);

      drawCircularTrack(0, 0, R);

      const objWy = pos === '最高点' ? R : -R;

      // Rod
      const [obx, oby] = cm.toScreen(0, objWy);
      const [ccx, ccy] = cm.toScreen(0, 0);
      ctx.save();
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.6)';
      ctx.lineWidth = 3;
      ctx.shadowColor = '#a78bfa';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.moveTo(ccx, ccy);
      ctx.lineTo(obx, oby);
      ctx.stroke();
      ctx.restore();

      cm.drawText('轻杆', 0, objWy / 2, {
        color: '#a78bfa', offsetX: 18, font: '12px -apple-system, sans-serif', bg: true
      });

      cm.drawBall(0, objWy, 18, '#60a5fa', { label: 'm' });

      // Velocity arrow
      const vAngle = pos === '最高点' ? 180 : 0;
      const vScale = 0.015;
      if (v > 0.01) {
        arrows.draw(0, objWy,
          v * vScale * Math.cos(deg2rad(vAngle)),
          v * vScale * Math.sin(deg2rad(vAngle)),
          { color: ARROW_COLORS.velocity, label: `v = ${v.toFixed(1)} m/s`, labelOffset: 22 }
        );
      }
      break;
    }
  }
}

function getForceOrigin(scene: SceneType): [number, number] {
  switch (scene) {
    case '水平面': return [0, 0.5];
    case '斜面': {
      const alpha = deg2rad(panel.getValue<number>('slopeAngle'));
      const midS = 2.0;
      return [midS * Math.cos(alpha), midS * Math.sin(alpha) + 0.35];
    }
    case '悬挂': return [0, 0];
    case '圆周运动': {
      const R = panel.getValue<number>('radius');
      return [R * Math.sin(animAngle), -R * Math.cos(animAngle)];
    }
    case '浮力': {
      const rhoObj = panel.getValue<number>('objDensity');
      const rhoFluid = panel.getValue<number>('fluidDensity');
      const waterTop = 1;
      const subFrac = rhoObj >= rhoFluid ? 1 : rhoObj / rhoFluid;
      const objBottom = waterTop - subFrac * 1;
      return [0, objBottom + 0.5];
    }
    case '连接体': return [0, 0.5];
    case '传送带': return [0, 0.5];
    case '弹簧': {
      const state = panel.getValue<string>('springState');
      if (state === '竖直悬挂') {
        const k = panel.getValue<number>('springK');
        const m = panel.getValue<number>('mass');
        const x0 = m * g / k;
        const springBottom = x0 > 2 ? 0.5 : 3 - x0 - 0.5;
        return [0, springBottom - 0.4];
      }
      return [1, 0.5];
    }
    case '杆模型': {
      const R = panel.getValue<number>('rodRadius');
      const pos = panel.getValue<string>('rodPosition');
      return [0, pos === '最高点' ? R : -R];
    }
  }
}

function solveForces(): ForceEntry[] {
  const scene = getScene();
  let forces: ForceEntry[];

  switch (scene) {
    case '水平面': forces = solveHorizontal(); break;
    case '斜面': forces = solveIncline(); break;
    case '悬挂': forces = solveSuspension(); break;
    case '圆周运动': forces = solveCircular(animAngle); break;
    case '浮力': forces = solveBuoyancy(); break;
    case '连接体': forces = solveConnectedBodies(); break;
    case '传送带': forces = solveConveyorBelt(); break;
    case '弹簧': forces = solveSpring(); break;
    case '杆模型': forces = solveRod(); break;
    default: forces = [];
  }

  if (scene !== '连接体') {
    const [ox, oy] = getForceOrigin(scene);
    for (const f of forces) { f.wx = ox; f.wy = oy; }
  }
  return forces;
}

// ============================================================
// Draw force arrows with smart label placement
// ============================================================

function drawForceArrows(forces: ForceEntry[], showDecomp: boolean, scene: SceneType): void {
  const ctx = cm.ctx;

  // First pass: collect label positions
  const labelInfos: { force: ForceEntry; label: string; rect: LabelRect; tipSx: number; tipSy: number }[] = [];

  for (const f of forces) {
    if (Math.abs(f.magnitude) < 0.01) continue;

    // Draw the arrow itself (no label yet)
    if (showDecomp && scene === '斜面') {
      const alpha = deg2rad(panel.getValue<number>('slopeAngle'));
      const parAngle = 180 - panel.getValue<number>('slopeAngle');
      const perpAngle = 90 + panel.getValue<number>('slopeAngle');
      const fAngleRad = deg2rad(f.directionDeg);
      const parAxisRad = deg2rad(parAngle);
      const perpAxisRad = deg2rad(perpAngle);
      const fVecX = Math.cos(fAngleRad), fVecY = Math.sin(fAngleRad);
      const parX = Math.cos(parAxisRad), parY = Math.sin(parAxisRad);
      const perpX = Math.cos(perpAxisRad), perpY = Math.sin(perpAxisRad);
      const parComp = f.magnitude * (fVecX * parX + fVecY * parY);
      const perpComp = f.magnitude * (fVecX * perpX + fVecY * perpY);

      arrows.draw(f.wx, f.wy, f.dx, f.dy, { color: f.color, lineWidth: 2.5 });

      if (f.name.includes('G') && Math.abs(parComp) > 0.1 && Math.abs(perpComp) > 0.1) {
        arrows.draw(f.wx, f.wy, parComp * FORCE_SCALE * parX, parComp * FORCE_SCALE * parY, {
          color: f.color, dashed: true, lineWidth: 1.5,
        });
        arrows.draw(f.wx, f.wy, perpComp * FORCE_SCALE * perpX, perpComp * FORCE_SCALE * perpY, {
          color: f.color, dashed: true, lineWidth: 1.5,
        });
      }
    } else if (showDecomp) {
      arrows.draw(f.wx, f.wy, f.dx, f.dy, { color: f.color, lineWidth: 2.5 });
      if (Math.abs(f.dx) > 0.001) {
        arrows.draw(f.wx, f.wy, f.dx, 0, { color: f.color, dashed: true, lineWidth: 1.5, glow: false });
      }
      if (Math.abs(f.dy) > 0.001) {
        arrows.draw(f.wx + f.dx, f.wy, 0, f.dy, { color: f.color, dashed: true, lineWidth: 1.5, glow: false });
      }
    } else {
      arrows.draw(f.wx, f.wy, f.dx, f.dy, { color: f.color, lineWidth: 2.5 });
    }

    // Compute label position beyond the arrow tip
    const [tipSx, tipSy] = cm.toScreen(f.wx + f.dx, f.wy + f.dy);
    const angle = Math.atan2(-f.dy, f.dx); // screen angle (y flipped)
    const labelText = `${f.name} ${f.magnitude.toFixed(1)}N`;

    ctx.font = 'bold 14px -apple-system, sans-serif';
    const tw = ctx.measureText(labelText).width + 14;
    const th = 22;

    // Place label beyond the arrow tip, along the arrow direction
    const beyondDist = 24; // pixels beyond the tip
    const labelCx = tipSx + Math.cos(angle) * beyondDist;
    const labelCy = tipSy + Math.sin(angle) * beyondDist;

    // Align label based on arrow direction quadrant
    let lx: number, ly: number;
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    if (Math.abs(cosA) > Math.abs(sinA)) {
      // Mostly horizontal - place label centered vertically, offset horizontally
      lx = cosA > 0 ? labelCx : labelCx - tw;
      ly = labelCy - th / 2;
    } else {
      // Mostly vertical - place label centered horizontally, offset vertically
      lx = labelCx - tw / 2;
      ly = sinA > 0 ? labelCy : labelCy - th;
    }

    labelInfos.push({ force: f, label: labelText, rect: { x: lx, y: ly, w: tw, h: th }, tipSx, tipSy });
  }

  // Resolve label collisions
  const rects = labelInfos.map(l => l.rect);
  resolveLabels(rects);

  // Draw labels with backgrounds and leader lines
  ctx.save();
  for (const info of labelInfos) {
    const { rect, label, force, tipSx, tipSy } = info;

    // Clamp to canvas
    rect.x = Math.max(4, Math.min(rect.x, cm.getWidth() - rect.w - 4));
    rect.y = Math.max(4, Math.min(rect.y, cm.getHeight() - rect.h - 4));

    // Leader line from arrow tip to label edge
    const labelCx = rect.x + rect.w / 2;
    const labelCy = rect.y + rect.h / 2;
    const dist = Math.sqrt((labelCx - tipSx) ** 2 + (labelCy - tipSy) ** 2);
    if (dist > 20) {
      ctx.strokeStyle = force.color + '30';
      ctx.lineWidth = 0.8;
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(tipSx, tipSy);
      ctx.lineTo(labelCx, labelCy);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Background pill with gradient
    const pillGrad = ctx.createLinearGradient(rect.x, rect.y, rect.x, rect.y + rect.h);
    pillGrad.addColorStop(0, 'rgba(12, 18, 32, 0.88)');
    pillGrad.addColorStop(1, 'rgba(8, 14, 26, 0.85)');
    ctx.fillStyle = pillGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 6);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Border with force color
    ctx.strokeStyle = force.color + '50';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Left color accent bar
    ctx.fillStyle = force.color + '60';
    ctx.beginPath();
    roundRect(ctx, rect.x + 1, rect.y + 3, 2.5, rect.h - 6, 1);
    ctx.fill();

    // Text
    ctx.fillStyle = force.color;
    ctx.font = 'bold 14px -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, rect.x + 8, rect.y + rect.h / 2);
  }
  ctx.restore();
}

// ============================================================
// Info overlay per scene
// ============================================================

function getInfoLines(scene: SceneType, forces: ForceEntry[]): string[] {
  const lines: string[] = [];

  if (scene === '水平面') {
    const state = panel.getValue<string>('motionState');
    const m = panel.getValue<number>('mass');
    const F = panel.getValue<number>('appliedF');
    const theta = panel.getValue<number>('appliedAngle');
    const G = m * g;
    const Fy = F * Math.sin(deg2rad(theta));
    const N = Math.max(0, G - Fy);
    lines.push(`运动状态: ${state}`);
    lines.push(`G = mg = ${G.toFixed(1)} N`);
    lines.push(`N = G - Fsinθ = ${N.toFixed(1)} N`);
    if (state === '加速') {
      const a = panel.getValue<number>('accel');
      lines.push(`F_net = ma = ${(m * a).toFixed(1)} N`);
    }
  } else if (scene === '圆周运动') {
    const m = panel.getValue<number>('mass');
    const v = panel.getValue<number>('velocity');
    const R = panel.getValue<number>('radius');
    const Fc = m * v * v / R;
    const G = m * g;
    lines.push(`F_向 = mv²/R = ${Fc.toFixed(1)} N`);
    lines.push(`v = ${v.toFixed(1)} m/s, R = ${R.toFixed(1)} m`);
    // Show position-specific info
    const angleDeg = (animAngle * 180 / Math.PI) % 360;
    if (angleDeg < 10 || angleDeg > 350) {
      lines.push(`最低点: N = G + Fc = ${(G + Fc).toFixed(1)} N`);
    } else if (Math.abs(angleDeg - 180) < 10) {
      lines.push(`最高点: N = Fc - G = ${Math.max(0, Fc - G).toFixed(1)} N`);
    }
    lines.push('注：向心力是合力的效果');
  } else if (scene === '浮力') {
    const rhoObj = panel.getValue<number>('objDensity');
    const rhoFluid = panel.getValue<number>('fluidDensity');
    const V = panel.getValue<number>('volume') / 1000;
    const G = rhoObj * V * g;
    const subFrac = rhoObj >= rhoFluid ? 1 : rhoObj / rhoFluid;
    const Fb = rhoFluid * subFrac * V * g;
    lines.push(`G = ρ·V·g = ${G.toFixed(1)} N`);
    lines.push(`F_浮 = ρ_液·V_浸·g = ${Fb.toFixed(1)} N`);
    lines.push(`状态: ${rhoObj < rhoFluid ? '漂浮' : rhoObj === rhoFluid ? '悬浮' : '下沉'}`);
  } else if (scene === '连接体') {
    const m1 = panel.getValue<number>('mass');
    const m2 = panel.getValue<number>('mass2');
    const F = panel.getValue<number>('connAppliedF');
    const mu = panel.getValue<number>('connMu');
    const surface = panel.getValue<string>('connSurface');
    const muEff = surface === '光滑水平面' ? 0 : mu;
    let aSystem = 0, T = 0;

    if (surface === '斜面') {
      const alpha = deg2rad(panel.getValue<number>('slopeAngle'));
      const f1 = mu * m1 * g * Math.cos(alpha);
      const f2 = mu * m2 * g * Math.cos(alpha);
      aSystem = (F - m1 * g * Math.sin(alpha) - m2 * g * Math.sin(alpha) - f1 - f2) / (m1 + m2);
      T = m1 * aSystem + m1 * g * Math.sin(alpha) + f1;
    } else {
      const f1 = muEff * m1 * g, f2 = muEff * m2 * g;
      aSystem = (F - f1 - f2) / (m1 + m2);
      T = m1 * aSystem + f1;
    }
    lines.push(`整体法: a = ${aSystem.toFixed(2)} m/s²`);
    lines.push(`隔离法: T = ${T.toFixed(1)} N`);
    lines.push(`m₁=${m1}kg, m₂=${m2}kg, F=${F}N`);
  } else if (scene === '传送带') {
    const vBelt = panel.getValue<number>('beltVelocity');
    const v0 = panel.getValue<number>('blockV0');
    const vRel = v0 - vBelt;
    lines.push(`v_带=${vBelt.toFixed(1)}, v₀=${v0.toFixed(1)} m/s`);
    lines.push(`v_相对 = ${vRel.toFixed(1)} m/s`);
    if (Math.abs(vRel) > 0.01) {
      const mu = panel.getValue<number>('beltMu');
      const m = panel.getValue<number>('mass');
      lines.push(`f = μmg = ${(mu * m * g).toFixed(1)} N (${vRel > 0 ? '←' : '→'})`);
    } else {
      lines.push('同速，无滑动摩擦');
    }
    lines.push('关键：摩擦力由相对运动决定');
  } else if (scene === '弹簧') {
    const k = panel.getValue<number>('springK');
    const m = panel.getValue<number>('mass');
    const state = panel.getValue<string>('springState');
    lines.push(`k = ${k} N/m, m = ${m} kg`);
    if (state === '竖直悬挂') {
      const x0 = m * g / k;
      lines.push(`平衡: kx₀ = mg`);
      lines.push(`x₀ = ${x0.toFixed(3)} m`);
    } else {
      const xDisp = panel.getValue<number>('springDisp');
      lines.push(`F_弹 = kx = ${(k * xDisp).toFixed(1)} N`);
    }
  } else if (scene === '杆模型') {
    const v = panel.getValue<number>('rodVelocity');
    const R = panel.getValue<number>('rodRadius');
    const pos = panel.getValue<string>('rodPosition');
    const m = panel.getValue<number>('mass');
    const G = m * g;
    const Fc = m * v * v / R;
    const vCrit = Math.sqrt(g * R);
    lines.push(`v = ${v.toFixed(1)}, R = ${R.toFixed(1)}`);
    lines.push(`v_临界 = √(gR) = ${vCrit.toFixed(2)} m/s`);
    if (pos === '最高点') {
      const N = Fc - G;
      if (N >= 0) lines.push(`v≥v_临: 杆拉力 ${N.toFixed(1)}N↓`);
      else lines.push(`v<v_临: 杆支持力 ${(-N).toFixed(1)}N↑`);
    }
    lines.push('杆可推可拉，绳只能拉');
  }

  return lines;
}

// ============================================================
// Force table
// ============================================================

function drawForceTable(forces: ForceEntry[]): void {
  let html = '<table style="width:100%; border-collapse:collapse; font-size:14px;">';
  html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.15);">'
    + '<th style="text-align:left; padding:4px 8px; color:#64748b; font-weight:600;">力</th>'
    + '<th style="text-align:right; padding:4px 8px; color:#64748b; font-weight:600;">大小 (N)</th>'
    + '<th style="text-align:right; padding:4px 8px; color:#64748b; font-weight:600;">方向 (°)</th>'
    + '</tr>';
  for (const f of forces) {
    html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05);">`
      + `<td style="padding:3px 8px; color:${f.color}; font-weight:600;">${f.name}</td>`
      + `<td style="text-align:right; padding:3px 8px;">${f.magnitude.toFixed(2)}</td>`
      + `<td style="text-align:right; padding:3px 8px;">${f.directionDeg.toFixed(1)}</td>`
      + `</tr>`;
  }
  html += '</table>';
  forceTableContainer.innerHTML = html;
}

// ============================================================
// Net force for circular motion overlay
// ============================================================

function drawCircularNetForce(forces: ForceEntry[]): void {
  if (getScene() !== '圆周运动') return;

  const m = panel.getValue<number>('mass');
  const v = panel.getValue<number>('velocity');
  const R = panel.getValue<number>('radius');
  const Fc = m * v * v / R;

  const [ox, oy] = getForceOrigin('圆周运动');

  // Net force direction: toward center (0, 0)
  const dist = Math.sqrt(ox * ox + oy * oy);
  if (dist < 0.01) return;
  const ndx = -ox / dist * Fc * FORCE_SCALE;
  const ndy = -oy / dist * Fc * FORCE_SCALE;

  arrows.draw(ox, oy, ndx, ndy, {
    color: '#c084fc',
    dashed: true,
    label: `F_合 = ${Fc.toFixed(1)}N`,
    lineWidth: 2,
    labelOffset: -22,
  });
}

// ============================================================
// Main render loop
// ============================================================

function render(): void {
  const scene = getScene();
  const showDecomp = panel.getValue<boolean>('showDecomp');

  // Reset origin for scenes that don't override it
  updateOrigin();

  cm.clear('#070b14');
  grid.draw({ majorSpacing: 1, showLabels: false });

  drawSceneBackground(scene);

  const forces = solveForces();
  drawForceArrows(forces, showDecomp, scene);

  if (scene === '圆周运动') {
    drawCircularNetForce(forces);
  }

  // Info panel
  const infoLines = getInfoLines(scene, forces);
  if (infoLines.length > 0) {
    const highlightIdx = infoLines.findIndex(l => l.includes('注') || l.includes('关键') || l.includes('杆可'));
    drawInfoPanel(infoLines, highlightIdx >= 0 ? highlightIdx : undefined);
  }

  drawForceTable(forces);
}

// ============================================================
// Animation loop for circular motion
// ============================================================

function startAnimation(): void {
  if (animRunning) return;
  animRunning = true;
  lastAnimTime = performance.now();
  requestAnimationFrame(animLoop);
}

function animLoop(now: number): void {
  if (!animRunning) return;

  const scene = getScene();
  const dt = (now - lastAnimTime) / 1000;
  lastAnimTime = now;

  if (scene === '圆周运动') {
    const v = panel.getValue<number>('velocity');
    const R = panel.getValue<number>('radius');
    const omega = v / R;
    animAngle = (animAngle + omega * dt) % (Math.PI * 2);
  }

  // For conveyor belt and buoyancy, re-render for animated effects
  render();
  requestAnimationFrame(animLoop);
}

// ---- Wire up ----
panel.setOnChange(() => {
  const scene = getScene();
  if (scene === '圆周运动' || scene === '传送带' || scene === '浮力') {
    startAnimation();
  } else {
    animRunning = false;
    animAngle = 0;
    render();
  }
});

// Check if we should start animation on load
const initialScene = getScene();
if (initialScene === '圆周运动' || initialScene === '传送带' || initialScene === '浮力') {
  startAnimation();
} else {
  render();
}

// ---- Helpers ----
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lightenHex(hex: string, amount: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  const r = Math.min(255, parseInt(m[1], 16) + amount);
  const g = Math.min(255, parseInt(m[2], 16) + amount);
  const b = Math.min(255, parseInt(m[3], 16) + amount);
  return `rgb(${r},${g},${b})`;
}
