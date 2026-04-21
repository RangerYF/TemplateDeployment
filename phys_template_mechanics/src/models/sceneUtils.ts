import type { Scene } from '@/models/types'

export function cloneScene(scene: Scene): Scene {
  return {
    ...scene,
    settings: {
      ...scene.settings,
      gravity: { ...scene.settings.gravity },
    },
    bodies: scene.bodies.map((body) => ({
      ...body,
      position: { ...body.position },
      initialVelocity: { ...body.initialVelocity },
      initialAcceleration: { ...body.initialAcceleration },
    })),
    joints: scene.joints.map((joint) => ({
      ...joint,
      anchorA: { ...joint.anchorA },
      anchorB: { ...joint.anchorB },
    })),
    forces: scene.forces.map((force) => ({ ...force })),
  }
}
