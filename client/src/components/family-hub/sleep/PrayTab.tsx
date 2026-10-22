// Arise LifeHub · Sleep: Pray. Night prayers, the evening examen, Scripture to fall asleep to
// (King James Version), breath prayers, the names of God A to Z, and verses to hold onto.
import { useEffect, useState, type ReactNode } from "react";
import { BREATHS, VERSES, toolById } from "@shared/sleepContent";
import { PASSAGES, SCRIPTS, displayRef, speakableVerse, type SleepPassage } from "@shared/sleepScripts";
import { useSleep } from "./context";
import { liveVerses, loadPassage, type Verse } from "./passages";
import { Section, Sheet, ToolRow, ToolRowById } from "./parts";

/** "LORD" set in small capitals, the way printed Bibles show it. */
function Scripture({ text }: { text: string }) {
  const parts = text.split(/\b(LORD|GOD)\b/);
  return <>{parts.map((p, i) => (p === "LORD" || p === "GOD" ? <span key={i} style={{ fontVariant: "small-caps" }}>{p === "LORD" ? "Lord" : "God"}</span> : <span key={i}>{p}</span>))}</>;
}

function PassageSheet({ passage, onClose }: { passage: SleepPassage; onClose: () => void }) {
  const { token, launch } = useSleep();
  const [verses, setVerses] = useState<Verse[] | null>(() => liveVerses(passage.ref));
  const [checked, setChecked] = useState(!!verses);
  useEffect(() => {
    if (verses) return;
    let gone = false;
    void loadPassage(passage.ref, token).then((v) => { if (!gone) { if (v) setVerses(v); setChecked(true); } });
    return () => { gone = true; };
  }, [passage.ref, token]); // eslint-disable-line react-hooks/exhaustive-deps
  const shown = verses ?? passage.verses;
  return <Sheet title={`${displayRef(passage.ref)}: ${passage.title}`} onClose={onClose} wide>
    <p className="-mt-2 mb-5 text-[0.9375rem]">{passage.note}</p>
    <div className="sl-read space-y-3">{shown.map(([n, t]) => <p key={n}><sup className="mr-1 align-[0.35em] text-[0.7rem] text-[var(--sl-faint)]">{n}</sup><Scripture text={t} /></p>)}</div>
    <p className="sl-small mt-5 text-[var(--sl-faint)]">King James Version.{checked && !verses ? " Showing the copy saved in the app." : ""}</p>
    <button type="button" onClick={() => { onClose(); launch(`passage:${passage.id}`); }} className="sl-btn sl-primary mt-5">Read it to me</button>
  </Sheet>;
}

const VERSE_GROUPS: { id: (typeof VERSES)[number]["for"]; name: string }[] = [
  { id: "sleep", name: "For sleep" }, { id: "thoughts", name: "For racing thoughts" }, { id: "worry", name: "For worry" }, { id: "fear", name: "For fear in the night" }, { id: "rest", name: "For rest" },
];

export function PrayTab() {
  const { read, launch } = useSleep();
  const [open, setOpen] = useState<SleepPassage | null>(null);
  const prayers = SCRIPTS.filter((s) => s.kind === "prayer" && s.id !== "examen");
  const verseRow = (v: (typeof VERSES)[number]): ReactNode => <li key={v.ref} className="border-b border-[var(--sl-veil)] py-4">
    <blockquote className="sl-read !text-[1.0625rem]"><Scripture text={v.text} /></blockquote>
    <div className="mt-2 flex items-center justify-between gap-3">
      <cite className="sl-small not-italic text-[var(--sl-faint)]">{displayRef(v.ref)}</cite>
      <button type="button" onClick={() => read(displayRef(v.ref), [...speakableVerse(v.text.replace(/^…|…$/g, "")), 4, ...speakableVerse(v.text.replace(/^…|…$/g, "")), 10])} className="sl-btn sl-ghost !min-h-9 !px-3 !text-[0.875rem]">Read aloud twice</button>
    </div>
  </li>;

  return <div>
    <Section title="End the day with God" intro="Hand over the day, give thanks, and rest. Each of these is read aloud, slowly.">
      <ul>
        <ToolRowById id="script:examen" label="Pray" />
        <ToolRowById id="pray:names" label="Listen" />
        <ToolRowById id="pray:blessings" label="Listen" />
      </ul>
    </Section>

    <Section title="Night prayers">
      <ul>{prayers.map((p) => <ToolRowById key={p.id} id={`script:${p.id}`} label="Pray" />)}</ul>
    </Section>

    <Section title="Scripture to fall asleep to" intro="Read slowly, verse by verse, from the King James Version. Selah, the old pause in the Psalms, becomes real quiet.">
      <ul>{PASSAGES.map((p) => {
        const tool = toolById(`passage:${p.id}`);
        return tool ? <ToolRow key={p.id} tool={tool} label="Listen">
          <button type="button" onClick={() => setOpen(p)} className="sl-small mt-1 min-h-8 text-[var(--sl-faint)] underline decoration-[var(--sl-line)] underline-offset-4 hover:text-[var(--sl-parchment)]">Read it myself</button>
        </ToolRow> : null;
      })}</ul>
    </Section>

    <Section title="Breath prayers" intro="A few words of Scripture as you breathe in, a few as you breathe out.">
      <ul>{BREATHS.filter((b) => b.faith).map((b) => <ToolRowById key={b.id} id={`breathe:${b.id}`} label="Breathe" />)}</ul>
    </Section>

    <Section title="Cast your cares" intro="“Casting all your care upon him; for he careth for you” (1 Peter 5:7). Write down each worry, and it becomes a prayer you can hear read aloud.">
      <button type="button" onClick={() => launch("journal:prayer")} className="sl-btn sl-quiet">Write my cares</button>
    </Section>

    <Section title="Verses to hold onto" intro="Pick one and let it be the last thing on your mind.">
      {VERSE_GROUPS.map((g) => <div key={g.id} className="mt-6 first:mt-0">
        <h3 className="sl-small mb-1 font-semibold text-[var(--sl-parchment)]">{g.name}</h3>
        <ul className="border-t border-[var(--sl-veil)]">{VERSES.filter((v) => v.for === g.id).map(verseRow)}</ul>
      </div>)}
    </Section>

    {open && <PassageSheet passage={open} onClose={() => setOpen(null)} />}
  </div>;
}
