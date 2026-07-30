/* Hearth service worker: offline shell + daily-digest push notifications.
   All paths are relative so this works at a domain root or a subpath. */
const CACHE = "hearth-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.add("./").catch(() => {})));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.pathname.includes("/api/")) return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        const copy = r.clone();
        caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {});
        return r;
      })
      .catch(() =>
        caches.match(e.request).then((m) => m || caches.match("./"))
      )
  );
});

self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { /* plain text push */ }
  e.waitUntil(
    self.registration.showNotification(d.title || "Hearth", {
      body: d.body || "",
      icon: "icon-192.png",
      badge: "icon-192.png",
      tag: "hearth-digest",
      data: { url: d.url || "./" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) if ("focus" in c) return c.focus();
      return self.clients.openWindow(e.notification.data.url || "./");
    })
  );
});
