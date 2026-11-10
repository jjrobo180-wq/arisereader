// Smart matching (November 2026): instead of scrolling a directory, a client answers six quick questions in
// Arise Fit and gets their best three trainers, each with the reasons and the price that fits them.
// Plain scoring here (so it is explainable and testable); the server can add a one-line AI intro on top.
import { MODE_LABEL, type Mode, type Price, type PublicTrainer } from "./coach";

export type Need = {
  goal: string;            // a specialty, e.g. "Fat loss"
  modes: Mode[];           // ways they're happy to train
  budgetCents: number;     // per month; 0 = no limit
  perWeek: number;         // sessions a week they'd like (in person / live video)
  state: string; zip: string;
  level: "new" | "some" | "experienced";
  notes: string;
};
export const emptyNeed = (): Need => ({ goal: "", modes: [], budgetCents: 0, perWeek: 2, state: "", zip: "", level: "some", notes: "" });
export const GOALS = ["Fat loss", "Muscle building", "Strength", "Beginners", "Running", "Mobility", "Sports performance", "Seniors", "Pre and postnatal", "Injury recovery", "Nutrition", "Boxing", "Yoga", "Pilates"];
/** Specialties that also suit a goal (a "Bodybuilding" coach can help with "Muscle building"). */
const NEAR: Record<string, string[]> = { "Fat loss": ["Nutrition", "HIIT"], "Muscle building": ["Bodybuilding", "Strength", "Weight gain"], Strength: ["Powerlifting", "Olympic lifting", "Muscle building"], Beginners: ["Seniors", "Adaptive fitness"], Running: ["Marathon", "Endurance"], Mobility: ["Yoga", "Pilates", "Injury recovery"], "Sports performance": ["Youth athletes", "Golf fitness", "Olympic lifting"], Seniors: ["Mobility", "Beginners"], "Injury recovery": ["Mobility"], Boxing: ["Martial arts"] };

const WEEKS = 4.33;
/** What one price would cost a month for this client. */
export function monthlyCents(p: Price, perWeek: number): number {
  const spw = Math.max(1, perWeek);
  switch (p.per) {
    case "month": return p.cents;
    case "week": return Math.round(p.cents * WEEKS);
    case "session": return Math.round(p.cents * spw * WEEKS);
    case "package": return p.sessions ? Math.round((p.cents / p.sessions) * spw * WEEKS) : p.cents;
  }
}
/** The cheapest of the trainer's prices in a way the client wants to train. */
export function bestPrice(t: Pick<PublicTrainer, "prices">, n: Need): { price: Price; monthly: number } | null {
  const ok = t.prices.filter((p) => p.cents > 0 && (!n.modes.length || n.modes.includes(p.mode)));
  if (!ok.length) return null;
  return ok.map((price) => ({ price, monthly: monthlyCents(price, n.perWeek) })).sort((a, b) => a.monthly - b.monthly)[0];
}

export type Match = { trainer: PublicTrainer; score: number; reasons: string[]; price: { price: Price; monthly: number } | null };
const usd = (c: number) => `$${Math.round(c / 100).toLocaleString()}`;
export function matchTrainers(list: PublicTrainer[], n: Need, top = 3): Match[] {
  const out: Match[] = [];
  for (const t of list) {
    if (!t.accepting) continue;
    const modes = n.modes.length ? t.modes.filter((m) => n.modes.includes(m)) : t.modes;
    if (!modes.length) continue;
    // In person only works nearby: same state (and close ZIP when both have one).
    const remoteOk = modes.some((m) => m !== "inPerson");
    const local = !!n.state && t.state === n.state;
    if (!remoteOk && !local) continue;
    let score = 0; const reasons: string[] = [];
    if (n.goal) {
      if (t.specialties.includes(n.goal)) { score += 40; reasons.push(`Specializes in ${n.goal.toLowerCase()}`); }
      else { const near = (NEAR[n.goal] ?? []).find((s) => t.specialties.includes(s)); if (near) { score += 22; reasons.push(`Coaches ${near.toLowerCase()}, close to your goal`); } }
    }
    if (n.level === "new" && t.specialties.includes("Beginners")) { score += 8; reasons.push("Great with beginners"); }
    const price = bestPrice({ prices: t.prices.filter((p) => modes.includes(p.mode)) }, { ...n, modes });
    if (n.budgetCents && price) {
      if (price.monthly <= n.budgetCents) { score += 20; reasons.push(`About ${usd(price.monthly)}/month, in your budget`); }
      else if (price.monthly <= n.budgetCents * 1.25) { score += 6; reasons.push(`About ${usd(price.monthly)}/month, a little over budget`); }
      else score -= 25;
    }
    if (modes.includes("inPerson") && local) {
      const near = n.zip && t.zip && n.zip.slice(0, 3) === t.zip.slice(0, 3);
      score += near ? 14 : 6; reasons.push(near ? `In person near you${t.city ? ` (${t.city})` : ""}` : `In person in ${t.city || t.state}`);
    } else if (modes.length) reasons.push(modes.map((m) => MODE_LABEL[m]).join(" or "));
    // Proven: rating (pulled to the middle when there are few reviews) and experience.
    const r = (t.rating * t.reviews + 4 * 3) / (t.reviews + 3);
    score += Math.round((r - 3.5) * 10); if (t.reviews >= 3 && t.rating >= 4.6) reasons.push(`${t.rating.toFixed(1)} stars from ${t.reviews} clients`);
    score += Math.min(10, t.years); if (t.years >= 5) reasons.push(`${t.years} years coaching`);
    if (t.certifications.length) score += 3;
    out.push({ trainer: t, score, reasons: reasons.slice(0, 4), price });
  }
  return out.sort((a, b) => b.score - a.score || b.trainer.reviews - a.trainer.reviews || a.trainer.id - b.trainer.id).slice(0, top);
}

export function cleanNeed(raw: any): Need {
  const r = raw && typeof raw === "object" ? raw : {};
  return {
    goal: typeof r.goal === "string" ? r.goal.slice(0, 40) : "",
    modes: Array.isArray(r.modes) ? r.modes.filter((m: unknown): m is Mode => m === "inPerson" || m === "virtual" || m === "remote") : [],
    budgetCents: Math.max(0, Math.min(5_000_00, Math.round(Number(r.budgetCents) || 0))),
    perWeek: Math.max(1, Math.min(7, Math.round(Number(r.perWeek) || 2))),
    state: typeof r.state === "string" && /^[A-Z]{2}$/.test(r.state) ? r.state : "",
    zip: typeof r.zip === "string" && /^\d{5}$/.test(r.zip) ? r.zip : "",
    level: r.level === "new" || r.level === "experienced" ? r.level : "some",
    notes: typeof r.notes === "string" ? r.notes.trim().slice(0, 400) : "",
  };
}
/** The opening message for "Ask to coach me", written from their answers. */
export const introMessage = (n: Need, first: string) => [
  `Hi ${first}! I'm looking for help with ${n.goal ? n.goal.toLowerCase() : "my fitness"}.`,
  n.level === "new" ? "I'm pretty new to training." : n.level === "experienced" ? "I've been training a while." : "",
  n.modes.length ? `I'd like ${n.modes.map((m) => MODE_LABEL[m].toLowerCase()).join(" or ")}${n.modes.some((m) => m !== "remote") ? `, about ${n.perWeek} times a week` : ""}.` : "",
  n.notes,
].filter(Boolean).join(" ");
