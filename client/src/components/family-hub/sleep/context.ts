// Arise LifeHub · Sleep: what every tab of the Sleep app can reach, so any of them can start
// any tool the same way (and record that it was tried, for the morning check-in).
import { createContext, useContext } from "react";
import type { Family } from "@shared/familyHub";
import type { JournalKind, SleepApp, SoundId } from "@shared/sleepApp";
import type { SleepTab } from "@shared/sleepContent";
import type { ScriptLine } from "@shared/sleepScripts";
import type { SetFamily } from "../ui";
import type { BreathMode } from "./stages";

export type SleepContext = {
  family: Family;
  setFamily: SetFamily;
  today: string;
  makeId: () => string;
  say: (message: string) => void;
  token: string | null;
  firstName: string;
  app: SleepApp;
  update: (change: (app: SleepApp) => SleepApp) => void;
  /** Christian content is on. */
  faith: boolean;
  /** Starts a tool by its id, like "sound:brown" or "script:night-train". */
  launch: (toolId: string) => void;
  /** Reads any words aloud in the reading screen. `toolId` records it as tried tonight. */
  read: (title: string, lines: readonly ScriptLine[], toolId?: string) => void;
  /** Opens the breathing screen. */
  breathe: (mode: BreathMode, minutes: number, toolId?: string) => void;
  /** Plays a whole sound mix (recording each sound as tried) and starts the sleep timer. */
  playMix: (mix: Partial<Record<SoundId, number>>) => void;
  /** Turns one sound on at a level, or off at 0. */
  setSound: (id: SoundId, level: number) => void;
  goTab: (tab: SleepTab) => void;
  isFav: (toolId: string) => boolean;
  toggleFav: (toolId: string) => void;
  journalKind: JournalKind;
  setJournalKind: (kind: JournalKind) => void;
  /** Goes up by one each time Park your thoughts should take the cursor. */
  parkFocus: number;
  alphabetCategory: string;
  setAlphabetCategory: (id: string) => void;
};

export const SleepCtx = createContext<SleepContext | null>(null);

export function useSleep(): SleepContext {
  const ctx = useContext(SleepCtx);
  if (!ctx) throw new Error("useSleep must be used inside the Sleep app");
  return ctx;
}
