import type { Config } from "tailwindcss";
import typography from "@tailwindcss/typography";

const config: Config = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        eduMind: {
          primary: "#32D583",
          primaryHover: "#28B86D",
          primaryLight: "#32D583",
          dark: "#1A1A1E",
          neutral: "#6B6B70",
          light: "#FAFAF9",
          lightAlt: "#F5F5F5",
          border: "#E5E5E5",
          white: "#FFFFFF",
          placeholder: "#A0A0A0",
          success: "#10B981",
          successAlt: "#52C41A",
          warning: "#F59E0B",
          error: "#EF4444",
          danger: "#F5222D",
          info: "#3B82F6",
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
    typography,
  ],
};
export default config;
