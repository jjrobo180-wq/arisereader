// Arise History (/history/): K–12 history built like A.R.I.S.E. Reader. Students read a short true story
// (a History Read), take a 5-question quiz on it, and earn points on a class leaderboard, with achievements,
// certificates and a game room. Shared by the server (which keeps the answer key and grades every quiz, so
// points can't be faked) and the tests. Tables: migrations/arise_history.sql.
import { mathDay, mathWeek } from "./ariseMath";

export type BandId = "k2" | "g35" | "g68" | "g912";
export type Rng = () => number;
export type QuestionTag = "Who" | "What" | "When" | "Why" | "Big idea" | "Source";
export type Question = { t: QuestionTag; q: string; o: string[]; a: number; why: string };
export type Source = { lab: string; text: string; cite: string };
export type Read = { id: string; band: BandId; title: string; era: string; yr: string; min: number; c: string; p: string[]; src?: Source; qs: Question[] };

export const BANDS: Record<BandId, { label: string; course: string }> = {
  k2: { label: "K–2", course: "Long Ago and Today" },
  g35: { label: "3–5", course: "The American Story" },
  g68: { label: "6–8", course: "Ancient Civilizations" },
  g912: { label: "9–12", course: "U.S. History: 1877 to Today" },
};
export const BAND_IDS = Object.keys(BANDS) as BandId[];
export const isBand = (v: unknown): v is BandId => typeof v === "string" && (BAND_IDS as string[]).includes(v);

/* ------------------------------------------------------------------ History Reads */

export const READS: Read[] = [
  /* ---------- K–2 */
  { id: "school", band: "k2", title: "The One-Room Schoolhouse", yr: "1800s", era: "School long ago", min: 5, c: "sun",
    p: ["Long ago, many children went to a schoolhouse with just one room.", "Kids of all ages learned together with one teacher. Older kids helped the younger kids read.", "Paper cost a lot, so children wrote on small chalkboards called slates.", "In winter, a wood stove kept the room warm. Some kids carried wood from home.", "When it was time for school to start, the teacher rang a bell."],
    qs: [
      { t: "What", q: "What did children write on?", o: ["A tablet", "A slate", "A whiteboard"], a: 1, why: "A slate is a small chalkboard. Kids wiped it clean and used it again." },
      { t: "Who", q: "Who did kids learn with?", o: ["Only kids their age", "Kids of all ages", "Only grown-ups"], a: 1, why: "One room meant every grade learned together." },
      { t: "What", q: "What kept the room warm in winter?", o: ["A wood stove", "A heater fan", "Only the sun"], a: 0, why: "A wood stove heated the whole room." },
      { t: "Why", q: "Why did the teacher ring a bell?", o: ["To start a fire drill", "To tell kids school was starting", "To play music"], a: 1, why: "The bell told everyone nearby that school was about to begin." },
      { t: "When", q: "Which came FIRST?", o: ["One-room schoolhouses", "Computers in classrooms", "Your school today"], a: 0, why: "One-room schoolhouses were common in the 1800s, long before computers." },
    ] },
  { id: "wright", band: "k2", title: "The Wright Brothers Fly", yr: "1903", era: "Getting around", min: 5, c: "sky",
    p: ["Orville and Wilbur Wright were brothers. They ran a bicycle shop in Dayton, Ohio.", "They watched birds to learn how wings help them turn and stay up in the air.", "They built gliders, crashed, fixed them, and tried again.", "On December 17, 1903, near Kitty Hawk, North Carolina, Orville flew their airplane for 12 seconds.", "It was the first time a person flew an airplane with an engine. The brothers flew three more times that day."],
    qs: [
      { t: "Who", q: "Who were the Wright brothers?", o: ["Two brothers who ran a bicycle shop", "Two teachers", "Two sailors"], a: 0, why: "They fixed and built bicycles in Dayton, Ohio." },
      { t: "What", q: "What did they watch to learn about flying?", o: ["Fish", "Birds", "Kites only"], a: 1, why: "Birds showed them how wings tilt to turn." },
      { t: "When", q: "How long was the first flight?", o: ["12 seconds", "12 minutes", "12 hours"], a: 0, why: "Short, but it was the first flight of its kind." },
      { t: "What", q: "Where did they fly?", o: ["Near Kitty Hawk, North Carolina", "In New York City", "On the Moon"], a: 0, why: "They picked a windy beach with soft sand." },
      { t: "Big idea", q: "What can we learn from the Wright brothers?", o: ["Give up when something is hard", "Keep trying and fixing your mistakes", "Never ask questions"], a: 1, why: "They crashed many gliders before they got it right." },
    ] },
  { id: "bell", band: "k2", title: "The Liberty Bell", yr: "1753", era: "American symbols", min: 4, c: "coral",
    p: ["The Liberty Bell is a big bell in Philadelphia, Pennsylvania. It was made in 1753.", "It hung in the building where leaders met to talk about freedom for the colonies.", "Words on the bell say to proclaim liberty, which means freedom, throughout all the land.", "Years later, people working to end slavery called it the Liberty Bell.", "The bell has a long crack, so it does not ring anymore. Visitors can still see it today."],
    src: { lab: "Words on the bell", text: "Proclaim LIBERTY Throughout all the Land unto all the Inhabitants Thereof", cite: "Inscription on the Liberty Bell, 1753" },
    qs: [
      { t: "What", q: "Where is the Liberty Bell?", o: ["Philadelphia", "Chicago", "Los Angeles"], a: 0, why: "It is in Philadelphia, Pennsylvania." },
      { t: "What", q: "What does liberty mean?", o: ["Bell", "Freedom", "Music"], a: 1, why: "Liberty means freedom." },
      { t: "Source", q: "Look at the words on the bell. Which big word is in capital letters?", o: ["LAND", "LIBERTY", "BELL"], a: 1, why: "LIBERTY is written in capital letters so it stands out." },
      { t: "Who", q: "Who started calling it the Liberty Bell?", o: ["People working to end slavery", "The king of England", "Kids at school"], a: 0, why: "They used the bell as a symbol of freedom for everyone." },
      { t: "Why", q: "Why doesn’t the bell ring anymore?", o: ["It is too quiet", "It has a big crack", "It is too heavy"], a: 1, why: "Ringing could make the crack bigger." },
    ] },
  /* ---------- 3–5 */
  { id: "decl", band: "g35", title: "Declaring Independence", yr: "1776", era: "Road to Revolution", min: 8, c: "coral",
    p: ["By the summer of 1776, colonists and British soldiers had already fought at Lexington and Concord.", "Leaders from all 13 colonies met in Philadelphia as the Second Continental Congress.", "They chose a committee, including Thomas Jefferson, John Adams, and Benjamin Franklin, to explain why the colonies should be free. Jefferson, who was 33, wrote the first draft.", "Congress voted for independence on July 2. Two days later, on July 4, 1776, it approved the Declaration."],
    src: { lab: "From the source", text: "We hold these truths to be self-evident, that all men are created equal, that they are endowed by their Creator with certain unalienable Rights, that among these are Life, Liberty and the pursuit of Happiness.", cite: "Declaration of Independence, July 4, 1776" },
    qs: [
      { t: "What", q: "Where did the Second Continental Congress meet?", o: ["Boston", "Philadelphia", "New York City"], a: 1, why: "Congress met in Philadelphia, in the building now called Independence Hall." },
      { t: "When", q: "Which came FIRST?", o: ["The Declaration of Independence", "The battles at Lexington and Concord", "The Treaty of Paris"], a: 1, why: "Lexington and Concord were in April 1775." },
      { t: "Who", q: "Who wrote the first draft?", o: ["George Washington", "Thomas Jefferson", "King George III"], a: 1, why: "Jefferson drafted it; Adams, Franklin, and Congress made changes." },
      { t: "Source", q: "What is the quote from the Declaration mainly arguing?", o: ["People have rights government should protect", "Colonists should pay more taxes", "Britain should send more soldiers"], a: 0, why: "Rights come first, and governments exist to protect them." },
      { t: "When", q: "What happened on July 4, 1776?", o: ["Congress approved the Declaration", "The war ended", "George Washington became president"], a: 0, why: "Congress voted for independence on July 2 and approved the Declaration on July 4." },
    ] },
  { id: "tea", band: "g35", title: "The Boston Tea Party", yr: "1773", era: "Road to Revolution", min: 7, c: "teach",
    p: ["After the French and Indian War, Britain needed money, so Parliament taxed the colonies.", "Colonists had no representatives in Parliament. Many said it was unfair to be taxed without a vote.", "The Tea Act of 1773 helped a British company, the East India Company, sell tea in the colonies.", "On the night of December 16, 1773, colonists, some dressed as Mohawk Indians, boarded three ships in Boston Harbor and dumped 342 chests of tea into the water.", "Britain punished Boston by closing the harbor until the tea was paid for. Colonists called the new laws the Intolerable Acts, and the colonies grew more united."],
    qs: [
      { t: "When", q: "When was the Boston Tea Party?", o: ["December 1773", "July 1776", "April 1775"], a: 0, why: "It happened on the night of December 16, 1773." },
      { t: "What", q: "How many chests of tea went into the harbor?", o: ["3", "42", "342"], a: 2, why: "342 chests, worth a lot of money at the time." },
      { t: "Why", q: "Why were colonists angry about taxes?", o: ["They had no vote in Parliament", "They did not like tea", "Taxes were too low"], a: 0, why: "Their slogan was no taxation without representation." },
      { t: "What", q: "How did Britain punish Boston?", o: ["It closed Boston Harbor", "It gave the colonists free tea", "It let them vote"], a: 0, why: "The harbor stayed closed until the tea was paid for." },
      { t: "Big idea", q: "What was one result of the punishment?", o: ["The colonies grew more united", "Everyone forgot about it", "The colonies split apart"], a: 0, why: "Other colonies sent help to Boston and began working together." },
    ] },
  { id: "jamestown", band: "g35", title: "Jamestown", yr: "1607", era: "Thirteen Colonies", min: 7, c: "nature",
    p: ["In 1607, about 100 English men and boys sailed up a river in Virginia and built a fort. They named it Jamestown, after King James I.", "The Powhatan people already lived there. Sometimes they traded food with the colonists, and sometimes they fought.", "Many colonists were not ready for hard work. The water was bad, and many died of disease and hunger.", "During the winter of 1609 to 1610, called the Starving Time, most of the colonists died.", "Around 1612, John Rolfe began growing tobacco. It sold well in England and helped the colony survive."],
    qs: [
      { t: "When", q: "When was Jamestown founded?", o: ["1492", "1607", "1776"], a: 1, why: "1607, the first lasting English colony in North America." },
      { t: "Who", q: "Who already lived in the area?", o: ["The Powhatan people", "The Aztec", "The Pilgrims"], a: 0, why: "The Powhatan had lived there for a long time." },
      { t: "Why", q: "Who was Jamestown named after?", o: ["John Smith", "King James I", "George Washington"], a: 1, why: "The colonists named the fort after their king." },
      { t: "What", q: "What was the Starving Time?", o: ["A holiday feast", "A winter when most colonists died", "A harvest festival"], a: 1, why: "Food ran out during the winter of 1609 to 1610." },
      { t: "Big idea", q: "What helped the colony finally survive?", o: ["Gold", "Tobacco", "Tea"], a: 1, why: "Tobacco became a cash crop that sold in England." },
    ] },
  /* ---------- 6–8 */
  { id: "hammurabi", band: "g68", title: "Hammurabi’s Code", yr: "c. 1754 BCE", era: "Mesopotamia", min: 10, c: "sun",
    p: ["Hammurabi ruled the city-state of Babylon from about 1792 to 1750 BCE and conquered much of Mesopotamia.", "Around 1754 BCE, he had 282 laws carved on a stone stele about 2.25 meters tall and set up where people could see it. The laws covered trade, property, family, and crime.", "Many punishments matched the crime, an idea later summed up as an eye for an eye. But the code did not treat everyone the same: the punishment depended on whether the victim was a noble, a commoner, or an enslaved person.", "French archaeologists found the stele in 1901. Today it is in the Louvre museum in Paris."],
    src: { lab: "Laws 196, 198, 199 · L. W. King translation (1910)", text: "If a man put out the eye of another man, his eye shall be put out. … If he put out the eye of a freed man, or break the bone of a freed man, he shall pay one gold mina. If he put out the eye of a man’s slave, or break the bone of a man’s slave, he shall pay one-half of its value.", cite: "Code of Hammurabi, c. 1754 BCE" },
    qs: [
      { t: "Who", q: "Who was Hammurabi?", o: ["A king of Babylon", "A Greek philosopher", "An Egyptian pharaoh"], a: 0, why: "He ruled Babylon and much of Mesopotamia." },
      { t: "Why", q: "Why carve laws on a public stone?", o: ["So people knew the rules and the king’s power", "As decoration only", "To hide them"], a: 0, why: "Public laws told people the rules and who made them." },
      { t: "Source", q: "What do laws 196–199 show about Babylonian society?", o: ["Everyone was treated equally", "Punishments depended on social class", "Injuries were not punished"], a: 1, why: "The same injury had different punishments depending on who was hurt." },
      { t: "When", q: "Which came FIRST?", o: ["Hammurabi’s Code", "Cuneiform writing in Sumer", "The first Olympic Games"], a: 1, why: "Cuneiform appeared around 3200 BCE." },
      { t: "What", q: "Where is the stele today?", o: ["The Louvre in Paris", "Baghdad", "The British Museum"], a: 0, why: "It was found at Susa, in present-day Iran, in 1901." },
    ] },
  { id: "nile", band: "g68", title: "Gift of the Nile", yr: "3100 BCE", era: "Ancient Egypt", min: 8, c: "create",
    p: ["Egypt gets very little rain, yet it became one of the richest civilizations in the ancient world. The reason was the Nile River.", "Every summer, the Nile flooded. When the water drained away, it left a layer of rich black silt that was perfect for farming.", "Egyptians called their land Kemet, the black land, after this soil. The desert around it was Deshret, the red land.", "They divided the year into three seasons: flood, growing, and harvest. Farmers used a shaduf, a bucket on a weighted pole, to lift water into their fields.", "The deserts on both sides made Egypt hard to invade. The Greek writer Herodotus later called Egypt a gift of the river."],
    qs: [
      { t: "What", q: "What did the yearly flood leave behind?", o: ["Sand", "Rich black soil", "Salt"], a: 1, why: "Silt made the riverbanks excellent farmland." },
      { t: "What", q: "What did Kemet mean?", o: ["The black land", "The red land", "The river land"], a: 0, why: "It named the dark, fertile soil." },
      { t: "What", q: "What was a shaduf used for?", o: ["Lifting water", "Building pyramids", "Writing"], a: 0, why: "A weighted pole made lifting a bucket of water easier." },
      { t: "Why", q: "How did the deserts help Egypt?", o: ["They made it hard to invade", "They had lots of water", "They grew crops"], a: 0, why: "Armies had a hard time crossing them." },
      { t: "Who", q: "Who called Egypt a gift of the river?", o: ["Hammurabi", "Herodotus", "Cleopatra"], a: 1, why: "Herodotus visited Egypt around 450 BCE." },
    ] },
  { id: "athens", band: "g68", title: "Athens Invents Democracy", yr: "c. 508 BCE", era: "Ancient Greece", min: 9, c: "sky",
    p: ["Around 508 BCE, a leader named Cleisthenes changed how Athens was governed.", "Adult male citizens could attend the Assembly and vote on laws themselves. This is called direct democracy.", "Many officials were chosen by lottery, so ordinary citizens took turns running the city.", "Once a year, citizens could vote to send a person into exile for ten years. They scratched names on broken pottery called ostraka, which gives us the word ostracism.", "But most people who lived in Athens could not vote. Women, enslaved people, and foreigners were left out."],
    qs: [
      { t: "Who", q: "Who reformed Athens’ government around 508 BCE?", o: ["Cleisthenes", "Alexander the Great", "Hammurabi"], a: 0, why: "His reforms are seen as the start of Athenian democracy." },
      { t: "What", q: "What is direct democracy?", o: ["Citizens vote on laws themselves", "A king decides everything", "Citizens elect someone to vote for them"], a: 0, why: "In Athens, citizens voted in person in the Assembly." },
      { t: "What", q: "What was ostracism?", o: ["A vote to exile someone for ten years", "A sports contest", "A tax on pottery"], a: 0, why: "Names were scratched on pottery shards called ostraka." },
      { t: "Who", q: "Who could NOT vote in Athens?", o: ["Adult male citizens", "Women, enslaved people, and foreigners", "Officials"], a: 1, why: "Most residents were excluded." },
      { t: "Big idea", q: "Which statement best describes Athenian democracy?", o: ["Everyone had an equal voice", "Citizens had real power, but most people were excluded", "It was the same as U.S. democracy today"], a: 1, why: "Both parts are true: real power and limited membership." },
    ] },
  /* ---------- 9–12 */
  { id: "newdeal", band: "g912", title: "The New Deal", yr: "1933", era: "Boom and Bust", min: 10, c: "teach",
    p: ["The stock market crash of October 1929 helped set off the Great Depression. Banks failed, factories closed, and by 1933 about a quarter of workers were unemployed.", "Franklin D. Roosevelt took office in March 1933 promising action. In his first hundred days, Congress created programs such as the Civilian Conservation Corps and the Federal Deposit Insurance Corporation (FDIC).", "Later New Deal laws included the Social Security Act of 1935.", "Historians still debate how much the New Deal ended the Depression. Unemployment stayed high through the late 1930s and fell sharply only when the country mobilized for World War II."],
    src: { lab: "From the source", text: "So, first of all, let me assert my firm belief that the only thing we have to fear is fear itself—nameless, unreasoning, unjustified terror which paralyzes needed efforts to convert retreat into advance.", cite: "Franklin D. Roosevelt, First Inaugural Address, March 4, 1933" },
    qs: [
      { t: "When", q: "Which came FIRST?", o: ["The Social Security Act", "The stock market crash", "Pearl Harbor"], a: 1, why: "October 1929, then 1935, then 1941." },
      { t: "What", q: "What does the FDIC do?", o: ["Sets stock prices", "Insures bank deposits", "Hires unemployed workers"], a: 1, why: "Deposit insurance helped end the bank runs of the early 1930s." },
      { t: "Source", q: "What was FDR’s main purpose in his inaugural line?", o: ["To announce a war", "To restore confidence during a crisis", "To criticize Congress"], a: 1, why: "Bank runs fed on panic. FDR argued fear itself was the danger." },
      { t: "What", q: "About what share of workers were unemployed in 1933?", o: ["1 in 100", "1 in 20", "1 in 4"], a: 2, why: "Roughly 25 percent, the worst point of the Depression." },
      { t: "Why", q: "Why do historians still debate the New Deal’s effect?", o: ["Unemployment stayed high until wartime mobilization", "It was never passed", "It began in 1950"], a: 0, why: "Full recovery lined up with World War II spending." },
    ] },
  { id: "dust", band: "g912", title: "The Dust Bowl", yr: "1935", era: "Boom and Bust", min: 9, c: "coral",
    p: ["In the 1930s, a long drought struck the southern Great Plains.", "In earlier decades, farmers had plowed up millions of acres of native grasses whose roots held the soil in place.", "With the grass gone and the soil dry, strong winds lifted the topsoil into enormous dust storms. On April 14, 1935, known as Black Sunday, a giant storm rolled across the plains.", "Hundreds of thousands of people left the region. Many headed to California, where they were often called Okies, whether they came from Oklahoma or not.", "In 1935 the federal government created the Soil Conservation Service to teach farmers methods like contour plowing, crop rotation, and planting rows of trees as windbreaks."],
    qs: [
      { t: "Why", q: "What human choice made the Dust Bowl worse?", o: ["Plowing up native grasses", "Building highways", "Planting too many trees"], a: 0, why: "Grass roots had held the soil in place." },
      { t: "When", q: "What was Black Sunday?", o: ["The 1929 stock market crash", "A massive dust storm in April 1935", "The day FDR took office"], a: 1, why: "April 14, 1935." },
      { t: "What", q: "Where did many Dust Bowl migrants go?", o: ["California", "New York", "Canada"], a: 0, why: "Many sought farm work in California." },
      { t: "What", q: "How did the federal government respond?", o: ["It created the Soil Conservation Service", "It banned farming", "It did nothing"], a: 0, why: "The SCS taught soil-saving methods." },
      { t: "Big idea", q: "What does the Dust Bowl show?", o: ["Weather alone causes disasters", "Human choices and the environment interact", "Farming was illegal"], a: 1, why: "Drought plus plowing created the disaster." },
    ] },
  { id: "brown", band: "g912", title: "Brown v. Board of Education", yr: "1954", era: "Civil Rights", min: 10, c: "primary",
    p: ["In 1896, the Supreme Court’s Plessy v. Ferguson decision allowed separate facilities for Black and white Americans if they were equal. In practice, Black schools usually got far less money.", "Lawyers for the NAACP, led by Thurgood Marshall, challenged school segregation in court. Several cases were combined under the name of Oliver Brown, whose daughter Linda had to travel far to a segregated school in Topeka, Kansas.", "On May 17, 1954, the Supreme Court ruled 9–0 that segregated public schools violated the Fourteenth Amendment’s Equal Protection Clause.", "A 1955 follow-up ruling told schools to desegregate with all deliberate speed. Many districts resisted. In 1957, President Eisenhower sent federal troops to protect nine Black students at Central High School in Little Rock, Arkansas."],
    src: { lab: "From the source", text: "We conclude that in the field of public education the doctrine of “separate but equal” has no place. Separate educational facilities are inherently unequal.", cite: "Chief Justice Earl Warren, Brown v. Board of Education, May 17, 1954" },
    qs: [
      { t: "What", q: "Which earlier decision did Brown overturn for public schools?", o: ["Plessy v. Ferguson", "Marbury v. Madison", "Roe v. Wade"], a: 0, why: "Plessy (1896) had allowed separate but equal." },
      { t: "Who", q: "Who led the NAACP’s legal team?", o: ["Earl Warren", "Thurgood Marshall", "Martin Luther King Jr."], a: 1, why: "Marshall later became the first Black Supreme Court justice." },
      { t: "Source", q: "According to Warren, what is wrong with separate schools?", o: ["They cost too much", "They are inherently unequal", "They are too far away"], a: 1, why: "Separation itself creates inequality." },
      { t: "What", q: "Which amendment did segregation violate?", o: ["The First", "The Fourteenth", "The Nineteenth"], a: 1, why: "Its Equal Protection Clause." },
      { t: "Big idea", q: "What does Little Rock in 1957 show?", o: ["Brown was enforced right away", "Court rulings can face resistance and need enforcement", "Schools were already integrated"], a: 1, why: "Federal troops were needed to carry out the ruling." },
    ] },
];
export const READ_IDS = READS.map((r) => r.id);
export const readById = (id: unknown): Read | null => READS.find((r) => r.id === id) ?? null;
export const readsFor = (band: BandId) => READS.filter((r) => r.band === band);

/** What the page may see of a read: everything but the answer key (that stays on the server). */
export function readPublic(r: Read) {
  return { id: r.id, band: r.band, title: r.title, era: r.era, yr: r.yr, min: r.min, c: r.c, p: r.p, src: r.src ?? null, n: r.qs.length };
}

/* ------------------------------------------------------------------ quizzes */

/** One question as a student takes it: choices shuffled, answer key kept on the server. */
export type Item = { t: QuestionTag; q: string; o: string[]; a: number; why: string };

/** Shuffles each question's choices so answer positions can't be memorized or shared. */
export function makeItems(qs: Question[], r: Rng = Math.random): Item[] {
  return qs.map((x) => {
    const order = x.o.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    return { t: x.t, q: x.q, o: order.map((i) => x.o[i]), a: order.indexOf(x.a), why: x.why };
  });
}
export const itemPublic = (it: Item) => ({ t: it.t, q: it.q, o: it.o });

/** Grades a whole quiz. Missing or unknown answers count as wrong. */
export function gradeQuiz(items: Item[], answers: unknown): { score: number; marks: boolean[]; picks: (number | null)[] } {
  const list = Array.isArray(answers) ? answers : [];
  const picks = items.map((it, i) => {
    const raw = list[i];
    // Blank answers (null, "", missing) are unanswered, not choice 0.
    const v = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
    return Number.isInteger(v) && v >= 0 && v < it.o.length ? v : null;
  });
  const marks = items.map((it, i) => picks[i] === it.a);
  return { score: marks.filter(Boolean).length, marks, picks };
}

export const cleanText = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

/** A teacher's own multiple-choice question, checked before it is saved. */
export function cleanCustom(raw: any): Question | null {
  const q = cleanText(raw?.q, 160);
  const o = (Array.isArray(raw?.o) ? raw.o : []).slice(0, 4).map((x: unknown) => cleanText(x, 90));
  const a = Number(raw?.a);
  if (!q || o.length < 2 || o.some((x: string) => !x) || new Set(o.map((x: string) => x.toLowerCase())).size !== o.length) return null;
  if (!Number.isInteger(a) || a < 0 || a >= o.length) return null;
  const why = cleanText(raw?.why, 160);
  return { t: "What", q, o, a, why: why || `The answer is ${o[a]}.` };
}

/* ------------------------------------------------------------------ points, profiles */

export const POINTS = { perCorrect: 10, perfectBonus: 20 } as const;
/** A quiz passes at 60% (3 of 5). */
export const PASS = 0.6;
export const passed = (score: number, of: number) => of > 0 && score / of >= PASS;
export const WEEKLY_GOAL = 3;
export const LIMITS = { quizzesPerDay: 40, customPerAssignment: 15, history: 30, certs: 60 } as const;
export const STYLES = [
  { id: "primary", label: "Indigo", at: 0 }, { id: "coral", label: "Coral", at: 0 }, { id: "create", label: "Teal", at: 0 },
  { id: "sunrise", label: "Sunrise", at: 250 }, { id: "galaxy", label: "Galaxy", at: 500 }, { id: "gold", label: "Gold", at: 1000 },
] as const;
/** Point totals that earn a certificate on their own. */
export const MILESTONES = [250, 500, 1000, 2000];
export const CERT_TITLES = ["History Star", "Most Improved", "Hard Worker"] as const;

export type Cert = { t: string; r: string; d: string; by: string };
export type HistoryRow = { d: string; title: string; score: number; of: number; pts: number };
export type HistoryProfile = {
  points: number; week_key: string | null; week_points: number; week_quizzes: number; week_passed: string[];
  quizzes: number; correct: number; answered: number; streak: number; last_active: string | null;
  /** Best score per quiz ("read:decl", "assign:<id>"), so retakes only earn points for improving. */
  best: Record<string, number>; source_right: string[];
  certs: Cert[]; history: HistoryRow[]; milestones: number[];
  flags: { live?: boolean; goal?: boolean; streak5?: boolean }; avatar: string; band: BandId | null; a11y: { read?: boolean; big?: boolean };
};
export const emptyHistoryProfile = (): HistoryProfile => ({
  points: 0, week_key: null, week_points: 0, week_quizzes: 0, week_passed: [], quizzes: 0, correct: 0, answered: 0, streak: 0, last_active: null,
  best: {}, source_right: [], certs: [], history: [], milestones: [], flags: {}, avatar: "primary", band: null, a11y: {},
});
const int = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0));
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const isKey = (k: string) => /^(read:[a-z0-9]{1,24}|assign:[0-9a-f-]{36})$/.test(k);

/** Cleans a stored profile so a bad row can never break the page. */
export function cleanHistoryProfile(raw: any): HistoryProfile {
  const p = emptyHistoryProfile();
  if (!raw || typeof raw !== "object") return p;
  for (const k of ["points", "week_points", "week_quizzes", "quizzes", "correct", "answered", "streak"] as const) p[k] = int(raw[k]);
  for (const k of ["week_key", "last_active"] as const) p[k] = isDay(raw[k]) ? raw[k] : null;
  if (Array.isArray(raw.week_passed)) p.week_passed = [...new Set(raw.week_passed.map(String).filter(isKey))].slice(0, 200) as string[];
  if (raw.best && typeof raw.best === "object") for (const [k, v] of Object.entries(raw.best)) if (isKey(k)) p.best[k] = int(v);
  if (Array.isArray(raw.source_right)) p.source_right = [...new Set(raw.source_right.map(String).filter(isKey))].slice(0, 200) as string[];
  if (Array.isArray(raw.certs)) p.certs = raw.certs.filter((c: any) => c && c.t).slice(0, LIMITS.certs).map((c: any) => ({ t: cleanText(c.t, 40), r: cleanText(c.r, 120), d: cleanText(c.d, 20), by: cleanText(c.by, 60) }));
  if (Array.isArray(raw.history)) p.history = raw.history.filter((h: any) => h && h.title).slice(0, LIMITS.history).map((h: any) => ({ d: cleanText(h.d, 12), title: cleanText(h.title, 80), score: int(h.score), of: int(h.of), pts: int(h.pts) }));
  if (Array.isArray(raw.milestones)) p.milestones = MILESTONES.filter((m) => raw.milestones.includes(m));
  if (raw.flags && typeof raw.flags === "object") p.flags = { live: !!raw.flags.live, goal: !!raw.flags.goal, streak5: !!raw.flags.streak5 };
  if (STYLES.some((s) => s.id === raw.avatar)) p.avatar = raw.avatar;
  if (isBand(raw.band)) p.band = raw.band;
  if (raw.a11y && typeof raw.a11y === "object") p.a11y = { read: !!raw.a11y.read, big: !!raw.a11y.big };
  return p;
}

/** Days and weeks run on Mountain Time, the site's school clock (the same as Arise Math). */
export const historyDay = mathDay;
export const historyWeek = mathWeek;
const previousDay = (day: string) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); };

/** This week's numbers start over on a new week; a broken streak shows as 0. */
export function profileNow(p: HistoryProfile, at: number): HistoryProfile {
  const out = structuredClone(p), day = historyDay(at), week = historyWeek(at);
  if (out.week_key !== week) { out.week_key = week; out.week_points = 0; out.week_quizzes = 0; out.week_passed = []; }
  if (out.last_active && out.last_active !== day && out.last_active !== previousDay(day)) out.streak = 0;
  return out;
}
export function touchStreak(p: HistoryProfile, at: number): HistoryProfile {
  const day = historyDay(at);
  if (p.last_active === day) return p;
  return { ...p, streak: p.last_active === previousDay(day) ? p.streak + 1 : 1, last_active: day };
}
/** Points for a finished quiz: only improvement on the best score counts, plus the perfect bonus the first time. */
export function pointsFor(score: number, of: number, best: number | undefined): number {
  const prev = best ?? 0;
  return Math.max(0, score - prev) * POINTS.perCorrect + (score === of && prev < of ? POINTS.perfectBonus : 0);
}
export function accuracy(p: Pick<HistoryProfile, "correct" | "answered">): number | null {
  return p.answered ? Math.round((100 * p.correct) / p.answered) : null;
}

export const ACHIEVEMENTS = [
  { id: "first", name: "First Quiz", d: "Finish any quiz", ic: "check", c: "leaf" },
  { id: "perfect", name: "Perfect Score", d: "Get every question right", ic: "star", c: "sun" },
  { id: "goal", name: "Goal Getter", d: `Pass ${WEEKLY_GOAL} quizzes in one week`, ic: "target", c: "nature" },
  { id: "travel", name: "Time Traveler", d: "Pass every History Read in your grade band", ic: "globe", c: "sky" },
  { id: "source", name: "Source Detective", d: "Ace a primary-source question", ic: "search", c: "teach" },
  { id: "streak5", name: "5-Day Streak", d: "Take a quiz 5 days in a row", ic: "flame", c: "coral" },
  { id: "podium", name: "On the Podium", d: "Top 3 in your class this week", ic: "trophy", c: "fly" },
  { id: "live", name: "Live Player", d: "Play a live review game", ic: "live", c: "primary" },
] as const;
export function earnedAchievements(p: HistoryProfile, band: BandId, weekRank: number | null): string[] {
  const has: Record<string, boolean> = {
    first: p.quizzes >= 1,
    perfect: Object.entries(p.best).some(([k, v]) => { const r = k.startsWith("read:") ? readById(k.slice(5)) : null; return r ? v >= r.qs.length : false; }) || p.certs.some((c) => c.t === "Perfect Score"),
    goal: !!p.flags.goal || p.week_passed.length >= WEEKLY_GOAL,
    travel: readsFor(band).every((r) => passed(p.best[`read:${r.id}`] ?? 0, r.qs.length)),
    source: p.source_right.length >= 1,
    streak5: !!p.flags.streak5 || p.streak >= 5,
    podium: weekRank != null && weekRank <= 3,
    live: !!p.flags.live,
  };
  return ACHIEVEMENTS.filter((a) => has[a.id]).map((a) => a.id);
}
