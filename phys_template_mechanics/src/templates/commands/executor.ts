import '@/models/bodyTypes'
import '@/models/jointTypes'
import '@/models/forceTypes'

import { computeSnap } from '@/core/snap/SnapEngine'
import { getBodyDescriptor } from '@/models/bodyTypes'
import { createGround } from '@/models/defaults'
import { getForceDescriptor } from '@/models/forceTypes'
import { getJointDescriptor } from '@/models/jointTypes'
import type { Scene, SceneBody, SceneForce, SceneJoint } from '@/models/types'
import type {
  AddBodyCommand,
  AddForceCommand,
  AddJointCommand,
  PatchBodyCommand,
  PatchForceCommand,
  PatchJointCommand,
  SnapToCommand,
  TemplateCommand,
  TemplateCommandProgram,
  TemplateCommandRefs,
  Vec2,
} from './schema'

interface ExecuteResult {
  scene: Scene
  refs: TemplateCommandRefs
}

interface MutableRefs {
  bodyIds: Map<string, string>
  jointIds: Map<string, string>
  forceIds: Map<string, string>
}

const DEFAULT_SCENE_ID_PREFIX = 'template-scene'

export class TemplateCommandExecutionError extends Error {
  constructor(
    program: TemplateCommandProgram,
    commandIndex: number,
    command: TemplateCommand,
    detail: string,
  ) {
    super(
      `Template command failed (${program.templateId} @ ${commandIndex + 1}/${program.commands.length}, ${command.kind}): ${detail}`,
    )
    this.name = 'TemplateCommandExecutionError'
  }
}

export function executeTemplateCommandProgram(program: TemplateCommandProgram): Scene {
  return executeTemplateCommandProgramWithRefs(program).scene
}

export function executeTemplateCommandProgramWithRefs(program: TemplateCommandProgram): ExecuteResult {
  const scene = createBaseScene(program)
  const refs: MutableRefs = {
    bodyIds: new Map<string, string>([['ground', 'ground']]),
    jointIds: new Map<string, string>(),
    forceIds: new Map<string, string>(),
  }

  program.commands.forEach((command, index) => {
    try {
      executeSingleCommand(scene, refs, command)
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw new TemplateCommandExecutionError(program, index, command, detail)
    }
  })

  return {
    scene: cloneScene(scene),
    refs: {
      bodyIds: Object.fromEntries(refs.bodyIds),
      jointIds: Object.fromEntries(refs.jointIds),
      forceIds: Object.fromEntries(refs.forceIds),
    },
  }
}

function executeSingleCommand(scene: Scene, refs: MutableRefs, command: TemplateCommand): void {
  switch (command.kind) {
    case 'setGravity':
      scene.settings.gravity = { ...command.gravity }
      return
    case 'addBody':
      addBody(scene, refs, command)
      return
    case 'patchBody':
      patchBody(scene, refs, command)
      return
    case 'snapTo':
      snapBody(scene, refs, command)
      return
    case 'addJoint':
      addJoint(scene, refs, command)
      return
    case 'patchJoint':
      patchJoint(scene, refs, command)
      return
    case 'addForce':
      addForce(scene, refs, command)
      return
    case 'patchForce':
      patchForce(scene, refs, command)
      return
    default:
      assertNever(command)
  }
}

function createBaseScene(program: TemplateCommandProgram): Scene {
  return {
    id: `${DEFAULT_SCENE_ID_PREFIX}-${normalizeRefToken(program.templateId)}`,
    name: program.sceneName,
    bodies: [createGround()],
    joints: [],
    forces: [],
    settings: {
      gravity: { x: 0, y: -10 },
    },
  }
}

function addBody(scene: Scene, refs: MutableRefs, command: AddBodyCommand): void {
  assertUniqueRef(refs.bodyIds, command.ref, 'body')

  const descriptor = getBodyDescriptor(command.bodyType)
  if (!descriptor) {
    throw new Error(`unknown body type: ${command.bodyType}`)
  }

  const id = `body-${normalizeRefToken(command.ref)}`
  const baseBody: SceneBody = {
    id,
    type: command.bodyType,
    label: command.label ?? createBodyLabel(command.bodyType, scene.bodies),
    position: { x: 0, y: 0 },
    angle: 0,
    isStatic: false,
    fixedRotation: false,
    mass: 1,
    friction: 0.3,
    restitution: 0,
    initialVelocity: { x: 0, y: 0 },
    initialAcceleration: { x: 0, y: 0 },
    ...descriptor.defaults,
  }

  const body = applyBodyPatch(baseBody, command.patch)
  scene.bodies.push(body)
  refs.bodyIds.set(command.ref, body.id)
}

function patchBody(scene: Scene, refs: MutableRefs, command: PatchBodyCommand): void {
  const bodyId = resolveBodyRef(refs, command.bodyRef)
  const body = scene.bodies.find((item) => item.id === bodyId)
  if (!body) {
    throw new Error(`body not found for ref: ${command.bodyRef}`)
  }

  const patched = applyBodyPatch(body, command.patch)
  Object.assign(body, patched)
}

function snapBody(scene: Scene, refs: MutableRefs, command: SnapToCommand): void {
  const bodyId = resolveBodyRef(refs, command.bodyRef)
  const body = scene.bodies.find((item) => item.id === bodyId)
  if (!body) {
    throw new Error(`body not found for ref: ${command.bodyRef}`)
  }

  let bodiesForSnap = scene.bodies
  if (command.targetBodyRefs && command.targetBodyRefs.length > 0) {
    const targetIds = new Set<string>([body.id])
    command.targetBodyRefs.forEach((ref) => {
      targetIds.add(resolveBodyRef(refs, ref))
    })
    bodiesForSnap = scene.bodies.filter((item) => targetIds.has(item.id))
  }

  const snapResult = computeSnap(body, bodiesForSnap, false, command.threshold)
  if (!snapResult) {
    if (command.allowNoSnap) return
    throw new Error(`snap target not found for body ref: ${command.bodyRef}`)
  }

  body.position = { ...snapResult.position }
  body.angle = snapResult.angle
}

function addJoint(scene: Scene, refs: MutableRefs, command: AddJointCommand): void {
  assertUniqueRef(refs.jointIds, command.ref, 'joint')

  const descriptor = getJointDescriptor(command.jointType)
  if (!descriptor) {
    throw new Error(`unknown joint type: ${command.jointType}`)
  }

  const bodyIdA = resolveBodyRef(refs, command.bodyRefA)
  const bodyIdB = resolveBodyRef(refs, command.bodyRefB)
  const bodyA = findBody(scene, bodyIdA)
  const bodyB = findBody(scene, bodyIdB)

  const id = `joint-${normalizeRefToken(command.ref)}`
  const joint: SceneJoint = {
    id,
    type: command.jointType,
    label: command.label ?? descriptor.label,
    bodyIdA,
    bodyIdB,
    anchorA: command.anchorA ? { ...command.anchorA } : { x: 0, y: 0 },
    anchorB: command.anchorB ? { ...command.anchorB } : { x: 0, y: 0 },
    ...descriptor.defaults,
  }

  if (command.pulleyMountRef) {
    joint.pulleyMountId = resolveBodyRef(refs, command.pulleyMountRef)
  }

  applyJointDerivedDefaults(joint, bodyA, bodyB, scene, command)

  if (command.patch) {
    const patched = applyJointPatch(joint, command.patch)
    Object.assign(joint, patched)
  }

  scene.joints.push(joint)
  refs.jointIds.set(command.ref, joint.id)
}

function patchJoint(scene: Scene, refs: MutableRefs, command: PatchJointCommand): void {
  const jointId = resolveJointRef(refs, command.jointRef)
  const joint = scene.joints.find((item) => item.id === jointId)
  if (!joint) {
    throw new Error(`joint not found for ref: ${command.jointRef}`)
  }

  const patched = applyJointPatch(joint, command.patch)
  Object.assign(joint, patched)
}

function addForce(scene: Scene, refs: MutableRefs, command: AddForceCommand): void {
  assertUniqueRef(refs.forceIds, command.ref, 'force')

  const forceType = command.forceType ?? 'external'
  const descriptor = getForceDescriptor(forceType)
  if (!descriptor) {
    throw new Error(`unknown force type: ${forceType}`)
  }

  const targetBodyId = resolveBodyRef(refs, command.targetBodyRef)
  const id = `force-${normalizeRefToken(command.ref)}`
  const force: SceneForce = {
    id,
    type: forceType,
    targetBodyId,
    label: command.label ?? createForceLabel(scene.forces, targetBodyId),
    magnitude: 10,
    direction: 0,
    visible: true,
    decompose: false,
    decomposeAngle: 0,
    ...descriptor.defaults,
  }

  const patched = applyForcePatch(force, command.patch)
  scene.forces.push(patched)
  refs.forceIds.set(command.ref, id)
}

function patchForce(scene: Scene, refs: MutableRefs, command: PatchForceCommand): void {
  const forceId = resolveForceRef(refs, command.forceRef)
  const force = scene.forces.find((item) => item.id === forceId)
  if (!force) {
    throw new Error(`force not found for ref: ${command.forceRef}`)
  }

  const patched = applyForcePatch(force, command.patch)
  Object.assign(force, patched)
}

function applyBodyPatch(body: SceneBody, patch?: Partial<Omit<SceneBody, 'id' | 'type'>>): SceneBody {
  if (!patch) {
    return cloneBody(body)
  }

  return {
    ...body,
    ...patch,
    position: patch.position ? { ...patch.position } : { ...body.position },
    initialVelocity: patch.initialVelocity
      ? { ...patch.initialVelocity }
      : { ...body.initialVelocity },
    initialAcceleration: patch.initialAcceleration
      ? { ...patch.initialAcceleration }
      : { ...body.initialAcceleration },
  }
}

function applyJointPatch(
  joint: SceneJoint,
  patch?: Partial<Omit<SceneJoint, 'id' | 'type' | 'bodyIdA' | 'bodyIdB'>>,
): SceneJoint {
  if (!patch) {
    return cloneJoint(joint)
  }

  return {
    ...joint,
    ...patch,
    anchorA: patch.anchorA ? { ...patch.anchorA } : { ...joint.anchorA },
    anchorB: patch.anchorB ? { ...patch.anchorB } : { ...joint.anchorB },
  }
}

function applyForcePatch(
  force: SceneForce,
  patch?: Partial<Omit<SceneForce, 'id' | 'type' | 'targetBodyId'>>,
): SceneForce {
  if (!patch) {
    return { ...force }
  }
  return {
    ...force,
    ...patch,
  }
}

function applyJointDerivedDefaults(
  joint: SceneJoint,
  bodyA: SceneBody,
  bodyB: SceneBody,
  scene: Scene,
  command: AddJointCommand,
): void {
  const patch = command.patch
  const worldAnchorA = localToWorld(joint.anchorA, bodyA.position, bodyA.angle)
  const worldAnchorB = localToWorld(joint.anchorB, bodyB.position, bodyB.angle)
  const anchorDistance = distance(worldAnchorA, worldAnchorB)

  if (joint.type === 'rope' && !hasOwn(patch, 'maxLength')) {
    joint.maxLength = anchorDistance
  }

  if (joint.type === 'rod' && !hasOwn(patch, 'length')) {
    joint.length = anchorDistance
  }

  if (joint.type === 'spring' && !hasOwn(patch, 'springLength')) {
    joint.springLength = anchorDistance
  }

  if (joint.type !== 'pulley') return

  const mountBody = joint.pulleyMountId ? findBody(scene, joint.pulleyMountId) : null
  const mountCenter = mountBody?.position
  const mountRadius = mountBody?.pulleyRadius ?? 0.15

  if (!hasOwn(patch, 'ratio')) {
    joint.ratio = 1
  }

  if (!hasOwn(patch, 'totalLength')) {
    if (mountCenter) {
      const topY = mountCenter.y + mountRadius
      const topX = mountCenter.x
      const aLength = Math.hypot(worldAnchorA.x - topX, worldAnchorA.y - topY)
      const bLength = Math.hypot(worldAnchorB.x - topX, worldAnchorB.y - topY)
      joint.totalLength = aLength + bLength
    } else {
      joint.totalLength = anchorDistance
    }
  }

  if (!hasOwn(patch, 'sideA')) {
    if (mountCenter) {
      if (worldAnchorA.x < worldAnchorB.x) joint.sideA = 'left'
      else if (worldAnchorA.x > worldAnchorB.x) joint.sideA = 'right'
      else joint.sideA = worldAnchorA.x <= mountCenter.x ? 'left' : 'right'
    } else {
      joint.sideA = worldAnchorA.x <= worldAnchorB.x ? 'left' : 'right'
    }
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

function cloneScene(scene: Scene): Scene {
  return {
    ...scene,
    settings: {
      ...scene.settings,
      gravity: { ...scene.settings.gravity },
    },
    bodies: scene.bodies.map((body) => cloneBody(body)),
    joints: scene.joints.map((joint) => cloneJoint(joint)),
    forces: scene.forces.map((force) => ({ ...force })),
  }
}

function cloneBody(body: SceneBody): SceneBody {
  return {
    ...body,
    position: { ...body.position },
    initialVelocity: { ...body.initialVelocity },
    initialAcceleration: { ...body.initialAcceleration },
  }
}

function cloneJoint(joint: SceneJoint): SceneJoint {
  return {
    ...joint,
    anchorA: { ...joint.anchorA },
    anchorB: { ...joint.anchorB },
  }
}

function resolveBodyRef(refs: MutableRefs, ref: string): string {
  const bodyId = refs.bodyIds.get(ref)
  if (!bodyId) {
    throw new Error(`unknown body ref: ${ref}`)
  }
  return bodyId
}

function resolveJointRef(refs: MutableRefs, ref: string): string {
  const jointId = refs.jointIds.get(ref)
  if (!jointId) {
    throw new Error(`unknown joint ref: ${ref}`)
  }
  return jointId
}

function resolveForceRef(refs: MutableRefs, ref: string): string {
  const forceId = refs.forceIds.get(ref)
  if (!forceId) {
    throw new Error(`unknown force ref: ${ref}`)
  }
  return forceId
}

function findBody(scene: Scene, id: string): SceneBody {
  const body = scene.bodies.find((item) => item.id === id)
  if (!body) {
    throw new Error(`body not found: ${id}`)
  }
  return body
}

function assertUniqueRef(map: Map<string, string>, ref: string, kind: string): void {
  if (ref === 'ground') {
    throw new Error(`ref "ground" is reserved for built-in body`)
  }
  if (map.has(ref)) {
    throw new Error(`duplicate ${kind} ref: ${ref}`)
  }
}

function createBodyLabel(type: SceneBody['type'], bodies: SceneBody[]): string {
  const descriptor = getBodyDescriptor(type)
  const prefix = descriptor?.label ?? type
  const count = bodies.filter((item) => item.type === type).length + 1
  return `${prefix} #${count}`
}

function createForceLabel(forces: SceneForce[], targetBodyId: string): string {
  const existing = forces.filter((item) => item.targetBodyId === targetBodyId)
  const indices = existing
    .map((item) => {
      const match = item.label.match(/^F(\d+)$/)
      return match ? Number.parseInt(match[1], 10) : 0
    })
    .filter((item) => Number.isFinite(item) && item > 0)

  const nextIndex = indices.length === 0 ? 1 : Math.max(...indices) + 1
  return `F${nextIndex}`
}

function hasOwn<T extends object, K extends PropertyKey>(obj: T | undefined, key: K): boolean {
  if (!obj) return false
  return Object.prototype.hasOwnProperty.call(obj, key)
}

function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function normalizeRefToken(ref: string): string {
  const normalized = ref
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'item'
}

function assertNever(value: never): never {
  throw new Error(`unhandled command: ${JSON.stringify(value)}`)
}
