/** @type {import('tailwindcss').Config} */

// NOTE: tailwind.config runs at build time — must use relative path, not @/ alias
import { COLORS } from './src/styles/tokens.ts';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        eduMind: {
          // Brand
          primary:         COLORS.primary,           // #00C06B
          primaryHover:    COLORS.primaryHover,       // #00A85A
          primaryLight:    COLORS.primaryLight,       // #F0FBF6
          primaryDisabled: COLORS.primaryDisabled,

          // Text
          text:            COLORS.text,               // #1A1A2E — 主文本
          textSecondary:   COLORS.textSecondary,
          textMuted:       COLORS.textMuted,
          textPlaceholder: COLORS.textPlaceholder,
          textTertiary:    COLORS.textTertiary,

          // Background
          bg:              COLORS.bg,                 // #FFFFFF
          bgPage:          COLORS.bgPage,             // #F7F8FA
          bgMuted:         COLORS.bgMuted,            // #F5F5F7
          bgHover:         COLORS.bgHover,

          // Border
          border:          COLORS.border,             // #E5E7EB
          borderStrong:    COLORS.borderStrong,

          // Dark panel
          dark:            COLORS.dark,               // #1A1A2E
          darkHover:       COLORS.darkHover,

          // Semantic
          success:         COLORS.success,
          warning:         COLORS.warning,
          error:           COLORS.error,
          info:            COLORS.info,

          white:           COLORS.white,
        },
      },
      borderRadius: {
        'xl':  '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
