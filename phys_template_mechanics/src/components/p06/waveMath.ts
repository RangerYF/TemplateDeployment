export type P06ModuleId =
  | 'wav-001'
  | 'wav-002'
  | 'wav-011'
  | 'wav-012'
  | 'wav-021'
  | 'wav-031'
  | 'wav-041'
  | 'wav-051'
export type P06ModuleVariant =
  | 'transverse'
  | 'longitudinal'
  | 'interference'
  | 'beat'
  | 'standing'
  | 'doppler'
  | 'translation'
  | 'comparison'
export type WaveDirection = 1 | -1
export type SuperpositionMode = 'interference' | 'beat'
export type StandingHarmonic = 1 | 2 | 3

export interface P06ModuleDefinition {
  id: P06ModuleId
  title: string
  subtitle: string
  variant: P06ModuleVariant
  coveredModelIds: string[]
}

export interface WaveParams {
  amplitudeCm: number
  frequencyHz: number
  speedCms: number
  particleCount: number
  deltaTimeS: number
}

export interface SuperpositionParams {
  amplitude1Cm: number
  amplitude2Cm: number
  frequency1Hz: number
  frequency2Hz: number
  speedCms: number
  phaseOffsetRad: number
  particleCount: number
}

export interface StandingParams {
  amplitudeCm: number
  speedCms: number
  stringLengthCm: number
  harmonic: StandingHarmonic
  particleCount: number
}

export interface DopplerParams {
  sourceFrequencyHz: number
  waveSpeedMs: number
  sourceSpeedMs: number
}

export interface WaveDerivedValues {
  wavelengthCm: number
  periodS: number
  omegaRad: number
  waveNumber: number
}

export interface SuperpositionDerivedValues {
  wave1: WaveDerivedValues
  wave2: WaveDerivedValues
  beatFrequencyHz: number
  amplitudeMinCm: number
  amplitudeMaxCm: number
  resultantAmplitudeCm: number
}

export interface StandingDerivedValues extends WaveDerivedValues {
  stringLengthCm: number
  harmonic: StandingHarmonic
  harmonicLabel: string
  nodePositionsCm: number[]
  antinodePositionsCm: number[]
}

export interface DopplerDerivedValues {
  sourceSpeedRatio: number
  frontFrequencyHz: number | null
  backFrequencyHz: number
  frontRatio: number | null
  backRatio: number
  displayFrequencyHz: number
  displayPeriodS: number
  isNearCritical: boolean
}

export interface SuperpositionSample {
  wave1Cm: number
  wave2Cm: number
  combinedCm: number
}

export interface StandingSample {
  incidentCm: number
  reflectedCm: number
  standingCm: number
  envelopeCm: number
}

export interface DopplerWavefront {
  ageS: number
  radiusM: number
  centerOffsetM: number
  opacity: number
}

export const P06_MODULES: readonly P06ModuleDefinition[] = [
  {
    id: 'wav-001',
    title: '横波传播',
    subtitle: '展示波形快照与单质点振动图的对应关系。',
    variant: 'transverse',
    coveredModelIds: ['WAV-001'],
  },
  {
    id: 'wav-002',
    title: '纵波传播',
    subtitle: '用质点疏密变化展示纵波传播和单质点振动。',
    variant: 'longitudinal',
    coveredModelIds: ['WAV-002'],
  },
  {
    id: 'wav-011',
    title: '同频波叠加',
    subtitle: '显示两列同频波的分量波与合成波，突出稳定干涉条件。',
    variant: 'interference',
    coveredModelIds: ['WAV-011'],
  },
  {
    id: 'wav-012',
    title: '异频波叠加',
    subtitle: '显示两列异频波的分量波与合成波，突出拍现象与不稳定叠加。',
    variant: 'beat',
    coveredModelIds: ['WAV-012'],
  },
  {
    id: 'wav-021',
    title: '驻波形成',
    subtitle: '显示入射波、反射波和合成驻波，并标出波节与波腹。',
    variant: 'standing',
    coveredModelIds: ['WAV-021'],
  },
  {
    id: 'wav-031',
    title: '多普勒效应',
    subtitle: '显示移动波源的圆形波前，突出前密后疏与频率变化。',
    variant: 'doppler',
    coveredModelIds: ['WAV-031'],
  },
  {
    id: 'wav-041',
    title: '波形平移',
    subtitle: '比较同一波形在 t 与 t + Δt 两个时刻的平移结果。',
    variant: 'translation',
    coveredModelIds: ['WAV-041'],
  },
  {
    id: 'wav-051',
    title: '横纵波对比',
    subtitle: '并排展示振动方向与传播方向的差异，覆盖 WAV-051 / WAV-052。',
    variant: 'comparison',
    coveredModelIds: ['WAV-051', 'WAV-052'],
  },
] as const

export const DEFAULT_WAVE_PARAMS: WaveParams = {
  amplitudeCm: 5,
  frequencyHz: 2,
  speedCms: 20,
  particleCount: 30,
  deltaTimeS: 0.25,
}

export const DEFAULT_SUPERPOSITION_PARAMS: SuperpositionParams = {
  amplitude1Cm: 5,
  amplitude2Cm: 5,
  frequency1Hz: 2,
  frequency2Hz: 2.5,
  speedCms: 20,
  phaseOffsetRad: 0,
  particleCount: 30,
}

export const DEFAULT_STANDING_PARAMS: StandingParams = {
  amplitudeCm: 5,
  speedCms: 20,
  stringLengthCm: 100,
  harmonic: 1,
  particleCount: 31,
}

export const DEFAULT_DOPPLER_PARAMS: DopplerParams = {
  sourceFrequencyHz: 440,
  waveSpeedMs: 340,
  sourceSpeedMs: 50,
}

export const DOPPLER_SPEED_PRESETS = [
  { label: '低速', ratio: 0.1 },
  { label: '中速', ratio: 0.3 },
  { label: '高速', ratio: 0.5 },
  { label: '近声速', ratio: 0.9 },
] as const

export const P06_DOMAIN_LENGTH_CM = 120

const MODULE_ALIAS_MAP = new Map<string, P06ModuleId>([['wav-052', 'wav-051']])

const HARMONIC_LABEL_MAP: Record<StandingHarmonic, string> = {
  1: '基频 n=1',
  2: '二次谐波 n=2',
  3: '三次谐波 n=3',
}

function createWaveParams(
  amplitudeCm: number,
  frequencyHz: number,
  speedCms: number,
  particleCount: number,
): WaveParams {
  return {
    amplitudeCm,
    frequencyHz,
    speedCms,
    particleCount,
    deltaTimeS: 0,
  }
}

export function normalizeP06ModuleId(raw: string | null | undefined): P06ModuleId {
  if (!raw) return 'wav-001'
  const lower = raw.toLowerCase()
  const alias = MODULE_ALIAS_MAP.get(lower)
  if (alias) return alias
  const matched = P06_MODULES.find((module) => module.id === lower)
  return matched?.id ?? 'wav-001'
}

export function getWaveDerivedValues(params: WaveParams): WaveDerivedValues {
  const safeFrequency = Math.max(params.frequencyHz, 0.0001)
  const safeSpeed = Math.max(params.speedCms, 0.0001)
  const wavelengthCm = safeSpeed / safeFrequency
  const periodS = 1 / safeFrequency
  const omegaRad = 2 * Math.PI * safeFrequency
  const waveNumber = (2 * Math.PI) / wavelengthCm
  return {
    wavelengthCm,
    periodS,
    omegaRad,
    waveNumber,
  }
}

export function getParticleXs(
  particleCount: number,
  domainLengthCm = P06_DOMAIN_LENGTH_CM,
): number[] {
  const safeCount = Math.max(2, Math.round(particleCount))
  return Array.from({ length: safeCount }, (_, index) => {
    if (safeCount === 1) return 0
    return (domainLengthCm * index) / (safeCount - 1)
  })
}

export function clampParticleIndex(index: number, particleCount: number): number {
  return Math.max(0, Math.min(Math.max(0, particleCount - 1), Math.round(index)))
}

export function getWavePhase(
  xCm: number,
  timeS: number,
  derived: WaveDerivedValues,
  direction: WaveDirection,
): number {
  return derived.omegaRad * timeS - direction * derived.waveNumber * xCm
}

export function getTransverseDisplacementCm(
  xCm: number,
  timeS: number,
  params: WaveParams,
  derived: WaveDerivedValues,
  direction: WaveDirection,
): number {
  return params.amplitudeCm * Math.sin(getWavePhase(xCm, timeS, derived, direction))
}

export function getLongitudinalDisplacementCm(
  xCm: number,
  timeS: number,
  params: WaveParams,
  derived: WaveDerivedValues,
  direction: WaveDirection,
): number {
  return params.amplitudeCm * Math.sin(getWavePhase(xCm, timeS, derived, direction))
}

function getTurningPhasesBetween(startPhase: number, endPhase: number): number[] {
  const points: number[] = []
  const safeStart = Math.min(startPhase, endPhase)
  const safeEnd = Math.max(startPhase, endPhase)
  const firstIndex = Math.ceil((safeStart - Math.PI / 2) / Math.PI)
  const lastIndex = Math.floor((safeEnd - Math.PI / 2) / Math.PI)

  for (let index = firstIndex; index <= lastIndex; index += 1) {
    points.push(Math.PI / 2 + index * Math.PI)
  }

  return points
}

export function getOscillationTravelDistanceCm(
  xCm: number,
  timeS: number,
  params: WaveParams,
  direction: WaveDirection,
): number {
  const derived = getWaveDerivedValues(params)
  const startPhase = getWavePhase(xCm, 0, derived, direction)
  const endPhase = getWavePhase(xCm, timeS, derived, direction)
  const travelPhases =
    endPhase >= startPhase
      ? [startPhase, ...getTurningPhasesBetween(startPhase, endPhase), endPhase]
      : [endPhase, ...getTurningPhasesBetween(endPhase, startPhase), startPhase]

  let totalVariation = 0
  for (let index = 1; index < travelPhases.length; index += 1) {
    totalVariation += Math.abs(
      Math.sin(travelPhases[index]) - Math.sin(travelPhases[index - 1]),
    )
  }

  return params.amplitudeCm * totalVariation
}

export function getEffectiveSuperpositionParams(
  mode: SuperpositionMode,
  params: SuperpositionParams,
): SuperpositionParams {
  if (mode === 'interference') {
    return {
      ...params,
      frequency2Hz: params.frequency1Hz,
    }
  }
  return params
}

function getSuperpositionDirections(
  mode: SuperpositionMode,
  direction: WaveDirection,
): { wave1: WaveDirection; wave2: WaveDirection } {
  if (mode === 'interference') {
    return {
      wave1: direction,
      wave2: direction === 1 ? -1 : 1,
    }
  }

  return {
    wave1: direction,
    wave2: direction,
  }
}

export function getInterferenceResultantAmplitudeCm(
  amplitude1Cm: number,
  amplitude2Cm: number,
  phaseOffsetRad: number,
): number {
  return Math.sqrt(
    amplitude1Cm ** 2 +
      amplitude2Cm ** 2 +
      2 * amplitude1Cm * amplitude2Cm * Math.cos(phaseOffsetRad),
  )
}

export function getSuperpositionDerivedValues(
  mode: SuperpositionMode,
  params: SuperpositionParams,
): SuperpositionDerivedValues {
  const effectiveParams = getEffectiveSuperpositionParams(mode, params)
  const wave1 = getWaveDerivedValues(
    createWaveParams(
      effectiveParams.amplitude1Cm,
      effectiveParams.frequency1Hz,
      effectiveParams.speedCms,
      effectiveParams.particleCount,
    ),
  )
  const wave2 = getWaveDerivedValues(
    createWaveParams(
      effectiveParams.amplitude2Cm,
      effectiveParams.frequency2Hz,
      effectiveParams.speedCms,
      effectiveParams.particleCount,
    ),
  )

  return {
    wave1,
    wave2,
    beatFrequencyHz: Math.abs(effectiveParams.frequency1Hz - effectiveParams.frequency2Hz),
    amplitudeMinCm: Math.abs(effectiveParams.amplitude1Cm - effectiveParams.amplitude2Cm),
    amplitudeMaxCm: effectiveParams.amplitude1Cm + effectiveParams.amplitude2Cm,
    resultantAmplitudeCm: getInterferenceResultantAmplitudeCm(
      effectiveParams.amplitude1Cm,
      effectiveParams.amplitude2Cm,
      effectiveParams.phaseOffsetRad,
    ),
  }
}

export function getSuperpositionRelativePhase(
  mode: SuperpositionMode,
  xCm: number,
  timeS: number,
  params: SuperpositionParams,
  direction: WaveDirection,
): number {
  const effectiveParams = getEffectiveSuperpositionParams(mode, params)
  const derived = getSuperpositionDerivedValues(mode, effectiveParams)
  const directions = getSuperpositionDirections(mode, direction)
  const phase1 = getWavePhase(xCm, timeS, derived.wave1, directions.wave1)
  const phase2 =
    getWavePhase(xCm, timeS, derived.wave2, directions.wave2) + effectiveParams.phaseOffsetRad
  return phase2 - phase1
}

export function getSuperpositionSample(
  mode: SuperpositionMode,
  xCm: number,
  timeS: number,
  params: SuperpositionParams,
  direction: WaveDirection,
): SuperpositionSample {
  const effectiveParams = getEffectiveSuperpositionParams(mode, params)
  const derived = getSuperpositionDerivedValues(mode, effectiveParams)
  const directions = getSuperpositionDirections(mode, direction)
  const wave1Cm =
    effectiveParams.amplitude1Cm *
    Math.sin(getWavePhase(xCm, timeS, derived.wave1, directions.wave1))
  const wave2Cm =
    effectiveParams.amplitude2Cm *
    Math.sin(
      getWavePhase(xCm, timeS, derived.wave2, directions.wave2) + effectiveParams.phaseOffsetRad,
    )

  return {
    wave1Cm,
    wave2Cm,
    combinedCm: wave1Cm + wave2Cm,
  }
}

export function getStandingDerivedValues(params: StandingParams): StandingDerivedValues {
  const safeLengthCm = Math.max(params.stringLengthCm, 0.0001)
  const safeSpeedCms = Math.max(params.speedCms, 0.0001)
  const wavelengthCm = (2 * safeLengthCm) / params.harmonic
  const frequencyHz = safeSpeedCms / wavelengthCm
  const periodS = 1 / frequencyHz
  const omegaRad = 2 * Math.PI * frequencyHz
  const waveNumber = (2 * Math.PI) / wavelengthCm
  const nodePositionsCm = Array.from({ length: params.harmonic + 1 }, (_, index) =>
    (safeLengthCm * index) / params.harmonic,
  )
  const antinodePositionsCm = Array.from({ length: params.harmonic }, (_, index) =>
    (safeLengthCm * (2 * index + 1)) / (2 * params.harmonic),
  )

  return {
    stringLengthCm: safeLengthCm,
    harmonic: params.harmonic,
    harmonicLabel: HARMONIC_LABEL_MAP[params.harmonic],
    wavelengthCm,
    periodS,
    omegaRad,
    waveNumber,
    nodePositionsCm,
    antinodePositionsCm,
  }
}

export function getStandingSample(
  xCm: number,
  timeS: number,
  params: StandingParams,
): StandingSample {
  const derived = getStandingDerivedValues(params)
  const incidentCm =
    params.amplitudeCm *
    Math.sin(derived.omegaRad * timeS - derived.waveNumber * xCm)
  const reflectedCm =
    -params.amplitudeCm *
    Math.sin(derived.omegaRad * timeS + derived.waveNumber * xCm)
  const standingCm = incidentCm + reflectedCm
  const envelopeCm = 2 * params.amplitudeCm * Math.abs(Math.sin(derived.waveNumber * xCm))

  return {
    incidentCm,
    reflectedCm,
    standingCm,
    envelopeCm,
  }
}

export function getDopplerDerivedValues(params: DopplerParams): DopplerDerivedValues {
  const safeWaveSpeed = Math.max(params.waveSpeedMs, 0.0001)
  const safeSourceFrequency = Math.max(params.sourceFrequencyHz, 0.0001)
  const sourceSpeedRatio = params.sourceSpeedMs / safeWaveSpeed
  const frontDenominator = safeWaveSpeed - params.sourceSpeedMs
  const backDenominator = safeWaveSpeed + params.sourceSpeedMs
  const frontFrequencyHz =
    frontDenominator > 0
      ? (safeSourceFrequency * safeWaveSpeed) / frontDenominator
      : null
  const backFrequencyHz = (safeSourceFrequency * safeWaveSpeed) / backDenominator
  const displayFrequencyHz = safeSourceFrequency
  const displayPeriodS = 1 / safeSourceFrequency

  return {
    sourceSpeedRatio,
    frontFrequencyHz,
    backFrequencyHz,
    frontRatio: frontFrequencyHz === null ? null : frontFrequencyHz / safeSourceFrequency,
    backRatio: backFrequencyHz / safeSourceFrequency,
    displayFrequencyHz,
    displayPeriodS,
    isNearCritical: sourceSpeedRatio >= 0.95,
  }
}

export function getDopplerWavefronts(
  params: DopplerParams,
  timeS: number,
  maxCount = 16,
): DopplerWavefront[] {
  const derived = getDopplerDerivedValues(params)
  const safeTime = Math.max(timeS, 0)
  const availableCount = Math.max(
    1,
    Math.min(maxCount, Math.floor(safeTime / derived.displayPeriodS) + 1),
  )
  const phase = safeTime % derived.displayPeriodS

  return Array.from({ length: availableCount }, (_, index) => {
    const ageS = phase + index * derived.displayPeriodS
    return {
      ageS,
      radiusM: params.waveSpeedMs * ageS,
      centerOffsetM: params.sourceSpeedMs * ageS,
      opacity: 1 - index / (availableCount + 2),
    }
  })
}

export function normalizePhaseRadians(phase: number): number {
  const cycle = Math.PI * 2
  let normalized = phase % cycle
  if (normalized > Math.PI) normalized -= cycle
  if (normalized < -Math.PI) normalized += cycle
  return normalized
}
