// End-to-end test of the cloud-sync stack: dev server + two browser contexts
// (two "devices"), covering data, categories, and the push digest.
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const PASS = "test-pass";
const STORE = "./synctest-store.json";
try { fs.unlinkSync(STORE); } catch (e) { /* fresh */ }

// NODE_TLS_REJECT_UNAUTHORIZED=0 is test-only: it lets the server's web-push
// deliveries trust the self-signed cert of the local push collector below.
const server = spawn("node", ["dev-server.mjs", String(PORT)], {
  env: { ...process.env, HEARTH_STORE_FILE: STORE, HEARTH_PASSPHRASE: PASS, NODE_TLS_REJECT_UNAUTHORIZED: "0" },
  stdio: "pipe",
});
await new Promise((res) => server.stdout.once("data", res));

// A stand-in for a browser push service: web-push requires TLS, so this is a
// real HTTPS server with a throwaway self-signed cert, recording deliveries.
const { execSync } = await import("node:child_process");
const https = await import("node:https");
const CERT_DIR = "./.synctest-tls";
fs.mkdirSync(CERT_DIR, { recursive: true });
execSync(`openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -keyout ${CERT_DIR}/key.pem -out ${CERT_DIR}/cert.pem -days 2 -nodes -subj "/CN=127.0.0.1" 2>/dev/null`);
const pushInbox = [];
const CPORT = 8792;
const collector = https.createServer(
  { key: fs.readFileSync(CERT_DIR + "/key.pem"), cert: fs.readFileSync(CERT_DIR + "/cert.pem") },
  (req, res) => {
    let bytes = 0;
    req.on("data", (c) => { bytes += c.length; });
    req.on("end", () => {
      pushInbox.push({ headers: req.headers, bytes });
      res.statusCode = 201;
      res.end("{}");
    });
  }
);
await new Promise((res) => collector.listen(CPORT, res));
const PUSH_ENDPOINT = `https://127.0.0.1:${CPORT}/push`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const errors = [];
const newPage = async () => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  return page;
};
const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); }
  catch (e) { console.log("FAIL", name, "—", e.message.split("\n")[0]); }
};
const connect = async (page, pass) => {
  await page.waitForSelector(".sync-pass", { timeout: 5000 });
  await page.fill(".sync-pass", pass);
  await page.locator(".rail-sync .btn.primary").click();
};


const ensureSample = async (pg) => {
  const btn = pg.locator(".start-foot .btn", { hasText: "Load sample" });
  if (await btn.count()) { await btn.click(); await pg.waitForTimeout(900); }
};
const A = await newPage();
await A.goto(BASE + "/?pollms=1000");
await A.waitForTimeout(600);
await ensureSample(A);

await t("device A: prompts for passphrase", async () => {
  await A.waitForSelector(".sync-pass", { timeout: 4000 });
});

await t("device A: wrong passphrase rejected", async () => {
  await connect(A, "nope");
  await A.waitForSelector(".sync-line.err", { timeout: 4000 });
});

await t("device A: connects and seeds the server", async () => {
  await connect(A, PASS);
  await A.waitForSelector(".sync-line.ok", { timeout: 5000 });
  await A.waitForTimeout(1600); // seed push
  const stored = JSON.parse(fs.readFileSync(STORE, "utf8"));
  if (!stored.data || stored.data.version < 1) throw new Error("server not seeded: " + JSON.stringify(stored).slice(0, 80));
  if (stored.data.doc.contacts.length < 5) throw new Error("contacts missing");
});

const B = await newPage();
await B.goto(BASE + "/?pollms=1000");
await B.waitForTimeout(600);

await t("device B: pulls server data after connecting", async () => {
  await connect(B, PASS);
  await B.waitForSelector(".sync-line.ok", { timeout: 5000 });
  await B.waitForTimeout(800);
  const txt = await B.locator("#root").textContent();
  if (!txt.includes("Maya Chen")) throw new Error("server doc not adopted");
});

await t("edit on A appears on B via polling", async () => {
  await A.locator(".nav-btn", { hasText: "People" }).click();
  await A.fill(".quickadd input", "Sync Test Person");
  await A.locator(".quickadd input").press("Enter");
  await A.waitForSelector(".name-input");
  await A.waitForTimeout(1800); // debounce + push
  await B.waitForTimeout(2500); // poll
  await B.locator(".nav-btn", { hasText: "People" }).click();
  await B.fill(".searchbox input", "Sync Test");
  await B.waitForTimeout(300);
  const rows = await B.locator(".person-row").count();
  if (rows !== 1) throw new Error("B rows: " + rows);
});

await t("categories and rules sync between devices", async () => {
  await A.locator(".rail-tool", { hasText: "Categories" }).click();
  await A.waitForSelector(".cat-row");
  await A.locator(".rem-add input[name=\"newcat\"]").fill("Book Club");
  await A.locator('.modal .rem-add button[type="submit"]').click();
  await A.waitForTimeout(1800);
  await A.locator(".modal-actions .btn.primary", { hasText: "Done" }).click();
  await B.waitForTimeout(2500);
  const groups = await B.evaluate(() => JSON.parse(localStorage.getItem("hearth-crm-v1")).groups.map((g) => g.name));
  if (!groups.includes("Book Club")) throw new Error("B never saw the category: " + groups.join(","));
});

await t("a person added on B syncs back to A", async () => {
  await B.locator(".nav-btn", { hasText: "People" }).click();
  await B.waitForSelector(".quickadd input");
  await B.fill(".quickadd input", "Riley Novak");
  await B.locator(".quickadd input").press("Enter");
  await B.waitForSelector(".name-input");
  await B.waitForTimeout(1800);
  await A.waitForTimeout(2500); // poll
  await A.locator(".nav-btn", { hasText: "People" }).click();
  await A.waitForSelector(".searchbox input");
  await A.fill(".searchbox input", "Riley");
  await A.waitForTimeout(400);
  const rows = await A.locator(".person-row").count();
  if (rows !== 1) throw new Error("A rows: " + rows);
});

await t("unauthenticated API is refused", async () => {
  const r = await fetch(BASE + "/api/data");
  if (r.status !== 401) throw new Error("status " + r.status);
});

await t("service worker registers and app shell is cached", async () => {
  const reg = await B.evaluate(async () => {
    const r = await navigator.serviceWorker.getRegistration();
    return r ? { scope: r.scope, active: !!(r.active || r.installing || r.waiting) } : null;
  });
  if (!reg || !reg.active) throw new Error("no registration: " + JSON.stringify(reg));
});

await t("push: vapid key is generated once and stable", async () => {
  const h = { Authorization: "Bearer " + PASS };
  const a = await fetch(BASE + "/api/push", { headers: h }).then((r) => r.json());
  const b = await fetch(BASE + "/api/push", { headers: h }).then((r) => r.json());
  if (!a.publicKey || a.publicKey !== b.publicKey) throw new Error("unstable key");
});

await t("push: subscribe → daily digest delivers an encrypted notification", async () => {
  const crypto = await import("node:crypto");
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  const b64u = (buf) => buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const subscription = {
    endpoint: PUSH_ENDPOINT,
    keys: { p256dh: b64u(ecdh.getPublicKey()), auth: b64u(crypto.randomBytes(16)) },
  };
  const h = { Authorization: "Bearer " + PASS, "Content-Type": "application/json" };
  const saved = await fetch(BASE + "/api/push", { method: "POST", headers: h, body: JSON.stringify({ subscription }) });
  if (!saved.ok) throw new Error("subscribe " + saved.status);

  const digest = await fetch(BASE + "/api/notify", { headers: h }).then((r) => r.json());
  if (digest.sent !== 1) throw new Error("digest: " + JSON.stringify(digest));
  if (!digest.due || digest.due < 1) throw new Error("no due people counted");

  if (pushInbox.length !== 1) throw new Error("inbox: " + pushInbox.length);
  const msg = pushInbox[0];
  if (msg.headers["content-encoding"] !== "aes128gcm") throw new Error("encoding: " + msg.headers["content-encoding"]);
  if (!msg.headers.authorization || !msg.headers.authorization.startsWith("vapid")) throw new Error("no vapid auth header");
  if (!(msg.bytes > 100)) throw new Error("payload too small: " + msg.bytes);
});

await t("push: cron endpoint rejects wrong secret", async () => {
  const r = await fetch(BASE + "/api/notify", { headers: { Authorization: "Bearer wrong" } });
  if (r.status !== 401) throw new Error("status " + r.status);
});

await t("push: unsubscribe removes the endpoint", async () => {
  const h = { Authorization: "Bearer " + PASS, "Content-Type": "application/json" };
  const del = await fetch(BASE + "/api/push", {
    method: "DELETE", headers: h, body: JSON.stringify({ endpoint: PUSH_ENDPOINT }),
  }).then((r) => r.json());
  if (del.subscriptions !== 0) throw new Error("remaining: " + del.subscriptions);
  const digest = await fetch(BASE + "/api/notify", { headers: h }).then((r) => r.json());
  if (digest.sent !== 0 || digest.reason !== "no subscribers") throw new Error(JSON.stringify(digest));
});

await t("push UI: enable button renders when synced", async () => {
  const btn = await B.locator(".push-line").count();
  if (!btn) throw new Error("push line missing from rail");
});

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
server.kill();
collector.close();
try { fs.unlinkSync(STORE); } catch (e) { /* gone */ }
try { fs.rmSync(CERT_DIR, { recursive: true, force: true }); } catch (e) { /* gone */ }
process.exit(0);
