"use client";

import type { ReactNode, Ref } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import StatusMessage from "@/components/analysis/StatusMessage";
import { useResultsCopy } from "@/lib/results-copy";

type DiagramFrameProps = {
  title: string;
  subtitle?: string;
  status: "loading" | "error" | "ready";
  onRetry: () => void;
  boxRef: Ref<HTMLDivElement>; // lets the diagram measure the box
  legend?: ReactNode; // shown under the drawing, so a long legend never covers it
  children: ReactNode;
};

// A card with a title and a tall box for a diagram. While the data loads or fails,
// the box shows a message instead.
export default function DiagramFrame({
  title,
  subtitle,
  status,
  onRetry,
  boxRef,
  legend,
  children,
}: DiagramFrameProps) {
  const c = useResultsCopy();

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-bold">{title}</h3>
        {subtitle && <p className="mt-1 min-h-4 text-xs text-navy-900/70">{subtitle}</p>}
      </div>

      <div
        ref={boxRef}
        role="img"
        aria-label={title}
        className="relative isolate aspect-[3/4] overflow-hidden rounded-card border border-navy-900/15 bg-white"
      >
        {children}

        {status === "loading" && (
          <div
            role="status"
            className="absolute inset-0 z-[3] flex animate-pulse items-center justify-center bg-navy-50/80 text-sm text-navy-900/70"
          >
            {c.diagrams.loading}
          </div>
        )}

        {status === "error" && (
          <div className="absolute inset-0 z-[3] flex flex-col items-center justify-center gap-3 bg-white/95 p-4 text-center">
            <StatusMessage tone="error">{c.diagrams.error}</StatusMessage>
            <Button variant="secondary" size="sm" onClick={onRetry}>
              {c.diagrams.retry}
            </Button>
          </div>
        )}
      </div>

      {legend}
    </Card>
  );
}
