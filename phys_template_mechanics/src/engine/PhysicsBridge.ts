import { World, Vec2, Body, Joint, RopeJoint, DistanceJoint, PulleyJoint, BoxShape, CircleShape, EdgeShape, PolygonShape, ChainShape, Contact } from 'planck-js'
import type { BodyConfig, BodyState, ShapeConfig, JointConfig, JointState, ForceData } from './types'
import type { Scene } from '@/models/types'
import { ForceCollector } from './ForceCollector'

interface BodyEntry {
  body: Body
  config: BodyConfig
}

interface JointEntry {
  joint: Joint
  config: JointConfig
}

interface Snapshot {
  positions: Map<string, { x: number; y: number }>
  angles: Map<string, number>
}

export class PhysicsBridge {
  private world: World | null = null
  private bodies: Map<string, BodyEntry> = new Map()
  private joints: Map<string, JointEntry> = new Map()
  private snapshot: Snapshot | null = null
  private conveyorSpeeds: Map<string, number> = new Map()
  private forceCollector = new ForceCollector()
  private lastJointReactionInvDt = 60

  createWorld(gravity: { x: number; y: number }): void {
    this.destroyWorld()
    this.world = new World(new Vec2(gravity.x, gravity.y))

    // Attach force collector for post-solve data collection
    this.forceCollector.attach(this.world)
    this.updateBodyIdLookup()

    // Register pre-solve for conveyor belt mechanism
    this.world.on('pre-solve', (contact: Contact) => {
      if (this.conveyorSpeeds.size === 0) return
      const bodyA = contact.getFixtureA().getBody()
      const bodyB = contact.getFixtureB().getBody()
      for (const [id, speed] of this.conveyorSpeeds) {
        const entry = this.bodies.get(id)
        if (entry && (entry.body === bodyA || entry.body === bodyB)) {
          contact.setTangentSpeed(speed)
          break
        }
      }
    })
  }

  destroyWorld(): void {
    this.forceCollector.detach()
    this.world = null
    this.bodies.clear()
    this.joints.clear()
    this.snapshot = null
    this.conveyorSpeeds.clear()
  }

  addBody(config: BodyConfig): void {
    if (!this.world) return

    const body = this.world.createBody({
      type: config.type,
      position: new Vec2(config.position.x, config.position.y),
      angle: config.angle,
      fixedRotation: config.fixedRotation,
    })

    // Support single shape or multiple shapes (multi-fixture)
    const shapes = Array.isArray(config.shape) ? config.shape : [config.shape]
    for (const shapeConfig of shapes) {
      const shape = this.createShape(shapeConfig)
      body.createFixture({
        shape,
        density: config.density,
        friction: config.friction,
        restitution: config.restitution,
      })
    }

    // Track conveyor belt speeds
    if (config.userData?.beltSpeed !== undefined) {
      this.conveyorSpeeds.set(config.id, config.userData.beltSpeed)
    }

    this.bodies.set(config.id, { body, config })
    this.updateBodyIdLookup()
  }

  removeBody(id: string): void {
    if (!this.world) return
    const entry = this.bodies.get(id)
    if (entry) {
      this.world.destroyBody(entry.body)
      this.bodies.delete(id)
      this.conveyorSpeeds.delete(id)
      this.updateBodyIdLookup()
    }
  }

  step(dt: number): void {
    if (!this.world) return
    this.runSubsteps(dt)
  }

  /**
   * 推进完整物理帧：在 rope/rod 场景下按推荐子步数推进，
   * 并在每个子步前重复施加连续外力，避免子步进后只在首子步受力。
   */
  stepFrame(scene: Scene, dt: number): void {
    if (!this.world) return
    this.beginForceFrame()
    this.runSubsteps(dt, () => {
      this.applyExternalForces(scene)
    })
  }

  setGravity(gravity: { x: number; y: number }): void {
    if (!this.world) return
    this.world.setGravity(new Vec2(gravity.x, gravity.y))
  }

  getBodyStates(): BodyState[] {
    const states: BodyState[] = []
    for (const [id, entry] of this.bodies) {
      const pos = entry.body.getPosition()
      const vel = entry.body.getLinearVelocity()
      const shapes = Array.isArray(entry.config.shape)
        ? entry.config.shape
        : [entry.config.shape]
      states.push({
        id,
        position: { x: pos.x, y: pos.y },
        angle: entry.body.getAngle(),
        linearVelocity: { x: vel.x, y: vel.y },
        angularVelocity: entry.body.getAngularVelocity(),
        shape: shapes[0],
        shapes: shapes.length > 1 ? shapes : undefined,
        type: entry.config.type,
        userData: entry.config.userData,
      })
    }
    return states
  }

  saveSnapshot(): void {
    const positions = new Map<string, { x: number; y: number }>()
    const angles = new Map<string, number>()
    for (const [id, entry] of this.bodies) {
      const pos = entry.body.getPosition()
      positions.set(id, { x: pos.x, y: pos.y })
      angles.set(id, entry.body.getAngle())
    }
    this.snapshot = { positions, angles }
  }

  restoreSnapshot(): void {
    if (!this.snapshot) return
    for (const [id, entry] of this.bodies) {
      const pos = this.snapshot.positions.get(id)
      const angle = this.snapshot.angles.get(id)
      if (pos) {
        entry.body.setPosition(new Vec2(pos.x, pos.y))
      }
      if (angle !== undefined) {
        entry.body.setAngle(angle)
      }
      entry.body.setLinearVelocity(new Vec2(0, 0))
      entry.body.setAngularVelocity(0)
      entry.body.setAwake(true)
    }
    this.snapshot = null
  }

  setLinearVelocity(id: string, velocity: { x: number; y: number }): void {
    const entry = this.bodies.get(id)
    if (entry) {
      entry.body.setLinearVelocity(new Vec2(velocity.x, velocity.y))
      entry.body.setAwake(true)
    }
  }

  reset(): void {
    this.restoreSnapshot()
  }

  /** 按历史快照恢复刚体状态（用于时间轨道回放） */
  restoreFromBodyStates(states: BodyState[]): void {
    for (const state of states) {
      const entry = this.bodies.get(state.id)
      if (!entry) continue
      entry.body.setPosition(new Vec2(state.position.x, state.position.y))
      entry.body.setAngle(state.angle)
      entry.body.setLinearVelocity(new Vec2(state.linearVelocity.x, state.linearVelocity.y))
      entry.body.setAngularVelocity(state.angularVelocity)
      entry.body.setAwake(true)
    }
  }

  // --- Joint API (framework for 5.2+) ---

  addJoint(config: JointConfig): void {
    if (!this.world) return
    const bodyEntryA = this.bodies.get(config.bodyIdA)
    const bodyEntryB = this.bodies.get(config.bodyIdB)
    if (!bodyEntryA || !bodyEntryB) return

    let joint: Joint | null = null

    switch (config.type) {
      case 'rope': {
        // RopeJointDef uses localAnchorA/B (body-local coordinates)
        // Convert world-space anchors back to local-space
        const localA = this.worldToLocal(bodyEntryA.body, config.anchorA)
        const localB = this.worldToLocal(bodyEntryB.body, config.anchorB)
        joint = this.world.createJoint(new RopeJoint({
          maxLength: config.maxLength ?? 2.0,
          localAnchorA: localA,
          localAnchorB: localB,
          bodyA: bodyEntryA.body,
          bodyB: bodyEntryB.body,
        }))
        break
      }
      case 'distance': {
        const localA = this.worldToLocal(bodyEntryA.body, config.anchorA)
        const localB = this.worldToLocal(bodyEntryB.body, config.anchorB)
        joint = this.world.createJoint(new DistanceJoint({
          length: config.length ?? 2.0,
          frequencyHz: config.frequencyHz ?? 0,
          dampingRatio: config.dampingRatio ?? 0,
          localAnchorA: localA,
          localAnchorB: localB,
          bodyA: bodyEntryA.body,
          bodyB: bodyEntryB.body,
        }))
        break
      }
      case 'pulley': {
        const localA = this.worldToLocal(bodyEntryA.body, config.anchorA)
        const localB = this.worldToLocal(bodyEntryB.body, config.anchorB)
        const gA = config.groundA ?? config.anchorA
        const gB = config.groundB ?? config.anchorB
        const dxA = config.anchorA.x - gA.x, dyA = config.anchorA.y - gA.y
        const dxB = config.anchorB.x - gB.x, dyB = config.anchorB.y - gB.y
        const rawA = Math.sqrt(dxA * dxA + dyA * dyA)
        const rawB = Math.sqrt(dxB * dxB + dyB * dyB)
        const rawTotal = rawA + rawB
        const total = config.totalLength ?? rawTotal
        // 按实际距离比例分配 totalLength
        const scale = rawTotal > 0.001 ? total / rawTotal : 1
        joint = this.world.createJoint(new PulleyJoint({
          bodyA: bodyEntryA.body,
          bodyB: bodyEntryB.body,
          groundAnchorA: Vec2(gA.x, gA.y),
          groundAnchorB: Vec2(gB.x, gB.y),
          localAnchorA: localA,
          localAnchorB: localB,
          lengthA: rawA * scale,
          lengthB: rawB * scale,
          ratio: config.ratio ?? 1,
        }))
        break
      }
    }

    if (joint) {
      this.joints.set(config.id, { joint, config })
    }
  }

  removeJoint(id: string): void {
    if (!this.world) return
    const entry = this.joints.get(id)
    if (entry) {
      if (entry.joint) {
        this.world.destroyJoint(entry.joint)
      }
      this.joints.delete(id)
    }
  }

  getJointStates(): JointState[] {
    const states: JointState[] = []
    for (const [id, entry] of this.joints) {
      if (!entry.joint) continue

      // Read real-time world-space anchors from Planck.js Joint
      const anchorA = entry.joint.getAnchorA()
      const anchorB = entry.joint.getAnchorB()

      states.push({
        id,
        type: entry.config.type,
        anchorA: { x: anchorA.x, y: anchorA.y },
        anchorB: { x: anchorB.x, y: anchorB.y },
        groundA: entry.config.groundA,
        groundB: entry.config.groundB,
        sceneType: entry.config.sceneType,
        maxLength: entry.config.maxLength,
        length: entry.config.length,
      })
    }
    return states
  }

  getBody(id: string): Body | undefined {
    return this.bodies.get(id)?.body
  }

  getJoint(id: string): Joint | undefined {
    return this.joints.get(id)?.joint ?? undefined
  }

  getJointReactionInvDt(): number {
    return this.lastJointReactionInvDt
  }

  // --- Force collection API (6.2) ---

  /** 施加用户外力（在 step 前调用） */
  applyExternalForces(scene: Scene): void {
    this.forceCollector.applyExternalForces(scene, this)
  }

  /** 开始新的一帧力收集（在 step 前调用） */
  beginForceFrame(): void {
    this.forceCollector.beginFrame()
  }

  /** 收集所有力（在 step 后调用） */
  collectForces(scene: Scene, dt: number, bodyStates?: BodyState[]): ForceData[] {
    return this.forceCollector.collect(scene, this, dt, bodyStates)
  }

  /** 获取本帧碰撞事件 */
  getFrameCollisions() {
    return this.forceCollector.getFrameCollisions()
  }

  /**
   * 编辑模式力探测：save → step(N) → collect → restore
   * 用于在不运行仿真的情况下获取物体受到的所有力（重力+外力+接触力+约束力）
   */
  probeForces(scene: Scene, steps = 1): ForceData[] {
    if (!this.world) return []
    this.forceCollector.resetEma()

    // 保存当前状态
    const savedPositions = new Map<string, { x: number; y: number }>()
    const savedAngles = new Map<string, number>()
    const savedVelocities = new Map<string, { x: number; y: number }>()
    const savedAngularVelocities = new Map<string, number>()
    for (const [id, entry] of this.bodies) {
      const pos = entry.body.getPosition()
      const vel = entry.body.getLinearVelocity()
      savedPositions.set(id, { x: pos.x, y: pos.y })
      savedAngles.set(id, entry.body.getAngle())
      savedVelocities.set(id, { x: vel.x, y: vel.y })
      savedAngularVelocities.set(id, entry.body.getAngularVelocity())
    }

    // 运行几步仿真以收集力
    const dt = 1 / 60
    let forces: ForceData[] = []
    for (let i = 0; i < steps; i++) {
      this.stepFrame(scene, dt)
    }
    forces = this.collectForces(scene, dt)

    // 恢复状态
    for (const [id, entry] of this.bodies) {
      const pos = savedPositions.get(id)
      const angle = savedAngles.get(id)
      const vel = savedVelocities.get(id)
      const angVel = savedAngularVelocities.get(id)
      if (pos) entry.body.setPosition(new Vec2(pos.x, pos.y))
      if (angle !== undefined) entry.body.setAngle(angle)
      if (vel) entry.body.setLinearVelocity(new Vec2(vel.x, vel.y))
      if (angVel !== undefined) entry.body.setAngularVelocity(angVel)
      entry.body.setAwake(true)
    }

    // 清理 EMA 缓存，避免污染后续仿真
    this.forceCollector.resetEma()

    return forces
  }

  setupDefaultScene(): void {
    // Ground: static edge at y=0, width 20m
    this.addBody({
      id: 'ground',
      type: 'static',
      position: { x: 0, y: 0 },
      angle: 0,
      shape: { type: 'edge', x1: -10, y1: 0, x2: 10, y2: 0 },
      density: 0,
      friction: 0.6,
      restitution: 0,
      fixedRotation: false,
    })

    // Test block: 1m x 1m dynamic body at (0, 5)
    this.addBody({
      id: 'test-block',
      type: 'dynamic',
      position: { x: 0, y: 5 },
      angle: 0,
      shape: { type: 'box', width: 1, height: 1 },
      density: 1,
      friction: 0.3,
      restitution: 0,
      fixedRotation: false,
    })
  }

  /** Rebuild Body → bodyId reverse lookup for ForceCollector */
  private updateBodyIdLookup(): void {
    const lookup = new Map<unknown, string>()
    for (const [id, entry] of this.bodies) {
      lookup.set(entry.body, id)
    }
    this.forceCollector._bodyIdLookup = lookup
  }

  private getRecommendedSubsteps(): number {
    let hasRod = false
    let hasSpring = false
    for (const entry of this.joints.values()) {
      if (entry.config.type === 'rope') {
        return 8
      }
      if (entry.config.sceneType === 'spring') {
        hasSpring = true
      }
      if (entry.config.sceneType === 'rod') {
        hasRod = true
      }
    }
    if (hasSpring) return 8
    return hasRod ? 8 : 1
  }

  private getRecommendedSolverIterations(): { velocity: number; position: number } {
    let hasRod = false
    let hasSpring = false
    for (const entry of this.joints.values()) {
      if (entry.config.sceneType === 'spring') {
        hasSpring = true
      }
      if (entry.config.sceneType === 'rod') {
        hasRod = true
      }
      if (hasSpring && hasRod) break
    }
    return (hasSpring || hasRod)
      ? { velocity: 12, position: 6 }
      : { velocity: 8, position: 3 }
  }

  private runSubsteps(dt: number, beforeEachStep?: () => void): void {
    if (!this.world) return
    const substeps = this.getRecommendedSubsteps()
    const stepDt = dt / substeps
    const iterations = this.getRecommendedSolverIterations()
    this.lastJointReactionInvDt = 1 / stepDt
    for (let i = 0; i < substeps; i++) {
      beforeEachStep?.()
      this.world.step(stepDt, iterations.velocity, iterations.position)
    }
  }

  /** Convert world-space point to body-local coordinates */
  private worldToLocal(body: Body, worldPoint: { x: number; y: number }): Vec2 {
    const pos = body.getPosition()
    const angle = body.getAngle()
    const cos = Math.cos(-angle)
    const sin = Math.sin(-angle)
    const dx = worldPoint.x - pos.x
    const dy = worldPoint.y - pos.y
    return new Vec2(dx * cos - dy * sin, dx * sin + dy * cos)
  }

  private createShape(config: ShapeConfig) {
    switch (config.type) {
      case 'box':
        return new BoxShape(config.width / 2, config.height / 2)
      case 'circle':
        return new CircleShape(config.radius)
      case 'edge':
        return new EdgeShape(
          new Vec2(config.x1, config.y1),
          new Vec2(config.x2, config.y2),
        )
      case 'polygon':
        return new PolygonShape(
          config.vertices.map((v) => new Vec2(v.x, v.y)),
        )
      case 'chain':
        return new ChainShape(
          config.vertices.map((v) => new Vec2(v.x, v.y)),
          config.loop,
        )
    }
  }
}
