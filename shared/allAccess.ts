// Arise All Access, as people see it: one $10-a-month plan for every Arise app (sold in server/plans.ts,
// kind "all_access"). Shared by the website, the iPhone apps and Podster.
export const ALL_ACCESS = {
  name: "Arise All Access",
  price: "$10",
  per: "a month",
  /** Where it's bought (the website; the iPhone apps link here only where Apple allows it). */
  url: "https://arisetodo.com/app#/all-access",
  /** Each app's name, then what All Access adds in it (shown smaller). */
  perks: [
    { app: "Arise To Duo", detail: "Unlimited: every plugin and AI" },
    { app: "Arise Notes", detail: "Plus: 1,500 minutes a month" },
    { app: "Cooked Fitness by Arise", detail: "Premium All in one Health & Fitness App, with a guest pass for a friend" },
    { app: "Podster", detail: "Ad-free listening" },
  ],
} as const;

/** Apps in the US App Store may show a price and link to buying on the website (App Review 3.1.1(a),
 *  US storefront, since 2025). Elsewhere the iPhone apps show what's included, with no price or link.
 *  The phone's region stands in for the App Store country. */
export function usRegion(lang?: string | null): boolean {
  const tags = [lang, ...(typeof navigator !== "undefined" ? [navigator.language, ...(navigator.languages || [])] : [])].filter(Boolean) as string[];
  let region = "";
  try { region = new Intl.DateTimeFormat().resolvedOptions().locale.split("-").find((p, i) => i > 0 && /^[A-Z]{2}$/.test(p)) || ""; } catch { /* no Intl */ }
  if (!region) for (const t of tags) { const m = /-([A-Za-z]{2})(?:-|$)/.exec(t); if (m) { region = m[1].toUpperCase(); break; } }
  return region === "US";
}

/** The app a person came from: the All Access page wears that app's name and colors and sends them back to it. */
export type AllAccessApp = "todo" | "fit" | "notes" | "podster";
export const ALL_ACCESS_APPS: Record<AllAccessApp, { name: string; from: string; to: string; site: string; perk: string }> = {
  todo: { name: "Arise To Duo", from: "#7c3aed", to: "#4f46e5", site: "https://arisetodo.com/", perk: "Arise To Duo" },
  fit: { name: "Cooked Fitness by Arise", from: "#ff5a1f", to: "#e0401a", site: "https://arisetodo.com/cooked/", perk: "Cooked Fitness by Arise" },
  notes: { name: "Arise Notes", from: "#5169ed", to: "#11b9af", site: "https://arisetodo.com/notes/", perk: "Arise Notes" },
  podster: { name: "Podster", from: "#8b64e9", to: "#5169ed", site: "https://arisetodo.com/podster/", perk: "Podster" },
};
export const isAllAccessApp = (v: unknown): v is AllAccessApp => typeof v === "string" && v in ALL_ACCESS_APPS;

/** The All Access page for one app, signed in when there's a one-use code. */
export function allAccessLink(app: AllAccessApp = "todo", code?: string | null): string {
  const q = new URLSearchParams();
  if (code && /^[a-f0-9]{64}$/.test(code)) q.set("signin", code);
  if (app !== "todo") q.set("for", app);
  const qs = q.toString();
  return `https://arisetodo.com/app${qs ? `?${qs}` : ""}#/all-access`;
}
