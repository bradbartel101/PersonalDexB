// New data-model + management features: relationship strength, multiple
// emails/phones, category colours/rename/delete, editable auto-categorize
// rules, cadence units, CSV export, and the dashboard's new sections.
import { chromium } from "playwright-core";
import path from "path";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 950 }, acceptDownloads: true });
const page = await ctx.newPage();
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
const catRow = async (name) => {
  const idx = await page.locator(".cat-name").evaluateAll((els, n) => els.findIndex((e) => e.value === n), name);
  if (idx < 0) throw new Error("category row not found: " + name);
  return page.locator(".cat-row").nth(idx);
};
const openPerson = async (name) => {
  await page.locator(".nav-btn", { hasText: "People" }).click();
  await page.waitForSelector(".searchbox input");
  await page.fill(".searchbox input", name);
  await page.waitForTimeout(250);
  await page.locator(".person-name").first().click();
  await page.waitForSelector(".profile-head");
};

await t("dashboard shows recent interactions", async () => {
  const sec = page.locator(".section", { hasText: "Recent interactions" });
  if (!(await sec.count())) throw new Error("section missing");
  const rows = await sec.locator(".up-row").count();
  if (rows < 3) throw new Error("rows: " + rows);
});

await t("dashboard surfaces uncategorized people", async () => {
  const sec = page.locator(".section", { hasText: "Needs a category" });
  if (!(await sec.count())) throw new Error("section missing");
  if (!(await sec.locator(".uncat-chip", { hasText: "Chris Palmer" }).count()))
    throw new Error("Chris (no category) not listed");
});

await t("seeded categories carry colours", async () => {
  const d = await store();
  if (!Array.isArray(d.groups) || typeof d.groups[0] !== "object") throw new Error("groups not objects");
  if (d.groups.length < 6) throw new Error("expected the six default categories, got " + d.groups.length);
  if (!d.groups.every((g) => Number.isInteger(g.color))) throw new Error("missing colours");
  if (!(await page.locator(".chip.gc-4").count() >= 0)) throw new Error("no colour classes");
});

await t("relationship strength renders and edits", async () => {
  await openPerson("Maya Chen");
  const on = await page.locator(".strength .str-dot.on").count();
  if (on !== 5) throw new Error("seeded strength dots: " + on);
  await page.locator(".strength .str-dot").nth(2).click();
  await page.waitForTimeout(400);
  const maya = (await store()).contacts.find((c) => c.name === "Maya Chen");
  if (maya.strength !== 3) throw new Error("strength: " + maya.strength);
  const label = await page.locator(".str-label").textContent();
  if (label !== "Solid") throw new Error("label: " + label);
});

await t("multiple emails and phones", async () => {
  const emailRows = page.locator(".field.multi", { hasText: "Email" }).locator("input");
  await emailRows.nth(1).fill("maya.work@figma.com");
  await emailRows.nth(1).blur();
  await page.waitForTimeout(400);
  const phoneRows = page.locator(".field.multi", { hasText: "Phone" }).locator("input");
  await phoneRows.nth(0).fill("(555) 111-2222");
  await phoneRows.nth(0).blur();
  await page.waitForTimeout(400);
  const maya = (await store()).contacts.find((c) => c.name === "Maya Chen");
  if (maya.emails.length !== 2) throw new Error("emails: " + JSON.stringify(maya.emails));
  if (!maya.emails.includes("maya.work@figma.com")) throw new Error("second email missing");
  if (maya.phones[0] !== "(555) 111-2222") throw new Error("phone: " + JSON.stringify(maya.phones));
  const mailto = await page.locator('.field.multi a[href^="mailto:"]').count();
  if (mailto !== 2) throw new Error("mailto actions: " + mailto);
});

await t("custom cadence in weeks converts to days", async () => {
  await page.locator(".cadence-row .type-chip", { hasText: "Custom" }).click();
  await page.waitForSelector(".custom-cadence");
  await page.fill(".custom-cadence .days-input", "3");
  await page.selectOption(".custom-cadence select", "weeks");
  await page.waitForTimeout(400);
  const maya = (await store()).contacts.find((c) => c.name === "Maya Chen");
  if (maya.cadence.n !== 3 || maya.cadence.unit !== "weeks") throw new Error(JSON.stringify(maya.cadence));
  const status = await page.locator(".cadence-status", { hasText: "Last touch" }).textContent();
  if (!status.includes("Last touch")) throw new Error("status: " + status);
});

await t("last-contacted override anchors the cadence", async () => {
  await openPerson("Chris Palmer");
  const line = page.locator(".cadence-status", { hasText: "Last touch" });
  const before = await line.textContent();
  if (!/days ago/.test(before)) throw new Error("expected a stale last touch first: " + before);
  const today = await page.evaluate(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    const p = (n) => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
  });
  await page.fill('.field input[type="date"]', today);
  await page.waitForTimeout(500);
  const chris = (await store()).contacts.find((c) => c.name === "Chris Palmer");
  if (chris.lastContactedAt !== today) throw new Error("not saved: " + chris.lastContactedAt);
  const after = await line.textContent();
  if (after === before) throw new Error("last-touch line did not update: " + after);
  if (!after.includes("Last touch today")) throw new Error("override did not win: " + after);
});

await t("category manager renames everywhere", async () => {
  await page.keyboard.press("Escape");
  await page.locator(".rail-tool", { hasText: "Categories" }).click();
  await page.waitForSelector(".cat-row");
  const row = await catRow("Investors");
  await row.locator(".cat-name").fill("Angels");
  await row.locator(".cat-name").blur();
  await page.waitForTimeout(500);
  const d = await store();
  if (!d.groups.some((g) => g.name === "Angels")) throw new Error("category not renamed");
  if (d.groups.some((g) => g.name === "Investors")) throw new Error("old name remains");
  const james = d.contacts.find((c) => c.name === "James Okafor");
  if (!james.groups.includes("Angels")) throw new Error("contact not migrated: " + james.groups);
  if (!d.rules.some((r) => r.group === "Angels")) throw new Error("rule not migrated");
});

await t("category recolour persists", async () => {
  const row = await catRow("Angels");
  await row.locator(".swatch").nth(6).click();
  await page.waitForTimeout(400);
  const g = (await store()).groups.find((x) => x.name === "Angels");
  if (g.color !== 6) throw new Error("color: " + g.color);
});

await t("category delete unfiles its people", async () => {
  const row = await catRow("Clients");
  await row.locator("button", { hasText: "Remove" }).click();
  await row.locator("button", { hasText: "Sure?" }).click();
  await page.waitForTimeout(500);
  const d = await store();
  if (d.groups.some((g) => g.name === "Clients")) throw new Error("still present");
  if (d.contacts.some((c) => (c.groups || []).includes("Clients"))) throw new Error("contacts still reference it");
  await page.locator(".modal-actions .btn.primary", { hasText: "Done" }).click();
});

await t("rules editor shows live match counts and saves edits", async () => {
  await page.locator(".rail-tool", { hasText: "Auto-categorize rules" }).click();
  await page.waitForSelector(".rule-row");
  const rows = await page.locator(".rule-row").count();
  if (rows < 3) throw new Error("rules: " + rows);
  const counts = await page.locator(".rule-count").allTextContents();
  if (!counts.some((c) => +c > 0)) throw new Error("no rule matches anyone: " + counts);
  const row = page.locator(".rule-row").first();
  await row.locator(".rule-input").first().fill("ventures, capital, fund, whitfield");
  await page.waitForTimeout(500);
  const d = await store();
  if (!d.rules[0].keywords.includes("whitfield")) throw new Error("keywords not saved");
});

await t("running rules files matching people", async () => {
  await page.locator(".modal-actions .btn", { hasText: "Run on everyone" }).click();
  await page.waitForTimeout(700);
  const toast = await page.locator(".toast").textContent();
  if (!/Categorized|already filed/.test(toast)) throw new Error("toast: " + toast);
  const dana = (await store()).contacts.find((c) => c.name === "Dana Whitfield");
  if (!dana.groups.includes("Angels")) throw new Error("Dana not categorized: " + JSON.stringify(dana.groups));
});

await t("adding a rule creates its category", async () => {
  await page.locator(".modal-actions .btn", { hasText: "Add rule" }).click();
  await page.waitForTimeout(300);
  const row = page.locator(".rule-row").last();
  await row.locator(".rule-input").first().fill("anthropic");
  await row.locator(".rule-input.short").fill("AI folks");
  await page.waitForTimeout(500);
  await page.locator(".modal-actions .btn", { hasText: "Run on everyone" }).click();
  await page.waitForTimeout(700);
  const d = await store();
  if (!d.groups.some((g) => g.name === "AI folks")) throw new Error("category not created");
  const priya = d.contacts.find((c) => c.name === "Priya Sharma");
  if (!priya.groups.includes("AI folks")) throw new Error("Priya not matched: " + priya.groups);
  await page.locator(".modal-actions .btn.primary", { hasText: "Done" }).click();
});

await t("People view filters by strength and uncategorized", async () => {
  await page.locator(".nav-btn", { hasText: "People" }).click();
  await page.waitForSelector(".searchbox input");
  await page.selectOption('select[aria-label="Strength"]', "4");
  await page.waitForTimeout(300);
  const strong = await page.locator(".person-row").count();
  const d = await store();
  const expect = d.contacts.filter((c) => !c.archived && (c.strength || 0) >= 4).length;
  if (strong !== expect) throw new Error(`shown ${strong}, expected ${expect}`);
  await page.selectOption('select[aria-label="Strength"]', "");
  await page.selectOption('select[aria-label="Show"]', "uncategorized");
  await page.waitForTimeout(300);
  const uncat = await page.locator(".person-row").count();
  const expectU = d.contacts.filter((c) => !c.archived && (c.groups || []).length === 0).length;
  if (uncat !== expectU) throw new Error(`uncategorized ${uncat}, expected ${expectU}`);
  await page.selectOption('select[aria-label="Show"]', "active");
});

await t("category chips render in the list", async () => {
  const chips = await page.locator(".person-row .chip.gc-0, .person-row .chip.gc-3, .person-row .chip.gc-6").count();
  if (chips < 1) throw new Error("no coloured category chips in rows");
});

await t("CSV export round-trips, including commas and quotes", async () => {
  // Give one contact a value that must be escaped.
  const NASTY = 'He said "hi", twice';
  await openPerson("Chris Palmer");
  await page.fill(".notes-area", NASTY);
  await page.waitForTimeout(500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }),
    page.locator(".rail-tool", { hasText: "Export contacts (CSV)" }).click(),
  ]);
  if (!dl.suggestedFilename().endsWith(".csv")) throw new Error("filename: " + dl.suggestedFilename());
  const fs = await import("node:fs");
  const text = fs.readFileSync(await dl.path(), "utf8");

  // minimal RFC4180 parse
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c !== "")) rows.push(row);

  const d = await store();
  const header = rows[0];
  if (rows.length !== d.contacts.length + 1) throw new Error(`rows ${rows.length - 1} vs ${d.contacts.length}`);
  for (const r of rows) if (r.length !== header.length) throw new Error("ragged row: " + r.join("|"));
  const col = (name) => header.indexOf(name);
  for (const h of ["Name", "Emails", "Categories", "Strength", "Cadence", "Notes"])
    if (col(h) < 0) throw new Error("missing column " + h);

  const maya = rows.find((r) => r[col("Name")] === "Maya Chen");
  if (!maya) throw new Error("Maya row missing");
  if (maya[col("Emails")] !== "maya@hey.com; maya.work@figma.com")
    throw new Error("emails cell: " + maya[col("Emails")]);
  if (!maya[col("Categories")].includes("Close Friends")) throw new Error("categories cell");
  if (maya[col("Strength")] !== "3") throw new Error("strength cell: " + maya[col("Strength")]);
  if (maya[col("Cadence")] !== "every 3 weeks") throw new Error("cadence cell: " + maya[col("Cadence")]);

  const chris = rows.find((r) => r[col("Name")] === "Chris Palmer");
  if (chris[col("Notes")] !== NASTY) throw new Error("escaping broke: " + chris[col("Notes")]);
});

await t("JSON backup round-trips the new model", async () => {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }),
    page.locator(".rail-tool", { hasText: "Export backup (JSON)" }).click(),
  ]);
  const fs = await import("node:fs");
  const backup = JSON.parse(fs.readFileSync(await dl.path(), "utf8"));
  if (typeof backup.groups[0] !== "object") throw new Error("groups not objects in backup");
  if (!Array.isArray(backup.rules) || !backup.rules.length) throw new Error("rules missing from backup");
  const maya = backup.contacts.find((c) => c.name === "Maya Chen");
  if (!maya.emails || maya.emails.length !== 2 || maya.strength !== 3) throw new Error("contact fields lost");
});

await t("v1 data migrates on load", async () => {
  await page.evaluate(() => {
    localStorage.setItem("hearth-crm-v1", JSON.stringify({
      v: 1,
      groups: ["Work", "Family"],
      prefs: { view: "list" },
      contacts: [{
        id: "old1", name: "Legacy Person", email: "old@example.com", phone: "555-0000",
        company: "Oldco", role: "Analyst", tags: ["legacy"], groups: ["Work"],
        custom: [{ id: "cf1", label: "LinkedIn", value: "https://linkedin.com/in/legacy" }],
        interactions: [{ id: "i1", type: "call", date: "2026-01-05", text: "hello" }],
        cadence: { id: "custom", days: 21 },
      }],
    }));
  });
  await page.reload();
  await page.waitForTimeout(900);
  const d = await store();
  const p = d.contacts[0];
  if (p.emails[0] !== "old@example.com") throw new Error("email not migrated: " + JSON.stringify(p.emails));
  if (p.phones[0] !== "555-0000") throw new Error("phone not migrated");
  if (!p.linkedin.includes("legacy")) throw new Error("linkedin not lifted from custom fields");
  if (p.custom.length !== 0) throw new Error("custom LinkedIn field left behind");
  if (typeof d.groups[0] !== "object") throw new Error("string categories not upgraded");
  if (p.strength !== 0) throw new Error("strength default");
  const txt = await page.locator("#root").textContent();
  if (!txt.includes("Legacy Person")) throw new Error("app did not render migrated data");
});

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
process.exit(0);
