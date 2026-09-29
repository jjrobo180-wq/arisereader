import { getBrandSuffix, getMascotEmoji, getTeacherBand } from "@/lib/schoolTheme";

export function BrandText() {
  const suffix = getBrandSuffix();
  const emoji = getMascotEmoji();
  const band = getTeacherBand();
  return (
    <span className="font-bold text-sm sm:text-base lg:text-lg tracking-wide whitespace-nowrap">
      {emoji && <span className="mr-1">{emoji}</span>}
      A.R.I.S.E<span className="text-primary"> {suffix}</span>
      <span className="ml-1.5 rounded-full border border-primary/30 bg-primary/15 px-1.5 py-0.5 align-middle text-[9px] font-black tracking-wider text-primary sm:text-[10px]">2.0</span>
      {band && <span className="text-xs text-muted-foreground ml-2">({band} Band)</span>}
    </span>
  );
}
