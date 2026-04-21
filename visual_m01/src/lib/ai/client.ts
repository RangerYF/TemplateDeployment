import type { RecommendResult } from './types';
import { AIError } from './types';
import type { ProjectMeta } from '../../data/projects/types';
import { buildSystemPrompt, buildUserPrompt } from './prompts';

const TIMEOUT_MS = 30_000;
const MODEL = import.meta.env.VITE_AI_MODEL || 'claude-haiku-4-5-20251001';

/**
 * 调用 LLM 获取作品推荐（通过 /api/recommend 代理，避免 CORS + 保护 API Key）
 * @param query 用户输入的自然语言
 * @param metas 作品元数据列表（注入到 System Prompt）
 */
export async function recommend(
  query: string,
  metas: ProjectMeta[],
): Promise<RecommendResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL,
        system: buildSystemPrompt(metas),
        messages: [
          { role: 'user', content: buildUserPrompt(query) },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });

    if (response.status === 401) {
      throw new AIError('AUTH', 'API Key 无效或已过期');
    }

    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      throw new AIError('API', `LLM API 错误 (${response.status}): ${text}`);
    }

    const data = await response.json();
    const content: string = data.content?.[0]?.text ?? '';

    return parseRecommendResult(content);
  } catch (err) {
    if (err instanceof AIError) throw err;

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new AIError('TIMEOUT', 'LLM 请求超时（30s）');
    }

    throw new AIError(
      'NETWORK',
      `网络请求失败: ${err instanceof Error ? err.message : String(err)}`,
    );
  } finally {
    clearTimeout(timer);
  }
}

/** 解析 LLM 返回的 JSON 内容 */
function parseRecommendResult(content: string): RecommendResult {
  // LLM 可能返回 markdown 代码块包裹的 JSON
  const jsonStr = content.replace(/^```(?:json)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();

  try {
    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed.recommendations)) {
      throw new Error('missing recommendations array');
    }

    return {
      recommendations: parsed.recommendations.map((r: { id?: string; reason?: string }) => ({
        id: String(r.id ?? ''),
        reason: String(r.reason ?? ''),
      })),
    };
  } catch {
    throw new AIError('PARSE', `LLM 返回格式解析失败: ${content.slice(0, 200)}`);
  }
}
