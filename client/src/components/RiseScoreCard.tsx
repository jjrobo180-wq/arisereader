// The Rise Score card at the top of Arise To Do's pages: how the person is doing today, this week and this year
// (shared/riseScore.ts). Each page has its own design (the same five as the iPhone's Rise Score widgets) and its own
// on/off switch; "All pages" turns every page's card on or off at once. The choice is kept on this device.
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Flame, SlidersHorizontal, TrendingUp } from "lucide-react";
import { RISE_CATEGORIES, riseGrade, type RiseCategoryId, type RiseScores } from "@shared/riseScore";

export type RiseScorePage = "home" | "checklist" | "food" | "move" | "money";
const PAGES: RiseScorePage[] = ["home", "checklist", "food", "move", "money"];
const KEY = (p: RiseScorePage) => `rise-score-card.${p}`;
const CHANGED = "rise-score-card-changed";

const read = (p: RiseScorePage) => { try { return localStorage.getItem(KEY(p)) !== "off"; } catch { return true; } };
const write = (pages: RiseScorePage[], on: boolean) => {
  try { for (const p of pages) localStorage.setItem(KEY(p), on ? "on" : "off"); } catch { /* kept for this visit only */ }
  window.dispatchEvent(new Event(CHANGED));
};

const OFF_KEY = "rise-score-off";
const readOff = (): RiseCategoryId[] => {
  try { const v = JSON.parse(localStorage.getItem(OFF_KEY) || "[]"); return Array.isArray(v) ? v.filter((x) => RISE_CATEGORIES.some((c) => c.id === x)) : []; } catch { return []; }
};
const writeOff = (off: RiseCategoryId[]) => {
  try { localStorage.setItem(OFF_KEY, JSON.stringify(off)); } catch { /* kept for this visit only */ }
  window.dispatchEvent(new Event(CHANGED));
};
/** The categories switched off on the score card (they then count nowhere, widgets included). */
export function useRiseOff(): [RiseCategoryId[], (off: RiseCategoryId[]) => void] {
  const [off, setOff] = useState(readOff);
  useEffect(() => {
    const sync = () => setOff(readOff());
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, []);
  return [off, (v) => { setOff(v); writeOff(v); }];
}

/** Whether a page's card is on, kept in step with every other card's switches. */
function useCardOn(page: RiseScorePage): [boolean, (on: boolean) => void, boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => read(page));
  const [all, setAll] = useState(() => PAGES.every(read));
  useEffect(() => {
    const sync = () => { setOn(read(page)); setAll(PAGES.every(read)); };
    window.addEventListener(CHANGED, sync);
    return () => window.removeEventListener(CHANGED, sync);
  }, [page]);
  return [on, (v) => { setOn(v); write([page], v); }, all, (v) => write(PAGES, v)];
}

const C = { card: "#1b1d3a", track: "#30345f", text: "#f6f1e9", muted: "#b7b6d8", amber: "#ffb347", teal: "#4fd1c5", coral: "#ff7a6b", lavender: "#a99bff" };

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className="inline-flex min-h-11 shrink-0 items-center">
      <span className="flex h-[31px] w-[51px] items-center rounded-full p-0.5 transition-colors" style={{ background: on ? C.amber : "#cbd5e1", justifyContent: on ? "flex-end" : "flex-start" }}>
        <span className="h-[27px] w-[27px] rounded-full bg-white shadow" />
      </span>
    </button>
  );
}

function Ring({ percent, color, size, stroke, children }: { percent: number; color: string; size: number; stroke: number; children: ReactNode }) {
  const r = (size - stroke) / 2, len = 2 * Math.PI * r;
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0" role="img" aria-label={`${percent} percent, grade ${riseGrade(percent)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={C.track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(Math.max(0, Math.min(100, percent)) / 100) * len} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div className="relative flex flex-col items-center leading-none">{children}</div>
    </div>
  );
}

const Label = ({ children, color = C.muted }: { children: ReactNode; color?: string }) => (
  <span className="text-[11px] font-extrabold uppercase tracking-[0.08em]" style={{ color }}>{children}</span>
);

function Bar({ percent, color, h = 6 }: { percent: number; color: string; h?: number }) {
  return <div className="w-full rounded-full" style={{ height: h, background: C.track }}><div className="rounded-full" style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height: h, background: color }} /></div>;
}

function Categories({ s }: { s: RiseScores }) {
  if (!s.categories.length) return <p className="text-xs font-bold" style={{ color: C.muted }}>Check off a task to start your score.</p>;
  return (
    <div className="flex flex-col gap-1.5">
      {s.categories.map((c) => (
        <div key={c.id} className="grid items-center gap-2" style={{ gridTemplateColumns: "66px minmax(0,1fr) 38px" }}>
          <span className="text-xs font-bold">{c.name}</span>
          <Bar percent={c.percent} color={c.color} />
          <span className="text-right text-xs font-extrabold">{c.percent}%</span>
        </div>
      ))}
    </div>
  );
}

function Columns({ values, labels, highlight, color, wide }: { values: number[]; labels: string[]; highlight: number; color: string; wide?: boolean }) {
  const h = wide ? 64 : 70;
  return (
    <div className="flex min-w-0 flex-1 items-end justify-between" role="img" aria-label={values.map((v, i) => (v >= 0 ? `${labels[i]} ${v} percent` : "")).filter(Boolean).join(", ")}>
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div className="flex items-end" style={{ width: wide ? 22 : 10, height: h, borderRadius: wide ? 7 : 4, background: v < 0 ? "transparent" : C.track, border: v < 0 ? "1.5px dashed #5a5e96" : undefined }}>
            {v >= 0 && <div style={{ width: "100%", height: Math.max(2, (v / 100) * h), borderRadius: wide ? 7 : 4, background: i === highlight ? C.amber : color }} />}
          </div>
          <span className="grid h-4 min-w-4 place-items-center rounded-full px-0.5 text-[11px] font-extrabold" style={i === highlight ? { background: C.amber, color: C.card } : { color: C.muted }}>{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}

const Chip = ({ children, color }: { children: ReactNode; color: string }) => (
  <span className="self-start rounded-full px-2.5 py-0.5 text-xs font-black" style={{ background: color, color: C.card }}>{children}</span>
);

/** Home: everything together (the Full Standing widget). */
function Full({ s }: { s: RiseScores }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3.5">
        <Ring percent={s.overall} color={C.amber} size={104} stroke={11}>
          <span className="text-[40px] font-black">{riseGrade(s.overall)}</span>
          <span className="mt-1 text-xs font-extrabold" style={{ color: C.muted }}>{s.overall}%</span>
        </Ring>
        <div className="flex flex-col items-start gap-1">
          <span className="text-lg font-black">Overall standing</span>
          <span className="text-xs font-bold" style={{ color: C.muted }}>Today, week and year combined</span>
          <Chip color={C.amber}>{s.overall >= 90 ? "You're at an A!" : `${90 - s.overall} pts from an A`}</Chip>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {([["Today", s.today, C.amber], ["Week", s.week, C.teal], ["Year", s.year, C.lavender]] as const).map(([l, p, c]) => (
          <div key={l} className="flex flex-col gap-1">
            <Label>{l}</Label>
            <div className="flex items-baseline gap-1.5"><span className="text-xl font-black">{p}%</span><span className="text-xs font-extrabold" style={{ color: c }}>{riseGrade(p)}</span></div>
            <Bar percent={p} color={c} h={5} />
          </div>
        ))}
      </div>
      <Categories s={s} />
      <div className="rounded-xl px-3 py-2.5" style={{ background: "#272a52" }}>
        <p className="text-[13px] font-extrabold">{s.next ? `Next up: ${s.next}` : s.tip}</p>
        <p className="text-xs font-bold" style={{ color: C.muted }}>{s.next ? s.tip : "Keep it going!"}</p>
      </div>
    </div>
  );
}

/** Checklist: today, this week and this year side by side (the Your Standing widget). */
function Trio({ s }: { s: RiseScores }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2"><Label>Your standing</Label><span className="text-xs font-extrabold" style={{ color: C.amber }}>{s.tip}</span></div>
      <div className="flex items-start justify-around">
        {([["Today", s.today, C.amber], ["Week", s.week, C.teal], ["Year", s.year, C.lavender]] as const).map(([l, p, c]) => (
          <div key={l} className="flex flex-col items-center gap-1.5">
            <Ring percent={p} color={c} size={72} stroke={8}><span className="text-lg font-black">{p}%</span></Ring>
            <span className="text-xs font-extrabold" style={{ color: c }}>{l} · {riseGrade(p)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Food: this week's grade and each day (the Week Grade widget). */
function Week({ s }: { s: RiseScores }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-[104px] shrink-0 flex-col gap-1.5">
        <Label>This week</Label>
        <div className="flex items-baseline gap-0.5 leading-none"><span className="text-[38px] font-black">{s.week}</span><span className="text-xl font-extrabold" style={{ color: C.muted }}>%</span></div>
        <Chip color={C.teal}>Grade {riseGrade(s.week)}</Chip>
        {s.streak > 0 && <span className="flex items-center gap-1 text-xs font-extrabold" style={{ color: C.amber }}><Flame size={14} aria-hidden="true" />{s.streak}-day streak</span>}
      </div>
      <Columns values={s.weekDays} labels={["M", "T", "W", "T", "F", "S", "S"]} highlight={s.todayIndex} color={C.teal} wide />
    </div>
  );
}

/** Move: this year's grade and each month (the Year Standing widget). */
function Year({ s }: { s: RiseScores }) {
  const done = s.months.filter((v) => v >= 0), climb = done.length > 1 ? done[done.length - 1] - done[0] : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="flex w-[112px] shrink-0 flex-col gap-1.5">
        <Label>This year</Label>
        <div className="flex items-baseline gap-0.5 leading-none"><span className="text-[38px] font-black">{s.year}</span><span className="text-xl font-extrabold" style={{ color: C.muted }}>%</span></div>
        <Chip color={C.lavender}>Grade {riseGrade(s.year)}</Chip>
        <span className="flex items-center gap-1 text-xs font-extrabold" style={{ color: C.amber }}><TrendingUp size={14} aria-hidden="true" />{climb > 0 ? `Up ${climb} pts` : "Keep climbing"}</span>
      </div>
      <Columns values={s.months} labels={["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]} highlight={s.monthIndex} color={C.lavender} />
    </div>
  );
}

/** Money: today's grade and each category (the Today's Breakdown widget). */
function Breakdown({ s }: { s: RiseScores }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between"><Label>Today's breakdown</Label><Label color={C.amber}>Rise score</Label></div>
      <div className="flex items-center gap-4">
        <Ring percent={s.today} color={C.amber} size={80} stroke={9}>
          <span className="text-[28px] font-black">{riseGrade(s.today)}</span>
          <span className="mt-0.5 text-xs font-extrabold" style={{ color: C.muted }}>{s.today}%</span>
        </Ring>
        <div className="min-w-0 flex-1"><Categories s={s} /></div>
      </div>
      <p className="text-xs font-extrabold" style={{ color: C.amber }}>{s.tip}</p>
    </div>
  );
}

const DESIGN: Record<RiseScorePage, (p: { s: RiseScores }) => ReactElement> = { home: Full, checklist: Trio, food: Week, move: Year, money: Breakdown };

/** Choosing what counts toward the score. */
export function Choose({ scores, onDone }: { scores: RiseScores; onDone?: () => void }) {
  const [off, setOff] = useRiseOff();
  const has = new Set(scores.categories.map((c) => c.id));
  return (
    <div className="mt-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-extrabold text-slate-800">What counts toward your score</h3>
        {onDone && <button type="button" onClick={onDone} className="min-h-11 rounded-xl px-3 text-sm font-bold text-violet-700 hover:bg-violet-50">Done</button>}
      </div>
      <p className="text-xs font-semibold text-slate-500">Switched off, a category leaves the score card and your iPhone widgets. A category shows up once you log something for it.</p>
      <ul className="mt-2 divide-y divide-slate-100">
        {RISE_CATEGORIES.map((c) => {
          const on = !off.includes(c.id);
          return (
            <li key={c.id} className="flex items-center justify-between gap-3 py-1.5">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800">{c.name}{on && !has.has(c.id) && <span className="font-semibold text-slate-500"> · nothing logged today</span>}</p>
                <p className="text-xs text-slate-500">{c.from}</p>
              </div>
              <Switch on={on} onChange={(v) => setOff(v ? off.filter((x) => x !== c.id) : [...off, c.id])} label={`Count ${c.name}`} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function RiseScoreCard({ page, scores }: { page: RiseScorePage; scores: RiseScores }) {
  const [on, setOn, all, setAll] = useCardOn(page);
  const [choosing, setChoosing] = useState(false);
  const Design = DESIGN[page];
  return (
    <section className="mb-4" aria-label="Rise Score" data-testid={`rise-score-${page}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-slate-800">Score card</p>
          <p className="text-xs font-semibold text-slate-500">Show your Rise Score on this page</p>
        </div>
        <div className="flex items-center gap-1">
          {on && <button type="button" onClick={() => setChoosing((v) => !v)} aria-expanded={choosing}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100"><SlidersHorizontal size={16} aria-hidden="true" /> Choose</button>}
          <Switch on={on} onChange={setOn} label="Show the score card on this page" />
        </div>
      </div>
      {on && choosing && <Choose scores={scores} onDone={() => setChoosing(false)} />}
      {on ? (
        <div className="mt-2 rounded-[22px] p-4" style={{ background: C.card, color: C.text, fontFamily: "Nunito, ui-rounded, system-ui, sans-serif" }}>
          <Design s={scores} />
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-2xl border-[1.5px] border-dashed border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500">
          <span>Score card hidden. Your scores keep counting.</span>
          <span className="flex items-center gap-2 text-xs font-bold text-slate-600">All pages <Switch on={all} onChange={setAll} label="Show the score card on all pages" /></span>
        </div>
      )}
    </section>
  );
}

const panel = "mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200";
const h3 = "text-[15px] font-extrabold text-slate-800";
const arrow = (now: number | null, before: number | null) => {
  if (now === null || before === null) return null;
  const d = now - before;
  if (Math.abs(d) < 3) return <span className="text-slate-500">same</span>;
  return d > 0 ? <span className="font-bold text-emerald-700">▲ {d}</span> : <span className="font-bold text-rose-700">▼ {-d}</span>;
};
const pct = (v: number | null) => (v === null ? "—" : `${v}%`);

/** Everything under the score: what's left today (red until it's done), what each grade needs, how to improve,
 *  a summary of today, the week and the year, and each category side by side. */
export function RiseInsights({ s }: { s: RiseScores }) {
  return <>
    {/* Left today: red until everything's done. */}
    {s.leftCount > 0 ? (
      <div className="mt-4 rounded-2xl border-2 border-rose-300 bg-rose-50 p-4" role="status" data-testid="rise-left">
        <div className="flex items-center gap-2">
          <span className="grid h-7 min-w-7 place-items-center rounded-full bg-rose-600 px-2 text-sm font-black text-white" aria-hidden="true">{s.leftCount}</span>
          <h3 className="text-[15px] font-extrabold text-rose-900">{s.leftCount} thing{s.leftCount === 1 ? "" : "s"} left to track today</h3>
        </div>
        <ul className="mt-2 space-y-2">
          {s.left.map((l) => (
            <li key={l.id} className="flex items-start gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-rose-100">
              <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: l.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-slate-800">{l.name}</span><span className="block text-sm text-slate-600">{l.what}</span></span>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-extrabold text-emerald-800">+{l.gain} pts</span>
            </li>
          ))}
        </ul>
      </div>
    ) : s.categories.length ? (
      <div className="mt-4 rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-[15px] font-extrabold text-emerald-900" role="status" data-testid="rise-left">All done today. Nothing left to track!</div>
    ) : null}

    {/* What each grade needs. */}
    <div className={panel} data-testid="rise-ladder">
      <h3 className={h3}>What each grade needs today</h3>
      <p className="text-xs font-semibold text-slate-500">You're at {s.today}% ({riseGrade(s.today)}). A is 90%+, B is 83%+, C is 73%+.</p>
      <ul className="mt-2 divide-y divide-slate-100">
        {s.ladder.map((r) => (
          <li key={r.grade} className="flex items-start gap-3 py-2">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-base font-black ${r.reached ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700"}`}>{r.grade}</span>
            <span className="min-w-0 flex-1 text-sm"><span className="block font-bold text-slate-800">{r.reached ? `${r.grade} reached` : `${r.need} more points for ${r.grade === "A" ? "an" : "a"} ${r.grade}`}</span><span className="block text-slate-600">{r.how}</span></span>
          </li>
        ))}
      </ul>
    </div>

    {/* How to improve. */}
    {s.improve.length > 0 && <div className={panel} data-testid="rise-improve">
      <h3 className={h3}>How to improve</h3>
      <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-700">{s.improve.map((t, i) => <li key={i}>{t}</li>)}</ol>
    </div>}

    {/* Summaries. */}
    <div className={panel} data-testid="rise-summary">
      <h3 className={h3}>Summary</h3>
      <dl className="mt-2 space-y-2 text-sm">
        {([["Today", s.summary.today], ["This week", s.summary.week], ["This year", s.summary.year]] as const).map(([k, v]) => (
          <div key={k}><dt className="text-xs font-extrabold uppercase tracking-wide text-slate-500">{k}</dt><dd className="text-slate-700">{v}</dd></div>
        ))}
      </dl>
    </div>

    {/* Each category, side by side. */}
    {s.analysis.length > 0 && <div className={panel} data-testid="rise-analysis">
      <h3 className={h3}>By category</h3>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead><tr className="text-xs font-extrabold uppercase tracking-wide text-slate-500">
            <th className="py-1.5 pr-2 font-extrabold">Category</th><th className="px-2 font-extrabold">Today</th><th className="px-2 font-extrabold">Week</th><th className="px-2 font-extrabold">vs last week</th><th className="px-2 font-extrabold">Year</th><th className="pl-2 font-extrabold">90%+ days</th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {s.analysis.map((a) => (
              <tr key={a.id}>
                <td className="py-2 pr-2 font-bold text-slate-800"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: a.color }} aria-hidden="true" />{a.name}</td>
                <td className="px-2 text-slate-700">{pct(a.today)}</td>
                <td className="px-2 text-slate-700">{a.week === null ? "—" : `${a.week}% ${riseGrade(a.week)}`}</td>
                <td className="px-2">{arrow(a.week, a.lastWeek) ?? <span className="text-slate-400">—</span>}</td>
                <td className="px-2 text-slate-700">{pct(a.year)}</td>
                <td className="pl-2 text-slate-700">{a.trackedDays ? `${a.goodDays} of ${a.trackedDays}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>}
  </>;
}

const HUBS_KEY = "rise-score-hubs";
export type RiseHubs = { family: boolean; work: boolean };
const readHubs = (): RiseHubs => { try { const v = JSON.parse(localStorage.getItem(HUBS_KEY) || "{}"); return { family: v.family === true, work: v.work === true }; } catch { return { family: false, work: false }; } };

/** The Rise Score plugin: one page for the score (no more card on every page). Choose what counts and which
 *  hubs' to-dos count toward the checklist (LifeHub always; FamilyHub and WorkHub if switched on). */
export function RiseScorePlugin({ scores, extraTasks }: { scores: (extra: { title: string; due: string; time: string; done: boolean }[]) => RiseScores; extraTasks: (hubs: RiseHubs) => Promise<{ title: string; due: string; time: string; done: boolean }[]> }) {
  const [hubs, setHubsRaw] = useState<RiseHubs>(readHubs);
  const [extra, setExtra] = useState<{ title: string; due: string; time: string; done: boolean }[]>([]);
  const [design, setDesign] = useState<RiseScorePage>(() => { try { return (localStorage.getItem("rise-score-design") as RiseScorePage) || "home"; } catch { return "home"; } });
  useEffect(() => { let live = true; void extraTasks(hubs).then((t) => { if (live) setExtra(t); }).catch(() => {}); return () => { live = false; }; }, [hubs.family, hubs.work]); // eslint-disable-line react-hooks/exhaustive-deps
  const setHubs = (h: RiseHubs) => { setHubsRaw(h); try { localStorage.setItem(HUBS_KEY, JSON.stringify(h)); } catch { /* this visit only */ } };
  const s = scores(extra);
  const Design = DESIGN[design];
  const looks: [RiseScorePage, string][] = [["home", "Full"], ["checklist", "Trio"], ["food", "Week"], ["move", "Year"], ["money", "Breakdown"]];
  return (
    <section aria-label="Rise Score" data-testid="rise-score-plugin">
      <div className="rounded-[22px] p-4" style={{ background: C.card, color: C.text, fontFamily: "Nunito, ui-rounded, system-ui, sans-serif" }}><Design s={s} /></div>
      <div className="mt-3 flex gap-1.5 overflow-x-auto [scrollbar-width:none]">{looks.map(([id, label]) => <button key={id} type="button" onClick={() => { setDesign(id); try { localStorage.setItem("rise-score-design", id); } catch { /* */ } }} aria-pressed={design === id} className={`min-h-10 shrink-0 rounded-full px-4 text-sm font-bold ${design === id ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`} data-testid={`rise-design-${id}`}>{label}</button>)}</div>
      <RiseInsights s={s} />
      <div className="mt-4 rounded-2xl bg-white p-4 ring-1 ring-slate-200" data-testid="rise-hubs">
        <h3 className="text-[15px] font-extrabold text-slate-800">Hubs that count</h3>
        <p className="text-xs font-semibold text-slate-500">To-dos from these hubs count toward your checklist score.</p>
        <ul className="mt-2 divide-y divide-slate-100">
          <li className="flex min-h-12 items-center justify-between gap-3"><span className="text-sm font-bold text-slate-800">LifeHub</span><span className="text-xs font-semibold text-slate-500">Always</span></li>
          <li className="flex items-center justify-between gap-3 py-1"><span className="text-sm font-bold text-slate-800">FamilyHub</span><Switch on={hubs.family} onChange={(v) => setHubs({ ...hubs, family: v })} label="Count FamilyHub" /></li>
          <li className="flex items-center justify-between gap-3 py-1"><span className="text-sm font-bold text-slate-800">WorkHub</span><Switch on={hubs.work} onChange={(v) => setHubs({ ...hubs, work: v })} label="Count WorkHub" /></li>
        </ul>
      </div>
      <Choose scores={s} />
    </section>
  );
}
