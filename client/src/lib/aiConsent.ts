// Asking before anything a person types is sent to an outside AI company (App Review 5.1.2(i)).
// The iPhone apps ask once per account, before the first AI request. "Allow" is remembered; "Not now" sends
// nothing and asks again the next time. localStorage is already kept per signed-in account
// (client/src/lib/accountStorage.ts), so the saved answer follows the account, not the phone.

/** The server's AI routes (the AI-metered list in server/routes.ts, and /api/apps/ai). */
const AI_PATHS = [
  /\/api\/teacher-hub\/import(\/minutes)?$/,
  /\/api\/hub-chat$/,
  /\/api\/arise-todo\/food\/estimate$/,
  /\/api\/life-plan\/build$/,
  /\/api\/accountability\/ai\/(worksheet|quiz)$/,
  /\/api\/sleep-finder\/ask$/,
  /\/api\/comprehension\/review\/[^/]+\/suggest$/,
  /\/api\/apps\/ai$/,
  /\/api\/undercover\/chat$/,
];

const KEY = "arise-ai-consent-v1";
export const AI_PROVIDERS = "OpenAI, Groq and Perplexity";
export const AI_OFF_MESSAGE = "AI is off because you chose not to send text to our AI providers. You can allow it the next time you use an AI feature.";

export function isAiRequest(method: string, url: string): boolean {
  if (method.toUpperCase() !== "POST") return false;
  const path = url.split("?")[0].split("#")[0];
  return AI_PATHS.some((re) => re.test(path));
}

export const aiAllowed = (): boolean => {
  try { return localStorage.getItem(KEY) === "yes"; } catch { return false; }
};
export const allowAi = (yes: boolean): void => {
  try { if (yes) localStorage.setItem(KEY, "yes"); else localStorage.removeItem(KEY); } catch { /* storage blocked */ }
};

let pending: Promise<boolean> | null = null;
let settle: ((ok: boolean) => void) | null = null;

/** Resolves true when the person has allowed AI (now or earlier). Shows the sheet if they have not answered. */
export function askAiConsent(): Promise<boolean> {
  if (aiAllowed()) return Promise.resolve(true);
  if (pending) return pending;
  pending = new Promise<boolean>((resolve) => { settle = resolve; });
  window.dispatchEvent(new Event("arise:ai-consent-ask"));
  return pending;
}

/** Called by the sheet with the person's answer. */
export function answerAiConsent(yes: boolean): void {
  allowAi(yes);
  const done = settle;
  pending = null; settle = null;
  done?.(yes);
}
