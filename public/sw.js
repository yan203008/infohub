self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }
  const title = payload.title || "InfoHub";
  const options = {
    body: payload.body || "新一期内容已经整理好了。",
    icon: "./favicon.svg",
    badge: "./favicon.svg",
    tag: payload.date ? `infohub-daily-${payload.date}` : "infohub-notification",
    data: { url: payload.url || "./" },
  };
  event.waitUntil(Promise.all([
    self.registration.showNotification(title, options),
    "setAppBadge" in self.navigator ? self.navigator.setAppBadge(1) : Promise.resolve(),
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    if ("clearAppBadge" in self.navigator) await self.navigator.clearAppBadge();
    const targetUrl = new URL(event.notification.data?.url || "./", self.location.origin).href;
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url.startsWith(self.location.origin));
    if (existing) {
      await existing.navigate(targetUrl);
      return existing.focus();
    }
    return self.clients.openWindow(targetUrl);
  })());
});
