import { TEMPLATE_MODULES, type TemplateModule, getTemplateById } from '@/templates'

export type RouteState =
  | { page: 'thumbnails' }
  | { page: 'modules' }
  | { page: 'module'; moduleId: TemplateModule }
  | { page: 'module-scene'; moduleId: TemplateModule; sceneId: string }

export function parseHash(hash: string): RouteState {
  if (hash === '#thumbnails') return { page: 'thumbnails' }

  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  if (!raw || raw === 'workbench' || raw === 'modules') {
    return { page: 'modules' }
  }

  const [path, query = ''] = raw.split('?')
  if (path === 'editor') {
    const params = new URLSearchParams(query)
    const templateId = params.get('template')
    if (templateId) {
      return legacyTemplateRoute(templateId)
    }
    return { page: 'modules' }
  }

  const segments = path.split('/').filter(Boolean)
  if (segments[0] === 'modules') {
    const moduleId = segments[1]
    if (isTemplateModule(moduleId)) {
      if (segments[2] === 'scenes' && segments[3]) {
        return {
          page: 'module-scene',
          moduleId,
          sceneId: decodeURIComponent(segments[3]),
        }
      }
      return { page: 'module', moduleId }
    }
    return { page: 'modules' }
  }

  if (segments[0] === 'templates') {
    const templateId = segments[1]
    if (!templateId) return { page: 'modules' }
    return legacyTemplateRoute(decodeURIComponent(templateId))
  }

  return { page: 'modules' }
}

export function buildModulesHash(): string {
  return '#modules'
}

export function buildModuleHash(moduleId: TemplateModule): string {
  return `#modules/${encodeURIComponent(moduleId)}`
}

export function buildModuleSceneHash(moduleId: TemplateModule, sceneId: string): string {
  return `#modules/${encodeURIComponent(moduleId)}/scenes/${encodeURIComponent(sceneId)}`
}

function isTemplateModule(value: unknown): value is TemplateModule {
  return typeof value === 'string' && (TEMPLATE_MODULES as readonly string[]).includes(value)
}

function legacyTemplateRoute(templateId: string): RouteState {
  const template = getTemplateById(templateId)
  if (!template) return { page: 'modules' }
  return {
    page: 'module-scene',
    moduleId: template.meta.module,
    sceneId: template.meta.id,
  }
}
