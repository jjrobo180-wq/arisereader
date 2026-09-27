export type AriseShortScene = {
  visual: string;
  title: string;
  caption: string;
  say: string;
};

export type AriseShort = {
  id: string;
  topic: string;
  topicLabel: string;
  scenes: AriseShortScene[];
};

type Fact = {
  visual: string;
  word: string;
  young: string;
  middle: string;
  older: string;
  action?: string;
};

export const SHORT_TOPIC_OPTIONS = [
  { id: "animals", label: "Animals", emoji: "🐾" },
  { id: "letters", label: "Letters & Phonics", emoji: "🔤" },
  { id: "numbers", label: "Numbers & Counting", emoji: "🔢" },
  { id: "feelings", label: "Feelings", emoji: "😊" },
  { id: "speech", label: "Words & Communication", emoji: "💬" },
  { id: "daily-life", label: "Daily Living", emoji: "🧼" },
  { id: "science", label: "Science & Nature", emoji: "🔬" },
  { id: "colors-shapes", label: "Colors & Shapes", emoji: "🌈" },
  { id: "social", label: "Social Skills", emoji: "🤝" },
  { id: "safety", label: "Safety", emoji: "🛟" },
  { id: "reading", label: "Reading & Vocabulary", emoji: "📚" },
] as const;

export const SHORT_AGE_OPTIONS = [
  { id: "2-4", label: "Ages 2–4", note: "Very simple words, repetition and everyday concepts" },
  { id: "5-7", label: "Ages 5–7", note: "Early reading, counting, facts and simple explanations" },
  { id: "8-10", label: "Ages 8–10", note: "Stronger vocabulary, science and reasoning" },
  { id: "11-13", label: "Ages 11–13", note: "More advanced facts, vocabulary and real-world concepts" },
] as const;

const FACTS: Record<string, Fact[]> = {
  animals: [
    { visual:"🐶",word:"Dog",young:"A dog can bark.",middle:"Dogs use their noses to learn about the world.",older:"A dog's sense of smell is far stronger than a human's.",action:"Can you say dog?" },
    { visual:"🐱",word:"Cat",young:"A cat says meow.",middle:"Cats use whiskers to help sense nearby spaces.",older:"A cat's whiskers help detect tiny changes in air and nearby objects.",action:"Can you find the cat?" },
    { visual:"🐘",word:"Elephant",young:"An elephant is very big.",middle:"Elephants use their trunks to smell, drink and pick things up.",older:"An elephant's trunk contains thousands of muscles and can perform very precise movements.",action:"Pretend your arm is a trunk." },
    { visual:"🐧",word:"Penguin",young:"A penguin is a bird.",middle:"Penguins are birds that swim instead of fly.",older:"Penguins use dense feathers and body fat to stay warm in cold environments.",action:"Waddle like a penguin." },
    { visual:"🐝",word:"Bee",young:"A bee can buzz.",middle:"Bees move pollen from flower to flower.",older:"Pollination by bees helps many flowering plants reproduce and make fruit.",action:"Buzz like a bee." },
    { visual:"🐢",word:"Turtle",young:"A turtle has a shell.",middle:"A turtle's shell helps protect its body.",older:"A turtle's shell is part of its skeleton and is connected to its spine and ribs.",action:"Touch your back." },
    { visual:"🦒",word:"Giraffe",young:"A giraffe has a long neck.",middle:"A giraffe uses its long neck to reach leaves high in trees.",older:"Giraffes have the same number of neck vertebrae as humans—seven—but each one is much longer.",action:"Reach up high." },
    { visual:"🐙",word:"Octopus",young:"An octopus has eight arms.",middle:"Octopuses can change color to blend in or communicate.",older:"Special skin cells let an octopus rapidly change color and pattern.",action:"Count eight arms." },
  ],
  letters: [
    {visual:"🍎",word:"A",young:"A says ah. Apple starts with A.",middle:"A can make the short sound ah, like apple.",older:"The letter A represents several vowel sounds depending on the word.",action:"Say A, apple."},
    {visual:"⚽",word:"B",young:"B says buh. Ball starts with B.",middle:"B makes the sound buh, like ball.",older:"B is a voiced consonant: your vocal cords vibrate when you say it.",action:"Say B, ball."},
    {visual:"🐱",word:"C",young:"C can say kuh. Cat starts with C.",middle:"C can make the sound kuh, like cat.",older:"C commonly makes a hard sound in cat and a soft sound in city.",action:"Say C, cat."},
    {visual:"🐶",word:"D",young:"D says duh. Dog starts with D.",middle:"D makes the sound duh, like dog.",older:"D is formed by briefly stopping airflow with the tongue and releasing it.",action:"Say D, dog."},
    {visual:"🥚",word:"E",young:"E says eh. Egg starts with E.",middle:"E can make the short sound eh, like egg.",older:"E is the most frequently used letter in many English texts.",action:"Say E, egg."},
    {visual:"🐟",word:"F",young:"F says fff. Fish starts with F.",middle:"F is a quiet blowing sound, like fish.",older:"F is an unvoiced fricative made by pushing air past the lower lip and upper teeth.",action:"Say F, fish."},
    {visual:"🍇",word:"G",young:"G says guh. Grapes start with G.",middle:"G can make the hard sound guh, like grapes.",older:"G can be hard as in game or soft as in giant.",action:"Say G, grapes."},
    {visual:"🏠",word:"H",young:"H says huh. House starts with H.",middle:"H begins with a breathy sound, like house.",older:"The H sound is made with open airflow and no strong tongue contact.",action:"Say H, house."},
  ],
  numbers: [
    {visual:"1️⃣",word:"One",young:"One means one thing.",middle:"One is the first counting number.",older:"One is the multiplicative identity: any number times one stays the same.",action:"Hold up one finger."},
    {visual:"2️⃣",word:"Two",young:"Two means two things.",middle:"Two is one plus one.",older:"Two is the only even prime number.",action:"Hold up two fingers."},
    {visual:"3️⃣",word:"Three",young:"Let's count: one, two, three.",middle:"Three can make a triangle's three sides.",older:"Three points that are not in a straight line determine a triangle.",action:"Clap three times."},
    {visual:"4️⃣",word:"Four",young:"Four means four things.",middle:"A square has four sides.",older:"Four is a perfect square because two times two equals four.",action:"Count four corners."},
    {visual:"5️⃣",word:"Five",young:"You have five fingers on one hand.",middle:"Five is half of ten.",older:"Five is a prime number and ends every multiple of five with zero or five.",action:"Show one whole hand."},
    {visual:"🔟",word:"Ten",young:"Ten is two hands of fingers.",middle:"Ten ones make one group of ten.",older:"Our base-ten number system organizes place value in powers of ten.",action:"Count your fingers."},
    {visual:"➕",word:"Add",young:"Add means put more together.",middle:"Addition combines amounts to find a total.",older:"Addition is commutative: changing the order does not change the sum.",action:"Put two groups together."},
    {visual:"➖",word:"Subtract",young:"Subtract means take some away.",middle:"Subtraction finds how many remain or the difference between amounts.",older:"Subtraction is the inverse operation of addition.",action:"Pretend to take one away."},
  ],
  feelings: [
    {visual:"😊",word:"Happy",young:"Happy can feel good inside.",middle:"You might feel happy when something enjoyable happens.",older:"Happiness can include feelings of joy, satisfaction or connection.",action:"Show a happy face."},
    {visual:"😢",word:"Sad",young:"It is okay to feel sad.",middle:"Sad feelings can happen when we lose something or feel disappointed.",older:"Sadness is a normal emotion that can signal a need for comfort or support.",action:"Take one slow breath."},
    {visual:"😠",word:"Angry",young:"Angry can feel hot and strong.",middle:"When angry, pause before choosing what to do.",older:"Strong anger can activate the body's stress response; slowing down can improve decision-making.",action:"Breathe in, then out."},
    {visual:"😨",word:"Scared",young:"Scared means something feels unsafe.",middle:"When you feel scared, find a trusted grown-up or a safe place.",older:"Fear helps the brain notice possible danger, even though alarms can sometimes happen when we are actually safe.",action:"Think of a safe person."},
    {visual:"😴",word:"Tired",young:"Tired means your body needs rest.",middle:"Sleep helps your brain and body recharge.",older:"Sleep supports memory, attention, mood and physical recovery.",action:"Stretch and yawn."},
    {visual:"🤩",word:"Excited",young:"Excited can feel bouncy and fast.",middle:"Excitement can make your body feel full of energy.",older:"Excitement and nervousness can create similar body sensations, such as a faster heartbeat.",action:"Name something exciting."},
  ],
  speech: [
    {visual:"🙋",word:"Help",young:"Say: Help please.",middle:"Use 'Help please' when you need support.",older:"Clear self-advocacy tells another person exactly what support you need.",action:"Practice: Help please."},
    {visual:"➕",word:"More",young:"Say: More please.",middle:"Use 'More please' to ask for another turn or more of something.",older:"A specific request such as 'I would like more time' communicates more clearly.",action:"Practice: More please."},
    {visual:"✋",word:"Stop",young:"Say: Stop please.",middle:"You can say 'Stop please' when you need something to end.",older:"Setting a clear boundary is an important communication skill.",action:"Practice: Stop please."},
    {visual:"✅",word:"Yes",young:"Yes means I want it or I agree.",middle:"Use yes when you agree or want the choice.",older:"Agreement should be clear and can change when new information appears.",action:"Say yes."},
    {visual:"❌",word:"No",young:"No means I do not want it.",middle:"Use no when you do not agree or do not want the choice.",older:"Respectful refusal is a useful self-advocacy skill.",action:"Say no."},
    {visual:"⏸️",word:"Break",young:"Say: I need a break.",middle:"Ask for a break when your body or brain needs a pause.",older:"Planned breaks can help with regulation and sustained attention.",action:"Practice: I need a break."},
  ],
  "daily-life": [
    {visual:"🪥",word:"Brush Teeth",young:"Brush your teeth to clean them.",middle:"Brush gently on every side of your teeth.",older:"Brushing removes plaque, a sticky film of bacteria that builds up on teeth.",action:"Pretend to brush."},
    {visual:"🧼",word:"Wash Hands",young:"Soap and water clean your hands.",middle:"Wash with soap, scrub, rinse and dry.",older:"Handwashing lowers the spread of many germs by physically removing them from skin.",action:"Rub your hands together."},
    {visual:"👟",word:"Shoes",young:"Shoes go on your feet.",middle:"Put each shoe on the matching foot and fasten it.",older:"A repeatable dressing routine can make getting ready faster and more independent.",action:"Point to your feet."},
    {visual:"🧥",word:"Jacket",young:"A jacket goes over your clothes.",middle:"Wear a jacket when the weather is cold.",older:"Layering clothing helps trap warm air close to the body.",action:"Pretend to zip a jacket."},
    {visual:"🥄",word:"Eat",young:"Use a spoon to scoop food.",middle:"Take manageable bites and chew before the next bite.",older:"Eating slowly can make it easier to notice hunger and fullness cues.",action:"Pretend to scoop."},
    {visual:"🛏️",word:"Bedtime",young:"Bedtime means it is time to rest.",middle:"A bedtime routine tells your brain sleep is coming.",older:"Consistent sleep routines support the body's circadian rhythm.",action:"Take one quiet breath."},
  ],
  science: [
    {visual:"☀️",word:"Sun",young:"The sun gives us light.",middle:"The sun is a star that gives Earth light and heat.",older:"The sun is a star powered by nuclear fusion in its core.",action:"Point up toward the sky."},
    {visual:"🌧️",word:"Rain",young:"Rain is water falling from clouds.",middle:"Water in clouds can form drops that fall as rain.",older:"Rain is part of the water cycle: evaporation, condensation and precipitation.",action:"Tap your fingers like rain."},
    {visual:"🌱",word:"Plant",young:"Plants grow from small seeds.",middle:"Plants use sunlight, water and air to grow.",older:"Photosynthesis converts light energy into chemical energy stored in sugars.",action:"Pretend to grow tall."},
    {visual:"🌙",word:"Moon",young:"We can see the moon in the sky.",middle:"The moon reflects light from the sun.",older:"The phases of the moon come from how much of its sunlit half we can see from Earth.",action:"Make a circle with your hands."},
    {visual:"🧲",word:"Magnet",young:"A magnet can pull some metal.",middle:"Magnets can attract or repel other magnets.",older:"Magnetic fields exert forces without objects needing to touch.",action:"Pretend two magnets pull together."},
    {visual:"🫧",word:"Air",young:"Air is all around us.",middle:"Air takes up space even though we cannot see it.",older:"Air is a mixture of gases, mostly nitrogen and oxygen.",action:"Take a slow breath."},
  ],
  "colors-shapes": [
    {visual:"🔴",word:"Red",young:"This is red.",middle:"Red is a color you can find in apples and stop signs.",older:"Red light has a longer wavelength than blue or violet light.",action:"Find something red."},
    {visual:"🔵",word:"Blue",young:"This is blue.",middle:"Blue is a color you can see in the sky on many clear days.",older:"Shorter visible wavelengths scatter strongly in the atmosphere, contributing to a blue sky.",action:"Find something blue."},
    {visual:"🟡",word:"Yellow",young:"This is yellow.",middle:"Yellow can be bright like the sun in a drawing.",older:"Yellow is perceived when certain combinations of cone cells in the eye are stimulated.",action:"Find something yellow."},
    {visual:"🔺",word:"Triangle",young:"A triangle has three sides.",middle:"A triangle has three sides and three corners.",older:"The interior angles of a triangle add to 180 degrees in Euclidean geometry.",action:"Count three sides."},
    {visual:"🟦",word:"Square",young:"A square has four sides.",middle:"A square has four equal sides and four corners.",older:"A square is both a rectangle and a rhombus.",action:"Trace a square in the air."},
    {visual:"⚪",word:"Circle",young:"A circle is round.",middle:"A circle has no corners.",older:"Every point on a circle is the same distance from its center.",action:"Draw a circle in the air."},
  ],
  social: [
    {visual:"👋",word:"Hello",young:"We can say hello.",middle:"A greeting can help start an interaction.",older:"Greetings vary across cultures and situations, so noticing context is useful.",action:"Practice: Hello!"},
    {visual:"🔄",word:"Take Turns",young:"My turn, then your turn.",middle:"Taking turns gives everyone a chance.",older:"Turn-taking supports cooperative conversations and shared activities.",action:"Say: Your turn."},
    {visual:"👂",word:"Listen",young:"Listening means we notice what someone says.",middle:"Listening helps us understand another person's message.",older:"Active listening can include noticing words, tone and nonverbal cues.",action:"Listen quietly for one sound."},
    {visual:"🤝",word:"Share",young:"Sharing means letting someone else use something too.",middle:"Sharing can help people play or work together.",older:"Fair sharing does not always mean equal amounts; it can depend on needs and context.",action:"Name something you can share."},
    {visual:"🙏",word:"Thank You",young:"Say thank you when someone helps.",middle:"Thanking someone shows appreciation.",older:"Expressing gratitude can strengthen social connections.",action:"Practice: Thank you."},
    {visual:"💬",word:"Ask",young:"You can ask a question.",middle:"Questions help us get information we need.",older:"Specific questions often lead to clearer, more useful answers.",action:"Practice one question."},
  ],
  safety: [
    {visual:"🚦",word:"Stop and Look",young:"Stop before crossing.",middle:"Stop, look and listen before crossing a street with a grown-up.",older:"Safe crossing means checking traffic conditions rather than assuming drivers see you.",action:"Practice: stop, look, listen."},
    {visual:"🔥",word:"Hot",young:"Hot things can hurt. Ask a grown-up.",middle:"Do not touch a hot stove or pan without an adult.",older:"Heat can damage skin quickly; use barriers and adult supervision around hot surfaces.",action:"Say: Hot, don't touch."},
    {visual:"☎️",word:"Trusted Adult",young:"Find a grown-up you trust when you need help.",middle:"Know which adults you can go to when something feels unsafe.",older:"A safety plan should include more than one trusted adult and a way to contact help.",action:"Think of a trusted adult."},
    {visual:"💊",word:"Medicine",young:"Only take medicine from a grown-up.",middle:"Medicine should only be taken the way a trusted adult or doctor says.",older:"Medications can be harmful when taken incorrectly, even when they help at the right dose.",action:"Say: Ask first."},
    {visual:"🪪",word:"My Information",young:"A grown-up can help with your name and address.",middle:"Learn important contact information but do not share it with strangers online.",older:"Personal information should be shared only when there is a safe, legitimate reason.",action:"Practice your first name."},
    {visual:"🛟",word:"Get Help",young:"If you are lost, find a safe grown-up.",middle:"If separated from family, stay in a safe visible place and ask a worker for help.",older:"In an emergency, prioritize immediate safety and contact emergency services or a trusted adult.",action:"Practice: I need help."},
  ],
  reading: [
    {visual:"📖",word:"Character",young:"A character is someone in a story.",middle:"Characters are the people or animals who take part in a story.",older:"Authors develop characters through actions, dialogue, thoughts and descriptions.",action:"Name a character you know."},
    {visual:"🏞️",word:"Setting",young:"Setting is where a story happens.",middle:"Setting tells where and when a story happens.",older:"Setting can influence a story's mood, conflict and character choices.",action:"Name a place for a story."},
    {visual:"➡️",word:"Plot",young:"Plot is what happens in a story.",middle:"Plot is the sequence of important events.",older:"Plots often build through conflict, rising action, climax and resolution.",action:"Tell one thing that happened."},
    {visual:"💡",word:"Infer",young:"We can use clues to figure something out.",middle:"An inference combines clues from the text with what you already know.",older:"Strong inferences are supported by specific evidence rather than guesses alone.",action:"Say: clue plus what I know."},
    {visual:"🔤",word:"Vocabulary",young:"Vocabulary means words we know.",middle:"Learning word meanings helps us understand what we read.",older:"Vocabulary depth includes meaning, usage, relationships and context.",action:"Learn one new word today."},
    {visual:"🎯",word:"Main Idea",young:"The main idea is what something is mostly about.",middle:"The main idea tells the most important point.",older:"Supporting details explain, prove or develop the main idea.",action:"Ask: what is this mostly about?"},
  ],
};

function ageText(fact: Fact, ageRange: string) {
  if (ageRange === "2-4") return fact.young;
  if (ageRange === "5-7") return fact.middle;
  return fact.older;
}

function topicLabel(topic: string) {
  return SHORT_TOPIC_OPTIONS.find(item => item.id === topic)?.label || "Learning";
}

export function makeAriseShort(index: number, ageRange: string, selectedTopics: string[]): AriseShort {
  const topics = selectedTopics.filter(topic => FACTS[topic]?.length) || [];
  const usable = topics.length ? topics : ["animals"];
  const topic = usable[index % usable.length];
  const facts = FACTS[topic];
  const cycle = Math.floor(index / usable.length);
  const fact = facts[cycle % facts.length];
  const pattern = Math.floor(cycle / facts.length) % 3;
  const core = ageText(fact, ageRange);
  const action = fact.action || `Say ${fact.word}.`;

  const scenes: AriseShortScene[] = pattern === 0 ? [
    { visual: fact.visual, title: fact.word, caption: "Look • listen • learn", say: `Let's learn about ${fact.word}.` },
    { visual: fact.visual, title: "Did you know?", caption: core, say: core },
    { visual: "⭐", title: "Your turn!", caption: action, say: action },
  ] : pattern === 1 ? [
    { visual: "👀", title: `Find: ${fact.word}`, caption: `Look for ${fact.visual}`, say: `Can you find ${fact.word}? Look for ${fact.visual}.` },
    { visual: fact.visual, title: `Yes — ${fact.word}!`, caption: core, say: `There it is. ${core}` },
    { visual: "👏", title: "Nice learning!", caption: action, say: `Nice learning. ${action}` },
  ] : [
    { visual: fact.visual, title: `Word: ${fact.word}`, caption: "Say it with A.R.I.S.E.", say: `${fact.word}. Say ${fact.word}.` },
    { visual: "🧠", title: "Remember", caption: core, say: core },
    { visual: fact.visual, title: fact.word, caption: action, say: action },
  ];

  return {
    id: `generated-${topic}-${index}`,
    topic,
    topicLabel: topicLabel(topic),
    scenes,
  };
}

export function makeAriseShortBatch(start: number, count: number, ageRange: string, topics: string[]) {
  return Array.from({ length: count }, (_, offset) => makeAriseShort(start + offset, ageRange, topics));
}
