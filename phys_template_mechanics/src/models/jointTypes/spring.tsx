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

const COIL_COUNT = 8      // 锯齿数（固定）
const AMPLITUDE = 6        // 锯齿振幅 (px)
const LEAD_IN_RATIO = 0.1  // 两端直线段占总长比例
const ANCHOR_RADIUS = 3.5  // 锚点圆半径 (px)

/**
 * 渲染弹簧：锯齿线（zigzag）风格
 */
function drawSpring(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  worldA: { x: number; y: number },
  worldB: { x: number; y: number },
  color: string,
  lineWidth: number,
): void {
  const screenA = worldToScreen(worldA.x, worldA.y, viewport)
  const screenB = worldToScreen(worldB.x, worldB.y, viewport)

  const dx = screenB.x - screenA.x
  const dy = screenB.y - screenA.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 0.1) return

  // 单位方向和法线
  const ux = dx / len, uy = dy / len
  const nx = -uy, ny = ux

  // 两端留直线段
  const leadIn = len * LEAD_IN_RATIO
  const coilLen = len - 2 * leadIn

  ctx.save()

  // 锯齿线
  ctx.beginPath()
  ctx.moveTo(screenA.x, screenA.y)

  // leadIn 直线段起点
  const startX = screenA.x + ux * leadIn
  const startY = screenA.y + uy * leadIn
  ctx.lineTo(startX, startY)

  // 锯齿部分
  for (let i = 0; i < COIL_COUNT; i++) {
    const t = (i + 0.5) / COIL_COUNT
    const midX = startX + ux * coilLen * t
    const midY = startY + uy * coilLen * t
    const sign = i % 2 === 0 ? 1 : -1
    ctx.lineTo(midX + nx * AMPLITUDE * sign, midY + ny * AMPLITUDE * sign)
  }

  // leadIn 直线段终点
  const endX = screenB.x - ux * leadIn
  const endY = screenB.y - uy * leadIn
  ctx.lineTo(endX, endY)
  ctx.lineTo(screenB.x, screenB.y)

  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.lineJoin = 'bevel'
  ctx.stroke()

  // 锚点圆点（两端）
  for (const p of [screenA, screenB]) {
    ctx.beginPath()
    ctx.arc(p.x, p.y, ANCHOR_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  ctx.restore()
}

registerJointType({
  type: 'spring',
  label: '弹簧',
  icon: '⌇',
  category: 'constraint',
  defaults: { springLength: 2, stiffness: 4, damping: 0 },

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
    const color = isSelected
      ? CONSTRAINT_VISUAL.strokeSelected
      : isHovered
        ? CONSTRAINT_VISUAL.strokeHover
        : CONSTRAINT_VISUAL.strokeDefault
    const lineWidth = isSelected
      ? CONSTRAINT_VISUAL.lineWidthSelected
      : isHovered
        ? CONSTRAINT_VISUAL.lineWidthHover
        : CONSTRAINT_VISUAL.lineWidthDefault
    drawSpring(ctx, viewport, worldA, worldB, color, lineWidth)
  },

  renderSim(
    ctx: CanvasRenderingContext2D,
    jointState: JointState,
    viewport: Viewport,
  ): void {
    drawSpring(
      ctx,
      viewport,
      jointState.anchorA,
      jointState.anchorB,
      CONSTRAINT_VISUAL.strokeDefault,
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
    { key: 'springLength', label: '自然长度', type: 'number', min: 0.1, step: 0.1, unit: 'm' },
    { key: 'stiffness', label: '刚度', type: 'number', min: 0.1, step: 0.5, unit: 'Hz' },
    { key: 'damping', label: '阻尼比', type: 'number', min: 0, max: 1, step: 0.1, unit: '' },
  ],

  toJointConfig(joint: SceneJoint, bodyA: SceneBody, bodyB: SceneBody): JointConfig {
    const worldA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
    const worldB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)
    return {
      id: joint.id,
      type: 'distance',
      sceneType: 'spring',
      bodyIdA: joint.bodyIdA,
      bodyIdB: joint.bodyIdB,
      anchorA: worldA,
      anchorB: worldB,
      length: joint.springLength ?? 2,
      frequencyHz: joint.stiffness ?? 4,
      dampingRatio: joint.damping ?? 0,
    }
  },
})
