"use client";

import { useState } from "react";
import Link from "next/link";
import Button from "@/components/Button";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import RenameResultModal from "@/components/RenameResultModal";
import SearchInput from "@/components/SearchInput";
import StatusMessage from "@/components/analysis/StatusMessage";
import { formatDate } from "@/lib/format";
import { useT } from "@/lib/i18n";
import { useResults } from "@/lib/results";
import type { AnalysisResult } from "@/lib/results";

export default function SavedPage() {
  const { t, lang } = useT();
  const { results, loaded, loadError, setSaved } = useResults();
  const [query, setQuery] = useState("");
  const [renaming, setRenaming] = useState<AnalysisResult | null>(null);
  const [removing, setRemoving] = useState<AnalysisResult | null>(null);

  const saved = results.filter((r) => r.saved);
  const visible = saved.filter((r) =>
    r.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function confirmRemove() {
    if (removing) setSaved(removing.id, false);
    setRemoving(null);
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-6 py-8">
      <div>
        <h1 className="font-heading text-2xl font-bold">{t("saved.title")}</h1>
        <p className="mt-1 text-sm text-navy-900/70">{t("saved.subtitle")}</p>
      </div>

      {loadError ? (
        <StatusMessage tone="error">{t("common.loadError")}</StatusMessage>
      ) : !loaded ? null : saved.length === 0 ? (
        <EmptyState title={t("saved.empty")} hint={t("saved.emptyHint")} />
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
            <ul className="grid gap-4 sm:grid-cols-2">
              {visible.map((r) => (
                <li key={r.id}>
                  <Card className="flex h-full flex-col gap-4">
                    <div>
                      <h2 className="font-heading text-base font-bold">
                        {r.name}
                      </h2>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-navy-900/70">
                        <span>
                          {r.area} {t("unit.sqm")}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(r.date, lang)}</span>
                      </p>
                    </div>
                    <div className="mt-auto flex flex-wrap items-center justify-between gap-3">
                      <Link
                        // TODO: this page is built by the results-dashboard owner.
                        href={`/results/${r.id}`}
                        className="flex items-center gap-1 text-sm font-semibold text-gold-700 underline"
                      >
                        {t("common.viewResults")}
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="flip-rtl h-4 w-4"
                        >
                          <path d="M5 12h14m-6-6 6 6-6 6" />
                        </svg>
                      </Link>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setRenaming(r)}
                        >
                          {t("common.rename")}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setRemoving(r)}
                        >
                          {t("saved.remove")}
                        </Button>
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <RenameResultModal result={renaming} onClose={() => setRenaming(null)} />

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t("saved.remove")}
      >
        <p className="text-sm text-navy-900/70">
          {t("saved.removeBody", { name: removing?.name ?? "" })}
        </p>
        <div className="mt-6 flex gap-3">
          <Button onClick={confirmRemove}>{t("saved.removeConfirm")}</Button>
          <Button variant="secondary" onClick={() => setRemoving(null)}>
            {t("common.cancel")}
          </Button>
        </div>
      </Modal>
    </main>
  );
}