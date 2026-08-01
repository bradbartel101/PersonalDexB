/* Pure email/event -> person matching. No I/O, no DOM: shared by the sync
   worker (api/gsync.js) and unit-tested directly by matchtest.mjs. */

/* Domains where the local part identifies a person, not an organization —
   so two @gmail.com addresses tell us nothing about each other. */
export const CONSUMER_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "pm.me", "hey.com", "fastmail.com",
  "gmx.com", "zoho.com", "mail.com", "yandex.com", "qq.com", "163.com",
]);

/* Mail that should never become an Interaction. */
const NOREPLY = /^(no[-._]?reply|do[-._]?not[-._]?reply|donotreply|notifications?|alerts?|mailer[-_]?daemon|postmaster|bounce|receipts?|billing|support|help|info|hello|team|news(letter)?|updates?|digest|via)([-._+]|$)/i;
const BULK_DOMAIN = /(^|\.)(mailchimp|sendgrid|mailgun|substack|beehiiv|intercom|zendesk|atlassian|slack|notion|asana|linear|github|gitlab|calendly|docusign|stripe|squareup|paypal|amazonses|salesforce|hubspot|marketo)\.(com|net|io|so|app)$/i;

export function splitEmail(addr) {
  const m = String(addr || "").trim().toLowerCase().match(/^[^@\s]+@[^@\s]+$/) ? String(addr).trim().toLowerCase() : "";
  if (!m) return null;
  const at = m.lastIndexOf("@");
  return { local: m.slice(0, at), domain: m.slice(at + 1) };
}

/* Canonical form for comparison: strips +tags everywhere and dots on Gmail,
   so jane+crm@gmail.com and j.ane@gmail.com both match jane@gmail.com. */
export function normEmail(addr) {
  const p = splitEmail(addr);
  if (!p) return "";
  let { local, domain } = p;
  if (domain === "googlemail.com") domain = "gmail.com";
  local = local.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return local + "@" + domain;
}

/* "Jane Doe <jane@acme.com>" -> {name, email}; also accepts a bare address. */
export function parseAddress(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;
  const angled = s.match(/^\s*(?:"([^"]*)"|([^<]*?))\s*<([^>]+)>\s*$/);
  const email = angled ? angled[3].trim() : s;
  if (!splitEmail(email)) return null;
  const name = angled ? (angled[1] || angled[2] || "").trim().replace(/\s+/g, " ") : "";
  return { name, email: email.trim().toLowerCase() };
}

export function isNoReply(addr) {
  const p = splitEmail(addr);
  if (!p) return true;
  if (NOREPLY.test(p.local)) return true;
  if (BULK_DOMAIN.test(p.domain)) return true;
  return false;
}

export function isConsumerDomain(domain) {
  return CONSUMER_DOMAINS.has(String(domain || "").toLowerCase());
}

/* Index contacts once, then match many addresses against it. */
export function buildIndex(contacts) {
  const byEmail = new Map();
  const byName = new Map();
  for (const c of contacts || []) {
    for (const e of c.emails || []) {
      const k = normEmail(e);
      if (k && !byEmail.has(k)) byEmail.set(k, c.id);
    }
    const n = String(c.name || "").trim().toLowerCase().replace(/\s+/g, " ");
    if (n && !byName.has(n)) byName.set(n, c.id);
  }
  return { byEmail, byName };
}

/**
 * Match one address to a person.
 * Confidence: "email" (exact address) > "name" (display name, corporate
 * domain only). Never guesses from a shared consumer domain, and never
 * matches no-reply/bulk senders.
 */
export function matchAddress(index, raw, opts = {}) {
  const addr = parseAddress(raw);
  if (!addr) return null;
  if (!opts.allowNoReply && isNoReply(addr.email)) return null;

  const key = normEmail(addr.email);
  const hit = index.byEmail.get(key);
  if (hit) return { id: hit, via: "email", email: addr.email, name: addr.name };

  // Display-name fallback: only when the domain is organizational, so a
  // stranger on gmail.com who happens to share a name is never merged in.
  if (addr.name && !isConsumerDomain(splitEmail(addr.email).domain)) {
    const n = addr.name.toLowerCase().replace(/\s+/g, " ");
    const byName = index.byName.get(n);
    if (byName) return { id: byName, via: "name", email: addr.email, name: addr.name };
  }
  return null;
}

export function isSelf(selfEmails, raw) {
  const addr = parseAddress(raw);
  if (!addr) return false;
  const k = normEmail(addr.email);
  return (selfEmails || []).some((e) => normEmail(e) === k);
}

/**
 * Collapse raw Gmail messages into at most one Interaction per person per
 * thread per day (the granularity chosen for signal over noise).
 *
 * message: { id, threadId, date (ISO or ms), subject, from, to[], cc[] }
 * returns: [{ personId, date, type:"email", text, source:{...}, direction }]
 */
export function messagesToInteractions(messages, index, selfEmails) {
  const buckets = new Map();

  for (const m of messages || []) {
    const day = toDay(m.date);
    if (!day) continue;
    const outbound = isSelf(selfEmails, m.from);
    // Counterparties: everyone on the message who isn't me.
    const others = [m.from, ...(m.to || []), ...(m.cc || [])]
      .filter((a) => a && !isSelf(selfEmails, a));

    const seen = new Set();
    for (const a of others) {
      const hit = matchAddress(index, a);
      if (!hit || seen.has(hit.id)) continue;
      seen.add(hit.id);
      const key = hit.id + "|" + (m.threadId || m.id) + "|" + day;
      const b = buckets.get(key) || {
        personId: hit.id, date: day, type: "email",
        subject: cleanSubject(m.subject), count: 0,
        threadId: m.threadId || m.id, messageIds: [],
        inbound: 0, outbound: 0, via: hit.via,
      };
      b.count++;
      b.messageIds.push(m.id);
      if (outbound) b.outbound++; else b.inbound++;
      if (!b.subject) b.subject = cleanSubject(m.subject);
      buckets.set(key, b);
    }
  }

  return [...buckets.values()].map((b) => ({
    personId: b.personId,
    date: b.date,
    type: "email",
    text: b.subject
      ? b.subject + (b.count > 1 ? " — " + b.count + " messages" : "")
      : b.count + " message" + (b.count === 1 ? "" : "s"),
    direction: b.outbound && b.inbound ? "both" : b.outbound ? "outbound" : "inbound",
    source: { kind: "gmail", threadId: b.threadId, ids: b.messageIds, via: b.via },
  }));
}

/**
 * Calendar events -> one Interaction per attendee per event.
 * event: { id, summary, start (ISO), attendees:[{email,displayName,self,responseStatus}], organizer }
 */
export function eventsToInteractions(events, index, selfEmails, opts = {}) {
  const out = [];
  for (const ev of events || []) {
    const day = toDay(ev.start);
    if (!day) continue;
    if (ev.status === "cancelled") continue;
    const attendees = (ev.attendees || []).filter((a) => a && !a.self && !isSelf(selfEmails, a.email));
    // A solo calendar block is not an interaction with anyone.
    if (!attendees.length) continue;
    // Big invites are broadcasts, not relationship signal.
    if (opts.maxAttendees && attendees.length > opts.maxAttendees) continue;

    const seen = new Set();
    for (const a of attendees) {
      if (a.responseStatus === "declined") continue;
      const hit = matchAddress(index, a.displayName ? `${a.displayName} <${a.email}>` : a.email, { allowNoReply: true });
      if (!hit || seen.has(hit.id)) continue;
      seen.add(hit.id);
      out.push({
        personId: hit.id,
        date: day,
        type: "event",
        text: (ev.summary || "Meeting").trim(),
        direction: "both",
        source: { kind: "gcal", eventId: ev.id, via: hit.via },
      });
    }
  }
  return out;
}

export function cleanSubject(s) {
  return String(s || "").replace(/^\s*((re|fw|fwd|aw|sv)\s*:\s*)+/i, "").trim().slice(0, 160);
}

export function toDay(v) {
  if (!v) return "";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const d = new Date(typeof v === "string" && /^\d+$/.test(v) ? +v : v);
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

/* De-dupe against what a contact already has, so re-syncing is idempotent. */
export function dedupeAgainstExisting(candidates, contacts) {
  const have = new Set();
  for (const c of contacts || []) {
    for (const it of c.interactions || []) {
      const s = it.source;
      if (!s) continue;
      if (s.kind === "gmail" && s.threadId) have.add(c.id + "|t:" + s.threadId + "|" + it.date);
      if (s.kind === "gcal" && s.eventId) have.add(c.id + "|e:" + s.eventId);
    }
  }
  const out = [];
  for (const cand of candidates) {
    const key = cand.source.kind === "gmail"
      ? cand.personId + "|t:" + cand.source.threadId + "|" + cand.date
      : cand.personId + "|e:" + cand.source.eventId;
    if (have.has(key)) continue;
    have.add(key);
    out.push(cand);
  }
  return out;
}

/* Reply-latency and inbound/outbound mix, for the Insights panel. */
export function responsePatterns(contact) {
  const logged = (contact.interactions || []).filter((i) => i.direction);
  let inbound = 0, outbound = 0;
  for (const i of logged) {
    if (i.direction === "inbound") inbound++;
    else if (i.direction === "outbound") outbound++;
    else { inbound++; outbound++; }
  }
  const dated = logged
    .filter((i) => i.direction === "inbound" || i.direction === "outbound")
    .sort((a, b) => a.date.localeCompare(b.date));
  const gaps = [];
  for (let i = 1; i < dated.length; i++) {
    if (dated[i - 1].direction === "inbound" && dated[i].direction === "outbound") {
      const d = (new Date(dated[i].date) - new Date(dated[i - 1].date)) / 86400000;
      if (d >= 0 && d < 60) gaps.push(Math.round(d));
    }
  }
  gaps.sort((a, b) => a - b);
  return {
    inbound, outbound, logged: logged.length,
    medianReplyDays: gaps.length ? gaps[Math.floor(gaps.length / 2)] : null,
    initiationRatio: inbound + outbound ? outbound / (inbound + outbound) : null,
  };
}
