/** 单条推荐结果 */
export interface Recommendation {
  /** 作品 ID，对应 ProjectMeta.id */
  id: string;
  /** 推荐理由 */
  reason: string;
}

/** LLM 返回的推荐结果 */
export interface RecommendResult {
  recommendations: Recommendation[];
}


/** AI 调用错误 */
export class AIError extends Error {
  constructor(
    public code: 'NETWORK' | 'TIMEOUT' | 'AUTH' | 'PARSE' | 'API',
    message: string,
  ) {
    super(message);
    this.name = 'AIError';
  }
}
