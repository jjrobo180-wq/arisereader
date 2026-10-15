// Shared state for every Potty Training screen: the saved data, the current child, and the
// actions (log something, open the log sheet, celebrate, start a sit, move between screens).
import { createContext, useContext } from "react";
import type { Child, Entry, Kind, PottyData } from "@shared/pro/potty";

export type Tab = "today" | "agenda" | "log" | "plan" | "coach" | "schedule" | "videos" | "learn" | "needs" | "try" | "rewards";
export type LogPrefill = Partial<Entry> & { edit?: Entry };
export type PottyCtx = {
  data: PottyData;
  set: (fn: (d: PottyData) => PottyData) => void;
  kid: Child;
  months: number | null;
  log: (kind: Kind, extra?: Partial<Entry>) => void;
  openLog: (pre?: LogPrefill) => void;
  celebrate: (title: string) => void;
  startSit: () => void;
  go: (tab: Tab, sub?: string) => void;
  sub: string;
  putKid: (k: Child) => void;
  editKid: () => void;
  token: string | null;
};
export const Ctx = createContext<PottyCtx | null>(null);
export function usePotty(): PottyCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("Potty screens must be inside the Potty Training app.");
  return c;
}
