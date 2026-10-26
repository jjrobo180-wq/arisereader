// Browse by subject (Earshot and Podscroll → Explore): a subject (History) holds topics (World War II),
// and each topic is a ready-made playlist of real episodes found in Apple Podcasts by its search terms
// (server/earshot.ts → /topic/:id). Add a topic by adding a line here; nothing else needs changing.

export type Topic = {
  /** Unique across all subjects, lowercase letters/numbers/dashes. */
  id: string;
  name: string;
  /** What to search Apple for. The first term is searched first; later ones top up a thin playlist. */
  terms: string[];
};

export type Subject = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  /** Shown to student accounts. */
  kidSafe: boolean;
  topics: Topic[];
};

export const SUBJECTS: readonly Subject[] = [
  {
    id: "history", name: "History", emoji: "🏛️", color: "#92400e", kidSafe: true,
    topics: [
      { id: "ww2", name: "World War II", terms: ["world war II", "WW2 history", "D-Day"] },
      { id: "ww1", name: "World War I", terms: ["world war I", "WW1 history", "great war"] },
      { id: "civil-war", name: "American Civil War", terms: ["american civil war", "civil war history", "Gettysburg"] },
      { id: "revolution", name: "American Revolution", terms: ["american revolution", "founding fathers history", "revolutionary war"] },
      { id: "ancient-rome", name: "Ancient Rome", terms: ["ancient rome", "roman empire history", "julius caesar"] },
      { id: "ancient-greece", name: "Ancient Greece", terms: ["ancient greece", "greek history", "athens sparta"] },
      { id: "ancient-egypt", name: "Ancient Egypt", terms: ["ancient egypt", "pharaohs history", "pyramids history"] },
      { id: "middle-ages", name: "Middle Ages", terms: ["medieval history", "middle ages", "knights castles history"] },
      { id: "vikings", name: "Vikings", terms: ["vikings history", "norse history"] },
      { id: "cold-war", name: "Cold War", terms: ["cold war history", "cuban missile crisis", "berlin wall history"] },
      { id: "space-race", name: "The Space Race", terms: ["space race history", "apollo moon landing history"] },
      { id: "civil-rights", name: "Civil Rights Movement", terms: ["civil rights movement history", "martin luther king history"] },
      { id: "black-history", name: "Black History", terms: ["black history", "african american history"] },
      { id: "women-history", name: "Women in History", terms: ["women in history", "women's history"] },
      { id: "presidents", name: "U.S. Presidents", terms: ["presidential history", "american presidents history"] },
      { id: "pirates", name: "Pirates & Explorers", terms: ["pirates history", "age of exploration history"] },
    ],
  },
  {
    id: "science", name: "Science", emoji: "🔬", color: "#0e7490", kidSafe: true,
    topics: [
      { id: "space", name: "Space & Astronomy", terms: ["astronomy", "space exploration", "black holes"] },
      { id: "dinosaurs", name: "Dinosaurs", terms: ["dinosaurs", "paleontology"] },
      { id: "human-body", name: "The Human Body", terms: ["human body science", "how the brain works"] },
      { id: "oceans", name: "Oceans", terms: ["ocean science", "deep sea creatures"] },
      { id: "climate", name: "Climate & Weather", terms: ["climate science", "weather science"] },
      { id: "physics", name: "Physics", terms: ["physics explained", "quantum physics"] },
      { id: "inventions", name: "Inventions", terms: ["history of inventions", "inventors stories"] },
      { id: "animals", name: "Animals", terms: ["animal science", "wildlife"] },
    ],
  },
  {
    id: "tech", name: "Technology", emoji: "💻", color: "#4338ca", kidSafe: true,
    topics: [
      { id: "ai", name: "Artificial Intelligence", terms: ["artificial intelligence", "AI explained"] },
      { id: "coding", name: "Learning to Code", terms: ["learn to code", "programming for beginners"] },
      { id: "video-game-history", name: "Video Game History", terms: ["video game history", "history of nintendo"] },
      { id: "startups", name: "Startups", terms: ["startup stories", "how i built this"] },
      { id: "cybersecurity", name: "Cybersecurity", terms: ["cybersecurity", "hackers stories"] },
    ],
  },
  {
    id: "money", name: "Money & Business", emoji: "💰", color: "#166534", kidSafe: true,
    topics: [
      { id: "personal-finance", name: "Personal Finance", terms: ["personal finance", "budgeting money"] },
      { id: "investing", name: "Investing", terms: ["investing for beginners", "stock market explained"] },
      { id: "entrepreneurs", name: "Entrepreneurs", terms: ["entrepreneur stories", "small business"] },
      { id: "economics", name: "Economics", terms: ["economics explained", "freakonomics"] },
      { id: "real-estate", name: "Real Estate", terms: ["real estate investing", "buying a home"] },
    ],
  },
  {
    id: "sports", name: "Sports", emoji: "🏀", color: "#b91c1c", kidSafe: true,
    topics: [
      { id: "nba", name: "Basketball / NBA", terms: ["nba", "basketball"] },
      { id: "nfl", name: "Football / NFL", terms: ["nfl", "football"] },
      { id: "soccer", name: "Soccer", terms: ["soccer", "premier league"] },
      { id: "baseball", name: "Baseball", terms: ["baseball", "mlb"] },
      { id: "sports-history", name: "Sports History", terms: ["sports history", "greatest athletes stories"] },
      { id: "olympics", name: "Olympics", terms: ["olympics", "olympic athletes"] },
    ],
  },
  {
    id: "arts", name: "Arts & Culture", emoji: "🎨", color: "#c026d3", kidSafe: true,
    topics: [
      { id: "music-history", name: "Music History", terms: ["music history", "history of hip hop", "history of rock"] },
      { id: "movies", name: "Movies", terms: ["film history", "movie reviews"] },
      { id: "books-lit", name: "Books & Literature", terms: ["book discussion", "classic literature"] },
      { id: "art-history", name: "Art History", terms: ["art history", "famous painters"] },
      { id: "mythology", name: "Mythology", terms: ["mythology", "greek mythology", "norse mythology"] },
      { id: "food-culture", name: "Food & Cooking", terms: ["food history", "cooking"] },
    ],
  },
  {
    id: "learning", name: "Learning", emoji: "📚", color: "#2563eb", kidSafe: true,
    topics: [
      { id: "languages", name: "Learning Languages", terms: ["learn spanish", "language learning"] },
      { id: "philosophy", name: "Philosophy", terms: ["philosophy", "philosophy explained"] },
      { id: "psychology", name: "Psychology", terms: ["psychology", "how the mind works"] },
      { id: "geography", name: "Geography & Travel", terms: ["geography", "countries of the world"] },
      { id: "math", name: "Math", terms: ["math podcast", "mathematics explained"] },
      { id: "stories-kids", name: "Stories for Kids", terms: ["stories for kids", "kids bedtime stories"] },
    ],
  },
  {
    id: "wellbeing", name: "Health & Self", emoji: "🧘", color: "#7c3aed", kidSafe: false,
    topics: [
      { id: "fitness", name: "Fitness", terms: ["fitness", "strength training"] },
      { id: "nutrition", name: "Nutrition", terms: ["nutrition", "healthy eating"] },
      { id: "sleep", name: "Sleep", terms: ["sleep science", "better sleep"] },
      { id: "mental-health", name: "Mental Health", terms: ["mental health", "anxiety help"] },
      { id: "productivity", name: "Productivity", terms: ["productivity", "habits"] },
      { id: "parenting-topic", name: "Parenting", terms: ["parenting", "raising kids"] },
    ],
  },
  {
    id: "mystery", name: "Mystery & Crime", emoji: "🕵️", color: "#7f1d1d", kidSafe: false,
    topics: [
      { id: "unsolved", name: "Unsolved Mysteries", terms: ["unsolved mysteries", "cold case"] },
      { id: "heists", name: "Heists & Scams", terms: ["heist stories", "con artists scams"] },
      { id: "conspiracies", name: "Conspiracy Theories", terms: ["conspiracy theories explained"] },
      { id: "paranormal", name: "Paranormal", terms: ["paranormal stories", "ghost stories"] },
    ],
  },
];

export const TOPICS: Record<string, Topic & { subject: Subject }> = Object.fromEntries(
  SUBJECTS.flatMap((s) => s.topics.map((t) => [t.id, { ...t, subject: s }])),
);

/** Subjects a student account may browse. */
export const subjectsFor = (student: boolean) => SUBJECTS.filter((s) => !student || s.kidSafe);

/**
 * Turns episode search results into a playlist: no repeats, at most `perShow` episodes from any one
 * show (so one prolific podcast doesn't fill it), Apple's order otherwise.
 */
export function topicPlaylist<E extends { id: string; showId: string; secs: number; title: string }>(batches: E[][], max = 40, perShow = 3): E[] {
  const seen = new Set<string>(); const perShowCount = new Map<string, number>(); const out: E[] = [];
  for (const batch of batches) for (const e of batch) {
    if (out.length >= max) return out;
    if (!e?.id || seen.has(e.id)) continue;
    // trailers and teasers aren't worth a playlist slot
    if (e.secs > 0 && e.secs < 180) continue;
    const n = perShowCount.get(e.showId) ?? 0;
    if (n >= perShow) continue;
    seen.add(e.id); perShowCount.set(e.showId, n + 1); out.push(e);
  }
  return out;
}
