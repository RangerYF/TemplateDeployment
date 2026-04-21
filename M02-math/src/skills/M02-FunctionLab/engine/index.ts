/**
 * M02 Skill — Mathematical Logic
 *
 * Expression parsing, sampling, feature points, transforms, derivatives.
 */
export { compileExpression, evaluateAt, symbolicDerivativeStr } from '@/engine/expressionEngine';
export { sample, sampleWithTransform, sampleDerivativeWithDomain, evaluateStandard } from '@/engine/sampler';
export { scanFeaturePoints, findZeros, findExtrema, findInflections } from '@/engine/featurePoints';
export { evaluatePiecewise } from '@/engine/piecewiseEvaluator';
export { FUNCTION_TEMPLATES, getTemplate, buildReadableExpr } from '@/engine/functionTemplates';
export { detectAndMergeCoefficients } from '@/engine/coefficientDetector';
export { findAllIntersections } from '@/engine/functionIntersection';
