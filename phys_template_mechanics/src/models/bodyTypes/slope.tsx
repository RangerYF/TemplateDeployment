/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { pointInTriangle } from '@/core/geometry'
import { createSnapSurface } from '@/core/snap/utils'
import { drawHatching } from '@/renderer/hatching'
import { registerBodyType } from './registry'

function SlopeIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <polygon
        points="3,16 17,16 3,5"
        fill={`${COLORS.bgMuted}cc`}
        stroke={COLORS.border}
        strokeWidth="1.5"
      />
    </svg>
  )
}

/** 获取斜面三角形顶点（考虑 flipped） */
function slopeVertices(body: { baseLength?: number; slopeHeight?: number; flipped?: boolean }) {
  const base = body.baseLength ?? 3
  const h = body.slopeHeight ?? 2
  const fx = body.flipped ? -1 : 1
  return {
    v0: { x: fx * (-base / 2), y: -h / 3 },      // 底边一端
    v1: { x: fx * (base / 2), y: -h / 3 },        // 底边另一端
    v2: { x: fx * (-base / 2), y: (2 * h) / 3 },  // 高点
  }
}

registerBodyType({
  type: 'slope',
  label: '斜面',
  category: 'support',

  defaults: {
    baseLength: 7.5,
    slopeHeight: 4.33,
    mass: 5,
    friction: 0.4,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const base = body.baseLength ?? 3
    const h = body.slopeHeight ?? 2
    // toShapeConfig 不处理 flipped，由 sceneSync.mirrorShapeX 统一处理
    const v0 = { x: -base / 2, y: -h / 3 }
    const v1 = { x: base / 2, y: -h / 3 }
    const v2 = { x: -base / 2, y: (2 * h) / 3 }
    return { type: 'polygon', vertices: [v0, v1, v2] }
  },

  toDensity: (body) => {
    const base = body.baseLength ?? 3
    const h = body.slopeHeight ?? 2
    return body.isStatic ? 0 : body.mass / (0.5 * base * h)
  },

  renderEdit: (ctx, body, scale) => {
    const base = (body.baseLength ?? 3) * scale
    const h = (body.slopeHeight ?? 2) * scale
    const v0x = -base / 2, v0y = h / 3
    const v1x = base / 2, v1y = h / 3
    const v2x = -base / 2, v2y = -(2 * h) / 3
    ctx.beginPath()
    ctx.moveTo(v0x, v0y)
    ctx.lineTo(v1x, v1y)
    ctx.lineTo(v2x, v2y)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()

    // Bottom edge hatching (fixed surface marker, only for static slopes)
    if (body.isStatic !== false) {
      drawHatching(ctx, v0x, v0y, v1x, v1y, 0, 1)
    }
  },

  getLocalBBox: (body) => {
    const base = body.baseLength ?? 3
    const h = body.slopeHeight ?? 2
    // Origin at centroid; bbox center offset in screen coords (Y-down)
    return { centerOffsetX: 0, centerOffsetY: -h / 6, halfW: base / 2, halfH: h / 2 }
  },

  applyResize: (_body, newHalfW, newHalfH) => ({
    baseLength: newHalfW * 2, slopeHeight: newHalfH * 2,
  }),

  getSelectionBounds: (body, scale) => ({
    halfW: ((body.baseLength ?? 3) * scale) / 2,
    halfH: ((body.slopeHeight ?? 2) * scale) / 2,
  }),

  hitTest: (lx, ly, body) => {
    // hitTest 接收的是渲染坐标系中的局部坐标，flipped 时渲染已 scale(-1,1)
    // 所以需要反转 lx 来匹配原始几何
    const testX = body.flipped ? -lx : lx
    const base = body.baseLength ?? 3
    const h = body.slopeHeight ?? 2
    const v0 = { x: -base / 2, y: -h / 3 }
    const v1 = { x: base / 2, y: -h / 3 }
    const v2 = { x: -base / 2, y: (2 * h) / 3 }
    return pointInTriangle(testX, ly, v0, v1, v2)
  },

  getSnapSurfaces: (body) => {
    const { v0, v1, v2 } = slopeVertices(body)
    const { x, y } = body.position
    const a = body.angle
    // 翻转时顶点 x 镜像导致绕向反转，需要交换 rest surface 顶点顺序以保持法线朝外
    const [restFrom, restTo] = body.flipped ? [v1, v2] : [v2, v1]
    return [
      createSnapSurface('rest', restFrom, restTo, x, y, a),
      // Contact: bottom edge（法线显式指定，顶点顺序不影响）
      createSnapSurface('contact', v0, v1, x, y, a, { x: 0, y: -1 }),
    ]
  },

  properties: [
    { key: 'baseLength', label: '底边 (m)', type: 'number', step: 0.1, min: 0.5 },
    { key: 'slopeHeight', label: '高度 (m)', type: 'number', step: 0.1, min: 0.5 },
  ],

  icon: SlopeIcon,
})
