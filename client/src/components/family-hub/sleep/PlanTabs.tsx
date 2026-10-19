// Arise LifeHub · Sleep: Plan (your bedtime worked backward into a timeline, and tonight's
// wind-down checklist), Learn (the science, in plain words), and the Sleep log.
import { useState, type FormEvent } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { hoursBetween, nightOf, pendingReview, planTimeline, whatWorks } from "@shared/sleepApp";
import { DEFAULT_CHECKLIST, LEARN_TOPICS, toolById } from "@shared/sleepContent";
import { addDaysTo, sleepHours } from "@shared/lifePlugins";
import { useSleep } from "./context";
import { Section } from "./parts";
import { clock12, confirmed, shortDate } from "../ui";

// ── Plan ─────────────────────────────────────────────────────────────────────

export function PlanTab() {
  const { app, update, faith, makeId } = useSleep();
  const p = app.plan;
  const night = nightOf();
  const items = p.checklist ?? DEFAULT_CHECKLIST.filter((c) => faith || !c.faith).map(({ id, text }) => ({ id, text }));
  const checked = p.checkedNight === night ? p.checked : [];
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState("");
  const hours = hoursBetween(p.bed, p.wake);
  const timeline = planTimeline(p.bed, p.wake);
  const windDown = timeline.find((t) => t.id === "wind-down");

  const setPlan = (patch: Partial<typeof p>) => update((a) => ({ ...a, plan: { ...a.plan, ...patch } }));
  const toggle = (id: string) => update((a) => {
    const cur = a.plan.checkedNight === night ? a.plan.checked : [];
    return { ...a, plan: { ...a.plan, checkedNight: night, checked: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] } };
  });
  const add = (e: FormEvent) => {
    e.preventDefault();
    const text = adding.trim().slice(0, 80);
    if (!text) return;
    setPlan({ checklist: [...items, { id: makeId(), text }].slice(0, 20) });
    setAdding("");
  };

  return <div>
    <Section title="Your bedtime plan" intro="Pick when you want to be asleep and when you'll get up. The rest of the evening is worked out from those two times.">
      <div className="grid max-w-md grid-cols-2 gap-3">
        <label className="block"><span className="sl-small text-[var(--sl-faint)]">Asleep by</span><input type="time" value={p.bed} onChange={(e) => e.target.value && setPlan({ bed: e.target.value })} className="sl-input mt-1" /></label>
        <label className="block"><span className="sl-small text-[var(--sl-faint)]">Wake up at</span><input type="time" value={p.wake} onChange={(e) => e.target.value && setPlan({ wake: e.target.value })} className="sl-input mt-1" /></label>
      </div>
      <p className="mt-3 text-[var(--sl-parchment)]">That's {hours} hours.</p>
      {hours < 7 && <p className="sl-small mt-1 max-w-lg">Most adults need 7 to 9 hours of sleep a night. If you can, move bedtime a little earlier. (Watson et al., Sleep, 2015)</p>}
      {hours > 10 && <p className="sl-small mt-1 max-w-lg">That's a long time in bed. Lying awake in bed for long stretches can make sleep lighter. Most adults need 7 to 9 hours.</p>}
    </Section>

    <Section title="Your evening, worked backward" intro="Each time comes from the research in the Learn tab.">
      <ol className="border-t border-[var(--sl-veil)]">{timeline.map((t) => <li key={t.id} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 border-b border-[var(--sl-veil)] py-3">
        <span className="sleep-serif pt-0.5 tabular-nums text-[var(--sl-ember)]">{clock12(t.at)}</span>
        <span><span className="block font-semibold text-[var(--sl-parchment)]">{t.title}</span><span className="mt-0.5 block text-[0.9375rem]">{t.detail}</span></span>
      </li>)}</ol>
    </Section>

    <Section title="Tonight's wind-down" intro={`${checked.length} of ${items.length} done. It starts fresh every night.`}
      action={<button type="button" onClick={() => setEditing((e) => !e)} className="sl-btn sl-ghost">{editing ? "Done editing" : "Edit list"}</button>}>
      <ul className="border-t border-[var(--sl-veil)]">{items.map((it) => {
        const on = checked.includes(it.id);
        return <li key={it.id} className="flex items-center gap-3 border-b border-[var(--sl-veil)] py-2.5">
          {editing
            ? <button type="button" onClick={() => setPlan({ checklist: items.filter((x) => x.id !== it.id) })} className="sl-btn sl-ghost sl-icon" aria-label={`Remove "${it.text}"`}><X size={16} aria-hidden /></button>
            : <button type="button" role="checkbox" aria-checked={on} onClick={() => toggle(it.id)} aria-label={it.text}
                className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border ${on ? "border-[var(--sl-ember)] bg-[var(--sl-ember)] text-[var(--sl-ember-ink)]" : "border-[var(--sl-line)]"}`}>{on && <Check size={16} aria-hidden />}</button>}
          <span className={on && !editing ? "text-[var(--sl-faint)] line-through" : "text-[var(--sl-parchment)]"}>{it.text}</span>
        </li>;
      })}</ul>
      {editing && <>
        <form onSubmit={add} className="mt-3 flex gap-2">
          <input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a step" aria-label="Add a step" maxLength={80} className="sl-input" />
          <button type="submit" className="sl-btn sl-quiet shrink-0" disabled={!adding.trim()}><Plus size={16} aria-hidden /> Add</button>
        </form>
        {p.checklist && <button type="button" onClick={() => setPlan({ checklist: null })} className="sl-small mt-3 underline decoration-[var(--sl-line)] underline-offset-4">Go back to the suggested list</button>}
      </>}
    </Section>

    <Section title="If you have ADHD">
      <ul className="max-w-2xl space-y-3">
        <li>Set a phone alarm called “Start winding down”{windDown ? ` for ${clock12(windDown.at)}` : ""}. Time blindness makes bedtime sneak up on you; an alarm makes it visible.</li>
        <li>Make the boring choice the easy one. Charge your phone across the room, or start a sound and turn on Lights out so the screen stays dark.</li>
        <li>Keep the same wake-up time, weekends too. It's the strongest lever you have on a body clock that runs late.</li>
        <li>Get outside light within an hour of waking. It pulls a late clock earlier, a few minutes at a time.</li>
      </ul>
    </Section>
  </div>;
}

// ── Learn ────────────────────────────────────────────────────────────────────

export function LearnTab() {
  const { faith } = useSleep();
  return <div>
    <Section title="How sleep works, and what helps" intro="The research behind every tool in this app, in plain words. Sources are listed so you can look them up.">
      <div className="border-t border-[var(--sl-veil)]">
        {LEARN_TOPICS.filter((t) => faith || !t.faith).map((t, i) => <details key={t.id} className="group border-b border-[var(--sl-veil)]" open={i === 0}>
          <summary className="flex cursor-pointer list-none items-start justify-between gap-3 py-4 [&::-webkit-details-marker]:hidden">
            <span><span className="sleep-serif block text-[1.1875rem] text-[var(--sl-parchment)]">{t.name}</span><span className="mt-0.5 block text-[0.9375rem]">{t.blurb}</span></span>
            <span className="sl-small mt-1 shrink-0 text-[var(--sl-faint)] group-open:hidden">Open</span><span className="sl-small mt-1 hidden shrink-0 text-[var(--sl-faint)] group-open:inline">Close</span>
          </summary>
          <ul className="pb-4">{t.cards.map((c) => <li key={c.id} className="max-w-2xl border-l-2 border-[var(--sl-veil)] py-2 pl-4">
            <p className="font-semibold text-[var(--sl-parchment)]">{c.title}</p>
            <p className="mt-1">{c.body}</p>
            {c.source && <p className="sl-small mt-1 text-[var(--sl-faint)]">Source: {c.source}</p>}
          </li>)}</ul>
        </details>)}
      </div>
    </Section>
  </div>;
}

// ── Sleep log ────────────────────────────────────────────────────────────────

const FEELINGS = ["Awful", "Poor", "Okay", "Good", "Great"];

export function LogTab() {
  const { family, setFamily, today, makeId, say, app, faith, goTab } = useSleep();
  const [date, setDate] = useState(today);
  const [bed, setBed] = useState(app.plan.bed);
  const [wake, setWake] = useState(app.plan.wake);
  const [quality, setQuality] = useState(4);
  const add = (e: FormEvent) => {
    e.preventDefault();
    setFamily((f) => ({ ...f, sleep: [...f.sleep.filter((s) => s.date !== date), { id: makeId(), date, bed, wake, quality }].sort((a, b) => a.date.localeCompare(b.date)) }));
    say(`Logged ${sleepHours(bed, wake)} hours.`);
  };
  const days = Array.from({ length: 14 }, (_, i) => addDaysTo(today, i - 13));
  const byDay = new Map(family.sleep.map((s) => [s.date, s]));
  const week = family.sleep.filter((s) => s.date > addDaysTo(today, -7));
  const avg = week.length ? week.reduce((t, s) => t + sleepHours(s.bed, s.wake), 0) / week.length : 0;
  const works = whatWorks(app).map((w) => ({ ...w, tool: toolById(w.tool) })).filter((w) => w.tool && (faith || !w.tool.faith));
  const review = pendingReview(app);

  return <div>
    {review && <div className="sl-sheet mt-6 flex flex-wrap items-center justify-between gap-3 p-4">
      <p className="text-[var(--sl-parchment)]">You haven't checked in about last night yet.</p>
      <button type="button" onClick={() => goTab("tonight")} className="sl-btn sl-quiet">Check in</button>
    </div>}

    <Section title="Last two weeks" action={avg ? <p className="text-[var(--sl-parchment)]">{avg.toFixed(1)} hours a night this week</p> : undefined}>
      <div className="flex h-48 items-end gap-1.5" role="img" aria-label="Hours slept each night for the last two weeks">
        {days.map((d) => { const s = byDay.get(d); const h = s ? sleepHours(s.bed, s.wake) : 0; return <div key={d} className="flex flex-1 flex-col items-center gap-1">
          <span className="text-[10px] font-semibold text-[var(--sl-hush)]">{h || ""}</span>
          <div className="w-full rounded-t-md" style={{ height: `${(Math.min(h, 12) / 12) * 150}px`, background: !h ? "transparent" : h < 6 ? "#d98c8c" : h < 7 ? "var(--sl-ember)" : "var(--sl-sage)" }} />
          <span className="text-[10px] font-semibold text-[var(--sl-faint)]">{new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "narrow" })}</span>
        </div>; })}
      </div>
      <p className="sl-small mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[var(--sl-faint)]">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--sl-sage)]" />7 hours or more</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[var(--sl-ember)]" />6 to 7</span>
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-[#d98c8c]" />under 6</span>
      </p>
    </Section>

    <Section title="Log a night">
      <form onSubmit={add} className="max-w-md space-y-3">
        <label className="block"><span className="sl-small text-[var(--sl-faint)]">Woke up on</span><input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="sl-input mt-1" /></label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="sl-small text-[var(--sl-faint)]">Went to bed</span><input type="time" value={bed} onChange={(e) => setBed(e.target.value)} className="sl-input mt-1" required /></label>
          <label className="block"><span className="sl-small text-[var(--sl-faint)]">Woke up</span><input type="time" value={wake} onChange={(e) => setWake(e.target.value)} className="sl-input mt-1" required /></label>
        </div>
        <div><p className="sl-small text-[var(--sl-faint)]">How did you sleep?</p>
          <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="How you slept">{FEELINGS.map((f, i) => <button key={f} type="button" role="radio" aria-checked={quality === i + 1} onClick={() => setQuality(i + 1)} className="sl-chip justify-center !px-1">{f}</button>)}</div>
        </div>
        <p className="text-[var(--sl-parchment)]">{bed && wake ? `${sleepHours(bed, wake)} hours` : ""}</p>
        <button type="submit" className="sl-btn sl-primary" disabled={!bed || !wake}>Save night</button>
      </form>
    </Section>

    <Section title="What works for you" intro="From your morning check-ins: the tools that helped, and how often.">
      {works.length
        ? <ul className="border-t border-[var(--sl-veil)]">{works.map((w) => <li key={w.tool!.id} className="flex items-center justify-between gap-3 border-b border-[var(--sl-veil)] py-3">
            <span className="font-semibold text-[var(--sl-parchment)]">{w.tool!.name}</span>
            <span className="sl-small text-[var(--sl-faint)]">Helped {w.helped} of {w.tried} {w.tried === 1 ? "night" : "nights"}</span>
          </li>)}</ul>
        : <p className="max-w-lg">Nothing yet. Try a few tools tonight, and tomorrow morning the Tonight screen will ask what helped.</p>}
    </Section>

    <Section title="Recent nights">
      {family.sleep.length
        ? <ul className="border-t border-[var(--sl-veil)]">{[...family.sleep].reverse().slice(0, 30).map((s) => <li key={s.id} className="flex items-center gap-3 border-b border-[var(--sl-veil)] py-2.5">
            <span className="w-28 shrink-0 font-semibold text-[var(--sl-parchment)] sm:w-32">{shortDate(s.date)}</span>
            <span className="min-w-0 flex-1 text-[0.9375rem]"><span className="whitespace-nowrap">{clock12(s.bed)}</span> to <span className="whitespace-nowrap">{clock12(s.wake)}</span></span>
            <span className="font-semibold text-[var(--sl-parchment)]">{sleepHours(s.bed, s.wake)} h</span>
            <span className="sl-small hidden w-12 text-[var(--sl-faint)] sm:inline">{FEELINGS[s.quality - 1] ?? ""}</span>
            <button type="button" onClick={() => { if (confirmed(`Delete the night of ${shortDate(s.date)}?`)) setFamily((f) => ({ ...f, sleep: f.sleep.filter((x) => x.id !== s.id) })); }} className="sl-btn sl-ghost sl-icon" aria-label={`Delete the night of ${shortDate(s.date)}`}><Trash2 size={15} aria-hidden /></button>
          </li>)}</ul>
        : <p>No nights logged yet. Log last night to get started.</p>}
    </Section>
  </div>;
}
