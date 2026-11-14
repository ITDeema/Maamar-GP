import { fetchOverpass, fetchOvertureBuildings, fetchPois, fetchSunPath } from "@/lib/site-api";
import { pointKey, shared, waitFor } from "@/lib/shared-request";
import type { OsmElement, Poi, RawBuilding, Tags } from "@/lib/site-api";

// Everything around the site, ready to draw. No map code in here.

export const LAND_RADIUS = 800; // meters shown in the land use and roads diagrams

export type LatLngTuple = [number, number];

export type LandUse =
  | "residential"
  | "commercial"
  | "industrial"
  | "education"
  | "religious"
  | "health"
  | "civic"
  | "park"
  | "parking"
  | "water"
  | "vacant"
  | "other";

// the order used in the legend
export const LAND_USES: LandUse[] = [
  "residential",
  "commercial",
  "industrial",
  "education",
  "religious",
  "health",
  "civic",
  "park",
  "parking",
  "water",
  "vacant",
  "other",
];

type Box = [number, number, number, number]; // minLat, minLon, maxLat, maxLon

export type Building = { pts: LatLngTuple[]; cat: LandUse };
export type Area = { pts: LatLngTuple[]; water: boolean; cat: LandUse | null; plan: boolean };
export type RoadLine = { pts: LatLngTuple[]; w: number };
export type ClassedRoad = { pts: LatLngTuple[]; cls: 1 | 2 | 3 };
export type Stop = { lat: number; lon: number; k: "bus" | "metro" };

export type Surroundings = {
  buildings: Building[];
  areas: Area[];
  casings: RoadLine[];
  fills: RoadLine[];
  paths: LatLngTuple[][];
  rails: LatLngTuple[][];
  roads: ClassedRoad[];
  stops: Stop[];
  presentUses: LandUse[];
  siteBuilding: LatLngTuple[] | null; // the building that contains the site, if any
  counts: { buildings: number; places: number; source: "OSM" | "Overture"; osm: boolean };
};

/* ---------- classification ---------- */

// Maps OSM tags to one of the categories (null = ignore).
export function classify(t: Tags): LandUse | null {
  const b = t.building;
  const a = t.amenity;
  const l = t.leisure;
  const u = t.landuse;
  const n = t.natural;
  const edu = ["school", "university", "college", "kindergarten"];
  const isIn = (list: string[], value: string | undefined) => value !== undefined && list.includes(value);

  if (n === "water" || t.waterway) return "water";

  if (isIn(["park", "garden", "playground", "nature_reserve", "recreation_ground", "golf_course"], l)) return "park";
  if (
    isIn(["grass", "forest", "village_green", "meadow", "recreation_ground", "cemetery", "orchard", "flowerbed"], u) ||
    isIn(["wood", "scrub", "grassland"], n)
  )
    return "park";

  if (a === "parking") return "parking";

  if (isIn(edu, a) || isIn(edu, b) || u === "education") return "education";
  if (a === "place_of_worship" || isIn(["mosque", "church", "religious"], b) || u === "religious") return "religious";
  if (isIn(["hospital", "clinic", "doctors", "dentist", "pharmacy"], a) || isIn(["hospital", "clinic"], b)) return "health";
  if (
    isIn(["townhall", "police", "fire_station", "courthouse", "public_building", "community_centre"], a) ||
    isIn(["government", "public", "civic"], b)
  )
    return "civic";

  if (
    isIn(["restaurant", "cafe", "fast_food", "bank", "marketplace"], a) ||
    t.shop ||
    t.office ||
    isIn(["commercial", "retail", "office", "hotel", "supermarket", "kiosk", "mall"], b) ||
    isIn(["commercial", "retail"], u)
  )
    return "commercial";

  if (isIn(["industrial", "warehouse", "factory", "manufacture"], b) || u === "industrial") return "industrial";

  if (
    isIn(["residential", "apartments", "house", "villa", "detached", "semidetached_house", "terrace", "dormitory"], b) ||
    u === "residential"
  )
    return "residential";

  if (isIn(["construction", "brownfield", "greenfield", "farmland", "farmyard"], u)) return "vacant";

  if (b) return "other";
  return null;
}

// road widths in pixels at zoom 17
const ROAD_WIDTH: Record<string, number> = {
  motorway: 11, motorway_link: 6, trunk: 10, trunk_link: 6,
  primary: 9, primary_link: 5, secondary: 8, secondary_link: 5,
  tertiary: 7, tertiary_link: 4, unclassified: 5, residential: 5,
  living_street: 4, service: 3, pedestrian: 4,
};

const PATH_TYPES = ["footway", "path", "cycleway", "steps", "track", "bridleway", "corridor"];

// 1 = arterial, 2 = collector, 3 = local (anything else, such as platforms, is skipped)
const ROAD_CLASS: Record<string, 1 | 2 | 3> = {
  motorway: 1, motorway_link: 1, trunk: 1, trunk_link: 1, primary: 1, primary_link: 1,
  secondary: 2, secondary_link: 2, tertiary: 2, tertiary_link: 2,
  unclassified: 3, residential: 3, living_street: 3, service: 3, pedestrian: 3,
};

// Overture building subtypes -> land use
const OV_USE: Record<string, LandUse> = {
  agricultural: "other", civic: "civic", commercial: "commercial", education: "education",
  entertainment: "commercial", industrial: "industrial", medical: "health", military: "civic",
  outbuilding: "other", religious: "religious", residential: "residential",
  service: "other", transportation: "other",
};

function overtureUse(b: RawBuilding): LandUse {
  let cat: LandUse | null = b.class === "parking" ? "parking" : b.class ? classify({ building: b.class }) : null;
  if (!cat || cat === "other") cat = OV_USE[b.subtype ?? ""] ?? "other";
  return cat;
}

/* ---------- geometry ---------- */

function boxOf(pts: LatLngTuple[]): Box {
  let minLat = 1e9, minLon = 1e9, maxLat = -1e9, maxLon = -1e9;
  pts.forEach(([lat, lon]) => {
    minLat = Math.min(minLat, lat);
    minLon = Math.min(minLon, lon);
    maxLat = Math.max(maxLat, lat);
    maxLon = Math.max(maxLon, lon);
  });
  return [minLat, minLon, maxLat, maxLon];
}

function inBox(box: Box, lat: number, lon: number, tolerance: number): boolean {
  return (
    lat >= box[0] - tolerance && lat <= box[2] + tolerance &&
    lon >= box[1] - tolerance && lon <= box[3] + tolerance
  );
}

function inPoly(lat: number, lon: number, pts: LatLngTuple[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [yi, xi] = pts[i];
    const [yj, xj] = pts[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/* ---------- Foursquare places -> land use ---------- */

function poiUse(cats: string[]): LandUse {
  const s = cats.join(" ").toLowerCase();
  if (/mosque|church|temple|synagogue|religio|spiritual/.test(s)) return "religious";
  if (/school|universit|college|kindergarten|preschool|academy|education|nursery/.test(s)) return "education";
  if (/hospital|clinic|medical|doctor|dentist|pharmac|health|physician|optic|laborator/.test(s)) return "health";
  if (/government|city hall|police|fire station|court|embassy|community cent|post office|library|municipal/.test(s)) return "civic";
  return "commercial";
}

const USE_RANK: LandUse[] = ["religious", "education", "health", "civic", "commercial"];

type WorkBuilding = Building & { box: Box; hits: Set<LandUse> };

// Only buildings that could not be typed ("other") are changed:
// 1) a Foursquare place inside (or right next to) the footprint sets its use
// 2) otherwise it takes the use of the zone it sits in (e.g. a residential area)
function refineBuildings(buildings: WorkBuilding[], areas: Area[], pois: Poi[]) {
  pois.forEach((p) => {
    const use = poiUse(p.cats ?? []);
    let hit = buildings.find((b) => inBox(b.box, p.lat, p.lon, 0) && inPoly(p.lat, p.lon, b.pts));

    if (!hit) {
      // the pin often sits on the street side
      let best = 1e9;
      buildings.forEach((b) => {
        if (!inBox(b.box, p.lat, p.lon, 0.00015)) return;
        const d = Math.hypot((b.box[0] + b.box[2]) / 2 - p.lat, (b.box[1] + b.box[3]) / 2 - p.lon);
        if (d < best) {
          best = d;
          hit = b;
        }
      });
    }
    if (hit) hit.hits.add(use);
  });

  const zones = areas.filter((a) => a.cat && !["park", "water", "parking", "vacant"].includes(a.cat));

  buildings.forEach((b) => {
    if (b.cat !== "other") return;
    const use = USE_RANK.find((k) => b.hits.has(k));
    if (use) {
      b.cat = use;
      return;
    }
    const cy = (b.box[0] + b.box[2]) / 2;
    const cx = (b.box[1] + b.box[3]) / 2;
    const zone = zones.find((a) => inPoly(cy, cx, a.pts));
    if (zone?.cat) b.cat = zone.cat;
  });
}

/* ---------- loading ---------- */

const toPts = (geometry: { lat: number; lon: number }[]): LatLngTuple[] =>
  geometry.map((p) => [p.lat, p.lon]);

// Starts the architect's diagrams (sun path and surroundings) as soon as the user presses "start analysis".
// The analysis does not wait for them (the map servers can be slow); the results page reuses them.
// `surroundings: false` when the plot already has saved surroundings (less than 6 months old).
export function prefetchDiagrams(lat: number, lng: number, options: { surroundings?: boolean } = {}): void {
  fetchSunPath(lat, lng).catch(() => undefined);
  if (options.surroundings !== false) loadSurroundings(lat, lng).catch(() => undefined);
}

// Loads roads, buildings, land use and transit stops around the site.
// Shared: the analysis page starts it (for architects), the results page reuses it.
export function loadSurroundings(lat: number, lng: number, signal?: AbortSignal): Promise<Surroundings> {
  const request = shared(`around:${pointKey(lat, lng)}`, () =>
    buildSurroundings(lat, lng).then((data) => {
      // nothing came back (the map servers did not answer): not kept, so "try again" asks again
      if (isEmptySurroundings(data)) throw new Error("No surroundings around the site");
      return data;
    }),
  );
  return waitFor(request, signal);
}

async function buildSurroundings(lat: number, lng: number, signal?: AbortSignal): Promise<Surroundings> {
  const radius = LAND_RADIUS + 60;
  const around = `(around:${radius},${lat},${lng})`;

  // two lighter queries instead of one heavy one:
  // roads and transit first, so the roads diagram works even if the second one fails
  const roadsQuery = `[out:json][timeout:30];
(
  way["highway"]${around};
  way["railway"]${around};
  node["highway"="bus_stop"]${around};
  node["railway"~"station|subway_entrance|tram_stop"]${around};
  node["public_transport"="station"]${around};
);
out geom;`;

  const contextQuery = `[out:json][timeout:30];
(
  way["building"]${around};
  relation["building"]${around};
  way["natural"~"water|wood|scrub|grassland"]${around};
  way["waterway"]${around};
  way["leisure"]${around};
  way["landuse"]${around};
  way["amenity"~"parking|school|university|college|kindergarten|place_of_worship|hospital|clinic"]${around};
  relation["leisure"~"park|garden|nature_reserve"]${around};
  relation["natural"~"water|wood"]${around};
);
out geom;`;

  const [roadsData, contextData, pois, overture] = await Promise.all([
    fetchOverpass(roadsQuery, signal),
    fetchOverpass(contextQuery, signal),
    fetchPois(lat, lng, radius, signal),
    fetchOvertureBuildings(lat, lng, radius, signal),
  ]);

  const osm = Boolean(roadsData || contextData);
  const elements: OsmElement[] = [...(roadsData?.elements ?? []), ...(contextData?.elements ?? [])];

  const areas: Area[] = [];
  const casings: RoadLine[] = [];
  const fills: RoadLine[] = [];
  const paths: LatLngTuple[][] = [];
  const rails: LatLngTuple[][] = [];
  const roads: ClassedRoad[] = [];
  const stops: Stop[] = [];
  let buildings: WorkBuilding[] = [];

  elements.forEach((el) => {
    const t = el.tags;
    if (!t) return;

    // transit stops are single points
    if (el.type === "node") {
      if (el.lat === undefined || el.lon === undefined) return;
      stops.push({ lat: el.lat, lon: el.lon, k: t.highway === "bus_stop" ? "bus" : "metro" });
      return;
    }

    // relations -> outer rings, ways -> their own geometry
    let geoms: LatLngTuple[][] = [];
    if (el.type === "relation") {
      geoms = (el.members ?? [])
        .filter((m) => m.role === "outer" && m.geometry)
        .map((m) => toPts(m.geometry!));
    } else if (el.geometry) {
      geoms = [toPts(el.geometry)];
    }

    geoms.forEach((pts) => {
      if (t.building) {
        buildings.push({ pts, cat: classify(t) ?? "other", box: boxOf(pts), hits: new Set() });
      } else if (t.highway && t.area !== "yes") {
        if (PATH_TYPES.includes(t.highway)) {
          paths.push(pts);
        } else {
          const w = ROAD_WIDTH[t.highway] ?? 4;
          casings.push({ pts, w });
          fills.push({ pts, w });
          const cls = ROAD_CLASS[t.highway];
          if (cls) roads.push({ pts, cls });
        }
      } else if (t.railway) {
        rails.push(pts);
      } else if (t.waterway) {
        paths.push(pts);
      } else {
        const cat = classify(t);
        const plan = t.natural === "water" || Boolean(t.leisure) || Boolean(t.landuse) || t.amenity === "parking";
        if (cat || plan) areas.push({ pts, water: t.natural === "water", cat, plan });
      }
    });
  });

  // Overture footprints cover far more houses than OSM: use them when available
  let source: "OSM" | "Overture" = "OSM";
  if (overture.length) {
    buildings = overture.map((b) => ({
      pts: b.pts,
      cat: overtureUse(b),
      box: boxOf(b.pts),
      hits: new Set<LandUse>(),
    }));
    source = "Overture";
  }

  refineBuildings(buildings, areas, pois);

  const used = new Set<LandUse>();
  buildings.forEach((b) => used.add(b.cat));
  areas.forEach((a) => {
    if (a.cat) used.add(a.cat);
  });

  const site = buildings.find((b) => inBox(b.box, lat, lng, 0) && inPoly(lat, lng, b.pts));

  return {
    buildings: buildings.map(({ pts, cat }) => ({ pts, cat })),
    areas,
    casings,
    fills,
    paths,
    rails,
    roads,
    stops,
    presentUses: LAND_USES.filter((k) => used.has(k)),
    siteBuilding: site ? site.pts : null,
    counts: { buildings: buildings.length, places: pois.length, source, osm },
  };
}

// true when nothing at all could be loaded around the site
export function isEmptySurroundings(data: Surroundings): boolean {
  return (
    data.buildings.length === 0 &&
    data.areas.length === 0 &&
    data.roads.length === 0 &&
    data.stops.length === 0
  );
}
