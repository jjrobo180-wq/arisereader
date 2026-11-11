// Apple Health for the Food & fitness diary: connected right inside the Arise To Duo iPhone app
// (lib/nativeHealth.ts reads HealthKit), then synced days are pulled in here on every device.
import { useCallback, useEffect, useState } from "react";
import { HeartPulse, Link2Off, RefreshCw, Smartphone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { healthStatus, removeHealthLink, type HealthLink } from "@/lib/appleHealth";
import { askHealthPermission, forgetNativeHealth, hasNativeHealthKey, nativeHealthAvailable, syncNativeHealth } from "@/lib/nativeHealth";
import { applySync } from "@shared/appleHealth";
import type { Health, Member } from "@shared/familyHub";
import { Panel, danger, plain, primary, soft } from "./ui";

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
    nativeAutoSync(token)
      .then(() => healthStatus(token))
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

/** In the iPhone app: send fresh Apple Health numbers for everyone connected on this phone, at most every 10 minutes. */
let lastNativeSync = 0;
async function nativeAutoSync(token: string): Promise<void> {
  if (!nativeHealthAvailable() || Date.now() - lastNativeSync < 10 * 60_000) return;
  lastNativeSync = Date.now();
  let keys: string[] = [];
  try { keys = Object.keys(localStorage); } catch { return; }
  const members = keys.filter((k) => k.startsWith("arise_native_health_key:")).map((k) => k.slice("arise_native_health_key:".length));
  for (const memberId of members) await syncNativeHealth(token, memberId, 7).catch(() => { /* the panel shows status */ });
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
  const link = apple.links.find((l) => l.memberId === member.id);
  const inApp = nativeHealthAvailable();
  const [syncing, setSyncing] = useState(false);
  // What the last try on this iPhone said, kept on screen (a toast disappears before it can be read).
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const connectInApp = async () => {
    setSyncing(true); setResult(null);
    try {
      await askHealthPermission();
      // The link is made first, so this person shows as connected even before Health has numbers to share.
      const text = await syncNativeHealth(token, member.id, 30);
      setResult({ ok: true, text }); say(text);
    } catch (e: any) {
      const text = String(e?.message || e || "Apple Health didn't answer. Try again.");
      setResult({ ok: false, text }); say(text);
    } finally { setSyncing(false); apple.check(); }
  };
  const disconnect = async () => {
    if (!window.confirm("Disconnect Apple Health? Your iPhone stops syncing. Numbers already synced stay in the diary.")) return;
    try { await removeHealthLink(token, member.id); forgetNativeHealth(member.id); apple.setLinks((l) => l.filter((x) => x.memberId !== member.id)); say("Apple Health disconnected"); }
    catch (e: any) { say(e.message); }
  };
  return <div data-plugin-anchor="apple-health"><Panel eyebrow="Apple Health" title={link ? "Connected" : "Connect Apple Health"} right={<HeartPulse size={18} className="text-rose-500" />}>
    {link ? <>
      <p className="text-sm text-slate-600">Steps, active calories and weight come in from Apple Health. <span className="font-semibold text-slate-700">{ago(link.lastSyncAt)}.</span></p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={apple.check} className={soft + " min-h-9 text-xs"} disabled={apple.checking}><RefreshCw size={14} className={apple.checking ? "animate-spin" : ""} /> Check now</button>
        {inApp && <button onClick={() => void connectInApp()} className={plain + " min-h-9 text-xs"} disabled={syncing}>{syncing ? "Syncing…" : hasNativeHealthKey(member.id) ? "Sync from this iPhone" : "Use this iPhone instead"}</button>}
        <button onClick={() => void disconnect()} className={danger + " min-h-9 text-xs"}><Link2Off size={14} /> Disconnect</button>
      </div>
    </> : inApp ? <>
      <p className="text-sm text-slate-600">Bring in steps, active calories and weight from your iPhone and Apple Watch automatically. iOS will ask which data to share; turn them all on.</p>
      <button onClick={() => void connectInApp()} disabled={syncing} className={primary + " mt-3 w-full"} data-testid="apple-health-connect"><HeartPulse size={16} /> {syncing ? "Connecting…" : "Connect Apple Health"}</button>
    </> : <div className="flex items-start gap-3 rounded-2xl bg-rose-50 p-3.5" data-testid="apple-health-open-app">
      <Smartphone size={20} className="mt-0.5 shrink-0 text-rose-500" />
      <p className="text-sm leading-6 text-slate-700">Apple Health connects in the <b>Arise To Duo iPhone app</b>. Open it on your iPhone, come to this screen and tap <b>Connect Apple Health</b>. Steps, active calories and weight then sync here on their own.</p>
    </div>}
    {result && <p role="status" className={`mt-2 rounded-xl px-3 py-2 text-xs font-semibold ${result.ok ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} data-testid="apple-health-result">{result.text}</p>}
    {apple.error && <p className="mt-2 text-xs text-amber-700">{apple.error}</p>}
  </Panel></div>;
}
