// Tests for the automation layer: cadence suggestions, momentum line,
// automatic duplicate badge, profile suggestion chip.
// Runs against the built standalone file (no server needed).
import { chromium } from "playwright-core";
import path from "path";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto("file://" + path.resolve("hearth-standalone.html"));
await page.waitForTimeout(600);

const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); }
  catch (e) { console.log("FAIL", name, "—", e.message.split("\n")[0]); }
};

await t("momentum line shows weekly interaction counts", async () => {
  const txt = await page.locator(".momentum").textContent();
  if (!/\d+ logged this week/.test(txt)) throw new Error("momentum: " + txt);
});

await t("suggestion appears for rhythmic no-cadence contact", async () => {
  const row = page.locator(".section", { hasText: "Noticed" }).locator(".person-row", { hasText: "Chris Palmer" });
  if (!(await row.count())) throw new Error("no suggestion row");
  const meta = await row.locator(".person-meta").textContent();
  if (!meta.includes("every 12 days") && !meta.includes("every 13 days")) throw new Error("gap text: " + meta);
  const btn = await row.locator(".btn.primary").textContent();
  if (!btn.toLowerCase().includes("weekly")) throw new Error("expected weekly suggestion, got: " + btn);
});

await t("accepting a suggestion sets the cadence and clears the row", async () => {
  await page.locator(".section", { hasText: "Noticed" })
    .locator(".person-row", { hasText: "Chris Palmer" }).locator(".btn.primary").click();
  await page.waitForTimeout(600);
  const chris = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.find((c) => c.name === "Chris Palmer"));
  if (chris.cadence.id !== "weekly") throw new Error("cadence: " + chris.cadence.id);
  if (await page.locator(".section", { hasText: "Noticed" }).count()) throw new Error("section remains");
});

await t("dismissing a suggestion persists across reload", async () => {
  await page.evaluate(() => localStorage.removeItem("hearth-crm-v1"));
  await page.reload();
  await page.waitForTimeout(700);
  const row = page.locator(".section", { hasText: "Noticed" }).locator(".person-row", { hasText: "Chris Palmer" });
  await row.locator(".btn.ghost", { hasText: "No thanks" }).click();
  await page.waitForTimeout(700);
  if (await page.locator(".section", { hasText: "Noticed" }).count()) throw new Error("still shown");
  await page.reload();
  await page.waitForTimeout(700);
  if (await page.locator(".section", { hasText: "Noticed" }).count()) throw new Error("returned after reload");
  const chris = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hearth-crm-1".replace("-1", "-v1"))).contacts.find((c) => c.name === "Chris Palmer"));
  if (!chris.noSuggest) throw new Error("noSuggest not persisted");
});

await t("profile shows suggestion chip for no-cadence contact", async () => {
  await page.evaluate(() => localStorage.removeItem("hearth-crm-v1"));
  await page.reload();
  await page.waitForTimeout(700);
  await page.locator(".nav-btn", { hasText: "People" }).click();
  await page.fill(".searchbox input", "Chris Palmer");
  await page.waitForTimeout(200);
  await page.locator(".person-name").first().click();
  await page.waitForSelector(".cadence-row");
  const chip = page.locator(".pcard", { hasText: "Keep in touch" }).locator(".type-chip", { hasText: "Suggested" });
  if (!(await chip.count())) throw new Error("chip missing");
  await chip.click();
  await page.waitForTimeout(300);
  const on = await page.locator(".cadence-row .type-chip.on").textContent();
  if (on !== "Weekly") throw new Error("cadence chip: " + on);
});

await t("duplicate badge appears automatically", async () => {
  await page.keyboard.press("Escape");
  await page.waitForSelector(".quickadd input");
  const before = await page.locator(".rail-tool", { hasText: "Merge duplicates" }).locator(".nav-badge").count();
  if (before !== 0) throw new Error("badge shown with no dupes");
  await page.fill(".quickadd input", "Maya Chen");
  await page.locator(".quickadd input").press("Enter");
  await page.waitForSelector(".name-input");
  const badge = await page.locator(".rail-tool", { hasText: "Merge duplicates" }).locator(".nav-badge").textContent();
  if (badge !== "1") throw new Error("badge: " + badge);
});

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
process.exit(0);
