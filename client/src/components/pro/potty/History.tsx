// Log & charts: the same log seen six ways — a day's timeline, a week diary (the bladder & bowel
// chart continence nurses use), a month calendar, charts, the full list, and a report to print or
// download for the doctor or daycare.
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Printer } from "lucide-react";
import { Chart, downloadCsv, esc, printPage } from "../kit";
import { BRISTOL, KINDS, labelOf, addDay, ageText, clockOf, dayOf, dayStats, daysBack, healthFlags, isAccident, isPoopEvent, isSuccess, rhythm, sumStats, type Entry, type Kind } from "@shared/pro/potty";
import { usePotty } from "./ctx";
import { Btn2, C, Chip, Empty2, Note, Panel, Section, pct } from "./theme";

type View = "day" | "week" | "month" | "charts" | "list" | "report";
const fmt = (day: string, o: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, o);

export default function History() {
  const { data, kid, openLog, months } = usePotty();
  const [view, setView] = useState<View>("day");
  const [day, setDay] = useState(dayOf(Date.now()));
  const mine = useMemo(() => data.logs.filter((x) => x.kid === kid.id).sort((a, b) => a.at - b.at), [data.logs, kid.id]);
  const units = data.units;
  const vol = (ml: number) => (units === "oz" ? `${Math.round(ml / 29.57)} oz` : `${ml} ml`);
  if (!mine.length) return <Empty2 icon="📒" title="Nothing logged yet" text="Log potty trips, accidents, diapers, drinks and meals on Today. Everything shows up here as a timeline, a weekly diary, a calendar and charts." action={<Btn2 kind="ink" onClick={() => openLog({})}>Log something</Btn2>} />;
  return <div className="space-y-6">
    <div className="flex flex-wrap gap-1.5">{([["day", "Day"], ["week", "Week diary"], ["month", "Month"], ["charts", "Charts"], ["list", "Full list"], ["report", "Doctor report"]] as const).map(([v, l]) => <Chip key={v} on={view === v} onClick={() => setView(v)}>{l}</Chip>)}</div>
    {view === "day" && <DayView day={day} setDay={setDay} entries={mine.filter((e) => dayOf(e.at) === day)} vol={vol} />}
    {view === "week" && <WeekView entries={mine} end={day} setEnd={setDay} />}
    {view === "month" && <MonthView entries={mine} kidId={kid.id} onPick={(d) => { setDay(d); setView("day"); }} />}
    {view === "charts" && <Charts entries={mine} kidId={kid.id} vol={vol} />}
    {view === "list" && <ListView entries={mine} vol={vol} />}
    {view === "report" && <Report entries={mine} months={months} vol={vol} />}
  </div>;

  function DayView({ day, setDay, entries, vol }: { day: string; setDay: (d: string) => void; entries: Entry[]; vol: (ml: number) => string }) {
    const s = dayStats(data.logs, kid.id, day);
    let last = 0;
    return <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2"><Btn2 kind="plain" title="Previous day" onClick={() => setDay(addDay(day, -1))}><ChevronLeft size={16} /></Btn2><h2 className="text-xl font-extrabold">{fmt(day, { weekday: "long", month: "long", day: "numeric" })}</h2><Btn2 kind="plain" title="Next day" disabled={day >= dayOf(Date.now())} onClick={() => setDay(addDay(day, 1))}><ChevronRight size={16} /></Btn2><span className="flex-1" /><Btn2 onClick={() => openLog({ at: new Date(`${day}T12:00:00`).getTime() })}>+ Add to this day</Btn2></div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{[["In potty", s.successes], ["Accidents", s.accidents], ["Success", pct(s.rate)], ["Self-started", pct(s.selfRate)], ["Poops", s.poops], ["Drinks", vol(s.drinksMl)]].map(([l, v]) => <div key={String(l)} className="rounded-2xl bg-white px-3 py-2" style={{ boxShadow: `inset 0 0 0 1.5px ${C.line}` }}><p className="ph text-lg font-extrabold">{v}</p><p className="text-[11px] font-bold" style={{ color: C.muted }}>{l}</p></div>)}</div>
      {entries.length ? <Panel><ol className="relative ml-3 border-l-2" style={{ borderColor: C.line }}>{entries.map((e) => {
        const gap = last && (isSuccess(e.kind) || isAccident(e.kind) || e.kind === "diaper-wet") ? Math.round((e.at - last) / 60_000) : null;
        if (isSuccess(e.kind) || isAccident(e.kind) || e.kind === "diaper-wet") last = e.at;
        return <li key={e.id} className="relative mb-3 ml-5 last:mb-0">
          <span className="absolute -left-[31px] top-1 flex h-6 w-6 items-center justify-center rounded-full text-sm" style={{ background: `${KINDS[e.kind].color}26` }}>{KINDS[e.kind].emoji}</span>
          <button type="button" onClick={() => openLog({ edit: e })} className="w-full rounded-xl px-2 py-1 text-left hover:bg-slate-50"><p className="text-sm"><b className="tabular-nums">{clockOf(e.at)}</b> <span className="font-bold">{labelOf(e, KINDS[e.kind].label)}</span>{e.ml ? ` · ${vol(e.ml)}` : ""}{e.bristol ? ` · type ${e.bristol}` : ""}{e.init === "self" ? " · started by child" : e.init === "prompted" ? " · you asked" : e.init === "schedule" ? " · timer" : ""}{e.where ? ` · ${e.where}` : ""}</p>
            {(e.note || gap) && <p className="text-xs" style={{ color: C.muted }}>{gap && gap < 400 ? `${gap} min since the last pee. ` : ""}{e.note}</p>}</button>
        </li>; })}</ol></Panel> : <Empty2 icon="🗓️" title="Nothing on this day" text="Pick another day or add an entry." />}
    </div>;
  }
}

function WeekView({ entries, end, setEnd }: { entries: Entry[]; end: string; setEnd: (d: string) => void }) {
  const days = daysBack(7, end); const hours = Array.from({ length: 16 }, (_, i) => i + 6);
  return <Section title="Week diary" sub="The bladder & bowel chart continence nurses use: each row is a day, each column an hour. Patterns jump out — the same accident time every day, poops after breakfast." action={<div className="flex gap-1.5"><Btn2 kind="plain" title="Earlier week" onClick={() => setEnd(addDay(end, -7))}><ChevronLeft size={16} /></Btn2><Btn2 kind="plain" title="Later week" disabled={end >= dayOf(Date.now())} onClick={() => setEnd(addDay(end, 7) > dayOf(Date.now()) ? dayOf(Date.now()) : addDay(end, 7))}><ChevronRight size={16} /></Btn2></div>}>
    <Panel pad={false} className="overflow-x-auto p-3"><table className="w-full min-w-[760px] border-separate border-spacing-0.5 text-center text-[11px]">
      <thead><tr><th className="w-24" />{hours.map((h) => <th key={h} className="font-bold" style={{ color: C.muted }}>{h % 12 || 12}{h < 12 ? "a" : "p"}</th>)}</tr></thead>
      <tbody>{days.map((d) => <tr key={d}><th className="whitespace-nowrap pr-2 text-left text-[12px] font-bold">{fmt(d, { weekday: "short", month: "numeric", day: "numeric" })}</th>{hours.map((h) => {
        const cell = entries.filter((e) => dayOf(e.at) === d && new Date(e.at).getHours() === h && e.kind !== "note");
        const bad = cell.some((e) => isAccident(e.kind)); const good = cell.some((e) => isSuccess(e.kind));
        return <td key={h} className="h-10 rounded-lg align-middle" title={cell.map((e) => `${clockOf(e.at)} ${KINDS[e.kind].label}`).join("\n")} style={{ background: bad ? "#FDECEA" : good ? "#E6F6EE" : cell.length ? "#F1F4F9" : "#FAFBFD" }}><span className="text-[13px] leading-none">{cell.slice(0, 3).map((e) => KINDS[e.kind].emoji).join("")}</span></td>;
      })}</tr>)}</tbody></table>
      <p className="mt-2 text-xs" style={{ color: C.muted }}>Green: potty success that hour. Red: an accident. Hover or long-press a cell for times.</p></Panel>
  </Section>;
}

function MonthView({ entries, kidId, onPick }: { entries: Entry[]; kidId: string; onPick: (d: string) => void }) {
  const [ym, setYm] = useState(() => dayOf(Date.now()).slice(0, 7));
  const [y, m] = ym.split("-").map(Number); const first = new Date(y, m - 1, 1); const daysIn = new Date(y, m, 0).getDate();
  const cells: (string | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${ym}-${String(i + 1).padStart(2, "0")}`)];
  const shift = (n: number) => { const d = new Date(y, m - 1 + n, 1); setYm(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  return <Section title={first.toLocaleDateString(undefined, { month: "long", year: "numeric" })} sub="Each day coloured by potty success. Tap a day to see it." action={<div className="flex gap-1.5"><Btn2 kind="plain" title="Previous month" onClick={() => shift(-1)}><ChevronLeft size={16} /></Btn2><Btn2 kind="plain" title="Next month" onClick={() => shift(1)}><ChevronRight size={16} /></Btn2></div>}>
    <Panel><div className="grid grid-cols-7 gap-1.5 text-center">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <span key={i} className="text-xs font-bold" style={{ color: C.muted }}>{d}</span>)}
      {cells.map((d, i) => { if (!d) return <span key={i} />; const s = dayStats(entries, kidId, d); const has = s.successes + s.accidents + s.diapers > 0; const night = entries.find((e) => dayOf(e.at) === d && (e.kind === "night-dry" || e.kind === "night-wet"));
        const bg = !has ? "#F4F6FA" : s.rate === null ? "#EEF2F8" : s.rate >= 0.8 ? "#BFE9D3" : s.rate >= 0.5 ? "#FFE7A8" : "#F8C9C0";
        return <button key={d} type="button" onClick={() => onPick(d)} className="flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-bold transition hover:ring-2" style={{ background: bg, outline: d === dayOf(Date.now()) ? `2px solid ${C.ink}` : undefined }}>
          <span>{Number(d.slice(8))}</span><span className="text-[10px] leading-none">{s.poops ? "💩" : ""}{night ? (night.kind === "night-dry" ? "🌙" : "🛏️") : ""}</span></button>; })}
    </div>
    <div className="mt-3 flex flex-wrap gap-3 text-xs" style={{ color: C.muted }}><span><span className="mr-1 inline-block h-3 w-3 rounded" style={{ background: "#BFE9D3" }} />8 in 10 or better</span><span><span className="mr-1 inline-block h-3 w-3 rounded" style={{ background: "#FFE7A8" }} />Half or more</span><span><span className="mr-1 inline-block h-3 w-3 rounded" style={{ background: "#F8C9C0" }} />Mostly accidents</span><span>💩 poop · 🌙 dry night · 🛏️ wet night</span></div></Panel>
  </Section>;
}

function Charts({ entries, kidId, vol }: { entries: Entry[]; kidId: string; vol: (ml: number) => string }) {
  const days = daysBack(21); const per = days.map((d) => dayStats(entries, kidId, d)); const lab = days.map((d) => fmt(d, { month: "numeric", day: "numeric" }));
  const r = rhythm(entries, kidId); const acc = Array(24).fill(0); for (const e of entries) if (isAccident(e.kind)) acc[new Date(e.at).getHours()]++;
  const types = BRISTOL.map((b) => entries.filter((e) => isPoopEvent(e.kind) && e.bristol === b.type).length);
  const hrs = Array.from({ length: 16 }, (_, i) => i + 6); const hl = hrs.map((h) => `${h % 12 || 12}${h < 12 ? "a" : "p"}`);
  return <div className="grid gap-5 lg:grid-cols-2">
    <Panel><h3 className="mb-2 font-extrabold">Potty success, last 3 weeks</h3><Chart kind="line" labels={lab} series={[{ name: "% in the potty", values: per.map((p) => (p.rate === null ? 0 : Math.round(p.rate * 100))) }, { name: "% started by your child", values: per.map((p) => (p.selfRate === null ? 0 : Math.round(p.selfRate * 100))) }]} colors={[C.good, C.sleep]} height={220} legend /></Panel>
    <Panel><h3 className="mb-2 font-extrabold">Wins and accidents per day</h3><Chart kind="column" labels={lab} series={[{ name: "In the potty", values: per.map((p) => p.successes) }, { name: "Accidents", values: per.map((p) => p.accidents) }]} colors={[C.pee, C.accident]} height={220} legend /></Panel>
    <Panel><h3 className="mb-2 font-extrabold">When pees and accidents happen</h3><Chart kind="column" labels={hl} series={[{ name: "Pees (anywhere)", values: hrs.map((h) => r.peeByHour[h]) }, { name: "Accidents", values: hrs.map((h) => acc[h]) }]} colors={[C.pee, C.accident]} height={220} legend /><p className="mt-1 text-xs" style={{ color: C.muted }}>Last 14 days. Remind 10–15 minutes before the tall bars.</p></Panel>
    <Panel><h3 className="mb-2 font-extrabold">When poops happen</h3><Chart kind="column" labels={hl} series={[{ name: "Poops", values: hrs.map((h) => r.poopByHour[h]) }]} colors={[C.poop]} height={220} /><p className="mt-1 text-xs" style={{ color: C.muted }}>{r.mealToPoop ? `Usually about ${r.mealToPoop} min after eating.` : "Log meals too, and the app learns how soon after eating your child poops."}</p></Panel>
    <Panel><h3 className="mb-2 font-extrabold">Poop types</h3><Chart kind="bar" labels={BRISTOL.map((b) => `Type ${b.type}`)} series={[{ name: "Poops", values: types }]} colors={[C.poop]} height={220} /><p className="mt-1 text-xs" style={{ color: C.muted }}>Types 3–4 are ideal. Lots of 1–2 means constipation.</p></Panel>
    <Panel><h3 className="mb-2 font-extrabold">Drinks per day</h3><Chart kind="column" labels={lab} series={[{ name: "Drinks", values: per.map((p) => p.drinks) }]} colors={[C.drink]} height={220} /><p className="mt-1 text-xs" style={{ color: C.muted }}>Aim for 6–8 drinks a day. Last 3 weeks total: {vol(per.reduce((s, p) => s + p.drinksMl, 0))}.</p></Panel>
  </div>;
}

function ListView({ entries, vol }: { entries: Entry[]; vol: (ml: number) => string }) {
  const { openLog } = usePotty();
  const [f, setF] = useState<"all" | "potty" | "accident" | "diaper" | "sleep" | "intake">("all"); const [n, setN] = useState(60);
  const shown = [...entries].reverse().filter((e) => f === "all" || KINDS[e.kind].group === f);
  return <Section title="Everything logged" sub="Tap any entry to change or delete it.">
    <div className="mb-3 flex flex-wrap gap-1.5">{([["all", "All"], ["potty", "Potty"], ["accident", "Accidents"], ["diaper", "Diapers"], ["sleep", "Naps & nights"], ["intake", "Food & drink"]] as const).map(([v, l]) => <Chip key={v} on={f === v} onClick={() => setF(v)}>{l}</Chip>)}</div>
    <Panel pad={false}><ul className="divide-y divide-[#E3E8F1]">{shown.slice(0, n).map((e) => <li key={e.id}><button type="button" onClick={() => openLog({ edit: e })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-slate-50">
      <span className="w-28 text-xs font-bold" style={{ color: C.muted }}>{fmt(dayOf(e.at), { month: "short", day: "numeric" })}, {clockOf(e.at)}</span><span className="text-lg">{KINDS[e.kind].emoji}</span>
      <span className="min-w-0 flex-1 text-sm leading-snug"><b>{labelOf(e, KINDS[e.kind].label)}</b>{e.ml ? ` · ${vol(e.ml)}` : ""}{e.bristol ? ` · type ${e.bristol}` : ""}{e.note ? ` — ${e.note}` : ""}</span></button></li>)}</ul></Panel>
    {shown.length > n && <Btn2 className="mt-3" onClick={() => setN(n + 100)}>Show more</Btn2>}
  </Section>;
}

function Report({ entries, months, vol }: { entries: Entry[]; months: number | null; vol: (ml: number) => string }) {
  const { kid, data } = usePotty();
  const [span, setSpan] = useState(14);
  const days = daysBack(span); const sum = sumStats(entries, kid.id, days); const r = rhythm(entries, kid.id, Date.now(), span);
  const flags = healthFlags(entries, kid.id).filter((f) => f.level !== "info");
  const inRange = entries.filter((e) => days.includes(dayOf(e.at)));
  const poops = inRange.filter((e) => isPoopEvent(e.kind));
  const summary: [string, string][] = [
    ["Child", `${kid.name}${months !== null ? `, ${ageText(months)}` : ""}`], ["Period", `${fmt(days[0], { month: "short", day: "numeric" })} – ${fmt(days[days.length - 1], { month: "short", day: "numeric", year: "numeric" })}`],
    ["Potty successes / accidents", `${sum.successes} / ${sum.accidents} (${pct(sum.rate)} in the potty)`], ["Started by the child", pct(sum.selfRate)],
    ["Typical time between pees", r.peeGap ? `${r.peeGap} min` : "not enough data"], ["Poops", `${poops.length} in ${span} days (${(poops.length / span).toFixed(1)} a day)`],
    ["Poop types logged", poops.filter((p) => p.bristol).map((p) => p.bristol).join(", ") || "none recorded"], ["Painful poops", String(poops.filter((p) => p.pain).length)],
    ["Drinks", `${inRange.filter((e) => e.kind === "drink").length} logged, ${vol(inRange.reduce((s, e) => s + (e.ml || 0), 0))}`],
    ["Dry / wet nights", `${inRange.filter((e) => e.kind === "night-dry").length} / ${inRange.filter((e) => e.kind === "night-wet").length}`],
  ];
  const print = () => printPage(`${kid.name} – bladder and bowel diary`, `<h1>${esc(kid.name)} — bladder & bowel diary</h1><p class="muted">From the Arise Potty Training app. ${esc(summary[1][1])}.</p>
    <table>${summary.map(([a, b]) => `<tr><th style="width:34%">${esc(a)}</th><td>${esc(b)}</td></tr>`).join("")}</table>
    ${flags.length ? `<h2>Flags</h2><ul>${flags.map((f) => `<li><b>${esc(f.title)}</b> — ${esc(f.text)}</li>`).join("")}</ul>` : ""}
    <h2>Day by day</h2>${days.map((d) => { const l = inRange.filter((e) => dayOf(e.at) === d); return l.length ? `<h3 style="margin:12px 0 4px;font-size:14px">${esc(fmt(d, { weekday: "long", month: "short", day: "numeric" }))}</h3><table><tr><th style="width:80px">Time</th><th>What</th><th>Details</th></tr>${l.map((e) => `<tr><td>${esc(clockOf(e.at))}</td><td>${esc(labelOf(e, KINDS[e.kind].label))}</td><td>${esc([e.ml ? vol(e.ml) : "", e.bristol ? `stool type ${e.bristol}` : "", e.pain ? "painful" : "", e.init === "self" ? "child started" : e.init ? "prompted" : "", e.where, e.note].filter(Boolean).join(" · "))}</td></tr>`).join("")}</table>` : ""; }).join("")}
    <p class="muted" style="margin-top:20px">Stool types follow the Bristol Stool Scale (1–2 hard, 3–4 ideal, 6–7 loose).</p>`);
  const csv = () => downloadCsv(`${kid.name}-potty-log`, [["Date", "Time", "What", "Amount (ml)", "Stool type", "Painful", "Started by", "Where", "Note"], ...inRange.map((e) => [dayOf(e.at), clockOf(e.at), labelOf(e, KINDS[e.kind].label), e.ml || "", e.bristol || "", e.pain ? "yes" : "", e.init || "", e.where || "", e.note || ""])]);
  return <Section title="Report for the doctor or daycare" sub="A bladder & bowel diary with a summary — exactly what pediatricians and continence nurses ask for." action={<div className="flex flex-wrap gap-1.5">{[7, 14, 30].map((n) => <Chip key={n} on={span === n} onClick={() => setSpan(n)}>{n} days</Chip>)}</div>}>
    <Panel><dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">{summary.map(([a, b]) => <div key={a}><dt className="text-xs font-bold" style={{ color: C.muted }}>{a}</dt><dd className="text-sm font-bold">{b}</dd></div>)}</dl>
      {flags.length > 0 && <div className="mt-4 space-y-2">{flags.map((f) => <Note key={f.title} tone={f.level === "doctor" ? "doctor" : "warn"}><b>{f.title}.</b> {f.text}</Note>)}</div>}
      <div className="mt-4 flex flex-wrap gap-2"><Btn2 kind="ink" onClick={print}><Printer size={15} />Print or save as PDF</Btn2><Btn2 onClick={csv}><Download size={15} />Download spreadsheet (CSV)</Btn2></div>
      <p className="mt-2 text-xs" style={{ color: C.muted }}>{data.logs.length} entries saved in total for all children.</p></Panel>
  </Section>;
}

export const kindLabel = (k: Kind) => KINDS[k].label;
