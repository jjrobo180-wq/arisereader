// Forward emails into Arise LifeHub: each forwarded email becomes a task in the "Email" list.
// Same forwarding system as the Arise WorkHub (server/hubInbox.ts), under /api/arise-todo/inbox.
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Mail, RefreshCw } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import type { InboxItem } from "@shared/hubInbox";
import { inputClass, plain, primary } from "./ui";

type View = { ready: boolean; address: string | null; senders: string[]; anyone: boolean; waiting: InboxItem[] };
async function call(token: string | null, path: string, init: RequestInit = {}): Promise<any> {
  const r = await fetch(`${API_BASE}/api/arise-todo/inbox${path}`, { ...init, cache: "no-store", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" } });
  const b = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(b.message || "That did not work. Please try again.");
  return b;
}

/** While LifeHub is open: picks up forwarded emails when it opens, every minute, and when the page comes back into view. */
export function useEmailInbox(token: string | null, enabled: boolean, onEmails: (items: InboxItem[]) => void) {
  const latest = useRef(onEmails);
  latest.current = onEmails;
  useEffect(() => {
    if (!token || !enabled) return;
    let stopped = false, busy = false;
    const check = async () => {
      if (busy || stopped) return;
      busy = true;
      try {
        const v: View = await call(token, "");
        const waiting = Array.isArray(v.waiting) ? v.waiting : [];
        if (!waiting.length || stopped) return;
        latest.current(waiting);
        await call(token, "/taken", { method: "POST", body: JSON.stringify({ ids: waiting.map((x) => x.id) }) });
      } catch { /* tried again in a minute */ } finally { busy = false; }
    };
    void check();
    const timer = setInterval(() => void check(), 60_000);
    const onShow = () => { if (document.visibilityState === "visible") void check(); };
    document.addEventListener("visibilitychange", onShow);
    return () => { stopped = true; clearInterval(timer); document.removeEventListener("visibilitychange", onShow); };
  }, [token, enabled]);
}

export function EmailForwardCard({ token }: { token: string | null }) {
  const [view, setView] = useState<View | null>(null);
  const [senders, setSenders] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [copied, setCopied] = useState(false);
  const load = () => call(token, "").then((v: View) => { setView(v); setSenders(v.senders.join(", ")); }).catch((e) => setNote(e.message));
  useEffect(() => { void load(); }, [token]);
  const run = async (work: () => Promise<unknown>, done: string) => { setBusy(true); setNote(""); try { await work(); await load(); setNote(done); } catch (e: any) { setNote(e.message); } finally { setBusy(false); } };

  return <section className="rounded-[1.5rem] border border-[#e7e8f0] bg-white p-5">
    <div className="flex items-center gap-2"><Mail size={18} className="text-violet-600" /><h3 className="text-sm font-extrabold">Forward emails here</h3></div>
    {!view ? <p className="mt-2 text-xs text-slate-500">{note || "Loading…"}</p> : !view.ready ? <p className="mt-2 text-xs leading-5 text-slate-500">Email forwarding isn't switched on for the site yet. The site admin can turn it on in the Arise WorkHub's email setup.</p> : <>
      <p className="mt-2 text-xs leading-5 text-slate-500">Forward any email (a bill, a school flyer, an appointment) to your private address and it shows up as a task in your “Email” list.</p>
      {view.address ? <div className="mt-3 flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold">{view.address}</code>
        <button onClick={() => { void navigator.clipboard?.writeText(view.address!).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }} className={plain} aria-label="Copy address">{copied ? <Check size={15} /> : <Copy size={15} />}</button></div>
        : <button onClick={() => void run(() => call(token, "/address", { method: "POST" }), "Your address is ready.")} disabled={busy} className={primary + " mt-3 w-full"}>Get my forwarding address</button>}
      {view.address && <>
        <label className="mt-3 block text-[11px] font-bold text-slate-600">Accept emails forwarded from<input value={senders} onChange={(e) => setSenders(e.target.value)} placeholder="you@gmail.com, partner@gmail.com" className={inputClass + " mt-1 min-h-10"} /></label>
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => void run(() => call(token, "/senders", { method: "PUT", body: JSON.stringify({ senders: senders.split(/[,\s]+/).filter(Boolean), anyone: false }) }), "Saved.")} disabled={busy} className={plain + " min-h-9 text-xs"}>Save senders</button>
          <button onClick={() => { if (window.confirm("Make a new address? The old one stops working right away.")) void run(() => call(token, "/address", { method: "POST" }), "New address ready."); }} disabled={busy} className={plain + " min-h-9 text-xs"}><RefreshCw size={13} /> New address</button>
        </div>
        <p className="mt-2 text-[11px] text-slate-400">Only emails forwarded from these addresses are accepted, so strangers can't fill your list.</p>
      </>}
      {note && <p className="mt-2 text-xs font-semibold text-violet-700">{note}</p>}
    </>}
  </section>;
}
