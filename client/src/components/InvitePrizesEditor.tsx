// The admin sets which prizes the parent invitations mention (Reader of the Year, Reader of the Month),
// one per line. Competitions that are on right now add themselves and are listed under the box.
import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadInvitePrizes, saveInvitePrizes, type InvitePrizes } from "@/lib/parentInvites";

export default function InvitePrizesEditor() {
  const [prizes, setPrizes] = useState<InvitePrizes | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;
    loadInvitePrizes().then((data) => { if (current) { setPrizes(data); setText(data.lines.join("\n")); } }).catch(() => { /* the box just stays closed */ });
    return () => { current = false; };
  }, []);
  if (!prizes) return null;

  async function save(lines: string[]) {
    if (busy) return;
    setBusy(true); setNotice(""); setError("");
    try {
      const saved = await saveInvitePrizes(lines);
      setPrizes(saved); setText(saved.lines.join("\n")); setNotice(saved.message);
    } catch (err: any) {
      setError(err?.message || "The prizes could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="rounded-xl border border-border p-3 text-left" data-testid="invite-prizes">
      <summary className="flex min-h-9 cursor-pointer items-center gap-2 text-sm font-semibold"><Trophy className="h-4 w-4 shrink-0" /> Prizes the invitations mention ({prizes.lines.length})</summary>
      <p className="mt-2 text-xs text-muted-foreground">One prize per line. They go into every parent invitation, from you and from any teacher, under "Prizes and competitions". Leave the box empty to mention none.</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1800} aria-label="Prizes the invitations mention, one per line" className="mt-2 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" data-testid="invite-prizes-text" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void save(text.split("\n"))} data-testid="invite-prizes-save">{busy ? "Saving..." : "Save prizes"}</Button>
        <button type="button" disabled={busy} onClick={() => setText(prizes.defaults.join("\n"))} className="min-h-9 text-xs font-semibold text-primary underline underline-offset-4 disabled:opacity-50">Put the built-in ones back</button>
      </div>
      {notice && <p role="status" className="mt-2 text-sm text-emerald-500" data-testid="invite-prizes-notice">{notice}</p>}
      {error && <p role="alert" className="mt-2 text-sm text-destructive">{error}</p>}
      {prizes.automatic.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground" data-testid="invite-prizes-automatic">
          <div className="font-semibold">Added by themselves while they are on:</div>
          <ul className="mt-1 list-disc space-y-1 pl-5">{prizes.automatic.map((line) => <li key={line} className="break-words">{line}</li>)}</ul>
        </div>
      )}
    </details>
  );
}
