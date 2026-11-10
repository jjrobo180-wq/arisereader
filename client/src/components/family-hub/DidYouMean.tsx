// A one-tap "Did you mean …?" under a box where food is typed. Nothing changes until it's tapped.
import { useMemo } from "react";
import { didYouMean } from "@shared/didYouMean";

export default function DidYouMean({ text, onPick, extra, className = "" }: { text: string; onPick: (fixed: string) => void; extra?: string[]; className?: string }) {
  const fix = useMemo(() => (text.replace(/[^a-z]/gi, "").length >= 3 ? didYouMean(text, extra) : null), [text, extra]);
  if (!fix) return null;
  return <p className={`text-sm text-slate-600 ${className}`} data-testid="did-you-mean">
    Did you mean <button type="button" onClick={() => onPick(fix)} className="font-semibold text-violet-700 underline underline-offset-2">{fix}</button>?
  </p>;
}
