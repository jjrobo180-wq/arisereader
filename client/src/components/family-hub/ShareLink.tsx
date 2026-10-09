// "Share link" for a part of the Family Hub: copies a private link family can open without an
// account (a poll they can vote in, or a page they can look at). The list of links, with a way
// to turn each one off, lives in Family & settings.
import { useState } from "react";
import { Check, Copy, Link2, Link2Off, Loader2 } from "lucide-react";
import { makeShare, sendLink, stopShare, useTodoShares } from "@/lib/todoShares";
import { Panel, confirmed, plain } from "./ui";

export function ShareButton({ target, title, say, label = "Share link", compact }: { target: string; title: string; say: (message: string) => void; label?: string; compact?: boolean }) {
  const { token, shares } = useTodoShares();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const live = shares.find((s) => s.target === target);

  async function share() {
    setBusy(true);
    try {
      const link = live || (await makeShare(token, target));
      const how = await sendLink(link.url, title);
      if (how === "cancelled") return;
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
      say(how === "copied" ? "Link copied. Send it to family; they don't need an account to open it." : "Link ready. Anyone with it can open this without an account.");
    } catch (error: any) {
      say(error?.message || "Could not make a link.");
    } finally { setBusy(false); }
  }
  async function stop() {
    if (!live || !confirmed("Turn this link off? Anyone you sent it to won't be able to open it anymore.")) return;
    try { await stopShare(token, live.token); say("Link turned off"); } catch (error: any) { say(error?.message || "Could not turn the link off."); }
  }

  return <span className="inline-flex items-center gap-1" data-testid={`todo-share-${target.split(":")[0]}`}>
    <button type="button" onClick={share} disabled={busy} className={plain + (compact ? " min-h-9 px-2.5 text-xs" : " min-h-11")} title="Copy a link family can open without an account">
      {busy ? <Loader2 size={15} className="animate-spin" /> : copied ? <Check size={15} className="text-emerald-600" /> : <Link2 size={15} />}
      {compact ? (live ? "Copy link" : "Share") : live ? "Copy link" : label}
    </button>
    {live && <button type="button" onClick={stop} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Turn this link off" title="Turn this link off"><Link2Off size={15} /></button>}
  </span>;
}

export function SharedLinks({ say }: { say: (message: string) => void }) {
  const { token, shares, error, loadedAt } = useTodoShares();
  const copy = async (url: string, title: string) => {
    const how = await sendLink(url, title);
    if (how === "copied") say("Link copied");
  };
  const stop = async (shareToken: string) => {
    if (!confirmed("Turn this link off? Anyone you sent it to won't be able to open it anymore.")) return;
    try { await stopShare(token, shareToken); say("Link turned off"); } catch (e: any) { say(e?.message || "Could not turn the link off."); }
  };
  return <Panel eyebrow="Sharing" title="Shared links">
    <p className="text-sm leading-6 text-slate-500">Links you've sent to family. Anyone with a link can see that one part (or vote in that poll) without an account, as it is right now. Turn a link off and it stops working.</p>
    {!loadedAt ? <div className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 size={15} className="animate-spin" /> Loading…</div>
      : error ? <p className="mt-3 text-sm font-semibold text-rose-600">{error}</p>
      : shares.length ? <ul className="mt-3 divide-y divide-slate-100" data-testid="todo-shared-links">{shares.map((s) => <li key={s.token} className="flex items-center gap-2 py-2.5">
        <Link2 size={15} className="shrink-0 text-violet-500" />
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{s.label}</span><span className="text-xs text-slate-400">Made {new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span>
        <button type="button" onClick={() => copy(s.url, s.label)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-violet-50 hover:text-violet-700" aria-label={`Copy link: ${s.label}`}><Copy size={15} /></button>
        <button type="button" onClick={() => stop(s.token)} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Turn off link: ${s.label}`}><Link2Off size={15} /></button>
      </li>)}</ul>
      : <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500">No links yet. Look for <b>Share link</b> on polls, lists, the calendar, bills, trips, chores, goals and food &amp; fitness.</p>}
  </Panel>;
}
