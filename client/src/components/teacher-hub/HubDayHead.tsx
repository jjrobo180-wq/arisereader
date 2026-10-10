// The top of Arise WorkHub's Home: today's date, what the next fortnight looks like, and the
// three counts the old banner carried. The strip's bars are real load — events plus meetings
// still to happen on each day — so a glance says which days are heavy before anything is read.
import { useMemo } from "react";
import type { Workspace } from "@shared/teacherHub";

const SPAN = 14;
const iso = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");

export default function HubDayHead({ workspace, firstName, onOpenCalendar }: {
  workspace: Workspace;
  firstName: string;
  onOpenCalendar(): void;
}) {
  const now = new Date();
  const todayKey = iso(now);

  const strip = useMemo(() => {
    const days: { key: string; n: number; date: number }[] = [];
    for (let i = 0; i < SPAN; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      const key = iso(d);
      const n = workspace.events.filter((e) => e.date === key).length
        + workspace.meetings.filter((m) => !m.done && m.date === key).length;
      days.push({ key, n, date: d.getDate() });
    }
    return days;
  }, [workspace.events, workspace.meetings]);

  const busiest = Math.max(1, ...strip.map((d) => d.n));
  const todayLoad = strip[0]?.n ?? 0;
  const openTasks = workspace.tasks.filter((t) => !t.done).length;
  const meetings = workspace.meetings.filter((m) => !m.done).length;
  const stats = [
    { label: "Students", value: workspace.students.length },
    { label: "Open tasks", value: openTasks },
    { label: "Meetings", value: meetings },
  ];

  return (
    <section className="min-w-0" data-testid="hub-day-head">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
        <div className="flex items-end gap-4">
          <div className="hub-figure text-[64px] leading-[0.78] sm:text-[80px]">{now.getDate()}</div>
          <div className="pb-1.5">
            <div className="hub-figure text-xl font-light sm:text-2xl">{now.toLocaleDateString(undefined, { weekday: "long" })}</div>
            <div className="mt-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              {now.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
        <dl className="flex gap-7 sm:gap-9">
          {stats.map((s) => (
            <div key={s.label}>
              <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{s.label}</dt>
              <dd className="hub-figure mt-1 text-[28px] leading-none">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="mt-6 flex items-end gap-1.5" style={{ height: 48 }}>
        {strip.map((d) => {
          const today = d.key === todayKey;
          const height = Math.max(5, Math.round((d.n / busiest) * 34));
          return (
            <button
              key={d.key}
              type="button"
              onClick={onOpenCalendar}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5 rounded-md py-1"
              aria-label={`${new Date(`${d.key}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} — ${d.n} on the calendar`}
            >
              <span className={`hub-bar ${today ? "hub-bar-today" : d.n >= busiest * 0.66 && d.n > 0 ? "hub-bar-busy" : ""}`} style={{ height }} />
              <span className={`text-[10px] font-semibold ${today ? "text-slate-900" : "text-slate-500"}`}>{d.date}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-sm text-slate-600">
        {firstName ? `Good day, ${firstName}. ` : ""}
        {todayLoad === 0 ? "Nothing on the calendar today." : `${todayLoad} on the calendar today.`}
      </p>
    </section>
  );
}
