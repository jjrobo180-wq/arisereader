// The Agenda: a plain-text day for the parent. They log what the child ate and drank; this works
// out when to sit the child on the toilet (a pee soon after a drink, a poop soon after eating),
// checks each planned sit against what actually happened, and says in words when this child
// usually pees and poops.
import { clock12, clockOf, dayOf, defaultInterval, ageMonths, drinkInfo, drinkTypeOf, hmOf, isAccident, isPeeEvent, isPoopEvent, isSuccess, mlToOz, predict, rhythm, type Child, type Entry } from "./model";

const MIN = 60_000;
/** A sit counts for a planned time if it happens from 10 minutes before to 35 minutes after. */
const BEFORE = 10 * MIN, AFTER = 35 * MIN;

export type SitState = "upcoming" | "due" | "worked" | "nothing" | "accident" | "missed";
export type Sit = {
  id: string; at: number; wants: ("pee" | "poop")[];
  /** When the pee or poop is expected (a window around the planned time). */
  expectFrom: number; expectTo: number; why: string;
  state: SitState; result?: Entry;
};
export type AgendaLine = { id: string; at: number; entry?: Entry; sit?: Sit; text: string; emoji: string };
export type Agenda = { day: string; lines: AgendaLine[]; sits: Sit[]; next: Sit | null; intake: Intake };
export type Intake = { drinks: number; totalMl: number; bottleMl: number; bottles: number; juiceMl: number; meals: number; snacks: number };

const volume = (ml: number | undefined, units: "oz" | "ml") => (ml ? (units === "oz" ? `${mlToOz(ml)} oz` : `${ml} ml`) : "");
const join = (xs: string[]) => (xs.length <= 1 ? xs[0] || "" : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`);

export function intakeOf(logs: Entry[], kid: string, day: string): Intake {
  const l = logs.filter((x) => x.kid === kid && dayOf(x.at) === day);
  const drinks = l.filter((x) => x.kind === "drink");
  const bottles = drinks.filter((x) => drinkTypeOf(x) === "bottle");
  return {
    drinks: drinks.length, totalMl: drinks.reduce((s, x) => s + (x.ml || 0), 0),
    bottles: bottles.length, bottleMl: bottles.reduce((s, x) => s + (x.ml || 0), 0),
    juiceMl: drinks.filter((x) => drinkTypeOf(x) === "juice").reduce((s, x) => s + (x.ml || 0), 0),
    meals: l.filter((x) => x.kind === "food" && x.size !== "snack").length, snacks: l.filter((x) => x.kind === "food" && x.size === "snack").length,
  };
}

/** One line for what was logged ("Drank juice · 4 oz"). */
export function entryText(e: Entry, units: "oz" | "ml"): { emoji: string; text: string } {
  if (e.kind === "food") return { emoji: e.size === "snack" ? "🍎" : "🍽️", text: e.size === "snack" ? "Ate a snack" : "Ate a meal" };
  if (e.kind === "drink") {
    const t = drinkTypeOf(e); const info = drinkInfo(t);
    return { emoji: info?.emoji || "🥤", text: `Drank ${t === "bottle" ? "a bottle" : info ? info.label.toLowerCase() : "a drink"}${e.ml ? ` · ${volume(e.ml, units)}` : ""}` };
  }
  const labels: Record<string, [string, string]> = {
    pee: ["💧", "Peed in the potty ✓"], poop: ["💩", "Pooped in the potty ✓"], both: ["🌟", "Peed and pooped in the potty ✓"], try: ["🪑", "Sat on the toilet, nothing came"], dry: ["✅", "Dry check: dry"],
    "acc-pee": ["💦", "Pee accident"], "acc-poop": ["🧻", "Poop accident"], "diaper-wet": ["🩲", "Wet diaper"], "diaper-dirty": ["🟤", "Poop in the diaper"],
  };
  const l = labels[e.kind]; if (l) return { emoji: l[0], text: l[1] };
  return { emoji: "📝", text: e.note ? `Note: ${e.note}` : "Note" };
}

/** "Juice" or "Bottle" for a typed drink, otherwise the usual name of the entry. */
export const labelOf = (e: Entry, fallback: string) => (e.kind === "drink" ? drinkInfo(drinkTypeOf(e))?.label || fallback : fallback);

const SIT_KINDS = new Set(["pee", "poop", "both", "try"]);

/** The sits to plan for the rest of the day, and for the past ones, whether they worked. */
export function planSits(logs: Entry[], child: Child, now = Date.now()): Sit[] {
  const day = dayOf(now);
  const r = rhythm(logs, child.id, now);
  const months = ageMonths(child.birth, now);
  const today = logs.filter((x) => x.kid === child.id && dayOf(x.at) === day && x.at <= now).sort((a, b) => a.at - b.at);
  type Raw = { at: number; wants: "pee" | "poop"; from: number; to: number; why: string };
  const raw: Raw[] = [];

  for (const d of today.filter((x) => x.kind === "drink" && (x.ml === undefined || x.ml >= 30))) {
    const delay = r.drinkToPee ?? Math.min(defaultInterval(months) - 30, 60);
    const centre = d.at + delay * MIN; const at = d.at + Math.max(15, delay - 10) * MIN;
    if (today.some((x) => isPeeEvent(x.kind) && x.at > d.at && x.at < at - BEFORE)) continue; // already went before this sit
    const t = drinkTypeOf(d); const what = t === "bottle" ? "bottle" : t === "juice" ? "juice" : t === "water" ? "water" : t === "milk" ? "milk" : "drink";
    raw.push({ at, wants: "pee", from: centre - 10 * MIN, to: centre + 15 * MIN, why: `the ${what} at ${clockOf(d.at)}${r.drinkToPee ? ` (a drink usually turns into a pee in about ${r.drinkToPee} min)` : ""}` });
  }
  for (const f of today.filter((x) => x.kind === "food")) {
    const delay = r.mealToPoop ?? (f.size === "snack" ? 30 : 25);
    const centre = f.at + delay * MIN; const at = f.at + Math.max(10, delay - 5) * MIN;
    if (today.some((x) => isPoopEvent(x.kind) && x.at > f.at && x.at < at - BEFORE)) continue;
    raw.push({ at, wants: "poop", from: centre - 10 * MIN, to: centre + 15 * MIN, why: `the ${f.size === "snack" ? "snack" : "meal"} at ${clockOf(f.at)}${r.mealToPoop ? ` (a poop usually follows eating by about ${r.mealToPoop} min)` : " (poops are most likely 15–30 min after eating)"}` });
  }
  // The child's own rhythm fills in where nothing was logged to go on.
  for (const w of predict(logs, child, now)) {
    if (w.to <= now) continue;
    if (raw.some((x) => x.wants === w.kind && Math.abs(x.at - w.from) < 40 * MIN && x.at + AFTER > now)) continue;
    raw.push({ at: Math.max(w.from - 5 * MIN, now), wants: w.kind, from: w.from, to: w.to, why: w.why });
  }

  // Sits within 20 minutes of each other become one trip to the toilet.
  raw.sort((a, b) => a.at - b.at);
  const merged: { at: number; wants: Set<"pee" | "poop">; from: number; to: number; whys: string[] }[] = [];
  for (const x of raw) {
    const last = merged[merged.length - 1];
    if (last && x.at - last.at <= 20 * MIN) { last.wants.add(x.wants); last.from = Math.min(last.from, x.from); last.to = Math.max(last.to, x.to); last.whys.push(x.why); }
    else merged.push({ at: x.at, wants: new Set([x.wants]), from: x.from, to: x.to, whys: [x.why] });
  }

  const used = new Set<string>();
  const trips = today.filter((x) => SIT_KINDS.has(x.kind) || isAccident(x.kind));
  return merged.map((m, i) => {
    const hit = trips.find((x) => !used.has(x.id) && x.at >= m.at - BEFORE && x.at <= m.at + AFTER);
    if (hit) used.add(hit.id);
    const state: SitState = hit ? (isSuccess(hit.kind) ? "worked" : isAccident(hit.kind) ? "accident" : "nothing")
      : now > m.at + AFTER ? "missed" : now >= m.at - 5 * MIN ? "due" : "upcoming";
    const wants = (["pee", "poop"] as const).filter((k) => m.wants.has(k));
    return { id: `sit${i}:${m.at}`, at: m.at, wants, expectFrom: m.from, expectTo: m.to, why: m.whys.join("; and "), state, result: hit };
  });
}

export function buildAgenda(logs: Entry[], child: Child, units: "oz" | "ml", now = Date.now()): Agenda {
  const day = dayOf(now);
  const entries = logs.filter((x) => x.kid === child.id && dayOf(x.at) === day && x.at <= now);
  const sits = planSits(logs, child, now);
  const matched = new Set(sits.map((s) => s.result?.id).filter(Boolean));
  const lines: AgendaLine[] = [];
  for (const e of entries) {
    const t = entryText(e, units);
    lines.push({ id: e.id, at: e.at, entry: e, ...t, text: matched.has(e.id) ? `${t.text} (planned sit)` : t.text });
  }
  for (const s of sits.filter((x) => !x.result)) lines.push({ id: s.id, at: s.at, sit: s, emoji: "🚽", text: sitText(s) });
  lines.sort((a, b) => a.at - b.at);
  return { day, lines, sits, next: sits.find((s) => s.state === "due" || s.state === "upcoming") || null, intake: intakeOf(logs, child.id, day) };
}

const wantText = (s: Sit) => (s.wants.length === 2 ? "a pee and a poop" : s.wants[0] === "poop" ? "a poop" : "a pee");
export function sitText(s: Sit): string {
  const when = `${clockOf(s.at)}`;
  const window = `${clockOf(s.expectFrom)}–${clockOf(s.expectTo)}`;
  if (s.state === "due") return `Sit on the toilet now — expect ${wantText(s)} around ${window}, because of ${s.why}.`;
  if (s.state === "missed") return `Planned sit at ${when} — not marked yet (expected ${wantText(s)} around ${window}).`;
  return `Sit on the toilet at ${when} — expect ${wantText(s)} around ${window}, because of ${s.why}.`;
}

// ─── Usual times, in words ───
const hourLabel = (h: number) => clock12(hmOf(h * 60));
/** Busy stretches of the day: hours with at least 40% of the busiest hour's count, joined when side by side. */
export function peaks(byHour: number[], max = 3): { from: number; to: number; n: number }[] {
  const top = Math.max(0, ...byHour); if (top < 2) return [];
  const floor = Math.max(2, Math.ceil(top * 0.4));
  const groups: { from: number; to: number; n: number }[] = [];
  for (let h = 0; h < 24; h++) {
    if (byHour[h] < floor) continue;
    const last = groups[groups.length - 1];
    if (last && last.to === h) { last.to = h + 1; last.n += byHour[h]; } else groups.push({ from: h, to: h + 1, n: byHour[h] });
  }
  return groups.sort((a, b) => b.n - a.n).slice(0, max).sort((a, b) => a.from - b.from);
}
const range = (p: { from: number; to: number }) => `${hourLabel(p.from)}–${hourLabel(p.to % 24)}`;

/** Sentences about when this child usually pees and poops, from the last two weeks of the log. */
export function usualTimes(logs: Entry[], child: Child, now = Date.now()): { lines: string[]; learning: boolean } {
  const r = rhythm(logs, child.id, now);
  const name = child.name || "Your child";
  const peeTotal = r.peeByHour.reduce((a, b) => a + b, 0), poopTotal = r.poopByHour.reduce((a, b) => a + b, 0);
  const lines: string[] = []; let learning = false;
  const peePeaks = peaks(r.peeByHour);
  if (peeTotal >= 6 && peePeaks.length) lines.push(`${name} usually pees around ${join(peePeaks.map(range))}.`);
  else { learning = true; lines.push(`Pee times: still learning — ${peeTotal} logged so far. A pattern shows after about 6 pees across a few days.`); }
  if (r.peeGap) lines.push(`Between pees: about ${r.peeGap} minutes.`);
  if (r.drinkToPee) lines.push(`After a drink, a pee usually comes in about ${r.drinkToPee} minutes.`);
  const poopPeaks = peaks(r.poopByHour);
  if (poopTotal >= 4 && poopPeaks.length) lines.push(`${name} usually poops around ${join(poopPeaks.map(range))}${r.poopsPerDay ? ` (about ${r.poopsPerDay} a day)` : ""}.`);
  else { learning = true; lines.push(`Poop times: still learning — ${poopTotal} logged so far. Poops are rarer, so it takes about 4 across a week or two.`); }
  if (r.mealToPoop) lines.push(`After eating, a poop usually comes in about ${r.mealToPoop} minutes.`);
  if (!r.drinkToPee || !r.mealToPoop) lines.push("Log every drink (with the amount) and every meal — that is how the timing gets sharper.");
  return { lines, learning };
}

/** The whole day as plain text, to copy into a message or note. */
export function agendaText(a: Agenda, child: Child, units: "oz" | "ml", usual: string[]): string {
  const head = `${child.name || "Today"}'s agenda — ${a.day}`;
  const body = a.lines.map((l) => `${clockOf(l.at)}  ${l.text}`);
  const i = a.intake;
  const tot = [i.totalMl ? `${volume(i.totalMl, units)} to drink` : "", i.bottles ? `${i.bottles} bottle${i.bottles === 1 ? "" : "s"} (${volume(i.bottleMl, units)})` : "", i.juiceMl ? `juice ${volume(i.juiceMl, units)}` : ""].filter(Boolean);
  return [head, "", ...body, "", tot.length ? `Drinks today: ${tot.join(", ")}.` : "", "", "Usual times:", ...usual.map((u) => `- ${u}`)].join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
