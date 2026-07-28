import { storeGet, storeSet, cors, authed } from "./_lib.js";

// The whole CRM document lives as one versioned blob. PUT is optimistic:
// send the version you last saw; a mismatch returns 409 with the current
// server state so the client can retry on top of it.
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!authed(req, res)) return;

  if (req.method === "GET") {
    const cur = (await storeGet("data")) || { version: 0, doc: null };
    return res.status(200).json(cur);
  }

  if (req.method === "PUT") {
    const body = req.body || {};
    if (!body.doc || typeof body.version !== "number")
      return res.status(400).json({ error: "Body must be {version, doc}" });
    const cur = (await storeGet("data")) || { version: 0, doc: null };
    if (body.version !== cur.version) return res.status(409).json(cur);
    const next = { version: cur.version + 1, doc: body.doc };
    await storeSet("data", next);
    return res.status(200).json({ version: next.version });
  }

  res.status(405).json({ error: "Method not allowed" });
}
