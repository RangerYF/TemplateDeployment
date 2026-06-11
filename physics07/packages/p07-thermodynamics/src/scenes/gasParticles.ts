import type { GraphTrace } from '@physics/core';
import { ArrowRenderer } from '@physics/core';
import type { ThermoState, SceneModule, RenderContext, StateDisplayData } from '../types';
import { COLORS, CANVAS_FONTS, speedToColor, surface, lineInk, shadowInk, gridLine, withAlpha } from '../theme';
import { createSeededRandom, clamp } from '../params';
import { lightenColor, darkenColor } from '../renderHelpers';

const PARTICLE_R = 0.12;
const kB = 1.38e-23;
const mN2 = 4.65e-26;
const PISTON_WIDTH_PX = 12;
const MAX_COLLISION_FLASHES = 42;
const MIN_CONTAINER_W_WORLD = 100 / 25;
const MAX_CONTAINER_W_WORLD = 400 / 25;
const PRESSURE_SCALE = 0.24;

interface CollisionFlash {
  x: number;
  y: number;
  life: number;
  strength: number;
  vx: number;
  vy: number;
  sparks: { ang: number; spd: number }[];
}

// ── Particle sprite cache (pre-rendered for performance + crisp glow) ──
const SPRITE_BUCKETS = 24;
const spriteCache = new Map<number, HTMLCanvasElement>();

function getParticleSprite(frac: number, radius: number): HTMLCanvasElement {
  const bucket = Math.round(clamp(frac, 0, 1) * (SPRITE_BUCKETS - 1));
  const rPx = Math.round(radius);
  const key = bucket * 1000 + rPx;
  const cached = spriteCache.get(key);
  if (cached) return cached;

  const color = speedToColor(bucket / (SPRITE_BUCKETS - 1));
  const pad = Math.ceil(rPx * 0.45);
  const size = (rPx + pad) * 2;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const c = cv.getContext('2d')!;
  const cx = size / 2, cy = size / 2;

  // tight subtle glow (just a thin halo, keeps particles reading as small dots)
  const glow = c.createRadialGradient(cx, cy, rPx * 0.85, cx, cy, rPx + pad);
  glow.addColorStop(0, adjustAlpha(color, 0.28));
  glow.addColorStop(1, adjustAlpha(color, 0));
  c.fillStyle = glow;
  c.beginPath();
  c.arc(cx, cy, rPx + pad, 0, Math.PI * 2);
  c.fill();

  // body — 4-stop radial gradient with offset highlight
  const body = c.createRadialGradient(
    cx - rPx * 0.32, cy - rPx * 0.32, rPx * 0.1,
    cx, cy, rPx,
  );
  body.addColorStop(0, lightenColor(color, 80));
  body.addColorStop(0.35, lightenColor(color, 25));
  body.addColorStop(0.75, color);
  body.addColorStop(1, darkenColor(color, 45));
  c.fillStyle = body;
  c.beginPath();
  c.arc(cx, cy, rPx, 0, Math.PI * 2);
  c.fill();

  // specular highlight
  c.fillStyle = 'rgba(255,255,255,0.85)';
  c.beginPath();
  c.ellipse(cx - rPx * 0.34, cy - rPx * 0.38, rPx * 0.26, rPx * 0.18, -0.5, 0, Math.PI * 2);
  c.fill();

  // bottom rim light
  c.strokeStyle = adjustAlpha(lightenColor(color, 40), 0.5);
  c.lineWidth = Math.max(1, rPx * 0.12);
  c.beginPath();
  c.arc(cx, cy, rPx * 0.92, Math.PI * 0.15, Math.PI * 0.85);
  c.stroke();

  spriteCache.set(key, cv);
  return cv;
}

function boxDims(params: Record<string, number | string | boolean>): { w: number; h: number } {
  const wpx = Number(params.containerW) || 200;
  const hpx = Number(params.containerH) || 200;
  return { w: wpx / 25, h: hpx / 25 };
}

let wallCollisions = 0;
let lastPressureEstimate = 0;
let collisionRateSmooth = 0; // smoothed wall collisions/sec — the mechanism behind pressure
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

function pushCollisionFlash(x: number, y: number, speed: number, nx: number, ny: number): void {
  const strength = clamp(speed / 9, 0.35, 1);
  const sparkCount = Math.round(2 + strength * 3);
  const baseAng = Math.atan2(ny, nx);
  const sparks: { ang: number; spd: number }[] = [];
  for (let i = 0; i < sparkCount; i++) {
    sparks.push({
      ang: baseAng + (i / sparkCount - 0.5) * 1.6,
      spd: 0.6 + strength * 1.2,
    });
  }
  collisionFlashes.push({ x, y, life: 1, strength, vx: nx, vy: ny, sparks });
  if (collisionFlashes.length > MAX_COLLISION_FLASHES) {
    collisionFlashes = collisionFlashes.slice(-MAX_COLLISION_FLASHES);
  }
}

// 2D kinetic pressure: P·A = Σ½mv² (total KE). With m≡1 in world units,
// P = (Σ½v²)/A = (Σv²)/(2A). PRESSURE_SCALE only sets the display magnitude
// (kPa-like range); it does not affect the constancy of pV/(N·T).
function estimateKineticPressure(state: ThermoState, n: number, w: number, h: number): number {
  let totalSpeedSq = 0;
  for (let i = 0; i < n; i++) {
    const vx = state[`vx${i}`] || 0;
    const vy = state[`vy${i}`] || 0;
    totalSpeedSq += vx * vx + vy * vy;
  }
  return (totalSpeedSq / (2 * Math.max(0.1, w * h))) * PRESSURE_SCALE;
}

export const gasParticlesScene: SceneModule = {
  createInitialState(params, seed) {
    collisionFlashes = [];
    lastPressureEstimate = 0;
    collisionRateSmooth = 0;
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
          pushCollisionFlash(0, s[`py${i}`], Math.abs(s[`vx${i}`]), 1, 0);
        }
        if (s[`px${i}`] > w - PARTICLE_R) {
          s[`px${i}`] = w - PARTICLE_R; s[`vx${i}`] *= -1; wallCollisions++;
          pushCollisionFlash(w, s[`py${i}`], Math.abs(s[`vx${i}`]), -1, 0);
        }
        if (s[`py${i}`] < PARTICLE_R) {
          s[`py${i}`] = PARTICLE_R; s[`vy${i}`] *= -1; wallCollisions++;
          pushCollisionFlash(s[`px${i}`], 0, Math.abs(s[`vy${i}`]), 0, 1);
        }
        if (s[`py${i}`] > h - PARTICLE_R) {
          s[`py${i}`] = h - PARTICLE_R; s[`vy${i}`] *= -1; wallCollisions++;
          pushCollisionFlash(s[`px${i}`], h, Math.abs(s[`vy${i}`]), 0, -1);
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

      // Instantaneous kinetic pressure. Elastic collisions + wall bounces
      // conserve Σv² exactly, so this is stable frame-to-frame and makes
      // pV/(N·T) genuinely constant under volume change (no EMA lag).
      lastPressureEstimate = estimateKineticPressure(s, n, w, h);
      // Smoothed wall-collision rate (collisions/sec) — the physical mechanism
      // that produces pressure. Shown to students alongside the pressure gauge.
      const instantRate = wallCollisions / Math.max(1e-4, dt);
      collisionRateSmooth = collisionRateSmooth === 0
        ? instantRate
        : collisionRateSmooth * 0.9 + instantRate * 0.1;
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
    const kineticPressure = estimateKineticPressure(state, n, w, h);
    const displayPressure = lastPressureEstimate || kineticPressure;

    cm.clear(COLORS.canvasBg);
    drawThermalBackdrop(ctx, rctx.canvasWidth, rctx.canvasHeight, tempFrac);
    const scale = Math.min((rctx.canvasWidth - 100) / maxW, (rctx.canvasHeight - 80) / h) * 0.90;
    const ox = (rctx.canvasWidth - maxW * scale) / 2;
    const oy = 58;

    const bx1 = ox, by1 = oy;
    const bx2 = ox + w * scale, by2 = oy + h * scale;

    // Experiment card shadow
    ctx.save();
    ctx.shadowColor = shadowInk(0.12);
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 10;
    ctx.fillStyle = surface(1);
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

    // Glass walls — 3 fixed walls (left, top, bottom) with glass-tube look
    drawGlassWalls(ctx, bx1, by1, bx2, by2, cornerR);

    drawWallBombardment(ctx, bx1, by1, bx2, by2, collisionRateSmooth);
    drawCollisionFlashes(ctx, collisionFlashes, bx1, by2, scale);

    // Draggable metal piston (right wall)
    drawMetalPiston(ctx, bx2 - PISTON_WIDTH_PX / 2, by1, PISTON_WIDTH_PX, by2 - by1);

    // Drag handle hint and volume label
    drawPill(ctx, bx2 - 58, by2 + 13, 116, 24, '拖动活塞改变 V', COLORS.accentGreen, withAlpha(COLORS.accentGreen, 0.12));

    lastPistonDrag = {
      screenX: bx2,
      screenY: by1,
      screenH: by2 - by1,
      scale,
      ox,
      minW: MIN_CONTAINER_W_WORLD,
      maxW: MAX_CONTAINER_W_WORLD,
    };

    drawPressureMeter(ctx, bx2 + 20, by1 + 34, Math.min(160, by2 - by1 - 74), displayPressure, collisionRateSmooth);

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
    ctx.strokeStyle = lineInk(0.12);
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

    // Particles using pre-rendered sprites (fast + crisp glow)
    const r = Math.max(5, PARTICLE_R * scale);
    for (let i = 0; i < n; i++) {
      const px = state[`px${i}`] || 0, py = state[`py${i}`] || 0;
      const vx = state[`vx${i}`] || 0, vy = state[`vy${i}`] || 0;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const frac = Math.min(1, speed / Math.max(0.01, maxSpeedForColor));
      const color = speedToColor(frac);

      // screen position (origin at bx1,by2 with y-up scale)
      const sx = bx1 + px * scale;
      const sy = by2 - py * scale;
      const spr = getParticleSprite(frac, r);
      const half = spr.width / 2;
      ctx.drawImage(spr, sx - half, sy - half);

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

    // 2D Maxwell speed distribution (Rayleigh): f(v) = (v/σ²)·exp(-v²/2σ²).
    // σ is the per-component std-dev in world units, derived identically to
    // createInitialState so the theory curve matches the simulated speeds.
    const vRmsTheory = Math.sqrt(3 * kB * T / mN2);
    const worldSpeedScale = 4.0 / Math.sqrt(3 * kB * 300 / mN2);
    const sigma = (vRmsTheory / Math.sqrt(3)) * worldSpeedScale;
    const sigmaSq = sigma * sigma;
    const mbX: number[] = [], mbY: number[] = [];
    for (let i = 0; i < 100; i++) {
      const v = (i + 0.5) * maxGraphSpeed / 100;
      const fv = (v / sigmaSq) * Math.exp(-(v * v) / (2 * sigmaSq));
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
  grad.addColorStop(0.56, surface(0.96));
  grad.addColorStop(1, `rgba(239,68,68,${0.05 + tempFrac * 0.10})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = gridLine();
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
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const flash of flashes) {
    const sx = bx1 + flash.x * scale;
    const sy = by2 - flash.y * scale;
    const alpha = flash.life * 0.7;
    const radius = 5 + (1 - flash.life) * 16 * flash.strength;

    // core glow
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, radius);
    grad.addColorStop(0, `rgba(180,240,255,${alpha})`);
    grad.addColorStop(0.4, `rgba(56,189,248,${alpha * 0.5})`);
    grad.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();

    // sparks shooting inward from the wall
    const travel = (1 - flash.life) * 22 * flash.strength;
    for (const spark of flash.sparks) {
      const dist = travel * spark.spd;
      const ex = sx + Math.cos(spark.ang) * dist;
      const ey = sy - Math.sin(spark.ang) * dist;
      const sparkAlpha = flash.life * 0.85;
      ctx.strokeStyle = `rgba(120,220,255,${sparkAlpha})`;
      ctx.lineWidth = 1.6 * flash.life;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.fillStyle = `rgba(200,245,255,${sparkAlpha})`;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.4 * flash.life, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ── Glass tube walls ──────────────────────────────────────────────────
function drawGlassWalls(
  ctx: CanvasRenderingContext2D,
  bx1: number, by1: number, bx2: number, by2: number,
  cornerR: number,
): void {
  const thickness = 6;
  // outer dark frame stroke along left/top/bottom
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // glass body gradient (subtle blue-green tint, thicker)
  const drawWallPath = () => {
    ctx.beginPath();
    ctx.moveTo(bx2, by1);
    ctx.lineTo(bx1 + cornerR, by1);
    ctx.arcTo(bx1, by1, bx1, by1 + cornerR, cornerR);
    ctx.lineTo(bx1, by2 - cornerR);
    ctx.arcTo(bx1, by2, bx1 + cornerR, by2, cornerR);
    ctx.lineTo(bx2, by2);
  };

  // thick translucent glass base
  drawWallPath();
  ctx.strokeStyle = 'rgba(120,144,156,0.35)';
  ctx.lineWidth = thickness + 3;
  ctx.stroke();

  // main wall
  drawWallPath();
  const wallGrad = ctx.createLinearGradient(bx1 - thickness, 0, bx1 + thickness, 0);
  wallGrad.addColorStop(0, '#37474F');
  wallGrad.addColorStop(0.5, '#607D8B');
  wallGrad.addColorStop(1, '#90A4AE');
  ctx.strokeStyle = wallGrad;
  ctx.lineWidth = thickness;
  ctx.stroke();

  // inner specular highlight line
  drawWallPath();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();

  // top inner reflection strip
  const refl = ctx.createLinearGradient(0, by1, 0, by1 + 22);
  refl.addColorStop(0, 'rgba(255,255,255,0.4)');
  refl.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = refl;
  ctx.fillRect(bx1 + 4, by1 + 3, bx2 - bx1 - 8, 20);
  ctx.restore();
}

// ── Brushed-metal piston ──────────────────────────────────────────────
function drawMetalPiston(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  ctx.save();
  ctx.shadowColor = 'rgba(15,23,42,0.28)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = -3;

  // metal body — vertical brushed gradient
  const grad = ctx.createLinearGradient(x, 0, x + w, 0);
  grad.addColorStop(0, '#546E7A');
  grad.addColorStop(0.35, '#CFD8DC');
  grad.addColorStop(0.5, '#ECEFF1');
  grad.addColorStop(0.65, '#B0BEC5');
  grad.addColorStop(1, '#546E7A');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;

  // brushed metal vertical lines
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.5;
  for (let lx = x + 2; lx < x + w; lx += 2.5) {
    ctx.beginPath();
    ctx.moveTo(lx, y + 1);
    ctx.lineTo(lx, y + h - 1);
    ctx.stroke();
  }

  // bevel edges
  ctx.strokeStyle = '#37474F';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);

  // grip rod extending up from piston
  const rodW = w * 0.45;
  const rodX = x + (w - rodW) / 2;
  const rodGrad = ctx.createLinearGradient(rodX, 0, rodX + rodW, 0);
  rodGrad.addColorStop(0, '#78909C');
  rodGrad.addColorStop(0.5, '#ECEFF1');
  rodGrad.addColorStop(1, '#78909C');
  ctx.fillStyle = rodGrad;
  ctx.fillRect(rodX, y - 16, rodW, 16);

  // horizontal grip notches
  ctx.strokeStyle = 'rgba(0,0,0,0.22)';
  ctx.lineWidth = 1;
  for (let gy = y + 10; gy < y + h - 6; gy += 11) {
    ctx.beginPath();
    ctx.moveTo(x + 2.5, gy);
    ctx.lineTo(x + w - 2.5, gy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPressureMeter(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  height: number,
  pressure: number,
  collisionRate: number,
): void {
  const meterW = 46;
  const fillFrac = clamp(pressure / 12, 0, 1);
  roundRect(ctx, x, y, meterW, height, 12);
  ctx.fillStyle = surface(0.84);
  ctx.fill();
  ctx.strokeStyle = lineInk(0.12);
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

  // ── Collision-rate readout below the meter: the MECHANISM behind pressure ──
  const cy = y + height + 14;
  ctx.fillStyle = COLORS.arrowPressure;
  ctx.font = 'bold 14px -apple-system, sans-serif';
  ctx.fillText(`${Math.round(collisionRate)}`, x + meterW / 2, cy);
  ctx.fillStyle = COLORS.textDim;
  ctx.font = '9px -apple-system, sans-serif';
  ctx.fillText('碰壁/秒', x + meterW / 2, cy + 13);

  // small bar visualizing collision rate (mirrors pressure fill)
  const rateFrac = clamp(collisionRate / 4000, 0, 1);
  const barW = meterW - 6;
  ctx.fillStyle = 'rgba(21,101,192,0.12)';
  roundRect(ctx, x + 3, cy + 18, barW, 5, 2.5);
  ctx.fill();
  ctx.fillStyle = adjustAlpha(COLORS.arrowPressure, 0.75);
  roundRect(ctx, x + 3, cy + 18, barW * rateFrac, 5, 2.5);
  ctx.fill();
}

// Wall bombardment glow — the 3 fixed walls visibly "light up" with collision
// intensity, making the causal link "more/harder collisions → higher pressure"
// visible to students.
function drawWallBombardment(
  ctx: CanvasRenderingContext2D,
  bx1: number, by1: number, bx2: number, by2: number,
  collisionRate: number,
): void {
  const intensity = clamp(collisionRate / 4000, 0, 1);
  if (intensity < 0.02) return;
  const glowW = 4 + intensity * 14;
  const a = 0.4 * intensity;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  // left wall (glow extends rightward, into the box)
  let g = ctx.createLinearGradient(bx1, 0, bx1 + glowW, 0);
  g.addColorStop(0, `rgba(255,140,80,${a})`);
  g.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(bx1, by1, glowW, by2 - by1);

  // top wall (glow extends downward)
  g = ctx.createLinearGradient(0, by1, 0, by1 + glowW);
  g.addColorStop(0, `rgba(255,140,80,${a})`);
  g.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(bx1, by1, bx2 - bx1, glowW);

  // bottom wall (glow extends upward)
  g = ctx.createLinearGradient(0, by2, 0, by2 - glowW);
  g.addColorStop(0, `rgba(255,140,80,${a})`);
  g.addColorStop(1, 'rgba(255,140,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(bx1, by2 - glowW, bx2 - bx1, glowW);

  ctx.restore();
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
