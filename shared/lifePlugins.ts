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
