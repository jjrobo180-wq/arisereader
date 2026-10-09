// Arise WorkHub: weekly availability (the times someone can usually meet), answering a poll for someone, and the polls other people invited you to.
// The page says "availability" everywhere. In the code and the saved data the same times are still called free windows.
import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { AVAILABILITY_LIMIT, FIT_WORDS, WEEK_DAYS, cleanWeekly, suggestAnswers, type Fit, type FreeWindow } from "@shared/availability";
import type { PollAnswer } from "@shared/meetingPoll";
import { Card, Empty, GhostButton, PrimaryButton } from "./ui";

export async function api(token: string | null, method: string, path: string, body?: unknown) {
  const response = await fetch(`${API_BASE}${path}`, { method, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

const field = "min-h-11 rounded-xl border border-slate-200 bg-white px-2 text-base outline-none focus:border-slate-400 sm:text-sm";

/** What a teacher is told, in small letters, wherever availability is added. */
export const AVAILABILITY_TIP = "Choose your planning block, and avoid Wednesdays if possible.";

/** Rows of "day, from, to". Used for your own availability and for a person on your team. `label` is who it is for: "you", or a person's name. */
export function WeeklyEditor({ value, onChange, label }: { value: FreeWindow[]; onChange: (next: FreeWindow[]) => void; label: string }) {
  const set = (i: number, patch: Partial<FreeWindow>) => onChange(value.map((w, k) => (k === i ? { ...w, ...patch } : w)));
  return (
    <div className="space-y-2" data-testid="weekly-editor">
      {value.length === 0 && <p className="text-sm text-slate-500">No availability yet. Add the times {label === "you" ? "you are" : `${label} is`} usually available.</p>}
      <p className="text-xs text-slate-500" data-testid="availability-tip">{label === "you" ? AVAILABILITY_TIP : AVAILABILITY_TIP.replace("your", "their")}</p>
      {value.map((w, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select aria-label={`Day ${i + 1}`} className={field} value={w.day} onChange={(e) => set(i, { day: Number(e.target.value) })}>
            {WEEK_DAYS.map((d, n) => <option key={d} value={n}>{d}</option>)}
          </select>
          <input aria-label={`From ${i + 1}`} type="time" className={field} value={w.start} onChange={(e) => set(i, { start: e.target.value })} />
          <span className="text-sm text-slate-500">to</span>
          <input aria-label={`To ${i + 1}`} type="time" className={field} value={w.end} onChange={(e) => set(i, { end: e.target.value })} />
          <button type="button" aria-label={`Remove time ${i + 1}`} onClick={() => onChange(value.filter((_, k) => k !== i))} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      ))}
      {value.length < AVAILABILITY_LIMIT && <GhostButton onClick={() => onChange([...value, { day: 1, start: "08:00", end: "12:00" }])}><Plus className="h-4 w-4" /> Add a time</GhostButton>}
    </div>
  );
}

/** My own weekly availability, saved to my account. People who linked a poll to their account share these with the person who invited them. */
export function MyAvailability({ token, setNotice, onChange, defaultOpen = false }: { token: string | null; setNotice: (text: string) => void; onChange?: (weekly: FreeWindow[]) => void; defaultOpen?: boolean }) {
  const [weekly, setWeekly] = useState<FreeWindow[] | null>(null);
  const [saved, setSaved] = useState("[]");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => { api(token, "GET", "/api/teacher-hub/availability").then((d) => { setWeekly(d.weekly); setSaved(JSON.stringify(d.weekly)); onChange?.(d.weekly); }).catch(() => setWeekly([])); }, [token]);
  if (!weekly) return null;
  const dirty = JSON.stringify(weekly) !== saved;
  async function save() {
    setBusy(true);
    try { const d = await api(token, "PUT", "/api/teacher-hub/availability", { weekly: cleanWeekly(weekly) }); setWeekly(d.weekly); setSaved(JSON.stringify(d.weekly)); onChange?.(d.weekly); setNotice("Your availability is saved."); }
    catch (e: any) { setNotice(e?.message || "Could not save your availability."); } finally { setBusy(false); }
  }
  return (
    <div className="rounded-2xl border border-slate-200 p-3 text-sm" data-testid="my-availability">
      <div className="flex items-center justify-between gap-2">
        <div><span className="font-semibold">My availability</span> <span className="text-slate-500">{weekly.length ? `${weekly.length} saved` : "none saved"}</span></div>
        <GhostButton onClick={() => setOpen(!open)}>{open ? "Close" : weekly.length ? "Edit" : "Add"}</GhostButton>
      </div>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-slate-600">The times you can usually meet each week. When someone who invites you opens their link while signed in and adds the poll to their account, they can see whether you're usually available for each time offered. They never see your calendar.</p>
          <WeeklyEditor value={weekly} onChange={setWeekly} label="you" />
          <PrimaryButton onClick={save} disabled={busy || !dirty}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save my availability</PrimaryButton>
        </div>
      )}
    </div>
  );
}

const CHOICES: { value: PollAnswer; label: string; on: string }[] = [
  { value: "yes", label: "Works", on: "border-emerald-600 bg-emerald-600 text-white" },
  { value: "maybe", label: "Maybe", on: "border-amber-500 bg-amber-500 text-white" },
  { value: "no", label: "Can't", on: "border-rose-600 bg-rose-600 text-white" },
];

export type OptionLite = { id: string; date: string; start: string; end: string; label: string };

/** Pick Works / Maybe / Can't for each time. Can start from weekly availability. */
export function AnswerEditor({ options, answers, comment, weekly, fit, saveLabel, busy, onSave, onCancel }: {
  options: OptionLite[]; answers: Record<string, PollAnswer>; comment: string; weekly?: FreeWindow[]; fit?: Record<string, Fit>; saveLabel: string; busy: boolean;
  onSave: (answers: Record<string, PollAnswer>, comment: string) => void; onCancel?: () => void;
}) {
  const [mine, setMine] = useState<Record<string, PollAnswer>>(answers);
  const [note, setNote] = useState(comment);
  const filled = weekly?.length ? suggestAnswers(weekly, options as any) : {};
  const hint = (id: string) => (fit?.[id] && fit[id] !== "unknown" ? FIT_WORDS[fit[id] as Exclude<Fit, "unknown">] : "");
  return (
    <div className="space-y-3" data-testid="answer-editor">
      {weekly && weekly.length > 0 && Object.keys(filled).length > 0 && (
        <GhostButton onClick={() => setMine({ ...mine, ...filled })}>Fill in from my availability</GhostButton>
      )}
      {options.map((o) => (
        <div key={o.id}>
          <div className="text-sm font-medium">{o.label}{hint(o.id) && <span className="ml-2 text-xs font-normal text-slate-500">{hint(o.id)}</span>}</div>
          <div className="mt-1 grid grid-cols-3 gap-2" role="radiogroup" aria-label={o.label}>
            {CHOICES.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={mine[o.id] === c.value} onClick={() => setMine({ ...mine, [o.id]: c.value })}
                className={`min-h-11 rounded-xl border text-sm font-semibold ${mine[o.id] === c.value ? c.on : "border-slate-200 bg-white text-slate-700"}`}>{c.label}</button>
            ))}
          </div>
        </div>
      ))}
      <input aria-label="Note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Note (optional)" className={`${field} w-full`} />
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={() => onSave(mine, note)} disabled={busy || !Object.keys(mine).length}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} {saveLabel}</PrimaryButton>
        {onCancel && <GhostButton onClick={onCancel}>Cancel</GhostButton>}
      </div>
    </div>
  );
}

type Invited = { inviteeId: string; title: string; location: string; from: string; message: string; status: "open" | "booked"; options: OptionLite[]; chosen: string | null; answers: Record<string, PollAnswer>; comment: string; answered: boolean };

/** Polls other people invited me to, after I opened my link while signed in and added it to my account. */
export function InvitedPolls({ token, setNotice }: { token: string | null; setNotice: (text: string) => void }) {
  const [list, setList] = useState<Invited[] | null>(null);
  const [weekly, setWeekly] = useState<FreeWindow[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const [p, a] = await Promise.all([api(token, "GET", "/api/teacher-hub/polls-invited"), api(token, "GET", "/api/teacher-hub/availability").catch(() => ({ weekly: [] }))]);
      setList(p.polls); setWeekly(a.weekly);
    } catch { setList([]); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  if (!list?.length) return null;
  async function answer(i: Invited, answers: Record<string, PollAnswer>, comment: string) {
    setBusy(true);
    try { await api(token, "POST", `/api/teacher-hub/polls-invited/${i.inviteeId}/answer`, { answers, comment }); setOpen(null); setNotice("Your answers are sent."); await load(); }
    catch (e: any) { setNotice(e?.message || "Could not save your answers."); } finally { setBusy(false); }
  }
  async function leave(i: Invited) {
    if (!window.confirm(`Remove “${i.title}” from your account? You can still answer from your email link.`)) return;
    try { await api(token, "DELETE", `/api/teacher-hub/polls-invited/${i.inviteeId}`); await load(); } catch (e: any) { setNotice(e?.message || "Could not remove that."); }
  }
  return (
    <div className="space-y-2" data-testid="invited-polls">
      <div className="text-sm font-semibold">Meetings you were asked about</div>
      {list.map((i) => (
        <div key={i.inviteeId} className="rounded-2xl border border-slate-200 p-3" data-testid="invited-poll">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="break-words font-semibold">{i.title}</div>
              <div className="text-xs text-slate-500">{i.from ? `From ${i.from} · ` : ""}{i.status === "booked" ? `Booked: ${i.options.find((o) => o.id === i.chosen)?.label ?? ""}` : i.answered ? "You answered" : "Waiting for your answer"}{i.location ? ` · ${i.location}` : ""}</div>
            </div>
            <div className="flex shrink-0 gap-1">
              {i.status === "open" && <GhostButton onClick={() => setOpen(open === i.inviteeId ? null : i.inviteeId)}>{open === i.inviteeId ? "Close" : i.answered ? "Change" : "Answer"}</GhostButton>}
              <button type="button" aria-label={`Remove ${i.title}`} onClick={() => leave(i)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><X className="h-4 w-4" /></button>
            </div>
          </div>
          {open === i.inviteeId && <div className="mt-3"><AnswerEditor options={i.options} answers={i.answers} comment={i.comment} weekly={weekly} saveLabel="Send my answers" busy={busy} onSave={(a, c) => answer(i, a, c)} /></div>}
        </div>
      ))}
    </div>
  );
}
