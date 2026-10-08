// Teacher Hub: the look of the big "Your teacher workspace" box on Home. A teacher picks its color, adds a picture
// and chooses how tall it is. Saved in profile.banner, so it follows them to every device.
import { cleanColor } from "./hubPins";

export const BANNER_SIZES = [
  { id: "compact", label: "Small", minHeight: "0rem" },
  { id: "normal", label: "Medium", minHeight: "0rem" },
  { id: "tall", label: "Large", minHeight: "18rem" },
] as const;
export type BannerSize = (typeof BANNER_SIZES)[number]["id"];

export type Banner = { color: string; image: string; size: BannerSize };

export const BANNER_COLORS = [
  { name: "Night", hex: "#020617" }, { name: "Teal", hex: "#0f766e" }, { name: "Blue", hex: "#1d4ed8" }, { name: "Purple", hex: "#7e22ce" },
  { name: "Pink", hex: "#be185d" }, { name: "Red", hex: "#b91c1c" }, { name: "Orange", hex: "#c2410c" }, { name: "Green", hex: "#15803d" },
  { name: "Gold", hex: "#facc15" }, { name: "Sky", hex: "#bae6fd" }, { name: "White", hex: "#ffffff" },
] as const;

export const DEFAULT_BANNER: Banner = { color: "#020617", image: "", size: "normal" };

/** A picture kept in the Hub is shrunk first; this is the most characters one may take up (about 330 KB). */
export const MAX_BANNER_IMAGE = 450_000;

/** A saved banner made safe: a real color, a small picture that is really an image, a known size. */
export function cleanBanner(raw: unknown): Banner {
  const r: any = raw && typeof raw === "object" ? raw : {};
  const image = typeof r.image === "string" && r.image.length <= MAX_BANNER_IMAGE && /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(r.image) ? r.image : "";
  const size: BannerSize = BANNER_SIZES.some((s) => s.id === r.size) ? r.size : "normal";
  return { color: /^#[0-9a-fA-F]{6}$/.test(String(r.color || "")) ? cleanColor(String(r.color)) : DEFAULT_BANNER.color, image, size };
}

export const bannerMinHeight = (size: BannerSize) => BANNER_SIZES.find((s) => s.id === size)?.minHeight ?? "0rem";
