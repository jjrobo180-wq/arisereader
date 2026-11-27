// The chore catalog for the Chores plugin (client/src/components/family-hub/Chores.tsx): every everyday job a
// home has, by room or area, each with an emoji, about how long it takes and how often most people do it.
// Tapping one adds it to the person's chores (shared/familyHub.ts Chore) with that frequency, which they can change.
import type { Chore, ChoreUnit } from "./familyHub";

export type ChoreCategory = { id: string; name: string; emoji: string; color: string };
/** How often, as tapped in the frequency picker. */
export type ChoreFreq = { unit: ChoreUnit; every: number; days?: number[]; flex?: boolean };
export type CatalogChore = { id: string; title: string; icon: string; mins: number; cat: string; freq: string };

export const CHORE_CATEGORIES: ChoreCategory[] = [
  { id: "kitchen", name: "Kitchen", emoji: "🍳", color: "#f59e0b" },
  { id: "bathroom", name: "Bathroom", emoji: "🛁", color: "#06b6d4" },
  { id: "bedroom", name: "Bedroom", emoji: "🛏️", color: "#8b5cf6" },
  { id: "living", name: "Living room", emoji: "🛋️", color: "#ec4899" },
  { id: "laundry", name: "Laundry", emoji: "🧺", color: "#3b82f6" },
  { id: "floors", name: "Floors", emoji: "🧹", color: "#a16207" },
  { id: "dining", name: "Dining", emoji: "🍽️", color: "#f97316" },
  { id: "entry", name: "Entry & closets", emoji: "🚪", color: "#64748b" },
  { id: "office", name: "Desk & office", emoji: "🖥️", color: "#0ea5e9" },
  { id: "trash", name: "Trash & recycling", emoji: "🗑️", color: "#16a34a" },
  { id: "kids", name: "Kids", emoji: "🧸", color: "#f43f5e" },
  { id: "pets", name: "Pets", emoji: "🐾", color: "#d97706" },
  { id: "plants", name: "Plants", emoji: "🪴", color: "#22c55e" },
  { id: "yard", name: "Yard & outdoors", emoji: "🌳", color: "#15803d" },
  { id: "garage", name: "Garage & storage", emoji: "🧰", color: "#78716c" },
  { id: "car", name: "Car", emoji: "🚗", color: "#ef4444" },
  { id: "upkeep", name: "Home upkeep", emoji: "🔧", color: "#475569" },
  { id: "safety", name: "Safety", emoji: "🧯", color: "#dc2626" },
  { id: "errands", name: "Errands & shopping", emoji: "🛒", color: "#7c3aed" },
  { id: "admin", name: "Bills & paperwork", emoji: "📬", color: "#0891b2" },
  { id: "tech", name: "Phone & tech", emoji: "📱", color: "#2563eb" },
  { id: "self", name: "Personal reset", emoji: "✨", color: "#a855f7" },
  { id: "seasonal", name: "Seasonal", emoji: "🍂", color: "#ea580c" },
  { id: "deep", name: "Deep clean", emoji: "🧽", color: "#0d9488" },
];

/** Frequency codes in the catalog: d daily, wd weekdays, 2d/3d every 2 or 3 days, w weekly, 2w every 2 weeks, m monthly, 3m/6m, y yearly. */
export const FREQ_CODES: Record<string, ChoreFreq> = {
  d: { unit: "week", every: 1 },
  wd: { unit: "week", every: 1, days: [1, 2, 3, 4, 5] },
  we: { unit: "week", every: 1, days: [0, 6] },
  "2d": { unit: "day", every: 2 },
  "3d": { unit: "day", every: 3, flex: true },
  w: { unit: "week", every: 1, flex: true },
  "2w": { unit: "week", every: 2, flex: true },
  m: { unit: "month", every: 1, flex: true },
  "3m": { unit: "month", every: 3, flex: true },
  "6m": { unit: "month", every: 6, flex: true },
  y: { unit: "month", every: 12, flex: true },
};

// [title, emoji, minutes, frequency code]
type Row = [string, string, number, string];
const RAW: Record<string, Row[]> = {
  kitchen: [
    ["Wash the dishes", "🍽️", 15, "d"], ["Load the dishwasher", "🫧", 5, "d"], ["Unload the dishwasher", "🥣", 5, "d"],
    ["Wipe the counters", "🧽", 5, "d"], ["Clean the stovetop", "🔥", 8, "2d"], ["Wipe the sink and faucet", "🚰", 4, "d"],
    ["Clear out the fridge leftovers", "🥡", 10, "w"], ["Wipe the fridge shelves", "🧊", 20, "m"], ["Clean the microwave", "🍲", 6, "w"],
    ["Wipe the cabinet fronts", "🚪", 15, "m"], ["Clean the oven", "♨️", 40, "3m"], ["Descale the coffee maker", "☕", 10, "m"],
    ["Clean the toaster crumbs", "🍞", 3, "m"], ["Run a cleaning cycle on the dishwasher", "🔁", 5, "m"], ["Wipe the small appliances", "🔌", 8, "2w"],
    ["Organize the pantry", "🥫", 25, "3m"], ["Check for expired food", "📅", 10, "2w"], ["Clean the range hood filter", "🌬️", 15, "3m"],
    ["Sanitize the sponge or swap it", "🧼", 2, "w"], ["Wash the dish towels", "🧻", 3, "2d"], ["Sweep the kitchen floor", "🧹", 5, "d"],
    ["Mop the kitchen floor", "🪣", 12, "w"], ["Clean the garbage disposal", "🍋", 4, "2w"], ["Wipe the light switches and handles", "💡", 4, "w"],
    ["Plan this week's meals", "📝", 15, "w"], ["Prep lunches for tomorrow", "🥪", 15, "wd"], ["Meal prep for the week", "🍱", 60, "w"],
    ["Clean out the freezer", "❄️", 25, "6m"], ["Wipe the table after dinner", "🍴", 3, "d"], ["Put the groceries away", "🛍️", 10, "w"],
    ["Clean the cutting boards", "🔪", 4, "w"], ["Clean behind the fridge", "🧲", 20, "6m"],
  ],
  bathroom: [
    ["Wipe the bathroom sink", "🚰", 3, "d"], ["Clean the toilet", "🚽", 8, "w"], ["Quick toilet swish", "🌀", 2, "2d"],
    ["Scrub the shower or tub", "🛁", 20, "w"], ["Squeegee the shower glass", "🚿", 2, "d"], ["Clean the mirror", "🪞", 3, "w"],
    ["Swap in fresh towels", "🧖", 3, "w"], ["Wash the bath mat", "🟫", 3, "2w"], ["Empty the bathroom trash", "🗑️", 2, "w"],
    ["Restock toilet paper", "🧻", 2, "w"], ["Mop the bathroom floor", "🪣", 8, "w"], ["Clean the grout", "🧱", 30, "3m"],
    ["Wash the shower curtain", "🌊", 10, "3m"], ["Declutter the bathroom drawers", "🗄️", 15, "3m"], ["Toss expired medicine and products", "💊", 10, "6m"],
    ["Clean the toothbrush holder", "🪥", 3, "2w"], ["Replace your toothbrush", "🦷", 2, "3m"], ["Clean the exhaust fan", "💨", 10, "6m"],
    ["Unclog and freshen the drains", "🌀", 5, "m"], ["Wipe the cabinet and handles", "✨", 5, "2w"],
  ],
  bedroom: [
    ["Make the bed", "🛏️", 2, "d"], ["Change the sheets", "🧺", 15, "w"], ["Put clothes away", "👕", 8, "d"],
    ["Clear the nightstand", "🕯️", 3, "w"], ["Dust the bedroom", "🪶", 10, "w"], ["Vacuum the bedroom", "🧹", 10, "w"],
    ["Flip or rotate the mattress", "🔄", 10, "6m"], ["Wash the pillows", "☁️", 5, "6m"], ["Wash the duvet or comforter", "🌙", 5, "3m"],
    ["Declutter the closet", "👗", 30, "3m"], ["Donate clothes you don't wear", "🎁", 20, "6m"], ["Organize the dresser", "🗃️", 20, "3m"],
    ["Clean under the bed", "📦", 15, "3m"], ["Open the windows to air out", "🪟", 1, "d"], ["Tidy the bedroom floor", "🧦", 5, "d"],
  ],
  living: [
    ["Reset the living room", "🛋️", 5, "d"], ["Fluff and fold the throws", "🧣", 2, "d"], ["Dust the shelves", "🪶", 10, "w"],
    ["Vacuum the couch", "🛋️", 10, "2w"], ["Wipe the coffee table", "☕", 2, "d"], ["Dust the TV and electronics", "📺", 5, "w"],
    ["Clean the remote controls", "🎮", 3, "2w"], ["Wash the throw pillow covers", "🟪", 10, "m"], ["Clean the windows", "🪟", 20, "m"],
    ["Wipe the baseboards", "📏", 20, "m"], ["Dust the ceiling fan", "🌀", 5, "m"], ["Wash the curtains", "🎭", 15, "6m"],
    ["Organize books and games", "📚", 15, "m"], ["Deep clean the couch cushions", "🧽", 30, "6m"], ["Clean the fireplace", "🔥", 25, "3m"],
  ],
  laundry: [
    ["Start a load of laundry", "🧺", 3, "2d"], ["Move laundry to the dryer", "🌀", 2, "2d"], ["Fold the clean laundry", "👚", 15, "2d"],
    ["Put the laundry away", "🗄️", 8, "2d"], ["Wash the towels", "🧖", 3, "w"], ["Wash workout clothes", "🏃", 3, "2d"],
    ["Iron or steam tomorrow's outfit", "👔", 8, "wd"], ["Clean the lint trap", "🧶", 1, "2d"], ["Clean the washing machine", "🫧", 10, "m"],
    ["Wash the reusable bags", "🛍️", 3, "m"], ["Sort the sock pile", "🧦", 10, "w"], ["Treat stains", "🧴", 5, "w"],
    ["Take things to the dry cleaner", "🧥", 15, "m"], ["Mend or sew a button", "🪡", 10, "m"], ["Clean the dryer vent", "🔥", 20, "6m"],
  ],
  floors: [
    ["Sweep the main floors", "🧹", 10, "2d"], ["Vacuum the house", "🌀", 25, "w"], ["Mop the hard floors", "🪣", 20, "w"],
    ["Run the robot vacuum", "🤖", 1, "d"], ["Empty the vacuum", "🗑️", 2, "w"], ["Spot clean the rugs", "🟫", 10, "2w"],
    ["Shake out the doormats", "🚪", 3, "w"], ["Vacuum the stairs", "🪜", 10, "w"], ["Deep clean the carpets", "💦", 60, "6m"],
    ["Clean the vacuum filter and brush", "🧹", 10, "m"],
  ],
  dining: [
    ["Set the table", "🍴", 3, "d"], ["Clear the table", "🍽️", 3, "d"], ["Wipe the dining chairs", "🪑", 8, "2w"],
    ["Clean the high chair", "👶", 4, "d"], ["Polish the dining table", "✨", 5, "2w"], ["Wash the placemats or tablecloth", "🧺", 5, "2w"],
  ],
  entry: [
    ["Line up the shoes", "👟", 2, "d"], ["Hang up coats and bags", "🧥", 2, "d"], ["Clear the mail pile", "📬", 5, "2d"],
    ["Wipe the front door", "🚪", 3, "m"], ["Sweep the entryway", "🧹", 3, "2d"], ["Declutter the coat closet", "🧤", 20, "3m"],
    ["Organize the linen closet", "🛏️", 20, "3m"], ["Clean the door handles", "🖐️", 4, "w"],
  ],
  office: [
    ["Clear the desk", "🖥️", 5, "d"], ["Wipe the keyboard and mouse", "⌨️", 3, "w"], ["File loose papers", "🗂️", 10, "w"],
    ["Empty the office trash", "🗑️", 2, "w"], ["Clean the monitor and screens", "🖥️", 3, "2w"], ["Restock office supplies", "✏️", 10, "m"],
    ["Organize the cables", "🔌", 15, "3m"], ["Shred old documents", "📄", 15, "3m"],
  ],
  trash: [
    ["Take out the trash", "🗑️", 3, "2d"], ["Take out the recycling", "♻️", 3, "w"], ["Put the bins out for pickup", "🚛", 3, "w"],
    ["Bring the bins back in", "↩️", 2, "w"], ["Rinse out the trash cans", "💦", 10, "m"], ["Break down boxes", "📦", 5, "w"],
    ["Take out the compost", "🍂", 3, "2d"], ["Drop off batteries and electronics", "🔋", 20, "6m"],
  ],
  kids: [
    ["Pick up the toys", "🧸", 10, "d"], ["Pack the school bags", "🎒", 5, "wd"], ["Pack the school lunches", "🥪", 10, "wd"],
    ["Check homework", "📚", 15, "wd"], ["Sign the school papers", "✍️", 5, "wd"], ["Bath time", "🛁", 20, "d"],
    ["Lay out tomorrow's clothes", "👕", 4, "d"], ["Wash the kids' bottles and cups", "🍼", 8, "d"], ["Sanitize the toys", "🧼", 15, "m"],
    ["Rotate the toys", "🔄", 15, "m"], ["Sort outgrown clothes", "📏", 25, "3m"], ["Clean the kids' bathroom", "🫧", 15, "w"],
    ["Restock diapers and wipes", "👶", 5, "w"], ["Read a bedtime story", "📖", 15, "d"],
  ],
  pets: [
    ["Feed the pets", "🍖", 3, "d"], ["Fresh water for the pets", "💧", 2, "d"], ["Walk the dog", "🐕", 30, "d"],
    ["Scoop the litter box", "🐈", 3, "d"], ["Change the litter completely", "🪣", 15, "2w"], ["Brush the pet", "🪮", 10, "2d"],
    ["Clean the fish tank", "🐠", 30, "2w"], ["Clean the cage or crate", "🐹", 15, "w"], ["Wash the pet bed", "🛏️", 5, "2w"],
    ["Wash the food and water bowls", "🥣", 3, "d"], ["Trim the pet's nails", "✂️", 10, "m"], ["Give flea and tick medicine", "💊", 2, "m"],
    ["Bathe the dog", "🛁", 25, "m"], ["Pick up the yard after the dog", "💩", 8, "2d"], ["Restock pet food", "🛒", 10, "m"],
    ["Vacuum up pet hair", "🧹", 10, "2d"],
  ],
  plants: [
    ["Water the indoor plants", "🪴", 8, "3d"], ["Water the garden", "🌱", 15, "d"], ["Mist the humid-loving plants", "💦", 3, "2d"],
    ["Rotate the plants toward the light", "☀️", 3, "w"], ["Dust the plant leaves", "🍃", 8, "m"], ["Fertilize the plants", "🧪", 10, "m"],
    ["Repot a root-bound plant", "🪴", 20, "6m"], ["Prune dead leaves", "✂️", 5, "2w"], ["Check for pests", "🐛", 5, "2w"],
  ],
  yard: [
    ["Mow the lawn", "🌿", 45, "w"], ["Water the lawn", "💦", 5, "2d"], ["Weed the garden beds", "🌾", 20, "w"],
    ["Rake the leaves", "🍂", 40, "w"], ["Sweep the porch and patio", "🧹", 10, "w"], ["Trim the hedges", "✂️", 40, "m"],
    ["Edge the lawn", "📐", 20, "2w"], ["Clean the patio furniture", "🪑", 20, "m"], ["Clean the grill", "🍖", 15, "2w"],
    ["Shovel the snow", "❄️", 30, "d"], ["Salt the walkway", "🧂", 5, "d"], ["Fertilize the lawn", "🌱", 30, "3m"],
    ["Clean the outdoor windows", "🪟", 40, "6m"], ["Pressure wash the deck or driveway", "💦", 90, "y"], ["Fill the bird feeder", "🐦", 3, "w"],
    ["Clean the pool", "🏊", 30, "w"], ["Water the potted plants outside", "🪴", 8, "2d"], ["Pick up sticks and debris", "🪵", 10, "w"],
  ],
  garage: [
    ["Sweep the garage", "🧹", 15, "m"], ["Organize the tools", "🧰", 25, "3m"], ["Declutter the garage", "📦", 60, "6m"],
    ["Organize the storage bins", "🗃️", 30, "6m"], ["Check the garage door", "🚪", 10, "6m"], ["Clean out the basement or attic", "🏚️", 60, "y"],
  ],
  car: [
    ["Clear the trash from the car", "🗑️", 3, "w"], ["Vacuum the car", "🌀", 20, "m"], ["Wash the car", "🚿", 30, "2w"],
    ["Wipe the dashboard", "✨", 5, "2w"], ["Check the tire pressure", "🛞", 5, "m"], ["Fill up the gas or charge", "⛽", 10, "w"],
    ["Top up the washer fluid", "💧", 3, "m"], ["Get an oil change", "🛢️", 45, "6m"], ["Rotate the tires", "🔄", 45, "6m"],
    ["Clean the car windows inside", "🪟", 8, "m"], ["Check the car registration and insurance", "📄", 10, "y"], ["Restock the car kit", "🩹", 10, "6m"],
  ],
  upkeep: [
    ["Change the HVAC filter", "🌬️", 5, "3m"], ["Test the smoke detectors", "🚨", 5, "m"], ["Replace the smoke detector batteries", "🔋", 10, "y"],
    ["Clean the gutters", "🏠", 60, "6m"], ["Flush the water heater", "🔥", 30, "y"], ["Replace the water filter", "🚰", 5, "3m"],
    ["Check for leaks under the sinks", "💧", 5, "3m"], ["Replace burned-out bulbs", "💡", 5, "m"], ["Oil squeaky hinges", "🛠️", 10, "6m"],
    ["Clean the dryer vent outside", "💨", 20, "y"], ["Check the caulk in the tub and sinks", "🧴", 10, "6m"], ["Touch up the paint scuffs", "🎨", 20, "6m"],
    ["Service the furnace or AC", "🧑‍🔧", 60, "y"], ["Clean the window tracks", "🪟", 20, "6m"], ["Tighten loose handles and screws", "🔩", 10, "6m"],
    ["Clean the vents and registers", "🌀", 20, "6m"], ["Check the sump pump", "⚙️", 10, "6m"],
  ],
  safety: [
    ["Check the fire extinguisher", "🧯", 3, "6m"], ["Test the carbon monoxide alarm", "⚠️", 3, "m"], ["Lock up and check the doors", "🔒", 2, "d"],
    ["Restock the first-aid kit", "🩹", 10, "6m"], ["Update the emergency kit", "🎒", 20, "y"], ["Practice a fire drill", "🚒", 15, "y"],
    ["Check the outdoor lights", "🔦", 5, "3m"],
  ],
  errands: [
    ["Make the grocery list", "📝", 8, "w"], ["Go grocery shopping", "🛒", 60, "w"], ["Order household refills", "📦", 10, "m"],
    ["Pick up the prescriptions", "💊", 20, "m"], ["Return packages", "📮", 15, "2w"], ["Go to the post office", "🏤", 20, "m"],
    ["Restock cleaning supplies", "🧴", 10, "m"], ["Buy birthday cards and gifts", "🎁", 30, "m"], ["Get a haircut", "💇", 45, "m"],
  ],
  admin: [
    ["Check the mail", "📬", 3, "wd"], ["Pay the bills", "💳", 15, "w"], ["Review the budget", "📊", 20, "w"],
    ["Check the bank accounts", "🏦", 5, "w"], ["Sort the paperwork", "🗂️", 15, "2w"], ["Cancel unused subscriptions", "✂️", 15, "3m"],
    ["File receipts", "🧾", 10, "w"], ["Check your credit report", "📈", 10, "y"], ["Review insurance policies", "📑", 30, "y"],
    ["Gather tax documents", "📁", 30, "y"], ["Update the family calendar", "📅", 10, "w"], ["Schedule the doctor and dentist visits", "🩺", 10, "6m"],
  ],
  tech: [
    ["Clean up the photo library", "🖼️", 15, "m"], ["Back up your phone and computer", "💾", 10, "m"], ["Clear the email inbox", "📧", 15, "w"],
    ["Update the apps and software", "🔄", 10, "m"], ["Charge every device", "🔌", 3, "d"], ["Wipe down your phone", "📱", 2, "w"],
    ["Clear out the downloads folder", "📂", 10, "m"], ["Change old passwords", "🔑", 20, "6m"], ["Unsubscribe from junk emails", "🚫", 10, "m"],
    ["Restart the Wi-Fi router", "📶", 3, "m"],
  ],
  self: [
    ["Do a 10-minute tidy", "⏱️", 10, "d"], ["Evening reset", "🌙", 15, "d"], ["Prep for tomorrow morning", "☀️", 10, "d"],
    ["Clear one junk drawer", "🗄️", 15, "m"], ["Declutter 10 things", "🔟", 10, "w"], ["Clear your bag or purse", "👜", 5, "w"],
    ["Clean your water bottle", "💧", 3, "d"], ["Wash your makeup brushes", "🖌️", 10, "2w"], ["Clean your glasses", "👓", 1, "d"],
    ["Sunday reset", "🔄", 45, "w"],
  ],
  seasonal: [
    ["Swap the seasonal clothes", "🧥", 45, "6m"], ["Put up or take down decorations", "🎄", 60, "6m"], ["Winterize the outdoor faucets", "🚰", 20, "y"],
    ["Clean the window screens", "🪟", 30, "y"], ["Spring clean the whole house", "🌸", 180, "y"], ["Check the heating before winter", "🔥", 15, "y"],
    ["Store the patio furniture", "🪑", 30, "y"], ["Clean the AC unit before summer", "❄️", 30, "y"],
  ],
  deep: [
    ["Wash the walls", "🧱", 45, "6m"], ["Clean the light fixtures", "💡", 20, "6m"], ["Wipe the door frames", "🚪", 20, "3m"],
    ["Clean behind the appliances", "🧲", 30, "6m"], ["Clean the blinds", "🪟", 30, "3m"], ["Steam clean the mattress", "🛏️", 40, "y"],
    ["Clean inside the cabinets", "🗄️", 40, "6m"], ["Dust the high places", "🪜", 20, "3m"], ["Clean the trash can lids and inside", "🗑️", 10, "m"],
    ["Disinfect the high-touch spots", "🦠", 10, "w"], ["Scrub the baseboards", "📏", 30, "3m"], ["Clean the washer and dryer outside", "🫧", 10, "3m"],
  ],
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const CHORE_CATALOG: CatalogChore[] = Object.entries(RAW).flatMap(([cat, rows]) =>
  rows.map(([title, icon, mins, freq]) => ({ id: `${cat}:${slug(title)}`, title, icon, mins, cat, freq })));
export const catalogById = new Map(CHORE_CATALOG.map((c) => [c.id, c]));
export const categoryOf = (id: string | undefined) => CHORE_CATEGORIES.find((c) => c.id === id);

/** Ready-made sets to start with, added in one tap. */
export const CHORE_PACKS: { id: string; name: string; emoji: string; blurb: string; chores: string[] }[] = [
  { id: "basics", name: "Daily basics", emoji: "☀️", blurb: "The five-minute habits that keep a home calm.", chores: ["bedroom:make-the-bed", "kitchen:wash-the-dishes", "kitchen:wipe-the-counters", "living:reset-the-living-room", "trash:take-out-the-trash", "self:evening-reset"] },
  { id: "apartment", name: "Apartment starter", emoji: "🏢", blurb: "Everything a small place needs, spread over the week.", chores: ["kitchen:wash-the-dishes", "kitchen:wipe-the-counters", "bathroom:clean-the-toilet", "bathroom:scrub-the-shower-or-tub", "bedroom:change-the-sheets", "floors:vacuum-the-house", "laundry:start-a-load-of-laundry", "trash:take-out-the-trash", "kitchen:clear-out-the-fridge-leftovers"] },
  { id: "family", name: "Family home", emoji: "🏡", blurb: "School mornings, toys, laundry and the big weekly jobs.", chores: ["kids:pick-up-the-toys", "kids:pack-the-school-bags", "kids:pack-the-school-lunches", "laundry:fold-the-clean-laundry", "kitchen:load-the-dishwasher", "dining:set-the-table", "floors:vacuum-the-house", "trash:put-the-bins-out-for-pickup", "kitchen:plan-this-week-s-meals"] },
  { id: "pets", name: "Pet parent", emoji: "🐾", blurb: "Food, water, walks and the rest, never forgotten.", chores: ["pets:feed-the-pets", "pets:fresh-water-for-the-pets", "pets:walk-the-dog", "pets:scoop-the-litter-box", "pets:brush-the-pet", "pets:vacuum-up-pet-hair", "pets:give-flea-and-tick-medicine"] },
  { id: "reset", name: "Sunday reset", emoji: "🔄", blurb: "One weekly sweep that sets up the whole week.", chores: ["self:sunday-reset", "kitchen:plan-this-week-s-meals", "errands:make-the-grocery-list", "bedroom:change-the-sheets", "admin:review-the-budget", "admin:update-the-family-calendar", "tech:clear-the-email-inbox"] },
  { id: "upkeep", name: "Home upkeep", emoji: "🔧", blurb: "The easy-to-forget jobs that save expensive repairs.", chores: ["upkeep:change-the-hvac-filter", "upkeep:test-the-smoke-detectors", "upkeep:clean-the-gutters", "upkeep:replace-the-water-filter", "safety:check-the-fire-extinguisher", "upkeep:flush-the-water-heater"] },
  { id: "deep", name: "Deep clean month", emoji: "🧽", blurb: "One bigger job at a time, until the whole home sparkles.", chores: ["kitchen:clean-the-oven", "deep:clean-the-blinds", "deep:scrub-the-baseboards", "bathroom:clean-the-grout", "deep:dust-the-high-places", "kitchen:wipe-the-fridge-shelves"] },
  { id: "money", name: "Money & mail", emoji: "💳", blurb: "Bills paid, paperwork sorted, no surprises.", chores: ["admin:check-the-mail", "admin:pay-the-bills", "admin:review-the-budget", "admin:file-receipts", "admin:cancel-unused-subscriptions"] },
];

/** The frequency choices shown in the picker, in order. */
export const FREQ_CHOICES: { id: string; label: string; freq: ChoreFreq }[] = [
  { id: "d", label: "Every day", freq: FREQ_CODES.d },
  { id: "wd", label: "Weekdays", freq: FREQ_CODES.wd },
  { id: "we", label: "Weekends", freq: FREQ_CODES.we },
  { id: "2d", label: "Every 2 days", freq: FREQ_CODES["2d"] },
  { id: "3d", label: "Every 3 days", freq: FREQ_CODES["3d"] },
  { id: "w", label: "Weekly", freq: FREQ_CODES.w },
  { id: "2w", label: "Every 2 weeks", freq: FREQ_CODES["2w"] },
  { id: "m", label: "Monthly", freq: FREQ_CODES.m },
  { id: "3m", label: "Every 3 months", freq: FREQ_CODES["3m"] },
  { id: "6m", label: "Every 6 months", freq: FREQ_CODES["6m"] },
  { id: "y", label: "Yearly", freq: FREQ_CODES.y },
];

const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
/** "Every day", "Mon, Wed, Fri", "Every 2 weeks · any day", "Monthly on the 5th"… */
export function freqLabel(c: Pick<Chore, "days" | "unit" | "every" | "flex" | "start">): string {
  const unit = c.unit || "week", n = Math.max(1, c.every || 1);
  if (unit === "day") return (n === 1 ? "Every day" : `Every ${n} days`) + (c.flex && n > 1 ? " · any day" : "");
  if (unit === "month") {
    const base = n === 1 ? "Monthly" : n === 12 ? "Yearly" : `Every ${n} months`;
    if (c.flex) return `${base} · any day`;
    const d = Number((c.start || "").slice(8)) || 1;
    return `${base} on the ${d}${d % 10 === 1 && d !== 11 ? "st" : d % 10 === 2 && d !== 12 ? "nd" : d % 10 === 3 && d !== 13 ? "rd" : "th"}`;
  }
  const lead = n === 1 ? "" : `Every ${n} weeks`;
  if (c.flex) return n === 1 ? "Weekly · any day" : `${lead} · any day`;
  const days = c.days.length === 7 || !c.days.length ? "" : c.days.join() === "1,2,3,4,5" ? "Weekdays" : c.days.join() === "0,6" ? "Weekends" : c.days.map((d) => DAY[d]).join(", ");
  if (!lead) return days || "Every day";
  return `${lead}${days ? ` · ${days}` : ""}`;
}

/** About how many days apart a chore comes round (for how fresh each room is). */
export function choreInterval(c: Pick<Chore, "days" | "unit" | "every" | "flex">): number {
  const n = Math.max(1, c.every || 1), unit = c.unit || "week";
  if (unit === "day") return n;
  if (unit === "month") return n * 30;
  if (c.flex) return n * 7;
  return c.days.length && c.days.length < 7 ? (7 / c.days.length) * n : n === 1 ? 1 : n * 7;
}

/** A new Chore from a catalog entry (or a typed one), starting today. */
export function choreFromCatalog(item: Pick<CatalogChore, "title" | "icon" | "mins" | "cat">, freq: ChoreFreq, id: string, today: string, extra: Partial<Chore> = {}): Chore {
  const chore: Chore = { id, title: item.title, memberId: "", rotation: [], days: freq.days ?? [], points: Math.max(1, Math.min(10, Math.round(item.mins / 10) || 1)), start: today };
  if (freq.unit !== "week" || freq.every > 1) chore.unit = freq.unit;
  if (freq.every > 1) chore.every = freq.every;
  if (freq.flex) chore.flex = true;
  if (item.cat) chore.cat = item.cat;
  if (item.icon) chore.icon = item.icon;
  if (item.mins) chore.mins = item.mins;
  return { ...chore, ...extra };
}

/** The frequency a chore has now, as the picker shows it. */
export function freqOf(c: Pick<Chore, "days" | "unit" | "every" | "flex">): ChoreFreq {
  return { unit: c.unit || "week", every: Math.max(1, c.every || 1), days: c.days, flex: !!c.flex };
}
