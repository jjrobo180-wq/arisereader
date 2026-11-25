// "Edit tabs" for Health & Fitness inside Arise To Duo: every part of it as a tab you switch on or off and put in
// order, and the tools without a screen of their own (opened from Today) switched on or off. It replaces Cooked's
// own plugin store inside To Duo, so there's one place to change what shows. Saved with the rest of the person's
// fitness data (shared/fitApps.ts), so it's the same on every device.
import { ChevronDown, ChevronUp } from "lucide-react";
import { NativeSheet, SheetGroup, SheetRow, SheetSwitch } from "@/components/NativeSheet";
import { FIT_APPS, FIT_APP_BY_ID, appsOf, moveAdded, setAdded, type FitAppId } from "@shared/fitApps";
import type { FitData } from "@shared/fit";
import { APP_ICONS } from "./FitApps";

type Update = (fn: (d: FitData) => FitData) => void;

export function FitTabsEditor({ data, update, onClose }: { data: FitData; update: Update; onClose: () => void }) {
  const apps = appsOf(data.apps);
  const on = (id: FitAppId) => apps.added.includes(id);
  const set = (id: FitAppId, v: boolean) => update((d) => ({ ...d, apps: setAdded(d.apps, id, v) }));
  const move = (id: FitAppId, by: -1 | 1) => update((d) => ({ ...d, apps: moveAdded(d.apps, id, by) }));
  // Tabs that are on, in their order, then the rest; tools (no screen of their own) on their own list.
  const tabsOn = apps.added.filter((id) => FIT_APP_BY_ID.get(id)?.tab);
  const tabsOff = FIT_APPS.filter((a) => a.tab && !on(a.id));
  const tools = FIT_APPS.filter((a) => !a.tab);
  const icon = (name: string) => { const I = APP_ICONS[name]; return I ? <I /> : null; };
  return (
    <NativeSheet title="Edit Tabs" onClose={onClose} cancelLabel="" doneLabel="Done" testId="fit-tabs-editor">
      <SheetGroup caption="Tabs" note="Today is always first. Turn a tab off and nothing in it is lost; turn it back on any time.">
        {tabsOn.map((id, i) => { const a = FIT_APP_BY_ID.get(id)!; return (
          <SheetRow key={id} icon={icon(a.icon)} color={a.tile[1]} label={a.name} testId={`fit-tab-${id}`}
            right={<span className="flex items-center gap-1">
              <button type="button" onClick={() => move(id, -1)} disabled={i === 0} aria-label={`Move ${a.name} earlier`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 disabled:opacity-25"><ChevronUp className="h-5 w-5" /></button>
              <button type="button" onClick={() => move(id, 1)} disabled={i === tabsOn.length - 1} aria-label={`Move ${a.name} later`} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 disabled:opacity-25"><ChevronDown className="h-5 w-5" /></button>
              <SheetSwitch on label={`Show ${a.name}`} onChange={(v) => set(id, v)} />
            </span>} />
        ); })}
        {tabsOff.map((a) => <SheetRow key={a.id} icon={icon(a.icon)} color={a.tile[1]} label={<span className="text-slate-500">{a.name}</span>} sub={undefined} testId={`fit-tab-${a.id}`}
          right={<SheetSwitch on={false} label={`Show ${a.name}`} onChange={(v) => set(a.id, v)} />} />)}
      </SheetGroup>
      <SheetGroup caption="Tools on Today" note="These open from Today when you need them.">
        {tools.map((a) => <SheetRow key={a.id} icon={icon(a.icon)} color={a.tile[1]} label={a.name} testId={`fit-tool-${a.id}`}
          right={<SheetSwitch on={on(a.id)} label={`Show ${a.name}`} onChange={(v) => set(a.id, v)} />} />)}
      </SheetGroup>
    </NativeSheet>
  );
}
