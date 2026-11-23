// FamilyHub's "Shared in the family": everything family members already share with you (Potty Training,
// Accountability, Water, the calendar…), picked up automatically (shared/familyShared.ts). Invites from
// family are accepted for you, and Accountability is turned on here when someone in the family does it with you.
import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { API_BASE } from "@/lib/queryClient";
import { linksApi, setSharedChoice, sharedAppHref, type SharedLink, type MyLink } from "@/lib/profileLinks";
import { ItemIcon, LifeViewModal } from "@/components/family-hub/LinkedProfiles";
import { shareCatalog, type ShareItem } from "@shared/profileLinks";
import { sharedAppById } from "@shared/sharedApps";
import { familyHasAccountability, familyInvites, familyMine, familyShares } from "@shared/familyShared";

export default function FamilyShared({ go, turnOn, openApp }: { go: (section: string) => void; turnOn: (section: string) => void; openApp: (app: string) => void }) {
  const { user, token } = useAuth();
  const [withMe, setWithMe] = useState<SharedLink[]>([]);
  const [mine, setMine] = useState<MyLink[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [viewing, setViewing] = useState<{ owner: SharedLink; item: ShareItem } | null>(null);
  const me = Number(user?.id);
  useEffect(() => {
    if (!token) return;
    let live = true;
    (async () => {
      const fam = await fetch(`${API_BASE}/api/family-space`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" }).then((r) => r.json()).catch(() => null);
      const famIds: number[] = (fam?.family?.members || []).map((m: any) => Number(m.id));
      if (!live || !famIds.length) return;
      setIds(famIds);
      const api = linksApi(token);
      let state = await api.list().catch(() => null);
      if (!state) return;
      // Family invites are accepted for you: they're family, and it's only what they chose to share.
      const waiting = familyInvites(state.withMe, famIds, me);
      if (waiting.length) { await Promise.all(waiting.map((l) => api.accept(l.ownerId, l.id).catch(() => null))); state = await api.list().catch(() => state); }
      if (live && state) { setWithMe(state.withMe); setMine(state.mine); }
    })();
    return () => { live = false; };
  }, [token, me]);
  const rows = useMemo(() => familyShares(withMe, ids, me), [withMe, ids, me]);
  const myRows = useMemo(() => familyMine(mine, ids, me), [mine, ids, me]);
  useEffect(() => { if (familyHasAccountability(rows) || familyHasAccountability(myRows)) turnOn("accountability"); }, [rows, myRows]); // eslint-disable-line react-hooks/exhaustive-deps
  const catalog = useMemo(() => shareCatalog(), []);
  if (!rows.length && !myRows.length) return null;
  const cls = "flex min-h-14 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 text-left hover:bg-slate-50";
  return <section className="mb-4 rounded-3xl border border-amber-100 bg-amber-50/60 p-4" data-testid="family-shared">
    <h2 className="mb-2 flex items-center gap-2 text-sm font-black text-slate-900"><Users size={16} /> Shared in the family</h2>
    {rows.length > 0 && <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{rows.map((r) => {
      const item = catalog.find((c) => c.id === r.id) ?? { id: r.id, label: r.id.replace(/^\w+:/, ""), kind: "life" as const, editable: false };
      const owner = withMe.find((l) => Number(l.ownerId) === r.ownerId)!;
      const label = <><ItemIcon item={item} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.label}</span><span className="block truncate text-xs text-slate-500">{r.ownerName}'s</span></span><span className="shrink-0 text-slate-400">{item.kind === "together" ? <Users size={14} /> : r.access === "edit" ? <Pencil size={14} /> : <Eye size={14} />}</span></>;
      const key = `${r.ownerId}-${r.id}`;
      if (item.kind === "together") return <button key={key} type="button" onClick={() => go("accountability")} className={cls} data-testid={`family-shared-${r.id}`}>{label}</button>;
      const live = sharedAppById(r.id);
      if (live) return <button key={key} type="button" onClick={() => { setSharedChoice(live.section, String(r.ownerId)); turnOn(live.section); go(live.section); }} className={cls} data-testid={`family-shared-${r.id}`}>{label}</button>;
      if (item.kind === "app") return <a key={key} href={sharedAppHref(r.id.slice(4), r.ownerId).replace("hub=life", "hub=family")} className={cls} data-testid={`family-shared-${r.id}`}>{label}</a>;
      return <button key={key} type="button" onClick={() => setViewing({ owner, item })} className={cls} data-testid={`family-shared-${r.id}`}>{label}</button>;
    })}</div>}
    {myRows.length > 0 && <>
      <h3 className="mb-2 mt-4 text-xs font-black uppercase tracking-wide text-slate-500">You share with the family</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">{myRows.map((r) => {
        const item = catalog.find((c) => c.id === r.id) ?? { id: r.id, label: r.id.replace(/^\w+:/, ""), kind: "life" as const, editable: false };
        const label = <><ItemIcon item={item} /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.label}</span><span className="block truncate text-xs text-slate-500">With {r.with.join(", ")}</span></span></>;
        const live = sharedAppById(r.id);
        const open = () => item.kind === "together" ? go("accountability") : item.kind === "app" ? openApp(r.id.slice(4)) : (window.location.hash = `#/lifehub?go=${live?.section || r.id.replace(/^life:/, "")}`);
        return <button key={r.id} type="button" onClick={open} className={cls} data-testid={`family-mine-${r.id}`}>{label}</button>;
      })}</div>
    </>}
    {viewing && <LifeViewModal owner={viewing.owner} item={viewing.item} onClose={() => setViewing(null)} />}
  </section>;
}
