/* eslint-disable react-refresh/only-export-components */
import { COLORS, FEEDBACK_VISUAL } from '@/styles/tokens'
import { hexToRgba } from '@/lib/utils/color'
import { registerBodyType } from './registry'
import type { Viewport } from '@/renderer/CoordinateSystem'
import { worldToScreen } from '@/renderer/CoordinateSystem'

function GroundIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <line
        x1="2" y1="14" x2="18" y2="14"
        stroke={COLORS.borderStrong}
        strokeWidth="2"
      />
      {/* Hatching lines */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line
          key={i}
          x1={2 + i * 4} y1="14"
          x2={2 + i * 4 - 3} y2="18"
          stroke={COLORS.borderStrong}
          strokeWidth="0.8"
          opacity="0.5"
        />
      ))}
    </svg>
  )
}

/** Shared ground drawing: horizontal line + hatching below */
const GROUND_HALF_LENGTH = 10000

function drawGround(ctx: CanvasRenderingContext2D): void {
  const farW = GROUND_HALF_LENGTH
  ctx.save()
  ctx.strokeStyle = COLORS.dark
  ctx.lineWidth = 2
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(-farW, 0)
  ctx.lineTo(farW, 0)
  ctx.stroke()

  const hatchHeight = 200
  const hatchSpacing = 8
  ctx.beginPath()
  ctx.rect(-farW, 0, farW * 2, hatchHeight)
  ctx.clip()
  ctx.strokeStyle = hexToRgba(COLORS.dark, 0.45)
  ctx.lineWidth = 1
  for (let x = -farW; x < farW; x += hatchSpacing) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x - hatchHeight, hatchHeight)
    ctx.stroke()
  }
  ctx.restore()
}

registerBodyType({
  type: 'ground',
  label: '地面',
  category: 'support',

  defaults: {
    isStatic: true,
    fixedRotation: true,
    mass: 0,
    friction: 0.6,
    restitution: 0,
  },

  interaction: {
    canMove: 'vertical-only',
    canResize: false,
    canRotate: false,
    showRotateHandle: false,
    showResizeHandles: false,
    canDelete: false,
    canAlign: false,
    hoverCursor: 'ns-resize',
    hitTestPriority: -1, // lowest: other bodies take precedence
  },

  toShapeConfig: () => ({
    type: 'edge',
    x1: -GROUND_HALF_LENGTH,
    y1: 0,
    x2: GROUND_HALF_LENGTH,
    y2: 0,
  }),

  toDensity: () => 0,

  toPhysicsType: () => 'static',

  toUserData: () => ({ bodyType: 'ground' }),

  renderEdit: (ctx) => drawGround(ctx),

  renderSim: (ctx) => drawGround(ctx),

  getSelectionBounds: () => ({
    // Ground has no meaningful bounding box for handles
    halfW: 10000,
    halfH: 0,
  }),

  hitTest: (_lx, ly) => {
    // Hit if within 0.15m of the ground line (in body-local coords)
    return Math.abs(ly) < 0.15
  },

  getSnapSurfaces: (body) => {
    const groundY = body.position.y
    return [{
      type: 'rest' as const,
      start: { x: -GROUND_HALF_LENGTH, y: groundY },
      end: { x: GROUND_HALF_LENGTH, y: groundY },
      normal: { x: 0, y: 1 },
    }]
  },

  properties: [],

  icon: GroundIcon,
})

/**
 * Custom ground highlight rendering.
 * Called by CanvasRenderer for selected/hovered ground (since ground has no standard selection box).
 */
export function renderGroundHighlight(
  ctx: CanvasRenderingContext2D,
  groundY: number,
  viewport: Viewport,
  isSelected: boolean,
): void {
  const { canvasSize } = viewport
  const groundScreen = worldToScreen(0, groundY, viewport)

  ctx.save()
  ctx.strokeStyle = FEEDBACK_VISUAL.selectedColor
  ctx.lineWidth = isSelected ? FEEDBACK_VISUAL.lineWidth.selected : FEEDBACK_VISUAL.lineWidth.hover
  if (!isSelected) ctx.setLineDash([...FEEDBACK_VISUAL.outlineDash])
  ctx.beginPath()
  ctx.moveTo(0, groundScreen.y)
  ctx.lineTo(canvasSize.width, groundScreen.y)
  ctx.stroke()
  ctx.restore()
}
