// UI + API tests for the integrations layer: settings panel, graceful
// degradation when nothing is connected, the AI features against a stubbed
// Anthropic endpoint, natural-language search, quick capture, and
// field-level merge. Starts a real dev server. node integtest.mjs
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import http from "node:http";
import fs from "node:fs";

const PORT = 8795, AIPORT = 8796;
const BASE = `http://127.0.0.1:${PORT}`;
const PASS = "test-pass";
const STORE = "./integtest-store.json";
try { fs.unlinkSync(STORE); } catch (e) { /* fresh */ }

/* Stub Anthropic: records requests, returns canned completions per task. */
const aiCalls = [];
const aiServer = http.createServer((req, res) => {
  let body = "";
  req.on("data", (c) => { body += c; });
  req.on("end", () => {
    const parsed = JSON.parse(body || "{}");
    aiCalls.push(parsed);
    const prompt = String(parsed.messages?.[0]?.content || "");
    let text = "unexpected";
    if (/Summarize my relationship/.test(prompt)) {
      text = "- Roommate at Berkeley; the friendship predates both our careers.\n- Weighing going freelance.\n- You owe her a contract template.";
    } else if (/Draft a message reconnecting/.test(prompt)) {
      text = "Hey Maya — it's been a while. How's the freelance thinking going? Still owe you that contract template.";
    } else if (/suggest which of my existing categories/.test(prompt)) {
      text = '{"categories":["Close Friends"],"tags":["design"],"why":"Longtime friend who works in design."}';
    } else if (/Translate this question into a filter/.test(prompt)) {
      text = '{"categories":["Investors"],"notContactedSince":"2026-03-01","sort":"overdue","explain":"Investors with no contact since March 1"}';
    }
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ content: [{ type: "text", text }] }));
  });
});
await new Promise((r) => aiServer.listen(AIPORT, r));

const server = spawn("node", ["dev-server.mjs", String(PORT)], {
  env: {
    ...process.env,
    HEARTH_STORE_FILE: STORE,
    HEARTH_PASSPHRASE: PASS,
    ANTHROPIC_API_KEY: "sk-test",
    ANTHROPIC_BASE_URL: `http://127.0.0.1:${AIPORT}`,
    ANTHROPIC_MODEL: "claude-sonnet-5",
  },
  stdio: "pipe",
});
await new Promise((res) => server.stdout.once("data", res));

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 950 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => {
  const txt = m.text();
  // The first probe intentionally calls /api/data with no passphrase to learn
  // whether a backend exists; its 401 is expected, not a fault.
  if (m.type() === "error" && !/401 \(Unauthorized\)/.test(txt)) errors.push("console: " + txt);
});

const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); }
  catch (e) { console.log("FAIL", name, "—", e.message.split("\n")[0]); }
};
const store = () => page.evaluate(() => JSON.parse(localStorage.getItem("hearth-crm-v1")));
const openPerson = async (name) => {
  await page.locator(".nav-btn", { hasText: "People" }).click();
  await page.waitForSelector(".searchbox input");
  await page.fill(".searchbox input", name);
  await page.waitForTimeout(250);
  await page.locator(".person-name").first().click();
  await page.waitForSelector(".profile-head");
};

await page.goto(BASE + "/?pollms=1500");
await page.waitForTimeout(600);
await page.fill(".sync-pass", PASS);
await page.locator(".rail-sync .btn.primary").click();
await page.waitForSelector(".sync-line.ok", { timeout: 6000 });
await page.waitForTimeout(1800);

/* ---------- graceful degradation ---------- */

await t("dashboard shows Google is not connected yet", async () => {
  await page.locator(".nav-btn", { hasText: "Today" }).click();
  await page.waitForSelector(".sync-strip", { timeout: 6000 });
  const txt = await page.locator(".sync-strip").textContent();
  if (!/aren't connected/.test(txt)) throw new Error("strip: " + txt);
});

await t("integrations panel reports real state", async () => {
  await page.locator(".rail-tool", { hasText: "Integrations" }).click();
  await page.waitForSelector(".int-block");
  const txt = await page.locator(".modal").textContent();
  if (!/Not configured/.test(txt)) throw new Error("expected Google unconfigured");
  if (!/Key present/.test(txt)) throw new Error("expected the stubbed Anthropic key to be detected");
  if (!/GOOGLE_CLIENT_ID/.test(txt)) throw new Error("missing setup instructions");
  if (!/api\/google/.test(txt)) throw new Error("missing redirect URI hint");
});

await t("toggling an integration setting persists to the server", async () => {
  const box = page.locator(".int-block", { hasText: "Anthropic" }).locator('input[type="checkbox"]');
  await box.uncheck();
  await page.waitForTimeout(600);
  const r = await fetch(BASE + "/api/integrations", { headers: { Authorization: "Bearer " + PASS } }).then((x) => x.json());
  if (r.settings.aiEnabled !== false) throw new Error("not persisted: " + JSON.stringify(r.settings));
  await box.check();
  await page.waitForTimeout(600);
});

await t("digest cadence is settable", async () => {
  await page.locator(".int-block", { hasText: "Digest" }).locator(".type-chip", { hasText: "weekly" }).click();
  await page.waitForTimeout(600);
  const r = await fetch(BASE + "/api/integrations", { headers: { Authorization: "Bearer " + PASS } }).then((x) => x.json());
  if (r.settings.digest !== "weekly") throw new Error("digest: " + r.settings.digest);
  await page.locator(".modal-actions .btn.primary", { hasText: "Done" }).click();
});

/* ---------- AI features ---------- */

await t("AI summarize returns and renders", async () => {
  await openPerson("Maya Chen");
  await page.locator(".pcard", { hasText: "AI assist" }).locator(".btn", { hasText: "Summarize" }).click();
  await page.waitForSelector(".ai-out-body", { timeout: 8000 });
  const txt = await page.locator(".ai-out-body").first().textContent();
  if (!/Berkeley/.test(txt)) throw new Error("summary: " + txt);
});

await t("the prompt carries real record context, not the whole database", async () => {
  const last = aiCalls[aiCalls.length - 1];
  const prompt = last.messages[0].content;
  if (!/Maya Chen/.test(prompt)) throw new Error("person missing from prompt");
  if (!/Sightglass/.test(prompt)) throw new Error("key facts missing from prompt");
  if (/Grandma June/.test(prompt)) throw new Error("leaked an unrelated contact into the prompt");
  if (last.model !== "claude-sonnet-5") throw new Error("model: " + last.model);
});

await t("outreach draft respects the tone control and is editable", async () => {
  await page.locator(".ai-draft .type-chip", { hasText: "brief" }).click();
  await page.locator(".btn", { hasText: "Draft outreach" }).click();
  await page.waitForSelector(".ai-draft-text", { timeout: 8000 });
  const val = await page.locator(".ai-draft-text").inputValue();
  if (!/Maya/.test(val)) throw new Error("draft: " + val);
  const sys = aiCalls[aiCalls.length - 1].system;
  if (!/Very brief/.test(sys)) throw new Error("tone not applied: " + sys);
  await page.fill(".ai-draft-text", val + " Edited.");
  if (!(await page.locator(".ai-draft-text").inputValue()).endsWith("Edited.")) throw new Error("draft not editable");
});

await t("nothing in the AI path can send a message", async () => {
  const openIn = await page.locator('.ai-out a[href^="mailto:"]').count();
  if (openIn !== 1) throw new Error("expected exactly one mailto handoff, got " + openIn);
  const html = await page.content();
  if (/gmail\.send|calendar\.events\.insert/i.test(html)) throw new Error("send scope referenced in UI");
});

await t("category suggestion applies on confirm", async () => {
  await page.locator(".btn", { hasText: "Suggest categories" }).click();
  await page.waitForTimeout(1200);
  const chip = page.locator(".ai-out .chip", { hasText: "design" });
  if (!(await chip.count())) throw new Error("no tag suggestion rendered");
  await chip.first().click();
  await page.waitForTimeout(600);
  const maya = (await store()).contacts.find((c) => c.name === "Maya Chen");
  if (!maya.tags.includes("design")) throw new Error("tag not applied: " + maya.tags);
});

await t("natural-language search filters the list", async () => {
  await page.keyboard.press("Escape");
  await page.waitForSelector(".searchbox input");
  await page.fill(".searchbox input", "");
  await page.locator(".toolbar .btn", { hasText: "Ask" }).click();
  await page.fill(".ask-bar input", "investors I haven't talked to since spring");
  await page.locator(".ask-bar .btn.primary").click();
  await page.waitForSelector(".ask-result", { timeout: 8000 });
  const txt = await page.locator(".ask-result").textContent();
  if (!/Investors with no contact/.test(txt)) throw new Error("explain: " + txt);
  const rows = await page.locator(".person-row").count();
  const names = await page.locator(".person-name").allTextContents();
  if (!rows) throw new Error("filter matched nobody");
  if (!names.every((n) => ["James Okafor", "Dana Whitfield"].includes(n)))
    throw new Error("unexpected matches: " + names.join(", "));
});

await t("clearing the question restores the full list", async () => {
  await page.locator(".ask-bar .btn.ghost", { hasText: "Clear" }).click();
  await page.waitForTimeout(300);
  const rows = await page.locator(".person-row").count();
  if (rows < 8) throw new Error("rows after clear: " + rows);
});

/* ---------- local features that must work without any integration ---------- */

await t("quick capture parses and saves", async () => {
  await page.locator(".rail-tool", { hasText: "Quick capture" }).click();
  await page.waitForSelector(".li-paste");
  await page.fill(".li-paste", "met Jane Fitz, VP Eng at Acme, referred by Sam");
  await page.locator(".modal-actions .btn.primary", { hasText: "Parse" }).click();
  await page.waitForSelector(".qc-grid");
  const vals = await page.locator(".qc-field input").evaluateAll((els) => els.map((e) => e.value));
  if (vals[0] !== "Jane Fitz") throw new Error("name: " + vals[0]);
  if (vals[1] !== "VP Engineering") throw new Error("role: " + vals[1]);
  if (vals[2] !== "Acme") throw new Error("company: " + vals[2]);
  await page.locator(".modal-actions .btn.primary", { hasText: "Save person" }).click();
  await page.waitForSelector(".name-input", { timeout: 5000 });
  await page.waitForTimeout(900);
  const jane = (await store()).contacts.find((c) => c.name === "Jane Fitz");
  if (!jane || jane.context !== "Referred by Sam") throw new Error("saved: " + JSON.stringify(jane && jane.context));
});

await t("field-level merge picks winners and keeps both timelines", async () => {
  await page.keyboard.press("Escape");
  await page.waitForSelector(".quickadd input");
  await page.fill(".quickadd input", "Maya Chen");
  await page.locator(".quickadd input").press("Enter");
  await page.waitForSelector(".name-input");
  const emailInput = page.locator('.field.multi input[type="email"]').first();
  await emailInput.fill("dupe@example.com");
  await emailInput.blur();
  await page.waitForTimeout(900);
  await page.keyboard.press("Escape");

  await page.locator(".rail-tool", { hasText: "Merge duplicates" }).click();
  await page.waitForSelector(".dup-group");
  await page.locator(".btn", { hasText: "Review field by field" }).click();
  await page.waitForSelector(".merge-grid");
  const before = (await store()).contacts.filter((c) => c.name === "Maya Chen");
  if (before.length !== 2) throw new Error("expected 2 Mayas, got " + before.length);
  const totalInteractions = before.reduce((n, c) => n + c.interactions.length, 0);
  // pick the richer record's company
  await page.locator(".merge-cell", { hasText: "Figma" }).first().click();
  await page.locator(".modal-actions .btn.primary", { hasText: "Merge" }).click();
  await page.waitForTimeout(800);
  const after = (await store()).contacts.filter((c) => c.name === "Maya Chen");
  if (after.length !== 1) throw new Error("merge left " + after.length);
  if (after[0].company !== "Figma") throw new Error("company: " + after[0].company);
  if (after[0].interactions.length !== totalInteractions) throw new Error("timeline lost entries");
  if (!after[0].emails.includes("dupe@example.com")) throw new Error("emails not unioned");
});

await t("insights render with the new fields", async () => {
  await page.locator(".nav-btn", { hasText: "Insights" }).click();
  await page.waitForSelector(".bar-row");
  const txt = await page.locator("#root").textContent();
  for (const heading of ["Network by category", "Contacts added", "Neglected relationships", "Response patterns"])
    if (!txt.includes(heading)) throw new Error("missing section: " + heading);
  if (!/Needs direction data/.test(txt)) throw new Error("response patterns should explain the empty state");
});

await t("everything still works with AI switched off", async () => {
  await fetch(BASE + "/api/integrations", {
    method: "PUT",
    headers: { Authorization: "Bearer " + PASS, "Content-Type": "application/json" },
    body: JSON.stringify({ settings: { aiEnabled: false } }),
  });
  await page.reload();
  await page.waitForTimeout(2200);
  await openPerson("Grandma June");
  const txt = await page.locator(".pcard", { hasText: "AI assist" }).textContent();
  if (!/ANTHROPIC_API_KEY/.test(txt)) throw new Error("should fall back to the setup hint: " + txt);
  const ask = await page.locator(".toolbar .btn", { hasText: "Ask" }).count();
  if (ask !== 0) throw new Error("Ask button should be hidden when AI is off");
});

await t("backup includes the new fields and auto-logged interactions", async () => {
  const doc = await fetch(BASE + "/api/data", { headers: { Authorization: "Bearer " + PASS } }).then((r) => r.json());
  const maya = doc.doc.contacts.find((c) => c.name === "Maya Chen");
  if (!maya.facts || !maya.facts.length) throw new Error("key facts missing from the synced doc");
  if (!("timezone" in maya) || !("pronouns" in maya)) throw new Error("enrichment fields missing");
  if (!maya.tags.includes("design")) throw new Error("AI-applied tag did not round-trip");
});

console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
server.kill();
aiServer.close();
try { fs.unlinkSync(STORE); } catch (e) { /* gone */ }
process.exit(0);
