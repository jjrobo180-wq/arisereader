// The step-by-step program: ten stages from "getting ready" to "doing it all", each with what to
// do, a daily checklist, how to know it's time to move on, and what to try when it isn't working.
// Plus the readiness check and the training methods. Sources are listed in resources.ts; the main
// ones are the AAP (HealthyChildren.org), Mayo Clinic, ERIC, NHS, CHOP and the University of
// Vermont Continence Project.
import type { MethodId, StageId } from "./model";

export type Step = { t: string; why?: string };
export type Stuck = { when: string; try: string[] };
export type Stage = {
  id: StageId; title: string; kidTitle: string; emoji: string;
  /** One line on what this stage is. */
  summary: string;
  /** Who it's for / when it usually happens. */
  when: string;
  goal: string;
  steps: Step[];
  daily: string[];
  stuck: Stuck[];
  avoid: string[];
  articles: string[]; videos: string[]; strategies: string[];
};

export const STAGES: Stage[] = [
  {
    id: "ready", title: "Getting ready", kidTitle: "Learning about the potty", emoji: "🌱",
    summary: "Lay the groundwork before diapers come off: words, watching, a potty in the house, and soft daily poops.",
    when: "Any time from about 12–18 months, and for any child not yet showing readiness signs.",
    goal: "Your child knows what the potty is for, has words (or signs) for pee and poop, and most readiness signs are showing.",
    steps: [
      { t: "Pick your family's words for pee, poop and potty, and use them every diaper change.", why: "A child can't tell you what they don't have words or a sign for. Avoid 'dirty', 'yucky' or 'gross' — shame makes kids hold on." },
      { t: "Change diapers in the bathroom, standing up once your child can stand.", why: "It links the bathroom with pee and poop and gets them involved." },
      { t: "Tip poop from the diaper into the toilet and let your child flush and wave bye-bye.", why: "Shows where poop belongs and takes the scary out of flushing." },
      { t: "Buy a potty (or a seat + step stool) and leave it where your child plays for a few days.", why: "Let it become a normal object. Some families write the child's name on it." },
      { t: "Let your child watch you or a sibling use the toilet and narrate what you do.", why: "Toddlers learn mostly by copying." },
      { t: "Read potty books and watch the kids' videos together.", why: "Repetition makes the routine familiar before it's asked of them." },
      { t: "Say it out loud when you notice them going: 'You're pooping — poop goes in the potty soon!'", why: "Builds awareness of the body's signal, the first real skill." },
      { t: "Make sure there's a soft poop most days. Treat constipation before starting.", why: "Hard, painful poops are the #1 reason training stalls (ERIC, AAP)." },
      { t: "Offer 6–8 drinks a day, mostly water.", why: "A well-filled bladder gets practice stretching and emptying; soft poops need fluid." },
      { t: "Optional: put a washable cloth inside the diaper so they feel wet.", why: "Modern diapers hide wetness; feeling it builds awareness (ERIC)." },
      { t: "Go through the readiness check and log a few days of diapers.", why: "The log shows how long they stay dry and when they usually poop — the timing you'll use later." },
    ],
    daily: ["Use the words at every change", "Change in the bathroom", "Tip poop into the toilet", "6–8 drinks", "Read a potty book or watch a video"],
    stuck: [
      { when: "My child isn't interested at all", try: ["That's normal before 2–2½. Keep the groundwork going without pressure.", "Use a character they love: a video, book or doll that 'uses the potty'.", "Let them help their stuffed animal sit on the potty.", "Mayo Clinic suggests checking with the doctor if there's no interest after 2½."] },
      { when: "They're scared of the toilet", try: ["Use a floor potty instead — feet on the ground feels safe.", "Flush only after they leave the room.", "Watch 'It'll Wait for You' or Daniel Tiger together."] },
      { when: "Poops are hard or painful", try: ["Read the constipation article and talk to your doctor before training.", "Add water, fruit (pears, prunes, berries), vegetables and whole grains."] },
    ],
    avoid: ["Starting during a big change: a move, new baby, new daycare room", "Words that make poop sound disgusting", "Comparing them with other children"],
    articles: ["when-to-start", "getting-ready", "constipation"], videos: ["alberta-series", "cahs-ready", "pedsdoc-tips"], strategies: ["doll-demo", "bathroom-changes", "flush-bye", "cloth-liner", "model-sibling"],
  },
  {
    id: "sits", title: "Meet the potty", kidTitle: "Practice sits", emoji: "🪑",
    summary: "Short, happy practice sits at the easiest times — still in diapers between sits.",
    when: "Once your child can sit steadily and understands simple directions; often around 18–30 months.",
    goal: "Your child sits happily for a few minutes, and some pee or poop has landed in the potty.",
    steps: [
      { t: "Sit right after waking, 15–30 minutes after meals, before bath and before bed.", why: "Those are the times bodies naturally go; the meal sit uses the gastrocolic reflex." },
      { t: "Keep sits short: about 1 minute per year of age (2–3 minutes for most toddlers).", why: "Long sits turn into battles. CHOP recommends 1 minute per year, up to 10." },
      { t: "Diaper off, feet flat on the floor or a step stool, knees a little above hips.", why: "This position relaxes the pelvic floor so pee and poop come out easily." },
      { t: "Make it pleasant: a special potty-only book, a song, bubbles to blow.", why: "Blowing (bubbles, a pinwheel) gently uses the tummy muscles that help poops out." },
      { t: "Praise sitting, not just results. 'You sat on the potty like a big kid!'", why: "Effort is in their control; results aren't yet." },
      { t: "If anything comes out — celebrate! Let them see it and flush if they like.", why: "The first success is what makes it click." },
      { t: "Allow diaper-free time after a pee or poop, close to the potty.", why: "ERIC suggests up to 30 minutes nappy-off after they've just gone, when an accident is unlikely." },
      { t: "Log each sit and what happened.", why: "You're learning their timing for the next stage." },
    ],
    daily: ["Sit after waking", "Sit after breakfast", "Sit after lunch", "Sit after dinner", "Sit before bath or bed", "Praise every sit"],
    stuck: [
      { when: "Refuses to sit", try: ["Stop for a week, then try with clothes on.", "Offer choices: 'Big potty or little potty?' 'Elmo book or truck book?'", "Let a doll or stuffed animal go first.", "Try a different spot or potty — some kids hate the cold toilet seat."] },
      { when: "Sits but nothing ever comes out", try: ["Move the sit to 15–30 minutes after the biggest meal.", "Run water in the sink, or have them dip a hand in warm water (it can relax the bladder).", "Check the log for when they usually poop and sit then.", "Turn the tap off on battles: the goal right now is just sitting."] },
      { when: "Gets up after 5 seconds", try: ["Use the sit timer with a video or bubbles.", "Sit with them and read.", "Shorten the sit; consistency beats length."] },
    ],
    avoid: ["Holding them on the potty", "Sitting for 15+ minutes", "Showing disappointment when nothing happens"],
    articles: ["methods", "using-your-log", "rewards"], videos: ["supersimple-sitting", "msrachel", "danieltiger"], strategies: ["sit-timer-video", "bubbles", "first-then", "special-book", "choices"],
  },
  {
    id: "launch", title: "Bye-bye diapers", kidTitle: "Big kid pants", emoji: "🎉",
    summary: "The big switch: diapers off during the day and lots of practice, usually over a few days at home.",
    when: "When most readiness signs are there and you have 3 calm days at home.",
    goal: "More than half of pees land in the potty.",
    steps: [
      { t: "Choose a method (see Methods) and a start date with 3 days at home.", why: "Consistency in the first days matters more than which method you pick." },
      { t: "The night before, say goodbye to diapers together and let your child choose underwear.", why: "A little ceremony makes it a big-kid moment, not a loss." },
      { t: "Start with bare bottom or loose pants (some families skip underwear for the first day or two).", why: "Many kids treat snug underwear like a diaper at first." },
      { t: "Offer drinks often — 6–8 a day.", why: "More pee means more chances to practise and succeed." },
      { t: "Potty trips every 20–45 minutes at first, plus after waking and 15–30 minutes after meals.", why: "Lots of reps early; you'll stretch it out in the next stage." },
      { t: "Use statements, not questions: 'It's potty time', not 'Do you need to go?'", why: "Toddlers say 'no' to questions on reflex." },
      { t: "Watch for the signs: wiggling, holding, squatting, going quiet or hiding.", why: "Catching them mid-pee and getting a little in the potty still counts as a win." },
      { t: "Accidents: calm and matter-of-fact. 'Pee goes in the potty. Let's finish there.' Help them clean up.", why: "No shame, no punishment — it creates holding and fear (AAP, ERIC)." },
      { t: "Celebrate every success — stickers, a happy dance, a call to grandma.", why: "Immediate reward is what builds the habit." },
      { t: "Keep diapers or pull-ups for naps and nights only.", why: "Nights come much later; don't mix the two." },
      { t: "Log everything, especially accidents with the time.", why: "The pattern of accidents shows the reminder interval you need." },
    ],
    daily: ["Drinks every hour or so", "Potty every 20–45 min", "Sit after every meal", "Celebrate wins", "Calm clean-ups", "Log every trip and accident"],
    stuck: [
      { when: "Lots of accidents on day 1–2", try: ["Totally normal. Day 3 is usually better.", "Shorten the reminder interval to 20–30 minutes.", "Look at the accident times in the Log — remind 10 minutes before them.", "Keep going: switching back and forth confuses kids."] },
      { when: "They only go when I take them, never tell me", try: ["That's next stage's job. For now, prompted wins are wins.", "Praise loudly when they even look at the potty."] },
      { when: "Screams when it's time to sit", try: ["Back off to the 'Meet the potty' stage for a week or two.", "Offer a first-then: 'First potty, then bubbles.'", "Give control: they press the timer, choose the book, flush."] },
      { when: "After a week, still mostly accidents", try: ["Pause. Go back to diapers for 2–4 weeks without drama and keep doing sits (Mayo, ERIC).", "Check for constipation — it causes wetting too.", "Ask the AI coach with your log; it can spot patterns."] },
    ],
    avoid: ["Pull-ups for 'just this trip' in the first days (ERIC: it can undo learning)", "Asking 'do you need to go?' every 5 minutes", "Starting the week a sibling is born or you move"],
    articles: ["methods", "first-days", "accidents", "underwear-guide"], videos: ["pedsdoc-tips", "brenner", "cocomelon-potty", "babyshark"], strategies: ["bare-bottom", "statements", "drinks-up", "timer", "underwear-choice", "accident-practice"],
  },
  {
    id: "habit", title: "Building the habit", kidTitle: "Potty pro", emoji: "🔁",
    summary: "Turn early wins into a routine: space out reminders to your child's own rhythm and cut accidents.",
    when: "Right after the launch, once some pees land in the potty.",
    goal: "8 out of 10 pees in the potty and no more than one accident a day.",
    steps: [
      { t: "Use the predicted pee window: remind just before it, not on a fixed clock.", why: "The app learns their real gap between pees; most toddlers go every 1.5–2 hours." },
      { t: "Space reminders out gradually — 45, 60, 90 minutes.", why: "Teaches the bladder to hold and the child to notice fullness." },
      { t: "Anchor trips to transitions: before leaving, before screen time, before meals, before sleep.", why: "Routine beats nagging." },
      { t: "Short outings right after a potty trip — park, a quick shop.", why: "Build confidence away from home while the bladder is empty." },
      { t: "Dry-pants checks: 'Are you dry? Let's check!' and praise dry pants.", why: "Rewarding dryness (Azrin–Foxx) teaches holding, not just releasing." },
      { t: "Start fading rewards: sticker for each success, then for a dry morning, then a whole dry day.", why: "Rewards should get harder to earn, then disappear." },
    ],
    daily: ["Remind at the predicted times", "Potty before leaving", "Dry-pants checks", "Log who started each trip", "Stickers for wins"],
    stuck: [
      { when: "Accidents at the same time every day", try: ["Look at the Week view: remind 10–15 minutes before that time.", "Often it's during play or screen time — pause the show for a potty break."] },
      { when: "Accidents only at daycare", try: ["Share your schedule and words with staff (see Out & about).", "Send 3 spare outfits and a note on signs your child shows."] },
      { when: "Little dribbles in pants", try: ["They're stopping too soon or holding late. Practise sitting until the pee is 'all done'.", "Check for constipation and for a bladder infection if it's new."] },
    ],
    avoid: ["Going back to pull-ups in the daytime", "Punishing accidents", "Making every sit a performance"],
    articles: ["using-your-log", "rewards", "accidents"], videos: ["alberta-series", "danieltiger", "sesame-wait"], strategies: ["predicted-reminders", "transition-trips", "dry-checks", "fade-rewards", "potty-watch"],
  },
  {
    id: "self", title: "Telling you", kidTitle: "I can tell!", emoji: "🗣️",
    summary: "Your child starts noticing the feeling and going (or telling you) without a reminder.",
    when: "Once the habit is solid — most pees in the potty with reminders.",
    goal: "Half or more of potty trips started by your child.",
    steps: [
      { t: "Stop reminding at fixed times. Remind only at transitions.", why: "If you always remind, they never need to notice." },
      { t: "Celebrate telling you even louder than the pee itself.", why: "Self-starting is the real skill of potty training." },
      { t: "Name the feeling: 'Your tummy feels full and tight — that's your pee saying potty time.'", why: "Builds interoception — the sense of what's happening inside the body." },
      { t: "Let them own a timer or potty watch that reminds them.", why: "Moves the reminder from you to them." },
      { t: "Teach the signal for 'I need to go' — words, a sign, or a picture card.", why: "Essential for children who don't talk much yet." },
      { t: "Log 'self' vs 'prompted' on every trip.", why: "The app shows the self-started percentage climbing." },
    ],
    daily: ["Remind only at transitions", "Cheer every self-started trip", "Body check: 'Do you feel the potty feeling?'", "Log self vs prompted"],
    stuck: [
      { when: "Waits until the last second", try: ["Practise 'stop and go right away' (Daniel Tiger song).", "Pause play together for a quick body check every hour.", "Keep a potty near play spaces again for a few weeks."] },
      { when: "Never tells, just has accidents when not reminded", try: ["Go back to prompts for a week, then fade by 15 minutes every few days.", "Use a picture card they can hand you.", "Reward telling, even if they tell too late."] },
    ],
    avoid: ["Asking every 10 minutes", "Making them stop play abruptly without warning"],
    articles: ["using-your-log", "rewards"], videos: ["danieltiger", "sesame-wait", "msrachel"], strategies: ["body-check", "potty-watch", "talk-card", "reward-telling", "stop-and-go"],
  },
  {
    id: "poop", title: "Poop on the potty", kidTitle: "Poop goes in the potty", emoji: "💩",
    summary: "Poop often takes weeks or months longer than pee. Timing, position and comfort make it happen.",
    when: "Usually alongside or after pee training. Many children pee on the potty but ask for a diaper to poop.",
    goal: "3 of the last 4 poops in the potty, soft and painless.",
    steps: [
      { t: "Sit 15–30 minutes after the biggest meals, especially breakfast and lunch.", why: "The gastrocolic reflex makes poops most likely then (UVM Continence Project)." },
      { t: "Feet supported, knees above hips, lean forward, elbows on knees.", why: "This 'squat' position straightens the path out and relaxes the muscles." },
      { t: "Blow bubbles, a pinwheel or a balloon while sitting.", why: "Gently uses the tummy muscles to push without straining (CHOP I-SIT)." },
      { t: "Give privacy if they want it — some kids hide to poop.", why: "Hiding to poop is a readiness sign, not a problem." },
      { t: "Track poop type on the stool chart. Aim for type 3–4.", why: "Hard poops hurt; children who've been hurt hold on." },
      { t: "If they'll only poop in a diaper: let them, but in the bathroom. Then diaper on while sitting on the potty. Then cut a hole in it.", why: "A gentle step-by-step bridge that works for many 'diaper-only poopers'." },
      { t: "Never force or rush. Praise and celebrate poop in the potty with a bigger reward.", why: "Poop fear is real; pressure makes withholding worse." },
    ],
    daily: ["Sit after breakfast", "Sit after lunch", "Feet on a stool", "Log poop and its type", "Water, fruit and vegetables"],
    stuck: [
      { when: "Hides to poop in pants or asks for a diaper", try: ["Use the diaper-on-the-potty bridge.", "Read 'It Hurts When I Poop!' or watch 'The Poo in You' (for you).", "Big reward for poop in the potty — a special prize box."] },
      { when: "Holds it in for days", try: ["This is withholding — go to the constipation article and talk to your doctor.", "Pause pee pressure too; focus on soft, painless poops first.", "Never punish: the cycle is pain → fear → holding → harder poop."] },
      { when: "Scared of the flush or the poop 'falling'", try: ["Don't flush until they've left.", "Put a little toilet paper in the bowl first so there's no splash.", "Use a floor potty for poops for a while."] },
    ],
    avoid: ["Calling poop gross", "Long straining sits", "Punishing poop accidents"],
    articles: ["poop", "constipation", "bristol"], videos: ["lurie-wont-poop", "poo-in-you", "akron-poo", "pinkfong-poopoo"], strategies: ["meal-sits", "footstool", "bubbles", "diaper-bridge", "poop-prize", "fiber-water", "privacy"],
  },
  {
    id: "outings", title: "Out, about and daycare", kidTitle: "Potty anywhere", emoji: "🚗",
    summary: "Take the skills on the road: car trips, shops, public restrooms, daycare and preschool.",
    when: "Once the habit is solid at home.",
    goal: "Potty trips while out, with no accidents.",
    steps: [
      { t: "Potty before you leave and as soon as you arrive anywhere.", why: "The simplest rule, and it prevents most outing accidents." },
      { t: "Pack a go-bag: 2–3 changes of clothes, wipes, bags, a travel potty or fold-up seat.", why: "Confidence for both of you." },
      { t: "Cover automatic-flush sensors with a sticky note or your hand.", why: "Surprise flushes scare a lot of toddlers off public toilets." },
      { t: "Use a waterproof seat cover for the car seat, not a pull-up.", why: "ERIC advises against pull-ups for outings — they can undo learning." },
      { t: "Hand daycare your words, your signs, your schedule and the predicted times.", why: "Same words and routine everywhere speeds things up." },
      { t: "Ask staff to note potty trips and accidents and log them with 'daycare'.", why: "The log then shows whether accidents cluster at daycare." },
    ],
    daily: ["Potty before leaving", "Potty on arrival", "Go-bag packed", "Tell daycare the plan"],
    stuck: [
      { when: "Refuses public toilets", try: ["Bring the travel potty or a fold-up seat.", "Let them press the flush or cover the sensor.", "Practise in quiet restrooms first (library, café)."] },
      { when: "Accidents in the car", try: ["Potty right before getting in, every time.", "Keep a travel potty in the trunk for stops."] },
    ],
    avoid: ["Leaving without a potty stop", "Shaming accidents in public"],
    articles: ["outings", "daycare"], videos: ["alberta-series", "alberta-outside"], strategies: ["go-before-leave", "sensor-cover", "travel-potty", "daycare-handoff"],
  },
  {
    id: "naps", title: "Naps", kidTitle: "Dry naps", emoji: "😴",
    summary: "Naps usually go dry before nights. Potty before and after, and drop the nap diaper once it's dry some of the time.",
    when: "Once daytime is mostly dry.",
    goal: "5 of the last 7 naps dry.",
    steps: [
      { t: "Potty right before nap and immediately on waking.", why: "ERIC: use the potty just before naps and again on waking." },
      { t: "Log dry and wet naps.", why: "When most are dry, the diaper can go." },
      { t: "Stop the nap diaper once it's dry at least some of the time; use a waterproof sheet.", why: "ERIC's guidance — it moves things along." },
    ],
    daily: ["Potty before nap", "Potty on waking", "Log nap dry or wet"],
    stuck: [{ when: "Always wet after naps", try: ["Smaller drink at lunch, but don't restrict drinks overall.", "Wake-up sit within 1–2 minutes of opening their eyes.", "Keep the nap diaper a few more weeks — no rush."] }],
    avoid: ["Restricting drinks all day"],
    articles: ["naps-nights"], videos: ["alberta-nights"], strategies: ["pre-nap-sit", "waterproof-sheet"],
  },
  {
    id: "nights", title: "Nights", kidTitle: "Dry nights", emoji: "🌙",
    summary: "Night dryness depends on body development, not effort. Help it along without pressure.",
    when: "Often months or years after daytime. Most children are dry at night between 5 and 7.",
    goal: "7 dry nights in a row, then try without a pull-up.",
    steps: [
      { t: "Keep pull-ups or night pants without shame; call them 'night pants'.", why: "Bedwetting is common through age 5; many children under 6 can't stay dry yet (AAP)." },
      { t: "No drinks in the last hour before bed; plenty during the day.", why: "ERIC's advice — restricting all day concentrates urine and irritates the bladder." },
      { t: "Last potty as part of the bedtime routine, every night.", why: "An empty bladder at lights-out." },
      { t: "Screen-free hour before sleep; night light on the path to the bathroom.", why: "Better sleep, easier trips." },
      { t: "Log dry and wet mornings.", why: "When you see a run of dry mornings, it's time to try without." },
      { t: "Try nights without a pull-up after about a week of dry mornings; use a mattress protector.", why: "Low-stress trial; go back without fuss if it isn't working." },
    ],
    daily: ["Plenty of drinks in the day", "Last drink an hour before bed", "Last potty at bedtime", "Log the morning"],
    stuck: [
      { when: "Still wet every night at 5+", try: ["ERIC says to seek advice at 5; treatments exist (alarms, medication) and work.", "Check for constipation — a full bowel presses on the bladder.", "Watch 'Nighttime Wetting' from Lurie Children's."] },
      { when: "Was dry, now wetting again", try: ["Look for stress, illness, constipation or a new sibling.", "New wetting with pain, thirst or daytime accidents: see the doctor."] },
    ],
    avoid: ["Waking or 'lifting' them to pee at night (ERIC: it can stop them learning to wake)", "Punishing wet beds", "Cutting drinks all day"],
    articles: ["naps-nights", "constipation"], videos: ["alberta-nights", "lurie-night"], strategies: ["evening-drinks", "bedtime-sit", "night-pants", "mattress-protector", "night-light"],
  },
  {
    id: "independent", title: "Doing it all", kidTitle: "All by myself", emoji: "🏆",
    summary: "The finishing skills: wiping, flushing, handwashing, clothes, public restrooms — and standing to pee for boys.",
    when: "Through ages 3–5. Many children need help wiping poop until 4 or 5.",
    goal: "Goes on their own, start to finish, most of the time.",
    steps: [
      { t: "Wiping: girls front to back; show how much paper; check and help with poop wipes.", why: "Front-to-back helps prevent bladder infections in girls." },
      { t: "Handwashing: wet, soap, scrub 20 seconds (sing), rinse, dry — every time.", why: "Use the handwashing song video." },
      { t: "Pants down and up independently: elastic waists, no tricky buttons for now.", why: "Clothes are a common cause of 'just too late' accidents." },
      { t: "Boys: switch to standing for pee only once poop on the potty is solid. A cereal target helps aim.", why: "Mayo Clinic: learn sitting first, then standing." },
      { t: "Practise in different bathrooms: grandma's, the library, school.", why: "Generalising the skill to new places." },
      { t: "Fade rewards to praise and pride.", why: "The goal is a habit, not a sticker economy." },
    ],
    daily: ["Wipe + flush + wash every time", "Practice in a new bathroom", "Praise independence"],
    stuck: [{ when: "Won't wipe", try: ["Teach in steps: you start, they finish.", "Use flushable wipes only if your plumbing allows; otherwise put them in the bin.", "A visual step card on the wall."] }],
    avoid: ["Standing to pee before poop is mastered"],
    articles: ["boys", "girls", "outings"], videos: ["handwash", "sesame-routines"], strategies: ["wipe-steps", "cereal-target", "visual-steps"],
  },
];
export const stageById = (id: StageId) => STAGES.find((s) => s.id === id) || STAGES[0];
export const stageIndex = (id: StageId) => Math.max(0, STAGES.findIndex((s) => s.id === id));

// ─── Readiness ───
export const READINESS: { id: string; sign: string; why: string }[] = [
  { id: "dry2h", sign: "Stays dry for about 2 hours, or wakes up dry from naps", why: "The bladder can hold long enough to make it to the potty." },
  { id: "regular", sign: "Poops at fairly regular times, 3 or fewer a day, and they're soft", why: "Predictable poops make timing sits easy; hard ones need sorting first." },
  { id: "signals", sign: "Shows or tells you when they're peeing or pooping (hides, squats, goes quiet)", why: "Awareness of the feeling is the first skill training builds on." },
  { id: "interest", sign: "Is curious about the toilet or follows you into the bathroom", why: "Copying grown-ups is a strong motivator at this age." },
  { id: "dislikes", sign: "Doesn't like being in a wet or dirty diaper, or comes to you to be changed", why: "Discomfort gives a natural reason to use the potty." },
  { id: "pants", sign: "Can pull pants down and up, with a little help", why: "Independence makes the potty quicker." },
  { id: "follows", sign: "Follows simple directions (\"get your book and sit down\")", why: "Training is a sequence of steps." },
  { id: "sits", sign: "Can walk to the bathroom and sit for a few minutes", why: "Needed for 2–5 minute sits." },
  { id: "words", sign: "Has words or signs for pee and poop, or asks one-word questions", why: "Lets them ask, and lets you talk about it." },
  { id: "wants", sign: "Wants underwear or asks to use the potty", why: "Interest from the child is the best predictor of a calm, quick training." },
];
export function readinessVerdict(checked: number, months: number | null): { title: string; text: string; tone: "go" | "soon" | "wait" } {
  if (checked >= 7 || (checked >= 5 && months !== null && months >= 30)) return { tone: "go", title: "Looks ready", text: "Most signs are there. Pick a calm stretch at home and move on to the next stage." };
  if (checked >= 4) return { tone: "soon", title: "Getting close", text: "Some signs are there. Keep up the groundwork and start practice sits now — they build the missing skills." };
  return { tone: "wait", title: "Groundwork time", text: months !== null && months >= 42 ? "Many signs aren't showing yet. Keep going with practice sits, and mention it to your child's doctor — the AAP and Mayo Clinic suggest checking in if a child over 3 isn't trained in the day." : "Starting intensive training too early tends to make it take longer (Pediatrics, 2003). Keep the groundwork going and check again in a few weeks." };
}

// ─── Methods ───
export type Method = { id: MethodId; name: string; also: string; summary: string; bestFor: string; evidence: string; how: string[] };
export const METHOD_LIST: Method[] = [
  { id: "child", name: "Child-led (gradual)", also: "Brazelton method · the AAP's approach",
    summary: "Go at your child's pace in small steps over weeks: practice sits, then bare-bottom time, then underwear. Lots of praise, no pressure.",
    bestFor: "Most families, younger toddlers, busy households, daycare, and children who push back when pushed.",
    evidence: "In Brazelton's 1962 study of about 1,170 children the average child was dry in the day at about 28½ months with very few problems. Reviews (American Family Physician, 2008) rate it effective.",
    how: ["Meet the potty with clothes on, then off.", "Sit at the natural times every day.", "Bare-bottom time near the potty.", "Underwear once they use the potty most of the time.", "Night pants until dry mornings."] },
  { id: "intensive", name: "Intensive (\"in less than a day\")", also: "Azrin–Foxx method",
    summary: "One focused day: a doll that 'uses the potty', lots of drinks, prompts every 15 minutes, dry-pants checks and immediate rewards.",
    bestFor: "Children clearly ready (usually 2½+), and a parent who can give one full, calm day.",
    evidence: "In the original study children trained in about 4 hours on average; reviews found 74–100% success. Starting before about 27 months showed little benefit (Pediatrics, 2003).",
    how: ["Doll demonstration first.", "Plenty to drink.", "Prompt every 15 minutes; check pants every few minutes.", "Praise and a tiny treat for dry pants and every potty pee.", "After accidents, calm practice walks to the potty.", "Stretch the prompts out by the afternoon."] },
  { id: "threeday", name: "3-day bare-bottom", also: "Popular weekend plan (e.g. Lora Jensen, 'Oh Crap!' style)",
    summary: "Three days home, mostly bare-bottom, watching closely and scooping them to the potty at the first sign.",
    bestFor: "Children over about 2 with most readiness signs, and a family that can stay home for a long weekend.",
    evidence: "Very widely used by parents; not studied in trials the way the two above have been. It borrows their key ingredients: lots of practice, quick praise, calm accidents.",
    how: ["Day 1: bare-bottom, drinks, watch closely, scoop to the potty.", "Day 2: loose pants, no underwear; a short outing right after a potty.", "Day 3: underwear on; fewer reminders.", "Diapers for nap and night."] },
  { id: "scheduled", name: "Scheduled sits", also: "Timed toileting — used in clinics and schools",
    summary: "Short sits at set times every day whether or not your child says they need to go, with praise for sitting and rewards for success.",
    bestFor: "Children who don't notice the urge yet, many children with autism or developmental delays, daycare and school routines.",
    evidence: "Part of most clinic toileting programmes for children with additional needs (AAP; ERIC; UVM Continence Project).",
    how: ["Log 10–14 days first.", "Set sits just before their usual times.", "Sits of 1 minute per year of age.", "Fade as successes grow."] },
  { id: "data", name: "Data-driven plan", also: "The bladder & bowel diary approach",
    summary: "Log drinks, meals, pees and poops for 10–14 days; the app learns the rhythm and predicts the windows to sit.",
    bestFor: "Anyone — and especially children who can't tell you yet, or when other methods stalled.",
    evidence: "How continence specialists build schedules: collect 10–14 days of data, then set sits to the child's own pattern (University of Vermont Continence Project).",
    how: ["Log everything for 1–2 weeks (diapers count).", "Follow the predicted pee and poop windows.", "Sit 15–30 minutes after meals.", "Adjust as the predictions sharpen."] },
];
export const methodById = (id: MethodId) => METHOD_LIST.find((m) => m.id === id) || METHOD_LIST[0];
