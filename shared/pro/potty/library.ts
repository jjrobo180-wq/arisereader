// Videos (real YouTube videos, each checked to exist and allow embedding), trusted web resources,
// the underwear and gear guide, books, and the signs a child needs to go.

export type Video = {
  id: string;
  /** YouTube video id, or a playlist id when `playlist` is set. */
  yt: string; playlist?: boolean;
  title: string; channel: string;
  audience: "kids" | "parents";
  topic: "songs" | "shows" | "modeling" | "handwashing" | "basics" | "poop" | "nights" | "autism" | "down" | "complex" | "outings";
  about: string;
};
export const VIDEO_TOPICS: Record<Video["topic"], string> = {
  songs: "Potty songs", shows: "Shows", modeling: "Step-by-step (video modeling)", handwashing: "Handwashing",
  basics: "Getting started", poop: "Poop & constipation", nights: "Nights & bedwetting", autism: "Autism",
  down: "Down syndrome", complex: "Complex & sensory needs", outings: "Out & about",
};
export const VIDEOS: Video[] = [
  // For kids
  { id: "msrachel", yt: "qXKsou9UmfY", title: "Potty Training with Ms Rachel", channel: "Ms Rachel", audience: "kids", topic: "shows", about: "Ms Rachel walks through using the potty with songs, signs and lots of repetition." },
  { id: "danieltiger", yt: "Xk1UJ4ZeQMI", title: "When You Have to Go Potty, Stop… and Go Right Away!", channel: "Daniel Tiger's Neighborhood", audience: "kids", topic: "songs", about: "The classic 'stop and go right away' song — teaches stopping play when the body says it's time." },
  { id: "sesame-wait", yt: "6TpuZvwMXjo", title: "It'll Wait for You (Potty Song)", channel: "Sesame Street", audience: "kids", topic: "songs", about: "Elmo sings that the toys will still be there after the potty — great for kids too busy playing." },
  { id: "supersimple-sitting", yt: "_RQFMyof650", title: "Sitting on the Potty", channel: "Super Simple Songs", audience: "kids", topic: "songs", about: "Calm, repetitive song for sit time." },
  { id: "cocomelon-potty", yt: "O0nV7hJ9qzk", title: "Potty Training Song", channel: "CoComelon", audience: "kids", topic: "songs", about: "JJ learns to use the potty step by step." },
  { id: "cocomelon-gotta-go", yt: "D0EMbtt3CGU", title: "When You Gotta Go, You Gotta Go!", channel: "CoComelon", audience: "kids", topic: "songs", about: "About noticing the feeling and heading to the potty." },
  { id: "babyshark", yt: "jCZJrLQjWPs", title: "Baby Shark's Potty Song", channel: "Pinkfong Baby Shark", audience: "kids", topic: "songs", about: "Baby Shark's potty routine, for Baby Shark fans." },
  { id: "pinkfong-poopoo", yt: "WP6QpTaYZ_A", title: "Hello, Poo Poo!", channel: "Pinkfong", audience: "kids", topic: "songs", about: "A silly dance song that makes poop friendly, not scary." },
  { id: "handwash", yt: "KgCjQBIZ-BM", title: "First We Wash Our Hands", channel: "Super Simple Songs", audience: "kids", topic: "handwashing", about: "Handwashing steps set to a song." },
  { id: "sesame-routines", yt: "ey15OFV4YS4", title: "Let's Learn Routines with Elmo", channel: "Sesame Street", audience: "kids", topic: "shows", about: "Three full episodes about daily routines with Elmo." },
  { id: "bravekid-boys", yt: "JZvuisGEWJA", title: "Potty Training Video for Kids (Boys)", channel: "Brave Kid Adventures", audience: "kids", topic: "modeling", about: "An animated step-by-step story made for children with autism — each step shown slowly and clearly." },
  // For parents
  { id: "alberta-series", yt: "PLlRLMs5vpj2LY_xRBwTFIjQyenPUlUrdg", playlist: true, title: "Toilet training basics (6-part series)", channel: "MyHealth.Alberta.ca (Alberta Health Services)", audience: "parents", topic: "basics", about: "Short, clear public-health series: is it time to start, getting ready, how to, outside the home, nights, problems." },
  { id: "alberta-start", yt: "QeDuo3ZjVl4", title: "Is it time to start?", channel: "MyHealth.Alberta.ca", audience: "parents", topic: "basics", about: "Part 1 of the series: readiness signs and timing." },
  { id: "alberta-outside", yt: "cUZpjpxIfHY", title: "Outside the home", channel: "MyHealth.Alberta.ca", audience: "parents", topic: "outings", about: "Part 4: outings, public toilets, daycare." },
  { id: "alberta-nights", yt: "SYq0qn0ntMY", title: "Staying dry at night", channel: "MyHealth.Alberta.ca", audience: "parents", topic: "nights", about: "Part 5: night dryness and what helps." },
  { id: "cahs-ready", yt: "U0LfJbhcoks", title: "When will my child be ready to start toilet training?", channel: "Child and Adolescent Health Service (Western Australia)", audience: "parents", topic: "basics", about: "A government child-health service on readiness." },
  { id: "pedsdoc-tips", yt: "hXAEJJpk_Tk", title: "Potty training tips: a pediatrician's guide to avoiding mistakes", channel: "PedsDocTalk (Dr. Mona Amin, pediatrician)", audience: "parents", topic: "basics", about: "Common mistakes and how to avoid them." },
  { id: "brenner", yt: "bpv2S4gt5GU", title: "Toilet Training Basics", channel: "Brenner Children's Hospital (Atrium Health)", audience: "parents", topic: "basics", about: "A children's hospital's overview of the essentials." },
  { id: "uvm-kids", yt: "2TB4wgY7UWI", title: "Toilet Training: First With Kids", channel: "University of Vermont Children's Hospital", audience: "parents", topic: "basics", about: "Short pediatric segment on starting toilet training." },
  { id: "lurie-wont-poop", yt: "AhUExvzVcfg", title: "What to do when your child won't poop", channel: "Lurie Children's Hospital of Chicago", audience: "parents", topic: "poop", about: "A pediatric specialist on withholding and getting poops back on track." },
  { id: "poo-in-you", yt: "SgBj7Mc_4sc", title: "The Poo in You", channel: "GIKids", audience: "parents", topic: "poop", about: "The classic animated explainer on constipation and soiling — watch it yourself first; many families watch it with older children." },
  { id: "akron-poo", yt: "woBOO5dvxr0", title: "Introducing Poo and You", channel: "Akron Children's Hospital Gastroenterology", audience: "parents", topic: "poop", about: "A pediatric GI team on how poop works and keeping it soft." },
  { id: "lurie-night", yt: "Ix2CMVh1Mik", title: "Nighttime wetting: ask the experts", channel: "Lurie Children's Hospital of Chicago", audience: "parents", topic: "nights", about: "A pediatric urology nurse practitioner answers bedwetting questions." },
  { id: "uvm-welcome", yt: "stT2pZnS4JA", title: "Ready for Change: toilet-teaching video series", channel: "UVM Center on Disability & Community Inclusion", audience: "parents", topic: "complex", about: "Welcome to a free 34-video course for families facing toileting challenges, including disability and constipation." },
  { id: "uvm-readiness", yt: "aWAFVGKNhCU", title: "Ready, Set, Toilet! The readiness journey", channel: "UVM Center on Disability & Community Inclusion", audience: "parents", topic: "complex", about: "Readiness, especially for children with developmental differences." },
  { id: "uvm-position", yt: "3nYiz2EGDto", title: "Breathing and positioning for toilet success", channel: "UVM Center on Disability & Community Inclusion", audience: "parents", topic: "poop", about: "A video model of the sitting position and breathing that make poops easier." },
  { id: "kki-asd", yt: "DdSlSPvy9VM", title: "Toilet training for children with autism", channel: "Kennedy Krieger Institute", audience: "parents", topic: "autism", about: "A leading autism center's parent training on toileting." },
  { id: "seattle-asd", yt: "Qx-A_B3Tb-8", title: "Toilet training for individuals with autism and developmental disabilities", channel: "Seattle Children's", audience: "parents", topic: "autism", about: "A full talk from Seattle Children's for families." },
  { id: "bridgekids-asd", yt: "hejAPOYDrN4", title: "Toilet training for children with autism", channel: "Unlocking Autism (Bridge Kids BC)", audience: "parents", topic: "autism", about: "Practical, step-by-step strategies." },
  { id: "dsrf-ds", yt: "yxSqlMq01H4", title: "Gotta Go: toilet training children with Down syndrome", channel: "Down Syndrome Resource Foundation (Canada)", audience: "parents", topic: "down", about: "Podcast episode with specialists on toilet training children with Down syndrome." },
  { id: "littleleaf-ds", yt: "N2sqcW5Klco", title: "Potty training your child with Down syndrome: when to start?", channel: "Little Leaf Down Syndrome Early Education", audience: "parents", topic: "down", about: "An early-education specialist on readiness and starting." },
  { id: "emerge-complex", yt: "Be6CU1SY-wU", title: "Potty training for children with complex needs", channel: "Emerge Pediatric Therapy", audience: "parents", topic: "complex", about: "Pediatric therapists on adapting toilet training." },
  { id: "harkla-sensory", yt: "kPO6xIAJLAs", title: "10 sensory tips for potty training", channel: "Harkla (occupational therapists)", audience: "parents", topic: "complex", about: "Occupational-therapy ideas for sensory-sensitive children." },
];
export const videoById = (id: string) => VIDEOS.find((v) => v.id === id);
export const ytThumb = (yt: string) => `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
export const ytEmbed = (v: { yt: string; playlist?: boolean }, autoplay = false) => v.playlist
  ? `https://www.youtube-nocookie.com/embed/videoseries?list=${v.yt}&rel=0${autoplay ? "&autoplay=1" : ""}`
  : `https://www.youtube-nocookie.com/embed/${v.yt}?rel=0&modestbranding=1&playsinline=1${autoplay ? "&autoplay=1" : ""}`;
export const ytSearch = (q: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
export const VIDEO_SEARCHES: { label: string; q: string }[] = [
  { label: "Potty songs for toddlers", q: "potty training songs for toddlers" },
  { label: "Potty books read aloud", q: "potty training book read aloud for kids" },
  { label: "Video modeling: boys", q: "potty training video modeling boy autism" },
  { label: "Video modeling: girls", q: "potty training video modeling girl autism" },
  { label: "Social stories", q: "potty training social story video" },
  { label: "Handwashing songs", q: "handwashing song for kids" },
  { label: "Bedwetting help (parents)", q: "pediatric urologist bedwetting advice" },
  { label: "Constipation in toddlers (parents)", q: "pediatric gastroenterologist toddler constipation potty training" },
];

// ─── Trusted resources ───
export type Resource = { title: string; org: string; url: string; topic: string };
export const RESOURCES: Resource[] = [
  { title: "The right age to toilet train", org: "American Academy of Pediatrics (HealthyChildren.org)", url: "https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/the-right-age-to-toilet-train.aspx", topic: "Getting started" },
  { title: "How to tell when your child is ready", org: "American Academy of Pediatrics", url: "https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/pages/How-to-Tell-When-Your-Child-is-Ready.aspx", topic: "Getting started" },
  { title: "Stages of toilet training: different skills, different schedules", org: "American Academy of Pediatrics", url: "https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/Stages-of-Toilet-Training-Different-Skills-Different-Schedules.aspx", topic: "Getting started" },
  { title: "Potty training: how to get the job done", org: "Mayo Clinic", url: "https://www.mayoclinic.org/healthy-lifestyle/infant-and-toddler-health/in-depth/potty-training/art-20045230", topic: "Getting started" },
  { title: "How to potty train", org: "NHS (UK)", url: "https://www.nhs.uk/conditions/baby/babys-development/potty-training-and-bedwetting/how-to-potty-train/", topic: "Getting started" },
  { title: "Potty training", org: "ERIC, the children's bowel & bladder charity", url: "https://eric.org.uk/potty-training/", topic: "Getting started" },
  { title: "Toilet training (review for doctors)", org: "American Family Physician, 2008", url: "https://www.aafp.org/pubs/afp/issues/2008/1101/p1059.pdf", topic: "Research" },
  { title: "Age at starting toilet training and how long it takes (study)", org: "Pediatrics, 2003", url: "https://pubmed.ncbi.nlm.nih.gov/12671117/", topic: "Research" },
  { title: "Using a public bathroom", org: "American Academy of Pediatrics", url: "https://www.healthychildren.org/english/ages-stages/toddler/toilet-training/pages/using-a-public-bathroom.aspx", topic: "Out & about" },
  { title: "Constipation in children", org: "American Academy of Pediatrics", url: "https://www.healthychildren.org/English/health-issues/conditions/abdominal/Pages/constipation.aspx", topic: "Poop" },
  { title: "Constipation in children", org: "NIDDK (US National Institutes of Health)", url: "https://www.niddk.nih.gov/health-information/digestive-diseases/constipation-children", topic: "Poop" },
  { title: "Eating and diet for constipation in children", org: "NIDDK", url: "https://www.niddk.nih.gov/health-information/digestive-diseases/constipation-children/eating-diet-nutrition", topic: "Poop" },
  { title: "Children's bowels", org: "ERIC", url: "https://eric.org.uk/childrens-bowels/", topic: "Poop" },
  { title: "I-SIT: instructions for structured toilet sits", org: "Children's Hospital of Philadelphia", url: "https://chopib.staywellsolutionsonline.com/Library/Encyclopedia/22,38782", topic: "Poop" },
  { title: "Bedwetting: 3 common reasons and what families can do", org: "American Academy of Pediatrics", url: "https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/Bedwetting.aspx", topic: "Nights" },
  { title: "Bed-wetting", org: "Mayo Clinic", url: "https://www.mayoclinic.org/diseases-conditions/bed-wetting/symptoms-causes/syc-20366685", topic: "Nights" },
  { title: "Children's bladder health", org: "ERIC", url: "https://eric.org.uk/childrens-bladders/", topic: "Nights" },
  { title: "Potty training children with special needs", org: "American Academy of Pediatrics", url: "https://www.healthychildren.org/English/ages-stages/toddler/toilet-training/Pages/toilet-training-children-with-special-needs.aspx", topic: "Additional needs" },
  { title: "Potty training children with additional needs", org: "ERIC", url: "https://eric.org.uk/children-additional-needs/", topic: "Additional needs" },
  { title: "Toilet training guide (ATN/AIR-P tool kit)", org: "Autism Speaks", url: "https://www.autismspeaks.org/tool-kit/atnair-p-toilet-training-guide", topic: "Additional needs" },
  { title: "Personalized teaching story: potty training", org: "Autism Speaks", url: "https://www.autismspeaks.org/worksheet/personalized-teaching-story-potty-training", topic: "Additional needs" },
  { title: "Managing constipation in children (autism tool kit)", org: "Autism Speaks", url: "https://www.autismspeaks.org/tool-kit/managing-constipation-children", topic: "Additional needs" },
  { title: "Continent & Confident: video course for toilet training challenges", org: "University of Vermont Continence Project", url: "https://cdci.w3.uvm.edu/blog/continence/training-2/new-video-learning-series/", topic: "Additional needs" },
  { title: "Treating constipation in children with additional needs", org: "ERIC", url: "https://eric.org.uk/treating-constipation-in-children-with-additional-needs/", topic: "Additional needs" },
];

// ─── Underwear and gear ───
export type GearItem = { id: string; name: string; emoji: string; what: string; good: string[]; watch: string[]; when: string };
export const UNDERWEAR: GearItem[] = [
  { id: "undies", name: "Regular cotton underwear", emoji: "🩲", when: "Daytime, from the first days of training.", what: "Plain cotton briefs or knickers, a size up for easy pulling.", good: ["Your child feels wet straight away — the feedback that teaches.", "Cheap, washable; favourite characters motivate.", "Mayo Clinic: switch to regular underwear after a full day using the potty without prompting."], watch: ["Buy 10–15 pairs for the first week.", "Snug pairs can feel like a diaper at first; some families wait a day or two (bare bottom or loose pants)."] },
  { id: "cloth-trainers", name: "Cloth training pants", emoji: "🧵", when: "The in-between stage, outings, children who hate the wet feeling but need some protection.", what: "Underwear with a thick absorbent panel (3–6 layers), sometimes a waterproof outer.", good: ["They still feel wet — learning continues.", "Catch small leaks so a dribble isn't a full change.", "Reusable."], watch: ["Won't hold a full pee; you'll still change clothes sometimes.", "Bulkier; slower to dry."] },
  { id: "pullups", name: "Disposable pull-ups (training pants)", emoji: "🛍️", when: "Naps and nights; long trips if you must.", what: "Disposable pants that pull up and down like underwear.", good: ["Convenient; easy to pull down for the potty.", "Fine for sleep while night dryness develops."], watch: ["They wick wetness away, so many children don't feel wet — learning can slow.", "ERIC advises against using them for daytime outings once training has started: it can undo learning.", "Some have a 'cool' liner that feels wet — better, but still not underwear."] },
  { id: "covers", name: "Waterproof underwear covers", emoji: "☂️", when: "Over underwear for car seats, shops, playdates.", what: "A thin waterproof pant worn on top of regular underwear.", good: ["Your child still feels wet; your car seat stays dry.", "Keeps the 'no diaper' message."], watch: ["They contain, not absorb — change soon after an accident."] },
  { id: "night-pants", name: "Night pants (bedwetting pants)", emoji: "🌙", when: "Nights, including older children who still wet at night.", what: "Larger, more absorbent disposable or washable pants for sleep.", good: ["Night wetting is common through 5–7; these keep sleep calm.", "Available in bigger sizes for older children and children with additional needs."], watch: ["Use with a mattress protector during the switch.", "Try without once you've logged about a week of dry mornings."] },
  { id: "bed", name: "Mattress protectors and bed mats", emoji: "🛏️", when: "Naps and nights during training.", what: "Waterproof fitted protectors or washable absorbent mats on top of the sheet.", good: ["Make night accidents a 2-minute job.", "Double-make the bed: protector, sheet, protector, sheet."], watch: ["Choose quiet, breathable ones — crinkly covers wake light sleepers."] },
  { id: "swim", name: "Swim diapers", emoji: "🏊", when: "Pools — most pools require them for children not fully trained.", what: "Reusable or disposable swim pants that contain poop (not pee).", good: ["Lets training children swim."], watch: ["They don't hold pee — potty before swimming and every 30–45 minutes."] },
  { id: "adaptive", name: "Adaptive and easy-on clothing", emoji: "👖", when: "Every child during training; essential for children with motor difficulties.", what: "Elastic waists, Velcro, no buttons or overalls; side-opening options.", good: ["Fewer 'just too late' accidents.", "The AAP suggests Velcro and loose elastic for children with cerebral palsy or spina bifida."], watch: ["Skip onesies, belts and tights in the first weeks."] },
];
export const GEAR: GearItem[] = [
  { id: "floor-potty", name: "Floor potty", emoji: "🚽", when: "Younger toddlers, children scared of the toilet, poop practice.", what: "A small free-standing potty chair.", good: ["Feet on the floor = the best position to poop.", "Can sit where your child plays during launch days.", "ERIC suggests having more than one."], watch: ["Tip contents into the toilet together so they learn where it ends up.", "Pick a sturdy, low one with a splash guard that won't scratch boys."] },
  { id: "seat", name: "Child toilet seat (seat reducer)", emoji: "🔵", when: "Children who want the 'big toilet', small bathrooms, going straight to the toilet.", what: "A smaller seat that sits on the toilet ring; some fold for travel.", good: ["No transfer step from potty to toilet later.", "No fear of falling in."], watch: ["Always add a step stool so feet are supported, knees above hips.", "Must fit snugly — a wobbly seat scares kids."] },
  { id: "stool", name: "Step stool", emoji: "🪜", when: "With any toilet seat; at the sink for handwashing.", what: "A wide, non-slip stool (or a toilet-shaped 'squatty' stool).", good: ["Supports the poop position.", "Independence at the sink."], watch: ["Wide and stable — wobbly stools cause fear."] },
  { id: "ladder", name: "Potty seat with ladder", emoji: "🧗", when: "Children who want to do it all themselves.", what: "A child seat with built-in steps and handles.", good: ["Climb up, sit, feet supported — all in one."], watch: ["Takes space; check it fits your toilet."] },
  { id: "travel", name: "Travel potty / fold-up seat", emoji: "🧳", when: "Car, park, public restrooms.", what: "A foldable potty with disposable liners, or a fold-flat seat for public toilets.", good: ["A familiar potty anywhere.", "Avoids pull-ups on outings."], watch: ["Pack liners, wipes and bags with it."] },
  { id: "urinal", name: "Boys' potty urinal", emoji: "🎯", when: "Boys moving to standing, after poop training is solid.", what: "A small wall or floor urinal, often with a target.", good: ["Makes standing a game."], watch: ["Mayo Clinic: teach sitting first; standing later."] },
  { id: "watch", name: "Potty watch / interval timer", emoji: "⌚", when: "Building the habit and moving to self-starting.", what: "A child's watch that lights up or plays music at set intervals.", good: ["The reminder comes from them, not you.", "Use the app's suggested interval."], watch: ["Pick one they can't easily switch off."] },
  { id: "lights", name: "Night lights", emoji: "💡", when: "Night training.", what: "Plug-in lights along the path to the bathroom.", good: ["Makes getting up alone possible."], watch: ["Warm, dim lights don't disturb sleep."] },
  { id: "sensory-kit", name: "Sensory comfort kit", emoji: "🎧", when: "Sensory-sensitive children.", what: "Ear defenders, a padded seat, a soft bath mat or socks, unscented wipes.", good: ["Removes the things that make the bathroom unbearable."], watch: ["Change one thing at a time to see what helps."] },
];

// ─── Books ───
export const KID_BOOKS: { title: string; author: string; note: string }[] = [
  { title: "Potty", author: "Leslie Patricelli", note: "Very simple board book; great for young toddlers." },
  { title: "Everyone Poops", author: "Taro Gomi", note: "Matter-of-fact: animals and people all poop." },
  { title: "Once Upon a Potty", author: "Alona Frankel", note: "A classic; versions for boys and girls." },
  { title: "Daniel Goes to the Potty", author: "Daniel Tiger's Neighborhood", note: "Pairs with the 'stop and go' song." },
  { title: "P is for Potty!", author: "Sesame Street", note: "Lift-the-flap with Elmo." },
  { title: "Diapers Are Not Forever", author: "Elizabeth Verdick", note: "Gentle, positive; from the Best Behavior series." },
  { title: "I Have to Go!", author: "Robert Munsch", note: "Funny — about waiting too long. Great for older preschoolers." },
  { title: "It Hurts When I Poop!", author: "Howard J. Bennett (pediatrician)", note: "For children afraid to poop because it hurt." },
];
export const PARENT_BOOKS: { title: string; author: string; note: string }[] = [
  { title: "Toilet Training in Less Than a Day", author: "Nathan Azrin & Richard Foxx", note: "The original intensive method, from the researchers who tested it." },
  { title: "Oh Crap! Potty Training", author: "Jamie Glowacki", note: "Popular block-by-block, bare-bottom approach." },
  { title: "Toilet Training for Individuals with Autism or Other Developmental Issues", author: "Maria Wheeler", note: "Practical guide for additional needs." },
];

// ─── Signs ───
export const NEEDS_TO_GO: { sign: string; emoji: string }[] = [
  { sign: "The potty dance: wiggling, hopping, crossing legs", emoji: "💃" },
  { sign: "Holding or grabbing the front of their pants", emoji: "✋" },
  { sign: "Suddenly going quiet or stopping play", emoji: "🤫" },
  { sign: "Hiding behind furniture or in a corner (often for poop)", emoji: "🙈" },
  { sign: "Squatting, red face, grunting or straining", emoji: "😣" },
  { sign: "Tugging at pants or diaper", emoji: "👖" },
  { sign: "Pausing, staring, or a faraway look", emoji: "👀" },
  { sign: "Standing on tiptoes, lying on the floor or circling (common in some autistic children)", emoji: "🔄" },
  { sign: "Passing gas — poop may be coming soon", emoji: "💨" },
];
/** ASL signs that are simple to learn and widely used. */
export const SIGNS: { word: string; how: string }[] = [
  { word: "Toilet / potty", how: "Make the letter T (thumb tucked between your index and middle fingers) and shake it gently side to side." },
  { word: "Help", how: "Put a thumbs-up fist on the flat palm of your other hand and lift both up together." },
  { word: "All done / finished", how: "Hold both open hands up, palms facing you, then twist them so the palms face out." },
  { word: "Wash hands", how: "Rub your hands together as if washing them." },
];

// ─── Stickers and prizes ───
export const STICKERS = ["⭐", "🌈", "🦄", "🚀", "🦖", "🐶", "🐱", "🦋", "🍦", "🎈", "🏆", "🐸", "🐬", "🌻", "🚒", "🦁", "🐼", "🍓", "🚂", "👑", "🐝", "🦊", "🌟", "🐙", "🦆", "🐢", "🚜", "🧁"];
export const PRIZE_IDEAS = ["Pick a new book", "Trip to the park", "Bubble bath party", "Pick dinner", "Small toy", "Extra bedtime story", "Baking together", "Dance party", "Special outing with a grown-up", "New underwear set"];
