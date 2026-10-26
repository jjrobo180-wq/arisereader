// Podscroll (Pod+): real podcasts in a feed you swipe like short videos, as its own website.
// Everyone gets about a minute to try it, then signs up with an email code to keep going (the
// session is kept here). What someone picks, follows, likes and saves is kept in this browser. Podcast data,
// likes, comments and share counts come from the Arise server's public /api/podscroll routes
// (server/earshot.ts registerPodscrollRoutes), which read Apple Podcasts. Audio plays straight
// from each podcast's own host.
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { applySignal, cleanEarshot, emptyEarshot, type Earshot, type Signal } from "@shared/earshot";
import { Check, Loader2, Mail } from "lucide-react";
import { LIGHT_SHEETS_CSS, Player, Setup, useTheme } from "../client/src/components/family-hub/earshot/EarshotPlayer";
import { LIGHT_CSS } from "../client/src/components/family-hub/earshot/EarshotSocial";
import "./styles.css";

const API = String(import.meta.env.VITE_PODSCROLL_API || "https://arisereader.onrender.com").replace(/\/$/, "");
const KEY = "podscroll.v1";
/** Seconds of use (with the app on screen) before an account is needed. */
const TRIAL_SECS = 60;
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
  // Creators sign in with an email code (listening never needs it); the session is kept here.
  const [session, setSessionState] = useState(() => read("podscroll.session") || "");
  const setSession = useCallback((token: string | null) => { setSessionState(token || ""); if (token) write("podscroll.session", token); else { try { localStorage.removeItem("podscroll.session"); } catch { /* private window */ } } }, []);
  const [editing, setEditing] = useState(false);
  const { day } = useTheme();
  // The free minute: counted only while the app is on screen, kept so a reload doesn't reset it.
  const [used, setUsed] = useState(() => Math.max(0, Number(read("podscroll.trial")) || 0));
  useEffect(() => {
    if (session) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") setUsed((u) => { const n = u + 1; if (n % 5 === 0 || n >= TRIAL_SECS) write("podscroll.trial", String(n)); return n; }); }, 1000);
    return () => clearInterval(t);
  }, [session]);
  const locked = !session && used >= TRIAL_SECS;
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
        headers: { "X-Podscroll-Device": device, ...(session ? { "X-Podscroll-Session": session } : {}), ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}) },
        body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
      });
    } catch { throw new Error("Can't reach Pod+ right now. Check your connection and try again."); }
    const body: any = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body?.message || "Something went wrong. Try again."), { status: res.status, needSignIn: !!body?.needSignIn, needProfile: !!body?.needProfile });
    return body;
  }, [device, session]);
  // A saved session that's run out (or was signed out elsewhere) doesn't count as an account.
  const checked = useRef(false);
  useEffect(() => {
    if (!session || checked.current) return;
    checked.current = true;
    api("/api/earshot/account").then((b) => { if (b && b.signedIn === false) setSession(null); }).catch(() => {});
  }, [session, api, setSession]);
  // Audio comes through the server so smart ad skip can find the ads in this copy.
  const mediaUrl = useCallback((path: string) => API + path.replace(/^\/api\/earshot/, "/api/podscroll"), []);

  const pending = useRef<{ genre: string; signal: Signal }[]>([]);
  const signal = useCallback((genre: string, s: Signal) => {
    pending.current.push({ genre, signal: s });
    const list = pending.current; pending.current = [];
    setEs((e) => list.reduce((acc, x) => applySignal(acc, x.genre, x.signal), e));
  }, []);

  const shareLink = useCallback((show: { id: string }, ep: { id: string }) => `${location.origin}/app/?s=${show.id}&e=${ep.id}`, []);

  const body = !es.setupDone || editing
    ? <div className={`min-h-full overflow-y-auto px-3 py-6 sm:py-10 ${day ? "ps-light" : ""}`}>{day && <style>{LIGHT_CSS + LIGHT_SHEETS_CSS}</style>}
      <Setup brand="Pod+" initial={es} student={false} onCancel={es.setupDone ? () => setEditing(false) : undefined} onDone={(genres, pace) => {
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
      onEditInterests={() => setEditing(true)} standalone shareLink={shareLink} nickname={nickname} setNickname={setNickname} start={start} mediaUrl={mediaUrl}
      liveBase={API.replace(/^http/, "ws")} onSession={(token) => setSession(token)} locked={locked} />;

  useEffect(() => { if (!es.setupDone || editing) document.documentElement.style.background = day ? "#ffffff" : "#120e14"; }, [day, es.setupDone, editing]);

  return <>
    {body}
    {locked && <SignUpGate api={api} onDone={(token) => { setSession(token); say("You're in. Enjoy Pod+!"); }} />}
    <div role="status" aria-live="polite" className={`pointer-events-none fixed bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full bg-white px-4 py-2.5 text-center text-sm font-bold text-[#120e14] shadow-xl transition ${toast ? "opacity-100" : "translate-y-3 opacity-0"}`}>{toast}</div>
  </>;
}

/** After the free minute: sign up (or back in) with an email code. It can't be closed; that's the point. */
function SignUpGate({ api, onDone }: { api: (path: string, init?: { method?: string; body?: unknown }) => Promise<any>; onDone: (token: string) => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ask = () => { setBusy(true); setErr(""); api("/api/earshot/account/code", { method: "POST", body: { email: email.trim() } }).then(() => setSent(true)).catch((e) => setErr(e.message)).finally(() => setBusy(false)); };
  const check = () => { setBusy(true); setErr(""); api("/api/earshot/account/verify", { method: "POST", body: { email: email.trim(), code } }).then((b) => onDone(b.token)).catch((e) => setErr(e.message)).finally(() => setBusy(false)); };
  const input = "min-h-12 w-full rounded-2xl border border-white/15 bg-white/[.07] px-4 text-base text-white outline-none placeholder:text-white/35 focus:border-[#ff8a3d]";
  return <div role="dialog" aria-modal="true" aria-labelledby="gate-title" className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] backdrop-blur-md sm:items-center">
    <div className="w-full max-w-md rounded-[28px] bg-[#1d1720] p-6 text-white shadow-2xl ring-1 ring-white/10">
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff8a3d]">Pod+</p>
      <h2 id="gate-title" className="mt-2 text-[26px] font-bold leading-tight tracking-tight">Sign up to keep listening</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-white/70">Pod+ is free. Make your account with your email to keep listening, follow shows, post and save your place on any device. Already have one? Same steps.</p>
      {!sent ? <form onSubmit={(e) => { e.preventDefault(); if (email.includes("@") && !busy) ask(); }} className="mt-5">
        <label className="block"><span className="mb-1.5 block text-xs font-bold text-white/60">Email</span>
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={input} /></label>
        <button type="submit" disabled={busy || !email.includes("@")} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013] disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Mail size={17} />}Email me a code</button>
      </form> : <form onSubmit={(e) => { e.preventDefault(); if (code.length === 6 && !busy) check(); }} className="mt-5">
        <p className="text-sm text-white/70">We sent a 6-digit code to <b className="text-white">{email.trim()}</b>. Check your spam folder if it isn't there.</p>
        <input inputMode="numeric" autoComplete="one-time-code" autoFocus value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="123456" aria-label="Code from the email" className={`${input} mt-3 text-center text-2xl font-bold tracking-[.4em]`} />
        <button type="submit" disabled={busy || code.length !== 6} className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-white font-semibold text-[#111013] disabled:opacity-40">{busy ? <Loader2 size={17} className="animate-spin" /> : <Check size={17} />}Continue</button>
        <div className="mt-3 flex justify-between text-xs text-white/60"><button type="button" onClick={() => { setSent(false); setCode(""); setErr(""); }} className="underline">Use another email</button><button type="button" onClick={ask} disabled={busy} className="underline">Send a new code</button></div>
      </form>}
      {err && <p role="alert" className="mt-3 text-sm text-rose-300">{err}</p>}
    </div>
  </div>;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
