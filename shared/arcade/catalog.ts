// Display info for every arcade game (shared by the client UI and the server).

export type CategoryId = "board" | "quick" | "brain" | "cards" | "words" | "learn";

export const CATEGORIES: { id: CategoryId; name: string; emoji: string; blurb: string; color: string }[] = [
  { id: "board", name: "Board Classics", emoji: "♟️", blurb: "Timeless strategy games", color: "#3b82f6" },
  { id: "quick", name: "Quick & Fun", emoji: "⚡", blurb: "Games in under 3 minutes", color: "#f59e0b" },
  { id: "brain", name: "Brain Battles", emoji: "🧠", blurb: "Think ahead to win", color: "#a855f7" },
  { id: "cards", name: "Cards & Dice", emoji: "🃏", blurb: "Luck plus smart choices", color: "#ef4444" },
  { id: "words", name: "Word Games", emoji: "🔤", blurb: "Spelling, meaning, grammar", color: "#10b981" },
  { id: "learn", name: "Math & Trivia", emoji: "🧮", blurb: "Fast facts and numbers", color: "#06b6d4" },
];

export type GameInfo = {
  id: string;
  /** The familiar name (Connect Four, Checkers…), shown small under the title and used in search. */
  name: string;
  /** The game's cover title. */
  title: string;
  /** One line under the title on the game page. */
  tagline: string;
  emoji: string;
  category: CategoryId;
  blurb: string;
  how: string[];
  color: string;
  minutes: number;
  isNew?: boolean;
};

export const GAMES: GameInfo[] = [
  // Board Classics
  { id: "four", name: "Connect Four", title: "Fourfall", tagline: "Drop. Stack. Conquer.", emoji: "🔴", category: "board", color: "#2563eb", minutes: 4,
    blurb: "Drop discs and line up four.", how: ["Drop a disc into any column.", "Get four in a row across, down, or diagonally.", "Block your opponent's lines!"] },
  { id: "checkers", name: "Checkers", title: "Kingmaker", tagline: "Jump, capture and claim the crown.", emoji: "⚫", category: "board", color: "#dc2626", minutes: 10, isNew: true,
    blurb: "Jump pieces and crown your kings.", how: ["Move diagonally forward one square.", "Jump over an opponent's piece to capture it. Jumps are required!", "Reach the far side to become a king that moves both ways.", "Capture or block every piece to win."] },
  { id: "reversi", name: "Reversi", title: "Eclipse", tagline: "Light against shadow. Flip the board.", emoji: "⚪", category: "board", color: "#16a34a", minutes: 8, isNew: true,
    blurb: "Trap discs to flip them your color.", how: ["Place a disc so it traps a line of your opponent's discs.", "Every trapped disc flips to your color.", "Corners can never be flipped. Grab them!", "Most discs at the end wins."] },
  { id: "mancala", name: "Mancala", title: "Stone Harvest", tagline: "An ancient game of seeds and stores.", emoji: "🌰", category: "board", color: "#b45309", minutes: 6, isNew: true,
    blurb: "Sow stones and fill your store.", how: ["Pick one of your pits to scoop up its stones.", "Drop them one at a time to the right, around the board.", "Land in your store to go again.", "Land in an empty pit on your side to capture the stones across."] },
  { id: "dots", name: "Dots & Boxes", title: "Gridlock", tagline: "Claim the grid one line at a time.", emoji: "🔲", category: "board", color: "#7c3aed", minutes: 6, isNew: true,
    blurb: "Close boxes to claim them.", how: ["Draw one line between two dots.", "Finish the fourth side of a box to claim it and go again.", "Try not to draw the third side of a box!", "Most boxes wins."] },
  { id: "gomoku", name: "Five in a Row", title: "Fivefold", tagline: "Five stones. One unbroken line.", emoji: "⭕", category: "board", color: "#0891b2", minutes: 6, isNew: true,
    blurb: "Like tic-tac-toe, but get five.", how: ["Take turns placing stones on the grid.", "Get five in a row in any direction to win.", "Block four-in-a-row before it is too late!"] },

  // Quick & Fun
  { id: "tictactoe", name: "Tic-Tac-Toe", title: "Crossfire", tagline: "X against O. Three in a row wins.", emoji: "❌", category: "quick", color: "#f97316", minutes: 1, isNew: true,
    blurb: "The classic three in a row.", how: ["Take turns marking a square.", "Three in a row wins.", "Full board with no line is a tie."] },
  { id: "gobble", name: "Gobble Tac Toe", title: "Colossus", tagline: "Big pieces swallow small ones.", emoji: "🥚", category: "quick", color: "#ec4899", minutes: 3, isNew: true,
    blurb: "Big pieces gobble small ones.", how: ["You have small, medium, and large pieces.", "Place a piece, or cover a smaller piece with a bigger one.", "You can also move one of your pieces that is on top.", "Three of your pieces showing in a row wins."] },
  { id: "rps", name: "Rock Paper Scissors", title: "Showdown", tagline: "Rock, paper, scissors. First to three.", emoji: "✊", category: "quick", color: "#8b5cf6", minutes: 1, isNew: true,
    blurb: "First to three wins.", how: ["Both players pick at the same time.", "Rock beats scissors, scissors beats paper, paper beats rock.", "First to 3 round wins takes the match."] },
  { id: "memory", name: "Memory Match", title: "Mindvault", tagline: "Flip, remember and match every pair.", emoji: "🃏", category: "quick", color: "#14b8a6", minutes: 4, isNew: true,
    blurb: "Flip cards and find pairs.", how: ["Flip two cards each turn.", "Find a matching pair to keep it and go again.", "Remember where cards are when your opponent flips them!", "Most pairs wins."] },

  // Brain Battles
  { id: "ultimate", name: "Ultimate Tic-Tac-Toe", title: "Nine Realms", tagline: "Nine boards. One kingdom.", emoji: "🧩", category: "brain", color: "#6366f1", minutes: 8, isNew: true,
    blurb: "Nine boards. One big game.", how: ["Win a small board by getting three in a row inside it.", "The square you pick sends your opponent to that board.", "Win three small boards in a row to win the game."] },
  { id: "seabattle", name: "Sea Battle", title: "Iron Tide", tagline: "Hunt down the hidden fleet.", emoji: "🚢", category: "brain", color: "#0284c7", minutes: 7, isNew: true,
    blurb: "Find and sink the hidden fleet.", how: ["Shuffle your fleet, then press Ready.", "Take turns firing at your opponent's waters.", "💥 means hit, 🌊 means miss.", "Sink all four ships to win."] },
  { id: "codebreaker", name: "Code Breaker", title: "Cipher", tagline: "Crack the secret code first.", emoji: "🔐", category: "brain", color: "#059669", minutes: 5, isNew: true,
    blurb: "Crack the secret color code.", how: ["Guess a code of 4 different colors.", "● means a right color in the right spot. ○ means right color, wrong spot.", "You and your rival each crack your own code at the same time.", "Crack it in fewer guesses to win."] },
  { id: "nim", name: "Last Stone", title: "Monolith", tagline: "Whoever takes the last stone wins.", emoji: "🥌", category: "brain", color: "#64748b", minutes: 2, isNew: true,
    blurb: "Take the very last stone.", how: ["Take as many stones as you want from ONE pile.", "Players take turns.", "Whoever takes the last stone wins."] },
  { id: "fifteen", name: "Fifteen", title: "Arcane Fifteen", tagline: "Three numbers. One magic sum.", emoji: "🔢", category: "brain", color: "#d946ef", minutes: 2, isNew: true,
    blurb: "Collect three numbers that add to 15.", how: ["Take turns picking numbers 1 to 9.", "Each number can be picked once.", "First to hold three numbers that add up to exactly 15 wins."] },

  // Cards & Dice
  { id: "eights", name: "Crazy Eights", title: "Wildcard", tagline: "Match the suit. Eights are wild.", emoji: "🎴", category: "cards", color: "#e11d48", minutes: 6, isNew: true,
    blurb: "Match suit or number. 8s are wild!", how: ["Play a card that matches the suit or number on top.", "An 8 can be played anytime. Pick the new suit!", "No match? Draw a card.", "First to empty their hand wins."] },
  { id: "gofish", name: "Go Fish", title: "Kraken", tagline: "Fish the deep for full sets.", emoji: "🐟", category: "cards", color: "#2563eb", minutes: 7, isNew: true,
    blurb: "Ask for cards and collect sets.", how: ["Ask your opponent for a card rank you hold.", "If they have it, they hand it over and you go again.", "If not, Go Fish! Draw a card.", "Collect all four of a rank to make a book. Most books wins."] },
  { id: "pig", name: "Pig", title: "Boar Rush", tagline: "Roll your luck. Don't roll a one.", emoji: "🎲", category: "cards", color: "#f43f5e", minutes: 4, isNew: true,
    blurb: "Roll your luck to 50 points.", how: ["Roll the die to add points to your turn total.", "Roll a 1 and you lose this turn's points!", "Hold to bank your points.", "First to 50 wins."] },

  // Word Games
  { id: "word_tiles", name: "Word Tiles", title: "Runeseeker", tagline: "Find the true word among the runes.", emoji: "🔤", category: "words", color: "#7c3aed", minutes: 3,
    blurb: "Spot the real word.", how: ["One tile is a real word. The others are scrambled.", "Both players answer at the same time.", "Right answers in a row earn streak bonus points."] },
  { id: "word_rescue", name: "Word Rescue", title: "Lifeline", tagline: "Guess the letters. Save the word.", emoji: "🛟", category: "words", color: "#059669", minutes: 4,
    blurb: "Guess letters to solve the word.", how: ["Read the clue and pick a letter.", "A right letter earns another turn.", "Whoever solves the word wins. Making the 8th miss loses!"] },
  { id: "synonym_sprint", name: "Synonym Sprint", title: "Echoes", tagline: "Find the words that mean the same.", emoji: "📚", category: "words", color: "#ec4899", minutes: 3,
    blurb: "Match words with the same meaning.", how: ["Find the word that means the same (or the opposite).", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "sentence_fix", name: "Sentence Fix", title: "Wordsmith", tagline: "Forge the perfect sentence.", emoji: "✏️", category: "words", color: "#8b5cf6", minutes: 3,
    blurb: "Pick the perfect sentence.", how: ["Choose the sentence with correct capitals, punctuation, and grammar.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "spelling", name: "Spell It Right", title: "Spellbound", tagline: "Only one spelling is true.", emoji: "🐝", category: "words", color: "#eab308", minutes: 3, isNew: true,
    blurb: "Find the correct spelling.", how: ["One word is spelled correctly. Find it!", "Both players answer at the same time.", "Streaks earn bonus points."] },

  // Math & Trivia
  { id: "math_duel", name: "Math Duel", title: "Number Storm", tagline: "Fast math under pressure.", emoji: "➗", category: "learn", color: "#f59e0b", minutes: 3,
    blurb: "Fast, accurate math.", how: ["Solve the math problem.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "pattern_power", name: "Pattern Power", title: "Fractal", tagline: "See the pattern. Call what comes next.", emoji: "🔁", category: "learn", color: "#06b6d4", minutes: 3,
    blurb: "What comes next?", how: ["Find the number that continues the pattern.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "fact_dash", name: "Fact Dash", title: "Quantum", tagline: "Science facts at full speed.", emoji: "🔬", category: "learn", color: "#ef4444", minutes: 3,
    blurb: "Science and nature facts.", how: ["Answer science and world questions.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "geography", name: "World Explorer", title: "Atlas", tagline: "Capitals, continents and landmarks.", emoji: "🌎", category: "learn", color: "#22c55e", minutes: 3, isNew: true,
    blurb: "Capitals, continents, and landmarks.", how: ["Answer questions about places around the world.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  // Expanded Word / Reading Games
  { id: "letter_forge", name: "Tile Word Builder", title: "Letter Forge", tagline: "Build bigger words. Score smarter.", emoji: "🧱", category: "words", color: "#14b8a6", minutes: 3, isNew: true,
    blurb: "Study a letter rack and forge the strongest real word.", how: ["Read the letter tiles in the rack.", "Choose the strongest word that can be built from those letters.", "Fast correct answers and streaks earn more points."] },
  { id: "context_clues", name: "Context Clues", title: "Clue Hunter", tagline: "Use the sentence. Crack the meaning.", emoji: "🔎", category: "words", color: "#0ea5e9", minutes: 3, isNew: true,
    blurb: "Use clues in a sentence to unlock word meanings.", how: ["Read the sentence carefully.", "Use the surrounding clues to figure out the bold word.", "Build a streak by choosing the best meaning."] },
  { id: "roots_affixes", name: "Roots & Affixes", title: "Word Roots", tagline: "Break words apart. Unlock their power.", emoji: "🌱", category: "words", color: "#22c55e", minutes: 3, isNew: true,
    blurb: "Master prefixes, suffixes, and common roots.", how: ["Read the prefix, suffix, or root.", "Choose what that word part means.", "Use what you learn to decode bigger words."] },
  { id: "syllable_smash", name: "Syllables", title: "Beat Breaker", tagline: "Hear the beats inside every word.", emoji: "🥁", category: "words", color: "#f97316", minutes: 3, isNew: true,
    blurb: "Count spoken word parts and sharpen decoding.", how: ["Say the word in your head or out loud.", "Count its spoken beats.", "Pick the number of syllables."] },
  { id: "parts_speech", name: "Parts of Speech", title: "Grammar Grid", tagline: "Name the job every word is doing.", emoji: "🧩", category: "words", color: "#8b5cf6", minutes: 3, isNew: true,
    blurb: "Identify nouns, verbs, adjectives, adverbs, and more.", how: ["Read the sentence.", "Focus on the highlighted word.", "Choose the part of speech that matches its job."] },
  { id: "figurative_language", name: "Figurative Language", title: "Figurative Fire", tagline: "Spot what the words really mean.", emoji: "🔥", category: "words", color: "#ef4444", minutes: 3, isNew: true,
    blurb: "Battle through similes, metaphors, idioms, and more.", how: ["Read the expression.", "Look for comparison, exaggeration, sound, or human traits.", "Choose the type of figurative language."] },
  { id: "reading_detective", name: "Reading Inference", title: "Reading Detective", tagline: "Find the clue. Make the inference.", emoji: "🕵️", category: "words", color: "#6366f1", minutes: 4, isNew: true,
    blurb: "Use short passages to make smart inferences.", how: ["Read the mini-passage.", "Combine what the text says with what you know.", "Choose the conclusion best supported by the clues."] },
  { id: "sequence_story", name: "Sequencing", title: "Story Shift", tagline: "Put events in the order that makes sense.", emoji: "➡️", category: "words", color: "#06b6d4", minutes: 3, isNew: true,
    blurb: "Practice sequence, process, and story order.", how: ["Read the steps or events.", "Think about what logically comes next.", "Choose the best next or final step."] },
  { id: "analogy_arena", name: "Analogies", title: "Link Logic", tagline: "Find the relationship. Finish the link.", emoji: "🔗", category: "words", color: "#a855f7", minutes: 3, isNew: true,
    blurb: "Match relationships between words and ideas.", how: ["Study the first word pair.", "Figure out how the two ideas connect.", "Choose the word that makes the second pair match."] },
  { id: "homophone_hunt", name: "Homophones", title: "Sound Alike", tagline: "Same sound. Different meaning.", emoji: "👂", category: "words", color: "#ec4899", minutes: 3, isNew: true,
    blurb: "Choose the correct sound-alike word for each sentence.", how: ["Read the whole sentence.", "Think about the meaning, not just the sound.", "Choose the homophone that fits."] },

  // Expanded Math / Science / Social Studies Games
  { id: "multiplication_mayhem", name: "Multiplication", title: "Times Table Turbo", tagline: "Multiply fast. Build the streak.", emoji: "✖️", category: "learn", color: "#f59e0b", minutes: 3, isNew: true,
    blurb: "Fast multiplication practice from 2s through 12s.", how: ["Solve the multiplication fact.", "Choose the exact product.", "Correct answers in a row earn streak points."] },
  { id: "fraction_frenzy", name: "Fractions", title: "Fraction Frenzy", tagline: "Compare it. Combine it. Own it.", emoji: "½", category: "learn", color: "#3b82f6", minutes: 3, isNew: true,
    blurb: "Equivalent fractions, comparison, and simple operations.", how: ["Read the fraction problem.", "Picture the parts of a whole.", "Choose the equivalent, larger, or combined fraction."] },
  { id: "decimal_dash", name: "Decimals", title: "Decimal Dash", tagline: "Place value at full speed.", emoji: "🔟", category: "learn", color: "#0ea5e9", minutes: 3, isNew: true,
    blurb: "Compare, add, subtract, and connect decimals to fractions.", how: ["Line up place values in your head.", "Estimate first when it helps.", "Choose the accurate decimal answer."] },
  { id: "geometry_grid", name: "Geometry", title: "Shape Shift", tagline: "Angles, area, sides and space.", emoji: "📐", category: "learn", color: "#8b5cf6", minutes: 3, isNew: true,
    blurb: "Core geometry vocabulary and shape reasoning.", how: ["Read the shape or measurement question.", "Think about sides, angles, area, or perimeter.", "Choose the best geometry answer."] },
  { id: "money_math", name: "Money Math", title: "Cash Quest", tagline: "Count it. Spend it. Make the change.", emoji: "💵", category: "learn", color: "#16a34a", minutes: 3, isNew: true,
    blurb: "Practice coins, totals, prices, and change.", how: ["Read the money situation.", "Add or subtract the amounts.", "Choose the correct total or change."] },
  { id: "time_trial", name: "Elapsed Time", title: "Clock Rush", tagline: "Beat the clock by reading the clock.", emoji: "⏱️", category: "learn", color: "#f97316", minutes: 3, isNew: true,
    blurb: "Tell time and solve elapsed-time challenges.", how: ["Find the starting time.", "Add or subtract the minutes.", "Choose the ending time or elapsed time."] },
  { id: "estimation_station", name: "Estimation", title: "Close Enough", tagline: "Think fast before you calculate.", emoji: "🎯", category: "learn", color: "#eab308", minutes: 3, isNew: true,
    blurb: "Build number sense with useful estimates.", how: ["Round the numbers to friendly values.", "Do the easier mental math.", "Choose the answer closest to the real result."] },
  { id: "science_lab", name: "Science Lab", title: "Nova Lab", tagline: "Matter, forces, life and Earth.", emoji: "🧪", category: "learn", color: "#06b6d4", minutes: 3, isNew: true,
    blurb: "Middle-grade science facts and concepts.", how: ["Read the science question.", "Use what you know about life, Earth, matter, and forces.", "Choose the best scientific answer."] },
  { id: "states_capitals", name: "U.S. States & Capitals", title: "State Sprint", tagline: "Cross the map one capital at a time.", emoji: "🗺️", category: "learn", color: "#22c55e", minutes: 3, isNew: true,
    blurb: "Build U.S. geography knowledge with states and capitals.", how: ["Read the state named in the question.", "Recall or reason out its capital.", "Choose the correct city."] },
  { id: "history_hustle", name: "U.S. History", title: "Time Traveler", tagline: "Race through the moments that shaped history.", emoji: "⌛", category: "learn", color: "#b45309", minutes: 3, isNew: true,
    blurb: "Important U.S. events, documents, people, and dates.", how: ["Read the history clue.", "Connect it to the right event, person, document, or year.", "Choose the best-supported answer."] },

];

export const GAME_INFO: Record<string, GameInfo> = Object.fromEntries(GAMES.map((g) => [g.id, g]));
export const LEVEL_NAMES = ["", "Easy", "Medium", "Hard"] as const;
