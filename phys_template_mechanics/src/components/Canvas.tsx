import { useRef, useEffect, useCallback, useState } from 'react'
import { Undo2, Redo2 } from 'lucide-react'
import { useViewportStore } from '@/store/viewportStore'
import { useEditorStore } from '@/store/editorStore'
import { useSceneStore } from '@/store/sceneStore'
import { useSelectionStore, selectedBodyIds, selectedJointIds } from '@/store/selectionStore'
import { useToolStore } from '@/store/toolStore'
import { useCommandStore } from '@/store/commandStore'
import { useForceDisplayStore, forceKey } from '@/store/forceDisplayStore'
import { CanvasRenderer } from '@/renderer/CanvasRenderer'
import { physicsBridge } from '@/engine/physicsBridgeInstance'
import { syncSceneToWorld } from '@/engine/sceneSync'
import { screenToWorld, worldToScreen } from '@/renderer/CoordinateSystem'
import type { DecompositionState } from '@/renderer/ForceRenderer'
import type { BodyState, JointState, ForceData } from '@/engine/types'
import type { Viewport } from '@/renderer/CoordinateSystem'
import type { CanvasMouseEvent } from '@/core/tools/Tool'
import type { SelectTool } from '@/core/tools/SelectTool'
import { JointTool } from '@/core/tools/JointTool'
import type { BodyType, JointType, Scene, SceneBody } from '@/models/types'
import { AddBodyCommand } from '@/core/commands/AddBodyCommand'
import { RemoveBodyCommand } from '@/core/commands/RemoveBodyCommand'
import { RemoveJointCommand } from '@/core/commands/RemoveJointCommand'
import { generateId, generateLabel } from '@/models/defaults'
import { getBodyDescriptor, getInteraction } from '@/models/bodyTypes'
import { computeSnap } from '@/core/snap/SnapEngine'
import {
  consumePendingJointType,
  getCurrentDragBodyType,
  getCurrentDragJointType,
  setCurrentDragBodyType,
  setCurrentDragJointType,
} from '@/components/panels/dragState'
import { AnalysisRecorder } from '@/engine/AnalysisRecorder'
import { augmentForcesWithTeachingForces, isTeachingForceType } from '@/engine/teachingForces'
import { useAnalysisStore } from '@/store/analysisStore'
import { usePlaybackControlStore } from '@/store/playbackControlStore'
import { isAnalyzableBody } from '@/components/charts/chartUtils'
import { getChartColor } from '@/components/charts/chartColors'
import { Tip } from '@/components/ui/Tip'
import { useToastHook } from '@/components/ui/toast'
import { Button } from '@/components/ui/button'
import { COLORS, EDITOR_CHROME } from '@/styles/tokens'
import type { TrajectoryPath } from '@/renderer/CanvasRenderer'
import {
  computeFm041TeachingState,
  getFm041BaseRadius,
  getFm041MaxVisualRadius,
  FM041_DISK_BODY_ID,
  FM041_SLIDER_BODY_ID,
  getFm041Omega,
  isFm041Scene,
} from '@/templates/fm041Teaching'
import {
  FM042_BOB_BODY_ID,
  computeFm042Geometry,
  getFm042BobVisualPose,
  getFm042TopViewTheta,
  isFm042Scene,
} from '@/templates/fm042Teaching'

const renderer = new CanvasRenderer()
const analysisRecorder = new AnalysisRecorder()

// Module-level drag preview state (avoids react-hooks/immutability lint errors with refs in callbacks)
let _dragPreview: { bodyType: BodyType; body: SceneBody } | null = null
let _dragJointGuide: { jointType: JointType; screenX: number; screenY: number } | null = null
let _dragRaf = 0
const AUTO_HIDDEN_FORCE_TYPES = new Set<BodyType>(['conveyor', 'hemisphere', 'half-sphere', 'groove'])
const MOM013_RUNTIME_SCENE_ID = 'template-scene-mom-013'
const MOM013_PLATFORM_BODY_ID = 'body-platform-main'
const MAX_TIMELINE_SNAPSHOTS = 36000
const TOAST_COOLDOWN_MS = 3500

type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface TimelineSnapshot {
  t: number
  bodies: BodyState[]
  forces: ForceData[]
}

interface Fm041VisualMotionState {
  lastTimestamp: number | null
  diskTheta: number
  sliderTheta: number
  sliderRadius: number
  sliderY: number | null
  sliderVy: number
  isFalling: boolean
  fallSideSign: 1 | -1
}

function cloneBodyStates(states: BodyState[]): BodyState[] {
  return states.map((s) => ({
    ...s,
    position: { ...s.position },
    linearVelocity: { ...s.linearVelocity },
  }))
}

function cloneForceData(forces: ForceData[]): ForceData[] {
  return forces.map((f) => ({
    ...f,
    vector: { ...f.vector },
    contactNormal: f.contactNormal ? { ...f.contactNormal } : undefined,
  }))
}

function buildTrajectoryPaths(
  frameHistory: Array<{ bodies: Record<string, { x: number; y: number }> }>,
  sceneBodies: SceneBody[],
  activeDataSourceIds: Set<string>,
): TrajectoryPath[] {
  const dynamicBodies = sceneBodies.filter(isAnalyzableBody)
  const activeBodyIds = Array.from(activeDataSourceIds).filter((id) => !id.startsWith('group:'))
  const targetIds = activeBodyIds.length > 0
    ? new Set(activeBodyIds)
    : new Set(dynamicBodies.map((body) => body.id))

  const result: TrajectoryPath[] = []
  dynamicBodies.forEach((body, idx) => {
    if (!targetIds.has(body.id)) return
    const points = frameHistory
      .map((frame) => frame.bodies[body.id])
      .filter((point): point is { x: number; y: number } => Boolean(point))
      .map((point) => ({ x: point.x, y: point.y }))
    if (points.length < 2) return
    result.push({
      bodyId: body.id,
      color: getChartColor(idx),
      points,
    })
  })

  return result
}

function isFiniteBodyStates(states: BodyState[]): boolean {
  for (const state of states) {
    if (
      !Number.isFinite(state.position.x) ||
      !Number.isFinite(state.position.y) ||
      !Number.isFinite(state.angle) ||
      !Number.isFinite(state.linearVelocity.x) ||
      !Number.isFinite(state.linearVelocity.y) ||
      !Number.isFinite(state.angularVelocity)
    ) {
      return false
    }
  }
  return true
}

function isFiniteForces(forces: ForceData[]): boolean {
  for (const force of forces) {
    if (
      !Number.isFinite(force.vector.x) ||
      !Number.isFinite(force.vector.y) ||
      !Number.isFinite(force.magnitude)
    ) {
      return false
    }
    if (force.contactNormal) {
      if (!Number.isFinite(force.contactNormal.x) || !Number.isFinite(force.contactNormal.y)) {
        return false
      }
    }
  }
  return true
}

function drawDragJointGuide(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  guide: { jointType: JointType; screenX: number; screenY: number },
): void {
  const stepText = guide.jointType === 'pulley'
    ? '① 请选择第一个物体（滑轮绳）'
    : '① 请选择第一个物体'
  const lines = [stepText, '松开鼠标后开始选择', 'Esc 退出']

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

  let boxX = guide.screenX + offsetX
  let boxY = guide.screenY + offsetY
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
    ctx.fillStyle = i === 2 ? COLORS.textMuted : COLORS.text
    ctx.fillText(line, boxX + paddingX, y)
  })
  ctx.restore()
}

function shouldAutoHideForces(body: SceneBody): boolean {
  try {
    return getBodyDescriptor(body.type).category === 'support' || AUTO_HIDDEN_FORCE_TYPES.has(body.type)
  } catch {
    return false
  }
}

function collectAutoHiddenForceBodyIds(scene: Scene): Set<string> {
  const result = new Set<string>()
  for (const body of scene.bodies) {
    if (shouldAutoHideForces(body) || shouldAutoHideSceneSpecificBody(scene, body)) {
      result.add(body.id)
    }
  }
  return result
}

function shouldAutoHideSceneSpecificBody(scene: Scene, body: SceneBody): boolean {
  if (scene.id === MOM013_RUNTIME_SCENE_ID && body.id === MOM013_PLATFORM_BODY_ID && body.isStatic) {
    return true
  }
  return false
}

/** 从全部基础力计算合力（不含 resultant 自身） */
function computeResultants(forces: ForceData[]): ForceData[] {
  const byBody = new Map<string, ForceData[]>()
  for (const f of forces) {
    if (f.forceType === 'resultant' || isTeachingForceType(f.forceType)) continue
    let arr = byBody.get(f.bodyId)
    if (!arr) { arr = []; byBody.set(f.bodyId, arr) }
    arr.push(f)
  }
  const result: ForceData[] = []
  for (const [bodyId, bodyForces] of byBody) {
    if (bodyForces.length < 2) continue
    let sx = 0, sy = 0
    for (const f of bodyForces) { sx += f.vector.x; sy += f.vector.y }
    const mag = Math.hypot(sx, sy)
    if (mag < 0.01) continue
    // 冗余检测：合力 ≈ 某独立力
    const dir = { x: sx / mag, y: sy / mag }
    const redundant = bodyForces.some(f => {
      if (f.magnitude < 0.01) return false
      const fd = { x: f.vector.x / f.magnitude, y: f.vector.y / f.magnitude }
      return Math.abs(f.magnitude - mag) < 0.01 &&
        Math.abs(fd.x - dir.x) < 0.01 &&
        Math.abs(fd.y - dir.y) < 0.01
    })
    if (redundant) continue
    result.push({ bodyId, forceType: 'resultant', vector: { x: sx, y: sy }, magnitude: mag })
  }
  return result
}

function drawFm041RotationCue(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  scene: Scene,
  diskTheta: number,
): void {
  if (!isFm041Scene(scene)) return
  const disk = scene.bodies.find((body) => body.id === FM041_DISK_BODY_ID)
  if (!disk) return

  const omega = getFm041Omega(scene)
  const center = worldToScreen(disk.position.x, disk.position.y, viewport)
  const diskRadiusPx = Math.max(20, ((disk.width ?? 7.2) * viewport.scale) / 2 - 12)
  const diskHalfHeightPx = Math.max(4, ((disk.height ?? 0.45) * viewport.scale) / 2)

  ctx.save()
  ctx.strokeStyle = COLORS.textSecondary
  ctx.fillStyle = COLORS.textSecondary

  const markerX = center.x + Math.cos(diskTheta) * diskRadiusPx
  const markerY = center.y - diskHalfHeightPx - 2
  ctx.beginPath()
  ctx.roundRect(markerX - 5, markerY - 2, 10, 4, 2)
  ctx.fill()

  ctx.font = '11px sans-serif'
  ctx.fillText(`顺时针  ω=${omega.toFixed(1)} rad/s`, center.x + diskRadiusPx + 18, center.y - 26)
  ctx.restore()
}

function drawFm042TeachingOverlay(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  scene: Scene,
  nowMs: number,
): void {
  if (!isFm042Scene(scene)) return
  const geometry = computeFm042Geometry(scene)
  if (!geometry) return

  const anchorScreen = worldToScreen(geometry.anchor.position.x, geometry.anchor.position.y, viewport)
  const bobScreen = worldToScreen(geometry.bob.position.x, geometry.bob.position.y, viewport)
  const orbitLeft = worldToScreen(geometry.anchor.position.x - geometry.radius, geometry.bob.position.y, viewport)
  const orbitRight = worldToScreen(geometry.anchor.position.x + geometry.radius, geometry.bob.position.y, viewport)

  ctx.save()
  ctx.strokeStyle = 'rgba(17, 17, 17, 0.32)'
  ctx.fillStyle = 'rgba(17, 17, 17, 0.72)'
  ctx.lineWidth = 1.2
  ctx.setLineDash([6, 4])

  // 侧视图：竖直轴
  ctx.beginPath()
  ctx.moveTo(anchorScreen.x, anchorScreen.y)
  ctx.lineTo(anchorScreen.x, bobScreen.y + 12)
  ctx.stroke()

  // 侧视图：水平轨迹投影
  ctx.beginPath()
  ctx.moveTo(orbitLeft.x, orbitLeft.y)
  ctx.lineTo(orbitRight.x, orbitRight.y)
  ctx.stroke()

  // 圆锥截面虚线
  ctx.beginPath()
  ctx.moveTo(anchorScreen.x, anchorScreen.y)
  ctx.lineTo(orbitLeft.x, orbitLeft.y)
  ctx.moveTo(anchorScreen.x, anchorScreen.y)
  ctx.lineTo(orbitRight.x, orbitRight.y)
  ctx.stroke()

  ctx.setLineDash([])
  ctx.font = '11px sans-serif'
  ctx.fillText('侧视图', orbitRight.x + 12, orbitRight.y - 10)
  ctx.fillText('水平圆轨迹投影', orbitRight.x + 12, orbitRight.y + 8)

  // 顶视图 inset
  const insetWidth = 156
  const insetHeight = 148
  const insetX = viewport.canvasSize.width - insetWidth - 18
  const insetY = 20
  const insetCenter = { x: insetX + insetWidth / 2, y: insetY + insetHeight / 2 + 8 }
  const insetRadius = 38
  const theta = getFm042TopViewTheta(nowMs)
  const bobInset = {
    x: insetCenter.x + Math.cos(theta) * insetRadius,
    y: insetCenter.y + Math.sin(theta) * insetRadius,
  }

  ctx.fillStyle = 'rgba(255,255,255,0.94)'
  ctx.strokeStyle = 'rgba(0,0,0,0.18)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.roundRect(insetX, insetY, insetWidth, insetHeight, 10)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = 'rgba(17,17,17,0.78)'
  ctx.font = '11px sans-serif'
  ctx.fillText('顶视图', insetX + 12, insetY + 16)

  ctx.strokeStyle = 'rgba(17,17,17,0.34)'
  ctx.setLineDash([5, 4])
  ctx.beginPath()
  ctx.arc(insetCenter.x, insetCenter.y, insetRadius, 0, Math.PI * 2)
  ctx.stroke()
  ctx.setLineDash([])

  ctx.fillStyle = '#111111'
  ctx.beginPath()
  ctx.arc(insetCenter.x, insetCenter.y, 3.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#111111'
  ctx.lineWidth = 1.4
  ctx.beginPath()
  ctx.moveTo(insetCenter.x, insetCenter.y)
  ctx.lineTo(bobInset.x, bobInset.y)
  ctx.stroke()

  ctx.fillStyle = '#111111'
  ctx.beginPath()
  ctx.arc(bobInset.x, bobInset.y, 5.5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = 'rgba(17,17,17,0.72)'
  ctx.fillText(`r=${geometry.radius.toFixed(2)}m`, insetX + 12, insetY + insetHeight - 18)
  ctx.fillText(`θ=${geometry.angleFromVerticalDeg.toFixed(0)}°`, insetX + 82, insetY + insetHeight - 18)
  ctx.restore()
}

function buildFm041VisualOverrides(
  scene: Scene,
  state: Fm041VisualMotionState,
  nowMs: number,
): {
  overrides: Map<string, { position: { x: number; y: number }; angle: number }>
  diskTheta: number
  onDisk: boolean
  sliderPose: { position: { x: number; y: number }; angle: number } | null
} {
  const overrides = new Map<string, { position: { x: number; y: number }; angle: number }>()
  if (!isFm041Scene(scene)) {
    state.lastTimestamp = nowMs
    return { overrides, diskTheta: 0, onDisk: true, sliderPose: null }
  }

  const disk = scene.bodies.find((body) => body.id === FM041_DISK_BODY_ID)
  const slider = scene.bodies.find((body) => body.id === FM041_SLIDER_BODY_ID)
  const teachingState = computeFm041TeachingState(scene)
  if (!disk || !slider || !teachingState) {
    state.lastTimestamp = nowMs
    return { overrides, diskTheta: 0, onDisk: true, sliderPose: null }
  }

  const dt = state.lastTimestamp == null
    ? 0
    : Math.max(0, Math.min(0.1, (nowMs - state.lastTimestamp) / 1000))
  state.lastTimestamp = nowMs

  const baseRadius = getFm041BaseRadius(scene)
  const maxRadius = getFm041MaxVisualRadius(scene)
  const omega = teachingState.omega
  state.diskTheta += omega * dt

  if (teachingState.state === 'slipping') {
    const sliderOmega = Math.max(0.15, Math.min(omega, teachingState.criticalOmega))
    const excessRatio = teachingState.maxStaticFriction > 0
      ? Math.max(0, (teachingState.requiredCentripetalForce - teachingState.maxStaticFriction) / teachingState.maxStaticFriction)
      : 1
    const growthRate = Math.max(0.18, Math.min(1.6, 0.35 + excessRatio * 0.6))
    if (!state.isFalling) {
      state.sliderTheta += sliderOmega * dt
      state.sliderRadius = Math.max(baseRadius, state.sliderRadius || baseRadius)
      const nextRadius = state.sliderRadius + growthRate * dt
      if (nextRadius >= maxRadius - 1e-6) {
        state.sliderRadius = maxRadius
        state.isFalling = true
        state.sliderVy = 0
        state.sliderY = slider.position.y
        state.fallSideSign = Math.cos(state.sliderTheta) >= 0 ? 1 : -1
      } else {
        state.sliderRadius = nextRadius
        state.sliderY = slider.position.y
      }
    } else {
      state.sliderTheta += sliderOmega * dt * 0.35
      state.sliderVy += Math.max(4, teachingState.gravity) * dt
      state.sliderY = (state.sliderY ?? slider.position.y) - state.sliderVy * dt
    }
  } else {
    state.sliderTheta = state.diskTheta
    state.sliderRadius = baseRadius
    state.sliderY = slider.position.y
    state.sliderVy = 0
    state.isFalling = false
    state.fallSideSign = Math.cos(state.sliderTheta) >= 0 ? 1 : -1
  }

  const period = Math.PI * 2
  if (state.diskTheta > period * 1000) state.diskTheta %= period
  if (state.sliderTheta > period * 1000) state.sliderTheta %= period

  const effectiveCos = state.isFalling ? state.fallSideSign : Math.cos(state.sliderTheta)
  const sliderX = disk.position.x + state.sliderRadius * effectiveCos
  const sliderPose = {
    position: {
      x: sliderX,
      y: state.sliderY ?? slider.position.y,
    },
    angle: slider.angle,
  }
  overrides.set(FM041_SLIDER_BODY_ID, sliderPose)

  return {
    overrides,
    diskTheta: state.diskTheta,
    onDisk: !state.isFalling,
    sliderPose,
  }
}

function buildFm042VisualOverrides(
  scene: Scene,
  nowMs: number,
): Map<string, { position: { x: number; y: number }; angle: number }> {
  const overrides = new Map<string, { position: { x: number; y: number }; angle: number }>()
  if (!isFm042Scene(scene)) return overrides

  const bobPose = getFm042BobVisualPose(scene, nowMs)
  if (bobPose) {
    overrides.set(FM042_BOB_BODY_ID, bobPose)
  }

  return overrides
}

export function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const animFrameRef = useRef<number>(0)
  const bodiesRef = useRef<BodyState[]>([])
  const jointStatesRef = useRef<JointState[]>([])
  const forceDataRef = useRef<ForceData[]>([])
  const decomStatesRef = useRef<Map<string, DecompositionState>>(new Map())
  const decomAnimatingRef = useRef(false)
  const decomAnimFrameRef = useRef(0)
  const fm041AnimFrameRef = useRef(0)
  const fm041MotionStateRef = useRef<Fm041VisualMotionState>({
    lastTimestamp: null,
    diskTheta: 0,
    sliderTheta: 0,
    sliderRadius: 0,
    sliderY: null,
    sliderVy: 0,
    isFalling: false,
    fallSideSign: 1,
  })
  const isPanningRef = useRef(false)
  const lastMouseRef = useRef({ x: 0, y: 0 })
  const spaceDownRef = useRef(false)
  const lastSimFrameTsRef = useRef<number | null>(null)
  const simAccumulatorRef = useRef(0)

  const [cursor, setCursor] = useState('default')

  const offset = useViewportStore((s) => s.offset)
  const scale = useViewportStore((s) => s.scale)
  const canvasSize = useViewportStore((s) => s.canvasSize)
  const pan = useViewportStore((s) => s.pan)
  const zoom = useViewportStore((s) => s.zoom)
  const setCanvasSize = useViewportStore((s) => s.setCanvasSize)

  const mode = useEditorStore((s) => s.mode)
  const simState = useEditorStore((s) => s.simState)
  const playSim = useEditorStore((s) => s.play)
  const pauseSim = useEditorStore((s) => s.pause)
  const stopSim = useEditorStore((s) => s.stop)
  const stopAtCurrentSim = useEditorStore((s) => s.stopAtCurrent)
  const coordinateAxes = useEditorStore((s) => s.coordinateAxes)

  const scene = useSceneStore((s) => s.scene)
  const gravityX = useSceneStore((s) => s.scene.settings.gravity.x)
  const gravityY = useSceneStore((s) => s.scene.settings.gravity.y)
  const selected = useSelectionStore((s) => s.selected)
  const hovered = useSelectionStore((s) => s.hovered)
  const selectedForceId = useSelectionStore((s) => s.selectedForceId)
  const hoveredForceId = useSelectionStore((s) => s.hoveredForceId)
  const activeTool = useToolStore((s) => s.activeTool)
  const activeToolName = useToolStore((s) => s.activeToolName)
  const hiddenForceKeys = useForceDisplayStore((s) => s.hiddenForceKeys)
  const decomposedForceKeys = useForceDisplayStore((s) => s.decomposedForceKeys)
  const canUndo = useCommandStore((s) => s.canUndo)
  const canRedo = useCommandStore((s) => s.canRedo)
  const undo = useCommandStore((s) => s.undo)
  const redo = useCommandStore((s) => s.redo)
  const setPlaybackTimeline = usePlaybackControlStore((s) => s.setTimeline)
  const setPlaybackHandlers = usePlaybackControlStore((s) => s.setHandlers)
  const playbackSpeed = usePlaybackControlStore((s) => s.playbackSpeed)
  const toast = useToastHook()
  const toastGateRef = useRef<Map<string, number>>(new Map())

  const notifyWithCooldown = useCallback((
    key: string,
    variant: ToastVariant,
    title: string,
    description?: string,
    cooldownMs = TOAST_COOLDOWN_MS,
  ) => {
    const now = Date.now()
    const last = toastGateRef.current.get(key) ?? 0
    if (now - last < cooldownMs) return
    toastGateRef.current.set(key, now)
    toast[variant](title, description)
  }, [toast])

  // Track last probed scene to avoid redundant probes
  const lastProbedSceneRef = useRef<Scene | null>(null)
  const probedForcesRef = useRef<ForceData[]>([])
  const simFrameCountRef = useRef(0)
  const prevSimStateRef = useRef(simState)
  const startFromEditRef = useRef(false)
  const timelineSnapshotsRef = useRef<TimelineSnapshot[]>([])
  const autoHiddenForceSceneRef = useRef<Scene | null>(null)
  const autoHiddenForceBodyIdsRef = useRef<Set<string>>(new Set())

  const [timelineCurrentTime, setTimelineCurrentTime] = useState(0)

  // Initialize physics world from scene
  useEffect(() => {
    syncSceneToWorld(scene, physicsBridge)
    bodiesRef.current = physicsBridge.getBodyStates()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep world gravity in sync when environment settings change.
  useEffect(() => {
    physicsBridge.setGravity({ x: gravityX, y: gravityY })
  }, [gravityX, gravityY])

  // Handle canvas resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        setCanvasSize(Math.floor(width), Math.floor(height))
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [setCanvasSize])

  useEffect(() => {
    if (isPanningRef.current) return
    if (spaceDownRef.current || activeToolName === 'pan') {
      setCursor('grab')
      return
    }
    setCursor('default')
  }, [activeToolName])

  // Setup canvas DPI
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = canvasSize.width * dpr
    canvas.height = canvasSize.height * dpr
    canvas.style.width = `${canvasSize.width}px`
    canvas.style.height = `${canvasSize.height}px`

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.scale(dpr, dpr)
    }
  }, [canvasSize.width, canvasSize.height])

  // Render function
  // Imperative render: reads latest state from stores directly (no stale closures)
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const vp = useViewportStore.getState()
    const viewport: Viewport = { offset: vp.offset, scale: vp.scale, canvasSize: vp.canvasSize }
    const currentMode = useEditorStore.getState().mode
    const currentScene = useSceneStore.getState().scene
    const hov = useSelectionStore.getState().hovered
    const selForceId = useSelectionStore.getState().selectedForceId
    const hovForceId = useSelectionStore.getState().hoveredForceId
    const tool = useToolStore.getState().activeTool
    const currentCoordinateAxes = useEditorStore.getState().coordinateAxes
    const hidden = useForceDisplayStore.getState().hiddenForceKeys
    const decomKeys = useForceDisplayStore.getState().decomposedForceKeys
    if (autoHiddenForceSceneRef.current !== currentScene) {
      autoHiddenForceBodyIdsRef.current = collectAutoHiddenForceBodyIds(currentScene)
      autoHiddenForceSceneRef.current = currentScene
    }
    const autoHiddenForceBodyIds = autoHiddenForceBodyIdsRef.current

    // 构建 forceKey → ForceRenderItem.forceId 的映射
    // ForceRenderItem.forceId: 外力用 sourceId，其他用 `${bodyId}:${forceType}`
    const allForces = currentMode === 'edit' ? probedForcesRef.current : forceDataRef.current
    const keyToRenderId = new Map<string, string>()
    const keyToBodyId = new Map<string, string>()
    for (const f of allForces) {
      const fk = forceKey(f)
      const renderId = f.sourceId ?? `${f.bodyId}:${f.forceType}`
      keyToRenderId.set(fk, renderId)
      keyToBodyId.set(fk, f.bodyId)
    }

    // 计算每个物体的分解坐标轴角度：有接触面时沿接触面，否则水平
    const bodyAxisAngle = new Map<string, number>()
    for (const f of allForces) {
      if (f.forceType === 'normal' && f.contactNormal) {
        // 接触面方向 = 法线旋转 90°（法线指向物体外侧，取切线方向）
        const surfaceAngle = Math.atan2(f.contactNormal.y, f.contactNormal.x) - Math.PI / 2
        bodyAxisAngle.set(f.bodyId, surfaceAngle)
      }
    }

    // 同步分解状态：新增的设为 in，移除的设为 out
    const decomMap = decomStatesRef.current
    for (const key of decomKeys) {
      const renderId = keyToRenderId.get(key) ?? key
      const bodyId = keyToBodyId.get(key) ?? ''
      const axisAngle = bodyAxisAngle.get(bodyId) ?? 0
      if (!decomMap.has(renderId)) {
        decomMap.set(renderId, { forceId: renderId, progress: 0, direction: 'in', axisAngle })
      } else {
        const s = decomMap.get(renderId)!
        if (s.direction === 'out') { s.direction = 'in' }
        s.axisAngle = axisAngle  // 实时更新（仿真时接触面可能变化）
      }
    }
    // 构建当前活跃的 renderId 集合
    const activeRenderIds = new Set<string>()
    for (const key of decomKeys) {
      activeRenderIds.add(keyToRenderId.get(key) ?? key)
    }
    for (const [renderId, s] of decomMap) {
      if (!activeRenderIds.has(renderId) && s.direction === 'in') {
        s.direction = 'out'
      }
    }
    // 推进动画
    let needsAnimFrame = false
    for (const [key, s] of decomMap) {
      const dt = 1 / 60
      if (s.direction === 'in') {
        s.progress = Math.min(1, s.progress + dt / 0.8)
        if (s.progress < 1) needsAnimFrame = true
      } else {
        s.progress = Math.max(0, s.progress - dt / 0.3)
        if (s.progress > 0) needsAnimFrame = true
        else decomMap.delete(key)
      }
    }
    const decomArg = decomMap.size > 0 ? decomMap : undefined

    if (currentMode === 'edit') {
      const selState = useSelectionStore.getState()
      const selBodyIds = selectedBodyIds(selState)
      const selJointIds = selectedJointIds(selState)
      const singleSelectedBodyId =
        selState.selected.length === 1 && selState.selected[0].type === 'body'
          ? selState.selected[0].id
          : null
      const hoveredId = hov?.type === 'body' ? hov.id : null
      const hoveredJointId = hov?.type === 'joint' ? hov.id : null
      const selectTool = tool as SelectTool
      const snapResult = selectTool.currentSnapResult ?? null
      const alignGuides = selectTool.currentAlignGuides ?? []
      const rotateIconState = selectTool.rotateIconState ?? 'default'
      const fm041EditVisual = buildFm041VisualOverrides(
        currentScene,
        fm041MotionStateRef.current,
        performance.now(),
      )
      const editBodyPoseOverrides = new Map(fm041EditVisual.overrides)
      const fm042EditVisual = buildFm042VisualOverrides(currentScene, performance.now())
      for (const [bodyId, pose] of fm042EditVisual) {
        editBodyPoseOverrides.set(bodyId, pose)
      }
      const displacementBody = singleSelectedBodyId
        ? (() => {
            const body = currentScene.bodies.find((item) => item.id === singleSelectedBodyId)
            const pose = editBodyPoseOverrides.get(singleSelectedBodyId)
            return body ? { label: body.label, position: pose?.position ?? body.position } : null
          })()
        : null

      // Force probe: compute all forces for edit mode
      if (isFm041Scene(currentScene) || currentScene !== lastProbedSceneRef.current) {
        syncSceneToWorld(currentScene, physicsBridge)
        const probedBodyStates = physicsBridge.getBodyStates()
        const baseForces = physicsBridge.probeForces(currentScene)
        const teachingForces = augmentForcesWithTeachingForces(currentScene, probedBodyStates, baseForces)
        const resultants = computeResultants(baseForces)
        probedForcesRef.current = [...teachingForces, ...resultants]
        lastProbedSceneRef.current = currentScene
      }
      // 始终同步 store（覆盖仿真残留数据等不一致情况）
      // 仅当 store 中的 availableForces 引用不同时才更新，避免不必要的 re-render
      if (useForceDisplayStore.getState().availableForces !== probedForcesRef.current) {
        useForceDisplayStore.getState().setAvailableForces(probedForcesRef.current, autoHiddenForceBodyIds)
      }

      // Filter forces by visibility (合力始终基于全部力计算，显隐独立控制)
      const manualOverrides = useForceDisplayStore.getState()._manualOverrides
      const visibleForces = probedForcesRef.current.filter((f) => {
        const key = forceKey(f)
        if (hidden.has(key)) return false
        if (autoHiddenForceBodyIds.has(f.bodyId) && !manualOverrides.has(key)) return false
        if (!fm041EditVisual.onDisk && f.bodyId === FM041_SLIDER_BODY_ID && (f.forceType === 'normal' || f.forceType === 'static_friction' || f.forceType === 'kinetic_friction' || f.forceType === 'friction')) {
          return false
        }
        return true
      })

      renderer.renderScene(ctx, currentScene.bodies, viewport, {
        selectedIds: selBodyIds, hoveredId, selectedJointIds: selJointIds, hoveredJointId,
        selectedForceId: selForceId, hoveredForceId: hovForceId,
        snapResult, alignGuides, rotateIconState,
        forceData: visibleForces,
        decompositions: decomArg,
        coordinateAxes: currentCoordinateAxes,
        displacementBody,
        bodyPoseOverrides: editBodyPoseOverrides,
      }, currentScene.joints)
      drawFm041RotationCue(ctx, viewport, currentScene, fm041EditVisual.diskTheta)
      drawFm042TeachingOverlay(ctx, viewport, currentScene, performance.now())

      tool.render(ctx, viewport)

      // Render drag preview (from ObjectPanel drag-over)
      if (_dragPreview) {
        renderer.renderDragPreview(ctx, _dragPreview.body, viewport)
      }
      if (_dragJointGuide) {
        drawDragJointGuide(ctx, viewport, _dragJointGuide)
      }
    } else {
      const simSelState = useSelectionStore.getState()
      const singleSelectedBodyId =
        simSelState.selected.length === 1 && simSelState.selected[0].type === 'body'
          ? simSelState.selected[0].id
          : null
      // 合力计算基于真实引擎力，不直接使用教学分解力，避免重复计入
      const allSimForces = forceDataRef.current
      const fm041SimVisual = buildFm041VisualOverrides(
        currentScene,
        fm041MotionStateRef.current,
        performance.now(),
      )

      // Filter sim forces by visibility
      // 默认隐藏类物体新产生的力（碰撞瞬间）可能还未被 setAvailableForces 处理，
      // 需要在渲染时额外检查：默认隐藏类 + 未被用户手动操作过 → 视为隐藏
      const manualOverrides = useForceDisplayStore.getState()._manualOverrides
      const visibleSimForces = allSimForces.filter((f) => {
        const key = forceKey(f)
        if (hidden.has(key)) return false
        // 默认隐藏类物体的力：未手动覆盖则默认隐藏
        if (autoHiddenForceBodyIds.has(f.bodyId) && !manualOverrides.has(key)) return false
        if (!fm041SimVisual.onDisk && f.bodyId === FM041_SLIDER_BODY_ID && (f.forceType === 'normal' || f.forceType === 'static_friction' || f.forceType === 'kinetic_friction' || f.forceType === 'friction')) {
          return false
        }
        return true
      })

      // 传入实时位姿覆盖（避免每帧克隆 sceneBodies）
      const bodyPoseOverrides = new Map<string, { position: { x: number; y: number }; angle: number }>()
      for (const bs of bodiesRef.current) {
        bodyPoseOverrides.set(bs.id, { position: bs.position, angle: bs.angle })
      }
      for (const [bodyId, pose] of fm041SimVisual.overrides) {
        bodyPoseOverrides.set(bodyId, pose)
      }
      const fm042SimVisual = buildFm042VisualOverrides(currentScene, performance.now())
      for (const [bodyId, pose] of fm042SimVisual) {
        bodyPoseOverrides.set(bodyId, pose)
      }
      const displacementBody = singleSelectedBodyId
        ? (() => {
            const sceneBody = currentScene.bodies.find((item) => item.id === singleSelectedBodyId)
            const pose = bodyPoseOverrides.get(singleSelectedBodyId)
            if (!sceneBody || !pose) return null
            return { label: sceneBody.label, position: pose.position }
          })()
        : null
      const analysisRuntime = useAnalysisStore.getState()
      const trajectoryPaths = buildTrajectoryPaths(
        analysisRuntime.frameHistory,
        currentScene.bodies,
        analysisRuntime.activeDataSourceIds,
      )

      renderer.render(
        ctx, bodiesRef.current, viewport, jointStatesRef.current,
        visibleSimForces.length > 0 ? visibleSimForces : undefined,
        {
          sceneBodies: currentScene.bodies,
          sceneJoints: currentScene.joints,
          selectedForceId: selForceId,
          hoveredForceId: hovForceId,
          decompositions: decomArg,
          bodyPoseOverrides,
          coordinateAxes: currentCoordinateAxes,
          displacementBody,
          trajectoryPaths,
        },
      )
      drawFm041RotationCue(ctx, viewport, currentScene, fm041SimVisual.diskTheta)
      drawFm042TeachingOverlay(ctx, viewport, currentScene, performance.now())

      // Throttle store updates during sim (every 10 frames)
      simFrameCountRef.current++
      if (simFrameCountRef.current % 10 === 0) {
        useForceDisplayStore.getState().setAvailableForces(allSimForces, autoHiddenForceBodyIds)
      }
    }

    // 标记是否需要动画帧（由外部 useEffect 消费）
    decomAnimatingRef.current = needsAnimFrame
  }, [])

  const syncTimelineUi = useCallback((index: number, snapshots: TimelineSnapshot[]) => {
    const safeIndex = Math.max(0, Math.min(index, Math.max(0, snapshots.length - 1)))
    const current = snapshots[safeIndex]?.t ?? 0
    const max = snapshots.length > 0 ? (snapshots[snapshots.length - 1]?.t ?? 0) : 0
    setTimelineCurrentTime(current)
    setPlaybackTimeline({
      currentTime: current,
      maxTime: max,
      snapshotCount: snapshots.length,
    })
  }, [setPlaybackTimeline])

  const pushTimelineSnapshot = useCallback((snapshot: TimelineSnapshot) => {
    const next = timelineSnapshotsRef.current
    next.push(snapshot)
    if (next.length > MAX_TIMELINE_SNAPSHOTS) {
      next.splice(0, next.length - MAX_TIMELINE_SNAPSHOTS)
    }
    syncTimelineUi(next.length - 1, next)
  }, [syncTimelineUi])

  const clearTimelineSnapshots = useCallback(() => {
    timelineSnapshotsRef.current = []
    lastSimFrameTsRef.current = null
    simAccumulatorRef.current = 0
    setTimelineCurrentTime(0)
    setPlaybackTimeline({
      currentTime: 0,
      maxTime: 0,
      snapshotCount: 0,
    })
  }, [setPlaybackTimeline])

  const findSnapshotIndexByTime = useCallback((targetTime: number) => {
    const snapshots = timelineSnapshotsRef.current
    if (snapshots.length === 0) return 0
    let nearest = 0
    let nearestDist = Math.abs((snapshots[0]?.t ?? 0) - targetTime)
    for (let i = 1; i < snapshots.length; i++) {
      const dist = Math.abs(snapshots[i].t - targetTime)
      if (dist < nearestDist) {
        nearest = i
        nearestDist = dist
      }
    }
    return nearest
  }, [])

  const applyTimelineSnapshot = useCallback((index: number, trimFuture: boolean) => {
    const next = timelineSnapshotsRef.current
    if (next.length === 0) return
    const safeIndex = Math.max(0, Math.min(index, next.length - 1))
    if (trimFuture && safeIndex < next.length - 1) {
      next.splice(safeIndex + 1)
    }
    const snapshot = next[safeIndex]
    physicsBridge.restoreFromBodyStates(snapshot.bodies)
    bodiesRef.current = cloneBodyStates(snapshot.bodies)
    jointStatesRef.current = physicsBridge.getJointStates()
    forceDataRef.current = cloneForceData(snapshot.forces)
    useAnalysisStore.getState().seekToTime(snapshot.t)
    syncTimelineUi(safeIndex, next)
    renderFrame()
  }, [renderFrame, syncTimelineUi])

  const handlePlayControl = useCallback(() => {
    const editor = useEditorStore.getState()
    if (editor.mode === 'edit') {
      startFromEditRef.current = true
      const currentScene = useSceneStore.getState().scene
      syncSceneToWorld(currentScene, physicsBridge)
      physicsBridge.saveSnapshot()
      timelineSnapshotsRef.current = []
      const initialBodies = physicsBridge.getBodyStates()
      pushTimelineSnapshot({
        t: 0,
        bodies: cloneBodyStates(initialBodies),
        forces: [],
      })
    } else {
      const snapshots = timelineSnapshotsRef.current
      if (snapshots.length > 0) {
        const seekIndex = findSnapshotIndexByTime(timelineCurrentTime)
        if (seekIndex < snapshots.length - 1) {
          snapshots.splice(seekIndex + 1)
          syncTimelineUi(seekIndex, snapshots)
          useAnalysisStore.getState().trimToTime(timelineCurrentTime)
        }
      }
      startFromEditRef.current = false
    }
    playSim()
  }, [findSnapshotIndexByTime, playSim, pushTimelineSnapshot, syncTimelineUi, timelineCurrentTime])

  const handlePauseControl = useCallback(() => {
    useAnalysisStore.getState().seekToTime(timelineCurrentTime)
    pauseSim()
  }, [pauseSim, timelineCurrentTime])

  const handleResetControl = useCallback(() => {
    physicsBridge.restoreSnapshot()
    stopSim()
    useAnalysisStore.getState().clearHistory()
    clearTimelineSnapshots()
    renderFrame()
  }, [clearTimelineSnapshots, renderFrame, stopSim])

  const handleStopControl = useCallback(() => {
    stopAtCurrentSim()
    useAnalysisStore.getState().seekToTime(timelineCurrentTime)
    const snapshots = timelineSnapshotsRef.current
    if (snapshots.length > 0) {
      const idx = findSnapshotIndexByTime(timelineCurrentTime)
      syncTimelineUi(idx, snapshots)
    }
    renderFrame()
  }, [findSnapshotIndexByTime, renderFrame, stopAtCurrentSim, syncTimelineUi, timelineCurrentTime])

  const handleTimelineChange = useCallback((nextTime: number) => {
    if (useEditorStore.getState().simState === 'playing') {
      cancelAnimationFrame(animFrameRef.current)
      pauseSim()
    }
    const nextIndex = findSnapshotIndexByTime(nextTime)
    applyTimelineSnapshot(nextIndex, false)
  }, [applyTimelineSnapshot, findSnapshotIndexByTime, pauseSim])

  useEffect(() => {
    setPlaybackHandlers({
      play: handlePlayControl,
      pause: handlePauseControl,
      stop: handleStopControl,
      reset: handleResetControl,
      seek: handleTimelineChange,
    })
    return () => setPlaybackHandlers(null)
  }, [handlePauseControl, handlePlayControl, handleResetControl, handleStopControl, handleTimelineChange, setPlaybackHandlers])

  // Simulation loop
  useEffect(() => {
    if (mode === 'simulate' && simState === 'playing') {
      const dt = 1 / 60
      const currentScene = useSceneStore.getState().scene
      const analysisState = useAnalysisStore.getState()

      // 区分首次播放 vs 暂停恢复
      const shouldInitialize = startFromEditRef.current || timelineSnapshotsRef.current.length === 0
      const isResume = !shouldInitialize && (prevSimStateRef.current === 'paused' || prevSimStateRef.current === 'stopped')
      prevSimStateRef.current = simState
      let simTime = analysisState.simTime

      if (!isResume) {
        // 首次播放（从 edit/stopped 进入）：初始化数据记录
        const initialPos = analysisRecorder.startRecording(currentScene)
        analysisState.clearHistory()
        analysisState.setInitialPositions(initialPos)
        // 仅当用户未手动勾选时，自动勾选所有可分析物体
        if (analysisState.activeDataSourceIds.size === 0) {
          analysisState.setDataSources(
            new Set(currentScene.bodies.filter(isAnalyzableBody).map(b => b.id)),
          )
        }
        simTime = 0
        const initialBodies = physicsBridge.getBodyStates()
        const initialFrame = analysisRecorder.recordInitialFrame(
          initialBodies,
          currentScene,
          analysisState.analysisGroups,
          [],
        )
        analysisState.pushFrame(initialFrame)
        if (timelineSnapshotsRef.current.length === 0) {
          pushTimelineSnapshot({
            t: 0,
            bodies: cloneBodyStates(initialBodies),
            forces: [],
          })
        } else {
          syncTimelineUi(timelineSnapshotsRef.current.length - 1, timelineSnapshotsRef.current)
        }
      }
      startFromEditRef.current = false
      lastSimFrameTsRef.current = null
      simAccumulatorRef.current = 0

      const loop = (timestamp: number) => {
        try {
          if (lastSimFrameTsRef.current === null) {
            lastSimFrameTsRef.current = timestamp
          }
          const elapsedSec = Math.min((timestamp - lastSimFrameTsRef.current) / 1000, 0.1)
          lastSimFrameTsRef.current = timestamp
          simAccumulatorRef.current += elapsedSec * playbackSpeed

          while (simAccumulatorRef.current >= dt) {
            const currentScene = useSceneStore.getState().scene
            // 1. 推进完整物理帧（含子步进、连续外力施加与接触冲量累计）
            physicsBridge.stepFrame(currentScene, dt)
            // 2. 获取物体状态（本帧后状态），并复用给力收集，避免重复分配
            const bodyStates = physicsBridge.getBodyStates()
            if (!isFiniteBodyStates(bodyStates)) {
              throw new Error('检测到非有限物体状态')
            }
            bodiesRef.current = bodyStates
            // 3. 收集所有力
            const collectedForces = physicsBridge.collectForces(currentScene, dt, bodyStates)
            const resultants = computeResultants(collectedForces)
            const teachingForces = augmentForcesWithTeachingForces(currentScene, bodyStates, collectedForces)
            const nextForces = [...teachingForces, ...resultants]
            if (!isFiniteForces(nextForces)) {
              throw new Error('检测到非有限受力数据')
            }
            forceDataRef.current = nextForces
            // 4. 获取约束状态
            jointStatesRef.current = physicsBridge.getJointStates()
            // 5. 碰撞事件检测
            const collisions = physicsBridge.getFrameCollisions()
            for (const c of collisions) {
              useAnalysisStore.getState().addCollisionEvent({
                t: simTime + dt,
                bodyIdA: c.bodyIdA,
                bodyIdB: c.bodyIdB,
                impulse: c.impulse,
              })
              // 碰撞前快照：取上一帧记录的 bodies 数据
              const { frameHistory } = useAnalysisStore.getState()
              if (frameHistory.length > 0) {
                const lastFrame = frameHistory[frameHistory.length - 1]
                useAnalysisStore.getState().setCollisionSnapshot(lastFrame.bodies)
              }
            }
            // 6. 数据记录（降采样 30fps）
            simTime += dt
            const analysisGroups = useAnalysisStore.getState().analysisGroups
            const frameRecord = analysisRecorder.recordFrame(
              simTime,
              bodiesRef.current,
              currentScene,
              dt,
              analysisGroups,
              forceDataRef.current,
            )
            if (frameRecord) {
              useAnalysisStore.getState().pushFrame(frameRecord)
            }
            // 7. 时间轨道快照
            pushTimelineSnapshot({
              t: simTime,
              bodies: cloneBodyStates(bodiesRef.current),
              forces: cloneForceData(forceDataRef.current),
            })
            simAccumulatorRef.current -= dt
          }

          // 10. 渲染
          renderFrame()
          animFrameRef.current = requestAnimationFrame(loop)
        } catch (error) {
          console.error('[Canvas] 仿真循环异常，已触发安全终止：', error)
          animFrameRef.current = 0
          stopAtCurrentSim()
          notifyWithCooldown(
            'simulation-fuse',
            'warning',
            '仿真已安全终止',
            '检测到异常数据，本次仿真已停止并保留当前画面。',
            5000,
          )
          renderFrame()
        }
      }
      animFrameRef.current = requestAnimationFrame(loop)
      return () => {
        cancelAnimationFrame(animFrameRef.current)
        lastSimFrameTsRef.current = null
        simAccumulatorRef.current = 0
      }
    } else {
      prevSimStateRef.current = simState
      lastSimFrameTsRef.current = null
      simAccumulatorRef.current = 0
      renderFrame()
    }
  }, [mode, notifyWithCooldown, playbackSpeed, pushTimelineSnapshot, renderFrame, simState, stopAtCurrentSim, syncTimelineUi])

  // Re-render on any state change that affects the canvas
  useEffect(() => {
    if (mode === 'edit' || simState !== 'playing') {
      renderFrame()
    }
  }, [offset, scale, canvasSize, mode, simState, scene, selected, hovered, selectedForceId, hoveredForceId, activeTool, hiddenForceKeys, decomposedForceKeys, coordinateAxes, renderFrame])

  // Decomposition animation loop (编辑模式/暂停时驱动渐入渐出)
  useEffect(() => {
    if (!decomAnimatingRef.current) return
    if (mode === 'simulate' && simState === 'playing') return // 播放模式已有循环
    const loop = () => {
      renderFrame()
      if (decomAnimatingRef.current) {
        decomAnimFrameRef.current = requestAnimationFrame(loop)
      }
    }
    decomAnimFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(decomAnimFrameRef.current)
  }, [decomposedForceKeys, mode, simState, renderFrame])

  useEffect(() => {
    if (!isFm041Scene(scene) && !isFm042Scene(scene)) return
    if (mode === 'simulate' && simState === 'playing') return

    const loop = () => {
      renderFrame()
      fm041AnimFrameRef.current = requestAnimationFrame(loop)
    }

    fm041AnimFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(fm041AnimFrameRef.current)
  }, [mode, renderFrame, scene, simState])

  // Build viewport for coordinate conversion
  const getViewport = useCallback(
    (): Viewport => ({
      offset: useViewportStore.getState().offset,
      scale: useViewportStore.getState().scale,
      canvasSize: useViewportStore.getState().canvasSize,
    }),
    [],
  )

  const createBodyAtCanvasCenter = useCallback((bodyType: BodyType) => {
    let desc
    try {
      desc = getBodyDescriptor(bodyType)
    } catch (error) {
      console.warn('[Canvas] 无法创建物体，类型无效：', bodyType, error)
      notifyWithCooldown('create-body-invalid-type', 'warning', '创建失败', '该物体类型暂不可用，请换一个物体。')
      return
    }

    const viewport = getViewport()
    const worldPos = screenToWorld(
      viewport.canvasSize.width / 2,
      viewport.canvasSize.height / 2,
      viewport,
    )
    const existingBodies = useSceneStore.getState().scene.bodies

    const newBody = {
      id: generateId(),
      type: desc.type,
      label: generateLabel(desc.type, existingBodies),
      position: worldPos,
      angle: 0,
      isStatic: false,
      fixedRotation: false,
      mass: 1,
      friction: 0.3,
      restitution: 0,
      initialVelocity: { x: 0, y: 0 },
      initialAcceleration: { x: 0, y: 0 },
      ...desc.defaults,
    } as SceneBody

    const snapResult = computeSnap(newBody, existingBodies, false)
    if (snapResult) {
      newBody.position = snapResult.position
      newBody.angle = snapResult.angle
    }

    useCommandStore.getState().execute(new AddBodyCommand(newBody))
    useSelectionStore.getState().select({ type: 'body', id: newBody.id })
  }, [getViewport, notifyWithCooldown])

  const hasUserContent =
    scene.bodies.some((body) => body.type !== 'ground') ||
    scene.joints.length > 0 ||
    scene.forces.length > 0

  // Build CanvasMouseEvent from React mouse event
  const buildCanvasMouseEvent = useCallback(
    (e: React.MouseEvent): CanvasMouseEvent => {
      const rect = canvasRef.current?.getBoundingClientRect()
      const screenPos = rect
        ? { x: e.clientX - rect.left, y: e.clientY - rect.top }
        : { x: e.clientX, y: e.clientY }
      const viewport = getViewport()
      const worldPos = screenToWorld(screenPos.x, screenPos.y, viewport)
      return {
        screenPos,
        worldPos,
        button: e.button,
        shiftKey: e.shiftKey,
        ctrlKey: e.ctrlKey || e.metaKey,
        altKey: e.altKey,
      }
    },
    [getViewport],
  )

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        spaceDownRef.current = true
        setCursor('grab')
        return
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (mode === 'edit') useCommandStore.getState().undo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'Z' || e.key === 'y')) {
        e.preventDefault()
        if (mode === 'edit') useCommandStore.getState().redo()
        return
      }

      // Delete all selected bodies/joints
      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Don't intercept Delete/Backspace when focus is in an input field
        const tag = (e.target as HTMLElement)?.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        if (mode === 'edit') {
          const selItems = useSelectionStore.getState().selected
          if (selItems.length === 0) return
          const scene = useSceneStore.getState().scene
          for (const sel of selItems) {
            if (sel.type === 'body') {
              const body = scene.bodies.find((b) => b.id === sel.id)
              if (body && getInteraction(body).canDelete) {
                const cmd = new RemoveBodyCommand(body)
                useCommandStore.getState().execute(cmd)
              }
            } else if (sel.type === 'joint') {
              const joint = scene.joints.find((j) => j.id === sel.id)
              if (joint) {
                const cmd = new RemoveJointCommand(joint)
                useCommandStore.getState().execute(cmd)
              }
            }
          }
          useSelectionStore.getState().clearSelection()
        }
        return
      }

      // Delegate to active tool
      if (mode === 'edit') {
        activeTool.onKeyDown(e)
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        spaceDownRef.current = false
        if (!isPanningRef.current) {
          setCursor(activeToolName === 'pan' ? 'grab' : 'default')
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [mode, activeTool, activeToolName])

  // Mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Panning: middle button or Space + left
      const wantsPan =
        e.button === 1 ||
        (e.button === 0 && (spaceDownRef.current || activeToolName === 'pan'))
      if (wantsPan) {
        e.preventDefault()
        isPanningRef.current = true
        lastMouseRef.current = { x: e.clientX, y: e.clientY }
        setCursor('grabbing')
        return
      }

      // Delegate to tool in edit mode
      if (mode === 'edit' && e.button === 0) {
        const cmEvent = buildCanvasMouseEvent(e)
        activeTool.onMouseDown(cmEvent)
      }
    },
    [mode, activeTool, activeToolName, buildCanvasMouseEvent],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        const dx = e.clientX - lastMouseRef.current.x
        const dy = e.clientY - lastMouseRef.current.y
        pan(dx, -dy)
        lastMouseRef.current = { x: e.clientX, y: e.clientY }
        return
      }

      if (mode === 'edit') {
        if (activeToolName === 'pan') {
          setCursor('grab')
          return
        }

        const cmEvent = buildCanvasMouseEvent(e)

        // 连接件卡片点击后，鼠标进入画布即启动引导创建流程
        const pendingJointType = consumePendingJointType()
        if (pendingJointType) {
          const toolStore = useToolStore.getState()
          toolStore.setJointSubType(pendingJointType)
          toolStore.setTool('joint')
          const jointTool = useToolStore.getState().activeTool
          if (jointTool instanceof JointTool) {
            jointTool.startGuidedCreation(cmEvent.worldPos)
            jointTool.onMouseMove(cmEvent)
          }
          setCursor('crosshair')
          renderFrame()
          return
        }

        activeTool.onMouseMove(cmEvent)
        // Sync cursor from tool
        if (!isPanningRef.current && !spaceDownRef.current) {
          setCursor(activeTool.cursor)
        }
        // Re-render to reflect tool visual state changes (e.g. rotate icon hover)
        renderFrame()
      }
    },
    [pan, mode, activeTool, activeToolName, buildCanvasMouseEvent, renderFrame],
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (isPanningRef.current) {
        isPanningRef.current = false
        setCursor(spaceDownRef.current || activeToolName === 'pan' ? 'grab' : 'default')
        return
      }

      if (mode === 'edit' && activeToolName !== 'pan') {
        const cmEvent = buildCanvasMouseEvent(e)
        activeTool.onMouseUp(cmEvent)
      }
    },
    [mode, activeTool, activeToolName, buildCanvasMouseEvent],
  )

  // Wheel zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1
      const newScale = scale * zoomFactor
      zoom(newScale, mouseX, mouseY)
    },
    [scale, zoom],
  )

  // Drag & Drop from ObjectPanel with live preview

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'

    // Throttle preview updates via rAF
    const clientX = e.clientX
    const clientY = e.clientY

    if (_dragRaf) return // already scheduled
    _dragRaf = requestAnimationFrame(() => {
      _dragRaf = 0
      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const viewport = getViewport()
      const worldPos = screenToWorld(clientX - rect.left, clientY - rect.top, viewport)

      const draggingJointType = getCurrentDragJointType()
      if (draggingJointType) {
        _dragPreview = null
        _dragJointGuide = {
          jointType: draggingJointType,
          screenX: clientX - rect.left,
          screenY: clientY - rect.top,
        }
        renderFrame()
        return
      }
      _dragJointGuide = null

      // Resolve body type from first dragOver (dataTransfer.getData returns '' during dragover in some browsers)
      const prev = _dragPreview
      if (!prev) return // bodyType not yet known, wait for dragEnter

      // Build preview body at mouse position
      const previewBody = {
        ...prev.body,
        position: worldPos,
        angle: 0,
      } as SceneBody

      // Compute snap for preview
      const allBodies = useSceneStore.getState().scene.bodies
      const snapResult = computeSnap(previewBody, allBodies, false)
      if (snapResult) {
        previewBody.position = snapResult.position
        previewBody.angle = snapResult.angle
      }

      _dragPreview = { bodyType: prev.bodyType, body: previewBody }
      renderFrame()
    })
  }, [getViewport, renderFrame])

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect()
    const draggingJointType = getCurrentDragJointType()
    if (rect && draggingJointType) {
      _dragPreview = null
      _dragJointGuide = {
        jointType: draggingJointType,
        screenX: e.clientX - rect.left,
        screenY: e.clientY - rect.top,
      }
      renderFrame()
      return
    }

    // getData returns '' during dragenter in most browsers; use module-level variable from ObjectPanel
    const bodyType = getCurrentDragBodyType()
    if (!bodyType) return

    if (_dragPreview?.bodyType === bodyType) return // already initialized

    try {
      const desc = getBodyDescriptor(bodyType as BodyType)
      const body = {
        id: '__preview__',
        type: desc.type,
        label: '',
        position: { x: 0, y: 0 },
        angle: 0,
        isStatic: false,
        fixedRotation: false,
        mass: 1,
        friction: 0.3,
        restitution: 0,
        initialVelocity: { x: 0, y: 0 },
        initialAcceleration: { x: 0, y: 0 },
        ...desc.defaults,
      } as SceneBody
      _dragPreview = { bodyType: bodyType as BodyType, body }
    } catch (error) {
      console.warn('[Canvas] 拖拽预览初始化失败：', bodyType, error)
      notifyWithCooldown(
        'drag-preview-init',
        'warning',
        '无法预览该物体',
        '请从左侧面板重新拖拽后重试。',
      )
    }
  }, [notifyWithCooldown, renderFrame])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear when actually leaving the canvas (not entering a child element)
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      _dragPreview = null
      _dragJointGuide = null
      if (_dragRaf) {
        cancelAnimationFrame(_dragRaf)
        _dragRaf = 0
      }
      renderFrame()
    }
  }, [renderFrame])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const jointType = (e.dataTransfer.getData('application/x-joint-type') as JointType) || getCurrentDragJointType()
      const bodyType = e.dataTransfer.getData('application/x-body-type') || getCurrentDragBodyType()

      // Use preview body position if available (zero-jump), otherwise fallback
      const preview = _dragPreview
      _dragPreview = null
      _dragJointGuide = null
      if (_dragRaf) {
        cancelAnimationFrame(_dragRaf)
        _dragRaf = 0
      }

      if (jointType) {
        setCurrentDragJointType(null)
        setCurrentDragBodyType(null)
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        const viewport = getViewport()
        const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, viewport)

        const toolStore = useToolStore.getState()
        toolStore.setJointSubType(jointType)
        toolStore.setTool('joint')
        const active = useToolStore.getState().activeTool
        if (active instanceof JointTool) {
          active.startGuidedCreation(worldPos)
        }
        setCursor('crosshair')
        renderFrame()
        return
      }

      if (!bodyType) return

      let desc
      try {
        desc = getBodyDescriptor(bodyType as BodyType)
      } catch (error) {
        console.warn('[Canvas] Drop 时物体类型无效：', bodyType, error)
        notifyWithCooldown(
          'drop-invalid-body-type',
          'warning',
          '添加失败',
          '未识别该物体类型，请从左侧面板重新拖拽。',
        )
        return
      }

      const existingBodies = useSceneStore.getState().scene.bodies

      const newBody = {
        id: generateId(),
        type: desc.type,
        label: generateLabel(desc.type, existingBodies),
        position: preview?.body.position ?? { x: 0, y: 0 },
        angle: preview?.body.angle ?? 0,
        isStatic: false,
        fixedRotation: false,
        mass: 1,
        friction: 0.3,
        restitution: 0,
        initialVelocity: { x: 0, y: 0 },
        initialAcceleration: { x: 0, y: 0 },
        ...desc.defaults,
      }

      // If no preview position, compute from drop event
      if (!preview) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (!rect) return
        const viewport = getViewport()
        const worldPos = screenToWorld(e.clientX - rect.left, e.clientY - rect.top, viewport)
        newBody.position = worldPos

        const allBodies = useSceneStore.getState().scene.bodies
        const snapResult = computeSnap(newBody, allBodies, false)
        if (snapResult) {
          newBody.position = snapResult.position
          newBody.angle = snapResult.angle
        }
      }

      const cmd = new AddBodyCommand(newBody)
      useCommandStore.getState().execute(cmd)
      useSelectionStore.getState().select({ type: 'body', id: newBody.id })
      setCurrentDragBodyType(null)
      setCurrentDragJointType(null)
    },
    [getViewport, notifyWithCooldown, renderFrame],
  )

  return (
    <div ref={containerRef} className="flex-1 overflow-hidden bg-white relative">
      <canvas
        ref={canvasRef}
        style={{ cursor }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={(e) => {
          if (isPanningRef.current) {
            isPanningRef.current = false
            setCursor(spaceDownRef.current || activeToolName === 'pan' ? 'grab' : 'default')
          }
          if (mode === 'edit' && activeToolName !== 'pan') {
            const cmEvent = buildCanvasMouseEvent(e)
            activeTool.onMouseUp(cmEvent)
          }
        }}
        onWheel={handleWheel}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => e.preventDefault()}
      />

      {mode === 'edit' && !hasUserContent && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
          <div
            className="pointer-events-auto rounded-lg px-5 py-4 max-w-sm w-full text-center"
            style={{
              backgroundColor: 'rgba(255,255,255,0.92)',
              boxShadow: EDITOR_CHROME.controlShadow,
            }}
          >
            <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
              开始搭建场景
            </div>
            <p className="mt-1.5 text-xs leading-relaxed mx-auto max-w-[280px]" style={{ color: COLORS.textSecondary }}>
              可以从左侧拖拽物体到画布；<br></br>也可点击下方按钮直接添加物体。
            </p>
            <div className="mt-3.5 flex items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="primary"
                onClick={() => createBodyAtCanvasCenter('block')}
                className="min-w-[92px] text-xs"
              >
                添加方块
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => createBodyAtCanvasCenter('ball')}
                className="min-w-[92px] text-xs"
              >
                添加小球
              </Button>
            </div>
          </div>
        </div>
      )}

      {mode === 'edit' && (
        <div className="absolute left-3 bottom-3 z-20 flex items-center gap-1.5">
          <Tip text="撤销">
            <button
              type="button"
              className="rounded-full inline-flex items-center justify-center transition-colors"
              onClick={undo}
              disabled={!canUndo}
              aria-label="撤销"
              title="撤销"
              style={{
                width: EDITOR_CHROME.controlSize,
                height: EDITOR_CHROME.controlSize,
                border: `${EDITOR_CHROME.controlBorderWidth}px solid ${COLORS.borderStrong}`,
                backgroundColor: canUndo ? COLORS.white : COLORS.bgMuted,
                color: canUndo ? COLORS.text : COLORS.textTertiary,
                cursor: canUndo ? 'pointer' : 'not-allowed',
                borderRadius: EDITOR_CHROME.controlRadius,
                boxShadow: EDITOR_CHROME.controlShadow,
              }}
            >
              <Undo2 size={14} />
            </button>
          </Tip>
          <Tip text="重做">
            <button
              type="button"
              className="rounded-full inline-flex items-center justify-center transition-colors"
              onClick={redo}
              disabled={!canRedo}
              aria-label="重做"
              title="重做"
              style={{
                width: EDITOR_CHROME.controlSize,
                height: EDITOR_CHROME.controlSize,
                border: `${EDITOR_CHROME.controlBorderWidth}px solid ${COLORS.borderStrong}`,
                backgroundColor: canRedo ? COLORS.white : COLORS.bgMuted,
                color: canRedo ? COLORS.text : COLORS.textTertiary,
                cursor: canRedo ? 'pointer' : 'not-allowed',
                borderRadius: EDITOR_CHROME.controlRadius,
                boxShadow: EDITOR_CHROME.controlShadow,
              }}
            >
              <Redo2 size={14} />
            </button>
          </Tip>
        </div>
      )}
    </div>
  )
}
