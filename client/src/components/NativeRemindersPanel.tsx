// The reminders switch inside the Arise To Duo iPhone app (lib/nativeReminders.ts), in place of the
// website's Web Push steps (which ask to add the site to the Home Screen and can't work in the app).
import { useState } from "react";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { nativeRemindersAvailable, nativeRemindersOn, sendNativeTest, turnOffNativeReminders, turnOnNativeReminders, type ReminderKind } from "@/lib/nativeReminders";

export default function NativeRemindersPanel({ kind, onChange, buttonClass, ghostClass }: { kind: ReminderKind; onChange?: (on: boolean) => void; buttonClass: string; ghostClass: string }) {
  const [on, setOn] = useState(() => nativeRemindersOn(kind));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const what = kind === "life" ? "a morning summary, heads-ups before tasks and events, bills, water, meals, workouts and more" : "a morning summary and heads-ups before events, meetings and to-dos";
  const run = async (fn: () => Promise<void>, done: string, next?: boolean) => {
    setBusy(true); setMessage("");
    try { await fn(); if (next !== undefined) { setOn(next); onChange?.(next); } setMessage(done); }
    catch (e: any) { setMessage(e?.message || "That didn't work. Try again."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 text-sm leading-6 text-slate-600" data-testid={`native-reminders-${kind}`}>
    {!nativeRemindersAvailable() ? <p>Reminders need the newest version of Arise To Duo. Update the app, then come back here.</p>
      : on ? <>
        <p className="font-semibold text-emerald-700">Reminders are on for this iPhone.</p>
        <p className="text-xs text-slate-500">They follow the choices below and update whenever your {kind === "life" ? "LifeHub" : "WorkHub"} changes.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void run(sendNativeTest, "A test reminder will show in a few seconds.")} disabled={busy} className={ghostClass}>{busy ? <Loader2 size={15} className="animate-spin" /> : <Bell size={15} />} Send a test</button>
          <button type="button" onClick={() => void run(() => turnOffNativeReminders(kind), "Reminders are off for this iPhone.", false)} disabled={busy} className={ghostClass}><BellOff size={15} /> Turn off</button>
        </div>
      </> : <>
        <p>Turn reminders on for this iPhone: {what}.</p>
        <button type="button" onClick={() => void run(() => turnOnNativeReminders(kind), "Reminders are on. Tap “Send a test” to see one.", true)} disabled={busy} className={buttonClass}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Bell size={16} />} Turn on reminders</button>
      </>}
    {message && <p role="status" className="rounded-xl bg-slate-50 px-3 py-2 text-slate-700">{message}</p>}
  </div>;
}
