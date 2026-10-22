// "Support A.R.I.S.E.": the donation button and banner shown to parents and on the Reader home page.
// The link itself is the one saved in Admin → Donation goal ("Donation link"), usually a Stripe
// Payment Link. It is shown even when the library's goal bar is switched off, because asking for
// support and showing a fundraising thermometer are two different things.
//
// Kept deliberately gentle: the button sits quietly in the header, and the banner on Home can be
// closed and then stays away for a month. Nothing here pops up on its own or blocks anything.

/** Mr. J's Stripe donation link. Used until a different one is saved in Admin → Donation goal. */
export const DEFAULT_DONATE_URL = "https://buy.stripe.com/7sY6oHbUD7qrfwf3UFcIE04";

/** How long the Home banner stays hidden after someone closes it. */
export const SUPPORT_BANNER_SNOOZE_DAYS = 30;
/** Where the closed-at time is kept on this device. */
export const SUPPORT_BANNER_KEY = "arise_support_banner_closed_at";

/** Only real https web addresses, so a saved value can never become a javascript: link. */
export function isDonateUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 500) return false;
  try {
    const u = new URL(value.trim());
    return u.protocol === "https:" && !!u.hostname && u.hostname.includes(".");
  } catch {
    return false;
  }
}

/** Is this a Stripe address (so the button can say "Secure checkout with Stripe")? */
export function isStripeUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === "stripe.com" || host.endsWith(".stripe.com");
  } catch {
    return false;
  }
}

export type DonateInfo = {
  url: string;
  stripe: boolean;
  /** The library's goal, only when it is switched on in Admin: how much is raised out of how much. */
  goal: { raised: number; target: number } | null;
};

/** What the public can see from the saved donation settings: the link (if any) and, when switched on, the goal. */
export function donateInfoFrom(raw: unknown, fallbackUrl: string = DEFAULT_DONATE_URL): DonateInfo | null {
  let data: any = raw;
  if (typeof raw === "string") {
    try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  }
  if (!data || typeof data !== "object") data = {};
  const saved = typeof data.donateUrl === "string" ? data.donateUrl.trim() : "";
  const url = isDonateUrl(saved) ? saved : fallbackUrl;
  if (!isDonateUrl(url)) return null;
  const target = Number(data.goalAmount), raised = Number(data.currentAmount);
  const goal = data.active === true && Number.isFinite(target) && target > 0
    ? { raised: Math.max(0, Number.isFinite(raised) ? raised : 0), target }
    : null;
  return { url, stripe: isStripeUrl(url), goal };
}

/** Should the Home banner show? Not when it was closed less than a month ago. */
export function supportBannerVisible(closedAt: string | null | undefined, nowMs: number): boolean {
  if (!closedAt) return true;
  const at = Date.parse(closedAt);
  if (!Number.isFinite(at)) return true;
  return nowMs - at >= SUPPORT_BANNER_SNOOZE_DAYS * 24 * 3600 * 1000;
}
