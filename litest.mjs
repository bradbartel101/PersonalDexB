import { chromium } from "playwright-core";
import path from "path";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
await page.goto("file://" + path.resolve("hearth-standalone.html"));
await page.waitForTimeout(700);
const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); }
  catch (e) { console.log("FAIL", name, "—", e.message.split("\n")[0]); }
};

// tiny valid jpeg data uri (2x2 red) generated via canvas in-page
const photo = await page.evaluate(() => {
  const cv = document.createElement("canvas"); cv.width = 40; cv.height = 40;
  const ctx = cv.getContext("2d"); ctx.fillStyle = "#c0392b"; ctx.fillRect(0, 0, 40, 40);
  return cv.toDataURL("image/jpeg", 0.9);
});
const capture = JSON.stringify({
  hearth: "linkedin-capture", v: 1, exportedAt: "2026-07-28T12:00:00Z",
  people: [
    { name: "Maya Chen", headline: "Product Designer at Figma", company: "", role: "",
      location: "San Francisco Bay Area", photo, linkedin: "https://www.linkedin.com/in/mayachen", capturedAt: "2026-07-28" },
    { name: "Devon Wright", headline: "Founding Engineer at Rill", company: "", role: "",
      location: "Denver", photo, linkedin: "https://www.linkedin.com/in/devonwright", capturedAt: "2026-07-28" },
  ],
});

await t("import modal opens with both channels", async () => {
  await page.locator(".rail-tool", { hasText: "LinkedIn / CSV import" }).click();
  await page.waitForSelector(".li-channel");
  const n = await page.locator(".li-channel").count();
  if (n !== 2) throw new Error("channels: " + n);
  const href = await page.locator(".li-actions a.btn").getAttribute("href");
  if (!href.endsWith("hearth-extension.zip")) throw new Error("zip link: " + href);
});

await t("paste capture JSON → review shows match + new", async () => {
  await page.fill(".li-paste", capture);
  await page.locator(".btn", { hasText: "Review pasted captures" }).click();
  await page.waitForSelector(".li-item");
  const items = await page.locator(".li-item").count();
  if (items !== 2) throw new Error("items: " + items);
  const matches = await page.locator(".li-item .pill", { hasText: "updates existing" }).count();
  if (matches !== 1) throw new Error("matches: " + matches);
});

await t("group + tag assignment on import", async () => {
  await page.fill('input[list="import-groups"]', "Work");
  await page.fill('input[placeholder="Apply tag…"]', "linkedin");
  await page.locator(".modal-actions .btn.primary").click();
  await page.waitForTimeout(700);
  const toast = await page.locator(".toast").textContent();
  if (!toast.includes("1 new") || !toast.includes("updated 1")) throw new Error("toast: " + toast);
});

await t("photos + fields landed; headline parsed to role/company", async () => {
  const [maya, devon] = await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem("hearth-crm-v1"));
    return [d.contacts.find((c) => c.name === "Maya Chen"), d.contacts.find((c) => c.name === "Devon Wright")];
  });
  if (!maya.photo || !maya.photo.startsWith("data:image/jpeg")) throw new Error("maya photo missing");
  if (maya.company !== "Figma") throw new Error("maya company clobbered: " + maya.company);
  if (maya.interactions.length !== 2) throw new Error("maya timeline lost");
  if (!maya.groups.includes("Work") || !maya.tags.includes("linkedin")) throw new Error("maya group/tag");
  if (!maya.custom.some((f) => f.label === "LinkedIn" && f.value.includes("mayachen"))) throw new Error("maya li url");
  if (!devon || devon.role !== "Founding Engineer" || devon.company !== "Rill") throw new Error("devon parse: " + JSON.stringify([devon.role, devon.company]));
  if (!devon.photo || !devon.groups.includes("Work")) throw new Error("devon photo/group");
});

await t("avatar image renders in people list", async () => {
  await page.waitForSelector(".person-row");
  const imgs = await page.locator(".person-row .avatar img").count();
  if (imgs < 2) throw new Error("avatar imgs: " + imgs);
});

await t("re-import same capture updates, no duplicates", async () => {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.length);
  await page.locator(".rail-tool", { hasText: "LinkedIn / CSV import" }).click();
  await page.fill(".li-paste", capture);
  await page.locator(".btn", { hasText: "Review pasted captures" }).click();
  await page.waitForSelector(".li-item");
  const matches = await page.locator(".li-item .pill", { hasText: "updates existing" }).count();
  if (matches !== 2) throw new Error("expected both to match now, got " + matches);
  await page.locator(".modal-actions .btn.primary").click();
  await page.waitForTimeout(700);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.length);
  if (after !== before) throw new Error(`dup created: ${before} -> ${after}`);
});

await t("CSV path routes through review modal", async () => {
  await page.locator(".rail-tool", { hasText: "LinkedIn / CSV import" }).click();
  await page.locator(".li-actions .btn", { hasText: "Import Connections.csv" }).click();
  await page.setInputFiles('input[accept*="csv"]', "Connections.csv");
  await page.waitForSelector(".li-item");
  const items = await page.locator(".li-item").count();
  if (items !== 3) throw new Error("csv items: " + items);
  await page.locator(".modal-actions .btn.primary").click();
  await page.waitForTimeout(700);
  const jordan = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("hearth-crm-v1")).contacts.find((c) => c.name === "Jordan Lee"));
  if (!jordan || jordan.company !== "Acme Corp") throw new Error("jordan missing");
});

await page.screenshot({ path: "shot-li.png" });
console.log(errors.length ? "ERRORS:\n" + errors.join("\n") : "no page errors");
await browser.close();
process.exit(0);
