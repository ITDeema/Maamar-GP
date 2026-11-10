
"use client";

import Link from "next/link";
import Card from "@/components/Card";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useResults } from "@/lib/results";

export default function HomePage() {
  const { t, lang } = useT();
  const { results, loaded, loadError } = useResults();

  
  const recentProjects = [...results]
    .sort((a, b) => {
      if (a.lastOpenedAt && b.lastOpenedAt) {
        return b.lastOpenedAt.localeCompare(a.lastOpenedAt);
      }

      if (a.lastOpenedAt) return -1;
      if (b.lastOpenedAt) return 1;

      return b.date.localeCompare(a.date);
    })
    .slice(0, 3);


  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-10">
      <section>
        <h1 className="font-heading text-3xl font-bold text-navy-900">
          {t("home.title")}
        </h1>
        <p className="mt-2 text-sm text-navy-900/70">
          {t("home.subtitle")}
        </p>
      </section>

      <section className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-heading text-xl font-bold text-navy-900">
            {t("home.recent")}
          </h2>

          <Link
            href="/history"
            className="text-sm font-semibold text-gold-700 underline"
          >
            {t("home.viewAll")}
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/select-plot"
            className="group block h-full rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-700"
          >
            <Card className="flex h-full min-h-52 flex-col items-center justify-center gap-4 border-2 border-dashed border-gold-700/60 text-center transition-colors group-hover:bg-navy-50">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-navy-900 text-3xl font-light text-white">
                +
              </span>
              <div>
                <h3 className="font-heading font-bold text-navy-900">
                  {t("home.newProject")}
                </h3>
                <p className="mt-2 text-xs text-navy-900/70">
                  {t("home.newProjectHint")}
                </p>
              </div>
            </Card>
          </Link>

          {recentProjects.map((project) => (
            <Card
              key={project.id}
              className="flex min-h-52 flex-col gap-4"
            >
              <div>
                <h3 className="font-heading text-base font-bold">
                  {project.name}
                </h3>

                <p className="mt-2 text-sm text-navy-900/70">
                  {project.area} {t("unit.sqm")}
                </p>

                <p className="mt-1 text-sm text-navy-900/70">
                  {formatDate(project.date, lang)}
                </p>
              </div>

              <Link
                href={`/results/${project.id}`}
                className="mt-auto inline-flex items-center gap-2 text-sm font-semibold text-gold-700 underline"
              >
                {t("common.viewResults")}
                <span aria-hidden="true">↗</span>
              </Link>
            </Card>
          ))}
        </div>

        {loaded && !loadError && recentProjects.length === 0 && (
          <div className="rounded-card border border-navy-900/10 p-6 text-center">
            <h3 className="font-semibold">{t("home.empty")}</h3>
            <p className="mt-2 text-sm text-navy-900/70">
              {t("home.emptyHint")}
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
