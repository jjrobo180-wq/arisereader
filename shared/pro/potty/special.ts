// Children with additional needs: a guide for each (autism, Down syndrome, cerebral palsy, spina
// bifida, developmental delay, ADHD, speech and language, sensory processing, vision, hearing,
// medical/constipation history), and the tools that go with them — picture steps, talk cards,
// first–then, a personalised social story, a sensory checklist and body checks.
// Sources: AAP "Potty training children with special needs"; ERIC "Potty training children with
// additional needs"; Autism Speaks ATN/AIR-P toilet training guide; University of Vermont
// Continence Project; Down Syndrome UK/ERIC Pants4School.
import type { Child, NeedId, VisualStep } from "./model";

export type NeedGuide = { id: NeedId; label: string; emoji: string; about: string; keys: string[]; adapt: string[]; help: string[]; videos: string[] };
export const NEEDS: NeedGuide[] = [
  { id: "autism", label: "Autism", emoji: "🧩",
    about: "Autistic children can and do learn to use the toilet. It often takes longer, and success usually comes from a predictable routine, visual supports and finding what in the bathroom feels uncomfortable — not from waiting for readiness signs that may never come.",
    keys: [
      "Start the groundwork early and change slowly: sudden changes are hard (ERIC).",
      "Don't rely on your child telling you. Log 10–14 days and take them at set times based on the log (ERIC, UVM).",
      "Use visual supports for every step: a picture sequence on the wall, first–then boards, a social story.",
      "Social praise may not motivate. Use a small, immediate reward your child truly wants, given right after success (AAP).",
      "Find sensory triggers: the flush noise, echo, smell, cold seat, bright light, hand dryer (AAP).",
      "Constipation is more common in autistic children — treat it first (ERIC).",
      "Teach one step at a time, starting with peeing and pooping in the toilet; signalling, wiping and washing come later (AAP).",
      "Video modeling helps many children: watching the steps done slowly, again and again.",
    ],
    adapt: [
      "Use the picture steps on the wall at eye level; point to each step every time.",
      "Use the same words, same bathroom, same order every time at first, then vary gradually.",
      "Hand them the 'toilet' card before each trip; later, wait for them to hand it to you.",
      "Fix sensory troubles with the sensory checklist below.",
      "Keep a favourite, potty-only reward ready and give it within seconds.",
      "If you're stuck, intensive reinforcement-based programmes adapted from Azrin & Foxx have helped many autistic children — ask a BCBA or your child's therapist.",
    ],
    help: ["Your child's pediatrician (rule out constipation first)", "A behaviour analyst (BCBA) or psychologist", "An occupational therapist for sensory issues", "Autism Speaks ATN/AIR-P toilet training guide (in Learn → Resources)"],
    videos: ["kki-asd", "seattle-asd", "bridgekids-asd", "bravekid-boys", "harkla-sensory"] },
  { id: "down", label: "Down syndrome", emoji: "💛",
    about: "Most children with Down syndrome learn to use the toilet; it often starts and finishes later. Low muscle tone and constipation are the main hurdles, and good support for sitting makes a big difference.",
    keys: [
      "Start practice sits early; the longer a child stays in diapers, the harder the switch can be (ERIC).",
      "Low muscle tone: give full support — a seat reducer, step stool, and handles or a supportive potty so they feel stable.",
      "Constipation is common; keep poops soft (water, fibre) and treat it before pushing training.",
      "Use signs (many children with Down syndrome use signing) and visual supports.",
      "Break each skill into tiny steps and practise them separately (pants down, sit, wipe…).",
      "Expect a longer timeline and celebrate small steps — 'inchstones'.",
    ],
    adapt: ["Supportive seat with a backrest or handles", "Signs for toilet, help, all done", "Scheduled sits from the log", "Pants4School step-by-step programme (ERIC with Down syndrome charities)"],
    help: ["Pediatrician", "Physical or occupational therapist for seating", "Local Down syndrome association"],
    videos: ["dsrf-ds", "littleleaf-ds", "emerge-complex"] },
  { id: "cp", label: "Cerebral palsy & motor difficulties", emoji: "♿",
    about: "Bladder control can develop more slowly, and sitting securely and managing clothes may need equipment and help. Awareness comes first; training usually works best a little later (AAP).",
    keys: [
      "Build awareness first: name it at every change, notice cues like fidgeting or clutching (AAP).",
      "Your child must be able to sit securely with support — ask an OT or physical therapist about an adapted potty seat.",
      "Watch for constipation from low activity, low tone or medication; encourage fluids and fibre (AAP).",
      "Velcro and loose elastic waists; let them lie down to undress if that's easier (AAP).",
      "Let them do the last part of each task themselves (ERIC).",
    ],
    adapt: ["Adapted or supportive toilet seat", "Grab rails, footrest", "Easy-on clothing", "Scheduled sits"],
    help: ["Pediatrician or developmental pediatrician", "Occupational and physical therapists", "Rehabilitation engineer for equipment (AAP)"],
    videos: ["emerge-complex", "uvm-position"] },
  { id: "spina", label: "Spina bifida & spinal cord conditions", emoji: "🩺",
    about: "Most children with spina bifida or spinal cord injury don't feel the need to pee, so the goal is different: regular catheterisation and a bowel programme set up with your medical team (AAP).",
    keys: [
      "Work with the urology and continence team on catheterisation and a bowel routine.",
      "Scheduled bowel times at home (not school) are often the aim.",
      "A high-fibre diet, enough fluids and regular meal times help; stool softeners, suppositories or enemas may be prescribed (AAP).",
      "Teach independence in catheterising when ready; a school nurse or aide can help until then.",
    ],
    adapt: ["Use the app's log for catheter times and bowel results (as notes)", "Schedule builder for a bowel-programme routine"],
    help: ["Spina bifida clinic / urology", "Continence nurse", "School nurse"],
    videos: [] },
  { id: "delay", label: "Developmental delay & intellectual disability", emoji: "🌻",
    about: "Most children can be trained; it may take a few months to a year or more (AAP). Keep it simple, consistent and motivating.",
    keys: [
      "Check diapers about every hour and say one word: 'Wet!' or 'Dry!' (AAP).",
      "Sit often at first, then shift to your child's usual times; sits of 5–10 minutes with company, books or music (AAP).",
      "Teach one step at a time — pee and poop in the toilet first; signalling, undressing, wiping and washing later.",
      "Let them watch peers; use a doll to show the steps.",
      "Motivation matters more than speed (AAP).",
    ],
    adapt: ["Hourly checks logged as dry checks", "Picture steps", "Doll demonstration"],
    help: ["Pediatrician", "Early intervention or special education team", "OT"],
    videos: ["uvm-readiness", "emerge-complex"] },
  { id: "adhd", label: "ADHD & attention differences", emoji: "⚡",
    about: "Children with ADHD often know the feeling but get too absorbed to stop, or rush off before they're finished. Structure, timers and short, active rewards help.",
    keys: [
      "Use timers and transition trips rather than relying on them to notice.",
      "Keep sits short and engaging (the sit timer with a video).",
      "Watch for rushing: count to 10 and try again before getting up ('double voiding').",
      "Immediate, concrete rewards work better than long-term charts (AAP).",
      "Constipation and daytime wetting are more common — log poops.",
    ],
    adapt: ["Potty watch", "Sit timer + video", "Quick wins and immediate stickers"],
    help: ["Pediatrician", "Behavioural therapist"],
    videos: ["sesame-wait", "danieltiger"] },
  { id: "speech", label: "Speech & language delay / non-speaking", emoji: "🖐️",
    about: "A child who can't tell you yet can still be trained. You take more responsibility for timing, and you give them a way to communicate.",
    keys: [
      "Don't wait for them to tell you: use the log and take them at set times (ERIC).",
      "Pair words with signs, pictures or a device every time (ERIC).",
      "Give a 'toilet' card or sign they use before every trip; then wait for them to use it.",
      "If they wet at another time, take them quickly, try to get some in the toilet, praise that, and finish the routine (ERIC).",
    ],
    adapt: ["Talk cards (tap to speak)", "ASL toilet sign", "Picture steps"],
    help: ["Speech-language pathologist (AAC support)", "Pediatrician"],
    videos: ["msrachel", "bravekid-boys"] },
  { id: "sensory", label: "Sensory processing differences", emoji: "🎧",
    about: "For some children the bathroom is loud, echoey, cold, bright and smelly. Fixing what's uncomfortable often unlocks training (AAP).",
    keys: [
      "Use the sensory checklist to find what bothers them.",
      "Ear defenders for flushes and hand dryers; flush after they leave.",
      "Padded seat, socks or a mat for cold floors, dimmer light.",
      "Unscented wipes and cleaners.",
      "Some children don't feel the 'full bladder' signal (interoception) — use timed trips and body checks.",
    ],
    adapt: ["Sensory checklist", "Body checks", "Sit timer"],
    help: ["Occupational therapist"],
    videos: ["harkla-sensory", "uvm-readiness"] },
  { id: "vision", label: "Blind or low vision", emoji: "👁️",
    about: "Training may start a little later (around 3–4) because it relies more on explanation. Exploration and consistency make it work (AAP).",
    keys: [
      "Let your child explore the bathroom by touch; guide their hands to the paper, flush and sink (AAP).",
      "Keep the potty in one place and the path clear; consider a musical potty (AAP).",
      "Teach feeling for the seat edge; boys sit to pee first (AAP).",
      "Practise in different public restrooms to build confidence.",
    ],
    adapt: ["Talk cards with voice", "Consistent layout", "Verbal step-by-step"],
    help: ["Vision teacher / orientation & mobility specialist"],
    videos: [] },
  { id: "hearing", label: "Deaf or hard of hearing", emoji: "👂",
    about: "Children fluent in sign language train much like others. Choose one sign for each key word and use it every time (AAP).",
    keys: [
      "Pick one consistent sign for pee, poop, potty, wet, dry and 'need to go' (AAP).",
      "Use them at every change and trip.",
      "Keep it visual: picture books, picture steps, watching others.",
      "Use visual or vibrating timers instead of sound alerts.",
    ],
    adapt: ["ASL signs", "Picture steps", "Vibrating potty watch"],
    help: ["Teacher of the deaf", "Speech-language pathologist"],
    videos: ["msrachel"] },
  { id: "medical", label: "Constipation history or medical conditions", emoji: "🩹",
    about: "Constipation and withholding derail more potty training than anything else. Treat the bowel first, then train.",
    keys: [
      "Look for: 2 or fewer poops a week, hard or huge poops, pain, blood on paper, holding postures, soiling.",
      "ERIC: if constipation is suspected — stop, treat, then restart once it's under control (keep practice sits going).",
      "Doctors often use a 'clean-out' then maintenance softener for months; don't stop early.",
      "Log poop type daily; aim for type 3–4.",
    ],
    adapt: ["Bristol stool logging", "Sits after meals", "Footstool position"],
    help: ["Pediatrician", "Pediatric gastroenterologist", "Continence nurse"],
    videos: ["poo-in-you", "lurie-wont-poop", "akron-poo", "uvm-position"] },
];
export const needById = (id: NeedId) => NEEDS.find((n) => n.id === id);

// ─── Picture steps (ERIC's nine-step routine plus optional extras) ───
export const DEFAULT_STEPS: Omit<VisualStep, "on">[] = [
  { id: "go", emoji: "🚶", label: "Go to the bathroom" },
  { id: "light", emoji: "💡", label: "Lights on" },
  { id: "pants", emoji: "👖", label: "Pants down" },
  { id: "undies", emoji: "🩲", label: "Underwear down" },
  { id: "sit", emoji: "🚽", label: "Sit on the potty" },
  { id: "go-potty", emoji: "💧", label: "Pee and poop in the potty" },
  { id: "wipe", emoji: "🧻", label: "Wipe" },
  { id: "undies-up", emoji: "⬆️", label: "Underwear up" },
  { id: "pants-up", emoji: "👕", label: "Pants up" },
  { id: "flush", emoji: "🌊", label: "Flush" },
  { id: "wash", emoji: "🧼", label: "Wash hands" },
  { id: "dry", emoji: "🧺", label: "Dry hands" },
  { id: "done", emoji: "⭐", label: "All done!" },
];
export const defaultVisual = (): VisualStep[] => DEFAULT_STEPS.map((s) => ({ ...s, on: s.id !== "light" }));
export const STEP_EMOJIS = ["🚶", "💡", "👖", "🩲", "🚽", "💧", "💩", "🧻", "⬆️", "👕", "🌊", "🧼", "🧺", "⭐", "🪜", "🫧", "📖", "🎵", "🙌", "🎁", "🦶", "🚪", "🧸", "✋"];

// ─── Talk cards ───
export const TALK_CARDS: { id: string; emoji: string; text: string; color: string }[] = [
  { id: "need", emoji: "🚽", text: "I need to go potty", color: "#3D8BFD" },
  { id: "pee", emoji: "💧", text: "Pee", color: "#3D8BFD" },
  { id: "poop", emoji: "💩", text: "Poop", color: "#9A6B47" },
  { id: "help", emoji: "🙋", text: "Help me, please", color: "#7C5CFF" },
  { id: "wet", emoji: "💦", text: "I'm wet", color: "#E26D5A" },
  { id: "done", emoji: "✅", text: "All done", color: "#22A06B" },
  { id: "wash", emoji: "🧼", text: "Wash hands", color: "#17A2B8" },
  { id: "hurts", emoji: "🤕", text: "It hurts", color: "#C2553F" },
  { id: "wait", emoji: "✋", text: "Wait, please", color: "#64748B" },
  { id: "scared", emoji: "😟", text: "I'm scared", color: "#9496D9" },
];

// ─── Sensory checklist ───
export const SENSORY: { id: string; trigger: string; signs: string; fix: string[] }[] = [
  { id: "flush", trigger: "Flush noise", signs: "Covers ears, runs out, refuses after flushing", fix: ["Flush after they leave the room", "Ear defenders", "Let them control the flush when ready", "Put the lid down before flushing"] },
  { id: "dryer", trigger: "Hand dryers & echoes", signs: "Distress in public restrooms", fix: ["Ear defenders", "Use paper towels or bring a small towel", "Practise in quiet restrooms first"] },
  { id: "cold", trigger: "Cold seat or floor", signs: "Jumps off, won't sit", fix: ["Padded or warm seat cover", "Socks or a soft mat", "Warm the room before trips"] },
  { id: "height", trigger: "Feeling unstable / fear of falling", signs: "Grips tightly, won't relax", fix: ["Seat reducer that fits snugly", "Wide step stool so feet are planted", "Handles or a floor potty"] },
  { id: "smell", trigger: "Smells", signs: "Gags, holds nose, avoids the room", fix: ["Unscented cleaners", "Open a window or fan", "Empty the potty straight away"] },
  { id: "light", trigger: "Bright lights", signs: "Squints, covers eyes", fix: ["Dim lights or a lamp", "Natural light where possible"] },
  { id: "paper", trigger: "Toilet paper or wipe texture", signs: "Won't wipe, cries when wiped", fix: ["Try soft paper, damp paper or unscented wipes", "Warm wipes", "Let them hold the paper"] },
  { id: "clothes", trigger: "Clothes on/off", signs: "Distress at undressing", fix: ["Loose, soft clothes with elastic waists", "Undress in steps", "Keep shirt on, a towel on the lap"] },
  { id: "splash", trigger: "Splash or water touching them", signs: "Jumps up mid-poop", fix: ["A little toilet paper in the bowl first", "Floor potty for poops"] },
  { id: "space", trigger: "Small, enclosed space / echo", signs: "Panics with the door shut", fix: ["Leave the door open", "Stay with them", "Play quiet music"] },
  { id: "interoception", trigger: "Doesn't feel the 'full' signal", signs: "Accidents without any warning signs", fix: ["Timed trips from the log", "Body checks", "Interval watch"] },
];

// ─── Social story ───
/** A personalised story in the style of a social story: simple, positive, first person. */
export function socialStory(child: Pick<Child, "name" | "words" | "sex">): { title: string; pages: { text: string; emoji: string }[] } {
  const n = child.name || "I"; const w = child.words;
  return {
    title: `${n === "I" ? "My" : `${n}'s`} potty story`,
    pages: [
      { emoji: "🙂", text: `My name is ${n}. I am learning to use the ${w.potty}.` },
      { emoji: "💭", text: `Sometimes my body tells me I need to ${w.pee} or ${w.poop}. My tummy might feel full or wiggly.` },
      { emoji: "🚶", text: `When I feel that, I stop what I am doing and go to the bathroom. My toys will wait for me.` },
      { emoji: "🗣️", text: `I can tell a grown-up "${w.potty}!" or show my card. Grown-ups like to help.` },
      { emoji: "👖", text: `I pull my pants and underwear down.` },
      { emoji: "🚽", text: `I sit on the ${w.potty}. My feet rest on the stool. I can take big, slow breaths.` },
      { emoji: "💧", text: `${w.pee[0].toUpperCase() + w.pee.slice(1)} and ${w.poop} go in the ${w.potty}. That is where they belong.` },
      { emoji: "🧻", text: `When I am finished, I wipe. Then I pull my underwear and pants up.` },
      { emoji: "🌊", text: `I can flush. The water makes a loud sound, and that is okay. It goes away.` },
      { emoji: "🧼", text: `I wash my hands with soap and water, and dry them.` },
      { emoji: "💛", text: `Sometimes I have an accident. That is okay. I am still learning, and next time I can try again.` },
      { emoji: "⭐", text: `When I use the ${w.potty}, the grown-ups are happy, and I feel proud of me!` },
    ],
  };
}
export const BODY_CHECKS = [
  "Put your hand on your tummy. Does it feel full or tight?",
  "Are you wiggling? Wiggles can mean your pee is ready.",
  "Does your bottom feel like it needs to push? That's poop saying hello.",
  "Let's check: are your pants dry?",
  "Take a big breath. What is your body telling you?",
];
