import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import "./login-mobile-fix.css";

// arisereader.com/hub (or /teacher-hub) goes straight to the Arise WorkHub sign-in.
{
  const path = window.location.pathname.replace(/\/+$/, "").toLowerCase();
  if (path === "/hub" || path === "/teacher-hub" || path === "/workhub") {
    window.history.replaceState(null, "", "/" + window.location.search + "#/workhub");
  } else if (path === "/to-do" || path === "/todo" || path === "/arise-todo" || path === "/lifehub") {
    window.history.replaceState(null, "", "/" + window.location.search + "#/lifehub");
  }
}

// The service worker is what lets the Home Screen app show notifications.
if ("serviceWorker" in navigator && window.location.protocol === "https:") {
  window.addEventListener("load", () => { navigator.serviceWorker.register("/sw.js").catch(() => {}); });
}

if (!window.location.hash) {
  window.location.hash = "#/";
}

// Global fetch interceptor - retries transient 401/503 errors
const originalFetch = window.fetch;
window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const retries = 3;
  const delayMs = 1000;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await originalFetch(input, init);
      // Retry on 401 (transient session) or 503 (transient server)
      if ((res.status === 401 || res.status === 503) && attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs));
        continue;
      }
      return res;
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delayMs));
      } else {
        throw err;
      }
    }
  }
  return new Response(JSON.stringify({ message: "Service temporarily unavailable" }), {
    status: 503,
    headers: { "Content-Type": "application/json" },
  });
};

createRoot(document.getElementById("root")!).render(<App />);
