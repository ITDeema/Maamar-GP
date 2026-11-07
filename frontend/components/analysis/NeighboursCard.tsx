"use client";

import Card from "@/components/Card";
import type { Facade } from "@/lib/analysis-detail";
import { neighboursFor, neighboursFrom } from "@/lib/neighbourhood";
import type { FacadeNeighbours } from "@/lib/site-api";
import { fill, useResultsCopy } from "@/lib/results-copy";

// Architects: what stands next to the selected façade (kind, height, distance).
// Only what exists is listed.
// The real neighbours come from the backend (dataset columns); without them, sample rows are shown.
export default function NeighboursCard({ facade, data }: { facade: Facade; data: FacadeNeighbours | null }) {
  const c = useResultsCopy();
  const real = data ? neighboursFrom(data) : null;
  const rows = real === null ? neighboursFor(facade) : real === "noWall" ? [] : real;

  return (
    <Card>
      <h2 className="text-sm font-bold">{c.neighbours.title}</h2>
      <p className="mb-4 mt-1 text-xs text-navy-900/70">
        {fill(c.neighbours.hint, { facade: c.facade.names[facade] })}
      </p>

      {real === "noWall" ? (
        <p className="text-sm text-navy-900/70">{c.indicators.noWall}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-navy-900/70">{c.neighbours.empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-navy-900/70">
                <th scope="col" className="pb-2 text-start font-semibold">{c.neighbours.cols.kind}</th>
                <th scope="col" className="pb-2 text-start font-semibold">{c.neighbours.cols.height}</th>
                <th scope="col" className="pb-2 text-start font-semibold">{c.neighbours.cols.distance}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.kind}-${index}`} className="border-t border-navy-900/10">
                  <th scope="row" className="py-2 text-start font-semibold">{c.neighbours.kinds[row.kind]}</th>
                  <td className="py-2 text-start">
                    <bdi>{row.height == null ? "—" : `${row.height} m`}</bdi>
                  </td>
                  <td className="py-2 text-start">
                    <bdi>{row.distance == null ? "—" : `${row.distance} m`}</bdi>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
