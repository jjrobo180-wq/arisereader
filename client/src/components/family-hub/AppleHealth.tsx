// Apple Health for the Food & fitness diary: connect with an iPhone Shortcut, then pull synced days in.
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Check, Copy, HeartPulse, Link2Off, RefreshCw, Smartphone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { healthStatus, makeHealthKey, removeHealthLink, syncAddress, type HealthLink } from "@/lib/appleHealth";
import { applySync } from "@shared/appleHealth";
import type { Health, Member } from "@shared/familyHub";
import { Modal, Panel, danger, plain, primary, soft } from "./ui";

type AppleState = { links: HealthLink[]; checking: boolean; error: string; check: () => void; setLinks: (fn: (l: HealthLink[]) => HealthLink[]) => void };

/** Checks for synced Apple Health days when the page opens, every minute while it's visible, and on demand. */
export function useAppleHealth(setHealth: (fn: (h: Health) => Health) => void): AppleState {
  const { token } = useAuth();
  const [links, setLinksState] = useState<HealthLink[]>([]);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");
  const check = useCallback(() => {
    if (!token) return;
    setChecking(true);
    healthStatus(token)
      .then(({ links, days }) => {
        setLinksState(links); setError("");
        const linked = new Set(links.map((l) => l.memberId));
        const mine = days.filter((d) => linked.has(d.memberId));
        if (mine.length) setHealth((h) => applySync(h, mine));
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setChecking(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);
  useEffect(() => {
    check();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") check(); }, 60_000);
    const back = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", back);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", back); };
  }, [check]);
  return { links, checking, error, check, setLinks: (fn) => setLinksState(fn) };
}

const ago = (iso: string | null) => {
  if (!iso) return "waiting for the first sync";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 2) return "synced just now";
  if (mins < 60) return `synced ${mins} min ago`;
  const hours = Math.round(mins / 60);
  return hours < 36 ? `synced ${hours} hr ago` : `synced ${new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
};

export function AppleHealthPanel({ member, apple, say }: { member: Member; apple: AppleState; say: (m: string) => void }) {
  const { token } = useAuth();
  const [setup, setSetup] = useState(false);
  const link = apple.links.find((l) => l.memberId === member.id);
  const disconnect = async () => {
    if (!window.confirm("Disconnect Apple Health? The Shortcut will stop syncing. Numbers already synced stay in the diary.")) return;
    try { await removeHealthLink(token, member.id); apple.setLinks((l) => l.filter((x) => x.memberId !== member.id)); say("Apple Health disconnected"); }
    catch (e: any) { say(e.message); }
  };
  return <Panel eyebrow="Apple Health" title={link ? "Connected" : "Connect your iPhone"} right={<HeartPulse size={18} className="text-rose-500" />}>
    {link ? <>
      <p className="text-sm text-slate-600">Steps, active calories and weight come in from Apple Health. <span className="font-semibold text-slate-700">{ago(link.lastSyncAt)}.</span></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={apple.check} className={soft + " min-h-9 text-xs"} disabled={apple.checking}><RefreshCw size={14} className={apple.checking ? "animate-spin" : ""} /> Check now</button>
        <button onClick={() => setSetup(true)} className={plain + " min-h-9 text-xs"}>Set up again</button>
        <button onClick={() => void disconnect()} className={danger + " min-h-9 text-xs"}><Link2Off size={14} /> Disconnect</button>
      </div>
    </> : <>
      <p className="text-sm text-slate-600">Bring in steps, active calories and weight from your iPhone or Apple Watch every day, automatically.</p>
      <button onClick={() => setSetup(true)} className={primary + " mt-3 w-full"}><Smartphone size={16} /> Connect Apple Health</button>
    </>}
    {apple.error && <p className="mt-2 text-xs text-amber-700">{apple.error}</p>}
    {setup && <AppleSetup member={member} onClose={() => { setSetup(false); apple.check(); }} />}
  </Panel>;
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return <div><p className="mb-1 text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</p>
    <div className="flex gap-2"><code className="min-w-0 flex-1 break-all rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800">{value}</code>
      <button type="button" onClick={() => { void navigator.clipboard?.writeText(value).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500); }); }} className={plain + " shrink-0"} aria-label={`Copy ${label}`}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div></div>;
}

function AppleSetup({ member, onClose }: { member: Member; onClose: () => void }) {
  const { token } = useAuth();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const make = async () => {
    setBusy(true); setError("");
    try { setKey(await makeHealthKey(token, member.id)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const step = (n: number, title: string, body: ReactNode) => <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white">{n}</span><div className="min-w-0 flex-1 pt-0.5"><p className="text-sm font-black text-slate-800">{title}</p><div className="mt-1 space-y-2 text-sm leading-6 text-slate-600">{body}</div></div></li>;
  return <Modal title="Connect Apple Health" eyebrow="Food & fitness" onClose={onClose} wide>
    <p className="mb-5 text-sm text-slate-600">Websites can't open Apple Health directly, so you'll make a small Shortcut on your iPhone (Apple's free Shortcuts app) that sends today's numbers here. It takes about 5 minutes, once.</p>
    <ol className="space-y-6">
      {step(1, "Make your private key", key ? <>
        <CopyField label="Address" value={syncAddress()} />
        <CopyField label="Header value" value={`Bearer ${key}`} />
        <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">This key is shown only once. Keep this window open until the Shortcut is set up. Anyone with the key can send numbers to this diary (but can't read anything).</p>
      </> : <><p>The Shortcut uses it to send numbers to {member.id === "me" ? "your" : `${member.name}'s`} diary. Making a new key turns off any old one.</p>
        <button onClick={() => void make()} disabled={busy} className={primary}>{busy ? "Making…" : "Make my key"}</button>{error && <p className="text-xs text-rose-600">{error}</p>}</>)}
      {step(2, "On your iPhone, start a new Shortcut", <p>Open <b>Shortcuts</b>, tap <b>+</b>, and name it <b>ARISE Health Sync</b>.</p>)}
      {step(3, "Add today's steps", <p>Add the action <b>Find Health Samples</b>: Type <b>Steps</b>, Start Date <b>is today</b>. Then add <b>Calculate Statistics</b> and choose <b>Sum</b>.</p>)}
      {step(4, "Add today's active calories", <p>Add <b>Find Health Samples</b> again: Type <b>Active Energy</b>, Start Date <b>is today</b>. Then <b>Calculate Statistics</b> → <b>Sum</b>.</p>)}
      {step(5, "Add your latest weight (optional)", <p>Add <b>Find Health Samples</b>: Type <b>Weight</b>, Sort by <b>Start Date</b>, Order <b>Latest First</b>, Limit <b>1</b>. Then <b>Get Details of Health Samples</b> → <b>Value</b>.</p>)}
      {step(6, "Add today's date", <p>Add <b>Format Date</b>: Date <b>Current Date</b>, Format <b>Custom</b>, and type <code className="rounded bg-slate-100 px-1">yyyy-MM-dd</code>.</p>)}
      {step(7, "Send it to A.R.I.S.E.", <>
        <p>Add <b>Get Contents of URL</b>. Paste the <b>Address</b> from step 1, then tap <b>Show More</b>:</p>
        <ul className="list-disc space-y-1 pl-5"><li>Method: <b>POST</b></li><li>Headers: add one named <b>Authorization</b> with the <b>Header value</b> from step 1</li>
          <li>Request Body: <b>JSON</b>, with these fields (tap each value to pick the result from the step above it):
            <span className="mt-1 block font-mono text-xs">date → Formatted Date<br />steps → Statistics (steps)<br />activeCalories → Statistics (active energy)<br />weight → Value</span></li></ul>
        <p>Add <b>Show Notification</b> with <b>Contents of URL</b> so you can see it worked. Tap ▶ to run it once: you should see “Synced … steps”. Allow Health access when asked.</p>
      </>)}
      {step(8, "Run it automatically every day", <p>In Shortcuts, open <b>Automation</b> → <b>+</b> → <b>Time of Day</b>. Pick a time like <b>9:00 PM</b>, Daily, choose <b>Run Immediately</b>, and select <b>ARISE Health Sync</b>. You can add a second time (like noon) for updates during the day.</p>)}
    </ol>
    <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600"><b className="text-slate-800">How it shows up:</b> steps fill in your step count, active calories appear as “Apple Health activity” under Exercise (so don't log watch-tracked workouts again), and weight is added to your weigh-ins. Numbers sync for the day the Shortcut runs.</div>
    <button onClick={onClose} className={primary + " mt-5 w-full"}>Done</button>
  </Modal>;
}
