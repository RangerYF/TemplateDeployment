import type { SceneBody, SceneJoint } from '@/models/types'
import type { JointConfig, JointState } from '@/engine/types'
import type { Viewport } from '@/renderer/CoordinateSystem'
import { worldToScreen } from '@/renderer/CoordinateSystem'
import { useSceneStore } from '@/store/sceneStore'
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

/** 将角度归一化到 [0, 2π) */
function normalizeAngle(a: number): number {
  return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
}

interface PulleyGeometry {
  center: { x: number; y: number }
  radius: number
}

/** 从 pulleyMountId 获取滑轮几何信息 */
function getPulleyGeometry(pulleyMountId: string): PulleyGeometry | null {
  const scene = useSceneStore.getState().scene
  const mount = scene.bodies.find(b => b.id === pulleyMountId)
  if (!mount) return null
  return { center: mount.position, radius: mount.pulleyRadius ?? 0.15 }
}

/** 从 SceneJoint 获取滑轮几何 */
function getPulleyFromJoint(joint: SceneJoint): PulleyGeometry | null {
  return joint.pulleyMountId ? getPulleyGeometry(joint.pulleyMountId) : null
}

/** 从 JointState 获取对应的 SceneJoint */
function getSceneJoint(jointState: JointState): SceneJoint | undefined {
  return useSceneStore.getState().scene.joints.find(j => j.id === jointState.id)
}

/** 从 JointState 获取滑轮几何 */
function getPulleyFromState(jointState: JointState): PulleyGeometry | null {
  const sceneJoint = getSceneJoint(jointState)
  return sceneJoint?.pulleyMountId ? getPulleyGeometry(sceneJoint.pulleyMountId) : null
}

// ─── 切点计算 ───

/**
 * 从外部点 P 到圆(C, r) 的切点。
 * 有两个切点，通过 side 选择：'left' 取 x 更小的，'right' 取 x 更大的。
 * 当点在圆内时 fallback 到圆上方的固定位置。
 */
function computeTangentPoint(
  P: { x: number; y: number },
  C: { x: number; y: number },
  r: number,
  side: 'left' | 'right',
): { x: number; y: number } {
  const dx = P.x - C.x, dy = P.y - C.y
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d <= r + 1e-6) {
    // 点在圆内/圆上 — fallback 到上方固定点
    return side === 'left'
      ? { x: C.x - r * 0.866, y: C.y + r * 0.5 }
      : { x: C.x + r * 0.866, y: C.y + r * 0.5 }
  }
  const theta = Math.atan2(dy, dx)
  const alpha = Math.acos(r / d)
  const t1 = theta + alpha
  const t2 = theta - alpha
  const p1 = { x: C.x + r * Math.cos(t1), y: C.y + r * Math.sin(t1) }
  const p2 = { x: C.x + r * Math.cos(t2), y: C.y + r * Math.sin(t2) }
  // side='left' 取 x 更小的（圆左侧），side='right' 取 x 更大的
  if (side === 'left') return p1.x <= p2.x ? p1 : p2
  return p1.x >= p2.x ? p1 : p2
}

/** 根据两个锚点的初始位置，决定 A 从哪侧出绳 */
export function determineSide(
  worldA: { x: number; y: number },
  worldB: { x: number; y: number },
  pulleyCenter: { x: number; y: number },
): 'left' | 'right' {
  if (worldA.x < worldB.x) return 'left'
  if (worldA.x > worldB.x) return 'right'
  return worldA.x <= pulleyCenter.x ? 'left' : 'right'
}

/** 从 joint.sideA（持久化）或 fallback 计算出绳侧 */
function getSideA(
  joint: SceneJoint,
  worldA: { x: number; y: number },
  worldB: { x: number; y: number },
  pulley: PulleyGeometry,
): 'left' | 'right' {
  return joint.sideA ?? determineSide(worldA, worldB, pulley.center)
}

/** 计算两个出绳点（切点） */
function computeGroundAnchors(
  worldA: { x: number; y: number },
  worldB: { x: number; y: number },
  pulley: PulleyGeometry,
  sideA: 'left' | 'right',
): { groundA: { x: number; y: number }; groundB: { x: number; y: number } } {
  const sideB: 'left' | 'right' = sideA === 'left' ? 'right' : 'left'
  return {
    groundA: computeTangentPoint(worldA, pulley.center, pulley.radius, sideA),
    groundB: computeTangentPoint(worldB, pulley.center, pulley.radius, sideB),
  }
}

// ─── 渲染 ───

/** 绘制锚点圆点 */
function drawAnchorDot(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  world: { x: number; y: number },
  color: string,
): void {
  const screen = worldToScreen(world.x, world.y, viewport)
  ctx.beginPath()
  ctx.arc(screen.x, screen.y, CONSTRAINT_VISUAL.anchorRadius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

/**
 * 绘制滑轮绳：A → groundA 直线 + groundA→groundB 圆弧（经过顶部）+ groundB → B 直线
 */
function drawPulleyRope(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  worldA: { x: number; y: number },
  worldB: { x: number; y: number },
  pulley: PulleyGeometry,
  groundA: { x: number; y: number },
  groundB: { x: number; y: number },
  color: string,
  lineWidth: number,
): void {
  const { center, radius } = pulley

  const sA = worldToScreen(worldA.x, worldA.y, viewport)
  const sGA = worldToScreen(groundA.x, groundA.y, viewport)
  const sGB = worldToScreen(groundB.x, groundB.y, viewport)
  const sB = worldToScreen(worldB.x, worldB.y, viewport)
  const sC = worldToScreen(center.x, center.y, viewport)
  const sR = radius * viewport.scale

  // 圆弧角度（世界角 → 屏幕角取反，因为 canvas Y 轴向下）
  const wAngleGA = Math.atan2(groundA.y - center.y, groundA.x - center.x)
  const wAngleGB = Math.atan2(groundB.y - center.y, groundB.x - center.x)
  const sAngleGA = -wAngleGA
  const sAngleGB = -wAngleGB

  // 圆弧方向：必须经过滑轮顶部（世界 π/2 → 屏幕 -π/2）
  const screenTop = -Math.PI / 2
  const cwToTop = normalizeAngle(screenTop - sAngleGA)
  const cwToGB = normalizeAngle(sAngleGB - sAngleGA)
  const counterclockwise = cwToTop > cwToGB

  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth

  // A → groundA
  ctx.beginPath()
  ctx.moveTo(sA.x, sA.y)
  ctx.lineTo(sGA.x, sGA.y)
  ctx.stroke()

  // 圆弧 groundA → groundB（经过顶部）
  ctx.beginPath()
  ctx.arc(sC.x, sC.y, sR, sAngleGA, sAngleGB, counterclockwise)
  ctx.stroke()

  // groundB → B
  ctx.beginPath()
  ctx.moveTo(sGB.x, sGB.y)
  ctx.lineTo(sB.x, sB.y)
  ctx.stroke()

  ctx.restore()
}

/** 简单直线段渲染（fallback） */
function drawSegment(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  worldA: { x: number; y: number },
  worldB: { x: number; y: number },
  color: string,
  lineWidth: number,
): void {
  const screenA = worldToScreen(worldA.x, worldA.y, viewport)
  const screenB = worldToScreen(worldB.x, worldB.y, viewport)
  ctx.beginPath()
  ctx.moveTo(screenA.x, screenA.y)
  ctx.lineTo(screenB.x, screenB.y)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth
  ctx.stroke()
}

registerJointType({
  type: 'pulley',
  label: '滑轮绳',
  icon: '⊙',
  category: 'constraint',
  defaults: { ratio: 1, totalLength: 2 },

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
    const pulley = getPulleyFromJoint(joint)

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

    if (pulley) {
      const sideA = getSideA(joint, worldA, worldB, pulley)
      const { groundA, groundB } = computeGroundAnchors(worldA, worldB, pulley, sideA)
      drawPulleyRope(ctx, viewport, worldA, worldB, pulley, groundA, groundB, color, lineWidth)
    } else {
      drawSegment(ctx, viewport, worldA, worldB, color, lineWidth)
    }

    drawAnchorDot(ctx, viewport, worldA, color)
    drawAnchorDot(ctx, viewport, worldB, color)
  },

  renderSim(
    ctx: CanvasRenderingContext2D,
    jointState: JointState,
    viewport: Viewport,
  ): void {
    const color = CONSTRAINT_VISUAL.strokeDefault
    const lineWidth = CONSTRAINT_VISUAL.lineWidthDefault
    const { anchorA, anchorB } = jointState
    const pulley = getPulleyFromState(jointState)
    const sceneJoint = getSceneJoint(jointState)

    if (pulley && sceneJoint) {
      // 侧面固定（来自创建时持久化的 sideA），切点随当前锚点位置动态计算
      const sideA = sceneJoint.sideA ?? 'left'
      const { groundA, groundB } = computeGroundAnchors(anchorA, anchorB, pulley, sideA)
      drawPulleyRope(ctx, viewport, anchorA, anchorB, pulley, groundA, groundB, color, lineWidth)
    } else if (jointState.groundA && jointState.groundB) {
      drawSegment(ctx, viewport, anchorA, jointState.groundA, color, lineWidth)
      drawSegment(ctx, viewport, jointState.groundB, anchorB, color, lineWidth)
    } else {
      drawSegment(ctx, viewport, anchorA, anchorB, color, lineWidth)
    }

    drawAnchorDot(ctx, viewport, anchorA, color)
    drawAnchorDot(ctx, viewport, anchorB, color)
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
    const pulley = getPulleyFromJoint(joint)

    if (pulley) {
      const sideA = getSideA(joint, worldA, worldB, pulley)
      const { groundA, groundB } = computeGroundAnchors(worldA, worldB, pulley, sideA)
      const d1 = pointToSegmentDistance(worldPos.x, worldPos.y, worldA.x, worldA.y, groundA.x, groundA.y)
      const d2 = pointToSegmentDistance(worldPos.x, worldPos.y, groundB.x, groundB.y, worldB.x, worldB.y)
      if (Math.min(d1, d2) < threshold) return true
      // 检测圆弧区域
      const dx = worldPos.x - pulley.center.x, dy = worldPos.y - pulley.center.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (Math.abs(dist - pulley.radius) < threshold && dy > 0) return true
      return false
    }

    return pointToSegmentDistance(worldPos.x, worldPos.y, worldA.x, worldA.y, worldB.x, worldB.y) < threshold
  },

  properties: [
    { key: 'totalLength', label: '总绳长', type: 'number', min: 0.1, step: 0.1, unit: 'm' },
  ],

  toJointConfig(joint: SceneJoint, bodyA: SceneBody, bodyB: SceneBody): JointConfig {
    const worldA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
    const worldB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)

    const pulley = getPulleyFromJoint(joint)
    let groundA: { x: number; y: number }
    let groundB: { x: number; y: number }
    if (pulley) {
      const sideA = getSideA(joint, worldA, worldB, pulley)
      const anchors = computeGroundAnchors(worldA, worldB, pulley, sideA)
      groundA = anchors.groundA
      groundB = anchors.groundB
    } else {
      const fallback = { x: (worldA.x + worldB.x) / 2, y: Math.max(worldA.y, worldB.y) + 0.5 }
      groundA = fallback
      groundB = fallback
    }

    return {
      id: joint.id,
      type: 'pulley',
      bodyIdA: joint.bodyIdA,
      bodyIdB: joint.bodyIdB,
      anchorA: worldA,
      anchorB: worldB,
      groundA,
      groundB,
      ratio: joint.ratio ?? 1,
      totalLength: joint.totalLength ?? 2,
    }
  },
})
