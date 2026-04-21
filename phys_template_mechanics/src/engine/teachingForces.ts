import { getBodyDescriptor } from '@/models/bodyTypes'
import type { Scene, SceneBody } from '@/models/types'
import type { BodyState, CollectedForceType, ForceData } from './types'
import { buildFm041TeachingForce, isFm041Scene } from '@/templates/fm041Teaching'

const SLOPE_CONTACT_EPSILON = 0.18
const STATIC_SPEED_EPSILON = 0.05

interface TeachingSupportInfo {
  supportBody: SceneBody
  normal: { x: number; y: number }
  tangent: { x: number; y: number }
}

const TEACHING_FORCE_TYPES = new Set<CollectedForceType>([
  'gravity_parallel',
  'gravity_perpendicular',
  'static_friction',
  'kinetic_friction',
])

export function isTeachingForceType(forceType: CollectedForceType): boolean {
  return TEACHING_FORCE_TYPES.has(forceType)
}

export function augmentForcesWithTeachingForces(
  scene: Scene,
  bodyStates: BodyState[],
  baseForces: ForceData[],
): ForceData[] {
  const fm041Force = isFm041Scene(scene)
    ? buildFm041TeachingForce(scene, bodyStates, baseForces)
    : null
  const sceneBodyMap = new Map(scene.bodies.map((body) => [body.id, body]))

  const teachingForces: ForceData[] = []
  const teachingBodyIds = new Set<string>()

  for (const bodyState of bodyStates) {
    if (bodyState.type === 'static') continue
    const sceneBody = sceneBodyMap.get(bodyState.id)
    if (!sceneBody) continue

    const support = getSlopeTeachingSupport(scene, bodyState, baseForces)
    if (!support) continue

    const derived = buildSlopeTeachingForces(scene, sceneBody, bodyState, support)
    if (derived.length === 0) continue

    teachingForces.push(...derived)
    teachingBodyIds.add(bodyState.id)
  }

  if (fm041Force) {
    teachingForces.push(fm041Force)
  }

  if (teachingForces.length === 0) return baseForces

  const filteredBaseForces = baseForces.filter((force) => {
    if (!teachingBodyIds.has(force.bodyId)) return true
    return force.forceType !== 'friction'
  })

  return [...filteredBaseForces, ...teachingForces]
}

function buildSlopeTeachingForces(
  scene: Scene,
  body: SceneBody,
  bodyState: BodyState,
  support: TeachingSupportInfo,
): ForceData[] {
  const gravityVector = {
    x: body.mass * scene.settings.gravity.x,
    y: body.mass * scene.settings.gravity.y,
  }

  const alongMag = dot(gravityVector, support.tangent)
  const normalMag = dot(gravityVector, {
    x: -support.normal.x,
    y: -support.normal.y,
  })

  const gParallelMagnitude = Math.abs(alongMag)
  const gPerpendicularMagnitude = Math.abs(normalMag)
  if (gParallelMagnitude < 0.01 || gPerpendicularMagnitude < 0.01) {
    return []
  }

  const gParallelVector = scaleVector(
    support.tangent,
    gParallelMagnitude,
  )
  const gPerpendicularVector = scaleVector(
    { x: -support.normal.x, y: -support.normal.y },
    gPerpendicularMagnitude,
  )

  const muMixed = Math.sqrt(
    Math.max(0, body.friction) * Math.max(0, support.supportBody.friction),
  )
  const vParallel = dot(bodyState.linearVelocity, support.tangent)
  const staticLimit = muMixed * gPerpendicularMagnitude
  const canRemainStatic = staticLimit + 1e-6 >= gParallelMagnitude
  const isStaticLike = Math.abs(vParallel) < STATIC_SPEED_EPSILON && canRemainStatic

  const frictionType: CollectedForceType = isStaticLike ? 'static_friction' : 'kinetic_friction'
  const frictionMagnitude = isStaticLike
    ? gParallelMagnitude
    : staticLimit

  const frictionDirection = isStaticLike
    ? negate(support.tangent)
    : resolveKineticFrictionDirection(vParallel, alongMag, support.tangent)

  return [
    {
      bodyId: body.id,
      forceType: 'gravity_parallel',
      vector: gParallelVector,
      magnitude: gParallelMagnitude,
      sourceId: `${body.id}:teaching:g_parallel`,
    },
    {
      bodyId: body.id,
      forceType: 'gravity_perpendicular',
      vector: gPerpendicularVector,
      magnitude: gPerpendicularMagnitude,
      sourceId: `${body.id}:teaching:g_perpendicular`,
    },
    {
      bodyId: body.id,
      forceType: frictionType,
      vector: scaleVector(frictionDirection, frictionMagnitude),
      magnitude: frictionMagnitude,
      sourceId: `${body.id}:teaching:${frictionType}`,
    },
  ]
}

function getSlopeTeachingSupport(
  scene: Scene,
  bodyState: BodyState,
  baseForces: ForceData[],
): TeachingSupportInfo | null {
  const supportNormals = baseForces
    .filter((force) =>
      force.bodyId === bodyState.id &&
      force.forceType === 'normal' &&
      force.contactNormal &&
      Math.abs(force.contactNormal.x) > SLOPE_CONTACT_EPSILON,
    )
    .sort((a, b) => b.magnitude - a.magnitude)

  for (const force of supportNormals) {
    const support = matchTeachingSupportByNormal(scene, force.contactNormal!)
    if (support) {
      return support
    }
  }
  return null
}

function matchTeachingSupportByNormal(
  scene: Scene,
  normal: { x: number; y: number },
): TeachingSupportInfo | null {
  for (const body of scene.bodies) {
    if (body.type !== 'slope' && body.type !== 'conveyor') continue
    const surfaces = getBodyDescriptor(body.type).getSnapSurfaces?.(body) ?? []
    const restSurface = surfaces.find((surface) => surface.type === 'rest')
    if (!restSurface) continue
    if (dot(restSurface.normal, normal) < 0.98) continue

    const downhillTangent = resolveDownhillTangent(restSurface.normal)
    return {
      supportBody: body,
      normal: normalizeVector(normal),
      tangent: downhillTangent,
    }
  }
  return null
}

function resolveDownhillTangent(normal: { x: number; y: number }) {
  const tangent = normalizeVector({ x: normal.y, y: -normal.x })
  return tangent.y <= 0 ? tangent : negate(tangent)
}

function resolveKineticFrictionDirection(
  vParallel: number,
  alongMag: number,
  tangent: { x: number; y: number },
) {
  if (vParallel > STATIC_SPEED_EPSILON) {
    return negate(tangent)
  }
  if (vParallel < -STATIC_SPEED_EPSILON) {
    return tangent
  }
  // 临界起滑瞬间：速度还接近 0，但若静摩擦上限不足，应按“将要发生的运动方向”取反。
  // 在当前斜面定义中，tangent 始终指向沿斜面向下方向，因此 alongMag > 0 表示将要下滑。
  return alongMag >= 0 ? negate(tangent) : tangent
}

function dot(a: { x: number; y: number }, b: { x: number; y: number }) {
  return a.x * b.x + a.y * b.y
}

function negate(v: { x: number; y: number }) {
  return { x: -v.x, y: -v.y }
}

function scaleVector(v: { x: number; y: number }, scalar: number) {
  return { x: v.x * scalar, y: v.y * scalar }
}

function normalizeVector(v: { x: number; y: number }) {
  const length = Math.hypot(v.x, v.y)
  if (length < 1e-8) return { x: 0, y: 1 }
  return { x: v.x / length, y: v.y / length }
}
