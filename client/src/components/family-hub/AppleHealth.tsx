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
  const [way, setWay] = useState<"app" | "shortcut">("app");
  const link = key ? `${syncAddress()}?key=${key}` : "";
  const make = async () => {
    setBusy(true); setError("");
    try { setKey(await makeHealthKey(token, member.id)); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  const step = (n: number, title: string, body?: ReactNode) => <li className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-xs font-black text-white">{n}</span><div className="min-w-0 flex-1 pt-0.5"><p className="text-sm font-black text-slate-800">{title}</p>{body && <div className="mt-1 space-y-2 text-sm leading-6 text-slate-600">{body}</div>}</div></li>;
  return <Modal title="Connect Apple Health" eyebrow="Food & fitness" onClose={onClose} wide>
    <div className="rounded-2xl bg-violet-50 p-4">
      <p className="text-sm font-black text-violet-900">Your personal sync link</p>
      <p className="mt-1 text-xs text-violet-800">It's the only thing you'll paste. It sends to {member.id === "me" ? "your" : `${member.name}'s`} diary only, and can't read anything.</p>
      <div className="mt-3">{key ? <CopyField label="Sync link" value={link} /> : <><button onClick={() => void make()} disabled={busy} className={primary}>{busy ? "Making…" : "Make my link"}</button>{error && <p className="mt-2 text-xs text-rose-600">{error}</p>}</>}</div>
      {key && <p className="mt-2 text-[11px] font-semibold text-violet-800">Shown once. Making a new link turns this one off.</p>}
    </div>

    <div className="mt-5 inline-flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
      <button onClick={() => setWay("app")} aria-pressed={way === "app"} className={`min-h-9 rounded-lg px-3 ${way === "app" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>Easiest: an app (2 min)</button>
      <button onClick={() => setWay("shortcut")} aria-pressed={way === "shortcut"} className={`min-h-9 rounded-lg px-3 ${way === "shortcut" ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>Free: Apple Shortcuts</button>
    </div>

    {way === "app" ? <ol className="mt-5 space-y-5">
      {step(1, "Get “Health Auto Export” from the App Store", <p>On your iPhone, search the App Store for <b>Health Auto Export – JSON+CSV</b> and install it. Allow it to read <b>Steps</b>, <b>Active Energy</b> and <b>Weight</b> when it asks.</p>)}
      {step(2, "Add an automation", <p>In the app, tap <b>Automations</b> → <b>+</b> → <b>REST API</b>.</p>)}
      {step(3, "Paste your sync link", <p>Paste the link above into <b>URL</b>. Keep the format <b>JSON</b>. Under Health Metrics, pick <b>Step Count</b>, <b>Active Energy</b> and <b>Weight &amp; Body Mass</b>. Set the export period to <b>Since last sync</b> (or Today) and turn the automation <b>on</b>.</p>)}
      {step(4, "Send a test", <p>Tap <b>Manual Export</b> once. Then tap <b>Check now</b> here: your steps should appear. After that it syncs on its own in the background.</p>)}
      <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">Health Auto Export is made by another company, not by A.R.I.S.E. or Apple. Automatic syncing may need its paid upgrade; check the App Store listing for current pricing.</p>
    </ol> : <ol className="mt-5 space-y-5">
      {step(1, "Open Shortcuts and tap +", <p>Name the new shortcut <b>ARISE Health Sync</b>.</p>)}
      {step(2, "Add today's numbers", <p>Add <b>Find Health Samples</b> (Type <b>Steps</b>, Start Date <b>is today</b>) then <b>Calculate Statistics → Sum</b>. Do the same with Type <b>Active Energy</b>.</p>)}
      {step(3, "Send them", <p>Add <b>Get Contents of URL</b>, paste your sync link, tap <b>Show More</b>, set Method <b>POST</b> and Request Body <b>JSON</b> with two fields: <b>steps</b> and <b>activeCalories</b>, each set to its Statistics result. That's it; no date or key needed.</p>)}
      {step(4, "Make it automatic", <p>In <b>Automation</b> → <b>+</b> → <b>Time of Day</b> (like 9:00 PM, Daily, Run Immediately) → run <b>ARISE Health Sync</b>.</p>)}
    </ol>}

    <p className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs leading-5 text-slate-600">Steps fill in your step count, active calories show as “Apple Health activity” under Exercise (don't log watch-tracked workouts again), and weight goes into your weigh-ins. Prefer not to connect? You can always type steps and weight in yourself.</p>
    <button onClick={onClose} className={primary + " mt-5 w-full"}>Done</button>
  </Modal>;
}
