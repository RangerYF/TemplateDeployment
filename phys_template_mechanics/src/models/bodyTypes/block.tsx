/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function BlockIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <rect
        x="3" y="5" width="14" height="10" rx="1"
        fill={`${COLORS.primary}40`}
        stroke={COLORS.primary}
        strokeWidth="1.5"
      />
    </svg>
  )
}

registerBodyType({
  type: 'block',
  label: '物块',
  category: 'basic',

  defaults: {
    width: 0.8,
    height: 0.6,
    mass: 1,
    friction: 0.3,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const w = body.width ?? 1
    const h = body.height ?? 1
    return { type: 'box', width: w, height: h }
  },

  toDensity: (body) => {
    const w = body.width ?? 1
    const h = body.height ?? 1
    return body.isStatic ? 0 : body.mass / (w * h)
  },

  renderEdit: (ctx, body, scale) => {
    const w = (body.width ?? 1) * scale
    const h = (body.height ?? 1) * scale
    ctx.beginPath()
    ctx.rect(-w / 2, -h / 2, w, h)
    ctx.fill()
    ctx.stroke()
  },

  getLocalBBox: (body) => ({
    centerOffsetX: 0, centerOffsetY: 0,
    halfW: (body.width ?? 1) / 2, halfH: (body.height ?? 1) / 2,
  }),

  applyResize: (_body, newHalfW, newHalfH) => ({
    width: newHalfW * 2, height: newHalfH * 2,
  }),

  getSelectionBounds: (body, scale) => ({
    halfW: ((body.width ?? 1) * scale) / 2,
    halfH: ((body.height ?? 1) * scale) / 2,
  }),

  hitTest: (lx, ly, body) => {
    const halfW = (body.width ?? 1) / 2
    const halfH = (body.height ?? 1) / 2
    return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH
  },

  getSnapSurfaces: (body) => {
    const w = body.width ?? 1
    const h = body.height ?? 1
    const halfW = w / 2
    const halfH = h / 2
    const { x, y } = body.position
    const a = body.angle
    return [
      // Rest: top face (others can sit on it)
      createSnapSurface('rest', { x: -halfW, y: halfH }, { x: halfW, y: halfH }, x, y, a, { x: 0, y: 1 }),
      // Contact: bottom face (this sits on others)
      createSnapSurface('contact', { x: -halfW, y: -halfH }, { x: halfW, y: -halfH }, x, y, a, { x: 0, y: -1 }),
    ]
  },

  properties: [
    { key: 'width', label: '宽度 (m)', type: 'number', step: 0.1, min: 0.1 },
    { key: 'height', label: '高度 (m)', type: 'number', step: 0.1, min: 0.1 },
  ],

  icon: BlockIcon,
})
