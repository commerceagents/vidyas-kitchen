self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || "Vidya's Kitchen";
  const options = {
    body: data.body || "",
    icon: data.icon || "/icon-192.png",
    badge: data.badge || data.icon || "/icon-192.png",
    tag: data.tag || "vk-order",
    data: { url: data.url || "/" },
  };
  if (Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions;
  }
  // A driver on the road has the phone in a pocket, so those alerts ask to
  // buzz and to stay on screen until acted on. Customer updates stay quiet.
  if (data.urgent) {
    options.requireInteraction = true;
    options.renotify = true;
    options.vibrate = [220, 90, 220, 90, 220];
  }
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data?.url || "/";
  const target = new URL(raw, self.location.origin).href;
  const isDriver = /\/driver(\/|$|\?)/.test(target);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // The food app and the driver app share this worker. Focusing "any
      // window on this origin" would open a delivery inside the customer PWA.
      const match = clients.find((client) => {
        const path = new URL(client.url).pathname;
        return isDriver ? path.startsWith("/driver") : !path.startsWith("/driver") && !path.startsWith("/dashboard");
      });
      if (match && "focus" in match) {
        if ("navigate" in match) match.navigate(target);
        return match.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
