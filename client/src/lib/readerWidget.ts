// Home Screen and Lock Screen widgets for the Arise Reader iPhone app
// (reader/ios-app/widgets, added to the app by .github/scripts/reader_widgets.py and .rb).
// The app hands the widget a small snapshot: the reader's first name, points, quizzes passed and
// grade band. iOS shows it until the next snapshot. Nothing happens on the website, in an app
// build without widgets, or in the Educator and Arise AAC apps.
import { isReaderApp, nativeCall, nativeFlavor } from "@/lib/nativeApp";

export type ReaderWidgetSnapshot = { name: string; points: number; quizzes: number; band: string };

let last = "";
let timer: ReturnType<typeof setTimeout> | null = null;

/** The snapshot as the widget reads it (also used by the tests). */
export function widgetJson(s: ReaderWidgetSnapshot | null, now = Date.now()): string {
  if (!s) return JSON.stringify({ signedOut: true, at: now });
  const first = String(s.name || "").trim().split(/\s+/)[0]?.slice(0, 24) || "Reader";
  return JSON.stringify({
    name: first,
    points: Math.max(0, Math.round(Number(s.points) || 0)),
    quizzes: Math.max(0, Math.round(Number(s.quizzes) || 0)),
    band: String(s.band || "").slice(0, 16),
    at: now,
  });
}

/** Sends a new snapshot to the widget, at most once a second and only when it changed. */
export function updateReaderWidget(s: ReaderWidgetSnapshot | null): void {
  if (!isReaderApp() || nativeFlavor() !== "reader") return;
  const key = widgetJson(s, 0);
  if (key === last) return;
  last = key;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    void nativeCall(/ReaderWidget/i, "ReaderWidget", "save", { data: widgetJson(s) }).catch(() => { last = ""; });
  }, 1000);
}
