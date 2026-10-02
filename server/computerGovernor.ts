import { setSearchBudgetScale } from "../shared/arcade/core";

// Computer moves (arcade games and chess) run on the main server thread, so when
// several hard games are thinking at once each one gets a smaller time budget.
const recentThinking: { at: number; ms: number }[] = [];

export function runComputer<T>(fn: () => T): T {
  const now = Date.now();
  while (recentThinking.length && now - recentThinking[0].at > 2000) recentThinking.shift();
  const busy = recentThinking.reduce((a, x) => a + x.ms, 0);
  setSearchBudgetScale(busy > 700 ? 0.3 : busy > 350 ? 0.6 : 1);
  const t0 = Date.now();
  try { return fn(); } finally {
    recentThinking.push({ at: Date.now(), ms: Date.now() - t0 });
    setSearchBudgetScale(1);
  }
}
