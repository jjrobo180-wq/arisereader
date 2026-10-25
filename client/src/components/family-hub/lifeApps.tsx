// The LifeHub apps that need nothing but the shared LifeHub props (SectionProps), by section id.
// LifeHub (pages/AriseTodo.tsx) opens them from its menu, and Para Team (components/para-team/
// TeamApps.tsx) opens the same apps on a team's shared data. Apps that need more than these props
// (Home, the Calendar, the Reader, the Browser…) are handled by each page itself.
import type { ReactNode } from "react";
import type { FamilySection } from "@shared/familyHub";
import type { SectionProps } from "@/components/family-hub/ui";
import Allowance from "@/components/family-hub/Allowance";
import Behavior from "@/components/family-hub/Behavior";
import Bible from "@/components/family-hub/Bible";
import Birthdays from "@/components/family-hub/Birthdays";
import CareTracker from "@/components/family-hub/CareTracker";
import Chores from "@/components/family-hub/Chores";
import Collection from "@/components/family-hub/Collection";
import Contacts from "@/components/family-hub/Contacts";
import Converter from "@/components/family-hub/Converter";
import Countdowns from "@/components/family-hub/Countdowns";
import Cycle from "@/components/family-hub/Cycle";
import Dictionary from "@/components/family-hub/Dictionary";
import Focus from "@/components/family-hub/Focus";
import GiftCards from "@/components/family-hub/GiftCards";
import Goals from "@/components/family-hub/Goals";
import Gratitude from "@/components/family-hub/Gratitude";
import Grocery from "@/components/family-hub/Grocery";
import Habits from "@/components/family-hub/Habits";
import Health from "@/components/family-hub/Health";
import Ious from "@/components/family-hub/Ious";
import Journal from "@/components/family-hub/Journal";
import KitchenTimers from "@/components/family-hub/KitchenTimers";
import LinkPage from "@/components/family-hub/LinkPage";
import LinkedProfiles from "@/components/family-hub/LinkedProfiles";
import LoanCalculator from "@/components/family-hub/LoanCalculator";
import MealPlanner from "@/components/family-hub/MealPlanner";
import MedicalInfo from "@/components/family-hub/MedicalInfo";
import Meditate from "@/components/family-hub/Meditate";
import Members from "@/components/family-hub/Members";
import Mileage from "@/components/family-hub/Mileage";
import Milestones from "@/components/family-hub/Milestones";
import Money from "@/components/family-hub/Money";
import Mood from "@/components/family-hub/Mood";
import News from "@/components/family-hub/News";
import Notes from "@/components/family-hub/Notes";
import NotificationSettings from "@/components/family-hub/NotificationSettings";
import Pills from "@/components/family-hub/Pills";
import Polls from "@/components/family-hub/Polls";
import Quotes from "@/components/family-hub/Quotes";
import Randomizer from "@/components/family-hub/Randomizer";
import Recipes from "@/components/family-hub/Recipes";
import Relationships from "@/components/family-hub/Relationships";
import Routines from "@/components/family-hub/Routines";
import SavingsJars from "@/components/family-hub/SavingsJars";
import SleepApp from "@/components/family-hub/sleep/SleepApp";
import SleepFinder from "@/components/family-hub/SleepFinder";
import Subscriptions from "@/components/family-hub/Subscriptions";
import TipCalculator from "@/components/family-hub/TipCalculator";
import TodayInHistory from "@/components/family-hub/TodayInHistory";
import Trending from "@/components/family-hub/Trending";
import Trips from "@/components/family-hub/Trips";
import Warranties from "@/components/family-hub/Warranties";
import Weather from "@/components/family-hub/Weather";
import WorkoutLog from "@/components/family-hub/WorkoutLog";
import WorldClock from "@/components/family-hub/WorldClock";

export const LIFE_VIEWS: Partial<Record<FamilySection, (props: SectionProps) => ReactNode>> = {
  chores: (p) => <Chores {...p} />,
  behavior: (p) => <Behavior {...p} />,
  health: (p) => <Health {...p} />,
  goals: (p) => <Goals {...p} />,
  cycle: (p) => <Cycle {...p} />,
  pills: (p) => <Pills {...p} />,
  mood: (p) => <Mood {...p} />,
  news: (p) => <News {...p} />,
  notifications: (p) => <NotificationSettings {...p} />,
  polls: (p) => <Polls {...p} />,
  trips: (p) => <Trips {...p} />,
  money: (p) => <Money {...p} />,
  notes: (p) => <Notes {...p} />,
  journal: (p) => <Journal {...p} />,
  countdowns: (p) => <Countdowns {...p} />,
  grocery: (p) => <Grocery {...p} />,
  meditate: (p) => <Meditate {...p} />,
  bible: (p) => <Bible {...p} />,
  quotes: (p) => <Quotes {...p} />,
  history: (p) => <TodayInHistory {...p} />,
  trending: (p) => <Trending {...p} />,
  randomizer: (p) => <Randomizer {...p} />,
  relationships: (p) => <Relationships {...p} />,
  dictionary: (p) => <Dictionary {...p} />,
  links: (p) => <LinkPage {...p} />,
  linked: (p) => <LinkedProfiles {...p} />,
  habits: (p) => <Habits {...p} />,
  gratitude: (p) => <Gratitude {...p} />,
  focus: (p) => <Focus {...p} />,
  bucket: (p) => <Collection kind="bucket" {...p} />,
  recipes: (p) => <Recipes {...p} />,
  meals: (p) => <MealPlanner {...p} />,
  upkeep: (p) => <CareTracker kind="upkeep" {...p} />,
  plants: (p) => <CareTracker kind="plants" {...p} />,
  birthdays: (p) => <Birthdays {...p} />,
  gifts: (p) => <Collection kind="gifts" {...p} />,
  pets: (p) => <CareTracker kind="pets" {...p} />,
  contacts: (p) => <Contacts {...p} />,
  subscriptions: (p) => <Subscriptions {...p} />,
  jars: (p) => <SavingsJars {...p} />,
  tips: (p) => <TipCalculator {...p} />,
  reading: (p) => <Collection kind="reading" {...p} />,
  watchlist: (p) => <Collection kind="watchlist" {...p} />,
  weather: (p) => <Weather {...p} />,
  convert: (p) => <Converter {...p} />,
  car: (p) => <CareTracker kind="car" {...p} />,
  wishlist: (p) => <Collection kind="wishlist" {...p} />,
  restaurants: (p) => <Collection kind="restaurants" {...p} />,
  learning: (p) => <Collection kind="learning" {...p} />,
  projects: (p) => <Collection kind="projects" {...p} />,
  loans: (p) => <Collection kind="loans" {...p} />,
  cleaning: (p) => <CareTracker kind="cleaning" {...p} />,
  checkups: (p) => <CareTracker kind="checkups" {...p} />,
  sleep: (p) => <SleepApp {...p} />,
  sleepfinder: (p) => <SleepFinder {...p} />,
  workouts: (p) => <WorkoutLog {...p} />,
  routines: (p) => <Routines {...p} />,
  milestones: (p) => <Milestones {...p} />,
  ious: (p) => <Ious {...p} />,
  allowance: (p) => <Allowance {...p} />,
  giftcards: (p) => <GiftCards {...p} />,
  warranties: (p) => <Warranties {...p} />,
  mileage: (p) => <Mileage {...p} />,
  mortgage: (p) => <LoanCalculator {...p} />,
  clocks: (p) => <WorldClock {...p} />,
  timers: (p) => <KitchenTimers {...p} />,
  medical: (p) => <MedicalInfo {...p} />,
  family: (p) => <Members {...p} />,
};
