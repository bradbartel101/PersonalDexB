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
  { id: "note", label: "Note", icon: "note" },
];

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

export function lastContact(c) {
  let best = null;
  for (const it of c.interactions || []) if (!best || it.date > best) best = it.date;
  return best;
}
export function cadenceDays(c) {
  const cad = c.cadence || { id: "none" };
  if (cad.id === "none") return null;
  if (cad.id === "custom") return cad.days > 0 ? cad.days : null;
  const def = CADENCES.find((x) => x.id === cad.id);
  return def ? def.days : null;
}
export function cadenceLabel(c) {
  const cad = c.cadence || { id: "none" };
  if (cad.id === "custom" && cad.days > 0) return "every " + cad.days + "d";
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
  return { due, today };
}
