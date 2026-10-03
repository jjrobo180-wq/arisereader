import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Copy, Crown, Gamepad2, Loader2, LogOut, Pause, Play, RotateCcw, Settings, Shield, Users, Volume2, Wifi, WifiOff, X, Zap } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { PB, WEAPONS, TEAM_CSS, TEAM_NAMES, type Snapshot, type RoomMeta, type BotLevel, type Team } from "@shared/paintball";
import type { PaintballGame } from "@/game/paintball/game";
import { initialHud, defaultSettings, type GameSettings, type HudState } from "@/game/paintball/hud";

type Lobby = { code: string; hostName: string; humans: number; players: number; phase: string; quick: boolean };

const SETTINGS_KEY = "prism-paintball-settings";
function loadSettings(): GameSettings {
  try { const raw = localStorage.getItem(SETTINGS_KEY); if (raw) return { ...defaultSettings, ...JSON.parse(raw) }; } catch { /* ignore */ }
  return defaultSettings;
}
function saveSettings(s: GameSettings) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { /* ignore */ } }
const isTouchDevice = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);
const noopSubscribe = () => () => {};
const getInitialHud = () => initialHud;

async function api<T>(token: string, path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(API_BASE + path, {
    method,
    headers: { Authorization: "Bearer " + token, ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) throw new Error((data && data.message) || "Something went wrong. Please try again.");
  return data as T;
}

const PAGE_CSS = `
.pb-font{font-family:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
.pb-skew{transform:skewX(-8deg)}.pb-unskew{transform:skewX(8deg)}
.pb-cross{position:absolute;left:50%;top:50%;width:0;height:0;pointer-events:none;transition:opacity .12s}
.pb-cross i{position:absolute;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.55);border-radius:2px;transition:transform .06s linear}
.pb-cross i.t{width:2px;height:9px;left:-1px;top:calc(-1 * var(--spread,6px) - 9px)}
.pb-cross i.b{width:2px;height:9px;left:-1px;top:var(--spread,6px)}
.pb-cross i.l{height:2px;width:9px;top:-1px;left:calc(-1 * var(--spread,6px) - 9px)}
.pb-cross i.r{height:2px;width:9px;top:-1px;left:var(--spread,6px)}
.pb-cross b{position:absolute;width:4px;height:4px;left:-2px;top:-2px;border-radius:50%;background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.6)}
.pb-cross[data-enemy="1"] i,.pb-cross[data-enemy="1"] b{background:#ff4d6d}
.pb-hit{position:absolute;left:50%;top:50%;width:30px;height:30px;margin:-15px 0 0 -15px;opacity:0;pointer-events:none}
.pb-hit:before,.pb-hit:after{content:"";position:absolute;left:50%;top:-2px;width:3px;height:34px;margin-left:-1.5px;background:linear-gradient(#fff 0 35%,transparent 35% 65%,#fff 65%);border-radius:2px;filter:drop-shadow(0 0 2px rgba(0,0,0,.8))}
.pb-hit:before{transform:rotate(45deg)}.pb-hit:after{transform:rotate(-45deg)}
.pb-hit[data-kind="head"]:before,.pb-hit[data-kind="head"]:after{background:linear-gradient(#fde047 0 35%,transparent 35% 65%,#fde047 65%)}
.pb-hit[data-kind="kill"]:before,.pb-hit[data-kind="kill"]:after{background:linear-gradient(#ff3d6e 0 38%,transparent 38% 62%,#ff3d6e 62%);height:42px;top:-6px}
.pb-hit-on{animation:pbHit .26s ease-out}
.pb-hit-on[data-kind="kill"]{animation:pbKill .5s ease-out}
@keyframes pbHit{0%{opacity:1;transform:scale(1.35)}100%{opacity:0;transform:scale(1)}}
@keyframes pbKill{0%{opacity:1;transform:scale(1.6) rotate(0)}60%{opacity:1}100%{opacity:0;transform:scale(1.1) rotate(8deg)}}
.pb-vig{background:radial-gradient(ellipse at center,transparent 45%,rgba(220,20,90,.25) 70%,rgba(160,0,60,.75) 100%)}
.pb-toast{animation:pbToast 2.6s ease-out forwards}
@keyframes pbToast{0%{opacity:0;transform:translateY(10px) scale(.8)}10%{opacity:1;transform:translateY(0) scale(1.08)}18%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}
.pb-feed{animation:pbFeed .25s ease-out}
@keyframes pbFeed{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:none}}
.pb-count{animation:pbCount 1s ease-out infinite}
@keyframes pbCount{0%{transform:scale(1.6);opacity:0}20%{transform:scale(1);opacity:1}85%{opacity:1}100%{opacity:0;transform:scale(.9)}}
.pb-dmg{position:absolute;left:50%;top:50%;width:180px;height:180px;margin:-90px 0 0 -90px;pointer-events:none;animation:pbDmg 1.4s ease-out forwards}
.pb-dmg:before{content:"";position:absolute;left:50%;top:0;width:64px;height:20px;margin-left:-32px;border-radius:50% 50% 0 0;border-top:6px solid rgba(255,61,110,.95);filter:drop-shadow(0 0 6px rgba(255,0,80,.8))}
@keyframes pbDmg{0%{opacity:1}100%{opacity:0}}
.pb-scope{background:radial-gradient(circle at center,transparent 0 31vmin,rgba(0,0,0,.92) 31.4vmin)}
.pb-glow{text-shadow:0 2px 0 rgba(0,0,0,.35),0 0 18px rgba(255,255,255,.25)}
.pb-btn{transition:transform .12s ease,filter .12s ease}.pb-btn:hover{transform:translateY(-2px);filter:brightness(1.08)}.pb-btn:active{transform:translateY(1px) scale(.98)}
.pb-bg{background:radial-gradient(1200px 600px at 15% -10%,rgba(34,211,238,.35),transparent 60%),radial-gradient(1000px 600px at 95% 0%,rgba(240,71,154,.35),transparent 60%),radial-gradient(900px 500px at 50% 120%,rgba(250,204,21,.18),transparent 60%),linear-gradient(160deg,#071026,#140a2a 60%,#0b0f1f)}
.pb-splat-dots{background-image:radial-gradient(circle at 93% 9%,rgba(34,211,238,.5) 0 26px,transparent 27px),radial-gradient(circle at 88% 15%,rgba(34,211,238,.45) 0 8px,transparent 9px),radial-gradient(circle at 78% 28%,rgba(240,71,154,.5) 0 34px,transparent 35px),radial-gradient(circle at 72% 21%,rgba(240,71,154,.45) 0 10px,transparent 11px),radial-gradient(circle at 96% 46%,rgba(250,204,21,.4) 0 18px,transparent 19px),radial-gradient(circle at 85% 40%,rgba(167,139,250,.4) 0 12px,transparent 13px)}
`;

// ===========================================================================
// Page
// ===========================================================================

export default function PaintballArena() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [view, setView] = useState<"menu" | "lobby" | "game">("menu");
  const [meta, setMeta] = useState<RoomMeta | null>(null);
  const [lobbies, setLobbies] = useState<Lobby[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [botLevel, setBotLevel] = useState<BotLevel>("normal");
  const [settings, setSettingsState] = useState<GameSettings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [gameKey, setGameKey] = useState(0);
  const myId = Number(user?.id);
  const roomCode = meta?.code || snap?.meta?.code || "";
  const roomRef = useRef(roomCode);
  roomRef.current = roomCode;

  const setSettings = useCallback((s: GameSettings) => { setSettingsState(s); saveSettings(s); }, []);

  const applySnapshot = useCallback((s: Snapshot) => {
    setSnap(s);
    if (s.meta) setMeta(s.meta);
    setView(s.phase === "lobby" ? "lobby" : "game");
  }, []);

  const enter = async (kind: "queue" | "create" | "private" | "practice" | "join", joinCode = code) => {
    if (!token || busy) return;
    setBusy(true); setError("");
    try {
      let s: Snapshot;
      if (kind === "queue") s = await api<Snapshot>(token, "/api/paintball/queue", "POST", {});
      else if (kind === "join") s = await api<Snapshot>(token, "/api/paintball/rooms/" + joinCode + "/join", "POST", {});
      else s = await api<Snapshot>(token, "/api/paintball/rooms", "POST", { practice: kind === "practice", publicLobby: kind === "create", botLevel });
      setGameKey((k) => k + 1);
      applySnapshot(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not reach Prism Paintball.");
    } finally {
      setBusy(false);
    }
  };

  const leave = useCallback((toWorlds: boolean) => {
    const c = roomRef.current;
    if (c && token) void fetch(API_BASE + "/api/paintball/rooms/" + c + "/leave", { method: "POST", headers: { Authorization: "Bearer " + token }, keepalive: true }).catch(() => {});
    setSnap(null); setMeta(null); setView("menu");
    if (toWorlds) navigate("/games");
  }, [token, navigate]);

  // leave the room if the tab is closed
  useEffect(() => {
    const onHide = () => {
      const c = roomRef.current;
      if (c && token) { try { void fetch(API_BASE + "/api/paintball/rooms/" + c + "/leave", { method: "POST", headers: { Authorization: "Bearer " + token }, keepalive: true }); } catch { /* ignore */ } }
    };
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      onHide(); // leaving the page (e.g. browser back) also leaves the room
    };
  }, [token]);

  // open lobbies list on the menu
  useEffect(() => {
    if (view !== "menu" || !token) return;
    let stop = false;
    const load = async () => { try { const l = await api<Lobby[]>(token, "/api/paintball/lobbies"); if (!stop) setLobbies(l); } catch { /* ignore */ } };
    void load();
    const t = window.setInterval(load, 3000);
    return () => { stop = true; window.clearInterval(t); };
  }, [view, token]);

  // lobby polling
  useEffect(() => {
    if (view !== "lobby" || !token || !roomCode) return;
    let stop = false;
    let timer = 0;
    const poll = async () => {
      try {
        const s = await api<Snapshot>(token, "/api/paintball/rooms/" + roomCode);
        if (stop) return;
        setSnap(s);
        if (s.meta) setMeta(s.meta);
        if (s.phase !== "lobby") { setGameKey((k) => k + 1); setView("game"); return; }
      } catch (e) {
        if (stop) return;
        setError(e instanceof Error ? e.message : "The room closed.");
        setView("menu"); setSnap(null); setMeta(null);
        return;
      }
      timer = window.setTimeout(poll, 900);
    };
    timer = window.setTimeout(poll, 400);
    return () => { stop = true; window.clearTimeout(timer); };
  }, [view, token, roomCode]);

  const action = async (body: Record<string, unknown>) => {
    if (!token || !roomCode) return;
    setError("");
    try {
      const s = await api<Snapshot>(token, "/api/paintball/rooms/" + roomCode + "/action", "POST", body);
      setSnap(s);
      if (s.meta) setMeta(s.meta);
      if (s.phase !== "lobby" && view === "lobby") { setGameKey((k) => k + 1); setView("game"); }
    } catch (e) { setError(e instanceof Error ? e.message : "That did not work."); }
  };

  const backToLobby = useCallback(async () => {
    if (!token || !roomRef.current) return;
    try {
      const s = await api<Snapshot>(token, "/api/paintball/rooms/" + roomRef.current);
      setSnap(s); if (s.meta) setMeta(s.meta);
      setView("lobby");
    } catch (e) { setError(e instanceof Error ? e.message : "The room closed."); setView("menu"); }
  }, [token]);

  const restartWithSettings = useCallback(async (s: GameSettings) => {
    setSettings(s);
    if (!token || !roomRef.current) return;
    try {
      const fresh = await api<Snapshot>(token, "/api/paintball/rooms/" + roomRef.current);
      setSnap(fresh); if (fresh.meta) setMeta(fresh.meta);
      setGameKey((k) => k + 1);
    } catch { /* ignore */ }
  }, [token, setSettings]);

  if (!user || !token) return null;

  return (
    <div className="pb-font">
      <style>{PAGE_CSS}</style>
      {view === "menu" && (
        <Menu
          busy={busy} error={error} lobbies={lobbies} code={code} setCode={setCode} botLevel={botLevel} setBotLevel={setBotLevel}
          onQuick={() => enter("queue")} onPractice={() => enter("practice")} onCreate={(pub) => enter(pub ? "create" : "private")}
          onJoin={(c) => { setCode(c); void enter("join", c); }} onBack={() => navigate("/games")} onSettings={() => setShowSettings(true)}
        />
      )}
      {view === "lobby" && meta && (
        <LobbyView meta={meta} myId={myId} error={error} onAction={action} onLeave={() => leave(false)} />
      )}
      {view === "game" && snap && (
        <GameView
          key={gameKey}
          initial={snap}
          token={token}
          myId={myId}
          settings={settings}
          onSettings={setSettings}
          onApplyQuality={restartWithSettings}
          onLeave={() => leave(false)}
          onAction={action}
          onLobby={backToLobby}
          onEnded={(m) => { setError(m); setView("menu"); setSnap(null); setMeta(null); }}
        />
      )}
      {showSettings && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ===========================================================================
// Menu
// ===========================================================================

function Menu(props: {
  busy: boolean; error: string; lobbies: Lobby[]; code: string; setCode: (s: string) => void; botLevel: BotLevel; setBotLevel: (b: BotLevel) => void;
  onQuick: () => void; onPractice: () => void; onCreate: (pub: boolean) => void; onJoin: (code: string) => void; onBack: () => void; onSettings: () => void;
}) {
  const { busy, error, lobbies, code, setCode, botLevel, setBotLevel } = props;
  return (
    <main className="pb-bg min-h-[100dvh] overflow-x-hidden px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <button onClick={props.onBack} className="pb-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black backdrop-blur"><ArrowLeft className="h-5 w-5" /> Games</button>
        <button onClick={props.onSettings} className="pb-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black backdrop-blur"><Settings className="h-5 w-5" /> Settings</button>
      </div>
      <section className="pb-splat-dots relative mx-auto mt-6 max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 p-6 shadow-[0_40px_120px_rgba(0,0,0,.55)] backdrop-blur-xl sm:p-10">
        <div className="relative max-w-3xl">
          <p className="text-xs font-black uppercase tracking-[.35em] text-cyan-300">A.R.I.S.E. arena · team paint battle</p>
          <h1 className="pb-glow mt-3 text-6xl font-black italic leading-[.9] tracking-tight sm:text-8xl">
            PRISM<br /><span className="bg-gradient-to-r from-cyan-300 via-white to-pink-400 bg-clip-text text-transparent" style={{ textShadow: "none" }}>PAINTBALL</span>
          </h1>
          <p className="mt-5 max-w-2xl text-base font-bold leading-7 text-slate-200 sm:text-lg">
            5v5 third-person paintball. Sprint between inflatable bunkers, climb the forts, jump crates and splat the other team. First squad to {PB.SCORE_TO_WIN} splats wins.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-[11px] font-black uppercase tracking-wide">
            {["Real multiplayer", "3 paint markers", "Smart bots fill empty spots", "Keyboard + mouse or touch", "No gore — just paint"].map((t) => (
              <span key={t} className="rounded-full border border-white/10 bg-white/10 px-3 py-1.5">{t}</span>
            ))}
          </div>
        </div>
        <div className="relative mt-8 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div>
            <button disabled={busy} onClick={props.onQuick} className="pb-btn group relative flex min-h-[86px] w-full items-center justify-center gap-3 overflow-hidden rounded-3xl bg-gradient-to-r from-yellow-300 via-amber-300 to-orange-400 text-2xl font-black italic uppercase text-slate-950 shadow-[0_12px_0_#b45309,0_30px_60px_rgba(251,191,36,.35)] disabled:opacity-60 sm:text-3xl">
              {busy ? <Loader2 className="h-8 w-8 animate-spin" /> : <Play className="h-8 w-8 fill-current" />} Play now
            </button>
            <p className="mt-3 text-center text-sm font-bold text-slate-300">Jumps into a live match with readers from your school — bots fill any empty spots.</p>
            {lobbies.length > 0 && (
              <div className="mt-5">
                <h3 className="mb-2 text-xs font-black uppercase tracking-[.25em] text-slate-400">Open rooms</h3>
                <div className="grid gap-2">
                  {lobbies.slice(0, 5).map((l) => (
                    <button key={l.code} disabled={busy} onClick={() => props.onJoin(l.code)} className="pb-btn flex min-h-14 items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 text-left backdrop-blur">
                      <span><b className="block">{l.hostName}'s {l.quick ? "match" : "room"}</b><small className="font-bold text-slate-400">{l.humans} reader{l.humans === 1 ? "" : "s"} · {l.phase === "lobby" ? "in lobby" : "match in progress"}</small></span>
                      <span className="rounded-xl bg-cyan-300 px-3 py-1.5 text-sm font-black text-slate-950">JOIN</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[.06] p-4 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-black uppercase tracking-[.2em] text-violet-200">Practice difficulty</span>
              <div className="flex rounded-xl bg-black/30 p-1">
                {(["easy", "normal", "hard"] as BotLevel[]).map((l) => (
                  <button key={l} onClick={() => setBotLevel(l)} className={"rounded-lg px-3 py-1.5 text-xs font-black uppercase " + (botLevel === l ? "bg-violet-400 text-slate-950" : "text-slate-300")}>{l}</button>
                ))}
              </div>
            </div>
            <button disabled={busy} onClick={props.onPractice} className="pb-btn mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-violet-500 font-black uppercase shadow-[0_6px_0_#5b21b6]"><Gamepad2 className="h-5 w-5" /> Practice vs bots</button>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button disabled={busy} onClick={() => props.onCreate(true)} className="pb-btn min-h-12 rounded-2xl border border-white/15 bg-white/5 text-sm font-black uppercase">Open room</button>
              <button disabled={busy} onClick={() => props.onCreate(false)} className="pb-btn min-h-12 rounded-2xl border border-white/15 bg-white/5 text-sm font-black uppercase">Private room</button>
            </div>
            <div className="mt-3 flex gap-2">
              <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit room code" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 font-black tracking-widest outline-none placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-500 focus:border-cyan-300" />
              <button disabled={busy || code.length !== 6} onClick={() => props.onJoin(code)} className="pb-btn rounded-2xl bg-cyan-300 px-5 font-black text-slate-950 disabled:opacity-40">Join</button>
            </div>
          </div>
        </div>
        {error && <p className="relative mt-5 rounded-2xl border border-red-400/30 bg-red-500/15 p-3 font-bold text-red-100">{error}</p>}
      </section>
      <section className="mx-auto mt-6 grid max-w-6xl gap-3 sm:grid-cols-3">
        {WEAPONS.map((w, i) => (
          <div key={w.id} className="rounded-3xl border border-white/10 bg-black/25 p-5 backdrop-blur">
            <p className="text-xs font-black uppercase tracking-[.2em] text-slate-400">Slot {i + 1}</p>
            <h3 className="mt-1 text-2xl font-black italic">{w.name}</h3>
            <p className="mt-1 text-sm font-bold text-slate-300">{i === 0 ? "Full-auto all-rounder. Great at any range." : i === 1 ? "Close-range pump spray. Wins corner fights." : "Scoped long-range marker. Aim for the mask!"}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-black">
              <Stat label="Damage" value={w.pellets > 1 ? `${w.dmg}×${w.pellets}` : String(w.dmg)} />
              <Stat label="Ammo" value={String(w.mag)} />
              <Stat label="Fire" value={`${Math.round(60000 / w.interval)}/min`} />
            </div>
          </div>
        ))}
      </section>
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-white/10 bg-black/25 p-5 text-sm font-bold text-slate-300 backdrop-blur">
        <h3 className="mb-2 text-xs font-black uppercase tracking-[.25em] text-slate-400">Controls</h3>
        <div className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {[["WASD", "Move"], ["Mouse", "Aim"], ["Left click", "Fire"], ["Right click", "Aim down sights / scope"], ["Shift", "Sprint"], ["Space", "Jump"], ["C / Ctrl", "Crouch"], ["R", "Reload"], ["1 2 3 / wheel / Q", "Switch marker"], ["Tab", "Scoreboard"], ["Esc", "Pause & settings"], ["Touch", "Left stick moves · drag right side to aim"]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2"><kbd className="min-w-[64px] rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-center text-xs font-black text-white">{k}</kbd>{v}</div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-white/5 px-2 py-2"><div className="text-base text-white">{value}</div><div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div></div>;
}

// ===========================================================================
// Lobby
// ===========================================================================

function LobbyView({ meta, myId, error, onAction, onLeave }: { meta: RoomMeta; myId: number; error: string; onAction: (b: Record<string, unknown>) => Promise<void>; onLeave: () => void }) {
  const host = meta.hostId === myId;
  const me = meta.players.find((p) => p.id === myId);
  const [copied, setCopied] = useState(false);
  const hasBots = meta.players.some((p) => p.bot);
  const copy = async () => { try { await navigator.clipboard.writeText(meta.code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  return (
    <main className="pb-bg min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button onClick={onLeave} className="pb-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black"><ArrowLeft className="h-5 w-5" /> Leave room</button>
        <button onClick={copy} className="pb-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black">
          <Copy className="h-4 w-4" /> Code <span className="tracking-[.25em] text-cyan-300">{meta.code}</span>{copied && <span className="text-xs text-emerald-300">copied!</span>}
        </button>
      </div>
      <section className="mx-auto mt-5 max-w-5xl rounded-[2rem] border border-white/10 bg-black/30 p-5 shadow-2xl backdrop-blur-xl sm:p-8">
        <p className="text-xs font-black uppercase tracking-[.3em] text-cyan-300">{meta.publicLobby ? "Open room" : "Private room"} · share the code with friends</p>
        <h1 className="mt-2 text-4xl font-black italic sm:text-5xl">Pick your squad</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {([0, 1] as Team[]).map((team) => {
            const list = meta.players.filter((p) => p.team === team);
            return (
              <div key={team} className="rounded-3xl border p-4" style={{ borderColor: TEAM_CSS[team] + "55", background: `linear-gradient(160deg, ${TEAM_CSS[team]}22, transparent)` }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-black italic uppercase" style={{ color: TEAM_CSS[team] }}>{TEAM_NAMES[team]}</h2>
                  <span className="text-sm font-black text-slate-300">{list.length}/{PB.MAX_PLAYERS / 2}</span>
                </div>
                <div className="mt-3 grid gap-2">
                  {list.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-2xl bg-black/35 px-3 py-3">
                      <span className="flex items-center gap-2 font-black">
                        {p.id === meta.hostId && <Crown className="h-4 w-4 text-yellow-300" />}
                        {p.name}{p.id === myId && <span className="rounded-md bg-white/15 px-1.5 py-0.5 text-[10px]">YOU</span>}
                      </span>
                      <small className="font-bold text-slate-400">{p.bot ? "Computer · " + meta.botLevel : p.id === meta.hostId ? "Host" : "Reader"}</small>
                    </div>
                  ))}
                  {!list.length && <p className="rounded-2xl border border-dashed border-white/15 p-4 text-center text-sm font-bold text-slate-400">Nobody yet</p>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {me && <button onClick={() => onAction({ type: "switch-team" })} className="pb-btn min-h-12 rounded-2xl border border-white/15 bg-white/5 px-4 font-black">Switch team</button>}
          {host && (hasBots
            ? <button onClick={() => onAction({ type: "remove-bots" })} className="pb-btn min-h-12 rounded-2xl border border-white/15 bg-white/5 px-4 font-black">Remove bots</button>
            : <button onClick={() => onAction({ type: "add-bots" })} className="pb-btn min-h-12 rounded-2xl border border-white/15 bg-white/5 px-4 font-black">Fill with bots</button>)}
          {host && hasBots && (
            <div className="flex rounded-2xl border border-white/10 bg-black/30 p-1">
              {(["easy", "normal", "hard"] as BotLevel[]).map((l) => (
                <button key={l} onClick={() => onAction({ type: "bot-level", level: l })} className={"rounded-xl px-3 py-2 text-xs font-black uppercase " + (meta.botLevel === l ? "bg-violet-400 text-slate-950" : "text-slate-300")}>{l}</button>
              ))}
            </div>
          )}
          <div className="flex-1" />
          {host
            ? <button disabled={meta.players.length < 2} onClick={() => onAction({ type: "start" })} className="pb-btn flex min-h-14 items-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-400 px-8 text-lg font-black italic uppercase text-slate-950 shadow-[0_8px_0_#b45309] disabled:opacity-40"><Play className="h-5 w-5 fill-current" /> Start match</button>
            : <p className="flex items-center gap-2 py-3 font-black text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Waiting for the host to start…</p>}
        </div>
        {host && meta.players.length < 2 && <p className="mt-3 text-sm font-bold text-slate-400">Add bots or wait for another reader to join to start.</p>}
        {error && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/15 p-3 font-bold text-red-100">{error}</p>}
      </section>
    </main>
  );
}

// ===========================================================================
// Game view + HUD
// ===========================================================================

function GameView(props: {
  initial: Snapshot; token: string; myId: number; settings: GameSettings; onSettings: (s: GameSettings) => void; onApplyQuality: (s: GameSettings) => void;
  onLeave: () => void; onAction: (b: Record<string, unknown>) => Promise<void>; onLobby: () => void; onEnded: (m: string) => void;
}) {
  const { myId, settings } = props;
  const hostRef = useRef<HTMLDivElement>(null);
  const crossRef = useRef<HTMLDivElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const vigRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [game, setGame] = useState<PaintballGame | null>(null);
  const [fatal, setFatal] = useState("");
  const [paused, setPaused] = useState(false);
  const [board, setBoard] = useState(false);
  const touch = useMemo(isTouchDevice, []);
  const endedRef = useRef(props.onEnded);
  endedRef.current = props.onEnded;

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    let g: PaintballGame | null = null;
    let cancelled = false;
    import("@/game/paintball/game").then(({ PaintballGame }) => {
      if (cancelled) return;
      try {
        g = new PaintballGame(el, { apiBase: API_BASE, token: props.token, myId, initial: props.initial, settings, touch, onRoomEnded: (m) => endedRef.current(m) });
        g.setSettings(settings);
        setGame(g);
      } catch (err) {
        console.error(err);
        setFatal("Your browser could not start 3D graphics. Try updating Chrome or turning on hardware acceleration.");
      }
    }).catch(() => setFatal("Could not load the game. Check your connection and try again."));
    return () => { cancelled = true; g?.dispose(); setGame(null); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { game?.setSettings(settings); }, [game, settings]);
  useEffect(() => { game?.bind({ crosshair: crossRef.current, hitmarker: hitRef.current, vignette: vigRef.current, minimap: mapRef.current }); }, [game]);

  const hud: HudState = useSyncExternalStore(game ? game.store.subscribe : noopSubscribe, game ? game.store.get : getInitialHud);

  // back to the lobby view when the host returns the room to the lobby
  const lobbyRef = useRef(props.onLobby);
  lobbyRef.current = props.onLobby;
  useEffect(() => { if (hud.ready && hud.phase === "lobby") lobbyRef.current(); }, [hud.ready, hud.phase]);

  // Tab scoreboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === "Tab") { e.preventDefault(); setBoard(true); }
      if (e.code === "Escape" && !e.repeat) setPaused((p) => !p);
    };
    const up = (e: KeyboardEvent) => { if (e.code === "Tab") setBoard(false); };
    window.addEventListener("keydown", down); window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  // Esc releases the mouse: show the pause menu (with Leave) instead of a bare "click to play"
  const wasLocked = useRef(false);
  const [everLocked, setEverLocked] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  useEffect(() => {
    if (hud.locked) { setPaused(false); setEverLocked(true); }
    else if (wasLocked.current && hud.phase !== "finished") setPaused(true);
    wasLocked.current = hud.locked;
  }, [hud.locked, hud.phase]);

  const meta = hud.meta;
  const now = Date.now();
  const secs = Math.max(0, Math.ceil((hud.phaseEndsLocal - now) / 1000));
  const host = meta?.hostId === myId;
  const showClickToPlay = !touch && game && !hud.locked && !everLocked && hud.phase !== "finished" && !fatal;
  const w = WEAPONS[hud.weapon];

  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-slate-950 text-white">
      <div ref={hostRef} className="absolute inset-0" onClick={() => { if (!touch && game && !hud.locked && hud.phase !== "finished") game.requestLock(); }} />
      <div ref={vigRef} className="pb-vig pointer-events-none absolute inset-0 opacity-0" />
      {hud.scoped && <ScopeOverlay />}

      {!game && !fatal && (
        <div className="pb-bg absolute inset-0 grid place-items-center">
          <div className="text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-cyan-300" /><p className="mt-3 text-lg font-black italic">Inflating bunkers…</p></div>
        </div>
      )}
      {fatal && (
        <div className="pb-bg absolute inset-0 grid place-items-center p-6">
          <div className="max-w-md rounded-3xl border border-white/10 bg-black/50 p-6 text-center"><p className="text-lg font-black">{fatal}</p><button onClick={props.onLeave} className="pb-btn mt-4 rounded-2xl bg-cyan-300 px-6 py-3 font-black text-slate-950">Back</button></div>
        </div>
      )}

      {game && (
        <>
          {/* top bar */}
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2 sm:p-3">
            <div className="flex flex-col gap-2">
              <canvas ref={mapRef} width={176} height={128} className="h-[96px] w-[132px] rounded-2xl border-2 border-white/25 shadow-xl sm:h-[128px] sm:w-[176px]" />
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-white/80">
                {hud.connection.ok ? <Wifi className="h-3 w-3 text-emerald-300" /> : <WifiOff className="h-3 w-3 text-red-400" />}
                {hud.connection.ok ? `${Math.round(hud.connection.rtt)}ms` : "reconnecting"}
                {settings.showFps && <span className="ml-1">{hud.fps} fps</span>}
              </div>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ScoreTop scores={hud.scores} secs={hud.phase === "playing" ? secs : null} myTeam={hud.myTeam} />
              {touch && <KillFeed items={hud.feed.slice(-3)} small />}
            </div>
            <div className="flex w-[170px] flex-col items-end gap-1 sm:w-[300px]">
              <div className="pointer-events-auto flex gap-1.5">
                <button onClick={() => { game.releaseLock(); setPaused(true); }} className="flex items-center gap-1.5 rounded-xl border border-white/20 bg-black/55 px-3 py-2 text-xs font-black uppercase backdrop-blur"><Pause className="h-4 w-4" /> Menu</button>
                <button onClick={() => { game.releaseLock(); setConfirmLeave(true); }} className="flex items-center gap-1.5 rounded-xl border border-red-300/40 bg-red-500/70 px-3 py-2 text-xs font-black uppercase backdrop-blur"><LogOut className="h-4 w-4" /> Leave</button>
              </div>
              {!touch && <KillFeed items={hud.feed} />}
            </div>
          </div>

          {/* crosshair & hitmarker */}
          <div ref={crossRef} className="pb-cross"><i className="t" /><i className="b" /><i className="l" /><i className="r" /><b /></div>
          <div ref={hitRef} className="pb-hit" />
          {hud.damage.map((d) => <div key={d.id} className="pb-dmg" style={{ transform: `rotate(${(-d.angle * 180) / Math.PI}deg)` }} />)}

          {/* toasts */}
          <div className="pointer-events-none absolute left-1/2 top-[58%] flex -translate-x-1/2 flex-col items-center gap-1">
            {hud.toasts.map((t) => (
              <div key={t.id} className={"pb-toast pb-glow whitespace-nowrap text-center font-black italic uppercase " + (t.kind === "streak" ? "text-3xl text-yellow-300 sm:text-4xl" : t.kind === "splat" ? "text-xl text-white sm:text-2xl" : "text-sm text-slate-200")}>{t.text}</div>
            ))}
          </div>

          {/* bottom HUD */}
          <div className={"pointer-events-none absolute bottom-0 left-0 p-3 sm:p-4 " + (touch ? "top-auto" : "")}>
            {!touch && <HealthBar hp={hud.hp} protectedUntil={hud.protectedUntilLocal} streak={hud.streak} team={hud.myTeam} />}
          </div>
          {!touch && (
            <div className="pointer-events-none absolute bottom-0 right-0 p-3 sm:p-4">
              <WeaponHud hud={hud} />
            </div>
          )}
          {touch && <TouchControls game={game} hud={hud} />}
          {touch && <PortraitHint />}

          {/* countdown */}
          {hud.phase === "countdown" && secs > 0 && (
            <div className="pointer-events-none absolute inset-0 grid place-items-center">
              <div className="text-center">
                <p className="pb-glow text-lg font-black uppercase tracking-[.3em] text-white/90">Match starting</p>
                <p key={secs} className="pb-count pb-glow text-[9rem] font-black italic leading-none text-yellow-300">{secs}</p>
                <p className="pb-glow font-black text-white/90">You are on <span style={{ color: TEAM_CSS[hud.myTeam] }}>{TEAM_NAMES[hud.myTeam].toUpperCase()}</span></p>
              </div>
            </div>
          )}

          {/* respawn */}
          {!hud.alive && hud.phase === "playing" && (
            <div className="pointer-events-none absolute inset-x-0 top-[22%] flex justify-center px-4">
              <div className="rounded-3xl border border-white/15 bg-black/60 px-7 py-5 text-center shadow-2xl backdrop-blur-md">
                <p className="text-xs font-black uppercase tracking-[.3em] text-slate-300">Splatted by</p>
                <p className="mt-1 text-3xl font-black italic" style={{ color: hud.killedBy ? TEAM_CSS[hud.killedBy.team] : "#fff" }}>{hud.killedBy?.name || "the other team"}</p>
                {hud.killedBy && <p className="text-xs font-black uppercase text-slate-400">with the {WEAPONS[hud.killedBy.weapon]?.name}</p>}
                <p className="mt-3 text-sm font-black text-white">Back in the game in {Math.max(0, Math.ceil((hud.respawnAtLocal - now) / 1000))}…</p>
              </div>
            </div>
          )}

          {/* spawn protection */}
          {hud.alive && hud.protectedUntilLocal > now && hud.phase === "playing" && (
            <div className="pointer-events-none absolute left-1/2 top-[18%] -translate-x-1/2 rounded-full border border-cyan-200/40 bg-cyan-400/20 px-4 py-1.5 text-xs font-black uppercase tracking-wider text-cyan-100 backdrop-blur"><Shield className="mr-1 inline h-3.5 w-3.5" /> Spawn shield — firing drops it</div>
          )}

          {(board || hud.phase === "finished") && meta && (
            <Scoreboard meta={meta} myId={myId} scores={hud.scores} final={hud.phase === "finished"} host={host} secs={secs} onAction={props.onAction} onLeave={props.onLeave} />
          )}

          {showClickToPlay && !paused && hud.phase !== "lobby" && (
            <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[2px]" onClick={() => game.requestLock()}>
              <div className="pointer-events-none text-center">
                <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-white/90 text-slate-950 shadow-2xl"><Play className="h-9 w-9 fill-current" /></div>
                <p className="pb-glow mt-4 text-3xl font-black italic uppercase">Click to play</p>
                <p className="mt-1 text-sm font-bold text-white/80">WASD move · Mouse aim · Click fire · Right-click aim · Shift sprint · Space jump · C crouch · R reload · 1-3 markers</p>
                <p className="mt-2 text-sm font-black text-yellow-200">Press Esc any time to open the menu or leave the match</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); props.onLeave(); }} className="pb-btn absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-white/20 bg-black/60 px-5 py-3 font-black uppercase"><LogOut className="h-4 w-4" /> Leave match</button>
            </div>
          )}

          {confirmLeave && (
            <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[1.75rem] border border-white/15 bg-slate-950/95 p-5 text-center shadow-2xl">
                <h2 className="text-2xl font-black italic uppercase">Leave the match?</h2>
                <p className="mt-1 text-sm font-bold text-slate-300">A bot will take your spot. You can jump back in any time.</p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button onClick={() => { setConfirmLeave(false); if (!touch) game.requestLock(); }} className="pb-btn min-h-12 rounded-2xl border border-white/15 bg-white/10 font-black uppercase">Stay</button>
                  <button onClick={props.onLeave} className="pb-btn min-h-12 rounded-2xl bg-red-500 font-black uppercase">Leave</button>
                </div>
              </div>
            </div>
          )}

          {paused && !confirmLeave && (
            <PauseMenu settings={settings} onSettings={props.onSettings} onApplyQuality={props.onApplyQuality} onResume={() => { setPaused(false); game.requestLock(); }} onLeave={props.onLeave} quality={hud.quality} />
          )}
          {hud.error && (
            <div className="absolute inset-x-0 top-1/3 mx-auto max-w-md rounded-2xl border border-red-300/30 bg-black/80 p-4 text-center font-bold">{hud.error}<button onClick={props.onLeave} className="mt-3 block w-full rounded-xl bg-white/15 py-2 font-black">Leave match</button></div>
          )}
        </>
      )}
    </main>
  );
}

function KillFeed({ items, small }: { items: HudState["feed"]; small?: boolean }) {
  return (
    <div className={"flex flex-col gap-1 " + (small ? "items-center" : "items-end")}>
      {items.map((f) => (
        <div key={f.id} className={"pb-feed flex max-w-full items-center gap-1.5 rounded-lg px-2 py-1 font-black backdrop-blur " + (small ? "text-[10px] " : "text-[11px] sm:text-xs ") + (f.mine ? "bg-white/25" : "bg-black/45")}>
          <span className="truncate" style={{ color: TEAM_CSS[f.kTeam] }}>{f.killer}</span>
          <span className="rounded bg-white/15 px-1 text-[9px] text-white/90">{WEAPONS[f.weapon]?.short}{f.head ? " ◎" : ""}</span>
          <span className="truncate" style={{ color: TEAM_CSS[f.vTeam] }}>{f.victim}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreTop({ scores, secs, myTeam }: { scores: [number, number]; secs: number | null; myTeam: Team }) {
  const pct = (n: number) => Math.min(100, (n / PB.SCORE_TO_WIN) * 100);
  return (
    <div className="flex items-stretch gap-1.5">
      {([0, 1] as Team[]).map((t, i) => (
        <div key={t} className={"pb-skew relative w-[84px] overflow-hidden rounded-xl border-2 shadow-xl sm:w-[120px] " + (i === 1 ? "order-3" : "")} style={{ borderColor: TEAM_CSS[t], background: "rgba(5,10,25,.72)" }}>
          <div className="absolute inset-y-0 left-0 opacity-35" style={{ width: pct(scores[t]) + "%", background: TEAM_CSS[t] }} />
          <div className="pb-unskew relative px-2 py-1 text-center">
            <div className="text-[9px] font-black uppercase tracking-widest" style={{ color: TEAM_CSS[t] }}>{TEAM_NAMES[t]}{t === myTeam ? " · you" : ""}</div>
            <div className="pb-glow text-2xl font-black italic leading-none sm:text-3xl">{scores[t]}</div>
          </div>
        </div>
      ))}
      <div className="order-2 grid min-w-[70px] place-items-center rounded-xl border-2 border-white/25 bg-black/70 px-2 shadow-xl">
        <div className="text-center">
          <div className="text-[9px] font-black uppercase tracking-widest text-yellow-200">{secs === null ? "Prism" : "Time"}</div>
          <div className="text-lg font-black tabular-nums leading-none sm:text-xl">{secs === null ? "—" : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`}</div>
        </div>
      </div>
    </div>
  );
}

function HealthBar({ hp, protectedUntil, streak, team, compact }: { hp: number; protectedUntil: number; streak: number; team: Team; compact?: boolean }) {
  const low = hp <= 35;
  return (
    <div className={compact ? "w-[150px]" : "w-[260px]"}>
      {streak >= 2 && <div className="pb-glow mb-1 text-xs font-black italic uppercase text-yellow-300">🔥 {streak} splat streak</div>}
      <div className="pb-skew overflow-hidden rounded-xl border-2 border-white/30 bg-black/60 shadow-xl">
        <div className="pb-unskew flex items-center gap-2 px-3 py-1.5">
          <span className={"pb-glow w-12 text-2xl font-black italic tabular-nums " + (low ? "text-red-300" : "text-white")}>{hp}</span>
          <div className="relative h-3.5 flex-1 overflow-hidden rounded-full bg-white/15">
            <div className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150" style={{ width: hp + "%", background: low ? "linear-gradient(90deg,#ef4444,#fb7185)" : `linear-gradient(90deg, ${TEAM_CSS[team]}, #a3e635)` }} />
            {[25, 50, 75].map((x) => <div key={x} className="absolute inset-y-0 w-px bg-black/40" style={{ left: x + "%" }} />)}
          </div>
          {protectedUntil > Date.now() && <Shield className="h-4 w-4 text-cyan-200" />}
        </div>
      </div>
    </div>
  );
}

function WeaponHud({ hud, compact }: { hud: HudState; compact?: boolean }) {
  const w = WEAPONS[hud.weapon];
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="pb-skew rounded-xl border-2 border-white/30 bg-black/60 px-4 py-1.5 shadow-xl">
        <div className="pb-unskew flex items-end gap-2">
          {hud.reload >= 0 ? (
            <div className="w-[120px] py-1">
              <div className="text-xs font-black uppercase text-yellow-200">Reloading</div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-yellow-300" style={{ width: hud.reload * 100 + "%" }} /></div>
            </div>
          ) : (
            <>
              <span className={"pb-glow text-4xl font-black italic tabular-nums leading-none " + (hud.ammo[hud.weapon] <= Math.ceil(w.mag * 0.2) ? "text-red-300" : "")}>{hud.ammo[hud.weapon]}</span>
              <span className="pb-1 text-sm font-black text-white/60">/ {w.mag}</span>
            </>
          )}
        </div>
      </div>
      {!compact && (
        <div className="flex gap-1.5">
          {WEAPONS.map((wp, i) => (
            <div key={wp.id} className={"pb-skew rounded-lg border-2 px-2.5 py-1 text-center shadow-lg " + (i === hud.weapon ? "border-yellow-300 bg-yellow-300/25" : "border-white/20 bg-black/50")}>
              <div className="pb-unskew"><div className="text-[9px] font-black text-white/60">{i + 1}</div><div className="text-[11px] font-black italic">{wp.short}</div></div>
            </div>
          ))}
        </div>
      )}
      {hud.ammo[hud.weapon] === 0 && hud.reload < 0 && <div className="pb-glow text-sm font-black uppercase text-red-300">Press R to reload</div>}
    </div>
  );
}

function PortraitHint() {
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  if (!portrait || dismissed) return null;
  return (
    <div className="absolute inset-x-3 top-1/3 z-10 rounded-2xl border border-white/15 bg-black/75 p-4 text-center backdrop-blur">
      <p className="text-lg font-black italic">Turn your device sideways</p>
      <p className="mt-1 text-sm font-bold text-slate-300">Prism Paintball plays best in landscape.</p>
      <button onClick={() => setDismissed(true)} className="mt-3 rounded-xl bg-white/15 px-4 py-2 text-sm font-black">Keep playing</button>
    </div>
  );
}

function ScopeOverlay() {
  return (
    <div className="pb-scope pointer-events-none absolute inset-0">
      <div className="absolute left-1/2 top-1/2 h-[62vmin] w-[62vmin] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-black/80 shadow-[inset_0_0_60px_rgba(0,0,0,.6)]" />
      <div className="absolute left-1/2 top-1/2 h-[62vmin] w-px -translate-x-1/2 -translate-y-1/2 bg-black/70" />
      <div className="absolute left-1/2 top-1/2 h-px w-[62vmin] -translate-x-1/2 -translate-y-1/2 bg-black/70" />
      <div className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(255,0,0,.9)]" />
    </div>
  );
}

function Scoreboard({ meta, myId, scores, final, host, secs, onAction, onLeave }: { meta: RoomMeta; myId: number; scores: [number, number]; final: boolean; host: boolean; secs: number; onAction: (b: Record<string, unknown>) => Promise<void>; onLeave: () => void }) {
  const mvp = [...meta.players].sort((a, b) => b.tags - a.tags || a.downs - b.downs)[0];
  const winner = meta.winner;
  const me = meta.players.find((p) => p.id === myId);
  const won = final && winner !== null && winner !== -1 && me && winner === me.team;
  return (
    <div className={"absolute inset-0 grid place-items-center p-3 " + (final ? "bg-black/60 backdrop-blur-sm" : "pointer-events-none")}>
      <div className="w-full max-w-3xl rounded-[1.75rem] border border-white/15 bg-slate-950/90 p-4 shadow-2xl sm:p-6">
        {final && (
          <div className="mb-4 text-center">
            <p className="text-xs font-black uppercase tracking-[.35em] text-slate-400">Match over</p>
            <h2 className="pb-glow text-5xl font-black italic uppercase sm:text-6xl" style={{ color: winner === 0 || winner === 1 ? TEAM_CSS[winner] : "#fff" }}>
              {winner === -1 || winner === null ? "Draw!" : won ? "Victory!" : `${TEAM_NAMES[winner]} wins`}
            </h2>
            <p className="mt-1 text-2xl font-black"><span style={{ color: TEAM_CSS[0] }}>{scores[0]}</span> <span className="text-white/50">–</span> <span style={{ color: TEAM_CSS[1] }}>{scores[1]}</span></p>
            {mvp && mvp.tags > 0 && <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-yellow-300/20 px-3 py-1 text-sm font-black text-yellow-200"><Crown className="h-4 w-4" /> MVP: {mvp.name} · {mvp.tags} splats</p>}
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {([0, 1] as Team[]).map((t) => (
            <div key={t} className="overflow-hidden rounded-2xl border" style={{ borderColor: TEAM_CSS[t] + "66" }}>
              <div className="flex items-center justify-between px-3 py-2" style={{ background: TEAM_CSS[t] + "33" }}>
                <b className="font-black italic uppercase" style={{ color: TEAM_CSS[t] }}>{TEAM_NAMES[t]}</b><b className="text-xl font-black">{scores[t]}</b>
              </div>
              <table className="w-full text-sm">
                <thead><tr className="text-[10px] uppercase tracking-wider text-slate-400"><th className="px-3 py-1 text-left">Player</th><th>Splats</th><th>Outs</th><th>Best</th></tr></thead>
                <tbody>
                  {meta.players.filter((p) => p.team === t).sort((a, b) => b.tags - a.tags).map((p) => (
                    <tr key={p.id} className={p.id === myId ? "bg-white/10" : ""}>
                      <td className="max-w-[140px] truncate px-3 py-1.5 font-black">{p.name}{!p.connected && !p.bot ? " (away)" : ""}</td>
                      <td className="text-center font-black">{p.tags}</td><td className="text-center text-slate-300">{p.downs}</td><td className="text-center text-slate-300">{p.best}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
        {final && (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <p className="w-full text-center text-sm font-bold text-slate-300">{meta.practice || meta.quick ? `Next match starts in ${secs}s` : `Returning to the lobby in ${secs}s`}</p>
            {host && <button onClick={() => onAction({ type: "restart" })} className="pb-btn flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-400 px-6 font-black uppercase text-slate-950"><RotateCcw className="h-4 w-4" /> Play again</button>}
            {host && !meta.practice && !meta.quick && <button onClick={() => onAction({ type: "lobby" })} className="pb-btn flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-6 font-black uppercase"><Users className="h-4 w-4" /> Back to lobby</button>}
            <button onClick={onLeave} className="pb-btn flex min-h-12 items-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 font-black uppercase"><LogOut className="h-4 w-4" /> Leave</button>
          </div>
        )}
      </div>
    </div>
  );
}

function PauseMenu({ settings, onSettings, onApplyQuality, onResume, onLeave, quality }: { settings: GameSettings; onSettings: (s: GameSettings) => void; onApplyQuality: (s: GameSettings) => void; onResume: () => void; onLeave: () => void; quality: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-black/55 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[1.75rem] border border-white/15 bg-slate-950/95 p-5 shadow-2xl">
        <h2 className="text-3xl font-black italic uppercase">Paused</h2>
        <SettingsFields settings={settings} onChange={onSettings} onQuality={(q) => onApplyQuality({ ...settings, quality: q })} activeQuality={quality} />
        <div className="mt-5 grid gap-2">
          <button onClick={onResume} className="pb-btn flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-cyan-300 font-black uppercase text-slate-950"><Play className="h-4 w-4 fill-current" /> Resume</button>
          <button onClick={onLeave} className="pb-btn flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 font-black uppercase"><LogOut className="h-4 w-4" /> Leave match</button>
        </div>
      </div>
    </div>
  );
}

function SettingsPanel({ settings, onChange, onClose }: { settings: GameSettings; onChange: (s: GameSettings) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[1.75rem] border border-white/15 bg-slate-950/95 p-5 text-white shadow-2xl">
        <div className="flex items-center justify-between"><h2 className="text-3xl font-black italic uppercase">Settings</h2><button onClick={onClose} className="rounded-xl bg-white/10 p-2"><X className="h-5 w-5" /></button></div>
        <SettingsFields settings={settings} onChange={onChange} onQuality={(q) => onChange({ ...settings, quality: q })} activeQuality="" />
        <button onClick={onClose} className="pb-btn mt-5 min-h-12 w-full rounded-2xl bg-cyan-300 font-black uppercase text-slate-950">Done</button>
      </div>
    </div>
  );
}

function SettingsFields({ settings, onChange, onQuality, activeQuality }: { settings: GameSettings; onChange: (s: GameSettings) => void; onQuality: (q: GameSettings["quality"]) => void; activeQuality: string }) {
  return (
    <div className="mt-4 grid gap-4 text-sm font-bold">
      <label className="grid gap-1.5">
        <span className="flex justify-between"><span>Aim sensitivity</span><span className="text-cyan-300">{settings.sensitivity.toFixed(2)}×</span></span>
        <input type="range" min={0.2} max={3} step={0.05} value={settings.sensitivity} onChange={(e) => onChange({ ...settings, sensitivity: Number(e.target.value) })} className="accent-cyan-300" />
      </label>
      <label className="grid gap-1.5">
        <span className="flex justify-between"><span className="flex items-center gap-1"><Volume2 className="h-4 w-4" /> Volume</span><span className="text-cyan-300">{Math.round(settings.volume * 100)}%</span></span>
        <input type="range" min={0} max={1} step={0.05} value={settings.volume} onChange={(e) => onChange({ ...settings, volume: Number(e.target.value) })} className="accent-cyan-300" />
      </label>
      <div className="grid gap-1.5">
        <span className="flex justify-between"><span className="flex items-center gap-1"><Zap className="h-4 w-4" /> Graphics</span>{activeQuality && <span className="text-xs uppercase text-slate-400">running: {activeQuality}</span>}</span>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/40 p-1">
          {(["auto", "low", "medium", "high"] as GameSettings["quality"][]).map((q) => (
            <button key={q} onClick={() => onQuality(q)} className={"rounded-lg py-2 text-xs font-black uppercase " + (settings.quality === q ? "bg-cyan-300 text-slate-950" : "text-slate-300")}>{q}</button>
          ))}
        </div>
      </div>
      <label className="flex items-center justify-between"><span>Invert look up/down</span><input type="checkbox" checked={settings.invertY} onChange={(e) => onChange({ ...settings, invertY: e.target.checked })} className="h-5 w-5 accent-cyan-300" /></label>
      <label className="flex items-center justify-between"><span>Show FPS</span><input type="checkbox" checked={settings.showFps} onChange={(e) => onChange({ ...settings, showFps: e.target.checked })} className="h-5 w-5 accent-cyan-300" /></label>
    </div>
  );
}

// ===========================================================================
// Touch controls
// ===========================================================================

function TouchControls({ game, hud }: { game: PaintballGame; hud: HudState }) {
  const stickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const stickId = useRef<number | null>(null);
  const looks = useRef(new Map<number, { x: number; y: number }>());

  const stickMove = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId || !stickRef.current) return;
    const r = stickRef.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R;
    const l = Math.hypot(dx, dy);
    if (l > 1) { dx /= l; dy /= l; }
    game.touchSetMove(dx, dy);
    if (knobRef.current) knobRef.current.style.transform = `translate(${dx * R * 0.6}px, ${dy * R * 0.6}px)`;
  };
  const stickEnd = (e: React.PointerEvent) => {
    if (stickId.current !== e.pointerId) return;
    stickId.current = null;
    game.touchSetMove(0, 0);
    if (knobRef.current) knobRef.current.style.transform = "translate(0,0)";
  };
  const lookStart = (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); looks.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); };
  const lookMove = (e: React.PointerEvent) => {
    const p = looks.current.get(e.pointerId);
    if (!p) return;
    game.touchLook(e.clientX - p.x, e.clientY - p.y);
    looks.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
  };
  const lookEnd = (e: React.PointerEvent) => { looks.current.delete(e.pointerId); };
  const btn = "pointer-events-auto grid place-items-center rounded-full border-2 border-white/40 font-black shadow-xl backdrop-blur active:scale-95";

  return (
    <>
      {/* look area (right side) */}
      <div className="absolute bottom-0 right-0 top-16 w-[58%] touch-none" onPointerDown={lookStart} onPointerMove={lookMove} onPointerUp={lookEnd} onPointerCancel={lookEnd} />
      {/* joystick */}
      <div
        ref={stickRef}
        className="absolute bottom-6 left-6 h-36 w-36 touch-none rounded-full border-2 border-white/30 bg-black/25 backdrop-blur"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); stickId.current = e.pointerId; stickMove(e); }}
        onPointerMove={stickMove} onPointerUp={stickEnd} onPointerCancel={stickEnd}
      >
        <div ref={knobRef} className="absolute left-1/2 top-1/2 -ml-8 -mt-8 h-16 w-16 rounded-full border-2 border-white/60 bg-white/30 shadow-lg" />
      </div>
      <div className="pointer-events-none absolute left-2 top-[128px] sm:left-3 sm:top-[160px]"><HealthBar hp={hud.hp} protectedUntil={hud.protectedUntilLocal} streak={hud.streak} team={hud.myTeam} compact /></div>
      {/* weapon + ammo */}
      <div className="absolute right-2 top-[60px] flex flex-col items-end gap-1.5 sm:right-3">
        <div className="pointer-events-none origin-top-right scale-[.8]"><WeaponHud hud={hud} compact /></div>
        <div className="flex gap-1.5">
          {WEAPONS.map((w, i) => (
            <button key={w.id} onPointerDown={() => game.selectWeapon(i)} className={"pointer-events-auto rounded-xl border-2 px-2 py-1.5 text-[10px] font-black " + (i === hud.weapon ? "border-yellow-300 bg-yellow-300/30" : "border-white/25 bg-black/50")}>{w.short}</button>
          ))}
        </div>
      </div>
      {/* action buttons */}
      <div className="absolute bottom-5 right-4 flex items-end gap-3">
        <div className="flex flex-col gap-3">
          <button onPointerDown={() => game.touchReload()} className={btn + " h-12 w-12 bg-black/45 text-[10px]"}>RLD</button>
          <button onPointerDown={() => game.touchToggleCrouch()} className={btn + " h-12 w-12 text-[10px] " + (hud.crouch ? "bg-cyan-400/60" : "bg-black/45")}>DUCK</button>
        </div>
        <div className="flex flex-col gap-3">
          <button onPointerDown={() => game.touchToggleAds()} className={btn + " h-14 w-14 text-xs " + (hud.ads ? "bg-cyan-400/60" : "bg-black/45")}>AIM</button>
          <button onPointerDown={() => game.touchJump()} className={btn + " h-14 w-14 bg-black/45 text-xs"}>JUMP</button>
        </div>
        <button
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); looks.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); game.touchSetFire(true); }}
          onPointerMove={lookMove}
          onPointerUp={(e) => { looks.current.delete(e.pointerId); game.touchSetFire(false); }}
          onPointerCancel={(e) => { looks.current.delete(e.pointerId); game.touchSetFire(false); }}
          className={btn + " h-24 w-24 touch-none bg-gradient-to-br from-pink-500 to-fuchsia-600 text-lg"}
        >FIRE</button>
      </div>
    </>
  );
}
