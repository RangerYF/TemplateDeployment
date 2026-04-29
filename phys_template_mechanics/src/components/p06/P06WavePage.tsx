import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { ChevronLeft, Pause, Play, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens'
import {
  DOPPLER_SPEED_PRESETS,
  DEFAULT_DOPPLER_PARAMS,
  DEFAULT_SUPERPOSITION_PARAMS,
  DEFAULT_STANDING_PARAMS,
  DEFAULT_WAVE_PARAMS,
  P06_DOMAIN_LENGTH_CM,
  P06_MODULES,
  clampParticleIndex,
  getDopplerDerivedValues,
  getDopplerWavefronts,
  getEffectiveSuperpositionParams,
  getInterferenceResultantAmplitudeCm,
  getLongitudinalDisplacementCm,
  getOscillationTravelDistanceCm,
  getParticleXs,
  getStandingDerivedValues,
  getStandingSample,
  getSuperpositionDerivedValues,
  getSuperpositionRelativePhase,
  getSuperpositionSample,
  getTransverseDisplacementCm,
  getWaveDerivedValues,
  getWavePhase,
  normalizeP06ModuleId,
  normalizePhaseRadians,
  type DopplerParams,
  type P06ModuleDefinition,
  type StandingHarmonic,
  type StandingParams,
  type SuperpositionMode,
  type SuperpositionParams,
  type WaveDirection,
  type WaveParams,
} from './waveMath'
import {
  createP06SnapshotDocument,
  getDefaultP06Snapshot,
  parseP06Snapshot,
  validateP06Snapshot,
  type P06DisplayOptionsSnapshot,
  type P06PlaybackRate,
  type P06SnapshotPayload,
  type P06SnapshotValidationResult,
} from './snapshot'

interface P06WavePageProps {
  moduleId: string | null
  onChangeModule: (moduleId: string) => void
  onBack: () => void
}

type WaveViewVariant = 'transverse' | 'longitudinal'
type DisplayOptionKey =
  | 'showComponents'
  | 'showCombined'
  | 'showStandingMarkers'
  | 'showDirectionArrows'

const PLAYBACK_SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2] as const
const WAVE_ONE_COLOR = COLORS.info
const WAVE_TWO_COLOR = COLORS.primary
const COMBINED_COLOR = COLORS.warning

interface P06RuntimeState {
  activeModuleId: ReturnType<typeof normalizeP06ModuleId>
  singleParams: WaveParams
  superpositionParams: SuperpositionParams
  standingParams: StandingParams
  dopplerParams: DopplerParams
  displayOptions: P06DisplayOptionsSnapshot
  selectedIndex: number
  direction: WaveDirection
  timeS: number
  isPlaying: boolean
  playbackRate: P06PlaybackRate
}

function getParticleCountForSnapshotPayload(payload: P06SnapshotPayload): number {
  const module = P06_MODULES.find((item) => item.id === payload.activeModuleId)
  const variant = module?.variant ?? 'transverse'
  if (variant === 'doppler') return 2
  if (variant === 'standing') return payload.params.standing.particleCount
  if (variant === 'interference' || variant === 'beat') {
    const mode: SuperpositionMode = variant === 'beat' ? 'beat' : 'interference'
    return getEffectiveSuperpositionParams(mode, payload.params.superposition).particleCount
  }
  return payload.params.single.particleCount
}

function buildP06SnapshotPayload(state: P06RuntimeState): P06SnapshotPayload {
  return {
    activeModuleId: state.activeModuleId,
    params: {
      single: { ...state.singleParams },
      superposition: { ...state.superpositionParams },
      standing: { ...state.standingParams },
      doppler: { ...state.dopplerParams },
    },
    ui: {
      displayOptions: { ...state.displayOptions },
      selectedIndex: state.selectedIndex,
      direction: state.direction,
    },
    playback: {
      timeS: state.timeS,
      isPlaying: state.isPlaying,
      playbackRate: state.playbackRate,
    },
  }
}

function formatNumber(value: number, digits = 2): string {
  return Number(value).toFixed(digits).replace(/\.?0+$/, '')
}

function PanelCard({
  title,
  subtitle,
  children,
  actions,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section
      className="rounded-2xl"
      style={{
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.card,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div className="flex items-start justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <h2 className="text-sm font-semibold" style={{ color: COLORS.text }}>
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs leading-5" style={{ color: COLORS.textSecondary }}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">{children}</div>
    </section>
  )
}

function ModuleButton({
  module,
  active,
  onClick,
}: {
  module: P06ModuleDefinition
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl px-3.5 py-3 text-left transition-colors"
      style={{
        border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
        backgroundColor: active ? COLORS.primaryLight : COLORS.bg,
        borderRadius: RADIUS.md,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
          {module.title}
        </div>
        <div
          className="rounded-full px-2 py-0.5 text-[11px] font-medium"
          style={{
            backgroundColor: active ? COLORS.primary : COLORS.bgMuted,
            color: active ? COLORS.white : COLORS.textMuted,
          }}
        >
          {module.coveredModelIds.join(' / ')}
        </div>
      </div>
      <div className="mt-1.5 text-xs leading-5" style={{ color: COLORS.textSecondary }}>
        {module.subtitle}
      </div>
    </button>
  )
}

function SliderControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  hint,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
  hint?: string
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-medium" style={{ color: COLORS.text }}>
            {label}
          </div>
          {hint ? (
            <div className="text-[11px] mt-0.5" style={{ color: COLORS.textMuted }}>
              {hint}
            </div>
          ) : null}
        </div>
        <div
          className="rounded-full px-2.5 py-1 text-xs font-semibold"
          style={{
            backgroundColor: COLORS.bgMuted,
            color: COLORS.text,
          }}
        >
          {formatNumber(value, step < 1 ? 2 : 0)}
          {unit}
        </div>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(next) => onChange(Number(next[0] ?? value))}
      />
    </div>
  )
}

function SegmentedButtons<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-full p-1"
      style={{ backgroundColor: COLORS.bgMuted }}
    >
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            onClick={() => onChange(option.value)}
            className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
            style={{
              backgroundColor: active ? COLORS.white : 'transparent',
              color: active ? COLORS.text : COLORS.textMuted,
              boxShadow: active ? SHADOWS.sm : 'none',
            }}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function MetricChip({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div
      className="rounded-2xl px-3 py-2"
      style={{
        backgroundColor: COLORS.bgMuted,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="text-[11px]" style={{ color: COLORS.textMuted }}>
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.text }}>
        {value}
      </div>
    </div>
  )
}

function LegendPill({
  label,
  color,
  dashed = false,
}: {
  label: string
  color: string
  dashed?: boolean
}) {
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs"
      style={{
        backgroundColor: COLORS.bgMuted,
        color: COLORS.textSecondary,
      }}
    >
      <span
        style={{
          width: 18,
          borderTop: `3px ${dashed ? 'dashed' : 'solid'} ${color}`,
          display: 'inline-block',
        }}
      />
      {label}
    </div>
  )
}

function AcceptanceCard({
  title,
  content,
}: {
  title: string
  content: string
}) {
  return (
    <div
      className="rounded-2xl px-3.5 py-3"
      style={{
        backgroundColor: COLORS.bgMuted,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <div className="text-xs font-semibold" style={{ color: COLORS.text }}>
        {title}
      </div>
      <div className="mt-1 text-xs leading-5" style={{ color: COLORS.textSecondary }}>
        {content}
      </div>
    </div>
  )
}

function DisplayOptionToggle({
  label,
  checked,
  onClick,
  hint,
}: {
  label: string
  checked: boolean
  onClick: () => void
  hint?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl px-3 py-2.5 text-left transition-colors"
      style={{
        backgroundColor: checked ? COLORS.primaryLight : COLORS.bgMuted,
        border: `1px solid ${checked ? COLORS.primary : COLORS.border}`,
      }}
    >
      <div className="flex items-center gap-2.5">
        <span
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: `1.5px solid ${checked ? COLORS.primary : COLORS.borderStrong}`,
            backgroundColor: checked ? COLORS.primary : COLORS.bg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.white,
            fontSize: 10,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {checked ? '✓' : ''}
        </span>
        <div className="min-w-0">
          <div className="text-xs font-medium" style={{ color: COLORS.text }}>
            {label}
          </div>
          {hint ? (
            <div className="mt-0.5 text-[11px] leading-4" style={{ color: COLORS.textMuted }}>
              {hint}
            </div>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function ArrowGlyph({
  x1,
  y1,
  x2,
  y2,
  color,
  label,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  label: string
}) {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const headSize = 7
  const hx = x2 - ux * headSize
  const hy = y2 - uy * headSize
  const px = -uy
  const py = ux
  const labelX = (x1 + x2) / 2
  const labelY = (y1 + y2) / 2 - 10

  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2.2} />
      <polygon
        points={`${x2},${y2} ${hx + px * 4},${hy + py * 4} ${hx - px * 4},${hy - py * 4}`}
        fill={color}
      />
      <text x={labelX} y={labelY} fontSize={11} textAnchor="middle" fill={COLORS.textMuted}>
        {label}
      </text>
    </g>
  )
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const radians = (angleDeg * Math.PI) / 180
  return {
    x: cx + radius * Math.cos(radians),
    y: cy + radius * Math.sin(radians),
  }
}

function describeArcPath(
  cx: number,
  cy: number,
  radius: number,
  startAngleDeg: number,
  endAngleDeg: number,
) {
  const start = polarPoint(cx, cy, radius, startAngleDeg)
  const end = polarPoint(cx, cy, radius, endAngleDeg)
  const largeArcFlag = Math.abs(endAngleDeg - startAngleDeg) > 180 ? 1 : 0
  const sweepFlag = endAngleDeg > startAngleDeg ? 1 : 0
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} ${sweepFlag} ${end.x} ${end.y}`
}

function SingleWaveDisplay({
  variant,
  params,
  timeS,
  direction,
  selectedIndex,
  onSelectIndex,
  showTranslationOverlay = false,
  showDirectionArrows = false,
  compact = false,
}: {
  variant: WaveViewVariant
  params: WaveParams
  timeS: number
  direction: WaveDirection
  selectedIndex: number
  onSelectIndex: (index: number) => void
  showTranslationOverlay?: boolean
  showDirectionArrows?: boolean
  compact?: boolean
}) {
  const width = 920
  const height = compact ? 220 : 300
  const paddingX = 42
  const paddingTop = 28
  const paddingBottom = 34
  const particleXs = getParticleXs(params.particleCount)
  const derived = getWaveDerivedValues(params)
  const plotWidth = width - paddingX * 2
  const scaleX = plotWidth / P06_DOMAIN_LENGTH_CM
  const baseY = variant === 'transverse' ? height * 0.68 : height * 0.56
  const verticalScale = 4.6
  const longitudinalScale = 1.8
  const particleRadius = compact ? 5 : 6
  const samples = 180
  const directionText = direction === 1 ? '沿 +x 传播' : '沿 -x 传播'
  const selectedX = particleXs[selectedIndex] ?? particleXs[0] ?? 0
  const selectedPhase = getWavePhase(selectedX, timeS, derived, direction)
  const velocitySignal = Math.cos(selectedPhase)
  const velocityDirection = velocitySignal >= 0 ? 1 : -1
  const velocityMagnitude = Math.max(0.25, Math.min(1, Math.abs(velocitySignal)))
  const propagationArrowY = compact ? 36 : 42
  const vibrationAnchorX = width - (compact ? 78 : 92)
  const vibrationAnchorY = compact ? 84 : 92
  const propagationStartX = width - (compact ? 152 : 182)
  const propagationLength = compact ? 42 : 52
  const vibrationLength = (compact ? 22 : 28) * velocityMagnitude

  const continuousPoints = Array.from({ length: samples }, (_, index) => {
    const xCm = (P06_DOMAIN_LENGTH_CM * index) / (samples - 1)
    const displacementCm = getTransverseDisplacementCm(
      xCm,
      timeS,
      params,
      derived,
      direction,
    )
    return `${paddingX + xCm * scaleX},${baseY - displacementCm * verticalScale}`
  }).join(' ')

  const overlayPoints = Array.from({ length: samples }, (_, index) => {
    const xCm = (P06_DOMAIN_LENGTH_CM * index) / (samples - 1)
    const displacementCm = getTransverseDisplacementCm(
      xCm,
      timeS + params.deltaTimeS,
      params,
      derived,
      direction,
    )
    return `${paddingX + xCm * scaleX},${baseY - displacementCm * verticalScale}`
  }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-2xl"
      style={{
        backgroundColor: COLORS.bgPage,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <rect x={0} y={0} width={width} height={height} rx={18} fill={COLORS.bgPage} />
      <line
        x1={paddingX}
        x2={width - paddingX}
        y1={baseY}
        y2={baseY}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <line
        x1={paddingX}
        x2={paddingX}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <text x={paddingX} y={18} fontSize={12} fill={COLORS.textMuted}>
        {variant === 'transverse' ? '波形图快照 y-x' : '纵波质点分布快照'}
      </text>
      <text x={width - paddingX} y={18} fontSize={12} textAnchor="end" fill={COLORS.textMuted}>
        {directionText}
      </text>
      <text
        x={paddingX - 10}
        y={paddingTop + 4}
        fontSize={12}
        textAnchor="end"
        fill={COLORS.textMuted}
      >
        {variant === 'transverse' ? 'y' : '位移'}
      </text>
      <text
        x={width - paddingX}
        y={height - 10}
        fontSize={12}
        textAnchor="end"
        fill={COLORS.textMuted}
      >
        x
      </text>

      {showDirectionArrows ? (
        <>
          <ArrowGlyph
            x1={propagationStartX}
            y1={propagationArrowY}
            x2={propagationStartX + direction * propagationLength}
            y2={propagationArrowY}
            color={COLORS.text}
            label="传播"
          />
          <ArrowGlyph
            x1={vibrationAnchorX}
            y1={vibrationAnchorY}
            x2={
              variant === 'longitudinal'
                ? vibrationAnchorX + velocityDirection * vibrationLength
                : vibrationAnchorX
            }
            y2={
              variant === 'transverse'
                ? vibrationAnchorY - velocityDirection * vibrationLength
                : vibrationAnchorY
            }
            color={variant === 'transverse' ? COLORS.info : COLORS.primary}
            label="振动"
          />
        </>
      ) : null}

      {variant === 'transverse' ? (
        <>
          {showTranslationOverlay ? (
            <polyline
              fill="none"
              stroke={COLORS.warning}
              strokeWidth={2}
              strokeDasharray="7 7"
              points={overlayPoints}
            />
          ) : null}
          <polyline fill="none" stroke={COLORS.info} strokeWidth={3} points={continuousPoints} />
        </>
      ) : null}

      {particleXs.map((xCm, index) => {
        const transverseCm = getTransverseDisplacementCm(
          xCm,
          timeS,
          params,
          derived,
          direction,
        )
        const longitudinalCm = getLongitudinalDisplacementCm(
          xCm,
          timeS,
          params,
          derived,
          direction,
        )
        const cx =
          paddingX +
          xCm * scaleX +
          (variant === 'longitudinal' ? longitudinalCm * longitudinalScale : 0)
        const cy = variant === 'transverse' ? baseY - transverseCm * verticalScale : baseY
        const active = index === selectedIndex
        return (
          <g key={index}>
            <circle
              cx={cx}
              cy={cy}
              r={active ? particleRadius + 3 : particleRadius}
              fill={active ? COLORS.warning : COLORS.info}
              stroke={active ? COLORS.warning : COLORS.white}
              strokeWidth={active ? 5 : 2}
              opacity={active ? 1 : 0.92}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectIndex(index)}
            />
            {active ? (
              <circle
                cx={cx}
                cy={cy}
                r={particleRadius + 9}
                fill="none"
                stroke={COLORS.warning}
                strokeOpacity={0.25}
                strokeWidth={6}
              />
            ) : null}
          </g>
        )
      })}

      {showTranslationOverlay ? (
        <text
          x={width - paddingX}
          y={height - paddingBottom - 10}
          fontSize={12}
          textAnchor="end"
          fill={COLORS.warning}
        >
          虚线：t + Δt
        </text>
      ) : null}
    </svg>
  )
}

function SingleOscillationDisplay({
  variant,
  params,
  timeS,
  direction,
  selectedX,
  accentColor,
  compact = false,
}: {
  variant: WaveViewVariant
  params: WaveParams
  timeS: number
  direction: WaveDirection
  selectedX: number
  accentColor: string
  compact?: boolean
}) {
  const width = 920
  const height = compact ? 220 : 260
  const paddingLeft = 52
  const paddingRight = 24
  const paddingTop = 24
  const paddingBottom = 34
  const derived = getWaveDerivedValues(params)
  const windowDuration = derived.periodS * 2
  const startTime = Math.max(0, timeS - derived.periodS * 1.25)
  const endTime = startTime + windowDuration
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const centerY = paddingTop + plotHeight / 2
  const amplitudeScale = (plotHeight * 0.44) / Math.max(params.amplitudeCm, 1)
  const samples = 140

  const getDisplacement = (sampleTime: number) =>
    variant === 'transverse'
      ? getTransverseDisplacementCm(selectedX, sampleTime, params, derived, direction)
      : getLongitudinalDisplacementCm(selectedX, sampleTime, params, derived, direction)

  const linePoints = Array.from({ length: samples }, (_, index) => {
    const sampleTime = startTime + ((endTime - startTime) * index) / (samples - 1)
    const displacement = getDisplacement(sampleTime)
    const x = paddingLeft + ((sampleTime - startTime) / (endTime - startTime)) * plotWidth
    const y = centerY - displacement * amplitudeScale
    return `${x},${y}`
  }).join(' ')

  const currentDisplacement = getDisplacement(timeS)
  const currentX = paddingLeft + ((timeS - startTime) / (endTime - startTime)) * plotWidth
  const currentY = centerY - currentDisplacement * amplitudeScale

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-2xl"
      style={{
        backgroundColor: COLORS.bgPage,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <rect x={0} y={0} width={width} height={height} rx={18} fill={COLORS.bgPage} />
      <line
        x1={paddingLeft}
        x2={width - paddingRight}
        y1={centerY}
        y2={centerY}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <line
        x1={paddingLeft}
        x2={paddingLeft}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <text x={paddingLeft} y={16} fontSize={12} fill={COLORS.textMuted}>
        {variant === 'transverse' ? '选定质点振动图 y-t' : '选定质点位移图 x-t'}
      </text>
      <text
        x={width - paddingRight}
        y={height - 10}
        fontSize={12}
        textAnchor="end"
        fill={COLORS.textMuted}
      >
        t
      </text>
      <polyline fill="none" stroke={accentColor} strokeWidth={3} points={linePoints} />
      <line
        x1={currentX}
        x2={currentX}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.warning}
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      <circle cx={currentX} cy={currentY} r={6} fill={COLORS.warning} />
      <text
        x={currentX}
        y={paddingTop + 14}
        fontSize={12}
        textAnchor="middle"
        fill={COLORS.warning}
      >
        当前时刻
      </text>
    </svg>
  )
}

function SuperpositionWaveDisplay({
  mode,
  params,
  timeS,
  direction,
  selectedIndex,
  onSelectIndex,
  showComponents = true,
  showCombined = true,
}: {
  mode: SuperpositionMode
  params: SuperpositionParams
  timeS: number
  direction: WaveDirection
  selectedIndex: number
  onSelectIndex: (index: number) => void
  showComponents?: boolean
  showCombined?: boolean
}) {
  const effectiveParams = getEffectiveSuperpositionParams(mode, params)
  const width = 920
  const height = 320
  const paddingX = 42
  const paddingTop = 28
  const paddingBottom = 34
  const particleXs = getParticleXs(effectiveParams.particleCount)
  const plotWidth = width - paddingX * 2
  const scaleX = plotWidth / P06_DOMAIN_LENGTH_CM
  const baseY = height * 0.68
  const verticalScale =
    112 / Math.max(effectiveParams.amplitude1Cm + effectiveParams.amplitude2Cm, 1)
  const particleRadius = 5
  const samples = 180

  const wave1Points = Array.from({ length: samples }, (_, index) => {
    const xCm = (P06_DOMAIN_LENGTH_CM * index) / (samples - 1)
    const sample = getSuperpositionSample(mode, xCm, timeS, effectiveParams, direction)
    return `${paddingX + xCm * scaleX},${baseY - sample.wave1Cm * verticalScale}`
  }).join(' ')

  const wave2Points = Array.from({ length: samples }, (_, index) => {
    const xCm = (P06_DOMAIN_LENGTH_CM * index) / (samples - 1)
    const sample = getSuperpositionSample(mode, xCm, timeS, effectiveParams, direction)
    return `${paddingX + xCm * scaleX},${baseY - sample.wave2Cm * verticalScale}`
  }).join(' ')

  const combinedPoints = Array.from({ length: samples }, (_, index) => {
    const xCm = (P06_DOMAIN_LENGTH_CM * index) / (samples - 1)
    const sample = getSuperpositionSample(mode, xCm, timeS, effectiveParams, direction)
    return `${paddingX + xCm * scaleX},${baseY - sample.combinedCm * verticalScale}`
  }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-2xl"
      style={{
        backgroundColor: COLORS.bgPage,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <rect x={0} y={0} width={width} height={height} rx={18} fill={COLORS.bgPage} />
      <line
        x1={paddingX}
        x2={width - paddingX}
        y1={baseY}
        y2={baseY}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <line
        x1={paddingX}
        x2={paddingX}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <text x={paddingX} y={18} fontSize={12} fill={COLORS.textMuted}>
        双波叠加快照 y-x
      </text>
      <text x={width - paddingX} y={18} fontSize={12} textAnchor="end" fill={COLORS.textMuted}>
        {mode === 'interference' ? '同频稳定叠加' : '异频拍现象'}
      </text>
      {showComponents ? (
        <>
          <polyline
            fill="none"
            stroke={WAVE_ONE_COLOR}
            strokeWidth={2}
            strokeDasharray="8 6"
            points={wave1Points}
          />
          <polyline
            fill="none"
            stroke={WAVE_TWO_COLOR}
            strokeWidth={2}
            strokeDasharray="5 6"
            points={wave2Points}
          />
        </>
      ) : null}
      {showCombined ? (
        <polyline fill="none" stroke={COMBINED_COLOR} strokeWidth={3} points={combinedPoints} />
      ) : null}

      {particleXs.map((xCm, index) => {
        const sample = getSuperpositionSample(mode, xCm, timeS, effectiveParams, direction)
        const cx = paddingX + xCm * scaleX
        const wave1Y = baseY - sample.wave1Cm * verticalScale
        const wave2Y = baseY - sample.wave2Cm * verticalScale
        const combinedY = baseY - sample.combinedCm * verticalScale
        const active = index === selectedIndex
        return (
          <g key={index}>
            {showComponents ? (
              <>
                <circle cx={cx} cy={wave1Y} r={3} fill={WAVE_ONE_COLOR} opacity={0.85} />
                <circle cx={cx} cy={wave2Y} r={3} fill={WAVE_TWO_COLOR} opacity={0.85} />
              </>
            ) : null}
            {(showCombined || active) ? (
              <circle
                cx={cx}
                cy={combinedY}
                r={active ? particleRadius + 2 : particleRadius}
                fill={COMBINED_COLOR}
                stroke={active ? COMBINED_COLOR : COLORS.white}
                strokeWidth={active ? 5 : 2}
              />
            ) : null}
            <circle
              cx={cx}
              cy={combinedY}
              r={particleRadius + 7}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectIndex(index)}
            />
            {active ? (
              <circle
                cx={cx}
                cy={combinedY}
                r={particleRadius + 8}
                fill="none"
                stroke={COMBINED_COLOR}
                strokeOpacity={0.22}
                strokeWidth={6}
              />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function SuperpositionOscillationDisplay({
  mode,
  params,
  timeS,
  direction,
  selectedX,
  showComponents = true,
  showCombined = true,
}: {
  mode: SuperpositionMode
  params: SuperpositionParams
  timeS: number
  direction: WaveDirection
  selectedX: number
  showComponents?: boolean
  showCombined?: boolean
}) {
  const effectiveParams = getEffectiveSuperpositionParams(mode, params)
  const derived = getSuperpositionDerivedValues(mode, effectiveParams)
  const width = 920
  const height = 280
  const paddingLeft = 52
  const paddingRight = 24
  const paddingTop = 24
  const paddingBottom = 34
  const beatPeriodS = derived.beatFrequencyHz > 0.0001 ? 1 / derived.beatFrequencyHz : 6
  const windowDuration =
    mode === 'beat'
      ? Math.min(10, Math.max(derived.wave1.periodS * 4, beatPeriodS * 1.25))
      : derived.wave1.periodS * 2.2
  const startTime = Math.max(0, timeS - windowDuration * 0.55)
  const endTime = startTime + windowDuration
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const centerY = paddingTop + plotHeight / 2
  const amplitudeScale =
    (plotHeight * 0.42) /
    Math.max(effectiveParams.amplitude1Cm + effectiveParams.amplitude2Cm, 1)
  const samples = 160

  const wave1Points = Array.from({ length: samples }, (_, index) => {
    const sampleTime = startTime + ((endTime - startTime) * index) / (samples - 1)
    const sample = getSuperpositionSample(
      mode,
      selectedX,
      sampleTime,
      effectiveParams,
      direction,
    )
    const x = paddingLeft + ((sampleTime - startTime) / (endTime - startTime)) * plotWidth
    const y = centerY - sample.wave1Cm * amplitudeScale
    return `${x},${y}`
  }).join(' ')

  const wave2Points = Array.from({ length: samples }, (_, index) => {
    const sampleTime = startTime + ((endTime - startTime) * index) / (samples - 1)
    const sample = getSuperpositionSample(
      mode,
      selectedX,
      sampleTime,
      effectiveParams,
      direction,
    )
    const x = paddingLeft + ((sampleTime - startTime) / (endTime - startTime)) * plotWidth
    const y = centerY - sample.wave2Cm * amplitudeScale
    return `${x},${y}`
  }).join(' ')

  const combinedPoints = Array.from({ length: samples }, (_, index) => {
    const sampleTime = startTime + ((endTime - startTime) * index) / (samples - 1)
    const sample = getSuperpositionSample(
      mode,
      selectedX,
      sampleTime,
      effectiveParams,
      direction,
    )
    const x = paddingLeft + ((sampleTime - startTime) / (endTime - startTime)) * plotWidth
    const y = centerY - sample.combinedCm * amplitudeScale
    return `${x},${y}`
  }).join(' ')

  const currentSample = getSuperpositionSample(mode, selectedX, timeS, effectiveParams, direction)
  const currentX = paddingLeft + ((timeS - startTime) / (endTime - startTime)) * plotWidth
  const currentY = centerY - currentSample.combinedCm * amplitudeScale

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-2xl"
      style={{
        backgroundColor: COLORS.bgPage,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <rect x={0} y={0} width={width} height={height} rx={18} fill={COLORS.bgPage} />
      <line
        x1={paddingLeft}
        x2={width - paddingRight}
        y1={centerY}
        y2={centerY}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <line
        x1={paddingLeft}
        x2={paddingLeft}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <text x={paddingLeft} y={16} fontSize={12} fill={COLORS.textMuted}>
        选定质点叠加振动图 y-t
      </text>
      {showComponents ? (
        <>
          <polyline
            fill="none"
            stroke={WAVE_ONE_COLOR}
            strokeWidth={2}
            strokeDasharray="8 6"
            points={wave1Points}
          />
          <polyline
            fill="none"
            stroke={WAVE_TWO_COLOR}
            strokeWidth={2}
            strokeDasharray="5 6"
            points={wave2Points}
          />
        </>
      ) : null}
      {showCombined ? (
        <polyline fill="none" stroke={COMBINED_COLOR} strokeWidth={3} points={combinedPoints} />
      ) : null}
      <line
        x1={currentX}
        x2={currentX}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.warning}
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      {showCombined ? <circle cx={currentX} cy={currentY} r={6} fill={COMBINED_COLOR} /> : null}
      <text
        x={currentX}
        y={paddingTop + 14}
        fontSize={12}
        textAnchor="middle"
        fill={COLORS.warning}
      >
        当前时刻
      </text>
    </svg>
  )
}

function StandingWaveDisplay({
  params,
  timeS,
  selectedIndex,
  onSelectIndex,
  showComponents = true,
  showCombined = true,
  showMarkers = true,
}: {
  params: StandingParams
  timeS: number
  selectedIndex: number
  onSelectIndex: (index: number) => void
  showComponents?: boolean
  showCombined?: boolean
  showMarkers?: boolean
}) {
  const derived = getStandingDerivedValues(params)
  const particleXs = getParticleXs(params.particleCount, derived.stringLengthCm)
  const width = 920
  const height = 330
  const paddingX = 42
  const paddingTop = 28
  const paddingBottom = 34
  const plotWidth = width - paddingX * 2
  const scaleX = plotWidth / derived.stringLengthCm
  const baseY = height * 0.69
  const verticalScale = 100 / Math.max(params.amplitudeCm * 2, 1)
  const samples = 220
  const particleRadius = 5

  const incidentPoints = Array.from({ length: samples }, (_, index) => {
    const xCm = (derived.stringLengthCm * index) / (samples - 1)
    const sample = getStandingSample(xCm, timeS, params)
    return `${paddingX + xCm * scaleX},${baseY - sample.incidentCm * verticalScale}`
  }).join(' ')

  const reflectedPoints = Array.from({ length: samples }, (_, index) => {
    const xCm = (derived.stringLengthCm * index) / (samples - 1)
    const sample = getStandingSample(xCm, timeS, params)
    return `${paddingX + xCm * scaleX},${baseY - sample.reflectedCm * verticalScale}`
  }).join(' ')

  const standingPoints = Array.from({ length: samples }, (_, index) => {
    const xCm = (derived.stringLengthCm * index) / (samples - 1)
    const sample = getStandingSample(xCm, timeS, params)
    return `${paddingX + xCm * scaleX},${baseY - sample.standingCm * verticalScale}`
  }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-2xl"
      style={{
        backgroundColor: COLORS.bgPage,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <rect x={0} y={0} width={width} height={height} rx={18} fill={COLORS.bgPage} />
      <line
        x1={paddingX}
        x2={width - paddingX}
        y1={baseY}
        y2={baseY}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <line
        x1={paddingX}
        x2={paddingX}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <text x={paddingX} y={18} fontSize={12} fill={COLORS.textMuted}>
        固定端驻波快照 y-x
      </text>
      <text x={width - paddingX} y={18} fontSize={12} textAnchor="end" fill={COLORS.textMuted}>
        {derived.harmonicLabel}
      </text>

      {showComponents ? (
        <>
          <polyline
            fill="none"
            stroke={WAVE_ONE_COLOR}
            strokeWidth={2}
            strokeDasharray="8 6"
            points={incidentPoints}
          />
          <polyline
            fill="none"
            stroke={WAVE_TWO_COLOR}
            strokeWidth={2}
            strokeDasharray="5 6"
            points={reflectedPoints}
          />
        </>
      ) : null}
      {showCombined ? (
        <polyline fill="none" stroke={COMBINED_COLOR} strokeWidth={3} points={standingPoints} />
      ) : null}

      {showMarkers
        ? derived.nodePositionsCm.map((xCm, index) => (
        <g key={`node-${index}`}>
          <circle
            cx={paddingX + xCm * scaleX}
            cy={baseY}
            r={4.5}
            fill={COLORS.text}
          />
          <text
            x={paddingX + xCm * scaleX}
            y={baseY + 20}
            fontSize={11}
            textAnchor="middle"
            fill={COLORS.textMuted}
          >
            波节
          </text>
        </g>
          ))
        : null}

      {showMarkers
        ? derived.antinodePositionsCm.map((xCm, index) => (
        <g key={`antinode-${index}`}>
          <circle
            cx={paddingX + xCm * scaleX}
            cy={baseY - params.amplitudeCm * 2 * verticalScale}
            r={5}
            fill={COLORS.warning}
          />
          <text
            x={paddingX + xCm * scaleX}
            y={baseY - params.amplitudeCm * 2 * verticalScale - 12}
            fontSize={11}
            textAnchor="middle"
            fill={COLORS.textMuted}
          >
            波腹
          </text>
        </g>
          ))
        : null}

      {particleXs.map((xCm, index) => {
        const sample = getStandingSample(xCm, timeS, params)
        const active = index === selectedIndex
        const cx = paddingX + xCm * scaleX
        const cy = baseY - sample.standingCm * verticalScale
        return (
          <g key={index}>
            <circle
              cx={cx}
              cy={cy}
              r={active ? particleRadius + 2 : particleRadius}
              fill={COMBINED_COLOR}
              stroke={active ? COMBINED_COLOR : COLORS.white}
              strokeWidth={active ? 5 : 2}
            />
            <circle
              cx={cx}
              cy={cy}
              r={particleRadius + 7}
              fill="transparent"
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectIndex(index)}
            />
            {active ? (
              <circle
                cx={cx}
                cy={cy}
                r={particleRadius + 8}
                fill="none"
                stroke={COMBINED_COLOR}
                strokeOpacity={0.2}
                strokeWidth={6}
              />
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}

function StandingOscillationDisplay({
  params,
  timeS,
  selectedX,
  showComponents = true,
  showCombined = true,
}: {
  params: StandingParams
  timeS: number
  selectedX: number
  showComponents?: boolean
  showCombined?: boolean
}) {
  const derived = getStandingDerivedValues(params)
  const width = 920
  const height = 280
  const paddingLeft = 52
  const paddingRight = 24
  const paddingTop = 24
  const paddingBottom = 34
  const windowDuration = derived.periodS * 2.2
  const startTime = Math.max(0, timeS - windowDuration * 0.55)
  const endTime = startTime + windowDuration
  const plotWidth = width - paddingLeft - paddingRight
  const plotHeight = height - paddingTop - paddingBottom
  const centerY = paddingTop + plotHeight / 2
  const amplitudeScale = (plotHeight * 0.42) / Math.max(params.amplitudeCm * 2, 1)
  const samples = 160
  const currentSample = getStandingSample(selectedX, timeS, params)
  const incidentPoints = Array.from({ length: samples }, (_, index) => {
    const sampleTime = startTime + ((endTime - startTime) * index) / (samples - 1)
    const sample = getStandingSample(selectedX, sampleTime, params)
    const x = paddingLeft + ((sampleTime - startTime) / (endTime - startTime)) * plotWidth
    const y = centerY - sample.incidentCm * amplitudeScale
    return `${x},${y}`
  }).join(' ')
  const reflectedPoints = Array.from({ length: samples }, (_, index) => {
    const sampleTime = startTime + ((endTime - startTime) * index) / (samples - 1)
    const sample = getStandingSample(selectedX, sampleTime, params)
    const x = paddingLeft + ((sampleTime - startTime) / (endTime - startTime)) * plotWidth
    const y = centerY - sample.reflectedCm * amplitudeScale
    return `${x},${y}`
  }).join(' ')

  const standingPoints = Array.from({ length: samples }, (_, index) => {
    const sampleTime = startTime + ((endTime - startTime) * index) / (samples - 1)
    const sample = getStandingSample(selectedX, sampleTime, params)
    const x = paddingLeft + ((sampleTime - startTime) / (endTime - startTime)) * plotWidth
    const y = centerY - sample.standingCm * amplitudeScale
    return `${x},${y}`
  }).join(' ')

  const envelopeY = currentSample.envelopeCm * amplitudeScale
  const currentX = paddingLeft + ((timeS - startTime) / (endTime - startTime)) * plotWidth
  const currentY = centerY - currentSample.standingCm * amplitudeScale

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-2xl"
      style={{
        backgroundColor: COLORS.bgPage,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <rect x={0} y={0} width={width} height={height} rx={18} fill={COLORS.bgPage} />
      <line
        x1={paddingLeft}
        x2={width - paddingRight}
        y1={centerY}
        y2={centerY}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <line
        x1={paddingLeft}
        x2={paddingLeft}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <text x={paddingLeft} y={16} fontSize={12} fill={COLORS.textMuted}>
        选定位置驻波振动图 y-t
      </text>
      <line
        x1={paddingLeft}
        x2={width - paddingRight}
        y1={centerY - envelopeY}
        y2={centerY - envelopeY}
        stroke={COLORS.warning}
        strokeDasharray="7 7"
        strokeWidth={1.5}
        opacity={0.75}
      />
      <line
        x1={paddingLeft}
        x2={width - paddingRight}
        y1={centerY + envelopeY}
        y2={centerY + envelopeY}
        stroke={COLORS.warning}
        strokeDasharray="7 7"
        strokeWidth={1.5}
        opacity={0.75}
      />
      {showComponents ? (
        <>
          <polyline
            fill="none"
            stroke={WAVE_ONE_COLOR}
            strokeWidth={2}
            strokeDasharray="8 6"
            points={incidentPoints}
          />
          <polyline
            fill="none"
            stroke={WAVE_TWO_COLOR}
            strokeWidth={2}
            strokeDasharray="5 6"
            points={reflectedPoints}
          />
        </>
      ) : null}
      {showCombined ? (
        <polyline fill="none" stroke={COMBINED_COLOR} strokeWidth={3} points={standingPoints} />
      ) : null}
      <line
        x1={currentX}
        x2={currentX}
        y1={paddingTop}
        y2={height - paddingBottom}
        stroke={COLORS.warning}
        strokeWidth={2}
        strokeDasharray="6 6"
      />
      {showCombined ? <circle cx={currentX} cy={currentY} r={6} fill={COMBINED_COLOR} /> : null}
      <text
        x={currentX}
        y={paddingTop + 14}
        fontSize={12}
        textAnchor="middle"
        fill={COLORS.warning}
      >
        当前时刻
      </text>
    </svg>
  )
}

function DopplerWavefrontDisplay({
  params,
  timeS,
}: {
  params: DopplerParams
  timeS: number
}) {
  const derived = getDopplerDerivedValues(params)
  const wavefronts = getDopplerWavefronts(params, timeS, 24)
  const width = 920
  const height = 330
  const paddingX = 42
  const paddingBottom = 34
  const centerX = width * 0.52
  const centerY = height * 0.56
  const plotHalfWidth = width / 2 - paddingX - 16
  const maxFrontReach = wavefronts.reduce(
    (maxValue, front) => Math.max(maxValue, Math.max(front.radiusM - front.centerOffsetM, 0)),
    0,
  )
  const maxBackReach = wavefronts.reduce(
    (maxValue, front) => Math.max(maxValue, front.radiusM + front.centerOffsetM),
    0,
  )
  const viewHalfSpanM = Math.max(24, maxFrontReach, maxBackReach) * 1.05
  const scale = plotHalfWidth / viewHalfSpanM
  const trailLength = Math.max(
    18,
    wavefronts.at(-1)?.centerOffsetM ?? params.sourceSpeedMs * derived.displayPeriodS,
  )
  const observerOffset = viewHalfSpanM * 0.7
  const frontObserverX = centerX + observerOffset * scale
  const backObserverX = centerX - observerOffset * scale

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full rounded-2xl"
      style={{
        backgroundColor: COLORS.bgPage,
        border: `1px solid ${COLORS.border}`,
      }}
    >
      <rect x={0} y={0} width={width} height={height} rx={18} fill={COLORS.bgPage} />
      <line
        x1={paddingX}
        x2={width - paddingX}
        y1={centerY}
        y2={centerY}
        stroke={COLORS.borderStrong}
        strokeWidth={1.5}
      />
      <text x={paddingX} y={18} fontSize={12} fill={COLORS.textMuted}>
        多普勒波前视图
      </text>
      <text x={width - paddingX} y={18} fontSize={12} textAnchor="end" fill={COLORS.textMuted}>
        波源向右运动
      </text>

      {wavefronts
        .slice()
        .reverse()
        .map((front, index) => {
          const cx = centerX - front.centerOffsetM * scale
          const radius = front.radiusM * scale
          return (
            <g key={`wavefront-${index}-${front.ageS}`}>
              <path
                d={describeArcPath(cx, centerY, radius, -62, 62)}
                fill="none"
                stroke={WAVE_ONE_COLOR}
                strokeOpacity={Math.max(0.12, front.opacity * 0.72)}
                strokeWidth={2}
              />
              <path
                d={describeArcPath(cx, centerY, radius, 118, 242)}
                fill="none"
                stroke={WAVE_ONE_COLOR}
                strokeOpacity={Math.max(0.08, front.opacity * 0.42)}
                strokeWidth={1.6}
              />
            </g>
          )
        })}

      {wavefronts.map((front, index) => {
        const cx = centerX - front.centerOffsetM * scale
        return (
          <circle
            key={`emission-${index}-${front.ageS}`}
            cx={cx}
            cy={centerY}
            r={2.6}
            fill={COLORS.textMuted}
            opacity={Math.max(0.2, front.opacity * 0.7)}
          />
        )
      })}

      <line
        x1={centerX - trailLength * scale}
        x2={centerX}
        y1={centerY + 42}
        y2={centerY + 42}
        stroke={COLORS.textMuted}
        strokeWidth={1.5}
        strokeDasharray="6 6"
        opacity={0.8}
      />
      <polygon
        points={`${centerX + 16},${centerY + 42} ${centerX + 2},${centerY + 36} ${centerX + 2},${centerY + 48}`}
        fill={COLORS.textMuted}
        opacity={0.8}
      />
      <text
        x={centerX - trailLength * scale}
        y={centerY + 61}
        fontSize={11}
        fill={COLORS.textMuted}
      >
        波源轨迹
      </text>

      <circle cx={centerX} cy={centerY} r={11} fill={COMBINED_COLOR} />
      <circle cx={centerX} cy={centerY} r={5.5} fill={COLORS.text} opacity={0.9} />
      <text x={centerX} y={centerY - 18} fontSize={12} textAnchor="middle" fill={COLORS.text}>
        波源
      </text>

      <line
        x1={centerX}
        x2={frontObserverX}
        y1={centerY - 68}
        y2={centerY - 68}
        stroke={COLORS.warning}
        strokeWidth={2}
        opacity={0.8}
      />
      <line
        x1={backObserverX}
        x2={centerX}
        y1={centerY - 68}
        y2={centerY - 68}
        stroke={COLORS.primary}
        strokeWidth={2}
        opacity={0.8}
      />
      <circle cx={frontObserverX} cy={centerY - 68} r={4.5} fill={COLORS.warning} />
      <circle cx={backObserverX} cy={centerY - 68} r={4.5} fill={COLORS.primary} />
      <text
        x={frontObserverX}
        y={centerY - 82}
        fontSize={11}
        textAnchor="middle"
        fill={COLORS.textMuted}
      >
        前方
      </text>
      <text
        x={backObserverX}
        y={centerY - 82}
        fontSize={11}
        textAnchor="middle"
        fill={COLORS.textMuted}
      >
        后方
      </text>

      <text
        x={paddingX}
        y={height - paddingBottom + 18}
        fontSize={12}
        fill={COLORS.textMuted}
      >
        当前比值 vs / v = {formatNumber(derived.sourceSpeedRatio, 2)}
      </text>
      <text
        x={width - paddingX}
        y={height - paddingBottom + 18}
        fontSize={12}
        textAnchor="end"
        fill={derived.isNearCritical ? COLORS.warning : COLORS.textMuted}
      >
        {derived.isNearCritical ? '接近波速，前方波前明显压缩' : '前密后疏随速度比连续变化'}
      </text>
    </svg>
  )
}

export function P06WavePage({ moduleId, onChangeModule, onBack }: P06WavePageProps) {
  const activeModuleId = normalizeP06ModuleId(moduleId)
  const activeModule = P06_MODULES.find((module) => module.id === activeModuleId)
  const [singleParams, setSingleParams] = useState<WaveParams>(DEFAULT_WAVE_PARAMS)
  const [superpositionParams, setSuperpositionParams] = useState<SuperpositionParams>(
    DEFAULT_SUPERPOSITION_PARAMS,
  )
  const [standingParams, setStandingParams] = useState(DEFAULT_STANDING_PARAMS)
  const [dopplerParams, setDopplerParams] = useState<DopplerParams>(DEFAULT_DOPPLER_PARAMS)
  const [displayOptions, setDisplayOptions] = useState({
    showComponents: true,
    showCombined: true,
    showStandingMarkers: true,
    showDirectionArrows: true,
  })
  const [selectedIndex, setSelectedIndex] = useState(10)
  const [direction, setDirection] = useState<WaveDirection>(1)
  const [timeS, setTimeS] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_SPEED_OPTIONS)[number]>(1)
  const p06RuntimeStateRef = useRef<P06RuntimeState | null>(null)

  useEffect(() => {
    p06RuntimeStateRef.current = {
      activeModuleId,
      singleParams,
      superpositionParams,
      standingParams,
      dopplerParams,
      displayOptions,
      selectedIndex,
      direction,
      timeS,
      isPlaying,
      playbackRate,
    }
  })

  const moduleVariant = activeModule?.variant ?? 'transverse'
  const isSuperpositionModule =
    moduleVariant === 'interference' || moduleVariant === 'beat'
  const isStandingModule = moduleVariant === 'standing'
  const isDopplerModule = moduleVariant === 'doppler'
  const canToggleComponents = isSuperpositionModule || isStandingModule
  const canToggleCombined = isSuperpositionModule || isStandingModule
  const canToggleStandingMarkers = isStandingModule
  const canToggleDirectionArrows = moduleVariant === 'comparison'
  const hasDisplayOptions =
    canToggleComponents || canToggleCombined || canToggleStandingMarkers || canToggleDirectionArrows
  const stageLabel = isDopplerModule
    ? '阶段 4：多普勒'
    : isStandingModule
      ? '阶段 3：驻波'
      : isSuperpositionModule
        ? '阶段 2：两列波叠加'
        : '阶段 1：一维传播基座'
  const stageSubtitle = isDopplerModule
    ? '已接入移动波源、波前圆弧与前密后疏判读。'
    : isStandingModule
      ? '已接入入射波、反射波、合成驻波与波节波腹标注。'
      : isSuperpositionModule
        ? '已接入分量波 + 合成波 + 选定质点振动图。'
        : '已接入单波传播、波形平移与横纵波对比。'

  const updateFrame = useEffectEvent((deltaSeconds: number) => {
    setTimeS((current) => current + deltaSeconds * playbackRate)
  })

  useEffect(() => {
    if (!isPlaying) return

    let rafId = 0
    let lastTime = performance.now()

    const loop = (now: number) => {
      const deltaSeconds = Math.min(0.05, (now - lastTime) / 1000)
      lastTime = now
      updateFrame(deltaSeconds)
      rafId = window.requestAnimationFrame(loop)
    }

    rafId = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(rafId)
  }, [isPlaying])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const getCurrentState = () => {
      const state = p06RuntimeStateRef.current
      if (!state) {
        throw new Error('P06 runtime is not ready.')
      }
      return state
    }

    const getDefaultSnapshot = () =>
      getDefaultP06Snapshot(getCurrentState().activeModuleId)

    const getSnapshot = () =>
      createP06SnapshotDocument(buildP06SnapshotPayload(getCurrentState()))

    const validateSnapshot = (snapshot: unknown): P06SnapshotValidationResult =>
      validateP06Snapshot(snapshot)

    const loadSnapshot = (snapshot: unknown): P06SnapshotValidationResult => {
      const errors: string[] = []
      const parsed = parseP06Snapshot(snapshot, errors)
      if (!parsed) {
        return {
          ok: false,
          errors,
        }
      }

      const payload = parsed.payload
      const particleCount = getParticleCountForSnapshotPayload(payload)
      const nextSelectedIndex = clampParticleIndex(payload.ui.selectedIndex, particleCount)

      setSingleParams({ ...payload.params.single })
      setSuperpositionParams({ ...payload.params.superposition })
      setStandingParams({ ...payload.params.standing })
      setDopplerParams({ ...payload.params.doppler })
      setDisplayOptions({ ...payload.ui.displayOptions })
      setDirection(payload.ui.direction)
      setTimeS(payload.playback.timeS)
      setIsPlaying(payload.playback.isPlaying)
      setPlaybackRate(payload.playback.playbackRate)
      setSelectedIndex(nextSelectedIndex)

      if (getCurrentState().activeModuleId !== payload.activeModuleId) {
        onChangeModule(payload.activeModuleId)
      }

      return {
        ok: true,
        errors: [],
      }
    }

    const bridge = {
      getDefaultSnapshot,
      getSnapshot,
      loadSnapshot,
      validateSnapshot,
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data
      if (!message || typeof message !== 'object') return

      const data = message as {
        namespace?: string
        type?: string
        requestId?: string
        payload?: unknown
      }

      if (data.namespace !== 'edumind.templateBridge') return

      try {
        if (data.type === 'getDefaultSnapshot') {
          event.source?.postMessage(
            {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: data.requestId,
              success: true,
              payload: bridge.getDefaultSnapshot(),
            },
            { targetOrigin: '*' },
          )
          return
        }
        if (data.type === 'getSnapshot') {
          event.source?.postMessage(
            {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: data.requestId,
              success: true,
              payload: bridge.getSnapshot(),
            },
            { targetOrigin: '*' },
          )
          return
        }
        if (data.type === 'loadSnapshot') {
          const result = bridge.loadSnapshot(data.payload)
          event.source?.postMessage(
            {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: data.requestId,
              success: result.ok,
              payload: result,
              error: result.ok ? undefined : result.errors.join('\n'),
            },
            { targetOrigin: '*' },
          )
          return
        }
        if (data.type === 'validateSnapshot') {
          event.source?.postMessage(
            {
              namespace: 'edumind.templateBridge',
              type: 'response',
              requestId: data.requestId,
              success: true,
              payload: bridge.validateSnapshot(data.payload),
            },
            { targetOrigin: '*' },
          )
        }
      } catch (error) {
        event.source?.postMessage(
          {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: false,
            error: error instanceof Error ? error.message : String(error),
          },
          { targetOrigin: '*' },
        )
      }
    }

    window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?.()
    window.__EDUMIND_TEMPLATE_BRIDGE__ = bridge
    window.addEventListener('message', handleMessage)

    const cleanup = () => {
      window.removeEventListener('message', handleMessage)
    }
    window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__ = cleanup

    return () => {
      cleanup()
      if (window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__ === cleanup) {
        delete window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__
        delete window.__EDUMIND_TEMPLATE_BRIDGE__
      }
    }
  }, [onChangeModule])

  const effectiveSuperpositionParams = getEffectiveSuperpositionParams(
    moduleVariant === 'beat' ? 'beat' : 'interference',
    superpositionParams,
  )
  const standingDerived = getStandingDerivedValues(standingParams)
  const activeParticleCount = isDopplerModule
    ? 2
    : isStandingModule
      ? standingParams.particleCount
      : isSuperpositionModule
        ? effectiveSuperpositionParams.particleCount
        : singleParams.particleCount
  const activeDomainLengthCm = isStandingModule
    ? standingDerived.stringLengthCm
    : P06_DOMAIN_LENGTH_CM
  const particleXs = getParticleXs(activeParticleCount, activeDomainLengthCm)
  const currentSelectedIndex = clampParticleIndex(selectedIndex, activeParticleCount)
  const selectedX = particleXs[currentSelectedIndex]

  const singleDerived = getWaveDerivedValues(singleParams)
  const singleTransverseDisplacement = getTransverseDisplacementCm(
    selectedX,
    timeS,
    singleParams,
    singleDerived,
    direction,
  )
  const singleLongitudinalDisplacement = getLongitudinalDisplacementCm(
    selectedX,
    timeS,
    singleParams,
    singleDerived,
    direction,
  )
  const singleSelectedPhase = normalizePhaseRadians(
    getWavePhase(selectedX, timeS, singleDerived, direction),
  )
  const singleTravelDistanceCm = getOscillationTravelDistanceCm(
    selectedX,
    timeS,
    singleParams,
    direction,
  )
  const waveShiftCm = singleParams.speedCms * singleParams.deltaTimeS

  const superpositionMode: SuperpositionMode =
    moduleVariant === 'beat' ? 'beat' : 'interference'
  const superpositionDerived = getSuperpositionDerivedValues(
    superpositionMode,
    effectiveSuperpositionParams,
  )
  const superpositionSample = getSuperpositionSample(
    superpositionMode,
    selectedX,
    timeS,
    effectiveSuperpositionParams,
    direction,
  )
  const superpositionRelativePhase = normalizePhaseRadians(
    getSuperpositionRelativePhase(
      superpositionMode,
      selectedX,
      timeS,
      effectiveSuperpositionParams,
      direction,
    ),
  )
  const beatPeriodS =
    superpositionDerived.beatFrequencyHz > 0.0001
      ? 1 / superpositionDerived.beatFrequencyHz
      : Number.POSITIVE_INFINITY
  const interferenceAmplitude = getInterferenceResultantAmplitudeCm(
    effectiveSuperpositionParams.amplitude1Cm,
    effectiveSuperpositionParams.amplitude2Cm,
    superpositionRelativePhase,
  )
  const standingSample = getStandingSample(selectedX, timeS, standingParams)
  const standingNodeCount = standingDerived.nodePositionsCm.length
  const standingAntinodeCount = standingDerived.antinodePositionsCm.length
  const dopplerDerived = getDopplerDerivedValues(dopplerParams)
  const singleTrajectoryText =
    moduleVariant === 'longitudinal' ? '沿传播方向的水平直线往复' : '垂直传播方向的竖直直线往复'
  const singleEquilibriumText =
    moduleVariant === 'longitudinal'
      ? `x = ${formatNumber(selectedX, 1)} cm`
      : `x = ${formatNumber(selectedX, 1)} cm, y = 0`
  const singleMotionRangeText =
    moduleVariant === 'longitudinal'
      ? `${formatNumber(selectedX - singleParams.amplitudeCm, 1)} ~ ${formatNumber(selectedX + singleParams.amplitudeCm, 1)} cm`
      : `${formatNumber(-singleParams.amplitudeCm, 1)} ~ ${formatNumber(singleParams.amplitudeCm, 1)} cm`

  const setSingleParam = <K extends keyof WaveParams>(key: K, value: WaveParams[K]) => {
    setSingleParams((current) => ({
      ...current,
      [key]: value,
    }))
    if (key === 'particleCount') {
      setSelectedIndex((current) => clampParticleIndex(current, Number(value)))
    }
  }

  const setSuperpositionParam = <K extends keyof SuperpositionParams>(
    key: K,
    value: SuperpositionParams[K],
  ) => {
    setSuperpositionParams((current) => ({
      ...current,
      [key]: value,
    }))
    if (key === 'particleCount') {
      setSelectedIndex((current) => clampParticleIndex(current, Number(value)))
    }
  }

  const setStandingParam = <K extends keyof StandingParams>(
    key: K,
    value: StandingParams[K],
  ) => {
    setStandingParams((current) => ({
      ...current,
      [key]: value,
    }))
    if (key === 'particleCount') {
      setSelectedIndex((current) => clampParticleIndex(current, Number(value)))
    }
  }

  const setDopplerParam = <K extends keyof DopplerParams>(
    key: K,
    value: DopplerParams[K],
  ) => {
    setDopplerParams((current) => ({
      ...current,
      [key]: value,
    }))
  }

  const toggleDisplayOption = (key: DisplayOptionKey) => {
    setDisplayOptions((current) => {
      if (key === 'showComponents' && current.showComponents && !current.showCombined) {
        return current
      }
      if (key === 'showCombined' && current.showCombined && !current.showComponents) {
        return current
      }
      return {
        ...current,
        [key]: !current[key],
      }
    })
  }

  const handleSelectModule = (nextModuleId: string) => {
    setTimeS(0)
    setIsPlaying(true)
    onChangeModule(nextModuleId)
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.bgPage }}>
      <header
        className="border-b"
        style={{
          borderColor: COLORS.border,
          backgroundColor: COLORS.bg,
          boxShadow: SHADOWS.sm,
        }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full"
              style={{
                border: `1px solid ${COLORS.border}`,
                backgroundColor: COLORS.bg,
                color: COLORS.text,
              }}
            >
              <ChevronLeft size={18} strokeWidth={2.1} />
            </button>
            <div>
              <div className="text-base font-semibold" style={{ color: COLORS.text }}>
                P06 波动与振动演示台
              </div>
              <div className="text-xs" style={{ color: COLORS.textSecondary }}>
                {stageLabel}
              </div>
            </div>
          </div>
          <div
            className="rounded-full px-3 py-1.5 text-xs font-medium"
            style={{
              backgroundColor: COLORS.primaryLight,
              color: COLORS.primary,
            }}
          >
            阶段 1-4 已接入
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
        <div className="grid gap-4 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <aside className="space-y-4">
            <PanelCard
              title="演示模块"
              subtitle="当前已接入 WAV-001 / 002 / 011 / 012 / 021 / 031 / 041 / 051 / 052。"
            >
              <div className="space-y-2.5">
                {P06_MODULES.map((module) => (
                  <ModuleButton
                    key={module.id}
                    module={module}
                    active={module.id === activeModuleId}
                    onClick={() => handleSelectModule(module.id)}
                  />
                ))}
              </div>
            </PanelCard>

            <PanelCard
              title="播放控制"
              subtitle="统一控制传播动画时间，便于讲解相位、干涉稳定性和拍现象。"
              actions={
                <div
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: COLORS.bgMuted,
                    color: COLORS.text,
                  }}
                >
                  t = {formatNumber(timeS, 2)} s
                </div>
              }
            >
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="dark"
                  size="sm"
                  onClick={() => setIsPlaying((current) => !current)}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  {isPlaying ? '暂停' : '播放'}
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setTimeS(0)}>
                  <RotateCcw size={14} />
                  归零
                </Button>
              </div>

              <div className="mt-3">
                <div className="text-xs font-medium mb-2" style={{ color: COLORS.text }}>
                  播放倍率
                </div>
                <SegmentedButtons
                  options={PLAYBACK_SPEED_OPTIONS.map((value) => ({
                    value,
                    label: `${formatNumber(value, value < 1 ? 2 : 1)}x`,
                  }))}
                  value={playbackRate}
                  onChange={setPlaybackRate}
                />
              </div>
            </PanelCard>

            {isDopplerModule ? (
              <PanelCard
                title="多普勒参数"
                subtitle="保持波源向右运动，用前后频率变化解释波前压缩与拉伸。"
              >
                <div className="space-y-4">
                  <SliderControl
                    label="波源频率 f₀"
                    value={dopplerParams.sourceFrequencyHz}
                    min={100}
                    max={1000}
                    step={10}
                    unit=" Hz"
                    onChange={(value) => setDopplerParam('sourceFrequencyHz', value)}
                  />
                  <SliderControl
                    label="波速 v"
                    value={dopplerParams.waveSpeedMs}
                    min={100}
                    max={500}
                    step={1}
                    unit=" m/s"
                    onChange={(value) => setDopplerParam('waveSpeedMs', value)}
                  />
                  <SliderControl
                    label="波源速度 vs"
                    value={dopplerParams.sourceSpeedMs}
                    min={0}
                    max={300}
                    step={1}
                    unit=" m/s"
                    onChange={(value) => setDopplerParam('sourceSpeedMs', value)}
                    hint="建议保持 vs < v，以便使用经典前后频率公式。"
                  />
                  <div>
                    <div className="text-xs font-medium mb-2" style={{ color: COLORS.text }}>
                      预设速度比
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {DOPPLER_SPEED_PRESETS.map((preset) => {
                        const active =
                          Math.abs(
                            dopplerDerived.sourceSpeedRatio - preset.ratio,
                          ) < 0.035
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              setDopplerParam(
                                'sourceSpeedMs',
                                Math.min(300, Math.round(dopplerParams.waveSpeedMs * preset.ratio)),
                              )
                            }
                            className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                            style={{
                              backgroundColor: active ? COLORS.white : COLORS.bgMuted,
                              color: active ? COLORS.text : COLORS.textMuted,
                              boxShadow: active ? SHADOWS.sm : 'none',
                              border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                            }}
                          >
                            {preset.label} ({preset.ratio})
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </PanelCard>
            ) : isStandingModule ? (
              <PanelCard
                title="驻波参数"
                subtitle="按两端固定弦的共振模式组织，频率由 v 与 L 自动确定。"
              >
                <div className="space-y-4">
                  <SliderControl
                    label="入射波振幅 A"
                    value={standingParams.amplitudeCm}
                    min={1}
                    max={20}
                    step={1}
                    unit=" cm"
                    onChange={(value) => setStandingParam('amplitudeCm', value)}
                  />
                  <SliderControl
                    label="波速 v"
                    value={standingParams.speedCms}
                    min={1}
                    max={100}
                    step={1}
                    unit=" cm/s"
                    onChange={(value) => setStandingParam('speedCms', value)}
                  />
                  <SliderControl
                    label="弦长 L"
                    value={standingParams.stringLengthCm}
                    min={20}
                    max={200}
                    step={1}
                    unit=" cm"
                    onChange={(value) => setStandingParam('stringLengthCm', value)}
                  />
                  <div>
                    <div className="text-xs font-medium mb-2" style={{ color: COLORS.text }}>
                      共振模式
                    </div>
                    <SegmentedButtons
                      options={[
                        { value: 1 as StandingHarmonic, label: '基频 n=1' },
                        { value: 2 as StandingHarmonic, label: '二次 n=2' },
                        { value: 3 as StandingHarmonic, label: '三次 n=3' },
                      ]}
                      value={standingParams.harmonic}
                      onChange={(value) => setStandingParam('harmonic', value)}
                    />
                  </div>
                  <SliderControl
                    label="离散质点数 N"
                    value={standingParams.particleCount}
                    min={15}
                    max={60}
                    step={1}
                    unit=""
                    onChange={(value) => setStandingParam('particleCount', Math.round(value))}
                    hint="用于展示波形上的离散点，不改变驻波共振条件。"
                  />
                </div>
              </PanelCard>
            ) : isSuperpositionModule ? (
              <PanelCard
                title="双波参数"
                subtitle={
                  moduleVariant === 'interference'
                    ? 'WAV-011：同频叠加，频率自动保持一致。'
                    : 'WAV-012：异频叠加，重点观察拍频与包络变化。'
                }
              >
                <div className="space-y-4">
                  <SliderControl
                    label="波 1 振幅 A₁"
                    value={superpositionParams.amplitude1Cm}
                    min={1}
                    max={20}
                    step={1}
                    unit=" cm"
                    onChange={(value) => setSuperpositionParam('amplitude1Cm', value)}
                  />
                  <SliderControl
                    label="波 2 振幅 A₂"
                    value={superpositionParams.amplitude2Cm}
                    min={1}
                    max={20}
                    step={1}
                    unit=" cm"
                    onChange={(value) => setSuperpositionParam('amplitude2Cm', value)}
                    hint={moduleVariant === 'beat' ? '拍现象常见情况是 A₁≈A₂。' : undefined}
                  />
                  <SliderControl
                    label={moduleVariant === 'interference' ? '共同频率 f' : '波 1 频率 f₁'}
                    value={superpositionParams.frequency1Hz}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit=" Hz"
                    onChange={(value) => setSuperpositionParam('frequency1Hz', value)}
                  />
                  {moduleVariant === 'interference' ? (
                    <SliderControl
                      label="相位差 Δφ"
                      value={superpositionParams.phaseOffsetRad}
                      min={0}
                      max={Math.PI * 2}
                      step={Math.PI / 12}
                      unit=" rad"
                      onChange={(value) => setSuperpositionParam('phaseOffsetRad', value)}
                      hint="同频模式下波 2 自动反向传播，Δφ 控制固定强弱区的位置。"
                    />
                  ) : (
                    <SliderControl
                      label="波 2 频率 f₂"
                      value={superpositionParams.frequency2Hz}
                      min={0.1}
                      max={10}
                      step={0.1}
                      unit=" Hz"
                      onChange={(value) => setSuperpositionParam('frequency2Hz', value)}
                    />
                  )}
                  <SliderControl
                    label="波速 v"
                    value={superpositionParams.speedCms}
                    min={1}
                    max={100}
                    step={1}
                    unit=" cm/s"
                    onChange={(value) => setSuperpositionParam('speedCms', value)}
                  />
                  <SliderControl
                    label="质点数量 N"
                    value={superpositionParams.particleCount}
                    min={10}
                    max={60}
                    step={1}
                    unit=""
                    onChange={(value) =>
                      setSuperpositionParam('particleCount', Math.round(value))
                    }
                  />
                </div>
              </PanelCard>
            ) : (
              <PanelCard
                title="波参数"
                subtitle="参数直接映射到一维简谐波公式，首版以教学可读性优先。"
              >
                <div className="space-y-4">
                  <SliderControl
                    label="振幅 A"
                    value={singleParams.amplitudeCm}
                    min={1}
                    max={20}
                    step={1}
                    unit=" cm"
                    onChange={(value) => setSingleParam('amplitudeCm', value)}
                  />
                  <SliderControl
                    label="频率 f"
                    value={singleParams.frequencyHz}
                    min={0.1}
                    max={10}
                    step={0.1}
                    unit=" Hz"
                    onChange={(value) => setSingleParam('frequencyHz', value)}
                  />
                  <SliderControl
                    label="波速 v"
                    value={singleParams.speedCms}
                    min={1}
                    max={100}
                    step={1}
                    unit=" cm/s"
                    onChange={(value) => setSingleParam('speedCms', value)}
                  />
                  <SliderControl
                    label="质点数量 N"
                    value={singleParams.particleCount}
                    min={10}
                    max={60}
                    step={1}
                    unit=""
                    onChange={(value) => setSingleParam('particleCount', Math.round(value))}
                  />
                  {moduleVariant === 'translation' ? (
                    <SliderControl
                      label="时间间隔 Δt"
                      value={singleParams.deltaTimeS}
                      min={0.01}
                      max={5}
                      step={0.01}
                      unit=" s"
                      onChange={(value) => setSingleParam('deltaTimeS', value)}
                      hint="虚线波形表示 t + Δt 的位置。"
                    />
                  ) : null}
                </div>
              </PanelCard>
            )}

            <PanelCard
              title={isDopplerModule ? '波源设置' : isStandingModule ? '选点设置' : '传播设置'}
              subtitle={
                isDopplerModule
                  ? '多普勒模块固定向右传播，不使用弦波的选点机制。'
                  : isStandingModule
                  ? '驻波模式下固定为两端反射，保留当前位置选点用于观察振动幅度。'
                  : '可切换传播方向并查看当前选定质点。'
              }
            >
              <div className="space-y-4">
                {!isStandingModule && !isDopplerModule ? (
                  <div>
                    <div className="text-xs font-medium mb-2" style={{ color: COLORS.text }}>
                      传播方向
                    </div>
                    <SegmentedButtons
                      options={[
                        { value: 1 as WaveDirection, label: '沿 +x' },
                        { value: -1 as WaveDirection, label: '沿 -x' },
                      ]}
                      value={direction}
                      onChange={setDirection}
                    />
                  </div>
                ) : null}
                {isDopplerModule ? (
                  <div
                    className="rounded-2xl px-3.5 py-3"
                    style={{
                      backgroundColor: COLORS.bgMuted,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div className="text-xs" style={{ color: COLORS.textMuted }}>
                      当前波源状态
                    </div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.text }}>
                      向右运动，速度比 vs / v = {formatNumber(dopplerDerived.sourceSpeedRatio, 2)}
                    </div>
                    <div className="mt-1 text-xs leading-5" style={{ color: COLORS.textSecondary }}>
                      右侧波前更密、左侧波前更疏；当前视图固定以波源当前位置为中心。
                    </div>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl px-3.5 py-3"
                    style={{
                      backgroundColor: COLORS.bgMuted,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div className="text-xs" style={{ color: COLORS.textMuted }}>
                      当前选中质点
                    </div>
                    <div className="mt-1 text-sm font-semibold" style={{ color: COLORS.text }}>
                      第 {currentSelectedIndex + 1} 个，位置 x = {formatNumber(selectedX, 1)} cm
                    </div>
                    <div className="mt-1 text-xs leading-5" style={{ color: COLORS.textSecondary }}>
                      点击主视图中的任意质点即可切换。
                    </div>
                  </div>
                )}
              </div>
            </PanelCard>

            {hasDisplayOptions ? (
              <PanelCard
                title="显示选项"
                subtitle="控制分量波、合成波、标注和教学辅助箭头的显示。"
              >
                <div className="space-y-2.5">
                  {canToggleComponents ? (
                    <DisplayOptionToggle
                      label="分量波"
                      checked={displayOptions.showComponents}
                      onClick={() => toggleDisplayOption('showComponents')}
                      hint="控制波 1 / 波 2 或入射波 / 反射波的辅助显示。"
                    />
                  ) : null}
                  {canToggleCombined ? (
                    <DisplayOptionToggle
                      label="合成波"
                      checked={displayOptions.showCombined}
                      onClick={() => toggleDisplayOption('showCombined')}
                      hint="隐藏后仍保留选点能力，但不显示主合成曲线。"
                    />
                  ) : null}
                  {canToggleStandingMarkers ? (
                    <DisplayOptionToggle
                      label="波节 / 波腹标注"
                      checked={displayOptions.showStandingMarkers}
                      onClick={() => toggleDisplayOption('showStandingMarkers')}
                      hint="仅驻波模块生效。"
                    />
                  ) : null}
                  {canToggleDirectionArrows ? (
                    <DisplayOptionToggle
                      label="方向箭头"
                      checked={displayOptions.showDirectionArrows}
                      onClick={() => toggleDisplayOption('showDirectionArrows')}
                      hint="显示传播方向与振动方向的动态箭头。"
                    />
                  ) : null}
                </div>
              </PanelCard>
            ) : null}
          </aside>

          <main className="space-y-4">
            <PanelCard title={activeModule?.title ?? '横波传播'} subtitle={activeModule?.subtitle}>
              {moduleVariant === 'comparison' ? (
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="space-y-3">
                    <div className="text-xs font-medium" style={{ color: COLORS.text }}>
                      横波：振动方向与传播方向垂直
                    </div>
                    <SingleWaveDisplay
                      variant="transverse"
                      params={singleParams}
                      timeS={timeS}
                      direction={direction}
                      selectedIndex={currentSelectedIndex}
                      onSelectIndex={setSelectedIndex}
                      showDirectionArrows={displayOptions.showDirectionArrows}
                      compact
                    />
                    <SingleOscillationDisplay
                      variant="transverse"
                      params={singleParams}
                      timeS={timeS}
                      direction={direction}
                      selectedX={selectedX}
                      accentColor={COLORS.info}
                      compact
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="text-xs font-medium" style={{ color: COLORS.text }}>
                      纵波：振动方向与传播方向平行
                    </div>
                    <SingleWaveDisplay
                      variant="longitudinal"
                      params={singleParams}
                      timeS={timeS}
                      direction={direction}
                      selectedIndex={currentSelectedIndex}
                      onSelectIndex={setSelectedIndex}
                      showDirectionArrows={displayOptions.showDirectionArrows}
                      compact
                    />
                    <SingleOscillationDisplay
                      variant="longitudinal"
                      params={singleParams}
                      timeS={timeS}
                      direction={direction}
                      selectedX={selectedX}
                      accentColor={COLORS.primary}
                      compact
                    />
                  </div>
                </div>
              ) : isDopplerModule ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <LegendPill label="波前圆弧" color={WAVE_ONE_COLOR} />
                    <LegendPill label="移动波源" color={COMBINED_COLOR} />
                  </div>
                  <DopplerWavefrontDisplay params={dopplerParams} timeS={timeS} />
                </div>
              ) : isStandingModule ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <LegendPill label="入射波" color={WAVE_ONE_COLOR} dashed />
                    <LegendPill label="反射波" color={WAVE_TWO_COLOR} dashed />
                    <LegendPill label="合成驻波" color={COMBINED_COLOR} />
                  </div>
                  <StandingWaveDisplay
                    params={standingParams}
                    timeS={timeS}
                    selectedIndex={currentSelectedIndex}
                    onSelectIndex={setSelectedIndex}
                    showComponents={displayOptions.showComponents}
                    showCombined={displayOptions.showCombined}
                    showMarkers={displayOptions.showStandingMarkers}
                  />
                  <StandingOscillationDisplay
                    params={standingParams}
                    timeS={timeS}
                    selectedX={selectedX}
                    showComponents={displayOptions.showComponents}
                    showCombined={displayOptions.showCombined}
                  />
                </div>
              ) : isSuperpositionModule ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <LegendPill label="波 1" color={WAVE_ONE_COLOR} dashed />
                    <LegendPill label="波 2" color={WAVE_TWO_COLOR} dashed />
                    <LegendPill label="合成波" color={COMBINED_COLOR} />
                  </div>
                  <SuperpositionWaveDisplay
                    mode={superpositionMode}
                    params={effectiveSuperpositionParams}
                    timeS={timeS}
                    direction={direction}
                    selectedIndex={currentSelectedIndex}
                    onSelectIndex={setSelectedIndex}
                    showComponents={displayOptions.showComponents}
                    showCombined={displayOptions.showCombined}
                  />
                  <SuperpositionOscillationDisplay
                    mode={superpositionMode}
                    params={effectiveSuperpositionParams}
                    timeS={timeS}
                    direction={direction}
                    selectedX={selectedX}
                    showComponents={displayOptions.showComponents}
                    showCombined={displayOptions.showCombined}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  <SingleWaveDisplay
                    variant={moduleVariant === 'longitudinal' ? 'longitudinal' : 'transverse'}
                    params={singleParams}
                    timeS={timeS}
                    direction={direction}
                    selectedIndex={currentSelectedIndex}
                    onSelectIndex={setSelectedIndex}
                    showTranslationOverlay={moduleVariant === 'translation'}
                  />
                  <SingleOscillationDisplay
                    variant={moduleVariant === 'longitudinal' ? 'longitudinal' : 'transverse'}
                    params={singleParams}
                    timeS={timeS}
                    direction={direction}
                    selectedX={selectedX}
                    accentColor={
                      moduleVariant === 'longitudinal' ? COLORS.primary : COLORS.info
                    }
                  />
                </div>
              )}
            </PanelCard>

            <PanelCard
              title={
                isDopplerModule
                  ? '多普勒判读与教学读数'
                  : isStandingModule
                  ? '驻波判读与教学读数'
                  : isSuperpositionModule
                    ? '叠加判读与教学读数'
                    : '派生量与教学读数'
              }
              subtitle={
                isDopplerModule
                  ? '用于课堂讲解前后频率变化、速度比与波前前密后疏。'
                  : isStandingModule
                  ? '用于课堂讲解固定端驻波、共振条件和波节波腹。'
                  : isSuperpositionModule
                  ? '用于课堂讲解“分量波 + 合成波”的稳定干涉与拍现象。'
                  : '用于课堂讲解“波形图快照”和“单质点振动图”之间的数学对应。'
              }
            >
              {isDopplerModule ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricChip
                    label="波源频率 f₀"
                    value={`${formatNumber(dopplerParams.sourceFrequencyHz, 0)} Hz`}
                  />
                  <MetricChip
                    label="波速 v"
                    value={`${formatNumber(dopplerParams.waveSpeedMs, 0)} m/s`}
                  />
                  <MetricChip
                    label="波源速度 vs"
                    value={`${formatNumber(dopplerParams.sourceSpeedMs, 0)} m/s`}
                  />
                  <MetricChip
                    label="速度比 vs / v"
                    value={formatNumber(dopplerDerived.sourceSpeedRatio, 2)}
                  />
                  <MetricChip
                    label="前方频率 f前"
                    value={
                      dopplerDerived.frontFrequencyHz === null
                        ? '公式失效'
                        : `${formatNumber(dopplerDerived.frontFrequencyHz, 1)} Hz`
                    }
                  />
                  <MetricChip
                    label="后方频率 f后"
                    value={`${formatNumber(dopplerDerived.backFrequencyHz, 1)} Hz`}
                  />
                  <MetricChip
                    label="前方频率比"
                    value={
                      dopplerDerived.frontRatio === null
                        ? '超过波速'
                        : `${formatNumber(dopplerDerived.frontRatio, 2)}x`
                    }
                  />
                  <MetricChip
                    label="后方频率比"
                    value={`${formatNumber(dopplerDerived.backRatio, 2)}x`}
                  />
                </div>
              ) : isStandingModule ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricChip
                    label="共振模式"
                    value={standingDerived.harmonicLabel}
                  />
                  <MetricChip
                    label="共振频率 fₙ"
                    value={`${formatNumber(1 / standingDerived.periodS, 2)} Hz`}
                  />
                  <MetricChip
                    label="波长 λ"
                    value={`${formatNumber(standingDerived.wavelengthCm, 2)} cm`}
                  />
                  <MetricChip
                    label="周期 T"
                    value={`${formatNumber(standingDerived.periodS, 2)} s`}
                  />
                  <MetricChip
                    label="波节数"
                    value={`${standingNodeCount}`}
                  />
                  <MetricChip
                    label="波腹数"
                    value={`${standingAntinodeCount}`}
                  />
                  <MetricChip
                    label="波腹最大振幅"
                    value={`${formatNumber(standingParams.amplitudeCm * 2, 2)} cm`}
                  />
                  <MetricChip
                    label="当前选点振幅"
                    value={`${formatNumber(standingSample.envelopeCm, 2)} cm`}
                  />
                </div>
              ) : isSuperpositionModule ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {superpositionMode === 'interference' ? (
                    <>
                      <MetricChip
                        label="共同波长 λ"
                        value={`${formatNumber(superpositionDerived.wave1.wavelengthCm, 2)} cm`}
                      />
                      <MetricChip
                        label="共同周期 T"
                        value={`${formatNumber(superpositionDerived.wave1.periodS, 2)} s`}
                      />
                      <MetricChip
                        label="当前相位差 Δφ"
                        value={`${formatNumber(superpositionRelativePhase, 2)} rad`}
                      />
                      <MetricChip
                        label="当前合成振幅"
                        value={`${formatNumber(interferenceAmplitude, 2)} cm`}
                      />
                      <MetricChip
                        label="最强相长"
                        value={`${formatNumber(superpositionDerived.amplitudeMaxCm, 2)} cm`}
                      />
                      <MetricChip
                        label="最弱相消"
                        value={`${formatNumber(superpositionDerived.amplitudeMinCm, 2)} cm`}
                      />
                      <MetricChip
                        label="当前合成位移"
                        value={`${formatNumber(superpositionSample.combinedCm, 2)} cm`}
                      />
                      <MetricChip label="稳定性" value="同频 + 相位差恒定 = 稳定干涉" />
                    </>
                  ) : (
                    <>
                      <MetricChip
                        label="波 1 波长 λ₁"
                        value={`${formatNumber(superpositionDerived.wave1.wavelengthCm, 2)} cm`}
                      />
                      <MetricChip
                        label="波 2 波长 λ₂"
                        value={`${formatNumber(superpositionDerived.wave2.wavelengthCm, 2)} cm`}
                      />
                      <MetricChip
                        label="拍频 f拍"
                        value={`${formatNumber(superpositionDerived.beatFrequencyHz, 2)} Hz`}
                      />
                      <MetricChip
                        label="包络周期"
                        value={
                          Number.isFinite(beatPeriodS)
                            ? `${formatNumber(beatPeriodS, 2)} s`
                            : '频差过小'
                        }
                      />
                      <MetricChip
                        label="当前相位差"
                        value={`${formatNumber(superpositionRelativePhase, 2)} rad`}
                      />
                      <MetricChip
                        label="振幅上界"
                        value={`${formatNumber(superpositionDerived.amplitudeMaxCm, 2)} cm`}
                      />
                      <MetricChip
                        label="振幅下界"
                        value={`${formatNumber(superpositionDerived.amplitudeMinCm, 2)} cm`}
                      />
                      <MetricChip label="稳定性" value="异频叠加 = 图样持续变化" />
                    </>
                  )}
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MetricChip
                    label="波长 λ"
                    value={`${formatNumber(singleDerived.wavelengthCm, 2)} cm`}
                  />
                  <MetricChip
                    label="周期 T"
                    value={`${formatNumber(singleDerived.periodS, 2)} s`}
                  />
                  <MetricChip
                    label="角频率 ω"
                    value={`${formatNumber(singleDerived.omegaRad, 2)} rad/s`}
                  />
                  <MetricChip
                    label="波数 k"
                    value={`${formatNumber(singleDerived.waveNumber, 3)} rad/cm`}
                  />
                  {moduleVariant === 'comparison' ? (
                    <>
                      <MetricChip
                        label="横波当前位移"
                        value={`${formatNumber(singleTransverseDisplacement, 2)} cm`}
                      />
                      <MetricChip
                        label="纵波当前位移"
                        value={`${formatNumber(singleLongitudinalDisplacement, 2)} cm`}
                      />
                    </>
                  ) : (
                    <MetricChip
                      label={moduleVariant === 'longitudinal' ? '当前位移 x' : '当前位移 y'}
                      value={`${formatNumber(
                        moduleVariant === 'longitudinal'
                          ? singleLongitudinalDisplacement
                          : singleTransverseDisplacement,
                        2,
                      )} cm`}
                    />
                  )}
                  <MetricChip
                    label="当前相位"
                    value={`${formatNumber(singleSelectedPhase, 2)} rad`}
                  />
                  <MetricChip
                    label="平移距离 Δx"
                    value={`${formatNumber(waveShiftCm, 2)} cm`}
                  />
                  {moduleVariant !== 'comparison' ? (
                    <>
                      <MetricChip
                        label="运动轨迹"
                        value={singleTrajectoryText}
                      />
                      <MetricChip
                        label="平衡位置"
                        value={singleEquilibriumText}
                      />
                      <MetricChip
                        label={moduleVariant === 'longitudinal' ? '振动区间 x' : '振动区间 y'}
                        value={singleMotionRangeText}
                      />
                      <MetricChip
                        label="累计路程 s(0→t)"
                        value={`${formatNumber(singleTravelDistanceCm, 2)} cm`}
                      />
                    </>
                  ) : null}
                </div>
              )}
            </PanelCard>

            <PanelCard title={stageLabel} subtitle={stageSubtitle}>
              {isDopplerModule ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  <AcceptanceCard
                    title="波前实时绘制"
                    content="主视图会持续发出前后方向可辨的圆弧波前，并保持波源向右运动的轨迹语义。"
                  />
                  <AcceptanceCard
                    title="前密后疏"
                    content="波源前方圆弧间距更小、后方更大，对应前方频率升高、后方频率降低。"
                  />
                  <AcceptanceCard
                    title="公式对应"
                    content="已输出 f前、f后 与频率比；当 vs 接近或超过 v 时，会提示经典前方公式失效。"
                  />
                </div>
              ) : isStandingModule ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  <AcceptanceCard
                    title="驻波分层可见"
                    content="主视图同时显示入射波、反射波和合成驻波，能清楚看到“驻”的形成。"
                  />
                  <AcceptanceCard
                    title="波节波腹已标注"
                    content="黑点固定表示波节，黄色标记表示波腹，随谐波切换数量和位置会同步变化。"
                  />
                  <AcceptanceCard
                    title="谐波预设"
                    content="已提供基频、二次、三次谐波，频率按 fₙ = nv / 2L 自动重算。"
                  />
                </div>
              ) : isSuperpositionModule ? (
                <div className="grid gap-3 lg:grid-cols-3">
                  <AcceptanceCard
                    title="分量波可见"
                    content="波 1、波 2 与合成波同时显示，便于课堂逐层解释“先叠加、后观察”。"
                  />
                  <AcceptanceCard
                    title={superpositionMode === 'interference' ? '稳定干涉' : '不稳定拍'}
                    content={
                      superpositionMode === 'interference'
                        ? '保持同频并调节 Δφ 时，合成波形保持稳定，振幅在相长/相消之间切换。'
                        : '调节 f₁ 与 f₂ 后，合成波会随时间起伏，拍频等于 |f₁ - f₂|。'
                    }
                  />
                  <AcceptanceCard
                    title="选定质点联动"
                    content="点击主视图中的质点后，下方会切到该质点的叠加振动图，能直接观察当前合成结果。"
                  />
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-3">
                  <AcceptanceCard
                    title="图像对应"
                    content="点击质点后，下方振动图会切到该质点，且相位随位置变化。"
                  />
                  <AcceptanceCard
                    title="参数联动"
                    content="振幅、频率、波速、质点数和 Δt 会即时重算波长、周期和图像。"
                  />
                  <AcceptanceCard
                    title="概念对比"
                    content="横波/纵波可并排比较，波形平移也能直接看到 Δx = vΔt 的结果。"
                  />
                </div>
              )}
            </PanelCard>
          </main>
        </div>
      </div>
    </div>
  )
}
