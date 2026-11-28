// Clean line icons for Chores (in place of emoji): one per room or area, a few by what the chore is, and one per
// starter pack. Each is drawn in its room's color.
import {
  Bath, BedDouble, Brush, Building2, Car, CloudSun, CookingPot, CreditCard, DoorOpen, Droplets, Flame, House, Leaf, Mail, Monitor, Package, PawPrint,
  Receipt, Recycle, RefreshCw, Shirt, ShieldCheck, ShoppingCart, Siren, Smartphone, Sofa, Sparkles, Sprout, Sun, ToyBrick, Trash2, Trees, Utensils, Wind, Wrench,
  type LucideIcon,
} from "lucide-react";
import { categoryOf } from "@shared/choreCatalog";

export const ROOM_ICON: Record<string, LucideIcon> = {
  kitchen: CookingPot, bathroom: Bath, bedroom: BedDouble, living: Sofa, laundry: Shirt, floors: Brush, dining: Utensils, entry: DoorOpen,
  office: Monitor, trash: Recycle, kids: ToyBrick, pets: PawPrint, plants: Sprout, yard: Trees, garage: Package, car: Car, upkeep: Wrench,
  safety: ShieldCheck, errands: ShoppingCart, admin: Mail, tech: Smartphone, self: Sparkles, seasonal: CloudSun, deep: Droplets,
};
export const PACK_ICON: Record<string, LucideIcon> = { basics: Sun, apartment: Building2, family: House, pets: PawPrint, reset: RefreshCw, upkeep: Wrench, deep: Droplets, money: CreditCard };

/** A few chores get their own icon, by what they are; the rest use their room's. */
const BY_WORD: [RegExp, LucideIcon][] = [
  [/\b(trash|garbage|bins?)\b/i, Trash2], [/\brecycl/i, Recycle], [/\b(dish|dishes|dishwasher)\b/i, Utensils], [/\b(stove|oven|grill)\b/i, Flame],
  [/\b(laundry|wash the clothes|fold|towels|sheets)\b/i, Shirt], [/\b(bill|bills|budget|receipts?)\b/i, Receipt], [/\bmail\b/i, Mail],
  [/\b(plants?|garden)\b/i, Sprout], [/\b(leaves|lawn|mow)\b/i, Leaf], [/\b(smoke|alarm|detector)\b/i, Siren], [/\b(filter|vent|fan)\b/i, Wind],
  [/\b(vacuum|sweep|mop)\b/i, Brush], [/\b(make the bed)\b/i, BedDouble],
];

export function choreIcon(c: { title?: string; cat?: string }): LucideIcon {
  const t = c.title || "";
  for (const [re, I] of BY_WORD) if (re.test(t)) return I;
  return ROOM_ICON[c.cat || ""] ?? Sparkles;
}
export const roomColor = (cat?: string) => categoryOf(cat)?.color || "#7c5cff";

/** A chore's icon in its room's color. */
export function ChoreGlyph({ c, size = 22, color, className = "" }: { c: { title?: string; cat?: string }; size?: number; color?: string; className?: string }) {
  const I = choreIcon(c);
  return <I size={size} strokeWidth={2} className={className} style={{ color: color ?? roomColor(c.cat) }} aria-hidden="true" />;
}
export function RoomGlyph({ cat, size = 18, color, className = "" }: { cat?: string; size?: number; color?: string; className?: string }) {
  const I = ROOM_ICON[cat || ""] ?? Sparkles;
  return <I size={size} strokeWidth={2} className={className} style={{ color: color ?? roomColor(cat) }} aria-hidden="true" />;
}
