// The student welcome show: a 5-minute presentation of A.R.I.S.E. Reader for the students of C.G.M.S. (Conservatory Green Middle School).
// This file is the script. What is said is also what is shown at the bottom of the screen, so a student who
// cannot hear (a big room, a noisy gym) can follow along. Each "beat" is one thing the screen does while the
// caption is up. Every claim here matches what the site really does at C.G.M.S.: accounts are made for the students, the username and starting password are the student number,
// and the prizes are the ones the school has set.

export type SceneId = "welcome" | "login" | "library" | "reads" | "quiz" | "leaderboard" | "prizes" | "wrap";
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

export const SCENES: Scene[] = [
  {
    id: "welcome", title: "Welcome",
    tip: "Ask the room: who has read a book this month? Hands up, then start.",
    beats: [
      { say: "Welcome, C.G.M.S.! In the next five minutes you will see how to sign in, find a book, take a quiz, and win prizes." },
      { say: "A.R.I.S.E. Reader is our reading program. You read, you take a quiz on what you read, and every quiz you pass earns you points." },
      { say: "A.R.I.S.E. stands for Advocating, Resilience, Inclusion, Support, and Empowerment. Every reader belongs here, and every reader can grow." },
    ],
  },
  {
    id: "login", title: "Sign in",
    tip: "Say the address out loud and slowly. Your students' accounts are already made, so they can sign in on their own devices while you talk. Remind them it is their student number, twice.",
    beats: [
      { say: `Step one: signing in. On any computer, open ${SITE}, then click Student sign in.` },
      { say: "Your account is already made, so there is nothing to create. Your username and your password are both your student number." },
      { say: "The first time you sign in, it asks you to create a new password. Pick one only you know, and write it down somewhere safe." },
      { say: "Then it asks who your ELA teacher is. Start typing their name, tap it in the list, and save. That's it. You're in." },
    ],
  },
  {
    id: "library", title: "Your library",
    tip: "Point at the points on the book covers. Students like knowing a book is worth more.",
    beats: [
      { say: "This is your Library, home base for everything you read. At the top you can see your name, your points, and how many quizzes you have taken." },
      { say: "There are hundreds of books to choose from. Type a title or an author in the search bar to find one." },
      { say: "Every book shows how many points it is worth: 5, 10, 20, or 30. Tap Read to read it, and tap Quiz when you are done." },
    ],
  },
  {
    id: "reads", title: "Short reads",
    tip: "If the class has a few minutes left, this is the part to try live: open Read on Arise and pick a poem together.",
    beats: [
      { say: "Want to read right now? Open Read on Arise from the menu. It has hundreds of choices, all free to read right there." },
      { say: "Short on time? Tap Short reads to see stories you can finish in one sitting." },
      { say: "Poems and quick news articles count too. Read one, pass the quiz, and earn points." },
    ],
  },
  {
    id: "quiz", title: "Take a quiz",
    tip: "Stress the two ways to take the quiz, then the warning rule, then the one try. Most questions are answered in the book, so reading carefully is the best study.",
    beats: [
      { say: "When you finish a book, tap Quiz. First you choose how to take it. There are two options." },
      { say: "Option one: with a proctor. Your teacher or a parent types in their private password to unlock the quiz for you." },
      { say: "Option two: on your own. Your camera stays on and takes pictures while you test, so your teacher and parents can see it was really you." },
      { say: "Stay on the quiz page. If you leave it, you get one warning. If you leave a second time, your quiz turns in by itself." },
      { say: "Answer every question, then tap Submit. You only get one try, so take your time." },
      { say: "You need 70 percent to pass. Pass, and you earn the points, plus a certificate. If you think a question was marked wrong, tap Request Manual Review." },
    ],
  },
  {
    id: "leaderboard", title: "Leaderboard",
    tip: "Tell them which month it is and how long is left. The countdown on screen is live.",
    beats: [
      { say: "Every point you earn lands on the Leaderboard. Open Progress and Rewards in your menu to see it." },
      { say: "You race students in your own grade band, so the race is always fair. Monthly shows this month, and All-Time adds up every point you have ever earned." },
      { say: "The top three stand on the podium. Everyone else is listed below, with how many quizzes they have passed." },
      { say: "There is also the Advisory Challenge. Every quiz you pass adds points to your advisory, so you are racing as a team." },
    ],
  },
  {
    id: "prizes", title: "Prizes",
    tip: "This is the part they remember. Say the date, November 20th, and say it again at the end. Everyone starts at zero.",
    beats: [
      { say: "Now, the prizes! The Advisory Challenge started at zero on October 20th. On November 20th, the advisory with the most points wins a pizza party." },
      { say: "Every month, the top reader of that month wins free DoorDash, whatever food you choose, delivered right to school." },
      { say: "At the end of the year, the Reader of the Year wins AirPods, or another prize worth up to 200 dollars." },
      { say: "And you do not have to be first to win. Every month there is a raffle. Complete a quiz and you are entered, and winners are picked at random all month long." },
      { say: "The prizes could be a 5 dollar Target gift card, a 5 dollar Roblox gift card, snacks, a dress-down day, and so much more." },
    ],
  },
  {
    id: "wrap", title: "Let's go",
    tip: "End on the address. If you can, let students sign in right now.",
    beats: [
      { say: "So that is the whole plan: sign in, find a book, read it, pass the quiz, earn points, and climb the leaderboard." },
      { say: `Go to ${SITE}, click Student sign in, and let's get reading!` },
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

/** A short fingerprint of a line's words. The voice clip's address carries it, so a clip saved (by the browser or a cache) for an older version of the script can never be played under the wrong caption. */
export function lineKey(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(36);
}
export const totalSeconds = (flat: FlatBeat[] = FLAT) => (flat.length ? Math.round((flat[flat.length - 1].start + flat[flat.length - 1].seconds) * 10) / 10 : 0);

/** "4:05" */
export const clock = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** The index in FLAT of the first beat of a scene. */
export const firstBeatOf = (scene: number, flat: FlatBeat[] = FLAT) => Math.max(0, flat.findIndex((b) => b.scene === scene));
