// Plans and pricing. Public: anyone can open it without an account.
// Free is for students and their parents; Class is for teachers and schools
// (the plan the rest of the code calls Premium). Each card lists its add-ons right
// under its prices: Teacher Hub, the Learning Bundle and A.R.I.S.E. To-Do for a
// class, and the Learning Bundle and To-Do for a family.
// A teacher's first month of Class and Teacher Hub is free.
// Every price and limit on this page comes from shared/plans.ts.
import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { PLANS, freeMonthEnd, usd } from "@shared/plans";
import "./pricing.css";

const T = PLANS.teacher, S = PLANS.school, H = PLANS.hub, BU = PLANS.bundle, TD = PLANS.todo;
const block = T.studentsPerBlock.toLocaleString("en-US");
const schoolCap = S.studentCap.toLocaleString("en-US");
const kids = PLANS.parentMaxChildren;
// The site keeps Mountain time, so the free month's dates read the same for everyone.
const mountainDay = (isoDate: string) => new Date(isoDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "America/Denver" });

const Yes = ({ label = "Included" }: { label?: string }) => (
  <svg className="pr-yes" role="img" aria-label={label} viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const No = () => <svg className="pr-no" role="img" aria-label="Not included" viewBox="0 0 24 24"><path d="M7 12h10" /></svg>;
const Tick = () => <svg className="pr-tick" aria-hidden="true" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;

type Item = string | { text: string; note: string };
function List({ items }: { items: Item[] }) {
  return (
    <ul className="pr-list">
      {items.map((it) => {
        const text = typeof it === "string" ? it : it.text;
        return <li key={text}><Tick /><span>{text}{typeof it !== "string" && <small>{it.note}</small>}</span></li>;
      })}
    </ul>
  );
}

const FREE_STUDENTS: Item[] = [
  "Free books, poems and kids' news, all read right on the site",
  "Quizzes for library books, or any book on request, with points for every pass",
  "A leaderboard rank, levels, streaks, badges, daily missions and printable certificates",
  { text: "Every game world and multiplayer game, plus Avatar World with Reader Coins earned by reading", note: "10 minutes a day, or unlimited for the week after passing a book quiz" },
  "Study Squad with starter sets and sets they write themselves",
  "Eye Gazer mode and read-aloud for non-verbal and eye-gaze learners",
];
const FREE_PARENTS: Item[] = [
  "A parent account to follow their child's quizzes, scores and points",
  "Game limits they set: lock games, cap daily play, or make game time something passed quizzes earn",
  "A proctor code for quizzes at home, and review of camera-checked quizzes",
];
const PREMIUM_TEACHER: Item[] = [
  "A teacher dashboard for the whole class, with every student's quizzes, scores and points",
  { text: "Live class games in seven game-show styles, and Scenes: AI-drawn story scenes to present and quiz live", note: "Students join with a code, and AI writes the questions from your topic" },
  "Game controls for the class: lock games for a student, set daily limits, make game time something passed quizzes earn, and close games during class hours",
  "Your own prizes for a class or school, shown right in the leaderboards and competitions",
  "A teacher proctor password, review of camera-checked quizzes, shared Study Squad sets and printable parent invite letters",
];
const PREMIUM_FAMILIES: Item[] = [
  "Everything in Free, with free parent accounts for every family in the class",
  "Prizes to read for from their teachers or parents, and personal rewards a teacher sets for one student",
  "AI study sets, and lessons built from topics they pick",
];

const BUNDLE_APPS: Item[] = [
  "Arise History: true stories, quizzes, points and leaderboards",
  "Arise Math: practice for every grade that levels up as students do",
  "Arise Social: explore trades, the military, teaching, health care, tech and college paths. Teachers approve every student post, and there are no private messages.",
];
const hubBlock = H.studentsPerBlock.toLocaleString("en-US");

// The add-ons listed under each card's prices. A row shows the name, a few words
// and the price; tapping it opens the rest.
type Addon = { id: string; name: string; tag: string; amount: string; per: string; detail: string; items: Item[] };
const CLASS_ADDONS: Addon[] = [
  { id: "hub", name: "Teacher Hub", tag: "Caseloads, IEP timelines, lessons and grades",
    amount: usd(H.monthlyCents), per: "a month",
    detail: `One teacher: ${usd(H.monthlyCents)} a month for up to ${hubBlock} students, plus ${usd(H.monthlyCents)} for each extra ${hubBlock}. Whole school: ${usd(H.schoolYearlyCents)} a year for up to ${H.schoolStudentCap.toLocaleString("en-US")} students, a full 12 months. It works with or without Class, and a teacher's first month is free.`,
    items: [
      "Caseloads with accommodations, reading and math levels, and an IEP and meeting timeline",
      "Lesson plans, reminders and to-dos, plus check-ins, concerns and meeting notes for each student",
      "Attendance, a gradebook, behavior points, parent contact logs and weekly student schedules",
      "Add with AI: paste a list, snap a screenshot, or upload Excel, Word or PDF, and check it before it's saved",
      "A calendar that connects to Google, Outlook or Apple, and an email organizer",
      "Private to each teacher, on a phone, tablet or computer",
    ] },
  { id: "bundle", name: "Learning Bundle", tag: "Arise History, Arise Math and Arise Social",
    amount: usd(BU.teacherMonthlyCents), per: "a month",
    detail: `For a class of up to ${BU.teacherSeats} students, on top of Class. 30 days free first, no card needed. A family that was paying gets its unused days refunded once the class plan covers all of its children.`,
    items: BUNDLE_APPS },
  { id: "todo", name: "A.R.I.S.E. To-Do", tag: "Comes with Teacher Hub",
    amount: "Included", per: "",
    detail: "Lists, chores, the family calendar, polls, trips, money and notes. Teachers get it with Teacher Hub: one subscription for both.",
    items: [] },
];
const FAMILY_ADDONS: Addon[] = [
  { id: "family-bundle", name: "Learning Bundle", tag: "Arise History, Arise Math and Arise Social",
    amount: usd(BU.familyMonthlyCents), per: "a month",
    detail: "One plan covers the parent and every linked child. 30 days free first, no card needed. If a teacher's class plan covers every child, the family's plan stops and the unused days are refunded to their card.",
    items: BUNDLE_APPS },
  { id: "family-todo", name: "A.R.I.S.E. To-Do", tag: "Lists, chores and the family calendar",
    amount: usd(TD.familyMonthlyCents), per: "a month",
    detail: "Lists, chores, the family calendar, polls, trips, money and notes, saved to your account on every device. 30 days free first.",
    items: [] },
];

type Cell = boolean | string;
const COMPARE: { group: string; rows: [string, Cell, Cell][] }[] = [
  { group: "Reading", rows: [
    ["Quizzes for library books", true, true],
    ["Free books, poems and kids' news to read on the site", true, true],
    ["A quiz for any book, on request", "Checked before it goes live", "Approved by the teacher"],
    ["AI study sets, and lessons from topics a student picks", false, true],
  ] },
  { group: "Motivation", rows: [
    ["Points, levels, streaks and badges", true, true],
    ["A rank on the leaderboard", true, true],
    ["Prizes you add yourself", "Added by a parent", "Added by a teacher, school or parent"],
    ["Personal rewards from the teacher", false, true],
    ["Printable certificates", true, true],
  ] },
  { group: "Games", rows: [
    ["Every game world and multiplayer game", true, true],
    ["Game time", "10 minutes a day, more by passing quizzes. Parents can set limits.", "The teacher sets the rules for the class"],
    ["Avatar World and Reader Coins", true, true],
    ["Study Squad", "Starter sets and your own", "Plus AI sets and sets the teacher shares"],
    ["Live class games", false, true],
  ] },
  { group: "Parents", rows: [
    ["Parent account with progress and game limits", `Free, for up to ${kids} children`, "Free for every family in the class"],
    ["Keeping quizzes honest", "Camera check or a parent proctor code", "Plus a teacher proctor password and review"],
  ] },
  { group: "Classroom", rows: [
    ["Teacher account and dashboard", false, true],
    ["Game controls for the whole class, and closing hours", false, true],
    ["Every student's quizzes, scores and points", false, true],
    ["Scenes: AI story scenes to present live", false, true],
  ] },
  { group: "Access", rows: [
    ["Eye Gazer mode and read-aloud", true, true],
    ["Custom picture quizzes for Eye Gazer students", false, true],
  ] },
];

const QUESTIONS: [string, string][] = [
  ["Will students or parents ever have to pay?",
    `No. Reading, quizzes, the leaderboard, the games and the parent account are free for every family, with or without a school. One parent profile can follow up to ${kids} children. Reader Coins are earned by reading and are never sold.`],
  ["What does a parent account do?",
    `It shows your child's quizzes, scores and points, gives you a proctor code for quizzes at home, and lets you set game limits. It is free, and one profile can follow up to ${kids} children.`],
  ["Who is Class for?",
    "Teachers and schools. It adds the classroom tools on top of what every student and parent already gets for free."],
  ["Does Free limit how much a student can read?",
    "No. There is no cap on books or quizzes. The only limit on Free is game time: 10 minutes a day, or unlimited for the rest of the week once they pass a book quiz."],
  ["Who gives the prizes?",
    "Parents, teachers and schools do. A.R.I.S.E. doesn't hand out prizes on any plan. On Free, a parent can add their own prize for their child. On Class, a teacher or school can also add prizes for a class or the whole school, and they show up right in the leaderboards and competitions."],
  ["Is there a free month for teachers?",
    `Yes. Every teacher's first month is free: the teacher account and Teacher Hub (with A.R.I.S.E. To-Do). It starts the day you make your teacher account, and no card is needed. Teachers who already had an account on ${mountainDay(PLANS.freeMonthFrom)} have theirs until ${mountainDay(freeMonthEnd(null))}.`],
  ["How much is Class?",
    `A teacher pays ${usd(T.monthlyCents)} a month for up to ${block} students, plus ${usd(T.monthlyCents)} a month for each extra ${block}. A school pays ${usd(S.yearlyCents)} a year for up to ${schoolCap} students, and every teacher gets their own account. A school's year is a full 12 months, so summer reading clubs and competitions are covered.`],
  ["My school already uses A.R.I.S.E. What changes for us?",
    "Nothing this school year. Teachers and students at any school who signed up before October 1, 2026 keep everything they have today, free, for the full 2026–27 school year."],
  ["What is Teacher Hub?",
    `A separate add-on: a private workspace for caseloads, IEP timelines, lessons, notes, attendance, grades, parent contact and schedules. It is ${usd(H.monthlyCents)} a month for up to ${H.studentsPerBlock.toLocaleString("en-US")} students, plus ${usd(H.monthlyCents)} a month for each extra ${H.studentsPerBlock.toLocaleString("en-US")}, or ${usd(H.schoolYearlyCents)} a year for a whole school of up to ${H.schoolStudentCap.toLocaleString("en-US")} students.`],
  ["What is the Learning Bundle?",
    `Arise History, Arise Math and Arise Social together. Every student, parent and teacher gets 30 days free, no card needed, with a countdown on their page. After that, a family pays ${usd(BU.familyMonthlyCents)} a month for the parent and every linked child, or a teacher adds it for their class for ${usd(BU.teacherMonthlyCents)} a month on top of Class (up to ${BU.teacherSeats} students).`],
  ["We pay for the bundle and our child's teacher added it too. Do we keep paying?",
    "No. A teacher's class plan takes over. Once every child you've linked is in a class that has it, your family plan stops and we refund the unused part of the month to your card."],
  ["What does A.R.I.S.E. To-Do cost?",
    `Parents get 30 days free, then it's ${usd(TD.familyMonthlyCents)} a month. Teachers get it with Teacher Hub: one subscription for both.`],
  ["Is Teacher Hub included with Class or a free school?",
    "No. After a teacher's free first month, Teacher Hub is paid on its own. It isn't part of Class, the free 2026–27 school year, or any school that has Class at no charge."],
];

function Price({ who, detail, amount, per, premium }: { who: string; detail: ReactNode; amount: string; per: string; premium?: boolean }) {
  return (
    <div className={"pr-price" + (premium ? " premium" : "")}>
      <div><b>{who}</b><span>{detail}</span></div>
      <div className="pr-price-amount"><b>{amount}</b><span>{per}</span></div>
    </div>
  );
}

function Addons({ title, addons, foot, testId }: { title: string; addons: Addon[]; foot: ReactNode; testId: string }) {
  return (
    <div className="pr-addons" data-testid={testId}>
      <h3>{title}</h3>
      {addons.map((a) => (
        <details key={a.id} className="pr-addon" data-testid={`pricing-${a.id}`}>
          <summary>
            <span className="pr-addon-name"><b>{a.name}</b><small>{a.tag}</small></span>
            <span className="pr-addon-amount"><b>{a.amount}</b>{a.per && <small>{a.per}</small>}</span>
          </summary>
          <div className="pr-addon-more">
            <p>{a.detail}</p>
            {a.items.length > 0 && <List items={a.items} />}
          </div>
        </details>
      ))}
      <p className="pr-addons-foot">{foot}</p>
    </div>
  );
}

export default function Pricing() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  // Signed-in readers go home; everyone else lands on the account choices.
  const startFree = () => navigate(user ? "/" : "/?tab=create");
  // A teacher goes to their plan page, where Class is bought. Anyone else starts by making a teacher account.
  const getClass = () => navigate(user?.isAdmin ? "/admin" : user?.role === "teacher" ? "/billing" : "/teacher-signup");
  // The add-ons are bought on the plan page too.
  const getAddon = () => navigate(user?.isAdmin ? "/teacher-hub" : user?.role === "teacher" ? "/billing" : "/teacher-signup");
  const toCompare = () => document.getElementById("pr-compare")?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <main className="pr">
      <span className="pr-glow pr-glow-a" aria-hidden="true" />
      <span className="pr-glow pr-glow-b" aria-hidden="true" />

      <header className="pr-top">
        <button type="button" className="pr-mark" onClick={() => navigate("/")}>A.R.I.S.E. <span>Reader</span></button>
        <nav aria-label="Account">
          {user
            ? <button type="button" className="pr-link" onClick={() => navigate("/")}>Back to A.R.I.S.E.</button>
            : <>
                <button type="button" className="pr-link" onClick={() => navigate("/")}>Log in</button>
                <button type="button" className="pr-pill pr-pill-sm" onClick={startFree}>Start free</button>
              </>}
        </nav>
      </header>

      <section className="pr-hero">
        <p className="pr-tag">Plans and pricing</p>
        <h1>Free for students and parents. Class for teachers and schools.</h1>
        <p className="pr-lede">Students get free books, poems and kids' news to read right on the site, and quizzes for millions of books. They climb the leaderboard and play the games at no cost, and their parents follow along for free. Class adds the teacher's side: live class games, control over game time for the class, and a clear view of every student's reading.</p>
        <div className="pr-actions">
          <button type="button" className="pr-pill" onClick={startFree}>Start reading free</button>
          <button type="button" className="pr-pill pr-pill-ghost" onClick={toCompare}>Compare the plans</button>
        </div>
      </section>

      <section className="pr-plans" aria-label="Plans">
        <article className="pr-card">
          <div className="pr-name"><h2>Free</h2><p>For students and parents</p></div>
          <div className="pr-prices">
            <Price who="Students" detail="Any student, with or without a school." amount="$0" per="always" />
            <Price who="Parents" detail={`One parent profile can follow up to ${kids} children.`} amount="$0" per="always" />
          </div>
          <Addons title="Add-ons for families" addons={FAMILY_ADDONS} testId="pricing-family-addons"
            foot={<>Optional. Every account starts with 30 days of both free, no card needed. <button type="button" className="pr-text" onClick={startFree}>Start free</button></>} />
          <p className="pr-about">Free books, poems and kids' news to read right on the site, plus quizzes, the leaderboard and the games. No trial and no end date.</p>
          <button type="button" className="pr-pill pr-pill-ghost pr-wide" onClick={startFree} data-testid="pricing-start-free">Start reading free</button>
          <div className="pr-group"><h3>For students</h3><List items={FREE_STUDENTS} /></div>
          <div className="pr-group"><h3>For their parents</h3><List items={FREE_PARENTS} /></div>
          <div className="pr-note"><b>Prizes are yours to give</b><span>A.R.I.S.E. doesn't hand out prizes on any plan. A parent can add their own for their child to read for.</span></div>
        </article>

        <div className="pr-ring">
          <article className="pr-card pr-card-premium" data-testid="pricing-class">
            <div className="pr-name premium"><h2>Class</h2><p>For teachers &amp; schools</p></div>
            <div className="pr-prices">
              <Price premium who="One teacher" detail={`Up to ${block} students. Add ${usd(T.monthlyCents)} a month for each extra ${block} students.`} amount={usd(T.monthlyCents)} per="a month" />
              <Price premium who="Whole school" detail={`Up to ${schoolCap} students, and every teacher gets their own account. Runs a full 12 months, so summer reading clubs and competitions are covered.`} amount={usd(S.yearlyCents)} per="a year" />
            </div>
            <Addons title="Add-ons" addons={CLASS_ADDONS} testId="pricing-addons"
              foot={<>Not included with Class, the free 2026–27 school year or a no-charge school. <button type="button" className="pr-text" onClick={getAddon} data-testid="pricing-get-hub">Get an add-on</button></>} />
            <p className="pr-about">The tools to run reading in a classroom, on top of everything in Free. Parents of the class get their accounts free too. A teacher's first month is free.</p>
            <button type="button" className="pr-pill pr-wide" onClick={getClass} data-testid="pricing-get-premium">Get Class</button>
            <div className="pr-group premium"><h3>For the teacher</h3><List items={PREMIUM_TEACHER} /></div>
            <div className="pr-group premium"><h3>For their students and parents</h3><List items={PREMIUM_FAMILIES} /></div>
            <div className="pr-note premium"><b>Signed up before October 1, 2026?</b><span>Your school's teachers and students keep everything free for the full 2026–27 school year.</span></div>
          </article>
        </div>
      </section>

      <section id="pr-compare" className="pr-band">
        <div className="pr-inner">
          <div className="pr-head">
            <h2>Compare the plans</h2>
            <p>Reading, playing and a parent's view are free. What Class adds is the classroom. Prizes on either plan come from parents, teachers and schools, not from A.R.I.S.E.</p>
          </div>
          <div className="pr-table">
            <table>
              <colgroup><col className="pr-col-what" /><col className="pr-col-plan" /><col className="pr-col-plan premium" /></colgroup>
              <thead><tr><th scope="col" className="pr-th-what">What you get</th><th scope="col" className="pr-th-plan">Free</th><th scope="col" className="pr-th-plan">Class</th></tr></thead>
              {COMPARE.map((g) => (
                <tbody key={g.group}>
                  <tr><th scope="colgroup" colSpan={3} className="pr-th-group">{g.group}</th></tr>
                  {g.rows.map(([what, free, premium]) => (
                    <tr key={what}>
                      <th scope="row">{what}</th>
                      {[free, premium].map((cell, i) => <td key={i} data-plan={i === 0 ? "Free" : "Class"}>{cell === true ? <Yes /> : cell === false ? <No /> : cell}</td>)}
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </div>
      </section>

      <section className="pr-band pr-band-tint">
        <div className="pr-inner">
          <h2 className="pr-h2">Questions families and teachers ask</h2>
          <div className="pr-faq">{QUESTIONS.map(([q, a]) => <div key={q}><h3>{q}</h3><p>{a}</p></div>)}</div>
        </div>
      </section>

      <section className="pr-band pr-close">
        <h2>Start free today. Add the Class plan when you're ready.</h2>
        <div className="pr-actions">
          <button type="button" className="pr-pill" onClick={startFree}>Start reading free</button>
          <button type="button" className="pr-pill pr-pill-ghost" onClick={getClass}>Get Class</button>
        </div>
      </section>

      <footer className="pr-foot">A.R.I.S.E. stands for Advocating, Resilience, Inclusion, Support, Empowerment.</footer>
    </main>
  );
}
