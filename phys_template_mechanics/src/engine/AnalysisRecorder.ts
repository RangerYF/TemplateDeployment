import type { BodyState, ForceData } from './types'
import type { Scene } from '@/models/types'
import type { AnalysisGroup } from '@/store/analysisStore'

export interface BodyFrameData {
  x: number; y: number           // 位置
  vx: number; vy: number         // 速度分量
  speed: number                  // 速率 |v|
  ax: number; ay: number         // 加速度分量
  accel: number                  // 加速度大小 |a|
  px: number; py: number         // 动量分量
  momentum: number               // 动量大小 |p|
  ek: number                     // 动能
  epGravity: number              // 重力势能
  epSpring: number               // 弹性势能
  eMech: number                  // 机械能 = Ek + Ep(重) + Ep(弹)
  displacement: number           // 位移（相对初始位置）
  jointError: number             // 约束长度误差 |L-L_target|
  ropeSlack: number              // 绳松弛深度 max(L_target-L, 0)
  bottomPeakSpeed: number        // 最近一次“底点”峰值速率
  topPeakSpeed: number           // 最近一次“顶点”峰值速率
  bottomPeakTension: number      // 最近一次“底点”峰值拉力
  topPeakTension: number         // 最近一次“顶点”峰值拉力
}

/** 分析组汇总数据（系统级物理量） */
export interface GroupFrameData {
  // 质心
  cx: number; cy: number
  // 质心速度
  cvx: number; cvy: number
  speed: number                  // |v_cm|
  // 系统总动量
  px: number; py: number
  momentum: number               // |p_total|
  // 系统总能量
  ek: number                     // Σ(½mv²)
  epGravity: number              // Σ(mgy)
  epSpring: number               // Σ弹性势能
  eMech: number                  // ek + epGravity + epSpring
}

export interface FrameRecord {
  t: number                                 // 仿真时间（秒）
  bodies: Record<string, BodyFrameData>     // bodyId → 数据
  groups: Record<string, GroupFrameData>    // groupId → 汇总数据
}

/**
 * 每帧记录物体物理量，纯计算无副作用。
 * 降采样：仿真 60fps → 记录 30fps（每 2 帧记 1 次）。
 */
export class AnalysisRecorder {
  private _prevVelocities = new Map<string, { vx: number; vy: number }>()
  private _initialPositions = new Map<string, { x: number; y: number }>()
  private _cycleStates = new Map<string, CycleState>()
  private _frameCount = 0
  private _groundY = 0

  /** 仿真开始时调用，记录初始位置快照 */
  startRecording(scene: Scene): Record<string, { x: number; y: number }> {
    this._prevVelocities.clear()
    this._cycleStates.clear()
    this._frameCount = 0

    // 找地面作为重力势能参考面
    const ground = scene.bodies.find(b => b.type === 'ground')
    this._groundY = ground ? ground.position.y : 0

    // 记录初始位置
    const initialPositions: Record<string, { x: number; y: number }> = {}
    for (const body of scene.bodies) {
      this._initialPositions.set(body.id, { x: body.position.x, y: body.position.y })
      initialPositions[body.id] = { x: body.position.x, y: body.position.y }
    }

    return initialPositions
  }

  /**
   * 每帧调用，返回 FrameRecord 或 null（降采样跳过帧）。
   * bodyStates 来自 physicsBridge.getBodyStates()。
   */
  recordFrame(
    t: number,
    bodyStates: BodyState[],
    scene: Scene,
    dt: number,
    analysisGroups?: AnalysisGroup[],
    currentForces?: ForceData[],
  ): FrameRecord | null {
    this._frameCount++
    // 降采样：每 2 帧记 1 次
    if (this._frameCount % 2 !== 0) return null

    return this._buildFrameRecord(t, bodyStates, scene, dt, analysisGroups, currentForces)
  }

  /**
   * 记录仿真起点帧（t=0）。
   * 不参与降采样，直接写入，确保图表首个点就是初始状态。
   */
  recordInitialFrame(
    bodyStates: BodyState[],
    scene: Scene,
    analysisGroups?: AnalysisGroup[],
    currentForces?: ForceData[],
  ): FrameRecord {
    return this._buildFrameRecord(0, bodyStates, scene, 0, analysisGroups, currentForces)
  }

  private _buildFrameRecord(
    t: number,
    bodyStates: BodyState[],
    scene: Scene,
    dt: number,
    analysisGroups?: AnalysisGroup[],
    currentForces?: ForceData[],
  ): FrameRecord {

    const g = Math.abs(scene.settings.gravity.y)
    const bodyMap = new Map(scene.bodies.map(b => [b.id, b]))
    const stateMap = new Map(bodyStates.map(s => [s.id, s]))

    // 预计算弹簧弹性势能（按 bodyId 累加，每端各分一半）
    const springPE = this._computeSpringPE(scene, stateMap, bodyMap)
    const tensionByBody = this._collectTensionMagnitudes(currentForces)
    const constraintDiagnostics = this._computeConstraintDiagnostics(scene, stateMap, bodyMap, tensionByBody)

    const bodies: Record<string, BodyFrameData> = {}

    for (const bs of bodyStates) {
      // 跳过 static 物体（地面/墙壁等无需记录）
      if (bs.type === 'static') continue

      const sceneBody = bodyMap.get(bs.id)
      if (!sceneBody) continue

      const mass = sceneBody.mass
      const rawVx = bs.linearVelocity.x
      const rawVy = bs.linearVelocity.y
      // 消除浮点噪声：极小速度归零（阈值 1e-6 m/s）
      const vx = Math.abs(rawVx) < 1e-6 ? 0 : rawVx
      const vy = Math.abs(rawVy) < 1e-6 ? 0 : rawVy
      const speed = Math.hypot(vx, vy)

      // 加速度差分
      const prev = this._prevVelocities.get(bs.id)
      let ax = 0, ay = 0
      if (prev && dt > 0) {
        ax = (vx - prev.vx) / dt
        ay = (vy - prev.vy) / dt
        // 消除加速度噪声
        if (Math.abs(ax) < 1e-4) ax = 0
        if (Math.abs(ay) < 1e-4) ay = 0
      }

      // 动量
      const px = mass * vx
      const py = mass * vy

      // 位移
      const init = this._initialPositions.get(bs.id)
      const displacement = init
        ? Math.hypot(bs.position.x - init.x, bs.position.y - init.y)
        : 0

      const diagnostics = constraintDiagnostics.get(bs.id) ?? DEFAULT_CONSTRAINT_DIAGNOSTICS
      const epGravity = mass * g * (bs.position.y - this._groundY)
      const epSpring = springPE.get(bs.id) ?? 0
      const eMech = 0.5 * mass * speed * speed + epGravity + epSpring

      bodies[bs.id] = {
        x: bs.position.x,
        y: bs.position.y,
        vx, vy, speed,
        ax, ay,
        accel: Math.hypot(ax, ay),
        px, py,
        momentum: mass * speed,
        ek: 0.5 * mass * speed * speed,
        epGravity,
        epSpring,
        eMech,
        displacement,
        jointError: diagnostics.jointError,
        ropeSlack: diagnostics.ropeSlack,
        bottomPeakSpeed: diagnostics.bottomPeakSpeed,
        topPeakSpeed: diagnostics.topPeakSpeed,
        bottomPeakTension: diagnostics.bottomPeakTension,
        topPeakTension: diagnostics.topPeakTension,
      }
    }

    // 更新上一帧速度（用实际 dt 间隔，即 2 帧的量，但加速度计算用的也是 2 帧间隔）
    for (const bs of bodyStates) {
      this._prevVelocities.set(bs.id, {
        vx: bs.linearVelocity.x,
        vy: bs.linearVelocity.y,
      })
    }

    // 计算分析组汇总数据
    const groups: Record<string, GroupFrameData> = {}
    if (analysisGroups && analysisGroups.length > 0) {
      for (const group of analysisGroups) {
        const gd = this._computeGroupData(group, bodies, bodyMap)
        if (gd) groups[group.id] = gd
      }
    }

    return { t, bodies, groups }
  }

  /** 计算分析组汇总数据 */
  private _computeGroupData(
    group: AnalysisGroup,
    bodyFrames: Record<string, BodyFrameData>,
    bodyMap: Map<string, { mass: number }>,
  ): GroupFrameData | null {
    let totalMass = 0
    let sumMx = 0, sumMy = 0       // Σ(m·r)
    let sumMvx = 0, sumMvy = 0     // Σ(m·v)
    let sumEk = 0, sumEpG = 0, sumEpS = 0

    for (const bodyId of group.bodyIds) {
      const frame = bodyFrames[bodyId]
      const sceneBody = bodyMap.get(bodyId)
      if (!frame || !sceneBody) continue

      const m = sceneBody.mass
      totalMass += m
      sumMx += m * frame.x
      sumMy += m * frame.y
      sumMvx += m * frame.vx
      sumMvy += m * frame.vy
      sumEk += frame.ek
      sumEpG += frame.epGravity
      sumEpS += frame.epSpring
    }

    if (totalMass === 0) return null

    return {
      cx: sumMx / totalMass,
      cy: sumMy / totalMass,
      cvx: sumMvx / totalMass,
      cvy: sumMvy / totalMass,
      speed: Math.hypot(sumMvx / totalMass, sumMvy / totalMass),
      px: sumMvx,    // 系统总动量 = Σ(m·v)
      py: sumMvy,
      momentum: Math.hypot(sumMvx, sumMvy),
      ek: sumEk,
      epGravity: sumEpG,
      epSpring: sumEpS,
      eMech: sumEk + sumEpG + sumEpS,
    }
  }

  /** 计算所有弹簧的弹性势能，按 bodyId 累加（每端各分一半） */
  private _computeSpringPE(
    scene: Scene,
    stateMap: Map<string, BodyState>,
    bodyMap: Map<string, (typeof scene.bodies)[number]>,
  ): Map<string, number> {
    const result = new Map<string, number>()

    for (const joint of scene.joints) {
      if (joint.type !== 'spring') continue

      const naturalLength = joint.springLength ?? 2
      const freqHz = joint.stiffness ?? 4

      const stateA = stateMap.get(joint.bodyIdA)
      const stateB = stateMap.get(joint.bodyIdB)
      if (!stateA || !stateB) continue

      // 局部锚点转世界坐标
      const worldA = localToWorld(joint.anchorA, stateA.position, stateA.angle)
      const worldB = localToWorld(joint.anchorB, stateB.position, stateB.angle)

      const dist = Math.hypot(worldA.x - worldB.x, worldA.y - worldB.y)
      const dx = dist - naturalLength

      // k = m_eff × (2π × f)²
      const bodyA = bodyMap.get(joint.bodyIdA)
      const bodyB = bodyMap.get(joint.bodyIdB)
      if (!bodyA || !bodyB) continue

      const isStaticA = stateA.type === 'static'
      const isStaticB = stateB.type === 'static'
      let mEff: number
      if (isStaticA && isStaticB) continue // 两端都静止，无意义
      else if (isStaticA) mEff = bodyB.mass
      else if (isStaticB) mEff = bodyA.mass
      else mEff = 1 / (1 / bodyA.mass + 1 / bodyB.mass)

      const k = mEff * (2 * Math.PI * freqHz) ** 2
      const pe = 0.5 * k * dx * dx
      const halfPE = pe / 2

      // 各端分一半
      if (!isStaticA) result.set(joint.bodyIdA, (result.get(joint.bodyIdA) ?? 0) + halfPE)
      if (!isStaticB) result.set(joint.bodyIdB, (result.get(joint.bodyIdB) ?? 0) + halfPE)
    }

    return result
  }

  private _computeConstraintDiagnostics(
    scene: Scene,
    stateMap: Map<string, BodyState>,
    bodyMap: Map<string, (typeof scene.bodies)[number]>,
    tensionByBody: Map<string, number>,
  ): Map<string, ConstraintDiagnostics> {
    const result = new Map<string, ConstraintDiagnostics>()

    for (const joint of scene.joints) {
      if (joint.type !== 'rope' && joint.type !== 'rod') continue

      const stateA = stateMap.get(joint.bodyIdA)
      const stateB = stateMap.get(joint.bodyIdB)
      const bodyA = bodyMap.get(joint.bodyIdA)
      const bodyB = bodyMap.get(joint.bodyIdB)
      if (!stateA || !stateB || !bodyA || !bodyB) continue

      const worldA = localToWorld(joint.anchorA, stateA.position, stateA.angle)
      const worldB = localToWorld(joint.anchorB, stateB.position, stateB.angle)
      const actualLength = Math.hypot(worldA.x - worldB.x, worldA.y - worldB.y)
      const targetLength = joint.type === 'rope'
        ? (joint.maxLength ?? actualLength)
        : (joint.length ?? actualLength)
      const jointError = Math.abs(actualLength - targetLength)
      const ropeSlack = joint.type === 'rope'
        ? Math.max(0, targetLength - actualLength)
        : 0

      this._mergeConstraintDiagnostic(result, joint.bodyIdA, {
        jointError,
        ropeSlack,
        bottomPeakSpeed: 0,
        topPeakSpeed: 0,
        bottomPeakTension: 0,
        topPeakTension: 0,
      })
      this._mergeConstraintDiagnostic(result, joint.bodyIdB, {
        jointError,
        ropeSlack,
        bottomPeakSpeed: 0,
        topPeakSpeed: 0,
        bottomPeakTension: 0,
        topPeakTension: 0,
      })

      const anchored =
        (bodyA.type === 'anchor' || stateA.type === 'static')
          ? { fixedId: bodyA.id, movingId: bodyB.id, fixedAnchor: worldA, movingAnchor: worldB }
          : (bodyB.type === 'anchor' || stateB.type === 'static')
            ? { fixedId: bodyB.id, movingId: bodyA.id, fixedAnchor: worldB, movingAnchor: worldA }
            : null
      if (!anchored) continue

      const movingState = stateMap.get(anchored.movingId)
      if (!movingState || movingState.type === 'static') continue

      const cycleKey = `${joint.id}:${anchored.movingId}`
      const cycleState = this._cycleStates.get(cycleKey) ?? {
        prevRelativeY: null,
        prevDeltaY: null,
        bottomPeakSpeed: 0,
        topPeakSpeed: 0,
        bottomPeakTension: 0,
        topPeakTension: 0,
      }

      const relativeY = anchored.movingAnchor.y - anchored.fixedAnchor.y
      const speed = Math.hypot(movingState.linearVelocity.x, movingState.linearVelocity.y)
      const currentTension = tensionByBody.get(anchored.movingId) ?? 0

      if (cycleState.prevRelativeY !== null) {
        const deltaY = relativeY - cycleState.prevRelativeY
        if (cycleState.prevDeltaY !== null) {
          if (cycleState.prevDeltaY < -PEAK_EPSILON && deltaY >= PEAK_EPSILON) {
            cycleState.bottomPeakSpeed = speed
            cycleState.bottomPeakTension = currentTension
          } else if (cycleState.prevDeltaY > PEAK_EPSILON && deltaY <= -PEAK_EPSILON) {
            cycleState.topPeakSpeed = speed
            cycleState.topPeakTension = currentTension
          }
        }
        cycleState.prevDeltaY = deltaY
      }
      cycleState.prevRelativeY = relativeY
      this._cycleStates.set(cycleKey, cycleState)

      this._mergeConstraintDiagnostic(result, anchored.movingId, {
        jointError,
        ropeSlack,
        bottomPeakSpeed: cycleState.bottomPeakSpeed,
        topPeakSpeed: cycleState.topPeakSpeed,
        bottomPeakTension: cycleState.bottomPeakTension,
        topPeakTension: cycleState.topPeakTension,
      })
    }

    return result
  }

  private _mergeConstraintDiagnostic(
    target: Map<string, ConstraintDiagnostics>,
    bodyId: string,
    incoming: ConstraintDiagnostics,
  ): void {
    const current = target.get(bodyId) ?? DEFAULT_CONSTRAINT_DIAGNOSTICS
    target.set(bodyId, {
      jointError: Math.max(current.jointError, incoming.jointError),
      ropeSlack: Math.max(current.ropeSlack, incoming.ropeSlack),
      bottomPeakSpeed: incoming.bottomPeakSpeed > 0 ? incoming.bottomPeakSpeed : current.bottomPeakSpeed,
      topPeakSpeed: incoming.topPeakSpeed > 0 ? incoming.topPeakSpeed : current.topPeakSpeed,
      bottomPeakTension: incoming.bottomPeakTension > 0 ? incoming.bottomPeakTension : current.bottomPeakTension,
      topPeakTension: incoming.topPeakTension > 0 ? incoming.topPeakTension : current.topPeakTension,
    })
  }

  private _collectTensionMagnitudes(currentForces?: ForceData[]): Map<string, number> {
    const result = new Map<string, number>()
    if (!currentForces) return result
    for (const force of currentForces) {
      if (force.forceType !== 'tension') continue
      const previous = result.get(force.bodyId) ?? 0
      if (force.magnitude > previous) {
        result.set(force.bodyId, force.magnitude)
      }
    }
    return result
  }
}

interface ConstraintDiagnostics {
  jointError: number
  ropeSlack: number
  bottomPeakSpeed: number
  topPeakSpeed: number
  bottomPeakTension: number
  topPeakTension: number
}

interface CycleState {
  prevRelativeY: number | null
  prevDeltaY: number | null
  bottomPeakSpeed: number
  topPeakSpeed: number
  bottomPeakTension: number
  topPeakTension: number
}

const DEFAULT_CONSTRAINT_DIAGNOSTICS: ConstraintDiagnostics = {
  jointError: 0,
  ropeSlack: 0,
  bottomPeakSpeed: 0,
  topPeakSpeed: 0,
  bottomPeakTension: 0,
  topPeakTension: 0,
}

const PEAK_EPSILON = 1e-5

/** 局部坐标 → 世界坐标 */
function localToWorld(
  local: { x: number; y: number },
  bodyPos: { x: number; y: number },
  angle: number,
): { x: number; y: number } {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: bodyPos.x + local.x * cos - local.y * sin,
    y: bodyPos.y + local.x * sin + local.y * cos,
  }
}
