// A two-way switch in the top bar between a teacher's Arise WorkHub and their Arise LifeHub.
// Both use the same sign-in, so switching never asks to log in again.
import { CheckCheck, GraduationCap } from "lucide-react";

export default function HubSwitch({ current, night }: { current: "hub" | "todo"; night?: boolean }) {
  const item = (on: boolean) => `inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-bold transition sm:px-3 ${on
    ? night ? "bg-slate-200 text-slate-900" : "bg-slate-900 text-white"
    : night ? "text-slate-300 hover:text-white" : "text-slate-500 hover:text-slate-900"}`;
  return <nav aria-label="Switch app" className={`inline-flex shrink-0 items-center gap-0.5 rounded-xl p-1 ring-1 ${night ? "bg-slate-800 ring-slate-700" : "bg-slate-100 ring-slate-200"}`} data-testid="hub-todo-switch">
    <a href="#/workhub" aria-current={current === "hub" ? "page" : undefined} className={item(current === "hub")} title="Arise WorkHub"><GraduationCap size={15} /><span className="hidden sm:inline">WorkHub</span></a>
    <a href="#/lifehub" aria-current={current === "todo" ? "page" : undefined} className={item(current === "todo")} title="Arise LifeHub"><CheckCheck size={15} /><span className="hidden sm:inline">LifeHub</span></a>
  </nav>;
}
