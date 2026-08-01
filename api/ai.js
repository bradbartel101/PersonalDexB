import { storeGet, cors, authed } from "./_lib.js";

/* Anthropic proxy. The API key lives only in this server's environment —
   it is never sent to the browser. Every task is read-and-suggest: nothing
   here sends a message, emails anyone, or writes to the CRM. */

const MODEL = () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5";

async function callClaude({ system, prompt, maxTokens = 800, temperature = 0.4 }) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) { const e = new Error("No ANTHROPIC_API_KEY set on the server"); e.code = 503; throw e; }
  const base = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
  const r = await fetch(base + "/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL(),
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const json = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (json.error && json.error.message) || "Anthropic API error " + r.status;
    const e = new Error(msg);
    e.code = r.status === 401 ? 401 : r.status === 429 ? 429 : 502;
    throw e;
  }
  return (json.content || []).filter((b) => b.type === "text").map((b) => b.text).join("").trim();
}

/* Only what the task needs — no photos, no unrelated contacts. */
function personBrief(c, { withTimeline = true } = {}) {
  const lines = [
    "Name: " + c.name,
    c.role || c.company ? "Role: " + [c.role, c.company].filter(Boolean).join(" at ") : "",
    c.location ? "Location: " + c.location : "",
    c.context ? "How we met: " + c.context : "",
    (c.groups || []).length ? "Categories: " + c.groups.join(", ") : "",
    (c.tags || []).length ? "Tags: " + c.tags.join(", ") : "",
    c.strength ? "Closeness (1-5): " + c.strength : "",
    (c.facts || []).length ? "Key facts: " + c.facts.join("; ") : "",
    c.notes ? "Notes: " + c.notes : "",
  ].filter(Boolean);
  if (withTimeline) {
    const tl = [...(c.interactions || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
    if (tl.length) {
      lines.push("Interaction history (newest first):");
      for (const it of tl) lines.push(`- ${it.date} · ${it.type}${it.direction ? " (" + it.direction + ")" : ""}: ${it.text || "(no note)"}`);
    } else lines.push("No interactions logged yet.");
  }
  return lines.join("\n");
}

const TONES = {
  warm: "Warm and personal, like writing to a friend you're glad to hear from. Contractions welcome.",
  professional: "Professional and courteous, but human — not corporate boilerplate.",
  brief: "Very brief. Two or three sentences at most. Friendly but economical.",
};

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (!authed(req, res)) return;
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const settings = (await storeGet("integrations")) || {};
  if (settings.aiEnabled === false) return res.status(503).json({ error: "AI features are switched off in settings" });

  const { task, personId, tone = "warm", query } = req.body || {};
  const stored = await storeGet("data");
  const doc = (stored && stored.doc) || { contacts: [] };
  const contacts = doc.contacts || [];
  const person = personId ? contacts.find((c) => c.id === personId) : null;

  try {
    if (task === "summarize") {
      if (!person) return res.status(400).json({ error: "Unknown person" });
      const text = await callClaude({
        system: "You summarize a personal relationship for the CRM owner's own eyes. Be concrete and specific, never generic. Use only what you're given; if something isn't in the record, don't invent it.",
        prompt: `Summarize my relationship with this person in 3-5 short bullet points: how we know each other, what matters to them right now, what we owe each other, and what would be natural to talk about next. If the history is thin, say so plainly rather than padding.\n\n${personBrief(person)}`,
        maxTokens: 500,
      });
      return res.status(200).json({ text });
    }

    if (task === "draft") {
      if (!person) return res.status(400).json({ error: "Unknown person" });
      const text = await callClaude({
        system: `You draft short outreach messages the CRM owner will read, edit, and send themselves. Never claim anything that isn't in the record. No subject line unless asked. No sign-off placeholders like [Your Name]. Tone: ${TONES[tone] || TONES.warm}`,
        prompt: `Draft a message reconnecting with this person after a gap. Reference something specific and true from the record so it doesn't read like a template. Do not invent events, do not apologize excessively for the silence, and don't propose a specific date and time — suggest catching up and let me fill in details.\n\n${personBrief(person)}`,
        maxTokens: 400,
        temperature: 0.7,
      });
      return res.status(200).json({ text, tone });
    }

    if (task === "suggest") {
      if (!person) return res.status(400).json({ error: "Unknown person" });
      const cats = (doc.groups || []).map((g) => g.name);
      const tags = [...new Set(contacts.flatMap((c) => c.tags || []))].slice(0, 60);
      const raw = await callClaude({
        system: "You classify a contact into an existing taxonomy. Reply with JSON only, no prose, no code fences.",
        prompt: `Given this contact, suggest which of my existing categories they belong to, and up to three tags (reuse my existing tags when they fit; new lowercase tags are allowed if clearly better).\n\nMy categories: ${cats.join(", ") || "(none yet)"}\nMy existing tags: ${tags.join(", ") || "(none yet)"}\n\nContact:\n${personBrief(person, { withTimeline: false })}\n\nReply exactly as: {"categories":["..."],"tags":["..."],"why":"one short sentence"}`,
        maxTokens: 300,
        temperature: 0.2,
      });
      let parsed = { categories: [], tags: [], why: "" };
      try {
        parsed = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
      } catch (e) { return res.status(502).json({ error: "Model returned unparseable JSON", raw }); }
      return res.status(200).json({
        categories: (parsed.categories || []).filter((x) => typeof x === "string").slice(0, 4),
        tags: (parsed.tags || []).filter((x) => typeof x === "string").map((t) => t.toLowerCase()).slice(0, 5),
        why: String(parsed.why || "").slice(0, 200),
      });
    }

    if (task === "search") {
      if (!query || !String(query).trim()) return res.status(400).json({ error: "Empty query" });
      const cats = (doc.groups || []).map((g) => g.name);
      const tags = [...new Set(contacts.flatMap((c) => c.tags || []))].slice(0, 60);
      const today = new Date().toISOString().slice(0, 10);
      const raw = await callClaude({
        system: "You translate natural-language questions about a personal CRM into a small JSON filter. Reply with JSON only, no prose, no code fences.",
        prompt: `Today is ${today}. Translate this question into a filter.\n\nQuestion: ${String(query).slice(0, 400)}\n\nMy categories: ${cats.join(", ") || "(none)"}\nMy tags: ${tags.join(", ") || "(none)"}\n\nSchema (omit any key you don't need):\n{"categories":[names],"tags":[names],"text":"free text to match name/company/title/notes","notContactedSince":"YYYY-MM-DD","contactedSince":"YYYY-MM-DD","minStrength":1-5,"overdue":true,"uncategorized":true,"sort":"overdue"|"recent"|"name"|"strength","explain":"one short sentence describing the filter in plain English"}\n\nInterpret seasons and vague periods relative to today (e.g. "since spring" -> March 1 of the most recent spring).`,
        maxTokens: 400,
        temperature: 0.1,
      });
      let filter;
      try {
        filter = JSON.parse(raw.replace(/^```(?:json)?|```$/g, "").trim());
      } catch (e) { return res.status(502).json({ error: "Model returned unparseable JSON", raw }); }
      return res.status(200).json({ filter });
    }

    return res.status(400).json({ error: "Unknown task" });
  } catch (e) {
    return res.status(e.code || 500).json({ error: String(e.message || e) });
  }
}
