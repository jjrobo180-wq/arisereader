// Arise LifeHub · Sleep: the bedtime journal. Get it out of your head and onto the page: a brain
// dump, tomorrow's list, a worry turned into a next step, three good things, cares handed to God,
// or just writing.
import { useMemo, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { nightOf, recordUse, type SleepJournalEntry } from "@shared/sleepApp";
import { JOURNALS, caresScript } from "@shared/sleepContent";
import { useSleep } from "./context";
import { Choices, Section, Why } from "./parts";
import { shortDate } from "../ui";

export function JournalTab() {
  const { app, update, makeId, faith, journalKind, setJournalKind, read } = useSleep();
  const kinds = JOURNALS.filter((j) => faith || !j.faith);
  const kind = kinds.find((k) => k.id === journalKind) ?? kinds[0];
  const [text, setText] = useState("");
  const [justSaved, setJustSaved] = useState<SleepJournalEntry | null>(null);
  const night = nightOf();

  const save = (e: FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    const entry: SleepJournalEntry = { id: makeId(), night, kind: kind.id, text: body.slice(0, 5000), at: new Date().toISOString() };
    update((a) => { const next = recordUse(a, `journal:${kind.id}`, makeId); return { ...next, journal: [...next.journal, entry].slice(-1000) }; });
    setText("");
    setJustSaved(entry);
  };

  const nights = useMemo(() => {
    const by = new Map<string, SleepJournalEntry[]>();
    for (const e of [...app.journal].reverse()) { const list = by.get(e.night) ?? []; list.push(e); by.set(e.night, list); }
    return [...by.entries()].slice(0, 30);
  }, [app.journal]);
  const nameOf = (id: string) => JOURNALS.find((j) => j.id === id)?.name ?? "Journal";
  const lines = (t: string) => t.split("\n").map((l) => l.replace(/^[-*•]\s*/, "").trim()).filter(Boolean);

  return <div>
    <Section title="Bedtime journal" intro="Getting thoughts out of your head and onto the page tells your brain it can stop holding them. Pick a way to write.">
      <Choices label="Kind of journal" value={kind.id} options={kinds.map((k) => ({ id: k.id, label: k.name }))} onChange={(id) => { setJournalKind(id); setJustSaved(null); }} />
    </Section>

    <form onSubmit={save} className="mt-6">
      <label htmlFor="sleep-journal-text" className="sleep-serif block text-[1.1875rem] leading-snug text-[var(--sl-parchment)]">{kind.prompt}</label>
      <Why why={kind.why} source={kind.source} />
      <textarea id="sleep-journal-text" value={text} onChange={(e) => setText(e.target.value)} placeholder={kind.placeholder} rows={kind.list ? 7 : 9} maxLength={5000} className="sl-input mt-4 !min-h-[11rem]" />
      {kind.list && <p className="sl-small mt-1 text-[var(--sl-faint)]">One per line.</p>}
      <button type="submit" className="sl-btn sl-primary mt-4" disabled={!text.trim()}>Save</button>
    </form>

    {justSaved && <div className="mt-6 border-l-2 border-[var(--sl-ember)] pl-4">
      <p className="text-[var(--sl-parchment)]">{justSaved.kind === "prayer" ? "Saved. You've handed them over." : justSaved.kind === "gratitude" ? "Saved. End on those." : "Saved. It's out of your head now."}</p>
      {justSaved.kind === "prayer" && <button type="button" onClick={() => read("Casting my cares", caresScript(lines(justSaved.text)))} className="sl-btn sl-quiet mt-3">Pray these aloud</button>}
    </div>}

    {nights.length > 0 && <Section title="Earlier nights">
      {nights.map(([n, entries]) => <div key={n} className="mt-6 first:mt-0">
        <h3 className="sl-small mb-1 font-semibold text-[var(--sl-parchment)]">{n === night ? "Tonight" : `Night of ${shortDate(n)}`}</h3>
        <ul className="border-t border-[var(--sl-veil)]">{entries.map((e) => <li key={e.id} className="border-b border-[var(--sl-veil)] py-3">
          <div className="flex items-start justify-between gap-3">
            <p className="sl-small text-[var(--sl-faint)]">{nameOf(e.kind)}</p>
            <button type="button" onClick={() => update((a) => ({ ...a, journal: a.journal.filter((x) => x.id !== e.id) }))} className="sl-btn sl-ghost sl-icon -mr-2 -mt-2" aria-label="Delete this entry"><Trash2 size={15} aria-hidden /></button>
          </div>
          <p className="whitespace-pre-wrap text-[var(--sl-parchment)]">{e.text}</p>
        </li>)}</ul>
      </div>)}
    </Section>}
  </div>;
}
