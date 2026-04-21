import type { Tool, CanvasMouseEvent } from './Tool'
import { useSceneStore } from '@/store/sceneStore'
import { useSelectionStore, selectedBodyIds } from '@/store/selectionStore'
import { useViewportStore } from '@/store/viewportStore'
import { hitTestBodies, hitTestJoints } from '@/core/hitTest'
import { hitTestForce, getLastRenderItems } from '@/renderer/ForceRenderer'
import { useCommandStore } from '@/store/commandStore'
import { MoveBodyCommand } from '@/core/commands/MoveBodyCommand'
import { BatchMoveCommand } from '@/core/commands/BatchMoveCommand'
import { BatchPropertyCommand } from '@/core/commands/BatchPropertyCommand'
import {
  getHandles,
  getSelectionBBox,
  hitTestHandle,
  computeResize,
  computeRotation,
  CURSOR_MAP,
  type HandleType,
} from '@/core/handles/SelectionHandles'
import { worldToScreen, screenToWorld } from '@/renderer/CoordinateSystem'
import type { Viewport } from '@/renderer/CoordinateSystem'
import type { SceneBody } from '@/models/types'
import { getBodyDescriptor, getInteraction } from '@/models/bodyTypes'
import { computeSnap, getGroundContactBodyIds } from '@/core/snap/SnapEngine'
import type { SnapResult } from '@/core/snap/types'
import type { AlignGuide } from '@/core/align/AlignEngine'
import { FEEDBACK_VISUAL } from '@/styles/tokens'

type DragMode = 'none' | 'move' | 'resize' | 'rotate' | 'marquee'

/** 局部坐标 → 世界坐标 */
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

/** 世界坐标锚点 → 反推物体 position */
function anchorWorldToBodyPos(
  anchorWorld: { x: number; y: number },
  localAnchor: { x: number; y: number },
  bodyAngle: number,
): { x: number; y: number } {
  const cos = Math.cos(bodyAngle)
  const sin = Math.sin(bodyAngle)
  return {
    x: anchorWorld.x - (localAnchor.x * cos - localAnchor.y * sin),
    y: anchorWorld.y - (localAnchor.x * sin + localAnchor.y * cos),
  }
}

/** 计算物体的世界空间 AABB */
function getBodyWorldAABB(body: SceneBody): { x1: number; y1: number; x2: number; y2: number } {
  const desc = getBodyDescriptor(body.type)
  const { halfW, halfH } = desc.getSelectionBounds(body, 1) // scale=1 → 世界单位

  // 考虑旋转：用旋转后的 AABB
  const cos = Math.abs(Math.cos(body.angle))
  const sin = Math.abs(Math.sin(body.angle))
  const rotW = halfW * cos + halfH * sin
  const rotH = halfW * sin + halfH * cos

  return {
    x1: body.position.x - rotW,
    y1: body.position.y - rotH,
    x2: body.position.x + rotW,
    y2: body.position.y + rotH,
  }
}

/** 两个矩形是否重叠 */
function rectsOverlap(
  a: { x1: number; y1: number; x2: number; y2: number },
  b: { x1: number; y1: number; x2: number; y2: number },
): boolean {
  return a.x1 <= b.x2 && a.x2 >= b.x1 && a.y1 <= b.y2 && a.y2 >= b.y1
}

/** 框选 hitTest：返回 marquee 矩形内的 body ID 列表 */
function getBodyIdsInRect(
  rect: { x1: number; y1: number; x2: number; y2: number },
  bodies: SceneBody[],
): string[] {
  // 归一化 rect（确保 x1<x2, y1<y2）
  const norm = {
    x1: Math.min(rect.x1, rect.x2),
    y1: Math.min(rect.y1, rect.y2),
    x2: Math.max(rect.x1, rect.x2),
    y2: Math.max(rect.y1, rect.y2),
  }
  const result: string[] = []
  for (const body of bodies) {
    if (body.type === 'ground') continue // ground 不参与框选
    if (!getInteraction(body).selectable) continue
    const aabb = getBodyWorldAABB(body)
    if (rectsOverlap(norm, aabb)) {
      result.push(body.id)
    }
  }
  return result
}

const MARQUEE_DRAG_THRESHOLD = 3 // px
const CONSTRAINT_EPSILON = 1e-6
const MIN_PULLEY_SEGMENT = 0.01

function normalizeVector(
  dx: number,
  dy: number,
  fallback: { x: number; y: number } = { x: 1, y: 0 },
): { x: number; y: number; dist: number } {
  const dist = Math.hypot(dx, dy)
  if (dist > CONSTRAINT_EPSILON) {
    return { x: dx / dist, y: dy / dist, dist }
  }
  const fallbackDist = Math.hypot(fallback.x, fallback.y)
  if (fallbackDist > CONSTRAINT_EPSILON) {
    return { x: fallback.x / fallbackDist, y: fallback.y / fallbackDist, dist: 0 }
  }
  return { x: 1, y: 0, dist: 0 }
}

export class SelectTool implements Tool {
  name = 'select'
  cursor = 'default'

  private dragMode: DragMode = 'none'
  private dragBodyId: string | null = null
  private dragStartWorldPos: { x: number; y: number } | null = null
  private dragStartBodyPos: { x: number; y: number } | null = null
  private dragStartBodyAngle: number = 0
  /** 联动拖拽：记录被绳带动的物体初始位置 */
  private linkedBodyStartPositions: Map<string, { x: number; y: number }> = new Map()
  /** Angle offset between computed rotation and body angle at drag start (for smooth rotation) */
  private rotateAngleOffset: number = 0
  /** Snapshot of the body at drag start, used as the base for resize computations */
  private dragStartBody: SceneBody | null = null
  private dragStartBodyProps: Partial<SceneBody> = {}
  private activeHandle: HandleType | null = null

  // ─── 多选拖拽 ───
  private dragBodyIds: string[] = []
  private dragStartPositions: Map<string, { x: number; y: number }> = new Map()

  // ─── 地面联动 ───
  private groundContactBodyIds: string[] = []
  private groundContactStartPositions: Map<string, { x: number; y: number }> = new Map()

  // ─── 框选 ───
  private marqueeStartScreen: { x: number; y: number } | null = null
  private marqueeCurrentScreen: { x: number; y: number } | null = null
  private isMarqueeActive = false

  /** Current snap result for visual feedback */
  currentSnapResult: SnapResult | null = null
  /** Current alignment guides for visual feedback */
  currentAlignGuides: AlignGuide[] = []
  /** Rotate icon visual state: default(gray), hover(black), active(black+hidden cursor) */
  rotateIconState: 'default' | 'hover' | 'active' = 'default'

  onMouseDown(e: CanvasMouseEvent): void {
    if (e.button !== 0) return

    const bodies = useSceneStore.getState().scene.bodies
    const selected = useSelectionStore.getState().selected

    // If there's a single selected body, first check if we're clicking on a handle
    if (selected.length === 1 && selected[0].type === 'body') {
      const body = bodies.find((b) => b.id === selected[0].id)
      if (body) {
        const handleHit = this.hitTestHandles(e, body)
        if (handleHit) {
          this.startHandleDrag(handleHit, body, e)
          return
        }
      }
    }

    // Force hitTest (priority over body — force arrows render on top)
    const forceHitId = hitTestForce(e.screenPos.x, e.screenPos.y, getLastRenderItems())
    if (forceHitId) {
      useSelectionStore.getState().selectForce(forceHitId)
      return
    }

    // Normal body hit test
    const hitId = hitTestBodies(e.worldPos, bodies)

    if (hitId) {
      if (e.shiftKey) {
        // Shift+点击：toggle
        useSelectionStore.getState().toggleSelection({ type: 'body', id: hitId })
      } else {
        // 检查点击的物体是否已在选中集合中
        const isAlreadySelected = selected.some(s => s.type === 'body' && s.id === hitId)
        if (!isAlreadySelected) {
          useSelectionStore.getState().select({ type: 'body', id: hitId })
        }
      }

      const body = bodies.find((b) => b.id === hitId)
      if (body) {
        const interaction = getInteraction(body)
        if (interaction.canMove) {
          // 获取当前选中集合（可能刚更新）
          const currentSelected = useSelectionStore.getState().selected
          const currentSelBodyIds = selectedBodyIds(useSelectionStore.getState())

          // 如果点击的物体在选中集合中 → 移动所有选中物体
          // 如果不在 → 已经 select() 了，移动单个
          const isInSelection = currentSelected.some(s => s.type === 'body' && s.id === hitId)

          if (isInSelection && currentSelBodyIds.length > 1) {
            // 多选拖拽
            this.dragMode = 'move'
            this.dragBodyId = hitId
            this.dragStartWorldPos = { ...e.worldPos }
            this.dragBodyIds = currentSelBodyIds
            this.dragStartPositions.clear()
            for (const id of currentSelBodyIds) {
              const b = bodies.find(bd => bd.id === id)
              if (b) this.dragStartPositions.set(id, { ...b.position })
            }
            this.dragStartBodyPos = { ...body.position }
            this.dragStartBodyAngle = body.angle
          } else {
            // 单选拖拽
            this.dragMode = 'move'
            this.dragBodyId = hitId
            this.dragStartWorldPos = { ...e.worldPos }
            this.dragStartBodyPos = { ...body.position }
            this.dragStartBodyAngle = body.angle
            this.dragBodyIds = [hitId]
            this.dragStartPositions.clear()
            this.dragStartPositions.set(hitId, { ...body.position })

            // Record start positions of linked bodies (for constraint undo)
            this.linkedBodyStartPositions.clear()
            const scene = useSceneStore.getState().scene
            for (const joint of scene.joints) {
              if (joint.type !== 'rope' && joint.type !== 'rod' && joint.type !== 'pulley') continue
              // 拖拽滑轮座时，两端物体都可能被总绳长约束联动。
              if (joint.type === 'pulley' && joint.pulleyMountId === hitId) {
                for (const endId of [joint.bodyIdA, joint.bodyIdB]) {
                  const endBody = scene.bodies.find(b => b.id === endId)
                  if (endBody && !endBody.isStatic) {
                    this.linkedBodyStartPositions.set(endId, { ...endBody.position })
                  }
                }
                continue
              }
              const otherId = joint.bodyIdA === hitId ? joint.bodyIdB
                : joint.bodyIdB === hitId ? joint.bodyIdA : null
              if (otherId) {
                const other = scene.bodies.find(b => b.id === otherId)
                if (other && !other.isStatic) {
                  this.linkedBodyStartPositions.set(otherId, { ...other.position })
                }
              }
            }

            // 地面联动：拖拽 ground 时记录接触物体
            this.groundContactBodyIds = []
            this.groundContactStartPositions.clear()
            if (body.type === 'ground') {
              const contactIds = getGroundContactBodyIds(body.position.y, bodies)
              this.groundContactBodyIds = contactIds
              for (const cid of contactIds) {
                const cb = bodies.find(bd => bd.id === cid)
                if (cb) this.groundContactStartPositions.set(cid, { ...cb.position })
              }
            }
          }
        }
      }
    } else {
      // 点击空白区域
      // Check joint hit test
      const scene = useSceneStore.getState().scene
      const viewport = this.getViewport()
      const jointHitId = hitTestJoints(e.worldPos, scene.joints, scene.bodies, viewport.scale)
      if (jointHitId) {
        if (e.shiftKey) {
          useSelectionStore.getState().toggleSelection({ type: 'joint', id: jointHitId })
        } else {
          useSelectionStore.getState().select({ type: 'joint', id: jointHitId })
        }
      } else {
        // 开始框选（或准备点击空白取消选中）
        if (!e.shiftKey) {
          this.marqueeStartScreen = { ...e.screenPos }
          this.marqueeCurrentScreen = { ...e.screenPos }
          this.isMarqueeActive = false
          this.dragMode = 'marquee'
        }
      }
    }
  }

  onMouseMove(e: CanvasMouseEvent): void {
    if (this.dragMode === 'move') {
      if (this.dragBodyIds.length > 1) {
        this.handleMultiMoveDrag(e)
      } else {
        this.handleMoveDrag(e)
      }
    } else if (this.dragMode === 'resize') {
      this.handleResizeDrag(e)
    } else if (this.dragMode === 'rotate') {
      this.handleRotateDrag(e)
    } else if (this.dragMode === 'marquee') {
      this.handleMarqueeDrag(e)
    } else {
      this.updateHoverState(e)
    }
  }

  onMouseUp(_event: CanvasMouseEvent): void {
    void _event
    if (this.dragMode === 'move' && this.dragBodyId && this.dragStartBodyPos) {
      if (this.dragBodyIds.length > 1) {
        this.finishMultiMoveDrag()
      } else {
        this.finishMoveDrag()
      }
    } else if (this.dragMode === 'resize' && this.dragBodyId) {
      this.finishResizeDrag()
    } else if (this.dragMode === 'rotate' && this.dragBodyId) {
      this.finishRotateDrag()
    } else if (this.dragMode === 'marquee') {
      this.finishMarquee()
    }

    this.resetDragState()
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      useSelectionStore.getState().clearSelection()
    }
  }

  render(ctx: CanvasRenderingContext2D, _viewport: Viewport): void {
    void _viewport
    // 框选矩形渲染
    if (this.isMarqueeActive && this.marqueeStartScreen && this.marqueeCurrentScreen) {
      const x1 = this.marqueeStartScreen.x
      const y1 = this.marqueeStartScreen.y
      const x2 = this.marqueeCurrentScreen.x
      const y2 = this.marqueeCurrentScreen.y

      const x = Math.min(x1, x2)
      const y = Math.min(y1, y2)
      const w = Math.abs(x2 - x1)
      const h = Math.abs(y2 - y1)

      ctx.save()
      // 半透明蓝色填充
      ctx.fillStyle = FEEDBACK_VISUAL.marqueeFill
      ctx.fillRect(x, y, w, h)
      // 蓝色虚线边框
      ctx.strokeStyle = FEEDBACK_VISUAL.selectedColor
      ctx.lineWidth = 1
      ctx.setLineDash([...FEEDBACK_VISUAL.guideDash])
      ctx.strokeRect(x, y, w, h)
      ctx.restore()
    }
  }

  // --- Handle hit test ---

  private hitTestHandles(e: CanvasMouseEvent, body: SceneBody): HandleType | null {
    const viewport = this.getViewport()
    const { scale } = viewport
    const handles = getHandles(body, scale)
    const bbox = getSelectionBBox(body, scale)
    if (handles.length === 0 || !bbox) return null

    // Convert mouse screen position to body-local screen coordinates
    const bodyScreen = worldToScreen(body.position.x, body.position.y, viewport)
    const relScreenX = e.screenPos.x - bodyScreen.x
    const relScreenY = e.screenPos.y - bodyScreen.y

    // Reverse the canvas rotation (canvas rotates by -body.angle)
    const angle = -body.angle
    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)
    const localScreenX = relScreenX * cos - relScreenY * sin
    const localScreenY = relScreenX * sin + relScreenY * cos

    return hitTestHandle(localScreenX, localScreenY, handles, bbox)
  }

  // --- Drag initiation ---

  private startHandleDrag(handle: HandleType, body: SceneBody, e: CanvasMouseEvent): void {
    this.dragBodyId = body.id
    this.dragStartWorldPos = { ...e.worldPos }
    this.dragStartBodyPos = { ...body.position }
    this.dragStartBodyAngle = body.angle
    this.dragStartBody = { ...body }

    // Save initial properties for undo
    this.dragStartBodyProps = {
      position: { ...body.position },
      angle: body.angle,
      flipped: body.flipped,
      width: body.width,
      height: body.height,
      radius: body.radius,
      baseLength: body.baseLength,
      slopeHeight: body.slopeHeight,
      wallWidth: body.wallWidth,
      wallHeight: body.wallHeight,
      conveyorWidth: body.conveyorWidth,
      conveyorHeight: body.conveyorHeight,
      grooveWidth: body.grooveWidth,
      grooveDepth: body.grooveDepth,
      anchorRadius: body.anchorRadius,
      pulleyRadius: body.pulleyRadius,
      hemisphereRadius: body.hemisphereRadius,
      halfSphereRadius: body.halfSphereRadius,
    }

    if (handle === 'rotate') {
      this.dragMode = 'rotate'
      this.activeHandle = 'rotate'
      this.rotateIconState = 'active'
      // Compute angle offset so rotation starts smoothly from current angle
      const mouseAngle = computeRotation(
        e.worldPos.x, e.worldPos.y,
        body.position.x, body.position.y,
      )
      this.rotateAngleOffset = body.angle - mouseAngle
    } else {
      this.dragMode = 'resize'
      this.activeHandle = handle
    }
  }

  // --- Marquee drag ---

  private handleMarqueeDrag(e: CanvasMouseEvent): void {
    if (!this.marqueeStartScreen) return
    this.marqueeCurrentScreen = { ...e.screenPos }

    const dx = e.screenPos.x - this.marqueeStartScreen.x
    const dy = e.screenPos.y - this.marqueeStartScreen.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist > MARQUEE_DRAG_THRESHOLD) {
      this.isMarqueeActive = true

      // 实时更新选中状态
      const viewport = this.getViewport()
      const startWorld = screenToWorld(
        this.marqueeStartScreen.x, this.marqueeStartScreen.y, viewport,
      )
      const endWorld = screenToWorld(
        this.marqueeCurrentScreen.x, this.marqueeCurrentScreen.y, viewport,
      )
      const rect = { x1: startWorld.x, y1: startWorld.y, x2: endWorld.x, y2: endWorld.y }
      const bodies = useSceneStore.getState().scene.bodies
      const hitIds = getBodyIdsInRect(rect, bodies)
      const objs = hitIds.map(id => ({ type: 'body' as const, id }))
      useSelectionStore.getState().setSelection(objs)
    }
  }

  private finishMarquee(): void {
    if (this.isMarqueeActive && this.marqueeStartScreen && this.marqueeCurrentScreen) {
      // 将屏幕坐标转换为世界坐标
      const viewport = this.getViewport()
      const startWorld = screenToWorld(
        this.marqueeStartScreen.x, this.marqueeStartScreen.y, viewport,
      )
      const endWorld = screenToWorld(
        this.marqueeCurrentScreen.x, this.marqueeCurrentScreen.y, viewport,
      )

      const rect = {
        x1: startWorld.x,
        y1: startWorld.y,
        x2: endWorld.x,
        y2: endWorld.y,
      }

      const bodies = useSceneStore.getState().scene.bodies
      const hitIds = getBodyIdsInRect(rect, bodies)

      if (hitIds.length > 0) {
        const objs = hitIds.map(id => ({ type: 'body' as const, id }))
        useSelectionStore.getState().setSelection(objs)
      } else {
        useSelectionStore.getState().clearSelection()
      }
    } else {
      // 只是点击空白，取消选中
      useSelectionStore.getState().clearSelection()
    }

    this.marqueeStartScreen = null
    this.marqueeCurrentScreen = null
    this.isMarqueeActive = false
  }

  private clampPositionAboveGround(
    body: SceneBody,
    candidatePos: { x: number; y: number },
    scene = useSceneStore.getState().scene,
  ): { x: number; y: number } {
    if (body.type === 'ground') return candidatePos
    const ground = scene.bodies.find((item) => item.type === 'ground')
    if (!ground) return candidatePos

    const tempBody: SceneBody = { ...body, position: candidatePos }
    const groundSnap = computeSnap(tempBody, [tempBody, ground], false, Infinity)
    if (groundSnap && groundSnap.position.y > candidatePos.y) {
      return { x: candidatePos.x, y: groundSnap.position.y }
    }
    return candidatePos
  }

  // --- Move drag (single body) ---

  private handleMoveDrag(e: CanvasMouseEvent): void {
    if (!this.dragBodyId || !this.dragStartWorldPos || !this.dragStartBodyPos) return

    const dx = e.worldPos.x - this.dragStartWorldPos.x
    const dy = e.worldPos.y - this.dragStartWorldPos.y

    const body = useSceneStore.getState().scene.bodies.find((b) => b.id === this.dragBodyId)
    const allBodies = useSceneStore.getState().scene.bodies

    // Apply movement constraints from interaction descriptor
    if (body) {
      const interaction = getInteraction(body)
      if (interaction.canMove === 'vertical-only') {
        const desiredPos = {
          x: body.position.x,
          y: this.dragStartBodyPos.y + dy,
        }
        const clampedPos = this.clampPositionAboveGround(body, desiredPos)
        useSceneStore.getState().moveBody(this.dragBodyId, clampedPos)
        const appliedDy = clampedPos.y - this.dragStartBodyPos.y
        // 地面联动：同步移动已记录的接触物体
        for (const cid of this.groundContactBodyIds) {
          const startPos = this.groundContactStartPositions.get(cid)
          if (startPos) {
            useSceneStore.getState().moveBody(cid, { x: startPos.x, y: startPos.y + appliedDy })
          }
        }
        // 动态检测：地面上移过程中碰到新物体时纳入联动
        if (body.type === 'ground') {
          const updatedBodies = useSceneStore.getState().scene.bodies
          const nowContactIds = getGroundContactBodyIds(clampedPos.y, updatedBodies)
          for (const cid of nowContactIds) {
            if (!this.groundContactStartPositions.has(cid)) {
              const cb = updatedBodies.find(b => b.id === cid)
              if (cb) {
                this.groundContactBodyIds.push(cid)
                // 记录当前位置作为起始位置，dy 基准为当前 dy
                this.groundContactStartPositions.set(cid, { x: cb.position.x, y: cb.position.y - appliedDy })
              }
            }
          }
        }
        return
      }
      if (interaction.canMove === 'horizontal-only') {
        const newX = this.dragStartBodyPos.x + dx
        useSceneStore.getState().moveBody(this.dragBodyId, { x: newX, y: body.position.y })
        return
      }
    }

    const newPos = {
      x: this.dragStartBodyPos.x + dx,
      y: this.dragStartBodyPos.y + dy,
    }

    if (body) {
      let snapResult: SnapResult | null = null
      const tempBody = { ...body, position: newPos }
      snapResult = computeSnap(tempBody, allBodies, e.altKey)

      // If normal snap missed but body is below ground, force-snap to ground
      if (!snapResult && !e.altKey) {
        const ground = allBodies.find((b) => b.type === 'ground')
        if (ground) {
          const groundSnap = computeSnap(tempBody, [tempBody, ground], false, Infinity)
          if (groundSnap && groundSnap.position.y > newPos.y) {
            // Body was dragged below where it should sit on ground
            snapResult = groundSnap
          }
        }
      }

      const candidatePos = snapResult ? snapResult.position : newPos
      const constrainedPos = this.applyRopeConstraints(this.dragBodyId, candidatePos)
      const snappedStillValid = !!snapResult &&
        Math.abs(constrainedPos.x - snapResult.position.x) < 1e-4 &&
        Math.abs(constrainedPos.y - snapResult.position.y) < 1e-4

      this.currentSnapResult = snappedStillValid ? snapResult : null
      this.currentAlignGuides = []

      if (snapResult && snappedStillValid) {
        useSceneStore.getState().updateBody(this.dragBodyId, {
          position: constrainedPos,
          angle: snapResult.angle,
        })
      } else {
        useSceneStore.getState().moveBody(this.dragBodyId, constrainedPos)
      }
      return
    }

    this.currentSnapResult = null
    this.currentAlignGuides = []

    // Apply rope/rod constraints
    const constrainedPos = this.applyRopeConstraints(this.dragBodyId, newPos)
    useSceneStore.getState().moveBody(this.dragBodyId, constrainedPos)
  }

  // --- Multi-body move drag ---

  private handleMultiMoveDrag(e: CanvasMouseEvent): void {
    if (!this.dragStartWorldPos) return

    const dx = e.worldPos.x - this.dragStartWorldPos.x
    const dy = e.worldPos.y - this.dragStartWorldPos.y

    const scene = useSceneStore.getState().scene
    const allBodies = scene.bodies
    const selectedIdSet = new Set(this.dragBodyIds)
    // 排除所有选中物体，只留非选中物体作为 snap 目标
    const nonSelectedBodies = allBodies.filter(b => !selectedIdSet.has(b.id))

    // 先将所有选中物体移到新位置（临时）
    for (const bodyId of this.dragBodyIds) {
      const startPos = this.dragStartPositions.get(bodyId)
      if (!startPos) continue
      useSceneStore.getState().moveBody(bodyId, {
        x: startPos.x + dx,
        y: startPos.y + dy,
      })
    }

    // 对每个选中物体检测 snap，取最近的一个
    let bestSnap: SnapResult | null = null
    const updatedBodies = useSceneStore.getState().scene.bodies
    for (const bodyId of this.dragBodyIds) {
      const body = updatedBodies.find(b => b.id === bodyId)
      if (!body) continue
      const snap = computeSnap(body, nonSelectedBodies, e.altKey)
      if (snap && (!bestSnap || snap.distance < bestSnap.distance)) {
        bestSnap = { ...snap, _bodyId: bodyId } as SnapResult & { _bodyId: string }
      }
    }

    this.currentSnapResult = bestSnap

    if (bestSnap) {
      // 计算 snap 产生的偏移量（snap 目标物体位置 vs 无 snap 时的位置）
      const snappedBodyId = (bestSnap as SnapResult & { _bodyId?: string })._bodyId
      if (snappedBodyId) {
        const startPos = this.dragStartPositions.get(snappedBodyId)
        if (startPos) {
          const noSnapPos = { x: startPos.x + dx, y: startPos.y + dy }
          const snapDx = bestSnap.position.x - noSnapPos.x
          const snapDy = bestSnap.position.y - noSnapPos.y

          // 将 snap 偏移应用到所有选中物体
          for (const bodyId of this.dragBodyIds) {
            const sp = this.dragStartPositions.get(bodyId)
            if (!sp) continue
            if (bodyId === snappedBodyId) {
              useSceneStore.getState().updateBody(bodyId, {
                position: bestSnap.position,
                angle: bestSnap.angle,
              })
            } else {
              useSceneStore.getState().moveBody(bodyId, {
                x: sp.x + dx + snapDx,
                y: sp.y + dy + snapDy,
              })
            }
          }
        }
      }
    }

    // 统一做一次约束回收（含 rope/rod/pulley 长度与地面防穿透）
    for (const bodyId of this.dragBodyIds) {
      const moving = useSceneStore.getState().scene.bodies.find(b => b.id === bodyId)
      if (!moving) continue
      const constrained = this.applyRopeConstraints(bodyId, moving.position)
      useSceneStore.getState().moveBody(bodyId, constrained)
    }

    if (bestSnap) {
      const snappedBodyId = (bestSnap as SnapResult & { _bodyId?: string })._bodyId
      const snappedBody = snappedBodyId
        ? useSceneStore.getState().scene.bodies.find(b => b.id === snappedBodyId)
        : null
      const snappedStillValid = !!snappedBody &&
        Math.abs(snappedBody.position.x - bestSnap.position.x) < 1e-4 &&
        Math.abs(snappedBody.position.y - bestSnap.position.y) < 1e-4
      if (!snappedStillValid) {
        this.currentSnapResult = null
      }
    }
  }

  private finishMultiMoveDrag(): void {
    const moves: { bodyId: string; fromPos: { x: number; y: number }; toPos: { x: number; y: number } }[] = []
    const scene = useSceneStore.getState().scene

    for (const bodyId of this.dragBodyIds) {
      const startPos = this.dragStartPositions.get(bodyId)
      const body = scene.bodies.find(b => b.id === bodyId)
      if (!startPos || !body) continue
      if (body.position.x !== startPos.x || body.position.y !== startPos.y) {
        moves.push({ bodyId, fromPos: startPos, toPos: { ...body.position } })
      }
    }

    if (moves.length > 0) {
      const cmd = new BatchMoveCommand(moves)
      useCommandStore.getState().pushExecuted(cmd)
    }
  }

  /** 应用绳/杆约束：static端钳制，dynamic端联动 */
  private applyRopeConstraints(
    bodyId: string,
    newPos: { x: number; y: number },
  ): { x: number; y: number } {
    const scene = useSceneStore.getState().scene
    const body = scene.bodies.find(b => b.id === bodyId)
    if (!body) return newPos

    let result = { ...newPos }
    const getBodyById = (id: string) => useSceneStore.getState().scene.bodies.find(b => b.id === id)
    const clampByBodyId = (id: string, candidate: { x: number; y: number }): { x: number; y: number } => {
      const targetBody = getBodyById(id)
      if (!targetBody) return candidate
      return this.clampPositionAboveGround(targetBody, candidate)
    }
    const moveBodyClamped = (id: string, candidate: { x: number; y: number }): void => {
      const clamped = clampByBodyId(id, candidate)
      useSceneStore.getState().moveBody(id, clamped)
    }

    // 两次迭代可覆盖“同一物体连接多条绳/杆”的串联约束。
    for (let pass = 0; pass < 2; pass++) {
      for (const joint of scene.joints) {
        // 滑轮绳：totalLength = distA + distB 守恒
        if (joint.type === 'pulley') {
          const isA = joint.bodyIdA === bodyId
          const isB = joint.bodyIdB === bodyId
          const isMount = joint.pulleyMountId === bodyId
          if (!isA && !isB && !isMount) continue

          const totalLen = joint.totalLength
          if (!totalLen || totalLen <= CONSTRAINT_EPSILON) continue

          const mount = joint.pulleyMountId ? getBodyById(joint.pulleyMountId) : null
          if (!mount) continue
          const mountPos = isMount ? result : mount.position
          const mountRadius = isMount
            ? (body.pulleyRadius ?? 0.15)
            : (mount.pulleyRadius ?? 0.15)
          const pulleyTop = { x: mountPos.x, y: mountPos.y + mountRadius }

          if (isMount) {
            const bodyA = getBodyById(joint.bodyIdA)
            const bodyB = getBodyById(joint.bodyIdB)
            if (!bodyA || !bodyB) continue

            const anchorAWorld = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
            const anchorBWorld = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)
            const dirA = normalizeVector(
              anchorAWorld.x - pulleyTop.x,
              anchorAWorld.y - pulleyTop.y,
              { x: bodyA.position.x - pulleyTop.x, y: bodyA.position.y - pulleyTop.y },
            )
            const dirB = normalizeVector(
              anchorBWorld.x - pulleyTop.x,
              anchorBWorld.y - pulleyTop.y,
              { x: bodyB.position.x - pulleyTop.x, y: bodyB.position.y - pulleyTop.y },
            )

            let targetA = dirA.dist
            let targetB = dirB.dist

            if (bodyA.isStatic && bodyB.isStatic) {
              const currentTotal = targetA + targetB
              if (Math.abs(currentTotal - totalLen) > 0.001) {
                const currentMount = getBodyById(bodyId)
                if (currentMount) result = { ...currentMount.position }
              }
              continue
            }

            if (bodyA.isStatic) {
              targetA = dirA.dist
              targetB = totalLen - targetA
            } else if (bodyB.isStatic) {
              targetB = dirB.dist
              targetA = totalLen - targetB
            } else {
              const currentTotal = targetA + targetB
              const ratioA = currentTotal > CONSTRAINT_EPSILON ? targetA / currentTotal : 0.5
              targetA = totalLen * ratioA
              targetB = totalLen - targetA
            }

            if (targetA < MIN_PULLEY_SEGMENT || targetB < MIN_PULLEY_SEGMENT) {
              const currentMount = getBodyById(bodyId)
              if (currentMount) result = { ...currentMount.position }
              continue
            }

            if (!bodyA.isStatic) {
              const newAnchorA = {
                x: pulleyTop.x + dirA.x * targetA,
                y: pulleyTop.y + dirA.y * targetA,
              }
              const newPosA = anchorWorldToBodyPos(newAnchorA, joint.anchorA, bodyA.angle)
              moveBodyClamped(bodyA.id, newPosA)
            }
            if (!bodyB.isStatic) {
              const newAnchorB = {
                x: pulleyTop.x + dirB.x * targetB,
                y: pulleyTop.y + dirB.y * targetB,
              }
              const newPosB = anchorWorldToBodyPos(newAnchorB, joint.anchorB, bodyB.angle)
              moveBodyClamped(bodyB.id, newPosB)
            }
            continue
          }

          const myAnchor = isA ? joint.anchorA : joint.anchorB
          const otherAnchor = isA ? joint.anchorB : joint.anchorA
          const otherBody = getBodyById(isA ? joint.bodyIdB : joint.bodyIdA)
          if (!otherBody) continue

          const movingBody = getBodyById(bodyId) ?? body
          const myAnchorWorld = localToWorld(myAnchor, result, movingBody.angle)
          const otherAnchorWorld = localToWorld(otherAnchor, otherBody.position, otherBody.angle)

          const myDir = normalizeVector(
            myAnchorWorld.x - pulleyTop.x,
            myAnchorWorld.y - pulleyTop.y,
            { x: result.x - pulleyTop.x, y: result.y - pulleyTop.y },
          )
          const distMy = myDir.dist
          const distOther0 = totalLen - distMy

          if (distOther0 < MIN_PULLEY_SEGMENT) {
            // 拖过头了，钳制自己：自己这段最长 = totalLength - 最小另一段
            const maxMy = totalLen - MIN_PULLEY_SEGMENT
            if (maxMy <= CONSTRAINT_EPSILON) continue
            const clampedAnchor = {
              x: pulleyTop.x + myDir.x * maxMy,
              y: pulleyTop.y + myDir.y * maxMy,
            }
            result = clampByBodyId(bodyId, anchorWorldToBodyPos(clampedAnchor, myAnchor, movingBody.angle))
            continue
          }

          // 另一端需要调整到 distOther0 的距离
          const dxOther = otherAnchorWorld.x - pulleyTop.x
          const dyOther = otherAnchorWorld.y - pulleyTop.y
          const distOtherCur = Math.sqrt(dxOther * dxOther + dyOther * dyOther)

          if (Math.abs(distOtherCur - distOther0) > 0.001 && !otherBody.isStatic) {
            const ratio = distOther0 / Math.max(distOtherCur, 0.001)
            const newOtherAnchor = {
              x: pulleyTop.x + dxOther * ratio,
              y: pulleyTop.y + dyOther * ratio,
            }
            const newOtherPos = anchorWorldToBodyPos(newOtherAnchor, otherAnchor, otherBody.angle)
            moveBodyClamped(otherBody.id, newOtherPos)
          } else if (otherBody.isStatic) {
            // 另一端 static，钳制自己这段
            const maxMy = totalLen - distOtherCur
            if (maxMy <= CONSTRAINT_EPSILON) continue
            if (distMy > maxMy + 0.001) {
              const clampedAnchor = {
                x: pulleyTop.x + myDir.x * maxMy,
                y: pulleyTop.y + myDir.y * maxMy,
              }
              result = clampByBodyId(bodyId, anchorWorldToBodyPos(clampedAnchor, myAnchor, movingBody.angle))
            }
          }
          continue
        }

        // 绳：最大距离约束；杆：固定距离约束
        let constraintLength: number | undefined
        let isRigid = false
        if (joint.type === 'rope') {
          constraintLength = joint.maxLength
        } else if (joint.type === 'rod') {
          constraintLength = joint.length
          isRigid = true
        } else {
          continue
        }
        if (!constraintLength) continue
        constraintLength = Math.max(isRigid ? MIN_PULLEY_SEGMENT : CONSTRAINT_EPSILON, constraintLength)

        const isA = joint.bodyIdA === bodyId
        const isB = joint.bodyIdB === bodyId
        if (!isA && !isB) continue

        const myAnchor = isA ? joint.anchorA : joint.anchorB
        const otherAnchor = isA ? joint.anchorB : joint.anchorA
        const otherBody = getBodyById(isA ? joint.bodyIdB : joint.bodyIdA)
        if (!otherBody) continue

        const movingBody = getBodyById(bodyId) ?? body
        const myAnchorWorld = localToWorld(myAnchor, result, movingBody.angle)
        const otherAnchorWorld = localToWorld(otherAnchor, otherBody.position, otherBody.angle)

        const cdx = myAnchorWorld.x - otherAnchorWorld.x
        const cdy = myAnchorWorld.y - otherAnchorWorld.y
        const direction = normalizeVector(cdx, cdy, {
          x: result.x - otherBody.position.x,
          y: result.y - otherBody.position.y,
        })
        const dist = direction.dist

        // 绳：仅超出时约束；杆：距离偏离即约束（刚性）
        const needsConstraint = isRigid
          ? Math.abs(dist - constraintLength) > 0.001
          : dist > constraintLength

        if (!needsConstraint) continue

        if (otherBody.isStatic) {
          const clampedAnchor = {
            x: otherAnchorWorld.x + direction.x * constraintLength,
            y: otherAnchorWorld.y + direction.y * constraintLength,
          }
          result = clampByBodyId(bodyId, anchorWorldToBodyPos(clampedAnchor, myAnchor, movingBody.angle))
        } else {
          const newOtherAnchor = {
            x: myAnchorWorld.x - direction.x * constraintLength,
            y: myAnchorWorld.y - direction.y * constraintLength,
          }
          const newOtherPos = anchorWorldToBodyPos(newOtherAnchor, otherAnchor, otherBody.angle)
          moveBodyClamped(otherBody.id, newOtherPos)
        }
      }
      result = clampByBodyId(bodyId, result)
    }

    return clampByBodyId(bodyId, result)
  }

  private finishMoveDrag(): void {
    if (!this.dragBodyId || !this.dragStartBodyPos) return

    const scene = useSceneStore.getState().scene
    const body = scene.bodies.find((b) => b.id === this.dragBodyId)
    if (body) {
      const posChanged = body.position.x !== this.dragStartBodyPos.x ||
        body.position.y !== this.dragStartBodyPos.y
      const angleChanged = body.angle !== this.dragStartBodyAngle

      if (posChanged || angleChanged) {
        // 地面联动：ground + 接触物体一起打包成 BatchMoveCommand
        if (this.groundContactBodyIds.length > 0 && !angleChanged) {
          const moves: { bodyId: string; fromPos: { x: number; y: number }; toPos: { x: number; y: number } }[] = []
          moves.push({ bodyId: this.dragBodyId, fromPos: this.dragStartBodyPos, toPos: { ...body.position } })
          for (const cid of this.groundContactBodyIds) {
            const startPos = this.groundContactStartPositions.get(cid)
            const cb = scene.bodies.find(b => b.id === cid)
            if (startPos && cb && (cb.position.x !== startPos.x || cb.position.y !== startPos.y)) {
              moves.push({ bodyId: cid, fromPos: startPos, toPos: { ...cb.position } })
            }
          }
          const cmd = new BatchMoveCommand(moves)
          useCommandStore.getState().pushExecuted(cmd)
        } else if (angleChanged) {
          const cmd = new BatchPropertyCommand(
            this.dragBodyId,
            { position: { ...this.dragStartBodyPos }, angle: this.dragStartBodyAngle },
            { position: { ...body.position }, angle: body.angle },
            '移动物体',
          )
          useCommandStore.getState().pushExecuted(cmd)
        } else {
          const cmd = new MoveBodyCommand(
            this.dragBodyId,
            this.dragStartBodyPos,
            { ...body.position },
          )
          useCommandStore.getState().pushExecuted(cmd)
        }
      }

      // Undo commands for linked bodies moved by rope constraint
      for (const [linkedId, startPos] of this.linkedBodyStartPositions) {
        const linkedBody = scene.bodies.find(b => b.id === linkedId)
        if (!linkedBody) continue
        if (linkedBody.position.x === startPos.x && linkedBody.position.y === startPos.y) continue
        const cmd = new MoveBodyCommand(linkedId, startPos, { ...linkedBody.position })
        useCommandStore.getState().pushExecuted(cmd)
      }
    }
    this.currentSnapResult = null
    this.currentAlignGuides = []
  }

  // --- Resize drag ---

  private handleResizeDrag(e: CanvasMouseEvent): void {
    if (!this.dragBodyId || !this.dragStartWorldPos || !this.activeHandle || !this.dragStartBody) return

    // Total world delta from drag start
    const worldDx = e.worldPos.x - this.dragStartWorldPos.x
    const worldDy = e.worldPos.y - this.dragStartWorldPos.y

    // Rotate world delta into body-local frame
    const angle = this.dragStartBody.angle
    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)
    const localDx = worldDx * cos - worldDy * sin
    const localDy = worldDx * sin + worldDy * cos

    // computeResize uses the ORIGINAL body dimensions + total delta
    const result = computeResize(this.activeHandle, localDx, -localDy, this.dragStartBody)
    if (!result) return

    useSceneStore.getState().updateBody(this.dragBodyId, {
      ...result.props,
      position: result.newPosition,
    })
  }

  private finishResizeDrag(): void {
    if (!this.dragBodyId) return

    const body = useSceneStore.getState().scene.bodies.find(
      (b) => b.id === this.dragBodyId,
    )
    if (!body) return

    const newProps: Partial<SceneBody> = {
      position: { ...body.position },
      angle: body.angle,
      flipped: body.flipped,
      width: body.width,
      height: body.height,
      radius: body.radius,
      baseLength: body.baseLength,
      slopeHeight: body.slopeHeight,
      wallWidth: body.wallWidth,
      wallHeight: body.wallHeight,
      conveyorWidth: body.conveyorWidth,
      conveyorHeight: body.conveyorHeight,
      grooveWidth: body.grooveWidth,
      grooveDepth: body.grooveDepth,
      anchorRadius: body.anchorRadius,
      pulleyRadius: body.pulleyRadius,
      hemisphereRadius: body.hemisphereRadius,
      halfSphereRadius: body.halfSphereRadius,
    }

    const cmd = new BatchPropertyCommand(
      this.dragBodyId,
      this.dragStartBodyProps,
      newProps,
      '缩放物体',
    )
    useCommandStore.getState().pushExecuted(cmd)
  }

  // --- Rotate drag ---

  private handleRotateDrag(e: CanvasMouseEvent): void {
    if (!this.dragBodyId) return

    const body = useSceneStore.getState().scene.bodies.find(
      (b) => b.id === this.dragBodyId,
    )
    if (!body) return

    const mouseAngle = computeRotation(
      e.worldPos.x,
      e.worldPos.y,
      body.position.x,
      body.position.y,
    )
    const newAngle = mouseAngle + this.rotateAngleOffset
    useSceneStore.getState().updateBody(this.dragBodyId, { angle: newAngle })
  }

  private finishRotateDrag(): void {
    if (!this.dragBodyId) return

    const body = useSceneStore.getState().scene.bodies.find(
      (b) => b.id === this.dragBodyId,
    )
    if (!body) return

    if (body.angle !== this.dragStartBodyAngle) {
      const cmd = new BatchPropertyCommand(
        this.dragBodyId,
        { angle: this.dragStartBodyAngle },
        { angle: body.angle },
        '旋转物体',
      )
      useCommandStore.getState().pushExecuted(cmd)
    }
  }

  // --- Hover ---

  private updateHoverState(e: CanvasMouseEvent): void {
    const bodies = useSceneStore.getState().scene.bodies
    const selected = useSelectionStore.getState().selected

    // Check handle/edge hover for cursor (single-select only)
    if (selected.length === 1 && selected[0].type === 'body') {
      const body = bodies.find((b) => b.id === selected[0].id)
      if (body) {
        const handleHit = this.hitTestHandles(e, body)
        if (handleHit) {
          if (handleHit === 'rotate') {
            // Rotate hover: icon turns black, cursor stays default
            this.rotateIconState = 'hover'
            this.cursor = 'default'
          } else {
            this.rotateIconState = 'default'
            this.cursor = CURSOR_MAP[handleHit] ?? 'default'
          }
          return
        }
      }
    }

    // Reset rotate icon state when not hovering rotate handle
    this.rotateIconState = 'default'

    // Force hover check (independent from body/joint hover)
    const forceHoverId = hitTestForce(e.screenPos.x, e.screenPos.y, getLastRenderItems())
    useSelectionStore.getState().setHoveredForce(forceHoverId)
    if (forceHoverId) {
      this.cursor = 'pointer'
      return
    }

    const hitId = hitTestBodies(e.worldPos, bodies)
    if (hitId) {
      useSelectionStore.getState().setHovered({ type: 'body', id: hitId })
      const hitBody = bodies.find((b) => b.id === hitId)
      this.cursor = hitBody ? getInteraction(hitBody).hoverCursor : 'move'
    } else {
      // Check joint hover
      const scene = useSceneStore.getState().scene
      const viewport = this.getViewport()
      const jointHitId = hitTestJoints(e.worldPos, scene.joints, scene.bodies, viewport.scale)
      if (jointHitId) {
        useSelectionStore.getState().setHovered({ type: 'joint', id: jointHitId })
        this.cursor = 'pointer'
      } else {
        useSelectionStore.getState().setHovered(null)
        this.cursor = 'default'
      }
    }
  }

  // --- Helpers ---

  private resetDragState(): void {
    this.dragMode = 'none'
    this.dragBodyId = null
    this.dragStartWorldPos = null
    this.dragStartBodyPos = null
    this.dragStartBodyAngle = 0
    this.rotateAngleOffset = 0
    this.dragStartBody = null
    this.dragStartBodyProps = {}
    this.activeHandle = null
    this.linkedBodyStartPositions.clear()
    this.groundContactBodyIds = []
    this.groundContactStartPositions.clear()
    this.dragBodyIds = []
    this.dragStartPositions.clear()
    this.rotateIconState = 'default'
    this.cursor = 'default'
    // 不在这里清除 marquee 状态，由 finishMarquee 处理
  }

  private getViewport() {
    const state = useViewportStore.getState()
    return {
      offset: state.offset,
      scale: state.scale,
      canvasSize: state.canvasSize,
    }
  }
}
