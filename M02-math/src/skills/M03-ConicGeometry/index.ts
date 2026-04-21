/**
 * M03 Skill Module — Conic Section Geometry
 *
 * Entry point for the M03 skill. The layout is the primary export,
 * lazy-loaded by the SkillManager in App.tsx.
 *
 * Domain: Conic Equations, Eccentricity Sweep, Focal Chords,
 *         Intersection Engine, Optical Reflection, Locus Animation
 */
export { M03Layout } from '@/components/layout/M03Layout';

// Re-export sub-barrels for organized access
export * as M03Store      from './store';
export * as M03Engine     from './engine';
export * as M03Renderers  from './renderers';
export * as M03Components from './components';
