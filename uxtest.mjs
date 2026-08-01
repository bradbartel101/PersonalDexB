// Empty-state onboarding, sample-data opt-in, and the Network view
// (map / group tree / related contacts).
import { chromium } from "playwright-core";
import path from "path";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto("file://" + path.resolve("hearth-standalone.html"));
await page.waitForTimeout(700);

const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); }
  catch (e) { console.log("FAIL", name, "—", e.message.split("\n")[0]); }
};
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem("hearth-crm-v1")));

await t("a fresh install has zero contacts — no invented people", async () => {
  const d = await store();
  if (d.contacts.length !== 0) throw new Error("seeded " + d.contacts.length + " contacts");
  const txt = await page.locator("#root").textContent();
  if (/Maya Chen|Grandma June/.test(txt)) throw new Error("sample names on a fresh install");
});

await t("empty home explains itself and offers three ways in", async () => {
  await page.waitForSelector(".start-card");
  const tiles = await page.locator(".start-tile").count();
  if (tiles !== 3) throw new Error("tiles: " + tiles);
  const txt = await page.locator(".start-card").textContent();
  for (const s of ["Add someone", "Quick capture", "Import LinkedIn"])
    if (!txt.includes(s)) throw new Error("missing: " + s);
  if (!(await page.locator(".start-how").textContent()).includes("cadence"))
    throw new Error("missing the how-it-works explainer");
});

await t("no overdue/birthday sections while empty", async () => {
  const txt = await page.locator("#root").textContent();
  for (const s of ["Reach out", "Next 30 days", "Recent interactions"])
    if (txt.includes(s)) throw new Error("showed '" + s + "' on an empty install");
});

await t("'Add someone' jumps to the add field", async () => {
  await page.locator(".start-tile", { hasText: "Add someone" }).click();
  await page.waitForSelector(".quickadd input");
  const focused = await page.evaluate(() => document.activeElement.placeholder || "");
  if (!/Add someone/.test(focused)) throw new Error("focus: " + focused);
});

await t("quick capture tile opens the capture modal", async () => {
  await page.locator(".nav-btn", { hasText: "Today" }).click();
  await page.locator(".start-tile", { hasText: "Quick capture" }).click();
  await page.waitForSelector(".li-paste");
  await page.keyboard.press("Escape");
  await page.locator(".overlay").click({ position: { x: 5, y: 5 } });
});

await t("sample data is opt-in and loads on request", async () => {
  await page.locator(".nav-btn", { hasText: "Today" }).click();
  await page.locator(".start-foot .btn", { hasText: "Load sample data" }).click();
  await page.waitForTimeout(800);
  const d = await store();
  if (d.contacts.length < 8) throw new Error("loaded " + d.contacts.length);
  if (!(await page.locator("#root").textContent()).includes("Reach out"))
    throw new Error("dashboard did not switch to the populated view");
});

await t("a complete sample hides the checklist (nothing left to nag about)", async () => {
  await page.waitForTimeout(300);
  if (await page.locator(".checklist").count()) throw new Error("checklist shown though every step is satisfied");
});

/* ---------- Network ---------- */

await t("network map plots contacts as clustered bubbles", async () => {
  await page.locator(".nav-btn", { hasText: "Network" }).click();
  await page.waitForSelector(".map");
  const land = await page.locator(".map-land").count();
  if (!land) throw new Error("no world outline rendered");
  const pins = await page.locator(".map-pin").count();
  if (pins < 2) throw new Error("pins: " + pins);
  const counts = await page.locator(".map-count").allTextContents();
  const total = counts.reduce((n, c) => n + Number(c), 0);
  if (total < 5) throw new Error("bubble counts total " + total);
});

await t("clicking a bubble filters the side list", async () => {
  const before = await page.locator(".net-item").count();
  await page.locator(".map-pin").first().click();
  await page.waitForTimeout(400);
  const after = await page.locator(".net-item").count();
  if (after >= before) throw new Error(`side list did not narrow: ${before} -> ${after}`);
  if (!(await page.locator(".net-side-head").textContent()).includes("clear"))
    throw new Error("no way to clear the selection");
  await page.locator(".net-side-head .btn").click();
  await page.waitForTimeout(300);
  if (await page.locator(".net-item").count() !== before) throw new Error("clear did not restore");
});

await t("map zooms and re-clusters", async () => {
  const before = await page.locator(".map-pin").count();
  await page.locator('.map-zoom [aria-label="Zoom in"]').click();
  await page.waitForTimeout(400);
  const after = await page.locator(".map-pin").count();
  if (after < before) throw new Error(`zoom should split clusters, ${before} -> ${after}`);
  await page.locator('.map-zoom [aria-label="Zoom out"]').click();
});

await t("group tree lists categories with their people", async () => {
  await page.locator(".tab", { hasText: "Group tree" }).click();
  await page.waitForSelector(".tree-branch");
  const branches = await page.locator(".tree-branch").count();
  if (branches < 5) throw new Error("branches: " + branches);
  const first = page.locator(".tree-branch").first();
  if (!(await first.locator(".tree-leaf").count())) {
    await first.locator(".tree-node").click();
    await page.waitForTimeout(200);
  }
  const leaves = await page.locator(".tree-leaf").count();
  if (!leaves) throw new Error("no people under any category");
  await page.locator(".tree-leaf").first().click();
  await page.waitForSelector(".profile-head");
});

await t("related contacts maps who introduced whom", async () => {
  await page.keyboard.press("Escape");
  await page.locator(".nav-btn", { hasText: "Network" }).click();
  await page.locator(".tab", { hasText: "Related" }).click();
  await page.waitForTimeout(400);
  const txt = await page.locator("#root").textContent();
  // the sample has "Intro'd by Priya at Founders Brunch"
  if (/No connections mapped yet/.test(txt)) {
    throw new Error("expected the sample's referral link to be detected");
  }
  if (!(await page.locator(".rel-row").count())) throw new Error("no related rows");
  const sub = await page.locator(".rel-sub").first().textContent();
  if (!/introduced/.test(sub)) throw new Error("sub: " + sub);
});

await t("clearing sample data returns the empty home", async () => {
  await page.locator(".rail-tool", { hasText: "Clear sample data" }).click();
  await page.locator(".rail-tool", { hasText: "samples?" }).click();
  await page.waitForTimeout(600);
  await page.locator(".nav-btn", { hasText: "Today" }).click();
  await page.waitForSelector(".start-card");
  const d = await store();
  if (d.contacts.length !== 0) throw new Error("left " + d.contacts.length + " contacts");
});

await t("checklist guides a real first run", async () => {
  await page.locator(".quickadd input").waitFor().catch(() => {});
  await page.locator(".nav-btn", { hasText: "People" }).click();
  await page.waitForSelector(".quickadd input");
  await page.fill(".quickadd input", "First Person");
  await page.locator(".quickadd input").press("Enter");
  await page.waitForSelector(".name-input");
  await page.waitForTimeout(700);
  await page.keyboard.press("Escape");
  await page.locator(".nav-btn", { hasText: "Today" }).click();
  await page.waitForSelector(".checklist");
  const rows = await page.locator(".check-row").count();
  if (rows !== 5) throw new Error("rows: " + rows);
  const done = await page.locator(".check-row.done").count();
  if (done !== 1) throw new Error("expected exactly 'add your first person' done, got " + done);
  const first = await page.locator(".check-row").first().textContent();
  if (!/first person/i.test(first)) throw new Error("first step: " + first);
});

await page.screenshot({ path: "shot-empty.png" });
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
process.exit(0);
