/**
 * Dev-only thumbnail preview & export tool.
 * Access via: http://localhost:5173/#thumbnails
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { getAllDescriptors } from '@/models/bodyTypes'
import type { BodyTypeDescriptor } from '@/models/bodyTypes'
import { getAllJointDescriptors } from '@/models/jointTypes'
import type { JointTypeDescriptor } from '@/models/jointTypes'
import type { JointState } from '@/engine/types'
import type { JointType, SceneBody } from '@/models/types'
import { worldToScreen } from '@/renderer/CoordinateSystem'
import type { Viewport } from '@/renderer/CoordinateSystem'
import { COLORS } from '@/styles/tokens'

interface PreviewOptions {
  canvasSize: number
  bodyPaddingRatio: number
  bodyScaleBoost: number
  jointScale: number
}

const DEFAULT_OPTIONS: PreviewOptions = {
  canvasSize: 120,
  bodyPaddingRatio: 0.15,
  bodyScaleBoost: 1,
  jointScale: 34,
}

function createDefaultBody(desc: BodyTypeDescriptor): SceneBody {
  return {
    id: 'thumbnail',
    type: desc.type,
    label: desc.label,
    position: { x: 0, y: 0 },
    angle: 0,
    isStatic: desc.defaults.isStatic ?? false,
    fixedRotation: desc.defaults.fixedRotation ?? false,
    mass: desc.defaults.mass ?? 1,
    friction: desc.defaults.friction ?? 0.3,
    restitution: desc.defaults.restitution ?? 0,
    initialVelocity: { x: 0, y: 0 },
    initialAcceleration: { x: 0, y: 0 },
    ...desc.defaults,
  } as SceneBody
}

function computeAutoBodyScale(
  desc: BodyTypeDescriptor,
  body: SceneBody,
  options: PreviewOptions,
): number {
  const refScale = 1000
  const { halfW, halfH } = desc.getSelectionBounds(body, refScale)
  const widthM = Math.max((halfW * 2) / refScale, 0.01)
  const heightM = Math.max((halfH * 2) / refScale, 0.01)
  const availablePx = options.canvasSize * (1 - options.bodyPaddingRatio * 2)
  return Math.min(availablePx / widthM, availablePx / heightM) * options.bodyScaleBoost
}

function centerOpaquePixels(
  source: HTMLCanvasElement,
  target: HTMLCanvasElement,
  size: number,
): void {
  const targetCtx = target.getContext('2d')!
  const srcCtx = source.getContext('2d')!
  const imageData = srcCtx.getImageData(0, 0, size, size)
  const { data } = imageData

  let minX = size
  let minY = size
  let maxX = -1
  let maxY = -1

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const alpha = data[(y * size + x) * 4 + 3]
      if (alpha <= 8) continue
      minX = Math.min(minX, x)
      minY = Math.min(minY, y)
      maxX = Math.max(maxX, x)
      maxY = Math.max(maxY, y)
    }
  }

  targetCtx.clearRect(0, 0, size, size)
  if (maxX < 0 || maxY < 0) {
    targetCtx.drawImage(source, 0, 0)
    return
  }

  const centerX = (minX + maxX) / 2
  const centerY = (minY + maxY) / 2
  const targetCenter = (size - 1) / 2
  targetCtx.drawImage(source, targetCenter - centerX, targetCenter - centerY)
}

function createJointState(type: JointType): JointState {
  if (type === 'pulley') {
    return {
      id: 'thumb-joint',
      type: 'pulley',
      sceneType: 'pulley',
      anchorA: { x: -1.25, y: -0.35 },
      anchorB: { x: 1.25, y: -0.35 },
      groundA: { x: -0.42, y: 0.78 },
      groundB: { x: 0.42, y: 0.78 },
      length: 3,
    }
  }

  if (type === 'spring') {
    return {
      id: 'thumb-joint',
      type: 'distance',
      sceneType: 'spring',
      anchorA: { x: -1.2, y: 0 },
      anchorB: { x: 1.2, y: 0 },
      length: 2.4,
    }
  }

  if (type === 'rod') {
    return {
      id: 'thumb-joint',
      type: 'distance',
      sceneType: 'rod',
      anchorA: { x: -1.2, y: 0 },
      anchorB: { x: 1.2, y: 0 },
      length: 2.4,
    }
  }

  return {
    id: 'thumb-joint',
    type: 'rope',
    sceneType: 'rope',
    anchorA: { x: -1.2, y: 0 },
    anchorB: { x: 1.2, y: 0 },
    maxLength: 2.8,
  }
}

function drawPulleyWheelOverlay(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  state: JointState,
): void {
  if (!state.groundA || !state.groundB) return
  const cx = (state.groundA.x + state.groundB.x) / 2
  const cy = (state.groundA.y + state.groundB.y) / 2
  const radius = Math.hypot(state.groundA.x - cx, state.groundA.y - cy)
  const c = worldToScreen(cx, cy, viewport)
  const r = radius * viewport.scale

  ctx.save()
  ctx.strokeStyle = COLORS.dark
  ctx.fillStyle = COLORS.white
  ctx.lineWidth = 1.5
  ctx.beginPath()
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(c.x, c.y, Math.max(1.5, r * 0.14), 0, Math.PI * 2)
  ctx.fillStyle = COLORS.dark
  ctx.fill()
  ctx.restore()
}

function renderBodyThumbnail(
  canvas: HTMLCanvasElement,
  desc: BodyTypeDescriptor,
  options: PreviewOptions,
): void {
  const ctx = canvas.getContext('2d')!
  const buffer = document.createElement('canvas')
  buffer.width = options.canvasSize
  buffer.height = options.canvasSize
  const bctx = buffer.getContext('2d')!

  const body = createDefaultBody(desc)
  const scale = computeAutoBodyScale(desc, body, options)

  bctx.clearRect(0, 0, options.canvasSize, options.canvasSize)
  bctx.save()
  bctx.translate(options.canvasSize / 2, options.canvasSize / 2)
  bctx.fillStyle = COLORS.white
  bctx.strokeStyle = COLORS.dark
  bctx.lineWidth = 2
  desc.renderEdit(bctx, body, scale, false)
  bctx.restore()

  ctx.clearRect(0, 0, options.canvasSize, options.canvasSize)
  centerOpaquePixels(buffer, canvas, options.canvasSize)
}

function renderJointThumbnail(
  canvas: HTMLCanvasElement,
  desc: JointTypeDescriptor,
  options: PreviewOptions,
): void {
  const ctx = canvas.getContext('2d')!
  const buffer = document.createElement('canvas')
  buffer.width = options.canvasSize
  buffer.height = options.canvasSize
  const bctx = buffer.getContext('2d')!

  const viewport: Viewport = {
    offset: { x: 0, y: options.canvasSize / 2 },
    scale: options.jointScale,
    canvasSize: { width: options.canvasSize, height: options.canvasSize },
  }

  const state = createJointState(desc.type)
  bctx.clearRect(0, 0, options.canvasSize, options.canvasSize)
  desc.renderSim(bctx, state, viewport)
  if (desc.type === 'pulley') {
    drawPulleyWheelOverlay(bctx, viewport, state)
  }

  ctx.clearRect(0, 0, options.canvasSize, options.canvasSize)
  centerOpaquePixels(buffer, canvas, options.canvasSize)
}

function downloadCanvas(canvas: HTMLCanvasElement, filename: string): void {
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  })
}

function BodyThumbnailCard({
  desc,
  options,
}: {
  desc: BodyTypeDescriptor
  options: PreviewOptions
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    canvasRef.current.width = options.canvasSize
    canvasRef.current.height = options.canvasSize
    renderBodyThumbnail(canvasRef.current, desc, options)
  }, [desc, options])

  const handleDownload = () => {
    if (!canvasRef.current) return
    downloadCanvas(canvasRef.current, `${desc.type}.png`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <canvas
        ref={canvasRef}
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          background: COLORS.white,
        }}
      />
      <span style={{ fontSize: 12, color: COLORS.text }}>{desc.type}</span>
      <span style={{ fontSize: 11, color: COLORS.textMuted }}>{desc.label}</span>
      <button onClick={handleDownload} style={smallBtnStyle}>下载</button>
    </div>
  )
}

function JointThumbnailCard({
  desc,
  options,
}: {
  desc: JointTypeDescriptor
  options: PreviewOptions
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!canvasRef.current) return
    canvasRef.current.width = options.canvasSize
    canvasRef.current.height = options.canvasSize
    renderJointThumbnail(canvasRef.current, desc, options)
  }, [desc, options])

  const handleDownload = () => {
    if (!canvasRef.current) return
    downloadCanvas(canvasRef.current, `joint-${desc.type}.png`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <canvas
        ref={canvasRef}
        style={{
          border: `1px solid ${COLORS.border}`,
          borderRadius: 8,
          background: COLORS.white,
        }}
      />
      <span style={{ fontSize: 12, color: COLORS.text }}>{`joint-${desc.type}`}</span>
      <span style={{ fontSize: 11, color: COLORS.textMuted }}>{desc.label}</span>
      <button onClick={handleDownload} style={smallBtnStyle}>下载</button>
    </div>
  )
}

const smallBtnStyle: CSSProperties = {
  padding: '4px 10px',
  fontSize: 12,
  background: COLORS.bgPage,
  color: COLORS.text,
  border: `1px solid ${COLORS.border}`,
  borderRadius: 6,
  cursor: 'pointer',
}

const rangeStyle: CSSProperties = {
  width: 200,
}

export function ThumbnailGenerator() {
  const [options, setOptions] = useState<PreviewOptions>(DEFAULT_OPTIONS)

  const bodyDescriptors = useMemo(
    () => getAllDescriptors().filter((d) => d.type !== 'ground'),
    [],
  )
  const jointDescriptors = useMemo(() => getAllJointDescriptors(), [])

  const handleDownloadAll = () => {
    for (const desc of bodyDescriptors) {
      const canvas = document.createElement('canvas')
      canvas.width = options.canvasSize
      canvas.height = options.canvasSize
      renderBodyThumbnail(canvas, desc, options)
      downloadCanvas(canvas, `${desc.type}.png`)
    }

    for (const desc of jointDescriptors) {
      const canvas = document.createElement('canvas')
      canvas.width = options.canvasSize
      canvas.height = options.canvasSize
      renderJointThumbnail(canvas, desc, options)
      downloadCanvas(canvas, `joint-${desc.type}.png`)
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'sans-serif', color: COLORS.text }}>
      <h1 style={{ fontSize: 22, marginBottom: 8 }}>Thumbnail Preview Studio</h1>
      <p style={{ fontSize: 14, color: COLORS.textSecondary, marginBottom: 16 }}>
        在这里实时预览并调节缩略图（物体 + 连接件）。调好后下载并放到
        <code> public/thumbnails/ </code>。
        连接件文件名为 <code>joint-*.png</code>。
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 18,
          padding: 12,
          border: `1px solid ${COLORS.border}`,
          borderRadius: 10,
          background: COLORS.bgPage,
        }}
      >
        <label style={{ fontSize: 13 }}>
          画布尺寸: {options.canvasSize}px
          <br />
          <input
            type="range"
            min={80}
            max={192}
            step={4}
            value={options.canvasSize}
            style={rangeStyle}
            onChange={(e) => setOptions((prev) => ({ ...prev, canvasSize: Number(e.target.value) }))}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          物体边距: {options.bodyPaddingRatio.toFixed(2)}
          <br />
          <input
            type="range"
            min={0.05}
            max={0.3}
            step={0.01}
            value={options.bodyPaddingRatio}
            style={rangeStyle}
            onChange={(e) => setOptions((prev) => ({ ...prev, bodyPaddingRatio: Number(e.target.value) }))}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          物体缩放系数: {options.bodyScaleBoost.toFixed(2)}x
          <br />
          <input
            type="range"
            min={0.7}
            max={1.6}
            step={0.02}
            value={options.bodyScaleBoost}
            style={rangeStyle}
            onChange={(e) => setOptions((prev) => ({ ...prev, bodyScaleBoost: Number(e.target.value) }))}
          />
        </label>

        <label style={{ fontSize: 13 }}>
          连接件缩放: {options.jointScale.toFixed(0)} px/m
          <br />
          <input
            type="range"
            min={18}
            max={60}
            step={1}
            value={options.jointScale}
            style={rangeStyle}
            onChange={(e) => setOptions((prev) => ({ ...prev, jointScale: Number(e.target.value) }))}
          />
        </label>
      </div>

      <button
        onClick={handleDownloadAll}
        style={{
          padding: '8px 16px',
          fontSize: 14,
          background: COLORS.primary,
          color: COLORS.white,
          border: 'none',
          borderRadius: 8,
          cursor: 'pointer',
          marginBottom: 22,
        }}
      >
        Download All ({bodyDescriptors.length + jointDescriptors.length})
      </button>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>物体缩略图</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        {bodyDescriptors.map((desc) => (
          <BodyThumbnailCard key={desc.type} desc={desc} options={options} />
        ))}
      </div>

      <h2 style={{ fontSize: 16, marginBottom: 10 }}>连接件缩略图</h2>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
        {jointDescriptors.map((desc) => (
          <JointThumbnailCard key={desc.type} desc={desc} options={options} />
        ))}
      </div>
    </div>
  )
}
