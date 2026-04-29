import {
  DEFAULT_DOPPLER_PARAMS,
  DEFAULT_SUPERPOSITION_PARAMS,
  DEFAULT_STANDING_PARAMS,
  DEFAULT_WAVE_PARAMS,
  P06_MODULES,
  normalizeP06ModuleId,
  type DopplerParams,
  type P06ModuleId,
  type StandingHarmonic,
  type StandingParams,
  type SuperpositionParams,
  type WaveDirection,
  type WaveParams,
} from './waveMath'

export const P06_BRIDGE_VERSION = '1.0.0'
export const P06_RUNTIME_KEY = 'visual-p06'
export const P06_SNAPSHOT_SCHEMA_VERSION = 1

export type P06PlaybackRate = 0.25 | 0.5 | 1 | 1.5 | 2

export interface P06DisplayOptionsSnapshot {
  showComponents: boolean
  showCombined: boolean
  showStandingMarkers: boolean
  showDirectionArrows: boolean
}

export interface P06SnapshotPayload {
  activeModuleId: P06ModuleId
  params: {
    single: WaveParams
    superposition: SuperpositionParams
    standing: StandingParams
    doppler: DopplerParams
  }
  ui: {
    displayOptions: P06DisplayOptionsSnapshot
    selectedIndex: number
    direction: WaveDirection
  }
  playback: {
    timeS: number
    isPlaying: boolean
    playbackRate: P06PlaybackRate
  }
}

export interface P06SnapshotEnvelope {
  templateKey: P06ModuleId
  runtimeKey: string
  bridgeVersion: string
  snapshotSchemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface P06SnapshotDocument {
  envelope: P06SnapshotEnvelope
  payload: P06SnapshotPayload
}

export interface P06SnapshotValidationResult {
  ok: boolean
  errors: string[]
}

const P06_MODULE_IDS = P06_MODULES.map((module) => module.id)
const P06_PLAYBACK_RATES: readonly P06PlaybackRate[] = [0.25, 0.5, 1, 1.5, 2]

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isP06ModuleId(value: unknown): value is P06ModuleId {
  return typeof value === 'string' && (P06_MODULE_IDS as readonly string[]).includes(value)
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isWaveDirection(value: unknown): value is WaveDirection {
  return value === 1 || value === -1
}

function isStandingHarmonic(value: unknown): value is StandingHarmonic {
  return value === 1 || value === 2 || value === 3
}

function isPlaybackRate(value: unknown): value is P06PlaybackRate {
  return typeof value === 'number' && P06_PLAYBACK_RATES.includes(value as P06PlaybackRate)
}

function cloneWaveParams(params: WaveParams): WaveParams {
  return { ...params }
}

function cloneSuperpositionParams(params: SuperpositionParams): SuperpositionParams {
  return { ...params }
}

function cloneStandingParams(params: StandingParams): StandingParams {
  return { ...params }
}

function cloneDopplerParams(params: DopplerParams): DopplerParams {
  return { ...params }
}

export function cloneP06DisplayOptions(
  displayOptions: P06DisplayOptionsSnapshot,
): P06DisplayOptionsSnapshot {
  return { ...displayOptions }
}

export function cloneP06SnapshotPayload(payload: P06SnapshotPayload): P06SnapshotPayload {
  return {
    activeModuleId: payload.activeModuleId,
    params: {
      single: cloneWaveParams(payload.params.single),
      superposition: cloneSuperpositionParams(payload.params.superposition),
      standing: cloneStandingParams(payload.params.standing),
      doppler: cloneDopplerParams(payload.params.doppler),
    },
    ui: {
      displayOptions: cloneP06DisplayOptions(payload.ui.displayOptions),
      selectedIndex: payload.ui.selectedIndex,
      direction: payload.ui.direction,
    },
    playback: {
      timeS: payload.playback.timeS,
      isPlaying: payload.playback.isPlaying,
      playbackRate: payload.playback.playbackRate,
    },
  }
}

export function createP06SnapshotDocument(
  payload: P06SnapshotPayload,
  createdAt = new Date().toISOString(),
): P06SnapshotDocument {
  const now = new Date().toISOString()
  const clonedPayload = cloneP06SnapshotPayload(payload)
  return {
    envelope: {
      templateKey: clonedPayload.activeModuleId,
      runtimeKey: P06_RUNTIME_KEY,
      bridgeVersion: P06_BRIDGE_VERSION,
      snapshotSchemaVersion: P06_SNAPSHOT_SCHEMA_VERSION,
      createdAt,
      updatedAt: now,
    },
    payload: clonedPayload,
  }
}

export function getDefaultP06Snapshot(moduleId?: string | null): P06SnapshotDocument {
  return createP06SnapshotDocument({
    activeModuleId: normalizeP06ModuleId(moduleId),
    params: {
      single: cloneWaveParams(DEFAULT_WAVE_PARAMS),
      superposition: cloneSuperpositionParams(DEFAULT_SUPERPOSITION_PARAMS),
      standing: cloneStandingParams(DEFAULT_STANDING_PARAMS),
      doppler: cloneDopplerParams(DEFAULT_DOPPLER_PARAMS),
    },
    ui: {
      displayOptions: {
        showComponents: true,
        showCombined: true,
        showStandingMarkers: true,
        showDirectionArrows: true,
      },
      selectedIndex: 10,
      direction: 1,
    },
    playback: {
      timeS: 0,
      isPlaying: true,
      playbackRate: 1,
    },
  })
}

function validateWaveParams(value: unknown, errors: string[], path: string): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  ;(['amplitudeCm', 'frequencyHz', 'speedCms', 'particleCount', 'deltaTimeS'] as const).forEach(
    (key) => {
      if (!isFiniteNumber(value[key])) errors.push(`${path}.${key} must be a finite number.`)
    },
  )
}

function validateSuperpositionParams(value: unknown, errors: string[], path: string): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  ;([
    'amplitude1Cm',
    'amplitude2Cm',
    'frequency1Hz',
    'frequency2Hz',
    'speedCms',
    'phaseOffsetRad',
    'particleCount',
  ] as const).forEach((key) => {
    if (!isFiniteNumber(value[key])) errors.push(`${path}.${key} must be a finite number.`)
  })
}

function validateStandingParams(value: unknown, errors: string[], path: string): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  ;(['amplitudeCm', 'speedCms', 'stringLengthCm', 'particleCount'] as const).forEach((key) => {
    if (!isFiniteNumber(value[key])) errors.push(`${path}.${key} must be a finite number.`)
  })
  if (!isStandingHarmonic(value.harmonic)) {
    errors.push(`${path}.harmonic must be 1, 2, or 3.`)
  }
}

function validateDopplerParams(value: unknown, errors: string[], path: string): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  ;(['sourceFrequencyHz', 'waveSpeedMs', 'sourceSpeedMs'] as const).forEach((key) => {
    if (!isFiniteNumber(value[key])) errors.push(`${path}.${key} must be a finite number.`)
  })
}

function validateDisplayOptions(value: unknown, errors: string[], path: string): void {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object.`)
    return
  }
  ;([
    'showComponents',
    'showCombined',
    'showStandingMarkers',
    'showDirectionArrows',
  ] as const).forEach((key) => {
    if (typeof value[key] !== 'boolean') errors.push(`${path}.${key} must be a boolean.`)
  })
}

export function parseP06Snapshot(snapshot: unknown, errors: string[]): P06SnapshotDocument | null {
  if (!isRecord(snapshot)) {
    errors.push('snapshot must be an object.')
    return null
  }

  const envelope = snapshot.envelope
  const payload = snapshot.payload
  if (!isRecord(envelope)) errors.push('snapshot.envelope is missing or invalid.')
  if (!isRecord(payload)) errors.push('snapshot.payload is missing or invalid.')
  if (!isRecord(envelope) || !isRecord(payload)) return null

  if (!isP06ModuleId(envelope.templateKey)) errors.push('envelope.templateKey is invalid.')
  if (envelope.runtimeKey !== P06_RUNTIME_KEY) {
    errors.push(`envelope.runtimeKey must be ${P06_RUNTIME_KEY}.`)
  }
  if (envelope.bridgeVersion !== P06_BRIDGE_VERSION) {
    errors.push(`envelope.bridgeVersion must be ${P06_BRIDGE_VERSION}.`)
  }
  if (envelope.snapshotSchemaVersion !== P06_SNAPSHOT_SCHEMA_VERSION) {
    errors.push(`envelope.snapshotSchemaVersion must be ${P06_SNAPSHOT_SCHEMA_VERSION}.`)
  }
  if (!isIsoDateString(envelope.createdAt)) errors.push('envelope.createdAt must be an ISO date.')
  if (!isIsoDateString(envelope.updatedAt)) errors.push('envelope.updatedAt must be an ISO date.')

  if (!isP06ModuleId(payload.activeModuleId)) errors.push('payload.activeModuleId is invalid.')
  if (
    isP06ModuleId(envelope.templateKey) &&
    isP06ModuleId(payload.activeModuleId) &&
    envelope.templateKey !== payload.activeModuleId
  ) {
    errors.push('payload.activeModuleId must match envelope.templateKey.')
  }

  if (!isRecord(payload.params)) {
    errors.push('payload.params is missing or invalid.')
  } else {
    validateWaveParams(payload.params.single, errors, 'payload.params.single')
    validateSuperpositionParams(payload.params.superposition, errors, 'payload.params.superposition')
    validateStandingParams(payload.params.standing, errors, 'payload.params.standing')
    validateDopplerParams(payload.params.doppler, errors, 'payload.params.doppler')
  }

  if (!isRecord(payload.ui)) {
    errors.push('payload.ui is missing or invalid.')
  } else {
    validateDisplayOptions(payload.ui.displayOptions, errors, 'payload.ui.displayOptions')
    if (!isFiniteNumber(payload.ui.selectedIndex)) {
      errors.push('payload.ui.selectedIndex must be a finite number.')
    }
    if (!isWaveDirection(payload.ui.direction)) {
      errors.push('payload.ui.direction must be 1 or -1.')
    }
  }

  if (!isRecord(payload.playback)) {
    errors.push('payload.playback is missing or invalid.')
  } else {
    if (!isFiniteNumber(payload.playback.timeS)) {
      errors.push('payload.playback.timeS must be a finite number.')
    }
    if (typeof payload.playback.isPlaying !== 'boolean') {
      errors.push('payload.playback.isPlaying must be a boolean.')
    }
    if (!isPlaybackRate(payload.playback.playbackRate)) {
      errors.push('payload.playback.playbackRate is invalid.')
    }
  }

  if (errors.length > 0) return null
  return snapshot as unknown as P06SnapshotDocument
}

export function validateP06Snapshot(snapshot: unknown): P06SnapshotValidationResult {
  const errors: string[] = []
  parseP06Snapshot(snapshot, errors)
  return {
    ok: errors.length === 0,
    errors,
  }
}

