import { toneOf } from "@/lib/analysis-detail";
import type { Level, MetricKey, Tone } from "@/lib/analysis-detail";

// One place for the indicator colors: green, yellow, red.
// To change a color, change it here only.
export const TONE_FILL: Record<Tone, string> = {
  success: "bg-success-500",
  caution: "bg-warning-400",
  danger: "bg-danger-500",
  neutral: "bg-navy-700",
};

// Solar radiation levels (team decision): low green, medium orange, high red.
// The map and the bars use shades between them (radiationColor in analysis-detail).
export const RADIATION_FILL: Record<Level, string> = {
  low: "bg-success-500",
  medium: "bg-caution-500",
  high: "bg-danger-500",
};

export const RADIATION_BADGE: Record<Level, string> = {
  low: "bg-success-50 text-success-500",
  medium: "bg-caution-50 text-caution-700",
  high: "bg-danger-50 text-danger-500",
};

// Sky view levels (team decision): low green, medium yellow, high orange.
export const SKY_FILL: Record<Level, string> = {
  low: "bg-success-500",
  medium: "bg-warning-400",
  high: "bg-caution-500",
};

export const SKY_BADGE: Record<Level, string> = {
  low: "bg-success-50 text-success-500",
  medium: "bg-caution-50 text-caution-700",
  high: "bg-gold-100 text-gold-700",
};

// The indicators' level colors: green = good, orange = in between, red = bad.
const INDICATOR_FILL: Record<Tone, string> = {
  success: "bg-success-500",
  caution: "bg-caution-500",
  danger: "bg-danger-500",
  neutral: "bg-navy-700",
};

// The fill class for a metric's level: radiation uses its own colors, the others green / orange / red.
export function levelFill(metric: MetricKey, level: Level): string {
  if (metric === "radiation") return RADIATION_FILL[level];
  if (metric === "sky") return SKY_FILL[level];
  return INDICATOR_FILL[toneOf(metric, level)];
}

export const TONE_TEXT: Record<Tone, string> = {
  success: "text-success-500",
  caution: "text-caution-700",
  danger: "text-danger-500",
  neutral: "text-navy-900/70",
};
