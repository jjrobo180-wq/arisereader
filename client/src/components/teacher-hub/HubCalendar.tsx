// Teacher Hub: the Calendar tab. Events the teacher types in, events added with
// AI or from a calendar file, and calendars connected by their link (Google,
// Outlook, Apple or any other calendar that can be shared as a link).
import { useEffect, useMemo, useRef, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { AlertTriangle, Calendar, Link2, Loader2, MapPin, Plus, RefreshCw, Trash2, Upload } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import {
  HUB_IMPORT_LIMITS, cleanHubImport, clock12, describeHubAdded, mergeHubImport, removeCalendar, replaceCalendarEvents,
  type HubCalendar as ConnectedCalendar, type HubEvent, type Workspace,
} from "@shared/teacherHub";
import { Card, Empty, Field, GhostButton, PrimaryButton } from "./ui";
import { localDay, localZone } from "./HubImport";

type SetWorkspace = Dispatch<SetStateAction<Workspace>>;

/** "Tuesday, Oct 6" from "2026-10-06". */
export function dayLabel(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  return Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export const eventTime = (event: Pick<HubEvent, "start" | "end">) =>
  event.start ? (event.end ? `${clock12(event.start)} – ${clock12(event.end)}` : clock12(event.start)) : "All day";

export const byWhen = (a: HubEvent, b: HubEvent) => a.date.localeCompare(b.date) || (a.start || "").localeCompare(b.start || "") || a.title.localeCompare(b.title);

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

export default function HubCalendarTab({ workspace, setWorkspace, token, makeId }: { workspace: Workspace; setWorkspace: SetWorkspace; token: string | null; makeId: () => string }) {
  const today = localDay();
  const [form, setForm] = useState({ title: "", date: today, start: "", end: "", location: "" });
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [showPast, setShowPast] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const names = useMemo(() => new Map(workspace.calendars.map((c) => [c.id, c.name])), [workspace.calendars]);
  const shown = useMemo(() => workspace.events.filter((e) => showPast || e.date >= today).sort(byWhen), [workspace.events, showPast, today]);
  const days = useMemo(() => {
    const groups: { date: string; events: HubEvent[] }[] = [];
    for (const event of shown) {
      if (groups[groups.length - 1]?.date === event.date) groups[groups.length - 1].events.push(event);
      else groups.push({ date: event.date, events: [event] });
    }
    return groups;
  }, [shown]);
  const earlier = workspace.events.filter((e) => e.date < today).length;
  const full = workspace.calendars.length >= HUB_IMPORT_LIMITS.calendars;

  function addEvent(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.date) return;
    setWorkspace((p) => ({ ...p, events: [...p.events, { id: makeId(), title: form.title.trim(), date: form.date, start: form.start, end: form.start ? form.end : "", location: form.location.trim(), notes: "" }] }));
    setForm({ title: "", date: form.date, start: "", end: "", location: "" });
  }

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
      <Card title="Calendar">
        <form onSubmit={addEvent} className="grid gap-3 md:grid-cols-6">
          <Field placeholder="Event" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="md:col-span-2" required aria-label="Event" />
          <Field type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required aria-label="Date" />
          <Field type="time" title="Starts" value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} aria-label="Starts" />
          <Field type="time" title="Ends" value={form.end} onChange={(e) => setForm({ ...form, end: e.target.value })} aria-label="Ends" />
          <Field placeholder="Where" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} aria-label="Where" />
          <PrimaryButton type="submit"><Plus className="h-4 w-4" /> Add event</PrimaryButton>
        </form>
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

      <Card title={showPast ? "All events" : "Coming up"} right={earlier > 0 ? <button type="button" onClick={() => setShowPast((v) => !v)} className="min-h-11 shrink-0 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4">{showPast ? "Hide earlier" : `Show ${earlier} earlier`}</button> : undefined}>
        {days.length ? (
          <div className="space-y-5">
            {days.map((day) => (
              <section key={day.date} aria-label={dayLabel(day.date)}>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{dayLabel(day.date)}{day.date === today ? " · Today" : ""}</h3>
                <ul className="space-y-2">
                  {day.events.map((event) => (
                    <li key={event.id} className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3">
                      <div className="w-[4.75rem] shrink-0 pt-0.5 text-xs font-semibold leading-5 text-slate-700 sm:w-36">{eventTime(event)}</div>
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
                      {!event.calendarId && (
                        <button type="button" aria-label={`Delete ${event.title}`} className="-m-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600" onClick={() => setWorkspace((p) => ({ ...p, events: p.events.filter((x) => x.id !== event.id) }))}><Trash2 className="h-4 w-4" /></button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : <Empty>Nothing coming up. Add an event, connect a calendar, or use Add with AI on a screenshot of your calendar.</Empty>}
      </Card>
    </>
  );
}
