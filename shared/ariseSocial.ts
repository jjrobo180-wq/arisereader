// Arise Social: a career-discovery network for students, their parents and their teachers.
// This file is the shared catalog (careers, quests, roadmap) and the scoring rules, used by
// server/ariseSocial.ts and sent to the page at /social/ by GET /api/social/catalog.

export type BandId = "k2" | "g35" | "g68" | "g912";
export type ClusterId = "build" | "serve" | "teach" | "heal" | "help" | "create" | "tech" | "nature" | "fly";
export type Cluster = { name: string; start: Record<BandId, string> };
/** pay: approximate U.S. median yearly wage in thousands of dollars (BLS, May 2024); null when it varies too much to say. */
export type Career = { id: string; name: string; c: ClusterId; soc: string; pay: number | null; paths: string[]; train: string; kid: string; teen: string; tools: string[] };
export type Quest = { id: string; c: ClusterId; title: string; xp: number; steps: string[]; reader?: boolean };

export const BANDS: Record<BandId, { label: string; crew: string }> = {
  k2: { label: "K–2", crew: "Explorers" },
  g35: { label: "3–5", crew: "Builders" },
  g68: { label: "6–8", crew: "Trailblazers" },
  g912: { label: "9–12", crew: "Launchers" },
};
export const BAND_IDS: BandId[] = ["k2", "g35", "g68", "g912"];

export const CLUSTERS: Record<ClusterId, Cluster> = {
  build: {name:'Build & Fix',      start:{k2:'Help a grown-up fix something at home and hand them the tools.', g35:'Take apart an old toy or radio (with permission) and name the parts.', g68:'Try shop, robotics, or a maker club. Fix one small thing a month.', g912:'Take a CTE or trades class, look up pre-apprenticeship programs, and join SkillsUSA.'}},
  serve: {name:'Protect & Serve',  start:{k2:'Learn your address and how to call 911 in an emergency.', g35:'Join scouts or a team where you practice teamwork and first aid.', g68:'Build fitness habits, try a leadership role, and read about each military branch.', g912:'Visit JROTC, talk to a recruiter with a parent, and try a practice ASVAB.'}},
  teach: {name:'Teach & Lead',     start:{k2:'Teach a stuffed animal (or a sibling) something you learned today.', g35:'Be a reading buddy for a younger kid.', g68:'Tutor a classmate or help coach a younger team.', g912:'Look into Educators Rising, dual-enrollment education classes, and summer camp counselor jobs.'}},
  heal:  {name:'Heal & Care',      start:{k2:'Practice washing hands the doctor way: 20 seconds.', g35:'Learn basic first aid and how the heart pumps.', g68:'Take a health science elective or a youth CPR class.', g912:'Earn CPR/First Aid, look at HOSA, and ask about CNA or EMT courses for teens.'}},
  help:  {name:'Help People',      start:{k2:'Notice when a friend is sad and ask how you can help.', g35:'Help with a food or coat drive at school.', g68:'Volunteer with a community group once a month.', g912:'Take psychology or sociology, and volunteer somewhere that serves families.'}},
  create:{name:'Create',           start:{k2:'Draw, build, or cook something new every week.', g35:'Make a comic, a short video, or a recipe card.', g68:'Start a portfolio folder with your best work.', g912:'Take art, culinary, or media classes and post work to your school portfolio.'}},
  tech:  {name:'Code & Tech',      start:{k2:'Play unplugged coding games (follow-the-arrows).', g35:'Try block coding and build a tiny game.', g68:'Join a coding or cyber club and finish one real project.', g912:'Take AP CS or a CTE IT pathway, try CyberPatriot, and build projects you can show.'}},
  nature:{name:'Grow & Explore',   start:{k2:'Plant a seed and check on it every day.', g35:'Keep a nature journal of animals and plants near you.', g68:'Join a garden club, 4-H, or FFA.', g912:'Take ag science or biology, and look for park or farm summer jobs.'}},
  fly:   {name:'Engineer & Fly',   start:{k2:'Build the tallest tower you can from cups or blocks.', g35:'Build and test paper airplanes. Which flies farthest?', g68:'Try a bridge challenge, rocketry, or a STEM club.', g912:'Take physics and math, and look at Civil Air Patrol or an aviation maintenance program.'}}
};

export const CAREERS: Career[] = [
  {id:'plumber', name:'Plumber', c:'build', soc:'47-2152', pay:63, paths:['Apprenticeship','License'], train:'4–5 yr apprenticeship, paid', kid:'Plumbers make sure clean water comes in and dirty water goes out.', teen:'Install and repair the pipes, fixtures, and water heaters in homes and buildings. High demand, and you get paid while you train.', tools:['Pipe wrench','PEX crimper','Camera snake']},
  {id:'electrician', name:'Electrician', c:'build', soc:'47-2111', pay:62, paths:['Apprenticeship','License'], train:'4–5 yr apprenticeship, paid', kid:'Electricians bring power to lights, plugs, and machines safely.', teen:'Wire new buildings, troubleshoot circuits, and install solar panels and EV chargers. Math and problem-solving every day.', tools:['Multimeter','Wire strippers','Conduit bender']},
  {id:'autotech', name:'Auto Technician', c:'build', soc:'49-3023', pay:50, paths:['Trade school','On the job'], train:'6 mo–2 yr program + certifications', kid:'Auto techs find out what is wrong with a car and fix it.', teen:'Diagnose engines, brakes, and electrical systems, including hybrids and EVs, using scan tools and computers.', tools:['OBD-II scanner','Torque wrench','Lift']},
  {id:'welder', name:'Welder', c:'build', soc:'51-4121', pay:52, paths:['Trade school','Apprenticeship'], train:'Months to 2 yr + certifications', kid:'Welders join metal together with super-hot light.', teen:'Fuse metal for bridges, ships, pipelines, and art. Certified welders can travel for high-paying jobs.', tools:['MIG welder','Auto-dark helmet','Angle grinder']},
  {id:'hvac', name:'HVAC Technician', c:'build', soc:'49-9021', pay:60, paths:['Trade school','Apprenticeship'], train:'6 mo–2 yr + EPA certification', kid:'HVAC techs keep buildings warm in winter and cool in summer.', teen:'Install and repair heating, cooling, and ventilation systems, including heat pumps that save energy.', tools:['Gauge manifold','Leak detector','Thermostat']},
  {id:'carpenter', name:'Carpenter', c:'build', soc:'47-2031', pay:59, paths:['Apprenticeship','On the job'], train:'3–4 yr apprenticeship, paid', kid:'Carpenters build houses, stairs, and cabinets out of wood.', teen:'Frame buildings, build forms for concrete, and finish trim. Many carpenters go on to run their own business.', tools:['Framing square','Circular saw','Chalk line']},
  {id:'military', name:'Military Service Member', c:'serve', soc:'55-0000', pay:null, paths:['Military'], train:'Basic training + job school (weeks to months)', kid:'Soldiers, sailors, airmen, Marines, and Guardians protect our country.', teen:'The Army, Navy, Air Force, Marines, Coast Guard, and Space Force have hundreds of jobs, from mechanic to medic to cyber. You get paid training, and programs like the GI Bill can help pay for college.', tools:['Teamwork','Fitness','Your job specialty']},
  {id:'firefighter', name:'Firefighter', c:'serve', soc:'33-2011', pay:60, paths:['On the job','Certificate'], train:'Fire academy + EMT certification', kid:'Firefighters put out fires and help people in emergencies.', teen:'Respond to fires, car crashes, and medical calls. Most departments also want EMT certification.', tools:['Hose & nozzle','SCBA air pack','Thermal camera']},
  {id:'teacher', name:'Elementary Teacher', c:'teach', soc:'25-2021', pay:64, paths:['4-year','License'], train:'Bachelor’s degree + state license', kid:'Teachers help kids learn to read, count, and discover new things.', teen:'Plan lessons, figure out how each kid learns best, and lead a classroom. Many states have grants for future teachers.', tools:['Lesson plans','Read-alouds','Classroom tech']},
  {id:'counselor', name:'School Counselor', c:'teach', soc:'21-1012', pay:65, paths:['4-year','License'], train:'Master’s degree + license', kid:'School counselors help kids with feelings, friends, and big choices.', teen:'Help students plan classes, apply for college or careers, and get support when life is hard.', tools:['Listening','Planning tools','Scholarship lists']},
  {id:'librarian', name:'Librarian', c:'teach', soc:'25-4022', pay:65, paths:['4-year'], train:'Master’s in library science', kid:'Librarians help you find the perfect book.', teen:'Run reading programs, teach research skills, and manage digital collections. Readers welcome.', tools:['Catalog systems','Story time','Research databases']},
  {id:'nurse', name:'Registered Nurse', c:'heal', soc:'29-1141', pay:94, paths:['2-year','4-year','License'], train:'2–4 yr nursing degree + NCLEX exam', kid:'Nurses take care of people when they are sick or hurt.', teen:'Check on patients, give medicine, and work with doctors. You can start with a 2-year degree and specialize later.', tools:['Stethoscope','Patient chart','IV pump']},
  {id:'emt', name:'EMT / Paramedic', c:'heal', soc:'29-2042', pay:42, paths:['Certificate'], train:'EMT: weeks to months; Paramedic: 1–2 yr', kid:'EMTs ride in ambulances and help people fast.', teen:'Give emergency care on the scene and on the way to the hospital. Some high schools offer EMT classes for seniors.', tools:['Defibrillator','Trauma kit','Radio']},
  {id:'hygienist', name:'Dental Hygienist', c:'heal', soc:'29-1292', pay:94, paths:['2-year','License'], train:'Associate degree + license', kid:'Dental hygienists clean teeth and teach you to brush.', teen:'Clean teeth, take X-rays, and spot problems early. Strong pay with a 2-year degree.', tools:['Scaler','X-ray sensor','Ultrasonic cleaner']},
  {id:'vettech', name:'Vet Technician', c:'heal', soc:'29-2056', pay:46, paths:['2-year'], train:'Associate degree + credential', kid:'Vet techs help animal doctors take care of pets.', teen:'Assist veterinarians with exams, surgery, and lab tests for animals of every size.', tools:['Microscope','Pet scale','Vaccines']},
  {id:'socialworker', name:'Social Worker', c:'help', soc:'21-1021', pay:59, paths:['4-year','License'], train:'Bachelor’s; Master’s for clinical work', kid:'Social workers help families get what they need to be safe and happy.', teen:'Connect kids and families with food, housing, health care, and support. Every day is about people.', tools:['Case notes','Community resources','Listening']},
  {id:'stylist', name:'Hair Stylist', c:'create', soc:'39-5012', pay:36, paths:['Trade school','License'], train:'Cosmetology program (~1 yr) + license', kid:'Stylists cut, color, and style hair.', teen:'Build a client list, learn color chemistry, and many stylists own their own salon or chair.', tools:['Shears','Color bowl','Booking app']},
  {id:'designer', name:'Graphic Designer', c:'create', soc:'27-1024', pay:61, paths:['4-year','Certificate'], train:'Portfolio + degree or certificate', kid:'Designers make posters, logos, and the pictures on boxes.', teen:'Design brands, apps, packaging, and social posts. Your portfolio matters as much as your diploma.', tools:['Sketchbook','Design software','Color & type']},
  {id:'chef', name:'Chef', c:'create', soc:'35-1011', pay:61, paths:['On the job','Trade school'], train:'Kitchen experience; culinary school optional', kid:'Chefs invent recipes and cook for lots of people.', teen:'Run a kitchen, create menus, and lead a team. Start as a line cook and work your way up.', tools:['Chef’s knife','Mise en place','Plating']},
  {id:'softdev', name:'Software Developer', c:'tech', soc:'15-1252', pay:133, paths:['4-year','Certificate'], train:'Degree, bootcamp, or self-taught + projects', kid:'Software developers write the instructions that make apps and games work.', teen:'Build apps, websites, and systems. Projects you build in high school can start your portfolio.', tools:['Code editor','Git','Testing']},
  {id:'cyber', name:'Cybersecurity Analyst', c:'tech', soc:'15-1212', pay:125, paths:['4-year','Military','Certificate'], train:'Degree or certifications (e.g., Security+)', kid:'Cyber heroes keep computers and secrets safe from hackers.', teen:'Protect networks, investigate attacks, and test defenses. The military trains many cyber specialists.', tools:['Firewall','Network scanner','Logs']},
  {id:'farmer', name:'Farmer / Rancher', c:'nature', soc:'11-9013', pay:null, paths:['On the job','4-year'], train:'Hands-on experience; ag degree helps', kid:'Farmers grow the food we eat and raise animals.', teen:'Manage crops, animals, equipment, and a business. Drones and sensors are changing how farms work.', tools:['Tractor','Soil tests','Drones']},
  {id:'ranger', name:'Park Ranger', c:'nature', soc:'19-1031', pay:null, paths:['4-year','On the job'], train:'Degree in natural resources; seasonal jobs first', kid:'Park rangers protect forests and help visitors explore.', teen:'Lead hikes, protect wildlife, and keep parks safe. Many start with summer seasonal jobs.', tools:['Map & compass','Radio','Field guide']},
  {id:'engineer', name:'Civil Engineer', c:'fly', soc:'17-2051', pay:99, paths:['4-year','License'], train:'Bachelor’s in engineering + PE license', kid:'Engineers design bridges, roads, and water systems.', teen:'Plan the roads, bridges, and water systems a city runs on, using math, physics, and design software.', tools:['CAD software','Survey data','Load calcs']},
  {id:'aviationmech', name:'Aircraft Mechanic', c:'fly', soc:'49-3011', pay:78, paths:['Trade school','Military'], train:'18–24 mo FAA-approved school', kid:'Aircraft mechanics fix airplanes so they fly safely.', teen:'Inspect and repair engines and systems on planes and helicopters. FAA certification is your ticket.', tools:['Borescope','Torque wrench','Maintenance manual']},
  {id:'pilot', name:'Airline Pilot', c:'fly', soc:'53-2011', pay:220, paths:['Certificate','4-year','Military'], train:'Flight school + 1,500 flight hours', kid:'Pilots fly airplanes full of people around the world.', teen:'Fly passenger or cargo jets. Many pilots start in the military or flight school and build hours as instructors.', tools:['Flight deck','Weather briefs','Checklists']}
];

export const QUESTS: Record<BandId, Quest[]> = {
  k2:[
    {id:'k2a', c:'build', title:'Pipe Detective', xp:20, steps:['Find 3 places water comes out at home','Ask a grown-up where the water goes after','Draw one pipe you found']},
    {id:'k2b', c:'help',  title:'Helper Hero Drawing', xp:15, steps:['Pick a helper in your town','Draw them at work','Tell a grown-up what they do']},
    {id:'k2c', c:'fly',   title:'Tallest Tower', xp:20, steps:['Gather 20 cups or blocks','Build as tall as you can','Try again with a wider bottom']},
    {id:'k2d', c:'teach', title:'Read & Earn', xp:25, steps:['Open A.R.I.S.E. Reader','Read a book about a job','Pass the quiz'], reader:true}
  ],
  g35:[
    {id:'g35a', c:'build', title:'Tool Safari', xp:25, steps:['Open a toolbox with an adult','Name 5 tools','Say what each one does']},
    {id:'g35b', c:'help',  title:'Interview a Grown-Up', xp:30, steps:['Pick an adult you know','Ask: What do you do all day?','Ask: How did you learn your job?','Share one surprise with your class']},
    {id:'g35c', c:'build', title:'Car Check (with an adult)', xp:25, steps:['Find the tire pressure sticker in the door','Check one tire with a gauge','Write the number down']},
    {id:'g35d', c:'teach', title:'Read & Earn', xp:30, steps:['Open A.R.I.S.E. Reader','Read a career book','Pass the quiz'], reader:true}
  ],
  g68:[
    {id:'g68a', c:'build', title:'Fix One Thing', xp:40, steps:['Find something small that is broken (squeaky hinge, loose screw)','Watch one how-to with an adult','Fix it and post a before/after']},
    {id:'g68b', c:'build', title:'Paycheck Challenge', xp:40, steps:['Pick two careers from Explore','Look up typical pay','Make a one-month budget for each']},
    {id:'g68c', c:'tech',  title:'Visit a CTE Class', xp:35, steps:['Find a CTE, robotics, or shop class at your school','Ask the teacher one question','Rate it: would you take it?']},
    {id:'g68d', c:'help', title:'Interview a Grown-Up', xp:30, steps:['Pick an adult whose job you know little about','Ask what a normal day looks like and how they got started','Share one thing that surprised you']}
  ],
  g912:[
    {id:'g912a', c:'build', title:'Find an Apprenticeship', xp:50, steps:['Search apprenticeship.gov for your area','Pick one program','Write down how to apply and the deadline']},
    {id:'g912b', c:'help',  title:'Draft Your Resume', xp:50, steps:['List jobs, volunteering, and activities','Add 3 skills with proof','Get feedback from a teacher']},
    {id:'g912c', c:'teach', title:'Compare Two Paths', xp:45, steps:['Pick two paths from Paths','Compare time, cost, and pay','Talk it over with a parent']},
    {id:'g912d', c:'serve', title:'Meet a Recruiter or Counselor', xp:40, steps:['Book a meeting (bring a parent if you want)','Ask 3 questions from your list','Write your next step']}
  ]
};

export const SCHOLARSHIPS: { name: string; for: string; type: string; url: string }[] = [
  {name:'Pell Grant (via FAFSA)', for:'College, community college, and many certificate programs', type:'Federal grant', url:'https://studentaid.gov'},
  {name:'mikeroweWORKS Work Ethic Scholarship', for:'Students entering skilled trades training', type:'Trades', url:'https://mikeroweworks.org'},
  {name:'ROTC Scholarships', for:'Students planning to become military officers through college', type:'Military', url:'https://www.todaysmilitary.com'},
  {name:'Coca-Cola Scholars', for:'High school seniors who lead and serve', type:'Merit / service', url:'https://www.coca-colascholarsfoundation.org'},
  {name:'The Gates Scholarship', for:'Pell-eligible minority high school seniors', type:'Need-based', url:'https://www.thegatesscholarship.org'},
  {name:'QuestBridge National College Match', for:'High-achieving students from low-income families', type:'Need-based', url:'https://www.questbridge.org'},
  {name:'Jack Kent Cooke College Scholarship', for:'High-achieving seniors with financial need', type:'Need-based', url:'https://www.jkcf.org'}
];

export const ROADMAP: { g: number; items: string[] }[] = [
  {g:6,  items:['Try 3 clubs or electives','Collect 10 passport stamps']},
  {g:7,  items:['Take a career interest quiz','Talk to 3 adults about their jobs']},
  {g:8,  items:['Choose high school classes on purpose (CTE, honors, JROTC)','Visit a CTE center or career academy']},
  {g:9,  items:['Make a 4-year class plan with your counselor','Start a brag sheet of activities and awards']},
  {g:10, items:['Job shadow or volunteer','Ask about dual enrollment and certifications']},
  {g:11, items:['Take the SAT/ACT, ASVAB, or an apprenticeship aptitude test','Visit colleges, trade schools, or recruiters','Start a scholarship list']},
  {g:12, items:['File the FAFSA (opens each fall)','Apply: college, apprenticeship, or enlistment','Compare offers and choose your launch']}
];

export const LEVELS = ["Curious", "Explorer", "Tinkerer", "Apprentice", "Pro", "Mentor", "Legend"];
export const XP = { collect: 10, spin: 10, rsvp: 15, perLevel: 120, dailyGoal: 60 } as const;
export const LIMITS = { postLength: 280, postsPerDay: 8, eventsPerDay: 5, eventTitle: 90 } as const;
export const REACTIONS = ["respect", "same", "how", "big"] as const;
export type Reaction = (typeof REACTIONS)[number];
export type PostScope = "class" | "school";

export const careerById = (id: string) => CAREERS.find((c) => c.id === id);
export const allQuests = () => BAND_IDS.flatMap((b) => QUESTS[b]);
export const questById = (id: string) => allQuests().find((q) => q.id === id);

/** A student's grade ("K", "3", "11th", "Kindergarten"...) to their grade band. Unknown grades get 6–8. */
export function bandForGrade(grade: unknown): BandId {
  const raw = String(grade ?? "").trim().toLowerCase();
  if (!raw) return "g68";
  if (/^(k|kg|kinder|kindergarten|pre-?k|tk)/.test(raw)) return "k2";
  const n = parseInt(raw.replace(/[^0-9]/g, ""), 10);
  if (!Number.isFinite(n)) return "g68";
  if (n <= 2) return "k2";
  if (n <= 5) return "g35";
  if (n <= 8) return "g68";
  return "g912";
}
export const isYoungBand = (band: BandId) => band === "k2" || band === "g35";

/** The calendar day (YYYY-MM-DD) used for streaks, daily goals and the daily spin. */
export function dayKey(at: number, timeZone = "America/Denver"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(at));
}
function previousDay(day: string): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export type SocialProfile = {
  xp: number; streak: number; last_active: string | null; daily_date: string | null; daily_xp: number;
  collected: string[]; saved: string[]; quests: Record<string, boolean[] | "done">; road: string[]; spun: { day: string; career: string } | null;
};
export const emptyProfile = (): SocialProfile => ({ xp: 0, streak: 0, last_active: null, daily_date: null, daily_xp: 0, collected: [], saved: [], quests: {}, road: [], spun: null });

/** Cleans a stored profile so a bad row can never break the page. */
export function cleanProfile(raw: any): SocialProfile {
  const p = emptyProfile();
  if (!raw || typeof raw !== "object") return p;
  const ids = (v: any, ok: (x: string) => boolean) => (Array.isArray(v) ? [...new Set(v.map(String).filter(ok))] : []);
  p.xp = Math.max(0, Math.floor(Number(raw.xp) || 0));
  p.streak = Math.max(0, Math.floor(Number(raw.streak) || 0));
  p.last_active = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.last_active)) ? String(raw.last_active) : null;
  p.daily_date = /^\d{4}-\d{2}-\d{2}$/.test(String(raw.daily_date)) ? String(raw.daily_date) : null;
  p.daily_xp = Math.max(0, Math.floor(Number(raw.daily_xp) || 0));
  p.collected = ids(raw.collected, (x) => !!careerById(x));
  p.saved = ids(raw.saved, (x) => !!careerById(x));
  p.road = ids(raw.road, (x) => /^\d{1,2}-\d$/.test(x));
  if (raw.quests && typeof raw.quests === "object") {
    for (const [id, v] of Object.entries(raw.quests)) {
      const q = questById(id);
      if (!q) continue;
      if (v === "done") p.quests[id] = "done";
      else if (Array.isArray(v)) p.quests[id] = q.steps.map((_, i) => !!v[i]);
    }
  }
  if (raw.spun && typeof raw.spun === "object" && careerById(String(raw.spun.career))) p.spun = { day: String(raw.spun.day), career: String(raw.spun.career) };
  return p;
}

/** Adds XP, keeping the streak and today's total up to date. Returns a new profile. */
export function awardXp(profile: SocialProfile, amount: number, today: string): SocialProfile {
  const p = { ...profile };
  if (p.last_active !== today) {
    p.streak = p.last_active === previousDay(today) ? p.streak + 1 : 1;
    p.last_active = today;
  }
  if (p.daily_date !== today) { p.daily_date = today; p.daily_xp = 0; }
  p.xp += amount;
  p.daily_xp += amount;
  return p;
}

/** The profile as the page shows it: today's numbers reset on a new day, and a broken streak shows as 0. */
export function profileForDay(profile: SocialProfile, today: string): SocialProfile & { level: number; levelName: string; levelXp: number; badges: string[] } {
  const p = { ...profile };
  if (p.daily_date !== today) p.daily_xp = 0;
  if (p.last_active && p.last_active !== today && p.last_active !== previousDay(today)) p.streak = 0;
  const level = Math.floor(p.xp / XP.perLevel);
  const clusters = new Set(p.collected.map((id) => careerById(id)!.c));
  const badges = [
    Object.values(p.quests).some((v) => v === "done") && "first-quest",
    p.collected.length >= 5 && "five-collected",
    clusters.size >= 4 && "four-clusters",
    p.streak >= 7 && "week-streak",
  ].filter(Boolean) as string[];
  return { ...p, level, levelName: LEVELS[Math.min(level, LEVELS.length - 1)], levelXp: p.xp % XP.perLevel, badges };
}

/** Post text: trimmed, no control characters, at most LIMITS.postLength characters. */
export function cleanPostText(text: unknown): string {
  return String(text ?? "").replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, "").replace(/\n{3,}/g, "\n\n").trim().slice(0, LIMITS.postLength);
}

/** Sentence starters for K–5 students, who build a post from choices instead of typing. */
export const YOUNG_STARTERS = ["I want to be a", "I learned something cool about a", "Today I pretended to be a"];
