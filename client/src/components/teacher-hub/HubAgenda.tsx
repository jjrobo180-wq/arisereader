// Today, as a timeline: the time on the left, a coloured rail, then what it is — and under it
// the week's service minutes. Everything here is the teacher's own data; nothing is invented.
import { useMemo } from "react";
import type { Workspace } from "@shared/teacherHub";
import { weekStart, weeklyMinutes } from "@shared/hubProgress";

const iso = (d: Date) => [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
const shift = (date: string, days: number) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate() + days); return iso(d); };

/** "14:05" split into the parts the timeline shows: "2:05" and "PM". */
function clockParts(hhmm: string): { time: string; suffix: string } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm || "");
  if (!m) return { time: "", suffix: "" };
  const h = Number(m[1]);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { time: `${h12}:${m[2]}`, suffix };
}

type Row = { key: string; time: string; suffix: string; sort: string; title: string; meta: string; rail: string; tag: string; tagInk: string };

export default function HubAgenda({ workspace, onOpenCalendar, onOpenMeetings }: {
  workspace: Workspace;
  onOpenCalendar(): void;
  onOpenMeetings(): void;
}) {
  const today = iso(new Date());

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const e of workspace.events) {
      if (e.date !== today) continue;
      const p = clockParts(e.start);
      out.push({
        key: `e-${e.id}`, time: p.time || "All", suffix: p.suffix || "DAY", sort: e.start || "99:99",
        title: e.title || "Untitled", meta: [e.location, e.end ? `until ${clockParts(e.end).time}` : ""].filter(Boolean).join(" · "),
        rail: "var(--hub-accent, #5b3be0)", tag: "", tagInk: "",
      });
    }
    for (const m of workspace.meetings) {
      if (m.done || m.date !== today) continue;
      const p = clockParts(m.time || "");
      out.push({
        key: `m-${m.id}`, time: p.time || "—", suffix: p.suffix || "", sort: m.time || "99:99",
        title: `${m.student || "Student"} — ${m.type || "meeting"}`, meta: m.room ? `Room ${m.room}` : "IEP team meeting",
        rail: "#c2410c", tag: "IEP", tagInk: "#9a3412",
      });
    }
    return out.sort((a, b) => a.sort.localeCompare(b.sort));
  }, [workspace.events, workspace.meetings, today]);

  const minutes = useMemo(() => {
    const from = weekStart(today);
    const to = shift(from, 6);
    const met = workspace.serviceLogs
      .filter((l) => l.date >= from && l.date <= to && !l.notMet)
      .reduce((n, l) => n + (Number(l.minutes) || 0), 0);
    const owed = workspace.services.reduce((n, p) => n + weeklyMinutes(p), 0);
    return { met, owed, pct: owed > 0 ? Math.min(100, Math.round((met / owed) * 100)) : 0 };
  }, [workspace.serviceLogs, workspace.services, today]);

  return (
    <section className="min-w-0" data-testid="hub-agenda">
      <div className="flex items-baseline justify-between gap-3 border-b border-slate-200 pb-2">
        <h2 className="hub-card-title font-semibold text-slate-900">Today</h2>
        <button type="button" onClick={onOpenCalendar} className="min-h-11 shrink-0 text-sm font-medium text-teal-800 underline decoration-teal-200 underline-offset-4">
          Calendar
        </button>
      </div>

      {rows.length ? (
        <div>
          {rows.map((r) => (
            <div key={r.key} className="flex gap-4 border-b border-slate-100 py-4">
              <div className="w-12 flex-none pt-0.5 text-right">
                <div className="hub-figure text-[17px] font-normal leading-none text-slate-900">{r.time}</div>
                {r.suffix && <div className="mt-1 text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-500">{r.suffix}</div>}
              </div>
              <span className="w-[3px] flex-none rounded-full" style={{ background: r.rail }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="break-words text-[15px] font-semibold text-slate-900">{r.title}</div>
                {r.meta && <div className="mt-0.5 break-words text-[12.5px] text-slate-600">{r.meta}</div>}
              </div>
              {r.tag && (
                <button type="button" onClick={onOpenMeetings} className="flex-none self-center text-[11px] font-bold tracking-wide" style={{ color: r.tagInk }}>
                  {r.tag}
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="py-5 text-sm text-slate-600">A clear day — nothing on the calendar and no meetings booked.</p>
      )}

      {minutes.owed > 0 && (
        <div className="pt-5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Service minutes · week</span>
            <span className="hub-figure text-[15px] text-slate-900">
              {minutes.met}<span className="text-slate-500"> / {minutes.owed}</span>
            </span>
          </div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full" style={{ width: `${minutes.pct}%`, background: "var(--hub-accent, #5b3be0)" }} />
          </div>
        </div>
      )}
    </section>
  );
}
