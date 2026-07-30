import webpush from "web-push";
import { storeGet, storeSet, cors, authed } from "./_lib.js";

// VAPID keys are generated once and persisted, so push works with zero
// manual key setup. Subscriptions are stored per endpoint.
export async function getVapid() {
  let v = await storeGet("vapid");
  if (!v || !v.publicKey || !v.privateKey) {
    v = webpush.generateVAPIDKeys();
    await storeSet("vapid", v);
  }
  return v;
}

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!authed(req, res)) return;

  if (req.method === "GET") {
    const v = await getVapid();
    return res.status(200).json({ publicKey: v.publicKey });
  }

  if (req.method === "POST") {
    const sub = req.body && req.body.subscription;
    if (!sub || typeof sub.endpoint !== "string" || !sub.keys)
      return res.status(400).json({ error: "Body must be {subscription}" });
    const cur = (await storeGet("pushsubs")) || {};
    cur[sub.endpoint] = sub;
    await storeSet("pushsubs", cur);
    return res.status(200).json({ subscriptions: Object.keys(cur).length });
  }

  if (req.method === "DELETE") {
    const endpoint = req.body && req.body.endpoint;
    if (typeof endpoint !== "string") return res.status(400).json({ error: "Body must be {endpoint}" });
    const cur = (await storeGet("pushsubs")) || {};
    delete cur[endpoint];
    await storeSet("pushsubs", cur);
    return res.status(200).json({ subscriptions: Object.keys(cur).length });
  }

  res.status(405).json({ error: "Method not allowed" });
}
