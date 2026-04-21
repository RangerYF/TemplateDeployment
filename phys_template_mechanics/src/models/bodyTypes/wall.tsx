/* eslint-disable react-refresh/only-export-components */
import { COLORS } from '@/styles/tokens'
import { createSnapSurface } from '@/core/snap/utils'
import { drawHatching } from '@/renderer/hatching'
import { registerBodyType } from './registry'

function renderWallCommon(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  options: { color: string; showHatching: boolean },
): void {
  const faceX = Math.max(w * 0.15, 1)
  const capHalf = Math.max(w * 0.45, 5)

  ctx.save()
  ctx.strokeStyle = options.color
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(faceX, -h / 2)
  ctx.lineTo(faceX, h / 2)
  ctx.stroke()

  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.moveTo(faceX - capHalf * 0.6, -h / 2)
  ctx.lineTo(faceX + capHalf * 0.2, -h / 2)
  ctx.moveTo(faceX - capHalf * 0.6, h / 2)
  ctx.lineTo(faceX + capHalf * 0.2, h / 2)
  ctx.stroke()
  ctx.restore()

  if (options.showHatching) {
    drawHatching(
      ctx,
      faceX,
      -h / 2,
      faceX,
      h / 2,
      -1,
      0,
      { length: 7, spacing: 5, color: options.color, alpha: 0.75 },
    )
  }
}

function WallIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <line x1="11" y1="2.5" x2="11" y2="17.5" stroke={COLORS.borderStrong} strokeWidth="2" />
      <line x1="6.5" y1="5" x2="11" y2="9.5" stroke={COLORS.borderStrong} strokeWidth="1" opacity="0.65" />
      <line x1="6.5" y1="9" x2="11" y2="13.5" stroke={COLORS.borderStrong} strokeWidth="1" opacity="0.65" />
      <line x1="6.5" y1="13" x2="11" y2="17.5" stroke={COLORS.borderStrong} strokeWidth="1" opacity="0.65" />
    </svg>
  )
}

registerBodyType({
  type: 'wall',
  label: '挡板',
  category: 'support',

  defaults: {
    wallWidth: 0.15,
    wallHeight: 4.33,
    isStatic: true,
    fixedRotation: true,
    mass: 5,
    friction: 0.3,
    restitution: 0,
  },

  toShapeConfig: (body) => {
    const w = body.wallWidth ?? 0.2
    const h = body.wallHeight ?? 4.33
    return { type: 'box', width: w, height: h }
  },

  toDensity: (body) => {
    const w = body.wallWidth ?? 0.2
    const h = body.wallHeight ?? 4.33
    return body.isStatic ? 0 : body.mass / (w * h)
  },

  toUserData: (body) => ({
    bodyType: 'wall',
    wallWidth: body.wallWidth ?? 0.15,
    wallHeight: body.wallHeight ?? 4.33,
    isStatic: body.isStatic,
  }),

  renderEdit: (ctx, body, scale, isSelected) => {
    const w = (body.wallWidth ?? 0.2) * scale
    const h = (body.wallHeight ?? 4.33) * scale
    void isSelected
    renderWallCommon(ctx, w, h, { color: COLORS.dark, showHatching: body.isStatic !== false })
  },

  renderSelectionOutline: (ctx, body, scale) => {
    const w = (body.wallWidth ?? 0.2) * scale
    const h = (body.wallHeight ?? 4.33) * scale
    const strokeColor = typeof ctx.strokeStyle === 'string' ? ctx.strokeStyle : COLORS.info
    renderWallCommon(ctx, w, h, { color: strokeColor, showHatching: false })
  },

  renderSim: (ctx, bodyState, scale) => {
    const ud = bodyState.userData as Record<string, unknown> | undefined
    const w = ((ud?.wallWidth as number) ?? 0.15) * scale
    const h = ((ud?.wallHeight as number) ?? 4.33) * scale
    renderWallCommon(ctx, w, h, { color: COLORS.dark, showHatching: bodyState.type === 'static' })
  },

  getLocalBBox: (body) => ({
    centerOffsetX: 0, centerOffsetY: 0,
    halfW: (body.wallWidth ?? 0.2) / 2, halfH: (body.wallHeight ?? 4.33) / 2,
  }),

  applyResize: (_body, newHalfW, newHalfH) => ({
    wallWidth: newHalfW * 2, wallHeight: newHalfH * 2,
  }),

  getSelectionBounds: (body, scale) => ({
    halfW: ((body.wallWidth ?? 0.2) * scale) / 2,
    halfH: ((body.wallHeight ?? 4.33) * scale) / 2,
  }),

  hitTest: (lx, ly, body) => {
    const halfW = (body.wallWidth ?? 0.2) / 2
    const halfH = (body.wallHeight ?? 4.33) / 2
    return Math.abs(lx) <= halfW && Math.abs(ly) <= halfH
  },

  getSnapSurfaces: (body) => {
    const w = body.wallWidth ?? 0.2
    const h = body.wallHeight ?? 4.33
    const halfW = w / 2
    const halfH = h / 2
    const { x, y } = body.position
    const a = body.angle
    return [
      // Rest: top, left, right faces
      createSnapSurface('rest', { x: -halfW, y: halfH }, { x: halfW, y: halfH }, x, y, a, { x: 0, y: 1 }),
      createSnapSurface('rest', { x: -halfW, y: -halfH }, { x: -halfW, y: halfH }, x, y, a, { x: -1, y: 0 }),
      createSnapSurface('rest', { x: halfW, y: -halfH }, { x: halfW, y: halfH }, x, y, a, { x: 1, y: 0 }),
      // Contact: bottom face
      createSnapSurface('contact', { x: -halfW, y: -halfH }, { x: halfW, y: -halfH }, x, y, a, { x: 0, y: -1 }),
    ]
  },

  properties: [
    { key: 'wallWidth', label: '厚度 (m)', type: 'number', step: 0.05, min: 0.1 },
    { key: 'wallHeight', label: '高度 (m)', type: 'number', step: 0.1, min: 0.5 },
  ],

  icon: WallIcon,
})
