// Family & settings → "Move between hubs": every app on in this hub, each with one button that moves it to
// the other hub (LifeHub ⇄ FamilyHub). Its saved data is copied over and merged, it's turned on there and
// off here, and its data here is kept, so moving it back brings everything back (shared/hubMove.ts).
import { useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, Loader2, Search } from "lucide-react";
import { movableItems, itemKey, type HubItem, type HubWorkspace } from "@shared/hubMove";
import type { FamilySection } from "@shared/familyHub";
import { moveToOtherHub } from "@/lib/useFamilyTransfer";
import { API_BASE } from "@/lib/queryClient";
import { Panel, inputClass } from "./ui";
import { SECTION_INFO } from "./Members";

export default function MoveBetweenHubs({ space, token, data, setData, say }: {
  space: "life" | "family"; token: string | null; data: HubWorkspace;
  setData: (fn: (d: HubWorkspace) => HubWorkspace) => void; say: (m: string) => void;
}) {
  // LifeHub can only move things to a FamilyHub that exists (FamilyHub itself always can move things back).
  const [inFamily, setInFamily] = useState<boolean>(space === "family");
  useEffect(() => {
    if (space === "family" || !token) return;
    let alive = true;
    fetch(`${API_BASE}/api/family-space`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive) setInFamily(!!d?.family); }).catch(() => {});
    return () => { alive = false; };
  }, [space, token]);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const there = space === "life" ? "FamilyHub" : "LifeHub";
  const items = useMemo(() => movableItems(data.family, (s: FamilySection) => SECTION_INFO[s]?.label), [data.family]);
  const shown = q.trim() ? items.filter((i) => i.name.toLowerCase().includes(q.trim().toLowerCase())) : items;

  const move = async (item: HubItem, name: string) => {
    if (!token || busy) return;
    setBusy(itemKey(item));
    const ok = await moveToOtherHub(space, token, item, setData, data).catch(() => false);
    setBusy(null);
    say(ok ? `${name} moved to ${there}` : `${name} couldn't move right now. Check your connection and try again.`);
  };

  return (
    <Panel eyebrow="Move between hubs" title={`Move apps to ${there}`}>
      <p className="mb-3 text-sm text-slate-500" data-testid="move-hubs-blurb">
        {space === "life"
          ? "Move an app to FamilyHub so everyone in your family has it. Everything in it comes too. Anything you share with your family moves there on its own."
          : "Move an app back to your own LifeHub. Everything in it comes too, and it leaves FamilyHub."}
        {" "}Its saved things stay here as well, so moving it back brings them back.
      </p>
      {space === "life" && !inFamily ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-600">Start or join a family in FamilyHub first. Then you can move apps there.</p>
      ) : !items.length ? (
        <p className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-600">No apps to move. Add apps from the Plugin Gallery.</p>
      ) : <>
        {items.length > 8 && <label className="relative mb-3 block">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an app" aria-label="Find an app to move" className={inputClass + " pl-9"} />
        </label>}
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2" data-testid="move-hubs-list">
          {shown.map(({ item, name }) => {
            const key = itemKey(item);
            return <li key={key} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3">
              <span className="min-w-0 flex-1 truncate font-bold text-slate-800">{name}</span>
              <button type="button" onClick={() => void move(item, name)} disabled={!!busy} data-testid={`move-${key}`}
                className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-violet-50 px-3 text-sm font-bold text-violet-700 hover:bg-violet-100 disabled:opacity-60">
                {busy === key ? <Loader2 size={15} className="animate-spin" /> : <ArrowRightLeft size={15} />} Move to {there}
              </button>
            </li>;
          })}
        </ul>
      </>}
    </Panel>
  );
}

/** The small "Move to FamilyHub" (or "Move to LifeHub") button at the top of an app's own page. Shown in
 *  LifeHub only once this account is in a family (FamilyHub keeps that on the device: pages/FamilyHub.tsx). */
export function MoveAppButton({ space, token, userId, section, data, setData, say, onMoved }: {
  space: "life" | "family"; token: string | null; userId: number | undefined; section: FamilySection; data: HubWorkspace;
  setData: (fn: (d: HubWorkspace) => HubWorkspace) => void; say: (m: string) => void; onMoved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const there = space === "life" ? "FamilyHub" : "LifeHub";
  const item = movableItems(data.family, (s) => SECTION_INFO[s]?.label).find((i) => i.item.kind === "section" && i.item.section === section);
  const inFamily = space === "family" || (() => { try { return !!JSON.parse(localStorage.getItem(`arise-family-info-v1:${userId ?? ""}`) || "{}").family; } catch { return false; } })();
  if (!item || !inFamily || !token) return null;
  const go = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await moveToOtherHub(space, token, item.item, setData, data).catch(() => false);
    setBusy(false);
    say(ok ? `${item.name} moved to ${there}` : `${item.name} couldn't move right now. Check your connection and try again.`);
    if (ok) onMoved();
  };
  return (
    <button type="button" onClick={() => void go()} disabled={busy} data-testid="move-app-button"
      className="mb-3 inline-flex min-h-9 items-center gap-1.5 rounded-full border border-violet-200 bg-white px-3 text-[13px] font-bold text-violet-700 shadow-sm hover:bg-violet-50 disabled:opacity-60 dark:border-violet-400/30 dark:bg-white/5 dark:text-violet-200">
      {busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRightLeft size={14} />} Move to {there}
    </button>
  );
}
