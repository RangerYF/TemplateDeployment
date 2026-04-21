/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { createSnapSurface } from '@/core/snap/utils'
import { registerBodyType } from './registry'

function BallIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <circle
        cx="10" cy="10" r="7"
        fill={`${COLORS.primary}40`}
        stroke={COLORS.primary}
        strokeWidth="1.5"
      />
    </svg>
  )
}

registerBodyType({
  type: 'ball',
  label: '球体',
  category: 'basic',

  defaults: {
    radius: 0.3,
    mass: 1,
    friction: 0.3,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const r = body.radius ?? 0.5
    return { type: 'circle', radius: r }
  },

  toDensity: (body) => {
    const r = body.radius ?? 0.5
    return body.isStatic ? 0 : body.mass / (Math.PI * r * r)
  },

  renderEdit: (ctx, body, scale) => {
    const r = (body.radius ?? 0.5) * scale
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
    // Direction indicator
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(r, 0)
    ctx.stroke()
  },

  resizeMode: 'radius',

  getLocalBBox: (body) => {
    const r = body.radius ?? 0.5
    return { centerOffsetX: 0, centerOffsetY: 0, halfW: r, halfH: r }
  },

  applyResize: (_body, newHalfW) => ({ radius: newHalfW }),

  getSelectionBounds: (body, scale) => {
    const r = (body.radius ?? 0.5) * scale
    return { halfW: r, halfH: r }
  },

  hitTest: (lx, ly, body) => {
    const r = body.radius ?? 0.5
    return lx * lx + ly * ly <= r * r
  },

  getSnapSurfaces: (body) => {
    const r = body.radius ?? 0.5
    const { x, y } = body.position
    // Ball has a contact "point" at the bottom - represented as a tiny segment
    // The snap engine uses the body radius for offset calculation
    return [
      createSnapSurface('contact', { x: -0.01, y: -r }, { x: 0.01, y: -r }, x, y, body.angle, { x: 0, y: -1 }),
    ]
  },

  properties: [
    { key: 'radius', label: '半径 (m)', type: 'number', step: 0.1, min: 0.1 },
  ],

  icon: BallIcon,
})
