// Admin → Schools. Every school on the site and the classes inside it.
// Schools now arrive from sign-ups as well as from this page, so the list can
// get long: it can be searched, and a school's classes are only fetched when
// that school is opened.
import { useEffect, useMemo, useState } from "react";
import { Building, ChevronRight, PlusCircle, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import SchoolUsListMatch from "@/components/SchoolUsListMatch";

type School = { id: number; name: string; usList?: { key: string; name: string; city: string; state: string } | null; waitingForTeacherApproval?: boolean };
type ClassRow = { id: number; name: string; studentCount?: number; totalPoints?: number; quizzesCompleted?: number };
type Loaded = { state: "loading" | "ready" | "failed"; rows: ClassRow[] };

/** Small lists open by themselves; long ones stay closed until asked. */
export const OPEN_ALL_UP_TO = 4;
const PAGE = 40;

function cookieToken(): string | null {
  try {
    const c = document.cookie.split(";").map((v) => v.trim()).find((v) => v.startsWith("arise_session="));
    return c ? JSON.parse(atob(c.substring("arise_session=".length))).token || null : null;
  } catch { return null; }
}

export default function AdminSchools({ schools, onChanged }: { schools: School[]; onChanged: () => void }) {
  const { token } = useAuth();
  const [query, setQuery] = useState("");
  const [shown, setShown] = useState(PAGE);
  const [opened, setOpened] = useState<Record<number, boolean>>({});
  const [classes, setClasses] = useState<Record<number, Loaded>>({});
  const [newSchool, setNewSchool] = useState("");
  const [newClass, setNewClass] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const headers = () => ({ Authorization: `Bearer ${token || cookieToken()}`, "Content-Type": "application/json" });
  const isOpen = (id: number) => opened[id] ?? schools.length <= OPEN_ALL_UP_TO;

  const found = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? schools.filter((s) => s.name.toLowerCase().includes(q)) : schools;
  }, [schools, query]);
  const waiting = schools.filter((s) => s.waitingForTeacherApproval).length;

  const loadClasses = async (schoolId: number) => {
    setClasses((prev) => ({ ...prev, [schoolId]: { state: "loading", rows: prev[schoolId]?.rows || [] } }));
    try {
      const res = await fetch(`${API_BASE}/api/admin/schools/${schoolId}/classes`, { headers: headers() });
      const rows = res.ok ? await res.json() : null;
      if (!Array.isArray(rows)) throw new Error("no list");
      setClasses((prev) => ({ ...prev, [schoolId]: { state: "ready", rows } }));
      if (!rows.length) return;
      // Counts for each class take longer, so they are filled in after the names show.
      const statsRes = await fetch(`${API_BASE}/api/admin/schools/${schoolId}/class-stats`, { headers: headers() });
      const stats = statsRes.ok ? await statsRes.json() : null;
      if (!Array.isArray(stats)) return;
      const byId = new Map<number, ClassRow>(stats.map((c: ClassRow) => [c.id, c]));
      setClasses((prev) => ({ ...prev, [schoolId]: { state: "ready", rows: (prev[schoolId]?.rows || rows).map((c) => ({ ...c, ...(byId.get(c.id) || {}) })) } }));
    } catch {
      setClasses((prev) => ({ ...prev, [schoolId]: { state: "failed", rows: [] } }));
    }
  };

  // Fetch the classes of every school that is open and not fetched yet.
  useEffect(() => {
    for (const s of found.slice(0, shown)) if (isOpen(s.id) && !classes[s.id]) void loadClasses(s.id);
  }, [found, shown, opened, schools.length]);

  const send = async (path: string, method: "POST" | "DELETE", body?: unknown) => {
    setBusy(true); setError("");
    try {
      const res = await fetch(`${API_BASE}${path}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined });
      if (!res.ok) { const data = await res.json().catch(() => ({})); throw new Error(data.message || "That didn't save. Try again."); }
      return true;
    } catch (e: any) { setError(e?.message || "That didn't save. Try again."); return false; }
    finally { setBusy(false); }
  };

  const addSchool = async () => {
    const name = newSchool.trim();
    if (!name) return;
    if (await send("/api/admin/schools", "POST", { name })) { setNewSchool(""); setQuery(""); onChanged(); }
  };
  const addClass = async (schoolId: number) => {
    const name = (newClass[schoolId] || "").trim();
    if (!name) return;
    if (await send(`/api/admin/schools/${schoolId}/classes`, "POST", { name })) { setNewClass((prev) => ({ ...prev, [schoolId]: "" })); void loadClasses(schoolId); }
  };
  const deleteSchool = async (school: School) => {
    if (!window.confirm(`Delete school "${school.name}"? This will also delete all classes in it and unassign students.`)) return;
    if (await send(`/api/admin/schools/${school.id}`, "DELETE")) onChanged();
  };
  const deleteClass = async (schoolId: number, cls: ClassRow) => {
    if (!window.confirm(`Delete class "${cls.name}"? Students in it will be unassigned.`)) return;
    if (await send(`/api/admin/classes/${cls.id}`, "DELETE")) void loadClasses(schoolId);
  };

  const remove = "text-xs font-semibold text-red-400 hover:text-red-300 hover:bg-red-500/10 px-3 min-h-9 rounded disabled:opacity-50";
  return (
    <Card className="shadow-md" data-section="schools">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <Building className="w-5 h-5" />
          Schools & Classes
          <span className="text-sm font-normal text-muted-foreground">({schools.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <form className="flex flex-col sm:flex-row gap-2" onSubmit={(e) => { e.preventDefault(); void addSchool(); }}>
          <Input value={newSchool} onChange={(e) => setNewSchool(e.target.value)} placeholder="New school name" aria-label="New school name" className="text-sm" />
          <Button type="submit" size="sm" disabled={busy || !newSchool.trim()} className="bg-primary whitespace-nowrap">
            <PlusCircle className="w-4 h-4 mr-1" />
            Add School
          </Button>
        </form>

        {schools.length > OPEN_ALL_UP_TO && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden />
            <Input value={query} onChange={(e) => { setQuery(e.target.value); setShown(PAGE); }} placeholder="Find a school by name" aria-label="Find a school by name" className="pl-9 text-sm" />
          </div>
        )}
        {waiting > 0 && (
          <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-200">
            {waiting === 1 ? "1 school was" : `${waiting} schools were`} typed in by a teacher who is still waiting for approval. Approve the teacher under Teachers and the school shows up in the sign-up search.
          </p>
        )}
        {error && <p className="text-sm text-red-400" role="alert">{error}</p>}

        {schools.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No schools added yet. Create one above.</p>
        ) : found.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No school has “{query.trim()}” in its name.</p>
        ) : (
          <div className="space-y-3">
            {found.slice(0, shown).map((school) => {
              const open = isOpen(school.id);
              const loaded = classes[school.id];
              return (
                <div key={school.id} className="rounded-xl border border-border bg-muted/20" data-testid={`school-row-${school.id}`}>
                  <div className="flex items-center gap-2 p-2 sm:p-3">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setOpened((prev) => ({ ...prev, [school.id]: !open }))}
                      className="flex flex-1 min-w-0 items-center gap-2 min-h-11 rounded-lg px-1 text-left hover:bg-white/[.04]"
                    >
                      <ChevronRight className={`w-4 h-4 flex-shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} aria-hidden />
                      <span className="min-w-0">
                        <span className="block font-medium text-sm break-words">{school.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {school.waitingForTeacherApproval ? "Waiting for its teacher to be approved" : loaded?.state === "ready" ? `${loaded.rows.length} ${loaded.rows.length === 1 ? "class" : "classes"}` : open ? "Loading classes…" : "Show classes"}
                        </span>
                      </span>
                    </button>
                    <button type="button" disabled={busy} onClick={() => void deleteSchool(school)} className={remove}>Delete School</button>
                  </div>

                  {open && (
                    <div className="border-t border-border p-3 sm:p-4">
                      <SchoolUsListMatch school={school} onChanged={onChanged} />

                      <form className="flex flex-col sm:flex-row gap-2 mb-3" onSubmit={(e) => { e.preventDefault(); void addClass(school.id); }}>
                        <Input
                          value={newClass[school.id] || ""}
                          onChange={(e) => setNewClass({ ...newClass, [school.id]: e.target.value })}
                          placeholder="New class name"
                          aria-label={`New class name for ${school.name}`}
                          className="h-9 text-sm"
                        />
                        <Button type="submit" size="sm" disabled={busy || !(newClass[school.id] || "").trim()} className="bg-muted border border-border text-foreground hover:bg-muted/80 whitespace-nowrap h-9">
                          Add Class
                        </Button>
                      </form>

                      {loaded?.state === "failed" && (
                        <p className="text-sm text-red-400" role="alert">
                          The classes for this school didn't load.{" "}
                          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => void loadClasses(school.id)}>Try again</button>
                        </p>
                      )}
                      {loaded?.state === "ready" && loaded.rows.length === 0 && <p className="text-xs text-muted-foreground">No classes in this school yet.</p>}
                      {(loaded?.rows || []).map((cls) => (
                        <div key={cls.id} className="rounded-lg bg-background/50 p-3 mb-2">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div>
                              <span className="text-sm font-medium">{cls.name}</span>
                              {cls.studentCount !== undefined && (
                                <span className="text-xs text-muted-foreground ml-2">
                                  {cls.studentCount} students | {cls.totalPoints ?? 0} pts | {cls.quizzesCompleted ?? 0} quizzes
                                </span>
                              )}
                            </div>
                            <button type="button" disabled={busy} onClick={() => void deleteClass(school.id, cls)} className={remove}>Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {found.length > shown && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span>Showing {shown} of {found.length} schools.</span>
                <Button type="button" size="sm" variant="outline" onClick={() => setShown((n) => n + PAGE)}>Show {Math.min(PAGE, found.length - shown)} more</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
