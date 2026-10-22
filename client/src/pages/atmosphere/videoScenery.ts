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

type SourceOpts = { viewW: number; viewH: number; dpr: number; quality: "cinematic" | "balanced"; saveData?: boolean };

/**
 * Files to try for one clip, best first. Big screens (tablet, desktop, TV) on Ultra get the 4K file; phones,
 * Battery saver and "data saver" browsers get the 1080p one, which is plenty sharp and kind to a mobile plan.
 * If the first file fails to play, the next is tried.
 */
export function clipSources(file: string, o: SourceOpts): string[] {
  if (/^https:\/\//i.test(file)) return [file];   // a link the person pasted: played as it is
  const css = Math.max(o.viewW, o.viewH), real = css * Math.max(1, Math.min(o.dpr || 1, 3));
  const big = o.quality === "cinematic" && !o.saveData && css >= 1000 && real >= 2400;
  const large = `${CDN}${file}_large.mp4`, medium = `${CDN}${file}_medium.mp4`;
  return big ? [large, medium] : [medium, large];
}
export const videoSources = (scene: VideoScene, o: SourceOpts): string[] => clipSources(scene.file, o);

// ---------------------------------------------------------------------------------------------------------
// Long scenes: many different clips chained with a soft crossfade, so nothing repeats for 10+ minutes.
// Each entry is "year/month/day/id[-hash]:seconds" (the clip's Pixabay file path and its length).
// ---------------------------------------------------------------------------------------------------------

export type Clip = { file: string; secs: number };
export type Playlist = { id: string; name: string; blurb: string; still: NightSceneId; clips: Clip[] };

/** Seconds of overlap while one clip fades into the next (the player uses the same number). */
export const CROSSFADE = 1.8;

const clips = (...rows: string[]): Clip[] => rows.map((r) => { const [file, secs] = r.split(":"); return { file, secs: Number(secs) }; });

const AURORA = clips(
  "2021/10/05/90877-629483574:30", "2024/05/23/213425:10", "2022/11/11/138593-769988200:20", "2026/03/25/342306:20", "2023/04/10/158344-816637172:18",
  "2026/04/05/344725:11", "2026/09/15/376558:10", "2025/12/13/321683:10", "2021/12/08/100044-658725955:20", "2016/05/12/3117-166335805:24",
  "2024/10/16/236537:24", "2025/08/07/295902:15", "2025/10/07/308505:20", "2025/12/13/321684:10", "2023/11/23/190418-887801977:12",
  "2021/10/05/90875-629483572:30", "2024/05/23/213423:9", "2023/04/30/161095-822582188:18", "2025/11/12/315602:8", "2023/06/08/166292-834580745:31",
  "2021/10/21/92813-637690779:20", "2026/03/23/341925:24", "2026/04/03/344400:30", "2022/09/10/130824-748406215:36", "2025/01/15/252736:10",
);
const SNOW = clips(
  "2024/12/06/245188:52", "2023/02/11/150154-797999306:59", "2021/02/03/63973-509068417:23", "2021/02/03/63970-509068415:31",
  "2021/02/03/63974-509068420:28", "2021/02/03/63967-509068413:21", "2021/02/03/63977-509068423:16",
);
const STARS = clips(
  "2018/03/12/14955-260176883:17", "2023/07/04/169951-842348732:11", "2025/06/13/285663:27", "2022/10/14/134913-760691047:40", "2023/08/15/176198-855206384:7",
  "2026/09/10/375595:12", "2026/09/10/375594:12", "2024/03/24/205427-926957416:40", "2023/09/02/178916-860743101:23", "2021/09/24/89513-614024864:21",
  "2023/07/10/170888-844432955:7", "2024/11/24/243117:10", "2026/02/13/334434:23", "2022/10/18/135425-761676535:29", "2025/01/08/251468:10",
  "2023/03/30/156769-813279603:59", "2023/03/30/156770-813279607:59", "2026/01/23/329836:9", "2024/08/09/225587:26", "2026/10/06/380905:8",
  "2021/12/13/100485-657746408:43", "2026/04/29/349630:30", "2026/01/27/330830:11", "2026/08/04/368458:22", "2025/11/18/316767:36",
  "2024/03/04/202877-919288692:12", "2020/04/08/35419-407130859:8", "2025/05/25/281618:12", "2025/06/03/283431:8", "2024/10/28/238727:13",
  "2021/10/12/91757-636709171:10", "2016/12/31/6960-197634412:6", "2016/12/31/6961-197634411:6", "2016/12/31/6962-197634410:6",
);
const CITY = clips(
  "2019/03/13/21985-323496013:14", "2023/09/13/180386-864121573:31", "2024/03/04/202921-919288838:60", "2019/05/03/23258-334228230:18", "2024/08/09/225661:37",
  "2023/09/07/179458-862151947:29", "2022/11/01/137357-766532324:14", "2024/09/30/233983:20", "2023/07/20/172350-847185398:58", "2020/09/08/49377-459436762:40",
  "2020/08/12/46950-450094784:34", "2022/10/29/137009-765458037:41", "2022/09/25/132508-754089234:36", "2023/08/23/177347-857376739:27", "2022/12/01/141162-777088882:30",
  "2026/02/26/336755:22", "2025/02/03/256109:30", "2022/09/21/132072-752333864:30", "2018/11/29/19627-304735769:17", "2019/11/08/28860-372055467:14",
  "2024/05/27/213956:15", "2024/07/13/220942:15", "2019/12/13/30154-380473720:16", "2022/09/21/132069-752333849:40", "2021/09/18/88922-608445963:24",
  "2015/08/10/243-135867787:55", "2025/02/05/256522:19",
);
const RAIN = clips(
  "2024/10/27/238449:60", "2024/10/27/238450:60", "2024/10/27/238464:60", "2024/10/27/238465:60", "2025/07/31/294606:24",
  "2026/02/06/332900:5", "2026/02/06/332901:5", "2026/03/18/340819:5", "2026/04/24/348525:5",
);
const FIRE = clips(
  "2025/02/10/257593:14", "2024/11/02/239511:26", "2023/01/30/148594-794221537:20", "2024/11/02/239514:34", "2024/11/02/239515:17", "2016/01/02/1808-150713272:30",
  "2022/11/20/139810-773444539:20", "2023/08/15/176147-854875338:30", "2024/04/04/206890:15", "2023/05/13/162821-826740506:43", "2017/04/11/8639-212794817:20",
  "2022/09/15/131416-750559788:19", "2023/08/14/175974-854481146:25", "2023/08/21/177061-856658345:79", "2023/08/03/174417-851502052:59", "2017/12/10/13305-246909936:22",
  "2021/09/22/89377-614062351:25", "2021/09/05/87634-601467001:36", "2024/10/16/236566:49", "2024/02/23/201688-916116512:44", "2025/06/19/286644:22",
);

/** Take clips from several lists in turn, so a long mixed scene keeps changing character. */
function interleave(...lists: Clip[][]): Clip[] {
  const out: Clip[] = [], seen = new Set<string>(), most = Math.max(...lists.map((l) => l.length));
  for (let i = 0; i < most; i++) for (const l of lists) { const c = l[i]; if (c && !seen.has(c.file)) { seen.add(c.file); out.push(c); } }
  return out;
}

/** How long a playlist runs before it starts again, in seconds (clips overlap a little as they crossfade). */
export const playlistSeconds = (clips: Clip[]) => Math.round(clips.reduce((t, c) => t + c.secs - CROSSFADE, 0));
const minutes = (clips: Clip[]) => Math.floor(playlistSeconds(clips) / 60);
const longScene = (id: string, name: string, line: string, still: NightSceneId, list: Clip[]): Playlist => ({ id, name, blurb: `${line}. About ${minutes(list)} minutes before it repeats`, still, clips: list });

export const PLAYLIST_LIST: Playlist[] = [
  longScene("p-journey", "Night Journey", "Aurora, stars, snow, city lights and firelight in turn", "milkyway", interleave(AURORA, STARS, CITY, SNOW, FIRE, RAIN)),
  longScene("p-northern", "Northern Nights", "Northern lights and snowy nights", "aurora", [...AURORA, ...SNOW]),
  longScene("p-starry", "Starry Sky Journey", "Milky Way, mountains, lakes and sea under the stars", "milkyway", STARS),
  longScene("p-city", "City Nights", "Skylines, neon streets and traffic after dark", "city", CITY),
  longScene("p-rainy-city", "Rainy City Nights", "Rain on the window and wet streets, with the city glowing", "tokyo", interleave(RAIN, CITY.slice(0, 12))),
  longScene("p-fire", "Campfire and Firelight", "Flames, embers and woodsmoke, one fire after another", "campsite", FIRE),
];
export const PLAYLISTS: Record<string, Playlist> = Object.fromEntries(PLAYLIST_LIST.map((p) => [p.id, p]));
export const PLAYLIST_ORDER: string[] = PLAYLIST_LIST.map((p) => p.id);
export const isPlaylist = (id: unknown): boolean => typeof id === "string" && Object.prototype.hasOwnProperty.call(PLAYLISTS, id);

/** Everything a scene choice plays: one or many clips (as file paths), the still behind it, and where to credit it. */
export type VideoPlan = { id: string; name: string; blurb: string; still: NightSceneId; files: string[]; page?: string; long: boolean };
export function videoPlan(id: unknown): VideoPlan | null {
  if (typeof id !== "string") return null;
  if (isVideoScene(id)) { const v = VIDEO_SCENES[id]; return { id, name: v.name, blurb: v.blurb, still: v.still, files: [v.file], page: v.page, long: false }; }
  if (isPlaylist(id)) { const p = PLAYLISTS[id]; return { id, name: p.name, blurb: p.blurb, still: p.still, files: p.clips.map((c) => c.file), long: true }; }
  return null;
}

// ---------------------------------------------------------------------------------------------------------
// Your own link: a YouTube video or playlist (any length, up to 4K on a big screen) or a direct video file.
// ---------------------------------------------------------------------------------------------------------

export type VideoLink = { kind: "youtube-video" | "youtube-playlist"; id: string } | { kind: "file"; url: string };

export function parseVideoLink(text: string): VideoLink | null {
  const raw = (text || "").trim();
  if (!raw || raw.length > 400) return null;
  let u: URL;
  try { u = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : "https://" + raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.replace(/^(www|m|music)\./, "");
  const idOk = (x: string | null | undefined) => !!x && /^[A-Za-z0-9_-]{6,64}$/.test(x);
  if (host === "youtu.be") { const id = u.pathname.split("/")[1]; return idOk(id) && id.length === 11 ? { kind: "youtube-video", id } : null; }
  if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const v = u.searchParams.get("v"), list = u.searchParams.get("list");
    const path = u.pathname.split("/").filter(Boolean);
    const pathId = ["embed", "shorts", "live", "v"].includes(path[0]) ? path[1] : null;
    const vid = v ?? pathId;
    if (idOk(vid) && vid!.length === 11) return { kind: "youtube-video", id: vid! };
    if (idOk(list)) return { kind: "youtube-playlist", id: list! };
    return null;
  }
  if (/\.(mp4|webm|mov|m4v)$/i.test(u.pathname)) return { kind: "file", url: u.toString() };
  return null;
}

export const youtubeEmbedUrl = (link: Extract<VideoLink, { kind: "youtube-video" | "youtube-playlist" }>) =>
  "https://www.youtube-nocookie.com/embed/" + (link.kind === "youtube-video" ? link.id + "?playlist=" + link.id : "videoseries?listType=playlist&list=" + link.id)
  + "&autoplay=1&mute=1&loop=1&controls=0&playsinline=1&modestbranding=1&rel=0&disablekb=1&fs=0&iv_load_policy=3&enablejsapi=1";
