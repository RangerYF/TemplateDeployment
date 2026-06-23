import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Box,
  ChevronDown,
  Hand,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Square,
  X,
} from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Canvas } from '@/components/Canvas'
import { ObjectPanel } from '@/components/panels/ObjectPanel'
import { PropertyPanel, PropertyPanelTabBar } from '@/components/panels/PropertyPanel'
import { AnalysisPanel } from '@/components/panels/AnalysisPanel'
import { Tip } from '@/components/ui/Tip'
import { useTheme } from '@/hooks/useTheme'
import { useEditorStore } from '@/store/editorStore'
import { usePlaybackControlStore } from '@/store/playbackControlStore'
import { useSceneStore } from '@/store/sceneStore'
import { useToolStore } from '@/store/toolStore'
import { useSelectionStore } from '@/store/selectionStore'
import { normalizeNumberInput, parseFiniteNumber } from '@/lib/utils/number'
import { getModuleGroup, type TemplateModule } from '@/templates'
import { SceneSelector } from './SceneSelector'
import { MechanicsTeachingModal } from './MechanicsTeachingModal'

interface PhysicsWorkbenchLayoutProps {
  moduleId: TemplateModule
  sceneId: string
  onSelectScene: (moduleId: TemplateModule, sceneId: string) => void
}

const PLAYBACK_SPEED_OPTIONS = [0.1, 0.25, 0.5, 1, 2] as const
const COORDINATE_AXIS_OPTIONS = [
  { mode: 'off', label: '关' },
  { mode: 'horizontal', label: 'H' },
  { mode: 'vertical', label: 'V' },
  { mode: 'both', label: 'HV' },
] as const

function formatTimeLabel(seconds: number): string {
  const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0
  const mins = Math.floor(safe / 60)
  const rest = safe - mins * 60
  return `${mins}:${rest.toFixed(2).padStart(5, '0')}`
}

function IconButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tip text={label} position="bottom">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={() => {
          if (!disabled) onClick()
        }}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors disabled:cursor-not-allowed"
        style={{
          background: active ? 'var(--theme-primary)' : 'var(--theme-surface-hover)',
          color: active ? '#fff' : disabled ? 'var(--theme-text-muted)' : 'var(--theme-text-secondary)',
          opacity: disabled ? 0.55 : 1,
        }}
      >
        {children}
      </button>
    </Tip>
  )
}

function SpeedSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative hidden md:block">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 min-w-[70px] items-center justify-between gap-1 rounded-lg border px-2.5 text-xs font-semibold"
        style={{
          background: open ? 'var(--theme-primary-light)' : 'var(--theme-surface)',
          borderColor: open ? 'var(--theme-primary)' : 'var(--theme-border)',
          color: open ? 'var(--theme-primary)' : 'var(--theme-text-secondary)',
        }}
        aria-label="倍速"
        aria-expanded={open}
      >
        <span>{value}x</span>
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div
          className="absolute right-0 top-10 z-[95] w-24 overflow-hidden rounded-xl border p-1 shadow-2xl"
          style={{
            background: 'var(--theme-panel-bg)',
            borderColor: 'var(--theme-border)',
            boxShadow: '0 18px 48px rgba(15,23,42,0.18)',
          }}
        >
          {PLAYBACK_SPEED_OPTIONS.map((speed) => {
            const active = speed === value
            return (
              <button
                key={speed}
                type="button"
                onClick={() => {
                  onChange(speed)
                  setOpen(false)
                }}
                className="flex h-8 w-full items-center justify-center rounded-lg text-xs font-semibold"
                style={{
                  background: active ? 'var(--theme-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--theme-text-secondary)',
                }}
              >
                {speed}x
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}

function PlaybackTimeline({
  currentTime,
  maxTime,
  snapshotCount,
  disabled,
  onSeek,
  snapToSecond,
}: {
  currentTime: number
  maxTime: number
  snapshotCount: number
  disabled: boolean
  onSeek: (time: number) => void
  snapToSecond: (time: number) => number
}) {
  const secondTicks = useMemo(() => {
    const whole = Math.floor(maxTime)
    if (whole < 0) return [] as number[]
    return Array.from({ length: whole + 1 }, (_, index) => index)
  }, [maxTime])

  const tickLabelInterval = useMemo(() => {
    if (maxTime <= 20) return 1
    if (maxTime <= 60) return 5
    if (maxTime <= 180) return 10
    return 30
  }, [maxTime])

  return (
    <div className="relative h-10 w-full">
      <Slider
        className="absolute inset-x-0 top-0"
        min={0}
        max={maxTime}
        step={0.01}
        value={[Math.min(currentTime, maxTime)]}
        onValueChange={(value) => onSeek(snapToSecond(Number(value[0] ?? 0)))}
        disabled={snapshotCount <= 1 || disabled}
      />
      {maxTime > 0 && secondTicks.length > 1 ? (
        <>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-[2px] h-5">
            {secondTicks.map((sec) => {
              if (sec === 0) return null
              const major = sec % tickLabelInterval === 0
              return (
                <span
                  key={sec}
                  className="absolute top-0 -translate-x-1/2"
                  style={{
                    left: `${(sec / maxTime) * 100}%`,
                    width: major ? 2 : 1,
                    height: major ? 13 : 9,
                    backgroundColor: major ? 'var(--theme-text-muted)' : 'var(--theme-border-strong)',
                    opacity: major ? 0.8 : 0.62,
                  }}
                />
              )
            })}
          </div>

          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 h-3">
            {secondTicks.map((sec) => {
              const showLabel = sec % tickLabelInterval === 0 || sec === Math.floor(maxTime)
              if (!showLabel) return null
              return (
                <span
                  key={`label-${sec}`}
                  className="absolute -translate-x-1/2 text-[10px] leading-none"
                  style={{
                    left: `${(sec / maxTime) * 100}%`,
                    color: sec % tickLabelInterval === 0 ? 'var(--theme-text-secondary)' : 'var(--theme-text-muted)',
                  }}
                >
                  {sec}s
                </span>
              )
            })}
          </div>
        </>
      ) : null}
    </div>
  )
}

export function PhysicsWorkbenchLayout({
  moduleId,
  sceneId,
  onSelectScene,
}: PhysicsWorkbenchLayoutProps) {
  const [objectDrawerOpen, setObjectDrawerOpen] = useState(false)
  const [propertyDrawerOpen, setPropertyDrawerOpen] = useState(false)
  const [teachingOpen, setTeachingOpen] = useState(false)
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false)
  const [jumpInput, setJumpInput] = useState('')
  const [jumpInvalid, setJumpInvalid] = useState(false)
  const { theme, toggleTheme } = useTheme()
  const currentGroup = getModuleGroup(moduleId)

  const activeToolName = useToolStore((s) => s.activeToolName)
  const setTool = useToolStore((s) => s.setTool)
  const mode = useEditorStore((s) => s.mode)
  const simState = useEditorStore((s) => s.simState)
  const coordinateAxes = useEditorStore((s) => s.coordinateAxes)
  const setCoordinateAxisMode = useEditorStore((s) => s.setCoordinateAxisMode)
  const anchorCoordinateAxesToWorld = useEditorStore((s) => s.anchorCoordinateAxesToWorld)
  const anchorCoordinateAxesToPoint = useEditorStore((s) => s.anchorCoordinateAxesToPoint)
  const toggleCoordinateTicks = useEditorStore((s) => s.toggleCoordinateTicks)
  const toggleDisplacementLabels = useEditorStore((s) => s.toggleDisplacementLabels)
  const selected = useSelectionStore((s) => s.selected)
  const selectedCount = selected.length
  const showPropertyTabs = selected.length === 1 && selected[0]?.type === 'body'
  const scene = useSceneStore((s) => s.scene)

  const currentTime = usePlaybackControlStore((s) => s.currentTime)
  const maxTime = usePlaybackControlStore((s) => s.maxTime)
  const snapshotCount = usePlaybackControlStore((s) => s.snapshotCount)
  const handlers = usePlaybackControlStore((s) => s.handlers)
  const playbackSpeed = usePlaybackControlStore((s) => s.playbackSpeed)
  const setPlaybackSpeed = usePlaybackControlStore((s) => s.setPlaybackSpeed)

  const hasHandlers = Boolean(handlers)
  const phase: 'ready' | 'playing' | 'paused' | 'stoppedLocked' =
    mode === 'edit'
      ? 'ready'
      : simState === 'playing'
        ? 'playing'
        : simState === 'paused'
          ? 'paused'
          : 'stoppedLocked'
  const canPlay = hasHandlers && (phase === 'ready' || phase === 'paused')
  const canPause = hasHandlers && phase === 'playing'
  const canStop = hasHandlers && (phase === 'playing' || phase === 'paused')
  const canReset = hasHandlers && (phase !== 'ready' || snapshotCount > 0)
  const canJump = hasHandlers && maxTime > 0
  const phaseLabel =
    phase === 'playing'
      ? '运行中'
      : phase === 'paused'
        ? '已暂停'
        : phase === 'stoppedLocked'
          ? '已停止'
          : '待播放'

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setObjectDrawerOpen(false)
        setPropertyDrawerOpen(false)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const selectedBody = useMemo(() => {
    if (selected.length !== 1 || selected[0]?.type !== 'body') return null
    return scene.bodies.find((body) => body.id === selected[0].id) ?? null
  }, [scene.bodies, selected])

  const snapToSecond = (raw: number) => {
    const clamped = Math.max(0, Math.min(raw, maxTime))
    const nearest = Math.round(clamped)
    const snapThreshold = 0.12
    if (Math.abs(clamped - nearest) <= snapThreshold) return nearest
    return clamped
  }

  const handlePrimaryPlayback = () => {
    if (!handlers) return
    if (phase === 'playing') {
      handlers.pause()
      return
    }
    if (phase === 'stoppedLocked') {
      handlers.reset()
      handlers.play()
      return
    }
    handlers.play()
  }

  const handleJump = () => {
    if (!canJump) return
    const clamped = normalizeNumberInput(jumpInput, { min: 0, max: maxTime })
    if (clamped === null) {
      setJumpInvalid(jumpInput.trim().length > 0)
      return
    }
    handlers?.seek(clamped)
    setJumpInput(String(clamped))
    setJumpInvalid(false)
  }

  const propertyPanel = (
    <>
      <div className="border-b px-4 py-3" style={{ borderColor: 'var(--theme-border)' }}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.6px]" style={{ color: 'var(--theme-text-muted)' }}>
            {selectedCount > 0 ? `已选中 ${selectedCount} 个对象` : '环境配置'}
          </h3>
          <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{
            background: 'var(--theme-primary-light)',
            color: 'var(--theme-primary)',
          }}>
            {phaseLabel}
          </span>
        </div>
        {showPropertyTabs ? (
          <div className="h-8 overflow-hidden">
            <PropertyPanelTabBar />
          </div>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <PropertyPanel />
      </div>
    </>
  )

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ background: 'var(--theme-bg)' }}>
      <header
        className="flex h-12 shrink-0 items-center gap-2 border-b px-3"
        style={{
          background: 'var(--theme-topbar-bg)',
          borderColor: 'var(--theme-border)',
          boxShadow: 'var(--theme-shadow-sm)',
          color: 'var(--theme-text)',
        }}
      >
        <span
          className="hidden shrink-0 whitespace-nowrap text-sm font-bold md:inline"
          style={{ color: 'var(--theme-text)' }}
          title={currentGroup?.title ?? moduleId}
        >
          {currentGroup?.title ?? moduleId}
        </span>

        <SceneSelector moduleId={moduleId} sceneId={sceneId} onSelectScene={onSelectScene} />

        <button
          type="button"
          onClick={() => setObjectDrawerOpen(true)}
          className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold"
          style={{ background: 'var(--accent-green-light)', color: 'var(--accent-green)' }}
        >
          <Box size={15} />
          <span className="hidden sm:inline">添加对象</span>
        </button>

        <div className="h-5 w-px shrink-0 max-[720px]:hidden" style={{ background: 'var(--theme-border)' }} />

        <div className="flex shrink-0 items-center gap-1 max-[720px]:hidden">
          <IconButton label="选择工具" active={activeToolName === 'select'} onClick={() => setTool('select')}>
            <MousePointer2 size={15} />
          </IconButton>
          <IconButton label="拖动画布" active={activeToolName === 'pan'} onClick={() => setTool('pan')}>
            <Hand size={15} />
          </IconButton>
        </div>

        <div className="hidden h-8 min-w-[180px] flex-1 items-center px-2 xl:flex">
          <div className="w-full pr-10">
            <PlaybackTimeline
              currentTime={currentTime}
              maxTime={maxTime}
              snapshotCount={snapshotCount}
              disabled={!handlers}
              onSeek={(time) => handlers?.seek(time)}
              snapToSecond={snapToSecond}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 xl:hidden" />

        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={phase === 'playing' ? '暂停仿真' : '开始仿真'}
            active={phase === 'playing'}
            disabled={!hasHandlers || !(canPlay || canPause || phase === 'stoppedLocked')}
            onClick={handlePrimaryPlayback}
          >
            {phase === 'playing' ? <Pause size={15} /> : <Play size={15} />}
          </IconButton>
          <IconButton label="停止仿真" active={phase === 'stoppedLocked'} disabled={!canStop} onClick={() => handlers?.stop()}>
            <Square size={14} />
          </IconButton>
          <IconButton label="重置仿真" disabled={!canReset} onClick={() => handlers?.reset()}>
            <RotateCcw size={15} />
          </IconButton>
        </div>

        <span className="hidden text-xs tabular-nums lg:inline" style={{ color: 'var(--theme-text-muted)' }}>
          {formatTimeLabel(currentTime)} / {formatTimeLabel(maxTime)}
        </span>

        <SpeedSelector value={playbackSpeed} onChange={setPlaybackSpeed} />

        <span
          className="hidden rounded-full px-2.5 py-0.5 text-[11px] font-semibold sm:inline"
          style={{
            background: phase === 'playing' ? 'var(--theme-success-light)' : 'var(--theme-primary-light)',
            color: phase === 'playing' ? 'var(--theme-success)' : 'var(--theme-primary)',
          }}
        >
          {phaseLabel}
        </span>

        <div className="relative">
          <IconButton label="显示设置" active={displayMenuOpen} onClick={() => setDisplayMenuOpen((value) => !value)}>
            <SlidersHorizontal size={15} />
          </IconButton>
          {displayMenuOpen ? (
            <div
              className="absolute right-0 top-10 z-[95] w-[300px] rounded-xl border p-3 shadow-2xl"
              style={{
                background: 'var(--theme-panel-bg)',
                borderColor: 'var(--theme-border)',
                boxShadow: '0 18px 48px rgba(15,23,42,0.18)',
                color: 'var(--theme-text)',
              }}
            >
              <div className="mb-3 text-xs font-semibold uppercase tracking-[0.6px]" style={{ color: 'var(--theme-text-muted)' }}>
                显示与坐标
              </div>

              <div className="mb-3">
                <div className="mb-1.5 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>坐标轴</div>
                <div className="flex gap-1 rounded-lg p-1" style={{ background: 'var(--theme-surface-hover)' }}>
                  {COORDINATE_AXIS_OPTIONS.map((option) => {
                    const active = coordinateAxes.mode === option.mode
                    return (
                      <button
                        key={option.mode}
                        type="button"
                        onClick={() => setCoordinateAxisMode(option.mode)}
                        className="flex-1 rounded-md px-2 py-1.5 text-xs font-semibold"
                        style={
                          active
                            ? { background: 'var(--theme-primary)', color: '#fff' }
                            : { color: 'var(--theme-text-muted)' }
                        }
                      >
                        {option.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={anchorCoordinateAxesToWorld}
                  className="rounded-lg border px-2 py-2 text-xs font-semibold"
                  style={{
                    background: coordinateAxes.originType === 'world' ? 'var(--theme-primary-light)' : 'var(--theme-surface)',
                    borderColor: coordinateAxes.originType === 'world' ? 'var(--theme-primary)' : 'var(--theme-border)',
                    color: coordinateAxes.originType === 'world' ? 'var(--theme-primary)' : 'var(--theme-text-secondary)',
                  }}
                >
                  世界原点
                </button>
                <button
                  type="button"
                  disabled={!selectedBody}
                  onClick={() => {
                    if (!selectedBody) return
                    anchorCoordinateAxesToPoint(selectedBody.position, selectedBody.label)
                  }}
                  className="rounded-lg border px-2 py-2 text-xs font-semibold disabled:cursor-not-allowed"
                  style={{
                    background: coordinateAxes.originType === 'anchored' ? 'var(--theme-primary-light)' : 'var(--theme-surface)',
                    borderColor: coordinateAxes.originType === 'anchored' ? 'var(--theme-primary)' : 'var(--theme-border)',
                    color: selectedBody
                      ? coordinateAxes.originType === 'anchored'
                        ? 'var(--theme-primary)'
                        : 'var(--theme-text-secondary)'
                      : 'var(--theme-text-muted)',
                    opacity: selectedBody ? 1 : 0.55,
                  }}
                >
                  选中物体
                </button>
              </div>

              <div className="mb-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={toggleCoordinateTicks}
                  className="rounded-lg border px-2 py-2 text-xs font-semibold"
                  style={{
                    background: coordinateAxes.showTicks ? 'var(--accent-green-light)' : 'var(--theme-surface)',
                    borderColor: coordinateAxes.showTicks ? 'var(--accent-green)' : 'var(--theme-border)',
                    color: coordinateAxes.showTicks ? 'var(--accent-green)' : 'var(--theme-text-secondary)',
                  }}
                >
                  刻度
                </button>
                <button
                  type="button"
                  onClick={toggleDisplacementLabels}
                  className="rounded-lg border px-2 py-2 text-xs font-semibold"
                  style={{
                    background: coordinateAxes.showDisplacementLabels ? 'var(--accent-green-light)' : 'var(--theme-surface)',
                    borderColor: coordinateAxes.showDisplacementLabels ? 'var(--accent-green)' : 'var(--theme-border)',
                    color: coordinateAxes.showDisplacementLabels ? 'var(--accent-green)' : 'var(--theme-text-secondary)',
                  }}
                >
                  位移标注
                </button>
              </div>

              <div className="border-t pt-3" style={{ borderColor: 'var(--theme-border)' }}>
                <div className="mb-1.5 text-xs" style={{ color: 'var(--theme-text-secondary)' }}>跳转到时间</div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={0}
                    max={maxTime}
                    step={0.01}
                    value={jumpInput}
                    onChange={(event) => {
                      const raw = event.target.value
                      setJumpInput(raw)
                      if (raw.trim() === '') {
                        setJumpInvalid(false)
                        return
                      }
                      setJumpInvalid(parseFiniteNumber(raw) === null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleJump()
                    }}
                    onBlur={() => {
                      if (jumpInput.trim() === '') {
                        setJumpInvalid(false)
                        return
                      }
                      const normalized = normalizeNumberInput(jumpInput, { min: 0, max: maxTime })
                      if (normalized === null) {
                        setJumpInvalid(true)
                        return
                      }
                      setJumpInput(String(normalized))
                      setJumpInvalid(false)
                    }}
                    disabled={!canJump}
                    aria-invalid={jumpInvalid}
                    className="h-8 min-w-0 flex-1 rounded-lg border px-2 text-xs outline-none"
                    style={{
                      background: canJump ? 'var(--theme-surface)' : 'var(--theme-surface-hover)',
                      borderColor: jumpInvalid ? 'var(--theme-danger)' : 'var(--theme-border)',
                      color: 'var(--theme-text)',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleJump}
                    disabled={!canJump}
                    className="h-8 rounded-lg px-3 text-xs font-semibold disabled:cursor-not-allowed"
                    style={{
                      background: canJump ? 'var(--theme-primary)' : 'var(--theme-surface-hover)',
                      color: canJump ? '#fff' : 'var(--theme-text-muted)',
                    }}
                  >
                    跳转
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <IconButton label={theme === 'light' ? '切换暗色模式' : '切换亮色模式'} onClick={toggleTheme}>
          <span className="text-sm leading-none">{theme === 'light' ? '🌙' : '☀️'}</span>
        </IconButton>
        <IconButton label="教学要点" onClick={() => setTeachingOpen(true)}>
          <span className="text-sm leading-none">📖</span>
        </IconButton>
      </header>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <Canvas />
          <AnalysisPanel />
          <button
            type="button"
            onClick={() => setPropertyDrawerOpen(true)}
            className="absolute bottom-20 right-4 z-[58] flex h-12 w-12 items-center justify-center rounded-full shadow-lg lg:hidden"
            style={{
              background: 'var(--theme-panel-bg)',
              border: '1px solid var(--theme-border)',
              color: 'var(--theme-text-secondary)',
            }}
            aria-label="打开属性面板"
          >
            <span className="text-xl leading-none">⚙</span>
          </button>
        </main>

        <aside
          className="hidden w-80 shrink-0 flex-col overflow-hidden border-l lg:flex"
          style={{
            background: 'var(--theme-panel-bg)',
            borderColor: 'var(--theme-border)',
          }}
        >
          {propertyPanel}
        </aside>
      </div>

      {objectDrawerOpen ? (
        <div className="pointer-events-none fixed inset-0 z-[80]">
          <aside
            className="pointer-events-auto absolute bottom-0 left-0 top-12 w-[280px] max-w-[86vw] overflow-y-auto border-r shadow-2xl"
            style={{
              background: 'var(--theme-panel-bg)',
              borderColor: 'var(--theme-border)',
              boxShadow: '8px 0 28px rgba(0,0,0,0.12)',
            }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>物体库</span>
              <button
                type="button"
                onClick={() => setObjectDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'var(--theme-surface-hover)', color: 'var(--theme-text-secondary)' }}
                aria-label="关闭"
              >
                <X size={16} />
              </button>
            </div>
            <ObjectPanel />
          </aside>
        </div>
      ) : null}

      {propertyDrawerOpen ? (
        <div className="fixed inset-0 z-[85] lg:hidden">
          <button
            type="button"
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.42)' }}
            onClick={() => setPropertyDrawerOpen(false)}
            aria-label="关闭属性面板"
          />
          <aside
            className="absolute bottom-0 right-0 top-0 flex w-[min(320px,86vw)] flex-col overflow-hidden border-l shadow-2xl"
            style={{
              background: 'var(--theme-panel-bg)',
              borderColor: 'var(--theme-border)',
            }}
          >
            <div className="flex items-center justify-between border-b px-4 py-3" style={{ borderColor: 'var(--theme-border)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--theme-text)' }}>属性与参数</span>
              <button
                type="button"
                onClick={() => setPropertyDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg"
                style={{ background: 'var(--theme-surface-hover)', color: 'var(--theme-text-secondary)' }}
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            {propertyPanel}
          </aside>
        </div>
      ) : null}

      {teachingOpen ? (
        <MechanicsTeachingModal sceneId={sceneId} onClose={() => setTeachingOpen(false)} />
      ) : null}
    </div>
  )
}
