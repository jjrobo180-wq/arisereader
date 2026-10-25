// Podscroll: real podcasts in a feed you swipe like short videos, as its own website.
// No account: what someone picks, follows, likes and saves is kept in this browser. Podcast data,
// likes, comments and share counts come from the Arise server's public /api/podscroll routes
// (server/earshot.ts registerPodscrollRoutes), which read Apple Podcasts. Audio plays straight
// from each podcast's own host.
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { applySignal, cleanEarshot, emptyEarshot, type Earshot, type Signal } from "@shared/earshot";
import { Player, Setup } from "../client/src/components/family-hub/earshot/EarshotPlayer";
import "./styles.css";

const API = String(import.meta.env.VITE_PODSCROLL_API || "https://arisereader.onrender.com").replace(/\/$/, "");
const KEY = "podscroll.v1";
const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private window: works, just isn't kept */ } };

function deviceId(): string {
  const saved = read("podscroll.device");
  if (saved && /^[A-Za-z0-9_-]{16,40}$/.test(saved)) return saved;
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  const id = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  write("podscroll.device", id);
  return id;
}

function App() {
  const device = useMemo(deviceId, []);
  const [es, setEs] = useState<Earshot>(() => { try { return cleanEarshot(JSON.parse(read(KEY) || "null")); } catch { return emptyEarshot(); } });
  const esRef = useRef(es); esRef.current = es;
  const [nickname, setNicknameState] = useState(() => read("podscroll.name") || "");
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState("");
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const s = (q.get("s") || "").replace(/\D/g, ""), e = (q.get("e") || "").replace(/\D/g, "");
    return s && e ? { showId: s, episodeId: e } : null;
  }, []);

  useEffect(() => { const t = setTimeout(() => write(KEY, JSON.stringify(es)), 200); return () => clearTimeout(t); }, [es]);
  useEffect(() => { if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);

  const update = useCallback((fn: (e: Earshot) => Earshot) => setEs((e) => fn(e)), []);
  const say = useCallback((m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2600); }, []);
  const setNickname = useCallback((n: string) => { setNicknameState(n); write("podscroll.name", n); }, []);

  const api = useCallback(async (path: string, init?: { method?: string; body?: unknown }) => {
    const url = API + path.replace(/^\/api\/earshot/, "/api/podscroll");
    let res: Response;
    try {
      res = await fetch(url, {
        method: init?.method ?? "GET",
        headers: { "X-Podscroll-Device": device, ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch { throw new Error("Can't reach Podscroll right now. Check your connection and try again."); }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body?.message || "Something went wrong. Try again."), { status: res.status });
    return body;
  }, [device]);
  // Audio comes through the server so smart ad skip can find the ads in this copy.
  const mediaUrl = useCallback((path: string) => API + path.replace(/^\/api\/earshot/, "/api/podscroll"), []);

  const pending = useRef<{ genre: string; signal: Signal }[]>([]);
  const signal = useCallback((genre: string, s: Signal) => {
    pending.current.push({ genre, signal: s });
    const list = pending.current; pending.current = [];
    setEs((e) => list.reduce((acc, x) => applySignal(acc, x.genre, x.signal), e));
  }, []);

  const shareLink = useCallback((show: { id: string }, ep: { id: string }) => `${location.origin}/?s=${show.id}&e=${ep.id}`, []);

  const body = !es.setupDone || editing
    ? <div className="min-h-full overflow-y-auto px-3 py-6 sm:py-10">
      <Setup brand="Podscroll" initial={es} student={false} onCancel={es.setupDone ? () => setEditing(false) : undefined} onDone={(genres, pace) => {
        setEs((e) => {
          const taste = { ...e.taste };
          for (const g of genres) taste[g] = Math.max(taste[g] ?? 0, 3);
          for (const g of e.genres) if (!genres.includes(g)) taste[g] = Math.min(taste[g] ?? 0.3, 0.6);
          return { ...e, setupDone: true, genres, pace, taste };
        });
        setEditing(false);
        say("Tap a cover to listen. Swipe up for the next one.");
      }} />
    </div>
    : <Player es={es} esRef={esRef} update={update} api={api} signal={signal} say={say} student={false} explicit={es.settings.explicit}
      onEditInterests={() => setEditing(true)} standalone shareLink={shareLink} nickname={nickname} setNickname={setNickname} start={start} mediaUrl={mediaUrl} />;

  return <>
    {body}
    <div role="status" aria-live="polite" className={`pointer-events-none fixed bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full bg-white px-4 py-2.5 text-center text-sm font-bold text-[#120e14] shadow-xl transition ${toast ? "opacity-100" : "translate-y-3 opacity-0"}`}>{toast}</div>
  </>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
