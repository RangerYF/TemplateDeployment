import type { FC } from 'react'
import type { SceneBody, BodyType } from '../types'
import type { ShapeConfig, BodyConfig, BodyState } from '@/engine/types'
import type { SnapSurface } from '@/core/snap/types'

export interface PropertyDef {
  key: keyof SceneBody
  label: string
  type: 'number' | 'select'
  min?: number
  max?: number
  step?: number
  options?: Array<{ value: string; label: string }>
  /** Transform stored value to display value (e.g., radians to degrees) */
  toDisplay?: (value: number) => number
  /** Transform display value to stored value (e.g., degrees to radians) */
  fromDisplay?: (displayValue: number) => number
}

// --- Interaction capability ---

export interface InteractionCapability {
  /** 是否可选中，默认 true */
  selectable?: boolean
  /** 移动约束：true=自由移动, false=不可移动, 'vertical-only'/'horizontal-only' */
  canMove?: boolean | 'vertical-only' | 'horizontal-only'
  /** 是否可缩放，默认 true */
  canResize?: boolean
  /** 是否可旋转，默认 true */
  canRotate?: boolean
  /** 是否显示旋转手柄，默认 true */
  showRotateHandle?: boolean
  /** 是否显示缩放手柄，默认 true */
  showResizeHandles?: boolean
  /** 是否可删除，默认 true */
  canDelete?: boolean
  /** 是否参与对齐（作为参考），默认 true */
  canAlign?: boolean
  /** hover 时的鼠标样式，默认 'move' */
  hoverCursor?: string
  /** hitTest 优先级：数值越大越先被选中。默认 0，ground=-1 */
  hitTestPriority?: number
}

/** Resolved interaction with all defaults filled in */
export type ResolvedInteraction = Required<InteractionCapability>

const DEFAULT_INTERACTION: ResolvedInteraction = {
  selectable: true,
  canMove: true,
  canResize: true,
  canRotate: true,
  showRotateHandle: true,
  showResizeHandles: true,
  canDelete: true,
  canAlign: true,
  hoverCursor: 'move',
  hitTestPriority: 0,
}

/** Resolve interaction capabilities by merging descriptor declaration with defaults */
export function getInteraction(body: SceneBody): ResolvedInteraction {
  const desc = _getDescriptor(body.type)
  if (!desc) return { ...DEFAULT_INTERACTION }
  const declared = desc.interaction ?? {}
  return { ...DEFAULT_INTERACTION, ...declared }
}

/** Internal: get descriptor without throwing. Set by registry.ts at init time to break circular import. */
let _getDescriptor: (type: BodyType) => BodyTypeDescriptor | undefined = () => undefined

/** @internal Called by registry.ts to wire up the lookup function */
export function _setDescriptorLookup(fn: (type: BodyType) => BodyTypeDescriptor | undefined): void {
  _getDescriptor = fn
}

// --- Resize system ---

export interface LocalBBox {
  /** body origin 到 bbox 中心的屏幕坐标偏移（Y-down） */
  centerOffsetX: number
  centerOffsetY: number
  /** bbox 半宽（物理单位，米） */
  halfW: number
  /** bbox 半高（物理单位，米） */
  halfH: number
}

export type ResizeMode = 'independent' | 'uniform' | 'radius'

export interface BodyTypeDescriptor {
  type: BodyType
  label: string
  category: 'basic' | 'support' | 'mechanism' | 'surface'

  /** Default property values for newly created bodies of this type */
  defaults: Partial<SceneBody>

  /** 交互能力声明，SelectTool 读取此配置决定行为 */
  interaction?: InteractionCapability

  // --- Physics mapping (sceneSync) ---
  toShapeConfig(body: SceneBody): ShapeConfig | ShapeConfig[]
  toDensity(body: SceneBody): number
  toPhysicsType?(body: SceneBody): 'static' | 'dynamic' | 'kinematic'
  toUserData?(body: SceneBody): BodyConfig['userData']

  // --- Rendering (CanvasRenderer) ---
  /** Draw the body shape in edit mode. ctx is already translated/rotated with common styles set. */
  renderEdit(ctx: CanvasRenderingContext2D, body: SceneBody, scale: number, isSelected?: boolean): void
  /** Optional overlay outline used for hover/selected rendering in edit mode. */
  renderSelectionOutline?(ctx: CanvasRenderingContext2D, body: SceneBody, scale: number): void
  /** Optional custom rendering in simulation mode. If not provided, uses generic shape rendering. */
  renderSim?(ctx: CanvasRenderingContext2D, bodyState: BodyState, scale: number): void

  // --- Selection bounds ---
  getSelectionBounds(body: SceneBody, scale: number): { halfW: number; halfH: number }

  // --- HitTest (localX/localY are in body-local coordinates) ---
  hitTest(localX: number, localY: number, body: SceneBody): boolean

  // --- Snap surfaces (for surface snapping in edit mode) ---
  /** Return snap surfaces in world coordinates for this body */
  getSnapSurfaces?(body: SceneBody): SnapSurface[]

  // --- Resize ---
  /** 缩放模式。默认 'independent'（双轴独立，如 block） */
  resizeMode?: ResizeMode
  /** 获取局部 bbox（物理单位） */
  getLocalBBox?(body: SceneBody): LocalBBox
  /** 给定新的 bbox 尺寸，返回需 merge 的 body props */
  applyResize?(body: SceneBody, newHalfW: number, newHalfH: number): Partial<SceneBody> | null

  // --- Property panel ---
  properties: PropertyDef[]

  // --- Icon for ObjectPanel ---
  icon: FC<{ size: number }>
}
