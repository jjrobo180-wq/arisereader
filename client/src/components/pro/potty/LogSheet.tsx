// The full log sheet: anything, at any time, with the details that make predictions and doctor
// visits useful — who started a trip, the stool type, drink size, meal or snack, where, pain, notes.
import { useState } from "react";
import { Modal } from "../kit";
import { BRISTOL, DRINK_TYPES, KINDS, dayOf, drinkTypeOf, hm, isPoopEvent, isSuccess, isAccident, mlToOz, ozToMl, type DrinkType, type Entry, type Kind } from "@shared/pro/potty";
import { usePotty, type LogPrefill } from "./ctx";
import { Btn2, C, Chip, Label, field, fieldStyle } from "./theme";

const GROUPS: { label: string; kinds: Kind[] }[] = [
  { label: "Potty", kinds: ["pee", "poop", "both", "try", "dry"] },
  { label: "Accident", kinds: ["acc-pee", "acc-poop"] },
  { label: "Diaper or pull-up", kinds: ["diaper-wet", "diaper-dirty"] },
  { label: "Sleep", kinds: ["nap-dry", "nap-wet", "night-dry", "night-wet"] },
  { label: "Food & drink", kinds: ["food", "drink"] },
  { label: "Other", kinds: ["note"] },
];
const DRINKS_OZ = [1, 2, 3, 4, 6, 8, 10, 12]; const DRINKS_ML = [30, 60, 90, 120, 180, 240, 300, 360];
const FOOD_TAGS = ["Fruit", "Vegetables", "Whole grains", "Beans", "Dairy", "Meat/fish", "Snack food"];

export function LogSheet({ pre, onClose }: { pre: LogPrefill; onClose: () => void }) {
  const { kid, data, set, log } = usePotty();
  const editing = pre.edit;
  const start = editing || pre;
  const [kind, setKind] = useState<Kind>(start.kind || "pee");
  const [day, setDay] = useState(dayOf(start.at || Date.now()));
  const [time, setTime] = useState(hm(start.at || Date.now()));
  const [init, setInit] = useState<Entry["init"]>(start.init || "");
  const [bristol, setBristol] = useState<number | undefined>(start.bristol);
  const [ml, setMl] = useState<number | undefined>(start.ml);
  const [size, setSize] = useState<Entry["size"]>(start.size || "meal");
  const [where, setWhere] = useState<Entry["where"]>(start.where || "");
  const [pain, setPain] = useState(!!start.pain);
  const [note, setNote] = useState(start.note || "");
  const [drink, setDrink] = useState<DrinkType | undefined>(drinkTypeOf({ kind: start.kind || "", drink: start.drink, note: start.note }));
  const at = (() => { const [y, m, d] = day.split("-").map(Number); const [h, mi] = time.split(":").map(Number); return new Date(y, m - 1, d, h || 0, mi || 0).getTime(); })();
  const units = data.units;
  const save = () => {
    const extra: Partial<Entry> = { at };
    if (isSuccess(kind) || isAccident(kind) || kind === "try") extra.init = init || undefined;
    if (isPoopEvent(kind)) { extra.bristol = bristol; if (pain) extra.pain = true; }
    if (kind === "drink") { if (ml) extra.ml = ml; if (drink) extra.drink = drink; }
    if (kind === "food") extra.size = size;
    if (where) extra.where = where;
    if (note.trim()) extra.note = note.trim();
    if (editing) set((d) => ({ ...d, logs: d.logs.map((x) => (x.id === editing.id ? { id: x.id, kid: x.kid, kind, ...extra, at } as Entry : x)) }));
    else log(kind, extra);
    onClose();
  };
  const addTag = (t: string) => setNote((n) => (n.toLowerCase().includes(t.toLowerCase()) ? n : n ? `${n}, ${t}` : t));
  return <Modal wide title={editing ? "Edit entry" : `Log for ${kid.name}`} onClose={onClose} footer={<>
    {editing && <Btn2 kind="danger" onClick={() => { set((d) => ({ ...d, logs: d.logs.filter((x) => x.id !== editing.id) })); onClose(); }}>Delete</Btn2>}
    <Btn2 kind="ink" onClick={save}>{editing ? "Save changes" : "Save"}</Btn2>
  </>}>
    <div className="potty-app space-y-5">
      <div className="space-y-3">{GROUPS.map((g) => <div key={g.label}><p className="mb-1.5 text-[12px] font-bold" style={{ color: C.muted }}>{g.label}</p><div className="flex flex-wrap gap-1.5">{g.kinds.map((k) => <Chip key={k} on={kind === k} color={KINDS[k].color} onClick={() => setKind(k)}><span>{KINDS[k].emoji}</span>{KINDS[k].short}</Chip>)}</div></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-2"><Label text="Day"><input type="date" value={day} max={dayOf(Date.now())} onChange={(e) => setDay(e.target.value)} className={field} style={fieldStyle} /></Label><Label text="Time"><input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={field} style={fieldStyle} /></Label></div>
      {(isSuccess(kind) || isAccident(kind) || kind === "try") && <Label text="Who started it?" hint="Self-started trips are the real sign of progress — the app tracks them.">
        <div className="flex flex-wrap gap-1.5">{([["self", "🙋 Your child (told you or went alone)"], ["prompted", "🗣️ You asked"], ["schedule", "⏰ Timer or schedule"], ["", "Not sure"]] as const).map(([v, l]) => <Chip key={v || "none"} on={init === v} onClick={() => setInit(v)}>{l}</Chip>)}</div></Label>}
      {isPoopEvent(kind) && <Label text="What did it look like? (stool chart)" hint="Types 3–4 are ideal. 1–2 mean constipation; 6–7 are loose.">
        <div className="grid gap-1.5 sm:grid-cols-2">{BRISTOL.map((b) => <button key={b.type} type="button" onClick={() => setBristol(bristol === b.type ? undefined : b.type)} aria-pressed={bristol === b.type} className="flex items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm" style={bristol === b.type ? { background: C.ink, color: "#fff" } : { background: "#F4F6FA" }}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold" style={{ background: b.tone === "ideal" ? "#DDF5E8" : b.tone === "hard" ? "#F9E1DC" : "#FFF0CC", color: C.ink }}>{b.type}</span>
          <span className="min-w-0"><span className="block font-bold">{b.means}</span><span className="block text-xs opacity-80">{b.look}</span></span></button>)}</div>
        <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={pain} onChange={(e) => setPain(e.target.checked)} className="h-4 w-4" />It seemed to hurt, or they strained a lot</label></Label>}
      {kind === "drink" && <Label text="What did they drink?"><div className="flex flex-wrap gap-1.5">{DRINK_TYPES.map((t) => <Chip key={t.id} on={drink === t.id} onClick={() => setDrink(drink === t.id ? undefined : t.id)}><span>{t.emoji}</span>{t.label}</Chip>)}</div></Label>}
      {kind === "drink" && <Label text={`How much? (${units})`}>
        <div className="flex flex-wrap gap-1.5">{(units === "oz" ? DRINKS_OZ : DRINKS_ML).map((v) => { const m = units === "oz" ? ozToMl(v) : v; return <Chip key={v} on={ml === m} onClick={() => setMl(m)}>{v} {units}</Chip>; })}
          <input type="number" min={0} inputMode="decimal" placeholder="Other" value={ml === undefined ? "" : units === "oz" ? mlToOz(ml) : ml} onChange={(e) => setMl(e.target.value === "" ? undefined : units === "oz" ? ozToMl(Number(e.target.value)) : Number(e.target.value))} className={`${field} !h-9 !w-24`} style={fieldStyle} aria-label="Amount" /></div>
        </Label>}
      {kind === "food" && <Label text="Meal or snack?">
        <div className="flex flex-wrap gap-1.5"><Chip on={size === "meal"} onClick={() => setSize("meal")}>🍽️ Meal</Chip><Chip on={size === "snack"} onClick={() => setSize("snack")}>🍎 Snack</Chip></div>
        <div className="mt-2 flex flex-wrap gap-1.5">{FOOD_TAGS.map((t) => <Chip key={t} on={note.includes(t)} onClick={() => addTag(t)}>{t}</Chip>)}</div></Label>}
      {kind !== "note" && kind !== "night-dry" && kind !== "night-wet" && <Label text="Where?"><div className="flex flex-wrap gap-1.5">{([["home", "🏠 Home"], ["daycare", "🏫 Daycare/school"], ["out", "🚗 Out"], ["", "—"]] as const).map(([v, l]) => <Chip key={v || "x"} on={where === v} onClick={() => setWhere(v)}>{l}</Chip>)}</div></Label>}
      <Label text="Note (optional)"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder={kind === "note" ? "Anything worth remembering — a change, a worry, what worked" : "Anything that might matter: what they ate, mood, a new place…"} className={`${field} h-auto py-2`} style={fieldStyle} /></Label>
    </div>
  </Modal>;
}
