import type { GraphTrace } from '@physics/core';
import type { ThermoState, SceneModule, RenderContext, StateDisplayData } from '../types';
import { COLORS, CANVAS_FONTS, speedToColor, surface, lineInk, shadowInk, withAlpha } from '../theme';
import { createSeededRandom, clamp } from '../params';

const PARTICLE_R = 0.08;
const kB = 1.38e-23;
const mN2 = 4.65e-26;
const BOX_W = 8;
const BOX_H = 8;

export const brownianScene: SceneModule = {
  createInitialState(params, seed) {
    const random = createSeededRandom(seed);
    const T = Number(params.brownTemperature) || 300;
    const n = clamp(Math.floor(Number(params.brownNumParticles) || 200), 50, 500);
    const brownR = clamp(Number(params.brownRadius) || 1.0, 0.1, 10) * 0.04;
    const vRms = Math.sqrt(3 * kB * T / mN2);
    const worldSpeedScale = 4.0 / Math.sqrt(3 * kB * 300 / mN2);

    const s: ThermoState = { t: 0 };
    for (let i = 0; i < n; i++) {
      s[`px${i}`] = random() * (BOX_W - 2 * PARTICLE_R) + PARTICLE_R;
      s[`py${i}`] = random() * (BOX_H - 2 * PARTICLE_R) + PARTICLE_R;
      const u1 = random(), u2 = random();
      const sigma = vRms / Math.sqrt(3) * worldSpeedScale;
      s[`vx${i}`] = sigma * Math.sqrt(-2 * Math.log(Math.max(1e-10, u1))) * Math.cos(2 * Math.PI * u2);
      const u3 = random(), u4 = random();
      s[`vy${i}`] = sigma * Math.sqrt(-2 * Math.log(Math.max(1e-10, u3))) * Math.cos(2 * Math.PI * u4);
    }
    s.brownX = BOX_W / 2;
    s.brownY = BOX_H / 2;
    s.brownVx = 0;
    s.brownVy = 0;
    s.brownR = brownR;
    s.nParticles = n;
    s.lastTrailTime = 0;
    s.trailCount = 0;
    return s;
  },

  createStepFn(params) {
    const n = clamp(Math.floor(Number(params.brownNumParticles) || 200), 50, 500);
    const brownR = clamp(Number(params.brownRadius) || 1.0, 0.1, 10) * 0.04;
    const massRatio = 0.01 / (brownR * brownR * brownR * 100);
    const trailInterval = Number(params.trailInterval) || 0.5;

    return (_t: number, dt: number, state: ThermoState): ThermoState => {
      const s: ThermoState = { ...state, t: state.t + dt };

      for (let i = 0; i < n; i++) {
        s[`px${i}`] += s[`vx${i}`] * dt;
        s[`py${i}`] += s[`vy${i}`] * dt;
        if (s[`px${i}`] < PARTICLE_R) { s[`px${i}`] = PARTICLE_R; s[`vx${i}`] *= -1; }
        if (s[`px${i}`] > BOX_W - PARTICLE_R) { s[`px${i}`] = BOX_W - PARTICLE_R; s[`vx${i}`] *= -1; }
        if (s[`py${i}`] < PARTICLE_R) { s[`py${i}`] = PARTICLE_R; s[`vy${i}`] *= -1; }
        if (s[`py${i}`] > BOX_H - PARTICLE_R) { s[`py${i}`] = BOX_H - PARTICLE_R; s[`vy${i}`] *= -1; }
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
            // separate overlap so molecules don't stick together
            const overlap = minDist - dist;
            if (overlap > 0) {
              s[`px${i}`] -= nx * overlap * 0.5; s[`py${i}`] -= ny * overlap * 0.5;
              s[`px${j}`] += nx * overlap * 0.5; s[`py${j}`] += ny * overlap * 0.5;
            }
          }
        }
      }

      s.brownX += s.brownVx * dt;
      s.brownY += s.brownVy * dt;
      if (s.brownX < brownR) { s.brownX = brownR; s.brownVx *= -1; }
      if (s.brownX > BOX_W - brownR) { s.brownX = BOX_W - brownR; s.brownVx *= -1; }
      if (s.brownY < brownR) { s.brownY = brownR; s.brownVy *= -1; }
      if (s.brownY > BOX_H - brownR) { s.brownY = BOX_H - brownR; s.brownVy *= -1; }

      for (let i = 0; i < n; i++) {
        const dx = s[`px${i}`] - s.brownX;
        const dy = s[`py${i}`] - s.brownY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const minDist = PARTICLE_R + brownR;
        if (dist < minDist && dist > 0) {
          const nx = dx / dist, ny = dy / dist;
          const dvx = s[`vx${i}`] - s.brownVx;
          const dvy = s[`vy${i}`] - s.brownVy;
          const dvDotN = dvx * nx + dvy * ny;
          if (dvDotN < 0) {
            const j = 2 * dvDotN / (1 + massRatio);
            s[`vx${i}`] -= j * nx; s[`vy${i}`] -= j * ny;
            s.brownVx += j * nx * massRatio;
            s.brownVy += j * ny * massRatio;
          }
          const overlap = minDist - dist;
          s[`px${i}`] += nx * overlap * 0.5; s[`py${i}`] += ny * overlap * 0.5;
          s.brownX -= nx * overlap * 0.5; s.brownY -= ny * overlap * 0.5;
        }
      }

      if (s.t - s.lastTrailTime >= trailInterval) {
        s[`trailX${Math.floor(s.trailCount)}`] = s.brownX;
        s[`trailY${Math.floor(s.trailCount)}`] = s.brownY;
        s.trailCount++;
        s.lastTrailTime = s.t;
        if (s.trailCount > 500) s.trailCount = 500;
      }

      return s;
    };
  },

  render(t, state, rctx, params) {
    const { cm } = rctx;
    const ctx = cm.ctx;
    const n = clamp(Math.floor(Number(params.brownNumParticles) || 200), 50, 500);
    const brownR = clamp(Number(params.brownRadius) || 1.0, 0.1, 10) * 0.04;
    const T = Number(params.brownTemperature) || 300;

    cm.clear(COLORS.canvasBg);
    const scale = Math.min((rctx.canvasWidth - 100) / BOX_W, (rctx.canvasHeight - 80) / BOX_H) * 0.90;
    const ox = (rctx.canvasWidth - BOX_W * scale) / 2;
    const oy = 44;
    const bx1 = ox, by1 = oy;
    const bx2 = ox + BOX_W * scale, by2 = oy + BOX_H * scale;

    // Container drop shadow
    ctx.save();
    ctx.shadowColor = shadowInk(0.14);
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = COLORS.canvasBg;
    ctx.fillRect(bx1, by1, bx2 - bx1, by2 - by1);
    ctx.restore();

    // Container inner fill — glass-box curvature (2.5D): darker glass edges,
    // brighter centre.
    const cornerR = 8;
    const boxGrad = ctx.createLinearGradient(bx1, by1, bx2, by1);
    boxGrad.addColorStop(0, withAlpha(COLORS.moleculeCool, 0.12));
    boxGrad.addColorStop(0.5, withAlpha(COLORS.moleculeCool, 0.04));
    boxGrad.addColorStop(1, withAlpha(COLORS.moleculeCool, 0.12));
    ctx.fillStyle = boxGrad;
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

    // Glass specular highlight strip (left-of-centre)
    ctx.fillStyle = surface(0.45);
    ctx.fillRect(bx1 + (bx2 - bx1) * 0.22, by1 + 3, Math.max(2, (bx2 - bx1) * 0.04), by2 - by1 - 6);

    // Inner edge glow
    const edgeGrad = ctx.createLinearGradient(bx1, by1, bx1, by1 + 20);
    edgeGrad.addColorStop(0, 'rgba(144,202,249,0.12)');
    edgeGrad.addColorStop(1, 'rgba(144,202,249,0)');
    ctx.fillStyle = edgeGrad;
    ctx.fillRect(bx1 + 2, by1 + 2, bx2 - bx1 - 4, 18);

    // Container border
    ctx.strokeStyle = COLORS.containerBorder;
    ctx.lineWidth = 3.5;
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
    ctx.stroke();

    // Title
    ctx.fillStyle = COLORS.textPrimary;
    ctx.font = CANVAS_FONTS.title;
    ctx.textAlign = 'left';
    ctx.fillText(`布朗运动  T = ${T} K`, bx1, by1 - 16);

    ctx.font = CANVAS_FONTS.annotation;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.fillText(`颗粒半径 = ${(brownR / 0.04).toFixed(1)} μm  |  分子数 = ${n}`, bx1, by2 + 22);

    // Use world coordinate system for particles
    cm.setOrigin(bx1, by2);
    cm.setScale(scale);

    // Gas molecules using drawBall
    for (let i = 0; i < n; i++) {
      const px = state[`px${i}`] || 0, py = state[`py${i}`] || 0;
      const vx = state[`vx${i}`] || 0, vy = state[`vy${i}`] || 0;
      const speed = Math.sqrt(vx * vx + vy * vy);
      const frac = Math.min(1, speed / 8);
      const color = speedToColor(frac);
      ctx.globalAlpha = 0.8;
      cm.drawBall(px, py, Math.max(4, PARTICLE_R * scale), color, { glow: false });
      ctx.globalAlpha = 1;
    }

    // Trail — thicker with fade
    const trailCount = Math.floor(state.trailCount || 0);
    if (trailCount > 1) {
      const toSx = (wx: number) => bx1 + wx * scale;
      const toSy = (wy: number) => by2 - wy * scale;

      ctx.strokeStyle = COLORS.brownianTrail;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(toSx(state.trailX0 || 0), toSy(state.trailY0 || 0));
      for (let i = 1; i < trailCount; i++) {
        ctx.lineTo(toSx(state[`trailX${i}`] || 0), toSy(state[`trailY${i}`] || 0));
      }
      ctx.stroke();

      for (let i = 0; i < trailCount; i++) {
        const age = (trailCount - i) / Math.max(1, trailCount);
        ctx.globalAlpha = 0.4 + 0.6 * (1 - age);
        ctx.beginPath();
        ctx.arc(toSx(state[`trailX${i}`] || 0), toSy(state[`trailY${i}`] || 0), 4.5, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.brownianTrail;
        ctx.fill();
        ctx.strokeStyle = surface(1);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Brownian particle — using drawBall with glow
    const brownWX = state.brownX || 0;
    const brownWY = state.brownY || 0;
    const br = Math.max(14, brownR * scale);
    cm.drawBall(brownWX, brownWY, br, COLORS.brownianParticle, { glow: true, label: '花粉', labelColor: COLORS.canvasBg });

    cm.applyBloom(0.15);

    // Restore coordinate system
    cm.setOrigin(rctx.canvasWidth / 2, rctx.canvasHeight * 0.75);
    cm.setScale(100);

    // Legend card — top right with background
    const legendX = bx2 + 20;
    const legendY = by1 + 8;
    ctx.save();
    ctx.fillStyle = surface(0.9);
    ctx.strokeStyle = lineInk(0.1);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(legendX - 8, legendY - 8, 130, 80, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = CANVAS_FONTS.annotation;
    ctx.textAlign = 'left';

    ctx.beginPath();
    ctx.arc(legendX + 6, legendY + 8, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.brownianParticle;
    ctx.fill();
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = CANVAS_FONTS.annotation;
    ctx.fillText('花粉颗粒', legendX + 18, legendY + 12);

    ctx.globalAlpha = 0.8;
    ctx.beginPath();
    ctx.arc(legendX + 6, legendY + 32, 4, 0, Math.PI * 2);
    ctx.fillStyle = speedToColor(0.5);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.textSecondary;
    ctx.font = CANVAS_FONTS.annotation;
    ctx.fillText('气体分子', legendX + 18, legendY + 36);

    ctx.fillStyle = COLORS.brownianTrail;
    ctx.font = CANVAS_FONTS.annotation;
    ctx.fillText('— 运动轨迹', legendX + 2, legendY + 58);

    ctx.restore();
  },

  getGraphTraces(params, state): GraphTrace[] {
    const trailCount = Math.floor(state.trailCount || 0);
    if (trailCount < 2) return [];

    const xData: number[] = [];
    const yData: number[] = [];
    const trailInterval = Number(params.trailInterval) || 0.5;

    for (let i = 0; i < trailCount; i++) {
      xData.push(i * trailInterval);
      const dx = (state[`trailX${i}`] || 0) - (state.trailX0 || 0);
      const dy = (state[`trailY${i}`] || 0) - (state.trailY0 || 0);
      yData.push(Math.sqrt(dx * dx + dy * dy));
    }

    return [
      { x: xData, y: yData, name: '位移', color: COLORS.brownianTrail },
    ];
  },

  getStateDisplay(params, state): StateDisplayData {
    const T = Number(params.brownTemperature) || 300;
    const trailCount = Math.floor(state.trailCount || 0);
    // displacement from the starting point (the pedagogically meaningful value)
    const dx = (state.brownX || 0) - (state.trailX0 ?? state.brownX ?? 0);
    const dy = (state.brownY || 0) - (state.trailY0 ?? state.brownY ?? 0);
    const disp = Math.sqrt(dx * dx + dy * dy);
    return {
      T,
      customEntries: [
        { label: '位移 d', value: `${disp.toFixed(2)}`, highlight: true },
        { label: '颗粒半径', value: `${((Number(state.brownR) || 0.04) / 0.04).toFixed(1)} μm` },
        { label: '轨迹点数', value: String(trailCount) },
      ],
    };
  },
};
