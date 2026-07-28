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

// Direct send: when the user has connected the extension to their hosted
// Hearth (URL + passphrase in settings), captures POST straight to the app's
// /api/captures queue. The API allows cross-origin requests, so no extra
// host permissions are needed.
async function sendQueue() {
  const { settings, captured = [] } = await chrome.storage.local.get(["settings", "captured"]);
  if (!settings || !settings.url || !settings.pass) return { skipped: true };
  if (!captured.length) return { sent: 0 };
  try {
    const r = await fetch(new URL("api/captures", settings.url.replace(/\/?$/, "/")), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + settings.pass,
      },
      body: JSON.stringify({ people: captured }),
    });
    if (!r.ok) return { error: r.status };
    await chrome.storage.local.set({ captured: [], lastSent: Date.now() });
    return { sent: captured.length };
  } catch (e) {
    return { error: "network" };
  }
}

let sendTimer = null;
function scheduleSend() {
  clearTimeout(sendTimer);
  sendTimer = setTimeout(sendQueue, 1200);
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "sendQueue") {
    sendQueue().then(sendResponse);
    return true;
  }
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
  if (area === "local" && changes.captured) {
    updateBadge();
    const grew = (changes.captured.newValue || []).length > (changes.captured.oldValue || []).length;
    if (grew) scheduleSend();
  }
});
chrome.runtime.onInstalled.addListener(updateBadge);
chrome.runtime.onStartup.addListener(updateBadge);
