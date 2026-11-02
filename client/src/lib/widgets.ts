// Home Screen and Lock Screen widgets in the iPhone apps. An app hands over up to three "slots", one per
// widget (native/arise-widgets saves them and the widget extension draws them). Outside an iPhone app
// build that has the plugin, nothing happens, so it's safe to call from anywhere.
import { hasNativePlugin, isNativeApp, nativeCall } from "@/lib/nativeApp";

export type WidgetSlot = {
  title: string;
  value: string;
  detail?: string;
  /** "#rrggbb" */
  tint?: string;
  /** Milliseconds since 1970: the widget counts down to this moment instead of showing `value`. */
  until?: number;
  /** 0 to 1: a ring. */
  progress?: number;
};

const PLUGIN = /arise.?widgets/i;
let last = "";

/** Fixes what the widgets will show: at most three slots, short text. */
export function cleanSlots(slots: WidgetSlot[]): WidgetSlot[] {
  return slots.slice(0, 3).map((s) => ({
    title: String(s.title ?? "").slice(0, 28),
    value: String(s.value ?? "").slice(0, 16),
    ...(s.detail ? { detail: String(s.detail).slice(0, 48) } : {}),
    ...(/^#[0-9a-f]{6}$/i.test(s.tint ?? "") ? { tint: s.tint } : {}),
    ...(Number.isFinite(s.until) && (s.until as number) > 0 ? { until: Math.round(s.until as number) } : {}),
    ...(Number.isFinite(s.progress) ? { progress: Math.min(1, Math.max(0, s.progress as number)) } : {}),
  }));
}

export function publishWidgets(slots: WidgetSlot[]): void {
  if (!isNativeApp() || !hasNativePlugin(PLUGIN)) return;
  const clean = cleanSlots(slots);
  const json = JSON.stringify(clean);
  if (json === last) return;
  last = json;
  void nativeCall(PLUGIN, "AriseWidgets", "publish", { slots: clean }).catch(() => { last = ""; });
}
