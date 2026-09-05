import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

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
