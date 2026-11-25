// Sets up a hub's daily check-ins (useDailyCheckins.ts) only where they're shown, and hands them to the list.
import type { ReactNode } from "react";
import { useDailyCheckins, type DailyApi, type DailyInput } from "./useDailyCheckins";

export function WithDaily({ input, children }: { input: DailyInput; children: (daily: DailyApi) => ReactNode }) {
  const daily = useDailyCheckins(input);
  return <>{children(daily)}</>;
}
