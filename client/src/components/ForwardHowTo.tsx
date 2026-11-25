// "How do I forward an email?": pick your email app and see exactly where its Forward button is
// (shared/forwardSteps.ts). Under the forwarding address in LifeHub and WorkHub.
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FORWARD_APPS, FORWARD_SENDER_TIP } from "@shared/forwardSteps";

export function ForwardHowTo({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [pick, setPick] = useState(FORWARD_APPS[0].id);
  const app = FORWARD_APPS.find((a) => a.id === pick) ?? FORWARD_APPS[0];
  return (
    <div className="mt-3 rounded-2xl bg-slate-50 dark:bg-white/5" data-testid="forward-how-to">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-[13px] font-bold text-slate-800 dark:text-white">
        How do I forward an email?<ChevronDown className={`h-4 w-4 shrink-0 text-slate-500 transition ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="px-3 pb-3">
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" role="tablist" aria-label="Your email app">
          {FORWARD_APPS.map((a) => <button key={a.id} type="button" role="tab" aria-selected={a.id === pick} onClick={() => setPick(a.id)} data-testid={`forward-app-${a.id}`}
            className={`min-h-9 shrink-0 rounded-full px-3 text-[13px] font-semibold ${a.id === pick ? "bg-[#6e5ae0] text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 dark:bg-white/10 dark:text-white dark:ring-0"}`}>{a.name}</button>)}
        </div>
        <ol className="mt-2 space-y-1.5" role="tabpanel" aria-label={`Forwarding in ${app.name}`}>
          {app.steps.map((s, i) => <li key={i} className="flex gap-2.5 text-[13px] leading-5 text-slate-700 dark:text-white/80">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#6e5ae0] text-[11px] font-black text-white">{i + 1}</span><span>{s}</span>
          </li>)}
        </ol>
        <p className="mt-2 text-[12px] leading-5 text-slate-500">{FORWARD_SENDER_TIP}</p>
      </div>}
    </div>
  );
}
