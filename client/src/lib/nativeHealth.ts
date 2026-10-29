// Apple Health read directly inside the A.R.I.S.E. To-Do iPhone app (plugin: @capgo/capacitor-health).
// The website can't reach HealthKit, so this only works in the app. It sends the numbers to the same
// /api/arise-todo/apple-health/sync route the Shortcut uses, in the Health Auto Export format the
// server already understands — so the diary, the sync table and the "Check now" flow stay unchanged.
import { makeHealthKey } from "@/lib/appleHealth";

type Bridge = {
  PluginHeaders?: { name: string }[];
  nativePromise?: (plugin: string, method: string, options?: unknown) => Promise<any>;
  getPlatform?: () => string;
};
type Sample = { startDate: string; value: number; unit?: string };

const bridge = (): Bridge | null => (typeof window !== "undefined" ? ((window as any).Capacitor as Bridge) || null : null);
const pluginName = () => bridge()?.PluginHeaders?.find((h) => /health/i.test(h.name))?.name || "Health";
const call = (method: string, options?: unknown): Promise<any> => {
  const b = bridge();
  if (!b?.nativePromise) return Promise.reject(new Error("Apple Health works in the A.R.I.S.E. To-Do iPhone app."));
  return b.nativePromise(pluginName(), method, options).catch((e: any) => {
    const msg = String(e?.message || e || "");
    if (/not implemented|unimplemented|not available|plugin/i.test(msg)) {
      throw new Error("Apple Health isn't in this version of the app yet. Update A.R.I.S.E. To-Do in TestFlight, then try again.");
    }
    throw new Error(msg || "Apple Health didn't answer. Try again.");
  });
};

/** True inside the iPhone app. The plugin is asked directly; if a build lacks it, the call says so. */
export function nativeHealthAvailable(): boolean {
  return typeof window !== "undefined" && window.location.protocol === "capacitor:" && !!bridge()?.nativePromise;
}

const KEY_STORE = (memberId: string) => `arise_native_health_key:${memberId}`;
const store = {
  get: (memberId: string) => { try { return localStorage.getItem(KEY_STORE(memberId)); } catch { return null; } },
  set: (memberId: string, key: string) => { try { localStorage.setItem(KEY_STORE(memberId), key); } catch { /* sync just asks again */ } },
  drop: (memberId: string) => { try { localStorage.removeItem(KEY_STORE(memberId)); } catch { /* nothing kept */ } },
};
export const hasNativeHealthKey = (memberId: string) => !!store.get(memberId);
export const forgetNativeHealth = (memberId: string) => store.drop(memberId);

const READ = ["steps", "calories", "weight"];

/** Asks iOS for permission. iOS never says if reading was refused, so we just try to read after. */
export async function askHealthPermission(): Promise<void> {
  const ok = await call("isAvailable").catch(() => null);
  if (ok && ok.available === false) throw new Error(ok.reason || "Apple Health isn't available on this device.");
  await call("requestAuthorization", { read: READ, write: [] });
}

const localDay = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const pad = (d: Date) => `${localDay(d.toISOString())} 00:00:00`;

async function daily(dataType: string, aggregation: "sum" | "max", days: number): Promise<Sample[]> {
  const end = new Date(); end.setHours(24, 0, 0, 0);
  const start = new Date(end); start.setDate(start.getDate() - days);
  const res = await call("queryAggregated", { dataType, startDate: start.toISOString(), endDate: end.toISOString(), bucket: "day", aggregation }).catch(() => null);
  return Array.isArray(res?.samples) ? res.samples.filter((s: Sample) => Number.isFinite(s?.value) && s.value > 0) : [];
}

/** Reads the last `days` days and sends them to this person's diary. Makes the device's key the first time. */
export async function syncNativeHealth(token: string | null, memberId: string, days = 30): Promise<string> {
  let key = store.get(memberId);
  if (!key) { key = await makeHealthKey(token, memberId); store.set(memberId, key); }
  const [steps, active, weight] = await Promise.all([daily("steps", "sum", days), daily("calories", "sum", days), daily("weight", "max", days)]);
  const metric = (name: string, units: string, list: Sample[]) => ({ name, units, data: list.map((s) => ({ date: pad(new Date(s.startDate)), qty: s.value })) });
  const metrics = [
    metric("step_count", "count", steps),
    metric("active_energy", "kcal", active),
    metric("weight_body_mass", weight[0]?.unit && /pound|lb/i.test(weight[0].unit) ? "lb" : "kg", weight),
  ].filter((m) => m.data.length);
  if (!metrics.length) return "No steps, active calories or weight in Apple Health yet — or reading was turned off in Settings → Health → Data Access & Devices → A.R.I.S.E. To-Do.";
  const res = await fetch("/api/arise-todo/apple-health/sync", { method: "POST", cache: "no-store", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ data: { metrics } }) });
  const body = await res.json().catch(() => null);
  if (res.status === 401) { store.drop(memberId); throw new Error("The Health link was turned off. Tap Connect Apple Health again."); }
  if (!res.ok) throw new Error(body?.message || "Couldn't sync Apple Health right now.");
  return body?.message || "Apple Health synced.";
}
