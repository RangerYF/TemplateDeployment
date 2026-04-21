import type { Tool, CanvasMouseEvent } from './Tool'
import { worldToScreen } from '@/renderer/CoordinateSystem'
import type { Viewport } from '@/renderer/CoordinateSystem'
import type { SceneForce, SceneJoint } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useCommandStore } from '@/store/commandStore'
import { AddForceCommand } from '@/core/commands/AddForceCommand'
import { hitTestBodies } from '@/core/hitTest'
import { getForceDescriptor } from '@/models/forceTypes'
import { getBodyDescriptor } from '@/models/bodyTypes'

type ForceToolState = 'IDLE' | 'DRAGGING'

const MIN_DRAG_DISTANCE = 10 // px，低于此距离取消创建
const SNAP_THRESHOLD = 12 * Math.PI / 180 // ±12° 吸附阈值
const SHIFT_GRID = 15 * Math.PI / 180 // Shift 15° 网格

export class ForceTool implements Tool {
  name = 'force'
  cursor = 'crosshair'

  private state: ForceToolState = 'IDLE'
  private targetBodyId: string | null = null
  private startScreenPos: { x: number; y: number } = { x: 0, y: 0 }
  private currentScreenPos: { x: number; y: number } = { x: 0, y: 0 }
  private currentAngle: number = 0
  private currentMagnitude: number = 0
  private isSnapped: boolean = false
  private shiftKey: boolean = false
  private altKey: boolean = false

  onMouseDown(e: CanvasMouseEvent): void {
    if (this.state !== 'IDLE') return

    const scene = useSceneStore.getState().scene
    const hitId = hitTestBodies(e.worldPos, scene.bodies)
    if (!hitId) return

    // 不允许对 static 物体（如 ground）施力（除非有特殊需求，暂时允许所有物体）
    this.targetBodyId = hitId
    this.startScreenPos = { ...e.screenPos }
    this.currentScreenPos = { ...e.screenPos }
    this.shiftKey = e.shiftKey
    this.altKey = e.altKey
    this.state = 'DRAGGING'

    useSelectionStore.getState().select({ type: 'body', id: hitId })
  }

  onMouseMove(e: CanvasMouseEvent): void {
    this.shiftKey = e.shiftKey
    this.altKey = e.altKey

    if (this.state === 'DRAGGING') {
      this.currentScreenPos = { ...e.screenPos }
      this.updateDragState(e)
      return
    }

    // IDLE 状态：hover 反馈
    const scene = useSceneStore.getState().scene
    const hitId = hitTestBodies(e.worldPos, scene.bodies)
    if (hitId) {
      useSelectionStore.getState().setHovered({ type: 'body', id: hitId })
    } else {
      useSelectionStore.getState().setHovered(null)
    }
  }

  onMouseUp(e: CanvasMouseEvent): void {
    if (this.state !== 'DRAGGING' || !this.targetBodyId) {
      this.reset()
      return
    }

    const dx = e.screenPos.x - this.startScreenPos.x
    const dy = e.screenPos.y - this.startScreenPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < MIN_DRAG_DISTANCE) {
      // 距离太短，取消创建
      this.reset()
      return
    }

    this.createForce()
    this.reset()
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.reset()
      useSelectionStore.getState().deselect()
    }
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    if (this.state !== 'DRAGGING' || !this.targetBodyId) return

    const scene = useSceneStore.getState().scene
    const body = scene.bodies.find(b => b.id === this.targetBodyId)
    if (!body) return

    const bodyScreen = worldToScreen(body.position.x, body.position.y, viewport)
    const dx = this.currentScreenPos.x - this.startScreenPos.x
    const dy = this.currentScreenPos.y - this.startScreenPos.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 5) return

    // 画预览箭头（虚线）
    const endX = bodyScreen.x + Math.cos(this.currentAngle) * Math.min(dist, 180)
    const endY = bodyScreen.y - Math.sin(this.currentAngle) * Math.min(dist, 180)

    ctx.save()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = this.isSnapped ? '#ef4444' : '#9ca3af'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(bodyScreen.x, bodyScreen.y)
    ctx.lineTo(endX, endY)
    ctx.stroke()

    // 箭头尖端
    const arrowLen = 10
    const angle = Math.atan2(-(endY - bodyScreen.y), endX - bodyScreen.x)
    ctx.setLineDash([])
    ctx.fillStyle = this.isSnapped ? '#ef4444' : '#9ca3af'
    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(
      endX - arrowLen * Math.cos(angle - Math.PI / 6),
      endY + arrowLen * Math.sin(angle - Math.PI / 6),
    )
    ctx.lineTo(
      endX - arrowLen * Math.cos(angle + Math.PI / 6),
      endY + arrowLen * Math.sin(angle + Math.PI / 6),
    )
    ctx.closePath()
    ctx.fill()

    // 力大小标签
    const labelX = endX + 12 * Math.cos(angle)
    const labelY = endY - 12 * Math.sin(angle)
    ctx.fillStyle = '#374151'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(`${this.currentMagnitude.toFixed(1)}N`, labelX, labelY)

    // 吸附时显示辅助虚线
    if (this.isSnapped) {
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.3)'
      ctx.lineWidth = 1
      const extLen = 300
      ctx.beginPath()
      ctx.moveTo(bodyScreen.x - Math.cos(this.currentAngle) * extLen, bodyScreen.y + Math.sin(this.currentAngle) * extLen)
      ctx.lineTo(bodyScreen.x + Math.cos(this.currentAngle) * extLen, bodyScreen.y - Math.sin(this.currentAngle) * extLen)
      ctx.stroke()
    }

    ctx.restore()
  }

  private updateDragState(e: CanvasMouseEvent): void {
    const dx = e.screenPos.x - this.startScreenPos.x
    // 屏幕 Y 翻转：向上拖为正角度
    const dy = -(e.screenPos.y - this.startScreenPos.y)
    const dist = Math.sqrt(dx * dx + dy * dy)

    if (dist < 3) return

    let rawAngle = Math.atan2(dy, dx)

    if (this.shiftKey) {
      // Shift：锁定到 15° 网格
      rawAngle = Math.round(rawAngle / SHIFT_GRID) * SHIFT_GRID
      this.isSnapped = true
    } else if (!this.altKey) {
      // 智能吸附
      const result = this.computeSnapDirection(rawAngle)
      rawAngle = result.angle
      this.isSnapped = result.snapped
    } else {
      this.isSnapped = false
    }

    this.currentAngle = rawAngle
    // 力大小 = 屏幕像素距离 / 10（简化映射，正式缩放在 6.3）
    this.currentMagnitude = dist / 10
  }

  private computeSnapDirection(rawAngle: number): { angle: number; snapped: boolean } {
    const candidates = this.collectSnapCandidates()

    let bestAngle = rawAngle
    let bestDelta = Infinity

    for (const candidate of candidates) {
      let delta = candidate - rawAngle
      // 归一化到 [-π, π]
      while (delta > Math.PI) delta -= 2 * Math.PI
      while (delta < -Math.PI) delta += 2 * Math.PI

      const absDelta = Math.abs(delta)
      if (absDelta < SNAP_THRESHOLD && absDelta < bestDelta) {
        bestDelta = absDelta
        bestAngle = candidate
      }
    }

    return { angle: bestAngle, snapped: bestDelta < Infinity && bestDelta < SNAP_THRESHOLD }
  }

  private collectSnapCandidates(): number[] {
    const candidates: number[] = [
      0,              // →
      Math.PI / 2,    // ↑
      Math.PI,        // ←
      -Math.PI / 2,   // ↓
    ]

    if (!this.targetBodyId) return candidates

    const scene = useSceneStore.getState().scene
    const body = scene.bodies.find(b => b.id === this.targetBodyId)
    if (!body) return candidates

    // 接触面方向：从 body 的 SnapSurface 获取
    const desc = getBodyDescriptor(body.type)
    if (desc.getSnapSurfaces) {
      const surfaces = desc.getSnapSurfaces(body)
      for (const surface of surfaces) {
        if (surface.type === 'contact') {
          const sdx = surface.end.x - surface.start.x
          const sdy = surface.end.y - surface.start.y
          const surfAngle = Math.atan2(sdy, sdx)
          candidates.push(surfAngle, surfAngle + Math.PI) // 沿面
          candidates.push(surfAngle + Math.PI / 2, surfAngle - Math.PI / 2) // 垂直面
        }
      }
    }

    // 约束方向：从关联的 joints 获取
    const relatedJoints = scene.joints.filter(
      (j: SceneJoint) => j.bodyIdA === this.targetBodyId || j.bodyIdB === this.targetBodyId,
    )
    for (const joint of relatedJoints) {
      const otherId = joint.bodyIdA === this.targetBodyId ? joint.bodyIdB : joint.bodyIdA
      const other = scene.bodies.find(b => b.id === otherId)
      if (!other) continue
      const jdx = other.position.x - body.position.x
      const jdy = other.position.y - body.position.y
      const jAngle = Math.atan2(jdy, jdx)
      candidates.push(jAngle, jAngle + Math.PI) // 沿连线
      candidates.push(jAngle + Math.PI / 2, jAngle - Math.PI / 2) // 垂直连线
    }

    return candidates
  }

  private createForce(): void {
    if (!this.targetBodyId) return

    const desc = getForceDescriptor('external')
    if (!desc) return

    const forceId = `force-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    // 计算已有的外力数量来生成标签
    const scene = useSceneStore.getState().scene
    const existingForces = scene.forces.filter(f => f.targetBodyId === this.targetBodyId)
    const existingIndices = existingForces
      .map(f => { const m = f.label.match(/^F(\d+)$/); return m ? parseInt(m[1]) : 0 })
    const nextIdx = existingIndices.length === 0 ? 1 : Math.max(...existingIndices) + 1
    const label = `F${nextIdx}`

    const force: SceneForce = {
      id: forceId,
      type: 'external',
      targetBodyId: this.targetBodyId,
      label,
      visible: true,
      decompose: false,
      decomposeAngle: 0,
      ...desc.defaults,
      magnitude: Math.max(0.1, this.currentMagnitude),
      direction: this.currentAngle,
    }

    const cmd = new AddForceCommand(force)
    useCommandStore.getState().execute(cmd)

    // 高亮新创建的力（不影响物体选中状态）
    useSelectionStore.getState().selectForce(forceId)
  }

  private reset(): void {
    this.state = 'IDLE'
    this.targetBodyId = null
    this.isSnapped = false
  }
}
