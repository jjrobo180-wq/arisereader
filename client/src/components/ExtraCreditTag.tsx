// The small note at the top of each book quiz cover in the library: extra credit for the
// written reading comprehension at the end of the quiz (see shared/comprehension.ts).
import { COVER_NOTE } from "@shared/comprehension";

export default function ExtraCreditTag() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[1] bg-gradient-to-b from-black/85 via-black/60 to-transparent px-2 pb-5 pt-1.5 text-left text-[9px] font-semibold leading-tight text-white sm:text-[10px]"
      data-testid="extra-credit-tag"
    >
      <span className="mr-1 inline-block rounded bg-emerald-400 px-1 text-[8px] font-black uppercase tracking-wide text-emerald-950 sm:text-[9px]">New!</span>
      {COVER_NOTE}
    </div>
  );
}
