import { cloneScene } from '@/models/sceneUtils'
import type { ModuleSceneDraft } from '@/store/moduleWorkspaceStore'
import { useModuleWorkspaceStore } from '@/store/moduleWorkspaceStore'
import { isScene } from '@/templates/sceneSchema'
import {
  TEMPLATE_BRIDGE_VERSION,
  TEMPLATE_RUNTIME_KEY,
  TEMPLATE_SNAPSHOT_SCHEMA_VERSION,
  type ModuleSceneSnapshotDraft,
  type SnapshotValidationResult,
  type TemplateBridge,
  type TemplateSnapshotAnalysis,
  type TemplateSnapshotDocument,
  type TemplateSnapshotUi,
} from '@/templates/snapshot'
import { buildModuleHash, buildModuleSceneHash } from '@/routes/hashRoutes'
import { loadRuntimeSceneDraft, readRuntimeSceneDraft } from '@/templates/editorRuntime'
import { TEMPLATE_MODULES, type TemplateModule } from '@/templates'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isTemplateModule(value: unknown): value is TemplateModule {
  return typeof value === 'string' && (TEMPLATE_MODULES as readonly string[]).includes(value)
}

function isIsoDateString(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function isCoordinateAxesConfig(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (value.mode !== 'off' && value.mode !== 'horizontal' && value.mode !== 'vertical' && value.mode !== 'both') {
    return false
  }
  if (value.originType !== 'world' && value.originType !== 'anchored') return false
  if (!isRecord(value.origin)) return false
  if (typeof value.origin.x !== 'number' || typeof value.origin.y !== 'number') return false
  if (value.originLabel !== undefined && typeof value.originLabel !== 'string') return false
  if (typeof value.showTicks !== 'boolean') return false
  if (typeof value.showDisplacementLabels !== 'boolean') return false
  return true
}

function isPropertyPanelTab(value: unknown): boolean {
  return value === 'props' || value === 'forces' || value === 'motion'
}

function isViewportSnapshot(value: unknown): boolean {
  if (!isRecord(value)) return false
  if (!isRecord(value.offset)) return false
  if (typeof value.offset.x !== 'number' || typeof value.offset.y !== 'number') return false
  if (typeof value.scale !== 'number') return false
  return true
}

function isAnalysisGroupArray(value: unknown): boolean {
  if (!Array.isArray(value)) return false
  return value.every((group) => (
    isRecord(group) &&
    typeof group.id === 'string' &&
    typeof group.name === 'string' &&
    typeof group.color === 'string' &&
    Array.isArray(group.bodyIds) &&
    group.bodyIds.every((id) => typeof id === 'string')
  ))
}

function cloneUi(input: TemplateSnapshotUi): TemplateSnapshotUi {
  return {
    coordinateAxes: {
      ...input.coordinateAxes,
      origin: { ...input.coordinateAxes.origin },
    },
    propertyPanelTab: input.propertyPanelTab,
    viewport: {
      offset: { ...input.viewport.offset },
      scale: input.viewport.scale,
    },
  }
}

function cloneAnalysis(input: TemplateSnapshotAnalysis): TemplateSnapshotAnalysis {
  return {
    activeTabs: [...input.activeTabs],
    activeDataSourceIds: [...input.activeDataSourceIds],
    analysisGroups: input.analysisGroups.map((group) => ({
      ...group,
      bodyIds: [...group.bodyIds],
    })),
  }
}

function cloneSceneDraft(input: ModuleSceneSnapshotDraft): ModuleSceneSnapshotDraft {
  return {
    scene: cloneScene(input.scene),
    ui: cloneUi(input.ui),
    analysis: cloneAnalysis(input.analysis),
  }
}

function cloneSceneDraftMap(input: Record<string, ModuleSceneSnapshotDraft>): Record<string, ModuleSceneSnapshotDraft> {
  return Object.fromEntries(
    Object.entries(input).map(([sceneId, draft]) => [sceneId, cloneSceneDraft(draft)]),
  )
}

function getWorkspaceOrThrow(): {
  moduleId: TemplateModule
  currentView: 'overview' | 'scene'
  activeSceneId: string | null
  sceneDrafts: Record<string, ModuleSceneSnapshotDraft>
} {
  const workspace = useModuleWorkspaceStore.getState()
  if (!workspace.moduleId) {
    throw new Error('当前模块工作区尚未就绪，无法导出或恢复 snapshot。')
  }
  return {
    moduleId: workspace.moduleId,
    currentView: workspace.currentView,
    activeSceneId: workspace.activeSceneId,
    sceneDrafts: cloneSceneDraftMap(workspace.sceneDrafts),
  }
}

function buildSnapshotDocument(input: {
  moduleId: TemplateModule
  currentView: 'overview' | 'scene'
  activeSceneId: string | null
  sceneDrafts: Record<string, ModuleSceneSnapshotDraft>
}): TemplateSnapshotDocument {
  const now = new Date().toISOString()
  return {
    envelope: {
      templateKey: input.moduleId,
      runtimeKey: TEMPLATE_RUNTIME_KEY,
      bridgeVersion: TEMPLATE_BRIDGE_VERSION,
      snapshotSchemaVersion: TEMPLATE_SNAPSHOT_SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    },
    payload: {
      moduleId: input.moduleId,
      currentView: input.currentView,
      activeSceneId: input.activeSceneId,
      sceneDrafts: cloneSceneDraftMap(input.sceneDrafts),
    },
  }
}

function captureWorkspaceForExport() {
  const workspace = getWorkspaceOrThrow()
  const sceneDrafts = cloneSceneDraftMap(workspace.sceneDrafts)

  if (
    workspace.currentView === 'scene' &&
    workspace.activeSceneId &&
    sceneDrafts[workspace.activeSceneId]
  ) {
    sceneDrafts[workspace.activeSceneId] = readRuntimeSceneDraft()
  }

  return {
    moduleId: workspace.moduleId,
    currentView: workspace.currentView,
    activeSceneId: workspace.activeSceneId,
    sceneDrafts,
  }
}

function parseSceneDraft(value: unknown, errors: string[], path: string): ModuleSceneSnapshotDraft | null {
  if (!isRecord(value)) {
    errors.push(`${path} 必须是对象。`)
    return null
  }
  if (!isScene(value.scene)) {
    errors.push(`${path}.scene 不是合法场景。`)
  }
  if (!isRecord(value.ui)) {
    errors.push(`${path}.ui 非法。`)
  }
  if (!isRecord(value.analysis)) {
    errors.push(`${path}.analysis 非法。`)
  }

  if (isRecord(value.ui)) {
    if (!isCoordinateAxesConfig(value.ui.coordinateAxes)) errors.push(`${path}.ui.coordinateAxes 非法。`)
    if (!isPropertyPanelTab(value.ui.propertyPanelTab)) errors.push(`${path}.ui.propertyPanelTab 非法。`)
    if (!isViewportSnapshot(value.ui.viewport)) errors.push(`${path}.ui.viewport 非法。`)
  }

  if (isRecord(value.analysis)) {
    if (!Array.isArray(value.analysis.activeTabs) || !value.analysis.activeTabs.every((tab) => typeof tab === 'string')) {
      errors.push(`${path}.analysis.activeTabs 非法。`)
    }
    if (
      !Array.isArray(value.analysis.activeDataSourceIds) ||
      !value.analysis.activeDataSourceIds.every((id) => typeof id === 'string')
    ) {
      errors.push(`${path}.analysis.activeDataSourceIds 非法。`)
    }
    if (!isAnalysisGroupArray(value.analysis.analysisGroups)) {
      errors.push(`${path}.analysis.analysisGroups 非法。`)
    }
  }

  if (errors.length > 0) return null
  return value as unknown as ModuleSceneSnapshotDraft
}

function parseSnapshot(snapshot: unknown, errors: string[]): TemplateSnapshotDocument | null {
  if (!isRecord(snapshot)) {
    errors.push('snapshot 必须是对象。')
    return null
  }

  const envelope = snapshot.envelope
  const payload = snapshot.payload
  if (!isRecord(envelope)) errors.push('缺少 envelope。')
  if (!isRecord(payload)) errors.push('缺少 payload。')
  if (!isRecord(envelope) || !isRecord(payload)) return null

  if (!isTemplateModule(envelope.templateKey)) errors.push('envelope.templateKey 非法。')
  if (envelope.runtimeKey !== TEMPLATE_RUNTIME_KEY) errors.push(`envelope.runtimeKey 必须为 ${TEMPLATE_RUNTIME_KEY}。`)
  if (envelope.bridgeVersion !== TEMPLATE_BRIDGE_VERSION) errors.push(`envelope.bridgeVersion 必须为 ${TEMPLATE_BRIDGE_VERSION}。`)
  if (envelope.snapshotSchemaVersion !== TEMPLATE_SNAPSHOT_SCHEMA_VERSION) {
    errors.push(`envelope.snapshotSchemaVersion 必须为 ${TEMPLATE_SNAPSHOT_SCHEMA_VERSION}。`)
  }
  if (!isIsoDateString(envelope.createdAt)) errors.push('envelope.createdAt 必须为 ISO 时间字符串。')
  if (!isIsoDateString(envelope.updatedAt)) errors.push('envelope.updatedAt 必须为 ISO 时间字符串。')

  if (!isTemplateModule(payload.moduleId)) errors.push('payload.moduleId 非法。')
  if (payload.currentView !== 'overview' && payload.currentView !== 'scene') {
    errors.push('payload.currentView 非法。')
  }
  if (payload.activeSceneId !== null && typeof payload.activeSceneId !== 'string') {
    errors.push('payload.activeSceneId 非法。')
  }
  if (!isRecord(payload.sceneDrafts)) {
    errors.push('payload.sceneDrafts 非法。')
  }

  if (isRecord(payload.sceneDrafts)) {
    Object.entries(payload.sceneDrafts).forEach(([sceneId, draft]) => {
      const localErrors: string[] = []
      const parsedDraft = parseSceneDraft(draft, localErrors, `payload.sceneDrafts.${sceneId}`)
      if (!parsedDraft) {
        errors.push(...localErrors)
      }
    })
  }

  if (errors.length > 0) return null
  return snapshot as unknown as TemplateSnapshotDocument
}

function validateSnapshot(snapshot: unknown): SnapshotValidationResult {
  const errors: string[] = []
  const parsed = parseSnapshot(snapshot, errors)
  const workspace = useModuleWorkspaceStore.getState()

  if (parsed && workspace.moduleId && parsed.envelope.templateKey !== workspace.moduleId) {
    errors.push(`snapshot 模块不匹配：当前模块为 ${workspace.moduleId}，收到 ${parsed.envelope.templateKey}。`)
  }
  if (parsed && parsed.payload.moduleId !== parsed.envelope.templateKey) {
    errors.push('payload.moduleId 必须与 envelope.templateKey 一致。')
  }
  if (
    parsed &&
    parsed.payload.currentView === 'scene' &&
    (!parsed.payload.activeSceneId || !parsed.payload.sceneDrafts[parsed.payload.activeSceneId])
  ) {
    errors.push('当 currentView 为 scene 时，activeSceneId 必须存在且对应草稿必须存在。')
  }

  return {
    ok: errors.length === 0,
    errors,
  }
}

function getDefaultSnapshot(): TemplateSnapshotDocument {
  const workspace = getWorkspaceOrThrow()
  return buildSnapshotDocument({
    moduleId: workspace.moduleId,
    currentView: 'overview',
    activeSceneId: null,
    sceneDrafts: {},
  })
}

function getSnapshot(): TemplateSnapshotDocument {
  const workspace = captureWorkspaceForExport()
  return buildSnapshotDocument(workspace)
}

function loadSnapshot(snapshot: unknown): SnapshotValidationResult {
  const validation = validateSnapshot(snapshot)
  if (!validation.ok) return validation

  const parsed = parseSnapshot(snapshot, [])
  if (!parsed) {
    return {
      ok: false,
      errors: ['snapshot 解析失败。'],
    }
  }

  useModuleWorkspaceStore.getState().replaceWorkspace({
    moduleId: parsed.payload.moduleId,
    currentView: parsed.payload.currentView,
    activeSceneId: parsed.payload.activeSceneId,
    sceneDrafts: parsed.payload.sceneDrafts as Record<string, ModuleSceneDraft>,
  })
  useModuleWorkspaceStore.getState().armSkipNextScenePersist()

  if (parsed.payload.currentView === 'scene' && parsed.payload.activeSceneId) {
    const draft = parsed.payload.sceneDrafts[parsed.payload.activeSceneId]
    if (draft) {
      loadRuntimeSceneDraft(draft)
    }
    const targetHash = buildModuleSceneHash(parsed.payload.moduleId, parsed.payload.activeSceneId)
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
  } else {
    const targetHash = buildModuleHash(parsed.payload.moduleId)
    if (window.location.hash !== targetHash) {
      window.location.hash = targetHash
    }
  }

  return validation
}

const bridge: TemplateBridge = {
  getDefaultSnapshot,
  getSnapshot,
  loadSnapshot,
  validateSnapshot,
}

export function installTemplateBridge(): void {
  if (typeof window === 'undefined') return

  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?.()
  window.__EDUMIND_TEMPLATE_BRIDGE__ = bridge

  const handleMessage = (event: MessageEvent) => {
    const message = event.data
    if (!message || typeof message !== 'object') return

    const data = message as {
      namespace?: string
      type?: string
      requestId?: string
      payload?: unknown
    }

    if (data.namespace !== 'edumind.templateBridge') return

    let response:
      | { namespace: string; type: string; requestId?: string; success: true; payload?: unknown }
      | { namespace: string; type: string; requestId?: string; success: false; error: string }

    try {
      switch (data.type) {
        case 'getSnapshot':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
            payload: bridge.getSnapshot(),
          }
          break
        case 'loadSnapshot':
          bridge.loadSnapshot(data.payload)
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
          }
          break
        case 'validateSnapshot':
          response = {
            namespace: 'edumind.templateBridge',
            type: 'response',
            requestId: data.requestId,
            success: true,
            payload: bridge.validateSnapshot(data.payload),
          }
          break
        default:
          return
      }
    } catch (error) {
      response = {
        namespace: 'edumind.templateBridge',
        type: 'response',
        requestId: data.requestId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }

    event.source?.postMessage(response, { targetOrigin: '*' })
  }

  window.addEventListener('message', handleMessage)
  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__ = () => {
    window.removeEventListener('message', handleMessage)
  }
}

export function uninstallTemplateBridge(): void {
  window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__?.()
  delete window.__EDUMIND_TEMPLATE_BRIDGE_CLEANUP__
  delete window.__EDUMIND_TEMPLATE_BRIDGE__
}
