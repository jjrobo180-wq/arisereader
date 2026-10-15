// Picking the times to offer in a meeting poll: tap the times that work. Each open day lists its open
// times (on the hour or half hour) as buttons; what is already booked is never offered, and each day says
// what is on it, so a day with a meeting on it is easy to spot. Nothing to type unless a time is missing.
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Plus, Sparkles, X } from "lucide-react";
import { openTimes, suggestTimes, type FreeWindow } from "@shared/availability";
import { allDayItems, bookedOn, clashes, type AllDay, type Booked } from "@shared/hubBusy";
import { describeOption } from "@shared/meetingPoll";
import { clock12 } from "@shared/teacherHub";

export type PollTime = { date: string; start: string; end: string };
type Busy = { date: string; start: string; end?: string };

const pad = (n: number) => String(n).padStart(2, "0");
const plusMinutes = (hm: string, add: number) => { const t = Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3)) + add; return `${pad(Math.floor(t / 60) % 24)}:${pad(t % 60)}`; };
const dayLabel = (date: string, style: "long" | "short" = "long") => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: style, month: "short", day: "numeric", timeZone: "UTC" });
const when = (t: PollTime) => describeOption(t);
const key = (t: { date: string; start: string }) => `${t.date}|${t.start}`;

export const LENGTHS = [30, 45, 60, 90, 120];

export default function PollTimes({ times, setTimes, weekly, busy, mine, allDay, today, deadline, deadlineName, length, setLength, max, onEditAvailability }: {
  times: PollTime[]; setTimes: (next: PollTime[]) => void; weekly: FreeWindow[] | null; busy: Busy[]; mine: Booked[]; allDay: AllDay[]; today: string;
  deadline: string; deadlineName: string; length: number; setLength: (n: number) => void; max: number; onEditAvailability: () => void;
}) {
  const [shown, setShown] = useState(6);
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState({ date: "", start: "" });
  const [note, setNote] = useState("");

  const tomorrow = useMemo(() => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); }, [today]);
  const until = deadline && deadline > tomorrow ? deadline : undefined; // a deadline that is too close changes nothing
  const away = useMemo(() => new Set(allDay.filter((a) => a.blocks).map((a) => a.date)), [allDay]);

  const days = useMemo(() => {
    if (!weekly?.length) return [] as { date: string; slots: { start: string; end: string }[] }[];
    const groups: { date: string; slots: { start: string; end: string }[] }[] = [];
    for (const t of openTimes(weekly, { from: tomorrow, minutes: length, busy, until, days: 70, limit: 500 })) {
      if (away.has(t.date)) continue;
      let g = groups[groups.length - 1];
      if (!g || g.date !== t.date) { g = { date: t.date, slots: [] }; groups.push(g); }
      g.slots.push({ start: t.start, end: t.end });
    }
    return groups;
  }, [weekly, tomorrow, length, busy, until, away]);

  // The first time this opens with nothing picked, three good times are already ticked.
  useEffect(() => {
    if (times.length || !weekly?.length) return;
    pickForMe();
  }, [weekly]); // eslint-disable-line react-hooks/exhaustive-deps

  function pickForMe() {
    if (!weekly?.length) return;
    const found = suggestTimes(weekly, { from: tomorrow, minutes: length, busy, until, count: 3, perDay: 1 }).filter((t) => !away.has(t.date));
    if (!found.length) { setNote("None of your available times are open for that long. Try a shorter meeting, or add more availability."); return; }
    setNote(found.length < 3 ? `Only ${found.length} open ${found.length === 1 ? "time" : "times"} found${until ? ` before the ${deadlineName}` : ""}.` : "");
    setTimes(found);
  }
  function toggle(date: string, slot: { start: string; end: string }) {
    const at = times.findIndex((t) => key(t) === key({ date, start: slot.start }));
    if (at >= 0) { setTimes(times.filter((_, i) => i !== at)); setNote(""); return; }
    if (times.length >= max) { setNote(`You can offer up to ${max} times. Remove one first.`); return; }
    setNote("");
    setTimes([...times, { date, start: slot.start, end: slot.end }].sort((a, b) => key(a).localeCompare(key(b))));
  }
  function changeLength(minutes: number) {
    setLength(minutes);
    setTimes(times.map((t) => ({ ...t, end: plusMinutes(t.start, minutes) })));
  }
  function addCustom() {
    if (!draft.date || !draft.start) return;
    const t = { date: draft.date, start: draft.start, end: plusMinutes(draft.start, length) };
    const hit = clashes(mine, t);
    if (draft.date <= today) { setNote("Pick a day after today."); return; }
    if (hit.length) { setNote(`You already have ${hit.map((b) => `${b.title} at ${clock12(b.start)}`).join(" and ")} then.`); return; }
    if (times.some((x) => key(x) === key(t))) { setNote("That time is already picked."); return; }
    if (times.length >= max) { setNote(`You can offer up to ${max} times. Remove one first.`); return; }
    setNote(""); setTimes([...times, t].sort((a, b) => key(a).localeCompare(key(b)))); setDraft({ date: "", start: "" }); setCustom(false);
  }

  return (
    <section className="min-w-0 space-y-3" data-testid="poll-times">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-slate-900">Pick the times that work</h3>
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="poll-length">How long is the meeting</label>
          <select id="poll-length" value={length} onChange={(e) => changeLength(Number(e.target.value))} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800">
            {LENGTHS.map((m) => <option key={m} value={m}>{m} min</option>)}
          </select>
          <button type="button" onClick={pickForMe} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-teal-700 px-3 text-sm font-bold text-white hover:bg-teal-800"><Sparkles className="h-4 w-4" /> Pick 3 for me</button>
        </div>
      </div>

      {/* What is picked so far. */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3" data-testid="poll-picked">
        {times.length === 0 ? <p className="text-sm text-slate-600">Tap two or more times below. People will choose from them.</p> : (
          <ul className="flex flex-wrap gap-2">
            {times.map((t) => {
              const hit = clashes(mine, t);
              return (
                <li key={key(t)} className={`inline-flex min-h-10 items-center gap-1 rounded-full py-1 pl-3 pr-1 text-sm font-semibold ${hit.length ? "bg-red-100 text-red-800" : "bg-teal-700 text-white"}`}>
                  <span>{when(t)}</span>
                  <button type="button" aria-label={`Remove ${when(t)}`} onClick={() => setTimes(times.filter((x) => key(x) !== key(t)))} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/10"><X className="h-4 w-4" /></button>
                  {hit.length > 0 && <span className="basis-full pb-1 pl-0 pr-3 text-xs font-bold" role="alert">You have {hit.map((b) => `${b.title} at ${clock12(b.start)}`).join(" and ")} then.</span>}
                </li>
              );
            })}
          </ul>
        )}
        {times.length === 1 && <p className="mt-2 text-xs font-semibold text-amber-800">Pick at least one more so people have a choice.</p>}
      </div>
      {note && <p className="text-sm font-medium text-amber-800" role="status">{note}</p>}

      {weekly === null ? <p className="text-sm text-slate-500">Looking at your availability…</p>
        : !weekly.length ? <p className="text-sm text-slate-600">Set your availability to see open times, or add a time yourself below.</p>
        : !days.length ? <p className="text-sm text-slate-600">No open times{until ? ` before the ${deadlineName}` : ""} for a {length} minute meeting. Try a shorter meeting or add availability.</p> : (
        <div className="space-y-2" data-testid="poll-days">
          {days.slice(0, shown).map((d) => {
            const day = bookedOn(mine, d.date), meetings = day.filter((b) => b.meeting), notes = allDay.filter((a) => a.date === d.date);
            return (
              <div key={d.date} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-sm font-bold text-slate-900">{dayLabel(d.date)}</span>
                  {meetings.length > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900" data-testid="day-has-meeting">You have {meetings.length === 1 ? "a meeting" : `${meetings.length} meetings`}</span>}
                  {notes.map((a, i) => <span key={i} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{a.title}</span>)}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {d.slots.map((s) => {
                    const on = times.some((t) => key(t) === key({ date: d.date, start: s.start }));
                    return <button key={s.start} type="button" aria-pressed={on} onClick={() => toggle(d.date, s)}
                      className={`min-h-10 rounded-full px-3 text-sm font-semibold ring-1 transition active:scale-95 ${on ? "bg-teal-700 text-white ring-teal-700" : "bg-white text-slate-800 ring-slate-300 hover:bg-teal-50"}`}>{clock12(s.start)}</button>;
                  })}
                </div>
                {day.length > 0 && <p className="mt-2 text-xs text-slate-500">Already booked: {day.slice(0, 4).map((b) => `${b.title} ${clock12(b.start)}`).join(" · ")}{day.length > 4 ? ` · +${day.length - 4} more` : ""}</p>}
              </div>
            );
          })}
          {days.length > shown && <button type="button" onClick={() => setShown(shown + 6)} className="min-h-10 w-full rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Show more days</button>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setCustom(!custom)} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><Plus className="h-4 w-4" /> A different day or time</button>
        <button type="button" onClick={onEditAvailability} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><CalendarClock className="h-4 w-4" /> My availability</button>
      </div>
      {custom && (
        <div className="grid min-w-0 grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_1fr_auto]" data-testid="poll-custom">
          <input type="date" aria-label="Day" min={tomorrow} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-200 px-3 text-base sm:text-sm" />
          <input type="time" aria-label="Start time" step={1800} value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className="min-h-11 w-full min-w-0 max-w-full rounded-xl border border-slate-200 px-3 text-base sm:text-sm" />
          <button type="button" onClick={addCustom} disabled={!draft.date || !draft.start} className="col-span-2 min-h-11 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white disabled:opacity-40 sm:col-span-1">Add</button>
          {draft.date && draft.start && clashes(mine, { date: draft.date, start: draft.start, end: plusMinutes(draft.start, length) }).length > 0 && <p className="col-span-full text-xs font-bold text-red-700" role="alert">That runs into something already on your calendar.</p>}
        </div>
      )}
    </section>
  );
}
