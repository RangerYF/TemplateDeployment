import type { Tool, CanvasMouseEvent } from './Tool'
import { worldToScreen } from '@/renderer/CoordinateSystem'
import type { Viewport } from '@/renderer/CoordinateSystem'
import type { JointType } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useCommandStore } from '@/store/commandStore'
import { useToolStore } from '@/store/toolStore'
import { AddJointCommand } from '@/core/commands/AddJointCommand'
import { hitTestBodies } from '@/core/hitTest'
import { getJointDescriptor } from '@/models/jointTypes'
import { COLORS } from '@/styles/tokens'

type JointToolState = 'IDLE' | 'PICKING_B' | 'PICKING_PULLEY'

export class JointTool implements Tool {
  name = 'joint'
  cursor = 'crosshair'

  private state: JointToolState = 'IDLE'
  private jointType: JointType = 'rope'
  private bodyIdA: string | null = null
  private pulleyMountId: string | null = null
  private mouseWorldPos: { x: number; y: number } = { x: 0, y: 0 }
  private guidedFromDrag = false
  private hintError: { text: string; until: number } | null = null

  constructor(jointType?: JointType) {
    if (jointType) this.jointType = jointType
  }

  setJointType(type: JointType): void {
    this.jointType = type
    this.reset()
  }

  startGuidedCreation(startWorldPos: { x: number; y: number }): void {
    this.reset(false)
    this.guidedFromDrag = true
    this.mouseWorldPos = startWorldPos
    useSelectionStore.getState().clearSelection()
    useSelectionStore.getState().setHovered(null)
  }

  getJointType(): JointType {
    return this.jointType
  }

  getState(): JointToolState {
    return this.state
  }

  onMouseDown(e: CanvasMouseEvent): void {
    this.mouseWorldPos = e.worldPos
    const scene = useSceneStore.getState().scene
    const hitId = hitTestBodies(e.worldPos, scene.bodies)

    if (this.state === 'IDLE') {
      if (!hitId) {
        this.setHintError('请选择第一个物体')
        return
      }
      this.bodyIdA = hitId
      if (this.jointType === 'pulley') {
        this.state = 'PICKING_PULLEY'
      } else {
        this.state = 'PICKING_B'
      }
      this.clearHintError()
      useSelectionStore.getState().select({ type: 'body', id: hitId })
    } else if (this.state === 'PICKING_PULLEY') {
      if (!hitId) {
        this.setHintError('请选择滑轮座')
        return
      }
      // Only allow pulley-mount type
      const body = scene.bodies.find(b => b.id === hitId)
      if (!body || body.type !== 'pulley-mount') {
        this.setHintError('第二步必须选择滑轮座')
        return
      }
      this.pulleyMountId = hitId
      this.state = 'PICKING_B'
      this.clearHintError()
      useSelectionStore.getState().select({ type: 'body', id: hitId })
    } else if (this.state === 'PICKING_B') {
      if (!hitId) {
        this.setHintError('请选择第二个物体')
        return
      }
      if (hitId === this.bodyIdA) {
        this.setHintError('第二个物体不能与第一个相同')
        return
      }
      // For pulley, don't allow picking pulley-mount as B
      if (this.jointType === 'pulley') {
        const body = scene.bodies.find(b => b.id === hitId)
        if (body?.type === 'pulley-mount') {
          this.setHintError('第三步请选择第二个物体，而不是滑轮座')
          return
        }
      }
      this.clearHintError()
      this.createJoint(hitId)
    }
  }

  onMouseMove(e: CanvasMouseEvent): void {
    this.mouseWorldPos = e.worldPos

    // Hover feedback
    const scene = useSceneStore.getState().scene
    const hitId = hitTestBodies(e.worldPos, scene.bodies)
    if (hitId) {
      useSelectionStore.getState().setHovered({ type: 'body', id: hitId })
    } else {
      useSelectionStore.getState().setHovered(null)
    }
  }

  onMouseUp(): void {
    // Not used — JointTool uses click, not drag
  }

  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.reset()
      useSelectionStore.getState().deselect()
    }
  }

  render(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    const guideText = this.getGuideText()
    const errorText = this.getActiveHintError()
    if (guideText || errorText) {
      this.drawGuideBubble(ctx, viewport, guideText, errorText)
    }

    if (this.state === 'IDLE' || !this.bodyIdA) return

    const scene = useSceneStore.getState().scene
    const bodyA = scene.bodies.find(b => b.id === this.bodyIdA)
    if (!bodyA) return

    const startPos = bodyA.position

    ctx.save()
    ctx.setLineDash([6, 4])
    ctx.strokeStyle = '#3b82f6'
    ctx.lineWidth = 1.5

    if (this.state === 'PICKING_PULLEY') {
      // Draw dashed line from bodyA to mouse
      this.drawWorldLine(ctx, viewport, startPos, this.mouseWorldPos)
    } else if (this.state === 'PICKING_B') {
      if (this.jointType === 'pulley' && this.pulleyMountId) {
        // Draw A → pulley top → mouse (折线)
        const mount = scene.bodies.find(b => b.id === this.pulleyMountId)
        if (mount) {
          const pulleyTop = {
            x: mount.position.x,
            y: mount.position.y + (mount.pulleyRadius ?? 0.15),
          }
          this.drawWorldLine(ctx, viewport, startPos, pulleyTop)
          this.drawWorldLine(ctx, viewport, pulleyTop, this.mouseWorldPos)
        }
      } else {
        // Draw dashed line from bodyA to mouse
        this.drawWorldLine(ctx, viewport, startPos, this.mouseWorldPos)
      }
    }

    ctx.restore()
  }

  private drawWorldLine(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    const screenFrom = worldToScreen(from.x, from.y, viewport)
    const screenTo = worldToScreen(to.x, to.y, viewport)
    ctx.beginPath()
    ctx.moveTo(screenFrom.x, screenFrom.y)
    ctx.lineTo(screenTo.x, screenTo.y)
    ctx.stroke()
  }

  private createJoint(bodyIdB: string): void {
    if (!this.bodyIdA) return

    const scene = useSceneStore.getState().scene
    const bodyA = scene.bodies.find(b => b.id === this.bodyIdA)
    const bodyB = scene.bodies.find(b => b.id === bodyIdB)
    if (!bodyA || !bodyB) return

    const desc = getJointDescriptor(this.jointType)
    if (!desc) return

    // Calculate distance between body centers
    const dx = bodyB.position.x - bodyA.position.x
    const dy = bodyB.position.y - bodyA.position.y
    const dist = Math.sqrt(dx * dx + dy * dy)

    const jointId = `joint-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const joint = {
      id: jointId,
      type: this.jointType,
      label: `${desc.label}`,
      bodyIdA: this.bodyIdA,
      bodyIdB: bodyIdB,
      anchorA: { x: 0, y: 0 },
      anchorB: { x: 0, y: 0 },
      ...desc.defaults,
      // Set length/maxLength based on distance
      ...(this.jointType === 'rope' ? { maxLength: dist } : {}),
      ...(this.jointType === 'rod' ? { length: dist } : {}),
      ...(this.jointType === 'spring' ? { springLength: dist } : {}),
      ...(this.jointType === 'pulley' ? (() => {
        const mount = this.pulleyMountId ? scene.bodies.find(b => b.id === this.pulleyMountId) : null
        const topY = mount ? mount.position.y + (mount.pulleyRadius ?? 0.15) : 0
        const topX = mount ? mount.position.x : 0
        const dxA = bodyA.position.x - topX, dyA = bodyA.position.y - topY
        const dxB = bodyB.position.x - topX, dyB = bodyB.position.y - topY
        // 创建时确定出绳侧并持久化，后续不再动态计算
        const sideA: 'left' | 'right' = bodyA.position.x < bodyB.position.x ? 'left'
          : bodyA.position.x > bodyB.position.x ? 'right'
          : bodyA.position.x <= topX ? 'left' : 'right'
        return {
          pulleyMountId: this.pulleyMountId ?? undefined,
          ratio: 1,
          totalLength: Math.sqrt(dxA * dxA + dyA * dyA) + Math.sqrt(dxB * dxB + dyB * dyB),
          sideA,
        }
      })() : {}),
    } as const

    const cmd = new AddJointCommand(joint)
    useCommandStore.getState().execute(cmd)

    // Select the new joint and switch to SelectTool
    useSelectionStore.getState().select({ type: 'joint', id: jointId })
    useToolStore.getState().setTool('select')
    this.reset()
  }

  private setHintError(text: string): void {
    this.hintError = { text, until: Date.now() + 1400 }
  }

  private clearHintError(): void {
    this.hintError = null
  }

  private getActiveHintError(): string | null {
    if (!this.hintError) return null
    if (Date.now() > this.hintError.until) {
      this.hintError = null
      return null
    }
    return this.hintError.text
  }

  private getGuideText(): string | null {
    const shouldShow = this.guidedFromDrag || this.state !== 'IDLE'
    if (!shouldShow) return null

    if (this.jointType === 'pulley') {
      if (this.state === 'IDLE') return '① 请选择第一个物体'
      if (this.state === 'PICKING_PULLEY') return '② 请选择滑轮座'
      return '③ 请选择第二个物体'
    }

    if (this.state === 'IDLE') return '① 请选择第一个物体'
    return '② 请选择第二个物体'
  }

  private drawGuideBubble(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    guideText: string | null,
    errorText: string | null,
  ): void {
    const anchor = worldToScreen(this.mouseWorldPos.x, this.mouseWorldPos.y, viewport)
    const lines: string[] = []
    if (guideText) {
      lines.push(guideText)
      lines.push('Esc 退出')
    }
    if (errorText) {
      lines.push(errorText)
    }
    if (lines.length === 0) return

    const paddingX = 10
    const paddingY = 8
    const lineHeight = 16
    const offsetX = 12
    const offsetY = 16

    ctx.save()
    ctx.font = '12px sans-serif'
    const contentWidth = lines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)
    const boxWidth = Math.ceil(contentWidth + paddingX * 2)
    const boxHeight = Math.ceil(lines.length * lineHeight + paddingY * 2)

    let boxX = anchor.x + offsetX
    let boxY = anchor.y + offsetY
    const maxX = Math.max(0, viewport.canvasSize.width - boxWidth - 6)
    const maxY = Math.max(0, viewport.canvasSize.height - boxHeight - 6)
    boxX = Math.max(6, Math.min(boxX, maxX))
    boxY = Math.max(6, Math.min(boxY, maxY))

    ctx.fillStyle = 'rgba(255, 255, 255, 0.96)'
    ctx.strokeStyle = COLORS.border
    ctx.lineWidth = 1
    ctx.shadowColor = 'rgba(0,0,0,0.12)'
    ctx.shadowBlur = 12
    ctx.shadowOffsetY = 2
    ctx.beginPath()
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6)
    ctx.fill()
    ctx.stroke()
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 0

    lines.forEach((line, i) => {
      const y = boxY + paddingY + lineHeight * (i + 0.75)
      const isErrorLine = i === lines.length - 1 && !!errorText
      const isEscLine = !!guideText && i === 1
      if (isErrorLine) {
        ctx.fillStyle = COLORS.error
      } else if (isEscLine) {
        ctx.fillStyle = COLORS.textMuted
      } else {
        ctx.fillStyle = COLORS.text
      }
      ctx.fillText(line, boxX + paddingX, y)
    })

    ctx.restore()
  }

  private reset(clearGuide = true): void {
    this.state = 'IDLE'
    this.bodyIdA = null
    this.pulleyMountId = null
    this.clearHintError()
    if (clearGuide) {
      this.guidedFromDrag = false
    }
  }
}
