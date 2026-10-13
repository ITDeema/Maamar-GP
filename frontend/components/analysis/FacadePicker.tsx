
"use client";

import { useId } from "react";
import type { Facade } from "@/lib/analysis-detail";

// Eight directions arranged like a compass.
// The center remains empty to preserve the layout.
const GRID: (Facade | null)[] = [
  "northwest", "north", "northeast",
  "west", null, "east",
  "southwest", "south", "southeast",
];

type FacadePickerProps = {
  label: string;
  value: Facade;
  onChange: (value: Facade) => void;
  names: Record<Facade, string>;
};

export default function FacadePicker({
  label,
  value,
  onChange,
  names,
}: FacadePickerProps) {
  const name = useId();

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-semibold text-navy-900">
        {label}
      </legend>

      {/* Keep compass directions consistent in Arabic and English */}
      <div dir="ltr" className="mx-auto grid max-w-md grid-cols-3 gap-2">
        {GRID.map((facade, index) =>
          facade === null ? (
            <span
              key={`empty-${index}`}
              aria-hidden="true"
              className="invisible"
            />
          ) : (
            <label key={facade}>
              <input
                type="radio"
                name={name}
                value={facade}
                checked={value === facade}
                onChange={() => onChange(facade)}
                className="peer sr-only"
              />

              <span
                className="
                  block cursor-pointer rounded-control border
                  border-navy-900/15 bg-white px-2 py-3
                  text-center text-sm font-semibold text-navy-900
                  transition-colors

                  hover:bg-navy-50

                  peer-checked:border-navy-900
                  peer-checked:bg-navy-900
                  peer-checked:text-white

                  peer-checked:hover:bg-navy-900
                  peer-checked:hover:text-white

                  peer-focus-visible:outline-2
                  peer-focus-visible:outline-offset-2
                  peer-focus-visible:outline-navy-700
                "
              >
                {names[facade]}
              </span>
            </label>
          ),
        )}
      </div>
    </fieldset>
  );
}
