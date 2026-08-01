import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { createRoot } from "react-dom/client";
import {
  DAY, CADENCES, ITYPES, todayMid, pad, iso, parseDate, shiftDays, daysFromToday,
  fmtShort, fmtLong, ago, inDays, parseBirthday, nextBirthday, lastContact,
  cadenceDays, cadenceLabel, dueInfo, typicalGap, suggestCadence, findDuplicates,
  GROUP_COLORS, DEFAULT_GROUPS, DEFAULT_RULES, suggestFromRules, ruleMatches,
  groupName, normalizeGroups, colorOf, customDays, UNIT_DAYS,
} from "./due.js";
import { responsePatterns } from "./match.js";
import { parseQuickCapture } from "./parse.js";

/* ============================== constants ============================== */

const KEY = "hearth-crm-v1";

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
  tag: <><path d="M3.5 11V4.5a1 1 0 0 1 1-1H11l9 9-7.5 7.5-9-9z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  chart: <><path d="M4 20V4M4 20h16" /><rect x="7.5" y="12" width="3" height="5" rx="1" /><rect x="12.5" y="8" width="3" height="9" rx="1" /><rect x="17" y="5" width="3" height="12" rx="1" /></>,
  bolt: <path d="M13 3 5.5 13.5H11l-1 7.5 8-11H12l1-7z" />,
  wand: <path d="M4 20 16.5 7.5M14.5 5.5 18.5 9.5M17 3.5v3M20.5 5H21M6.5 4v2.5M5.5 5.2H8M19 15v2M18 16h2" />,
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
    id: uid(), name: "", context: "", emails: [], phones: [], company: "", role: "",
    location: "", birthday: "", photo: null, notes: "", tags: [], groups: [],
    custom: [], reminders: [], dates: [], interactions: [], cadence: { id: "none", days: null },
    snoozedUntil: null, starred: false, archived: false, strength: 0,
    lastContactedAt: "", linkedin: "", connectedOn: "",
    timezone: "", pronouns: "", preferred: "", facts: [],
    createdAt: d(400), sample: true, ...o,
  });
  return {
    v: 2,
    groups: DEFAULT_GROUPS.map((g) => ({ ...g })),
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    prefs: { view: "list" },
    contacts: [
      C({
        name: "Maya Chen", strength: 5, context: "College roommate at Berkeley",
        emails: ["maya@hey.com"], company: "Figma", role: "Product Designer", location: "San Francisco",
        birthday: bday(12, 31), tags: ["berkeley", "design", "hiking"], groups: ["Close Friends"],
        cadence: { id: "monthly" }, starred: true,
        custom: [{ id: uid(), label: "Instagram", value: "@mayadraws" }],
        facts: ["Training for a half marathon", "Sightglass is her spot"], timezone: "PT", pronouns: "she/her",
        notes: "Thinking about leaving Figma to freelance. Loves Sightglass. Training for a half marathon in October.",
        interactions: [
          { id: uid(), type: "coffee", date: d(47), text: "Sightglass — she's serious about going freelance. I promised to send her my contract template." },
          { id: uid(), type: "message", date: d(90), text: "Traded hiking photos from Point Reyes." },
        ],
      }),
      C({
        name: "Grandma June", strength: 5, context: "Mom's side — calls every Sunday if I don't first",
        phones: ["(555) 201-4477"], location: "Tucson, AZ", birthday: bday(25, 84),
        tags: ["family"], groups: ["Family"], cadence: { id: "weekly" }, starred: true,
        facts: ["Tomatoes are her pride", "New hip, doing great"], timezone: "MT", preferred: "Call, never text",
        notes: "New hip doing great. Ask about the garden — the tomatoes are her pride this year.",
        interactions: [
          { id: uid(), type: "call", date: d(5), text: "Long call about the garden and cousin Pete's wedding plans." },
          { id: uid(), type: "call", date: d(13), text: "Quick check-in." },
        ],
      }),
      C({
        name: "Sam Torres", strength: 4, context: "Climbing gym → real friendship",
        phones: ["(555) 887-2210"], location: "Oakland", tags: ["climbing", "music"],
        groups: ["Close Friends"], cadence: { id: "weekly" },
        notes: "Just got a rescue dog named Biscuit. Wants to plan a Bishop trip this fall.",
        interactions: [
          { id: uid(), type: "message", date: d(10), text: "Sent him the Bishop campsite link." },
          { id: uid(), type: "coffee", date: d(24), text: "Post-climb burritos. His startup got acquired — mixed feelings about it." },
        ],
      }),
      C({
        name: "James Okafor", strength: 3, context: "Intro'd by Priya at Founders Brunch '24",
        emails: ["james@meridianvc.com"], company: "Meridian Ventures", role: "Partner",
        location: "New York", tags: ["fintech", "angel"], groups: ["Investors"],
        cadence: { id: "quarterly" },
        linkedin: "https://www.linkedin.com/in/jokafor", connectedOn: "14 Mar 2024",
        reminders: [{ id: uid(), date: f(15), text: "Send the Q3 update deck" }],
        facts: ["Two kids", "Big Arsenal fan"], timezone: "ET", pronouns: "he/him",
        notes: "Writes $50–250k checks. Genuinely helpful with hiring intros. Two kids, big Arsenal fan.",
        interactions: [
          { id: uid(), type: "email", date: d(104), text: "Sent Q2 update; he replied with two candidate intros." },
          { id: uid(), type: "call", date: d(160), text: "30 min — walked him through the roadmap." },
        ],
      }),
      C({
        name: "Priya Sharma", strength: 4, context: "Former teammate at Stripe, my first mentor",
        emails: ["priya.sh@gmail.com"], company: "Anthropic", role: "Eng Manager", location: "San Francisco",
        tags: ["stripe", "mentor"], groups: ["Work"], cadence: { id: "quarterly" },
        dates: [{ id: uid(), label: "Stripe reunion dinner", date: bday(20, 5) }],
        notes: "Best career advice I've ever gotten. Owes me a book rec; I owe her dinner.",
        interactions: [
          { id: uid(), type: "coffee", date: d(30), text: "Blue Bottle — talked through the co-founder question. 'Hire for what you're bad at.'" },
        ],
      }),
      C({
        name: "Alex Kim", strength: 2, context: "Met at the AI meetup demo night",
        emails: ["alex@lumenlabs.io"], company: "Lumen Labs", role: "Founder", location: "Berkeley",
        tags: ["ai", "founder"], groups: ["Work"], cadence: { id: "monthly" },
        reminders: [{ id: uid(), date: f(6), text: "Ask how the launch went" }],
        interactions: [
          { id: uid(), type: "message", date: d(20), text: "They're launching in three weeks — nervous but excited." },
        ],
      }),
      C({
        name: "Dana Whitfield", strength: 2, context: "Angel from the first round, met via YC forum",
        emails: ["dana@whitfield.capital"], company: "Whitfield Capital", location: "Austin",
        tags: ["angel"], groups: ["Investors"], cadence: { id: "yearly" },
        notes: "Prefers email. Hands-off but opens every update.",
        interactions: [
          { id: uid(), type: "email", date: d(400), text: "Annual update — she replied 'keep going.'" },
        ],
      }),
      C({
        name: "Noor Haddad", strength: 3, context: "Neighbors in the old building on Grand Ave",
        phones: ["(555) 341-9902"], location: "Oakland", birthday: bday(3, 29),
        tags: ["neighbor", "food"], groups: ["Close Friends"], cadence: { id: "monthly" },
        notes: "Started a supper club — wants help with the website. Incredible cook.",
        interactions: [
          { id: uid(), type: "message", date: d(28), text: "Confirmed I'm in for the next supper club." },
        ],
      }),
      C({
        name: "Chris Palmer", strength: 1, context: "Dog park regular, has the corgi",
        tags: ["neighbor"], groups: [],
        interactions: [
          { id: uid(), type: "message", date: d(8), text: "Sent him the corgi meetup flyer." },
          { id: uid(), type: "coffee", date: d(20), text: "Ran into him at Peet's — talked fantasy football." },
          { id: uid(), type: "message", date: d(33), text: "Dog park plans for Saturday." },
        ],
      }),
    ],
  };
}

function blankContact(name) {
  return {
    id: uid(), name: name.trim(), context: "", emails: [], phones: [], company: "",
    role: "", location: "", birthday: "", photo: null, notes: "", tags: [], groups: [],
    custom: [], reminders: [], dates: [], interactions: [], cadence: { id: "none", days: null },
    snoozedUntil: null, starred: false, archived: false, noSuggest: false,
    strength: 0, lastContactedAt: "", linkedin: "", connectedOn: "",
    timezone: "", pronouns: "", preferred: "", facts: [],
    createdAt: iso(todayMid()), sample: false,
  };
}

const STRENGTH_LABELS = ["Not set", "Acquaintance", "Loose tie", "Solid", "Close", "Inner circle"];

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

function CategoryRow({ group, count, onRename, onRecolor, onDelete }) {
  const [name, setName] = useState(group.name);
  useEffect(() => { setName(group.name); }, [group.name]);
  return (
    <div className="cat-row">
      <input className={"cat-name chip gc-" + group.color} value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => (name.trim() ? onRename(name) : setName(group.name))}
        onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
      <span className="cat-count">{count} {count === 1 ? "person" : "people"}</span>
      <span className="cat-swatches">
        {GROUP_COLORS.map((label, i) => (
          <button key={i} className={"swatch gc-" + i + (group.color === i ? " on" : "")}
            title={label} aria-label={label} onClick={() => onRecolor(i)} />
        ))}
      </span>
      <ConfirmButton className="btn ghost sm danger" label="Remove" confirmLabel="Sure?" onConfirm={onDelete} />
    </div>
  );
}

function RuleRow({ rule, groups, contacts, onSave, onDelete }) {
  const matches = useMemo(
    () => contacts.filter((c) => !c.archived && ruleMatches(rule, c)).length,
    [rule, contacts]);
  const patch = (p) => onSave({ ...rule, ...p });
  return (
    <div className="rule-row">
      <select className="select" value={rule.field} onChange={(e) => patch({ field: e.target.value })}>
        <option value="any">Company or title</option>
        <option value="company">Company</option>
        <option value="title">Title</option>
      </select>
      <span className="rule-word">contains</span>
      <input className="rule-input" value={rule.keywords} placeholder="ventures, capital"
        onChange={(e) => patch({ keywords: e.target.value })} />
      <span className="rule-word">→</span>
      <input className="rule-input short" value={rule.group} placeholder="Category" list="rule-groups"
        onChange={(e) => patch({ group: e.target.value })} />
      <datalist id="rule-groups">
        {groups.map((g) => <option key={g.name} value={g.name} />)}
      </datalist>
      <span className="rule-count" title="People currently matching">{matches}</span>
      <button className="icon-btn" title="Delete rule" onClick={onDelete}><Icon n="trash" size={14} /></button>
    </div>
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

function TodayView({ contacts, groups, openProfile, logInteraction, snooze, completeReminder, acceptSuggest, dismissSuggest, openPeople }) {
  const [logging, setLogging] = useState(null);
  const today = todayMid();

  const suggestions = useMemo(() =>
    contacts
      .map((c) => ({ c, s: suggestCadence(c) }))
      .filter((x) => x.s)
      .slice(0, 3),
    [contacts]);

  const recent = useMemo(() => {
    const out = [];
    for (const c of contacts)
      for (const it of c.interactions || []) out.push({ c, it });
    out.sort((a, b) => b.it.date.localeCompare(a.it.date));
    return out.slice(0, 5);
  }, [contacts]);

  const uncategorized = useMemo(
    () => contacts.filter((c) => (c.groups || []).length === 0),
    [contacts]);

  const momentum = useMemo(() => {
    let thisWeek = 0, lastWeek = 0;
    for (const c of contacts) {
      for (const it of c.interactions || []) {
        const n = daysFromToday(it.date);
        if (n == null) continue;
        if (n > -7 && n <= 0) thisWeek++;
        else if (n > -14 && n <= -7) lastWeek++;
      }
    }
    return { thisWeek, lastWeek };
  }, [contacts]);

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
          {" "}
          <span className="momentum">
            {momentum.thisWeek} logged this week
            {momentum.lastWeek > 0 || momentum.thisWeek > 0
              ? momentum.thisWeek >= momentum.lastWeek
                ? " · up from " + momentum.lastWeek + " last week"
                : " · down from " + momentum.lastWeek + " last week"
              : ""}
          </span>
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

      {suggestions.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Noticed</h2>
          </div>
          <div className="card row-list">
            {suggestions.map(({ c, s }) => (
              <div key={c.id} className="person-row">
                <div className="person-row-main">
                  <Avatar c={c} size={38} />
                  <div className="person-row-info">
                    <button className="person-name" onClick={() => openProfile(c.id)}>{c.name}</button>
                    <div className="person-meta">
                      You log something about every {s.gap} days but have no cadence set — {s.label.toLowerCase()}?
                    </div>
                  </div>
                  <div className="person-side">
                    <button className="btn primary sm" onClick={() => acceptSuggest(c.id, s.id)}>
                      Set {s.label.toLowerCase()}
                    </button>
                    <button className="btn ghost sm" onClick={() => dismissSuggest(c.id)}>No thanks</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {uncategorized.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Needs a category</h2>
            <span className="section-count">{uncategorized.length}</span>
          </div>
          <div className="card uncat-card">
            <p className="uncat-note">
              Imported or added without a category. Open one to file it, or use bulk select in People.
            </p>
            <div className="uncat-list">
              {uncategorized.slice(0, 8).map((c) => (
                <button key={c.id} className="uncat-chip" onClick={() => openProfile(c.id)}>
                  <Avatar c={c} size={22} />{c.name}
                </button>
              ))}
            </div>
            {uncategorized.length > 8 && (
              <button className="btn sm" onClick={() => openPeople("uncategorized")}>
                See all {uncategorized.length}
              </button>
            )}
          </div>
        </section>
      )}

      {recent.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Recent interactions</h2>
          </div>
          <div className="card row-list">
            {recent.map(({ c, it }) => {
              const ty = ITYPES.find((x) => x.id === it.type) || ITYPES[ITYPES.length - 1];
              return (
                <div className="up-row" key={it.id}>
                  <div className="up-icon"><Icon n={ty.icon} size={16} /></div>
                  <div className="up-body">
                    <div className="up-title">
                      <button onClick={() => openProfile(c.id)}>{c.name}</button>
                      <span className="hist-type">{ty.label}</span>
                    </div>
                    {it.text && <div className="up-sub">{it.text}</div>}
                  </div>
                  <span className="up-when">{ago(-daysFromToday(it.date))}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

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

function PeopleView({ contacts, groups, prefs, setPrefs, openProfile, addContact, focusSignal, toggleStar, bulkApply, initialShow }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("");
  const [tag, setTag] = useState("");
  const [status, setStatus] = useState("");
  const [show, setShow] = useState("active");
  const [sort, setSort] = useState("name");
  const [strength, setStrength] = useState("");
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
    if (initialShow) setShow(initialShow);
  }, [initialShow]);

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
        if (show === "uncategorized" && ((c.groups || []).length > 0 || c.archived)) return false;
        if (group && !(c.groups || []).includes(group)) return false;
        if (tag && !(c.tags || []).includes(tag)) return false;
        if (status && info.status !== status) return false;
        if (strength && (c.strength || 0) < +strength) return false;
        if (needle) {
          const hay = [c.name, c.company, c.role, c.context, c.location, c.notes, c.linkedin,
            (c.emails || []).join(" "), (c.phones || []).join(" "),
            (c.tags || []).join(" "), (c.groups || []).join(" "),
            (c.custom || []).map((f) => f.label + " " + f.value).join(" ")].join(" ").toLowerCase();
          if (!hay.includes(needle)) return false;
        }
        return true;
      });
    if (sort === "recent") list.sort((a, b) => (b.info.last || "").localeCompare(a.info.last || ""));
    else if (sort === "overdue") list.sort((a, b) =>
      (b.info.overdueDays ?? -99999) - (a.info.overdueDays ?? -99999));
    else if (sort === "strength") list.sort((a, b) =>
      (b.c.strength || 0) - (a.c.strength || 0) || a.c.name.localeCompare(b.c.name));
    else list.sort((a, b) => a.c.name.localeCompare(b.c.name));
    return list;
  }, [contacts, q, group, tag, status, show, sort, strength]);

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
        <select className={"select" + (group ? " active" : "")} value={group} aria-label="Category" onChange={(e) => setGroup(e.target.value)}>
          <option value="">Group</option>
          {groups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
        </select>
        <select className={"select" + (tag ? " active" : "")} value={tag} aria-label="Tag" onChange={(e) => setTag(e.target.value)}>
          <option value="">Tag</option>
          {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select className={"select" + (status ? " active" : "")} value={status} aria-label="Status" onChange={(e) => setStatus(e.target.value)}>
          <option value="">Status</option>
          <option value="overdue">Overdue</option>
          <option value="soon">Due soon</option>
          <option value="ok">On track</option>
          <option value="none">No cadence</option>
        </select>
        <select className={"select" + (show !== "active" ? " active" : "")} value={show} aria-label="Show" onChange={(e) => setShow(e.target.value)}>
          <option value="active">Active</option>
          <option value="starred">Starred</option>
          <option value="uncategorized">Uncategorized</option>
          <option value="archived">Archived</option>
          <option value="all">Everyone</option>
        </select>
        <select className={"select" + (strength ? " active" : "")} value={strength}
          onChange={(e) => setStrength(e.target.value)} aria-label="Strength" title="Minimum relationship strength">
          <option value="">Strength</option>
          <option value="5">5 · inner circle</option>
          <option value="4">4+ · close</option>
          <option value="3">3+ · solid</option>
          <option value="2">2+</option>
          <option value="1">1+ · rated</option>
        </select>
        <select className="select" value={sort} aria-label="Sort" onChange={(e) => setSort(e.target.value)} title="Sort">
          <option value="name">A–Z</option>
          <option value="recent">Recently touched</option>
          <option value="overdue">Most overdue</option>
          <option value="strength">Strongest ties</option>
        </select>
        {(group || tag || status || strength) && (
          <button className="btn ghost sm" onClick={() => { setGroup(""); setTag(""); setStatus(""); setStrength(""); }}>Clear</button>
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
                {(c.groups || []).length > 0 && (
                  <div className="chip-row" style={{ justifyContent: "center" }}>
                    {c.groups.slice(0, 2).map((g) => (
                      <span key={g} className={"chip gc-" + colorOf(groups, g)}>{g}</span>
                    ))}
                  </div>
                )}
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
                    {(c.strength || 0) > 0 && (
                      <span className="str-mini" title={STRENGTH_LABELS[c.strength]}>
                        {[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= c.strength ? "on" : ""} />)}
                      </span>
                    )}
                    {(c.groups || []).slice(0, 2).map((g) => (
                      <span key={g} className={"chip gc-" + colorOf(groups, g)}>{g}</span>
                    ))}
                    {(c.tags || []).slice(0, 1).map((t) => <span key={t} className="chip">{t}</span>)}
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
            {groups.map((g) => <option key={g.name} value={g.name}>{g.name}</option>)}
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
  { k: "company", label: "Company", type: "text", ph: "Where they work" },
  { k: "role", label: "Title", type: "text", ph: "What they do" },
  { k: "location", label: "Location", type: "text", ph: "City" },
  { k: "birthday", label: "Birthday", type: "text", ph: "YYYY-MM-DD or MM-DD" },
  { k: "linkedin", label: "LinkedIn", type: "text", ph: "linkedin.com/in/…" },
  { k: "pronouns", label: "Pronouns", type: "text", ph: "they/them" },
  { k: "timezone", label: "Timezone", type: "text", ph: "PT · UTC−8" },
  { k: "preferred", label: "Preferred contact", type: "text", ph: "Text beats email" },
];

/* Repeatable email / phone rows: always one blank row to type into. */
function MultiField({ label, values, onChange, type, ph, actionScheme }) {
  const rows = [...values, ""];
  const commit = (i, v) => {
    const next = [...values];
    if (i >= next.length) { if (v.trim()) next.push(v.trim()); }
    else if (v.trim()) next[i] = v.trim();
    else next.splice(i, 1);
    onChange(next);
  };
  return (
    <div className="field multi">
      <label>{label}</label>
      {rows.map((v, i) => (
        <div className="multi-row" key={i}>
          <input type={type} defaultValue={v} placeholder={i === 0 ? ph : "add another…"}
            key={v + ":" + i}
            onBlur={(e) => { if (e.target.value.trim() !== v) commit(i, e.target.value); }}
            onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }} />
          {v && actionScheme && (
            <a className="field-act" href={actionScheme + (actionScheme === "tel:" ? v.replace(/[^+\d]/g, "") : v)}
              title={actionScheme === "tel:" ? "Call" : "Compose email"}>
              <Icon n={actionScheme === "tel:" ? "phone" : "mail"} size={12} />
            </a>
          )}
        </div>
      ))}
    </div>
  );
}

function Strength({ value, onChange }) {
  return (
    <div className="strength" role="group" aria-label="Relationship strength">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} className={"str-dot" + (n <= value ? " on" : "")}
          title={STRENGTH_LABELS[n]} aria-label={STRENGTH_LABELS[n]}
          onClick={() => onChange(value === n ? 0 : n)} />
      ))}
      <span className="str-label">{STRENGTH_LABELS[value] || STRENGTH_LABELS[0]}</span>
    </div>
  );
}

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
                const on = (c.groups || []).includes(g.name);
                return (
                  <button key={g.name} className={"chip gc-" + g.color + (on ? " on" : " off")}
                    onClick={() => set({ groups: on ? c.groups.filter((x) => x !== g.name) : [...(c.groups || []), g.name] })}>
                    {g.name}
                  </button>
                );
              })}
              <ChipInput placeholder="category" onAdd={(g) => { addGroup(g); set({ groups: [...new Set([...(c.groups || []), g])] }); }} />
            </div>
            <Strength value={c.strength || 0} onChange={(n) => set({ strength: n })} />
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
        <h3 className="pcard-title">Key facts</h3>
        {(c.facts || []).length === 0 && (
          <p className="li-tip" style={{ marginBottom: 10 }}>
            The things you'd hate to forget — kids' names, what they're into, what you owe each other.
          </p>
        )}
        <MultiField label="" values={c.facts || []} type="text"
          ph="Two kids: Mia and Theo" onChange={(v) => set({ facts: v })} />
      </div>

      <div className="card pcard">
        <h3 className="pcard-title">Keep in touch</h3>
        <div className="cadence-row">
          {CADENCES.map((cd) => (
            <button key={cd.id}
              className={"type-chip" + ((c.cadence || { id: "none" }).id === cd.id ? " on" : "")}
              onClick={() => set({
                cadence: cd.id === "custom"
                  ? { id: "custom", n: c.cadence?.n || 3, unit: c.cadence?.unit || "weeks" }
                  : { id: cd.id, days: cd.days },
              })}>
              {cd.id === "custom" ? "Custom" : cd.label}
            </button>
          ))}
          {(c.cadence || {}).id === "custom" && (
            <label className="custom-cadence">
              every
              <input className="days-input" type="number" min="1" max="520"
                value={c.cadence.n || ""}
                onChange={(e) => set({ cadence: { ...c.cadence, id: "custom", n: Math.max(1, +e.target.value || 0) } })} />
              <select className="select" value={c.cadence.unit || "weeks"}
                onChange={(e) => set({ cadence: { ...c.cadence, id: "custom", unit: e.target.value } })}>
                {Object.keys(UNIT_DAYS).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </label>
          )}
        </div>
        {(() => {
          const s = suggestCadence(c);
          return s ? (
            <div className="cadence-status" style={{ marginTop: 0, marginBottom: 10 }}>
              <button className="type-chip" onClick={() => set({ cadence: { id: s.id, days: CADENCES.find((x) => x.id === s.id).days } })}>
                Suggested: {s.label} — you average every {s.gap}d
              </button>
            </div>
          ) : null;
        })()}
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
          <MultiField label="Email" values={c.emails || []} type="email" ph="email@…"
            actionScheme="mailto:" onChange={(v) => set({ emails: v })} />
          <MultiField label="Phone" values={c.phones || []} type="tel" ph="(555) …"
            actionScheme="tel:" onChange={(v) => set({ phones: v })} />
          {CORE_FIELDS.map((f) => (
            <div className="field" key={f.k}>
              <label>
                {f.label}{f.k === "birthday" && nb && c.birthday ? " · " + inDays(Math.round((nb.date - todayMid()) / DAY)) : ""}
                {f.k === "linkedin" && c.linkedin && (
                  <a className="field-act" href={/^https?:/.test(c.linkedin) ? c.linkedin : "https://" + c.linkedin}
                    target="_blank" rel="noreferrer noopener" title="Open profile"><Icon n="users" size={12} /></a>
                )}
              </label>
              <input type={f.type} value={c[f.k] || ""} placeholder={f.ph}
                onChange={(e) => set({ [f.k]: e.target.value })} />
            </div>
          ))}
          <div className="field">
            <label>Last contacted{(c.interactions || []).length ? " · from timeline" : ""}</label>
            <input type="date" value={c.lastContactedAt || ""} max={iso(todayMid())}
              onChange={(e) => set({ lastContactedAt: e.target.value })} />
          </div>
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

function Bar({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track"><span className={"bar-fill" + (color != null ? " gcf-" + color : "")} style={{ width: Math.max(pct, 2) + "%" }} /></span>
      <span className="bar-value">{value}</span>
    </div>
  );
}

function InsightsView({ contacts, groups, openProfile }) {
  const active = useMemo(() => contacts.filter((c) => !c.archived), [contacts]);

  const byCategory = useMemo(() => {
    const counts = groups.map((g) => ({
      label: g.name, color: g.color,
      value: active.filter((c) => (c.groups || []).includes(g.name)).length,
    }));
    const none = active.filter((c) => (c.groups || []).length === 0).length;
    if (none) counts.push({ label: "Uncategorized", color: null, value: none });
    return counts.sort((a, b) => b.value - a.value);
  }, [active, groups]);

  const added = useMemo(() => {
    const months = [];
    const t = todayMid();
    for (let i = 11; i >= 0; i--) {
      const d = new Date(t.getFullYear(), t.getMonth() - i, 1);
      months.push({ key: d.getFullYear() + "-" + pad(d.getMonth() + 1), label: d.toLocaleDateString(undefined, { month: "short" }), value: 0 });
    }
    const idx = new Map(months.map((m) => [m.key, m]));
    for (const c of active) {
      const k = String(c.createdAt || "").slice(0, 7);
      const m = idx.get(k);
      if (m) m.value++;
    }
    return months;
  }, [active]);

  const neglected = useMemo(() =>
    active
      .map((c) => ({ c, info: dueInfo(c), s: c.strength || 0 }))
      .filter((x) => x.s >= 4 && (x.info.status === "overdue" || (!cadenceDays(x.c) && x.info.last && -daysFromToday(x.info.last) > 90)))
      .sort((a, b) => (b.info.overdueDays ?? 0) - (a.info.overdueDays ?? 0) || b.s - a.s)
      .slice(0, 8),
    [active]);

  const mix = useMemo(() => {
    const counts = new Map(ITYPES.map((t) => [t.id, 0]));
    let total = 0;
    for (const c of active)
      for (const it of c.interactions || []) {
        if (counts.has(it.type)) counts.set(it.type, counts.get(it.type) + 1);
        total++;
      }
    return { rows: ITYPES.map((t) => ({ label: t.label, value: counts.get(t.id) })).filter((r) => r.value), total };
  }, [active]);

  const patterns = useMemo(() => {
    let inbound = 0, outbound = 0, replied = [], withData = 0;
    for (const c of active) {
      const r = responsePatterns(c);
      if (!r.logged) continue;
      withData++;
      inbound += r.inbound; outbound += r.outbound;
      if (r.medianReplyDays != null) replied.push(r.medianReplyDays);
    }
    replied.sort((a, b) => a - b);
    return {
      withData, inbound, outbound,
      median: replied.length ? replied[Math.floor(replied.length / 2)] : null,
    };
  }, [active]);

  const maxCat = Math.max(1, ...byCategory.map((b) => b.value));
  const maxAdd = Math.max(1, ...added.map((b) => b.value));
  const maxMix = Math.max(1, ...mix.rows.map((b) => b.value));

  return (
    <div className="page">
      <header className="page-head">
        <h1 className="page-title display">Insights</h1>
        <p className="page-sub">{active.length} active {active.length === 1 ? "person" : "people"} · {mix.total} interactions logged</p>
      </header>

      <section className="section" style={{ marginTop: 0 }}>
        <div className="section-head"><h2 className="section-title">Network by category</h2></div>
        <div className="card pcard">
          {byCategory.length === 0 && <p className="li-tip">No categories yet.</p>}
          {byCategory.map((b) => <Bar key={b.label} {...b} max={maxCat} />)}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2 className="section-title">Contacts added</h2><span className="section-count">last 12 months</span></div>
        <div className="card pcard">
          <div className="spark">
            {added.map((m, i) => (
              <div className="spark-col" key={i} title={m.value + " added"}>
                <div className="spark-bar" style={{ height: Math.max(2, Math.round((m.value / maxAdd) * 64)) + "px" }} />
                <span className="spark-label">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">Neglected relationships</h2>
          {neglected.length > 0 && <span className="section-count">{neglected.length}</span>}
        </div>
        <div className="card row-list">
          {neglected.length === 0 && (
            <div className="empty"><Icon n="check" size={26} />
              <div className="display">Nobody important is drifting</div>
              <p>People you rated 4–5 are all within their cadence.</p></div>
          )}
          {neglected.map(({ c, info, s }) => (
            <div className="up-row" key={c.id}>
              <Avatar c={c} size={34} />
              <div className="up-body">
                <div className="up-title"><button onClick={() => openProfile(c.id)}>{c.name}</button></div>
                <div className="up-sub">
                  Strength {s}/5 · last touch {ago(info.last ? -daysFromToday(info.last) : null)}
                </div>
              </div>
              <span className="up-when">
                {info.status === "overdue" ? info.overdueDays + "d over" : "no cadence"}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2 className="section-title">How you keep in touch</h2></div>
        <div className="card pcard">
          {mix.rows.length === 0 && <p className="li-tip">Log an interaction and the mix shows up here.</p>}
          {mix.rows.map((b) => <Bar key={b.label} {...b} max={maxMix} />)}
        </div>
      </section>

      <section className="section">
        <div className="section-head"><h2 className="section-title">Response patterns</h2></div>
        <div className="card pcard">
          {patterns.withData === 0 ? (
            <p className="li-tip">
              Needs direction data, which arrives once Gmail sync is connected — logged emails record
              who reached out first. Manually logged interactions don't carry a direction.
            </p>
          ) : (
            <div className="stat-row">
              <div className="stat"><b>{patterns.outbound}</b><span>you reached out</span></div>
              <div className="stat"><b>{patterns.inbound}</b><span>they reached out</span></div>
              <div className="stat">
                <b>{patterns.median == null ? "—" : patterns.median + "d"}</b>
                <span>typical reply time</span>
              </div>
            </div>
          )}
        </div>
      </section>
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

function csvCell(v) {
  const t = v == null ? "" : String(v);
  return /[",\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

/* Flat, spreadsheet-friendly dump. Timelines are summarized; the JSON
   backup remains the lossless format. */
function contactsToCSV(contacts) {
  const cols = [
    ["Name", (c) => c.name],
    ["Emails", (c) => (c.emails || []).join("; ")],
    ["Phones", (c) => (c.phones || []).join("; ")],
    ["Company", (c) => c.company],
    ["Title", (c) => c.role],
    ["Location", (c) => c.location],
    ["LinkedIn", (c) => c.linkedin],
    ["Categories", (c) => (c.groups || []).join("; ")],
    ["Tags", (c) => (c.tags || []).join("; ")],
    ["Strength", (c) => (c.strength ? String(c.strength) : "")],
    ["Cadence", (c) => cadenceLabel(c)],
    ["Last contacted", (c) => lastContact(c) || ""],
    ["Interactions", (c) => String((c.interactions || []).length)],
    ["How we met", (c) => c.context],
    ["Pronouns", (c) => c.pronouns],
    ["Timezone", (c) => c.timezone],
    ["Preferred contact", (c) => c.preferred],
    ["Key facts", (c) => (c.facts || []).join("; ")],
    ["Birthday", (c) => c.birthday],
    ["Notes", (c) => c.notes],
    ["Archived", (c) => (c.archived ? "yes" : "")],
  ];
  const lines = [cols.map((x) => x[0]).join(",")];
  for (const c of contacts) lines.push(cols.map(([, f]) => csvCell(f(c))).join(","));
  return lines.join("\r\n");
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
    const email = get(idx.email), phone = get(idx.phone);
    if (email) c.emails = [email];
    if (phone) c.phones = [phone];
    c.company = get(idx.company);
    c.role = get(idx.role); c.location = get(idx.location); c.birthday = get(idx.birthday);
    c.notes = get(idx.notes); c.context = get(idx.context);
    c.linkedin = get(idx.url);
    c.connectedOn = get(idx.connected);
    if (c.connectedOn && !c.context) c.context = "Connected on LinkedIn · " + c.connectedOn;
    const tags = get(idx.tags);
    if (tags) c.tags = tags.split(/[;|]|,\s*/).map((t) => t.trim().toLowerCase()).filter(Boolean);
    out.push(c);
  }
  return out;
}

/* ---- import matching ---- */

function normLi(u) {
  return String(u || "").toLowerCase().trim()
    .replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
}

function findImportMatch(contacts, draft) {
  const dl = normLi(draft.linkedin);
  if (dl) {
    const hit = contacts.find((c) => normLi(c.linkedin) === dl);
    if (hit) return hit.id;
  }
  const n = draft.name.trim().toLowerCase().replace(/\s+/g, " ");
  const hit = contacts.find((c) => (c.name || "").trim().toLowerCase().replace(/\s+/g, " ") === n);
  return hit ? hit.id : null;
}

/* ---- cloud sync (talks to /api when the app is served from a host that has one) ---- */

const HTTP = typeof location !== "undefined" && /^https?:$/.test(location.protocol);
const PASS_KEY = KEY + ":pass";
const POLL_MS = (() => {
  try {
    const p = new URLSearchParams(location.search).get("pollms");
    return p ? Math.max(800, +p) : 25000;
  } catch (e) { return 25000; }
})();

async function apiCall(path, opts = {}, pass) {
  try {
    const r = await fetch(path, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (pass || ""),
        ...(opts.headers || {}),
      },
    });
    let json = null;
    try { json = await r.json(); } catch (e) { /* non-JSON (e.g. a 404 page) */ }
    return { status: r.status, json };
  } catch (e) {
    return { status: 0, json: null };
  }
}

/* ============================== app ============================== */

/* Accepts data written by any earlier version: bare-string categories, single
   email/phone strings, and LinkedIn URLs kept as custom fields all migrate. */
function normalizeData(raw) {
  if (!raw || !Array.isArray(raw.contacts)) return null;
  const base = { v: 2, groups: [], rules: [], prefs: { view: "list" } };
  const data = { ...base, ...raw };
  data.groups = normalizeGroups(data.groups);
  data.rules = Array.isArray(data.rules) ? data.rules : [];
  data.prefs = { view: "list", ...(data.prefs || {}) };

  const strList = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.trim()).map((x) => x.trim()) : []);

  data.contacts = data.contacts.filter((c) => c && c.name != null).map((c) => {
    const out = {
      ...blankContact(String(c.name)), ...c,
      id: c.id || uid(),
      tags: Array.isArray(c.tags) ? c.tags : [],
      groups: (Array.isArray(c.groups) ? c.groups : []).map(groupName).filter(Boolean),
      custom: Array.isArray(c.custom) ? c.custom : [],
      reminders: Array.isArray(c.reminders) ? c.reminders : [],
      dates: Array.isArray(c.dates) ? c.dates : [],
      interactions: Array.isArray(c.interactions) ? c.interactions : [],
      cadence: c.cadence && c.cadence.id ? c.cadence : { id: "none", days: null },
      starred: !!c.starred,
      archived: !!c.archived,
      noSuggest: !!c.noSuggest,
      strength: Number.isFinite(+c.strength) ? Math.max(0, Math.min(5, Math.round(+c.strength))) : 0,
      emails: strList(c.emails),
      phones: strList(c.phones),
      lastContactedAt: typeof c.lastContactedAt === "string" ? c.lastContactedAt : "",
      timezone: typeof c.timezone === "string" ? c.timezone : "",
      pronouns: typeof c.pronouns === "string" ? c.pronouns : "",
      preferred: typeof c.preferred === "string" ? c.preferred : "",
      facts: strList(c.facts),
      linkedin: typeof c.linkedin === "string" ? c.linkedin : "",
      connectedOn: typeof c.connectedOn === "string" ? c.connectedOn : "",
    };
    // v1 single-value fields
    if (typeof c.email === "string" && c.email.trim() && !out.emails.includes(c.email.trim()))
      out.emails.unshift(c.email.trim());
    if (typeof c.phone === "string" && c.phone.trim() && !out.phones.includes(c.phone.trim()))
      out.phones.unshift(c.phone.trim());
    delete out.email;
    delete out.phone;
    // v1 kept the LinkedIn URL as a custom field
    if (!out.linkedin) {
      const li = out.custom.find((f) => /linkedin/i.test(f.label || ""));
      if (li && li.value) {
        out.linkedin = li.value;
        out.custom = out.custom.filter((f) => f !== li);
      }
    }
    return out;
  });

  const known = new Set(data.groups.map((g) => g.name));
  for (const c of data.contacts)
    for (const g of c.groups)
      if (!known.has(g)) { known.add(g); data.groups.push({ name: g, color: data.groups.length % 8 }); }
  return data;
}

function App() {
  const [data, setData] = useState(null);
  const [route, setRoute] = useState({ name: "today" });
  const [toastState, setToastState] = useState(null);
  const [mode, setMode] = useState("memory");
  const [exportText, setExportText] = useState(null);
  const [liOpen, setLiOpen] = useState(false);
  const [catsOpen, setCatsOpen] = useState(false);
  const [qcOpen, setQcOpen] = useState(false);
  const [qcText, setQcText] = useState("");
  const [qcDraft, setQcDraft] = useState(null);
  const [mergePair, setMergePair] = useState(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [review, setReview] = useState(null);
  const [impGroup, setImpGroup] = useState("");
  const [impTag, setImpTag] = useState("");
  const [impMode, setImpMode] = useState("new");
  const [impRules, setImpRules] = useState(true);
  const jsonRef = useRef(null);
  const csvRef = useRef(null);
  const toastTimer = useRef(null);

  const toast = useCallback((msg) => {
    setToastState({ msg });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastState(null), 2600);
  }, []);

  /* ---- cloud sync state ---- */
  const [syncState, setSyncState] = useState(HTTP ? "probing" : "off");
  const [passDraft, setPassDraft] = useState("");
  const passRef = useRef(null);
  const versionRef = useRef(0);
  const skipPushRef = useRef(false);
  const pendingPushRef = useRef(false);
  const pushTimer = useRef(null);
  const dataRef = useRef(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  const pushRemote = useCallback(async (doc, retried) => {
    const { status, json } = await apiCall("api/data", {
      method: "PUT",
      body: JSON.stringify({ version: versionRef.current, doc }),
    }, passRef.current);
    pendingPushRef.current = false;
    if (status === 200 && json && typeof json.version === "number") {
      versionRef.current = json.version;
      setSyncState("synced");
    } else if (status === 409 && json && typeof json.version === "number" && !retried) {
      versionRef.current = json.version; // last write wins from the active device
      pendingPushRef.current = true;
      return pushRemote(doc, true);
    } else if (status === 401) setSyncState("badpass");
    else setSyncState("error");
  }, []);

  const probeSync = useCallback(async (pass, bootDoc) => {
    if (!HTTP) return;
    setSyncState("probing");
    const { status, json } = await apiCall("api/data", {}, pass || "");
    if (status === 401) setSyncState(pass ? "badpass" : "needpass");
    else if (status === 503) setSyncState("unconfigured");
    else if (status === 200 && json && typeof json.version === "number") {
      if (json.doc) {
        const parsed = normalizeData(json.doc);
        versionRef.current = json.version;
        if (parsed) { skipPushRef.current = true; setData(parsed); }
      } else {
        versionRef.current = json.version;
        const seed = bootDoc || dataRef.current;
        if (seed) { pendingPushRef.current = true; pushRemote(seed); }
      }
      setSyncState("synced");
    } else setSyncState("off");
  }, [pushRemote]);

  const connectSync = useCallback((pass) => {
    const p = pass.trim();
    if (!p) return;
    passRef.current = p;
    try { localStorage.setItem(PASS_KEY, p); } catch (e) { /* memory-only */ }
    setPassDraft("");
    probeSync(p);
  }, [probeSync]);

  /* ---- daily push reminders (PWA) ---- */
  const PUSH_SUPPORTED = HTTP && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  const [pushState, setPushState] = useState("idle");

  useEffect(() => {
    if (!HTTP || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("sw.js").then(async (reg) => {
      try {
        const sub = await reg.pushManager.getSubscription();
        if (sub) setPushState("on");
        else if (Notification.permission === "denied") setPushState("denied");
      } catch (e) { /* stays idle */ }
    }).catch(() => { /* no sw.js on this host (e.g. artifact) */ });
  }, []);

  const enablePush = useCallback(async () => {
    setPushState("busy");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setPushState(perm === "denied" ? "denied" : "idle"); return; }
      const { status, json } = await apiCall("api/push", {}, passRef.current);
      if (status !== 200 || !json || !json.publicKey) throw new Error("no vapid key");
      const raw = atob(json.publicKey.replace(/-/g, "+").replace(/_/g, "/"));
      const key = new Uint8Array([...raw].map((ch) => ch.charCodeAt(0)));
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const saved = await apiCall("api/push", { method: "POST", body: JSON.stringify({ subscription: sub.toJSON() }) }, passRef.current);
      if (saved.status !== 200) throw new Error("save failed");
      setPushState("on");
      toast("Daily reminders on — one morning nudge when someone's due");
    } catch (e) {
      setPushState("error");
    }
  }, [toast]);

  const disablePush = useCallback(async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiCall("api/push", { method: "DELETE", body: JSON.stringify({ endpoint: sub.endpoint }) }, passRef.current);
        await sub.unsubscribe();
      }
    } catch (e) { /* best effort */ }
    setPushState("idle");
    toast("Daily reminders off");
  }, [toast]);

  /* poll for remote changes + extension captures */
  useEffect(() => {
    if (syncState !== "synced") return;
    const id = setInterval(async () => {
      if (pendingPushRef.current || document.hidden) return;
      const { status, json } = await apiCall("api/data", {}, passRef.current);
      if (status === 200 && json && json.version > versionRef.current && json.doc) {
        const parsed = normalizeData(json.doc);
        if (parsed && !pendingPushRef.current) {
          versionRef.current = json.version;
          skipPushRef.current = true;
          setData(parsed);
        }
      } else if (status === 401) setSyncState("badpass");
    }, POLL_MS);
    return () => clearInterval(id);
  }, [syncState]);


  /* load */
  useEffect(() => {
    let alive = true;
    (async () => {
      const raw = await detectAndLoad();
      if (!alive) return;
      setMode(storageMode);
      let parsed = null;
      if (raw) { try { parsed = normalizeData(JSON.parse(raw)); } catch (e) { /* corrupted — reseed */ } }
      const boot = parsed || seedData();
      setData(boot);
      let pass = null;
      try { pass = localStorage.getItem(PASS_KEY); } catch (e) { /* unavailable */ }
      passRef.current = pass;
      probeSync(pass, boot);
    })();
    return () => { alive = false; };
  }, []);

  /* save (debounced) */
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!data) return;
    if (!loadedRef.current) { loadedRef.current = true; persist(JSON.stringify(data)); return; }
    const t = setTimeout(() => persist(JSON.stringify(data)), 300);
    // Remote push, unless this change *came from* the server (skipPushRef).
    if (skipPushRef.current) skipPushRef.current = false;
    else if (syncState === "synced" || syncState === "error") {
      pendingPushRef.current = true;
      clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(() => pushRemote(data), 800);
    }
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
    const name = String(g || "").trim();
    if (!name) return;
    setData((d) => (d.groups.some((x) => x.name === name)
      ? d
      : { ...d, groups: [...d.groups, { name, color: d.groups.length % 8 }] }));
  }, []);

  /* ---- categories ---- */
  const renameGroup = useCallback((oldName, nextName) => {
    const name = String(nextName || "").trim();
    if (!name || name === oldName) return;
    setData((d) => {
      if (d.groups.some((g) => g.name === name)) return d;
      return {
        ...d,
        groups: d.groups.map((g) => (g.name === oldName ? { ...g, name } : g)),
        contacts: d.contacts.map((c) => (c.groups || []).includes(oldName)
          ? { ...c, groups: c.groups.map((x) => (x === oldName ? name : x)) } : c),
        rules: (d.rules || []).map((r) => (r.group === oldName ? { ...r, group: name } : r)),
      };
    });
  }, []);

  const recolorGroup = useCallback((name, color) => {
    setData((d) => ({ ...d, groups: d.groups.map((g) => (g.name === name ? { ...g, color } : g)) }));
  }, []);

  const deleteGroup = useCallback((name) => {
    setData((d) => ({
      ...d,
      groups: d.groups.filter((g) => g.name !== name),
      contacts: d.contacts.map((c) => (c.groups || []).includes(name)
        ? { ...c, groups: c.groups.filter((x) => x !== name) } : c),
      rules: (d.rules || []).filter((r) => r.group !== name),
    }));
    toast("Removed category " + name);
  }, [toast]);

  /* ---- auto-categorization rules ---- */
  const saveRule = useCallback((rule) => {
    setData((d) => {
      const exists = (d.rules || []).some((r) => r.id === rule.id);
      const rules = exists
        ? d.rules.map((r) => (r.id === rule.id ? rule : r))
        : [...(d.rules || []), rule];
      const groups = rule.group && !d.groups.some((g) => g.name === rule.group)
        ? [...d.groups, { name: rule.group, color: d.groups.length % 8 }]
        : d.groups;
      return { ...d, rules, groups };
    });
  }, []);

  const deleteRule = useCallback((id) => {
    setData((d) => ({ ...d, rules: (d.rules || []).filter((r) => r.id !== id) }));
  }, []);

  /* Apply every rule across the book; only ever adds, never removes. */
  const runRules = useCallback(() => {
    let touched = 0;
    setData((d) => {
      const contactsNext = d.contacts.map((c) => {
        if (c.archived) return c;
        const auto = suggestFromRules(c, d.rules);
        const addG = auto.groups.filter((g) => !(c.groups || []).includes(g));
        const addT = auto.tags.filter((t) => !(c.tags || []).includes(t));
        if (!addG.length && !addT.length) return c;
        touched++;
        return { ...c, sample: false, groups: [...(c.groups || []), ...addG], tags: [...(c.tags || []), ...addT] };
      });
      let groups = d.groups;
      for (const r of d.rules || [])
        if (r.group && !groups.some((g) => g.name === r.group))
          groups = [...groups, { name: r.group, color: groups.length % 8 }];
      return { ...d, contacts: contactsNext, groups };
    });
    setTimeout(() => toast(touched ? "Categorized " + touched + " " + (touched === 1 ? "person" : "people") : "No new matches — everyone already filed"), 0);
  }, [toast]);

  const acceptSuggest = useCallback((id, cadId) => {
    const def = CADENCES.find((x) => x.id === cadId);
    updateContact(id, { cadence: { id: cadId, days: def ? def.days : null } });
    const c = contacts.find((x) => x.id === id);
    toast((c ? c.name : "Contact") + " set to " + (def ? def.label.toLowerCase() : cadId));
  }, [contacts, updateContact, toast]);

  const dismissSuggest = useCallback((id) => {
    updateContact(id, { noSuggest: true });
  }, [updateContact]);

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

  const runQuickCapture = () => {
    const parsed = parseQuickCapture(qcText);
    if (!parsed) { toast("Couldn't find a name in that — try \"met Jane, VP Eng at Acme\""); return; }
    const draft = blankContact(parsed.name);
    for (const k of ["role", "company", "location", "context", "linkedin", "notes"])
      if (parsed[k]) draft[k] = parsed[k];
    draft.emails = parsed.emails || [];
    draft.phones = parsed.phones || [];
    const auto = suggestFromRules(draft, data.rules);
    draft.groups = auto.groups;
    draft.tags = auto.tags;
    setQcDraft(draft);
  };

  const saveQuickCapture = () => {
    if (!qcDraft) return;
    const c = { ...qcDraft, name: qcDraft.name.trim() };
    if (!c.name) { toast("Give them a name first"); return; }
    setData((d) => {
      let groups = d.groups;
      for (const g of c.groups || [])
        if (!groups.some((x) => x.name === g)) groups = [...groups, { name: g, color: groups.length % 8 }];
      return { ...d, contacts: [...d.contacts, c], groups };
    });
    setQcOpen(false); setQcText(""); setQcDraft(null);
    setRoute({ name: "profile", id: c.id, from: "people" });
    toast("Added " + c.name);
  };

  const [dupOpen, setDupOpen] = useState(false);
  const dupGroups = useMemo(() => (dupOpen ? findDuplicates(contacts) : []), [dupOpen, contacts]);
  const dupCount = useMemo(() => findDuplicates(contacts).length, [contacts]);

  /* Field-level merge: `picks` maps field -> which contact id wins. */
  const mergeWithPicks = useCallback((leftId, rightId, picks, keepId) => {
    setData((d) => {
      const L = d.contacts.find((c) => c.id === leftId);
      const R = d.contacts.find((c) => c.id === rightId);
      if (!L || !R) return d;
      const keep = keepId === rightId ? R : L;
      const other = keep === L ? R : L;
      const merged = { ...keep, sample: false };
      for (const [field, winnerId] of Object.entries(picks)) {
        const src = winnerId === leftId ? L : R;
        merged[field] = src[field];
      }
      // Collections always union — you never want to lose history.
      merged.emails = [...new Set([...(L.emails || []), ...(R.emails || [])])];
      merged.phones = [...new Set([...(L.phones || []), ...(R.phones || [])])];
      merged.tags = [...new Set([...(L.tags || []), ...(R.tags || [])])];
      merged.groups = [...new Set([...(L.groups || []), ...(R.groups || [])])];
      merged.facts = [...new Set([...(L.facts || []), ...(R.facts || [])])];
      merged.custom = [...(keep.custom || []), ...(other.custom || []).filter(
        (cf) => !(keep.custom || []).some((k) => k.label === cf.label && k.value === cf.value))];
      merged.reminders = [...(L.reminders || []), ...(R.reminders || [])];
      merged.dates = [...(L.dates || []), ...(R.dates || [])];
      const seen = new Set();
      merged.interactions = [...(L.interactions || []), ...(R.interactions || [])].filter((it) => {
        const k = it.id || (it.date + "|" + it.type + "|" + (it.text || ""));
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      merged.strength = Math.max(L.strength || 0, R.strength || 0);
      merged.starred = L.starred || R.starred;
      return { ...d, contacts: d.contacts.filter((c) => c.id !== other.id).map((c) => (c.id === merged.id ? merged : c)) };
    });
    setMergePair(null);
    toast("Merged into one record");
  }, [toast]);

  const mergeContacts = useCallback((ids) => {
    setData((d) => {
      const group = d.contacts.filter((c) => ids.includes(c.id));
      if (group.length < 2) return d;
      const target = group.reduce((a, b) =>
        (b.interactions || []).length > (a.interactions || []).length ? b : a);
      const merged = { ...target, sample: false };
      for (const r of group) {
        if (r.id === target.id) continue;
        for (const k of ["context", "company", "role", "location", "birthday", "photo", "linkedin", "connectedOn"])
          if (!merged[k]) merged[k] = r[k];
        for (const k of ["emails", "phones"])
          merged[k] = [...new Set([...(merged[k] || []), ...(r[k] || [])])];
        merged.strength = Math.max(merged.strength || 0, r.strength || 0);
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
  const doExport = async (kind = "json") => {
    const payload = kind === "csv"
      ? contactsToCSV(data.contacts)
      : JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
    const filename = "hearth-" + (kind === "csv" ? "contacts-" : "backup-") + iso(todayMid()) + "." + kind;
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
      a.href = URL.createObjectURL(new Blob([payload], { type: kind === "csv" ? "text/csv" : "application/json" }));
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

  const openReview = useCallback((drafts, source) => {
    const items = drafts.map((draft) => ({
      draft, matchId: findImportMatch(contacts, draft), selected: true,
    }));
    setImpGroup("");
    setImpTag("");
    setImpMode("new");
    setReview({ source, items });
    setLiOpen(true);
  }, [contacts]);

  const onCSVFile = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    const r = new FileReader();
    r.onload = () => {
      const drafts = contactsFromCSV(String(r.result));
      if (!drafts.length) { toast("No contacts found — use a CSV with a name column, or LinkedIn's Connections.csv"); return; }
      openReview(drafts, "csv");
    };
    r.readAsText(file);
  };

  /* An import row actually lands only if it is ticked and not skipped by
     "add new only" mode. */
  const importable = review
    ? review.items.filter((it) => it.selected && !(impMode === "new" && it.matchId))
    : [];
  const newCount = review ? review.items.filter((it) => !it.matchId).length : 0;
  const matchCount = review ? review.items.filter((it) => it.matchId).length : 0;
  const willImport = importable.length;

  const applyImport = () => {
    if (!review) return;
    const group = impGroup.trim();
    const tag = impTag.trim().toLowerCase();
    const rules = impRules ? data.rules : [];
    const chosen = importable;
    const updated = chosen.filter((i) => i.matchId).length;
    const added = chosen.length - updated;
    const usedGroups = new Set();

    const decorate = (target, draft) => {
      const auto = suggestFromRules(draft, rules);
      const groupsToAdd = [...auto.groups, ...(group ? [group] : [])];
      const tagsToAdd = [...auto.tags, ...(tag ? [tag] : [])];
      for (const g of groupsToAdd) usedGroups.add(g);
      target.groups = [...new Set([...(target.groups || []), ...groupsToAdd])];
      target.tags = [...new Set([...(target.tags || []), ...tagsToAdd])];
    };

    setData((d) => {
      let list = [...d.contacts];
      for (const it of chosen) {
        if (it.matchId && list.some((c) => c.id === it.matchId)) {
          list = list.map((c) => {
            if (c.id !== it.matchId) return c;
            const m = { ...c, sample: false };
            // Fill blanks only — never overwrite something you have already curated.
            for (const k of ["company", "role", "location", "context", "birthday", "linkedin", "connectedOn"])
              if (!m[k] && it.draft[k]) m[k] = it.draft[k];
            for (const k of ["emails", "phones"])
              m[k] = [...new Set([...(m[k] || []), ...(it.draft[k] || [])])];
            for (const t of it.draft.tags || []) m.tags = [...new Set([...(m.tags || []), t])];
            decorate(m, it.draft);
            return m;
          });
        } else {
          const c = { ...it.draft };
          decorate(c, it.draft);
          list.push(c);
        }
      }
      let groups = d.groups;
      for (const g of usedGroups)
        if (!groups.some((x) => x.name === g)) groups = [...groups, { name: g, color: groups.length % 8 }];
      return { ...d, contacts: list, groups };
    });
    setReview(null);
    setLiOpen(false);
    setRoute({ name: "people", show: added && !updated ? "uncategorized" : "active" });
    toast("Imported " + added + " new" + (updated ? ", updated " + updated + " existing" : "")
      + (review.items.length - chosen.length ? " · " + (review.items.length - chosen.length) + " skipped" : ""));
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
          <button className={"nav-btn" + (route.name === "insights" ? " on" : "")}
            onClick={() => setRoute({ name: "insights" })}>
            <Icon n="chart" size={17} />Insights
          </button>
        </nav>
        <div className="rail-spacer" />
        {HTTP && syncState !== "off" && (
          <div className="rail-sync">
            {syncState === "synced" && <div className="sync-line ok"><span className="dot" />Synced · shared workspace</div>}
            {syncState === "probing" && <div className="sync-line"><span className="dot wait" />Checking sync…</div>}
            {syncState === "error" && <div className="sync-line err"><span className="dot" />Sync hiccup — retrying on next change</div>}
            {syncState === "unconfigured" && (
              <div className="sync-line">Sync server needs a HEARTH_PASSPHRASE env var</div>
            )}
            {syncState === "synced" && PUSH_SUPPORTED && (
              <div className="sync-line push-line">
                <Icon n="bell" size={13} />
                {pushState === "on" ? (
                  <>Daily reminders on<button className="push-off" onClick={disablePush}>turn off</button></>
                ) : pushState === "denied" ? (
                  <span>Notifications blocked in browser settings</span>
                ) : pushState === "error" ? (
                  <>Couldn't enable<button className="push-off" onClick={enablePush}>retry</button></>
                ) : (
                  <button className="push-on" onClick={enablePush} disabled={pushState === "busy"}>
                    {pushState === "busy" ? "Enabling…" : "Enable daily reminders"}
                  </button>
                )}
              </div>
            )}
            {(syncState === "needpass" || syncState === "badpass") && (
              <form onSubmit={(e) => { e.preventDefault(); connectSync(passDraft); }}>
                <div className={"sync-line" + (syncState === "badpass" ? " err" : "")}>
                  {syncState === "badpass" ? "Wrong passphrase — try again" : "Enter the workspace passphrase to sync"}
                </div>
                <input type="password" className="sync-pass" placeholder="Workspace passphrase"
                  value={passDraft} onChange={(e) => setPassDraft(e.target.value)} />
                <button className="btn primary sm" type="submit" disabled={!passDraft.trim()}>Connect</button>
              </form>
            )}
          </div>
        )}
        <div className="rail-stats">
          <div className="rail-stat"><span>In your circle</span><b>{stats.total}</b></div>
          <div className="rail-stat"><span>Overdue</span><b className={stats.overdue ? "hot" : ""}>{stats.overdue}</b></div>
          {stats.longest && (
            <div className="rail-stat"><span>Quietest: {stats.longest.name}</span><b>{ago(stats.longest.days)}</b></div>
          )}
        </div>
        <div className="rail-tools">
          <button className="rail-tool" onClick={() => { setQcOpen(true); setQcDraft(null); }}>
            <Icon n="bolt" size={15} /><span>Quick capture</span>
          </button>
          <button className="rail-tool" onClick={() => setCatsOpen(true)}>
            <Icon n="tag" size={15} /><span>Categories</span>
          </button>
          <button className="rail-tool" onClick={() => setRulesOpen(true)}>
            <Icon n="wand" size={15} /><span>Auto-categorize rules</span>
          </button>
          <button className="rail-tool" onClick={() => doExport("json")}><Icon n="download" size={15} /><span>Export backup (JSON)</span></button>
          <button className="rail-tool" onClick={() => doExport("csv")}><Icon n="download" size={15} /><span>Export contacts (CSV)</span></button>
          <button className="rail-tool" onClick={() => jsonRef.current && jsonRef.current.click()}><Icon n="upload" size={15} /><span>Restore JSON</span></button>
          <button className="rail-tool" onClick={() => { setReview(null); setLiOpen(true); }}><Icon n="users" size={15} /><span>LinkedIn / CSV import</span></button>
          <button className="rail-tool" onClick={() => setDupOpen(true)}>
            <Icon n="merge" size={15} /><span>Merge duplicates</span>
            {dupCount > 0 && <span className="nav-badge" style={{ marginLeft: "auto" }}>{dupCount}</span>}
          </button>
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
          <TodayView contacts={contacts.filter((c) => !c.archived)} groups={data.groups}
            openProfile={(id) => setRoute({ name: "profile", id, from: "today" })}
            logInteraction={logInteraction} snooze={snooze} completeReminder={completeReminder}
            acceptSuggest={acceptSuggest} dismissSuggest={dismissSuggest}
            openPeople={(show) => setRoute({ name: "people", show })} />
        )}
        {route.name === "people" && (
          <PeopleView contacts={contacts} groups={data.groups} prefs={data.prefs}
            setPrefs={(p) => setData((d) => ({ ...d, prefs: { ...d.prefs, ...p } }))}
            openProfile={(id) => setRoute({ name: "profile", id, from: "people" })}
            addContact={addContact} focusSignal={route.focus} initialShow={route.show}
            toggleStar={toggleStar} bulkApply={bulkApply} />
        )}
        {route.name === "insights" && (
          <InsightsView contacts={contacts} groups={data.groups}
            openProfile={(id) => setRoute({ name: "profile", id, from: "insights" })} />
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

      {liOpen && !review && (
        <div className="overlay" onClick={() => setLiOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Import from LinkedIn</h3>
            <p>
              Hearth imports from LinkedIn's own data export — no scraping, no signing in on your
              behalf, nothing that can get your account flagged.
            </p>
            <ol className="li-steps">
              <li>On LinkedIn: <b>Settings &amp; Privacy → Data privacy → Get a copy of your data</b>.</li>
              <li>Choose <b>Want something in particular?</b> and tick <b>Connections</b>. Request the archive.</li>
              <li>LinkedIn emails you a download link (usually ~10 minutes). Unzip it to find <b>Connections.csv</b>.</li>
              <li>Drop that file in below. You'll get a review screen before anything is saved.</li>
            </ol>
            <div className="li-actions">
              <button className="btn primary sm" onClick={() => csvRef.current && csvRef.current.click()}>
                <Icon n="upload" size={14} />Choose Connections.csv…
              </button>
            </div>
            <p className="li-tip">
              Re-importing later is safe and expected: matches are found by LinkedIn URL first, then by
              name, so a fresh export adds only the people you've met since. Any CSV with a
              <b> name</b> column works too — Google Contacts, a spreadsheet, anything.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => setLiOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {liOpen && review && (
        <div className="overlay" onClick={() => { setReview(null); setLiOpen(false); }}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>Review import</h3>
            <p>
              Found <b>{review.items.length}</b> rows · <b>{newCount}</b> new ·{" "}
              <b>{matchCount}</b> already in Hearth.
            </p>
            <div className="li-modes">
              <button className={"type-chip" + (impMode === "new" ? " on" : "")}
                onClick={() => setImpMode("new")}>Add new only</button>
              <button className={"type-chip" + (impMode === "both" ? " on" : "")}
                onClick={() => setImpMode("both")}>Add new + update existing</button>
            </div>
            <div className="li-options">
              <input className="bulk-input" style={{ width: 150 }} list="import-groups" value={impGroup}
                placeholder="Add all to category…" onChange={(e) => setImpGroup(e.target.value)} />
              <datalist id="import-groups">
                {data.groups.map((g) => <option key={g.name} value={g.name} />)}
              </datalist>
              <input className="bulk-input" style={{ width: 110 }} value={impTag}
                placeholder="Apply tag…" onChange={(e) => setImpTag(e.target.value)} />
              <label className="li-check">
                <input type="checkbox" checked={impRules}
                  onChange={(e) => setImpRules(e.target.checked)} />
                Auto-categorize with my rules
              </label>
            </div>
            <div className="li-review">
              {review.items.map((it, i) => {
                const skipped = impMode === "new" && it.matchId;
                const auto = impRules ? suggestFromRules(it.draft, data.rules) : { groups: [], tags: [] };
                return (
                  <label className={"li-item" + (skipped ? " skipped" : "")} key={i}>
                    <input type="checkbox" className="row-check" checked={it.selected && !skipped}
                      disabled={skipped}
                      onChange={() => setReview((r) => ({
                        ...r,
                        items: r.items.map((x, j) => (j === i ? { ...x, selected: !x.selected } : x)),
                      }))} />
                    <Avatar c={it.draft} size={32} />
                    <span className="li-who">
                      <b>{it.draft.name}</b>
                      <span>{[it.draft.role, it.draft.company, it.draft.location].filter(Boolean).join(" · ") || it.draft.context || "—"}</span>
                    </span>
                    {auto.groups.map((g) => (
                      <span key={g} className={"chip gc-" + colorOf(data.groups, g)}>{g}</span>
                    ))}
                    {it.matchId && (
                      <span className={"pill " + (skipped ? "none" : "ok")}>
                        {skipped ? "skipped" : "updates existing"}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
            <div className="modal-actions">
              <button className="btn ghost sm" onClick={() => setReview((r) => ({
                ...r, items: r.items.map((x) => ({ ...x, selected: !r.items.every((y) => y.selected) })),
              }))}>Toggle all</button>
              <button className="btn" onClick={() => setReview(null)}>Back</button>
              <button className="btn primary" disabled={!willImport}
                onClick={applyImport}>
                Import {willImport}
              </button>
            </div>
          </div>
        </div>
      )}

      {qcOpen && (
        <div className="overlay" onClick={() => setQcOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Quick capture</h3>
            {!qcDraft ? (
              <>
                <p>Paste or type what you'd scribble on a napkin. Nothing is saved until you confirm.</p>
                <textarea className="li-paste" rows={3} value={qcText} autoFocus
                  placeholder="met Jane, VP Eng at Acme, referred by Sam"
                  onChange={(e) => setQcText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runQuickCapture(); }} />
                <div className="modal-actions">
                  <button className="btn" onClick={() => setQcOpen(false)}>Cancel</button>
                  <button className="btn primary" disabled={!qcText.trim()} onClick={runQuickCapture}>Parse it</button>
                </div>
              </>
            ) : (
              <>
                <p>Here's what I read. Fix anything, then save.</p>
                <div className="qc-grid">
                  {[
                    ["name", "Name"], ["role", "Title"], ["company", "Company"],
                    ["location", "Location"], ["context", "How we met"],
                  ].map(([k, label]) => (
                    <label className="qc-field" key={k}>
                      <span>{label}</span>
                      <input value={qcDraft[k] || ""} onChange={(e) => setQcDraft({ ...qcDraft, [k]: e.target.value })} />
                    </label>
                  ))}
                  <label className="qc-field">
                    <span>Email</span>
                    <input value={(qcDraft.emails || []).join(", ")}
                      onChange={(e) => setQcDraft({ ...qcDraft, emails: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                  </label>
                  <label className="qc-field">
                    <span>Phone</span>
                    <input value={(qcDraft.phones || []).join(", ")}
                      onChange={(e) => setQcDraft({ ...qcDraft, phones: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                  </label>
                </div>
                {qcDraft.notes && <p className="li-tip">Notes: {qcDraft.notes}</p>}
                {(qcDraft.groups || []).length > 0 && (
                  <div className="chip-row" style={{ marginTop: 10 }}>
                    <span className="rule-word">rules suggest</span>
                    {qcDraft.groups.map((g) => <span key={g} className={"chip gc-" + colorOf(data.groups, g)}>{g}</span>)}
                  </div>
                )}
                <div className="modal-actions">
                  <button className="btn" onClick={() => setQcDraft(null)}>Back</button>
                  <button className="btn primary" onClick={saveQuickCapture}>Save person</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {mergePair && (() => {
        const L = contacts.find((c) => c.id === mergePair.left);
        const R = contacts.find((c) => c.id === mergePair.right);
        if (!L || !R) return null;
        const FIELDS = [
          ["name", "Name"], ["company", "Company"], ["role", "Title"], ["location", "Location"],
          ["context", "How we met"], ["birthday", "Birthday"], ["linkedin", "LinkedIn"],
          ["photo", "Photo"], ["notes", "Notes"], ["cadence", "Cadence"],
        ];
        const show = (c, k) => {
          if (k === "cadence") return cadenceLabel(c) || "none";
          if (k === "photo") return c.photo ? "yes" : "—";
          return c[k] || "—";
        };
        return (
          <div className="overlay" onClick={() => setMergePair(null)}>
            <div className="modal wide" onClick={(e) => e.stopPropagation()}>
              <h3>Merge two records</h3>
              <p>
                Pick the winner for each field. Emails, phones, tags, categories, key facts, and
                both timelines are always combined — nothing is discarded.
              </p>
              <div className="merge-grid">
                <div className="merge-head" />
                <div className="merge-head"><Avatar c={L} size={26} />{L.name}</div>
                <div className="merge-head"><Avatar c={R} size={26} />{R.name}</div>
                {FIELDS.map(([k, label]) => {
                  const same = show(L, k) === show(R, k);
                  return (
                    <React.Fragment key={k}>
                      <div className={"merge-key" + (same ? " same" : "")}>{label}</div>
                      {[L, R].map((c) => (
                        <label key={c.id} className={"merge-cell" + (mergePair.picks[k] === c.id ? " on" : "") + (same ? " same" : "")}>
                          <input type="radio" name={"m-" + k} checked={mergePair.picks[k] === c.id}
                            onChange={() => setMergePair({ ...mergePair, picks: { ...mergePair.picks, [k]: c.id } })} />
                          <span>{String(show(c, k)).slice(0, 90)}</span>
                        </label>
                      ))}
                    </React.Fragment>
                  );
                })}
              </div>
              <div className="merge-note">
                <b>{L.interactions.length + R.interactions.length}</b> interactions and{" "}
                <b>{new Set([...(L.emails || []), ...(R.emails || [])]).size}</b> email addresses will be kept.
              </div>
              <div className="modal-actions">
                <button className="btn" onClick={() => setMergePair(null)}>Cancel</button>
                <button className="btn primary"
                  onClick={() => mergeWithPicks(L.id, R.id, mergePair.picks, mergePair.picks.name || L.id)}>
                  Merge
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {catsOpen && (
        <div className="overlay" onClick={() => setCatsOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Categories</h3>
            <p>Rename, recolor, or remove. Renaming updates everyone already filed under it.</p>
            <div className="cat-list">
              {data.groups.map((g) => (
                <CategoryRow key={g.name} group={g} count={contacts.filter((c) => (c.groups || []).includes(g.name)).length}
                  onRename={(n) => renameGroup(g.name, n)} onRecolor={(col) => recolorGroup(g.name, col)}
                  onDelete={() => deleteGroup(g.name)} />
              ))}
              {data.groups.length === 0 && <p className="li-tip">No categories yet — add one below.</p>}
            </div>
            <form className="rem-add" onSubmit={(e) => {
              e.preventDefault();
              const v = e.target.elements.newcat.value.trim();
              if (v) { addGroup(v); e.target.reset(); }
            }}>
              <input type="text" name="newcat" placeholder="New category…" />
              <button className="btn sm" type="submit">Add</button>
            </form>
            <div className="modal-actions">
              <button className="btn primary" onClick={() => setCatsOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

      {rulesOpen && (
        <div className="overlay" onClick={() => setRulesOpen(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>Auto-categorize rules</h3>
            <p>
              When a company or title contains one of your keywords, the person gets that category.
              Rules run on import (when the box is ticked) and whenever you hit <b>Run on everyone</b>.
            </p>
            <div className="rule-list">
              {(data.rules || []).map((r) => (
                <RuleRow key={r.id} rule={r} groups={data.groups} contacts={contacts}
                  onSave={saveRule} onDelete={() => deleteRule(r.id)} />
              ))}
              {(data.rules || []).length === 0 && <p className="li-tip">No rules yet.</p>}
            </div>
            <div className="modal-actions">
              <button className="btn sm" onClick={() => saveRule({
                id: uid(), keywords: "", field: "any", group: data.groups[0] ? data.groups[0].name : "Work", tag: "",
              })}>
                <Icon n="plus" size={13} />Add rule
              </button>
              <button className="btn sm" onClick={runRules}><Icon n="wand" size={13} />Run on everyone</button>
              <button className="btn primary" onClick={() => setRulesOpen(false)}>Done</button>
            </div>
          </div>
        </div>
      )}

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
                <div className="li-actions">
                  {ids.length === 2 && (
                    <button className="btn sm" onClick={() => {
                      setDupOpen(false);
                      setMergePair({ left: ids[0], right: ids[1], picks: Object.fromEntries(
                        ["name", "company", "role", "location", "context", "birthday", "linkedin", "photo", "notes", "cadence"]
                          .map((k) => [k, ids[0]])) });
                    }}>Review field by field</button>
                  )}
                  <button className="btn primary sm" onClick={() => mergeContacts(ids)}>
                    <Icon n="merge" size={13} />Merge {ids.length}
                  </button>
                </div>
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
