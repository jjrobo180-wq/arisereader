// Setting up a goal (and changing one): what it is, the reward, how many points, which dates, and
// where the points come from. Used for the first goal, for new ones, and for editing.
import { useMemo, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import {
  CATEGORY_COLORS, EXTRA_CATEGORY_IDEAS, MAX_CATEGORIES, MAX_TARGET, REWARD_IDEAS, schoolDays, windowFor,
  type Category, type GoalInput, type WindowPreset,
} from "@shared/classGoals";
import Vessel from "./Vessel";
import { newId } from "./useClassGoals";

const PRESETS: Array<{ id: WindowPreset; label: string }> = [
  { id: "week", label: "This week" }, { id: "two-weeks", label: "Two weeks" }, { id: "month", label: "This month" }, { id: "none", label: "No end date" },
];
const TITLE_IDEAS = ["Kind, quiet and ready to learn", "Finish every homework", "Great hallway behavior", "Math facts champions"];
const TARGETS = [25, 50, 100, 200];

export type FormValue = Required<Pick<GoalInput, "title" | "className" | "target" | "startsOn" | "endsOn">> & { reward: { name: string; emoji: string; note: string }; categories: Category[] };

export function toFormValue(input: GoalInput): FormValue {
  return {
    title: input.title ?? "", className: input.className ?? "", target: input.target ?? 50, startsOn: input.startsOn ?? "", endsOn: input.endsOn ?? "",
    reward: { name: input.reward?.name ?? "", emoji: input.reward?.emoji ?? "🎉", note: input.reward?.note ?? "" },
    categories: (input.categories ?? []).map((c, i) => ({ id: c.id ?? newId("c"), name: c.name ?? "", emoji: c.emoji ?? "⭐", color: c.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length] })),
  };
}

export default function GoalForm({ initial, today, mode, previewPct, onSubmit, onCancel }: { initial: GoalInput; today: string; mode: "create" | "edit"; previewPct?: number; onSubmit: (v: FormValue) => void; onCancel?: () => void }) {
  const [v, setV] = useState<FormValue>(() => toFormValue(initial));
  const set = (patch: Partial<FormValue>) => setV((cur) => ({ ...cur, ...patch }));
  const [custom, setCustom] = useState(false);

  const days = useMemo(() => (v.endsOn ? schoolDays(v.startsOn || today, v.endsOn) : 0), [v.startsOn, v.endsOn, today]);
  const perDay = days > 0 ? Math.ceil(v.target / days) : 0;
  const activePreset = PRESETS.find((p) => { const w = windowFor(p.id, today); return w.startsOn === v.startsOn && w.endsOn === v.endsOn; })?.id;
  const usedNames = new Set(v.categories.map((c) => c.name.trim().toLowerCase()));
  const ideas = EXTRA_CATEGORY_IDEAS.filter((c) => !usedNames.has(c.name.toLowerCase()));
  const canSave = v.categories.some((c) => c.name.trim()) && v.target >= 1;

  const setCat = (i: number, patch: Partial<Category>) => set({ categories: v.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  const addCat = (c?: Omit<Category, "id">) => v.categories.length < MAX_CATEGORIES && set({ categories: [...v.categories, { id: newId("c"), name: c?.name ?? "", emoji: c?.emoji ?? "⭐", color: CATEGORY_COLORS[v.categories.length % CATEGORY_COLORS.length] }] });

  return (
    <form className="cg-form" onSubmit={(e) => { e.preventDefault(); if (canSave) onSubmit({ ...v, categories: v.categories.filter((c) => c.name.trim()).map((c, i) => ({ ...c, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length] })) }); }}>
      <div className="cg-form-main">
        <section className="cg-field">
          <label htmlFor="cg-title">What is the class working on?</label>
          <input id="cg-title" value={v.title} maxLength={80} placeholder="Kind, quiet and ready to learn" onChange={(e) => set({ title: e.target.value })} />
          {!v.title && <div className="cg-chips">{TITLE_IDEAS.map((t) => <button type="button" key={t} onClick={() => set({ title: t })}>{t}</button>)}</div>}
          <label htmlFor="cg-class" className="cg-sublabel">Which class? <span>(optional)</span></label>
          <input id="cg-class" value={v.className} maxLength={40} placeholder="Period 3" onChange={(e) => set({ className: e.target.value })} />
        </section>

        <section className="cg-field">
          <label>The reward</label>
          <div className="cg-ideas" role="group" aria-label="Reward ideas">
            {REWARD_IDEAS.map((r) => (
              <button type="button" key={r.name} aria-pressed={v.reward.name === r.name} className={v.reward.name === r.name ? "is-on" : ""} onClick={() => set({ reward: { ...v.reward, name: r.name, emoji: r.emoji } })}>
                <span aria-hidden>{r.emoji}</span>{r.name}
              </button>
            ))}
          </div>
          <div className="cg-row">
            <input className="cg-emoji-in" aria-label="Reward emoji" value={v.reward.emoji} maxLength={8} onChange={(e) => set({ reward: { ...v.reward, emoji: e.target.value } })} />
            <input aria-label="Reward name" value={v.reward.name} maxLength={50} placeholder="Or type your own reward" onChange={(e) => set({ reward: { ...v.reward, name: e.target.value } })} />
          </div>
          <input aria-label="When or where (optional)" value={v.reward.note} maxLength={80} placeholder="When? (optional) Friday after lunch" onChange={(e) => set({ reward: { ...v.reward, note: e.target.value } })} />
        </section>

        <section className="cg-field">
          <label htmlFor="cg-target">Points to earn</label>
          <div className="cg-stepper">
            <button type="button" aria-label="Fewer points" onClick={() => set({ target: Math.max(1, v.target - (v.target > 50 ? 10 : 5)) })}><Minus size={18} /></button>
            <input id="cg-target" inputMode="numeric" value={v.target} onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); set({ target: Math.min(MAX_TARGET, n) }); }} onBlur={() => v.target < 1 && set({ target: 1 })} />
            <button type="button" aria-label="More points" onClick={() => set({ target: Math.min(MAX_TARGET, v.target + (v.target >= 50 ? 10 : 5)) })}><Plus size={18} /></button>
          </div>
          <div className="cg-chips">{TARGETS.map((t) => <button type="button" key={t} aria-pressed={v.target === t} className={v.target === t ? "is-on" : ""} onClick={() => set({ target: t })}>{t}</button>)}</div>
          {perDay > 0 && <p className="cg-hint">About {perDay} {perDay === 1 ? "point" : "points"} each school day.</p>}
        </section>

        <section className="cg-field">
          <label>How long?</label>
          <div className="cg-chips">
            {PRESETS.map((p) => <button type="button" key={p.id} aria-pressed={activePreset === p.id} className={activePreset === p.id ? "is-on" : ""} onClick={() => { setCustom(false); set(windowFor(p.id, today)); }}>{p.label}</button>)}
            <button type="button" aria-pressed={custom || !activePreset} className={custom || !activePreset ? "is-on" : ""} onClick={() => setCustom(true)}>Pick dates</button>
          </div>
          {(custom || !activePreset) && (
            <div className="cg-dates">
              <label>Starts<input type="date" value={v.startsOn} onChange={(e) => set({ startsOn: e.target.value })} /></label>
              <label>Ends<input type="date" value={v.endsOn} min={v.startsOn || undefined} onChange={(e) => set({ endsOn: e.target.value })} /></label>
            </div>
          )}
        </section>

        <section className="cg-field">
          <label>Where the points come from</label>
          <ul className="cg-cats">
            {v.categories.map((c, i) => (
              <li key={c.id} style={{ "--c": CATEGORY_COLORS[i % CATEGORY_COLORS.length] } as React.CSSProperties}>
                <input className="cg-emoji-in" aria-label={`Emoji for ${c.name || "category"}`} value={c.emoji} maxLength={8} onChange={(e) => setCat(i, { emoji: e.target.value })} />
                <input aria-label="Category name" value={c.name} maxLength={24} placeholder="Name" onChange={(e) => setCat(i, { name: e.target.value })} />
                <button type="button" className="cg-x" aria-label={`Remove ${c.name || "category"}`} disabled={v.categories.length <= 1} onClick={() => set({ categories: v.categories.filter((_, j) => j !== i) })}><X size={16} /></button>
              </li>
            ))}
          </ul>
          {v.categories.length < MAX_CATEGORIES && (
            <div className="cg-chips">
              {ideas.map((c) => <button type="button" key={c.name} onClick={() => addCat(c)}>{c.emoji} {c.name}</button>)}
              <button type="button" onClick={() => addCat()}><Plus size={14} /> Your own</button>
            </div>
          )}
        </section>
      </div>

      <aside className="cg-form-preview" aria-hidden>
        <Vessel emoji={v.reward.emoji || "🎉"} pct={previewPct ?? (mode === "create" ? 38 : 0)} />
        <p className="cg-form-preview-name">{v.reward.name || "Class reward"}</p>
        <p className="cg-form-preview-line">{v.target} points{v.endsOn ? ` by ${new Date(`${v.endsOn}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</p>
      </aside>

      <div className="cg-form-actions">
        {onCancel && <button type="button" className="cg-btn cg-btn-quiet" onClick={onCancel}>Cancel</button>}
        <button type="submit" className="cg-btn cg-btn-main" disabled={!canSave}>{mode === "create" ? "Put it on the board" : "Save changes"}</button>
      </div>
    </form>
  );
}
