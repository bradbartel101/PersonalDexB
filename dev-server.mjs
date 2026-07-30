// Local stand-in for the Vercel deployment: serves the built app at /
// and mounts the same /api handlers with a file-backed store.
// Usage: node dev-server.mjs [port] — passphrase defaults to "test-pass".
import http from "node:http";
import fs from "node:fs";

process.env.HEARTH_PASSPHRASE = process.env.HEARTH_PASSPHRASE || "test-pass";
process.env.HEARTH_STORE_FILE = process.env.HEARTH_STORE_FILE || "./devstore.json";

const { default: dataHandler } = await import("./api/data.js");
const { default: capturesHandler } = await import("./api/captures.js");
const { default: pushHandler } = await import("./api/push.js");
const { default: notifyHandler } = await import("./api/notify.js");

const STATIC = {
  "/sw.js": ["public/sw.js", "text/javascript"],
  "/manifest.webmanifest": ["public/manifest.webmanifest", "application/manifest+json"],
  "/icon-192.png": ["public/icon-192.png", "image/png"],
  "/icon-512.png": ["public/icon-512.png", "image/png"],
};

function vercelify(res) {
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (o) => { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); };
}

const server = http.createServer(async (req, res) => {
  vercelify(res);
  const url = new URL(req.url, "http://x");
  let body = "";
  for await (const chunk of req) body += chunk;
  try { req.body = body ? JSON.parse(body) : undefined; } catch (e) { req.body = undefined; }

  try {
    if (url.pathname === "/api/data") return await dataHandler(req, res);
    if (url.pathname === "/api/captures") return await capturesHandler(req, res);
    if (url.pathname === "/api/push") return await pushHandler(req, res);
    if (url.pathname === "/api/notify") return await notifyHandler(req, res);
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }

  if (STATIC[url.pathname]) {
    const [file, type] = STATIC[url.pathname];
    try {
      const buf = fs.readFileSync(file);
      res.setHeader("Content-Type", type);
      return res.end(buf);
    } catch (e) { return res.status(404).json({ error: "missing " + file }); }
  }

  if (url.pathname === "/" || url.pathname === "/index.html") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(fs.readFileSync("hearth-standalone.html"));
  }
  res.status(404).json({ error: "not found" });
});

const port = +(process.argv[2] || 8787);
server.listen(port, () => console.log("hearth dev server on http://127.0.0.1:" + port));
