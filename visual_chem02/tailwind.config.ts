import type { Config } from "tailwindcss";
import { COLORS } from "./src/styles/tokens";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eduMind: {
          primary: COLORS.primary,
          primaryHover: COLORS.primaryHover,
          primaryLight: COLORS.primaryLight,
          primaryDisabled: COLORS.primaryDisabled,
          text: COLORS.text,
          textSecondary: COLORS.textSecondary,
          textMuted: COLORS.textMuted,
          textPlaceholder: COLORS.textPlaceholder,
          textTertiary: COLORS.textTertiary,
          bg: COLORS.bg,
          bgPage: COLORS.bgPage,
          bgMuted: COLORS.bgMuted,
          bgHover: COLORS.bgHover,
          bgActive: COLORS.bgActive,
          border: COLORS.border,
          borderStrong: COLORS.borderStrong,
          dark: COLORS.dark,
          darkHover: COLORS.darkHover,
          success: COLORS.success,
          warning: COLORS.warning,
          error: COLORS.error,
          info: COLORS.info,
          white: COLORS.white,
        },
      },
      borderRadius: {
        'xl': '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};
export default config;
