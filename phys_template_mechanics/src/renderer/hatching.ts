import { COLORS } from '@/styles/tokens'

/**
 * 在指定线段的一侧绘制 45° 斜线阴影（教材固定端标记）。
 *
 * 坐标系：调用时 ctx 已在物体局部坐标系（translate + rotate 后）。
 *
 * @param ctx       Canvas 上下文
 * @param x1        线段起点 x
 * @param y1        线段起点 y
 * @param x2        线段终点 x
 * @param y2        线段终点 y
 * @param normalX   斜线延伸方向（单位向量，指向"墙壁内侧"）
 * @param normalY   斜线延伸方向 y
 * @param options   可选参数
 */
export function drawHatching(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  normalX: number,
  normalY: number,
  options?: {
    length?: number
    spacing?: number
    color?: string
    alpha?: number
    lineWidth?: number
  },
): void {
  const {
    length = 6,
    spacing = 4,
    color = COLORS.dark,
    alpha = 0.85,
    lineWidth = 1.2,
  } = options ?? {}

  const dx = x2 - x1
  const dy = y2 - y1
  const segLen = Math.sqrt(dx * dx + dy * dy)
  if (segLen < 1) return

  // Unit tangent along the line
  const tx = dx / segLen
  const ty = dy / segLen

  const count = Math.floor(segLen / spacing)
  const startOffset = (segLen - count * spacing) / 2

  ctx.save()
  ctx.strokeStyle = color
  ctx.globalAlpha = alpha
  ctx.lineWidth = lineWidth
  ctx.beginPath()

  for (let i = 0; i <= count; i++) {
    const t = startOffset + i * spacing
    const bx = x1 + tx * t
    const by = y1 + ty * t
    // Each hatch line goes from the base line into the normal direction,
    // angled 45° by mixing tangent and normal
    ctx.moveTo(bx, by)
    ctx.lineTo(bx + normalX * length - tx * length, by + normalY * length - ty * length)
  }

  ctx.stroke()
  ctx.restore()
}
