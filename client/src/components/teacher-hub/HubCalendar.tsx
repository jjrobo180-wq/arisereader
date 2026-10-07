// Teacher Hub: the Calendar tab. Events the teacher types in, events added with
// AI or from a calendar file, and calendars connected by their link (Google,
// Outlook, Apple or any other calendar that can be shared as a link).
import { PinButton } from "./HubPins";
import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { AlertTriangle, Calendar, ChevronLeft, ChevronRight, Link2, Loader2, MapPin, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import {
  HUB_IMPORT_LIMITS, cleanHubImport, clock12, describeHubAdded, mergeHubImport, removeCalendar, replaceCalendarEvents,
  type HubCalendar as ConnectedCalendar, type HubEvent, type Workspace,
} from "@shared/teacherHub";
import { Card, Empty, Field, GhostButton, PrimaryButton } from "./ui";
import { localDay, localZone } from "./HubImport";
import { HubModal } from "./HubModal";
import { MyAvailability } from "./HubAvailability";
import type { FreeWindow } from "@shared/availability";
import { addMonthsTo, clockOf, isPast, monthGrid, nowParts, openRanges, shiftDay, stillAhead, weekOf, type Now } from "@shared/hubCalendar";

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

/** The quick "add an event" pop-up. Used by the Calendar tab and the + button on every screen. */
export function AddEventModal({ onClose, onAdd, date, start, end }: { onClose: () => void; onAdd: (event: Omit<HubEvent, "id">) => void; date?: string; start?: string; end?: string }) {
  const [form, setForm] = useState({ title: "", date: date || localDay(), start: start || "", end: end || "", location: "" });
  function save(e?: FormEvent) {
    e?.preventDefault();
    if (!form.title.trim() || !form.date) return;
    onAdd({ title: form.title.trim(), date: form.date, start: form.start, end: form.start ? form.end : "", location: form.location.trim(), notes: "" });
    onClose();
  }
  return (
    <HubModal title="Add an event" onClose={onClose} closeOnBackdrop footer={<PrimaryButton onClick={() => save()} disabled={!form.title.trim() || !form.date}><Plus className="h-4 w-4" /> Add event</PrimaryButton>}>
      <form onSubmit={save} className="space-y-3" data-testid="add-event-form">
        <Field data-autofocus placeholder="What is it?" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required aria-label="Event" />
        <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required aria-label="Date" />
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-500">Starts<Field type="time" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-label="Starts" /></label>
          <label className="text-xs font-medium text-slate-500">Ends<Field type="time" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-label="Ends" /></label>
        </div>
        <p className="-mt-1 text-xs text-slate-500">Leave the times empty for an all-day event.</p>
        <Field placeholder="Where (optional)" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} aria-label="Where" />
        <button type="submit" hidden />
      </form>
    </HubModal>
  );
}

const VIEWS = [["agenda", "Agenda"], ["week", "Week"], ["month", "Month"], ["open", "Open times"]] as const;
type View = (typeof VIEWS)[number][0];
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

function EventRow({ event, now, names, workspace, setWorkspace, makeId, onDelete }: { event: HubEvent; now: Now; names: Map<string, string>; workspace: Workspace; setWorkspace: SetWorkspace; makeId: () => string; onDelete: (id: string) => void }) {
  const live = happeningNow(event, now);
  return (
    <li className={`flex items-start gap-3 rounded-2xl border p-3 ${live ? "border-teal-500 bg-teal-50/60" : "border-slate-200"} ${isPast(event, now) ? "opacity-60" : ""}`}>
      <div className="w-[4.75rem] shrink-0 pt-0.5 text-xs font-semibold leading-5 text-slate-700 sm:w-36">{eventTime(event)}{live && <span className="mt-1 block w-fit rounded-full bg-teal-600 px-2 text-[11px] text-white">Now</span>}</div>
      <div className="min-w-0 flex-1">
        <div className="break-words font-medium text-slate-900">{event.title}</div>
        {(event.location || event.calendarId) && (
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            {event.location && <span className="inline-flex min-w-0 items-center gap-1"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="break-words">{event.location}</span></span>}
            {event.calendarId && <span className="rounded-full bg-teal-50 px-2 py-0.5 font-medium text-teal-800">{names.get(event.calendarId) || "Connected calendar"}</span>}
          </div>
        )}
        {event.notes && <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-slate-500">{event.notes}</p>}
      </div>
      <PinButton workspace={workspace} setWorkspace={setWorkspace} kind="event" refId={event.id} title={event.title} makeId={makeId} />
      {!event.calendarId && (
        <button type="button" aria-label={`Delete ${event.title}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(event.id)}><Trash2 className="h-4 w-4" /></button>
      )}
    </li>
  );
}

export default function HubCalendarTab({ workspace, setWorkspace, token, makeId }: { workspace: Workspace; setWorkspace: SetWorkspace; token: string | null; makeId: () => string }) {
  const now = useNow();
  const today = now.date;
  const [view, setViewState] = useState<View>(readView);
  const setView = (v: View) => { setViewState(v); try { localStorage.setItem("arise-hub-cal-view", v); } catch { /* fine */ } };
  const [anchor, setAnchor] = useState(today);
  const [picked, setPicked] = useState<string | null>(null);
  const [adding, setAdding] = useState<{ date?: string; start?: string; end?: string } | null>(null);
  const [weekly, setWeekly] = useState<FreeWindow[]>([]);
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPast, setShowPast] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const names = useMemo(() => new Map(workspace.calendars.map((c) => [c.id, c.name])), [workspace.calendars]);
  // What is still ahead right now. Events that are over drop out by themselves as the day goes on.
  const visible = useMemo(() => (showPast ? workspace.events : stillAhead(workspace.events, now)), [workspace.events, showPast, now]);
  const sorted = useMemo(() => [...visible].sort(byWhen), [visible]);
  const onDay = (date: string) => sorted.filter((e) => e.date === date);
  const days = useMemo(() => {
    const groups: { date: string; events: HubEvent[] }[] = [];
    for (const event of sorted) {
      if (groups[groups.length - 1]?.date === event.date) groups[groups.length - 1].events.push(event);
      else groups.push({ date: event.date, events: [event] });
    }
    return groups;
  }, [sorted]);
  const earlier = workspace.events.length - stillAhead(workspace.events, now).length;
  const full = workspace.calendars.length >= HUB_IMPORT_LIMITS.calendars;

  const addEvent = (event: Omit<HubEvent, "id">) => setWorkspace((p) => ({ ...p, events: [...p.events, { ...event, id: makeId() }] }));
  const removeEvent = (id: string) => setWorkspace((p) => ({ ...p, events: p.events.filter((x) => x.id !== id) }));
  const move = (n: number) => setAnchor((a) => (view === "month" ? addMonthsTo(a, n) : shiftDay(a, n * 7)));
  const heading = view === "month"
    ? new Date(`${anchor.slice(0, 7)}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : (() => { const w = weekOf(anchor); return `${shortDay(w[0])} – ${shortDay(w[6])}`; })();

  async function connect(e: FormEvent) {
    e.preventDefault();
    const url = link.trim();
    if (!url || busy) return;
    if (workspace.calendars.some((c) => c.url === url)) { setError("That calendar is already connected."); return; }
    setBusy("connect"); setError(""); setNotice("");
    try {
      const fresh = await readCalendarLink(token, url);
      const calendar: ConnectedCalendar = { id: makeId(), name: fresh.name || hostLabel(url), url, syncedAt: new Date().toISOString() };
      setWorkspace((prev) => replaceCalendarEvents(prev, calendar, fresh.events, makeId));
      setLink("");
      setNotice(`${calendar.name} is connected, with ${fresh.events.length} ${fresh.events.length === 1 ? "event" : "events"}. It refreshes each time you open your Hub.`);
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
      <Card title="Calendar" right={<PrimaryButton onClick={() => setAdding({ date: view === "month" && picked ? picked : undefined })}><Plus className="h-4 w-4" /> Add event</PrimaryButton>}>
        <div role="tablist" aria-label="Calendar view" className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-slate-100 p-1" data-testid="calendar-views">
          {VIEWS.map(([key, label]) => (
            <button key={key} type="button" role="tab" aria-selected={view === key} onClick={() => setView(key)}
              className={`min-h-11 rounded-xl px-1 text-sm font-semibold ${view === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"}`}>{label}</button>
          ))}
        </div>

        {(view === "week" || view === "month") && (
          <div className="mb-3 flex items-center justify-between gap-2">
            <button type="button" aria-label={view === "month" ? "Previous month" : "Previous week"} onClick={() => move(-1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600"><ChevronLeft className="h-4 w-4" /></button>
            <div className="min-w-0 text-center"><div className="truncate font-semibold text-slate-900">{heading}</div><button type="button" onClick={() => { setAnchor(today); setPicked(null); }} className="min-h-8 text-xs font-medium text-teal-700 underline underline-offset-4">Today</button></div>
            <button type="button" aria-label={view === "month" ? "Next month" : "Next week"} onClick={() => move(1)} className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-600"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}

        {view === "agenda" && (
          days.length ? (
            <div className="space-y-5">
              {days.map((day) => (
                <section key={day.date} aria-label={dayLabel(day.date)}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(day.date)}{day.date === today ? " · Today" : ""}</h3>
                  <ul className="space-y-2">{day.events.map((event) => <EventRow key={event.id} event={event} now={now} names={names} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} onDelete={removeEvent} />)}</ul>
                </section>
              ))}
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
                        <li key={e.id} className={`rounded-lg px-2 py-1.5 text-xs ${happeningNow(e, now) ? "bg-teal-600 text-white" : "bg-slate-50 text-slate-800"}`}>
                          <div className="font-semibold">{eventTime(e)}</div><div className="break-words">{e.title}</div>
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
                ? <ul className="space-y-2">{onDay(picked || today).map((event) => <EventRow key={event.id} event={event} now={now} names={names} workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} onDelete={removeEvent} />)}</ul>
                : <Empty>{(picked || today) < today ? "That day is over." : "Nothing on this day."}</Empty>}
            </section>
          </div>
        )}

        {view === "open" && (
          <div className="space-y-3" data-testid="open-view">
            <MyAvailability token={token} setNotice={setNotice} onChange={setWeekly} />
            {weekly.length === 0 ? <p className="text-sm text-slate-600">Add the times you are usually free each week above. Your open time then shows up here, with everything on your calendar taken out.</p> : (
              (() => {
                const list = Array.from({ length: 14 }, (_, i) => shiftDay(today, i)).map((date) => ({ date, ranges: openRanges(weekly, workspace.events, date, now) })).filter((d) => d.ranges.length);
                return list.length ? (
                  <ul className="space-y-2">
                    {list.map((d) => (
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
                ) : <Empty>No open time in the next two weeks.</Empty>;
              })()
            )}
            {weekly.length > 0 && <p className="text-xs text-slate-500">Tap an open time to put an event there.</p>}
          </div>
        )}

        {view !== "open" && earlier > 0 && (
          <div className="mt-4 text-center"><button type="button" onClick={() => setShowPast((v) => !v)} className="min-h-11 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">{showPast ? "Hide events that are over" : `Show ${earlier} that ${earlier === 1 ? "is" : "are"} over`}</button></div>
        )}
        {adding && <AddEventModal date={adding.date} start={adding.start} end={adding.end} onClose={() => setAdding(null)} onAdd={addEvent} />}
      </Card>

      <Card title="Connected calendars" right={<span className="shrink-0 text-xs font-medium text-slate-500">{workspace.calendars.length} of {HUB_IMPORT_LIMITS.calendars}</span>}>
        {workspace.calendars.length > 0 && (
          <ul className="mb-4 space-y-2">
            {workspace.calendars.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 p-3">
                <Calendar className="h-5 w-5 shrink-0 text-teal-600" />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-slate-900">{c.name}</div>
                  <div className="text-xs text-slate-500">{workspace.events.filter((e) => e.calendarId === c.id).length} events · refreshed {new Date(c.syncedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</div>
                </div>
                <button type="button" onClick={() => void refresh(c)} disabled={!!busy} aria-label={`Refresh ${c.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-40">
                  {busy === c.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </button>
                <button type="button" onClick={() => setWorkspace((prev) => removeCalendar(prev, c.id))} disabled={!!busy} aria-label={`Disconnect ${c.name}`} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
        <form onSubmit={connect} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Field type="url" inputMode="url" placeholder="Paste your calendar's link (it ends in .ics)" value={link} onChange={(e) => setLink(e.target.value)} disabled={full} aria-label="Calendar link" data-testid="hub-calendar-link" />
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
      </Card>
    </>
  );
}
