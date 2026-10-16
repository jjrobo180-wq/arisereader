/**
 * A.R.I.S.E. Standby: night scenery.
 *
 * Real photographs, shown full screen at the sharpness of the screen they are on (up to 4K), with
 * a little life laid over them: a slow drift of the camera, shooting stars, fireflies, snow, rain,
 * mist. The photos come from Unsplash's image network, which is free to use for this
 * (https://unsplash.com/license). Each one is asked for at the size the screen needs, so a phone
 * does not download a 4K picture and a 4K screen is not handed a small one.
 *
 * If a photo cannot load (offline, or the network blocks it), a starry sky is painted instead, so
 * the screen is never empty. Every scene's `tint` is the colour of the photo's sky and ground,
 * used for the thumbnails and the moment before the photo arrives.
 */

export type NightSceneId =
  | "milkyway" | "peaks" | "starlake" | "aurora" | "lofoten" | "moonsea" | "moonpeaks" | "desert" | "dunes"
  | "campsite" | "tent" | "cabin" | "lighthouse" | "city" | "tokyo" | "lanterns" | "tropics" | "mountainlake";

/** What drifts over the photo. */
export type FxId = "shooting" | "fireflies" | "snow" | "rain" | "mist" | "lanterns" | "flash";

export type NightScene = {
  id: NightSceneId;
  name: string;
  blurb: string;
  /** The photo's id on images.unsplash.com. */
  photo: string;
  photographer: string;
  /** Where to keep the picture centred when the screen is a different shape (CSS object-position). */
  focus: string;
  /** Sky colour at the top, then the colour near the ground. */
  tint: [string, string];
  fx: FxId[];
  /** True when the scene is bright enough to need a stronger shade behind the text. */
  bright?: boolean;
};

export const NIGHT_SCENES: Record<NightSceneId, NightScene> = {
  milkyway: { id: "milkyway", name: "Milky Way", blurb: "The galaxy, arching over a dark sky", photo: "photo-1519810755548-39cd217da494", photographer: "Ferenc Horvath", focus: "50% 40%", tint: ["#050914", "#1b2a4a"], fx: ["shooting"] },
  peaks: { id: "peaks", name: "Starry Peaks", blurb: "Pine ridges under a deep blue night", photo: "photo-1465101046530-73398c7f28ca", photographer: "Jeremy Thomas", focus: "50% 45%", tint: ["#06112a", "#1c3a66"], fx: ["shooting"] },
  starlake: { id: "starlake", name: "Starlit Lake", blurb: "Still water holding the whole sky", photo: "photo-1647526232058-4eddccbebf53", photographer: "Quick PS", focus: "50% 50%", tint: ["#0a1430", "#2c3f6a"], fx: ["shooting"] },
  aurora: { id: "aurora", name: "Northern Lights", blurb: "A green aurora over snowy mountains", photo: "photo-1531366936337-7c912a4589a7", photographer: "Lightscape", focus: "50% 45%", tint: ["#04141c", "#0f4a45"], fx: ["shooting"] },
  lofoten: { id: "lofoten", name: "Lofoten Aurora", blurb: "Aurora above a snowy fishing village", photo: "photo-1593378026483-2a1fd46a35bd", photographer: "Johny Goerend", focus: "50% 45%", tint: ["#06161f", "#1d5a52"], fx: ["shooting"] },
  moonsea: { id: "moonsea", name: "Moonlit Sea", blurb: "A full moon laying a path across the water", photo: "photo-1535332371349-a5d229f49cb5", photographer: "Guzmán Barquín", focus: "50% 40%", tint: ["#0b1326", "#34476b"], fx: ["mist"], bright: true },
  moonpeaks: { id: "moonpeaks", name: "Moon over the Peaks", blurb: "A bright moon above snow-capped mountains", photo: "photo-1429892494097-cccc61109f58", photographer: "Benjamin Child", focus: "50% 50%", tint: ["#0a1a3a", "#4a6a9a"], fx: ["mist"], bright: true },
  desert: { id: "desert", name: "Desert Night", blurb: "The Milky Way over a quiet desert", photo: "photo-1507917570388-d661984ea008", photographer: "Jimmy Larry", focus: "50% 45%", tint: ["#07101f", "#3a3a52"], fx: ["shooting"] },
  dunes: { id: "dunes", name: "Dunes and Shooting Star", blurb: "A shooting star over rippled sand", photo: "photo-1545243424-0ce743321e11", photographer: "Massimiliano Morosinotto", focus: "50% 50%", tint: ["#2a1740", "#7a4a72"], fx: ["shooting"] },
  campsite: { id: "campsite", name: "Campsite", blurb: "A glowing tent in the forest", photo: "photo-1470246973918-29a93221c455", photographer: "Denys Nevozhai", focus: "50% 55%", tint: ["#08142a", "#2a4a6a"], fx: ["fireflies"] },
  tent: { id: "tent", name: "Tent under the Stars", blurb: "A quiet field and a sky full of stars", photo: "photo-1505735754789-3404132203ed", photographer: "Ihor Malytskyi", focus: "50% 50%", tint: ["#07122a", "#26507a"], fx: ["shooting", "fireflies"] },
  cabin: { id: "cabin", name: "Snowy Cabin", blurb: "A warm window and snow falling softly", photo: "photo-1635348645548-29ddecfef517", photographer: "Rodney Saigeon", focus: "50% 55%", tint: ["#0a1430", "#3a527a"], fx: ["snow"] },
  lighthouse: { id: "lighthouse", name: "Lighthouse", blurb: "A lighthouse beneath a sky of stars", photo: "photo-1610029795220-e5afca4dc7ba", photographer: "Nathan Jennings", focus: "50% 50%", tint: ["#06102a", "#24406a"], fx: ["shooting", "mist"] },
  city: { id: "city", name: "City Lights", blurb: "A bridge and a skyline glittering at night", photo: "photo-1500632907344-a073709b2448", photographer: "Kai Pilger", focus: "50% 55%", tint: ["#0a1430", "#4a5a8a"], fx: [], bright: true },
  tokyo: { id: "tokyo", name: "Tokyo in the Rain", blurb: "Neon on a wet street", photo: "photo-1601042879364-f3947d3f9c16", photographer: "Valentin Beauvais", focus: "50% 55%", tint: ["#12102a", "#5a2a5a"], fx: ["rain"], bright: true },
  lanterns: { id: "lanterns", name: "Sky Lanterns", blurb: "Lanterns drifting up into the dark", photo: "photo-1509596700509-1d25909b83aa", photographer: "Jordan Madrid", focus: "50% 50%", tint: ["#0a0f24", "#6a3a22"], fx: ["lanterns"] },
  tropics: { id: "tropics", name: "Tropical Night", blurb: "Palm trees and stars over a warm beach", photo: "photo-1566758190635-25f7f33c0d89", photographer: "Jessica Weiller", focus: "50% 50%", tint: ["#08132a", "#2a4a6a"], fx: ["shooting"] },
  mountainlake: { id: "mountainlake", name: "Mountain Lake", blurb: "Stars above a calm lake and the hills", photo: "photo-1582651138242-7b703b7d2d93", photographer: "Vladislav Zakharevich", focus: "50% 50%", tint: ["#0a1224", "#2a3f5a"], fx: ["mist", "shooting"] },
};

export const NIGHT_SCENE_ORDER: NightSceneId[] = [
  "milkyway", "peaks", "starlake", "aurora", "lofoten", "moonsea", "moonpeaks", "desert", "dunes",
  "campsite", "tent", "cabin", "lighthouse", "city", "tokyo", "lanterns", "tropics", "mountainlake",
];

export const isNightScene = (id: unknown): id is NightSceneId => typeof id === "string" && Object.prototype.hasOwnProperty.call(NIGHT_SCENES, id);

/** The widths a photo is asked for. Few, so the network's cache serves most requests. */
const WIDTHS = [640, 1280, 1920, 2560, 3200, 3840];

/** The width to ask for so the photo is sharp on this screen: what it covers, in real pixels. */
export function photoWidth(viewW: number, viewH: number, dpr: number, quality: "cinematic" | "balanced"): number {
  const want = Math.max(viewW, viewH) * Math.max(1, Math.min(dpr || 1, 3));
  const cap = quality === "cinematic" ? 3840 : 1920;
  const fit = WIDTHS.find((w) => w >= want) ?? WIDTHS[WIDTHS.length - 1];
  return Math.min(fit, cap);
}

export function photoUrl(id: string, width: number, quality = 80): string {
  return `https://images.unsplash.com/${id}?auto=format&fit=max&w=${width}&q=${quality}`;
}

/** Live Weather at night: the photo that goes with what the sky is doing. */
export function liveNightScene(weather: "clear" | "clouds" | "rain" | "snow" | "storm" | "fog"): NightSceneId {
  switch (weather) {
    case "clouds": return "moonpeaks";
    case "fog": return "mountainlake";
    case "rain": case "storm": return "tokyo";
    case "snow": return "cabin";
    default: return "milkyway";
  }
}

/** True from 7 PM to 6 AM, when Live Weather shows a night photo instead of a day one. */
export const isNightHour = (hour: number) => hour >= 19 || hour < 6;
