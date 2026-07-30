// Renders the Hearth mark into PNG app icons via headless Chromium.
import { chromium } from "playwright-core";
const html = (size) => `<!DOCTYPE html><body style="margin:0">
<div style="width:${size}px;height:${size}px;background:#2E6B57;display:flex;align-items:center;justify-content:center">
<svg width="${size * 0.62}" height="${size * 0.62}" viewBox="0 0 24 24" fill="none" stroke="#F6F4EF" stroke-width="2">
<circle cx="9.5" cy="12" r="6"/><circle cx="15.5" cy="12" r="6" opacity="0.45"/></svg></div></body>`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
for (const size of [192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(html(size));
  await page.screenshot({ path: `public/icon-${size}.png` });
  await page.close();
}
await browser.close();
console.log("icons written");
