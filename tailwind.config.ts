import type { Config } from "tailwindcss";

/**
 * Academic Monitoring Portal — dark neon-gradient design system.
 *
 * Strategy: the semantic ramps (`ink`, `brand`, `gold`) are RE-POINTED at dark
 * values so that every existing utility usage across the app (text-ink-600,
 * bg-white, border-ink-200, ...) renders on the new aesthetic without a
 * per-page rewrite. On top of that, first-class semantic tokens
 * (base/elevated/inset/violet/coral/success/warning/danger) and the
 * gradient/shadow/type scales are exposed for the new primitives.
 */
const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        /* ---- semantic surface + brand tokens (spec) ---- */
        base: "#1C1C27",
        elevated: "#262633",
        inset: "#2E2E3D",
        stroke: "rgba(255,255,255,0.07)",
        violet: {
          DEFAULT: "#8B5CF6",
          solid: "#8B5CF6",
          deep: "#7B3FE4",
          light: "#A855F7"
        },
        coral: {
          DEFAULT: "#F76B6B",
          solid: "#F76B6B",
          deep: "#F43F5E",
          light: "#FB923C"
        },
        success: "#34D399",
        warning: "#FBBF24",
        danger: "#F43F5E",

        /* ---- re-pointed legacy ramps (dark theme) ---- */
        /* ink-50 = page background ... ink-900 = primary text */
        ink: {
          50: "#1C1C27",
          100: "#262633",
          200: "#2E2E3D",
          300: "#3A3A4A",
          400: "#6E6E82",
          500: "#8E8EA4",
          600: "#A9A9BC",
          700: "#C6C6D6",
          800: "#E2E2EE",
          900: "#FFFFFF",
          950: "#1C1C27"
        },
        /* brand is the primary accent -> violet */
        brand: {
          50: "#2A2440",
          100: "#3A2E5C",
          200: "#4C3A78",
          300: "#7C5CD6",
          400: "#9B7BEA",
          500: "#8B5CF6",
          600: "#7B3FE4",
          700: "#A855F7",
          800: "#C4B5FD",
          900: "#EDE9FE"
        },
        /* gold was the secondary accent -> coral / amber */
        gold: {
          400: "#FBBF24",
          500: "#FB923C",
          600: "#F43F5E"
        }
      },

      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Poppins", "Inter", "system-ui", "sans-serif"]
      },

      /* spec: cards 20px, buttons/inputs 12px, pills 999px */
      borderRadius: {
        xl: "12px",
        "2xl": "20px",
        "3xl": "24px"
      },

      fontSize: {
        eyebrow: ["12px", { lineHeight: "1.2", fontWeight: "600", letterSpacing: "1.5px" }],
        body: ["15px", { lineHeight: "1.75" }],
        card: ["18px", { lineHeight: "1.4", fontWeight: "600" }],
        section: ["22px", { lineHeight: "1.3", fontWeight: "600" }],
        page: ["32px", { lineHeight: "1.2", fontWeight: "600" }],
        stat: ["30px", { lineHeight: "1.1", fontWeight: "700" }],
        hero: ["64px", { lineHeight: "1.05", fontWeight: "700", letterSpacing: "-1px" }]
      },

      backgroundImage: {
        "grad-violet": "linear-gradient(135deg, #7B3FE4 0%, #A855F7 100%)",
        "grad-coral": "linear-gradient(135deg, #F43F5E 0%, #FB923C 100%)",
        "grad-success": "linear-gradient(135deg, #059669 0%, #34D399 100%)",
        "grad-violet-soft": "linear-gradient(135deg, rgba(123,63,228,0.22) 0%, rgba(168,85,247,0.08) 100%)"
      },

      boxShadow: {
        glass: "0 18px 40px rgba(0,0,0,0.45)",
        "glow-violet": "0 10px 28px rgba(123,63,228,0.45)",
        "glow-coral": "0 10px 28px rgba(244,63,94,0.40)",
        ring: "0 0 0 3px rgba(139,92,246,0.18)",
        /* legacy aliases re-pointed off the old navy shadows */
        card: "0 18px 40px rgba(0,0,0,0.45)",
        lift: "0 10px 28px rgba(123,63,228,0.45)",
        glow: "0 0 0 3px rgba(139,92,246,0.18)"
      },

      transitionDuration: {
        DEFAULT: "200ms"
      },

      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-600px 0" },
          "100%": { backgroundPosition: "600px 0" }
        },
        pulseDot: {
          "0%,100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.55", transform: "scale(0.86)" }
        }
      },
      animation: {
        "fade-up": "fadeUp 0.45s ease both",
        shimmer: "shimmer 1.6s linear infinite",
        "pulse-dot": "pulseDot 2s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
