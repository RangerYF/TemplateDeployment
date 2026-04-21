import moduleCatalogPayload from './catalog-data/modules.json'
import templateCatalogPayload from './catalog-data/templates.json'
import {
  TEMPLATE_MODULES,
  TEMPLATE_SCENE_SOURCES,
  TEMPLATE_STATUSES,
  type TemplateDefinition,
  type TemplateMeta,
  type TemplateModule,
  type TemplateModuleGroup,
  type TemplateModuleMeta,
  type TemplateSceneSource,
  type TemplateStatus,
  type TemplateTeachingMeta,
} from './schema'

interface ParsedModuleCatalog {
  byModule: Map<TemplateModule, TemplateModuleMeta>
}

const parsedModuleCatalog = parseModuleCatalog(moduleCatalogPayload)
const parsedTemplates = parseTemplateCatalog(templateCatalogPayload, parsedModuleCatalog.byModule)

export const templateCatalog: TemplateModuleGroup[] = buildTemplateCatalog(
  parsedModuleCatalog.byModule,
  parsedTemplates,
)

const templateById = new Map(
  templateCatalog.flatMap((group) =>
    group.templates.map((template) => [template.meta.id, template] as const),
  ),
)

export function getTemplateById(templateId: string): TemplateDefinition | undefined {
  return templateById.get(templateId)
}

function buildTemplateCatalog(
  moduleMap: Map<TemplateModule, TemplateModuleMeta>,
  templates: TemplateDefinition[],
): TemplateModuleGroup[] {
  const grouped = new Map<TemplateModule, TemplateDefinition[]>(
    TEMPLATE_MODULES.map((module) => [module, []]),
  )

  for (const template of templates) {
    grouped.get(template.meta.module)?.push(template)
  }

  return TEMPLATE_MODULES.map((module) => {
    const moduleMeta = moduleMap.get(module)
    if (!moduleMeta) {
      throw new Error(`[template-catalog] missing module catalog for ${module}`)
    }
    const moduleTemplates = grouped.get(module) ?? []
    moduleTemplates.sort((a, b) => a.meta.id.localeCompare(b.meta.id))
    return {
      ...moduleMeta,
      templates: moduleTemplates,
    }
  })
}

function parseModuleCatalog(payload: unknown): ParsedModuleCatalog {
  if (!Array.isArray(payload)) {
    throw new Error('[template-catalog] modules catalog must be an array')
  }

  const byModule = new Map<TemplateModule, TemplateModuleMeta>()

  for (const [index, value] of payload.entries()) {
    const path = `modules.json[${index}]`
    const moduleMeta = parseModuleCatalogItem(path, value)
    if (byModule.has(moduleMeta.module)) {
      throw new Error(`[template-catalog] duplicate module catalog: ${moduleMeta.module}`)
    }
    byModule.set(moduleMeta.module, moduleMeta)
  }

  for (const module of TEMPLATE_MODULES) {
    if (!byModule.has(module)) {
      throw new Error(`[template-catalog] required module catalog not found: ${module}`)
    }
  }

  return { byModule }
}

function parseTemplateCatalog(
  payload: unknown,
  moduleMap: Map<TemplateModule, TemplateModuleMeta>,
): TemplateDefinition[] {
  if (!Array.isArray(payload)) {
    throw new Error('[template-catalog] templates catalog must be an array')
  }

  const templateIds = new Set<string>()
  const definitions: TemplateDefinition[] = []

  for (const [index, value] of payload.entries()) {
    const path = `templates.json[${index}]`
    const definition = parseTemplateCatalogItem(path, value)
    if (!moduleMap.has(definition.meta.module)) {
      throw new Error(
        `[template-catalog] template module has no module catalog: ${definition.meta.id} -> ${definition.meta.module}`,
      )
    }
    if (templateIds.has(definition.meta.id)) {
      throw new Error(`[template-catalog] duplicate template id: ${definition.meta.id}`)
    }
    templateIds.add(definition.meta.id)
    definitions.push(definition)
  }

  return definitions
}

function parseModuleCatalogItem(path: string, value: unknown): TemplateModuleMeta {
  if (!isRecord(value)) {
    throw new Error(`[template-catalog] module catalog item must be object: ${path}`)
  }

  const module = value.module
  const title = value.title
  const summary = value.summary
  const teachingFocus = value.teachingFocus

  if (!isTemplateModule(module)) {
    throw new Error(`[template-catalog] invalid module in ${path}`)
  }
  if (typeof title !== 'string' || !title.trim()) {
    throw new Error(`[template-catalog] invalid title in ${path}`)
  }
  if (typeof summary !== 'string' || !summary.trim()) {
    throw new Error(`[template-catalog] invalid summary in ${path}`)
  }
  if (!isStringArray(teachingFocus) || teachingFocus.length === 0) {
    throw new Error(`[template-catalog] invalid teachingFocus in ${path}`)
  }

  return {
    module,
    title,
    summary,
    teachingFocus,
  }
}

function parseTemplateCatalogItem(path: string, value: unknown): TemplateDefinition {
  if (!isRecord(value)) {
    throw new Error(`[template-catalog] template catalog item must be object: ${path}`)
  }

  const meta = parseTemplateMeta(path, value.meta)
  const teaching = parseTeachingMeta(path, value.teaching)
  const sceneSource = parseTemplateSceneSource(path, value.sceneSource)

  const sceneJsonPath = value.sceneJsonPath
  if (sceneJsonPath !== undefined && typeof sceneJsonPath !== 'string') {
    throw new Error(`[template-catalog] invalid sceneJsonPath in ${path}`)
  }

  const updatedAt = value.updatedAt
  if (updatedAt !== undefined && typeof updatedAt !== 'string') {
    throw new Error(`[template-catalog] invalid updatedAt in ${path}`)
  }

  if (meta.status === 'ready' && !sceneJsonPath) {
    throw new Error(`[template-catalog] ready template missing sceneJsonPath: ${path}`)
  }

  return {
    meta,
    teaching,
    sceneSource,
    ...(sceneJsonPath ? { sceneJsonPath } : {}),
    ...(updatedAt ? { updatedAt } : {}),
  }
}

function parseTemplateMeta(path: string, value: unknown): TemplateMeta {
  if (!isRecord(value)) {
    throw new Error(`[template-catalog] invalid meta object in ${path}`)
  }

  const id = value.id
  const module = value.module
  const name = value.name
  const status = value.status

  if (typeof id !== 'string' || !id.trim()) {
    throw new Error(`[template-catalog] invalid meta.id in ${path}`)
  }
  if (!isTemplateModule(module)) {
    throw new Error(`[template-catalog] invalid meta.module in ${path}`)
  }
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error(`[template-catalog] invalid meta.name in ${path}`)
  }
  if (!isTemplateStatus(status)) {
    throw new Error(`[template-catalog] invalid meta.status in ${path}`)
  }

  return { id, module, name, status }
}

function parseTeachingMeta(path: string, value: unknown): TemplateTeachingMeta {
  if (!isRecord(value)) {
    throw new Error(`[template-catalog] invalid teaching object in ${path}`)
  }

  const teachingObjective = value.teachingObjective
  const constructionSteps = value.constructionSteps

  if (typeof teachingObjective !== 'string' || !teachingObjective.trim()) {
    throw new Error(`[template-catalog] invalid teaching.teachingObjective in ${path}`)
  }
  if (constructionSteps !== undefined && !isStringArray(constructionSteps)) {
    throw new Error(`[template-catalog] invalid teaching.constructionSteps in ${path}`)
  }

  return {
    teachingObjective,
    constructionSteps: constructionSteps ?? [],
  }
}

function parseTemplateSceneSource(path: string, value: unknown): TemplateSceneSource {
  if (value === undefined) return 'command'
  if (!isTemplateSceneSource(value)) {
    throw new Error(`[template-catalog] invalid sceneSource in ${path}`)
  }
  return value
}

function isTemplateModule(value: unknown): value is TemplateModule {
  return typeof value === 'string' && (TEMPLATE_MODULES as readonly string[]).includes(value)
}

function isTemplateStatus(value: unknown): value is TemplateStatus {
  return typeof value === 'string' && (TEMPLATE_STATUSES as readonly string[]).includes(value)
}

function isTemplateSceneSource(value: unknown): value is TemplateSceneSource {
  return typeof value === 'string' && (TEMPLATE_SCENE_SOURCES as readonly string[]).includes(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string' && item.length > 0)
}
