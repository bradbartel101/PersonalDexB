// Service worker: fetches profile images (host permission avoids CORS/tainting)
// and keeps the badge showing how many captures are queued.

function toBase64(buf) {
  const bytes = new Uint8Array(buf);
  let out = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    out += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(out);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "fetchImage" && typeof msg.url === "string") {
    fetch(msg.url, { credentials: "omit" })
      .then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.blob();
      })
      .then(async (blob) => {
        const buf = await blob.arrayBuffer();
        sendResponse({ ok: true, b64: toBase64(buf), mime: blob.type || "image/jpeg" });
      })
      .catch(() => sendResponse({ ok: false }));
    return true; // async response
  }
});

async function updateBadge() {
  const { captured = [] } = await chrome.storage.local.get("captured");
  chrome.action.setBadgeText({ text: captured.length ? String(captured.length) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#2E6B57" });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.captured) updateBadge();
});
chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
