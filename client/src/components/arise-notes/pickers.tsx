// Pieces shared by Record and Upload: the template choice, the consent reminder and the speaker switch.
import type { NotesTemplateId } from "@shared/ariseNotes";
import { Lock } from "lucide-react";
import type { Me } from "./api";
import { Toggle } from "./ui";

export function TemplatePicker({ me, value, onChange, onLocked }: { me: Me; value: NotesTemplateId; onChange: (t: NotesTemplateId) => void; onLocked: () => void }) {
  return <fieldset>
    <legend className="mb-2 text-[14px] font-bold">What kind of recording is it?</legend>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="radiogroup">
      {me.templates.map((t) => {
        const on = value === t.id;
        return <button key={t.id} type="button" role="radio" aria-checked={on} onClick={() => (t.allowed ? onChange(t.id) : onLocked())} data-testid={`notes-template-${t.id}`}
          className={`relative flex min-h-[86px] flex-col items-start gap-1 rounded-2xl border p-3 text-left transition ${on ? "border-[var(--an-violet)] bg-[var(--an-violet-soft)] ring-2 ring-[var(--an-violet)]" : "border-[var(--an-line)] bg-white hover:border-[var(--an-violet)]"}`}>
          <span aria-hidden className="text-[22px] leading-none">{t.emoji}</span>
          <span className="text-[14px] font-bold leading-tight">{t.label}</span>
          <span className="an-extra text-[12px] leading-snug text-[var(--an-muted)]">{t.blurb}</span>
          {!t.allowed && <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-[var(--an-amber-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--an-amber)]"><Lock className="h-3 w-3" aria-hidden />{t.id === "iep" ? "Plus" : "Basic"}</span>}
        </button>;
      })}
    </div>
  </fieldset>;
}

export function ConsentCard({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#ffd9a8] bg-[var(--an-amber-soft)] p-4">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--an-violet)]" data-testid="notes-consent" />
    <span><span className="block text-[15px] font-bold text-[#7a4a04]">Let everyone know this meeting is being recorded.</span><span className="mt-0.5 block text-[13px] leading-snug text-[#8a5a10]">It's the right thing to do, and in many places it's the law. Check this once you've told them.</span></span>
  </label>;
}

export function SpeakersToggle({ me, on, onChange, onLocked }: { me: Me; on: boolean; onChange: (v: boolean) => void; onLocked: () => void }) {
  if (!me.features.speakers) return <button type="button" onClick={onLocked} className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-[var(--an-line)] px-4 py-3 text-left text-[14px] text-[var(--an-muted)]"><Lock className="h-4 w-4" aria-hidden /><span className="flex-1">Speaker labels (“Speaker 1”, “Speaker 2”) come with Plus.</span></button>;
  if (!me.services.speakers) return null;
  return <Toggle on={on} onChange={onChange} label="Speaker labels" hint="Tells voices apart as Speaker 1, Speaker 2… You can rename them after." />;
}
