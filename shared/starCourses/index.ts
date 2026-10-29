// A.R.I.S.E. Connect "Learn with a Star": 20 celebrity-led courses, 5 lessons each (100 lessons).
// Ten are music stars. The Stars page shows these first, organized by the star.
import type { Course } from "../connectCourses";
import type { ConnectVideo } from "../connectVideos";
import { MUSIC_1 } from "./music1";
import { MUSIC_2 } from "./music2";
import { MORE_1 } from "./more1";
import { MORE_2 } from "./more2";
import { LAW } from "./law";
import { MECHANIC } from "./mechanic";
import { DOCTOR } from "./doctor";
import { FAST_FOOD } from "./fastfood";
import { MORE_3 } from "./more3";

const FIRST = [...MUSIC_1, ...MUSIC_2, ...MORE_1, ...MORE_2];
// Career paths added later: Law, Auto Mechanic, Doctor, Fast Food (12 courses), plus 8 more stars
// for the existing paths. 20 courses, 5 lessons each: 100 more lessons.
const CAREER = [...LAW, ...MECHANIC, ...DOCTOR, ...FAST_FOOD, ...MORE_3];
const ALL = [...FIRST, ...CAREER];

/** The first 20 "Learn with a Star" courses. */
export const STAR_COURSES: Course[] = FIRST.map((b) => b.course);
/** The next 20: the Law, Auto Mechanic, Doctor and Fast Food paths plus more stars for the other paths. */
export const CAREER_STAR_COURSES: Course[] = CAREER.map((b) => b.course);
export const STAR_LESSON_VIDEOS: Record<string, ConnectVideo[][]> = Object.fromEntries(ALL.map((b) => [b.course.id, b.lessonVideos]));
export const STAR_SPOTLIGHT: Record<string, ConnectVideo[]> = Object.fromEntries(ALL.map((b) => [b.course.id, b.spotlight]));
export const STAR_COURSE_SKILLS: Record<string, string[]> = Object.fromEntries(ALL.map((b) => [b.course.id, b.skills]));

/** Career paths built from the star courses. */
export const STAR_PATHS = [
  { id: "music-stars", title: "Music Makers", blurb: "Produce, write, score and perform with ten music legends.", field: "music" as const,
    courses: ["s-quincy", "s-timbaland", "s-pharrell", "s-taylor", "s-sheeran", "s-zimmer", "s-aliciakeys", "s-billie", "s-linmanuel", "s-batiste"] },
  { id: "screen-stars", title: "Screens & Games", blurb: "Make movies, videos and games with Spielberg, Ava DuVernay, MrBeast, Miyamoto and Ninja.", field: "film" as const, courses: ["s-spielberg", "s-duvernay", "s-mrbeast", "s-miyamoto", "s-ninja"] },
  { id: "doers", title: "Builders & Doers", blurb: "Cook, build, start a business and train like a pro.", field: "trades" as const, courses: ["s-gordon", "s-rowe", "s-savage", "s-blakely", "s-daymond", "s-curry", "s-biles"] },
  { id: "science-stars", title: "Science & Space", blurb: "Experiments, astronauts and medicine.", field: "air" as const, courses: ["s-nye", "s-hadfield", "s-gupta", "s-tyson"] },
];

/** Career paths an admin can pick for a student (and anyone can browse). */
export const CAREER_PATHS = [
  { id: "lawyer", title: "Lawyer: Law & Justice", blurb: "Courts, judges and defense lawyers with Ruth Bader Ginsburg, Sonia Sotomayor and Bryan Stevenson.", field: "law" as const, courses: ["s-rbg", "s-sotomayor", "s-stevenson"] },
  { id: "mechanic", title: "Auto Mechanic", blurb: "Engines, custom builds and real repairs with Jay Leno, Chip Foose and ChrisFix.", field: "trades" as const, courses: ["s-leno", "s-foose", "s-chrisfix", "s-savage"] },
  { id: "doctor", title: "Doctor & Medicine", blurb: "The road to MD, surgery and medicine in space with Doctor Mike, Dr. Atul Gawande and Dr. Mae Jemison.", field: "health" as const, courses: ["s-doctormike", "s-gawande", "s-jemison", "s-gupta"] },
  { id: "fastfood", title: "Fast Food & Restaurants", blurb: "From your first shift to owning the restaurant with Shaq, Guy Fieri and Danny Meyer.", field: "food" as const, courses: ["s-shaq", "s-fieri", "s-meyer", "s-gordon"] },
];
