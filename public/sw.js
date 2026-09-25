/*
 * FineX service worker — alerts only.
 *
 * It shows the notification the server pushes when a watched wallet moves, and
 * opens the desk when the notification is pressed. Nothing else: there is no
 * fetch handler, so it never intercepts, caches or serves a page, and the app
 * behaves exactly as it does without it.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const text = (v, fallback) => (typeof v === "string" && v ? v : fallback);
  // Only a path inside this app is ever opened from a notification.
  const url = typeof data.url === "string" && data.url.startsWith("/") && !data.url.startsWith("//") ? data.url : "/dashboard";
  event.waitUntil(
    self.registration.showNotification(text(data.title, "FineX"), {
      body: text(data.body, "A watched wallet has moved. Open the desk."),
      tag: text(data.tag, "finex-watch"),
      icon: "/apple-icon",
      data: { url },
      requireInteraction: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/dashboard", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })(),
  );
});
