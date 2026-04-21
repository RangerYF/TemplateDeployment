import { COLORS, FEEDBACK_VISUAL } from '@/styles/tokens'
import { hexToRgba } from '@/lib/utils/color'
import type { BodyState, JointState, ForceData } from '@/engine/types'
import type { SceneBody, SceneJoint, SceneForce, BodyType } from '@/models/types'
import type { CoordinateAxesConfig } from '@/store/editorStore'
import { getBodyDescriptor } from '@/models/bodyTypes'
import { getJointDescriptor } from '@/models/jointTypes'
import { getHandles } from '@/core/handles/SelectionHandles'
import { screenToWorld, worldToScreen } from './CoordinateSystem'
import type { Viewport } from './CoordinateSystem'
import rotateSvgRaw from '@/assets/icons/rotate.svg?raw'
import { renderGroundHighlight } from '@/models/bodyTypes/ground'
import { renderForces, type DecompositionState } from './ForceRenderer'

export { hexToRgba }

import type { SnapResult } from '@/core/snap/types'
import type { AlignGuide } from '@/core/align/AlignEngine'

export type RotateIconState = 'default' | 'hover' | 'active'

export interface RenderOptions {
  selectedIds?: string[]
  hoveredId?: string | null
  selectedJointIds?: string[]
  hoveredJointId?: string | null
  selectedForceId?: string | null
  hoveredForceId?: string | null
  snapResult?: SnapResult | null
  alignGuides?: AlignGuide[]
  rotateIconState?: RotateIconState
  showForces?: boolean
  forceData?: ForceData[]
  sceneForces?: SceneForce[]
  decompositions?: Map<string, DecompositionState>
  coordinateAxes?: CoordinateAxesConfig
  displacementBody?: { label: string; position: { x: number; y: number } } | null
  trajectoryPaths?: TrajectoryPath[]
  bodyPoseOverrides?: Map<string, { position: { x: number; y: number }; angle: number }>
}

export interface TrajectoryPath {
  bodyId: string
  color: string
  points: Array<{ x: number; y: number }>
}

/** Create a colored rotate icon image from SVG raw text */
function createRotateIcon(color: string): HTMLImageElement {
  const svg = rotateSvgRaw.replace('currentColor', color)
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  return img
}

const _rotateIconGray = createRotateIcon('#aaa')
const _rotateIconBlack = createRotateIcon('#333')
const OBJECT_FILL = hexToRgba(COLORS.white, 0.96)
const OBJECT_FILL_SELECTED = hexToRgba(COLORS.white, 1)
const SELECTION_STROKE = FEEDBACK_VISUAL.selectedColor
const VELOCITY_COLOR = '#111111'
const VELOCITY_MIN_MAGNITUDE = 0.01
const VELOCITY_MIN_ARROW_PX = 18
const VELOCITY_MAX_ARROW_PX = 80
const VELOCITY_CORNER_GAP_PX = 12
const SCALE_LEGEND_MARGIN_PX = 16
const SCALE_LEGEND_GROUND_CLEARANCE_PX = 28

export class CanvasRenderer {
  /** Render in simulation mode (from BodyState[]) */
  render(
    ctx: CanvasRenderingContext2D,
    bodies: BodyState[],
    viewport: Viewport,
    jointStates?: JointState[],
    forceData?: ForceData[],
    simOptions?: {
      sceneBodies?: SceneBody[]
      sceneJoints?: SceneJoint[]
      selectedForceId?: string | null
      hoveredForceId?: string | null
      decompositions?: Map<string, DecompositionState>
      bodyPoseOverrides?: Map<string, { position: { x: number; y: number }; angle: number }>
      coordinateAxes?: CoordinateAxesConfig
      displacementBody?: { label: string; position: { x: number; y: number } } | null
      trajectoryPaths?: TrajectoryPath[]
    },
  ): void {
    const { canvasSize } = viewport
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

    this.renderGrid(ctx, viewport)
    if (simOptions?.coordinateAxes) {
      this.renderCoordinateAxes(ctx, viewport, simOptions.coordinateAxes)
    }
    if (simOptions?.trajectoryPaths && simOptions.trajectoryPaths.length > 0) {
      this.renderTrajectories(ctx, viewport, simOptions.trajectoryPaths)
    }

    // Render joints below bodies
    if (jointStates) {
      this.renderSimJoints(ctx, jointStates, viewport)
    }

    for (const body of bodies) {
      this.renderBody(ctx, body, viewport, simOptions?.bodyPoseOverrides?.get(body.id))
    }

    const simAccelerationByBodyId = new Map<string, { x: number; y: number }>()
    if (simOptions?.sceneBodies) {
      for (const body of simOptions.sceneBodies) {
        simAccelerationByBodyId.set(body.id, body.initialAcceleration ?? { x: 0, y: 0 })
      }
    }
    this.renderVelocityOverlaysInSim(ctx, bodies, viewport, simAccelerationByBodyId)

    // 正式力渲染（替代 renderForceDebug）
    if (forceData && forceData.length > 0 && simOptions?.sceneBodies) {
      renderForces(ctx, forceData, simOptions.sceneBodies, simOptions.sceneJoints ?? [], viewport, {
        selectedForceId: simOptions.selectedForceId,
        hoveredForceId: simOptions.hoveredForceId,
        decompositions: simOptions.decompositions,
        bodyPoseOverrides: simOptions.bodyPoseOverrides,
      })
    }
    if (simOptions?.coordinateAxes && simOptions.displacementBody) {
      this.renderDisplacementLabel(ctx, viewport, simOptions.coordinateAxes, simOptions.displacementBody)
    }

    const simGround = simOptions?.sceneBodies?.find((b) => b.type === 'ground')
    const simGroundY = simGround
      ? (simOptions?.bodyPoseOverrides?.get(simGround.id)?.position.y ?? simGround.position.y)
      : undefined
    const simGroundScreenY = simGroundY != null
      ? worldToScreen(0, simGroundY, viewport).y
      : undefined
    this.renderScaleLegend(ctx, viewport, simGroundScreenY)
  }

  /** Render in edit mode (from SceneBody[]) */
  renderScene(
    ctx: CanvasRenderingContext2D,
    bodies: SceneBody[],
    viewport: Viewport,
    options: RenderOptions = {},
    joints?: SceneJoint[],
  ): void {
    const { canvasSize } = viewport
    ctx.clearRect(0, 0, canvasSize.width, canvasSize.height)

    this.renderGrid(ctx, viewport)
    if (options.coordinateAxes) {
      this.renderCoordinateAxes(ctx, viewport, options.coordinateAxes)
    }
    if (options.trajectoryPaths && options.trajectoryPaths.length > 0) {
      this.renderTrajectories(ctx, viewport, options.trajectoryPaths)
    }

    // Render joints below bodies
    if (joints) {
      this.renderJoints(ctx, joints, bodies, viewport, options)
    }

    for (const body of bodies) {
      this.renderSceneBody(ctx, body, viewport, options)
    }

    this.renderVelocityOverlaysInEdit(ctx, bodies, viewport)

    // 力渲染：优先使用直传 forceData，fallback 到 sceneForces 转换
    if (options.forceData && options.forceData.length > 0) {
      renderForces(ctx, options.forceData, bodies, joints ?? [], viewport, {
        selectedForceId: options.selectedForceId,
        hoveredForceId: options.hoveredForceId,
        decompositions: options.decompositions,
        bodyPoseOverrides: options.bodyPoseOverrides,
      })
    } else if (options.showForces && options.sceneForces && options.sceneForces.length > 0) {
      const editForceData: ForceData[] = options.sceneForces
        .filter(f => f.visible)
        .map(f => ({
          bodyId: f.targetBodyId,
          forceType: 'external' as const,
          vector: {
            x: f.magnitude * Math.cos(f.direction),
            y: f.magnitude * Math.sin(f.direction),
          },
          magnitude: f.magnitude,
          sourceId: f.id,
        }))
      if (editForceData.length > 0) {
        renderForces(ctx, editForceData, bodies, joints ?? [], viewport, {
          selectedForceId: options.selectedForceId,
          hoveredForceId: options.hoveredForceId,
          decompositions: options.decompositions,
          bodyPoseOverrides: options.bodyPoseOverrides,
        })
      }
    }
    if (options.coordinateAxes && options.displacementBody) {
      this.renderDisplacementLabel(ctx, viewport, options.coordinateAxes, options.displacementBody)
    }

    // Render ground selection/hover highlight (special full-width line, not standard bbox)
    const ground = bodies.find((b) => b.type === 'ground')
    if (ground) {
      const isGroundSelected = options.selectedIds?.includes(ground.id) ?? false
      const isGroundHovered = options.hoveredId === ground.id
      if (isGroundSelected || isGroundHovered) {
        renderGroundHighlight(ctx, ground.position.y, viewport, isGroundSelected)
      }
    }

    // Render snap feedback
    if (options.snapResult) {
      this.renderSnapFeedback(ctx, options.snapResult, viewport)
    }

    // Render alignment guides
    if (options.alignGuides && options.alignGuides.length > 0) {
      this.renderAlignGuides(ctx, options.alignGuides, viewport)
    }

    const groundScreenY = ground
      ? worldToScreen(0, ground.position.y, viewport).y
      : undefined
    this.renderScaleLegend(ctx, viewport, groundScreenY)
  }

  renderSceneBody(
    ctx: CanvasRenderingContext2D,
    body: SceneBody,
    viewport: Viewport,
    options: RenderOptions = {},
  ): void {
    const pose = options.bodyPoseOverrides?.get(body.id)
    const position = pose?.position ?? body.position
    const angle = pose?.angle ?? body.angle
    const screen = worldToScreen(position.x, position.y, viewport)
    const { scale } = viewport
    const isSelected = options.selectedIds?.includes(body.id) ?? false
    const isHovered = options.hoveredId === body.id

    ctx.save()
    ctx.translate(screen.x, screen.y)
    ctx.rotate(-angle)
    if (body.flipped) ctx.scale(-1, 1)

    ctx.fillStyle = OBJECT_FILL

    ctx.strokeStyle = COLORS.dark
    ctx.lineWidth = 2

    const desc = getBodyDescriptor(body.type)
    desc.renderEdit(ctx, body, scale, isSelected)

    if (isSelected || isHovered) {
      this.renderBodySelectionOverlay(ctx, desc, body, scale, isSelected)
      if (isSelected) {
        ctx.fillStyle = OBJECT_FILL_SELECTED
      }
    }

    // Selection handles (only when single-selected)
    if (isSelected && (options.selectedIds?.length ?? 0) === 1) {
      this.renderSelectionHandles(ctx, body, scale, options.rotateIconState ?? 'default')
    }

    ctx.restore()
  }

  private renderBodySelectionOverlay(
    ctx: CanvasRenderingContext2D,
    desc: ReturnType<typeof getBodyDescriptor>,
    body: SceneBody,
    scale: number,
    isSelected: boolean,
  ): void {
    ctx.save()
    ctx.fillStyle = 'rgba(255, 255, 255, 0)'
    ctx.strokeStyle = SELECTION_STROKE
    ctx.lineWidth = isSelected ? FEEDBACK_VISUAL.lineWidth.selected : FEEDBACK_VISUAL.lineWidth.hover
    if (!isSelected) ctx.setLineDash([...FEEDBACK_VISUAL.outlineDash])

    if (desc.renderSelectionOutline) {
      desc.renderSelectionOutline(ctx, body, scale)
    } else {
      desc.renderEdit(ctx, body, scale, false)
    }

    ctx.restore()
  }

  private renderSelectionHandles(
    ctx: CanvasRenderingContext2D,
    body: SceneBody,
    scale: number,
    rotateState: RotateIconState,
  ): void {
    const handles = getHandles(body, scale)
    if (handles.length === 0) return

    const handleSize = 4

    for (const h of handles) {
      if (h.id === 'rotate') {
        this.renderRotateIcon(ctx, h.x, h.y, rotateState)
      } else {
        // Corner handles: white-filled squares with blue border
        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = FEEDBACK_VISUAL.selectedColor
        ctx.lineWidth = 2
        ctx.fillRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2)
        ctx.strokeRect(h.x - handleSize, h.y - handleSize, handleSize * 2, handleSize * 2)
      }
    }
  }

  /** Draw rotation icon: gray default, black on hover/active */
  private renderRotateIcon(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    state: RotateIconState,
  ): void {
    const size = 16
    const img = state === 'default' ? _rotateIconGray : _rotateIconBlack
    if (!img.complete) return

    // Active state: hide icon entirely during rotation drag
    if (state === 'active') return

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(Math.PI * 0.25)
    ctx.drawImage(img, -size / 2, -size / 2, size, size)
    ctx.restore()
  }

  renderGrid(ctx: CanvasRenderingContext2D, viewport: Viewport): void {
    const { offset, scale, canvasSize } = viewport

    let gridSpacing = 1
    if (scale < 20) gridSpacing = 5
    else if (scale < 40) gridSpacing = 2
    else if (scale > 150) gridSpacing = 0.5

    const subDivisions = 2
    const subSpacing = gridSpacing / subDivisions

    const leftWorld = (-canvasSize.width / 2 - offset.x) / scale
    const rightWorld = (canvasSize.width / 2 - offset.x) / scale
    const bottomWorld = -offset.y / scale
    const topWorld = (canvasSize.height - offset.y) / scale

    // Sub-grid lines
    ctx.strokeStyle = hexToRgba(COLORS.border, 0.2)
    ctx.lineWidth = 0.5
    ctx.beginPath()

    const subStartX = Math.floor(leftWorld / subSpacing) * subSpacing
    for (let wx = subStartX; wx <= rightWorld; wx += subSpacing) {
      if (Math.abs(wx % gridSpacing) < 0.001) continue
      const screen = worldToScreen(wx, 0, viewport)
      ctx.moveTo(screen.x, 0)
      ctx.lineTo(screen.x, canvasSize.height)
    }

    const subStartY = Math.floor(bottomWorld / subSpacing) * subSpacing
    for (let wy = subStartY; wy <= topWorld; wy += subSpacing) {
      if (Math.abs(wy % gridSpacing) < 0.001) continue
      const screen = worldToScreen(0, wy, viewport)
      ctx.moveTo(0, screen.y)
      ctx.lineTo(canvasSize.width, screen.y)
    }
    ctx.stroke()

    // Main grid lines
    ctx.strokeStyle = hexToRgba(COLORS.border, 0.5)
    ctx.lineWidth = 1
    ctx.beginPath()

    const startX = Math.floor(leftWorld / gridSpacing) * gridSpacing
    for (let wx = startX; wx <= rightWorld; wx += gridSpacing) {
      const screen = worldToScreen(wx, 0, viewport)
      ctx.moveTo(screen.x, 0)
      ctx.lineTo(screen.x, canvasSize.height)
    }

    const startY = Math.floor(bottomWorld / gridSpacing) * gridSpacing
    for (let wy = startY; wy <= topWorld; wy += gridSpacing) {
      const screen = worldToScreen(0, wy, viewport)
      ctx.moveTo(0, screen.y)
      ctx.lineTo(canvasSize.width, screen.y)
    }
    ctx.stroke()
  }

  private renderSnapFeedback(
    ctx: CanvasRenderingContext2D,
    snapResult: SnapResult,
    viewport: Viewport,
  ): void {
    const { targetSurface } = snapResult
    const start = worldToScreen(targetSurface.start.x, targetSurface.start.y, viewport)
    const end = worldToScreen(targetSurface.end.x, targetSurface.end.y, viewport)

    ctx.save()
    ctx.strokeStyle = FEEDBACK_VISUAL.selectedColor
    ctx.lineWidth = FEEDBACK_VISUAL.lineWidth.snap
    ctx.globalAlpha = 0.65
    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(end.x, end.y)
    ctx.stroke()
    ctx.restore()
  }

  private renderAlignGuides(
    ctx: CanvasRenderingContext2D,
    guides: AlignGuide[],
    viewport: Viewport,
  ): void {
    const { canvasSize } = viewport

    ctx.save()
    ctx.strokeStyle = SELECTION_STROKE
    ctx.lineWidth = FEEDBACK_VISUAL.lineWidth.guide
    ctx.setLineDash([...FEEDBACK_VISUAL.guideDash])
    ctx.globalAlpha = 0.7

    for (const guide of guides) {
      ctx.beginPath()
      if (guide.type === 'horizontal') {
        const screen = worldToScreen(0, guide.position, viewport)
        ctx.moveTo(0, screen.y)
        ctx.lineTo(canvasSize.width, screen.y)
      } else {
        const screen = worldToScreen(guide.position, 0, viewport)
        ctx.moveTo(screen.x, 0)
        ctx.lineTo(screen.x, canvasSize.height)
      }
      ctx.stroke()
    }

    ctx.restore()
  }

  private renderTrajectories(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    paths: TrajectoryPath[],
  ): void {
    ctx.save()
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash([6, 4])

    for (const path of paths) {
      if (path.points.length < 2) continue
      ctx.strokeStyle = hexToRgba(path.color, 0.7)
      ctx.beginPath()
      const first = worldToScreen(path.points[0].x, path.points[0].y, viewport)
      ctx.moveTo(first.x, first.y)
      for (let i = 1; i < path.points.length; i++) {
        const pt = worldToScreen(path.points[i].x, path.points[i].y, viewport)
        ctx.lineTo(pt.x, pt.y)
      }
      ctx.stroke()
    }

    ctx.setLineDash([])
    ctx.restore()
  }

  private getAxisTickStep(scale: number): number {
    if (scale < 20) return 5
    if (scale < 45) return 2
    return 1
  }

  private formatAxisValue(value: number): string {
    const rounded = Math.abs(value) < 1e-6 ? 0 : value
    if (Math.abs(rounded - Math.round(rounded)) < 1e-6) return String(Math.round(rounded))
    return rounded.toFixed(1)
  }

  private renderAxisTicks(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    coordinateAxes: CoordinateAxesConfig,
    origin: { x: number; y: number },
  ): void {
    const { canvasSize, scale } = viewport
    const tickStep = this.getAxisTickStep(scale)
    const tickHalfLen = 4

    ctx.save()
    ctx.strokeStyle = 'rgba(17, 17, 17, 0.28)'
    ctx.fillStyle = 'rgba(17, 17, 17, 0.62)'
    ctx.lineWidth = 1
    ctx.font = '10px sans-serif'
    ctx.textBaseline = 'top'

    if (coordinateAxes.mode === 'horizontal' || coordinateAxes.mode === 'both') {
      const leftWorld = screenToWorld(0, origin.y, viewport).x
      const rightWorld = screenToWorld(canvasSize.width, origin.y, viewport).x
      const startX = Math.ceil((leftWorld - coordinateAxes.origin.x) / tickStep) * tickStep + coordinateAxes.origin.x

      for (let wx = startX; wx <= rightWorld + 1e-6; wx += tickStep) {
        const rel = wx - coordinateAxes.origin.x
        if (Math.abs(rel) < tickStep * 0.25) continue
        const screen = worldToScreen(wx, coordinateAxes.origin.y, viewport)
        ctx.beginPath()
        ctx.moveTo(screen.x, origin.y - tickHalfLen)
        ctx.lineTo(screen.x, origin.y + tickHalfLen)
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.fillText(this.formatAxisValue(rel), screen.x, origin.y + 6)
      }
    }

    if (coordinateAxes.mode === 'vertical' || coordinateAxes.mode === 'both') {
      const bottomWorld = screenToWorld(origin.x, canvasSize.height, viewport).y
      const topWorld = screenToWorld(origin.x, 0, viewport).y
      const startY = Math.ceil((bottomWorld - coordinateAxes.origin.y) / tickStep) * tickStep + coordinateAxes.origin.y

      for (let wy = startY; wy <= topWorld + 1e-6; wy += tickStep) {
        const rel = wy - coordinateAxes.origin.y
        if (Math.abs(rel) < tickStep * 0.25) continue
        const screen = worldToScreen(coordinateAxes.origin.x, wy, viewport)
        ctx.beginPath()
        ctx.moveTo(origin.x - tickHalfLen, screen.y)
        ctx.lineTo(origin.x + tickHalfLen, screen.y)
        ctx.stroke()
        ctx.textAlign = 'left'
        ctx.fillText(this.formatAxisValue(rel), origin.x + 6, screen.y - 6)
      }
    }

    ctx.restore()
  }

  private renderCoordinateAxes(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    coordinateAxes: CoordinateAxesConfig,
  ): void {
    if (coordinateAxes.mode === 'off') return

    const origin = worldToScreen(coordinateAxes.origin.x, coordinateAxes.origin.y, viewport)
    const { canvasSize } = viewport
    const axisColor = 'rgba(17, 17, 17, 0.32)'
    const textColor = 'rgba(17, 17, 17, 0.72)'
    const dash = [6, 4]
    const arrowSize = 8

    ctx.save()
    ctx.strokeStyle = axisColor
    ctx.fillStyle = textColor
    ctx.lineWidth = 1.2
    ctx.setLineDash(dash)

    if (coordinateAxes.mode === 'horizontal' || coordinateAxes.mode === 'both') {
      ctx.beginPath()
      ctx.moveTo(0, origin.y)
      ctx.lineTo(canvasSize.width, origin.y)
      ctx.stroke()

      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(canvasSize.width, origin.y)
      ctx.lineTo(canvasSize.width - arrowSize, origin.y - arrowSize * 0.55)
      ctx.lineTo(canvasSize.width - arrowSize, origin.y + arrowSize * 0.55)
      ctx.closePath()
      ctx.fill()
      ctx.setLineDash(dash)

      ctx.font = '12px sans-serif'
      ctx.fillText('x', canvasSize.width - 16, origin.y - 8)
    }

    if (coordinateAxes.mode === 'vertical' || coordinateAxes.mode === 'both') {
      ctx.beginPath()
      ctx.moveTo(origin.x, canvasSize.height)
      ctx.lineTo(origin.x, 0)
      ctx.stroke()

      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(origin.x, 0)
      ctx.lineTo(origin.x - arrowSize * 0.55, arrowSize)
      ctx.lineTo(origin.x + arrowSize * 0.55, arrowSize)
      ctx.closePath()
      ctx.fill()
      ctx.setLineDash(dash)

      ctx.font = '12px sans-serif'
      ctx.fillText('y', origin.x + 8, 14)
    }

    ctx.setLineDash([])
    ctx.beginPath()
    ctx.arc(origin.x, origin.y, 3, 0, Math.PI * 2)
    ctx.fill()

    ctx.font = '11px sans-serif'
    const originText = coordinateAxes.originType === 'world'
      ? 'O'
      : `O(${coordinateAxes.originLabel ?? '选中'})`
    ctx.fillText(originText, origin.x + 8, origin.y - 10)
    ctx.restore()

    if (coordinateAxes.showTicks) {
      this.renderAxisTicks(ctx, viewport, coordinateAxes, origin)
    }
  }

  private renderDisplacementLabel(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    coordinateAxes: CoordinateAxesConfig,
    body: { label: string; position: { x: number; y: number } },
  ): void {
    if (!coordinateAxes.showDisplacementLabels || coordinateAxes.mode === 'off') return

    const dx = body.position.x - coordinateAxes.origin.x
    const dy = body.position.y - coordinateAxes.origin.y
    const lines: string[] = []
    if (coordinateAxes.mode === 'horizontal' || coordinateAxes.mode === 'both') {
      lines.push(`Δx = ${dx >= 0 ? '+' : ''}${dx.toFixed(2)} m`)
    }
    if (coordinateAxes.mode === 'vertical' || coordinateAxes.mode === 'both') {
      lines.push(`Δy = ${dy >= 0 ? '+' : ''}${dy.toFixed(2)} m`)
    }
    if (lines.length === 0) return

    const screen = worldToScreen(body.position.x, body.position.y, viewport)
    const padX = 6
    const padY = 4
    const lineHeight = 14

    ctx.save()
    ctx.font = '11px sans-serif'
    const bodyLabel = body.label || '选中物体'
    const title = `${bodyLabel}`
    const textWidth = [title, ...lines].reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)
    const boxWidth = textWidth + padX * 2
    const boxHeight = (lines.length + 1) * lineHeight + padY * 2
    const boxX = screen.x + 14
    const boxY = screen.y - boxHeight - 14

    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)'
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.24)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 6)
    ctx.fill()
    ctx.stroke()

    ctx.fillStyle = '#111111'
    ctx.fillText(title, boxX + padX, boxY + padY + lineHeight * 0.8)
    ctx.fillStyle = 'rgba(17, 17, 17, 0.78)'
    lines.forEach((line, index) => {
      ctx.fillText(line, boxX + padX, boxY + padY + lineHeight * (index + 1.8))
    })
    ctx.restore()
  }

  private renderVelocityOverlaysInEdit(
    ctx: CanvasRenderingContext2D,
    bodies: SceneBody[],
    viewport: Viewport,
  ): void {
    for (const body of bodies) {
      if (body.isStatic) continue
      this.renderVelocityMarker(
        ctx,
        body.position,
        body.initialVelocity,
        body.initialAcceleration,
        viewport,
        this.getBodyOuterRadiusInEdit(body),
      )
    }
  }

  private renderVelocityOverlaysInSim(
    ctx: CanvasRenderingContext2D,
    bodies: BodyState[],
    viewport: Viewport,
    initialAccelerationByBodyId: Map<string, { x: number; y: number }>,
  ): void {
    for (const body of bodies) {
      this.renderVelocityMarker(
        ctx,
        body.position,
        body.linearVelocity,
        initialAccelerationByBodyId.get(body.id) ?? { x: 0, y: 0 },
        viewport,
        this.getBodyOuterRadiusInSim(body),
      )
    }
  }

  private renderVelocityMarker(
    ctx: CanvasRenderingContext2D,
    origin: { x: number; y: number },
    velocity: { x: number; y: number },
    acceleration: { x: number; y: number },
    viewport: Viewport,
    bodyRadiusM: number,
  ): void {
    const vx = Number.isFinite(velocity.x) ? velocity.x : 0
    const vy = Number.isFinite(velocity.y) ? velocity.y : 0
    const speed = Math.hypot(vx, vy)
    const ax = Number.isFinite(acceleration.x) ? acceleration.x : 0
    const ay = Number.isFinite(acceleration.y) ? acceleration.y : 0
    const accel = Math.hypot(ax, ay)
    if (speed < VELOCITY_MIN_MAGNITUDE && accel < VELOCITY_MIN_MAGNITUDE) return

    const baseX = speed >= VELOCITY_MIN_MAGNITUDE ? vx : ax
    const baseY = speed >= VELOCITY_MIN_MAGNITUDE ? vy : ay
    const baseMag = Math.hypot(baseX, baseY)
    const ux = baseMag > 1e-8 ? baseX / baseMag : 1
    const uy = baseMag > 1e-8 ? baseY / baseMag : 0
    const center = worldToScreen(origin.x, origin.y, viewport)
    const bodyRadiusPx = Math.max(8, bodyRadiusM * viewport.scale)
    const cornerOffsetPx = bodyRadiusPx / Math.SQRT2
    const start = {
      x: center.x + cornerOffsetPx + VELOCITY_CORNER_GAP_PX,
      y: center.y - cornerOffsetPx - VELOCITY_CORNER_GAP_PX,
    }
    const arrowLen = Math.max(
      VELOCITY_MIN_ARROW_PX,
      Math.min(VELOCITY_MAX_ARROW_PX, (speed >= VELOCITY_MIN_MAGNITUDE ? speed : accel) * 12),
    )
    const endX = start.x + ux * arrowLen
    const endY = start.y - uy * arrowLen

    const arrowHeadLen = 7
    const arrowHeadDeg = 24 * (Math.PI / 180)
    const heading = Math.atan2(-uy, ux)
    const left = heading + Math.PI - arrowHeadDeg
    const right = heading + Math.PI + arrowHeadDeg
    const dirScreenX = ux
    const dirScreenY = -uy
    const shaftEndX = endX - dirScreenX * (arrowHeadLen * 0.85)
    const shaftEndY = endY - dirScreenY * (arrowHeadLen * 0.85)

    ctx.save()
    ctx.strokeStyle = VELOCITY_COLOR
    ctx.fillStyle = VELOCITY_COLOR
    ctx.lineWidth = 2
    ctx.lineCap = 'round'

    ctx.beginPath()
    ctx.moveTo(start.x, start.y)
    ctx.lineTo(shaftEndX, shaftEndY)
    ctx.stroke()

    ctx.beginPath()
    ctx.moveTo(endX, endY)
    ctx.lineTo(endX + Math.cos(left) * arrowHeadLen, endY + Math.sin(left) * arrowHeadLen)
    ctx.lineTo(endX + Math.cos(right) * arrowHeadLen, endY + Math.sin(right) * arrowHeadLen)
    ctx.closePath()
    ctx.fill()

    const labelLines: string[] = []
    if (speed >= VELOCITY_MIN_MAGNITUDE) {
      const thetaVDeg = this.normalizeDeg((Math.atan2(vy, vx) * 180) / Math.PI)
      labelLines.push(`v=${speed.toFixed(2)}m/s  θ=${thetaVDeg.toFixed(0)}°`)
    }
    if (accel >= VELOCITY_MIN_MAGNITUDE) {
      const thetaADeg = this.normalizeDeg((Math.atan2(ay, ax) * 180) / Math.PI)
      labelLines.push(`a=${accel.toFixed(2)}m/s²  θ=${thetaADeg.toFixed(0)}°`)
    }
    if (labelLines.length === 0) return

    const textX = endX + 8
    const padX = 4
    const padY = 3

    ctx.font = '11px sans-serif'
    const textWidth = labelLines.reduce((max, line) => Math.max(max, ctx.measureText(line).width), 0)
    const boxWidth = textWidth + padX * 2
    const lineHeight = 14
    const boxHeight = labelLines.length * lineHeight + padY * 2
    const boxTop = endY - boxHeight / 2

    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
    ctx.fillRect(textX - padX, boxTop, boxWidth, boxHeight)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.25)'
    ctx.lineWidth = 1
    ctx.strokeRect(textX - padX, boxTop, boxWidth, boxHeight)

    ctx.fillStyle = VELOCITY_COLOR
    for (let i = 0; i < labelLines.length; i++) {
      const lineY = boxTop + padY + lineHeight * (i + 0.85)
      ctx.fillText(labelLines[i], textX, lineY)
    }
    ctx.restore()
  }

  private renderScaleLegend(
    ctx: CanvasRenderingContext2D,
    viewport: Viewport,
    groundScreenY?: number,
  ): void {
    const meterPx = viewport.scale
    if (!Number.isFinite(meterPx) || meterPx <= 0) return

    const { canvasSize } = viewport
    let lineY = canvasSize.height - SCALE_LEGEND_MARGIN_PX
    if (Number.isFinite(groundScreenY)) {
      lineY = Math.min(lineY, (groundScreenY as number) - SCALE_LEGEND_GROUND_CLEARANCE_PX)
    }
    lineY = Math.max(24, lineY)
    const startX = SCALE_LEGEND_MARGIN_PX
    const endX = startX + meterPx
    const capH = 4
    const capW = 5

    ctx.save()
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'

    // 主标尺线：虚线
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(startX, lineY)
    ctx.lineTo(endX, lineY)
    ctx.stroke()

    // 两端短竖线 + 向内短横，基线与虚线对齐
    ctx.setLineDash([])
    ctx.beginPath()
    ctx.moveTo(startX, lineY - capH)
    ctx.lineTo(startX, lineY)
    ctx.lineTo(startX + capW, lineY)
    ctx.moveTo(endX, lineY - capH)
    ctx.lineTo(endX, lineY)
    ctx.lineTo(endX - capW, lineY)
    ctx.stroke()

    ctx.fillStyle = '#111111'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText('1 m', startX + meterPx / 2, lineY + capH + 2)
    ctx.restore()
  }

  private getBodyOuterRadiusInEdit(body: SceneBody): number {
    try {
      const desc = getBodyDescriptor(body.type)
      const bounds = desc.getSelectionBounds(body, 1)
      return Math.max(0.1, Math.hypot(bounds.halfW, bounds.halfH))
    } catch {
      return 0.5
    }
  }

  private getBodyOuterRadiusInSim(body: BodyState): number {
    const shapes = body.shapes && body.shapes.length > 0 ? body.shapes : [body.shape]
    let maxRadius = 0

    for (const shape of shapes) {
      switch (shape.type) {
        case 'circle':
          maxRadius = Math.max(maxRadius, shape.radius)
          break
        case 'box':
          maxRadius = Math.max(maxRadius, Math.hypot(shape.width / 2, shape.height / 2))
          break
        case 'polygon':
        case 'chain':
          for (const v of shape.vertices) {
            maxRadius = Math.max(maxRadius, Math.hypot(v.x, v.y))
          }
          break
      }
    }

    return Math.max(0.1, maxRadius)
  }

  private normalizeDeg(deg: number): number {
    const normalized = ((deg % 360) + 360) % 360
    return normalized > 180 ? normalized - 360 : normalized
  }

  /** Render joints in edit mode (delegates to descriptor.renderEdit) */
  renderJoints(
    ctx: CanvasRenderingContext2D,
    joints: SceneJoint[],
    bodies: SceneBody[],
    viewport: Viewport,
    options: RenderOptions = {},
  ): void {
    const bodyMap = new Map(bodies.map(b => [b.id, b]))
    for (const joint of joints) {
      const desc = getJointDescriptor(joint.type)
      if (!desc) continue
      const bodyA = bodyMap.get(joint.bodyIdA)
      const bodyB = bodyMap.get(joint.bodyIdB)
      if (!bodyA || !bodyB) continue
      const isSelected = options.selectedJointIds?.includes(joint.id) ?? false
      const isHovered = options.hoveredJointId === joint.id
      desc.renderEdit(ctx, joint, bodyA, bodyB, isSelected, isHovered, viewport)
    }
  }

  /** Render joints in simulation mode (delegates to descriptor.renderSim) */
  renderSimJoints(
    ctx: CanvasRenderingContext2D,
    jointStates: JointState[],
    viewport: Viewport,
  ): void {
    for (const js of jointStates) {
      const desc = getJointDescriptor((js.sceneType ?? js.type) as never)
      if (!desc) continue
      desc.renderSim(ctx, js, viewport)
    }
  }

  renderBody(
    ctx: CanvasRenderingContext2D,
    body: BodyState,
    viewport: Viewport,
    poseOverride?: { position: { x: number; y: number }; angle: number },
  ): void {
    const position = poseOverride?.position ?? body.position
    const angle = poseOverride?.angle ?? body.angle
    const screen = worldToScreen(position.x, position.y, viewport)
    const { scale } = viewport

    ctx.save()
    ctx.translate(screen.x, screen.y)
    ctx.rotate(-angle)

    ctx.fillStyle = OBJECT_FILL
    ctx.strokeStyle = COLORS.dark
    ctx.lineWidth = 2

    // Try custom sim rendering from descriptor
    // renderSim draws with original vertex formulas, so needs ctx.scale(-1,1) for flipped bodies.
    // Generic path below uses physics vertices which are already mirrored by sceneSync.
    if (body.userData?.bodyType) {
      try {
        const desc = getBodyDescriptor(body.userData.bodyType as BodyType)
        if (desc.renderSim) {
          if (body.userData?.flipped) ctx.scale(-1, 1)
          desc.renderSim(ctx, body, scale)
          ctx.restore()
          return
        }
      } catch {
        // Unknown body type in userData, fall through to generic rendering
      }
    }

    // Generic shape rendering
    this.renderShape(ctx, body.shape, scale)

    // Render additional shapes for multi-fixture bodies (e.g. groove)
    if (body.shapes && body.shapes.length > 1) {
      for (let si = 1; si < body.shapes.length; si++) {
        this.renderShape(ctx, body.shapes[si], scale)
      }
    }

    ctx.restore()
  }

  private renderShape(
    ctx: CanvasRenderingContext2D,
    shape: BodyState['shape'],
    scale: number,
  ): void {
    switch (shape.type) {
      case 'box': {
        const w = shape.width * scale
        const h = shape.height * scale
        ctx.beginPath()
        ctx.rect(-w / 2, -h / 2, w, h)
        ctx.fill()
        ctx.stroke()
        break
      }
      case 'circle': {
        const r = shape.radius * scale
        ctx.beginPath()
        ctx.arc(0, 0, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        // Direction indicator (radial line)
        ctx.beginPath()
        ctx.moveTo(0, 0)
        ctx.lineTo(r, 0)
        ctx.stroke()
        break
      }
      case 'polygon': {
        const verts = shape.vertices
        if (verts.length < 3) break
        ctx.beginPath()
        ctx.moveTo(verts[0].x * scale, -verts[0].y * scale)
        for (let i = 1; i < verts.length; i++) {
          ctx.lineTo(verts[i].x * scale, -verts[i].y * scale)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        break
      }
      case 'chain': {
        const verts = shape.vertices
        if (verts.length < 2) break
        ctx.beginPath()
        ctx.moveTo(verts[0].x * scale, -verts[0].y * scale)
        for (let i = 1; i < verts.length; i++) {
          ctx.lineTo(verts[i].x * scale, -verts[i].y * scale)
        }
        if (shape.loop) ctx.closePath()
        ctx.stroke()
        break
      }
    }
  }

  /** Render a semi-transparent drag preview of a body being dragged from the object panel */
  renderDragPreview(
    ctx: CanvasRenderingContext2D,
    body: SceneBody,
    viewport: Viewport,
  ): void {
    const screen = worldToScreen(body.position.x, body.position.y, viewport)
    const { scale } = viewport

    ctx.save()
    ctx.globalAlpha = 0.5
    ctx.translate(screen.x, screen.y)
    ctx.rotate(-body.angle)
    if (body.flipped) ctx.scale(-1, 1)

    ctx.fillStyle = OBJECT_FILL
    ctx.strokeStyle = COLORS.dark
    ctx.lineWidth = 2

    const desc = getBodyDescriptor(body.type)
    desc.renderEdit(ctx, body, scale, false)

    ctx.restore()
  }
}
