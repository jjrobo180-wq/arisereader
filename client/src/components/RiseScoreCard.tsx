// The Rise Score card at the top of Arise To Duo's pages: how the person is doing today, this week and this year
// (shared/riseScore.ts). Each page has its own design (the same five as the iPhone's Rise Score widgets) and its own
// on/off switch; "All pages" turns every page's card on or off at once. The choice is kept on this device.
import { useEffect, useState, type ReactElement, type ReactNode } from "react";
import { Flame, TrendingUp } from "lucide-react";
import { riseGrade, type RiseScores } from "@shared/riseScore";

export type RiseScorePage = "home" | "checklist" | "food" | "move" | "money";
const PAGES: RiseScorePage[] = ["home", "checklist", "food", "move", "money"];
const KEY = (p: RiseScorePage) => `rise-score-card.${p}`;
const CHANGED = "rise-score-card-changed";

const read = (p: RiseScorePage) => { try { return localStorage.getItem(KEY(p)) !== "off"; } catch { return true; } };
const write = (pages: RiseScorePage[], on: boolean) => {
  try { for (const p of pages) localStorage.setItem(KEY(p), on ? "on" : "off"); } catch { /* kept for this visit only */ }
  window.dispatchEvent(new Event(CHANGED));
};

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

export default function RiseScoreCard({ page, scores }: { page: RiseScorePage; scores: RiseScores }) {
  const [on, setOn, all, setAll] = useCardOn(page);
  const Design = DESIGN[page];
  return (
    <section className="mb-4" aria-label="Rise Score" data-testid={`rise-score-${page}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-slate-800">Score card</p>
          <p className="text-xs font-semibold text-slate-500">Show your Rise Score on this page</p>
        </div>
        <Switch on={on} onChange={setOn} label="Show the score card on this page" />
      </div>
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
