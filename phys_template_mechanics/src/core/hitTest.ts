import type { SceneBody, SceneJoint } from '@/models/types'
import { getBodyDescriptor, getInteraction } from '@/models/bodyTypes'
import { getJointDescriptor } from '@/models/jointTypes'

/**
 * Hit test bodies at a world position.
 * Returns the ID of the topmost hit body, or null if nothing was hit.
 * Priority: hitTestPriority (desc) > dynamic over static > reverse draw order.
 */
export function hitTestBodies(
  worldPos: { x: number; y: number },
  bodies: SceneBody[],
): string | null {
  // Sort by: hitTestPriority ASC, then static before dynamic, so we can iterate from end
  const sorted = [...bodies].sort((a, b) => {
    const pa = getInteraction(a).hitTestPriority
    const pb = getInteraction(b).hitTestPriority
    if (pa !== pb) return pa - pb
    if (a.isStatic !== b.isStatic) return a.isStatic ? -1 : 1
    return 0
  })

  for (let i = sorted.length - 1; i >= 0; i--) {
    const body = sorted[i]
    if (!getInteraction(body).selectable) continue

    if (hitTestBody(worldPos, body)) {
      return body.id
    }
  }

  return null
}

function hitTestBody(
  worldPos: { x: number; y: number },
  body: SceneBody,
): boolean {
  // Transform point to body's local coordinate system (inverse rotation)
  const dx = worldPos.x - body.position.x
  const dy = worldPos.y - body.position.y
  const cos = Math.cos(-body.angle)
  const sin = Math.sin(-body.angle)
  const localX = dx * cos - dy * sin
  const localY = dx * sin + dy * cos

  const desc = getBodyDescriptor(body.type)
  return desc.hitTest(localX, localY, body)
}

/**
 * Hit test joints at a world position.
 * Returns the ID of the hit joint, or null.
 */
export function hitTestJoints(
  worldPos: { x: number; y: number },
  joints: SceneJoint[],
  bodies: SceneBody[],
  scale: number,
): string | null {
  const threshold = 5 / scale // 5px tolerance
  const bodyMap = new Map(bodies.map(b => [b.id, b]))

  for (let i = joints.length - 1; i >= 0; i--) {
    const joint = joints[i]
    const desc = getJointDescriptor(joint.type)
    if (!desc) continue
    const bodyA = bodyMap.get(joint.bodyIdA)
    const bodyB = bodyMap.get(joint.bodyIdB)
    if (!bodyA || !bodyB) continue
    if (desc.hitTest(worldPos, joint, bodyA, bodyB, threshold)) {
      return joint.id
    }
  }
  return null
}
