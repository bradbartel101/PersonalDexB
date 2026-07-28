// End-to-end test of the cloud-sync stack: dev server + two browser contexts
// (two "devices") + a simulated extension POST. Run: node synctest.mjs
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import fs from "node:fs";

const PORT = 8791;
const BASE = `http://127.0.0.1:${PORT}`;
const PASS = "test-pass";
const STORE = "./synctest-store.json";
try { fs.unlinkSync(STORE); } catch (e) { /* fresh */ }

const server = spawn("node", ["dev-server.mjs", String(PORT)], {
  env: { ...process.env, HEARTH_STORE_FILE: STORE, HEARTH_PASSPHRASE: PASS },
  stdio: "pipe",
});
await new Promise((res) => server.stdout.once("data", res));

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

const A = await newPage();
await A.goto(BASE + "/?pollms=1000");
await A.waitForTimeout(600);

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

await t("extension POST → review button appears → import lands with photo", async () => {
  const photo = await A.evaluate(() => {
    const cv = document.createElement("canvas"); cv.width = 30; cv.height = 30;
    cv.getContext("2d").fillStyle = "#2a6"; cv.getContext("2d").fillRect(0, 0, 30, 30);
    return cv.toDataURL("image/jpeg");
  });
  const r = await fetch(BASE + "/api/captures", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + PASS },
    body: JSON.stringify({ people: [{ name: "Riley Cloud", headline: "CTO at Nimbus", location: "Chicago", photo, linkedin: "https://www.linkedin.com/in/rileycloud" }] }),
  });
  if (!r.ok) throw new Error("POST " + r.status);
  await B.waitForSelector(".cap-alert", { timeout: 6000 });
  await B.locator(".cap-alert").click();
  await B.waitForSelector(".li-item");
  await B.locator(".modal-actions .btn.primary").click();
  await B.waitForTimeout(1800);
  const riley = await B.evaluate(() =>
    JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.find((c) => c.name === "Riley Cloud"));
  if (!riley || !riley.photo || riley.role !== "CTO" || riley.company !== "Nimbus") throw new Error("riley: " + JSON.stringify(riley || {}).slice(0, 120));
  const q = await fetch(BASE + "/api/captures", { headers: { Authorization: "Bearer " + PASS } }).then((x) => x.json());
  if (q.people.length !== 0) throw new Error("queue not cleared: " + q.people.length);
});

await t("import on B syncs back to A", async () => {
  await A.waitForTimeout(2500); // poll
  await A.locator(".nav-btn", { hasText: "People" }).click();
  await A.waitForSelector(".searchbox input");
  await A.fill(".searchbox input", "Riley");
  await A.waitForTimeout(300);
  const rows = await A.locator(".person-row").count();
  if (rows !== 1) throw new Error("A rows: " + rows);
});

await t("unauthenticated API is refused", async () => {
  const r = await fetch(BASE + "/api/data");
  if (r.status !== 401) throw new Error("status " + r.status);
});

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
server.kill();
try { fs.unlinkSync(STORE); } catch (e) { /* gone */ }
process.exit(0);
