// "Get the app": a card that links to the Arise Reader iPhone app, with the App Store button (Apple logo).
// One look for students and families ("light") and one for the dark Reader screens of teachers, parents
// and admins ("dark"). Shows nothing inside the app itself, and nothing until a link is set in
// client/public/app-links.json.
import { useReaderAppUrl } from "@/lib/appLinks";

/** The Apple logo, as a single shape that takes the text colour. */
export function AppleLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="currentColor">
      <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701" />
    </svg>
  );
}

export default function GetReaderApp({ tone = "light", who = "you", className = "" }: { tone?: "light" | "dark"; who?: "you" | "your child" | "your class" | "everyone"; className?: string }) {
  const url = useReaderAppUrl();
  if (!url) return null;
  const dark = tone === "dark";
  const line = who === "your child" ? "Reading, quizzes and rewards on your child's iPhone or iPad."
    : who === "your class" ? "Your class, quizzes and messages, right on your iPhone or iPad."
    : "Read, take quizzes and earn rewards on your iPhone or iPad.";
  return (
    <section aria-label="Get the Arise Reader app" data-testid="get-reader-app"
      className={`relative overflow-hidden rounded-2xl border p-4 ${dark ? "" : "border-indigo-200 shadow-sm"} ${className}`}
      style={dark
        ? { borderColor: "#4a43a8", background: "linear-gradient(135deg,#2d2680 0%,#1d1a4d 55%,#16142f 100%)" }
        : { background: "linear-gradient(135deg,#eef0ff 0%,#f7f3ff 60%,#fff 100%)" }}>
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full opacity-40 blur-2xl" style={{ background: dark ? "#7c6cff" : "#a5b4fc" }} />
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-3">
        <img src="/reader-app-icon.png" alt="" className="h-14 w-14 shrink-0 rounded-[14px] shadow-lg" style={{ boxShadow: dark ? "0 6px 18px #0008" : "0 6px 16px #4338ca33" }} />
        <div className="min-w-0 flex-[1_1_200px]">
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em]" style={{ color: dark ? "#b6b0ff" : "#4f46e5" }}>New · Free on the App Store</p>
          <h2 className={`mt-0.5 text-[19px] font-black leading-tight ${dark ? "text-white" : "text-slate-900"}`}>Arise Reader is now an app</h2>
          <p className={`mt-1 text-[13px] leading-snug ${dark ? "" : "text-slate-600"}`} style={dark ? { color: "#d3d0f5" } : undefined}>{line}</p>
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Download Arise Reader on the App Store" data-testid="get-reader-app-link"
          className="inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl bg-black px-5 text-white transition active:scale-[.98] sm:w-auto"
          style={{ border: "1px solid #ffffff55" }}>
          <AppleLogo className="h-7 w-7" />
          <span className="text-left leading-none"><span className="block text-[10px] font-semibold">Download on the</span><span className="block text-[19px] font-semibold tracking-tight">App Store</span></span>
        </a>
      </div>
    </section>
  );
}
