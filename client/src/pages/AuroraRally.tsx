import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Check, Coins, Flag, Gauge, Loader2, Lock, Pause, Play, RotateCcw, Settings, Trophy, Wrench, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { TRACKS } from "@/game/racing/tracks";
import { BODIES, UPGRADES, UPGRADE_COST, MAX_UPGRADE, PAINTS, type BodyDef, type UpgradeId } from "@/game/racing/kart";
import { loadSave, writeSave, upgradesFor, type SaveData } from "@/game/racing/save";
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

type View = "menu" | "garage" | "tracks" | "race" | "gpStandings";

export default function AuroraRally() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const uid = user?.id ?? "guest";
  const [save, setSave] = useState<SaveData>(() => loadSave(uid));
  const [view, setView] = useState<View>("menu");
  const [mode, setMode] = useState<Mode>("race");
  const [cc, setCc] = useState(100);
  const [settings, setSettingsState] = useState<Settings>(loadSettings);
  const [showSettings, setShowSettings] = useState(false);
  const [race, setRace] = useState<{ key: number; trackId: string } | null>(null);
  const [gp, setGp] = useState<{ index: number; points: Record<string, number>; last: RaceResult | null } | null>(null);
  const playerName = String((user as { displayName?: string; username?: string } | null)?.displayName || (user as { username?: string } | null)?.username || "You").slice(0, 14);

  useEffect(() => { setSave(loadSave(uid)); }, [uid]);
  const update = useCallback((fn: (d: SaveData) => SaveData) => { setSave((d) => { const n = fn(d); writeSave(uid, n); return n; }); }, [uid]);
  const setSettings = (s: Settings) => { setSettingsState(s); try { localStorage.setItem(SET_KEY, JSON.stringify(s)); } catch { /* ignore */ } };

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
    update((d) => {
      const n = { ...d, coins: d.coins + res.coins, races: d.races + 1, wins: d.wins + (res.place === 1 ? 1 : 0), bestRace: { ...d.bestRace }, bestLap: { ...d.bestLap } };
      if (res.time && (!n.bestRace[res.trackId] || res.time * 1000 < n.bestRace[res.trackId])) n.bestRace[res.trackId] = Math.round(res.time * 1000);
      if (res.bestLap && (!n.bestLap[res.trackId] || res.bestLap * 1000 < n.bestLap[res.trackId])) n.bestLap[res.trackId] = Math.round(res.bestLap * 1000);
      return n;
    });
    setGp((g) => {
      if (!g) return g;
      const points = { ...g.points };
      res.standings.forEach((s, i) => { points[s.id] = (points[s.id] || 0) + POINTS[i]; });
      return { ...g, points, last: res };
    });
  }, [update]);

  const startGp = () => { setMode("gp"); setGp({ index: 0, points: {}, last: null }); startRace(TRACKS[0].id); };
  const nextGp = () => {
    if (!gp) return;
    if (gp.index + 1 >= TRACKS.length) { setView("gpStandings"); return; }
    setGp({ ...gp, index: gp.index + 1, last: null });
    startRace(TRACKS[gp.index + 1].id);
  };
  const finishGpCup = (place: number) => {
    const reward = place === 1 ? 300 : place === 2 ? 200 : place === 3 ? 120 : 40;
    update((d) => ({ ...d, coins: d.coins + reward, cups: { ...d.cups, ["aurora-" + cc]: Math.min(d.cups["aurora-" + cc] || 99, place) } }));
    setGp(null); setView("menu");
  };

  return (
    <div className="ar-font">
      <style>{CSS}</style>
      {view === "menu" && (
        <Menu save={save} cc={cc} setCc={setCc} onBack={() => navigate("/worlds")} onSettings={() => setShowSettings(true)}
          onGp={startGp} onRace={() => { setMode("race"); setView("tracks"); }} onTt={() => { setMode("tt"); setView("tracks"); }} onGarage={() => setView("garage")} />
      )}
      {view === "garage" && <Garage save={save} update={update} onBack={() => setView("menu")} />}
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
      {showSettings && <SettingsPanel settings={settings} onChange={setSettings} onClose={() => setShowSettings(false)} />}
    </div>
  );
}

// ===========================================================================
// Menu
// ===========================================================================

function Menu({ save, cc, setCc, onBack, onSettings, onGp, onRace, onTt, onGarage }: { save: SaveData; cc: number; setCc: (c: number) => void; onBack: () => void; onSettings: () => void; onGp: () => void; onRace: () => void; onTt: () => void; onGarage: () => void }) {
  const cup = save.cups["aurora-" + cc];
  return (
    <main className="ar-bg min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2">
        <button onClick={onBack} className="ar-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black backdrop-blur"><ArrowLeft className="h-5 w-5" /> Worlds</button>
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
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <BigButton onClick={onGp} color="from-yellow-300 to-orange-500" shadow="#b45309" icon={<Trophy className="h-7 w-7" />} title="Grand Prix" sub={cup ? `Best: ${ordinal(cup)} place` : "4 races · win the Aurora Cup"} />
          <BigButton onClick={onRace} color="from-pink-400 to-fuchsia-600" shadow="#86198f" icon={<Flag className="h-7 w-7" />} title="Quick Race" sub="Pick any track" />
          <BigButton onClick={onTt} color="from-sky-400 to-blue-600" shadow="#1e3a8a" icon={<Gauge className="h-7 w-7" />} title="Time Trial" sub="Beat your best time" />
          <BigButton onClick={onGarage} color="from-emerald-400 to-teal-600" shadow="#115e59" icon={<Wrench className="h-7 w-7" />} title="Garage" sub="Karts, paint & upgrades" />
        </div>
        <div className="mt-6 grid grid-cols-3 gap-2 text-center sm:max-w-md">
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

function Garage({ save, update, onBack }: { save: SaveData; update: (fn: (d: SaveData) => SaveData) => void; onBack: () => void }) {
  const [sel, setSel] = useState(save.body);
  const body = BODIES.find((b) => b.id === sel) || BODIES[0];
  const owned = save.owned.includes(body.id);
  const up = upgradesFor(save, body.id);
  const bonus = { speed: up.engine * 0.8, accel: up.turbo * 0.8, handling: up.tires * 0.8, weight: 0 };
  const buyBody = (b: BodyDef) => update((d) => d.coins >= b.price && !d.owned.includes(b.id) ? { ...d, coins: d.coins - b.price, owned: [...d.owned, b.id], body: b.id } : d);
  const buyUp = (u: UpgradeId) => update((d) => {
    const cur = upgradesFor(d, body.id); const lvl = cur[u];
    if (lvl >= MAX_UPGRADE || d.coins < UPGRADE_COST[lvl]) return d;
    return { ...d, coins: d.coins - UPGRADE_COST[lvl], upgrades: { ...d.upgrades, [body.id]: { ...cur, [u]: lvl + 1 } } };
  });
  return (
    <main className="ar-bg min-h-[100dvh] px-4 pb-10 pt-4 text-white sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <button onClick={onBack} className="ar-btn flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-black"><ArrowLeft className="h-5 w-5" /> Back</button>
        <span className="flex items-center gap-2 rounded-2xl border border-yellow-300/30 bg-yellow-400/15 px-4 py-3 font-black text-yellow-200"><Coins className="h-5 w-5" /> {save.coins}</span>
      </div>
      <h1 className="ar-glow mx-auto mt-4 max-w-6xl text-5xl font-black italic">Garage</h1>
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
              <button onClick={() => update((d) => ({ ...d, body: body.id }))} className="ar-btn rounded-xl bg-emerald-400 px-4 py-2 font-black text-slate-950">Drive this kart</button>) :
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
            <div className="mt-2 flex flex-wrap gap-2">{PAINTS.map((c) => <button key={c} onClick={() => update((d) => ({ ...d, paint: c }))} className={"h-10 w-10 rounded-xl border-2 " + (save.paint === c ? "border-white" : "border-transparent")} style={{ background: hex(c) }} />)}</div>
            <h3 className="mt-4 text-xs font-black uppercase tracking-[.25em] text-slate-400">Helmet</h3>
            <div className="mt-2 flex flex-wrap gap-2">{PAINTS.map((c) => <button key={c} onClick={() => update((d) => ({ ...d, helmet: c }))} className={"h-8 w-8 rounded-full border-2 " + (save.helmet === c ? "border-white" : "border-transparent")} style={{ background: hex(c) }} />)}</div>
            <h3 className="mt-4 text-xs font-black uppercase tracking-[.25em] text-slate-400">Driver</h3>
            <div className="mt-2 flex gap-2">{[0xf1c7a4, 0xe0ac86, 0xc68a5f, 0x9c6a43, 0x6e4a32].map((c, i) => <button key={c} onClick={() => update((d) => ({ ...d, driver: i }))} className={"h-8 w-8 rounded-full border-2 " + (save.driver === i ? "border-white" : "border-transparent")} style={{ background: hex(c) }} />)}</div>
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

function RaceView({ trackId, mode, cc, racers, settings, onSettings, gp, onFinish, onRetry, onNext, onQuit }: {
  trackId: string; mode: Mode; cc: number; racers: RacerInfo[]; settings: Settings; onSettings: (s: Settings) => void;
  gp: { index: number; points: Record<string, number>; last: RaceResult | null } | null; onFinish: (r: RaceResult) => void;
  onRetry: () => void; onNext?: () => void; onQuit: () => void;
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
        r = new Race(el, { trackId, mode, cc, racers, quality: settings.quality, sfx: settings.sfx, music: settings.music, touch, autoGas: settings.autoGas, onFinish: (res) => finishRef.current(res) });
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
          <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-xl border-2 border-white/25 bg-black/55 px-4 py-1 text-center">
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
          {mode !== "tt" && (
            <div className="pointer-events-none absolute left-3 top-24 hidden flex-col gap-0.5 sm:flex">
              {hud.standings.map((s, i) => (
                <div key={s.id} className={"flex w-36 items-center gap-2 rounded-lg px-2 py-0.5 text-xs font-black " + (s.isPlayer ? "bg-white/30" : "bg-black/40")}>
                  <span className="w-4 text-right text-white/70">{i + 1}</span><i className="h-2.5 w-2.5 rounded-full" style={{ background: hex(s.color) }} /><span className="truncate">{s.name}</span>{s.finished && <Flag className="ml-auto h-3 w-3" />}
                </div>
              ))}
            </div>
          )}
          {/* bottom-left: minimap */}
          <canvas ref={mapRef} width={200} height={170} className={"pointer-events-none absolute left-3 h-[120px] w-[140px] rounded-2xl bg-black/35 sm:h-[170px] sm:w-[200px] " + (touch ? "top-[110px]" : "bottom-3")} />
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
              <button onClick={() => race!.skipIntro()} className="mt-3 rounded-xl bg-white/20 px-4 py-2 text-sm font-black backdrop-blur">Skip ▸</button>
            </div>
          )}
          {hud.phase === "countdown" && <div className="pointer-events-none absolute inset-0 grid place-items-center"><p key={hud.countdown} className="ar-pop ar-glow text-[10rem] font-black italic text-yellow-300">{hud.countdown}</p></div>}
          {hud.toast && <div key={hud.toast.id} className="ar-toast ar-glow pointer-events-none absolute inset-x-0 top-[28%] text-center text-5xl font-black italic text-yellow-300 sm:text-6xl">{hud.toast.text}</div>}
          {hud.wrongWay && <div className="pointer-events-none absolute inset-x-0 top-[40%] text-center"><span className="rounded-2xl bg-red-600/85 px-6 py-3 text-3xl font-black italic">WRONG WAY!</span></div>}
          {touch && hud.phase !== "finished" && <TouchPad race={race!} autoGas={settings.autoGas} />}
          {hud.result && <Results result={hud.result} mode={mode} gp={gp} onRetry={onRetry} onNext={onNext} onQuit={onQuit} />}
          {paused && !hud.result && (
            <div className="absolute inset-0 grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
              <div className="w-full max-w-sm rounded-[1.75rem] border border-white/15 bg-slate-950/95 p-5">
                <h2 className="text-3xl font-black italic">Paused</h2>
                <SettingsFields settings={settings} onChange={onSettings} note={`Graphics changes apply next race (running: ${hud.quality})`} />
                <div className="mt-5 grid gap-2">
                  <button onClick={() => setPaused(false)} className="ar-btn rounded-2xl bg-sky-400 py-3 font-black text-slate-950"><Play className="mr-1 inline h-4 w-4" /> Resume</button>
                  <button onClick={onRetry} className="ar-btn rounded-2xl border border-white/15 bg-white/10 py-3 font-black"><RotateCcw className="mr-1 inline h-4 w-4" /> Restart race</button>
                  <button onClick={onQuit} className="ar-btn rounded-2xl bg-red-500 py-3 font-black"><X className="mr-1 inline h-4 w-4" /> Quit to menu</button>
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
      <div className="absolute bottom-5 left-4 flex gap-3">
        <button {...hold((v) => ({ steer: v ? -1 : 0 }))} className={btn + " h-24 w-24 text-4xl"}>◀</button>
        <button {...hold((v) => ({ steer: v ? 1 : 0 }))} className={btn + " h-24 w-24 text-4xl"}>▶</button>
      </div>
      <div className="absolute bottom-5 right-4 flex items-end gap-3">
        <div className="flex flex-col gap-3">
          <button {...hold((v) => ({ brake: v }))} className={btn + " h-14 w-14 text-xs"}>BRAKE</button>
          {!autoGas && <button {...hold((v) => ({ gas: v }))} className={btn + " h-14 w-14 bg-emerald-500/60 text-xs"}>GAS</button>}
        </div>
        <button onPointerDown={() => race.useItem()} className={btn + " h-16 w-16 bg-fuchsia-500/60 text-xs"}>ITEM</button>
        <button {...hold((v) => ({ drift: v }))} className={btn + " h-24 w-24 bg-orange-500/70 text-base"}>DRIFT</button>
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
          {onNext ? <button onClick={onNext} className="ar-btn rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-400 py-3 font-black text-slate-950 sm:col-span-3">{lastGp ? "See cup results" : "Next race ▸"}</button> : <button onClick={onRetry} className="ar-btn rounded-2xl bg-gradient-to-r from-yellow-300 to-orange-400 py-3 font-black text-slate-950"><RotateCcw className="mr-1 inline h-4 w-4" /> Race again</button>}
          {!onNext && <button onClick={onQuit} className="ar-btn rounded-2xl border border-white/15 bg-white/10 py-3 font-black sm:col-span-2">Menu</button>}
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
