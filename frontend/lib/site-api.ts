// Requests for the analysis diagrams: our backend (sun path, places, buildings)
// and OpenStreetMap (roads, land use). Set NEXT_PUBLIC_API_URL for a deployed backend.

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");

/* ---------- types ---------- */

export type SunPoint = { hour: number; azimuth: number; altitude: number };
export type SunPath = {
  arcs: { summer: SunPoint[]; equinox: SunPoint[]; winter: SunPoint[] };
};

export type WindDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type Wind = {
  frequencies: Record<WindDirection, number>; // % of the windy hours, by the direction the wind comes from
  dominant: WindDirection; // the direction the wind comes from most often
  meanSpeed: number; // m/s
  calmShare: number; // % of the hours below 0.5 m/s
  hours: number;
};

export type Poi = { id: string; name: string; lat: number; lon: number; cats: string[] };

export type RawBuilding = {
  pts: [number, number][]; // [lat, lon]
  subtype: string | null;
  class: string | null;
};

export type ServicesResponse = {
  radius: number; // meters
  services: Record<string, { count: number; nearest: number | null }>;
};

export type Tags = Record<string, string | undefined>;
export type OsmPoint = { lat: number; lon: number };
export type OsmElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  tags?: Tags;
  geometry?: OsmPoint[];
  members?: { role: string; geometry?: OsmPoint[] }[];
};
export type OverpassResult = { elements: OsmElement[] };

/* ---------- helpers ---------- */

// A request that stops after `ms`, or when the page stops waiting for it.
function limited(parent: AbortSignal | undefined, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const onAbort = () => controller.abort();
  if (parent?.aborted) controller.abort();
  parent?.addEventListener("abort", onAbort, { once: true });
  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      parent?.removeEventListener("abort", onAbort);
    },
  };
}

/* ---------- our backend ---------- */

// Throws when the sun path cannot be loaded: a sun diagram without the sun would mislead.
export async function fetchSunPath(lat: number, lng: number, signal?: AbortSignal): Promise<SunPath> {
  const request = limited(signal, 30_000);
  try {
    const res = await fetch(`${API_URL}/sunpath?latitude=${lat}&longitude=${lng}`, {
      signal: request.signal,
    });
    if (!res.ok) throw new Error(`Sun path request failed (${res.status})`);
    const data = (await res.json()) as SunPath;
    if (!data.arcs) throw new Error("Sun path response has no arcs");
    return data;
  } finally {
    request.done();
  }
}

// The wind is the same for every plot (one ERA5-Land point for Riyadh), so no coordinates are sent.
export async function fetchWind(signal?: AbortSignal): Promise<Wind> {
  const request = limited(signal, 30_000);
  try {
    const res = await fetch(`${API_URL}/wind`, { signal: request.signal });
    if (!res.ok) throw new Error(`Wind request failed (${res.status})`);
    const data = (await res.json()) as Wind;
    if (!data.frequencies || !data.dominant) throw new Error("Wind response is incomplete");
    return data;
  } finally {
    request.done();
  }
}

// Per-façade indicators of the plot from our backend, same calculation as the dataset
// (the plot, its façades, the building and the solar radiation on each wall).
export type FacadeDirection = "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW";
export type SeasonRadiation = {
  total: number | null; // kWh/m² over the season (the dataset value)
  perDay: number | null; // kWh/m²/day
  blocked: number | null; // 0..1 share of the sun blocked by the neighbours
};
// What stands next to a façade (dataset columns for that direction).
export type FacadeNeighbours = {
  use: string | null; // adjoining parcel use (ParcelSub), "شارع", or "لا يوجد" (no edge this way); null if unknown
  across: string | null; // use across the street, or "لا يوجد"
  streetWidth: number | null; // m
  streetClass: string | null;
  streetName: string | null;
  nearestDistance: number; // m from the plot boundary to the nearest building this way; 300 = none within 300 m
  nearestHeight: number; // m, 0 = none
};

export type FacadeIndicatorsResponse = {
  mainFacade: FacadeDirection;
  buildingSource: "measured_footprint" | "envelope_measured_h" | "regulation_envelope";
  buildingHeight: number; // m
  skyView: number; // 0..1, dataset SVF: the plot's sky view at ground level (not shown yet)
  site: {
    summerMaxTemp: number; // °C, mean daily maximum in June–August (EPW temp_air)
    avgHeight: number | null; // m, all neighbouring buildings within 300 m
    maxHeight: number | null; // m, tallest of the neighbours per direction (the neighbours card)
  };
  facades: Record<
    FacadeDirection,
    {
      onStreet: boolean;
      streetWidth: number | null; // m
      radiation: { summer: SeasonRadiation; winter: SeasonRadiation }; // null when no wall faces this way
      shade: { summer: number | null; equinox: number | null; winter: number | null }; // 0..1, dataset Shaded_Pct
      sky: number | null; // 0..1, sky view of the wall (website only, not a dataset column)
      windBlock: number | null; // degrees, wind shelter of the wall (website only, not a dataset column)
      neighbours: FacadeNeighbours; // dataset neighbor_use, across_use, street_*, dist, height
    }
  >;
};

export async function fetchFacadeIndicators(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<FacadeIndicatorsResponse> {
  const request = limited(signal, 60_000);
  try {
    const res = await fetch(`${API_URL}/facade-indicators?latitude=${lat}&longitude=${lng}`, {
      signal: request.signal,
    });
    if (!res.ok) throw new Error(`Facade indicators request failed (${res.status})`);
    const data = (await res.json()) as FacadeIndicatorsResponse;
    if (!data.facades) throw new Error("Facade indicators response has no facades");
    return data;
  } finally {
    request.done();
  }
}

// Nearest services (mosque, school...) from our backend, same calculation as the dataset.
// Throws on failure so the card can show its own error and a retry button.
export async function fetchServices(lat: number, lng: number, signal?: AbortSignal): Promise<ServicesResponse> {
  const request = limited(signal, 30_000);
  try {
    const res = await fetch(`${API_URL}/services?latitude=${lat}&longitude=${lng}`, {
      signal: request.signal,
    });
    if (!res.ok) throw new Error(`Services request failed (${res.status})`);
    const data = (await res.json()) as ServicesResponse;
    if (!data.services) throw new Error("Services response has no services");
    return data;
  } finally {
    request.done();
  }
}

/* ---------- population density ---------- */

export type DensityResponse = {
  neighborhood: string;
  density: number; // people per km²
  level: "L" | "M" | "H";
};

export async function fetchDensity(
  neighborhood: string,
  signal?: AbortSignal,
): Promise<DensityResponse> {
  const request = limited(signal, 30_000);

  try {
    const url =
      `${API_URL}/api/density?neighborhood=${encodeURIComponent(neighborhood)}`;

    const res = await fetch(url, {
      signal: request.signal,
    });

    if (!res.ok) {
      throw new Error(`Density request failed (${res.status})`);
    }

    const data = (await res.json()) as DensityResponse;

    if (
      !Number.isFinite(data.density) ||
      !["L", "M", "H"].includes(data.level)
    ) {
      throw new Error("Invalid density response");
    }

    return data;
  } finally {
    request.done();
  }
}


// The places and buildings are optional extras: when they fail we return nothing and draw without them.
export async function fetchPois(
  lat: number,
  lng: number,
  radius: number,
  signal?: AbortSignal,
): Promise<Poi[]> {
  const request = limited(signal, 30_000);
  try {
    const res = await fetch(
      `${API_URL}/pois?latitude=${lat}&longitude=${lng}&radius=${radius}`,
      { signal: request.signal },
    );
    const data = await res.json();
    if (data.error) console.warn("Foursquare:", data.error);
    return (data.pois ?? []) as Poi[];
  } catch (error) {
    console.warn("POI error:", error);
    return [];
  } finally {
    request.done();
  }
}

export async function fetchOvertureBuildings(
  lat: number,
  lng: number,
  radius: number,
  signal?: AbortSignal,
): Promise<RawBuilding[]> {
  const request = limited(signal, 60_000);
  try {
    const res = await fetch(
      `${API_URL}/buildings?latitude=${lat}&longitude=${lng}&radius=${radius}`,
      { signal: request.signal },
    );
    const data = await res.json();
    if (data.error) console.warn("Overture:", data.error);
    return (data.buildings ?? []) as RawBuilding[];
  } catch (error) {
    console.warn("Overture error:", error);
    return [];
  } finally {
    request.done();
  }
}

/* ---------- OpenStreetMap (Overpass) ---------- */

const OVERPASS_SERVERS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

// Asks all servers at once and takes the first good answer. Returns null when all fail.
export async function fetchOverpass(
  query: string,
  signal?: AbortSignal,
): Promise<OverpassResult | null> {
  const controllers = OVERPASS_SERVERS.map(() => new AbortController());
  const stop = () => controllers.forEach((controller) => controller.abort());
  const timer = setTimeout(stop, 45_000);
  if (signal?.aborted) stop();
  signal?.addEventListener("abort", stop, { once: true });

  try {
    const result = await Promise.any(
      OVERPASS_SERVERS.map(async (url, index) => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: "data=" + encodeURIComponent(query),
          signal: controllers[index].signal,
        });
        if (!res.ok) throw new Error(`${url} HTTP ${res.status}`);
        return (await res.json()) as OverpassResult;
      }),
    );
    stop();
    return result;
  } catch (error) {
    console.warn("Overpass failed", error);
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}
