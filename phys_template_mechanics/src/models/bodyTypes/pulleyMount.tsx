/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { drawHatching } from '@/renderer/hatching'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function getPulleyMountGeometry(radius: number) {
  const wallHalf = radius * 2
  const wallOffset = radius * 2.2

  return {
    wallCenter: { x: 0, y: wallOffset },
    wallDir: { x: 1, y: 0 },
    hatchNormal: { x: 0, y: 1 },
    contactStart: { x: -wallHalf, y: wallOffset },
    contactEnd: { x: wallHalf, y: wallOffset },
    contactNormal: { x: 0, y: 1 },
    strutEnd: { x: 0, y: radius },
  }
}

function renderPulleyMountCommon(
  ctx: CanvasRenderingContext2D,
  radius: number,
  scale: number,
  options: { color: string; showHatching: boolean },
) {
  const r = Math.max(radius * scale, 6)
  const geometry = getPulleyMountGeometry(radius)
  const wallCenterX = geometry.wallCenter.x * scale
  const wallCenterY = -geometry.wallCenter.y * scale
  const wallHalf = Math.max(
    Math.hypot(
      geometry.contactEnd.x - geometry.contactStart.x,
      geometry.contactEnd.y - geometry.contactStart.y,
    ) * scale / 2,
    12,
  )
  const wallDx = geometry.wallDir.x
  const wallDy = -geometry.wallDir.y
  const hatchNormalX = geometry.hatchNormal.x
  const hatchNormalY = -geometry.hatchNormal.y
  const strutEndX = geometry.strutEnd.x * scale
  const strutEndY = -geometry.strutEnd.y * scale

  ctx.save()
  ctx.strokeStyle = options.color
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(wallCenterX - wallDx * wallHalf, wallCenterY - wallDy * wallHalf)
  ctx.lineTo(wallCenterX + wallDx * wallHalf, wallCenterY + wallDy * wallHalf)
  ctx.stroke()
  ctx.restore()

  if (options.showHatching) {
    drawHatching(
      ctx,
      wallCenterX - wallDx * wallHalf, wallCenterY - wallDy * wallHalf,
      wallCenterX + wallDx * wallHalf, wallCenterY + wallDy * wallHalf,
      hatchNormalX, hatchNormalY,
    )
  }

  ctx.strokeStyle = options.color
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(wallCenterX, wallCenterY)
  ctx.lineTo(strutEndX, strutEndY)
  ctx.stroke()

  ctx.lineWidth = 2.5
  ctx.strokeStyle = options.color
  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = options.color
  ctx.beginPath()
  ctx.arc(0, 0, Math.max(r * 0.2, 2), 0, Math.PI * 2)
  ctx.fill()
}

function PulleyMountIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <circle
        cx="10" cy="11" r="6"
        fill="none"
        stroke={COLORS.border}
        strokeWidth="2"
      />
      <circle cx="10" cy="11" r="2" fill={COLORS.dark} />
      <polygon
        points="7,3 13,3 10,5"
        fill={COLORS.borderStrong}
      />
    </svg>
  )
}

registerBodyType({
  type: 'pulley-mount',
  label: '滑轮座',
  category: 'support',

  defaults: {
    pulleyRadius: 0.3,
    isStatic: true,
    fixedRotation: true,
    mass: 1,
    friction: 0.1,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const r = body.pulleyRadius ?? 0.15
    return { type: 'circle', radius: r }
  },

  toDensity: (body) => {
    const r = body.pulleyRadius ?? 0.15
    return body.isStatic ? 0 : body.mass / (Math.PI * r * r)
  },

  renderEdit: (ctx, body, scale, isSelected) => {
    const radius = body.pulleyRadius ?? 0.3
    void isSelected
    renderPulleyMountCommon(ctx, radius, scale, {
      color: COLORS.dark,
      showHatching: true,
    })
  },

  renderSelectionOutline: (ctx, body, scale) => {
    const radius = body.pulleyRadius ?? 0.3
    const color = typeof ctx.strokeStyle === 'string' ? ctx.strokeStyle : COLORS.info
    renderPulleyMountCommon(ctx, radius, scale, {
      color,
      showHatching: false,
    })
  },

  resizeMode: 'radius',

  getLocalBBox: (body) => {
    const r = body.pulleyRadius ?? 0.3
    return { centerOffsetX: 0, centerOffsetY: 0, halfW: r, halfH: r }
  },

  applyResize: (_body, newHalfW) => ({ pulleyRadius: newHalfW }),

  getSelectionBounds: (body, scale) => {
    const raw = (body.pulleyRadius ?? 0.3) * scale
    if (scale <= 10) return { halfW: raw, halfH: raw }
    const r = Math.max(raw, 6)
    // Normal rendering/handle scale: circle-only bounds (matches ball behavior)
    if (scale <= 500) return { halfW: r, halfH: r }
    // Thumbnail (REF_SCALE=1000): full visual bounds including wall/strut
    const geometry = getPulleyMountGeometry(body.pulleyRadius ?? 0.3)
    const wallHalf = Math.hypot(
      geometry.contactEnd.x - geometry.contactStart.x,
      geometry.contactEnd.y - geometry.contactStart.y,
    ) * scale / 2
    const wallOffset = geometry.wallCenter.y * scale
    return { halfW: wallHalf, halfH: wallOffset }
  },

  hitTest: (lx, ly, body) => {
    // Cover full visual extent: wheel + strut + wall decorations
    const r = body.pulleyRadius ?? 0.3
    const extent = Math.max(r * 2, 0.6)
    return Math.abs(lx) <= extent && Math.abs(ly) <= extent
  },

  getSnapSurfaces: (body) => {
    const geometry = getPulleyMountGeometry(body.pulleyRadius ?? 0.3)
    const { x, y } = body.position
    const a = body.angle

    return [
      createSnapSurface(
        'contact',
        geometry.contactStart,
        geometry.contactEnd,
        x,
        y,
        a,
        geometry.contactNormal,
      ),
    ]
  },

  properties: [
    { key: 'pulleyRadius', label: '半径 (m)', type: 'number', step: 0.01, min: 0.05 },
  ],

  icon: PulleyMountIcon,
})
