import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Coins, Copy, Crown, Flag, Gauge, Globe, Loader2, Lock, Pause, Play, RotateCcw, Settings, Trophy, Users, Wrench, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { TRACKS } from "@/game/racing/tracks";
import { BODIES, UPGRADES, UPGRADE_COST, MAX_UPGRADE, PAINTS, type BodyDef, type UpgradeId } from "@/game/racing/kart";
import { loadSave, upgradesFor, type SaveData } from "@/game/racing/save";
import { Profile } from "@/game/racing/profile";
import { RacingNet } from "@/game/racing/net";
import { API_BASE } from "@/lib/queryClient";
import { TRACK_IDS, type RaceSnap, type RaceRoomMeta, type RacePhase } from "@shared/racing";
import type { Race, RaceHud, RaceResult, RacerInfo, Mode } from "@/game/racing/race";

const CC = [{ id: 50, label: "50cc", mul: 0.84, sub: "Relaxed" }, { id: 100, label: "100cc", mul: 1.0, sub: "Classic" }, { id: 150, label: "150cc", mul: 1.16, sub: "Expert" }];
const POINTS = [15, 12, 10, 8, 6, 4, 2, 1];
const RIVALS = [
  { id: "nova", name: "Nova", paint: 0x8b5cf6, helmet: 0xf8fafc },
  { id: "pixel", name: "Pixel", paint: 0x22c55e, helmet: 0x111827 },
  { id: "rocket", name: "Rocket", paint: 0xf97316, helmet: 0xfacc15 },
  { id: "luna", name: "Luna", paint: 0xec4899, helmet: 0x60a5fa },
  { id: "zest", name: "Zest", paint: 0xfacc15, helmet: 0x22c55e },
  { id: "echo", name: "Echo", paint: 0x06b6d4, helmet: 0xef4444 },
  { id: "turbo", name: "Turbo", paint: 0x3b82f6, helmet: 0xf97316 },
];
const THEME_STYLE: Record<string, string> = {
  shores: "linear-gradient(135deg,#38bdf8,#fde68a 70%,#34d399)",
  books: "linear-gradient(135deg,#f59e0b,#b45309 55%,#7c3aed)",
  neon: "linear-gradient(135deg,#0f0c29,#7c3aed 55%,#ec4899)",
  frost: "linear-gradient(135deg,#e0f2fe,#93c5fd 55%,#6366f1)",
};
const ordinal = (n: number) => n + (n === 1 ? "st" : n === 2 ? "nd" : n === 3 ? "rd" : "th");
const fmt = (s: number) => { if (!s || !isFinite(s)) return "--:--.--"; const m = Math.floor(s / 60), r = s - m * 60; return `${m}:${r.toFixed(2).padStart(5, "0")}`; };
const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
const isTouch = () => typeof window !== "undefined" && (window.matchMedia?.("(pointer: coarse)").matches || "ontouchstart" in window);

interface Settings { quality: "auto" | "low" | "medium" | "high"; sfx: number; music: number; autoGas: boolean }
const SET_KEY = "aurora-racers-settings";
const loadSettings = (): Settings => { try { return { quality: "auto", sfx: 0.8, music: 0.5, autoGas: true, ...JSON.parse(localStorage.getItem(SET_KEY) || "{}") }; } catch { return { quality: "auto", sfx: 0.8, music: 0.5, autoGas: true }; } };

const CSS = `
.ar-font{font-family:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
.ar-bg{background:radial-gradient(1000px 520px at 10% -10%,rgba(236,72,153,.4),transparent 60%),radial-gradient(900px 520px at 100% 0%,rgba(59,130,246,.45),transparent 60%),radial-gradient(800px 500px at 50% 120%,rgba(250,204,21,.25),transparent 60%),linear-gradient(160deg,#0b1026,#1a0b2e 55%,#0a1222)}
.ar-btn{transition:transform .12s,filter .12s}.ar-btn:hover{transform:translateY(-2px);filter:brightness(1.08)}.ar-btn:active{transform:translateY(1px) scale(.98)}
.ar-glow{text-shadow:0 3px 0 rgba(0,0,0,.35),0 0 22px rgba(255,255,255,.25)}
.ar-pop{animation:arPop .9s ease-out}
@keyframes arPop{0%{transform:scale(2.2);opacity:0}25%{transform:scale(1);opacity:1}100%{opacity:1}}
.ar-toast{animation:arToast 1.8s ease-out forwards}
@keyframes arToast{0%{opacity:0;transform:translateY(12px) scale(.8)}12%{opacity:1;transform:scale(1.12)}22%{transform:scale(1)}80%{opacity:1}100%{opacity:0;transform:translateY(-10px)}}
.ar-skew{transform:skewX(-10deg)}.ar-unskew{transform:skewX(10deg)}
.ar-stripes{background-image:repeating-linear-gradient(-45deg,rgba(255,255,255,.06) 0 14px,transparent 14px 28px)}
.ar-boost{background:radial-gradient(ellipse at center,transparent 55%,rgba(255,170,40,.18) 80%,rgba(255,120,0,.32) 100%)}
.ar-roll{animation:arRoll .12s linear infinite}
@keyframes arRoll{0%{transform:translateY(-6px)}100%{transform:translateY(6px)}}
`;

type View = "menu" | "garage" | "tracks" | "race" | "gpStandings" | "online" | "lobby";

export default function AuroraRally() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();
  const uid = user?.id ?? "guest";
  const [profile, setProfile] = useState<Profile | null>(null);
  const [save, setSave] = useState<SaveData>(() => loadSave(uid));
  const [view, setView] = useState<View>("menu");
  const [mode, setMode] = useState<Mode>("race");
  const [cc, setCc] = useState(100);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [race, setRace] = useState<{ key: number; trackId: string } | null>(null);
  const [gp, setGp] = useState<{ index: number; points: Record<string, number>; last: RaceResult | null } | null>(null);
  const [notice, setNotice] = useState("");
  const [online, setOnline] = useState<OnlineSession | null>(null);
  const playerName = String((user as { displayName?: string; username?: string } | null)?.displayName || (user as { username?: string } | null)?.username || "You").slice(0, 14);

  useEffect(() => {
    if (!token) return;
    let stop = false;
    Profile.load(API_BASE, token, uid).then((p) => { if (!stop) { setProfile(p); setSave(p.save); } });
    return () => { stop = true; };
  }, [uid, token]);
  const setSettings = (s: Settings) => { setSettingsState(s); try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch { /* ignore */ } };
  /** Run a profile action and show any refusal as a notice. */
  const act = useCallback(async (fn: (p: Profile) => Promise<unknown>) => {
    if (!profile) return;
    try { await fn(profile); setSave({ ...profile.save }); setNotice(""); }
    catch (e) { setSave({ ...profile.save }); setNotice(e instanceof Error ? e.message : "That didn't work."); }
  }, [profile]);

  const body = BODIES.find((b) => b.id === save.body) || BODIES[0];
  const ccMul = CC.find((c) => c.id === cc)?.mul || 1;

  const racers = useMemo((): RacerInfo[] => {
    const player: RacerInfo = { id: "player", name: playerName, isPlayer: true, body, upgrades: upgradesFor(save, body.id), look: { body: body.id, paint: save.paint, helmet: save.helmet, driver: save.driver, name: playerName } };
    const lvl = cc === 150 ? 4 : cc === 100 ? 2 : 0;
    const skillBase = cc === 150 ? 0.965 : cc === 100 ? 0.93 : 0.88;
    const rivals = RIVALS.map((r, i): RacerInfo => {
      const b = BODIES[(i * 3 + 1) % BODIES.length];
      return { id: r.id, name: r.name, isPlayer: false, body: b, skill: skillBase + (i % 4) * 0.012, upgrades: { engine: lvl, turbo: lvl, tires: lvl }, look: { body: b.id, paint: r.paint, helmet: r.helmet, driver: i, name: r.name } };
    });
    return [player, ...rivals];
  }, [body, save, cc, playerName]);

  const startRace = (trackId: string) => { setRace((r) => ({ key: (r?.key || 0) + 1, trackId })); setView("race"); };

  const onFinish = useCallback((res: RaceResult) => {
    if (profile) void profile.result({ mode: mode === "gp" ? "gp" : mode === "tt" ? "tt" : "race", trackId: res.trackId, place: res.place, time: res.time, bestLap: res.bestLap, coins: res.standings.find((x) => x.isPlayer)?.coins ?? 0, cc }).then(() => setSave({ ...profile.save }));
    setGp((g) => {
      if (!g) return g;
      const points = { ...g.points };
      res.standings.forEach((st, i) => { points[st.id] = (points[st.id] || 0) + POINTS[i]; });
      return { ...g, points, last: res };
    });
  }, [profile, mode, cc]);

  const startGp = () => { setMode("gp"); setGp({ index: 0, points: {}, last: null }); startRace(TRACKS[0].id); };
  const nextGp = () => {
    if (!gp) return;
    if (gp.index + 1 >= TRACKS.length) { setView("gpStandings"); return; }
    setGp({ ...gp, index: gp.index + 1, last: null });
    startRace(TRACKS[gp.index + 1].id);
  };
  const finishGpCup = (place: number) => {
    void act((p) => p.cup(place, cc));
    setGp(null); setView("menu");
  };

  // ---------------- online ----------------
  const enterOnline = async (kind: "quick" | "create" | "private" | "join", code?: string) => {
    if (!token) return;
    setNotice("");
    try {
      const prof = profile?.save || save;
      const path = kind === "quick" ? "/api/racing/quick" : kind === "join" ? `/api/racing/rooms/${code}/join` : "/api/racing/rooms";
      const res = await fetch(API_BASE + path, { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify({ publicRoom: kind === "create", profile: prof }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not join.");
      const snap = data as RaceSnap;
      const net = new RacingNet(API_BASE, token, snap.meta!.code, {
        onSnap: () => {},
        onClosed: (m) => { setNotice(m); setOnline(null); setView("online"); },
      });
      net.ingest(snap);
      net.start();
      setOnline({ net, code: snap.meta!.code });
      setView("lobby");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not reach the race server."); }
  };
  const leaveOnline = useCallback(() => {
    if (online && token) {
      online.net.stop();
      void fetch(API_BASE + "/api/racing/rooms/" + online.code + "/leave", { method: "POST", headers: { Authorization: "Bearer " + token }, keepalive: true }).catch(() => {});
    }
    setOnline(null);
    setView("online");
    if (profile) void profile.refresh().then((s) => setSave({ ...s }));
  }, [online, token, profile]);
  useEffect(() => () => { online?.net.stop(); }, [online]);
  useEffect(() => {
    const onHide = () => { if (online && token) { try { void fetch(API_BASE + "/api/racing/rooms/" + online.code + "/leave", { method: "POST", headers: { Authorization: "Bearer " + token }, keepalive: true }); } catch { /* ignore */ } } };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [online, token]);

  return (
    <div className="ar-font">
      <style>{CSS}</style>
      {view === "menu" && (
        <Menu save={save} cc={cc} setCc={setCc} onBack={() => navigate("/games")} onSettings={() => setShowSettings(true)} storage={profile ? profile.mode : "loading"}
          onGp={startGp} onRace={() => { setMode("race"); setView("tracks"); }} onTt={() => { setMode("tt"); setView("tracks"); }} onGarage={() => setView("garage")} onOnline={() => setView("online")} />
      )}
      {view === "garage" && <Garage save={save} act={act} notice={notice} onBack={() => { setNotice(""); setView("menu"); }} />}
      {view === "tracks" && <TrackSelect save={save} mode={mode} onBack={() => setView("menu")} onPick={startRace} />}
      {view === "race" && race && (
        <RaceView
          key={race.key} trackId={race.trackId} mode={mode} cc={ccMul} racers={racers} settings={settings} onSettings={setSettings}
          gp={gp} onFinish={onFinish}
          onRetry={() => startRace(race.trackId)}
          onNext={mode === "gp" ? nextGp : undefined}
          onQuit={() => { setGp(null); setView("menu"); setRace(null); }}
        />
      )}
      {view === "gpStandings" && gp && <GpStandings gp={gp} racers={racers} cc={cc} onDone={finishGpCup} />}
      {view === "online" && <OnlineMenu token={token || ""} notice={notice} onBack={() => { setNotice(""); setView("menu"); }} onEnter={enterOnline} />}
      {view === "lobby" && online && (
        <OnlineRoom session={online} myId={String(uid)} token={token || ""} settings={settings} onSettings={setSettings} onLeave={leaveOnline}
          onRaceDone={() => { if (profile) void profile.refresh().then((s2) => setSave({ ...s2 })); }} />
      )}
      {showSettings && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

interface OnlineSession { net: RacingNet; code: string }

// ===========================================================================
// Menu
// ===========================================================================

function Menu({ save, cc, setCc, onBack, onSettings, onGp, onRace, onTt, onGarage, onOnline, storage }: { save: SaveData; cc: number; setCc: (c: number) => void; onBack: () => void; onSettings: () => void; onGp: () => void; onRace: () => void; onTt: () => void; onGarage: () => void; onOnline: () => void; storage: "server" | "local" | "loading" }) {
  const cup = save.cups["aurora-" + cc];
  return (
    <main className="ar-bg min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
        <button onClick={onBack} className="ar-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black backdrop-blur"><ArrowLeft className="h-5 w-5" /> Games</button>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-4 py-3 font-black text-yellow-200"><Coins className="h-5 w-5" /> {save.coins}</span>
          <button onClick={onSettings} className="ar-btn rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur"><Settings className="h-5 w-5" /></button>
        </div>
      </div>
      <section className="ar-stripes relative mx-auto mt-6 max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-black/30 p-6 shadow-[0_40px_120px_rgba(0,0,0,.5)] sm:p-10">
        <p className="text-xs font-black uppercase tracking-[.35em] text-pink-300">A.R.I.S.E. speedway</p>
        <h1 className="ar-glow mt-2 text-6xl font-black italic leading-[.9] sm:text-8xl">AURORA<br /><span className="bg-gradient-to-r from-yellow-300 via-pink-400 to-sky-400 bg-clip-text text-transparent" style={{ textShadow: "none" }}>RACERS</span></h1>
        <p className="mt-4 max-w-2xl text-base font-bold text-slate-200 sm:text-lg">Drift for mini-turbos, grab item boxes, splat your rivals with paint bombs and race across 4 wild tracks. Earn coins to upgrade your kart.</p>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-slate-300">Speed class</span>
          {CC.map((c) => (
            <button key={c.id} onClick={() => setCc(c.id)} className={"ar-btn rounded-xl px-4 py-2 text-sm font-black " + (cc === c.id ? "bg-white text-slate-950" : "bg-white/10 text-white")}>{c.label}<span className="ml-1 text-[10px] opacity-70">{c.sub}</span></button>
          ))}
        </div>
        <button onClick={onOnline} className="ar-btn mt-6 flex w-full items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500 p-5 text-left" style={{ boxShadow: "0 8px 0 #6b21a8" }}>
          <span className="flex items-center gap-3"><Globe className="h-9 w-9" /><span><span className="block text-3xl font-black italic uppercase">Race online</span><span className="text-sm font-black opacity-90">Live races against readers from your school · win bonus coins</span></span></span>
          <Play className="h-8 w-8 fill-current" />
        </button>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BigButton onClick={onGp} color="from-yellow-300 to-orange-500" shadow="#b45309" icon={<Trophy className="h-7 w-7" />} title="Grand Prix" sub={cup ? `Best: ${ordinal(cup)} place` : "4 races · win the Aurora Cup"} />
          <BigButton onClick={onRace} color="from-pink-400 to-fuchsia-600" shadow="#86198f" icon={<Flag className="h-7 w-7" />} title="Quick Race" sub="Pick any track" />
          <BigButton onClick={onTt} color="from-sky-400 to-blue-600" shadow="#1e3a8a" icon={<Gauge className="h-7 w-7" />} title="Time Trial" sub="Beat your best time" />
          <BigButton onClick={onGarage} color="from-emerald-400 to-teal-600" shadow="#115e59" icon={<Wrench className="h-7 w-7" />} title="Garage" sub="Karts, paint & upgrades" />
        </div>
        <p className="mt-4 text-xs font-bold text-slate-400">{storage === "server" ? "✓ Your coins, karts and upgrades are saved to your account." : storage === "local" ? "Progress is saved on this device for now." : "Loading your garage…"}</p>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center sm:max-w-md">
          {[["Races", save.races], ["Wins", save.wins], ["Karts", save.owned.length]].map(([k, v]) => (
            <div key={String(k)} className="rounded-2xl bg-white/5 py-3"><div className="text-2xl font-black">{v}</div><div className="text-[10px] font-black uppercase tracking-widest text-slate-400">{k}</div></div>
          ))}
        </div>
      </section>
      <section className="mx-auto mt-6 max-w-6xl rounded-3xl border border-white/10 bg-black/25 p-5 text-sm font-bold text-slate-300">
        <h3 className="mb-2 text-xs font-black uppercase tracking-[.25em] text-slate-400">How to drive</h3>
        <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
          {[["↑ / W", "Accelerate"], ["↓ / S", "Brake & reverse"], ["← → / A D", "Steer"], ["Space / Shift", "Hold while turning to drift — sparks = mini-turbo"], ["E / F", "Use item"], ["Esc", "Pause"]].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2"><kbd className="min-w-[90px] rounded-lg border border-white/15 bg-white/10 px-2 py-0.5 text-center text-xs font-black text-white">{k}</kbd>{v}</div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">Tip: press the gas just as the last red light turns on for a rocket start. Blue → orange → purple drift sparks give bigger boosts.</p>
      </section>
    </main>
  );
}

function BigButton({ onClick, color, shadow, icon, title, sub }: { onClick: () => void; color: string; shadow: string; icon: React.ReactNode; title: string; sub: string }) {
  return (
    <button onClick={onClick} className={`ar-btn flex min-h-[112px] flex-col items-start justify-between rounded-3xl bg-gradient-to-br ${color} p-4 text-left text-slate-950`} style={{ boxShadow: `0 8px 0 ${shadow}` }}>
      {icon}
      <span><span className="block text-2xl font-black italic uppercase">{title}</span><span className="text-xs font-black opacity-80">{sub}</span></span>
    </button>
  );
}

// ===========================================================================
// Garage
// ===========================================================================

function StatBar({ label, value, bonus }: { label: string; value: number; bonus: number }) {
  return (
    <div className="flex items-center gap-2 text-xs font-black uppercase">
      <span className="w-20 text-slate-300">{label}</span>
      <div className="flex flex-1 gap-0.5">
        {Array.from({ length: 12 }).map((_, i) => <div key={i} className={"h-3 flex-1 rounded-sm " + (i < value ? "bg-sky-400" : i < value + bonus ? "bg-yellow-300" : "bg-white/10")} />)}
      </div>
    </div>
  );
}

function Garage({ save, act, notice, onBack }: { save: SaveData; act: (fn: (p: Profile) => Promise<unknown>) => Promise<void>; notice: string; onBack: () => void }) {
  const [sel, setSel] = useState(save.body);
  const body = BODIES.find((b) => b.id === sel) || BODIES[0];
  const owned = save.owned.includes(body.id);
  const up = upgradesFor(save, body.id);
  const bonus = { speed: up.engine * 0.8, accel: up.turbo * 0.8, handling: up.tires * 0.8, weight: 0 };
  const buyBody = (b: BodyDef) => act((p) => p.buyKart(b.id));
  const buyUp = (u: UpgradeId) => act((p) => p.upgrade(body.id, u));
  return (
    <main className="ar-bg min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <button onClick={onBack} className="ar-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black"><ArrowLeft className="h-5 w-5" /> Back</button>
        <span className="flex items-center gap-2 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-4 py-3 font-black text-yellow-200"><Coins className="h-5 w-5" /> {save.coins}</span>
      </div>
      <h1 className="ar-glow mx-auto mt-4 max-w-6xl text-5xl font-black italic">Garage</h1>
      {notice && <p className="mx-auto mt-3 max-w-6xl rounded-2xl border border-red-400/30 bg-red-500/15 p-3 font-bold text-red-100">{notice}</p>}
      <div className="mx-auto mt-4 grid max-w-6xl gap-4 lg:grid-cols-[1fr_1.1fr]">
        <section className="grid content-start gap-2">
          {BODIES.map((b) => {
            const own = save.owned.includes(b.id), active = save.body === b.id;
            return (
              <button key={b.id} onClick={() => setSel(b.id)} className={"ar-btn flex items-center justify-between rounded-2xl border p-4 text-left " + (sel === b.id ? "border-yellow-300 bg-yellow-300/10" : "border-white/10 bg-black/30")}>
                <span><b className="text-xl font-black italic">{b.name}</b><span className="block text-sm font-bold text-slate-300">{b.blurb}</span></span>
                {active ? <span className="rounded-xl bg-emerald-400 px-3 py-1 text-xs font-black text-slate-950">DRIVING</span> : own ? <span className="text-xs font-black text-slate-300">OWNED</span> : <span className="flex items-center gap-1 text-sm font-black text-yellow-200"><Lock className="h-4 w-4" /> {b.price}</span>}
              </button>
            );
          })}
        </section>
        <section className="rounded-3xl border border-white/10 bg-black/35 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black italic">{body.name}</h2>
            {owned ? (save.body === body.id ? <span className="flex items-center gap-1 text-sm font-black text-emerald-300"><Check className="h-4 w-4" /> Selected</span> :
              <button onClick={() => act((p) => p.customize({ body: body.id }))} className="ar-btn rounded-xl bg-emerald-400 px-4 py-2 font-black text-slate-950">Drive this kart</button>) :
              <button disabled={save.coins < body.price} onClick={() => buyBody(body)} className="ar-btn rounded-xl bg-yellow-300 px-4 py-2 font-black text-slate-950 disabled:opacity-40">Buy · {body.price} coins</button>}
          </div>
          <div className="mt-4 grid gap-2">
            <StatBar label="Speed" value={body.base.speed} bonus={owned ? bonus.speed : 0} />
            <StatBar label="Accel" value={body.base.accel} bonus={owned ? bonus.accel : 0} />
            <StatBar label="Handling" value={body.base.handling} bonus={owned ? bonus.handling : 0} />
            <StatBar label="Weight" value={body.base.weight} bonus={0} />
          </div>
          {owned && (
            <div className="mt-5 grid gap-2">
              <h3 className="text-xs font-black uppercase tracking-[.25em] text-slate-400">Upgrades</h3>
              {UPGRADES.map((u) => {
                const lvl = up[u.id], max = lvl >= MAX_UPGRADE, cost = UPGRADE_COST[lvl];
                return (
                  <div key={u.id} className="flex items-center justify-between rounded-2xl bg-white/5 p-3">
                    <span><b className="font-black">{u.name}</b> <span className="text-xs font-bold text-slate-400">{u.blurb}</span>
                      <span className="mt-1 flex gap-1">{Array.from({ length: MAX_UPGRADE }).map((_, i) => <i key={i} className={"h-2 w-6 rounded-full " + (i < lvl ? "bg-yellow-300" : "bg-white/15")} />)}</span>
                    </span>
                    {max ? <span className="text-xs font-black text-emerald-300">MAXED</span> :
                      <button disabled={save.coins < cost} onClick={() => buyUp(u.id)} className="ar-btn flex items-center gap-1 rounded-xl bg-yellow-300 px-3 py-2 text-sm font-black text-slate-950 disabled:opacity-40"><Coins className="h-4 w-4" /> {cost}</button>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-5">
            <h3 className="text-xs font-black uppercase tracking-[.25em] text-slate-400">Paint</h3>
            <div className="mt-2 flex flex-wrap gap-2">{PAINTS.map((c) => <button key={c} onClick={() => act((p) => p.customize({ paint: c }))} className={"h-10 w-10 rounded-xl border-2 " + (save.paint === c ? "border-white" : "border-transparent")} style={{ background: hex(c) }} />)}</div>
            <h3 className="mt-4 text-xs font-black uppercase tracking-[.25em] text-slate-400">Helmet</h3>
            <div className="mt-2 flex flex-wrap gap-2">{PAINTS.map((c) => <button key={c} onClick={() => act((p) => p.customize({ helmet: c }))} className={"h-8 w-8 rounded-full border-2 " + (save.helmet === c ? "border-white" : "border-transparent")} style={{ background: hex(c) }} />)}</div>
            <h3 className="mt-4 text-xs font-black uppercase tracking-[.25em] text-slate-400">Driver</h3>
            <div className="mt-2 flex gap-2">{[0xf1c7a4, 0xe0ac86, 0xc68a5f, 0x9c6a43, 0x6e4a32].map((c, i) => <button key={c} onClick={() => act((p) => p.customize({ driver: i }))} className={"h-8 w-8 rounded-full border-2 " + (save.driver === i ? "border-white" : "border-transparent")} style={{ background: hex(c) }} />)}</div>
          </div>
        </section>
      </div>
    </main>
  );
}

// ===========================================================================
// Track select
// ===========================================================================

function TrackSelect({ save, mode, onBack, onPick }: { save: SaveData; mode: Mode; onBack: () => void; onPick: (id: string) => void }) {
  return (
    <main className="ar-bg min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8">
      <button onClick={onBack} className="ar-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black"><ArrowLeft className="h-5 w-5" /> Back</button>
      <h1 className="ar-glow mx-auto mt-4 max-w-6xl text-5xl font-black italic">{mode === "tt" ? "Time Trial" : "Quick Race"} — pick a track</h1>
      <div className="mx-auto mt-5 grid max-w-6xl gap-4 sm:grid-cols-2">
        {TRACKS.map((t) => (
          <button key={t.id} onClick={() => onPick(t.id)} className="ar-btn overflow-hidden rounded-3xl border border-white/10 text-left shadow-2xl">
            <div className="relative h-36 p-5" style={{ background: THEME_STYLE[t.theme] }}>
              <TrackShape id={t.id} />
              <h2 className="ar-glow relative text-3xl font-black italic">{t.name}</h2>
            </div>
            <div className="bg-black/50 p-4">
              <p className="text-sm font-bold text-slate-200">{t.blurb}</p>
              <p className="mt-2 text-xs font-black uppercase tracking-wider text-slate-400">{t.laps} laps · Best {fmt((save.bestRace[t.id] || 0) / 1000)} · Lap record {fmt((save.bestLap[t.id] || 0) / 1000)}</p>
            </div>
          </button>
        ))}
      </div>
    </main>
  );
}

function TrackShape({ id }: { id: string }) {
  const t = TRACKS.find((x) => x.id === id)!;
  const xs = t.points.map((p) => p[0]), zs = t.points.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const sc = Math.min(150 / (maxX - minX), 110 / (maxZ - minZ));
  const pts = t.points.map((p) => `${170 + (p[0] - minX) * sc},${10 + (p[1] - minZ) * sc}`).join(" ");
  return <svg viewBox="0 0 340 130" className="absolute inset-0 h-full w-full opacity-60"><polygon points={pts} fill="none" stroke="white" strokeWidth="7" strokeLinejoin="round" /></svg>;
}

// ===========================================================================
// Race view + HUD
// ===========================================================================

function RaceView({ trackId, mode, cc, racers, settings, onSettings, gp, onFinish, onRetry, onNext, onQuit, online }: {
  trackId: string; mode: Mode; cc: number; racers: RacerInfo[]; settings: Settings; onSettings: (s: Settings) => void;
  gp: { index: number; points: Record<string, number>; last: RaceResult | null } | null; onFinish: (r: RaceResult) => void;
  onRetry: () => void; onNext?: () => void; onQuit: () => void;
  online?: { net: RacingNet; myId: string; startAt: number; laps: number };
}) {
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLCanvasElement>(null);
  const [race, setRace] = useState<Race | null>(null);
  const [fatal, setFatal] = useState("");
  const [paused, setPaused] = useState(false);
  const touch = useMemo(isTouch, []);
  const finishRef = useRef(onFinish); finishRef.current = onFinish;

  useEffect(() => {
    const el = host.current; if (!el) return;
    let r: Race | null = null, cancelled = false;
    import("@/game/racing/race").then(({ Race }) => {
      if (cancelled) return;
      try {
        r = new Race(el, { trackId, mode, cc, racers, quality: settings.quality, sfx: settings.sfx, music: settings.music, touch, autoGas: settings.autoGas, onFinish: (res) => finishRef.current(res), online });
        setRace(r);
      } catch (e) { console.error(e); setFatal("Your browser could not start 3D graphics. Try updating Chrome or turning on hardware acceleration."); }
    }).catch(() => setFatal("Could not load the race. Check your connection and try again."));
    return () => { cancelled = true; r?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { race?.bindMinimap(mapRef.current); }, [race]);
  useEffect(() => { race?.setVolumes(paused ? 0 : settings.sfx, paused ? 0 : settings.music); race?.setPaused(paused); }, [race, settings.sfx, settings.music, paused]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === "Escape" || e.code === "KeyP") setPaused((p) => !p); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const empty = useRef<RaceHud | null>(null);
  const hud = useSyncExternalStore(race ? race.subscribe : noop, race ? race.getHud : () => empty.current as unknown as RaceHud);
  const ready = !!race && !!hud;

  return (
    <main className="fixed inset-0 select-none overflow-hidden bg-black text-white" onPointerDown={() => race?.unlockAudio()}>
      <div ref={host} className="absolute inset-0" />
      {!ready && !fatal && <div className="ar-bg absolute inset-0 grid place-items-center"><div className="text-center"><Loader2 className="mx-auto h-10 w-10 animate-spin text-pink-300" /><p className="mt-3 text-lg font-black italic">Building the track…</p></div></div>}
      {fatal && <div className="ar-bg absolute inset-0 grid place-items-center p-6"><div className="max-w-md rounded-3xl bg-black/50 p-6 text-center font-black">{fatal}<button onClick={onQuit} className="mt-4 block w-full rounded-2xl bg-white/15 py-3">Back</button></div></div>}
      {ready && (
        <>
          {hud.boosting && <div className="ar-boost pointer-events-none absolute inset-0" />}
          {/* top-left: position & lap */}
          <div className="pointer-events-none absolute left-3 top-3 flex items-start gap-3">
            {mode !== "tt" && <div className="ar-glow text-6xl font-black italic leading-none sm:text-7xl" style={{ color: hud.position === 1 ? "#fde047" : hud.position <= 3 ? "#fff" : "#cbd5e1" }}>{hud.position}<span className="text-2xl sm:text-3xl">{ordinal(hud.position).slice(-2)}</span></div>}
            <div className="ar-skew rounded-xl border-2 border-white/25 bg-black/55 px-3 py-1"><div className="ar-unskew"><div className="text-[10px] font-black uppercase tracking-widest text-pink-300">Lap</div><div className="text-2xl font-black italic">{hud.lap}<span className="text-sm text-white/60">/{hud.laps}</span></div></div></div>
          </div>
          {/* top-centre: time */}
          <div className="pointer-events-none absolute left-3 top-[84px] rounded-xl border-2 border-white/25 bg-black/55 px-3 py-1 text-center sm:left-1/2 sm:top-3 sm:-translate-x-1/2 sm:px-4">
            <div className="text-[10px] font-black uppercase tracking-widest text-sky-300">Time</div>
            <div className="text-xl font-black tabular-nums">{fmt(hud.time)}</div>
          </div>
          {/* top-right: item & coins */}
          <div className="absolute right-3 top-3 flex items-start gap-2">
            <div className="flex flex-col items-end gap-2">
              <div className="grid h-20 w-20 place-items-center overflow-hidden rounded-2xl border-4 border-white/70 bg-gradient-to-br from-fuchsia-500/50 to-sky-500/50 text-4xl shadow-xl">
                {hud.rolling ? <span key={hud.rollIcon} className="ar-roll">{hud.rollIcon}</span> : hud.item ? <span>{ITEM_ICONS[hud.item]}{hud.itemCount > 1 && <sub className="text-base font-black">×{hud.itemCount}</sub>}</span> : <span className="text-base font-black text-white/50">—</span>}
              </div>
              <span className="flex items-center gap-1 rounded-xl bg-black/55 px-2 py-1 text-sm font-black text-yellow-200"><Coins className="h-4 w-4" /> {hud.coins}</span>
            </div>
            <button onClick={() => setPaused(true)} className="rounded-xl border border-white/20 bg-black/55 px-3 py-2 text-xs font-black uppercase"><Pause className="mr-1 inline h-4 w-4" />Menu</button>
          </div>
          {/* left: standings */}
          {mode !== "tt" && !touch && (
            <div className="pointer-events-none absolute left-3 top-24 hidden flex-col gap-0.5 sm:flex">
              {hud.standings.map((s, i) => (
                <div key={s.id} className={"flex w-36 items-center gap-2 rounded-lg px-2 py-0.5 text-xs font-black " + (s.isPlayer ? "bg-white/30" : "bg-black/40")}>
                  <span className="w-4 text-right text-white/70">{i + 1}</span><i className="h-2.5 w-2.5 rounded-full" style={{ background: hex(s.color) }} /><span className="truncate">{s.name}</span>{s.finished && <Flag className="ml-auto h-3 w-3" />}
                </div>
              ))}
            </div>
          )}
          {/* bottom-left: minimap */}
          <canvas ref={mapRef} width={200} height={170} className={"pointer-events-none absolute left-3 rounded-2xl bg-black/35 " + (touch ? "top-[140px] h-[110px] w-[130px] sm:top-[100px]" : "bottom-3 h-[120px] w-[140px] sm:h-[170px] sm:w-[200px]")} />
          {/* bottom-right: speed */}
          {!touch && (
            <div className="pointer-events-none absolute bottom-3 right-3 text-right">
              <div className="ar-glow text-5xl font-black italic tabular-nums">{hud.kmh}<span className="ml-1 text-base not-italic text-white/70">km/h</span></div>
              {hud.driftLevel > 0 && <div className="text-sm font-black uppercase" style={{ color: ["", "#38bdf8", "#fb923c", "#d946ef"][hud.driftLevel] }}>Drift {"★".repeat(hud.driftLevel)}</div>}
            </div>
          )}
          {/* countdown & toasts */}
          {hud.phase === "intro" && (
            <div className="absolute inset-x-0 bottom-[18%] text-center">
              <p className="ar-glow text-4xl font-black italic">{TRACKS.find((t) => t.id === trackId)?.name}</p>
              {gp && <p className="font-black text-yellow-200">Grand Prix · Race {gp.index + 1} of {TRACKS.length}</p>}
              {online ? <p className="mt-2 text-sm font-black text-white/80">Online race · {racers.length} racers</p> : <button onClick={() => race!.skipIntro()} className="mt-3 rounded-xl bg-white/20 px-4 py-2 text-sm font-black backdrop-blur">Skip ▸</button>}
            </div>
          )}
          {hud.phase === "countdown" && <div className="pointer-events-none absolute inset-0 grid place-items-center"><p key={hud.countdown} className="ar-pop ar-glow text-[10rem] font-black italic text-yellow-300">{hud.countdown}</p></div>}
          {hud.toast && <div key={hud.toast.id} className="ar-toast ar-glow pointer-events-none absolute inset-x-0 top-[28%] text-center text-5xl font-black italic text-yellow-300 sm:text-6xl">{hud.toast.text}</div>}
          {hud.wrongWay && <div className="pointer-events-none absolute inset-x-0 top-[40%] text-center"><span className="rounded-2xl bg-red-600/85 px-6 py-3 text-3xl font-black italic">WRONG WAY!</span></div>}
          {touch && hud.phase !== "finished" && <TouchPad race={race!} autoGas={settings.autoGas} />}
          {touch && <RotateHint />}
          {hud.result && <Results result={hud.result} mode={mode} gp={gp} onRetry={onRetry} onNext={onNext} onQuit={onQuit} />}
          {paused && !hud.result && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[1.75rem] border border-white/15 bg-slate-950/95 p-5">
                <h2 className="text-3xl font-black italic">Paused</h2>
                <SettingsFields settings={settings} onChange={onSettings} note={`Graphics changes apply next race (running: ${hud.quality})`} />
                <div className="mt-5 grid gap-2">
                  <button onClick={() => setPaused(false)} className="ar-btn rounded-2xl bg-sky-400 py-3 font-black text-slate-950"><Play className="mr-1 inline h-4 w-4" /> Resume</button>
                  {!online && <button onClick={onRetry} className="ar-btn rounded-2xl border border-white/15 bg-white/10 py-3 font-black"><RotateCcw className="mr-1 inline h-4 w-4" /> Restart race</button>}
                  <button onClick={onQuit} className="ar-btn rounded-2xl bg-red-500 py-3 font-black"><X className="mr-1 inline h-4 w-4" /> {online ? "Leave room" : "Quit to menu"}</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

const ITEM_ICONS: Record<string, string> = { turbo: "🚀", triple: "🚀", slick: "🫧", bomb: "💣", orb: "🔮", shield: "🛡️", rush: "🌈" };
const noop = () => () => {};

function TouchPad({ race, autoGas }: { race: Race; autoGas: boolean }) {
  const btn = "grid place-items-center rounded-full border-2 border-white/45 bg-black/40 font-black backdrop-blur active:scale-95 touch-none select-none";
  const hold = (patch: (v: boolean) => Parameters<Race["touchControls"]>[0]) => ({
    onPointerDown: (e: React.PointerEvent) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); race.touchControls(patch(true)); },
    onPointerUp: () => race.touchControls(patch(false)),
    onPointerCancel: () => race.touchControls(patch(false)),
  });
  return (
    <>
      <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-3 flex gap-2 sm:left-4 sm:gap-3">
        <button {...hold((v) => ({ steer: v ? -1 : 0 }))} className={btn + " h-20 w-20 text-3xl sm:h-24 sm:w-24 sm:text-4xl"}>◀</button>
        <button {...hold((v) => ({ steer: v ? 1 : 0 }))} className={btn + " h-20 w-20 text-3xl sm:h-24 sm:w-24 sm:text-4xl"}>▶</button>
      </div>
      <div className="absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-3 flex flex-col items-end gap-2 sm:right-4 sm:flex-row sm:items-end sm:gap-3">
        <div className="flex gap-2 sm:gap-3">
          {!autoGas && <button {...hold((v) => ({ gas: v }))} className={btn + " h-14 w-14 bg-emerald-500/60 text-xs"}>GAS</button>}
          <button {...hold((v) => ({ brake: v }))} className={btn + " h-14 w-14 text-xs"}>BRAKE</button>
          <button onPointerDown={() => race.useItem()} className={btn + " h-14 w-14 bg-fuchsia-500/60 text-xs sm:h-16 sm:w-16"}>ITEM</button>
        </div>
        <button {...hold((v) => ({ drift: v }))} className={btn + " h-20 w-20 bg-orange-500/70 text-base sm:h-24 sm:w-24"}>DRIFT</button>
      </div>
    </>
  );
}

function Results({ result, mode, gp, onRetry, onNext, onQuit }: { result: RaceResult; mode: Mode; gp: { index: number } | null; onRetry: () => void; onNext?: () => void; onQuit: () => void }) {
  const lastGp = gp && gp.index + 1 >= TRACKS.length;
  return (
    <div className="absolute inset-0 grid place-items-center overflow-y-auto bg-black/55 p-3 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[1.75rem] border border-white/15 bg-slate-950/95 p-5 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[.3em] text-slate-400">{mode === "tt" ? "Time trial" : "Race finished"}</p>
        <h2 className="ar-glow text-6xl font-black italic" style={{ color: result.place === 1 ? "#fde047" : result.place <= 3 ? "#e2e8f0" : "#fff" }}>{mode === "tt" ? fmt(result.time) : ordinal(result.place) + " place!"}</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-white/5 py-2"><div className="text-lg font-black tabular-nums">{fmt(result.time)}</div><div className="text-[10px] font-black uppercase text-slate-400">Total</div></div>
          <div className="rounded-2xl bg-white/5 py-2"><div className="text-lg font-black tabular-nums">{fmt(result.bestLap)}</div><div className="text-[10px] font-black uppercase text-slate-400">Best lap</div></div>
          <div className="rounded-2xl bg-yellow-400/15 py-2 text-yellow-200"><div className="text-lg font-black">+{result.coins}</div><div className="text-[10px] font-black uppercase">Coins</div></div>
        </div>
        {mode !== "tt" && (
          <div className="mt-3 max-h-56 overflow-y-auto rounded-2xl border border-white/10">
            {result.standings.map((s, i) => (
              <div key={s.id} className={"flex items-center gap-2 px-3 py-1.5 text-sm font-black " + (s.isPlayer ? "bg-white/15" : i % 2 ? "bg-white/[.03]" : "")}>
                <span className="w-6 text-white/60">{i + 1}</span><i className="h-3 w-3 rounded-full" style={{ background: hex(s.color) }} /><span className="flex-1">{s.name}</span>
                {gp && <span className="text-yellow-200">+{POINTS[i]} pts</span>}<span className="w-20 text-right tabular-nums text-slate-300">{fmt(s.time)}</span>
              </div>
            ))}
          </div>
        )}
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {mode === "online" ? <p className="flex items-center justify-center gap-2 rounded-2xl bg-white/5 py-3 text-sm font-black text-slate-300 sm:col-span-2"><Loader2 className="h-4 w-4 animate-spin" /> Back to the lobby in a few seconds…</p> : onNext ? <button onClick={onNext} className="ar-btn rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-400 py-3 font-black text-slate-950 sm:col-span-3">{lastGp ? "See cup results" : "Next race ▸"}</button> : <button onClick={onRetry} className="ar-btn rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-400 py-3 font-black text-slate-950"><RotateCcw className="mr-1 inline h-4 w-4" /> Race again</button>}
          {mode === "online" ? <button onClick={onQuit} className="ar-btn rounded-2xl border border-white/15 bg-white/10 py-3 font-black">Leave room</button> : !onNext && <button onClick={onQuit} className="ar-btn rounded-2xl border border-white/15 bg-white/10 py-3 font-black sm:col-span-2">Menu</button>}
          {onNext && <button onClick={onQuit} className="ar-btn rounded-2xl border border-white/15 bg-white/5 py-2 text-sm font-black sm:col-span-3">Quit Grand Prix</button>}
        </div>
      </div>
    </div>
  );
}

function GpStandings({ gp, racers, cc, onDone }: { gp: { points: Record<string, number> }; racers: RacerInfo[]; cc: number; onDone: (place: number) => void }) {
  const rows = racers.map((r) => ({ r, pts: gp.points[r.id] || 0 })).sort((a, b) => b.pts - a.pts);
  const place = rows.findIndex((x) => x.r.isPlayer) + 1;
  const trophy = place === 1 ? "🏆 Gold" : place === 2 ? "🥈 Silver" : place === 3 ? "🥉 Bronze" : "";
  return (
    <main className="ar-bg grid min-h-[100dvh] place-items-center p-4 text-white">
      <div className="w-full max-w-lg rounded-[2rem] border border-white/15 bg-black/50 p-6 text-center shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[.3em] text-pink-300">Aurora Cup · {cc}cc</p>
        <h1 className="ar-glow mt-2 text-5xl font-black italic">{trophy ? trophy + " Cup!" : ordinal(place) + " overall"}</h1>
        <p className="mt-1 font-black text-yellow-200">+{place === 1 ? 300 : place === 2 ? 200 : place === 3 ? 120 : 40} bonus coins</p>
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 text-left">
          {rows.map(({ r, pts }, i) => (
            <div key={r.id} className={"flex items-center gap-2 px-4 py-2 font-black " + (r.isPlayer ? "bg-white/15" : "")}><span className="w-6 text-white/60">{i + 1}</span><i className="h-3 w-3 rounded-full" style={{ background: hex(r.look.paint) }} /><span className="flex-1">{r.name}</span><span>{pts} pts</span></div>
          ))}
        </div>
        <button onClick={() => onDone(place)} className="ar-btn mt-5 w-full rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-400 py-3 font-black text-slate-950">Collect & continue</button>
      </div>
    </main>
  );
}

function SettingsFields({ settings, onChange, note }: { settings: Settings; onChange: (s: Settings) => void; note?: string }) {
  return (
    <div className="mt-4 grid gap-4 text-sm font-bold">
      <label className="grid gap-1"><span className="flex justify-between"><span>Sound effects</span><span>{Math.round(settings.sfx * 100)}%</span></span><input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={(e) => onChange({ ...settings, sfx: Number(e.target.value) })} className="accent-pink-400" /></label>
      <label className="grid gap-1"><span className="flex justify-between"><span>Music</span><span>{Math.round(settings.music * 100)}%</span></span><input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={(e) => onChange({ ...settings, music: Number(e.target.value) })} className="accent-pink-400" /></label>
      <div className="grid gap-1"><span>Graphics</span>
        <div className="grid grid-cols-4 gap-1 rounded-xl bg-black/40 p-1">{(["auto", "low", "medium", "high"] as Settings["quality"][]).map((q) => <button key={q} onClick={() => onChange({ ...settings, quality: q })} className={"rounded-lg py-2 text-xs font-black uppercase " + (settings.quality === q ? "bg-pink-400 text-slate-950" : "text-slate-300")}>{q}</button>)}</div>
        {note && <span className="text-xs text-slate-400">{note}</span>}
      </div>
      <label className="flex items-center justify-between"><span>Auto-accelerate on touch screens</span><input type="checkbox" checked={settings.autoGas} onChange={(e) => onChange({ ...settings, autoGas: e.target.checked })} className="h-5 w-5 accent-pink-400" /></label>
    </div>
  );
}

function SettingsPanel({ settings, onChange, onClose }: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 text-white backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-[1.75rem] border border-white/15 bg-slate-950/95 p-5">
        <div className="flex items-center justify-between"><h2 className="text-3xl font-black italic">Settings</h2><button onClick={onClose} className="rounded-xl bg-white/10 p-2"><X className="h-5 w-5" /></button></div>
        <SettingsFields settings={settings} onChange={onChange} />
        <button onClick={onClose} className="ar-btn mt-5 w-full rounded-2xl bg-pink-400 py-3 font-black text-slate-950">Done</button>
      </div>
    </div>
  );
}

// ===========================================================================
// Online
// ===========================================================================

type OpenRoom = { code: string; host: string; humans: number; phase: string; trackId: string };

function OnlineMenu({ token, notice, onBack, onEnter }: { token: string; notice: string; onBack: () => void; onEnter: (k: "quick" | "create" | "private" | "join", code?: string) => Promise<void> }) {
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let stop = false;
    const load = async () => { try { const r = await fetch(API_BASE + "/api/racing/rooms", { headers: { Authorization: "Bearer " + token } }); if (r.ok && !stop) setRooms(await r.json()); } catch { /* ignore */ } };
    void load(); const t = window.setInterval(load, 3000);
    return () => { stop = true; window.clearInterval(t); };
  }, [token]);
  const go = async (k: "quick" | "create" | "private" | "join", c?: string) => { if (busy) return; setBusy(true); await onEnter(k, c); setBusy(false); };
  return (
    <main className="ar-bg min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8">
      <button onClick={onBack} className="ar-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black"><ArrowLeft className="h-5 w-5" /> Back</button>
      <section className="mx-auto mt-5 max-w-4xl rounded-[2rem] border border-white/10 bg-black/35 p-6 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[.3em] text-fuchsia-300">Online</p>
        <h1 className="ar-glow text-5xl font-black italic">Race your classmates</h1>
        <p className="mt-2 font-bold text-slate-300">Up to 8 racers. Bots fill empty spots so the grid is always full. Online races pay 25% more coins.</p>
        <button disabled={busy} onClick={() => go("quick")} className="ar-btn mt-5 flex min-h-[80px] w-full items-center justify-center gap-3 rounded-3xl bg-gradient-to-r from-yellow-300 to-orange-400 text-2xl font-black italic uppercase text-slate-950 disabled:opacity-60" style={{ boxShadow: "0 8px 0 #b45309" }}>
          {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : <Play className="h-7 w-7 fill-current" />} Quick match
        </button>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button disabled={busy} onClick={() => go("create")} className="ar-btn min-h-12 rounded-2xl border border-white/15 bg-white/10 font-black">Create open room</button>
          <button disabled={busy} onClick={() => go("private")} className="ar-btn min-h-12 rounded-2xl border border-white/15 bg-white/10 font-black">Create private room</button>
        </div>
        <div className="mt-3 flex gap-2">
          <input inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit room code" className="min-h-12 min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 font-black tracking-widest outline-none placeholder:font-bold placeholder:tracking-normal placeholder:text-slate-500 focus:border-fuchsia-300" />
          <button disabled={busy || code.length !== 6} onClick={() => go("join", code)} className="ar-btn rounded-2xl bg-fuchsia-400 px-5 font-black text-slate-950 disabled:opacity-40">Join</button>
        </div>
        {notice && <p className="mt-4 rounded-2xl border border-red-400/30 bg-red-500/15 p-3 font-bold text-red-100">{notice}</p>}
        {rooms.length > 0 && (
          <div className="mt-5 grid gap-2">
            <h3 className="text-xs font-black uppercase tracking-[.25em] text-slate-400">Open rooms</h3>
            {rooms.map((r) => (
              <button key={r.code} disabled={busy} onClick={() => go("join", r.code)} className="ar-btn flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4 text-left">
                <span><b>{r.host}'s room</b><small className="block font-bold text-slate-400">{r.humans} racer{r.humans === 1 ? "" : "s"} · {TRACKS.find((t) => t.id === r.trackId)?.name} · {r.phase === "lobby" ? "in lobby" : r.phase === "results" ? "finishing up" : "racing now"}</small></span>
                <span className="rounded-xl bg-fuchsia-400 px-3 py-1 text-sm font-black text-slate-950">JOIN</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function OnlineRoom({ session, myId, token, settings, onSettings, onLeave, onRaceDone }: { session: OnlineSession; myId: string; token: string; settings: Settings; onSettings: (s: Settings) => void; onLeave: () => void; onRaceDone: () => void }) {
  const [state, setState] = useState<{ meta: RaceRoomMeta | null; phase: RacePhase; startAt: number }>({ meta: null, phase: "lobby", startAt: 0 });
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [raceSetup, setRaceSetup] = useState<{ raceNo: number; meta: RaceRoomMeta; startAt: number } | null>(null);
  const metaRef = useRef<RaceRoomMeta | null>(null);

  useEffect(() => session.net.listen((s) => {
    if (s.meta) metaRef.current = s.meta;
    const meta = metaRef.current;
    setState({ meta, phase: s.phase, startAt: s.startAt });
    // freeze the line-up when a race begins
    if (meta && (s.phase === "countdown" || s.phase === "racing")) setRaceSetup((cur) => cur && cur.raceNo === meta.raceNo ? cur : { raceNo: meta.raceNo, meta, startAt: s.startAt });
    if (s.phase === "lobby") setRaceSetup((cur) => { if (cur) onRaceDone(); return null; });
  }), [session, onRaceDone]);

  const action = async (body: Record<string, unknown>) => {
    setError("");
    try {
      const r = await fetch(API_BASE + "/api/racing/rooms/" + session.code + "/action", { method: "POST", headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "That didn't work.");
      session.net.ingest(data as RaceSnap);
    } catch (e) { setError(e instanceof Error ? e.message : "That didn't work."); }
  };

  const meta = state.meta;
  if (raceSetup) {
    const m = raceSetup.meta;
    const host = m.hostId === myId;
    const ccMul = CC.find((c) => c.id === m.cc)?.mul || 1;
    const racers: RacerInfo[] = m.players.map((p) => {
      const b = BODIES.find((x) => x.id === p.look.body) || BODIES[0];
      const isPlayer = p.id === myId;
      return {
        id: p.id, name: p.name + (p.bot ? " (CPU)" : ""), isPlayer, body: b, upgrades: p.upgrades,
        look: { ...p.look, name: p.name }, remote: !isPlayer && !(p.bot && host), localBot: p.bot && host,
        skill: m.cc === 150 ? 0.96 : m.cc === 100 ? 0.93 : 0.88,
      };
    });
    // the player must be first in the list for the race engine
    const ordered = racers;
    return (
      <RaceView key={"online-" + raceSetup.raceNo} trackId={m.trackId} mode="online" cc={ccMul} racers={ordered} settings={settings} onSettings={onSettings}
        gp={null} onFinish={() => {}} onRetry={() => {}} onQuit={onLeave}
        online={{ net: session.net, myId, startAt: raceSetup.startAt, laps: m.laps }} />
    );
  }

  if (!meta) return <main className="ar-bg grid min-h-[100dvh] place-items-center text-white"><Loader2 className="h-10 w-10 animate-spin" /></main>;
  const host = meta.hostId === myId;
  const copy = async () => { try { await navigator.clipboard.writeText(meta.code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  return (
    <main className="ar-bg min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto flex max-w-5xl items-center justify-between">
        <button onClick={onLeave} className="ar-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black"><ArrowLeft className="h-5 w-5" /> Leave room</button>
        <button onClick={copy} className="ar-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black"><Copy className="h-4 w-4" /> Code <span className="tracking-[.25em] text-fuchsia-300">{meta.code}</span>{copied && <span className="text-xs text-emerald-300">copied!</span>}</button>
      </div>
      <section className="mx-auto mt-5 grid max-w-5xl gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-[2rem] border border-white/10 bg-black/35 p-5">
          <p className="text-xs font-black uppercase tracking-[.3em] text-fuchsia-300">{meta.publicRoom ? "Open room" : "Private room"} · {state.phase === "results" ? "race finishing" : state.phase === "lobby" ? "lobby" : "starting"}</p>
          <h1 className="ar-glow mt-1 text-4xl font-black italic">Racers</h1>
          <div className="mt-4 grid gap-2">
            {meta.players.map((p) => (
              <div key={p.id} className={"flex items-center justify-between rounded-2xl px-4 py-3 " + (p.id === myId ? "bg-white/15" : "bg-white/5")}>
                <span className="flex items-center gap-2 font-black"><i className="h-3 w-3 rounded-full" style={{ background: hex(p.look.paint) }} />{p.id === meta.hostId && <Crown className="h-4 w-4 text-yellow-300" />}{p.name}{p.id === myId && <span className="rounded-md bg-white/15 px-1.5 text-[10px]">YOU</span>}</span>
                <small className="font-bold text-slate-400">{p.bot ? "Computer" : !p.connected ? "reconnecting…" : (BODIES.find((b) => b.id === p.look.body)?.name || "")}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[2rem] border border-white/10 bg-black/35 p-5">
          <h2 className="text-2xl font-black italic">Race settings</h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {TRACK_IDS.map((id) => {
              const t = TRACKS.find((x) => x.id === id)!;
              return (
                <button key={id} disabled={!host} onClick={() => action({ type: "settings", trackId: id })} className={"relative h-20 overflow-hidden rounded-2xl border-2 p-2 text-left font-black " + (meta.trackId === id ? "border-yellow-300" : "border-transparent opacity-80")} style={{ background: THEME_STYLE[t.theme] }}>
                  <TrackShape id={id} /><span className="ar-glow relative text-sm">{t.name}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {CC.map((c) => <button key={c.id} disabled={!host} onClick={() => action({ type: "settings", cc: c.id })} className={"rounded-xl px-3 py-2 text-sm font-black " + (meta.cc === c.id ? "bg-white text-slate-950" : "bg-white/10")}>{c.label}</button>)}
            {[1, 2, 3, 5].map((n) => <button key={n} disabled={!host} onClick={() => action({ type: "settings", laps: n })} className={"rounded-xl px-3 py-2 text-sm font-black " + (meta.laps === n ? "bg-white text-slate-950" : "bg-white/10")}>{n} lap{n > 1 ? "s" : ""}</button>)}
          </div>
          <label className="mt-3 flex items-center justify-between rounded-2xl bg-white/5 p-3 font-black">
            <span className="flex items-center gap-2"><Users className="h-4 w-4" /> Fill empty spots with bots</span>
            <input type="checkbox" disabled={!host} checked={meta.bots} onChange={(e) => action({ type: "settings", bots: e.target.checked })} className="h-5 w-5 accent-fuchsia-400" />
          </label>
          {host ? (
            <button disabled={state.phase !== "lobby" && state.phase !== "results"} onClick={() => action({ type: "start" })} className="ar-btn mt-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-400 text-xl font-black italic uppercase text-slate-950 disabled:opacity-50" style={{ boxShadow: "0 6px 0 #b45309" }}><Flag className="h-5 w-5" /> Start race</button>
          ) : <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-white/5 py-4 font-black text-slate-300"><Loader2 className="h-4 w-4 animate-spin" /> Waiting for the host to start…</p>}
          {!host && <p className="mt-2 text-center text-xs font-bold text-slate-400">Only the host (👑) can change the track and settings.</p>}
          {error && <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/15 p-3 text-sm font-bold text-red-100">{error}</p>}
        </div>
      </section>
    </main>
  );
}

function RotateHint() {
  const [portrait, setPortrait] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const check = () => setPortrait(window.innerHeight > window.innerWidth * 1.1);
    check(); window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  if (!portrait || dismissed) return null;
  return (
    <div className="absolute inset-x-4 top-1/3 z-20 rounded-2xl border border-white/15 bg-black/80 p-4 text-center backdrop-blur">
      <p className="text-xl font-black italic">Turn your phone sideways 📱↻</p>
      <p className="mt-1 text-sm font-bold text-slate-300">Racing is much easier in landscape.</p>
      <button onClick={() => setDismissed(true)} className="mt-3 rounded-xl bg-white/15 px-4 py-2 text-sm font-black">Keep racing</button>
    </div>
  );
}
