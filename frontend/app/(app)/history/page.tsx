"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import RenameResultModal from "@/components/RenameResultModal";
import SearchInput from "@/components/SearchInput";
import StatusMessage from "@/components/analysis/StatusMessage";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useResults } from "@/lib/results";
import type { AnalysisResult } from "@/lib/results";

export default function HistoryPage() {
  const { t, lang } = useT();
  const { results, loaded, loadError } = useResults();
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<AnalysisResult | null>(null);

  const visible = results.filter((r) =>
    r.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">{t("history.title")}</h1>
        <p className="mt-1 text-sm text-navy-900/70">{t("history.subtitle")}</p>
      </div>

      {loadError ? (
        <StatusMessage tone="error">{t("common.loadError")}</StatusMessage>
      ) : !loaded ? null : results.length === 0 ? (
        <EmptyState title={t("history.empty")} />
      ) : (
        <>
          <SearchInput
            label={t("common.searchByName")}
            placeholder={t("common.searchByName")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />

          {visible.length === 0 ? (
            <EmptyState title={t("common.noMatches")} />
          ) : (
            <Card className="relative overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-navy-900/15 text-xs text-navy-900/70">
                    <th scope="col" className="px-3 py-3 text-start font-semibold">
                      {t("history.colDate")}
                    </th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">
                      {t("history.colName")}
                    </th>
                    <th scope="col" className="px-3 py-3 text-start font-semibold">
                      {t("history.colArea")}
                    </th>
                    <th scope="col" className="px-3 py-3 text-start">
                      <span className="sr-only">{t("history.colActions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-navy-900/10">
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-4 text-navy-900/70">
                        {formatDate(r.date, lang)}
                      </td>
                      <th scope="row" className="px-3 py-4 text-start font-semibold">
                        {r.name}
                      </th>
                      <td className="px-3 py-4 text-navy-900/70">
                        {r.area} {t("unit.sqm")}
                      </td>
                      <td className="px-3 py-4">
                        <div className="flex items-center gap-3">
                          <Link
                            // TODO: this page is built by the results-dashboard owner.
                            href={`/results/${r.id}`}
                            className="text-sm font-semibold text-gold-700 underline"
                          >
                            {t("common.viewResults")}
                          </Link>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setRenaming(r)}
                          >
                            {t("common.rename")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </>
      )}

      <RenameResultModal result={renaming} onClose={() => setRenaming(null)} />
    </main>
  );
}