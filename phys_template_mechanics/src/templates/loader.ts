import type { Scene } from '@/models/types'
import {
  formatSceneSanityIssues,
  validateSceneSanity,
  type SceneSanityIssue,
} from './commands'
import { getTemplateById } from './index'
import { isScene } from './sceneSchema'
import type { TemplateDefinition } from './schema'

export type LoadTemplateResult =
  | { ok: true; template: TemplateDefinition }
  | { ok: false; reason: 'not_found'; templateId: string }
  | { ok: false; reason: 'scene_json_fetch_failed'; templateId: string; path: string; status?: number }
  | { ok: false; reason: 'scene_json_parse_failed'; templateId: string; path: string; detail: string }
  | { ok: false; reason: 'scene_json_invalid'; templateId: string; path: string }
  | {
    ok: false
    reason: 'sanity_failed'
    templateId: string
    issues: SceneSanityIssue[]
    summary: string
  }

export async function loadTemplateById(templateId: string): Promise<LoadTemplateResult> {
  const template = getTemplateById(templateId)
  if (!template) {
    return {
      ok: false,
      reason: 'not_found',
      templateId,
    }
  }

  if (template.sceneJsonPath) {
    const sceneResult = await loadSceneJson(template.sceneJsonPath)
    if (!sceneResult.ok) {
      if (sceneResult.reason === 'scene_json_fetch_failed') {
        return {
          ok: false,
          reason: 'scene_json_fetch_failed',
          templateId,
          path: template.sceneJsonPath,
          status: sceneResult.status,
        }
      }

      if (sceneResult.reason === 'scene_json_parse_failed') {
        return {
          ok: false,
          reason: 'scene_json_parse_failed',
          templateId,
          path: template.sceneJsonPath,
          detail: sceneResult.detail,
        }
      }

      return {
        ok: false,
        reason: 'scene_json_invalid',
        templateId,
        path: template.sceneJsonPath,
      }
    }

    const sceneSanity = validateSceneSanity(sceneResult.scene, {
      // 运行态仅做结构/几何 sanity；策略位（初速度/尺寸）在生成阶段按 commandProgram 门禁。
      allowNonZeroInitialVelocity: true,
      allowCustomBodySize: true,
    })
    if (!sceneSanity.ok) {
      return {
        ok: false,
        reason: 'sanity_failed',
        templateId,
        issues: sceneSanity.issues,
        summary: formatSceneSanityIssues(sceneSanity.issues),
      }
    }

    return {
      ok: true,
      template: {
        ...template,
        scene: sceneResult.scene,
      },
    }
  }

  return {
    ok: true,
    template,
  }
}

async function loadSceneJson(path: string): Promise<
  | { ok: true; scene: Scene }
  | { ok: false; reason: 'scene_json_fetch_failed'; status?: number }
  | { ok: false; reason: 'scene_json_parse_failed'; detail: string }
  | { ok: false; reason: 'scene_json_invalid' }
> {
  let response: Response
  try {
    response = await fetch(path)
  } catch {
    return {
      ok: false,
      reason: 'scene_json_fetch_failed',
    }
  }

  if (!response.ok) {
    return {
      ok: false,
      reason: 'scene_json_fetch_failed',
      status: response.status,
    }
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    return {
      ok: false,
      reason: 'scene_json_parse_failed',
      detail: error instanceof Error ? error.message : String(error),
    }
  }

  if (!isScene(payload)) {
    return {
      ok: false,
      reason: 'scene_json_invalid',
    }
  }

  return {
    ok: true,
    scene: payload,
  }
}
