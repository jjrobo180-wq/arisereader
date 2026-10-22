// A.R.I.S.E. Connect: YouTube videos for the career courses and the careers in Explore.
//
// Every video here was checked against YouTube (its title and channel, through YouTube's own
// oEmbed lookup) when it was added on Oct 21, 2026. They come from channels made for teaching or
// careers (CareerOneStop from the U.S. Department of Labor, Crash Course, Code.org, TED, PBS, CNN 10,
// CBC Kids) or from the celebrity's own channel or a news outlet. The page plays them through
// youtube-nocookie.com, and always offers "Watch on YouTube" in case a school blocks embeds.
//
// - LESSON_VIDEOS: one video per lesson, in lesson order ("Watch", step 1 of the lesson).
// - COURSE_STARS: the celebrity spotlight on each course page, and the "Learn from the stars" row.
// - CAREER_VIDEOS: a career video for a career card in Explore (CareerOneStop, one per job).
// tests/arise-social.test.ts checks every course and lesson has its video.

export type ConnectVideo = {
  id: string;
  title: string;
  by: string;
  /** For a celebrity video: who they are, in a few words. */
  star?: string;
  role?: string;
};

const V = (id: string, title: string, by: string, star?: string, role?: string): ConnectVideo =>
  star ? { id, title, by, star, role } : { id, title, by };

const COS = "CareerOneStop", CC = "CrashCourse", CODE = "Code.org";

export const LESSON_VIDEOS: Record<string, ConnectVideo[]> = {
  elec: [
    V("HsLLq6Rm5tU", "Ohm's law explained: the basics of circuits", "The Engineering Mindset"),
    V("n1gWyBOn4OM", "Lockout/tagout safety training", "Safelyio"),
    V("Rw8gAGYZ6qs", "Electricians career video", COS),
  ],
  engr: [
    V("MFGg1calQ6k", "The engineering design process", "Smithsonian National Air and Space Museum"),
    V("btGYcizV0iI", "What is engineering?", CC),
    V("-xbtnz4wdaA", "Civil engineering", CC),
  ],
  film: [
    V("7lIpcJVbbSA", "The director: Crash Course Film Production with Lily Gladstone", CC, "Lily Gladstone", "Golden Globe-winning actress"),
    V("53C4JPULu68", "All camera shot sizes explained", "Shawn Dolinski"),
    V("iW0bKUfvH2c", "The 180-degree rule in film", "StudioBinder"),
  ],
  musc: [
    V("c2BA8Ze525Y", "Quincy Jones explains how he got started in music", "American Masters PBS", "Quincy Jones", "Producer of Michael Jackson's Thriller"),
    V("ahNN8BvNLn0", "GarageBand drums: kicks, hi-hats, snares and claps", "Zee Wavy"),
    V("TflQCpu4vos", "Music directors and composers career video", COS),
  ],
  hlth: [
    V("dcTh4RGOAhM", "How to measure your heart rate", "Just Adapt It."),
    V("x4Y_2fpET0U", "Registered nurses career video", COS),
    V("C8zIHk9KKqI", "EMTs and paramedics career video", COS),
  ],
  tech: [
    V("OAx_6-wdslM", "Introducing How Computers Work", CODE),
    V("m2Ux2PnJe6E", "Bill Gates explains if statements", CODE, "Bill Gates", "Co-founder of Microsoft"),
    V("_WQ_VV4pXPc", "Software developers career video", COS),
  ],
  weld: [
    V("rzTzmkoSLg4", "Welders career video", COS),
    V("I8TfQJyjZCQ", "The differences between TIG, MIG and stick welding", "KingMetalsInc"),
    V("S3eD8n6f5iU", "How to get a successful welding career", "Western Welding Academy"),
  ],
  biz: [
    V("zC4-AZ-hKUk", "What is profit? Business training for kids", "StudentForce"),
    V("l6XM-rr2vm0", "How getting stung by a bee led Mikaila Ulmer to Shark Tank", "Jemele Hill", "Mikaila Ulmer", "Started Me & the Bees Lemonade at age 4"),
    V("9tlqA6DmlBQ", "Daymond John makes a deal with a young Shark Tank entrepreneur", "CNBC Ambition", "Daymond John", "Shark Tank investor, founder of FUBU"),
  ],
  culn: [
    V("mZlUTUBPnnw", "Food safety and hygiene for kids", "Twinkl Educational Publishing"),
    V("ZJy1ajvMU1k", "How to master 5 basic cooking skills", "Gordon Ramsay", "Gordon Ramsay", "Chef with 17 Michelin stars over his career"),
    V("BtAevVMysC0", "Chefs and head cooks career video", COS),
  ],
  sprt: [
    V("rD-gxpQpibA", "Exploring careers in the sports industry", "CNN 10"),
    V("fgW9YauJbQI", "Athletic trainers career video", COS),
    V("ZHALrtdG9CI", "Coaches and scouts career video", COS),
  ],
  avia: [
    V("S9D_5FOjrkU", "The four forces of flight: lift, weight, thrust and drag", "The Digital Classroom Experience"),
    V("oey4mi_QV48", "Airline and commercial pilots career video", COS),
    V("eyxboEBruiU", "My Job Is Awesome! Astronaut Chris Hadfield", "CBC Kids", "Chris Hadfield", "Astronaut and space station commander"),
  ],
};

/** The celebrity spotlight on each course page: famous people who do (or champion) this work. */
export const COURSE_STARS: Record<string, ConnectVideo[]> = {
  elec: [V("HJRyMQiTJF4", "How much welding and other SkillsUSA trades can make you", "Mike Rowe", "Mike Rowe", "Host of Dirty Jobs, champion of the trades")],
  weld: [V("HJRyMQiTJF4", "How much welding and other SkillsUSA trades can make you", "Mike Rowe", "Mike Rowe", "Host of Dirty Jobs, champion of the trades")],
  engr: [V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", "Dr. Mae Jemison", "First Black woman in space, engineer and doctor")],
  film: [
    V("GhGtkdQEjAA", "Steven Spielberg gives advice to young filmmakers", "celluloidVideo", "Steven Spielberg", "Director of E.T. and Jurassic Park"),
    V("7lIpcJVbbSA", "The director: Crash Course Film Production", CC, "Lily Gladstone", "Golden Globe-winning actress"),
  ],
  musc: [
    V("H3TF-hI7zKc", "How sampling transformed music", "TED", "Mark Ronson", "Grammy-winning producer"),
    V("DrnywDs1BMw", "The best advice Quincy Jones ever got", "Spotify for Artists", "Quincy Jones", "Producer of Michael Jackson's Thriller"),
  ],
  hlth: [
    V("SRBaa03pQTc", "Exploring the brain with 10-year-old Sean the Science Kid", "CNN", "Dr. Sanjay Gupta", "Brain surgeon and CNN's chief medical correspondent"),
    V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", "Dr. Mae Jemison", "Doctor, engineer and astronaut"),
  ],
  tech: [
    V("nKIu9yen5nc", "What most schools don't teach", CODE, "Bill Gates, Mark Zuckerberg, will.i.am & Chris Bosh", "Tech founders, a music star and an NBA champion"),
    V("m2Ux2PnJe6E", "Bill Gates explains if statements", CODE, "Bill Gates", "Co-founder of Microsoft"),
  ],
  biz: [
    V("9tlqA6DmlBQ", "Daymond John makes a deal with a young Shark Tank entrepreneur", "CNBC Ambition", "Daymond John", "Shark Tank investor, founder of FUBU"),
    V("l6XM-rr2vm0", "How getting stung by a bee led Mikaila Ulmer to Shark Tank", "Jemele Hill", "Mikaila Ulmer", "Started Me & the Bees Lemonade at age 4"),
  ],
  culn: [V("ZJy1ajvMU1k", "How to master 5 basic cooking skills", "Gordon Ramsay", "Gordon Ramsay", "Chef with 17 Michelin stars over his career")],
  sprt: [V("UgAQXzCGvv0", "Steph Curry on being underrated and his advice for young players", "PBS News Student Reporting Labs", "Stephen Curry", "Four-time NBA champion")],
  avia: [
    V("ock40tBO-C0", "Chris Hadfield describes how he became an astronaut", "Ontario Science Centre", "Chris Hadfield", "Astronaut and space station commander"),
    V("6Vy0ncmUvUw", "Teach arts and sciences together", "TED", "Dr. Mae Jemison", "First Black woman in space"),
  ],
};

/** A career video for a career in Explore, by career id (shared/ariseSocial.ts). */
export const CAREER_VIDEOS: Record<string, ConnectVideo> = {
  plumber: V("uF3-2wFnf0E", "Plumbers, pipefitters and steamfitters career video", COS),
  electrician: V("Rw8gAGYZ6qs", "Electricians career video", COS),
  autotech: V("ARAUXc6Cbxw", "Automotive service technicians career video", COS),
  welder: V("rzTzmkoSLg4", "Welders career video", COS),
  hvac: V("PNcQwekI2KQ", "Heating, air conditioning and refrigeration mechanics career video", COS),
  carpenter: V("i-tiC2Y-038", "Carpenters career video", COS),
  firefighter: V("DNK5dYGn3Fg", "Firefighters career video", COS),
  teacher: V("VRB818Z8Xhs", "Elementary school teachers career video", COS),
  librarian: V("MyOpL1Q8N-Y", "Librarian career video", COS),
  nurse: V("x4Y_2fpET0U", "Registered nurses career video", COS),
  emt: V("C8zIHk9KKqI", "EMTs and paramedics career video", COS),
  hygienist: V("TeAtDfCQ0J4", "Dental hygienists career video", COS),
  vettech: V("CHuStDPc2pM", "Veterinary technicians career video", COS),
  socialworker: V("HvzxznYOhQM", "Child, family and school social workers career video", COS),
  stylist: V("wqgol3sEFvI", "Hairstylists, barbers and cosmetologists career video", COS),
  designer: V("dt6td67yF9E", "Graphic designer career video", COS),
  chef: V("BtAevVMysC0", "Chefs and head cooks career video", COS),
  softdev: V("_WQ_VV4pXPc", "Software developers career video", COS),
  cyber: V("cVZktAEtWE4", "Information security career video", COS),
  farmer: V("b7ULrhxJwPs", "Farmers and ranchers career video", COS),
  ranger: V("PCAudFo7Eo4", "Conservation scientists career video", COS),
  engineer: V("a4vYNrfZ6Wo", "Civil engineering technician career video", COS),
  pilot: V("oey4mi_QV48", "Airline and commercial pilots career video", COS),
};

export const isVideoId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{11}$/.test(id);
