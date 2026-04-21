import type { Command } from './Command'
import type { SceneBody, SceneForce, SceneJoint } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'
import { useAnalysisStore } from '@/store/analysisStore'

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

function cloneForce(force: SceneForce): SceneForce {
  return { ...force }
}

export class RemoveBodyCommand implements Command {
  description: string
  private body: SceneBody
  private relatedJoints: SceneJoint[]
  private relatedForces: SceneForce[]

  constructor(body: SceneBody) {
    this.body = cloneBody(body)
    const scene = useSceneStore.getState().scene
    this.relatedJoints = scene.joints
      .filter((joint) => joint.bodyIdA === body.id || joint.bodyIdB === body.id)
      .map(cloneJoint)
    this.relatedForces = scene.forces
      .filter((force) => force.targetBodyId === body.id)
      .map(cloneForce)
    this.description = `删除 ${body.label}`
  }

  execute(): void {
    const sceneStore = useSceneStore.getState()
    for (const joint of this.relatedJoints) {
      sceneStore.removeJoint(joint.id)
    }
    for (const force of this.relatedForces) {
      sceneStore.removeForce(force.id)
    }
    sceneStore.removeBody(this.body.id)
    useAnalysisStore.getState().removeBodyFromGroups(this.body.id)
  }

  undo(): void {
    const sceneStore = useSceneStore.getState()
    if (!sceneStore.scene.bodies.some((body) => body.id === this.body.id)) {
      sceneStore.addBody(cloneBody(this.body))
    }
    for (const joint of this.relatedJoints) {
      if (!sceneStore.scene.joints.some((item) => item.id === joint.id)) {
        sceneStore.addJoint(cloneJoint(joint))
      }
    }
    for (const force of this.relatedForces) {
      if (!sceneStore.scene.forces.some((item) => item.id === force.id)) {
        sceneStore.addForce(cloneForce(force))
      }
    }
  }
}
