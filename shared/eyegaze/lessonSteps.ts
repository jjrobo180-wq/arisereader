// Small shared facts about the built-in Eye Gazer lessons, kept apart from the lesson content
// (shared/eyegaze/lessons.ts) so the site can show step names without loading every lesson.

export type LessonStep = 1 | 2 | 3 | 4;

/** The steps the lessons are grouped into, easiest first (saved as each lesson's level). */
export const LESSON_STEPS: Record<LessonStep, { name: string; blurb: string }> = {
  1: { name: "Look & Find", blurb: "Hear a word and find its picture." },
  2: { name: "Name It", blurb: "Shapes, numbers, the body, clothes, weather and animal sounds." },
  3: { name: "Think It Through", blurb: "What we use, what goes together and who helps us." },
  4: { name: "Read & Answer", blurb: "Short stories, words and signs." },
};

/** Points for passing (70% or more) a lesson quiz the first time it is taken. */
export const LESSON_POINTS = 10;

/** Where the lesson pictures live (client/public/eyegaze/pictures). */
export const PICTURE_DIR = "/eyegaze/pictures";
export const picturePath = (key: string) => `${PICTURE_DIR}/${key}.svg`;

/** Real animal recordings (client/public/animal-sounds, credits in credits.html). */
export const soundPath = (key: string) => `/animal-sounds/${key}.mp3`;

/** How a question's answer cards look: just pictures, pictures with their word, or just words. */
export type ChoiceStyle = "pictures" | "both" | "words";

/** The extra details saved with each lesson question (eye_gaze_questions.extras). */
export type QuestionExtras = {
  /** What the voice says; never gives the answer away. */
  say: string;
  show: ChoiceStyle;
  /** Show the question picture this many times (counting). */
  count?: number;
  /** A word to read, shown big (the voice does not say it). */
  word?: string;
  /** An animal sound to play with the question. */
  sound?: string;
  /** A second picture shown next to the question picture. */
  picture2?: string;
};

/** One "learn" card shown before a lesson's quiz (eye_gaze_quizzes.learn_cards). */
export type SavedLearnCard = {
  word: string;
  picture: string;
  say: string;
  count?: number;
  picture2?: string;
  sound?: string;
};
