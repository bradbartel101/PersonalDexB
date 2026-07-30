# Deploying Hearth with shared cloud sync

The repo is Vercel-ready: static app in `public/`, API in `api/`, config in `vercel.json`. About five minutes, all free tier.

## 1. Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **Sign up with GitHub**.
2. **Add New… → Project** → import `bradbartel101/PersonalDexB` → framework preset **Other** (it reads `vercel.json`) → **Deploy**.
3. You'll get a URL like `https://personal-dex-b.vercel.app`. The app works immediately in local-only mode; sync needs the next two steps.

## 2. Add the database

1. In the project: **Storage → Create Database → Upstash (Redis)** → free plan → **Connect**.
   This injects the Redis env vars (`KV_REST_API_URL`/`KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_*` — the API accepts either).

## 3. Set the environment variables

1. **Settings → Environment Variables** → add `HEARTH_PASSPHRASE` = a passphrase you choose (this is the whole login — make it long).
2. Add `CRON_SECRET` = any random string. Vercel automatically sends it with the daily cron that fires the reminder digest (`vercel.json` schedules `/api/notify` at 15:00 UTC ≈ 8am Pacific — edit the schedule there if you want a different hour).
3. **Deployments → ⋯ → Redeploy** so the env vars take effect.

## 4. Use it

- Open the site → the sidebar asks for the passphrase → enter it once per device (phone, iPad, laptop). Everyone with the URL + passphrase shares one live workspace.
- **iPad / phone**: use Safari's Share → **Add to Home Screen** — Hearth installs as an app (icon, standalone window, offline shell).
- **Daily reminders**: click **Enable daily reminders** in the sidebar on each device that should get the morning digest ("3 people to reach out to · Maya, James, Sam"). Quiet days send nothing. On iPhone/iPad, notifications require the Home-Screen-installed app (an iOS rule), so install first, then enable inside it. VAPID keys generate themselves server-side — no key setup.
- **Extension**: popup → **Connect to Hearth** → paste the site URL + passphrase. From then on, "Save to Hearth" on LinkedIn sends captures straight to the site — a **Review captures** button appears in the sidebar on every device.

## Security model (read this once)

- One shared passphrase = one shared workspace. Anyone holding it can read **and write** everything. Share it like a house key, rotate it by changing the env var (everyone re-enters it).
- Traffic is HTTPS; the passphrase is checked server-side with a constant-time compare; data lives in your Upstash Redis.
- This is friends-and-family security, not per-user accounts with audit trails. For this app's purpose that's a reasonable trade — but don't put anything in it you couldn't stand a friend seeing.
- Sync is last-write-wins per save with 25s polling: fine for a handful of people, not built for two people editing the same profile in the same second.

## Local development

```sh
npm install
npm run build        # rebuild hearth*.html from src/
node dev-server.mjs  # http://127.0.0.1:8787, passphrase "test-pass"
npm run test:sync    # end-to-end two-device sync test
```
