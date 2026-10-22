// Arise WorkHub IEP Writer: the lists the drop boxes are built from.
// Disabilities are Colorado's eligibility categories. Each area of need carries its own goal bank,
// objectives, standard, impact wording, suggested accommodations and the service that matches it,
// so picking an area changes what the later drop boxes offer.

export const DISABILITIES = [
  "Autism Spectrum Disorder", "Brain Injury", "Deaf-Blindness", "Developmental Delay", "Hearing Impairment, Including Deafness",
  "Intellectual Disability", "Multiple Disabilities", "Orthopedic Impairment", "Other Health Impairment",
  "Serious Emotional Disability", "Specific Learning Disability", "Speech or Language Impairment", "Visual Impairment, Including Blindness",
] as const;

/** Short tags used to suggest areas of need for each disability. */
const DIS_TAG: Record<string, string> = {
  "Autism Spectrum Disorder": "asd", "Brain Injury": "tbi", "Deaf-Blindness": "sensory", "Developmental Delay": "dd",
  "Hearing Impairment, Including Deafness": "sensory", "Intellectual Disability": "id", "Multiple Disabilities": "md",
  "Orthopedic Impairment": "oi", "Other Health Impairment": "ohi", "Serious Emotional Disability": "sed",
  "Specific Learning Disability": "sld", "Speech or Language Impairment": "sli", "Visual Impairment, Including Blindness": "sensory",
};
export const disabilityTag = (d: string) => DIS_TAG[d] || "";

/** Specific Learning Disability areas Colorado eligibility names. */
export const SLD_AREAS = ["Basic Reading Skills", "Reading Fluency Skills", "Reading Comprehension", "Written Expression", "Mathematics Calculation", "Mathematics Problem Solving", "Oral Expression", "Listening Comprehension"] as const;

export type ServiceType = { id: string; label: string; provider: string };
export const SERVICE_TYPES: ServiceType[] = [
  { id: "lit", label: "Specialized Instruction: Literacy", provider: "Special Education Teacher" },
  { id: "wri", label: "Specialized Instruction: Written Expression", provider: "Special Education Teacher" },
  { id: "math", label: "Specialized Instruction: Math", provider: "Special Education Teacher" },
  { id: "ef", label: "Specialized Instruction: Executive Functioning", provider: "Special Education Teacher" },
  { id: "se", label: "Social/Emotional Services", provider: "School Social Worker" },
  { id: "sl", label: "Speech-Language Services", provider: "Speech-Language Pathologist" },
  { id: "ot", label: "Occupational Therapy", provider: "Occupational Therapist" },
  { id: "tr", label: "Specialized Instruction: Transition Skills", provider: "Special Education Teacher" },
];
export const serviceById = (id: string) => SERVICE_TYPES.find((s) => s.id === id) || SERVICE_TYPES[0];

export type Behavior = { id: string; text: string; unit: string };
export type NeedArea = {
  id: string; label: string; kind: "academic" | "functional";
  /** Disability tags this area is suggested for. */
  for: string[];
  /** Matching Colorado SLD area, when there is one. */
  sld?: string;
  service: string;
  /** What students this age are expected to do: (gradeBand) => text. */
  expect: (band: Band) => string;
  /** How the need gets in the way in class (finishes "... affects NAME's ability to"). */
  impact: string;
  /** The root cause wording, for the "why" the rubric asks for. */
  cause: string;
  standard: (grade: number) => string;
  goals: Behavior[];
  objectives: Behavior[];
  conditions: string[];
  methods: string[];
  accs: string[];
};
export type Band = "k2" | "35" | "68" | "912";
export const bandOf = (grade: number): Band => (grade <= 2 ? "k2" : grade <= 5 ? "35" : grade <= 8 ? "68" : "912");
const by = (k2: string, g35: string, g68: string, g912: string) => (b: Band) => ({ k2, "35": g35, "68": g68, "912": g912 }[b]);
const g = (n: number) => (n <= 0 ? "K" : String(Math.min(n, 12)));
const hs = (n: number, ms: string, high: string) => (n >= 9 ? high : ms);

export const NEED_AREAS: NeedArea[] = [
  { id: "decode", label: "Basic reading skills (phonics and decoding)", kind: "academic", for: ["sld", "id", "asd", "sli", "dd", "tbi", "md"], sld: "Basic Reading Skills", service: "lit",
    expect: by("blend sounds and read short-vowel words, digraphs and blends", "decode multisyllable words and read grade-level texts accurately", "read grade-level texts across subjects accurately and independently", "read complex texts in every class independently"),
    impact: "read grade-level texts, directions and test questions accurately and independently across core classes",
    cause: "difficulty connecting letter patterns to sounds, so words are read slowly or guessed",
    standard: (n) => n <= 5 ? `CAS Reading, Writing & Communicating / CCSS RF.${g(n)}.3: know and apply grade-level phonics and word analysis skills in decoding words` : `CCSS RF.5.3 (foundational skill supporting RL.${g(n)}.10 and RI.${g(n)}.10: read and comprehend grade-level literary and informational texts)`,
    goals: [{ id: "multi", text: "decode multisyllable words with closed, open, vowel-team and r-controlled syllables", unit: "% accuracy" },
      { id: "single", text: "read single-syllable words with digraphs, blends and long-vowel patterns", unit: "% accuracy" },
      { id: "hfw", text: "read high-frequency and decodable words in connected text", unit: "% accuracy" }],
    objectives: [{ id: "syl", text: "identify and divide syllable types in unfamiliar words", unit: "% accuracy" },
      { id: "vt", text: "read words with vowel teams and r-controlled vowels", unit: "% accuracy" },
      { id: "aff", text: "read words with common prefixes and suffixes", unit: "% accuracy" },
      { id: "sight", text: "read a list of grade-level high-frequency words", unit: "% accuracy" }],
    conditions: ["a list of 20 unfamiliar decodable words", "a decodable passage at the instructional level", "a Really Great Reading decoding survey"],
    methods: ["Really Great Reading decoding surveys", "curriculum-based word reading probes", "running records"],
    accs: ["readaloud", "audiobook", "extratime", "chunk", "preview"] },
  { id: "fluency", label: "Reading fluency", kind: "academic", for: ["sld", "id", "asd", "sli", "tbi"], sld: "Reading Fluency Skills", service: "lit",
    expect: by("read grade-level text at about 50 to 90 words correct per minute", "read grade-level text at about 100 to 140 words correct per minute with expression", "read grade-level text at about 140 to 150 words correct per minute", "read complex texts fluently enough to keep up with class readings"),
    impact: "keep up with class readings and finish reading tasks and tests in the time given",
    cause: "slow, effortful word reading that uses up attention needed for meaning",
    standard: (n) => `CCSS RF.${n <= 5 ? g(n) : "5"}.4: read with sufficient accuracy and fluency to support comprehension`,
    goals: [{ id: "orf", text: "read a grade-level passage aloud", unit: "words correct per minute" },
      { id: "orfi", text: "read an instructional-level passage aloud", unit: "words correct per minute" }],
    objectives: [{ id: "phr", text: "read with appropriate phrasing and expression on a 4-point fluency rubric", unit: "points" },
      { id: "acc", text: "read a grade-level passage with accuracy", unit: "% accuracy" },
      { id: "rep", text: "increase words correct per minute through repeated reading", unit: "words correct per minute" }],
    conditions: ["an unpracticed grade-level passage in a one-minute timed reading", "an instructional-level passage in a one-minute timed reading"],
    methods: ["oral reading fluency benchmarks", "one-minute timed readings", "i-Ready progress monitoring"],
    accs: ["readaloud", "audiobook", "extratime", "reducedreading"] },
  { id: "comp", label: "Reading comprehension", kind: "academic", for: ["sld", "id", "asd", "sli", "tbi", "sensory"], sld: "Reading Comprehension", service: "lit",
    expect: by("retell stories and answer who/what/where questions", "find main ideas and support answers with text evidence", "cite text evidence, analyze central ideas and make inferences", "analyze complex texts and cite strong evidence"),
    impact: "understand and answer questions about texts in ELA, science and social studies",
    cause: "difficulty identifying main ideas, making inferences and using text evidence",
    standard: (n) => `CCSS RI.${g(n)}.1 and RI.${g(n)}.2: cite textual evidence and determine central ideas`,
    goals: [{ id: "evid", text: "answer literal and inferential questions using evidence from the text", unit: "% accuracy" },
      { id: "main", text: "identify the main idea and two supporting details", unit: "% accuracy" },
      { id: "summ", text: "write an objective summary of the text", unit: "rubric points out of 4" }],
    objectives: [{ id: "lit", text: "answer literal questions about the text", unit: "% accuracy" },
      { id: "inf", text: "make an inference and support it with one piece of evidence", unit: "% accuracy" },
      { id: "vocab", text: "use context clues to define unknown words", unit: "% accuracy" },
      { id: "org", text: "complete a graphic organizer of the main idea and details", unit: "% accuracy" }],
    conditions: ["a grade-level informational text read aloud or independently", "an instructional-level passage", "a grade-level text with a graphic organizer"],
    methods: ["comprehension probes", "i-Ready progress monitoring", "work samples scored with a rubric"],
    accs: ["readaloud", "graphicorg", "chunk", "highlight", "extratime"] },
  { id: "writing", label: "Written expression", kind: "academic", for: ["sld", "id", "asd", "sli", "ohi", "tbi"], sld: "Written Expression", service: "wri",
    expect: by("write complete sentences about a topic", "write organized paragraphs with a topic sentence and details", "write multi-paragraph essays with claims and evidence", "write clear, organized argument and informational essays"),
    impact: "show what " + "{name} knows in writing, finish written assignments and organize ideas on paper",
    cause: "difficulty planning, organizing and getting ideas onto paper with complete sentences and conventions",
    standard: (n) => `CCSS W.${g(n)}.2 and W.${g(n)}.4: produce clear, organized writing appropriate to task and purpose`,
    goals: [{ id: "para", text: "write a paragraph with a topic sentence, three supporting details and a conclusion", unit: "% of rubric components" },
      { id: "essay", text: "write a multi-paragraph response with a claim, evidence and explanation", unit: "rubric points out of 4" },
      { id: "sent", text: "write complete sentences with correct capitalization and punctuation", unit: "% accuracy" }],
    objectives: [{ id: "plan", text: "complete a planning organizer before writing", unit: "% of opportunities" },
      { id: "topic", text: "write a topic sentence that answers the prompt", unit: "% of opportunities" },
      { id: "edit", text: "edit a draft for capitalization, punctuation and spelling using a checklist", unit: "% accuracy" },
      { id: "trans", text: "use transition words to connect ideas", unit: "% of opportunities" }],
    conditions: ["a grade-level writing prompt and a graphic organizer", "a writing prompt with a sentence starter", "a grade-level prompt and an editing checklist"],
    methods: ["writing samples scored with a rubric", "teacher-made checklists", "work samples"],
    accs: ["speechtotext", "graphicorg", "sentencestarters", "extratime", "notes"] },
  { id: "mathcalc", label: "Math calculation", kind: "academic", for: ["sld", "id", "asd", "tbi", "dd"], sld: "Mathematics Calculation", service: "math",
    expect: by("add and subtract within 20 fluently", "multiply, divide and work with fractions", "compute with rational numbers and solve equations", "solve multi-step algebraic problems"),
    impact: "complete grade-level computation, follow multi-step procedures and keep up in math class",
    cause: "difficulty recalling math facts and following the steps of multi-step procedures",
    standard: (n) => n <= 5 ? `CCSS ${g(n)}.NBT / ${g(n)}.NF: fluently compute with whole numbers and fractions` : n <= 8 ? `CCSS ${g(n)}.NS and ${g(n)}.EE: compute with rational numbers and solve equations` : "CCSS HSA-REI: reason with equations and inequalities",
    goals: [{ id: "multi", text: "solve multi-step computation problems showing each step", unit: "% accuracy" },
      { id: "frac", text: "add, subtract, multiply and divide fractions and decimals", unit: "% accuracy" },
      { id: "facts", text: "fluently recall multiplication and division facts", unit: "% accuracy" },
      { id: "integers", text: "compute with positive and negative numbers", unit: "% accuracy" }],
    objectives: [{ id: "facts", text: "recall basic math facts in a timed probe", unit: "% accuracy" },
      { id: "steps", text: "follow a step-by-step checklist to complete a procedure", unit: "% accuracy" },
      { id: "check", text: "check answers using the inverse operation", unit: "% of problems" },
      { id: "frac", text: "find common denominators", unit: "% accuracy" }],
    conditions: ["10 grade-level computation problems", "a problem set with a multiplication chart", "a computation probe and a step checklist"],
    methods: ["curriculum-based math probes", "i-Ready progress monitoring", "work samples"],
    accs: ["calculator", "multchart", "formula", "extratime", "chunk"] },
  { id: "mathps", label: "Math problem solving", kind: "academic", for: ["sld", "id", "asd", "sli", "tbi"], sld: "Mathematics Problem Solving", service: "math",
    expect: by("solve simple story problems with drawings", "solve multi-step word problems", "model real-world problems with equations", "model and solve real-world problems with functions"),
    impact: "solve word problems, explain math reasoning and apply math in other classes",
    cause: "difficulty understanding what a word problem is asking and choosing the right operation",
    standard: (n) => n <= 8 ? `CCSS Math Practice 1 and ${g(n)}.OA / ${g(n)}.EE: make sense of problems and solve real-world problems` : "CCSS Math Practice 1 and HSA-CED: create equations to solve problems",
    goals: [{ id: "wp", text: "solve grade-level word problems by identifying the question, choosing the operation and showing work", unit: "% accuracy" },
      { id: "model", text: "write and solve an equation that represents a real-world problem", unit: "% accuracy" }],
    objectives: [{ id: "key", text: "underline the question and circle the important numbers", unit: "% of problems" },
      { id: "op", text: "choose the correct operation for a word problem", unit: "% accuracy" },
      { id: "explain", text: "explain the answer in a complete sentence", unit: "% of problems" }],
    conditions: ["5 grade-level word problems read aloud", "grade-level word problems with a problem-solving checklist"],
    methods: ["curriculum-based word problem probes", "work samples scored with a rubric", "i-Ready progress monitoring"],
    accs: ["readaloud", "calculator", "formula", "chunk", "extratime"] },
  { id: "language", label: "Oral expression and listening comprehension", kind: "academic", for: ["sli", "asd", "sld", "sensory", "dd"], sld: "Oral Expression", service: "sl",
    expect: by("follow two-step directions and tell about events", "follow multi-step directions and explain ideas clearly", "take part in class discussions and present ideas", "present information and take part in academic discussions"),
    impact: "follow spoken directions, take part in discussions and explain ideas in class",
    cause: "difficulty understanding and using vocabulary and sentence structures",
    standard: (n) => `CCSS SL.${g(n)}.1 and SL.${g(n)}.4: take part in collaborative discussions and present ideas clearly`,
    goals: [{ id: "dir", text: "follow multi-step oral directions", unit: "% of opportunities" },
      { id: "retell", text: "retell a story or lesson in order using key vocabulary", unit: "% of story elements" },
      { id: "vocab", text: "define and use grade-level academic vocabulary in sentences", unit: "% accuracy" }],
    objectives: [{ id: "ask", text: "ask a clarifying question when directions are unclear", unit: "% of opportunities" },
      { id: "seq", text: "use sequence words (first, next, last) when explaining", unit: "% of opportunities" },
      { id: "syn", text: "name a synonym or example for a new word", unit: "% accuracy" }],
    conditions: ["structured speech-language sessions", "classroom discussions with visual supports"],
    methods: ["SLP data collection", "language samples", "observation data"],
    accs: ["visuals", "repeat", "checkin", "extratime", "notes"] },
  { id: "artic", label: "Speech sound production (articulation)", kind: "functional", for: ["sli"], service: "sl",
    expect: by("be understood by unfamiliar listeners", "speak clearly in class and with peers", "speak clearly in presentations", "speak clearly in presentations and interviews"),
    impact: "be understood by teachers and peers when speaking and reading aloud",
    cause: "errors producing specific speech sounds",
    standard: (n) => `CCSS SL.${g(n)}.6: adapt speech to a variety of contexts`,
    goals: [{ id: "sound", text: "produce target sounds correctly in conversation", unit: "% accuracy" }],
    objectives: [{ id: "word", text: "produce target sounds in words", unit: "% accuracy" }, { id: "sent", text: "produce target sounds in sentences", unit: "% accuracy" }],
    conditions: ["structured speech practice", "conversation with the SLP"], methods: ["SLP data collection"], accs: ["checkin"] },
  { id: "social", label: "Social skills and social communication", kind: "functional", for: ["asd", "sed", "sli"], service: "se",
    expect: by("take turns and play cooperatively", "work in groups and solve conflicts with peers", "work with peers, read social cues and keep friendships", "collaborate on teams and communicate in work settings"),
    impact: "work in groups, build relationships with peers and take part in class discussions",
    cause: "difficulty reading social cues and knowing how to start or keep a conversation",
    standard: () => "Colorado Essential Skills: Personal and Social skills (collaboration and interpersonal communication)",
    goals: [{ id: "conv", text: "start and keep a conversation with a peer for at least 3 exchanges", unit: "% of opportunities" },
      { id: "group", text: "take part in group work by sharing an idea and responding to peers", unit: "% of opportunities" },
      { id: "conflict", text: "use a learned strategy to solve a conflict with a peer", unit: "% of opportunities" }],
    objectives: [{ id: "cue", text: "identify a peer's feelings from facial expressions and body language", unit: "% accuracy" },
      { id: "greet", text: "greet a peer and ask a follow-up question", unit: "% of opportunities" },
      { id: "role", text: "practice a social skill in a role play", unit: "% of opportunities" }],
    conditions: ["structured small-group sessions", "unstructured times like lunch and group work"],
    methods: ["social worker observation data", "behavior checklists", "student self-monitoring sheets"],
    accs: ["checkin", "groups", "visuals", "breaks"] },
  { id: "behavior", label: "Self-regulation and classroom behavior", kind: "functional", for: ["sed", "ohi", "asd", "tbi"], service: "se",
    expect: by("follow class routines and calm down with adult help", "manage frustration and follow class expectations", "manage emotions and stay in class during challenges", "manage stress and conflict independently"),
    impact: "stay in class, manage frustration and finish work without disruptions",
    cause: "difficulty noticing and managing strong feelings before they turn into behavior",
    standard: () => "Colorado Essential Skills: Personal skills (self-management)",
    goals: [{ id: "cope", text: "use a coping strategy and return to the task within 3 minutes", unit: "% of observed opportunities" },
      { id: "follow", text: "follow adult directions within 1 minute of the first request", unit: "% of opportunities" },
      { id: "break", text: "request a break appropriately instead of leaving class", unit: "% of opportunities" }],
    objectives: [{ id: "name", text: "name his or her feelings using a feelings scale", unit: "% of opportunities" },
      { id: "strat", text: "choose a coping strategy from a menu", unit: "% of opportunities" },
      { id: "self", text: "self-monitor behavior on a daily point sheet", unit: "% of days" }],
    conditions: ["moments of frustration in class with a visual coping menu", "a daily behavior point sheet"],
    methods: ["behavior point sheets", "Liveschool data", "social worker observation data"],
    accs: ["breaks", "checkin", "seating", "visuals", "praise"] },
  { id: "ef", label: "Organization and task completion (executive functioning)", kind: "functional", for: ["ohi", "sld", "asd", "tbi"], service: "ef",
    expect: by("follow class routines with reminders", "keep track of materials and turn in homework", "use a planner, manage several classes and turn in work on time", "manage long-term projects and deadlines independently"),
    impact: "keep track of assignments, start tasks and turn in work on time in every class",
    cause: "difficulty planning, starting and keeping track of multi-step tasks",
    standard: () => "Colorado Essential Skills: Personal skills (initiative, self-direction and time management)",
    goals: [{ id: "turnin", text: "record assignments and turn in completed work by the due date", unit: "% of assignments" },
      { id: "start", text: "start independent work within 2 minutes using a task checklist", unit: "% of opportunities" },
      { id: "chunk", text: "break a long-term assignment into steps with due dates", unit: "% of projects" }],
    objectives: [{ id: "planner", text: "write assignments in a planner or digital calendar", unit: "% of days" },
      { id: "binder", text: "organize materials using a binder or folder system", unit: "% of weekly checks" },
      { id: "missing", text: "check the gradebook weekly and make a plan for missing work", unit: "% of weeks" }],
    conditions: ["a daily planner check with the case manager", "independent work time with a task checklist"],
    methods: ["planner checks", "gradebook missing-work reports", "teacher-made checklists"],
    accs: ["checklist", "chunk", "notes", "remind", "extratime"] },
  { id: "attention", label: "Attention and on-task behavior", kind: "functional", for: ["ohi", "asd", "sed", "tbi"], service: "ef",
    expect: by("attend to a short lesson and activity", "stay focused through a lesson and independent work", "stay focused through full class periods", "stay focused through long classes and lectures"),
    impact: "stay focused during lessons and independent work, which leads to missed directions and unfinished work",
    cause: "difficulty sustaining attention and filtering distractions",
    standard: () => "Colorado Essential Skills: Personal skills (self-management)",
    goals: [{ id: "ontask", text: "stay on task during independent work", unit: "% of observed intervals" },
      { id: "selfmon", text: "use a self-monitoring checklist to stay on task", unit: "% of class periods" }],
    objectives: [{ id: "redirect", text: "return to task after one nonverbal redirection", unit: "% of opportunities" },
      { id: "timer", text: "work for a set time with a visual timer before a break", unit: "% of opportunities" }],
    conditions: ["independent work time in core classes", "independent work with a visual timer"],
    methods: ["interval observation data", "self-monitoring sheets", "teacher checklists"],
    accs: ["seating", "breaks", "chunk", "checkin", "remind"] },
  { id: "advocacy", label: "Self-advocacy", kind: "functional", for: ["sld", "ohi", "asd", "sensory", "sli", "sed"], service: "tr",
    expect: by("ask an adult for help", "ask for help and explain what is hard", "explain their accommodations and ask for them", "lead their IEP meeting and request accommodations independently"),
    impact: "ask for help and use accommodations when they are needed",
    cause: "not yet knowing or explaining what help works best",
    standard: () => "Colorado Essential Skills: Personal skills (self-advocacy)",
    goals: [{ id: "ask", text: "ask for help or an accommodation using a respectful request", unit: "% of opportunities" },
      { id: "explain", text: "explain his or her disability, strengths and accommodations", unit: "% of components on a checklist" }],
    objectives: [{ id: "name", text: "name three accommodations that help in class", unit: "% accuracy" },
      { id: "script", text: "practice a request using a script", unit: "% of opportunities" }],
    conditions: ["class activities where help is needed", "a self-advocacy script"],
    methods: ["teacher checklists", "student self-reflection", "observation data"],
    accs: ["checkin", "remind"] },
  { id: "fine", label: "Fine motor and handwriting", kind: "functional", for: ["oi", "md", "dd", "asd", "tbi"], service: "ot",
    expect: by("write letters and use classroom tools", "write legibly and keep up with notes", "write and type to keep up with class work", "type and write efficiently for long assignments"),
    impact: "write legibly, keep up with note-taking and use classroom tools",
    cause: "difficulty with fine motor control and hand strength",
    standard: () => "OT functional goal supporting CCSS W.6 (use technology to produce writing)",
    goals: [{ id: "legible", text: "write a sentence legibly with correct spacing", unit: "% of letters legible" },
      { id: "type", text: "type a short paragraph", unit: "words per minute" }],
    objectives: [{ id: "grip", text: "use a functional grip on a writing tool", unit: "% of opportunities" },
      { id: "space", text: "use correct spacing between words", unit: "% accuracy" }],
    conditions: ["a copying task with a pencil grip", "a typing task on a laptop"],
    methods: ["OT data collection", "work samples"],
    accs: ["speechtotext", "notes", "extratime"] },
  { id: "adaptive", label: "Daily living and functional skills", kind: "functional", for: ["id", "md", "dd", "asd", "sensory"], service: "tr",
    expect: by("follow daily routines with little help", "manage personal belongings and daily routines", "manage a schedule, money and personal tasks", "manage money, transportation and daily living tasks"),
    impact: "complete daily routines, manage materials and become more independent at school and in the community",
    cause: "difficulty learning and remembering multi-step daily routines",
    standard: () => "Colorado Extended Evidence Outcomes / Essential Skills: Personal skills (independence)",
    goals: [{ id: "routine", text: "complete a multi-step daily routine using a visual schedule", unit: "% of steps independently" },
      { id: "money", text: "count money and make change for a purchase", unit: "% accuracy" }],
    objectives: [{ id: "visual", text: "follow a visual schedule to change activities", unit: "% of transitions" },
      { id: "coins", text: "identify coins and bills and their values", unit: "% accuracy" }],
    conditions: ["daily routines with a visual schedule", "a simulated store activity"],
    methods: ["task analysis data", "observation data"], accs: ["visuals", "checklist", "checkin"] },
];
export const needById = (id: string) => NEED_AREAS.find((n) => n.id === id);

/** Areas of need suggested for the student's disabilities (and the SLD areas found eligible). */
export function suggestedAreas(dis1: string, dis2: string, sldAreas: string[]): NeedArea[] {
  const tags = [disabilityTag(dis1), disabilityTag(dis2)].filter(Boolean);
  const fromSld = NEED_AREAS.filter((n) => n.sld && sldAreas.includes(n.sld));
  const rest = NEED_AREAS.filter((n) => !fromSld.includes(n) && n.for.some((t) => tags.includes(t)));
  return [...fromSld, ...rest];
}

export type Accommodation = { id: string; label: string; cat: "Presentation" | "Response" | "Setting" | "Timing and scheduling" | "Behavior and support"; text: string };
/** Each accommodation is written out fully, the way the rubric asks: what, when, where and who. */
export const ACCOMMODATIONS: Accommodation[] = [
  { id: "readaloud", label: "Read aloud (tests and texts)", cat: "Presentation", text: "Test directions, questions and grade-level texts read aloud (by an adult or text-to-speech) in all core classes, except when the skill being measured is decoding. The gen ed or special education teacher provides it." },
  { id: "audiobook", label: "Audiobooks / text-to-speech", cat: "Presentation", text: "Access to audiobooks and text-to-speech tools for class readings in ELA, science and social studies, provided by the teacher through the school's digital tools." },
  { id: "chunk", label: "Chunked assignments", cat: "Presentation", text: "Long assignments and tests broken into smaller parts with a check-in between parts, provided by the teacher in all core classes." },
  { id: "preview", label: "Preview vocabulary and texts", cat: "Presentation", text: "Key vocabulary and texts previewed before the lesson, in core classes, by the special education or gen ed teacher." },
  { id: "graphicorg", label: "Graphic organizers", cat: "Presentation", text: "Graphic organizers for reading and writing tasks in all core classes, provided by the teacher with the assignment." },
  { id: "highlight", label: "Highlighted key information", cat: "Presentation", text: "Key information, directions and vocabulary highlighted on assignments and tests by the teacher." },
  { id: "visuals", label: "Visual supports", cat: "Presentation", text: "Visual schedules, anchor charts and step-by-step visuals for routines and multi-step directions, posted or given by the teacher." },
  { id: "repeat", label: "Directions repeated and checked", cat: "Presentation", text: "Directions given in short steps, repeated or rephrased, with the student asked to restate them, in all classes, by the teacher." },
  { id: "notes", label: "Copy of class notes", cat: "Presentation", text: "A copy of guided or teacher notes for lessons with heavy note-taking, provided by the gen ed teacher before or after class." },
  { id: "reducedreading", label: "Shortened reading load", cat: "Presentation", text: "Shortened or leveled versions of long readings covering the same content, provided by the teacher when available." },
  { id: "calculator", label: "Calculator", cat: "Response", text: "A calculator for math tasks and tests when computation is not the skill being measured, in math and science classes; the teacher provides it." },
  { id: "multchart", label: "Multiplication chart", cat: "Response", text: "A multiplication chart for math work and tests when fact fluency is not the skill being measured, provided by the math teacher." },
  { id: "formula", label: "Formula / reference sheet", cat: "Response", text: "A formula and step reference sheet for math and science work and tests, provided by the teacher." },
  { id: "speechtotext", label: "Speech-to-text", cat: "Response", text: "Speech-to-text (dictation) for written assignments longer than a paragraph in all classes, using the school device; the teacher sets it up." },
  { id: "sentencestarters", label: "Sentence starters", cat: "Response", text: "Sentence starters and frames for written and spoken responses in core classes, provided by the teacher." },
  { id: "seating", label: "Preferential seating", cat: "Setting", text: "Seating near the point of instruction and away from distractions in all classes, arranged by the teacher." },
  { id: "smallgroup", label: "Small-group testing", cat: "Setting", text: "Tests and quizzes in a small group or separate quiet setting when requested or for unit tests, arranged by the special education teacher." },
  { id: "groups", label: "Structured group roles", cat: "Setting", text: "An assigned role and a supportive partner during group work in core classes, arranged by the teacher." },
  { id: "extratime", label: "Extended time", cat: "Timing and scheduling", text: "Extended time (time and a half) on tests, quizzes and major assignments in all core classes; the student requests it or the teacher arranges it, and late work within the extended time is not penalized." },
  { id: "breaks", label: "Breaks", cat: "Timing and scheduling", text: "Short breaks (up to 5 minutes, using a break pass) when frustrated or during long tasks, in all classes; the teacher signs the pass and the student returns to the task." },
  { id: "checkin", label: "Check-ins for understanding", cat: "Behavior and support", text: "A teacher check-in for understanding after directions and during independent work in core classes, done by the gen ed or special education teacher." },
  { id: "checklist", label: "Task checklist", cat: "Behavior and support", text: "A step-by-step task checklist for multi-step assignments and routines, provided by the teacher." },
  { id: "remind", label: "Reminders of due dates", cat: "Behavior and support", text: "Written or digital reminders of due dates and missing work, sent weekly by the case manager or teacher." },
  { id: "praise", label: "Specific praise and reinforcement", cat: "Behavior and support", text: "Frequent, specific praise and Liveschool points for meeting behavior goals in all classes, given by teachers." },
];
export const accById = (id: string) => ACCOMMODATIONS.find((a) => a.id === id);

export const STRENGTHS = ["kind and helpful to peers", "hard working", "creative", "a good listener", "funny and positive", "curious and asks good questions", "a strong leader", "good with technology", "artistic", "athletic", "musical", "good at building and hands-on tasks", "strong in math reasoning", "a strong reader", "a good storyteller", "responsible", "respectful to adults"];
export const INTERESTS = ["sports", "video games", "music", "art and drawing", "reading", "animals", "cooking", "building and engineering", "dance", "fashion", "cars", "technology and coding", "movies and TV", "being with friends and family"];
export const LEARNS_BEST = ["with visuals and models", "with hands-on activities", "in a small group", "with movement breaks", "with step-by-step directions", "when text is read aloud", "with checklists", "with check-ins from an adult", "with a partner", "when given choices", "when connected to their interests"];
export const INTERVENTIONS = ["Tier 2 reading intervention", "Tier 3 reading intervention (Really Great Reading)", "Tier 2 math intervention", "small-group instruction", "check-in/check-out", "a behavior plan", "counseling", "i-Ready personalized lessons", "classroom accommodations", "progress monitoring"];
export const DATA_SOURCES = ["i-Ready Reading", "i-Ready Math", "Really Great Reading", "CMAS", "Current grades", "Attendance", "Liveschool behavior data", "Gen ed teacher surveys", "Classroom observations", "Progress monitoring data", "Most recent evaluation report", "Medical history", "Speech-language report", "OT report", "Transition assessment"];
export const PARENT_CONCERNS = ["reading", "math", "writing", "grades and missing work", "behavior at school", "friendships", "focus", "homework", "attendance", "anxiety or stress", "life after high school"];
export const CMAS_LEVELS = ["Did Not Yet Meet Expectations", "Partially Met Expectations", "Approached Expectations", "Met Expectations", "Exceeded Expectations"];
export const IREADY_READING = ["Phonological Awareness", "Phonics", "High-Frequency Words", "Vocabulary", "Comprehension: Literature", "Comprehension: Informational Text"];
export const IREADY_MATH = ["Number and Operations", "Algebra and Algebraic Thinking", "Measurement and Data", "Geometry"];
export const GOAL_STATUS = ["met the goal", "made sufficient progress", "made some progress", "made limited progress", "has not made progress"];
export const MEASURE_FREQ = ["weekly", "every two weeks", "monthly"];
export const COURSES_9_12 = ["English 9", "English 10", "English 11", "English 12", "Algebra 1", "Geometry", "Algebra 2", "Biology", "Chemistry", "Physics", "World History", "U.S. History", "Civics", "Health", "PE", "Spanish 1", "Art", "Computer Science", "Engineering / CTE pathway", "Culinary / CTE pathway", "Business / CTE pathway", "Concurrent enrollment college course", "Work-based learning / internship", "Study skills / learning lab"];
export const POST_ED = ["will enroll in a 4-year college", "will enroll in a 2-year community college", "will enroll in a trade or technical program", "will enter a registered apprenticeship", "will enlist in the military and complete its training", "will take part in an on-the-job training program"];
export const POST_JOB = ["will work full-time", "will work part-time", "will work in supported employment"];
export const TRANSITION_ASSESSMENTS = ["Career interest inventory (Naviance / Xello)", "Transition Planning Inventory", "Student interview", "Parent interview", "Casey Life Skills assessment", "Work-based learning evaluation"];
export const TRANSITION_ACTIVITIES = ["The case manager will help the student complete a career interest inventory each year.", "The counselor will help the student plan courses toward graduation and the post-secondary goal.", "The case manager will help the student research two programs that match the post-secondary goal.", "The school will connect the student with a job shadow or work-based learning experience.", "The case manager will practice self-advocacy and leading the IEP meeting with the student.", "The family and case manager will help the student get a state ID and practice using public transportation.", "The case manager will share information about Colorado's Division of Vocational Rehabilitation (DVR) and the Pre-Employment Transition Services."];
export const AGENCIES = ["Colorado Division of Vocational Rehabilitation (DVR)", "Pre-Employment Transition Services (Pre-ETS)", "School to Work Alliance Program (SWAP)", "Community-centered board / developmental disability services", "College disability services office", "Workforce center"];
export const hsCourseHint = (n: number) => hs(n, "middle school", "high school");
