import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f3f6fb",
          100: "#e6edf6",
          200: "#c9d7ea",
          300: "#9bb4d0",
          400: "#6b8db3",
          500: "#4a6f96",
          600: "#38577a",
          700: "#2c4664",
          800: "#23374f",
          900: "#152536",
          950: "#0c1724"
        },
        brand: {
          50: "#eefbf8",
          100: "#d5f6ef",
          200: "#aeede0",
          300: "#79ddcb",
          400: "#43c5b1",
          500: "#27a996",
          600: "#1c887a",
          700: "#1b6d64",
          800: "#1a5752",
          900: "#194845"
        },
        gold: {
          400: "#e8c36a",
          500: "#d4a84b",
          600: "#b8882d"
        }
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"]
      },
      boxShadow: {
        card: "0 16px 40px -22px rgba(12, 23, 36, 0.35)",
        glow: "0 0 0 4px rgba(39, 169, 150, 0.14)",
        lift: "0 22px 50px -24px rgba(28, 136, 122, 0.5)"
      }
    }
  },
  plugins: []
};

export default config;
