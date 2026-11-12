/**
 * Cooked for Apple TV (native/fit-tv), signed in with a code like Arise Duo (server/tvLink.ts, app "fit"):
 *   GET  /api/fit/tv?day=YYYY-MM-DD&tz=<minutes>  what the TV shows: today's numbers (the same as the Fit
 *        widgets), the program's next day and your saved routines as follow-along sessions, the interval
 *        timers (built in and yours), the last workouts and the week.
 *   POST /api/fit/tv/workout { name, secs, day }  a session finished on the TV, added to your workout log
 *   POST /api/fit/tv/water   { ml, day }          a glass of water from the couch
 * The phone merges what other devices saved (client/src/pages/fit/fitStore.ts), so these writes are safe.
 */
import type { Express, RequestHandler } from "express";
import { CATALOG_BY_ID, PROGRAM_BY_ID, cleanFit, nextProgramDay, type FitData, type Routine } from "../shared/fit";
import { TIMER_PRESETS, cleanTimers, timerSession } from "../shared/fitTimers";
import type { Phase, Session } from "../shared/fitSessions";
import { FIT_VIDEOS } from "../shared/fitVideos";
import { fitWidgetSlots } from "../client/src/lib/fitWidgets";

type Store = { get(userId: number): Promise<unknown | null>; set(userId: number, data: unknown): Promise<void> };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** "8-10" or "12" reps → about how long a set takes; "30s" or "45 sec" → that long. */
function setSecs(reps: string, timed?: boolean): number {
  const secs = /(\d+)\s*(s|sec|second)/i.exec(reps);
  if (secs) return Math.min(600, Math.max(10, Number(secs[1])));
  if (timed) return 40;
  const n = Math.max(...(reps.match(/\d+/g) ?? ["10"]).map(Number));
  return Math.min(120, Math.max(25, Math.round(n * 3.5)));
}

/** A strength day (a program's or a saved routine) as a follow-along: each set timed, rest between. */
export function strengthSession(id: string, name: string, blurb: string, items: { exId: string; name?: string; sets: number; reps: string; rest: number }[]): Session {
  const phases: Phase[] = [{ name: "Warm up", secs: 180, kind: "warm", cue: "Easy cardio and arm circles. Get the blood moving." }];
  items.forEach((it, i) => {
    const ex = CATALOG_BY_ID.get(it.exId);
    const exName = (it.name || ex?.name || "Exercise").slice(0, 60);
    const sets = Math.max(1, Math.min(10, Number(it.sets) || 3));
    for (let s = 1; s <= sets; s++) {
      const v = FIT_VIDEOS[it.exId];
      phases.push({ name: exName, secs: setSecs(String(it.reps || "10"), ex?.timed), kind: "work", ...(v ? { video: { id: v.id, title: v.title.slice(0, 100) } } : {}),
        cue: [`Set ${s} of ${sets}`, it.reps ? `${it.reps}${/\d$/.test(String(it.reps)) ? " reps" : ""}` : "", ex?.cues?.[0] || ""].filter(Boolean).join(" · ") });
      const last = s === sets && i === items.length - 1;
      if (!last) {
        const next = s < sets ? exName : (items[i + 1].name || CATALOG_BY_ID.get(items[i + 1].exId)?.name || "the next one");
        phases.push({ name: "Rest", secs: Math.max(15, Math.min(300, Number(it.rest) || 60)), kind: "rest", cue: `Next: ${next}` });
      }
    }
  });
  phases.push({ name: "Cool down", secs: 120, kind: "cool", cue: "Stretch what you worked. Slow breaths." });
  return { id, name, category: "hiit", level: "Intermediate", equipment: "Your gym", blurb, phases };
}

/** What the TV shows. Pure, so it's tested. `now` is already moved to the person's own clock. */
export function fitTvSummary(raw: unknown, day: string, name: string, now: number) {
  const data = cleanFit(raw);
  const latestKg = [...data.weights].sort((a, b) => a.date.localeCompare(b.date)).pop()?.kg;
  const slots = fitWidgetSlots(data, latestKg, now).filter((s) => ["fit.calories", "fit.water", "fit.workouts", "fit.protein", "fit.streak", "fit.weight"].includes(s.id))
    .map((s) => ({ id: s.id, title: s.title, value: s.value, detail: s.detail || "", tint: s.tint || "#ff6b2c", progress: typeof s.progress === "number" ? Math.max(0, Math.min(1.5, s.progress)) : null, lines: (s.lines || []).slice(0, 5) }));
  const prog = data.program ? PROGRAM_BY_ID.get(data.program.id) : undefined;
  let program = null as null | { name: string; blurb: string; dayName: string; week: number; weeks: number; done: number; session: Session; exercises: { name: string; sets: number; reps: string; video?: { id: string; title: string } }[] };
  if (prog && data.program) {
    const next = nextProgramDay(prog, data.program.done);
    program = {
      name: prog.name, blurb: prog.blurb, dayName: next.day.name, week: next.week, weeks: prog.weeks, done: data.program.done.length,
      session: strengthSession(`program-${prog.id}-${next.index}`, `${prog.name}: ${next.day.name}`, prog.blurb, next.day.items),
      exercises: next.day.items.map((it) => ({ name: CATALOG_BY_ID.get(it.exId)?.name || it.exId, sets: it.sets, reps: it.reps, ...(FIT_VIDEOS[it.exId] ? { video: { id: FIT_VIDEOS[it.exId].id, title: FIT_VIDEOS[it.exId].title.slice(0, 100) } } : {}) })),
    };
  }
  const routines = data.routines.slice(0, 12).map((r: Routine) => strengthSession(`routine-${r.id}`, r.name, `${r.exercises.length} exercises`, r.exercises));
  const timers = [...TIMER_PRESETS, ...cleanTimers(data.timers)].map(timerSession);
  const history = [...data.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 15)
    .map((w) => ({ name: w.name.slice(0, 80), date: w.date.slice(0, 10), mins: Math.max(1, Math.round(w.secs / 60)), sets: w.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0) }));
  const week = Array.from({ length: 7 }, (_, i) => addDays(day, i - 6)).map((d) => ({ day: d, mins: Math.round(data.workouts.filter((w) => w.date.slice(0, 10) === d).reduce((t, w) => t + w.secs, 0) / 60) }));
  return { name, day, units: data.profile.units, slots, program, routines, timers, history, week };
}

export function registerFitTvRoutes(app: Express, auth: RequestHandler, store: Store): void {
  const dayOf = (v: unknown) => (DAY.test(String(v)) ? String(v) : new Date().toISOString().slice(0, 10));
  app.get("/api/fit/tv", auth, async (req: any, res) => {
    res.set("Cache-Control", "no-store");
    // The person's own clock: the server runs on UTC, so "today" for calories and water follows the TV.
    const tz = Number(req.query?.tz);
    const shift = Number.isFinite(tz) && Math.abs(tz) <= 840 ? (new Date().getTimezoneOffset() - tz) * 60_000 : 0;
    try { res.json(fitTvSummary(await store.get(Number(req.user.id)), dayOf(req.query?.day), String(req.user.displayName || ""), Date.now() + shift)); }
    catch { res.status(503).json({ message: "Cooked couldn't load your data. Try again in a moment." }); }
  });
  app.post("/api/fit/tv/workout", auth, async (req: any, res) => {
    const name = String(req.body?.name || "").trim().slice(0, 80), secs = Math.round(Number(req.body?.secs));
    if (!name || !Number.isFinite(secs) || secs < 30 || secs > 6 * 3600) return res.status(400).json({ message: "That workout can't be saved." });
    const me = Number(req.user.id);
    try {
      const data = cleanFit(await store.get(me));
      const day = dayOf(req.body?.day);
      data.workouts.push({ id: `tv-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date: `${day}T12:00:00.000Z`, name, secs, exercises: [], note: "On Apple TV" });
      await store.set(me, cleanFit(data));
      res.json({ ok: true });
    } catch { res.status(503).json({ message: "Couldn't save it just now." }); }
  });
  app.post("/api/fit/tv/water", auth, async (req: any, res) => {
    const ml = Math.round(Number(req.body?.ml));
    if (!Number.isFinite(ml) || ml < 50 || ml > 2000) return res.status(400).json({ message: "How much water?" });
    const me = Number(req.user.id);
    try {
      const data = cleanFit(await store.get(me));
      const day = dayOf(req.body?.day);
      data.water[day] = (data.water[day] ?? 0) + ml;
      await store.set(me, cleanFit(data));
      res.json({ ok: true, ml: data.water[day] });
    } catch { res.status(503).json({ message: "Couldn't save it just now." }); }
  });
}
