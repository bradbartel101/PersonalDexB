import { storeGet, storeSet, cors, authed } from "./_lib.js";

// Queue of LinkedIn captures posted by the browser extension, pulled by the
// app into its import-review flow, then cleared after import.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!authed(req, res)) return;

  if (req.method === "GET") {
    const cur = (await storeGet("captures")) || { people: [] };
    return res.status(200).json(cur);
  }

  if (req.method === "POST") {
    const people = (req.body && req.body.people) || [];
    if (!Array.isArray(people) || !people.length)
      return res.status(400).json({ error: "Body must be {people: [...]}" });
    const cur = (await storeGet("captures")) || { people: [] };
    const keyOf = (p) => (p.linkedin || p.name || "").toLowerCase();
    const merged = cur.people.filter((p) => !people.some((n) => keyOf(n) === keyOf(p)));
    for (const p of people) {
      if (p && typeof p.name === "string" && p.name.trim()) merged.push(p);
    }
    await storeSet("captures", { people: merged.slice(-200) });
    return res.status(200).json({ queued: merged.length });
  }

  if (req.method === "DELETE") {
    await storeSet("captures", { people: [] });
    return res.status(200).json({ queued: 0 });
  }

  res.status(405).json({ error: "Method not allowed" });
}
