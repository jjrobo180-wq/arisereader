// Home Screen and Lock Screen widgets in the iPhone apps. An app hands over "slots", one per widget
// (native/arise-widgets saves them and the widget extension draws them; each slot is a simple widget and a
// detailed one). Slots are saved by id, so different parts of an app can each send their own. Outside an
// iPhone app build that has the plugin, nothing happens, so it's safe to call from anywhere.
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

export type WidgetAction = { label: string; action: string; amount: number };
export type WidgetSlot = {
  /** Which widget this feeds ("fit.water"). The app's widget list (add_widget.rb arguments in the workflow) names the ids. */
  id: string;
  title: string;
  value: string;
  detail?: string;
  /** "#rrggbb" */
  tint?: string;
  /** Milliseconds since 1970: the widget counts down to this moment instead of showing `value`. */
  until?: number;
  /** 0 to 1: a ring. */
  progress?: number;
  /** More lines for the detailed widgets. */
  lines?: string[];
  /** Buttons that work from the widget; the app gets them back through takeWidgetActions. */
  actions?: WidgetAction[];
  /** A running total the buttons add to, and what it's out of. */
  current?: number;
  goal?: number;
  unit?: string;
  /** A web address the widget shows as a QR code (the Link page widget). */
  qr?: string;
  /** Things to check off right on the widget (the ".check" checklist widgets); taps come back with `item`. */
  items?: { id: string; text: string }[];
  /** Where a tap on the widget goes: an app link ("arisetodo://open?s=calendar"). Left out, the app just opens. */
  open?: string;
  /** For each of `lines`, where a tap on that line goes (the Link page widget: each link). Same rules as `open`. */
  urls?: string[];
};

/** A link a widget may open: the app's own scheme (arisetodo://…) or a web address. */
export const widgetLinkOk = (v: unknown): v is string => typeof v === "string" && /^(?:[a-z][a-z0-9+.-]{1,30}:\/\/)[^\s"<>]{0,600}$/i.test(v) && !/^(?:javascript|data|file):/i.test(v);
/** A tap on a widget: a button (`action`, `amount`) or a checklist circle (`action` "check", `item` its id). */
export type WidgetTap = { id: string; action: string; amount: number; at: number; item?: string };

const PLUGIN = /arise.?widgets/i;
const sent = new Map<string, string>();

const text = (v: unknown, n: number) => String(v ?? "").slice(0, n);

/** Fixes what a widget will show: short text, valid numbers. */
export function cleanSlots(slots: WidgetSlot[]): WidgetSlot[] {
  return slots.filter((s) => s && /^[a-z0-9.\-_]{1,40}$/i.test(s.id)).slice(0, 40).map((s) => ({
    id: s.id,
    title: text(s.title, 28),
    value: text(s.value, 18),
    ...(s.detail ? { detail: text(s.detail, 60) } : {}),
    ...(/^#[0-9a-f]{6}$/i.test(s.tint ?? "") ? { tint: s.tint } : {}),
    ...(Number.isFinite(s.until) && (s.until as number) > 0 ? { until: Math.round(s.until as number) } : {}),
    ...(Number.isFinite(s.progress) ? { progress: Math.min(1, Math.max(0, s.progress as number)) } : {}),
    ...(s.lines?.length ? { lines: s.lines.slice(0, 8).map((l) => text(l, 60)) } : {}),
    ...(s.actions?.length ? { actions: s.actions.slice(0, 3).map((a) => ({ label: text(a.label, 12), action: text(a.action, 24), amount: Number(a.amount) || 0 })) } : {}),
    ...(Number.isFinite(s.current) ? { current: s.current } : {}),
    ...(Number.isFinite(s.goal) ? { goal: s.goal } : {}),
    ...(s.unit ? { unit: text(s.unit, 8) } : {}),
    ...(typeof s.qr === "string" && /^https:\/\/[^\s]{4,300}$/.test(s.qr) ? { qr: s.qr } : {}),
    ...(widgetLinkOk(s.open) ? { open: s.open } : {}),
    ...(Array.isArray(s.urls) && s.urls.length ? { urls: s.urls.slice(0, 8).map((u) => (widgetLinkOk(u) ? u : "")) } : {}),
    ...(Array.isArray(s.items) ? { items: s.items.filter((i) => i && /^[\w.:@\-]{1,120}$/.test(String(i.id))).slice(0, 12).map((i) => ({ id: String(i.id), text: text(i.text, 60) })) } : {}),
  }));
}

export function publishWidgets(slots: WidgetSlot[]): void {
  if (!isNativeApp() || !hasNativePlugin(PLUGIN)) return;
  const fresh = cleanSlots(slots).filter((s) => { const j = JSON.stringify(s); if (sent.get(s.id) === j) return false; sent.set(s.id, j); return true; });
  if (!fresh.length) return;
  void nativeCall(PLUGIN, "AriseWidgets", "publish", { slots: fresh }).catch(() => { for (const s of fresh) sent.delete(s.id); });
}

/** Taps on widget buttons since the app last asked. */
export async function takeWidgetActions(): Promise<WidgetTap[]> {
  if (!isNativeApp() || !hasNativePlugin(PLUGIN)) return [];
  try {
    const r = await nativeCall(PLUGIN, "AriseWidgets", "takeActions");
    const taps: WidgetTap[] = Array.isArray(r?.actions) ? r.actions.filter((a: any) => a && typeof a.id === "string").map((a: any) => ({ id: a.id, action: String(a.action), amount: Number(a.amount) || 0, at: Number(a.at) || Date.now(), ...(typeof a.item === "string" && a.item ? { item: a.item } : {}) })) : [];
    // The widget already changed what it shows (a checked item is gone): send the slot again next time, even if
    // the app's own copy of it looks the same.
    for (const t of taps) sent.delete(t.id);
    return taps;
  } catch { return []; }
}

/** Calls `handle` with widget taps now, whenever the app comes back to the front, and every minute it's open. */
export function watchWidgetActions(handle: (taps: WidgetTap[]) => void): () => void {
  if (!isNativeApp() || !hasNativePlugin(PLUGIN)) return () => {};
  const run = () => { void takeWidgetActions().then((t) => { if (t.length) handle(t); }); };
  run();
  const timer = window.setInterval(run, 60_000);
  const visible = () => { if (document.visibilityState === "visible") run(); };
  document.addEventListener("visibilitychange", visible);
  return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", visible); };
}

let badgeSent = -1;
/** The number on the app's icon (the Rise Score's things left today); 0 clears it. Only on the iPhone app. */
export async function setAppBadge(count: number): Promise<void> {
  const n = Math.max(0, Math.min(999, Math.round(Number(count) || 0)));
  if (n === badgeSent || !isNativeApp() || !hasNativePlugin(PLUGIN)) return;
  badgeSent = n;
  try { await nativeCall(PLUGIN, "AriseWidgets", "setBadge", { count: n }); } catch { badgeSent = -1; }
}
