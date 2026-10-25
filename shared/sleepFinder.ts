// Arise LifeHub · Sleep Finder: helps someone find something to fall asleep to. It asks what they're
// into (rain or piano, history talks or no voices at all, YouTube or Spotify), recommends real,
// well-known sleep sounds, music, stories and podcasts with links, and keeps the playlists they build.
//
// Links are never guessed web addresses: every pick carries a search phrase, and the link opens that
// search on YouTube, Spotify or Apple, so it always lands on something real and still there tonight.
// The person's own links (pasted into a playlist) are kept only when they are plain https addresses.

// ── What the app asks ────────────────────────────────────────────────────────

export const KINDS = ["rain", "ocean", "noise", "nature", "cozy", "music", "piano", "lofi", "ambient", "scores", "story", "podcast", "meditation", "asmr", "faith", "lullaby"] as const;
export type Kind = (typeof KINDS)[number];
export const KIND_LABELS: Record<Kind, { label: string; emoji: string }> = {
  rain: { label: "Rain & storms", emoji: "🌧️" },
  ocean: { label: "Ocean & water", emoji: "🌊" },
  noise: { label: "Steady noise (brown, white, fan)", emoji: "🌀" },
  nature: { label: "Forest, crickets, wind", emoji: "🌲" },
  cozy: { label: "Cozy places (fire, train, café)", emoji: "🔥" },
  music: { label: "Calm music", emoji: "🎵" },
  piano: { label: "Piano & classical", emoji: "🎹" },
  lofi: { label: "Lo-fi beats", emoji: "🎧" },
  ambient: { label: "Ambient & space drones", emoji: "🌌" },
  scores: { label: "Game & movie music", emoji: "🎮" },
  story: { label: "Sleep stories", emoji: "📖" },
  podcast: { label: "Boring podcasts & talks", emoji: "🎙️" },
  meditation: { label: "Guided meditation", emoji: "🧘" },
  asmr: { label: "ASMR & whispers", emoji: "🤫" },
  faith: { label: "Scripture & worship", emoji: "🙏" },
  lullaby: { label: "Lullabies", emoji: "👶" },
};

export const TOPICS = ["history", "space", "nature", "fantasy", "mystery", "travel", "cozy", "bible", "books", "games", "art", "science"] as const;
export type Topic = (typeof TOPICS)[number];
export const TOPIC_LABELS: Record<Topic, string> = {
  history: "History", space: "Space", nature: "Nature & animals", fantasy: "Fantasy & fairy tales", mystery: "Gentle mysteries",
  travel: "Trains & travel", cozy: "Cozy everyday life", bible: "Bible stories", books: "Classic books", games: "Video games",
  art: "Art & painting", science: "Science & how things work",
};

export const VOICES = ["none", "soft", "talk"] as const;
export type Voice = (typeof VOICES)[number];
export const VOICE_LABELS: Record<Voice, string> = { none: "No voices at all", soft: "A soft voice is fine", talk: "Talk me to sleep" };

export const PLACES = ["any", "youtube", "spotify", "apple"] as const;
export type Place = (typeof PLACES)[number];
export const PLACE_LABELS: Record<Place, string> = { any: "Anywhere", youtube: "YouTube", spotify: "Spotify", apple: "Apple Music & Podcasts" };

export const LENGTHS = ["any", "short", "medium", "long"] as const;
export type Length = (typeof LENGTHS)[number];
export const LENGTH_LABELS: Record<Length, string> = { any: "Doesn't matter", short: "Under an hour", medium: "An hour or two", long: "All night (8–10 hours)" };

export const WHOS = ["me", "kid", "baby"] as const;
export type Who = (typeof WHOS)[number];
export const WHO_LABELS: Record<Who, string> = { me: "Me (a grown-up)", kid: "A kid", baby: "A baby" };

export type SleepPrefs = {
  kinds: Kind[];
  topics: Topic[];
  voice: Voice;
  place: Place;
  length: Length;
  who: Who;
  /** YouTube picks lean toward black-screen videos, so the room stays dark. */
  dark: boolean;
};

// ── What the app keeps ───────────────────────────────────────────────────────

/** One thing in a playlist. `ref` is the catalog pick it came from (or "" for the AI's or the
 *  person's own). `query` opens a search; `url` is the person's own link and wins when set. */
export type PlaylistItem = { id: string; ref: string; title: string; by: string; kind: Kind; query: string; url: string; mins: number };
export type SleepPlaylist = { id: string; name: string; emoji: string; items: PlaylistItem[]; createdAt: string };

export type SleepFinder = {
  /** null until the questions are answered once. */
  prefs: SleepPrefs | null;
  playlists: SleepPlaylist[];
  /** Catalog picks marked "this works for me" (they rank higher) and "not for me" (hidden). */
  liked: string[];
  hidden: string[];
  /** The things they searched for most recently, newest first. */
  searches: string[];
};

export const FINDER_LIMITS = { playlists: 30, items: 60, liked: 300, hidden: 300, searches: 12, title: 120, by: 80, query: 140, url: 600, name: 50 };

export const emptySleepFinder = (): SleepFinder => ({ prefs: null, playlists: [], liked: [], hidden: [], searches: [] });
export const defaultPrefs = (): SleepPrefs => ({ kinds: [], topics: [], voice: "soft", place: "any", length: "any", who: "me", dark: true });

// ── The catalog: real, well-known things people fall asleep to ───────────────

export type SleepPick = {
  id: string;
  title: string;
  by: string;
  kind: Kind;
  /** Other kinds it also suits, for matching. */
  also?: Kind[];
  topics?: Topic[];
  voice: Voice;
  length: Exclude<Length, "any">;
  who?: Who[];
  /** One line on why people sleep to it. */
  about: string;
  /** The search phrase the links open. */
  query: string;
  /** Where it lives. Podcasts open in podcast apps, the rest in music apps and YouTube. */
  on: ("youtube" | "spotify" | "apple" | "podcasts")[];
  /** Roughly how long one play is, in minutes (for playlist totals). */
  mins: number;
};

const ALL: SleepPick["on"] = ["youtube", "spotify", "apple"];
const POD: SleepPick["on"] = ["spotify", "podcasts", "youtube"];
const YT: SleepPick["on"] = ["youtube"];

export const CATALOG: SleepPick[] = [
  // Sounds
  { id: "rain-tent", title: "Rain on a tent", by: "10-hour sound", kind: "rain", also: ["nature"], topics: ["nature"], voice: "none", length: "long", about: "Soft, close rain with no thunder. The pattering hides house noises.", query: "rain on tent 10 hours sleep", on: ["youtube", "spotify"], mins: 600 },
  { id: "thunder", title: "Thunderstorm at night", by: "10-hour sound", kind: "rain", voice: "none", length: "long", about: "Steady rain with low, distant rumbles. Many find it more soothing than plain rain.", query: "thunderstorm sounds for sleeping 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "rain-window", title: "Rain on a window", by: "10-hour sound", kind: "rain", also: ["cozy"], topics: ["cozy"], voice: "none", length: "long", about: "Rain against glass from inside a warm room.", query: "rain on window sounds sleep 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "ocean", title: "Ocean waves on the shore", by: "10-hour sound", kind: "ocean", also: ["nature"], topics: ["nature"], voice: "none", length: "long", about: "Slow waves rolling in. Their rhythm is close to slow breathing.", query: "ocean waves sleep 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "underwater", title: "Underwater ambience", by: "10-hour sound", kind: "ocean", also: ["ambient"], voice: "none", length: "long", about: "Muffled, deep and bubbly, like floating under the surface.", query: "underwater ambience sleep 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "stream", title: "Gentle mountain stream", by: "10-hour sound", kind: "nature", also: ["ocean"], topics: ["nature"], voice: "none", length: "long", about: "Trickling water over rocks with birds far off.", query: "gentle stream sounds sleep 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "brown", title: "Brown noise", by: "10-hour sound", kind: "noise", voice: "none", length: "long", about: "A deep, rumbly hush. Popular with ADHD and racing minds.", query: "brown noise 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "white", title: "White noise", by: "10-hour sound", kind: "noise", voice: "none", length: "long", who: ["me", "kid", "baby"], about: "Bright and even. Best for covering sudden noises.", query: "white noise 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "pink", title: "Pink noise", by: "10-hour sound", kind: "noise", voice: "none", length: "long", about: "Softer than white noise, like steady rain without the drops.", query: "pink noise 10 hours sleep", on: ["youtube", "spotify"], mins: 600 },
  { id: "fan", title: "Box fan", by: "10-hour sound", kind: "noise", also: ["cozy"], voice: "none", length: "long", who: ["me", "kid", "baby"], about: "The sound a lot of people grew up sleeping to, without the cold air.", query: "box fan sound 10 hours sleep", on: ["youtube", "spotify"], mins: 600 },
  { id: "airplane", title: "Airplane cabin hum", by: "10-hour sound", kind: "noise", also: ["cozy"], topics: ["travel"], voice: "none", length: "long", about: "The low drone of a long overnight flight.", query: "airplane cabin white noise 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "starship", title: "Starship engine hum", by: "10-hour ambience", kind: "ambient", also: ["noise"], topics: ["space", "fantasy"], voice: "none", length: "long", about: "A deep spaceship idle with soft beeps. Brown noise with a story to it.", query: "spaceship engine ambience sleep 10 hours", on: YT, mins: 600 },
  { id: "crickets", title: "Summer night, crickets", by: "10-hour sound", kind: "nature", topics: ["nature"], voice: "none", length: "long", about: "Crickets and a light breeze on a warm night.", query: "crickets night sounds sleep 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "forest", title: "Night forest", by: "10-hour sound", kind: "nature", topics: ["nature"], voice: "none", length: "long", about: "Wind in trees, an owl now and then, a creek nearby.", query: "night forest ambience sleep 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "fireplace", title: "Crackling fireplace", by: "10-hour sound", kind: "cozy", voice: "none", length: "long", about: "Pops and crackles of a slow fire. Warm without being loud.", query: "crackling fireplace 10 hours sleep", on: ["youtube", "spotify"], mins: 600 },
  { id: "cabin-snow", title: "Cabin in a snowstorm", by: "10-hour ambience", kind: "cozy", also: ["nature"], topics: ["cozy"], voice: "none", length: "long", about: "Wind howling outside while a fire crackles inside.", query: "cozy cabin snowstorm fireplace ambience sleep", on: YT, mins: 600 },
  { id: "train", title: "Overnight train ride", by: "10-hour sound", kind: "cozy", also: ["noise"], topics: ["travel"], voice: "none", length: "long", about: "Clickety-clack of rails and the low rumble of a sleeper car.", query: "train ride sounds for sleep 10 hours", on: ["youtube", "spotify"], mins: 600 },
  { id: "cafe-rain", title: "Rainy café", by: "Ambience", kind: "cozy", also: ["rain"], topics: ["cozy"], voice: "soft", length: "long", about: "Murmuring voices, cups and rain outside. Good if silence feels lonely.", query: "rainy cafe ambience sleep", on: YT, mins: 180 },
  { id: "tavern", title: "Fantasy tavern at night", by: "Ambience", kind: "cozy", also: ["scores"], topics: ["fantasy", "games"], voice: "soft", length: "medium", about: "A quiet inn: fire, a lute, low chatter, rain on the shutters.", query: "fantasy tavern ambience night rain", on: YT, mins: 120 },
  { id: "purr", title: "Cat purring", by: "Sound", kind: "nature", also: ["noise"], topics: ["nature"], voice: "none", length: "long", about: "A slow, steady purr. Oddly calming, even for dog people.", query: "cat purring sounds sleep", on: ["youtube", "spotify"], mins: 180 },
  { id: "womb", title: "Womb & heartbeat sounds", by: "Sound for babies", kind: "lullaby", also: ["noise"], voice: "none", length: "long", who: ["baby"], about: "The whoosh and heartbeat babies heard before they were born.", query: "womb sounds heartbeat baby sleep", on: ["youtube", "spotify"], mins: 600 },
  { id: "car-night", title: "Night drive in the rain", by: "Ambience", kind: "cozy", also: ["rain"], topics: ["travel"], voice: "none", length: "long", about: "Tires on wet road, wipers and rain on the roof, from the back seat.", query: "night car ride rain sounds sleep", on: YT, mins: 180 },
  { id: "dryer", title: "Clothes dryer", by: "Sound", kind: "noise", voice: "none", length: "long", who: ["me", "baby"], about: "A warm, tumbling hum. A favorite for fussy babies too.", query: "clothes dryer sound 10 hours", on: ["youtube", "spotify"], mins: 600 },

  // Music
  { id: "weightless", title: "Weightless", by: "Marconi Union", kind: "music", also: ["ambient"], voice: "none", length: "short", about: "Made with sound therapists to slow the heart rate. Often called the most relaxing song.", query: "Marconi Union Weightless", on: ALL, mins: 8 },
  { id: "max-sleep", title: "Sleep", by: "Max Richter", kind: "ambient", also: ["piano", "music"], voice: "none", length: "long", about: "An eight-hour lullaby, written to be slept through.", query: "Max Richter Sleep", on: ALL, mins: 500 },
  { id: "from-sleep", title: "From Sleep", by: "Max Richter", kind: "piano", also: ["ambient", "music"], voice: "none", length: "medium", about: "The one-hour version of Sleep: slow piano, strings and voice.", query: "Max Richter From Sleep", on: ALL, mins: 60 },
  { id: "airports", title: "Ambient 1: Music for Airports", by: "Brian Eno", kind: "ambient", also: ["music"], voice: "none", length: "short", about: "The album that started ambient music. Soft loops that drift past.", query: "Brian Eno Music for Airports", on: ALL, mins: 48 },
  { id: "moby", title: "Long Ambients 1: Calm. Sleep.", by: "Moby", kind: "ambient", also: ["music"], voice: "none", length: "long", about: "Four hours of slow, beatless drones Moby made to help himself sleep.", query: "Moby Long Ambients 1 Calm Sleep", on: ALL, mins: 240 },
  { id: "stars-lid", title: "And Their Refinement of the Decline", by: "Stars of the Lid", kind: "ambient", voice: "none", length: "medium", about: "Long, glowing drones that barely move. A cult sleep album.", query: "Stars of the Lid And Their Refinement of the Decline", on: ALL, mins: 120 },
  { id: "liquid-mind", title: "Liquid Mind", by: "Chuck Wild", kind: "ambient", also: ["music"], voice: "none", length: "medium", about: "Slow synth washes made for relaxation and sleep.", query: "Liquid Mind Chuck Wild sleep", on: ALL, mins: 60 },
  { id: "gymnopedies", title: "Gymnopédies", by: "Erik Satie", kind: "piano", also: ["music"], voice: "none", length: "short", who: ["me", "kid"], about: "Three slow, gentle piano pieces from 1888.", query: "Erik Satie Gymnopedies", on: ALL, mins: 12 },
  { id: "clair", title: "Clair de Lune", by: "Claude Debussy", kind: "piano", also: ["music"], voice: "none", length: "short", who: ["me", "kid"], about: "Moonlight, in piano form.", query: "Debussy Clair de Lune 1 hour", on: ALL, mins: 60 },
  { id: "goldberg", title: "Goldberg Variations", by: "J.S. Bach", kind: "piano", also: ["music"], topics: ["history"], voice: "none", length: "medium", about: "The story goes they were written for a count who couldn't sleep.", query: "Bach Goldberg Variations", on: ALL, mins: 75 },
  { id: "felt", title: "Felt", by: "Nils Frahm", kind: "piano", also: ["ambient"], voice: "none", length: "short", about: "Piano recorded with felt on the hammers, late at night, so as not to wake the neighbors.", query: "Nils Frahm Felt", on: ALL, mins: 45 },
  { id: "einaudi", title: "Calm piano", by: "Ludovico Einaudi", kind: "piano", also: ["music"], voice: "none", length: "medium", about: "Simple, repeating piano themes that settle a busy head.", query: "Ludovico Einaudi relaxing piano", on: ALL, mins: 60 },
  { id: "arnalds", title: "Quiet piano and strings", by: "Ólafur Arnalds", kind: "piano", also: ["ambient"], voice: "none", length: "short", about: "Icelandic piano and strings, soft and spacious.", query: "Olafur Arnalds", on: ALL, mins: 45 },
  { id: "enya", title: "Watermark", by: "Enya", kind: "music", also: ["ambient"], voice: "soft", length: "short", about: "Layered, dreamy voices and synths. A classic fall-asleep album.", query: "Enya Watermark", on: ALL, mins: 40 },
  { id: "hammock", title: "Sleep-soft post-rock", by: "Hammock", kind: "ambient", also: ["music"], voice: "none", length: "medium", about: "Slow guitar swells and haze. Big and gentle at once.", query: "Hammock ambient", on: ALL, mins: 60 },
  { id: "lofi-sleep", title: "Sleepy lo-fi beats", by: "Lofi Girl", kind: "lofi", also: ["music"], voice: "none", length: "long", about: "The famous lo-fi channel's slower stream for sleeping.", query: "lofi girl sleep", on: ALL, mins: 180 },
  { id: "lofi-rain", title: "Lo-fi with rain", by: "Playlists", kind: "lofi", also: ["rain"], voice: "none", length: "medium", about: "Soft beats with rain mixed underneath.", query: "lofi rain sleep", on: ALL, mins: 120 },
  { id: "minecraft", title: "Minecraft – Volume Alpha", by: "C418", kind: "scores", also: ["piano", "ambient"], topics: ["games"], voice: "none", length: "short", who: ["me", "kid"], about: "The gentle, sparse piano from Minecraft. Nostalgia that puts you out.", query: "C418 Minecraft Volume Alpha", on: ALL, mins: 60 },
  { id: "zelda", title: "Relaxing Zelda music", by: "Game soundtrack", kind: "scores", topics: ["games", "fantasy"], voice: "none", length: "medium", who: ["me", "kid"], about: "Calm themes from the Zelda games, often with rain added.", query: "relaxing zelda music sleep", on: YT, mins: 120 },
  { id: "animal-crossing", title: "Animal Crossing night music", by: "Game soundtrack", kind: "scores", also: ["lofi"], topics: ["games", "cozy"], voice: "none", length: "medium", who: ["me", "kid"], about: "The late-night hourly themes, cozy and quiet.", query: "animal crossing night music sleep", on: YT, mins: 120 },
  { id: "stardew", title: "Stardew Valley soundtrack", by: "ConcernedApe", kind: "scores", topics: ["games", "cozy", "nature"], voice: "none", length: "medium", who: ["me", "kid"], about: "Farm-life seasons music, warm and unhurried.", query: "Stardew Valley soundtrack relaxing", on: ALL, mins: 90 },
  { id: "ghibli", title: "Studio Ghibli on piano", by: "Piano covers", kind: "scores", also: ["piano"], topics: ["fantasy"], voice: "none", length: "medium", who: ["me", "kid"], about: "Soft piano versions of the Ghibli movie themes.", query: "studio ghibli piano sleep", on: ALL, mins: 120 },
  { id: "space-ambient", title: "Deep space ambient", by: "Ambient mixes", kind: "ambient", topics: ["space"], voice: "none", length: "long", about: "Slow cosmic drones, often over pictures of nebulas and planets.", query: "deep space ambient music sleep", on: YT, mins: 180 },
  { id: "delta", title: "Delta-wave sleep music", by: "Sleep frequency mixes", kind: "ambient", also: ["noise"], voice: "none", length: "long", about: "Very slow pulses under soft pads. Some people swear by it; the science is mixed.", query: "delta waves sleep music", on: ["youtube", "spotify"], mins: 480 },

  // Faith
  { id: "hymns", title: "Peaceful hymns on piano", by: "Instrumental", kind: "faith", also: ["piano"], topics: ["bible"], voice: "none", length: "long", about: "Old hymns played slowly on piano, no singing.", query: "peaceful hymns piano sleep", on: ALL, mins: 180 },
  { id: "worship-soak", title: "Instrumental worship", by: "Soaking music", kind: "faith", also: ["ambient"], topics: ["bible"], voice: "none", length: "long", about: "Long, quiet worship pads for resting in God's presence.", query: "instrumental worship soaking music sleep", on: ALL, mins: 180 },
  { id: "psalms", title: "Psalms read for sleep", by: "Bible readings", kind: "faith", also: ["story"], topics: ["bible"], voice: "talk", length: "medium", about: "The Psalms read slowly and softly, often over gentle music.", query: "psalms for sleep bible reading", on: ["youtube", "spotify"], mins: 60 },
  { id: "abide", title: "Abide", by: "Bible sleep stories", kind: "faith", also: ["story", "meditation"], topics: ["bible"], voice: "talk", length: "short", about: "Bible stories and meditations made for falling asleep.", query: "Abide bible sleep", on: POD, mins: 30 },
  { id: "kids-bible", title: "Bedtime Bible stories for kids", by: "Bible stories", kind: "faith", also: ["story", "lullaby"], topics: ["bible"], voice: "talk", length: "short", who: ["kid"], about: "Short, gentle Bible stories told for little ones at bedtime.", query: "bedtime bible stories for kids", on: ["youtube", "spotify"], mins: 20 },

  // Stories & podcasts
  { id: "nothing-much", title: "Nothing Much Happens", by: "Kathryn Nicolai", kind: "story", also: ["podcast"], topics: ["cozy", "nature"], voice: "talk", length: "short", about: "Cozy little stories where, true to the name, nothing much happens. Told twice, slower the second time.", query: "Nothing Much Happens bedtime stories", on: POD, mins: 30 },
  { id: "sleep-with-me", title: "Sleep With Me", by: "Drew Ackerman", kind: "podcast", also: ["story"], topics: ["cozy", "fantasy"], voice: "talk", length: "medium", about: "Long, meandering, deliberately dull stories that bore you to sleep.", query: "Sleep With Me podcast", on: POD, mins: 60 },
  { id: "get-sleepy", title: "Get Sleepy", by: "Sleep stories & meditation", kind: "story", also: ["meditation", "podcast"], topics: ["travel", "nature", "cozy"], voice: "talk", length: "short", about: "A short relaxation, then a calm story about faraway places.", query: "Get Sleepy podcast", on: POD, mins: 40 },
  { id: "sleepy-otis", title: "Sleepy", by: "Otis Gray", kind: "podcast", also: ["story"], topics: ["books"], voice: "talk", length: "short", about: "Classic literature read in a low, sleepy voice.", query: "Sleepy podcast Otis Gray", on: POD, mins: 50 },
  { id: "snoozecast", title: "Snoozecast", by: "Bedtime stories", kind: "story", also: ["podcast"], topics: ["books", "mystery"], voice: "talk", length: "short", about: "Classic stories and gentle mysteries read softly.", query: "Snoozecast", on: POD, mins: 40 },
  { id: "boring-books", title: "Boring Books for Bedtime", by: "Podcast", kind: "podcast", topics: ["books", "history", "science"], voice: "talk", length: "medium", about: "Old manuals and dry nonfiction read in a calm voice. Dull on purpose.", query: "Boring Books for Bedtime", on: POD, mins: 60 },
  { id: "bore-you", title: "Bore You to Sleep", by: "Podcast", kind: "podcast", topics: ["books", "history"], voice: "talk", length: "medium", about: "Long readings from classic, slow-moving books.", query: "Bore You to Sleep podcast", on: POD, mins: 60 },
  { id: "boring-history", title: "Boring history for sleep", by: "YouTube channels", kind: "podcast", also: ["story"], topics: ["history"], voice: "talk", length: "long", about: "Hours of calm narration about daily life in the past.", query: "boring history for sleep", on: YT, mins: 180 },
  { id: "space-sleep", title: "Fall asleep to the universe", by: "Space documentaries", kind: "podcast", also: ["ambient"], topics: ["space", "science"], voice: "talk", length: "long", about: "Slow narration about stars, planets and how big it all is.", query: "fall asleep to space documentary calm narration", on: YT, mins: 180 },
  { id: "science-sleep", title: "Science explained for sleep", by: "Long narrations", kind: "podcast", topics: ["science"], voice: "talk", length: "long", about: "Gentle explainers on how the world works, paced for drifting off.", query: "science facts to fall asleep to", on: YT, mins: 180 },
  { id: "nature-doc", title: "Calm nature documentaries", by: "Wildlife narration", kind: "podcast", also: ["nature"], topics: ["nature"], voice: "talk", length: "medium", about: "Soothing wildlife narration over slow nature footage.", query: "relaxing nature documentary for sleep", on: YT, mins: 120 },
  { id: "bob-ross", title: "The Joy of Painting", by: "Bob Ross", kind: "asmr", also: ["story"], topics: ["art", "nature"], voice: "talk", length: "long", about: "That soft voice and those happy little trees. A famous accidental sleep aid.", query: "Bob Ross full episodes for sleep", on: YT, mins: 180 },
  { id: "slow-radio", title: "Slow Radio", by: "BBC", kind: "nature", also: ["podcast"], topics: ["nature", "travel"], voice: "soft", length: "short", about: "Unhurried sound journeys: dawn choruses, rivers, a monastery at night.", query: "BBC Slow Radio", on: POD, mins: 30 },
  { id: "slow-tv", title: "Slow TV train ride", by: "NRK (Norway)", kind: "cozy", topics: ["travel", "nature"], voice: "none", length: "long", about: "Norway's famous minute-by-minute train journey across the mountains.", query: "Bergensbanen minute by minute slow tv", on: YT, mins: 440 },
  { id: "japan-walk", title: "Rainy night walk in Japan", by: "Walking videos", kind: "cozy", also: ["rain"], topics: ["travel"], voice: "none", length: "medium", about: "Quiet city streets in the rain, with just footsteps and drops on an umbrella.", query: "japan night walk rain 4k ambience", on: YT, mins: 90 },
  { id: "myths-sleep", title: "Myths & legends for sleep", by: "Story narrations", kind: "story", topics: ["fantasy", "history"], voice: "talk", length: "long", about: "Greek, Norse and old folk tales told slowly.", query: "mythology stories for sleep", on: YT, mins: 180 },
  { id: "sleep-whispers", title: "Sleep Whispers", by: "Whispered stories", kind: "asmr", also: ["story", "podcast"], topics: ["books"], voice: "soft", length: "short", about: "Stories and readings whispered for sleep.", query: "Sleep Whispers podcast", on: POD, mins: 45 },

  // Kids
  { id: "sleep-tight", title: "Sleep Tight Stories", by: "Kids' bedtime podcast", kind: "story", also: ["lullaby"], topics: ["fantasy", "nature"], voice: "talk", length: "short", who: ["kid"], about: "Gentle bedtime stories for kids, new and classic.", query: "Sleep Tight Stories podcast", on: POD, mins: 20 },
  { id: "peace-out", title: "Peace Out", by: "Kids' relaxation podcast", kind: "meditation", also: ["story"], topics: ["nature"], voice: "talk", length: "short", who: ["kid"], about: "Short guided relaxation stories that teach kids to calm down.", query: "Peace Out podcast kids", on: POD, mins: 15 },
  { id: "stories-pod", title: "Stories Podcast", by: "Kids' stories", kind: "story", topics: ["fantasy"], voice: "talk", length: "short", who: ["kid"], about: "Fairy tales and original stories told with care.", query: "Stories Podcast kids bedtime", on: POD, mins: 25 },
  { id: "kids-meditation", title: "Bedtime meditation for kids", by: "Guided", kind: "meditation", topics: ["nature", "fantasy"], voice: "talk", length: "short", who: ["kid"], about: "Imaginative journeys (a cloud ride, a moon boat) that end in sleep.", query: "bedtime meditation for kids sleep", on: ["youtube", "spotify"], mins: 20 },
  { id: "rockabye", title: "Rockabye Baby!", by: "Lullaby covers", kind: "lullaby", also: ["music"], voice: "none", length: "short", who: ["baby", "kid"], about: "Rock and pop songs turned into music-box lullabies. Parents get something they recognize.", query: "Rockabye Baby lullaby renditions", on: ALL, mins: 40 },
  { id: "brahms", title: "Brahms' Lullaby, music box", by: "Lullaby", kind: "lullaby", also: ["piano"], voice: "none", length: "medium", who: ["baby", "kid"], about: "The classic lullaby looped softly on a music box.", query: "brahms lullaby music box 1 hour", on: ALL, mins: 60 },
  { id: "lullaby-songs", title: "Sung lullabies", by: "Gentle voices", kind: "lullaby", voice: "soft", length: "short", who: ["baby", "kid"], about: "Twinkle Twinkle, Hush Little Baby and friends, sung softly.", query: "lullabies for babies to go to sleep", on: ALL, mins: 30 },

  // Meditation & ASMR
  { id: "jason-stephenson", title: "Guided sleep meditation", by: "Jason Stephenson", kind: "meditation", voice: "talk", length: "medium", about: "One of the best-known sleep meditation voices on YouTube.", query: "Jason Stephenson guided sleep meditation", on: ["youtube", "spotify"], mins: 60 },
  { id: "honest-guys", title: "Sleep meditations", by: "The Honest Guys", kind: "meditation", also: ["story"], topics: ["nature", "fantasy"], voice: "talk", length: "short", about: "Guided journeys (a beach, a forest, a cabin) that let you drift off.", query: "The Honest Guys sleep meditation", on: ["youtube", "spotify"], mins: 45 },
  { id: "sealey", title: "Sleep hypnosis", by: "Michael Sealey", kind: "meditation", voice: "talk", length: "medium", about: "Slow, deep-voiced relaxation, popular for anxiety and insomnia.", query: "Michael Sealey sleep hypnosis", on: ["youtube", "spotify"], mins: 60 },
  { id: "yoga-nidra", title: "Yoga nidra for sleep", by: "Guided", kind: "meditation", voice: "talk", length: "short", about: "A lying-down body scan that walks attention through each part of the body.", query: "yoga nidra for sleep", on: ["youtube", "spotify"], mins: 30 },
  { id: "body-scan", title: "Body scan for sleep", by: "Guided", kind: "meditation", voice: "talk", length: "short", about: "Relax one part at a time, from toes to head.", query: "body scan meditation for sleep", on: ["youtube", "spotify"], mins: 25 },
  { id: "gibi", title: "Gibi ASMR", by: "ASMR creator", kind: "asmr", voice: "soft", length: "short", about: "One of the biggest ASMR channels: soft talking, tapping and role-plays.", query: "Gibi ASMR sleep", on: YT, mins: 40 },
  { id: "asmr-soft", title: "Soft-spoken ASMR", by: "ASMR", kind: "asmr", voice: "soft", length: "medium", about: "Gentle, quiet talking without whispering. Good for first-timers.", query: "soft spoken asmr for sleep", on: YT, mins: 60 },
  { id: "asmr-notalk", title: "ASMR, no talking", by: "ASMR", kind: "asmr", voice: "none", length: "medium", about: "Tapping, brushing and page turning with no voice at all.", query: "asmr no talking sleep tapping", on: YT, mins: 60 },
  { id: "asmr-books", title: "Page turning & book sounds", by: "ASMR", kind: "asmr", also: ["cozy"], topics: ["books"], voice: "none", length: "medium", about: "Pages turning, books sliding, a pen scratching in a quiet library.", query: "asmr page turning library sounds", on: YT, mins: 60 },
];

export const pickById = (id: string) => CATALOG.find((p) => p.id === id);

// ── Links ────────────────────────────────────────────────────────────────────

export type LinkPlace = "youtube" | "spotify" | "apple" | "podcasts";
export const LINK_LABELS: Record<LinkPlace, string> = { youtube: "YouTube", spotify: "Spotify", apple: "Apple Music", podcasts: "Apple Podcasts" };

/** A search link on one service. `dark` adds "black screen" to YouTube searches for long sounds. */
export function searchLink(place: LinkPlace, query: string, dark = false): string {
  const q = query.trim().replace(/\s+/g, " ").slice(0, FINDER_LIMITS.query);
  switch (place) {
    case "youtube": return `https://www.youtube.com/results?search_query=${encodeURIComponent(dark && !/black screen/i.test(q) ? `${q} black screen` : q)}`;
    case "spotify": return `https://open.spotify.com/search/${encodeURIComponent(q)}`;
    case "apple": return `https://music.apple.com/us/search?term=${encodeURIComponent(q)}`;
    case "podcasts": return `https://podcasts.apple.com/us/search?term=${encodeURIComponent(q)}`;
  }
}

/** The services a pick opens on, the person's own first when it has one. */
export function placesFor(on: LinkPlace[], place: Place): LinkPlace[] {
  const mine: LinkPlace[] = place === "youtube" ? ["youtube"] : place === "spotify" ? ["spotify"] : place === "apple" ? ["apple", "podcasts"] : [];
  return [...on.filter((p) => mine.includes(p)), ...on.filter((p) => !mine.includes(p))];
}

/** Long sounds and ambience are the ones worth a black screen on YouTube. */
export const wantsDark = (kind: Kind, prefs: SleepPrefs | null) => !!prefs?.dark && ["rain", "ocean", "noise", "nature", "cozy", "ambient", "lofi"].includes(kind);

/** The services a playlist item (or an AI pick) opens on, by what kind of thing it is. */
export const placesForKind = (kind: Kind): LinkPlace[] =>
  kind === "podcast" || kind === "story" ? ["spotify", "podcasts", "youtube"] : kind === "asmr" ? ["youtube"] : ["youtube", "spotify", "apple"];

/** The one link a playlist item plays: the person's own, or a search on their service. */
export function itemLink(item: SleepPick | PlaylistItem, prefs: SleepPrefs | null): string {
  if ("url" in item && item.url) return item.url;
  const on = "on" in item ? item.on : placesForKind(item.kind);
  const first = placesFor(on, prefs?.place ?? "any")[0] ?? "youtube";
  return searchLink(first, item.query, first === "youtube" && wantsDark(item.kind, prefs));
}

/** Only plain web links are kept from what people paste. */
export function cleanUrl(v: unknown): string {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (s.length > FINDER_LIMITS.url || /\s/.test(s)) return "";
  try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : ""; } catch { return ""; }
}

// ── Recommending ─────────────────────────────────────────────────────────────

/** How well a pick fits what they told us. Negative means it shouldn't be shown at all. */
export function scorePick(p: SleepPick, prefs: SleepPrefs, liked: string[] = [], hidden: string[] = []): number {
  if (hidden.includes(p.id)) return -1;
  const who = p.who ?? ["me"];
  if (!who.includes(prefs.who)) {
    // Grown-up picks are fine for kids only when they have no voices (music and sounds).
    if (!(prefs.who === "kid" && p.voice === "none" && p.kind !== "asmr")) return -1;
  }
  if (prefs.who !== "me" && (p.kind === "asmr" || p.id === "sealey")) return -1;
  if (prefs.voice === "none" && p.voice !== "none") return -1;
  const kinds = [p.kind, ...(p.also ?? [])];
  let s = 0;
  if (prefs.kinds.includes(p.kind)) s += 6;
  s += (p.also ?? []).filter((k) => prefs.kinds.includes(k)).length * 2.5;
  s += (p.topics ?? []).filter((t) => prefs.topics.includes(t)).length * 2;
  if (!prefs.kinds.length) s += 1;
  if (prefs.voice === "talk" && p.voice === "talk") s += 2.5;
  if (prefs.voice === "soft" && p.voice === "talk") s -= 1;
  if (prefs.length !== "any") s += prefs.length === p.length ? 1.5 : -0.5;
  if (prefs.place !== "any") {
    const has = prefs.place === "apple" ? p.on.includes("apple") || p.on.includes("podcasts") : p.on.includes(prefs.place);
    s += has ? 1 : -3;
  }
  if (prefs.who !== "me" && who.includes(prefs.who)) s += 2;
  if (prefs.topics.includes("bible") && p.kind === "faith") s += 2;
  if (!prefs.topics.includes("bible") && !prefs.kinds.includes("faith") && kinds.includes("faith")) s -= 4;
  if (liked.includes(p.id)) s += 4;
  return s;
}

/** The best picks for them, most fitting first, no more than three of one kind in the top spots so
 *  the list doesn't turn into ten kinds of rain. */
export function recommend(prefs: SleepPrefs, liked: string[] = [], hidden: string[] = [], max = 12): SleepPick[] {
  const ranked = CATALOG.map((p, i) => ({ p, s: scorePick(p, prefs, liked, hidden), i }))
    .filter((r) => r.s >= 0 && (r.s > 0 || !prefs.kinds.length))
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const out: SleepPick[] = [], perKind = new Map<Kind, number>();
  for (const { p } of ranked) {
    const n = perKind.get(p.kind) ?? 0;
    if (n >= 3) continue;
    perKind.set(p.kind, n + 1);
    out.push(p);
    if (out.length >= max) break;
  }
  // Short of picks (very narrow answers): fill from the rest, in order.
  for (const { p } of ranked) { if (out.length >= max) break; if (!out.includes(p)) out.push(p); }
  return out;
}

/** Picks matching words someone typed ("rain", "trains", "piano", "history"). */
export function searchCatalog(text: string, prefs: SleepPrefs | null, hidden: string[] = []): SleepPick[] {
  const words = text.toLowerCase().split(/[^a-z0-9']+/).filter((w) => w.length > 1 && !STOP.has(w)).map(stem);
  if (!words.length) return [];
  const scored = CATALOG.filter((p) => !hidden.includes(p.id)).map((p) => {
    const hay = [p.title, p.by, p.about, p.query, KIND_LABELS[p.kind].label, ...(p.also ?? []).map((k) => KIND_LABELS[k].label), ...(p.topics ?? []).map((t) => TOPIC_LABELS[t])].join(" ").toLowerCase();
    const title = `${p.title} ${p.by}`.toLowerCase();
    // Words match at the start of a word ("train" finds "trains", "at" doesn't find "that"); a hit in
    // the title or creator counts double.
    const s = words.reduce((n, w) => { const re = new RegExp(`\\b${w.replace(/[^a-z0-9']/g, "")}`); return n + (re.test(title) ? 2 : re.test(hay) ? 1 : 0); }, 0);
    const fits = prefs ? scorePick(p, prefs) : 0;
    return { p, s: s ? s * 10 + Math.max(0, fits) : 0 };
  }).filter((r) => r.s > 0);
  return scored.sort((a, b) => b.s - a.s).slice(0, 10).map((r) => r.p);
}
const STOP = new Set(["to", "the", "and", "or", "for", "of", "a", "an", "with", "something", "some", "sleep", "sleeping", "fall", "asleep", "me", "my", "i", "want", "like", "that", "is", "it", "in", "on", "no", "at", "by", "from", "so", "be", "just", "very", "really", "music", "sounds", "sound", "please", "help", "find", "good", "nice", "kind", "night", "nights", "tonight", "bed", "bedtime"]);
const stem = (w: string) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w);

/** Tonight's playlist from their answers: something to wind down with, something to fall asleep
 *  to, and something that plays all night. */
export function tonightsMix(prefs: SleepPrefs, liked: string[] = [], hidden: string[] = []): SleepPick[] {
  const recs = recommend(prefs, liked, hidden, 30);
  const windDown = recs.find((p) => p.length === "short" && (p.voice !== "none" || p.kind === "piano" || p.kind === "music"));
  const fallAsleep = recs.find((p) => p !== windDown && p.length !== "long" && p.kind !== "story" && p.kind !== "podcast");
  const allNight = recs.find((p) => p !== windDown && p !== fallAsleep && p.length === "long" && p.voice === "none")
    ?? CATALOG.find((p) => p.id === (prefs.who === "baby" ? "womb" : "brown") && !hidden.includes(p.id));
  return [windDown, fallAsleep, allNight].filter((p, i, a): p is SleepPick => !!p && a.indexOf(p) === i);
}

export const toItem = (p: SleepPick, id: string): PlaylistItem => ({ id, ref: p.id, title: p.title, by: p.by, kind: p.kind, query: p.query, url: "", mins: p.mins });

export const playlistMinutes = (pl: SleepPlaylist) => pl.items.reduce((s, i) => s + (i.mins || 0), 0);
export function minutesWords(m: number): string {
  if (!m) return "";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
}

/** A playlist as plain text, to paste into a message or a note. */
export function playlistText(pl: SleepPlaylist, prefs: SleepPrefs | null): string {
  return [`${pl.emoji} ${pl.name}`, ...pl.items.map((i, n) => `${n + 1}. ${i.title}${i.by ? ` (${i.by})` : ""}\n   ${itemLink(i, prefs)}`)].join("\n");
}

// ── Asking the AI ────────────────────────────────────────────────────────────

export type AiPick = { title: string; by: string; kind: Kind; query: string; why: string };

export const ASK_PROMPT = `You help people find something real to fall asleep to: sleep sounds, ambient or calm music, albums, sleep stories, podcasts, guided meditations, ASMR, lullabies, hymns, slow TV.
Recommend only things you are confident really exist (real artists, albums, songs, podcasts, channels) or well-known genres of videos that are easy to find (like "rain on a tent 10 hours").
Never write web addresses. For each pick give a short search phrase that will find it on YouTube, Spotify or Apple.
Keep it safe for sleep: nothing scary, loud or upsetting. If the listener is a child or baby, only child-appropriate picks.
Answer with JSON only: {"picks":[{"title":"","by":"","kind":"","query":"","why":""}]}
- 5 to 8 picks, best first, varied.
- kind is one of: ${KINDS.join(", ")}.
- by is the artist, show or creator ("" if it's a genre of video).
- query is under 80 characters.
- why is one friendly sentence (under 25 words) on why it fits what they asked.`;

export function askUserMessage(text: string, prefs: SleepPrefs | null): string {
  const lines = [`What they want tonight: ${text}`];
  if (prefs) {
    if (prefs.kinds.length) lines.push(`They usually like: ${prefs.kinds.map((k) => KIND_LABELS[k].label).join(", ")}.`);
    if (prefs.topics.length) lines.push(`Interests: ${prefs.topics.map((t) => TOPIC_LABELS[t]).join(", ")}.`);
    lines.push(`Voices: ${VOICE_LABELS[prefs.voice]}.`, `Listens on: ${PLACE_LABELS[prefs.place]}.`, `Length: ${LENGTH_LABELS[prefs.length]}.`, `Listener: ${WHO_LABELS[prefs.who]}.`);
  }
  return lines.join("\n");
}

/** Reads the AI's answer. Anything not in the right shape is dropped; nothing it says becomes a link
 *  except through searchLink. */
export function picksFromAi(raw: string): AiPick[] {
  let data: any;
  try { data = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")); } catch { return []; }
  const list = Array.isArray(data?.picks) ? data.picks : [];
  const out: AiPick[] = [];
  for (const r of list.slice(0, 10)) {
    const title = str(r?.title, FINDER_LIMITS.title).trim();
    const query = str(r?.query, FINDER_LIMITS.query).trim().replace(/https?:\/\/\S+/gi, "").trim();
    if (!title || !query) continue;
    out.push({ title, by: str(r?.by, FINDER_LIMITS.by).trim(), kind: oneOf(r?.kind, KINDS, "music"), query, why: str(r?.why, 240).trim() });
  }
  return out;
}

export function cleanAskRequest(body: unknown): { text: string; prefs: SleepPrefs | null } {
  const b = obj(body) || {};
  return { text: str(b.text, 300).trim(), prefs: b.prefs ? cleanPrefs(b.prefs) : null };
}

// ── Sanitizing saved data ────────────────────────────────────────────────────

const obj = (v: unknown): Record<string, any> | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, any>) : null);
const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\u0000/g, "").slice(0, max) : "");
const oneOf = <T extends string>(v: unknown, list: readonly T[], fallback: T): T => (list.includes(v as T) ? (v as T) : fallback);
const listOf = <T extends string>(v: unknown, list: readonly T[]): T[] => (Array.isArray(v) ? Array.from(new Set(v.filter((x): x is T => list.includes(x as T)))) : []);
const cleanId = (v: unknown) => (typeof v === "string" ? v.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40) : "");
const ids = (v: unknown, max: number) => (Array.isArray(v) ? Array.from(new Set(v.map(cleanId).filter(Boolean))).slice(0, max) : []);

export function cleanPrefs(v: unknown): SleepPrefs | null {
  const r = obj(v);
  if (!r) return null;
  return {
    kinds: listOf(r.kinds, KINDS), topics: listOf(r.topics, TOPICS),
    voice: oneOf(r.voice, VOICES, "soft"), place: oneOf(r.place, PLACES, "any"), length: oneOf(r.length, LENGTHS, "any"), who: oneOf(r.who, WHOS, "me"),
    dark: typeof r.dark === "boolean" ? r.dark : true,
  };
}

function cleanItem(v: unknown): PlaylistItem | null {
  const r = obj(v);
  if (!r) return null;
  const id = cleanId(r.id), title = str(r.title, FINDER_LIMITS.title).trim(), url = cleanUrl(r.url), query = str(r.query, FINDER_LIMITS.query).trim();
  if (!id || !title || (!url && !query)) return null;
  const mins = Math.round(Number(r.mins));
  return { id, ref: cleanId(r.ref), title, by: str(r.by, FINDER_LIMITS.by).trim(), kind: oneOf(r.kind, KINDS, "music"), query, url, mins: Number.isFinite(mins) ? Math.min(Math.max(mins, 0), 1440) : 0 };
}

export function cleanSleepFinder(v: unknown): SleepFinder {
  const r = obj(v);
  if (!r) return emptySleepFinder();
  const playlists: SleepPlaylist[] = [];
  for (const p of Array.isArray(r.playlists) ? r.playlists : []) {
    const q = obj(p), id = cleanId(q?.id), name = str(q?.name, FINDER_LIMITS.name).trim();
    if (!q || !id || !name || playlists.some((x) => x.id === id)) continue;
    const items: PlaylistItem[] = [];
    for (const it of Array.isArray(q.items) ? q.items : []) { const c = cleanItem(it); if (c && !items.some((x) => x.id === c.id)) items.push(c); if (items.length >= FINDER_LIMITS.items) break; }
    playlists.push({ id, name, emoji: str(q.emoji, 8) || "🌙", items, createdAt: str(q.createdAt, 40) });
    if (playlists.length >= FINDER_LIMITS.playlists) break;
  }
  const searches = Array.isArray(r.searches) ? Array.from(new Set(r.searches.filter((s: unknown): s is string => typeof s === "string").map((s: string) => s.trim().slice(0, 100)).filter(Boolean))).slice(0, FINDER_LIMITS.searches) as string[] : [];
  return { prefs: cleanPrefs(r.prefs), playlists, liked: ids(r.liked, FINDER_LIMITS.liked), hidden: ids(r.hidden, FINDER_LIMITS.hidden), searches };
}
