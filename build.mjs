import esbuild from "esbuild";
import fs from "fs";

async function bundle(standalone) {
  const r = await esbuild.build({
    entryPoints: ["src/app.jsx"],
    bundle: true,
    minify: true,
    format: "iife",
    write: false,
    jsx: "automatic",
    define: {
      "process.env.NODE_ENV": '"production"',
      __STANDALONE__: String(standalone),
    },
  });
  return r.outputFiles[0].text;
}

const css = fs.readFileSync("fonts-inline.css", "utf8") + "\n" + fs.readFileSync("src/styles.css", "utf8");

// Artifact build: fragment only — the artifact host supplies the document skeleton.
const artifactJs = await bundle(false);
fs.writeFileSync(
  "hearth.html",
  `<title>Hearth — Personal CRM</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${css}</style>
<div id="root"></div>
<script>${artifactJs}</script>
`
);

// Standalone build: complete document, localStorage-only, open directly in any browser.
const standaloneJs = await bundle(true);
const favicon =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#2E6B57" stroke-width="2"><circle cx="9.5" cy="12" r="6"/><circle cx="15.5" cy="12" r="6" opacity="0.45"/></svg>'
  );
fs.writeFileSync(
  "hearth-standalone.html",
  `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<meta name="theme-color" content="#2E6B57" />
<title>Hearth — Personal CRM</title>
<link rel="icon" href="${favicon}" />
<link rel="manifest" href="manifest.webmanifest" />
<link rel="apple-touch-icon" href="icon-192.png" />
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>${standaloneJs}</script>
</body>
</html>
`
);

for (const f of ["hearth.html", "hearth-standalone.html"])
  console.log(f, (fs.statSync(f).size / 1024).toFixed(0) + "KB");
