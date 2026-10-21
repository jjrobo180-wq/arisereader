// The student welcome show: a 5-minute presentation of A.R.I.S.E. Reader for a room of students.
// This file is the script. What is said is also what is shown at the bottom of the screen, so a student who
// cannot hear (a big room, a noisy gym) can follow along. Each "beat" is one thing the screen does while the
// caption is up. Every claim here matches what the site really does, and the numbers come from the real catalogs.
import { READABLE_BOOKS } from "./readsCatalog";
import { POEMS } from "./poems";
import { NEWS_ARTICLES, NEWS_POINTS } from "./ariseNews";

export type SceneId = "welcome" | "login" | "library" | "reads" | "quiz" | "leaderboard" | "competition" | "wrap";
export type Beat = { say: string };
export type Scene = {
  id: SceneId;
  title: string;
  /** One line for the person presenting: what to ask or point out. Not shown to students. */
  tip: string;
  beats: Beat[];
};

/** The address students type. */
export const SITE = "arisereader.com";
/** The show is built to run about this long when it plays by itself. */
export const TARGET_SECONDS = 300;
/** How fast the captions are read, in words a second, and the pause kept after each one. */
const WORDS_PER_SECOND = 2.6;
const PAUSE_SECONDS = 1.6;

export const words = (text: string) => (text.trim() ? text.trim().split(/\s+/).length : 0);
/** How long a beat stays up: long enough to read aloud at an easy pace, then a breath. */
export const beatSeconds = (beat: Beat) => Math.round((PAUSE_SECONDS + words(beat.say) / WORDS_PER_SECOND) * 10) / 10;

/** The shortest read of the Short reads list that has a picture cover of its own, for the example. */
export const EXAMPLE_SHORT_READ = READABLE_BOOKS.find((b) => b.key === "velveteen-rabbit")!;
export const readMinutes = (wordCount: number) => Math.max(1, Math.round(wordCount / 200));

const books = READABLE_BOOKS.length;
const poems = POEMS.length;
const articles = NEWS_ARTICLES.length;
const exampleMinutes = readMinutes(EXAMPLE_SHORT_READ.words);

export const SCENES: Scene[] = [
  {
    id: "welcome", title: "Welcome",
    tip: "Ask the room: who has read a book this month? Hands up, then start.",
    beats: [
      { say: "Welcome to A.R.I.S.E. Reader! In the next five minutes you will learn how to log in, find a book, take a quiz, and win prizes." },
      { say: "A.R.I.S.E. is a reading program. You read, you take a quiz on what you read, and every quiz you pass earns you points." },
      { say: "The name stands for Advocating, Resilience, Inclusion, Support, and Empowerment. It means every reader belongs here, and every reader can grow." },
    ],
  },
  {
    id: "login", title: "Log in",
    tip: "Say the address out loud and slowly. Students who have an account can log in on their own device while you talk.",
    beats: [
      { say: `Step one: logging in. Open ${SITE} on any computer, tablet, or phone.` },
      { say: "New here? Tap Create, then School Student. Pick your school, your grade, and your teacher, then choose a username and a password." },
      { say: "Already have an account? Tap Sign in, type your username and your password, and tap Log in." },
      { say: "Keep your password private, and write it somewhere safe so you never forget it." },
    ],
  },
  {
    id: "library", title: "Your library",
    tip: "Point at the points on the book covers. Students like knowing a book is worth more.",
    beats: [
      { say: "This is your Library, home base for everything you read. At the top you can see your name, your points, and how many quizzes you have taken." },
      { say: "Looking for something? Type a title or an author in the search bar, and the books you want show up." },
      { say: "Every book shows how many points it is worth: 5, 10, 20, or 30 points." },
      { say: "Found one? Tap Read to read it, or read your own copy. When you finish, tap Quiz." },
    ],
  },
  {
    id: "reads", title: "Short reads",
    tip: "If the class has a few minutes left, this is the part to try live: open Read on Arise and pick a poem together.",
    beats: [
      { say: `Want to read right now? Open Read on Arise from the menu. It has ${books} classic books, ${poems} poems, and ${articles} articles, all free to read right there.` },
      { say: `Short on time? Tap Short reads to see stories you can finish in one sitting. The Velveteen Rabbit takes about ${exampleMinutes} minutes.` },
      { say: "Poems are even shorter. Each one is only a few lines, and the words to know and the questions come with it." },
      { say: `The articles are quick news stories, about two minutes each. Read one, pass the quiz, and earn ${NEWS_POINTS} points.` },
    ],
  },
  {
    id: "quiz", title: "Take a quiz",
    tip: "Stress the one try. Then the 70 percent line. Most questions are answered in the book, so reading carefully is the whole trick.",
    beats: [
      { say: "Now the quiz. Here is the book, and here are the questions." },
      { say: "Read each question carefully and tap the answer you think is right. Need help? Tap Listen and the question is read out loud to you." },
      { say: "The button at the bottom counts your answers. When every question is answered, it lights up. Tap it to turn your quiz in. You only get one try, so take your time." },
      { say: "And here is your score! You need 70 percent to pass. Pass, and you earn the points for that book, plus a certificate you can download." },
      { say: "If you think a question was marked wrong, tap Request Manual Review and your teacher will take a look." },
    ],
  },
  {
    id: "leaderboard", title: "Leaderboard",
    tip: "Tell them which month it is and how long is left. The countdown on screen is live.",
    beats: [
      { say: "Every point you earn lands on the Leaderboard. Open Progress and Rewards in your menu to see it." },
      { say: "You race students in your own grade band, K to 2, 3 to 5, 6 to 8, or 9 to 12, so the race is always fair." },
      { say: "Monthly shows this month's race, and the clock counts down to when it closes. All-Time adds up every point you have ever earned." },
      { say: "The top three stand on the podium. Everyone else is listed below, with how many quizzes they have passed." },
      { say: "There is also the Advisory Challenge. Every quiz you pass adds points to your advisory class, so you are racing as a team." },
    ],
  },
  {
    id: "competition", title: "Competitions",
    tip: "Say what this month's and this year's prizes are, if your school has set any.",
    beats: [
      { say: "The Reading Competition has two parts. Each month, the top readers in every grade band are named the current leaders." },
      { say: "At the end of the year, the readers with the most points all year earn the title Reader of the Year. Nothing is final until then, so keep reading!" },
      { say: "Prizes come from the grown-ups around you: your teacher, your school, even your family. When there is a prize to win, it shows up right here as a ticket." },
    ],
  },
  {
    id: "wrap", title: "Let's go",
    tip: "End on the address. If you can, let students log in right now.",
    beats: [
      { say: "So that is the whole plan: log in, find a book, read it, pass the quiz, earn points, and climb the leaderboard." },
      { say: `Open ${SITE} and log in. Let's get reading!` },
    ],
  },
];

export type FlatBeat = { scene: number; beat: number; id: SceneId; say: string; seconds: number; start: number };

/** Every beat in order, with when it starts if the show plays by itself. */
export function flatten(scenes: Scene[] = SCENES): FlatBeat[] {
  const out: FlatBeat[] = [];
  let start = 0;
  scenes.forEach((scene, si) => scene.beats.forEach((beat, bi) => {
    const seconds = beatSeconds(beat);
    out.push({ scene: si, beat: bi, id: scene.id, say: beat.say, seconds, start });
    start += seconds;
  }));
  return out;
}

export const FLAT = flatten();
export const totalSeconds = (flat: FlatBeat[] = FLAT) => (flat.length ? Math.round((flat[flat.length - 1].start + flat[flat.length - 1].seconds) * 10) / 10 : 0);

/** "4:05" */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The index in FLAT of the first beat of a scene. */
export const firstBeatOf = (scene: number, flat: FlatBeat[] = FLAT) => Math.max(0, flat.findIndex((b) => b.scene === scene));
