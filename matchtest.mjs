// Unit tests for the email/event -> person matching engine (src/match.js).
// Pure logic, no browser: node matchtest.mjs
import {
  normEmail, parseAddress, isNoReply, isConsumerDomain, buildIndex, matchAddress,
  isSelf, messagesToInteractions, eventsToInteractions, cleanSubject, toDay,
  dedupeAgainstExisting, responsePatterns,
} from "./src/match.js";

let pass = 0, fail = 0;
const t = (name, fn) => {
  try { fn(); console.log("ok  ", name); pass++; }
  catch (e) { console.log("FAIL", name, "—", e.message); fail++; }
};
const eq = (a, b, msg) => {
  const A = JSON.stringify(a), B = JSON.stringify(b);
  if (A !== B) throw new Error((msg ? msg + ": " : "") + A + " !== " + B);
};
const ok = (v, msg) => { if (!v) throw new Error(msg || "expected truthy, got " + v); };

const SELF = ["me@myco.com", "personal@gmail.com"];
const CONTACTS = [
  { id: "p1", name: "Jane Doe", emails: ["jane@acme.com", "jane.doe@personal.io"], interactions: [] },
  { id: "p2", name: "Sam Torres", emails: ["sam.torres@gmail.com"], interactions: [] },
  { id: "p3", name: "Priya Sharma", emails: [], interactions: [] },
  { id: "p4", name: "Bob Vance", emails: ["bob@vance-refrigeration.com"], interactions: [] },
];
const IDX = buildIndex(CONTACTS);

/* ---------- address parsing ---------- */

t("parses display-name addresses", () => {
  eq(parseAddress("Jane Doe <jane@acme.com>"), { name: "Jane Doe", email: "jane@acme.com" });
  eq(parseAddress('"Doe, Jane" <jane@acme.com>'), { name: "Doe, Jane", email: "jane@acme.com" });
  eq(parseAddress("  jane@acme.com "), { name: "", email: "jane@acme.com" });
});

t("rejects malformed addresses", () => {
  eq(parseAddress(""), null);
  eq(parseAddress("not an email"), null);
  eq(parseAddress("two@@ats.com"), null);
  eq(parseAddress(null), null);
});

t("normalizes plus-tags and gmail dots", () => {
  eq(normEmail("Jane+crm@Acme.com"), "jane@acme.com");
  eq(normEmail("s.a.m.torres@gmail.com"), "samtorres@gmail.com");
  eq(normEmail("sam.torres@googlemail.com"), "samtorres@gmail.com");
  // dots are significant outside gmail
  eq(normEmail("jane.doe@personal.io"), "jane.doe@personal.io");
});

/* ---------- noise filters ---------- */

t("filters no-reply and bulk senders", () => {
  ok(isNoReply("no-reply@acme.com"));
  ok(isNoReply("noreply@acme.com"));
  ok(isNoReply("do-not-reply@acme.com"));
  ok(isNoReply("notifications@acme.com"));
  ok(isNoReply("billing@acme.com"));
  ok(isNoReply("news@substack.com"));
  ok(isNoReply("anything@mailchimp.com"));
  ok(!isNoReply("jane@acme.com"));
  ok(!isNoReply("noreplacement@acme.com"), "substring must not false-positive");
});

t("knows consumer vs organizational domains", () => {
  ok(isConsumerDomain("gmail.com"));
  ok(isConsumerDomain("ICLOUD.COM"));
  ok(!isConsumerDomain("acme.com"));
});

/* ---------- matching ---------- */

t("matches on exact email", () => {
  const m = matchAddress(IDX, "Jane <jane@acme.com>");
  eq(m.id, "p1"); eq(m.via, "email");
});

t("matches through plus-tags and gmail dots", () => {
  eq(matchAddress(IDX, "jane+newsletter@acme.com").id, "p1");
  eq(matchAddress(IDX, "samtorres@gmail.com").id, "p2");
  eq(matchAddress(IDX, "S.A.M.Torres@GoogleMail.com").id, "p2");
});

t("matches a second address on the same person", () => {
  eq(matchAddress(IDX, "jane.doe@personal.io").id, "p1");
});

t("falls back to display name on organizational domains only", () => {
  // Priya has no stored email; corporate domain + exact name is a safe match.
  const m = matchAddress(IDX, "Priya Sharma <priya@anthropic.com>");
  eq(m.id, "p3"); eq(m.via, "name");
});

t("never name-matches across a consumer domain", () => {
  eq(matchAddress(IDX, "Priya Sharma <priya.sharma@gmail.com>"), null);
});

t("returns null for unknown people", () => {
  eq(matchAddress(IDX, "stranger@nowhere.com"), null);
});

t("never matches no-reply mail, even at a known domain", () => {
  eq(matchAddress(IDX, "no-reply@acme.com"), null);
});

t("identifies my own addresses", () => {
  ok(isSelf(SELF, "me@myco.com"));
  ok(isSelf(SELF, "Me <ME@MyCo.com>"));
  ok(isSelf(SELF, "personal+receipts@gmail.com"));
  ok(!isSelf(SELF, "jane@acme.com"));
});

/* ---------- subjects & dates ---------- */

t("strips reply/forward prefixes", () => {
  eq(cleanSubject("Re: Fwd: RE: Q3 deck"), "Q3 deck");
  eq(cleanSubject("  coffee?  "), "coffee?");
  eq(cleanSubject(undefined), "");
});

t("normalizes dates to local YYYY-MM-DD", () => {
  eq(toDay("2026-03-04T15:20:00Z").slice(0, 4), "2026");
  eq(toDay("2026-03-04"), "2026-03-04");
  eq(toDay(""), "");
  eq(toDay("garbage"), "");
});

/* ---------- gmail -> interactions ---------- */

const MSGS = [
  { id: "m1", threadId: "t1", date: "2026-03-04T09:00:00Z", subject: "Q3 deck", from: "Jane Doe <jane@acme.com>", to: ["me@myco.com"] },
  { id: "m2", threadId: "t1", date: "2026-03-04T11:00:00Z", subject: "Re: Q3 deck", from: "me@myco.com", to: ["jane@acme.com"] },
  { id: "m3", threadId: "t1", date: "2026-03-04T12:00:00Z", subject: "Re: Q3 deck", from: "Jane Doe <jane@acme.com>", to: ["me@myco.com"] },
  // same thread, next day -> separate interaction
  { id: "m4", threadId: "t1", date: "2026-03-05T09:00:00Z", subject: "Re: Q3 deck", from: "jane@acme.com", to: ["me@myco.com"] },
  // different person, and a cc'd known contact
  { id: "m5", threadId: "t2", date: "2026-03-06T09:00:00Z", subject: "intro", from: "me@myco.com", to: ["sam.torres@gmail.com"], cc: ["jane@acme.com"] },
  // newsletter: ignored
  { id: "m6", threadId: "t3", date: "2026-03-06T10:00:00Z", subject: "Weekly", from: "news@substack.com", to: ["me@myco.com"] },
  // stranger: ignored
  { id: "m7", threadId: "t4", date: "2026-03-06T11:00:00Z", subject: "hi", from: "stranger@nowhere.com", to: ["me@myco.com"] },
];

t("collapses a day's thread into one interaction per person", () => {
  const out = messagesToInteractions(MSGS, IDX, SELF);
  const jane0304 = out.filter((i) => i.personId === "p1" && i.date === "2026-03-04");
  eq(jane0304.length, 1, "three messages in one day/thread");
  eq(jane0304[0].text, "Q3 deck — 3 messages");
  eq(jane0304[0].type, "email");
  eq(jane0304[0].direction, "both");
});

t("splits the same thread across days", () => {
  const out = messagesToInteractions(MSGS, IDX, SELF);
  const jane = out.filter((i) => i.personId === "p1").map((i) => i.date).sort();
  eq(jane, ["2026-03-04", "2026-03-05", "2026-03-06"]);
});

t("logs cc'd contacts and records direction", () => {
  const out = messagesToInteractions(MSGS, IDX, SELF);
  const sam = out.find((i) => i.personId === "p2");
  eq(sam.direction, "outbound");
  eq(sam.text, "intro");
  const janeCc = out.find((i) => i.personId === "p1" && i.date === "2026-03-06");
  ok(janeCc, "cc'd contact should be logged");
});

t("ignores newsletters and strangers", () => {
  const out = messagesToInteractions(MSGS, IDX, SELF);
  ok(!out.some((i) => /Weekly/.test(i.text)), "newsletter leaked in");
  eq(out.filter((i) => i.personId).length, out.length);
  eq(new Set(out.map((i) => i.personId)).size, 2, "only Jane and Sam");
});

t("inbound-only thread is marked inbound", () => {
  const out = messagesToInteractions([MSGS[3]], IDX, SELF);
  eq(out[0].direction, "inbound");
});

t("handles an empty or malformed batch", () => {
  eq(messagesToInteractions([], IDX, SELF), []);
  eq(messagesToInteractions(null, IDX, SELF), []);
  eq(messagesToInteractions([{ id: "x", date: "nope", from: "jane@acme.com" }], IDX, SELF), []);
});

/* ---------- calendar -> interactions ---------- */

const EVENTS = [
  { id: "e1", summary: "Coffee with Jane", start: "2026-03-10T17:00:00Z",
    attendees: [{ email: "me@myco.com", self: true }, { email: "jane@acme.com" }] },
  { id: "e2", summary: "Focus block", start: "2026-03-10T20:00:00Z", attendees: [] },
  { id: "e3", summary: "Cancelled sync", start: "2026-03-11T17:00:00Z", status: "cancelled",
    attendees: [{ email: "jane@acme.com" }] },
  { id: "e4", summary: "All hands", start: "2026-03-12T17:00:00Z",
    attendees: Array.from({ length: 40 }, (_, i) => ({ email: `p${i}@acme.com` })).concat([{ email: "jane@acme.com" }]) },
  { id: "e5", summary: "Roadmap review", start: "2026-03-13T17:00:00Z",
    attendees: [{ email: "jane@acme.com" }, { email: "bob@vance-refrigeration.com", responseStatus: "declined" }] },
];

t("logs meetings against attendees", () => {
  const out = eventsToInteractions(EVENTS, IDX, SELF, { maxAttendees: 12 });
  const e1 = out.find((i) => i.source.eventId === "e1");
  eq(e1.personId, "p1");
  eq(e1.type, "event");
  eq(e1.text, "Coffee with Jane");
  eq(e1.date, EVENTS[0].start.slice(0, 10) === "2026-03-10" ? e1.date : e1.date); // tz-tolerant
});

t("skips solo blocks, cancellations, big broadcasts, and decliners", () => {
  const out = eventsToInteractions(EVENTS, IDX, SELF, { maxAttendees: 12 });
  ok(!out.some((i) => i.source.eventId === "e2"), "solo block logged");
  ok(!out.some((i) => i.source.eventId === "e3"), "cancelled event logged");
  ok(!out.some((i) => i.source.eventId === "e4"), "40-person meeting logged");
  ok(!out.some((i) => i.source.eventId === "e5" && i.personId === "p4"), "decliner logged");
  ok(out.some((i) => i.source.eventId === "e5" && i.personId === "p1"), "accepted attendee missing");
});

/* ---------- idempotency ---------- */

t("re-syncing the same data adds nothing", () => {
  const first = messagesToInteractions(MSGS, IDX, SELF);
  const contacts = CONTACTS.map((c) => ({
    ...c,
    interactions: first.filter((i) => i.personId === c.id)
      .map((i, n) => ({ id: "x" + n, type: i.type, date: i.date, text: i.text, source: i.source })),
  }));
  const second = dedupeAgainstExisting(messagesToInteractions(MSGS, IDX, SELF), contacts);
  eq(second.length, 0, "duplicate interactions would be created");
});

t("a new day on an existing thread still lands", () => {
  const existing = CONTACTS.map((c) => ({
    ...c,
    interactions: c.id === "p1"
      ? [{ id: "a", type: "email", date: "2026-03-04", text: "Q3 deck", source: { kind: "gmail", threadId: "t1" } }]
      : [],
  }));
  const fresh = dedupeAgainstExisting(messagesToInteractions(MSGS, IDX, SELF), existing);
  ok(fresh.some((i) => i.personId === "p1" && i.date === "2026-03-05"), "next-day message dropped");
  ok(!fresh.some((i) => i.personId === "p1" && i.date === "2026-03-04"), "already-logged day duplicated");
});

t("calendar de-dupe is per event", () => {
  const evs = eventsToInteractions(EVENTS, IDX, SELF, { maxAttendees: 12 });
  const contacts = [{ id: "p1", name: "Jane Doe", emails: ["jane@acme.com"],
    interactions: evs.filter((e) => e.personId === "p1").map((e, n) => ({ id: "e" + n, date: e.date, type: "event", source: e.source })) }];
  eq(dedupeAgainstExisting(evs.filter((e) => e.personId === "p1"), contacts).length, 0);
});

/* ---------- analytics ---------- */

t("computes response patterns", () => {
  const c = { interactions: [
    { date: "2026-03-01", direction: "inbound" },
    { date: "2026-03-03", direction: "outbound" },
    { date: "2026-03-10", direction: "inbound" },
    { date: "2026-03-12", direction: "outbound" },
    { date: "2026-03-15", direction: "both" },
  ] };
  const r = responsePatterns(c);
  eq(r.medianReplyDays, 2);
  eq(r.logged, 5);
  ok(r.initiationRatio > 0 && r.initiationRatio < 1);
});

t("response patterns tolerate no direction data", () => {
  const r = responsePatterns({ interactions: [{ date: "2026-01-01", type: "call" }] });
  eq(r.logged, 0);
  eq(r.medianReplyDays, null);
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
