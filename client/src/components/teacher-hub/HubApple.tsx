// Apple Reminders in the to-do list. The Arise To Duo iPhone app reads them straight from the phone
// (lib/nativeAppleReminders.ts); the website says to connect there. Reminders a Shortcut set up before
// still sends to the private link are taken in when the Hub is open (and every minute while it is).
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { Loader2, Smartphone } from "lucide-react";
import { appleSummary, mergeReminders, type AppleReminder } from "@shared/appleReminders";
import type { Workspace } from "@shared/teacherHub";
import { api } from "./HubAvailability";
import { Card, GhostButton, PrimaryButton } from "./ui";
import { appleRemindersAvailable, appleRemindersOn, connectAppleReminders, disconnectAppleReminders } from "@/lib/nativeAppleReminders";

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

/** In the iPhone app Reminders are read straight from the phone: one button, no Shortcut or link. */
function NativeRemindersCard() {
  const [on, setOn] = useState(appleRemindersOn());
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const connect = async () => {
    setBusy(true); setNote("");
    try { await connectAppleReminders(); setOn(true); setNote("Connected. Your reminders that aren't done are in LifeHub → Tasks, in a Reminders list, and check-offs stay in step both ways."); }
    catch (e: any) { setNote(e?.message || "That didn't work. Try again."); } finally { setBusy(false); }
  };
  return (
    <Card title="Apple Reminders" right={on ? <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">Connected</span> : undefined}>
      <p className="text-sm text-slate-600">Reminders from the Reminders app on this iPhone come into LifeHub → Tasks each time you open the app. Checking one off in either place checks it off in both.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {on ? <GhostButton onClick={() => { disconnectAppleReminders(); setOn(false); setNote("Disconnected. Tasks already brought in stay in LifeHub."); }}>Disconnect</GhostButton>
          : <PrimaryButton onClick={() => void connect()} disabled={busy} data-testid="apple-reminders-connect">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Connect Apple Reminders</PrimaryButton>}
      </div>
      {note && <p role="status" className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-700">{note}</p>}
    </Card>
  );
}

export default function AppleRemindersCard({ token, check }: { token: string | null; check: () => Promise<number> }) {
  if (appleRemindersAvailable()) return <NativeRemindersCard />;
  return <ShortcutRemindersCard token={token} check={check} />;
}

/** On the website (Apple doesn't let a website read Reminders): it connects in the Arise To Duo iPhone app.
 *  A Shortcut someone already set up keeps working (useAppleInbox still takes in what it sends). */
function ShortcutRemindersCard(_props: { token: string | null; check: () => Promise<number> }) {
  return (
    <Card title="Apple Reminders">
      <div className="flex items-start gap-3 rounded-2xl bg-slate-50 p-4" data-testid="apple-steps">
        <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
        <p className="text-sm leading-6 text-slate-700">Apple Reminders connects in the <b>Arise To Duo iPhone app</b>. Open it on your iPhone, go to Tasks in WorkHub and tap <b>Connect Apple Reminders</b> at the bottom. Your reminders then come in as to-dos, and checking one off in either place checks it off in both.</p>
      </div>
    </Card>
  );
}
