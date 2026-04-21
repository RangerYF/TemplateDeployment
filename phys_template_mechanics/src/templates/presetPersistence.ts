import type { Scene } from '@/models/types'

interface SaveTemplatePresetSuccess {
  ok: true
  templateId: string
  sceneSource: 'manual'
  presetPath: string
  scenePath: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function saveTemplatePreset(
  templateId: string,
  scene: Scene,
): Promise<SaveTemplatePresetSuccess> {
  let response: Response
  try {
    response = await fetch('/__template/preset/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        templateId,
        scene,
      }),
    })
  } catch {
    throw new Error('无法连接本地保存服务，请确认使用 pnpm dev 启动。')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new Error('保存接口返回了非 JSON 响应。')
  }

  if (!response.ok) {
    const message = isRecord(payload) && typeof payload.error === 'string'
      ? payload.error
      : `保存失败（HTTP ${response.status}）`
    throw new Error(message)
  }

  if (
    !isRecord(payload)
    || payload.ok !== true
    || typeof payload.templateId !== 'string'
    || typeof payload.presetPath !== 'string'
    || typeof payload.scenePath !== 'string'
  ) {
    throw new Error('保存接口返回数据结构无效。')
  }

  return {
    ok: true,
    templateId: payload.templateId,
    sceneSource: 'manual',
    presetPath: payload.presetPath,
    scenePath: payload.scenePath,
  }
}
