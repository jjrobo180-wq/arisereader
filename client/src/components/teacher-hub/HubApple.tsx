// Arise WorkHub: bring reminders from the Apple Reminders app into the to-do list, one way. An iPhone Shortcut
// sends them to a private link; the Hub takes them in when it is open (and every minute while it is).
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Check, Copy, Loader2, RefreshCw } from "lucide-react";
import { appleSummary, mergeReminders, type AppleReminder } from "@shared/appleReminders";
import type { Workspace } from "@shared/teacherHub";
import { api } from "./HubAvailability";
import { Card, GhostButton } from "./ui";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;

/** Pulls waiting reminders into the to-do list. `tell` says what happened. Returns a function that checks right now. */
export function useAppleInbox(enabled: boolean, token: string | null, today: () => string, workspace: Workspace, setWorkspace: SetWorkspace, makeId: () => string, tell: (text: string) => void) {
  const latest = useRef(workspace);
  latest.current = workspace;
  const busy = useRef(false);
  const pull = useRef(async (): Promise<number> => 0);
  pull.current = async () => {
    if (!token || busy.current) return 0;
    busy.current = true;
    try {
      const { items } = (await api(token, "GET", "/api/teacher-hub/apple-reminders/inbox")) as { items: AppleReminder[] };
      if (!items?.length) return 0;
      const result = mergeReminders(latest.current.tasks, items, makeId, today());
      setWorkspace((p) => ({ ...p, tasks: mergeReminders(p.tasks, items, makeId, today()).tasks }));
      await api(token, "POST", "/api/teacher-hub/apple-reminders/ack", { keys: items.map((i) => i.key) });
      if (result.added || result.updated) tell(appleSummary(result.added, result.updated));
      return items.length;
    } catch { return 0; } finally { busy.current = false; }
  };
  useEffect(() => {
    if (!enabled || !token) return;
    void pull.current();
    const tick = () => { if (document.visibilityState === "visible") void pull.current(); };
    const timer = window.setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); };
  }, [enabled, token]);
  return () => pull.current();
}

const STEPS: { title: string; body: string }[] = [
  { title: "Make a Shortcut", body: "On your iPhone open the Shortcuts app, tap + and name it “Send Reminders to Hub”." },
  { title: "Find your reminders", body: "Add the action Find Reminders. Add a filter: Is Completed is No. To bring in only one list, add: List is (your list)." },
  { title: "Write one line for each", body: "Add Repeat with Each (it repeats over the Reminders). Inside it add a Text action and type: the Repeat Item, then  |  then its Due Date. Tap the Due Date and set its date format to ISO 8601. Example line: Call Ms. Lee | 2026-10-12" },
  { title: "Join the lines", body: "After the repeat ends, add Combine Text on the Repeat Results, and set it to New Lines." },
  { title: "Send them to your Hub", body: "Add Get Contents of URL. Paste your private link below, tap Show More, set Method to POST, Request Body to File, and choose the Combined Text." },
  { title: "Run it", body: "Tap the Shortcut to run it. In Shortcuts, Automation can run it for you every morning. Your to-dos show up here within a minute." },
];

export default function AppleRemindersCard({ token, check }: { token: string | null; check: () => Promise<number> }) {
  const [url, setUrl] = useState("");
  const [waiting, setWaiting] = useState(0);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { api(token, "GET", "/api/teacher-hub/apple-reminders").then((d) => { setUrl(d.url); setWaiting(d.waiting || 0); }).catch(() => setNote("Could not load your link right now.")); }, [token]);

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 2000); }
    catch { setNote("Press and hold the link to copy it."); }
  }
  async function renew() {
    if (!window.confirm("Make a new link? The old one stops working, so update your Shortcut with the new one.")) return;
    setBusy(true);
    try { const d = await api(token, "POST", "/api/teacher-hub/apple-reminders/reset"); setUrl(d.url); setNote("Done. Paste the new link into your Shortcut."); }
    catch (e: any) { setNote(e?.message || "Could not make a new link."); } finally { setBusy(false); }
  }
  async function now() {
    setBusy(true); setNote("");
    const n = await check();
    setNote(n ? `Brought in ${n} ${n === 1 ? "reminder" : "reminders"}.` : "Nothing new waiting. Run your Shortcut on your iPhone first.");
    setWaiting(0); setBusy(false);
  }

  return (
    <Card title="Apple Reminders to this to-do list" right={<span className="shrink-0 text-xs font-medium text-slate-500">One way</span>}>
      <p className="text-sm text-slate-600">Reminders you make in the Apple Reminders app show up here as to-dos. Apple doesn't let a website read your Reminders directly, so an iPhone Shortcut sends them. It only goes this way: nothing here is written back to Apple Reminders.</p>
      <details className="mt-3 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700" data-testid="apple-steps">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-slate-900">Set it up (about 3 minutes)</summary>
        <ol className="mt-2 space-y-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-950 text-xs font-bold text-white">{i + 1}</span><div><div className="font-semibold text-slate-900">{s.title}</div><div className="leading-6">{s.body}</div></div></li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-slate-500">Want finished reminders checked off here too? Make each line {" "}<b>Item | Due Date | Is Completed</b> and take the “Is Completed is No” filter off, but only for a short list.</p>
      </details>
      <div className="mt-4 space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your private link</div>
        <div className="break-all rounded-xl border border-slate-200 bg-white px-3 py-2 font-mono text-xs text-slate-700" data-testid="apple-link">{url || "Loading…"}</div>
        <p className="text-xs text-slate-500">Keep it private. Anyone with it can send you to-dos (they can't read anything).</p>
        <div className="flex flex-wrap gap-2">
          <GhostButton onClick={copy}>{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy link"}</GhostButton>
          <GhostButton onClick={now}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check now{waiting ? ` (${waiting} waiting)` : ""}</GhostButton>
          <GhostButton onClick={renew}>Make a new link</GhostButton>
        </div>
        {note && <p role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{note}</p>}
      </div>
    </Card>
  );
}
