// WorkHub's Attendance plugin: take attendance in a few taps (everyone present, then change who isn't), with
// minutes late and a note when needed. Each tap saves. Reports show each student's rate (present and tardy
// over the days counted; excused days don't count against them). Families see their child's attendance,
// and hear about an absence or a tardy the same day, when the teacher shares it (ShareCard).
// The server side is server/classRecords.ts.
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCheck, ChevronLeft, ChevronRight, Download, MessageSquareText } from "lucide-react";
import { useSavedChoice } from "@/lib/useSavedChoice";
import { downloadCsv, shortDay } from "@/lib/records";
import { ATTENDANCE, ATTENDANCE_NAMES, addDays, type AttendanceMark, type AttendanceStatus } from "@shared/classRecords";
import { HubModal } from "./HubModal";
import { Avatar, Btn, ErrorNote, Loading, Panel, PluginHead, ShareCard, ink, useRecords, useRecordsSetup } from "./records/RecordsUI";

type Row = { id: number; name: string; present: number; tardy: number; absent: number; excused: number; days: number; rate: number | null; last: Array<{ day: string } & AttendanceMark> };
type Data = { day: string; today: string; marks: Record<string, AttendanceMark>; students: Row[] };
type View = "take" | "reports" | "settings";

export const STATUS_STYLE: Record<AttendanceStatus, { on: string; dot: string }> = {
  present: { on: "bg-emerald-600 text-white border-emerald-600", dot: "bg-emerald-500" },
  tardy: { on: "bg-amber-500 text-white border-amber-500", dot: "bg-amber-500" },
  absent: { on: "bg-rose-600 text-white border-rose-600", dot: "bg-rose-500" },
  excused: { on: "bg-sky-600 text-white border-sky-600", dot: "bg-sky-500" },
};
const weekday = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export default function HubClassAttendance() {
  const req = useRecords();
  const records = useRecordsSetup();
  const [view, setView] = useSavedChoice<View>("hub-attendance-view", "take", ["take", "reports", "settings"]);
  const [day, setDay] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(0);
  const [noteFor, setNoteFor] = useState<number | null>(null);

  const load = useCallback((d = day) => req<Data>(`/api/records/attendance${d ? `?day=${d}` : ""}`).then((r) => { setData(r); setDay(r.day); setError(""); }).catch((e) => setError(e.message)), [req, day]);
  useEffect(() => { void load(""); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(changes: Record<string, AttendanceMark | null>) {
    if (!data) return;
    const prev = data.marks;
    const next = { ...prev };
    for (const [k, v] of Object.entries(changes)) { if (v) next[k] = v; else delete next[k]; }
    setData({ ...data, marks: next });
    setSaving((n) => n + 1);
    try { await req("/api/records/attendance", { method: "PUT", body: { day: data.day, marks: changes } }); }
    catch (e: any) { setError(e.message); setData((d) => (d ? { ...d, marks: prev } : d)); }
    finally { setSaving((n) => n - 1); }
  }
  const mark = (id: number, status: AttendanceStatus) => {
    const was = data?.marks[String(id)];
    if (was?.status === status) return save({ [id]: null }); // a second tap clears it
    return save({ [id]: { status, ...(was?.note ? { note: was.note } : {}), ...(status === "tardy" && was?.minutesLate ? { minutesLate: was.minutesLate } : {}) } });
  };
  const counts = useMemo(() => {
    const c = { present: 0, tardy: 0, absent: 0, excused: 0, unmarked: 0 };
    for (const s of data?.students ?? []) { const m = data?.marks[String(s.id)]; if (m) c[m.status] += 1; else c.unmarked += 1; }
    return c;
  }, [data]);
  const allPresent = () => data && save(Object.fromEntries(data.students.filter((s) => !data.marks[String(s.id)]).map((s) => [s.id, { status: "present" as const }])));
  const familiesSee = !!records.setup?.share.parents.attendance;

  return <div className="space-y-5" data-testid="hub-class-attendance">
    <PluginHead title="Attendance" blurb="Present, tardy, absent or excused, every day." shared={records.setup ? familiesSee : undefined}
      tabs={[{ id: "take", label: "Take attendance" }, { id: "reports", label: "Reports" }, { id: "settings", label: "Sharing" }]} tab={view} setTab={setView} />
    <ErrorNote text={error} retry={() => void load()} />
    {!data && !error && <Loading label="Loading your class…" />}

    {data && view === "take" && <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <Btn onClick={() => void load(addDays(data.day, -1))} title="Day before"><ChevronLeft className="h-4 w-4" /></Btn>
          <label className="relative"><span className="sr-only">Day</span>
            <input type="date" value={data.day} max={addDays(data.today, 7)} onChange={(e) => e.target.value && void load(e.target.value)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-white/15 dark:bg-white/5 dark:text-white" />
          </label>
          <Btn onClick={() => void load(addDays(data.day, 1))} disabled={data.day >= addDays(data.today, 7)} title="Day after"><ChevronRight className="h-4 w-4" /></Btn>
          {data.day !== data.today && <Btn onClick={() => void load(data.today)}>Today</Btn>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500" role="status">{saving ? "Saving…" : "Saved"}</span>
          <Btn kind="primary" onClick={() => void allPresent()} disabled={!counts.unmarked}><CheckCheck className="h-4 w-4" />Everyone else present</Btn>
        </div>
      </div>
      <Panel>
        <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className={`text-base font-bold ${ink}`}>{weekday(data.day)}</h3>
          <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            {ATTENDANCE.map((s) => <span key={s} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${STATUS_STYLE[s].dot}`} />{counts[s]} {ATTENDANCE_NAMES[s].toLowerCase()}</span>)}
            {counts.unmarked > 0 && <span>{counts.unmarked} not marked</span>}
          </p>
        </div>
        {data.students.length ? <ul className="divide-y divide-slate-100 dark:divide-white/10">{data.students.map((s) => {
          const m = data.marks[String(s.id)];
          return <li key={s.id} className="flex flex-wrap items-center gap-3 py-3" data-testid="attendance-row">
            <Avatar id={s.id} name={s.name} />
            <div className="min-w-[8rem] flex-1">
              <p className={`font-semibold ${ink}`}>{s.name}</p>
              <p className="text-xs text-slate-500">{s.rate === null ? "No days yet" : `${s.rate}% · last 90 days`}{m?.note ? ` · ${m.note}` : ""}</p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={`Attendance for ${s.name}`}>
              {ATTENDANCE.map((st) => <button key={st} type="button" onClick={() => void mark(s.id, st)} aria-pressed={m?.status === st}
                className={`min-h-10 rounded-xl border px-3 text-sm font-semibold transition ${m?.status === st ? STATUS_STYLE[st].on : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-white/15 dark:bg-transparent dark:text-white/80"}`}>{ATTENDANCE_NAMES[st]}</button>)}
              {m?.status === "tardy" && <label className="flex items-center gap-1 text-sm text-slate-500"><input type="number" min={1} max={240} aria-label={`Minutes late for ${s.name}`} defaultValue={m.minutesLate ?? ""} placeholder="min"
                onBlur={(e) => { const n = Number(e.target.value); if (n !== (m.minutesLate ?? 0)) void save({ [s.id]: { ...m, ...(n > 0 ? { minutesLate: n } : { minutesLate: undefined }) } }); }}
                className="min-h-10 w-16 rounded-xl border border-slate-200 bg-white px-2 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white" />late</label>}
              {m && <button type="button" onClick={() => setNoteFor(s.id)} aria-label={`Note for ${s.name}`} className={`inline-flex h-10 w-10 items-center justify-center rounded-xl border ${m.note ? "border-[#6e5ae0] text-[#6e5ae0]" : "border-slate-200 text-slate-500 dark:border-white/15"}`}><MessageSquareText className="h-4 w-4" /></button>}
            </div>
          </li>;
        })}</ul> : <p className="py-6 text-center text-sm text-slate-500">No students yet.</p>}
      </Panel>
      {familiesSee && <p className="text-sm text-slate-500">Families see attendance, and get a notification the day you mark their child absent or tardy.</p>}
    </>}

    {data && view === "reports" && <Reports rows={data.students} />}
    {view === "settings" && <div className="max-w-2xl"><ShareCard plugin="attendance" share={records.setup?.share} onChange={records.saveShare}
      extra={<p className="mt-3 text-sm text-slate-500">When families see attendance, they get a notification the same day a child is marked absent or tardy.</p>} /></div>}

    {noteFor !== null && data && <NoteModal name={data.students.find((s) => s.id === noteFor)?.name || ""} value={data.marks[String(noteFor)]?.note || ""}
      onClose={() => setNoteFor(null)} onSave={(note) => { const m = data.marks[String(noteFor)]; if (m) void save({ [noteFor]: { ...m, note: note || undefined } }); setNoteFor(null); }} />}
  </div>;
}

function NoteModal({ name, value, onSave, onClose }: { name: string; value: string; onSave: (v: string) => void; onClose: () => void }) {
  const [v, setV] = useState(value);
  return <HubModal title={`Note for ${name}`} onClose={onClose} closeOnBackdrop size="md">
    <form onSubmit={(e) => { e.preventDefault(); onSave(v.trim()); }} className="space-y-3">
      <input autoFocus value={v} maxLength={200} onChange={(e) => setV(e.target.value)} placeholder="Doctor's appointment, bus late…" aria-label="Note" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-[15px] dark:border-white/15 dark:bg-white/5 dark:text-white" />
      <div className="flex justify-end gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" type="submit">Save note</Btn></div>
    </form>
  </HubModal>;
}

function Reports({ rows }: { rows: Row[] }) {
  const [sort, setSort] = useState<"rate" | "absent" | "name">("rate");
  const [open, setOpen] = useState<Row | null>(null);
  const sorted = useMemo(() => [...rows].sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : sort === "absent" ? b.absent - a.absent : (a.rate ?? 101) - (b.rate ?? 101))), [rows, sort]);
  const tone = (r: number | null) => (r === null ? "text-slate-500" : r >= 95 ? "text-emerald-700" : r >= 90 ? "text-amber-700" : "text-rose-700");
  return <Panel>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className={`text-base font-bold ${ink}`}>Last 90 days</h3>
      <div className="flex gap-2">
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort" className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-white/15 dark:bg-white/5 dark:text-white"><option value="rate">Lowest rate first</option><option value="absent">Most absences</option><option value="name">Name</option></select>
        <Btn onClick={() => downloadCsv("attendance.csv", [["Student", "Rate %", "Present", "Tardy", "Absent", "Excused", "Days marked"], ...sorted.map((r) => [r.name, r.rate, r.present, r.tardy, r.absent, r.excused, r.days])])}><Download className="h-4 w-4" />CSV</Btn>
      </div>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm">
      <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="pb-2 font-semibold">Student</th><th className="pb-2 text-right font-semibold">Rate</th><th className="pb-2 text-right font-semibold">Present</th><th className="pb-2 text-right font-semibold">Tardy</th><th className="pb-2 text-right font-semibold">Absent</th><th className="pb-2 text-right font-semibold">Excused</th></tr></thead>
      <tbody>{sorted.map((r) => <tr key={r.id} className="border-t border-slate-100 dark:border-white/10">
        <td className="py-2.5"><button type="button" onClick={() => setOpen(r)} className={`font-semibold underline decoration-slate-300 underline-offset-4 hover:decoration-[#6e5ae0] ${ink}`}>{r.name}</button></td>
        <td className={`text-right font-semibold tabular-nums ${tone(r.rate)}`}>{r.rate === null ? "—" : `${r.rate}%`}</td>
        <td className="text-right tabular-nums">{r.present}</td><td className="text-right tabular-nums">{r.tardy}</td><td className="text-right tabular-nums">{r.absent}</td><td className="text-right tabular-nums">{r.excused}</td>
      </tr>)}</tbody></table></div>
    {open && <HubModal title={open.name} onClose={() => setOpen(null)} closeOnBackdrop size="md">
      <p className="mb-3 text-sm text-slate-500">{open.rate === null ? "No days marked yet." : `${open.rate}% over ${open.days} days marked.`}</p>
      {open.last.length ? <ul className="divide-y divide-slate-100 dark:divide-white/10">{open.last.map((m) => <li key={m.day} className="flex items-center gap-3 py-2 text-sm">
        <span className={`h-2 w-2 rounded-full ${STATUS_STYLE[m.status].dot}`} /><span className={`w-24 font-semibold ${ink}`}>{shortDay(m.day)}</span>
        <span className="flex-1">{ATTENDANCE_NAMES[m.status]}{m.minutesLate ? ` · ${m.minutesLate} min` : ""}{m.note ? ` · ${m.note}` : ""}</span>
      </li>)}</ul> : <p className="text-sm text-slate-500">Present every day marked.</p>}
    </HubModal>}
  </Panel>;
}
