/* Google OAuth + Gmail/Calendar reads. Read-only scopes only — this file
   contains no code path that can send mail or write to a calendar.
   `deps.fetch` is injectable so gsynctest.mjs can drive the whole pipeline
   against recorded fixtures instead of the live API. */
import { storeGet, storeSet } from "./_lib.js";

export const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function googleConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function redirectUri(req) {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}/api/google`;
}

export function authUrl(req, state) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri(req),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",     // required for a refresh token
    prompt: "consent",          // force one, even on re-auth
    include_granted_scopes: "true",
    state,
  });
  return "https://accounts.google.com/o/oauth2/v2/auth?" + p.toString();
}

async function tokenRequest(body, deps = {}) {
  const f = deps.fetch || fetch;
  const r = await f("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error_description || json.error || "token request failed (" + r.status + ")");
  return json;
}

export async function exchangeCode(req, code, deps) {
  const tok = await tokenRequest({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    redirect_uri: redirectUri(req),
    grant_type: "authorization_code",
  }, deps);
  if (!tok.refresh_token) {
    throw new Error("Google did not return a refresh token — revoke the app at myaccount.google.com/permissions and connect again");
  }
  const stored = {
    refreshToken: tok.refresh_token,
    accessToken: tok.access_token || "",
    expiresAt: Date.now() + (tok.expires_in || 3600) * 1000,
    scope: tok.scope || SCOPES.join(" "),
    connectedAt: new Date().toISOString(),
    email: "",
  };
  try {
    const who = await gfetch("https://www.googleapis.com/oauth2/v2/userinfo", stored.accessToken, deps);
    stored.email = who.email || "";
  } catch (e) { /* identity is a nicety, not required */ }
  await storeSet("google", stored);
  return stored;
}

/* Returns a valid access token, refreshing (and persisting) when stale. */
export async function accessToken(deps) {
  const g = await storeGet("google");
  if (!g || !g.refreshToken) return null;
  if (g.accessToken && g.expiresAt && Date.now() < g.expiresAt - 60000) return g.accessToken;
  const tok = await tokenRequest({
    refresh_token: g.refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    grant_type: "refresh_token",
  }, deps);
  const next = {
    ...g,
    accessToken: tok.access_token,
    expiresAt: Date.now() + (tok.expires_in || 3600) * 1000,
  };
  await storeSet("google", next);
  return next.accessToken;
}

export async function gfetch(url, token, deps = {}) {
  const f = deps.fetch || fetch;
  const r = await f(url, { headers: { Authorization: "Bearer " + token } });
  if (r.status === 401 || r.status === 403) {
    const body = await r.text().catch(() => "");
    throw Object.assign(new Error("Google denied the request (" + r.status + "). Re-connect the account."), { status: r.status, body });
  }
  if (!r.ok) throw new Error("Google API " + r.status);
  return r.json();
}

/* ---------------- Gmail ---------------- */

function header(payload, name) {
  const hs = (payload && payload.headers) || [];
  const h = hs.find((x) => String(x.name).toLowerCase() === name);
  return h ? h.value : "";
}
function addrList(v) {
  // Split on commas that aren't inside quotes or angle brackets.
  return String(v || "").split(/,(?![^<]*>)(?=(?:[^"]*"[^"]*")*[^"]*$)/)
    .map((s) => s.trim()).filter(Boolean);
}

export async function listGmail(token, { after, max = 400 }, deps) {
  const out = [];
  let pageToken = "";
  const q = ["-in:chats", "-in:drafts", after ? `after:${after}` : ""].filter(Boolean).join(" ");
  while (out.length < max) {
    const u = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages");
    u.searchParams.set("maxResults", String(Math.min(100, max - out.length)));
    if (q) u.searchParams.set("q", q);
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const page = await gfetch(u.toString(), token, deps);
    for (const m of page.messages || []) out.push(m);
    pageToken = page.nextPageToken || "";
    if (!pageToken) break;
  }

  const detailed = [];
  for (const stub of out) {
    const u = new URL("https://gmail.googleapis.com/gmail/v1/users/me/messages/" + stub.id);
    u.searchParams.set("format", "metadata");
    for (const h of ["From", "To", "Cc", "Subject", "Date"]) u.searchParams.append("metadataHeaders", h);
    let m;
    try { m = await gfetch(u.toString(), token, deps); } catch (e) { continue; }
    detailed.push({
      id: m.id,
      threadId: m.threadId,
      date: m.internalDate ? Number(m.internalDate) : header(m.payload, "date"),
      subject: header(m.payload, "subject"),
      from: header(m.payload, "from"),
      to: addrList(header(m.payload, "to")),
      cc: addrList(header(m.payload, "cc")),
    });
  }
  return detailed;
}

/* ---------------- Calendar ---------------- */

export async function listEvents(token, { timeMin, timeMax }, deps) {
  const out = [];
  let pageToken = "";
  do {
    const u = new URL("https://www.googleapis.com/calendar/v3/calendars/primary/events");
    u.searchParams.set("singleEvents", "true");
    u.searchParams.set("orderBy", "startTime");
    u.searchParams.set("maxResults", "250");
    if (timeMin) u.searchParams.set("timeMin", timeMin);
    if (timeMax) u.searchParams.set("timeMax", timeMax);
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const page = await gfetch(u.toString(), token, deps);
    for (const e of page.items || []) {
      out.push({
        id: e.id,
        summary: e.summary || "",
        status: e.status,
        start: (e.start && (e.start.dateTime || e.start.date)) || "",
        organizer: e.organizer && e.organizer.email,
        attendees: (e.attendees || []).map((a) => ({
          email: a.email, displayName: a.displayName, self: !!a.self, responseStatus: a.responseStatus,
        })),
      });
    }
    pageToken = page.nextPageToken || "";
  } while (pageToken);
  return out;
}
