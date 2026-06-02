/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { drawHatching } from '@/renderer/hatching'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function ChannelIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <path
        d="M 3 4 L 3 16 L 17 16 L 17 4"
        fill="none"
        stroke={COLORS.border}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function getChannelGeometry(length: number, wallHeight: number, thickness: number) {
  const totalW = length + 2 * thickness
  const totalH = wallHeight + thickness
  const halfW = totalW / 2
  const halfH = totalH / 2

  const bottomPlate = [
    { x: -halfW, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: -halfH + thickness },
    { x: -halfW, y: -halfH + thickness },
  ]

  const leftWall = [
    { x: -halfW, y: -halfH },
    { x: -halfW + thickness, y: -halfH },
    { x: -halfW + thickness, y: halfH },
    { x: -halfW, y: halfH },
  ]

  const rightWall = [
    { x: halfW - thickness, y: -halfH },
    { x: halfW, y: -halfH },
    { x: halfW, y: halfH },
    { x: halfW - thickness, y: halfH },
  ]

  return {
    totalW,
    totalH,
    halfW,
    halfH,
    bottomPlate,
    leftWall,
    rightWall,
    innerBottom: -halfH + thickness,
    innerLeft: -halfW + thickness,
    innerRight: halfW - thickness,
  }
}

registerBodyType({
  type: 'channel',
  label: '槽型船',
  category: 'surface',

  defaults: {
    channelLength: 8,
    channelWallHeight: 1.2,
    channelThickness: 0.15,
    isStatic: false,
    fixedRotation: true,
    mass: 4,
    friction: 0,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const l = body.channelLength ?? 8
    const h = body.channelWallHeight ?? 1.2
    const t = body.channelThickness ?? 0.15
    const geo = getChannelGeometry(l, h, t)
    return [
      { type: 'polygon' as const, vertices: geo.bottomPlate },
      { type: 'polygon' as const, vertices: geo.leftWall },
      { type: 'polygon' as const, vertices: geo.rightWall },
    ]
  },

  toDensity: (body) => {
    const l = body.channelLength ?? 8
    const h = body.channelWallHeight ?? 1.2
    const t = body.channelThickness ?? 0.15
    if (body.isStatic) return 0
    const totalW = l + 2 * t
    const area = totalW * t + 2 * t * h
    return area > 0 ? body.mass / area : 0
  },

  renderEdit: (ctx, body, scale) => {
    const l = body.channelLength ?? 8
    const h = body.channelWallHeight ?? 1.2
    const t = body.channelThickness ?? 0.15
    const geo = getChannelGeometry(l, h, t)

    const origAlpha = ctx.globalAlpha

    const drawRect = (vertices: Array<{ x: number; y: number }>) => {
      ctx.globalAlpha = origAlpha * 0.5
      ctx.beginPath()
      ctx.moveTo(vertices[0].x * scale, -vertices[0].y * scale)
      for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x * scale, -vertices[i].y * scale)
      }
      ctx.closePath()
      ctx.fill()
      ctx.globalAlpha = origAlpha
      ctx.stroke()
    }

    drawRect(geo.bottomPlate)
    drawRect(geo.leftWall)
    drawRect(geo.rightWall)

    if (body.isStatic !== false) {
      const bL = -geo.halfW * scale
      const bR = geo.halfW * scale
      const bY = geo.halfH * scale
      drawHatching(ctx, bL, bY, bR, bY, 0, 1, { length: 5, spacing: 3 })
    }
  },

  getLocalBBox: (body) => {
    const l = body.channelLength ?? 8
    const h = body.channelWallHeight ?? 1.2
    const t = body.channelThickness ?? 0.15
    const halfW = (l + 2 * t) / 2
    const halfH = (h + t) / 2
    return { centerOffsetX: 0, centerOffsetY: 0, halfW, halfH }
  },

  applyResize: (_body, newHalfW, newHalfH) => {
    const t = _body.channelThickness ?? 0.15
    return {
      channelLength: Math.max(1, newHalfW * 2 - 2 * t),
      channelWallHeight: Math.max(0.3, newHalfH * 2 - t),
    }
  },

  getSelectionBounds: (body, scale) => {
    const l = body.channelLength ?? 8
    const h = body.channelWallHeight ?? 1.2
    const t = body.channelThickness ?? 0.15
    return {
      halfW: ((l + 2 * t) * scale) / 2,
      halfH: ((h + t) * scale) / 2,
    }
  },

  hitTest: (lx, ly, body) => {
    const l = body.channelLength ?? 8
    const h = body.channelWallHeight ?? 1.2
    const t = body.channelThickness ?? 0.15
    const geo = getChannelGeometry(l, h, t)

    if (lx < -geo.halfW || lx > geo.halfW || ly < -geo.halfH || ly > geo.halfH) return false
    if (ly <= geo.innerBottom) return true
    if (lx <= geo.innerLeft) return true
    if (lx >= geo.innerRight) return true
    return false
  },

  getSnapSurfaces: (body) => {
    const l = body.channelLength ?? 8
    const h = body.channelWallHeight ?? 1.2
    const t = body.channelThickness ?? 0.15
    const geo = getChannelGeometry(l, h, t)
    const { x, y } = body.position
    const a = body.angle
    return [
      createSnapSurface('rest',
        { x: geo.innerLeft, y: geo.innerBottom },
        { x: geo.innerRight, y: geo.innerBottom },
        x, y, a, { x: 0, y: 1 },
      ),
      createSnapSurface('contact',
        { x: -geo.halfW, y: -geo.halfH },
        { x: geo.halfW, y: -geo.halfH },
        x, y, a, { x: 0, y: -1 },
      ),
    ]
  },

  properties: [
    { key: 'channelLength', label: '内部长度 (m)', type: 'number', step: 0.5, min: 1 },
    { key: 'channelWallHeight', label: '侧壁高度 (m)', type: 'number', step: 0.1, min: 0.3 },
    { key: 'channelThickness', label: '壁厚 (m)', type: 'number', step: 0.01, min: 0.05 },
  ],

  icon: ChannelIcon,
})
