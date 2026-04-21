/**
 * DSL 编译错误
 *
 * 调试友好：每个错误都包含具体的上下文信息（哪个指令、哪一步、哪个标签出了问题）
 */

export class DSLCompileError extends Error {
  constructor(
    /** 出错的指令 ID */
    public readonly instructionId: string,
    /** 错误阶段 */
    public readonly phase: 'construction' | 'measurement' | 'coordinateSystem' | 'validation',
    /** 错误详情 */
    public readonly detail: string,
    /** 出错的构造步骤索引（如果在 construction 阶段） */
    public readonly stepIndex?: number,
  ) {
    const stepInfo = stepIndex !== undefined ? ` [step ${stepIndex}]` : '';
    super(`[DSL] ${instructionId} → ${phase}${stepInfo}: ${detail}`);
    this.name = 'DSLCompileError';
  }
}

/**
 * 标签不存在
 */
export function labelNotFound(instructionId: string, phase: string, label: string, available: string[]): DSLCompileError {
  const avail = available.length > 20
    ? available.slice(0, 20).join(', ') + ` ... (共${available.length}个)`
    : available.join(', ');
  return new DSLCompileError(
    instructionId,
    phase as DSLCompileError['phase'],
    `标签 "${label}" 不存在。可用标签: [${avail}]`,
  );
}

/**
 * 标签重复
 */
export function labelDuplicate(instructionId: string, label: string, stepIndex: number): DSLCompileError {
  return new DSLCompileError(
    instructionId,
    'construction',
    `标签 "${label}" 已存在，不允许重复定义`,
    stepIndex,
  );
}

/**
 * 面引用解析失败
 */
export function faceRefNotFound(instructionId: string, phase: string, ref: string | string[]): DSLCompileError {
  const refStr = Array.isArray(ref) ? `[${ref.join(', ')}]` : `"${ref}"`;
  return new DSLCompileError(
    instructionId,
    phase as DSLCompileError['phase'],
    `无法解析面引用 ${refStr}。检查面名是否正确（如 "底面"、"顶面"）或构造步骤中是否定义了该面标签`,
  );
}

/**
 * 线引用解析失败
 */
export function lineRefNotFound(instructionId: string, phase: string, line: [string, string]): DSLCompileError {
  return new DSLCompileError(
    instructionId,
    phase as DSLCompileError['phase'],
    `无法解析线引用 [${line[0]}, ${line[1]}]。该线段既不是内置棱，也不是已创建的自定义线段`,
  );
}

/**
 * 面顶点数不足
 */
export function facePointsTooFew(instructionId: string, stepIndex: number, count: number): DSLCompileError {
  return new DSLCompileError(
    instructionId,
    'construction',
    `面至少需要3个顶点，当前只有${count}个`,
    stepIndex,
  );
}
