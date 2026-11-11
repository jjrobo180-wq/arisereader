// Admin: the Arise Reader scholarship and grant applications (from /scholarship).
// Approving one marks it; the free plan itself is given above with "Give a plan by hand".
import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type Application = { id: string; at: string; who: string; name: string; email: string; username: string; school: string; students: string; program: string; reason: string; status: "new" | "approved" | "declined" };

export default function AdminScholarships() {
  const { token } = useAuth();
  const [list, setList] = useState<Application[] | null>(null);
  const [show, setShow] = useState<"new" | "all">("new");
  const auth = { Authorization: `Bearer ${token}` };
  const load = () => fetch(`${API_BASE}/api/admin/reader-scholarships`, { headers: auth, cache: "no-store" }).then((r) => r.json()).then((d) => setList(d.applications || [])).catch(() => setList([]));
  useEffect(() => { if (token) load(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps
  const mark = async (id: string, status: Application["status"]) => {
    await fetch(`${API_BASE}/api/admin/reader-scholarships/${encodeURIComponent(id)}`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
    load();
  };
  const rows = (list || []).filter((a) => show === "all" || a.status === "new");
  return (
    <Card className="shadow-md border-violet-500/30" data-testid="admin-scholarships">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2"><GraduationCap className="w-5 h-5 text-violet-400" />Reader scholarships and grants
          <span className="text-xs font-normal text-muted-foreground">{(list || []).filter((a) => a.status === "new").length} new</span>
          <span className="ml-auto flex gap-1">{(["new", "all"] as const).map((v) => <button key={v} type="button" onClick={() => setShow(v)} className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${show === v ? "bg-violet-600 text-white" : "bg-muted"}`}>{v === "new" ? "New" : "All"}</button>)}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">From the "Apply for a free account" form on the pricing page. To give a free account, use "Give a plan by hand" above (a family plan for a parent's account ID, or a teacher or school plan), then mark it approved and email them.</p>
        {list === null ? <p className="text-sm">Loading…</p> : rows.length === 0 ? <p className="text-sm text-muted-foreground">No {show === "new" ? "new " : ""}applications.</p> : rows.map((a) => (
          <div key={a.id} className="rounded-xl border p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <b>{a.name}</b><span className="text-muted-foreground">{a.who === "family" ? "Family" : a.who === "teacher" ? "Teacher" : "School"}</span>
              <a className="text-violet-500 underline" href={`mailto:${a.email}`}>{a.email}</a>
              <span className="ml-auto text-xs text-muted-foreground">{new Date(a.at).toLocaleDateString()} · {a.status}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{[a.username && `@${a.username}`, a.school, a.students && `${a.students} students`, a.program && `Program: ${a.program}`].filter(Boolean).join(" · ")}</div>
            <p className="mt-2 whitespace-pre-wrap">{a.reason}</p>
            <div className="mt-2 flex gap-2">
              <button type="button" onClick={() => mark(a.id, "approved")} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Approved</button>
              <button type="button" onClick={() => mark(a.id, "declined")} className="rounded-lg bg-muted px-3 py-1.5 text-xs font-bold">Declined</button>
              {a.status !== "new" && <button type="button" onClick={() => mark(a.id, "new")} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground">Back to new</button>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
