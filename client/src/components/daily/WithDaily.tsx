// Sets up a hub's daily check-ins (useDailyCheckins.ts) only where they're shown, and hands them to the list.
// If anything in the check-ins ever fails, the list is shown without them (and the failure reported), so a
// check-in can never take Tasks, or anything next to it, down with it.
import { Component, type ReactNode } from "react";
import { DailyDoneSync, useDailyCheckins, type DailyApi, type DailyInput } from "./useDailyCheckins";

function report(error: unknown) {
  try {
    void fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: location.hostname, route: location.hash || location.pathname, role: "plugin", name: (error as Error)?.name, message: `Check-ins: ${(error as Error)?.message}`, where: "" }) }).catch(() => {});
  } catch { /* reporting never breaks the page */ }
}

/** Shows `fallback` instead of whatever failed below it. */
export class CheckinBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { report(error); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function Inner({ input, children }: { input: DailyInput; children: (daily: DailyApi | undefined) => ReactNode }) {
  const daily = useDailyCheckins(input);
  return <>{children(daily)}</>;
}

export function WithDaily({ input, children }: { input: DailyInput; children: (daily: DailyApi | undefined) => ReactNode }) {
  return <CheckinBoundary fallback={children(undefined)}><Inner input={input}>{children}</Inner></CheckinBoundary>;
}

/** The background done-list keeper (for reminders), drawn nothing and never able to break the page. */
export function SafeDailyDoneSync(props: Parameters<typeof DailyDoneSync>[0]) {
  return <CheckinBoundary fallback={null}><DailyDoneSync {...props} /></CheckinBoundary>;
}
