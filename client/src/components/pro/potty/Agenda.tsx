// Agenda: the day in plain text. The parent adds what the child ate and drank; the app says when
// to sit them on the toilet and what to expect, the parent marks how each sit went (or when a pee
// or poop happened), and the bottom says when this child usually goes.
import { useState } from "react";
import { Copy } from "lucide-react";
import { useTick } from "../kit";
import { DRINK_TYPES, agendaText, buildAgenda, clockOf, mlToOz, ozToMl, sitText, usualTimes, type DrinkType, type Kind, type Sit } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Note, Panel, Section } from "./theme";

type Pick = DrinkType | "meal" | "snack";
const PICKS: { id: Pick; label: string; emoji: string }[] = [
  ...DRINK_TYPES.filter((d) => d.id !== "other" && d.id !== "smoothie").map((d) => ({ id: d.id as Pick, label: d.label, emoji: d.emoji })),
  { id: "meal", label: "Meal", emoji: "🍽️" }, { id: "snack", label: "Snack", emoji: "🍎" },
];
const OZ = [1, 2, 3, 4, 6, 8, 10, 12], ML = [30, 60, 90, 120, 180, 240, 300, 360];
const AGO: [string, number][] = [["Just now", 0], ["15 min ago", 15], ["30 min ago", 30], ["1 hour ago", 60]];
const RESULTS: { kind: Kind; label: string }[] = [{ kind: "pee", label: "💧 Peed" }, { kind: "poop", label: "💩 Pooped" }, { kind: "both", label: "🌟 Both" }, { kind: "try", label: "🪑 Sat, nothing" }];

function until(ms: number) { const m = Math.round((ms - Date.now()) / 60_000); return m <= 0 ? "now" : m < 60 ? `in ${m} min` : `in ${Math.floor(m / 60)} h ${m % 60} min`; }

export default function Agenda() {
  const { data, kid, log, openLog } = usePotty();
  useTick(true, 30_000);
  const [pick, setPick] = useState<Pick>("bottle");
  const [ml, setMl] = useState<number | undefined>();
  const [ago, setAgo] = useState(0);
  const [copied, setCopied] = useState(false);
  const units = data.units;
  const now = Date.now();
  const agenda = buildAgenda(data.logs, kid, units, now);
  const usual = usualTimes(data.logs, kid, now);
  const isDrink = pick !== "meal" && pick !== "snack";
  const vol = (v: number) => (units === "oz" ? `${mlToOz(v)} oz` : `${v} ml`);

  const add = () => {
    const at = Date.now() - ago * 60_000;
    if (isDrink) log("drink", { at, drink: pick as DrinkType, ml });
    else log("food", { at, size: pick as "meal" | "snack" });
    setMl(undefined); setAgo(0);
  };
  // A sit that is still ahead is marked "now"; one that was missed is marked at its planned time.
  const mark = (s: Sit, kind: Kind) => log(kind, { at: s.state === "missed" ? s.at : Date.now(), init: "schedule" });
  const copy = async () => {
    try { await navigator.clipboard.writeText(agendaText(agenda, kid, units, usual.lines)); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked: nothing to do */ }
  };
  const i = agenda.intake;
  const totals = [i.totalMl ? `${vol(i.totalMl)} to drink` : "", i.bottles ? `${i.bottles} bottle${i.bottles === 1 ? "" : "s"} (${vol(i.bottleMl)})` : "", i.juiceMl ? `juice ${vol(i.juiceMl)}` : "", i.meals ? `${i.meals} meal${i.meals === 1 ? "" : "s"}` : "", i.snacks ? `${i.snacks} snack${i.snacks === 1 ? "" : "s"}` : ""].filter(Boolean);

  return <div className="space-y-7">
    <Panel tone="night">
      <p className="text-sm text-white/60">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl">{kid.name}'s agenda</h1>
      {agenda.next
        ? <div className="mt-4 rounded-2xl bg-white/[.09] p-4">
            <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: C.duck }}>Next sit {agenda.next.state === "due" ? "— now" : until(agenda.next.at)}</p>
            <p className="mt-1 text-lg font-extrabold leading-snug">🚽 {sitText(agenda.next)}</p>
          </div>
        : <p className="mt-4 text-sm leading-snug text-white/70">Nothing to plan yet. Add what {kid.name} just ate or drank below and the agenda will say when to sit them on the toilet.</p>}
    </Panel>

    <Section title="What did they eat or drink?" sub="Add it as it happens (or a little late). Bottles and juice with the amount teach the timing fastest.">
      <Panel>
        <div className="flex flex-wrap gap-1.5">{PICKS.map((p) => <Chip key={p.id} on={pick === p.id} onClick={() => { setPick(p.id); setMl(undefined); }}><span>{p.emoji}</span>{p.label}</Chip>)}</div>
        {isDrink && <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[13px] font-bold" style={{ color: C.muted }}>How much?</span>{(units === "oz" ? OZ : ML).map((v) => { const m = units === "oz" ? ozToMl(v) : v; return <Chip key={v} on={ml === m} onClick={() => setMl(ml === m ? undefined : m)}>{v} {units}</Chip>; })}</div>}
        <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[13px] font-bold" style={{ color: C.muted }}>When?</span>{AGO.map(([l, m]) => <Chip key={m} on={ago === m} onClick={() => setAgo(m)}>{l}</Chip>)}</div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Btn2 kind="duck" onClick={add}>Add to the agenda</Btn2>{isDrink && !ml && <span className="text-[13px]" style={{ color: C.muted }}>Pick an amount so the pee timing is accurate.</span>}</div>
      </Panel>
    </Section>

    <Section title="Today, in order" action={<Btn2 kind="ghost" onClick={copy}><Copy size={14} />{copied ? "Copied" : "Copy as text"}</Btn2>}
      sub={totals.length ? `Today: ${totals.join(" · ")}.` : undefined}>
      {agenda.lines.length ? <ul className="divide-y divide-[#E3E8F1] overflow-hidden rounded-[22px] bg-white" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>
        {agenda.lines.map((l) => <li key={l.id} className="px-4 py-3" style={l.sit?.state === "due" ? { background: C.duckSoft } : undefined}>
          <div className="flex items-start gap-3">
            <span className="w-[4.5rem] shrink-0 pt-0.5 text-[13px] font-bold tabular-nums" style={{ color: C.muted }}>{clockOf(l.at)}</span>
            <span className="text-xl leading-none">{l.emoji}</span>
            {l.entry
              ? <button type="button" onClick={() => openLog({ edit: l.entry })} className="min-w-0 flex-1 text-left text-sm font-bold leading-snug">{l.text}{l.entry.note ? <span className="block text-xs font-normal" style={{ color: C.muted }}>{l.entry.note}</span> : null}</button>
              : <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold leading-snug">{l.text}</p>
                  {l.sit && <div className="mt-2 flex flex-wrap items-center gap-1.5"><span className="mr-1 text-[12px] font-bold" style={{ color: C.muted }}>{l.sit.state === "missed" ? "Did it happen then?" : "How did it go?"}</span>{RESULTS.map((r) => <Chip key={r.kind} onClick={() => mark(l.sit!, r.kind)}>{r.label}</Chip>)}</div>}
                </div>}
          </div>
        </li>)}
      </ul> : <p className="rounded-2xl bg-white px-4 py-3 text-sm" style={{ color: C.muted, boxShadow: `inset 0 0 0 1.5px ${C.line}` }}>Nothing yet today. Add a drink or meal above.</p>}
      <div className="mt-3 flex flex-wrap gap-2"><Btn2 kind="ghost" onClick={() => log("pee")}>💧 Peed (potty)</Btn2><Btn2 kind="ghost" onClick={() => log("poop")}>💩 Pooped (potty)</Btn2><Btn2 kind="ghost" onClick={() => log("acc-pee")}>💦 Pee accident</Btn2><Btn2 kind="ghost" onClick={() => log("acc-poop")}>🧻 Poop accident</Btn2><Btn2 kind="ghost" onClick={() => openLog({})}>More…</Btn2></div>
    </Section>

    <Section title={`When ${kid.name} usually goes`} sub="Worked out from the last two weeks of what you logged.">
      <Panel>
        <ul className="space-y-2">{usual.lines.map((t) => <li key={t} className="text-sm leading-snug">{t}</li>)}</ul>
        {usual.learning && <div className="mt-3"><Note tone="tip">The more you log — every drink, meal, pee and poop, including diapers and accidents — the sharper these get. Until then the agenda uses the typical toddler timing.</Note></div>}
      </Panel>
    </Section>
  </div>;
}
