// Type a parent's or guardian's email for a student and the site emails them what A.R.I.S.E. Reader is,
// what a parent account does, and how to sign up with the student's code. They need no account first.
// Used in the admin's student details and on the teacher's Parents screen.
import { useEffect, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InviteCopy from "@/components/InviteCopy";
import { loadParentInviteEmails, sendParentInviteEmail, type SentParentInvite } from "@/lib/parentInvites";

const when = (at: string) => {
  const t = new Date(at);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

export default function ParentEmailInvite({ studentId, studentName }: { studentId: number; studentName: string }) {
  const [email, setEmail] = useState("");
  const [invites, setInvites] = useState<SentParentInvite[]>([]);
  const [emailReady, setEmailReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const first = studentName.trim().split(/\s+/)[0] || "this student";

  useEffect(() => {
    let current = true;
    setInvites([]); setNotice(""); setError(""); setEmail("");
    loadParentInviteEmails(studentId).then((data) => { if (current) { setInvites(data.invites); setEmailReady(data.emailReady); } }).catch(() => { /* the list is a nicety; sending still works */ });
    return () => { current = false; };
  }, [studentId]);

  async function send(to: string, e?: FormEvent) {
    e?.preventDefault();
    const address = to.trim();
    if (!address || busy) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const result = await sendParentInviteEmail(studentId, address);
      setInvites(result.invites);
      setNotice(result.message);
      setEmail("");
    } catch (err: any) {
      setError(err?.message || "The invitation could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-3 text-left" data-testid="parent-email-invite">
      <h4 className="flex items-center gap-2 text-sm font-semibold"><Mail className="h-4 w-4 shrink-0" /> Email {first}'s parent</h4>
      <p className="mt-1 text-xs text-muted-foreground">They don't need an account. They get an email that explains A.R.I.S.E. Reader, what a parent account does, and how to sign up with {first}'s code.</p>
      <form onSubmit={(e) => void send(email, e)} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Input type="email" inputMode="email" autoComplete="off" placeholder="parent@example.com" aria-label={`Parent or guardian email for ${studentName}`} value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} data-testid="parent-email-input" />
        <Button type="submit" disabled={busy || !email.trim()} className="shrink-0" data-testid="parent-email-send">{busy ? "Sending..." : "Send invitation"}</Button>
      </form>
      <InviteCopy studentId={studentId} to={email} />
      {!emailReady && <p className="mt-2 text-xs text-amber-500">Email isn't set up on the site yet, so the site can't send invitations. You can copy the message into your own email, or print the parent letter.</p>}
      {notice && <p role="status" className="mt-2 text-sm text-emerald-500" data-testid="parent-email-notice">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive" data-testid="parent-email-error">{error}</p>}
      {invites.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Invitations already sent" data-testid="parent-email-sent">
          {invites.map((sent) => (
            <li key={sent.email} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/30 px-3 py-2 text-xs">
              <span className="min-w-0 break-all"><span className="font-semibold text-foreground">{sent.email}</span><span className="text-muted-foreground"> · sent {when(sent.sentAt)}{sent.times > 1 ? ` (${sent.times} times)` : ""}</span></span>
              <button type="button" disabled={busy} onClick={() => void send(sent.email)} className="min-h-9 shrink-0 font-semibold text-primary underline underline-offset-4 disabled:opacity-50">Send again</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
