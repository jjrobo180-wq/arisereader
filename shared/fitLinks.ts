// Arise Fit links: what Siri shortcuts and buddy invites open (client/src/pages/fit/FitSiri.tsx).
//   arisefit://do/<action>   and   …/#/fit?do=<action>     do something (start a workout, log water…)
//   arisefit://buddy/<CODE>  and   …/#/fit?buddy=<CODE>    join a friend's workout group
export type SiriAction = "workout" | "water" | "fast-start" | "fast-end" | "run" | "meal" | "scan" | "gyms" | "recipes" | "buddies";
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
  { id: "buddies", phrase: "Check my buddies", does: "Your workout buddies' week" },
];
const IDS = new Set<string>(SIRI_ACTIONS.map((a) => a.id));

/** What a link asks for: an action, a buddy invite code, or nothing. */
export function readLink(url: string): { action?: SiriAction; buddy?: string } {
  const a = /(?:arisefit:\/\/do\/|[?&]do=)([a-z-]+)/i.exec(url)?.[1]?.toLowerCase();
  const b = /(?:arisefit:\/\/buddy\/|[?&]buddy=)([A-Za-z0-9]{6})(?![A-Za-z0-9])/.exec(url)?.[1]?.toUpperCase();
  return { ...(a && IDS.has(a) ? { action: a as SiriAction } : {}), ...(b ? { buddy: b } : {}) };
}

