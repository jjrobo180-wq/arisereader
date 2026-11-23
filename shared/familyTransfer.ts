// What you share with your family moves to FamilyHub: Kitchen, the calendar, Potty Training, Accountability
// and the rest stop showing in your LifeHub and show in FamilyHub instead (the family's shared copy, which
// everyone in the family already sees). Your LifeHub copy is copied in (merged with anything already in
// FamilyHub), never deleted, and each thing moves once (Family.movedToFamily), so turning one back on in
// LifeHub later sticks.
import { ACCOUNTABILITY_SHARE } from "./profileLinks";
import { mergeSlices, pickParts, sharedAppById } from "./sharedApps";
import { familyMine } from "./familyShared";
import type { Family, FamilySection } from "./familyHub";

export type FamilyMove = { ids: string[]; sections: FamilySection[]; apps: string[] };

/** The things I share with family that haven't moved yet. */
export function pendingMoves(mine: Parameters<typeof familyMine>[0], familyIds: number[], me: number, moved: string[] = []): FamilyMove {
  const ids = familyMine(mine, familyIds, me).map((r) => r.id).filter((id) => !moved.includes(id));
  const sections: FamilySection[] = [], apps: string[] = [];
  for (const id of ids) {
    if (id === ACCOUNTABILITY_SHARE) sections.push("accountability" as FamilySection);
    else if (id.startsWith("app:")) apps.push(`life-pro-${id.slice(4)}`);
    else { const a = sharedAppById(id); if (a) sections.push(a.section); }
  }
  return { ids, sections: [...new Set(sections)], apps: [...new Set(apps)] };
}

/** FamilyHub with my copies merged in and those apps turned on. */
export function moveIntoFamily(fam: Family, life: Family, m: FamilyMove): Family {
  let next: Family = { ...fam, sections: { ...fam.sections } };
  for (const id of m.ids) {
    const a = sharedAppById(id);
    if (!a) continue;
    const merged = mergeSlices(pickParts(next, a.parts), pickParts(life, a.parts), a.parts);
    next = { ...next, ...(merged as Partial<Family>) };
  }
  for (const s of m.sections) next.sections[s] = true;
  next.sheetsInstalled = [...new Set([...(next.sheetsInstalled ?? []), ...m.apps])];
  return next;
}

/** LifeHub with those apps tucked away (data kept) and remembered as moved. */
export function hideFromLife(life: Family, m: FamilyMove): Family {
  const sections = { ...life.sections };
  for (const s of m.sections) sections[s] = false;
  return { ...life, sections, sheetsInstalled: (life.sheetsInstalled ?? []).filter((id) => !m.apps.includes(id)), movedToFamily: [...new Set([...(life.movedToFamily ?? []), ...m.ids])] };
}
