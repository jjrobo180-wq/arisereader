// Getting paid in Arise (November 2026): clients pay their trainer by card inside Cooked, through Stripe Connect.
// The trainer gets the money in their own bank account; Arise keeps a small fee per payment. Trainers who'd rather
// use their own link (Venmo, PayPal, their own Stripe) still can, and Arise takes nothing on those.
import type { Price } from "./coach";

/** Arise's share of each in-app payment, in percent. */
export const PLATFORM_FEE_PCT = 1;
export const feeCents = (cents: number) => Math.max(0, Math.round((cents * PLATFORM_FEE_PCT) / 100));
/** Stripe's card fee in the US (2.9% + 30¢), which comes out of the trainer's share. Shown so nothing is a surprise. */
export const cardFeeCents = (cents: number) => Math.round(cents * 0.029) + 30;
export const trainerGets = (cents: number) => Math.max(0, cents - feeCents(cents) - cardFeeCents(cents));

export type Payment = { id: string; at: string; cents: number; fee: number; label: string; kind: "once" | "monthly" | "weekly"; status: "paid" | "refunded"; sub?: string };
/** One-time for sessions and packages; a subscription for monthly and weekly prices. */
export const payKind = (p: Price): Payment["kind"] => (p.per === "month" ? "monthly" : p.per === "week" ? "weekly" : "once");
export const payable = (p: Price) => p.cents >= 500 && p.cents <= 1_000_000;
export const payLabel = (p: Price) => `${p.label || "Training"}${p.per === "package" && p.sessions ? ` (${p.sessions} sessions)` : ""}`;
export const totals = (list: Payment[], sinceIso = "") => {
  const paid = list.filter((p) => p.status === "paid" && p.at >= sinceIso);
  const cents = paid.reduce((t, p) => t + p.cents, 0); const fee = paid.reduce((t, p) => t + p.fee, 0);
  return { cents, fee, count: paid.length, net: paid.reduce((t, p) => t + trainerGets(p.cents), 0) };
};
