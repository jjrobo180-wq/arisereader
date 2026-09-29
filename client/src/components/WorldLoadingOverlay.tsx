type WorldLoadingOverlayProps = {
  label?: string;
  tone?: "club" | "block" | "universe";
};

export default function WorldLoadingOverlay({ label = "Traveling to the next world…", tone = "universe" }: WorldLoadingOverlayProps) {
  const glow = tone === "club"
    ? "from-fuchsia-500 via-violet-500 to-cyan-400"
    : tone === "block"
      ? "from-emerald-400 via-cyan-400 to-sky-500"
      : "from-cyan-400 via-violet-500 to-fuchsia-500";

  return (
    <div className="fixed inset-0 z-[1000] grid place-items-center overflow-hidden bg-[#050714] text-white">
      <div className={"absolute inset-0 bg-gradient-to-br "+glow+" opacity-20"} />
      <div className="absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-cyan-400/20 blur-3xl animate-pulse" />
      <div className="absolute -right-20 bottom-1/4 h-72 w-72 rounded-full bg-fuchsia-500/20 blur-3xl animate-pulse" />
      <div className="relative flex max-w-[90vw] flex-col items-center text-center">
        <div className="relative mb-7 grid h-36 w-36 place-items-center">
          <div className={"absolute inset-0 rounded-full bg-gradient-to-r "+glow+" opacity-35 blur-xl animate-pulse"} />
          <div className={"absolute inset-1 rounded-full bg-gradient-to-r "+glow+" animate-spin [animation-duration:2.4s]"} />
          <div className="absolute inset-3 rounded-full bg-[#070b1b]" />
          <div className="absolute inset-6 rounded-full border-2 border-white/25 animate-ping [animation-duration:1.8s]" />
          <div className="relative text-5xl drop-shadow-[0_0_18px_rgba(255,255,255,.45)]">🐝</div>
        </div>
        <p className="text-[11px] font-black uppercase tracking-[.32em] text-cyan-300">A.R.I.S.E. 2.0</p>
        <h2 className="mt-2 text-2xl font-black sm:text-3xl">{label}</h2>
        <p className="mt-2 text-sm font-bold text-white/55">Opening the portal…</p>
        <div className="mt-5 flex gap-2">
          <span className="h-2 w-2 rounded-full bg-cyan-300 animate-bounce" />
          <span className="h-2 w-2 rounded-full bg-violet-300 animate-bounce [animation-delay:120ms]" />
          <span className="h-2 w-2 rounded-full bg-fuchsia-300 animate-bounce [animation-delay:240ms]" />
        </div>
      </div>
    </div>
  );
}
