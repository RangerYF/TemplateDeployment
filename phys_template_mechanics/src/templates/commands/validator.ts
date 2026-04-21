import '@/models/bodyTypes'
import { getBodyDescriptor } from '@/models/bodyTypes'
import type { BodyType, Scene, SceneBody } from '@/models/types'
import { executeTemplateCommandProgram } from './executor'
import type { TemplateCommandProgram, Vec2 } from './schema'

export interface SceneDiffEntry {
  path: string
  expected: unknown
  actual: unknown
}

export interface SceneValidationResult {
  ok: boolean
  diffs: SceneDiffEntry[]
}

export interface SceneSanityIssue {
  level: 'error' | 'warning'
  code: string
  message: string
  path?: string
}

export interface SceneSanityResult {
  ok: boolean
  issues: SceneSanityIssue[]
}

interface ValidateSceneOptions {
  numberTolerance?: number
  maxDiffs?: number
}

interface SceneSanityOptions {
  groundTolerance?: number
  jointToleranceRatio?: number
  minAnchorHeight?: number
  minSuspensionDistance?: number
  allowNonZeroInitialVelocity?: boolean
  allowCustomBodySize?: boolean
  maxIssues?: number
}

const DEFAULT_NUMBER_TOLERANCE = 1e-6
const DEFAULT_MAX_DIFFS = 100
const DEFAULT_GROUND_TOLERANCE = 0.02
const DEFAULT_JOINT_TOLERANCE_RATIO = 0.08
const DEFAULT_MIN_ANCHOR_HEIGHT = 9
const DEFAULT_MIN_SUSPENSION_DISTANCE = 4
const DEFAULT_ALLOW_NON_ZERO_INITIAL_VELOCITY = false
const DEFAULT_ALLOW_CUSTOM_BODY_SIZE = false
const DEFAULT_MAX_ISSUES = 100
const SIZE_TOLERANCE = 1e-6
const SPEED_EPSILON = 1e-6
const BLOCK_DEFAULT_WIDTH = 0.8
const BLOCK_DEFAULT_HEIGHT = 0.6
const BALL_DEFAULT_RADIUS = 0.3
const GROUND_REST_TYPES: ReadonlySet<BodyType> = new Set([
  'slope',
  'conveyor',
  'hemisphere',
  'half-sphere',
  'groove',
])

export function validateScene(
  actual: Scene,
  expected: Scene,
  options: ValidateSceneOptions = {},
): SceneValidationResult {
  const diffs: SceneDiffEntry[] = []
  const numberTolerance = options.numberTolerance ?? DEFAULT_NUMBER_TOLERANCE
  const maxDiffs = options.maxDiffs ?? DEFAULT_MAX_DIFFS

  compareValue(expected, actual, '$', diffs, numberTolerance, maxDiffs)

  return {
    ok: diffs.length === 0,
    diffs,
  }
}

export function validateProgramAgainstScene(
  program: TemplateCommandProgram,
  expectedScene: Scene,
  options: ValidateSceneOptions = {},
): SceneValidationResult & { generatedScene: Scene } {
  const generatedScene = executeTemplateCommandProgram(program)
  const validation = validateScene(generatedScene, expectedScene, options)
  return {
    ...validation,
    generatedScene,
  }
}

export function validateSceneSanity(
  scene: Scene,
  options: SceneSanityOptions = {},
): SceneSanityResult {
  const issues: SceneSanityIssue[] = []
  const groundTolerance = options.groundTolerance ?? DEFAULT_GROUND_TOLERANCE
  const jointToleranceRatio = options.jointToleranceRatio ?? DEFAULT_JOINT_TOLERANCE_RATIO
  const minAnchorHeight = options.minAnchorHeight ?? DEFAULT_MIN_ANCHOR_HEIGHT
  const minSuspensionDistance = options.minSuspensionDistance ?? DEFAULT_MIN_SUSPENSION_DISTANCE
  const allowNonZeroInitialVelocity =
    options.allowNonZeroInitialVelocity ?? DEFAULT_ALLOW_NON_ZERO_INITIAL_VELOCITY
  const allowCustomBodySize =
    options.allowCustomBodySize ?? DEFAULT_ALLOW_CUSTOM_BODY_SIZE
  const maxIssues = options.maxIssues ?? DEFAULT_MAX_ISSUES
  const pushIssue = (issue: SceneSanityIssue) => {
    if (issues.length >= maxIssues) return
    issues.push(issue)
  }

  if (!allowNonZeroInitialVelocity) {
    for (const body of scene.bodies) {
      if (body.isStatic) continue
      const speed = Math.hypot(body.initialVelocity.x, body.initialVelocity.y)
      if (speed > SPEED_EPSILON) {
        pushIssue({
          level: 'error',
          code: 'initial_velocity_not_allowed',
          message: `${body.id} has non-zero initial velocity (${speed.toFixed(3)}m/s) without explicit allowance`,
          path: `$.bodies[${body.id}].initialVelocity`,
        })
      }
    }
  }

  if (!allowCustomBodySize) {
    for (const body of scene.bodies) {
      if (body.type === 'block') {
        const width = body.width ?? BLOCK_DEFAULT_WIDTH
        const height = body.height ?? BLOCK_DEFAULT_HEIGHT
        if (
          Math.abs(width - BLOCK_DEFAULT_WIDTH) > SIZE_TOLERANCE ||
          Math.abs(height - BLOCK_DEFAULT_HEIGHT) > SIZE_TOLERANCE
        ) {
          pushIssue({
            level: 'error',
            code: 'block_size_not_default',
            message: `${body.id} block size must use default (${BLOCK_DEFAULT_WIDTH}m x ${BLOCK_DEFAULT_HEIGHT}m), actual=(${width.toFixed(3)}m x ${height.toFixed(3)}m)`,
            path: `$.bodies[${body.id}]`,
          })
        }
      }

      if (body.type === 'ball') {
        const radius = body.radius ?? BALL_DEFAULT_RADIUS
        if (Math.abs(radius - BALL_DEFAULT_RADIUS) > SIZE_TOLERANCE) {
          pushIssue({
            level: 'error',
            code: 'ball_size_not_default',
            message: `${body.id} ball radius must use default (${BALL_DEFAULT_RADIUS}m), actual=${radius.toFixed(3)}m`,
            path: `$.bodies[${body.id}].radius`,
          })
        }
      }
    }
  }

  for (const body of scene.bodies) {
    if (body.type !== 'anchor') continue
    if (body.position.y <= minAnchorHeight) {
      pushIssue({
        level: 'error',
        code: 'anchor_height_too_low',
        message: `${body.id} anchor height must be > ${minAnchorHeight.toFixed(1)}m, actual=${body.position.y.toFixed(3)}m`,
        path: `$.bodies[${body.id}].position.y`,
      })
    }
  }

  const ground = scene.bodies.find((body) => body.type === 'ground')
  const groundY = ground?.position.y

  if (!ground) {
    pushIssue({
      level: 'error',
      code: 'ground_missing',
      message: 'scene is missing built-in ground body',
      path: '$.bodies',
    })
  }

  if (groundY !== undefined) {
    for (const body of scene.bodies) {
      if (body.type === 'ground') continue

      const minContactY = getBodyMinContactY(body)
      if (minContactY === null) continue

      if (minContactY < groundY - groundTolerance) {
        pushIssue({
          level: 'error',
          code: 'body_below_ground',
          message: `${body.id} has contact surface below ground (${minContactY.toFixed(3)} < ${groundY.toFixed(3)})`,
          path: `$.bodies[${body.id}]`,
        })
      }

      if (GROUND_REST_TYPES.has(body.type)) {
        const gap = Math.abs(minContactY - groundY)
        if (gap > groundTolerance) {
          pushIssue({
            level: 'warning',
            code: 'support_not_grounded',
            message: `${body.id} expected to rest on ground but contact y differs by ${gap.toFixed(3)}m`,
            path: `$.bodies[${body.id}]`,
          })
        }
      }
    }
  }

  for (const joint of scene.joints) {
    const bodyA = scene.bodies.find((body) => body.id === joint.bodyIdA)
    const bodyB = scene.bodies.find((body) => body.id === joint.bodyIdB)

    if (!bodyA || !bodyB) {
      pushIssue({
        level: 'error',
        code: 'joint_body_missing',
        message: `${joint.id} references missing body`,
        path: `$.joints[${joint.id}]`,
      })
      continue
    }

    const worldAnchorA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
    const worldAnchorB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)
    const anchorDistance = distance(worldAnchorA, worldAnchorB)
    const absoluteTolerance = Math.max(0.02, anchorDistance * jointToleranceRatio)

    if (joint.type === 'rod') {
      const rodLength = joint.length ?? anchorDistance
      if (rodLength <= 0) {
        pushIssue({
          level: 'error',
          code: 'rod_length_invalid',
          message: `${joint.id} has non-positive rod length`,
          path: `$.joints[${joint.id}].length`,
        })
      } else if (Math.abs(rodLength - anchorDistance) > absoluteTolerance) {
        pushIssue({
          level: 'error',
          code: 'rod_length_mismatch',
          message: `${joint.id} length (${rodLength.toFixed(3)}) mismatches anchor distance (${anchorDistance.toFixed(3)})`,
          path: `$.joints[${joint.id}]`,
        })
      }
    }

    if (joint.type === 'rope') {
      const maxLength = joint.maxLength ?? anchorDistance
      if (maxLength <= 0) {
        pushIssue({
          level: 'error',
          code: 'rope_length_invalid',
          message: `${joint.id} has non-positive rope length`,
          path: `$.joints[${joint.id}].maxLength`,
        })
      } else if (maxLength + absoluteTolerance < anchorDistance) {
        pushIssue({
          level: 'error',
          code: 'rope_too_short',
          message: `${joint.id} maxLength (${maxLength.toFixed(3)}) is shorter than anchor distance (${anchorDistance.toFixed(3)})`,
          path: `$.joints[${joint.id}]`,
        })
      }
    }

    if (joint.type === 'rope' || joint.type === 'rod') {
      const anchorInA = bodyA.type === 'anchor'
      const anchorInB = bodyB.type === 'anchor'
      if (anchorInA !== anchorInB) {
        const movingBody = anchorInA ? bodyB : bodyA
        const movingSpeed = Math.hypot(
          movingBody.initialVelocity.x,
          movingBody.initialVelocity.y,
        )
        if (movingSpeed <= SPEED_EPSILON && anchorDistance <= minSuspensionDistance) {
          pushIssue({
            level: 'error',
            code: 'suspension_distance_too_short',
            message: `${joint.id} suspension distance must be > ${minSuspensionDistance.toFixed(1)}m, actual=${anchorDistance.toFixed(3)}m`,
            path: `$.joints[${joint.id}]`,
          })
        }
      }
    }

    if (joint.type === 'spring') {
      const springLength = joint.springLength ?? anchorDistance
      if (springLength <= 0) {
        pushIssue({
          level: 'error',
          code: 'spring_length_invalid',
          message: `${joint.id} has non-positive spring length`,
          path: `$.joints[${joint.id}].springLength`,
        })
      } else {
        const preloadRatio = Math.abs(springLength - anchorDistance) / Math.max(anchorDistance, 0.01)
        if (preloadRatio > 0.6) {
          pushIssue({
            level: 'warning',
            code: 'spring_preload_large',
            message: `${joint.id} spring preload ratio is high (${(preloadRatio * 100).toFixed(1)}%)`,
            path: `$.joints[${joint.id}]`,
          })
        }
      }
    }

    if (joint.type === 'pulley') {
      if ((joint.ratio ?? 1) <= 0) {
        pushIssue({
          level: 'error',
          code: 'pulley_ratio_invalid',
          message: `${joint.id} ratio must be positive`,
          path: `$.joints[${joint.id}].ratio`,
        })
      }

      if (!joint.pulleyMountId) {
        pushIssue({
          level: 'error',
          code: 'pulley_mount_missing',
          message: `${joint.id} is missing pulleyMountId`,
          path: `$.joints[${joint.id}].pulleyMountId`,
        })
      } else {
        const mount = scene.bodies.find((body) => body.id === joint.pulleyMountId)
        if (!mount) {
          pushIssue({
            level: 'error',
            code: 'pulley_mount_not_found',
            message: `${joint.id} references missing pulley mount body`,
            path: `$.joints[${joint.id}].pulleyMountId`,
          })
        } else if (joint.totalLength !== undefined) {
          const topPoint = {
            x: mount.position.x,
            y: mount.position.y + (mount.pulleyRadius ?? 0.15),
          }
          const requiredLength =
            distance(worldAnchorA, topPoint) +
            distance(worldAnchorB, topPoint)
          if (joint.totalLength + absoluteTolerance < requiredLength) {
            pushIssue({
              level: 'error',
              code: 'pulley_total_length_too_short',
              message: `${joint.id} totalLength (${joint.totalLength.toFixed(3)}) is shorter than required (${requiredLength.toFixed(3)})`,
              path: `$.joints[${joint.id}].totalLength`,
            })
          }
        }
      }
    }
  }

  if (scene.name.includes('竖直圆周')) {
    validateVerticalCircularMotion(scene, pushIssue)
  }

  return {
    ok: !issues.some((issue) => issue.level === 'error'),
    issues,
  }
}

export function formatSceneDiffs(diffs: SceneDiffEntry[], maxItems = 20): string {
  if (diffs.length === 0) return 'no diff'

  const lines = diffs.slice(0, maxItems).map((diff) => {
    return `${diff.path}: expected=${stringifyDiffValue(diff.expected)} actual=${stringifyDiffValue(diff.actual)}`
  })

  if (diffs.length > maxItems) {
    lines.push(`... and ${diffs.length - maxItems} more diff(s)`)
  }

  return lines.join('\n')
}

export function formatSceneSanityIssues(issues: SceneSanityIssue[], maxItems = 20): string {
  if (issues.length === 0) return 'no issue'
  const lines = issues.slice(0, maxItems).map((issue) => {
    const pathSuffix = issue.path ? ` @ ${issue.path}` : ''
    return `[${issue.level}] ${issue.code}${pathSuffix}: ${issue.message}`
  })
  if (issues.length > maxItems) {
    lines.push(`... and ${issues.length - maxItems} more issue(s)`)
  }
  return lines.join('\n')
}

function validateVerticalCircularMotion(
  scene: Scene,
  pushIssue: (issue: SceneSanityIssue) => void,
): void {
  const gravityMagnitude = Math.hypot(scene.settings.gravity.x, scene.settings.gravity.y)
  if (gravityMagnitude <= 0) return

  for (const joint of scene.joints) {
    if (joint.type !== 'rope' && joint.type !== 'rod') continue
    const bodyA = scene.bodies.find((body) => body.id === joint.bodyIdA)
    const bodyB = scene.bodies.find((body) => body.id === joint.bodyIdB)
    if (!bodyA || !bodyB) continue

    const anchorBody = bodyA.type === 'anchor' ? bodyA : bodyB.type === 'anchor' ? bodyB : null
    if (!anchorBody) continue
    const movingBody = anchorBody.id === bodyA.id ? bodyB : bodyA
    if (movingBody.type !== 'ball') continue

    const worldAnchorA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
    const worldAnchorB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)
    const radius = distance(worldAnchorA, worldAnchorB)
    if (radius <= 0.05) continue

    const speed = Math.hypot(
      movingBody.initialVelocity.x,
      movingBody.initialVelocity.y,
    )
    const requiredSpeed = Math.sqrt((joint.type === 'rope' ? 5 : 4) * gravityMagnitude * radius)
    if (speed + 1e-6 < requiredSpeed) {
      pushIssue({
        level: 'error',
        code: 'vertical_circle_speed_insufficient',
        message: `${joint.id} initial speed ${speed.toFixed(3)}m/s is below required ${requiredSpeed.toFixed(3)}m/s`,
        path: `$.bodies[${movingBody.id}].initialVelocity`,
      })
    }
  }
}

function getBodyMinContactY(body: SceneBody): number | null {
  let descriptor: ReturnType<typeof getBodyDescriptor>
  try {
    descriptor = getBodyDescriptor(body.type)
  } catch {
    return null
  }

  const surfaces = descriptor.getSnapSurfaces?.(body)
  if (!surfaces || surfaces.length === 0) return null
  let minY = Number.POSITIVE_INFINITY
  let foundContact = false
  for (const surface of surfaces) {
    if (surface.type !== 'contact') continue
    foundContact = true
    minY = Math.min(minY, surface.start.y, surface.end.y)
  }
  return foundContact ? minY : null
}

function compareValue(
  expected: unknown,
  actual: unknown,
  path: string,
  diffs: SceneDiffEntry[],
  numberTolerance: number,
  maxDiffs: number,
): void {
  if (diffs.length >= maxDiffs) return

  if (typeof expected === 'number' && typeof actual === 'number') {
    if (Number.isNaN(expected) && Number.isNaN(actual)) return
    if (Math.abs(expected - actual) > numberTolerance) {
      diffs.push({ path, expected, actual })
    }
    return
  }

  if (Array.isArray(expected) && Array.isArray(actual)) {
    if (expected.length !== actual.length) {
      diffs.push({ path: `${path}.length`, expected: expected.length, actual: actual.length })
      if (diffs.length >= maxDiffs) return
    }

    const compareLength = Math.min(expected.length, actual.length)
    for (let index = 0; index < compareLength; index += 1) {
      compareValue(
        expected[index],
        actual[index],
        `${path}[${index}]`,
        diffs,
        numberTolerance,
        maxDiffs,
      )
      if (diffs.length >= maxDiffs) return
    }
    return
  }

  if (isRecord(expected) && isRecord(actual)) {
    const keys = new Set([...Object.keys(expected), ...Object.keys(actual)])
    const sortedKeys = Array.from(keys).sort((left, right) => left.localeCompare(right))
    for (const key of sortedKeys) {
      if (!(key in actual)) {
        diffs.push({ path: `${path}.${key}`, expected: expected[key], actual: undefined })
        if (diffs.length >= maxDiffs) return
        continue
      }
      if (!(key in expected)) {
        diffs.push({ path: `${path}.${key}`, expected: undefined, actual: actual[key] })
        if (diffs.length >= maxDiffs) return
        continue
      }

      compareValue(
        expected[key],
        actual[key],
        `${path}.${key}`,
        diffs,
        numberTolerance,
        maxDiffs,
      )
      if (diffs.length >= maxDiffs) return
    }
    return
  }

  if (!Object.is(expected, actual)) {
    diffs.push({ path, expected, actual })
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringifyDiffValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null || value === undefined) {
    return String(value)
  }

  try {
    return JSON.stringify(value)
  } catch {
    return Object.prototype.toString.call(value)
  }
}

function localToWorld(local: Vec2, bodyPosition: Vec2, bodyAngle: number): Vec2 {
  const cos = Math.cos(bodyAngle)
  const sin = Math.sin(bodyAngle)
  return {
    x: bodyPosition.x + local.x * cos - local.y * sin,
    y: bodyPosition.y + local.x * sin + local.y * cos,
  }
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}
