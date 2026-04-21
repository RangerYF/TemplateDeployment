import type { SceneBody } from '@/models/types'

/** 可分析物体 = 非静态物体（静态基础设施如固定地面、固定斜面不参与分析） */
export function isAnalyzableBody(body: SceneBody): boolean {
  return !body.isStatic
}
