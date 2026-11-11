"use client";

import Badge from "@/components/Badge";
import Button from "@/components/Button";
import Card from "@/components/Card";
import LevelMeter from "@/components/analysis/LevelMeter";
import { NoiseGauge } from "@/components/analysis/SiteGauges";
import StatusMessage from "@/components/analysis/StatusMessage";
import { densityLevelOf } from "@/lib/neighbourhood";
import {
  METRICS,
  formatMetric,
  levelOf,
  metricFraction,
  radiationColor,
  toneOf,
} from "@/lib/analysis-detail";
import type { Facade, IndicatorsData, SiteIndicators } from "@/lib/analysis-detail";
import { fill, useResultsCopy } from "@/lib/results-copy";
import type { MetricKey, Level } from "@/lib/analysis-detail";
import { RADIATION_BADGE, SKY_BADGE, levelFill } from "@/lib/tone-styles";
import type { Role } from "@/lib/user";

// The words shown for a level: wind shelter has its own (protected / exposed), the others low / medium / high.
function useLevelText() {
  const c = useResultsCopy();
  return (metric: MetricKey, level: Level) =>
    metric === "wind" ? c.indicators.windLevels[level] : c.indicators.levels[level];
}

export type IndicatorsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; data: IndicatorsData };

type IndicatorsPanelProps = {
  state: IndicatorsState;
  facade: Facade;
  role: Role;
  onRetry: () => void;
};

// Homeowners see simple levels; architects see precise numbers.
export default function IndicatorsPanel({ state, facade, role, onRetry }: IndicatorsPanelProps) {
  const c = useResultsCopy();
  const levelText = useLevelText();
  const detailed = role === "architect";

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold">
          {detailed ? c.indicators.titleDetailed : c.indicators.titleSimple}
        </h2>
      </div>

      {state.status === "loading" && (
        <div role="status" className="grid gap-4">
          <p className="text-sm text-navy-900/70">{c.indicators.loading}</p>
          {METRICS.map((metric) => (
            <div key={metric} className="h-8 animate-pulse rounded-control bg-navy-50" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-col items-start gap-3">
          <StatusMessage tone="error">
            {c.indicators.errorTitle}. {c.indicators.errorText}
          </StatusMessage>
          <Button variant="secondary" size="sm" onClick={onRetry}>
            {c.indicators.retry}
          </Button>
        </div>
      )}

      {state.status === "ready" && (
      <>
          {detailed && (
            <div className="mb-5 flex justify-center">
              <NoiseGauge site={state.data.site} />
            </div>
          )}
          <p className="mb-4 text-sm text-navy-900/70">
            {fill(c.indicators.forFacade, { facade: c.facade.names[facade] })}
          </p>
          <dl className="grid gap-4">
            {METRICS.map((metric) => {
              const value = state.data.facades[facade][metric];
              if (value === null || value === undefined) {
                return (
                  <div key={metric} className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-navy-900/80">{c.indicators.metrics[metric]}</dt>
                    <dd className="text-navy-900/70">{c.indicators.noWall}</dd>
                  </div>
                );
              }
              const level = levelOf(metric, value);
              return (
                <div key={metric}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <dt className="text-navy-900/80">{c.indicators.metrics[metric]}</dt>
                    <dd className="font-semibold">
                      {detailed ? (
                        <bdi>{formatMetric(metric, value)}</bdi>
                      ) : (
                        metric === "radiation" || metric === "sky" ? (
                          <span className={`inline-block rounded-pill px-3 py-1 text-xs font-semibold ${metric === "sky" ? SKY_BADGE[level] : RADIATION_BADGE[level]}`}>
                            {c.indicators.levels[level]}
                          </span>
                        ) : (
                          <Badge tone={toneOf(metric, level)}>{levelText(metric, level)}</Badge>
                        )
                      )}
                    </dd>
                  </div>
                   {detailed ? (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-pill bg-navy-900/10">
                      <div
                        className={`h-full rounded-pill transition-all duration-500 ${metric === "radiation" ? "" : levelFill(metric, level)}`}
                        style={{
                          width: `${metricFraction(metric, value) * 100}%`,
                          ...(metric === "radiation" ? { backgroundColor: radiationColor(value) } : {}),
                        }}
                      />
                    </div>
                  ) : (
                    <div className="mt-2">
                      <LevelMeter
                        level={level}
                        tone={toneOf(metric, level)}
                        fill={levelFill(metric, level)}
                        label={fill(c.summary.meterLabel, {
                          metric: c.indicators.metrics[metric],
                          level: levelText(metric, level),
                        })}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </dl>
        </>
      )}
    </Card>
  );
}

// Site-wide indicators. Shown to architects only, once the data has loaded.
export function SiteIndicatorsCard({ site }: { site: SiteIndicators }) {
  const c = useResultsCopy();
  const s = c.site;
  const densityLevel =
    site.density === null
     ? null
     : densityLevelOf(site.density, site.densityLevel);
  const rows: { label: string; value: string }[] = [
    { label: s.windSpeed, value: `${site.windSpeed} m/s` },
    { label: s.windFrom, value: c.facade.names[site.windFrom] },
    { label: s.temperature, value: `${site.temperature} °C` },
    { label: s.density,value:site.density === null || densityLevel === null? "—": `${Math.round(site.density).toLocaleString()} شخص/كم² · ${s.densityLevels[densityLevel]}`,},
    { label: s.avgHeight, value: site.avgHeight === null ? "—" : `${site.avgHeight} m` },
    { label: s.maxHeight, value: site.maxHeight === null ? "—" : `${site.maxHeight} m` },
  ];

  return (
    <Card>
      <h2 className="mb-4 text-sm font-bold">{s.title}</h2>
      <dl className="grid gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="text-navy-900/70">{row.label}</dt>
            <dd className="font-semibold">
              <bdi>{row.value}</bdi>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

