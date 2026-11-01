// Private and Strict modes (Notes iPhone app only): where a recording is written down and summarized.
//   Standard  Arise's servers write it down (most accurate, speaker labels, every language).
//   Private   The iPhone writes it down; the audio never leaves it. The text goes to Arise for the
//             summary, to-dos and Ask your notes.
//   Strict    The iPhone writes it down and its own AI writes the summary. Nothing leaves the iPhone.
// The person's usual choice is remembered on the phone; each recording can change it.
import { useEffect, useState, type ReactNode } from "react";
import { Cloud, Lock, ShieldCheck } from "lucide-react";
import { onDeviceAvailable, onDeviceStatus, type OnDeviceStatus, type PrivacyLevel } from "@/lib/onDevice";
import { Btn, Notice, Sheet } from "./ui";

const KEY = "arise-notes-privacy";
const SEEN = "arise-notes-privacy-seen";
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* not kept */ } };

export const isPrivacyLevel = (v: unknown): v is PrivacyLevel => v === "standard" || v === "private" || v === "strict";
/** The usual mode on this phone (Standard on the website and until someone picks another). */
export const defaultPrivacy = (): PrivacyLevel => { const v = get(KEY); return onDeviceAvailable() && isPrivacyLevel(v) ? v : "standard"; };
export const rememberPrivacy = (v: PrivacyLevel) => set(KEY, v);

export const MODE_TEXT: Record<PrivacyLevel, { name: string; short: string; good: string[]; cons: string[] }> = {
  standard: {
    name: "Standard",
    short: "Arise's servers write it down. The most accurate, with every feature.",
    good: ["The most accurate, even in noisy rooms or with accents", "Speaker labels (Plus and Family)", "About 100 languages", "Long uploads are quick and don't use the battery"],
    cons: ["The audio is sent to Arise to be written down (it's deleted afterwards unless you choose to keep it)"],
  },
  private: {
    name: "Private",
    short: "This iPhone writes it down. The audio never leaves your phone.",
    good: ["The recording is never uploaded or stored by Arise", "Summaries, to-dos, Ask your notes and your planner all still work", "Good for sensitive meetings"],
    cons: [
      "The transcript text is still sent to Arise for the summary and to-dos",
      "A little less accurate than Standard, especially with noise, accents, people talking over each other, or specialist words",
      "No speaker labels",
      "Fewer languages, and it needs a newer iPhone",
      "Uses the battery and warms the phone; long uploads take a few minutes to write down",
      "Keep Arise Notes open while it works: iOS pauses it in the background",
      "Still uses your plan's minutes (the summary is written by Arise)",
    ],
  },
  strict: {
    name: "Strict",
    short: "Nothing leaves this iPhone, not the audio, not the text.",
    good: ["The audio, transcript and summary stay only on this iPhone", "Doesn't use any of your minutes", "Works with no internet once it's set up", "For the most sensitive meetings"],
    cons: [
      "Everything in Private's list about accuracy, speaker labels, languages and battery",
      "The summary is written by the iPhone's own AI: shorter and simpler than Standard's, with no IEP draft or parent email",
      "Needs iOS 26 and Apple Intelligence (iPhone 15 Pro or newer) for the summary; otherwise you get the transcript only",
      "The note is only on this iPhone: it isn't in Ask your notes, on the website, shared, or backed up by Arise. Deleting the app deletes it",
      "To-dos can go to Apple Reminders and the Calendar, but not to Arise To Duo",
    ],
  },
};

/** Which modes this iPhone can use, and why not. */
export function modeProblem(level: PrivacyLevel, st: OnDeviceStatus | null): string {
  if (level === "standard") return "";
  if (!st) return "Needs the newest Arise Notes iPhone app.";
  if (!st.onDevice) return "This iPhone can't write down speech on the device in your language.";
  if (st.speech === "denied" || st.speech === "restricted") return "Speech recognition is off for Arise Notes in Settings → Privacy & Security → Speech Recognition.";
  return "";
}
export const strictSummaryWorks = (st: OnDeviceStatus | null) => st?.ai === "available";
export const strictSummaryWhy = (st: OnDeviceStatus | null) =>
  st?.ai === "off" ? "Apple Intelligence is off (Settings → Apple Intelligence & Siri), so Strict notes get a transcript but no summary."
    : st?.ai === "downloading" ? "Apple Intelligence is still getting ready on this iPhone. Until then, Strict notes get a transcript and the summary can be written later."
      : "This iPhone doesn't have Apple Intelligence (iOS 26 on iPhone 15 Pro or newer), so Strict notes get a transcript but no summary.";

export function useOnDevice() {
  const [st, setSt] = useState<OnDeviceStatus | null>(null);
  const [ready, setReady] = useState(!onDeviceAvailable());
  useEffect(() => { if (onDeviceAvailable()) void onDeviceStatus().then((s) => { setSt(s); setReady(true); }); }, []);
  return { st, ready, available: onDeviceAvailable() };
}

const ICON: Record<PrivacyLevel, ReactNode> = { standard: <Cloud className="h-5 w-5" />, private: <ShieldCheck className="h-5 w-5" />, strict: <Lock className="h-5 w-5" /> };

/** The three modes on the record and upload screens. Only in the iPhone app. */
export function PrivacyPicker({ value, onChange, st }: { value: PrivacyLevel; onChange: (v: PrivacyLevel) => void; st: OnDeviceStatus | null }) {
  const [explain, setExplain] = useState<PrivacyLevel | null>(null);
  const pick = (v: PrivacyLevel) => {
    if (modeProblem(v, st)) { setExplain(v); return; }
    // The first time someone picks a private mode, the trade-offs are shown before it's used.
    if (v !== "standard" && get(`${SEEN}-${v}`) !== "1") { setExplain(v); return; }
    onChange(v);
  };
  return <div data-testid="notes-privacy">
    <div className="mb-1.5 flex items-center gap-2"><span className="text-[14px] font-bold">Privacy</span><button type="button" className="ml-auto text-[13px] font-semibold text-[var(--an-violet)] underline-offset-2 hover:underline" onClick={() => setExplain(value)}>What's the difference?</button></div>
    <div role="radiogroup" aria-label="Privacy" className="grid gap-2 sm:grid-cols-3">
      {(["standard", "private", "strict"] as PrivacyLevel[]).map((v) => {
        const off = !!modeProblem(v, st);
        return <button key={v} type="button" role="radio" aria-checked={value === v} onClick={() => pick(v)} data-testid={`notes-privacy-${v}`}
          className={`rounded-2xl border p-3 text-left transition ${value === v ? "border-[var(--an-violet)] bg-[#f7f5ff] ring-1 ring-[var(--an-violet)]" : "border-[var(--an-line)] bg-white"} ${off ? "opacity-60" : ""}`}>
          <span className="flex items-center gap-2 text-[15px] font-bold text-[var(--an-violet-ink)]">{ICON[v]}{MODE_TEXT[v].name}</span>
          <span className="mt-1 block text-[13px] leading-snug text-[var(--an-muted)]">{MODE_TEXT[v].short}</span>
        </button>;
      })}
    </div>
    {value === "strict" && !strictSummaryWorks(st) && <Notice tone="warn">{strictSummaryWhy(st)}</Notice>}
    {explain && <ModeSheet level={explain} st={st} onClose={() => setExplain(null)} onUse={() => { set(`${SEEN}-${explain}`, "1"); onChange(explain); setExplain(null); }} />}
  </div>;
}

/** The trade-offs of one mode, in plain words. */
export function ModeSheet({ level, st, onClose, onUse }: { level: PrivacyLevel; st: OnDeviceStatus | null; onClose: () => void; onUse?: () => void }) {
  const t = MODE_TEXT[level];
  const problem = modeProblem(level, st);
  return <Sheet title={<span className="flex items-center gap-2">{ICON[level]}{t.name} mode</span>} onClose={onClose}>
    <p className="text-[15px] leading-relaxed">{t.short}</p>
    <h3 className="mt-4 text-[14px] font-bold text-[var(--an-green)]">Good for</h3>
    <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px] leading-snug">{t.good.map((g) => <li key={g}>{g}</li>)}</ul>
    {t.cons.length > 0 && <><h3 className="mt-4 text-[14px] font-bold text-[#9c1c2a]">Trade-offs</h3>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-[14px] leading-snug">{t.cons.map((c) => <li key={c}>{c}</li>)}</ul></>}
    {problem && <Notice tone="bad">{problem}</Notice>}
    {level === "strict" && !problem && !strictSummaryWorks(st) && <Notice tone="warn">{strictSummaryWhy(st)}</Notice>}
    <div className="mt-5 flex gap-2">
      {onUse && !problem && <Btn kind="primary" className="flex-1" onClick={onUse} data-testid="notes-privacy-use">Use {t.name}</Btn>}
      <Btn kind="plain" className="flex-1" onClick={onClose}>{onUse && !problem ? "Not now" : "Close"}</Btn>
    </div>
  </Sheet>;
}
