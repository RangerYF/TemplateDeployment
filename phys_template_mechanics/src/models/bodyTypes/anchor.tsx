/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { drawHatching } from '@/renderer/hatching'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function getAnchorGeometry(radius: number, side: 'top' | 'left' | 'right' | 'center') {
  if (side === 'center') {
    return {
      wallCenter: { x: 0, y: 0 },
      wallDir: { x: 1, y: 0 },
      hatchNormal: { x: 0, y: 1 },
      contactStart: { x: 0, y: 0 },
      contactEnd: { x: 0, y: 0 },
      contactNormal: { x: 0, y: 1 },
    }
  }

  const wallOffset = radius * 1.6
  const wallHalf = radius * 3

  if (side === 'left') {
    return {
      wallCenter: { x: -wallOffset, y: 0 },
      wallDir: { x: 0, y: 1 },
      hatchNormal: { x: -1, y: 0 },
      contactStart: { x: -wallOffset, y: -wallHalf },
      contactEnd: { x: -wallOffset, y: wallHalf },
      contactNormal: { x: -1, y: 0 },
    }
  }

  if (side === 'right') {
    return {
      wallCenter: { x: wallOffset, y: 0 },
      wallDir: { x: 0, y: 1 },
      hatchNormal: { x: 1, y: 0 },
      contactStart: { x: wallOffset, y: -wallHalf },
      contactEnd: { x: wallOffset, y: wallHalf },
      contactNormal: { x: 1, y: 0 },
    }
  }

  return {
    wallCenter: { x: 0, y: wallOffset },
    wallDir: { x: 1, y: 0 },
    hatchNormal: { x: 0, y: 1 },
    contactStart: { x: -wallHalf, y: wallOffset },
    contactEnd: { x: wallHalf, y: wallOffset },
    contactNormal: { x: 0, y: 1 },
  }
}

function renderAnchorCommon(
  ctx: CanvasRenderingContext2D,
  radius: number,
  scale: number,
  side: 'top' | 'left' | 'right' | 'center',
  options: { color: string; showHatching: boolean; fillPin: boolean },
) {
  const r = Math.max(radius * scale, 4)
  if (side === 'center') {
    ctx.strokeStyle = options.color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = options.fillPin ? '#fff' : 'rgba(255, 255, 255, 0)'
    ctx.fill()
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(0, 0, Math.max(r * 0.3, 2), 0, Math.PI * 2)
    ctx.fillStyle = options.color
    ctx.fill()
    return
  }

  const geometry = getAnchorGeometry(radius, side)
  const wallCenterX = geometry.wallCenter.x * scale
  const wallCenterY = -geometry.wallCenter.y * scale
  const wallDx = geometry.wallDir.x
  const wallDy = -geometry.wallDir.y
  const wallHalf = Math.max(
    Math.hypot(
      geometry.contactEnd.x - geometry.contactStart.x,
      geometry.contactEnd.y - geometry.contactStart.y,
    ) * scale / 2,
    12,
  )
  const hatchNormalX = geometry.hatchNormal.x
  const hatchNormalY = -geometry.hatchNormal.y

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
  ctx.lineTo(0, 0)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, 0, r, 0, Math.PI * 2)
  ctx.fillStyle = options.fillPin ? '#fff' : 'rgba(255, 255, 255, 0)'
  ctx.fill()
  ctx.strokeStyle = options.color
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(0, 0, Math.max(r * 0.3, 2), 0, Math.PI * 2)
  ctx.fillStyle = options.color
  ctx.fill()
}

function AnchorIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <circle
        cx="10" cy="12" r="3"
        fill="none"
        stroke={COLORS.border}
        strokeWidth="1.5"
      />
      <circle cx="10" cy="12" r="1" fill={COLORS.dark} />
      <line x1="10" y1="9" x2="10" y2="6" stroke={COLORS.border} strokeWidth="1.5" />
      <line x1="5" y1="5" x2="15" y2="5" stroke={COLORS.border} strokeWidth="2" />
    </svg>
  )
}

registerBodyType({
  type: 'anchor',
  label: '固定锚点',
  category: 'support',

  defaults: {
    isStatic: true,
    fixedRotation: true,
    anchorRadius: 0.15,
    mountSide: 'top',
    mass: 1,
    friction: 0.3,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const r = body.anchorRadius ?? 0.1
    return { type: 'circle', radius: r }
  },

  toDensity: (body) => {
    const r = body.anchorRadius ?? 0.1
    return body.isStatic ? 0 : body.mass / (Math.PI * r * r)
  },

  renderEdit: (ctx, body, scale, isSelected) => {
    const radius = body.anchorRadius ?? 0.15
    const side = body.mountSide ?? 'top'
    void isSelected
    renderAnchorCommon(ctx, radius, scale, side, {
      color: COLORS.dark,
      showHatching: true,
      fillPin: true,
    })
  },

  renderSelectionOutline: (ctx, body, scale) => {
    const radius = body.anchorRadius ?? 0.15
    const side = body.mountSide ?? 'top'
    const color = typeof ctx.strokeStyle === 'string' ? ctx.strokeStyle : COLORS.info
    renderAnchorCommon(ctx, radius, scale, side, {
      color,
      showHatching: false,
      fillPin: false,
    })
  },

  resizeMode: 'radius',

  getLocalBBox: (body) => {
    const r = body.anchorRadius ?? 0.15
    return { centerOffsetX: 0, centerOffsetY: 0, halfW: r, halfH: r }
  },

  applyResize: (_body, newHalfW) => ({ anchorRadius: newHalfW }),

  getSelectionBounds: (body, scale) => {
    const raw = (body.anchorRadius ?? 0.15) * scale
    if (scale <= 10) return { halfW: raw, halfH: raw }
    const r = Math.max(raw, 4)
    // Normal rendering/handle scale: circle-only bounds (matches ball behavior)
  if (scale <= 500) return { halfW: r, halfH: r }
    // Thumbnail (REF_SCALE=1000): full visual bounds including wall/strut
    const side = body.mountSide ?? 'top'
    if (side === 'center') return { halfW: r, halfH: r }
    const geometry = getAnchorGeometry(body.anchorRadius ?? 0.15, side)
    const wallOffset = Math.hypot(geometry.wallCenter.x, geometry.wallCenter.y) * scale
    const wallHalf = Math.hypot(
      geometry.contactEnd.x - geometry.contactStart.x,
      geometry.contactEnd.y - geometry.contactStart.y,
    ) * scale / 2
    if (side === 'left' || side === 'right') {
      return { halfW: wallOffset, halfH: wallHalf }
    }
    return { halfW: wallHalf, halfH: wallOffset }
  },

  hitTest: (lx, ly, body) => {
    // Cover full visual extent: pin circle + strut + wall decorations
    const r = body.anchorRadius ?? 0.15
    const extent = Math.max(r * 3, 0.5)
    return Math.abs(lx) <= extent && Math.abs(ly) <= extent
  },

  getSnapSurfaces: (body) => {
    const side = body.mountSide ?? 'top'
    const geometry = getAnchorGeometry(body.anchorRadius ?? 0.15, side)
    if (side === 'center') return []
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
    {
      key: 'mountSide',
      label: '挂载侧',
      type: 'select',
      options: [
        { value: 'top', label: '顶部' },
        { value: 'left', label: '左侧' },
        { value: 'right', label: '右侧' },
        { value: 'center', label: '圆心' },
      ],
    },
  ],

  icon: AnchorIcon,
})
