import type { GraphTrace } from '@physics/core';
import { ArrowRenderer } from '@physics/core';
import type { ThermoState, SceneModule, RenderContext, StateDisplayData } from '../types';
import { COLORS, CANVAS_FONTS, speedToColor } from '../theme';
import { createSeededRandom, clamp } from '../params';

const PARTICLE_R = 0.12;
const kB = 1.38e-23;
const mN2 = 4.65e-26;
const PISTON_WIDTH_PX = 12;
const MAX_COLLISION_FLASHES = 42;
const MIN_CONTAINER_W_WORLD = 100 / 25;
const MAX_CONTAINER_W_WORLD = 400 / 25;
const PRESSURE_SCALE = 0.12;

interface CollisionFlash {
  x: number;
  y: number;
  life: number;
  strength: number;
}

function boxDims(params: Record<string, number | string | boolean>): { w: number; h: number } {
  const wpx = Number(params.containerW) || 200;
  const hpx = Number(params.containerH) || 200;
  return { w: wpx / 25, h: hpx / 25 };
}

let wallCollisions = 0;
let lastPressureEstimate = 0;
let collisionFlashes: CollisionFlash[] = [];

export interface PistonDragInfo {
  screenX: number;
  screenY: number;
  screenH: number;
  scale: number;
  ox: number;
  minW: number;
  maxW: number;
}
let lastPistonDrag: PistonDragInfo | null = null;
export function getPistonDragInfo(): PistonDragInfo | null { return lastPistonDrag; }

function pushCollisionFlash(x: number, y: number, speed: number): void {
  collisionFlashes.push({
    x,
    y,
    life: 1,
    strength: clamp(speed / 9, 0.35, 1),
  });
  if (collisionFlashes.length > MAX_COLLISION_FLASHES) {
    collisionFlashes = collisionFlashes.slice(-MAX_COLLISION_FLASHES);
  }
}

function estimateKineticPressure(state: ThermoState, n: number, w: number, h: number): number {
  let totalSpeedSq = 0;
  for (let i = 0; i < n; i++) {
    const vx = state[`vx${i}`] || 0;
    const vy = state[`vy${i}`] || 0;
    totalSpeedSq += vx * vx + vy * vy;
  }
  return (totalSpeedSq / Math.max(0.1, w * h)) * PRESSURE_SCALE;
}

export const gasParticlesScene: SceneModule = {
  createInitialState(params, seed) {
    collisionFlashes = [];
    lastPressureEstimate = 0;
    const random = createSeededRandom(seed);
    const T = Number(params.temperature) || 300;
    const n = clamp(Math.floor(Number(params.numParticles) || 100), 20, 500);
    const { w, h } = boxDims(params);
    const vRms = Math.sqrt(3 * kB * T / mN2);
    const worldSpeedScale = 4.0 / Math.sqrt(3 * kB * 300 / mN2);

    const s: ThermoState = { t: 0 };
    for (let i = 0; i < n; i++) {
      s[`px${i}`] = random() * (w - 2 * PARTICLE_R) + PARTICLE_R;
      s[`py${i}`] = random() * (h - 2 * PARTICLE_R) + PARTICLE_R;
      const u1 = random(), u2 = random();
      const sigma = vRms / Math.sqrt(3) * worldSpeedScale;
      s[`vx${i}`] = sigma * Math.sqrt(-2 * Math.log(Math.max(1e-10, u1))) * Math.cos(2 * Math.PI * u2);
      const u3 = random(), u4 = random();
      s[`vy${i}`] = sigma * Math.sqrt(-2 * Math.log(Math.max(1e-10, u3))) * Math.cos(2 * Math.PI * u4);
    }
    s.boxW = w;
    s.boxH = h;
    s.nParticles = n;
    return s;
  },

  createStepFn(params) {
    const n = clamp(Math.floor(Number(params.numParticles) || 100), 20, 500);
    const { h } = boxDims(params);
    return (_t: number, dt: number, state: ThermoState): ThermoState => {
      const s: ThermoState = { ...state, t: state.t + dt };
      const w = Number(s.boxW) || boxDims(params).w;
      wallCollisions = 0;

      for (let i = 0; i < n; i++) {
        s[`px${i}`] += s[`vx${i}`] * dt;
        s[`py${i}`] += s[`vy${i}`] * dt;
        if (s[`px${i}`] < PARTICLE_R) {
          s[`px${i}`] = PARTICLE_R; s[`vx${i}`] *= -1; wallCollisions++;
          pushCollisionFlash(0, s[`py${i}`], Math.abs(s[`vx${i}`]));
        }
        if (s[`px${i}`] > w - PARTICLE_R) {
          s[`px${i}`] = w - PARTICLE_R; s[`vx${i}`] *= -1; wallCollisions++;
          pushCollisionFlash(w, s[`py${i}`], Math.abs(s[`vx${i}`]));
        }
        if (s[`py${i}`] < PARTICLE_R) {
          s[`py${i}`] = PARTICLE_R; s[`vy${i}`] *= -1; wallCollisions++;
          pushCollisionFlash(s[`px${i}`], 0, Math.abs(s[`vy${i}`]));
        }
        if (s[`py${i}`] > h - PARTICLE_R) {
          s[`py${i}`] = h - PARTICLE_R; s[`vy${i}`] *= -1; wallCollisions++;
          pushCollisionFlash(s[`px${i}`], h, Math.abs(s[`vy${i}`]));
        }
      }

      for (let i = 0; i < n; i++) {
        for (let j = i + 1; j < n; j++) {
          const dx = s[`px${j}`] - s[`px${i}`];
          const dy = s[`py${j}`] - s[`py${i}`];
          const distSq = dx * dx + dy * dy;
          const minDist = PARTICLE_R * 2;
          if (distSq < minDist * minDist && distSq > 0) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist, ny = dy / dist;
            const dvx = s[`vx${i}`] - s[`vx${j}`];
            const dvy = s[`vy${i}`] - s[`vy${j}`];
            const dvDotN = dvx * nx + dvy * ny;
            if (dvDotN > 0) {
              s[`vx${i}`] -= dvDotN * nx; s[`vy${i}`] -= dvDotN * ny;
              s[`vx${j}`] += dvDotN * nx; s[`vy${j}`] += dvDotN * ny;
            }
            const overlap = minDist - dist;
            if (overlap > 0) {
              s[`px${i}`] -= nx * overlap * 0.5; s[`py${i}`] -= ny * overlap * 0.5;
              s[`px${j}`] += nx * overlap * 0.5; s[`py${j}`] += ny * overlap * 0.5;
            }
          }
        }
      }

      const rawPressure = estimateKineticPressure(s, n, w, h);
      lastPressureEstimate = lastPressureEstimate === 0
        ? rawPressure
        : lastPressureEstimate * 0.86 + rawPressure * 0.14;
      collisionFlashes = collisionFlashes
        .map(f => ({ ...f, life: f.life - dt * 2.8 }))
        .filter(f => f.life > 0)
        .slice(-MAX_COLLISION_FLASHES);

      return s;
    };
  },

  render(t, state, rctx, params) {
    const { cm } = rctx;
    const ctx = cm.ctx;
    const n = clamp(Math.floor(Number(params.numParticles) || 100), 20, 500);
    const showV = Boolean(params.showVelocity);
    const T = Number(params.temperature) || 300;
    const paramBox = boxDims(params);
    const w = Number(state.boxW) || paramBox.w;
    const h = paramBox.h;
    const maxW = Math.max(MAX_CONTAINER_W_WORLD, w);

    const tempFrac = clamp((T - 100) / 900, 0, 1);
    const density = n / Math.max(0.1, w * h);
    const kineticPressure = estimateKineticPressure(state, n, w, h);
    const displayPressure = lastPressureEstimate || kineticPressure;
    const pvtPerParticle = displayPressure * w * h / Math.max(1, n) / T;

    cm.clear(COLORS.canvasBg);
    drawThermalBackdrop(ctx, rctx.canvasWidth, rctx.canvasHeight, tempFrac);
    const scale = Math.min((rctx.canvasWidth - 100) / maxW, (rctx.canvasHeight - 80) / h) * 0.90;
    const ox = (rctx.canvasWidth - maxW * scale) / 2;
    const oy = 58;

    const bx1 = ox, by1 = oy;
    const bx2 = ox + w * scale, by2 = oy + h * scale;

    // Experiment card shadow
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,0.12)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, bx1 - 18, by1 - 24, maxW * scale + 84, h * scale + 94, 18);
    ctx.fill();
    ctx.restore();

    // Container inner fill with temperature tint
    const cornerR = 8;
    const gasGrad = ctx.createLinearGradient(bx1, by1, bx2, by2);
    gasGrad.addColorStop(0, `rgba(66, 165, 245, ${0.08 + (1 - tempFrac) * 0.10})`);
    gasGrad.addColorStop(1, `rgba(239, 83, 80, ${0.05 + tempFrac * 0.18})`);
    ctx.fillStyle = gasGrad;
    ctx.beginPath();
    ctx.moveTo(bx1 + cornerR, by1);
    ctx.lineTo(bx2 - cornerR, by1);
    ctx.arcTo(bx2, by1, bx2, by1 + cornerR, cornerR);
    ctx.lineTo(bx2, by2 - cornerR);
    ctx.arcTo(bx2, by2, bx2 - cornerR, by2, cornerR);
    ctx.lineTo(bx1 + cornerR, by2);
    ctx.arcTo(bx1, by2, bx1, by2 - cornerR, cornerR);
    ctx.lineTo(bx1, by1 + cornerR);
    ctx.arcTo(bx1, by1, bx1 + cornerR, by1, cornerR);
    ctx.closePath();
    ctx.fill();

    // Inner edge glow
    const edgeGrad = ctx.createLinearGradient(bx1, by1, bx1, by1 + 20);
    edgeGrad.addColorStop(0, tempFrac > 0.5 ? 'rgba(239,83,80,0.15)' : 'rgba(66,165,245,0.16)');
    edgeGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(bx1 + 2, by1 + 2, bx2 - bx1 - 4, 18);

    // Container border — 3 fixed walls (left, top, bottom)
    ctx.strokeStyle = COLORS.containerBorder;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(bx2, by1);
    ctx.lineTo(bx1 + cornerR, by1);
    ctx.arcTo(bx1, by1, bx1, by1 + cornerR, cornerR);
    ctx.lineTo(bx1, by2 - cornerR);
    ctx.arcTo(bx1, by2, bx1 + cornerR, by2, cornerR);
    ctx.lineTo(bx2, by2);
    ctx.stroke();

    drawCollisionFlashes(ctx, collisionFlashes, bx1, by2, scale);

    // Draggable piston (right wall)
    const pistonX = bx2 - PISTON_WIDTH_PX / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(15,23,42,0.20)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = -2;
    const pistonGrad = ctx.createLinearGradient(pistonX, 0, pistonX + PISTON_WIDTH_PX, 0);
    pistonGrad.addColorStop(0, '#78909C');
    pistonGrad.addColorStop(0.5, '#B0BEC5');
    pistonGrad.addColorStop(1, '#78909C');
    ctx.fillStyle = pistonGrad;
    ctx.fillRect(pistonX, by1, PISTON_WIDTH_PX, by2 - by1);
    ctx.strokeStyle = '#546E7A';
    ctx.lineWidth = 1;
    ctx.strokeRect(pistonX, by1, PISTON_WIDTH_PX, by2 - by1);
    for (let gy = by1 + 8; gy < by2 - 4; gy += 10) {
      ctx.strokeStyle = 'rgba(0,0,0,0.15)';
      ctx.beginPath();
      ctx.moveTo(pistonX + 3, gy);
      ctx.lineTo(pistonX + PISTON_WIDTH_PX - 3, gy);
      ctx.stroke();
    }
    ctx.restore();

    // Drag handle hint and volume label
    drawPill(ctx, bx2 - 58, by2 + 13, 116, 24, '拖动活塞改变 V', COLORS.accentGreen, 'rgba(16,185,129,0.10)');

    lastPistonDrag = {
      screenX: bx2,
      screenY: by1,
      screenH: by2 - by1,
      scale,
      ox,
      minW: MIN_CONTAINER_W_WORLD,
      maxW: MAX_CONTAINER_W_WORLD,
    };

    const vRmsTheory = Math.sqrt(3 * kB * T / mN2);
    drawStatusHeader(ctx, bx1, by1 - 44, bx2 - bx1, {
      T,
      n,
      volume: w * h,
      p: displayPressure,
      density,
      tempFrac,
    });
    drawTeachingCallouts(ctx, bx1, by1, bx2, by2, tempFrac, density, pvtPerParticle);
    drawPressureMeter(ctx, bx2 + 20, by1 + 34, Math.min(160, by2 - by1 - 74), displayPressure, wallCollisions);

    // Speed legend bar — wider
    const legendX = ox + maxW * scale + 20;
    const legendY = by1 + 14;
    const legendH = Math.min(120, by2 - by1 - 30);
    ctx.font = CANVAS_FONTS.small;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('速率', legendX, legendY - 6);
    for (let i = 0; i < legendH; i++) {
      const frac = i / legendH;
      ctx.fillStyle = speedToColor(frac);
      ctx.fillRect(legendX, legendY + i, 14, 1);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.strokeRect(legendX, legendY, 14, legendH);
    ctx.fillStyle = COLORS.textDim;
    ctx.font = CANVAS_FONTS.small;
    ctx.fillText('慢', legendX + 20, legendY + 10);
    ctx.fillText('快', legendX + 20, legendY + legendH - 4);

    // Set up world coordinate system for drawBall
    cm.setOrigin(bx1, by2);
    cm.setScale(scale);

    // Compute speed stats
    let totalSpeedSq = 0;
    for (let i = 0; i < n; i++) {
      const vx = state[`vx${i}`] || 0, vy = state[`vy${i}`] || 0;
      totalSpeedSq += vx * vx + vy * vy;
    }
    const rmsSpeed = Math.sqrt(totalSpeedSq / Math.max(1, n));
    const maxSpeedForColor = rmsSpeed * 2.5;
    const arrowRenderer = showV ? new ArrowRenderer(cm) : null;
    const arrowStride = Math.max(1, Math.ceil(n / 24));
    const maxArrowLen = Math.min(0.58, Math.max(0.30, Math.min(w, h) * 0.055));
    const minArrowSpeed = rmsSpeed * 0.30;

    // Particles using high-quality drawBall
    for (let i = 0; i < n; i++) {
      const px = state[`px${i}`] || 0, py = state[`py${i}`] || 0;
      const vx = state[`vx${i}`] || 0, vy = state[`vy${i}`] || 0;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const frac = Math.min(1, speed / Math.max(0.01, maxSpeedForColor));
      const color = speedToColor(frac);
      const r = Math.max(5, PARTICLE_R * scale);

      cm.drawBall(px, py, r, color, { glow: false });

      if (arrowRenderer && i % arrowStride === 0 && speed > minArrowSpeed) {
        const len = Math.min(maxArrowLen, 0.18 + (speed / Math.max(0.01, rmsSpeed)) * 0.12);
        arrowRenderer.draw(px, py, (vx / speed) * len, (vy / speed) * len, {
            color: adjustAlpha(color, 0.56),
            lineWidth: 1.1,
            headLength: 5,
            glow: false,
            gradient: false,
        });
      }
    }

    cm.applyBloom(0.12);

    // Restore default coordinate system
    cm.setOrigin(rctx.canvasWidth / 2, rctx.canvasHeight * 0.75);
    cm.setScale(100);
  },

  getGraphTraces(params, state): GraphTrace[] {
    if (!params.showDistribution) return [];

    const n = clamp(Math.floor(Number(params.numParticles) || 100), 20, 500);
    const T = Number(params.temperature) || 300;
    const speeds: number[] = [];

    let totalSpeedSq = 0;
    for (let i = 0; i < n; i++) {
      const vx = state[`vx${i}`] || 0, vy = state[`vy${i}`] || 0;
      const sp = Math.sqrt(vx * vx + vy * vy);
      speeds.push(sp);
      totalSpeedSq += vx * vx + vy * vy;
    }
    const rmsSpeed = Math.sqrt(totalSpeedSq / Math.max(1, n));
    const maxGraphSpeed = rmsSpeed * 3;

    const bins = 25;
    const binW = maxGraphSpeed / bins;
    const hist = new Array(bins).fill(0);
    for (const sp of speeds) {
      const idx = Math.min(bins - 1, Math.floor(sp / binW));
      hist[idx]++;
    }
    const total = speeds.length;
    const histNorm = hist.map((h: number) => h / (total * binW));
    const xData = histNorm.map((_: number, i: number) => (i + 0.5) * binW);

    const vScale = Math.sqrt(3 * kB * T / mN2) / 500;
    const effectiveKT = (vScale * 500) * (vScale * 500) * mN2 / 3;
    const mbX: number[] = [], mbY: number[] = [];
    for (let i = 0; i < 100; i++) {
      const v = (i + 0.5) * maxGraphSpeed / 100;
      const mOverKT = mN2 / effectiveKT;
      const fv = mOverKT * v * Math.exp(-mOverKT * v * v / 2);
      mbX.push(v);
      mbY.push(fv);
    }
    const maxY = Math.max(...histNorm, ...mbY, 0.001);

    return [
      { x: xData, y: histNorm, name: '模拟分布', color: COLORS.isochoricLine },
      { x: mbX, y: mbY, name: 'M-B理论', color: COLORS.isothermalLine },
      { x: [rmsSpeed, rmsSpeed], y: [0, maxY], name: '当前v_rms', color: COLORS.accentGreen },
    ];
  },

  getStateDisplay(params, state): StateDisplayData {
    const T = Number(params.temperature) || 300;
    const paramBox = boxDims(params);
    const w = Number(state.boxW) || paramBox.w;
    const h = paramBox.h;
    const V = w * h;
    const n = Number(state.nParticles) || clamp(Math.floor(Number(params.numParticles) || 100), 20, 500);
    const p = lastPressureEstimate || estimateKineticPressure(state, n, w, h);
    return {
      p, V, T,
      invariant: {
        label: 'pV/(N·T) 验证',
        value: p * V / Math.max(1, n) / T,
        highlight: true,
      },
    };
  },
};

function drawThermalBackdrop(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  tempFrac: number,
): void {
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, `rgba(59,130,246,${0.08 + (1 - tempFrac) * 0.05})`);
  grad.addColorStop(0.56, 'rgba(255,255,255,0.96)');
  grad.addColorStop(1, `rgba(239,68,68,${0.05 + tempFrac * 0.10})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = 'rgba(15,23,42,0.035)';
  ctx.lineWidth = 1;
  for (let x = 24; x < width; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 24; y < height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawCollisionFlashes(
  ctx: CanvasRenderingContext2D,
  flashes: CollisionFlash[],
  bx1: number,
  by2: number,
  scale: number,
): void {
  for (const flash of flashes) {
    const sx = bx1 + flash.x * scale;
    const sy = by2 - flash.y * scale;
    const alpha = flash.life * 0.75;
    const radius = 6 + (1 - flash.life) * 18 * flash.strength;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    grad.addColorStop(0, `rgba(16,185,129,${alpha})`);
    grad.addColorStop(0.45, `rgba(56,189,248,${alpha * 0.35})`);
    grad.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawStatusHeader(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  data: { T: number; n: number; volume: number; p: number; density: number; tempFrac: number },
): void {
  roundRect(ctx, x, y, width, 32, 8);
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,23,42,0.08)';
  ctx.stroke();

  const tempText = data.tempFrac > 0.65 ? '高温：分布右移' : data.tempFrac < 0.22 ? '低温：慢速占多' : '室温观察';
  const items = [
    { label: 'T', value: `${data.T.toFixed(0)} K`, color: data.tempFrac > 0.5 ? COLORS.moleculeHot : COLORS.moleculeCool },
    { label: 'N', value: `${data.n}`, color: COLORS.textPrimary },
    { label: 'V', value: `${data.volume.toFixed(1)}`, color: COLORS.accentGreen },
    { label: 'p', value: `${data.p.toFixed(2)}`, color: COLORS.arrowPressure },
    { label: '', value: tempText, color: COLORS.textSecondary },
  ];
  let cursor = x + 14;
  ctx.textBaseline = 'middle';
  for (const item of items) {
    ctx.font = '11px -apple-system, sans-serif';
    ctx.fillStyle = COLORS.textDim;
    if (item.label) {
      ctx.fillText(item.label, cursor, y + 16);
      cursor += ctx.measureText(item.label).width + 4;
    }
    ctx.font = 'bold 13px -apple-system, sans-serif';
    ctx.fillStyle = item.color;
    ctx.fillText(item.value, cursor, y + 16);
    cursor += ctx.measureText(item.value).width + 18;
  }

  const densityW = clamp(data.density / 10, 0, 1) * 70;
  ctx.fillStyle = 'rgba(15,23,42,0.08)';
  roundRect(ctx, x + width - 90, y + 12, 70, 5, 3);
  ctx.fill();
  ctx.fillStyle = 'rgba(16,185,129,0.72)';
  roundRect(ctx, x + width - 90, y + 12, densityW, 5, 3);
  ctx.fill();
}

function drawTeachingCallouts(
  ctx: CanvasRenderingContext2D,
  bx1: number,
  by1: number,
  bx2: number,
  by2: number,
  tempFrac: number,
  density: number,
  pvtPerParticle: number,
): void {
  const hot = tempFrac > 0.62;
  const dense = density > 5.5;
  drawPill(
    ctx,
    bx1 + 16,
    by1 + 14,
    hot ? 148 : 132,
    24,
    hot ? '温度升高：平均速率增大' : '温度决定平均动能',
    hot ? COLORS.moleculeHot : COLORS.moleculeCool,
    hot ? 'rgba(239,83,80,0.10)' : 'rgba(66,165,245,0.12)',
  );
  drawPill(
    ctx,
    bx2 - 166,
    by1 + 14,
    150,
    24,
    dense ? '体积较小：碰壁更频繁' : '分子碰壁形成压强',
    COLORS.arrowPressure,
    'rgba(21,101,192,0.10)',
  );
  drawPill(
    ctx,
    bx1 + 16,
    by2 - 34,
    138,
    24,
    `pV/(N·T) ≈ ${pvtPerParticle.toFixed(3)}`,
    COLORS.accentGreen,
    'rgba(16,185,129,0.11)',
  );
}

function drawPressureMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  pressure: number,
  collisions: number,
): void {
  const meterW = 46;
  const fillFrac = clamp(pressure / 12, 0, 1);
  roundRect(ctx, x, y, meterW, height, 12);
  ctx.fillStyle = 'rgba(255,255,255,0.84)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,23,42,0.10)';
  ctx.stroke();

  const fillH = Math.max(8, (height - 18) * fillFrac);
  const fillY = y + height - 9 - fillH;
  const grad = ctx.createLinearGradient(0, fillY, 0, y + height);
  grad.addColorStop(0, '#EF5350');
  grad.addColorStop(0.55, '#F59E0B');
  grad.addColorStop(1, '#10B981');
  ctx.fillStyle = grad;
  roundRect(ctx, x + 9, fillY, meterW - 18, fillH, 8);
  ctx.fill();

  ctx.fillStyle = COLORS.textSecondary;
  ctx.font = 'bold 11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('压强', x + meterW / 2, y - 8);
  ctx.font = '10px -apple-system, sans-serif';
  ctx.fillStyle = COLORS.textDim;
  ctx.fillText(`${collisions}/帧`, x + meterW / 2, y + height + 16);
}

function drawPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  text: string,
  color: string,
  fill: string,
): void {
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = adjustAlpha(color, 0.28);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = 'bold 11px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + w / 2, y + h / 2);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function adjustAlpha(color: string, alpha: number): string {
  const m = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}
