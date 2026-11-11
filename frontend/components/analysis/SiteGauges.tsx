"use client";

import Gauge from "@/components/analysis/Gauge";
import type { SiteIndicators } from "@/lib/analysis-detail";
import {
  badnessTone,
  densityFraction,
  densityLevelOf,
  noiseFraction,
} from "@/lib/neighbourhood";
import { fill, useResultsCopy } from "@/lib/results-copy";

export function NoiseGauge({ site }: { site: SiteIndicators }) {
  const c = useResultsCopy();

  // The noise level could not be loaded
  if (site.noise === null) {
    return (
      <Gauge
        fraction={0}
        tone="caution"
        label={c.site.noise}
        levelText="—"
        valueText="—"
        ariaLabel={c.site.noise}
      />
    );
  }

  const level = site.noise;
  const levelText = c.indicators.levels[level];
  const reason = site.noiseReason;
  return (
    <Gauge
      fraction={noiseFraction(level)}
      tone={badnessTone(level)}
      label={c.site.noise}
      levelText={levelText}
      valueText={
        reason
          ? fill(c.site.noiseReason, { road: c.site.roadClasses[reason.roadClass], meters: Math.round(reason.distance) })
          : c.site.noiseNone
      }
      ariaLabel={fill(c.hood.gaugeLabel, { metric: c.site.noise, level: levelText })}
    />
  );
}


export function DensityGauge({ site }: { site: SiteIndicators }) {
  const c = useResultsCopy();

  // No density data available for this neighborhood
  if (site.density === null) {
    return (
      <Gauge
        fraction={0}
        tone="caution"
        label={c.site.density}
        levelText="—"
        valueText="—"
        ariaLabel={c.site.density}
      />
    );
  }

  const level = densityLevelOf(site.density, site.densityLevel);
  const levelText = c.site.densityLevels[level];

  return (
    <Gauge
      fraction={densityFraction(site.density)}
      tone={badnessTone(level)}
      label={c.site.density}
      levelText={levelText}
      valueText={`${Math.round(site.density).toLocaleString()} ${c.site.densityUnit}`}
      ariaLabel={fill(c.hood.gaugeLabel, {
        metric: c.site.density,
        level: levelText,
      })}
    />
  );
}

