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
          dark: COLORS.dark,
          border: COLORS.border,
          white: COLORS.white,
          success: COLORS.success,
          warning: COLORS.warning,
          error: COLORS.error,
          info: COLORS.info,
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
