// Arise LifeHub · Sleep: the catalog. Every tool the Sleep app offers (sounds, breathing, mind
// games, stories, scripture, prayer, journaling, videos), why each one helps and the research
// behind it, and the "What's keeping you up?" choices that point to the best few for the moment.
// The words that get read aloud live in sleepScripts.ts.

import { PASSAGES, SCRIPTS, displayRef, scriptMinutes, spokenCaps, type SleepScript } from "./sleepScripts";
import { JOURNAL_KINDS, SOUND_IDS, TIMER_CHOICES, type JournalKind, type SoundId } from "./sleepApp";

export { JOURNAL_KINDS, SOUND_IDS, type JournalKind, type SoundId };

/** The sleep timer choices, as button labels. 0 is off. */
export const TIMER_CHOICES_LABELS: readonly { id: number; label: string }[] = TIMER_CHOICES.map((m) => ({ id: m, label: m ? `${m} min` : "Off" }));

export type SleepTab = "tonight" | "sounds" | "breathe" | "mind" | "body" | "stories" | "pray" | "journal" | "watch" | "plan" | "learn" | "log";

export const SLEEP_TABS: readonly { id: SleepTab; label: string; faith?: boolean }[] = [
  { id: "tonight", label: "Tonight" },
  { id: "sounds", label: "Sounds" },
  { id: "breathe", label: "Breathe" },
  { id: "mind", label: "Quiet mind" },
  { id: "body", label: "Relax body" },
  { id: "stories", label: "Stories" },
  { id: "pray", label: "Pray", faith: true },
  { id: "journal", label: "Journal" },
  { id: "watch", label: "Watch" },
  { id: "plan", label: "Plan" },
  { id: "learn", label: "Learn" },
  { id: "log", label: "Sleep log" },
];

// ── Sounds ───────────────────────────────────────────────────────────────────

export const SOUNDS: readonly { id: SoundId; name: string; blurb: string; group: "Noise" | "Nature" | "Indoors" }[] = [
  { id: "brown", name: "Brown noise", blurb: "Deep and rumbly, like a far-off waterfall. A favorite for ADHD brains.", group: "Noise" },
  { id: "pink", name: "Pink noise", blurb: "Softer than white noise, like steady rain on leaves.", group: "Noise" },
  { id: "white", name: "White noise", blurb: "Bright and even. Best at covering sharp sounds like voices or traffic.", group: "Noise" },
  { id: "rain", name: "Rain", blurb: "Steady rain with soft drops.", group: "Nature" },
  { id: "thunder", name: "Distant thunder", blurb: "A low rumble now and then, far away. Mix it with rain.", group: "Nature" },
  { id: "ocean", name: "Ocean waves", blurb: "Slow waves rolling in and pulling back.", group: "Nature" },
  { id: "stream", name: "Stream", blurb: "Water running and bubbling over stones.", group: "Nature" },
  { id: "wind", name: "Wind", blurb: "A soft wind that rises and falls.", group: "Nature" },
  { id: "crickets", name: "Summer night", blurb: "Crickets chirping far off in the dark.", group: "Nature" },
  { id: "fire", name: "Fireplace", blurb: "A low fire with gentle crackles.", group: "Indoors" },
  { id: "fan", name: "Fan", blurb: "The steady hum of a box fan.", group: "Indoors" },
  { id: "heartbeat", name: "Slow heartbeat", blurb: "A calm heartbeat at 60 beats a minute.", group: "Indoors" },
  { id: "drone", name: "Soft hum", blurb: "A warm, low chord that slowly breathes.", group: "Indoors" },
];

export type SoundMix = Partial<Record<SoundId, number>>;

export const SOUND_PRESETS: readonly { id: string; name: string; mix: SoundMix }[] = [
  { id: "adhd", name: "Quiet ADHD brain", mix: { brown: 0.75 } },
  { id: "rainy", name: "Rainy night", mix: { rain: 0.65, brown: 0.3 } },
  { id: "storm", name: "Gentle storm", mix: { rain: 0.6, thunder: 0.45, brown: 0.2 } },
  { id: "ocean", name: "By the ocean", mix: { ocean: 0.75, wind: 0.15 } },
  { id: "cabin", name: "Cozy cabin", mix: { fire: 0.6, rain: 0.35, wind: 0.12 } },
  { id: "fan", name: "Fan on", mix: { fan: 0.75 } },
  { id: "summer", name: "Summer night", mix: { crickets: 0.4, stream: 0.3, wind: 0.12 } },
  { id: "womb", name: "Heartbeat and hum", mix: { heartbeat: 0.45, drone: 0.3, brown: 0.25 } },
];

// ── Breathing ────────────────────────────────────────────────────────────────

/** One part of a breath: in, a second short sip in on top ("in2"), hold, or out. */
export type BreathStep = { kind: "in" | "in2" | "hold" | "out"; secs: number };
export type BreathPattern = {
  id: string;
  name: string;
  blurb: string;
  why: string;
  source?: string;
  steps: BreathStep[];
  faith?: boolean;
  /** A breath prayer: words for the breath in and the breath out. */
  prayer?: { in: string; out: string; ref: string };
};

const slowPrayer = (inSecs = 4, outSecs = 6): BreathStep[] => [{ kind: "in", secs: inSecs }, { kind: "out", secs: outSecs }];

export const BREATHS: readonly BreathPattern[] = [
  { id: "sigh", name: "Calming sigh", blurb: "Breathe in through your nose, take a second short sip of air on top, then let it all go in a long, slow breath out.",
    why: "In a month-long study, five minutes a day of this “cyclic sighing” lifted mood and slowed breathing more than mindfulness meditation did.", source: "Balban et al., Cell Reports Medicine, 2023",
    steps: [{ kind: "in", secs: 2.5 }, { kind: "in2", secs: 1 }, { kind: "out", secs: 6 }] },
  { id: "478", name: "4-7-8 breathing", blurb: "In for 4, hold for 7, out for 8. The long breath out does the calming.",
    why: "Breathing out for longer than you breathe in slows your heart and nudges your body toward rest. The exact counts come from Dr. Andrew Weil; the slow-breathing effect is well studied.", source: "Laborde et al., Neuroscience & Biobehavioral Reviews, 2022",
    steps: [{ kind: "in", secs: 4 }, { kind: "hold", secs: 7 }, { kind: "out", secs: 8 }] },
  { id: "slow", name: "Six breaths a minute", blurb: "In for 4, out for 6. Easy and even, no holding.",
    why: "Breathing about six times a minute raises heart rate variability, a sign your nervous system is shifting into rest mode.", source: "Laborde et al., Neuroscience & Biobehavioral Reviews, 2022",
    steps: [{ kind: "in", secs: 4 }, { kind: "out", secs: 6 }] },
  { id: "long-out", name: "Long breath out", blurb: "In for 4, out for 8. Good when holding your breath feels uncomfortable.",
    why: "A breath out twice as long as the breath in is one of the simplest ways to slow your heart rate.", source: "Laborde et al., 2022",
    steps: [{ kind: "in", secs: 4 }, { kind: "out", secs: 8 }] },
  { id: "box", name: "Box breathing", blurb: "In 4, hold 4, out 4, hold 4. Steady counts for a busy mind to follow.",
    why: "Even counts give racing thoughts something simple to hold onto, and the holds slow your breathing down.",
    steps: [{ kind: "in", secs: 4 }, { kind: "hold", secs: 4 }, { kind: "out", secs: 4 }, { kind: "hold", secs: 4 }] },
  { id: "be-still", name: "Be still", faith: true, blurb: "A breath prayer from Psalm 46.", why: "Breath prayer pairs slow breathing with a few words of Scripture, an old Christian practice that gives a wandering mind one thing to hold.",
    prayer: { in: "Be still", out: "and know that I am God", ref: "Psalm 46:10" }, steps: slowPrayer() },
  { id: "lie-down", name: "Lie down in peace", faith: true, blurb: "A breath prayer from Psalm 4.", why: "Breath prayer pairs slow breathing with a few words of Scripture.",
    prayer: { in: "I will lay me down in peace", out: "and sleep", ref: "Psalm 4:8" }, steps: slowPrayer(5, 6) },
  { id: "shepherd", name: "My shepherd", faith: true, blurb: "A breath prayer from Psalm 23.", why: "Breath prayer pairs slow breathing with a few words of Scripture.",
    prayer: { in: "The Lord is my shepherd", out: "I shall not want", ref: "Psalm 23:1" }, steps: slowPrayer(5, 6) },
  { id: "come-rest", name: "Come and rest", faith: true, blurb: "A breath prayer from Matthew 11.", why: "Breath prayer pairs slow breathing with a few words of Scripture.",
    prayer: { in: "Come unto me", out: "and I will give you rest", ref: "Matthew 11:28" }, steps: slowPrayer() },
  { id: "jesus-prayer", name: "The Jesus Prayer", faith: true, blurb: "Prayed by Christians for over a thousand years.", why: "One short prayer, repeated with the breath, quiets the mind without needing to think of words.",
    prayer: { in: "Lord Jesus Christ, Son of God", out: "have mercy on me", ref: "The Jesus Prayer" }, steps: slowPrayer(5, 7) },
  { id: "afraid-trust", name: "When I'm afraid", faith: true, blurb: "A breath prayer from Psalm 56.", why: "Breath prayer pairs slow breathing with a few words of Scripture.",
    prayer: { in: "What time I am afraid", out: "I will trust in thee", ref: "Psalm 56:3" }, steps: slowPrayer(5, 6) },
  { id: "abba", name: "Abba, Father", faith: true, blurb: "A breath prayer from Romans 8.", why: "Breath prayer pairs slow breathing with a few words of Scripture.",
    prayer: { in: "Abba, Father", out: "I belong to you", ref: "Romans 8:15" }, steps: slowPrayer() },
];

export const breathById = (id: string) => BREATHS.find((b) => b.id === id);
export const breathCycleSecs = (b: Pick<BreathPattern, "steps">) => b.steps.reduce((t, s) => t + s.secs, 0);

// ── Quiet mind: cognitive shuffle ────────────────────────────────────────────
// Concrete, neutral, easy-to-picture words with nothing to worry about in them. Shuffled, they
// can't be strung into a story, which is the point.

export const SHUFFLE_WORDS: Readonly<Record<string, readonly string[]>> = {
  a: ["apple", "anchor", "acorn", "apron", "armchair", "avocado", "almond", "aquarium", "artichoke", "anthill", "antelope", "accordion", "arch", "attic window"],
  b: ["banana", "balloon", "bicycle", "blanket", "button", "butterfly", "bread", "bucket", "bench", "basket", "broom", "bubble", "bookshelf", "bagel", "bamboo", "beach ball", "birdhouse", "blueberry", "bathtub", "biscuit"],
  c: ["candle", "cactus", "carrot", "cloud", "cupcake", "canoe", "castle", "cherry", "chair", "compass", "cookie", "crayon", "cabin", "coconut", "cardigan", "clover", "corn", "cushion", "curtain", "comb"],
  d: ["daisy", "doughnut", "dolphin", "drum", "dandelion", "desk", "doorknob", "duck", "dice", "dragonfly", "daffodil", "dumpling", "dock", "dish", "dune"],
  e: ["egg", "envelope", "elephant", "easel", "eraser", "eggplant", "earmuffs", "evergreen", "emerald", "eclair", "elm tree"],
  f: ["feather", "fern", "flashlight", "flamingo", "fork", "fence", "fig", "fountain", "frog", "fireplace", "flowerpot", "flute", "fleece", "field", "ferry", "fudge"],
  g: ["guitar", "grape", "garden", "glove", "goldfish", "gate", "grapefruit", "globe", "gingerbread", "gravel", "greenhouse", "giraffe", "garlic", "gazebo", "gumball"],
  h: ["hat", "honey", "hammock", "harbor", "hedgehog", "hill", "horse", "hot air balloon", "hoodie", "haystack", "harmonica", "hummingbird", "honeydew", "hazelnut"],
  i: ["igloo", "island", "ice cube", "ivy", "ink bottle", "iris", "icicle", "inchworm", "ice cream"],
  j: ["jar", "jellybean", "jacket", "jigsaw puzzle", "jasmine", "jam", "jellyfish", "jug", "journal", "juniper"],
  k: ["kite", "kettle", "kiwi", "kayak", "key", "koala", "kitten", "kale", "keyboard", "kernel of corn"],
  l: ["lemon", "lantern", "ladder", "leaf", "lighthouse", "llama", "lettuce", "lamp", "lily", "lollipop", "log", "lake", "lunchbox", "lavender"],
  m: ["mitten", "mango", "mushroom", "moon", "marble", "meadow", "mailbox", "map", "maple leaf", "muffin", "mug", "mountain", "magnet", "marshmallow"],
  n: ["nest", "notebook", "noodle", "napkin", "necklace", "nutmeg", "nectarine", "net", "nightlight", "nickel"],
  o: ["orange", "owl", "oak tree", "oatmeal", "ocean", "olive", "onion", "oar", "origami", "otter", "oven mitt", "ottoman"],
  p: ["pillow", "pineapple", "pencil", "pumpkin", "puzzle", "parrot", "pebble", "peach", "pancake", "paintbrush", "penguin", "pie", "pinecone", "plum", "puddle", "porch", "picnic basket"],
  q: ["quilt", "quarter", "quail", "quiche", "quill"],
  r: ["rainbow", "rabbit", "raft", "radish", "ribbon", "robin", "rocking chair", "rose", "rowboat", "rug", "raisin", "raindrop", "ruler", "raspberry"],
  s: ["sailboat", "sandal", "scarf", "seashell", "snowflake", "sock", "spoon", "strawberry", "sunflower", "swing", "sweater", "star", "sandcastle", "saucer", "sponge", "squirrel", "stool", "slipper"],
  t: ["teapot", "tulip", "towel", "turtle", "tent", "toast", "tomato", "tractor", "treehouse", "trumpet", "teddy bear", "thimble", "tangerine", "toothbrush", "trail"],
  u: ["umbrella", "ukulele", "unicorn", "utensils", "uniform"],
  v: ["violin", "vase", "valley", "vest", "vanilla", "van", "velvet", "vine", "violet", "village"],
  w: ["watermelon", "wagon", "window", "waffle", "walnut", "wheelbarrow", "whistle", "windmill", "wool", "wreath", "wave", "waterfall", "wildflower", "willow"],
  x: ["xylophone"],
  y: ["yarn", "yo-yo", "yacht", "yogurt", "yellow raincoat", "yard"],
  z: ["zebra", "zucchini", "zipper", "zinnia"],
};

/** Words whose letters guide the shuffle, one letter at a time. */
export const SHUFFLE_SEEDS = ["blanket", "pillow", "candle", "garden", "meadow", "harbor", "lantern", "willow", "pebble", "maple", "orchard", "biscuit", "cottage", "slipper", "teapot", "village"] as const;

/** A cognitive shuffle: for each letter of a seed word, a few unconnected words starting with it.
 *  `rand` is injectable so tests can check the shape without randomness. */
export function shuffleRound(seed: string, perLetter = 5, rand: () => number = Math.random): { letter: string; words: string[] }[] {
  const seen = new Set<string>();
  const out: { letter: string; words: string[] }[] = [];
  for (const ch of seed.toLowerCase()) {
    if (seen.has(ch) || !SHUFFLE_WORDS[ch]) continue;
    seen.add(ch);
    const pool = [...SHUFFLE_WORDS[ch]];
    const words: string[] = [];
    while (words.length < Math.min(perLetter, pool.length)) words.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    out.push({ letter: ch, words });
  }
  return out;
}

// ── Quiet mind: counting and alphabet games ──────────────────────────────────

export const ALPHABET_CATEGORIES: readonly { id: string; name: string; faith?: boolean }[] = [
  { id: "animals", name: "Animals" },
  { id: "foods", name: "Foods" },
  { id: "fruit-veg", name: "Fruits and vegetables" },
  { id: "places", name: "Places and cities" },
  { id: "names", name: "First names" },
  { id: "house", name: "Things in a house" },
  { id: "soft", name: "Soft things" },
  { id: "outdoors", name: "Things outdoors" },
  { id: "desserts", name: "Desserts" },
  { id: "beach", name: "Things at the beach" },
  { id: "bible-people", name: "People in the Bible", faith: true },
  { id: "thanks", name: "Things to thank God for", faith: true },
];

/** Letters to play: the whole alphabet except the ones nearly nobody can use (Q, X, Z). */
export const ALPHABET = "abcdefghijklmnoprstuvwy".split("");

/** The names and titles of God, A to Z, each with where it comes from (King James Version). */
export const NAMES_OF_GOD: readonly { letter: string; name: string; verse: string; ref: string }[] = [
  { letter: "A", name: "Almighty", verse: "I am the Almighty God.", ref: "Genesis 17:1" },
  { letter: "B", name: "Bread of life", verse: "I am the bread of life.", ref: "John 6:35" },
  { letter: "C", name: "Comforter", verse: "But the Comforter, which is the Holy Ghost, whom the Father will send in my name, he shall teach you all things.", ref: "John 14:26" },
  { letter: "D", name: "Deliverer", verse: "The LORD is my rock, and my fortress, and my deliverer.", ref: "Psalm 18:2" },
  { letter: "E", name: "Everlasting Father", verse: "And his name shall be called Wonderful, Counsellor, The mighty God, The everlasting Father, The Prince of Peace.", ref: "Isaiah 9:6" },
  { letter: "F", name: "Faithful", verse: "God is faithful.", ref: "1 Corinthians 1:9" },
  { letter: "G", name: "Good Shepherd", verse: "I am the good shepherd: the good shepherd giveth his life for the sheep.", ref: "John 10:11" },
  { letter: "H", name: "Healer", verse: "For I am the LORD that healeth thee.", ref: "Exodus 15:26" },
  { letter: "I", name: "I AM", verse: "And God said unto Moses, I AM THAT I AM.", ref: "Exodus 3:14" },
  { letter: "J", name: "Jesus", verse: "Thou shalt call his name JESUS: for he shall save his people from their sins.", ref: "Matthew 1:21" },
  { letter: "K", name: "King of kings", verse: "KING OF KINGS, AND LORD OF LORDS.", ref: "Revelation 19:16" },
  { letter: "L", name: "Light of the world", verse: "I am the light of the world: he that followeth me shall not walk in darkness.", ref: "John 8:12" },
  { letter: "M", name: "Mighty God", verse: "The mighty God, The everlasting Father, The Prince of Peace.", ref: "Isaiah 9:6" },
  { letter: "N", name: "Nigh", verse: "The LORD is nigh unto all them that call upon him.", ref: "Psalm 145:18" },
  { letter: "O", name: "Our Father", verse: "Our Father which art in heaven, Hallowed be thy name.", ref: "Matthew 6:9" },
  { letter: "P", name: "Prince of Peace", verse: "And his name shall be called... The Prince of Peace.", ref: "Isaiah 9:6" },
  { letter: "Q", name: "Quiet strength", verse: "In quietness and in confidence shall be your strength.", ref: "Isaiah 30:15" },
  { letter: "R", name: "Redeemer", verse: "For I know that my redeemer liveth.", ref: "Job 19:25" },
  { letter: "S", name: "Strong tower", verse: "The name of the LORD is a strong tower: the righteous runneth into it, and is safe.", ref: "Proverbs 18:10" },
  { letter: "T", name: "True vine", verse: "I am the true vine, and my Father is the husbandman.", ref: "John 15:1" },
  { letter: "U", name: "Unchanging", verse: "For I am the LORD, I change not.", ref: "Malachi 3:6" },
  { letter: "V", name: "Very present help", verse: "God is our refuge and strength, a very present help in trouble.", ref: "Psalm 46:1" },
  { letter: "W", name: "Wonderful Counsellor", verse: "And his name shall be called Wonderful, Counsellor.", ref: "Isaiah 9:6" },
  { letter: "X", name: "Exalted", verse: "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth.", ref: "Psalm 46:10" },
  { letter: "Y", name: "Yesterday, today, and for ever the same", verse: "Jesus Christ the same yesterday, and to day, and for ever.", ref: "Hebrews 13:8" },
  { letter: "Z", name: "Zealous for you", verse: "The zeal of the LORD of hosts will perform this.", ref: "Isaiah 9:7" },
];

/** Short verses to hold onto at night (King James Version). An ellipsis marks part of a verse. */
export const VERSES: readonly { text: string; ref: string; for: "sleep" | "worry" | "fear" | "thoughts" | "rest" }[] = [
  { text: "I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.", ref: "Psalm 4:8", for: "sleep" },
  { text: "I laid me down and slept; I awaked; for the LORD sustained me.", ref: "Psalm 3:5", for: "sleep" },
  { text: "When thou liest down, thou shalt not be afraid: yea, thou shalt lie down, and thy sleep shall be sweet.", ref: "Proverbs 3:24", for: "sleep" },
  { text: "…for so he giveth his beloved sleep.", ref: "Psalm 127:2", for: "sleep" },
  { text: "Behold, he that keepeth Israel shall neither slumber nor sleep.", ref: "Psalm 121:4", for: "sleep" },
  { text: "Return unto thy rest, O my soul; for the LORD hath dealt bountifully with thee.", ref: "Psalm 116:7", for: "rest" },
  { text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest.", ref: "Matthew 11:28", for: "rest" },
  { text: "And he said, My presence shall go with thee, and I will give thee rest.", ref: "Exodus 33:14", for: "rest" },
  { text: "There remaineth therefore a rest to the people of God.", ref: "Hebrews 4:9", for: "rest" },
  { text: "Rest in the LORD, and wait patiently for him…", ref: "Psalm 37:7", for: "rest" },
  { text: "In the multitude of my thoughts within me thy comforts delight my soul.", ref: "Psalm 94:19", for: "thoughts" },
  { text: "Casting down imaginations, and every high thing that exalteth itself against the knowledge of God, and bringing into captivity every thought to the obedience of Christ.", ref: "2 Corinthians 10:5", for: "thoughts" },
  { text: "Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee.", ref: "Isaiah 26:3", for: "thoughts" },
  { text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind.", ref: "2 Timothy 1:7", for: "thoughts" },
  { text: "In returning and rest shall ye be saved; in quietness and in confidence shall be your strength…", ref: "Isaiah 30:15", for: "thoughts" },
  { text: "Casting all your care upon him; for he careth for you.", ref: "1 Peter 5:7", for: "worry" },
  { text: "Cast thy burden upon the LORD, and he shall sustain thee.", ref: "Psalm 55:22", for: "worry" },
  { text: "Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself.", ref: "Matthew 6:34", for: "worry" },
  { text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid.", ref: "John 14:27", for: "worry" },
  { text: "…weeping may endure for a night, but joy cometh in the morning.", ref: "Psalm 30:5", for: "worry" },
  { text: "What time I am afraid, I will trust in thee.", ref: "Psalm 56:3", for: "fear" },
  { text: "Thou shalt not be afraid for the terror by night…", ref: "Psalm 91:5", for: "fear" },
  { text: "The eternal God is thy refuge, and underneath are the everlasting arms…", ref: "Deuteronomy 33:27", for: "fear" },
  { text: "The LORD thy God in the midst of thee is mighty; he will save, he will rejoice over thee with joy; he will rest in his love, he will joy over thee with singing.", ref: "Zephaniah 3:17", for: "fear" },
  { text: "Be still, and know that I am God…", ref: "Psalm 46:10", for: "rest" },
];

// ── Journal ──────────────────────────────────────────────────────────────────

export const JOURNALS: readonly { id: JournalKind; name: string; prompt: string; placeholder: string; why: string; source?: string; faith?: boolean; list: boolean }[] = [
  { id: "dump", name: "Brain dump", list: true, prompt: "Empty your head. Everything that's on your mind, one thing per line. Big or tiny, it all goes here.", placeholder: "Email Sam back\nThat thing I said at lunch\nBuy dog food",
    why: "Writing thoughts down tells your brain it can stop holding onto them. For an ADHD brain afraid of forgetting, that's a big relief." },
  { id: "tomorrow", name: "Tomorrow's list", list: true, prompt: "What do you need to do tomorrow? Write it all down so you don't have to remember it tonight.", placeholder: "Call the dentist\nPack gym bag\nFinish the report",
    why: "People who spent five minutes writing a to-do list before bed fell asleep faster than people who wrote about what they'd already done. The more detailed the list, the faster they fell asleep.", source: "Scullin et al., Journal of Experimental Psychology: General, 2018" },
  { id: "worry", name: "Worry to plan", list: false, prompt: "What's the worry? Then: is there one small thing you can do about it tomorrow? Write that step. If there's nothing you can do, write “Not mine to carry tonight.”", placeholder: "The worry:\n\nOne small step tomorrow:\n",
    why: "Turning a worry into a next step (“constructive worry”) lowered bedtime mental arousal in people with insomnia. It works best done in the early evening.", source: "Carney & Waters, Behavioral Sleep Medicine, 2006" },
  { id: "gratitude", name: "Three good things", list: true, prompt: "Three good things from today, however small. A warm drink counts.", placeholder: "Coffee with Mom\nThe sunset on the drive home\nI finished the laundry",
    why: "People who think grateful thoughts before bed tend to fall asleep sooner and sleep better.", source: "Wood et al., Journal of Psychosomatic Research, 2009" },
  { id: "prayer", name: "Cast your cares", list: true, faith: true, prompt: "“Casting all your care upon him; for he careth for you.” Write each care. Each one becomes a prayer, handed over for the night.", placeholder: "My job interview\nDad's health\nMoney this month",
    why: "Naming each worry to God is like the to-do-list research, with Someone to hand it to." },
  { id: "free", name: "Free write", list: false, prompt: "Just write. Nobody will read it. Stop whenever you're done.", placeholder: "Tonight I'm feeling…", why: "Getting feelings out of your head and onto the page can make them feel smaller." },
];

// ── Watch: YouTube searches ──────────────────────────────────────────────────
// Searches rather than single videos, so they never break: pick any result you like.

export const youtubeUrl = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

export const WATCH_GROUPS: readonly { name: string; faith?: boolean; items: { id: string; title: string; query: string; note: string; faith?: boolean }[] }[] = [
  { name: "Sleep stories", items: [
    { id: "nothing-much", title: "Nothing Much Happens", query: "Nothing Much Happens bedtime stories for grown ups", note: "Gentle stories where truly nothing happens, read twice, slower the second time." },
    { id: "boring-history", title: "Boring history", query: "boring history for sleep", note: "Long, calm history lectures. Interesting enough to follow, dull enough to sleep." },
    { id: "classic-books", title: "Classic books read aloud", query: "classic literature audiobook for sleep calm voice", note: "Old novels read slowly. Your brain follows someone else's story instead of making its own." },
    { id: "get-sleepy", title: "Sleep stories for adults", query: "sleep story for adults soft spoken", note: "Guided stories made for falling asleep." },
  ] },
  { name: "Christian", faith: true, items: [
    { id: "psalms-kjv", title: "Psalms read aloud (KJV)", query: "Psalms for sleep KJV read aloud", note: "Scripture read slowly. Many have rain or soft music underneath." },
    { id: "bible-stories", title: "Bible sleep stories", query: "Bible sleep stories for adults", note: "Calm retellings of Bible stories." },
    { id: "scripture-rain", title: "Scripture with rain", query: "Bible verses for sleep with rain sounds", note: "Promises about peace and rest over gentle rain." },
    { id: "christian-meditation", title: "Christian sleep meditation", query: "Christian guided sleep meditation", note: "Guided prayer and Scripture meditation for falling asleep." },
    { id: "hymns-piano", title: "Hymns on piano", query: "hymns piano instrumental for sleep", note: "Familiar hymns, slow and soft." },
    { id: "worship-dark", title: "Worship music, dark screen", query: "instrumental worship music for sleep black screen", note: "Soft instrumental worship with the screen dark." },
  ] },
  { name: "Sounds with a dark screen", items: [
    { id: "brown-dark", title: "Brown noise", query: "brown noise black screen 10 hours", note: "Deep, steady noise. A black screen so the light doesn't wake you." },
    { id: "rain-tent", title: "Rain on a tent", query: "rain on tent black screen 10 hours", note: "Rain pattering on canvas." },
    { id: "ocean-dark", title: "Ocean waves", query: "ocean waves black screen 10 hours", note: "Waves rolling in." },
    { id: "fan-dark", title: "Fan noise", query: "fan noise for sleep black screen 10 hours", note: "Like having a fan on all night." },
    { id: "fireplace", title: "Fireplace", query: "fireplace crackling sounds 10 hours dark", note: "A crackling fire." },
  ] },
  { name: "Guided relaxation", items: [
    { id: "nsdr", title: "Non-sleep deep rest", query: "NSDR non sleep deep rest 20 minutes", note: "A guided body-and-breath practice for deep rest." },
    { id: "body-scan-yt", title: "Body scan for sleep", query: "body scan meditation for sleep", note: "Slowly relax each part of your body." },
    { id: "pmr-yt", title: "Progressive muscle relaxation", query: "progressive muscle relaxation for sleep guided", note: "Tense and release, one muscle group at a time." },
    { id: "adhd-sleep", title: "ADHD sleep meditation", query: "ADHD sleep meditation racing thoughts", note: "Made for busy, racing minds." },
  ] },
  { name: "Calm to watch", items: [
    { id: "bob-ross", title: "Bob Ross painting", query: "Bob Ross The Joy of Painting full episode", note: "Soft voice, slow brush strokes. A classic for ADHD wind-downs. Watch it before bed rather than in it." },
    { id: "slow-tv", title: "Slow TV", query: "slow TV train ride 4K relaxing", note: "Hours of a train gliding through the countryside." },
    { id: "calm-piano", title: "Calm piano", query: "calm piano music for sleep dark screen", note: "Slow, quiet piano." },
  ] },
];

// ── Learn: the science, in plain words ───────────────────────────────────────

export type LearnCard = { id: string; title: string; body: string; source?: string; faith?: boolean };
export const LEARN_TOPICS: readonly { id: string; name: string; blurb: string; faith?: boolean; cards: LearnCard[] }[] = [
  { id: "adhd", name: "Your ADHD brain at night", blurb: "Why falling asleep is harder for you, and it's not a character flaw.", cards: [
    { id: "late-clock", title: "Your body clock may run late", body: "Many adults with ADHD release the sleep hormone melatonin later in the evening than other people, so sleepiness simply arrives later. Fighting it with willpower rarely works. Morning light and a steady wake-up time slowly pull the clock earlier.", source: "Van Veen et al., Biological Psychiatry, 2010; Bijlenga et al., 2019" },
    { id: "quiet-louder", title: "Silence can make your mind louder", body: "When the room goes quiet, an under-stimulated brain goes looking for something to do, and starts making up scenarios, replaying conversations or planning. A low, steady input, like brown noise or a calm story, gives it something to rest on instead.", source: "Steady noise helped attention in ADHD in Söderlund et al., 2007; many find the same at night" },
    { id: "revenge", title: "Revenge bedtime procrastination", body: "Staying up late because it's the only time that feels like yours has a name. Don't fight your phone with willpower. Make the boring choice easy: start sounds, switch on Lights out, and let the screen go dark.", source: "Kroese et al., Frontiers in Psychology, 2014" },
    { id: "time-blind", title: "Time blindness is real", body: "If ten o'clock suddenly becomes one o'clock, set an alarm for when to start winding down, not just one to wake up. The Plan tab works out your times for you." },
    { id: "meds", title: "Medication timing matters", body: "When you take a stimulant can affect your sleep. If you think it does, talk with your prescriber about timing. Don't change it on your own." },
    { id: "rls", title: "Restless legs are more common with ADHD", body: "An uncomfortable urge to move your legs at night, which eases when you move them, may be restless legs syndrome. It's linked with low iron. Ask your doctor about checking your iron (ferritin).", source: "Cortese et al., Sleep, 2005" },
  ] },
  { id: "thoughts", name: "Racing thoughts and worry", blurb: "What actually helps a mind that won't switch off.", cards: [
    { id: "todo", title: "Write tomorrow's to-do list", body: "In a sleep-lab study, people who wrote a detailed to-do list for five minutes before bed fell asleep faster than people who wrote about what they had already done.", source: "Scullin et al., 2018" },
    { id: "worry-early", title: "Give worry an earlier time slot", body: "Spend 15 minutes in the early evening writing each worry and one next step. Then, when it shows up at bedtime, you can tell it: I've already handled you today.", source: "Carney & Waters, 2006" },
    { id: "shuffle", title: "Scramble your thoughts on purpose", body: "As you fall asleep, your thoughts naturally become random and disconnected. The cognitive shuffle copies that on purpose: picture unrelated things, one after another, so worry can't build a story. Early studies are promising.", source: "Beaudoin et al., SLEEP abstract, 2016" },
    { id: "imagery", title: "Calm pictures beat counting sheep", body: "People with insomnia who imagined a calm, detailed scene fell asleep faster than people who just tried to distract themselves. Guided stories do this for you.", source: "Harvey & Payne, Behaviour Research and Therapy, 2002" },
    { id: "the-word", title: "Block the inner voice", body: "Silently repeating a meaningless word like “the” every couple of seconds keeps your inner voice too busy to narrate worries. An early study found it helped people fall asleep sooner.", source: "Levey et al., Behaviour Research and Therapy, 1991" },
    { id: "stop-trying", title: "Stop trying so hard", body: "Effort is the enemy of sleep. Gently trying to stay awake instead (paradoxical intention) lowers the pressure, and the pressure is often what was keeping you up.", source: "Broomfield & Espie, 2003" },
    { id: "gratitude", title: "End on something good", body: "Grateful thoughts at bedtime are linked with falling asleep sooner and sleeping better.", source: "Wood et al., 2009" },
  ] },
  { id: "cbti", name: "The proven core: CBT-I", blurb: "The treatment sleep doctors recommend first, before sleeping pills.", cards: [
    { id: "first-line", title: "CBT-I comes first", body: "Cognitive behavioral therapy for insomnia (CBT-I) is the first treatment the American College of Physicians recommends for long-lasting insomnia. It works as well as pills in the short term, and better in the long term.", source: "Qaseem et al., Annals of Internal Medicine, 2016" },
    { id: "twenty", title: "The 20-minute rule", body: "If you can't sleep after what feels like 20 minutes, get up, go somewhere dim, and do something calm and boring until you feel sleepy. It retrains your brain to connect bed with sleep.", source: "Bootzin, 1972; American Academy of Sleep Medicine" },
    { id: "wake-time", title: "Same wake-up time, every day", body: "A steady wake-up time, weekends included, is the anchor for your whole body clock. Bedtime can float a little; wake time shouldn't." },
    { id: "bed-for-sleep", title: "Keep bed for sleep", body: "Scrolling, working and worrying in bed teach your brain that bed is a place to be awake. Do those things somewhere else." },
    { id: "clock", title: "Turn the clock around", body: "Checking the time at night increases worry and makes it take longer to fall asleep. That's why this app never shows a clock at night.", source: "Tang, Schmidt & Harvey, 2007" },
    { id: "coach", title: "A free CBT-I app", body: "CBT-i Coach, made by the U.S. Department of Veterans Affairs, is free and walks you through the full program. It's great alongside working with a professional." },
    { id: "relax-standard", title: "Relaxation is a standard treatment", body: "Relaxation training, like progressive muscle relaxation, is one of the standard, recommended treatments for insomnia, along with stimulus control.", source: "Morgenthaler et al., Sleep, 2006" },
  ] },
  { id: "body", name: "Your body and your room", blurb: "Temperature, breath, and weight.", cards: [
    { id: "cool", title: "Keep your room cool", body: "Your body needs to cool down to fall asleep. Most people sleep best in a cool room, around 60 to 67°F (16 to 19°C).", source: "Sleep Foundation guidance" },
    { id: "shower", title: "A warm shower 1 to 2 hours before bed", body: "Warming up and then cooling off signals your body that it's time to sleep. In studies, a warm shower or bath 1 to 2 hours before bed helped people fall asleep about 10 minutes faster.", source: "Haghayegh et al., Sleep Medicine Reviews, 2019" },
    { id: "blanket", title: "Try a weighted blanket", body: "In a study of people with ADHD, depression, anxiety or bipolar disorder, weighted blankets reduced insomnia and improved sleep.", source: "Ekholm et al., Journal of Clinical Sleep Medicine, 2020" },
    { id: "slow-breath", title: "Slow your breathing", body: "Breathing about six times a minute shifts your nervous system toward rest. Long breaths out matter most.", source: "Laborde et al., 2022" },
    { id: "sigh", title: "The calming sigh", body: "Two breaths in and one long breath out, for five minutes, lowered breathing rate and lifted mood more than mindfulness meditation in a month-long study.", source: "Balban et al., 2023" },
  ] },
  { id: "light", name: "Light and screens", blurb: "What light does to your sleep hormone.", cards: [
    { id: "screens", title: "Bright screens push sleep later", body: "Reading on a bright tablet before bed delayed melatonin and made it take longer to fall asleep, compared with reading a printed book. If you use your phone, keep it dim and warm.", source: "Chang et al., PNAS, 2015" },
    { id: "morning-light", title: "Get morning light", body: "Bright light soon after you wake up tells your body clock when the day starts, which helps you get sleepy earlier that night. Ten to thirty minutes outside is ideal." },
    { id: "dim", title: "Dim the house an hour before bed", body: "Turn off overhead lights and use lamps. Warm, low light is the signal your brain is waiting for." },
  ] },
  { id: "food", name: "Caffeine, alcohol and food", blurb: "What you drink in the afternoon shows up at night.", cards: [
    { id: "caffeine", title: "Stop caffeine about 9 hours before bed", body: "A review of the research found a regular cup of coffee should be finished at least 8.8 hours before bedtime to avoid losing sleep. Pre-workout drinks need even longer. Even caffeine 6 hours before bed cut sleep by over an hour in one study.", source: "Gardiner et al., Sleep Medicine Reviews, 2023; Drake et al., 2013" },
    { id: "alcohol", title: "Alcohol breaks up the second half of the night", body: "A drink can make you sleepy at first, but it disrupts sleep later in the night and reduces dream sleep.", source: "Ebrahim et al., Alcoholism: Clinical and Experimental Research, 2013" },
    { id: "meals", title: "Finish big meals 2 to 3 hours before bed", body: "A small snack is fine if you're hungry. A large meal right before bed can keep you up." },
    { id: "exercise", title: "Evening exercise is fine", body: "Exercise in the evening doesn't hurt sleep for most people, as long as hard workouts end at least an hour before bed.", source: "Stutz et al., Sports Medicine, 2019" },
  ] },
  { id: "sound", name: "Sound", blurb: "What noise can and can't do.", cards: [
    { id: "masking", title: "Steady sound covers sudden sounds", body: "The research on noise for sleep is mixed and mostly low quality. Its clearest benefit is masking: a steady sound makes a door, a car or a snore less likely to wake you.", source: "Riedy et al., Sleep Medicine Reviews, 2021" },
    { id: "pink-lab", title: "About pink noise and deep sleep", body: "Lab studies found that short pulses of pink noise, timed to brain waves, boosted deep sleep. A pink noise track isn't the same thing, but many people still find it soothing.", source: "Papalambros et al., Frontiers in Human Neuroscience, 2017" },
    { id: "music", title: "Calm music may help", body: "Listening to relaxing music may improve how well people with insomnia say they sleep.", source: "Jespersen et al., Cochrane Review, 2022" },
    { id: "volume", title: "Keep it soft", body: "Sound for sleep should be quiet, like a light shower in the next room, not loud. Use the timer so it fades out once you're asleep." },
  ] },
  { id: "night", name: "Waking in the night", blurb: "What to do at 3 a.m.", cards: [
    { id: "normal", title: "Waking up is normal", body: "Everyone wakes briefly several times a night. Usually you don't remember. What keeps you up is checking the time and starting to think." },
    { id: "no-clock", title: "Don't look at the clock", body: "Knowing it's 3:12 a.m. starts the math: “If I fall asleep now, I'll get...” That math wakes you up more.", source: "Tang et al., 2007" },
    { id: "same-rule", title: "The same 20-minute rule applies", body: "If you're awake for what feels like a long time, get up, keep it dim and boring, and go back to bed when you're sleepy." },
  ] },
  { id: "faith", name: "Faith and rest", faith: true, blurb: "What the Bible says about sleep.", cards: [
    { id: "trust", title: "Sleep is an act of trust", body: "“I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety” (Psalm 4:8). You can close your eyes because Someone else is keeping watch. “He that keepeth Israel shall neither slumber nor sleep” (Psalm 121:4).", faith: true },
    { id: "gift", title: "Sleep is a gift, not a reward", body: "“It is vain for you to rise up early, to sit up late... for so he giveth his beloved sleep” (Psalm 127:2). You don't have to earn rest by finishing everything first.", faith: true },
    { id: "cast", title: "Cast your cares", body: "“Casting all your care upon him; for he careth for you” (1 Peter 5:7). Writing each worry down and handing it to God pairs an old practice with what the to-do-list research found.", faith: true },
    { id: "examen", title: "The evening examen", body: "St. Ignatius of Loyola taught a simple evening prayer almost 500 years ago: notice God's presence, give thanks for the day, be honest about it, and hand tomorrow over. It's in the Pray tab.", faith: true },
    { id: "sabbath", title: "God built rest into creation", body: "“And the evening and the morning were the first day” (Genesis 1:5). In the Bible's way of counting, the day starts at evening, with rest. And on the seventh day, God rested.", faith: true },
  ] },
  { id: "help", name: "When to get help", blurb: "Some sleep problems need a doctor.", cards: [
    { id: "apnea", title: "Snoring, gasping, or very sleepy days", body: "Loud snoring, gasping or choking at night, or falling asleep during the day can be signs of sleep apnea. Ask your doctor about a sleep test." },
    { id: "insomnia", title: "Trouble most nights for three months", body: "Trouble sleeping three or more nights a week for three months or more is chronic insomnia. Ask your doctor about CBT-I." },
    { id: "melatonin", title: "Ask before trying melatonin", body: "Melatonin can help with a late body clock, but the timing and amount matter and it isn't right for everyone. Ask your doctor or pharmacist first, especially if you take other medicine." },
    { id: "crisis", title: "If you're struggling", body: "If you're having thoughts of hurting yourself, or the nights feel hopeless, please reach out now. In the U.S., call or text 988 to reach the Suicide and Crisis Lifeline, any time of day or night." },
  ] },
];

// ── Plan: the wind-down checklist ────────────────────────────────────────────

export const DEFAULT_CHECKLIST: readonly { id: string; text: string; faith?: boolean }[] = [
  { id: "dnd", text: "Phone on Do Not Disturb" },
  { id: "lamps", text: "Overhead lights off, lamps low" },
  { id: "cool", text: "Bedroom cool (about 65°F)" },
  { id: "tomorrow", text: "Tomorrow's list written" },
  { id: "clothes", text: "Clothes for tomorrow laid out" },
  { id: "water", text: "Water by the bed" },
  { id: "alarm", text: "Wake-up alarm set" },
  { id: "pray", text: "Prayed or read Scripture", faith: true },
];

// ── The tools, all in one place ──────────────────────────────────────────────

export type ToolKind = "sound" | "breathe" | "mind" | "body" | "story" | "scripture" | "prayer" | "journal" | "boring" | "screen";

export type SleepTool = {
  /** Kind and item, like "sound:brown" or "script:night-train". Saved in the sleep log, so never renamed. */
  id: string;
  name: string;
  kind: ToolKind;
  blurb: string;
  why: string;
  source?: string;
  minutes?: number;
  faith?: boolean;
  /** It works with your eyes closed: it's sound, or it's read aloud. */
  eyesClosed?: boolean;
  tab: SleepTab;
};

const SCRIPT_WHY: Record<string, { why: string; source?: string }> = {
  "body-scan": { why: "Moving your attention slowly through your body pulls it away from thoughts and lets muscles release. Mindfulness practice like this improved sleep in people with chronic insomnia.", source: "Ong et al., Sleep, 2014" },
  pmr: { why: "Tensing and releasing teaches your body what “relaxed” feels like. Progressive muscle relaxation is one of the standard, recommended treatments for insomnia.", source: "Morgenthaler et al., Sleep, 2006" },
  military: { why: "Combines three things with good evidence: relaxing your muscles, slowing your breath, and giving your mind one simple thing to hold. From the 1981 book Relax and Win.", source: "Winter, Relax and Win, 1981" },
  "warm-heavy": { why: "Autogenic training uses quiet phrases to warm and relax the body. It's one of the relaxation methods sleep specialists use.", source: "Relaxation training: Morgenthaler et al., 2006" },
  "deep-rest": { why: "A fast-moving body tour keeps a busy ADHD mind engaged without letting it wander, and counting breaths backward is just hard enough to crowd out worry." },
  sinking: { why: "Noticing your weight on the bed shifts attention from your head to your body, where sleep starts." },
  paradox: { why: "Trying hard to sleep creates the anxiety that keeps you awake. Gently trying to stay awake removes it.", source: "Broomfield & Espie, 2003" },
  "get-up": { why: "Getting up when you can't sleep is the core of stimulus control, one of the best-proven parts of CBT-I.", source: "Bootzin, 1972; Morgenthaler et al., 2006" },
  examen: { why: "A nearly 500-year-old way to end the day with God: gratitude, honesty, and handing tomorrow over." },
};

function scriptTool(s: SleepScript): SleepTool {
  const kind: ToolKind = s.kind === "story" ? "story" : s.kind === "body" ? "body" : s.kind === "prayer" ? "prayer" : s.kind === "boring" ? "boring" : "mind";
  const tab: SleepTab = kind === "story" || kind === "boring" ? "stories" : kind === "body" ? "body" : kind === "prayer" ? "pray" : "mind";
  const fallback = kind === "story"
    ? { why: "Following a calm story crowds out your own worries, so your brain doesn't have to make up scenarios. Calm imagery helped people with insomnia fall asleep faster.", source: "Harvey & Payne, 2002" }
    : kind === "boring" ? { why: "When you've gotten up because you can't sleep, something dull in dim light lets sleepiness come back.", source: "Stimulus control: Bootzin, 1972" }
    : kind === "prayer" ? { why: "Handing the day and its worries to God, in words, helps a busy mind let go." }
    : { why: "Relaxation helps your body and mind slow down for sleep.", source: "Morgenthaler et al., 2006" };
  const why = SCRIPT_WHY[s.id] ?? fallback;
  return { id: `script:${s.id}`, name: s.title, kind, blurb: s.blurb, why: why.why, source: why.source, minutes: scriptMinutes(s), faith: s.faith, eyesClosed: kind !== "boring", tab };
}

const MIND_TOOLS: SleepTool[] = [
  { id: "mind:park", name: "Park your thoughts", kind: "mind", tab: "mind", minutes: 2, blurb: "Type each thought as it comes. It's saved for the morning, so your brain can let go of it.",
    why: "Writing down what's on your mind before bed helps you fall asleep faster. Your brain stops rehearsing what it's afraid to forget.", source: "Scullin et al., 2018" },
  { id: "mind:shuffle", name: "Cognitive shuffle", kind: "mind", tab: "mind", minutes: 10, eyesClosed: true, blurb: "Random, unconnected words read slowly. Picture each one for a moment, then let it go.",
    why: "Copies the scrambled thinking your brain does right before sleep, so worries can't build into a story. Early studies are promising.", source: "Beaudoin et al., 2016" },
  { id: "mind:countdown", name: "Count backward by threes", kind: "mind", tab: "mind", minutes: 10, eyesClosed: true, blurb: "300, 297, 294… just hard enough to crowd out other thoughts.",
    why: "A task that needs a little focus keeps worry out without being interesting enough to wake you up." },
  { id: "mind:breathcount", name: "Count breaths to ten", kind: "mind", tab: "mind", minutes: 10, eyesClosed: true, blurb: "Count each breath out from one to ten, then start over. Lost count? Start over. That's the practice.",
    why: "Pairing counting with slow breathing gives a racing mind something steady and calm to do." },
  { id: "mind:alphabet", name: "The alphabet game", kind: "mind", tab: "mind", minutes: 10, eyesClosed: true, blurb: "Pick a category, then think of one thing for each letter, A to Z, at a slow pace.",
    why: "Like the cognitive shuffle: a gentle mental job with no story to get caught up in." },
  { id: "mind:the", name: "The word “the”", kind: "mind", tab: "mind", minutes: 5, eyesClosed: true, blurb: "Silently say “the” every two seconds. It keeps your inner voice busy.",
    why: "Repeating a meaningless word blocks the inner voice that narrates worries. It helped people fall asleep sooner in an early study.", source: "Levey et al., 1991" },
];

const PRAY_TOOLS: SleepTool[] = [
  { id: "pray:names", name: "Names of God, A to Z", kind: "prayer", tab: "pray", minutes: 12, faith: true, eyesClosed: true, blurb: "Count your way through the alphabet with a name of God for each letter, and the verse it comes from.",
    why: "Counting, but with something good to dwell on. “Whatsoever things are lovely... think on these things” (Philippians 4:8)." },
  { id: "pray:blessings", name: "Count your blessings", kind: "prayer", tab: "pray", minutes: 10, faith: true, eyesClosed: true, blurb: "Instead of sheep: one blessing for each letter of the alphabet, at a slow pace.",
    why: "Gratitude at bedtime is linked with falling asleep faster and sleeping better.", source: "Wood et al., 2009" },
];

const OTHER_TOOLS: SleepTool[] = [
  { id: "screen:lights-out", name: "Lights out", kind: "screen", tab: "tonight", blurb: "Your screen goes fully black. Sounds and stories keep playing. Tap anywhere to see the controls.",
    why: "Keeps your phone from becoming a distraction, and keeps light out of your eyes." },
  ...JOURNALS.map((j): SleepTool => ({ id: `journal:${j.id}`, name: j.name, kind: "journal", tab: "journal", minutes: 5, faith: j.faith, blurb: j.prompt, why: j.why, source: j.source })),
];

export const TOOLS: readonly SleepTool[] = [
  ...SOUNDS.map((s): SleepTool => ({ id: `sound:${s.id}`, name: s.name, kind: "sound", tab: "sounds", blurb: s.blurb, eyesClosed: true,
    why: s.id === "brown" ? "Steady, low sound masks noises that would wake you, and many people with ADHD find it quiets mental chatter." : "A steady sound masks sudden noises that might wake you.",
    source: "Riedy et al., 2021" })),
  ...BREATHS.map((b): SleepTool => ({ id: `breathe:${b.id}`, name: b.name, kind: "breathe", tab: "breathe", minutes: 5, faith: b.faith, eyesClosed: true, blurb: b.prayer ? `${b.prayer.in} / ${b.prayer.out} (${displayRef(b.prayer.ref)})` : b.blurb, why: b.why, source: b.source })),
  ...MIND_TOOLS,
  ...SCRIPTS.map(scriptTool),
  ...PASSAGES.map((p): SleepTool => ({ id: `passage:${p.id}`, name: `${displayRef(p.ref)}: ${p.title}`, kind: "scripture", tab: "pray", minutes: Math.max(1, Math.round(p.verses.length * 0.4)), faith: true, eyesClosed: true, blurb: p.note,
    why: "Scripture read slowly gives your mind something true and good to rest on." })),
  ...PRAY_TOOLS,
  ...OTHER_TOOLS,
];

export const toolById = (id: string) => TOOLS.find((t) => t.id === id);

// ── "What's keeping you up?" ─────────────────────────────────────────────────

export type ScenarioStep = { tool: string; tip: string };
export type Scenario = { id: string; label: string; note: string; steps: ScenarioStep[]; help?: string };

export const SCENARIOS: readonly Scenario[] = [
  { id: "racing", label: "My mind is racing", note: "Really common with ADHD. When the day goes quiet, your brain goes looking for something to do. Give it a small, boring job instead of fighting it.", steps: [
    { tool: "mind:park", tip: "Two minutes. Get every thought out of your head and saved for morning." },
    { tool: "sound:brown", tip: "Start brown noise so the quiet isn't empty." },
    { tool: "mind:shuffle", tip: "Then picture random words until the racing fades." },
    { tool: "passage:ps94", tip: "“In the multitude of my thoughts within me thy comforts delight my soul.”" },
    { tool: "script:night-train", tip: "Or let a story carry your attention for you." },
  ] },
  { id: "picturing", label: "I keep picturing things", note: "An imagination that won't switch off is part of how your brain works. You can't stop pictures by force, but you can swap them for ones that don't go anywhere.", steps: [
    { tool: "mind:shuffle", tip: "Random, unconnected pictures can't turn into a scenario." },
    { tool: "script:thoughts-captive", tip: "Hand each scenario to God, and think on something true and lovely." },
    { tool: "script:bookshop-rain", tip: "Let someone else tell the story, so your brain doesn't have to make one up." },
    { tool: "mind:the", tip: "No pictures at all: silently repeat “the” to block the inner voice." },
  ] },
  { id: "anxious", label: "I'm anxious or worried", note: "Worry feels urgent at night, but almost nothing can be solved at this hour. Get it out of your head, then calm your body.", steps: [
    { tool: "journal:worry", tip: "Write the worry and one small step for tomorrow. Then it's handled for tonight." },
    { tool: "journal:prayer", tip: "Or write each care down and hand it to God." },
    { tool: "breathe:sigh", tip: "Then a few calming sighs: two breaths in, one long breath out." },
    { tool: "passage:phil4", tip: "“The peace of God, which passeth all understanding, shall keep your hearts and minds.”" },
    { tool: "script:body-scan", tip: "Finish by letting your body go, part by part." },
  ] },
  { id: "restless", label: "My body won't settle", note: "If you feel wired or fidgety, give your body something physical to do first, then something slow.", steps: [
    { tool: "script:pmr", tip: "Tense each muscle group, then let it go." },
    { tool: "breathe:slow", tip: "Then slow your breathing to six breaths a minute." },
    { tool: "breathe:be-still", tip: "Or breathe with a prayer: “Be still” in, “and know that I am God” out." },
    { tool: "script:warm-heavy", tip: "Let your arms and legs grow warm and heavy." },
  ] },
  { id: "awake", label: "I'm not sleepy at all", note: "Lying in bed wide awake teaches your brain that bed is for being awake. The proven fix sounds backward: get up for a little while.", steps: [
    { tool: "script:get-up", tip: "The 20-minute rule. Get up, go somewhere dim, do something dull." },
    { tool: "script:kitchen-drawer", tip: "Something boring to read while you wait for sleepiness." },
    { tool: "script:examen", tip: "Or review the day with God while you wait." },
    { tool: "script:paradox", tip: "Back in bed, stop trying to sleep. Gently try to stay awake instead." },
  ] },
  { id: "woke", label: "I woke up in the night", note: "Waking briefly at night is normal. What keeps you up is checking the time and starting to think. Don't look at the clock.", steps: [
    { tool: "breathe:478", tip: "A few slow rounds of 4-7-8 breathing, eyes closed." },
    { tool: "script:woke-up", tip: "“Return unto thy rest, O my soul.”" },
    { tool: "script:sinking", tip: "Let the bed take your weight again." },
    { tool: "script:deep-rest", tip: "If you're still awake, rest deeply even if sleep doesn't come." },
  ] },
  { id: "heavy", label: "My heart feels heavy", note: "Sad or lonely nights are hard. Be gentle with yourself tonight.", help: "If it's more than a hard night, please reach out to someone. In the U.S., call or text 988, any time.", steps: [
    { tool: "journal:gratitude", tip: "Three small good things. Even a warm blanket counts." },
    { tool: "passage:ps23", tip: "“Though I walk through the valley of the shadow of death, I will fear no evil: for thou art with me.”" },
    { tool: "script:keep-watch", tip: "A prayer for everyone who watches or weeps tonight, you included." },
    { tool: "script:snow-cabin", tip: "Or a quiet story, read softly." },
    { tool: "breathe:long-out", tip: "Long, slow breaths out. Let the bed hold you." },
  ] },
  { id: "drift", label: "I just want to drift off", note: "Pick something to listen to, switch on Lights out, and let it play.", steps: [
    { tool: "sound:rain", tip: "Start some rain." },
    { tool: "script:night-train", tip: "Add a sleep story on top." },
    { tool: "passage:ps4", tip: "Or fall asleep to Psalm 4, read slowly." },
    { tool: "screen:lights-out", tip: "Then turn the screen fully dark." },
  ] },
  { id: "phone", label: "I can't put my phone down", note: "Staying up late to get time that feels like yours is called revenge bedtime procrastination. Instead of fighting your phone, make it boring.", steps: [
    { tool: "journal:tomorrow", tip: "Write tomorrow's list so nothing is left hanging." },
    { tool: "sound:brown", tip: "Start a sound so the room doesn't feel empty." },
    { tool: "screen:lights-out", tip: "Turn on Lights out. The sound keeps going, the screen goes dark." },
    { tool: "script:surrender", tip: "Hand the day over: what's done, and what's undone." },
  ] },
];

/** A scenario's steps for this person: faith content only when they've chosen to see it. */
export function scenarioSteps(s: Scenario, faith: boolean): ScenarioStep[] {
  return s.steps.filter((step) => { const t = toolById(step.tool); return !!t && (faith || !t.faith); });
}

/** What to offer first, before any choice is made. */
export const QUICK_START = ["sound:brown", "breathe:sigh", "script:night-train", "passage:ps4", "mind:shuffle", "screen:lights-out"] as const;

// ── Scripts made on the spot ─────────────────────────────────────────────────
// Read aloud by the same narrator as the stories. A number is seconds of quiet.

type Line = string | number;

/** The cognitive shuffle, read aloud: a seed word, then a few unconnected words for each of its
 *  letters, with time to picture each one. */
export function shuffleScript(rand: () => number = Math.random): Line[] {
  const seed = SHUFFLE_SEEDS[Math.floor(rand() * SHUFFLE_SEEDS.length)];
  const lines: Line[] = [
    "Here's how this works. I'll say a word, slowly. Picture it for a moment, any way you like, then let it go. The words don't connect, and that's the point.", 3,
    "If your mind wanders, just catch the next word.", 4,
  ];
  for (const { letter, words } of shuffleRound(seed, 5, rand)) {
    lines.push(`Words that start with ${letter.toUpperCase()}.`, 3);
    for (const w of words) lines.push(`${w[0].toUpperCase()}${w.slice(1)}.`, 7);
  }
  lines.push("Keep going on your own if you like. Any word, any picture. Then let it go.", 20);
  return lines;
}

/** Counting backward by threes from 300, with a slow beat between numbers. */
export function countdownScript(from = 300, by = 3, gapSecs = 4): Line[] {
  const lines: Line[] = ["Count backward with me, by threes, starting at three hundred. If you lose your place, just pick up at the next number you hear.", 3];
  for (let n = from; n > 0; n -= by) lines.push(`${n}.`, gapSecs);
  lines.push("That's all of them. Stay here, and rest.", 15);
  return lines;
}

/** The alphabet game: one thing in a category for each letter, at a slow pace. */
export function alphabetScript(categoryName: string, gapSecs = 12): Line[] {
  // Only the first letter is lowered, so "People in the Bible" keeps its capitals.
  const category = categoryName.charAt(0).toLowerCase() + categoryName.slice(1);
  const lines: Line[] = [`Tonight's category: ${category}. For each letter of the alphabet, think of one. Take your time. There's no wrong answer, and no hurry.`, 4];
  for (const letter of ALPHABET) lines.push(`${letter.toUpperCase()}.`, gapSecs);
  lines.push("That's the whole alphabet. You can start again, or just rest.", 15);
  return lines;
}

/** Count your blessings, A to Z: one thing to be thankful for per letter. */
export function blessingsScript(gapSecs = 12): Line[] {
  const lines: Line[] = ["Instead of counting sheep, let's count blessings. For each letter, think of one thing you're thankful for. A person, a place, a small moment from today.", 4];
  for (const letter of ALPHABET) lines.push(`${letter.toUpperCase()}.`, gapSecs);
  lines.push("Every good gift and every perfect gift is from above.", 5, "Thank you, Lord.", 15);
  return lines;
}

/** The names of God, A to Z, each with its verse, slowly. */
export function namesScript(): Line[] {
  const lines: Line[] = ["Let's go through the alphabet with the names of God. For each letter, a name, and the verse it comes from. Let each one settle before the next.", 4];
  for (const n of NAMES_OF_GOD) lines.push(`${n.letter}. ${spokenCaps(n.name)}.`, 2, spokenCaps(n.verse), 2, `${n.ref.replace(/:/, ", verse ")}.`, 7);
  lines.push("Whatsoever things are lovely, think on these things.", 15);
  return lines;
}

/** A cast-your-cares list turned into a prayer, read aloud. */
export function caresScript(cares: readonly string[]): Line[] {
  const lines: Line[] = ["Lord, here is what I'm carrying tonight.", 3];
  for (const c of cares.map((x) => x.trim()).filter(Boolean)) lines.push(`${c.replace(/[.!?]*$/, "")}.`, 2, "I give this one to you.", 5);
  lines.push("Casting all my care upon you, because you care for me.", 4, "I'll pick up only what you hand back to me in the morning.", 4, "Amen.", 10);
  return lines;
}
