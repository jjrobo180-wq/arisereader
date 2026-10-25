// Family & settings: who's in the family, and which parts of the hub are switched on.
import { useState, type FormEvent, type ReactNode } from "react";
import { Rocket } from "lucide-react";
import { Apple, BookMarked, CalendarDays, Check, Droplets, History, Hourglass, NotebookPen, Pill, Newspaper, Quote, ShoppingCart, SmilePlus, Target, Pencil, Plane, Plus, Smile, Sparkles, StickyNote, Trash2, TrendingUp, UserPlus, Vote, Wallet, Wind, Shuffle, HeartHandshake, BookOpen, Link2, Users } from "lucide-react";
import { MEMBER_COLORS, isOn, orderedToggleable, type FamilySection, type Member } from "@shared/familyHub";
import { Avatar, Label, Modal, PageHead, Panel, Toggle, confirmed, danger, inputClass, plain, primary, type SectionProps } from "./ui";
import { SharedLinks } from "./ShareLink";
import { KIT_DEFS, type KitLifeId } from "@shared/pluginKit";
import { kitIcon } from "@/components/plugin-kit/kitIcons";
import { ListMusic as ListMusicIcon3 } from "lucide-react";
import { Coins as CoinsIcon2, CreditCard as CreditCardIcon2, Dumbbell as DumbbellIcon2, Gauge as GaugeIcon2, Globe as GlobeIcon2, GraduationCap as GraduationCapIcon2, Hammer as HammerIcon2, HandCoins as HandCoinsIcon2, Handshake as HandshakeIcon2, Heart as HeartIcon2, HeartPulse as HeartPulseIcon2, Landmark as LandmarkIcon2, ListChecks as ListChecksIcon2, Moon as MoonIcon2, ShieldCheck as ShieldCheckIcon2, Sparkles as SparklesIcon2, Star as StarIcon2, Stethoscope as StethoscopeIcon2, Timer as TimerIcon2, Utensils as UtensilsIcon2 } from "lucide-react";
import { ArrowLeftRight as ArrowLeftRightIcon, BookOpen as BookOpenIcon, Cake as CakeIcon, Calculator as CalculatorIcon, Car as CarIcon, ChefHat as ChefHatIcon, CloudSun as CloudSunIcon, CreditCard as CreditCardIcon, Flower2 as Flower2Icon, Gift as GiftIcon, Heart as HeartIcon, Mountain as MountainIcon, PawPrint as PawPrintIcon, Phone as PhoneIcon, PiggyBank as PiggyBankIcon, Repeat as RepeatIcon, Timer as TimerIcon, Tv as TvIcon, UtensilsCrossed as UtensilsCrossedIcon, Wrench as WrenchIcon } from "lucide-react";

const EMOJI = ["🙂", "😎", "🦄", "🦖", "🐱", "🐶", "🌟", "⚽", "🎨", "🎮", "🌸", "🚀", "👑", "🐻", "🦊", "🐢"];
export const SECTION_INFO: Record<FamilySection, { label: string; detail: string; icon: ReactNode }> = {
  home: { label: "Home", detail: "Today at a glance", icon: null },
  tasks: { label: "Tasks", detail: "Your to-do lists", icon: null },
  start: { label: "Getting started", detail: "A guide to everything in LifeHub", icon: <Rocket size={17} /> },
  chores: { label: "Chores", detail: "Chore chart, rotations and stars", icon: <Sparkles size={17} /> },
  calendar: { label: "Calendar", detail: "Shared family calendars", icon: <CalendarDays size={17} /> },
  behavior: { label: "Behavior", detail: "Kid behavior tracker and rewards", icon: <Smile size={17} /> },
  goals: { label: "Goals", detail: "Personal and family goals with progress", icon: <Target size={17} /> },
  cycle: { label: "Cycle", detail: "Period and cycle tracker, daily insights and tips", icon: <Droplets size={17} /> },
  pills: { label: "Pills", detail: "Pill and vitamin reminders for the family", icon: <Pill size={17} /> },
  mood: { label: "Mood", detail: "Daily mood check-in and patterns", icon: <SmilePlus size={17} /> },
  news: { label: "News", detail: "Today's headlines and local news", icon: <Newspaper size={17} /> },
  notifications: { label: "Notifications", detail: "Choose your reminders and how many", icon: null },
  reader: { label: "A.R.I.S.E. Reader", detail: "Your children's reading, controls and add-ons", icon: null },
  health: { label: "Food & fitness", detail: "Food diary, exercise, water, steps and weight", icon: <Apple size={17} /> },
  polls: { label: "Polls", detail: "Dinner ideas, weekend plans and votes", icon: <Vote size={17} /> },
  trips: { label: "Trips", detail: "Trip planner and packing lists", icon: <Plane size={17} /> },
  money: { label: "Budget & bills", detail: "Bills, budget and spending", icon: <Wallet size={17} /> },
  notes: { label: "Notes", detail: "Codes, contacts, lists and ideas", icon: <StickyNote size={17} /> },
  family: { label: "Family & settings", detail: "People and switches", icon: null },
  journal: { label: "Journal", detail: "A private daily journal with prompts", icon: <NotebookPen size={17} /> },
  countdowns: { label: "Countdowns", detail: "Days until the big days", icon: <Hourglass size={17} /> },
  grocery: { label: "Grocery list", detail: "A shopping list sorted by aisle", icon: <ShoppingCart size={17} /> },
  meditate: { label: "Meditate", detail: "Guided breathing and a quiet timer", icon: <Wind size={17} /> },
  bible: { label: "Bible", detail: "Verse of the day and any passage", icon: <BookMarked size={17} /> },
  quotes: { label: "Daily quote", detail: "A motivational quote every day", icon: <Quote size={17} /> },
  history: { label: "Today in history", detail: "What happened on this day", icon: <History size={17} /> },
  trending: { label: "What's trending", detail: "Top searches and most-read stories", icon: <TrendingUp size={17} /> },
  randomizer: { label: "Randomizer", detail: "Pick from a list, flip a coin, roll dice", icon: <Shuffle size={17} /> },
  relationships: { label: "Relationships", detail: "Tips, conversation starters and date ideas", icon: <HeartHandshake size={17} /> },
  dictionary: { label: "Dictionary", detail: "Look up any word, plus a word a day", icon: <BookOpen size={17} /> },
  links: { label: "Link page", detail: "Your links on one shareable page", icon: <Link2 size={17} /> },
  linked: { label: "Linked profiles", detail: "Share apps like Potty Training with a co-parent, sitter or grandparent", icon: <Users size={17} /> },
  lifeplan: { label: "AI Reminders", detail: "AI builds your reminders around the life you want", icon: <Sparkles size={17} /> },
  habits: { label: "Habits", detail: "Daily habits and streaks", icon: <RepeatIcon size={17} /> },
  gratitude: { label: "Gratitude", detail: "Three good things a day", icon: <HeartIcon size={17} /> },
  focus: { label: "Focus timer", detail: "Work in focused blocks with breaks", icon: <TimerIcon size={17} /> },
  bucket: { label: "Bucket list", detail: "Someday, for real", icon: <MountainIcon size={17} /> },
  recipes: { label: "Recipe box", detail: "Family recipes, one tap to shop", icon: <ChefHatIcon size={17} /> },
  meals: { label: "Meal planner", detail: "Plan the week's meals", icon: <UtensilsCrossedIcon size={17} /> },
  upkeep: { label: "Home upkeep", detail: "Filters, alarms and the rest", icon: <WrenchIcon size={17} /> },
  plants: { label: "Plant care", detail: "Watering schedules for each plant", icon: <Flower2Icon size={17} /> },
  birthdays: { label: "Birthdays", detail: "Birthdays and anniversaries", icon: <CakeIcon size={17} /> },
  gifts: { label: "Gift ideas", detail: "Ideas all year, bought and given", icon: <GiftIcon size={17} /> },
  pets: { label: "Pet care", detail: "Medicine, vet visits and grooming", icon: <PawPrintIcon size={17} /> },
  contacts: { label: "Important contacts", detail: "Doctors, school, sitters and more", icon: <PhoneIcon size={17} /> },
  subscriptions: { label: "Subscriptions", detail: "What they cost each month", icon: <CreditCardIcon size={17} /> },
  jars: { label: "Savings jars", detail: "Save toward goals", icon: <PiggyBankIcon size={17} /> },
  tips: { label: "Tip & split", detail: "Tip and split the bill", icon: <CalculatorIcon size={17} /> },
  reading: { label: "Reading list", detail: "Books to read and read", icon: <BookOpenIcon size={17} /> },
  watchlist: { label: "Watchlist", detail: "Movies and shows to watch", icon: <TvIcon size={17} /> },
  weather: { label: "Weather", detail: "Now and the next 7 days", icon: <CloudSunIcon size={17} /> },
  convert: { label: "Unit converter", detail: "Cooking, length, weight and more", icon: <ArrowLeftRightIcon size={17} /> },
  car: { label: "Car care", detail: "Oil changes, tires and registration", icon: <CarIcon size={17} /> },
  wishlist: { label: "Wishlist", detail: "Things you'd love, with prices and links", icon: <HeartIcon2 size={17} /> },
  restaurants: { label: "Restaurants", detail: "Places to try and how they were", icon: <UtensilsIcon2 size={17} /> },
  learning: { label: "Learning goals", detail: "Skills and subjects to learn", icon: <GraduationCapIcon2 size={17} /> },
  projects: { label: "Home projects", detail: "Repairs, upgrades and DIY", icon: <HammerIcon2 size={17} /> },
  loans: { label: "Lent items", detail: "Who has your stuff", icon: <HandshakeIcon2 size={17} /> },
  cleaning: { label: "Cleaning schedule", detail: "Room by room, a little at a time", icon: <SparklesIcon2 size={17} /> },
  checkups: { label: "Health checkups", detail: "Physicals, dentist, eye exams", icon: <StethoscopeIcon2 size={17} /> },
  sleep: { label: "Sleep", detail: "Fall asleep tonight, plus a sleep log", icon: <MoonIcon2 size={17} /> },
  sleepfinder: { label: "Sleep Finder", detail: "Find something to fall asleep to, and build playlists", icon: <ListMusicIcon3 size={17} /> },
  workouts: { label: "Workout log", detail: "Sets, reps, weight and bests", icon: <DumbbellIcon2 size={17} /> },
  routines: { label: "Routines", detail: "Daily checklists that start fresh", icon: <ListChecksIcon2 size={17} /> },
  milestones: { label: "Milestones", detail: "First words, steps and more", icon: <StarIcon2 size={17} /> },
  ious: { label: "IOUs", detail: "Who owes who", icon: <HandCoinsIcon2 size={17} /> },
  allowance: { label: "Allowance", detail: "Kids' money in and out", icon: <CoinsIcon2 size={17} /> },
  giftcards: { label: "Gift cards", detail: "Balances and expiry dates", icon: <CreditCardIcon2 size={17} /> },
  warranties: { label: "Warranties", detail: "What's still covered", icon: <ShieldCheckIcon2 size={17} /> },
  mileage: { label: "Mileage log", detail: "Business and volunteer miles", icon: <GaugeIcon2 size={17} /> },
  mortgage: { label: "Loan calculator", detail: "Payments and interest for any loan", icon: <LandmarkIcon2 size={17} /> },
  clocks: { label: "World clock", detail: "Time where your people are", icon: <GlobeIcon2 size={17} /> },
  timers: { label: "Kitchen timers", detail: "Several timers at once", icon: <TimerIcon2 size={17} /> },
  medical: { label: "Medical info", detail: "Allergies, medicines, blood type", icon: <HeartPulseIcon2 size={17} /> },
  browser: { label: "Browser", detail: "Browse, bookmark and save pages as tasks", icon: <GlobeIcon2 size={17} /> },
  // The Plugin Kit's LifeHub plugins (shared/pluginKit.ts).
  ...(Object.fromEntries(KIT_DEFS.filter((d) => d.hub === "life").map((d) => { const Icon = kitIcon(d.icon); return [d.id, { label: d.name, detail: d.tagline, icon: <Icon size={17} /> }]; })) as Record<KitLifeId, { label: string; detail: string; icon: ReactNode }>),
};
const blank = (id: string, n: number): Member => ({ id, name: "", emoji: EMOJI[n % EMOJI.length], color: MEMBER_COLORS[n % MEMBER_COLORS.length], kind: "kid" });

export default function Members({ family, setFamily, makeId, say }: SectionProps) {
  const [editing, setEditing] = useState<Member | null>(null);
  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!editing || !editing.name.trim()) return;
    const clean = { ...editing, name: editing.name.trim().slice(0, 40) };
    if (family.members.some((m) => m.id !== clean.id && m.name.toLowerCase() === clean.name.toLowerCase())) { say("Someone already has that name."); return; }
    const isNew = !family.members.some((m) => m.id === clean.id);
    if (isNew && family.members.length >= 20) { say("A family can have up to 20 people."); return; }
    setFamily((f) => ({ ...f, members: isNew ? [...f.members, clean] : f.members.map((m) => (m.id === clean.id ? clean : m)) }));
    setEditing(null);
    say(isNew ? `${clean.name} added to the family` : "Saved");
  };
  const remove = (m: Member) => {
    if (!confirmed(`Remove ${m.name}? Their chores become "anyone", and their votes are cleared. Past stars and logs are kept.`)) return;
    setFamily((f) => ({
      ...f,
      members: f.members.filter((x) => x.id !== m.id),
      chores: f.chores.map((c) => ({ ...c, memberId: c.memberId === m.id ? "" : c.memberId, rotation: c.rotation.filter((r) => r !== m.id) })),
      events: f.events.map((e) => ({ ...e, memberIds: e.memberIds.filter((x) => x !== m.id) })),
      polls: f.polls.map((p) => { const votes = { ...p.votes }; delete votes[m.id]; return { ...p, votes }; }),
      trips: f.trips.map((t) => ({ ...t, packing: t.packing.map((p) => (p.memberId === m.id ? { ...p, memberId: "" } : p)) })),
    }));
    setEditing(null);
    say(`${m.name} removed`);
  };

  return <div className="space-y-6">
    <PageHead eyebrow="Family & settings" title="Your family" blurb="Add everyone once, then assign tasks, chores, events and votes to them. Turn off any part of the hub you don't need." />
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <Panel eyebrow="People" title={`${family.members.length} in the family`} right={<button onClick={() => setEditing(blank(makeId(), family.members.length))} className={primary}><UserPlus size={16} /> Add person</button>}>
        {family.members.length ? <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{family.members.map((m) => <li key={m.id}>
          <button onClick={() => setEditing({ ...m })} className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-3 text-left transition hover:border-violet-200" style={{ background: m.color + "10" }}>
            <Avatar member={m} size="lg" /><span className="min-w-0 flex-1"><span className="block truncate font-black">{m.name}</span><span className="text-xs font-semibold text-slate-500">{m.kind === "kid" ? "Kid" : "Adult"}</span></span><Pencil size={15} className="text-slate-400" />
          </button>
        </li>)}</ul> : <div className="rounded-2xl border border-dashed border-slate-200 p-6 text-center"><p className="font-bold">Who's in your family?</p><p className="mt-1 text-sm text-slate-500">Add each parent and kid. Kids get a behavior card and a star chart.</p><button onClick={() => setEditing(blank(makeId(), 0))} className={primary + " mt-4"}><Plus size={16} /> Add the first person</button></div>}
      </Panel>

      <Panel eyebrow="Switches" title="Turn features on or off">
        <p className="mb-3 text-sm text-slate-500">Hiding a feature keeps everything saved in it. Turn it back on any time. To reorder the menu, drag an item in it (or use its arrows on hover).</p>
        <ul className="divide-y divide-slate-100">{orderedToggleable(family).map((s) => {
          const info = SECTION_INFO[s];
          const on = isOn(s, family);
          return <li key={s} className="flex items-center gap-3 py-3">
            <span className={`rounded-xl p-2 ${on ? "bg-violet-50 text-violet-600" : "bg-slate-100 text-slate-400"}`}>{info.icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{info.label}</span><span className="text-xs text-slate-500">{info.detail}</span></span>
            <Toggle on={on} label={`Show ${info.label}`} onChange={(v) => setFamily((f) => ({ ...f, sections: { ...f.sections, [s]: v } }))} />
          </li>;
        })}</ul>
        <div className="mt-2 flex items-center gap-3 border-t border-slate-100 pt-4">
          <span className="min-w-0 flex-1"><span className="block text-sm font-bold">Chore stars count toward rewards</span><span className="text-xs text-slate-500">Kids can spend stars from chores and behavior together</span></span>
          <Toggle on={family.chorePointsCount} label="Chore stars count toward rewards" onChange={(v) => setFamily((f) => ({ ...f, chorePointsCount: v }))} />
        </div>
      </Panel>
    </div>
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <SharedLinks say={say} />
    </div>

    {editing && <Modal title={family.members.some((m) => m.id === editing.id) ? `Edit ${editing.name || "person"}` : "Add a person"} onClose={() => setEditing(null)}>
      <form onSubmit={save} className="space-y-4">
        <div className="flex items-center gap-4"><Avatar member={{ ...editing, name: editing.name || "?" }} size="lg" />
          <Label text="Name" className="flex-1"><input autoFocus required maxLength={40} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputClass} placeholder="Maya" /></Label></div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">This is a…</p>
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm font-bold">{(["kid", "adult"] as const).map((k) => <button type="button" key={k} aria-pressed={editing.kind === k} onClick={() => setEditing({ ...editing, kind: k })} className={`min-h-10 rounded-lg px-5 ${editing.kind === k ? "bg-white text-violet-700 shadow-sm" : "text-slate-500"}`}>{k === "kid" ? "Kid" : "Adult"}</button>)}</div></div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Icon</p><div className="flex flex-wrap gap-1.5">{EMOJI.map((e) => <button type="button" key={e} aria-pressed={editing.emoji === e} onClick={() => setEditing({ ...editing, emoji: e })} className={`h-10 w-10 rounded-xl text-xl ${editing.emoji === e ? "bg-violet-100 ring-2 ring-violet-500" : "bg-slate-50 hover:bg-slate-100"}`}>{e}</button>)}</div></div>
        <div><p className="mb-1.5 text-xs font-bold text-slate-600">Color</p><div className="flex flex-wrap gap-2">{MEMBER_COLORS.map((c) => <button type="button" key={c} aria-pressed={editing.color === c} aria-label={`Color ${c}`} onClick={() => setEditing({ ...editing, color: c })} className={`h-9 w-9 rounded-full ${editing.color === c ? "ring-2 ring-slate-800 ring-offset-2" : ""}`} style={{ background: c }} />)}</div></div>
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <button type="submit" className={primary + " flex-1 px-5"}><Check size={17} /> Save</button>
          <button type="button" onClick={() => setEditing(null)} className={plain}>Cancel</button>
          {family.members.some((m) => m.id === editing.id) && <button type="button" onClick={() => remove(editing)} className={danger} aria-label="Remove person"><Trash2 size={17} /></button>}
        </div>
      </form>
    </Modal>}
  </div>;
}
