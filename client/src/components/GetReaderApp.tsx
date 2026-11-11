// "Get the app": a slim card that links to the Arise Reader iPhone app. One look for students and
// families ("light") and one for the dark Reader screens of teachers, parents and admins ("dark").
// Shows nothing inside the app itself, and nothing until a link is set in client/public/app-links.json.
import { Smartphone } from "lucide-react";
import { useReaderAppUrl } from "@/lib/appLinks";

export default function GetReaderApp({ tone = "light", who = "you", className = "" }: { tone?: "light" | "dark"; who?: "you" | "your child" | "your class" | "everyone"; className?: string }) {
  const url = useReaderAppUrl();
  if (!url) return null;
  const dark = tone === "dark";
  const line = who === "your child" ? "Reading, quizzes and rewards on your child's iPhone or iPad."
    : who === "your class" ? "Quizzes, progress and messages on your iPhone or iPad."
    : "Read, take quizzes and earn rewards on iPhone and iPad.";
  return (
    <section aria-label="Get the Arise Reader app" data-testid="get-reader-app"
      className={`flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-3 ${dark ? "" : "border-border bg-card shadow-sm"} ${className}`}
      style={dark ? { borderColor: "#3b3680", background: "#1c1a3a" } : undefined}>
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: dark ? "#2c2765" : "#eef0ff", color: dark ? "#c1bfff" : "#4338ca" }}><Smartphone className="h-5 w-5" aria-hidden /></span>
      <div className="min-w-0 flex-[1_1_240px]">
        <h2 className={`text-[16px] font-black leading-tight ${dark ? "text-white" : "text-foreground"}`}>Get the Arise Reader app</h2>
        <p className={`mt-0.5 text-[13px] leading-snug ${dark ? "" : "text-muted-foreground"}`} style={dark ? { color: "#c9c7ee" } : undefined}>{line}</p>
      </div>
      <a href={url} target="_blank" rel="noopener noreferrer" data-testid="get-reader-app-link"
        className="inline-flex min-h-10 items-center rounded-xl px-4 text-sm font-black" style={{ background: dark ? "#c1bfff" : "#4338ca", color: dark ? "#1a1740" : "#fff" }}>Download the app</a>
    </section>
  );
}
