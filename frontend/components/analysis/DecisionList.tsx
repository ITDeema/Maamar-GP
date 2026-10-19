"use client";

import Badge from "@/components/Badge";
import Card from "@/components/Card";
import { DECISIONS, formatMetric } from "@/lib/analysis-detail";
import type {
  Constraints,
  DecisionCode,
  Facade,
  IndicatorsData,
  MetricKey,
} from "@/lib/analysis-detail";
import { fill, useResultsCopy } from "@/lib/results-copy";
import type { Role } from "@/lib/user";

type DecisionListProps = {
  role: Role;
  indicators: IndicatorsData | null; // null while loading or if loading failed
  constraints: Constraints;
};

type Chip = { label: string; value: string };

export default function DecisionList({ role, indicators, constraints }: DecisionListProps) {
  const c = useResultsCopy();
  const detailed = role === "architect";

  // the numbers each decision is based on (shown to architects, kept apart from the decision)
  function supporting(code: DecisionCode): Chip[] {
    const metric = (key: MetricKey, facade: Facade): Chip | null =>
      indicators
        ? {
            label: `${c.indicators.metrics[key]} · ${c.facade.names[facade]}`,
            value: formatMetric(key, indicators.facades[facade][key]),
          }
        : null;
    const chips: (Chip | null)[] =
      code === "orientation"
        ? [metric("radiation", "north"), metric("radiation", "south")]
        : code === "windows"
          ? [metric("radiation", "west")]
          : code === "shading"
            ? [metric("shade", "south"), metric("radiation", "south")]
            
         : code === "garden"
            ? [metric("shade", "east")]
         : code === "materials"
           ? [
             metric("radiation", "east"),
               indicators
          ? {
              label: c.site.noise,
              value: `${indicators.site.noise} dB`,
            }
          : null,
      ]
    : [];

    return chips.filter((chip): chip is Chip => chip !== null);
  }

  return (
    <Card>
      <h2 className="text-sm font-bold">{c.decisions.title}</h2>
      <p className="mb-4 mt-1 text-xs font-semibold text-success-500">✓ {c.decisions.note}</p>

      <ol className="grid gap-3">
        {DECISIONS.map((code, index) => {
          const item = c.decisions.items[code];
          const text = fill(detailed ? item.detail : item.simple, {
            north: constraints.setbacks.north,
            south: constraints.setbacks.south,
            east: constraints.setbacks.east,
          });
          const chips = detailed ? supporting(code) : [];
          return (
            <li key={code} className="flex gap-3 rounded-card border border-navy-900/10 p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-pill bg-navy-900 text-xs font-bold text-white">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-heading text-base font-bold">{item.title}</h3>
                  <Badge tone="success">✓ {c.decisions.ok}</Badge>
                </div>
                <p className="mt-1.5 text-sm leading-7 text-navy-900/80">{text}</p>
                {chips.length > 0 && (
                  <div className="mt-3 border-t border-navy-900/10 pt-3">
                    <p className="mb-2 text-xs font-semibold text-navy-900/70">
                      {c.decisions.supporting}
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {chips.map((chip) => (
                        <li
                          key={chip.label}
                          className="rounded-pill bg-navy-50 px-3 py-1 text-xs text-navy-900"
                        >
                          {chip.label}: <bdi className="font-semibold">{chip.value}</bdi>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}