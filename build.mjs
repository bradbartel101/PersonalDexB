import esbuild from "esbuild";
import fs from "fs";

const r = await esbuild.build({
  entryPoints: ["src/app.jsx"],
  bundle: true,
  minify: true,
  format: "iife",
  write: false,
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
});
const js = r.outputFiles[0].text;
const css = fs.readFileSync("fonts-inline.css", "utf8") + "\n" + fs.readFileSync("src/styles.css", "utf8");

const html = `<title>Hearth — Personal CRM</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>${css}</style>
<div id="root"></div>
<script>${js}</script>
`;
fs.writeFileSync("hearth.html", html);
console.log("hearth.html", (fs.statSync("hearth.html").size / 1024).toFixed(0) + "KB");
