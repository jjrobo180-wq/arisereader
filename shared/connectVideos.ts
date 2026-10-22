// A.R.I.S.E. Connect: YouTube videos for the career courses and the careers in Explore.
//
// EVERY video here is of a famous or well-known person: Gordon Ramsay, Mike Rowe, Bill Nye,
// Steven Spielberg, Quincy Jones, Timbaland, Bill Gates, Mark Zuckerberg, Shigeru Miyamoto, Ninja,
// Steph Curry, John Wooden, Chris Hadfield, Sully Sullenberger, Daymond John, Sara Blakely… No
// generic how-to channels and no government career clips. tests/connect-stars.test.ts checks that
// every video names its star.
//
// - LESSON_VIDEOS: for each course, one list per lesson (in lesson order): the lesson's "Watch"
//   video first, then a backup from another star in case YouTube ever removes the first.
// - COURSE_STARS: the star spotlight on each course page, and the "Learn from the stars" row.
// - CAREER_VIDEOS: each career's first star video (shared/ariseConnectVideos.ts has all of them).
//
// The server (GET /api/social/videos) asks YouTube about every id and the page skips any that are
// gone or can't be embedded, falling back to the backup. Played via youtube-nocookie.com.

import { STAR_VIDEOS } from "./ariseConnectVideos";
import { STAR_LESSON_VIDEOS, STAR_SPOTLIGHT } from "./starCourses";

export type ConnectVideo = {
  id: string;
  title: string;
  /** The YouTube channel or show it is from. */
  by: string;
  /** Who the famous person is. */
  star: string;
  /** Why kids know them, in a few words. */
  role: string;
};

const V = (id: string, title: string, by: string, star: string, role: string): ConnectVideo => ({ id, title, by, star, role });

const ROWE = ["Mike Rowe", "Host of Dirty Jobs, champion of the trades"] as const;
const NYE = ["Bill Nye", "The Science Guy, former Boeing engineer"] as const;
const GORDON = ["Gordon Ramsay", "Chef, MasterChef & Hell's Kitchen"] as const;
const SPIELBERG = ["Steven Spielberg", "Director of E.T. and Jurassic Park"] as const;
const QUINCY = ["Quincy Jones", "Producer of Michael Jackson's Thriller"] as const;
const MIYAMOTO = ["Shigeru Miyamoto", "Creator of Mario & Zelda"] as const;
const HADFIELD = ["Chris Hadfield", "Astronaut and space station commander"] as const;
const SULLY = ["Captain \"Sully\" Sullenberger", "Pilot of the Miracle on the Hudson"] as const;
const JEMISON = ["Dr. Mae Jemison", "First Black woman in space, engineer and doctor"] as const;
const GUPTA = ["Dr. Sanjay Gupta", "Brain surgeon & CNN's chief medical correspondent"] as const;
const DAYMOND = ["Daymond John", "Shark Tank investor, founder of FUBU"] as const;
const BLAKELY = ["Sara Blakely", "Founder of Spanx, self-made billionaire"] as const;
const STRAHAN = ["Michael Strahan", "Super Bowl champion turned TV host"] as const;

export const LESSON_VIDEOS: Record<string, ConnectVideo[][]> = {
  elec: [
    [V("gixkpsrxk4Y", "Bill Nye the Science Guy: Electricity", "Bill Nye the Science Guy", ...NYE), V("Z-77IzaXGcg", "Bill Nye on static electricity", "Bill Nye the Science Guy", ...NYE)],
    [V("Ei54PSCHgRQ", "Mike Rowe on staying safe on the job", "Dirty Jobs", ...ROWE), V("llNJ8hPa6eU", "Mike Rowe talks about skilled trades", "USA Science & Engineering Festival", ...ROWE)],
    [V("llNJ8hPa6eU", "Mike Rowe talks about skilled trades", "USA Science & Engineering Festival", ...ROWE), V("HJRyMQiTJF4", "What welding and other SkillsUSA trades can pay", "Mike Rowe", ...ROWE)],
  ],
  engr: [
    [V("c0bsKc4tiuY", "Why you should make useless things", "TED", "Simone Giertz", "Inventor and YouTube robot builder"), V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", ...JEMISON)],
    [V("KGrH2eeS31A", "Bill Nye on going from Boeing engineer to Science Guy", "Bill Nye", ...NYE), V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", ...JEMISON)],
    [V("F9oysYLGXCY", "Bill Nye the Science Guy: Structures", "Bill Nye the Science Guy", ...NYE), V("bkJrmG-DoVg", "Bill Nye the Science Guy: Structures", "Bill Nye the Science Guy", ...NYE)],
  ],
  film: [
    [V("GhGtkdQEjAA", "Steven Spielberg gives advice to young filmmakers", "celluloidVideo", ...SPIELBERG), V("7lIpcJVbbSA", "The director: Crash Course Film Production", "CrashCourse", "Lily Gladstone", "Golden Globe-winning actress")],
    [V("nBH89Y0Xj7c", "Steven Spielberg on storyboarding his shots", "Steven Spielberg", ...SPIELBERG), V("yqDv-kxcFzU", "Spielberg on storyboarding", "Steven Spielberg", ...SPIELBERG)],
    [V("k9mjR3TDVjk", "Spielberg on his shot choices in Duel", "Steven Spielberg", ...SPIELBERG), V("eIvL4A7gdk4", "Martin Scorsese teaches filmmaking", "MasterClass", "Martin Scorsese", "Director of Hugo and Goodfellas")],
  ],
  musc: [
    [V("c2BA8Ze525Y", "Quincy Jones explains how he got started in music", "American Masters PBS", ...QUINCY), V("DrnywDs1BMw", "The best advice Quincy Jones ever got", "Spotify for Artists", ...QUINCY)],
    [V("qn8vyp3rkuY", "Timbaland takes us through his beat-making process", "Timbaland", "Timbaland", "Producer for Justin Timberlake & Missy Elliott"), V("H3TF-hI7zKc", "How sampling transformed music", "TED", "Mark Ronson", "Grammy-winning producer")],
    [V("H3TF-hI7zKc", "How sampling transformed music", "TED", "Mark Ronson", "Grammy-winning producer"), V("DrnywDs1BMw", "The best advice Quincy Jones ever got", "Spotify for Artists", ...QUINCY)],
  ],
  hlth: [
    [V("SRBaa03pQTc", "Exploring the brain with 10-year-old Sean the Science Kid", "CNN", ...GUPTA), V("eGWaTJAY4Ms", "Dr. Sanjay Gupta on keeping your heart healthy", "CNN", ...GUPTA)],
    [V("L3QkaS249Bc", "How do we heal medicine? (checklists and teamwork)", "TED", "Dr. Atul Gawande", "Surgeon and best-selling author"), V("CGwOMM896Po", "Atul Gawande: the power of checklists", "Atul Gawande", "Dr. Atul Gawande", "Surgeon and best-selling author")],
    [V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", ...JEMISON), V("LcmFlerUbMs", "Dr. Sanjay Gupta on being a doctor", "CNN", ...GUPTA)],
  ],
  tech: [
    [V("5oHe0ozN7Oc", "Chris Bosh on computer science", "Code.org", "Chris Bosh", "Two-time NBA champion"), V("nKIu9yen5nc", "What most schools don't teach", "Code.org", "Bill Gates, Mark Zuckerberg, will.i.am & Chris Bosh", "Tech founders, a music star and an NBA champion")],
    [V("m2Ux2PnJe6E", "Bill Gates explains if statements", "Code.org", "Bill Gates", "Co-founder of Microsoft"), V("h2utzJaHwfc", "Mark Zuckerberg explains loops", "Code.org", "Mark Zuckerberg", "Founder of Facebook")],
    [V("nKIu9yen5nc", "What most schools don't teach", "Code.org", "Bill Gates, Mark Zuckerberg, will.i.am & Chris Bosh", "Tech founders, a music star and an NBA champion"), V("wVn1TqUfZjc", "Mark Zuckerberg on helping others learn to code", "Code.org", "Mark Zuckerberg", "Founder of Facebook")],
  ],
  weld: [
    [V("Pm_p6urP7Wg", "Mike Rowe has a hard time making galvanized steel", "Dirty Jobs", ...ROWE), V("HJRyMQiTJF4", "What welding and other SkillsUSA trades can pay", "Mike Rowe", ...ROWE)],
    [V("lv1Kv5iE-NM", "Jessi Combs on welding gear and getting started", "Lincoln Electric", "Jessi Combs", "TV fabricator & world's fastest woman on four wheels"), V("ahTkSveYYG8", "Jessi Combs at FABTECH", "Lincoln Electric", "Jessi Combs", "TV fabricator & world's fastest woman on four wheels")],
    [V("Ei54PSCHgRQ", "Mike Rowe on welding safety", "Dirty Jobs", ...ROWE), V("HJRyMQiTJF4", "What welding and other SkillsUSA trades can pay", "Mike Rowe", ...ROWE)],
  ],
  biz: [
    [V("l6XM-rr2vm0", "How getting stung by a bee led Mikaila Ulmer to Shark Tank", "Jemele Hill", "Mikaila Ulmer", "Started Me & the Bees Lemonade at age 4"), V("9tlqA6DmlBQ", "Daymond John makes a deal with a young entrepreneur", "CNBC Ambition", ...DAYMOND)],
    [V("cPsM7yyZFhM", "Sara Blakely: shaping the world with Spanx", "Sara Blakely", ...BLAKELY), V("zmcvoPmh1v0", "Sara Blakely's start-up tips", "Sara Blakely", ...BLAKELY)],
    [V("9tlqA6DmlBQ", "Daymond John makes a deal with a young Shark Tank entrepreneur", "CNBC Ambition", ...DAYMOND), V("zmcvoPmh1v0", "Sara Blakely's start-up tips", "Sara Blakely", ...BLAKELY)],
  ],
  culn: [
    [V("m7KxHDDgeA4", "Gordon Ramsay shows the right way to wash your hands in the kitchen", "Gordon Ramsay", ...GORDON), V("-cnfV-okA80", "Gordon Ramsay's kitchen fire safety tips", "Gordon Ramsay", ...GORDON)],
    [V("ZJy1ajvMU1k", "How to master 5 basic cooking skills", "Gordon Ramsay", ...GORDON), V("FTociictyyE", "Gordon Ramsay's top basic cooking skills", "Gordon Ramsay", ...GORDON)],
    [V("KChuTeEtKog", "Gordon Ramsay: teaching kids to cook is as important as history", "MasterChef Junior", ...GORDON), V("gyrHEz_s4JI", "Cooking with Coach Gordon Ramsay", "Gordon Ramsay", ...GORDON)],
  ],
  sprt: [
    [V("yo36aDIPuE4", "Michael Strahan on his TV career and life after football", "CBS", ...STRAHAN), V("_4rJm2q-Q9c", "Michael Strahan on how to pivot in your career", "Michael Strahan", ...STRAHAN)],
    [V("KkmKUASy-p0", "LeBron James' workout explained by his trainer", "LeBron James", "LeBron James", "Four-time NBA champion"), V("UgAQXzCGvv0", "Steph Curry's advice for young players", "PBS News Student Reporting Labs", "Stephen Curry", "Four-time NBA champion")],
    [V("0MM-psvqiG8", "The difference between winning and succeeding", "TED", "Coach John Wooden", "Legendary UCLA basketball coach, 10 titles"), V("yo36aDIPuE4", "Michael Strahan on his TV career and life after football", "CBS", ...STRAHAN)],
  ],
  avia: [
    [V("VhReoAJZzpE", "How do airplanes fly?", "StarTalk", "Neil deGrasse Tyson", "Astrophysicist & host of Cosmos"), V("QHpSwJPlZ6o", "Sully Sullenberger on being a pilot", "Sully Sullenberger", ...SULLY)],
    [V("QHpSwJPlZ6o", "Sully Sullenberger on being a pilot", "Sully Sullenberger", ...SULLY), V("w6EblErBJqw", "Sully's minute-by-minute Miracle on the Hudson", "Sully Sullenberger", ...SULLY)],
    [V("eyxboEBruiU", "My Job Is Awesome! Astronaut Chris Hadfield", "CBC Kids", ...HADFIELD), V("lMtXfwk7PXg", "What happens when you wring out a washcloth in space", "Canadian Space Agency", ...HADFIELD)],
  ],
  game: [
    [V("zRGRJRUWafY", "How Miyamoto designed Mario's World 1-1", "Eurogamer", ...MIYAMOTO), V("ctps4c6GP7Y", "Miyamoto explains how World 1-1 was created", "Shigeru Miyamoto", ...MIYAMOTO)],
    [V("K-NBcP0YUQI", "How the inventor of Mario designs a game", "Shigeru Miyamoto", ...MIYAMOTO), V("VL47n61uihs", "Shigeru Miyamoto on designing Super Mario Run", "Shigeru Miyamoto", ...MIYAMOTO)],
    [V("qLEYZmdMdkw", "Ninja on balancing gaming with the rest of your life", "Ninja", "Ninja", "Pro gamer & Fortnite streamer"), V("BXhFxMwVaEY", "Faker on his career and staying healthy", "Faker", "Faker", "Greatest League of Legends player ever")],
  ],
};

/** The star spotlight on each course page: famous people who do (or champion) this work. */
export const COURSE_STARS: Record<string, ConnectVideo[]> = {
  elec: [V("HJRyMQiTJF4", "What welding and other SkillsUSA trades can pay", "Mike Rowe", ...ROWE), V("IRVdiHu1VCc", "Learning from dirty jobs", "TED", ...ROWE)],
  weld: [V("HJRyMQiTJF4", "What welding and other SkillsUSA trades can pay", "Mike Rowe", ...ROWE), V("lv1Kv5iE-NM", "Jessi Combs on welding", "Lincoln Electric", "Jessi Combs", "TV fabricator & world's fastest woman on four wheels")],
  engr: [V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", ...JEMISON), V("c0bsKc4tiuY", "Why you should make useless things", "TED", "Simone Giertz", "Inventor and YouTube robot builder"), V("KGrH2eeS31A", "From Boeing engineer to Science Guy", "Bill Nye", ...NYE)],
  film: [
    V("GhGtkdQEjAA", "Steven Spielberg gives advice to young filmmakers", "celluloidVideo", ...SPIELBERG),
    V("7lIpcJVbbSA", "The director: Crash Course Film Production", "CrashCourse", "Lily Gladstone", "Golden Globe-winning actress"),
    V("0N0db76twqc", "The Rock on bringing Moana to life", "Disney", "Dwayne \"The Rock\" Johnson", "Actor, voice of Maui in Moana"),
  ],
  musc: [
    V("H3TF-hI7zKc", "How sampling transformed music", "TED", "Mark Ronson", "Grammy-winning producer"),
    V("DrnywDs1BMw", "The best advice Quincy Jones ever got", "Spotify for Artists", ...QUINCY),
    V("iek9NCtca3w", "How Ed Sheeran wrote \"Sing\"", "Ed Sheeran", "Ed Sheeran", "Singer-songwriter"),
    V("WkGkKzvnSJc", "Taylor Swift explains how she writes songs", "Taylor Swift", "Taylor Swift", "Singer-songwriter"),
  ],
  hlth: [
    V("SRBaa03pQTc", "Exploring the brain with 10-year-old Sean the Science Kid", "CNN", ...GUPTA),
    V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", "Dr. Mae Jemison", "Doctor, engineer and astronaut"),
  ],
  tech: [
    V("nKIu9yen5nc", "What most schools don't teach", "Code.org", "Bill Gates, Mark Zuckerberg, will.i.am & Chris Bosh", "Tech founders, a music star and an NBA champion"),
    V("m2Ux2PnJe6E", "Bill Gates explains if statements", "Code.org", "Bill Gates", "Co-founder of Microsoft"),
    V("zRGRJRUWafY", "How Miyamoto designed Mario's World 1-1", "Eurogamer", ...MIYAMOTO),
  ],
  biz: [
    V("9tlqA6DmlBQ", "Daymond John makes a deal with a young Shark Tank entrepreneur", "CNBC Ambition", ...DAYMOND),
    V("l6XM-rr2vm0", "How getting stung by a bee led Mikaila Ulmer to Shark Tank", "Jemele Hill", "Mikaila Ulmer", "Started Me & the Bees Lemonade at age 4"),
    V("cPsM7yyZFhM", "Sara Blakely: shaping the world with Spanx", "Sara Blakely", ...BLAKELY),
  ],
  culn: [
    V("ZJy1ajvMU1k", "How to master 5 basic cooking skills", "Gordon Ramsay", ...GORDON),
    V("PUP7U5vTMM0", "Gordon Ramsay's perfect scrambled eggs", "Gordon Ramsay", ...GORDON),
    V("gyrHEz_s4JI", "Cooking with Coach Gordon Ramsay", "Gordon Ramsay", ...GORDON),
  ],
  sprt: [
    V("UgAQXzCGvv0", "Steph Curry on being underrated and his advice for young players", "PBS News Student Reporting Labs", "Stephen Curry", "Four-time NBA champion"),
    V("HHxRBljtoqU", "73 questions with Simone Biles", "Vogue", "Simone Biles", "Olympic gymnastics champion"),
    V("0MM-psvqiG8", "The difference between winning and succeeding", "TED", "Coach John Wooden", "Legendary UCLA basketball coach, 10 titles"),
  ],
  avia: [
    V("ock40tBO-C0", "Chris Hadfield describes how he became an astronaut", "Ontario Science Centre", ...HADFIELD),
    V("tO8oVmvvD2Y", "Sunita Williams' tour of the space station", "NASA", "Sunita Williams", "NASA astronaut"),
    V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", "Dr. Mae Jemison", "First Black woman in space"),
  ],
  game: [
    V("zRGRJRUWafY", "How Miyamoto designed Mario's World 1-1", "Eurogamer", ...MIYAMOTO),
    V("XKOcqJhSTj0", "Ninja debunks the biggest video game myths", "WIRED", "Ninja", "Pro gamer & Fortnite streamer"),
    V("BXhFxMwVaEY", "Faker on his career and staying healthy", "Faker", "Faker", "Greatest League of Legends player ever"),
  ],
};

// The "Learn with a Star" courses bring their own lesson videos and spotlights (shared/starCourses).
Object.assign(LESSON_VIDEOS, STAR_LESSON_VIDEOS);
Object.assign(COURSE_STARS, STAR_SPOTLIGHT);

/** Each career's first star video (all of them: STAR_VIDEOS in shared/ariseConnectVideos.ts). */
export const CAREER_VIDEOS: Record<string, ConnectVideo> = {};
for (const v of STAR_VIDEOS) for (const c of v.careers) if (!CAREER_VIDEOS[c]) CAREER_VIDEOS[c] = V(v.id, v.title, v.star, v.star, v.known);

/** Every video id used anywhere on Connect, for the server's YouTube check. */
export function allConnectVideoIds(): string[] {
  const ids = new Set<string>(STAR_VIDEOS.map((v) => v.id));
  for (const lessons of Object.values(LESSON_VIDEOS)) for (const list of lessons) for (const v of list) ids.add(v.id);
  for (const list of Object.values(COURSE_STARS)) for (const v of list) ids.add(v.id);
  return [...ids];
}

export const isVideoId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
