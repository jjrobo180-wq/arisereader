// Invite a family whose child is not on the site yet. Type the parent's or guardian's email (and the
// child's name, if you like) and the site emails them what A.R.I.S.E. Reader is and how to sign up:
// the child makes a student account, then the parent makes theirs with the child's parent code.
// Used at the top of the admin's Students list and on the teacher's Parents screen.
import { useEffect, useState, type FormEvent } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import InviteCopy from "@/components/InviteCopy";
import { loadFamilyInviteEmails, sendFamilyInviteEmail, type SentParentInvite } from "@/lib/parentInvites";

const when = (at: string) => {
  const t = new Date(at);
  return Number.isNaN(t.getTime()) ? "" : t.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};
/** How many sent invitations show before "Show all". */
const SHOWN = 5;

export default function FamilyEmailInvite() {
  const [email, setEmail] = useState("");
  const [child, setChild] = useState("");
  const [invites, setInvites] = useState<SentParentInvite[]>([]);
  const [emailReady, setEmailReady] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [all, setAll] = useState(false);

  useEffect(() => {
    let current = true;
    loadFamilyInviteEmails().then((data) => { if (current) { setInvites(data.invites); setEmailReady(data.emailReady); } }).catch(() => { /* the list is a nicety; sending still works */ });
    return () => { current = false; };
  }, []);

  async function send(to: string, name: string, e?: FormEvent) {
    e?.preventDefault();
    const address = to.trim();
    if (!address || busy) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const result = await sendFamilyInviteEmail(address, name.trim());
      setInvites(result.invites);
      setNotice(result.message);
      setEmail(""); setChild("");
    } catch (err: any) {
      setError(err?.message || "The invitation could not be sent.");
    } finally {
      setBusy(false);
    }
  }

  const shown = all ? invites : invites.slice(0, SHOWN);
  return (
    <div className="rounded-xl border border-border p-3 text-left" data-testid="family-email-invite">
      <h4 className="flex items-center gap-2 text-sm font-semibold"><UserPlus className="h-4 w-4 shrink-0" /> Invite a family that isn't signed up yet</h4>
      <p className="mt-1 text-xs text-muted-foreground">For a child who has no account. The parent gets an email that explains A.R.I.S.E. Reader and how to sign up: first the child's student account, then their own parent account. You can send it before either of them has signed up.</p>
      <form onSubmit={(e) => void send(email, child, e)} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto]">
        <Input type="email" inputMode="email" autoComplete="off" placeholder="parent@example.com" aria-label="Parent or guardian email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} data-testid="family-email-input" />
        <Input type="text" autoComplete="off" placeholder="Child's name (optional)" aria-label="Child's name (optional)" value={child} onChange={(e) => setChild(e.target.value)} maxLength={60} data-testid="family-child-input" />
        <Button type="submit" disabled={busy || !email.trim()} className="shrink-0" data-testid="family-email-send">{busy ? "Sending..." : "Send invitation"}</Button>
      </form>
      <InviteCopy childName={child} to={email} />
      {!emailReady && <p className="mt-2 text-xs text-amber-500">Email isn't set up on the site yet, so the site can't send invitations. You can copy the message into your own email.</p>}
      {notice && <p role="status" className="mt-2 text-sm text-emerald-500" data-testid="family-email-notice">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive" data-testid="family-email-error">{error}</p>}
      {invites.length > 0 && (
        <>
          <ul className="mt-3 space-y-1.5" aria-label="Families already invited" data-testid="family-email-sent">
            {shown.map((sent) => (
              <li key={sent.email} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/30 px-3 py-2 text-xs">
                <span className="min-w-0 break-all"><span className="font-semibold text-foreground">{sent.email}</span><span className="text-muted-foreground">{sent.child ? ` · ${sent.child}` : ""} · sent {when(sent.sentAt)}{sent.times > 1 ? ` (${sent.times} times)` : ""}</span></span>
                <button type="button" disabled={busy} onClick={() => void send(sent.email, sent.child || "")} className="min-h-9 shrink-0 font-semibold text-primary underline underline-offset-4 disabled:opacity-50">Send again</button>
              </li>
            ))}
          </ul>
          {invites.length > SHOWN && <button type="button" onClick={() => setAll(!all)} className="mt-2 min-h-9 text-xs font-semibold text-primary underline underline-offset-4" data-testid="family-email-more">{all ? "Show fewer" : `Show all ${invites.length}`}</button>}
        </>
      )}
    </div>
  );
}
