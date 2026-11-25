// Today's check-ins for LifeHub's task list (shared/dailyCheckins.ts), live: Cooked's diary (the same saved copy
// Cooked uses, so a meal logged in either place shows in both), LifeHub's habits, routines and pills, and what
// an accountability partner asked for today. Every action writes to the plugin itself.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { useFitData } from "@/pages/fit/fitStore";
import type { Family } from "@shared/familyHub";
import type { FitData, Meal as FitMeal } from "@shared/fit";
import type { AcctTask, Checkin as AcctCheckin } from "@shared/accountability";
import { emptyDaily, type DailySettings } from "@shared/dailySettings";
import {
  addWater, buildCheckins, logMeal, logWeight, logWorkout, markHabit, markMed, markPill, markRoutine, removeFood, shownCheckins, tickCooked, withDone,
  type AcctInput, type Checkin, type FoodIn,
} from "@shared/dailyCheckins";

const dayNow = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

export type DailyInput = {
  family: Family;
  setFamily: (update: (f: Family) => Family) => void;
  on: { cooked: boolean; habits: boolean; routines: boolean; pills: boolean; accountability: boolean };
  /** Opens where a check-in is tracked in full. */
  open: (c: Checkin) => void;
  say: (text: string) => void;
};

export type DailyApi = {
  date: string;
  /** Every check-in, hidden ones too (the settings list them). */
  all: Checkin[];
  /** The ones in the list. */
  items: Checkin[];
  done: number;
  total: number;
  settings: DailySettings;
  setSettings: (update: (s: DailySettings) => DailySettings) => void;
  /** The circle: done or not done, the way that fits each kind. Returns "open" when the row should open instead. */
  toggle: (c: Checkin) => "open" | void;
  logMeal: (c: Checkin, foods: FoodIn[]) => void;
  removeFood: (foodId: string) => void;
  logWorkout: (name: string, minutes: number) => void;
  addWater: (ml: number) => void;
  logWeight: (value: number) => void;
  dose: (c: Checkin, status: "taken" | "skipped" | null) => void;
  routineStep: (c: Checkin, stepId: string, on: boolean) => void;
  open: (c: Checkin) => void;
  /** Cooked's data, for the meal panel (what's logged, recent foods) and units. */
  fit: FitData;
  family: Family;
  token: string | null;
};

export function useDailyCheckins(input: DailyInput): DailyApi {
  const { token } = useAuth();
  const { data: fit, update: updateFit } = useFitData(token);
  const [date, setDate] = useState(dayNow);
  // A new day starts the list over at midnight (checked each minute while open).
  useEffect(() => { const t = window.setInterval(() => setDate((d) => (d === dayNow() ? d : dayNow())), 60_000); return () => window.clearInterval(t); }, []);

  // Accountability: what's asked of me, refreshed while the list is open.
  const [acct, setAcct] = useState<AcctInput | null>(null);
  const loadAcct = useCallback(async () => {
    if (!input.on.accountability || !token) { setAcct(null); return; }
    try {
      const r = await fetch(`${API_BASE}/api/accountability`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) return;
      const b = await r.json() as { me: number; tasks: AcctTask[]; checkins: AcctCheckin[]; spaces: { members: { userId: number; name: string }[] }[] };
      const names: Record<number, string> = {};
      for (const s of b.spaces || []) for (const m of s.members || []) names[m.userId] = m.name;
      setAcct({ me: b.me, tasks: b.tasks || [], checkins: b.checkins || [], names });
    } catch { /* offline: keep what we had */ }
  }, [input.on.accountability, token]);
  useEffect(() => {
    void loadAcct();
    const again = () => { if (document.visibilityState === "visible") void loadAcct(); };
    document.addEventListener("visibilitychange", again);
    const t = window.setInterval(again, 60_000);
    return () => { document.removeEventListener("visibilitychange", again); window.clearInterval(t); };
  }, [loadAcct]);

  const settings = input.family.daily ?? emptyDaily();
  const all = useMemo(() => buildCheckins({
    date, settings, fit: input.on.cooked ? fit : null, family: input.family,
    on: { habits: input.on.habits, routines: input.on.routines, pills: input.on.pills }, acct,
  }), [date, settings, fit, input.family, input.on.cooked, input.on.habits, input.on.routines, input.on.pills, acct]);
  const shown = shownCheckins(all, settings);

  const { setFamily } = input;
  const setSettings = useCallback((update: (s: DailySettings) => DailySettings) => setFamily((f) => ({ ...f, daily: update(f.daily ?? emptyDaily()) })), [setFamily]);

  // Today's done list goes with LifeHub's data, so a reminder (sent by the server or scheduled on the phone,
  // neither of which can see Cooked) isn't sent for something already done.
  const doneKey = all.filter((c) => c.done).map((c) => c.id).sort().join("|");
  const lastDone = useRef("");
  useEffect(() => {
    const key = `${date}#${doneKey}`;
    if (lastDone.current === key) return;
    lastDone.current = key;
    setFamily((f) => { const next = withDone(f.daily, date, all); return next === f.daily ? f : { ...f, daily: next }; });
  }, [date, doneKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitDo = (fn: (d: FitData) => FitData) => updateFit(fn);
  const say = input.say;

  const acctDone = useCallback(async (c: Checkin) => {
    if (!token || !c.ref) return;
    // Shown done straight away; put back if the server says no.
    setAcct((a) => a && { ...a, checkins: [...a.checkins, { id: `local-${Date.now()}`, taskId: c.ref!, spaceId: "", day: date, by: a.me, at: new Date().toISOString(), status: "approved", note: "", proof: [], answers: {}, score: null, feedback: "", reviewedBy: null, reviewedAt: null }] });
    try {
      const r = await fetch(`${API_BASE}/api/accountability/checkins`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ taskId: c.ref, day: date, note: "", proof: [] }) });
      if (!r.ok) { const b = await r.json().catch(() => null); say(b?.message || "Accountability couldn't be reached. Try again."); }
      else say(`Checked off "${c.title}". They'll see it.`);
    } catch { say("You're offline. Try again when you're back online."); }
    void loadAcct();
  }, [token, date, say, loadAcct]);

  const toggle = (c: Checkin): "open" | void => {
    switch (c.kind) {
      case "meal": case "workout": case "water": case "weight": case "sleep": case "fast":
        if (c.done && !c.byHand) return "open"; // logged: the row opens to show (or take back) what was logged
        fitDo((d) => tickCooked(d, c, date, !c.done));
        if (!c.done) say(c.kind === "meal" ? `${c.title} ticked off. Add what you had any time.` : c.kind === "workout" ? "Marked as a rest day." : `${c.title} ticked off.`);
        return;
      case "med": fitDo((d) => markMed(d, c, date, c.done ? null : "taken")); return;
      case "pill": setFamily((f) => markPill(f, c, date, c.done ? null : "taken", new Date().toISOString())); return;
      case "habit": setFamily((f) => markHabit(f, c.ref!, date, !c.done)); return;
      case "routine": setFamily((f) => markRoutine(f, c.ref!, date, !c.done)); return;
      case "acct":
        if (c.done) return "open";
        if (c.quick) { void acctDone(c); return; }
        return "open";
    }
  };

  return {
    date, all, items: shown.items, done: shown.done, total: shown.total, settings, setSettings, toggle,
    logMeal: (c, foods) => { fitDo((d) => logMeal(d, date, c.meal as FitMeal, foods)); say(`Logged ${c.title.toLowerCase()} in Cooked.`); },
    removeFood: (id) => fitDo((d) => removeFood(d, id)),
    logWorkout: (name, minutes) => { fitDo((d) => logWorkout(d, name, minutes)); say(`Logged ${minutes} min of ${name.toLowerCase()} in Cooked.`); },
    addWater: (ml) => fitDo((d) => addWater(d, date, ml)),
    logWeight: (v) => { fitDo((d) => logWeight(d, date, v)); say("Weight logged in Cooked."); },
    dose: (c, status) => { if (c.kind === "med") fitDo((d) => markMed(d, c, date, status)); else setFamily((f) => markPill(f, c, date, status, new Date().toISOString())); },
    routineStep: (c, stepId, on) => setFamily((f) => markRoutine(f, c.ref!, date, on, stepId)),
    open: input.open,
    fit, family: input.family, token,
  };
}

/** Keeps today's done list (for reminders) current while LifeHub is open, even when Tasks isn't: a meal logged in
 *  Cooked then stops its reminder without the list ever being opened. Draws nothing. */
export function DailyDoneSync({ family, setFamily, on }: Pick<DailyInput, "family" | "setFamily" | "on">) {
  const { token } = useAuth();
  const { data: fit } = useFitData(token);
  const date = dayNow();
  const all = useMemo(() => buildCheckins({ date, settings: family.daily, fit: on.cooked ? fit : null, family, on: { habits: on.habits, routines: on.routines, pills: on.pills } }),
    [date, family, fit, on.cooked, on.habits, on.routines, on.pills]);
  const key = `${date}#${all.filter((c) => c.done).map((c) => c.id).sort().join("|")}`;
  const last = useRef("");
  useEffect(() => {
    if (last.current === key) return;
    last.current = key;
    // Accountability isn't read here, so what the Tasks screen knows about it is kept.
    setFamily((f) => {
      const keep = f.daily?.done?.date === date ? f.daily.done.ids.filter((x) => x.startsWith("acct:")) : [];
      const next = withDone(f.daily, date, all);
      const merged = keep.length ? { ...next, done: { date, ids: [...new Set([...(next.done?.ids ?? []), ...keep])].sort() } } : next;
      return merged.done && f.daily?.done && merged.done.date === f.daily.done.date && merged.done.ids.join("|") === f.daily.done.ids.join("|") ? f : { ...f, daily: merged };
    });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
