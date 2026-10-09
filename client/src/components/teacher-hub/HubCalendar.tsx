// Arise WorkHub: the Calendar tab. Events the teacher types in, events added with
// AI or from a calendar file, and calendars connected by their link (Google,
// Outlook, Apple or any other calendar that can be shared as a link).
import { PinButton } from "./HubPins";
import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { AlarmClock, AlertTriangle, Bell, Calendar, CalendarClock, Check, Clock, EyeOff, List as ListIcon, Repeat, ChevronLeft, ChevronRight, Link2, Loader2, MapPin, Pencil, Plus, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import {
  HUB_IMPORT_LIMITS, cleanHubImport, clock12, describeHubAdded, mergeHubImport, removeCalendar, replaceCalendarEvents,
  type HubCalendar as ConnectedCalendar, type HubEvent, type Workspace,
} from "@shared/teacherHub";
import { Card, Empty, Field, GhostButton, PrimaryButton, Select, TextArea } from "./ui";
import { localDay, localZone } from "./HubImport";
import { HubModal } from "./HubModal";
import { MyAvailability } from "./HubAvailability";
import { AskForCalendar, OthersSchedule } from "./HubOthersCalendars";
import { OWNER_NAME_MAX, cleanOwner } from "@shared/hubOthers";
import type { FreeWindow } from "@shared/availability";
import { addMonthsTo, agendaDays, clockOf, dayTimeline, isPast, monthGrid, nowParts, openRanges, shiftDay, stillAhead, weekOf, type Now } from "@shared/hubCalendar";
import { addDays } from "@shared/hubDates";
import { CHECK_BACK_DAYS, canMove, needsCheck, setEventDone, setEventsDone, snoozeEvent, snoozedTo, snoozesFor, type Snooze } from "@shared/hubEventStatus";
import { calendarEvents, hideEvent, showAgain, type HideScope } from "@shared/hubHidden";
import { EVENT_REPEATS, REPEAT_LABELS, moveOccurrence, repeatText, savedEvent, skipOccurrence, unskipOccurrence } from "@shared/hubRepeat";
import { QUICK_TITLE_MAX, addQuickItems, eventEdit, quickItems, updateEvent, type EventEdit, type QuickForm, type QuickItems, type QuickKind } from "@shared/hubQuickAdd";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;

/** "Tuesday, Oct 6" from "2026-10-06". */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export const eventTime = (event: Pick<HubEvent, "start" | "end">) =>
  event.start ? (event.end ? `${clock12(event.start)} – ${clock12(event.end)}` : clock12(event.start)) : "All day";

export const byWhen = (a: HubEvent, b: HubEvent) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || "") || a.title.localeCompare(b.title);


/** The current date and time on this device. It moves on by itself, so "today" and "already over" stay right all day. */
export function useNow(): Now {
  const [now, setNow] = useState(() => nowParts());
  useEffect(() => {
    const tick = () => setNow((prev) => { const next = nowParts(); return prev.date === next.date && prev.minutes === next.minutes ? prev : next; });
    const timer = window.setInterval(tick, 30_000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
  }, []);
  return now;
}

const toMin = (hm: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(hm || ""); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
const happeningNow = (e: HubEvent, now: Now) => {
  if (e.date !== now.date) return false;
  const s = toMin(e.start); if (s === null) return false;
  const t = toMin(e.end);
  return s <= now.minutes && now.minutes < (t !== null && t > s ? t : s + 60);
};

const QUICK_KINDS = [["event", "Event", Calendar], ["reminder", "Reminder", Bell]] as const;

/**
 * The quick "add" pop-up: a calendar event, a reminder for Reminders & to-dos, or an event with a
 * reminder for it. Used by the Calendar tab and the + button on every screen.
 * Handed an `event`, it changes that event instead: the same boxes filled in, plus its notes.
 */
export function AddEventModal({ onClose, onAdd, date, start, end, event, onSave, onDelete, reschedule = false }: {
  onClose: () => void; onAdd?: (items: QuickItems) => void; date?: string; start?: string; end?: string;
  /** The event being changed. */
  event?: HubEvent; onSave?: (changes: EventEdit) => void; onDelete?: () => void;
  /** Opened to pick a new day and time, so the cursor starts on the day. */
  reschedule?: boolean;
}) {
  const today = localDay();
  const [form, setForm] = useState<QuickForm>({ kind: "event", title: event?.title || "", date: event?.date || date || today, start: event?.start || start || "", end: event?.end || end || "", location: event?.location || "", alsoRemind: false, repeat: event?.repeat || "", until: event?.until || "" });
  const [notes, setNotes] = useState(event?.notes || "");
  const reminder = form.kind === "reminder";
  const items = event ? (eventEdit({ ...form, notes }) ? {} : null) : quickItems(form);
  // An event has to have a day, so coming back from a reminder with no date picks one again.
  const setKind = (kind: QuickKind) => setForm((f) => ({ ...f, kind, date: kind === "event" && !f.date ? date || today : f.date }));
  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!items) return;
    if (event) onSave?.({ title: form.title, date: form.date, start: form.start, end: form.end, location: form.location, notes, repeat: form.repeat, until: form.until });
    else onAdd?.(items);
    onClose();
  }
  const chip = (active: boolean) => `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${active ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`;
  return (
    <HubModal title={event ? (reschedule ? "Reschedule" : "Edit event") : reminder ? "Add a reminder" : "Add an event"} onClose={onClose} closeOnBackdrop={!event}
      footer={event
        ? <div className="flex flex-wrap items-center gap-2"><PrimaryButton onClick={() => save()} disabled={!items}><Check className="h-4 w-4" /> Save changes</PrimaryButton><GhostButton onClick={onClose}>Cancel</GhostButton>
          {onDelete && <button type="button" onClick={() => { onDelete(); onClose(); }} className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-red-600 hover:bg-red-50" data-testid="edit-event-delete"><Trash2 className="h-4 w-4" /> {event.repeat ? "Delete all" : "Delete"}</button>}</div>
        : <PrimaryButton onClick={() => save()} disabled={!items}><Plus className="h-4 w-4" /> {reminder ? "Add reminder" : form.alsoRemind ? "Add event and reminder" : "Add event"}</PrimaryButton>}>
      <form onSubmit={save} className="space-y-3" data-testid={event ? "edit-event-form" : "add-event-form"}>
        {!event && <div role="tablist" aria-label="What to add" className="flex gap-1 rounded-2xl bg-slate-100 p-1" data-testid="quick-add-kind">
          {QUICK_KINDS.map(([kind, label, Icon]) => (
            <button key={kind} type="button" role="tab" aria-selected={form.kind === kind} onClick={() => setKind(kind)}
              className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-2 text-sm font-semibold ${form.kind === kind ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}><Icon className="h-4 w-4" /> {label}</button>
          ))}
        </div>}
        <Field {...(reschedule ? {} : { "data-autofocus": true })} placeholder={reminder ? "What do you need to remember?" : "What is it?"} value={form.title} maxLength={QUICK_TITLE_MAX} onChange={(e) => setForm({ ...form, title: e.target.value })} required aria-label={reminder ? "Reminder" : "Event"} />
        {reminder ? (
          <>
            <label className="block text-xs font-medium text-slate-500">Due<Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} aria-label="Due" /></label>
            <div className="flex flex-wrap gap-2">
              {[["Today", today], ["Tomorrow", addDays(today, 1)], ["Next week", addDays(today, 7)], ["No date", ""]].map(([label, value]) => (
                <button key={label} type="button" aria-pressed={form.date === value} className={chip(form.date === value)} onClick={() => setForm({ ...form, date: value })}>{label}</button>
              ))}
            </div>
            <p className="text-xs text-slate-500">It goes on your Reminders & to-dos list, where you can check it off or make it repeat.</p>
          </>
        ) : (
          <>
            <Field {...(reschedule ? { "data-autofocus": true } : {})} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required aria-label="Date" />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-medium text-slate-500">Starts<Field type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-label="Starts" /></label>
              <label className="text-xs font-medium text-slate-500">Ends<Field type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-label="Ends" /></label>
            </div>
            <p className="-mt-1 text-xs text-slate-500">Leave the times empty for an all-day event.</p>
            <Field placeholder="Where (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} aria-label="Where" />
            {!reschedule && (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-slate-500">Repeats
                  <Select value={form.repeat || ""} onChange={(e) => setForm({ ...form, repeat: e.target.value, until: e.target.value ? form.until : "" })} aria-label="Repeats" data-testid="event-repeat">
                    <option value="">Does not repeat</option>
                    {EVENT_REPEATS.map((r) => <option key={r} value={r}>{REPEAT_LABELS[r]}</option>)}
                  </Select>
                </label>
                {form.repeat && <label className="text-xs font-medium text-slate-500">Until (optional)<Field type="date" min={form.date} value={form.until || ""} onChange={(e) => setForm({ ...form, until: e.target.value })} aria-label="Repeats until" /></label>}
              </div>
            )}
            {event?.repeat && <p className="-mt-1 text-xs text-slate-500">This repeats, so a change here changes every one of them. To move just one day, use Snooze on that day.</p>}
            {event ? <TextArea placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} aria-label="Notes" /> : (
              <label className="flex min-h-11 items-center gap-3 text-sm text-slate-700">
                <input type="checkbox" className="h-5 w-5 shrink-0" checked={form.alsoRemind} onChange={(e) => setForm({ ...form, alsoRemind: e.target.checked })} data-testid="quick-add-also-remind" />
                Also add it to Reminders & to-dos
              </label>
            )}
          </>
        )}
        <button type="submit" hidden />
      </form>
    </HubModal>
  );
}

const VIEWS = [["agenda", "Agenda"], ["week", "Week"], ["month", "Month"], ["free", "Free time"], ["avail", "Availability"]] as const;
type View = (typeof VIEWS)[number][0];
const readDay = (): { from: string; to: string } => { try { const v = JSON.parse(localStorage.getItem("arise-hub-day") || ""); if (/^\d\d:\d\d$/.test(v?.from) && /^\d\d:\d\d$/.test(v?.to) && v.from < v.to) return v; } catch { /* default */ } return { from: "07:30", to: "16:00" }; };
type DayLook = "list" | "timeline";
const readDayLook = (): DayLook => { try { return localStorage.getItem("arise-hub-day-look") === "timeline" ? "timeline" : "list"; } catch { return "list"; } };
const readView = (): View => { try { const v = localStorage.getItem("arise-hub-cal-view"); return VIEWS.some(([k]) => k === v) ? (v as View) : "agenda"; } catch { return "agenda"; } };
const shortDay = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

async function readCalendarLink(token: string | null, url: string) {
  const response = await fetch(`${API_BASE}/api/teacher-hub/calendar`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ url, timeZone: localZone() }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "That calendar could not be read right now.");
  return data as { name: string; events: Omit<HubEvent, "id" | "calendarId">[] };
}

/**
 * Keeps connected calendars fresh: when the Hub opens, any calendar last read a
 * few hours ago is read again. A calendar that can't be reached keeps the events it had.
 */
export function useCalendarRefresh(ready: boolean, token: string | null, calendars: ConnectedCalendar[], setWorkspace: SetWorkspace, makeId: () => string) {
  const started = useRef(false);
  useEffect(() => {
    if (!ready || !token || started.current) return;
    started.current = true;
    const stale = calendars.filter((c) => Date.now() - (Date.parse(c.syncedAt) || 0) > HUB_IMPORT_LIMITS.calendarStaleMs);
    void (async () => {
      for (const calendar of stale) {
        try {
          const fresh = await readCalendarLink(token, calendar.url);
          setWorkspace((prev) => (prev.calendars.some((c) => c.id === calendar.id)
            ? replaceCalendarEvents(prev, { ...calendar, syncedAt: new Date().toISOString() }, fresh.events, makeId)
            : prev));
        } catch { /* it keeps what it had; the Calendar tab has a refresh button */ }
      }
    })();
  }, [ready, token]); // eslint-disable-line react-hooks/exhaustive-deps
}

const hostLabel = (url: string) => {
  try {
    const host = new URL(url).hostname;
    return /google\./.test(host) ? "Google Calendar" : /outlook|office|live\.com/.test(host) ? "Outlook calendar" : /icloud/.test(host) ? "Apple calendar" : host;
  } catch { return "Calendar"; }
};

/** How long the Undo for a snooze or a delete stays up. */
export const UNDO_SECONDS = 10;

/** How far ahead a repeating event is listed in the agenda. Week and Month reach as far as they show. */
const REPEATS_AHEAD_DAYS = 14;
const HOUR_PX = 56;
const hourLabel = (minutes: number) => { const h = Math.floor(minutes / 60) % 24; return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`; };

/**
 * One day against the clock: the hours down the side, each event a block as tall as it is long, a line
 * for right now. Tap an empty hour to add something there; tap one of your own events to change it.
 */
function DayTimelineView({ events, date, now, hours, onAdd, onEdit }: { events: HubEvent[]; date: string; now: Now; hours: { from: string; to: string }; onAdd: (start: string, end: string) => void; onEdit: (event: HubEvent) => void }) {
  const day = useMemo(() => dayTimeline(events, date, hours), [events, date, hours]);
  const y = (minutes: number) => ((minutes - day.from) / 60) * HOUR_PX;
  const slots = Array.from({ length: (day.to - day.from) / 60 }, (_, i) => day.from + i * 60);
  const nowOn = date === now.date && now.minutes >= day.from && now.minutes <= day.to;
  return (
    <div data-testid="day-timeline">
      {day.allDay.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2" data-testid="timeline-all-day">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">All day</span>
          {day.allDay.map((e) => (canMove(e)
            ? <button key={e.id} type="button" onClick={() => onEdit(e)} aria-label={`Edit ${e.title}`} className={`min-h-9 max-w-full break-words rounded-lg border border-teal-300 bg-teal-50 px-2.5 text-left text-xs font-semibold text-teal-950 ${e.done ? "line-through opacity-70" : ""}`}>{e.title}</button>
            : <span key={e.id} className={`inline-flex min-h-9 max-w-full items-center break-words rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 ${e.done ? "line-through opacity-70" : ""}`}>{e.title}</span>))}
        </div>
      )}
      <div className="relative" style={{ height: (day.to - day.from) / 60 * HOUR_PX }}>
        {slots.map((slot) => (
          <button key={slot} type="button" onClick={() => onAdd(clockOf(slot), clockOf(Math.min(slot + 60, 1439)))} aria-label={`Add an event at ${hourLabel(slot)}`}
            className="absolute inset-x-0 flex items-start border-t border-slate-200 text-left hover:bg-slate-50" style={{ top: y(slot), height: HOUR_PX }}>
            <span className="w-12 shrink-0 pt-1 text-[11px] font-semibold text-slate-500">{hourLabel(slot)}</span>
          </button>
        ))}
        <div className="pointer-events-none absolute inset-y-0 left-12 right-0">
          {day.blocks.map(({ event: e, start, end, lane, lanes }) => {
            const over = isPast(e, now);
            const tall = end - start >= 45;
            const box = { top: y(start) + 1, height: Math.max(y(end) - y(start) - 2, 20), left: `${(lane / lanes) * 100}%`, width: `calc(${100 / lanes}% - 4px)` };
            const look = `pointer-events-auto absolute overflow-hidden rounded-lg border px-2 py-1 text-left text-xs leading-4 ${canMove(e) ? "border-teal-300 bg-teal-50 text-teal-950" : "border-slate-200 bg-slate-50 text-slate-700"} ${over ? "opacity-60" : ""}`;
            const text = (
              <>
                <span className={`font-semibold ${e.done ? "line-through" : ""} ${tall ? "block break-words" : ""}`}>{e.title}</span>
                <span className={tall ? "block opacity-80" : "ml-1.5 opacity-80"}>{eventTime(e)}</span>
              </>
            );
            return canMove(e)
              ? <button key={e.id} type="button" onClick={() => onEdit(e)} aria-label={`Edit ${e.title}, ${eventTime(e)}`} className={look} style={box} data-testid="timeline-event">{text}</button>
              : <div key={e.id} className={look} style={box} data-testid="timeline-event">{text}</div>;
          })}
        </div>
        {nowOn && <div aria-hidden className="pointer-events-none absolute left-10 right-0 z-10 flex items-center" style={{ top: y(now.minutes) - 4 }} data-testid="timeline-now"><span className="h-2 w-2 rounded-full bg-red-500" /><span className="h-0.5 flex-1 bg-red-500" /></div>}
      </div>
      <p className="mt-2 text-xs text-slate-500">Tap an empty hour to add something there. Tap one of your events to change it.</p>
    </div>
  );
}

const ROW_ACTION = "inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold";

function EventRow({ event, now, names, workspace, setWorkspace, makeId, onDelete, onEdit, onSnooze, onHide }: {
  event: HubEvent; now: Now; names: Map<string, string>; workspace: Workspace; setWorkspace: SetWorkspace; makeId: () => string;
  /** "one" removes just this day of a repeating event. */
  onDelete: (event: HubEvent, scope: "one" | "all") => void; onEdit: (event: HubEvent) => void; onSnooze: (event: HubEvent, how: Snooze) => void; onHide: (event: HubEvent, scope: HideScope) => void;
}) {
  const live = happeningNow(event, now);
  // The teacher's own events can be edited and snoozed. A connected calendar's events are changed in that calendar.
  const own = canMove(event);
  const repeats = !!event.seriesId;
  // The row's buttons make way for a follow-up question: where to snooze to, which ones to delete or hide.
  const [asking, setAsking] = useState<"snooze" | "delete" | "hide" | null>(null);
  const choice = `${ROW_ACTION} border border-slate-200 bg-white text-slate-800 hover:bg-slate-50`;
  const quiet = `${ROW_ACTION} text-slate-600 hover:bg-slate-100`;
  const answer = (run: () => void) => () => { setAsking(null); run(); };
  return (
    <li className={`rounded-2xl border p-3 ${live ? "border-teal-500 bg-teal-50/60" : "border-slate-200"} ${isPast(event, now) ? "opacity-60" : ""}`} data-testid="event-row">
      <div className="flex items-start gap-3">
        <div className="w-[4.75rem] shrink-0 pt-0.5 text-xs font-semibold leading-5 text-slate-700 sm:w-36">{eventTime(event)}{live && <span className="mt-1 block w-fit rounded-full bg-teal-600 px-2 text-[11px] text-white">Now</span>}</div>
        <div className="min-w-0 flex-1">
          <div className={`break-words font-medium ${event.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{event.title}</div>
          {(event.location || event.calendarId || event.repeat) && (
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              {event.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{event.location}</span></span>}
              {event.repeat && <span className="inline-flex items-center gap-1" data-testid="event-repeats"><Repeat className="h-3.5 w-3.5 shrink-0" />{repeatText(event)}</span>}
              {event.calendarId && <span className="rounded-full bg-teal-50 px-2 py-0.5 font-medium text-teal-800">{names.get(event.calendarId) || "Connected calendar"}</span>}
            </div>
          )}
          {event.notes && <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-slate-500">{event.notes}</p>}
        </div>
        <PinButton workspace={workspace} setWorkspace={setWorkspace} kind="event" refId={event.seriesId || event.id} title={event.title} makeId={makeId} />
        {own && (
          <button type="button" aria-label={`Delete ${event.title}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => (repeats ? setAsking("delete") : onDelete(event, "all"))}><Trash2 className="h-4 w-4" /></button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1" data-testid="event-actions">
        {asking === "snooze" && (
          <>
            <span className="mr-1 text-xs font-medium text-slate-500">Move it to</span>
            {snoozesFor(event).map((s) => <button key={s.id} type="button" onClick={answer(() => onSnooze(event, s.id))} className={choice}>{s.label}</button>)}
          </>
        )}
        {asking === "delete" && (
          <>
            <span className="mr-1 text-xs font-medium text-slate-500">Delete</span>
            <button type="button" onClick={answer(() => onDelete(event, "one"))} className={choice}>Just this one</button>
            <button type="button" onClick={answer(() => onDelete(event, "all"))} className={choice}>All of them</button>
          </>
        )}
        {asking === "hide" && (
          <>
            <span className="mr-1 text-xs font-medium text-slate-500">Hide</span>
            <button type="button" onClick={answer(() => onHide(event, "one"))} className={choice}>Just this one</button>
            <button type="button" onClick={answer(() => onHide(event, "all"))} className={choice}>Every one with this name</button>
          </>
        )}
        {asking ? <button type="button" onClick={() => setAsking(null)} className={quiet}>Cancel</button> : (
          <>
            <button type="button" aria-pressed={!!event.done} aria-label={`${event.done ? "Done" : "Mark done"}: ${event.title}`} onClick={() => setWorkspace((p) => setEventDone(p, event.id, !event.done))} data-testid="event-done"
              className={`${ROW_ACTION} ${event.done ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-100"}`}><Check className="h-3.5 w-3.5" />{event.done ? "Done" : "Mark done"}</button>
            {own && <button type="button" aria-label={`Snooze ${event.title}`} onClick={() => setAsking("snooze")} className={quiet} data-testid="event-snooze"><AlarmClock className="h-3.5 w-3.5" />Snooze</button>}
            {own && <button type="button" aria-label={`Edit ${event.title}`} onClick={() => onEdit(event)} className={quiet} data-testid="event-edit"><Pencil className="h-3.5 w-3.5" />Edit</button>}
            <button type="button" aria-label={`Hide ${event.title}`} onClick={() => setAsking("hide")} className={quiet} data-testid="event-hide"><EyeOff className="h-3.5 w-3.5" />Hide</button>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * The calendar with its views (agenda, week, month, open times) and Add event. Used on the Calendar tab and on Home.
 * `onReminderAdded` is told when the pop-up put something in Reminders & to-dos, which this screen does not show.
 * `agendaToday` (Home) makes Agenda the agenda for today only; Week and Month still show what is ahead.
 */
export function CalendarPanel({ workspace, setWorkspace, token, makeId, title = "Calendar", onReminderAdded, agendaToday = false, collapseKey }: { collapseKey?: string; workspace: Workspace; setWorkspace: SetWorkspace; token: string | null; makeId: () => string; title?: string; onReminderAdded?: (items: QuickItems) => void; agendaToday?: boolean }) {
  const now = useNow();
  const today = now.date;
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem("arise-hub-cal-view", v); } catch { /* fine */ } };
  const [anchor, setAnchor] = useState(today);
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ date?: string; start?: string; end?: string } | null>(null);
  const [hint, setNotice] = useState("");
  const [dayHours, setDayHours] = useState(readDay);
  const changeDay = (patch: Partial<{ from: string; to: string }>) => setDayHours((d) => { const next = { ...d, ...patch }; try { if (next.from < next.to) localStorage.setItem("arise-hub-day", JSON.stringify(next)); } catch { /* fine */ } return next; });
  const [showPast, setShowPast] = useState(false);
  // The one-day agenda (Home) can be a list or a timeline against the clock.
  const [dayLook, setDayLookState] = useState<DayLook>(readDayLook);
  const setDayLook = (v: DayLook) => { setDayLookState(v); try { localStorage.setItem("arise-hub-day-look", v); } catch { /* fine */ } };

  const names = useMemo(() => new Map(workspace.calendars.map((c) => [c.id, c.name])), [workspace.calendars]);
  const oneDay = agendaToday && view === "agenda";
  // The day the one-day agenda is on. It follows today until the teacher steps to another day.
  const [stepped, setStepped] = useState<string | null>(null);
  const agendaDay = oneDay && stepped ? stepped : today;
  // The stretch of days being drawn. Repeating events are worked out for it; a little past and two weeks ahead are always in.
  const span = useMemo(() => {
    const shown = view === "week" ? weekOf(anchor) : view === "month" ? monthGrid(anchor).flat() : [agendaDay];
    const from = [shiftDay(today, -CHECK_BACK_DAYS), shown[0]].sort()[0];
    const to = [shiftDay(today, REPEATS_AHEAD_DAYS), shown[shown.length - 1]].sort()[1];
    return { from, to };
  }, [view, anchor, agendaDay, today]);
  // Everything on the calendar for that stretch: repeating events day by day, hidden ones left out.
  const events = useMemo(() => calendarEvents(workspace, span.from, span.to), [workspace.events, workspace.hiddenEvents, span]); // eslint-disable-line react-hooks/exhaustive-deps
  // What is still ahead right now. Events that are over drop out by themselves as the day goes on. A day gone by is shown whole.
  const wholeDay = oneDay && agendaDay < today;
  const visible = useMemo(() => (showPast || wholeDay ? events : stillAhead(events, now)), [events, showPast, wholeDay, now]);
  const sorted = useMemo(() => [...visible].sort(byWhen), [visible]);
  const onDay = (date: string) => sorted.filter((e) => e.date === date);
  const days = useMemo(() => agendaDays(sorted, agendaToday ? agendaDay : undefined), [sorted, agendaToday, agendaDay]);
  // How many are hidden because they are over: everything earlier, or just that day's on the one-day agenda.
  const earlier = wholeDay ? 0 : events.filter((e) => (!oneDay || e.date === agendaDay) && isPast(e, now)).length;
  const timeline = oneDay && dayLook === "timeline";

  const addQuick = (items: QuickItems) => { setWorkspace((p) => addQuickItems(p, items, makeId)); if (items.task) onReminderAdded?.(items); };
  /**
   * Deletes an event and offers it back for a few seconds, in the place it was.
   * For one day of a repeating event, "one" takes just that day out; "all" deletes the whole repeating event.
   */
  function removeEvent(event: HubEvent, scope: "one" | "all" = "all") {
    if (event.seriesId && scope === "one") {
      const seriesId = event.seriesId, date = event.date;
      setWorkspace((p) => skipOccurrence(p, seriesId, date));
      setMoved({ text: `Deleted "${event.title}" on ${dayLabel(date)}. The others stay.`, undo: () => setWorkspace((p) => unskipOccurrence(p, seriesId, date)) });
      return;
    }
    const id = event.seriesId || event.id;
    const at = workspace.events.findIndex((x) => x.id === id);
    const gone = workspace.events[at];
    setWorkspace((p) => ({ ...p, events: p.events.filter((x) => x.id !== id) }));
    if (!gone) return;
    setMoved({
      text: gone.repeat ? `Deleted every "${gone.title}".` : `Deleted "${gone.title}".`,
      undo: () => setWorkspace((p) => (p.events.some((x) => x.id === id) ? p : { ...p, events: [...p.events.slice(0, at), gone, ...p.events.slice(at)] })),
    });
  }
  /** Hides an event that is on the calendar but is not the teacher's to go to. */
  function hide(event: HubEvent, scope: HideScope) {
    const ruleId = makeId();
    setWorkspace((p) => hideEvent(p, event, scope, () => ruleId).workspace);
    setMoved({ text: scope === "all" ? `Hid every "${event.title}". They no longer count as busy.` : `Hid "${event.title}". It no longer counts as busy.`, undo: () => setWorkspace((p) => showAgain(p, ruleId)) });
  }
  const [editing, setEditingState] = useState<{ event: HubEvent; reschedule: boolean } | null>(null);
  /** Opens an event to change it. A day of a repeating event opens the repeating event itself. */
  const setEditing = (event: HubEvent) => { const saved = savedEvent(workspace, event); if (saved) setEditingState({ event: saved, reschedule: false }); };
  // What just moved or was deleted, with a way back for about ten seconds: a snoozed event can
  // jump off the screen (to tomorrow, say), and a delete can be a slip of the thumb.
  const [moved, setMoved] = useState<{ text: string; undo: () => void } | null>(null);
  useEffect(() => {
    if (!moved) return;
    const timer = window.setTimeout(() => setMoved(null), UNDO_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [moved]);
  function snooze(event: HubEvent, how: Snooze) {
    const to = snoozedTo(event, how, now);
    if (!to) return;
    const text = `Moved "${event.title}" to ${dayLabel(to.date)}${to.start ? `, ${clock12(to.start)}` : ""}.`;
    if (event.seriesId) {
      // One day of a repeating event: only that day moves. It becomes a one-time event; the rest stay on their rhythm.
      const seriesId = event.seriesId, date = event.date, newId = makeId();
      setWorkspace((p) => moveOccurrence(p, seriesId, date, to, () => newId).workspace);
      setMoved({ text: `${text} The others stay.`, undo: () => setWorkspace((p) => unskipOccurrence({ ...p, events: p.events.filter((e) => e.id !== newId) }, seriesId, date)) });
      return;
    }
    setWorkspace((p) => snoozeEvent(p, event.id, how, now));
    setMoved({ text, undo: () => setWorkspace((p) => ({ ...p, events: p.events.map((e) => (e.id === event.id ? event : e)) })) });
  }
  // The teacher's own events that are over and were never checked off.
  const check = useMemo(() => needsCheck(events, now), [events, now]);
  const [allChecks, setAllChecks] = useState(false);
  const hiddenRules = workspace.hiddenEvents || [];
  const move = (n: number) => setAnchor((a) => (view === "month" ? addMonthsTo(a, n) : shiftDay(a, n * 7)));
  const heading = view === "month"
    ? new Date(`${anchor.slice(0, 7)}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : (() => { const w = weekOf(anchor); return `${shortDay(w[0])} – ${shortDay(w[6])}`; })();

  return (
      <Card title={title} collapseKey={collapseKey} right={<PrimaryButton onClick={() => setAdding({ date: view === "month" && picked ? picked : oneDay && agendaDay > today ? agendaDay : undefined })}><Plus className="h-4 w-4" /> Add event</PrimaryButton>}>
        <div role="tablist" aria-label="Calendar view" className="mb-4 flex flex-wrap gap-1 rounded-2xl bg-slate-100 p-1" data-testid="calendar-views">
          {VIEWS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
              className={`min-h-11 min-w-[5.5rem] flex-1 rounded-xl px-2 text-sm font-semibold ${view === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{label}</button>
          ))}
        </div>

        {moved && (
          <div role="status" className="mb-3 flex items-center gap-1 rounded-xl bg-teal-50 py-1 pl-3 pr-1 text-sm text-teal-900" data-testid="event-moved">
            <span className="min-w-0 flex-1 break-words py-1.5">{moved.text}</span>
            <button type="button" onClick={() => { moved.undo(); setMoved(null); }} className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-3 text-sm font-semibold underline underline-offset-4">Undo</button>
            <button type="button" onClick={() => setMoved(null)} aria-label="Dismiss" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"><X className="h-4 w-4" /></button>
          </div>
        )}

        {check.length > 0 && view !== "free" && view !== "avail" && (
          <section aria-label="Did these happen?" className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-3" data-testid="event-check">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-amber-950">{check.length === 1 ? "Did this happen?" : `Did these happen? (${check.length})`}</h3>
              {check.length > 1 && <button type="button" onClick={() => setWorkspace((p) => setEventsDone(p, check.map((e) => e.id)))} className="min-h-10 text-xs font-semibold text-amber-900 underline underline-offset-4" data-testid="event-check-all">Mark all done</button>}
            </div>
            <ul className="mt-2 space-y-2">
              {(allChecks ? check : check.slice(0, 3)).map((e) => (
                <li key={e.id} className="rounded-xl bg-white p-3">
                  <div className="break-words font-medium text-slate-900">{e.title}</div>
                  <div className="text-xs text-slate-500">{dayLabel(e.date)} · {eventTime(e)}</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button type="button" aria-label={`Done: ${e.title}`} onClick={() => setWorkspace((p) => setEventDone(p, e.id, true))} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"><Check className="h-4 w-4" />Done</button>
                    <button type="button" aria-label={`Reschedule ${e.title}`} onClick={() => setEditingState({ event: e, reschedule: true })} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"><CalendarClock className="h-4 w-4" />Reschedule</button>
                  </div>
                </li>
              ))}
            </ul>
            {check.length > 3 && <button type="button" onClick={() => setAllChecks((v) => !v)} className="mt-2 min-h-10 text-xs font-semibold text-amber-900 underline underline-offset-4">{allChecks ? "Show fewer" : `Show all ${check.length}`}</button>}
          </section>
        )}

        {(view === "week" || view === "month") && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" aria-label={view === "month" ? "Previous month" : "Previous week"} onClick={() => move(-1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600"><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-0 text-center"><div className="truncate font-semibold text-slate-900">{heading}</div><button type="button" onClick={() => { setAnchor(today); setPicked(null); }} className="min-h-8 text-xs font-medium text-teal-700 underline underline-offset-4">Today</button></div>
            <button type="button" aria-label={view === "month" ? "Next month" : "Next week"} onClick={() => move(1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}

        {oneDay && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-1" data-testid="agenda-day">
              <button type="button" aria-label="Previous day" onClick={() => setStepped(shiftDay(agendaDay, -1))} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600"><ChevronLeft className="h-4 w-4" /></button>
              <div className="min-w-0 px-1">
                <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(agendaDay)}{agendaDay === today ? " · Today" : ""}</h3>
                {agendaDay !== today && <button type="button" onClick={() => setStepped(null)} className="text-xs font-medium text-teal-700 underline underline-offset-4">Back to today</button>}
              </div>
              <button type="button" aria-label="Next day" onClick={() => setStepped(shiftDay(agendaDay, 1))} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <div role="tablist" aria-label="Show the day as" className="flex gap-1 rounded-xl bg-slate-100 p-1" data-testid="day-look">
              {([["list", "List", ListIcon], ["timeline", "Timeline", Clock]] as const).map(([key, label, Icon]) => (
                <button key={key} type="button" role="tab" aria-selected={dayLook === key} onClick={() => setDayLook(key)}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold ${dayLook === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}><Icon className="h-3.5 w-3.5" />{label}</button>
              ))}
            </div>
          </div>
        )}

        {timeline && <DayTimelineView events={events} date={agendaDay} now={now} hours={dayHours} onAdd={(start, end) => setAdding({ date: agendaDay, start, end })} onEdit={setEditing} />}

        {view === "agenda" && !timeline && (
          days.length ? (
            <div className="space-y-5">
              {days.map((day) => (
                <section key={day.date} aria-label={dayLabel(day.date)}>
                  {!oneDay && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(day.date)}{day.date === today ? " · Today" : ""}</h3>}
                  <ul className="space-y-2">{day.events.map((event) => <EventRow key={event.id} event={event} now={now} names={names} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} onDelete={removeEvent} onEdit={setEditing} onSnooze={snooze} onHide={hide} />)}</ul>
                </section>
              ))}
            </div>
          ) : agendaToday ? (
            <div data-testid="agenda-today-empty">
              <Empty>{agendaDay !== today ? "Nothing on this day." : earlier > 0 && !showPast ? "Nothing else on today." : "Nothing on today."} Week and Month show what is coming up.</Empty>
            </div>
          ) : <Empty>Nothing coming up. Tap Add event, connect a calendar, or use Add with AI on a screenshot of your calendar.</Empty>
        )}

        {view === "week" && (
          <div className="grid gap-2 md:grid-cols-7" data-testid="week-view">
            {weekOf(anchor).map((date) => {
              const list = onDay(date);
              const over = date < today;
              return (
                <section key={date} aria-label={dayLabel(date)} className={`rounded-2xl border p-2 ${date === today ? "border-teal-500 bg-teal-50/60" : "border-slate-200"} ${over && !showPast ? "opacity-50" : ""}`}>
                  <div className="mb-1 flex items-center justify-between gap-1">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">{shortDay(date)}{date === today ? " · Today" : ""}</h3>
                    {!over && <button type="button" aria-label={`Add event on ${dayLabel(date)}`} onClick={() => setAdding({ date })} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"><Plus className="h-4 w-4" /></button>}
                  </div>
                  {list.length ? (
                    <ul className="space-y-1">
                      {list.map((e) => (
                        <li key={e.id} className={`rounded-lg text-xs ${happeningNow(e, now) ? "bg-teal-600 text-white" : "bg-slate-50 text-slate-800"}`}>
                          {e.calendarId
                            ? <div className="px-2 py-1.5"><div className="font-semibold">{eventTime(e)}</div><div className={`break-words ${e.done ? "line-through opacity-70" : ""}`}>{e.title}</div></div>
                            : <button type="button" onClick={() => setEditing(e)} aria-label={`Edit ${e.title}`} className="block min-h-11 w-full rounded-lg px-2 py-1.5 text-left"><div className="font-semibold">{eventTime(e)}</div><div className={`break-words ${e.done ? "line-through opacity-70" : ""}`}>{e.title}</div></button>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="px-1 text-xs text-slate-400">{over ? "Over" : "Nothing"}</p>}
                </section>
              );
            })}
          </div>
        )}

        {view === "month" && (
          <div data-testid="month-view">
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase text-slate-500">{["S", "M", "T", "W", "T", "F", "S"].map((d, i) => <div key={i}>{d}</div>)}</div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthGrid(anchor).flat().map((date) => {
                const count = sorted.filter((e) => e.date === date).length;
                const inMonth = date.slice(0, 7) === anchor.slice(0, 7);
                const chosen = (picked || today) === date;
                return (
                  <button key={date} type="button" onClick={() => setPicked(date)} aria-label={`${dayLabel(date)}${count ? `, ${count} ${count === 1 ? "event" : "events"}` : ""}`} aria-pressed={chosen}
                    className={`flex min-h-12 flex-col items-center justify-start rounded-xl border py-1 text-sm ${chosen ? "border-teal-600 bg-teal-50" : "border-transparent"} ${date === today ? "font-bold text-teal-700" : inMonth ? "text-slate-800" : "text-slate-300"} ${date < today ? "opacity-60" : ""}`}>
                    <span>{Number(date.slice(8))}</span>
                    {count > 0 && <span className="mt-0.5 inline-flex h-1.5 min-w-1.5 rounded-full bg-teal-600 px-0" aria-hidden />}
                  </button>
                );
              })}
            </div>
            <section className="mt-4" aria-label="Selected day">
              <div className="mb-2 flex items-center justify-between gap-2"><h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(picked || today)}</h3>
                {(picked || today) >= today && <GhostButton onClick={() => setAdding({ date: picked || today })}><Plus className="h-4 w-4" /> Add here</GhostButton>}</div>
              {onDay(picked || today).length
                ? <ul className="space-y-2">{onDay(picked || today).map((event) => <EventRow key={event.id} event={event} now={now} names={names} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} onDelete={removeEvent} onEdit={setEditing} onSnooze={snooze} onHide={hide} />)}</ul>
                : <Empty>{(picked || today) < today ? "That day is over." : "Nothing on this day."}</Empty>}
            </section>
          </div>
        )}

        {view === "free" && (
          <div className="space-y-3" data-testid="free-view">
            <p className="text-sm text-slate-600">Worked out from your calendar: the gaps in your day with everything on it taken out. Nothing to set up.</p>
            <div className="flex flex-nowrap items-center gap-1.5 text-sm text-slate-600 sm:gap-2">
              <span className="shrink-0">My day runs</span>
              <Field type="time" value={dayHours.from} onChange={(e) => changeDay({ from: e.target.value })} aria-label="Day starts" className="!w-auto min-w-0 flex-1 !px-2 sm:!px-3 sm:max-w-[8rem]" />
              <span className="shrink-0">to</span>
              <Field type="time" value={dayHours.to} onChange={(e) => changeDay({ to: e.target.value })} aria-label="Day ends" className="!w-auto min-w-0 flex-1 !px-2 sm:!px-3 sm:max-w-[8rem]" />
            </div>
            {(() => {
              const workday: FreeWindow[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, start: dayHours.from, end: dayHours.to }));
              const list = Array.from({ length: 14 }, (_, i) => shiftDay(today, i))
                .filter((date) => { const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); return (dow !== 0 && dow !== 6) || events.some((e) => e.date === date && e.start); })
                .map((date) => ({ date, ranges: openRanges(workday, events, date, now) }));
              return list.some((d) => d.ranges.length) ? (
                <ul className="space-y-2">
                  {list.filter((d) => d.ranges.length).map((d) => (
                    <li key={d.date} className="rounded-2xl border border-slate-200 p-3">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(d.date)}{d.date === today ? " · Today" : ""}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {d.ranges.map((r) => {
                          const to = Math.min(toMin(r.end)!, toMin(r.start)! + 60);
                          return <button key={r.start} type="button" onClick={() => setAdding({ date: d.date, start: r.start, end: clockOf(to) })} className="min-h-11 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-900">{clock12(r.start)} – {clock12(r.end)}</button>;
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <Empty>No free time in the next two weeks.</Empty>;
            })()}
            <p className="text-xs text-slate-500">Tap a free time to put an event there. Weekends show only when something is on them.</p>
          </div>
        )}

        {view === "avail" && (
          <div className="space-y-3" data-testid="availability-view">
            <p className="text-sm text-slate-600">Your availability is the times you offer for meetings, such as parent conferences. Set it once. When you plan a meeting, the poll's 3 suggested days and times come from here, with anything already on your calendar skipped.</p>
            <MyAvailability token={token} setNotice={setNotice} defaultOpen />
            {hint && <div className="rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900" role="status">{hint}</div>}
          </div>
        )}

        {(view === "agenda" || view === "week" || view === "month") && !timeline && earlier > 0 && (
          <div className="mt-4 text-center"><button type="button" onClick={() => setShowPast((v) => !v)} className="min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">{showPast ? "Hide events that are over" : `Show ${earlier} that ${earlier === 1 ? "is" : "are"} over`}</button></div>
        )}
        {adding && <AddEventModal date={adding.date} start={adding.start} end={adding.end} onClose={() => setAdding(null)} onAdd={addQuick} />}
        {editing && <AddEventModal key={editing.event.id} event={editing.event} reschedule={editing.reschedule} onClose={() => setEditingState(null)} onSave={(changes) => setWorkspace((p) => updateEvent(p, editing.event.id, changes))} onDelete={() => removeEvent(editing.event, "all")} />}
        {hiddenRules.length > 0 && (
          <details className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm" data-testid="hidden-events">
            <summary className="cursor-pointer font-semibold text-slate-700">Hidden from your calendar ({hiddenRules.length})</summary>
            <p className="mt-2 text-xs text-slate-500">These are on a calendar of yours but not yours to go to. They are not shown, do not count as busy, and send no reminders.</p>
            <ul className="mt-2 space-y-2">
              {hiddenRules.map((rule) => (
                <li key={rule.id} className="flex items-center gap-2 rounded-xl bg-white py-1 pl-3 pr-1">
                  <div className="min-w-0 flex-1 py-1.5"><div className="break-words font-medium text-slate-900">{rule.title}</div><div className="text-xs text-slate-500">{rule.date ? `${dayLabel(rule.date)}${rule.start ? ` · ${clock12(rule.start)}` : ""}` : "Every one with this name"}</div></div>
                  <button type="button" aria-label={`Show ${rule.title} again`} onClick={() => setWorkspace((p) => showAgain(p, rule.id))} className="inline-flex min-h-11 shrink-0 items-center rounded-xl px-3 text-sm font-semibold text-teal-700 hover:bg-teal-50">Show again</button>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>
  );
}

export default function HubCalendarTab({ workspace, setWorkspace, token, makeId, onReminderAdded }: { workspace: Workspace; setWorkspace: SetWorkspace; token: string | null; makeId: () => string; onReminderAdded?: (items: QuickItems) => void }) {
  const [link, setLink] = useState("");
  /** Whose calendar is being connected: the teacher's own, or someone else's (a social worker's, another teacher's). */
  const [whose, setWhose] = useState<"mine" | "other">("mine");
  const [owner, setOwner] = useState("");
  /** For someone else's calendar: keep only when they are busy, and not what their events are. */
  const [busyOnly, setBusyOnly] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const full = workspace.calendars.length >= HUB_IMPORT_LIMITS.calendars;
  const today = localDay();
  const names = useMemo(() => new Map(workspace.calendars.map((c) => [c.id, c.name])), [workspace.calendars]);

  async function connect(e: FormEvent) {
    e.preventDefault();
    const url = link.trim();
    if (!url || busy) return;
    if (workspace.calendars.some((c) => c.url === url)) { setError("That calendar is already connected."); return; }
    const theirs = whose === "other" ? cleanOwner(owner) : "";
    if (whose === "other" && !theirs) { setError("Type whose calendar it is, like Ms. Rivera."); return; }
    setBusy("connect"); setError(""); setNotice("");
    try {
      const fresh = await readCalendarLink(token, url);
      // Someone else's calendar goes by their name, and its events are kept apart from the teacher's own.
      const calendar: ConnectedCalendar = theirs
        ? { id: makeId(), name: theirs, url, syncedAt: new Date().toISOString(), owner: theirs, ...(busyOnly ? { busyOnly: true } : {}) }
        : { id: makeId(), name: fresh.name || hostLabel(url), url, syncedAt: new Date().toISOString() };
      setWorkspace((prev) => replaceCalendarEvents(prev, calendar, fresh.events, makeId));
      setLink(""); setOwner("");
      const count = `${fresh.events.length} ${fresh.events.length === 1 ? "event" : "events"}`;
      setNotice(theirs
        ? `${theirs}'s calendar is connected, with ${count}. It is not put on your calendar: it is under “Other people's calendars”, and meeting times are suggested around it. It refreshes each time you open your Hub.`
        : `${calendar.name} is connected, with ${count}. It refreshes each time you open your Hub.`);
    } catch (err: any) {
      setError(err?.message || "That calendar could not be read right now.");
    } finally {
      setBusy(null);
    }
  }

  async function refresh(calendar: ConnectedCalendar) {
    if (busy) return;
    setBusy(calendar.id); setError(""); setNotice("");
    try {
      const fresh = await readCalendarLink(token, calendar.url);
      setWorkspace((prev) => replaceCalendarEvents(prev, { ...calendar, name: calendar.name || fresh.name, syncedAt: new Date().toISOString() }, fresh.events, makeId));
      setNotice(`${calendar.name} is up to date.`);
    } catch (err: any) {
      setError(err?.message || "That calendar could not be read right now.");
    } finally {
      setBusy(null);
    }
  }

  async function upload(file: File | undefined) {
    if (!file || busy) return;
    setBusy("file"); setError(""); setNotice("");
    try {
      if (file.size > HUB_IMPORT_LIMITS.fileBytes) throw new Error("That file is too large. The most this page can read is 8 MB.");
      const bytes = new Uint8Array(await file.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const response = await fetch(`${API_BASE}/api/teacher-hub/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ file: { name: file.name, data: btoa(binary) }, today, timeZone: localZone() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "That calendar file could not be read.");
      const items = cleanHubImport({ events: data.items?.events }, today);
      setNotice(describeHubAdded(mergeHubImport(workspace, items, makeId, null)));
      setWorkspace((prev) => mergeHubImport(prev, items, makeId, null).workspace);
    } catch (err: any) {
      setError(err?.message || "That calendar file could not be read.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <CalendarPanel workspace={workspace} setWorkspace={setWorkspace} token={token} makeId={makeId} onReminderAdded={onReminderAdded} />

      <OthersSchedule workspace={workspace} today={today} />

      <Card title="Connected calendars" right={<span className="shrink-0 text-xs font-medium text-slate-500">{workspace.calendars.length} of {HUB_IMPORT_LIMITS.calendars}</span>}>
        {workspace.calendars.length > 0 && (
          <ul className="mb-4 space-y-2">
            {workspace.calendars.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                <Calendar className="h-5 w-5 shrink-0 text-teal-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">{c.name}{c.owner ? <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-slate-600">Someone else's</span> : null}</div>
                  <div className="text-xs text-slate-500">{workspace.events.filter((e) => e.calendarId === c.id).length} events{c.busyOnly ? " · busy times only" : ""} · refreshed {new Date(c.syncedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                </div>
                <button type="button" onClick={() => void refresh(c)} disabled={!!busy} aria-label={`Refresh ${c.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                  {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => setWorkspace((prev) => removeCalendar(prev, c.id))} disabled={!!busy} aria-label={`Disconnect ${c.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <div role="tablist" aria-label="Whose calendar is it" className="mb-3 flex gap-1 rounded-2xl bg-slate-100 p-1" data-testid="calendar-whose">
          {([["mine", "My calendar"], ["other", "Someone else's"]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={whose === value} onClick={() => { setWhose(value); setError(""); }} className={`min-h-11 flex-1 rounded-xl px-2 text-sm font-semibold ${whose === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{label}</button>
          ))}
        </div>
        {whose === "other" && (
          <div className="mb-3 space-y-3" data-testid="calendar-other">
            <p className="text-sm text-slate-600">Follow the calendar of someone you plan meetings with, like a social worker, a psychologist or another teacher. You see when they are busy, and meeting times are suggested around it. Their events are never put on your own calendar.</p>
            <Field placeholder="Whose is it? Like Ms. Rivera, social worker" value={owner} onChange={(e) => setOwner(e.target.value)} maxLength={OWNER_NAME_MAX} autoCapitalize="words" disabled={full} aria-label="Whose calendar it is" data-testid="calendar-owner" />
            <label className="flex min-h-11 items-start gap-3 text-sm text-slate-700"><input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0" checked={busyOnly} onChange={(e) => setBusyOnly(e.target.checked)} data-testid="calendar-busy-only" /><span>Only keep when they are busy, not what their events are. <span className="text-slate-500">Each one shows as “Busy”. Their calendar may name students or families.</span></span></label>
          </div>
        )}
        <form onSubmit={connect} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field type="url" inputMode="url" placeholder={whose === "other" ? "Paste their calendar's link (it ends in .ics)" : "Paste your calendar's link (it ends in .ics)"} value={link} onChange={(e) => setLink(e.target.value)} disabled={full} aria-label="Calendar link" data-testid="hub-calendar-link" />
          <PrimaryButton type="submit" disabled={!link.trim() || !!busy || full}>
            {busy === "connect" ? <><Loader2 className="h-4 w-4 animate-spin" /> Connecting…</> : <><Link2 className="h-4 w-4" /> Connect</>}
          </PrimaryButton>
        </form>
        {full && <p className="mt-2 text-sm text-slate-600">You can connect up to {HUB_IMPORT_LIMITS.calendars} calendars. Disconnect one to add another.</p>}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <GhostButton onClick={() => fileRef.current?.click()}>{busy === "file" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload a calendar file</GhostButton>
          <input ref={fileRef} type="file" accept=".ics,.ical,text/calendar" hidden onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ""; }} data-testid="hub-calendar-file" />
        </div>
        {error && <div className="mt-3 flex gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
        {notice && <div className="mt-3 rounded-xl bg-teal-50 px-3 py-2 text-sm text-teal-900" role="status">{notice}</div>}
        <details className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-900">Where do I find my calendar's link?</summary>
          <div className="mt-3 space-y-3 leading-6">
            <p><strong>Google Calendar:</strong> on a computer, open Settings, pick your calendar under "Settings for my calendars", choose "Integrate calendar", and copy "Secret address in iCal format".</p>
            <p><strong>Outlook:</strong> on the web, open Settings, then Calendar, then "Shared calendars". Under "Publish a calendar" pick your calendar, choose "Can view all details", press Publish, and copy the ICS link.</p>
            <p><strong>Apple (iCloud):</strong> at icloud.com/calendar, press the share button next to your calendar, turn on "Public Calendar", and copy the link.</p>
            <p className="text-slate-600">The link lets your Hub read your calendar. It can't change it. If your school has turned sharing off, export your calendar as a file and use "Upload a calendar file" instead.</p>
          </div>
        </details>
        <AskForCalendar sender={workspace.profile.senderName || ""} />
      </Card>
    </>
  );
}
