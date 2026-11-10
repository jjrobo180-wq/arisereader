// The one-time "send my text to AI?" question. Mounted once in App.tsx; opened by askAiConsent()
// (client/src/lib/aiConsent.ts) from the fetch wrapper in main.tsx.
import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { AI_PROVIDERS, answerAiConsent } from "@/lib/aiConsent";

export default function AiConsentSheet() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener("arise:ai-consent-ask", show);
    return () => window.removeEventListener("arise:ai-consent-ask", show);
  }, []);
  if (!open) return null;
  const answer = (yes: boolean) => { setOpen(false); answerAiConsent(yes); };
  return (
    <div className="fixed inset-0 z-[400] flex items-end justify-center bg-slate-950/60 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="ai-consent-title" data-testid="ai-consent">
      <div className="w-full max-w-md rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700"><Sparkles className="h-6 w-6" aria-hidden="true" /></span>
        <h2 id="ai-consent-title" className="mt-3 text-xl font-extrabold text-slate-900">Send what you type to AI?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          AI features send the text you type (and what you ask about, like a meal or a note) to our AI providers, {AI_PROVIDERS}, to write the answer. They do not use it for ads, and we don't sell it.
          You can say no and keep using the rest of the app.
        </p>
        <p className="mt-2 text-sm text-slate-600">
          <a className="font-semibold text-violet-700 underline" href="https://arisetodo.com/privacy/" target="_blank" rel="noreferrer">Read the Privacy Policy</a>
        </p>
        <div className="mt-5 grid gap-2">
          <button type="button" onClick={() => answer(true)} className="min-h-12 rounded-2xl bg-violet-700 px-4 text-base font-bold text-white" data-testid="ai-consent-allow">Allow</button>
          <button type="button" onClick={() => answer(false)} className="min-h-12 rounded-2xl bg-slate-100 px-4 text-base font-bold text-slate-800" data-testid="ai-consent-deny">Not now</button>
        </div>
      </div>
    </div>
  );
}
