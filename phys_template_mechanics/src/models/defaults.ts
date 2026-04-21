import type { BodyType, SceneBody } from './types'
import { getBodyDescriptor } from './bodyTypes'

let idCounter = 0

export function generateId(): string {
  idCounter++
  return `body-${Date.now()}-${idCounter}`
}

export function generateLabel(
  type: BodyType,
  existingBodies: SceneBody[],
): string {
  const desc = getBodyDescriptor(type)
  const prefix = desc.label
  const sameType = existingBodies.filter((b) => b.type === type)
  return `${prefix} #${sameType.length + 1}`
}

export function createGround(): SceneBody {
  return {
    id: 'ground',
    type: 'ground',
    label: '地面',
    position: { x: 0, y: 0 },
    angle: 0,
    isStatic: true,
    fixedRotation: true,
    mass: 0,
    friction: 0.6,
    restitution: 0,
    initialVelocity: { x: 0, y: 0 },
    initialAcceleration: { x: 0, y: 0 },
  }
}
