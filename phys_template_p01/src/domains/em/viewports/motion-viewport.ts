import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';
import type { Entity, Vec2 } from '@/core/types';

// ─── 视觉常量 ───

/** 轨迹线颜色（灰蓝虚线） */
const TRAJECTORY_COLOR = '#94A3B8';
/** 速度箭头颜色（天蓝，核心类型文档规定） */
const VELOCITY_COLOR = '#3498DB';
/** 加速度箭头颜色（洛伦兹力指向圆心，品红） */
const ACCELERATION_COLOR = '#9B59B6';

/** 轨迹最大渲染点数 */
const MAX_TRAJECTORY_POINTS = 500;
/** 速度箭头长度缩放因子（px per m/s） */
const VELOCITY_SCALE = 40;
/** 加速度箭头长度缩放因子（px per m/s²） */
const ACCELERATION_SCALE = 20;
/** 箭头最小/最大像素长度 */
const MIN_ARROW_LENGTH = 20;
const MAX_ARROW_LENGTH = 150;
/** 实体边缘偏移量（物理坐标 m） */
const EDGE_GAP = 0.02;

// ─── 辅助函数 ───

/** 将物理量大小映射到箭头像素长度（线性 + clamp） */
function magnitudeToLength(magnitude: number, scale: number): number {
  if (magnitude <= 0) return 0;
  return Math.max(MIN_ARROW_LENGTH, Math.min(MAX_ARROW_LENGTH, magnitude * scale));
}

/** 从实体边缘出发（圆形实体沿方向偏移 radius） */
function getEdgeStart(center: Vec2, direction: Vec2, entity: Entity): Vec2 {
  const dx = direction.x;
  const dy = direction.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return center;

  const radius = entity.properties.radius as number | undefined;
  if (radius != null && radius > 0) {
    const len = Math.hypot(dx, dy);
    return {
      x: center.x + (dx / len) * (radius + EDGE_GAP),
      y: center.y + (dy / len) * (radius + EDGE_GAP),
    };
  }

  return center;
}

// ─── 渲染器 ───

/**
 * 运动视角渲染器（motion viewport）
 *
 * 绘制内容（按层级顺序）：
 * 1. 轨迹线：灰蓝虚线，最多 500 个点
 * 2. 速度箭头(v)：天蓝实线，从粒子边缘沿速度方向
 * 3. 加速度箭头(a)：品红虚线，从粒子边缘沿加速度方向（洛伦兹力方向 = 向心方向）
 * 4. 数值标注：v 和 a 的大小
 */
const motionViewportRenderer: ViewportRenderer = (data, entities, ctx) => {
  if (data.type !== 'motion') return;

  const { motionStates } = data.data;
  const { coordinateTransform } = ctx;
  const c = ctx.ctx;

  for (const motion of motionStates) {
    const entity = entities.get(motion.entityId);
    if (!entity) continue;

    const pos = motion.position;
    const vel = motion.velocity;
    const acc = motion.acceleration;

    // ── 1. 轨迹线 ──
    if (motion.trajectory && motion.trajectory.length > 1) {
      drawTrajectory(c, motion.trajectory, coordinateTransform);
    }

    // ── 2. 速度箭头 ──
    const speed = Math.hypot(vel.x, vel.y);
    if (speed > 1e-6) {
      const velDir: Vec2 = { x: vel.x / speed, y: vel.y / speed };
      const edgeStart = getEdgeStart(pos, velDir, entity);
      const screenFrom = worldToScreen(edgeStart, coordinateTransform);
      const arrowLen = magnitudeToLength(speed, VELOCITY_SCALE);

      const screenTo: Vec2 = {
        x: screenFrom.x + velDir.x * arrowLen,
        y: screenFrom.y - velDir.y * arrowLen, // Y 翻转
      };

      drawArrow(c, screenFrom, screenTo, {
        color: VELOCITY_COLOR,
        lineWidth: 2.5,
        arrowHeadSize: 10,
      });

      // 标注
      const labelPos: Vec2 = {
        x: screenTo.x + velDir.x * 8,
        y: screenTo.y - velDir.y * 8 - 10,
      };
      drawTextLabel(c, `v=${speed.toFixed(2)}m/s`, labelPos, {
        color: VELOCITY_COLOR,
        fontSize: 11,
        align: 'center',
      });
    }

    // ── 3. 加速度箭头（洛伦兹力方向 = 向心力方向） ──
    const accMag = Math.hypot(acc.x, acc.y);
    if (accMag > 1e-6) {
      const accDir: Vec2 = { x: acc.x / accMag, y: acc.y / accMag };
      const edgeStart = getEdgeStart(pos, accDir, entity);
      const screenFrom = worldToScreen(edgeStart, coordinateTransform);
      const arrowLen = magnitudeToLength(accMag, ACCELERATION_SCALE);

      const screenTo: Vec2 = {
        x: screenFrom.x + accDir.x * arrowLen,
        y: screenFrom.y - accDir.y * arrowLen, // Y 翻转
      };

      drawArrow(c, screenFrom, screenTo, {
        color: ACCELERATION_COLOR,
        lineWidth: 2,
        arrowHeadSize: 9,
        dashed: true,
      });

      // 标注
      const forceMag = accMag * ((entity.properties.mass as number) ?? 1);
      const labelPos: Vec2 = {
        x: screenTo.x + accDir.x * 8,
        y: screenTo.y - accDir.y * 8 + 12,
      };
      drawTextLabel(c, `F=${forceMag.toFixed(2)}N`, labelPos, {
        color: ACCELERATION_COLOR,
        fontSize: 11,
        align: 'center',
      });
    }
  }
};

/**
 * 绘制轨迹线（灰蓝虚线）
 */
function drawTrajectory(
  c: CanvasRenderingContext2D,
  trajectory: Vec2[],
  coordinateTransform: { scale: number; origin: Vec2 },
): void {
  // 限制渲染点数
  const points = trajectory.length > MAX_TRAJECTORY_POINTS
    ? trajectory.slice(trajectory.length - MAX_TRAJECTORY_POINTS)
    : trajectory;

  if (points.length < 2) return;

  c.save();
  c.strokeStyle = TRAJECTORY_COLOR;
  c.lineWidth = 1.5;
  c.setLineDash([4, 3]);
  c.globalAlpha = 0.7;

  c.beginPath();
  const first = worldToScreen(points[0]!, coordinateTransform);
  c.moveTo(first.x, first.y);

  for (let i = 1; i < points.length; i++) {
    const pt = worldToScreen(points[i]!, coordinateTransform);
    c.lineTo(pt.x, pt.y);
  }

  c.stroke();
  c.setLineDash([]);
  c.restore();
}

export function registerMotionViewport(): void {
  rendererRegistry.registerViewport('motion', motionViewportRenderer);
}
