// Arise LifeHub · Sleep: Tonight. The first screen: one question, "What's keeping you up?", and
// for each answer the few tools most likely to help, in the order to try them. In the morning it
// asks how the night went and remembers which tools helped.
import { useMemo, useState } from "react";
import { Check, Star } from "lucide-react";
import { pendingReview, partOfNight, reviewNight, saveReview, toolsTried, whatWorks, type SleepReview } from "@shared/sleepApp";
import { QUICK_START, SCENARIOS, scenarioSteps, toolById } from "@shared/sleepContent";
import { useSleep } from "./context";
import { Section } from "./parts";
import { shortDate } from "../ui";

function greeting(part: ReturnType<typeof partOfNight>, name: string) {
  const you = name ? `, ${name}` : "";
  if (part === "day") return { line: "Planning ahead for tonight.", sub: "Good sleep starts hours before bed. Make a plan, or try a tool now so it feels familiar later." };
  if (part === "evening") return { line: `Evening${you}. Time to start slowing down.`, sub: "Dim the lights, put tomorrow on paper, and pick something calm." };
  if (part === "late") return { line: `It's late${you}. Let's get you to sleep.`, sub: "Tell me what's going on, and I'll give you the best few things to try, in order." };
  return { line: "You're awake in the night. That's okay.", sub: "Don't check the time. Let's settle you back down." };
}

export function TonightTab() {
  const { app, update, faith, launch, goTab, firstName } = useSleep();
  const [picked, setPicked] = useState<string | null>(null);
  const now = new Date();
  const hello = greeting(partOfNight(now), firstName);
  const review = pendingReview(app, now);
  const morning = reviewNight(now);
  // In the morning, every thought still parked: last night's first, then any older ones not yet handled.
  const parked = morning ? app.parked.filter((p) => p.night <= morning && !p.done).reverse().slice(0, 20) : [];
  const olderParked = parked.some((p) => p.night !== morning);
  const works = useMemo(() => whatWorks(app).filter((w) => { const t = toolById(w.tool); return t && (faith || !t.faith); }).slice(0, 3), [app, faith]);
  const favs = app.favorites.map(toolById).filter((t): t is NonNullable<typeof t> => !!t && (faith || !t.faith)).filter((t) => !works.some((w) => w.tool === t.id)).slice(0, 4);
  const quick = QUICK_START.map((id) => toolById(id)).filter((t): t is NonNullable<typeof t> => !!t && (faith || !t.faith));

  return <div>
    {review && <CheckIn night={review} />}

    <div className="mt-8">
      <h1 className="sl-display max-w-2xl">{hello.line}</h1>
      <p className="mt-3 max-w-xl text-[1.0625rem]">{hello.sub}</p>
    </div>

    {parked.length > 0 && <Section title={olderParked ? "What you parked" : "What you parked last night"} intro="Here they are, safe and sound. Check off what's handled.">
      <ul>{parked.map((p) => <li key={p.id} className="flex items-center gap-3 border-b border-[var(--sl-veil)] py-3">
        <button type="button" onClick={() => update((a) => ({ ...a, parked: a.parked.map((x) => (x.id === p.id ? { ...x, done: true } : x)) }))} aria-label={`Mark “${p.text}” as handled`} className="sl-btn sl-quiet sl-icon shrink-0"><Check size={16} aria-hidden /></button>
        <span className="min-w-0">
          <span className="block text-[var(--sl-parchment)]">{p.text}</span>
          {p.night !== morning && <span className="sl-small block text-[var(--sl-faint)]">From the night of {shortDate(p.night)}</span>}
        </span>
      </li>)}</ul>
    </Section>}

    <section className="mt-10" aria-labelledby="sleep-question">
      <h2 id="sleep-question" className="sl-title">{partOfNight(now) === "day" ? "What usually keeps you up?" : "What's keeping you up?"}</h2>
      <div className="mt-3 border-t border-[var(--sl-veil)]">
        {SCENARIOS.map((s) => {
          const on = picked === s.id;
          const steps = scenarioSteps(s, faith);
          return <div key={s.id}>
            <button type="button" className="sl-choice" aria-pressed={on} aria-expanded={on} onClick={() => setPicked(on ? null : s.id)} data-testid={`sleep-scenario-${s.id}`}>
              <span className="sl-dot" aria-hidden />{s.label}
            </button>
            {on && <div className="border-b border-[var(--sl-veil)] pb-6 pl-5 pt-2 sm:pl-6">
              <p className="sleep-serif max-w-2xl text-[1.0625rem] italic leading-relaxed text-[var(--sl-hush)]">{s.note}</p>
              {s.help && <p className="sl-small mt-3 max-w-xl text-[var(--sl-parchment)]">{s.help}</p>}
              <p className="sl-small mt-5 text-[var(--sl-faint)]">Try these, in this order. Stop whenever you feel sleepy.</p>
              <ol className="mt-2">{steps.map((step, i) => {
                const tool = toolById(step.tool)!;
                return <li key={step.tool} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-x-3 border-b border-[var(--sl-veil)] py-3 last:border-b-0">
                  <span className="sleep-serif pt-0.5 text-[1.25rem] leading-none text-[var(--sl-ember)]" aria-hidden>{i + 1}</span>
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--sl-parchment)]">{tool.name}</p>
                    <p className="mt-0.5 text-[0.9375rem]">{step.tip}</p>
                  </div>
                  <button type="button" onClick={() => launch(tool.id)} className="sl-btn sl-quiet">{tool.kind === "journal" ? "Write" : tool.kind === "screen" ? "Turn on" : "Start"}</button>
                </li>;
              })}</ol>
            </div>}
          </div>;
        })}
      </div>
    </section>

    {works.length > 0 && <Section title="What's worked for you" intro="From your morning check-ins.">
      <ul>{works.map((w) => { const t = toolById(w.tool)!; return <li key={w.tool} className="flex items-center justify-between gap-3 border-b border-[var(--sl-veil)] py-3">
        <div className="min-w-0"><p className="font-semibold text-[var(--sl-parchment)]">{t.name}</p><p className="sl-small text-[var(--sl-faint)]">Helped {w.helped} of {w.tried} {w.tried === 1 ? "night" : "nights"} you tried it</p></div>
        <button type="button" onClick={() => launch(t.id)} className="sl-btn sl-quiet">Start</button>
      </li>; })}</ul>
    </Section>}

    {favs.length > 0 && <Section title="Your favorites">
      <ul>{favs.map((t) => <li key={t.id} className="flex items-center justify-between gap-3 border-b border-[var(--sl-veil)] py-3">
        <p className="flex min-w-0 items-center gap-2 font-semibold text-[var(--sl-parchment)]"><Star size={15} className="shrink-0 fill-[var(--sl-ember)] text-[var(--sl-ember)]" aria-hidden />{t.name}</p>
        <button type="button" onClick={() => launch(t.id)} className="sl-btn sl-quiet">Start</button>
      </li>)}</ul>
    </Section>}

    <Section title="Or just start something">
      <div className="flex flex-wrap gap-2">{quick.map((t) => <button key={t.id} type="button" onClick={() => launch(t.id)} className="sl-chip">{t.name}</button>)}</div>
    </Section>

    <p className="sl-small mt-12 max-w-xl text-[var(--sl-faint)]">
      No single trick works for everyone, so this app keeps track of what you try. Each morning, tell it what helped, and your best tools rise to the top. Trouble most nights for three months or more is worth talking to a doctor about; <button type="button" onClick={() => goTab("learn")} className="underline decoration-[var(--sl-line)] underline-offset-4 hover:text-[var(--sl-parchment)]">see when to get help</button>.
    </p>
  </div>;
}

function CheckIn({ night }: { night: string }) {
  const { app, update, makeId, say, goTab, faith } = useSleep();
  const tried = toolsTried(app, night).map(toolById).filter((t): t is NonNullable<typeof t> => !!t && (faith || !t.faith));
  const [fell, setFell] = useState<SleepReview["fell"] | null>(null);
  const [helped, setHelped] = useState<string[]>([]);
  const save = () => {
    update((a) => saveReview(a, night, fell ?? "ok", helped, makeId));
    say(helped.length ? "Got it. Those will move up your list." : "Got it. Thanks for checking in.");
  };
  return <section className="sl-sheet mt-6 p-5 sm:p-6" aria-labelledby="sleep-checkin">
    <h2 id="sleep-checkin" className="sl-heading">Good morning. How did last night go?</h2>
    <p className="mt-1 text-[0.9375rem]">How long did it take to fall asleep?</p>
    <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="How long it took to fall asleep">
      {([["fast", "Pretty quickly"], ["ok", "A while"], ["slow", "A long time"]] as const).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={fell === id} onClick={() => setFell(id)} className="sl-chip">{label}</button>)}
    </div>
    {tried.length > 0 && <>
      <p className="mt-5 text-[0.9375rem]">You tried these. Which helped?</p>
      <div className="mt-3 flex flex-wrap gap-2">{tried.map((t) => { const on = helped.includes(t.id); return <button key={t.id} type="button" aria-pressed={on} onClick={() => setHelped((h) => (on ? h.filter((x) => x !== t.id) : [...h, t.id]))} className="sl-chip">{on && <Check size={14} aria-hidden />}{t.name}</button>; })}</div>
    </>}
    <div className="mt-6 flex flex-wrap gap-2">
      <button type="button" onClick={save} disabled={!fell} className="sl-btn sl-primary">Save check-in</button>
      <button type="button" onClick={() => goTab("log")} className="sl-btn sl-quiet">Log my hours</button>
    </div>
  </section>;
}
