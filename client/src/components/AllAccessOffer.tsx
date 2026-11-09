// The Arise All Access offer in the iPhone apps (shared/allAccess.ts), on sign-up and upgrade screens.
//  - App builds with Apple in-app purchase (lib/appleStore.ts): subscribe in the app at Apple's price.
//  - US App Store: also the website price and a link to buy it on arisetodo.com.
//  - Elsewhere, without in-app purchase: what's included, no price or link (App Review 3.1.1).
import { useEffect, useState } from "react";
import { Check, ExternalLink, Loader2 } from "lucide-react";
import { ALL_ACCESS, usRegion } from "@shared/allAccess";
import { LEGAL } from "@/lib/nativeApp";
import { allAccessApplePrice, appStoreCountry, appleStoreReady, buyAllAccessWithApple, restoreApplePurchases } from "@/lib/appleStore";

export default function AllAccessOffer({ dark = false, className = "", note, authToken, onBought }: {
  dark?: boolean; className?: string; note?: string;
  /** The signed-in account's session; without it (on sign-up) the in-app button asks them to make an account first. */
  authToken?: string | null; onBought?: () => void;
}) {
  const apple = appleStoreReady();
  const [applePrice, setApplePrice] = useState<string | null>(null);
  const [us, setUs] = useState(() => usRegion());
  const [busy, setBusy] = useState<"" | "buy" | "restore">("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    if (!apple) return;
    void allAccessApplePrice().then(setApplePrice);
    void appStoreCountry().then((c) => { if (c) setUs(c === "USA"); });
  }, [apple]);
  const buy = async () => {
    if (!authToken) return;
    setBusy("buy"); setMsg("");
    try {
      const r = await buyAllAccessWithApple(authToken);
      if (r.status === "purchased") { setMsg(r.live ? "You have All Access. Enjoy!" : "Purchase received. It switches on in a moment."); onBought?.(); }
      else if (r.status === "pending") setMsg("Waiting for approval. All Access switches on once it's approved.");
    } catch (e: any) { setMsg(e?.message || "The purchase didn't go through."); }
    setBusy("");
  };
  const restore = async () => {
    if (!authToken) return;
    setBusy("restore"); setMsg("");
    try { const r: any = await restoreApplePurchases(authToken); setMsg(r?.none ? "No All Access purchase was found for this Apple ID." : r?.live ? "Restored. You have All Access." : "Your All Access purchase has ended."); if (r?.live) onBought?.(); }
    catch (e: any) { setMsg(e?.message || "Couldn't restore purchases."); }
    setBusy("");
  };
  const ink = dark ? "text-white" : "text-[#111018]", soft = dark ? "text-white/65" : "text-[#6b6879]";
  const inApp = apple && !!applePrice;
  const shownPrice = inApp ? applePrice : us ? ALL_ACCESS.price : null;
  return <section data-testid="all-access-offer" className={`rounded-[16px] p-4 text-left ${dark ? "bg-white/[.06] ring-1 ring-white/10" : "bg-white ring-1 ring-black/[.06]"} ${className}`}>
    <div className="flex items-baseline justify-between gap-3">
      <p className={`text-[16px] font-bold ${ink}`}>{ALL_ACCESS.name}</p>
      {shownPrice && <p className={`text-[15px] font-bold ${ink}`}>{shownPrice}<span className={`ml-1 text-[13px] font-medium ${soft}`}>{ALL_ACCESS.per}</span></p>}
    </div>
    <p className={`mt-0.5 text-[13px] ${soft}`}>One plan for every Arise app. Signing up is free.</p>
    <ul className="mt-2.5 space-y-1.5">{ALL_ACCESS.perks.map((p) => <li key={p} className={`flex gap-2 text-[13.5px] ${ink}`}><Check className="mt-0.5 h-4 w-4 shrink-0 text-[#5b4fe0]" aria-hidden />{p}</li>)}</ul>
    {inApp && (authToken
      ? <>
          <button type="button" onClick={() => void buy()} disabled={!!busy} data-testid="all-access-apple-buy" className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[#5b4fe0] text-[15px] font-semibold text-white active:opacity-80 disabled:opacity-60">{busy === "buy" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Subscribe · {applePrice} a month</button>
          <button type="button" onClick={() => void restore()} disabled={!!busy} className={`mt-1 h-9 w-full text-[13px] font-semibold ${dark ? "text-white/80" : "text-[#5b4fe0]"}`}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</button>
        </>
      : <p className={`mt-3 text-[12.5px] ${soft}`}>Make your free account, then subscribe right in the app.</p>)}
    {us && <a href={ALL_ACCESS.url} target="_blank" rel="noreferrer" data-testid="all-access-offer-link" className={inApp ? `mt-1 flex h-10 w-full items-center justify-center gap-1.5 text-[13.5px] font-semibold ${dark ? "text-white/80" : "text-[#5b4fe0]"}` : "mt-3 flex h-11 w-full items-center justify-center gap-1.5 rounded-[12px] bg-[#5b4fe0] text-[15px] font-semibold text-white active:opacity-80"}>{inApp ? `Or get it on arisetodo.com for ${ALL_ACCESS.price}` : "Get it on arisetodo.com"}<ExternalLink className="h-4 w-4" aria-hidden /></a>}
    {!inApp && !us && <p className={`mt-3 text-[12.5px] ${soft}`}>{note ?? "Already have it? It works here when you sign in."}</p>}
    {msg && <p role="status" className={`mt-2 text-[13px] ${ink}`}>{msg}</p>}
    {inApp && <p className={`mt-2 text-[11px] leading-snug ${soft}`}>Renews monthly at {applePrice} until cancelled. Payment is charged to your Apple ID; cancel any time in Settings › Apple ID › Subscriptions at least 24 hours before it renews. <a href={LEGAL.terms} target="_blank" rel="noreferrer" className="underline">Terms of Use</a> · <a href={LEGAL.privacy} target="_blank" rel="noreferrer" className="underline">Privacy Policy</a></p>}
  </section>;
}
