# Hearth — a personal CRM

A relationship manager for one person: see who you owe a message, log the interaction, done. Modeled on Dex, with the parts that matter for staying in touch — cadences, categories, an interaction timeline, and LinkedIn import — plus automation Dex doesn't have.

Your data is yours: everything lives in your browser by default, and every byte can be exported to JSON or CSV at any time.

---

## Install and run

Requires **Node 20+**.

```sh
git clone https://github.com/bradbartel101/PersonalDexB.git
cd PersonalDexB
npm install
npm run build        # produces hearth-standalone.html
```

Then pick how you want to run it:

**A. Just open the file** — no server, nothing to configure.

```sh
open hearth-standalone.html        # macOS
xdg-open hearth-standalone.html    # Linux
start hearth-standalone.html       # Windows
```

Everything (React, fonts, styles) is inlined in that one file. Data persists in that browser's `localStorage`. Bookmark it and you're done.

**B. Run the local server** — same app, plus the sync API and daily digest.

```sh
node dev-server.mjs                # http://127.0.0.1:8787, passphrase "test-pass"
HEARTH_PASSPHRASE="my long phrase" node dev-server.mjs 9000
```

**C. Deploy it** so it's reachable from your phone/iPad and shareable — see [Hosting](#hosting).

---

## The daily loop

Open the app → **Today** lists who's overdue, most overdue first → hit **Log**, pick a type, done. Logging resets that person's follow-up clock automatically.

The dashboard also shows:

| Section | What it's for |
| --- | --- |
| **Reach out** | Overdue by cadence, sorted by how overdue. Inline log + snooze. |
| **Noticed** | People you contact rhythmically but never set a cadence for — one tap to accept the suggestion. |
| **Needs a category** | Freshly imported or newly added people with no category yet. |
| **Recent interactions** | The last five things you logged, across everyone. |
| **Next 30 days** | Birthdays, important dates, and reminders coming up. |

---

## What's in it

**People** — name, photo (upload; initials avatar otherwise), company, title, location, multiple emails, multiple phones, LinkedIn URL, "how we met", free-form notes, relationship strength (1–5), and a last-contacted date (derived from your timeline, or set by hand).

**Categories** — a person can be in many (Family, Close Friends, Work, Recruiting, Investors, Clients out of the box). Create, rename, recolor, or delete them in **Categories**; renaming re-files everyone automatically.

**Tags** — free-form, many-to-many, filterable.

**Interactions** — date, type (call, email, coffee, message, event, note), and notes, shown newest-first on each profile and globally under **History**.

**Cadences** — none, weekly, monthly, quarterly, yearly, or custom "every N days/weeks/months". Overdue people surface on Today; snooze pushes someone out a week without breaking their rhythm.

**Automation**
- *Auto-categorize rules*: when a company or title contains your keywords, the person gets that category. Fully editable in **Auto-categorize rules**, with live match counts, applied on import or across everyone on demand.
- *Cadence suggestions*: 3+ interactions at a steady rhythm with no cadence set → Hearth proposes one.
- *Duplicate detection*: a live badge counts entries sharing a name or email; merging combines fields, tags, notes, and both timelines.
- *Daily digest*: an optional morning push notification listing who's due (hosted deployments only).

**Views** — searchable, filterable list (category, tag, cadence status, strength, uncategorized, archived) with list/grid toggle, bulk select for tag/category/cadence/star/archive/delete, and starring and archiving for the people you want pinned or hidden.

**Enrichment** — pronouns, timezone, preferred contact method, and a **Key facts** list (kids' names, what they're into, what you owe each other) surfaced near the top of every profile.

**Quick capture** — paste `met Jane, VP Eng at Acme, referred by Sam` and confirm the parsed draft. Runs locally; no API needed.

**Insights** — network by category, contacts added over 12 months, neglected relationships (rated 4–5 but overdue), how you keep in touch, and response patterns.

**Merge** — automatic duplicate detection plus a field-by-field review where you pick the winner per field. Emails, phones, tags, categories, key facts, and both timelines always survive.

**Keyboard** — `n` new person, `/` search, `esc` back.

**Backup** — **Export backup (JSON)** is the lossless format (restores everything including categories and rules). **Export contacts (CSV)** is the spreadsheet-friendly flat dump.

Sample data ships with the app so nothing is empty on first run — clear it with **Clear sample data** in the sidebar.

---

## Optional integrations

Both are **off until you supply your own credentials**, both are individually toggleable in the **Integrations** panel, and the app is fully functional with neither. Credentials live in your deployment's environment variables and are never sent to the browser.

### Gmail + Google Calendar (read-only)

Auto-logs interactions by matching senders and meeting attendees to people you already have.

1. [console.cloud.google.com](https://console.cloud.google.com) → create a project.
2. **APIs & Services → Library** → enable **Gmail API** and **Google Calendar API**.
3. **OAuth consent screen** → External → fill in the app name and your email → **Add users** and add your own Google address. Leave it in **Testing**; you'll click past an "unverified app" warning, which is expected for a personal tool. (Publishing would require Google's verification review — unnecessary here.)
4. **Credentials → Create credentials → OAuth client ID → Web application.** Add an authorized redirect URI of `https://YOUR-DEPLOYMENT/api/google` (the Integrations panel shows the exact string).
5. Put the client ID and secret in your environment as `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, then redeploy.
6. In Hearth: **Integrations → Connect Google**, then **Backfill 6 months**. After that a cron polls every four hours.

Scopes requested: `gmail.readonly`, `calendar.readonly`, `userinfo.email`. There is no send scope anywhere in the codebase — Hearth cannot email, reply, or touch your calendar.

What gets logged: one interaction per person per email thread per day (so a busy thread doesn't flood the timeline), and one per meeting per attendee. No-reply addresses, bulk senders (Substack, Mailchimp, etc.), solo calendar blocks, cancelled events, and meetings above 12 attendees are all ignored. Logged activity moves "last contacted" and the follow-up clock automatically. Re-syncing is idempotent — the same thread is never logged twice.

### Anthropic (AI assist)

1. Get a key at [console.anthropic.com](https://console.anthropic.com).
2. Add `ANTHROPIC_API_KEY` to your environment (optionally `ANTHROPIC_MODEL`, default `claude-sonnet-5`), and redeploy.

Features: **summarize our relationship** from the timeline and notes, **draft outreach** in a warm / professional / brief tone, **suggest categories and tags** with a confirm step, and **natural-language search** ("investors I haven't talked to since spring"). Every output is a draft you review — nothing is ever sent on your behalf, and the AI never writes to your CRM without a confirming tap. Calls are proxied through your own server so the key stays out of the page.

## LinkedIn import

Hearth imports from LinkedIn's **official data export**. No scraping, no signing in on your behalf, nothing that risks your account.

**Getting the file**

1. LinkedIn → **Settings & Privacy** → **Data privacy** → **Get a copy of your data**.
2. Choose **Want something in particular?** and tick **Connections**.
3. Request the archive. LinkedIn emails a download link, usually within ~10 minutes.
4. Unzip it; you want **Connections.csv**.

**Importing**

Sidebar → **LinkedIn / CSV import** → choose the file. You get a review screen before anything is saved:

- Columns mapped: First Name + Last Name → name, Company, Position → title, Connected On, URL → LinkedIn, Email Address (often blank).
- **De-dupe** by LinkedIn URL first, then by name.
- **Add new only** (default) or **Add new + update existing**. Updating only fills blanks — it never overwrites something you've curated, and merges new emails/phones alongside the old.
- Bulk-assign a category and tag to the whole batch.
- **Auto-categorize with my rules** applies your keyword rules as it imports; matched categories show on each row before you commit.

**Re-importing later is the intended workflow.** Drop in a fresh export any time; in the default mode only genuinely new connections are added. LinkedIn's export contains no photos — that's a LinkedIn limitation, so photos are uploaded manually per person.

Any CSV with a `name` (or `First Name`/`Last Name`) column works — Google Contacts, a spreadsheet, whatever.

---

## Hosting

The repo deploys as-is to **Vercel**, which adds cloud sync (use it from a laptop, phone, and iPad against the same data), optional sharing with friends, and the daily digest. See [DEPLOY.md](DEPLOY.md) for the click-by-click.

Without a backend — opening the file, or the GitHub Pages build — the app runs local-only and every feature except sync and push works exactly the same.

---

## Project layout

```
src/app.jsx          the entire UI
src/due.js           pure cadence / date / rules / filter logic (shared with the API)
src/match.js         pure email + calendar → person matching
src/parse.js         pure quick-capture text parsing
src/styles.css       design tokens + components (light and dark)
build.mjs            esbuild bundle → hearth.html + hearth-standalone.html
api/data.js          synced CRM document
api/google.js        OAuth start / callback / disconnect
api/gsync.js         Gmail + Calendar → Interactions
api/ai.js            Anthropic proxy (key stays server-side)
api/integrations.js  feature toggles and connection status
api/push.js          push subscriptions
api/notify.js        daily digest cron
dev-server.mjs       runs the API + app locally
scripts/site.mjs     assembles public/ for deployment
```

## Tests

```sh
npm test              # all six suites, ~90 seconds
npm run test:model    # data model, categories, rules, CSV export
npm run test:sync     # two-device sync + push digest (starts a real server)
```

| Suite | Covers |
| --- | --- |
| `smoke.mjs` | Core loop: dashboard, logging, search, profiles, persistence |
| `pro.mjs` | History, stars, archive, bulk actions, merge, important dates |
| `modeltest.mjs` | Strength, multi email/phone, categories, rules, CSV export, v1 migration |
| `litest.mjs` | LinkedIn CSV: parsing, mapping, de-dupe, re-import modes |
| `autotest.mjs` | Cadence suggestions, momentum, duplicate badge |
| `synctest.mjs` | Two-device sync, service worker, encrypted push digest |
| `matchtest.mjs` | Email/event → person matching: normalization, noise filters, thread collapsing, idempotency |
| `parsetest.mjs` | Quick-capture parsing |
| `gsynctest.mjs` | Full Gmail/Calendar sync pipeline against a mock Google API |
| `integtest.mjs` | Integrations panel, AI features (stubbed Anthropic), NL search, quick capture, merge |
