/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { drawHatching } from '@/renderer/hatching'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function HemisphereIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <path
        d="M 3 8 Q 10 18 17 8"
        fill="none"
        stroke={COLORS.border}
        strokeWidth="2"
      />
    </svg>
  )
}

/** Shared drawing logic for edit and sim modes */
function renderHemisphereCommon(
  ctx: CanvasRenderingContext2D,
  r: number,
  angle: number,
  options: { fillAlpha?: number; showHatching: boolean },
): void {
  const segments = 24
  const margin = r * 0.35
  const blockDepth = r * 0.55

  // Collect arc points (semicircular cutout, screen Y-down)
  const pts: Array<{ x: number; y: number }> = []
  for (let i = 0; i <= segments; i++) {
    const theta = -angle / 2 + (i * angle) / segments
    pts.push({ x: r * Math.sin(theta), y: r * Math.cos(theta) })
  }
  const leftArc = pts[0]
  const rightArc = pts[pts.length - 1]
  const arcBottom = pts[Math.floor(segments / 2)]

  const topLeft = { x: leftArc.x - margin, y: leftArc.y }
  const topRight = { x: rightArc.x + margin, y: rightArc.y }
  const bottomRight = { x: topRight.x, y: arcBottom.y + blockDepth }
  const bottomLeft = { x: topLeft.x, y: arcBottom.y + blockDepth }

  // 1. Fill block body (excluding cutout)
  const origAlpha = ctx.globalAlpha
  if (options.fillAlpha !== undefined) ctx.globalAlpha = options.fillAlpha
  ctx.beginPath()
  ctx.moveTo(topLeft.x, topLeft.y)
  ctx.lineTo(leftArc.x, leftArc.y)
  for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.lineTo(bottomRight.x, bottomRight.y)
  ctx.lineTo(bottomLeft.x, bottomLeft.y)
  ctx.closePath()
  ctx.fill()
  ctx.globalAlpha = origAlpha

  // 2. Outline
  const origLineWidth = ctx.lineWidth
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(topLeft.x, topLeft.y)
  ctx.lineTo(leftArc.x, leftArc.y)
  for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.lineTo(bottomRight.x, bottomRight.y)
  ctx.lineTo(bottomLeft.x, bottomLeft.y)
  ctx.closePath()
  ctx.stroke()

  // 3. Arc line thicker for emphasis
  ctx.lineWidth = 3
  ctx.beginPath()
  for (let i = 0; i < pts.length; i++) {
    if (i === 0) ctx.moveTo(pts[i].x, pts[i].y)
    else ctx.lineTo(pts[i].x, pts[i].y)
  }
  ctx.stroke()
  ctx.lineWidth = origLineWidth

  // 4. Hatching below bottom edge (edit mode only)
  if (options.showHatching) {
    drawHatching(ctx, bottomLeft.x, bottomLeft.y, bottomRight.x, bottomRight.y, 0, 1, { length: 6, spacing: 3 })
  }
}

registerBodyType({
  type: 'hemisphere',
  label: '球槽',
  category: 'surface',

  defaults: {
    hemisphereRadius: 2.78,
    hemisphereAngle: Math.PI,
    mass: 10,
    friction: 0.3,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const r = body.hemisphereRadius ?? 2.78
    const angle = body.hemisphereAngle ?? Math.PI
    const margin = r * 0.35
    const blockDepth = r * 0.55
    const halfW = r + margin

    // Arc chain (concave surface for ball contact)
    const N = 24
    const chainVerts: Array<{ x: number; y: number }> = []
    for (let i = 0; i <= N; i++) {
      const theta = -angle / 2 + (i * angle) / N
      chainVerts.push({ x: r * Math.sin(theta), y: -r * Math.cos(theta) })
    }
    const chain = { type: 'chain' as const, vertices: chainVerts, loop: false }

    // Block body decomposed into 3 convex parts (physics Y-up):
    // Arc endpoints at y=0, arc deepest at y=-r, block bottom at y=-(r+blockDepth)
    const arcLeftX = chainVerts[0].x        // negative
    const arcRightX = chainVerts[N].x       // positive
    const bottomY = -(r + blockDepth)

    // Left wall: from block left edge to arc left endpoint
    const leftWall = {
      type: 'polygon' as const,
      vertices: [
        { x: -halfW, y: 0 },
        { x: arcLeftX, y: 0 },
        { x: arcLeftX, y: bottomY },
        { x: -halfW, y: bottomY },
      ],
    }

    // Right wall: from arc right endpoint to block right edge
    const rightWall = {
      type: 'polygon' as const,
      vertices: [
        { x: arcRightX, y: 0 },
        { x: halfW, y: 0 },
        { x: halfW, y: bottomY },
        { x: arcRightX, y: bottomY },
      ],
    }

    // Bottom plate: full width, from arc deepest point to block bottom
    const bottomPlate = {
      type: 'polygon' as const,
      vertices: [
        { x: -halfW, y: -r },
        { x: halfW, y: -r },
        { x: halfW, y: bottomY },
        { x: -halfW, y: bottomY },
      ],
    }

    return [chain, leftWall, rightWall, bottomPlate]
  },

  toDensity: (body) => {
    if (body.isStatic) return 0
    const mass = body.mass ?? 10
    const r = body.hemisphereRadius ?? 2.78
    const margin = r * 0.35
    const blockDepth = r * 0.55
    // Approximate area: full block minus the semicircle cutout
    const blockArea = (2 * (r + margin)) * (r + blockDepth)
    const cutoutArea = Math.PI * r * r / 2
    const area = blockArea - cutoutArea
    return area > 0 ? mass / area : 0
  },

  toUserData: (body) => ({
    bodyType: 'hemisphere',
    hemisphereRadius: body.hemisphereRadius ?? 2.78,
    hemisphereAngle: body.hemisphereAngle ?? Math.PI,
  }),

  renderEdit: (ctx, body, scale) => {
    const r = (body.hemisphereRadius ?? 2.78) * scale
    const angle = body.hemisphereAngle ?? Math.PI
    renderHemisphereCommon(ctx, r, angle, { fillAlpha: 0.08, showHatching: true })
  },

  renderSim: (ctx, bodyState, scale) => {
    const ud = bodyState.userData as Record<string, unknown> | undefined
    const r = ((ud?.hemisphereRadius as number) ?? 2.78) * scale
    const angle = (ud?.hemisphereAngle as number) ?? Math.PI
    renderHemisphereCommon(ctx, r, angle, { showHatching: false })
  },

  resizeMode: 'uniform',

  getLocalBBox: (body) => {
    const r = body.hemisphereRadius ?? 2.78
    const margin = r * 0.35
    const blockDepth = r * 0.55
    const halfW = r + margin           // 1.35r
    const halfH = (r + blockDepth) / 2 // 0.775r
    // Origin at rim top; bbox center is below origin in screen (Y-down)
    return { centerOffsetX: 0, centerOffsetY: halfH, halfW, halfH }
  },

  applyResize: (body, newHalfW, newHalfH) => {
    const origR = body.hemisphereRadius ?? 2.78
    const rFromW = newHalfW / 1.35
    const rFromH = newHalfH / 0.775
    const newR = Math.abs(rFromW - origR) > Math.abs(rFromH - origR) ? rFromW : rFromH
    return { hemisphereRadius: Math.max(0.3, newR) }
  },

  getSelectionBounds: (body, scale) => {
    const raw = (body.hemisphereRadius ?? 2.78) * scale
    // Low scale (marquee/snap): physical radius only
    if (scale <= 10) return { halfW: raw, halfH: raw }
    const r = Math.max(raw, 4)
    const margin = r * 0.35
    const blockDepth = r * 0.55
    return { halfW: r + margin, halfH: (r + blockDepth) / 2 }
  },

  getSnapSurfaces: (body) => {
    const r = body.hemisphereRadius ?? 2.78
    const margin = r * 0.35
    const blockDepth = r * 0.55
    const halfW = r + margin
    // Physics local coords (Y-up): block bottom at y = -(r + blockDepth)
    const bottomY = -(r + blockDepth)
    const { x, y } = body.position
    const a = body.angle
    return [
      // Rest: arc surface (others can sit inside the bowl) — top rim
      createSnapSurface('rest', { x: -halfW, y: 0 }, { x: halfW, y: 0 }, x, y, a, { x: 0, y: 1 }),
      // Contact: bottom edge (this sits on ground)
      createSnapSurface('contact', { x: -halfW, y: bottomY }, { x: halfW, y: bottomY }, x, y, a, { x: 0, y: -1 }),
    ]
  },

  hitTest: (lx, ly, body) => {
    const r = body.hemisphereRadius ?? 2.78
    const margin = r * 0.35
    const blockDepth = r * 0.55
    const halfW = r + margin
    // Physics coords: arc endpoints at y=0, arc deepest at y=-r, block bottom at y=-(r+blockDepth)
    if (lx < -halfW || lx > halfW || ly > 0 || ly < -(r + blockDepth)) return false
    // Inside block bounds — check if inside the arc cutout
    const dist = Math.sqrt(lx * lx + ly * ly)
    const angle = body.hemisphereAngle ?? Math.PI
    const pointAngle = Math.atan2(lx, -ly)
    const inArc = dist < r && Math.abs(pointAngle) <= angle / 2
    // Hit if on the block body (not in the cutout) or near the arc edge
    return !inArc || Math.abs(dist - r) < 0.2
  },

  properties: [
    { key: 'hemisphereRadius', label: '半径 (m)', type: 'number', step: 0.1, min: 0.5 },
    {
      key: 'hemisphereAngle',
      label: '张角 (°)',
      type: 'number',
      step: 5,
      min: 30,
      max: 360,
      toDisplay: (v: number) => Math.round((v * 180) / Math.PI),
      fromDisplay: (v: number) => (v * Math.PI) / 180,
    },
  ],

  icon: HemisphereIcon,
})
