// The Reader page's "Advisory & Lit" tab: every student at the teacher's school with the Advisory
// and Literature teachers they gave in the pop-up after signing in (components/ClassTeachersPopup.tsx).
// Every teacher at the school sees the whole school; "My students" narrows it to the students who
// named them. The administrator picks a school. Rules: shared/classTeachers.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Download, Printer, RefreshCw, Search } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  SUBJECT_LABEL, groupBy, listsTeacher, nameWords, rosterCsv,
  type ClassSubject, type RosterEntry, type SchoolTeacher,
} from "@shared/classTeachers";
import { Card, Empty, Field, Select } from "./ui";

type Data = {
  schoolYear: string;
  school: { id: number; name: string } | null;
  schools?: Array<{ id: number; name: string }>;
  teachers: SchoolTeacher[];
  entries: RosterEntry[];
  me: number | null;
  noSchool?: boolean;
};
type View = "advisory" | "lit" | "all";
type Who = "mine" | "everyone";

const VIEW_LABEL: Record<View, string> = { advisory: "By Advisory", lit: "By ELA", all: "All students" };
const SCHOOL_KEY = "advisory_lit_school";
const VIEW_KEY = "advisory_lit_view";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

/** Does the search box text fit this student (their name, username, or either teacher)? */
function fits(e: RosterEntry, query: string) {
  const want = nameWords(query);
  if (!want.length) return true;
  const have = [e.name, e.username, e.advisory?.name ?? "", e.lit?.name ?? ""].flatMap(nameWords);
  return want.every((w) => have.some((h) => h.startsWith(w)));
}

function NotOnSite() {
  return <span className="ml-1.5 inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500" title="Typed by students. This teacher doesn't have an A.R.I.S.E. account at your school.">typed</span>;
}

function TeacherName({ side }: { side: RosterEntry["advisory"] }) {
  if (!side) return <span className="text-slate-400">—</span>;
  return <span className="inline-flex flex-wrap items-center">{side.name}{!side.onSite && <NotOnSite />}</span>;
}

export default function HubAdvisoryLit() {
  const { token, user } = useAuth();
  const isAdmin = !!user?.isAdmin;
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [schoolId, setSchoolId] = useState<string>(() => { try { return localStorage.getItem(SCHOOL_KEY) || ""; } catch { return ""; } });
  const [view, setViewState] = useState<View>(() => { try { const v = localStorage.getItem(VIEW_KEY); return v === "lit" || v === "all" ? v : "advisory"; } catch { return "advisory"; } });
  const [who, setWho] = useState<Who | null>(null);
  const [query, setQuery] = useState("");
  const [showMissing, setShowMissing] = useState(false);

  const setView = (v: View) => { setViewState(v); try { localStorage.setItem(VIEW_KEY, v); } catch { /* not remembered */ } };

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const q = isAdmin && schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : "";
      const r = await fetch(`${API_BASE}/api/teacher/class-teachers${q}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "The Advisory & Lit list could not be loaded.");
      setData(d as Data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "The Advisory & Lit list could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin, schoolId]);
  useEffect(() => { void load(); }, [load]);

  const entries = data?.entries ?? [];
  const me = data?.me ?? null;
  const myName = (data?.teachers || []).find((t) => t.id === me)?.displayName || "";
  const mineCount = useMemo(() => (me == null ? 0 : entries.filter((e) => listsTeacher(e, me, myName)).length), [entries, me, myName]);
  // A teacher opens on their own students when they have some; otherwise on the whole school.
  const whoNow: Who = me == null ? "everyone" : who ?? (mineCount > 0 ? "mine" : "everyone");

  const answered = entries.filter((e) => e.answered);
  const missing = entries.filter((e) => !e.answered);
  const shown = useMemo(
    () => answered.filter((e) => (whoNow === "mine" && me != null ? listsTeacher(e, me, myName) : true) && fits(e, query)),
    [answered, whoNow, me, myName, query],
  );
  const missingShown = missing.filter((e) => fits(e, query));
  const groups = view === "all" ? [] : groupBy(shown, view as ClassSubject);
  const other: Record<ClassSubject, ClassSubject> = { advisory: "lit", lit: "advisory" };

  const fileBase = `advisory-lit-${(data?.school?.name || "school").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase()}-${data?.schoolYear || ""}`;
  const download = () => {
    const blob = new Blob([rosterCsv(view === "all" ? shown : [...shown].sort((a, b) => (a[view as ClassSubject]?.name || "").localeCompare(b[view as ClassSubject]?.name || "") || a.name.localeCompare(b.name)))], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileBase}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) { setError("Your browser blocked the print window. Allow pop-ups for this site, then try again."); return; }
    const title = `${data?.school?.name || "School"} · Advisory & ELA · ${data?.schoolYear || ""}`;
    const row = (e: RosterEntry) => `<tr><td>${esc(e.name)}</td><td>${esc(e.advisory?.name || "")}</td><td>${esc(e.lit?.name || "")}</td></tr>`;
    const table = (rows: RosterEntry[]) => `<table><thead><tr><th>Student</th><th>Advisory</th><th>ELA</th></tr></thead><tbody>${rows.map(row).join("")}</tbody></table>`;
    const body = view === "all"
      ? table(shown)
      : groups.map((g) => `<h2>${esc(g.teacher)} <small>(${g.students.length})</small></h2>${table(g.students)}`).join("");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font:13px/1.4 system-ui,sans-serif;color:#111;margin:24px}h1{font-size:18px;margin:0 0 4px}p{margin:0 0 16px;color:#555}
      h2{font-size:15px;margin:20px 0 6px;break-after:avoid}small{color:#666;font-weight:normal}
      table{width:100%;border-collapse:collapse;margin-bottom:8px}th,td{border:1px solid #ccc;padding:5px 8px;text-align:left}th{background:#f3f3f3}tr{break-inside:avoid}
    </style></head><body><h1>${esc(title)}</h1><p>${esc(VIEW_LABEL[view])}${whoNow === "mine" ? " · My students" : ""} · ${shown.length} student${shown.length === 1 ? "" : "s"}</p>${body || "<p>No students to show.</p>"}</body></html>`);
    w.document.close();
    w.focus();
    window.setTimeout(() => w.print(), 250);
  };

  const pick = (v: string) => { setSchoolId(v); try { localStorage.setItem(SCHOOL_KEY, v); } catch { /* not remembered */ } };
  const btn = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50";

  return (
    <div className="space-y-4" data-testid="advisory-lit">
      {error && <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{error}</div>}

      {isAdmin && data?.schools && (
        <Card title="School">
          <div className="pt-3">
            <Select aria-label="School" value={data.school ? String(data.school.id) : ""} onChange={(e) => pick(e.target.value)} data-testid="advisory-lit-school">
              <option value="">Choose a school</option>
              {data.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </div>
        </Card>
      )}

      {loading && !data ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-3 text-sm text-slate-600"><div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" /> Loading…</div>
      ) : data?.noSchool ? (
        <Card title="Advisory & Lit"><Empty>Your account isn't linked to a school yet, so there's no school list to show. Ask the administrator to add you to your school.</Empty></Card>
      ) : !data?.school ? (
        isAdmin ? <Card title="Advisory & Lit"><Empty>Choose a school to see its students' advisories and ELA teachers.</Empty></Card> : null
      ) : (
        <>
          <Card title={data.school.name} right={
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void load()} disabled={loading} className={btn} aria-label="Refresh" title="Refresh" data-testid="advisory-lit-refresh"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button>
              <button type="button" onClick={download} disabled={!shown.length} className={btn} data-testid="advisory-lit-csv"><Download className="h-4 w-4" /><span className="hidden sm:inline">Download</span></button>
              <button type="button" onClick={print} disabled={!shown.length} className={btn} data-testid="advisory-lit-print"><Printer className="h-4 w-4" /><span className="hidden sm:inline">Print</span></button>
            </div>
          }>
            <div className="space-y-4 pt-3">
              <p className="text-sm text-slate-600">
                Students are placed in their advisory when their accounts are made, and type their ELA teacher after they sign in. Every teacher at your school sees this list.
                <span className="block text-slate-500">{data.schoolYear} school year · <strong className="font-semibold text-slate-800" data-testid="advisory-lit-count">{answered.length} of {entries.length}</strong> students have answered.</span>
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <div className="inline-flex max-w-full gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label="How to list students">
                  {(Object.keys(VIEW_LABEL) as View[]).map((v) => (
                    <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} data-testid={`advisory-lit-view-${v}`}
                      className={`inline-flex min-h-10 shrink-0 items-center rounded-lg px-3 text-sm font-semibold transition ${view === v ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>{VIEW_LABEL[v]}</button>
                  ))}
                </div>
                {me != null && (
                  <div className="inline-flex gap-1 rounded-xl bg-slate-100 p-1" role="tablist" aria-label="Whose students">
                    {(["mine", "everyone"] as Who[]).map((w) => (
                      <button key={w} type="button" role="tab" aria-selected={whoNow === w} onClick={() => setWho(w)} data-testid={`advisory-lit-who-${w}`}
                        className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition ${whoNow === w ? "bg-white text-slate-950 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
                        {w === "mine" ? <>My students <span className="rounded-full bg-slate-200 px-1.5 text-[11px] leading-5 text-slate-700">{mineCount}</span></> : "Whole school"}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Field type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search a student or teacher" aria-label="Search a student or teacher" className="pl-9" data-testid="advisory-lit-search" />
              </div>
            </div>
          </Card>

          {!shown.length ? (
            <Card><Empty>
              {query.trim()
                ? "No students match that search."
                : whoNow === "mine"
                  ? "No students are in your advisory or have named you as their ELA teacher yet. Switch to Whole school to see everyone."
                  : answered.length ? "No students to show." : "No students at your school have answered yet. They're asked the next time they sign in."}
            </Empty></Card>
          ) : view === "all" ? (
            <Card title={`${shown.length} student${shown.length === 1 ? "" : "s"}`}>
              <div className="-mx-1 overflow-x-auto pt-2">
                <table className="w-full min-w-[480px] text-left text-sm" data-testid="advisory-lit-table">
                  <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-2 py-2 font-semibold">Student</th>
                    <th scope="col" className="px-2 py-2 font-semibold">Advisory</th>
                    <th scope="col" className="px-2 py-2 font-semibold">ELA</th>
                  </tr></thead>
                  <tbody>
                    {shown.map((e) => (
                      <tr key={e.studentId} className="border-b border-slate-100 last:border-0">
                        <td className="px-2 py-2.5 font-medium text-slate-900">{e.name}</td>
                        <td className={`px-2 py-2.5 ${me != null && e.advisory?.teacherId === me ? "font-semibold text-teal-800" : "text-slate-700"}`}><TeacherName side={e.advisory} /></td>
                        <td className={`px-2 py-2.5 ${me != null && e.lit?.teacherId === me ? "font-semibold text-teal-800" : "text-slate-700"}`}><TeacherName side={e.lit} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {groups
                .filter((g) => whoNow !== "mine" || me == null || g.key === `id:${me}`)
                .sort((a, b) => (me != null ? Number(b.key === `id:${me}`) - Number(a.key === `id:${me}`) : 0))
                .map((g) => {
                  const mine = me != null && g.key === `id:${me}`;
                  const o = other[view as ClassSubject];
                  return (
                    <Card key={g.key} title={`${g.teacher}${mine ? " (you)" : ""} · ${SUBJECT_LABEL[view as ClassSubject]} · ${g.students.length}`} collapseKey={`advlit-${view}-${g.key}`}>
                      {!g.onSite && <p className="pt-2 text-xs text-slate-500">Typed by students. This teacher doesn't have an A.R.I.S.E. account at your school.</p>}
                      <ul className="divide-y divide-slate-100 pt-1" data-testid="advisory-lit-group">
                        {g.students.map((e) => (
                          <li key={e.studentId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-0.5 py-2.5 text-sm">
                            <span className="font-medium text-slate-900">{e.name}</span>
                            <span className="text-slate-500">{SUBJECT_LABEL[o]}: <span className="text-slate-700"><TeacherName side={e[o]} /></span></span>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  );
                })}
              {whoNow === "mine" && me != null && !groups.some((g) => g.key === `id:${me}`) && (
                <Card><Empty>No students named you as their {SUBJECT_LABEL[view as ClassSubject]} teacher. Try {view === "advisory" ? "By ELA" : "By Advisory"}.</Empty></Card>
              )}
            </div>
          )}

          {whoNow === "everyone" && missing.length > 0 && (
            <Card title={`Not answered yet · ${missing.length}`} right={
              <button type="button" onClick={() => setShowMissing((v) => !v)} aria-expanded={showMissing} className={btn} data-testid="advisory-lit-missing-toggle">{showMissing ? "Hide" : "Show"}</button>
            }>
              {showMissing
                ? <ul className="grid grid-cols-1 gap-x-4 pt-2 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3" data-testid="advisory-lit-missing">
                    {missingShown.map((e) => <li key={e.studentId} className="py-1.5">{e.name}</li>)}
                    {!missingShown.length && <li className="py-1.5 text-slate-500">No one matches that search.</li>}
                  </ul>
                : <p className="pt-2 text-sm text-slate-500">These students are asked the next time they sign in.</p>}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
