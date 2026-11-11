// The Arise Reader iPhone app's native side, so it works like an iPhone app and not a web page:
//   - Notifications from the server (a message from your teacher, being added to a class, a reward), on top
//     of the daily reading reminder the phone schedules itself (ReaderFirstRun.tsx).
//   - Home Screen quick actions (press and hold the icon: Library, Messages, Games, My profile),
//     which arrive as arisereader://go/<page> links (.github/scripts/reader_native.py).
//   - The Taptic Engine: a tap you feel when a quiz is passed or an answer picked.
import { hasNativePlugin, isNativeApp, nativeCall, nativeFlavor, nativeListen } from "@/lib/nativeApp";

export const isReaderPhoneApp = () => isNativeApp() && nativeFlavor() === "reader";

/** Library opens its inbox on this event, or when its link ends in ?inbox=1 (a quick action, a notification). */
export const OPEN_INBOX = "reader-open-inbox";

/** Where a quick action or an arisereader:// link goes (a hash route in the app), and whether the inbox opens. */
export function readerLinkRoute(url: string): { route: string; inbox: boolean } | null {
  const m = /^arisereader:\/\/(?:go\/)?([a-z0-9-]*)\/?$/i.exec(String(url || "").trim());
  if (!m) return null;
  const page = m[1].toLowerCase();
  const ROUTES: Record<string, string> = { "": "/library", home: "/library", library: "/library", messages: "/library?inbox=1", games: "/games", profile: "/profile" };
  const route = ROUTES[page];
  return route ? { route, inbox: page === "messages" } : null;
}

/** Goes to a quick action's page (Messages opens the inbox over the Library). */
export function openReaderLink(url: string): void {
  const r = readerLinkRoute(url);
  if (!r) return;
  window.location.hash = r.route;
  if (r.inbox) window.dispatchEvent(new Event(OPEN_INBOX));
}

let started = false;
/** Called once when the app opens: links and quick actions, and server notifications when already allowed. */
export function startReaderNative(): void {
  if (!isReaderPhoneApp() || started) return;
  started = true;
  if (hasNativePlugin(/^app$/i)) void nativeListen("App", "appUrlOpen", (e: { url?: string }) => openReaderLink(String(e?.url || "")));
  // Already allowed (from the first-run screen): sign this iPhone up again, quietly.
  void import("@/lib/applePush").then((m) => m.startApplePush(false));
}

/** The Taptic Engine (Capacitor's Haptics plugin), only in the Reader app, never an error. */
const haptic = (method: string, options: Record<string, string>) => {
  if (isReaderPhoneApp() && hasNativePlugin(/haptics/i)) void nativeCall(/haptics/i, "Haptics", method, options).catch(() => {});
};
/** Feel it: a success tap when a quiz is passed, a softer one otherwise. */
export function readerQuizFeel(passed: boolean): void { haptic("notification", { type: passed ? "SUCCESS" : "WARNING" }); }
/** A light tick when an answer is picked. */
export function readerTick(): void { haptic("impact", { style: "LIGHT" }); }
