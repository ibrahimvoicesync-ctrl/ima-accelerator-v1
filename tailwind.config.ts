import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ima: {
          primary: "#2563EB",
          "primary-hover": "#1D4ED8",
          secondary: "#1E40AF",
          accent: "#3B82F6",
          success: "#10B981",
          warning: "#F59E0B",
          error: "#EF4444",
          info: "#3B82F6",
          bg: "#F8FAFC",
          surface: "#FFFFFF",
          "surface-light": "#F1F5F9",
          "surface-accent": "#EFF6FF",
          border: "#E2E8F0",
          text: "#1E293B",
          "text-secondary": "#64748B",
          "text-muted": "#94A3B8",
          overlay: "rgba(0, 0, 0, 0.5)",
          // Vibrant palette — scoped to student_diy surfaces (see CLAUDE.md).
          // Pastels are surface tints; accents are signal hues used sparingly.
          "pastel-rose": "#FFEEEE",
          "pastel-butter": "#FFFDE7",
          "pastel-lilac": "#EDE7F6",
          "pastel-mint": "#E0F7E0",
          "pastel-sky": "#E3F2FD",
          "pastel-peach": "#FFE8D6",
          magenta: "#EC4899",
          teal: "#14B8A6",
          violet: "#7C3AED",
        },
      },
      boxShadow: {
        "card-hover": "0 8px 25px -5px rgba(0,0,0,0.1)",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.95)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeIn: "fadeIn 300ms ease-out",
        scaleIn: "scaleIn 300ms ease-out",
        slideUp: "slideUp 400ms ease-out forwards",
      },
    },
  },
  plugins: [],
};

export default config;
