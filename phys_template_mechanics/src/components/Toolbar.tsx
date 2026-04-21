import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Hand, MousePointer2, Play, Pause, Square, X } from 'lucide-react'
import { Slider } from '@/components/ui/slider'
import { Tip } from '@/components/ui/Tip'
import { useEditorStore } from '@/store/editorStore'
import { usePlaybackControlStore } from '@/store/playbackControlStore'
import { useToolStore } from '@/store/toolStore'
import { useSceneStore } from '@/store/sceneStore'
import { useSelectionStore } from '@/store/selectionStore'
import { COLORS, EDITOR_CHROME } from '@/styles/tokens'
import { normalizeNumberInput, parseFiniteNumber } from '@/lib/utils/number'

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

interface IconControlButtonProps {
  icon: ReactNode
  label: string
  active?: boolean
  enabled?: boolean
  onClick: () => void
}

function IconControlButton({
  icon,
  label,
  active = false,
  enabled = true,
  onClick,
}: IconControlButtonProps) {
  return (
    <button
      type="button"
      disabled={!enabled}
      aria-label={label}
      onClick={() => {
        if (enabled) onClick()
      }}
      className="h-8 w-8 rounded-full inline-flex items-center justify-center transition-colors"
      style={{
        width: EDITOR_CHROME.controlSize,
        height: EDITOR_CHROME.controlSize,
        border: `${EDITOR_CHROME.controlBorderWidth}px solid ${active ? COLORS.primary : COLORS.borderStrong}`,
        backgroundColor: active ? COLORS.primary : enabled ? COLORS.white : COLORS.bgMuted,
        color: active ? COLORS.white : enabled ? COLORS.text : COLORS.textTertiary,
        borderRadius: EDITOR_CHROME.controlRadius,
        boxShadow: EDITOR_CHROME.controlShadow,
        cursor: enabled ? 'pointer' : 'not-allowed',
      }}
    >
      {icon}
    </button>
  )
}

export function Toolbar() {
  const mode = useEditorStore((s) => s.mode)
  const simState = useEditorStore((s) => s.simState)
  const coordinateAxes = useEditorStore((s) => s.coordinateAxes)
  const setCoordinateAxisMode = useEditorStore((s) => s.setCoordinateAxisMode)
  const anchorCoordinateAxesToWorld = useEditorStore((s) => s.anchorCoordinateAxesToWorld)
  const anchorCoordinateAxesToPoint = useEditorStore((s) => s.anchorCoordinateAxesToPoint)
  const toggleCoordinateTicks = useEditorStore((s) => s.toggleCoordinateTicks)
  const toggleDisplacementLabels = useEditorStore((s) => s.toggleDisplacementLabels)
  const activeToolName = useToolStore((s) => s.activeToolName)
  const setTool = useToolStore((s) => s.setTool)
  const selected = useSelectionStore((s) => s.selected)
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
  const canExit = hasHandlers && phase !== 'ready' && snapshotCount > 0
  const canJump = hasHandlers && maxTime > 0
  const [jumpInput, setJumpInput] = useState('')
  const [jumpInvalid, setJumpInvalid] = useState(false)
  const secondTicks = useMemo(() => {
    const whole = Math.floor(maxTime)
    if (whole < 0) return [] as number[]
    return Array.from({ length: whole + 1 }, (_, i) => i)
  }, [maxTime])
  const tickLabelInterval = useMemo(() => {
    if (maxTime <= 20) return 1
    if (maxTime <= 60) return 5
    if (maxTime <= 180) return 10
    return 30
  }, [maxTime])

  const snapToSecond = (raw: number) => {
    const clamped = Math.max(0, Math.min(raw, maxTime))
    const nearest = Math.round(clamped)
    const SNAP_THRESHOLD = 0.12
    if (Math.abs(clamped - nearest) <= SNAP_THRESHOLD) return nearest
    return clamped
  }

  const phaseLabel =
    phase === 'playing' ? '播放中'
      : phase === 'paused' ? '已暂停'
        : phase === 'stoppedLocked' ? '已停止'
          : '待播放'

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

  const selectedBody = useMemo(() => {
    if (selected.length !== 1 || selected[0].type !== 'body') return null
    return scene.bodies.find((body) => body.id === selected[0].id) ?? null
  }, [scene.bodies, selected])

  return (
    <div
      className="flex items-center gap-1.5 min-w-0"
      style={{ height: EDITOR_CHROME.barHeight, paddingInline: 16 }}
    >
      <div className="flex items-center gap-1.5 mr-1.5 flex-shrink-0">
        <Tip text="选择工具" position="bottom">
          <IconControlButton
            icon={<MousePointer2 size={14} />}
            label="选择工具"
            active={activeToolName === 'select'}
            enabled
            onClick={() => setTool('select')}
          />
        </Tip>
        <Tip text="拖动画布" position="bottom">
          <IconControlButton
            icon={<Hand size={14} />}
            label="拖动画布"
            active={activeToolName === 'pan'}
            enabled
            onClick={() => setTool('pan')}
          />
        </Tip>
      </div>

      <div
        className="mr-1.5 h-5 w-px flex-shrink-0"
        style={{ backgroundColor: COLORS.border }}
      />

      <Tip text={phase === 'paused' ? '继续仿真' : '开始仿真'} position="bottom">
        <IconControlButton
          icon={<Play size={14} />}
          label={phase === 'ready' ? '开始仿真' : '继续仿真'}
          active={phase === 'playing'}
          enabled={canPlay}
          onClick={() => handlers?.play()}
        />
      </Tip>
      <Tip text="暂停仿真" position="bottom">
        <IconControlButton
          icon={<Pause size={14} />}
          label="暂停仿真"
          active={phase === 'paused'}
          enabled={canPause}
          onClick={() => handlers?.pause()}
        />
      </Tip>
      <Tip text="结束仿真" position="bottom">
        <IconControlButton
          icon={<Square size={14} />}
          label="结束仿真"
          active={phase === 'stoppedLocked'}
          enabled={canStop}
          onClick={() => handlers?.stop()}
        />
      </Tip>
      <Tip text="退出仿真" position="bottom">
        <IconControlButton
          icon={<X size={14} />}
          label="退出仿真"
          enabled={canExit}
          onClick={() => handlers?.reset()}
        />
      </Tip>

      <div className="ml-1.5 relative h-10 flex-1 min-w-[180px] sm:min-w-[220px] xl:min-w-[260px]">
        <Slider
          className="absolute inset-x-0 top-0"
          min={0}
          max={maxTime}
          step={0.01}
          value={[Math.min(currentTime, maxTime)]}
          onValueChange={(value) => handlers?.seek(snapToSecond(Number(value[0] ?? 0)))}
          disabled={snapshotCount <= 1 || !handlers}
        />
        {maxTime > 0 && secondTicks.length > 1 && (
          <>
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-[2px] h-5"
            >
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
                      backgroundColor: major ? COLORS.textMuted : COLORS.borderStrong,
                      opacity: major ? 0.8 : 0.62,
                    }}
                  />
                )
              })}
            </div>

            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-6 h-3"
            >
              {secondTicks.map((sec) => {
                const showLabel = sec % tickLabelInterval === 0 || sec === Math.floor(maxTime)
                if (!showLabel) return null
                return (
                  <span
                    key={`label-${sec}`}
                    className="absolute -translate-x-1/2 text-[10px] leading-none"
                    style={{
                      left: `${(sec / maxTime) * 100}%`,
                      color: sec % tickLabelInterval === 0 ? COLORS.textSecondary : COLORS.textMuted,
                    }}
                  >
                    {sec}s
                  </span>
                )
              })}
            </div>
          </>
        )}
      </div>

      <span className="text-xs ml-1 hidden 2xl:inline" style={{ color: COLORS.textMuted }}>
        {phaseLabel}
      </span>

      <div className="ml-1 flex items-center gap-1.5 flex-shrink-0">
        <div className="hidden xl:flex items-center gap-1 rounded-full px-1.5 py-1" style={{
          border: `1px solid ${COLORS.borderStrong}`,
          backgroundColor: COLORS.white,
        }}>
          {COORDINATE_AXIS_OPTIONS.map((option) => {
            const active = coordinateAxes.mode === option.mode
            return (
              <button
                key={option.mode}
                type="button"
                onClick={() => setCoordinateAxisMode(option.mode)}
                className="rounded px-1.5 py-0.5 text-[10px] leading-none"
                style={{
                  backgroundColor: active ? COLORS.primary : 'transparent',
                  color: active ? COLORS.white : COLORS.textSecondary,
                  cursor: 'pointer',
                }}
                title={`坐标轴：${option.label}`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        <div className="hidden xl:flex items-center gap-1 rounded-full px-1.5 py-1" style={{
          border: `1px solid ${COLORS.borderStrong}`,
          backgroundColor: COLORS.white,
        }}>
          <button
            type="button"
            onClick={anchorCoordinateAxesToWorld}
            className="rounded px-1.5 py-0.5 text-[10px] leading-none"
            style={{
              backgroundColor: coordinateAxes.originType === 'world' ? COLORS.primary : 'transparent',
              color: coordinateAxes.originType === 'world' ? COLORS.white : COLORS.textSecondary,
              cursor: 'pointer',
            }}
            title="使用世界原点"
          >
            世界
          </button>
          <button
            type="button"
            onClick={() => {
              if (!selectedBody) return
              anchorCoordinateAxesToPoint(selectedBody.position, selectedBody.label)
            }}
            disabled={!selectedBody}
            className="rounded px-1.5 py-0.5 text-[10px] leading-none"
            style={{
              backgroundColor: coordinateAxes.originType === 'anchored' ? COLORS.primary : 'transparent',
              color: coordinateAxes.originType === 'anchored' ? COLORS.white : selectedBody ? COLORS.textSecondary : COLORS.textTertiary,
              cursor: selectedBody ? 'pointer' : 'not-allowed',
            }}
            title={selectedBody ? '使用当前选中物体位置' : '请先选中一个物体'}
          >
            选中
          </button>
        </div>
        <div className="hidden xl:flex items-center gap-1 rounded-full px-1.5 py-1" style={{
          border: `1px solid ${COLORS.borderStrong}`,
          backgroundColor: COLORS.white,
        }}>
          <button
            type="button"
            onClick={toggleCoordinateTicks}
            className="rounded px-1.5 py-0.5 text-[10px] leading-none"
            style={{
              backgroundColor: coordinateAxes.showTicks ? COLORS.primary : 'transparent',
              color: coordinateAxes.showTicks ? COLORS.white : COLORS.textSecondary,
              cursor: 'pointer',
            }}
            title="显示刻度"
          >
            刻度
          </button>
          <button
            type="button"
            onClick={toggleDisplacementLabels}
            className="rounded px-1.5 py-0.5 text-[10px] leading-none"
            style={{
              backgroundColor: coordinateAxes.showDisplacementLabels ? COLORS.primary : 'transparent',
              color: coordinateAxes.showDisplacementLabels ? COLORS.white : COLORS.textSecondary,
              cursor: 'pointer',
            }}
            title="显示位移标注"
          >
            位移
          </button>
        </div>
        <div className="hidden xl:flex items-center gap-1 rounded-full px-1.5 py-1" style={{
          border: `1px solid ${COLORS.borderStrong}`,
          backgroundColor: COLORS.white,
        }}>
          {PLAYBACK_SPEED_OPTIONS.map((speed) => {
            const active = Math.abs(playbackSpeed - speed) < 1e-6
            return (
              <button
                key={speed}
                type="button"
                onClick={() => setPlaybackSpeed(speed)}
                className="rounded px-1.5 py-0.5 text-[10px] leading-none"
                style={{
                  backgroundColor: active ? COLORS.primary : 'transparent',
                  color: active ? COLORS.white : COLORS.textSecondary,
                  cursor: 'pointer',
                }}
              >
                {speed}x
              </button>
            )
          })}
        </div>
        <span className="text-xs tabular-nums" style={{ color: COLORS.textMuted }}>
          {formatTimeLabel(currentTime)} / {formatTimeLabel(maxTime)}
        </span>
        <div className="hidden xl:flex items-center gap-1.5">
          <input
            type="number"
            min={0}
            max={maxTime}
            step={0.01}
            value={jumpInput}
            onChange={(e) => {
              const raw = e.target.value
              setJumpInput(raw)
              if (raw.trim() === '') {
                setJumpInvalid(false)
                return
              }
              setJumpInvalid(parseFiniteNumber(raw) === null)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleJump()
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
            className="h-5 w-16 rounded px-1 text-[10px] tabular-nums"
            style={{
              border: `1px solid ${jumpInvalid ? COLORS.error : COLORS.borderStrong}`,
              backgroundColor: canJump ? COLORS.white : COLORS.bgMuted,
              color: COLORS.text,
            }}
            title={jumpInvalid ? '请输入有效数字' : undefined}
          />
          <button
            type="button"
            onClick={handleJump}
            disabled={!canJump}
            className="h-5 rounded px-1.5 text-[10px]"
            style={{
              border: `1px solid ${COLORS.borderStrong}`,
              backgroundColor: canJump ? COLORS.white : COLORS.bgMuted,
              color: canJump ? COLORS.text : COLORS.textTertiary,
              cursor: canJump ? 'pointer' : 'not-allowed',
            }}
          >
            跳转
          </button>
        </div>
      </div>
    </div>
  )
}
