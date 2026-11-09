// Arise All Access, as people see it: one $10-a-month plan for every Arise app (sold in server/plans.ts,
// kind "all_access"). Shared by the website, the iPhone apps and Pod+.
export const ALL_ACCESS = {
  name: "Arise All Access",
  price: "$10",
  per: "a month",
  /** Where it's bought (the website; the iPhone apps link here only where Apple allows it). */
  url: "https://arisetodo.com/app#/all-access",
  perks: [
    "To Duo Unlimited: every plugin and AI",
    "Arise Notes Plus: 1,500 minutes a month",
    "Arise Fit+, with a guest pass for a friend",
    "Ad-free listening in Pod+",
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
