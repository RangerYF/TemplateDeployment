import type { Scene } from '@/models/types'
import type { AnalysisGroup } from '@/store/analysisStore'
import type { CoordinateAxesConfig } from '@/store/editorStore'
import type { PropertyPanelTab } from '@/store/propertyPanelStore'
import type { TemplateModule } from '@/templates'

export const TEMPLATE_BRIDGE_VERSION = '1.0.0'
export const TEMPLATE_RUNTIME_KEY = 'phys-template-mechanics'
export const TEMPLATE_SNAPSHOT_SCHEMA_VERSION = 1

export interface TemplateSnapshotEnvelope {
  templateKey: string
  runtimeKey: string
  bridgeVersion: string
  snapshotSchemaVersion: number
  createdAt: string
  updatedAt: string
}

export interface TemplateSnapshotViewport {
  offset: { x: number; y: number }
  scale: number
}

export interface TemplateSnapshotUi {
  coordinateAxes: CoordinateAxesConfig
  propertyPanelTab: PropertyPanelTab
  viewport: TemplateSnapshotViewport
}

export interface TemplateSnapshotAnalysis {
  activeTabs: string[]
  activeDataSourceIds: string[]
  analysisGroups: AnalysisGroup[]
}

export interface ModuleSceneSnapshotDraft {
  scene: Scene
  ui: TemplateSnapshotUi
  analysis: TemplateSnapshotAnalysis
}

export interface TemplateSnapshotPayload {
  moduleId: TemplateModule
  currentView: 'overview' | 'scene'
  activeSceneId: string | null
  sceneDrafts: Record<string, ModuleSceneSnapshotDraft>
}

export interface TemplateSnapshotDocument {
  envelope: TemplateSnapshotEnvelope
  payload: TemplateSnapshotPayload
}

export interface SnapshotValidationResult {
  ok: boolean
  errors: string[]
}

export interface TemplateBridge {
  getDefaultSnapshot: () => TemplateSnapshotDocument
  getSnapshot: () => TemplateSnapshotDocument
  loadSnapshot: (snapshot: unknown) => SnapshotValidationResult
  validateSnapshot: (snapshot: unknown) => SnapshotValidationResult
}
