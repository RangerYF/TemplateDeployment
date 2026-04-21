/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { hexToRgba } from '@/lib/utils/color'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function ConveyorIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <rect
        x="1" y="8" width="18" height="5" rx="1"
        fill={`${COLORS.bgMuted}cc`}
        stroke={COLORS.border}
        strokeWidth="1.5"
      />
      <polygon points="6,6 9,7 6,8" fill={COLORS.border} />
      <polygon points="11,6 14,7 11,8" fill={COLORS.border} />
    </svg>
  )
}

function renderConveyorCommon(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  speed: number,
  animated: boolean,
) {
  const rollerR = h / 2
  const beltStroke = ctx.strokeStyle
  const lineColor = typeof beltStroke === 'string' ? beltStroke : COLORS.dark
  const beltLeft = -w / 2 + rollerR
  const beltRight = w / 2 - rollerR

  // 1. Belt surface (rectangle between rollers)
  ctx.beginPath()
  ctx.rect(beltLeft, -h / 2, beltRight - beltLeft, h)
  ctx.fill()
  ctx.stroke()

  // 2. Vertical dashed segment dividers on belt
  ctx.save()
  ctx.beginPath()
  ctx.rect(beltLeft, -h / 2, beltRight - beltLeft, h)
  ctx.clip()

  const segSpacing = Math.max(18, h * 2)
  const animOffset = animated
    ? ((Date.now() / 1000) * speed * 15) % segSpacing
    : 0

  ctx.strokeStyle = hexToRgba(lineColor, 0.35)
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])
  const startX = beltLeft - segSpacing + animOffset
  for (let x = startX; x <= beltRight + segSpacing; x += segSpacing) {
    ctx.beginPath()
    ctx.moveTo(x, -h / 2)
    ctx.lineTo(x, h / 2)
    ctx.stroke()
  }
  ctx.setLineDash([])

  // 3. Direction arrows on belt surface (triangles inside belt)
  const dir = speed >= 0 ? 1 : -1
  const arrowH = Math.min(h * 0.4, 6)
  const arrowW = arrowH * 0.9
  ctx.fillStyle = lineColor
  for (let x = startX + segSpacing / 2; x <= beltRight; x += segSpacing) {
    ctx.beginPath()
    ctx.moveTo(x + dir * arrowW, 0)
    ctx.lineTo(x - dir * arrowW * 0.5, -arrowH)
    ctx.lineTo(x - dir * arrowW * 0.5, arrowH)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // 4. End rollers (circles with cross axis)
  for (const rx of [-w / 2 + rollerR, w / 2 - rollerR]) {
    // Roller body
    ctx.fillStyle = hexToRgba(COLORS.white, 0.95)
    ctx.beginPath()
    ctx.arc(rx, 0, rollerR, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = beltStroke
    ctx.lineWidth = 2
    ctx.stroke()

    // Cross axis (+ shape)
    const crossR = rollerR * 0.55
    ctx.strokeStyle = lineColor
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(rx - crossR, 0)
    ctx.lineTo(rx + crossR, 0)
    ctx.moveTo(rx, -crossR)
    ctx.lineTo(rx, crossR)
    ctx.stroke()
  }
}

function renderConveyorOutline(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
) {
  const rollerR = h / 2
  const beltLeft = -w / 2 + rollerR
  const beltRight = w / 2 - rollerR

  ctx.beginPath()
  ctx.rect(beltLeft, -h / 2, beltRight - beltLeft, h)
  ctx.stroke()

  for (const rx of [-w / 2 + rollerR, w / 2 - rollerR]) {
    ctx.beginPath()
    ctx.arc(rx, 0, rollerR, 0, Math.PI * 2)
    ctx.stroke()
  }
}

registerBodyType({
  type: 'conveyor',
  label: '传送带',
  category: 'surface',

  defaults: {
    conveyorWidth: 11.25,
    conveyorHeight: 1.2,
    beltSpeed: 2.0,
    mass: 10,
    friction: 0.5,
    restitution: 0,
  },

  // Conveyor is always static in physics (belt speed via setTangentSpeed requires it),
  // but isStatic stays false in editor so it renders with normal (non-gray) styling.
  toPhysicsType: () => 'static',

  toShapeConfig: (body) => {
    const w = body.conveyorWidth ?? 11.25
    const h = body.conveyorHeight ?? 1.2
    return { type: 'box', width: w, height: h }
  },

  toDensity: (body) => {
    const w = body.conveyorWidth ?? 11.25
    const h = body.conveyorHeight ?? 1.2
    return body.isStatic ? 0 : body.mass / (w * h)
  },

  toUserData: (body) => ({
    bodyType: 'conveyor',
    beltSpeed: body.beltSpeed ?? 2.0,
  }),

  renderEdit: (ctx, body, scale) => {
    const w = (body.conveyorWidth ?? 11.25) * scale
    const h = (body.conveyorHeight ?? 1.2) * scale
    const speed = body.beltSpeed ?? 2.0
    renderConveyorCommon(ctx, w, h, speed, false)
  },

  renderSelectionOutline: (ctx, body, scale) => {
    const w = (body.conveyorWidth ?? 11.25) * scale
    const h = (body.conveyorHeight ?? 1.2) * scale
    renderConveyorOutline(ctx, w, h)
  },

  renderSim: (ctx, bodyState, scale) => {
    if (bodyState.shape.type !== 'box') return
    ctx.fillStyle = hexToRgba(COLORS.white, 0.96)
    ctx.strokeStyle = COLORS.dark
    const w = bodyState.shape.width * scale
    const h = bodyState.shape.height * scale
    const beltSpeed = bodyState.userData?.beltSpeed ?? 2.0
    renderConveyorCommon(ctx, w, h, beltSpeed, true)
  },

  getLocalBBox: (body) => ({
    centerOffsetX: 0, centerOffsetY: 0,
    halfW: (body.conveyorWidth ?? 11.25) / 2, halfH: (body.conveyorHeight ?? 1.2) / 2,
  }),

  applyResize: (_body, newHalfW, newHalfH) => ({
    conveyorWidth: newHalfW * 2, conveyorHeight: newHalfH * 2,
  }),

  getSelectionBounds: (body, scale) => ({
    halfW: ((body.conveyorWidth ?? 11.25) * scale) / 2,
    halfH: ((body.conveyorHeight ?? 1.2) * scale) / 2,
  }),

  hitTest: (lx, ly, body) => {
    const halfW = (body.conveyorWidth ?? 11.25) / 2
    const halfH = (body.conveyorHeight ?? 1.2) / 2
    return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH
  },

  getSnapSurfaces: (body) => {
    const w = body.conveyorWidth ?? 11.25
    const h = body.conveyorHeight ?? 1.2
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
    { key: 'conveyorWidth', label: '宽度 (m)', type: 'number', step: 0.5, min: 1 },
    { key: 'conveyorHeight', label: '厚度 (m)', type: 'number', step: 0.05, min: 0.1 },
    { key: 'beltSpeed', label: '皮带速度 (m/s)', type: 'number', step: 0.5 },
  ],

  icon: ConveyorIcon,
})
