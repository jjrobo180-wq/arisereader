// A.R.I.S.E. To-Do for parents and teachers: free for 30 days, then $10 a month for parents;
// teachers get it with Teacher Hub. Shows the trial countdown above To-Do, or how to keep it.
// Everyone else (students, personal To-Do accounts, signed-out visitors) sees To-Do as before.
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import AddonsCard from "@/components/AddonsCard";

type Todo = { access: boolean; via: string | null; trialEndsAt: string | null; trialDaysLeft: number | null };

export default function TodoGate({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
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
  if (!todo) return <div className="min-h-screen grid place-items-center arise-page-bg"><div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>;
  if (!todo.access) {
    return (
      <div className="min-h-screen arise-page-bg px-4 py-10">
        <div className="mx-auto max-w-2xl space-y-4">
          <a href="/" className="text-sm font-bold text-muted-foreground hover:text-white">← Back to A.R.I.S.E.</a>
          <h1 className="text-2xl font-black">{user!.role === "teacher" ? "To-Do comes with Teacher Hub" : "Your To-Do free trial has ended"}</h1>
          <p className="text-muted-foreground">{user!.role === "teacher" ? "One Teacher Hub subscription gives you both Teacher Hub and A.R.I.S.E. To-Do." : "Your lists and family calendar are saved. Keep To-Do to pick up where you left off."}</p>
          <AddonsCard returnPath="/billing" />
        </div>
      </div>
    );
  }
  return (
    <>
      {todo.trialDaysLeft !== null && (
        <a href={user!.role === "parent" ? "/#/parent-dashboard" : "/#/billing"} className="block bg-amber-400 px-4 py-2 text-center text-sm font-black text-slate-950" data-testid="todo-trial-bar">
          {user!.role === "teacher" ? "Teacher Hub & To-Do free trial" : "To-Do free trial"}: {todo.trialDaysLeft} day{todo.trialDaysLeft === 1 ? "" : "s"} left · {user!.role === "parent" ? "$10/month to keep it" : "Included with Teacher Hub"}
        </a>
      )}
      {children}
    </>
  );
}
