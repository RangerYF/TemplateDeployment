/**
 * M02 Skill Module — Function Graphing Lab
 *
 * Entry point for the M02 skill. The layout is the primary export,
 * lazy-loaded by the SkillManager in App.tsx.
 *
 * Domain: Expression Parsing, A/ω/φ/k Transformations,
 *         Feature Points, Derivatives, Piecewise Functions, Animations
 */
export { M02Layout } from '@/components/layout/M02Layout';

// Re-export sub-barrels for organized access
export * as M02Store      from './store';
export * as M02Engine     from './engine';
export * as M02Renderers  from './renderers';
export * as M02Components from './components';
