// A two-way switch in the top bar between a teacher's Teacher Hub and their A.R.I.S.E. To-Do.
// Both use the same sign-in, so switching never asks to log in again.
import { CheckCheck, GraduationCap } from "lucide-react";

export default function HubSwitch({ current, night }: { current: "hub" | "todo"; night?: boolean }) {
  const item = (on: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition sm:px-3 ${on
    ? night ? "bg-slate-200 text-slate-900" : "bg-slate-900 text-white"
    : night ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}`;
  return <nav aria-label="Switch app" className={`inline-flex shrink-0 items-center gap-0.5 rounded-xl p-1 ring-1 ${night ? "bg-slate-800 ring-slate-700" : "bg-slate-100 ring-slate-200"}`} data-testid="hub-todo-switch">
    <a href="#/teacher-hub" aria-current={current === "hub" ? "page" : undefined} className={item(current === "hub")} title="Teacher Hub"><GraduationCap size={15} /><span className="hidden sm:inline">Teacher Hub</span></a>
    <a href="#/to-do" aria-current={current === "todo" ? "page" : undefined} className={item(current === "todo")} title="A.R.I.S.E. To-Do"><CheckCheck size={15} /><span className="hidden sm:inline">To-Do</span></a>
  </nav>;
}
