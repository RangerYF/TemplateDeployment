/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { pointInPolygon } from '@/core/geometry'
import { drawHatching } from '@/renderer/hatching'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function GrooveIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <path
        d="M 4 5 L 10 16 L 16 5"
        fill="none"
        stroke={COLORS.border}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getGrooveGeometry(width: number, depth: number, thickness: number) {
  const baseWidth = Math.max(width * 0.18, thickness * 6, 0.6)

  const leftOuterTop = { x: -width / 2 - thickness / 2, y: depth / 2 }
  const leftInnerTop = { x: -width / 2 + thickness / 2, y: depth / 2 }
  const leftInnerBottom = { x: -baseWidth / 2 + thickness / 2, y: -depth / 2 }
  const leftOuterBottom = { x: -baseWidth / 2 - thickness / 2, y: -depth / 2 }

  const rightInnerBottom = { x: baseWidth / 2 - thickness / 2, y: -depth / 2 }
  const rightOuterBottom = { x: baseWidth / 2 + thickness / 2, y: -depth / 2 }
  const rightInnerTop = { x: width / 2 - thickness / 2, y: depth / 2 }
  const rightOuterTop = { x: width / 2 + thickness / 2, y: depth / 2 }

  return {
    baseWidth,
    leftWall: [leftOuterTop, leftInnerTop, leftInnerBottom, leftOuterBottom],
    rightWall: [rightOuterBottom, rightInnerBottom, rightInnerTop, rightOuterTop],
    leftInnerTop,
    leftInnerBottom,
    rightInnerTop,
    rightInnerBottom,
  }
}

function toScreenPoint(pt: { x: number; y: number }) {
  return { x: pt.x, y: -pt.y }
}

registerBodyType({
  type: 'groove',
  label: 'V形槽',
  category: 'surface',

  defaults: {
    grooveWidth: 6.5,
    grooveDepth: 4.33,
    grooveThickness: 0.1,
    isStatic: true,
    fixedRotation: true,
    mass: 5,
    friction: 0.3,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const w = body.grooveWidth ?? 6.5
    const d = body.grooveDepth ?? 4.33
    const t = body.grooveThickness ?? 0.1
    const geometry = getGrooveGeometry(w, d, t)
    const leftWall = {
      type: 'polygon' as const,
      vertices: geometry.leftWall,
    }
    const rightWall = {
      type: 'polygon' as const,
      vertices: geometry.rightWall,
    }
    return [leftWall, rightWall]
  },

  toDensity: (body) => {
    const w = body.grooveWidth ?? 6.5
    const d = body.grooveDepth ?? 4.33
    return body.isStatic ? 0 : body.mass / (w * d * 0.5)
  },

  renderEdit: (ctx, body, scale) => {
    const w = body.grooveWidth ?? 6.5
    const d = body.grooveDepth ?? 4.33
    const t = body.grooveThickness ?? 0.1
    const geometry = getGrooveGeometry(w, d, t)
    const leftWall = geometry.leftWall.map(toScreenPoint)
    const rightWall = geometry.rightWall.map(toScreenPoint)
    const bottomLeft = toScreenPoint({ x: -geometry.baseWidth / 2, y: -d / 2 })
    const bottomRight = toScreenPoint({ x: geometry.baseWidth / 2, y: -d / 2 })

    // Reduce fill opacity for lighter appearance
    const origAlpha = ctx.globalAlpha
    ctx.globalAlpha = origAlpha * 0.5

    // Left wall
    ctx.beginPath()
    ctx.moveTo(leftWall[0].x * scale, leftWall[0].y * scale)
    for (let i = 1; i < leftWall.length; i++) {
      ctx.lineTo(leftWall[i].x * scale, leftWall[i].y * scale)
    }
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = origAlpha
    ctx.stroke()

    // Right wall
    ctx.globalAlpha = origAlpha * 0.5
    ctx.beginPath()
    ctx.moveTo(rightWall[0].x * scale, rightWall[0].y * scale)
    for (let i = 1; i < rightWall.length; i++) {
      ctx.lineTo(rightWall[i].x * scale, rightWall[i].y * scale)
    }
    ctx.closePath()
    ctx.fill()
    ctx.globalAlpha = origAlpha
    ctx.stroke()

    // Bottom hatching (fixed surface marker)
    if (body.isStatic !== false) {
      drawHatching(
        ctx,
        bottomLeft.x * scale,
        bottomLeft.y * scale,
        bottomRight.x * scale,
        bottomRight.y * scale,
        0,
        1,
        { length: 5, spacing: 3 },
      )
    }
  },

  getLocalBBox: (body) => ({
    centerOffsetX: 0, centerOffsetY: 0,
    halfW: (body.grooveWidth ?? 6.5) / 2, halfH: (body.grooveDepth ?? 4.33) / 2,
  }),

  applyResize: (_body, newHalfW, newHalfH) => ({
    grooveWidth: newHalfW * 2, grooveDepth: newHalfH * 2,
  }),

  getSelectionBounds: (body, scale) => ({
    halfW: ((body.grooveWidth ?? 6.5) * scale) / 2 + ((body.grooveThickness ?? 0.1) * scale) / 2,
    halfH: ((body.grooveDepth ?? 4.33) * scale) / 2,
  }),

  hitTest: (lx, ly, body) => {
    const w = body.grooveWidth ?? 6.5
    const d = body.grooveDepth ?? 4.33
    const t = body.grooveThickness ?? 0.1
    const geometry = getGrooveGeometry(w, d, t)
    return pointInPolygon(lx, ly, geometry.leftWall) || pointInPolygon(lx, ly, geometry.rightWall)
  },

  getSnapSurfaces: (body) => {
    const w = body.grooveWidth ?? 6.5
    const d = body.grooveDepth ?? 4.33
    const t = body.grooveThickness ?? 0.1
    const geometry = getGrooveGeometry(w, d, t)
    const { x, y } = body.position
    const a = body.angle
    return [
      createSnapSurface('rest', geometry.leftInnerTop, geometry.leftInnerBottom, x, y, a),
      createSnapSurface('rest', geometry.rightInnerBottom, geometry.rightInnerTop, x, y, a),
      createSnapSurface(
        'contact',
        { x: -geometry.baseWidth / 2, y: -d / 2 },
        { x: geometry.baseWidth / 2, y: -d / 2 },
        x,
        y,
        a,
        { x: 0, y: -1 },
      ),
    ]
  },

  properties: [
    { key: 'grooveWidth', label: '开口宽度 (m)', type: 'number', step: 0.1, min: 0.5 },
    { key: 'grooveDepth', label: '深度 (m)', type: 'number', step: 0.1, min: 0.5 },
    { key: 'grooveThickness', label: '壁厚 (m)', type: 'number', step: 0.01, min: 0.05 },
  ],

  icon: GrooveIcon,
})
