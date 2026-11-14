// If Cooked, Cooked PT, Arise Notes or Podster breaks inside Arise To Duo, only that plugin's area says so (with
// a way to try again), and the rest of To Duo keeps working. The crash is reported like any other.
import { Component, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

type Props = { name: string; children: ReactNode };
type State = { error: string | null; tries: number };

export class SuperBoundary extends Component<Props, State> {
  state: State = { error: null, tries: 0 };
  static getDerivedStateFromError(e: unknown): Partial<State> { return { error: String((e as Error)?.message || "unknown").slice(0, 200) }; }
  componentDidCatch(error: Error, info: { componentStack?: string }) {
    try {
      const where = String(info?.componentStack || "").split("\n").map((s) => s.trim()).filter(Boolean).slice(0, 3).join(" < ");
      void fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ host: location.hostname, route: location.hash || location.pathname, role: "plugin", name: error?.name, message: `${this.props.name}: ${error?.message}`, where }) }).catch(() => {});
    } catch { /* reporting never breaks the page further */ }
  }
  render() {
    if (!this.state.error) return <div key={this.state.tries}>{this.props.children}</div>;
    return <div role="alert" className="grid min-h-[40vh] place-items-center rounded-[1.5rem] border border-[#e7e8f0] bg-white p-6 text-center" data-testid="super-app-error">
      <div className="max-w-sm">
        <p className="text-lg font-black text-[#232139]">{this.props.name} hit a snag</p>
        <p className="mt-1 text-sm text-slate-500">The rest of To Duo is fine. Try opening it again; if it keeps happening, we've been told.</p>
        <button type="button" onClick={() => this.setState((s) => ({ error: null, tries: s.tries + 1 }))}
          className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#6e5ae0] px-4 text-sm font-bold text-white hover:bg-[#5948c8]"><RefreshCw size={16} />Try again</button>
      </div>
    </div>;
  }
}
