// "Support A.R.I.S.E.": a quiet heart button for the header, a one-line banner for Home, and the sheet
// they both open — Mr. J's story in a few lines and the donation link saved in Admin → Donation goal.
// It never opens on its own. The banner can't be closed: it stays on Home in both hubs and on the Reader.
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, Heart, Lock, X } from "lucide-react";
import { API_BASE } from "@/lib/queryClient";
import { appHref } from "@/lib/hubs";
import type { DonateInfo } from "@shared/donate";

let cached: Promise<DonateInfo | null> | null = null;
/** The saved donation link, asked for once per page load and shared by every button and banner. */
function loadDonateInfo(): Promise<DonateInfo | null> {
  if (!cached) cached = fetch(`${API_BASE}/api/donate-link`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  return cached;
}

export function useDonateInfo(): DonateInfo | null {
  const [info, setInfo] = useState<DonateInfo | null>(null);
  useEffect(() => { let live = true; void loadDonateInfo().then((i) => { if (live) setInfo(i); }); return () => { live = false; }; }, []);
  return info;
}

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

/** The sheet: who built this, why it's free, and one clear way to help. */
export function SupportSheet({ info, onClose }: { info: DonateInfo | null; onClose: () => void }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const pct = info?.goal ? Math.min(100, Math.round((info.goal.raised / info.goal.target) * 100)) : 0;
  return <div className="fixed inset-0 kb-sheet z-[90] flex items-end justify-center bg-slate-950/55 backdrop-blur-sm sm:items-center sm:p-6" onClick={onClose} data-testid="support-sheet">
    <div role="dialog" aria-modal="true" aria-labelledby="support-title" onClick={(e) => e.stopPropagation()}
      className="max-h-[92dvh] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[1.75rem] bg-white text-slate-800 shadow-2xl sm:rounded-[1.75rem]">
      <div className="relative bg-gradient-to-br from-rose-50 via-white to-violet-50 px-6 pb-5 pt-6">
        <button type="button" onClick={onClose} aria-label="Close" className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-white"><X size={18} /></button>
        <div className="flex items-center gap-4">
          <img src="/about/mr-j-portrait.webp?v=20261001" alt="Mr. J, who built A.R.I.S.E." className="h-16 w-16 shrink-0 rounded-2xl object-cover object-top shadow-md ring-2 ring-white" />
          <div className="min-w-0">
            <p className="text-[11px] font-extrabold uppercase tracking-[.16em] text-rose-600">Support A.R.I.S.E.</p>
            <h2 id="support-title" className="mt-0.5 text-xl font-black leading-tight tracking-tight text-slate-900">Built by one teacher. Free for every family.</h2>
          </div>
        </div>
      </div>
      <div className="space-y-4 px-6 pb-6 pt-2 text-[15px] leading-relaxed text-slate-600">
        <p>Hi, I'm Mr. J — a teacher and a dad. When my daughter Ariana was diagnosed with autism at four, we practiced every day that summer with prizes and celebration, and she took off. That's where A.R.I.S.E. came from. <span className="font-semibold text-slate-800">The A.R.I. is for Ariana.</span></p>
        <p>A.R.I.S.E. has no ads and never sells your family's information. I'm not making money from it. The servers, the reading library and the AI cost real money every month, and right now that comes out of my pocket.</p>
        <p className="font-semibold text-slate-800">If it has helped your child, any amount keeps it free for the next family.</p>
        {info?.goal && <div className="rounded-2xl bg-slate-50 p-4" data-testid="support-goal">
          <div className="flex items-baseline justify-between text-sm"><span className="font-bold text-slate-800">{money(info.goal.raised)} raised</span><span className="text-slate-500">of {money(info.goal.target)}</span></div>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-gradient-to-r from-rose-500 to-violet-500" style={{ width: `${pct}%` }} /></div>
        </div>}
        {info
          ? <a href={info.url} target="_blank" rel="noopener noreferrer" className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-5 text-base font-extrabold text-white shadow-[0_10px_24px_-10px_#e11d48] transition hover:bg-rose-700" data-testid="support-donate">
              <Heart size={18} className="fill-current" /> Donate
            </a>
          : <p className="rounded-2xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">Donations are opening soon. Thank you for being here.</p>}
        {info?.stripe && <p className="-mt-2 flex items-center justify-center gap-1.5 text-xs text-slate-400"><Lock size={12} /> Secure checkout with Stripe. You choose the amount.</p>}
        <a href={appHref("/about")} className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl text-sm font-bold text-violet-700 hover:bg-violet-50">Read my full story <ExternalLink size={14} /></a>
      </div>
    </div>
  </div>;
}

/** The header button. Quiet but always there: a rose heart, with the word "Support" on wider screens. */
export function SupportButton({ isAdmin = false, className = "" }: { isAdmin?: boolean; className?: string }) {
  const info = useDonateInfo();
  const [open, setOpen] = useState(false);
  // Until a link is saved, only the admin sees it (with a reminder of where to add one).
  if (!info && !isAdmin) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Support A.R.I.S.E." title={info ? "Support A.R.I.S.E." : "Add your donation link in Admin → Donation goal"}
      className={`inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-sm font-bold text-rose-700 transition hover:bg-rose-100 ${className}`} data-testid="support-button">
      <Heart size={16} className="fill-current" /><span className="hidden md:inline">Support</span>
    </button>
    {/* On the page itself, not inside the header (whose blur would trap a "fixed" pop-up in its own height). */}
    {open && createPortal(<SupportSheet info={info} onClose={() => setOpen(false)} />, document.body)}
  </>;
}

/** The donation banner. It always shows (there is no close button) wherever it's placed: Home in
 *  both hubs and every screen of the Reader. `dark` is the Reader's dark purple version. */
export function SupportBanner({ dark = false }: { dark?: boolean }) {
  const info = useDonateInfo();
  const [open, setOpen] = useState(false);
  if (!info) return null;
  return <>
    <div className={`flex items-center rounded-2xl border sm:flex-wrap ${dark ? "gap-2.5 border-rose-400/30 bg-[#24121c] px-3 py-2" : "gap-3 border-rose-200/80 bg-gradient-to-r from-rose-50 to-violet-50 px-3 py-2.5 sm:px-4 sm:py-3"}`} data-testid="support-banner">
      <span className={`hidden shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white sm:inline-flex ${dark ? "h-7 w-7" : "h-9 w-9"}`}><Heart size={dark ? 14 : 17} className="fill-current" /></span>
      {/* On a phone, two short lines next to the button instead of a tall box. */}
      <p className={`min-w-0 flex-1 text-[13px] leading-snug sm:hidden ${dark ? "text-rose-100/85" : "text-slate-700"}`}><span className={`font-bold ${dark ? "text-white" : "text-slate-900"}`}>Every child deserves to be heard.</span> Help give free talkers and eye-gaze tools to kids with disabilities.</p>
      <p className={`hidden min-w-0 flex-1 sm:block ${dark ? "text-[13px] text-rose-100/85" : "text-sm text-slate-700"}`}><span className={`font-bold ${dark ? "text-white" : "text-slate-900"}`}>Every child deserves to be heard.</span> Join our mission to give every child with a disability a free talker and eye-gaze tools, so they can share their thoughts, ask questions and read on their own. A.R.I.S.E. is free with no ads, built by one teacher and carried by people like you.</p>
      <button type="button" onClick={() => setOpen(true)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-rose-600 px-3 text-sm font-bold text-white hover:bg-rose-700 sm:px-4 ${dark ? "min-h-9" : "min-h-10"}`} data-testid="support-banner-open"><Heart size={14} className="fill-current" /> Support</button>
    </div>
    {open && createPortal(<SupportSheet info={info} onClose={() => setOpen(false)} />, document.body)}
  </>;
}

/** A menu item that opens the donation sheet: the hubs' and the Reader's sidebars use it, each
 *  passing its own button look. Shows once a donation link is saved (or always for the admin). */
export function SupportMenuItem({ isAdmin = false, className, children, testId = "support-menu-item" }: { isAdmin?: boolean; className: string; children: ReactNode; testId?: string }) {
  const info = useDonateInfo();
  const [open, setOpen] = useState(false);
  if (!info && !isAdmin) return null;
  return <>
    <button type="button" onClick={() => setOpen(true)} className={className} title="Support A.R.I.S.E." data-testid={testId}>{children}</button>
    {open && createPortal(<SupportSheet info={info} onClose={() => setOpen(false)} />, document.body)}
  </>;
}
