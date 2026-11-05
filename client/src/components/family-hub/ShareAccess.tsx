// "Share full access": one link to send to a husband, wife or anyone you trust. When they open it and sign
// in (or make an account), they see every app you share, Potty Training included, and can log in the ones
// that allow it. The link works once. Stopping is one tap in Linked profiles. See server/profileLinks.ts.
import { useMemo, useState } from "react";
import { Check, Copy, Link2, Loader2, Share2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { joinUrl, linksApi } from "@/lib/profileLinks";
import { sendLink } from "@/lib/todoShares";
import { Modal, plain, primary } from "./ui";

export default function ShareAccess({ name, onClose, say }: { name: string; onClose: () => void; say: (m: string) => void }) {
  const { token } = useAuth();
  const api = useMemo(() => linksApi(token), [token]);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const who = name.trim() || "them";

  const make = async () => {
    setBusy(true);
    try { const r = await api.makeLink(name.trim()); setUrl(joinUrl(r.token)); }
    catch (e: any) { say(e.message || "The link couldn't be made. Try again."); }
    finally { setBusy(false); }
  };
  const send = async () => {
    const how = await sendLink(url, "Join me on Arise To Duo");
    if (how === "cancelled") return;
    setCopied(true); window.setTimeout(() => setCopied(false), 2500);
    say(how === "copied" ? "Link copied. Send it to them." : "Link ready.");
  };

  return <Modal title={`Share with ${who}`} eyebrow="Full access" onClose={onClose}>
    <div className="space-y-4" data-testid="share-access">
      <p className="flex gap-3 text-sm leading-6 text-slate-600"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-violet-600" />
        <span>One link gives {who} everything: Potty Training, medications, sleep, water and every other app you use, which they can log in, plus your calendar, to-dos and the rest to look at. It works once, on their own account.</span></p>
      {!url
        ? <button type="button" onClick={() => void make()} disabled={busy} className={primary + " min-h-12 w-full"} data-testid="share-access-make">{busy ? <Loader2 size={17} className="animate-spin" /> : <Link2 size={17} />} Make the link</button>
        : <>
          <p className="break-all rounded-xl bg-slate-100 px-3 py-2.5 text-xs font-semibold text-slate-700" data-testid="share-access-url">{url}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => void send()} className={primary + " min-h-12 flex-1"} data-testid="share-access-send">{copied ? <Check size={17} /> : <Share2 size={17} />} Send it</button>
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(url); say("Link copied"); } catch { window.prompt("Copy this link:", url); } }} className={plain + " min-h-12 px-4"} aria-label="Copy the link"><Copy size={17} /></button>
          </div>
          <p className="text-xs text-slate-500">Only send it to {who}. You can change what they see, or stop sharing, any time in Linked profiles.</p>
        </>}
      <button type="button" onClick={onClose} className={plain + " w-full"}>{url ? "Done" : "Not now"}</button>
    </div>
  </Modal>;
}
