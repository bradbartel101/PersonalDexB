// Assembles the static site into public/ (used by the Vercel build).
import fs from "node:fs";

fs.mkdirSync("public", { recursive: true });
fs.copyFileSync("hearth-standalone.html", "public/index.html");
fs.writeFileSync("public/.nojekyll", "");
console.log("site assembled in public/");
