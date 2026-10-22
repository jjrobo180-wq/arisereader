// Students → "Duplicate accounts": merge a student's two accounts (the one the teacher made and the
// one the student made later) into one. Suggestions come from matching names and student numbers;
// any two accounts can also be picked by hand. The server does the merge (server/accountMerge.ts).
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, GitMerge as Merge, Search } from "lucide-react";
import { HubModal } from "./HubModal";
import { Card, Empty, Field, GhostButton } from "./ui";

type Person = { id: number; name: string; username: string; createdAt: string; points: number; teacherName: string | null; approved: boolean; mine: boolean };
type Pair = { keep: Person; dup: Person; reason: string };
type Result = { moved: Record<string, number>; skipped: Record<string, number>; points: number; username: string };

const made = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
};
const where = (p: Person) => p.teacherName ? `Class: ${p.teacherName}` : p.approved ? "No class" : "Not placed yet";

function PersonBox({ p, label, tone }: { p: Person; label: string; tone: "keep" | "dup" }) {
  return (
    <div className={`min-w-0 flex-1 rounded-xl border p-3 ${tone === "keep" ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white"}`}>
      <div className={`text-[11px] font-bold ${tone === "keep" ? "text-emerald-800" : "text-slate-500"}`}>{label}</div>
      <div className="truncate font-semibold text-slate-900">{p.name}</div>
      <div className="truncate text-sm text-slate-600">@{p.username}</div>
      <div className="text-xs text-slate-500">{p.points.toLocaleString()} points · made {made(p.createdAt)} · {where(p)}</div>
    </div>
  );
}

export function MergeAccountsCard({ request, onMerged }: { request: (path: string, options?: RequestInit) => Promise<any>; onMerged: (text: string) => void }) {
  const [data, setData] = useState<{ pairs: Pair[]; students: Person[] } | null>(null);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const [review, setReview] = useState<{ keep: Person; dup: Person } | null>(null);

  const load = useCallback(() => {
    setError("");
    return request("/api/teacher-admin/students/duplicates").then((d) => setData({ pairs: d.pairs || [], students: d.students || [] })).catch((e) => setError(e instanceof Error ? e.message : "Couldn't look for duplicates."));
  }, [request]);
  useEffect(() => { void load(); }, [load]);

  return (
    <Card title={`Duplicate accounts${data?.pairs.length ? ` (${data.pairs.length})` : ""}`} collapseKey="reader-merge-accounts"
      right={<GhostButton onClick={() => setPicking(true)}><Merge className="h-4 w-4" /> Merge two accounts</GhostButton>}>
      <p className="mb-3 text-sm text-slate-600">When a student makes their own account after you made one for them, merge the two. Their quizzes, points, reading and work all move to one account, and the extra account is archived.</p>
      {error ? <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>
        : !data ? <Empty>Looking for duplicate accounts…</Empty>
        : !data.pairs.length ? <Empty>No duplicate accounts found. Use "Merge two accounts" if you know of one.</Empty>
        : <ul className="space-y-2">{data.pairs.map((p) => (
          <li key={`${p.keep.id}-${p.dup.id}`} className="flex flex-col gap-2 rounded-2xl border border-slate-200 p-3 lg:flex-row lg:items-center">
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
              <PersonBox p={p.keep} label="Keep" tone="keep" />
              <PersonBox p={p.dup} label={`Merge in · ${p.reason}`} tone="dup" />
            </div>
            <button type="button" onClick={() => setReview({ keep: p.keep, dup: p.dup })} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800">Review and merge</button>
          </li>
        ))}</ul>}
      {picking && data && <PickModal students={data.students} onClose={() => setPicking(false)} onPick={(keep, dup) => { setPicking(false); setReview({ keep, dup }); }} />}
      {review && <MergeModal pair={review} request={request} onClose={() => setReview(null)}
        onDone={(text) => { setReview(null); onMerged(text); void load(); }} />}
    </Card>
  );
}

function PickModal({ students, onClose, onPick }: { students: Person[]; onClose: () => void; onPick: (keep: Person, dup: Person) => void }) {
  const [keep, setKeep] = useState<Person | null>(null);
  const [dup, setDup] = useState<Person | null>(null);
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const list = useMemo(() => students.filter((s) => !needle || s.name.toLowerCase().includes(needle) || s.username.toLowerCase().includes(needle)).slice(0, 40), [students, needle]);
  const choose = (s: Person) => {
    if (!keep) { if (s.mine) setKeep(s); return; }
    if (s.id !== keep.id) setDup(s);
  };
  return (
    <HubModal title="Merge two accounts" onClose={onClose}
      footer={<div className="flex flex-wrap justify-end gap-2">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <button type="button" disabled={!keep || !dup} onClick={() => keep && dup && onPick(keep, dup)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-50">Next</button>
      </div>}>
      <p className="mb-3 text-sm text-slate-600">{!keep ? "First, pick the account to keep (usually the one you made)." : !dup ? `Now pick the extra account to merge into ${keep.name}.` : "Ready. Press Next to review."}</p>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        {keep ? <button type="button" className="min-w-0 flex-1 text-left" onClick={() => { setKeep(null); setDup(null); }} aria-label="Change the account to keep"><PersonBox p={keep} label="Keep (tap to change)" tone="keep" /></button> : <div className="flex-1 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">Keep: pick below</div>}
        {dup ? <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setDup(null)} aria-label="Change the account to merge in"><PersonBox p={dup} label="Merge in (tap to change)" tone="dup" /></button> : <div className="flex-1 rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">Merge in: pick below</div>}
      </div>
      <label className="relative mb-2 block"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Field data-autofocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or username" className="pl-9" aria-label="Search students" /></label>
      <ul className="max-h-72 space-y-1 overflow-y-auto">
        {list.map((s) => {
          const disabled = (!keep && !s.mine) || (keep && s.id === keep.id);
          return <li key={s.id}><button type="button" disabled={!!disabled} onClick={() => choose(s)}
            className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40">
            <span className="min-w-0"><span className="block truncate font-medium text-slate-900">{s.name}</span><span className="block truncate text-xs text-slate-500">@{s.username} · {s.points} points · made {made(s.createdAt)} · {where(s)}</span></span>
            {!s.mine && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">Signed up on their own</span>}
          </button></li>;
        })}
        {!list.length && <li className="px-3 py-4 text-sm text-slate-500">No one matches that search.</li>}
      </ul>
    </HubModal>
  );
}

const LABELS: Record<string, string> = {
  "attempts.user_id": "quizzes", "reading_profiles.user_id": "reading profile", "messages.user_id": "messages", "manual_point_awards.student_id": "point awards",
  "math_sessions.user_id": "Arise Math sessions", "history_sessions.user_id": "Arise History sessions", "comprehension_responses.student_id": "written responses",
  "social_profiles.user_id": "Connect profile", "notifications.user_id": "notifications", "student_class_teachers.student_id": "class picks",
};

function MergeModal({ pair, request, onClose, onDone }: { pair: { keep: Person; dup: Person }; request: (path: string, options?: RequestInit) => Promise<any>; onClose: () => void; onDone: (text: string) => void }) {
  const [keep, setKeep] = useState(pair.keep);
  const [dup, setDup] = useState(pair.dup);
  const [login, setLogin] = useState<"keep" | "dup">("keep");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const canSwap = dup.mine;
  const go = async () => {
    setBusy(true); setError("");
    try {
      const r: Result = await request("/api/teacher-admin/students/merge", { method: "POST", body: JSON.stringify({ keepId: keep.id, dupId: dup.id, login }) });
      setResult(r);
    } catch (e) { setError(e instanceof Error ? e.message : "The merge didn't finish. Try again."); }
    setBusy(false);
  };
  if (result) {
    const quizzes = result.moved["attempts.user_id"] || 0;
    const parts = Object.entries(result.moved).filter(([k, n]) => n && LABELS[k] && k !== "attempts.user_id").map(([k, n]) => `${n} ${LABELS[k]}`);
    const text = `${keep.name}'s accounts are merged. They sign in as @${result.username}.`;
    return (
      <HubModal title="Accounts merged" onClose={() => onDone(text)} footer={<div className="flex justify-end"><button type="button" onClick={() => onDone(text)} className="inline-flex min-h-11 items-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white">Done</button></div>}>
        <div className="space-y-2 text-sm text-slate-700">
          <p className="text-base font-semibold text-slate-900">{text}</p>
          <p>Moved over: {quizzes} quiz{quizzes === 1 ? "" : "zes"} and {result.points.toLocaleString()} points{parts.length ? `, plus ${parts.join(", ")}` : ""}.</p>
          {Object.keys(result.skipped).length > 0 && <p className="text-slate-500">A few things the kept account already had (like a quiz both accounts took) stayed with the better copy.</p>}
          <p className="text-slate-500">@{dup.username} is archived and can't sign in any more. An administrator can still find it in the archive.</p>
        </div>
      </HubModal>
    );
  }
  return (
    <HubModal title="Merge these accounts?" onClose={busy ? undefined : onClose}
      footer={<div className="flex flex-wrap justify-end gap-2">
        <GhostButton onClick={onClose}>Cancel</GhostButton>
        <button type="button" onClick={go} disabled={busy} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60" data-testid="merge-confirm"><Merge className="h-4 w-4" />{busy ? "Merging…" : "Merge accounts"}</button>
      </div>}>
      <div className="space-y-4">
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <PersonBox p={keep} label="Keep this account" tone="keep" />
          <button type="button" disabled={!canSwap} onClick={() => { setKeep(dup); setDup(keep); setLogin(login === "keep" ? "dup" : "keep"); }} title={canSwap ? "Swap which account stays" : "You can only keep one of your own students"}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center self-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Swap which account stays"><ArrowLeftRight className="h-4 w-4" /></button>
          <PersonBox p={dup} label="Merge in and archive" tone="dup" />
        </div>
        <fieldset>
          <legend className="mb-1 text-sm font-semibold text-slate-900">Afterward, the student signs in with:</legend>
          <div className="space-y-1">
            {([["keep", keep], ["dup", dup]] as const).map(([v, p]) => (
              <label key={v} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${login === v ? "border-slate-900 bg-slate-50" : "border-slate-200"}`}>
                <input type="radio" name="merge-login" className="mt-1" checked={login === v} onChange={() => setLogin(v)} />
                <span className="text-sm"><b>@{p.username}</b> and its password<span className="block text-slate-500">{v === "keep" ? "The sign-in on the account you're keeping." : "The sign-in the student made themselves, if that's the one they remember."}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">This moves every quiz, point, message and piece of work from @{dup.username} to {keep.name}'s account, then archives @{dup.username}. It can't be undone from here, so check it's the same student.</p>
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</div>}
      </div>
    </HubModal>
  );
}
