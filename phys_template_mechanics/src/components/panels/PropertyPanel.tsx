import { useCallback, useRef, useState } from 'react'
import { useSelectionStore } from '@/store/selectionStore'
import { useSceneStore } from '@/store/sceneStore'
import { useEditorStore } from '@/store/editorStore'
import { useCommandStore } from '@/store/commandStore'
import { useForceDisplayStore, forceKey } from '@/store/forceDisplayStore'
import { ChangePropertyCommand } from '@/core/commands/ChangePropertyCommand'
import { ChangeJointPropertyCommand } from '@/core/commands/ChangeJointPropertyCommand'
import { ChangeForcePropertyCommand } from '@/core/commands/ChangeForcePropertyCommand'
import { BatchMoveCommand } from '@/core/commands/BatchMoveCommand'
import { RemoveBodyCommand } from '@/core/commands/RemoveBodyCommand'
import { RemoveJointCommand } from '@/core/commands/RemoveJointCommand'
import { RemoveForceCommand } from '@/core/commands/RemoveForceCommand'
import { AddForceCommand } from '@/core/commands/AddForceCommand'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { COLORS, EDITOR_CHROME, FEEDBACK_VISUAL } from '@/styles/tokens'
import type { SceneBody, SceneJoint, SceneForce } from '@/models/types'
import { getBodyDescriptor, getInteraction } from '@/models/bodyTypes'
import { getGroundContactBodyIds } from '@/core/snap/SnapEngine'
import type { PropertyDef } from '@/models/bodyTypes'
import { getJointDescriptor } from '@/models/jointTypes'
import type { JointPropertyDef } from '@/models/jointTypes'
import { getForceVisual } from '@/renderer/ForceRenderer'
import type { ForceData } from '@/engine/types'
import { generateId } from '@/models/defaults'
import { Trash2, Info, RotateCcw, Plus, Eye, EyeOff, Split, Group } from 'lucide-react'
import { useAnalysisStore } from '@/store/analysisStore'
import { usePropertyPanelStore } from '@/store/propertyPanelStore'
import { useModuleWorkspaceStore } from '@/store/moduleWorkspaceStore'
import { getChartColor } from '@/components/charts/chartColors'
import { Tip } from '@/components/ui/Tip'
import { clampNumber, normalizeNumberInput, parseFiniteNumber } from '@/lib/utils/number'
import {
  computeFm041TeachingState,
  FM041_DISK_BODY_ID,
  FM041_SCENE_ID,
  FM041_SLIDER_BODY_ID,
} from '@/templates/fm041Teaching'

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false)

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          className="absolute left-5 bottom-0 text-xs px-2 py-1 rounded z-50"
          style={{
            backgroundColor: COLORS.dark,
            color: COLORS.white,
            pointerEvents: 'none',
            width: 180,
            lineHeight: '1.4',
          }}
        >
          {text}
        </span>
      )}
    </span>
  )
}

function PropertyRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2 mb-2">
      <span
        className="text-xs flex-shrink-0"
        style={{ color: COLORS.textSecondary, minWidth: 56 }}
      >
        {label}
      </span>
      <div className="flex-1">{children}</div>
    </div>
  )
}

/**
 * NumberInput with real-time preview + Command on blur.
 * During typing, directly updates sceneStore for instant canvas feedback.
 * On blur, creates a Command for undo/redo support.
 */
function NumberInput({
  value,
  onLiveChange,
  onCommit,
  step = 0.1,
  min,
  max,
}: {
  value: number
  onLiveChange?: (v: number) => void
  onCommit: (v: number) => void
  step?: number
  min?: number
  max?: number
}) {
  const [localValue, setLocalValue] = useState(String(value))
  const [lastExternalValue, setLastExternalValue] = useState(value)
  const [committedValue, setCommittedValue] = useState(value)
  const [inputInvalid, setInputInvalid] = useState(false)

  if (value !== lastExternalValue) {
    setLastExternalValue(value)
    setLocalValue(String(value))
    setCommittedValue(value)
    setInputInvalid(false)
  }

  const getStepPrecision = (stepValue: number): number => {
    const text = String(stepValue)
    if (text.includes('e-')) {
      const [, exp] = text.split('e-')
      const parsed = Number(exp)
      return Number.isFinite(parsed) ? parsed : 0
    }
    const dotIdx = text.indexOf('.')
    return dotIdx >= 0 ? text.length - dotIdx - 1 : 0
  }
  const precision = Math.max(0, getStepPrecision(step))
  const normalizeValue = (raw: string) =>
    normalizeNumberInput(raw, { min, max, precision })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    setLocalValue(raw)
    const parsed = parseFiniteNumber(raw)
    if (parsed !== null) {
      const clamped = clampNumber(parsed, { min, max })
      onLiveChange?.(clamped)
      setInputInvalid(false)
      return
    }
    setInputInvalid(raw.trim().length > 0)
  }

  const handleBlur = () => {
    const normalized = normalizeValue(localValue)
    if (normalized === null) {
      setLocalValue(String(value))
      setInputInvalid(false)
      return
    }

    setLocalValue(String(normalized))
    setInputInvalid(false)
    if (normalized !== committedValue) {
      onCommit(normalized)
      setCommittedValue(normalized)
    }
  }

  return (
    <Input
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
      step={step}
      min={min}
      max={max}
      aria-invalid={inputInvalid}
      className="h-7 px-2 py-1 text-xs"
      style={inputInvalid ? { borderColor: COLORS.error } : undefined}
      title={inputInvalid ? '请输入有效数字' : undefined}
    />
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="text-xs font-semibold mb-2 mt-3 pb-1"
      style={{ color: COLORS.textSecondary, borderBottom: `1px solid ${COLORS.border}` }}
    >
      {children}
    </div>
  )
}

function formatGravityG(value: number): string {
  return Number(value.toFixed(3)).toString()
}

function EnvironmentSettingsPanel() {
  const gravity = useSceneStore((s) => s.scene.settings.gravity)
  const setGravity = useSceneStore((s) => s.setGravity)
  const [gInput, setGInput] = useState(formatGravityG(Math.abs(gravity.y)))
  const [lastGravityY, setLastGravityY] = useState(gravity.y)
  const [error, setError] = useState<string | null>(null)

  if (gravity.y !== lastGravityY) {
    setLastGravityY(gravity.y)
    setGInput(formatGravityG(Math.abs(gravity.y)))
  }

  const applyGravity = useCallback(
    (raw: string): boolean => {
      const parsed = Number(raw.trim())
      if (!Number.isFinite(parsed)) {
        setError('请输入有效数字')
        return false
      }
      if (parsed <= 0 || parsed > 50) {
        setError('请输入 0-50 范围内的重力加速度')
        return false
      }

      const normalized = Number(parsed.toFixed(3))
      setGravity({ x: gravity.x, y: -Math.abs(normalized) })
      setGInput(formatGravityG(normalized))
      setError(null)
      return true
    },
    [gravity.x, setGravity],
  )

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
        环境配置
      </h3>

      <SectionTitle>重力加速度</SectionTitle>

      <PropertyRow label="g (m/s²)">
        <Input
          type="number"
          value={gInput}
          onChange={(e) => {
            setGInput(e.target.value)
            if (error) setError(null)
          }}
          onBlur={() => {
            applyGravity(gInput)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              applyGravity(gInput)
              e.currentTarget.blur()
            }
          }}
          step={0.1}
          min={0}
          max={50}
          className="h-7 px-2 py-1 text-xs"
        />
      </PropertyRow>

      {error && (
        <p className="text-xs mt-2" style={{ color: COLORS.error }}>
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * Slider + NumberInput combo.
 * Slider drags update sceneStore directly for live preview.
 * On slider release / input blur, a Command is created for undo.
 */
function SliderWithInput({
  value,
  bodyId,
  propKey,
  min = 0,
  max = 1,
  step = 0.01,
  displayPrecision = 2,
}: {
  value: number
  bodyId: string
  propKey: keyof SceneBody
  min?: number
  max?: number
  step?: number
  displayPrecision?: number
}) {
  const startValueRef = useRef(value)

  const handleSliderChange = ([v]: number[]) => {
    const rounded = parseFloat(v.toFixed(displayPrecision))
    useSceneStore.getState().updateBody(bodyId, { [propKey]: rounded } as Partial<SceneBody>)
  }

  const handleSliderPointerDown = () => {
    startValueRef.current = value
  }

  const handleSliderPointerUp = () => {
    const currentBody = useSceneStore.getState().scene.bodies.find((b) => b.id === bodyId)
    if (!currentBody) return
    const endValue = currentBody[propKey] as number
    if (endValue !== startValueRef.current) {
      const cmd = new ChangePropertyCommand(bodyId, propKey, startValueRef.current, endValue)
      useCommandStore.getState().pushExecuted(cmd)
    }
  }

  const handleInputCommit = (v: number) => {
    const cmd = new ChangePropertyCommand(bodyId, propKey, value, v)
    useCommandStore.getState().execute(cmd)
  }

  const handleInputLive = (v: number) => {
    useSceneStore.getState().updateBody(bodyId, { [propKey]: v } as Partial<SceneBody>)
  }

  return (
    <div className="flex gap-2 items-center">
      <div
        className="flex-1"
        onPointerDown={handleSliderPointerDown}
        onPointerUp={handleSliderPointerUp}
      >
        <Slider
          value={[value]}
          onValueChange={handleSliderChange}
          min={min}
          max={max}
          step={step}
        />
      </div>
      <div className="w-14">
        <NumberInput
          value={parseFloat(value.toFixed(displayPrecision))}
          onCommit={handleInputCommit}
          onLiveChange={handleInputLive}
          step={step}
          min={min}
          max={max}
        />
      </div>
    </div>
  )
}

/** Render a single property from PropertyDef */
function PropertyField({
  prop,
  body,
  changeProperty,
  liveUpdate,
}: {
  prop: PropertyDef
  body: SceneBody
  changeProperty: (key: keyof SceneBody, oldValue: unknown, newValue: unknown) => void
  liveUpdate: (key: keyof SceneBody, value: unknown) => void
}) {
  if (prop.type === 'select') {
    return (
      <PropertyRow label={prop.label}>
        <select
          value={String(body[prop.key] ?? '')}
          onChange={(e) => {
            changeProperty(prop.key, body[prop.key], e.target.value)
          }}
          className="h-7 px-2 py-0.5 text-xs rounded w-full"
          style={{
            backgroundColor: COLORS.bgMuted,
            color: COLORS.text,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          {prop.options!.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </PropertyRow>
    )
  }

  // Number type
  const rawValue = body[prop.key] as number
  const displayValue = prop.toDisplay ? prop.toDisplay(rawValue) : rawValue
  const toStored = prop.fromDisplay ?? ((v: number) => v)

  return (
    <PropertyRow label={prop.label}>
      <NumberInput
        value={displayValue}
        onLiveChange={(v) => liveUpdate(prop.key, toStored(v))}
        onCommit={(v) => changeProperty(prop.key, body[prop.key], toStored(v))}
        step={prop.step}
        min={prop.min}
        max={prop.max}
      />
    </PropertyRow>
  )
}

export function PropertyPanel() {
  const selected = useSelectionStore((s) => s.selected)
  const scene = useSceneStore((s) => s.scene)
  const editorMode = useEditorStore((s) => s.mode)

  // 单选物体
  const singleBody =
    selected.length === 1 && selected[0].type === 'body'
      ? scene.bodies.find((b) => b.id === selected[0].id) ?? null
      : null

  // 单选约束
  const singleJoint =
    selected.length === 1 && selected[0].type === 'joint'
      ? scene.joints.find((j) => j.id === selected[0].id)
      : null

  // 多选
  const isMultiSelect = selected.length > 1

  const activeTab = usePropertyPanelStore((s) => s.activeTab)

  const liveUpdate = useCallback(
    (key: keyof SceneBody, value: unknown) => {
      if (!singleBody) return
      useSceneStore.getState().updateBody(singleBody.id, { [key]: value } as Partial<SceneBody>)
    },
    [singleBody],
  )

  const changeProperty = useCallback(
    (key: keyof SceneBody, oldValue: unknown, newValue: unknown) => {
      if (!singleBody) return
      const cmd = new ChangePropertyCommand(singleBody.id, key, oldValue, newValue)
      useCommandStore.getState().execute(cmd)
    },
    [singleBody],
  )

  const handleDelete = useCallback(() => {
    if (!singleBody || !getInteraction(singleBody).canDelete) return
    const cmd = new RemoveBodyCommand(singleBody)
    useCommandStore.getState().execute(cmd)
    useSelectionStore.getState().clearSelection()
  }, [singleBody])

  // 多选面板
  if (isMultiSelect) {
    return <MultiSelectPanel selected={selected} scene={scene} />
  }

  // Joint: no tabs
  if (singleJoint) {
    return <JointPropertyPanel joint={singleJoint} />
  }

  if (!singleBody) {
    return <EnvironmentSettingsPanel />
  }

  return (
    <div className="h-full overflow-y-auto">
      {activeTab === 'props' ? (
        <BodyPropertyContent
          body={singleBody}
          liveUpdate={liveUpdate}
          changeProperty={changeProperty}
          handleDelete={handleDelete}
        />
      ) : activeTab === 'motion' ? (
        <InitialMotionTab
          body={singleBody}
          liveUpdate={liveUpdate}
          changeProperty={changeProperty}
        />
      ) : (
        <ForceAnalysisTab body={singleBody} editorMode={editorMode} />
      )}
    </div>
  )
}

export function PropertyPanelTabBar() {
  const activeTab = usePropertyPanelStore((s) => s.activeTab)
  const setActiveTab = usePropertyPanelStore((s) => s.setActiveTab)

  return (
    <div className="flex h-full w-full">
      <TabButton active={activeTab === 'props'} onClick={() => setActiveTab('props')}>
        属性
      </TabButton>
      <TabButton active={activeTab === 'forces'} onClick={() => setActiveTab('forces')}>
        力
      </TabButton>
      <TabButton active={activeTab === 'motion'} onClick={() => setActiveTab('motion')}>
        初始运动
      </TabButton>
    </div>
  )
}

/** Multi-select summary panel */
function MultiSelectPanel({
  selected,
  scene,
}: {
  selected: import('@/store/selectionStore').SelectableObject[]
  scene: import('@/models/types').Scene
}) {
  const bodyItems = selected.filter(s => s.type === 'body')
  const jointItems = selected.filter(s => s.type === 'joint')
  const analysisGroups = useAnalysisStore(s => s.analysisGroups)
  const addGroup = useAnalysisStore(s => s.addGroup)

  // 可分析物体（非 static）用于创建分析组
  const analyzableBodyIds = bodyItems
    .map(s => scene.bodies.find(b => b.id === s.id))
    .filter((b): b is NonNullable<typeof b> => !!b && !b.isStatic)
    .map(b => b.id)

  const handleCreateGroup = () => {
    if (analyzableBodyIds.length < 2) return
    const dynamicBodies = scene.bodies.filter(b => !b.isStatic)
    const colorIdx = dynamicBodies.length + analysisGroups.length
    addGroup({
      id: generateId(),
      name: '', // 自动命名
      bodyIds: analyzableBodyIds,
      color: getChartColor(colorIdx),
    })
  }

  const handleDeleteAll = () => {
    for (const sel of selected) {
      if (sel.type === 'body') {
        const body = scene.bodies.find(b => b.id === sel.id)
        if (body && getInteraction(body).canDelete) {
          const cmd = new RemoveBodyCommand(body)
          useCommandStore.getState().execute(cmd)
        }
      } else if (sel.type === 'joint') {
        const joint = scene.joints.find(j => j.id === sel.id)
        if (joint) {
          const cmd = new RemoveJointCommand(joint)
          useCommandStore.getState().execute(cmd)
        }
      }
    }
    useSelectionStore.getState().clearSelection()
  }

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
        已选中 {selected.length} 个对象
      </h3>

      {bodyItems.length > 0 && (
        <>
          <SectionTitle>物体 ({bodyItems.length})</SectionTitle>
          <div className="space-y-1">
            {bodyItems.map(sel => {
              const body = scene.bodies.find(b => b.id === sel.id)
              if (!body) return null
              return (
                <div key={sel.id} className="flex items-center gap-2 text-xs py-0.5">
                  <span style={{ color: COLORS.text }}>{body.label}</span>
                  <span style={{ color: COLORS.textMuted }}>
                    {(() => { try { return getBodyDescriptor(body.type).label } catch { return body.type } })()}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {jointItems.length > 0 && (
        <>
          <SectionTitle>约束 ({jointItems.length})</SectionTitle>
          <div className="space-y-1">
            {jointItems.map(sel => {
              const joint = scene.joints.find(j => j.id === sel.id)
              if (!joint) return null
              return (
                <div key={sel.id} className="flex items-center gap-2 text-xs py-0.5">
                  <span style={{ color: COLORS.text }}>{joint.label}</span>
                  <span style={{ color: COLORS.textMuted }}>{joint.type}</span>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* 创建分析组 */}
      {analyzableBodyIds.length >= 2 && (
        <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleCreateGroup}
            className="w-full"
          >
            <Group size={14} />
            创建分析组 ({analyzableBodyIds.length} 个物体)
          </Button>
        </div>
      )}

      <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <Button
          size="sm"
          variant="danger"
          onClick={handleDeleteAll}
          className="w-full"
        >
          <Trash2 size={14} />
          删除选中 ({selected.length})
        </Button>
      </div>
    </div>
  )
}

/** Tab button component */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      className="flex-1 h-full text-xs relative flex items-end justify-center pb-1.5 leading-none"
      style={{
        color: active ? FEEDBACK_VISUAL.selectedColor : COLORS.textSecondary,
        fontWeight: active ? 600 : 400,
      }}
      onClick={onClick}
    >
      {children}
      {active && (
        <div
          className="absolute bottom-0 left-2 right-2 h-0.5"
          style={{ backgroundColor: FEEDBACK_VISUAL.selectedColor }}
        />
      )}
    </button>
  )
}

/** Body property content (extracted from original PropertyPanel) */
function BodyPropertyContent({
  body,
  liveUpdate,
  changeProperty,
  handleDelete,
}: {
  body: SceneBody
  liveUpdate: (key: keyof SceneBody, value: unknown) => void
  changeProperty: (key: keyof SceneBody, oldValue: unknown, newValue: unknown) => void
  handleDelete: () => void
}) {
  const scene = useSceneStore((s) => s.scene)
  const activeSceneId = useModuleWorkspaceStore((s) => s.activeSceneId)
  const angleDeg = Math.round((body.angle * 180) / Math.PI * 10) / 10
  const slopeInclineDeg = body.type === 'slope'
    ? Math.round((Math.atan2(body.slopeHeight ?? 0, body.baseLength ?? 1) * 180) / Math.PI * 10) / 10
    : 0
  const showFm041TeachingPanel = activeSceneId === FM041_SCENE_ID
    && (body.id === FM041_DISK_BODY_ID || body.id === FM041_SLIDER_BODY_ID)

  // Get descriptor for shape-specific properties
  let shapeProperties: PropertyDef[] = []
  try {
    const desc = getBodyDescriptor(body.type)
    shapeProperties = desc.properties
  } catch {
    // Unknown type, no shape properties
  }

  // 地面联动：PropertyPanel 修改地面 Y 时同步移动接触物体
  const groundContactRef = useRef<{
    ids: string[]
    startPositions: Map<string, { x: number; y: number }>
    groundStartY: number
  } | null>(null)

  const groundLiveUpdateY = useCallback(
    (newY: number) => {
      if (!groundContactRef.current) {
        const allBodies = useSceneStore.getState().scene.bodies
        const contactIds = getGroundContactBodyIds(body.position.y, allBodies)
        const startPositions = new Map<string, { x: number; y: number }>()
        for (const cid of contactIds) {
          const b = allBodies.find(bd => bd.id === cid)
          if (b) startPositions.set(cid, { ...b.position })
        }
        groundContactRef.current = { ids: contactIds, startPositions, groundStartY: body.position.y }
      }
      useSceneStore.getState().updateBody(body.id, { position: { ...body.position, y: newY } })
      const dy = newY - groundContactRef.current.groundStartY
      for (const cid of groundContactRef.current.ids) {
        const sp = groundContactRef.current.startPositions.get(cid)
        if (sp) useSceneStore.getState().moveBody(cid, { x: sp.x, y: sp.y + dy })
      }
      // 动态检测：地面上移碰到新物体时纳入联动
      const updatedBodies = useSceneStore.getState().scene.bodies
      const nowContactIds = getGroundContactBodyIds(newY, updatedBodies)
      for (const cid of nowContactIds) {
        if (!groundContactRef.current.startPositions.has(cid)) {
          const cb = updatedBodies.find(b => b.id === cid)
          if (cb) {
            groundContactRef.current.ids.push(cid)
            groundContactRef.current.startPositions.set(cid, { x: cb.position.x, y: cb.position.y - dy })
          }
        }
      }
    },
    [body],
  )

  const groundCommitY = useCallback(
    (newY: number) => {
      const snapshot = groundContactRef.current
      groundContactRef.current = null
      if (!snapshot) {
        changeProperty('position', body.position, { ...body.position, y: newY })
        return
      }
      const moves: { bodyId: string; fromPos: { x: number; y: number }; toPos: { x: number; y: number } }[] = []
      moves.push({ bodyId: body.id, fromPos: { ...body.position, y: snapshot.groundStartY }, toPos: { ...body.position, y: newY } })
      const dy = newY - snapshot.groundStartY
      for (const cid of snapshot.ids) {
        const sp = snapshot.startPositions.get(cid)
        if (sp) moves.push({ bodyId: cid, fromPos: sp, toPos: { x: sp.x, y: sp.y + dy } })
      }
      const cmd = new BatchMoveCommand(moves)
      useCommandStore.getState().pushExecuted(cmd)
    },
    [body, changeProperty],
  )

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
        属性 - {body.label}
      </h3>

      {/* Label */}
      <PropertyRow label="标签">
        <Input
          value={body.label}
          onChange={() => {}}
          onBlur={(e) => {
            const newVal = e.currentTarget.value
            if (newVal !== body.label) {
              changeProperty('label', body.label, newVal)
            }
          }}
          className="h-7 px-2 py-1 text-xs"
        />
      </PropertyRow>

      <SectionTitle>位置与角度</SectionTitle>

      {/* Position */}
      <div className="flex gap-2 mb-2">
        <div className="flex-1">
          <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>X</span>
          <NumberInput
            value={Math.round(body.position.x * 100) / 100}
            onLiveChange={(v) =>
              liveUpdate('position', { ...body.position, x: v })
            }
            onCommit={(v) =>
              changeProperty('position', body.position, { ...body.position, x: v })
            }
          />
        </div>
        <div className="flex-1">
          <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>Y</span>
          <NumberInput
            value={Math.round(body.position.y * 100) / 100}
            onLiveChange={(v) =>
              body.type === 'ground'
                ? groundLiveUpdateY(v)
                : liveUpdate('position', { ...body.position, y: v })
            }
            onCommit={(v) =>
              body.type === 'ground'
                ? groundCommitY(v)
                : changeProperty('position', body.position, { ...body.position, y: v })
            }
          />
        </div>
      </div>

      {/* Angle */}
      <PropertyRow label="角度 (°)">
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Slider
              value={[angleDeg]}
              onValueChange={([v]) =>
                liveUpdate('angle', (v * Math.PI) / 180)
              }
              min={-180}
              max={180}
              step={1}
            />
          </div>
          <div className="w-14">
            <NumberInput
              value={angleDeg}
              onLiveChange={(v) => liveUpdate('angle', (v * Math.PI) / 180)}
              onCommit={(v) =>
                changeProperty('angle', body.angle, (v * Math.PI) / 180)
              }
              step={1}
              min={-180}
              max={180}
            />
          </div>
        </div>
      </PropertyRow>

      <SectionTitle>物理属性</SectionTitle>

      {/* Mass — hidden for always-static types */}
      {!body.isStatic && (
        <PropertyRow label="质量 (kg)">
          <NumberInput
            value={body.mass}
            onLiveChange={(v) => liveUpdate('mass', v)}
            onCommit={(v) => changeProperty('mass', body.mass, v)}
            step={0.1}
            min={0.01}
          />
        </PropertyRow>
      )}

      {/* Friction */}
      <PropertyRow label="摩擦系数">
        <SliderWithInput
          value={body.friction}
          bodyId={body.id}
          propKey="friction"
          min={0}
          max={1}
          step={0.01}
        />
      </PropertyRow>

      {/* Restitution */}
      <PropertyRow label="弹性系数">
        <SliderWithInput
          value={body.restitution}
          bodyId={body.id}
          propKey="restitution"
          min={0}
          max={1}
          step={0.01}
        />
      </PropertyRow>

      {/* Shape-specific properties (data-driven from registry) */}
      {shapeProperties.length > 0 && (
        <>
          <SectionTitle>形状</SectionTitle>
          {body.type === 'slope' && (
            <PropertyRow label="斜面倾角 (°)">
              <NumberInput
                value={slopeInclineDeg}
                onLiveChange={(v) => {
                  const radians = Math.max(1, Math.min(85, v)) * Math.PI / 180
                  const baseLength = Math.max(body.baseLength ?? 0.5, 0.5)
                  liveUpdate('slopeHeight', Number((baseLength * Math.tan(radians)).toFixed(3)))
                }}
                onCommit={(v) => {
                  const radians = Math.max(1, Math.min(85, v)) * Math.PI / 180
                  const baseLength = Math.max(body.baseLength ?? 0.5, 0.5)
                  changeProperty(
                    'slopeHeight',
                    body.slopeHeight,
                    Number((baseLength * Math.tan(radians)).toFixed(3)),
                  )
                }}
                step={1}
                min={1}
                max={85}
              />
            </PropertyRow>
          )}
          {shapeProperties.map((prop) => (
            <PropertyField
              key={String(prop.key)}
              prop={prop}
              body={body}
              changeProperty={changeProperty}
              liveUpdate={liveUpdate}
            />
          ))}
        </>
      )}

      {/* Switches */}
      <SectionTitle>选项</SectionTitle>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs flex items-center gap-1" style={{ color: COLORS.textSecondary }}>
          静态物体
          <Tooltip text="不受重力和碰撞影响，固定在原位。适合做地板、墙壁、平台等障碍物。">
            <Info size={12} style={{ color: COLORS.textPlaceholder }} />
          </Tooltip>
        </span>
        <Switch
          checked={body.isStatic}
          onCheckedChange={(v) => changeProperty('isStatic', body.isStatic, v)}
        />
      </div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-xs flex items-center gap-1" style={{ color: COLORS.textSecondary }}>
          锁定旋转
          <Tooltip text="受力碰撞时只平移不旋转。适合让物块沿斜面滑行而不翻滚。">
            <Info size={12} style={{ color: COLORS.textPlaceholder }} />
          </Tooltip>
        </span>
        <Switch
          checked={body.fixedRotation}
          onCheckedChange={(v) =>
            changeProperty('fixedRotation', body.fixedRotation, v)
          }
        />
      </div>

      {showFm041TeachingPanel && (
        <Fm041TeachingPanel
          scene={scene}
          selectedBodyId={body.id}
        />
      )}

      {/* Delete */}
      {getInteraction(body).canDelete && (
        <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
          <Button
            size="sm"
            variant="danger"
            onClick={handleDelete}
            className="w-full"
          >
            <Trash2 size={14} />
            删除物体
          </Button>
        </div>
      )}
    </div>
  )
}

function Fm041TeachingPanel({
  scene,
  selectedBodyId,
}: {
  scene: import('@/models/types').Scene
  selectedBodyId: string
}) {
  const disk = scene.bodies.find((body) => body.id === FM041_DISK_BODY_ID)
  const teachingState = computeFm041TeachingState(scene)

  if (!disk || !teachingState) return null

  const statusMeta = {
    stable: {
      label: '未打滑',
      color: COLORS.success,
      bg: COLORS.successLight,
      description: '静摩擦力足以提供所需向心力，滑块可随盘转动。',
    },
    critical: {
      label: '临界',
      color: COLORS.warning,
      bg: COLORS.warningLight,
      description: '所需向心力已逼近最大静摩擦力，继续增大角速度就会打滑。',
    },
    slipping: {
      label: '将打滑',
      color: COLORS.error,
      bg: COLORS.errorLight,
      description: '所需向心力已超过最大静摩擦力，滑块开始相对圆盘打滑，受力标签会切换为 f滑。',
    },
  }[teachingState.state]

  const liveUpdateOmega = (omega: number) => {
    useSceneStore.getState().updateBody(disk.id, {
      initialVelocity: {
        ...disk.initialVelocity,
        x: Math.max(0, omega),
      },
    })
  }

  const commitOmega = (omega: number) => {
    const nextVelocity = {
      ...disk.initialVelocity,
      x: Math.max(0, omega),
    }
    const cmd = new ChangePropertyCommand(disk.id, 'initialVelocity', disk.initialVelocity, nextVelocity)
    useCommandStore.getState().execute(cmd)
  }

  return (
    <>
      <SectionTitle>圆盘教学参数</SectionTitle>

      <PropertyRow label="角速度 ω">
        <div className="flex gap-2 items-center">
          <div className="flex-1">
            <Slider
              value={[teachingState.omega]}
              onValueChange={([v]) => liveUpdateOmega(v)}
              min={0}
              max={8}
              step={0.1}
            />
          </div>
          <div className="w-14">
            <NumberInput
              value={Number(teachingState.omega.toFixed(2))}
              onLiveChange={liveUpdateOmega}
              onCommit={commitOmega}
              step={0.1}
              min={0}
              max={8}
            />
          </div>
        </div>
      </PropertyRow>

      <div
        className="rounded-md px-2.5 py-2 mb-2"
        style={{
          backgroundColor: statusMeta.bg,
          border: `1px solid ${statusMeta.color}`,
        }}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold" style={{ color: statusMeta.color }}>
            状态：{statusMeta.label}
          </span>
          <span className="text-[11px]" style={{ color: COLORS.textSecondary }}>
            ω临 ≈ {teachingState.criticalOmega.toFixed(2)} rad/s
          </span>
        </div>
        <p className="text-[11px] mt-1 leading-relaxed" style={{ color: COLORS.textSecondary }}>
          {statusMeta.description}
        </p>
      </div>

      <div className="space-y-1.5 mb-2">
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: COLORS.textSecondary }}>半径 r</span>
          <span style={{ color: COLORS.text }}>{teachingState.radius.toFixed(2)} m</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: COLORS.textSecondary }}>线速度 v = ωr</span>
          <span style={{ color: COLORS.text }}>{teachingState.tangentialSpeed.toFixed(2)} m/s</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: COLORS.textSecondary }}>所需向心力 mω²r</span>
          <span style={{ color: COLORS.text }}>{teachingState.requiredCentripetalForce.toFixed(2)} N</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span style={{ color: COLORS.textSecondary }}>最大静摩擦力 μmg</span>
          <span style={{ color: COLORS.text }}>{teachingState.maxStaticFriction.toFixed(2)} N</span>
        </div>
      </div>

      {selectedBodyId === FM041_DISK_BODY_ID && (
        <p className="text-[11px] leading-relaxed mb-2" style={{ color: COLORS.textSecondary }}>
          本模板默认只分析滑块受力，圆盘本体不进入受力分析列表。
        </p>
      )}
    </>
  )
}

/** 方向箭头字符 */
function directionArrow(dirRad: number): string {
  // 将弧度转为 0-360 度，映射到 8 方向
  const deg = ((dirRad * 180 / Math.PI) % 360 + 360) % 360
  const arrows = ['→', '↗', '↑', '↖', '←', '↙', '↓', '↘']
  const idx = Math.round(deg / 45) % 8
  return arrows[idx]
}

function InitialMotionTab({
  body,
  liveUpdate,
  changeProperty,
}: {
  body: SceneBody
  liveUpdate: (key: keyof SceneBody, value: unknown) => void
  changeProperty: (key: keyof SceneBody, oldValue: unknown, newValue: unknown) => void
}) {
  const availableForces = useForceDisplayStore((s) => s.availableForces)
  const contactNormalForce = availableForces
    .filter((f) => f.bodyId === body.id && f.forceType === 'normal' && !!f.contactNormal)
    .sort((a, b) => b.magnitude - a.magnitude)[0]
  const defaultVelocityAxisDeg = contactNormalForce?.contactNormal
    ? normalizeAngle((Math.atan2(contactNormalForce.contactNormal.y, contactNormalForce.contactNormal.x) * 180) / Math.PI - 90)
    : 0

  const initialVelocity = sanitizeVelocity(body.initialVelocity)
  const velocityPolar = velocityToPolar(initialVelocity, defaultVelocityAxisDeg)
  const velocityAngleDragStartRef = useRef(initialVelocity)

  const initialAcceleration = sanitizeVelocity(body.initialAcceleration)
  const accelerationPolar = velocityToPolar(initialAcceleration, defaultVelocityAxisDeg)
  const accelerationAngleDragStartRef = useRef(initialAcceleration)

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
        {body.label} · 初始运动
      </h3>

      {body.isStatic ? (
        <div
          className="text-xs rounded border px-3 py-2"
          style={{
            color: COLORS.textSecondary,
            backgroundColor: COLORS.bgMuted,
            borderColor: COLORS.border,
          }}
        >
          静态物体不需要设置初速度与初始加速度。
        </div>
      ) : (
        <>
          <SectionTitle>初速度</SectionTitle>
          <div className="mb-3">
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>速度 (m/s)</span>
                <NumberInput
                  value={velocityPolar.speed}
                  onLiveChange={(v) =>
                    liveUpdate('initialVelocity', polarToVelocity(v, velocityPolar.angleDeg))
                  }
                  onCommit={(v) =>
                    changeProperty('initialVelocity', initialVelocity, polarToVelocity(v, velocityPolar.angleDeg))
                  }
                />
              </div>
              <div className="flex-1">
                <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>角度 (°)</span>
                <div
                  className="flex gap-2 items-center"
                  onPointerDown={() => {
                    velocityAngleDragStartRef.current = initialVelocity
                  }}
                  onPointerUp={() => {
                    const currentBody = useSceneStore.getState().scene.bodies.find((b) => b.id === body.id)
                    if (!currentBody) return
                    const start = sanitizeVelocity(velocityAngleDragStartRef.current)
                    const end = sanitizeVelocity(currentBody.initialVelocity)
                    if (start.x !== end.x || start.y !== end.y) {
                      changeProperty('initialVelocity', start, end)
                    }
                  }}
                >
                  <div className="flex-1">
                    <Slider
                      value={[velocityPolar.angleDeg]}
                      onValueChange={([v]) => {
                        liveUpdate('initialVelocity', polarToVelocity(velocityPolar.speed, v))
                      }}
                      min={-180}
                      max={180}
                      step={1}
                    />
                  </div>
                  <div className="w-14">
                    <NumberInput
                      value={velocityPolar.angleDeg}
                      step={1}
                      min={-180}
                      max={180}
                      onLiveChange={(v) =>
                        liveUpdate('initialVelocity', polarToVelocity(velocityPolar.speed, v))
                      }
                      onCommit={(v) =>
                        changeProperty('initialVelocity', initialVelocity, polarToVelocity(velocityPolar.speed, v))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>横向速度 Vx</span>
                <NumberInput
                  value={initialVelocity.x}
                  onLiveChange={(v) =>
                    liveUpdate('initialVelocity', sanitizeVelocity({ ...initialVelocity, x: v }))
                  }
                  onCommit={(v) =>
                    changeProperty('initialVelocity', initialVelocity, sanitizeVelocity({
                      ...initialVelocity,
                      x: v,
                    }))
                  }
                />
              </div>
              <div className="flex-1">
                <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>纵向速度 Vy</span>
                <NumberInput
                  value={initialVelocity.y}
                  onLiveChange={(v) =>
                    liveUpdate('initialVelocity', sanitizeVelocity({ ...initialVelocity, y: v }))
                  }
                  onCommit={(v) =>
                    changeProperty('initialVelocity', initialVelocity, sanitizeVelocity({
                      ...initialVelocity,
                      y: v,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          <SectionTitle>初始加速度</SectionTitle>
          <div className="mb-2">
            <div className="flex gap-2 mb-2">
              <div className="flex-1">
                <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>加速度 (m/s²)</span>
                <NumberInput
                  value={accelerationPolar.speed}
                  onLiveChange={(v) =>
                    liveUpdate('initialAcceleration', polarToVelocity(v, accelerationPolar.angleDeg))
                  }
                  onCommit={(v) =>
                    changeProperty('initialAcceleration', initialAcceleration, polarToVelocity(v, accelerationPolar.angleDeg))
                  }
                />
              </div>
              <div className="flex-1">
                <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>角度 (°)</span>
                <div
                  className="flex gap-2 items-center"
                  onPointerDown={() => {
                    accelerationAngleDragStartRef.current = initialAcceleration
                  }}
                  onPointerUp={() => {
                    const currentBody = useSceneStore.getState().scene.bodies.find((b) => b.id === body.id)
                    if (!currentBody) return
                    const start = sanitizeVelocity(accelerationAngleDragStartRef.current)
                    const end = sanitizeVelocity(currentBody.initialAcceleration)
                    if (start.x !== end.x || start.y !== end.y) {
                      changeProperty('initialAcceleration', start, end)
                    }
                  }}
                >
                  <div className="flex-1">
                    <Slider
                      value={[accelerationPolar.angleDeg]}
                      onValueChange={([v]) => {
                        liveUpdate('initialAcceleration', polarToVelocity(accelerationPolar.speed, v))
                      }}
                      min={-180}
                      max={180}
                      step={1}
                    />
                  </div>
                  <div className="w-14">
                    <NumberInput
                      value={accelerationPolar.angleDeg}
                      step={1}
                      min={-180}
                      max={180}
                      onLiveChange={(v) =>
                        liveUpdate('initialAcceleration', polarToVelocity(accelerationPolar.speed, v))
                      }
                      onCommit={(v) =>
                        changeProperty('initialAcceleration', initialAcceleration, polarToVelocity(accelerationPolar.speed, v))
                      }
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="flex-1">
                <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>横向加速度 Ax</span>
                <NumberInput
                  value={initialAcceleration.x}
                  onLiveChange={(v) =>
                    liveUpdate('initialAcceleration', sanitizeVelocity({ ...initialAcceleration, x: v }))
                  }
                  onCommit={(v) =>
                    changeProperty('initialAcceleration', initialAcceleration, sanitizeVelocity({
                      ...initialAcceleration,
                      x: v,
                    }))
                  }
                />
              </div>
              <div className="flex-1">
                <span className="text-xs mb-0.5 block" style={{ color: COLORS.textMuted }}>纵向加速度 Ay</span>
                <NumberInput
                  value={initialAcceleration.y}
                  onLiveChange={(v) =>
                    liveUpdate('initialAcceleration', sanitizeVelocity({ ...initialAcceleration, y: v }))
                  }
                  onCommit={(v) =>
                    changeProperty('initialAcceleration', initialAcceleration, sanitizeVelocity({
                      ...initialAcceleration,
                      y: v,
                    }))
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function safeNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

function sanitizeVelocity(v: { x: number; y: number }): { x: number; y: number } {
  return {
    x: roundTo(safeNumber(v.x), 4),
    y: roundTo(safeNumber(v.y), 4),
  }
}

function velocityToPolar(
  v: { x: number; y: number },
  zeroSpeedDefaultAngleDeg = 0,
): { speed: number; angleDeg: number } {
  const x = safeNumber(v.x)
  const y = safeNumber(v.y)
  const speed = Math.hypot(x, y)
  if (speed < 1e-6) {
    return {
      speed: 0,
      angleDeg: roundTo(normalizeAngle(zeroSpeedDefaultAngleDeg), 2),
    }
  }

  const rawAngleDeg = normalizeAngle((Math.atan2(y, x) * 180) / Math.PI)
  const deltaToDefault = normalizeAngle(rawAngleDeg - zeroSpeedDefaultAngleDeg)

  // 在斜面等“存在默认参考方向”的场景里，若向量与参考方向相反，
  // 优先用“负速度 + 更接近参考方向的角度”来表达，便于直接输入负值切换反向运动。
  if (deltaToDefault > 90) {
    return {
      speed: roundTo(-speed, 4),
      angleDeg: roundTo(normalizeAngle(rawAngleDeg - 180), 2),
    }
  }
  if (deltaToDefault < -90) {
    return {
      speed: roundTo(-speed, 4),
      angleDeg: roundTo(normalizeAngle(rawAngleDeg + 180), 2),
    }
  }

  return {
    speed: roundTo(speed, 4),
    angleDeg: roundTo(rawAngleDeg, 2),
  }
}

function polarToVelocity(speed: number, angleDeg: number): { x: number; y: number } {
  const safeSpeed = safeNumber(speed)
  const safeDeg = normalizeAngle(safeNumber(angleDeg))
  const rad = (safeDeg * Math.PI) / 180
  return sanitizeVelocity({
    x: safeSpeed * Math.cos(rad),
    y: safeSpeed * Math.sin(rad),
  })
}

/** 力类型排序权重 */
const FORCE_TYPE_ORDER: Record<string, number> = {
  external: 0,
  gravity: 1,
  gravity_parallel: 2,
  gravity_perpendicular: 3,
  normal: 4,
  static_friction: 5,
  kinetic_friction: 6,
  friction: 7,
  tension: 8,
  resultant: 9,
}

/** 受力分析 Tab — 统一读取 forceDisplayStore，编辑/仿真模式共用 */
function ForceAnalysisTab({
  body,
  editorMode,
}: {
  body: SceneBody
  editorMode: 'edit' | 'simulate'
}) {
  const activeSceneId = useModuleWorkspaceStore((s) => s.activeSceneId)
  const scene = useSceneStore((s) => s.scene)
  const availableForces = useForceDisplayStore((s) => s.availableForces)
  const hiddenForceKeys = useForceDisplayStore((s) => s.hiddenForceKeys)
  const toggleForce = useForceDisplayStore((s) => s.toggleForce)
  const showAllForBody = useForceDisplayStore((s) => s.showAllForBody)
  const hideAllForBody = useForceDisplayStore((s) => s.hideAllForBody)

  // Filter forces for this body
  const bodyForces = availableForces.filter(f => f.bodyId === body.id)

  // Sort by type order
  const sorted = [...bodyForces].sort(
    (a, b) => (FORCE_TYPE_ORDER[a.forceType] ?? 99) - (FORCE_TYPE_ORDER[b.forceType] ?? 99)
  )

  // All force keys for this body (for batch operations)
  const allKeys = sorted.map(f => forceKey(f))
  const allVisible = allKeys.every(k => !hiddenForceKeys.has(k))

  // External forces from scene (for inline editing)
  const sceneForces = scene.forces.filter(f => f.targetBodyId === body.id)

  const handleAddForce = () => {
    // 生成序号：找当前物体已有外力的最大序号 +1
    const existingIndices = sceneForces
      .map(f => { const m = f.label.match(/^F(\d+)$/); return m ? parseInt(m[1]) : 0 })
    const nextIdx = existingIndices.length === 0 ? 1 : Math.max(...existingIndices) + 1
    const newForce: SceneForce = {
      id: generateId(),
      type: 'external',
      targetBodyId: body.id,
      label: `F${nextIdx}`,
      magnitude: 10,
      direction: body.angle, // 默认沿物体平面方向
      visible: true,
      decompose: false,
      decomposeAngle: 0,
    }
    const cmd = new AddForceCommand(newForce)
    useCommandStore.getState().execute(cmd)
  }

  const handleDeleteForce = (force: SceneForce) => {
    const cmd = new RemoveForceCommand(force)
    useCommandStore.getState().execute(cmd)
    useSelectionStore.getState().deselectForce()
  }

  const handleForceClick = (forceId: string) => {
    useSelectionStore.getState().selectForce(forceId)
  }

  return (
    <div className="p-3" style={{ padding: EDITOR_CHROME.panelPadding }}>
      {/* Header + batch toggle */}
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-xs font-semibold uppercase tracking-wider"
          style={{
            color: COLORS.textMuted,
            fontSize: EDITOR_CHROME.panelTitleFontSize,
            letterSpacing: EDITOR_CHROME.panelTitleTracking,
          }}
        >
          {body.label} · 受力
        </h3>
        {sorted.length > 0 && (
          <button
            className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded transition-colors"
            style={{ color: COLORS.textSecondary, cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = FEEDBACK_VISUAL.selectedFill }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            onClick={() => {
              if (allVisible) {
                hideAllForBody(body.id, allKeys)
              } else {
                showAllForBody(body.id)
              }
            }}
          >
            {allVisible ? <EyeOff size={12} /> : <Eye size={12} />}
            {allVisible ? '全部隐藏' : '全部显示'}
          </button>
        )}
      </div>

      {activeSceneId === FM041_SCENE_ID && body.id === FM041_DISK_BODY_ID && (
        <div
          className="rounded-md px-2.5 py-2 mb-3"
          style={{
            backgroundColor: COLORS.bgMuted,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <p className="text-[11px] leading-relaxed" style={{ color: COLORS.textSecondary }}>
            `FM-041` 当前只对盘上滑块做受力分析；圆盘本体作为转动背景和支撑面，不单独进入受力列表。
          </p>
        </div>
      )}

      {/* Force list */}
      {sorted.length > 0 ? (
        <div className="space-y-0.5">
          {sorted.map((force, idx) => {
            const key = forceKey(force)
            const isVisible = !hiddenForceKeys.has(key)
            const isExternal = force.forceType === 'external'
            const isResultant = force.forceType === 'resultant'
            const sceneForce = isExternal && force.sourceId
              ? sceneForces.find(sf => sf.id === force.sourceId)
              : null

            // 合力前加分隔线
            const prevForce = idx > 0 ? sorted[idx - 1] : null
            const showSeparator = isResultant && prevForce?.forceType !== 'resultant'

            return (
              <div key={`${key}-${idx}`}>
                {showSeparator && (
                  <div
                    className="my-1 border-t"
                    style={{ borderColor: COLORS.border }}
                  />
                )}
                <ForceRow
                  force={force}
                  forceKey={key}
                  isVisible={isVisible}
                  onToggleVisibility={() => toggleForce(key)}
                  onClick={() => {
                    const forceId = force.sourceId ?? `${force.bodyId}:${force.forceType}`
                    handleForceClick(forceId)
                  }}
                  isExternal={isExternal}
                  isResultant={isResultant}
                  sceneForce={sceneForce ?? undefined}
                  bodyAngle={body.angle}
                  onDelete={sceneForce ? () => handleDeleteForce(sceneForce) : undefined}
                />
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-xs mb-2" style={{ color: COLORS.textPlaceholder }}>
          {body.isStatic ? '静态物体不受力' : '暂无力数据'}
        </p>
      )}

      {/* Add external force button (edit mode only) */}
      {editorMode === 'edit' && !body.isStatic && (
        <Button
          size="sm"
          variant="secondary"
          onClick={handleAddForce}
          className="w-full mt-3"
        >
          <Plus size={14} />
          添加外力
        </Button>
      )}
    </div>
  )
}

/** Unified force row with visibility toggle */
function ForceRow({
  force,
  forceKey: fKey,
  isVisible,
  onToggleVisibility,
  onClick,
  isExternal,
  isResultant,
  sceneForce,
  bodyAngle,
  onDelete,
}: {
  force: ForceData
  forceKey: string
  isVisible: boolean
  onToggleVisibility: () => void
  onClick: () => void
  isExternal: boolean
  isResultant: boolean
  sceneForce?: SceneForce
  bodyAngle?: number
  onDelete?: () => void
}) {
  const selectedForceId = useSelectionStore((s) => s.selectedForceId)
  const forceId = force.sourceId ?? `${force.bodyId}:${force.forceType}`
  const isSelected = selectedForceId === forceId
  const isDecomposed = useForceDisplayStore((s) => s.decomposedForceKeys.has(fKey))
  const toggleDecompose = useForceDisplayStore((s) => s.toggleDecompose)

  const visual = getForceVisual(force.forceType)
  const dir = Math.atan2(force.vector.y, force.vector.x)
  const arrow = directionArrow(dir)

  return (
    <div>
      <div
        className="flex items-center gap-1 px-1 py-1 rounded text-xs"
        style={{
          backgroundColor: isSelected ? FEEDBACK_VISUAL.selectedFill : 'transparent',
          border: isSelected ? `1px solid ${FEEDBACK_VISUAL.selectedBorder}` : '1px solid transparent',
          opacity: isVisible ? 1 : 0.4,
          cursor: 'pointer',
        }}
        onClick={onClick}
      >
        {/* Visibility checkbox */}
        <Tip text={isVisible ? '隐藏' : '显示'}>
          <button
            className="p-0.5 rounded cursor-pointer flex-shrink-0"
            onClick={(e) => { e.stopPropagation(); onToggleVisibility() }}
          >
            {isVisible
              ? <Eye size={11} style={{ color: COLORS.textMuted }} />
              : <EyeOff size={11} style={{ color: COLORS.textTertiary }} />
            }
          </button>
        </Tip>

        {/* Color dot */}
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: visual.color }}
        />

        {/* Label + name */}
        <span className="font-medium" style={{ color: COLORS.text, minWidth: 14 }}>
          {isExternal && sceneForce ? sceneForce.label : visual.label}
        </span>
        <span style={{ color: COLORS.textSecondary }}>{visual.chineseName}</span>

        {/* Magnitude + direction */}
        <span className="ml-auto tabular-nums" style={{ color: COLORS.text }}>
          {force.magnitude.toFixed(1)}N
        </span>
        <span style={{ color: COLORS.textMuted }}>{arrow}</span>

        {/* Decompose checkbox (not for resultant) */}
        {!isResultant && (
          <Tip text={isDecomposed ? '取消分解' : '正交分解'}>
            <button
              className="p-0.5 rounded cursor-pointer flex-shrink-0"
              style={{
                color: isDecomposed ? FEEDBACK_VISUAL.selectedColor : COLORS.textMuted,
                backgroundColor: isDecomposed ? FEEDBACK_VISUAL.selectedFill : 'transparent',
              }}
              onClick={(e) => { e.stopPropagation(); toggleDecompose(fKey) }}
            >
              <Split size={11} />
            </button>
          </Tip>
        )}

        {/* Delete button (external forces only) */}
        {isExternal && onDelete && (
          <button
            className="p-0.5 rounded flex-shrink-0"
            style={{ cursor: 'pointer' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = COLORS.errorLight }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent' }}
            onClick={(e) => { e.stopPropagation(); onDelete() }}
          >
            <Trash2 size={11} style={{ color: COLORS.textMuted }} />
          </button>
        )}
      </div>

      {/* Edit area always visible for external forces */}
      {isExternal && sceneForce && (
        <ExternalForceEditor force={sceneForce} bodyAngle={bodyAngle ?? 0} />
      )}
    </div>
  )
}

/** Inline editor for external force properties */
function ExternalForceEditor({
  force,
  bodyAngle,
}: {
  force: SceneForce
  bodyAngle: number
}) {
  // 方向以物体平面为 0°（相对角度）
  const storeRelDeg = normalizeAngle((force.direction - bodyAngle) * 180 / Math.PI)
  const committedDirRef = useRef(force.direction)
  const [dragging, setDragging] = useState(false)
  const [localDeg, setLocalDeg] = useState(storeRelDeg)

  // 非拖拽时从 store 同步
  const displayDeg = dragging ? localDeg : storeRelDeg

  const changeForceProperty = (key: keyof SceneForce, oldVal: unknown, newVal: unknown) => {
    const cmd = new ChangeForcePropertyCommand(force.id, key, oldVal, newVal)
    useCommandStore.getState().execute(cmd)
  }

  const liveUpdateDirection = (deg: number) => {
    setLocalDeg(deg)
    const rad = deg * Math.PI / 180 + bodyAngle
    useSceneStore.getState().updateForce(force.id, { direction: rad })
  }

  const commitDirection = () => {
    setDragging(false)
    // 从 store 读取最新 direction 作为 newVal
    const current = useSceneStore.getState().scene.forces.find(f => f.id === force.id)
    if (!current) return
    changeForceProperty('direction', committedDirRef.current, current.direction)
    committedDirRef.current = current.direction
  }

  const commitDirectionValue = (deg: number) => {
    const rad = deg * Math.PI / 180 + bodyAngle
    changeForceProperty('direction', committedDirRef.current, rad)
    committedDirRef.current = rad
  }

  return (
    <div className="px-2 py-2 mb-1 rounded" style={{ backgroundColor: COLORS.bgMuted }}>
      <PropertyRow label="大小 (N)">
        <NumberInput
          value={force.magnitude}
          onCommit={(v) => changeForceProperty('magnitude', force.magnitude, v)}
          step={1}
          min={0.1}
        />
      </PropertyRow>
      <PropertyRow label="方向 (°)">
        <div className="flex items-center gap-1.5">
          <Slider
            value={[displayDeg]}
            onValueChange={([v]) => liveUpdateDirection(v)}
            onPointerDown={() => { setDragging(true); setLocalDeg(storeRelDeg) }}
            onPointerUp={() => commitDirection()}
            min={-180}
            max={180}
            step={1}
            className="flex-1"
          />
          <Input
            type="number"
            value={String(Math.round(displayDeg))}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) liveUpdateDirection(Math.max(-180, Math.min(180, v)))
            }}
            onBlur={(e) => {
              const v = parseFloat(e.target.value)
              if (!isNaN(v)) commitDirectionValue(Math.max(-180, Math.min(180, v)))
            }}
            onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
            step={1}
            min={-180}
            max={180}
            className="h-6 w-14 px-1 py-0 text-xs text-center flex-shrink-0"
          />
        </div>
      </PropertyRow>
    </div>
  )
}


/** 规范化角度到 -180..180 范围 */
function normalizeAngle(deg: number): number {
  deg = ((deg % 360) + 360) % 360
  return deg > 180 ? deg - 360 : deg
}

const CONSTRAINT_EPSILON = 1e-6
const MIN_CONSTRAINT_LENGTH = 0.01

function getSafeUnitVector(
  dx: number,
  dy: number,
  fallback: { x: number; y: number } = { x: 1, y: 0 },
): { x: number; y: number; dist: number } {
  const dist = Math.hypot(dx, dy)
  if (dist > CONSTRAINT_EPSILON) {
    return { x: dx / dist, y: dy / dist, dist }
  }
  const fallbackDist = Math.hypot(fallback.x, fallback.y)
  if (fallbackDist > CONSTRAINT_EPSILON) {
    return { x: fallback.x / fallbackDist, y: fallback.y / fallbackDist, dist: 0 }
  }
  return { x: 1, y: 0, dist: 0 }
}

/**
 * 当约束长度变化时，自动调整物体位置使距离满足约束。
 * 绳：距离 ≤ maxLength；杆：距离 = length（刚性）。
 * static 端不动，dynamic 端沿方向调整。两端都 dynamic 则各移一半。
 */
function enforceConstraintLength(jointId: string): void {
  const scene = useSceneStore.getState().scene
  const joint = scene.joints.find(j => j.id === jointId)
  if (!joint) return

  const bodyA = scene.bodies.find(b => b.id === joint.bodyIdA)
  const bodyB = scene.bodies.find(b => b.id === joint.bodyIdB)
  if (!bodyA || !bodyB) return

  // Compute world anchor positions
  const cosA = Math.cos(bodyA.angle), sinA = Math.sin(bodyA.angle)
  const ancAx = bodyA.position.x + joint.anchorA.x * cosA - joint.anchorA.y * sinA
  const ancAy = bodyA.position.y + joint.anchorA.x * sinA + joint.anchorA.y * cosA
  const cosB = Math.cos(bodyB.angle), sinB = Math.sin(bodyB.angle)
  const ancBx = bodyB.position.x + joint.anchorB.x * cosB - joint.anchorB.y * sinB
  const ancBy = bodyB.position.y + joint.anchorB.x * sinB + joint.anchorB.y * cosB

  // ─── Pulley：totalLength = distA_to_top + distB_to_top ───
  if (joint.type === 'pulley') {
    const total = joint.totalLength
    if (!total || total <= CONSTRAINT_EPSILON) return
    const mount = scene.bodies.find(b => b.id === joint.pulleyMountId)
    if (!mount) return
    const topX = mount.position.x
    const topY = mount.position.y + (mount.pulleyRadius ?? 0.15)

    const dxA = ancAx - topX, dyA = ancAy - topY
    const dxB = ancBx - topX, dyB = ancBy - topY
    const dirA = getSafeUnitVector(dxA, dyA, { x: bodyA.position.x - topX, y: bodyA.position.y - topY })
    const dirB = getSafeUnitVector(dxB, dyB, { x: bodyB.position.x - topX, y: bodyB.position.y - topY })
    const distA = dirA.dist
    const distB = dirB.dist
    const currentTotal = distA + distB
    if (!Number.isFinite(currentTotal) || currentTotal <= CONSTRAINT_EPSILON) return
    if (Math.abs(currentTotal - total) < 0.001) return

    // 按当前比例分配新绳长
    const ratio = distA / currentTotal
    const newDistA = total * ratio
    const newDistB = total * (1 - ratio)
    const nxA = dirA.x, nyA = dirA.y
    const nxB = dirB.x, nyB = dirB.y

    if (bodyA.isStatic && !bodyB.isStatic) {
      const newAncBx = topX + nxB * newDistB
      const newAncBy = topY + nyB * newDistB
      useSceneStore.getState().moveBody(bodyB.id, {
        x: newAncBx - (joint.anchorB.x * cosB - joint.anchorB.y * sinB),
        y: newAncBy - (joint.anchorB.x * sinB + joint.anchorB.y * cosB),
      })
    } else if (bodyB.isStatic && !bodyA.isStatic) {
      const newAncAx = topX + nxA * newDistA
      const newAncAy = topY + nyA * newDistA
      useSceneStore.getState().moveBody(bodyA.id, {
        x: newAncAx - (joint.anchorA.x * cosA - joint.anchorA.y * sinA),
        y: newAncAy - (joint.anchorA.x * sinA + joint.anchorA.y * cosA),
      })
    } else if (!bodyA.isStatic && !bodyB.isStatic) {
      const newAncAx = topX + nxA * newDistA
      const newAncAy = topY + nyA * newDistA
      useSceneStore.getState().moveBody(bodyA.id, {
        x: newAncAx - (joint.anchorA.x * cosA - joint.anchorA.y * sinA),
        y: newAncAy - (joint.anchorA.x * sinA + joint.anchorA.y * cosA),
      })
      const newAncBx = topX + nxB * newDistB
      const newAncBy = topY + nyB * newDistB
      useSceneStore.getState().moveBody(bodyB.id, {
        x: newAncBx - (joint.anchorB.x * cosB - joint.anchorB.y * sinB),
        y: newAncBy - (joint.anchorB.x * sinB + joint.anchorB.y * cosB),
      })
    }
    return
  }

  // ─── Rope / Rod / Spring：A-B 直线距离约束 ───
  let targetLength: number | undefined
  let isRigid = false
  if (joint.type === 'rope') {
    targetLength = joint.maxLength
  } else if (joint.type === 'rod') {
    targetLength = joint.length
    isRigid = true
  } else if (joint.type === 'spring') {
    targetLength = joint.springLength
    isRigid = true
  }
  if (!targetLength || targetLength <= CONSTRAINT_EPSILON) return
  targetLength = Math.max(MIN_CONSTRAINT_LENGTH, targetLength)

  const dx = ancBx - ancAx
  const dy = ancBy - ancAy
  const fallbackDx = bodyB.position.x - bodyA.position.x
  const fallbackDy = bodyB.position.y - bodyA.position.y
  const direction = getSafeUnitVector(dx, dy, { x: fallbackDx, y: fallbackDy })
  const dist = direction.dist

  // 绳：仅超出时调整；杆：距离偏离即调整
  const needsAdjust = isRigid
    ? Math.abs(dist - targetLength) > 0.001
    : dist > targetLength
  if (!needsAdjust) return

  const nx = direction.x
  const ny = direction.y

  if (bodyA.isStatic && !bodyB.isStatic) {
    const newAncBx = ancAx + nx * targetLength
    const newAncBy = ancAy + ny * targetLength
    useSceneStore.getState().moveBody(bodyB.id, {
      x: newAncBx - (joint.anchorB.x * cosB - joint.anchorB.y * sinB),
      y: newAncBy - (joint.anchorB.x * sinB + joint.anchorB.y * cosB),
    })
  } else if (bodyB.isStatic && !bodyA.isStatic) {
    const newAncAx = ancBx - nx * targetLength
    const newAncAy = ancBy - ny * targetLength
    useSceneStore.getState().moveBody(bodyA.id, {
      x: newAncAx - (joint.anchorA.x * cosA - joint.anchorA.y * sinA),
      y: newAncAy - (joint.anchorA.x * sinA + joint.anchorA.y * cosA),
    })
  } else if (!bodyA.isStatic && !bodyB.isStatic) {
    const excess = dist - targetLength
    const halfExcess = excess / 2
    useSceneStore.getState().moveBody(bodyA.id, {
      x: bodyA.position.x + nx * halfExcess,
      y: bodyA.position.y + ny * halfExcess,
    })
    useSceneStore.getState().moveBody(bodyB.id, {
      x: bodyB.position.x - nx * halfExcess,
      y: bodyB.position.y - ny * halfExcess,
    })
  }
  // 两端都 static：不做调整
}

/** Joint property sub-panel (data-driven from descriptor) */
function JointPropertyPanel({ joint }: { joint: SceneJoint }) {
  const desc = getJointDescriptor(joint.type)

  const liveUpdate = useCallback(
    (key: keyof SceneJoint, value: unknown) => {
      useSceneStore.getState().updateJoint(joint.id, { [key]: value } as Partial<SceneJoint>)
      if (key === 'maxLength' || key === 'length' || key === 'springLength' || key === 'totalLength') enforceConstraintLength(joint.id)
    },
    [joint.id],
  )

  const changeProperty = useCallback(
    (key: keyof SceneJoint, oldValue: unknown, newValue: unknown) => {
      const cmd = new ChangeJointPropertyCommand(joint.id, key, oldValue, newValue)
      useCommandStore.getState().execute(cmd)
      if (key === 'maxLength' || key === 'length' || key === 'springLength' || key === 'totalLength') enforceConstraintLength(joint.id)
    },
    [joint.id],
  )

  const handleDelete = useCallback(() => {
    const currentJoint = useSceneStore.getState().scene.joints.find(j => j.id === joint.id)
    if (!currentJoint) return
    const cmd = new RemoveJointCommand(currentJoint)
    useCommandStore.getState().execute(cmd)
    useSelectionStore.getState().deselect()
  }, [joint.id])

  const properties: JointPropertyDef[] = desc?.properties ?? []

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
        约束 - {joint.label}
      </h3>

      {/* Label */}
      <PropertyRow label="标签">
        <Input
          value={joint.label}
          onChange={() => {}}
          onBlur={(e) => {
            const newVal = e.currentTarget.value
            if (newVal !== joint.label) {
              changeProperty('label', joint.label, newVal)
            }
          }}
          className="h-7 px-2 py-1 text-xs"
        />
      </PropertyRow>

      <PropertyRow label="类型">
        <span className="text-xs" style={{ color: COLORS.text }}>
          {desc?.label ?? joint.type}
        </span>
      </PropertyRow>

      {/* Descriptor-driven properties */}
      {properties.length > 0 && (
        <>
          <SectionTitle>参数</SectionTitle>
          {properties.map((prop) => (
            <PropertyRow key={String(prop.key)} label={`${prop.label}${prop.unit ? ` (${prop.unit})` : ''}`}>
              <NumberInput
                value={(joint[prop.key] as number) ?? 0}
                onLiveChange={(v) => liveUpdate(prop.key, v)}
                onCommit={(v) => changeProperty(prop.key, joint[prop.key], v)}
                step={prop.step}
                min={prop.min}
                max={prop.max}
              />
            </PropertyRow>
          ))}
        </>
      )}

      {/* Spring: restore natural length */}
      {joint.type === 'spring' && (
        <div className="mt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => enforceConstraintLength(joint.id)}
            className="w-full"
          >
            <RotateCcw size={14} />
            恢复自然长度
          </Button>
        </div>
      )}

      {/* Delete */}
      <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${COLORS.border}` }}>
        <Button
          size="sm"
          variant="danger"
          onClick={handleDelete}
          className="w-full"
        >
          <Trash2 size={14} />
          删除约束
        </Button>
      </div>
    </div>
  )
}
