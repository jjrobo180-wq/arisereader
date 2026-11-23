// FamilyHub picks up what family members already share with each other (Linked profiles, shared/profileLinks.ts):
// Potty Training, Accountability, Water, Meds, the calendar and the rest show up on FamilyHub's home on their
// own, invites from people in the family are accepted for you, and Accountability is turned on in FamilyHub
// when someone in the family does it with you. Nothing new is shared: only what they already chose to share.
import { ACCOUNTABILITY_SHARE } from "./profileLinks";

type Link = { id: string; ownerId: number; ownerName: string; status: "pending" | "active"; grants: Record<string, "view" | "edit"> };

/** Invites from people in the family that are still waiting: accepted automatically in FamilyHub. */
export function familyInvites(withMe: Link[], familyIds: number[], me: number): Link[] {
  const fam = new Set(familyIds.filter((id) => id !== me));
  return withMe.filter((l) => l.status === "pending" && fam.has(Number(l.ownerId)));
}

/** Everything family members share with me, one row per thing, grouped by what it is (Potty Training first). */
export function familyShares(withMe: Link[], familyIds: number[], me: number): { id: string; ownerId: number; ownerName: string; access: "view" | "edit" }[] {
  const fam = new Set(familyIds.filter((id) => id !== me));
  const out: { id: string; ownerId: number; ownerName: string; access: "view" | "edit" }[] = [];
  for (const l of withMe) {
    if (l.status !== "active" || !fam.has(Number(l.ownerId))) continue;
    for (const [id, access] of Object.entries(l.grants || {})) if (access === "view" || access === "edit") out.push({ id, ownerId: Number(l.ownerId), ownerName: l.ownerName, access });
  }
  const rank = (id: string) => (id === "app:potty" ? 0 : id === ACCOUNTABILITY_SHARE ? 1 : id.startsWith("app:") ? 2 : 3);
  return out.sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id) || a.ownerName.localeCompare(b.ownerName));
}

/** Does someone in the family do Accountability with me (so FamilyHub turns it on)? */
export const familyHasAccountability = (shares: { id: string }[]) => shares.some((s) => s.id === ACCOUNTABILITY_SHARE);

type Mine = { id: string; viewerId?: number | null; viewerName: string; nickname: string; status: "pending" | "active"; grants: Record<string, "view" | "edit"> };

/** What I share with people in my family (Potty Training, Kitchen, Accountability…): one row per thing, with who it's shared with. */
export function familyMine(mine: Mine[], familyIds: number[], me: number): { id: string; with: string[] }[] {
  const fam = new Set(familyIds.filter((id) => id !== me));
  const by = new Map<string, string[]>();
  for (const l of mine) {
    if (!l.viewerId || !fam.has(Number(l.viewerId))) continue;
    const name = l.nickname || l.viewerName || "family";
    for (const [id, access] of Object.entries(l.grants || {})) if (access === "view" || access === "edit") by.set(id, [...(by.get(id) || []), name]);
  }
  const rank = (id: string) => (id === "app:potty" ? 0 : id === ACCOUNTABILITY_SHARE ? 1 : id.startsWith("app:") ? 2 : 3);
  return [...by].map(([id, w]) => ({ id, with: [...new Set(w)] })).sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));
}
