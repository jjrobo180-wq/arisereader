// The ten premium Duo looks. Each one has its own Home, calendar and signature feature, on real data.
import type { CSSProperties, ReactNode } from "react";
import type { NotesTheme } from "@shared/notesThemes";
import type { AgendaDay, LookTask } from "@/components/HubLook";
import "./premium.css";

export const PREMIUM_LOOKS = new Set<string>(["vinyl", "hush", "aurora", "atelier", "blueprint", "arcade", "typewriter", "darkroom", "zen", "cockpit"]);
export type PremiumHomeProps = { look: NotesTheme; name: string; dateLabel: string; days: AgendaDay[]; tasks: LookTask[]; open: LookTask[]; toggle: (id: string) => void; openTask: (id: string) => void; goTasks: () => void; goCalendar: () => void; hi: string; cal: ReactNode; list: ReactNode; notes: ReactNode };

const busy = (days: AgendaDay[]) => days.filter((d) => d.items.length);
const first = (d?: AgendaDay) => d?.items[0]?.title ?? "";

/** Each look's calendar. None is a restyled copy of another. */
export function PremiumCal({ look, days, big }: { look: NotesTheme; days: AgendaDay[]; big?: boolean }) {
  const today = days[0], week = days.slice(0, 7), next = busy(days), limit = big ? 10 : 4;
  if (!today) return <p className="los-none">Nothing coming up.</p>;
  const clear = <p className="los-none">Nothing coming up.</p>;
  switch (look.id) {
    case "vinyl": return <ol className="pv-tracks">{next.slice(0, limit).map((d, i) => <li key={d.date}><span>{i + 1}</span><b>{first(d)}</b><small>{d.weekday} {d.day}</small></li>)}{!next.length && <li><span>–</span><b>Nothing on this side</b></li>}</ol>;
    case "hush": return <div className="pv-line">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined} data-busy={d.items.length > 0 || undefined}>{d.day}</span>)}</div>;
    case "aurora": return <div className="pv-arc">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined} style={{ "--g": Math.min(d.items.length, 3) } as CSSProperties}><small>{d.weekday}</small><b>{d.day}</b></span>)}</div>;
    case "atelier": return <div className="pv-card"><small>{today.weekday}</small><b>{today.month} {today.day}</b><hr />{today.items.slice(0, limit).map((x) => <p key={x.id}>{x.title}{x.time && <em>{x.time}</em>}</p>)}{!today.items.length && <p>The day is yours.</p>}</div>;
    case "blueprint": return <div className="pv-sheet"><header><span>SHEET {today.month.toUpperCase()}</span><span>SCALE 1:1 WK</span></header><div>{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined}><small>{d.weekday.toUpperCase()}</small><b>{d.day.padStart(2, "0")}</b><i>{d.items.length ? `×${d.items.length}` : "—"}</i></span>)}</div></div>;
    case "arcade": return <div className="pv-map">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined} data-busy={d.items.length > 0 || undefined}><b>{d.day}</b><small>{i === 0 ? "YOU" : d.items.length ? `${d.items.length}!` : ""}</small></span>)}</div>;
    case "typewriter": return <pre className="pv-typed">{next.slice(0, limit).map((d) => `${d.weekday} ${d.day.padStart(2, "0")} ${"·".repeat(3)} ${first(d)}`).join("\n") || "Nothing typed in yet."}<i /></pre>;
    case "darkroom": return <div className="pv-film">{(big ? days.slice(0, 14) : week).map((d, i) => <span key={d.date} data-on={i === 0 || undefined}><small>{String(i + 1).padStart(2, "0")}A</small><b>{d.day}</b><em>{first(d) || d.weekday}</em></span>)}</div>;
    case "zen": return <div className="pv-stones">{week.map((d, i) => <span key={d.date} data-on={i === 0 || undefined} style={{ "--s": 1.1 + Math.min(d.items.length, 3) * .45 } as CSSProperties}><i /><small>{d.day}</small></span>)}</div>;
    case "cockpit": { const n = today.items.length; return <div className="pv-panel"><div className="pv-dial" style={{ "--a": `${-120 + Math.min(n, 6) * 40}deg` } as CSSProperties}><i /><b>{n}</b><small>TODAY</small></div><ul>{next.slice(0, 3).map((d) => <li key={d.date}><small>{d.weekday} {d.day}</small>{first(d)}</li>)}{!next.length && <li>Clear skies</li>}</ul></div>; }
    default: return clear;
  }
}

/** Each look's Home and its signature feature. */
export function PremiumHome(p: PremiumHomeProps) {
  const nextUp = p.open[0], done = p.tasks.length - p.open.length, pct = p.tasks.length ? Math.round((done / p.tasks.length) * 100) : 0;
  const Done = ({ label }: { label: string }) => nextUp ? <button type="button" className="pv-do" onClick={() => p.toggle(nextUp.id)}>{label}</button> : null;
  switch (p.look.id) {
    // Now Playing: your next task is on the turntable, and finishing it plays the next one.
    case "vinyl": return <><section className="pv-deck"><div className="pv-disc" data-live="1"><span><b>{p.open.length}</b><small>LEFT</small></span></div><i aria-hidden className="pv-arm" /><div className="pv-now"><small>Now playing</small><h1>{nextUp?.title ?? "Side finished"}</h1><Done label="Next track" /></div></section><div className="los-pad">{p.cal}{p.list}{p.notes}</div></>;
    // One Thing: nothing on screen but what's next.
    case "hush": return <div className="pv-quiet"><small>{p.dateLabel}</small><button type="button" onClick={nextUp ? () => p.openTask(nextUp.id) : p.goTasks}><h1>{nextUp?.title ?? "Nothing."}</h1></button><Done label="Done" />{p.cal}</div>;
    // Living Sky: the light moves slowly, and brightens as you finish the day.
    case "aurora": return <><section className="pv-sky" style={{ "--p": pct / 100 } as CSSProperties}><i /><i /><small>{p.dateLabel}</small><h1>{p.hi}{p.name ? `, ${p.name}` : ""}</h1><p>{pct}% of the sky is clear</p></section><div className="los-pad">{p.cal}{p.list}{p.notes}</div></>;
    // Today's Edit: only the three things that matter, set like a menu.
    case "atelier": return <div className="pv-edit"><small>{p.dateLabel}</small><h1>Today’s edit</h1><ol>{p.open.slice(0, 3).map((t, i) => <li key={t.id}><span>{["I", "II", "III"][i]}</span><button type="button" onClick={() => p.openTask(t.id)}>{t.title}</button></li>)}{!p.open.length && <li><span>—</span>Nothing to edit today.</li>}</ol>{p.cal}{p.notes}</div>;
    // Project Sheet: your day as a drawing, with live figures in the title block.
    case "blueprint": return <div className="pv-plan"><div className="pv-title"><div><small>PROJECT</small><b>{p.name || "Today"}</b></div><div><small>OPEN</small><b>{p.open.length}</b></div><div><small>DONE</small><b>{pct}%</b></div><div><small>DATE</small><b>{p.days[0]?.month} {p.days[0]?.day}</b></div></div>{p.cal}{p.list}{p.notes}</div>;
    // Levels: finished tasks earn points that fill your level bar.
    case "arcade": { const xp = done * 100, level = Math.floor(done / 5) + 1, into = (done % 5) * 20; return <div className="pv-game"><div className="pv-hud"><span>1UP {String(xp).padStart(5, "0")}</span><span>LV {level}</span></div><div className="pv-xp"><i style={{ width: `${into}%` }} /></div><h1>{nextUp ? "NEXT QUEST" : "ALL CLEAR!"}</h1><p>{nextUp?.title ?? "Press + to start a new quest"}</p><Done label="COMPLETE +100" />{p.cal}{p.list}{p.notes}</div>; }
    // Daily Page: the day is typed out for you as a letter.
    case "typewriter": return <div className="pv-page"><small>{p.dateLabel}</small><h1 key={p.dateLabel}>{`${p.hi}${p.name ? `, ${p.name}` : ""}.`}</h1><p>{p.open.length ? `${p.open.length} item${p.open.length === 1 ? "" : "s"} on the page today.` : "A blank page today."}</p>{p.cal}{p.list}{p.notes}</div>;
    // Develop: the next task develops like a photo, and the day runs on a strip of film.
    case "darkroom": return <><section className="pv-print"><i aria-hidden className="pv-lamp" /><div><small>Developing</small><h1>{nextUp?.title ?? "Nothing in the tray"}</h1><Done label="Hang to dry" /></div></section><div className="los-pad">{p.cal}{p.list}{p.notes}</div></>;
    // Stillness: raked sand and a slow breathing circle before you start.
    case "zen": return <div className="pv-garden"><div aria-hidden className="pv-breathe"><i /><i /><i /></div><small>Breathe in. Breathe out.</small><h1>{nextUp?.title ?? "All is still."}</h1><Done label="Let it go" />{p.cal}{p.notes}</div>;
    // Flight Deck: instruments for how the day is going.
    case "cockpit": return <div className="pv-flight"><div className="pv-gauges"><div className="pv-dial" style={{ "--a": `${-120 + pct * 2.4}deg` } as CSSProperties}><i /><b>{pct}</b><small>% DONE</small></div><div className="pv-read"><small>NEXT WAYPOINT</small><b>{nextUp?.title ?? "Arrived"}</b><small>{p.open.length} REMAINING</small><Done label="Engage" /></div></div>{p.cal}{p.list}{p.notes}</div>;
    default: return null;
  }
}
