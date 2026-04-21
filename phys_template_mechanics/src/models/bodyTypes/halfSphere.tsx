/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { drawHatching } from '@/renderer/hatching'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function HalfSphereIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <path
        d="M 3 15 A 7 7 0 0 1 17 15"
        fill="none"
        stroke={COLORS.border}
        strokeWidth="2"
      />
      <line x1="3" y1="15" x2="17" y2="15" stroke={COLORS.border} strokeWidth="1.5" />
    </svg>
  )
}

function renderHalfSphereCommon(
  ctx: CanvasRenderingContext2D,
  radius: number,
  options: { fillAlpha?: number; showHatching: boolean; strokeColor?: string; fillColor?: string },
): void {
  const origAlpha = ctx.globalAlpha
  const origLineWidth = ctx.lineWidth
  const origStrokeStyle = ctx.strokeStyle
  const origFillStyle = ctx.fillStyle
  const hatchColor = options.strokeColor ?? (typeof ctx.strokeStyle === 'string' ? ctx.strokeStyle : COLORS.dark)
  ctx.strokeStyle = options.strokeColor ?? COLORS.dark
  ctx.fillStyle = options.fillColor ?? COLORS.white
  if (options.fillAlpha !== undefined) ctx.globalAlpha = options.fillAlpha

  ctx.beginPath()
  ctx.moveTo(-radius, 0)
  ctx.arc(0, 0, radius, Math.PI, Math.PI * 2, false)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = origAlpha

  ctx.beginPath()
  ctx.moveTo(-radius, 0)
  ctx.arc(0, 0, radius, Math.PI, Math.PI * 2, false)
  ctx.closePath()
  ctx.stroke()

  ctx.lineWidth = Math.max(ctx.lineWidth, 3)
  ctx.beginPath()
  ctx.moveTo(-radius, 0)
  ctx.arc(0, 0, radius, Math.PI, Math.PI * 2, false)
  ctx.stroke()
  ctx.lineWidth = origLineWidth

  if (options.showHatching) {
    drawHatching(ctx, -radius, 0, radius, 0, 0, 1, { length: 6, spacing: 4, color: hatchColor })
  }

  ctx.strokeStyle = origStrokeStyle
  ctx.fillStyle = origFillStyle
}

registerBodyType({
  type: 'half-sphere',
  label: '半球',
  category: 'surface',

  defaults: {
    halfSphereRadius: 3.75,
    isStatic: true,
    fixedRotation: true,
    mass: 8,
    friction: 0.35,
    restitution: 0,
  },

  interaction: {
    canRotate: false,
    showRotateHandle: false,
  },

  toShapeConfig: (body) => {
    const r = body.halfSphereRadius ?? 3.75
    const segments = 24
    const vertices: Array<{ x: number; y: number }> = []
    for (let i = 0; i <= segments; i++) {
      const theta = Math.PI - (i * Math.PI) / segments
      vertices.push({ x: r * Math.cos(theta), y: r * Math.sin(theta) })
    }
    return { type: 'chain', vertices, loop: false }
  },

  toDensity: () => 0,

  toPhysicsType: () => 'static',

  toUserData: (body) => ({
    bodyType: 'half-sphere',
    halfSphereRadius: body.halfSphereRadius ?? 3.75,
  }),

  renderEdit: (ctx, body, scale) => {
    const radius = (body.halfSphereRadius ?? 3.75) * scale
    renderHalfSphereCommon(ctx, radius, {
      fillAlpha: 1,
      showHatching: true,
      strokeColor: COLORS.dark,
      fillColor: COLORS.white,
    })
  },

  renderSelectionOutline: (ctx, body, scale) => {
    const radius = (body.halfSphereRadius ?? 3.75) * scale
    const strokeColor = typeof ctx.strokeStyle === 'string' ? ctx.strokeStyle : COLORS.info
    renderHalfSphereCommon(ctx, radius, {
      fillAlpha: 0,
      showHatching: false,
      strokeColor,
      fillColor: 'rgba(255, 255, 255, 0)',
    })
  },

  renderSim: (ctx, bodyState, scale) => {
    const ud = bodyState.userData as Record<string, unknown> | undefined
    const radius = ((ud?.halfSphereRadius as number) ?? 3.75) * scale
    renderHalfSphereCommon(ctx, radius, {
      fillAlpha: 1,
      showHatching: bodyState.type === 'static',
      strokeColor: COLORS.dark,
      fillColor: COLORS.white,
    })
  },

  resizeMode: 'uniform',

  getLocalBBox: (body) => {
    const r = body.halfSphereRadius ?? 3.75
    return { centerOffsetX: 0, centerOffsetY: -r / 2, halfW: r, halfH: r / 2 }
  },

  applyResize: (body, newHalfW, newHalfH) => {
    const origR = body.halfSphereRadius ?? 3.75
    const rFromW = newHalfW
    const rFromH = newHalfH * 2
    const newR = Math.abs(rFromW - origR) > Math.abs(rFromH - origR) ? rFromW : rFromH
    return { halfSphereRadius: Math.max(0.3, newR) }
  },

  getSelectionBounds: (body, scale) => {
    const raw = (body.halfSphereRadius ?? 3.75) * scale
    if (scale <= 10) return { halfW: raw, halfH: raw / 2 }
    const r = Math.max(raw, 4)
    return { halfW: r, halfH: r / 2 }
  },

  hitTest: (lx, ly, body) => {
    const r = body.halfSphereRadius ?? 3.75
    if (ly < 0 || ly > r) return false
    return lx * lx + ly * ly <= r * r
  },

  getSnapSurfaces: (body) => {
    const r = body.halfSphereRadius ?? 3.75
    const topHalf = Math.max(r * 0.15, 0.06)
    const { x, y } = body.position
    const a = body.angle
    return [
      createSnapSurface('rest', { x: -topHalf, y: r }, { x: topHalf, y: r }, x, y, a, { x: 0, y: 1 }),
      createSnapSurface('contact', { x: -r, y: 0 }, { x: r, y: 0 }, x, y, a, { x: 0, y: -1 }),
    ]
  },

  properties: [
    { key: 'halfSphereRadius', label: '半径 (m)', type: 'number', step: 0.1, min: 0.3 },
  ],

  icon: HalfSphereIcon,
})
