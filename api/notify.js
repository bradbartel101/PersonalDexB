import crypto from "node:crypto";
import webpush from "web-push";
import { storeGet, storeSet, cors } from "./_lib.js";
import { getVapid } from "./push.js";
import { digestFor } from "../src/due.js";

// Daily digest, fired by the Vercel cron (see vercel.json). Sends one push
// per subscribed device summarizing who's due today; sends nothing on
// quiet days. Accepts either the cron secret or the workspace passphrase.
function cronAuthed(req, res) {
  const got = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const accepted = [process.env.CRON_SECRET, process.env.HEARTH_PASSPHRASE].filter(Boolean);
  if (!accepted.length) {
    res.status(503).json({ error: "Set CRON_SECRET (or HEARTH_PASSPHRASE) so the digest endpoint is protected" });
    return false;
  }
  const a = Buffer.from(got);
  const ok = accepted.some((s) => {
    const b = Buffer.from(s);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!ok) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!cronAuthed(req, res)) return;
  if (req.method !== "GET" && req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  const stored = await storeGet("data");
  const subs = (await storeGet("pushsubs")) || {};
  const endpoints = Object.keys(subs);
  if (!stored || !stored.doc) return res.status(200).json({ sent: 0, reason: "no data yet" });
  if (!endpoints.length) return res.status(200).json({ sent: 0, reason: "no subscribers" });

  const { due, today } = digestFor(stored.doc);
  if (!due.length && !today.length)
    return res.status(200).json({ sent: 0, reason: "nothing due — staying quiet" });

  const names = due.slice(0, 3).map((x) => x.c.name.split(" ")[0]);
  const title = due.length
    ? "Hearth — " + due.length + (due.length === 1 ? " person" : " people") + " to reach out to"
    : "Hearth — today";
  const bodyParts = [];
  if (names.length) bodyParts.push(names.join(", ") + (due.length > 3 ? " +" + (due.length - 3) + " more" : ""));
  bodyParts.push(...today.slice(0, 2));
  const payload = JSON.stringify({ title, body: bodyParts.join(" · "), url: "/" });

  const vapid = await getVapid();
  const details = { subject: "mailto:hearth@example.com", publicKey: vapid.publicKey, privateKey: vapid.privateKey };

  let sent = 0, pruned = 0;
  const errors = [];
  for (const ep of endpoints) {
    try {
      await webpush.sendNotification(subs[ep], payload, { vapidDetails: details, TTL: 3600 * 18 });
      sent++;
    } catch (e) {
      if (e && (e.statusCode === 404 || e.statusCode === 410)) { delete subs[ep]; pruned++; }
      else errors.push(String((e && e.message) || e).slice(0, 140));
    }
  }
  if (pruned) await storeSet("pushsubs", subs);
  return res.status(200).json({ sent, pruned, due: due.length, today: today.length, errors });
}
