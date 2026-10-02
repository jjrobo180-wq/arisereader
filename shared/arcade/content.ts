// Question banks for the arcade learning games. Every match gets fresh, shuffled rounds.
import { rand, shuffle } from "./core";

export type ChoiceQuestion = { q: string; options: string[]; correct: string };

const between = (lo: number, hi: number) => lo + rand(hi - lo + 1);

function numberOptions(answer: number, spread: number[]): string[] {
  const set = new Set<number>([answer]);
  for (const d of shuffle(spread)) { if (set.size >= 4) break; const v = answer + d; if (v >= 0) set.add(v); }
  let k = 1;
  while (set.size < 4) { set.add(answer + k * 3 + 1); k++; }
  return shuffle(Array.from(set).map(String));
}
const fromRow = (q: string, row: readonly string[]): ChoiceQuestion => ({ q, options: shuffle(row), correct: row[0] });

function mathQuestion(): ChoiceQuestion {
  const kind = rand(6);
  let q = "", a = 0;
  if (kind === 0) { const x = between(12, 89), y = between(11, 79); q = `${x} + ${y} = ?`; a = x + y; }
  else if (kind === 1) { const x = between(40, 140), y = between(11, x - 5); q = `${x} − ${y} = ?`; a = x - y; }
  else if (kind === 2) { const x = between(3, 12), y = between(3, 12); q = `${x} × ${y} = ?`; a = x * y; }
  else if (kind === 3) { const y = between(3, 12), a0 = between(3, 12); q = `${y * a0} ÷ ${y} = ?`; a = a0; }
  else if (kind === 4) { const x = between(2, 9), y = between(2, 9), z = between(2, 20); q = `${x} × ${y} + ${z} = ?`; a = x * y + z; }
  else { const half = between(2, 25) * 2; q = `Half of ${half * 2} is ?`; a = half; }
  return { q, options: numberOptions(a, [-10, -2, -1, 1, 2, 10, 5, -5]), correct: String(a) };
}

function patternQuestion(): ChoiceQuestion {
  const kind = rand(5);
  let seq: number[] = [];
  if (kind === 0) { const s = between(1, 20), d = between(2, 9); seq = [0, 1, 2, 3, 4].map((i) => s + i * d); }
  else if (kind === 1) { const s = between(60, 120), d = between(3, 12); seq = [0, 1, 2, 3, 4].map((i) => s - i * d); }
  else if (kind === 2) { const s = between(1, 4), m = between(2, 3); seq = [0, 1, 2, 3, 4].map((i) => s * Math.pow(m, i)); }
  else if (kind === 3) { const s = between(1, 5); seq = [0, 1, 2, 3, 4].map((i) => (s + i) * (s + i)); }
  else { const s = between(1, 10), a = between(2, 6), b = between(7, 12); seq = [s]; for (let i = 1; i < 5; i++) seq.push(seq[i - 1] + (i % 2 ? a : b)); }
  return { q: seq.slice(0, 4).join(", ") + ", ?", options: numberOptions(seq[4], [-3, -2, -1, 1, 2, 3, 4, -4]), correct: String(seq[4]) };
}

// [word, same meaning, ...three that do not match]
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
  ["ANCIENT", "Old", "New", "Shiny", "Quick"], ["FURIOUS", "Enraged", "Cheerful", "Sleepy", "Hungry"], ["GLANCE", "Peek", "Stare", "Shout", "Jump"],
];
const ANTONYMS: string[][] = [
  ["HOT", "Cold", "Warm", "Sunny", "Bright"], ["UP", "Down", "Over", "High", "Top"], ["FULL", "Empty", "Heavy", "Round", "Big"],
  ["EARLY", "Late", "Soon", "First", "Quick"], ["LOUD", "Quiet", "Noisy", "Strong", "Bright"], ["WIN", "Lose", "Play", "Score", "Try"],
  ["LIGHT", "Dark", "Bright", "Shiny", "Clear"], ["ASLEEP", "Awake", "Tired", "Dreamy", "Lazy"], ["FRIEND", "Enemy", "Buddy", "Pal", "Partner"],
  ["ANCIENT", "Modern", "Old", "Dusty", "Broken"], ["SHALLOW", "Deep", "Low", "Wet", "Narrow"], ["ARRIVE", "Leave", "Come", "Reach", "Enter"],
  ["GENEROUS", "Selfish", "Kind", "Giving", "Friendly"], ["ACCEPT", "Refuse", "Take", "Agree", "Allow"],
];
function vocabQuestion(): ChoiceQuestion {
  const antonym = Math.random() < 0.3;
  const [word, ...row] = antonym ? ANTONYMS[rand(ANTONYMS.length)] : SYNONYMS[rand(SYNONYMS.length)];
  return fromRow(antonym ? `Which word means the OPPOSITE of ${word}?` : `Which word means almost the same as ${word}?`, row);
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
  ["You're my best friend.", "Your my best friend.", "Youre my best friend.", "you're my best friend."],
  ["The team won its first game.", "The team won it's first game.", "The team won its first game", "the team won its first game."],
];
const sentenceQuestion = (): ChoiceQuestion => fromRow("Pick the sentence that is written correctly.", SENTENCES[rand(SENTENCES.length)]);

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
  ["Which part of the plant takes in water from the soil?", "Roots", "Petals", "Leaves", "Seeds"],
  ["What is the hardest natural material?", "Diamond", "Wood", "Gold", "Chalk"],
  ["Which animal is the tallest?", "Giraffe", "Elephant", "Horse", "Camel"],
  ["Which planet is called the Red Planet?", "Mars", "Venus", "Saturn", "Neptune"],
  ["What do caterpillars turn into?", "Butterflies", "Beetles", "Bees", "Spiders"],
  ["How many continents are there?", "7", "5", "9", "12"],
  ["What is a baby frog called?", "Tadpole", "Cub", "Kit", "Calf"],
  ["Which body part pumps blood?", "Heart", "Lungs", "Stomach", "Brain"],
  ["Where do penguins mostly live?", "Antarctica", "The Sahara", "The Amazon", "Hawaii"],
  ["At what temperature does water boil (°C)?", "100", "50", "0", "212"],
  ["Which planet has big rings?", "Saturn", "Mars", "Mercury", "Earth"],
  ["What do you call an animal that eats only plants?", "Herbivore", "Carnivore", "Omnivore", "Predator"],
  ["How many hours are in a day?", "24", "12", "20", "36"],
  ["What shape has three sides?", "Triangle", "Square", "Circle", "Hexagon"],
  ["What is frozen rain called?", "Hail", "Fog", "Dew", "Mist"],
  ["Which is a source of renewable energy?", "Wind", "Coal", "Oil", "Gasoline"],
  ["How many bones does an adult human have?", "206", "100", "52", "365"],
  ["What does a thermometer measure?", "Temperature", "Weight", "Speed", "Time"],
  ["What color do you get by mixing blue and yellow?", "Green", "Purple", "Orange", "Pink"],
  ["Which bird cannot fly?", "Ostrich", "Eagle", "Robin", "Parrot"],
  ["What is the center of an atom called?", "Nucleus", "Shell", "Crust", "Core"],
  ["What force pulls things down to Earth?", "Gravity", "Magnetism", "Friction", "Wind"],
  ["Which organ do you use to breathe?", "Lungs", "Liver", "Kidneys", "Skin"],
  ["What is the closest planet to the Sun?", "Mercury", "Venus", "Earth", "Mars"],
];
const factQuestion = (): ChoiceQuestion => { const [q, ...row] = FACTS[rand(FACTS.length)]; return fromRow(q, row); };

// [correct spelling, ...common misspellings]
const SPELLING: string[][] = [
  ["because", "becuase", "becaus", "beacuse"], ["friend", "freind", "frend", "friand"], ["beautiful", "beautifull", "beutiful", "beatiful"],
  ["different", "diffrent", "diferent", "differant"], ["separate", "seperate", "separete", "saperate"], ["necessary", "neccessary", "necesary", "nessesary"],
  ["believe", "beleive", "belive", "beleave"], ["receive", "recieve", "receeve", "resieve"], ["library", "libary", "liberry", "librery"],
  ["February", "Febuary", "Februery", "Febrary"], ["Wednesday", "Wensday", "Wednsday", "Wendesday"], ["tomorrow", "tommorow", "tomorow", "tommorrow"],
  ["surprise", "suprise", "surprize", "serprise"], ["government", "goverment", "govermant", "guvernment"], ["environment", "enviroment", "environmint", "envirement"],
  ["calendar", "calandar", "calendor", "callendar"], ["definitely", "definately", "definitly", "defenitely"], ["occasion", "ocassion", "occassion", "ocasion"],
  ["argument", "arguement", "argumant", "arguemint"], ["knowledge", "knowlege", "knowledg", "nolledge"], ["science", "sience", "scince", "sciense"],
  ["weird", "wierd", "weerd", "weyrd"], ["island", "iland", "islund", "eyeland"], ["answer", "anser", "answere", "ansewr"],
  ["thought", "thougt", "thougth", "thaught"], ["through", "throgh", "thrugh", "throuh"], ["favorite", "favrite", "faverite", "favorit"],
  ["especially", "expecially", "especialy", "espeshally"], ["probably", "probly", "probabaly", "probaly"], ["restaurant", "resturant", "restaraunt", "restarant"],
  ["vacuum", "vaccum", "vacume", "vacum"], ["sincerely", "sincerly", "sincerley", "sinserely"], ["truly", "truely", "trully", "truley"],
  ["until", "untill", "untell", "intil"], ["across", "accross", "acros", "accros"], ["address", "adress", "addres", "adres"],
  ["disappear", "dissapear", "disapear", "dissappear"], ["embarrass", "embarass", "embarras", "embarrase"], ["exercise", "excercise", "exersize", "exercize"],
  ["grammar", "grammer", "gramar", "grammir"], ["immediately", "immediatly", "imediately", "immedietly"], ["interrupt", "interupt", "enterrupt", "intterupt"],
  ["neighbor", "nieghbor", "naybor", "neighbur"], ["piece", "peice", "peese", "piese"], ["question", "questoin", "qestion", "quesion"],
  ["schedule", "schedual", "scedule", "shedule"], ["character", "charactor", "charecter", "caracter"], ["minute", "minite", "minut", "mintue"],
  ["excellent", "excelent", "exellent", "excellant"], ["caught", "cought", "caugt", "cawght"], ["describe", "discribe", "descibe", "descripe"],
  ["experience", "experiance", "expierence", "experence"],
];
const spellingQuestion = (): ChoiceQuestion => fromRow("Which word is spelled correctly?", SPELLING[rand(SPELLING.length)]);

// [question, correct, ...wrong]
const GEOGRAPHY: string[][] = [
  ["What is the capital of France?", "Paris", "London", "Rome", "Madrid"],
  ["What is the capital of Japan?", "Tokyo", "Beijing", "Seoul", "Bangkok"],
  ["What is the capital of Mexico?", "Mexico City", "Cancún", "Guadalajara", "Monterrey"],
  ["What is the capital of Canada?", "Ottawa", "Toronto", "Vancouver", "Montreal"],
  ["What is the capital of the United States?", "Washington, D.C.", "New York City", "Los Angeles", "Chicago"],
  ["What is the capital of Italy?", "Rome", "Venice", "Milan", "Naples"],
  ["What is the capital of Egypt?", "Cairo", "Alexandria", "Nairobi", "Casablanca"],
  ["What is the capital of Australia?", "Canberra", "Sydney", "Melbourne", "Perth"],
  ["What is the capital of Spain?", "Madrid", "Barcelona", "Lisbon", "Seville"],
  ["What is the capital of Brazil?", "Brasília", "Rio de Janeiro", "São Paulo", "Buenos Aires"],
  ["What is the capital of Colorado?", "Denver", "Boulder", "Colorado Springs", "Aurora"],
  ["What is the capital of Texas?", "Austin", "Houston", "Dallas", "San Antonio"],
  ["What is the capital of California?", "Sacramento", "Los Angeles", "San Francisco", "San Diego"],
  ["What is the capital of Germany?", "Berlin", "Munich", "Vienna", "Hamburg"],
  ["What is the capital of China?", "Beijing", "Shanghai", "Hong Kong", "Tokyo"],
  ["What is the capital of Kenya?", "Nairobi", "Cairo", "Lagos", "Accra"],
  ["What is the capital of Peru?", "Lima", "Cusco", "Quito", "Bogotá"],
  ["What is the capital of Argentina?", "Buenos Aires", "Santiago", "Montevideo", "Lima"],
  ["What is the capital of the United Kingdom?", "London", "Manchester", "Dublin", "Edinburgh"],
  ["Which continent is Kenya in?", "Africa", "Asia", "South America", "Europe"],
  ["Which continent is Peru in?", "South America", "Africa", "Europe", "Asia"],
  ["Which continent is India in?", "Asia", "Africa", "Europe", "Australia"],
  ["Which is the largest continent?", "Asia", "Africa", "Europe", "North America"],
  ["Which is the coldest continent?", "Antarctica", "Europe", "Asia", "North America"],
  ["Which ocean lies between the United States and Europe?", "Atlantic Ocean", "Pacific Ocean", "Indian Ocean", "Arctic Ocean"],
  ["Which country is shaped like a boot?", "Italy", "Spain", "Chile", "Norway"],
  ["In which country are the pyramids of Giza?", "Egypt", "Mexico", "Peru", "Greece"],
  ["In which city is the Eiffel Tower?", "Paris", "Rome", "London", "Berlin"],
  ["In which country is the Great Wall?", "China", "Japan", "India", "Egypt"],
  ["In which country is Machu Picchu?", "Peru", "Mexico", "Chile", "Brazil"],
  ["Which is the longest river in South America?", "Amazon", "Nile", "Mississippi", "Danube"],
  ["Which U.S. state is a chain of islands in the Pacific?", "Hawaii", "Alaska", "Florida", "Maine"],
  ["Which is the largest U.S. state by area?", "Alaska", "Texas", "California", "Montana"],
  ["Mount Everest is in which mountain range?", "Himalayas", "Andes", "Rockies", "Alps"],
  ["Which is the largest hot desert in the world?", "Sahara", "Gobi", "Mojave", "Atacama"],
  ["Which country is directly north of the United States?", "Canada", "Mexico", "Brazil", "Cuba"],
  ["Which country is directly south of the United States?", "Mexico", "Canada", "Brazil", "Peru"],
  ["Which language is mainly spoken in Brazil?", "Portuguese", "Spanish", "French", "English"],
  ["Which imaginary line splits Earth into north and south halves?", "Equator", "Prime Meridian", "Tropic of Cancer", "Arctic Circle"],
  ["What do we call land with water all around it?", "Island", "Peninsula", "Valley", "Plateau"],
  ["What do we call land almost surrounded by water?", "Peninsula", "Island", "Canyon", "Plain"],
  ["Which country is home to wild kangaroos?", "Australia", "Austria", "Argentina", "Norway"],
  ["The Grand Canyon is in which U.S. state?", "Arizona", "Utah", "Nevada", "Colorado"],
];
const geographyQuestion = (): ChoiceQuestion => { const [q, ...row] = GEOGRAPHY[rand(GEOGRAPHY.length)]; return fromRow(q, row); };

const TILE_WORDS = [
  "READ", "BOOK", "STAR", "LEARN", "PLANT", "HOUSE", "TRAIN", "CLOUD", "SMILE", "BRAVE", "OCEAN", "TIGER", "WATER",
  "LIGHT", "MAGIC", "QUEST", "STORM", "PAPER", "MUSIC", "DREAM", "FROG", "SHIP", "MOON", "BIRD", "FISH", "CAKE",
  "SNAKE", "HORSE", "APPLE", "BEACH", "CHAIR", "GHOST", "HEART", "JUICE", "LEMON", "MONEY", "NIGHT", "PIANO",
  "ROBOT", "SPACE", "TABLE", "WHALE", "ZEBRA", "CANDLE", "FOREST", "GARDEN", "KITTEN", "PLANET", "ROCKET", "SCHOOL",
];
function scramble(word: string): string {
  for (let i = 0; i < 30; i++) {
    const s = shuffle(word.split("")).join("");
    if (s !== word && !TILE_WORDS.includes(s)) return s;
  }
  return word.split("").reverse().join("") + "S";
}
function tileQuestion(): ChoiceQuestion {
  const word = TILE_WORDS[rand(TILE_WORDS.length)];
  const fakes = new Set<string>();
  for (let guard = 0; fakes.size < 2 && guard < 20; guard++) fakes.add(scramble(word));
  while (fakes.size < 2) fakes.add(word + "X".repeat(fakes.size + 1));
  return { q: "Which tile is a real word?", options: shuffle([word, ...Array.from(fakes)]), correct: word };
}

export const QUESTION_MAKERS: Record<string, () => ChoiceQuestion> = {
  math_duel: mathQuestion,
  pattern_power: patternQuestion,
  synonym_sprint: vocabQuestion,
  sentence_fix: sentenceQuestion,
  fact_dash: factQuestion,
  word_tiles: tileQuestion,
  spelling: spellingQuestion,
  geography: geographyQuestion,
};

export function makeQuestions(kind: string, n: number): ChoiceQuestion[] {
  const make = QUESTION_MAKERS[kind] || factQuestion;
  const out: ChoiceQuestion[] = [];
  const seen = new Set<string>();
  for (let tries = 0; out.length < n && tries < 300; tries++) {
    const q = make();
    const key = q.q + "|" + q.correct;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
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
  { word: "GALAXY", hint: "A huge group of stars, like the Milky Way." }, { word: "MONSTER", hint: "A scary creature in stories." },
  { word: "DOLPHIN", hint: "A smart sea mammal that clicks and whistles." }, { word: "BALLOON", hint: "It floats when filled with helium." },
  { word: "KITCHEN", hint: "The room where food is cooked." }, { word: "HOMEWORK", hint: "School work you do at home." },
  { word: "SANDWICH", hint: "Food between two slices of bread." }, { word: "TEACHER", hint: "A person who helps you learn." },
  { word: "BICYCLE", hint: "It has two wheels and pedals." }, { word: "MAGNET", hint: "It sticks to the fridge and pulls iron." },
  { word: "PYRAMID", hint: "A huge stone tomb in Egypt." }, { word: "COMPASS", hint: "It points north." },
  { word: "SKELETON", hint: "All the bones in your body." }, { word: "VOYAGE", hint: "A long trip, often by sea." },
];
