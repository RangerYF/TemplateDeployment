/**
 * M03 Skill — Mathematical Logic
 *
 * Conic analysis, eccentricity, intersections, optical properties, locus.
 */
export {
  computeEllipseDerived,
  computeHyperbolaDerived,
  computeParabolaDerived,
  computeCircleDerived,
  focalDistance,
  eccentricityToParams,
} from '@/engine/conicAnalysis';
export {
  getEntityEccentricity,
  getEntityFixedC,
  applyEccentricityToEntity,
  startEccentricityAnimation,
} from '@/engine/eccentricityEngine';
export { intersectLineConic } from '@/engine/intersectionEngine';
export { sampleConicEntity } from '@/engine/parametricSampler';
export { findNearestOnAnyEntity } from '@/engine/nearestPoint';
export { computeOpticalRays, startPhotonAnimation } from '@/engine/opticalEngine';
export { startLocusAnimation, pointOnConic } from '@/engine/locusEngine';
export { toRadicalForm } from '@/engine/radicalEngine';
