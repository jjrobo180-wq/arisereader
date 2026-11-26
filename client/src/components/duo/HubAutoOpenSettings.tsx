// "Open hubs automatically" in LifeHub's Family & settings (Nov 25, 2026): rules like "Weekday mornings → LifeHub",
// "School days 7:30–3:30 → WorkHub" or "At work → WorkHub". Saved with LifeHub (Family.hubOpen) and copied to this
// device so every hub can use them (lib/hubAutoOpen.ts). shared/hubAutoOpen.ts has the rules themselves.
import { useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { Briefcase, Clock, Heart, Home, MapPin, Plus, Trash2 } from "lucide-react";
import { NativeSheet, SheetGroup, SheetRow, SheetSwitch } from "@/components/NativeSheet";
import { useAuth } from "@/context/AuthContext";
import { HUB_NAMES, PLACE_RADIUS, cleanHubOpen, ruleWords, type DuoHub, type HubOpenRule } from "@shared/hubAutoOpen";
import type { Family } from "@shared/familyHub";
import { herePosition, saveHubOpenCopy } from "@/lib/hubAutoOpen";
import { Panel } from "@/components/family-hub/ui";

const HUB_LOOK: Record<DuoHub, { icon: typeof Home; color: string }> = { life: { icon: Home, color: "#7c3aed" }, work: { icon: Briefcase, color: "#0ea5e9" }, family: { icon: Heart, color: "#f97316" } };
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const uid = () => Math.random().toString(36).slice(2, 9);
const blank = (): HubOpenRule => ({ id: uid(), hub: "life", on: true, kind: "time", from: "06:00", to: "11:00", days: [1, 2, 3, 4, 5] });

export function HubAutoOpenSettings({ family, setFamily, say }: { family: Family; setFamily: Dispatch<SetStateAction<Family>>; say: (m: string) => void }) {
  const { user } = useAuth();
  const rules = family.hubOpen ?? [];
  const [editing, setEditing] = useState<HubOpenRule | null>(null);
  // This device keeps a copy, so WorkHub and FamilyHub can switch too (AriseTodo also keeps it current).
  useEffect(() => { saveHubOpenCopy(user?.id, family.hubOpen); }, [user?.id, family.hubOpen]);
  const save = (fn: (r: HubOpenRule[]) => HubOpenRule[]) => setFamily((f) => ({ ...f, hubOpen: cleanHubOpen(fn(f.hubOpen ?? [])) ?? [] }));
  return <Panel eyebrow="Arise To Do" title="Open hubs automatically">
    <p className="mb-3 text-sm text-slate-500">Pick a hub for a time of day or a place. When To Do opens there, it goes straight to that hub. Switching by hand stays put until the next time you open it.</p>
    {rules.length > 0 && <ul className="mb-3 divide-y divide-slate-100 rounded-2xl ring-1 ring-slate-200" data-testid="hub-open-rules">
      {rules.map((r) => { const L = HUB_LOOK[r.hub]; return <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: L.color }}><L.icon className="h-4 w-4" /></span>
        <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-bold text-slate-900">Open {HUB_NAMES[r.hub]}</span>
          <span className="flex items-center gap-1 text-xs text-slate-500">{r.kind === "place" ? <MapPin className="h-3 w-3" /> : <Clock className="h-3 w-3" />}{ruleWords(r)}</span>
        </button>
        <SheetSwitch on={r.on} label={`Use: open ${HUB_NAMES[r.hub]}, ${ruleWords(r)}`} onChange={(on) => save((all) => all.map((x) => (x.id === r.id ? { ...x, on } : x)))} />
      </li>; })}
    </ul>}
    <button type="button" onClick={() => setEditing(blank())} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white" data-testid="hub-open-add"><Plus className="h-4 w-4" />Add a rule</button>
    {editing && <RuleSheet rule={editing} isNew={!rules.some((r) => r.id === editing.id)} say={say} onClose={() => setEditing(null)}
      onSave={(r) => { save((all) => (all.some((x) => x.id === r.id) ? all.map((x) => (x.id === r.id ? r : x)) : [...all, r])); setEditing(null); }}
      onDelete={() => { save((all) => all.filter((x) => x.id !== editing.id)); setEditing(null); }} />}
  </Panel>;
}

function RuleSheet({ rule, isNew, say, onClose, onSave, onDelete }: { rule: HubOpenRule; isNew: boolean; say: (m: string) => void; onClose: () => void; onSave: (r: HubOpenRule) => void; onDelete: () => void }) {
  const [r, setR] = useState(rule);
  const [finding, setFinding] = useState(false);
  const set = (p: Partial<HubOpenRule>) => setR((x) => ({ ...x, ...p }));
  const usePlace = async () => {
    setFinding(true);
    const at = await herePosition(8000);
    setFinding(false);
    if (!at) { say("Couldn't get your location. Check that To Do can use it in Settings."); return; }
    set({ place: { name: r.place?.name || "Here", lat: at.lat, lng: at.lng, radius: r.place?.radius ?? PLACE_RADIUS } });
  };
  const ready = r.kind === "time" || (!!r.place && Number.isFinite(r.place.lat));
  const field = "min-h-10 rounded-lg border border-slate-200 bg-white px-2.5 text-[15px] text-slate-900";
  return <NativeSheet title={isNew ? "New Rule" : "Edit Rule"} onClose={onClose} onDone={() => ready && onSave(r)} doneLabel={isNew ? "Add" : "Done"} doneDisabled={!ready} testId="hub-open-sheet">
    <SheetGroup caption="Open">
      {(["life", "work", "family"] as DuoHub[]).map((h) => { const L = HUB_LOOK[h]; return <SheetRow key={h} icon={<L.icon />} color={L.color} label={HUB_NAMES[h]} onClick={() => set({ hub: h })}
        right={r.hub === h ? <span className="text-lg font-bold text-[#007aff]">✓</span> : null} testId={`hub-open-hub-${h}`} />; })}
    </SheetGroup>
    <SheetGroup caption="When">
      <SheetRow icon={<Clock />} color="#5856d6" label="At a time of day" onClick={() => set({ kind: "time" })} right={r.kind === "time" ? <span className="text-lg font-bold text-[#007aff]">✓</span> : null} />
      <SheetRow icon={<MapPin />} color="#34c759" label="When I'm at a place" onClick={() => set({ kind: "place" })} right={r.kind === "place" ? <span className="text-lg font-bold text-[#007aff]">✓</span> : null} />
    </SheetGroup>
    {r.kind === "time" ? <SheetGroup caption="Between" note="A window past midnight, like 10 PM to 6 AM, works too.">
      <SheetRow label="From" right={<input type="time" value={r.from} onChange={(e) => e.target.value && set({ from: e.target.value })} className={field} aria-label="From" />} />
      <SheetRow label="To" right={<input type="time" value={r.to} onChange={(e) => e.target.value && set({ to: e.target.value })} className={field} aria-label="To" />} />
    </SheetGroup> : <SheetGroup caption="Place" note="Stand where the place is (home, work, school) and tap Use where I am. To Do checks where you are only when it opens.">
      <SheetRow label="Name" right={<input value={r.place?.name ?? ""} placeholder="Work" onChange={(e) => setR((x) => ({ ...x, place: { name: e.target.value, lat: x.place?.lat ?? NaN, lng: x.place?.lng ?? NaN, radius: x.place?.radius ?? PLACE_RADIUS } }))} className={`${field} w-40 text-right`} aria-label="Place name" />} />
      <SheetRow label={r.place && Number.isFinite(r.place.lat) ? "Saved where you were" : "Not set yet"} sub={r.place && Number.isFinite(r.place.lat) ? `Within about ${r.place.radius} m` : undefined}
        right={<button type="button" onClick={() => void usePlace()} disabled={finding} className="rounded-full bg-[#34c759] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50">{finding ? "Finding…" : "Use where I am"}</button>} />
    </SheetGroup>}
    <SheetGroup caption="Days">
      <div className="flex justify-between gap-1 px-4 py-3">{DAY_LETTERS.map((d, i) => { const on = r.days.includes(i); return <button key={i} type="button" aria-pressed={on} aria-label={["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][i]}
        onClick={() => set({ days: on ? r.days.filter((x) => x !== i) : [...r.days, i].sort() })}
        className={`grid h-10 w-10 place-items-center rounded-full text-sm font-bold ${on ? "bg-[#007aff] text-white" : "bg-slate-100 text-slate-500"}`}>{d}</button>; })}</div>
    </SheetGroup>
    {!isNew && <SheetGroup><SheetRow icon={<Trash2 />} color="#ff3b30" label={<span className="text-[#ff3b30]">Delete Rule</span>} onClick={onDelete} /></SheetGroup>}
  </NativeSheet>;
}
