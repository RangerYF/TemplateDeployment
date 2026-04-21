import type { AnalysisGroup } from '@/store/analysisStore'
import { useAnalysisStore } from '@/store/analysisStore'
import { useCommandStore } from '@/store/commandStore'
import { cloneScene } from '@/models/sceneUtils'
import type { ModuleSceneSnapshotDraft } from '@/templates/snapshot'
import { DEFAULT_COORDINATE_AXES, useEditorStore, type CoordinateAxesConfig } from '@/store/editorStore'
import { useForceDisplayStore } from '@/store/forceDisplayStore'
import { usePlaybackControlStore } from '@/store/playbackControlStore'
import { DEFAULT_PROPERTY_PANEL_TAB, usePropertyPanelStore, type PropertyPanelTab } from '@/store/propertyPanelStore'
import { useSceneStore } from '@/store/sceneStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useToolStore } from '@/store/toolStore'
import { DEFAULT_VIEWPORT_SNAPSHOT, useViewportStore } from '@/store/viewportStore'

export const DEFAULT_ANALYSIS_SNAPSHOT = {
  activeTabs: ['v-t'],
  activeDataSourceIds: [] as string[],
  analysisGroups: [] as AnalysisGroup[],
}

const SCENE_ANALYSIS_PRESETS: Record<string, { activeTabs: string[]; activeDataSourceIds: string[] }> = {
  'MOM-001': {
    activeTabs: ['vx-t', 'p-bar'],
    activeDataSourceIds: ['body-ball-left', 'body-ball-right'],
  },
  'MOM-003': {
    activeTabs: ['vx-t', 'p-t'],
    activeDataSourceIds: ['body-ball-left', 'body-ball-right'],
  },
  'MOM-011': {
    activeTabs: ['vx-t', 'x-t'],
    activeDataSourceIds: ['body-block-main', 'body-slope-main'],
  },
  'MOM-013': {
    activeTabs: ['vx-t', 'x-t'],
    activeDataSourceIds: ['body-block-a', 'body-block-b'],
  },
  'MOM-031': {
    activeTabs: ['vx-t', 'x-t'],
    activeDataSourceIds: ['body-person-main', 'body-boat-main'],
  },
  'MOT-031': {
    activeTabs: ['vx-t', 'vy-t'],
    activeDataSourceIds: ['body-ball-main'],
  },
  'MOT-035': {
    activeTabs: ['vx-t', 'vy-t'],
    activeDataSourceIds: ['body-ball-main'],
  },
  'MOT-012': {
    activeTabs: ['vxy-t', 'x-t'],
    activeDataSourceIds: ['body-block-main'],
  },
  'MOT-002': {
    activeTabs: ['v-t', 'a-t'],
    activeDataSourceIds: ['body-cart-acc'],
  },
  'MOT-034': {
    activeTabs: ['vx-t', 'x-t'],
    activeDataSourceIds: ['body-board-main', 'body-block-top'],
  },
  'SHM-001': {
    activeTabs: ['x-t', 'v-t'],
    activeDataSourceIds: ['body-mass-block'],
  },
  'SHM-002': {
    activeTabs: ['x-t', 'v-t'],
    activeDataSourceIds: ['body-mass-block'],
  },
  'SHM-003': {
    activeTabs: ['v-t', 'x-t'],
    activeDataSourceIds: ['body-bob-ball'],
  },
}

const SCENE_UI_PRESETS: Record<string, {
  propertyPanelTab?: PropertyPanelTab
  coordinateAxes?: CoordinateAxesConfig
}> = {
  'FM-041': {
    propertyPanelTab: 'props',
  },
  'FM-042': {
    propertyPanelTab: 'forces',
  },
  'MOT-031': {
    coordinateAxes: {
      ...DEFAULT_COORDINATE_AXES,
      origin: { x: 0, y: 0 },
      originType: 'world',
      originLabel: '世界原点',
      mode: 'both',
      showTicks: true,
      showDisplacementLabels: false,
    },
  },
  'MOT-035': {
    coordinateAxes: {
      ...DEFAULT_COORDINATE_AXES,
      origin: { x: 0, y: 0 },
      originType: 'world',
      originLabel: '世界原点',
      mode: 'both',
      showTicks: true,
      showDisplacementLabels: false,
    },
  },
  'MOT-012': {
    coordinateAxes: {
      ...DEFAULT_COORDINATE_AXES,
      origin: { x: 0, y: 0 },
      originType: 'world',
      originLabel: '世界原点',
      mode: 'both',
      showTicks: true,
      showDisplacementLabels: false,
    },
  },
  'MOT-034': {
    coordinateAxes: {
      ...DEFAULT_COORDINATE_AXES,
      origin: { x: 0, y: 0 },
      originType: 'world',
      originLabel: '世界原点',
      mode: 'both',
      showTicks: true,
      showDisplacementLabels: true,
    },
  },
}

const SCENE_SELECTION_PRESETS: Record<string, string> = {
  'FM-041': 'body-slider-main',
  'FM-042': 'body-bob-ball',
  'MOT-012': 'body-block-main',
  'MOT-002': 'body-cart-acc',
  'MOT-034': 'body-block-top',
  'SHM-001': 'body-mass-block',
  'SHM-002': 'body-mass-block',
  'SHM-003': 'body-bob-ball',
}

function cloneCoordinateAxes(config: CoordinateAxesConfig): CoordinateAxesConfig {
  return {
    ...config,
    origin: { ...config.origin },
  }
}

function getDefaultUiSnapshot(sceneId?: string) {
  const preset = sceneId ? SCENE_UI_PRESETS[sceneId] : undefined
  return {
    propertyPanelTab: preset?.propertyPanelTab ?? DEFAULT_PROPERTY_PANEL_TAB,
    coordinateAxes: cloneCoordinateAxes(preset?.coordinateAxes ?? DEFAULT_COORDINATE_AXES),
  }
}

function getDefaultAnalysisSnapshot(sceneId?: string) {
  const preset = sceneId ? SCENE_ANALYSIS_PRESETS[sceneId] : undefined
  return {
    activeTabs: preset ? [...preset.activeTabs] : [...DEFAULT_ANALYSIS_SNAPSHOT.activeTabs],
    activeDataSourceIds: preset ? [...preset.activeDataSourceIds] : [],
    analysisGroups: [] as AnalysisGroup[],
  }
}

export function createDefaultSceneDraft(
  scene: Parameters<typeof cloneScene>[0],
  sceneId?: string,
): ModuleSceneSnapshotDraft {
  const analysisDefaults = getDefaultAnalysisSnapshot(sceneId)
  const uiDefaults = getDefaultUiSnapshot(sceneId)
  return {
    scene: cloneScene(scene),
    ui: {
      coordinateAxes: uiDefaults.coordinateAxes,
      propertyPanelTab: uiDefaults.propertyPanelTab,
      viewport: {
        offset: { ...DEFAULT_VIEWPORT_SNAPSHOT.offset },
        scale: DEFAULT_VIEWPORT_SNAPSHOT.scale,
      },
    },
    analysis: {
      activeTabs: [...analysisDefaults.activeTabs],
      activeDataSourceIds: [...analysisDefaults.activeDataSourceIds],
      analysisGroups: [],
    },
  }
}

export function getDefaultSelectedBodyId(sceneId?: string): string | undefined {
  if (!sceneId) return undefined
  return SCENE_SELECTION_PRESETS[sceneId]
}

export function readRuntimeSceneDraft(): ModuleSceneSnapshotDraft {
  const scene = useSceneStore.getState().scene
  const editorState = useEditorStore.getState()
  const propertyPanelState = usePropertyPanelStore.getState()
  const viewportState = useViewportStore.getState()
  const analysisState = useAnalysisStore.getState()

  return {
    scene: cloneScene(scene),
    ui: {
      coordinateAxes: {
        ...editorState.coordinateAxes,
        origin: { ...editorState.coordinateAxes.origin },
      },
      propertyPanelTab: propertyPanelState.activeTab,
      viewport: {
        offset: { ...viewportState.offset },
        scale: viewportState.scale,
      },
    },
    analysis: {
      activeTabs: [...analysisState.activeTabs],
      activeDataSourceIds: [...analysisState.activeDataSourceIds],
      analysisGroups: analysisState.analysisGroups.map((group) => ({
        ...group,
        bodyIds: [...group.bodyIds],
      })),
    },
  }
}

export function resetTemplateEditorTransientState(): void {
  useEditorStore.getState().stop()
  useEditorStore.getState().resetCoordinateAxes()
  useViewportStore.getState().resetView()
  useToolStore.getState().setTool('select')
  useAnalysisStore.getState().resetForScene()
  useAnalysisStore.setState({
    activeTabs: [...DEFAULT_ANALYSIS_SNAPSHOT.activeTabs],
    activeDataSourceIds: new Set<string>(),
    analysisGroups: [],
  })
  useForceDisplayStore.getState().resetDisplay()
  usePlaybackControlStore.getState().resetTimeline()
  useSelectionStore.getState().clearSelection()
  useCommandStore.getState().clear()
  usePropertyPanelStore.getState().setActiveTab(DEFAULT_PROPERTY_PANEL_TAB)
}

export function loadRuntimeSceneDraft(draft: ModuleSceneSnapshotDraft): void {
  resetTemplateEditorTransientState()
  useSceneStore.getState().replaceScene(draft.scene)
  useEditorStore.getState().setCoordinateAxes(draft.ui.coordinateAxes)
  usePropertyPanelStore.getState().setActiveTab(draft.ui.propertyPanelTab)
  useViewportStore.getState().setViewSnapshot(draft.ui.viewport)
  useAnalysisStore.setState({
    activeTabs: [...draft.analysis.activeTabs],
    activeDataSourceIds: new Set(draft.analysis.activeDataSourceIds),
    analysisGroups: draft.analysis.analysisGroups.map((group) => ({
      ...group,
      bodyIds: [...group.bodyIds],
    })),
  })
}
