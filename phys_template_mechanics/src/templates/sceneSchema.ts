import type { Scene } from '@/models/types'

export function isScene(value: unknown): value is Scene {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.name !== 'string') return false
  if (!Array.isArray(value.bodies) || !Array.isArray(value.joints) || !Array.isArray(value.forces)) {
    return false
  }
  if (!isRecord(value.settings) || !isVec2(value.settings.gravity)) {
    return false
  }

  return value.bodies.every(isSceneBody) && value.joints.every(isSceneJoint) && value.forces.every(isSceneForce)
}

function isSceneBody(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.type !== 'string') return false
  if (typeof value.label !== 'string') return false
  if (!isVec2(value.position)) return false
  if (typeof value.angle !== 'number') return false
  if (typeof value.isStatic !== 'boolean') return false
  if (typeof value.fixedRotation !== 'boolean') return false
  if (typeof value.mass !== 'number') return false
  if (typeof value.friction !== 'number') return false
  if (typeof value.restitution !== 'number') return false
  if (!isVec2(value.initialVelocity)) return false
  if (!isVec2(value.initialAcceleration)) return false
  return true
}

function isSceneJoint(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.type !== 'string') return false
  if (typeof value.label !== 'string') return false
  if (typeof value.bodyIdA !== 'string') return false
  if (typeof value.bodyIdB !== 'string') return false
  if (!isVec2(value.anchorA)) return false
  if (!isVec2(value.anchorB)) return false
  return true
}

function isSceneForce(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (typeof value.id !== 'string') return false
  if (typeof value.type !== 'string') return false
  if (typeof value.targetBodyId !== 'string') return false
  if (typeof value.label !== 'string') return false
  if (typeof value.magnitude !== 'number') return false
  if (typeof value.direction !== 'number') return false
  if (typeof value.visible !== 'boolean') return false
  if (typeof value.decompose !== 'boolean') return false
  if (typeof value.decomposeAngle !== 'number') return false
  return true
}

function isVec2(value: unknown): value is { x: number; y: number } {
  return isRecord(value) && typeof value.x === 'number' && typeof value.y === 'number'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
