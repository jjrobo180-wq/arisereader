// The Arise All Access offer for the iPhone apps' sign-up and upgrade screens (shared/allAccess.ts).
// US App Store: the price and a link to buy it on the website. Elsewhere: what's included, no price.
import { Check, ExternalLink } from "lucide-react";
import { ALL_ACCESS, usRegion } from "@shared/allAccess";

export default function AllAccessOffer({ dark = false, className = "", note }: { dark?: boolean; className?: string; note?: string }) {
  const us = usRegion();
  const ink = dark ? "text-white" : "text-[#111018]", soft = dark ? "text-white/65" : "text-[#6b6879]";
  return <section data-testid="all-access-offer" className={`rounded-[16px] p-4 text-left ${dark ? "bg-white/[.06] ring-1 ring-white/10" : "bg-white ring-1 ring-black/[.06]"} ${className}`}>
    <div className="flex items-baseline justify-between gap-3">
      <p className={`text-[16px] font-bold ${ink}`}>{ALL_ACCESS.name}</p>
      {us && <p className={`text-[15px] font-bold ${ink}`}>{ALL_ACCESS.price}<span className={`ml-1 text-[13px] font-medium ${soft}`}>{ALL_ACCESS.per}</span></p>}
    </div>
    <p className={`mt-0.5 text-[13px] ${soft}`}>One plan for every Arise app. Signing up is free.</p>
    <ul className="mt-2.5 space-y-1.5">{ALL_ACCESS.perks.map((p) => <li key={p} className={`flex gap-2 text-[13.5px] ${ink}`}><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#5b4fe0]" aria-hidden />{p}</li>)}</ul>
    {us
      ? <a href={ALL_ACCESS.url} target="_blank" rel="noreferrer" data-testid="all-access-offer-link" className="mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#5b4fe0] text-[15px] font-semibold text-white active:opacity-80">Get it on arisetodo.com<ExternalLink className="h-4 w-4" aria-hidden /></a>
      : <p className={`mt-3 text-[12.5px] ${soft}`}>{note ?? "Already have it? It works here when you sign in."}</p>}
  </section>;
}
