import type { SceneBody, SceneJoint, Scene } from '@/models/types'
import type { BodyConfig, ShapeConfig } from './types'
import type { PhysicsBridge } from './PhysicsBridge'
import { getBodyDescriptor } from '@/models/bodyTypes'
import { getJointDescriptor } from '@/models/jointTypes'

/** 镜像 shape 的 x 坐标（用于 flipped 物体） */
function mirrorShapeX(shape: ShapeConfig): ShapeConfig {
  switch (shape.type) {
    case 'polygon':
      return {
        ...shape,
        vertices: shape.vertices.map(v => ({ x: -v.x, y: v.y })).reverse(), // reverse 保持 CCW 顺序
      }
    case 'chain':
      return {
        ...shape,
        vertices: shape.vertices.map(v => ({ x: -v.x, y: v.y })).reverse(),
      }
    default:
      return shape // circle, box, edge 对称，无需镜像
  }
}

function sceneBodyToBodyConfig(body: SceneBody): BodyConfig | null {
  const desc = getBodyDescriptor(body.type)
  const shape = desc.toShapeConfig(body)
  const density = desc.toDensity(body)
  const physType = desc.toPhysicsType?.(body)
    ?? (body.isStatic ? 'static' : 'dynamic')
  const userData = desc.toUserData?.(body)

  // flipped 物体：镜像 shape 的 x 坐标
  let finalShape: ShapeConfig | ShapeConfig[] = shape
  if (body.flipped) {
    finalShape = Array.isArray(shape)
      ? shape.map(s => mirrorShapeX(s))
      : mirrorShapeX(shape)
    // 将 flipped 传入 userData 供仿真渲染使用
    if (userData) (userData as Record<string, unknown>).flipped = true
  }

  return {
    id: body.id,
    type: physType,
    position: { x: body.position.x, y: body.position.y },
    angle: body.angle,
    shape: finalShape,
    density,
    friction: body.friction,
    restitution: body.restitution,
    fixedRotation: body.fixedRotation,
    userData: body.flipped && !userData ? { flipped: true } : userData,
  }
}

export function syncSceneToWorld(scene: Scene, bridge: PhysicsBridge): void {
  bridge.destroyWorld()
  bridge.createWorld(scene.settings.gravity)

  for (const body of scene.bodies) {
    const config = sceneBodyToBodyConfig(body)
    if (config) {
      bridge.addBody(config)
    }
  }

  // Sync joints
  for (const joint of scene.joints) {
    syncJointAdd(joint, scene, bridge)
  }

  // Apply initial velocities
  for (const body of scene.bodies) {
    if (
      !body.isStatic &&
      (body.initialVelocity.x !== 0 || body.initialVelocity.y !== 0)
    ) {
      bridge.setLinearVelocity(body.id, body.initialVelocity)
    }
  }
}

export function syncBodyAdd(body: SceneBody, bridge: PhysicsBridge): void {
  const config = sceneBodyToBodyConfig(body)
  if (config) {
    bridge.addBody(config)
  }
}

export function syncBodyRemove(id: string, bridge: PhysicsBridge): void {
  bridge.removeBody(id)
}

export function syncBodyUpdate(body: SceneBody, bridge: PhysicsBridge): void {
  bridge.removeBody(body.id)
  const config = sceneBodyToBodyConfig(body)
  if (config) {
    bridge.addBody(config)
  }
}

// --- Joint sync ---

export function syncJointAdd(joint: SceneJoint, scene: Scene, bridge: PhysicsBridge): void {
  const desc = getJointDescriptor(joint.type)
  if (!desc) return
  const bodyA = scene.bodies.find(b => b.id === joint.bodyIdA)
  const bodyB = scene.bodies.find(b => b.id === joint.bodyIdB)
  if (!bodyA || !bodyB) return
  const config = desc.toJointConfig(joint, bodyA, bodyB)
  bridge.addJoint(config)
}

export function syncJointRemove(id: string, bridge: PhysicsBridge): void {
  bridge.removeJoint(id)
}
