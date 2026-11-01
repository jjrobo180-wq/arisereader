// Arise Fit links: what Siri shortcuts and buddy invites open (client/src/pages/fit/FitSiri.tsx).
//   arisefit://do/<action>   and   …/#/fit?do=<action>     do something (start a workout, log water…)
//   arisefit://circle/<CODE> and   …/#/fit?circle=<CODE>   join a friend's workout circle
//   arisefit://pass/<CODE>   and   …/#/fit?pass=<CODE>     use someone's Arise Fit+ guest pass
export type SiriAction = "workout" | "water" | "fast-start" | "fast-end" | "run" | "meal" | "scan" | "gyms" | "recipes" | "circle";
export const SIRI_ACTIONS: { id: SiriAction; phrase: string; does: string }[] = [
  { id: "workout", phrase: "Start my workout", does: "Starts your next program day, or today's workout built for you" },
  { id: "water", phrase: "Log water", does: "Adds a glass of water (8 oz or 250 ml)" },
  { id: "meal", phrase: "Log my meal", does: "Opens the camera to snap your meal" },
  { id: "fast-start", phrase: "Start my fast", does: "Starts a fast with your usual plan" },
  { id: "fast-end", phrase: "End my fast", does: "Ends the fast you're on" },
  { id: "run", phrase: "Start a run", does: "Opens Run, ready to track with GPS" },
  { id: "scan", phrase: "Scan a machine", does: "Opens the machine scanner" },
  { id: "gyms", phrase: "Find a gym", does: "Gyms near you, prices and busy times" },
  { id: "recipes", phrase: "What should I eat", does: "Recipes that fit what's left today" },
  { id: "circle", phrase: "Check my circle", does: "Your workout circle's week" },
];
const IDS = new Set<string>(SIRI_ACTIONS.map((a) => a.id));

export type FitLink = { action?: SiriAction; circle?: string; pass?: string };
/** What a link asks for: an action, a circle invite, a guest pass, or nothing. */
export function readLink(url: string): FitLink {
  const a = /(?:arisefit:\/\/do\/|[?&]do=)([a-z-]+)/i.exec(url)?.[1]?.toLowerCase();
  const code = (kind: string) => new RegExp(`(?:arisefit:\\/\\/${kind}\\/|[?&]${kind}=)([A-Za-z0-9]{6})(?![A-Za-z0-9])`).exec(url)?.[1]?.toUpperCase();
  const c = code("circle"), p = code("pass");
  return { ...(a && IDS.has(a) ? { action: a as SiriAction } : {}), ...(c ? { circle: c } : {}), ...(p ? { pass: p } : {}) };
}

