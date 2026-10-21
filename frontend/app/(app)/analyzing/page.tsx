"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { usePlotCopy } from "@/components/analysis/usePlotCopy";
import { ANALYSIS_STEPS, runAnalysis } from "@/lib/analysis";
import { useResults } from "@/lib/results";

type Status = "running" | "failed" | "done";

function readNumber(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 animate-spin text-gold-600" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function AnalyzingContent() {
  const c = usePlotCopy().analyzing;
  const router = useRouter();
  const params = useSearchParams();
  const { addResult } = useResults();
  const [status, setStatus] = useState<Status>("running");
  const [step, setStep] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const lat = readNumber(params.get("lat"));
  const lng = readNumber(params.get("lng"));
  const area = readNumber(params.get("area"));
  const demo = params.get("demo");
  const villaTypeParam = params.get("villaType");

  const villaType =
  villaTypeParam === "attachedBoth" ||
  villaTypeParam === "attachedOne" ||
  villaTypeParam === "detached"
    ? villaTypeParam
    : null;
  const valid =
  lat !== null && lng !== null && area !== null && villaType !== null;
  useEffect(() => {
    if (lat === null || lng === null || area === null || villaType === null) {
      router.replace("/select-plot");
      return;
    }

    const controller = new AbortController();
    let redirect: ReturnType<typeof setTimeout> | undefined;

    runAnalysis({ lat, lng, area, demo }, setStep, controller.signal)
      .then(() => {
        const id = addResult({
          namePrefix: c.defaultName,
          area,
          lat,
          lng,
          villaType,
       });
        setStatus("done");
        redirect = setTimeout(() => router.replace(`/results/${id}`), 900);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("failed"); // never show incomplete results as a finished analysis
      });

    return () => {
      controller.abort();
      clearTimeout(redirect);
    };
  }, [attempt, lat, lng, area, demo, villaType, router, addResult, c.defaultName]);

  function retry() {
    setStatus("running");
    setStep(0);
    setAttempt((value) => value + 1);
  }

  if (!valid) return null;

  const progress = status === "done" ? 100 : (step / ANALYSIS_STEPS.length) * 100;

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-5 px-4 py-12 sm:px-6">
      <div className="text-center">
        <h1 className="font-heading text-2xl font-bold">
          {status === "failed" ? c.failTitle : c.title}
        </h1>
        <p className="mt-2 text-sm text-navy-900/70">
          {status === "failed" ? c.failText : c.subtitle}
        </p>
      </div>

      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="h-1.5 overflow-hidden rounded-pill bg-navy-900/10"
      >
        <div
          className={`h-full rounded-pill transition-all duration-700 ${status === "failed" ? "bg-danger-500" : "bg-gold-500"}`}
          style={{ width: `${progress}%` }}
        />
      </div>

      <Card>
        <ol className="flex flex-col gap-4">
          {c.steps.map((label, i) => {
            const failed = status === "failed" && i === step;
            const done = status === "done" || i < step;
            const current = status === "running" && i === step;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center">
                  {done ? (
                    <span className="flex h-6 w-6 items-center justify-center rounded-pill bg-success-50 text-success-500">
                      <CheckIcon />
                    </span>
                  ) : current ? (
                    <Spinner />
                  ) : (
                    <span
                      className={`h-5 w-5 rounded-pill border-2 ${failed ? "border-danger-500" : "border-navy-900/20"}`}
                    />
                  )}
                </span>
                <span
                  className={
                    failed
                      ? "font-semibold text-danger-500"
                      : done || current
                        ? "font-semibold"
                        : "text-navy-900/60"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>

      {status === "done" && (
        <p role="status" className="text-center text-sm font-semibold text-success-500">
          {c.done}
        </p>
      )}

      {status === "failed" && (
        <div className="flex flex-wrap justify-center gap-3">
          <Button onClick={retry}>{c.retry}</Button>
          <Link
            href="/select-plot"
            className="rounded-control border border-navy-900/15 bg-white px-5 py-3 text-sm font-semibold text-navy-900 transition-colors hover:bg-navy-50"
          >
            {c.back}
          </Link>
        </div>
      )}
    </main>
  );
}

export default function AnalyzingPage() {
  return (
    <Suspense>
      <AnalyzingContent />
    </Suspense>
  );
}