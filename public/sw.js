self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Fetch handler — Chrome requires this to call respondWith() for PWA installability.
// We use a simple network-first strategy: serve from network and cache for offline.
self.addEventListener("fetch", (event) => {
  // Only handle GET requests; skip cross-origin, chrome-extension, etc.
  if (
    event.request.method !== "GET" ||
    !event.request.url.startsWith(self.location.origin)
  ) {
    return;
  }
  event.respondWith(
    fetch(event.request).catch(async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      // Fallback response for offline PWA requirement
      return new Response(
        "<html><body><h1>You are offline.</h1><p>Please check your connection.</p></body></html>",
        { headers: { "Content-Type": "text/html" } }
      );
    }),
  );
});

self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const isDashboard = (data.url || "").includes("/dashboard") || (data.tag || "").startsWith("vk-dash");
  const title = data.title || (isDashboard ? "Vidya's Kitchen Dashboard" : "Vidya's Kitchen");
  const defaultIcon = isDashboard ? "/dashboard-icon-192.png" : "/icon-192.png";
  const options = {
    body: data.body || "",
    icon: data.icon || defaultIcon,
    badge: data.badge || defaultIcon,
    tag: data.tag || (isDashboard ? "vk-dashboard-order" : "vk-order"),
    data: { url: data.url || (isDashboard ? "/dashboard" : "/") },
  };
  if (Array.isArray(data.actions) && data.actions.length > 0) {
    options.actions = data.actions;
  }
  // High-priority alerts (drivers and kitchen dashboard orders) buzz and stay on screen
  if (data.urgent) {
    options.requireInteraction = true;
    options.renotify = true;
    options.vibrate = [220, 90, 220, 90, 220];
  }

  // Home-screen icon number. Kitchen and driver alerts carry the live count of
  // waiting orders; an alert without one (e.g. "driver arrived") leaves the
  // badge as it is rather than resetting it to 1.
  const isDriver = (data.url || "").includes("/driver") || (data.tag || "").startsWith("vk-driver");
  if (typeof navigator !== "undefined" && "setAppBadge" in navigator) {
    if (typeof data.badgeCount === "number") {
      if (data.badgeCount > 0) navigator.setAppBadge(data.badgeCount).catch(() => {});
      else navigator.clearAppBadge().catch(() => {});
    } else if (!isDashboard && !isDriver) {
      navigator.setAppBadge(1).catch(() => {});
    }
  }

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const raw = event.notification.data?.url || "/";
  const target = new URL(raw, self.location.origin).href;
  const isDriver = /\/driver(\/|$|\?)/.test(target);
  const isDashboard = /\/dashboard(\/|$|\?)/.test(target);

  // Kitchen and driver badges count waiting orders, so opening one alert must
  // not zero them — the app resets the number itself once it loads the list.
  if (!isDriver && !isDashboard && typeof navigator !== "undefined" && "clearAppBadge" in navigator) {
    navigator.clearAppBadge().catch(() => {});
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Correctly isolate: Customer app, Driver app, and Dashboard app
      const match = clients.find((client) => {
        const path = new URL(client.url).pathname;
        if (isDriver) return path.startsWith("/driver");
        if (isDashboard) return path.startsWith("/dashboard");
        return !path.startsWith("/driver") && !path.startsWith("/dashboard");
      });
      if (match && "focus" in match) {
        if ("navigate" in match) match.navigate(target);
        return match.focus();
      }
      return self.clients.openWindow(target);
    }),
  );
});
