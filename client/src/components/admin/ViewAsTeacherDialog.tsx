import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Eye, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";

type Teacher = { id: number; username: string; displayName: string; schoolName: string | null; [k: string]: any };

/**
 * Admin: pick a real teacher account and see the app exactly as that teacher does, to check
 * their students, books and quizzes look right. View only: changes are blocked on the server.
 */
export default function ViewAsTeacherDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { token, startViewAsTeacher } = useAuth();
  const [, navigate] = useLocation();
  const [teachers, setTeachers] = useState<Teacher[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open || teachers) return;
    fetch(`${API_BASE}/api/admin/view-as/teachers`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => { const d = await r.json().catch(() => null); if (!r.ok) throw new Error(d?.message || "Teachers could not be loaded."); setTeachers(Array.isArray(d) ? d : []); })
      .catch((e) => setError(e.message || "Teachers could not be loaded."));
  }, [open, teachers, token]);

  const shown = useMemo(() => {
    const k = q.trim().toLowerCase();
    const all = teachers || [];
    return k ? all.filter((t) => [t.displayName, t.username, t.schoolName || ""].some((v) => String(v).toLowerCase().includes(k))) : all;
  }, [teachers, q]);

  const pick = (t: Teacher) => {
    startViewAsTeacher(t as any);
    onOpenChange(false);
    navigate(/(^|\.)arisereader\.com$/i.test(window.location.hostname) ? "/reader" : "/workhub");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-hidden p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2"><Eye className="h-5 w-5" />View as a teacher</DialogTitle>
          <p className="text-sm text-muted-foreground">See the app exactly as a real teacher does: their students, books and quiz results. View only, so nothing can be changed. Press Exit in the bar at the top to come back.</p>
        </DialogHeader>
        <div className="px-5 pb-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, username or school" className="pl-9" aria-label="Search teachers" />
          </div>
        </div>
        <div className="max-h-[55vh] overflow-y-auto px-3 pb-4">
          {error ? <p className="px-2 py-6 text-center text-sm text-destructive">{error}</p>
            : !teachers ? <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading teachers…</p>
            : shown.length === 0 ? <p className="px-2 py-6 text-center text-sm text-muted-foreground">No teachers match "{q}".</p>
            : shown.map((t) => (
              <button key={t.id} type="button" onClick={() => pick(t)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-muted">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-black text-primary">{String(t.displayName || "?").replace(/^(mr|mrs|ms|miss|dr)\.?\s*/i, "").charAt(0).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{t.displayName}</span>
                  <span className="block truncate text-xs text-muted-foreground">@{t.username}{t.schoolName ? ` · ${t.schoolName}` : ""}</span>
                </span>
                <span className="flex-shrink-0 text-xs font-bold text-primary">View</span>
              </button>
            ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
