// Arise LifeHub · Sleep: settings. How things are read aloud, breathing cues, the default sleep
// timer, and whether to show Christian content.
import { useEffect, useState, type ReactNode } from "react";
import type { SleepSettings } from "@shared/sleepApp";
import { TIMER_CHOICES_LABELS } from "@shared/sleepContent";
import { useSleep } from "./context";
import { deviceVoices, narrator } from "./narrator";
import { Choices, Sheet, Switch } from "./parts";

function Row({ title, detail, children }: { title: string; detail?: ReactNode; children: ReactNode }) {
  return <div className="border-b border-[var(--sl-veil)] py-4 last:border-b-0">
    <p className="font-semibold text-[var(--sl-parchment)]">{title}</p>
    {detail && <p className="sl-small mt-1 text-[var(--sl-hush)]">{detail}</p>}
    <div className="mt-3">{children}</div>
  </div>;
}

export function SettingsSheet({ onClose }: { onClose: () => void }) {
  const { app, update, token } = useSleep();
  const s = app.settings;
  const set = (patch: Partial<SleepSettings>) => update((a) => ({ ...a, settings: { ...a.settings, ...patch } }));
  const [voices, setVoices] = useState(() => deviceVoices());
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const load = () => setVoices(deviceVoices());
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);
  const test = () => narrator.play(["This is how I'll sound tonight.", "Slow, and quiet, and calm."], { title: "Voice test", voice: s.voice, aiVoice: s.aiVoice, deviceVoice: s.deviceVoice, pace: s.pace, token });

  return <Sheet title="Settings" onClose={onClose}>
    <Row title="Reading voice" detail="The calm voice is AI-generated, and stories you've heard play from your phone after that. Your phone's own voice also works with no internet.">
      <Choices label="Reading voice" value={s.voice} options={[{ id: "ai", label: "Calm voice (AI)" }, { id: "device", label: "My phone's voice" }]} onChange={(voice) => set({ voice })} />
      {s.voice === "ai"
        ? <div className="mt-3"><Choices label="Which calm voice" value={s.aiVoice} options={[{ id: "warm", label: "Warm" }, { id: "deep", label: "Deep" }]} onChange={(aiVoice) => set({ aiVoice })} /></div>
        : voices.length > 0 && <label className="mt-3 block">
            <span className="sl-small text-[var(--sl-faint)]">Phone voice</span>
            <select value={s.deviceVoice} onChange={(e) => set({ deviceVoice: e.target.value })} className="sl-input mt-1">
              <option value="">Best available</option>
              {voices.map((v) => <option key={v.voiceURI} value={v.voiceURI}>{v.name}</option>)}
            </select>
          </label>}
      <button type="button" onClick={test} className="sl-btn sl-quiet mt-3">Hear a sample</button>
    </Row>
    <Row title="Reading pace" detail="How long the quiet is between sentences.">
      <Choices label="Reading pace" value={s.pace} options={[{ id: "slow", label: "Slow" }, { id: "slower", label: "Slower" }, { id: "slowest", label: "Slowest" }]} onChange={(pace) => set({ pace })} />
    </Row>
    <Row title="Show the words while reading" detail="Turn this off to keep the screen even darker.">
      <Switch on={s.showWords} onChange={(showWords) => set({ showWords })} label="Show the words while reading" />
    </Row>
    <Row title="Breathing cues" detail="A soft tone at each breath, a voice saying the words, or nothing.">
      <Choices label="Breathing cues" value={s.breathCue} options={[{ id: "chime", label: "Soft tone" }, { id: "voice", label: "Voice" }, { id: "none", label: "None" }]} onChange={(breathCue) => set({ breathCue })} />
    </Row>
    <Row title="Sleep timer" detail="Starts on its own when something plays. Sounds fade out slowly over the last few minutes.">
      <Choices label="Sleep timer" value={s.timer} options={TIMER_CHOICES_LABELS} onChange={(timer) => set({ timer })} />
    </Row>
    <Row title="Christian content" detail="Scripture, prayers, breath prayers and Bible stories. Turn off to hide them everywhere.">
      <Switch on={s.faith} onChange={(faith) => set({ faith })} label="Show Christian content" />
    </Row>
  </Sheet>;
}
