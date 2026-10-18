// Animal Splash — eye-gazer voice game in a 3D pond.
// Pick a real animal photo (look, tap or drag it up), it splashes into the pond, then say what animal it is
// (or choose a big answer button). Every animal you name joins your pond.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Mic, MicOff, RotateCcw, Settings, Volume2, X } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import { useAuth } from "@/context/AuthContext";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { speakCharacterAI, stopSpeaking } from "@/lib/tts";
import { ANIMALS, answerChoices, isCorrectAnswer, namesOtherAnimal, pageUrl, photoUrls, type Animal } from "@shared/splash/animals";
import { PondScene, loadPhoto, type Quality } from "@/game/splash/scene";
import { SplashAudio } from "@/game/splash/audio";

type Status = "pick" | "flying" | "ask" | "listening" | "correct" | "wrong" | "finished";
type Settings = { talk: boolean; choices: number; voice: boolean; facts: boolean; dwell: boolean; music: number; sfx: number; quality: Quality };
const coarse = () => !!window.matchMedia?.("(pointer: coarse)").matches && !window.matchMedia?.("(pointer: fine)").matches;
const DEFAULTS = (): Settings => ({ talk: true, choices: 3, voice: true, facts: true, dwell: !coarse(), music: 0.4, sfx: 0.9, quality: "medium" });
const key = (uid: unknown, what: string) => `arise-animal-splash-v2:${what}:${uid ?? "guest"}`;
const load = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? { ...d, ...JSON.parse(v) } : d; } catch { return d; } };
const save = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };
const an = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");
type Recognition = { lang: string; interimResults: boolean; continuous: boolean; maxAlternatives: number; start(): void; stop(): void; abort?: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null; onerror: ((e: { error?: string }) => void) | null; onend: (() => void) | null };
const RecognitionCtor = (): (new () => Recognition) | null => { const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition }; return w.SpeechRecognition || w.webkitSpeechRecognition || null; };

const CSS = `
.as-font{font-family:ui-rounded,"SF Pro Rounded","Nunito","Segoe UI",system-ui,sans-serif}
.as-title{text-shadow:0 3px 0 #0b3a5a,0 8px 22px rgba(0,40,80,.35)}
.as-up{animation:asUp .45s cubic-bezier(.2,1.2,.4,1) both}@keyframes asUp{from{transform:translateY(30px);opacity:0}to{transform:none;opacity:1}}
.as-pop{animation:asPop .5s cubic-bezier(.2,1.6,.4,1) both}@keyframes asPop{from{transform:scale(.5);opacity:0}to{transform:scale(1);opacity:1}}
.as-pulse{animation:asPulse 1.1s ease-in-out infinite}@keyframes asPulse{0%,100%{box-shadow:0 0 0 0 rgba(244,63,94,.55)}50%{box-shadow:0 0 0 16px rgba(244,63,94,0)}}
.as-wave span{display:inline-block;width:5px;margin:0 2px;border-radius:9px;background:currentColor;animation:asWave .9s ease-in-out infinite}
.as-wave span:nth-child(2){animation-delay:.15s}.as-wave span:nth-child(3){animation-delay:.3s}.as-wave span:nth-child(4){animation-delay:.45s}
@keyframes asWave{0%,100%{height:6px}50%{height:22px}}
.as-tray::-webkit-scrollbar{height:10px}.as-tray::-webkit-scrollbar-thumb{background:rgba(255,255,255,.55);border-radius:9px}
`;

/** Real photo with automatic fallbacks (second URL, then a friendly emoji tile). */
function Photo({ a, className = "" }: { a: Animal; className?: string }) {
  const urls = useMemo(() => photoUrls(a, 330), [a]); const [i, setI] = useState(0);
  if (i >= urls.length) return <div className={"grid place-items-center text-6xl " + className} style={{ background: `linear-gradient(#fff,#${a.color.toString(16).padStart(6, "0")})` }}>{a.emoji}</div>;
  return <img src={urls[i]} alt={`A real ${a.name}`} draggable={false} onError={() => setI(i + 1)} className={"object-cover " + className} />;
}

function speakThen(text: string, voice: boolean, onEnd?: () => void) {
  if (!voice) { if (onEnd) window.setTimeout(onEnd, 500 + text.length * 35); return; }
  let fell = false, ended = false; const end = () => { if (ended) return; ended = true; onEnd?.(); };
  const guard = window.setTimeout(end, 4000 + text.length * 90); // never get stuck if a voice never reports finishing
  void speakCharacterAI(text, { calmMode: false, onEnd: () => { if (!fell) { window.clearTimeout(guard); end(); } }, onFallback: () => {
    fell = true;
    try { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 0.92; u.pitch = 1.08; u.onend = () => { window.clearTimeout(guard); end(); }; window.speechSynthesis.speak(u); } catch { window.clearTimeout(guard); end(); }
  } });
}

export default function AnimalSplashGame({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useState<Settings>(() => load(key(uid, "settings"), DEFAULTS()));
  const [collected, setCollected] = useState<string[]>(() => load<{ ids: string[] }>(key(uid, "pond"), { ids: [] }).ids.filter(id => ANIMALS.some(a => a.id === id)));
  const [status, setStatus] = useState<Status>(() => (collected.length >= ANIMALS.length ? "finished" : "pick"));
  const [active, setActive] = useState<Animal | null>(null);
  const [message, setMessage] = useState("Pick an animal to splash into the pond!");
  const [heard, setHeard] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [micOk, setMicOk] = useState(() => !!RecognitionCtor());
  const [drag, setDrag] = useState<{ id: string; x: number; y: number; over: boolean } | null>(null);
  const [panel, setPanel] = useState<"settings" | "credits" | null>(null);
  const [failed, setFailed] = useState(false);
  const host = useRef<HTMLDivElement>(null); const scene = useRef<PondScene | null>(null);
  const audio = useRef<SplashAudio | null>(null); if (!audio.current) audio.current = new SplashAudio();
  const rec = useRef<Recognition | null>(null); const listenTimer = useRef(0); const statusRef = useRef(status); statusRef.current = status;
  const sRef = useRef(settings); sRef.current = settings;
  const startPt = useRef<{ x: number; y: number; id: string; pid: number } | null>(null);

  const remaining = ANIMALS.filter(a => !collected.includes(a.id));
  useEffect(() => { save(key(uid, "settings"), settings); audio.current!.setVolumes(settings.music, settings.sfx); }, [settings, uid]);
  useEffect(() => { save(key(uid, "pond"), { ids: collected }); }, [collected, uid]);

  // the 3D pond (rebuilt only when graphics quality changes)
  useEffect(() => {
    const el = host.current; if (!el) return;
    let s: PondScene | null = null;
    try { s = new PondScene(el, settings.quality); scene.current = s; s.onSound = n => audio.current!.play(n); }
    catch (e) { console.error(e); setFailed(true); }
    if (s) collected.forEach((id, i) => { const a = ANIMALS.find(x => x.id === id); if (a) void s!.placeDocked(a, i); });
    if (s && collected.length >= ANIMALS.length) s.finale();
    ANIMALS.forEach(a => void loadPhoto(a)); // warm the photos
    return () => { s?.dispose(); scene.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality]);
  useEffect(() => () => { stopListening(); stopSpeaking(); audio.current?.dispose(); }, []);

  const sfx = (n: string) => { audio.current!.ensure(); audio.current!.play(n); };
  const startMusic = () => { audio.current!.ensure(); audio.current!.startMusic(); };
  const stopListening = () => { window.clearTimeout(listenTimer.current); try { rec.current?.abort?.(); rec.current?.stop(); } catch { /* already stopped */ } rec.current = null; };

  const finishRound = useCallback((a: Animal) => {
    window.setTimeout(() => {
      const slot = collected.length;
      scene.current?.dock(slot);
      const next = [...collected, a.id]; setCollected(next); setActive(null); setHeard("");
      if (next.length >= ANIMALS.length) {
        window.setTimeout(() => { setStatus("finished"); setMessage("Your pond is full of friends!"); scene.current?.finale(); audio.current!.play("finale"); celebrateEyeGaze(false); speakThen("Amazing! You named every animal. Your pond is full of friends! Hooray!", sRef.current.voice); }, 1400);
      } else { setStatus("pick"); setMessage("Great job! Pick another animal."); }
    }, 500);
  }, [collected]);

  const correct = useCallback((a: Animal) => {
    stopListening(); setStatus("correct"); setMessage(`Yes! It's ${an(a.name)} ${a.name}!`);
    scene.current?.celebrate(); sfx("correct"); celebrateEyeGaze(false); navigator.vibrate?.(60);
    const s = sRef.current;
    speakThen(`Hooray! Yes! That's ${an(a.name)} ${a.name}!${s.facts ? " " + a.fact : ""}`, s.voice, () => finishRound(a));
  }, [finishRound]);
  const wrong = useCallback((a: Animal) => {
    stopListening(); setStatus("wrong"); setMessage(`Good try! This is ${an(a.name)} ${a.name}.`);
    scene.current?.gentle(); sfx("gentle");
    speakThen(`Good try. This animal is ${an(a.name)} ${a.name}. Say ${a.name}!`, sRef.current.voice, () => window.setTimeout(() => finishRound(a), 700));
  }, [finishRound]);

  const listen = useCallback((a: Animal) => {
    const R = RecognitionCtor();
    if (!R || !sRef.current.talk) { setMicOk(!!R); setStatus("ask"); setMessage(sRef.current.talk ? "Choose the animal's name." : "What animal is it? Choose a button."); return; }
    stopListening(); setStatus("listening"); setHeard(""); setMessage("I'm listening… what animal is it?"); sfx("listen");
    try {
      const r = new R(); r.lang = "en-US"; r.interimResults = true; r.continuous = false; r.maxAlternatives = 5; rec.current = r;
      r.onresult = e => {
        const all: string[] = []; let final = false;
        for (let i = 0; i < e.results.length; i++) { const res = e.results[i]; final ||= res.isFinal; for (let j = 0; j < res.length; j++) all.push(String(res[j].transcript || "")); }
        setHeard(all[0] || "");
        if (all.some(t => isCorrectAnswer(t, a))) { correct(a); return; }
        if (!final) return;
        if (all.some(t => namesOtherAnimal(t, a))) { wrong(a); return; }
        stopListening(); setStatus("ask"); setMessage("I didn't catch that. Say it again, or choose a button.");
      };
      r.onerror = ev => { if (statusRef.current !== "listening") return; if (ev?.error === "not-allowed" || ev?.error === "service-not-allowed") { setMicOk(false); setMessage("The microphone is off. Choose the animal's name."); } else setMessage("I didn't hear an answer. Say it again, or choose a button."); setStatus("ask"); };
      r.onend = () => { rec.current = null; if (statusRef.current === "listening") { setStatus("ask"); setMessage("Say it again, or choose a button."); } };
      r.start();
      listenTimer.current = window.setTimeout(() => { if (statusRef.current === "listening") { stopListening(); setStatus("ask"); setMessage("Say it again, or choose a button."); } }, 7500);
    } catch { setMicOk(false); setStatus("ask"); setMessage("Choose the animal's name."); }
  }, [correct, wrong]);

  const ask = useCallback((a: Animal) => {
    setStatus("ask"); setMessage("What animal is it?");
    speakThen("What animal is it?", sRef.current.voice, () => { if (statusRef.current === "ask") window.setTimeout(() => listen(a), 200); });
  }, [listen]);

  const launch = useCallback((a: Animal, from?: { x: number; y: number }) => {
    if (statusRef.current !== "pick" || !scene.current) return;
    startMusic(); sfx("pick"); stopSpeaking();
    setActive(a); setStatus("flying"); setMessage("SPLASH!"); setHeard(""); setChoices(answerChoices(a, sRef.current.choices));
    void scene.current.launch(a, from).then(() => ask(a));
  }, [ask]);

  const choose = (name: string) => {
    const a = active; if (!a || (statusRef.current !== "ask" && statusRef.current !== "listening")) return;
    setHeard(name);
    if (isCorrectAnswer(name, a)) correct(a); else wrong(a);
  };

  // drag a photo up into the water (touch or mouse); a plain tap/click launches it straight away
  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => { const over = !!scene.current?.isOverPond(e.clientX, e.clientY); setDrag(d => (d ? { ...d, x: e.clientX, y: e.clientY, over } : d)); };
    const up = (e: PointerEvent) => { const d = drag; setDrag(null); const a = ANIMALS.find(x => x.id === d.id); if (a && scene.current?.isOverPond(e.clientX, e.clientY)) launch(a, { x: e.clientX, y: e.clientY }); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", up); window.addEventListener("pointercancel", () => setDrag(null));
    return () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
  }, [drag?.id, launch]);
  const trayDown = (e: React.PointerEvent, a: Animal) => { if (statusRef.current !== "pick") return; startPt.current = { x: e.clientX, y: e.clientY, id: a.id, pid: e.pointerId }; };
  const trayMove = (e: React.PointerEvent) => {
    const s = startPt.current; if (!s || drag || e.pointerId !== s.pid) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (dy < -22 && Math.abs(dy) > Math.abs(dx)) { setDrag({ id: s.id, x: e.clientX, y: e.clientY, over: false }); startPt.current = null; }
  };

  const restart = () => { stopListening(); stopSpeaking(); scene.current?.reset(); setCollected([]); setActive(null); setStatus("pick"); setHeard(""); setMessage("Pick an animal to splash into the pond!"); sfx("pick"); };
  const D = settings.dwell; const hover = () => sfx("hover");
  const answering = status === "ask" || status === "listening";

  return (
    <main className="as-font fixed inset-0 z-[120] h-[100dvh] select-none overflow-hidden bg-sky-200 text-slate-950">
      <style>{CSS}</style>
      <div ref={host} className="absolute inset-0" style={failed ? { background: "linear-gradient(#9be3ff,#cff3ff 45%,#7ed07a 46%,#2f8fc0 70%)" } : undefined} />

      {/* top bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-start gap-2 p-2 sm:p-3" style={{ paddingTop: "max(.5rem, env(safe-area-inset-top))" }}>
        <GazeButton dwell={D} onHover={hover} onSelect={() => { stopListening(); stopSpeaking(); onBack(); }} className="pointer-events-auto flex min-h-12 items-center gap-2 rounded-2xl bg-white/90 px-4 font-black shadow-lg backdrop-blur" label="Back to games"><ArrowLeft className="h-5 w-5" /><span className="hidden sm:inline">Games</span></GazeButton>
        <div className="pointer-events-auto mx-auto flex min-w-0 items-center gap-3 rounded-2xl bg-white/90 px-3 py-1.5 shadow-lg backdrop-blur sm:px-4">
          <div className="hidden min-w-0 sm:block"><p className="text-[10px] font-black uppercase tracking-[.22em] text-sky-700">Eye Gazer · Voice Play</p><h1 className="truncate text-lg font-black leading-tight sm:text-xl">Animal Splash</h1></div>
          <div className="text-center"><div className="text-xl font-black tabular-nums text-sky-700 sm:text-2xl">{collected.length}<span className="text-sm text-slate-400">/{ANIMALS.length}</span></div><div className="-mt-1 text-[9px] font-black uppercase tracking-wider text-slate-500">in your pond</div></div>
          <div className="hidden h-9 items-center gap-0.5 md:flex">{ANIMALS.map(a => <span key={a.id} title={a.name} className={"grid h-7 w-7 place-items-center rounded-full text-base transition " + (collected.includes(a.id) ? "bg-sky-100 scale-100" : "bg-slate-100 opacity-30 grayscale scale-90")}>{a.emoji}</span>)}</div>
        </div>
        <GazeButton dwell={D} onHover={hover} onSelect={() => { sfx("pick"); setPanel("settings"); }} className="pointer-events-auto grid h-12 w-12 place-items-center rounded-2xl bg-white/90 shadow-lg backdrop-blur" label="Settings"><Settings className="h-5 w-5" /></GazeButton>
      </header>

      {/* speech bubble */}
      {status !== "finished" && <div className="pointer-events-none absolute inset-x-0 top-[4.6rem] flex justify-center px-3 sm:top-20">
        <div key={message} className="as-pop flex max-w-xl items-center gap-3 rounded-[1.6rem] border-4 border-white bg-white/95 px-4 py-2.5 shadow-xl sm:px-5">
          <span className={"grid h-11 w-11 shrink-0 place-items-center rounded-full " + (status === "listening" ? "as-pulse bg-rose-500 text-white" : status === "correct" ? "bg-emerald-500 text-white" : "bg-sky-100 text-sky-700")}>
            {status === "listening" ? <span className="as-wave flex items-center text-white"><span /><span /><span /><span /></span> : status === "ask" && !micOk ? <MicOff className="h-5 w-5" /> : status === "correct" ? "✓" : <Volume2 className="h-5 w-5" />}
          </span>
          <div className="min-w-0"><p className="text-lg font-black leading-snug sm:text-2xl">{message}</p>{heard && <p className="truncate text-sm font-bold text-slate-500">I heard: “{heard}”</p>}</div>
        </div>
      </div>}

      {/* photo tray */}
      <section className={"absolute inset-x-0 bottom-0 transition-transform duration-500 " + (status === "pick" ? "translate-y-0" : "translate-y-[110%]")} style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-2 rounded-[1.8rem] border-4 border-white/80 bg-white/75 p-2 shadow-2xl backdrop-blur-md sm:mx-4">
          <p className="px-2 pb-1 text-center text-xs font-black uppercase tracking-[.18em] text-sky-800">{D ? "Look at an animal · tap it · or drag it up into the water" : "Tap an animal · or drag it up into the water"}</p>
          <div className="as-tray flex gap-2 overflow-x-auto pb-1" style={{ touchAction: "pan-x" }}>
            {remaining.map(a => (
              <div key={a.id} onPointerDown={e => trayDown(e, a)} onPointerMove={trayMove} onPointerUp={() => { startPt.current = null; }} className="shrink-0">
                <GazeButton dwell={D} onHover={hover} disabled={status !== "pick"} onSelect={() => { const el = document.getElementById("as-card-" + a.id)?.getBoundingClientRect(); launch(a, el ? { x: el.left + el.width / 2, y: el.top + el.height / 2 } : undefined); }}
                  label={`Splash a mystery animal`} className="group block h-[7.5rem] w-[7.5rem] rounded-[1.4rem] border-4 border-white bg-white shadow-lg sm:h-36 sm:w-36 md:h-40 md:w-40">
                  <span id={"as-card-" + a.id} className="absolute inset-0"><Photo a={a} className="h-full w-full" /></span>
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent pb-1.5 pt-6 text-center text-[10px] font-black uppercase tracking-widest text-white">💦 Splash!</span>
                </GazeButton>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* answer panel */}
      {active && answering && <section className="as-up absolute inset-x-0 bottom-0 px-2 sm:px-4" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto max-w-3xl rounded-[2rem] border-4 border-white bg-white/95 p-3 shadow-2xl sm:p-4">
          <div className="flex items-center gap-2">
            <p className="flex-1 text-center text-xs font-black uppercase tracking-[.2em] text-sky-700">{settings.talk && micOk ? "Say it out loud — or choose" : "Choose the animal"}</p>
          </div>
          <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${choices.length}, minmax(0,1fr))` }}>
            {choices.map(c => <GazeButton key={c} dwell={D} onHover={hover} onSelect={() => choose(c)} className="min-h-[4.5rem] rounded-2xl border-4 border-sky-100 bg-sky-50 px-2 text-xl font-black capitalize text-slate-900 shadow sm:min-h-20 sm:text-2xl">{c}</GazeButton>)}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <GazeButton dwell={D} onHover={hover} onSelect={() => speakThen("What animal is it?", settings.voice)} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-100 font-black"><Volume2 className="h-5 w-5" />Hear it again</GazeButton>
            {settings.talk && micOk ? <GazeButton dwell={D} onHover={hover} disabled={status === "listening"} onSelect={() => active && listen(active)} className={"flex min-h-12 items-center justify-center gap-2 rounded-2xl font-black " + (status === "listening" ? "bg-rose-500 text-white" : "bg-rose-100 text-rose-700")}><Mic className="h-5 w-5" />{status === "listening" ? "Listening…" : "Talk again"}</GazeButton>
              : <div className="grid min-h-12 place-items-center rounded-2xl bg-slate-50 text-xs font-bold text-slate-500">{settings.talk ? "Talking isn't available here" : "Buttons only"}</div>}
          </div>
        </div>
      </section>}

      {/* drag ghost */}
      {drag && <div className="pointer-events-none fixed inset-0 z-[5]">
        <div className={"fixed h-32 w-32 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[1.6rem] border-[6px] shadow-2xl transition-transform " + (drag.over ? "scale-110 border-sky-300" : "border-white")} style={{ left: drag.x, top: drag.y }}>{(() => { const a = ANIMALS.find(x => x.id === drag.id)!; return <Photo a={a} className="h-full w-full" />; })()}</div>
        <p className="fixed left-1/2 top-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-sm font-black text-sky-800 shadow">{drag.over ? "Let go to SPLASH! 💦" : "Bring it to the water"}</p>
      </div>}

      {/* finale */}
      {status === "finished" && <div className="as-pop absolute inset-x-0 bottom-0 flex justify-center p-3" style={{ paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}>
        <div className="w-full max-w-lg rounded-[2rem] border-4 border-white bg-white/95 p-5 text-center shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[.25em] text-sky-700">All {ANIMALS.length} animals</p>
          <h2 className="as-title mt-1 text-4xl font-black text-sky-600 sm:text-5xl">Your pond is full!</h2>
          <p className="mt-2 text-lg font-bold text-slate-600">You splashed and named every animal. 🎉</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <GazeButton dwell={D} onHover={hover} onSelect={restart} className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-sky-500 text-lg font-black text-white shadow-lg"><RotateCcw className="h-5 w-5" />Play again</GazeButton>
            <GazeButton dwell={D} onHover={hover} onSelect={() => { stopSpeaking(); onBack(); }} className="min-h-16 rounded-2xl bg-slate-100 text-lg font-black">Back to games</GazeButton>
          </div>
        </div>
      </div>}

      {failed && <div className="absolute inset-x-0 top-1/3 text-center text-sm font-bold text-white drop-shadow">3D pond unavailable on this device — the game still works.</div>}

      {panel === "settings" && <div className="absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm" onClick={() => setPanel(null)}>
        <div className="as-pop my-auto w-full max-w-md rounded-[2rem] bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="mb-2 flex items-center"><h2 className="flex-1 text-2xl font-black">Settings</h2><button type="button" onClick={() => setPanel(null)} className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
          {([
            ["How to answer", "talk", [[true, "🎤 Talk + buttons"], [false, "👆 Buttons only"]]],
            ["Answer buttons", "choices", [[2, "2"], [3, "3"], [4, "4"]]],
            ["Spoken prompts", "voice", [[true, "🗣️ On"], [false, "Off"]]],
            ["Fun animal facts", "facts", [[true, "On"], [false, "Off"]]],
            ["Look to press buttons", "dwell", [[true, "On"], [false, "Off"]]],
            ["Graphics", "quality", [["low", "Low"], ["medium", "Medium"], ["high", "High"]]],
          ] as [string, keyof Settings, [Settings[keyof Settings], string][]][]).map(([title, k, opts]) => (
            <div key={k} className="mt-3"><p className="mb-1 text-xs font-black uppercase tracking-widest text-slate-500">{title}</p>
              <div className="grid gap-1.5 rounded-2xl bg-slate-100 p-1.5" style={{ gridTemplateColumns: `repeat(${opts.length},minmax(0,1fr))` }}>
                {opts.map(([v, label]) => <GazeButton key={String(v)} dwell={D} ms={900} onHover={hover} onSelect={() => setSettings(s => ({ ...s, [k]: v }))} className={"min-h-11 rounded-xl text-sm font-black " + (settings[k] === v ? "bg-sky-500 text-white shadow" : "text-slate-700")}>{label}</GazeButton>)}
              </div></div>))}
          <label className="mt-4 flex items-center gap-3 text-sm font-black"><span className="w-16">Music</span><input type="range" min={0} max={1} step={0.05} value={settings.music} onChange={e => setSettings(s => ({ ...s, music: +e.target.value }))} className="h-8 flex-1 accent-sky-500" /></label>
          <label className="flex items-center gap-3 text-sm font-black"><span className="w-16">Sounds</span><input type="range" min={0} max={1} step={0.05} value={settings.sfx} onChange={e => setSettings(s => ({ ...s, sfx: +e.target.value }))} className="h-8 flex-1 accent-sky-500" /></label>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <GazeButton dwell={D} onHover={hover} onSelect={() => { setPanel(null); restart(); }} className="flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-100 font-black"><RotateCcw className="h-4 w-4" />Empty the pond</GazeButton>
            <GazeButton dwell={D} onHover={hover} onSelect={() => setPanel("credits")} className="min-h-12 rounded-2xl bg-slate-100 font-black">Photo credits</GazeButton>
          </div>
          <GazeButton dwell={D} onHover={hover} onSelect={() => setPanel(null)} className="mt-2 min-h-14 w-full rounded-2xl bg-sky-500 text-lg font-black text-white">Done</GazeButton>
        </div>
      </div>}
      {panel === "credits" && <div className="absolute inset-0 z-10 grid place-items-center overflow-y-auto bg-slate-900/50 p-3 backdrop-blur-sm" onClick={() => setPanel(null)}>
        <div className="as-pop my-auto w-full max-w-lg rounded-[2rem] bg-white p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="mb-2 flex items-center"><h2 className="flex-1 text-2xl font-black">Photos & sounds</h2><button type="button" onClick={() => setPanel(null)} className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></button></div>
          <p className="text-sm font-bold text-slate-600">Real animal photographs come from Wikimedia Commons; tap a name to see the photo's page, author and license. The splash recording is public domain (Wikimedia Commons / PDSounds).</p>
          <ul className="mt-3 grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">{ANIMALS.map(a => <li key={a.id}><a href={pageUrl(a)} target="_blank" rel="noreferrer" className="font-bold text-sky-700 underline">{a.emoji} {a.credit}</a></li>)}</ul>
        </div>
      </div>}
    </main>
  );
}
