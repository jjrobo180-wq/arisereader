// The Professional looks in Arise To Duo: Paper, Midnight, Folio, Nordic and Carbon (plus the four earlier
// minimal looks). Quiet and orderly, in the spirit of a classic notes app: a large title, inset grouped lists
// with hairlines, one restrained accent color and a flat, frosted bar at the bottom. Real data throughout.
import type { ReactNode } from "react";
import type { NotesTheme } from "@shared/notesThemes";
import type { AgendaDay, LookTask } from "@/components/HubLook";
import "./suite.css";

export const SUITE_OS_LOOKS = new Set<string>(["paper", "midnight", "folio", "nordic", "carbon", "editorial", "slatepro", "graphitepro", "linenpro"]);

export type SuiteHomeProps = {
  look: NotesTheme; name: string; dateLabel: string; days: AgendaDay[]; tasks: LookTask[]; open: LookTask[];
  hi: string; goTasks: () => void; goCalendar: () => void; list: ReactNode; cal: ReactNode; notes: ReactNode; shortcuts: ReactNode; hasShortcuts: boolean;
};

const Chev = () => <svg aria-hidden className="sx-chev" width="9" height="15" viewBox="0 0 9 15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m1.5 1.5 6 6-6 6" /></svg>;

/** Home: the day in words, what is next, the week, your notes. */
export function SuiteHome(p: SuiteHomeProps) {
  const left = p.open.length, done = p.tasks.length - left;
  const today = p.days[0]?.items.length ?? 0;
  const line = left === 0 ? (p.tasks.length ? "Everything is done. Nice work." : "Nothing on your list yet.") : `${left} ${left === 1 ? "task" : "tasks"} left${today ? ` · ${today} ${today === 1 ? "event" : "events"} today` : ""}`;
  const pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
  return <div className="sx-home">
    <header className="sx-top">
      <small>{p.dateLabel}</small>
      <h1>{p.hi}{p.name ? `, ${p.name}` : ""}</h1>
      <p>{line}</p>
      {p.tasks.length > 0 && <div className="sx-bar" role="img" aria-label={`${pct}% of tasks done`}><i style={{ width: `${pct}%` }} /></div>}
    </header>
    <section className="sx-sec">
      <button type="button" className="sx-head" onClick={p.goTasks}><h3>Up next</h3><span>All tasks<Chev /></span></button>
      {p.list ?? <p className="sx-empty">All clear. Add a task with the + button.</p>}
    </section>
    <section className="sx-sec">
      <button type="button" className="sx-head" onClick={p.goCalendar}><h3>This week</h3><span>Calendar<Chev /></span></button>
      {p.cal}
    </section>
    <section className="sx-sec">
      <h3 className="sx-head-plain">Notes</h3>
      {p.notes}
    </section>
    {p.hasShortcuts && <section className="sx-sec"><h3 className="sx-head-plain">Quick links</h3>{p.shortcuts}</section>}
  </div>;
}

const when = (t: string) => t || "All day";

/** The calendar: a row of days with dots for busy ones, then what is coming up. Big: the month as well. */
export function SuiteCal({ days, big }: { look: NotesTheme; days: AgendaDay[]; big?: boolean }) {
  const today = days[0];
  if (!today) return <p className="sx-empty">Nothing coming up.</p>;
  const week = days.slice(0, 7);
  const upcoming = days.filter((d) => d.items.length).slice(0, big ? 10 : 3);
  const first = new Date(`${today.date}T12:00:00`);
  const blanks = new Date(first.getFullYear(), first.getMonth(), 1).getDay();
  const total = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const busyDays = new Set(days.filter((d) => d.items.length && d.month === today.month).map((d) => Number(d.day)));
  return <div className="sx-cal">
    {big ? <div className="sx-month">
      <b>{first.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</b>
      <div>{["S", "M", "T", "W", "T", "F", "S"].map((w, i) => <small key={i}>{w}</small>)}
        {Array.from({ length: blanks }, (_, i) => <i key={`b${i}`} />)}
        {Array.from({ length: total }, (_, i) => <span key={i} data-on={i + 1 === Number(today.day) || undefined} data-busy={busyDays.has(i + 1) || undefined}>{i + 1}</span>)}
      </div>
    </div> : <div className="sx-week">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined} data-busy={d.items.length > 0 || undefined}><small>{d.weekday.slice(0, 3)}</small><b>{d.day}</b><i /></span>)}</div>}
    {upcoming.length > 0 ? <ul className="sx-agenda">{upcoming.map((d) => <li key={d.date}>
      <span className="sx-when"><small>{d.weekday.slice(0, 3)}</small><b>{d.day}</b></span>
      <span className="sx-what">{d.items.slice(0, big ? 6 : 2).map((x) => <span key={x.id}><b>{x.title}</b><small>{when(x.time)}</small></span>)}{d.items.length > (big ? 6 : 2) && <small>+{d.items.length - (big ? 6 : 2)} more</small>}</span>
    </li>)}</ul> : <p className="sx-empty">Nothing coming up.</p>}
  </div>;
}
