// A.R.I.S.E. Connect "Learn with a Star": 20 celebrity-led courses, 5 lessons each (100 lessons).
// Ten are music stars. The Stars page shows these first, organized by the star.
import type { Course } from "../connectCourses";
import type { ConnectVideo } from "../connectVideos";
import { MUSIC_1 } from "./music1";
import { MUSIC_2 } from "./music2";
import { MORE_1 } from "./more1";
import { MORE_2 } from "./more2";

const ALL = [...MUSIC_1, ...MUSIC_2, ...MORE_1, ...MORE_2];

export const STAR_COURSES: Course[] = ALL.map((b) => b.course);
export const STAR_LESSON_VIDEOS: Record<string, ConnectVideo[][]> = Object.fromEntries(ALL.map((b) => [b.course.id, b.lessonVideos]));
export const STAR_SPOTLIGHT: Record<string, ConnectVideo[]> = Object.fromEntries(ALL.map((b) => [b.course.id, b.spotlight]));
export const STAR_COURSE_SKILLS: Record<string, string[]> = Object.fromEntries(ALL.map((b) => [b.course.id, b.skills]));

/** Career paths built from the star courses. */
export const STAR_PATHS = [
  { id: "music-stars", title: "Music Makers", blurb: "Produce, write, score and perform with ten music legends.", field: "music" as const,
    courses: ["s-quincy", "s-timbaland", "s-pharrell", "s-taylor", "s-sheeran", "s-zimmer", "s-aliciakeys", "s-billie", "s-linmanuel", "s-batiste"] },
  { id: "screen-stars", title: "Screens & Games", blurb: "Make movies, videos and games with Spielberg, MrBeast and Miyamoto.", field: "film" as const, courses: ["s-spielberg", "s-mrbeast", "s-miyamoto"] },
  { id: "doers", title: "Builders & Doers", blurb: "Cook, build, start a business and train like a pro.", field: "trades" as const, courses: ["s-gordon", "s-rowe", "s-blakely", "s-curry"] },
  { id: "science-stars", title: "Science & Space", blurb: "Experiments, astronauts and medicine.", field: "air" as const, courses: ["s-nye", "s-hadfield", "s-gupta"] },
];
