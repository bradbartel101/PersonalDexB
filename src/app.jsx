import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";

/* ============================== constants ============================== */

const KEY = "hearth-crm-v1";
const DAY = 86400000;

const CADENCES = [
  { id: "none", label: "No cadence", days: null },
  { id: "weekly", label: "Weekly", days: 7 },
  { id: "monthly", label: "Monthly", days: 30 },
  { id: "quarterly", label: "Quarterly", days: 91 },
  { id: "yearly", label: "Yearly", days: 365 },
  { id: "custom", label: "Custom…", days: null },
];

const ITYPES = [
  { id: "call", label: "Call", icon: "phone" },
  { id: "coffee", label: "Coffee", icon: "coffee" },
  { id: "message", label: "Message", icon: "message" },
  { id: "email", label: "Email", icon: "mail" },
  { id: "note", label: "Note", icon: "note" },
];

const FIELD_PRESETS = ["LinkedIn", "X / Twitter", "Instagram", "GitHub", "Website", "Partner", "Kids", "Address"];

/* ============================== icons ============================== */

const PATHS = {
  search: <><circle cx="11" cy="11" r="7" /><path d="M16.8 16.8 21 21" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="M5 12.5 10 17.5 19 7" />,
  chevronLeft: <path d="M15 5l-7 7 7 7" />,
  list: <path d="M8.5 6h12M8.5 12h12M8.5 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  grid: <><rect x="3.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="3.5" width="7" height="7" rx="1.5" /><rect x="3.5" y="13.5" width="7" height="7" rx="1.5" /><rect x="13.5" y="13.5" width="7" height="7" rx="1.5" /></>,
  phone: <path d="M5 4h3.5l1.8 4.5-2.2 1.7a12.5 12.5 0 0 0 5.7 5.7l1.7-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.8 20 4 13.2 3.5 5.6A1.5 1.5 0 0 1 5 4z" />,
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7.5 8.5 6 8.5-6" /></>,
  message: <path d="M21 11.5a7.5 7.5 0 0 1-7.5 7.5H5.5L3 21.5V11.5A7.5 7.5 0 0 1 10.5 4h3A7.5 7.5 0 0 1 21 11.5z" />,
  coffee: <><path d="M5 9h11v4.5a5 5 0 0 1-5 5H10a5 5 0 0 1-5-5V9z" /><path d="M16 10h1.3a2.3 2.3 0 0 1 0 4.6H16M8 3.5v2M12 3.5v2" /></>,
  note: <path d="M12 20h9M16.6 3.6a2.2 2.2 0 0 1 3 3L7.5 18.7 3.5 20l1.3-4L16.6 3.6z" />,
  cake: <><path d="M4.5 20.5h15M5.5 13.5h13v7h-13zM5.5 16.5c1.5 1.4 2.8-1.3 4.3 0s2.9-1.3 4.4 0 2.8-1.3 4.3 0M12 9.5v4M12 9.5a2 2 0 0 1-2-2c0-1.2 2-3.5 2-3.5s2 2.3 2 3.5a2 2 0 0 1-2 2z" /></>,
  bell: <path d="M18 9a6 6 0 1 0-12 0c0 6.5-2.5 6.5-2.5 8.5h17C20.5 15.5 18 15.5 18 9zM10.3 20.7a2 2 0 0 0 3.4 0" />,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></>,
  download: <path d="M12 4v11m0 0-4.5-4.5M12 15l4.5-4.5M4.5 20h15" />,
  upload: <path d="M12 15V4m0 0L7.5 8.5M12 4l4.5 4.5M4.5 20h15" />,
  trash: <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />,
  users: <><circle cx="9" cy="8.5" r="3.5" /><path d="M3.5 20c.5-4 2.7-6 5.5-6s5 2 5.5 6M16 5.4a3.5 3.5 0 0 1 0 6.2M17.7 14.6c1.8 1 2.7 3 2.9 5.4" /></>,
  today: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4M8 14h4" /></>,
  broom: <path d="M14 3 9.5 7.5m0 0 7 7M9.5 7.5c-4 4-6.5 5-6.5 5l8 8s1-2.5 5-6.5M6 15.5 4 21m4.5-3L7 21.5m4.5-3.5-1 3.5" />,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5z" />,
  archive: <><rect x="3" y="4" width="18" height="4.5" rx="1" /><path d="M5 8.5V19a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8.5M10 12.5h4" /></>,
  history: <path d="M3.5 12a8.5 8.5 0 1 0 2.5-6L3.5 8.5m0-4.5v4.5H8M12 8v4.5l3 2" />,
  merge: <path d="M7 4h4v4H7zM13 16h4v4h-4zM9 8v4a4 4 0 0 0 4 4M9 12h.01" />,
  calendar: <><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9.5h17M8 3v4M16 3v4" /></>,
};

function Icon({ n, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {PATHS[n]}
    </svg>
  );
}

function Mark({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" aria-hidden="true">
      <circle cx="9.5" cy="12" r="6" />
      <circle cx="15.5" cy="12" r="6" opacity="0.45" />
    </svg>
  );
}

/* ============================== dates ============================== */

function todayMid() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function pad(n) { return String(n).padStart(2, "0"); }
function iso(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function parseDate(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!m) return null;
  return new Date(+m[1], +m[2] - 1, +m[3]);
}
function shiftDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function daysFromToday(s) {
  const d = parseDate(s);
  return d ? Math.round((d - todayMid()) / DAY) : null;
}
function fmtShort(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
}
function fmtLong(s) {
  const d = parseDate(s);
  return d ? d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "";
}
function ago(n) {
  if (n == null) return "never";
  if (n <= 0) return "today";
  if (n === 1) return "yesterday";
  if (n < 14) return n + " days ago";
  if (n < 60) { const w = Math.round(n / 7); return w + (w === 1 ? " week" : " weeks") + " ago"; }
  if (n < 365) { const m = Math.round(n / 30); return m + (m === 1 ? " month" : " months") + " ago"; }
  const y = Math.floor(n / 365);
  return y + (y === 1 ? " year" : " years") + " ago";
}
function inDays(n) {
  if (n === 0) return "today";
  if (n === 1) return "tomorrow";
  return "in " + n + " days";
}

function parseBirthday(s) {
  if (!s) return null;
  const t = String(s).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return { y: +m[1], mo: +m[2], d: +m[3] };
  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})$/);
  if (m) return { y: null, mo: +m[1], d: +m[2] };
  return null;
}
function nextBirthday(s) {
  const b = parseBirthday(s);
  if (!b || b.mo < 1 || b.mo > 12 || b.d < 1 || b.d > 31) return null;
  const t = todayMid();
  let d = new Date(t.getFullYear(), b.mo - 1, b.d);
  if (d < t) d = new Date(t.getFullYear() + 1, b.mo - 1, b.d);
  return { date: d, turns: b.y ? d.getFullYear() - b.y : null };
}

/* ============================== due logic ============================== */

function lastContact(c) {
  let best = null;
  for (const it of c.interactions || []) if (!best || it.date > best) best = it.date;
  return best;
}
function cadenceDays(c) {
  const cad = c.cadence || { id: "none" };
  if (cad.id === "none") return null;
  if (cad.id === "custom") return cad.days > 0 ? cad.days : null;
  const def = CADENCES.find((x) => x.id === cad.id);
  return def ? def.days : null;
}
function cadenceLabel(c) {
  const cad = c.cadence || { id: "none" };
  if (cad.id === "custom" && cad.days > 0) return "every " + cad.days + "d";
  const def = CADENCES.find((x) => x.id === cad.id);
  return def && def.days ? def.label.toLowerCase() : "";
}
function dueInfo(c) {
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
function duePill(info) {
  if (info.status === "none") return null;
  if (info.status === "overdue")
    return { cls: "overdue", text: info.overdueDays === 0 ? "Due today" : info.overdueDays + "d overdue" };
  if (info.status === "soon") return { cls: "soon", text: "Due " + inDays(-info.overdueDays) };
  return { cls: "ok", text: "Due " + fmtShort(info.due) };
}

/* ============================== storage ============================== */

const mem = {};
let storageMode = "memory";

async function detectAndLoad() {
  if (!__STANDALONE__) {
    try {
      const s = window.storage;
      if (s && typeof s.getItem === "function" && typeof s.setItem === "function") {
        const v = await s.getItem(KEY);
        storageMode = "artifact";
        if (v == null) return null;
        return typeof v === "string" ? v : v.value != null ? v.value : null;
      }
    } catch (e) { /* fall through */ }
  }
  try {
    localStorage.setItem(KEY + ":probe", "1");
    localStorage.removeItem(KEY + ":probe");
    storageMode = "local";
    return localStorage.getItem(KEY);
  } catch (e) { /* fall through */ }
  storageMode = "memory";
  return mem[KEY] || null;
}

async function persist(str) {
  if (!__STANDALONE__ && storageMode === "artifact") {
    try { await window.storage.setItem(KEY, str); return; } catch (e) { /* degrade */ }
  }
  if (storageMode !== "memory") {
    try { localStorage.setItem(KEY, str); return; } catch (e) { /* degrade */ }
  }
  mem[KEY] = str;
}

/* ============================== sample data ============================== */

let uidCounter = 0;
function uid() { return Date.now().toString(36) + "-" + (uidCounter++).toString(36) + Math.random().toString(36).slice(2, 6); }

function seedData() {
  const t = todayMid();
  const d = (n) => iso(shiftDays(t, -n));
  const f = (n) => iso(shiftDays(t, n));
  const bday = (inN, age) => {
    const b = shiftDays(t, inN);
    return (b.getFullYear() - age) + "-" + pad(b.getMonth() + 1) + "-" + pad(b.getDate());
  };
  const C = (o) => ({
    id: uid(), name: "", context: "", email: "", phone: "", company: "", role: "",
    location: "", birthday: "", photo: null, notes: "", tags: [], groups: [],
    custom: [], reminders: [], dates: [], interactions: [], cadence: { id: "none", days: null },
    snoozedUntil: null, starred: false, archived: false, createdAt: d(400), sample: true, ...o,
  });
  return {
    v: 1,
    groups: ["Family", "Close Friends", "Work", "Investors"],
    prefs: { view: "list" },
    contacts: [
      C({
        name: "Maya Chen", context: "College roommate at Berkeley",
        email: "maya@hey.com", company: "Figma", role: "Product Designer", location: "San Francisco",
        birthday: bday(12, 31), tags: ["berkeley", "design", "hiking"], groups: ["Close Friends"],
        cadence: { id: "monthly" }, starred: true,
        custom: [{ id: uid(), label: "Instagram", value: "@mayadraws" }],
        notes: "Thinking about leaving Figma to freelance. Loves Sightglass. Training for a half marathon in October.",
        interactions: [
          { id: uid(), type: "coffee", date: d(47), text: "Sightglass — she's serious about going freelance. I promised to send her my contract template." },
          { id: uid(), type: "message", date: d(90), text: "Traded hiking photos from Point Reyes." },
        ],
      }),
      C({
        name: "Grandma June", context: "Mom's side — calls every Sunday if I don't first",
        phone: "(555) 201-4477", location: "Tucson, AZ", birthday: bday(25, 84),
        tags: ["family"], groups: ["Family"], cadence: { id: "weekly" }, starred: true,
        notes: "New hip doing great. Ask about the garden — the tomatoes are her pride this year.",
        interactions: [
          { id: uid(), type: "call", date: d(5), text: "Long call about the garden and cousin Pete's wedding plans." },
          { id: uid(), type: "call", date: d(13), text: "Quick check-in." },
        ],
      }),
      C({
        name: "Sam Torres", context: "Climbing gym → real friendship",
        phone: "(555) 887-2210", location: "Oakland", tags: ["climbing", "music"],
        groups: ["Close Friends"], cadence: { id: "weekly" },
        notes: "Just got a rescue dog named Biscuit. Wants to plan a Bishop trip this fall.",
        interactions: [
          { id: uid(), type: "message", date: d(10), text: "Sent him the Bishop campsite link." },
          { id: uid(), type: "coffee", date: d(24), text: "Post-climb burritos. His startup got acquired — mixed feelings about it." },
        ],
      }),
      C({
        name: "James Okafor", context: "Intro'd by Priya at Founders Brunch '24",
        email: "james@meridianvc.com", company: "Meridian Ventures", role: "Partner",
        location: "New York", tags: ["fintech", "angel"], groups: ["Investors"],
        cadence: { id: "quarterly" },
        custom: [{ id: uid(), label: "LinkedIn", value: "in/jokafor" }],
        reminders: [{ id: uid(), date: f(15), text: "Send the Q3 update deck" }],
        notes: "Writes $50–250k checks. Genuinely helpful with hiring intros. Two kids, big Arsenal fan.",
        interactions: [
          { id: uid(), type: "email", date: d(104), text: "Sent Q2 update; he replied with two candidate intros." },
          { id: uid(), type: "call", date: d(160), text: "30 min — walked him through the roadmap." },
        ],
      }),
      C({
        name: "Priya Sharma", context: "Former teammate at Stripe, my first mentor",
        email: "priya.sh@gmail.com", company: "Anthropic", role: "Eng Manager", location: "San Francisco",
        tags: ["stripe", "mentor"], groups: ["Work"], cadence: { id: "quarterly" },
        dates: [{ id: uid(), label: "Stripe reunion dinner", date: bday(20, 5) }],
        notes: "Best career advice I've ever gotten. Owes me a book rec; I owe her dinner.",
        interactions: [
          { id: uid(), type: "coffee", date: d(30), text: "Blue Bottle — talked through the co-founder question. 'Hire for what you're bad at.'" },
        ],
      }),
      C({
        name: "Alex Kim", context: "Met at the AI meetup demo night",
        email: "alex@lumenlabs.io", company: "Lumen Labs", role: "Founder", location: "Berkeley",
        tags: ["ai", "founder"], groups: ["Work"], cadence: { id: "monthly" },
        reminders: [{ id: uid(), date: f(6), text: "Ask how the launch went" }],
        interactions: [
          { id: uid(), type: "message", date: d(20), text: "They're launching in three weeks — nervous but excited." },
        ],
      }),
      C({
        name: "Dana Whitfield", context: "Angel from the first round, met via YC forum",
        email: "dana@whitfield.capital", company: "Whitfield Capital", location: "Austin",
        tags: ["angel"], groups: ["Investors"], cadence: { id: "yearly" },
        notes: "Prefers email. Hands-off but opens every update.",
        interactions: [
          { id: uid(), type: "email", date: d(400), text: "Annual update — she replied 'keep going.'" },
        ],
      }),
      C({
        name: "Noor Haddad", context: "Neighbors in the old building on Grand Ave",
        phone: "(555) 341-9902", location: "Oakland", birthday: bday(3, 29),
        tags: ["neighbor", "food"], groups: ["Close Friends"], cadence: { id: "monthly" },
        notes: "Started a supper club — wants help with the website. Incredible cook.",
        interactions: [
          { id: uid(), type: "message", date: d(28), text: "Confirmed I'm in for the next supper club." },
        ],
      }),
      C({
        name: "Chris Palmer", context: "Dog park regular, has the corgi",
        tags: ["neighbor"], groups: [],
        interactions: [],
      }),
    ],
  };
}

function blankContact(name) {
  return {
    id: uid(), name: name.trim(), context: "", email: "", phone: "", company: "",
    role: "", location: "", birthday: "", photo: null, notes: "", tags: [], groups: [],
    custom: [], reminders: [], dates: [], interactions: [], cadence: { id: "none", days: null },
    snoozedUntil: null, starred: false, archived: false, createdAt: iso(todayMid()), sample: false,
  };
}

/* median days between interactions, for the relationship insight line */
function typicalGap(c) {
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

function findDuplicates(contacts) {
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

/* ============================== small components ============================== */

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h) % 8;
}
function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}
function Avatar({ c, size = 40 }) {
  return (
    <div className={"avatar av-" + hashName(c.name || "?")}
      style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {c.photo ? <img src={c.photo} alt="" /> : initials(c.name || "?")}
    </div>
  );
}

function Toast({ toast }) {
  if (!toast) return null;
  return <div className="toast" role="status">{toast.msg}</div>;
}

function ConfirmButton({ label, confirmLabel, onConfirm, className }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2500);
    return () => clearTimeout(t);
  }, [armed]);
  return (
    <button className={className} onClick={() => (armed ? onConfirm() : setArmed(true))}>
      {armed ? confirmLabel : label}
    </button>
  );
}

function TypeChips({ value, onChange }) {
  return (
    <div className="type-chips">
      {ITYPES.map((t) => (
        <button key={t.id} type="button" className={"type-chip" + (value === t.id ? " on" : "")}
          onClick={() => onChange(t.id)}>
          <Icon n={t.icon} size={14} />{t.label}
        </button>
      ))}
    </div>
  );
}

function QuickLog({ onSave, onCancel, autoFocus = true }) {
  const [type, setType] = useState("message");
  const [text, setText] = useState("");
  const [date, setDate] = useState(iso(todayMid()));
  const ref = useRef(null);
  useEffect(() => { if (autoFocus && ref.current) ref.current.focus(); }, [autoFocus]);
  const save = (e) => { e.preventDefault(); onSave({ type, text: text.trim(), date }); };
  return (
    <form className="quicklog" onSubmit={save}>
      <TypeChips value={type} onChange={setType} />
      <div className="quicklog-row">
        <input ref={ref} type="text" value={text} placeholder="What happened? (optional)"
          onChange={(e) => setText(e.target.value)} />
        <input type="date" value={date} max={iso(todayMid())} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="quicklog-row">
        <button type="submit" className="btn primary sm">Log it</button>
        <button type="button" className="btn ghost sm" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

function ChipInput({ onAdd, placeholder }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);
  if (!open) {
    return <button type="button" className="chip-add" onClick={() => setOpen(true)}>+ {placeholder}</button>;
  }
  const commit = () => {
    const v = val.trim();
    if (v) onAdd(v);
    setVal(""); setOpen(false);
  };
  return (
    <input ref={ref} className="chip-input" value={val} placeholder={placeholder}
      onChange={(e) => setVal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); commit(); }
        if (e.key === "Escape") { setVal(""); setOpen(false); }
      }} />
  );
}

/* ============================== today view ============================== */

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function TodayView({ contacts, openProfile, logInteraction, snooze, completeReminder }) {
  const [logging, setLogging] = useState(null);
  const today = todayMid();

  const due = useMemo(() => {
    return contacts
      .map((c) => ({ c, info: dueInfo(c) }))
      .filter((x) => x.info.status === "overdue")
      .sort((a, b) => b.info.overdueDays - a.info.overdueDays);
  }, [contacts]);

  const upcoming = useMemo(() => {
    const items = [];
    for (const c of contacts) {
      const nb = nextBirthday(c.birthday);
      if (nb) {
        const n = Math.round((nb.date - today) / DAY);
        if (n >= 0 && n <= 30) {
          items.push({
            kind: "birthday", c, when: n, date: iso(nb.date),
            title: c.name + (nb.turns ? " turns " + nb.turns : "'s birthday"),
          });
        }
      }
      for (const r of c.reminders || []) {
        const n = daysFromToday(r.date);
        if (n != null && n <= 30) items.push({ kind: "reminder", c, r, when: n, date: r.date, title: r.text });
      }
      for (const dt of c.dates || []) {
        const occ = nextBirthday(dt.date);
        if (!occ) continue;
        const n = Math.round((occ.date - today) / DAY);
        if (n >= 0 && n <= 30)
          items.push({ kind: "date", c, when: n, date: iso(occ.date), title: dt.label + " · " + c.name });
      }
    }
    return items.sort((a, b) => a.when - b.when);
  }, [contacts, today]);

  const dateStr = today.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="page">
      <header className="page-head">
        <div className="page-date">{dateStr}</div>
        <h1 className="page-title display">{greeting()}.</h1>
        <p className="page-sub">
          {due.length === 0
            ? "You're caught up with everyone. Rare and beautiful."
            : due.length === 1
              ? "One person to reach out to."
              : due.length + " people to reach out to."}
        </p>
      </header>

      <section className="section" style={{ marginTop: 0 }}>
        <div className="section-head">
          <h2 className="section-title">Reach out</h2>
          {due.length > 0 && <span className="section-count">{due.length}</span>}
        </div>
        <div className="card row-list">
          {due.length === 0 && (
            <div className="empty">
              <Icon n="check" size={28} />
              <div className="display">All caught up</div>
              <p>When someone drifts past their cadence, they'll appear here.</p>
            </div>
          )}
          {due.map(({ c, info }) => (
            <div key={c.id} className="person-row">
              <div className="person-row-main">
                <Avatar c={c} size={42} />
                <div className="person-row-info">
                  <button className="person-name" onClick={() => openProfile(c.id)}>{c.name}</button>
                  <div className="person-meta">
                    Last touch {ago(info.last ? -daysFromToday(info.last) : null)} · {cadenceLabel(c)}
                    {c.context ? " · " + c.context : ""}
                  </div>
                </div>
                <div className="person-side">
                  <span className="pill overdue">{info.overdueDays === 0 ? "due today" : info.overdueDays + "d over"}</span>
                  <button className="btn sm" onClick={() => setLogging(logging === c.id ? null : c.id)}>
                    <Icon n="note" size={14} /><span className="lbl">Log</span>
                  </button>
                  <button className="icon-btn" title="Snooze 7 days" onClick={() => snooze(c.id, 7)}>
                    <Icon n="clock" size={16} />
                  </button>
                </div>
              </div>
              {logging === c.id && (
                <QuickLog
                  onSave={(entry) => { logInteraction(c.id, entry); setLogging(null); }}
                  onCancel={() => setLogging(null)} />
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Next 30 days</h2>
          {upcoming.length > 0 && <span className="section-count">{upcoming.length}</span>}
        </div>
        <div className="card row-list">
          {upcoming.length === 0 && (
            <div className="empty">
              <Icon n="cake" size={28} />
              <div className="display">Nothing on the horizon</div>
              <p>Birthdays and reminders within 30 days show up here.</p>
            </div>
          )}
          {upcoming.map((u, i) => (
            <div key={i} className="up-row">
              <div className={"up-icon" + (u.kind === "reminder" ? " bell" : "")}>
                <Icon n={u.kind === "birthday" ? "cake" : u.kind === "date" ? "calendar" : "bell"} size={17} />
              </div>
              <div className="up-body">
                <div className="up-title">
                  {u.kind === "reminder"
                    ? <>{u.title} <span style={{ fontWeight: 400, color: "var(--muted)" }}>· </span>
                      <button onClick={() => openProfile(u.c.id)} style={{ color: "var(--muted)", fontWeight: 500 }}>{u.c.name}</button></>
                    : <button onClick={() => openProfile(u.c.id)}>{u.title}</button>}
                </div>
                <div className="up-sub">{fmtShort(u.date)}{u.when < 0 ? " · " + (-u.when) + "d ago" : ""}</div>
              </div>
              <span className="up-when">{u.when < 0 ? "overdue" : inDays(u.when)}</span>
              {u.kind === "reminder" && (
                <button className="icon-btn" title="Mark done" onClick={() => completeReminder(u.c.id, u.r.id)}>
                  <Icon n="check" size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/* ============================== people view ============================== */

function PeopleView({ contacts, groups, prefs, setPrefs, openProfile, addContact, focusSignal, toggleStar, bulkApply }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [show, setShow] = useState("active");
  const [sort, setSort] = useState("name");
  const [newName, setNewName] = useState("");
  const [bulk, setBulk] = useState(false);
  const [sel, setSel] = useState(() => new Set());
  const [bulkTag, setBulkTag] = useState("");
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkCadence, setBulkCadence] = useState("");
  const searchRef = useRef(null);
  const addRef = useRef(null);

  const toggleSel = (id) => setSel((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const exitBulk = () => { setBulk(false); setSel(new Set()); };

  useEffect(() => {
    if (!focusSignal) return;
    const el = focusSignal.target === "search" ? searchRef.current : addRef.current;
    if (el) el.focus();
  }, [focusSignal]);

  const allTags = useMemo(() => {
    const s = new Set();
    contacts.forEach((c) => (c.tags || []).forEach((t) => s.add(t)));
    return [...s].sort();
  }, [contacts]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = contacts
      .map((c) => ({ c, info: dueInfo(c) }))
      .filter(({ c, info }) => {
        if (show === "active" && c.archived) return false;
        if (show === "starred" && (!c.starred || c.archived)) return false;
        if (show === "archived" && !c.archived) return false;
        if (group && !(c.groups || []).includes(group)) return false;
        if (tag && !(c.tags || []).includes(tag)) return false;
        if (status && info.status !== status) return false;
        if (needle) {
          const hay = [c.name, c.company, c.role, c.context, c.email, c.location, c.notes,
            (c.tags || []).join(" "), (c.groups || []).join(" "),
            (c.custom || []).map((f) => f.label + " " + f.value).join(" ")].join(" ").toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
    if (sort === "recent") list.sort((a, b) => (b.info.last || "").localeCompare(a.info.last || ""));
    else if (sort === "overdue") list.sort((a, b) =>
      (b.info.overdueDays ?? -99999) - (a.info.overdueDays ?? -99999));
    else list.sort((a, b) => a.c.name.localeCompare(b.c.name));
    return list;
  }, [contacts, q, group, tag, status, show, sort]);

  const submitNew = (e) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    addContact(name);
    setNewName("");
  };

  const grid = prefs.view === "grid";

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title display">People</h1>
        <p className="page-sub">
          {(() => {
            const active = contacts.filter((c) => !c.archived).length;
            const arch = contacts.length - active;
            return active + (active === 1 ? " person" : " people") + " in your circle" + (arch ? " · " + arch + " archived" : "");
          })()}
        </p>
      </header>

      <div className="quickadd">
        <form onSubmit={submitNew}>
          <input ref={addRef} value={newName} placeholder="Add someone — just a name, enrich later  (n)"
            onChange={(e) => setNewName(e.target.value)} />
          {newName.trim() && <button className="btn primary" type="submit"><Icon n="plus" size={15} />Add</button>}
        </form>
      </div>

      <div className="toolbar">
        <div className="searchbox">
          <Icon n="search" size={15} />
          <input ref={searchRef} value={q} placeholder="Search people, notes, tags…  ( / )"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") { setQ(""); e.target.blur(); } }} />
          {q && <button className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setQ("")}><Icon n="x" size={13} /></button>}
        </div>
        <select className={"select" + (group ? " active" : "")} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Group</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className={"select" + (tag ? " active" : "")} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Tag</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={"select" + (status ? " active" : "")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Status</option>
          <option value="overdue">Overdue</option>
          <option value="soon">Due soon</option>
          <option value="ok">On track</option>
          <option value="none">No cadence</option>
        </select>
        <select className={"select" + (show !== "active" ? " active" : "")} value={show} onChange={(e) => setShow(e.target.value)}>
          <option value="active">Active</option>
          <option value="starred">Starred</option>
          <option value="archived">Archived</option>
          <option value="all">Everyone</option>
        </select>
        <select className="select" value={sort} onChange={(e) => setSort(e.target.value)} title="Sort">
          <option value="name">A–Z</option>
          <option value="recent">Recently touched</option>
          <option value="overdue">Most overdue</option>
        </select>
        {(group || tag || status) && (
          <button className="btn ghost sm" onClick={() => { setGroup(""); setTag(""); setStatus(""); }}>Clear</button>
        )}
        <div className="view-toggle">
          <button className={"icon-btn" + (!grid ? " on" : "")} title="List" onClick={() => setPrefs({ view: "list" })}><Icon n="list" size={16} /></button>
          <button className={"icon-btn" + (grid ? " on" : "")} title="Grid" onClick={() => setPrefs({ view: "grid" })}><Icon n="grid" size={16} /></button>
        </div>
        {!grid && (
          <button className={"btn sm" + (bulk ? " primary" : "")} onClick={() => (bulk ? exitBulk() : setBulk(true))}>
            {bulk ? "Done" : "Select"}
          </button>
        )}
      </div>

      {shown.length === 0 ? (
        <div className="card empty">
          <Icon n="users" size={28} />
          <div className="display">No one here</div>
          <p>{contacts.length === 0 ? "Add your first person above." : "Try clearing the search or filters."}</p>
        </div>
      ) : grid ? (
        <div className="grid">
          {shown.map(({ c, info }) => {
            const pill = duePill(info);
            return (
              <div key={c.id} className="card grid-card" onClick={() => openProfile(c.id)}
                role="button" tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter") openProfile(c.id); }}>
                <Avatar c={c} size={56} />
                <div>
                  <div className="person-name" style={{ cursor: "pointer" }}>{c.name}</div>
                  <div className="person-meta">{c.company || c.context || "—"}</div>
                </div>
                {pill ? <span className={"pill " + pill.cls}>{pill.text}</span> : <span className="pill none">no cadence</span>}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card row-list">
          {shown.map(({ c, info }) => {
            const pill = duePill(info);
            const sub = [c.role && c.company ? c.role + ", " + c.company : c.company || c.role, c.location]
              .filter(Boolean).join(" · ") || c.context;
            return (
              <div key={c.id} className="person-row">
                <div className="person-row-main">
                  {bulk && (
                    <input type="checkbox" className="row-check" checked={sel.has(c.id)}
                      onChange={() => toggleSel(c.id)} aria-label={"Select " + c.name} />
                  )}
                  <Avatar c={c} size={40} />
                  <div className="person-row-info">
                    <button className="person-name" onClick={() => (bulk ? toggleSel(c.id) : openProfile(c.id))}>{c.name}</button>
                    <div className="person-meta">{sub || "—"}</div>
                  </div>
                  <div className="person-side">
                    {c.archived && <span className="chip">archived</span>}
                    {(c.tags || []).slice(0, 2).map((t) => <span key={t} className="chip">{t}</span>)}
                    {pill ? <span className={"pill " + pill.cls}>{pill.text}</span> : <span className="pill none">no cadence</span>}
                    <button className={"icon-btn star" + (c.starred ? " on" : "")} title={c.starred ? "Unstar" : "Star"}
                      onClick={() => toggleStar(c.id)}>
                      <Icon n="star" size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {bulk && !grid && (
        <div className="card bulkbar">
          <span className="bulk-count">{sel.size} selected</span>
          <button className="btn ghost sm" onClick={() => setSel(new Set(shown.map((x) => x.c.id)))}>All</button>
          <button className="btn ghost sm" onClick={() => setSel(new Set())}>None</button>
          <span className="bulk-sep" />
          <input className="bulk-input" placeholder="tag…" value={bulkTag} onChange={(e) => setBulkTag(e.target.value)} />
          <button className="btn sm" disabled={!bulkTag.trim() || !sel.size}
            onClick={() => { bulkApply([...sel], "tag", bulkTag.trim().toLowerCase()); setBulkTag(""); }}>Tag</button>
          <select className="select" value={bulkGroup} onChange={(e) => setBulkGroup(e.target.value)}>
            <option value="">Group…</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <button className="btn sm" disabled={!bulkGroup || !sel.size}
            onClick={() => { bulkApply([...sel], "group", bulkGroup); setBulkGroup(""); }}>Add</button>
          <select className="select" value={bulkCadence} onChange={(e) => setBulkCadence(e.target.value)}>
            <option value="">Cadence…</option>
            {CADENCES.filter((x) => x.id !== "custom").map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
          <button className="btn sm" disabled={!bulkCadence || !sel.size}
            onClick={() => { bulkApply([...sel], "cadence", bulkCadence); setBulkCadence(""); }}>Set</button>
          <span className="bulk-sep" />
          <button className="btn sm" disabled={!sel.size} onClick={() => bulkApply([...sel], "star")}>
            <Icon n="star" size={13} />Star
          </button>
          <button className="btn sm" disabled={!sel.size}
            onClick={() => { bulkApply([...sel], "archive"); setSel(new Set()); }}>
            <Icon n="archive" size={13} />Archive
          </button>
          <ConfirmButton className="btn sm danger" label="Delete" confirmLabel={"Delete " + sel.size + "?"}
            onConfirm={() => { if (sel.size) { bulkApply([...sel], "delete"); exitBulk(); } }} />
        </div>
      )}
    </div>
  );
}

/* ============================== profile view ============================== */

const CORE_FIELDS = [
  { k: "email", label: "Email", type: "email", ph: "email@…" },
  { k: "phone", label: "Phone", type: "tel", ph: "(555) …" },
  { k: "company", label: "Company", type: "text", ph: "Where they work" },
  { k: "role", label: "Role", type: "text", ph: "What they do" },
  { k: "location", label: "Location", type: "text", ph: "City" },
  { k: "birthday", label: "Birthday", type: "text", ph: "YYYY-MM-DD or MM-DD" },
];

function ProfileView({ contact: c, groups, back, update, remove, logInteraction, snooze, addGroup, toast }) {
  const [composing, setComposing] = useState(false);
  const [fieldLabel, setFieldLabel] = useState("");
  const [addingField, setAddingField] = useState(false);
  const [remDate, setRemDate] = useState(iso(todayMid()));
  const [remText, setRemText] = useState("");
  const [dateLabel, setDateLabel] = useState("");
  const [dateVal, setDateVal] = useState("");
  const fileRef = useRef(null);
  const info = dueInfo(c);
  const pill = duePill(info);

  const set = (patch) => update(c.id, patch);

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 160;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.width * scale);
      cv.height = Math.round(img.height * scale);
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      set({ photo: cv.toDataURL("image/jpeg", 0.85) });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); toast("Couldn't read that image"); };
    img.src = url;
  };

  const nb = nextBirthday(c.birthday);
  const timeline = [...(c.interactions || [])].sort((a, b) => b.date.localeCompare(a.date));
  const reminders = [...(c.reminders || [])].sort((a, b) => a.date.localeCompare(b.date));

  const addReminder = (e) => {
    e.preventDefault();
    if (!remText.trim() || !remDate) return;
    set({ reminders: [...(c.reminders || []), { id: uid(), date: remDate, text: remText.trim() }] });
    setRemText("");
  };

  return (
    <div className="page">
      <button className="back-btn" onClick={back}><Icon n="chevronLeft" size={15} />Back</button>

      <div className="card">
        <div className="profile-head">
          <button className="avatar-upload" title="Set photo" onClick={() => fileRef.current && fileRef.current.click()}>
            <Avatar c={c} size={76} />
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={onPhoto} />
          <div className="profile-id">
            <input className="name-input" value={c.name} placeholder="Name"
              onChange={(e) => set({ name: e.target.value })} />
            <input className="context-input" value={c.context} placeholder="How did you meet? Add a line of context…"
              onChange={(e) => set({ context: e.target.value })} />
            <div className="chip-row">
              {groups.map((g) => {
                const on = (c.groups || []).includes(g);
                return (
                  <button key={g} className={"chip" + (on ? " on" : "")}
                    onClick={() => set({ groups: on ? c.groups.filter((x) => x !== g) : [...(c.groups || []), g] })}>
                    {g}
                  </button>
                );
              })}
              <ChipInput placeholder="group" onAdd={(g) => { addGroup(g); set({ groups: [...new Set([...(c.groups || []), g])] }); }} />
            </div>
            <div className="chip-row">
              {(c.tags || []).map((t) => (
                <span key={t} className="chip">{t}
                  <button className="x" onClick={() => set({ tags: c.tags.filter((x) => x !== t) })} title="Remove tag">
                    <Icon n="x" size={11} />
                  </button>
                </span>
              ))}
              <ChipInput placeholder="tag" onAdd={(t) => set({ tags: [...new Set([...(c.tags || []), t.toLowerCase()])] })} />
            </div>
          </div>
        </div>
        <div className="profile-actions">
          <button className="btn primary sm" onClick={() => setComposing(true)}><Icon n="plus" size={14} />Log interaction</button>
          {info.status !== "none" && (
            <button className="btn sm" onClick={() => snooze(c.id, 7)}><Icon n="clock" size={14} />Snooze 7d</button>
          )}
          <button className={"btn sm" + (c.starred ? " star-on" : "")} onClick={() => set({ starred: !c.starred })}>
            <Icon n="star" size={14} />{c.starred ? "Starred" : "Star"}
          </button>
          <button className="btn sm" onClick={() => set({ archived: !c.archived })}>
            <Icon n="archive" size={14} />{c.archived ? "Unarchive" : "Archive"}
          </button>
          <ConfirmButton className="btn ghost sm danger" label="Delete" confirmLabel="Really delete?"
            onConfirm={() => remove(c.id)} />
        </div>
        {c.archived && (
          <div className="profile-archived">Archived — hidden from Today, People, and stats until you unarchive.</div>
        )}
      </div>

      <div className="card pcard">
        <h3 className="pcard-title">Keep in touch</h3>
        <div className="cadence-row">
          {CADENCES.map((cd) => (
            <button key={cd.id}
              className={"type-chip" + ((c.cadence || { id: "none" }).id === cd.id ? " on" : "")}
              onClick={() => set({ cadence: { id: cd.id, days: cd.id === "custom" ? (c.cadence?.days || 14) : cd.days } })}>
              {cd.id === "custom" ? "Custom" : cd.label}
            </button>
          ))}
          {(c.cadence || {}).id === "custom" && (
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--muted)" }}>
              every
              <input className="days-input" type="number" min="1" max="3650" value={c.cadence.days || ""}
                onChange={(e) => set({ cadence: { id: "custom", days: Math.max(1, +e.target.value || 0) } })} />
              days
            </label>
          )}
        </div>
        <div className="cadence-status">
          <span>Last touch <b>{ago(info.last ? -daysFromToday(info.last) : null)}</b></span>
          {pill && <span className={"pill " + pill.cls}>{pill.text}</span>}
          <span>· {(c.interactions || []).length} logged{typicalGap(c) ? ", usually every ~" + typicalGap(c) + "d" : ""}</span>
          {c.snoozedUntil && daysFromToday(c.snoozedUntil) > 0 && (
            <span>
              snoozed until {fmtShort(c.snoozedUntil)}{" "}
              <button className="btn ghost sm" onClick={() => set({ snoozedUntil: null })}>clear</button>
            </span>
          )}
        </div>
      </div>

      <div className="card pcard">
        <h3 className="pcard-title">Details</h3>
        <div className="fields">
          {CORE_FIELDS.map((f) => (
            <div className="field" key={f.k}>
              <label>
                {f.label}{f.k === "birthday" && nb && c.birthday ? " · " + inDays(Math.round((nb.date - todayMid()) / DAY)) : ""}
                {f.k === "email" && c.email && (
                  <a className="field-act" href={"mailto:" + c.email} title="Compose email"><Icon n="mail" size={12} /></a>
                )}
                {f.k === "phone" && c.phone && (
                  <a className="field-act" href={"tel:" + c.phone.replace(/[^+\d]/g, "")} title="Call"><Icon n="phone" size={12} /></a>
                )}
              </label>
              <input type={f.type} value={c[f.k] || ""} placeholder={f.ph}
                onChange={(e) => set({ [f.k]: e.target.value })} />
            </div>
          ))}
          {(c.custom || []).map((cf) => (
            <div className="field" key={cf.id}>
              <label>
                {cf.label}
                <button className="icon-btn" title="Remove field"
                  onClick={() => set({ custom: c.custom.filter((x) => x.id !== cf.id) })}>
                  <Icon n="x" size={11} />
                </button>
              </label>
              <input value={cf.value} placeholder="…"
                onChange={(e) => set({ custom: c.custom.map((x) => x.id === cf.id ? { ...x, value: e.target.value } : x) })} />
            </div>
          ))}
        </div>
        <div className="add-field">
          {!addingField ? (
            <button className="chip-add" onClick={() => setAddingField(true)}>+ Add a field</button>
          ) : (
            <>
              <select className="select" value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)}>
                <option value="">Field name…</option>
                {FIELD_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <input className="chip-input" style={{ width: 140 }} placeholder="or type your own"
                value={FIELD_PRESETS.includes(fieldLabel) ? "" : fieldLabel}
                onChange={(e) => setFieldLabel(e.target.value)} />
              <button className="btn sm" onClick={() => {
                const l = fieldLabel.trim();
                if (l) set({ custom: [...(c.custom || []), { id: uid(), label: l, value: "" }] });
                setFieldLabel(""); setAddingField(false);
              }}>Add</button>
              <button className="btn ghost sm" onClick={() => { setFieldLabel(""); setAddingField(false); }}>Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="card pcard">
        <h3 className="pcard-title">Notes</h3>
        <textarea className="notes-area" value={c.notes || ""}
          placeholder="Anything worth remembering — family names, preferences, what they're working on, what you owe each other…"
          onChange={(e) => set({ notes: e.target.value })} />
      </div>

      <div className="card pcard">
        <h3 className="pcard-title">Reminders</h3>
        {reminders.length === 0 && <p style={{ color: "var(--faint)", fontSize: 13.5, margin: 0 }}>No reminders. Add one below — it shows on your dashboard as the date approaches.</p>}
        {reminders.map((r) => (
          <div className="rem-row" key={r.id}>
            <span className="rem-date">{fmtLong(r.date)}</span>
            <span className="rem-text">{r.text}</span>
            <button className="icon-btn" title="Done"
              onClick={() => set({ reminders: c.reminders.filter((x) => x.id !== r.id) })}>
              <Icon n="check" size={15} />
            </button>
          </div>
        ))}
        <form className="rem-add" onSubmit={addReminder}>
          <input type="date" value={remDate} onChange={(e) => setRemDate(e.target.value)} />
          <input type="text" value={remText} placeholder="Remind me to…" onChange={(e) => setRemText(e.target.value)} />
          <button className="btn sm" type="submit">Add</button>
        </form>
      </div>

      <div className="card pcard">
        <h3 className="pcard-title">Important dates</h3>
        {(c.dates || []).length === 0 && (
          <p style={{ color: "var(--faint)", fontSize: 13.5, margin: 0 }}>
            Anniversaries, kids' birthdays, yearly traditions — they recur every year and surface on your dashboard.
          </p>
        )}
        {(c.dates || []).map((dt) => {
          const occ = nextBirthday(dt.date);
          return (
            <div className="rem-row" key={dt.id}>
              <span className="rem-date">{fmtShort(dt.date)}</span>
              <span className="rem-text">{dt.label}</span>
              {occ && <span className="rem-date">{inDays(Math.round((occ.date - todayMid()) / DAY))}</span>}
              <button className="icon-btn" title="Remove date"
                onClick={() => set({ dates: c.dates.filter((x) => x.id !== dt.id) })}>
                <Icon n="x" size={14} />
              </button>
            </div>
          );
        })}
        <form className="rem-add" onSubmit={(e) => {
          e.preventDefault();
          if (!dateLabel.trim() || !dateVal) return;
          set({ dates: [...(c.dates || []), { id: uid(), label: dateLabel.trim(), date: dateVal }] });
          setDateLabel(""); setDateVal("");
        }}>
          <input type="date" value={dateVal} onChange={(e) => setDateVal(e.target.value)} />
          <input type="text" value={dateLabel} placeholder="Wedding anniversary, kid's birthday…"
            onChange={(e) => setDateLabel(e.target.value)} />
          <button className="btn sm" type="submit">Add</button>
        </form>
      </div>

      <div className="card pcard">
        <div className="pcard-title-row">
          <h3 className="pcard-title">Timeline</h3>
          {!composing && (
            <button className="btn sm" onClick={() => setComposing(true)}><Icon n="plus" size={14} />Add</button>
          )}
        </div>
        {composing && (
          <div className="tl-composer">
            <QuickLog
              onSave={(entry) => { logInteraction(c.id, entry); setComposing(false); }}
              onCancel={() => setComposing(false)} />
          </div>
        )}
        {timeline.length === 0 && !composing && (
          <p style={{ color: "var(--faint)", fontSize: 13.5, margin: 0 }}>
            No interactions yet. Logging one sets their "last touch" and starts the cadence clock.
          </p>
        )}
        {timeline.map((it) => {
          const t = ITYPES.find((x) => x.id === it.type) || ITYPES[4];
          return (
            <div className="tl-entry" key={it.id}>
              <div className="tl-icon"><Icon n={t.icon} size={15} /></div>
              <div className="tl-body">
                <div className="tl-head">
                  <span className="tl-type">{t.label}</span>
                  <span className="tl-date">{fmtLong(it.date)} · {ago(-daysFromToday(it.date))}</span>
                </div>
                {it.text && <div className="tl-text">{it.text}</div>}
              </div>
              <button className="icon-btn tl-del" title="Delete entry"
                onClick={() => set({ interactions: c.interactions.filter((x) => x.id !== it.id) })}>
                <Icon n="trash" size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ============================== history view ============================== */

function HistoryView({ contacts, openProfile }) {
  const [type, setType] = useState("");
  const entries = useMemo(() => {
    const out = [];
    for (const c of contacts) {
      if (c.archived) continue;
      for (const it of c.interactions || []) out.push({ c, it });
    }
    out.sort((a, b) => b.it.date.localeCompare(a.it.date));
    return out;
  }, [contacts]);
  const shown = type ? entries.filter((e) => e.it.type === type) : entries;

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title display">History</h1>
        <p className="page-sub">
          {entries.length === 0 ? "Every interaction you log lands here." : entries.length + " interactions across everyone"}
        </p>
      </header>
      <div className="type-chips" style={{ marginBottom: 16 }}>
        <button className={"type-chip" + (!type ? " on" : "")} onClick={() => setType("")}>All</button>
        {ITYPES.map((t) => (
          <button key={t.id} className={"type-chip" + (type === t.id ? " on" : "")} onClick={() => setType(t.id)}>
            <Icon n={t.icon} size={14} />{t.label}
          </button>
        ))}
      </div>
      <div className="card row-list">
        {shown.length === 0 && (
          <div className="empty">
            <Icon n="history" size={28} />
            <div className="display">Nothing here yet</div>
            <p>Log an interaction from Today or a profile and it shows up in this feed.</p>
          </div>
        )}
        {shown.slice(0, 200).map(({ c, it }) => {
          const t = ITYPES.find((x) => x.id === it.type) || ITYPES[4];
          return (
            <div className="up-row" key={it.id}>
              <Avatar c={c} size={36} />
              <div className="up-body">
                <div className="up-title">
                  <button onClick={() => openProfile(c.id)}>{c.name}</button>
                  <span className="hist-type"><Icon n={t.icon} size={12} />{t.label}</span>
                </div>
                {it.text && <div className="up-sub">{it.text}</div>}
              </div>
              <span className="up-when">{fmtLong(it.date)}</span>
            </div>
          );
        })}
        {shown.length > 200 && (
          <div className="empty" style={{ padding: "14px" }}><p>Showing the latest 200 — filter by type to narrow down.</p></div>
        )}
      </div>
    </div>
  );
}

/* ============================== import / export ============================== */

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { cell += '"'; i++; } else inQ = false;
      } else cell += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

function contactsFromCSV(text) {
  const rows = parseCSV(String(text).replace(/^﻿/, ""));
  if (rows.length < 2) return [];

  // Find the header row. LinkedIn's Connections.csv opens with a "Notes:"
  // preamble paragraph before the real header, so scan instead of assuming row 0.
  let hi = -1;
  for (let i = 0; i < Math.min(rows.length, 12); i++) {
    const cells = rows[i].map((c) => c.trim().toLowerCase());
    if (cells.includes("first name") || cells.includes("name") || cells.includes("full name")) { hi = i; break; }
  }
  if (hi < 0 || hi === rows.length - 1) return [];

  const headers = rows[hi].map((h) => h.trim().toLowerCase());
  const exact = (...names) => headers.findIndex((h) => names.includes(h));
  const loose = (...names) => headers.findIndex((h) => names.some((n) => h.includes(n)));
  const iFirst = exact("first name");
  const iLast = exact("last name");
  const idx = {
    name: exact("name", "full name") >= 0 ? exact("name", "full name") : loose("name"),
    email: loose("email"), phone: loose("phone", "mobile"),
    company: loose("company", "organization", "org"), role: loose("role", "title", "position"),
    location: loose("location", "city"), birthday: loose("birthday", "birth"),
    tags: loose("tags", "labels"), notes: loose("notes"), context: loose("context", "how we met", "met"),
    url: exact("url", "profile url", "linkedin url", "linkedin"),
    connected: loose("connected on", "connected"),
  };
  if (iFirst < 0 && idx.name < 0) return [];

  const out = [];
  for (const r of rows.slice(hi + 1)) {
    const get = (i) => (i >= 0 && r[i] ? r[i].trim() : "");
    const name = iFirst >= 0
      ? (get(iFirst) + " " + get(iLast)).trim()
      : get(idx.name);
    if (!name) continue;
    const c = blankContact(name);
    c.email = get(idx.email); c.phone = get(idx.phone); c.company = get(idx.company);
    c.role = get(idx.role); c.location = get(idx.location); c.birthday = get(idx.birthday);
    c.notes = get(idx.notes); c.context = get(idx.context);
    const url = get(idx.url);
    if (url) c.custom.push({ id: uid(), label: "LinkedIn", value: url });
    const connected = get(idx.connected);
    if (connected && !c.context) c.context = "Connected on LinkedIn · " + connected;
    const tags = get(idx.tags);
    if (tags) c.tags = tags.split(/[;|]|,\s*/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    out.push(c);
  }
  return out;
}

/* ============================== app ============================== */

function normalizeData(raw) {
  if (!raw || !Array.isArray(raw.contacts)) return null;
  const base = { v: 1, groups: [], prefs: { view: "list" } };
  const data = { ...base, ...raw };
  data.groups = Array.isArray(data.groups) ? data.groups : [];
  data.prefs = { view: "list", ...(data.prefs || {}) };
  data.contacts = data.contacts.filter((c) => c && c.name != null).map((c) => ({
    ...blankContact(String(c.name)), ...c,
    id: c.id || uid(),
    tags: Array.isArray(c.tags) ? c.tags : [],
    groups: Array.isArray(c.groups) ? c.groups : [],
    custom: Array.isArray(c.custom) ? c.custom : [],
    reminders: Array.isArray(c.reminders) ? c.reminders : [],
    dates: Array.isArray(c.dates) ? c.dates : [],
    interactions: Array.isArray(c.interactions) ? c.interactions : [],
    cadence: c.cadence && c.cadence.id ? c.cadence : { id: "none", days: null },
    starred: !!c.starred,
    archived: !!c.archived,
  }));
  for (const c of data.contacts)
    for (const g of c.groups) if (!data.groups.includes(g)) data.groups.push(g);
  return data;
}

function App() {
  const [data, setData] = useState(null);
  const [route, setRoute] = useState({ name: "today" });
  const [toastState, setToastState] = useState(null);
  const [mode, setMode] = useState("memory");
  const [exportText, setExportText] = useState(null);
  const jsonRef = useRef(null);
  const csvRef = useRef(null);
  const toastTimer = useRef(null);

  const toast = useCallback((msg) => {
    setToastState({ msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), 2600);
  }, []);

  /* load */
  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await detectAndLoad();
      if (!alive) return;
      setMode(storageMode);
      let parsed = null;
      if (raw) { try { parsed = normalizeData(JSON.parse(raw)); } catch (e) { /* corrupted — reseed */ } }
      setData(parsed || seedData());
    })();
    return () => { alive = false; };
  }, []);

  /* save (debounced) */
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (!loadedRef.current) { loadedRef.current = true; persist(JSON.stringify(data)); return; }
    const t = setTimeout(() => persist(JSON.stringify(data)), 300);
    return () => clearTimeout(t);
  }, [data]);

  /* keyboard */
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || e.target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "n") { e.preventDefault(); setRoute({ name: "people", focus: { target: "add", t: Date.now() } }); }
      else if (e.key === "/") { e.preventDefault(); setRoute({ name: "people", focus: { target: "search", t: Date.now() } }); }
      else if (e.key === "Escape") setRoute((r) => (r.name === "profile" ? { name: r.from || "people" } : r));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const contacts = data ? data.contacts : [];
  const updateContact = useCallback((id, patch) => {
    setData((d) => ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, ...patch, sample: false } : c)) }));
  }, []);

  const logInteraction = useCallback((id, { type, text, date }) => {
    setData((d) => ({
      ...d,
      contacts: d.contacts.map((c) =>
        c.id === id
          ? { ...c, snoozedUntil: null, interactions: [...(c.interactions || []), { id: uid(), type, text, date: date || iso(todayMid()) }] }
          : c),
    }));
    const c = contacts.find((x) => x.id === id);
    const days = c ? cadenceDays(c) : null;
    toast(c ? "Logged " + type + " with " + c.name + (days ? " — next due " + fmtShort(iso(shiftDays(parseDate(date) || todayMid(), days))) : "") : "Logged");
  }, [contacts, toast]);

  const snooze = useCallback((id, days) => {
    const until = iso(shiftDays(todayMid(), days));
    setData((d) => ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, snoozedUntil: until } : c)) }));
    const c = contacts.find((x) => x.id === id);
    toast((c ? c.name + " snoozed" : "Snoozed") + " until " + fmtShort(until));
  }, [contacts, toast]);

  const completeReminder = useCallback((cid, rid) => {
    setData((d) => ({
      ...d,
      contacts: d.contacts.map((c) => (c.id === cid ? { ...c, reminders: (c.reminders || []).filter((r) => r.id !== rid) } : c)),
    }));
    toast("Reminder done");
  }, [toast]);

  const addContact = useCallback((name) => {
    const c = blankContact(name);
    setData((d) => ({ ...d, contacts: [...d.contacts, c] }));
    setRoute({ name: "profile", id: c.id, from: "people" });
    toast("Added " + name);
  }, [toast]);

  const removeContact = useCallback((id) => {
    const c = contacts.find((x) => x.id === id);
    setData((d) => ({ ...d, contacts: d.contacts.filter((x) => x.id !== id) }));
    setRoute({ name: "people" });
    toast(c ? "Deleted " + c.name : "Deleted");
  }, [contacts, toast]);

  const addGroup = useCallback((g) => {
    setData((d) => (d.groups.includes(g) ? d : { ...d, groups: [...d.groups, g] }));
  }, []);

  const toggleStar = useCallback((id) => {
    setData((d) => ({ ...d, contacts: d.contacts.map((c) => (c.id === id ? { ...c, starred: !c.starred } : c)) }));
  }, []);

  const bulkApply = useCallback((ids, action, value) => {
    const idSet = new Set(ids);
    setData((d) => {
      if (action === "delete") return { ...d, contacts: d.contacts.filter((c) => !idSet.has(c.id)) };
      return {
        ...d,
        contacts: d.contacts.map((c) => {
          if (!idSet.has(c.id)) return c;
          if (action === "tag") return { ...c, sample: false, tags: [...new Set([...(c.tags || []), value])] };
          if (action === "group") return { ...c, sample: false, groups: [...new Set([...(c.groups || []), value])] };
          if (action === "cadence") {
            const def = CADENCES.find((x) => x.id === value);
            return { ...c, sample: false, cadence: { id: value, days: def ? def.days : null } };
          }
          if (action === "star") return { ...c, starred: true };
          if (action === "archive") return { ...c, archived: true };
          return c;
        }),
      };
    });
    const n = ids.length;
    const verbs = {
      tag: "Tagged " + n + ' with "' + value + '"', group: "Added " + n + " to " + value,
      cadence: "Set " + n + " to " + value, star: "Starred " + n,
      archive: "Archived " + n, delete: "Deleted " + n,
    };
    toast(verbs[action] || "Done");
  }, [toast]);

  const [dupOpen, setDupOpen] = useState(false);
  const dupGroups = useMemo(() => (dupOpen ? findDuplicates(contacts) : []), [dupOpen, contacts]);

  const mergeContacts = useCallback((ids) => {
    setData((d) => {
      const group = d.contacts.filter((c) => ids.includes(c.id));
      if (group.length < 2) return d;
      const target = group.reduce((a, b) =>
        (b.interactions || []).length > (a.interactions || []).length ? b : a);
      const merged = { ...target, sample: false };
      for (const r of group) {
        if (r.id === target.id) continue;
        for (const k of ["context", "email", "phone", "company", "role", "location", "birthday", "photo"])
          if (!merged[k]) merged[k] = r[k];
        merged.notes = [merged.notes, r.notes].filter(Boolean).join("\n\n");
        merged.tags = [...new Set([...(merged.tags || []), ...(r.tags || [])])];
        merged.groups = [...new Set([...(merged.groups || []), ...(r.groups || [])])];
        merged.custom = [
          ...(merged.custom || []),
          ...(r.custom || []).filter((cf) => !(merged.custom || []).some((m) => m.label === cf.label && m.value === cf.value)),
        ];
        merged.reminders = [...(merged.reminders || []), ...(r.reminders || [])];
        merged.dates = [...(merged.dates || []), ...(r.dates || [])];
        merged.interactions = [...(merged.interactions || []), ...(r.interactions || [])];
        merged.starred = merged.starred || r.starred;
        if ((merged.cadence || { id: "none" }).id === "none" && r.cadence && r.cadence.id !== "none")
          merged.cadence = r.cadence;
      }
      return {
        ...d,
        contacts: d.contacts
          .filter((c) => !ids.includes(c.id) || c.id === target.id)
          .map((c) => (c.id === target.id ? merged : c)),
      };
    });
    toast("Merged " + ids.length + " entries into one");
  }, [toast]);

  /* export / import */
  const doExport = async () => {
    const payload = JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
    const filename = "hearth-backup-" + iso(todayMid()) + ".json";
    const dl = !__STANDALONE__ && window.claude && window.claude.downloads;
    if (dl && typeof dl.save === "function") {
      try {
        await dl.save({ filename, data: payload });
        toast("Backup saved");
        return;
      } catch (err) {
        if (err && err.code === "declined") return;
        if (err && err.code === "rate_limited") { toast("A save prompt is already open — try again in a moment"); return; }
        /* other codes: fall through to next method */
      }
    }
    try {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast("Backup downloaded");
    } catch (e) {
      setExportText(payload);
    }
  };

  const onJSONFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = normalizeData(JSON.parse(r.result));
        if (!parsed) throw new Error("bad shape");
        setData(parsed);
        setRoute({ name: "today" });
        toast("Restored " + parsed.contacts.length + " contacts from backup");
      } catch (err) {
        toast("That file isn't a Hearth backup — nothing was changed");
      }
    };
    r.readAsText(file);
  };

  const onCSVFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const added = contactsFromCSV(String(r.result));
      if (!added.length) { toast("No contacts found — use a CSV with a name column, or LinkedIn's Connections.csv"); return; }
      setData((d) => ({ ...d, contacts: [...d.contacts, ...added] }));
      setRoute({ name: "people" });
      toast("Imported " + added.length + " contacts from CSV");
    };
    r.readAsText(file);
  };

  const sampleCount = contacts.filter((c) => c.sample).length;
  const clearSample = () => {
    setData((d) => ({ ...d, contacts: d.contacts.filter((c) => !c.sample) }));
    toast("Sample data cleared — it's all yours now");
  };

  /* stats */
  const stats = useMemo(() => {
    let overdue = 0, total = 0, longest = null;
    for (const c of contacts) {
      if (c.archived) continue;
      total++;
      const info = dueInfo(c);
      if (info.status === "overdue") overdue++;
      const last = lastContact(c);
      if (last) {
        const n = -daysFromToday(last);
        if (!longest || n > longest.days) longest = { name: c.name.split(" ")[0], days: n };
      }
    }
    return { total, overdue, longest };
  }, [contacts]);

  if (!data) return null;

  const profileContact = route.name === "profile" ? contacts.find((c) => c.id === route.id) : null;

  return (
    <div className="app">
      <aside className="rail">
        <div className="wordmark"><Mark size={22} />Hearth</div>
        <nav className="nav">
          <button className={"nav-btn" + (route.name === "today" ? " on" : "")} onClick={() => setRoute({ name: "today" })}>
            <Icon n="today" size={17} />Today
            {stats.overdue > 0 && <span className="nav-badge">{stats.overdue}</span>}
          </button>
          <button className={"nav-btn" + (route.name === "people" || route.name === "profile" ? " on" : "")}
            onClick={() => setRoute({ name: "people" })}>
            <Icon n="users" size={17} />People
            <span className="nav-badge quiet">{stats.total}</span>
          </button>
          <button className={"nav-btn" + (route.name === "history" ? " on" : "")}
            onClick={() => setRoute({ name: "history" })}>
            <Icon n="history" size={17} />History
          </button>
        </nav>
        <div className="rail-spacer" />
        <div className="rail-stats">
          <div className="rail-stat"><span>In your circle</span><b>{stats.total}</b></div>
          <div className="rail-stat"><span>Overdue</span><b className={stats.overdue ? "hot" : ""}>{stats.overdue}</b></div>
          {stats.longest && (
            <div className="rail-stat"><span>Quietest: {stats.longest.name}</span><b>{ago(stats.longest.days)}</b></div>
          )}
        </div>
        <div className="rail-tools">
          <button className="rail-tool" onClick={doExport}><Icon n="download" size={15} /><span>Export backup</span></button>
          <button className="rail-tool" onClick={() => jsonRef.current && jsonRef.current.click()}><Icon n="upload" size={15} /><span>Restore JSON</span></button>
          <button className="rail-tool" onClick={() => csvRef.current && csvRef.current.click()}><Icon n="upload" size={15} /><span>Import CSV</span></button>
          <button className="rail-tool" onClick={() => setDupOpen(true)}><Icon n="merge" size={15} /><span>Merge duplicates</span></button>
          {sampleCount > 0 && (
            <ConfirmButton className="rail-tool" label={<><Icon n="broom" size={15} /><span>Clear sample data</span></>}
              confirmLabel={<><Icon n="trash" size={15} /><span>Remove {sampleCount} samples?</span></>}
              onConfirm={clearSample} />
          )}
        </div>
        <div className="rail-hint"><kbd>n</kbd> new person · <kbd>/</kbd> search · <kbd>esc</kbd> back</div>
        <input ref={jsonRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={onJSONFile} />
        <input ref={csvRef} type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onCSVFile} />
      </aside>

      <main>
        {mode === "memory" && (
          <div className="page" style={{ paddingBottom: 0 }}>
            <div className="banner">
              Persistent storage isn't available in this view, so changes last only for this session.
              Use <b>Export backup</b> to keep your data, and <b>Restore JSON</b> to bring it back.
            </div>
          </div>
        )}
        {route.name === "today" && (
          <TodayView contacts={contacts.filter((c) => !c.archived)}
            openProfile={(id) => setRoute({ name: "profile", id, from: "today" })}
            logInteraction={logInteraction} snooze={snooze} completeReminder={completeReminder} />
        )}
        {route.name === "people" && (
          <PeopleView contacts={contacts} groups={data.groups} prefs={data.prefs}
            setPrefs={(p) => setData((d) => ({ ...d, prefs: { ...d.prefs, ...p } }))}
            openProfile={(id) => setRoute({ name: "profile", id, from: "people" })}
            addContact={addContact} focusSignal={route.focus}
            toggleStar={toggleStar} bulkApply={bulkApply} />
        )}
        {route.name === "history" && (
          <HistoryView contacts={contacts}
            openProfile={(id) => setRoute({ name: "profile", id, from: "history" })} />
        )}
        {route.name === "profile" && (profileContact ? (
          <ProfileView contact={profileContact} groups={data.groups}
            back={() => setRoute({ name: route.from || "people" })}
            update={updateContact} remove={removeContact}
            logInteraction={logInteraction} snooze={snooze} addGroup={addGroup} toast={toast} />
        ) : (
          <div className="page"><div className="card empty"><div className="display">Person not found</div>
            <p><button className="btn sm" onClick={() => setRoute({ name: "people" })}>Back to people</button></p></div></div>
        ))}
      </main>

      <Toast toast={toastState} />

      {dupOpen && (
        <div className="overlay" onClick={() => setDupOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Merge duplicates</h3>
            {dupGroups.length === 0 ? (
              <p>No duplicates found — every name and email is unique.</p>
            ) : (
              <p>These entries share a name or email. Merging keeps the fullest entry and combines fields, tags, notes, and complete timelines.</p>
            )}
            {dupGroups.map((ids, i) => (
              <div className="dup-group" key={i}>
                {ids.map((id) => {
                  const c = contacts.find((x) => x.id === id);
                  if (!c) return null;
                  return (
                    <div key={id} className="dup-row">
                      <Avatar c={c} size={28} />
                      <span>{c.name}</span>
                      <span className="dup-meta">
                        {[c.email, c.company, (c.interactions || []).length + " logged"].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                  );
                })}
                <button className="btn primary sm" onClick={() => mergeContacts(ids)}>
                  <Icon n="merge" size={13} />Merge {ids.length}
                </button>
              </div>
            ))}
            <div className="modal-actions">
              <button className="btn" onClick={() => setDupOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {exportText && (
        <div className="overlay" onClick={() => setExportText(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Copy your backup</h3>
            <p>Downloads aren't available in this view. Copy this JSON somewhere safe — you can restore it later with "Restore JSON".</p>
            <textarea readOnly value={exportText} onFocus={(e) => e.target.select()} />
            <div className="modal-actions">
              <button className="btn" onClick={async () => {
                try { await navigator.clipboard.writeText(exportText); toast("Copied to clipboard"); }
                catch (e) { toast("Select the text and copy manually"); }
              }}>Copy</button>
              <button className="btn primary" onClick={() => setExportText(null)}>Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
