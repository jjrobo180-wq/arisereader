// What the Links widgets draw (client/src/components/widgets/linkWidgets.tsx): example links for before a hub has
// any, and how many of a hub's links fit each kind and size of widget.
import type { PageLink } from "./familyHub";
import type { WidgetSize } from "./widgets";

/** What a widget shows before any link is added. */
export const SAMPLE_LINKS: PageLink[] = [
  { id: "s1", title: "Class website", url: "https://example.com", emoji: "🏫" },
  { id: "s2", title: "Grade book", url: "https://example.com/grades", emoji: "📚" },
  { id: "s3", title: "Calendar", url: "https://example.com/calendar", emoji: "📅" },
  { id: "s4", title: "Forms", url: "https://example.com/forms", emoji: "📝" },
  { id: "s5", title: "Bank", url: "https://example.com/bank", emoji: "💳" },
  { id: "s6", title: "Shopping", url: "https://example.com/shop", emoji: "🛍️" },
  { id: "s7", title: "Music", url: "https://example.com/music", emoji: "🎵" },
  { id: "s8", title: "Maps", url: "https://example.com/maps", emoji: "🗺️" },
];
const SHOWN: Record<WidgetSize, { list: number; tiles: number; icons: number }> = { small: { list: 3, tiles: 4, icons: 4 }, wide: { list: 3, tiles: 4, icons: 6 }, large: { list: 7, tiles: 8, icons: 8 } };
/** How many of a hub's links a widget of this kind and size draws (the rest are on the Link page). */
export const linksShown = (type: string, size: WidgetSize): number => (type === "links-tiles" ? SHOWN[size].tiles : type === "links-icons" ? SHOWN[size].icons : SHOWN[size].list);

