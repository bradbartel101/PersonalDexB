import crypto from "node:crypto";
import fs from "node:fs";

// Storage: Upstash Redis via REST when the Vercel integration's env vars are
// present (either naming scheme), else a JSON file for local dev.
const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const FILE = process.env.HEARTH_STORE_FILE || "/tmp/hearth-store.json";

async function kv(cmd) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: "Bearer " + KV_TOKEN, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!r.ok) throw new Error("kv " + r.status);
  return (await r.json()).result;
}

export async function storeGet(key) {
  if (KV_URL && KV_TOKEN) {
    const v = await kv(["GET", "hearth:" + key]);
    return v == null ? null : JSON.parse(v);
  }
  try {
    const all = JSON.parse(fs.readFileSync(FILE, "utf8"));
    return all[key] ?? null;
  } catch (e) { return null; }
}

export async function storeSet(key, obj) {
  if (KV_URL && KV_TOKEN) {
    await kv(["SET", "hearth:" + key, JSON.stringify(obj)]);
    return;
  }
  let all = {};
  try { all = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch (e) { /* fresh */ }
  all[key] = obj;
  fs.writeFileSync(FILE, JSON.stringify(all));
}

// CORS is open so the browser extension can POST captures from its own origin;
// every route still requires the passphrase.
export function cors(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Authorization,Content-Type");
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}

export function authed(req, res) {
  const pass = process.env.HEARTH_PASSPHRASE;
  if (!pass) {
    res.status(503).json({ error: "Server not configured — set the HEARTH_PASSPHRASE environment variable" });
    return false;
  }
  const got = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(got), b = Buffer.from(pass);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) { res.status(401).json({ error: "Wrong passphrase" }); return false; }
  return true;
}
