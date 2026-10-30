// Sample mode: the app as shown inside the iPhone Duo viewer on the arisetodo.com homepage
// (/duo-preview.html?sample=1). Visitors get a made-up profile to try, not anyone's real account:
//
//  - it never reads or writes the visitor's own sign-in (the arise_session cookie and its copy);
//  - every /api/ call is answered right here in the browser, so nothing reaches the server and
//    nothing is saved to any account;
//  - what the visitor changes lives only in this browser tab (sessionStorage, under "arise-sample:"):
//    the frames of the viewer share it while the tab is open, and it is gone when the tab closes —
//    the next visitor, or the same one tomorrow, starts from the same fresh sample.
//
// Only frames inside the viewer page with ?sample=1 are in sample mode; the app on its own never is.

export const SAMPLE_TOKEN = "arise-sample-preview";
export const SAMPLE_USER = {
  id: -4242,
  username: "sample-duo",
  displayName: "Sample",
  isAdmin: false,
  role: "todo",
  accountApproved: true,
  approvedByTeacher: true,
  assessmentPromptShown: true,
  mustChangePassword: false,
};

const PREFIX = "arise-sample:";
let cached: boolean | null = null;

/** Is this page a frame of the sample Duo viewer (at any depth: the split screen's panes count too)? */
export function isSampleMode(): boolean {
  if (cached !== null) return cached;
  cached = false;
  if (typeof window === "undefined") return false;
  try {
    let w: Window = window;
    for (let hops = 0; hops < 6 && w !== w.parent; hops++) {
      w = w.parent;
      if (w.location.origin !== window.location.origin) break;
      if (w.location.pathname === "/duo-preview.html" && new URLSearchParams(w.location.search).get("sample") === "1") { cached = true; break; }
    }
  } catch { /* a frame from another site: not ours */ }
  return cached;
}

/** Storage that lasts only for this tab, kept apart from the visitor's own app data. */
function tabStorage(): Storage {
  const real = window.sessionStorage;
  const keys = () => Object.keys(real).filter((k) => k.startsWith(PREFIX)).map((k) => k.slice(PREFIX.length));
  return {
    get length() { return keys().length; },
    key: (i: number) => keys()[i] ?? null,
    getItem: (k: string) => real.getItem(PREFIX + k),
    setItem: (k: string, v: string) => { try { real.setItem(PREFIX + k, String(v)); } catch { /* full: just not kept */ } },
    removeItem: (k: string) => real.removeItem(PREFIX + k),
    clear: () => { for (const k of keys()) real.removeItem(PREFIX + k); },
  } as Storage;
}

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
};

/** The sample LifeHub everyone starts from. */
function sampleTodo() {
  const now = new Date().toISOString();
  const t = (id: string, title: string, listId: string, due: string, extra: Record<string, unknown> = {}) =>
    ({ id, title, notes: "", listId, assignee: "", due, time: "", priority: "normal", repeat: "none", done: false, createdAt: now, ...extra });
  return {
    version: 2,
    lists: [
      { id: "personal", name: "Personal", color: "#7566e8" },
      { id: "work", name: "Work", color: "#f59e72" },
      { id: "family", name: "Family", color: "#36b6a5" },
    ],
    tasks: [
      t("s1", "Try the split screen from the Duo menu", "personal", day(0), { priority: "high" }),
      t("s2", "Pick up groceries", "family", day(0), { time: "17:30" }),
      t("s3", "Send the weekly update", "work", day(1)),
      t("s4", "Book a dentist appointment", "personal", day(2)),
      t("s5", "Plan Saturday's family outing", "family", day(4)),
      t("s6", "Water the plants", "personal", day(-1), { done: true, completedAt: now }),
    ],
  };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** One saved copy per hub, for this tab only. */
function workspaceRoute(kind: "todo" | "work", method: string, url: URL, body: string | null): Response {
  const key = `${PREFIX}workspace:${kind}`;
  const read = () => { try { return JSON.parse(sessionStorage.getItem(key) || "null") as { workspace: unknown; updatedAt: string } | null; } catch { return null; } };
  if (method === "PUT") {
    let workspace: unknown = null;
    try { workspace = (JSON.parse(body || "{}") as { workspace?: unknown }).workspace ?? null; } catch { /* left as it was */ }
    const updatedAt = new Date().toISOString();
    try { sessionStorage.setItem(key, JSON.stringify({ workspace, updatedAt })); } catch { /* too big: not kept */ }
    return json(200, { success: true, updatedAt });
  }
  const saved = read();
  const since = url.searchParams.get("since");
  if (saved && since && since === saved.updatedAt) return json(200, { unchanged: true });
  if (saved) return json(200, { workspace: saved.workspace, updatedAt: saved.updatedAt });
  return json(200, { workspace: kind === "todo" ? sampleTodo() : {}, updatedAt: null, seats: null });
}

/** Called first thing (main.tsx imports lib/sampleBoot.ts before anything else). */
export function installSampleMode(): void {
  if (!isSampleMode()) return;
  document.documentElement.dataset.sample = "1";
  // The app's own remembered choices (layout, night mode, drafts…) go to this tab's sample space.
  try { Object.defineProperty(window, "localStorage", { configurable: true, value: tabStorage() }); } catch { /* older browser */ }
  // The visitor's own sign-in cookie is invisible here, and nothing here can write one.
  try { Object.defineProperty(document, "cookie", { configurable: true, get: () => "", set: () => {} }); } catch { /* older browser */ }
  const network = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(href, window.location.href);
    if (url.origin !== window.location.origin || !url.pathname.startsWith("/api/")) return network(input, init);
    const method = String(init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    const body = typeof init?.body === "string" ? init.body : null;
    if (url.pathname === "/api/arise-todo/workspace") return workspaceRoute("todo", method, url, body);
    if (url.pathname === "/api/teacher-hub/workspace") return workspaceRoute("work", method, url, body);
    if (url.pathname === "/api/me") return json(200, SAMPLE_USER);
    // Spoken lines: the real AI voice (nothing about anyone is sent, only the words on screen).
    if (url.pathname === "/api/voice/say") return network(input, init);
    // Anything else needs a real account: a quiet "not here" instead of a call to the server.
    return json(method === "GET" ? 404 : 403, { message: "This is a sample — create a free account to use this." });
  };
}

/** "Sign out" in the sample: start over from the fresh sample. */
export function resetSample(): void {
  try { for (const k of Object.keys(sessionStorage)) if (k.startsWith(PREFIX)) sessionStorage.removeItem(k); } catch { /* fine */ }
}
