// Extra educational question banks for the expanded A.R.I.S.E. Games library.
// These plug into the same server-authoritative multiplayer/CPU quiz engine as
// the original learning games, so every title is playable rather than a card-only placeholder.
import { rand, shuffle } from "./core";

export type ExtraChoiceQuestion = { q: string; options: string[]; correct: string };

const choose = <T,>(items: readonly T[]): T => items[rand(items.length)];
const mc = (q: string, correct: string, wrong: string[]): ExtraChoiceQuestion => ({
  q, correct, options: shuffle([correct, ...wrong]).slice(0, 4),
});
const fromRows = (rows: readonly (readonly [string, string, string, string, string])[]) => () => {
  const [q, correct, a, b, c] = choose(rows);
  return mc(q, correct, [a, b, c]);
};
const nums = (answer: number, choices: number[]) =>
  shuffle(Array.from(new Set([answer, ...choices])).slice(0, 4).map(String));

// ── Word-building / ELA ─────────────────────────────────────────────────────

const LETTER_FORGE = [
  ["Tiles: S T O N E R A · Which word can you build that uses the MOST tiles?", "STONE", "STAR", "TEN", "TO"],
  ["Tiles: C L O U D E R · Which word can you build that uses the MOST tiles?", "CLOUD", "COLD", "LOUD", "CODE"],
  ["Tiles: P L A N E T S · Which word can you build that uses the MOST tiles?", "PLANET", "PLANT", "LATE", "NET"],
  ["Tiles: B R I G H T E · Which word can you build that uses the MOST tiles?", "BRIGHT", "RIGHT", "BITE", "HER"],
  ["Tiles: F O R E S T A · Which word can you build that uses the MOST tiles?", "FOREST", "FORT", "REST", "SEA"],
  ["Tiles: S C H O O L R · Which word can you build that uses the MOST tiles?", "SCHOOL", "COOL", "SOLO", "ROCK"],
  ["Tiles: F R I E N D S · Which word can you build that uses the MOST tiles?", "FRIEND", "FIND", "RIDE", "RED"],
  ["Tiles: G A R D E N T · Which word can you build that uses the MOST tiles?", "GARDEN", "GRADE", "DEAR", "RAG"],
  ["Tiles: W I N T E R S · Which word can you build that uses the MOST tiles?", "WINTER", "WRITE", "TIRE", "WIN"],
  ["Tiles: M A G I C A L · Which word can you build that uses the MOST tiles?", "MAGIC", "CALM", "MAIL", "GAM"],
  ["Tiles: P I C T U R E · Which word can you build that uses the MOST tiles?", "PICTURE", "PRICE", "CUTE", "TIP"],
  ["Tiles: J O U R N E Y · Which word can you build that uses the MOST tiles?", "JOURNEY", "JUNE", "YOUR", "JOY"],
] as const;
const letterForge = fromRows(LETTER_FORGE);

const CONTEXT = [
  ["Maya was RELUCTANT to jump into the cold pool, so she waited by the edge. RELUCTANT means…", "not willing", "very excited", "already swimming", "extremely loud"],
  ["The old bridge was FRAGILE, so only one person crossed at a time. FRAGILE means…", "easy to break", "very colorful", "brand new", "hard to find"],
  ["Jordan was EXHAUSTED after running the mile. EXHAUSTED means…", "very tired", "confused", "hungry", "proud"],
  ["The puppy was CURIOUS and sniffed every new box. CURIOUS means…", "wanting to know more", "angry", "sleeping", "lost"],
  ["The class was SILENT during the surprise announcement. SILENT means…", "quiet", "crowded", "late", "excited"],
  ["The trail was STEEP, so we climbed slowly. STEEP means…", "sharply sloped", "flat", "muddy", "short"],
  ["The glass was TRANSPARENT, so we could see through it. TRANSPARENT means…", "clear", "heavy", "cracked", "blue"],
  ["Nia gave a BRIEF answer because the bell was about to ring. BRIEF means…", "short", "incorrect", "funny", "secret"],
  ["The storm was SEVERE, with strong winds and heavy rain. SEVERE means…", "very serious", "tiny", "finished", "warm"],
  ["The crowd began to APPLAUD after the performance. APPLAUD means…", "clap", "leave", "whisper", "argue"],
] as const;
const contextClues = fromRows(CONTEXT);

const ROOTS = [
  ["The prefix UN- usually means…", "not", "again", "before", "many"],
  ["The prefix RE- usually means…", "again", "not", "under", "without"],
  ["The prefix PRE- usually means…", "before", "after", "small", "against"],
  ["The suffix -LESS usually means…", "without", "full of", "able to", "one who"],
  ["The suffix -FUL usually means…", "full of", "without", "before", "small"],
  ["The root BIO means…", "life", "water", "earth", "sound"],
  ["The root GEO means…", "earth", "life", "light", "write"],
  ["The root AUD means…", "hear", "see", "carry", "build"],
  ["The root VIS/VID means…", "see", "hear", "write", "move"],
  ["The root PORT means…", "carry", "water", "time", "fire"],
] as const;
const rootsAffixes = fromRows(ROOTS);

const SYLLABLES = [
  ["How many syllables are in COMPUTER?", "3", "2", "4", "5"],
  ["How many syllables are in ELEPHANT?", "3", "2", "4", "1"],
  ["How many syllables are in LIBRARY?", "3", "2", "4", "5"],
  ["How many syllables are in RAINBOW?", "2", "1", "3", "4"],
  ["How many syllables are in ADVENTURE?", "3", "2", "4", "5"],
  ["How many syllables are in BANANA?", "3", "2", "4", "1"],
  ["How many syllables are in BASKETBALL?", "3", "2", "4", "1"],
  ["How many syllables are in DINOSAUR?", "3", "2", "4", "5"],
  ["How many syllables are in IMPORTANT?", "3", "2", "4", "1"],
  ["How many syllables are in CELEBRATE?", "3", "2", "4", "5"],
] as const;
const syllableSmash = fromRows(SYLLABLES);

const PARTS = [
  ["In 'The bright sun warmed us,' BRIGHT is a…", "adjective", "noun", "verb", "adverb"],
  ["In 'Dogs bark loudly,' BARK is a…", "verb", "noun", "adjective", "pronoun"],
  ["In 'She ran quickly,' QUICKLY is an…", "adverb", "adjective", "noun", "verb"],
  ["In 'The teacher smiled,' TEACHER is a…", "noun", "verb", "adverb", "preposition"],
  ["In 'We walked under the bridge,' UNDER is a…", "preposition", "verb", "pronoun", "adjective"],
  ["In 'They won the game,' THEY is a…", "pronoun", "noun", "verb", "adverb"],
  ["In 'I ate pizza and salad,' AND is a…", "conjunction", "noun", "adjective", "preposition"],
  ["In 'The cat slept peacefully,' PEACEFULLY is an…", "adverb", "noun", "verb", "adjective"],
  ["In 'A huge wave crashed,' HUGE is an…", "adjective", "verb", "pronoun", "adverb"],
  ["In 'Birds fly south,' FLY is a…", "verb", "noun", "adjective", "conjunction"],
] as const;
const partsSpeech = fromRows(PARTS);

const FIGURATIVE = [
  ["'The classroom was a zoo.' This is a…", "metaphor", "simile", "hyperbole", "personification"],
  ["'He ran like the wind.' This is a…", "simile", "metaphor", "idiom", "alliteration"],
  ["'The sun smiled down on us.' This is…", "personification", "simile", "hyperbole", "onomatopoeia"],
  ["'I've told you a million times.' This is…", "hyperbole", "metaphor", "simile", "personification"],
  ["'The bacon sizzled: ssssss.' This uses…", "onomatopoeia", "metaphor", "idiom", "hyperbole"],
  ["'Busy bees buzzed by.' This uses…", "alliteration", "simile", "metaphor", "personification"],
  ["'Break a leg!' is an example of an…", "idiom", "simile", "hyperbole", "alliteration"],
  ["'Her smile was sunshine.' This is a…", "metaphor", "simile", "idiom", "onomatopoeia"],
  ["'The leaves danced in the wind.' This is…", "personification", "hyperbole", "simile", "alliteration"],
  ["'As cold as ice.' This is a…", "simile", "metaphor", "idiom", "personification"],
] as const;
const figurativeLanguage = fromRows(FIGURATIVE);

const READING = [
  ["Kai packed an umbrella before leaving. Dark clouds filled the sky. What can you infer?", "It may rain", "It is snowing", "Kai is going swimming", "It is midnight"],
  ["Lena kept rereading the same paragraph and rubbing her eyes. What can you infer?", "She is tired or having trouble focusing", "She finished the book", "She is cooking", "She lost the book"],
  ["The dog scratched at the door and wagged its tail when Sam picked up the leash. What does the dog want?", "To go outside", "To eat", "To sleep", "To hide"],
  ["Ari placed the ice cream back in the freezer because it was getting soft. Why?", "To keep it frozen", "To make it warmer", "To wash it", "To share it"],
  ["The scoreboard showed 52–51 with two seconds left. The crowd stood up. Why?", "The game is very close", "The game is over by a lot", "The lights are off", "Everyone is leaving"],
  ["Mina whispered because the baby had just fallen asleep. Why did she whisper?", "To avoid waking the baby", "She forgot how to talk", "She was outside", "She was singing"],
  ["The sidewalk was shiny and people carried umbrellas. What probably happened?", "It rained", "It snowed heavily", "There was a fire", "The power went out"],
  ["DeShawn checked the recipe twice before adding salt. What trait does this show?", "Careful", "Careless", "Angry", "Lazy"],
  ["The library sign said CLOSED, and the doors were locked. What should you conclude?", "The library is not open now", "The library has no books", "It is a school", "Everyone is inside"],
  ["A plant leaned toward the window after several days. What was it likely seeking?", "Light", "Noise", "Cold air", "Music"],
] as const;
const readingDetective = fromRows(READING);

const SEQUENCE = [
  ["First: mix batter. Next: pour it in a pan. What comes LAST?", "Bake it", "Buy flour", "Crack eggs first", "Wash the pan before mixing"],
  ["Seed → sprout → young plant → ?", "mature plant", "seed", "soil", "rain cloud"],
  ["Wake up → get dressed → eat breakfast → ?", "go to school", "go to sleep", "take a bath at night", "eat dinner"],
  ["Draft → revise → edit → ?", "publish", "brainstorm", "erase everything", "skip the title"],
  ["Egg → caterpillar → chrysalis → ?", "butterfly", "tadpole", "kitten", "seed"],
  ["Plan route → pack bag → travel → ?", "arrive", "wake up", "buy a map after", "forget the trip"],
  ["Question → research → evidence → ?", "conclusion", "guess", "erase notes", "start over"],
  ["Preheat oven → prepare food → cook → ?", "serve", "freeze raw food", "buy an oven", "preheat again"],
  ["Read directions → gather materials → do steps → ?", "check your work", "ignore the result", "throw materials away first", "skip directions"],
  ["Choose book → read → take quiz → ?", "see your result", "pick a book before choosing", "close the library", "erase the book"],
] as const;
const sequenceStory = fromRows(SEQUENCE);

const ANALOGIES = [
  ["Bird is to NEST as bee is to…", "hive", "web", "den", "pond"],
  ["Book is to READ as music is to…", "listen", "draw", "throw", "measure"],
  ["Hot is to COLD as fast is to…", "slow", "quick", "speed", "run"],
  ["Puppy is to DOG as kitten is to…", "cat", "lion", "mouse", "rabbit"],
  ["Finger is to HAND as toe is to…", "foot", "leg", "arm", "head"],
  ["Teacher is to SCHOOL as doctor is to…", "hospital", "library", "garage", "stadium"],
  ["Knife is to CUT as pencil is to…", "write", "eat", "drive", "jump"],
  ["Author is to BOOK as director is to…", "movie", "song", "painting", "meal"],
  ["Hour is to TIME as inch is to…", "length", "weight", "sound", "temperature"],
  ["Calf is to COW as foal is to…", "horse", "sheep", "pig", "goat"],
] as const;
const analogyArena = fromRows(ANALOGIES);

const HOMOPHONES = [
  ["Choose the right word: '___ going to the park.'", "They're", "Their", "There", "Thair"],
  ["Choose the right word: 'Put the books over ___.'", "there", "their", "they're", "thair"],
  ["Choose the right word: 'That is ___ backpack.'", "their", "there", "they're", "thare"],
  ["Choose the right word: 'I ___ the answer.'", "know", "no", "now", "knoe"],
  ["Choose the right word: 'We ate ___ pieces.'", "two", "to", "too", "tow"],
  ["Choose the right word: 'I want to come, ___.'", "too", "two", "to", "tow"],
  ["Choose the right word: 'The dog wagged ___ tail.'", "its", "it's", "its'", "it is"],
  ["Choose the right word: '___ raining outside.'", "It's", "Its", "Its'", "It"],
  ["Choose the right word: 'Can you ___ the music?'", "hear", "here", "hair", "heer"],
  ["Choose the right word: 'Come over ___.'", "here", "hear", "hair", "heer"],
] as const;
const homophoneHunt = fromRows(HOMOPHONES);

// ── Math ────────────────────────────────────────────────────────────────────

function multiplication(): ExtraChoiceQuestion {
  const a = 2 + rand(11), b = 2 + rand(11), ans = a * b;
  return { q: a + " × " + b + " = ?", correct: String(ans), options: nums(ans, [ans + a, ans - a, ans + b, Math.max(0, ans - b)]) };
}

function fraction(): ExtraChoiceQuestion {
  const sets = [
    ["Which fraction is equal to 1/2?", "3/6", "2/3", "1/3", "4/5"],
    ["Which fraction is larger?", "3/4", "2/4", "1/4", "1/2"],
    ["1/4 + 1/4 = ?", "1/2", "1/4", "2/8", "3/4"],
    ["2/3 + 1/3 = ?", "1", "2/6", "3/6", "2/3"],
    ["What is half of 10?", "5", "2", "10", "20"],
    ["Which fraction means three out of eight?", "3/8", "8/3", "3/5", "5/8"],
    ["Which fraction is closest to 1?", "7/8", "1/8", "2/8", "3/8"],
    ["4/4 equals…", "1", "0", "4", "1/4"],
    ["Which is equivalent to 2/4?", "1/2", "1/4", "2/3", "3/4"],
    ["1/5 + 2/5 = ?", "3/5", "3/10", "2/5", "1/5"],
  ] as const;
  const [q,c,a,b,d] = choose(sets); return mc(q,c,[a,b,d]);
}

function decimal(): ExtraChoiceQuestion {
  const sets = [
    ["0.5 is the same as…", "1/2", "1/4", "5/100", "2"],
    ["0.25 is the same as…", "1/4", "1/2", "3/4", "25"],
    ["Which decimal is greatest?", "0.9", "0.09", "0.19", "0.29"],
    ["0.4 + 0.3 = ?", "0.7", "0.43", "0.1", "7.0"],
    ["1.2 + 0.5 = ?", "1.7", "1.25", "0.7", "2.5"],
    ["2.0 − 0.6 = ?", "1.4", "1.6", "2.6", "0.14"],
    ["Which is smallest?", "0.08", "0.8", "0.18", "0.28"],
    ["0.75 is the same as…", "3/4", "1/4", "1/2", "75"],
    ["$1.50 + $0.25 = ?", "$1.75", "$1.55", "$1.25", "$2.75"],
    ["3.6 rounded to the nearest whole number is…", "4", "3", "3.5", "36"],
  ] as const;
  const [q,c,a,b,d] = choose(sets); return mc(q,c,[a,b,d]);
}

const GEOMETRY = [
  ["A triangle has how many sides?", "3", "4", "5", "6"],
  ["A rectangle has how many right angles?", "4", "2", "3", "0"],
  ["A shape with 8 sides is an…", "octagon", "hexagon", "pentagon", "triangle"],
  ["A shape with 6 sides is a…", "hexagon", "octagon", "pentagon", "square"],
  ["Perimeter means…", "distance around a shape", "space inside a shape", "height only", "number of corners"],
  ["Area means…", "space inside a flat shape", "distance around", "number of sides", "weight"],
  ["A right angle measures…", "90°", "45°", "180°", "360°"],
  ["A square has sides that are…", "all equal", "all different", "curved", "three only"],
  ["A circle has how many vertices?", "0", "1", "2", "4"],
  ["A pentagon has how many sides?", "5", "4", "6", "8"],
] as const;
const geometryGrid = fromRows(GEOMETRY);

function moneyMath(): ExtraChoiceQuestion {
  const sets = [
    ["You have $5.00 and spend $2.25. How much is left?", "$2.75", "$3.25", "$2.25", "$7.25"],
    ["Two quarters equal…", "$0.50", "$0.25", "$0.75", "$1.00"],
    ["10 dimes equal…", "$1.00", "$0.10", "$10.00", "$0.50"],
    ["A $3 item paid with $5 gives how much change?", "$2", "$1", "$3", "$8"],
    ["Four quarters equal…", "$1.00", "$0.40", "$0.25", "$4.00"],
    ["A book costs $7 and a pen costs $2. Total?", "$9", "$5", "$14", "$72"],
    ["Three $1 bills and two quarters equal…", "$3.50", "$3.25", "$2.50", "$5.00"],
    ["You need $10 and have $6. How much more?", "$4", "$16", "$6", "$5"],
    ["$2.50 + $2.50 = ?", "$5.00", "$4.00", "$2.25", "$25.00"],
    ["Which amount is greatest?", "$4.75", "$4.57", "$4.07", "$4.70"],
  ] as const;
  const [q,c,a,b,d] = choose(sets); return mc(q,c,[a,b,d]);
}

const TIME = [
  ["30 minutes after 2:15 is…", "2:45", "2:30", "3:15", "1:45"],
  ["60 minutes after 4:20 is…", "5:20", "4:80", "5:00", "3:20"],
  ["15 minutes before 9:00 is…", "8:45", "8:15", "9:15", "7:45"],
  ["Half an hour equals…", "30 minutes", "15 minutes", "45 minutes", "60 minutes"],
  ["A quarter hour equals…", "15 minutes", "25 minutes", "30 minutes", "10 minutes"],
  ["From 1:00 to 3:30 is…", "2 hours 30 minutes", "3 hours 30 minutes", "1 hour 30 minutes", "2 hours"],
  ["90 minutes equals…", "1 hour 30 minutes", "2 hours", "1 hour", "90 hours"],
  ["45 minutes after 6:10 is…", "6:55", "6:45", "7:05", "5:55"],
  ["20 minutes before 5:00 is…", "4:40", "4:20", "5:20", "3:40"],
  ["From 7:15 to 8:00 is…", "45 minutes", "35 minutes", "55 minutes", "1 hour 15 minutes"],
] as const;
const timeTrial = fromRows(TIME);

function estimation(): ExtraChoiceQuestion {
  const sets = [
    ["About how much is 48 + 51?", "100", "50", "150", "10"],
    ["About how much is 198 + 205?", "400", "200", "600", "40"],
    ["About how much is 72 − 29?", "40", "100", "20", "70"],
    ["About how much is 19 × 5?", "100", "50", "200", "25"],
    ["About how much is 398 ÷ 4?", "100", "40", "200", "10"],
    ["Which is the best estimate for 1,021 + 987?", "2,000", "1,000", "3,000", "200"],
    ["About how much is 249 + 260?", "500", "250", "750", "50"],
    ["About how much is 88 + 112?", "200", "100", "300", "20"],
    ["About how much is 610 − 295?", "300", "600", "100", "900"],
    ["About how much is 49 × 2?", "100", "50", "150", "20"],
  ] as const;
  const [q,c,a,b,d] = choose(sets); return mc(q,c,[a,b,d]);
}

// ── Science / social studies ─────────────────────────────────────────────────

const SCIENCE_LAB = [
  ["Which state of matter has a fixed shape?", "solid", "liquid", "gas", "plasma only"],
  ["Evaporation changes liquid water into…", "water vapor", "ice", "rock", "soil"],
  ["Plants release which gas during photosynthesis?", "oxygen", "nitrogen", "helium", "hydrogen"],
  ["The force that pulls objects toward Earth is…", "gravity", "friction", "electricity", "sound"],
  ["Which organ pumps blood?", "heart", "lungs", "stomach", "brain"],
  ["Earth travels around the Sun in about…", "1 year", "1 day", "1 week", "10 years"],
  ["A food chain usually begins with…", "a producer", "a predator", "a decomposer only", "a consumer"],
  ["Which simple machine is a ramp?", "inclined plane", "pulley", "wheel and axle", "lever"],
  ["The boiling point of water is 100°C. This is a…", "physical property", "planet", "food chain", "weather map"],
  ["Which material is a conductor of electricity?", "copper", "rubber", "plastic", "dry wood"],
] as const;
const scienceLab = fromRows(SCIENCE_LAB);

const STATES = [
  ["Capital of Colorado?", "Denver", "Boulder", "Aurora", "Pueblo"],
  ["Capital of Florida?", "Tallahassee", "Miami", "Orlando", "Tampa"],
  ["Capital of Texas?", "Austin", "Dallas", "Houston", "San Antonio"],
  ["Capital of California?", "Sacramento", "Los Angeles", "San Diego", "San Francisco"],
  ["Capital of New York?", "Albany", "New York City", "Buffalo", "Rochester"],
  ["Capital of Georgia?", "Atlanta", "Savannah", "Augusta", "Macon"],
  ["Capital of Tennessee?", "Nashville", "Memphis", "Knoxville", "Chattanooga"],
  ["Capital of Kentucky?", "Frankfort", "Louisville", "Lexington", "Bowling Green"],
  ["Capital of Arizona?", "Phoenix", "Tucson", "Mesa", "Flagstaff"],
  ["Capital of Illinois?", "Springfield", "Chicago", "Peoria", "Rockford"],
] as const;
const statesCapitals = fromRows(STATES);

const HISTORY = [
  ["The U.S. Declaration of Independence was adopted in…", "1776", "1492", "1865", "1914"],
  ["Who was the first U.S. president?", "George Washington", "Abraham Lincoln", "Thomas Edison", "Martin Luther King Jr."],
  ["The Civil War ended in…", "1865", "1776", "1918", "1945"],
  ["The 19th Amendment is associated with…", "women's voting rights", "ending the Civil War", "creating the Supreme Court", "buying Alaska"],
  ["The Great Depression began after the stock market crash of…", "1929", "1776", "1865", "2001"],
  ["World War II ended in…", "1945", "1914", "1929", "1969"],
  ["The Montgomery Bus Boycott is linked to…", "the Civil Rights Movement", "the Gold Rush", "the Moon landing", "the Revolutionary War"],
  ["The first humans landed on the Moon in…", "1969", "1945", "1776", "2000"],
  ["The U.S. Constitution begins with the words…", "We the People", "Four score", "I have a dream", "Give me liberty"],
  ["The Louisiana Purchase happened in…", "1803", "1776", "1865", "1918"],
] as const;
const historyHustle = fromRows(HISTORY);

export const EXTRA_QUESTION_MAKERS: Record<string, () => ExtraChoiceQuestion> = {
  letter_forge: letterForge,
  context_clues: contextClues,
  roots_affixes: rootsAffixes,
  syllable_smash: syllableSmash,
  parts_speech: partsSpeech,
  figurative_language: figurativeLanguage,
  reading_detective: readingDetective,
  sequence_story: sequenceStory,
  analogy_arena: analogyArena,
  homophone_hunt: homophoneHunt,
  multiplication_mayhem: multiplication,
  fraction_frenzy: fraction,
  decimal_dash: decimal,
  geometry_grid: geometryGrid,
  money_math: moneyMath,
  time_trial: timeTrial,
  estimation_station: estimation,
  science_lab: scienceLab,
  states_capitals: statesCapitals,
  history_hustle: historyHustle,
};
