/**
 * M04 Skill Module — Trigonometry & Calculus
 *
 * Entry point for the M04 skill. The layout is the primary export,
 * lazy-loaded by the SkillManager in App.tsx.
 *
 * Domain: Unit Circle linkage, Trig Function Transforms,
 *         Five-Point Method, Auxiliary Angles, Triangle Solver (Sine/Cosine laws)
 */
export { M04Layout } from '@/components/layout/M04Layout';

// Re-export sub-barrels for organized access
export * as M04Store      from './store';
export * as M04Engine     from './engine';
export * as M04Renderers  from './renderers';
export * as M04Components from './components';
