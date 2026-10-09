// The admin's controls for the automatic family emails: one main switch, the weekly progress update,
// the "time to read" nudge, and a preview of either email for a real student.
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { loadFamilyEmails, previewFamilyEmail, saveFamilyEmails, type FamilyEmailOverview, type FamilyEmailSettings as Settings } from "@/lib/familyEmails";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const hourText = (h: number) => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;
const selectCls = "min-h-10 rounded-md border border-input bg-background px-2 text-sm text-foreground";
const when = (ms: number) => new Date(ms).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function Switch({ on, onChange, label, testId }: { on: boolean; onChange: (on: boolean) => void; label: string; testId?: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} data-testid={testId}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-muted"}`}>
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-1"}`} />
    </button>
  );
}

export default function FamilyEmailSettings() {
  const [data, setData] = useState<FamilyEmailOverview | null>(null);
  const [draft, setDraft] = useState<Settings | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"weekly" | "nudge">("weekly");
  const [childId, setChildId] = useState(0);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);

  useEffect(() => {
    let current = true;
    loadFamilyEmails().then((d) => { if (current) { setData(d); setDraft(d.settings); } }).catch((e) => { if (current) setError(e?.message || "Could not load the email settings."); });
    return () => { current = false; };
  }, []);

  if (!data || !draft) return error ? <p role="alert" className="text-sm text-destructive">{error}</p> : <p className="text-sm text-muted-foreground">Loading…</p>;
  const changed = JSON.stringify(draft) !== JSON.stringify(data.settings);
  const set = (patch: Partial<Settings>) => setDraft({ ...draft, ...patch });

  async function save(next: Settings = draft!) {
    if (busy) return;
    setBusy(true); setNotice(""); setError("");
    try { const d = await saveFamilyEmails(next); setData(d); setDraft(d.settings); setNotice(d.message || "Saved."); }
    catch (e: any) { setError(e?.message || "Could not save."); }
    finally { setBusy(false); }
  }
  async function show(sendToMe = false) {
    if (busy) return;
    setBusy(true); setNotice(""); setError("");
    try { const p = await previewFamilyEmail(kind, childId, sendToMe); setPreview(p); if (p.message) setNotice(p.message); }
    catch (e: any) { setError(e?.message || "Could not make the preview."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 text-sm" data-testid="family-emails">
      <div className={`flex flex-wrap items-center gap-3 rounded-xl border p-3 ${data.settings.enabled ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-muted/20"}`}>
        <Switch on={draft.enabled} onChange={(enabled) => set({ enabled })} label="Automatic family emails" testId="family-emails-main" />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Automatic family emails are {data.settings.enabled ? "on" : "off"}{changed ? " (not saved yet)" : ""}</div>
          <div className="text-xs text-muted-foreground">{data.counts.parents} {data.counts.parents === 1 ? "parent" : "parents"} connected to {data.counts.children} {data.counts.children === 1 ? "student" : "students"} would get them.{data.counts.stopped ? ` ${data.counts.stopped} stopped them with the link in an email.` : ""}</div>
        </div>
      </div>
      {!data.emailReady && <p className="text-xs text-amber-500">Email isn't set up on the site yet, so nothing can be sent.</p>}
      <p className="text-xs text-muted-foreground">Students don't have email addresses on the site, so these go to their parents. Each one has a "Read this to (your child)!" note written to the student.</p>

      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center gap-3"><Switch on={draft.weekly.on} onChange={(on) => set({ weekly: { ...draft.weekly, on } })} label="Weekly progress update" testId="family-emails-weekly" /><span className="font-semibold">Weekly progress update</span></div>
        <p className="mt-1 text-xs text-muted-foreground">Quizzes passed, points, books finished, their place on this month's leaderboard and how many points to move up.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">Every
          <select className={selectCls} value={draft.weekly.day} onChange={(e) => set({ weekly: { ...draft.weekly, day: Number(e.target.value) } })} aria-label="Day of the weekly update" data-testid="family-emails-day">{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select>
          from
          <select className={selectCls} value={draft.weekly.hour} onChange={(e) => set({ weekly: { ...draft.weekly, hour: Number(e.target.value) } })} aria-label="Time of the weekly update">{HOURS.map((h) => <option key={h} value={h}>{hourText(h)}</option>)}</select>
          <span className="text-xs text-muted-foreground">Mountain Time</span>
        </div>
      </div>

      <div className="rounded-xl border border-border p-3">
        <div className="flex items-center gap-3"><Switch on={draft.nudge.on} onChange={(on) => set({ nudge: { ...draft.nudge, on } })} label="Time to read reminder" testId="family-emails-nudge" /><span className="font-semibold">"Time to read" reminder</span></div>
        <p className="mt-1 text-xs text-muted-foreground">A friendly nudge when a student hasn't passed a quiz in a while. At most one a week per student, and never on the weekly update's day.</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">After
          <select className={selectCls} value={draft.nudge.afterDays} onChange={(e) => set({ nudge: { ...draft.nudge, afterDays: Number(e.target.value) } })} aria-label="Days without a passed quiz" data-testid="family-emails-after">{Array.from({ length: 13 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>{n} days</option>)}</select>
          without a passed quiz, from
          <select className={selectCls} value={draft.nudge.hour} onChange={(e) => set({ nudge: { ...draft.nudge, hour: Number(e.target.value) } })} aria-label="Time of the reminder">{HOURS.map((h) => <option key={h} value={h}>{hourText(h)}</option>)}</select>
        </div>
      </div>

      <label className="flex items-center gap-2"><input type="checkbox" checked={draft.competitions} onChange={(e) => set({ competitions: e.target.checked })} className="h-4 w-4" data-testid="family-emails-prizes" /> Mention the prizes and the competitions that are on</label>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" disabled={busy || !changed} onClick={() => void save()} data-testid="family-emails-save">{busy ? "Saving..." : "Save"}</Button>
        {changed && <button type="button" onClick={() => setDraft(data.settings)} className="min-h-9 text-xs font-semibold text-muted-foreground underline underline-offset-4">Undo changes</button>}
      </div>
      {notice && <p role="status" className="text-sm text-emerald-500" data-testid="family-emails-notice">{notice}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground" data-testid="family-emails-last">{data.lastRun ? `Last sent ${when(data.lastRun.at)}: ${data.lastRun.weekly} weekly ${data.lastRun.weekly === 1 ? "update" : "updates"}, ${data.lastRun.nudges} ${data.lastRun.nudges === 1 ? "reminder" : "reminders"}${data.lastRun.failed ? `, ${data.lastRun.failed} could not be sent` : ""}.` : "Nothing has been sent yet."}</p>

      <div className="rounded-xl border border-border p-3" data-testid="family-emails-preview">
        <div className="font-semibold">See what a parent gets</div>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select className={selectCls} value={kind} onChange={(e) => setKind(e.target.value as "weekly" | "nudge")} aria-label="Which email">
            <option value="weekly">Weekly progress update</option>
            <option value="nudge">"Time to read" reminder</option>
          </select>
          <select className={selectCls} value={childId} onChange={(e) => setChildId(Number(e.target.value))} aria-label="For which student">
            <option value={0}>A made-up student</option>
            {data.children.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void show()} data-testid="family-emails-show">Show preview</Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void show(true)} data-testid="family-emails-send-me">Email it to me</Button>
        </div>
        {preview && (
          <>
            <p className="mt-3 text-xs text-muted-foreground">Subject: <span className="font-semibold text-foreground" data-testid="family-emails-subject">{preview.subject}</span></p>
            {/* The email exactly as it is sent, in a frame with no scripts. */}
            <iframe title="Email preview" sandbox="" srcDoc={preview.html} className="mt-2 h-[560px] w-full rounded-lg border border-border bg-white" data-testid="family-emails-frame" />
          </>
        )}
      </div>
    </div>
  );
}
