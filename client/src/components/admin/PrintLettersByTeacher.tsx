// Admin: print parent letters for the classes of the teachers you pick, class by class.
import { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { printParentInvites } from "@/lib/parentInvites";
import { nameForSorting } from "@shared/parentLetters";
import { INPUT_CLASS } from "./AdminUi";

export type LetterTeacher = { id: number; name: string };

export default function PrintLettersByTeacher({ open, onOpenChange, teachers, students }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teachers: LetterTeacher[];
  students: Array<{ teacherId?: number | null }>;
}) {
  const [picked, setPicked] = useState<Set<number | "none">>(new Set());
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const counts = useMemo(() => {
    const map = new Map<number | "none", number>();
    for (const s of students) { const key = s.teacherId ? s.teacherId : "none"; map.set(key, (map.get(key) || 0) + 1); }
    return map;
  }, [students]);
  const rows = useMemo(() => {
    const list: Array<{ key: number | "none"; name: string; count: number }> = teachers
      .map((t) => ({ key: t.id as number | "none", name: t.name, count: counts.get(t.id) || 0 }))
      .sort((a, b) => nameForSorting(a.name).localeCompare(nameForSorting(b.name), undefined, { sensitivity: "base" }));
    if (counts.get("none")) list.push({ key: "none", name: "No teacher yet", count: counts.get("none")! });
    return list;
  }, [teachers, counts]);
  const shown = rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()));
  const withStudents = rows.filter((r) => r.count > 0);
  const total = rows.filter((r) => picked.has(r.key)).reduce((sum, r) => sum + r.count, 0);

  const toggle = (key: number | "none") => setPicked((cur) => { const next = new Set(cur); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const print = () => {
    setError("");
    const ids = withStudents.map((r) => r.key).filter((k) => picked.has(k));
    if (!ids.length) { setError("Pick at least one teacher who has students."); return; }
    // Called straight from the click so the browser lets the print tab open.
    printParentInvites(undefined, { teacherIds: ids }).then(() => onOpenChange(false)).catch((e) => setError(e.message));
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) setError(""); onOpenChange(next); }}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-lg flex-col gap-3 p-4 sm:w-full sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-8"><Printer className="h-5 w-5 shrink-0" />Print parent letters by teacher</DialogTitle>
          <DialogDescription>Pick the teachers. You get one letter for every student in their classes, grouped by teacher, ready to hand out.</DialogDescription>
        </DialogHeader>

        {rows.length > 8 && <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a teacher" aria-label="Find a teacher" className={INPUT_CLASS} />}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <button type="button" className="min-h-9 font-semibold text-primary hover:underline" onClick={() => setPicked(new Set(withStudents.map((r) => r.key)))}>Select all</button>
          <button type="button" className="min-h-9 font-semibold text-primary hover:underline" onClick={() => setPicked(new Set())}>Clear</button>
          <span className="ml-auto text-muted-foreground" aria-live="polite">{total} letter{total === 1 ? "" : "s"}</span>
        </div>

        <ul className="min-h-0 flex-1 divide-y divide-border/60 overflow-y-auto rounded-xl border border-border/70" data-testid="print-by-teacher-list">
          {shown.length === 0 && <li className="p-4 text-sm text-muted-foreground">{rows.length === 0 ? "No teachers yet." : "No teacher matches."}</li>}
          {shown.map((r) => (
            <li key={String(r.key)}>
              <label className={`flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2 ${r.count ? "hover:bg-muted/40" : "cursor-not-allowed opacity-50"}`}>
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-orange-500" disabled={!r.count} checked={picked.has(r.key)} onChange={() => toggle(r.key)} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{r.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{r.count} student{r.count === 1 ? "" : "s"}</span>
              </label>
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="text-sm font-medium text-red-500">{error}</p>}
        <Button type="button" className="min-h-11 w-full" onClick={print} disabled={total === 0}>
          <Printer className="h-4 w-4" />{total ? `Print ${total} letter${total === 1 ? "" : "s"}` : "Pick a teacher"}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
