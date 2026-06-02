import type { BodyState } from './types'
import type { Scene } from '@/models/types'

const KE_EPSILON = 1e-10
const ALPHA_MIN = 0.5
const ALPHA_MAX = 2.0

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

function computeSpringPE(scene: Scene, stateMap: Map<string, BodyState>, bodyMap: Map<string, { mass: number }>): number {
  let total = 0
  for (const joint of scene.joints) {
    if (joint.type !== 'spring') continue

    const naturalLength = joint.springLength ?? 2
    const freqHz = joint.stiffness ?? 4

    const stateA = stateMap.get(joint.bodyIdA)
    const stateB = stateMap.get(joint.bodyIdB)
    if (!stateA || !stateB) continue

    const worldA = localToWorld(joint.anchorA, stateA.position, stateA.angle)
    const worldB = localToWorld(joint.anchorB, stateB.position, stateB.angle)

    const dist = Math.hypot(worldA.x - worldB.x, worldA.y - worldB.y)
    const dx = dist - naturalLength

    const bodyA = bodyMap.get(joint.bodyIdA)
    const bodyB = bodyMap.get(joint.bodyIdB)
    if (!bodyA || !bodyB) continue

    const isStaticA = stateA.type === 'static'
    const isStaticB = stateB.type === 'static'
    let mEff: number
    if (isStaticA && isStaticB) continue
    else if (isStaticA) mEff = bodyB.mass
    else if (isStaticB) mEff = bodyA.mass
    else mEff = 1 / (1 / bodyA.mass + 1 / bodyB.mass)

    const k = mEff * (2 * Math.PI * freqHz) ** 2
    total += 0.5 * k * dx * dx
  }
  return total
}

function computeSystemEnergy(
  bodyStates: BodyState[],
  scene: Scene,
  groundY: number,
): { ke: number; pe: number; total: number } {
  const g = Math.abs(scene.settings.gravity.y)
  const bodyMap = new Map(scene.bodies.map(b => [b.id, { mass: b.mass }]))
  const stateMap = new Map(bodyStates.map(s => [s.id, s]))

  let ke = 0
  let gravPE = 0

  for (const bs of bodyStates) {
    if (bs.type !== 'dynamic') continue
    const body = bodyMap.get(bs.id)
    if (!body) continue
    const { x: vx, y: vy } = bs.linearVelocity
    const speed2 = vx * vx + vy * vy
    ke += 0.5 * body.mass * speed2
    gravPE += body.mass * g * (bs.position.y - groundY)
  }

  const springPE = computeSpringPE(scene, stateMap, bodyMap)
  const pe = gravPE + springPE
  return { ke, pe, total: ke + pe }
}

export class EnergyCompensator {
  private _targetEnergy: number | null = null
  private _groundY = 0

  initialize(bodyStates: BodyState[], scene: Scene): void {
    this._groundY = 0
    for (const b of scene.bodies) {
      if (b.type === 'ground') {
        this._groundY = b.position.y
        break
      }
    }
    const { total } = computeSystemEnergy(bodyStates, scene, this._groundY)
    this._targetEnergy = total
  }

  compensate(
    bodyStates: BodyState[],
    scene: Scene,
    setVelocity: (id: string, v: { x: number; y: number }) => void,
  ): void {
    if (this._targetEnergy === null) return

    const { ke, pe } = computeSystemEnergy(bodyStates, scene, this._groundY)

    if (ke < KE_EPSILON) return
    const targetKE = this._targetEnergy - pe
    if (targetKE <= 0) return

    let alpha = Math.sqrt(targetKE / ke)
    alpha = Math.max(ALPHA_MIN, Math.min(ALPHA_MAX, alpha))

    if (Math.abs(alpha - 1) < 1e-12) return

    for (const bs of bodyStates) {
      if (bs.type !== 'dynamic') continue
      bs.linearVelocity.x *= alpha
      bs.linearVelocity.y *= alpha
      setVelocity(bs.id, bs.linearVelocity)
    }
  }

  reset(): void {
    this._targetEnergy = null
    this._groundY = 0
  }
}
