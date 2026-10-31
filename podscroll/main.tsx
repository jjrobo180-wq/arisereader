// Podscroll (Pod+): real podcasts in a feed you swipe like short videos, as its own website.
// Listening is free with no account. Signing in with an email code is the Pod+ Membership (smart
// ad skip, earning as a creator); the session is kept here. What someone picks, follows, likes and saves is kept in this browser. Podcast data,
// likes, comments and share counts come from the Arise server's public /api/podscroll routes
// (server/earshot.ts registerPodscrollRoutes), which read Apple Podcasts. Audio plays straight
// from each podcast's own host.
import "./accountBoot";
import { setAccount } from "../client/src/lib/accountStorage";
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { applySignal, cleanEarshot, emptyEarshot, type Earshot, type PodEpisode, type Signal } from "@shared/earshot";
import { Check, Loader2, Mail, X } from "lucide-react";
import { LIGHT_SHEETS_CSS, Player, Setup, useTheme, type NowPlaying, type PlayerControl } from "../client/src/components/family-hub/earshot/EarshotPlayer";
import { LIGHT_CSS } from "../client/src/components/family-hub/earshot/EarshotSocial";
import { Home } from "./Home";
import { AuthScreen } from "./Auth";
import { Welcome, WELCOME_KEY } from "./Welcome";
import { OPEN_EVENT, podPushAllowed, startPodPush, syncPodPush } from "./applePush";
import { isNativeApp } from "../client/src/lib/nativeApp";
import { downloads, installDownloads } from "./downloads";
import "./styles.css";
import { configureAiVoice } from "../client/src/lib/aiVoice";

// The shared social screens read this to link to Pod+'s own policies and support (social/Rules.tsx).
(window as any).__PODPLUS__ = true;
const API = String(import.meta.env.VITE_PODSCROLL_API || "https://arisereader.onrender.com").replace(/\/$/, "");
// Spoken lines (recaps, Read along) use the AI voices on the Arise server, never the phone's robot voice.
configureAiVoice({ base: API });
const KEY = "podscroll.v1";
type PageTab = "openmic" | "social" | "library";
const STARTER_GENRES = ["comedy", "news", "science", "tech", "truecrime", "history", "business", "culture"];
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
  const esRef = useRef(es);
  const [nickname, setNicknameState] = useState(() => read("podscroll.name") || "");
  // Creators sign in with an email code (listening never needs it); the session is kept here.
  const [session, setSessionState] = useState(() => read("podscroll.session") || "");
  const setSession = useCallback((token: string | null) => { setSessionState(token || ""); if (token) write("podscroll.session", token); else { try { localStorage.removeItem("podscroll.session"); } catch { /* private window */ } } }, []);
  const [editing, setEditing] = useState(false);
  const { day } = useTheme();
  // Listening is free with no account. Signing in is the Pod+ Membership: smart ad skip, and earning
  // as a creator. Without it ads simply play, and turning ad skip on asks you to sign in.
  const pro = !!session;
  // The sign-in screen: "signin" from the Sign in button, "signup" from Become a member / ad skip.
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const setJoinOpen = useCallback((on: boolean) => setAuthMode(on ? "signup" : null), []);
  const [email, setEmailState] = useState(() => read("podscroll.email") || "");
  // Signed in from before this update: use this account's own things on this device (reloads once).
  useEffect(() => { if (session && email) setAccount(email); }, [session, email]);
  const shown = useMemo(() => (pro ? es : { ...es, settings: { ...es.settings, adMode: "off" as const } }), [es, pro]);
  esRef.current = shown;
  const [toast, setToast] = useState("");
  const toastT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const s = (q.get("s") || "").replace(/\D/g, ""), e = (q.get("e") || "").replace(/\D/g, "");
    return s && e ? { showId: s, episodeId: e } : null;
  }, []);

  useEffect(() => { const t = setTimeout(() => write(KEY, JSON.stringify(es)), 200); return () => clearTimeout(t); }, [es]);
  useEffect(() => { if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("/sw.js").catch(() => {}); }, []);

  const update = useCallback((fn: (e: Earshot) => Earshot) => setEs((e) => {
    if (pro) return fn(e);
    const n = fn({ ...e, settings: { ...e.settings, adMode: "off" } });
    if (n.settings.adMode !== "off") setTimeout(() => setJoinOpen(true), 0);
    return { ...n, settings: { ...n.settings, adMode: e.settings.adMode } };
  }), [pro]);
  const say = useCallback((m: string) => { setToast(m); if (toastT.current) clearTimeout(toastT.current); toastT.current = setTimeout(() => setToast(""), 2600); }, []);
  const setNickname = useCallback((n: string) => { setNicknameState(n); write("podscroll.name", n); }, []);

  const api = useCallback(async (path: string, init?: { method?: string; body?: unknown }) => {
    const url = API + path.replace(/^\/api\/earshot/, "/api/podscroll");
    let res!: Response;
    let body: any;
    // A busy moment (the server is waiting its turn with the podcast directory): wait and ask again
    // quietly a few times before saying anything. Only for reads; nothing is sent twice.
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(url, {
          method: init?.method ?? "GET",
          // A Blob (a recording) goes as it is; anything else as JSON.
          headers: { "X-Podscroll-Device": device, ...(session ? { "X-Podscroll-Session": session } : {}), ...(init?.body instanceof Blob ? { "Content-Type": init.body.type || "application/octet-stream" } : init?.body !== undefined ? { "Content-Type": "application/json" } : {}) },
          body: init?.body instanceof Blob ? init.body : init?.body !== undefined ? JSON.stringify(init.body) : undefined,
        });
      } catch { throw new Error("Can't reach Pod+ right now. Check your connection and try again."); }
      body = await res.json().catch(() => ({}));
      const busy = res.status === 429 || (res.status === 503 && body?.busy !== false);
      if (!busy || attempt >= 3 || (init?.method && init.method !== "GET")) break;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
    if (!res.ok) throw Object.assign(new Error(body?.message || "Something went wrong. Try again."), { status: res.status, needSignIn: !!body?.needSignIn, needProfile: !!body?.needProfile });
    return body;
  }, [device, session]);
  const signOut = useCallback(() => {
    void api("/api/earshot/account/signout", { method: "POST" }).catch(() => {});
    setSession(null); setEmailState(""); try { localStorage.removeItem("podscroll.email"); } catch { /* private window */ }
    setAccount(null); setTimeout(() => window.location.reload(), 300); // the next person starts with an empty library
    say("Signed out.");
  }, [api, setSession, say]);
  // A saved session that's run out (or was signed out elsewhere) doesn't count as an account.
  const checked = useRef(false);
  useEffect(() => {
    if (!session || checked.current) return;
    checked.current = true;
    api("/api/earshot/account").then((b) => { if (b && b.signedIn === false) setSession(null); }).catch(() => {});
  }, [session, api, setSession]);
  // Audio comes through the server so smart ad skip can find the ads in this copy.
  const mediaUrl = useCallback((path: string) => API + path.replace(/^\/api\/earshot/, "/api/podscroll"), []);
  // Downloads (Pod+ Membership): episodes and audiobooks kept on this device to play offline.
  const apiRef = useRef(api); apiRef.current = api;
  const proRef = useRef(pro); proRef.current = pro;
  useEffect(() => {
    if (downloads) return;
    installDownloads({ api: (p, i) => apiRef.current(p, i), apiBase: API, isMember: () => proRef.current, onJoin: () => setAuthMode("signup"), say });
  }, [say]);

  const pending = useRef<{ genre: string; signal: Signal }[]>([]);
  const signal = useCallback((genre: string, s: Signal) => {
    pending.current.push({ genre, signal: s });
    const list = pending.current; pending.current = [];
    setEs((e) => list.reduce((acc, x) => applySignal(acc, x.genre, x.signal), e));
  }, []);

  const shareLink = useCallback((show: { id: string }, ep: { id: string }) => {
    const origin = location.protocol === "capacitor:"
      ? String(import.meta.env.VITE_PODSCROLL_SITE || "https://podscroll.onrender.com").replace(/\/$/, "")
      : location.origin;
    return `${origin}/app/?s=${show.id}&e=${ep.id}`;
  }, []);

  // The home page (browse) comes first and opens episodes in the swipe feed. A shared swipe
  // link (?s=&e=) still opens straight into the feed.
  const [mode, setMode] = useState<"home" | "feed">(() => (start ? "feed" : "home"));
  const [feedStart, setFeedStart] = useState<{ showId: string; episodeId: string; ep?: PodEpisode } | null>(start);
  const [feedKey, setFeedKey] = useState(0);
  // The scroll is For You and Following; Open Mic, Social and Library open from the home page as
  // their own pages (the same player, opened on that tab), each with a back button home.
  const [feedTab, setFeedTab] = useState<PageTab | undefined>(undefined);
  const [feedMode, setFeedMode] = useState<{ id: string; index: number; shuffle?: boolean; order?: "in" | "shuffle" | "shows" } | null>(null);
  // Picking an episode on the home page opens the swipe feed on it. Someone who never chose interests
  // gets a broad starting mix instead of the picker, so the episode they tapped plays right away.
  const openFeed = useCallback((at?: { showId: string; episodeId: string; ep?: PodEpisode }, page?: PageTab, podMode?: { id: string; index: number; shuffle?: boolean; order?: "in" | "shuffle" | "shows" }) => {
    if ((at || page || podMode) && !esRef.current.setupDone) setEs((e) => e.setupDone ? e : ({ ...e, setupDone: true, genres: STARTER_GENRES, taste: Object.fromEntries(STARTER_GENRES.map((g) => [g, 3])) }));
    // Just a page (Social, Open Mic, Library, the scroll) and the player is already running: switch
    // its page, so what's playing keeps playing. A new episode or Pod Mode starts it fresh.
    if (!at && !podMode && feedSeenRef.current) { setFeedTab(page); setTabNonce((n) => n + 1); setMode("feed"); return; }
    // Live News Radio is already on: back to it, still playing (it isn't started over).
    if (podMode?.id === "__newsradio" && feedSeenRef.current && nowPodRef.current?.live) { setFeedTab(undefined); setTabNonce((n) => n + 1); setMode("feed"); return; }
    setFeedStart(at ?? null); setFeedTab(page); setFeedMode(podMode ?? null); setFeedKey((k) => k + 1); setMode("feed"); setFeedSeen(true);
  }, []);

  // The iPhone app's first launch: welcome (sign in or just listen), notifications, a short tour.
  const [welcome, setWelcome] = useState(() => isNativeApp() && read(WELCOME_KEY) !== "1");
  const finishWelcome = useCallback(() => { write(WELCOME_KEY, "1"); setWelcome(false); }, []);
  const followIds = useCallback(() => esRef.current.follows.map((f) => f.id), []);
  // New-episode notifications (podscroll/applePush.ts): sign the phone up again on each launch once
  // they're allowed, keep the server's list of followed shows current, and open a tapped episode.
  useEffect(() => { void podPushAllowed().then((on) => { if (on) void startPodPush(api, followIds, false); }); }, [api, followIds]);
  const followKey = es.follows.map((f) => f.id).join(",");
  useEffect(() => { const t = setTimeout(() => void syncPodPush(api, followIds()), 1500); return () => clearTimeout(t); }, [followKey, api, followIds]);
  useEffect(() => {
    const open = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.showId && d?.episodeId) openFeed({ showId: d.showId, episodeId: d.episodeId }); };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, [openFeed]);
  // The swipe player stays running (hidden) on the home page and the audiobook page stays running
  // (hidden) in the player, so what's playing keeps playing when you move between them.
  const [feedSeen, setFeedSeen] = useState(() => mode === "feed");
  const feedSeenRef = useRef(feedSeen); feedSeenRef.current = feedSeen;
  const [tabNonce, setTabNonce] = useState(0);
  const [nowPod, setNowPod] = useState<NowPlaying | null>(null);
  const nowPodRef = useRef(nowPod); nowPodRef.current = nowPod;
  const podCtl = useRef<PlayerControl | null>(null);
  // The now-playing bar on the home page opens the player itself, on what's playing (not the last
  // page that was open in it, like Social).
  const backToFeed = useCallback(() => { setFeedSeen(true); setFeedTab(undefined); setTabNonce((n) => n + 1); setMode("feed"); }, []);
  const goHome = useCallback(() => { setEditing(false); setMode("home"); if (location.search) history.replaceState(null, "", location.pathname + location.hash); }, []);

  const body = editing || (mode === "feed" && !es.setupDone)
    ? <div className={`min-h-full overflow-y-auto px-3 py-6 sm:py-10 ${day ? "ps-light" : ""}`}>{day && <style>{LIGHT_CSS + LIGHT_SHEETS_CSS}</style>}
      <Setup brand="Pod+" initial={es} student={false} onCancel={() => { setEditing(false); if (!es.setupDone) setMode("home"); }} onDone={(genres, pace) => {
        setEs((e) => {
          const taste = { ...e.taste };
          for (const g of genres) taste[g] = Math.max(taste[g] ?? 0, 3);
          for (const g of e.genres) if (!genres.includes(g)) taste[g] = Math.min(taste[g] ?? 0.3, 0.6);
          return { ...e, setupDone: true, genres, pace, taste };
        });
        setEditing(false);
        if (mode === "feed") say("Tap a cover to listen. Swipe up for the next one.");
        else say("Your home page now follows your interests.");
      }} />
    </div>
    : <>
      <div style={{ display: mode === "home" ? "contents" : "none" }}>{<Home visible={mode === "home"} nowPod={nowPod} onPodToggle={() => podCtl.current?.toggle()} onPodOpen={backToFeed} es={es} update={update} api={api} say={say} onOpenFeed={openFeed} onEditInterests={() => setEditing(true)} pro={pro} onJoin={() => setAuthMode("signup")} onSignIn={() => setAuthMode("signin")} email={email} onSignOut={signOut} device={device} nickname={nickname} setNickname={setNickname} liveBase={API.replace(/^http/, "ws")} signal={signal} />}</div>
      {feedSeen && <div style={{ display: mode === "feed" ? "contents" : "none" }}>{<Player visible={mode === "feed"} onNowPlaying={setNowPod} control={podCtl} tabNonce={tabNonce} key={feedKey} es={shown} esRef={esRef} update={update} api={api} signal={signal} say={say} student={false} explicit={es.settings.explicit}
        onEditInterests={() => setEditing(true)} standalone shareLink={shareLink} nickname={nickname} setNickname={setNickname} start={feedStart} mediaUrl={mediaUrl}
        liveBase={API.replace(/^http/, "ws")} onSession={(token) => setSession(token)} locked={false} onHome={goHome} initialTab={feedTab} playMode={feedMode} />}</div>}
    </>;

  useEffect(() => { if (editing || (mode === "feed" && !es.setupDone)) document.documentElement.style.background = day ? "#ffffff" : "#120e14"; }, [day, es.setupDone, editing, mode]);

  return <>
    {body}
    {welcome && !authMode && <Welcome key={pro ? "in" : "out"} api={api} signedIn={pro} onSignedIn={(token, mail) => { setSession(token); setEmailState(mail); write("podscroll.email", mail); setAccount(mail); }}
      onEmail={() => setAuthMode("signin")} onPush={() => startPodPush(api, followIds, true)} onDone={finishWelcome} />}
    {authMode && !pro && <AuthScreen api={api} dark={!day} start={authMode} onClose={() => setAuthMode(null)} onDone={(token, mail) => { setSession(token); setEmailState(mail); write("podscroll.email", mail); setAuthMode(null); say("You're signed in. Ads get skipped now."); setAccount(mail); }} />}
    <div role="status" aria-live="polite" className={`pointer-events-none fixed bottom-[calc(24px+env(safe-area-inset-bottom,0px))] left-1/2 z-[80] max-w-[calc(100%-32px)] -translate-x-1/2 rounded-full bg-white px-4 py-2.5 text-center text-sm font-bold text-[#120e14] shadow-xl transition ${toast ? "opacity-100" : "translate-y-3 opacity-0"}`}>{toast}</div>
  </>;
}

/** Pod+ Membership: sign up (or back in) with an email code. Optional; listening never needs it. */
function SignUpGate({ api, onDone, onClose }: { api: (path: string, init?: { method?: string; body?: unknown }) => Promise<any>; onDone: (token: string) => void; onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ask = () => { setBusy(true); setErr(""); api("/api/earshot/account/code", { method: "POST", body: { email: email.trim() } }).then(() => setSent(true)).catch((e) => setErr(e.message)).finally(() => setBusy(false)); };
  const check = () => { setBusy(true); setErr(""); api("/api/earshot/account/verify", { method: "POST", body: { email: email.trim(), code } }).then((b) => onDone(b.token)).catch((e) => setErr(e.message)).finally(() => setBusy(false)); };
  const input = "min-h-12 w-full rounded-2xl border border-white/15 bg-white/[.07] px-4 text-base text-white outline-none placeholder:text-white/35 focus:border-[#ff8a3d]";
  return <div role="dialog" aria-modal="true" aria-labelledby="gate-title" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }} className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[env(safe-area-inset-top)] backdrop-blur-md sm:items-center">
    <div className="relative w-full max-w-md rounded-[28px] bg-[#1d1720] p-6 text-white shadow-2xl ring-1 ring-white/10">
      <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"><X size={20} /></button>
      <p className="text-xs font-bold uppercase tracking-[.18em] text-[#ff8a3d]">Pod+ Membership</p>
      <h2 id="gate-title" className="mt-2 pr-8 text-[26px] font-bold leading-tight tracking-tight">Skip the ads. Get paid for your show.</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-white/70">Listening stays free, no account needed. Members get smart ad skip, can earn from their own podcast, and keep their place on every device. Sign in with your email to start.</p>
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
