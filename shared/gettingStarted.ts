// The words for the Getting started page (client/src/components/GettingStarted.tsx), one guide per
// kind of person. Plain words, short sentences. `open` names a place in the hub the page can take
// you to (a LifeHub section, a WorkHub tab, or one of the shared ids below); a hub that can't open
// it just doesn't show the button.

export type GuideRole = "parent" | "teacher" | "student" | "personal";

/** Places every hub knows how to open, besides its own sections/tabs. */
export type SharedTarget = "customize" | "store" | "search" | "passcode" | "notifications" | "reader";

export type GuideStep = { id: string; title: string; body: string; open?: string };
export type GuideTopic = { id: string; title: string; summary: string; points: string[]; open?: string };
export type Guide = {
  role: GuideRole;
  label: string;
  /** Who it is for, on the picker. */
  who: string;
  intro: string;
  /** "Your first few minutes": things to do, ticked off as you go. */
  steps: GuideStep[];
  /** The main features, one card each. */
  topics: GuideTopic[];
  /** Making it yours. */
  customize: GuideTopic[];
  tips: string[];
};

const CUSTOMIZE_HUB: GuideTopic[] = [
  { id: "menu", title: "Arrange the menu", summary: "Put things where you want them.", open: "customize",
    points: ["Open Customize (the sliders button at the top, or ⋯ → Customize on a phone).", "Choose where the menu sits on a computer: left, right, a top bar, icons only, or an app drawer.", "On a phone, choose where the menu opens and whether it closes after you pick something.", "Drag any item in the menu to reorder it, or group items into folders."] },
  { id: "home", title: "Build your Home screen", summary: "Show only what you check every day.", open: "customize",
    points: ["In Customize → Home screen, turn parts on or off: today's greeting, agenda, to-dos, calendar, quick counts, widgets and more.", "Drag them into the order you like and make some bigger or smaller.", "“Reset Home to the usual layout” puts it back any time."] },
  { id: "look", title: "Change the look", summary: "Themes and night mode.", open: "customize",
    points: ["Pick a theme in Customize.", "Switch between day and night mode from the header (or ⋯ on a phone)."] },
  { id: "apps", title: "Add or remove apps", summary: "Only keep what you use.", open: "store",
    points: ["The App Gallery holds every extra app. Tap one, then Add.", "Remove an app the same way. Nothing in it is deleted: add it back and it's all still there.", "This Getting started page is an app too. Remove it whenever you're done with it."] },
  { id: "lock", title: "Lock private things", summary: "A passcode for apps and notes.", open: "passcode",
    points: ["Tap the lock in the header (or search “Passcode”). Choose a 4 to 8 digit passcode.", "Switch on any app to lock it, or open a note and tap Lock note.", "Unlock once and everything opens until you tap Lock now. Forgot it? Your account password turns it off."] },
  { id: "alerts", title: "Choose your reminders", summary: "Phone and email notifications.", open: "notifications",
    points: ["Pick which reminders you get and when: a morning summary, due to-dos, events and more.", "Turn on phone notifications when the site asks, or from Notification settings."] },
];

const EVERYWHERE: GuideTopic = {
  id: "everywhere", title: "Find anything fast", summary: "Search, quick add and refresh.", open: "search",
  points: [
    "Search (the magnifying glass, Ctrl K or ⌘ K) finds apps first, then your notes, to-dos, events and more.",
    "The round + button at the bottom adds a to-do, event, note and more from anywhere.",
    "Everything saves as you type: notes, to-dos and changes. There is no Save button to forget.",
    "Refreshing the page keeps you exactly where you were.",
  ],
};

export const GUIDES: Guide[] = [
  {
    role: "parent", label: "Parent", who: "Families using LifeHub and A.R.I.S.E. Reader",
    intro: "LifeHub runs your family's day: to-dos, calendar, notes and any extra apps you add. Your children's reading lives on the A.R.I.S.E. Reader page right inside it. Your parent account is free.",
    steps: [
      { id: "family", title: "Add your family", body: "In Family & settings, add each adult and kid with a name, emoji and colour. Then you can assign to-dos, chores and events to people.", open: "family" },
      { id: "child", title: "Link your child's reading", body: "Open A.R.I.S.E. Reader and add your child. You'll see their books, quizzes, points and reading score.", open: "reader" },
      { id: "todo", title: "Add your first to-do", body: "Type it in Tasks and press Enter. Tap More for a due date, time, notes, a repeat or who it's for.", open: "tasks" },
      { id: "calendar", title: "Put this week on the calendar", body: "Add events, give each family calendar its own colour, and set events to repeat.", open: "calendar" },
      { id: "apps", title: "Add one app you'll use", body: "Chores, Grocery list, Meal planner, Budget & bills… pick one from the App Gallery.", open: "store" },
    ],
    topics: [
      { id: "home", title: "Home", summary: "Today at a glance.", open: "home", points: ["Today's to-dos, events, pinned notes and reminders in one place.", "Choose exactly what shows in Customize → Home screen."] },
      { id: "tasks", title: "Tasks & reminders", summary: "Lists for everything.", open: "tasks", points: ["Make lists (Home, School, Groceries…) and give each a colour.", "Due dates, times, repeats, high priority and notes.", "Assign a task to anyone in the family.", "Views for Today, Upcoming, Completed and Archived. Share a list with a link."] },
      { id: "calendar", title: "Calendar", summary: "Shared family calendars.", open: "calendar", points: ["Several calendars, each with a colour, shown or hidden with one tap.", "Events can repeat weekly, monthly or yearly and be assigned to family members."] },
      { id: "notes", title: "Notes", summary: "Full-screen notes with formatting.", open: "notes", points: ["Notes open full screen with fonts, sizes, colours, checklists and lists.", "They save as you type. Pin the important ones to Home.", "Start from a template, and lock private notes with your passcode."] },
      { id: "reader", title: "A.R.I.S.E. Reader for your kids", summary: "Their reading, your controls.", open: "reader", points: ["See each child's quizzes, points, reading score and quiz history.", "Your proctor code lets your child start a quiz while you watch. Camera quizzes are an option too.", "Set game time: games a day, minutes a day and games earned per passed quiz.", "Add family prizes they can earn with points.", "Add Arise Math, History and Connect for the whole family as one optional bundle."] },
      { id: "family-apps", title: "Family apps", summary: "Add only what helps.", open: "store", points: ["Chores with rotations and stars, Behavior with rewards, Allowance.", "Grocery list, Meal planner and Recipe box.", "Budget & bills, Savings jars, Subscriptions.", "Pills, Food & fitness, Medical info, Pet care, Birthdays, Trips and many more."] },
      { id: "ai", title: "AI Reminders", summary: "Reminders built around your life.", open: "lifeplan", points: ["Tell it the life you want; it builds reminders around your busy times and your real calendar."] },
      { id: "linked", title: "Share with others", summary: "Co-parents, sitters and grandparents.", open: "linked", points: ["Linked profiles share chosen apps and pages with another account.", "Share a to-do list with a link, even with people who don't use A.R.I.S.E."] },
      EVERYWHERE,
    ],
    customize: CUSTOMIZE_HUB,
    tips: [
      "Hiding an app never deletes what's in it. Turn it back on and it's all there.",
      "Pin a note to see it on Home every day.",
      "Kids earn points by passing book quizzes (70% or better). Each book counts once.",
      "Use the lock for anything private, like codes or medical notes.",
    ],
  },
  {
    role: "teacher", label: "Teacher", who: "Teachers using WorkHub and A.R.I.S.E. Reader",
    intro: "WorkHub is your teaching workspace: calendar, tasks, notes and goals come with it, and you add the tools you need. A.R.I.S.E. Reader has your class's reading, quizzes, live quizzes and prizes.",
    steps: [
      { id: "class", title: "Add your students", body: "In A.R.I.S.E. Reader → Students, add your class, or approve students who signed up and chose you as their teacher.", open: "reader" },
      { id: "calendar", title: "Connect your calendar", body: "Bring in Google, Outlook or Apple Calendar so meetings and events show in one place.", open: "calendar" },
      { id: "todo", title: "Add a to-do", body: "Type it on Home and press Enter. Tap More for a due date, time, notes or a repeat.", open: "tasks" },
      { id: "apps", title: "Add the tools you use", body: "Caseload, Minutes, Gradebook, Attendance, Behavior, Lessons… add them from the App Gallery.", open: "store" },
      { id: "home", title: "Set up your Home screen", body: "Choose what shows on Home: agenda, to-dos, meetings, calendar and quick counts.", open: "customize" },
    ],
    topics: [
      { id: "home", title: "Home", summary: "Your day in one place.", open: "overview", points: ["Today's agenda, to-dos, upcoming meetings and your calendar.", "Add things fast, with AI from a photo, paste or file."] },
      { id: "calendar", title: "Calendar", summary: "Every calendar together.", open: "calendar", points: ["Connect Google, Outlook or Apple Calendar.", "Hide events that aren't yours, follow a colleague's calendar, and get meeting times suggested around it."] },
      { id: "tasks", title: "Tasks & notes", summary: "To-dos and notes that save themselves.", open: "tasks", points: ["Lists with colours, due dates, times, repeats and importance.", "Notes about a student or a meeting, full screen, with formatting. They save as you type.", "Lock private notes with your passcode."] },
      { id: "students", title: "Students & IEPs", summary: "Caseload, goals, minutes and meetings.", open: "caseload", points: ["Caseload with each student's profile in one place.", "IEP goals from baseline to target, with a progress chart.", "Service minutes owed and given, by block.", "IEP & meetings with a step-by-step plan."] },
      { id: "classroom", title: "Classroom tools", summary: "Add what your class needs.", open: "store", points: ["Gradebook, Attendance, Behavior, Lessons and Schedules.", "Parents: contact logs, and Email forwarding into WorkHub."] },
      { id: "reader", title: "A.R.I.S.E. Reader", summary: "Reading quizzes and points.", open: "reader", points: ["Students read, take a quiz and earn the book's points when they score 70% or better. Each book counts once.", "Approve students, see quizzes & grading, and review any quiz.", "Run a Live quiz with the whole class, or class Scenes.", "Set game time and prizes students earn with points.", "Arise Math, History and Connect can be added for your class."] },
      EVERYWHERE,
    ],
    customize: CUSTOMIZE_HUB,
    tips: [
      "Use Search to jump to any student, tool or note.",
      "Removing a tool hides it; nothing in it is lost.",
      "Notes about a student also show on that student's profile.",
      "Lock screens that hold student information on a shared computer.",
    ],
  },
  {
    role: "student", label: "Student", who: "Students reading on A.R.I.S.E. Reader",
    intro: "Read books, take short quizzes, earn points and use them for games and prizes. Here's how it works.",
    steps: [
      { id: "book", title: "Pick a book", body: "Open the Library and find a book you've read or are reading. Search by title or author." },
      { id: "quiz", title: "Take its quiz", body: "When you finish, take the quiz. A parent or teacher may enter a proctor code, or the camera watches instead." },
      { id: "points", title: "Earn the points", body: "Score 70% or better to earn the book's points. Each book can only be taken once, so read it well first." },
      { id: "spend", title: "Spend them", body: "Points unlock game time and prizes, and move you up the leaderboard." },
    ],
    topics: [
      { id: "library", title: "Library", summary: "Thousands of books.", points: ["Search by title or author.", "Each book shows its level and how many points it's worth.", "Can't find a book? Ask for its quiz to be added."] },
      { id: "quizzes", title: "Quizzes", summary: "Short and fair.", points: ["About 10 questions on the book.", "70% or better passes and earns all the book's points.", "One try per book, so it's fair for everyone.", "If something seems wrong, ask for a review of your quiz."] },
      { id: "rewards", title: "Points & rewards", summary: "What points do.", points: ["The leaderboard shows the top readers each month.", "Passed quizzes earn game time.", "Your family or teacher can set prizes to earn."] },
      { id: "more", title: "More to explore", summary: "Beyond books.", points: ["Your avatar and worlds to explore.", "Arise Math, History and Connect, if your family or class has them.", "Your profile shows your reading score, certificates and messages."] },
    ],
    customize: [
      { id: "profile", title: "Make it yours", summary: "Your profile and avatar.", points: ["Pick your avatar and character on your profile.", "Turn on notifications to hear about new books and messages."] },
    ],
    tips: [
      "Read the whole book before the quiz. You only get one try.",
      "Take your time on each question.",
      "Ask a parent or teacher for their proctor code when you're ready.",
    ],
  },
  {
    role: "personal", label: "Just me", who: "Anyone using LifeHub for their own life",
    intro: "LifeHub keeps your to-dos, calendar and notes together, and you add any extra apps you want. It's free.",
    steps: [
      { id: "todo", title: "Add your first to-do", body: "Type it in Tasks and press Enter. Tap More for a due date, time, notes or a repeat.", open: "tasks" },
      { id: "calendar", title: "Add an event", body: "Put something on the calendar. Events can repeat.", open: "calendar" },
      { id: "note", title: "Write a note", body: "Notes open full screen and save as you type.", open: "notes" },
      { id: "apps", title: "Add an app", body: "Habits, Journal, Budget, Workouts… pick from the App Gallery.", open: "store" },
    ],
    topics: [
      { id: "tasks", title: "Tasks", summary: "Lists for everything.", open: "tasks", points: ["Lists with colours, due dates, times, repeats and priority.", "Today and Upcoming views so nothing slips."] },
      { id: "notes", title: "Notes", summary: "Like a real notes app.", open: "notes", points: ["Full screen with fonts, sizes, colours and checklists.", "Pin to Home, start from templates, lock private ones."] },
      { id: "apps", title: "Life apps", summary: "Add what you'll use.", open: "store", points: ["Habits, Journal, Gratitude, Mood, Focus timer.", "Budget & bills, Subscriptions, Savings jars.", "Food & fitness, Sleep, Workouts, Weather, News and more."] },
      { id: "ai", title: "AI Reminders", summary: "Reminders that fit your life.", open: "lifeplan", points: ["Describe the life you want and it plans reminders around your real calendar."] },
      EVERYWHERE,
    ],
    customize: CUSTOMIZE_HUB,
    tips: ["Hiding an app never deletes what's in it.", "Use the lock for anything private."],
  },
];

export const guideFor = (role: GuideRole): Guide => GUIDES.find((g) => g.role === role) ?? GUIDES[0];

/** The guide to show first, from the account's role. */
export function startingRole(user: { role?: string | null; isAdmin?: boolean } | null | undefined, hub: "life" | "work"): GuideRole {
  if (user?.role === "teacher" || (hub === "work" && user?.isAdmin)) return "teacher";
  if (user?.role === "parent") return "parent";
  if (user?.role === "student") return "student";
  return hub === "work" ? "teacher" : "personal";
}
