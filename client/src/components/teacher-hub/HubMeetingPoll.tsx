// Teacher Hub: asking everyone which times work for an IEP or re-evaluation meeting.
// The teacher offers a few times and picks the people (parents, staff, anyone else).
// Each gets an email with their own link; answers show up here, and the teacher books a time.
import { useCallback, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import MeetingWizard, { type WizardState } from "./HubMeetingSteps";
import { CalendarCheck, Check, Copy, Loader2, Mail, MessageSquare, Plus, Send, Trash2, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { INVITEE_ROLES, POLL_LIMITS, QUICK_ROLES, bookedEmailText, bookedSmsText, inviteEmailText, inviteSmsText, type PollAnswer } from "@shared/meetingPoll";
import { roleLabel } from "@shared/hubGuide";
import type { Workspace } from "@shared/teacherHub";
import { AnswerEditor, InvitedPolls, MyAvailability } from "./HubAvailability";
import { FIT_WORDS, fitOption, type Fit, type FreeWindow } from "@shared/availability";
import { Card, Empty, Field, GhostButton, PrimaryButton, TextArea } from "./ui";

type PollView = {
  id: string; title: string; location: string; message: string; hubMeetingId: string; senderName: string; sendVia: "site" | "mailbox" | "self"; sendText: boolean; status: "open" | "booked"; chosenOption: string | null; best: string | null;
  options: { id: string; date: string; start: string; end: string; label: string }[];
  invitees: { id: string; name: string; email: string; phone: string; link: string; role: string; answers: Record<string, PollAnswer>; comment: string; respondedAt: string | null; emailSent: boolean; linked: boolean; fit: Record<string, Fit> }[];
  tally: { id: string; yes: number; maybe: number; no: number; waiting: number; everyone: boolean }[];
};

export type PollStart = { meetingId: string; title: string } | null;
type Setter = Dispatch<SetStateAction<Workspace>>;
type Box = { connected: { provider: "google" | "microsoft"; email: string; name: string; needsReconnect: boolean } | null; available: { google: boolean; microsoft: boolean } };
const providerName = (p: "google" | "microsoft") => (p === "google" ? "Gmail" : "Outlook");

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
type Guest = { name: string; email: string; phone: string; role: string };
const blankGuest = (role = "Parent or guardian"): Guest => ({ name: "", email: "", phone: "", role });

export default function HubMeetingPolls({ token, workspace, setWorkspace, makeId, start, onStarted, account, wizard, setWizard, studentOptions, openGuide }: {
  token: string | null; workspace: Workspace; setWorkspace: Setter; makeId: () => string; start: PollStart; onStarted: () => void; account: { name: string; email: string };
  wizard: WizardState | null; setWizard: (next: WizardState | null) => void; studentOptions: () => ReactNode; openGuide: (guideId: string) => void;
}) {
  const [polls, setPolls] = useState<PollView[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [composing, setComposing] = useState<PollStart | { meetingId: ""; title: "" }>(null);
  const [notice, setNotice] = useState("");
  const [box, setBox] = useState<Box | null>(null);
  const [textAvailable, setTextAvailable] = useState(false);

  const loadBox = useCallback(async () => {
    try { setBox(await call(token, "GET", "/api/teacher-hub/mailbox")); } catch { setBox({ connected: null, available: { google: false, microsoft: false } }); }
  }, [token]);
  useEffect(() => { void loadBox(); }, [loadBox]);
  // Coming back from Google or Microsoft's "Allow" screen.
  useEffect(() => {
    const result = new URLSearchParams(window.location.search).get("mailbox");
    if (!result) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.hash);
    setNotice(result === "connected" ? "Your email is connected. Poll emails can now come from your own address."
      : result === "cancelled" ? "Connecting your email was cancelled. Nothing was changed."
      : `Could not connect your email${result.startsWith("failed:") ? `: ${result.slice(7)}` : "."}`);
  }, []);

  const load = useCallback(async () => {
    try { const data = await call(token, "GET", "/api/teacher-hub/polls"); setPolls(data.polls); setTextAvailable(!!data.textAvailable); setLoadError(""); }
    catch (error: any) { setLoadError(error?.message || "Could not load your polls."); setPolls((p) => p ?? []); }
  }, [token]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (start) { setComposing(start); onStarted(); } }, [start]); // eslint-disable-line react-hooks/exhaustive-deps

  function booked(poll: PollView, option: PollView["options"][number], told: number, selfSend = false) {
    setWorkspace((prev) => {
      const meetings = poll.hubMeetingId ? prev.meetings.map((m) => (m.id === poll.hubMeetingId ? { ...m, date: option.date } : m)) : prev.meetings;
      const already = prev.events.some((e) => e.title === poll.title && e.date === option.date && e.start === option.start);
      const events = already ? prev.events : [...prev.events, { id: makeId(), title: poll.title, date: option.date, start: option.start, end: option.end, location: poll.location, notes: "Time chosen with a meeting poll" }];
      return { ...prev, meetings, events };
    });
    setNotice(selfSend
      ? `Booked ${option.label}. It's on your calendar. Open the poll and use “Tell everyone the time” to send it from your own email or phone.`
      : `Booked ${option.label}. It's on your calendar${told ? ` and ${told} ${told === 1 ? "person was" : "people were"} told.` : "."}`);
    void load();
  }

  return (
    <Card
      title="Find a time with everyone"
      right={<GhostButton onClick={() => setComposing({ meetingId: "", title: "" })}><Plus className="h-4 w-4" /> Ask for times</GhostButton>}
    >
      <div className="space-y-4" data-testid="meeting-polls">
        {notice && <div role="status" data-testid="poll-notice" className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div>}
        <MailboxRow token={token} box={box} onChanged={loadBox} setNotice={setNotice} />
        <MyAvailability token={token} setNotice={setNotice} />
        <InvitedPolls token={token} setNotice={setNotice} />
        {wizard && (
          <MeetingWizard
            workspace={workspace} setWorkspace={setWorkspace} makeId={makeId} wizard={wizard} setWizard={setWizard} studentOptions={studentOptions} openGuide={openGuide}
            showPolls={() => { setWizard(null); window.setTimeout(() => document.querySelector('[data-testid="meeting-polls"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
            pollBody={(meeting, onSent) => (
              <Composer embedded box={box} textAvailable={textAvailable} token={token} workspace={workspace} setWorkspace={setWorkspace} account={account}
                initial={{ meetingId: meeting.id, title: `${meeting.type}${meeting.student ? ` for ${meeting.student.split(" ")[0]}` : ""}` }}
                onClose={() => undefined} onSent={(message) => { setNotice(message); void load(); onSent(); }} />
            )}
          />
        )}
        {composing && (
          <Composer
            box={box} textAvailable={textAvailable} token={token} workspace={workspace} setWorkspace={setWorkspace} account={account} initial={composing}
            onClose={() => setComposing(null)}
            onSent={(message) => { setComposing(null); setNotice(message); void load(); window.setTimeout(() => document.querySelector('[data-testid="meeting-polls"]')?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
          />
        )}
        {polls === null && <div className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>}
        {loadError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{loadError}</div>}
        {polls && !polls.length && !composing && !loadError && <Empty>No polls yet. Tap “Ask for times” to message parents and staff a few possible times.</Empty>}
        {polls?.map((poll) => <PollCard key={poll.id} poll={poll} token={token} senderName={poll.senderName || workspace.profile.senderName || account.name} contacts={workspace.spedContacts} onBooked={booked} onChanged={load} setNotice={setNotice} />)}
      </div>
    </Card>
  );
}

export function Composer({ box, textAvailable, token, workspace, setWorkspace, account, initial, onClose, onSent, embedded = false }: {
  embedded?: boolean;
  box: Box | null; textAvailable: boolean; token: string | null; workspace: Workspace; setWorkspace: Setter; account: { name: string; email: string }; initial: { meetingId: string; title: string }; onClose: () => void; onSent: (message: string) => void;
}) {
  // A pop-up: Escape closes it, and the page behind it stays put.
  useEffect(() => {
    if (embedded) return;
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = before; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [title, setTitle] = useState(initial.title);
  const [location, setLocation] = useState("");
  const [message, setMessage] = useState("");
  const [senderName, setSenderName] = useState(workspace.profile.senderName || account.name);
  const [replyTo, setReplyTo] = useState(workspace.profile.replyEmail || account.email);
  const [times, setTimes] = useState([blankTime(), blankTime()]);
  const team = workspace.spedContacts.filter((c) => c.email);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [guests, setGuests] = useState<Guest[]>([blankGuest()]);
  const mailboxReady = !!box?.connected && !box.connected.needsReconnect;
  type Via = "self" | "mailbox" | "site";
  const [sendVia, setSendVia] = useState<Via>("self");
  const [pickedVia, setPickedVia] = useState(false);
  // Until the teacher chooses: their connected email if they have one, else "I'll send it myself" (people open mail from someone they know).
  const via: Via = pickedVia ? (sendVia === "mailbox" && !mailboxReady ? "self" : sendVia) : (mailboxReady ? "mailbox" : "self");
  const [sendText, setSendText] = useState(false);
  const [textOk, setTextOk] = useState(false);
  const [seed, setSeed] = useState(true); // the first blank row is replaced by the first role button tapped
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function send() {
    setBusy(true); setError("");
    const invitees = [
      ...team.filter((c) => picked[c.id]).map((c) => ({ name: c.name, email: c.email, role: roleLabel(c.role) })),
      ...guests.filter((g) => g.email.trim() || g.name.trim() || g.phone.trim()),
    ];
    try {
      const data = await call(token, "POST", "/api/teacher-hub/polls", {
        title, location, message, hubMeetingId: initial.meetingId, senderName, replyTo, sendVia: via, sendText: via !== "self" && sendText, textConsent: textOk,
        options: times.filter((t) => t.date || t.start), invitees,
      });
      // Remember the choice for next time.
      setWorkspace((prev) => ({ ...prev, profile: { ...prev.profile, senderName, replyEmail: replyTo } }));
      const fell = data.mailboxProblem ? " Your connected email could not send, so these went out from A.R.I.S.E. Reader instead. Reconnect your email in the box above." : "";
      if (via === "self") return onSent("Your poll is ready. Below it, use the Email, Text or Copy buttons next to each person to send them their own link.");
      onSent((data.notSent ? `Sent, but ${data.notSent} ${data.notSent === 1 ? "email" : "emails"} did not go through. Open the poll to see who.` : `Sent to ${invitees.length} ${invitees.length === 1 ? "person" : "people"}. Their answers will show up here.`) + fell);
    } catch (e: any) { setError(e?.message || "Could not send."); }
    finally { setBusy(false); }
  }

  return (
    <div className={embedded ? "" : "fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4"} {...(embedded ? {} : { role: "dialog", "aria-modal": true, "aria-label": "Ask for times", "data-testid": "poll-dialog", onMouseDown: (e: any) => { if (e.target === e.currentTarget) onClose(); } })}>
    <div className={embedded ? "space-y-4" : "max-h-[94dvh] w-full max-w-3xl space-y-4 overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-4 shadow-2xl sm:rounded-3xl sm:p-6"} data-testid="poll-composer">
      {!embedded && (
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold">Ask for times</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
      )}
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
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_1.3fr_1fr_1fr_auto]">
              <Field placeholder="Name" aria-label={`Name ${index + 1}`} value={g.name} onChange={(e) => setGuests(guests.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)))} maxLength={POLL_LIMITS.name} />
              <Field type="email" inputMode="email" placeholder={via === "self" ? "Email (optional)" : "Email"} aria-label={`Email ${index + 1}`} value={g.email} onChange={(e) => setGuests(guests.map((x, i) => (i === index ? { ...x, email: e.target.value } : x)))} maxLength={120} />
              <Field type="tel" inputMode="tel" placeholder="Phone (optional)" aria-label={`Phone ${index + 1}`} value={g.phone} onChange={(e) => setGuests(guests.map((x, i) => (i === index ? { ...x, phone: e.target.value } : x)))} maxLength={30} />
              <select aria-label={`Role ${index + 1}`} value={g.role} onChange={(e) => setGuests(guests.map((x, i) => (i === index ? { ...x, role: e.target.value } : x)))} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base sm:min-h-10 sm:text-sm">
                {INVITEE_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
              <button type="button" aria-label={`Remove person ${index + 1}`} onClick={() => setGuests(guests.filter((_, i) => i !== index))} className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
        <div className="mt-2"><GhostButton onClick={() => setGuests([...guests, blankGuest()])}><Plus className="h-4 w-4" /> Add another person</GhostButton></div>
        <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Add a person by role">
          {QUICK_ROLES.map((role) => (
            <button key={role} type="button" onClick={() => { setGuests((prev) => [...(seed && prev.length === 1 && !prev[0].name && !prev[0].email ? [] : prev), blankGuest(role)]); setSeed(false); }} className="min-h-11 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50">+ {role}</button>
          ))}
        </div>
        {!team.length && <p className="mt-2 text-xs text-slate-500">Tip: add your team's emails on the IEP guide tab and they'll show up here to tick.</p>}
      </div>

      <div>
        <div className="mb-2 text-sm font-semibold text-slate-800">How should it be sent?</div>
        <p className="mb-2 text-xs text-slate-500">People open messages from someone they know. Each way below has its own benefit.</p>
        <div className="space-y-2" role="radiogroup" aria-label="How to send">
          <Way id="self" checked={via === "self"} onPick={() => { setSendVia("self"); setPickedVia(true); }}
            title="I'll send it myself, from my own email or phone"
            why="It comes from a name and number people already know, so parents and staff actually open it. No setup. You decide who gets what, and when."
            keep="You tap Send for each person (the buttons open your own email or texting app with everything already written)." />
          <Way id="mailbox" checked={via === "mailbox"} disabled={!mailboxReady} onPick={() => { setSendVia("mailbox"); setPickedVia(true); }}
            title={mailboxReady ? `Send from my connected email: ${box!.connected!.email}` : "Send from my connected Gmail or Outlook"}
            why="One click sends everyone their message from your real address. It shows in your Sent folder and replies land in your inbox, so people trust it."
            keep={mailboxReady ? "Uses your own email account, so your provider's daily sending limit applies." : "Connect your email in the box above first."} />
          <Way id="site" checked={via === "site"} onPick={() => { setSendVia("site"); setPickedVia(true); }}
            title="Send from A.R.I.S.E. Reader"
            why="Fastest: one click, nothing to set up, and the site sends reminders for you."
            keep="People may not recognize the sender, and it can land in junk, so let them know to watch for it. Your name shows on it and replies go to the address you choose." />
        </div>
        {via !== "self" && (
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">Name on the message
              <Field className="mt-1" aria-label="Name on the email" value={senderName} onChange={(e) => setSenderName(e.target.value)} maxLength={POLL_LIMITS.senderName} />
            </label>
            {via === "site" && (
              <label className="text-xs font-medium text-slate-600">Send replies to (your own email, or any you choose)
                <Field className="mt-1" type="email" inputMode="email" aria-label="Send replies to" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} maxLength={120} />
              </label>
            )}
          </div>
        )}
        {via !== "self" && textAvailable && (
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
            <label className="flex min-h-11 items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={sendText} onChange={() => setSendText(!sendText)} />
              <span><span className="block font-medium">Also text the people who have a phone number</span>
                <span className="block text-xs text-slate-500"><b className="text-emerald-700">Why:</b> most parents read a text within minutes, long before they check email. <b>Keep in mind:</b> it comes from the site's number, which they may not know, and each person can reply STOP to opt out.</span></span>
            </label>
            {sendText && (
              <label className="mt-2 flex min-h-11 items-start gap-3 text-sm">
                <input type="checkbox" className="mt-1 h-5 w-5 shrink-0" checked={textOk} onChange={() => setTextOk(!textOk)} />
                <span>I have these people's OK to text them about school meetings.</span>
              </label>
            )}
          </div>
        )}
        {via === "self" && textAvailable && <p className="mt-2 text-xs text-slate-500">Want the site to text people for you? Choose one of the other two ways above, then tick “Also text”.</p>}
      </div>

      <TextArea placeholder="A short note (optional)" aria-label="Note" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={POLL_LIMITS.message} className="min-h-16" />
      {error && <div role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div>}
      <div className="flex flex-wrap gap-2">
        <PrimaryButton onClick={send} disabled={busy || (sendText && via !== "self" && !textOk)}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {via === "self" ? "Create the poll" : "Send to everyone"}</PrimaryButton>
        {!embedded && <GhostButton onClick={onClose}>Cancel</GhostButton>}
      </div>
    </div>
    </div>
  );
}

function PollCard({ poll, token, senderName, contacts, onBooked, onChanged, setNotice }: {
  poll: PollView; token: string | null; senderName: string; contacts: { email: string; free?: FreeWindow[] }[]; onBooked: (poll: PollView, option: PollView["options"][number], told: number, selfSend?: boolean) => void; onChanged: () => void; setNotice: (text: string) => void;
}) {
  const selfMode = poll.sendVia === "self";
  const [showSelf, setShowSelf] = useState(selfMode && poll.status === "open");
  const [picking, setPicking] = useState<string | null>(null);
  const [entering, setEntering] = useState<string | null>(null);
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
    setNotice(`Reminder sent to ${r.sent} ${r.sent === 1 ? "person" : "people"}${r.failed ? `; ${r.failed} did not go through` : ""}.${r.mailboxProblem ? " Your connected email could not send, so these went out from A.R.I.S.E. Reader. Reconnect it above." : ""}`);
  });
  const choose = (option: PollView["options"][number]) => run(async () => {
    const r = await call(token, "POST", `/api/teacher-hub/polls/${poll.id}/choose`, { optionId: option.id, notify });
    setPicking(null);
    onBooked(poll, option, r.told, !!r.selfSend);
  });
  /** How free someone usually is: from their own account if they linked one, else from the free times saved on your team list. */
  const fitFor = (i: PollView["invitees"][number], optionId: string): Fit => {
    if (i.fit?.[optionId]) return i.fit[optionId];
    const saved = i.email ? contacts.find((c) => c.email && c.email.toLowerCase() === i.email.toLowerCase())?.free : undefined;
    const option = poll.options.find((o) => o.id === optionId);
    return saved?.length && option ? fitOption(saved, option) : "unknown";
  };
  const enter = (i: PollView["invitees"][number], answers: Record<string, string>, comment: string) => run(async () => {
    await call(token, "POST", `/api/teacher-hub/polls/${poll.id}/answer`, { inviteeId: i.id, answers, comment });
    setEntering(null);
    setNotice(`Saved ${i.name}'s answers.`);
    onChanged();
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
          {(selfMode || poll.invitees.some((i) => i.phone || i.email)) && <GhostButton onClick={() => setShowSelf(!showSelf)}>{showSelf ? "Hide messages" : poll.status === "booked" ? "Tell everyone" : "Send links"}</GhostButton>}
          {!selfMode && poll.status === "open" && answered < poll.invitees.length && <GhostButton onClick={remind}>Remind</GhostButton>}
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
                <td className="pr-2 align-middle"><div className="max-w-[9rem] truncate font-medium">{i.name}</div>{poll.status === "open" && <button type="button" onClick={() => setEntering(entering === i.id ? null : i.id)} className="min-h-11 text-[11px] font-medium text-teal-800 underline decoration-teal-200 underline-offset-2">{i.respondedAt ? "Change answers" : "Enter answers"}<span className="sr-only"> for {i.name}</span></button>}<div className="text-[11px] text-slate-500">{i.role}{!i.emailSent ? (selfMode ? " · not sent yet" : " · email not sent") : ""}</div></td>
                {poll.options.map((o) => {
                  const a = i.respondedAt ? i.answers[o.id] : undefined;
                  return <td key={o.id} className="px-1 text-center">{a ? <span className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 font-bold ${SYMBOL[a].cls}`} title={SYMBOL[a].word}><span aria-hidden>{SYMBOL[a].mark}</span><span className="sr-only">{SYMBOL[a].word}</span></span> : <span className="text-slate-300" title="No answer yet">–<span className="sr-only">No answer yet</span></span>}{fitFor(i, o.id) !== "unknown" && <div className={`mt-0.5 text-[10px] leading-tight ${fitFor(i, o.id) === "busy" ? "text-rose-700" : fitFor(i, o.id) === "partly" ? "text-amber-700" : "text-emerald-700"}`} data-testid="fit-hint">{FIT_WORDS[fitFor(i, o.id) as Exclude<Fit, "unknown">]}</div>}</td>;
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

      {entering && (() => {
        const person = poll.invitees.find((x) => x.id === entering);
        if (!person) return null;
        const free = person.email ? contacts.find((c) => c.email && c.email.toLowerCase() === person.email.toLowerCase())?.free : undefined;
        return (
          <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3" data-testid="enter-answers">
            <div className="text-sm font-semibold">Answers for {person.name}</div>
            <p className="text-xs text-slate-600">Use this when someone tells you their times by phone, in person or in a meeting.</p>
            <AnswerEditor key={person.id} options={poll.options} answers={person.answers} comment={person.comment} weekly={free} fit={person.fit} saveLabel="Save their answers" busy={busy} onSave={(a, c) => enter(person, a, c)} onCancel={() => setEntering(null)} />
          </div>
        );
      })()}

      {picking && (
        <div className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3" data-testid="poll-pick">
          <div className="text-sm font-semibold">Book {poll.options.find((o) => o.id === picking)?.label}?</div>
          <label className="flex min-h-11 items-center gap-3 text-sm"><input type="checkbox" className="h-5 w-5" checked={notify} onChange={() => setNotify(!notify)} /> {selfMode ? "Show me the messages to tell everyone" : poll.invitees.some((i) => i.phone) ? "Email or text everyone the final time" : "Email everyone the final time"}</label>
          <div className="flex flex-wrap gap-2">
            <PrimaryButton onClick={() => choose(poll.options.find((o) => o.id === picking)!)} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />} Book this time</PrimaryButton>
            <GhostButton onClick={() => setPicking(null)}>Cancel</GhostButton>
          </div>
        </div>
      )}

      {showSelf && <SelfSend poll={poll} token={token} senderName={senderName} chosen={chosen} onChanged={onChanged} setNotice={setNotice} />}

      {poll.invitees.some((i) => i.comment) && (
        <ul className="mt-3 space-y-1 text-sm text-slate-600">
          {poll.invitees.filter((i) => i.comment).map((i) => <li key={i.id}><span className="font-medium text-slate-800">{i.name}:</span> {i.comment}</li>)}
        </ul>
      )}
    </div>
  );
}

function SelfSend({ poll, token, senderName, chosen, onChanged, setNotice }: {
  poll: PollView; token: string | null; senderName: string; chosen?: PollView["options"][number]; onChanged: () => void; setNotice: (text: string) => void;
}) {
  const [copied, setCopied] = useState("");
  const booked = poll.status === "booked" && !!chosen;
  function messages(i: PollView["invitees"][number]) {
    const guest = i.name.split(" ")[0] || i.name || "there";
    if (booked) {
      const m = { guest, sender: senderName, title: poll.title, location: poll.location, when: chosen!.label.replace(" · ", ", ") };
      return { email: bookedEmailText(m), sms: bookedSmsText(m) };
    }
    const m = { guest, sender: senderName, title: poll.title, location: poll.location, options: poll.options, note: poll.message, link: i.link, reminder: i.emailSent && !i.respondedAt };
    return { email: inviteEmailText(m as any), sms: inviteSmsText(m) };
  }
  async function markSent(i: PollView["invitees"][number]) {
    try { await call(token, "POST", `/api/teacher-hub/polls/${poll.id}/sent`, { inviteeId: i.id, sent: true }); onChanged(); }
    catch (e: any) { setNotice(e?.message || "Could not save that."); }
  }
  async function copy(i: PollView["invitees"][number], text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(i.id); setTimeout(() => setCopied(""), 2000); void markSent(i); }
    catch { setNotice("Could not copy. Select the text and copy it yourself."); }
  }
  /** Called when Email or Text is tapped. If nothing opens (a computer with no mail or messages app), copy the message and say so. */
  function afterTap(i: PollView["invitees"][number], what: "email" | "text", message: string) {
    let left = false;
    const gone = () => { left = true; };
    window.addEventListener("blur", gone, { once: true });
    document.addEventListener("visibilitychange", gone, { once: true });
    window.setTimeout(async () => {
      window.removeEventListener("blur", gone);
      document.removeEventListener("visibilitychange", gone);
      if (left || document.visibilityState === "hidden") { void markSent(i); return; }
      try {
        await navigator.clipboard.writeText(message);
        setCopied(i.id); window.setTimeout(() => setCopied(""), 2500); void markSent(i);
        setNotice(what === "text"
          ? `This device can't open a text. The message is copied. Paste it into your phone's messages, ClassDojo, Remind or ParentSquare${i.phone ? `, to ${i.phone}` : ""}. On your phone, the Text button opens it for you.`
          : "This device has no email app set up. The message is copied. Paste it into your email.");
      } catch { setNotice(`This device can't open ${what === "text" ? "a text" : "email"}. Use Copy message instead.`); }
      window.setTimeout(() => document.querySelector('[data-testid="poll-notice"]')?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
    }, 1500);
  }
  const link = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50";
  return (
    <div className="mt-3 space-y-2 rounded-xl bg-slate-50 p-3" data-testid="self-send">
      <div className="text-sm font-semibold">{booked ? "Tell everyone the time" : "Send the links yourself"}</div>
      <p className="text-xs text-slate-600">
        {booked ? "Each button opens your own email or text app with the message already written. You tap Send." : "Each button opens your own email or text app with the message and that person's private link already in it. You tap Send, so it comes from you and people know your name."}
      </p>
      <ul className="space-y-2">
        {poll.invitees.map((i) => {
          const m = messages(i);
          const mail = i.email ? `mailto:${encodeURIComponent(i.email)}?subject=${encodeURIComponent(m.email.subject)}&body=${encodeURIComponent(m.email.body)}` : "";
          const text = i.phone ? `sms:${i.phone}?&body=${encodeURIComponent(m.sms)}` : "";
          return (
            <li key={i.id} className="rounded-xl bg-white p-2" data-testid="self-person">
              <div className="text-sm font-medium">{i.name} <span className="text-xs font-normal text-slate-500">{i.role}{i.respondedAt ? " · answered" : i.emailSent ? " · sent" : ""}</span></div>
              <div className="mt-1 flex flex-wrap gap-2">
                {mail && <a href={mail} onClick={() => afterTap(i, "email", `${m.email.subject}\n\n${m.email.body}`)} className={link}><Mail className="h-4 w-4" /> Email</a>}
                {text && <a href={text} onClick={() => afterTap(i, "text", m.sms)} className={link}><MessageSquare className="h-4 w-4" /> Text</a>}
                <button type="button" onClick={() => copy(i, m.sms)} className={link}>{copied === i.id ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === i.id ? "Copied" : "Copy message"}</button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-slate-500">Email and Text open your own apps, so they work best on your phone. “Copy message” is for ClassDojo, Remind, ParentSquare, Google Chat or any app you already use with a family.</p>
    </div>
  );
}

function MailboxRow({ token, box, onChanged, setNotice }: { token: string | null; box: Box | null; onChanged: () => void; setNotice: (text: string) => void }) {
  const [busy, setBusy] = useState(false);
  if (!box) return null;
  const { connected, available } = box;
  const anyAvailable = available.google || available.microsoft;

  async function connect(provider: "google" | "microsoft") {
    setBusy(true);
    try {
      const data = await call(token, "POST", "/api/teacher-hub/mailbox/start", { provider });
      window.location.href = data.url; // Google's or Microsoft's own "Allow" screen
    } catch (e: any) { setNotice(e?.message || "Could not start connecting."); setBusy(false); }
  }
  async function disconnect() {
    if (!window.confirm("Disconnect your email? Polls you already sent keep working, and new ones will come from A.R.I.S.E. Reader.")) return;
    setBusy(true);
    try { await call(token, "POST", "/api/teacher-hub/mailbox/disconnect", {}); onChanged(); setNotice("Your email was disconnected."); }
    catch (e: any) { setNotice(e?.message || "Could not disconnect."); }
    finally { setBusy(false); }
  }

  const buttons = (
    <div className="flex flex-wrap gap-2">
      {available.google && <GhostButton onClick={() => connect("google")}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Connect Gmail</GhostButton>}
      {available.microsoft && <GhostButton onClick={() => connect("microsoft")}><Mail className="h-4 w-4" /> Connect Outlook</GhostButton>}
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-200 p-3 text-sm" data-testid="mailbox-row">
      {connected && !connected.needsReconnect ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0"><span className="font-semibold">Your email is connected:</span> <span className="break-all">{connected.email}</span> <span className="text-xs text-slate-500">({providerName(connected.provider)})</span></div>
          <GhostButton onClick={disconnect}>Disconnect</GhostButton>
        </div>
      ) : connected ? (
        <div className="space-y-2">
          <div className="font-semibold text-amber-700">Your email ({connected.email}) needs to be connected again.</div>
          <p className="text-xs text-slate-500">Until then, poll emails go out from A.R.I.S.E. Reader.</p>
          {buttons}
        </div>
      ) : anyAvailable ? (
        <div className="space-y-2">
          <div><span className="font-semibold">Send from your own email.</span> <span className="text-slate-500">Connect Gmail or Outlook once, and poll emails come from your real address. The site can only send; it can't read your mail.</span></div>
          {buttons}
        </div>
      ) : (
        <div className="text-slate-500">Sending from your own email isn't set up on the site yet. Poll emails come from A.R.I.S.E. Reader, with replies going to the address you choose.</div>
      )}
    </div>
  );
}

function Way({ id, checked, disabled, onPick, title, why, keep }: { id: string; checked: boolean; disabled?: boolean; onPick: () => void; title: string; why: string; keep: string }) {
  return (
    <label data-testid={`way-${id}`} className={`flex items-start gap-3 rounded-xl border bg-white px-3 py-2 ${checked ? "border-teal-500 ring-1 ring-teal-200" : "border-slate-200"} ${disabled ? "opacity-60" : "cursor-pointer"}`}>
      <input type="radio" name="send-via" className="mt-1 h-5 w-5 shrink-0" disabled={disabled} checked={checked} onChange={onPick} />
      <span className="min-w-0 text-sm">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-slate-600"><b className="text-emerald-700">Why choose it:</b> {why}</span>
        <span className="mt-0.5 block text-xs text-slate-500"><b>Keep in mind:</b> {keep}</span>
      </span>
    </label>
  );
}
