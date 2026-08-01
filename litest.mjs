// LinkedIn / CSV import pipeline: header detection, field mapping, de-dupe by
// URL then name, re-import "new only" mode, bulk assign, and rule-driven
// auto-categorization. Runs against the built standalone file.
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const CSV = "linkedin-fixture.csv";
fs.writeFileSync(CSV, [
  "Notes:",
  '"When exporting your connection data, you may notice that some of the email addresses are missing."',
  "",
  "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
  "Jordan,Lee,https://www.linkedin.com/in/jordanlee,jordan@acme.com,Acme Corp,VP Engineering,12 Mar 2025",
  'Ana,"García Ruiz",https://www.linkedin.com/in/anagarcia,,Studio Norte,"Founder, Design",03 Jan 2024',
  "Tom,Baker,https://www.linkedin.com/in/tbaker,,Baker Capital,Managing Partner,28 Jun 2026",
  "Maya,Chen,https://www.linkedin.com/in/mayachen,,Figma,Product Designer,05 May 2023",
].join("\n"));

// A later export: Jordan changed jobs, Riley is new, everyone else repeats.
const CSV2 = "linkedin-fixture-2.csv";
fs.writeFileSync(CSV2, [
  "First Name,Last Name,URL,Email Address,Company,Position,Connected On",
  "Jordan,Lee,https://www.linkedin.com/in/jordanlee,jordan@newco.com,NewCo,CTO,12 Mar 2025",
  "Riley,Novak,https://www.linkedin.com/in/rileynovak,,Northwind Systems,Staff Engineer,01 Feb 2026",
].join("\n"));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto("file://" + path.resolve("hearth-standalone.html"));
await page.waitForTimeout(700);
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
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem("hearth-crm-v1")));
const openImport = async () => {
  await page.locator(".rail-tool", { hasText: "LinkedIn / CSV import" }).click();
  await page.waitForSelector(".li-steps");
};

await t("import modal explains the official export route, no scraping", async () => {
  await openImport();
  const txt = await page.locator(".modal").textContent();
  if (!txt.includes("Get a copy of your data") || !txt.includes("Connections"))
    throw new Error("missing export instructions");
  if (/extension/i.test(txt)) throw new Error("still references the extension");
});

await t("CSV skips the Notes preamble and reads every row", async () => {
  await page.setInputFiles('input[accept*="csv"]', CSV);
  await page.waitForSelector(".li-item");
  const items = await page.locator(".li-item").count();
  if (items !== 4) throw new Error("rows: " + items);
});

await t("de-dupes against existing people (Maya by name)", async () => {
  const matched = await page.locator(".li-item .pill").count();
  if (matched !== 1) throw new Error("expected 1 match pill, got " + matched);
  const header = await page.locator(".modal p").first().textContent();
  if (!header.includes("3") || !header.includes("1")) throw new Error("counts: " + header);
});

await t("rules auto-assign Investors from a company keyword", async () => {
  const chips = await page.locator(".li-item", { hasText: "Tom Baker" }).locator(".chip").allTextContents();
  if (!chips.includes("Investors")) throw new Error("chips: " + JSON.stringify(chips));
});

await t("'add new only' is the default and skips the match", async () => {
  const mode = await page.locator(".li-modes .type-chip.on").textContent();
  if (!mode.includes("Add new only")) throw new Error("default mode: " + mode);
  const btn = await page.locator(".modal-actions .btn.primary").textContent();
  if (!btn.includes("3")) throw new Error("import count: " + btn);
});

await t("bulk category + field mapping land correctly", async () => {
  await page.fill('input[list="import-groups"]', "Work");
  await page.locator(".modal-actions .btn.primary").click();
  await page.waitForTimeout(800);
  const d = await store();
  const jordan = d.contacts.find((c) => c.name === "Jordan Lee");
  if (!jordan) throw new Error("Jordan missing");
  if (!jordan.groups.includes("Work")) throw new Error("bulk group: " + jordan.groups);
  if (jordan.company !== "Acme Corp" || jordan.role !== "VP Engineering") throw new Error("fields");
  if (jordan.emails[0] !== "jordan@acme.com") throw new Error("email: " + jordan.emails);
  if (!jordan.linkedin.includes("jordanlee")) throw new Error("url: " + jordan.linkedin);
  if (jordan.connectedOn !== "12 Mar 2025") throw new Error("connectedOn: " + jordan.connectedOn);
  const ana = d.contacts.find((c) => c.name === "Ana García Ruiz");
  if (!ana || ana.role !== "Founder, Design") throw new Error("quoted name/role parsing");
  const tom = d.contacts.find((c) => c.name === "Tom Baker");
  if (!tom.groups.includes("Investors")) throw new Error("rule category not applied: " + tom.groups);
  const maya = d.contacts.filter((c) => c.name === "Maya Chen");
  if (maya.length !== 1) throw new Error("Maya duplicated: " + maya.length);
  if (maya[0].company !== "Figma") throw new Error("existing record clobbered");
});

await t("re-importing the same file adds nothing", async () => {
  const before = (await store()).contacts.length;
  await openImport();
  await page.setInputFiles('input[accept*="csv"]', CSV);
  await page.waitForSelector(".li-item");
  const btn = await page.locator(".modal-actions .btn.primary").textContent();
  if (!/\b0\b/.test(btn)) throw new Error("should import 0, got: " + btn);
  await page.locator(".modal-actions .btn", { hasText: "Back" }).click();
  await page.locator(".modal-actions .btn", { hasText: "Close" }).click();
  const after = (await store()).contacts.length;
  if (after !== before) throw new Error(`${before} -> ${after}`);
});

await t("a fresh export adds only the new person", async () => {
  const before = (await store()).contacts.length;
  await openImport();
  await page.setInputFiles('input[accept*="csv"]', CSV2);
  await page.waitForSelector(".li-item");
  await page.locator(".modal-actions .btn.primary").click();
  await page.waitForTimeout(800);
  const d = await store();
  if (d.contacts.length !== before + 1) throw new Error(`${before} -> ${d.contacts.length}`);
  if (!d.contacts.some((c) => c.name === "Riley Novak" && c.company === "Northwind Systems")) throw new Error("Riley missing");
  const jordan = d.contacts.find((c) => c.name === "Jordan Lee");
  if (jordan.company !== "Acme Corp") throw new Error("new-only mode overwrote company");
});

await t("'add new + update existing' fills blanks without clobbering", async () => {
  await openImport();
  await page.setInputFiles('input[accept*="csv"]', CSV2);
  await page.waitForSelector(".li-item");
  await page.locator(".li-modes .type-chip", { hasText: "update existing" }).click();
  await page.waitForTimeout(200);
  await page.locator(".modal-actions .btn.primary").click();
  await page.waitForTimeout(800);
  const jordan = (await store()).contacts.find((c) => c.name === "Jordan Lee");
  if (jordan.company !== "Acme Corp") throw new Error("clobbered curated company");
  if (!jordan.emails.includes("jordan@newco.com")) throw new Error("new email not merged: " + jordan.emails);
});

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
for (const f of [CSV, CSV2]) { try { fs.unlinkSync(f); } catch (e) { /* gone */ } }
process.exit(0);
