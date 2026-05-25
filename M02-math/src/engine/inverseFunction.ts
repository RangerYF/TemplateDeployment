import { Viewport } from '@/canvas/Viewport';
import { buildFunctionScope, getKnownFunctionNames } from '@/engine/compositionEngine';
import { compileExpression, isParseError } from '@/engine/expressionEngine';
import { evaluatePiecewiseRange } from '@/engine/piecewiseEvaluator';
import { sampleWithTransform, type SamplePoint } from '@/engine/sampler';
import type { FunctionEntry } from '@/types';

export interface InverseFunctionAnalysis {
  isApproximatelyInjective: boolean;
  message: string;
  reflectedPoints: SamplePoint[];
}

function buildStandardSample(fn: FunctionEntry, allFunctions: FunctionEntry[], viewport: Viewport, steps: number): SamplePoint[] {
  const knownFns = getKnownFunctionNames(allFunctions, fn.id);
  const compiled = compileExpression(fn.exprStr, knownFns);
  if (isParseError(compiled)) return [];

  const paramScope: Record<string, unknown> =
    fn.templateId === null && fn.namedParams.length > 0
      ? Object.fromEntries(fn.namedParams.map((p) => [p.name, p.value]))
      : {};
  const fnScope = buildFunctionScope(allFunctions, fn.id);
  const scope = { ...paramScope, ...fnScope };

  return sampleWithTransform(
    compiled,
    viewport,
    fn.transform,
    steps,
    Object.keys(scope).length > 0 ? scope : undefined,
    fn.displayDomain,
  );
}

function buildPiecewiseSample(fn: FunctionEntry, viewport: Viewport, steps: number): SamplePoint[] {
  const segmentResults = evaluatePiecewiseRange(fn.segments, viewport, steps);
  const points: SamplePoint[] = [];

  for (const { points: segPoints } of segmentResults) {
    for (let i = 0; i < segPoints.length; i++) {
      const [x, y] = segPoints[i];
      points.push({
        x,
        y,
        isValid: Number.isFinite(x) && Number.isFinite(y),
        isBreak: i === 0,
      });
    }
  }

  return points;
}

function buildSample(fn: FunctionEntry, allFunctions: FunctionEntry[], viewport: Viewport, steps: number): SamplePoint[] {
  if (fn.mode === 'piecewise') return buildPiecewiseSample(fn, viewport, steps);
  return buildStandardSample(fn, allFunctions, viewport, steps);
}

function reflectPoint(pt: SamplePoint): SamplePoint {
  return {
    x: pt.y,
    y: pt.x,
    isValid: pt.isValid,
    isBreak: pt.isBreak,
  };
}

function estimateInjective(points: SamplePoint[], viewport: Viewport): { ok: boolean; message: string } {
  const valid = points.filter((pt) => pt.isValid);
  if (valid.length < 3) {
    return {
      ok: false,
      message: '当前视图内可用点太少，暂时无法判断是否存在反函数',
    };
  }

  const yTolerance = (viewport.yMax - viewport.yMin) / 140;
  const xTolerance = (viewport.xMax - viewport.xMin) / 140;

  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      if (Math.abs(valid[i].y - valid[j].y) <= yTolerance && Math.abs(valid[i].x - valid[j].x) > xTolerance) {
        return {
          ok: false,
          message: '当前图像在此视图内不满足一一对应，反射后更适合作为“交换 x、y 的图像参考”',
        };
      }
    }
  }

  return {
    ok: true,
    message: '当前图像在此视图内近似满足一一对应，可将反射曲线视为反函数图像',
  };
}

export function analyzeInverseFunction(
  fn: FunctionEntry,
  allFunctions: FunctionEntry[],
  viewportState: { xMin: number; xMax: number; yMin: number; yMax: number },
  canvasWidth: number,
  canvasHeight: number,
  steps = 800,
): InverseFunctionAnalysis {
  const viewport = new Viewport(
    viewportState.xMin,
    viewportState.xMax,
    viewportState.yMin,
    viewportState.yMax,
    canvasWidth,
    canvasHeight,
  );

  const points = buildSample(fn, allFunctions, viewport, steps);
  const reflectedPoints = points.map(reflectPoint);
  const injective = estimateInjective(points, viewport);

  return {
    isApproximatelyInjective: injective.ok,
    message: injective.message,
    reflectedPoints,
  };
}
