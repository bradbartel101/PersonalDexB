import { storeGet, storeSet, cors, authed } from "./_lib.js";
import { googleConfigured, redirectUri } from "./_google.js";

const DEFAULTS = {
  googleEnabled: true,
  gmailEnabled: true,
  calendarEnabled: true,
  aiEnabled: true,
  backfillMonths: 6,
  maxAttendees: 12,
  selfEmails: [],
  digest: "daily",
};

/* One place for the app to learn what's available and what's switched on.
   Every integration is independently toggleable and everything degrades to
   plain local behaviour when off or unconfigured. */
export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!authed(req, res)) return;

  if (req.method === "GET") {
    const settings = { ...DEFAULTS, ...((await storeGet("integrations")) || {}) };
    const g = await storeGet("google");
    const sync = (await storeGet("syncstate")) || {};
    return res.status(200).json({
      settings,
      google: {
        configured: googleConfigured(),
        connected: !!(g && g.refreshToken),
        email: (g && g.email) || "",
        connectedAt: (g && g.connectedAt) || null,
        redirectUri: googleConfigured() ? redirectUri(req) : null,
        lastSyncedAt: sync.lastSyncedAt || null,
        lastResult: sync.lastResult || null,
      },
      ai: {
        configured: !!process.env.ANTHROPIC_API_KEY,
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      },
    });
  }

  if (req.method === "PUT") {
    const body = (req.body && req.body.settings) || {};
    const cur = { ...DEFAULTS, ...((await storeGet("integrations")) || {}) };
    const next = { ...cur };
    for (const k of ["googleEnabled", "gmailEnabled", "calendarEnabled", "aiEnabled"])
      if (typeof body[k] === "boolean") next[k] = body[k];
    if (Number.isFinite(+body.backfillMonths)) next.backfillMonths = Math.max(0, Math.min(24, Math.round(+body.backfillMonths)));
    if (Number.isFinite(+body.maxAttendees)) next.maxAttendees = Math.max(2, Math.min(100, Math.round(+body.maxAttendees)));
    if (typeof body.digest === "string" && ["daily", "weekly", "off"].includes(body.digest)) next.digest = body.digest;
    if (Array.isArray(body.selfEmails))
      next.selfEmails = body.selfEmails.filter((e) => typeof e === "string" && e.includes("@")).slice(0, 10);
    await storeSet("integrations", next);
    return res.status(200).json({ settings: next });
  }

  res.status(405).json({ error: "Method not allowed" });
}
