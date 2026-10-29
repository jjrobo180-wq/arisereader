// A.R.I.S.E. Beginners: "say it" with the microphone. The voice bar fills while the child makes sound, so any real
// try is rewarded; then (when the word can be checked) the server listens and says whether it heard the word.
// Without a microphone, the child says it out loud and taps "I said it".
import { useEffect, useRef, useState } from "react";
import { canRecord, sendAudio, sounds, startRecording, type Recording } from "./voice";
import { MicIcon, VoiceBar } from "./parts";

export type SayResult = { tried: boolean; correct: boolean | null; close?: boolean; heard?: string; points?: number };
type State = "idle" | "listening" | "checking" | "done";

export function SayWord({ word, set, check = true, onResult, autoFocus = false, disabled = false }: {
  word: string; set?: string; check?: boolean; onResult: (r: SayResult) => void; autoFocus?: boolean; disabled?: boolean;
}) {
  const [state, setState] = useState<State>("idle");
  const [level, setLevel] = useState(0);
  const [fill, setFill] = useState(0);
  const [note, setNote] = useState("");
  const [noMic, setNoMic] = useState(!canRecord());
  const rec = useRef<Recording | null>(null);
  const last = useRef(0);
  const fillRef = useRef(0);
  const live = useRef(true);
  useEffect(() => { live.current = true; return () => { live.current = false; rec.current?.stop(); }; }, []);
  useEffect(() => { setState("idle"); setFill(0); fillRef.current = 0; setNote(""); }, [word]);

  async function listen() {
    if (state === "listening") { rec.current?.stop(); return; }
    setNote(""); setFill(0); fillRef.current = 0; last.current = performance.now();
    let r: Recording;
    try {
      r = await startRecording({
        maxMs: 5000, autoStop: true,
        level: (v) => {
          if (!live.current) return;
          const t = performance.now(), dt = Math.min(0.1, (t - last.current) / 1000);
          last.current = t;
          setLevel(v);
          if (v > 0.12) { fillRef.current = Math.min(1, fillRef.current + v * dt * 2.4 + dt * 0.5); setFill(fillRef.current); }
        },
      });
    } catch {
      setNoMic(true);
      setNote("The microphone is off. Say the word out loud, then tap I said it.");
      return;
    }
    rec.current = r;
    setState("listening");
    sounds.tap();
    const { blob, spoke } = await r.done;
    rec.current = null;
    if (!live.current) return;
    if (!spoke || blob.size < 400) { setState("idle"); setNote("I didn't hear you. Tap the microphone and say it nice and loud!"); return; }
    fillRef.current = 1; setFill(1);
    if (!check) { setState("done"); sounds.star(); onResult({ tried: true, correct: null }); return; }
    setState("checking");
    try {
      const q = new URLSearchParams({ word, ...(set ? { set } : {}) });
      const res = await sendAudio(`/api/beginners/say?${q}`, blob);
      if (!live.current) return;
      setState("done");
      if (res.correct) sounds.right();
      onResult({ tried: true, correct: !!res.correct, close: !!res.close, heard: res.heard, points: res.points || 0 });
    } catch (e: any) {
      if (!live.current) return;
      setState("done");
      setNote(e?.message || "I couldn't listen that time.");
      onResult({ tried: true, correct: null });
    }
  }

  if (noMic) {
    return (
      <div className="bg-say is-nomic">
        {note && <p className="bg-say-note">{note}</p>}
        <button type="button" className="bg-btn bg-btn-go" disabled={disabled} onClick={() => { sounds.star(); onResult({ tried: true, correct: null }); }}>I said it!</button>
      </div>
    );
  }
  return (
    <div className="bg-say">
      <button type="button" className={`bg-mic${state === "listening" ? " is-on" : ""}`} onClick={listen} disabled={disabled || state === "checking"} autoFocus={autoFocus}
        aria-label={state === "listening" ? "Stop listening" : `Say ${word}`}>
        <MicIcon size={34} />
        {state === "listening" && <span className="bg-mic-ring" style={{ transform: `scale(${1 + level * 0.6})` }} aria-hidden="true" />}
      </button>
      <VoiceBar fill={fill} level={state === "listening" ? level : 0} />
      <p className="bg-say-note" aria-live="polite">{state === "listening" ? "I'm listening…" : state === "checking" ? "Checking…" : note || (state === "idle" ? "Tap the microphone and say it." : "")}</p>
    </div>
  );
}
