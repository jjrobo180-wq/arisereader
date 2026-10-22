// The first-sign-in welcome: a pop-up that explains, in plain steps, how to put A.R.I.S.E. on the Home Screen
// and turn on notifications, then a small bar at the bottom that says it once more and goes away for good.
// The wording and the rules for when each shows live here so they can be tested; the page is
// client/src/components/WelcomeGuide.tsx.

export type Device = "ios" | "android" | "desktop";

export function deviceOf(userAgent: string, platform = "", touchPoints = 0): Device {
  if (/iPhone|iPad|iPod/i.test(userAgent) || (platform === "MacIntel" && touchPoints > 1)) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  return "desktop";
}

/** The steps for putting the app on the Home Screen (or desktop), in the order to do them. */
export const HOME_STEPS: Record<Device, string[]> = {
  ios: [
    "Tap the Share button, the square with an arrow pointing up, at the bottom of Safari.",
    "Scroll down and tap “Add to Home Screen”.",
    "Tap “Add”. A.R.I.S.E. now sits on your Home Screen like any other app.",
  ],
  android: [
    "Tap the ⋮ menu at the top right of your browser.",
    "Tap “Install app” or “Add to Home screen”.",
    "Tap “Install” (or “Add”). A.R.I.S.E. now sits on your Home Screen like any other app.",
  ],
  desktop: [
    "Click the install icon at the right end of the address bar (a screen with a down arrow).",
    "Click “Install”. A.R.I.S.E. opens in its own window with a shortcut on your computer.",
  ],
};

/** A small extra line under the steps. */
export const HOME_NOTE: Record<Device, string> = {
  ios: "Don’t see it? Open this page in Safari first.",
  android: "",
  desktop: "Using Safari? Choose File → Add to Dock instead.",
};

export const NOTIFY_LINES: Record<Device, { ready: string; needsApp?: string }> = {
  ios: {
    ready: "Tap the button below and choose Allow.",
    needsApp: "On iPhone and iPad, notifications work from the Home Screen app. Add it first, open A.R.I.S.E. from your Home Screen, and sign in. This welcome comes up again there with a Turn on notifications button.",
  },
  android: { ready: "Tap the button below and choose Allow." },
  desktop: { ready: "Click the button below and choose Allow." },
};

/** What the browser remembers about this person's welcome. */
export type WelcomeState = {
  /** The pop-up was closed. */
  seen: boolean;
  /** When the bottom bar first showed. It stays up for BAR_MS from then and never comes back. */
  barAt: number;
  /** The bar was closed by hand. */
  barClosed: boolean;
};

export const BAR_MS = 15_000;
export const FRESH: WelcomeState = { seen: false, barAt: 0, barClosed: false };

export function parseWelcome(raw: unknown): WelcomeState {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!value || typeof value !== "object") return { ...FRESH };
    const v = value as Record<string, unknown>;
    const barAt = Number(v.barAt);
    return { seen: v.seen === true, barAt: Number.isFinite(barAt) && barAt > 0 ? barAt : 0, barClosed: v.barClosed === true };
  } catch {
    return { ...FRESH };
  }
}

export const showPopup = (state: WelcomeState) => !state.seen;

/** Closing the pop-up starts the bar's clock (only the first time). */
export const closePopup = (state: WelcomeState, now: number): WelcomeState =>
  ({ seen: true, barAt: state.barAt || now, barClosed: state.barClosed });

export const closeBar = (state: WelcomeState): WelcomeState => ({ ...state, barClosed: true });

/** How long the bar still has to show: 0 means it is gone for good. */
export function barLeftMs(state: WelcomeState, now: number): number {
  if (!state.seen || !state.barAt || state.barClosed) return 0;
  return Math.max(0, Math.min(BAR_MS, state.barAt + BAR_MS - now));
}

/** The words on the bar for this device. */
export const BAR_TEXT: Record<Device, string> = {
  ios: "Tip: tap Share → Add to Home Screen, then open A.R.I.S.E. from there and turn on notifications.",
  android: "Tip: tap ⋮ → Install app, then turn on notifications.",
  desktop: "Tip: install A.R.I.S.E. from the address bar and turn on notifications.",
};
