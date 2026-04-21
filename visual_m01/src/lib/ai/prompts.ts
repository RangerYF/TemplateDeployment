import type { ProjectMeta } from '../../data/projects/types';

/** 将 108 个 meta 精简为 Prompt 友好的格式 */
function compactMetas(metas: ProjectMeta[]): string {
  return metas
    .map(
      (m) =>
        `- ${m.id} | ${m.title} | ${m.geometryType} | ${m.sceneType} | ${m.difficulty} | ${m.tags.join('、')}`,
    )
    .join('\n');
}

/** 构建 System Prompt */
export function buildSystemPrompt(metas: ProjectMeta[]): string {
  return `你是一个高中立体几何教学场景推荐助手。

你的任务：根据用户输入的自然语言（可能是知识点、题目、或模糊描述），从下方作品库中推荐 3-5 个最相关的作品，按相关度降序排列。

## 作品库（${metas.length} 个）
${compactMetas(metas)}

## 匹配策略
- 支持模糊匹配：如"角度"应匹配二面角、线面角、异面角等相关作品
- 支持题目识别：如果用户粘贴了一道完整题目，识别其中的几何体类型和考点进行匹配
- 优先匹配 tags 和 sceneType，其次匹配 geometryType 和 difficulty

## 输出格式
严格返回以下 JSON，不要包含任何其他文字：
{
  "recommendations": [
    { "id": "作品ID", "reason": "推荐理由（一句话）" }
  ]
}`;
}

/** 构建 User Prompt */
export function buildUserPrompt(query: string): string {
  return query;
}
