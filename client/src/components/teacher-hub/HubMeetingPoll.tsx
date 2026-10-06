// Teacher Hub: asking everyone which times work for an IEP or re-evaluation meeting.
// The teacher offers a few times and picks the people (parents, staff, anyone else).
// Each gets an email with their own link; answers show up here, and the teacher books a time.
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { CalendarCheck, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { INVITEE_ROLES, POLL_LIMITS, type PollAnswer } from "@shared/meetingPoll";
import { roleLabel } from "@shared/hubGuide";
import type { Workspace } from "@shared/teacherHub";
import { Card, Empty, Field, GhostButton, PrimaryButton, TextArea } from "./ui";

type PollView = {
  id: string; title: string; location: string; message: string; hubMeetingId: string; status: "open" | "booked"; chosenOption: string | null; best: string | null;
  options: { id: string; date: string; start: string; end: string; label: string }[];
  invitees: { id: string; name: string; email: string; role: string; answers: Record<string, PollAnswer>; comment: string; respondedAt: string | null; emailSent: boolean }[];
  tally: { id: string; yes: number; maybe: number; no: number; waiting: number; everyone: boolean }[];
};

export type PollStart = { meetingId: string; title: string } | null;
type Setter = Dispatch<SetStateAction<Workspace>>;

async function call(token: string | null, method: string, path: string, body?: unknown) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || "Something went wrong. Try again.");
  return data;
}

const SYMBOL: Record<PollAnswer, { mark: string; word: string; cls: string }> = {
  yes: { mark: "✓", word: "Works", cls: "bg-emerald-100 text-emerald-800" },
  maybe: { mark: "?", word: "Maybe", cls: "bg-amber-100 text-amber-800" },
  no: { mark: "✗", word: "Can't", cls: "bg-rose-100 text-rose-800" },
};

const blankTime = () => ({ date: "", start: "", end: "" });
type Guest = { name: string; email: string; role: string };

export default function HubMeetingPolls({ token, workspace, setWorkspace, makeId, start, onStarted }: {
  token: string | null; workspace: Workspace; setWorkspace: Setter; makeId: () => string; start: PollStart; onStarted: () => void;
}) {
  const [polls, setPolls] = useState<PollView[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [composing, setComposing] = useState<PollStart | { meetingId: ""; title: "" }>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try { setPolls((await call(token, "GET", "/api/teacher-hub/polls")).polls); setLoadError(""); }
    catch (error: any) { setLoadError(error?.message || "Could not load your polls."); setPolls((p) => p ?? []); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (start) { setComposing(start); onStarted(); } }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  function booked(poll: PollView, option: PollView["options"][number], told: number) {
    setWorkspace((prev) => {
      const meetings = poll.hubMeetingId ? prev.meetings.map((m) => (m.id === poll.hubMeetingId ? { ...m, date: option.date } : m)) : prev.meetings;
      const already = prev.events.some((e) => e.title === poll.title && e.date === option.date && e.start === option.start);
      const events = already ? prev.events : [...prev.events, { id: makeId(), title: poll.title, date: option.date, start: option.start, end: option.end, location: poll.location, notes: "Time chosen with a meeting poll" }];
      return { ...prev, meetings, events };
    });
    setNotice(`Booked ${option.label}. It's on your calendar${told ? ` and ${told} ${told === 1 ? "person was" : "people were"} emailed.` : "."}`);
    void load();
  }

  return (
    <Card
      title="Find a time with everyone"
      right={<GhostButton onClick={() => setComposing({ meetingId: "", title: "" })}><Plus className="h-4 w-4" /> Ask for times</GhostButton>}
    >
      <div className="space-y-4" data-testid="meeting-polls">
        {notice && <div role="status" data-testid="poll-notice" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>}
        {composing && (
          <Composer
            token={token} workspace={workspace} initial={composing}
            onClose={() => setComposing(null)}
            onSent={(message) => { setComposing(null); setNotice(message); void load(); }}
          />
        )}
        {polls === null && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {loadError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</div>}
        {polls && !polls.length && !composing && !loadError && <Empty>No polls yet. Tap “Ask for times” to email parents and staff a few possible times.</Empty>}
        {polls?.map((poll) => <PollCard key={poll.id} poll={poll} token={token} onBooked={booked} onChanged={load} setNotice={setNotice} />)}
      </div>
    </Card>
  );
}

function Composer({ token, workspace, initial, onClose, onSent }: {
  token: string | null; workspace: Workspace; initial: { meetingId: string; title: string }; onClose: () => void; onSent: (message: string) => void;
}) {
  const [title, setTitle] = useState(initial.title);
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [times, setTimes] = useState([blankTime(), blankTime()]);
  const team = workspace.spedContacts.filter((c) => c.email);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [guests, setGuests] = useState<Guest[]>([{ name: "", email: "", role: "Parent or guardian" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true); setError("");
    const invitees = [
      ...team.filter((c) => picked[c.id]).map((c) => ({ name: c.name, email: c.email, role: "Staff" })),
      ...guests.filter((g) => g.email.trim() || g.name.trim()),
    ];
    try {
      const data = await call(token, "POST", "/api/teacher-hub/polls", {
        title, location, message, hubMeetingId: initial.meetingId,
        options: times.filter((t) => t.date || t.start), invitees,
      });
      onSent(data.notSent ? `Sent, but ${data.notSent} ${data.notSent === 1 ? "email" : "emails"} did not go through. Open the poll to see who.` : `Sent to ${invitees.length} ${invitees.length === 1 ? "person" : "people"}. Their answers will show up here.`);
    } catch (e: any) { setError(e?.message || "Could not send."); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-teal-200 bg-teal-50/40 p-4" data-testid="poll-composer">
      <div className="grid gap-3 md:grid-cols-2">
        <Field placeholder="Meeting name, like IEP meeting for Jordan" aria-label="Meeting name" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={POLL_LIMITS.title} />
        <Field placeholder="Where (room or video link)" aria-label="Where" value={location} onChange={(e) => setLocation(e.target.value)} maxLength={POLL_LIMITS.location} />
      </div>
      <p className="text-xs text-slate-500">The email and the reply page show this name, so use a first name only.</p>

      <div>
        <div className="mb-2 text-sm font-semibold text-slate-800">Times that could work</div>
        <div className="space-y-2">
          {times.map((t, index) => (
            <div key={index} className="grid grid-cols-[1fr_auto] items-center gap-2 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
              <Field type="date" aria-label={`Date ${index + 1}`} value={t.date} onChange={(e) => setTimes(times.map((x, i) => (i === index ? { ...x, date: e.target.value } : x)))} />
              <button type="button" aria-label={`Remove time ${index + 1}`} disabled={times.length <= 2} onClick={() => setTimes(times.filter((_, i) => i !== index))} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 sm:order-last"><Trash2 className="h-4 w-4" /></button>
              <div className="col-span-2 grid grid-cols-2 gap-2 sm:col-span-2">
                <Field type="time" aria-label={`Start ${index + 1}`} value={t.start} onChange={(e) => setTimes(times.map((x, i) => (i === index ? { ...x, start: e.target.value } : x)))} />
                <Field type="time" aria-label={`End ${index + 1} (optional)`} value={t.end} onChange={(e) => setTimes(times.map((x, i) => (i === index ? { ...x, end: e.target.value } : x)))} />
              </div>
            </div>
          ))}
        </div>
        {times.length < POLL_LIMITS.options && <div className="mt-2"><GhostButton onClick={() => setTimes([...times, blankTime()])}><Plus className="h-4 w-4" /> Add another time</GhostButton></div>}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-slate-800">Who should be asked?</div>
        {team.length > 0 && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {team.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <input type="checkbox" className="h-5 w-5 shrink-0" checked={!!picked[c.id]} onChange={() => setPicked({ ...picked, [c.id]: !picked[c.id] })} />
                <span className="min-w-0 text-sm"><span className="block truncate font-medium">{c.name}</span><span className="block truncate text-xs text-slate-500">{roleLabel(c.role)} · {c.email}</span></span>
              </label>
            ))}
          </div>
        )}
        <div className="space-y-2">
          {guests.map((g, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.4fr_1fr_auto]">
              <Field placeholder="Name" aria-label={`Name ${index + 1}`} value={g.name} onChange={(e) => setGuests(guests.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)))} maxLength={POLL_LIMITS.name} />
              <Field type="email" inputMode="email" placeholder="Email" aria-label={`Email ${index + 1}`} value={g.email} onChange={(e) => setGuests(guests.map((x, i) => (i === index ? { ...x, email: e.target.value } : x)))} maxLength={120} />
              <select aria-label={`Role ${index + 1}`} value={g.role} onChange={(e) => setGuests(guests.map((x, i) => (i === index ? { ...x, role: e.target.value } : x)))} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base sm:min-h-10 sm:text-sm">
                {INVITEE_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button type="button" aria-label={`Remove person ${index + 1}`} onClick={() => setGuests(guests.filter((_, i) => i !== index))} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="mt-2"><GhostButton onClick={() => setGuests([...guests, { name: "", email: "", role: "Parent or guardian" }])}><Plus className="h-4 w-4" /> Add a parent or someone else</GhostButton></div>
        {!team.length && <p className="mt-2 text-xs text-slate-500">Tip: add your team's emails on the IEP guide tab and they'll show up here to tick.</p>}
      </div>

      <TextArea placeholder="A short note (optional)" aria-label="Note" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={POLL_LIMITS.message} className="min-h-16" />
      {error && <div role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={send} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Email everyone</PrimaryButton>
        <GhostButton onClick={onClose}>Cancel</GhostButton>
      </div>
    </div>
  );
}

function PollCard({ poll, token, onBooked, onChanged, setNotice }: {
  poll: PollView; token: string | null; onBooked: (poll: PollView, option: PollView["options"][number], told: number) => void; onChanged: () => void; setNotice: (text: string) => void;
}) {
  const [picking, setPicking] = useState<string | null>(null);
  const [notify, setNotify] = useState(true);
  const [busy, setBusy] = useState(false);
  const answered = poll.invitees.filter((i) => i.respondedAt).length;
  const chosen = poll.options.find((o) => o.id === poll.chosenOption);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    try { await work(); } catch (e: any) { setNotice(e?.message || "Something went wrong."); } finally { setBusy(false); }
  }
  const remind = () => run(async () => {
    const r = await call(token, "POST", `/api/teacher-hub/polls/${poll.id}/remind`);
    setNotice(`Reminder sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}${r.failed ? `; ${r.failed} did not go through` : ""}.`);
  });
  const choose = (option: PollView["options"][number]) => run(async () => {
    const r = await call(token, "POST", `/api/teacher-hub/polls/${poll.id}/choose`, { optionId: option.id, notify });
    setPicking(null);
    onBooked(poll, option, r.told);
  });
  const remove = () => run(async () => {
    if (!window.confirm(`Delete “${poll.title}”? The links in the emails will stop working.`)) return;
    await call(token, "DELETE", `/api/teacher-hub/polls/${poll.id}`);
    onChanged();
  });

  return (
    <div className="rounded-2xl border border-slate-200 p-3 sm:p-4" data-testid="poll-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="break-words font-semibold">{poll.title}</div>
          <div className="text-xs text-slate-500">
            {poll.status === "booked" && chosen ? <span className="font-semibold text-emerald-700"><CalendarCheck className="mr-1 inline h-3.5 w-3.5" />Booked: {chosen.label}</span> : `${answered} of ${poll.invitees.length} answered`}
            {poll.location ? ` · ${poll.location}` : ""}
          </div>
        </div>
        <div className="flex gap-2">
          {poll.status === "open" && answered < poll.invitees.length && <GhostButton onClick={remind}>Remind</GhostButton>}
          <button type="button" aria-label={`Delete ${poll.title}`} onClick={remove} disabled={busy} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="-mx-1 mt-3 overflow-x-auto px-1">
        <table className="w-full min-w-[420px] border-separate border-spacing-y-1 text-sm">
          <thead>
            <tr className="text-left align-bottom text-xs text-slate-500">
              <th className="pr-2 font-medium">Person</th>
              {poll.options.map((o) => {
                const t = poll.tally.find((x) => x.id === o.id)!;
                return (
                  <th key={o.id} className="px-1 text-center font-medium" scope="col">
                    <div className="text-slate-800">{o.label.split(" · ")[0]}</div>
                    <div>{o.label.split(" · ")[1]}</div>
                    <div className="mt-1 text-[11px]">{t.yes} yes · {t.maybe} maybe · {t.no} no</div>
                    {poll.best === o.id && poll.status === "open" && <div className="text-[11px] font-semibold text-teal-700">{t.everyone ? "Everyone can" : "Best so far"}</div>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {poll.invitees.map((i) => (
              <tr key={i.id} data-testid="poll-person">
                <td className="pr-2 align-middle"><div className="max-w-[9rem] truncate font-medium">{i.name}</div><div className="text-[11px] text-slate-500">{i.role}{!i.emailSent ? " · email not sent" : ""}</div></td>
                {poll.options.map((o) => {
                  const a = i.respondedAt ? i.answers[o.id] : undefined;
                  return <td key={o.id} className="px-1 text-center">{a ? <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-bold ${SYMBOL[a].cls}`} title={SYMBOL[a].word}><span aria-hidden>{SYMBOL[a].mark}</span><span className="sr-only">{SYMBOL[a].word}</span></span> : <span className="text-slate-300" title="No answer yet">–<span className="sr-only">No answer yet</span></span>}</td>;
                })}
              </tr>
            ))}
            <tr>
              <td />
              {poll.options.map((o) => (
                <td key={o.id} className="px-1 pt-1 text-center">
                  {poll.status === "open" || poll.chosenOption !== o.id
                    ? <button type="button" onClick={() => setPicking(picking === o.id ? null : o.id)} className="min-h-11 rounded-xl border border-slate-200 px-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{poll.status === "booked" ? "Switch" : "Pick"}<span className="sr-only"> {o.label}</span></button>
                    : <span className="text-xs font-semibold text-emerald-700">Chosen</span>}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      {picking && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3" data-testid="poll-pick">
          <div className="text-sm font-semibold">Book {poll.options.find((o) => o.id === picking)?.label}?</div>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={notify} onChange={() => setNotify(!notify)} /> Email everyone the final time</label>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => choose(poll.options.find((o) => o.id === picking)!)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Book this time</PrimaryButton>
            <GhostButton onClick={() => setPicking(null)}>Cancel</GhostButton>
          </div>
        </div>
      )}

      {poll.invitees.some((i) => i.comment) && (
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {poll.invitees.filter((i) => i.comment).map((i) => <li key={i.id}><span className="font-medium text-slate-800">{i.name}:</span> {i.comment}</li>)}
        </ul>
      )}
    </div>
  );
}
