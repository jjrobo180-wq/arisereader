// The parent invitation as words to copy into your own email (a personal or school address), for when
// you would rather it come from you than from the site. Shown inside both invitation boxes.
// The site sends nothing here, so nothing is added to the list of who was invited.
import { useId, useMemo, useRef, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { loadInviteTemplate } from "@/lib/parentInvites";
import { richInviteHtml } from "@shared/inviteRich";

/** A mailto link that opens the person's own email app with the message written. */
export function mailtoLink(to: string, subject: string, text: string): string {
  const address = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim()) ? to.trim() : "";
  return `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text.replace(/\r?\n/g, "\r\n"))}`;
}

export default function InviteCopy({ studentId, childName = "", to = "" }: {
  /** The student whose invitation it is. Left out for a family that is new to the site. */
  studentId?: number;
  /** For a new family: the child's name typed so far. */
  childName?: string;
  /** The parent's address typed so far, to fill in "To" when the email app is opened. */
  to?: string;
}) {
  // The message goes with one student (or one child's name). Change either and it is written again.
  const key = `${studentId ?? "family"}|${childName.trim()}`;
  const [made, setMade] = useState<{ key: string; subject: string } | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const area = useRef<HTMLTextAreaElement>(null);
  const preview = useRef<HTMLDivElement>(null);
  // The same words with the logo and pictures on top, laid out for an email. It follows what is typed in the box.
  const rich = useMemo(() => richInviteHtml(text, window.location.origin), [text]);
  // Kept as one object while the words are the same, so the preview is not redrawn (which would drop a selection made in it).
  const previewHtml = useMemo(() => ({ __html: rich }), [rich]);
  const id = useId();
  const shown = made && made.key === key ? made : null;

  async function write() {
    if (busy) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const template = await loadInviteTemplate(studentId ? { studentId } : { childName: childName.trim() });
      setMade({ key, subject: template.subject });
      setText(template.text);
    } catch (err: any) {
      setError(err?.message || "The message could not be written.");
    } finally {
      setBusy(false);
    }
  }

  async function copy(value: string, label: string, fromBox = false) {
    setNotice(""); setError("");
    try {
      if (!navigator.clipboard) throw new Error("no clipboard");
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch {
      // Older browsers: select the words in the box and copy that.
      if (fromBox && area.current) {
        area.current.focus(); area.current.select();
        try { if (document.execCommand("copy")) { setNotice(`${label} copied.`); return; } } catch { /* tell them below */ }
      }
      setError(`${label} could not be copied for you. Select the words and copy them yourself.`);
    }
  }

  /** Copies the message with its logo, pictures and layout, so pasting into an email keeps them. */
  async function copyRich() {
    setNotice(""); setError("");
    const done = () => setNotice("Copied with the logo and pictures. Paste it into your email.");
    try {
      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("no rich clipboard");
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([rich], { type: "text/html" }), "text/plain": new Blob([text], { type: "text/plain" }) })]);
      done();
    } catch {
      // Older browsers: select the preview itself and copy that, which keeps the pictures too.
      const node = preview.current, selection = window.getSelection();
      if (node && selection) {
        const range = document.createRange();
        range.selectNodeContents(node);
        selection.removeAllRanges(); selection.addRange(range);
        try { if (document.execCommand("copy")) { selection.removeAllRanges(); done(); return; } } catch { /* tell them below */ }
      }
      setError("It could not be copied for you. The preview is selected: copy it yourself, then paste it into your email.");
    }
  }

  if (!shown) {
    return (
      <div className="mt-2" data-testid="invite-copy">
        <button type="button" disabled={busy} onClick={() => void write()} className="min-h-9 text-xs font-semibold text-primary underline underline-offset-4 disabled:opacity-50" data-testid="invite-copy-open">{busy ? "Writing it..." : "Or copy the message to send from my own email"}</button>
        {error && <p role="alert" className="mt-1 text-sm text-destructive" data-testid="invite-copy-error">{error}</p>}
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg bg-muted/30 p-3" data-testid="invite-copy">
      <p className="text-xs text-muted-foreground">Paste this into an email from any address. {studentId ? "The student's code and sign-up link are in it. " : ""}You can change the words first. The site sends nothing, so it won't show in the list of who was invited.</p>
      <label className="mt-3 block text-xs font-semibold text-muted-foreground" htmlFor={`${id}-subject`}>Subject</label>
      <div className="mt-1 flex gap-2">
        <Input id={`${id}-subject`} readOnly value={shown.subject} onFocus={(e) => e.currentTarget.select()} data-testid="invite-copy-subject" />
        <Button type="button" variant="outline" className="shrink-0" onClick={() => void copy(shown.subject, "Subject")} aria-label="Copy subject"><Copy className="h-4 w-4" /> Copy</Button>
      </div>
      <label className="mt-3 block text-xs font-semibold text-muted-foreground" htmlFor={`${id}-text`}>Message</label>
      <textarea id={`${id}-text`} ref={area} value={text} onChange={(e) => setText(e.target.value)} rows={12} className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-relaxed text-foreground" data-testid="invite-copy-text" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void copyRich()} data-testid="invite-copy-rich"><Copy className="h-4 w-4" /> Copy with logo and pictures</Button>
        <Button type="button" variant="outline" onClick={() => void copy(text, "Message", true)} data-testid="invite-copy-message"><Copy className="h-4 w-4" /> Copy words only</Button>
        <Button asChild variant="outline"><a href={mailtoLink(to, shown.subject, text)} data-testid="invite-copy-mailto">Open in my email app</a></Button>
        <button type="button" onClick={() => { setMade(null); setNotice(""); setError(""); }} className="min-h-9 text-xs font-semibold text-muted-foreground underline underline-offset-4">Close</button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">"Open in my email app" carries the words only. If it opens with part of the message missing, copy and paste instead.</p>
      <div className="mt-3 text-xs font-semibold text-muted-foreground">How it looks with the logo and pictures</div>
      {/* Our own words and layout, made safe in shared/inviteRich.ts. White, the way an email is. */}
      <div ref={preview} className="mt-1 max-h-96 overflow-y-auto rounded-md border border-input bg-white p-3" data-testid="invite-copy-preview" dangerouslySetInnerHTML={previewHtml} />
      {notice && <p role="status" className="mt-2 text-sm text-emerald-500" data-testid="invite-copy-notice">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive" data-testid="invite-copy-error">{error}</p>}
    </div>
  );
}
