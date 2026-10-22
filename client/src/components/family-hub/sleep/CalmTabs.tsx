// Arise LifeHub · Sleep: Breathe, Quiet mind, and Relax body.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { nightOf, recordUse } from "@shared/sleepApp";
import { ALPHABET_CATEGORIES, BREATHS, caresScript, toolById, type BreathPattern } from "@shared/sleepContent";
import { useSleep } from "./context";
import { Choices, Section, ToolRow, ToolRowById } from "./parts";

// ── Breathe ──────────────────────────────────────────────────────────────────

const LENGTHS = [{ id: 2, label: "2 min" }, { id: 5, label: "5 min" }, { id: 10, label: "10 min" }, { id: 0, label: "Until I stop" }] as const;

export function BreatheTab() {
  const { faith, breathe, app, update } = useSleep();
  const [minutes, setMinutes] = useState<number>(5);
  const row = (b: BreathPattern) => {
    const tool = toolById(`breathe:${b.id}`);
    return tool ? <ToolRow key={b.id} tool={tool} onStart={() => breathe({ kind: "pattern", pattern: b }, minutes, tool.id)} /> : null;
  };
  return <div>
    <Section title="Breathe yourself calm" intro="Slow breathing, and especially long breaths out, tells your body it's safe to rest. Follow the glow, or close your eyes and follow the tones.">
      <div className="flex flex-wrap gap-x-8 gap-y-4">
        <div><p className="sl-small mb-2 text-[var(--sl-faint)]">How long</p><Choices label="How long" value={minutes} options={LENGTHS} onChange={setMinutes} /></div>
        <div><p className="sl-small mb-2 text-[var(--sl-faint)]">Cues</p>
          <Choices label="Breathing cues" value={app.settings.breathCue} options={[{ id: "chime", label: "Soft tone" }, { id: "voice", label: "Voice" }, { id: "none", label: "None" }]}
            onChange={(breathCue) => update((a) => ({ ...a, settings: { ...a.settings, breathCue } }))} />
        </div>
      </div>
    </Section>
    <ul className="mt-6">{BREATHS.filter((b) => !b.faith).map(row)}</ul>
    {faith && <Section title="Breath prayers" intro="An old Christian practice: a few words of Scripture as you breathe in, a few as you breathe out. One thing for a busy mind to hold.">
      <ul>{BREATHS.filter((b) => b.faith).map(row)}</ul>
    </Section>}
  </div>;
}

// ── Quiet mind ───────────────────────────────────────────────────────────────

export function MindTab() {
  const { app, update, makeId, faith, read, parkFocus, alphabetCategory, setAlphabetCategory } = useSleep();
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (parkFocus) input.current?.focus(); }, [parkFocus]);
  const night = nightOf();
  const tonight = app.parked.filter((p) => p.night === night && !p.done);
  const park = (e: FormEvent) => {
    e.preventDefault();
    const t = text.trim().slice(0, 300);
    if (!t) return;
    update((a) => { const next = recordUse(a, "mind:park", makeId); return { ...next, parked: [...next.parked, { id: makeId(), night, text: t, prayed: false, done: false }].slice(-300) }; });
    setText("");
  };
  const prayOver = () => {
    read("Casting my cares", caresScript(tonight.map((p) => p.text)));
    update((a) => ({ ...a, parked: a.parked.map((p) => (p.night === night ? { ...p, prayed: true } : p)) }));
  };
  const categories = ALPHABET_CATEGORIES.filter((c) => faith || !c.faith);

  return <div>
    <Section title="Park your thoughts" intro="Type each thought as it shows up, then let it go. It'll be waiting on the Tonight screen in the morning, so your brain doesn't have to hold onto it.">
      <form onSubmit={park} className="flex gap-2">
        <input ref={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Call the dentist, that thing at work…" aria-label="A thought to park" className="sl-input" maxLength={300} enterKeyHint="done" />
        <button type="submit" className="sl-btn sl-primary shrink-0" disabled={!text.trim()}>Park it</button>
      </form>
      {tonight.length > 0 && <>
        <ul className="mt-4">{tonight.map((p) => <li key={p.id} className="flex items-center justify-between gap-3 border-b border-[var(--sl-veil)] py-2.5">
          <span className="min-w-0 text-[var(--sl-parchment)]">{p.text}</span>
          <button type="button" onClick={() => update((a) => ({ ...a, parked: a.parked.filter((x) => x.id !== p.id) }))} className="sl-btn sl-ghost sl-icon" aria-label={`Remove "${p.text}"`}><X size={16} aria-hidden /></button>
        </li>)}</ul>
        <p className="sl-small mt-3 text-[var(--sl-faint)]">{tonight.length === 1 ? "1 thought parked" : `${tonight.length} thoughts parked`} until morning.</p>
        {faith && <button type="button" onClick={prayOver} className="sl-btn sl-quiet mt-3">Pray over these</button>}
      </>}
    </Section>

    <Section title="Give your brain a small, boring job" intro="Fighting a busy mind keeps it busy. Give it something just interesting enough to hold, and too dull to keep you up.">
      <ul>
        <ToolRowById id="mind:shuffle" />
        <ToolRowById id="mind:countdown" />
        <ToolRowById id="mind:breathcount" />
        {toolById("mind:alphabet") && <ToolRow tool={toolById("mind:alphabet")!}>
          <div className="mt-3"><Choices label="Alphabet category" value={alphabetCategory} options={categories.map((c) => ({ id: c.id, label: c.name }))} onChange={setAlphabetCategory} /></div>
        </ToolRow>}
        <ToolRowById id="mind:the" />
      </ul>
    </Section>

    <Section title="When you've been awake a while">
      <ul>
        <ToolRowById id="script:get-up" label="Listen" />
        <ToolRowById id="script:paradox" label="Listen" />
      </ul>
    </Section>

    {faith && <Section title="For a busy mind" intro="“In the multitude of my thoughts within me thy comforts delight my soul” (Psalm 94:19).">
      <ul>
        <ToolRowById id="script:racing-mind" label="Pray" />
        <ToolRowById id="script:thoughts-captive" label="Pray" />
        <ToolRowById id="passage:ps94" label="Listen" />
      </ul>
    </Section>}
  </div>;
}

// ── Relax body ───────────────────────────────────────────────────────────────

export function BodyTab() {
  return <div>
    <Section title="Relax your body" intro="Sleep starts in the body. These are read aloud slowly, so you can close your eyes and follow along. Relaxation training is one of the standard treatments sleep specialists recommend.">
      <ul>
        <ToolRowById id="script:body-scan" label="Listen" />
        <ToolRowById id="script:pmr" label="Listen" />
        <ToolRowById id="script:military" label="Listen" />
        <ToolRowById id="script:warm-heavy" label="Listen" />
        <ToolRowById id="script:deep-rest" label="Listen" />
        <ToolRowById id="script:sinking" label="Listen" />
      </ul>
    </Section>
  </div>;
}
