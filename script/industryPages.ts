// Arise To Do's "Who it's for" pages: one page per job (the Plugin Gallery's "Bundles by job") and one for
// everyone else, written to client/public/for/<slug>/index.html, plus the /for/ list. The tools on each page come
// from the job's bundle in shared/pluginStore.ts, so a page never names a tool the app doesn't have.
// Run with: npx tsx script/industryPages.ts   (tests/industry-pages.test.ts checks the pages match.)
import { mkdirSync, writeFileSync } from "node:fs";
import { HUB_TEMPLATES, pluginsFor } from "../shared/pluginStore";

export const UPDATED = "2026-11-26";
const SITE = "https://arisetodo.com";

export type Audience = {
  slug: string; bundle?: string; nav: string; kicker: string; title: string; h1: [string, string]; lead: string;
  pains: [string, string][]; sample: string[]; faq: [string, string][];
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

const STYLE = `:root{--ink:#1c2238;--muted:#5d6782;--line:#e6eaf3;--bg:#f9fafc;--card:#fff;--accent:#6e5ae0;--dark:#292446;--grad:linear-gradient(115deg,#10b9af 0%,#5279ed 53%,#9363e7 100%)}
*{box-sizing:border-box}html{scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.7 "DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif}
a{color:#4b5fd6}a:focus-visible{outline:3px solid #8b78f0;outline-offset:3px}
.wrap{max-width:1080px;margin:0 auto;padding:0 22px}
header.top{position:sticky;top:0;z-index:20;background:rgba(249,250,252,.92);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;gap:18px;min-height:64px}
.logo{display:inline-flex;align-items:center;gap:10px;font:800 19px/1 Manrope,system-ui,sans-serif;letter-spacing:-.6px;color:var(--ink);text-decoration:none;margin-right:auto}
.logo b{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.logo i{width:30px;height:30px;border-radius:9px;background:var(--grad);display:inline-block}
nav.links{display:flex;gap:16px;font-size:14px;font-weight:700}nav.links a{color:var(--muted);text-decoration:none}nav.links a:hover{color:var(--ink)}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 20px;border-radius:13px;font-weight:800;font-size:15px;text-decoration:none;white-space:nowrap}
.btn.primary{color:#fff;background:linear-gradient(110deg,#16b4bb,#5478e9 61%,#8665e8);box-shadow:0 10px 23px rgba(76,106,223,.2)}
.btn.ghost{color:var(--ink);background:#fff;border:1px solid var(--line)}
.crumbs{font-size:13px;color:var(--muted);padding-top:22px}.crumbs a{color:var(--muted)}
.hero{display:grid;grid-template-columns:1.3fr .7fr;gap:34px;align-items:center;padding:30px 0 46px}
.kicker{font-size:12px;letter-spacing:1.6px;text-transform:uppercase;font-weight:800;color:var(--tone)}
h1{font:800 clamp(34px,5.2vw,54px)/1.06 Manrope,system-ui,sans-serif;letter-spacing:-1.6px;margin:10px 0 16px}
h1 span{background:var(--grad);-webkit-background-clip:text;background-clip:text;color:transparent}
.lead{font-size:clamp(17px,2vw,20px);color:var(--muted);margin:0 0 24px}
.cta{display:flex;flex-wrap:wrap;gap:10px}
.note{font-size:13px;color:var(--muted);margin-top:10px}
.phone{background:#14122a;border-radius:34px;padding:12px;max-width:270px;margin:0 auto;box-shadow:0 24px 60px rgba(30,30,70,.22)}
.phone>div{background:#fff;border-radius:24px;padding:18px 14px}
.phone h4{margin:0 0 2px;font:800 15px/1.3 Manrope,system-ui,sans-serif}.phone small{color:var(--muted);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.phone ul{list-style:none;padding:0;margin:12px 0 0;display:grid;gap:7px}
.phone li{display:flex;gap:9px;align-items:center;font-size:13px;font-weight:700;border:1px solid #ecebf5;border-radius:11px;padding:9px 10px}
.phone li::before{content:"";flex:none;width:15px;height:15px;border-radius:50%;border:2px solid var(--tone)}
.phone li:first-child::before{background:var(--tone)}
section{padding:40px 0;border-top:1px solid var(--line)}
h2{font:800 clamp(26px,3.4vw,36px)/1.15 Manrope,system-ui,sans-serif;letter-spacing:-.8px;margin:0 0 14px}
h3{font:800 18px/1.3 Manrope,system-ui,sans-serif;margin:0 0 6px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:18px}
.card{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:20px;border-top:4px solid var(--tone)}
.card p{margin:0;color:var(--muted);font-size:15px}
.tools{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-top:18px;padding:0;list-style:none}
.tools li{background:#fff;border:1px solid var(--line);border-radius:14px;padding:12px 14px;font-weight:800}
.tools li small{display:block;font-weight:500;color:var(--muted)}
ol.steps{counter-reset:s;list-style:none;padding:0;margin:18px 0 0;display:grid;gap:12px}
ol.steps li{counter-increment:s;position:relative;background:#fff;border:1px solid var(--line);border-radius:16px;padding:16px 18px 16px 62px}
ol.steps li::before{content:counter(s);position:absolute;left:18px;top:16px;width:30px;height:30px;border-radius:10px;background:var(--dark);color:#fff;display:grid;place-items:center;font-weight:800}
.check{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:8px}
.check li{padding-left:30px;position:relative}.check li::before{content:"✓";position:absolute;left:4px;font-weight:900;color:#10a99f}
details{background:#fff;border:1px solid var(--line);border-radius:14px;padding:4px 18px;margin-top:10px}
summary{cursor:pointer;font-weight:800;padding:12px 0;list-style:none}summary::-webkit-details-marker{display:none}
summary::after{content:"+";float:right;font-weight:800;color:var(--accent)}details[open] summary::after{content:"–"}
details p{color:var(--muted);margin-top:0}
.band{background:var(--dark);color:#fff;border-radius:26px;padding:34px 28px;margin:10px 0 40px}
.band h2{color:#fff}.band p{color:#d8d4f3}
.more{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:10px;margin-top:14px}
.more a{display:block;background:#fff;border:1px solid var(--line);border-radius:14px;padding:14px;text-decoration:none;color:var(--ink);font-weight:800}
.more a small{display:block;font-weight:500;color:var(--muted)}
.more a[aria-current]{border-color:var(--tone)}
footer{border-top:1px solid var(--line);padding:26px 0 40px;font-size:13px;color:var(--muted)}
footer .wrap{display:flex;flex-wrap:wrap;gap:10px 22px;justify-content:space-between}footer a{color:var(--muted)}
@media(max-width:820px){.hero{grid-template-columns:1fr}.phone{max-width:240px}}
@media(max-width:720px){nav.links{display:none}}`;

const head = (title: string, desc: string, path: string, ld: object) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
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
<meta name="twitter:card" content="summary_large_image" />
<meta name="theme-color" content="#F8FAFD" />
<link rel="icon" type="image/svg+xml" href="/todo-favicon.svg?v=20261012" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Manrope:wght@700;800&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>
<style>
${STYLE}
</style>
</head>`;

const topBar = `<header class="top"><div class="wrap">
 <a class="logo" href="/" aria-label="Arise To Do home"><i aria-hidden="true"></i><span>Arise <b>To Do</b></span></a>
 <nav class="links" aria-label="Main"><a href="/for/">Who it's for</a><a href="/for/teachers/">Teachers</a><a href="/for/business-owners/">Business</a><a href="/for/everyone/">Everyone</a><a href="/#pricing">Pricing</a><a href="/app#/signin">Sign in</a></nav>
 <a class="btn primary" href="/app#/signin?create">Get it free</a>
</div></header>`;

const footer = `<footer><div class="wrap"><span>Arise To Do · To-dos, calendar and the tools for your work and your life · Updated November 26, 2026</span><span><a href="/">Home</a> · <a href="/for/">Who it's for</a> · <a href="/#pricing">Pricing</a> · <a href="/privacy/">Privacy</a> · <a href="/terms/">Terms</a> · <a href="/app#/signin">Sign in</a></span></div></footer>`;

const allLinks = (current: string) => `<div class="more">${AUDIENCES.map((a) => `<a href="/for/${a.slug}/"${a.slug === current ? ' aria-current="page"' : ""}>${esc(a.nav)}<small>${esc(a.kicker.replace(/^For /, ""))}</small></a>`).join("")}</div>`;

export function audiencePage(a: Audience): string {
  const path = `/for/${a.slug}/`;
  const pack = a.bundle ? HUB_TEMPLATES.find((t) => t.id === a.bundle) : undefined;
  const tone = (pack as any)?.color || "#6e5ae0";
  const tools = a.bundle ? bundleTools(a.bundle) : [];
  const hub = a.bundle ? "WorkHub" : "LifeHub";
  const title = `${a.title} | Arise To Do`;
  const ld = { "@context": "https://schema.org", "@graph": [
    { "@type": "WebPage", "@id": `${SITE}${path}`, url: `${SITE}${path}`, name: title, description: a.lead, dateModified: UPDATED, isPartOf: { "@type": "WebSite", name: "Arise To Do", url: `${SITE}/` } },
    { "@type": "FAQPage", mainEntity: a.faq.map(([q, ans]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: ans } })) },
  ] };
  const setup = a.bundle
    ? [["Make your free account", "It takes a minute, with email or Sign in with Apple."], [`Open WorkHub's Plugin Gallery`, `Under <b>Bundles by job</b>, tap <b>${esc(pack!.name)}</b>, then <b>Add all</b>.`], ["Make it yours", "Hide what you don't use, add your to-dos, and connect Google Calendar from the Calendar page."]]
    : [["Make your free account", "It takes a minute, with email or Sign in with Apple."], ["Start in LifeHub", "Add your to-dos, groceries and bills. Due dates and reminders come back on their own."], ["Bring in your family and calendar", "Invite your family to FamilyHub and connect Google Calendar or your iPhone calendar."]];
  return `${head(title, a.lead, path, ld)}
<body style="--tone:${tone}">
${topBar}
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Arise To Do</a> › <a href="/for/">Who it's for</a> › <span aria-current="page">${esc(a.nav)}</span></nav>
<div class="hero">
<div>
<div class="kicker">${esc(a.kicker)}</div>
<h1>${esc(a.h1[0])}<span>${esc(a.h1[1])}</span></h1>
<p class="lead">${esc(a.lead)}</p>
<div class="cta"><a class="btn primary" href="/app#/signin?create">Get it free</a><a class="btn ghost" href="#inside">See what's inside</a></div>
<p class="note">Free to start · iPhone, Android and the web · No credit card</p>
</div>
<div class="phone" aria-label="Example: a ${esc(hub)} to-do list"><div><small>${esc(hub)} · Today</small><h4>${esc(a.nav === "Everyone" ? "My day" : `${a.nav} to-dos`)}</h4><ul>${a.sample.map((t) => `<li>${esc(t)}</li>`).join("")}</ul></div></div>
</div>

<section aria-labelledby="inside">
<h2 id="inside">Built around your day</h2>
<div class="grid">${a.pains.map(([h, p]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join("")}</div>
</section>
${tools.length ? `
<section aria-labelledby="tools">
<h2 id="tools">Your ${esc(pack!.name.toLowerCase())} toolkit, added in one tap</h2>
<p class="muted">The <b>${esc(pack!.name)}</b> bundle adds all of these to WorkHub at once. Keep the ones you use and hide the rest.</p>
<ul class="tools">${tools.map((t) => `<li>${esc(t.name)}${t.tagline ? `<small>${esc(t.tagline)}</small>` : ""}</li>`).join("")}</ul>
</section>` : ""}
<section aria-labelledby="also">
<h2 id="also">Plus everything in Arise To Do</h2>
<ul class="check">
<li>To-dos with due dates, repeats and reminders</li>
<li>A calendar that shows Google Calendar, your iPhone calendar or any calendar link</li>
${a.bundle ? "<li>Forward an email to WorkHub and it becomes a to-do</li>\n<li>WorkHub for work and LifeHub for home, one tap apart</li>" : "<li>FamilyHub: a shared calendar, chores and lists for the whole family</li>\n<li>Notes, habits, water and sleep, budget and bills</li>"}
<li>Home Screen widgets and split screen on iPhone</li>
</ul>
</section>

<section aria-labelledby="start">
<h2 id="start">Get started in three steps</h2>
<ol class="steps">${setup.map(([b, t]) => `<li><b>${b}</b>${t}</li>`).join("")}</ol>
</section>

<section aria-labelledby="faq">
<h2 id="faq">Questions people ask</h2>
${a.faq.map(([q, ans]) => `<details><summary>${esc(q)}</summary><p>${esc(ans)}</p></details>`).join("\n")}
</section>

<div class="band"><h2>Ready when you are</h2><p>Make your free account and set up ${esc(hub)} for ${esc(a.kicker.replace(/^For /, ""))} in a few minutes.</p><div class="cta"><a class="btn primary" href="/app#/signin?create">Get it free</a></div></div>

<section aria-labelledby="others">
<h2 id="others">Arise To Do for other work</h2>
${allLinks(a.slug)}
</section>
</main>
${footer}
</body>
</html>
`;
}

export function audienceIndex(): string {
  const path = "/for/";
  const title = "Who Arise To Do Is For: Every Job, and Everyone | Arise To Do";
  const desc = "Arise To Do has a version for your work: teachers, business owners, accountants, creators, trainers, agents, nurses, contractors and more, plus LifeHub for everyone.";
  const ld = { "@context": "https://schema.org", "@type": "CollectionPage", "@id": `${SITE}${path}`, url: `${SITE}${path}`, name: title, description: desc, dateModified: UPDATED,
    hasPart: AUDIENCES.map((a) => ({ "@type": "WebPage", name: a.title, url: `${SITE}/for/${a.slug}/` })) };
  return `${head(title, desc, path, ld)}
<body style="--tone:#6e5ae0">
${topBar}
<main class="wrap">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Arise To Do</a> › <span aria-current="page">Who it's for</span></nav>
<div class="hero" style="grid-template-columns:1fr">
<div>
<div class="kicker">Who it's for</div>
<h1>A to-do app <span>made for your work</span></h1>
<p class="lead">Pick your job and Arise To Do sets up WorkHub with the tools you need in one tap. Not here for work? LifeHub keeps the rest of your life on one simple list.</p>
<div class="cta"><a class="btn primary" href="/app#/signin?create">Get it free</a><a class="btn ghost" href="/for/everyone/">For everyone</a></div>
</div>
</div>
<section aria-labelledby="jobs">
<h2 id="jobs">Choose yours</h2>
${allLinks("")}
</section>
</main>
${footer}
</body>
</html>
`;
}

if (process.argv[1] && /industryPages\.ts$/.test(process.argv[1])) {
  const root = new URL("../client/public/for/", import.meta.url);
  mkdirSync(root, { recursive: true });
  writeFileSync(new URL("index.html", root), audienceIndex());
  for (const a of AUDIENCES) {
    const dir = new URL(`${a.slug}/`, root);
    mkdirSync(dir, { recursive: true });
    writeFileSync(new URL("index.html", dir), audiencePage(a));
  }
  console.log(`Wrote /for/ and ${AUDIENCES.length} pages.`);
}
