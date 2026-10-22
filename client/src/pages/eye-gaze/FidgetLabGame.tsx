// Fidget Lab — a shelf of twelve 3D fidgets. Pick one by looking at it; every fidget reacts to your eyes.
import { useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import GazeButton from "@/components/eye-gaze/GazeButton";
import StageShell, { Bubble, useStageSettings } from "@/components/eye-gaze/StageShell";
import { useAuth } from "@/context/AuthContext";
import { Stage } from "@/game/stage/stage";
import { StageAudio } from "@/game/stage/audio";
import { say, stopSpeaking } from "@/game/stage/voice";
import { FIDGETS, buildFidget, disposeFidget, kaleido, type Fidget, type FidgetCtx, type FidgetId } from "@/game/fidget/fidgets";

export default function FidgetLabGame({ onBack }: { onBack: () => void }) {
  const { user } = useAuth(); const uid = user?.id;
  const [settings, setSettings] = useStageSettings(uid);
  const [cur, setCur] = useState<FidgetId | null>(null);
  const [toast, setToast] = useState<{ text: string; n: number } | null>(null);
  const host = useRef<HTMLDivElement>(null); const stageRef = useRef<Stage | null>(null); const fid = useRef<Fidget | null>(null);
  const audio = useRef<StageAudio | null>(null); if (!audio.current) audio.current = new StageAudio();
  const sRef = useRef(settings); sRef.current = settings; const curRef = useRef(cur); curRef.current = cur;
  const toastTimer = useRef(0);
  const showToast = (text: string) => { window.clearTimeout(toastTimer.current); setToast(t => ({ text, n: (t?.n ?? 0) + 1 })); toastTimer.current = window.setTimeout(() => setToast(null), 3200); };
  const ctxFor = (st: Stage): FidgetCtx => ({ stage: st, audio: audio.current!, say: t => say(t, sRef.current.voice), toast: showToast });

  const mount = (st: Stage, id: FidgetId | null) => {
    if (fid.current) { disposeFidget(fid.current, st); fid.current = null; }
    st.setView([0, 0, 16], [0, 0, 0], 42); st.calm(600);
    const f = id ? buildFidget(id, ctxFor(st)) : (() => { const k = kaleido(ctxFor(st), true); st.scene.add(k.root); st.useEnvironment(0); return k; })();
    fid.current = f;
  };
  useEffect(() => { audio.current!.setVolumes(settings.music, settings.sfx); if (stageRef.current) stageRef.current.dwell = settings.dwell; }, [settings]);
  useEffect(() => {
    const el = host.current; if (!el) return;
    const st = new Stage(el, { quality: settings.quality, fov: 42, camPos: [0, 0, 16], bloom: 0.45, dwell: settings.dwell, dwellMs: 900, env: true });
    stageRef.current = st; mount(st, curRef.current);
    st.onFrame = (dt, t) => fid.current?.update(dt, t);
    st.onPointer = (p, kind, touch) => fid.current?.pointer?.(p, kind, touch);
    return () => { if (fid.current) { disposeFidget(fid.current, st); fid.current = null; } st.dispose(); stageRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.quality]);
  useEffect(() => () => { stopSpeaking(); audio.current?.dispose(); window.clearTimeout(toastTimer.current); }, []);

  const open = (id: FidgetId | null) => {
    const a = audio.current!; a.ensure(); a.play("select"); setCur(id); setToast(null);
    if (id) { a.startMusic(60, 84, "major", FIDGETS.findIndex(f => f.id === id) * 7 + 2); a.setEnergy(0); const f = FIDGETS.find(x => x.id === id)!; showToast(f.how); say(f.how, sRef.current.voice); }
    else a.stopMusic();
    if (stageRef.current) mount(stageRef.current, id);
  };
  const i = cur ? FIDGETS.findIndex(f => f.id === cur) : -1; const f = i >= 0 ? FIDGETS[i] : null; const D = settings.dwell;

  return (
    <StageShell title={f ? f.name : "Fidget Lab"} badge={f ? f.emoji : "🧪"} accent="#7c3aed" hostRef={host} settings={settings} onSettings={setSettings}
      onBack={() => { if (cur) open(null); else { stopSpeaking(); audio.current?.stopMusic(); onBack(); } }}
      bubble={toast ? <Bubble key={toast.n} icon={f?.emoji ?? "✨"}>{toast.text}</Bubble> : undefined}>
      {!cur && <section data-stage-ui className="sg-up absolute inset-x-0 bottom-0 top-16 z-10 overflow-y-auto p-2 sm:p-5">
        <div className="mx-auto max-w-5xl">
          <h2 className="sg-title mb-2 text-center text-3xl font-black text-white sm:mb-4 sm:text-5xl">Fidget Lab</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
            {FIDGETS.map(x => <GazeButton key={x.id} dwell={D} onSelect={() => open(x.id)} label={x.name}
              className="min-h-[6.5rem] rounded-[1.4rem] border-4 border-white/70 bg-white/88 p-2 text-center shadow-xl backdrop-blur sm:min-h-36 sm:p-3">
              <div className="text-4xl sm:text-6xl">{x.emoji}</div>
              <div className="mt-1 text-sm font-black leading-tight sm:text-xl">{x.name}</div>
              <div className="mt-0.5 hidden text-sm font-bold leading-tight text-slate-500 sm:block">{x.hint}</div>
            </GazeButton>)}
          </div>
        </div>
      </section>}
      {cur && <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-between gap-2 p-3 sm:p-5" style={{ paddingBottom: "max(.75rem, env(safe-area-inset-bottom))" }}>
        <GazeButton dwell={D} onSelect={() => { fid.current?.reset?.(); audio.current?.play("whoosh", 3); }} label="Reset" className="pointer-events-auto flex min-h-14 items-center gap-2 rounded-2xl bg-white/90 px-4 text-lg font-black shadow-xl backdrop-blur"><RotateCcw className="h-5 w-5" />Reset</GazeButton>
        <GazeButton dwell={D} onSelect={() => open(FIDGETS[(i + 1) % FIDGETS.length].id)} label="Next fidget" className="pointer-events-auto flex min-h-14 items-center gap-2 rounded-2xl bg-violet-600 px-4 text-lg font-black text-white shadow-xl">{FIDGETS[(i + 1) % FIDGETS.length].emoji} Next ▶</GazeButton>
      </div>}
    </StageShell>
  );
}
