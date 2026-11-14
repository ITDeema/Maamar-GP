"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/Button";
import Card from "@/components/Card";
import { DensityGauge, NoiseGauge } from "@/components/analysis/SiteGauges";
import StatusMessage from "@/components/analysis/StatusMessage";
import type { SiteIndicators } from "@/lib/analysis-detail";
import type { Loadable } from "@/lib/loadable";
import { serviceList } from "@/lib/analysis-detail";
import type { Service } from "@/lib/neighbourhood";
import { useResultsCopy } from "@/lib/results-copy";
import { fetchServices } from "@/lib/site-api";

// Homeowners: two gauges (noise, density) and the nearest services.
// The services are saved with the analysis. When they are missing (they could not be loaded then), the card
// loads them on its own (if they fail, only this list shows an error) and hands them back with onLoaded.
export default function NeighbourhoodCard({
  site,
  lat,
  lng,
  services,
  onStatus,
  onLoaded,
}: {
  site: SiteIndicators;
  lat: number;
  lng: number;
  services?: Service[] | null;
  onStatus?: (status: "loading" | "ready" | "error") => void;
  onLoaded?: (services: Service[]) => void;
}) {
  const c = useResultsCopy();
  const [state, setState] = useState<Loadable<Service[]>>(
    services ? { status: "ready", data: services } : { status: "loading" },
  );
  const haveServices = Boolean(services);
  // the latest callback, without loading the services again when it changes
  const loaded = useRef(onLoaded);
  useEffect(() => {
    loaded.current = onLoaded;
  }, [onLoaded]);
  const [attempt, setAttempt] = useState(0);
    useEffect(() => {
    onStatus?.(state.status);
  }, [state.status, onStatus]);

  useEffect(() => {
    if (haveServices) return; // saved with the analysis
    const controller = new AbortController();
    fetchServices(lat, lng, controller.signal)
      .then((data) => {
        const list = serviceList(data);
        setState({ status: "ready", data: list });
        loaded.current?.(list);
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError" && controller.signal.aborted) return;
        setState({ status: "error" });
      });
    return () => controller.abort();
  }, [lat, lng, attempt, haveServices]);

  function retry() {
    setState({ status: "loading" });
    setAttempt((value) => value + 1);
  }

  return (
    <Card>
      <h2 className="mb-4 text-sm font-bold">{c.hood.title}</h2>
      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-1 text-xs font-bold text-navy-900/70">{c.hood.services}</h3>
          <p className="mb-3 text-xs text-navy-900/70">{c.hood.servicesHint}</p>

          {state.status === "loading" && (
            <p role="status" className="text-sm text-navy-900/70">
              {c.hood.loading}
            </p>
          )}

          {state.status === "error" && (
            <div className="flex flex-col items-start gap-3">
              <StatusMessage tone="error">{c.hood.error}</StatusMessage>
              <Button variant="secondary" size="sm" onClick={retry}>
                {c.hood.retry}
              </Button>
            </div>
          )}

          {state.status === "ready" && (
            <dl className="grid gap-3 text-sm">
              {state.data.map((service) => (
                <div
                  key={service.kind}
                  className="flex items-center justify-between gap-3 border-b border-navy-900/10 pb-3 last:border-b-0 last:pb-0"
                >
                  <dt className="text-navy-900/80">{c.hood.kinds[service.kind]}</dt>
                  <dd className="font-semibold">
                    {service.distance == null ? (
                      <span className="font-normal text-navy-900/70">{c.hood.none}</span>
                    ) : (
                      <bdi>{`${Math.round(service.distance)} m`}</bdi>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <NoiseGauge site={site} />
          <DensityGauge site={site} />
        </div>
      </div>
    </Card>
  );
}
