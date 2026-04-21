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
          // Brand
          primary: "#00C06B",
          primaryHover: "#00A85A",
          primaryLight: "#F0FBF6",
          primaryDisabled: "#B8EFD5",

          // Text
          text: "#1A1A2E",
          textSecondary: "#595959",
          textMuted: "#6B7280",
          textPlaceholder: "#9CA3AF",
          textTertiary: "#BFBFBF",

          // Background
          bg: "#FFFFFF",
          bgPage: "#F7F8FA",
          bgMuted: "#F5F5F7",
          bgHover: "#F0F0F0",

          // Border
          border: "#E5E7EB",
          borderStrong: "#D1D1CF",

          // Dark panel
          dark: "#1A1A2E",
          darkHover: "#2D2D4A",

          // Semantic
          success: "#00C06B",
          warning: "#FAAD14",
          error: "#FF4D4F",
          info: "#1890FF",

          white: "#FFFFFF",
        },
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
    },
  },
  plugins: [typography],
};

export default config;
