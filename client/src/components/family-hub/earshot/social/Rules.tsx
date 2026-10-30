// Community rules, report reasons and the policy links for Pod+ Social and Earshot Social (LifeHub).
// App Review Guideline 1.2 asks apps with posts from people to have terms people agree to (with
// zero tolerance for objectionable content and abusive users), a way to report content and people,
// a way to block people, and published contact details. Those last links live here too.
import { Flag } from "lucide-react";
import { ActionSheet, type Api } from "./kit";

/** True on the Pod+ website or in the Pod+ iPhone app (its pages run from capacitor://localhost). */
const onPod = () => typeof window !== "undefined" && (/podscroll|podplus/i.test(location.hostname) || (window as any).__PODPLUS__ === true);
const podBase = "https://podscroll.onrender.com";
const ariseBase = "https://arisetodo.com";
export const policyLinks = () => {
  const base = onPod() ? podBase : ariseBase;
  return { terms: `${base}/terms/`, rules: `${base}/terms/#community`, privacy: `${base}/privacy/`, support: `${base}/support/` };
};

export const RULES = [
  "No hate, harassment, bullying or threats. Zero tolerance: accounts that do this are removed.",
  "No sexual or nude content, and nothing that puts kids at risk.",
  "No violence, self-harm encouragement or illegal activity.",
  "No spam, scams or pretending to be someone else.",
  "Only post what you made or have the right to share.",
];

/** The rules and a checkbox, shown before someone makes a profile. */
export function RulesAgree({ agreed, onChange }: { agreed: boolean; onChange: (v: boolean) => void }) {
  const links = policyLinks();
  return <div className="elev mt-5 rounded-2xl p-4" data-testid="social-rules">
    <p className="text-[15px] font-bold">Community rules</p>
    <ul className="mt-2 list-disc space-y-1 pl-5 text-[13.5px] leading-snug">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
    <p className="muted mt-2 text-[12.5px] leading-snug">Report anything that breaks them from its ⋯ menu, and block anyone you don't want to hear from. We look at every report within 24 hours and remove content and accounts that break the rules.</p>
    <label className="mt-3 flex min-h-11 items-start gap-3 text-[14px] font-semibold">
      <input type="checkbox" checked={agreed} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 flex-none accent-[color:var(--accent)]" data-testid="social-rules-agree" />
      <span>I agree to the <a href={links.terms} target="_blank" rel="noreferrer" className="link underline">Terms of Use</a> and community rules, and I've read the <a href={links.privacy} target="_blank" rel="noreferrer" className="link underline">Privacy Policy</a>.</span>
    </label>
  </div>;
}

export const REPORT_REASONS = ["Spam", "Hate or harassment", "Sexual content", "Violence or threats", "Self-harm", "Someone under 13", "Something else"] as const;

/** Asks why, then sends the report. `path` is the report route (POST). Picking a reason closes the
 *  sheet at once; `onDone` hears how it went. */
export function ReportSheet({ api, path, what, onClose, onDone }: { api: Api; path: string; what: string; onClose: () => void; onDone: (message: string, ok: boolean) => void }) {
  return <ActionSheet onClose={onClose} items={REPORT_REASONS.map((reason) => ({
    label: reason, icon: <Flag size={18} />,
    onClick: () => {
      api(path, { method: "POST", body: { reason } })
        .then(() => onDone(`Thanks. We'll look at this ${what} within 24 hours.`, true))
        .catch((e: any) => onDone(e?.message || "That report didn't send. Try again.", false));
    },
  }))} />;
}
