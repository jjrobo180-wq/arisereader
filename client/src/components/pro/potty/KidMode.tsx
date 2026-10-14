// What the child sees: the sit timer (a countdown with a potty video or bubbles), the celebration
// with a sticker to pick, and the full-screen "potty time" reminder.
import { useEffect, useMemo, useState } from "react";
import { FullScreen, Ring, beep, chime, fmtDuration, randInt, useTick, useWakeLock, vibrate } from "../kit";
import { STICKERS, VIDEOS, ytEmbed, type Child } from "@shared/pro/potty";
import { C, Confetti, FONT_HEAD, PottyStyles, notify, say } from "./theme";

const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1);

export function SitTimer({ kid, seconds, voice, videoYt, onEnd, onClose }: { kid: Child; seconds: number; voice: boolean; videoYt: string; onEnd: (r: "pee" | "poop" | "both" | "try") => void; onClose: () => void }) {
  const [endAt] = useState(() => Date.now() + seconds * 1000); const [over, setOver] = useState(false);
  useTick(!over, 250); useWakeLock(true);
  const left = Math.max(0, (endAt - Date.now()) / 1000);
  useEffect(() => { say(`${kid.words.potty[0].toUpperCase()}${kid.words.potty.slice(1)} time, ${kid.name}! Sit and relax.`, voice); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!over && left <= 0) { setOver(true); chime(); say("All done! Did anything come out?", voice); } }, [left, over, voice]);
  const video = videoYt ? VIDEOS.find((v) => v.yt === videoYt) || { yt: videoYt } : null;
  const bubbles = useMemo(() => Array.from({ length: 14 }, (_, i) => ({ i, left: 4 + randInt(92), size: 22 + randInt(48), delay: Math.random() * 6, dur: 5 + Math.random() * 4 })), []);
  return <FullScreen bg={`linear-gradient(180deg, #2E6FD8, ${C.night})`} onClose={onClose}>
    <PottyStyles />
    {!video && !over && <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">{bubbles.map((b) => <span key={b.i} className="absolute bottom-0 rounded-full border-2 border-white/70 bg-white/15" style={{ left: `${b.left}%`, width: b.size, height: b.size, animation: `pt-rise ${b.dur}s ease-in ${b.delay}s infinite` }} />)}</div>}
    <div className="potty-kid relative z-10 flex w-full max-w-3xl flex-col items-center px-4 text-center" style={{ fontFamily: FONT_HEAD }}>
      {!over ? <>
        {video ? <div className="mb-4 aspect-video w-full overflow-hidden rounded-3xl bg-black shadow-2xl"><iframe title="Potty video" src={ytEmbed(video, true)} className="h-full w-full" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen /></div>
          : <span className="pt-bob text-8xl">{kid.avatar}</span>}
        <div className="flex items-center gap-5">
          <Ring value={left} max={seconds} size={video ? 120 : 210} color={C.duck} stroke={video ? 10 : 16}><p className={`font-black tabular-nums text-white ${video ? "text-3xl" : "text-6xl"}`}>{fmtDuration(left)}</p></Ring>
          {video && <p className="max-w-xs text-left text-2xl font-extrabold">Sit and relax, {kid.name}</p>}
        </div>
        {!video && <><p className="mt-3 text-3xl font-extrabold">Sit and relax, {kid.name}</p><p className="mt-1 text-lg opacity-90">Big breaths… blow like bubbles 🫧</p></>}
        <button type="button" onClick={() => setOver(true)} className="mt-6 rounded-full bg-white/20 px-6 py-3 text-lg font-bold hover:bg-white/30">Something came out!</button>
      </> : <>
        <p className="text-4xl font-extrabold">Did anything come out?</p>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{([["pee", "💧", cap(kid.words.pee)], ["poop", "💩", cap(kid.words.poop)], ["both", "🌟", "Both!"], ["try", "🪑", "Not this time"]] as const).map(([k, e, l]) => <button key={k} type="button" onClick={() => onEnd(k)} className="flex h-36 w-36 flex-col items-center justify-center rounded-[28px] bg-white text-slate-900 shadow-xl transition hover:scale-105"><span className="text-6xl">{e}</span><span className="mt-1 text-lg font-extrabold">{l}</span></button>)}</div>
      </>}
    </div>
  </FullScreen>;
}

export function Celebrate({ kid, voice, title, onPick, onClose }: { kid: Child; voice: boolean; title: string; onPick: (s: string) => void; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const choices = useMemo(() => [...STICKERS].sort(() => Math.random() - 0.5).slice(0, 8), []);
  useEffect(() => { chime(); vibrate([80, 60, 80]); say(`Hooray, ${kid.name}! ${title}! Pick a sticker!`, voice); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <FullScreen bg={`radial-gradient(circle at 50% 30%, #3B4A9A, ${C.night} 70%)`} onClose={onClose}>
    <PottyStyles /><Confetti />
    <div className="potty-kid relative z-10 flex flex-col items-center px-4 text-center" style={{ fontFamily: FONT_HEAD }}>
      <span className="pt-bob text-8xl">{kid.avatar}</span>
      <p className="mt-2 text-5xl font-extrabold" style={{ color: C.duck }}>Hooray, {kid.name}!</p>
      <p className="mt-1 text-2xl font-bold">{title}</p>
      {!picked ? <><p className="mt-7 text-xl font-bold opacity-90">Pick a sticker</p>
        <div className="mt-3 grid grid-cols-4 gap-3">{choices.map((s) => <button key={s} type="button" aria-label={`Sticker ${s}`} onClick={() => { setPicked(s); onPick(s); beep(1200, 110); say("Great choice!", voice); window.setTimeout(onClose, 1600); }} className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white text-5xl shadow-lg transition hover:scale-110 active:scale-95 sm:h-24 sm:w-24">{s}</button>)}</div></>
        : <span className="pt-pop mt-6 text-[9rem] leading-none">{picked}</span>}
    </div>
  </FullScreen>;
}

export function Alert({ kid, voice, onAnswer, onClose }: { kid: Child; voice: boolean; onAnswer: (a: "sit" | "went" | "tried" | "accident" | "snooze") => void; onClose: () => void }) {
  useEffect(() => {
    const ring = () => { chime(); vibrate([200, 100, 200]); say(`${kid.words.potty[0].toUpperCase()}${kid.words.potty.slice(1)} time, ${kid.name}!`, voice); };
    ring(); notify("Potty time!", `Time for ${kid.name} to try the potty.`);
    const t = window.setInterval(ring, 25_000); return () => window.clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <FullScreen bg={`linear-gradient(160deg, ${C.duck}, #FF9F5A)`} onClose={onClose}>
    <PottyStyles />
    <div className="potty-kid flex flex-col items-center px-4 text-center" style={{ fontFamily: FONT_HEAD, color: C.ink }}>
      <span className="pt-bob text-8xl">🚽</span><p className="mt-3 text-5xl font-extrabold">Potty time, {kid.name}!</p>
      <div className="mt-8 grid w-full max-w-lg grid-cols-2 gap-3">
        <button type="button" onClick={() => onAnswer("sit")} className="col-span-2 rounded-2xl py-4 text-xl font-extrabold text-white" style={{ background: C.ink }}>Start the sit timer</button>
        <button type="button" onClick={() => onAnswer("went")} className="rounded-2xl bg-white py-3 font-bold">💧 Went in the potty</button>
        <button type="button" onClick={() => onAnswer("tried")} className="rounded-2xl bg-white py-3 font-bold">🪑 Tried</button>
        <button type="button" onClick={() => onAnswer("accident")} className="rounded-2xl bg-white/50 py-3 font-bold">💦 Had an accident</button>
        <button type="button" onClick={() => onAnswer("snooze")} className="rounded-2xl bg-white/50 py-3 font-bold">⏰ 5 more minutes</button>
      </div>
    </div>
  </FullScreen>;
}
