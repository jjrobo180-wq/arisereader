// Asking Arise Undercover's AI (server/undercover.ts) from the Undercover app: the same request as Ask AI
// (client/src/lib/askAi.ts), with the app's look so the answer is written to blend in.
import { askAi as ask, askPrefs, setNotesLookup } from "@/lib/askAi";
import type { UndercoverMsg, UndercoverTheme } from "@shared/undercover";

export { setNotesLookup };
export const askAi = (theme: UndercoverTheme, messages: UndercoverMsg[], prefs: { city: string; unit: "F" | "C"; context?: string }): Promise<string> => ask(messages, prefs, theme);
/** The city and °F/°C saved in Undercover's settings. */
export const undercoverPrefs = askPrefs;
