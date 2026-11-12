// "What should I order?": the AI suggests orders at any restaurant (even ones not in Cooked's lists) that fit
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
Reply as JSON: {"picks":[{"name":"...","how":"one short sentence on how to order it","kcal":<n>,"p":<protein g>,"c":<carbs g>,"f":<fat g>}]}. Numbers are plain numbers (no units) and are estimates; no extra text.
Always return 4 picks. Never return an empty list: if you don't know the place, use the most likely cuisine from its name, or a typical American restaurant.`;

export const menuUserText = (a: MenuAsk) =>
  `Restaurant: ${a.place}${a.cuisine ? ` (${a.cuisine})` : ""}\nGoal: ${a.goal}\nDiet: ${a.diet}\nTracking: ${a.mode === "points" ? "Arise Points" : "calories"}\nLeft today: about ${a.left.kcal} calories, ${a.left.p} g protein, ${a.left.c} g carbs, ${a.left.f} g fat.${a.wants ? `\nThey want: ${a.wants}` : ""}`;

/** The AI's answer, made safe to show and log: up to 6 picks with sane numbers. Forgiving about shape:
 *  numbers written as "450 kcal" or "30g", other key names (calories, protein…), a bare list or a list under
 *  another key, and missing macros (filled from the calories with a typical split). */
export function cleanMenuPicks(raw: any): MenuPick[] {
  const list: any[] = Array.isArray(raw) ? raw
    : Array.isArray(raw?.picks) ? raw.picks
    : (Object.values(raw ?? {}).find((v) => Array.isArray(v)) as any[] | undefined) ?? [];
  const num = (v: unknown): number | null => { const m = /-?\d+(\.\d+)?/.exec(String(v ?? "").replace(/,/g, "")); return m ? Math.round(Number(m[0])) : null; };
  const within = (x: number | null, hi: number) => (x !== null && x >= 0 && x <= hi ? x : null);
  const out: MenuPick[] = [];
  for (const r of list.slice(0, 6)) {
    const name = String(r?.name ?? r?.item ?? r?.dish ?? r?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
    const kcal = within(num(r?.kcal ?? r?.calories ?? r?.cal), 3000);
    if (!name || kcal === null || kcal < 20) continue;
    let p = within(num(r?.p ?? r?.protein), 300), c = within(num(r?.c ?? r?.carbs ?? r?.carbohydrates), 400), f = within(num(r?.f ?? r?.fat), 200);
    if (p === null) p = Math.round((kcal * 0.25) / 4);
    if (c === null) c = Math.round((kcal * 0.45) / 4);
    if (f === null) f = Math.round((kcal * 0.3) / 9);
    out.push({ name, how: String(r?.how ?? r?.order ?? r?.tip ?? "").replace(/\s+/g, " ").trim().slice(0, 200), kcal, p, c, f });
  }
  return out;
}
