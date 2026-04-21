import type { Config } from "tailwindcss";
import { COLORS } from "./styles/colors";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // EduMind 设计系统颜色 - 与 styles/colors.ts 保持一致
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
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
export default config;
