import { chromium } from "playwright-core";
import path from "path";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });

// Simulate the artifact wrapper: file lacks <html>/<body>; browsers handle that fine.
await page.goto("file://" + path.resolve(process.argv[2] || "hearth.html"));
await page.waitForTimeout(600);
/* The app now starts empty by design; these tests exercise the populated
   state, so opt into the sample data first. */
const ensureSample = async (pg) => {
  const btn = pg.locator(".start-foot .btn", { hasText: "Load sample" });
  if (await btn.count()) { await btn.click(); await pg.waitForTimeout(900); }
};
await ensureSample(page);


const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); }
  catch (e) { console.log("FAIL", name, "—", e.message.split("\n")[0]); }
};

await t("dashboard renders with overdue people", async () => {
  await page.waitForSelector(".person-row", { timeout: 3000 });
  const n = await page.locator("section:first-of-type .person-row").count();
  if (n < 2) throw new Error("expected overdue rows, got " + n);
});

await t("upcoming shows birthdays + reminders", async () => {
  const n = await page.locator(".up-row").count();
  if (n < 3) throw new Error("got " + n);
});

await page.screenshot({ path: "shot-today.png", fullPage: false });

await t("quick log from dashboard clears the row", async () => {
  const before = await page.locator("section:first-of-type .person-row").count();
  await page.locator(".person-side .btn").first().click();
  await page.waitForSelector(".quicklog");
  await page.locator(".quicklog .type-chip", { hasText: "Coffee" }).click();
  await page.fill('.quicklog input[type="text"]', "Quick catch-up call");
  await page.locator(".quicklog .btn.primary").click();
  await page.waitForTimeout(300);
  const after = await page.locator("section:first-of-type .person-row").count();
  if (after !== before - 1) throw new Error(`rows ${before} -> ${after}`);
  const toast = await page.locator(".toast").textContent();
  if (!toast.includes("Logged coffee")) throw new Error("toast: " + toast);
});

await t("snooze clears a row", async () => {
  const before = await page.locator("section:first-of-type .person-row").count();
  await page.locator('.person-side .icon-btn[title="Snooze 7 days"]').first().click();
  await page.waitForTimeout(300);
  const after = await page.locator("section:first-of-type .person-row").count();
  if (after !== before - 1) throw new Error(`rows ${before} -> ${after}`);
});

await t("localStorage persistence across reload", async () => {
  await page.waitForTimeout(500); // debounce
  await page.reload();
  await page.waitForTimeout(600);
  const txt = await page.locator("#root").textContent();
  if (!txt.includes("Maya Chen") && !txt.includes("Grandma June")) throw new Error("data lost");
  const banner = await page.locator(".banner").count();
  if (banner > 0) throw new Error("memory banner shown despite localStorage");
});

await t("people view: search + list", async () => {
  await page.locator(".nav-btn", { hasText: "People" }).click();
  await page.waitForSelector(".searchbox input");
  await page.fill(".searchbox input", "figma");
  await page.waitForTimeout(200);
  const rows = await page.locator(".person-row").count();
  if (rows !== 1) throw new Error("expected 1 result for 'figma', got " + rows);
  await page.fill(".searchbox input", "");
});

await t("grid toggle", async () => {
  await page.locator('.view-toggle .icon-btn[title="Grid"]').click();
  await page.waitForSelector(".grid-card");
});

await page.screenshot({ path: "shot-people.png" });

await t("quick add opens profile", async () => {
  await page.fill(".quickadd input", "Test Person");
  await page.locator(".quickadd form").press("Enter" ? "input" : "input", {}).catch(() => {});
  await page.locator(".quickadd input").press("Enter");
  await page.waitForSelector(".name-input", { timeout: 3000 });
  const v = await page.locator(".name-input").inputValue();
  if (v !== "Test Person") throw new Error("name: " + v);
});

await t("profile: set cadence, log interaction, add tag", async () => {
  await page.locator(".cadence-row .type-chip", { hasText: "Monthly" }).click();
  await page.locator(".profile-actions .btn.primary").click();
  await page.fill('.quicklog input[type="text"]', "First hello");
  await page.locator(".quicklog .btn.primary").click();
  await page.waitForTimeout(200);
  const tl = await page.locator(".tl-entry").count();
  if (tl !== 1) throw new Error("timeline entries: " + tl);
  await page.locator(".chip-add", { hasText: "tag" }).click();
  await page.fill(".chip-input", "testtag");
  await page.locator(".chip-input").press("Enter");
  await page.waitForTimeout(150);
  const chips = await page.locator(".profile-head .chip", { hasText: "testtag" }).count();
  if (!chips) throw new Error("tag chip missing");
});

await page.screenshot({ path: "shot-profile.png" });

await t("keyboard: esc goes back, / focuses search", async () => {
  await page.keyboard.press("Escape");
  await page.waitForSelector(".quickadd input");
  await page.keyboard.press("/");
  const focused = await page.evaluate(() => document.activeElement.placeholder || "");
  if (!focused.toLowerCase().includes("search")) throw new Error("focus: " + focused);
});

await t("delete contact (two-step)", async () => {
  await page.keyboard.press("Escape");
  await page.fill(".searchbox input", "Test Person");
  await page.waitForTimeout(200);
  await page.locator(".person-name").first().click();
  await page.waitForSelector(".profile-actions");
  const del = page.locator(".profile-actions button", { hasText: "Delete" });
  await del.click();
  await page.locator(".profile-actions button", { hasText: "Really delete?" }).click();
  await page.waitForSelector(".quickadd input");
});

await t("clear sample data", async () => {
  const btn = page.locator(".rail-tool", { hasText: "Clear sample data" });
  await btn.click();
  await page.locator(".rail-tool", { hasText: "samples?" }).click();
  await page.waitForTimeout(300);
  const txt = await page.locator("#root").textContent();
  if (txt.includes("Maya Chen")) throw new Error("samples remain");
});

// dark theme screenshot
await page.emulateMedia({ colorScheme: "dark" });
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForTimeout(600);
await page.screenshot({ path: "shot-dark.png" });

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
