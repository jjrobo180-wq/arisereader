// The Link page's Directory look: links grouped into folders (see client/src/components/family-hub/LinkDirectory.tsx).

export type DirectoryLink = { title: string; url: string; emoji: string; group?: string };

/** Links in folders, folders in the order they first appear (case doesn't matter). Unfiled links come first, unlabeled. */
export function groupLinks<L extends DirectoryLink>(links: readonly L[]): { group: string; links: L[] }[] {
  const out: { group: string; links: L[] }[] = [];
  for (const l of links) {
    const g = (l.group || "").trim();
    const at = out.find((x) => x.group.toLowerCase() === g.toLowerCase());
    if (at) at.links.push(l); else out.push({ group: g, links: [l] });
  }
  return out.sort((a, b) => Number(!!a.group) - Number(!!b.group));
}
