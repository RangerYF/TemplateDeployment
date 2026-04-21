import { World, Vec2, Contact, ContactImpulse } from 'planck-js'
import type { BodyState, ForceData } from './types'
import type { Scene } from '@/models/types'
import type { PhysicsBridge } from './PhysicsBridge'

const EMA_ALPHA = 0.3
const MIN_FORCE_THRESHOLD = 0.01 // N
const COLLISION_IMPULSE_THRESHOLD = 0.5 // N·s — 冲量超过此值标记为碰撞

export interface CollisionInfo {
  bodyIdA: string
  bodyIdB: string
  impulse: number
}

type PostSolveListener = (contact: Contact, impulse: ContactImpulse) => void

export class ForceCollector {
  // 本帧 post-solve 累积的接触冲量（bodyId → contactKey → {normalImpulse, tangentImpulse, normal}）
  private contactImpulses = new Map<string, Map<string, {
    normalImpulse: number
    tangentImpulse: number
    normal: { x: number; y: number }
  }>>()

  // 本帧碰撞事件（冲量超阈值）
  private _frameCollisions: CollisionInfo[] = []

  // 上一帧活跃的接触对（用于检测新接触 = 碰撞起始）
  private _prevActiveContacts = new Set<string>()

  // EMA 滤波后的力（bodyId → contactKey → ForceData）
  private emaNormal = new Map<string, Map<string, ForceData>>()
  private emaFriction = new Map<string, Map<string, ForceData>>()

  private world: World | null = null
  private postSolveListener: PostSolveListener | null = null

  attach(world: World): void {
    this.world = world
    this.postSolveListener = (contact: Contact, impulse: ContactImpulse) => {
      this.onPostSolve(contact, impulse)
    }
    world.on('post-solve', this.postSolveListener)
  }

  detach(): void {
    if (this.world && this.postSolveListener) {
      this.world.off('post-solve', this.postSolveListener)
    }
    this.world = null
    this.postSolveListener = null
    this.contactImpulses.clear()
    this.emaNormal.clear()
    this.emaFriction.clear()
  }

  /** 每帧开始前清空本帧接触冲量缓冲 */
  beginFrame(): void {
    this.contactImpulses.clear()
    this._frameCollisions = []
  }

  /** 获取本帧检测到的碰撞事件 */
  getFrameCollisions(): CollisionInfo[] {
    return this._frameCollisions
  }

  /** 清理 EMA 缓存（probe 后调用，避免污染仿真） */
  resetEma(): void {
    this.emaNormal.clear()
    this.emaFriction.clear()
    this.contactImpulses.clear()
  }

  /** 施加用户外力到物理引擎（必须在 step 前调用） */
  applyExternalForces(scene: Scene, bridge: PhysicsBridge): void {
    // 用户外力
    for (const force of scene.forces) {
      if (!force.visible) continue
      const body = bridge.getBody(force.targetBodyId)
      if (!body) continue
      if (body.isStatic()) continue

      const fx = force.magnitude * Math.cos(force.direction)
      const fy = force.magnitude * Math.sin(force.direction)
      body.applyForceToCenter(new Vec2(fx, fy))
    }

    // 初始加速度（转换为等效外力 F = m * a）
    for (const sceneBody of scene.bodies) {
      const ax = sceneBody.initialAcceleration?.x ?? 0
      const ay = sceneBody.initialAcceleration?.y ?? 0
      if (Math.hypot(ax, ay) < 1e-8) continue

      const body = bridge.getBody(sceneBody.id)
      if (!body || body.isStatic()) continue
      const mass = body.getMass()
      if (mass <= 0) continue

      body.applyForceToCenter(new Vec2(mass * ax, mass * ay))
    }
  }

  /** 收集所有力（在 step 之后调用） */
  collect(scene: Scene, bridge: PhysicsBridge, dt: number, bodyStates?: BodyState[]): ForceData[] {
    const forces: ForceData[] = []
    const inv_dt = 1 / dt

    // 1. 重力
    this.collectGravity(scene, bridge, forces, bodyStates)

    // 2. 接触力（法向=支持力，切向=摩擦力），带 EMA 滤波
    this.collectContactForces(dt, forces)

    // 3. 约束力（张力/弹簧力）
    this.collectJointForces(bridge, inv_dt, forces)

    // 4. 用户外力
    this.collectExternalForces(scene, forces)

    return forces
  }

  // --- post-solve 回调 ---

  private onPostSolve(contact: Contact, impulse: ContactImpulse): void {
    const fixtureA = contact.getFixtureA()
    const fixtureB = contact.getFixtureB()
    const bodyA = fixtureA.getBody()
    const bodyB = fixtureB.getBody()

    // 获取世界空间法线和接触点
    const worldManifold = contact.getWorldManifold(null)
    if (!worldManifold) return

    const normal = worldManifold.normal as { x: number; y: number }
    const normalImpulses = impulse.normalImpulses
    const tangentImpulses = impulse.tangentImpulses

    // 累加所有接触点的冲量
    let totalNormal = 0
    let totalTangent = 0
    for (let i = 0; i < normalImpulses.length; i++) {
      totalNormal += normalImpulses[i]
      totalTangent += tangentImpulses[i]
    }

    // 获取 bodyId（通过 PhysicsBridge 查找）
    const bodyIdA = this.findBodyId(bodyA)
    const bodyIdB = this.findBodyId(bodyB)
    if (!bodyIdA || !bodyIdB) return

    // 对 bodyA：法线方向为 -normal（法线从 A 指向 B）
    // 对 bodyB：法线方向为 +normal
    const contactKey = bodyIdA < bodyIdB ? `${bodyIdA}:${bodyIdB}` : `${bodyIdB}:${bodyIdA}`

    // bodyB 受到来自 A 的支持力（沿 +normal 方向）
    this.accumulateImpulse(bodyIdB, contactKey, totalNormal, totalTangent, normal)
    // bodyA 受到来自 B 的支持力（沿 -normal 方向）
    this.accumulateImpulse(bodyIdA, contactKey, totalNormal, totalTangent, {
      x: -normal.x,
      y: -normal.y,
    })
  }

  private accumulateImpulse(
    bodyId: string,
    contactKey: string,
    normalImpulse: number,
    tangentImpulse: number,
    normal: { x: number; y: number },
  ): void {
    let bodyMap = this.contactImpulses.get(bodyId)
    if (!bodyMap) {
      bodyMap = new Map()
      this.contactImpulses.set(bodyId, bodyMap)
    }
    const existing = bodyMap.get(contactKey)
    if (existing) {
      existing.normalImpulse += normalImpulse
      existing.tangentImpulse += tangentImpulse
    } else {
      bodyMap.set(contactKey, { normalImpulse, tangentImpulse, normal })
    }
  }

  // --- 力收集方法 ---

  private collectGravity(
    scene: Scene,
    bridge: PhysicsBridge,
    out: ForceData[],
    bodyStates?: BodyState[],
  ): void {
    const gx = scene.settings.gravity.x
    const gy = scene.settings.gravity.y

    const states = bodyStates ?? bridge.getBodyStates()
    for (const bodyState of states) {
      if (bodyState.type === 'static') continue
      const body = bridge.getBody(bodyState.id)
      if (!body) continue
      const mass = body.getMass()
      if (mass <= 0) continue

      const fx = mass * gx
      const fy = mass * gy
      const mag = Math.sqrt(fx * fx + fy * fy)
      if (mag < MIN_FORCE_THRESHOLD) continue

      out.push({
        bodyId: bodyState.id,
        forceType: 'gravity',
        vector: { x: fx, y: fy },
        magnitude: mag,
      })
    }
  }

  private collectContactForces(dt: number, out: ForceData[]): void {
    // 当前帧活跃的 contactKey 集合（用于清理断开的 EMA）
    const activeKeys = new Set<string>()

    for (const [bodyId, contactMap] of this.contactImpulses) {
      for (const [contactKey, data] of contactMap) {
        const fullKey = `${bodyId}:${contactKey}`
        activeKeys.add(fullKey)

        const { normal } = data
        // 冲量 / dt = 力
        const normalForce = data.normalImpulse / dt
        const tangentForce = data.tangentImpulse / dt

        // 法向力（支持力）：沿法线方向
        const nfx = normalForce * normal.x
        const nfy = normalForce * normal.y

        // 切向力（摩擦力）：垂直于法线，Planck.js 切线 = cross(normal,1) = (ny,-nx)
        const tfx = tangentForce * normal.y
        const tfy = tangentForce * (-normal.x)

        // EMA 滤波 - 法向
        const normalData = this.emaFilter(
          this.emaNormal, bodyId, contactKey, nfx, nfy, 'normal', normal,
        )
        if (normalData) out.push(normalData)

        // EMA 滤波 - 切向
        const frictionData = this.emaFilter(
          this.emaFriction, bodyId, contactKey, tfx, tfy, 'friction', normal,
        )
        if (frictionData) out.push(frictionData)
      }
    }

    // 碰撞检测：新出现的接触且冲量超阈值 = 碰撞
    const currentContacts = new Set<string>()
    for (const [, contactMap] of this.contactImpulses) {
      for (const [contactKey, data] of contactMap) {
        // contactKey 是 "idA:idB"（已排序），只处理一次
        const pairKey = contactKey
        if (!currentContacts.has(pairKey)) {
          currentContacts.add(pairKey)
          // 新接触：上一帧不存在此接触对
          if (!this._prevActiveContacts.has(pairKey) && data.normalImpulse > COLLISION_IMPULSE_THRESHOLD) {
            const [idA, idB] = pairKey.split(':')
            this._frameCollisions.push({
              bodyIdA: idA,
              bodyIdB: idB,
              impulse: data.normalImpulse,
            })
          }
        }
      }
    }
    this._prevActiveContacts = currentContacts

    // 清理断开的接触（力立即归零）
    this.cleanDisconnected(this.emaNormal, activeKeys)
    this.cleanDisconnected(this.emaFriction, activeKeys)
  }

  private emaFilter(
    emaMap: Map<string, Map<string, ForceData>>,
    bodyId: string,
    contactKey: string,
    fx: number,
    fy: number,
    forceType: 'normal' | 'friction',
    contactNormal: { x: number; y: number },
  ): ForceData | null {
    let bodyMap = emaMap.get(bodyId)
    if (!bodyMap) {
      bodyMap = new Map()
      emaMap.set(bodyId, bodyMap)
    }

    const prev = bodyMap.get(contactKey)
    let smoothX: number, smoothY: number

    if (prev) {
      smoothX = EMA_ALPHA * fx + (1 - EMA_ALPHA) * prev.vector.x
      smoothY = EMA_ALPHA * fy + (1 - EMA_ALPHA) * prev.vector.y
    } else {
      smoothX = fx
      smoothY = fy
    }

    const mag = Math.sqrt(smoothX * smoothX + smoothY * smoothY)
    if (mag < MIN_FORCE_THRESHOLD) {
      bodyMap.delete(contactKey)
      return null
    }

    const result: ForceData = {
      bodyId,
      forceType,
      vector: { x: smoothX, y: smoothY },
      magnitude: mag,
      contactNormal,
    }
    bodyMap.set(contactKey, result)
    return result
  }

  private cleanDisconnected(
    emaMap: Map<string, Map<string, ForceData>>,
    activeKeys: Set<string>,
  ): void {
    for (const [bodyId, contactMap] of emaMap) {
      for (const contactKey of contactMap.keys()) {
        const fullKey = `${bodyId}:${contactKey}`
        if (!activeKeys.has(fullKey)) {
          contactMap.delete(contactKey)
        }
      }
      if (contactMap.size === 0) emaMap.delete(bodyId)
    }
  }

  private collectJointForces(bridge: PhysicsBridge, inv_dt: number, out: ForceData[]): void {
    const jointStates = bridge.getJointStates()
    const reactionInvDt = bridge.getJointReactionInvDt()

    for (const js of jointStates) {
      const joint = bridge.getJoint(js.id)
      if (!joint) continue

      const reaction = joint.getReactionForce(reactionInvDt || inv_dt)
      const mag = Math.sqrt(reaction.x * reaction.x + reaction.y * reaction.y)
      if (mag < MIN_FORCE_THRESHOLD) continue

      const bodyA = joint.getBodyA()
      const bodyB = joint.getBodyB()
      const bodyIdA = this.findBodyId(bodyA)
      const bodyIdB = this.findBodyId(bodyB)

      // 弹簧：根据当前长度与自然长度决定拉/推方向
      if (js.sceneType === 'spring') {
        const dirAB = this.unitDir(js.anchorA, js.anchorB)
        const currentLength = Math.hypot(js.anchorB.x - js.anchorA.x, js.anchorB.y - js.anchorA.y)
        const restLength = js.length ?? currentLength
        const isCompressed = currentLength < restLength - 1e-4
        const forceOnA = isCompressed
          ? { x: -dirAB.x * mag, y: -dirAB.y * mag }
          : { x: dirAB.x * mag, y: dirAB.y * mag }

        if (bodyIdA) {
          out.push({
            bodyId: bodyIdA,
            forceType: 'tension',
            vector: forceOnA,
            magnitude: mag,
            sourceId: js.id,
          })
        }
        if (bodyIdB) {
          out.push({
            bodyId: bodyIdB,
            forceType: 'tension',
            vector: { x: -forceOnA.x, y: -forceOnA.y },
            magnitude: mag,
            sourceId: js.id,
          })
        }
        continue
      }

      // 滑轮绳：张力方向沿绳方向（从锚点指向 groundAnchor）
      if (js.type === 'pulley' && js.groundA && js.groundB) {
        if (bodyIdA) {
          const dirA = this.ropeDir(js.anchorA, js.groundA)
          out.push({
            bodyId: bodyIdA,
            forceType: 'tension',
            vector: { x: dirA.x * mag, y: dirA.y * mag },
            magnitude: mag,
            sourceId: js.id,
          })
        }
        if (bodyIdB) {
          const dirB = this.ropeDir(js.anchorB, js.groundB)
          out.push({
            bodyId: bodyIdB,
            forceType: 'tension',
            vector: { x: dirB.x * mag, y: dirB.y * mag },
            magnitude: mag,
            sourceId: js.id,
          })
        }
        continue
      }

      // 其他约束：getReactionForce 返回 bodyB 受到的力
      if (bodyIdB) {
        out.push({
          bodyId: bodyIdB,
          forceType: 'tension',
          vector: { x: reaction.x, y: reaction.y },
          magnitude: mag,
          sourceId: js.id,
        })
      }

      // bodyA 受到反作用力
      if (bodyIdA) {
        out.push({
          bodyId: bodyIdA,
          forceType: 'tension',
          vector: { x: -reaction.x, y: -reaction.y },
          magnitude: mag,
          sourceId: js.id,
        })
      }
    }
  }

  /** 计算从锚点指向 groundAnchor 的单位方向（绳方向） */
  private ropeDir(anchor: { x: number; y: number }, ground: { x: number; y: number }): { x: number; y: number } {
    return this.unitDir(anchor, ground)
  }

  /** 计算 from -> to 的单位方向 */
  private unitDir(from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
    const dx = to.x - from.x
    const dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1e-8) return { x: 0, y: 1 }
    return { x: dx / len, y: dy / len }
  }

  private collectExternalForces(scene: Scene, out: ForceData[]): void {
    // 用户外力
    for (const force of scene.forces) {
      if (!force.visible) continue

      const fx = force.magnitude * Math.cos(force.direction)
      const fy = force.magnitude * Math.sin(force.direction)
      const mag = force.magnitude

      if (mag < MIN_FORCE_THRESHOLD) continue

      out.push({
        bodyId: force.targetBodyId,
        forceType: 'external',
        vector: { x: fx, y: fy },
        magnitude: mag,
        sourceId: force.id,
        label: force.label,
      })
    }
  }

  // --- 辅助 ---

  private findBodyId(body: unknown): string | undefined {
    if (!this.world) return undefined
    // PhysicsBridge stores bodies in a Map<string, {body, config}>
    // We need access to that map - use the bridge reference
    return this._bodyIdLookup?.get(body as never)
  }

  // 由 PhysicsBridge 在 attach 时注入的反向查找表
  _bodyIdLookup: Map<unknown, string> | null = null
}
