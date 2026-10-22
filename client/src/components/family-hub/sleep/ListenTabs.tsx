// Arise LifeHub · Sleep: Sounds, Stories, and Watch.
import { useState } from "react";
import { ExternalLink, Moon } from "lucide-react";
import type { SoundId } from "@shared/sleepApp";
import { SOUNDS, SOUND_PRESETS, TIMER_CHOICES_LABELS, WATCH_GROUPS, toolById, youtubeUrl } from "@shared/sleepContent";
import { SCRIPTS, displayRef, type SleepScript } from "@shared/sleepScripts";
import { useSleep } from "./context";
import { sleepSounds } from "./soundEngine";
import { useMinutesLeft, useSounds } from "./hooks";
import { Choices, Level, Section, Sheet, Switch, ToolRow } from "./parts";

// ── Sounds ───────────────────────────────────────────────────────────────────

function SoundRow({ id }: { id: SoundId }) {
  const { app, setSound } = useSleep();
  const sounds = useSounds();
  const info = SOUNDS.find((s) => s.id === id)!;
  const level = sounds.levels[id] ?? 0;
  const on = level > 0;
  return <li className="border-b border-[var(--sl-veil)] py-3">
    <div className="flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-[var(--sl-parchment)]">{info.name}</p>
        <p className="mt-0.5 text-[0.9375rem]">{info.blurb}</p>
      </div>
      <Switch on={on} onChange={(v) => setSound(id, v ? app.settings.mix[id] ?? 0.7 : 0)} label={info.name} />
    </div>
    {on && <Level value={level} onChange={(v) => setSound(id, Math.max(0.03, v))} label={`${info.name} level`} />}
  </li>;
}

export function SoundsTab({ onLightsOut }: { onLightsOut: () => void }) {
  const { app, update, playMix } = useSleep();
  const sounds = useSounds();
  const left = useMinutesLeft(sounds.timerEnd);
  return <div>
    <Section title="Sounds for sleep" intro="Mix as many as you like. A steady sound covers the small noises that wake you, and gives a busy mind something to rest on."
      action={sounds.playing ? <button type="button" onClick={() => sleepSounds.stopAll()} className="sl-btn sl-quiet">Stop sounds</button> : undefined}>
      <p className="sl-small mb-2 text-[var(--sl-faint)]">Ready-made mixes</p>
      <div className="flex flex-wrap gap-2">{SOUND_PRESETS.map((p) => <button key={p.id} type="button" onClick={() => playMix(p.mix)} className="sl-chip" data-testid={`sleep-preset-${p.id}`}>{p.name}</button>)}</div>
    </Section>
    {(["Noise", "Nature", "Indoors"] as const).map((g) => <Section key={g} title={g}>
      <ul className="border-t border-[var(--sl-veil)]">{SOUNDS.filter((s) => s.group === g).map((s) => <SoundRow key={s.id} id={s.id} />)}</ul>
    </Section>)}
    <Section title="Volume and timer">
      <div className="max-w-md">
        <p className="sl-small text-[var(--sl-faint)]">Volume</p>
        <Level value={app.settings.volume} label="Volume" onChange={(volume) => { sleepSounds.setVolume(volume); update((a) => ({ ...a, settings: { ...a.settings, volume } })); }} />
      </div>
      <p className="sl-small mb-2 mt-4 text-[var(--sl-faint)]">Sleep timer{left !== null ? `: fades out in ${left} min` : ""}</p>
      <Choices label="Sleep timer" value={left === null ? 0 : app.settings.timer} options={TIMER_CHOICES_LABELS}
        onChange={(m) => { sleepSounds.startTimer(m); update((a) => ({ ...a, settings: { ...a.settings, timer: m } })); }} />
      <p className="sl-small mt-3 max-w-lg text-[var(--sl-faint)]">Keep it soft, like a light shower in the next room. The research on noise and sleep is mixed; its clearest benefit is covering sudden sounds.</p>
    </Section>
    <Section title="Keep it playing all night" intro="iPhones stop web sounds when the screen locks. Lights out keeps the screen on but completely black, so your sounds keep going. Plug your phone in if it'll play all night.">
      <button type="button" onClick={onLightsOut} className="sl-btn sl-primary"><Moon size={16} aria-hidden /> Lights out</button>
    </Section>
  </div>;
}

// ── Stories ──────────────────────────────────────────────────────────────────

/** A script to read yourself, on the screen, instead of listening. */
export function TextSheet({ script, onClose }: { script: SleepScript; onClose: () => void }) {
  const { read } = useSleep();
  return <Sheet title={script.title} onClose={onClose} wide>
    {script.ref && <p className="sl-small -mt-2 mb-4 text-[var(--sl-faint)]">Based on {displayRef(script.ref)}</p>}
    <div className="space-y-4">{script.lines.filter((l): l is string => typeof l === "string").map((l, i) => <p key={i} className="sl-read">{l}</p>)}</div>
    <button type="button" onClick={() => { onClose(); read(script.title, script.lines, `script:${script.id}`); }} className="sl-btn sl-primary mt-6">Read it to me</button>
  </Sheet>;
}

function ScriptList({ scripts, label, onRead }: { scripts: SleepScript[]; label: string; onRead: (s: SleepScript) => void }) {
  return <ul>{scripts.map((s) => {
    const tool = toolById(`script:${s.id}`);
    return tool ? <ToolRow key={s.id} tool={tool} label={label}>
      <button type="button" onClick={() => onRead(s)} className="sl-small mt-1 min-h-8 text-[var(--sl-faint)] underline decoration-[var(--sl-line)] underline-offset-4 hover:text-[var(--sl-parchment)]">Read it myself</button>
    </ToolRow> : null;
  })}</ul>;
}

export function StoriesTab() {
  const { faith } = useSleep();
  const [open, setOpen] = useState<SleepScript | null>(null);
  return <div>
    <Section title="Sleep stories" intro="Calm stories where nothing much happens. Let someone else do the imagining tonight.">
      <ScriptList scripts={SCRIPTS.filter((s) => s.kind === "story" && !s.faith)} label="Listen" onRead={setOpen} />
    </Section>
    {faith && <Section title="Bible stories for sleep" intro="Gentle retellings of rest and peace in the Bible. Wherever Scripture is quoted, it's the King James Version.">
      <ScriptList scripts={SCRIPTS.filter((s) => s.kind === "story" && s.faith)} label="Listen" onRead={setOpen} />
    </Section>}
    <Section title="Boring on purpose" intro="For the 20-minute rule. When you've gotten up because you can't sleep, read or listen to one of these in dim light until you feel sleepy. They're meant to be dull.">
      <ScriptList scripts={SCRIPTS.filter((s) => s.kind === "boring")} label="Listen" onRead={setOpen} />
    </Section>
    {open && <TextSheet script={open} onClose={() => setOpen(null)} />}
  </div>;
}

// ── Watch ────────────────────────────────────────────────────────────────────

export function WatchTab() {
  const { faith } = useSleep();
  return <div>
    <Section title="Watch or listen on YouTube" intro="Each one opens a YouTube search, so you can pick whatever looks good. Choose a version with a dark screen, and keep the brightness low.">
      <p className="max-w-xl text-[0.9375rem]">On an iPhone, open the Clock app, set a Timer, and under When Timer Ends choose Stop Playing. The video stops by itself once you're asleep.</p>
    </Section>
    {WATCH_GROUPS.filter((g) => faith || !g.faith).map((g) => <Section key={g.name} title={g.name}>
      <ul className="border-t border-[var(--sl-veil)]">{g.items.filter((i) => faith || !i.faith).map((i) => <li key={i.id}>
        <a href={youtubeUrl(i.query)} target="_blank" rel="noopener noreferrer" className="flex items-start justify-between gap-4 border-b border-[var(--sl-veil)] py-3 hover:bg-[var(--sl-dusk)]" data-testid={`sleep-watch-${i.id}`}>
          <span className="min-w-0"><span className="block font-semibold text-[var(--sl-parchment)]">{i.title}</span><span className="mt-0.5 block text-[0.9375rem]">{i.note}</span></span>
          <ExternalLink size={16} className="mt-1 shrink-0 text-[var(--sl-faint)]" aria-label="Opens YouTube" />
        </a>
      </li>)}</ul>
    </Section>)}
  </div>;
}
