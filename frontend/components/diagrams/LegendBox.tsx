import type { ReactNode } from "react";

// The legend under a diagram, in two columns: a long legend grows down instead of covering the drawing.
export default function LegendBox({ children }: { children: ReactNode }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-x-4 gap-y-2 p-0 text-xs text-navy-900">
      {children}
    </ul>
  );
}

export function LegendRow({ swatch, label }: { swatch: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="flex w-10 shrink-0 items-center justify-center">{swatch}</span>
      <span>{label}</span>
    </li>
  );
}
