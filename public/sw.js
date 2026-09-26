self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Full-screen offline page. The three installed apps share this worker, so the
 * look follows the URL: light kitchen app, yellow admin, red driver.
 * Customer desktop (the dark landing) flips at the same 1024px breakpoint as
 * the site itself.
 */
function offlineKind(url) {
  const path = new URL(url).pathname;
  if (path === "/dashboard" || path.startsWith("/dashboard/")) return "dashboard";
  if (path === "/driver" || path.startsWith("/driver/")) return "driver";
  return "customer";
}

function offlineDocument(kind) {
  const themes = {
    customer: {
      brand: "Vidya's Kitchen",
      title: "You're offline",
      body: "We can't reach the kitchen right now. Check your connection, then refresh.",
      bg: "#F5F5F7",
      fg: "#1A1A1A",
      muted: "rgba(0,0,0,0.52)",
      eyebrow: "rgba(0,0,0,0.42)",
      accent: "#BD2320",
      accentFg: "#ffffff",
      markBg: "rgba(189,35,32,0.08)",
      markBorder: "rgba(189,35,32,0.18)",
      glow: "rgba(189,35,32,0.18)",
      theme: "#F5F5F7",
      scheme: "light",
    },
    dashboard: {
      brand: "Admin",
      title: "You're offline",
      body: "New orders won't come through until you're back online.",
      bg: "#0d0d0d",
      fg: "#ffffff",
      muted: "rgba(255,255,255,0.55)",
      eyebrow: "rgba(245,227,45,0.9)",
      accent: "#f5e32d",
      accentFg: "#111111",
      markBg: "rgba(245,227,45,0.08)",
      markBorder: "rgba(245,227,45,0.28)",
      glow: "rgba(245,227,45,0.16)",
      theme: "#0d0d0d",
      scheme: "dark",
    },
    driver: {
      brand: "VK's Driver",
      title: "You're offline",
      body: "New drops won't show until you're back online.",
      bg: "#0a0a0a",
      fg: "#ffffff",
      muted: "rgba(255,255,255,0.55)",
      eyebrow: "rgba(255,255,255,0.46)",
      accent: "#E84040",
      accentFg: "#ffffff",
      markBg: "rgba(232,64,64,0.12)",
      markBorder: "rgba(232,64,64,0.32)",
      glow: "rgba(232,64,64,0.2)",
      theme: "#0a0a0a",
      scheme: "dark",
    },
  };
  const t = themes[kind] || themes.customer;
  const desktop =
    kind === "customer"
      ? `@media (min-width: 1025px) {
          :root { color-scheme: dark; }
          body { background: #0d0d0d; color: #fff; }
          .glow { background: radial-gradient(circle at 50% 38%, rgba(189,35,32,0.32), transparent 58%); }
          .brand { color: rgba(255,255,255,0.45); }
          h1 { color: #fff; }
          .sub { color: rgba(255,255,255,0.58); }
          .mark { background: rgba(189,35,32,0.16); border-color: rgba(189,35,32,0.4); color: #ff8a86; }
        }`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="${t.theme}">
<meta name="color-scheme" content="${t.scheme}">
<title>${t.title} · ${t.brand}</title>
<style>
  :root { color-scheme: ${t.scheme}; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; }
  body {
    min-height: 100dvh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom));
    background: ${t.bg};
    color: ${t.fg};
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .glow {
    position: fixed;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at 50% 38%, ${t.glow}, transparent 58%);
  }
  main {
    position: relative;
    z-index: 1;
    width: min(100%, 360px);
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .mark {
    width: 88px;
    height: 88px;
    border-radius: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: ${t.markBg};
    border: 1px solid ${t.markBorder};
    color: ${t.accent};
    margin-bottom: 22px;
  }
  .brand {
    margin: 0 0 8px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: ${t.eyebrow};
  }
  h1 {
    margin: 0;
    font-size: 28px;
    line-height: 1.15;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: ${t.fg};
  }
  .sub {
    margin: 12px 0 0;
    max-width: 280px;
    font-size: 15px;
    line-height: 1.5;
    font-weight: 500;
    color: ${t.muted};
  }
  button {
    margin-top: 28px;
    appearance: none;
    -webkit-appearance: none;
    border: 0;
    cursor: pointer;
    height: 48px;
    padding: 0 28px;
    border-radius: 14px;
    background: ${t.accent};
    color: ${t.accentFg};
    font: inherit;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.01em;
    -webkit-tap-highlight-color: transparent;
  }
  button:active { transform: scale(0.98); }
  ${desktop}
</style>
</head>
<body>
  <div class="glow" aria-hidden="true"></div>
  <main>
    <div class="mark" aria-hidden="true">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h.01"/>
        <path d="M8.5 16.429a5 5 0 0 1 7 0"/>
        <path d="M5 12.859a10 10 0 0 1 5.17-2.69"/>
        <path d="M19 12.859a10 10 0 0 0-2.007-1.523"/>
        <path d="M2 8.82a15 15 0 0 1 4.177-2.643"/>
        <path d="M22 8.82a15 15 0 0 0-11.288-3.764"/>
        <path d="m2 2 20 20"/>
      </svg>
    </div>
    <p class="brand">${t.brand}</p>
    <h1>${t.title}</h1>
    <p class="sub">${t.body}</p>
    <button type="button" id="refresh">Refresh</button>
  </main>
  <script>
    document.getElementById("refresh").addEventListener("click", function () {
      location.reload();
    });
    window.addEventListener("online", function () {
      location.reload();
    });
    ${
      kind === "customer"
        ? `if (window.matchMedia("(min-width: 1025px)").matches) {
            var meta = document.querySelector('meta[name="theme-color"]');
            if (meta) meta.setAttribute("content", "#0d0d0d");
          }`
        : ""
    }
  </script>
</body>
</html>`;
}

// Fetch handler — Chrome requires this to call respondWith() for PWA installability.
// Network first. A failed document load gets the themed offline screen; other
// requests fail as offline instead of returning that HTML as if it were JSON.
self.addEventListener("fetch", (event) => {
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
      if (event.request.mode === "navigate") {
        return new Response(offlineDocument(offlineKind(event.request.url)), {
          status: 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          },
        });
      }
      return new Response("", { status: 503, statusText: "Offline" });
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
