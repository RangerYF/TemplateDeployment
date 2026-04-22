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
} from '@physics/core';
import type { SimState, GraphTrace } from '@physics/core';

// --- State ---
interface MotionState extends SimState {
  x: number;      // horizontal position (m)
  y: number;      // vertical position (m)
  vx: number;     // horizontal velocity (m/s)
  vy: number;     // vertical velocity (m/s)
  theta: number;  // angle for circular motion (rad)
  // Incline motion extras
  s: number;      // displacement along slope (m)
  vs: number;     // velocity along slope (m/s)
  // Vertical circular motion extras
  angularPos: number;   // angular position on circle (rad, 0 = bottom)
  vTangential: number;  // tangential speed (m/s)
  leftTrack: boolean;   // whether object has left the track
  // Multi-object comparison
  obj2x: number; obj2y: number; obj2vx: number; obj2vy: number;
  obj3x: number; obj3y: number; obj3vx: number; obj3vy: number;
}

// --- Scene types ---
type SceneType =
  | '匀速直线'
  | '匀变速直线'
  | '抛体运动'
  | '圆周运动'
  | '斜面运动'
  | '斜面上平抛'
  | '竖直圆周运动'
  | '多物体对比';

const G = GRAVITY; // gravity (m/s^2)

// --- Setup ---
const app = document.getElementById('app')!;
const layout = createLayout(app, 'P-02 运动模拟');

// Parameters
const paramDefs = defineParams([
  {
    key: 'scene', label: '场景', type: 'select', default: '匀速直线',
    options: [
      '匀速直线', '匀变速直线', '抛体运动', '圆周运动',
      '斜面运动', '斜面上平抛', '竖直圆周运动', '多物体对比',
    ],
  },
  { key: 'v0', label: '初速度 v₀', unit: 'm/s', min: 0, max: 20, step: 0.5, default: 5,
    scenes: ['匀速直线', '匀变速直线', '抛体运动', '斜面运动', '斜面上平抛', '多物体对比'] },
  { key: 'accel', label: '加速度 a', unit: 'm/s²', min: -10, max: 10, step: 0.5, default: 2,
    scenes: ['匀变速直线'] },
  { key: 'launchAngle', label: '发射角 θ', unit: '°', min: 5, max: 85, step: 1, default: 45,
    scenes: ['抛体运动'] },
  { key: 'radius', label: '半径 R', unit: 'm', min: 0.5, max: 5, step: 0.1, default: 2,
    scenes: ['圆周运动'] },
  { key: 'omega', label: '角速度 ω', unit: 'rad/s', min: 0.5, max: 6, step: 0.1, default: 2,
    scenes: ['圆周运动'] },
  // Incline params
  { key: 'slopeAngle', label: '斜面角度 θ', unit: '°', min: 5, max: 75, step: 1, default: 30,
    scenes: ['斜面运动', '斜面上平抛'] },
  { key: 'friction', label: '摩擦系数 μ', unit: '', min: 0, max: 1, step: 0.05, default: 0.2,
    scenes: ['斜面运动'] },
  { key: 'inclineDir', label: '初速方向', type: 'select', default: '沿斜面下滑',
    options: ['沿斜面下滑', '沿斜面上滑'],
    scenes: ['斜面运动'] },
  // Vertical circular motion params
  { key: 'vcircR', label: '圆半径 R', unit: 'm', min: 0.5, max: 4, step: 0.1, default: 2,
    scenes: ['竖直圆周运动'] },
  { key: 'vcircV0', label: '底部速度 v₀', unit: 'm/s', min: 1, max: 20, step: 0.5, default: 8,
    scenes: ['竖直圆周运动'] },
  { key: 'vcircType', label: '约束类型', type: 'select', default: '绳',
    options: ['绳', '杆'],
    scenes: ['竖直圆周运动'] },
  { key: 'showVectors', label: '显示矢量', type: 'checkbox', default: true,
    scenes: ['匀速直线', '匀变速直线', '抛体运动', '圆周运动', '斜面运动', '斜面上平抛', '竖直圆周运动', '多物体对比'] },
  { key: 'showTrail', label: '显示轨迹', type: 'checkbox', default: true,
    scenes: ['匀速直线', '匀变速直线', '抛体运动', '圆周运动', '斜面运动', '斜面上平抛', '竖直圆周运动', '多物体对比'] },
]);

const panel = new ParameterPanel(layout.sidebar, paramDefs);

// Info display in sidebar
const infoDiv = document.createElement('div');
infoDiv.style.cssText = 'margin-top:20px;padding:12px;background:rgba(255,255,255,0.05);border-radius:6px;font-size:14px;color:#94a3b8;line-height:1.8;';
layout.sidebar.appendChild(infoDiv);

// Canvas
const cm = new CanvasManager({ container: layout.canvas });
cm.setScale(50);

const arrows = new ArrowRenderer(cm);
const grid = new GridRenderer(cm);

// Graphs
const graphContainer1 = document.createElement('div');
graphContainer1.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer1);

const graphContainer2 = document.createElement('div');
graphContainer2.style.flex = '1';
layout.bottomPanel.appendChild(graphContainer2);

const graph1 = new SyncedGraph({
  container: graphContainer1,
  title: '位移-时间',
  xLabel: 't (s)',
  yLabel: 'x (m)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

const graph2 = new SyncedGraph({
  container: graphContainer2,
  title: '速度-时间',
  xLabel: 't (s)',
  yLabel: 'v (m/s)',
  height: 260,
  onTimeClick: (t) => sim.jumpTo(t),
});

// History for graph traces
const timeData: number[] = [];
const xData: number[] = [];
const yData: number[] = [];
const vxData: number[] = [];
const vyData: number[] = [];
const vMagData: number[] = [];
// Extra data for incline scene
const sData: number[] = [];
const vsData: number[] = [];
// Extra data for multi-object
const obj2xData: number[] = [];
const obj2yData: number[] = [];
const obj3xData: number[] = [];
const obj3yData: number[] = [];
const obj2vData: number[] = [];
const obj3vData: number[] = [];

// Trail
const trail: { x: number; y: number }[] = [];
// Multi-object trails
const trail2: { x: number; y: number }[] = [];
const trail3: { x: number; y: number }[] = [];

// Playback
const controls = new PlaybackControls(layout.controlBar);

// --- Helpers ---
function getScene(): SceneType {
  return panel.getValue<string>('scene') as SceneType;
}

function defaultState(): MotionState {
  return {
    x: 0, y: 0, vx: 0, vy: 0, theta: 0,
    s: 0, vs: 0,
    angularPos: 0, vTangential: 0, leftTrack: false,
    obj2x: 0, obj2y: 0, obj2vx: 0, obj2vy: 0,
    obj3x: 0, obj3y: 0, obj3vx: 0, obj3vy: 0,
  };
}

// --- Physics ---
function createStepFn() {
  const scene = getScene();
  const v0 = panel.getValue<number>('v0');
  const a = panel.getValue<number>('accel');
  const angleDeg = panel.getValue<number>('launchAngle');
  const angleRad = angleDeg * Math.PI / 180;
  const R = panel.getValue<number>('radius');
  const omega = panel.getValue<number>('omega');
  const slopeAngleDeg = panel.getValue<number>('slopeAngle');
  const slopeAngleRad = slopeAngleDeg * Math.PI / 180;
  const mu = panel.getValue<number>('friction');
  const inclineDir = panel.getValue<string>('inclineDir');
  const vcircR = panel.getValue<number>('vcircR');
  const vcircV0 = panel.getValue<number>('vcircV0');
  const vcircType = panel.getValue<string>('vcircType');

  return (_t: number, dt: number, state: MotionState): MotionState => {
    let {
      x, y, vx, vy, theta,
      s, vs,
      angularPos, vTangential, leftTrack,
      obj2x, obj2y, obj2vx, obj2vy,
      obj3x, obj3y, obj3vx, obj3vy,
    } = state;

    switch (scene) {
      case '匀速直线': {
        x += vx * dt;
        break;
      }
      case '匀变速直线': {
        vx += a * dt;
        x += vx * dt;
        break;
      }
      case '抛体运动': {
        x += vx * dt;
        vy += -G * dt;
        y += vy * dt;
        if (y < 0) {
          y = 0;
          vy = 0;
          vx = 0;
        }
        break;
      }
      case '圆周运动': {
        theta += omega * dt;
        x = R * Math.cos(theta);
        y = R * Math.sin(theta);
        vx = -R * omega * Math.sin(theta);
        vy = R * omega * Math.cos(theta);
        break;
      }

      // ======== 斜面运动 (Incline Motion) ========
      case '斜面运动': {
        // vs > 0 means moving up the slope; vs < 0 means moving down
        let aSlope: number;
        if (vs > 0.001) {
          // Going up: gravity component and friction both oppose motion
          aSlope = -G * (Math.sin(slopeAngleRad) + mu * Math.cos(slopeAngleRad));
        } else if (vs < -0.001) {
          // Going down: gravity component drives, friction opposes
          aSlope = -G * (Math.sin(slopeAngleRad) - mu * Math.cos(slopeAngleRad));
          // If friction >= gravity component, deceleration may overshoot → clamp
          if (G * Math.sin(slopeAngleRad) <= mu * G * Math.cos(slopeAngleRad)) {
            // Friction can stop the object; check if velocity would cross zero this step
            const newVs = vs + aSlope * dt;
            if (newVs >= 0) { aSlope = 0; vs = 0; }
          }
        } else {
          // At rest: check if gravity can overcome static friction
          const netDown = G * Math.sin(slopeAngleRad) - mu * G * Math.cos(slopeAngleRad);
          if (netDown > 0) {
            aSlope = -netDown; // starts sliding down (negative s direction = down slope)
          } else {
            aSlope = 0;
          }
        }

        vs += aSlope * dt;
        s += vs * dt;

        // Convert to x,y for rendering (slope goes from bottom-left to upper-right)
        x = s * Math.cos(slopeAngleRad);
        y = s * Math.sin(slopeAngleRad);

        // Stop if object reaches bottom of slope and was going down
        if (s < 0 && vs < 0) {
          s = 0;
          vs = 0;
          x = 0;
          y = 0;
        }

        // Velocity components for display
        vx = vs * Math.cos(slopeAngleRad);
        vy = vs * Math.sin(slopeAngleRad);
        break;
      }

      // ======== 斜面上平抛 (Projectile from Incline Edge) ========
      case '斜面上平抛': {
        // Standard projectile: horizontal v0, vertical g downward
        x += vx * dt;
        vy += -G * dt;
        y += vy * dt;

        // Check if projectile has hit the incline surface (y <= -x * tan(slopeAngle))
        // The incline extends to the right and downward from origin
        const slopeY = -x * Math.tan(slopeAngleRad);
        if (x > 0 && y <= slopeY) {
          y = slopeY;
          vx = 0;
          vy = 0;
        }
        break;
      }

      // ======== 竖直圆周运动 (Vertical Circular Motion) ========
      case '竖直圆周运动': {
        if (!leftTrack) {
          // angularPos: 0 = bottom of circle, measured counterclockwise
          // Tangential acceleration = -g * sin(angularPos) (component along tangent)
          // At bottom (angularPos=0): sin(0)=0, no tangential gravity component ✓
          // At angularPos = pi/2 (side, going up): sin(pi/2)=1, full gravity opposes ✓
          const aTangential = -G * Math.sin(angularPos);
          vTangential += aTangential * dt;
          const dTheta = (vTangential / vcircR) * dt;
          angularPos += dTheta;

          // Position: center of circle at (0, vcircR), bottom at (0, 0)
          x = vcircR * Math.sin(angularPos);
          y = vcircR - vcircR * Math.cos(angularPos);

          // Check if object leaves track (for string: normal force <= 0)
          if (vcircType === '绳') {
            // At angle angularPos from bottom:
            // Height above bottom = R - R*cos(angularPos) = R(1 - cos(angularPos))
            // By energy conservation: v^2 = v0^2 - 2gR(1 - cos(angularPos))
            // Normal force condition: N = mv^2/R - mg*cos(angularPos - pi)
            // Actually: let's compute centripetal requirement
            // The component of gravity toward center depends on position
            // Radial outward direction at angularPos from bottom: (sinφ, -cosφ)
            // Gravity radial outward component = (0,-g)·(sinφ,-cosφ) = g·cosφ
            // N = m(v²/R - g·cosφ); string leaves track when N<0 → v²/R < g·cosφ
            // At top (φ=π): g·cos(π)=-g, so condition is v²/R<-g → never (always satisfied for v>0)
            // Only leaves track when cosφ>0 (below horizontal diameter)
            const vSq = vTangential * vTangential;
            const gravRadialOutward = G * Math.cos(angularPos); // positive outward below horizontal
            const centripetal = vSq / vcircR;
            if (centripetal < gravRadialOutward) {
              // Object leaves track
              leftTrack = true;
              // Set vx, vy for free projectile from current position
              vx = vTangential * Math.cos(angularPos);
              vy = vTangential * Math.sin(angularPos);
            }
          }
          // For rod, object never leaves track (rod can push and pull)

          if (!leftTrack) {
            vx = vTangential * Math.cos(angularPos);
            vy = vTangential * Math.sin(angularPos);
          }
        } else {
          // Free projectile after leaving track
          x += vx * dt;
          vy += -G * dt;
          y += vy * dt;
        }
        break;
      }

      // ======== 多物体对比 (Multi-object comparison) ========
      case '多物体对比': {
        // Three projectiles with different launch angles: 30, 45, 60 degrees
        // Object 1: 30 degrees
        x += vx * dt;
        vy += -G * dt;
        y += vy * dt;
        if (y < 0) { y = 0; vy = 0; vx = 0; }

        // Object 2: 45 degrees
        obj2x += obj2vx * dt;
        obj2vy += -G * dt;
        obj2y += obj2vy * dt;
        if (obj2y < 0) { obj2y = 0; obj2vy = 0; obj2vx = 0; }

        // Object 3: 60 degrees
        obj3x += obj3vx * dt;
        obj3vy += -G * dt;
        obj3y += obj3vy * dt;
        if (obj3y < 0) { obj3y = 0; obj3vy = 0; obj3vx = 0; }

        break;
      }
    }

    return {
      x, y, vx, vy, theta,
      s, vs,
      angularPos, vTangential, leftTrack,
      obj2x, obj2y, obj2vx, obj2vy,
      obj3x, obj3y, obj3vx, obj3vy,
    };
  };
}

function getInitialState(): MotionState {
  const scene = getScene();
  const v0 = panel.getValue<number>('v0');
  const angleDeg = panel.getValue<number>('launchAngle');
  const angleRad = angleDeg * Math.PI / 180;
  const R = panel.getValue<number>('radius');
  const inclineDir = panel.getValue<string>('inclineDir');
  const vcircV0 = panel.getValue<number>('vcircV0');

  const base = defaultState();

  switch (scene) {
    case '匀速直线':
      return { ...base, vx: v0 };
    case '匀变速直线':
      return { ...base, vx: v0 };
    case '抛体运动':
      return { ...base, vx: v0 * Math.cos(angleRad), vy: v0 * Math.sin(angleRad) };
    case '圆周运动':
      return { ...base, x: R, vy: R * panel.getValue<number>('omega') };
    case '斜面运动': {
      const vs0 = inclineDir === '沿斜面上滑' ? v0 : 0;
      const slopeAngleRad = panel.getValue<number>('slopeAngle') * Math.PI / 180;
      return {
        ...base,
        s: inclineDir === '沿斜面上滑' ? 0 : 3, // start partway up if sliding down
        vs: vs0,
        x: inclineDir === '沿斜面上滑' ? 0 : 3 * Math.cos(slopeAngleRad),
        y: inclineDir === '沿斜面上滑' ? 0 : 3 * Math.sin(slopeAngleRad),
        vx: vs0 * Math.cos(slopeAngleRad),
        vy: vs0 * Math.sin(slopeAngleRad),
      };
    }
    case '斜面上平抛':
      return { ...base, vx: v0 }; // launched horizontally from edge of slope
    case '竖直圆周运动':
      return {
        ...base,
        angularPos: 0,
        vTangential: vcircV0,
        vx: vcircV0,
        vy: 0,
      };
    case '多物体对比': {
      // Three projectiles: 30, 45, 60 degrees with same speed
      const a1 = 30 * Math.PI / 180;
      const a2 = 45 * Math.PI / 180;
      const a3 = 60 * Math.PI / 180;
      return {
        ...base,
        vx: v0 * Math.cos(a1), vy: v0 * Math.sin(a1),
        obj2vx: v0 * Math.cos(a2), obj2vy: v0 * Math.sin(a2),
        obj3vx: v0 * Math.cos(a3), obj3vy: v0 * Math.sin(a3),
      };
    }
    default:
      return base;
  }
}

function updateOrigin(): void {
  const scene = getScene();
  const W = cm.getWidth();
  const H = cm.getHeight();
  switch (scene) {
    case '匀速直线':
    case '匀变速直线':
      cm.setOrigin(W * 0.09, H * 0.76);
      cm.setScale(50);
      break;
    case '抛体运动':
      cm.setOrigin(W * 0.09, H * 0.84);
      cm.setScale(40);
      break;
    case '圆周运动':
      cm.setOrigin(W * 0.50, H * 0.52);
      cm.setScale(60);
      break;
    case '斜面运动':
      cm.setOrigin(W * 0.11, H * 0.84);
      cm.setScale(45);
      break;
    case '斜面上平抛':
      cm.setOrigin(W * 0.11, H * 0.40);
      cm.setScale(40);
      break;
    case '竖直圆周运动':
      cm.setOrigin(W * 0.50, H * 0.84);
      cm.setScale(55);
      break;
    case '多物体对比':
      cm.setOrigin(W * 0.09, H * 0.84);
      cm.setScale(35);
      break;
  }
}

// --- Render helpers ---
function drawTrailPath(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  color: string,
): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const [tx, ty] = cm.toScreen(pts[i].x, pts[i].y);
    if (i === 0) ctx.moveTo(tx, ty);
    else ctx.lineTo(tx, ty);
  }
  ctx.stroke();
  ctx.restore();
}

// --- Render ---
function renderScene(t: number, state: MotionState): void {
  const scene = getScene();
  const showVectors = panel.getValue<boolean>('showVectors');
  const showTrail = panel.getValue<boolean>('showTrail');
  const v0 = panel.getValue<number>('v0');
  const a = panel.getValue<number>('accel');
  const R = panel.getValue<number>('radius');
  const omega = panel.getValue<number>('omega');
  const slopeAngleDeg = panel.getValue<number>('slopeAngle');
  const slopeAngleRad = slopeAngleDeg * Math.PI / 180;
  const mu = panel.getValue<number>('friction');
  const vcircR = panel.getValue<number>('vcircR');
  const vcircV0 = panel.getValue<number>('vcircV0');
  const vcircType = panel.getValue<string>('vcircType');

  updateOrigin();
  cm.clear('#070b14');
  grid.draw({ majorSpacing: 1, showLabels: true, labelUnit: 'm' });

  const ctx = cm.ctx;
  const ballRadius = 14;

  // Trail (for single-object scenes)
  if (showTrail && scene !== '多物体对比') {
    trail.push({ x: state.x, y: state.y });
    if (trail.length > 600) trail.shift();
    drawTrailPath(ctx, trail, 'rgba(96, 165, 250, 0.35)');
  }

  switch (scene) {
    case '匀速直线':
    case '匀变速直线': {
      // Ground
      cm.drawTexturedGround(-2, 20, 0, 'concrete');

      // Ball
      cm.drawBall(state.x, state.y, ballRadius, '#60a5fa', { glow: true });

      // Info text near ball
      cm.drawText(`x = ${state.x.toFixed(2)} m`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: -10, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`v = ${state.vx.toFixed(2)} m/s`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: 12, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });

      // Vectors
      if (showVectors) {
        const vScale = 0.08;
        if (Math.abs(state.vx) > 0.01) {
          arrows.draw(state.x, state.y, state.vx * vScale, 0, {
            color: ARROW_COLORS.velocity,
            label: 'v',
            labelOffset: -18,
          });
        }
        if (scene === '匀变速直线' && Math.abs(a) > 0.01) {
          arrows.draw(state.x, state.y, a * vScale * 0.8, 0, {
            color: ARROW_COLORS.acceleration,
            label: 'a',
            labelOffset: 18,
          });
        }
      }
      break;
    }

    case '抛体运动': {
      // Ground
      cm.drawTexturedGround(-2, 20, 0, 'concrete');

      // Ball
      cm.drawBall(state.x, state.y, ballRadius, '#60a5fa', { glow: true });

      // Info
      const vMag = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      cm.drawText(`x = ${state.x.toFixed(2)} m`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: -24, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`y = ${state.y.toFixed(2)} m`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: -6, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`v = ${vMag.toFixed(2)} m/s`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: 12, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });

      // Vectors
      if (showVectors) {
        const vScale = 0.06;
        if (vMag > 0.05) {
          arrows.draw(state.x, state.y, state.vx * vScale, state.vy * vScale, {
            color: ARROW_COLORS.velocity,
            label: 'v',
            labelOffset: -18,
          });
        }
        if (Math.abs(state.vx) > 0.05) {
          arrows.draw(state.x, state.y, state.vx * vScale, 0, {
            color: ARROW_COLORS.velocity,
            dashed: true,
            label: 'vx',
            labelOffset: 18,
          });
        }
        if (Math.abs(state.vy) > 0.05) {
          arrows.draw(state.x, state.y, 0, state.vy * vScale, {
            color: ARROW_COLORS.velocity,
            dashed: true,
            label: 'vy',
            labelOffset: -18,
          });
        }
        if (state.y > 0.01 || Math.abs(state.vy) > 0.01) {
          arrows.draw(state.x, state.y, 0, -G * 0.04, {
            color: ARROW_COLORS.acceleration,
            label: 'g',
            labelOffset: 18,
          });
        }
      }
      break;
    }

    case '圆周运动': {
      // Draw circular path with glow
      const [cx, cy] = cm.toScreen(0, 0);
      const screenR = R * cm.getScale();
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'rgba(96, 165, 250, 0.3)';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(cx, cy, screenR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#64748b';
      ctx.fill();

      // Ball
      cm.drawBall(state.x, state.y, ballRadius, '#60a5fa', { glow: true });

      // Radius line
      cm.drawLine(0, 0, state.x, state.y, 'rgba(255,255,255,0.2)', 1, true);

      // Period
      const period = (2 * Math.PI) / omega;
      const vTan = R * omega;
      const aCent = R * omega * omega;

      cm.drawText(`T = ${period.toFixed(2)} s`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 10, offsetY: -24, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`v = ${vTan.toFixed(2)} m/s`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 10, offsetY: -6, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`a = ${aCent.toFixed(2)} m/s²`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 10, offsetY: 12, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });

      // Vectors
      if (showVectors) {
        const vScale = 0.06;
        if (vTan > 0.01) {
          arrows.draw(state.x, state.y, state.vx * vScale, state.vy * vScale, {
            color: ARROW_COLORS.velocity,
            label: 'v',
            labelOffset: -18,
          });
        }
        const aScale = 0.03;
        arrows.draw(state.x, state.y, -state.x * omega * omega * aScale, -state.y * omega * omega * aScale, {
          color: ARROW_COLORS.acceleration,
          label: 'a向心',
          labelOffset: 18,
        });
      }
      break;
    }

    // ======== 斜面运动 (Incline Motion) ========
    case '斜面运动': {
      const slopeLen = 8; // length of slope to draw (m)

      // Draw incline surface
      cm.drawIncline(0, 0, slopeLen, slopeAngleRad, 'concrete');

      // Screen coords for angle arc / ball offset calculations
      const [sx0, sy0] = cm.toScreen(0, 0);
      const [sx1, sy1] = cm.toScreen(
        slopeLen * Math.cos(slopeAngleRad),
        slopeLen * Math.sin(slopeAngleRad),
      );

      // Draw angle arc
      const arcR = 30;
      const screenSlopeAngle = Math.atan2(sy0 - sy1, sx1 - sx0);
      ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx0, sy0, arcR, -screenSlopeAngle, 0);
      ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`θ=${slopeAngleDeg}°`, sx0 + arcR + 4, sy0 - 4);

      // Ball on slope
      const [bx, by] = cm.toScreen(state.x, state.y);
      // Offset ball perpendicular to slope surface
      const screenPerpX = -(sy1 - sy0) / Math.sqrt((sx1 - sx0) ** 2 + (sy1 - sy0) ** 2);
      const screenPerpY = (sx1 - sx0) / Math.sqrt((sx1 - sx0) ** 2 + (sy1 - sy0) ** 2);
      const ballScreenX = bx + screenPerpX * ballRadius;
      const ballScreenY = by + screenPerpY * ballRadius;
      // Use world coords approximation for drawBall - convert screen offset back
      const [worldBallX, worldBallY] = cm.toWorld(ballScreenX, ballScreenY);
      cm.drawBall(worldBallX, worldBallY, ballRadius, '#60a5fa', { glow: true });

      // Info near ball
      cm.drawText(`s = ${state.s.toFixed(2)} m`, worldBallX, worldBallY, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: -18, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`v = ${Math.abs(state.vs).toFixed(2)} m/s`, worldBallX, worldBallY, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: 0, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      const aSlope = state.vs > 0.001
        ? -G * (Math.sin(slopeAngleRad) + mu * Math.cos(slopeAngleRad))
        : -G * (Math.sin(slopeAngleRad) - mu * Math.cos(slopeAngleRad));
      cm.drawText(`a = ${aSlope.toFixed(2)} m/s²`, worldBallX, worldBallY, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: 18, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });

      // Vectors
      if (showVectors) {
        const vScale = 0.07;
        // Velocity along slope
        if (Math.abs(state.vs) > 0.01) {
          arrows.draw(state.x, state.y,
            state.vs * Math.cos(slopeAngleRad) * vScale,
            state.vs * Math.sin(slopeAngleRad) * vScale,
            { color: ARROW_COLORS.velocity, label: 'v', labelOffset: -18 },
          );
        }
        // Acceleration along slope
        if (Math.abs(aSlope) > 0.01) {
          arrows.draw(state.x, state.y,
            aSlope * Math.cos(slopeAngleRad) * vScale * 0.8,
            aSlope * Math.sin(slopeAngleRad) * vScale * 0.8,
            { color: ARROW_COLORS.acceleration, label: 'a', labelOffset: 18 },
          );
        }
        // Normal force (perpendicular to slope, away from surface)
        const N = G * Math.cos(slopeAngleRad);
        arrows.draw(state.x, state.y,
          -Math.sin(slopeAngleRad) * N * vScale * 0.6,
          Math.cos(slopeAngleRad) * N * vScale * 0.6,
          { color: '#a78bfa', label: 'N', labelOffset: -18 },
        );
        // Gravity components along and perpendicular to slope
        // mg along slope (downward along slope)
        const mgPar = G * Math.sin(slopeAngleRad);
        arrows.draw(state.x, state.y,
          -mgPar * Math.cos(slopeAngleRad) * vScale * 0.6,
          -mgPar * Math.sin(slopeAngleRad) * vScale * 0.6,
          { color: '#f87171', dashed: true, label: 'mgsinθ', labelOffset: 18 },
        );
        // Gravity (straight down)
        arrows.draw(state.x, state.y,
          0, -G * vScale * 0.6,
          { color: '#f87171', label: 'mg', labelOffset: -18 },
        );
      }
      break;
    }

    // ======== 斜面上平抛 (Projectile from Incline Edge) ========
    case '斜面上平抛': {
      const slopeLen = 10;
      // Draw incline surface going to the right and downward from origin
      cm.drawIncline(0, 0, slopeLen, -slopeAngleRad, 'concrete');

      const slopeEndX = slopeLen * 1.0;
      const slopeEndY = -slopeEndX * Math.tan(slopeAngleRad);

      // Screen coords for angle label positioning
      const [ox, oy] = cm.toScreen(0, 0);
      const [sx1, sy1] = cm.toScreen(slopeEndX, slopeEndY);

      // Draw a short vertical cliff at origin (the edge)
      cm.drawLine(0, 1, 0, 0, 'rgba(255,255,255,0.3)', 2);

      // Angle label
      ctx.fillStyle = '#fbbf24';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      const labelX = (ox + sx1) / 2;
      const labelY = (oy + sy1) / 2;
      ctx.fillText(`θ=${slopeAngleDeg}°`, labelX + 10, labelY - 10);

      // Landing point formula: along slope distance = 2v₀²sinθ/(g·cos²θ)
      const landingDist = (2 * v0 * v0 * Math.sin(slopeAngleRad)) / (G * Math.cos(slopeAngleRad) * Math.cos(slopeAngleRad));
      const landX = landingDist * Math.cos(slopeAngleRad);
      const landY = -landingDist * Math.sin(slopeAngleRad);

      // Mark landing point
      cm.drawBall(landX, landY, 6, '#f87171', { glow: true, label: '' });
      cm.drawText('落点', landX, landY, {
        color: '#f87171', offsetX: 10, offsetY: -5,
        font: '12px -apple-system, BlinkMacSystemFont, sans-serif',
      });

      // Ball
      cm.drawBall(state.x, state.y, ballRadius, '#60a5fa', { glow: true });

      // Info
      const vMag = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      cm.drawText(`x = ${state.x.toFixed(2)} m`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: -24, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`y = ${state.y.toFixed(2)} m`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: -6, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`v = ${vMag.toFixed(2)} m/s`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 8, offsetY: 12, bg: true,
        font: 'bold 15px -apple-system, BlinkMacSystemFont, sans-serif',
      });

      // Formula display
      cm.drawText(`沿斜面落点距离 = ${landingDist.toFixed(2)} m`, 0, 0, {
        color: '#fbbf24', offsetX: 10, offsetY: -30, bg: true,
        font: '13px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`L = 2v₀²sinθ/(gcos²θ)`, 0, 0, {
        color: '#fbbf24', offsetX: 10, offsetY: -48, bg: true,
        font: '13px -apple-system, BlinkMacSystemFont, sans-serif',
      });

      // Vectors
      if (showVectors && (Math.abs(state.vx) > 0.01 || Math.abs(state.vy) > 0.01)) {
        const vScale = 0.06;
        if (vMag > 0.05) {
          arrows.draw(state.x, state.y, state.vx * vScale, state.vy * vScale, {
            color: ARROW_COLORS.velocity, label: 'v', labelOffset: -18,
          });
        }
        if (Math.abs(state.vx) > 0.05) {
          arrows.draw(state.x, state.y, state.vx * vScale, 0, {
            color: ARROW_COLORS.velocity, dashed: true, label: 'vx', labelOffset: 18,
          });
        }
        if (Math.abs(state.vy) > 0.05) {
          arrows.draw(state.x, state.y, 0, state.vy * vScale, {
            color: ARROW_COLORS.velocity, dashed: true, label: 'vy', labelOffset: -18,
          });
        }
        arrows.draw(state.x, state.y, 0, -G * 0.04, {
          color: ARROW_COLORS.acceleration, label: 'g', labelOffset: 18,
        });
      }
      break;
    }

    // ======== 竖直圆周运动 (Vertical Circular Motion) ========
    case '竖直圆周运动': {
      // Circle center at (0, vcircR), bottom at (0, 0)
      const centerX = 0;
      const centerY = vcircR;
      const [cx, cy] = cm.toScreen(centerX, centerY);
      const screenR = vcircR * cm.getScale();

      // Draw circular track with glow
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'rgba(96, 165, 250, 0.3)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(cx, cy, screenR, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Mark critical positions
      const positions = [
        { label: '底部', angle: 0 },
        { label: '顶部', angle: Math.PI },
        { label: '水平(右)', angle: Math.PI / 2 },
        { label: '水平(左)', angle: 3 * Math.PI / 2 },
      ];
      for (const pos of positions) {
        const px = centerX + vcircR * Math.sin(pos.angle);
        const py = centerY - vcircR * Math.cos(pos.angle);
        const [spx, spy] = cm.toScreen(px, py);
        ctx.beginPath();
        ctx.arc(spx, spy, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#64748b';
        ctx.fill();
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px -apple-system, BlinkMacSystemFont, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(pos.label, spx, spy - 8);
      }

      // Center dot
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#64748b';
      ctx.fill();

      // Critical speed info
      const vMinTop = Math.sqrt(G * vcircR);
      // Speed at top by energy conservation: v_top^2 = v0^2 - 4gR
      const vTopSq = vcircV0 * vcircV0 - 4 * G * vcircR;
      const canComplete = vTopSq >= G * vcircR; // v_top^2 >= gR
      const [infoX, infoY] = cm.toScreen(centerX + vcircR + 1, centerY + vcircR * 0.5);
      ctx.fillStyle = canComplete ? '#4ade80' : '#f87171';
      ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(canComplete ? '可完成圆周' : '无法完成圆周', infoX, infoY);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`v_min(顶) = √(gR) = ${vMinTop.toFixed(2)} m/s`, infoX, infoY + 18);
      if (vTopSq > 0) {
        ctx.fillText(`v(顶) = ${Math.sqrt(vTopSq).toFixed(2)} m/s`, infoX, infoY + 36);
      } else {
        ctx.fillText(`v(顶): 到不了顶部`, infoX, infoY + 36);
      }

      // Ball
      cm.drawBall(state.x, state.y, ballRadius, '#60a5fa', { glow: true });

      // Radius line to current position (if on track)
      if (!state.leftTrack) {
        cm.drawLine(centerX, centerY, state.x, state.y, 'rgba(255,255,255,0.15)', 1, true);
      }

      // Current values
      const currentV = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      const aCent = state.leftTrack ? 0 : (currentV * currentV) / vcircR;
      cm.drawText(`v = ${currentV.toFixed(2)} m/s`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 10, offsetY: -18, bg: true,
        font: 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      cm.drawText(`a_c = ${aCent.toFixed(2)} m/s²`, state.x, state.y, {
        color: '#e2e8f0', offsetX: ballRadius + 10, offsetY: 0, bg: true,
        font: 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif',
      });
      if (state.leftTrack) {
        cm.drawText('已脱离轨道!', state.x, state.y, {
          color: '#f87171', offsetX: ballRadius + 10, offsetY: 18, bg: true,
          font: 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif',
        });
      }

      // Vectors
      if (showVectors) {
        const vScale = 0.05;
        // Velocity (tangential)
        if (currentV > 0.05) {
          arrows.draw(state.x, state.y, state.vx * vScale, state.vy * vScale, {
            color: ARROW_COLORS.velocity, label: 'v', labelOffset: -18,
          });
        }
        // Centripetal acceleration (toward center, if on track)
        if (!state.leftTrack && currentV > 0.05) {
          const dirX = centerX - state.x;
          const dirY = centerY - state.y;
          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
          if (dirLen > 0.01) {
            const aScale = 0.03;
            arrows.draw(state.x, state.y,
              (dirX / dirLen) * aCent * aScale,
              (dirY / dirLen) * aCent * aScale,
              { color: ARROW_COLORS.acceleration, label: 'a_c', labelOffset: 18 },
            );
          }
        }
        // Gravity
        arrows.draw(state.x, state.y, 0, -G * 0.04, {
          color: '#f87171', label: 'mg', labelOffset: 18,
        });
      }
      break;
    }

    // ======== 多物体对比 (Multi-object comparison) ========
    case '多物体对比': {
      // Ground
      cm.drawTexturedGround(-2, 25, 0, 'concrete');

      // Update trails
      if (showTrail) {
        trail.push({ x: state.x, y: state.y });
        trail2.push({ x: state.obj2x, y: state.obj2y });
        trail3.push({ x: state.obj3x, y: state.obj3y });
        if (trail.length > 600) trail.shift();
        if (trail2.length > 600) trail2.shift();
        if (trail3.length > 600) trail3.shift();
        drawTrailPath(ctx, trail, 'rgba(248, 113, 113, 0.35)');
        drawTrailPath(ctx, trail2, 'rgba(96, 165, 250, 0.35)');
        drawTrailPath(ctx, trail3, 'rgba(74, 222, 128, 0.35)');
      }

      // Ball 1 (30 degrees - red)
      cm.drawBall(state.x, state.y, ballRadius - 2, '#f87171', { glow: true });

      // Ball 2 (45 degrees - blue)
      cm.drawBall(state.obj2x, state.obj2y, ballRadius - 2, '#60a5fa', { glow: true });

      // Ball 3 (60 degrees - green)
      cm.drawBall(state.obj3x, state.obj3y, ballRadius - 2, '#4ade80', { glow: true });

      // Legend
      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'left';
      const legendX = 20;
      const legendY = 30;
      ctx.fillStyle = '#f87171';
      ctx.fillText(`● θ = 30°`, legendX, legendY);
      ctx.fillStyle = '#60a5fa';
      ctx.fillText(`● θ = 45°`, legendX, legendY + 20);
      ctx.fillStyle = '#4ade80';
      ctx.fillText(`● θ = 60°`, legendX, legendY + 40);
      ctx.fillStyle = '#94a3b8';
      ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.fillText(`v₀ = ${v0.toFixed(1)} m/s`, legendX, legendY + 62);

      // Vectors for each object
      if (showVectors) {
        const vScale = 0.05;
        const v1 = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
        if (v1 > 0.05) {
          arrows.draw(state.x, state.y, state.vx * vScale, state.vy * vScale, {
            color: '#f87171', label: 'v₁', labelOffset: -18,
          });
        }
        const v2 = Math.sqrt(state.obj2vx * state.obj2vx + state.obj2vy * state.obj2vy);
        if (v2 > 0.05) {
          arrows.draw(state.obj2x, state.obj2y, state.obj2vx * vScale, state.obj2vy * vScale, {
            color: '#60a5fa', label: 'v₂', labelOffset: -18,
          });
        }
        const v3 = Math.sqrt(state.obj3vx * state.obj3vx + state.obj3vy * state.obj3vy);
        if (v3 > 0.05) {
          arrows.draw(state.obj3x, state.obj3y, state.obj3vx * vScale, state.obj3vy * vScale, {
            color: '#4ade80', label: 'v₃', labelOffset: -18,
          });
        }
      }
      break;
    }
  }

  // --- Update info panel ---
  updateInfoPanel(t, state);

  // --- Graph data ---
  timeData.push(t);
  xData.push(state.x);
  yData.push(state.y);
  vxData.push(state.vx);
  vyData.push(state.vy);
  vMagData.push(Math.sqrt(state.vx * state.vx + state.vy * state.vy));
  sData.push(state.s);
  vsData.push(state.vs);
  obj2xData.push(state.obj2x);
  obj2yData.push(state.obj2y);
  obj3xData.push(state.obj3x);
  obj3yData.push(state.obj3y);
  obj2vData.push(Math.sqrt(state.obj2vx * state.obj2vx + state.obj2vy * state.obj2vy));
  obj3vData.push(Math.sqrt(state.obj3vx * state.obj3vx + state.obj3vy * state.obj3vy));

  // Trim to last 500 points
  const maxPts = 500;
  const allArrays = [
    timeData, xData, yData, vxData, vyData, vMagData,
    sData, vsData,
    obj2xData, obj2yData, obj3xData, obj3yData, obj2vData, obj3vData,
  ];
  if (timeData.length > maxPts) {
    for (const arr of allArrays) {
      arr.splice(0, arr.length - maxPts);
    }
  }

  // Set graph traces based on scene
  let traces1: GraphTrace[];
  let traces2: GraphTrace[];

  switch (scene) {
    case '匀速直线':
    case '匀变速直线':
      traces1 = [
        { x: timeData, y: xData, name: 'x (m)', color: '#60a5fa' },
      ];
      traces2 = [
        { x: timeData, y: vxData, name: 'v (m/s)', color: '#4ade80' },
      ];
      break;
    case '抛体运动':
      traces1 = [
        { x: timeData, y: xData, name: 'x (m)', color: '#60a5fa' },
        { x: timeData, y: yData, name: 'y (m)', color: '#fbbf24' },
      ];
      traces2 = [
        { x: timeData, y: vxData, name: 'vx (m/s)', color: '#60a5fa' },
        { x: timeData, y: vyData, name: 'vy (m/s)', color: '#f87171' },
        { x: timeData, y: vMagData, name: '|v| (m/s)', color: '#4ade80' },
      ];
      break;
    case '圆周运动':
      traces1 = [
        { x: timeData, y: xData, name: 'x (m)', color: '#60a5fa' },
        { x: timeData, y: yData, name: 'y (m)', color: '#fbbf24' },
      ];
      traces2 = [
        { x: timeData, y: vxData, name: 'vx (m/s)', color: '#60a5fa' },
        { x: timeData, y: vyData, name: 'vy (m/s)', color: '#f87171' },
      ];
      break;
    case '斜面运动':
      traces1 = [
        { x: timeData, y: sData, name: 's (m)', color: '#60a5fa' },
      ];
      traces2 = [
        { x: timeData, y: vsData, name: 'v沿斜面 (m/s)', color: '#4ade80' },
      ];
      break;
    case '斜面上平抛':
      traces1 = [
        { x: timeData, y: xData, name: 'x (m)', color: '#60a5fa' },
        { x: timeData, y: yData, name: 'y (m)', color: '#fbbf24' },
      ];
      traces2 = [
        { x: timeData, y: vxData, name: 'vx (m/s)', color: '#60a5fa' },
        { x: timeData, y: vyData, name: 'vy (m/s)', color: '#f87171' },
        { x: timeData, y: vMagData, name: '|v| (m/s)', color: '#4ade80' },
      ];
      break;
    case '竖直圆周运动':
      traces1 = [
        { x: timeData, y: xData, name: 'x (m)', color: '#60a5fa' },
        { x: timeData, y: yData, name: 'y (m)', color: '#fbbf24' },
      ];
      traces2 = [
        { x: timeData, y: vMagData, name: '|v| (m/s)', color: '#4ade80' },
      ];
      break;
    case '多物体对比':
      traces1 = [
        { x: timeData, y: yData, name: 'y₁ 30° (m)', color: '#f87171' },
        { x: timeData, y: obj2yData, name: 'y₂ 45° (m)', color: '#60a5fa' },
        { x: timeData, y: obj3yData, name: 'y₃ 60° (m)', color: '#4ade80' },
      ];
      traces2 = [
        { x: timeData, y: vMagData, name: '|v₁| (m/s)', color: '#f87171' },
        { x: timeData, y: obj2vData, name: '|v₂| (m/s)', color: '#60a5fa' },
        { x: timeData, y: obj3vData, name: '|v₃| (m/s)', color: '#4ade80' },
      ];
      break;
    default:
      traces1 = [];
      traces2 = [];
  }

  graph1.setTraces(traces1);
  graph1.updateCurrentTime(t);
  graph1.render();

  graph2.setTraces(traces2);
  graph2.updateCurrentTime(t);
  graph2.render();

  // Update controls time
  controls.updateTime(t);
}

function updateInfoPanel(t: number, state: MotionState): void {
  const scene = getScene();
  const v0 = panel.getValue<number>('v0');
  const a = panel.getValue<number>('accel');
  const R = panel.getValue<number>('radius');
  const omega = panel.getValue<number>('omega');
  const angleDeg = panel.getValue<number>('launchAngle');
  const slopeAngleDeg = panel.getValue<number>('slopeAngle');
  const slopeAngleRad = slopeAngleDeg * Math.PI / 180;
  const mu = panel.getValue<number>('friction');
  const vcircR = panel.getValue<number>('vcircR');
  const vcircV0 = panel.getValue<number>('vcircV0');
  const vcircType = panel.getValue<string>('vcircType');

  let html = '';
  switch (scene) {
    case '匀速直线':
      html = `
        <div style="color:#e2e8f0;font-weight:bold;margin-bottom:8px;">匀速直线运动</div>
        <div>x = v₀t</div>
        <div>x = ${v0.toFixed(1)} × t</div>
        <div style="margin-top:6px;">v = v₀ = ${v0.toFixed(1)} m/s</div>
        <div style="margin-top:6px;color:#60a5fa;">a = 0</div>
      `;
      break;
    case '匀变速直线':
      html = `
        <div style="color:#e2e8f0;font-weight:bold;margin-bottom:8px;">匀变速直线运动</div>
        <div>x = v₀t + ½at²</div>
        <div>v = v₀ + at</div>
        <div style="margin-top:6px;">v₀ = ${v0.toFixed(1)} m/s</div>
        <div>a = ${a.toFixed(1)} m/s²</div>
        <div style="margin-top:6px;color:#60a5fa;">当前: v = ${state.vx.toFixed(2)} m/s</div>
        <div style="color:#fbbf24;">x = ${state.x.toFixed(2)} m</div>
      `;
      break;
    case '抛体运动': {
      const vMag = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      html = `
        <div style="color:#e2e8f0;font-weight:bold;margin-bottom:8px;">抛体运动</div>
        <div>vx = v₀cosθ (恒定)</div>
        <div>vy = v₀sinθ − gt</div>
        <div>x = v₀cosθ·t</div>
        <div>y = v₀sinθ·t − ½gt²</div>
        <div style="margin-top:6px;">v₀ = ${v0.toFixed(1)} m/s, θ = ${angleDeg.toFixed(0)}°</div>
        <div style="color:#60a5fa;">vx = ${state.vx.toFixed(2)} m/s</div>
        <div style="color:#f87171;">vy = ${state.vy.toFixed(2)} m/s</div>
        <div style="color:#4ade80;">|v| = ${vMag.toFixed(2)} m/s</div>
      `;
      break;
    }
    case '圆周运动': {
      const T = (2 * Math.PI) / omega;
      const vTan = R * omega;
      const aCent = R * omega * omega;
      html = `
        <div style="color:#e2e8f0;font-weight:bold;margin-bottom:8px;">匀速圆周运动</div>
        <div>v = Rω = ${vTan.toFixed(2)} m/s</div>
        <div>a = Rω² = ${aCent.toFixed(2)} m/s²</div>
        <div>T = 2π/ω = ${T.toFixed(2)} s</div>
        <div style="margin-top:6px;">R = ${R.toFixed(1)} m</div>
        <div>ω = ${omega.toFixed(1)} rad/s</div>
        <div style="margin-top:6px;color:#f87171;">向心加速度始终指向圆心</div>
      `;
      break;
    }

    // ======== 斜面运动 info ========
    case '斜面运动': {
      const aDown = G * (Math.sin(slopeAngleRad) - mu * Math.cos(slopeAngleRad));
      const aUp = G * (Math.sin(slopeAngleRad) + mu * Math.cos(slopeAngleRad));
      html = `
        <div style="color:#e2e8f0;font-weight:bold;margin-bottom:8px;">斜面运动</div>
        <div>θ = ${slopeAngleDeg}°, μ = ${mu.toFixed(2)}</div>
        <div style="margin-top:6px;">下滑加速度:</div>
        <div>a = g(sinθ − μcosθ)</div>
        <div>a = ${aDown.toFixed(2)} m/s²</div>
        <div style="margin-top:4px;">上滑减速度:</div>
        <div>a = −g(sinθ + μcosθ)</div>
        <div>a = −${aUp.toFixed(2)} m/s²</div>
        <div style="margin-top:8px;color:#60a5fa;">s = ${state.s.toFixed(2)} m</div>
        <div style="color:#4ade80;">v = ${state.vs.toFixed(2)} m/s</div>
        ${mu * Math.cos(slopeAngleRad) >= Math.sin(slopeAngleRad)
          ? '<div style="margin-top:4px;color:#fbbf24;">μcosθ ≥ sinθ: 静止不下滑</div>' : ''}
      `;
      break;
    }

    // ======== 斜面上平抛 info ========
    case '斜面上平抛': {
      const landingDist = (2 * v0 * v0 * Math.sin(slopeAngleRad)) / (G * Math.cos(slopeAngleRad) * Math.cos(slopeAngleRad));
      const landX = landingDist * Math.cos(slopeAngleRad);
      const landTime = (2 * v0 * Math.sin(slopeAngleRad)) / (G * Math.cos(slopeAngleRad));
      // Actually: time to land = 2v0*tan(theta)/g... let's derive:
      // y = -0.5*g*t^2, x = v0*t, on slope: y = -x*tan(theta) = -v0*t*tan(theta)
      // -0.5*g*t^2 = -v0*t*tan(theta) => t = 2*v0*tan(theta)/g
      const tLand = 2 * v0 * Math.tan(slopeAngleRad) / G;
      const vMag = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      html = `
        <div style="color:#e2e8f0;font-weight:bold;margin-bottom:8px;">斜面上平抛运动</div>
        <div>从斜面顶端水平抛出</div>
        <div style="margin-top:6px;">v₀ = ${v0.toFixed(1)} m/s (水平)</div>
        <div>斜面角 θ = ${slopeAngleDeg}°</div>
        <div style="margin-top:6px;color:#fbbf24;">沿斜面落点距离:</div>
        <div>L = 2v₀²sinθ/(gcos²θ)</div>
        <div>L = ${landingDist.toFixed(2)} m</div>
        <div style="margin-top:4px;">落地时间: t = ${tLand.toFixed(2)} s</div>
        <div style="margin-top:6px;color:#60a5fa;">vx = ${state.vx.toFixed(2)} m/s</div>
        <div style="color:#f87171;">vy = ${state.vy.toFixed(2)} m/s</div>
        <div style="color:#4ade80;">|v| = ${vMag.toFixed(2)} m/s</div>
      `;
      break;
    }

    // ======== 竖直圆周运动 info ========
    case '竖直圆周运动': {
      const vMinTop = Math.sqrt(G * vcircR);
      const vTopSq = vcircV0 * vcircV0 - 4 * G * vcircR;
      const canComplete = vTopSq >= G * vcircR;
      const currentV = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      html = `
        <div style="color:#e2e8f0;font-weight:bold;margin-bottom:8px;">竖直圆周运动</div>
        <div>R = ${vcircR.toFixed(1)} m, 约束: ${vcircType}</div>
        <div>底部初速: v₀ = ${vcircV0.toFixed(1)} m/s</div>
        <div style="margin-top:6px;">顶部最小速度 (${vcircType}):</div>
        <div>v_min = √(gR) = ${vMinTop.toFixed(2)} m/s</div>
        <div style="margin-top:4px;">能量守恒:</div>
        <div>v² = v₀² − 2gR(1−cosφ)</div>
        ${vTopSq > 0
          ? `<div>v(顶) = ${Math.sqrt(vTopSq).toFixed(2)} m/s</div>`
          : `<div style="color:#f87171;">到不了顶部</div>`}
        <div style="margin-top:6px;color:${canComplete ? '#4ade80' : '#f87171'};">
          ${canComplete ? '可以完成圆周运动' : '无法完成圆周运动'}
        </div>
        <div style="margin-top:6px;color:#60a5fa;">当前 v = ${currentV.toFixed(2)} m/s</div>
        ${state.leftTrack ? '<div style="color:#f87171;font-weight:bold;">已脱离轨道!</div>' : ''}
      `;
      break;
    }

    // ======== 多物体对比 info ========
    case '多物体对比': {
      const v1 = Math.sqrt(state.vx * state.vx + state.vy * state.vy);
      const v2 = Math.sqrt(state.obj2vx * state.obj2vx + state.obj2vy * state.obj2vy);
      const v3 = Math.sqrt(state.obj3vx * state.obj3vx + state.obj3vy * state.obj3vy);
      // Range formula: R = v0^2 * sin(2*theta) / g
      const range30 = v0 * v0 * Math.sin(2 * 30 * Math.PI / 180) / G;
      const range45 = v0 * v0 * Math.sin(2 * 45 * Math.PI / 180) / G;
      const range60 = v0 * v0 * Math.sin(2 * 60 * Math.PI / 180) / G;
      const maxH30 = (v0 * Math.sin(30 * Math.PI / 180)) ** 2 / (2 * G);
      const maxH45 = (v0 * Math.sin(45 * Math.PI / 180)) ** 2 / (2 * G);
      const maxH60 = (v0 * Math.sin(60 * Math.PI / 180)) ** 2 / (2 * G);
      html = `
        <div style="color:#e2e8f0;font-weight:bold;margin-bottom:8px;">多物体对比 (抛体)</div>
        <div>v₀ = ${v0.toFixed(1)} m/s</div>
        <div>R = v₀²sin2θ/g</div>
        <div style="margin-top:8px;color:#f87171;">● 30°: R=${range30.toFixed(2)}m, H=${maxH30.toFixed(2)}m</div>
        <div style="color:#60a5fa;">● 45°: R=${range45.toFixed(2)}m, H=${maxH45.toFixed(2)}m</div>
        <div style="color:#4ade80;">● 60°: R=${range60.toFixed(2)}m, H=${maxH60.toFixed(2)}m</div>
        <div style="margin-top:8px;color:#fbbf24;">45°射程最大!</div>
        <div>互补角(30°/60°)射程相同</div>
        <div style="margin-top:6px;">当前速度:</div>
        <div style="color:#f87171;">v₁ = ${v1.toFixed(2)} m/s</div>
        <div style="color:#60a5fa;">v₂ = ${v2.toFixed(2)} m/s</div>
        <div style="color:#4ade80;">v₃ = ${v3.toFixed(2)} m/s</div>
      `;
      break;
    }
  }
  infoDiv.innerHTML = html;
}

// --- SimLoop ---
updateOrigin();

const sim = new SimLoop<MotionState>({
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
  trail2.length = 0;
  trail3.length = 0;
  updateOrigin();
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
  trail2.length = 0;
  trail3.length = 0;
  updateOrigin();
  sim.reset(getInitialState());
  sim.updateStepFn(createStepFn());
});

function clearGraphData(): void {
  timeData.length = 0;
  xData.length = 0;
  yData.length = 0;
  vxData.length = 0;
  vyData.length = 0;
  vMagData.length = 0;
  sData.length = 0;
  vsData.length = 0;
  obj2xData.length = 0;
  obj2yData.length = 0;
  obj3xData.length = 0;
  obj3yData.length = 0;
  obj2vData.length = 0;
  obj3vData.length = 0;
}

// Initial render
renderScene(0, getInitialState());

// Auto-play on load
setTimeout(() => { sim.play(); controls.setPlaying(true); }, 100);

// Resize graphs on window resize
window.addEventListener('resize', () => {
  const w1 = graphContainer1.clientWidth;
  const w2 = graphContainer2.clientWidth;
  if (w1 > 0) graph1.resize(w1);
  if (w2 > 0) graph2.resize(w2);
});

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
