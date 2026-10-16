/**
 * Looping 4K night footage for A.R.I.S.E. Standby ("Live video" scenes).
 *
 * Clips come from Pixabay (free to use, no attribution required, credited on screen anyway). Each scene has a
 * `still` photograph from nightScenery.ts: it shows while the clip loads, and stays if the clip cannot play,
 * so the screen is never empty. To swap a clip, change its `file` path (taken from the clip's Pixabay page).
 */
import type { NightSceneId } from "./nightScenery";

export type VideoScene = { id: string; name: string; blurb: string; still: NightSceneId; file: string; page: string };

const CDN = "https://cdn.pixabay.com/video/";
const PAGE = "https://pixabay.com/videos/";
const clip = (id: string, name: string, blurb: string, still: NightSceneId, file: string, page: string): VideoScene => ({ id, name, blurb, still, file, page: PAGE + page + "/" });

export const VIDEO_SCENE_LIST: VideoScene[] = [
  clip("v-starry-peaks", "Starry Mountains", "Stars wheeling over a mountain ridge", "peaks", "2023/07/04/169951-842348732", "starry-sky-mountains-milky-way-169951"),
  clip("v-milkyway-woods", "Milky Way over the Woods", "The galaxy turning above a dark forest", "milkyway", "2023/07/10/170888-844432955", "starry-sky-milky-way-woods-mountain-170888"),
  clip("v-milkyway-clouds", "Milky Way and Clouds", "Clouds sliding through a starry sky", "milkyway", "2025/06/13/285663", "starry-sky-milky-way-cloud-285663"),
  clip("v-starry-tree", "Lone Tree, Starry Sky", "A single tree under turning stars", "milkyway", "2023/08/15/176198-855206384", "tree-stars-starry-galaxy-night-176198"),
  clip("v-lake-stars", "Milky Way over the Lake", "Stars above still, glowing water", "starlake", "2026/09/10/375594", "milky-way-stars-lake-night-lights-375594"),
  clip("v-sihlsee", "Sihlsee Night Sky", "A Swiss lake under the Milky Way", "starlake", "2026/09/10/375595", "milky-way-stars-sihlsee-settle-down-375595"),
  clip("v-ocean-stars", "Ocean under the Milky Way", "Waves rolling beneath the stars", "moonsea", "2021/09/24/89513-614024864", "ocean-stars-milky-way-waves-sea-89513"),
  clip("v-greek-stars", "Greek Island Night Sky", "A Mediterranean sky full of stars", "milkyway", "2022/10/18/135425-761676535", "starry-sky-stars-night-sky-135425"),
  clip("v-tyrol-stars", "South Tyrol Stars", "Dolomite peaks under a clear night", "peaks", "2018/03/12/14955-260176883", "starry-sky-seis-am-schlern-14955"),
  clip("v-star-trails", "Star Trails", "A long exposure of the sky turning", "milkyway", "2016/12/31/6960-197634412", "stars-long-exposure-starry-sky-6960"),
  clip("v-misty-tree", "Misty Tree and Stars", "Fog drifting past a bare tree at night", "mountainlake", "2022/10/14/134913-760691047", "tree-bare-tree-stars-fog-mist-134913"),
  clip("v-rice-night", "Rice Terraces at Night", "Terraced fields glowing under the stars", "tropics", "2025/05/25/281618", "night-view-paddy-field-rice-terraces-281618"),
  clip("v-aurora-green", "Northern Lights", "Green aurora rippling across the sky", "aurora", "2021/10/05/90877-629483574", "aurora-borealis-northern-lights-90877"),
  clip("v-aurora-lake", "Aurora over the Lake", "The lights reflected in calm water", "aurora", "2026/03/25/342306", "aurora-borealis-lake-reflection-342306"),
  clip("v-aurora-snow", "Aurora over Snow", "Northern lights above a snowy plain", "aurora", "2023/04/10/158344-816637172", "aurora-borealis-northern-lights-snow-158344"),
  clip("v-aurora-peaks", "Aurora over Mountains", "Curtains of light behind dark peaks", "lofoten", "2023/11/23/190418-887801977", "mountains-aurora-borealis-190418"),
  clip("v-snow-shack", "Snowy Shack in Fog", "A warm light in a quiet snowy night", "cabin", "2024/12/06/245188", "shack-winter-snow-fog-light-night-245188"),
  clip("v-snow-window", "Snow Outside the Window", "Snowflakes falling past a moonlit forest", "cabin", "2023/02/11/150154-797999306", "window-snow-snowflakes-forest-moon-150154"),
  clip("v-cabin-pond", "Cabin by the Pond", "Glowing windows beside still water", "cabin", "2023/05/15/163111-827112870", "cabin-night-pond-glowing-lights-163111"),
  clip("v-campfire", "Campfire at Night", "Flames crackling in the dark", "campsite", "2025/02/10/257593", "campfire-flames-night-fire-camp-257593"),
  clip("v-fire-woods", "Fire in the Woods", "A camp fire glowing among the trees", "campsite", "2026/03/13/339996", "fireplace-camping-woods-night-339996"),
  clip("v-glow-waves", "Glowing Waves", "Bioluminescence lighting a quiet beach", "tropics", "2026/03/31/343671", "bioluminescence-beach-waves-sea-343671"),
  clip("v-city-drone", "City Lights from Above", "A slow flight over a glittering city", "city", "2024/09/30/233983", "buildings-city-night-lights-drone-233983"),
  clip("v-city-timelapse", "City Night Timelapse", "Traffic light trails through a sleepless city", "city", "2026/03/06/338630", "night-city-road-urban-building-338630"),
  clip("v-seoul-neon", "Seoul Neon Street", "Neon signs and traffic after dark", "tokyo", "2019/02/01/21116-315137080", "seoul-street-night-neon-traffic-21116"),
  clip("v-rain-glass", "Rain on the Window", "City lights blurred through rain on glass", "tokyo", "2024/10/27/238449", "rain-on-glass-city-lights-at-night-238449"),
  clip("v-times-rain", "Times Square in the Rain", "A rainy night in New York", "tokyo", "2026/02/06/332901", "times-square-new-york-rainy-night-332901"),
  clip("v-storm-window", "Thunderstorm over the City", "Rain and thunder seen from a window", "tokyo", "2024/02/23/201671-916080479", "city-rain-thunder-window-night-201671"),
];

export const VIDEO_SCENES: Record<string, VideoScene> = Object.fromEntries(VIDEO_SCENE_LIST.map((v) => [v.id, v]));
export const VIDEO_SCENE_ORDER: string[] = VIDEO_SCENE_LIST.map((v) => v.id);
export const isVideoScene = (id: unknown): boolean => typeof id === "string" && Object.prototype.hasOwnProperty.call(VIDEO_SCENES, id);

/** The 4K file ("large") and the lighter 1080p file ("medium") of a clip. */
export const videoFile = (scene: VideoScene, size: "large" | "medium") => `${CDN}${scene.file}_${size}.mp4`;

/**
 * Files to try, best first. Big screens (tablet, desktop, TV) on Ultra get the 4K file; phones, Battery saver and
 * "data saver" browsers get the 1080p one, which is plenty sharp and kind to a mobile plan. If the first file fails
 * to play, the next is tried.
 */
export function videoSources(scene: VideoScene, o: { viewW: number; viewH: number; dpr: number; quality: "cinematic" | "balanced"; saveData?: boolean }): string[] {
  const css = Math.max(o.viewW, o.viewH), real = css * Math.max(1, Math.min(o.dpr || 1, 3));
  const big = o.quality === "cinematic" && !o.saveData && css >= 1000 && real >= 2400;
  return big ? [videoFile(scene, "large"), videoFile(scene, "medium")] : [videoFile(scene, "medium"), videoFile(scene, "large")];
}
