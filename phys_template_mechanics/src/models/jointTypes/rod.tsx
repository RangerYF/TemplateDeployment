import type { SceneBody, SceneJoint } from '@/models/types'
import type { JointConfig, JointState } from '@/engine/types'
import type { Viewport } from '@/renderer/CoordinateSystem'
import { worldToScreen } from '@/renderer/CoordinateSystem'
import { CONSTRAINT_VISUAL } from '@/styles/tokens'
import { registerJointType } from './registry'

/** 局部锚点 → 世界坐标 */
function localToWorld(
  local: { x: number; y: number },
  bodyPos: { x: number; y: number },
  bodyAngle: number,
): { x: number; y: number } {
  const cos = Math.cos(bodyAngle)
  const sin = Math.sin(bodyAngle)
  return {
    x: bodyPos.x + local.x * cos - local.y * sin,
    y: bodyPos.y + local.x * sin + local.y * cos,
  }
}

/** 点到线段距离 */
function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const abx = bx - ax, aby = by - ay
  const apx = px - ax, apy = py - ay
  const lenSq = abx * abx + aby * aby
  if (lenSq === 0) return Math.sqrt(apx * apx + apy * apy)
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / lenSq))
  const projX = ax + t * abx, projY = ay + t * aby
  return Math.sqrt((px - projX) ** 2 + (py - projY) ** 2)
}

const ROD_HALF_WIDTH = 3    // 杆条半宽 (px)
const HINGE_RADIUS = 4.5    // 铰链圆半径 (px)
const HINGE_INNER = 2       // 铰链内圆半径 (px)

/**
 * 渲染杆：物理课本风格
 * - 主体：带宽度的圆端矩形条（浅灰填充 + 深色描边）
 * - 两端：铰链圆圈（空心，带圆心点）
 */
function drawRod(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  worldA: { x: number; y: number },
  worldB: { x: number; y: number },
  strokeColor: string,
  fillColor: string,
  lineWidth: number,
): void {
  const screenA = worldToScreen(worldA.x, worldA.y, viewport)
  const screenB = worldToScreen(worldB.x, worldB.y, viewport)

  const dx = screenB.x - screenA.x
  const dy = screenB.y - screenA.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.1) return

  // 单位法线方向（垂直于杆）
  const nx = -dy / len
  const ny = dx / len
  const hw = ROD_HALF_WIDTH

  ctx.save()

  // 杆主体：圆端矩形
  ctx.beginPath()
  ctx.moveTo(screenA.x + nx * hw, screenA.y + ny * hw)
  ctx.lineTo(screenB.x + nx * hw, screenB.y + ny * hw)
  ctx.arc(screenB.x, screenB.y, hw, Math.atan2(ny, nx), Math.atan2(-ny, -nx))
  ctx.lineTo(screenA.x - nx * hw, screenA.y - ny * hw)
  ctx.arc(screenA.x, screenA.y, hw, Math.atan2(-ny, -nx), Math.atan2(ny, nx))
  ctx.closePath()
  ctx.fillStyle = fillColor
  ctx.fill()
  ctx.strokeStyle = strokeColor
  ctx.lineWidth = lineWidth
  ctx.stroke()

  // 铰链圆圈（两端）
  for (const p of [screenA, screenB]) {
    // 外圈
    ctx.beginPath()
    ctx.arc(p.x, p.y, HINGE_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = '#fff'
    ctx.fill()
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = lineWidth
    ctx.stroke()
    // 圆心点
    ctx.beginPath()
    ctx.arc(p.x, p.y, HINGE_INNER, 0, Math.PI * 2)
    ctx.fillStyle = strokeColor
    ctx.fill()
  }

  ctx.restore()
}

registerJointType({
  type: 'rod',
  label: '杆',
  icon: '|',
  category: 'constraint',
  defaults: { length: 2 },

  renderEdit(
    ctx: CanvasRenderingContext2D,
    joint: SceneJoint,
    bodyA: SceneBody,
    bodyB: SceneBody,
    isSelected: boolean,
    isHovered: boolean,
    viewport: Viewport,
  ): void {
    const worldA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
    const worldB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)

    const strokeColor = isSelected
      ? CONSTRAINT_VISUAL.strokeSelected
      : isHovered
        ? CONSTRAINT_VISUAL.strokeHover
        : CONSTRAINT_VISUAL.strokeDefault
    const fillColor = isSelected
      ? CONSTRAINT_VISUAL.rodFillSelected
      : isHovered
        ? CONSTRAINT_VISUAL.rodFillHover
        : CONSTRAINT_VISUAL.rodFillDefault
    const lineWidth = isSelected
      ? CONSTRAINT_VISUAL.lineWidthSelected
      : isHovered
        ? CONSTRAINT_VISUAL.lineWidthHover
        : CONSTRAINT_VISUAL.lineWidthDefault
    drawRod(ctx, viewport, worldA, worldB, strokeColor, fillColor, lineWidth)
  },

  renderSim(
    ctx: CanvasRenderingContext2D,
    jointState: JointState,
    viewport: Viewport,
  ): void {
    drawRod(
      ctx,
      viewport,
      jointState.anchorA,
      jointState.anchorB,
      CONSTRAINT_VISUAL.strokeDefault,
      CONSTRAINT_VISUAL.rodFillDefault,
      CONSTRAINT_VISUAL.lineWidthDefault,
    )
  },

  hitTest(
    worldPos: { x: number; y: number },
    joint: SceneJoint,
    bodyA: SceneBody,
    bodyB: SceneBody,
    threshold: number,
  ): boolean {
    const worldA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
    const worldB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)
    return pointToSegmentDistance(worldPos.x, worldPos.y, worldA.x, worldA.y, worldB.x, worldB.y) < threshold
  },

  properties: [
    { key: 'length', label: '杆长', type: 'number', min: 0.1, step: 0.1, unit: 'm' },
  ],

  toJointConfig(joint: SceneJoint, bodyA: SceneBody, bodyB: SceneBody): JointConfig {
    const worldA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
    const worldB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)
    return {
      id: joint.id,
      type: 'distance',
      sceneType: 'rod',
      bodyIdA: joint.bodyIdA,
      bodyIdB: joint.bodyIdB,
      anchorA: worldA,
      anchorB: worldB,
      length: joint.length ?? 2,
      frequencyHz: 0,
      dampingRatio: 0,
    }
  },
})
