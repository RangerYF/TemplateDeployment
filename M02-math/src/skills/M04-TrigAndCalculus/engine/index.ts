/**
 * M04 Skill — Mathematical Logic
 *
 * Unit circle, exact values, trig sampling, five-point method,
 * auxiliary angles, triangle solver, pi-axis engine.
 */
export { EXACT_VALUE_TABLE, lookupAngle, normalizeAngle, approximateValues, SNAP_TOLERANCE_RAD } from '@/engine/exactValueEngine';
export { evalTrig, sampleTrigFunction } from '@/engine/trigSampler';
export { computeFivePoints } from '@/engine/fivePointEngine';
export { synthesizeAuxiliaryAngle } from '@/engine/auxiliaryAngleEngine';
export { solveSolveMode } from '@/engine/triangleSolver';
export { formatPiLabel, formatPiLatex, choosePiStep, generatePiTicks } from '@/engine/piAxisEngine';
export { buildTransformLatex } from '@/engine/transformLatex';
export { startAnimation as startRafAnimation, easeOut as rafEaseOut } from '@/engine/rafAnimation';
