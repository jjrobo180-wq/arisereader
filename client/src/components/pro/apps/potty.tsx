// Potty Training: a tracker with one-tap logging, a reminder timer that learns the child's rhythm,
// a sit timer kids enjoy, sticker charts with prizes, narrated animated stories to watch together,
// insights, and a research-based guide (readiness, methods with day plans, tips, troubleshooting,
// when to call the doctor).
import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, BellOff, Check, ChevronLeft, ChevronRight, Pause, Play, Plus, Printer, RotateCcw, Trash2, Volume2, VolumeX } from "lucide-react";
import { DOCTOR, KIND_INFO, METHODS, PRIZE_IDEAS, READINESS, SOURCES, STICKERS, STORIES, TIPS, TROUBLE, accidentFreeDays, dayOf, dayStats, dryNightsInARow, earnsSticker, hourPattern, isAccident, isSuccess, readinessVerdict, suggestInterval, type PottyKind, type PottyLog, type Story } from "@shared/pro/potty";
import { Bar, Btn, Card, Chart, Empty, Field, FullScreen, Modal, NumIn, Ring, Stat, Tabs, chime, downloadCsv, esc, fit, fmtDay, fmtDuration, inputCls, lastDays, printPage, randInt, today, uid, usePro, useTick, useWakeLock, vibrate, beep } from "../kit";

const PINK = "#db2777";
const AVATARS = ["🧒", "👧", "👦", "👶", "🦁", "🐻", "🐰", "🦄", "🐶", "🐱", "🦖", "🐸"];
type Kid = { id: string; name: string; avatar: string; goal: number; prize: string; method: string; start: string; interval: number; tryStickers: boolean };
type Sticker = { id: string; kid: string; s: string; at: number };
type Prize = { id: string; kid: string; at: number; prize: string };
type Data = { kids: Kid[]; cur: string; logs: PottyLog[]; stickers: Sticker[]; prizes: Prize[]; ready: Record<string, string[]>; plan: Record<string, string[]>; timer: { kid: string; endAt: number; minutes: number } | null; voice: boolean };
const DEFAULTS: Data = { kids: [], cur: "", logs: [], stickers: [], prizes: [], ready: {}, plan: {}, timer: null, voice: true };

/** Speaks, if voice is on. Returns a promise that ends when speaking ends (or right away). */
function say(text: string, on: boolean, rate = 0.95): Promise<void> {
  return new Promise((done) => {
    try {
      if (!on || !("speechSynthesis" in window)) return done();
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text); u.rate = rate; u.pitch = 1.15;
      u.onend = () => done(); u.onerror = () => done();
      window.speechSynthesis.speak(u);
      window.setTimeout(done, 4000 + text.length * 90); // never hang if the browser drops the event
    } catch { done(); }
  });
}
function notify(title: string, body: string) {
  try { if ("Notification" in window && Notification.permission === "granted" && document.hidden) new Notification(title, { body }); } catch { /* not supported */ }
}

const CSS = `
@keyframes pt-bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-18%)}}
@keyframes pt-wiggle{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes pt-slide{0%{transform:translateX(-40%);opacity:0}100%{transform:translateX(0);opacity:1}}
@keyframes pt-pop{0%{transform:scale(0)}70%{transform:scale(1.2)}100%{transform:scale(1)}}
@keyframes pt-spin{to{transform:rotate(360deg)}}
@keyframes pt-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10%)}}
@keyframes pt-shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-8%)}75%{transform:translateX(8%)}}
@keyframes pt-fall{0%{transform:translateY(-10vh) rotate(0)}100%{transform:translateY(110vh) rotate(720deg)}}
@keyframes pt-rise{0%{transform:translateY(0);opacity:.9}100%{transform:translateY(-70vh);opacity:0}}
.pt-bounce{animation:pt-bounce 1.1s ease-in-out infinite}.pt-wiggle{animation:pt-wiggle .7s ease-in-out infinite}.pt-slide{animation:pt-slide 1.2s ease-out both}
.pt-pop{animation:pt-pop .6s ease-out both}.pt-spin{animation:pt-spin 3s linear infinite}.pt-float{animation:pt-float 2.4s ease-in-out infinite}.pt-shake{animation:pt-shake .5s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){[class^="pt-"],[class*=" pt-"]{animation:none!important}}`;
const Styles = () => <style>{CSS}</style>;

function Confetti({ n = 60 }: { n?: number }) {
  const bits = useMemo(() => Array.from({ length: n }, (_, i) => ({ i, left: randInt(100), delay: Math.random() * 1.2, dur: 2.2 + Math.random() * 1.8, color: ["#f43f5e", "#f59e0b", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"][i % 6], size: 8 + randInt(8) })), [n]);
  return <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">{bits.map((b) => <span key={b.i} className="absolute top-0 rounded-sm" style={{ left: `${b.left}%`, width: b.size, height: b.size * 0.6, background: b.color, animation: `pt-fall ${b.dur}s linear ${b.delay}s infinite` }} />)}</div>;
}

// ─── Celebration + sticker pick ───
function Celebrate({ kid, voice, onPick, onClose, title }: { kid: Kid; voice: boolean; onPick: (s: string) => void; onClose: () => void; title: string }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choices = useMemo(() => [...STICKERS].sort(() => Math.random() - 0.5).slice(0, 8), []);
  useEffect(() => { chime(); vibrate([80, 60, 80]); void say(`Hooray, ${kid.name}! ${title}! Pick a sticker!`, voice); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <FullScreen bg="linear-gradient(135deg,#f472b6,#a855f7,#38bdf8)" onClose={onClose}>
    <Styles /><Confetti />
    <div className="relative z-10 flex flex-col items-center px-4 text-center">
      <span className="pt-bounce text-8xl">{kid.avatar}</span>
      <p className="mt-2 text-5xl font-black drop-shadow">Hooray, {kid.name}!</p>
      <p className="mt-1 text-2xl font-bold opacity-95">{title}</p>
      {!picked ? <><p className="mt-6 text-xl font-bold">Pick a sticker!</p>
        <div className="mt-3 grid grid-cols-4 gap-3">{choices.map((s) => <button key={s} type="button" onClick={() => { setPicked(s); onPick(s); beep(1200, 120); void say("Great choice!", voice); window.setTimeout(onClose, 1800); }} className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/90 text-5xl shadow-lg transition hover:scale-110 active:scale-95">{s}</button>)}</div></>
        : <span className="pt-pop mt-6 text-[9rem] leading-none">{picked}</span>}
    </div>
  </FullScreen>;
}

// ─── Story player ───
function StoryPlayer({ story, voice, onClose, onVoice }: { story: Story; voice: boolean; onClose: () => void; onVoice: (v: boolean) => void }) {
  const [i, setI] = useState(0); const [playing, setPlaying] = useState(true); const [done, setDone] = useState(false);
  const token = useRef(0);
  useWakeLock(playing);
  useEffect(() => {
    if (!playing || done) return;
    const t = ++token.current; const sc = story.scenes[i];
    const min = new Promise((r) => window.setTimeout(r, voice ? 1800 : 4200));
    void Promise.all([say(sc.say || sc.text, voice, 0.9), min]).then(() => {
      if (t !== token.current) return;
      if (i + 1 < story.scenes.length) setI(i + 1); else { setDone(true); setPlaying(false); chime(); }
    });
    return () => { token.current++; };
  }, [i, playing, voice, done, story]);
  useEffect(() => () => { try { window.speechSynthesis?.cancel(); } catch { /* none */ } }, []);
  const sc = story.scenes[Math.min(i, story.scenes.length - 1)];
  const go = (n: number) => { try { window.speechSynthesis?.cancel(); } catch { /* none */ } setDone(false); setI(Math.max(0, Math.min(story.scenes.length - 1, n))); };
  return <FullScreen bg="#0f172a" onClose={onClose}>
    <Styles />
    <div className="flex h-full w-full max-w-4xl flex-col justify-center p-3 sm:p-6">
      <div className="relative aspect-video w-full overflow-hidden rounded-3xl shadow-2xl" style={{ background: sc.bg }}>
        {sc.actors.map((a, k) => <span key={`${i}-${k}`} className={`absolute -translate-x-1/2 -translate-y-1/2 select-none ${a.a === "none" ? "" : `pt-${a.a}`}`} style={{ left: `${a.x}%`, top: `${a.y ?? 52}%`, fontSize: `clamp(40px, ${(a.size || 110) / 9}vw, ${a.size || 110}px)`, animationDelay: `${k * 0.15}s` }}>{a.e}</span>)}
        <p key={`t${i}`} className="pt-slide absolute inset-x-0 bottom-0 bg-black/45 px-4 py-3 text-center text-xl font-black text-white sm:text-3xl">{sc.text}</p>
        {done && <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50"><p className="text-4xl font-black">The end! ⭐</p><button type="button" onClick={() => { setDone(false); setI(0); setPlaying(true); }} className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-lg font-black text-slate-900"><RotateCcw size={20} />Watch again</button></div>}
      </div>
      <div className="mt-3 flex gap-1">{story.scenes.map((_, k) => <span key={k} className="h-1.5 flex-1 rounded-full" style={{ background: k <= i ? "#f472b6" : "#ffffff33" }} />)}</div>
      <div className="mt-3 flex items-center justify-center gap-3">
        <button type="button" aria-label="Back" onClick={() => go(i - 1)} className="rounded-full bg-white/10 p-3 hover:bg-white/20"><ChevronLeft size={26} /></button>
        <button type="button" aria-label={playing ? "Pause" : "Play"} onClick={() => { if (playing) { setPlaying(false); token.current++; try { window.speechSynthesis?.cancel(); } catch { /* none */ } } else { if (done) { setDone(false); setI(0); } setPlaying(true); } }} className="rounded-full bg-pink-500 p-4 hover:bg-pink-400">{playing ? <Pause size={30} /> : <Play size={30} />}</button>
        <button type="button" aria-label="Next" onClick={() => go(i + 1)} className="rounded-full bg-white/10 p-3 hover:bg-white/20"><ChevronRight size={26} /></button>
        <button type="button" aria-label={voice ? "Mute narration" : "Turn narration on"} onClick={() => onVoice(!voice)} className="ml-4 rounded-full bg-white/10 p-3 hover:bg-white/20">{voice ? <Volume2 size={22} /> : <VolumeX size={22} />}</button>
      </div>
      <p className="mt-2 text-center text-sm opacity-70">{story.title}</p>
    </div>
  </FullScreen>;
}

// ─── Sit timer (kid view) ───
function SitTimer({ kid, seconds, voice, onEnd, onClose }: { kid: Kid; seconds: number; voice: boolean; onEnd: (r: "pee" | "poop" | "both" | "try") => void; onClose: () => void }) {
  const [endAt] = useState(() => Date.now() + seconds * 1000); const [over, setOver] = useState(false);
  useTick(!over, 200); useWakeLock(true);
  const left = Math.max(0, (endAt - Date.now()) / 1000);
  useEffect(() => { void say(`Potty time, ${kid.name}! Let's sit and relax. Blow some bubbles!`, voice); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!over && left <= 0) { setOver(true); chime(); void say("All done! Did anything come out?", voice); } }, [left, over, voice]);
  const bubbles = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ i, left: 5 + randInt(90), size: 20 + randInt(50), delay: Math.random() * 6, dur: 5 + Math.random() * 4 })), []);
  return <FullScreen bg="linear-gradient(180deg,#38bdf8,#818cf8)" onClose={onClose}>
    <Styles />
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">{bubbles.map((b) => <span key={b.i} className="absolute bottom-0 rounded-full border-2 border-white/70 bg-white/20" style={{ left: `${b.left}%`, width: b.size, height: b.size, animation: `pt-rise ${b.dur}s ease-in ${b.delay}s infinite` }} />)}</div>
    <div className="relative z-10 flex flex-col items-center px-4 text-center">
      {!over ? <><span className="pt-float text-8xl">{kid.avatar}</span><p className="mt-2 text-3xl font-black">Sit and relax, {kid.name}</p>
        <Ring value={left} max={seconds} size={220} color="#ffffff" stroke={16}><p className="font-mono text-6xl font-black tabular-nums text-white">{fmtDuration(left)}</p></Ring>
        <p className="mt-3 text-lg opacity-90">Take big breaths… blow like bubbles! 🫧</p>
        <button type="button" onClick={() => setOver(true)} className="mt-6 rounded-full bg-white/20 px-5 py-2 font-bold hover:bg-white/30">Something came out!</button></>
        : <><p className="text-4xl font-black">Did anything come out?</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{([["pee", "💧", "Pee"], ["poop", "💩", "Poop"], ["both", "🌟", "Both!"], ["try", "🪑", "Not this time"]] as const).map(([k, e, l]) => <button key={k} type="button" onClick={() => onEnd(k)} className="flex h-32 w-32 flex-col items-center justify-center rounded-3xl bg-white text-slate-900 shadow-xl hover:scale-105"><span className="text-5xl">{e}</span><span className="mt-1 font-black">{l}</span></button>)}</div></>}
    </div>
  </FullScreen>;
}

// ─── Reminder alert ───
function Alert({ kid, voice, onAnswer, onClose }: { kid: Kid; voice: boolean; onAnswer: (a: "went" | "sit" | "tried" | "accident" | "snooze") => void; onClose: () => void }) {
  useEffect(() => {
    const ring = () => { chime(); vibrate([200, 100, 200]); void say(`Potty time, ${kid.name}!`, voice); };
    ring(); notify("Potty time!", `Time for ${kid.name} to try the potty.`);
    const t = window.setInterval(ring, 20_000); return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <FullScreen bg="linear-gradient(135deg,#f472b6,#fb923c)" onClose={onClose}>
    <Styles />
    <div className="flex flex-col items-center px-4 text-center">
      <span className="pt-wiggle text-8xl">🚽</span><p className="mt-3 text-5xl font-black">Potty time, {kid.name}!</p>
      <div className="mt-8 grid w-full max-w-lg grid-cols-2 gap-3">
        <button type="button" onClick={() => onAnswer("sit")} className="col-span-2 rounded-2xl bg-white py-4 text-xl font-black text-pink-600">Start the sit timer</button>
        <button type="button" onClick={() => onAnswer("went")} className="rounded-2xl bg-white/90 py-3 font-black text-slate-900">💧 Went in the potty</button>
        <button type="button" onClick={() => onAnswer("tried")} className="rounded-2xl bg-white/90 py-3 font-black text-slate-900">🪑 Tried</button>
        <button type="button" onClick={() => onAnswer("accident")} className="rounded-2xl bg-white/25 py-3 font-bold">💦 Had an accident</button>
        <button type="button" onClick={() => onAnswer("snooze")} className="rounded-2xl bg-white/25 py-3 font-bold">⏰ 5 more minutes</button>
      </div>
    </div>
  </FullScreen>;
}

export function PottyTraining() {
  const { data, setData } = usePro<Data>("potty", DEFAULTS);
  const [tab, setTab] = useState<"today" | "timer" | "stickers" | "stories" | "insights" | "guide">("today");
  const [kidForm, setKidForm] = useState<Kid | null>(null);
  const [party, setParty] = useState<string | null>(null);
  const [story, setStory] = useState<Story | null>(null);
  const [sit, setSit] = useState<number | null>(null); const [sitLen, setSitLen] = useState(180);
  const [alertOn, setAlertOn] = useState(false);
  const [at, setAt] = useState(""); // custom time for logging, HH:MM (blank = now)
  const kid = data.kids.find((k) => k.id === data.cur) || data.kids[0];
  const set = (fn: (d: Data) => Data) => setData(fn);
  const putKid = (k: Kid) => set((d) => ({ ...d, kids: d.kids.some((x) => x.id === k.id) ? d.kids.map((x) => (x.id === k.id ? k : x)) : [...d.kids, k], cur: k.id }));

  // Reminder timer: wall-clock end time, saved, so it survives reloads and sleeping tabs.
  const timerMine = data.timer && kid && data.timer.kid === kid.id ? data.timer : null;
  useTick(!!data.timer, 500);
  useEffect(() => { if (data.timer && Date.now() >= data.timer.endAt && !alertOn) setAlertOn(true); });
  const startTimer = (minutes: number, k = kid) => { if (k) set((d) => ({ ...d, timer: { kid: k.id, endAt: Date.now() + minutes * 60_000, minutes } })); };
  const stopTimer = () => set((d) => ({ ...d, timer: null }));

  const log = (kind: PottyKind, when?: number) => {
    if (!kid) return;
    let ms = when ?? Date.now();
    if (!when && at) { const [h, m] = at.split(":").map(Number); const d = new Date(); d.setHours(h, m, 0, 0); ms = d.getTime(); }
    set((d) => ({ ...d, logs: [...d.logs, { id: uid(), kid: kid.id, at: ms, kind }] }));
    setAt("");
    if (earnsSticker(kind) || (kind === "try" && kid.tryStickers)) setParty(isSuccess(kind) ? (kind === "poop" ? "Poop in the potty" : kind === "both" ? "Pee and poop in the potty" : "Pee in the potty") : kind === "try" ? "Great trying" : kind === "night-dry" ? "A dry night" : "Dry pants");
    else if (isAccident(kind)) void say("That's okay. Accidents happen. Let's try the potty next time!", data.voice);
  };
  const giveSticker = (s: string) => kid && set((d) => ({ ...d, stickers: [...d.stickers, { id: uid(), kid: kid.id, s, at: Date.now() }] }));

  if (!kid) return <div className="space-y-4">
    <Card tint="#fdf2f8"><div className="flex flex-col items-center py-6 text-center"><span className="text-6xl">🚽</span><p className="mt-2 text-2xl font-black">Potty training, made fun</p><p className="mt-1 max-w-md text-slate-600">Track every try, set reminders, earn stickers and prizes, watch potty stories together, and follow a plan backed by research.</p>
      <Btn big kind="primary" color={PINK} className="mt-4" onClick={() => setKidForm({ id: uid(), name: "", avatar: "🧒", goal: 10, prize: PRIZE_IDEAS[0], method: "child", start: today(), interval: 60, tryStickers: true })}><Plus size={18} />Add your child</Btn></div></Card>
    {kidForm && <KidModal k={kidForm} onSave={(k) => { putKid(k); setKidForm(null); }} onClose={() => setKidForm(null)} />}
  </div>;

  const t = today(); const st = dayStats(data.logs, kid.id, t);
  const todayLogs = data.logs.filter((x) => x.kid === kid.id && dayOf(x.at) === t).sort((a, b) => b.at - a.at);
  const lastPrize = data.prizes.filter((p) => p.kid === kid.id).reduce((m, p) => Math.max(m, p.at), 0);
  const board = data.stickers.filter((s) => s.kid === kid.id && s.at > lastPrize);
  const suggestion = suggestInterval(data.logs, kid.id);
  const freeDays = accidentFreeDays(data.logs, kid.id); const dryNights = dryNightsInARow(data.logs, kid.id);
  const left = timerMine ? Math.max(0, (timerMine.endAt - Date.now()) / 1000) : 0;

  return <div className="space-y-4">
    <Styles />
    {/* Kid switcher */}
    <div className="flex flex-wrap items-center gap-2">
      {data.kids.map((k) => <button key={k.id} type="button" onClick={() => set((d) => ({ ...d, cur: k.id }))} className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-black ring-2 ${k.id === kid.id ? "bg-pink-600 text-white ring-pink-600" : "bg-white ring-slate-200"}`}><span className="text-xl">{k.avatar}</span>{k.name}</button>)}
      <Btn onClick={() => setKidForm({ ...kid })}>Edit</Btn><Btn onClick={() => setKidForm({ id: uid(), name: "", avatar: AVATARS[data.kids.length % AVATARS.length], goal: 10, prize: PRIZE_IDEAS[0], method: "child", start: today(), interval: 60, tryStickers: true })}><Plus size={14} />Child</Btn>
      <span className="flex-1" />
      <button type="button" onClick={() => set((d) => ({ ...d, voice: !d.voice }))} className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-bold ring-1 ring-slate-200" aria-label="Voice">{data.voice ? <Volume2 size={15} /> : <VolumeX size={15} />}{data.voice ? "Voice on" : "Voice off"}</button>
    </div>
    {data.timer && <button type="button" onClick={() => setTab("timer")} className="flex w-full items-center gap-3 rounded-2xl bg-pink-50 p-3 text-left ring-1 ring-pink-200"><Bell size={18} className="text-pink-600" /><span className="flex-1 font-bold text-pink-900">Next potty reminder{data.timer.kid !== kid.id ? ` for ${data.kids.find((k) => k.id === data.timer!.kid)?.name}` : ""} in <span className="font-mono">{fmtDuration(Math.max(0, (data.timer.endAt - Date.now()) / 1000))}</span></span><span className="text-xs text-pink-700">Timer ›</span></button>}

    <Tabs value={tab} onChange={setTab} color={PINK} items={[{ id: "today", label: "Today" }, { id: "timer", label: "Timers" }, { id: "stickers", label: `Stickers (${board.length}/${kid.goal})` }, { id: "stories", label: "Stories" }, { id: "insights", label: "Progress" }, { id: "guide", label: "Guide" }]} />

    {tab === "today" && <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Potty wins today" value={st.successes} color={PINK} /><Stat label="Accidents today" value={st.accidents} /><Stat label="Accident-free days" value={freeDays} color="#16a34a" /><Stat label="Dry nights in a row" value={dryNights} color="#4338ca" /></div>
      <Card title={`Log for ${kid.name}`} right={<label className="flex items-center gap-1 text-xs text-slate-500">Time <input type="time" value={at} onChange={(e) => setAt(e.target.value)} className={fit("w-28")} aria-label="Time (blank = now)" />{at && <button type="button" onClick={() => setAt("")} className="text-pink-600">now</button>}</label>}>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{(["pee", "poop", "both", "try", "dry"] as PottyKind[]).map((k) => <button key={k} type="button" onClick={() => log(k)} className="flex flex-col items-center rounded-2xl bg-gradient-to-b from-pink-50 to-white p-3 ring-2 ring-pink-100 transition hover:ring-pink-300 active:scale-95"><span className="text-4xl">{KIND_INFO[k].emoji}</span><span className="mt-1 text-xs font-black text-slate-700">{KIND_INFO[k].label}</span></button>)}</div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{(["acc-pee", "acc-poop", "night-dry", "night-wet"] as PottyKind[]).map((k) => <button key={k} type="button" onClick={() => log(k, k.startsWith("night") ? (() => { const d = new Date(); d.setHours(6, 30, 0, 0); return at ? undefined : d.getTime(); })() : undefined)} className={`flex items-center gap-2 rounded-xl p-2.5 text-sm font-bold ring-1 ${k.startsWith("night") ? "bg-indigo-50 text-indigo-900 ring-indigo-100" : "bg-slate-50 text-slate-700 ring-slate-200"}`}><span className="text-2xl">{KIND_INFO[k].emoji}</span>{KIND_INFO[k].label}</button>)}</div>
        <div className="mt-3 flex flex-wrap gap-2"><Btn kind="primary" color={PINK} onClick={() => setSit(sitLen)}><Play size={15} />Sit timer ({Math.round(sitLen / 60)} min)</Btn><Btn kind="soft" color={PINK} onClick={() => setTab("stories")}>Watch a story</Btn>{!data.timer && <Btn onClick={() => startTimer(suggestion || kid.interval)}><Bell size={14} />Remind me in {suggestion || kid.interval} min</Btn>}</div>
      </Card>
      <Card title="Today">{todayLogs.length ? <ul className="divide-y divide-slate-100">{todayLogs.map((x) => <li key={x.id} className="flex items-center gap-3 py-2"><span className="w-16 text-sm font-bold text-slate-500">{new Date(x.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span><span className="text-2xl">{KIND_INFO[x.kind].emoji}</span><span className={`flex-1 font-bold ${KIND_INFO[x.kind].good === false ? "text-slate-500" : ""}`}>{KIND_INFO[x.kind].label}</span><button type="button" aria-label="Delete" onClick={() => set((d) => ({ ...d, logs: d.logs.filter((y) => y.id !== x.id) }))} className="text-slate-300 hover:text-rose-600"><Trash2 size={14} /></button></li>)}</ul> : <Empty>Nothing logged yet today. Tap a button above each time {kid.name} sits, goes, or has an accident.</Empty>}</Card>
    </>}

    {tab === "timer" && <>
      <Card title="Potty reminder" tint="#fdf2f8">
        <div className="flex flex-wrap items-center gap-6">
          <Ring value={timerMine ? left : 0} max={(timerMine?.minutes || kid.interval) * 60} size={170} color={PINK}>{timerMine ? <><p className="font-mono text-4xl font-black tabular-nums">{fmtDuration(left)}</p><p className="text-xs text-slate-500">until potty time</p></> : <p className="px-4 text-sm text-slate-500">Off</p>}</Ring>
          <div className="min-w-[220px] flex-1 space-y-3">
            <div className="flex flex-wrap gap-1.5">{[20, 30, 45, 60, 90, 120].map((m) => <button key={m} type="button" onClick={() => putKid({ ...kid, interval: m })} className={`rounded-full px-3 py-1.5 text-sm font-bold ${kid.interval === m ? "bg-pink-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>{m < 60 ? `${m} min` : `${m / 60} hr${m > 60 ? "s" : ""}`.replace("1.5 hrs", "1½ hrs")}</button>)}<NumIn value={kid.interval} min={5} max={240} onChange={(v) => putKid({ ...kid, interval: Math.max(5, Math.min(240, Number(v) || 60)) })} className="w-20" /></div>
            {suggestion ? <p className="rounded-xl bg-white p-2 text-sm">From {kid.name}'s log: usually pees about every <b>{suggestion + 15} min</b>. A reminder every <b>{suggestion} min</b> lands just before. <button type="button" className="font-bold text-pink-700 underline" onClick={() => putKid({ ...kid, interval: suggestion })}>Use {suggestion} min</button></p> : <p className="text-xs text-slate-500">Log a few days and the app will suggest a reminder time based on {kid.name}'s own pattern. Starting points: every 20–30 min on day one of an intensive plan, 60–90 min once it's going well.</p>}
            <div className="flex flex-wrap gap-2">{timerMine ? <><Btn kind="primary" color={PINK} onClick={() => startTimer(kid.interval)}><RotateCcw size={14} />Restart</Btn><Btn onClick={stopTimer}><BellOff size={14} />Stop</Btn></> : <Btn big kind="primary" color={PINK} onClick={() => startTimer(kid.interval)}><Bell size={18} />Start reminders</Btn>}
              {"Notification" in window && Notification.permission === "default" && <Btn onClick={() => void Notification.requestPermission()}>Allow alerts when this tab is hidden</Btn>}</div>
            <p className="text-xs text-slate-500">When it rings: chime, vibration and a spoken "Potty time, {kid.name}!" — it repeats every 20 seconds until you answer. Keep this page open (the screen can lock on phones).</p>
          </div>
        </div>
      </Card>
      <Card title="Sit timer — for your child to watch">
        <p className="text-sm text-slate-600">Most sits should be 3–5 minutes: long enough to relax, short enough not to become a fight. Bubbles and a countdown keep little ones sitting.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">{[60, 120, 180, 240, 300].map((s) => <button key={s} type="button" onClick={() => setSitLen(s)} className={`rounded-full px-3 py-1.5 text-sm font-bold ${sitLen === s ? "bg-sky-600 text-white" : "bg-white ring-1 ring-slate-200"}`}>{s / 60} min</button>)}<Btn big kind="primary" color="#0284c7" onClick={() => setSit(sitLen)}><Play size={18} />Start sit</Btn></div>
      </Card>
      <Card title="Good times to sit, every day"><div className="grid gap-2 text-sm sm:grid-cols-2">{["Right after waking up (morning and naps)", "15–30 minutes after each meal — the body naturally moves poop along after eating", "Before leaving the house and when you arrive", "Before bath and before bed"].map((x) => <p key={x} className="rounded-xl bg-slate-50 p-2">⏰ {x}</p>)}</div></Card>
    </>}

    {tab === "stickers" && <>
      <Card title={`${kid.name}'s sticker chart`} tint="#fefce8" right={<Btn onClick={() => printChart(kid)}><Printer size={14} />Print a chart</Btn>}>
        <p className="mb-3 text-center text-lg font-black">{board.length >= kid.goal ? `🎉 ${kid.name} earned: ${kid.prize}!` : `${kid.goal - board.length} more sticker${kid.goal - board.length === 1 ? "" : "s"} to: ${kid.prize}`}</p>
        <div className="mx-auto grid max-w-xl grid-cols-5 gap-2">{Array.from({ length: kid.goal }, (_, i) => <div key={i} className={`flex aspect-square items-center justify-center rounded-2xl text-4xl ${board[i] ? "bg-white shadow ring-2 ring-amber-300" : "border-2 border-dashed border-amber-300 bg-amber-50 text-base font-black text-amber-300"}`}>{board[i] ? <span className="pt-pop">{board[i].s}</span> : i + 1}</div>)}</div>
        <Bar value={board.length} max={kid.goal} color="#f59e0b" className="mx-auto mt-3 max-w-xl" />
        <div className="mt-4 flex flex-wrap justify-center gap-2">{board.length >= kid.goal && <Btn big kind="primary" color="#f59e0b" onClick={() => { set((d) => ({ ...d, prizes: [...d.prizes, { id: uid(), kid: kid.id, at: Date.now(), prize: kid.prize }] })); setParty(`You earned ${kid.prize}`); }}>🏆 Claim the prize!</Btn>}<Btn onClick={() => setParty("A bonus sticker")}><Plus size={14} />Give a bonus sticker</Btn></div>
      </Card>
      <Card title="Prize and goal"><div className="grid gap-3 sm:grid-cols-[1fr_140px]"><Field label="Prize"><input value={kid.prize} onChange={(e) => putKid({ ...kid, prize: e.target.value })} className={inputCls} /></Field><Field label="Stickers needed"><NumIn value={kid.goal} min={3} max={40} onChange={(v) => putKid({ ...kid, goal: Math.max(3, Math.min(40, Number(v) || 10)) })} /></Field></div>
        <div className="mt-2 flex flex-wrap gap-1.5">{PRIZE_IDEAS.map((p) => <button key={p} type="button" onClick={() => putKid({ ...kid, prize: p })} className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{p}</button>)}</div>
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={kid.tryStickers} onChange={(e) => putKid({ ...kid, tryStickers: e.target.checked })} />Give a sticker for sitting and trying (great at the start — turn off once they're going regularly)</label>
        <p className="mt-2 text-xs text-slate-500">Research tip: start with small goals (5–10) so the first prize comes within a day or two, then make the goal bigger.</p></Card>
      {data.prizes.filter((p) => p.kid === kid.id).length > 0 && <Card title="Prizes earned">{data.prizes.filter((p) => p.kid === kid.id).reverse().map((p) => <p key={p.id} className="text-sm">🏆 <b>{p.prize}</b> — {fmtDay(dayOf(p.at))}</p>)}</Card>}
      <Card title={`Sticker collection (${data.stickers.filter((s) => s.kid === kid.id).length})`}><div className="flex flex-wrap gap-1 text-3xl">{data.stickers.filter((s) => s.kid === kid.id).map((s) => <span key={s.id} title={fmtDay(dayOf(s.at))}>{s.s}</span>)}</div></Card>
    </>}

    {tab === "stories" && <>
      <p className="text-sm text-slate-600">Short animated stories, read aloud, to watch with {kid.name} — on the couch or while sitting on the potty. Tap one to play full screen.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{STORIES.map((s) => <button key={s.id} type="button" onClick={() => setStory(s)} className="group overflow-hidden rounded-3xl bg-white text-left shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="relative flex aspect-video items-center justify-center" style={{ background: s.scenes[0].bg }}><span className="pt-float text-7xl">{s.emoji}</span><span className="absolute inset-0 flex items-center justify-center opacity-0 transition group-hover:opacity-100"><span className="rounded-full bg-black/50 p-4 text-white"><Play size={28} /></span></span><span className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5 text-xs font-bold text-white">{s.minutes}</span></div>
        <div className="p-3"><p className="font-black">{s.title}</p><p className="text-xs text-slate-500">{s.about}</p></div>
      </button>)}</div>
    </>}

    {tab === "insights" && <Insights logs={data.logs} kid={kid} suggestion={suggestion} />}
    {tab === "guide" && <Guide kid={kid} ready={data.ready[kid.id] || []} setReady={(r) => set((d) => ({ ...d, ready: { ...d.ready, [kid.id]: r } }))} plan={data.plan[kid.id] || []} setPlan={(p) => set((d) => ({ ...d, plan: { ...d.plan, [kid.id]: p } }))} setMethod={(m) => putKid({ ...kid, method: m })} />}

    {kidForm && <KidModal k={kidForm} onSave={(k) => { putKid(k); setKidForm(null); }} onClose={() => setKidForm(null)} onDelete={data.kids.some((x) => x.id === kidForm.id) ? () => { if (window.confirm(`Remove ${kidForm.name} and their log?`)) { set((d) => ({ ...d, kids: d.kids.filter((x) => x.id !== kidForm.id), logs: d.logs.filter((x) => x.kid !== kidForm.id), stickers: d.stickers.filter((x) => x.kid !== kidForm.id), cur: d.kids.find((x) => x.id !== kidForm.id)?.id || "", timer: d.timer?.kid === kidForm.id ? null : d.timer })); setKidForm(null); } } : undefined} />}
    {party && <Celebrate kid={kid} voice={data.voice} title={party} onPick={giveSticker} onClose={() => setParty(null)} />}
    {story && <StoryPlayer story={story} voice={data.voice} onVoice={(v) => set((d) => ({ ...d, voice: v }))} onClose={() => setStory(null)} />}
    {sit !== null && <SitTimer kid={kid} seconds={sit} voice={data.voice} onClose={() => setSit(null)} onEnd={(r) => { setSit(null); log(r); if (data.timer) startTimer(kid.interval); }} />}
    {alertOn && data.timer && (() => { const ak = data.kids.find((k) => k.id === data.timer!.kid) || kid; return <Alert kid={ak} voice={data.voice} onClose={() => { setAlertOn(false); startTimer(ak.interval, ak); }} onAnswer={(a) => {
      setAlertOn(false);
      if (a === "snooze") { startTimer(5, ak); return; }
      startTimer(ak.interval, ak);
      if (ak.id !== kid.id) set((d) => ({ ...d, cur: ak.id }));
      if (a === "sit") setSit(sitLen); else if (a === "went") log("pee"); else if (a === "tried") log("try"); else log("acc-pee");
    }} />; })()}
  </div>;
}

function printChart(kid: Kid) {
  const cells = Array.from({ length: kid.goal }, (_, i) => `<div style="border:3px dashed #f59e0b;border-radius:18px;aspect-ratio:1;display:flex;align-items:center;justify-content:center;font:900 22px Arial;color:#fcd34d">${i + 1}</div>`).join("");
  printPage(`${kid.name}'s potty chart`, `<div style="text-align:center"><div style="font-size:64px">${esc(kid.avatar)} 🚽 ⭐</div><h1 style="font-size:34px">${esc(kid.name)}'s Potty Chart</h1><p style="font-size:18px">Every time I use the potty I get a sticker!</p></div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin:24px 0">${cells}</div><div style="text-align:center;font-size:24px;border:3px solid #f59e0b;border-radius:18px;padding:14px">🏆 When I fill my chart: <b>${esc(kid.prize)}</b></div>`);
}

function KidModal({ k, onSave, onClose, onDelete }: { k: Kid; onSave: (k: Kid) => void; onClose: () => void; onDelete?: () => void }) {
  const [v, setV] = useState(k);
  return <Modal title={k.name ? `Edit ${k.name}` : "Add your child"} onClose={onClose} footer={<>{onDelete && <Btn kind="danger" onClick={onDelete}>Remove</Btn>}<Btn kind="primary" color={PINK} disabled={!v.name.trim()} onClick={() => onSave({ ...v, name: v.name.trim() })}>Save</Btn></>}>
    <div className="space-y-3"><Field label="Name (or nickname)"><input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputCls} autoFocus /></Field>
      <Field label="Picture"><div className="flex flex-wrap gap-1.5">{AVATARS.map((a) => <button key={a} type="button" onClick={() => setV({ ...v, avatar: a })} className={`h-11 w-11 rounded-xl text-2xl ${v.avatar === a ? "bg-pink-100 ring-2 ring-pink-500" : "bg-slate-50"}`}>{a}</button>)}</div></Field>
      <div className="grid grid-cols-2 gap-3"><Field label="Started training"><input type="date" value={v.start} onChange={(e) => setV({ ...v, start: e.target.value })} className={inputCls} /></Field><Field label="Method"><select value={v.method} onChange={(e) => setV({ ...v, method: e.target.value })} className={inputCls}>{METHODS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}</select></Field></div>
    </div>
  </Modal>;
}

function Insights({ logs, kid, suggestion }: { logs: PottyLog[]; kid: Kid; suggestion: number | null }) {
  const days = lastDays(14); const mine = logs.filter((x) => x.kid === kid.id);
  const per = days.map((d) => dayStats(logs, kid.id, d));
  const hours = hourPattern(logs, kid.id);
  const top = hours.map((n, h) => ({ n, h })).filter((x) => x.n > 0).sort((a, b) => b.n - a.n).slice(0, 4).sort((a, b) => a.h - b.h);
  const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`;
  const week = per.slice(-7); const ws = week.reduce((s, x) => s + x.successes, 0), wa = week.reduce((s, x) => s + x.accidents, 0);
  const pw = per.slice(0, 7); const ps = pw.reduce((s, x) => s + x.successes, 0), pa = pw.reduce((s, x) => s + x.accidents, 0);
  const rate = ws + wa ? Math.round((ws / (ws + wa)) * 100) : null; const prev = ps + pa ? Math.round((ps / (ps + pa)) * 100) : null;
  const daysIn = Math.max(1, Math.round((new Date(today()).getTime() - new Date(kid.start).getTime()) / 86_400_000) + 1);
  if (!mine.length) return <Empty>Progress charts appear once you've logged a few potty trips.</Empty>;
  return <div className="space-y-4">
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Potty success, last 7 days" value={rate === null ? "—" : `${rate}%`} sub={prev !== null && rate !== null ? `${rate >= prev ? "▲" : "▼"} from ${prev}% the week before` : undefined} color={PINK} /><Stat label="Potty wins, 7 days" value={ws} /><Stat label="Accidents, 7 days" value={wa} /><Stat label="Day of training" value={daysIn} /></div>
    <Card title="Last 14 days"><Chart kind="column" labels={days.map((d) => fmtDay(d, { month: "numeric", day: "numeric" }))} series={[{ name: "In the potty", values: per.map((x) => x.successes) }, { name: "Accidents", values: per.map((x) => x.accidents) }]} colors={[PINK, "#94a3b8"]} height={220} legend /></Card>
    <Card title="When does it usually happen?"><div className="flex h-28 items-end gap-0.5">{hours.map((n, h) => <div key={h} className="flex flex-1 flex-col items-center justify-end" title={`${hourLabel(h)}: ${n}`}><div className="w-full rounded-t" style={{ height: `${(n / Math.max(1, ...hours)) * 100}%`, minHeight: n ? 4 : 0, background: PINK }} /></div>)}</div><div className="mt-1 flex justify-between text-[10px] text-slate-400"><span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span></div>
      <p className="mt-2 text-sm">{top.length ? <>Busiest times: <b>{top.map((x) => hourLabel(x.h)).join(", ")}</b>. Offer a sit 10–15 minutes before these.</> : "Not enough pees logged yet."}{suggestion && <> Suggested reminder: every <b>{suggestion} minutes</b>.</>}</p></Card>
    <Btn onClick={() => downloadCsv(`${kid.name}-potty-log`, [["Date", "Time", "What"], ...mine.sort((a, b) => a.at - b.at).map((x) => [dayOf(x.at), new Date(x.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }), KIND_INFO[x.kind].label])])}>Download the log (CSV) for the doctor or daycare</Btn>
  </div>;
}

function Guide({ kid, ready, setReady, plan, setPlan, setMethod }: { kid: Kid; ready: string[]; setReady: (r: string[]) => void; plan: string[]; setPlan: (p: string[]) => void; setMethod: (m: string) => void }) {
  const [g, setG] = useState<"ready" | "methods" | "tips" | "help" | "doctor">("ready");
  const v = readinessVerdict(ready.length);
  const method = METHODS.find((m) => m.id === kid.method) || METHODS[0];
  return <div className="space-y-4">
    <Tabs value={g} onChange={setG} color={PINK} items={[{ id: "ready", label: "Is my child ready?" }, { id: "methods", label: "Methods & plan" }, { id: "tips", label: "Tips & tricks" }, { id: "help", label: "Problems" }, { id: "doctor", label: "When to call the doctor" }]} />
    {g === "ready" && <Card title={`Readiness check for ${kid.name}`}>
      <p className="mb-3 text-sm text-slate-600">Most children are ready somewhere between 18 months and 3 years — girls often a few months earlier than boys. Readiness matters more than age: a study of 400+ children found that starting intensive training before about 27 months didn't finish any sooner, it just took longer.</p>
      <div className="space-y-2">{READINESS.map((r) => { const on = ready.includes(r.id); return <label key={r.id} className={`flex cursor-pointer items-start gap-3 rounded-xl p-3 ring-1 ${on ? "bg-emerald-50 ring-emerald-200" : "bg-white ring-slate-200"}`}><input type="checkbox" checked={on} onChange={() => setReady(on ? ready.filter((x) => x !== r.id) : [...ready, r.id])} className="mt-1 h-5 w-5 accent-emerald-600" /><span><b>{r.sign}</b><span className="block text-xs text-slate-500">{r.why}</span></span></label>; })}</div>
      <div className={`mt-4 rounded-2xl p-4 ${v.tone === "go" ? "bg-emerald-50" : v.tone === "soon" ? "bg-amber-50" : "bg-slate-50"}`}><p className="text-lg font-black">{ready.length} of {READINESS.length} — {v.title}</p><p className="text-sm text-slate-700">{v.text}</p></div>
    </Card>}
    {g === "methods" && <>
      <div className="grid gap-3 lg:grid-cols-2">{METHODS.map((m) => <Card key={m.id} tint={m.id === method.id ? "#fdf2f8" : undefined} title={<span>{m.name}<span className="block text-xs font-normal text-slate-500">{m.also}</span></span>} right={m.id === method.id ? <span className="rounded-full bg-pink-600 px-2 py-0.5 text-xs font-bold text-white">{kid.name}'s plan</span> : <Btn onClick={() => setMethod(m.id)}>Use this</Btn>}>
        <p className="text-sm">{m.summary}</p><p className="mt-2 text-xs"><b>Best for:</b> {m.bestFor}</p><p className="mt-1 text-xs text-slate-600"><b>What the research says:</b> {m.evidence}</p>
      </Card>)}</div>
      <Card title={`${kid.name}'s plan: ${method.name}`}>
        <ol className="space-y-2">{method.steps.map((s, i) => { const k = `step:${method.id}:${i}`; const on = plan.includes(k); return <li key={k}><label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={on} onChange={() => setPlan(on ? plan.filter((x) => x !== k) : [...plan, k])} className="mt-1 h-5 w-5 accent-pink-600" /><span className={on ? "text-slate-400 line-through" : ""}><b className="text-pink-700">{i + 1}.</b> {s}</span></label></li>; })}</ol>
        {method.plan && <div className="mt-4 grid gap-3 sm:grid-cols-3">{method.plan.map((d) => <div key={d.day} className="rounded-2xl bg-slate-50 p-3"><p className="mb-2 font-black">{d.day}</p>{d.tasks.map((task) => { const k = `plan:${method.id}:${d.day}:${task}`; const on = plan.includes(k); return <label key={k} className="flex items-start gap-2 py-0.5 text-sm"><input type="checkbox" checked={on} onChange={() => setPlan(on ? plan.filter((x) => x !== k) : [...plan, k])} className="mt-0.5 accent-pink-600" /><span className={on ? "text-slate-400 line-through" : ""}>{task}</span></label>; })}</div>)}</div>}
        <Btn className="mt-3" onClick={() => setPlan(plan.filter((x) => !x.includes(`:${method.id}:`)))}><RotateCcw size={14} />Clear checkmarks</Btn>
      </Card>
    </>}
    {g === "tips" && <div className="grid gap-3 md:grid-cols-2">{TIPS.map((t) => <Card key={t.title} title={t.title}><ul className="space-y-1.5 text-sm">{t.items.map((x) => <li key={x} className="flex gap-2"><Check size={15} className="mt-0.5 shrink-0 text-pink-600" />{x}</li>)}</ul></Card>)}</div>}
    {g === "help" && <div className="space-y-3">{TROUBLE.map((t) => <details key={t.problem} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200"><summary className="cursor-pointer font-black">{t.problem}</summary><ul className="mt-2 space-y-1.5 text-sm">{t.help.map((x) => <li key={x}>• {x}</li>)}</ul></details>)}</div>}
    {g === "doctor" && <Card title="Call your pediatrician if…" tint="#fff1f2"><ul className="space-y-2">{DOCTOR.map((d) => <li key={d} className="flex gap-2"><span>🩺</span>{d}</li>)}</ul><p className="mt-3 text-xs text-slate-500">This guide is general information, not medical advice. Your child's doctor knows your child best.</p></Card>}
    <Card title="Where this comes from"><ul className="space-y-1 text-sm">{SOURCES.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer" className="text-pink-700 underline">{s.title}</a></li>)}</ul></Card>
  </div>;
}
