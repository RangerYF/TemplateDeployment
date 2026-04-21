import type { Config } from "tailwindcss";
import { COLORS } from "./src/styles/colors";

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
          neutral: COLORS.neutral,
          light: COLORS.light,
          lightAlt: COLORS.lightAlt,
          border: COLORS.border,
          white: COLORS.white,
          placeholder: COLORS.placeholder,
          success: COLORS.success,
          successAlt: COLORS.successAlt,
          warning: COLORS.warning,
          error: COLORS.error,
          danger: COLORS.dangerAlt,
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
