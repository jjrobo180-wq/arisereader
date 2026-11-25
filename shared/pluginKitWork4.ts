// Plugin Kit, WorkHub batch 4 (Nov 25, 2026): tools for jobs beyond teaching, so every industry bundle in the Plugin
// Gallery (shared/pluginStore.ts, HUB_TEMPLATES) has a full set: business owners, accountants, creators, trainers,
// real estate, health care, trades, salons, restaurants, sales, freelancers, nonprofits, legal and job seekers.
// Drawn by the Plugin Kit's tools (shared/pluginKit.ts): lists, checklists, daily logs and idea cards.
import type { KitDef, KitField } from "./pluginKit";

const W = { hub: "work" as const };
const f = (key: string, label: string, type: KitField["type"] = "text", extra: Partial<KitField> = {}): KitField => ({ key, label, type, ...extra });
const sel = (key: string, label: string, ...options: string[]) => f(key, label, "select", { options });
const cards = (...lines: string[]) => lines.map((t) => ({ t }));
const LIST_FEATURES = ["Add, edit and search records", "Sort and filter by status", "Saved to your account on every device"];
const CHECK_FEATURES = ["A ready-made checklist you can add to", "Tick off as you go and start over any time"];
const CARD_FEATURES = ["A new one every day", "Shuffle, browse and save favorites"];
const LOG_FEATURES = ["One tap a day", "A goal and a two-week chart"];

type L = { id: string; name: string; tagline: string; category: string; icon: string; color: string; description: string; fields: KitField[]; statuses?: string[]; sumField?: string; dueField?: string; hint?: string };
const list = (x: L): KitDef => ({ ...W, type: "list", features: [...LIST_FEATURES, ...(x.sumField ? ["A running total"] : []), ...(x.dueField ? ["What's due next, first"] : [])], ...x });
const check = (id: string, name: string, tagline: string, category: string, icon: string, color: string, description: string, items: string[]): KitDef =>
  ({ ...W, type: "checklist", id, name, tagline, category, icon, color, description, features: CHECK_FEATURES, items });
const idea = (id: string, name: string, tagline: string, category: string, icon: string, color: string, description: string, noun: string, items: string[]): KitDef =>
  ({ ...W, type: "cards", id, name, tagline, category, icon, color, description, features: CARD_FEATURES, noun, items: cards(...items) });
const log = (id: string, name: string, tagline: string, category: string, icon: string, color: string, description: string, unit: string, ask: string, step: number, max: number, goal?: number): KitDef =>
  ({ ...W, type: "log", id, name, tagline, category, icon, color, description, features: LOG_FEATURES, unit, ask, step, max, ...(goal !== undefined ? { goal } : {}) });

const B = "Business", C = "Creators & media", P = "Pros & services", T = "Trades & field", H = "Health care";

export const KIT_WORK_DEFS_4: readonly KitDef[] = [
  // ── Every business ───────────────────────────────────────────────────────────
  list({ id: "biz-clients", name: "Clients", tagline: "Who you work for and what they need", category: B, icon: "Users", color: "#2563eb",
    description: "Every client in one place: contact, what you do for them, rate and where things stand.",
    fields: [f("name", "Name"), f("company", "Company"), f("email", "Email"), f("phone", "Phone", "phone"), f("service", "Service"), f("rate", "Rate", "money"), f("next", "Next step", "date")],
    statuses: ["Lead", "Active", "Paused", "Past"], dueField: "next" }),
  list({ id: "biz-leads", name: "Leads pipeline", tagline: "From first hello to signed", category: B, icon: "TrendingUp", color: "#16a34a",
    description: "Track every lead through your pipeline with its value and the next follow-up.",
    fields: [f("name", "Lead"), f("source", "Where they came from"), f("value", "Deal value", "money"), f("follow", "Follow up", "date"), f("notes", "Notes")],
    statuses: ["New", "Contacted", "Proposal", "Won", "Lost"], sumField: "value", dueField: "follow" }),
  list({ id: "biz-expenses", name: "Business expenses", tagline: "Every cost, ready for tax time", category: B, icon: "Receipt", color: "#dc2626",
    description: "Log business expenses with a category so tax time is easy. Keep the receipts too.",
    fields: [f("item", "What"), f("amount", "Amount", "money"), f("date", "Date", "date"), sel("cat", "Category", "Supplies", "Software", "Travel", "Meals", "Advertising", "Equipment", "Rent", "Other"), f("vendor", "Paid to")],
    sumField: "amount" }),
  list({ id: "biz-sales", name: "Sales log", tagline: "What came in and from whom", category: B, icon: "CircleDollarSign", color: "#15803d",
    description: "Record each sale or payment so you always know the month's income.",
    fields: [f("customer", "Customer"), f("item", "What they bought"), f("amount", "Amount", "money"), f("date", "Date", "date"), sel("paid", "Paid by", "Card", "Cash", "Transfer", "Check", "App")],
    sumField: "amount" }),
  list({ id: "biz-inventory", name: "Stock & inventory", tagline: "What you have and what to reorder", category: B, icon: "Package", color: "#a16207",
    description: "Keep count of products and supplies, with the level to reorder at.",
    fields: [f("item", "Item"), f("sku", "SKU or code"), f("qty", "On hand", "number"), f("reorder", "Reorder at", "number"), f("cost", "Cost each", "money"), f("supplier", "Supplier")],
    statuses: ["In stock", "Low", "Ordered", "Out"] }),
  list({ id: "biz-vendors", name: "Vendors & suppliers", tagline: "Who you buy from", category: B, icon: "Truck", color: "#475569",
    description: "Suppliers and vendors with contacts, account numbers to reference and terms.",
    fields: [f("name", "Vendor"), f("contact", "Contact"), f("phone", "Phone", "phone"), f("email", "Email"), f("terms", "Terms"), f("site", "Website", "url")] }),
  list({ id: "biz-team", name: "Team roster", tagline: "Staff, roles and start dates", category: B, icon: "BadgeCheck", color: "#7c3aed",
    description: "Everyone on the team with their role, contact details and pay rate.",
    fields: [f("name", "Name"), f("role", "Role"), f("phone", "Phone", "phone"), f("email", "Email"), f("start", "Start date", "date"), f("rate", "Pay rate", "money")],
    statuses: ["Active", "Training", "On leave", "Former"] }),
  list({ id: "biz-tax-dates", name: "Tax & filing deadlines", tagline: "Never miss a due date", category: B, icon: "CalendarClock", color: "#b91c1c",
    description: "Quarterly estimates, sales tax, payroll filings and renewals, soonest first. Check dates with your tax professional.",
    fields: [f("what", "Filing"), f("due", "Due", "date"), f("amount", "Amount", "money"), f("notes", "Notes")], statuses: ["To do", "Filed", "Paid"], dueField: "due", sumField: "amount" }),
  log("biz-revenue-day", "Daily revenue", "One number a day", B, "BarChart3", "#16a34a", "Log the day's takings and watch the two-week trend.", "dollars", "How much came in today?", 10, 100000),
  check("biz-launch", "Start a business checklist", "From idea to open", B, "Rocket", "#ea580c", "The usual first steps for a new small business. Rules differ by place, so check yours.",
    ["Write a one-page plan", "Pick and check the business name", "Choose a structure (sole proprietor, LLC…)", "Register the business", "Get a tax ID if you need one", "Open a business bank account", "Get any licenses and permits", "Set up bookkeeping", "Get insurance", "Set prices", "Make a simple website or page", "Tell your first ten customers"]),
  check("biz-month-end", "Month-end close", "Close the books each month", B, "CheckCheck", "#0f766e", "Everything to finish before a month is done.",
    ["Record every sale and payment", "Enter every expense and receipt", "Reconcile the bank account", "Reconcile credit cards", "Follow up on unpaid invoices", "Pay bills that are due", "Run payroll if you have staff", "Check inventory counts", "Review profit and loss", "Set money aside for taxes", "Back up your files"]),
  idea("biz-growth-ideas", "Growth ideas", "One idea to try this week", B, "Lightbulb", "#f59e0b", "A practical idea for finding or keeping customers.", "idea",
    ["Ask your three happiest customers for a review.", "Follow up with everyone who got a quote but didn't buy.", "Offer a referral thank-you to current customers.", "Post a before-and-after of real work.", "Partner with a business that serves the same people.", "Send a short, useful email to past customers.", "Make one offer just for returning customers.", "Answer the five questions customers ask most on your site.", "Show up at one local event this month.", "Update your hours and photos on your map listing.", "Raise the price of your most popular item a little.", "Bundle two things people often buy together.", "Call a past customer just to check in.", "Write down your best customer: who they are and where they hang out."]),

  // ── Accounting & bookkeeping ─────────────────────────────────────────────────
  list({ id: "acct-billable", name: "Billable hours", tagline: "Time by client, ready to bill", category: P, icon: "Clock", color: "#0369a1",
    description: "Log time by client and task, then total it up for the invoice.",
    fields: [f("client", "Client"), f("task", "Work done"), f("date", "Date", "date"), f("hours", "Hours", "number"), f("rate", "Rate", "money")], statuses: ["Not billed", "Billed", "Paid"], sumField: "hours" }),
  list({ id: "acct-returns", name: "Tax return tracker", tagline: "Every return through the season", category: P, icon: "FileCheck", color: "#1d4ed8",
    description: "Each client's return from documents in to filed and accepted.",
    fields: [f("client", "Client"), sel("type", "Return", "Individual", "Business", "Partnership", "Nonprofit", "Amended", "Extension"), f("due", "Due", "date"), f("fee", "Fee", "money"), f("missing", "Still missing")],
    statuses: ["Waiting on docs", "In progress", "Review", "Signed", "Filed", "Accepted"], dueField: "due", sumField: "fee" }),
  list({ id: "acct-docs", name: "Client documents needed", tagline: "Who still owes you what", category: P, icon: "FolderOpen", color: "#7c3aed",
    description: "The documents you're waiting for from each client, with the date you asked.",
    fields: [f("client", "Client"), f("doc", "Document"), f("asked", "Asked on", "date"), f("chase", "Chase again", "date")], statuses: ["Requested", "Received"], dueField: "chase" }),
  check("acct-tax-season", "Tax season prep", "Ready before the rush", P, "ClipboardCheck", "#1e40af", "Get your practice ready for tax season.",
    ["Renew software and licenses", "Update engagement letters", "Send organizers to returning clients", "Update your fee schedule", "Check e-file and signature setup", "Set the document upload process", "Plan your calendar and cut-off dates", "Line up seasonal help", "Review new rules for this year", "Back up last year's files", "Set extension rules and dates", "Prepare reminder emails"]),
  check("acct-new-client", "New client onboarding", "Start every client the same way", P, "UserPlus", "#0891b2", "Steps for bringing on a new bookkeeping or tax client.",
    ["Signed engagement letter", "Contact details and best way to reach them", "Prior returns or financials", "Bank and card access or statements", "Chart of accounts set up", "Payroll details if any", "Key dates and deadlines", "Fee and billing schedule agreed", "Secure document sharing set up", "First meeting booked"]),

  // ── Social media creators ────────────────────────────────────────────────────
  list({ id: "cr-content", name: "Content calendar", tagline: "Idea to posted, every platform", category: C, icon: "CalendarRange", color: "#db2777",
    description: "Plan every post from idea to filmed to posted, with the platform and the day it goes up.",
    fields: [f("title", "Post"), sel("platform", "Platform", "TikTok", "Instagram", "YouTube", "Shorts", "Facebook", "X", "LinkedIn", "Pinterest", "Twitch", "Podcast", "Blog"), f("post", "Post date", "date"), f("hook", "Hook"), f("notes", "Notes")],
    statuses: ["Idea", "Scripted", "Filmed", "Edited", "Scheduled", "Posted"], dueField: "post" }),
  list({ id: "cr-deals", name: "Brand deals", tagline: "Sponsorships and what you owe them", category: C, icon: "Handshake", color: "#9333ea",
    description: "Every brand deal: deliverables, rate, due dates and whether you've been paid.",
    fields: [f("brand", "Brand"), f("contact", "Contact"), f("deliverables", "Deliverables"), f("rate", "Rate", "money"), f("due", "Due", "date"), f("usage", "Usage rights")],
    statuses: ["Pitched", "Negotiating", "Signed", "Delivered", "Paid"], sumField: "rate", dueField: "due" }),
  list({ id: "cr-collabs", name: "Collabs", tagline: "Creators to work with", category: C, icon: "Users", color: "#c026d3",
    description: "Creators you want to collab with, what you'd make together and where it stands.",
    fields: [f("name", "Creator"), f("handle", "Handle"), f("platform", "Platform"), f("idea", "Collab idea"), f("date", "Shoot date", "date")], statuses: ["Idea", "Reached out", "Planned", "Done"] }),
  list({ id: "cr-hashtags", name: "Hashtag & keyword sets", tagline: "Ready-to-paste sets by topic", category: C, icon: "Hash", color: "#0ea5e9",
    description: "Save hashtag and keyword sets by topic so posting takes seconds.",
    fields: [f("topic", "Topic"), f("tags", "Hashtags or keywords"), f("platform", "Platform")] }),
  log("cr-followers", "Follower count", "Watch your growth", C, "TrendingUp", "#e11d48", "Log your follower count and see the two-week trend.", "followers", "Followers today?", 1, 100000000),
  log("cr-posts-day", "Posts published", "Show up consistently", C, "Send", "#f97316", "Count what you post each day and keep a steady rhythm.", "posts", "How many posts today?", 1, 20, 1),
  idea("cr-hooks", "Hook ideas", "Stop the scroll in two seconds", C, "Zap", "#facc15", "An opening line to start a short video or post.", "hook",
    ["Nobody talks about this, but…", "I tried this for 30 days. Here's what happened.", "Stop doing this if you want…", "Three things I wish I knew before…", "This is your sign to…", "The cheapest way to…", "You're doing it wrong. Here's the fix.", "Watch this before you buy…", "I was today years old when I learned…", "POV: you finally…", "Here's exactly how I…", "Don't scroll if you…", "Rating every … so you don't have to.", "The one change that made the biggest difference:"]),
  idea("cr-content-ideas", "Content ideas", "Never stare at a blank page", C, "Sparkles", "#a855f7", "A content format to try in your niche.", "idea",
    ["A day in my life, start to finish.", "Answer a comment with a video.", "Before and after.", "A myth in your niche, busted.", "Your setup or what's in your bag.", "A quick tutorial in under 60 seconds.", "Behind the scenes of making a post.", "Reacting to a trend in your niche.", "Your top three tools or products.", "A mistake you made and what you learned.", "Your process, sped up.", "Q&A from your followers.", "A story time with a lesson.", "Things in your niche that are worth the money (and aren't)."]),
  check("cr-post-checklist", "Before you post", "Every post, polished", C, "ListChecks", "#be185d", "A quick check before anything goes live.",
    ["Hook in the first two seconds", "Captions on the video", "Sound or music cleared", "Clear call to action", "Caption written and proofread", "Hashtags or keywords added", "Thumbnail or cover picked", "Tagged brands or collaborators", "Ad or sponsor disclosure if paid", "Posted at your best time", "Reply to the first comments"]),

  // ── Personal trainers & coaches ──────────────────────────────────────────────
  list({ id: "pt-clients", name: "Training clients", tagline: "Goals, packages and sessions left", category: P, icon: "Dumbbell", color: "#ea580c",
    description: "Each client's goal, package and how many sessions are left.",
    fields: [f("name", "Client"), f("goal", "Goal"), f("package", "Package"), f("left", "Sessions left", "number"), f("renew", "Renews", "date"), f("phone", "Phone", "phone")],
    statuses: ["Trial", "Active", "Paused", "Past"], dueField: "renew" }),
  list({ id: "pt-sessions", name: "Session log", tagline: "Every session, paid or not", category: P, icon: "CalendarCheck", color: "#c2410c",
    description: "Log each session with the client, what you did and payment.",
    fields: [f("client", "Client"), f("date", "Date", "date"), f("focus", "Focus"), f("price", "Price", "money"), f("notes", "Notes")], statuses: ["Booked", "Done", "No-show", "Paid"], sumField: "price" }),
  list({ id: "pt-classes", name: "Class schedule", tagline: "Group classes and spots left", category: P, icon: "CalendarDays", color: "#f97316",
    description: "Group classes with the time, place and how many spots are taken.",
    fields: [f("class", "Class"), f("date", "Date", "date"), f("time", "Time", "time"), f("place", "Where"), f("spots", "Spots taken", "number")], dueField: "date" }),
  check("pt-intake", "New client intake", "Start every client safely", P, "ClipboardList", "#9a3412", "What to cover with a new training client. Ask clients to check with a doctor when needed.",
    ["Health questionnaire (PAR-Q) completed", "Waiver signed", "Goals written down", "Injuries and limits noted", "Starting measurements", "Movement screen", "Schedule and package agreed", "Payment set up", "First program written", "Check-in day set"]),
  idea("pt-workout-ideas", "Workout finishers", "End sessions strong", P, "Flame", "#dc2626", "A short finisher to end a training session. Scale to the client.", "finisher",
    ["10 minutes: as many rounds as possible of 10 squats, 10 push-ups, 10 rows.", "Farmer carry 4 × 40 metres.", "Tabata bike: 20 seconds hard, 10 easy, 8 rounds.", "Plank ladder: 20, 30, 40 seconds with 20 seconds rest.", "Sled push 6 × 20 metres.", "Every minute for 8 minutes: 8 kettlebell swings.", "Wall sit 3 × 45 seconds.", "Battle ropes 30 on, 30 off, 6 rounds.", "Burpee pyramid 1 to 5 and back.", "Walking lunges 3 × 20 steps.", "Dead bug 3 × 10 each side.", "Row 500 metres for time.", "Bear crawl 4 × 15 metres.", "Medicine ball slams 5 × 10."]),

  // ── Real estate ──────────────────────────────────────────────────────────────
  list({ id: "re-listings", name: "Listings", tagline: "Every property you're selling", category: P, icon: "Home", color: "#0d9488",
    description: "Your listings with price, key dates and status.",
    fields: [f("address", "Address"), f("seller", "Seller"), f("price", "List price", "money"), f("listed", "Listed", "date"), f("close", "Closing", "date"), f("notes", "Notes")],
    statuses: ["Coming soon", "Active", "Under contract", "Sold", "Withdrawn"], dueField: "close", sumField: "price" }),
  list({ id: "re-buyers", name: "Buyers", tagline: "What each buyer is looking for", category: P, icon: "Users", color: "#0f766e",
    description: "Buyers with their budget, must-haves and pre-approval.",
    fields: [f("name", "Buyer"), f("phone", "Phone", "phone"), f("budget", "Budget", "money"), f("areas", "Areas"), f("needs", "Must-haves"), f("preapproved", "Pre-approved until", "date")],
    statuses: ["New", "Searching", "Offer out", "Under contract", "Closed"] }),
  list({ id: "re-showings", name: "Showings", tagline: "Who's seeing what, when", category: P, icon: "MapPinned", color: "#14b8a6",
    description: "Showings with the property, buyer, time and feedback.",
    fields: [f("address", "Property"), f("buyer", "Buyer"), f("date", "Date", "date"), f("time", "Time", "time"), f("feedback", "Feedback")], dueField: "date" }),
  check("re-closing", "Contract to close", "Every step to the closing table", P, "KeyRound", "#115e59", "The usual steps from accepted offer to keys. Your contract's dates come first.",
    ["Earnest money deposited", "Inspection scheduled", "Inspection response sent", "Appraisal ordered", "Loan approval in", "Title work ordered", "HOA documents delivered", "Repairs done and checked", "Final walk-through", "Closing disclosure reviewed", "Utilities transfer reminder sent", "Closing time and place confirmed"]),
  check("re-open-house", "Real estate open house", "Ready before the doors open", P, "DoorOpen", "#0e7490", "Everything for a smooth open house.",
    ["Signs out early", "Lights on and blinds open", "Sign-in sheet or QR code", "Flyers and info sheets", "Water and snacks", "Valuables put away", "Temperature comfortable", "Follow-up plan for visitors", "Thank the sellers", "Send visitor follow-ups the same day"]),

  // ── Health care ──────────────────────────────────────────────────────────────
  list({ id: "hc-shifts", name: "Shift log", tagline: "Hours, units and overtime", category: H, icon: "Clock", color: "#0284c7",
    description: "Log your shifts with the unit and hours so pay and overtime are easy to check. No patient details here.",
    fields: [f("date", "Date", "date"), f("unit", "Unit or site"), sel("shift", "Shift", "Day", "Evening", "Night", "On call"), f("hours", "Hours", "number")], sumField: "hours" }),
  list({ id: "hc-ce", name: "CE credits", tagline: "Continuing education toward renewal", category: H, icon: "GraduationCap", color: "#2563eb",
    description: "Courses and credits toward your license renewal.",
    fields: [f("course", "Course"), f("provider", "Provider"), f("date", "Completed", "date"), f("hours", "Credit hours", "number")], sumField: "hours" }),
  list({ id: "hc-certs", name: "Licenses & certifications", tagline: "Renew before they lapse", category: H, icon: "BadgeCheck", color: "#1d4ed8",
    description: "Licenses and certifications (BLS, ACLS and so on) with expiry dates, soonest first.",
    fields: [f("cert", "License or certification"), f("number", "Number"), f("expires", "Expires", "date")], statuses: ["Current", "Renewing", "Expired"], dueField: "expires" }),
  check("hc-shift-start", "Start of shift", "Settle in before it gets busy", H, "Stethoscope", "#0369a1", "A personal start-of-shift routine. Your unit's policies come first.",
    ["Badge, pens and tools", "Water bottle and a snack", "Get report", "Check assignments", "Check equipment and supplies", "Review orders and times due", "Plan your first hour", "Know who to call for help", "Note break times", "Breathe for one minute"]),
  idea("hc-self-care", "Care for the carer", "Something for you after a long shift", H, "HeartHandshake", "#e11d48", "A small way to recover after shifts.", "idea",
    ["Eat a real meal before you sleep.", "Write down one thing that went well today.", "Take your shoes off and put your feet up for ten minutes.", "Shower and change before you sit down at home.", "Text a coworker who had a hard shift.", "Block out light for day sleep after nights.", "Drink a glass of water now.", "Leave work at the door: name one thing you're letting go.", "Take a slow walk on a day off.", "Say no to one extra shift this month.", "Talk to someone about a hard case.", "Plan something to look forward to.", "Stretch your back and calves for five minutes.", "Go to bed at the same time three nights in a row."]),

  // ── Trades & field work ──────────────────────────────────────────────────────
  list({ id: "tr-jobs", name: "Jobs", tagline: "Every job from quote to paid", category: T, icon: "Hammer", color: "#b45309",
    description: "Jobs with the customer, address, price and stage.",
    fields: [f("customer", "Customer"), f("address", "Address"), f("work", "Work"), f("price", "Price", "money"), f("start", "Start", "date"), f("phone", "Phone", "phone")],
    statuses: ["Quote", "Booked", "In progress", "Done", "Invoiced", "Paid"], sumField: "price", dueField: "start" }),
  list({ id: "tr-estimates", name: "Estimates & bids", tagline: "What you quoted and whether it landed", category: T, icon: "Calculator", color: "#d97706",
    description: "Estimates with materials, labor and the follow-up date.",
    fields: [f("customer", "Customer"), f("job", "Job"), f("materials", "Materials", "money"), f("labor", "Labor", "money"), f("total", "Total", "money"), f("follow", "Follow up", "date")],
    statuses: ["Sent", "Accepted", "Declined"], sumField: "total", dueField: "follow" }),
  list({ id: "tr-materials", name: "Materials list", tagline: "What to buy for the job", category: T, icon: "ShoppingCart", color: "#92400e",
    description: "Materials by job with quantity and cost, ticked off as you buy them.",
    fields: [f("item", "Item"), f("job", "Job"), f("qty", "Quantity", "number"), f("cost", "Cost", "money"), f("store", "Where")], statuses: ["Need", "Bought", "On site"], sumField: "cost" }),
  list({ id: "tr-tools", name: "Tool inventory", tagline: "Who has which tool", category: T, icon: "Wrench", color: "#57534e",
    description: "Your tools with serial numbers and where they are, handy for insurance too.",
    fields: [f("tool", "Tool"), f("serial", "Serial number"), f("value", "Value", "money"), f("with", "Who has it")], statuses: ["In the truck", "On site", "Loaned", "Repair"], sumField: "value" }),
  list({ id: "biz-mileage", name: "Mileage log", tagline: "Every work trip, for tax time", category: T, icon: "Car", color: "#0f766e",
    description: "Work trips with miles and purpose. Keep it up as you go; check your country's rules for deductions.",
    fields: [f("date", "Date", "date"), f("from", "From"), f("to", "To"), f("miles", "Miles", "number"), f("purpose", "Purpose")], sumField: "miles" }),
  check("tr-site-safety", "Job site safety", "Check before work starts", T, "ShieldCheck", "#ca8a04", "A start-of-day safety check. Follow your local safety rules and your employer's.",
    ["Hard hat, glasses, gloves and boots", "Hazards walked and noted", "Ladders and scaffolds checked", "Power and cords checked", "Lockout and tagout where needed", "Fall protection in place", "First aid kit stocked", "Fire extinguisher on site", "Everyone knows the emergency plan", "Site tidy and paths clear"]),

  // ── Salons, barbers & beauty ─────────────────────────────────────────────────
  list({ id: "sa-clients", name: "Salon clients", tagline: "Formulas, preferences and last visit", category: P, icon: "Scissors", color: "#db2777",
    description: "Each client's services, color formula, preferences and when they're due back.",
    fields: [f("name", "Client"), f("phone", "Phone", "phone"), f("service", "Usual service"), f("formula", "Formula or notes"), f("next", "Due back", "date")], dueField: "next" }),
  list({ id: "sa-services", name: "Service menu", tagline: "Prices and times", category: P, icon: "Sparkles", color: "#e879f9",
    description: "Your services with price and how long each takes.",
    fields: [f("service", "Service"), f("price", "Price", "money"), f("minutes", "Minutes", "number"), f("notes", "Notes")] }),
  log("sa-tips", "Tips", "Track tips by day", P, "HandCoins", "#16a34a", "Log the day's tips and watch the two-week trend.", "dollars", "Tips today?", 1, 5000),

  // ── Restaurants & food service ───────────────────────────────────────────────
  check("fs-opening", "Opening checklist", "Ready for the first guest", B, "DoorOpen", "#ea580c", "Open the same way every day.",
    ["Lights, music and heat or air on", "Check fridge and freezer temperatures", "Prep list printed", "Prep done for the first rush", "Stations stocked", "Floors and tables clean", "Restrooms checked", "Register and card machine ready", "Menu specials set", "Team briefed", "Doors unlocked on time"]),
  check("fs-closing", "Closing checklist", "Close clean, open easy", B, "DoorClosed", "#9a3412", "Close the same way every night.",
    ["Food labeled, dated and stored", "Fridge and freezer temperatures logged", "Equipment off and cleaned", "Floors swept and mopped", "Trash and recycling out", "Dishes done", "Register counted and closed", "Deposit ready", "Doors and windows locked", "Alarm set"]),
  list({ id: "fs-temps", name: "Temperature log", tagline: "Fridges, freezers and hot holding", category: B, icon: "Gauge", color: "#0891b2",
    description: "Record temperatures with the time and who checked. Follow your local food safety rules.",
    fields: [f("unit", "Fridge, freezer or dish"), f("temp", "Temperature", "number"), f("date", "Date", "date"), f("time", "Time", "time"), f("by", "Checked by")], statuses: ["OK", "Fixed", "Thrown out"] }),
  list({ id: "fs-orders", name: "Supplier orders", tagline: "What's ordered and when it lands", category: B, icon: "Truck", color: "#4d7c0f",
    description: "Orders by supplier with the delivery day and total.",
    fields: [f("supplier", "Supplier"), f("items", "Items"), f("total", "Total", "money"), f("arrives", "Arrives", "date")], statuses: ["To order", "Ordered", "Received"], sumField: "total", dueField: "arrives" }),

  // ── Sales ────────────────────────────────────────────────────────────────────
  log("sa-calls", "Calls made", "Activity drives results", B, "PhoneCall", "#2563eb", "Count your calls each day toward a goal.", "calls", "Calls made today?", 1, 300, 40),
  idea("sa-objections", "Objection handling", "Answers to the usual pushback", B, "MessageCircle", "#4f46e5", "A way to answer a common sales objection. Make it yours.", "answer",
    ["It's too expensive: What would it need to do for the price to make sense?", "We're happy with who we use: What would you change about them if you could?", "Send me some information: Happy to. What should it cover so it's worth your time?", "Now isn't a good time: When would be, and what changes by then?", "I need to talk to my partner: Of course. What do you think they'll ask?", "We don't have the budget: When does your budget reset, and who sets it?", "I'm not interested: Fair enough. What do you use for this today?", "Let me think about it: Sure. What's the part you're still weighing?", "We tried something like this before: What happened? What would be different this time?", "Your competitor is cheaper: What else are you comparing besides price?", "Call me next quarter: Will do. What will be different then?", "We're too small for this: Who else your size do you think it helps?", "I don't have time to switch: How much time does the current way cost each week?", "Can you do a discount? What could you commit to that would make a better price possible?"]),

  // ── Freelancers & creatives ──────────────────────────────────────────────────
  list({ id: "fr-projects", name: "Projects", tagline: "Every gig from brief to paid", category: P, icon: "Briefcase", color: "#6d28d9",
    description: "Projects with the client, fee, deadline and stage.",
    fields: [f("project", "Project"), f("client", "Client"), f("fee", "Fee", "money"), f("due", "Deadline", "date"), f("brief", "Brief")],
    statuses: ["Pitched", "Booked", "In progress", "In review", "Delivered", "Paid"], sumField: "fee", dueField: "due" }),
  list({ id: "fr-pitches", name: "Pitches", tagline: "Who you've pitched and the follow-up", category: P, icon: "Send", color: "#8b5cf6",
    description: "Pitches you've sent and when to follow up.",
    fields: [f("to", "Pitched to"), f("idea", "Idea"), f("sent", "Sent", "date"), f("follow", "Follow up", "date")], statuses: ["Sent", "Replied", "Yes", "No"], dueField: "follow" }),
  list({ id: "fr-portfolio", name: "Portfolio pieces", tagline: "Your best work, ready to share", category: P, icon: "Image", color: "#a855f7",
    description: "Work to show off, with links and what it proves.",
    fields: [f("title", "Piece"), f("client", "Client"), f("link", "Link", "url"), f("shows", "What it shows")] }),

  // ── Nonprofits & ministry ────────────────────────────────────────────────────
  list({ id: "np-donors", name: "Donors", tagline: "Gifts, thank-yous and next asks", category: B, icon: "HandHeart", color: "#e11d48",
    description: "Donors with their gifts, when you thanked them and the next touch.",
    fields: [f("name", "Donor"), f("email", "Email"), f("gift", "Gift", "money"), f("date", "Date", "date"), f("next", "Next touch", "date")], statuses: ["Prospect", "First gift", "Repeat", "Major", "Lapsed"], sumField: "gift", dueField: "next" }),
  list({ id: "np-events", name: "Events", tagline: "Fundraisers, services and drives", category: B, icon: "PartyPopper", color: "#f43f5e",
    description: "Events with the date, place, lead and goal.",
    fields: [f("event", "Event"), f("date", "Date", "date"), f("place", "Where"), f("lead", "Lead"), f("goal", "Goal", "money")], statuses: ["Planning", "Promoting", "Done"], dueField: "date" }),

  // ── Legal ────────────────────────────────────────────────────────────────────
  list({ id: "lg-matters", name: "Matters", tagline: "Cases and their next deadline", category: P, icon: "Scale", color: "#334155",
    description: "Matters by client with the next deadline. Keep privileged details in your firm's system.",
    fields: [f("matter", "Matter"), f("client", "Client"), f("court", "Court or venue"), f("deadline", "Next deadline", "date"), f("task", "What's due")],
    statuses: ["Intake", "Open", "Waiting", "Closed"], dueField: "deadline" }),

  // ── Job seekers ──────────────────────────────────────────────────────────────
  list({ id: "js-applications", name: "Job applications", tagline: "Every application and its next step", category: B, icon: "BriefcaseBusiness", color: "#0ea5e9",
    description: "Jobs you've applied for with the stage and next step.",
    fields: [f("role", "Role"), f("company", "Company"), f("link", "Posting", "url"), f("applied", "Applied", "date"), f("next", "Next step", "date"), f("contact", "Contact")],
    statuses: ["Saved", "Applied", "Interview", "Offer", "No"], dueField: "next" }),
  idea("js-interview-questions", "Interview practice", "Questions to rehearse", B, "MessageSquareText", "#0284c7", "A common interview question to practice out loud.", "question",
    ["Tell me about yourself.", "Why do you want this job?", "What's your greatest strength?", "Tell me about a time you made a mistake.", "Describe a conflict with a coworker and how you handled it.", "Where do you see yourself in three years?", "Why are you leaving your current job?", "Tell me about a project you're proud of.", "How do you handle a tight deadline?", "What would your last manager say about you?", "Tell me about a time you led without the title.", "What questions do you have for us?", "How do you learn something new fast?", "Why should we hire you?"]),
];
