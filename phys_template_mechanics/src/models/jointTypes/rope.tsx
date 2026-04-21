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

/**
 * 渲染绳线：绷紧时画直线，松弛时画下垂抛物线近似
 * @param maxLength 绳全长（可选，传入时启用松弛渲染）
 */
function drawRopeLine(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  worldA: { x: number; y: number },
  worldB: { x: number; y: number },
  color: string,
  lineWidth: number,
  maxLength?: number,
): void {
  const screenA = worldToScreen(worldA.x, worldA.y, viewport)
  const screenB = worldToScreen(worldB.x, worldB.y, viewport)

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth

  const dx = worldB.x - worldA.x
  const dy = worldB.y - worldA.y
  const dist = Math.sqrt(dx * dx + dy * dy)

  // 松弛判断：距离 < maxLength 的 98% 视为松弛（留小余量避免抖动）
  const ropeLen = maxLength ?? 0
  const slack = maxLength !== undefined && dist < ropeLen * 0.98

  if (!slack) {
    // 绷紧：直线
    ctx.beginPath()
    ctx.moveTo(screenA.x, screenA.y)
    ctx.lineTo(screenB.x, screenB.y)
    ctx.stroke()
  } else {
    // 松弛：用二次贝塞尔曲线模拟下垂
    // V形精确公式: 总长L的绳挂在距离d的两点间，下垂深度 h = √(L²-d²)/2
    // d=L时h=0（绷直），d→0时h→L/2（完全垂下）
    const d = Math.max(dist, 0.001) // 避免除零
    const sag = Math.sqrt(Math.max(0, ropeLen * ropeLen - d * d)) / 2

    // 中点 + 沿重力方向（y 负方向/屏幕下方）偏移
    const midWorldX = (worldA.x + worldB.x) / 2
    const midWorldY = (worldA.y + worldB.y) / 2 - sag
    const screenMid = worldToScreen(midWorldX, midWorldY, viewport)

    ctx.beginPath()
    ctx.moveTo(screenA.x, screenA.y)
    ctx.quadraticCurveTo(screenMid.x, screenMid.y, screenB.x, screenB.y)
    ctx.stroke()
  }

  // 锚点圆点
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(screenA.x, screenA.y, CONSTRAINT_VISUAL.anchorRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(screenB.x, screenB.y, CONSTRAINT_VISUAL.anchorRadius, 0, Math.PI * 2)
  ctx.fill()

  ctx.restore()
}

registerJointType({
  type: 'rope',
  label: '绳',
  icon: '—',
  category: 'constraint',
  defaults: { maxLength: 2 },

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
    drawRopeLine(ctx, viewport, worldA, worldB, color, lineWidth, joint.maxLength)
  },

  renderSim(
    ctx: CanvasRenderingContext2D,
    jointState: JointState,
    viewport: Viewport,
  ): void {
    drawRopeLine(
      ctx,
      viewport,
      jointState.anchorA,
      jointState.anchorB,
      CONSTRAINT_VISUAL.strokeDefault,
      CONSTRAINT_VISUAL.lineWidthDefault,
      jointState.maxLength,
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
    { key: 'maxLength', label: '绳长', type: 'number', min: 0.1, step: 0.1, unit: 'm' },
  ],

  toJointConfig(joint: SceneJoint, bodyA: SceneBody, bodyB: SceneBody): JointConfig {
    const worldA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
    const worldB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)
    return {
      id: joint.id,
      type: 'rope',
      bodyIdA: joint.bodyIdA,
      bodyIdB: joint.bodyIdB,
      anchorA: worldA,
      anchorB: worldB,
      maxLength: joint.maxLength ?? 2,
    }
  },
})
