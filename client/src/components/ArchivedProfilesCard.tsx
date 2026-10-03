import { useEffect, useMemo, useState } from "react";
import { Archive, ArchiveRestore, Search, Trash2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ArchivedProfile = {
  id: number;
  username: string;
  displayName: string;
  role: string;
  email: string | null;
  totalPoints: number;
  teacherName: string | null;
  createdAt: string;
  archivedAt: string;
  archivedBy: string | null;
};

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch {
    return null;
  }
}

const ROLE_STYLE: Record<string, string> = {
  student: "bg-violet-500/15 text-violet-300",
  "eye-gaze student": "bg-cyan-500/15 text-cyan-300",
  teacher: "bg-emerald-500/15 text-emerald-300",
  parent: "bg-amber-500/15 text-amber-300",
};
const SHOWN_AT_FIRST = 8;

/**
 * Admin: profiles that were archived (signed out, hidden from lists, rosters and
 * leaderboards, nothing deleted). Restore puts them back; Delete removes them for good.
 */
export default function ArchivedProfilesCard({ refreshKey = 0, onRestored }: { refreshKey?: number; onRestored?: () => void }) {
  const { token } = useAuth();
  const [profiles, setProfiles] = useState<ArchivedProfile[] | null>(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState("");
  const headers = () => ({ Authorization: `Bearer ${token || cookieToken()}`, "Content-Type": "application/json" });

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/archived-users`, { headers: headers(), cache: "no-store" });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error((data as any)?.message || "Could not load archived profiles.");
      setProfiles(Array.isArray(data) ? data : []);
      setError("");
    } catch (e: any) {
      setError(e?.message || "Could not load archived profiles.");
      setProfiles((p) => p ?? []);
    }
  };
  useEffect(() => { void load(); }, [token, refreshKey]);

  const restore = async (p: ArchivedProfile) => {
    setBusy(p.id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${p.id}/restore`, { method: "POST", headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not restore this profile.");
      setProfiles((list) => (list || []).filter((x) => x.id !== p.id));
      onRestored?.();
    } catch (e: any) {
      setError(e?.message || "Could not restore this profile.");
    } finally {
      setBusy(null);
    }
  };

  const deleteForGood = async (p: ArchivedProfile) => {
    if (!window.confirm(`Delete ${p.displayName} (@${p.username}) for good?\n\nTheir quizzes, points and everything else on the account are removed, and this can't be undone.`)) return;
    setBusy(p.id);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${p.id}`, { method: "DELETE", headers: headers() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Could not delete this profile.");
      setProfiles((list) => (list || []).filter((x) => x.id !== p.id));
    } catch (e: any) {
      setError(e?.message || "Could not delete this profile.");
    } finally {
      setBusy(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = profiles || [];
    return q ? list.filter((p) => `${p.displayName} ${p.username} ${p.email || ""} ${p.teacherName || ""}`.toLowerCase().includes(q)) : list;
  }, [profiles, query]);
  const shown = showAll || query ? filtered : filtered.slice(0, SHOWN_AT_FIRST);
  const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Archive className="w-5 h-5" />
          Archived profiles{profiles?.length ? ` (${profiles.length})` : ""}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Archived accounts can't sign in and are hidden from lists, rosters and leaderboards. Nothing is deleted, so you can restore them anytime.
        </p>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300" role="alert">{error}</p>}
        {!profiles && !error && <p className="text-sm text-muted-foreground">Loading…</p>}
        {profiles && profiles.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No archived profiles. Use Archive on a student, teacher or parent to put them here.</p>
        )}
        {profiles && profiles.length > SHOWN_AT_FIRST && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search archived profiles"
              aria-label="Search archived profiles"
              className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        )}
        {shown.length > 0 && (
          <ul className="space-y-2">
            {shown.map((p) => (
              <li key={p.id} className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-3 sm:flex-row sm:items-center" data-testid="archived-profile">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{p.displayName}</span>
                    <span className="text-xs text-muted-foreground">@{p.username}</span>
                    <span className={`rounded px-2 py-0.5 text-[11px] font-bold capitalize ${ROLE_STYLE[p.role] || "bg-muted text-muted-foreground"}`}>{p.role}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Archived {when(p.archivedAt)}{p.archivedBy ? ` by ${p.archivedBy}` : ""}
                    {p.teacherName ? ` · Teacher: ${p.teacherName}` : ""}
                    {p.role.includes("student") ? ` · ${p.totalPoints} points kept` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => void restore(p)} className="flex-1 sm:flex-none">
                    <ArchiveRestore className="mr-1 h-3.5 w-3.5" /> Restore
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy === p.id} onClick={() => void deleteForGood(p)} className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 sm:flex-none">
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Delete for good
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {!query && filtered.length > SHOWN_AT_FIRST && (
          <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((v) => !v)}>
            {showAll ? "Show fewer" : `Show all ${filtered.length}`}
          </Button>
        )}
        {query && filtered.length === 0 && <p className="text-sm text-muted-foreground">No archived profile matches “{query}”.</p>}
      </CardContent>
    </Card>
  );
}
