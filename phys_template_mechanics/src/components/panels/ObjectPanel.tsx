import { useRef, useState } from 'react'
import { COLORS, EDITOR_CHROME } from '@/styles/tokens'
import { getDescriptorsByCategory } from '@/models/bodyTypes'
import type { BodyTypeDescriptor } from '@/models/bodyTypes'
import { getJointDescriptor } from '@/models/jointTypes'
import type { JointType, SceneBody } from '@/models/types'
import { Tip } from '@/components/ui/Tip'
import { useViewportStore } from '@/store/viewportStore'
import { useSceneStore } from '@/store/sceneStore'
import { useCommandStore } from '@/store/commandStore'
import { useSelectionStore } from '@/store/selectionStore'
import { screenToWorld } from '@/renderer/CoordinateSystem'
import { computeSnap } from '@/core/snap/SnapEngine'
import { AddBodyCommand } from '@/core/commands/AddBodyCommand'
import { generateId, generateLabel } from '@/models/defaults'
import {
  setCurrentDragBodyType,
  setCurrentDragJointType,
  setPendingJointType,
} from './dragState'
import { resolveAssetUrl } from '@/runtime/assetBase'

const CATEGORIES = [
  { key: 'basic', title: '基础物体' },
  { key: 'support', title: '支撑与约束' },
  { key: 'surface', title: '特殊表面' },
]

/** Body types excluded from the object panel (ground is always present in the scene) */
const EXCLUDED_TYPES = new Set(['ground'])

const JOINT_PANEL_ITEMS: Array<{
  type: JointType
}> = [
  {
    type: 'rope',
  },
  {
    type: 'rod',
  },
  {
    type: 'spring',
  },
  {
    type: 'pulley',
  },
]

/** 1×1 transparent image used to hide the browser's default drag ghost */
const emptyDragImage = new Image()
emptyDragImage.src =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

function isCoarsePointerEnv(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
}

function createBodyAtCanvasCenter(desc: BodyTypeDescriptor): void {
  const viewport = useViewportStore.getState()
  const worldPos = screenToWorld(
    viewport.canvasSize.width / 2,
    viewport.canvasSize.height / 2,
    viewport,
  )
  const existingBodies = useSceneStore.getState().scene.bodies

  const newBody = {
    id: generateId(),
    type: desc.type,
    label: generateLabel(desc.type, existingBodies),
    position: worldPos,
    angle: 0,
    isStatic: false,
    fixedRotation: false,
    mass: 1,
    friction: 0.3,
    restitution: 0,
    initialVelocity: { x: 0, y: 0 },
    initialAcceleration: { x: 0, y: 0 },
    ...desc.defaults,
  } as SceneBody

  const snapResult = computeSnap(newBody, existingBodies, false)
  if (snapResult) {
    newBody.position = snapResult.position
    newBody.angle = snapResult.angle
  }

  const cmd = new AddBodyCommand(newBody)
  useCommandStore.getState().execute(cmd)
  useSelectionStore.getState().select({ type: 'body', id: newBody.id })
}

function DraggableItem({ desc }: { desc: BodyTypeDescriptor }) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const draggingRef = useRef(false)

  const handleDragStart = (e: React.DragEvent) => {
    draggingRef.current = true
    e.dataTransfer.setData('application/x-body-type', desc.type)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setDragImage(emptyDragImage, 0, 0)
    setCurrentDragBodyType(desc.type)
    setCurrentDragJointType(null)
    setPendingJointType(null)
  }

  const handleDragEnd = () => {
    setCurrentDragBodyType(null)
    requestAnimationFrame(() => {
      draggingRef.current = false
    })
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    // Touch emulation/mobiles do not reliably support HTML5 DnD; provide tap-to-create fallback.
    if (draggingRef.current) return
    if (e.pointerType !== 'touch' && !isCoarsePointerEnv()) return
    e.preventDefault()
    setCurrentDragBodyType(null)
    setCurrentDragJointType(null)
    setPendingJointType(null)
    createBodyAtCanvasCenter(desc)
  }

  const thumbnailSrc = resolveAssetUrl(`thumbnails/${desc.type}.png`)
  const Icon = desc.icon

  return (
    <Tip text="拖入画布可创建物体">
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onPointerUp={handlePointerUp}
        className="flex flex-col items-center gap-0.5 p-1.5 rounded cursor-grab active:cursor-grabbing active:opacity-50 select-none"
        style={{ transition: 'background-color 0.15s' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = COLORS.bgHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        {thumbnailFailed ? (
          <div
            className="w-full aspect-square flex items-center justify-center rounded"
            style={{ backgroundColor: COLORS.bgPage }}
          >
            <Icon size={40} />
          </div>
        ) : (
          <img
            src={thumbnailSrc}
            alt={desc.label}
            draggable={false}
            className="w-full aspect-square"
            style={{ objectFit: 'contain' }}
            onError={() => setThumbnailFailed(true)}
          />
        )}
        <span
          className="text-[10px] leading-tight text-center truncate w-full"
          style={{ color: COLORS.text }}
        >
          {desc.label}
        </span>
      </div>
    </Tip>
  )
}

function DraggableJointItem({
  type,
}: {
  type: JointType
}) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const desc = getJointDescriptor(type)
  if (!desc) return null

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-joint-type', type)
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setDragImage(emptyDragImage, 0, 0)
    // 避免 Canvas 将连接件拖拽误识别为物体拖拽预览
    setCurrentDragBodyType(null)
    setCurrentDragJointType(type)
    setPendingJointType(type)
  }

  const handleDragEnd = () => {
    setCurrentDragJointType(null)
  }

  const handleClick = () => {
    setCurrentDragBodyType(null)
    setPendingJointType(type)
  }

  const tooltip = `拖入画布后并选择要连接的物体可创建${desc.label}`
  const thumbnailSrc = resolveAssetUrl(`thumbnails/joint-${type}.png`)

  return (
    <Tip text={tooltip}>
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        className="flex flex-col items-center gap-0.5 p-1.5 rounded cursor-grab active:cursor-grabbing active:opacity-50 select-none"
        style={{ transition: 'background-color 0.15s' }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = COLORS.bgHover
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        {thumbnailFailed ? (
          <div
            className="w-full aspect-square flex items-center justify-center rounded border"
            style={{ borderColor: COLORS.border, backgroundColor: COLORS.bgPage }}
          >
            <span
              className="text-xl leading-none"
              style={{ color: COLORS.text }}
            >
              {desc.icon}
            </span>
          </div>
        ) : (
          <img
            src={thumbnailSrc}
            alt={desc.label}
            draggable={false}
            className="w-full aspect-square rounded border"
            style={{ objectFit: 'contain', borderColor: COLORS.border, backgroundColor: COLORS.white }}
            onError={() => setThumbnailFailed(true)}
          />
        )}
        <span
          className="text-[10px] leading-tight text-center truncate w-full"
          style={{ color: COLORS.text }}
        >
          {desc.label}
        </span>
      </div>
    </Tip>
  )
}

function ObjectGroup({ title, items }: { title: string; items: BodyTypeDescriptor[] }) {
  if (items.length === 0) return null

  return (
    <div className="mb-3">
      <div
        className="text-xs mb-1.5 font-semibold"
        style={{ color: COLORS.textSecondary }}
      >
        {title}
      </div>
      <div className="grid grid-cols-3 gap-1">
        {items.map((desc) => (
          <DraggableItem key={desc.type} desc={desc} />
        ))}
      </div>
    </div>
  )
}

function JointGroup() {
  return (
    <div className="mb-3">
      <div
        className="text-xs mb-1.5 font-semibold"
        style={{ color: COLORS.textSecondary }}
      >
        连接件
      </div>
      <div className="grid grid-cols-3 gap-1">
        {JOINT_PANEL_ITEMS.map((item) => (
          <DraggableJointItem
            key={item.type}
            type={item.type}
          />
        ))}
      </div>
    </div>
  )
}

export function ObjectPanel() {
  return (
    <div className="p-3" style={{ padding: EDITOR_CHROME.panelPadding }}>
      <h3
        className="text-xs font-semibold mb-3 uppercase tracking-wider"
        style={{
          color: COLORS.textMuted,
          fontSize: EDITOR_CHROME.panelTitleFontSize,
          letterSpacing: EDITOR_CHROME.panelTitleTracking,
        }}
      >
        物体库
      </h3>

      {CATEGORIES.map((cat) => {
        const items = getDescriptorsByCategory(cat.key).filter(
          (d) => !EXCLUDED_TYPES.has(d.type),
        )
        return (
          <ObjectGroup
            key={cat.key}
            title={cat.title}
            items={items}
          />
        )
      })}

      <JointGroup />
    </div>
  )
}
