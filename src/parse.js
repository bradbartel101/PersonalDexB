/* Quick-capture: turn a pasted line of prose into a draft person record.
   Pure and local — no API needed. The AI path can refine this later, but the
   heuristics alone handle the shapes people actually type. */

const ROLE_WORDS = [
  "ceo", "cto", "coo", "cfo", "cmo", "vp", "svp", "evp", "avp", "head", "director",
  "manager", "lead", "principal", "staff", "senior", "junior", "founder", "cofounder",
  "co-founder", "partner", "associate", "analyst", "engineer", "designer", "developer",
  "scientist", "researcher", "recruiter", "consultant", "advisor", "president",
  "chief", "owner", "operator", "counsel", "attorney", "professor", "student",
  "intern", "architect", "producer", "marketer", "strategist", "pm",
];
const ROLE_RE = new RegExp("\\b(" + ROLE_WORDS.join("|") + ")\\b", "i");

const STOP_LEAD = /^(?:i\s+)?(?:just\s+)?(?:met|meet|talked\s+to|spoke\s+(?:to|with)|had\s+(?:coffee|lunch|a\s+call)\s+with|intro(?:duced)?\s+to|connected\s+with|ran\s+into|grabbed\s+coffee\s+with)\s+/i;

function titleCaseName(s) {
  return s.trim().split(/\s+/).map((w) =>
    /^[a-z]/.test(w) ? w[0].toUpperCase() + w.slice(1) : w).join(" ");
}

/* A plausible person name: 1-4 capitalized-ish words, no digits/@ */
function looksLikeName(s) {
  const t = s.trim();
  if (!t || t.length > 60) return false;
  if (/[@\d]/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length < 1 || words.length > 4) return false;
  return words.every((w) => /^[A-Za-zÀ-ÿ'’.-]+$/.test(w));
}

const STOPW = /^(at|the|in|from|of|and|a|an|for|to|on|with|via|by|who|works?)$/i;

/* Leading 1-3 word run that could be a name, tolerant of lowercase input. */
function leadName(str) {
  const take = [];
  for (const w of String(str).split(/\s+/)) {
    if (take.length >= 3) break;
    if (!/^[A-Za-zÀ-ÿ'’.-]+$/.test(w)) break;
    if (STOPW.test(w)) break;
    if (take.length && ROLE_RE.test(w)) break;
    take.push(w);
  }
  return take.length ? take.join(" ") : "";
}

export function parseQuickCapture(raw) {
  const text = String(raw || "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const out = {
    name: "", role: "", company: "", emails: [], phones: [],
    location: "", context: "", tags: [], linkedin: "", notes: "",
  };
  // Strip "met" / "spoke with" / "coffee with" up front, so the company and
  // location scanners never mistake the lead-in for content.
  let rest = text.replace(STOP_LEAD, "").trim();
  const startedWithEmail = /^[\w.+-]+@[\w-]+\.[\w.-]+/.test(rest);

  // Contact details next — they're unambiguous.
  const email = rest.match(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/);
  if (email) { out.emails = [email[0].toLowerCase()]; rest = rest.replace(email[0], " "); }

  const li = rest.match(/\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w%-]+/i);
  if (li) { out.linkedin = li[0].startsWith("http") ? li[0] : "https://" + li[0]; rest = rest.replace(li[0], " "); }

  const phone = rest.match(/(?:\+\d{1,2}[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/);
  if (phone) { out.phones = [phone[0].trim()]; rest = rest.replace(phone[0], " "); }

  // "referred by Sam" / "intro'd by Priya" -> context, and remember the referrer
  const ref = rest.match(/\b(?:referred|introduced|intro'?d|recommended|sent)\s+by\s+([^,.;]+)/i);
  if (ref) {
    out.context = "Referred by " + titleCaseName(ref[1].trim());
    out.referredBy = titleCaseName(ref[1].trim());
    rest = rest.replace(ref[0], " ");
  }

  // "at Acme" / "from Acme" -> company (stop at punctuation or a new clause)
  const at = rest.match(/\b(?:at|@|from)\s+((?:[A-Z][\w&'’.-]*)(?:\s+(?:[A-Z][\w&'’.-]*|of|and|the))*)/);
  if (at) { out.company = at[1].trim().replace(/[.,;]$/, ""); rest = rest.replace(at[0], " "); }

  // "in Denver" -> location
  const inLoc = rest.match(/\bin\s+([A-Z][\w'’.-]*(?:\s+[A-Z][\w'’.-]*){0,2})/);
  if (inLoc) { out.location = inLoc[1].trim().replace(/[.,;]$/, ""); rest = rest.replace(inLoc[0], " "); }

  // Split what's left; the first chunk usually holds "name, title"
  const chunks = rest.split(/[,;]|\s+[–—-]\s+/).map((c) => c.trim()).filter(Boolean);
  if (chunks.length) {
    let first = chunks[0].replace(STOP_LEAD, "").trim();
    // Name may be followed by a role in the same chunk ("Jane Doe VP Eng")
    const roleAt = first.search(ROLE_RE);
    if (roleAt > 0) {
      const maybeName = first.slice(0, roleAt).trim();
      if (looksLikeName(maybeName)) {
        out.name = titleCaseName(maybeName);
        out.role = first.slice(roleAt).trim();
      }
    }
    if (!out.name) {
      if (looksLikeName(first)) out.name = titleCaseName(first);
      else {
        // fall back to the leading capitalized run
        const lead = first.match(/^((?:[A-Z][\w'’.-]*)(?:\s+[A-Z][\w'’.-]*){0,3})/);
        if (lead && looksLikeName(lead[1])) { out.name = titleCaseName(lead[1]); first = first.slice(lead[1].length).trim(); }
        else {
          const low = leadName(first);
          if (low) { out.name = titleCaseName(low); first = first.slice(low.length).trim(); }
        }
      }
    }
    for (const ch of chunks.slice(out.role ? 1 : 0)) {
      if (!ch || ch === chunks[0]) continue;
      if (!out.role && ROLE_RE.test(ch) && ch.length < 60) { out.role = ch; continue; }
      if (ch.length > 3) out.notes = out.notes ? out.notes + ". " + ch : ch;
    }
    if (!out.role && chunks[1] && ROLE_RE.test(chunks[1])) out.role = chunks[1];
  }

  // Expand the most common title abbreviations for readability.
  out.role = out.role
    .replace(/\bvp\b/i, "VP").replace(/\beng\b/i, "Engineering")
    .replace(/\bops\b/i, "Operations").replace(/\bpm\b/i, "Product Manager")
    .replace(/\bbd\b/i, "Business Development")
    .replace(/^\s*[-–—]\s*/, "").trim();

  if ((!out.name || startedWithEmail) && out.emails.length) {
    const local = out.emails[0].split("@")[0].replace(/[._-]+/g, " ");
    if (looksLikeName(local)) {
      if (startedWithEmail && out.name) out.notes = out.notes ? out.name + ". " + out.notes : out.name;
      out.name = titleCaseName(local);
    }
  }
  if (!out.name) return null;

  if (!out.context && out.company) out.context = "Met — " + out.company;
  out.notes = out.notes.trim();
  return out;
}
