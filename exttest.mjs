import { chromium } from "playwright-core";
import fs from "fs";

// Mock of LinkedIn's profile top card structure + og fallbacks.
const fixture = `<!DOCTYPE html><html><head>
<meta property="og:title" content="Jordan Lee | LinkedIn" />
<meta property="og:image" content="https://media.licdn.com/dms/image/fake.jpg" />
<link rel="canonical" href="https://www.linkedin.com/in/jordanlee?originalSubdomain=us" />
</head><body><main>
<img class="pv-top-card-profile-picture__image--show" alt="Jordan Lee" width="200" src="PHOTO_SRC" />
<h1>Jordan Lee</h1>
<div class="text-body-medium break-words">VP Engineering at Acme Corp</div>
<span class="text-body-small inline t-black--light break-words">Denver, Colorado, United States</span>
<button aria-label="Current company: Acme Corp. Click to skip to experience card">Acme Corp</button>
</main></body></html>`;

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage();
// serve fixture at a linkedin-like path so the pathname regex matches
await page.route("**/*", (route) => {
  const url = route.request().url();
  if (url.includes("/in/jordanlee")) {
    // real 1x1 jpeg for the photo fetch path (photo src is data: so no fetch needed)
    return route.fulfill({ contentType: "text/html", body: fixture.replace("PHOTO_SRC",
      "data:image/jpeg;base64," + fs.readFileSync("f.woff2") === null ? "" : (() => {
        return "";
      })()) });
  }
  return route.continue();
});
// simpler: draw the photo as data uri directly
const photoUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
await page.unroute("**/*");
await page.route("**/*", (route) => {
  const url = route.request().url();
  if (url.includes("/in/jordanlee"))
    return route.fulfill({ contentType: "text/html", body: fixture.replace("PHOTO_SRC", photoUri) });
  return route.continue();
});

await page.goto("https://www.linkedin.com/in/jordanlee");
// stub chrome APIs the content script uses
await page.evaluate(() => {
  window._stored = { captured: [] };
  window.chrome = {
    runtime: { sendMessage: (msg, cb) => cb({ ok: false }), lastError: null },
    storage: { local: {
      get: async () => ({ captured: window._stored.captured }),
      set: async (obj) => { window._stored = { ...window._stored, ...obj }; },
    } },
  };
});
await page.evaluate(fs.readFileSync("extension/content.js", "utf8"));
await page.waitForSelector("#hearth-capture-host", { state: "attached" });
// click inside closed shadow root via elementFromPoint
await page.mouse.click(await page.evaluate(() => innerWidth - 80), await page.evaluate(() => innerHeight - 35));
await page.waitForTimeout(600);
const captured = await page.evaluate(() => window._stored.captured);
const p = captured[0] || {};
const checks = {
  "one capture": captured.length === 1,
  "name": p.name === "Jordan Lee",
  "headline": p.headline === "VP Engineering at Acme Corp",
  "company": p.company === "Acme Corp",
  "location": (p.location || "").startsWith("Denver"),
  "url normalized": p.linkedin === "https://www.linkedin.com/in/jordanlee",
  "photo captured": typeof p.photo === "string" && p.photo.startsWith("data:image/jpeg"),
};
let fail = 0;
for (const [k, v] of Object.entries(checks)) { console.log(v ? "ok  " : "FAIL", k); if (!v) fail++; }
if (fail) console.log("captured:", JSON.stringify(p).slice(0, 400));
await browser.close();
process.exit(0);
