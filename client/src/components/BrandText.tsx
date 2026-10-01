import { getBrandSuffix, getMascotEmoji, getTeacherBand } from "@/lib/schoolTheme";

export function BrandText() {
  const suffix = getBrandSuffix();
  const emoji = getMascotEmoji();
  const band = getTeacherBand();
  return (
    <span className="font-bold text-sm sm:text-base lg:text-lg tracking-wide whitespace-nowrap">
      {emoji && <span className="mr-1">{emoji}</span>}
      A.R.I.S.E<span className="arise-gradient-text"> {suffix}</span>
      <span className="ml-1.5 rounded-full border border-violet-400/25 bg-gradient-to-r from-violet-500/15 via-fuchsia-500/10 to-cyan-400/15 px-1.5 py-0.5 align-middle text-[9px] font-black tracking-wider text-violet-200 sm:text-[10px]">2.0</span>
      {band && <span className="text-xs text-muted-foreground ml-2">({band} Band)</span>}
    </span>
  );
}
