import type { ReactNode } from "react";
import { useLocation } from "wouter";
import "@/pages/pricing.css";
import "./signup-shell.css";

/**
 * The light frame every sign-up page shares, so it looks and feels like the
 * homepage and the pricing page: same header, same lavender glow, same white card.
 */
export function SignupShell({ eyebrow, title, titleId, intro, children, below }: {
  eyebrow: string;
  title: ReactNode;
  titleId?: string;
  intro?: ReactNode;
  children: ReactNode;
  below?: ReactNode;
}) {
  const [, navigate] = useLocation();
  return (
    <main className="pr signup-light min-h-screen bg-[#f7f8ff] text-[#191b35]">
      <div className="pr-glow pr-glow-a" aria-hidden="true" />
      <div className="pr-glow pr-glow-b" aria-hidden="true" />
      <header className="relative mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-6">
        <button type="button" className="text-xl font-black tracking-tight" onClick={() => navigate("/")}>A.R.I.S.E. <span className="text-violet-700">Reader</span></button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate("/pricing")} className="rounded-full px-3 py-2 text-sm font-bold text-slate-700 hover:text-violet-700">Pricing</button>
          <button type="button" onClick={() => navigate("/signin")} className="rounded-full bg-violet-700 px-5 py-3 text-sm font-bold text-white hover:bg-violet-800">Sign in</button>
        </div>
      </header>
      <section className="relative mx-auto max-w-2xl px-5 pb-6 pt-4 text-center">
        <p className="text-xs font-black uppercase tracking-[.22em] text-violet-700">{eyebrow}</p>
        <h1 id={titleId} className="mt-3 text-4xl font-black leading-tight tracking-tight sm:text-5xl">{title}</h1>
        {intro && <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-600">{intro}</p>}
      </section>
      <div className="relative mx-auto max-w-2xl px-5 pb-12">
        <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-xl shadow-violet-100 sm:p-8">{children}</div>
        {below}
        <p className="mt-8 text-center text-xs text-slate-500">A.R.I.S.E. — Advocating, Resilience, Inclusion, Support, Empowerment.</p>
      </div>
    </main>
  );
}

/** Shared inline styles for the pages that are styled with style={...}. */
export const lightStyles: Record<string, React.CSSProperties> = {
  form: { display: "grid", gap: 18 },
  label: { display: "grid", gap: 8, color: "#191b35", fontWeight: 700, fontSize: 14 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    background: "#fff",
    border: "1px solid #dfe2ee",
    borderRadius: 13,
    color: "#191b35",
    fontSize: 16,
    minHeight: 50,
    padding: "11px 13px",
    outlineColor: "#6d28d9",
  },
  infoBox: {
    display: "flex",
    gap: 12,
    background: "#f5f3ff",
    border: "1px solid #ddd6fe",
    borderRadius: 16,
    color: "#3b3f5c",
    fontSize: 15,
    lineHeight: 1.55,
    padding: 16,
  },
  primaryButton: {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
    minHeight: 52,
    border: 0,
    borderRadius: 13,
    background: "#6d28d9",
    color: "white",
    cursor: "pointer",
    fontSize: 16,
    fontWeight: 800,
    boxShadow: "0 8px 24px rgba(109,40,217,.2)",
  },
  error: { borderRadius: 12, padding: 12, background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontWeight: 600 },
  note: { borderRadius: 12, padding: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46" },
  success: { display: "flex", alignItems: "flex-start", gap: 12, background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 14, color: "#065f46", fontSize: 16, lineHeight: 1.5, padding: 18, marginBottom: 24 },
  linkButton: { justifySelf: "center", color: "#6d28d9", background: "transparent", border: 0, cursor: "pointer", fontSize: 15, fontWeight: 700, minHeight: 44, padding: "0 12px", textDecoration: "underline" },
  backButton: { display: "inline-flex", alignItems: "center", gap: 8, color: "#6d28d9", background: "transparent", border: 0, cursor: "pointer", fontSize: 15, fontWeight: 700, marginTop: 22, padding: 0 },
  hint: { display: "block", color: "#64748b", fontSize: 13, marginTop: 5, lineHeight: 1.5, fontWeight: 500 },
};
