import { create } from 'zustand'
import { cloneScene } from '@/models/sceneUtils'
import type { TemplateSnapshotAnalysis, TemplateSnapshotUi } from '@/templates/snapshot'
import type { Scene } from '@/models/types'
import type { TemplateModule } from '@/templates'

export interface ModuleSceneDraft {
  scene: Scene
  ui: TemplateSnapshotUi
  analysis: TemplateSnapshotAnalysis
}

interface ModuleWorkspaceState {
  moduleId: TemplateModule | null
  currentView: 'overview' | 'scene'
  activeSceneId: string | null
  sceneDrafts: Record<string, ModuleSceneDraft>
  skipNextScenePersist: boolean
}

interface ModuleWorkspaceActions {
  initializeModule: (moduleId: TemplateModule) => void
  setCurrentView: (view: 'overview' | 'scene') => void
  setActiveScene: (sceneId: string | null) => void
  upsertSceneDraft: (sceneId: string, draft: ModuleSceneDraft) => void
  armSkipNextScenePersist: () => void
  consumeSkipNextScenePersist: () => boolean
  replaceWorkspace: (input: {
    moduleId: TemplateModule
    currentView: 'overview' | 'scene'
    activeSceneId: string | null
    sceneDrafts: Record<string, ModuleSceneDraft>
  }) => void
  clearWorkspace: () => void
}

function cloneDraft(draft: ModuleSceneDraft): ModuleSceneDraft {
  return {
    scene: cloneScene(draft.scene),
    ui: {
      coordinateAxes: {
        ...draft.ui.coordinateAxes,
        origin: { ...draft.ui.coordinateAxes.origin },
      },
      propertyPanelTab: draft.ui.propertyPanelTab,
      viewport: {
        offset: { ...draft.ui.viewport.offset },
        scale: draft.ui.viewport.scale,
      },
    },
    analysis: {
      activeTabs: [...draft.analysis.activeTabs],
      activeDataSourceIds: [...draft.analysis.activeDataSourceIds],
      analysisGroups: draft.analysis.analysisGroups.map((group) => ({
        ...group,
        bodyIds: [...group.bodyIds],
      })),
    },
  }
}

function cloneDraftMap(drafts: Record<string, ModuleSceneDraft>): Record<string, ModuleSceneDraft> {
  return Object.fromEntries(
    Object.entries(drafts).map(([sceneId, draft]) => [sceneId, cloneDraft(draft)]),
  )
}

export const useModuleWorkspaceStore = create<ModuleWorkspaceState & ModuleWorkspaceActions>()((set) => ({
  moduleId: null,
  currentView: 'overview',
  activeSceneId: null,
  sceneDrafts: {},
  skipNextScenePersist: false,

  initializeModule: (moduleId) =>
    set((state) => {
      if (state.moduleId === moduleId) return state
      return {
        moduleId,
        currentView: 'overview',
        activeSceneId: null,
        sceneDrafts: {},
        skipNextScenePersist: false,
      }
    }),

  setCurrentView: (view) => set({ currentView: view }),

  setActiveScene: (sceneId) => set({ activeSceneId: sceneId }),

  upsertSceneDraft: (sceneId, draft) =>
    set((state) => ({
      sceneDrafts: {
        ...state.sceneDrafts,
        [sceneId]: cloneDraft(draft),
      },
    })),

  armSkipNextScenePersist: () => set({ skipNextScenePersist: true }),

  consumeSkipNextScenePersist: () => {
    const { skipNextScenePersist } = useModuleWorkspaceStore.getState()
    if (skipNextScenePersist) {
      set({ skipNextScenePersist: false })
      return true
    }
    return false
  },

  replaceWorkspace: ({ moduleId, currentView, activeSceneId, sceneDrafts }) =>
    set({
      moduleId,
      currentView,
      activeSceneId,
      sceneDrafts: cloneDraftMap(sceneDrafts),
      skipNextScenePersist: false,
    }),

  clearWorkspace: () =>
    set({
      moduleId: null,
      currentView: 'overview',
      activeSceneId: null,
      sceneDrafts: {},
      skipNextScenePersist: false,
    }),
}))
