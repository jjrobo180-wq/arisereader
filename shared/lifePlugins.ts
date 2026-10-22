// Arise LifeHub: what the Plugin Store's add-on sections need beyond saved data. The verse of the
// day (King James Version, public domain), the daily quote, journal prompts, grocery aisles, and
// the readers for the live feeds (Today in history, What's trending, Bible passages) that
// server/lifehubPlugins.ts fetches.

/** Picks one item for a day (YYYY-MM-DD), the same all day and on every device. */
export function forDay<T>(list: readonly T[], date: string, salt = 0): T {
  let h = 2166136261 ^ salt;
  for (const ch of date) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return list[Math.abs(h) % list.length];
}

/** Whole days from `today` to `date` (both YYYY-MM-DD). Negative once it has passed. */
export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
}

// ── Bible ────────────────────────────────────────────────────────────────────

export type Verse = { reference: string; text: string };

export const VERSES: readonly Verse[] = [
  { reference: "John 3:16", text: "For God so loved the world, that he gave his only begotten Son, that whosoever believeth in him should not perish, but have everlasting life." },
  { reference: "Psalm 23:1", text: "The LORD is my shepherd; I shall not want." },
  { reference: "Philippians 4:13", text: "I can do all things through Christ which strengtheneth me." },
  { reference: "Proverbs 3:5", text: "Trust in the LORD with all thine heart; and lean not unto thine own understanding." },
  { reference: "Proverbs 3:6", text: "In all thy ways acknowledge him, and he shall direct thy paths." },
  { reference: "Isaiah 40:31", text: "But they that wait upon the LORD shall renew their strength; they shall mount up with wings as eagles; they shall run, and not be weary; and they shall walk, and not faint." },
  { reference: "Joshua 1:9", text: "Have not I commanded thee? Be strong and of a good courage; be not afraid, neither be thou dismayed: for the LORD thy God is with thee whithersoever thou goest." },
  { reference: "Romans 8:28", text: "And we know that all things work together for good to them that love God, to them who are the called according to his purpose." },
  { reference: "Jeremiah 29:11", text: "For I know the thoughts that I think toward you, saith the LORD, thoughts of peace, and not of evil, to give you an expected end." },
  { reference: "Psalm 46:1", text: "God is our refuge and strength, a very present help in trouble." },
  { reference: "Psalm 46:10", text: "Be still, and know that I am God: I will be exalted among the heathen, I will be exalted in the earth." },
  { reference: "Matthew 11:28", text: "Come unto me, all ye that labour and are heavy laden, and I will give you rest." },
  { reference: "Psalm 118:24", text: "This is the day which the LORD hath made; we will rejoice and be glad in it." },
  { reference: "Lamentations 3:22-23", text: "It is of the LORD's mercies that we are not consumed, because his compassions fail not. They are new every morning: great is thy faithfulness." },
  { reference: "1 Corinthians 13:13", text: "And now abideth faith, hope, charity, these three; but the greatest of these is charity." },
  { reference: "Psalm 119:105", text: "Thy word is a lamp unto my feet, and a light unto my path." },
  { reference: "Isaiah 41:10", text: "Fear thou not; for I am with thee: be not dismayed; for I am thy God: I will strengthen thee; yea, I will help thee; yea, I will uphold thee with the right hand of my righteousness." },
  { reference: "Matthew 6:34", text: "Take therefore no thought for the morrow: for the morrow shall take thought for the things of itself. Sufficient unto the day is the evil thereof." },
  { reference: "Philippians 4:6", text: "Be careful for nothing; but in every thing by prayer and supplication with thanksgiving let your requests be made known unto God." },
  { reference: "Philippians 4:7", text: "And the peace of God, which passeth all understanding, shall keep your hearts and minds through Christ Jesus." },
  { reference: "Galatians 6:9", text: "And let us not be weary in well doing: for in due season we shall reap, if we faint not." },
  { reference: "Psalm 37:4", text: "Delight thyself also in the LORD; and he shall give thee the desires of thine heart." },
  { reference: "Micah 6:8", text: "He hath shewed thee, O man, what is good; and what doth the LORD require of thee, but to do justly, and to love mercy, and to walk humbly with thy God?" },
  { reference: "Matthew 5:16", text: "Let your light so shine before men, that they may see your good works, and glorify your Father which is in heaven." },
  { reference: "Hebrews 11:1", text: "Now faith is the substance of things hoped for, the evidence of things not seen." },
  { reference: "2 Timothy 1:7", text: "For God hath not given us the spirit of fear; but of power, and of love, and of a sound mind." },
  { reference: "Psalm 34:18", text: "The LORD is nigh unto them that are of a broken heart; and saveth such as be of a contrite spirit." },
  { reference: "Ephesians 4:32", text: "And be ye kind one to another, tenderhearted, forgiving one another, even as God for Christ's sake hath forgiven you." },
  { reference: "Psalm 121:1-2", text: "I will lift up mine eyes unto the hills, from whence cometh my help. My help cometh from the LORD, which made heaven and earth." },
  { reference: "Proverbs 16:3", text: "Commit thy works unto the LORD, and thy thoughts shall be established." },
  { reference: "Psalm 27:1", text: "The LORD is my light and my salvation; whom shall I fear? the LORD is the strength of my life; of whom shall I be afraid?" },
  { reference: "John 14:27", text: "Peace I leave with you, my peace I give unto you: not as the world giveth, give I unto you. Let not your heart be troubled, neither let it be afraid." },
  { reference: "Romans 15:13", text: "Now the God of hope fill you with all joy and peace in believing, that ye may abound in hope, through the power of the Holy Ghost." },
  { reference: "Psalm 139:14", text: "I will praise thee; for I am fearfully and wonderfully made: marvellous are thy works; and that my soul knoweth right well." },
  { reference: "Numbers 6:24-26", text: "The LORD bless thee, and keep thee: The LORD make his face shine upon thee, and be gracious unto thee: The LORD lift up his countenance upon thee, and give thee peace." },
  { reference: "1 John 4:19", text: "We love him, because he first loved us." },
  { reference: "Psalm 30:5", text: "For his anger endureth but a moment; in his favour is life: weeping may endure for a night, but joy cometh in the morning." },
  { reference: "Proverbs 17:22", text: "A merry heart doeth good like a medicine: but a broken spirit drieth the bones." },
  { reference: "Isaiah 26:3", text: "Thou wilt keep him in perfect peace, whose mind is stayed on thee: because he trusteth in thee." },
  { reference: "James 1:5", text: "If any of you lack wisdom, let him ask of God, that giveth to all men liberally, and upbraideth not; and it shall be given him." },
  { reference: "Psalm 56:3", text: "What time I am afraid, I will trust in thee." },
  { reference: "Deuteronomy 31:6", text: "Be strong and of a good courage, fear not, nor be afraid of them: for the LORD thy God, he it is that doth go with thee; he will not fail thee, nor forsake thee." },
];

/** A passage reference safe to look up ("John 3:16", "Psalm 23", "1 Cor 13:4-7"). */
export function cleanReference(v: unknown): string {
  if (typeof v !== "string") return "";
  const ref = v.trim().replace(/\s+/g, " ");
  return /^[1-3]?\s?[A-Za-z][A-Za-z .]{1,30}\s\d{1,3}(:\d{1,3}(-\d{1,3})?)?(,\s?\d{1,3}(-\d{1,3})?)*$/.test(ref) ? ref : "";
}

export type Passage = { reference: string; verses: { verse: number; chapter: number; text: string }[]; translation: string };

/** Reads a bible-api.com answer. */
export function parseBiblePassage(json: any): Passage | null {
  if (!json || typeof json !== "object" || !Array.isArray(json.verses) || !json.verses.length) return null;
  return {
    reference: String(json.reference || "").slice(0, 80),
    translation: String(json.translation_name || "King James Version").slice(0, 60),
    verses: json.verses.slice(0, 200).map((v: any) => ({ chapter: Number(v.chapter) || 0, verse: Number(v.verse) || 0, text: String(v.text || "").replace(/\s+/g, " ").trim().slice(0, 2000) })),
  };
}

// ── Daily quote ──────────────────────────────────────────────────────────────

export type MotivationQuote = { id: string; text: string; by: string };

export const QUOTES: readonly MotivationQuote[] = [
  { id: "q1", text: "The journey of a thousand miles begins with one step.", by: "Lao Tzu" },
  { id: "q2", text: "Well done is better than well said.", by: "Benjamin Franklin" },
  { id: "q3", text: "Diligence is the mother of good luck.", by: "Benjamin Franklin" },
  { id: "q4", text: "Lost time is never found again.", by: "Benjamin Franklin" },
  { id: "q5", text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", by: "Johann Wolfgang von Goethe" },
  { id: "q6", text: "The best way out is always through.", by: "Robert Frost" },
  { id: "q7", text: "Nothing in life is to be feared, it is only to be understood.", by: "Marie Curie" },
  { id: "q8", text: "If you can't fly then run, if you can't run then walk, if you can't walk then crawl, but whatever you do you have to keep moving forward.", by: "Martin Luther King Jr." },
  { id: "q9", text: "The time is always right to do what is right.", by: "Martin Luther King Jr." },
  { id: "q10", text: "Darkness cannot drive out darkness; only light can do that. Hate cannot drive out hate; only love can do that.", by: "Martin Luther King Jr." },
  { id: "q11", text: "I am not afraid of storms, for I am learning how to sail my ship.", by: "Louisa May Alcott" },
  { id: "q12", text: "Start where you are. Use what you have. Do what you can.", by: "Arthur Ashe" },
  { id: "q13", text: "Courage is grace under pressure.", by: "Ernest Hemingway" },
  { id: "q14", text: "Fall seven times, stand up eight.", by: "Japanese proverb" },
  { id: "q15", text: "The best time to plant a tree was 20 years ago. The second best time is now.", by: "Chinese proverb" },
  { id: "q16", text: "A smooth sea never made a skilled sailor.", by: "English proverb" },
  { id: "q17", text: "Our greatest glory is not in never falling, but in rising every time we fall.", by: "Oliver Goldsmith" },
  { id: "q18", text: "Genius is one percent inspiration and ninety-nine percent perspiration.", by: "Thomas Edison" },
  { id: "q19", text: "Imagination is more important than knowledge.", by: "Albert Einstein" },
  { id: "q20", text: "Life is like riding a bicycle. To keep your balance you must keep moving.", by: "Albert Einstein" },
  { id: "q21", text: "The harder the conflict, the more glorious the triumph.", by: "Thomas Paine" },
  { id: "q22", text: "Change your thoughts and you change your world.", by: "Norman Vincent Peale" },
  { id: "q23", text: "Optimism is the faith that leads to achievement.", by: "Helen Keller" },
  { id: "q24", text: "Alone we can do so little; together we can do so much.", by: "Helen Keller" },
  { id: "q25", text: "Keep your eyes on the stars, and your feet on the ground.", by: "Theodore Roosevelt" },
  { id: "q26", text: "Well begun is half done.", by: "Aristotle" },
  { id: "q27", text: "Be not afraid of growing slowly; be afraid only of standing still.", by: "Chinese proverb" },
  { id: "q28", text: "Hitch your wagon to a star.", by: "Ralph Waldo Emerson" },
  { id: "q29", text: "Write it on your heart that every day is the best day in the year.", by: "Ralph Waldo Emerson" },
  { id: "q30", text: "Do not let what you cannot do interfere with what you can do.", by: "John Wooden" },
  { id: "q31", text: "Make each day your masterpiece.", by: "John Wooden" },
  { id: "q32", text: "The man who moves a mountain begins by carrying away small stones.", by: "Chinese proverb" },
  { id: "q33", text: "Hope is the thing with feathers that perches in the soul.", by: "Emily Dickinson" },
  { id: "q34", text: "He who has a why to live can bear almost any how.", by: "Friedrich Nietzsche" },
  { id: "q35", text: "Little by little, one travels far.", by: "Proverb" },
  { id: "q36", text: "Dream big and dare to fail.", by: "Norman Vaughan" },
  { id: "q37", text: "If opportunity doesn't knock, build a door.", by: "Milton Berle" },
  { id: "q38", text: "What you do today can improve all your tomorrows.", by: "Ralph Marston" },
  { id: "q39", text: "Act well your part; there all the honour lies.", by: "Alexander Pope" },
  { id: "q40", text: "Rome wasn't built in a day.", by: "Proverb" },
];

// ── Journal ──────────────────────────────────────────────────────────────────

export const JOURNAL_PROMPTS: readonly string[] = [
  "What made you smile today?",
  "Three things you're grateful for right now.",
  "What's one thing you'd like to let go of?",
  "Who helped you lately, and how?",
  "What would make tomorrow a good day?",
  "Something you learned this week.",
  "A small win worth celebrating.",
  "What's taking up most of your thoughts today?",
  "Describe a moment today you want to remember.",
  "What are you looking forward to?",
  "What did you do today just for you?",
  "Something that's been hard lately, and what's helping.",
  "If today had a title, what would it be?",
  "What's one kind thing you can do for someone tomorrow?",
  "Where did you feel most like yourself this week?",
  "What would you tell yourself from a year ago?",
  "A place that makes you feel calm, and why.",
  "What drained your energy today, and what gave you energy?",
  "One habit you're proud of building.",
  "What's a worry you can set down for tonight?",
];

export const JOURNAL_MOODS: readonly string[] = ["😊", "😌", "😐", "😔", "😤", "🥰", "😴", "🤩"];

// ── Grocery list ─────────────────────────────────────────────────────────────

export const AISLES: readonly string[] = ["Produce", "Dairy & eggs", "Meat & fish", "Bakery", "Pantry", "Frozen", "Snacks", "Drinks", "Household", "Personal care", "Other"];

const AISLE_WORDS: [string, string[]][] = [
  ["Produce", ["apple", "banana", "orange", "lemon", "lime", "grape", "berr", "strawberr", "blueberr", "melon", "peach", "pear", "plum", "avocado", "tomato", "potato", "onion", "garlic", "carrot", "celery", "lettuce", "spinach", "kale", "broccoli", "cauliflower", "pepper", "cucumber", "zucchini", "squash", "mushroom", "corn", "cilantro", "parsley", "basil", "ginger", "salad", "fruit", "veg", "herb", "pineapple", "mango", "cabbage", "bean sprout", "green bean"]],
  ["Dairy & eggs", ["milk", "cheese", "yogurt", "yoghurt", "butter", "cream", "egg", "sour cream", "cottage", "half and half", "creamer"]],
  ["Meat & fish", ["chicken", "beef", "pork", "turkey", "ham", "bacon", "sausage", "steak", "ground", "fish", "salmon", "tuna steak", "shrimp", "lamb", "meat", "hot dog", "deli"]],
  ["Bakery", ["bread", "bagel", "bun", "roll", "tortilla", "muffin", "croissant", "cake", "pita", "loaf"]],
  ["Frozen", ["frozen", "ice cream", "pizza", "popsicle", "waffle", "nugget", "fries"]],
  ["Snacks", ["chip", "cracker", "cookie", "candy", "chocolate", "popcorn", "pretzel", "granola bar", "nuts", "snack", "gum"]],
  ["Drinks", ["water", "juice", "soda", "coffee", "tea", "beer", "wine", "sparkling", "lemonade", "drink", "kombucha"]],
  ["Pantry", ["rice", "pasta", "noodle", "flour", "sugar", "salt", "oil", "vinegar", "sauce", "ketchup", "mustard", "mayo", "cereal", "oat", "soup", "can", "beans", "peanut butter", "jam", "jelly", "honey", "syrup", "spice", "baking", "broth", "tuna", "lentil", "quinoa"]],
  ["Household", ["paper towel", "toilet paper", "napkin", "trash bag", "foil", "plastic wrap", "detergent", "dish", "soap", "sponge", "bleach", "cleaner", "battery", "light bulb", "zip"]],
  ["Personal care", ["shampoo", "conditioner", "toothpaste", "toothbrush", "deodorant", "lotion", "razor", "floss", "tissue", "diaper", "wipe", "sunscreen", "vitamin", "medicine"]],
];

/** The aisle a grocery item most likely sits in. */
export function guessAisle(name: string): string {
  const n = ` ${name.toLowerCase()} `;
  for (const [aisle, words] of AISLE_WORDS) if (words.some((w) => n.includes(w))) return aisle;
  return "Other";
}

// ── Today in history (Wikipedia "On this day") ───────────────────────────────

export type HistoryEvent = { year: number; text: string; title: string; url: string; image: string };

/** Reads a Wikipedia "onthisday" list (selected, events, births or deaths). */
export function parseOnThisDay(list: unknown, max = 40): HistoryEvent[] {
  if (!Array.isArray(list)) return [];
  return list.slice(0, max).map((e: any) => {
    const page = Array.isArray(e?.pages) ? e.pages[0] : null;
    return {
      year: Number(e?.year) || 0,
      text: String(e?.text || "").slice(0, 600),
      title: String(page?.titles?.normalized || "").slice(0, 120),
      url: safeUrl(page?.content_urls?.desktop?.page),
      image: safeUrl(page?.thumbnail?.source),
    };
  }).filter((e) => e.text).sort((a, b) => b.year - a.year);
}

// ── What's trending ──────────────────────────────────────────────────────────

export type TrendingSearch = { title: string; traffic: string; news: { title: string; url: string; source: string }[]; image: string };
export type MostRead = { title: string; views: number; extract: string; url: string; image: string };

const decode = (s: string) => s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").trim();
const tag = (xml: string, name: string) => { const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`)); return m ? decode(m[1]) : ""; };

/** Only http(s) links, never javascript: or anything else. */
export function safeUrl(v: unknown): string {
  return typeof v === "string" && /^https?:\/\//i.test(v) ? v.slice(0, 1000) : "";
}

/** Reads Google Trends' trending-searches RSS. */
export function parseTrendsRss(xml: string, max = 25): TrendingSearch[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return items.slice(0, max).map((item) => ({
    title: tag(item, "title").slice(0, 120),
    traffic: tag(item, "ht:approx_traffic").slice(0, 20),
    image: safeUrl(tag(item, "ht:picture")),
    news: (item.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/g) || []).slice(0, 2).map((n) => ({
      title: tag(n, "ht:news_item_title").slice(0, 200), url: safeUrl(tag(n, "ht:news_item_url")), source: tag(n, "ht:news_item_source").slice(0, 60),
    })).filter((n) => n.title && n.url),
  })).filter((t) => t.title);
}

/** Reads the most-read articles from Wikipedia's featured feed, leaving out its own pages. */
export function parseMostRead(json: any, max = 20): MostRead[] {
  const list = json?.mostread?.articles;
  if (!Array.isArray(list)) return [];
  return list
    .filter((a: any) => a?.titles?.normalized && !/^(Main Page|Special:|Wikipedia:|Portal:|File:|Help:)/.test(a.titles.normalized))
    .slice(0, max)
    .map((a: any) => ({
      title: String(a.titles.normalized).slice(0, 120), views: Number(a.views) || 0, extract: String(a.extract || "").slice(0, 300),
      url: safeUrl(a.content_urls?.desktop?.page), image: safeUrl(a.thumbnail?.source),
    }));
}

// ── Dictionary ───────────────────────────────────────────────────────────────

export type WordOfDay = { word: string; type: string; definition: string; example: string };

export const WORDS: readonly WordOfDay[] = [
  { word: "serendipity", type: "noun", definition: "Finding something good without looking for it.", example: "Meeting her best friend in a wrong-turn café was pure serendipity." },
  { word: "resilient", type: "adjective", definition: "Able to recover quickly from hard times.", example: "Kids are more resilient than we give them credit for." },
  { word: "ephemeral", type: "adjective", definition: "Lasting a very short time.", example: "The sunset's colors were ephemeral, gone in minutes." },
  { word: "gregarious", type: "adjective", definition: "Fond of company; sociable.", example: "Our gregarious neighbor knows everyone on the block." },
  { word: "meticulous", type: "adjective", definition: "Showing great attention to detail.", example: "She kept meticulous notes on every recipe she tried." },
  { word: "candor", type: "noun", definition: "Being open and honest in what you say.", example: "I appreciated his candor about the budget." },
  { word: "tenacious", type: "adjective", definition: "Holding firmly to something; not giving up.", example: "The tenacious puppy would not let go of the rope." },
  { word: "benevolent", type: "adjective", definition: "Kind and well-meaning.", example: "A benevolent stranger paid for our coffee." },
  { word: "eloquent", type: "adjective", definition: "Fluent and persuasive in speaking or writing.", example: "Her eloquent toast had everyone in tears." },
  { word: "frugal", type: "adjective", definition: "Careful about spending money.", example: "Being frugal this month means a bigger vacation fund." },
  { word: "nostalgia", type: "noun", definition: "A fond longing for the past.", example: "The old song filled him with nostalgia." },
  { word: "ubiquitous", type: "adjective", definition: "Found everywhere.", example: "Phones have become ubiquitous at the dinner table." },
  { word: "zeal", type: "noun", definition: "Great energy and enthusiasm for something.", example: "He cleaned the garage with surprising zeal." },
  { word: "pragmatic", type: "adjective", definition: "Dealing with things in a practical, sensible way.", example: "We took a pragmatic approach to the move." },
  { word: "quaint", type: "adjective", definition: "Charmingly old-fashioned.", example: "We stayed in a quaint cabin by the lake." },
  { word: "altruism", type: "noun", definition: "Caring about the good of others without expecting anything back.", example: "Volunteering on weekends is pure altruism for her." },
  { word: "cacophony", type: "noun", definition: "A harsh mix of loud sounds.", example: "Breakfast with four kids is a cacophony." },
  { word: "diligent", type: "adjective", definition: "Hard-working and careful.", example: "A diligent student reviews notes every night." },
  { word: "empathy", type: "noun", definition: "Understanding and sharing someone else's feelings.", example: "A little empathy goes a long way in an argument." },
  { word: "fortitude", type: "noun", definition: "Courage in pain or hard times.", example: "She faced the long recovery with fortitude." },
  { word: "hiatus", type: "noun", definition: "A pause or break.", example: "The show is on hiatus until spring." },
  { word: "jubilant", type: "adjective", definition: "Very happy, especially after a success.", example: "The team was jubilant after the win." },
  { word: "kinship", type: "noun", definition: "A feeling of closeness or connection.", example: "They felt an instant kinship over shared hobbies." },
  { word: "luminous", type: "adjective", definition: "Full of light; glowing.", example: "The luminous moon lit up the yard." },
  { word: "mellifluous", type: "adjective", definition: "Sweet and smooth to hear.", example: "Her mellifluous voice made the audiobook a joy." },
  { word: "nonchalant", type: "adjective", definition: "Calm and unworried, or seeming so.", example: "He was nonchalant about the spelling bee, but practiced every night." },
  { word: "obstinate", type: "adjective", definition: "Stubbornly refusing to change your mind.", example: "The obstinate toddler would not wear a coat." },
  { word: "plethora", type: "noun", definition: "A large amount, often more than needed.", example: "The buffet offered a plethora of desserts." },
  { word: "quell", type: "verb", definition: "To calm or put an end to something.", example: "A hug can quell a lot of worries." },
  { word: "reverie", type: "noun", definition: "A pleasant daydream.", example: "The bus stop snapped her out of her reverie." },
  { word: "solace", type: "noun", definition: "Comfort in a time of sadness.", example: "He found solace in long walks." },
  { word: "trepidation", type: "noun", definition: "A feeling of fear about what might happen.", example: "She opened the report card with trepidation." },
  { word: "vivacious", type: "adjective", definition: "Lively and full of spirit.", example: "Their vivacious aunt is the life of every party." },
  { word: "whimsical", type: "adjective", definition: "Playful and unusual in a charming way.", example: "The kids painted whimsical murals on the fence." },
  { word: "zenith", type: "noun", definition: "The highest point.", example: "At the zenith of summer, the pool was packed." },
  { word: "aplomb", type: "noun", definition: "Calm self-confidence in a hard situation.", example: "She handled the spilled milk with aplomb." },
  { word: "bucolic", type: "adjective", definition: "Relating to the pleasant side of country life.", example: "The farm stay was wonderfully bucolic." },
  { word: "convivial", type: "adjective", definition: "Friendly, lively and enjoyable.", example: "Sunday dinners at Grandma's are always convivial." },
  { word: "gumption", type: "noun", definition: "Common sense and the courage to act on it.", example: "It took gumption to start her own business." },
  { word: "halcyon", type: "adjective", definition: "Calm, happy and peaceful, often remembered fondly.", example: "We talk about the halcyon days of summer camp." },
];

/** A word safe to look up: letters, with spaces, hyphens or apostrophes inside. */
export function cleanWord(v: unknown): string {
  if (typeof v !== "string") return "";
  const w = v.trim().toLowerCase();
  return /^[a-z][a-z' -]{0,40}$/.test(w) ? w : "";
}

export type Definition = { word: string; phonetic: string; audio: string; meanings: { partOfSpeech: string; definitions: { definition: string; example: string }[]; synonyms: string[] }[] };

/** Reads a dictionaryapi.dev answer. */
export function parseDefinition(json: unknown): Definition | null {
  if (!Array.isArray(json) || !json.length) return null;
  const first: any = json[0];
  const phonetics: any[] = json.flatMap((e: any) => (Array.isArray(e?.phonetics) ? e.phonetics : []));
  const meanings = json.flatMap((e: any) => (Array.isArray(e?.meanings) ? e.meanings : [])).slice(0, 8).map((m: any) => ({
    partOfSpeech: String(m?.partOfSpeech || "").slice(0, 30),
    definitions: (Array.isArray(m?.definitions) ? m.definitions : []).slice(0, 4).map((d: any) => ({ definition: String(d?.definition || "").slice(0, 500), example: String(d?.example || "").slice(0, 300) })).filter((d: any) => d.definition),
    synonyms: (Array.isArray(m?.synonyms) ? m.synonyms : []).filter((s: unknown) => typeof s === "string").slice(0, 8),
  })).filter((m: any) => m.definitions.length);
  if (!meanings.length) return null;
  return {
    word: String(first?.word || "").slice(0, 60),
    phonetic: String(first?.phonetic || phonetics.find((p) => p?.text)?.text || "").slice(0, 60),
    audio: safeUrl(phonetics.find((p) => typeof p?.audio === "string" && p.audio)?.audio),
    meanings,
  };
}

// ── Relationships ────────────────────────────────────────────────────────────

export const RELATIONSHIP_TOPICS: readonly { id: string; title: string; tips: string[] }[] = [
  { id: "talk", title: "Talking & listening", tips: [
    "Put the phone face down when your partner starts talking. Full attention says more than any reply.",
    "Try repeating back what you heard before you answer: \"So you felt left out when…\" It slows things down and shows you get it.",
    "Ask \"Do you want help fixing this, or do you just need me to listen?\" Both are fine. Guessing wrong causes trouble.",
    "Check in daily, even for ten minutes: the best and hardest part of each of your days.",
    "Share the small stuff. Little updates through the day build the closeness that big talks rely on.",
  ] },
  { id: "conflict", title: "Handling disagreements", tips: [
    "Start with \"I\" instead of \"you\": \"I felt worried when you were late\" lands softer than \"You're always late.\"",
    "Stick to one issue. Bringing up old fights turns a small problem into a big one.",
    "If either of you is too heated, call a 20-minute break and agree on when you'll come back to it.",
    "Look for the need under the complaint. \"You never help\" often means \"I'm tired and I need us to be a team.\"",
    "A repair attempt, like a joke, a touch or \"I'm sorry, that came out wrong,\" is worth accepting even mid-argument.",
    "You don't have to win. Ask what would make you both feel okay, then meet in the middle.",
  ] },
  { id: "appreciation", title: "Showing appreciation", tips: [
    "Say thank you for the everyday things: making coffee, taking out the trash, handling the bills.",
    "Notice what your partner does that no one sees, and say it out loud.",
    "Leave a note in a lunch box, a car or on the mirror. It takes ten seconds and lasts all day.",
    "Brag about your partner to someone else when they can hear it.",
    "Learn how they feel most loved: words, time together, help, touch or small gifts. Give love their way, not just yours.",
  ] },
  { id: "romance", title: "Keeping the spark", tips: [
    "Put a date on the calendar every week or two, even if it's dessert on the porch after bedtime.",
    "Try something new together. New experiences bring back that early-days feeling.",
    "Hold hands, hug for a full 20 seconds, kiss hello and goodbye. Small touches matter.",
    "Flirt by text in the middle of the day.",
    "Ask questions you don't know the answer to yet. People keep changing, so keep getting to know them.",
  ] },
  { id: "trust", title: "Trust & respect", tips: [
    "Do what you said you'd do. Trust is built from small promises kept.",
    "Be honest even when it's awkward. Small hidden things grow into big ones.",
    "Respect each other's alone time and friendships. Missing each other is healthy.",
    "Talk about money openly: what you earn, owe, spend and hope for.",
    "Never mock your partner in front of others, even as a joke they didn't laugh at.",
  ] },
  { id: "team", title: "Being a team at home", tips: [
    "Divide chores by what each of you actually doesn't mind doing, and revisit it when life changes.",
    "Back each other up in front of the kids, and work out disagreements privately.",
    "Hold a short weekly planning chat: the calendar, the money, who's covering what.",
    "Trade a free afternoon now and then, so each of you gets time to recharge.",
    "When one of you is struggling, the other carries a bit more. It evens out over time.",
  ] },
];

export const CONVERSATION_STARTERS: readonly string[] = [
  "What's something you've never told me?",
  "What's a memory of us you think about a lot?",
  "If we could live anywhere for a year, where would you pick?",
  "What's something I do that makes you feel loved?",
  "What's one thing you'd like us to do more of?",
  "What's a dream you've put on hold?",
  "What was the best part of your week?",
  "What's something you're worried about lately?",
  "What would your perfect Saturday look like?",
  "What's a habit of mine you secretly love?",
  "Where do you see us in five years?",
  "What's something new you'd like to learn together?",
  "What's the best advice anyone ever gave you?",
  "What did you want to be when you were little?",
  "What song always reminds you of us?",
  "What's one thing that would make your mornings easier?",
  "What's something you're proud of that you don't talk about?",
  "If we had a whole day with no responsibilities, what would we do?",
  "What's a tradition you'd like us to start?",
  "When did you first know you liked me?",
];

export const DATE_IDEAS: readonly { idea: string; kind: "home" | "out" | "free" }[] = [
  { idea: "Cook a new recipe together from a country neither of you has visited.", kind: "home" },
  { idea: "Build a blanket fort and watch the first movie you saw together.", kind: "home" },
  { idea: "Have a candlelit picnic on the living room floor.", kind: "home" },
  { idea: "Play a board game with a silly bet on the winner.", kind: "home" },
  { idea: "Make a playlist for each other and listen side by side.", kind: "home" },
  { idea: "Do a puzzle together with dessert and no phones.", kind: "home" },
  { idea: "Try a free online dance tutorial in the kitchen.", kind: "home" },
  { idea: "Go for a sunset walk somewhere you've never walked.", kind: "free" },
  { idea: "Stargaze from the backyard or a dark park with a blanket.", kind: "free" },
  { idea: "Visit a free museum day or local art walk.", kind: "free" },
  { idea: "Go on a hike and pack each other a surprise snack.", kind: "free" },
  { idea: "Wander a farmers market and cook dinner from what you find.", kind: "free" },
  { idea: "Read the same short story and talk about it over coffee.", kind: "free" },
  { idea: "Watch the sunrise together with something warm to drink.", kind: "free" },
  { idea: "Take a pottery, painting or cooking class.", kind: "out" },
  { idea: "Go bowling, mini golf or to an arcade.", kind: "out" },
  { idea: "Find a live music night at a local spot.", kind: "out" },
  { idea: "Recreate your first date.", kind: "out" },
  { idea: "Try a restaurant with food neither of you has had.", kind: "out" },
  { idea: "Go to a comedy show.", kind: "out" },
  { idea: "Rent bikes or a canoe for an afternoon.", kind: "out" },
  { idea: "Go ice skating or roller skating.", kind: "out" },
];

/** Every tip, for the tip of the day. */
export const ALL_TIPS: readonly string[] = RELATIONSHIP_TOPICS.flatMap((t) => t.tips);

// ── Shared date helpers ──────────────────────────────────────────────────────

export const addDaysTo = (date: string, n: number) => new Date(Date.parse(`${date}T12:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** Days in a row a habit was done, ending today (or yesterday, if today isn't checked yet). */
export function streak(days: readonly string[], today: string): number {
  const set = new Set(days);
  let d = set.has(today) ? today : addDaysTo(today, -1), n = 0;
  while (set.has(d)) { n++; d = addDaysTo(d, -1); }
  return n;
}

/** The next time a yearly date comes round, on or after today, and how old (or how many years) it will be. */
export function nextYearly(month: number, day: number, year: number, today: string): { date: string; days: number; turns: number | null } {
  const y = Number(today.slice(0, 4));
  const at = (yy: number) => {
    const last = new Date(Date.UTC(yy, month, 0)).getUTCDate(); // Feb 29 lands on Feb 28 in other years
    return `${yy}-${String(month).padStart(2, "0")}-${String(Math.min(day, last)).padStart(2, "0")}`;
  };
  let date = at(y);
  if (date < today) date = at(y + 1);
  const ny = Number(date.slice(0, 4));
  return { date, days: daysUntil(date, today), turns: year > 0 && year <= ny ? ny - year : null };
}

// ── Care (home upkeep, plants, car, pets) ────────────────────────────────────

/** When something is next due, and how far off that is (negative when overdue). */
export function careDue(item: { everyDays: number; lastDone: string }, today: string): { due: string; days: number } {
  if (!item.lastDone) return { due: today, days: 0 };
  const due = addDaysTo(item.lastDone, item.everyDays);
  return { due, days: daysUntil(due, today) };
}

export const CARE_PRESETS: Record<"upkeep" | "plants" | "car" | "pets" | "cleaning" | "checkups", { name: string; everyDays: number }[]> = {
  upkeep: [
    { name: "Change HVAC filter", everyDays: 90 }, { name: "Test smoke & CO alarms", everyDays: 30 }, { name: "Clean fridge coils", everyDays: 180 },
    { name: "Clean dryer vent", everyDays: 365 }, { name: "Clean gutters", everyDays: 180 }, { name: "Flush water heater", everyDays: 365 },
    { name: "Clean dishwasher filter", everyDays: 30 }, { name: "Replace water filter", everyDays: 60 }, { name: "Deep clean oven", everyDays: 90 },
    { name: "Check fire extinguisher", everyDays: 365 }, { name: "Wash bedding", everyDays: 7 }, { name: "Clean garbage disposal", everyDays: 14 },
  ],
  plants: [
    { name: "Water", everyDays: 7 }, { name: "Fertilize", everyDays: 30 }, { name: "Mist leaves", everyDays: 3 }, { name: "Rotate pot", everyDays: 14 }, { name: "Repot", everyDays: 365 },
  ],
  car: [
    { name: "Oil change", everyDays: 120 }, { name: "Rotate tires", everyDays: 180 }, { name: "Check tire pressure", everyDays: 30 }, { name: "Replace wiper blades", everyDays: 365 },
    { name: "Replace cabin air filter", everyDays: 365 }, { name: "Car wash", everyDays: 14 }, { name: "Registration renewal", everyDays: 365 }, { name: "Inspection", everyDays: 365 },
  ],
  cleaning: [
    { name: "Vacuum", everyDays: 7 }, { name: "Mop floors", everyDays: 14 }, { name: "Clean bathroom", everyDays: 7 }, { name: "Change sheets", everyDays: 7 },
    { name: "Dust", everyDays: 14 }, { name: "Wipe down kitchen", everyDays: 3 }, { name: "Clean out fridge", everyDays: 14 }, { name: "Take out recycling", everyDays: 7 },
    { name: "Clean windows", everyDays: 90 }, { name: "Wash towels", everyDays: 7 }, { name: "Clean microwave", everyDays: 14 },
  ],
  checkups: [
    { name: "Physical", everyDays: 365 }, { name: "Dental cleaning", everyDays: 182 }, { name: "Eye exam", everyDays: 365 }, { name: "Flu shot", everyDays: 365 },
    { name: "Skin check", everyDays: 365 }, { name: "Well-child visit", everyDays: 365 },
  ],
  pets: [
    { name: "Flea & tick medicine", everyDays: 30 }, { name: "Heartworm medicine", everyDays: 30 }, { name: "Vet checkup", everyDays: 365 }, { name: "Grooming", everyDays: 60 },
    { name: "Nail trim", everyDays: 21 }, { name: "Bath", everyDays: 30 }, { name: "Clean litter box (full change)", everyDays: 14 }, { name: "Buy food", everyDays: 30 },
  ],
};

// ── Subscriptions ────────────────────────────────────────────────────────────

/** What a subscription costs in an average month. */
export const monthlyCost = (s: { amount: number; cycle: "weekly" | "monthly" | "yearly" }) => s.cycle === "yearly" ? s.amount / 12 : s.cycle === "weekly" ? (s.amount * 52) / 12 : s.amount;

/** The next renewal on or after today, rolling an old date forward by its cycle. */
export function nextRenewal(s: { nextDate: string; cycle: "weekly" | "monthly" | "yearly" }, today: string): string {
  if (!s.nextDate) return "";
  let d = s.nextDate, guard = 0;
  while (d < today && guard++ < 600) {
    if (s.cycle === "weekly") d = addDaysTo(d, 7);
    else {
      const [y, m, dd] = d.split("-").map(Number);
      const months = s.cycle === "yearly" ? 12 : 1;
      const ny = y + Math.floor((m - 1 + months) / 12), nm = ((m - 1 + months) % 12) + 1;
      const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
      d = `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(dd, last)).padStart(2, "0")}`;
    }
  }
  return d;
}

// ── Lists with a status (reading, watchlist, bucket list, gifts) ─────────────

export const COLLECTIONS: Record<"reading" | "watchlist" | "bucket" | "gifts" | "wishlist" | "restaurants" | "learning" | "projects" | "loans", { statuses: { id: string; label: string }[]; subLabel: string; rated: boolean; priced: boolean; linked: boolean }> = {
  reading: { statuses: [{ id: "want", label: "Want to read" }, { id: "reading", label: "Reading" }, { id: "done", label: "Read" }], subLabel: "Author", rated: true, priced: false, linked: false },
  watchlist: { statuses: [{ id: "want", label: "To watch" }, { id: "watching", label: "Watching" }, { id: "done", label: "Watched" }], subLabel: "Movie, show, where to watch", rated: true, priced: false, linked: false },
  bucket: { statuses: [{ id: "want", label: "Someday" }, { id: "planned", label: "Planned" }, { id: "done", label: "Done" }], subLabel: "Category (travel, adventure, learn…)", rated: false, priced: false, linked: false },
  gifts: { statuses: [{ id: "want", label: "Idea" }, { id: "bought", label: "Bought" }, { id: "done", label: "Given" }], subLabel: "Who it's for", rated: false, priced: true, linked: true },
  wishlist: { statuses: [{ id: "want", label: "Want" }, { id: "saving", label: "Saving up" }, { id: "done", label: "Got it" }], subLabel: "Store or details", rated: false, priced: true, linked: true },
  restaurants: { statuses: [{ id: "want", label: "Want to try" }, { id: "done", label: "Tried" }], subLabel: "Food and where", rated: true, priced: false, linked: true },
  learning: { statuses: [{ id: "want", label: "Want to learn" }, { id: "learning", label: "Learning" }, { id: "done", label: "Learned" }], subLabel: "How (course, book, video…)", rated: false, priced: false, linked: true },
  projects: { statuses: [{ id: "want", label: "Ideas" }, { id: "doing", label: "In progress" }, { id: "done", label: "Done" }], subLabel: "Room or area", rated: false, priced: true, linked: false },
  loans: { statuses: [{ id: "want", label: "Lent out" }, { id: "done", label: "Returned" }], subLabel: "Who has it", rated: false, priced: false, linked: false },
};

// ── Weather (Open-Meteo) ─────────────────────────────────────────────────────

/** What a WMO weather code means, with an emoji. */
export function weatherCode(code: number): { text: string; icon: string } {
  if (code === 0) return { text: "Clear", icon: "☀️" };
  if (code === 1) return { text: "Mostly clear", icon: "🌤️" };
  if (code === 2) return { text: "Partly cloudy", icon: "⛅" };
  if (code === 3) return { text: "Cloudy", icon: "☁️" };
  if (code === 45 || code === 48) return { text: "Fog", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { text: "Drizzle", icon: "🌦️" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { text: code >= 80 ? "Showers" : "Rain", icon: "🌧️" };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { text: "Snow", icon: "🌨️" };
  if (code >= 95) return { text: "Thunderstorms", icon: "⛈️" };
  return { text: "—", icon: "🌡️" };
}

export type Forecast = {
  place: string;
  unit: "F" | "C";
  current: { temp: number; feels: number; code: number; wind: number; humidity: number };
  days: { date: string; code: number; high: number; low: number; rain: number }[];
};

/** Reads Open-Meteo's forecast answer. */
export function parseForecast(json: any, place: string, unit: "F" | "C"): Forecast | null {
  const c = json?.current, d = json?.daily;
  if (!c || !d || !Array.isArray(d.time)) return null;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : 0);
  return {
    place: place.slice(0, 120), unit,
    current: { temp: n(c.temperature_2m), feels: n(c.apparent_temperature), code: n(c.weather_code), wind: n(c.wind_speed_10m), humidity: n(c.relative_humidity_2m) },
    days: d.time.slice(0, 7).map((date: string, i: number) => ({ date: String(date).slice(0, 10), code: n(d.weather_code?.[i]), high: n(d.temperature_2m_max?.[i]), low: n(d.temperature_2m_min?.[i]), rain: n(d.precipitation_probability_max?.[i]) })),
  };
}

/** A place name safe to look up: letters, spaces and a few separators. */
export function cleanPlace(v: unknown): string {
  if (typeof v !== "string") return "";
  const p = v.trim().replace(/\s+/g, " ");
  return /^[\p{L}\p{M}0-9 .,'-]{2,80}$/u.test(p) ? p : "";
}

// ── Unit converter ───────────────────────────────────────────────────────────

/** Each unit's size in the group's base unit (temperature is handled on its own). */
export const UNITS: Record<string, Record<string, number>> = {
  Length: { Millimeters: 0.001, Centimeters: 0.01, Meters: 1, Kilometers: 1000, Inches: 0.0254, Feet: 0.3048, Yards: 0.9144, Miles: 1609.344 },
  Weight: { Grams: 1, Kilograms: 1000, Ounces: 28.349523125, Pounds: 453.59237, Stones: 6350.29318 },
  Cooking: { Teaspoons: 4.92892159375, Tablespoons: 14.78676478125, "Fluid ounces": 29.5735295625, Cups: 236.5882365, Pints: 473.176473, Quarts: 946.352946, Gallons: 3785.411784, Milliliters: 1, Liters: 1000 },
  Speed: { "Miles per hour": 0.44704, "Kilometers per hour": 0.2777777778, "Meters per second": 1, Knots: 0.5144444444 },
  Area: { "Square feet": 0.09290304, "Square meters": 1, Acres: 4046.8564224, Hectares: 10000, "Square miles": 2589988.110336 },
  Temperature: { Fahrenheit: 1, Celsius: 1, Kelvin: 1 },
};

export function convertUnit(group: string, value: number, from: string, to: string): number {
  if (group === "Temperature") {
    const c = from === "Celsius" ? value : from === "Fahrenheit" ? (value - 32) * 5 / 9 : value - 273.15;
    return to === "Celsius" ? c : to === "Fahrenheit" ? c * 9 / 5 + 32 : c + 273.15;
  }
  const g = UNITS[group];
  return g && g[from] && g[to] ? (value * g[from]) / g[to] : NaN;
}

// ── Recipes ──────────────────────────────────────────────────────────────────

/** An ingredient line as a grocery item: "2 cups flour" becomes qty "2 cups", name "flour". */
export function ingredientToGrocery(line: string): { qty: string; name: string } {
  const m = line.trim().match(/^((?:\d+[\d\/.\s-]*|½|¼|¾|⅓|⅔)\s*(?:cups?|c\.|tbsp|tablespoons?|tsp|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|kg|ml|l|liters?|cloves?|cans?|pinch(?:es)?|dash(?:es)?|slices?|sticks?|packages?|pkg|bunch(?:es)?|large|medium|small)?\.?)\s+(.+)$/i);
  return m ? { qty: m[1].trim().slice(0, 20), name: m[2].trim().slice(0, 80) } : { qty: "", name: line.trim().slice(0, 80) };
}

// ── Sleep, loans and clocks ──────────────────────────────────────────────────

/** Hours slept from bedtime to wake time ("23:15" to "06:45" is 7.5). */
export function sleepHours(bed: string, wake: string): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  let m = toMin(wake) - toMin(bed);
  if (m <= 0) m += 24 * 60;
  return Math.round((m / 60) * 10) / 10;
}

/** A loan's monthly payment, total paid and total interest (yearly rate in percent). */
export function loanPayment(principal: number, yearlyRate: number, years: number): { monthly: number; total: number; interest: number } {
  const n = Math.round(years * 12);
  if (principal <= 0 || n <= 0) return { monthly: 0, total: 0, interest: 0 };
  const r = yearlyRate / 100 / 12;
  const monthly = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  return { monthly, total: monthly * n, interest: monthly * n - principal };
}

export const CLOCK_ZONES: readonly { zone: string; label: string }[] = [
  { zone: "America/New_York", label: "New York" }, { zone: "America/Chicago", label: "Chicago" }, { zone: "America/Denver", label: "Denver" },
  { zone: "America/Phoenix", label: "Phoenix" }, { zone: "America/Los_Angeles", label: "Los Angeles" }, { zone: "America/Anchorage", label: "Anchorage" },
  { zone: "Pacific/Honolulu", label: "Honolulu" }, { zone: "America/Toronto", label: "Toronto" }, { zone: "America/Mexico_City", label: "Mexico City" },
  { zone: "America/Sao_Paulo", label: "São Paulo" }, { zone: "Europe/London", label: "London" }, { zone: "Europe/Paris", label: "Paris" },
  { zone: "Europe/Berlin", label: "Berlin" }, { zone: "Europe/Madrid", label: "Madrid" }, { zone: "Europe/Rome", label: "Rome" },
  { zone: "Africa/Lagos", label: "Lagos" }, { zone: "Africa/Johannesburg", label: "Johannesburg" }, { zone: "Asia/Dubai", label: "Dubai" },
  { zone: "Asia/Kolkata", label: "India" }, { zone: "Asia/Manila", label: "Manila" }, { zone: "Asia/Shanghai", label: "Beijing" },
  { zone: "Asia/Tokyo", label: "Tokyo" }, { zone: "Asia/Seoul", label: "Seoul" }, { zone: "Australia/Sydney", label: "Sydney" },
];
