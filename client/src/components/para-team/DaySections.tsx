// Para Team: Today, Messages, Calendar, To-do and Schedule.
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ChevronLeft, ChevronRight, MapPin, Pin, Plus, Send, Users } from "lucide-react";
import { HubModal } from "@/components/teacher-hub/HubModal";
import { Field, Labeled } from "@/components/teacher-hub/ui";
import {
  EVENT_LABEL, EVENT_TYPES, WEEKDAYS, WEEKDAY_SHORT, addDaysKey, canCheckOff, clock, eventsOn, ofKind, scheduleOn, sortTasks, weekdayOf,
  type EventData, type ParaItem, type ScheduleData, type TaskData,
} from "@shared/paraTeam";
import { Area, CARD, Choice, CHIP, DeleteButton, EmptyNote, PRIMARY, SECOND, SMALL, SectionHead, Who, dayWords, nowTime, usePara, when } from "./kit";

const EVENT_TONE: Record<EventData["type"], string> = {
  event: "bg-sky-100 text-sky-800", meeting: "bg-violet-100 text-violet-800", absence: "bg-amber-100 text-amber-900", duty: "bg-emerald-100 text-emerald-800",
};

function eventTitle(e: EventData, nameOf: (id: number) => string): string {
  if (e.type === "absence") return e.title || `${e.who ? nameOf(e.who) : "Someone"} out`;
  return e.title;
}
function eventTime(e: EventData): string {
  if (!e.start) return e.end ? `Through ${dayWords(e.end)}` : "All day";
  return e.finish ? `${clock(e.start)} – ${clock(e.finish)}` : clock(e.start);
}

// ─── Today ───

export function TodaySection() {
  const p = usePara();
  const { team, today, me, lead, nameOf } = p;
  const [everyone, setEveryone] = useState(lead);
  const blocks = scheduleOn(team.items, today, everyone ? undefined : me);
  const events = eventsOn(team.items, today);
  const pinned = ofKind(team.items, "message").filter((m) => m.data.pinned);
  const notes = ofKind(team.items, "note").filter((n) => n.data.pinned);
  const myTasks = sortTasks(ofKind(team.items, "task").filter((t) => !t.data.done && canCheckOff(me, t.data) && (!t.data.due || t.data.due <= addDaysKey(today, 2))));
  const latest = ofKind(team.items, "message").sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3);
  const now = nowTime();
  const weekend = [0, 6].includes(weekdayOf(today));
  const nowId = blocks.find((b) => b.data.start <= now && (!b.data.end || now < b.data.end))?.id;
  const nextId = nowId ? null : blocks.find((b) => b.data.start > now)?.id;

  return <>
    <SectionHead title={dayWords(today, true)} line={`${team.name}. Here's the day for ${everyone ? "the whole team" : "you"}.`} />

    {(pinned.length > 0 || notes.length > 0) && (
      <section className="mb-4 space-y-2" aria-label="Pinned">
        {pinned.map((m) => (
          <div key={m.id} className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Pin className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            <div className="min-w-0"><p className="whitespace-pre-wrap break-words text-sm font-semibold text-amber-950">{m.data.text}</p><Who id={m.createdBy} at={m.createdAt} /></div>
          </div>
        ))}
        {notes.map((n) => (
          <button key={n.id} type="button" onClick={() => p.go("docs", n.id)} className="flex w-full gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-4 py-3 text-left hover:bg-teal-100/70">
            <Pin className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <span className="min-w-0"><span className="block text-sm font-bold text-teal-950">{n.data.title}</span><span className="line-clamp-2 text-sm text-teal-900/80">{n.data.body}</span></span>
          </button>
        ))}
      </section>
    )}

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <section className={CARD} aria-labelledby="today-schedule">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="today-schedule" className="text-lg font-extrabold text-slate-950">Schedule</h2>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold" role="group" aria-label="Whose schedule">
            <button type="button" aria-pressed={!everyone} onClick={() => setEveryone(false)} className={`min-h-9 rounded-lg px-3 ${!everyone ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>Mine</button>
            <button type="button" aria-pressed={everyone} onClick={() => setEveryone(true)} className={`min-h-9 rounded-lg px-3 ${everyone ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>Everyone</button>
          </div>
        </div>
        {weekend ? <EmptyNote>No school schedule on weekends.</EmptyNote>
          : blocks.length === 0 ? <EmptyNote>{lead ? "No schedule yet. Add the day's blocks in Schedule so everyone knows where to be." : "Nothing on your schedule today. Your teacher adds it in Schedule."}</EmptyNote>
          : (
            <ol className="relative ml-2 border-l-2 border-slate-200">
              {blocks.map((b) => {
                const isNow = b.id === nowId, isNext = b.id === nextId;
                return (
                  <li key={b.id} className="relative pb-4 pl-5 last:pb-0">
                    <span className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 ${isNow ? "border-teal-600 bg-teal-500" : isNext ? "border-amber-500 bg-white" : "border-slate-300 bg-white"}`} aria-hidden />
                    <div className={`rounded-xl px-3 py-2 ${isNow ? "bg-teal-50 ring-1 ring-teal-200" : ""}`}>
                      <p className="text-xs font-bold text-slate-500">
                        {clock(b.data.start)}{b.data.end ? ` – ${clock(b.data.end)}` : ""}
                        {isNow && <span className={`${CHIP} ml-2 bg-teal-600 text-white`}>Now</span>}
                        {isNext && <span className={`${CHIP} ml-2 bg-amber-100 text-amber-900`}>Next</span>}
                      </p>
                      <p className="text-[15px] font-bold text-slate-950">{b.data.activity}</p>
                      <p className="text-sm text-slate-600">
                        {[b.data.staffId ? nameOf(b.data.staffId) : "Everyone", b.data.place, b.data.students].filter(Boolean).join(" · ")}
                      </p>
                      {b.data.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{b.data.notes}</p>}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
      </section>

      <div className="flex min-w-0 flex-col gap-4">
        <section className={CARD} aria-labelledby="today-events">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="today-events" className="text-lg font-extrabold text-slate-950">Today</h2>
            <button type="button" className={SMALL} onClick={() => p.go("calendar")}>Calendar</button>
          </div>
          {events.length === 0 ? <p className="text-sm text-slate-500">Nothing on the calendar today.</p> : (
            <ul className="space-y-2">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-2">
                  <span className={`${CHIP} mt-0.5 shrink-0 ${EVENT_TONE[e.data.type]}`}>{EVENT_LABEL[e.data.type]}</span>
                  <span className="min-w-0 text-sm"><span className="font-bold text-slate-900">{eventTitle(e.data, nameOf)}</span> <span className="text-slate-500">{eventTime(e.data)}</span></span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={CARD} aria-labelledby="today-tasks">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="today-tasks" className="text-lg font-extrabold text-slate-950">Your to-dos</h2>
            <button type="button" className={SMALL} onClick={() => p.go("tasks")}>All to-dos</button>
          </div>
          {myTasks.length === 0 ? <p className="text-sm text-slate-500">You're all caught up.</p> : <ul className="space-y-1">{myTasks.slice(0, 6).map((t) => <TaskRow key={t.id} task={t} compact />)}</ul>}
        </section>

        <section className={CARD} aria-labelledby="today-messages">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="today-messages" className="text-lg font-extrabold text-slate-950">Latest messages</h2>
            <button type="button" className={SMALL} onClick={() => p.go("messages")}>Open messages</button>
          </div>
          {latest.length === 0 ? <p className="text-sm text-slate-500">No messages yet. Say hi to your team.</p> : (
            <ul className="space-y-2.5">{latest.map((m) => <li key={m.id}><p className="line-clamp-2 break-words text-sm text-slate-800">{m.data.text}</p><Who id={m.createdBy} at={m.createdAt} /></li>)}</ul>
          )}
        </section>

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={SECOND} onClick={() => p.go("data", "new")}>Add data</button>
          <button type="button" className={SECOND} onClick={() => p.go("calendar", "absence")}>I'll be out</button>
        </div>
      </div>
    </div>
  </>;
}

// ─── Messages ───

export function MessagesSection() {
  const p = usePara();
  const { team, me, lead, api, act } = p;
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const messages = useMemo(() => ofKind(team.items, "message").sort((a, b) => a.createdAt.localeCompare(b.createdAt)), [team.items]);
  const pinned = messages.filter((m) => m.data.pinned);
  const count = messages.length;
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [count]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    if (await act(() => api.add("message", { text }))) setText("");
    setSending(false);
  };

  let lastDay = "";
  return <>
    <SectionHead title="Messages" line="Everyone on the team sees these. For anything private about a student, talk in person." />
    {pinned.length > 0 && (
      <div className="mb-3 space-y-2">
        {pinned.map((m) => (
          <div key={m.id} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"><Pin className="mt-0.5 h-4 w-4 shrink-0" /><span className="whitespace-pre-wrap break-words">{m.data.text}</span></div>
        ))}
      </div>
    )}
    <section className={`${CARD} flex flex-col p-0 sm:p-0`}>
      <div className="max-h-[60vh] min-h-[240px] overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && <EmptyNote>No messages yet. Write the first one below.</EmptyNote>}
        {messages.map((m) => {
          const mine = m.createdBy === me;
          const day = new Date(m.createdAt).toDateString();
          const showDay = day !== lastDay;
          lastDay = day;
          return (
            <div key={m.id}>
              {showDay && <p className="my-3 text-center text-xs font-bold text-slate-400">{new Date(m.createdAt).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" })}</p>}
              <div className={`mb-2 flex ${mine ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${mine ? "rounded-br-md bg-teal-700 text-white" : "rounded-bl-md bg-slate-100 text-slate-900"}`}>
                  {!mine && <p className="text-xs font-bold text-slate-600">{p.nameOf(m.createdBy)}</p>}
                  {editing === m.id ? (
                    <form onSubmit={async (e) => { e.preventDefault(); if (await act(() => api.update(m.id, { text: draft }))) setEditing(null); }} className="flex flex-col gap-2 py-1">
                      <Area h="min-h-16" value={draft} onChange={(e) => setDraft(e.target.value)} className="text-slate-900" maxLength={2000} />
                      <span className="flex gap-2"><button type="submit" className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-teal-800">Save</button><button type="button" onClick={() => setEditing(null)} className="rounded-lg px-3 py-1.5 text-xs font-bold">Cancel</button></span>
                    </form>
                  ) : <p className="whitespace-pre-wrap break-words text-[15px] leading-snug">{m.data.text}</p>}
                  <p className={`mt-1 flex flex-wrap items-center gap-x-2 text-[11px] ${mine ? "text-teal-100" : "text-slate-500"}`}>
                    {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    {m.data.pinned && <span className="font-bold">Pinned</span>}
                    {lead && <button type="button" className="font-bold underline-offset-2 hover:underline" onClick={() => act(() => api.update(m.id, { pinned: !m.data.pinned }), m.data.pinned ? "Unpinned." : "Pinned to the top of Today.")}>{m.data.pinned ? "Unpin" : "Pin"}</button>}
                    {mine && editing !== m.id && <button type="button" className="font-bold underline-offset-2 hover:underline" onClick={() => { setEditing(m.id); setDraft(m.data.text); }}>Edit</button>}
                    {p.mayEdit(m) && <MiniDelete onDelete={() => act(() => api.remove(m.id))} light={mine} />}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2 border-t border-slate-200 p-3">
        <label htmlFor="para-message" className="sr-only">Message</label>
        <Area h="min-h-11" id="para-message" value={text} onChange={(e) => setText(e.target.value)} placeholder="Write to the team…" maxLength={2000} className="flex-1 resize-none"
          rows={2} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
        <button type="submit" className={PRIMARY} disabled={!text.trim() || sending} aria-label="Send"><Send className="h-4 w-4" /><span className="hidden sm:inline">Send</span></button>
      </form>
    </section>
    <p className="mt-2 text-xs text-slate-500">Enter sends. Shift + Enter starts a new line. New messages show up on their own.</p>
  </>;
}

function MiniDelete({ onDelete, light }: { onDelete: () => void; light?: boolean }) {
  const [sure, setSure] = useState(false);
  return sure
    ? <span className="inline-flex gap-2 font-bold"><button type="button" onClick={() => { setSure(false); onDelete(); }} className={light ? "text-white underline" : "text-rose-700 underline"}>Delete it</button><button type="button" onClick={() => setSure(false)}>Keep</button></span>
    : <button type="button" className="font-bold underline-offset-2 hover:underline" onClick={() => setSure(true)}>Delete</button>;
}

// ─── Calendar ───

const blankEvent = (date: string): EventData => ({ title: "", date, end: "", start: "", finish: "", type: "event", who: 0, note: "" });

export function CalendarSection({ focus }: { focus?: string }) {
  const p = usePara();
  const { team, today, me, nameOf } = p;
  const [month, setMonth] = useState(today.slice(0, 7));
  const [picked, setPicked] = useState(today);
  const [form, setForm] = useState<{ id?: string; data: EventData } | null>(() => (focus === "absence" ? { data: { ...blankEvent(today), type: "absence", who: me } } : null));

  const events = ofKind(team.items, "event");
  const first = `${month}-01`;
  const startPad = weekdayOf(first);
  const daysIn = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const cells = [...Array(startPad).fill(null), ...Array.from({ length: daysIn }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`)];
  const shift = (n: number) => { const d = new Date(`${month}-15T12:00:00`); d.setMonth(d.getMonth() + n); setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`); };
  const dayEvents = eventsOn(team.items, picked);
  const coming = events.filter((e) => (e.data.end || e.data.date) >= today && e.data.date <= addDaysKey(today, 21)).sort((a, b) => a.data.date.localeCompare(b.data.date) || (a.data.start || "").localeCompare(b.data.start || ""));

  return <>
    <SectionHead title="Calendar" line="Meetings, duties, field trips and who's out, for the whole team."
      right={<>
        <button type="button" className={SECOND} onClick={() => setForm({ data: { ...blankEvent(picked), type: "absence", who: me } })}>I'll be out</button>
        <button type="button" className={PRIMARY} onClick={() => setForm({ data: blankEvent(picked) })}><Plus className="h-4 w-4" />Add to calendar</button>
      </>} />
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className={CARD} aria-label="Month">
        <div className="mb-3 flex items-center justify-between">
          <button type="button" className={SMALL} onClick={() => shift(-1)} aria-label="Last month"><ChevronLeft className="h-4 w-4" /></button>
          <h2 className="text-base font-extrabold text-slate-950">{new Date(`${month}-15T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" })}</h2>
          <button type="button" className={SMALL} onClick={() => shift(1)} aria-label="Next month"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold text-slate-500">{WEEKDAY_SHORT.map((d) => <span key={d}>{d}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((key, i) => {
            if (!key) return <span key={`pad-${i}`} />;
            const on = eventsOn(team.items, key);
            const isToday = key === today, isPicked = key === picked;
            return (
              <button key={key} type="button" onClick={() => setPicked(key)} aria-pressed={isPicked} aria-label={`${dayWords(key)}${on.length ? `, ${on.length} on the calendar` : ""}`}
                className={`flex min-h-12 flex-col items-center rounded-lg px-0.5 py-1 text-sm sm:min-h-16 ${isPicked ? "bg-teal-700 text-white" : isToday ? "bg-teal-50 font-black text-teal-800" : "text-slate-800 hover:bg-slate-100"}`}>
                <span className="font-semibold">{Number(key.slice(8))}</span>
                <span className="mt-0.5 flex flex-wrap justify-center gap-0.5">
                  {on.slice(0, 3).map((e) => <span key={e.id} className={`h-1.5 w-1.5 rounded-full ${isPicked ? "bg-white" : e.data.type === "absence" ? "bg-amber-500" : e.data.type === "meeting" ? "bg-violet-500" : e.data.type === "duty" ? "bg-emerald-500" : "bg-sky-500"}`} />)}
                </span>
                <span className="hidden w-full truncate text-[10px] leading-tight sm:block">{on[0] ? eventTitle(on[0].data, nameOf) : ""}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-600">
          {EVENT_TYPES.map((t) => <span key={t} className="inline-flex items-center gap-1"><span className={`h-2 w-2 rounded-full ${t === "absence" ? "bg-amber-500" : t === "meeting" ? "bg-violet-500" : t === "duty" ? "bg-emerald-500" : "bg-sky-500"}`} />{EVENT_LABEL[t]}</span>)}
        </div>
      </section>
      <div className="flex min-w-0 flex-col gap-4">
        <section className={CARD} aria-labelledby="cal-day">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 id="cal-day" className="text-lg font-extrabold text-slate-950">{dayWords(picked, true)}</h2>
            <button type="button" className={SMALL} onClick={() => setForm({ data: blankEvent(picked) })}><Plus className="h-3.5 w-3.5" />Add</button>
          </div>
          {dayEvents.length === 0 ? <p className="text-sm text-slate-500">Nothing this day.</p> : <ul className="space-y-3">{dayEvents.map((e) => <EventRow key={e.id} e={e} onEdit={() => setForm({ id: e.id, data: e.data })} />)}</ul>}
        </section>
        <section className={CARD} aria-labelledby="cal-coming">
          <h2 id="cal-coming" className="mb-2 text-lg font-extrabold text-slate-950">Next three weeks</h2>
          {coming.length === 0 ? <p className="text-sm text-slate-500">Nothing coming up.</p> : (
            <ul className="space-y-2">{coming.map((e) => (
              <li key={e.id}><button type="button" onClick={() => { setPicked(e.data.date < today ? today : e.data.date); setMonth((e.data.date < today ? today : e.data.date).slice(0, 7)); }} className="flex w-full items-start gap-2 rounded-lg px-1 py-1 text-left hover:bg-slate-50">
                <span className="w-24 shrink-0 text-xs font-bold text-slate-500">{dayWords(e.data.date)}</span>
                <span className="min-w-0 text-sm"><span className="font-semibold text-slate-900">{eventTitle(e.data, nameOf)}</span> <span className="text-slate-500">{eventTime(e.data)}</span></span>
              </button></li>
            ))}</ul>
          )}
        </section>
      </div>
    </div>
    {form && <EventForm initial={form.data} id={form.id} onClose={() => setForm(null)} />}
  </>;
}

function EventRow({ e, onEdit }: { e: ParaItem<"event">; onEdit: () => void }) {
  const p = usePara();
  return (
    <li className="rounded-xl border border-slate-200 px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${CHIP} ${EVENT_TONE[e.data.type]}`}>{EVENT_LABEL[e.data.type]}</span>
        <span className="text-xs font-semibold text-slate-500">{eventTime(e.data)}{e.data.end ? ` · ${dayWords(e.data.date)} – ${dayWords(e.data.end)}` : ""}</span>
      </div>
      <p className="mt-1 font-bold text-slate-950">{eventTitle(e.data, p.nameOf)}</p>
      {e.data.who > 0 && e.data.type !== "absence" && <p className="text-sm text-slate-600"><Users className="mr-1 inline h-3.5 w-3.5" />{p.nameOf(e.data.who)}</p>}
      {e.data.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{e.data.note}</p>}
      <div className="mt-1 flex flex-wrap items-center gap-1"><Who id={e.createdBy} />{p.mayEdit(e) && <><button type="button" className={SMALL} onClick={onEdit}>Edit</button><DeleteButton onDelete={() => p.act(() => p.api.remove(e.id), "Deleted.")} /></>}</div>
    </li>
  );
}

function EventForm({ initial, id, onClose }: { initial: EventData; id?: string; onClose: () => void }) {
  const p = usePara();
  const [d, setD] = useState<EventData>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof EventData>(k: K, v: EventData[K]) => setD((x) => ({ ...x, [k]: v }));
  const absence = d.type === "absence";
  const save = async () => {
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, d) : p.api.add("event", d)), id ? "Saved." : absence ? "Added. The team will see you're out." : "Added to the calendar.");
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <HubModal title={id ? "Edit" : absence ? "Mark time out" : "Add to the calendar"} onClose={onClose}
      footer={<div className="flex justify-end gap-2"><button type="button" className={SECOND} onClick={onClose}>Cancel</button><button type="button" className={PRIMARY} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="Kind"><Choice value={d.type} onChange={(e) => set("type", e.target.value as EventData["type"])}>{EVENT_TYPES.map((t) => <option key={t} value={t}>{EVENT_LABEL[t]}</option>)}</Choice></Labeled>
        <Labeled label={absence ? "Who's out" : "Who it's for"}>
          <Choice value={d.who} onChange={(e) => set("who", Number(e.target.value))}>
            {!absence && <option value={0}>Everyone</option>}
            {p.team.members.filter((m) => !m.left).map((m) => <option key={m.userId} value={m.userId}>{m.name}{m.userId === p.me ? " (me)" : ""}</option>)}
          </Choice>
        </Labeled>
        <Labeled label={absence ? "Reason (optional)" : "What"} className="sm:col-span-2"><Field data-autofocus value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={120} placeholder={absence ? "Sick day, training, appointment…" : "IEP meeting for J., fire drill, field trip…"} /></Labeled>
        <Labeled label="Date"><Field type="date" value={d.date} onChange={(e) => set("date", e.target.value)} /></Labeled>
        <Labeled label="Through (for more than one day)"><Field type="date" value={d.end} min={d.date} onChange={(e) => set("end", e.target.value)} /></Labeled>
        <Labeled label="Starts (leave empty for all day)"><Field type="time" value={d.start} onChange={(e) => set("start", e.target.value)} /></Labeled>
        <Labeled label="Ends"><Field type="time" value={d.finish} disabled={!d.start} onChange={(e) => set("finish", e.target.value)} /></Labeled>
        <Labeled label={absence ? "Coverage notes" : "Notes"} className="sm:col-span-2"><Area h="min-h-24" value={d.note} onChange={(e) => set("note", e.target.value)} maxLength={1500} placeholder={absence ? "What needs covering, and who can cover it." : "Room, what to bring, anything people should know."} /></Labeled>
      </div>
    </HubModal>
  );
}

// ─── To-do ───

const blankTask = (): TaskData => ({ title: "", note: "", due: "", assignee: 0, done: false, doneBy: 0, doneAt: "" });

export function TasksSection() {
  const p = usePara();
  const { team, me } = p;
  const [view, setView] = useState<"mine" | "all" | "done">("mine");
  const [form, setForm] = useState<{ id?: string; data: TaskData } | null>(null);
  const [quick, setQuick] = useState("");
  const all = sortTasks(ofKind(team.items, "task"));
  const shown = all.filter((t) => (view === "done" ? t.data.done : !t.data.done && (view === "all" || canCheckOff(me, t.data))));

  const addQuick = async (e: FormEvent) => {
    e.preventDefault();
    if (!quick.trim()) return;
    if (await p.act(() => p.api.add("task", { ...blankTask(), title: quick, assignee: view === "mine" ? me : 0 }))) setQuick("");
  };

  return <>
    <SectionHead title="To-do" line="Shared jobs: copies to make, materials to prep, calls to return. Give one to a person or to everyone." />
    <form onSubmit={addQuick} className="mb-3 flex gap-2">
      <label htmlFor="quick-task" className="sr-only">New to-do</label>
      <Field id="quick-task" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder={view === "mine" ? "Add a to-do for yourself…" : "Add a to-do for everyone…"} maxLength={200} />
      <button type="submit" className={PRIMARY} disabled={!quick.trim()}><Plus className="h-4 w-4" />Add</button>
      <button type="button" className={SECOND} onClick={() => setForm({ data: blankTask() })}>More</button>
    </form>
    <div className="mb-3 inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold" role="group" aria-label="Which to-dos">
      {(["mine", "all", "done"] as const).map((v) => (
        <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)} className={`min-h-9 rounded-lg px-3 ${view === v ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>
          {v === "mine" ? "Mine" : v === "all" ? "Everyone's" : "Done"}
        </button>
      ))}
    </div>
    <section className={CARD}>
      {shown.length === 0 ? <EmptyNote>{view === "done" ? "Nothing finished yet." : "Nothing to do here."}</EmptyNote> : (
        <ul className="divide-y divide-slate-100">{shown.map((t) => <TaskRow key={t.id} task={t} onEdit={() => setForm({ id: t.id, data: t.data })} />)}</ul>
      )}
    </section>
    {form && <TaskForm initial={form.data} id={form.id} onClose={() => setForm(null)} />}
  </>;
}

function TaskRow({ task, compact, onEdit }: { task: ParaItem<"task">; compact?: boolean; onEdit?: () => void }) {
  const p = usePara();
  const t = task.data;
  const may = canCheckOff(p.me, t) || p.mayEdit(task);
  const late = !t.done && t.due && t.due < p.today;
  // Ticks at once; goes back if the save fails.
  const [ticking, setTicking] = useState<boolean | null>(null);
  const checked = ticking ?? t.done;
  const tick = async (done: boolean) => {
    setTicking(done);
    await p.act(() => p.api.update(task.id, { done }), done ? "Done." : undefined);
    setTicking(null);
  };
  return (
    <li className={`flex items-start gap-3 ${compact ? "py-1" : "py-2.5"}`}>
      <input type="checkbox" checked={checked} disabled={!may || ticking !== null} aria-label={`${checked ? "Not done" : "Done"}: ${t.title}`}
        onChange={(e) => void tick(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-teal-700" />
      <div className="min-w-0 flex-1">
        <p className={`break-words text-[15px] font-semibold ${t.done ? "text-slate-400 line-through" : "text-slate-900"}`}>{t.title}</p>
        <p className="text-xs text-slate-500">
          {t.assignee ? `For ${p.nameOf(t.assignee)}` : "For everyone"}
          {t.due && <span className={late ? "font-bold text-rose-700" : ""}> · {late ? "Was due" : "Due"} {dayWords(t.due)}</span>}
          {t.done && t.doneBy ? ` · Done by ${p.nameOf(t.doneBy)}${t.doneAt ? ` ${when(t.doneAt)}` : ""}` : ""}
        </p>
        {!compact && t.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{t.note}</p>}
      </div>
      {!compact && p.mayEdit(task) && <span className="flex shrink-0 items-center">{onEdit && <button type="button" className={SMALL} onClick={onEdit}>Edit</button>}<DeleteButton onDelete={() => p.act(() => p.api.remove(task.id))} /></span>}
    </li>
  );
}

function TaskForm({ initial, id, onClose }: { initial: TaskData; id?: string; onClose: () => void }) {
  const p = usePara();
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, d) : p.api.add("task", d)), id ? "Saved." : "Added.");
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <HubModal title={id ? "Edit to-do" : "New to-do"} onClose={onClose}
      footer={<div className="flex justify-end gap-2"><button type="button" className={SECOND} onClick={onClose}>Cancel</button><button type="button" className={PRIMARY} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="What needs doing" className="sm:col-span-2"><Field data-autofocus value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} maxLength={200} /></Labeled>
        <Labeled label="For"><Choice value={d.assignee} onChange={(e) => setD({ ...d, assignee: Number(e.target.value) })}><option value={0}>Everyone</option>{p.team.members.filter((m) => !m.left).map((m) => <option key={m.userId} value={m.userId}>{m.name}{m.userId === p.me ? " (me)" : ""}</option>)}</Choice></Labeled>
        <Labeled label="Due (optional)"><Field type="date" value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} /></Labeled>
        <Labeled label="Notes" className="sm:col-span-2"><Area h="min-h-24" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} maxLength={1500} /></Labeled>
      </div>
    </HubModal>
  );
}

// ─── Schedule ───

const blankBlock = (day: number): ScheduleData => ({ days: [day], start: "08:00", end: "", activity: "", place: "", staffId: 0, students: "", notes: "" });

export function ScheduleSection() {
  const p = usePara();
  const { team, today, lead, me, nameOf } = p;
  const todayWd = weekdayOf(today);
  const [day, setDay] = useState(todayWd >= 1 && todayWd <= 5 ? todayWd : 1);
  const [who, setWho] = useState<number | "all">(lead ? "all" : me);
  const [form, setForm] = useState<{ id?: string; data: ScheduleData } | null>(null);
  const blocks = ofKind(team.items, "schedule")
    .filter((b) => b.data.days.includes(day) && (who === "all" || b.data.staffId === 0 || b.data.staffId === who))
    .sort((a, b) => a.data.start.localeCompare(b.data.start));

  return <>
    <SectionHead title="Schedule" line={lead ? "Who is where, and with whom, each day. Blocks can repeat on several days." : "Where you need to be each day. Your teacher keeps this up to date."}
      right={<>
        <button type="button" className={SECOND} onClick={() => window.print()}>Print</button>
        {lead && <button type="button" className={PRIMARY} onClick={() => setForm({ data: blankBlock(day) })}><Plus className="h-4 w-4" />Add a block</button>}
      </>} />
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold" role="group" aria-label="Day">
        {WEEKDAYS.map((d) => <button key={d} type="button" aria-pressed={day === d} onClick={() => setDay(d)} className={`min-h-9 rounded-lg px-3 ${day === d ? "bg-white text-slate-950 shadow-sm" : "text-slate-600"}`}>{WEEKDAY_SHORT[d]}</button>)}
      </div>
      <label className="sr-only" htmlFor="sched-who">Whose schedule</label>
      <Choice id="sched-who" w="w-full sm:w-56" value={String(who)} onChange={(e) => setWho(e.target.value === "all" ? "all" : Number(e.target.value))}>
        <option value="all">Everyone</option>
        {team.members.filter((m) => !m.left).map((m) => <option key={m.userId} value={m.userId}>{m.name}{m.userId === me ? " (me)" : ""}</option>)}
      </Choice>
    </div>
    <section className={CARD}>
      {blocks.length === 0 ? <EmptyNote>{lead ? "No blocks on this day yet. Add arrival, classes, lunch, breaks and dismissal." : "Nothing on this day yet."}</EmptyNote> : (
        <ul className="divide-y divide-slate-100">
          {blocks.map((b) => (
            <li key={b.id} className="flex flex-wrap items-start gap-3 py-3">
              <span className="w-28 shrink-0 text-sm font-black tabular-nums text-teal-800">{clock(b.data.start)}{b.data.end && <span className="block text-xs font-semibold text-slate-500">to {clock(b.data.end)}</span>}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-slate-950">{b.data.activity}</p>
                <p className="text-sm text-slate-600">
                  <span className={b.data.staffId === me ? "font-bold text-teal-800" : ""}>{b.data.staffId ? nameOf(b.data.staffId) : "Everyone"}</span>
                  {b.data.place && <span> · <MapPin className="inline h-3.5 w-3.5" /> {b.data.place}</span>}
                  {b.data.students && <span> · {b.data.students}</span>}
                </p>
                {b.data.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{b.data.notes}</p>}
                <p className="mt-1 text-xs text-slate-500">{b.data.days.length === 5 ? "Every weekday" : b.data.days.map((d) => WEEKDAY_SHORT[d]).join(", ")}</p>
              </div>
              {lead && <span className="flex shrink-0 items-center"><button type="button" className={SMALL} onClick={() => setForm({ id: b.id, data: b.data })}>Edit</button><DeleteButton onDelete={() => p.act(() => p.api.remove(b.id))} /></span>}
            </li>
          ))}
        </ul>
      )}
    </section>
    {form && <BlockForm initial={form.data} id={form.id} onClose={() => setForm(null)} />}
  </>;
}

function BlockForm({ initial, id, onClose }: { initial: ScheduleData; id?: string; onClose: () => void }) {
  const p = usePara();
  const [d, setD] = useState(initial);
  const [saving, setSaving] = useState(false);
  const toggleDay = (n: number) => setD((x) => ({ ...x, days: x.days.includes(n) ? x.days.filter((y) => y !== n) : [...x.days, n].sort() }));
  const save = async () => {
    if (!d.days.length) { p.say("Pick at least one day."); return; }
    setSaving(true);
    const ok = await p.act(() => (id ? p.api.update(id, d) : p.api.add("schedule", d)), id ? "Saved." : "Added to the schedule.");
    setSaving(false);
    if (ok) onClose();
  };
  return (
    <HubModal title={id ? "Edit block" : "Add a block"} onClose={onClose}
      footer={<div className="flex justify-end gap-2"><button type="button" className={SECOND} onClick={onClose}>Cancel</button><button type="button" className={PRIMARY} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save"}</button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Labeled label="What happens" className="sm:col-span-2"><Field data-autofocus value={d.activity} onChange={(e) => setD({ ...d, activity: e.target.value })} maxLength={120} placeholder="Math small group, lunch duty, bus duty, break…" /></Labeled>
        <Labeled label="Starts"><Field type="time" value={d.start} onChange={(e) => setD({ ...d, start: e.target.value })} /></Labeled>
        <Labeled label="Ends"><Field type="time" value={d.end} onChange={(e) => setD({ ...d, end: e.target.value })} /></Labeled>
        <Labeled label="Who"><Choice value={d.staffId} onChange={(e) => setD({ ...d, staffId: Number(e.target.value) })}><option value={0}>Everyone</option>{p.team.members.filter((m) => !m.left).map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</Choice></Labeled>
        <Labeled label="Where"><Field value={d.place} onChange={(e) => setD({ ...d, place: e.target.value })} maxLength={80} placeholder="Room 112, gym, cafeteria…" /></Labeled>
        <Labeled label="With which students (first names or initials)" className="sm:col-span-2"><Field value={d.students} onChange={(e) => setD({ ...d, students: e.target.value })} maxLength={200} /></Labeled>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1 text-sm font-medium text-slate-700">Days</legend>
          <div className="flex flex-wrap gap-2">{WEEKDAYS.map((n) => (
            <label key={n} className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${d.days.includes(n) ? "border-teal-600 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-700"}`}>
              <input type="checkbox" className="accent-teal-700" checked={d.days.includes(n)} onChange={() => toggleDay(n)} />{WEEKDAY_SHORT[n]}
            </label>
          ))}</div>
        </fieldset>
        <Labeled label="Notes" className="sm:col-span-2"><Area h="min-h-24" value={d.notes} onChange={(e) => setD({ ...d, notes: e.target.value })} maxLength={1000} placeholder="What to bring, what to watch for, who to hand off to." /></Labeled>
      </div>
    </HubModal>
  );
}

