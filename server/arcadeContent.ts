// A.R.I.S.E Arcade — fresh, randomized rounds for every match and a fair computer opponent.

export type ChoiceQuestion = { q: string; options: string[]; correct: string };

const rand = (n: number) => Math.floor(Math.random() * n);
const between = (lo: number, hi: number) => lo + rand(hi - lo + 1);
export function shuffle<T>(list: T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) { const j = rand(i + 1); const t = out[i]; out[i] = out[j]; out[j] = t; }
  return out;
}
function pickN<T>(list: T[], n: number): T[] { return shuffle(list).slice(0, n); }

function numberOptions(answer: number, spread: number[]): string[] {
  const set = new Set<number>([answer]);
  for (const d of shuffle(spread)) { if (set.size >= 4) break; const v = answer + d; if (v >= 0) set.add(v); }
  let k = 1;
  while (set.size < 4) { set.add(answer + k * 3 + 1); k++; }
  return shuffle(Array.from(set).map(String));
}

function mathQuestion(): ChoiceQuestion {
  const kind = rand(5);
  let q = "", a = 0;
  if (kind === 0) { const x = between(12, 89), y = between(11, 79); q = `${x} + ${y} = ?`; a = x + y; }
  else if (kind === 1) { const x = between(40, 140), y = between(11, x - 5); q = `${x} − ${y} = ?`; a = x - y; }
  else if (kind === 2) { const x = between(3, 12), y = between(3, 12); q = `${x} × ${y} = ?`; a = x * y; }
  else if (kind === 3) { const y = between(3, 12), a0 = between(3, 12); q = `${y * a0} ÷ ${y} = ?`; a = a0; }
  else { const x = between(2, 9), y = between(2, 9), z = between(2, 20); q = `${x} × ${y} + ${z} = ?`; a = x * y + z; }
  return { q, options: numberOptions(a, [-10, -2, -1, 1, 2, 10, 5, -5]), correct: String(a) };
}

function patternQuestion(): ChoiceQuestion {
  const kind = rand(5);
  let seq: number[] = [];
  if (kind === 0) { const s = between(1, 20), d = between(2, 9); seq = [0, 1, 2, 3, 4].map(i => s + i * d); }
  else if (kind === 1) { const s = between(60, 120), d = between(3, 12); seq = [0, 1, 2, 3, 4].map(i => s - i * d); }
  else if (kind === 2) { const s = between(1, 4), m = between(2, 3); seq = [0, 1, 2, 3, 4].map(i => s * Math.pow(m, i)); }
  else if (kind === 3) { const s = between(1, 5); seq = [0, 1, 2, 3, 4].map(i => (s + i) * (s + i)); }
  else { const s = between(1, 10), a = between(2, 6), b = between(7, 12); seq = [s]; for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + (i % 2 ? a : b)); }
  const answer = seq[4];
  return { q: seq.slice(0, 4).join(", ") + ", ?", options: numberOptions(answer, [-3, -2, -1, 1, 2, 3, 4, -4]), correct: String(answer) };
}

// [word, same-meaning, ...three that do not match]
const SYNONYMS: string[][] = [
  ["HAPPY", "Glad", "Angry", "Slow", "Tired"], ["QUICK", "Fast", "Quiet", "Heavy", "Late"], ["BEGIN", "Start", "Finish", "Hide", "Lose"],
  ["TINY", "Small", "Huge", "Loud", "Tall"], ["BIG", "Large", "Thin", "Soft", "Short"], ["SAD", "Unhappy", "Proud", "Funny", "Brave"],
  ["SMART", "Clever", "Messy", "Lazy", "Cold"], ["SHOUT", "Yell", "Whisper", "Sleep", "Sit"], ["CLOSE", "Shut", "Open", "Lift", "Push"],
  ["ANGRY", "Mad", "Calm", "Kind", "Shy"], ["BRAVE", "Fearless", "Scared", "Sleepy", "Silly"], ["FUNNY", "Silly", "Serious", "Sour", "Dull"],
  ["GIFT", "Present", "Problem", "Pencil", "Puzzle"], ["SCARED", "Afraid", "Bold", "Bored", "Busy"], ["SHINY", "Bright", "Dark", "Rough", "Wet"],
  ["RICH", "Wealthy", "Poor", "Empty", "Plain"], ["STRANGE", "Odd", "Normal", "Tidy", "Neat"], ["BUILD", "Make", "Break", "Throw", "Spill"],
  ["CHILLY", "Cold", "Hot", "Sticky", "Bumpy"], ["ENORMOUS", "Gigantic", "Tiny", "Narrow", "Sharp"], ["GRAB", "Snatch", "Drop", "Wave", "Blink"],
  ["QUIET", "Silent", "Noisy", "Bright", "Spicy"], ["WEARY", "Tired", "Lively", "Hungry", "Proud"], ["NEAT", "Tidy", "Messy", "Loud", "Wild"],
  ["JOURNEY", "Trip", "Nap", "Meal", "Song"], ["MISTAKE", "Error", "Prize", "Plan", "Guess"], ["LISTEN", "Hear", "Shout", "Taste", "Forget"],
  ["DIFFICULT", "Hard", "Easy", "Soft", "Short"], ["COURAGE", "Bravery", "Fear", "Anger", "Sadness"], ["GENTLE", "Soft", "Rough", "Fierce", "Loud"],
];
const ANTONYMS: string[][] = [
  ["HOT", "Cold", "Warm", "Sunny", "Bright"], ["UP", "Down", "Over", "High", "Top"], ["FULL", "Empty", "Heavy", "Round", "Big"],
  ["EARLY", "Late", "Soon", "First", "Quick"], ["LOUD", "Quiet", "Noisy", "Strong", "Bright"], ["WIN", "Lose", "Play", "Score", "Try"],
  ["LIGHT", "Dark", "Bright", "Shiny", "Clear"], ["ASLEEP", "Awake", "Tired", "Dreamy", "Lazy"], ["FRIEND", "Enemy", "Buddy", "Pal", "Partner"],
  ["ANCIENT", "Modern", "Old", "Dusty", "Broken"], ["SHALLOW", "Deep", "Low", "Wet", "Narrow"], ["ARRIVE", "Leave", "Come", "Reach", "Enter"],
];
function vocabQuestion(): ChoiceQuestion {
  const antonym = Math.random() < 0.3;
  const row = antonym ? ANTONYMS[rand(ANTONYMS.length)] : SYNONYMS[rand(SYNONYMS.length)];
  const [word, correct, ...wrong] = row;
  return {
    q: antonym ? `Which word means the OPPOSITE of ${word}?` : `Which word means almost the same as ${word}?`,
    options: shuffle([correct, ...wrong]), correct,
  };
}

// [correct sentence, ...incorrect versions]
const SENTENCES: string[][] = [
  ["We went to the park.", "we went to the park", "We Went to the Park", "We went to the park"],
  ["Where is my book?", "Where is my book.", "where is my book?", "Where is my book"],
  ["I like pizza, tacos, and rice.", "I like pizza tacos and rice", "i like pizza, tacos, and rice.", "I like, pizza tacos and rice."],
  ["My dog is fast!", "my dog is fast!", "My dog is fast", "My Dog is fast!"],
  ["She has two cats.", "She have two cats.", "she has two cats.", "She has two cat."],
  ["They are playing outside.", "They is playing outside.", "They are play outside.", "they are playing outside"],
  ["Maria and I read a book.", "Maria and me read a book.", "Me and Maria read a book.", "maria and I read a book."],
  ["The cookies are on the table.", "The cookies is on the table.", "The cookie are on the table.", "the cookies are on the table"],
  ["Did you finish your homework?", "Did you finish your homework.", "did you finish your homework?", "Did you finished your homework?"],
  ["We visited Texas in July.", "We visited texas in july.", "we visited Texas in July.", "We visited Texas in july."],
  ["He ran to the store yesterday.", "He run to the store yesterday.", "He runned to the store yesterday.", "he ran to the store yesterday."],
  ["It's a beautiful day.", "Its a beautiful day.", "It's a beautiful day", "its a beautiful day."],
  ["Their house is blue.", "There house is blue.", "They're house is blue.", "their house is blue."],
  ["I can't wait for summer!", "I cant wait for summer!", "I can't wait for Summer!", "i can't wait for summer!"],
  ["The birds sing every morning.", "The birds sings every morning.", "The bird sing every morning.", "the birds sing every morning."],
  ["My brother is taller than me.", "My brother is more taller than me.", "My brother is tallest than me.", "My brother are taller than me."],
  ["Wow, that was amazing!", "Wow that was amazing", "wow, that was amazing!", "Wow, That was amazing!"],
  ["We have three dogs.", "We has three dogs.", "We have three dog.", "we have three dogs."],
];
function sentenceQuestion(): ChoiceQuestion {
  const [correct, ...wrong] = SENTENCES[rand(SENTENCES.length)];
  return { q: "Pick the sentence that is written correctly.", options: shuffle([correct, ...wrong]), correct };
}

// [question, correct, ...wrong]
const FACTS: string[][] = [
  ["Which planet do we live on?", "Earth", "Mars", "Venus", "Jupiter"],
  ["Which animal is a mammal?", "Dolphin", "Shark", "Trout", "Octopus"],
  ["What do plants need to make food?", "Sunlight", "Plastic", "Sand only", "Moonlight"],
  ["Which is the largest ocean?", "Pacific", "Atlantic", "Arctic", "Indian"],
  ["What is the biggest planet in our solar system?", "Jupiter", "Earth", "Mars", "Mercury"],
  ["How many legs does a spider have?", "8", "6", "10", "4"],
  ["What gas do people breathe in to live?", "Oxygen", "Helium", "Smoke", "Steam"],
  ["Water freezes into…", "Ice", "Steam", "Sand", "Glass"],
  ["Which is the closest star to Earth?", "The Sun", "The Moon", "Mars", "Polaris"],
  ["What do bees make?", "Honey", "Milk", "Silk", "Wax paper"],
  ["Which animal lays eggs?", "Chicken", "Cow", "Dog", "Horse"],
  ["How many days are in a week?", "7", "5", "10", "6"],
  ["Which part of the plant takes in water from the soil?", "Roots", "Petals", "Leaves", "Seeds"],
  ["What is the hardest natural material?", "Diamond", "Wood", "Gold", "Chalk"],
  ["Which animal is the tallest?", "Giraffe", "Elephant", "Horse", "Camel"],
  ["Which planet is called the Red Planet?", "Mars", "Venus", "Saturn", "Neptune"],
  ["What do caterpillars turn into?", "Butterflies", "Beetles", "Bees", "Spiders"],
  ["How many continents are there?", "7", "5", "9", "12"],
  ["What is a baby frog called?", "Tadpole", "Cub", "Kit", "Calf"],
  ["Which body part pumps blood?", "Heart", "Lungs", "Stomach", "Brain"],
  ["Where do penguins mostly live?", "Antarctica", "The Sahara", "The Amazon", "Hawaii"],
  ["What is the boiling point of water in °C?", "100", "50", "0", "212"],
  ["Which planet has big rings?", "Saturn", "Mars", "Mercury", "Earth"],
  ["What do you call an animal that eats only plants?", "Herbivore", "Carnivore", "Omnivore", "Predator"],
  ["Which sense do you use your nose for?", "Smell", "Taste", "Touch", "Hearing"],
  ["How many hours are in a day?", "24", "12", "20", "36"],
  ["Which is the longest river in the world?", "The Nile", "The Thames", "The Mississippi", "The Seine"],
  ["What shape has three sides?", "Triangle", "Square", "Circle", "Hexagon"],
  ["Which animal is known as the King of the Jungle?", "Lion", "Bear", "Wolf", "Zebra"],
  ["What is frozen rain called?", "Hail", "Fog", "Dew", "Mist"],
  ["Which is a source of renewable energy?", "Wind", "Coal", "Oil", "Gasoline"],
  ["How many bones does an adult human have?", "206", "100", "52", "365"],
  ["What does a thermometer measure?", "Temperature", "Weight", "Speed", "Time"],
  ["What color do you get by mixing blue and yellow?", "Green", "Purple", "Orange", "Pink"],
  ["Which bird cannot fly?", "Ostrich", "Eagle", "Robin", "Parrot"],
  ["What is the center of an atom called?", "Nucleus", "Shell", "Crust", "Core"],
];
function factQuestion(): ChoiceQuestion {
  const [q, correct, ...wrong] = FACTS[rand(FACTS.length)];
  return { q, options: shuffle([correct, ...wrong]), correct };
}

const MAKERS: Record<string, () => ChoiceQuestion> = {
  math_duel: mathQuestion, pattern_power: patternQuestion, synonym_sprint: vocabQuestion,
  sentence_fix: sentenceQuestion, fact_dash: factQuestion,
};

export const ROUNDS = 6;

export function choiceQuestions(gameType: string, n = ROUNDS): ChoiceQuestion[] {
  const make = MAKERS[gameType] || factQuestion;
  const out: ChoiceQuestion[] = [];
  const seen = new Set<string>();
  for (let tries = 0; out.length < n && tries < 200; tries++) {
    const q = make();
    const key = q.q + "|" + q.correct;
    if (seen.has(key)) continue;
    seen.add(key); out.push(q);
  }
  return out;
}

export const RESCUE_WORDS: Array<{ word: string; hint: string }> = [
  { word: "BOOK", hint: "You read this." }, { word: "FARM", hint: "A place with animals and crops." },
  { word: "SPACE", hint: "Where stars and planets are." }, { word: "WATER", hint: "You drink this." },
  { word: "MUSIC", hint: "Songs and sounds." }, { word: "LEARN", hint: "What you do at school." },
  { word: "STORY", hint: "A tale with characters and events." }, { word: "CASTLE", hint: "Where kings and queens live." },
  { word: "DRAGON", hint: "A fire-breathing creature in fairy tales." }, { word: "ROCKET", hint: "It blasts off into space." },
  { word: "JUNGLE", hint: "A thick, wild forest." }, { word: "PIRATE", hint: "A sailor who hunts for treasure." },
  { word: "VOLCANO", hint: "A mountain that can erupt." }, { word: "PLANET", hint: "Earth is one of these." },
  { word: "GARDEN", hint: "Where flowers and vegetables grow." }, { word: "PUZZLE", hint: "Pieces you fit together." },
  { word: "WIZARD", hint: "A person who does magic." }, { word: "LIBRARY", hint: "A building full of books to borrow." },
  { word: "OCEAN", hint: "A huge body of salt water." }, { word: "THUNDER", hint: "The loud sound in a storm." },
  { word: "PENCIL", hint: "You write and erase with it." }, { word: "BRIDGE", hint: "It lets you cross over a river." },
  { word: "TREASURE", hint: "Gold and jewels in a chest." }, { word: "FRIEND", hint: "Someone you like to spend time with." },
  { word: "PICNIC", hint: "A meal eaten outside on a blanket." }, { word: "PENGUIN", hint: "A bird that swims but cannot fly." },
  { word: "RAINBOW", hint: "Colors in the sky after rain." }, { word: "ROBOT", hint: "A machine that can do tasks." },
  { word: "KNIGHT", hint: "A brave warrior in armor." }, { word: "MYSTERY", hint: "A puzzle that needs solving." },
  { word: "COMET", hint: "An icy space rock with a glowing tail." }, { word: "DESERT", hint: "A dry, sandy place." },
  { word: "SNOWMAN", hint: "You build it in winter." }, { word: "CHAPTER", hint: "A part of a book." },
  { word: "AUTHOR", hint: "The person who writes a book." }, { word: "ISLAND", hint: "Land with water all around it." },
  { word: "HONEY", hint: "Bees make this sweet food." }, { word: "TIGER", hint: "A big striped cat." },
  { word: "SCIENCE", hint: "Learning how the world works." }, { word: "LANTERN", hint: "A light you can carry." },
];

const TILE_WORDS = [
  "READ", "BOOK", "STAR", "LEARN", "PLANT", "HOUSE", "TRAIN", "CLOUD", "SMILE", "BRAVE", "OCEAN", "TIGER", "WATER",
  "LIGHT", "MAGIC", "QUEST", "STORM", "PAPER", "MUSIC", "DREAM", "FROG", "SHIP", "MOON", "BIRD", "FISH", "CAKE",
  "SNAKE", "HORSE", "APPLE", "BEACH", "CHAIR", "GHOST", "HEART", "JUICE", "LEMON", "MONEY", "NIGHT", "PIANO",
  "ROBOT", "SPACE", "TABLE", "WHALE", "ZEBRA", "CANDLE", "FOREST", "GARDEN", "KITTEN", "PLANET", "ROCKET", "SCHOOL",
];
function scramble(word: string): string {
  for (let i = 0; i < 20; i++) {
    const s = shuffle(word.split("")).join("");
    if (s !== word && !TILE_WORDS.includes(s)) return s;
  }
  return word.split("").reverse().join("") + "S";
}
/** Each round: one real word hidden among two scrambles. Real word scores its length × 2. */
export function tileRounds(n = ROUNDS): { choices: string[][]; real: string[] } {
  const words = pickN(TILE_WORDS, n);
  const choices = words.map(w => {
    const fakes = new Set<string>();
    while (fakes.size < 2) fakes.add(scramble(w));
    return shuffle([w, ...Array.from(fakes)]);
  });
  return { choices, real: words };
}

export function fourWinner(board: any[][]) {
  const dirs = [[1, 0], [0, 1], [1, 1], [1, -1]];
  for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
    const p = board[r][c]; if (!p) continue;
    for (const [dr, dc] of dirs) {
      let ok = true;
      for (let i = 1; i < 4; i++) {
        const rr = r + dr * i, cc = c + dc * i;
        if (rr < 0 || rr >= 6 || cc < 0 || cc >= 7 || board[rr][cc] !== p) { ok = false; break; }
      }
      if (ok) return p;
    }
  }
  return null;
}
function dropRow(board: any[][], col: number) { for (let r = 5; r >= 0; r--) if (!board[r][col]) return r; return -1; }
function wouldWin(board: any[][], col: number, who: number) {
  const r = dropRow(board, col); if (r < 0) return false;
  board[r][col] = who; const w = fourWinner(board) === who; board[r][col] = null; return w;
}
/** A friendly but real opponent: takes wins, blocks threats, avoids setting you up, likes the center. */
export function fourAI(board: any[][], me = 2): number {
  const them = me === 1 ? 2 : 1;
  const valid: number[] = [];
  for (let c = 0; c < 7; c++) if (dropRow(board, c) >= 0) valid.push(c);
  if (!valid.length) return -1;
  for (const c of valid) if (wouldWin(board, c, me)) return c;
  if (Math.random() < 0.9) for (const c of valid) if (wouldWin(board, c, them)) return c;
  if (Math.random() < 0.15) return valid[rand(valid.length)]; // keep it beatable
  const weight = [1, 2, 3, 4, 3, 2, 1];
  let best = valid[0], bestScore = -Infinity;
  for (const c of valid) {
    const r = dropRow(board, c);
    board[r][c] = me;
    let score = weight[c] * 2 + Math.random();
    // don't hand the opponent a win right above our piece
    if (r > 0) { board[r - 1][c] = them; if (fourWinner(board) === them) score -= 50; board[r - 1][c] = null; }
    board[r][c] = null;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best;
}

const LETTER_ORDER = "EARIOTNSLCUDPMHGBFYWKVXZJQ".split("");
export function rescueGuess(word: string, guessed: string[]): string | null {
  const left = LETTER_ORDER.filter(l => !guessed.includes(l));
  if (!left.length) return null;
  const inWord = left.filter(l => word.includes(l));
  if (inWord.length && Math.random() < 0.45) return inWord[rand(inWord.length)];
  return left[Math.min(left.length - 1, rand(4))];
}
