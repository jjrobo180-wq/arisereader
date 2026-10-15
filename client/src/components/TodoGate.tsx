// Arise LifeHub is free for every signed-in adult — no trial, no gating. This gate is kept
// disabled (`gated = false` below) as a no-op passthrough in case gating is ever needed again.
import { Suspense, createContext, lazy, useContext, useEffect, useState, type ReactNode } from "react";
import { LogOut } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import HubAddons from "@/components/hub-pieces/HubAddons";
import { HubEndedNote, type HubTrial } from "@/components/HubTrialNote";
import { goToSignIn } from "@/lib/hubs";

const Reader = lazy(() => import("@/components/family-hub/Reader"));

type Todo = { access: boolean; via: string | null; endsAt: string | null };

const TrialContext = createContext<HubTrial>(null);
/** Always null now — LifeHub has no trial. Kept so callers that read it don't need to change. */
export const useLifeHubTrial = () => useContext(TrialContext);

export default function TodoGate({ children }: { children: ReactNode }) {
  const { user, token, logout } = useAuth();
  const gated = false; // A.R.I.S.E. To-Do is always free for adult accounts.
  const [todo, setTodo] = useState<Todo | null>(null);
  const [failed, setFailed] = useState(false);
  // A short note after a save on the Reader-only page, like LifeHub's own.
  const [note, setNote] = useState("");
  useEffect(() => { if (!note) return; const t = window.setTimeout(() => setNote(""), 3500); return () => window.clearTimeout(t); }, [note]);

  useEffect(() => {
    if (!gated || !token) return;
    fetch(`${API_BASE}/api/addons`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setTodo(d.todo))
      .catch(() => setFailed(true));
  }, [gated, token]);

  if (!gated || failed) return <>{children}</>;
  if (!todo) return <div className="min-h-screen grid grid-cols-1 place-items-center bg-[#f6f7fc]"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" /></div>;
  if (!todo.access) {
    const parent = user!.role === "parent";
    return (
      <div className="min-h-screen bg-[#f6f7fc] text-slate-900" data-testid="lifehub-reader-only">
        <header className="border-b border-[#e4e6f0] bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4">
            <div><span className="block text-xs font-extrabold tracking-[.16em] text-[#7e76aa]">ARISE</span><span className="block text-xl font-black tracking-tight">LifeHub<span className="text-[#7968e5]">.</span></span></div>
            <button type="button" onClick={() => { logout(); goToSignIn(); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-bold text-slate-500 hover:bg-slate-100"><LogOut size={15} /> Sign out</button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl space-y-5 px-4 py-6">
          {parent ? <>
            <HubEndedNote which="life" onUpgrade={() => document.getElementById("parent-plans")?.scrollIntoView({ behavior: "smooth" })} />
            <Suspense fallback={<div className="grid grid-cols-1 min-h-[40vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-600 border-t-transparent" /></div>}>
              <Reader say={setNote} />
            </Suspense>
          </> : <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h1 className="text-xl font-black">LifeHub comes with Arise WorkHub</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">LifeHub needs a WorkHub plan. Everything you saved is kept. Your A.R.I.S.E. Reader tools are still in WorkHub.</p>
            <a href="#/workhub" className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-semibold text-white">Open WorkHub</a>
          </section>}
          {!parent && <section className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-4 shadow-[0_8px_28px_#17152b08] sm:p-5"><p className="text-[11px] font-extrabold uppercase tracking-[.15em] text-violet-600">Add-ons</p><h2 className="mb-4 mt-0.5 text-lg font-black text-[#232139]">Plans and add-ons</h2><HubAddons which="life" /></section>}
        </main>
        {note && <div role="status" className="fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] left-1/2 z-[600] w-[min(92vw,440px)] -translate-x-1/2 rounded-2xl bg-[#292446] px-4 py-3 text-center text-sm font-semibold text-white shadow-[0_18px_40px_#16152a40]">{note}</div>}
      </div>
    );
  }
  return <TrialContext.Provider value={null}>{children}</TrialContext.Provider>;
}
