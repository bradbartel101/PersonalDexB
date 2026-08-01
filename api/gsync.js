import crypto from "node:crypto";
import { storeGet, storeSet, cors } from "./_lib.js";
import { accessToken, listGmail, listEvents } from "./_google.js";
import {
  buildIndex, messagesToInteractions, eventsToInteractions, dedupeAgainstExisting,
} from "../src/match.js";

/* Pulls Gmail + Calendar, matches to People, and appends Interactions to the
   stored CRM document. Read-only against Google; append-only against the doc
   (it never edits or deletes anything you wrote). Callable by the cron or by
   the app's "Sync now" button. */

function allowed(req, res) {
  const got = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const accepted = [process.env.HEARTH_PASSPHRASE, process.env.CRON_SECRET].filter(Boolean);
  if (!accepted.length) { res.status(503).json({ error: "Server not configured" }); return false; }
  const a = Buffer.from(got);
  const ok = accepted.some((s) => {
    const b = Buffer.from(s);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
  if (!ok) { res.status(401).json({ error: "Unauthorized" }); return false; }
  return true;
}

export async function runSync({ months = 0, deps = {} } = {}) {
  const settings = (await storeGet("integrations")) || {};
  if (settings.googleEnabled === false) return { skipped: "google sync is switched off" };

  const token = await accessToken(deps);
  if (!token) return { skipped: "google not connected" };

  const state = (await storeGet("syncstate")) || {};
  const stored = await storeGet("data");
  if (!stored || !stored.doc) return { skipped: "no CRM data yet" };

  const doc = stored.doc;
  const contacts = doc.contacts || [];
  const index = buildIndex(contacts);
  const selfEmails = [(await storeGet("google"))?.email, ...(settings.selfEmails || [])].filter(Boolean);

  // Backfill window on first run, otherwise a small overlap so nothing is
  // missed between polls (de-dupe makes the overlap harmless).
  const now = new Date();
  const backfillMonths = months || (state.lastSyncedAt ? 0 : (settings.backfillMonths ?? 6));
  const since = backfillMonths
    ? new Date(now.getFullYear(), now.getMonth() - backfillMonths, now.getDate())
    : new Date(Date.parse(state.lastSyncedAt) - 36 * 3600 * 1000);

  const result = { messages: 0, events: 0, logged: 0, people: 0, errors: [] };

  let msgs = [];
  if (settings.gmailEnabled !== false) {
    try {
      msgs = await listGmail(token, {
        after: Math.floor(since.getTime() / 1000),
        max: backfillMonths ? 1200 : 300,
      }, deps);
      result.messages = msgs.length;
    } catch (e) { result.errors.push("gmail: " + (e.message || e)); }
  }

  let events = [];
  if (settings.calendarEnabled !== false) {
    try {
      events = await listEvents(token, {
        timeMin: since.toISOString(),
        timeMax: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
      }, deps);
      result.events = events.length;
    } catch (e) { result.errors.push("calendar: " + (e.message || e)); }
  }

  const candidates = [
    ...messagesToInteractions(msgs, index, selfEmails),
    ...eventsToInteractions(events, index, selfEmails, { maxAttendees: settings.maxAttendees ?? 12 }),
  ];
  const fresh = dedupeAgainstExisting(candidates, contacts);

  if (fresh.length) {
    const byPerson = new Map();
    for (const f of fresh) {
      if (!byPerson.has(f.personId)) byPerson.set(f.personId, []);
      byPerson.get(f.personId).push(f);
    }
    doc.contacts = contacts.map((c) => {
      const add = byPerson.get(c.id);
      if (!add) return c;
      return {
        ...c,
        sample: false,
        interactions: [
          ...(c.interactions || []),
          ...add.map((a) => ({
            id: "g-" + crypto.randomBytes(6).toString("hex"),
            type: a.type, date: a.date, text: a.text,
            direction: a.direction, source: a.source, auto: true,
          })),
        ],
      };
    });
    result.logged = fresh.length;
    result.people = byPerson.size;
    await storeSet("data", { version: (stored.version || 0) + 1, doc });
  }

  await storeSet("syncstate", {
    lastSyncedAt: new Date().toISOString(),
    lastResult: result,
    backfilledMonths: backfillMonths || state.backfilledMonths || 0,
  });
  return result;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!allowed(req, res)) return;

  if (req.method === "GET") {
    const state = (await storeGet("syncstate")) || {};
    const g = await storeGet("google");
    return res.status(200).json({
      connected: !!(g && g.refreshToken),
      email: (g && g.email) || "",
      lastSyncedAt: state.lastSyncedAt || null,
      lastResult: state.lastResult || null,
    });
  }

  if (req.method === "POST") {
    try {
      const months = Number((req.body && req.body.months) || 0);
      const out = await runSync({ months: months > 0 ? Math.min(months, 24) : 0 });
      return res.status(200).json(out);
    } catch (e) {
      return res.status(500).json({ error: String(e.message || e) });
    }
  }

  res.status(405).json({ error: "Method not allowed" });
}
