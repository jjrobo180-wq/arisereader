// The top of every Hub screen: its name in light figures with the count that matters on it,
// so a screen announces itself the way the date announces Home.
import type { HubTab, Workspace } from "@shared/teacherHub";

/** The number worth showing beside each screen's name. Screens with nothing to count show none. */
function countFor(tab: HubTab, w: Workspace): number | null {
  switch (tab) {
    case "calendar": return w.events.length;
    case "goals": return w.goals.length;
    case "minutes": return w.services.length;
    case "iep": return w.meetings.filter((m) => !m.done).length;
    case "lessons": return w.lessons.length;
    case "tasks": return w.tasks.filter((t) => !t.done && !t.archived).length;
    case "notes": return w.notes.length;
    case "behavior": return w.behavior.length;
    case "attendance": return w.attendance.length;
    case "gradebook": return w.assignments.length;
    case "parents": return w.parentLogs.length;
    case "schedules": return w.schedules.length;
    case "email": return w.emails.length;
    default: return null;
  }
}

export default function HubPageHead({ tab, title, workspace }: { tab: HubTab; title: string; workspace: Workspace }) {
  const count = countFor(tab, workspace);
  return (
    <section className="min-w-0" data-testid={`hub-page-head-${tab}`}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="hub-figure text-[40px] leading-none sm:text-[46px]">{title}</h1>
        {count !== null && <span className="hub-figure text-[20px] text-slate-500">{count}</span>}
      </div>
    </section>
  );
}
