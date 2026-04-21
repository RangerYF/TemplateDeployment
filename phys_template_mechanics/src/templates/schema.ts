import type { Scene } from '@/models/types'

export const TEMPLATE_MODULES = ['P-01', 'P-02', 'P-05', 'P-12', 'P-14'] as const
export type TemplateModule = (typeof TEMPLATE_MODULES)[number]

export const TEMPLATE_STATUSES = ['ready', 'planned'] as const
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number]

export const TEMPLATE_SCENE_SOURCES = ['command', 'manual'] as const
export type TemplateSceneSource = (typeof TEMPLATE_SCENE_SOURCES)[number]

export interface TemplateMeta {
  id: string
  module: TemplateModule
  name: string
  status: TemplateStatus
}

export interface TemplateTeachingMeta {
  /** 模板的课堂教学目的 */
  teachingObjective: string
  /** 构造步骤（由 commandProgram 命令序列描述） */
  constructionSteps: string[]
}

export interface TemplateModuleMeta {
  module: TemplateModule
  title: string
  /** 模块目标简述 */
  summary: string
  /** 模块层面的教学关注点 */
  teachingFocus: string[]
}

export interface TemplateDefinition {
  meta: TemplateMeta
  teaching: TemplateTeachingMeta
  sceneSource: TemplateSceneSource
  scene?: Scene
  sceneJsonPath?: string
  updatedAt?: string
}

export interface TemplateModuleGroup extends TemplateModuleMeta {
  templates: TemplateDefinition[]
}
