/**
 * Styles barrel export
 *
 * COLORS (default export) → M02 dark palette from ./colors  (#32D583 primary)
 * TOKENS.COLORS           → SYXMA light palette from ./tokens (#00C06B primary)
 *
 * Usage:
 *   import { COLORS } from '@/styles'          // M02 dark
 *   import { TOKENS } from '@/styles'          // TOKENS.COLORS = SYXMA light
 *   import { COLORS } from '@/styles/tokens'   // SYXMA light (direct)
 */

export * from './colors';       // COLORS (M02 dark), ColorKey
export * from './spacing';      // SPACING, SPACING_UTILS, COMPONENT_SPACING
export * from './typography';   // TYPOGRAPHY, TEXT_COLORS, FONT_FAMILY, …
export * as TOKENS from './tokens'; // TOKENS.COLORS, TOKENS.RADIUS, TOKENS.SHADOWS
