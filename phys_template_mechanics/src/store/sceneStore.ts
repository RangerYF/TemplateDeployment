import { create } from 'zustand'
import type { Scene, SceneBody, SceneJoint, SceneForce } from '@/models/types'
import { createGround } from '@/models/defaults'
import { cloneScene } from '@/models/sceneUtils'

function createDefaultScene(): Scene {
  return {
    id: 'default-scene',
    name: '默认场景',
    bodies: [createGround()],
    joints: [],
    forces: [],
    settings: {
      gravity: { x: 0, y: -10 },
    },
  }
}

interface SceneState {
  scene: Scene
}

interface SceneActions {
  addBody: (body: SceneBody) => void
  removeBody: (id: string) => void
  updateBody: (id: string, partial: Partial<SceneBody>) => void
  moveBody: (id: string, position: { x: number; y: number }) => void
  setGravity: (gravity: { x: number; y: number }) => void
  addJoint: (joint: SceneJoint) => void
  removeJoint: (id: string) => void
  updateJoint: (id: string, partial: Partial<SceneJoint>) => void
  addForce: (force: SceneForce) => void
  removeForce: (id: string) => void
  updateForce: (id: string, partial: Partial<SceneForce>) => void
  replaceScene: (scene: Scene) => void
  resetScene: () => void
}

export const useSceneStore = create<SceneState & SceneActions>()((set) => ({
  scene: createDefaultScene(),

  addBody: (body) =>
    set((state) => ({
      scene: {
        ...state.scene,
        bodies: [...state.scene.bodies, body],
      },
    })),

  removeBody: (id) =>
    set((state) => ({
      scene: {
        ...state.scene,
        bodies: state.scene.bodies.filter((b) => b.id !== id),
      },
    })),

  updateBody: (id, partial) =>
    set((state) => ({
      scene: {
        ...state.scene,
        bodies: state.scene.bodies.map((b) =>
          b.id === id ? { ...b, ...partial } : b,
        ),
      },
    })),

  moveBody: (id, position) =>
    set((state) => ({
      scene: {
        ...state.scene,
        bodies: state.scene.bodies.map((b) =>
          b.id === id ? { ...b, position } : b,
        ),
      },
    })),

  setGravity: (gravity) =>
    set((state) => ({
      scene: {
        ...state.scene,
        settings: {
          ...state.scene.settings,
          gravity,
        },
      },
    })),

  addJoint: (joint) =>
    set((state) => ({
      scene: {
        ...state.scene,
        joints: [...state.scene.joints, joint],
      },
    })),

  removeJoint: (id) =>
    set((state) => ({
      scene: {
        ...state.scene,
        joints: state.scene.joints.filter((j) => j.id !== id),
      },
    })),

  updateJoint: (id, partial) =>
    set((state) => ({
      scene: {
        ...state.scene,
        joints: state.scene.joints.map((j) =>
          j.id === id ? { ...j, ...partial } : j,
        ),
      },
    })),

  addForce: (force) =>
    set((state) => ({
      scene: {
        ...state.scene,
        forces: [...state.scene.forces, force],
      },
    })),

  removeForce: (id) =>
    set((state) => ({
      scene: {
        ...state.scene,
        forces: state.scene.forces.filter((f) => f.id !== id),
      },
    })),

  updateForce: (id, partial) =>
    set((state) => ({
      scene: {
        ...state.scene,
        forces: state.scene.forces.map((f) =>
          f.id === id ? { ...f, ...partial } : f,
        ),
      },
    })),

  replaceScene: (scene) =>
    set({
      scene: cloneScene(scene),
    }),

  resetScene: () =>
    set({ scene: createDefaultScene() }),
}))
