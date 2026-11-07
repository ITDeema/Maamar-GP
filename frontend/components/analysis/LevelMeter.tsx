import type { Level, Tone } from "@/lib/analysis-detail";
import { TONE_FILL } from "@/lib/tone-styles";

const STEPS: Level[] = ["low", "medium", "high"];

// Three segments: one filled for low, two for medium, three for high.
export default function LevelMeter({
  level,
  tone,
  fill,
  label,
}: {
  level: Level;
  tone: Tone;
  fill?: string; // a fill class that replaces the tone's color (radiation has its own colors)
  label: string; // read by screen readers
}) {
  const filled = STEPS.indexOf(level) + 1;
  return (
    <div role="img" aria-label={label} className="flex gap-1">
      {STEPS.map((step, index) => (
        <span
          key={step}
          className={`h-1.5 flex-1 rounded-pill ${index < filled ? (fill ?? TONE_FILL[tone]) : "bg-navy-900/10"}`}
        />
      ))}
    </div>
  );
}
