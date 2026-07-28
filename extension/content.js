// Injects a "Save to Hearth" button on LinkedIn profile pages (/in/<slug>).
// Captures only the profile you are viewing, on your click — no crawling,
// no automation. LinkedIn's DOM changes often, so every selector has fallbacks.

(() => {
  const BTN_ID = "hearth-capture-host";
  let lastPath = "";

  const meta = (p) =>
    (document.querySelector(`meta[property="${p}"]`) ||
      document.querySelector(`meta[name="${p}"]`))?.content || "";

  function profileUrl() {
    const canon = document.querySelector('link[rel="canonical"]')?.href || location.href;
    const m = canon.match(/^https:\/\/[^/]*linkedin\.com\/in\/[^/?#]+/i);
    return m ? m[0].replace(/^https:\/\/[^/]*linkedin\.com/i, "https://www.linkedin.com") : "";
  }

  function getName() {
    const h1 = document.querySelector("main h1, h1");
    let name = h1 ? h1.textContent.trim() : "";
    if (!name) {
      name = meta("og:title").replace(/\s*[|\-–]\s*LinkedIn.*$/i, "").split("|")[0].trim();
    }
    return name.replace(/\s+/g, " ");
  }

  function getPhotoSrc(name) {
    const sels = [
      ".pv-top-card-profile-picture__image--show",
      ".pv-top-card-profile-picture img",
      'img[class*="pv-top-card"]',
      ".profile-photo-edit__preview",
    ];
    for (const s of sels) {
      const el = document.querySelector(s);
      if (el && el.src && !el.src.startsWith("data:image/gif")) return el.src;
    }
    if (name) {
      const byAlt = [...document.querySelectorAll("main img")].find(
        (i) => i.alt && i.alt.trim() === name && (i.naturalWidth >= 80 || i.width >= 80)
      );
      if (byAlt) return byAlt.src;
    }
    const og = meta("og:image");
    return og && og.includes("licdn") ? og : "";
  }

  function getHeadline() {
    const el =
      document.querySelector(".text-body-medium.break-words") ||
      document.querySelector('[data-generated-suggestion-target] ~ .text-body-medium') ||
      document.querySelector("main section .text-body-medium");
    return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
  }

  function getLocation() {
    const el =
      document.querySelector(".text-body-small.inline.t-black--light.break-words") ||
      document.querySelector('main .pv-text-details__left-panel + * .text-body-small') ||
      document.querySelector("main span.text-body-small.inline");
    return el ? el.textContent.trim().replace(/\s+/g, " ") : "";
  }

  function getCompany() {
    const btn = document.querySelector('button[aria-label^="Current company"]');
    if (btn) {
      const m = (btn.getAttribute("aria-label") || "").match(/^Current company:\s*([^.]+)/i);
      if (m) return m[1].trim();
      const t = btn.textContent.trim();
      if (t) return t.replace(/\s+/g, " ");
    }
    const li = document.querySelector('ul.pv-text-details__right-panel li, [data-view-name="profile-card"] a[href*="/company/"]');
    return li ? li.textContent.trim().replace(/\s+/g, " ").slice(0, 80) : "";
  }

  function fetchImage(url) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: "fetchImage", url }, (resp) => {
          if (chrome.runtime.lastError || !resp || !resp.ok) return resolve(null);
          resolve("data:" + resp.mime + ";base64," + resp.b64);
        });
      } catch (e) { resolve(null); }
    });
  }

  function shrink(dataUri, max = 160) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const scale = Math.min(1, max / Math.max(img.width, img.height));
          const cv = document.createElement("canvas");
          cv.width = Math.max(1, Math.round(img.width * scale));
          cv.height = Math.max(1, Math.round(img.height * scale));
          cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
          resolve(cv.toDataURL("image/jpeg", 0.85));
        } catch (e) { resolve(dataUri); }
      };
      img.onerror = () => resolve(null);
      img.src = dataUri;
    });
  }

  async function capture(setState) {
    const url = profileUrl();
    const name = getName();
    if (!url || !name) { setState("No profile found", true); return; }
    setState("Saving…");

    const headline = getHeadline();
    let photo = null;
    const src = getPhotoSrc(name);
    if (src) {
      const raw = src.startsWith("data:") ? src : await fetchImage(src);
      if (raw) photo = await shrink(raw);
    }

    const person = {
      name,
      headline,
      company: getCompany(),
      role: "",
      location: getLocation(),
      photo,
      linkedin: url,
      capturedAt: new Date().toISOString(),
    };

    const { captured = [] } = await chrome.storage.local.get("captured");
    const next = captured.filter((p) => p.linkedin !== url);
    next.push(person);
    await chrome.storage.local.set({ captured: next });
    setState("Saved ✓ (" + next.length + " queued)");
  }

  function mountButton() {
    if (document.getElementById(BTN_ID)) return;
    const host = document.createElement("div");
    host.id = BTN_ID;
    const shadow = host.attachShadow({ mode: "closed" });
    shadow.innerHTML = `
      <style>
        .b {
          position: fixed; bottom: 22px; right: 22px; z-index: 2147483000;
          display: flex; align-items: center; gap: 8px;
          background: #2E6B57; color: #fff; border: none; cursor: pointer;
          font: 600 13.5px/1 system-ui, sans-serif; padding: 11px 16px;
          border-radius: 99px; box-shadow: 0 4px 16px rgba(0,0,0,.25);
        }
        .b:hover { background: #275C4B; }
        .b.err { background: #A64B2A; }
      </style>
      <button class="b" type="button">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="9.5" cy="12" r="6"/><circle cx="15.5" cy="12" r="6" opacity=".45"/>
        </svg>
        <span>Save to Hearth</span>
      </button>`;
    const btn = shadow.querySelector("button");
    const label = shadow.querySelector("span");
    const setState = (text, err) => {
      label.textContent = text;
      btn.classList.toggle("err", !!err);
      if (text !== "Saving…") setTimeout(() => {
        label.textContent = "Save to Hearth";
        btn.classList.remove("err");
      }, 2600);
    };
    btn.addEventListener("click", () => capture(setState));
    document.documentElement.appendChild(host);
  }

  function sync() {
    const onProfile = /^\/in\/[^/]+\/?$/.test(location.pathname);
    const existing = document.getElementById(BTN_ID);
    if (onProfile && !existing) mountButton();
    if (!onProfile && existing) existing.remove();
  }

  // LinkedIn is a SPA — watch for soft navigations.
  setInterval(() => {
    if (location.pathname !== lastPath) { lastPath = location.pathname; sync(); }
  }, 800);
  sync();
})();
