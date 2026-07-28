# Hearth — Personal CRM

A single-file personal relationship manager modeled on Dex Pro, for one user, no login. Built as a React app bundled into self-contained HTML — no CDNs, fonts and React are inlined. The build produces two outputs:

- **`hearth-standalone.html`** — a complete document you can open directly in any browser; all data persists in `localStorage`
- **`hearth.html`** — a fragment build for publishing as a Claude artifact (prefers the host's `window.storage` API, falls back to `localStorage`)

## The daily loop

Open app → **Today** shows who's overdue (by cadence + last interaction, most overdue first) → log the interaction or snooze in one tap → done.

## Features

- **Contacts**: name, photo (initials avatar fallback), "how we met" context, email/phone/company/role/location/birthday, custom fields (incl. social handles), rich notes, tags, and groups
- **Keep-in-touch cadence**: none / weekly / monthly / quarterly / yearly / custom days; logging an interaction resets the clock, snooze pushes the due date
- **Interaction timeline**: call / coffee / message / email / note entries, newest first
- **Today dashboard**: overdue reach-out list with inline quick-log + snooze; birthdays and reminders in the next 30 days
- **People view**: search (`/`), filter by group / tag / cadence status, list ⇄ grid toggle, quick add by name (`n`)
- **Data**: JSON export/restore, CSV contact import — including LinkedIn's `Connections.csv` (skips the Notes preamble, joins First/Last Name, maps URL → LinkedIn field, Position → role, Connected On → context) — and clearable sample data
- **Stats**: circle size, overdue count, quietest contact
- Light + dark themes, keyboard shortcuts (`n`, `/`, `esc`)

### Pro capabilities

- **History**: a global feed of every interaction across all contacts, filterable by type
- **Important dates**: per-contact recurring dates (anniversaries, traditions) that surface in the 30-day dashboard alongside birthdays and reminders
- **Starred contacts**: star from the list or profile, filter to starred
- **Archiving**: hide people from Today, People, and stats without deleting their history
- **Bulk actions**: select multiple contacts and tag, group, set cadence, star, archive, or delete in one pass
- **Merge duplicates**: finds entries sharing a name or email and merges fields, tags, notes, and full timelines into the fullest entry
- **Sorting**: A–Z, recently touched, or most overdue
- **Quick actions**: one-click `mailto:` / `tel:` from profile fields
- **Relationship insights**: interactions logged and typical gap between them, per contact

## Online access

Every push deploys to GitHub Pages via `.github/workflows/deploy.yml`:

- **App**: https://bradbartel101.github.io/PersonalDexB/
- **Extension**: https://bradbartel101.github.io/PersonalDexB/hearth-extension.zip

Data persists in the browser's `localStorage` for that origin, so use the same browser (and export JSON backups from the sidebar).

## LinkedIn integration

LinkedIn's official API does not allow third-party apps to read connections or photos, so Hearth uses the same mechanism Dex does — your own browser:

1. **Browser extension** (`extension/`, MV3): while you browse LinkedIn, a "Save to Hearth" button on any profile captures name, headline, company, location, profile URL, and photo (downscaled to ~160px). Captures queue in the extension popup; copy as JSON or download, then import in the app.
2. **Connections.csv**: LinkedIn's data export imports the whole network (no photos — LinkedIn omits them from exports).

Both channels flow through an import review modal: check who to bring in, assign a group and tag, and anyone matching an existing contact (by LinkedIn URL, then name) is updated in place — photo included, timelines preserved — instead of duplicated.

## Persistence

A storage adapter prefers the artifact storage API (`window.storage`) when the host provides it, falls back to `localStorage`, and degrades to in-memory with a visible warning banner (plus export/restore) when neither is available. JSON export uses the artifact `downloads` capability when present, with an anchor-download fallback.

## Development

```sh
npm install
npm run build   # bundles src/ into hearth.html
npm test        # Playwright smoke tests against the built file
```

- `src/app.jsx` — the entire app
- `src/styles.css` — design tokens (light/dark) + components
- `fonts-inline.css` — Bricolage Grotesque + Instrument Sans as woff2 data URIs
- `build.mjs` — esbuild bundle + HTML assembly
