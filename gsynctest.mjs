// Drives the whole Gmail/Calendar sync pipeline against a mock Google API:
// token refresh -> message/event fetch -> matching -> append -> idempotency.
// No network. node gsynctest.mjs
import fs from "node:fs";

const STORE = "./gsynctest-store.json";
try { fs.unlinkSync(STORE); } catch (e) { /* fresh */ }
process.env.HEARTH_STORE_FILE = STORE;
process.env.HEARTH_PASSPHRASE = "test-pass";
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";

const { storeGet, storeSet } = await import("./api/_lib.js");
const { runSync } = await import("./api/gsync.js");

let pass = 0, fail = 0;
const t = async (name, fn) => {
  try { await fn(); console.log("ok  ", name); pass++; }
  catch (e) { console.log("FAIL", name, "—", e.message); fail++; }
};
const eq = (a, b, m) => {
  if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error((m || "") + " " + JSON.stringify(a) + " !== " + JSON.stringify(b));
};
const ok = (v, m) => { if (!v) throw new Error(m || "expected truthy"); };

const day = (n) => {
  const d = new Date(Date.now() - n * 86400000);
  return d.toISOString();
};

/* ---------- mock Google ---------- */
let calls = [];
const MESSAGES = {
  m1: { id: "m1", threadId: "t1", internalDate: String(Date.parse(day(3))),
    payload: { headers: [
      { name: "From", value: "Jane Doe <jane@acme.com>" },
      { name: "To", value: "me@myco.com" },
      { name: "Subject", value: "Q3 deck" }] } },
  m2: { id: "m2", threadId: "t1", internalDate: String(Date.parse(day(3)) + 3600000),
    payload: { headers: [
      { name: "From", value: "me@myco.com" },
      { name: "To", value: '"Doe, Jane" <jane@acme.com>, sam@othersite.com' },
      { name: "Subject", value: "Re: Q3 deck" }] } },
  m3: { id: "m3", threadId: "t9", internalDate: String(Date.parse(day(1))),
    payload: { headers: [
      { name: "From", value: "newsletter@substack.com" },
      { name: "To", value: "me@myco.com" },
      { name: "Subject", value: "Weekly roundup" }] } },
};
const EVENTS = [
  { id: "ev1", summary: "Coffee with Jane", status: "confirmed",
    start: { dateTime: day(2) },
    attendees: [{ email: "me@myco.com", self: true }, { email: "jane@acme.com" }] },
  { id: "ev2", summary: "Solo focus", status: "confirmed", start: { dateTime: day(2) }, attendees: [] },
];

function mockFetch(url, opts) {
  const u = String(url);
  calls.push(u.split("?")[0]);
  if (u.startsWith("https://oauth2.googleapis.com/token")) {
    return Promise.resolve({ ok: true, status: 200,
      json: async () => ({ access_token: "at-" + Date.now(), expires_in: 3600 }) });
  }
  if (u.includes("/gmail/v1/users/me/messages/")) {
    const id = u.split("/messages/")[1].split("?")[0];
    return Promise.resolve({ ok: true, status: 200, json: async () => MESSAGES[id] });
  }
  if (u.includes("/gmail/v1/users/me/messages")) {
    return Promise.resolve({ ok: true, status: 200,
      json: async () => ({ messages: Object.keys(MESSAGES).map((id) => ({ id })) }) });
  }
  if (u.includes("/calendar/v3/calendars/primary/events")) {
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ items: EVENTS }) });
  }
  return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
}
const deps = { fetch: mockFetch };

/* ---------- fixtures in the store ---------- */
async function seed() {
  await storeSet("google", {
    refreshToken: "rt", accessToken: "", expiresAt: 0,
    email: "me@myco.com", connectedAt: new Date().toISOString(),
  });
  await storeSet("integrations", { googleEnabled: true, gmailEnabled: true, calendarEnabled: true, backfillMonths: 6 });
  await storeSet("syncstate", null);
  await storeSet("data", {
    version: 3,
    doc: {
      v: 2, groups: [{ name: "Work", color: 3 }], rules: [],
      contacts: [
        { id: "p1", name: "Jane Doe", emails: ["jane@acme.com"], groups: ["Work"],
          interactions: [], cadence: { id: "monthly" } },
        { id: "p2", name: "Nobody Match", emails: ["nobody@nowhere.com"], groups: [], interactions: [] },
      ],
    },
  });
}

await t("skips cleanly when Google isn't connected", async () => {
  await storeSet("google", null);
  await storeSet("data", { version: 1, doc: { contacts: [] } });
  const r = await runSync({ deps });
  eq(r.skipped, "google not connected");
});

await t("skips when the integration is switched off", async () => {
  await seed();
  await storeSet("integrations", { googleEnabled: false });
  const r = await runSync({ deps });
  ok(r.skipped && /switched off/.test(r.skipped), JSON.stringify(r));
});

await t("first run backfills and logs matched interactions", async () => {
  await seed();
  calls = [];
  const r = await runSync({ deps });
  eq(r.errors, [], "errors");
  eq(r.messages, 3, "messages fetched");
  eq(r.events, 2, "events fetched");
  eq(r.people, 1, "people touched");
  ok(r.logged >= 2, "expected an email thread and a meeting, got " + r.logged);
  ok(calls.some((c) => c.includes("oauth2.googleapis.com/token")), "never refreshed the token");
});

await t("logged interactions carry date, type, direction and source", async () => {
  const doc = (await storeGet("data")).doc;
  const jane = doc.contacts.find((c) => c.id === "p1");
  const email = jane.interactions.find((i) => i.type === "email");
  const meeting = jane.interactions.find((i) => i.type === "event");
  ok(email, "no email interaction");
  ok(meeting, "no meeting interaction");
  eq(email.text, "Q3 deck — 2 messages");
  eq(email.direction, "both");
  eq(email.source.kind, "gmail");
  ok(email.auto, "should be flagged as auto-logged");
  ok(/^\d{4}-\d{2}-\d{2}$/.test(email.date), "date: " + email.date);
  eq(meeting.text, "Coffee with Jane");
  eq(meeting.source.eventId, "ev1");
});

await t("never logs newsletters, strangers, or solo calendar blocks", async () => {
  const doc = (await storeGet("data")).doc;
  const all = doc.contacts.flatMap((c) => c.interactions || []);
  ok(!all.some((i) => /roundup/i.test(i.text || "")), "newsletter logged");
  ok(!all.some((i) => /Solo focus/.test(i.text || "")), "solo block logged");
  eq(doc.contacts.find((c) => c.id === "p2").interactions, [], "unmatched person touched");
});

await t("last-contacted and the follow-up clock move automatically", async () => {
  const { dueInfo, lastContact } = await import("./src/due.js");
  const jane = (await storeGet("data")).doc.contacts.find((c) => c.id === "p1");
  const last = lastContact(jane);
  ok(last, "no last contact derived");
  const info = dueInfo(jane);
  eq(info.status, "ok", "monthly cadence should be satisfied by a 2-day-old touch");
  ok(info.due > last, "next due date should follow the logged touch");
});

await t("the document version is bumped so devices resync", async () => {
  const stored = await storeGet("data");
  eq(stored.version, 4);
});

await t("a second run adds nothing (idempotent)", async () => {
  const before = (await storeGet("data")).doc.contacts.flatMap((c) => c.interactions).length;
  const r = await runSync({ deps });
  eq(r.logged, 0, "duplicates created");
  const after = (await storeGet("data")).doc.contacts.flatMap((c) => c.interactions).length;
  eq(after, before);
  eq((await storeGet("data")).version, 4, "version bumped with no changes");
});

await t("sync state records when it last ran", async () => {
  const st = await storeGet("syncstate");
  ok(st.lastSyncedAt, "no timestamp");
  ok(Date.now() - Date.parse(st.lastSyncedAt) < 60000, "timestamp is stale");
  ok(st.lastResult, "no result summary");
});

await t("a Gmail outage degrades to calendar-only instead of failing", async () => {
  await seed();
  const failing = {
    fetch: (url, o) => (String(url).includes("/gmail/")
      ? Promise.resolve({ ok: false, status: 500, json: async () => ({}), text: async () => "boom" })
      : mockFetch(url, o)),
  };
  const r = await runSync({ deps: failing });
  ok(r.errors.some((e) => /gmail/.test(e)), "no gmail error recorded: " + JSON.stringify(r.errors));
  eq(r.events, 2, "calendar should still have synced");
  ok(r.logged >= 1, "meeting should still be logged");
});

await t("revoked access surfaces a clear message", async () => {
  await seed();
  const revoked = {
    fetch: (url) => (String(url).includes("oauth2.googleapis.com/token")
      ? Promise.resolve({ ok: false, status: 400, json: async () => ({ error: "invalid_grant", error_description: "Token has been expired or revoked." }) })
      : Promise.resolve({ ok: false, status: 401, json: async () => ({}), text: async () => "" })),
  };
  let msg = "";
  try { await runSync({ deps: revoked }); } catch (e) { msg = e.message; }
  ok(/revoked|expired/i.test(msg), "unhelpful error: " + msg);
});

await t("respects the calendar-off toggle", async () => {
  await seed();
  await storeSet("integrations", { googleEnabled: true, gmailEnabled: true, calendarEnabled: false, backfillMonths: 6 });
  const r = await runSync({ deps });
  eq(r.events, 0, "calendar fetched while disabled");
  ok(r.messages > 0, "gmail should still run");
  const jane = (await storeGet("data")).doc.contacts.find((c) => c.id === "p1");
  ok(!jane.interactions.some((i) => i.type === "event"), "meeting logged while calendar disabled");
});

console.log(`\n${pass} passed, ${fail} failed`);
try { fs.unlinkSync(STORE); } catch (e) { /* gone */ }
process.exit(fail ? 1 : 0);
