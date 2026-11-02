// "What should I order?": the AI suggests orders at any restaurant (even ones not in Arise Fit's lists) that fit
// what's left of the person's day. Pure parts here so they're tested; the call is in server/fit.ts.
export type MenuAsk = {
  place: string; cuisine: string; goal: string; diet: string; mode: "calories" | "points"; wants: string;
  left: { kcal: number; p: number; c: number; f: number };
};
export type MenuPick = { name: string; how: string; kcal: number; p: number; c: number; f: number };

export const MENU_PROMPT = `You are a nutrition coach helping someone order at a restaurant for a fitness app.
Given the restaurant (or cuisine), their goal, diet and what's left of their day, suggest the 4 best things to order there, best fit first.
Use items that restaurant (or that kind of restaurant) really serves; if you don't know the exact menu, suggest the typical dishes of that cuisine and say so in "how".
Each pick: how to order it (swaps like "grilled not fried", "dressing on the side", "no bun", "half the rice"), realistic calories and macros for the portion you describe (USDA-style values), and keep to their diet and wants.
Reply as JSON: {"picks":[{"name":"...","how":"one short sentence on how to order it","kcal":<n>,"p":<protein g>,"c":<carbs g>,"f":<fat g>}]}. Numbers are estimates; no extra text.`;

export const menuUserText = (a: MenuAsk) =>
  `Restaurant: ${a.place}${a.cuisine ? ` (${a.cuisine})` : ""}\nGoal: ${a.goal}\nDiet: ${a.diet}\nTracking: ${a.mode === "points" ? "Arise Points" : "calories"}\nLeft today: about ${a.left.kcal} calories, ${a.left.p} g protein, ${a.left.c} g carbs, ${a.left.f} g fat.${a.wants ? `\nThey want: ${a.wants}` : ""}`;

/** The AI's answer, made safe to show and log: up to 6 picks with sane numbers. */
export function cleanMenuPicks(raw: any): MenuPick[] {
  const list = Array.isArray(raw?.picks) ? raw.picks : [];
  const n = (v: unknown, hi: number) => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 && x <= hi ? x : null; };
  const out: MenuPick[] = [];
  for (const r of list.slice(0, 6)) {
    const name = String(r?.name ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
    const kcal = n(r?.kcal, 3000), p = n(r?.p, 300), c = n(r?.c, 400), f = n(r?.f, 200);
    if (!name || kcal === null || kcal < 20 || p === null || c === null || f === null) continue;
    out.push({ name, how: String(r?.how ?? "").replace(/\s+/g, " ").trim().slice(0, 200), kcal, p, c, f });
  }
  return out;
}
