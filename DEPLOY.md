# Deploying Hearth

Optional. The app is fully functional as a local file — deploying adds sync across your devices, sharing, and the daily digest notification.

## Vercel (recommended, ~5 minutes, free tier)

**1. Deploy**
1. [vercel.com](https://vercel.com) → **Sign up with GitHub**.
2. **Add New… → Project** → import `bradbartel101/PersonalDexB` → framework preset **Other** (it reads `vercel.json`) → **Deploy**.
3. You get a URL like `https://personal-dex-b.vercel.app`. It works immediately in local-only mode.

**2. Add the database**
- Project → **Storage → Create Database → Upstash (Redis)** → free plan → **Connect**.
  This injects the Redis credentials automatically (`KV_REST_API_*` or `UPSTASH_REDIS_REST_*` — the API accepts either).

**3. Set environment variables** — Settings → Environment Variables:
- `HEARTH_PASSPHRASE` — a passphrase you choose. **This is the entire login**, so make it long.
- `CRON_SECRET` — any random string. Vercel sends it with the daily digest cron.

**4. Redeploy** — Deployments → ⋯ → **Redeploy**, so the variables take effect.

**5. Use it**
- Open the site, enter the passphrase once per device. Everyone with the URL + passphrase shares one live workspace.
- **iPad / phone**: Safari → Share → **Add to Home Screen**. Hearth installs as an app with an offline shell.
- **Daily reminders**: sidebar → **Enable daily reminders**, per device. Fires each morning (15:00 UTC; change the schedule in `vercel.json`) only on days someone is actually due. On iOS this requires opening the Home-Screen-installed app first — an Apple rule, not ours. VAPID keys generate themselves server-side.

## GitHub Pages

Already wired: `.github/workflows/deploy.yml` publishes `public/` to the `gh-pages` branch on every push to the main branch, serving at
`https://bradbartel101.github.io/PersonalDexB/`.

Pages has no backend, so this build is **local-only per device** — no sync, no push. Good as a always-available bookmark; use Vercel if you want your iPad and laptop to see the same data.

## Security model

- One shared passphrase = one shared workspace. Anyone holding it can read **and write** everything. Share it like a house key; rotate by changing the env var and redeploying (everyone re-enters it).
- Traffic is HTTPS; the passphrase is compared server-side in constant time; data lives in your own Upstash Redis instance.
- This is friends-and-family security — not per-user accounts with audit trails. Don't put anything in it you couldn't stand a friend seeing.
- Sync is last-write-wins per save with 25-second polling. Fine for a handful of people; not built for two people editing the same profile in the same second.
- The repo being public exposes **code only** — never your contacts. Keep `hearth-backup-*.json` files out of git.

## Local development

```sh
npm install
npm run build             # rebuild hearth*.html from src/
node dev-server.mjs       # http://127.0.0.1:8787, passphrase "test-pass"
npm test                  # full suite
```
