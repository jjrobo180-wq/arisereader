// "Edit Tabs" for Health & Fitness inside Arise To Duo (Nov 25, 2026): the tabs (Daily, Food, Training, Yoga,
// Progress, Friends) switched on or off and put in order, and inside each tab the parts it shows (Period, say)
// switched on or off. It replaces Cooked's own plugin store inside To Duo, so there's one place to change what shows.
// Saved with the rest of the person's fitness data (FitApps.groups, shared/fitGroups.ts), the same on every device.
import { CalendarRange, ChevronDown, ChevronUp, ShoppingCart } from "lucide-react";
import { NativeSheet, SheetGroup, SheetRow, SheetSwitch } from "@/components/NativeSheet";
import { appsOf } from "@shared/fitApps";
import { FIT_GROUPS, FIT_GROUP_BY_ID, groupPrefsOf, moveGroup, setGroupOn, setPartOn, type FitGroupId, type FitGroupPrefs, type FitPartId } from "@shared/fitGroups";
import type { FitData } from "@shared/fit";
import { APP_ICONS } from "./FitApps";

type Update = (fn: (d: FitData) => FitData) => void;
const TINT: Record<FitGroupId, string> = { "g-daily": "#0ea5e9", "g-food": "#65a30d", "g-train": "#ea580c", "g-yoga": "#9333ea", "g-progress": "#0369a1", "g-friends": "#c026d3" };
const EXTRA: Record<string, typeof CalendarRange> = { CalendarRange, ShoppingCart };

export function FitTabsEditor({ data, update, onClose }: { data: FitData; update: Update; onClose: () => void }) {
  const apps = appsOf(data.apps);
  const p = groupPrefsOf(apps.groups, apps.added);
  const save = (fn: (g: FitGroupPrefs) => FitGroupPrefs) => update((d) => { const a = appsOf(d.apps); return { ...d, apps: { ...a, groups: fn(groupPrefsOf(a.groups, a.added)) } }; });
  const icon = (name: string) => { const I = APP_ICONS[name] ?? EXTRA[name]; return I ? <I /> : null; };
  const on = p.order.filter((id) => !p.off.includes(id));
  const off = p.order.filter((id) => p.off.includes(id));
  const arrows = "grid h-9 w-9 place-items-center rounded-lg text-slate-500 disabled:opacity-30";
  return (
    <NativeSheet title="Edit Tabs" onClose={onClose} cancelLabel="" doneLabel="Done" testId="fit-tabs-editor">
      <SheetGroup caption="Tabs" note="Today is always first. Turn a tab off and nothing in it is lost; turn it back on any time.">
        {on.map((id, i) => { const g = FIT_GROUP_BY_ID.get(id)!; return (
          <SheetRow key={id} icon={icon(g.icon)} color={TINT[id]} label={g.label} sub={g.detail} testId={`fit-tab-${id}`}
            right={<span className="flex items-center gap-1">
              <button type="button" onClick={() => save((x) => moveGroup(x, id, -1))} disabled={i === 0} aria-label={`Move ${g.label} earlier`} className={arrows}><ChevronUp className="h-4 w-4" /></button>
              <button type="button" onClick={() => save((x) => moveGroup(x, id, 1))} disabled={i === on.length - 1} aria-label={`Move ${g.label} later`} className={arrows}><ChevronDown className="h-4 w-4" /></button>
              <SheetSwitch on label={`Show ${g.label}`} onChange={(v) => save((x) => setGroupOn(x, id, v))} />
            </span>} />
        ); })}
        {off.map((id) => { const g = FIT_GROUP_BY_ID.get(id)!; return <SheetRow key={id} icon={icon(g.icon)} color={TINT[id]} label={<span className="text-slate-500">{g.label}</span>} testId={`fit-tab-${id}`}
          right={<SheetSwitch on={false} label={`Show ${g.label}`} onChange={(v) => save((x) => setGroupOn(x, id, v))} />} />; })}
      </SheetGroup>
      {FIT_GROUPS.filter((g) => !p.off.includes(g.id)).map((g) => (
        <SheetGroup key={g.id} caption={`In ${g.label}`}>
          {g.parts.map((part) => { const shown = !p.partsOff.includes(part.id); return (
            <SheetRow key={part.id} icon={icon(part.icon)} color={TINT[g.id]} label={shown ? part.label : <span className="text-slate-500">{part.label}</span>} sub={part.detail} testId={`fit-part-toggle-${part.id}`}
              right={<SheetSwitch on={shown} label={`Show ${part.label}`} onChange={(v) => save((x) => setPartOn(x, part.id as FitPartId, v))} />} />
          ); })}
        </SheetGroup>
      ))}
    </NativeSheet>
  );
}
