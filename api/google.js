import crypto from "node:crypto";
import { storeGet, storeSet, cors, authed } from "./_lib.js";
import { googleConfigured, authUrl, exchangeCode, redirectUri } from "./_google.js";

/* OAuth endpoints. The callback arrives as a browser redirect (no auth
   header available), so it is protected by a one-time signed `state` we
   minted while the caller was authenticated. */
export default async function handler(req, res) {
  if (cors(req, res)) return;
  const url = new URL(req.url, "http://x");
  const action = url.searchParams.get("action") || (url.searchParams.get("code") ? "callback" : "status");

  if (action === "callback") return callback(req, res, url);

  if (!authed(req, res)) return;

  if (action === "status") {
    const g = await storeGet("google");
    return res.status(200).json({
      configured: googleConfigured(),
      connected: !!(g && g.refreshToken),
      email: (g && g.email) || "",
      connectedAt: (g && g.connectedAt) || null,
      redirectUri: googleConfigured() ? redirectUri(req) : null,
    });
  }

  if (action === "start") {
    if (!googleConfigured())
      return res.status(503).json({ error: "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET first" });
    const state = crypto.randomBytes(24).toString("hex");
    await storeSet("oauthstate", { state, at: Date.now() });
    return res.status(200).json({ url: authUrl(req, state) });
  }

  if (action === "disconnect") {
    await storeSet("google", null);
    await storeSet("syncstate", null);
    return res.status(200).json({ connected: false });
  }

  res.status(400).json({ error: "Unknown action" });
}

async function callback(req, res, url) {
  const send = (title, body, ok) => {
    res.statusCode = ok ? 200 : 400;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{font:15px/1.6 system-ui,sans-serif;background:#F6F4EF;color:#1F2B26;display:flex;
min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
.c{max-width:420px;background:#fff;border:1px solid #E7E3D8;border-radius:16px;padding:26px;
box-shadow:0 10px 28px -14px rgba(31,43,38,.14)}h1{font-size:19px;margin:0 0 8px}
p{margin:0 0 14px;color:#66746D}a{color:#2E6B57;font-weight:600}</style>
<div class="c"><h1>${title}</h1><p>${body}</p><a href="/">Back to Hearth</a></div>`);
  };

  const err = url.searchParams.get("error");
  if (err) return send("Google connection cancelled", "Google reported: " + err + ". Nothing was changed.", false);

  const state = url.searchParams.get("state");
  const saved = await storeGet("oauthstate");
  if (!saved || !saved.state || saved.state !== state || Date.now() - saved.at > 15 * 60 * 1000) {
    return send("That link expired", "Start the connection again from Hearth's Integrations panel.", false);
  }
  await storeSet("oauthstate", null);

  try {
    const g = await exchangeCode(req, url.searchParams.get("code"));
    return send("Google connected", `Reading mail and calendar for <b>${g.email || "your account"}</b>, read-only. Run a first sync from the Integrations panel.`, true);
  } catch (e) {
    return send("Couldn't finish connecting", String(e.message || e), false);
  }
}
