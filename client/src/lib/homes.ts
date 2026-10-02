// Shared info about each home tier and furniture item — used by the shop, The Block and the home interior.

export type HomeInfo = { id: string; name: string; tagline: string; features: string[]; wall: number; floor: number; accent: number; sky: number; trim: number };

export const HOME_INFO: Record<string, HomeInfo> = {
  "home-basic": {
    id: "home-basic", name: "Starter Cottage", tagline: "A cozy first home with everything you need.",
    features: ["6 rooms", "Living room TV", "Reading nook", "Game corner"],
    wall: 0xf5efe6, floor: 0xc9a77c, accent: 0x2563eb, sky: 0xbfe4ff, trim: 0xffffff,
  },
  "home-studio": {
    id: "home-studio", name: "City Studio", tagline: "Bright and artsy, with a big fish tank and an art studio.",
    features: ["Everything in the Starter Cottage", "Glowing fish tank", "Art corner with easel", "Hanging plants"],
    wall: 0xe8f1f5, floor: 0x9fb4c4, accent: 0x14b8a6, sky: 0xcdeffd, trim: 0x0f766e,
  },
  "home-loft": {
    id: "home-loft", name: "Skyline Loft", tagline: "A neon night-time loft with an arcade wall and a DJ booth.",
    features: ["Everything in the City Studio", "Neon arcade wall", "DJ booth with lights", "City-view windows"],
    wall: 0x2a2838, floor: 0x46404f, accent: 0xa855f7, sky: 0x111827, trim: 0xf472b6,
  },
  "home-modern": {
    id: "home-modern", name: "Modern Mansion", tagline: "The dream home: hot tub, fireplace, grand piano and a chandelier.",
    features: ["Everything in the Skyline Loft", "Hot tub", "Fireplace lounge", "Grand piano", "Crystal chandelier"],
    wall: 0xf4f2ec, floor: 0xd9cfc0, accent: 0x0284c7, sky: 0xbfe4ff, trim: 0xb45309,
  },
};
export const HOME_ORDER = ["home-basic", "home-studio", "home-loft", "home-modern"];
export const homeInfo = (id: string | undefined | null) => HOME_INFO[id || ""] || HOME_INFO["home-basic"];
export const homeRank = (id: string | undefined | null) => Math.max(0, HOME_ORDER.indexOf(id || "home-basic"));

export const FURNITURE_INFO: Record<string, { emoji: string; blurb: string }> = {
  "furniture-desk": { emoji: "🖥️", blurb: "A creator desk with a glowing monitor in the bedroom." },
  "furniture-sofa": { emoji: "🛋️", blurb: "A puffy purple cloud sofa for the kitchen lounge." },
  "furniture-books": { emoji: "📚", blurb: "A floor-to-ceiling wall of colorful books." },
  "furniture-neon": { emoji: "💡", blurb: "A glowing neon READ sign for your reading room." },
  "furniture-plants": { emoji: "🪴", blurb: "A jungle of leafy plants all through the house." },
  "furniture-beanbags": { emoji: "🫘", blurb: "Squishy beanbags in the game corner." },
  "furniture-aquarium": { emoji: "🐠", blurb: "A glowing fish tank with swimming fish." },
  "furniture-trophy": { emoji: "🏆", blurb: "A shelf of shiny trophies to show off." },
  "furniture-telescope": { emoji: "🔭", blurb: "A star-gazing telescope by the window." },
  "furniture-arcade": { emoji: "🕹️", blurb: "Your very own glowing arcade cabinet." },
  "furniture-fireplace": { emoji: "🔥", blurb: "A crackling fireplace that warms the living room." },
  "furniture-piano": { emoji: "🎹", blurb: "A shiny piano for the living room." },
};
