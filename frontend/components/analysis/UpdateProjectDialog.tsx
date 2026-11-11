"use client";

import { useEffect, useId, useState } from "react";
import Button from "@/components/Button";
import { fill, useResultsCopy } from "@/lib/results-copy";
import type { Role } from "@/lib/user";

type Props = {
  open: boolean;
  oldRole: Role | null; // the account type the analysis was made with, when it differs from the current one
  old: boolean; // the analysis is more than 6 months old
  onUpdate: () => Promise<boolean>; // updates this project (new account type, calculated again when old)
  onNewAnalysis: () => void; // a new analysis of the same plot; this project stays as it is
  onClose: () => void; // the ✕: keeps showing the dashboard as it was saved
};

// A small pop-up when the analysis no longer fits: the account type changed, or it is more than 6 months old.
export default function UpdateProjectDialog({ open, oldRole, old, onUpdate, onNewAnalysis, onClose }: Props) {
  const c = useResultsCopy().roleDialog;
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  async function update() {
    setBusy(true);
    setFailed(false);
    const ok = await onUpdate();
    setBusy(false);
    if (ok) onClose();
    else setFailed(true);
  }

  const title = oldRole && old ? c.titleBoth : oldRole ? c.title : c.titleOld;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/40 p-4" onClick={busy ? undefined : onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm rounded-card bg-white p-5 shadow-overlay"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          aria-label={c.close}
          className="absolute end-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-navy-900/60 transition-colors hover:bg-navy-50 hover:text-navy-900 disabled:opacity-40"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="h-4 w-4" aria-hidden="true">
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>

        <h2 id={titleId} className="pe-8 font-heading text-base font-bold">
          {title}
        </h2>
        <div className="mt-2 text-sm leading-6 text-navy-900/75">
          {oldRole && <p>{fill(c.text, { old: c.roles[oldRole] })}</p>}
          {old && <p>{c.textOld}</p>}
        </div>

        {failed && (
          <p role="alert" className="mt-2 text-sm text-danger-500">
            {c.error}
          </p>
        )}

        {/* the first button sits on the start side (the right in Arabic) */}
        <div className="mt-4 flex gap-2">
          <Button size="sm" onClick={update} disabled={busy} className="flex-1">
            {busy ? c.updating : c.update}
          </Button>
          <Button size="sm" variant="secondary" onClick={onNewAnalysis} disabled={busy} className="flex-1">
            {c.newAnalysis}
          </Button>
        </div>
      </div>
    </div>
  );
}
