// Inviting families by email, built from the hub's own parts. Same as the site's FamilyEmailInvite,
// ParentEmailInvite and InviteCopy: the site emails the invitation, or you copy the message and send
// it from your own email; invitations already sent are listed with "Send again".
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { Copy, Mail, UserPlus } from "lucide-react";
import { mailtoLink } from "@/components/InviteCopy";
import { loadFamilyInviteEmails, loadInviteTemplate, loadParentInviteEmails, sendFamilyInviteEmail, sendParentInviteEmail, type SentParentInvite } from "@/lib/parentInvites";
import { richInviteHtml } from "@shared/inviteRich";
import { fmtWhen, kit, type Which } from "./kit";

const SHOWN = 5;

function SentList({ which, invites, busy, onAgain }: { which: Which; invites: SentParentInvite[]; busy: boolean; onAgain: (s: SentParentInvite) => void }) {
  const k = kit(which);
  const [all, setAll] = useState(false);
  if (!invites.length) return null;
  return <div>
    <ul className="space-y-1.5" aria-label="Already invited">{(all ? invites : invites.slice(0, SHOWN)).map((s) =>
      <li key={s.email} className={`${k.soft} flex flex-wrap items-center justify-between gap-2 !py-2 text-sm`}>
        <span className="min-w-0 break-all"><span className="font-semibold text-slate-800">{s.email}</span><span className="text-slate-500">{s.child ? ` · ${s.child}` : ""} · sent {fmtWhen(s.sentAt)}{s.times > 1 ? ` (${s.times} times)` : ""}</span></span>
        <button type="button" disabled={busy} onClick={() => onAgain(s)} className={k.link + " min-h-9 text-sm"}>Send again</button>
      </li>)}</ul>
    {invites.length > SHOWN && <button type="button" onClick={() => setAll(!all)} className={k.link + " mt-2 min-h-9 text-sm"}>{all ? "Show fewer" : `Show all ${invites.length}`}</button>}
  </div>;
}

/** Invite a family whose child has no account yet. */
export function HubFamilyInvite({ which }: { which: Which }) {
  const k = kit(which);
  const [email, setEmail] = useState("");
  const [child, setChild] = useState("");
  const [note, setNote] = useState("");
  const [invites, setInvites] = useState<SentParentInvite[]>([]);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { let on = true; loadFamilyInviteEmails().then((d) => { if (on) { setInvites(d.invites); setReady(d.emailReady); } }).catch(() => {}); return () => { on = false; }; }, []);
  const send = async (to: string, name: string, e?: FormEvent) => {
    e?.preventDefault();
    if (!to.trim() || busy) return;
    setBusy(true); setNotice(""); setError("");
    try { const r = await sendFamilyInviteEmail(to.trim(), name.trim(), note.trim()); setInvites(r.invites); setNotice(r.message); setEmail(""); setChild(""); setNote(""); }
    catch (err: any) { setError(err?.message || "The invitation could not be sent."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3" data-testid="family-email-invite">
    <p className={k.text}>For a child who has no account yet. The parent gets an email explaining A.R.I.S.E. Reader and how to sign up: first the child's student account, then their own parent account.</p>
    <form onSubmit={(e) => void send(email, child, e)} className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
      <input type="email" inputMode="email" autoComplete="off" placeholder="parent@example.com" aria-label="Parent or guardian email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} className={k.input} data-testid="family-email-input" />
      <input type="text" autoComplete="off" placeholder="Child's name" aria-label="Child's name (optional)" value={child} onChange={(e) => setChild(e.target.value)} maxLength={60} className={k.input} data-testid="family-child-input" />
      <button type="submit" disabled={busy || !email.trim()} className={k.primary} data-testid="family-email-send"><UserPlus className="h-4 w-4" /> {busy ? "Sending…" : "Send invitation"}</button>
    </form>
    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={600} placeholder="Anything to add in your own words (optional)" aria-label="Anything to add to the invitation" className={k.input + " py-2"} data-testid="family-email-note" />
    <CopyMessage which={which} childName={child} note={note} to={email} />
    {!ready && <p className="text-sm text-amber-800">Email isn't set up on the site yet, so it can't send invitations. Copy the message into your own email instead.</p>}
    {notice && <p role="status" className={k.ok} data-testid="family-email-notice">{notice}</p>}
    {error && <p role="alert" className={k.bad} data-testid="family-email-error">{error}</p>}
    <SentList which={which} invites={invites} busy={busy} onAgain={(s) => void send(s.email, s.child || "")} />
  </div>;
}

/** Email one student's parent their invitation and code. */
export function HubParentInvite({ which, studentId, studentName }: { which: Which; studentId: number; studentName: string }) {
  const k = kit(which);
  const first = studentName.trim().split(/\s+/)[0] || "this student";
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [invites, setInvites] = useState<SentParentInvite[]>([]);
  const [ready, setReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { let on = true; setInvites([]); loadParentInviteEmails(studentId).then((d) => { if (on) { setInvites(d.invites); setReady(d.emailReady); } }).catch(() => {}); return () => { on = false; }; }, [studentId]);
  const send = async (to: string, e?: FormEvent) => {
    e?.preventDefault();
    if (!to.trim() || busy) return;
    setBusy(true); setNotice(""); setError("");
    try { const r = await sendParentInviteEmail(studentId, to.trim(), note.trim()); setInvites(r.invites); setNotice(r.message); setEmail(""); }
    catch (err: any) { setError(err?.message || "The invitation could not be sent."); }
    finally { setBusy(false); }
  };
  if (!open) return <div className="flex flex-wrap items-center gap-2" data-testid="parent-email-invite">
    <button type="button" className={k.ghost} onClick={() => setOpen(true)}><Mail className="h-4 w-4" /> Email {first}'s parent</button>
    {invites.length > 0 && <span className={k.small}>Invited {invites.length === 1 ? invites[0].email : `${invites.length} people`}</span>}
  </div>;
  return <div className={`${k.soft} space-y-3`} data-testid="parent-email-invite">
    <p className={k.text}>They don't need to be signed up. The email explains A.R.I.S.E. Reader, what a parent account does, and how to make theirs with {first}'s code.</p>
    <form onSubmit={(e) => void send(email, e)} className="flex flex-col gap-2 sm:flex-row">
      <input type="email" inputMode="email" autoComplete="off" placeholder="parent@example.com" aria-label={`Parent or guardian email for ${studentName}`} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} className={k.input} data-testid="parent-email-input" />
      <button type="submit" disabled={busy || !email.trim()} className={k.primary} data-testid="parent-email-send">{busy ? "Sending…" : "Send invitation"}</button>
    </form>
    <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={600} placeholder={`Anything to add (optional), like: ${first} did great on the last quiz!`} aria-label={`Anything to add to ${studentName}'s invitation`} className={k.input + " py-2"} data-testid="parent-email-note" />
    <CopyMessage which={which} studentId={studentId} note={note} to={email} />
    {!ready && <p className="text-sm text-amber-800">Email isn't set up on the site yet. Copy the message into your own email, or print the parent letter.</p>}
    {notice && <p role="status" className={k.ok} data-testid="parent-email-notice">{notice}</p>}
    {error && <p role="alert" className={k.bad} data-testid="parent-email-error">{error}</p>}
    <SentList which={which} invites={invites} busy={busy} onAgain={(s) => void send(s.email)} />
    <button type="button" className={k.link + " min-h-9 text-sm"} onClick={() => setOpen(false)}>Close</button>
  </div>;
}

/** The invitation as words to send from your own email (the site sends nothing). */
function CopyMessage({ which, studentId, childName = "", note = "", to = "" }: { which: Which; studentId?: number; childName?: string; note?: string; to?: string }) {
  const k = kit(which);
  const who = `${studentId ?? "family"}`, key = `${who}|${childName.trim()}|${note.trim()}`;
  const [made, setMade] = useState<{ who: string; key: string; subject: string } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  const rich = useMemo(() => richInviteHtml(text, window.location.origin), [text]);
  const html = useMemo(() => ({ __html: rich }), [rich]);
  const id = useId();
  const shown = made && made.who === who ? made : null;
  const stale = !!shown && shown.key !== key;

  const write = async () => {
    if (busy) return;
    setBusy(true); setNotice(""); setError("");
    try { const t = await loadInviteTemplate(studentId ? { studentId, note: note.trim() } : { childName: childName.trim(), note: note.trim() }); setMade({ who, key, subject: t.subject }); setText(t.text); }
    catch (err: any) { setError(err?.message || "The message could not be written."); }
    finally { setBusy(false); }
  };
  const copy = async (value: string, label: string, fromBox = false) => {
    setNotice(""); setError("");
    try { if (!navigator.clipboard) throw new Error(); await navigator.clipboard.writeText(value); setNotice(`${label} copied.`); }
    catch {
      if (fromBox && area.current) { area.current.focus(); area.current.select(); try { if (document.execCommand("copy")) { setNotice(`${label} copied.`); return; } } catch { /* below */ } }
      setError(`${label} could not be copied for you. Select the words and copy them yourself.`);
    }
  };
  const copyRich = async () => {
    setNotice(""); setError("");
    const done = () => setNotice("Copied with the logo and pictures. Paste it into your email.");
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error();
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([rich], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      done();
    } catch {
      const node = preview.current, sel = window.getSelection();
      if (node && sel) { const r = document.createRange(); r.selectNodeContents(node); sel.removeAllRanges(); sel.addRange(r); try { if (document.execCommand("copy")) { sel.removeAllRanges(); done(); return; } } catch { /* below */ } }
      setError("It could not be copied for you. The preview is selected: copy it yourself, then paste it into your email.");
    }
  };

  if (!shown) return <div data-testid="invite-copy">
    <button type="button" disabled={busy} onClick={() => void write()} className={k.link + " min-h-9 text-sm"} data-testid="invite-copy-open">{busy ? "Writing it…" : "Or copy the message to send from my own email"}</button>
    {error && <p role="alert" className={`mt-1 ${k.bad}`}>{error}</p>}
  </div>;
  return <div className={`${k.box} space-y-3`} data-testid="invite-copy">
    <p className={k.small}>Paste this into an email from any address. {studentId ? "The student's code and sign-up link are in it. " : ""}You can change the words first. The site sends nothing, so it won't show in the list of who was invited.</p>
    {stale && <div role="status" className={`${k.rowWarn} flex flex-wrap items-center gap-2 text-sm`}><span className="min-w-0 flex-1 text-amber-950">You changed the name or the note. The message below is the earlier one.</span><button type="button" disabled={busy} onClick={() => void write()} className={k.primary}>{busy ? "Writing it…" : "Write it again"}</button></div>}
    <label className="block" htmlFor={`${id}-subject`}><span className={k.label}>Subject</span></label>
    <div className="flex gap-2"><input id={`${id}-subject`} readOnly value={shown.subject} onFocus={(e) => e.currentTarget.select()} className={k.input} /><button type="button" className={k.ghost} onClick={() => void copy(shown.subject, "Subject")} aria-label="Copy subject"><Copy className="h-4 w-4" /> Copy</button></div>
    <label className="block" htmlFor={`${id}-text`}><span className={k.label}>Message</span></label>
    <textarea id={`${id}-text`} ref={area} value={text} onChange={(e) => setText(e.target.value)} rows={10} className={k.input + " py-2 leading-relaxed"} />
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={k.primary} onClick={() => void copyRich()}><Copy className="h-4 w-4" /> Copy with logo and pictures</button>
      <button type="button" className={k.ghost} onClick={() => void copy(text, "Message", true)}><Copy className="h-4 w-4" /> Copy words only</button>
      <a className={k.ghost} href={mailtoLink(to, shown.subject, text)}>Open in my email app</a>
      <button type="button" className={k.link + " min-h-9 text-sm"} onClick={() => { setMade(null); setNotice(""); setError(""); }}>Close</button>
    </div>
    <p className={k.small}>"Open in my email app" carries the words only. Phone email apps often paste words only too.</p>
    <p className={k.label}>How it looks with the logo and pictures</p>
    <div ref={preview} className="max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3" dangerouslySetInnerHTML={html} />
    {notice && <p role="status" className={k.ok}>{notice}</p>}
    {error && <p role="alert" className={k.bad}>{error}</p>}
  </div>;
}
