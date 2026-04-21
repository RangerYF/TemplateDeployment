import type { Scene, SceneBody } from '@/models/types'

export const FM042_SCENE_ID = 'FM-042'
export const FM042_RUNTIME_SCENE_ID = 'template-scene-fm-042'
export const FM042_ANCHOR_BODY_ID = 'body-anchor-top'
export const FM042_BOB_BODY_ID = 'body-bob-ball'

const FM042_DEFAULT_ANGULAR_SPEED = 1.2

export interface Fm042TeachingGeometry {
  anchor: SceneBody
  bob: SceneBody
  radius: number
  height: number
  ropeLength: number
  angleFromVerticalDeg: number
}

export interface Fm042VisualPose {
  position: { x: number; y: number }
  angle: number
}

export function isFm042Scene(scene: Scene): boolean {
  return scene.id === FM042_RUNTIME_SCENE_ID
}

export function getFm042Anchor(scene: Scene): SceneBody | undefined {
  return scene.bodies.find((body) => body.id === FM042_ANCHOR_BODY_ID)
}

export function getFm042Bob(scene: Scene): SceneBody | undefined {
  return scene.bodies.find((body) => body.id === FM042_BOB_BODY_ID)
}

export function computeFm042Geometry(scene: Scene): Fm042TeachingGeometry | null {
  const anchor = getFm042Anchor(scene)
  const bob = getFm042Bob(scene)
  if (!anchor || !bob) return null

  const dx = bob.position.x - anchor.position.x
  const dy = anchor.position.y - bob.position.y
  const radius = Math.max(0.1, Math.abs(dx))
  const height = Math.max(0.1, dy)
  const ropeLength = Math.hypot(dx, dy)
  const angleFromVerticalDeg = Math.atan2(radius, height) * 180 / Math.PI

  return {
    anchor,
    bob,
    radius,
    height,
    ropeLength,
    angleFromVerticalDeg,
  }
}

export function getFm042TopViewTheta(timeMs = performance.now()): number {
  return (timeMs / 1000) * FM042_DEFAULT_ANGULAR_SPEED
}

export function getFm042BobVisualPose(
  scene: Scene,
  timeMs = performance.now(),
): Fm042VisualPose | null {
  const geometry = computeFm042Geometry(scene)
  if (!geometry) return null

  const theta = getFm042TopViewTheta(timeMs)
  return {
    position: {
      x: geometry.anchor.position.x + geometry.radius * Math.cos(theta),
      y: geometry.bob.position.y,
    },
    angle: geometry.bob.angle,
  }
}
