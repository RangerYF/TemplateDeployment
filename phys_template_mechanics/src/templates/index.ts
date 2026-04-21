import { templateCatalog } from './catalog'
import type {
  TemplateDefinition,
  TemplateStatus,
  TemplateModule,
} from './schema'

export { templateCatalog }
export * from './commands'
export type {
  TemplateMeta,
  TemplateTeachingMeta,
  TemplateModuleMeta,
  TemplateDefinition,
  TemplateModuleGroup,
  TemplateStatus,
  TemplateModule,
  TemplateSceneSource,
} from './schema'
export { TEMPLATE_MODULES } from './schema'

export const templateRegistry = new Map<string, TemplateDefinition>(
  templateCatalog.flatMap((group) =>
    group.templates.map((template) => [template.meta.id, template] as const),
  ),
)

interface ListTemplatesOptions {
  module?: TemplateModule
  status?: TemplateStatus
}

export function listTemplates(options: ListTemplatesOptions = {}): TemplateDefinition[] {
  const { module, status } = options
  const groupedTemplates = module
    ? templateCatalog.filter((group) => group.module === module)
    : templateCatalog

  const templates = groupedTemplates.flatMap((group) => group.templates)
  if (!status) return templates
  return templates.filter((template) => template.meta.status === status)
}

export function getTemplateById(templateId: string): TemplateDefinition | undefined {
  return templateRegistry.get(templateId)
}

export function getModuleGroup(moduleId: TemplateModule) {
  return templateCatalog.find((group) => group.module === moduleId)
}
