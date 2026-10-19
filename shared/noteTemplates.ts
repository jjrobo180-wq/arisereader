// Note templates: ready-made outlines for almost any note — meetings, food diaries, journals, lists,
// school and IEP meetings, trips, budgets, Bible study and more. Picking one starts a new note with its
// title and outline filled in; after that it is an ordinary note, free to change. Used by LifeHub Notes,
// the App Store's Notes apps, and WorkHub's Notes.
//
// Notes are plain text, so outlines use simple marks that read well anywhere: "☐" for a box to tick,
// "—" for a blank to fill, and CAPITAL headings. {date} becomes today's date when the note is made.

export type NoteTemplate = {
  id: string;
  name: string;
  category: NoteTemplateCategory;
  emoji: string;
  /** One line in the chooser. */
  blurb: string;
  /** The new note's title. */
  title: string;
  body: string;
  /** Which hub it shows first in (both hubs can use every template). */
  hub?: "work" | "life";
};

export const NOTE_TEMPLATE_CATEGORIES = ["Meetings", "Everyday", "Food & health", "Home & family", "School & teaching", "Planning", "Money", "Faith & mind", "Travel"] as const;
export type NoteTemplateCategory = (typeof NOTE_TEMPLATE_CATEGORIES)[number];

const t = (id: string, name: string, category: NoteTemplateCategory, emoji: string, blurb: string, title: string, body: string, hub?: "work" | "life"): NoteTemplate =>
  ({ id, name, category, emoji, blurb, title, body: body.replace(/^\n/, ""), ...(hub ? { hub } : {}) });

export const NOTE_TEMPLATES: readonly NoteTemplate[] = [
  // ── Meetings ──────────────────────────────────────────────────────────────
  t("meeting", "Meeting notes", "Meetings", "🗂️", "Agenda, notes, decisions and action items", "Meeting — {date}", `
Date: {date}
Time: —
Where / link: —
Attendees: —

AGENDA
1. —
2. —
3. —

NOTES
-

DECISIONS
-

ACTION ITEMS (who · what · by when)
☐ — · — · —
☐ — · — · —

NEXT MEETING: —`, "work"),
  t("one-on-one", "1-on-1", "Meetings", "🤝", "Check-in with a manager, mentor or teammate", "1-on-1 — {date}", `
With: —
Date: {date}

HOW ARE THINGS GOING?
-

WINS SINCE LAST TIME
-

WHAT'S IN THE WAY
-

FEEDBACK (both ways)
-

GOALS / GROWTH
-

ACTION ITEMS
☐
☐ `, "work"),
  t("standup", "Daily stand-up", "Meetings", "⏱️", "Yesterday, today, blockers", "Stand-up — {date}", `
Date: {date}

YESTERDAY
-

TODAY
-

BLOCKERS / NEED HELP WITH
- `, "work"),
  t("call", "Phone call notes", "Meetings", "📞", "Who called, what was said, follow-up", "Call — {date}", `
Date: {date}   Time: —
Who: —
Number / email: —
About: —

WHAT WAS SAID
-

FOLLOW-UP
☐
Call back by: —`),
  t("kickoff", "Project kickoff", "Meetings", "🚀", "Goals, roles, timeline and risks", "Project kickoff: —", `
Project: —
Date: {date}
Owner: —
Team: —

WHY WE'RE DOING THIS
—

WHAT "DONE" LOOKS LIKE
-

ROLES
- — : —
- — : —

TIMELINE / MILESTONES
☐ — by —
☐ — by —
☐ — by —

RISKS & HOW WE'LL HANDLE THEM
-

FIRST NEXT STEPS
☐
☐ `, "work"),
  t("brainstorm", "Brainstorm", "Meetings", "💡", "Every idea first, then pick the best", "Brainstorm: —", `
Question we're solving: —
Date: {date}
People: —

EVERY IDEA (no judging yet)
-
-
-
-

TOP 3
1. —
2. —
3. —

WHAT WE'LL TRY FIRST
☐ `),
  t("interview", "Interview notes", "Meetings", "🧑‍💼", "Questions, answers and a score", "Interview: —", `
Candidate: —
Role: —
Date: {date}
Interviewers: —

QUESTIONS & ANSWERS
1. —
   →
2. —
   →
3. —
   →

STRENGTHS
-

CONCERNS
-

OVERALL (1–5): —
Recommend? ☐ Yes  ☐ No  ☐ Maybe`, "work"),
  t("retro", "Retrospective", "Meetings", "🔁", "What went well, what didn't, what to change", "Retro — {date}", `
Date: {date}
Project / period: —

WHAT WENT WELL
-

WHAT DIDN'T
-

WHAT WE'LL CHANGE
☐
☐

SHOUT-OUTS
- `, "work"),
  t("family-meeting", "Family meeting", "Meetings", "👨‍👩‍👧", "Wins, the week ahead, problems to solve", "Family meeting — {date}", `
Date: {date}
Who's here: —

THIS WEEK'S WINS 🎉
-

THE WEEK AHEAD (who needs a ride, practices, appointments)
-

SOMETHING TO SOLVE TOGETHER
-

CHORES & JOBS
-

SOMETHING FUN TO PLAN
- `, "life"),

  // ── Everyday ──────────────────────────────────────────────────────────────
  t("quick", "Quick note", "Everyday", "📝", "A plain note with a date at the top", "Note — {date}", `
{date}

`),
  t("todo", "To-do list", "Everyday", "✅", "Must do, should do, could do", "To do — {date}", `
MUST DO TODAY
☐
☐
☐

SHOULD DO
☐
☐

COULD DO (if there's time)
☐
☐ `),
  t("brain-dump", "Brain dump", "Everyday", "🧠", "Empty your head, then sort it", "Brain dump — {date}", `
Write down EVERYTHING on your mind. Don't sort it yet.
-
-
-
-
-

NOW SORT IT
Do today: —
This week: —
Someday: —
Let it go: —`),
  t("journal", "Daily journal", "Everyday", "📔", "How today went, in a few minutes", "Journal — {date}", `
{date}

Today I felt: —
The best part of today: —
Something hard: —
Something I learned: —
Tomorrow I want to: —`),
  t("pros-cons", "Pros & cons", "Everyday", "⚖️", "Weigh up a decision", "Decision: —", `
The decision: —
Date: {date}

PROS
+
+
+

CONS
−
−
−

What matters most here: —
My gut says: —
Decision: —`),
  t("book-notes", "Book notes", "Everyday", "📚", "Quotes, ideas and what you'll remember", "Book: —", `
Title: —
Author: —
Started: {date}   Finished: —
Rating: ☆☆☆☆☆

BIG IDEAS
-

FAVORITE QUOTES
" "  (p. —)

WHAT I'LL DO DIFFERENTLY
- `),
  t("class-notes", "Class / lecture notes", "Everyday", "🎓", "Cornell-style: notes, questions, summary", "Class notes — {date}", `
Class: —
Topic: —
Date: {date}

KEY QUESTIONS        |  NOTES
—                    |  -
—                    |  -
—                    |  -

SUMMARY (in my own words)
—

TO STUDY / ASK ABOUT
☐ `),
  t("idea", "Idea", "Everyday", "✨", "Capture an idea before it's gone", "Idea: —", `
The idea: —
Why it could work: —
Who it's for: —
First tiny step: ☐ —
Date: {date}`),

  // ── Food & health ─────────────────────────────────────────────────────────
  t("food-diary", "Food diary", "Food & health", "🍎", "Meals, snacks, water and how you felt", "Food diary — {date}", `
Date: {date}

BREAKFAST  (time: —)
-
Hunger before (1–5): —   Feeling after: —

LUNCH  (time: —)
-
Hunger before (1–5): —   Feeling after: —

DINNER  (time: —)
-
Hunger before (1–5): —   Feeling after: —

SNACKS
-

WATER (one box per glass)
☐ ☐ ☐ ☐ ☐ ☐ ☐ ☐

Energy today (1–5): —
Notes: —`, "life"),
  t("meal-plan", "Weekly meal plan", "Food & health", "🍽️", "Seven days of meals and the shopping list", "Meal plan — week of {date}", `
Week of {date}

MON  B: —  L: —  D: —
TUE  B: —  L: —  D: —
WED  B: —  L: —  D: —
THU  B: —  L: —  D: —
FRI  B: —  L: —  D: —
SAT  B: —  L: —  D: —
SUN  B: —  L: —  D: —

PREP AHEAD
☐
☐

SHOPPING LIST
☐
☐
☐ `, "life"),
  t("workout", "Workout log", "Food & health", "🏋️", "Exercises, sets, reps and how it felt", "Workout — {date}", `
Date: {date}
Type: —   Length: — min

WARM-UP
-

EXERCISE · SETS × REPS · WEIGHT
- — · — × — · —
- — · — × — · —
- — · — × — · —
- — · — × — · —

CARDIO: —
How I felt (1–5): —
Next time: —`, "life"),
  t("symptoms", "Symptom tracker", "Food & health", "🩺", "What, when, how bad, what helped", "Symptoms — {date}", `
Who: —

DATE · TIME · SYMPTOM · HOW BAD (1–10) · WHAT HELPED
{date} · — · — · — · —
— · — · — · — · —
— · — · — · — · —

Medicines taken: —
Food / sleep / stress that day: —
Questions for the doctor:
☐ `, "life"),
  t("doctor-visit", "Doctor visit", "Food & health", "🏥", "Questions to ask and what they said", "Doctor visit — {date}", `
Who: —
Doctor: —
Date: {date}   Time: —

WHY WE'RE GOING
—

QUESTIONS TO ASK
☐
☐
☐

WHAT THE DOCTOR SAID
-

NEW MEDICINES / CHANGES
-

NEXT APPOINTMENT: —`, "life"),
  t("meds", "Medication list", "Food & health", "💊", "Every medicine, dose and doctor", "Medications — —", `
Person: —
Allergies: —
Updated: {date}

MEDICINE · DOSE · WHEN · FOR · PRESCRIBED BY
- — · — · — · — · —
- — · — · — · — · —
- — · — · — · — · —

Pharmacy: —   Phone: —`, "life"),
  t("sleep", "Sleep log", "Food & health", "😴", "Bedtime, wake time and how you slept", "Sleep log — week of {date}", `
Week of {date}

DAY · IN BED · ASLEEP · WOKE · QUALITY (1–5)
Mon · — · — · — · —
Tue · — · — · — · —
Wed · — · — · — · —
Thu · — · — · — · —
Fri · — · — · — · —
Sat · — · — · — · —
Sun · — · — · — · —

Caffeine after noon? —   Screens before bed? —
What helped: —`, "life"),
  t("habit-week", "Habit tracker (week)", "Food & health", "📆", "Tick off habits for seven days", "Habits — week of {date}", `
Week of {date}

HABIT          M  T  W  T  F  S  S
—              ☐  ☐  ☐  ☐  ☐  ☐  ☐
—              ☐  ☐  ☐  ☐  ☐  ☐  ☐
—              ☐  ☐  ☐  ☐  ☐  ☐  ☐
—              ☐  ☐  ☐  ☐  ☐  ☐  ☐

What made it easier: —`),

  // ── Home & family ─────────────────────────────────────────────────────────
  t("grocery", "Grocery list", "Home & family", "🛒", "Sorted by aisle so the trip is quick", "Groceries — {date}", `
PRODUCE
☐
☐

MEAT & FISH
☐

DAIRY & EGGS
☐

BREAD & PANTRY
☐
☐

FROZEN
☐

HOUSEHOLD
☐

Budget: $—`, "life"),
  t("packing", "Packing list", "Home & family", "🧳", "Clothes, toiletries, tech and documents", "Packing: —", `
Trip: —   Leaving: —   Nights: —

CLOTHES
☐ Shirts ×—
☐ Pants / shorts ×—
☐ Underwear & socks ×—
☐ Pajamas
☐ Jacket
☐ Shoes

TOILETRIES
☐ Toothbrush & paste
☐ Deodorant
☐ Medicines
☐ Hair stuff

TECH
☐ Phone charger
☐ Headphones

DOCUMENTS
☐ ID / passport
☐ Tickets / confirmations
☐ Insurance card

FOR THE KIDS
☐ Snacks
☐ Something to do in the car`, "life"),
  t("babysitter", "Babysitter info", "Home & family", "🍼", "Everything a sitter needs to know", "For the sitter", `
Kids: —   Ages: —
Our numbers: —
Back by: —

EMERGENCY: 911
Nearest hospital: —
Poison control: 1-800-222-1222
Neighbor to call: —

ALLERGIES / MEDICINES
—

ROUTINE
Dinner: —
Bath: —
Bedtime: —
Screen time: —

HOUSE RULES
-

Wi-Fi: —   Password: —`, "life"),
  t("emergency", "Emergency contacts", "Home & family", "🚨", "Who to call when it matters", "Emergency contacts", `
Emergency: 911
Poison control: 1-800-222-1222

FAMILY
- — : —
- — : —

DOCTORS
- Pediatrician: — : —
- Family doctor: — : —
- Dentist: — : —

SCHOOL
- — : —

INSURANCE
- Health: — · member # —
- Car: — · policy # —

Updated: {date}`, "life"),
  t("wifi", "Wi-Fi & codes", "Home & family", "🔐", "Network names, door codes and accounts", "Wi-Fi & codes", `
WI-FI
Network: —   Password: —
Guest network: —   Password: —

DOOR / GARAGE / ALARM
- — : —

STREAMING & ACCOUNTS (no bank passwords here)
- — : —

Updated: {date}`, "life"),
  t("party", "Party planning", "Home & family", "🎉", "Guests, food, decorations and a timeline", "Party: —", `
For: —   Date: —   Time: —
Where: —   Theme: —
Budget: $—

GUESTS (☐ invited · ☑ coming)
☐
☐

FOOD & DRINKS
☐
☐

DECORATIONS & SUPPLIES
☐
☐

TIMELINE
2 weeks before: ☐ send invites
1 week before: ☐ order cake
Day before: ☐ shop · ☐ decorate
Day of: ☐ —`, "life"),
  t("gift-ideas", "Gift ideas", "Home & family", "🎁", "Ideas for everyone, all year", "Gift ideas", `
PERSON · OCCASION · IDEA · PRICE · BOUGHT
— · — · — · $— · ☐
— · — · — · $— · ☐
— · — · — · $— · ☐

Things they mentioned wanting:
- `, "life"),
  t("home-upkeep", "Home maintenance", "Home & family", "🔧", "What to check each season", "Home maintenance", `
EVERY MONTH
☐ Test smoke & CO alarms
☐ Clean the kitchen sink drain
☐ Check the furnace / AC filter

SPRING
☐ Clean gutters
☐ Service the AC
☐ Check outside faucets

FALL
☐ Service the furnace
☐ Clean the dryer vent
☐ Reverse ceiling fans

REPAIRS TO DO
☐ — (who: —, cost: $—)`, "life"),
  t("recipe", "Recipe card", "Home & family", "🥘", "Ingredients, steps and notes", "Recipe: —", `
Serves: —   Prep: — min   Cook: — min

INGREDIENTS
-
-
-

STEPS
1. —
2. —
3. —

NOTES / CHANGES I MADE
- `, "life"),
  t("chores", "Chore chart", "Home & family", "🧹", "Who does what, every day", "Chores — week of {date}", `
Week of {date}

CHORE          WHO      M  T  W  T  F  S  S
Dishes         —        ☐  ☐  ☐  ☐  ☐  ☐  ☐
Trash          —        ☐  ☐  ☐  ☐  ☐  ☐  ☐
Laundry        —        ☐  ☐  ☐  ☐  ☐  ☐  ☐
Tidy room      —        ☐  ☐  ☐  ☐  ☐  ☐  ☐
—              —        ☐  ☐  ☐  ☐  ☐  ☐  ☐

Reward this week: —`, "life"),
  t("moving", "Moving checklist", "Home & family", "📦", "Eight weeks out to moving day", "Moving checklist", `
New address: —   Moving day: —

8 WEEKS BEFORE
☐ Get moving quotes
☐ Start decluttering

4 WEEKS BEFORE
☐ Change address (USPS, bank, work)
☐ Transfer school records
☐ Set up utilities at the new place

2 WEEKS BEFORE
☐ Pack rooms you don't use
☐ Confirm the movers

MOVING DAY
☐ Meter readings
☐ Last walk-through
☐ Keys handed over`, "life"),

  // ── School & teaching ─────────────────────────────────────────────────────
  t("parent-conference", "Parent-teacher conference", "School & teaching", "🏫", "Strengths, concerns and a plan together", "Conference: — — {date}", `
Student: —
Date: {date}
With: —

STRENGTHS
-

AREAS TO GROW
-

GRADES / DATA SHARED
-

QUESTIONS FROM HOME
-

PLAN — AT SCHOOL
☐
PLAN — AT HOME
☐

FOLLOW UP ON: —`),
  t("iep-meeting", "IEP meeting notes", "School & teaching", "📋", "Present levels, goals, services and next steps", "IEP meeting: — — {date}", `
Student: —
Meeting type: ☐ Annual  ☐ Initial  ☐ Re-eval  ☐ Amendment
Date: {date}
Attendees: —

PRESENT LEVELS (strengths & needs)
-

PARENT INPUT
-

GOALS DISCUSSED
1. —
2. —

SERVICES & MINUTES
- — : — min / week

ACCOMMODATIONS
-

NEXT STEPS (who · what · by when)
☐ — · — · —

Next review: —`, "work"),
  t("lesson", "Lesson plan", "School & teaching", "🍎", "Objective, hook, activities and a check", "Lesson: —", `
Subject / grade: —
Date: {date}
Standard: —

OBJECTIVE (students will be able to…)
—

MATERIALS
☐

HOOK (5 min)
—

I DO
—
WE DO
—
YOU DO
—

CHECK FOR UNDERSTANDING
—

DIFFERENTIATION / SUPPORTS
-

REFLECTION (after)
—`, "work"),
  t("observation", "Class observation", "School & teaching", "👀", "What you saw, glows and grows", "Observation — {date}", `
Teacher / class: —
Date: {date}   Time: —
Focus: —

WHAT I SAW
-

GLOWS
-

GROWS
-

QUESTIONS TO TALK ABOUT
- `, "work"),
  t("student-checkin", "Student check-in", "School & teaching", "🙋", "A quick talk with one student", "Check-in: — — {date}", `
Student: —
Date: {date}

HOW ARE YOU FEELING? (1–5): —
WHAT'S GOING WELL
-
WHAT'S HARD RIGHT NOW
-
WHAT WOULD HELP
-

Plan / next check-in: —`, "work"),
  t("sub-plans", "Substitute plans", "School & teaching", "🧑‍🏫", "Everything a sub needs for the day", "Sub plans — {date}", `
Date: {date}
Teacher: —   Room: —
Helpful neighbor teacher: —

SCHEDULE
— : —
— : —
— : —

STUDENTS TO KNOW ABOUT (allergies, health, behavior plans)
-

WHERE THINGS ARE
-

EMERGENCY PROCEDURES: —
Please leave a note about: —`, "work"),
  t("plc", "PLC / staff meeting", "School & teaching", "👥", "Data, strategies and commitments", "PLC — {date}", `
Date: {date}
Team: —

DATA WE LOOKED AT
-

WHAT IT TELLS US
-

STRATEGIES WE'LL TRY
-

COMMITMENTS (who · what · by when)
☐ — · — · —`, "work"),
  t("homework", "Homework planner", "School & teaching", "✏️", "Every class, what's due and when", "Homework — week of {date}", `
Week of {date}

CLASS · ASSIGNMENT · DUE · DONE
— · — · — · ☐
— · — · — · ☐
— · — · — · ☐

TESTS COMING UP
- — on —

Study plan: —`, "life"),

  // ── Planning ──────────────────────────────────────────────────────────────
  t("weekly-plan", "Weekly planner", "Planning", "🗓️", "Top 3, every day, and a review", "Week of {date}", `
Week of {date}

TOP 3 THIS WEEK
1. —
2. —
3. —

MON  —
TUE  —
WED  —
THU  —
FRI  —
SAT  —
SUN  —

END OF WEEK
Done: —
Carry over: —`),
  t("goals", "Goal plan", "Planning", "🎯", "A goal, why it matters and the steps", "Goal: —", `
My goal: —
By: —
Why it matters to me: —

HOW I'LL KNOW I DID IT
—

STEPS
☐ — by —
☐ — by —
☐ — by —

WHAT MIGHT GET IN THE WAY
— → what I'll do: —

Check-in dates: —`),
  t("year-review", "Year in review", "Planning", "🏆", "Look back, then look ahead", "Year in review", `
BEST MOMENTS
-

WHAT I'M PROUD OF
-

WHAT I LEARNED
-

WHAT I'LL LEAVE BEHIND
-

NEXT YEAR, I WANT TO
☐
☐
☐ `),
  t("event-plan", "Event plan", "Planning", "📣", "Who, what, when, where and the to-dos", "Event: —", `
Event: —
Date: —   Time: —
Where: —
Expected people: —
Budget: $—

TO DO
☐ Book the place
☐ Send invites
☐ Food / drinks
☐ Supplies
☐ Volunteers / helpers

DAY-OF RUN SHEET
— : —
— : —`),

  // ── Money ─────────────────────────────────────────────────────────────────
  t("budget", "Monthly budget", "Money", "💵", "Income, bills, spending and savings", "Budget — {date}", `
Month: —

INCOME
- Paycheck: $—
- Other: $—
TOTAL IN: $—

BILLS
- Rent / mortgage: $—
- Utilities: $—
- Phone / internet: $—
- Car / gas: $—
- Insurance: $—

SPENDING
- Groceries: $—
- Eating out: $—
- Kids: $—
- Fun: $—

SAVINGS: $—
TOTAL OUT: $—
LEFT OVER: $—`, "life"),
  t("savings-goal", "Savings goal", "Money", "🐷", "How much, by when, and how", "Saving for: —", `
Saving for: —
Goal: $—   By: —
Saved so far: $—

PER WEEK I NEED: $—

WAYS TO GET THERE
☐
☐

DEPOSITS
{date}: $—`, "life"),

  // ── Faith & mind ──────────────────────────────────────────────────────────
  t("sermon", "Sermon / Bible study notes", "Faith & mind", "📖", "Passage, key points and how to live it", "Bible study — {date}", `
Date: {date}
Passage: —
Speaker / group: —

KEY VERSE
"—"

MAIN POINTS
1. —
2. —
3. —

WHAT IT MEANS FOR ME
—

HOW I'LL LIVE IT THIS WEEK
☐

Prayer: —`, "life"),
  t("prayer", "Prayer list", "Faith & mind", "🙏", "Requests, and the ones answered", "Prayer list", `
PRAYING FOR
- — (since {date})
-
-

ANSWERED 🙌
- `, "life"),
  t("gratitude", "Gratitude", "Faith & mind", "🌻", "Three good things, every day", "Grateful — {date}", `
{date}

Three things I'm grateful for:
1. —
2. —
3. —

Someone who made my day better: —
Something I'm looking forward to: —`),
  t("reflection", "Weekly reflection", "Faith & mind", "🌙", "Slow down and look at your week", "Reflection — week of {date}", `
Week of {date}

What gave me energy: —
What drained me: —
A moment I want to remember: —
What I need more of: —
What I need less of: —
One thing for next week: —`),

  // ── Travel ────────────────────────────────────────────────────────────────
  t("itinerary", "Trip itinerary", "Travel", "✈️", "Flights, stays and a day-by-day plan", "Trip: —", `
Where: —   Dates: —

GETTING THERE
Flight / drive: —   Confirmation #: —

STAYING AT
—   Check-in: —   Confirmation #: —

DAY 1 (—)
- Morning: —
- Afternoon: —
- Evening: —

DAY 2 (—)
- Morning: —
- Afternoon: —
- Evening: —

RESERVATIONS
☐ — at —

Budget: $—`, "life"),
  t("road-trip", "Road trip", "Travel", "🚗", "Stops, snacks and the car check", "Road trip: —", `
From: —   To: —   Miles: —

CAR CHECK
☐ Oil  ☐ Tires  ☐ Gas  ☐ Wipers

STOPS
- — (gas / food / fun)
-

SNACKS & DRINKS
☐

FOR THE KIDS
☐ Movies / games
☐ Pillows & blankets

Playlist: —`, "life"),
];

/** A template's outline with today's date filled in. */
export function fillTemplate(text: string, now: Date = new Date()): string {
  const date = now.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  return text.replace(/\{date\}/g, date);
}

/** Templates matching a search, in a category (or all), with the hub's own ones first. */
export function findTemplates(opts: { query?: string; category?: NoteTemplateCategory | null; hub?: "work" | "life" } = {}): NoteTemplate[] {
  const q = (opts.query || "").trim().toLowerCase();
  const list = NOTE_TEMPLATES.filter((tpl) => (!opts.category || tpl.category === opts.category)
    && (!q || `${tpl.name} ${tpl.blurb} ${tpl.category}`.toLowerCase().includes(q)));
  if (!opts.hub) return list;
  const rank = (tpl: NoteTemplate) => (tpl.hub === opts.hub ? 0 : tpl.hub ? 2 : 1);
  return [...list].sort((a, b) => rank(a) - rank(b));
}
