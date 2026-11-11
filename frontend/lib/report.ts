import { DECISIONS, FACADES, METRICS, SIDES,formatMetric, levelOf } from "@/lib/analysis-detail";
import type { Constraints, IndicatorsData } from "@/lib/analysis-detail";
import { formatDate } from "@/lib/format";
import type { Lang } from "@/lib/i18n";
import { fill, resultsCopy } from "@/lib/results-copy";
import type { Role } from "@/lib/user";

export type ReportInput = {
  lang: Lang; // the language of the report (it can differ from the screen language)
  role: Role;
  name: string;
  date: string;
  area: number;
  lat: number;
  lng: number;
  indicators: IndicatorsData;
  constraints: Constraints;
  parcelNote: boolean;
};

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Builds a printable HTML report. The server can later replace this with a real PDF.
export function buildReportHtml(input: ReportInput): string {
  const c = resultsCopy[input.lang];
  const detailed = input.role === "architect";
  const dir = input.lang === "ar" ? "rtl" : "ltr";
  const unit = input.lang === "ar" ? "م²" : "m²";

  const decisions = DECISIONS.map((code) => {
    const item = c.decisions.items[code];
    const text = fill(detailed ? item.detail : item.simple, {
      north: input.constraints.setbacks.north,
      south: input.constraints.setbacks.south,
      east: input.constraints.setbacks.east,
    });
    return `<li><strong>${escapeHtml(item.title)}</strong> — ${escapeHtml(text)}</li>`;
  }).join("");

  const header = METRICS.map((m) => `<th>${escapeHtml(c.indicators.metrics[m])}</th>`).join("");
  const rows = (input.indicators.shown ?? FACADES).map((facade) => {
    const cells = METRICS.map((metric) => {
      const value = input.indicators.facades[facade][metric];
      const text =
        value === null
          ? c.indicators.noWall
          : detailed
            ? formatMetric(metric, value)
            : metric === "wind"
              ? c.indicators.windLevels[levelOf(metric, value)]
              : c.indicators.levels[levelOf(metric, value)];
      return `<td>${escapeHtml(text)}</td>`;
    }).join("");
    return `<tr><th>${escapeHtml(c.facade.names[facade])}</th>${cells}</tr>`;
  }).join("");

  const setbackRows = SIDES.map(
    (facade) =>
      `<li>${escapeHtml(fill(c.constraints.setback, { facade: c.facade.names[facade] }))}: ${input.constraints.setbacks[facade]} m</li>`,
  ).join("");
  const constraints = detailed
    ? `<h2>${escapeHtml(c.constraints.title)}</h2>
       <ul><li>${escapeHtml(c.constraints.maxCoverage)}: ${input.constraints.maxCoverage}%</li>
       <li>${escapeHtml(c.constraints.maxHeight)}: ≈${input.constraints.maxHeight} m</li>${setbackRows}</ul>`
    : "";
  const note = input.parcelNote
    ? `<p class="note">${escapeHtml(fill(c.parcelNote, { area: input.area }))}</p>`
    : "";

  return `<!doctype html>
<html lang="${input.lang}" dir="${dir}">
<head>
<meta charset="utf-8">
<title>${escapeHtml(c.report.title)} — ${escapeHtml(input.name)}</title>
<style>
  body { font-family: system-ui, sans-serif; color: #072A4A; max-width: 760px; margin: 32px auto; padding: 0 20px; line-height: 1.8; }
  h1 { font-size: 26px; margin-bottom: 4px; }
  h2 { font-size: 18px; margin-top: 32px; border-bottom: 2px solid #C08649; padding-bottom: 4px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border: 1px solid #c9d3de; padding: 8px 10px; text-align: start; }
  th { background: #EEF3F8; }
  .meta { color: #4a6076; font-size: 14px; }
  .note { background: #FAF1DE; border: 1px solid #B5790A; padding: 10px 14px; border-radius: 8px; }
  footer { margin-top: 40px; font-size: 12px; color: #4a6076; }
</style>
</head>
<body>
<h1>${escapeHtml(c.report.title)}</h1>
<p class="meta">${escapeHtml(c.report.plot)}: <strong>${escapeHtml(input.name)}</strong> · ${escapeHtml(formatDate(input.date, input.lang))} · ${input.area} ${unit} · ${input.lat.toFixed(5)}, ${input.lng.toFixed(5)}</p>
${note}
<h2>${escapeHtml(c.decisions.title)}</h2>
<ol>${decisions}</ol>
<h2>${escapeHtml(detailed ? c.indicators.titleDetailed : c.indicators.titleSimple)}</h2>
<table><thead><tr><th>${escapeHtml(c.facade.label)}</th>${header}</tr></thead><tbody>${rows}</tbody></table>
${constraints}
<footer>${escapeHtml(c.disclaimer)} ${escapeHtml(c.report.footer)}</footer>
</body>
</html>`;
}

export function downloadHtml(filename: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
