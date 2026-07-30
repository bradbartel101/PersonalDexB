// Assembles the static site into public/ (used by the Vercel build).
// The extension zip is regenerated when the `zip` binary exists (CI, local
// dev); otherwise the committed public/hearth-extension.zip is kept as-is.
import fs from "node:fs";
import { execSync } from "node:child_process";

fs.mkdirSync("public", { recursive: true });
fs.copyFileSync("hearth-standalone.html", "public/index.html");
fs.writeFileSync("public/.nojekyll", "");
try {
  execSync("cd extension && zip -qr ../public/hearth-extension.zip .", { stdio: "pipe" });
  console.log("extension zip rebuilt");
} catch (e) {
  console.log("zip unavailable — keeping committed public/hearth-extension.zip");
}
console.log("site assembled in public/");
