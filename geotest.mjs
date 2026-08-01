// Unit tests for offline place resolution + map clustering (src/geo.js)
import { resolvePlace, clusterContacts, project } from "./src/geo.js";
let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); console.log("ok  ", n); pass++; } catch (e) { console.log("FAIL", n, "—", e.message); fail++; } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m||"") + " " + JSON.stringify(a) + " !== " + JSON.stringify(b)); };
const ok = (v, m) => { if (!v) throw new Error(m || "falsy"); };
const near = (a, b, tol, m) => { if (Math.abs(a - b) > tol) throw new Error((m||"") + ` ${a} vs ${b}`); };

t("resolves plain cities", () => {
  near(resolvePlace("San Francisco").lat, 37.77, 0.1);
  near(resolvePlace("tokyo").lon, 139.65, 0.1);
});

t("resolves 'City, Region' and 'City, Country'", () => {
  near(resolvePlace("Oakland, CA").lat, 37.80, 0.1);
  near(resolvePlace("Tucson, AZ").lat, 32.22, 0.1);
  near(resolvePlace("Berlin, Germany").lat, 52.52, 0.1);
});

t("falls back to the region when the city is unknown", () => {
  const r = resolvePlace("Smallville, Kansas");
  ok(r, "no result"); eq(r.label, "kansas");
});

t("handles common shorthands", () => {
  near(resolvePlace("SF").lat, 37.77, 0.1);
  near(resolvePlace("NYC").lat, 40.71, 0.1);
  near(resolvePlace("Bay Area").lat, 37.77, 0.1);
  near(resolvePlace("San Francisco Bay Area").lat, 37.77, 0.1);
  near(resolvePlace("Washington, D.C.").lat, 38.91, 0.2);
});

t("ignores decoration like 'Greater' and 'Area'", () => {
  near(resolvePlace("Greater Boston Area").lat, 42.36, 0.2);
  near(resolvePlace("  london  ").lat, 51.51, 0.1);
});

t("returns null for unknown or empty input", () => {
  eq(resolvePlace(""), null);
  eq(resolvePlace(null), null);
  eq(resolvePlace("Rivendell"), null);
});

t("projects into the viewBox", () => {
  const p = project(0, 0, 1000, 500);
  near(p.x, 500, 0.01); near(p.y, 250, 0.01);
  const nw = project(90, -180, 1000, 500);
  near(nw.x, 0, 0.01); near(nw.y, 0, 0.01);
});

t("clusters nearby people and separates distant ones", () => {
  const contacts = [
    { id: "1", location: "San Francisco" }, { id: "2", location: "Oakland" },
    { id: "3", location: "Berkeley" }, { id: "4", location: "London" },
    { id: "5", location: "Rivendell" }, { id: "6", location: "" },
  ];
  const { clusters, unlocated, locatedCount } = clusterContacts(contacts, 12);
  eq(locatedCount, 4);
  eq(unlocated.length, 2, "unlocated");
  eq(clusters.length, 2, "clusters");
  eq(clusters[0].count, 3, "bay area should merge");
  ok(/San Francisco|Oakland|Berkeley/.test(clusters[0].label), "label: " + clusters[0].label);
  eq(clusters[1].count, 1);
});

t("a finer grid splits the same people apart", () => {
  const contacts = [{ id: "1", location: "San Francisco" }, { id: "2", location: "Los Angeles" }];
  eq(clusterContacts(contacts, 12).clusters.length, 1, "coarse should merge");
  eq(clusterContacts(contacts, 1).clusters.length, 2, "fine should split");
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
