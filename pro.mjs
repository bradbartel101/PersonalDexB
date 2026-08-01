import { chromium } from "playwright-core";
import path from "path";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto("file://" + path.resolve(process.argv[2] || "hearth-standalone.html"));
await page.waitForTimeout(700);
const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); }
  catch (e) { console.log("FAIL", name, "—", e.message.split("\n")[0]); }
};

await t("important date appears in next 30 days", async () => {
  const row = page.locator(".up-row", { hasText: "Stripe reunion dinner" });
  if (!(await row.count())) throw new Error("date row missing");
});

await t("history view lists all interactions, filterable", async () => {
  await page.locator(".nav-btn", { hasText: "History" }).click();
  await page.waitForSelector(".up-row");
  const all = await page.locator(".up-row").count();
  if (all < 8) throw new Error("expected many entries, got " + all);
  await page.locator(".page .type-chip", { hasText: "Call" }).click();
  await page.waitForTimeout(150);
  const calls = await page.locator(".up-row").count();
  if (calls >= all || calls < 1) throw new Error(`filter: ${all} -> ${calls}`);
  const badge = await page.locator(".hist-type").first().textContent();
  if (!badge.includes("Call")) throw new Error("badge: " + badge);
});

await t("star toggle + starred filter", async () => {
  await page.locator(".nav-btn", { hasText: "People" }).click();
  await page.waitForSelector(".person-row");
  const starred = await page.locator(".icon-btn.star.on").count();
  if (starred !== 2) throw new Error("expected 2 pre-starred, got " + starred);
  await page.locator(".person-row", { hasText: "Sam Torres" }).locator(".icon-btn.star").click();
  await page.selectOption('select[aria-label="Show"]', "starred");
  await page.waitForTimeout(150);
  const rows = await page.locator(".person-row").count();
  if (rows !== 3) throw new Error("starred filter rows: " + rows);
  await page.selectOption('select[aria-label="Show"]', "active");
});

await t("sort by most overdue", async () => {
  await page.selectOption('select[aria-label="Sort"]', "overdue");
  await page.waitForTimeout(150);
  const first = await page.locator(".person-name").first().textContent();
  if (first !== "Dana Whitfield") throw new Error("first: " + first);
  await page.selectOption('select[aria-label="Sort"]', "name");
});

await t("bulk: tag two people", async () => {
  await page.locator(".toolbar .btn", { hasText: "Select" }).click();
  await page.waitForSelector(".bulkbar");
  await page.locator(".person-row", { hasText: "Alex Kim" }).locator(".row-check").check();
  await page.locator(".person-row", { hasText: "Priya Sharma" }).locator(".row-check").check();
  await page.fill(".bulk-input", "sf-network");
  await page.locator(".bulkbar .btn", { hasText: /^Tag$/ }).click();
  await page.waitForTimeout(600);
  const tagged = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.filter((c) => c.tags.includes("sf-network")).length);
  if (tagged !== 2) throw new Error("tagged in store: " + tagged);
});

await t("bulk: archive hides from active + Today", async () => {
  await page.locator(".person-row", { hasText: "Chris Palmer" }).locator(".row-check").check();
  await page.locator(".bulkbar .btn", { hasText: "Archive" }).click();
  await page.waitForTimeout(200);
  if (await page.locator(".person-row", { hasText: "Chris Palmer" }).count())
    throw new Error("still visible in active");
  await page.selectOption('select[aria-label="Show"]', "archived");
  await page.waitForTimeout(150);
  if (!(await page.locator(".person-row", { hasText: "Chris Palmer" }).count()))
    throw new Error("not in archived");
  await page.selectOption('select[aria-label="Show"]', "active");
  await page.locator(".toolbar .btn", { hasText: "Done" }).click();
});

await t("unarchive from profile", async () => {
  await page.selectOption('select[aria-label="Show"]', "archived");
  await page.waitForTimeout(150);
  await page.locator(".person-name", { hasText: "Chris Palmer" }).click();
  await page.waitForSelector(".profile-archived");
  await page.locator(".profile-actions .btn", { hasText: "Unarchive" }).click();
  await page.waitForTimeout(150);
  if (await page.locator(".profile-archived").count()) throw new Error("banner remains");
  await page.keyboard.press("Escape");
});

await t("important dates: add on profile", async () => {
  await page.waitForSelector(".searchbox input");
  await page.fill(".searchbox input", "Noor");
  await page.waitForTimeout(150);
  await page.locator(".person-name").first().click();
  await page.waitForSelector(".pcard-title >> text=Important dates");
  const card = page.locator(".pcard", { hasText: "Important dates" });
  await card.locator('input[type="date"]').fill("2024-08-15");
  await card.locator('input[type="text"]').fill("Supper club anniversary");
  await card.locator(".btn", { hasText: "Add" }).click();
  await page.waitForTimeout(150);
  if (!(await card.locator(".rem-row", { hasText: "Supper club anniversary" }).count()))
    throw new Error("date not added");
  const next = await card.locator(".rem-row .rem-date").nth(1).textContent();
  if (!next.includes("in ") && next !== "today" && next !== "tomorrow") throw new Error("next occurrence: " + next);
});

await t("insights line on profile", async () => {
  await page.keyboard.press("Escape");
  await page.fill(".searchbox input", "Grandma");
  await page.waitForTimeout(150);
  await page.locator(".person-name").first().click();
  await page.waitForSelector(".cadence-status");
  const txt = await page.locator(".cadence-status").textContent();
  if (!txt.includes("2 logged") || !txt.includes("usually every")) throw new Error("insights: " + txt);
});

await t("mailto/tel quick actions", async () => {
  const tel = await page.locator('a.field-act[href^="tel:"]').getAttribute("href");
  if (tel !== "tel:5552014477") throw new Error("tel: " + tel);
  await page.keyboard.press("Escape");
});

await t("merge duplicates", async () => {
  await page.fill(".quickadd input", "Maya Chen");
  await page.locator(".quickadd input").press("Enter");
  await page.waitForSelector(".name-input");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(600); // let the debounced save flush
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.length);
  await page.locator(".rail-tool", { hasText: "Merge duplicates" }).click();
  await page.waitForSelector(".dup-group");
  await page.locator(".dup-group .btn", { hasText: "Merge 2" }).click();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.length);
  if (after !== before - 1) throw new Error(`contacts ${before} -> ${after}`);
  const maya = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.find((c) => c.name === "Maya Chen"));
  if (maya.interactions.length !== 2 || !maya.emails.length) throw new Error("merge lost data");
  await page.locator(".modal-actions .btn", { hasText: "Close" }).click();
});

await page.screenshot({ path: "shot-pro-people.png" });
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
process.exit(0);
