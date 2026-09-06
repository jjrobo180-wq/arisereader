import { getBrandSuffix, getMascotEmoji, getTeacherBand } from "@/lib/schoolTheme";

export function BrandText() {
  const suffix = getBrandSuffix();
  const emoji = getMascotEmoji();
  const band = getTeacherBand();
  return (
    <span className="font-bold text-base sm:text-lg tracking-wide whitespace-nowrap">
      {emoji && <span className="mr-1">{emoji}</span>}
      A.R.I.S.E<span className="text-primary"> {suffix}</span>
      {band && <span className="text-xs text-muted-foreground ml-2">({band} Band)</span>}
    </span>
  );
}
