/**
 * Chart + SVG colour tokens — the ONLY sanctioned source of literal colour for
 * Recharts and inline SVG. Mirrors the CSS custom properties in globals.css.
 */
export const CHART = {
  violet: "#8B5CF6",
  violetDeep: "#7B3FE4",
  violetLight: "#A855F7",
  coral: "#F76B6B",
  coralDeep: "#F43F5E",
  coralLight: "#FB923C",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#F43F5E",
  muted: "#6E6E82",
  axis: "#6E6E82",
  grid: "rgba(255,255,255,0.05)",
  gridStrong: "rgba(255,255,255,0.09)",
  track: "rgba(255,255,255,0.07)",
  elevated: "#262633",
  inset: "#2E2E3D",
  gradViolet: ["#7B3FE4", "#A855F7"] as [string, string],
  gradCoral: ["#F43F5E", "#FB923C"] as [string, string],
  gradSuccess: ["#059669", "#34D399"] as [string, string]
} as const;

export const CHART_TOOLTIP_STYLE = {
  background: "rgba(38,38,51,0.96)",
  border: "1px solid rgba(255,255,255,0.10)",
  borderRadius: 14,
  boxShadow: "0 18px 40px rgba(0,0,0,0.5)",
  color: "#fff",
  fontSize: 12.5,
  padding: "10px 12px"
} as const;

export const CHART_AXIS_PROPS = {
  stroke: CHART.axis,
  fontSize: 11.5,
  tickLine: false,
  axisLine: false
} as const;

export const CHART_GRID_PROPS = {
  stroke: CHART.grid,
  strokeDasharray: "4 4",
  vertical: false
} as const;
