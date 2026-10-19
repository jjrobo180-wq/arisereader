// After a student signs in: "Who are your Advisory and Literature teachers?"
//
// Asked once each school year, and only of students at a school (the server decides; see
// server/classTeachers.ts). Typing shows the school's teachers to tap; a teacher who isn't on
// A.R.I.S.E. yet can still be typed in full. Every teacher at the school then sees the answers on
// the Reader page's "Advisory & Lit" tab. The same form lets a student change their answers from
// their profile (ClassTeachersCard).
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import {
  CLASS_SUBJECTS, NAME_MAX, SUBJECT_LABEL, checkTypedName, exactTeacher, suggestTeachers,
  type ClassSubject, type ClassTeachers, type SchoolTeacher,
} from "@shared/classTeachers";

type Status = { needed: boolean; schoolYear: string; school?: { id: number; name: string }; teachers?: SchoolTeacher[]; current?: ClassTeachers | null };
type Field = { text: string; teacherId: number | null };

function useApi() {
  const { token } = useAuth();
  return useCallback(async (path: string, init: RequestInit = {}) => {
    const r = await fetch(`${API_BASE}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.message || "Something went wrong. Please try again.");
    return data;
  }, [token]);
}

/** One teacher box: type, and the school's matching teachers appear underneath to tap. */
function TeacherBox({ subject, value, teachers, onChange, autoFocus, disabled }: {
  subject: ClassSubject; value: Field; teachers: SchoolTeacher[]; onChange: (v: Field) => void; autoFocus?: boolean; disabled?: boolean;
}) {
  const id = useId();
  const label = SUBJECT_LABEL[subject];
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = useMemo(() => (value.teacherId ? [] : suggestTeachers(value.text, teachers)), [value, teachers]);
  const showList = open && matches.length > 0;
  useEffect(() => setActive(0), [value.text]);

  const choose = (t: SchoolTeacher) => { onChange({ text: t.displayName, teacherId: t.id }); setOpen(false); };

  return (
    <div className="relative">
      <label htmlFor={`${id}-input`} className="mb-1.5 block text-sm font-semibold text-foreground">{label} teacher</label>
      <div className="relative">
        <input
          id={`${id}-input`}
          type="text"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={showList ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          maxLength={NAME_MAX}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={subject === "advisory" ? "Start typing, like Garcia" : "Start typing, like Lee"}
          value={value.text}
          onChange={(e) => { onChange({ text: e.target.value, teacherId: null }); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (!showList) return;
            if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % matches.length); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + matches.length) % matches.length); }
            else if (e.key === "Enter") { e.preventDefault(); choose(matches[active]); }
            else if (e.key === "Escape") { setOpen(false); }
          }}
          className={`h-12 w-full rounded-xl border bg-background px-3.5 pr-10 text-base outline-none transition focus:ring-2 focus:ring-primary/40 ${value.teacherId ? "border-emerald-500" : "border-border"}`}
          data-testid={`class-teacher-${subject}`}
        />
        {value.teacherId && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-emerald-600" aria-hidden>✓</span>}
      </div>
      {showList && (
        <ul id={`${id}-list`} role="listbox" aria-label={`${label} teachers at your school`}
          className="absolute left-0 right-0 z-10 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-card p-1 shadow-xl">
          {matches.map((t, i) => (
            <li key={t.id} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); choose(t); }}
              onMouseEnter={() => setActive(i)}
              className={`flex min-h-11 cursor-pointer items-center rounded-lg px-3 text-sm ${i === active ? "bg-primary/10 font-semibold" : ""}`}
              data-testid={`class-teacher-${subject}-option`}>
              {t.displayName}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-1 min-h-[1.25rem] text-xs text-muted-foreground" aria-live="polite">
        {value.teacherId
          ? "Got it."
          : value.text.trim() && !matches.length
            ? "Not on A.R.I.S.E. yet? Type their name the way you say it, like Ms. Garcia."
            : ""}
      </p>
    </div>
  );
}

/** The two boxes and Save. `onSaved` gets what the server kept. */
export function ClassTeachersForm({ teachers, current, onSaved, saveLabel = "Save" }: {
  teachers: SchoolTeacher[]; current?: ClassTeachers | null; onSaved: (saved: ClassTeachers) => void; saveLabel?: string;
}) {
  const api = useApi();
  const start = (s: ClassSubject): Field => (current ? { text: current[s].name, teacherId: current[s].teacherId } : { text: "", teacherId: null });
  const [fields, setFields] = useState<Record<ClassSubject, Field>>({ advisory: start("advisory"), lit: start("lit") });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError("");
    const body: Record<string, unknown> = {};
    for (const s of CLASS_SUBJECTS) {
      const f = fields[s];
      if (f.teacherId) { body[s] = { teacherId: f.teacherId }; continue; }
      // A full name that is one of the school's teachers counts as picking them.
      const exact = exactTeacher(f.text, teachers);
      if (exact) { body[s] = { teacherId: exact.id }; continue; }
      try { body[s] = { name: checkTypedName(f.text, s) }; }
      catch (err) { setError(err instanceof Error ? err.message : "Please check the names."); return; }
    }
    setBusy(true);
    try {
      const saved = await api("/api/student/class-teachers", { method: "POST", body: JSON.stringify(body) });
      onSaved(saved.current as ClassTeachers);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Your teachers could not be saved. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const ready = CLASS_SUBJECTS.every((s) => fields[s].teacherId || fields[s].text.trim().length >= 2);
  return (
    <form onSubmit={submit} className="space-y-3" noValidate>
      {CLASS_SUBJECTS.map((s, i) => (
        <TeacherBox key={s} subject={s} value={fields[s]} teachers={teachers} autoFocus={i === 0 && !current} disabled={busy}
          onChange={(v) => { setError(""); setFields((f) => ({ ...f, [s]: v })); }} />
      ))}
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={!ready || busy}
        className="flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        data-testid="class-teachers-save">
        {busy ? "Saving…" : saveLabel}
      </button>
    </form>
  );
}

/** The pop-up after sign-in. It waits for the new-account setup screen to finish, then asks. */
export default function ClassTeachersPopup() {
  const { user } = useAuth();
  const api = useApi();
  const [status, setStatus] = useState<Status | null>(null);
  const [saved, setSaved] = useState(false);
  const [closed, setClosed] = useState(false);
  const asked = useRef<number | null>(null);

  useEffect(() => {
    if (!user || user.isAdmin || (user.role && user.role !== "student") || user.is_eye_gaze_user) return;
    if (asked.current === user.id) return;
    let stop = false;
    let timer = 0;
    const check = () => {
      if (stop) return;
      // New students see the account setup screen first; this waits its turn.
      let setup = false;
      try { setup = sessionStorage.getItem("show_profile_setup") === "true"; } catch { /* no storage */ }
      if (setup) { timer = window.setTimeout(check, 700); return; }
      asked.current = user.id;
      api("/api/student/class-teachers")
        .then((d: Status) => { if (!stop) setStatus(d); })
        .catch(() => { asked.current = null; /* asked again next time the app opens */ });
    };
    check();
    return () => { stop = true; window.clearTimeout(timer); };
  }, [user?.id, user?.role, user?.isAdmin, user?.is_eye_gaze_user, api]); // eslint-disable-line react-hooks/exhaustive-deps

  // While it is up, the page behind doesn't scroll.
  const showing = !!status?.needed && !closed;
  useEffect(() => {
    if (!showing) return;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = before; };
  }, [showing]);

  if (!showing || !status) return null;
  return (
    <div className="fixed inset-0 kb-sheet z-[700] flex items-end justify-center bg-black/70 p-3 sm:items-center sm:p-4" data-testid="class-teachers-popup">
      <div role="dialog" aria-modal="true" aria-labelledby="class-teachers-title"
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-2xl sm:p-6">
        {saved ? (
          <div className="py-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl" aria-hidden>✓</div>
            <h2 id="class-teachers-title" className="text-xl font-bold">Thanks!</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your teachers are saved. You can change them anytime on your profile.</p>
            <button type="button" onClick={() => setClosed(true)} autoFocus
              className="mt-5 inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground hover:bg-primary/90"
              data-testid="class-teachers-done">
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4 text-center">
              <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl" aria-hidden>🏫</div>
              <h2 id="class-teachers-title" className="text-xl font-bold">Who are your teachers?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Type your Advisory teacher and your Literature teacher, then tap their name.
                {status.school?.name ? <> Teachers at <span className="font-medium text-foreground">{status.school.name}</span> will see this.</> : null}
              </p>
            </div>
            <ClassTeachersForm teachers={status.teachers || []} current={status.current} saveLabel="Save my teachers" onSaved={() => setSaved(true)} />
          </>
        )}
      </div>
    </div>
  );
}

/** On a student's profile: their two teachers this year, with a way to change them. */
export function ClassTeachersCard() {
  const { user } = useAuth();
  const api = useApi();
  const [status, setStatus] = useState<Status | null>(null);
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!user || user.isAdmin || (user.role && user.role !== "student") || user.is_eye_gaze_user) return;
    api("/api/student/class-teachers").then(setStatus).catch(() => setStatus(null));
  }, [user?.id, api]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!status?.school) return null; // not at a school: nothing to show
  const current = status.current;
  return (
    <section className="arise-surface rounded-2xl border border-white/10 bg-card p-4 shadow-[0_18px_55px_rgba(0,0,0,.20)] sm:p-5" data-testid="class-teachers-card">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">My teachers</h2>
        {!editing && <button type="button" onClick={() => { setNote(""); setEditing(true); }} className="min-h-11 rounded-xl border border-border px-4 text-sm font-semibold hover:bg-muted" data-testid="class-teachers-change">{current ? "Change" : "Add"}</button>}
      </div>
      {editing ? (
        <div className="mt-3">
          <ClassTeachersForm teachers={status.teachers || []} current={current} onSaved={(c) => { setStatus({ ...status, current: c, needed: false }); setEditing(false); setNote("Saved."); }} />
          <button type="button" onClick={() => setEditing(false)} className="mt-2 min-h-11 w-full text-sm text-muted-foreground hover:text-foreground">Cancel</button>
        </div>
      ) : current ? (
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          {CLASS_SUBJECTS.map((s) => (
            <div key={s} className="rounded-xl bg-muted/40 px-3 py-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{SUBJECT_LABEL[s]}</dt>
              <dd className="mt-0.5 font-medium">{current[s].name}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">You haven't added your Advisory and Literature teachers yet.</p>
      )}
      {note && !editing && <p role="status" className="mt-2 text-sm text-emerald-700">{note}</p>}
    </section>
  );
}
