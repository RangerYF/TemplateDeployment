/**
 * ForceRenderer - 力的可视化渲染模块
 * 负责：力箭头+标签绘制、共线防重叠、标签布局、合力渲染、hitTest、正交分解+动画
 */
import type { ForceData, CollectedForceType } from '@/engine/types'
import type { SceneBody, SceneJoint } from '@/models/types'
import { COLORS } from '@/styles/tokens'
import { worldToScreen } from './CoordinateSystem'
import type { Viewport } from './CoordinateSystem'

// ─── 常量 ───

const MAX_LENGTH = 180   // 箭头最大像素长度
const PIXELS_PER_NEWTON = 10 // 教学模式下按线性比例映射

const EDGE_GAP = 0       // 箭头从物体表面直接出发，无间距

const COLLINEAR_THRESHOLD = 0.87  // cos(30°)
const COLLINEAR_OFFSET = 10       // px 力-力/力-连接件偏移步长
const TENSION_COLLINEAR_THRESHOLD = 0.6 // 张力与连接件允许更宽松的同线判定
const TENSION_COLLINEAR_OFFSET = 14 // 张力与连接件重合时使用更明显偏移
const RESULTANT_OFFSET = 14       // px 合力偏移距离

const LABEL_OFFSET = 12           // 标签基础偏移 px
const LABEL_EXTRA_OFFSET = 4      // 竖直力标签额外偏移 px
const TENSION_EXTRA = 6           // 张力标签远离连接件偏移 px
const LABEL_PAD = 6               // 标签间最小间距 px

const ARROW_HEAD_LENGTH = 10      // 箭头头部长度 px
const ARROW_HEAD_WIDTH = 8        // 箭头头部底宽 px
const ARROW_LINE_WIDTH = 2        // 箭杆线宽 px
const HIT_DISTANCE = 5            // hitTest 点到线段距离阈值 px

const DECOMPOSE_IN_DURATION = 0.8   // 分解渐入时长 s
const DECOMPOSE_OUT_DURATION = 0.3  // 分解渐出时长 s

const TEXTBOOK_FORCE_COLOR = COLORS.dark

// ─── 颜色映射 ───

const FORCE_VISUALS: Record<CollectedForceType, { color: string; label: string; chineseName: string }> = {
  gravity:   { color: TEXTBOOK_FORCE_COLOR, label: 'G', chineseName: '重力' },
  gravity_parallel: { color: TEXTBOOK_FORCE_COLOR, label: 'G∥', chineseName: '重力沿斜面分力' },
  gravity_perpendicular: { color: TEXTBOOK_FORCE_COLOR, label: 'G⊥', chineseName: '重力垂斜面分力' },
  normal:    { color: TEXTBOOK_FORCE_COLOR, label: 'N', chineseName: '支持力' },
  friction:  { color: TEXTBOOK_FORCE_COLOR, label: 'f', chineseName: '摩擦力' },
  static_friction: { color: TEXTBOOK_FORCE_COLOR, label: 'f静', chineseName: '静摩擦力' },
  kinetic_friction: { color: TEXTBOOK_FORCE_COLOR, label: 'f滑', chineseName: '滑动摩擦力' },
  tension:   { color: TEXTBOOK_FORCE_COLOR, label: 'T', chineseName: '张力' },
  external:  { color: TEXTBOOK_FORCE_COLOR, label: 'F', chineseName: '外力' },
  resultant: { color: TEXTBOOK_FORCE_COLOR, label: 'F合', chineseName: '合力' },
}

const RESULTANT_COLOR = TEXTBOOK_FORCE_COLOR
const SELECTED_COLOR = TEXTBOOK_FORCE_COLOR

// ─── 类型 ───

export interface ForceRenderItem {
  bodyId: string
  forceId: string         // 唯一标识（用于选中/hitTest）
  forceType: CollectedForceType
  vector: { x: number; y: number }
  magnitude: number
  sourceId?: string
  screenFrom: { x: number; y: number }
  screenTo: { x: number; y: number }
  direction: { x: number; y: number }  // 单位向量（世界坐标）
  color: string
  label: string
  labelText: string       // 完整标签文本
  labelPos?: { x: number; y: number; align: 'left' | 'center' | 'right' }
  isResultant?: boolean
}

export interface DecompositionState {
  forceId: string
  progress: number        // 0~1
  direction: 'in' | 'out'
  axisAngle: number       // 分解坐标系角度（0=水平竖直）
}

interface LabelCandidate {
  x: number
  y: number
  align: 'left' | 'center' | 'right'
}

interface PlacementBox {
  left: number
  top: number
  width: number
  height: number
}

interface BodyPose {
  position: { x: number; y: number }
  angle: number
}

// ─── 工具函数 ───

/** 对数缩放：力大小 → 箭头像素长度 */
export function forceToLength(magnitude: number): number {
  if (magnitude <= 0) return 0
  return Math.min(MAX_LENGTH, magnitude * PIXELS_PER_NEWTON)
}

/** 边缘起点计算：从物体边缘出发而非质心 */
export function getEdgeStart(
  center: { x: number; y: number },
  direction: { x: number; y: number },
  entity: { radius?: number; width?: number; height?: number; rotation?: number },
): { x: number; y: number } {
  const dx = direction.x, dy = direction.y
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return center

  let offset: number

  if (entity.radius != null && entity.radius > 0) {
    offset = entity.radius + EDGE_GAP
  } else if (entity.width != null && entity.height != null) {
    const rot = entity.rotation ?? 0
    let localDx = dx, localDy = dy
    if (Math.abs(rot) > 1e-6) {
      const cosR = Math.cos(-rot)
      const sinR = Math.sin(-rot)
      localDx = dx * cosR - dy * sinR
      localDy = dx * sinR + dy * cosR
    }
    const halfW = entity.width / 2
    const halfH = entity.height / 2
    const tX = Math.abs(localDx) > 1e-9 ? halfW / Math.abs(localDx) : Infinity
    const tY = Math.abs(localDy) > 1e-9 ? halfH / Math.abs(localDy) : Infinity
    offset = Math.min(tX, tY) + EDGE_GAP
  } else {
    return center
  }

  const len = Math.hypot(dx, dy)
  return {
    x: center.x + (dx / len) * offset,
    y: center.y + (dy / len) * offset,
  }
}

/** 力类型 → 颜色/标签 */
export function getForceVisual(forceType: CollectedForceType): { color: string; label: string; chineseName: string } {
  return FORCE_VISUALS[forceType]
}

// ─── 物体几何信息提取 ───

function getBodyGeometry(
  body: SceneBody,
  angleOverride?: number,
): { radius?: number; width?: number; height?: number; rotation?: number } {
  const angle = angleOverride ?? body.angle
  switch (body.type) {
    case 'ball':
      return { radius: body.radius ?? 0.3 }
    case 'block':
      return { width: body.width ?? 1, height: body.height ?? 0.6, rotation: angle }
    case 'conveyor':
      return { width: body.conveyorWidth ?? 2, height: body.conveyorHeight ?? 0.15, rotation: angle }
    case 'wall':
      return { width: body.wallWidth ?? 0.2, height: body.wallHeight ?? 2, rotation: angle }
    case 'anchor':
      return { radius: body.anchorRadius ?? 0.08 }
    case 'pulley-mount':
      return { radius: body.pulleyRadius ?? 0.15 }
    case 'half-sphere':
      return { width: (body.halfSphereRadius ?? 1.0) * 2, height: body.halfSphereRadius ?? 1.0, rotation: angle }
    default:
      // slope, hemisphere, groove 等 → 用简单 bbox 近似
      return { radius: 0.3 }
  }
}

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

// ─── ForceData → ForceRenderItem 转换 ───

function buildRenderItems(
  forces: ForceData[],
  bodies: SceneBody[],
  viewport: Viewport,
  bodyPoseOverrides?: Map<string, BodyPose>,
): ForceRenderItem[] {
  const bodyMap = new Map(bodies.map(b => [b.id, b]))
  const items: ForceRenderItem[] = []

  for (const f of forces) {
    const body = bodyMap.get(f.bodyId)
    if (!body) continue

    const mag = f.magnitude
    if (mag < 0.01) continue

    const dirLen = Math.hypot(f.vector.x, f.vector.y)
    if (dirLen < 1e-9) continue
    const dir = { x: f.vector.x / dirLen, y: f.vector.y / dirLen }

    const pose = bodyPoseOverrides?.get(body.id)
    const bodyPosition = pose?.position ?? body.position
    const bodyAngle = pose?.angle ?? body.angle
    const geo = getBodyGeometry(body, bodyAngle)
    // 教学语义：重力作用点应从质心出发，避免被“边缘起点”与连接件避让影响。
    const startWorld = f.forceType === 'gravity'
      ? bodyPosition
      : getEdgeStart(bodyPosition, dir, geo)
    const arrowLen = forceToLength(mag)

    const screenFrom = worldToScreen(startWorld.x, startWorld.y, viewport)
    // 箭头终点 = 起点 + 方向 × 长度（屏幕空间）
    // 注意 y 轴翻转：世界 y-up → 屏幕 y-down
    const screenDir = { x: dir.x, y: -dir.y }
    const screenDirLen = Math.hypot(screenDir.x, screenDir.y)
    const normScreenDir = { x: screenDir.x / screenDirLen, y: screenDir.y / screenDirLen }

    const screenTo = {
      x: screenFrom.x + normScreenDir.x * arrowLen,
      y: screenFrom.y + normScreenDir.y * arrowLen,
    }

    const visual = getForceVisual(f.forceType)
    const displayLabel = f.label ?? visual.label
    const labelText = `${displayLabel} ${visual.chineseName} = ${mag.toFixed(1)}N`

    items.push({
      bodyId: f.bodyId,
      forceId: f.sourceId ?? `${f.bodyId}:${f.forceType}`,
      forceType: f.forceType,
      vector: f.vector,
      magnitude: mag,
      sourceId: f.sourceId,
      screenFrom: { ...screenFrom },
      screenTo: { ...screenTo },
      direction: dir,
      color: visual.color,
      label: visual.label,
      labelText,
      isResultant: f.forceType === 'resultant',
    })
  }

  return items
}

// ─── 共线防重叠 ───

function resolveCollinear(
  items: ForceRenderItem[],
  joints: SceneJoint[],
  bodies: SceneBody[],
  bodyPoseOverrides?: Map<string, BodyPose>,
): void {
  interface JointDirectionInfo {
    direction: { x: number; y: number }
    jointId?: string
    anchorVector?: { x: number; y: number }
  }

  // 按 bodyId 分组
  const byBody = new Map<string, ForceRenderItem[]>()
  for (const item of items) {
    let arr = byBody.get(item.bodyId)
    if (!arr) { arr = []; byBody.set(item.bodyId, arr) }
    arr.push(item)
  }

  const bodyMap = new Map(bodies.map(b => [b.id, b]))
  const getPose = (body: SceneBody): BodyPose => {
    const override = bodyPoseOverrides?.get(body.id)
    return override
      ? { position: override.position, angle: override.angle }
      : { position: body.position, angle: body.angle }
  }

  for (const [bodyId, bodyItems] of byBody) {
    // 层1：力-力共线偏移（仅同方向才避让，反方向不重叠无需偏移）
    for (let i = 1; i < bodyItems.length; i++) {
      if (bodyItems[i].forceType === 'gravity') continue
      let slot = 0
      for (let j = 0; j < i; j++) {
        if (bodyItems[j].forceType === 'gravity') continue
        const dot =
          bodyItems[i].direction.x * bodyItems[j].direction.x +
          bodyItems[i].direction.y * bodyItems[j].direction.y
        if (dot > COLLINEAR_THRESHOLD) slot++
      }
      if (slot > 0) {
        // 垂直于力方向偏移（屏幕空间，y翻转）
        const screenDir = { x: bodyItems[i].direction.x, y: -bodyItems[i].direction.y }
        const perpX = -screenDir.y * slot * COLLINEAR_OFFSET
        const perpY = screenDir.x * slot * COLLINEAR_OFFSET
        bodyItems[i].screenFrom.x += perpX
        bodyItems[i].screenFrom.y += perpY
        bodyItems[i].screenTo.x += perpX
        bodyItems[i].screenTo.y += perpY
      }
    }

    // 层2：力-连接件共线偏移
    const connInfos: JointDirectionInfo[] = []
    const body = bodyMap.get(bodyId)
    if (body) {
      const bodyPose = getPose(body)
      for (const joint of joints) {
        const isA = joint.bodyIdA === bodyId
        const isB = joint.bodyIdB === bodyId
        if (!isA && !isB) continue

        // 滑轮绳：绳方向是从物体到滑轮座（非另一端物体）
        if (joint.type === 'pulley' && joint.pulleyMountId) {
          const mount = bodyMap.get(joint.pulleyMountId)
          if (mount) {
            const mountPose = getPose(mount)
            const localAnchor = isA ? joint.anchorA : joint.anchorB
            const myAnchor = localToWorld(localAnchor, bodyPose.position, bodyPose.angle)
            const dx = mountPose.position.x - myAnchor.x
            const dy = mountPose.position.y - myAnchor.y
            const len = Math.hypot(dx, dy)
            if (len > 1e-9) {
              connInfos.push({
                direction: { x: dx / len, y: dy / len },
                jointId: joint.id,
                anchorVector: {
                  x: myAnchor.x - bodyPose.position.x,
                  y: myAnchor.y - bodyPose.position.y,
                },
              })
            }
          }
          continue
        }

        const otherBody = bodyMap.get(isA ? joint.bodyIdB : joint.bodyIdA)
        if (!otherBody) continue
        const otherPose = getPose(otherBody)
        const localMy = isA ? joint.anchorA : joint.anchorB
        const localOther = isA ? joint.anchorB : joint.anchorA
        const myAnchor = localToWorld(localMy, bodyPose.position, bodyPose.angle)
        const otherAnchor = localToWorld(localOther, otherPose.position, otherPose.angle)
        const dx = otherAnchor.x - myAnchor.x
        const dy = otherAnchor.y - myAnchor.y
        const len = Math.hypot(dx, dy)
        if (len > 1e-9) {
          connInfos.push({
            direction: { x: dx / len, y: dy / len },
            jointId: joint.id,
            anchorVector: {
              x: myAnchor.x - bodyPose.position.x,
              y: myAnchor.y - bodyPose.position.y,
            },
          })
        }
      }
    }

    if (connInfos.length > 0) {
      for (const item of bodyItems) {
        if (item.isResultant || item.forceType === 'gravity') continue
        const relatedInfos = item.forceType === 'tension' && item.sourceId
          ? connInfos.filter((info) => info.jointId === item.sourceId)
          : connInfos
        const dirs = relatedInfos.length > 0 ? relatedInfos : connInfos
        let connSlot = 0
        const strictTensionMode = item.forceType === 'tension' && relatedInfos.length > 0
        for (const info of dirs) {
          const dot = item.direction.x * info.direction.x + item.direction.y * info.direction.y
          if (strictTensionMode) {
            if (Math.abs(dot) > TENSION_COLLINEAR_THRESHOLD) {
              connSlot = Math.max(connSlot, 1)
            }
          } else if (dot > COLLINEAR_THRESHOLD) {
            connSlot++
          }
        }
        if (connSlot > 0) {
          const screenDir = { x: item.direction.x, y: -item.direction.y }
          let sideSign = 1
          if (strictTensionMode) {
            const anchorVec = relatedInfos[0]?.anchorVector
            if (anchorVec) {
              // 选择“远离物体中心->锚点方向”的一侧，避免某一边仍贴着绳。
              const anchorScreen = { x: anchorVec.x, y: -anchorVec.y }
              const basePerp = { x: -screenDir.y, y: screenDir.x }
              const outwardDot = basePerp.x * anchorScreen.x + basePerp.y * anchorScreen.y
              sideSign = outwardDot >= 0 ? 1 : -1
            }
          }
          const slotOffset = strictTensionMode ? TENSION_COLLINEAR_OFFSET : COLLINEAR_OFFSET
          const perpX = -screenDir.y * connSlot * slotOffset * sideSign
          const perpY = screenDir.x * connSlot * slotOffset * sideSign
          item.screenFrom.x += perpX
          item.screenFrom.y += perpY
          item.screenTo.x += perpX
          item.screenTo.y += perpY
        }
      }
    }
  }
}

// ─── 合力计算 ───

function computeResultants(
  items: ForceRenderItem[],
  bodies: SceneBody[],
  viewport: Viewport,
): ForceRenderItem[] {
  const byBody = new Map<string, ForceRenderItem[]>()
  for (const item of items) {
    let arr = byBody.get(item.bodyId)
    if (!arr) { arr = []; byBody.set(item.bodyId, arr) }
    arr.push(item)
  }

  const bodyMap = new Map(bodies.map(b => [b.id, b]))
  const resultants: ForceRenderItem[] = []

  for (const [bodyId, bodyItems] of byBody) {
    const body = bodyMap.get(bodyId)
    if (!body) continue

    // 向量求和
    let sumX = 0, sumY = 0
    for (const item of bodyItems) {
      sumX += item.vector.x
      sumY += item.vector.y
    }
    const mag = Math.hypot(sumX, sumY)

    // 合力为零不画
    if (mag < 0.01) continue

    const dir = { x: sumX / mag, y: sumY / mag }

    // 冗余检测：合力 ≈ 某独立力
    const redundant = bodyItems.some(f =>
      Math.abs(f.magnitude - mag) < 0.01 &&
      Math.abs(f.direction.x - dir.x) < 0.01 &&
      Math.abs(f.direction.y - dir.y) < 0.01,
    )
    if (redundant) continue

    const geo = getBodyGeometry(body)
    const edgeStart = getEdgeStart(body.position, dir, geo)
    const arrowLen = forceToLength(mag)
    const screenFrom = worldToScreen(edgeStart.x, edgeStart.y, viewport)
    const screenDir = { x: dir.x, y: -dir.y }
    const screenDirLen = Math.hypot(screenDir.x, screenDir.y)
    const normScreenDir = { x: screenDir.x / screenDirLen, y: screenDir.y / screenDirLen }
    const screenTo = {
      x: screenFrom.x + normScreenDir.x * arrowLen,
      y: screenFrom.y + normScreenDir.y * arrowLen,
    }

    // 层3：合力特殊偏移 — 仅当与某独立力同方向共线时才偏移（反方向不重叠）
    let needsOffset = false
    for (const item of bodyItems) {
      const dot = dir.x * item.direction.x + dir.y * item.direction.y
      if (dot > COLLINEAR_THRESHOLD) { needsOffset = true; break }
    }
    if (needsOffset) {
      // 偏移到负方向轨道
      const perpX = screenDir.y * RESULTANT_OFFSET  // 注意方向相反
      const perpY = -screenDir.x * RESULTANT_OFFSET
      screenFrom.x += perpX
      screenFrom.y += perpY
      screenTo.x += perpX
      screenTo.y += perpY
    }

    resultants.push({
      bodyId,
      forceId: `${bodyId}:resultant`,
      forceType: 'resultant',
      vector: { x: sumX, y: sumY },
      magnitude: mag,
      screenFrom,
      screenTo,
      direction: dir,
      color: RESULTANT_COLOR,
      label: 'F合',
      labelText: `F合 合力 = ${mag.toFixed(1)}N`,
      isResultant: true,
    })
  }

  return resultants
}

// ─── 标签布局 ───

function generateLabelCandidates(
  screenFrom: { x: number; y: number },
  screenTo: { x: number; y: number },
  direction: { x: number; y: number },
): LabelCandidate[] {
  const mid = {
    x: (screenFrom.x + screenTo.x) / 2,
    y: (screenFrom.y + screenTo.y) / 2,
  }
  const tip = screenTo
  const off = LABEL_OFFSET

  // 屏幕空间方向（y翻转）
  const screenDirX = direction.x
  const screenDirY = -direction.y
  const isHorizontal = Math.abs(screenDirX) > Math.abs(screenDirY)
  const goesRight = screenDirX > 0
  const goesUp = screenDirY < 0  // 屏幕y轴向下

  const candidates: LabelCandidate[] = []

  if (isHorizontal) {
    candidates.push({
      x: tip.x + (goesRight ? off : -off),
      y: tip.y - off,
      align: goesRight ? 'left' : 'right',
    })
    candidates.push({
      x: tip.x + (goesRight ? off : -off),
      y: tip.y + off,
      align: goesRight ? 'left' : 'right',
    })
    candidates.push({ x: mid.x, y: mid.y - off, align: 'center' })
    candidates.push({ x: mid.x, y: mid.y + off, align: 'center' })
  } else {
    const extraOff = off + LABEL_EXTRA_OFFSET
    candidates.push({ x: mid.x + extraOff, y: mid.y, align: 'left' })
    candidates.push({ x: mid.x - extraOff, y: mid.y, align: 'right' })
    candidates.push({
      x: tip.x + extraOff,
      y: tip.y + (goesUp ? -off : off),
      align: 'left',
    })
    candidates.push({
      x: tip.x - extraOff,
      y: tip.y + (goesUp ? -off : off),
      align: 'right',
    })
  }

  return candidates
}

function boxesOverlap(a: PlacementBox, b: PlacementBox, pad: number): boolean {
  return !(
    a.left + a.width + pad < b.left ||
    b.left + b.width + pad < a.left ||
    a.top + a.height + pad < b.top ||
    b.top + b.height + pad < a.top
  )
}

function placeLabel(
  candidates: LabelCandidate[],
  labelWidth: number,
  labelHeight: number,
  occupied: PlacementBox[],
): LabelCandidate {
  for (const cand of candidates) {
    const box: PlacementBox = {
      left: cand.align === 'right' ? cand.x - labelWidth : cand.align === 'center' ? cand.x - labelWidth / 2 : cand.x,
      top: cand.y - labelHeight / 2,
      width: labelWidth,
      height: labelHeight,
    }
    const overlaps = occupied.some(obs => boxesOverlap(box, obs, LABEL_PAD))
    if (!overlaps) {
      occupied.push(box)
      return cand
    }
  }
  // 全部重叠 → 选最高偏好
  const fallback = candidates[0]
  const box: PlacementBox = {
    left: fallback.align === 'right' ? fallback.x - labelWidth : fallback.align === 'center' ? fallback.x - labelWidth / 2 : fallback.x,
    top: fallback.y - labelHeight / 2,
    width: labelWidth,
    height: labelHeight,
  }
  occupied.push(box)
  return fallback
}

/** 力排列优先顺序 */
const FORCE_ORDER: Record<string, number> = {
  gravity: 0,
  gravity_parallel: 1,
  gravity_perpendicular: 2,
  normal: 3,
  static_friction: 4,
  kinetic_friction: 5,
  friction: 6,
  tension: 7,
  external: 8,
  resultant: 9,
}

function assignLabels(
  items: ForceRenderItem[],
  ctx: CanvasRenderingContext2D,
): void {
  // 按 bodyId 分组
  const byBody = new Map<string, ForceRenderItem[]>()
  for (const item of items) {
    let arr = byBody.get(item.bodyId)
    if (!arr) { arr = []; byBody.set(item.bodyId, arr) }
    arr.push(item)
  }

  ctx.save()
  ctx.font = '11px sans-serif'

  for (const bodyItems of byBody.values()) {
    const occupied: PlacementBox[] = []

    // 按力排列顺序排序
    bodyItems.sort((a, b) => (FORCE_ORDER[a.forceType] ?? 5) - (FORCE_ORDER[b.forceType] ?? 5))

    for (const item of bodyItems) {
      let candidates = generateLabelCandidates(item.screenFrom, item.screenTo, item.direction)

      // 张力额外偏移
      if (item.forceType === 'tension') {
        const sdx = item.screenTo.x - item.screenFrom.x
        const sdy = item.screenTo.y - item.screenFrom.y
        const slen = Math.hypot(sdx, sdy)
        if (slen > 1) {
          const px = -sdy / slen * TENSION_EXTRA
          const py = sdx / slen * TENSION_EXTRA
          candidates = candidates.map(c => ({ ...c, x: c.x + px, y: c.y + py }))
        }
      }

      const metrics = ctx.measureText(item.labelText)
      const labelWidth = metrics.width
      const labelHeight = 13

      const pos = placeLabel(candidates, labelWidth, labelHeight, occupied)
      item.labelPos = pos
    }
  }

  ctx.restore()
}

// ─── 绘制函数 ───

function drawForceArrow(
  ctx: CanvasRenderingContext2D,
  item: ForceRenderItem,
  options: {
    selected?: boolean
    hovered?: boolean
    body?: SceneBody
    viewport?: Viewport
    bodyPoseOverride?: BodyPose
  },
): void {
  const { screenFrom, screenTo } = item
  const dx = screenTo.x - screenFrom.x
  const dy = screenTo.y - screenFrom.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return

  const ndx = dx / len
  const ndy = dy / len

  const color = options.selected ? SELECTED_COLOR : item.color
  const lineWidth = options.hovered || options.selected ? 2.5 : ARROW_LINE_WIDTH

  ctx.save()

  if (item.forceType === 'gravity' && options.body && options.viewport) {
    const body = options.body
    const viewport = options.viewport
    const pose = options.bodyPoseOverride ?? { position: body.position, angle: body.angle }
    const centerScreen = worldToScreen(pose.position.x, pose.position.y, viewport)
    const geo = getBodyGeometry(body, pose.angle)

    // 只绘制“物体外部”的重力箭头段，保证物体视觉层级在最上。
    ctx.beginPath()
    ctx.rect(0, 0, viewport.canvasSize.width, viewport.canvasSize.height)
    ctx.save()
    ctx.translate(centerScreen.x, centerScreen.y)
    ctx.rotate(-pose.angle)
    if (geo.radius != null && geo.radius > 0) {
      ctx.moveTo((geo.radius + EDGE_GAP) * viewport.scale, 0)
      ctx.arc(0, 0, (geo.radius + EDGE_GAP) * viewport.scale, 0, Math.PI * 2)
    } else if (geo.width != null && geo.height != null) {
      const w = geo.width * viewport.scale
      const h = geo.height * viewport.scale
      ctx.rect(-w / 2, -h / 2, w, h)
    } else {
      const r = 0.3 * viewport.scale
      ctx.moveTo(r, 0)
      ctx.arc(0, 0, r, 0, Math.PI * 2)
    }
    ctx.restore()
    ctx.clip('evenodd')
  }

  // 虚线（合力用）
  if (item.isResultant) {
    ctx.setLineDash([8, 4])
  }

  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = lineWidth

  // 箭杆（到箭头底部）
  const arrowEnd = {
    x: screenTo.x - ndx * ARROW_HEAD_LENGTH,
    y: screenTo.y - ndy * ARROW_HEAD_LENGTH,
  }
  ctx.beginPath()
  ctx.moveTo(screenFrom.x, screenFrom.y)
  ctx.lineTo(arrowEnd.x, arrowEnd.y)
  ctx.stroke()

  // 箭头实心三角形
  ctx.setLineDash([])
  const perpX = -ndy * ARROW_HEAD_WIDTH / 2
  const perpY = ndx * ARROW_HEAD_WIDTH / 2
  ctx.beginPath()
  ctx.moveTo(screenTo.x, screenTo.y)
  ctx.lineTo(arrowEnd.x + perpX, arrowEnd.y + perpY)
  ctx.lineTo(arrowEnd.x - perpX, arrowEnd.y - perpY)
  ctx.closePath()
  ctx.fill()

  ctx.restore()
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  item: ForceRenderItem,
  selected: boolean,
): void {
  if (!item.labelPos) return

  const { x, y, align } = item.labelPos
  const color = selected ? SELECTED_COLOR : item.color

  ctx.save()
  ctx.font = '11px sans-serif'
  ctx.fillStyle = color
  ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(item.labelText, x, y)
  ctx.restore()
}

// ─── 正交分解 ───

export function decompose(
  vector: { x: number; y: number },
  axisAngle: number,
): { along: { x: number; y: number }; perp: { x: number; y: number } } {
  // axis 方向单位向量
  const ax = Math.cos(axisAngle)
  const ay = Math.sin(axisAngle)
  // 投影到 axis
  const dot = vector.x * ax + vector.y * ay
  const along = { x: dot * ax, y: dot * ay }
  // 垂直分量
  const perp = { x: vector.x - along.x, y: vector.y - along.y }
  return { along, perp }
}

function drawDecomposition(
  ctx: CanvasRenderingContext2D,
  state: DecompositionState,
  item: ForceRenderItem,
  body: SceneBody,
  viewport: Viewport,
  otherDirs: Array<{ x: number; y: number }> = [],
  bodyPoseOverride?: BodyPose,
): void {
  const { along, perp } = decompose(item.vector, state.axisAngle)
  const p = state.progress
  const DECOMP_PERP_OFFSET = 10  // 共线偏移 px
  const bodyPosition = bodyPoseOverride?.position ?? body.position
  const bodyAngle = bodyPoseOverride?.angle ?? body.angle
  const geo = getBodyGeometry(body, bodyAngle)

  // 每个分量从物体中心出发，沿自己的方向到边缘（与独立力一致）
  const compStarts: Array<{ x: number; y: number }> = []
  const compEnds: Array<{ x: number; y: number; mag: number }> = []
  for (const comp of [along, perp]) {
    const mag = Math.hypot(comp.x, comp.y)
    if (mag < 0.01) {
      compStarts.push({ x: item.screenFrom.x, y: item.screenFrom.y })
      compEnds.push({ x: item.screenFrom.x, y: item.screenFrom.y, mag: 0 })
      continue
    }
    const dir = { x: comp.x / mag, y: comp.y / mag }
    const len = forceToLength(mag)

    // 从物体中心沿分量方向到边缘
    const startWorld = item.forceType === 'gravity'
      ? bodyPosition
      : getEdgeStart(bodyPosition, dir, geo)
    const screenStart = worldToScreen(startWorld.x, startWorld.y, viewport)

    const sd = { x: dir.x, y: -dir.y }
    const sdl = Math.hypot(sd.x, sd.y)
    const nsd = { x: sd.x / sdl, y: sd.y / sdl }

    // 共线检测：分量方向与其他力**同向**时才避让（dot > 0.87）
    // 反向（dot < -0.87）不会重叠，不需要偏移
    const isCollinear = otherDirs.some(d => (d.x * dir.x + d.y * dir.y) > 0.87)
    let offX = 0, offY = 0
    if (isCollinear) {
      offX = nsd.y * DECOMP_PERP_OFFSET
      offY = -nsd.x * DECOMP_PERP_OFFSET
    }

    compStarts.push({
      x: screenStart.x + offX,
      y: screenStart.y + offY,
    })
    compEnds.push({
      x: screenStart.x + offX + nsd.x * len,
      y: screenStart.y + offY + nsd.y * len,
      mag,
    })
  }

  // 阶段1：坐标轴参考线（0%-30%）
  if (p > 0) {
    const axisAlpha = Math.min(1, p / 0.3) * 0.3
    ctx.save()
    ctx.globalAlpha = axisAlpha
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = TEXTBOOK_FORCE_COLOR
    ctx.lineWidth = 1

    const lineLen = 200
    for (const angle of [state.axisAngle, state.axisAngle + Math.PI / 2]) {
      const adx = Math.cos(angle)
      const ady = -Math.sin(angle)
      ctx.beginPath()
      ctx.moveTo(item.screenFrom.x - adx * lineLen, item.screenFrom.y - ady * lineLen)
      ctx.lineTo(item.screenFrom.x + adx * lineLen, item.screenFrom.y + ady * lineLen)
      ctx.stroke()
    }
    ctx.restore()
  }

  // 阶段2：分量箭头+引导虚线（30%-60%）
  if (p > 0.3) {
    const growFactor = Math.min(1, (p - 0.3) / 0.3)
    ctx.save()

    // 分量箭头（虚线，原力颜色 70% 透明）
    for (let ci = 0; ci < 2; ci++) {
      const start = compStarts[ci]
      const end = compEnds[ci]
      if (end.mag < 0.01) continue

      // 动画中间态：从起点到终点按 growFactor 插值
      const compTo = {
        x: start.x + (end.x - start.x) * growFactor,
        y: start.y + (end.y - start.y) * growFactor,
      }

      ctx.setLineDash([6, 4])
      ctx.strokeStyle = item.color
      ctx.fillStyle = item.color
      ctx.lineWidth = 1.8
      ctx.globalAlpha = growFactor * 0.7

      const cDx = compTo.x - start.x
      const cDy = compTo.y - start.y
      const cLen = Math.hypot(cDx, cDy)
      if (cLen > ARROW_HEAD_LENGTH) {
        const cNdx = cDx / cLen, cNdy = cDy / cLen
        const arrowBase = {
          x: compTo.x - cNdx * ARROW_HEAD_LENGTH * 0.7,
          y: compTo.y - cNdy * ARROW_HEAD_LENGTH * 0.7,
        }
        ctx.beginPath()
        ctx.moveTo(start.x, start.y)
        ctx.lineTo(arrowBase.x, arrowBase.y)
        ctx.stroke()

        ctx.setLineDash([])
        const pX = -cNdy * ARROW_HEAD_WIDTH * 0.35
        const pY = cNdx * ARROW_HEAD_WIDTH * 0.35
        ctx.beginPath()
        ctx.moveTo(compTo.x, compTo.y)
        ctx.lineTo(arrowBase.x + pX, arrowBase.y + pY)
        ctx.lineTo(arrowBase.x - pX, arrowBase.y - pY)
        ctx.closePath()
        ctx.fill()
      }
    }

    // 引导虚线：原力终点投影到分量轴（力本身颜色）
    ctx.globalAlpha = growFactor * 0.35
    ctx.setLineDash([3, 3])
    ctx.strokeStyle = item.color
    ctx.lineWidth = 1

    for (let ci = 0; ci < 2; ci++) {
      if (compEnds[ci].mag < 0.01) continue
      const start = compStarts[ci]
      const end = compEnds[ci]
      // 投影力尖端到分量轴上
      const axisDx = end.x - start.x
      const axisDy = end.y - start.y
      const axisLen = Math.hypot(axisDx, axisDy)
      if (axisLen < 0.01) continue
      const axisNx = axisDx / axisLen, axisNy = axisDy / axisLen
      const tipDx = item.screenTo.x - start.x
      const tipDy = item.screenTo.y - start.y
      const dot = tipDx * axisNx + tipDy * axisNy
      const proj = {
        x: start.x + axisNx * dot,
        y: start.y + axisNy * dot,
      }
      ctx.beginPath()
      ctx.moveTo(item.screenTo.x, item.screenTo.y)
      ctx.lineTo(proj.x, proj.y)
      ctx.stroke()
    }

    ctx.restore()
  }

  // 阶段3：直角标记（50%-80%）— 放在力尖端处
  if (p > 0.5) {
    const markAlpha = Math.min(1, (p - 0.5) / 0.3) * 0.6
    ctx.save()
    ctx.globalAlpha = markAlpha
    ctx.strokeStyle = TEXTBOOK_FORCE_COLOR
    ctx.lineWidth = 1
    ctx.setLineDash([])

    const markSize = 8
    // 从力尖端出发，沿两个分量的反方向画直角
    const d1 = { x: compEnds[0].x - item.screenTo.x, y: compEnds[0].y - item.screenTo.y }
    const d2 = { x: compEnds[1].x - item.screenTo.x, y: compEnds[1].y - item.screenTo.y }
    const l1 = Math.hypot(d1.x, d1.y), l2 = Math.hypot(d2.x, d2.y)
    if (l1 > 0.01 && l2 > 0.01) {
      const n1 = { x: d1.x / l1 * markSize, y: d1.y / l1 * markSize }
      const n2 = { x: d2.x / l2 * markSize, y: d2.y / l2 * markSize }
      ctx.beginPath()
      ctx.moveTo(item.screenTo.x + n1.x, item.screenTo.y + n1.y)
      ctx.lineTo(item.screenTo.x + n1.x + n2.x, item.screenTo.y + n1.y + n2.y)
      ctx.lineTo(item.screenTo.x + n2.x, item.screenTo.y + n2.y)
      ctx.stroke()
    }
    ctx.restore()
  }

  // 阶段4：分量标签（60%-100%）
  if (p > 0.6) {
    const labelAlpha = Math.min(1, (p - 0.6) / 0.4)
    ctx.save()
    ctx.globalAlpha = labelAlpha
    ctx.font = '11px sans-serif'
    ctx.fillStyle = item.color

    const visual = item.forceType !== 'resultant' ? getForceVisual(item.forceType as CollectedForceType) : null
    const baseLetter = visual ? visual.label : 'F'

    for (let ci = 0; ci < 2; ci++) {
      const start = compStarts[ci]
      const end = compEnds[ci]
      if (end.mag < 0.01) continue
      const suffix = ci === 0 ? '\u2081' : '\u2082'  // 下标 ₁ ₂
      const text = `${baseLetter}${suffix}=${end.mag.toFixed(1)}N`
      const mid = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
      }
      // 垂直于分量方向偏移放置标签
      const dx = end.x - start.x
      const dy = end.y - start.y
      const dl = Math.hypot(dx, dy)
      if (dl < 0.01) continue
      const perpX = -dy / dl * 12
      const perpY = dx / dl * 12
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(text, mid.x + perpX, mid.y + perpY)
    }

    ctx.restore()
  }
}

// ─── hitTest ───

function pointToSegmentDistance(
  px: number, py: number,
  ax: number, ay: number,
  bx: number, by: number,
): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-9) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = ax + t * dx
  const projY = ay + t * dy
  return Math.hypot(px - projX, py - projY)
}

export function hitTestForce(
  screenX: number,
  screenY: number,
  forceItems: ForceRenderItem[],
): string | null {
  // 反向遍历（后绘制的在上面）
  for (let i = forceItems.length - 1; i >= 0; i--) {
    const item = forceItems[i]
    const dist = pointToSegmentDistance(
      screenX, screenY,
      item.screenFrom.x, item.screenFrom.y,
      item.screenTo.x, item.screenTo.y,
    )
    if (dist < HIT_DISTANCE) return item.forceId
  }
  return null
}

// ─── 分解状态更新 ───

export function updateDecompositionProgress(state: DecompositionState, dt: number): boolean {
  if (state.direction === 'in') {
    state.progress = Math.min(1, state.progress + dt / DECOMPOSE_IN_DURATION)
    return state.progress < 1  // 还在动画中
  } else {
    state.progress = Math.max(0, state.progress - dt / DECOMPOSE_OUT_DURATION)
    return state.progress > 0  // 还在动画中
  }
}

// ─── 主渲染入口 ───

/** 缓存上一帧的 renderItems，供 hitTest 使用 */
let _lastRenderItems: ForceRenderItem[] = []

export function getLastRenderItems(): ForceRenderItem[] {
  return _lastRenderItems
}

export function renderForces(
  ctx: CanvasRenderingContext2D,
  forceData: ForceData[],
  bodies: SceneBody[],
  joints: SceneJoint[],
  viewport: Viewport,
  options: {
    selectedForceId?: string | null
    hoveredForceId?: string | null
    decompositions?: Map<string, DecompositionState>
    bodyPoseOverrides?: Map<string, BodyPose>
  } = {},
): void {
  if (forceData.length === 0) {
    _lastRenderItems = []
    return
  }

  // 1. 构建 ForceRenderItem[]
  const items = buildRenderItems(forceData, bodies, viewport, options.bodyPoseOverrides)
  const bodyMap = new Map(bodies.map(b => [b.id, b]))

  // 2. 合力：如果输入中已包含 resultant（外部预计算），跳过内部计算
  const hasExternalResultants = forceData.some(f => f.forceType === 'resultant')
  const resultants = hasExternalResultants ? [] : computeResultants(items, bodies, viewport)
  const allItems = [...items, ...resultants]

  // 3. 共线防重叠
  resolveCollinear(allItems, joints, bodies, options.bodyPoseOverrides)

  // 4. 标签布局
  assignLabels(allItems, ctx)

  // 5. 绘制
  for (const item of allItems) {
    const selected = options.selectedForceId === item.forceId
    const hovered = options.hoveredForceId === item.forceId
    const body = bodyMap.get(item.bodyId)
    drawForceArrow(ctx, item, {
      selected,
      hovered,
      body,
      viewport,
      bodyPoseOverride: body ? options.bodyPoseOverrides?.get(body.id) : undefined,
    })
    drawLabel(ctx, item, selected)
  }

  // 6. 正交分解
  if (options.decompositions) {
    for (const [forceId, state] of options.decompositions) {
      if (state.progress <= 0) continue
      const item = allItems.find(i => i.forceId === forceId)
      if (!item) continue
      const body = bodyMap.get(item.bodyId)
      if (!body) continue
      // 收集该物体的所有其他力方向（用于共线避让）
      const otherDirs: Array<{ x: number; y: number }> = []
      for (const other of allItems) {
        if (other.forceId === forceId) continue
        if (other.bodyId !== item.bodyId) continue
        const m = Math.hypot(other.vector.x, other.vector.y)
        if (m > 0.01) otherDirs.push({ x: other.vector.x / m, y: other.vector.y / m })
      }
      const bodyPoseOverride = options.bodyPoseOverrides?.get(item.bodyId)
      drawDecomposition(ctx, state, item, body, viewport, otherDirs, bodyPoseOverride)
    }
  }

  // 缓存供 hitTest 使用
  _lastRenderItems = allItems
}
