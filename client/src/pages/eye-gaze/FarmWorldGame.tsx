// Farm World — explore a big 3D farm as your own character, like A.R.I.S.E. City but with animals.
// Walk around (look-and-hold arrows, keys, tap or look at a spot), meet 30+ animals with their real sounds,
// feed them, climb on and ride horses, ponies, cows, pigs, sheep and goats, and find the golden horseshoes.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import StageShell, { Bubble, useStageSettings } from "@/components/eye-gaze/StageShell";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { celebrateEyeGaze } from "@/lib/eyeGazeCelebrate";
import { say, stopSpeaking } from "@/game/stage/voice";
import { FarmGame, type FarmHud } from "@/game/farm/game";
import { ANIMALS, EATS, FOOD, byId, soundUrl, type AnimalDef, type FoodType } from "@/game/farm/animals";
import { HORSESHOES, PLACES } from "@shared/farm/layout";

/** A look-and-hold control: it works for as long as you look at it (or press it). */
function Hold({ on, off, dwell, children, className, label }: { on: () => void; off: () => void; dwell: boolean; children: ReactNode; className: string; label: string }) {
  const timer = useRef(0); const [active, setActive] = useState(false);
  const start = () => { window.clearTimeout(timer.current); setActive(true); on(); };
  const stop = () => { window.clearTimeout(timer.current); setActive(false); off(); };
  useEffect(() => () => { window.clearTimeout(timer.current); }, []);
  return <button type="button" aria-label={label} className={className + (active ? " scale-95 ring-4 ring-amber-300" : "")}
    onPointerEnter={e => { if (dwell && e.pointerType !== "touch") { window.clearTimeout(timer.current); timer.current = window.setTimeout(start, 260); } }}
    onPointerLeave={stop} onPointerDown={e => { e.preventDefault(); start(); }} onPointerUp={e => { if (e.pointerType === "touch") stop(); }} onPointerCancel={stop}
    onContextMenu={e => e.preventDefault()}>{children}</button>;
}

export default function FarmWorldGame({ onBack }: { onBack: () => void }) {
  const { user, token } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useStageSettings(uid);
  const [lookWalk, setLookWalk] = useState(() => { try { return localStorage.getItem(`arise-farm-lookwalk:${uid ?? "guest"}`) !== "0"; } catch { return true; } });
  const shoeKey = `arise-farm-horseshoes:${uid ?? "guest"}`;
  const [found, setFound] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(shoeKey) || "[]"); } catch { return []; } });
  const [character, setCharacter] = useState<string | null>(null);
  const [ready, setReady] = useState(false); const [loaded, setLoaded] = useState(0);
  const [hud, setHud] = useState<FarmHud | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [panel, setPanel] = useState<null | "places" | "feed" | "pick-food" | "help">(null); const [placing, setPlacing] = useState<FoodType | null>(null);
  const [bubble, setBubble] = useState<{ text: string; icon?: string; tone?: "info" | "good" | "oops"; n: number } | null>(null);
  const host = useRef<HTMLDivElement>(null); const mapRef = useRef<HTMLCanvasElement>(null); const game = useRef<FarmGame | null>(null);
  const sRef = useRef(settings); sRef.current = settings;
  const sfx = useRef<HTMLAudioElement | null>(null); const sfxTimer = useRef(0); const bubbleTimer = useRef(0);
  const run = hud?.run ?? false;

  const toast = (text: string, icon?: string, tone: "info" | "good" | "oops" = "info", ms = 4200) => { window.clearTimeout(bubbleTimer.current); setBubble(b => ({ text, icon, tone, n: (b?.n ?? 0) + 1 })); bubbleTimer.current = window.setTimeout(() => setBubble(null), ms); };
  const stopSound = () => { window.clearTimeout(sfxTimer.current); if (sfx.current) { sfx.current.pause(); sfx.current = null; } };
  const playSound = (def: AnimalDef) => {
    stopSound(); const a = new Audio(soundUrl(def)); a.volume = Math.min(1, 0.25 + sRef.current.sfx * 0.75); sfx.current = a; let done = false;
    const fin = () => { if (done) return; done = true; window.clearTimeout(sfxTimer.current); if (sfx.current === a) { a.pause(); sfx.current = null; } };
    a.onended = fin; a.onerror = fin; void a.play().then(() => { sfxTimer.current = window.setTimeout(fin, def.soundSeconds * 1000); }).catch(fin);
  };
  const meet = (id: string, fact = false) => {
    const def = byId[id]; if (!def) return; setSelected(id); if (game.current) game.current.selected = id; game.current?.hop(id);
    toast(fact ? def.fact : `${def.name} says “${def.sound}!”`, def.emoji, "info", fact ? 7000 : 4200);
    stopSpeaking(); stopSound(); game.current?.audio.play("select");
    say(fact ? def.fact : def.name, sRef.current.voice, () => { if (!fact) playSound(def); }, true);
  };
  const meetRef = useRef(meet); meetRef.current = meet;

  // which character are you?
  useEffect(() => {
    let on = true; const fallback = window.setTimeout(() => { if (on) setCharacter(c => c ?? "robin-hood"); }, 3000);
    void fetch(API_BASE + "/api/avatar-world", { headers: { Authorization: "Bearer " + token }, cache: "no-store" }).then(r => r.ok ? r.json() : null).then(d => { if (on) setCharacter(d?.state?.selectedCharacter || "robin-hood"); }).catch(() => { if (on) setCharacter("robin-hood"); });
    return () => { on = false; window.clearTimeout(fallback); };
  }, [token]);
  useEffect(() => { game.current?.audio.setVolumes(settings.music, settings.sfx); if (game.current) { game.current.stage.dwell = settings.dwell; } }, [settings]);
  useEffect(() => { try { localStorage.setItem(`arise-farm-lookwalk:${uid ?? "guest"}`, lookWalk ? "1" : "0"); } catch { /* ignore */ } if (game.current) game.current.lookToWalk = lookWalk; }, [lookWalk, uid]);
  useEffect(() => { try { localStorage.setItem(shoeKey, JSON.stringify(found)); } catch { /* ignore */ } }, [found, shoeKey]);
  useEffect(() => { if (game.current) game.current.placing = placing; }, [placing]);

  useEffect(() => {
    const el = host.current; if (!el || !character) return;
    const g = new FarmGame(el, { quality: settings.quality, dwell: settings.dwell, characterId: character, found }, {
      onHud: h => setHud(h),
      onMeet: id => meetRef.current(id),
      onNote: (text, icon, tone) => toast(text, icon, tone),
      onHorseshoe: id => {
        setFound(f => { const n = f.includes(id) ? f : [...f, id]; const h = HORSESHOES.find(x => x.id === id);
          if (n.length === HORSESHOES.length) { toast("You found every golden horseshoe! You're a farm champion!", "🏆", "good", 7000); celebrateEyeGaze(false); say("You found every golden horseshoe! Amazing!", sRef.current.voice); }
          else toast(`Golden horseshoe ${h?.hint ?? ""}! ${n.length} of ${HORSESHOES.length}`, "🧲", "good"); return n; });
      },
    });
    game.current = g; g.lookToWalk = lookWalk; g.audio.setVolumes(settings.music, settings.sfx);
    const poll = window.setInterval(() => { setLoaded(g.loaded); if (g.ready) { setReady(true); } if (mapRef.current) g.drawMap(mapRef.current); }, 250);
    return () => { window.clearInterval(poll); g.dispose(); game.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality, character]);
  useEffect(() => { if (!ready) return; const a = game.current?.audio; if (!a) return; a.ensure(); a.startMusic(65, 76, "major", 11); a.setEnergy(0); toast("Welcome to the farm! Walk around, meet the animals and climb on a horse.", "🚜", "info", 6000); say("Welcome to the farm!", sRef.current.voice); }, [ready]);
  useEffect(() => () => { stopSpeaking(); stopSound(); window.clearTimeout(bubbleTimer.current); }, []);

  const sel = selected ? byId[selected] : null; const D = settings.dwell;
  const riding = hud?.riding ? byId[hud.riding] : null; const nearRide = hud?.nearRide ? byId[hud.nearRide] : null;
  const btn = "pointer-events-auto flex min-h-14 items-center justify-center gap-2 rounded-2xl px-3 text-base font-black shadow-xl backdrop-blur sm:px-4 sm:text-lg";
  const pad = "pointer-events-auto grid h-16 w-16 place-items-center rounded-2xl bg-white/90 text-3xl font-black shadow-xl backdrop-blur transition sm:h-[4.5rem] sm:w-[4.5rem]";
  const g = () => game.current;
  const go = (i: number) => { const p = PLACES[i]; setPanel(null); g()?.teleport(p.x, p.z, Math.PI); g()?.audio.play("whoosh", 4); toast(p.label, p.emoji, "info", 2400); };

  return (
    <StageShell title="Farm World" badge="🚜" accent="#16a34a" hostRef={host} settings={settings} onSettings={setSettings}
      onBack={() => { stopSpeaking(); stopSound(); g()?.audio.stopMusic(); onBack(); }}
      extraSettings={<div className="mt-3"><p className="mb-1.5 text-xs font-black uppercase tracking-widest text-slate-500">Look at the grass to walk there</p>
        <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-slate-100 p-1.5">{([[true, "On"], [false, "Off"]] as const).map(([v, l]) => <GazeButton key={l} dwell={D} ms={900} onSelect={() => setLookWalk(v)} className={"min-h-11 rounded-xl text-sm font-black " + (lookWalk === v ? "bg-emerald-600 text-white" : "text-slate-700")}>{l}</GazeButton>)}</div></div>}
      bubble={bubble ? <Bubble key={bubble.n} tone={bubble.tone} icon={bubble.icon}>{bubble.text}</Bubble> : placing ? <Bubble icon={FOOD[placing].emoji}>Look at the grass and hold still to put down {FOOD[placing].label.toLowerCase()}</Bubble> : undefined}
      progress={<span className="flex items-center gap-1 text-sm font-black text-amber-700">🧲 {found.length}/{HORSESHOES.length}</span>}>
      {(!ready || !character) && <div className="absolute inset-0 z-30 grid place-items-center bg-gradient-to-b from-sky-300 to-emerald-300">
        <div className="sg-pop w-[min(440px,88vw)] rounded-[2rem] border-4 border-white bg-white/90 p-6 text-center shadow-2xl">
          <div className="text-6xl">🚜</div><h2 className="mt-2 text-3xl font-black">Opening the farm…</h2>
          <p className="mt-1 font-bold text-slate-600">Bringing in the animals · {loaded} / {ANIMALS.length}</p>
          <div className="mt-4 h-4 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(loaded / ANIMALS.length) * 100}%` }} /></div>
        </div>
      </div>}
      {/* map + where you are */}
      <div className={"pointer-events-none absolute right-2 top-[4.2rem] z-10 flex-col items-end gap-1.5 sm:right-3 sm:top-[4.6rem] sm:flex " + (bubble || sel || placing ? "hidden" : "flex")}>
        <canvas ref={mapRef} width={150} height={132} className="h-[110px] w-[125px] rounded-2xl border-4 border-white/90 shadow-xl sm:h-[132px] sm:w-[150px]" />
        {hud && <span className="rounded-xl bg-white/90 px-2.5 py-1 text-xs font-black text-emerald-800 shadow">{riding ? `${riding.emoji} Riding · ` : "📍 "}{hud.area}</span>}
      </div>
      {/* bottom: walk pad on the left, actions on the right */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-2 p-2 sm:p-4" style={{ paddingBottom: "max(.5rem, env(safe-area-inset-bottom))" }}>
        <div className="flex flex-col items-start gap-2">
          <div className="grid grid-cols-3 gap-1.5">
            <span />
            <Hold dwell={D} label="Walk forward" on={() => g()?.setHold(1, 0)} off={() => g()?.setHold(0, 0)} className={pad}>⬆</Hold>
            <span />
            <Hold dwell={D} label="Turn left" on={() => g()?.setHold(0, -1)} off={() => g()?.setHold(0, 0)} className={pad}>↺</Hold>
            <Hold dwell={D} label="Walk back" on={() => g()?.setHold(-1, 0)} off={() => g()?.setHold(0, 0)} className={pad}>⬇</Hold>
            <Hold dwell={D} label="Turn right" on={() => g()?.setHold(0, 1)} off={() => g()?.setHold(0, 0)} className={pad}>↻</Hold>
          </div>
          <GazeButton dwell={D} onSelect={() => g()?.setRun(!run)} pressed={run} label={riding ? "Gallop" : "Run"} className={btn + (run ? " bg-orange-500 text-white" : " bg-white/90")}>{riding ? "🐎 Gallop" : "🏃 Run"}{run ? " on" : ""}</GazeButton>
        </div>
        <div className="flex max-w-[60%] flex-col items-end gap-2">
          {riding ? <GazeButton dwell={D} onSelect={() => g()?.dismount()} className={btn + " bg-rose-500 text-white"}>🛑 Get off {riding.name.split(" ")[0]}</GazeButton>
            : nearRide ? <GazeButton dwell={D} onSelect={() => g()?.ride(nearRide.id)} className={btn + " bg-amber-400"}>{nearRide.emoji} Ride {nearRide.name.split(" ")[0]}</GazeButton> : null}
          <div className="flex gap-2">
            <GazeButton dwell={D} onSelect={() => setPanel(p => p === "places" ? null : "places")} className={btn + " bg-white/90"} label="Places">📍<span className="hidden sm:inline">Places</span></GazeButton>
            <GazeButton dwell={D} onSelect={() => { setPlacing(null); setPanel(p => p === "feed" ? null : "feed"); }} className={btn + " bg-amber-300/95"} label="Feed the animals">🥕<span className="hidden sm:inline">Feed</span></GazeButton>
            {placing && <GazeButton dwell={D} onSelect={() => setPlacing(null)} className={btn + " bg-white/90"} label="Cancel food">✕</GazeButton>}
            <GazeButton dwell={D} onSelect={() => setPanel("help")} className={btn + " bg-white/90"} label="How to play">?</GazeButton>
          </div>
        </div>
      </div>
      {/* the animal you met */}
      {sel && !panel && <div data-stage-ui className="sg-up absolute left-1/2 top-[8.2rem] z-10 w-[min(26rem,calc(100%-1rem))] -translate-x-1/2 rounded-[1.6rem] border-4 border-white bg-white/94 p-3 shadow-2xl backdrop-blur sm:top-auto sm:bottom-24">
        <div className="flex items-center gap-3"><span className="text-4xl">{sel.emoji}</span><div className="min-w-0 flex-1"><h2 className="truncate text-xl font-black">{sel.name}</h2><p className="text-sm font-bold text-slate-500">Says “{sel.sound}!” · eats {EATS[sel.kind].map(f => FOOD[f].emoji).join(" ")}</p></div>
          <GazeButton dwell={D} onSelect={() => { setSelected(null); if (game.current) game.current.selected = null; }} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100" label="Close"><X className="h-5 w-5" /></GazeButton></div>
        <div className="mt-2 grid gap-1.5" style={{ gridTemplateColumns: `repeat(${sel.ride ? 4 : 3},minmax(0,1fr))` }}>
          <GazeButton dwell={D} onSelect={() => meet(sel.id)} className="min-h-14 rounded-xl bg-emerald-500 text-sm font-black text-white">🔊<br />Hello</GazeButton>
          <GazeButton dwell={D} onSelect={() => meet(sel.id, true)} className="min-h-14 rounded-xl bg-sky-500 text-sm font-black text-white">💡<br />Fact</GazeButton>
          <GazeButton dwell={D} onSelect={() => setPanel("pick-food")} className="min-h-14 rounded-xl bg-amber-400 text-sm font-black">🍽️<br />Feed</GazeButton>
          {sel.ride && <GazeButton dwell={D} onSelect={() => { setSelected(null); g()?.ride(sel.id); }} className="min-h-14 rounded-xl bg-orange-500 text-sm font-black text-white">🐴<br />Ride</GazeButton>}
        </div>
      </div>}
      {panel && <section data-stage-ui className="absolute inset-0 z-20 grid place-items-center bg-slate-900/25 p-3" onClick={() => setPanel(null)}>
        <div className="sg-pop max-h-full w-full max-w-2xl overflow-y-auto rounded-[2rem] border-4 border-white bg-white/95 p-4 shadow-2xl sm:p-5" onClick={e => e.stopPropagation()}>
          {panel === "places" && <>
            <h2 className="text-2xl font-black sm:text-3xl">Where to?</h2>
            <div className="mt-3 grid grid-cols-3 gap-2">{PLACES.map((p, i) => <GazeButton key={p.id} dwell={D} onSelect={() => go(i)} className="min-h-20 rounded-2xl border-4 border-emerald-100 bg-emerald-50 p-2 text-sm font-black sm:text-base"><div className="text-3xl">{p.emoji}</div>{p.label}</GazeButton>)}</div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <GazeButton dwell={D} ms={800} onSelect={() => g()?.turnCamera(0.6)} className="min-h-14 rounded-2xl bg-slate-100 font-black">⟲ View</GazeButton>
              <GazeButton dwell={D} ms={800} onSelect={() => g()?.turnCamera(-0.6)} className="min-h-14 rounded-2xl bg-slate-100 font-black">View ⟳</GazeButton>
              <GazeButton dwell={D} ms={800} onSelect={() => g()?.zoom(0.75)} className="min-h-14 rounded-2xl bg-slate-100 font-black">➕ Closer</GazeButton>
              <GazeButton dwell={D} ms={800} onSelect={() => g()?.zoom(1.35)} className="min-h-14 rounded-2xl bg-slate-100 font-black">➖ Farther</GazeButton>
            </div>
          </>}
          {panel === "feed" && <>
            <h2 className="text-2xl font-black sm:text-3xl">Pick some food</h2>
            <p className="font-bold text-slate-500">Then look at a spot on the grass (or tap it). A hungry animal will come and eat!</p>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{(Object.keys(FOOD) as FoodType[]).map(f => <GazeButton key={f} dwell={D} onSelect={() => { setPanel(null); setPlacing(f); setBubble(null); g()?.audio.play("select"); }} className="min-h-24 rounded-2xl border-4 border-amber-100 bg-amber-50 p-2 font-black"><div className="text-4xl">{FOOD[f].emoji}</div>{FOOD[f].label}</GazeButton>)}</div>
          </>}
          {panel === "pick-food" && sel && <>
            <h2 className="text-2xl font-black sm:text-3xl">What should {sel.name} eat?</h2>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{EATS[sel.kind].map(f => <GazeButton key={f} dwell={D} onSelect={() => { setPanel(null); g()?.feed(sel.id, f); }} className="min-h-24 rounded-2xl border-4 border-amber-100 bg-amber-50 p-2 font-black"><div className="text-4xl">{FOOD[f].emoji}</div>{FOOD[f].label}</GazeButton>)}</div>
          </>}
          {panel === "help" && <>
            <h2 className="text-2xl font-black sm:text-3xl">How to play</h2>
            <ul className="mt-2 space-y-1.5 text-base font-bold text-slate-700 sm:text-lg">
              <li>⬆ <b>Walk:</b> look at the arrows and hold your look (or press them). Arrow keys and WASD work too.</li>
              <li>👀 <b>Look to walk:</b> look at a spot on the grass and hold still. You'll walk there.</li>
              <li>🐄 <b>Meet animals:</b> look at an animal to hear its name and its real sound.</li>
              <li>🐴 <b>Ride:</b> walk up to a horse, pony, cow, pig, sheep or goat and choose Ride. Then hold ⬆ to go, and turn on Gallop to go fast!</li>
              <li>🥕 <b>Feed:</b> pick a food and put it on the grass. An animal will trot over and munch.</li>
              <li>🧲 <b>Golden horseshoes:</b> {HORSESHOES.length} are hidden around the farm. The map shows them in yellow.</li>
            </ul>
          </>}
          <GazeButton dwell={D} onSelect={() => setPanel(null)} className="mt-3 min-h-12 w-full rounded-2xl bg-slate-100 font-black">Close</GazeButton>
        </div>
      </section>}
    </StageShell>
  );
}

