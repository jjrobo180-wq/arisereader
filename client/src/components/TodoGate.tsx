// Arise LifeHub for parents and teachers: free for 30 days, then $10 a month for parents;
// teachers get it with Arise WorkHub. While on a trial, every LifeHub tab says so (see HubTrialNote).
// When a parent's trial ends, LifeHub keeps only the A.R.I.S.E. Reader tab (the parent portal);
// a teacher without WorkHub is sent to WorkHub, where their Reader tools are.
// Everyone else (students, personal LifeHub accounts, signed-out visitors) sees LifeHub as before.
import { Suspense, createContext, lazy, useContext, useEffect, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import AddonsCard from "@/components/AddonsCard";
import { HubEndedNote, type HubTrial } from "@/components/HubTrialNote";

const ParentDashboard = lazy(() => import("@/pages/ParentDashboard"));

type Todo = { access: boolean; via: string | null; trialEndsAt: string | null; trialDaysLeft: number | null };

const TrialContext = createContext<HubTrial>(null);
/** The LifeHub free trial this person is on, if any (for the note on every tab). */
export const useLifeHubTrial = () => useContext(TrialContext);

export default function TodoGate({ children }: { children: ReactNode }) {
  const { user, token, logout } = useAuth();
  const gated = !!user && !user.isAdmin && (user.role === "parent" || user.role === "teacher");
  const [todo, setTodo] = useState<Todo | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!gated || !token) return;
    fetch(`${API_BASE}/api/addons`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setTodo(d.todo))
      .catch(() => setFailed(true));
  }, [gated, token]);

  if (!gated || failed) return <>{children}</>;
  if (!todo) return <div className="min-h-screen grid place-items-center bg-[#f6f7fc]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" /></div>;
  if (!todo.access) {
    const parent = user!.role === "parent";
    return (
      <div className="min-h-screen bg-[#f6f7fc] text-slate-900" data-testid="lifehub-reader-only">
        <header className="border-b border-[#e4e6f0] bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
            <div><span className="block text-xs font-extrabold tracking-[.16em] text-[#7e76aa]">ARISE</span><span className="block text-xl font-black tracking-tight">LifeHub<span className="text-[#7968e5]">.</span></span></div>
            <button type="button" onClick={() => { logout(); window.location.hash = "/"; }} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-slate-100"><LogOut size={15} /> Sign out</button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
          {parent ? <>
            <HubEndedNote which="life" onUpgrade={() => document.getElementById("parent-plans")?.scrollIntoView({ behavior: "smooth" })} />
            <Suspense fallback={<div className="grid min-h-[40vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" /></div>}>
              <ParentDashboard embedded />
            </Suspense>
          </> : <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-xl font-black">LifeHub comes with Arise WorkHub</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">Your WorkHub free month has ended, so LifeHub is locked too. Everything you saved is kept. Your A.R.I.S.E. Reader tools are still in WorkHub.</p>
            <a href="#/workhub" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">Open WorkHub</a>
          </section>}
          {!parent && <div className="rounded-2xl bg-[#0d0b1a] p-4 text-white"><AddonsCard returnPath="/billing" /></div>}
        </main>
      </div>
    );
  }
  const trial: HubTrial = todo.trialDaysLeft !== null && todo.trialEndsAt ? { daysLeft: todo.trialDaysLeft, endsAt: todo.trialEndsAt } : null;
  return <TrialContext.Provider value={trial}>{children}</TrialContext.Provider>;
}
