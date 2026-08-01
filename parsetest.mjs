// Unit tests for quick-capture parsing (src/parse.js)
import { parseQuickCapture as P } from "./src/parse.js";
let pass = 0, fail = 0;
const t = (n, fn) => { try { fn(); console.log("ok  ", n); pass++; } catch (e) { console.log("FAIL", n, "—", e.message); fail++; } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m||"") + " " + JSON.stringify(a) + " !== " + JSON.stringify(b)); };

t("the brief's own example", () => {
  const r = P("met Jane, VP Eng at Acme, referred by Sam");
  eq(r.name, "Jane", "name");
  eq(r.company, "Acme", "company");
  eq(r.role, "VP Engineering", "role");
  eq(r.context, "Referred by Sam", "context");
  eq(r.referredBy, "Sam", "referrer");
});

t("name + role in one chunk", () => {
  const r = P("Jane Doe VP Engineering at Acme Corp");
  eq(r.name, "Jane Doe"); eq(r.role, "VP Engineering"); eq(r.company, "Acme Corp");
});

t("email and phone extraction", () => {
  const r = P("Tom Baker, partner at Baker Capital, tom@bakercap.com, (555) 123-4567");
  eq(r.name, "Tom Baker");
  eq(r.emails, ["tom@bakercap.com"]);
  eq(r.phones, ["(555) 123-4567"]);
  eq(r.company, "Baker Capital");
});

t("linkedin url", () => {
  const r = P("Ana Ruiz, designer, linkedin.com/in/anaruiz");
  eq(r.linkedin, "https://linkedin.com/in/anaruiz");
  eq(r.name, "Ana Ruiz");
});

t("location", () => {
  const r = P("spoke with Priya Sharma, eng manager at Anthropic in San Francisco");
  eq(r.name, "Priya Sharma"); eq(r.location, "San Francisco");
});

t("lowercase name gets title-cased", () => {
  eq(P("met chris palmer at the dog park").name, "Chris Palmer");
});

t("name inferred from email when absent", () => {
  const r = P("jane.doe@acme.com — great call");
  eq(r.name, "Jane Doe");
});

t("leftover prose becomes notes", () => {
  const r = P("Sam Torres, climbing partner, just adopted a dog named Biscuit");
  eq(r.name, "Sam Torres");
  if (!/Biscuit/.test(r.notes)) throw new Error("notes: " + r.notes);
});

t("returns null on unusable input", () => {
  eq(P(""), null); eq(P(null), null); eq(P("   "), null);
  eq(P("12345 !!!"), null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
