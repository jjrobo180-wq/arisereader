// "Help & FAQ" in Arise Reader for teachers (pages/TeacherReader.tsx, components/reader/ReaderHelp.tsx):
// how to do each thing in the Reader, in the words on its own buttons, and a search over all of it.
// Every word in **bold** is the exact text of a button, menu item, tab or box on the screen; the test
// (tests/reader-help.test.ts) checks that each one is really in the app, and that every "open" is a
// real item in the Reader menu, so an answer can't point at something that isn't there.

/** The Reader menu items a help answer can open (ids from MENU in pages/TeacherReader.tsx). */
export type HelpOpen =
  | "reader" | "challenge" | "readerStudents" | "readerApprovals" | "readerQuizzes" | "readerCatalog" | "readerLive"
  | "readerParents" | "readerAdvisory" | "english" | "beginners" | "leaderboard" | "readerScenes" | "readerGames"
  | "readerPrizes" | "paraTeam" | "whatsnew";

export type HelpEntry = {
  id: string;
  section: HelpSection;
  q: string;
  /** One or two sentences: the answer in short. */
  a: string;
  /** The steps, in order. */
  steps?: string[];
  /** Good to know: limits and what happens next. */
  notes?: string[];
  /** Other words a teacher might search with. */
  keywords?: string[];
  /** The menu item the "Take me there" button opens. */
  open?: HelpOpen;
};

export const HELP_SECTIONS = ["Getting started", "Students", "Approvals", "Quizzes & grading", "Live quiz & Scenes", "Parents", "Games & prizes", "More tools", "Your account"] as const;
export type HelpSection = (typeof HELP_SECTIONS)[number];

export const HELP: HelpEntry[] = [
  // Getting started
  {
    id: "overview", section: "Getting started",
    q: "What's on my Overview?",
    a: "Overview is your home screen. It shows four counts (**My Students**, **To approve**, **To grade** and **Book requests**) and a **Needs you today** list. Click any count or **Open** to go straight to it.",
    notes: ["In the **Neon Coast** theme the list is called **Today’s objectives** and its buttons say **Go**."],
    keywords: ["home", "dashboard", "start", "counts", "today", "main page"],
    open: "reader",
  },
  {
    id: "menu-phone", section: "Getting started",
    q: "Where is the menu on my phone?",
    a: "On a phone the menu is a narrow strip down the left. The **Hide** button at the top left hides it, and **Menu** brings it back. On a computer the menu is always on the left.",
    keywords: ["menu", "phone", "ipad", "tablet", "missing", "sidebar", "navigation", "can't find"],
  },
  {
    id: "first-week", section: "Getting started",
    q: "I'm new. What should I do first?",
    a: "Get your students in, connect their families, then let them read and quiz.",
    steps: [
      "Add your class in **My Students** with **Add students**, or have students sign up and approve them in **Approvals**.",
      "Send home parent codes from **Parents** with **Print letters for my class**.",
      "Check **Approvals** and **Quizzes & grading** each day. Their counts show on your Overview.",
    ],
    keywords: ["new", "begin", "setup", "set up", "first time", "getting started", "how to use"],
    open: "readerStudents",
  },

  // Students
  {
    id: "add-students", section: "Students",
    q: "How do I add my students?",
    a: "Add your whole class at once from a spreadsheet. They're put in your class.",
    steps: [
      "Open **My Students** and click **Add students**.",
      "Choose **Upload a file**: click **Download the template (.csv)**, fill in First name, Last name and Student number, then click **Choose a CSV file**.",
      "Or choose **Paste from a spreadsheet** and paste the three columns, one student per line.",
      "Check the preview, then click **Add students**.",
    ],
    notes: [
      "Each student's username and starting password are both their student number. They're asked to pick their own password the first time they sign in.",
      "Students who already have an account are skipped.",
    ],
    keywords: ["import", "roster", "csv", "excel", "spreadsheet", "bulk", "upload", "create accounts", "new students", "class list"],
    open: "readerStudents",
  },
  {
    id: "students-sign-up", section: "Students",
    q: "How do students join my class on their own?",
    a: "A student makes an account on the Arise Reader sign-up page and picks their school, their grade and you as their teacher (or their advisory). If they're waiting for you, they show up in **Approvals** under **Joining**. Click **Approve**.",
    keywords: ["join", "sign up", "signup", "register", "waiting", "pending", "new student", "enroll"],
    open: "readerApprovals",
  },
  {
    id: "reset-password", section: "Students",
    q: "How do I reset a student's password?",
    a: "You can set a new password for any student in your class.",
    steps: [
      "Open **My Students**. Type the name in the search box if you need to.",
      "Click **Password** on the student's row.",
      "Type the new password (at least 4 characters) and click **Change password**.",
    ],
    notes: ["The new password shows on screen right after, exactly as it was saved, so you can tell the student."],
    keywords: ["forgot", "password", "login", "log in", "sign in", "locked out", "can't sign in", "reset", "change password"],
    open: "readerStudents",
  },
  {
    id: "student-profile", section: "Students",
    q: "How do I see one student's progress?",
    a: "In **My Students**, click **Profile** on the student's row. It opens right over the page with their points, quizzes, books and reading checks, and a **Print parent letter** button.",
    keywords: ["progress", "data", "points", "scores", "history", "report", "how is my student doing", "profile"],
    open: "readerStudents",
  },
  {
    id: "message-student", section: "Students",
    q: "How do I send a student a message?",
    a: "In **My Students**, click **Message** on the student's row, type it in the box and click **Send**.",
    keywords: ["message", "note", "chat", "talk", "send", "tell"],
    open: "readerStudents",
  },
  {
    id: "certificates", section: "Students",
    q: "Where are a student's certificates?",
    a: "In **My Students**, click **Certificates** on the student's row to see the certificates they've earned.",
    keywords: ["certificate", "award", "achievement", "print certificate"],
    open: "readerStudents",
  },
  {
    id: "duplicates", section: "Students",
    q: "A student has two accounts. How do I fix it?",
    a: "Merge them. Their quizzes, points, reading and work all move to one account, and the extra account is archived.",
    steps: [
      "Open **My Students** and scroll to the **Duplicate accounts** card.",
      "If the pair is listed, click **Review and merge**.",
      "If not, click **Merge two accounts**, pick the account to keep and the one to merge in, then click **Next** to review it.",
    ],
    keywords: ["duplicate", "two accounts", "double", "merge", "combine", "extra account"],
    open: "readerStudents",
  },
  {
    id: "whole-school", section: "Students",
    q: "How do I find a student who isn't in my class?",
    a: "Open **View all students**. It lists the whole school. Search by name or username, or filter by advisory or by Lit teacher.",
    keywords: ["whole school", "all students", "other class", "find", "search", "advisory", "lit teacher"],
    open: "readerAdvisory",
  },
  {
    id: "change-advisory", section: "Students",
    q: "How do I move a student to another advisory?",
    a: "Open **View all students**, find the student and click **Advisory**. Pick the new one and click **Change advisory**. Their ELA teacher stays the same.",
    notes: ["At a school without an advisory list, the same button lets you pick a new teacher and click **Move student** instead."],
    keywords: ["move", "transfer", "wrong advisory", "wrong teacher", "reassign", "switch class"],
    open: "readerAdvisory",
  },
  {
    id: "student-reward", section: "Students",
    q: "How do I give one student a reward?",
    a: "Open **View all students**, find the student and click **Rewards**. Type a title and the message they'll see, add how many quizzes they need if you want, and click **Add reward**.",
    keywords: ["reward", "incentive", "badge", "goal", "motivate", "one student"],
    open: "readerAdvisory",
  },

  // Approvals
  {
    id: "approvals", section: "Approvals",
    q: "What's in Approvals?",
    a: "Four tabs of things waiting on you: **Quiz requests**, **Joining**, **Grade changes** and **Find-a-book requests**. A red number shows how many are in each.",
    keywords: ["approve", "approvals", "waiting", "requests", "pending", "to do"],
    open: "readerApprovals",
  },
  {
    id: "quiz-requests", section: "Approvals",
    q: "A student asked for a quiz on a new book. What do I do?",
    a: "A.R.I.S.E. wrote the questions for that book. Check them, then approve.",
    steps: [
      "Open **Approvals** and the **Quiz requests** tab.",
      "Click **Review questions** to read each question and its right answer.",
      "Click **Approve**, or **Send back** if the questions aren't right.",
    ],
    notes: [
      "Once you approve, the student gets a “Your quiz is ready!” banner and notification right away.",
      "Under **Other students' quiz requests** you can approve students from other classes too, so no one waits.",
    ],
    keywords: ["quiz request", "new book", "book not in library", "missing quiz", "request a quiz", "approve quiz"],
    open: "readerApprovals",
  },
  {
    id: "grade-changes", section: "Approvals",
    q: "A student wants to change their grade. What does approving do?",
    a: "Open **Approvals** and the **Grade changes** tab. Each request shows the grade they have now and the one they're asking for. **Approve** changes which books and leaderboard they see. **Deny** keeps things as they are.",
    keywords: ["grade change", "wrong grade", "grade level", "books too easy", "books too hard", "band"],
    open: "readerApprovals",
  },
  {
    id: "book-requests", section: "Approvals",
    q: "What are Find-a-book requests?",
    a: "Students asking you to help them get a copy of a book. There's nothing to approve. Help them find it, then click **Done**. A student asking for a quiz shows up under **Quiz requests** instead.",
    keywords: ["book request", "find a book", "copy", "library", "get a book"],
    open: "readerApprovals",
  },

  // Quizzes & grading
  {
    id: "grade-writing", section: "Quizzes & grading",
    q: "How do I grade students' written answers?",
    a: "After a book quiz, students can write about the book for up to 10 extra points. You grade those here.",
    steps: [
      "Open **Quizzes & grading** and the **To grade** tab.",
      "Read the answers. You can use the **AI suggestion** or decide yourself.",
      "Pick 10, 5 or 0, or type any number from 0 to 10. Add a note if you want.",
      "Click **Save grade**.",
    ],
    notes: [
      "The student gets a message with the points and your note.",
      "To change a grade later, switch to **Graded** and click **Change grade**.",
    ],
    keywords: ["grade", "grading", "comprehension", "writing", "written", "extra points", "extra credit", "bonus", "essay", "responses"],
    open: "readerQuizzes",
  },
  {
    id: "proctor-code", section: "Quizzes & grading",
    q: "Where is my proctor code?",
    a: "Open **Quizzes & grading** and the **Proctor & growth** tab. Students type this code to start a proctored quiz, so share it only while you're proctoring. **Copy** copies it.",
    keywords: ["proctor", "code", "supervise", "test code", "quiz code", "proctored"],
    open: "readerQuizzes",
  },
  {
    id: "camera-quizzes", section: "Quizzes & grading",
    q: "How do I check a quiz a student took alone with the camera on?",
    a: "Open **Quizzes & grading** and the **Camera quizzes** tab. **To check** shows the ones worth a look. Click a quiz to see its pictures and what happened.",
    notes: [
      "If something looks wrong, click the button that says how many points it will remove, then **Remove points** to confirm. You can give them back later.",
      "**Delete pictures** removes the pictures but keeps the timeline and points. Pictures are kept for 30 days.",
    ],
    keywords: ["camera", "cheating", "pictures", "photos", "webcam", "alone", "unproctored", "remove points"],
    open: "readerQuizzes",
  },
  {
    id: "growth-check", section: "Quizzes & grading",
    q: "Where are growth check results?",
    a: "Open **Quizzes & grading** and the **Proctor & growth** tab. **Growth check** lists each student's score and their reading speed in words a minute.",
    keywords: ["growth", "fluency", "wcpm", "words per minute", "reading speed", "assessment", "progress monitor"],
    open: "readerQuizzes",
  },
  {
    id: "passing", section: "Quizzes & grading",
    q: "What counts as passing a quiz?",
    a: "70% or more. A passed quiz adds the book's points to the student's total and to their advisory in the Advisory Challenge.",
    keywords: ["pass", "passing", "score", "percent", "points", "how many points", "70"],
    open: "leaderboard",
  },
  {
    id: "catalog", section: "Quizzes & grading",
    q: "How do I see which books have quizzes?",
    a: "Open **Book catalog**. It lists every book students can take a quiz on. Search by title or author, or narrow it by **Grade band** and **Points**. Click **Preview quiz →** to see a quiz. Books marked **Read on Arise** can be read right on the site.",
    notes: ["Students see the books for their own grade band."],
    keywords: ["books", "catalog", "library", "titles", "which books", "quiz list", "preview quiz", "find a book"],
    open: "readerCatalog",
  },

  // Live quiz & Scenes
  {
    id: "live-quiz", section: "Live quiz & Scenes",
    q: "How do I run a live quiz with my class?",
    a: "Your whole class plays at once on their own screens.",
    steps: [
      "Open **Live quiz**.",
      "Under **Create**, pick a game style, type what you're teaching and click **Generate with AI**. Or open **Ready Sets** and click **Play now**, or **My Games** and click **Host**.",
      "Show the **JOIN CODE** on the board. Students tap **Join Live** in their library and type it.",
      "Click **Start** (it names the game style) when everyone is in, then **Reveal Answer** and **Next Round** for each question (the last one says **Finish Game**). **End Game** stops it early for everyone.",
    ],
    notes: ["Live quiz needs the Class plan."],
    keywords: ["live", "game", "kahoot", "quizizz", "jeopardy", "whole class", "join code", "host", "play together"],
    open: "readerLive",
  },
  {
    id: "scenes", section: "Live quiz & Scenes",
    q: "How do I present a Scene from a book?",
    a: "A Scene is a picture of a part of a book, which you can present and ask live questions about.",
    steps: [
      "Open **Scenes**. Under **Create a Scene**, type the book title, the chapters and what students should see, pick a **Look**, and click **Generate & save panorama**.",
      "Find it under **Your Scenes** and click **Present**.",
      "Click **Start live for students** and give them the **Student code**. They tap **Join Teacher Scene** in their library.",
      "Click **Send to class** to send the Scene to your students' screens, **Ask students** on a question to ask it live, and **End live** when you're done.",
    ],
    keywords: ["scene", "picture", "visualize", "illustration", "present", "book scene", "comprehension question"],
    open: "readerScenes",
  },

  // Parents
  {
    id: "parent-letters", section: "Parents",
    q: "How do I connect parents to their child's account?",
    a: "Each student has a private parent code. Send it home and the parent signs up with it.",
    steps: [
      "Open **Parents**.",
      "Click **Print letters for my class** for a letter per student with their code.",
      "Or, for one student, use **Letter**, **Link** (copies the sign-up link) or **Sign-up page** on their row under **Your students' families**.",
    ],
    notes: ["Each student shows **Not linked** or how many parents are linked, so you can see who still needs a code."],
    keywords: ["parent", "family", "guardian", "code", "letter", "connect", "link", "home", "sign up parent"],
    open: "readerParents",
  },
  {
    id: "email-parent", section: "Parents",
    q: "How do I email a parent their child's code?",
    a: "Open **Parents** and go to **Email a parent their child's code**. Pick the student first, type the parent's email, and click **Send invitation**. The email explains how to sign up with the code.",
    notes: ["For a child who doesn't have an account yet, use **Invite a family that isn't signed up yet** instead."],
    keywords: ["email", "invite", "parent", "send code", "family", "guardian"],
    open: "readerParents",
  },

  // Games & prizes
  {
    id: "game-time", section: "Games & prizes",
    q: "How do students earn game time, and how do I control it?",
    a: "Passing a book quiz unlocks unlimited A.R.I.S.E. games for the rest of that week (Monday to Sunday). Open **Game time** to change that for each student. Your locks always win.",
    steps: [
      "In **Each student**, click **Lock** to stop a student's games (**Unlock** to undo).",
      "**Passed quiz reward** turns the unlimited week on or off.",
      "**Games a day** and **Games per passed quiz** set limits.",
    ],
    keywords: ["games", "game time", "play", "lock", "limit", "arcade", "unlock", "screen time", "too many games"],
    open: "readerGames",
  },
  {
    id: "game-minutes", section: "Games & prizes",
    q: "A student is asking for more game minutes. How do I answer?",
    a: "Open **Game time**. A student who's asking shows at the top of the list. Click **Give** (it shows how many minutes they asked for) or **No**. The +5, +10 and +15 buttons add minutes any time.",
    notes: ["Bonus minutes are for today only."],
    keywords: ["minutes", "more time", "asking", "request", "bonus", "extra time"],
    open: "readerGames",
  },
  {
    id: "closing-hours", section: "Games & prizes",
    q: "Can I close Club A.R.I.S.E. during class?",
    a: "Yes. Open **Game time** and use **Class closing hours**. Check **Close Club A.R.I.S.E. for my class at set times**, set **Closes at** and **Opens again at**, pick the days, and click **Save closing hours**.",
    notes: ["Times are Mountain Time. A closing time later than the opening time runs overnight."],
    keywords: ["close", "closing", "hours", "schedule", "class time", "block", "club arise", "turn off games"],
    open: "readerGames",
  },
  {
    id: "prizes", section: "Games & prizes",
    q: "How do I put up a prize?",
    a: "Open **Prizes**. Type the prize and how to win it, add a last day and a number of quizzes if you want, choose **My class** or your whole school, and click **Add prize**. Students see it on their rewards page and beside the leaderboards.",
    notes: ["When someone wins, click **Give prize** and pick who. You hand it over yourself. **Take it back** undoes it."],
    keywords: ["prize", "reward", "contest", "incentive", "win", "homework pass", "competition"],
    open: "readerPrizes",
  },
  {
    id: "top-reader", section: "Games & prizes",
    q: "What is the Top Reader Challenge?",
    a: "Students race one by one. Everyone started at 0 on Monday, Nov 23, and the 2 students with the most reading points by the end of Monday, Nov 30 each win a $5 gift card or snacks (chips, candy and a drink). Open **Leaderboard** to see the whole board, or click **See the leaderboard** on your Overview.",
    notes: [
      "Points are the usual ones: a passed quiz adds the book's points, and points you give count too.",
      "Students see the top 10 and their own place. You see every student who has scored.",
      "If two students tie for a prize, both are shown as winners.",
    ],
    keywords: ["top reader", "challenge", "contest", "gift card", "snacks", "candy", "chips", "drink", "winners", "most points", "race", "new challenge"],
    open: "leaderboard",
  },
  {
    id: "advisory-challenge", section: "Games & prizes",
    q: "Where are the Advisory Challenge poster, login papers and slide?",
    a: "Open **Advisory Challenge**. It has the **Hallway poster**, **Student login papers** (4 per page with a QR code), the **Advisory slide**, and a **Slide for Google Slides**, plus how to run it. **Leaderboard** shows the standings.",
    keywords: ["advisory", "challenge", "poster", "login papers", "handout", "slide", "pizza", "standings", "competition", "qr"],
    open: "challenge",
  },

  // More tools
  {
    id: "english", section: "More tools",
    q: "How do I turn on English Explorer for an English learner?",
    a: "Open **English learners** and click **Turn on for students**. Choose where they start and their home language, then click **Turn on** for each student. They see English Explorer in their library right away.",
    keywords: ["english", "ell", "esl", "ml", "multilingual", "newcomer", "language", "wida", "english explorer"],
    open: "english",
  },
  {
    id: "beginners", section: "More tools",
    q: "What is Beginners (K–3)?",
    a: "A.R.I.S.E. Beginners is for young readers. Open **Beginners (K–3)** to try every lesson the way a child sees it (nothing you do there is saved) and to see each student's progress.",
    keywords: ["beginners", "k-3", "kindergarten", "early reader", "phonics", "young", "primary", "little kids"],
    open: "beginners",
  },
  {
    id: "para-team", section: "More tools",
    q: "How do I share with my paras?",
    a: "Open **Para Team**. Under **Start a team**, type a name and click **Make the team**. Then click **Invite paras** and send them the link. They join with a free account, and the team shares the daily schedule, a calendar, to-dos, messages, student pages and files.",
    keywords: ["para", "paraprofessional", "aide", "1:1", "one on one", "team", "share", "staff"],
    open: "paraTeam",
  },
  {
    id: "whats-new", section: "More tools",
    q: "How do I see what's new in Arise Reader?",
    a: "Open **What's new** in the menu.",
    keywords: ["new", "updates", "changes", "features", "coming soon"],
    open: "whatsnew",
  },

  // Your account
  {
    id: "workhub", section: "Your account",
    q: "How do I open my WorkHub?",
    a: "Click **Open your WorkHub** in the banner at the top of the page. WorkHub keeps your lessons, IEP minutes, meetings, tasks and notes, and comes with your account.",
    notes: ["The banner isn't shown inside the iPhone app. Open the Reader on the website to use it."],
    keywords: ["workhub", "hub", "lessons", "iep", "calendar", "tasks"],
  },
  {
    id: "theme", section: "Your account",
    q: "Can I change how the Reader looks?",
    a: "Yes. Click **Theme** at the top and pick **Classic** or **Neon Coast**. It's remembered on this device.",
    keywords: ["theme", "dark", "color", "look", "style", "appearance"],
  },
  {
    id: "iphone-app", section: "Your account",
    q: "Is there an iPhone or iPad app?",
    a: "Yes. Arise Reader is free on the App Store. On the website, the **Arise Reader is now an app** card near the top has a **Download on the** App Store button.",
    keywords: ["app", "iphone", "ipad", "ios", "download", "mobile", "apple"],
  },
  {
    id: "sign-out", section: "Your account",
    q: "How do I sign out?",
    a: "Click **Sign out** at the top right.",
    keywords: ["log out", "logout", "sign off", "leave"],
  },
];

/** Little words that say nothing about what the teacher wants. */
const STOP = new Set(["a", "an", "and", "are", "can", "do", "does", "for", "get", "how", "i", "in", "is", "it", "me", "my", "of", "on", "or", "the", "to", "what", "where", "who", "why", "with", "you", "your", "there", "this", "that", "when", "will", "want", "need"]);

/** Words teachers use for the same thing. A query word matches if any word in its group does. */
const SAME: string[][] = [
  ["password", "pw", "passcode", "login", "log", "signin"],
  ["student", "students", "kid", "kids", "child", "children", "learner"],
  ["parent", "parents", "family", "families", "guardian", "mom", "dad"],
  ["prize", "prizes", "reward", "rewards", "incentive"],
  ["grade", "grading", "score", "mark"],
  ["delete", "remove"],
  ["add", "import", "create", "new"],
  ["game", "games", "play", "arcade"],
];

export const normalize = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[‘’']/g, "").replace(/[^a-z0-9:]+/g, " ").trim();
const words = (s: string) => normalize(s).split(" ").filter((w) => w && !STOP.has(w));
const forms = (w: string) => { const g = SAME.find((group) => group.includes(w)); return g || [w]; };

/** An entry's text, with the **bold** marks taken out. */
export const plain = (s: string) => s.replace(/\*\*/g, "");
const haystack = (e: HelpEntry) => normalize([e.q, e.a, ...(e.steps || []), ...(e.notes || []), ...(e.keywords || []), e.section].map(plain).join(" "));

/** The entries that answer a search, best first. Every word searched for has to be found (or one of
 *  its other names); the question and keywords count for more than the rest. An empty search gives all. */
export function searchHelp(query: string, entries: HelpEntry[] = HELP): HelpEntry[] {
  const wanted = words(query);
  if (!wanted.length) return normalize(query) ? [] : entries;
  const scored: Array<{ e: HelpEntry; score: number; i: number }> = [];
  entries.forEach((e, i) => {
    const all = ` ${haystack(e)} `;
    const top = ` ${normalize([e.q, ...(e.keywords || [])].join(" "))} `;
    let score = 0;
    for (const w of wanted) {
      const alts = forms(w);
      // A word matches at the start of a word ("pass" finds "password"); a short word must match whole.
      const hit = (text: string) => alts.some((x) => (x.length < 3 ? text.includes(` ${x} `) : text.includes(` ${x}`)));
      if (!hit(all)) return;
      score += hit(top) ? 3 : 1;
    }
    if (top.includes(` ${normalize(query)} `)) score += 5;
    scored.push({ e, score, i });
  });
  return scored.sort((x, y) => y.score - x.score || x.i - y.i).map((s) => s.e);
}

/** Splits text into plain and **bold** parts, for showing button names in bold. */
export function boldParts(s: string): Array<{ text: string; bold: boolean }> {
  return s.split(/(\*\*[^*]+\*\*)/).filter(Boolean).map((p) => (p.startsWith("**") && p.endsWith("**") ? { text: p.slice(2, -2), bold: true } : { text: p, bold: false }));
}
