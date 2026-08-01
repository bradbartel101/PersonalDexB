// Pure date / cadence / due-ness logic shared by the client bundle and the
// serverless API (api/notify.js) so both compute "who is due" identically.

export const DAY = 86400000;

export const CADENCES = [
  { id: "none", label: "No cadence", days: null },
  { id: "weekly", label: "Weekly", days: 7 },
  { id: "monthly", label: "Monthly", days: 30 },
  { id: "quarterly", label: "Quarterly", days: 91 },
  { id: "yearly", label: "Yearly", days: 365 },
  { id: "custom", label: "Custom…", days: null },
];

export const ITYPES = [
  { id: "call", label: "Call", icon: "phone" },
  { id: "coffee", label: "Coffee", icon: "coffee" },
  { id: "message", label: "Message", icon: "message" },
  { id: "email", label: "Email", icon: "mail" },
  { id: "event", label: "Event", icon: "calendar" },
  { id: "note", label: "Note", icon: "note" },
];

/* Category colors index into the avatar palette tokens, so every colour
   already has a tuned light and dark variant. */
export const GROUP_COLORS = [
  "Sage", "Violet", "Amber", "Steel", "Rose", "Olive", "Plum", "Indigo",
];

export const DEFAULT_GROUPS = [
  { name: "Family", color: 4 },
  { name: "Close Friends", color: 0 },
  { name: "Work", color: 3 },
  { name: "Recruiting", color: 5 },
  { name: "Investors", color: 2 },
  { name: "Clients", color: 6 },
];

/* Editable keyword rules that suggest a category from company / title. */
export const DEFAULT_RULES = [
  { id: "r-investors", keywords: "ventures, capital, partners, vc, fund", field: "company", group: "Investors", tag: "" },
  { id: "r-recruiting", keywords: "recruiter, recruiting, talent, sourcer", field: "title", group: "Recruiting", tag: "" },
  { id: "r-work", keywords: "engineer, designer, product manager, founder, cto, ceo", field: "title", group: "Work", tag: "" },
  { id: "r-clients", keywords: "consulting, agency, studio", field: "company", group: "Clients", tag: "" },
];

export function ruleMatches(rule, contact) {
  if (!rule || rule.enabled === false) return false;
  const words = String(rule.keywords || "")
    .split(",").map((w) => w.trim().toLowerCase()).filter(Boolean);
  if (!words.length) return false;
  const company = String(contact.company || "").toLowerCase();
  const title = String(contact.role || "").toLowerCase();
  const hay = rule.field === "company" ? company
    : rule.field === "title" ? title
      : company + " " + title;
  if (!hay.trim()) return false;
  return words.some((w) => hay.includes(w));
}

/* Categories + tags a rule set would assign to a contact. */
export function suggestFromRules(contact, rules) {
  const groups = [], tags = [];
  for (const r of rules || []) {
    if (!ruleMatches(r, contact)) continue;
    if (r.group && !groups.includes(r.group)) groups.push(r.group);
    if (r.tag && !tags.includes(r.tag)) tags.push(r.tag);
  }
  return { groups, tags };
}

export function todayMid() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
export function pad(n) { return String(n).padStart(2, "0"); }
export function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
export function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
export function shiftDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
export function daysFromToday(s) {
  const d = parseDate(s);
  return d ? Math.round((d - todayMid()) / DAY) : null;
}
export function fmtShort(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}
export function fmtLong(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}
export function ago(n) {
  if (n == null) return "never";
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return n + " days ago";
  if (n < 60) { const w = Math.round(n / 7); return w + (w === 1 ? " week" : " weeks") + " ago"; }
  if (n < 365) { const m = Math.round(n / 30); return m + (m === 1 ? " month" : " months") + " ago"; }
  const y = Math.floor(n / 365);
  return y + (y === 1 ? " year" : " years") + " ago";
}
export function inDays(n) {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return "in " + n + " days";
}

export function parseBirthday(s) {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return { y: null, mo: +m[1], d: +m[2] };
  return null;
}
export function nextBirthday(s) {
  const b = parseBirthday(s);
  if (!b || b.mo < 1 || b.mo > 12 || b.d < 1 || b.d > 31) return null;
  const t = todayMid();
  let d = new Date(t.getFullYear(), b.mo - 1, b.d);
  if (d < t) d = new Date(t.getFullYear() + 1, b.mo - 1, b.d);
  return { date: d, turns: b.y ? d.getFullYear() - b.y : null };
}

/* Newest of: logged interactions, or a manually set "last contacted" date
   (which a fresh CSV import can carry before any interaction exists). */
export function lastContact(c) {
  let best = null;
  for (const it of c.interactions || []) if (!best || it.date > best) best = it.date;
  if (c.lastContactedAt && (!best || c.lastContactedAt > best)) best = c.lastContactedAt;
  return best;
}

export const UNIT_DAYS = { days: 1, weeks: 7, months: 30 };
export function customDays(cad) {
  if (!cad) return null;
  if (cad.n > 0 && cad.unit && UNIT_DAYS[cad.unit]) return cad.n * UNIT_DAYS[cad.unit];
  return cad.days > 0 ? cad.days : null; // pre-unit records
}
export function cadenceDays(c) {
  const cad = c.cadence || { id: "none" };
  if (cad.id === "none") return null;
  if (cad.id === "custom") return customDays(cad);
  const def = CADENCES.find((x) => x.id === cad.id);
  return def ? def.days : null;
}
export function cadenceLabel(c) {
  const cad = c.cadence || { id: "none" };
  if (cad.id === "custom") {
    const d = customDays(cad);
    if (!d) return "";
    if (cad.n > 0 && cad.unit) return "every " + cad.n + " " + (cad.n === 1 ? cad.unit.replace(/s$/, "") : cad.unit);
    return "every " + d + "d";
  }
  const def = CADENCES.find((x) => x.id === cad.id);
  return def && def.days ? def.label.toLowerCase() : "";
}
export function dueInfo(c) {
  const last = lastContact(c);
  const days = cadenceDays(c);
  if (!days) return { status: "none", last };
  const anchorStr = last || (c.createdAt || "").slice(0, 10) || iso(todayMid());
  const anchor = parseDate(anchorStr) || todayMid();
  let due = shiftDays(anchor, days);
  const sn = parseDate(c.snoozedUntil);
  if (sn && sn > due) due = sn;
  const overdueDays = Math.round((todayMid() - due) / DAY);
  const status = overdueDays >= 0 ? "overdue" : overdueDays >= -7 ? "soon" : "ok";
  return { status, last, due: iso(due), overdueDays };
}

/* median days between interactions */
export function typicalGap(c) {
  const ds = (c.interactions || []).map((i) => i.date).sort();
  if (ds.length < 2) return null;
  const gaps = [];
  for (let i = 1; i < ds.length; i++) {
    const a = parseDate(ds[i - 1]), b = parseDate(ds[i]);
    if (a && b) gaps.push(Math.round((b - a) / DAY));
  }
  if (!gaps.length) return null;
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

/* Suggest a cadence for contacts you already talk to rhythmically but never
   set one for: 3+ interactions, median gap ≤ 60 days → the standard cadence
   nearest on a log scale (so a 12-day rhythm maps to weekly, not monthly). */
export function suggestCadence(c) {
  if ((c.cadence || { id: "none" }).id !== "none" || c.noSuggest || c.archived) return null;
  if ((c.interactions || []).length < 3) return null;
  const gap = typicalGap(c);
  if (!gap || gap > 60) return null;
  const candidates = [
    { id: "weekly", days: 7 }, { id: "monthly", days: 30 },
    { id: "quarterly", days: 91 }, { id: "yearly", days: 365 },
  ];
  let best = candidates[0];
  for (const cand of candidates) {
    if (Math.abs(Math.log(gap / cand.days)) < Math.abs(Math.log(gap / best.days))) best = cand;
  }
  return { id: best.id, gap, label: CADENCES.find((x) => x.id === best.id).label };
}

/* Categories are stored as {name, color}; older data used bare strings. */
export function groupName(g) { return typeof g === "string" ? g : (g && g.name) || ""; }
export function normalizeGroups(list) {
  const out = [], seen = new Set();
  for (const g of Array.isArray(list) ? list : []) {
    const name = groupName(g).trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    const color = typeof g === "object" && Number.isInteger(g.color) ? g.color : out.length % 8;
    out.push({ name, color: ((color % 8) + 8) % 8 });
  }
  return out;
}
export function colorOf(groups, name) {
  const g = (groups || []).find((x) => groupName(x) === name);
  return g && Number.isInteger(g.color) ? g.color : 0;
}

export function findDuplicates(contacts) {
  const byKey = {};
  for (const c of contacts) {
    const keys = [];
    const n = (c.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (n) keys.push("n:" + n);
    const e = (c.email || "").trim().toLowerCase();
    if (e) keys.push("e:" + e);
    for (const k of keys) (byKey[k] = byKey[k] || new Set()).add(c.id);
  }
  const groups = [], seen = new Set();
  for (const ids of Object.values(byKey)) {
    if (ids.size < 2) continue;
    const key = [...ids].sort().join("|");
    if (!seen.has(key)) { seen.add(key); groups.push([...ids]); }
  }
  return groups;
}

/* Applies the JSON filter the model returns for a natural-language query.
   Pure and defensive: unknown keys are ignored, and a filter that matches
   nothing returns an empty list rather than throwing. */
export function applyAiFilter(contacts, filter) {
  const f = filter && typeof filter === "object" ? filter : {};
  const lower = (v) => String(v || "").toLowerCase();
  const wanted = (arr) => (Array.isArray(arr) ? arr.map(lower).filter(Boolean) : []);
  const cats = wanted(f.categories);
  const tags = wanted(f.tags);
  const text = lower(f.text).trim();

  let out = (contacts || []).filter((c) => {
    if (c.archived && !f.includeArchived) return false;
    if (cats.length && !(c.groups || []).some((g) => cats.includes(lower(g)))) return false;
    if (tags.length && !(c.tags || []).some((t) => tags.includes(lower(t)))) return false;
    if (f.uncategorized && (c.groups || []).length > 0) return false;
    if (Number.isFinite(+f.minStrength) && (c.strength || 0) < +f.minStrength) return false;
    if (f.overdue && dueInfo(c).status !== "overdue") return false;

    const last = lastContact(c);
    if (f.notContactedSince) {
      // "haven't talked to since X": no contact at all, or nothing since X.
      if (last && last >= String(f.notContactedSince)) return false;
    }
    if (f.contactedSince) {
      if (!last || last < String(f.contactedSince)) return false;
    }
    if (text) {
      const hay = [c.name, c.company, c.role, c.context, c.notes, c.location,
        (c.tags || []).join(" "), (c.groups || []).join(" "), (c.facts || []).join(" ")]
        .join(" ").toLowerCase();
      if (!hay.includes(text)) return false;
    }
    return true;
  });

  const sort = f.sort;
  if (sort === "overdue") out.sort((a, b) => (dueInfo(b).overdueDays ?? -99999) - (dueInfo(a).overdueDays ?? -99999));
  else if (sort === "recent") out.sort((a, b) => (lastContact(b) || "").localeCompare(lastContact(a) || ""));
  else if (sort === "strength") out.sort((a, b) => (b.strength || 0) - (a.strength || 0));
  else out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
  return out;
}

/* Everything the daily digest needs, computed from a raw doc. */
export function digestFor(doc) {
  const contacts = (doc && doc.contacts ? doc.contacts : []).filter((c) => c && !c.archived);
  const due = contacts
    .map((c) => ({ c, info: dueInfo(c) }))
    .filter((x) => x.info.status === "overdue")
    .sort((a, b) => b.info.overdueDays - a.info.overdueDays);
  const today = [];
  for (const c of contacts) {
    const nb = nextBirthday(c.birthday);
    if (nb && Math.round((nb.date - todayMid()) / DAY) === 0)
      today.push(c.name + (nb.turns ? " turns " + nb.turns : "'s birthday") + " today");
    for (const r of c.reminders || []) {
      const n = daysFromToday(r.date);
      if (n != null && n <= 0) today.push(r.text + " (" + c.name + ")");
    }
    for (const dt of c.dates || []) {
      const occ = nextBirthday(dt.date);
      if (occ && Math.round((occ.date - todayMid()) / DAY) === 0) today.push(dt.label + " — " + c.name);
    }
  }
  const meetings = [];
  for (const c of contacts)
    for (const it of c.interactions || [])
      if (it.type === "event" && it.date === iso(todayMid()))
        meetings.push(c.name + (it.text ? " — " + it.text : ""));
  return { due, today, meetings };
}
