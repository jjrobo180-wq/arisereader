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
  name: string;
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
  { id: "four", name: "Connect Four", emoji: "🔴", category: "board", color: "#2563eb", minutes: 4,
    blurb: "Drop discs and line up four.", how: ["Drop a disc into any column.", "Get four in a row across, down, or diagonally.", "Block your opponent's lines!"] },
  { id: "checkers", name: "Checkers", emoji: "⚫", category: "board", color: "#dc2626", minutes: 10, isNew: true,
    blurb: "Jump pieces and crown your kings.", how: ["Move diagonally forward one square.", "Jump over an opponent's piece to capture it. Jumps are required!", "Reach the far side to become a king that moves both ways.", "Capture or block every piece to win."] },
  { id: "reversi", name: "Reversi", emoji: "⚪", category: "board", color: "#16a34a", minutes: 8, isNew: true,
    blurb: "Trap discs to flip them your color.", how: ["Place a disc so it traps a line of your opponent's discs.", "Every trapped disc flips to your color.", "Corners can never be flipped. Grab them!", "Most discs at the end wins."] },
  { id: "mancala", name: "Mancala", emoji: "🌰", category: "board", color: "#b45309", minutes: 6, isNew: true,
    blurb: "Sow stones and fill your store.", how: ["Pick one of your pits to scoop up its stones.", "Drop them one at a time to the right, around the board.", "Land in your store to go again.", "Land in an empty pit on your side to capture the stones across."] },
  { id: "dots", name: "Dots & Boxes", emoji: "🔲", category: "board", color: "#7c3aed", minutes: 6, isNew: true,
    blurb: "Close boxes to claim them.", how: ["Draw one line between two dots.", "Finish the fourth side of a box to claim it and go again.", "Try not to draw the third side of a box!", "Most boxes wins."] },
  { id: "gomoku", name: "Five in a Row", emoji: "⭕", category: "board", color: "#0891b2", minutes: 6, isNew: true,
    blurb: "Like tic-tac-toe, but get five.", how: ["Take turns placing stones on the grid.", "Get five in a row in any direction to win.", "Block four-in-a-row before it is too late!"] },

  // Quick & Fun
  { id: "tictactoe", name: "Tic-Tac-Toe", emoji: "❌", category: "quick", color: "#f97316", minutes: 1, isNew: true,
    blurb: "The classic three in a row.", how: ["Take turns marking a square.", "Three in a row wins.", "Full board with no line is a tie."] },
  { id: "gobble", name: "Gobble Tac Toe", emoji: "🥚", category: "quick", color: "#ec4899", minutes: 3, isNew: true,
    blurb: "Big pieces gobble small ones.", how: ["You have small, medium, and large pieces.", "Place a piece, or cover a smaller piece with a bigger one.", "You can also move one of your pieces that is on top.", "Three of your pieces showing in a row wins."] },
  { id: "rps", name: "Rock Paper Scissors", emoji: "✊", category: "quick", color: "#8b5cf6", minutes: 1, isNew: true,
    blurb: "First to three wins.", how: ["Both players pick at the same time.", "Rock beats scissors, scissors beats paper, paper beats rock.", "First to 3 round wins takes the match."] },
  { id: "memory", name: "Memory Match", emoji: "🃏", category: "quick", color: "#14b8a6", minutes: 4, isNew: true,
    blurb: "Flip cards and find pairs.", how: ["Flip two cards each turn.", "Find a matching pair to keep it and go again.", "Remember where cards are when your opponent flips them!", "Most pairs wins."] },

  // Brain Battles
  { id: "ultimate", name: "Ultimate Tic-Tac-Toe", emoji: "🧩", category: "brain", color: "#6366f1", minutes: 8, isNew: true,
    blurb: "Nine boards. One big game.", how: ["Win a small board by getting three in a row inside it.", "The square you pick sends your opponent to that board.", "Win three small boards in a row to win the game."] },
  { id: "seabattle", name: "Sea Battle", emoji: "🚢", category: "brain", color: "#0284c7", minutes: 7, isNew: true,
    blurb: "Find and sink the hidden fleet.", how: ["Shuffle your fleet, then press Ready.", "Take turns firing at your opponent's waters.", "💥 means hit, 🌊 means miss.", "Sink all four ships to win."] },
  { id: "codebreaker", name: "Code Breaker", emoji: "🔐", category: "brain", color: "#059669", minutes: 5, isNew: true,
    blurb: "Crack the secret color code.", how: ["Guess a code of 4 different colors.", "● means a right color in the right spot. ○ means right color, wrong spot.", "You and your rival each crack your own code at the same time.", "Crack it in fewer guesses to win."] },
  { id: "nim", name: "Last Stone", emoji: "🥌", category: "brain", color: "#64748b", minutes: 2, isNew: true,
    blurb: "Take the very last stone.", how: ["Take as many stones as you want from ONE pile.", "Players take turns.", "Whoever takes the last stone wins."] },
  { id: "fifteen", name: "Fifteen", emoji: "🔢", category: "brain", color: "#d946ef", minutes: 2, isNew: true,
    blurb: "Collect three numbers that add to 15.", how: ["Take turns picking numbers 1 to 9.", "Each number can be picked once.", "First to hold three numbers that add up to exactly 15 wins."] },

  // Cards & Dice
  { id: "eights", name: "Crazy Eights", emoji: "🎴", category: "cards", color: "#e11d48", minutes: 6, isNew: true,
    blurb: "Match suit or number. 8s are wild!", how: ["Play a card that matches the suit or number on top.", "An 8 can be played anytime. Pick the new suit!", "No match? Draw a card.", "First to empty their hand wins."] },
  { id: "gofish", name: "Go Fish", emoji: "🐟", category: "cards", color: "#2563eb", minutes: 7, isNew: true,
    blurb: "Ask for cards and collect sets.", how: ["Ask your opponent for a card rank you hold.", "If they have it, they hand it over and you go again.", "If not, Go Fish! Draw a card.", "Collect all four of a rank to make a book. Most books wins."] },
  { id: "pig", name: "Pig", emoji: "🎲", category: "cards", color: "#f43f5e", minutes: 4, isNew: true,
    blurb: "Roll your luck to 50 points.", how: ["Roll the die to add points to your turn total.", "Roll a 1 and you lose this turn's points!", "Hold to bank your points.", "First to 50 wins."] },

  // Word Games
  { id: "word_tiles", name: "Word Tiles", emoji: "🔤", category: "words", color: "#7c3aed", minutes: 3,
    blurb: "Spot the real word.", how: ["One tile is a real word. The others are scrambled.", "Both players answer at the same time.", "Right answers in a row earn streak bonus points."] },
  { id: "word_rescue", name: "Word Rescue", emoji: "🛟", category: "words", color: "#059669", minutes: 4,
    blurb: "Guess letters to solve the word.", how: ["Read the clue and pick a letter.", "A right letter earns another turn.", "Whoever solves the word wins. Making the 8th miss loses!"] },
  { id: "synonym_sprint", name: "Synonym Sprint", emoji: "📚", category: "words", color: "#ec4899", minutes: 3,
    blurb: "Match words with the same meaning.", how: ["Find the word that means the same (or the opposite).", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "sentence_fix", name: "Sentence Fix", emoji: "✏️", category: "words", color: "#8b5cf6", minutes: 3,
    blurb: "Pick the perfect sentence.", how: ["Choose the sentence with correct capitals, punctuation, and grammar.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "spelling", name: "Spell It Right", emoji: "🐝", category: "words", color: "#eab308", minutes: 3, isNew: true,
    blurb: "Find the correct spelling.", how: ["One word is spelled correctly. Find it!", "Both players answer at the same time.", "Streaks earn bonus points."] },

  // Math & Trivia
  { id: "math_duel", name: "Math Duel", emoji: "➗", category: "learn", color: "#f59e0b", minutes: 3,
    blurb: "Fast, accurate math.", how: ["Solve the math problem.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "pattern_power", name: "Pattern Power", emoji: "🔁", category: "learn", color: "#06b6d4", minutes: 3,
    blurb: "What comes next?", how: ["Find the number that continues the pattern.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "fact_dash", name: "Fact Dash", emoji: "🔬", category: "learn", color: "#ef4444", minutes: 3,
    blurb: "Science and nature facts.", how: ["Answer science and world questions.", "Both players answer at the same time.", "Streaks earn bonus points."] },
  { id: "geography", name: "World Explorer", emoji: "🌎", category: "learn", color: "#22c55e", minutes: 3, isNew: true,
    blurb: "Capitals, continents, and landmarks.", how: ["Answer questions about places around the world.", "Both players answer at the same time.", "Streaks earn bonus points."] },
];

export const GAME_INFO: Record<string, GameInfo> = Object.fromEntries(GAMES.map((g) => [g.id, g]));
export const LEVEL_NAMES = ["", "Easy", "Medium", "Hard"] as const;
