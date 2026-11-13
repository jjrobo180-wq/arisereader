// Cooked PT → Notifications: reminders before each booked session, a daily "plan your day", and which
// alerts from clients the server sends. Session reminders are kept in step with the schedule while the
// app is open (useSessionReminders). Rules: shared/trainerReminders.ts and shared/fitPush.ts.
import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { BEFORE_CHOICES, TRAINER_IDS, buildTrainerReminders, cleanTrainerReminders, type Appt, type TrainerReminders } from "@shared/trainerReminders";
import { coachApi, type ClientRow } from "../coach/coachApi";
import { PushPrefsList, Switch, usePushPrefs } from "../coach/PushPrefs";
import { canUseNative, replaceLocal, testNotification } from "../fit/fitNative";
import { Btn, C, Card, Sheet, Title } from "../fit/fitUi";

const KEY = "arise-trainer-reminders";
export const readTrainerReminders = (): TrainerReminders => { try { return cleanTrainerReminders(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { return cleanTrainerReminders(null); } };
const writeTrainerReminders = (r: TrainerReminders) => { try { localStorage.setItem(KEY, JSON.stringify(r)); } catch { /* not kept */ } };

/** Every booked session from now on, across active clients. */
export async function loadAppts(token: string | null, clients: ClientRow[]): Promise<(Appt & { c: ClientRow; mode: any; requested?: boolean })[]> {
  const out: any[] = [];
  await Promise.all(clients.filter((c) => c.status === "active").map(async (c) => {
    const d = await coachApi<{ coaching: { appts: { at: string; mins: number; mode: any; place: string; status: string; requested?: boolean }[] } }>(token, `/links/${c.id}/client`);
    for (const a of d.coaching.appts) if (a.status === "booked" && Date.parse(a.at) > Date.now() - 3600e3) out.push({ c, client: c.name, ...a });
  }));
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

const sync = async (r: TrainerReminders, appts: Appt[]) => replaceLocal(TRAINER_IDS, buildTrainerReminders(r, appts, Date.now()));

/** Keeps the session reminders in step with the schedule: on open, every 10 minutes, and when settings change. */
export function useSessionReminders(token: string | null, clients: ClientRow[] | undefined) {
  const ids = (clients ?? []).filter((c) => c.status === "active").map((c) => c.id).join();
  useEffect(() => {
    if (!canUseNative() || !clients) return;
    let live = true;
    const run = async () => { try { const a = await loadAppts(token, clients); if (live) await sync(readTrainerReminders(), a); } catch { /* next time */ } };
    void run();
    const t = window.setInterval(run, 10 * 60_000);
    const changed = () => void run();
    window.addEventListener("trainer-reminders-changed", changed);
    return () => { live = false; window.clearInterval(t); window.removeEventListener("trainer-reminders-changed", changed); };
  }, [token, ids]); // eslint-disable-line react-hooks/exhaustive-deps
}

const fmtTime = (t: string) => { const [h, m] = t.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); };

export function TrainerNotificationsSheet({ onClose }: { onClose: () => void }) {
  const [r, setR] = useState<TrainerReminders>(readTrainerReminders);
  const [msg, setMsg] = useState("");
  const push = usePushPrefs();
  const save = (next: TrainerReminders) => { setR(next); writeTrainerReminders(next); window.dispatchEvent(new Event("trainer-reminders-changed")); setMsg(canUseNative() ? "Saved." : "Saved. Reminders ring on the Cooked PT iPhone app."); };
  const paused = r.paused || (push.prefs ? !push.prefs.all : false);
  const pauseAll = (on: boolean) => { save({ ...r, paused: on }); if (push.prefs) void push.save({ ...push.prefs, all: !on }); };
  return <Sheet title="Notifications" onClose={onClose} testId="tr-notifications">
    <div className="mt-1 flex items-center gap-3 rounded-[14px] p-4" style={{ background: C.card2 }}><Bell className="h-6 w-6 shrink-0" style={{ color: C.lime }} /><p className="text-[14px]" style={{ color: C.steel }}>Session reminders ring on this iPhone. Alerts from clients come from Arise, on every phone you sign in on.</p></div>
    <div className="mt-3"><Switch label="Pause all" sub="Everything off for now" on={paused} flip={() => pauseAll(!paused)} testId="tr-remind-pause" /></div>

    <Title>Sessions</Title>
    <Card className={`!p-4 ${r.paused ? "opacity-50" : ""}`}>
      <p className="text-[13px] font-semibold" style={{ color: C.dim }}>Remind me before each booked session</p>
      <div className="mt-2 grid grid-cols-4 gap-1.5">{BEFORE_CHOICES.map((b) => <button key={b} type="button" aria-pressed={r.before === b} onClick={() => save({ ...r, before: b })} className="h-10 rounded-[10px] text-[14px] font-semibold" style={r.before === b ? { background: C.lime, color: "var(--fit-on-accent)" } : { background: C.card2 }} data-testid={`tr-before-${b}`}>{b ? `${b} min` : "Off"}</button>)}</div>
    </Card>
    <div className={`mt-2 space-y-2 ${r.paused ? "opacity-50" : ""}`}>
      <Switch label="Plan your day" sub={r.daily.on ? `Every day at ${fmtTime(r.daily.time)}` : "A morning look at sessions and check-ins"} on={r.daily.on} flip={() => save({ ...r, daily: { ...r.daily, on: !r.daily.on } })} testId="tr-remind-daily" />
      {r.daily.on && <Card className="!p-3"><input type="time" value={r.daily.time} aria-label="Plan your day time" onChange={(e) => { if (/^\d{2}:\d{2}$/.test(e.target.value)) save({ ...r, daily: { ...r.daily, time: e.target.value } }); }} className="h-12 w-full rounded-[8px] px-3 text-[17px]" style={{ background: C.card2, color: C.text }} /></Card>}
    </div>

    <Title>From clients</Title>
    <PushPrefsList app="trainer" prefs={push.prefs} save={push.save} />
    {push.err && <p className="mt-2 px-1 text-[13px]" style={{ color: C.red }}>{push.err}</p>}

    {canUseNative() && <Btn kind="soft" className="mt-4 w-full" onClick={async () => setMsg((await testNotification("Cooked PT")) ? "A test notification is coming in 5 seconds." : "Notifications are off for Cooked PT. Turn them on in Settings → Notifications → Cooked PT.")}>Send a test notification</Btn>}
    {msg && <p className="mt-3 rounded-[10px] px-3 py-2 text-[13px]" style={{ background: C.card, color: C.steel }}>{msg}</p>}
  </Sheet>;
}
