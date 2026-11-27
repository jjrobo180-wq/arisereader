// Arise To Do's "Who it's for" pages: one page per job (the Plugin Gallery's "Bundles by job") and one for
// everyone else, written to client/public/for/<slug>/index.html, plus the /for/ list. The tools on each page come
// from the job's bundle in shared/pluginStore.ts, so a page never names a tool the app doesn't have.
// Run with: npx tsx script/industryPages.ts   (tests/industry-pages.test.ts checks the pages match.)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { HUB_TEMPLATES, pluginsFor } from "../shared/pluginStore";

export const UPDATED = "2026-11-26";
const SITE = "https://arisetodo.com";

export type Audience = {
  slug: string; bundle?: string; nav: string; kicker: string; title: string; h1: [string, string]; lead: string;
  pains: [string, string][]; sample: string[]; faq: [string, string][];
};
/** What the homepage-style layout needs on top: the person in the mock-ups, their spaces, and the short lines. */
export type Look = { noun: string; greet: string; workspace: string; spaces: string[]; tags: string[]; strip: string[]; micro: string[]; floats: [string, string]; cta: [string, string] };
export const LOOKS: Record<string, Look> = {
 "teachers": {
  "noun": "teacher",
  "greet": "Hello, Ms. Rivera",
  "workspace": "My classroom",
  "spaces": [
   "Lessons",
   "Gradebook",
   "Families"
  ],
  "tags": [
   "Grading",
   "Families",
   "Prep",
   "Sub plans",
   "IEP"
  ],
  "strip": [
   "Lessons & gradebook",
   "Attendance & behavior",
   "Parents & email",
   "Sub plans, ready"
  ],
  "micro": [
   "Free for teachers",
   "Lessons to IEPs",
   "Works on any device"
  ],
  "floats": [
   "Your class, in one place",
   "Planning period, saved"
  ],
  "cta": [
   "Your classroom.",
   "Your command center."
  ]
 },
 "business-owners": {
  "noun": "business owner",
  "greet": "Morning, Dana",
  "workspace": "My shop",
  "spaces": [
   "Clients",
   "Sales",
   "Team"
  ],
  "tags": [
   "Leads",
   "Stock",
   "Invoices",
   "Taxes",
   "Books"
  ],
  "strip": [
   "Clients & leads",
   "Sales & expenses",
   "Stock & vendors",
   "Tax dates"
  ],
  "micro": [
   "Free to start",
   "Clients to taxes",
   "Works on any device"
  ],
  "floats": [
   "The whole business, one place",
   "Follow-up done"
  ],
  "cta": [
   "Your business.",
   "Your command center."
  ]
 },
 "accountants": {
  "noun": "accountant",
  "greet": "Hello, Priya",
  "workspace": "My practice",
  "spaces": [
   "Clients",
   "Returns",
   "Billing"
  ],
  "tags": [
   "Docs",
   "Filing",
   "Billing",
   "Mileage",
   "Close"
  ],
  "strip": [
   "Clients & returns",
   "Missing documents",
   "Billable hours",
   "Deadlines & close"
  ],
  "micro": [
   "Free to start",
   "Built for tax season",
   "Works on any device"
  ],
  "floats": [
   "Every return, tracked",
   "Docs requested"
  ],
  "cta": [
   "Tax season.",
   "Under control."
  ]
 },
 "creators": {
  "noun": "creator",
  "greet": "Hey, Jordan",
  "workspace": "My channel",
  "spaces": [
   "Content",
   "Brand deals",
   "Ideas"
  ],
  "tags": [
   "Filming",
   "Deals",
   "Editing",
   "Invoices",
   "DMs"
  ],
  "strip": [
   "Content calendar",
   "Brand deals",
   "Hooks & ideas",
   "Growth tracking"
  ],
  "micro": [
   "Free to start",
   "Plan, post, get paid",
   "Works on any device"
  ],
  "floats": [
   "Posting streak: 12 days",
   "Deal signed"
  ],
  "cta": [
   "Your content.",
   "Your command center."
  ]
 },
 "personal-trainers": {
  "noun": "trainer",
  "greet": "Morning, Coach Mike",
  "workspace": "My clients",
  "spaces": [
   "Clients",
   "Sessions",
   "Classes"
  ],
  "tags": [
   "Programs",
   "Intake",
   "Class",
   "Billing",
   "Content"
  ],
  "strip": [
   "Clients & sessions",
   "Class schedule",
   "New client intake",
   "Sales & invoices"
  ],
  "micro": [
   "Free to start",
   "Clients to invoices",
   "Works on any device"
  ],
  "floats": [
   "8 sessions this week",
   "Intake done"
  ],
  "cta": [
   "Your clients.",
   "Your command center."
  ]
 },
 "real-estate-agents": {
  "noun": "real estate agent",
  "greet": "Hello, Alicia",
  "workspace": "My listings",
  "spaces": [
   "Listings",
   "Buyers",
   "Closings"
  ],
  "tags": [
   "Showing",
   "Leads",
   "Open house",
   "Closing",
   "Mileage"
  ],
  "strip": [
   "Listings & buyers",
   "Showings",
   "Contract to close",
   "Leads & mileage"
  ],
  "micro": [
   "Free to start",
   "Listing to keys",
   "Works on any device"
  ],
  "floats": [
   "3 showings today",
   "Under contract"
  ],
  "cta": [
   "Every deal.",
   "Closed on time."
  ]
 },
 "health-care": {
  "noun": "health care worker",
  "greet": "Hi, Nurse Tasha",
  "workspace": "My shifts",
  "spaces": [
   "Shifts",
   "CE credits",
   "Licenses"
  ],
  "tags": [
   "License",
   "Shift",
   "CE",
   "Schedule",
   "Self-care"
  ],
  "strip": [
   "Shift log",
   "CE credits",
   "License renewals",
   "Care for the carer"
  ],
  "micro": [
   "Free to start",
   "No patient data",
   "Works on any device"
  ],
  "floats": [
   "BLS renewal in 30 days",
   "Shift logged"
  ],
  "cta": [
   "Your shifts.",
   "Your credits. Handled."
  ]
 },
 "contractors": {
  "noun": "contractor",
  "greet": "Morning, Luis",
  "workspace": "My jobs",
  "spaces": [
   "Jobs",
   "Estimates",
   "Materials"
  ],
  "tags": [
   "Estimate",
   "Materials",
   "Safety",
   "Invoice",
   "Tools"
  ],
  "strip": [
   "Jobs & estimates",
   "Materials & tools",
   "Site safety",
   "Invoices"
  ],
  "micro": [
   "Free to start",
   "Bid to paid",
   "Works on any device"
  ],
  "floats": [
   "4 jobs this week",
   "Estimate sent"
  ],
  "cta": [
   "Every job.",
   "In your pocket."
  ]
 },
 "salons-and-barbers": {
  "noun": "stylist",
  "greet": "Hey, Keisha",
  "workspace": "My chair",
  "spaces": [
   "Clients",
   "Services",
   "Stock"
  ],
  "tags": [
   "Stock",
   "Social",
   "Client",
   "Tips",
   "Stock"
  ],
  "strip": [
   "Client formulas",
   "Service menu",
   "Tips & sales",
   "Product stock"
  ],
  "micro": [
   "Free to start",
   "Chair to checkout",
   "Works on any device"
  ],
  "floats": [
   "6 clients today",
   "Formula saved"
  ],
  "cta": [
   "Your chair.",
   "Your clients, your way."
  ]
 },
 "restaurants": {
  "noun": "restaurant owner",
  "greet": "Morning, Chef Ana",
  "workspace": "My kitchen",
  "spaces": [
   "Opening",
   "Orders",
   "Team"
  ],
  "tags": [
   "Temps",
   "Orders",
   "Closing",
   "Schedule",
   "Sales"
  ],
  "strip": [
   "Opening & closing",
   "Temperature log",
   "Orders & stock",
   "Team & sales"
  ],
  "micro": [
   "Free to start",
   "Open to close",
   "Works on any device"
  ],
  "floats": [
   "Opening checklist done",
   "Walk-in at 36°"
  ],
  "cta": [
   "Open, close,",
   "and everything between."
  ]
 },
 "sales": {
  "noun": "sales rep",
  "greet": "Morning, Marcus",
  "workspace": "My pipeline",
  "spaces": [
   "Pipeline",
   "Calls",
   "Clients"
  ],
  "tags": [
   "Calls",
   "Follow-up",
   "Pricing",
   "Mileage",
   "QBR"
  ],
  "strip": [
   "Pipeline",
   "Calls & objections",
   "Better follow-ups",
   "Book the meeting"
  ],
  "micro": [
   "Free to start",
   "Lead to closed",
   "Works on any device"
  ],
  "floats": [
   "12 calls today",
   "Demo booked"
  ],
  "cta": [
   "Every lead.",
   "Followed up."
  ]
 },
 "freelancers": {
  "noun": "freelancer",
  "greet": "Hey, Sam",
  "workspace": "My studio",
  "spaces": [
   "Projects",
   "Pitches",
   "Invoices"
  ],
  "tags": [
   "Client work",
   "Pitch",
   "Invoice",
   "Portfolio",
   "Taxes"
  ],
  "strip": [
   "Projects & pitches",
   "Billable hours",
   "Invoices",
   "Expenses & taxes"
  ],
  "micro": [
   "Free to start",
   "Pitch to paid",
   "Works on any device"
  ],
  "floats": [
   "6 billable hours today",
   "Invoice paid"
  ],
  "cta": [
   "Do the work.",
   "Get paid for it."
  ]
 },
 "nonprofits": {
  "noun": "for your nonprofit",
  "greet": "Hello, Pastor James",
  "workspace": "Our mission",
  "spaces": [
   "Donors",
   "Events",
   "Grants"
  ],
  "tags": [
   "Donors",
   "Grants",
   "Volunteers",
   "Newsletter",
   "Board"
  ],
  "strip": [
   "Donors",
   "Events & fundraisers",
   "Grants",
   "Newsletters & notes"
  ],
  "micro": [
   "Free to start",
   "Donor to thank-you",
   "Works on any device"
  ],
  "floats": [
   "Gala: 42 thank-yous sent",
   "Grant submitted"
  ],
  "cta": [
   "More mission.",
   "Less mess."
  ]
 },
 "legal": {
  "noun": "lawyer",
  "greet": "Good morning, Ms. Harper",
  "workspace": "My matters",
  "spaces": [
   "Matters",
   "Billing",
   "Clients"
  ],
  "tags": [
   "Filing",
   "Billing",
   "Discovery",
   "Client",
   "Drafting"
  ],
  "strip": [
   "Matters & deadlines",
   "Billable hours",
   "Drafts & notes",
   "Clients"
  ],
  "micro": [
   "Free to start",
   "Every deadline kept",
   "Works on any device"
  ],
  "floats": [
   "Next deadline: Friday",
   "2.2 hrs billed"
  ],
  "cta": [
   "Every matter.",
   "Every deadline."
  ]
 },
 "job-seekers": {
  "noun": "job seeker",
  "greet": "You've got this, Alex",
  "workspace": "My job search",
  "spaces": [
   "Applications",
   "Interviews",
   "Resume"
  ],
  "tags": [
   "Apply",
   "Follow-up",
   "Practice",
   "Resume",
   "Interview"
  ],
  "strip": [
   "Application tracker",
   "Interview practice",
   "Resume & cover letters",
   "Book the interview"
  ],
  "micro": [
   "Free to start",
   "Apply to offer",
   "Works on any device"
  ],
  "floats": [
   "8 applications out",
   "Interview booked"
  ],
  "cta": [
   "The next job.",
   "One step at a time."
  ]
 },
 "everyone": {
  "noun": "",
  "greet": "Good morning, Taylor",
  "workspace": "My day",
  "spaces": [
   "Home",
   "Family",
   "Money"
  ],
  "tags": [
   "Groceries",
   "Bills",
   "Family",
   "Personal",
   "Health"
  ],
  "strip": [
   "To-dos & reminders",
   "Groceries & chores",
   "Bills & budget",
   "Family calendar"
  ],
  "micro": [
   "Free to start",
   "For the whole family",
   "Works on any device"
  ],
  "floats": [
   "Your day, in one place",
   "Little wins, big difference"
  ],
  "cta": [
   "Your whole life.",
   "One simple list."
  ]
 }
};

export const AUDIENCES: Audience[] = [
  { slug: "teachers", bundle: "work-job-teaching", nav: "Teachers", kicker: "For teachers and special educators",
    title: "To-Do App & Planner for Teachers (Free)", h1: ["The to-do app that knows ", "a teacher's week"],
    lead: "Lesson plans, grades, attendance, parent emails and meetings, next to your to-do list. WorkHub is free for teachers.",
    pains: [["Lessons and grades in one place", "Plan lessons, keep the gradebook and take attendance without opening five tabs."], ["Parents, without the inbox pile-up", "Keep family contacts and notes together, and forward any email to turn it into a to-do."], ["Sub plans ready before you need them", "A sub plan template and lesson ideas mean a sick day is one less thing to worry about."], ["Classroom helpers", "Hall passes, a random student picker and a group maker, right where your lessons are."]],
    sample: ["Grade unit 4 quiz", "Email Ms. Lopez back", "Copies for Friday", "Sub plans for Tuesday", "IEP meeting 3:15"],
    faq: [["Is it free for teachers?", "Yes. WorkHub and LifeHub are free for teachers. Arise All Access ($10 a month) adds every plugin and the AI features."], ["Does it help special education teachers?", "Yes. WorkHub has a caseload, goals, service minutes, student schedules and IEP meeting tools."], ["Can I see my school calendar?", "Yes. Connect Google Calendar, or add any calendar link from Outlook, Apple or your school, and it shows next to your to-dos."]] },
  { slug: "business-owners", bundle: "work-job-business", nav: "Business owners", kicker: "For small business owners",
    title: "To-Do App for Small Business Owners", h1: ["Run the business, ", "not ten apps"],
    lead: "Customers, leads, sales, expenses, stock, your team and tax dates, next to the to-dos that keep it all moving.",
    pains: [["Customers and leads", "Keep every client and every lead in a simple pipeline, with the next step on your to-do list."], ["Money you can see", "Log sales and expenses as they happen, check daily revenue and send invoices."], ["Stock, vendors and your team", "Know what's running low, who you order from and who's on the team."], ["Deadlines that don't sneak up", "Tax dates and a month-end close checklist come back on time, every time."]],
    sample: ["Call back the Garcia lead", "Reorder labels", "Send invoice #1042", "Pay quarterly taxes", "Month-end close"],
    faq: [["Is it a CRM?", "It's lighter than one: a client list and a leads pipeline that sit next to your to-dos, so following up is just another task."], ["Can my team use it?", "Keep your team roster here, and share lists and Docs with them when you need to."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "accountants", bundle: "work-job-accounting", nav: "Accountants", kicker: "For accountants and bookkeepers",
    title: "To-Do App for Accountants & Bookkeepers", h1: ["Tax season, ", "under control"],
    lead: "Clients, returns, missing documents, billable hours and filing deadlines, on one list that keeps up with you.",
    pains: [["Every return, every status", "A return tracker shows what's in, what's in progress and what's filed."], ["Chase missing documents", "Track what each client still owes you and turn it into a follow-up to-do."], ["Hours that turn into invoices", "Log billable hours or run a timer, then send the invoice from the same place."], ["Deadlines and month-end", "Filing dates, tax-season prep and a month-end close checklist that comes back each month."]],
    sample: ["W-2s from the Parks", "File Chen 1120-S", "Bill 3.5 hrs to Reed LLC", "Mileage for March", "Close books: Bloom Café"],
    faq: [["Does it replace my tax software?", "No. It's the to-do list and tracker around it: which client needs what, and what's due when."], ["Can I track billable hours?", "Yes. Log hours by client, or run the time tracker, and turn them into an invoice."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "creators", bundle: "work-job-creator", nav: "Creators", kicker: "For social media creators and influencers",
    title: "Content Planner & To-Do App for Creators", h1: ["Post more, ", "stress less"],
    lead: "A content calendar, brand deals, collabs and growth, with the to-dos that get the next video out the door.",
    pains: [["A content calendar you'll use", "Plan what's going out and where, and see what's due this week."], ["Brand deals, paid on time", "Track every deal from pitch to posted, and send sponsors an invoice."], ["Never stuck for an idea", "Hooks, content ideas and an idea generator for the days the well runs dry."], ["Growth you can see", "Log followers and posts, and run a quick checklist before you hit post."]],
    sample: ["Film the GRWM reel", "Send deck to Glow Co.", "Edit Tuesday's video", "Invoice the June sponsor", "Reply to collab DMs"],
    faq: [["Does it post for me?", "No. It plans and tracks: your calendar, deals, ideas and numbers, next to your to-do list."], ["Can I track brand deals?", "Yes, from pitch to payment, with invoices for sponsors."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "personal-trainers", bundle: "work-job-trainer", nav: "Trainers & coaches", kicker: "For personal trainers and fitness coaches",
    title: "To-Do App for Personal Trainers & Coaches", h1: ["More time coaching, ", "less time on admin"],
    lead: "Clients, sessions, classes and intake forms, with sales, invoices and your schedule next to your to-dos.",
    pains: [["Every client, every session", "Keep client notes and a session log so you walk in knowing where they left off."], ["Classes and scheduling", "A class schedule, and Find a Time to book sessions without the back-and-forth."], ["New client intake", "An intake checklist so every new client starts the same, done right."], ["Get paid", "Track sales and expenses and send invoices from the same place."]],
    sample: ["Program for Jess, week 3", "Intake: new client Sam", "6am bootcamp", "Invoice March packages", "Post a workout finisher"],
    faq: [["Can I log client sessions?", "Yes. Keep a session log and notes for every client."], ["Does it schedule sessions?", "Find a Time sends a link so clients can pick a time that works."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "real-estate-agents", bundle: "work-job-realestate", nav: "Real estate", kicker: "For real estate agents",
    title: "To-Do App for Real Estate Agents", h1: ["Listing to closing, ", "nothing dropped"],
    lead: "Listings, buyers, showings, leads and every step from contract to close, on one to-do list.",
    pains: [["Listings and buyers", "Keep each listing and each buyer's wish list in one place."], ["Showings that run on time", "Plan showings and open houses, with a checklist so nothing's forgotten."], ["Contract to close", "A closing checklist walks every deal from signed to keys."], ["Leads and miles", "A leads pipeline for follow-ups, and a mileage log for tax time."]],
    sample: ["Showing: 412 Elm, 10am", "Call back Zillow lead", "Open house signs", "Inspection: Oak St", "Log 38 miles"],
    faq: [["Does it track deals to closing?", "Yes. A contract-to-close checklist for each deal, next to your to-dos."], ["Can I log mileage?", "Yes. A mileage log is part of the real estate bundle."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "health-care", bundle: "work-job-healthcare", nav: "Health care", kicker: "For nurses and health care workers",
    title: "To-Do App for Nurses & Health Care Workers", h1: ["Shifts, CEs and licenses, ", "handled"],
    lead: "A shift log, CE credits and license renewals, plus a start-of-shift routine and a little care for the carer.",
    pains: [["Every shift logged", "Keep a shift log and your hours worked, week by week."], ["CE credits that add up", "Track CE credits as you earn them, so renewal time isn't a scramble."], ["Licenses that don't lapse", "Every license and certification with its renewal date and a reminder before it's due."], ["Take care of yourself too", "A start-of-shift routine and care-for-the-carer check-ins, plus Focus for charting."]],
    sample: ["Renew BLS by June 2", "Log 12-hr shift", "CE: 2 hrs pain mgmt", "Swap Sat shift", "Drink water"],
    faq: [["Is patient information kept here?", "No, and it shouldn't be. Arise To Do is for your own schedule, credits and to-dos, not patient records."], ["Will it remind me about renewals?", "Yes. Add a license or certification with its date and you get a reminder before it's due."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "contractors", bundle: "work-job-trades", nav: "Trades", kicker: "For contractors and the trades",
    title: "To-Do App for Contractors & the Trades", h1: ["Every job, estimate and part, ", "in your pocket"],
    lead: "Jobs, estimates, materials, tools and a job site safety check, with clients, vendors and invoices.",
    pains: [["Jobs and estimates", "Keep every job and every bid in one list, with the next step as a to-do."], ["Materials and tools", "A materials list per job and a tool inventory, so nothing's left at the shop."], ["Safe sites", "A job site safety check you can run every morning."], ["Paid for the work", "Log miles and expenses and send the invoice when the job's done."]],
    sample: ["Estimate: Kim bathroom", "Pick up 2x4s, drywall", "Safety check: Main St", "Invoice the Patel job", "Return the tile saw"],
    faq: [["Does it work on a phone on the job site?", "Yes. Arise To Do runs on any phone, tablet or computer."], ["Can I send invoices?", "Yes. Invoices are part of the trades bundle."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "salons-and-barbers", bundle: "work-job-salon", nav: "Salons & barbers", kicker: "For stylists and barbers",
    title: "To-Do App for Stylists, Salons & Barbers", h1: ["Your chair, ", "your clients, your way"],
    lead: "Client cards with formulas, your service menu, tips, products and sales, next to your day's to-dos.",
    pains: [["Every client's formula", "Keep each client's color formula and notes, ready when they sit down."], ["Your menu and your tips", "Your services and prices in one place, and a log of tips."], ["Product on the shelf", "Know what's running low before you run out."], ["Grow your book", "Plan posts for your page and let clients pick a time with Find a Time."]],
    sample: ["Order 7N developer", "Post before/after", "Maria: balayage 2pm", "Log today's tips", "Restock shampoo"],
    faq: [["Can I save color formulas?", "Yes. Each client card holds formulas and notes."], ["Does it book appointments?", "Find a Time lets clients pick a time that works for you both."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "restaurants", bundle: "work-job-restaurant", nav: "Restaurants", kicker: "For restaurants, cafés and food trucks",
    title: "Checklists & To-Do App for Restaurants", h1: ["Open, close, ", "and everything between"],
    lead: "Opening and closing checklists, a temperature log, supplier orders, stock, your team and daily sales.",
    pains: [["Open and close the same way every day", "Checklists that come back every morning and every night."], ["Temps logged", "A temperature log for coolers and hot holding."], ["Orders and stock", "Supplier orders, what's in stock and who you buy from."], ["Know your day", "Your team roster, sales and daily revenue in one place."]],
    sample: ["Walk-in temp: 36°", "Order produce for Thu", "Closing checklist", "Schedule Sat brunch", "Log today's sales"],
    faq: [["Can my staff use the checklists?", "Yes. Share opening and closing lists with your team."], ["Does it keep a temperature log?", "Yes. A temperature log is part of the restaurant bundle."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "sales", bundle: "work-job-sales", nav: "Sales", kicker: "For sales reps and account managers",
    title: "To-Do App for Sales Reps", h1: ["Follow up ", "on every lead"],
    lead: "A pipeline, calls made, objection notes and clients, with help writing the follow-up email.",
    pains: [["A pipeline you'll keep up", "Every lead and where it stands, with the next call on your to-do list."], ["Calls and objections", "Log calls made and keep your best answers to common objections."], ["Better follow-ups", "Rewrite an email in a tap, and get a summary of the meeting you just had."], ["Book the meeting", "Find a Time sends a link so prospects pick a time that works."]],
    sample: ["Call 12 leads", "Follow up: Acme demo", "Send pricing to Rios", "Log 48 miles", "Prep QBR deck"],
    faq: [["Does it connect to my CRM?", "Not directly. It's your own pipeline and to-do list, quick to keep up on your phone."], ["Can it write emails?", "The email rewriter and meeting summaries are AI tools in Arise All Access."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "freelancers", bundle: "work-job-freelance", nav: "Freelancers", kicker: "For freelancers, designers, writers and photographers",
    title: "To-Do App for Freelancers & Creatives", h1: ["Do the work ", "and get paid for it"],
    lead: "Projects, pitches, portfolio pieces, billable hours, invoices, expenses and tax dates in one place.",
    pains: [["Projects and pitches", "Every project and every pitch, with the next step on your to-do list."], ["Hours into invoices", "Track billable hours or run a timer, then send the invoice."], ["Your best work, collected", "Keep a list of portfolio pieces to share."], ["Taxes without the panic", "Log expenses as you go and see tax dates coming."]],
    sample: ["Logo round 2: Bramble", "Pitch Food & Wine", "Invoice 6 hrs to Kite", "Update portfolio", "Quarterly taxes"],
    faq: [["Can I track hours by client?", "Yes. Billable hours and a time tracker, ready to invoice."], ["Does it keep expenses?", "Yes. Log expenses and see tax deadlines coming."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "nonprofits", bundle: "work-job-nonprofit", nav: "Nonprofits", kicker: "For nonprofits and ministries",
    title: "To-Do App for Nonprofits & Ministries", h1: ["More mission, ", "less mess"],
    lead: "Donors, events, grants and fundraisers, with a newsletter writer and meeting notes.",
    pains: [["Donors you thank on time", "Keep every donor and the follow-up that's due."], ["Events and fundraisers", "Plan events and fundraisers step by step."], ["Grants on deadline", "Track every grant and when it's due."], ["Tell your story", "Draft the newsletter faster and keep meeting notes in Arise Notes."]],
    sample: ["Thank-you notes: gala", "Grant report due Fri", "Volunteer sign-up", "Newsletter draft", "Board meeting notes"],
    faq: [["Can our team share it?", "Yes. Share lists, Docs and notes with your team."], ["Does it track grants?", "Yes. A grants tracker with deadlines is part of the bundle."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "legal", bundle: "work-job-legal", nav: "Legal", kicker: "For lawyers and paralegals",
    title: "To-Do App for Lawyers & Paralegals", h1: ["Every matter, ", "every deadline"],
    lead: "Matters with their next deadline, billable hours, clients, invoices and meeting summaries.",
    pains: [["Matters and deadlines", "Each matter shows its next deadline, so nothing slips."], ["Billable hours", "Log hours by client or run a timer, then invoice."], ["Drafts and notes", "Docs for drafts, and meeting summaries for the call you just finished."], ["Clients in one place", "Keep client details next to the work you're doing for them."]],
    sample: ["File response: Diaz", "Bill 2.2 hrs: Harper", "Discovery due 5/14", "Call client re: offer", "Draft engagement letter"],
    faq: [["Is it case management software?", "No. It's a lighter to-do list and tracker for your matters, hours and deadlines."], ["Can I track billable time?", "Yes. Log billable hours or run the time tracker, then send an invoice."], ["What does it cost?", "WorkHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."]] },
  { slug: "job-seekers", bundle: "work-job-jobseeker", nav: "Job seekers", kicker: "For anyone looking for their next job",
    title: "Job Search Tracker & To-Do App", h1: ["Land the next job, ", "one step at a time"],
    lead: "Track every application, practice interview questions and write a better resume and cover letter.",
    pains: [["Every application tracked", "Where you applied, when, and what's next."], ["Interview practice", "Common interview questions to practice before the call."], ["A stronger resume", "Turn what you did into strong resume bullets, and draft a cover letter."], ["Book the interview", "Find a Time sends a link so recruiters can pick a time."]],
    sample: ["Apply: UX role at Nova", "Follow up with recruiter", "Practice: tell me about…", "Tailor resume", "Interview Thu 2pm"],
    faq: [["Is it free?", "Yes, WorkHub is free to start. The resume and cover letter writers are AI tools in Arise All Access ($10 a month)."], ["Can I track applications?", "Yes. Each application with its status and next step."], ["Does it help with interviews?", "Yes. Practice questions, and Find a Time to book the call."]] },
  { slug: "everyone", nav: "Everyone", kicker: "For everyone",
    title: "Free To-Do List, Planner & Family App", h1: ["Your whole life, ", "on one simple list"],
    lead: "To-dos, groceries, chores, bills, the family calendar, notes and habits, in LifeHub. Free to start, on every phone.",
    pains: [["To-dos that remind you", "Due dates, repeats and reminders, so the little things get done."], ["Home and family", "Groceries, chores, meal plans and a shared family calendar everyone can see."], ["Money and bills", "Bills with due dates, a budget and savings goals."], ["Health and habits", "Water, sleep, workouts and habits, checked off as you go."]],
    sample: ["Milk, eggs, bananas", "Pay the electric bill", "Soccer practice 5pm", "Call Mom", "30-min walk"],
    faq: [["Is it free?", "Yes. LifeHub is free to start. Arise All Access ($10 a month) adds every plugin and the AI features."], ["Can my family share it?", "Yes. FamilyHub gives your family a shared calendar, chores and lists."], ["Does it work with my calendar?", "Yes. Connect Google Calendar or your iPhone calendar, or add any calendar link."]] },
];

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The names of the tools in a job's bundle, as the Plugin Gallery shows them. */
export function bundleTools(bundleId: string): { name: string; tagline: string }[] {
  const pack = HUB_TEMPLATES.find((t) => t.id === bundleId);
  if (!pack) throw new Error(`No bundle ${bundleId}`);
  const all = new Map(pluginsFor("work", { teacher: true } as any).map((p: any) => [p.id, p]));
  return pack.plugins.map((id: string) => all.get(id)).filter(Boolean).map((p: any) => ({ name: p.name, tagline: p.tagline || "" }));
}

// ——— The homepage's own design ———
// The stylesheet is the homepage's (client/public/educator.html), copied into /for/site.css each time this runs,
// so these pages always look like the homepage. The few rules below are only for parts the homepage doesn't have.
const HOME = () => readFileSync(new URL("../client/public/educator.html", import.meta.url), "utf8");
export function siteCss(): string {
  const blocks = [...HOME().matchAll(/<style(?: id="[^"]*")?>([\s\S]*?)<\/style>/g)].map((m) => m[1].trim());
  return `/* Made by script/industryPages.ts from the homepage's styles (client/public/educator.html). Don't edit by hand. */\n${blocks.join("\n")}\n${EXTRA_CSS}`;
}
const EXTRA_CSS = `
/* Who it's for pages */
.for-hero .hero-copy h1{max-width:620px}
.toolkit-section{padding:96px 0;background:linear-gradient(180deg,#fbfbff,#f4f6fc)}
.toolkit-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:30px}
.toolkit-grid .showcase-card{cursor:default}
.toolkit-grid .showcase-card:hover{transform:none}
.toolkit-foot{display:flex;justify-content:space-between;align-items:center;gap:18px;flex-wrap:wrap;margin-top:26px;color:#69738c;font-size:14px}
.toolkit-foot a{color:#506fe0;font-weight:800;text-decoration:none;display:inline-flex;align-items:center;gap:6px}.toolkit-foot a svg{width:16px;height:16px}
.preview-task .tag{margin-left:auto}
.preview-task.done .task-name{text-decoration:line-through;color:#a7aec0}
.mini-checkbox:checked{background:#5b53df;border-color:#5b53df}
.mini-checkbox:checked::after{content:"";width:6px;height:3px;border:solid #fff;border-width:0 0 2px 2px;transform:rotate(-45deg) translate(1px,-1px)}
.jobs-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:30px}
.job-card{display:flex;gap:13px;align-items:center;padding:16px;background:#fff;border:1px solid #e6ebf3;border-radius:19px;text-decoration:none;color:#1f2440;box-shadow:0 5px 14px #26365805;transition:transform .18s,border-color .18s,box-shadow .18s}
.job-card:hover{transform:translateY(-2px);border-color:#c9c0f7;box-shadow:0 14px 28px #26365812}
.job-card .showcase-icon{flex:none}
.job-card strong{display:block;font-size:15px}.job-card small{display:block;color:#69738c;font-size:12.5px;line-height:1.45;margin-top:2px}
.job-card.current{border-color:#b9adf5;background:#faf9ff}
@media(max-width:980px){.toolkit-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.jobs-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.toolkit-grid,.jobs-grid{grid-template-columns:1fr}.toolkit-section{padding:70px 0}}
`;

const LOGO = () => (/<img class="logo-symbol" src="([^"]+)"/.exec(HOME()) || [, ""])[1];
const SPRITE = () => (/<svg aria-hidden="true" xmlns="http:\/\/www\.w3\.org\/2000\/svg" style="position:absolute;width:0;height:0;overflow:hidden">[\s\S]*?<\/svg>/.exec(HOME()) || [""])[0];
const PRICING = (withSchools: boolean) => {
  let html = (/<section class="pricing-section" id="pricing"[\s\S]*?<\/section>/.exec(HOME()) || [""])[0];
  if (!withSchools) html = html.replace(/\s*<div class="pricing-grid" style="margin-top:22px" data-testid="pricing-schools">[\s\S]*?<\/article>\s*<\/div>/, "").replace(/\s*<p class="pricing-note">Arise Reader learning programs[\s\S]*?<\/p>/, "");
  return html;
};

const TAG_CLASS = ["work", "", "family", "personal", "work"];
const DOTS = ["#a38cfa", "#f59e0b", "#10b981", "#3b82f6", "#ec4899"];
const ACCENTS = ["#5b53df", "#e99b5f", "#16a39a", "#4f7be8", "#d9577e", "#8a63e6", "#23a26d", "#e0a23a"];
/** An icon from the homepage's set that fits a tool's name. */
export function iconFor(name: string): string {
  const n = name.toLowerCase();
  if (/client|donor|buyer|team|roster|collab|parent|famil|student/.test(n)) return "i-users";
  if (/calendar|schedule|class|time|find a|deadline|date|showing|shift|session|event|interview/.test(n)) return "i-calendar";
  if (/invoice|sale|expense|revenue|billable|tip|mileage|money|price|follower|calls|hours|grade/.test(n)) return "i-chart";
  if (/checklist|close|closing|opening|safety|onboard|intake|prep|routine|start/.test(n)) return "i-check";
  if (/idea|hook|brainstorm|helper|writer|rewrite|bullet|cover letter|newsletter|summar|objection|finisher/.test(n)) return "i-spark";
  if (/doc|note|sheet|letter|resume|pitch|portfolio|lesson|sub plan|plan/.test(n)) return "i-notes";
  if (/care|heart|behavior|wall/.test(n)) return "i-heart";
  if (/focus|goal|lead|pipeline|matter|grant|fundrais|target|application/.test(n)) return "i-target";
  if (/repeat|month|weekly/.test(n)) return "i-repeat";
  return "i-list";
}

const head = (title: string, desc: string, path: string, ld: object) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1" />
<link rel="canonical" href="${SITE}${path}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Arise To Do" />
<meta property="og:url" content="${SITE}${path}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:image" content="${SITE}/todo-og.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${SITE}/todo-og.png" />
<meta name="theme-color" content="#f9faff" />
<link rel="icon" type="image/svg+xml" href="/todo-favicon.svg?v=20261012" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="manifest" href="/todo.webmanifest" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/for/site.css?v=${UPDATED}" />
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
</head>`;

const logo = (href: string, label: string) => `<a class="logo" href="${href}" aria-label="${label}"><img class="logo-symbol" src="${LOGO()}" alt="" /><span>Arise <span class="todo">To Do</span></span></a>`;

const header = (links: [string, string][]) => `<header class="site-header">
 <div class="container nav-inner">
  ${logo("/", "Arise To Do home")}
  <nav class="nav-links" id="navLinks" aria-label="Main navigation">${links.map(([h, t]) => `<a href="${h}">${t}</a>`).join("")}<a class="mobile-auth" href="/app#/signin">Sign in</a><a class="mobile-auth" href="/app#/signin?create">Create account</a></nav>
  <div class="nav-auth"><a class="header-signin" href="#pricing">Pricing</a><a class="header-signin" href="/app#/signin">Sign in</a><a class="button button-primary" href="/app#/signin?create">Get started <svg><use href="#i-arrow"/></svg></a></div>
  <button class="menu-toggle" id="menuToggle" aria-label="Open menu" aria-expanded="false" aria-controls="navLinks"><svg><use href="#i-menu"/></svg></button>
 </div>
</header>`;

const footer = () => `<footer class="site-footer"><div class="container footer-inner">${logo("#top", "Back to top")}<span class="footer-text">Arise To Do · To-dos, calendar and the tools for your work and your life · 2026</span><span class="footer-actions"><a class="footer-link" href="/">Home</a><a class="footer-link" href="/for/">Who it's for</a><a class="footer-link" href="/for/everyone/">For everyone</a><a class="footer-link" href="/#pricing">Pricing</a><a class="footer-link" href="/privacy/">Privacy</a><a class="footer-link" href="/terms/">Terms</a><a class="footer-link" href="/app#/signin">Sign in</a><a class="footer-link" href="/app#/signin?create">Create account</a><a class="footer-link" href="#top">Back to top ↑</a></span></div></footer>`;

// The menu button and the hero's checkboxes, the same way the homepage does them.
const SCRIPT = `<script>
(function(){var m=document.getElementById('menuToggle'),n=document.getElementById('navLinks');if(m&&n){m.addEventListener('click',function(){var o=n.classList.toggle('show');m.setAttribute('aria-expanded',String(o));m.setAttribute('aria-label',o?'Close menu':'Open menu')});n.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){n.classList.remove('show');m.setAttribute('aria-expanded','false')})})}
var boxes=[].slice.call(document.querySelectorAll('#previewList .mini-checkbox'));function count(){var d=boxes.filter(function(b){return b.checked}).length,t=boxes.length,p=Math.round(d/t*100);document.getElementById('heroCompleted').textContent=d;document.getElementById('heroPercent').textContent=p+'%';document.getElementById('heroRing').style.setProperty('--progress',p+'%')}
boxes.forEach(function(b){b.addEventListener('change',function(){b.closest('.preview-task').classList.toggle('done',b.checked);count()})});
var d=document.getElementById('mockDate');if(d){try{d.textContent=new Date().toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'}).toUpperCase()}catch(e){}}})();
</script>`;

function jobCards(current: string): string {
  return `<div class="jobs-grid">${AUDIENCES.map((a, i) => {
    const pack = a.bundle ? HUB_TEMPLATES.find((t) => t.id === a.bundle) : undefined;
    const color = (pack as any)?.color || "#5b53df";
    const sub = a.bundle ? (pack as any).tagline : "To-dos, home, family and money";
    return `<a class="job-card${a.slug === current ? " current" : ""}" href="/for/${a.slug}/"${a.slug === current ? ' aria-current="page"' : ""} style="--app-accent:${color}"><span class="showcase-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#${a.bundle ? iconFor(a.nav + " " + sub) : "i-heart"}"></use></svg></span><span><strong>${esc(a.nav)}</strong><small>${esc(sub)}</small></span></a>`;
  }).join("")}</div>`;
}

export function audiencePage(a: Audience): string {
  const L = LOOKS[a.slug];
  const path = `/for/${a.slug}/`;
  const pack = a.bundle ? HUB_TEMPLATES.find((t) => t.id === a.bundle) : undefined;
  const tools = a.bundle ? bundleTools(a.bundle) : [];
  const hub = a.bundle ? "WorkHub" : "LifeHub";
  const who = a.kicker.replace(/^For /, "");
  const start = !a.bundle ? "Start free" : L.noun.startsWith("for ") ? `Start free ${L.noun}` : `Start free as ${/^[aeiou]/i.test(L.noun) ? "an" : "a"} ${L.noun}`;
  const title = `${a.title} | Arise To Do`;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": `${SITE}${path}`, url: `${SITE}${path}`, name: title, description: a.lead, dateModified: UPDATED, isPartOf: { "@type": "WebSite", name: "Arise To Do", url: `${SITE}/` },
      breadcrumb: { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Arise To Do", item: `${SITE}/` }, { "@type": "ListItem", position: 2, name: "Who it's for", item: `${SITE}/for/` }, { "@type": "ListItem", position: 3, name: a.nav, item: `${SITE}${path}` }] } },
    { "@type": "SoftwareApplication", name: "Arise To Do", applicationCategory: "ProductivityApplication", operatingSystem: "iOS, Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    { "@type": "FAQPage", mainEntity: faqs(a).map(([q, ans]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: ans } })) },
  ] };
  const hero4 = a.sample.slice(0, 4);
  const features: [string, string, string, string][] = a.bundle ? [
    ["blue", "i-list", "To-dos that fit your day", "Due dates, repeats and reminders, and a daily brief that shows what matters this morning."],
    ["teal", "i-calendar", "Your calendar, right there", "Connect Google Calendar from the Calendar page, or add your iPhone calendar or any calendar link."],
    ["purple", "i-cloud", "Email to to-do", "Forward an email to WorkHub and it lands on your list, with the email attached."],
    ["orange", "i-users", "Work and home, one tap apart", "WorkHub for the job and LifeHub for everything else, with one sign-in."],
    ["pink", "i-target", "Hide what you don't use", "Turn on the tools you need, hide the rest, and add more from 575+ plugins any time."],
    ["indigo", "i-repeat", "On every device", "Saved to your account, on your phone, tablet and computer, with Home Screen widgets on iPhone."],
  ] : [
    ["blue", "i-list", "To-dos that remind you", "Due dates, repeats and reminders, so the little things get done without living in your head."],
    ["teal", "i-users", "The whole family", "FamilyHub gives everyone a shared calendar, chores, lists and who's driving."],
    ["purple", "i-chart", "Money and bills", "Bills with due dates, a budget and savings goals, all next to your to-dos."],
    ["orange", "i-heart", "Health and habits", "Water, sleep, workouts, meals and habits, checked off as you go."],
    ["pink", "i-calendar", "Your calendar, right there", "Connect Google Calendar or your iPhone calendar, or add any calendar link."],
    ["indigo", "i-notes", "Notes and lists", "Notes, grocery lists and checklists that sit next to the to-dos they go with."],
  ];
  const steps: [string, string][] = a.bundle ? [
    ["Make your free account", "It takes a minute, and WorkHub and LifeHub are free to start."],
    [`Add the ${pack!.name} bundle`, `Open WorkHub's Plugin Gallery, find Bundles by job, tap ${pack!.name}, then Add all.`],
    ["Make it yours", "Hide what you don't use, add your first to-dos, and connect Google Calendar from the Calendar page."],
  ] : [
    ["Make your free account", "It takes a minute, and LifeHub is free to start."],
    ["Get it out of your head", "Add your to-dos, groceries and bills. Due dates and reminders come back on their own."],
    ["Bring everyone in", "Invite your family to FamilyHub and connect Google Calendar or your iPhone calendar."],
  ];
  return `${head(title, a.lead, path, ld)}
<body>
${SPRITE()}
<div class="educator-ribbon"><b>${esc(a.bundle ? `Arise To Do for ${who}` : "Arise To Do for everyone")}</b> · ${esc(L.strip.join(" · "))} · Free to start</div>
${header(a.bundle ? [["/for/", "Who it's for"], ["#day", "Your day"], ["#toolkit", "Toolkit"], ["#features", "Features"], ["#how", "How it works"], ["#pricing", "Pricing"], ["#faq", "FAQ"]] : [["/for/", "Who it's for"], ["#day", "Your day"], ["#features", "Features"], ["#how", "How it works"], ["#pricing", "Pricing"], ["#faq", "FAQ"]])}
<main id="top">
<section class="hero for-hero">
 <div class="container hero-grid">
 <div class="hero-copy">
  <div class="eyebrow"><i class="dot"></i> ${esc(a.kicker)}</div>
  <h1>${esc(a.h1[0])}<span class="gradient-text">${esc(a.h1[1])}.</span></h1>
  <p class="lede">${esc(a.lead)}</p>
  <div class="hero-actions"><a class="button button-primary" href="/app#/signin?create">${esc(start)} <svg><use href="#i-arrow"/></svg></a><a class="button button-secondary" href="${a.bundle ? "#toolkit" : "#day"}">${a.bundle ? "See the toolkit" : "See how it works"}</a><a class="hero-demo-link" href="/for/">Not your job? See who it's for →</a></div>
  <div class="hero-micro">${L.micro.map((m, i) => `${i ? '<span class="mini-line"></span>' : ""}<span class="mini-mark"><svg><use href="#i-check"/></svg> ${esc(m)}</span>`).join("")}</div>
 </div>
 <div class="hero-art" aria-label="${esc(hub)} preview for ${esc(who)}"><div class="halo"></div>
  <div class="float-tag top"><span class="bubble"><svg><use href="#i-spark"/></svg></span> ${esc(L.floats[0])}</div>
  <div class="app-window">
    <div class="window-top"><span class="traffic"><i></i><i></i><i></i></span><span class="window-address">Arise To Do / ${esc(hub)}</span><svg class="icon-small"><use href="#i-lock"/></svg></div>
    <div class="window-content">
     <div class="window-sidebar"><div class="tiny-profile"><div class="tiny-logo"><svg><use href="#i-check"/></svg></div> ${esc(L.workspace)}</div><div class="mock-menu"><div class="menu-row active"><svg><use href="#i-calendar"/></svg><span>Today</span></div><div class="menu-row"><svg><use href="#i-list"/></svg><span>My tasks</span></div><div class="menu-row"><svg><use href="#i-repeat"/></svg><span>Routines</span></div><div class="menu-row"><svg><use href="#i-notes"/></svg><span>Notes</span></div></div><div class="mock-group-title">MY SPACES</div><div class="mock-menu">${L.spaces.map((sp, i) => `<div class="menu-row"><i class="little-circle${["", " purple", " coral"][i]}"></i><span>${esc(sp)}</span></div>`).join("")}</div></div>
     <div class="mock-main"><div class="mock-top"><div><div class="mock-overline" id="mockDate">YOUR DAILY DASHBOARD</div><h3>${esc(L.greet)} <span aria-hidden="true">☀️</span></h3><div class="mock-sub">A fresh day to make things happen.</div></div><div class="avatar">${esc(L.greet.replace(/^[^,]*,\s*/, "").replace(/^(Ms\.|Mr\.|Nurse|Coach|Chef|Pastor)\s+/, "").charAt(0))}</div></div>
      <div class="mock-metrics"><div class="metric-card"><div><div class="metric-title">Today's progress</div><div class="metric-value"><span id="heroCompleted">1</span> of ${hero4.length} done</div></div><div class="progress-ring" id="heroRing" style="--progress:25%"><span id="heroPercent">25%</span></div></div><div class="metric-card light"><div><div class="metric-title">Make it count</div><div class="metric-value">Keep going!</div></div><span class="spark"><svg><use href="#i-chart"/></svg></span></div></div>
      <div class="preview-title"><span>Up next</span><span>Your top priorities</span></div><div class="preview-list" id="previewList">${hero4.map((t, i) => `<label class="preview-task${i === 0 ? " done" : ""}"><input type="checkbox" class="mini-checkbox"${i === 0 ? " checked" : ""} aria-label="Mark ${esc(t)} done" /><span class="task-name">${esc(t)}</span><span class="tag ${TAG_CLASS[i]}">${esc(L.tags[i])}</span></label>`).join("")}</div><div class="mock-footer"><span class="v">+</span> Every small step adds up.</div>
     </div>
    </div>
  </div>
  <div class="float-tag bottom"><span class="bubble"><svg><use href="#i-check"/></svg></span> ${esc(L.floats[1])}</div><div class="preview-label">LIVE PREVIEW · TRY THE CHECKBOXES</div>
 </div>
 </div>
</section>
<div class="intro-strip"><div class="container intro-strip-inner"><span class="intro-strip-title">${esc(a.bundle ? `Built for ${who}` : "Built for real life")}</span>${L.strip.map((x) => `<span class="strip-item"><svg><use href="#i-check"/></svg> ${esc(x)}</span>`).join("")}</div></div>

<section class="duo-section" id="day" aria-labelledby="day-title">
<div class="container duo-grid">
 <div>
  <div class="section-kicker">${esc(a.kicker)}</div>
  <h2 class="section-heading" id="day-title">${esc(a.bundle ? "Your whole workday." : "Your whole day.")}<br /><span class="gradient-text">${esc(`One ${a.bundle ? "free" : "simple"} ${hub}.`)}</span></h2>
  <p class="section-desc">${esc(a.bundle ? `Arise WorkHub puts your to-dos next to everything else ${who} keep track of, so nothing lives on sticky notes.` : "Arise LifeHub keeps the house running and your head clear: to-dos, groceries, bills, the family calendar and your habits in one place.")}</p>
  <div class="duo-cards">
${a.pains.map(([h, p], i) => `   <div class="duo-card"><span class="n">${i + 1}</span><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></div>`).join("\n")}
  </div>
  <div class="hero-actions"><a class="button button-primary" href="/app#/signin?create">${esc(start)} <svg><use href="#i-arrow"/></svg></a></div>
 </div>
 <div class="duo-phone" role="img" aria-label="Arise ${esc(hub)}: ${esc(who)}'s spaces on the left, today's to-dos on the right">
  <div class="duo-screen">
   <div class="duo-pane left">
    <div class="duo-pane-title">Arise ${esc(hub)}</div>
    <div class="duo-chip on"><i style="background:${DOTS[0]}"></i>Today</div>
${L.spaces.map((sp, i) => `    <div class="duo-chip"><i style="background:${DOTS[i + 1]}"></i>${esc(sp)}</div>`).join("\n")}
    <div class="duo-chip"><i style="background:${DOTS[4]}"></i>Calendar</div>
   </div>
   <div class="duo-pane">
    <div class="duo-pane-title">Today · ${a.sample.length} tasks</div>
${a.sample.map((t, i) => `    <div class="duo-task${i === 0 ? " done" : ""}"><b></b>${esc(t)}</div>`).join("\n")}
   </div>
  </div>
  <span class="duo-fold" aria-hidden="true"></span>
 </div>
</div>
</section>
${tools.length ? `
<section class="toolkit-section" id="toolkit" aria-labelledby="toolkit-title">
 <div class="container">
  <div class="showcase-intro">
   <div><div class="section-kicker">Bundles by job</div><h2 class="section-heading" id="toolkit-title">The ${esc(pack!.name)} toolkit. <span class="gradient-text">Added in one tap.</span></h2>
   <p class="section-desc">${esc(pack!.description || "")}</p></div>
   <span class="showcase-total"><span class="showcase-total-number">${tools.length}</span><span>tools in<br/>one bundle</span></span>
  </div>
  <div class="toolkit-grid">
${tools.map((t, i) => `   <div class="showcase-card" style="--app-accent:${ACCENTS[i % ACCENTS.length]}"><span class="showcase-icon"><svg aria-hidden="true" viewBox="0 0 24 24"><use href="#${iconFor(t.name + " " + t.tagline)}"></use></svg></span><span class="showcase-card-copy"><strong>${esc(t.name)}</strong><small>${esc(t.tagline)}</small></span></div>`).join("\n")}
  </div>
  <div class="toolkit-foot"><span>Keep the tools you use and hide the rest. 575+ more are in the Plugin Gallery.</span><a href="/app#/signin?create">Get the ${esc(pack!.name)} bundle free <svg aria-hidden="true" viewBox="0 0 24 24"><use href="#i-arrow"></use></svg></a></div>
 </div>
</section>` : ""}
<section class="section" id="features"><div class="container"><div class="features-header center"><div class="section-kicker">Everything in its place</div><h2 class="section-heading">${a.bundle ? "Plus everything in" : "Everything you need,"}<br /><span class="gradient-text">${a.bundle ? "Arise To Do." : "nothing you don't."}</span></h2><p class="section-desc">${a.bundle ? "Your job's tools sit next to the everyday ones: reminders, your calendar, email to to-do, and a hub you shape yourself." : "Not a template, a hub you build. Turn on the sections you need, hide the rest, and add more from the Plugin Gallery."}</p></div>
<div class="features-grid">
${features.map(([c, ic, h, p]) => ` <article class="feature-card"><div class="feature-icon ${c}"><svg><use href="#${ic}"/></svg></div><h3>${esc(h)}</h3><p>${esc(p)}</p></article>`).join("\n")}
</div></div></section>
<section class="how" id="how"><div class="container"><div class="center"><div class="section-kicker">Simple by design</div><h2 class="section-heading">Up and running, in <span class="gradient-text">three steps.</span></h2></div><div class="steps">${steps.map(([h, p], i) => `<div class="step"><div class="number">0${i + 1}</div><div><h3>${esc(h)}</h3><p>${esc(p)}</p></div></div>`).join("")}</div></div></section>
${PRICING(a.slug === "teachers")}
<section class="faq-section" id="faq" aria-labelledby="faq-title">
<div class="container faq-wrap">
<div class="section-kicker">Questions</div>
<h2 class="section-heading" id="faq-title">Questions from ${esc(a.bundle ? who.replace(/^anyone /, "people ") : "people like you")}, <span class="gradient-text">answered.</span></h2>
${faqs(a).map(([q, ans]) => `<details class="faq-item"><summary>${esc(q)}</summary><p>${esc(ans)}</p></details>`).join("\n")}
</div>
</section>
<section class="section" id="who" aria-labelledby="who-title"><div class="container"><div class="features-header center"><div class="section-kicker">Who it's for</div><h2 class="section-heading" id="who-title">Arise To Do, <span class="gradient-text">for every kind of work.</span></h2></div>
${jobCards(a.slug)}
</div></section>
<section class="bottom-cta"><div class="container"><div class="cta-card"><div class="section-kicker">Make space for what matters</div><h2>${esc(L.cta[0])}<br />${esc(L.cta[1])}</h2><p>Free to start, and yours to shape. <a href="#pricing" style="color:#fff;text-decoration:underline">See pricing</a>.</p><a href="/app#/signin?create" class="button">${esc(start)} <svg><use href="#i-arrow"/></svg></a><div class="cta-small"><a href="/app#/signin">Already have an account? Sign in</a> · <a href="/for/">See who it's for</a></div></div></div></section>
</main>
${footer()}
${SCRIPT}
</body>
</html>
`;
}

/** A page's questions: its own, then two every page answers the same way. */
function faqs(a: Audience): [string, string][] {
  return [...a.faq,
    ["Does it sync across my devices?", "Yes. Everything is saved to your account, so the same lists are on your phone, tablet and computer."],
    ["Can I hide the tools I don't need?", "Yes. Turn on the tools you use, hide the rest, and add more from the Plugin Gallery any time."]];
}

export function audienceIndex(): string {
  const path = "/for/";
  const title = "Who Arise To Do Is For: Every Job, and Everyone | Arise To Do";
  const desc = "Arise To Do has a version for your work: teachers, business owners, accountants, creators, trainers, agents, nurses, contractors, plus LifeHub for all.";
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE}${path}`, url: `${SITE}${path}`, name: title, description: desc, dateModified: UPDATED,
    hasPart: AUDIENCES.map((a) => ({ "@type": "WebPage", name: a.title, url: `${SITE}/for/${a.slug}/` })) };
  return `${head(title, desc, path, ld)}
<body>
${SPRITE()}
<div class="educator-ribbon"><b>Bundles by job</b> · Everything your work needs, added in one tap · 575+ plugins in the Plugin Gallery · Free to start</div>
${header([["/", "Home"], ["#jobs", "Choose your job"], ["/for/everyone/", "For everyone"], ["#how", "How it works"], ["#pricing", "Pricing"]])}
<main id="top">
<section class="hero for-hero">
 <div class="container hero-grid">
 <div class="hero-copy">
  <div class="eyebrow"><i class="dot"></i> Who it's for</div>
  <h1>A to-do app <span class="gradient-text">made for your work.</span></h1>
  <p class="lede">Pick your job and Arise To Do sets up WorkHub with the tools you need in one tap. Not here for work? LifeHub keeps the rest of your life on one simple list.</p>
  <div class="hero-actions"><a class="button button-primary" href="/app#/signin?create">Get started free <svg><use href="#i-arrow"/></svg></a><a class="button button-secondary" href="/for/everyone/">For everyone</a></div>
  <div class="hero-micro"><span class="mini-mark"><svg><use href="#i-check"/></svg> ${AUDIENCES.filter((x) => x.bundle).length} jobs</span><span class="mini-line"></span><span class="mini-mark"><svg><use href="#i-check"/></svg> One-tap bundles</span><span class="mini-line"></span><span class="mini-mark"><svg><use href="#i-check"/></svg> Free to start</span></div>
 </div>
 <div class="hero-art" aria-hidden="true"><div class="halo"></div>
  <div class="duo-phone"><div class="duo-screen"><div class="duo-pane left"><div class="duo-pane-title">Bundles by job</div>${AUDIENCES.filter((x) => x.bundle).slice(0, 6).map((x, i) => `<div class="duo-chip${i === 0 ? " on" : ""}"><i style="background:${(HUB_TEMPLATES.find((t) => t.id === x.bundle) as any).color}"></i>${esc(x.nav)}</div>`).join("")}</div><div class="duo-pane"><div class="duo-pane-title">Teaching · added</div>${bundleTools("work-job-teaching").slice(0, 6).map((t, i) => `<div class="duo-task${i < 2 ? " done" : ""}"><b></b>${esc(t.name)}</div>`).join("")}</div></div><span class="duo-fold"></span></div>
 </div>
 </div>
</section>
<section class="section" id="jobs" aria-labelledby="jobs-title"><div class="container"><div class="features-header center"><div class="section-kicker">Choose yours</div><h2 class="section-heading" id="jobs-title">Every kind of work. <span class="gradient-text">One app.</span></h2><p class="section-desc">Each page shows the tools that job's bundle adds, and how people in that work use Arise To Do.</p></div>
${jobCards("")}
</div></section>
<section class="how" id="how"><div class="container"><div class="center"><div class="section-kicker">Simple by design</div><h2 class="section-heading">Up and running, in <span class="gradient-text">three steps.</span></h2></div><div class="steps"><div class="step"><div class="number">01</div><div><h3>Make your free account</h3><p>It takes a minute, and WorkHub and LifeHub are free to start.</p></div></div><div class="step"><div class="number">02</div><div><h3>Pick your job's bundle</h3><p>In WorkHub's Plugin Gallery, open Bundles by job and tap Add all.</p></div></div><div class="step"><div class="number">03</div><div><h3>Make it yours</h3><p>Hide what you don't use, add your to-dos, and connect your calendar.</p></div></div></div></div></section>
${PRICING(false)}
<section class="bottom-cta"><div class="container"><div class="cta-card"><div class="section-kicker">Make space for what matters</div><h2>Your work.<br />Your command center.</h2><p>Free to start, and yours to shape. <a href="#pricing" style="color:#fff;text-decoration:underline">See pricing</a>.</p><a href="/app#/signin?create" class="button">Get started free <svg><use href="#i-arrow"/></svg></a><div class="cta-small"><a href="/app#/signin">Already have an account? Sign in</a> · <a href="/">Arise To Do home</a></div></div></div></section>
</main>
${footer()}
${SCRIPT.replace(/var boxes[\s\S]*?count\(\)\}\)\}\);/, "")}
</body>
</html>
`;
}

if (process.argv[1] && /industryPages\.ts$/.test(process.argv[1])) {
  const root = new URL("../client/public/for/", import.meta.url);
  mkdirSync(root, { recursive: true });
  writeFileSync(new URL("site.css", root), siteCss());
  writeFileSync(new URL("index.html", root), audienceIndex());
  for (const a of AUDIENCES) {
    const dir = new URL(`${a.slug}/`, root);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL("index.html", dir), audiencePage(a));
  }
  console.log(`Wrote /for/site.css, /for/ and ${AUDIENCES.length} pages.`);
}
