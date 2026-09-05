import { getBrandSuffix } from "@/lib/schoolTheme";

export function BrandText() {
  const suffix = getBrandSuffix();
  return (
    <span className="font-bold text-base sm:text-lg tracking-wide whitespace-nowrap">
      A.R.I.S.E<span className="text-primary"> {suffix}</span>
    </span>
  );
}
