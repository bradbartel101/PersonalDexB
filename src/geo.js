/* Offline place lookup: turns the free-text Location field into coordinates
   without any geocoding API. Covers major world cities, US states, and
   countries — enough for a personal network. Unresolved places are listed
   separately rather than guessed at. */

const C = (lat, lon) => ({ lat, lon });

export const PLACES = {
  // --- US cities ---
  "san francisco": C(37.77, -122.42), "oakland": C(37.80, -122.27), "berkeley": C(37.87, -122.27),
  "san jose": C(37.34, -121.89), "palo alto": C(37.44, -122.14), "mountain view": C(37.39, -122.08),
  "los angeles": C(34.05, -118.24), "san diego": C(32.72, -117.16), "sacramento": C(38.58, -121.49),
  "seattle": C(47.61, -122.33), "portland": C(45.52, -122.68), "denver": C(39.74, -104.99),
  "boulder": C(40.01, -105.27), "austin": C(30.27, -97.74), "dallas": C(32.78, -96.80),
  "houston": C(29.76, -95.37), "chicago": C(41.88, -87.63), "detroit": C(42.33, -83.05),
  "minneapolis": C(44.98, -93.27), "new york": C(40.71, -74.01), "brooklyn": C(40.68, -73.94),
  "boston": C(42.36, -71.06), "cambridge": C(42.37, -71.11), "philadelphia": C(39.95, -75.17),
  "washington": C(38.91, -77.04), "atlanta": C(33.75, -84.39), "miami": C(25.76, -80.19),
  "nashville": C(36.16, -86.78), "new orleans": C(29.95, -90.07), "phoenix": C(33.45, -112.07),
  "las vegas": C(36.17, -115.14), "salt lake city": C(40.76, -111.89), "tucson": C(32.22, -110.97),
  "pittsburgh": C(40.44, -79.996), "cleveland": C(41.50, -81.69), "st louis": C(38.63, -90.20),
  "kansas city": C(39.10, -94.58), "charlotte": C(35.23, -80.84), "raleigh": C(35.78, -78.64),
  "orlando": C(28.54, -81.38), "tampa": C(27.95, -82.46), "honolulu": C(21.31, -157.86),
  "anchorage": C(61.22, -149.90), "providence": C(41.82, -71.41), "buffalo": C(42.89, -78.88),
  // --- US states ---
  "alabama": C(32.8, -86.8), "alaska": C(64.2, -149.5), "arizona": C(34.3, -111.7),
  "arkansas": C(34.8, -92.4), "california": C(36.8, -119.4), "colorado": C(39.0, -105.5),
  "connecticut": C(41.6, -72.7), "delaware": C(39.0, -75.5), "florida": C(28.6, -82.4),
  "georgia": C(32.7, -83.4), "hawaii": C(20.8, -156.3), "idaho": C(44.1, -114.7),
  "illinois": C(40.0, -89.2), "indiana": C(39.9, -86.3), "iowa": C(42.0, -93.5),
  "kansas": C(38.5, -98.4), "kentucky": C(37.5, -85.3), "louisiana": C(31.0, -92.0),
  "maine": C(45.4, -69.2), "maryland": C(39.0, -76.8), "massachusetts": C(42.3, -71.8),
  "michigan": C(44.3, -85.4), "minnesota": C(46.3, -94.3), "mississippi": C(32.7, -89.7),
  "missouri": C(38.4, -92.5), "montana": C(47.0, -109.6), "nebraska": C(41.5, -99.8),
  "nevada": C(39.3, -116.6), "new hampshire": C(43.7, -71.6), "new jersey": C(40.1, -74.7),
  "new mexico": C(34.4, -106.1), "north carolina": C(35.5, -79.4), "north dakota": C(47.4, -100.5),
  "ohio": C(40.3, -82.8), "oklahoma": C(35.6, -97.5), "oregon": C(43.9, -120.6),
  "pennsylvania": C(40.9, -77.8), "rhode island": C(41.7, -71.6), "south carolina": C(33.9, -80.9),
  "south dakota": C(44.4, -100.2), "tennessee": C(35.9, -86.4), "texas": C(31.5, -99.3),
  "utah": C(39.3, -111.7), "vermont": C(44.1, -72.7), "virginia": C(37.5, -78.8),
  "west virginia": C(38.6, -80.6), "wisconsin": C(44.6, -89.7), "wyoming": C(43.0, -107.6),
  // --- Canada / Latin America ---
  "toronto": C(43.65, -79.38), "vancouver": C(49.28, -123.12), "montreal": C(45.50, -73.57),
  "ottawa": C(45.42, -75.70), "calgary": C(51.05, -114.07), "canada": C(56.1, -106.3),
  "mexico city": C(19.43, -99.13), "mexico": C(23.6, -102.5), "guadalajara": C(20.66, -103.35),
  "bogota": C(4.71, -74.07), "colombia": C(4.6, -74.1), "lima": C(-12.05, -77.04), "peru": C(-9.2, -75.0),
  "santiago": C(-33.45, -70.67), "chile": C(-35.7, -71.5), "buenos aires": C(-34.60, -58.38),
  "argentina": C(-38.4, -63.6), "sao paulo": C(-23.55, -46.63), "rio de janeiro": C(-22.91, -43.17),
  "brazil": C(-14.2, -51.9), "brasil": C(-14.2, -51.9), "panama": C(8.5, -80.8), "costa rica": C(9.7, -83.8),
  // --- Europe ---
  "london": C(51.51, -0.13), "manchester": C(53.48, -2.24), "edinburgh": C(55.95, -3.19),
  "dublin": C(53.35, -6.26), "ireland": C(53.4, -8.2), "united kingdom": C(54.0, -2.0),
  "uk": C(54.0, -2.0), "england": C(52.4, -1.5), "scotland": C(56.5, -4.2),
  "paris": C(48.86, 2.35), "france": C(46.6, 2.2), "lyon": C(45.76, 4.84),
  "berlin": C(52.52, 13.40), "munich": C(48.14, 11.58), "hamburg": C(53.55, 9.99),
  "germany": C(51.2, 10.4), "amsterdam": C(52.37, 4.90), "netherlands": C(52.1, 5.3),
  "brussels": C(50.85, 4.35), "belgium": C(50.5, 4.5), "zurich": C(47.38, 8.54),
  "geneva": C(46.20, 6.14), "switzerland": C(46.8, 8.2), "vienna": C(48.21, 16.37),
  "austria": C(47.5, 14.6), "madrid": C(40.42, -3.70), "barcelona": C(41.39, 2.17),
  "spain": C(40.5, -3.7), "lisbon": C(38.72, -9.14), "portugal": C(39.4, -8.2),
  "rome": C(41.90, 12.50), "milan": C(45.46, 9.19), "italy": C(41.9, 12.6),
  "stockholm": C(59.33, 18.07), "sweden": C(60.1, 18.6), "oslo": C(59.91, 10.75),
  "norway": C(60.5, 8.5), "copenhagen": C(55.68, 12.57), "denmark": C(56.3, 9.5),
  "helsinki": C(60.17, 24.94), "finland": C(61.9, 25.7), "warsaw": C(52.23, 21.01),
  "poland": C(51.9, 19.1), "prague": C(50.08, 14.44), "czech republic": C(49.8, 15.5),
  "budapest": C(47.50, 19.04), "hungary": C(47.2, 19.5), "athens": C(37.98, 23.73),
  "greece": C(39.1, 21.8), "istanbul": C(41.01, 28.98), "turkey": C(39.0, 35.2),
  "moscow": C(55.76, 37.62), "russia": C(61.5, 105.3), "kyiv": C(50.45, 30.52), "ukraine": C(48.4, 31.2),
  "europe": C(54.5, 15.3),
  // --- Middle East / Africa ---
  "dubai": C(25.20, 55.27), "abu dhabi": C(24.45, 54.38), "uae": C(23.4, 53.8),
  "tel aviv": C(32.09, 34.78), "israel": C(31.0, 34.9), "riyadh": C(24.71, 46.68),
  "saudi arabia": C(23.9, 45.1), "cairo": C(30.04, 31.24), "egypt": C(26.8, 30.8),
  "nairobi": C(-1.29, 36.82), "kenya": C(-0.02, 37.9), "lagos": C(6.52, 3.38),
  "nigeria": C(9.1, 8.7), "accra": C(5.60, -0.19), "ghana": C(7.9, -1.0),
  "johannesburg": C(-26.20, 28.05), "cape town": C(-33.92, 18.42), "south africa": C(-30.6, 22.9),
  "morocco": C(31.8, -7.1), "africa": C(1.6, 20.0),
  // --- Asia / Pacific ---
  "tokyo": C(35.68, 139.65), "osaka": C(34.69, 135.50), "japan": C(36.2, 138.3),
  "seoul": C(37.57, 126.98), "south korea": C(35.9, 127.8), "korea": C(35.9, 127.8),
  "beijing": C(39.90, 116.41), "shanghai": C(31.23, 121.47), "shenzhen": C(22.54, 114.06),
  "hong kong": C(22.32, 114.17), "china": C(35.9, 104.2), "taipei": C(25.03, 121.57),
  "taiwan": C(23.7, 121.0), "singapore": C(1.35, 103.82), "bangkok": C(13.76, 100.50),
  "thailand": C(15.9, 101.0), "jakarta": C(-6.21, 106.85), "indonesia": C(-0.8, 113.9),
  "manila": C(14.60, 120.98), "philippines": C(12.9, 121.8), "hanoi": C(21.03, 105.85),
  "vietnam": C(14.1, 108.3), "mumbai": C(19.08, 72.88), "delhi": C(28.61, 77.21),
  "new delhi": C(28.61, 77.21), "bangalore": C(12.97, 77.59), "bengaluru": C(12.97, 77.59),
  "hyderabad": C(17.39, 78.49), "chennai": C(13.08, 80.27), "pune": C(18.52, 73.86),
  "india": C(20.6, 78.9), "karachi": C(24.86, 67.01), "pakistan": C(30.4, 69.3),
  "dhaka": C(23.81, 90.41), "bangladesh": C(23.7, 90.4),
  "sydney": C(-33.87, 151.21), "melbourne": C(-37.81, 144.96), "brisbane": C(-27.47, 153.03),
  "perth": C(-31.95, 115.86), "australia": C(-25.3, 133.8), "auckland": C(-36.85, 174.76),
  "wellington": C(-41.29, 174.78), "new zealand": C(-40.9, 174.9),
};

/* Common shorthands people actually type. */
const ALIASES = {
  sf: "san francisco", "sf bay area": "san francisco", "bay area": "san francisco",
  "san francisco bay area": "san francisco", sfo: "san francisco", "the city": "san francisco",
  nyc: "new york", "new york city": "new york", manhattan: "new york", "ny": "new york",
  la: "los angeles", "socal": "los angeles", dc: "washington", "washington dc": "washington",
  "washington, d.c.": "washington", philly: "philadelphia", "the bay": "san francisco",
  atx: "austin", pdx: "portland", sea: "seattle", chi: "chicago", bos: "boston",
  usa: "kansas", "united states": "kansas", "u.s.": "kansas", us: "kansas", america: "kansas",
  "greater london": "london", "bengaluru area": "bangalore", "nl": "netherlands",
  "holland": "netherlands", "deutschland": "germany", "españa": "spain",
};

const US_ABBR = {
  al: "alabama", ak: "alaska", az: "arizona", ar: "arkansas", ca: "california", co: "colorado",
  ct: "connecticut", de: "delaware", fl: "florida", ga: "georgia", hi: "hawaii", id: "idaho",
  il: "illinois", in: "indiana", ia: "iowa", ks: "kansas", ky: "kentucky", la_: "louisiana",
  me: "maine", md: "maryland", ma: "massachusetts", mi: "michigan", mn: "minnesota",
  ms: "mississippi", mo: "missouri", mt: "montana", ne: "nebraska", nv: "nevada",
  nh: "new hampshire", nj: "new jersey", nm: "new mexico", nc: "north carolina",
  nd: "north dakota", oh: "ohio", ok: "oklahoma", or: "oregon", pa: "pennsylvania",
  ri: "rhode island", sc: "south carolina", sd: "south dakota", tn: "tennessee", tx: "texas",
  ut: "utah", vt: "vermont", va: "virginia", wa: "washington", wv: "west virginia",
  wi: "wisconsin", wy: "wyoming",
};

function norm(s) {
  return String(s || "").toLowerCase().trim().replace(/[.]/g, "").replace(/\s+/g, " ");
}
/* "Greater Boston Area" -> "boston", but only as a second attempt so that
   aliases containing those words ("bay area") still match first. */
function undecorate(s) {
  return s.replace(/^(greater|metro|the)\s+/, "")
    .replace(/\s+(area|region|metro|metropolitan area)$/, "").trim();
}

/* Resolve a free-text location. Tries the whole string, then the
   undecorated form, then each comma-separated part. */
export function resolvePlace(raw) {
  const full = norm(raw);
  if (!full) return null;

  const tryKey = (k) => {
    if (!k) return null;
    if (ALIASES[k]) k = ALIASES[k];
    if (PLACES[k]) return { ...PLACES[k], label: k };
    if (k.length === 2 && US_ABBR[k]) return { ...PLACES[US_ABBR[k]], label: US_ABBR[k] };
    return null;
  };

  const candidates = [full, undecorate(full)];
  for (const part of full.split(",")) {
    const p = part.trim();
    if (p) { candidates.push(p, undecorate(p)); }
  }
  for (const cand of candidates) {
    const hit = tryKey(cand);
    if (hit) return hit;
  }
  // last resort: a known place name appearing inside the string
  for (const key of Object.keys(PLACES)) {
    if (key.length > 4 && full.includes(key)) return { ...PLACES[key], label: key };
  }
  return null;
}

/* Equirectangular projection into the world.js viewBox. */
export function project(lat, lon, w, h) {
  return { x: ((lon + 180) / 360) * w, y: ((90 - lat) / 180) * h };
}

/* Group contacts into map bubbles. `cell` is the clustering grid in degrees:
   larger when zoomed out, so nearby people merge into one bubble. */
export function clusterContacts(contacts, cell = 12) {
  const located = [], unlocated = [];
  for (const c of contacts) {
    const p = resolvePlace(c.location);
    if (p) located.push({ c, p });
    else unlocated.push(c);
  }
  const buckets = new Map();
  for (const { c, p } of located) {
    const key = Math.round(p.lat / cell) + ":" + Math.round(p.lon / cell);
    let b = buckets.get(key);
    if (!b) { b = { lat: 0, lon: 0, people: [], labels: new Map() }; buckets.set(key, b); }
    b.people.push(c);
    b.lat += p.lat; b.lon += p.lon;
    b.labels.set(p.label, (b.labels.get(p.label) || 0) + 1);
  }
  const clusters = [...buckets.values()].map((b) => {
    const n = b.people.length;
    const top = [...b.labels.entries()].sort((x, y) => y[1] - x[1])[0][0];
    return {
      lat: b.lat / n, lon: b.lon / n, people: b.people, count: n,
      label: top.replace(/\b\w/g, (m) => m.toUpperCase()),
    };
  }).sort((a, b) => b.count - a.count);
  return { clusters, unlocated, locatedCount: located.length };
}
