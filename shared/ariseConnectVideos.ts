// A.R.I.S.E. Connect: "Learn from the stars." Every video here is a YouTube video of a famous or
// well-known person (Gordon Ramsay, Ninja, Simone Biles, Shigeru Miyamoto, Mike Rowe…) talking
// about or doing the work of a career on Connect, so each career ("course") has real people kids
// already know showing what the job looks like. Nothing else is shown: no generic channels.
//
// Each video is tied to one or more careers in shared/ariseSocial.ts (tests check every career id
// exists). `ages: "all"` videos are fine for K–5; "teen" ones are only shown to grades 6–12,
// parents and teachers. `try` is one thing to do after watching.
//
// The server (GET /api/social/videos) asks YouTube about every video and hides any that are gone,
// private, or can't be played on other sites, and shows the real title and channel YouTube gives.
// "More from …" opens a YouTube search for the star, so a kid can always find more.

export type StarVideo = {
  id: string;
  /** Who is in it. */
  star: string;
  /** Why kids know them, in a few words. */
  known: string;
  /** What the video is about (YouTube's own title is shown when the server has it). */
  title: string;
  careers: string[];
  ages: "all" | "teen";
  /** One thing to try after watching. */
  try: string;
};

const V = (id: string, star: string, known: string, title: string, careers: string[], ages: "all" | "teen", tryIt: string): StarVideo =>
  ({ id, star, known, title, careers, ages, try: tryIt });

const GORDON = "Gordon Ramsay", GORDON_K = "Chef, MasterChef & Hell's Kitchen";
const ROWE = "Mike Rowe", ROWE_K = "Host of Dirty Jobs";

export const STAR_VIDEOS: StarVideo[] = [
  // ── Create ──
  V("PUP7U5vTMM0", GORDON, GORDON_K, "Gordon Ramsay's perfect scrambled eggs", ["chef"], "all", "With a grown-up, make scrambled eggs Gordon's way: low heat, keep stirring, take them off early."),
  V("FTociictyyE", GORDON, GORDON_K, "Gordon Ramsay's top basic cooking skills", ["chef"], "all", "Practice one skill from the video, like holding the knife the safe way (with an adult)."),
  V("gyrHEz_s4JI", GORDON, GORDON_K, "Cooking with Coach Gordon Ramsay", ["chef"], "all", "Help cook dinner one night this week and be in charge of one step."),
  V("KChuTeEtKog", GORDON, GORDON_K, "Why Gordon Ramsay says kids should learn to cook", ["chef"], "all", "Write down one recipe you want to learn and ask a grown-up to teach you."),
  V("E3MpiIG5Uoo", GORDON, GORDON_K, "Gordon Ramsay's beginner's guide to cooking", ["chef"], "teen", "Plan, shop for and cook one simple meal for your family."),
  V("RPd4xnU3R2U", "MrBeast", "Biggest YouTuber in the world", "MrBeast on counting to 100,000 in his first viral video", ["creator"], "all", "Write down 3 video ideas that would help or surprise people."),
  V("zDWxyxj7cR0", "MrBeast", "Biggest YouTuber in the world", "MrBeast's advice on growing on YouTube", ["creator"], "teen", "Watch one of your favorite videos and write why you kept watching."),
  V("rwlkZ6Renc0", "Tinker Hatfield", "Designed the Air Jordan sneakers", "Inside Nike with designer Tinker Hatfield", ["designer"], "all", "Sketch your own sneaker and label why you made each choice."),
  V("INnGtaKlk8Q", "Tinker Hatfield", "Designed the Air Jordan sneakers", "Tinker Hatfield on designing the Air Jordan", ["designer"], "teen", "Redesign something you use every day and draw the before and after."),
  V("QoCBQ7-l0T0", "Jonathan Van Ness", "Hairstylist on Queer Eye", "Jonathan Van Ness answers hair questions", ["stylist"], "teen", "Learn one braid or style from a tutorial and practice it."),

  // ── Play & Perform ──
  V("qLEYZmdMdkw", "Ninja", "Pro gamer & Fortnite streamer", "Ninja on balancing gaming with the rest of your life", ["progamer"], "all", "Set a game-time limit for a week and see how your play changes."),
  V("XKOcqJhSTj0", "Ninja", "Pro gamer & Fortnite streamer", "Ninja debunks the biggest video game myths", ["progamer"], "teen", "Watch a replay of your own game and write one thing to do better."),
  V("BXhFxMwVaEY", "Faker", "Greatest League of Legends player ever", "Faker on his career and staying healthy", ["progamer"], "teen", "Look up whether your school or a nearby college has an esports team."),
  V("UgAQXzCGvv0", "Stephen Curry", "NBA champion & greatest shooter", "Steph Curry's advice for young players", ["athlete"], "all", "Practice one skill for 15 minutes a day this week and track it."),
  V("HHxRBljtoqU", "Simone Biles", "Olympic gymnastics champion", "73 questions with Simone Biles", ["athlete"], "all", "Write one goal for your sport and three small steps toward it."),
  V("7O1BFRdVfu4", "Serena Williams", "23-time Grand Slam tennis champion", "Serena Williams teaches her daughter tennis", ["athlete"], "all", "Teach someone younger a skill you are good at."),
  V("IpQoFL8R3vk", "LeBron James", "NBA champion", "LeBron James opens his I Promise School", ["athlete", "entrepreneur"], "all", "Think of one way you could help kids in your town, and tell your class."),
  V("iek9NCtca3w", "Ed Sheeran", "Singer-songwriter", "How Ed Sheeran wrote \"Sing\"", ["musician"], "all", "Write four lines of a song about your day."),
  V("WkGkKzvnSJc", "Taylor Swift", "Singer-songwriter", "Taylor Swift explains how she writes songs", ["musician"], "all", "Keep a notebook of song ideas for a week."),
  V("0N0db76twqc", "Dwayne \"The Rock\" Johnson", "Actor, voice of Maui in Moana", "The Rock on bringing Moana to life", ["actor"], "all", "Read a scene out loud with a friend, trying two different voices."),

  // ── Code & Tech ──
  V("nKIu9yen5nc", "Bill Gates, Mark Zuckerberg & more", "Founders of Microsoft & Facebook", "What most schools don't teach: why to learn to code", ["softdev", "gamedesigner"], "all", "Do one Hour of Code activity at code.org."),
  V("wVn1TqUfZjc", "Mark Zuckerberg", "Founder of Facebook", "Mark Zuckerberg on learning to code", ["softdev"], "all", "Build a tiny game or animation in Scratch."),
  V("zRGRJRUWafY", "Shigeru Miyamoto", "Creator of Mario & Zelda", "How Miyamoto designed Mario's World 1-1", ["gamedesigner"], "all", "Draw the first level of your own game on paper. What does it teach the player?"),
  V("VL47n61uihs", "Shigeru Miyamoto", "Creator of Mario & Zelda", "Shigeru Miyamoto on designing Super Mario Run", ["gamedesigner"], "all", "Play a game and write down one rule you would change, and why."),
  V("DLoRd6_a1CI", "Shigeru Miyamoto", "Creator of Mario & Zelda", "Super Mario Bros. 30th anniversary interview", ["gamedesigner"], "all", "Make a paper prototype of a game and have someone play it."),
  V("LaypU4qAuYw", "Kevin Mitnick", "Famous hacker turned security expert", "Kevin Mitnick on how hackers think", ["cyber"], "teen", "Turn on two-step sign-in for one of your accounts with a parent."),

  // ── Engineer & Fly ──
  V("lMtXfwk7PXg", "Chris Hadfield", "Astronaut, commander of the ISS", "What happens when you wring out a washcloth in space", ["astronaut", "scientist"], "all", "Guess what would happen to other things in space, then look it up."),
  V("KaOC9danxNo", "Chris Hadfield", "Astronaut, commander of the ISS", "Chris Hadfield sings Space Oddity on the space station", ["astronaut", "musician"], "all", "Find the space station in the night sky with a spotting app."),
  V("tO8oVmvvD2Y", "Sunita Williams", "NASA astronaut", "Sunita Williams' tour of the space station", ["astronaut"], "all", "Draw a map of the space station from the tour."),
  V("QHpSwJPlZ6o", "Captain \"Sully\" Sullenberger", "Pilot of the Miracle on the Hudson", "Sully Sullenberger on being a pilot", ["pilot"], "all", "Build three paper airplanes and test which flies farthest."),
  V("w6EblErBJqw", "Captain \"Sully\" Sullenberger", "Pilot of the Miracle on the Hudson", "Sully's minute-by-minute Miracle on the Hudson", ["pilot"], "teen", "Write a checklist for something you do every day, the way pilots do."),
  V("KGrH2eeS31A", "Bill Nye", "The Science Guy, former Boeing engineer", "Bill Nye on going from Boeing engineer to Science Guy", ["engineer", "scientist"], "all", "Build a bridge from paper and test how many coins it holds."),

  // ── Build & Fix ──
  V("vwu3qscFyOA", ROWE, ROWE_K, "Mike Rowe cleans out the inside of a water tower", ["plumber"], "all", "With an adult, find where the water shut-off valve is in your home."),
  V("llNJ8hPa6eU", ROWE, ROWE_K, "Mike Rowe on skilled trades", ["electrician", "hvac", "welder", "plumber", "carpenter"], "all", "Ask a grown-up who works in a trade what they like about it."),
  V("HJRyMQiTJF4", ROWE, ROWE_K, "Mike Rowe on what welding and other trades can pay", ["welder", "electrician", "hvac"], "teen", "Look up a SkillsUSA chapter or CTE class near you."),
  V("IRVdiHu1VCc", ROWE, ROWE_K, "Mike Rowe's TED talk: learning from dirty jobs", ["plumber", "welder", "electrician", "hvac"], "teen", "Write about a job most people overlook and why it matters."),
  V("Exnrs4w3U4Q", "Chip Gaines", "Fixer Upper", "Chip Gaines: there's no demo day without your hammer", ["carpenter"], "all", "With an adult, hammer a nail and drive a screw into scrap wood."),
  V("wy8OaXOQKm0", "Jay Leno", "Talk-show host & car collector", "Jay Leno's Garage: a Honda with two engines", ["autotech"], "all", "Pop the hood with an adult and find the oil dipstick."),
  V("Hhdtt5COH6w", "Jay Leno", "Talk-show host & car collector", "Jay Leno explains the Wankel rotary engine", ["autotech", "engineer"], "teen", "Look up how a four-stroke engine works and explain it to someone."),

  // ── Grow & Explore ──
  V("51z7WRDjOjM", "Jane Goodall", "Famous chimpanzee scientist", "Jane Goodall: what separates us from chimpanzees?", ["scientist", "ranger"], "all", "Watch an animal for 10 minutes and write down everything it does."),
  V("zMmw8_PJiT8", "Steve Irwin", "The Crocodile Hunter", "Steve Irwin's adventures in the Outback", ["ranger", "vettech"], "all", "Pick an animal near you and learn three facts about it."),
  V("LbHjEXHV6To", "Dr. Pol", "Star vet of The Incredible Dr. Pol", "Dr. Pol: saving animals seven days a week", ["vettech", "farmer"], "all", "Help take care of a pet or animal for a week."),
  V("NhYHAQTpgqU", "Neil deGrasse Tyson", "Astrophysicist & host of Cosmos", "Neil deGrasse Tyson: kids are born scientists", ["scientist"], "all", "Do one kitchen experiment and write what you predicted and what happened."),
  V("DSY_8ng9mBg", "Neil deGrasse Tyson", "Astrophysicist & host of Cosmos", "20 questions with Neil deGrasse Tyson", ["scientist", "astronaut"], "teen", "Write your own 5 big questions about space."),

  // ── Teach, Lead & Help ──
  V("F23ak31YnTI", "Rita Pierson", "Famous TED speaker & teacher", "Rita Pierson: every kid needs a champion", ["teacher", "counselor"], "all", "Thank a teacher who believed in you."),
  V("KJnBV3w9yDw", "LeVar Burton", "Host of Reading Rainbow", "LeVar Burton's Reading Rainbow book reviews", ["librarian", "teacher"], "all", "Make a 30-second book review of the last book you loved."),
  V("SXrPIWYw8fE", "Michelle Obama", "Former First Lady", "Michelle Obama honors the School Counselor of the Year", ["counselor"], "all", "Ask your school counselor one question about your future."),
  V("iCvmsMzlF7o", "Brené Brown", "Social worker & best-selling author", "Brené Brown: the power of vulnerability", ["socialworker", "counselor"], "teen", "Write about a time someone listened to you and how it helped."),
  V("UF8uR6Z6KLc", "Steve Jobs", "Co-founder of Apple", "Steve Jobs' Stanford commencement speech", ["entrepreneur", "softdev"], "teen", "List three things you love doing. Could any of them become a business?"),
  V("cPsM7yyZFhM", "Sara Blakely", "Founder of Spanx, self-made billionaire", "Sara Blakely on starting Spanx", ["entrepreneur"], "teen", "Think of a problem you have every day and sketch a product that fixes it."),
  V("zmcvoPmh1v0", "Sara Blakely", "Founder of Spanx, self-made billionaire", "Sara Blakely's start-up tips", ["entrepreneur"], "teen", "Write a one-minute pitch for a business idea."),

  // ── Protect, Serve & Heal ──
  V("pxBQLFLei70", "Admiral William McRaven", "Navy SEAL commander", "Admiral McRaven: if you want to change the world, make your bed", ["military"], "teen", "Make your bed every morning for a week."),
  V("LcmFlerUbMs", "Dr. Sanjay Gupta", "Brain surgeon & CNN medical reporter", "Dr. Sanjay Gupta on being a doctor", ["doctor"], "teen", "Learn how the heart pumps blood and explain it to your family."),
  V("_nvTtRj0z6E", "Doctor Mike", "Family doctor with millions of YouTube viewers", "A day in the life of Doctor Mike", ["doctor"], "teen", "Write down three questions you'd ask a doctor about their job."),

  // ── Law, Auto & Food (career paths: lawyer, mechanic, fast food) ──
  V("EHICz5MYxNQ", "Sonia Sotomayor", "Supreme Court Justice", "Justice Sotomayor and Abby talk about careers on Sesame Street", ["lawyer"], "all", "Ask a grown-up what their career is and how they trained for it."),
  V("b1719MlkeSE", "Ruth Bader Ginsburg", "Supreme Court Justice, 1993–2020", "Ruth Bader Ginsburg: journey to the Supreme Court", ["lawyer"], "teen", "Pick a rule you'd change and write three reasons, like a lawyer would."),
  V("O1hF25Cowv8", "ChrisFix", "YouTuber who teaches car repair to millions", "ChrisFix: how to change your oil", ["autotech"], "teen", "With an adult, find the oil dipstick in a car and check the level."),
  V("AMeX9jC4vCw", "Guy Fieri", "Chef & host of Diners, Drive-Ins and Dives", "Guy Fieri on restaurant industry careers", ["fastfood"], "all", "Plan a three-item menu for your own pretend restaurant."),
  V("PfjYTJe0xrc", "Shaquille O'Neal", "NBA legend & restaurant owner", "Shaq on running Big Chicken", ["fastfood", "entrepreneur"], "teen", "Pick a restaurant you like and list every job you see when you visit."),
];

export const starVideoById = (id: string) => STAR_VIDEOS.find((v) => v.id === id);
export const videosForCareer = (careerId: string) => STAR_VIDEOS.filter((v) => v.careers.includes(careerId));
export const ytThumb = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
export const ytSearchUrl = (star: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(star)}`;
export const VALID_VIDEO_ID = /^[\w-]{11}$/;
