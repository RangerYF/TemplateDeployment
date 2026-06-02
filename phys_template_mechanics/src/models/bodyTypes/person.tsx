/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function PersonIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <circle cx="10" cy="4" r="2" fill="none" stroke={COLORS.border} strokeWidth="1.5" />
      <line x1="10" y1="6" x2="10" y2="13" stroke={COLORS.border} strokeWidth="1.5" />
      <line x1="6" y1="9" x2="14" y2="9" stroke={COLORS.border} strokeWidth="1.5" />
      <line x1="10" y1="13" x2="7" y2="18" stroke={COLORS.border} strokeWidth="1.5" />
      <line x1="10" y1="13" x2="13" y2="18" stroke={COLORS.border} strokeWidth="1.5" />
    </svg>
  )
}

function drawPerson(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const headR = Math.min(w * 0.35, h * 0.12)
  const headY = -h / 2 + headR + h * 0.02
  const neckY = headY + headR
  const shoulderY = neckY + h * 0.05
  const hipY = h * 0.1
  const footY = h / 2

  const armSpan = w * 0.4
  const legSpan = w * 0.3

  const origLineWidth = ctx.lineWidth
  ctx.lineWidth = Math.max(2, w * 0.06)

  ctx.beginPath()
  ctx.arc(0, headY, headR, 0, Math.PI * 2)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(0, neckY)
  ctx.lineTo(0, hipY)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-armSpan, shoulderY + h * 0.08)
  ctx.lineTo(0, shoulderY)
  ctx.lineTo(armSpan, shoulderY + h * 0.08)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(-legSpan, footY)
  ctx.lineTo(0, hipY)
  ctx.lineTo(legSpan, footY)
  ctx.stroke()

  ctx.lineWidth = origLineWidth
}

registerBodyType({
  type: 'person',
  label: '人',
  category: 'basic',

  defaults: {
    width: 0.5,
    height: 1.0,
    mass: 1,
    friction: 0,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const w = body.width ?? 0.5
    const h = body.height ?? 1.0
    return { type: 'box', width: w, height: h }
  },

  toDensity: (body) => {
    const w = body.width ?? 0.5
    const h = body.height ?? 1.0
    return body.isStatic ? 0 : body.mass / (w * h)
  },

  renderEdit: (ctx, body, scale) => {
    const w = (body.width ?? 0.5) * scale
    const h = (body.height ?? 1.0) * scale
    drawPerson(ctx, w, h)
  },

  renderSim: (ctx, bodyState, scale) => {
    const ud = bodyState.userData as Record<string, unknown> | undefined
    const w = ((ud?.width as number) ?? 0.5) * scale
    const h = ((ud?.height as number) ?? 1.0) * scale
    drawPerson(ctx, w, h)
  },

  toUserData: (body) => ({
    bodyType: 'person',
    width: body.width ?? 0.5,
    height: body.height ?? 1.0,
  }),

  getLocalBBox: (body) => ({
    centerOffsetX: 0, centerOffsetY: 0,
    halfW: (body.width ?? 0.5) / 2, halfH: (body.height ?? 1.0) / 2,
  }),

  applyResize: (_body, newHalfW, newHalfH) => ({
    width: newHalfW * 2, height: newHalfH * 2,
  }),

  getSelectionBounds: (body, scale) => ({
    halfW: ((body.width ?? 0.5) * scale) / 2,
    halfH: ((body.height ?? 1.0) * scale) / 2,
  }),

  hitTest: (lx, ly, body) => {
    const halfW = (body.width ?? 0.5) / 2
    const halfH = (body.height ?? 1.0) / 2
    return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH
  },

  getSnapSurfaces: (body) => {
    const w = body.width ?? 0.5
    const h = body.height ?? 1.0
    const halfW = w / 2
    const halfH = h / 2
    const { x, y } = body.position
    const a = body.angle
    return [
      createSnapSurface('rest', { x: -halfW, y: halfH }, { x: halfW, y: halfH }, x, y, a, { x: 0, y: 1 }),
      createSnapSurface('contact', { x: -halfW, y: -halfH }, { x: halfW, y: -halfH }, x, y, a, { x: 0, y: -1 }),
    ]
  },

  properties: [
    { key: 'width', label: '宽度 (m)', type: 'number', step: 0.1, min: 0.1 },
    { key: 'height', label: '高度 (m)', type: 'number', step: 0.1, min: 0.1 },
  ],

  icon: PersonIcon,
})
