import type { Scene, SceneBody } from '@/models/types'
import type { BodyState, ForceData } from '@/engine/types'

export const FM041_SCENE_ID = 'FM-041'
export const FM041_RUNTIME_SCENE_ID = 'template-scene-fm-041'
export const FM041_DISK_BODY_ID = 'body-disk-main'
export const FM041_SLIDER_BODY_ID = 'body-slider-main'

const FM041_DEFAULT_OMEGA = 2

export type Fm041SlipState = 'stable' | 'critical' | 'slipping'

export interface Fm041TeachingState {
  omega: number
  radius: number
  mass: number
  mu: number
  gravity: number
  tangentialSpeed: number
  requiredCentripetalForce: number
  maxStaticFriction: number
  criticalOmega: number
  appliedFrictionMagnitude: number
  frictionDirection: { x: number; y: number }
  state: Fm041SlipState
}

export interface Fm041VisualPose {
  position: { x: number; y: number }
  angle: number
}

export interface Fm041MotionSnapshot {
  diskTheta: number
  sliderTheta: number
  sliderPose: Fm041VisualPose
}

export function isFm041Scene(scene: Scene): boolean {
  const hasDisk = scene.bodies.some((body) => body.id === FM041_DISK_BODY_ID)
  const hasSlider = scene.bodies.some((body) => body.id === FM041_SLIDER_BODY_ID)
  return scene.id === FM041_RUNTIME_SCENE_ID || (hasDisk && hasSlider)
}

export function getFm041DiskBody(scene: Scene): SceneBody | undefined {
  return scene.bodies.find((body) => body.id === FM041_DISK_BODY_ID)
}

export function getFm041SliderBody(scene: Scene): SceneBody | undefined {
  return scene.bodies.find((body) => body.id === FM041_SLIDER_BODY_ID)
}

export function getFm041Omega(scene: Scene): number {
  const disk = getFm041DiskBody(scene)
  if (!disk) return FM041_DEFAULT_OMEGA
  const omega = Math.abs(disk.initialVelocity.x)
  return Number.isFinite(omega) ? omega : FM041_DEFAULT_OMEGA
}

export function getFm041BaseRadius(scene: Scene): number {
  const disk = getFm041DiskBody(scene)
  const slider = getFm041SliderBody(scene)
  if (!disk || !slider) return 0
  return Math.max(0.05, Math.abs(slider.position.x - disk.position.x))
}

export function getFm041MaxVisualRadius(scene: Scene): number {
  const disk = getFm041DiskBody(scene)
  const slider = getFm041SliderBody(scene)
  const baseRadius = getFm041BaseRadius(scene)
  if (!disk || !slider) return baseRadius

  const diskHalfWidth = Math.max(0.2, (disk.width ?? 7.2) / 2)
  const sliderHalfWidth = Math.max(0.1, (slider.width ?? 0.75) / 2)
  return Math.max(baseRadius, diskHalfWidth - sliderHalfWidth - 0.08)
}

export function computeFm041TeachingState(scene: Scene): Fm041TeachingState | null {
  const disk = getFm041DiskBody(scene)
  const slider = getFm041SliderBody(scene)
  if (!disk || !slider) return null

  const omega = getFm041Omega(scene)
  const radius = getFm041BaseRadius(scene)
  const mass = Math.max(0.01, slider.mass)
  const gravity = Math.max(0, Math.hypot(scene.settings.gravity.x, scene.settings.gravity.y))
  const mu = Math.sqrt(Math.max(0, disk.friction) * Math.max(0, slider.friction))
  const tangentialSpeed = omega * radius
  const requiredCentripetalForce = mass * omega * omega * radius
  const maxStaticFriction = mu * mass * gravity
  const criticalOmega = radius > 1e-6 && gravity > 0
    ? Math.sqrt((mu * gravity) / radius)
    : 0
  const appliedFrictionMagnitude = Math.min(requiredCentripetalForce, maxStaticFriction)
  const state = resolveFm041SlipState(requiredCentripetalForce, maxStaticFriction)
  const frictionDirection = slider.position.x >= disk.position.x
    ? { x: -1, y: 0 }
    : { x: 1, y: 0 }

  return {
    omega,
    radius,
    mass,
    mu,
    gravity,
    tangentialSpeed,
    requiredCentripetalForce,
    maxStaticFriction,
    criticalOmega,
    appliedFrictionMagnitude,
    frictionDirection,
    state,
  }
}

export function buildFm041TeachingForce(scene: Scene, bodyStates: BodyState[], baseForces: ForceData[]): ForceData | null {
  const state = computeFm041TeachingState(scene)
  if (!state || state.appliedFrictionMagnitude < 0.01) return null

  const sliderState = bodyStates.find((bodyState) => bodyState.id === FM041_SLIDER_BODY_ID)
  if (!sliderState || sliderState.type === 'static') return null

  const hasNormalForce = baseForces.some((force) => force.bodyId === FM041_SLIDER_BODY_ID && force.forceType === 'normal')
  if (!hasNormalForce) return null

  const visualPose = getFm041SliderVisualPose(scene)
  const visualX = visualPose?.position.x ?? getFm041SliderBody(scene)?.position.x ?? 0
  const diskX = getFm041DiskBody(scene)?.position.x ?? 0
  const forceDirection = visualX >= diskX ? { x: -1, y: 0 } : { x: 1, y: 0 }
  const forceType = state.state === 'slipping' ? 'kinetic_friction' : 'static_friction'

  return {
    bodyId: FM041_SLIDER_BODY_ID,
    forceType,
    vector: {
      x: forceDirection.x * state.appliedFrictionMagnitude,
      y: 0,
    },
    magnitude: state.appliedFrictionMagnitude,
    sourceId: `${FM041_SLIDER_BODY_ID}:teaching:${forceType}`,
  }
}

export function getFm041SliderVisualPose(
  scene: Scene,
  timeMs = performance.now(),
): Fm041VisualPose | null {
  const snapshot = getFm041MotionSnapshot(scene, timeMs)
  return snapshot?.sliderPose ?? null
}

export function getFm041MotionSnapshot(
  scene: Scene,
  timeMs = performance.now(),
): Fm041MotionSnapshot | null {
  const disk = getFm041DiskBody(scene)
  const slider = getFm041SliderBody(scene)
  const state = computeFm041TeachingState(scene)
  if (!disk || !slider || !state) return null

  const omega = getFm041Omega(scene)
  const radius = getFm041BaseRadius(scene)
  const diskTheta = (timeMs / 1000) * omega
  const sliderOmega = state.state === 'slipping'
    ? Math.min(omega, state.criticalOmega)
    : omega
  const sliderTheta = (timeMs / 1000) * sliderOmega
  const projectedX = disk.position.x + radius * Math.cos(sliderTheta)

  return {
    diskTheta,
    sliderTheta,
    sliderPose: {
      position: {
        x: projectedX,
        y: slider.position.y,
      },
      angle: slider.angle,
    },
  }
}

function resolveFm041SlipState(required: number, maxStatic: number): Fm041SlipState {
  const diff = required - maxStatic
  if (Math.abs(diff) <= 0.05) return 'critical'
  if (diff < 0) return 'stable'
  return 'slipping'
}
