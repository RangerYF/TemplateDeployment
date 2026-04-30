import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { EditorLayout } from '@/components/layout/EditorLayout'
import { P06WavePage } from '@/components/p06/P06WavePage'
import { ModuleHubPage } from '@/components/workbench/ModuleHubPage'
import { ModulePage } from '@/components/workbench/ModulePage'
import { WorkbenchPage } from '@/components/workbench/WorkbenchPage'
import { ToastProvider } from '@/components/ui/toast'
import {
  buildModuleHash,
  buildModuleSceneHash,
  parseHash,
} from '@/routes/hashRoutes'
import {
  createDefaultSceneDraft,
  getDefaultSelectedBodyId,
  loadRuntimeSceneDraft,
  readRuntimeSceneDraft,
} from '@/templates/editorRuntime'
import { loadTemplateById } from '@/templates/loader'
import { installTemplateBridge, uninstallTemplateBridge } from '@/templates/templateBridge'
import { getModuleGroup, getTemplateById } from '@/templates'
import { useModuleWorkspaceStore } from '@/store/moduleWorkspaceStore'
import { useSelectionStore } from '@/store/selectionStore'

// Dev-only: lazy load thumbnail generator when hash is #thumbnails
const ThumbnailGenerator = lazy(() =>
  import('@/dev/ThumbnailGenerator').then((m) => ({ default: m.ThumbnailGenerator })),
)

function App() {
  const [hash, setHash] = useState(window.location.hash)
  const workspaceModuleId = useModuleWorkspaceStore((state) => state.moduleId)
  const activeSceneId = useModuleWorkspaceStore((state) => state.activeSceneId)
  const sceneDrafts = useModuleWorkspaceStore((state) => state.sceneDrafts)
  const route = useMemo(() => parseHash(hash), [hash])
  const p06ModuleId = route.page === 'p06' ? route.moduleId : null

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  useEffect(() => {
    if (route.page === 'module' || route.page === 'module-scene') {
      useModuleWorkspaceStore.getState().initializeModule(route.moduleId)
      useModuleWorkspaceStore.getState().setCurrentView(route.page === 'module' ? 'overview' : 'scene')
      if (route.page === 'module-scene') {
        useModuleWorkspaceStore.getState().setActiveScene(route.sceneId)
      }
      return
    }
    if (route.page === 'modules') {
      uninstallTemplateBridge()
    }
  }, [route])

  useEffect(() => {
    if (
      (route.page === 'module' || route.page === 'module-scene') &&
      workspaceModuleId === route.moduleId
    ) {
      installTemplateBridge()
      return () => {
        uninstallTemplateBridge()
      }
    }

    if (route.page === 'p06') {
      return undefined
    }

    uninstallTemplateBridge()
    return undefined
  }, [route, workspaceModuleId])

  useEffect(() => {
    if (route.page !== 'module-scene') return undefined
    const { moduleId, sceneId } = route
    let cancelled = false

    const run = async () => {
      const workspace = useModuleWorkspaceStore.getState()
      if (workspace.moduleId !== moduleId) return

      const existingDraft = workspace.sceneDrafts[sceneId]
      if (existingDraft) {
        loadRuntimeSceneDraft(existingDraft)
        return
      }

      const result = await loadTemplateById(sceneId)
      if (!result.ok) {
        if (result.reason === 'sanity_failed') {
          console.error(
            `[template] scene sanity check failed for ${sceneId}\n${result.summary}`,
          )
        } else {
          console.warn('[template] load failed', result)
        }
        return
      }
      if (!result.template.scene || cancelled) return
      if (result.template.meta.module !== moduleId) {
        console.warn('[workspace] scene module mismatch', {
          expected: moduleId,
          actual: result.template.meta.module,
          sceneId,
        })
        return
      }

      const draft = createDefaultSceneDraft(result.template.scene, sceneId)
      useModuleWorkspaceStore.getState().upsertSceneDraft(sceneId, draft)
      if (cancelled) return
      loadRuntimeSceneDraft(draft)
      const defaultSelectedBodyId = getDefaultSelectedBodyId(sceneId)
      if (defaultSelectedBodyId) {
        useSelectionStore.getState().select({ type: 'body', id: defaultSelectedBodyId })
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [route])

  useEffect(() => {
    return () => {
      const previousRoute = route
      if (previousRoute.page === 'module-scene') {
        const shouldSkip = useModuleWorkspaceStore.getState().consumeSkipNextScenePersist()
        if (shouldSkip) return
        useModuleWorkspaceStore.getState().upsertSceneDraft(
          previousRoute.sceneId,
          readRuntimeSceneDraft(),
        )
      }
    }
  }, [route])

  const navigateTo = (nextHash: string) => {
    if (window.location.hash === nextHash) {
      setHash(nextHash)
      return
    }
    window.location.assign(nextHash)
  }

  const openModule = (moduleId: Parameters<typeof buildModuleHash>[0]) => {
    navigateTo(buildModuleHash(moduleId))
  }

  const openScene = (moduleId: Parameters<typeof buildModuleHash>[0], sceneId: string) => {
    navigateTo(buildModuleSceneHash(moduleId, sceneId))
  }

  const openTemplate = (templateId: string) => {
    const template = getTemplateById(templateId)
    if (!template) {
      navigateTo('#modules')
      return
    }
    navigateTo(buildModuleSceneHash(template.meta.module, template.meta.id))
  }

  const openP06 = (moduleId?: string | null) => {
    const query = moduleId ? `?module=${encodeURIComponent(moduleId)}` : ''
    navigateTo(`#p06${query}`)
  }

  if (route.page === 'thumbnails') {
    return (
      <Suspense fallback={<div>Loading...</div>}>
        <ToastProvider>
          <ThumbnailGenerator />
        </ToastProvider>
      </Suspense>
    )
  }

  if (route.page === 'modules') {
    return (
      <WorkbenchPage
        onOpenTemplate={openTemplate}
        onOpenModule={openModule}
        onOpenP06={() => openP06()}
      />
    )
  }

  if (route.page === 'p06') {
    return (
      <ToastProvider>
        <P06WavePage
          moduleId={p06ModuleId}
          onChangeModule={(nextModuleId) => openP06(nextModuleId)}
          onBack={() => navigateTo('#modules')}
        />
      </ToastProvider>
    )
  }

  if (route.page === 'module') {
    const group = getModuleGroup(route.moduleId)
    if (!group) {
      return <ModuleHubPage onOpenModule={openModule} />
    }
    return (
      <ModulePage
        group={group}
        onOpenScene={(sceneId) => openScene(group.module, sceneId)}
        editedSceneIds={new Set(Object.keys(sceneDrafts))}
        activeSceneId={activeSceneId}
      />
    )
  }

  if (route.page === 'module-scene') {
    const group = getModuleGroup(route.moduleId)
    if (!group) {
      return <ModuleHubPage onOpenModule={openModule} />
    }
    return (
      <ToastProvider>
        <EditorLayout moduleId={group.module} sceneId={route.sceneId} />
      </ToastProvider>
    )
  }

  return null
}

export default App
