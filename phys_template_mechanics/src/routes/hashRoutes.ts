import { TEMPLATE_MODULES, type TemplateModule, getTemplateById } from '@/templates'

export type RouteState =
  | { page: 'thumbnails' }
  | { page: 'modules' }
  | { page: 'module'; moduleId: TemplateModule }
  | { page: 'module-scene'; moduleId: TemplateModule; sceneId: string }

const MODULE_MOUNT_ALIASES: Record<string, TemplateModule> = {
  p01: 'P-01',
  p02: 'P-02',
  p05: 'P-05',
  p12: 'P-12',
  p14: 'P-14',
}

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

export function resolveMountedModule(pathname: string): TemplateModule | null {
  const firstSegment = pathname
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .filter(Boolean)[0]
    ?.toLowerCase()

  if (!firstSegment) return null
  return MODULE_MOUNT_ALIASES[firstSegment] ?? null
}

export function resolveInitialHash(pathname: string, hash: string): string {
  if (hash) return hash
  const moduleId = resolveMountedModule(pathname)
  return moduleId ? buildModuleHash(moduleId) : hash
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
