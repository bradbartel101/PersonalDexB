# Hearth — LinkedIn capture extension

Captures the LinkedIn profile you're currently viewing — name, headline, company, location, profile URL, and **photo** — into a queue you import into Hearth. This is the same mechanism Dex uses: your own browser, your own logged-in session, one profile at a time on your click. No crawling, no automation, no credentials leave your browser.

## Install (Chrome / Edge / Brave)

1. Download and unzip `hearth-extension.zip` (or use this folder directly).
2. Open `chrome://extensions`, turn on **Developer mode** (top right).
3. Click **Load unpacked** and select the unzipped folder.

## Use

1. Browse to any LinkedIn profile (`linkedin.com/in/...`).
2. Click the green **Save to Hearth** button (bottom-right). The badge on the extension icon counts queued captures.
3. Open the extension popup → **Copy JSON** (or **Download**).
4. In Hearth: **LinkedIn / CSV import** → paste the JSON or pick the file → review, assign a group, import. Existing people are matched by LinkedIn URL or name and updated in place (photo included) instead of duplicated.

## Notes

- LinkedIn changes its page structure often. The extension reads several fallback locations (including page metadata), but if a field comes back empty after a LinkedIn redesign, the selectors in `content.js` may need a refresh.
- Photos are downscaled to ~160px before storing, so captures stay small.
- Captured data lives only in your browser's extension storage until you clear it.
