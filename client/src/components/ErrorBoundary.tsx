import { Component, ReactNode } from "react";
import { isNativeApp } from "@/lib/nativeApp";

interface State {
  hasError: boolean;
  /** In the iPhone apps, what broke is shown in small print, so a screenshot says what to fix. */
  detail?: string;
}

/** Reads the role from the saved sign-in (no names), so a crash report says whose screen broke. */
function savedRole(): string {
  try {
    const raw = document.cookie.split(";").map(c => c.trim()).find(c => c.startsWith("arise_session="));
    if (!raw) return "guest";
    const bin = atob(raw.slice("arise_session=".length));
    let data: any; try { data = JSON.parse(decodeURIComponent(escape(bin))); } catch { data = JSON.parse(bin); }
    return data?.user?.isAdmin ? "admin" : String(data?.user?.role || "student");
  } catch { return "unknown"; }
}

function reportCrash(error: unknown, info: any) {
  try {
    const e = error as Error;
    const where = String(info?.componentStack || "").split("\n").map(s => s.trim()).filter(Boolean).slice(0, 3).join(" < ");
    fetch("/api/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // (No keepalive: the iPhone apps' web view drops keepalive requests to another site.)
      body: JSON.stringify({ host: location.hostname, route: location.hash || location.pathname, role: savedRole(), name: e?.name, message: e?.message, where }),
    }).catch(() => {});
  } catch { /* reporting must never break the page further */ }
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { hasError: false };

  componentDidMount() {
    window.addEventListener("hashchange", this.handleRouteChange);
  }

  componentWillUnmount() {
    window.removeEventListener("hashchange", this.handleRouteChange);
  }

  handleRouteChange = () => {
    if (this.state.hasError) this.setState({ hasError: false, detail: undefined });
  };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    console.error("App error:", error, info);
    const where = String(info?.componentStack || "").split("\n").map((x: string) => x.trim()).filter(Boolean).slice(0, 3).join(" < ");
    this.setState({ detail: `${error?.name || "Error"}: ${error?.message || "unknown"}${where ? ` @ ${where}` : ""} · ${location.hash || "/"}`.slice(0, 400) });
    reportCrash(error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, detail: undefined });
    const role = savedRole();
    if (role === "teacher" || role === "admin") window.location.hash = "#/workhub";
    else if (role === "parent" || role === "todo") window.location.hash = "#/lifehub";
    else if (role === "guest") window.location.hash = "#/signin";
    else window.location.hash = "#/library";
  };

  render() {
    if (this.state.hasError) {
      const role = savedRole();
      const adult = role === "teacher" || role === "admin" || role === "parent" || role === "todo";
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center p-8 max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-primary text-primary-foreground flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2 text-foreground">Something went wrong</h2>
            <p className="text-sm text-muted-foreground mb-4">
              That page couldn’t finish loading. We’ve been told about it. Reloading usually fixes it.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={this.handleReload}
                className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors"
              >
                Reload the page
              </button>
              <button
                onClick={this.handleHome}
                className="px-6 py-2.5 rounded-xl border border-border font-semibold text-sm text-foreground hover:bg-muted transition-colors"
              >
                {adult ? "Back to my hub" : role === "guest" ? "Go to sign in" : "Back to Library"}
              </button>
            </div>
            {isNativeApp() && this.state.detail && <p className="mt-6 select-text break-words text-left font-mono text-[11px] leading-snug text-muted-foreground" data-testid="error-detail">{this.state.detail}</p>}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
