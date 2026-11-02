// Arise Fit+: the paid tier of Arise Fit ($10 a month, shared/plans.ts's "fit_plus" kind), sold on
// the website only. Everything people already had in Arise Fit stays free; Fit+ adds the features
// below. Each paying account gets one guest pass: it shares Fit+ free with one other person, on their
// own account, for as long as the payer keeps paying. A guest can't give a pass of their own (they
// aren't paying), and a payer can switch who has their pass once every 30 days.
// Server: server/fitPass.ts (guest passes and who has Fit+), server/plans.ts (checkout and billing).
// App: client/src/pages/fit/FitPlus.tsx.

export const FIT_PLUS_PRICE = "$10/month";
export const PLUS_REQUIRED = "fit_plus_required";
/** How long after a guest leaves (or is removed) before the pass can go to someone else. */
export const PASS_SWITCH_DAYS = 30;

export type PlusFeature = "photo-scan" | "camera-reps" | "debrief" | "gyms" | "eat-out" | "ai-recipes" | "guest-pass";
export const PLUS_FEATURES: { id: PlusFeature; e: string; name: string; blurb: string }[] = [
  { id: "photo-scan", e: "", name: "Photo scanning", blurb: "Snap any machine to learn it, or your home or apartment gym to set up your equipment" },
  { id: "camera-reps", e: "", name: "Camera rep counting", blurb: "Your phone counts reps and coaches your form during a workout" },
  { id: "debrief", e: "", name: "After-workout report", blurb: "When you'll be sore, what to eat and by when, water, creatine and pre-workout" },
  { id: "gyms", e: "", name: "Gyms near me", blurb: "Prices, busy times and live crowd reports" },
  { id: "eat-out", e: "", name: "Eat out", blurb: "Healthier picks at restaurants and fast food near you, logged in one tap" },
  { id: "ai-recipes", e: "", name: "AI recipes", blurb: "A recipe made from what's in your kitchen, fit to your goals" },
  { id: "guest-pass", e: "", name: "Guest pass", blurb: "Share Fit+ free with one friend or family member" },
];
export const PLUS_NAME: Record<PlusFeature, string> = Object.fromEntries(PLUS_FEATURES.map((f) => [f.id, f.name])) as Record<PlusFeature, string>;

export type PlusVia = "admin" | "plan" | "guest-pass" | null;
export type PassView = {
  /** owner: I pay and can share my pass. guest: someone shared theirs with me. */
  role: "owner" | "guest" | null;
  code: string | null;
  guest: { id: number; name: string; since: string } | null;
  owner: { id: number; name: string } | null;
  /** When an owner can give their pass to someone new (after a guest left), or null if they can now. */
  switchAfter: string | null;
};
export type PlusStatus = {
  plus: boolean;
  via: PlusVia;
  endsAt: string | null;
  /** Paid online by this account, so "Manage billing" works. */
  canManage: boolean;
  /** The site can take payments. */
  payment: boolean;
  price: string;
  canGivePass: boolean;
  pass: PassView;
};
export const freeStatus = (payment = false): PlusStatus => ({ plus: false, via: null, endsAt: null, canManage: false, payment, price: FIT_PLUS_PRICE, canGivePass: false, pass: { role: null, code: null, guest: null, owner: null, switchAfter: null } });

/** The link a guest opens (the website and the iPhone app both read ?pass=CODE). */
export const passLink = (base: string, code: string) => `${base.replace(/\/$/, "")}#/fit?pass=${code}`;
