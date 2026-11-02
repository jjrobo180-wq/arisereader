// Arise Fit icons: one consistent set of line icons in place of emoji.
import {
  Dumbbell, Armchair, Cable, Activity, Bike, Footprints, Waves, Zap, Timer, Target, Layers, Box, Circle, ArrowUpFromLine,
  Building2, Home, Hotel, PersonStanding, Camera, Video, ClipboardList, MapPin, Salad, ChefHat, Ticket, FlaskConical,
  HandHeart, Flame, Trophy, BellRing, Utensils, Soup, Fish, Beef, Wheat, Milk, Sandwich, Egg, Apple, Sparkles, Cherry, Leaf, GripHorizontal, Cog,
  type LucideIcon,
} from "lucide-react";
import type { Gear, GymType } from "@shared/fitGym";

const GEAR_ICON: Record<string, LucideIcon> = {
  dumbbells: Dumbbell, barbell: Dumbbell, "squat-rack": Layers, bench: Armchair, "smith-machine": Layers, kettlebells: Dumbbell,
  "cable-station": Cable, "t-bar-row": Dumbbell, "pull-up-bar": GripHorizontal, bands: Activity, "ab-wheel": Circle, "plyo-box": Box,
  "jump-rope": Activity, trx: Activity, "medicine-ball": Circle, treadmill: Footprints, bike: Bike, rower: Waves, elliptical: Footprints,
  "stair-climber": ArrowUpFromLine, "calf-raise-machine": Footprints,
};
const KIND_ICON: Record<string, LucideIcon> = { free: Dumbbell, machine: Cog, cable: Cable, cardio: Activity, station: Layers, small: Target };

export function GearIcon({ gear, className = "h-5 w-5" }: { gear: Pick<Gear, "id" | "kind">; className?: string }) {
  const I = GEAR_ICON[gear.id] || KIND_ICON[gear.kind] || Dumbbell;
  return <I className={className} aria-hidden />;
}

const GYM_ICON: Record<string, LucideIcon> = { apartment: Building2, home: Home, hotel: Hotel, none: PersonStanding, "other-gym": Building2 };
export function GymIcon({ gym, className = "h-5 w-5" }: { gym: Pick<GymType, "id">; className?: string }) {
  const I = GYM_ICON[gym.id] || Dumbbell;
  return <I className={className} aria-hidden />;
}

const FEATURE_ICON: Record<string, LucideIcon> = { "photo-scan": Camera, "camera-reps": Video, debrief: ClipboardList, gyms: MapPin, "eat-out": Salad, "ai-recipes": ChefHat, "guest-pass": Ticket };
export function FeatureIcon({ id, className = "h-5 w-5" }: { id: string; className?: string }) {
  const I = FEATURE_ICON[id] || Sparkles;
  return <I className={className} aria-hidden />;
}

export function SupplementIcon({ id, className = "h-5 w-5" }: { id: string; className?: string }) {
  const I = id === "preworkout" ? Zap : FlaskConical;
  return <I className={className} aria-hidden />;
}

const CHEER_ICON: Record<string, LucideIcon> = { cheer: HandHeart, fire: Flame, strong: Dumbbell, nudge: BellRing };
export function CheerIcon({ kind, className = "h-4 w-4" }: { kind: string; className?: string }) {
  const I = CHEER_ICON[kind] || HandHeart;
  return <I className={className} aria-hidden />;
}
export { Trophy };

/** Recipes have no photo, so each gets a line icon for its main ingredient. */
export function RecipeIcon({ id, tags = [], className = "h-6 w-6" }: { id: string; tags?: string[]; className?: string }) {
  const k = id.toLowerCase();
  const I: LucideIcon =
    /oats|bread|toast|rice|wrap|pasta|meatball/.test(k) ? Wheat :
    /egg|scramble/.test(k) ? Egg :
    /yogurt|cottage|smoothie|shake/.test(k) ? Milk :
    /salmon|shrimp|tuna|fish/.test(k) ? Fish :
    /chicken|turkey|beef|jerky/.test(k) ? Beef :
    /soup|chili|lentil/.test(k) ? Soup :
    /taco|sandwich/.test(k) ? Sandwich :
    /hummus|tofu|sweet-potato/.test(k) ? Leaf :
    tags.includes("snack") ? Apple : Utensils;
  return <I className={className} aria-hidden />;
}
export { Cherry };
