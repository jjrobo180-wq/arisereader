// A.R.I.S.E. Beginners: the scope and sequence, part 2 (units 10–18). Same rules as curriculum.ts.
// Units 17 and 18 build words from word parts and syllables instead of single spellings.
import type { UnitDef } from "./curriculum";

export const UNITS_B: UnitDef[] = [
  {
    n: 10, title: "Blends at the end", kid: "Now blends at the end of words, like n-d in hand, and ng and nk!", skill: "Ending blends, ng and nk", grade: "1", color: "#f59e0b", icon: "🏕️",
    graphemes: ["-nd", "-nt", "-mp", "-st", "-sk", "-ft", "-lt", "-lk", "ng", "-nk"],
    words: "h|a|n|d:✋ s|a|n|d b|a|n|d l|a|n|d s|t|a|n|d p|o|n|d b|e|n|d s|e|n|d e|n|d w|i|n|d:🌬️ w|e|n|t t|e|n|t:⛺ b|e|n|t s|e|n|t h|u|n|t p|l|a|n|t:🌱 a|n|t:🐜 c|a|m|p:🏕️ l|a|m|p j|u|m|p b|u|m|p s|t|a|m|p d|a|m|p l|i|m|p f|a|s|t l|a|s|t p|a|s|t b|e|s|t n|e|s|t r|e|s|t t|e|s|t v|e|s|t:🦺 w|e|s|t j|u|s|t m|u|s|t d|u|s|t l|i|s|t f|i|s|t:✊ d|e|s|k a|s|k m|a|s|k:🎭 t|a|s|k g|i|f|t:🎁 l|e|f|t s|o|f|t r|a|f|t l|i|f|t b|e|l|t m|e|l|t f|e|l|t h|e|l|p m|i|l|k:🥛 s|i|ng r|i|ng:💍 k|i|ng:🤴 w|i|ng s|o|ng:🎵 l|o|ng b|a|ng h|a|ng s|a|ng r|a|ng h|u|ng s|w|i|ng b|r|i|ng th|i|ng s|i|n|k p|i|n|k w|i|n|k:😉 d|r|i|n|k:🥤 b|a|n|k th|a|n|k t|a|n|k j|u|n|k s|k|u|n|k:🦨 t|r|u|n|k s|t|i|n|k b|l|i|n|k i|n|k th|i|n|k h|o|n|k",
    hearts: "wh|o!0,1 c|ou|l|d!1,2 w|ou|l|d!1,2 sh|ou|l|d!1,2",
    lessons: [
      {
        id: "u10l1", title: "Camp in the Sand", pic: "⛺", focus: ["-nd", "-nt", "-mp"], heart: ["who"],
        chain: "s|a|n|d b|a|n|d b|e|n|d", spell: "t|e|n|t h|a|n|d l|a|m|p", sort: ["nd", "nt", "sand hand pond", "tent ant went"],
        text: "Dad, Sam and Pam went to camp. They set up a tent in the sand. \"Who will help?\" said Dad. Sam and Pam help! The wind bends the tent. \"Help!\" Sam and Pam grab the tent and stamp the pegs in the sand. The tent stands! At last, they rest in the tent with a lamp.",
        q: [["Where did they go?", "to camp", "to a shop", "to the pond"], ["What did the wind do to the tent?", "bent it", "hid it", "sang to it"], ["What do they rest with?", "a lamp", "a drum", "a flag"]],
      },
      {
        id: "u10l2", title: "The Skunk and the Drink", pic: "🦨", focus: ["-nk", "ng"], heart: ["could", "would"],
        chain: "s|i|n|k p|i|n|k w|i|n|k", spell: "s|k|u|n|k r|i|ng s|o|ng", sort: ["ng", "nk", "ring sing song", "pink wink sink"],
        text: "At camp, Pam sang a song. Sam had a pink drink. Then a skunk went past the tent! \"It could stink!\" said Sam. \"Would it stink at us?\" said Pam. The skunk sniffs the pink drink. Sam and Pam do not blink. The skunk drinks a bit and runs off. \"It did not stink!\" said Pam. \"It just had a drink!\"",
        q: [["What did Sam have?", "a pink drink", "a ring", "a song"], ["Who went past the tent?", "a skunk", "a king", "a frog"], ["What did the skunk do?", "had a drink and ran off", "sang a song", "hid in the tent"]],
      },
      {
        id: "u10l3", title: "The King Who Could Not Sing", pic: "🤴", focus: ["ng", "-st", "-sk"], heart: ["should"],
        chain: "k|i|ng w|i|ng s|i|ng", spell: "k|i|ng j|u|m|p g|i|f|t", sort: ["st", "sk", "nest best last", "mask desk ask"],
        text: "A king could not sing. \"I must sing!\" said the king. He sang, but it was a honk! The king felt sad. An ant went up to the king. \"You should hum,\" said the ant. The king hums. Hum, hum, hum! It was the best! The king grins. \"I can hum a song!\"",
        q: [["What could the king not do?", "sing", "jump", "hum"], ["Who helps the king?", "an ant", "a skunk", "a frog"], ["What does the king do at the end?", "hums a song", "drinks", "jumps"]],
      },
    ],
  },
  {
    n: 11, title: "Magic e", kid: "Magic e! An e at the end makes the vowel say its name: cap, cape!", skill: "Vowel-consonant-e: a_e, i_e, o_e, u_e, e_e", grade: "1–2", color: "#a855f7", icon: "🎂",
    graphemes: ["a_e", "i_e", "o_e", "u_e", "e_e"],
    words: "c|a|k|e:🎂 m|a|k|e t|a|k|e b|a|k|e l|a|k|e:🏞️ s|n|a|k|e:🐍 n|a|m|e g|a|m|e:🎮 s|a|m|e c|a|m|e g|a|t|e l|a|t|e p|l|a|t|e:🍽️ s|k|a|t|e:⛸️ c|a|p|e t|a|p|e g|r|a|p|e:🍇 a|p|e:🦍 w|a|v|e:👋 s|a|v|e c|a|v|e g|a|v|e m|a|d|e sh|a|d|e s|a|f|e sh|a|p|e p|l|a|n|e:✈️ wh|a|l|e:🐳 b|i|k|e:🚲 l|i|k|e h|i|k|e k|i|t|e:🪁 b|i|t|e wh|i|t|e t|i|m|e:⏰ l|i|n|e n|i|n|e:9️⃣ f|i|v|e:5️⃣ d|i|v|e h|i|d|e r|i|d|e s|i|d|e s|l|i|d|e w|i|d|e s|m|i|l|e:😊 p|i|l|e m|i|l|e f|i|r|e:🔥 m|i|n|e h|i|v|e p|i|n|e h|o|m|e:🏠 b|o|n|e:🦴 c|o|n|e:🍦 s|t|o|n|e n|o|s|e:👃 r|o|s|e:🌹 h|o|p|e r|o|p|e:🪢 n|o|t|e v|o|t|e j|o|k|e p|o|k|e w|o|k|e h|o|l|e p|o|l|e s|t|o|v|e d|r|o|v|e r|o|d|e th|o|s|e s|m|o|k|e c|u|b|e:🧊 c|u|t|e m|u|l|e t|u|b|e u|s|e th|e|s|e J|a|k|e K|a|t|e J|a|n|e M|i|k|e R|o|s|e J|u|n|e L|u|k|e P|e|t|e S|t|e|v|e",
    hearts: "g|i|v|e!3 l|i|v|e!3 d|o|n|e!1,3 d|oe|s!1,2",
    lessons: [
      {
        id: "u11l1", title: "Jake and Kate Bake", pic: "🎂", focus: ["a_e"], heart: ["give", "live"],
        chain: "c|a|p c|a|p|e t|a|p|e", spell: "c|a|k|e g|a|m|e p|l|a|n|e", sort: ["short a", "a–e", "cap tap mad", "cape tape made"],
        text: "Jake and Kate bake a cake. They mix and mix. Kate gets a plate. \"Let it bake,\" said Jake. At last, the cake is made! It is a big cake. Jake and Kate give some cake to Mom. \"Yum! This cake is the best!\" said Mom.",
        q: [["What do Jake and Kate bake?", "a cake", "a game", "a plate"], ["What does Kate get?", "a plate", "a rope", "a kite"], ["Who do they give cake to?", "Mom", "Dad", "a whale"]],
      },
      {
        id: "u11l2", title: "Mike and the Kite", pic: "🪁", focus: ["i_e"], heart: ["done"],
        chain: "k|i|t k|i|t|e b|i|t|e", spell: "b|i|k|e k|i|t|e f|i|v|e", sort: ["short i", "i–e", "kit pin rid", "kite pine ride"],
        text: "Mike likes to ride his bike. He rides to the lake. He has a white kite. The wind lifts the kite up, up, up! \"I like this!\" said Mike. Five kids ride bikes to the lake. They smile at Mike and his kite. When the fun is done, Mike rides back.",
        q: [["Where does Mike ride?", "to the lake", "to the shop", "to a cave"], ["What color is the kite?", "white", "red", "black"], ["How many kids ride bikes to the lake?", "five", "nine", "six"]],
      },
      {
        id: "u11l3", title: "Rex and the Bone", pic: "🦴", focus: ["o_e"], heart: ["does"],
        chain: "h|o|p h|o|p|e r|o|p|e", spell: "b|o|n|e h|o|m|e n|o|s|e", sort: ["short o", "o–e", "hop rod not", "hope rode note"],
        text: "Rex the dog has a bone. He hid the bone in a hole. Rose spots the bone and takes it home. Rex pokes his nose in the hole. \"Where is my bone?\" The bone is not in the hole! Rex runs home. The bone is on his rug! \"Does Rex like his bone?\" said Rose. Rex wags and wags.",
        q: [["Where did Rex hide the bone?", "in a hole", "on the stove", "in a cave"], ["Who takes the bone home?", "Rose", "Mike", "Jake"], ["Where is the bone at the end?", "on his rug", "in the hole", "in a box"]],
      },
      {
        id: "u11l4", title: "The Cube Game", pic: "🧊", focus: ["u_e", "e_e"],
        chain: "c|u|b c|u|b|e t|u|b|e", spell: "c|u|b|e c|u|t|e th|e|s|e", sort: ["short u", "u–e", "cub tub cut", "cube tube cute"],
        text: "June and Pete made a cube game. \"Use the cubes to make a line,\" said June. Pete stacks five cubes. June stacks nine cubes. \"These cubes are cute!\" said Pete. The line of cubes gets long. Then, a cat jumps on it! Plop! Plop! The cubes drop. June and Pete smile. \"We can make it the same!\"",
        q: [["What game did they make?", "a cube game", "a kite game", "a cake game"], ["How many cubes does June stack?", "nine", "five", "six"], ["What happens to the cubes?", "a cat jumps on them", "they melt", "they hide"]],
      },
    ],
  },
  {
    n: 12, title: "Open syllables and y", kid: "When a vowel is at the end, it says its name: go, me, hi. And y can say I: my, fly!", skill: "Open syllables (be, go, hi) and y as long i", grade: "1–2", color: "#0ea5e9", icon: "🪰",
    graphemes: ["e", "o", "i", "y"],
    words: "b|e h|e m|e w|e sh|e g|o n|o s|o h|i I m|y b|y f|l|y:🪰 c|r|y:😭 d|r|y f|r|y t|r|y s|k|y s|p|y wh|y sh|y",
    hearts: "a|g|ai|n!0,2 m|a|n|y!1 a|n|y!0 v|e|r|y!1",
    lessons: [
      {
        id: "u12l1", title: "We Can Be Planes", pic: "✈️", focus: ["e", "o", "i"], heart: ["again"],
        chain: "g|o n|o s|o", spell: "h|e g|o m|e", sort: ["ends with e", "ends with o", "he we she", "go no so"],
        text: "Jen and Ben go up a hill. \"Hi, sky!\" said Jen. A plane is up in the sky. \"Can we go up in the sky?\" said Ben. \"No, we can not,\" said Jen. \"But we can be planes!\" So Jen and Ben run with wide hands. They run up the hill and back again and again. \"We are planes!\"",
        q: [["What is up in the sky?", "a plane", "a kite", "a bike"], ["Can Jen and Ben go up in the sky?", "no", "yes", "on a bike"], ["How do they play?", "they run like planes", "they swim", "they dig"]],
      },
      {
        id: "u12l2", title: "Why, Fly?", pic: "🪰", focus: ["y"], heart: ["many", "any"],
        chain: "f|l|y f|r|y d|r|y", spell: "m|y f|l|y c|r|y", sort: ["ends with y", "ends with e", "my fly cry", "she be we"],
        text: "A fly is on my plate! \"Why, fly, why?\" I cry. The fly is shy. It zips by my nose. Many bugs like cake. I try to get the fly, but it is quick. It zips up to the sky. \"So long, fly!\" Is there any cake left? Yes! I smile and have some cake.",
        q: [["Where is the fly at first?", "on my plate", "on a kite", "in the sky"], ["Why is it hard to get the fly?", "it is quick", "it is big", "it is wet"], ["What is left at the end?", "some cake", "a fly", "a plane"]],
      },
      {
        id: "u12l3", title: "The Shy Spy", pic: "🕵️", focus: ["y", "o"], heart: ["very"],
        chain: "t|r|y d|r|y c|r|y", spell: "s|k|y t|r|y sh|e", sort: ["ends with a vowel", "ends with a consonant", "go she hi", "got shed him"],
        text: "Max is a spy. He is very shy. He hides by a rock. \"I spy a red kite!\" he said. The kite is up in the sky. Then it dips and drops! It lands by Max. \"Is this kite mine?\" said Max. \"No, it is my kite!\" said Kate. Max is not shy. \"Can we fly it?\" \"Yes!\" They fly the kite up to the sky.",
        q: [["Who is shy?", "Max", "Kate", "the kite"], ["What does Max spy?", "a red kite", "a fly", "a plane"], ["What do Max and Kate do at the end?", "fly the kite", "hide", "cry"]],
      },
    ],
  },
  {
    n: 13, title: "ai, ay, ee, ea", kid: "Vowel teams! Two vowels team up: ai and ay say A, ee and ea say E!", skill: "Vowel teams for long a (ai, ay) and long e (ee, ea)", grade: "1–2", color: "#10b981", icon: "🌧️",
    graphemes: ["ai", "ay", "ee", "ea"],
    words: "r|ai|n:🌧️ t|r|ai|n:🚆 s|n|ai|l:🐌 t|ai|l m|ai|l:📬 p|ai|l p|ai|n p|ai|n|t:🎨 w|ai|t m|ai|n b|r|ai|n:🧠 ch|ai|n:⛓️ p|l|ai|n s|ai|l r|ai|l d|ay p|l|ay s|ay w|ay m|ay s|t|ay g|r|ay t|r|ay h|ay:🌾 p|ay c|l|ay b|ee:🐝 s|ee t|r|ee:🌳 f|r|ee th|r|ee f|ee|t:🦶 m|ee|t g|r|ee|n k|ee|p s|l|ee|p:😴 sh|ee|p:🐑 s|ee|d:🌱 n|ee|d w|ee|k ch|ee|k qu|ee|n:👸 s|w|ee|t b|ee|p f|ee|l ea|t s|ea:🌊 t|ea:🍵 r|ea|d t|ea|m m|ea|t b|ea|ch:🏖️ p|ea|ch:🍑 l|ea|f:🍃 d|r|ea|m c|l|ea|n ea|ch t|ea|ch s|ea|t s|ea|l:🦭 b|ea|t b|ea|n m|ea|n n|ea|t h|ea|t s|n|ea|k J|ea|n D|ea|n M|ay J|ay",
    hearts: "w|ere!1 th|eir!1 f|r|ie|n|d!2",
    lessons: [
      {
        id: "u13l1", title: "Rain at the Train", pic: "🌧️", focus: ["ai"], heart: ["were"],
        chain: "r|ai|n p|ai|n p|ai|l", spell: "r|ai|n t|r|ai|n s|n|ai|l", sort: ["short a", "ai", "pan ran mad", "pail rain wait"],
        text: "Rain drips and drips. Jean and Jake wait at the train stop. They were wet from the rain. A snail is on the rail. \"Will the snail get on the train?\" said Jake. The train came. Jean and Jake get on. The snail did not get on. It just sits in the rain. Snails like rain!",
        q: [["Where do Jean and Jake wait?", "at the train stop", "at the beach", "in a tent"], ["What is on the rail?", "a snail", "a bee", "a leaf"], ["Why does the snail stay?", "snails like rain", "it is sad", "it is mad"]],
      },
      {
        id: "u13l2", title: "A Gray Play Day", pic: "🎨", focus: ["ay"], heart: ["their"],
        chain: "d|ay s|ay p|ay", spell: "p|l|ay d|ay t|r|ay", sort: ["ai", "ay", "rain wait pail", "play day say"],
        text: "It is a gray day. \"Can we play?\" said May. \"Stay in the shade,\" said Mom. May and Jay play with clay. They make a clay snail and a clay tray. Their snail has a long tail! \"May I paint it?\" said Jay. They paint the snail gray. \"What a fun day!\" said May.",
        q: [["What do May and Jay play with?", "clay", "rain", "a train"], ["What do they make?", "a clay snail and a tray", "a cake", "a kite"], ["What color do they paint the snail?", "gray", "red", "pink"]],
      },
      {
        id: "u13l3", title: "The Queen Bee", pic: "🐝", focus: ["ee"], heart: ["friend"],
        chain: "s|ee|d f|ee|d f|ee|t", spell: "b|ee t|r|ee sh|ee|p", sort: ["short e", "ee", "bet fed men", "feet meet seed"],
        text: "Three bees live in a tree. The queen bee is big. She needs a friend. A sheep sees the bees. \"Can I be your friend?\" said the sheep. \"Yes!\" said the queen bee. The sheep keeps the bees safe from the rain. The bees buzz a sweet song to the sheep.",
        q: [["Where do the bees live?", "in a tree", "in a shed", "in the sea"], ["Who wants to be the queen bee's friend?", "a sheep", "a snail", "a frog"], ["What do the bees give the sheep?", "a sweet song", "a seed", "a leaf"]],
      },
      {
        id: "u13l4", title: "A Day at the Beach", pic: "🏖️", focus: ["ea"],
        chain: "s|ea|t b|ea|t b|ea|n", spell: "s|ea l|ea|f p|ea|ch", sort: ["ee", "ea", "feet see tree", "sea eat leaf"],
        text: "Jean and Dean go to the beach. The sea is green and clean. They sit on a seat and eat. Dean has a peach. A crab sneaks up to the peach! \"Each of us can have a peach, crab,\" said Dean. They read and dream in the heat. What a sweet day at the sea!",
        q: [["Where do Jean and Dean go?", "to the beach", "to a tree", "to the train"], ["What does Dean have?", "a peach", "a bean", "a leaf"], ["Who sneaks up to the peach?", "a crab", "a snail", "a bee"]],
      },
    ],
  },
  {
    n: 14, title: "oa, ow, igh, ie, oo", kid: "More vowel teams: oa and ow say O, igh and ie say I, and oo says oo!", skill: "Vowel teams for long o (oa, ow), long i (igh, ie) and oo (moon, book)", grade: "1–2", color: "#6366f1", icon: "⛵",
    graphemes: ["oa", "ow", "igh", "ie", "oo"],
    words: "b|oa|t:⛵ g|oa|t:🐐 c|oa|t:🧥 r|oa|d:🛣️ t|oa|d m|oa|t s|oa|p:🧼 t|oa|s|t:🍞 f|l|oa|t c|oa|ch l|oa|f g|r|oa|n m|oa|n s|n|ow:❄️ g|r|ow sh|ow s|l|ow l|ow b|l|ow r|ow g|l|ow ow|n b|ow|l:🥣 l|igh|t:💡 n|igh|t:🌃 r|igh|t h|igh s|igh m|igh|t b|r|igh|t f|l|igh|t t|igh|t p|ie:🥧 t|ie:👔 l|ie m|oo|n:🌙 s|oo|n s|p|oo|n:🥄 f|oo|d r|oo|m z|oo b|oo|t:👢 c|oo|l p|oo|l r|oo|f b|r|oo|m:🧹 t|oo|th:🦷 n|oo|n z|oo|m b|oo|m h|oo|t t|oo b|oo|k:📖=b-ŏŏ-k l|oo|k=l-ŏŏ-k c|oo|k=k-ŏŏ-k g|oo|d=g-ŏŏ-d f|oo|t:🦶=f-ŏŏ-t w|oo|d:🪵=w-ŏŏ-d h|oo|k:🪝=h-ŏŏ-k t|oo|k=t-ŏŏ-k sh|oo|k=sh-ŏŏ-k s|t|oo|d=s-t-ŏŏ-d w|oo|l=w-ŏŏ-l B|r|oo|k=b-r-ŏŏ-k",
    hearts: "s|ch|oo|l!1 g|oe|s!1,2 p|eo|p|le!1 l|augh!1",
    lessons: [
      {
        id: "u14l1", title: "The Goat in the Boat", pic: "🐐", focus: ["oa", "ow"], heart: ["school"],
        chain: "b|oa|t c|oa|t g|oa|t", spell: "b|oa|t s|n|ow s|oa|p", sort: ["oa", "ow", "boat goat coat", "snow grow slow"],
        text: "A goat has a boat. The goat rows the boat on the moat. Row, row, row! The goat is slow. Snow drops on the boat. The goat gets his coat. \"I own this boat, and I like snow!\" A toad hops in. \"Can I float with you?\" said the toad. The goat and the toad row to school!",
        q: [["What does the goat have?", "a boat", "a sled", "a train"], ["What drops on the boat?", "snow", "rain", "soap"], ["Where do the goat and toad row to?", "school", "the moon", "the beach"]],
      },
      {
        id: "u14l2", title: "The Night Light", pic: "💡", focus: ["igh", "ie"], heart: ["goes"],
        chain: "l|igh|t m|igh|t n|igh|t", spell: "l|igh|t n|igh|t p|ie", sort: ["igh", "ie", "light night high", "pie tie lie"],
        text: "It is night. Mike has a bright light by his bed. The light goes on and off. Blink, blink! \"What is that?\" said Mike. It is a moth! The moth likes the light. \"Night, night, moth,\" said Mike. Mike sighs and lies in bed. The moth sits by the light till the sun is up.",
        q: [["What does Mike have by his bed?", "a bright light", "a pie", "a tie"], ["What likes the light?", "a moth", "a fly", "a bee"], ["What does the moth do?", "sits by the light", "naps in a pie", "rides a bike"]],
      },
      {
        id: "u14l3", title: "Food by the Moon", pic: "🌙", focus: ["oo"], heart: ["people"],
        chain: "m|oo|n s|oo|n s|p|oo|n", spell: "m|oo|n s|p|oo|n z|oo", sort: ["oo", "o", "moon food zoo", "mop hot rod"],
        text: "The zoo is cool at night. People see the bright moon. Two seals swim in the pool. Soon, the zoo man comes with food and a big spoon. The seals zoom to him! \"Food time!\" said the zoo man. The seals eat and eat. Then they sleep in the cool pool by the moon.",
        q: [["Where is this story?", "at the zoo", "at school", "at the beach"], ["What swims in the pool?", "two seals", "a goat", "a toad"], ["What does the zoo man bring?", "food and a spoon", "a boat", "a light"]],
      },
      {
        id: "u14l4", title: "A Good Book", pic: "📖", focus: ["oo"], heart: ["laugh"],
        chain: "b|oo|k l|oo|k c|oo|k", spell: "b|oo|k f|oo|t w|oo|d", sort: ["oo in moon", "oo in book", "moon food spoon", "book look cook"],
        text: "Brook took a good book to the woods. She stood by a big tree and read. The book had a cook in it. The cook made pie with a hook! Brook had to laugh. \"Look! A cook with a hook!\" A duck shook its wet tail and sat by Brook. The duck took a look at the book too.",
        q: [["Where did Brook take the book?", "to the woods", "to the zoo", "to school"], ["Who is in the book?", "a cook", "a goat", "a queen"], ["Who looks at the book with Brook?", "a duck", "a moth", "a seal"]],
      },
    ],
  },
  {
    n: 15, title: "Bossy r", kid: "Bossy r! When r comes after a vowel, it changes the sound: car, corn, her, bird, fur!", skill: "R-controlled vowels: ar, or, er, ir, ur", grade: "2", color: "#dc2626", icon: "🚗",
    graphemes: ["ar", "or", "er", "ir", "ur"],
    words: "c|ar:🚗 s|t|ar:⭐ f|ar j|ar p|ar|k d|ar|k b|ar|k sh|ar|k:🦈 f|ar|m ar|m:💪 ar|t c|ar|t:🛒 s|t|ar|t y|ar|d h|ar|d b|ar|n c|ar|d M|ar|k c|or|n:🌽 f|or|k:🍴 h|or|n:📯 b|or|n s|t|or|m:⛈️ s|p|or|t sh|or|t n|or|th f|or or f|or|t N|or|m h|er f|er|n:🌿 h|er|d F|er|n b|ir|d:🐦 g|ir|l:👧 sh|ir|t:👕 f|ir|s|t d|ir|t s|k|ir|t s|t|ir ch|ir|p t|ur|n b|ur|n h|ur|t f|ur c|ur|l c|ur|b s|ur|f:🏄 ch|ur|ch:⛪",
    hearts: "f|our!1 o|n|ce!0,2 o|n|l|y!0",
    lessons: [
      {
        id: "u15l1", title: "Star on the Farm", pic: "⭐", focus: ["ar"], heart: ["four"],
        chain: "b|ar|k p|ar|k d|ar|k", spell: "c|ar s|t|ar sh|ar|k", sort: ["ar", "short a", "car star park", "cat sad cap"],
        text: "Mark has a farm. Four big pigs live in the barn. At dark, Mark sees the stars. \"Bark! Bark!\" It is his dog, Star. Star runs far in the yard. Mark runs to the yard. Star is by the barn. \"Star, it is dark. Come in!\" Mark and Star sit in the barn with the four pigs.",
        q: [["What lives in the barn?", "four pigs", "a shark", "a bird"], ["Who is Star?", "a dog", "a star in the sky", "a pig"], ["Where do Mark and Star sit at the end?", "in the barn", "in the car", "in the yard"]],
      },
      {
        id: "u15l2", title: "The Storm", pic: "⛈️", focus: ["or", "er"], heart: ["once"],
        chain: "f|or|t f|or|k p|or|k", spell: "c|or|n f|or|k h|er", sort: ["or", "ar", "corn fork horn", "car farm park"],
        text: "Once, there was a big storm. Norm and Fern sat in the fort. Boom! Rain hit the roof. \"I do not like storms,\" said Fern. Norm had corn and forks. \"We can eat corn and play cards,\" said Norm. So they did. The storm was short. Soon, the sun was back. Fern and Norm ran to the yard to play.",
        q: [["Where were Norm and Fern?", "in the fort", "on a farm", "in a car"], ["What did they eat?", "corn", "pork", "cake"], ["What happened at the end?", "the sun was back", "it got dark", "the fort fell"]],
      },
      {
        id: "u15l3", title: "The Girl and the Bird", pic: "🐦", focus: ["ir", "ur"], heart: ["only"],
        chain: "b|ur|n t|ur|n ch|ur|n", spell: "b|ir|d g|ir|l sh|ir|t", sort: ["ir", "ur", "bird girl shirt", "turn burn fur"],
        text: "A girl in a red skirt sat on a curb. A bird sat on her arm! Only the girl was there. It was the first bird to land on her. \"I hurt my wing,\" said the bird. The girl let the bird rest in her shirt. Soon, the wing did not hurt. The bird did a turn in the sky. \"Chirp! Chirp!\" The girl had a big smile. It was her first bird friend!",
        q: [["Where did the girl sit?", "on a curb", "in a barn", "on a car"], ["What was hurt?", "a wing", "an arm", "a foot"], ["What did the bird do when its wing was better?", "a turn in the sky", "a nap in a jar", "a run on the curb"]],
      },
    ],
  },
  {
    n: 16, title: "ou, ow, oi, oy, aw, ew", kid: "Sounds that slide: ou and ow in cow, oi and oy in boy, aw in saw, and ew in new!", skill: "Diphthongs and other vowels: ou, ow, oi, oy, aw, au, ew", grade: "2", color: "#0891b2", icon: "🦉",
    graphemes: ["ou", "ow", "oi", "oy", "aw", "au", "ew"],
    words: "ou|t sh|ou|t l|ou|d c|l|ou|d:☁️ r|ou|n|d s|ou|n|d f|ou|n|d g|r|ou|n|d h|ou|s|e:🏠 m|ou|s|e:🐭 m|ou|th s|ou|th c|ow:🐄 n|ow h|ow w|ow d|ow|n t|ow|n b|r|ow|n c|r|ow|n:👑 c|l|ow|n:🤡 ow|l:🦉 g|r|ow|l f|r|ow|n c|oi|n:🪙 oi|l b|oi|l s|oi|l p|oi|n|t:👉 j|oi|n b|oy:👦 t|oy:🧸 j|oy R|oy s|aw:🪚 p|aw:🐾 d|r|aw s|t|r|aw j|aw y|aw|n:🥱 c|r|aw|l l|aw|n h|aw|k c|l|aw l|au|n|ch:🚀 h|au|l P|au|l n|ew f|ew g|r|ew ch|ew b|l|ew f|l|ew d|r|ew s|t|ew:🍲 c|r|ew",
    hearts: "b|uy!1 g|r|ea|t!2",
    lessons: [
      {
        id: "u16l1", title: "A Loud Cloud", pic: "☁️", focus: ["ou", "ow"], heart: ["buy"],
        chain: "c|ow h|ow n|ow", spell: "c|ow ow|l h|ou|s|e", sort: ["ou", "ow", "out loud cloud", "cow now town"],
        text: "A brown cow lives on a farm south of town. One day, a big cloud came. Boom! It was loud! The cow ran down to the barn. An owl was on the roof. \"Hoot! Do not frown, cow,\" said the owl. \"It is only a cloud.\" The rain came down. Soon, the sun came out. The cow went out to the grass. \"Wow! Now I am glad!\"",
        q: [["Where does the cow live?", "on a farm", "in a house", "in a town"], ["What made a loud sound?", "a big cloud", "an owl", "a clown"], ["Who talks to the cow?", "an owl", "a mouse", "a boy"]],
      },
      {
        id: "u16l2", title: "Roy and the Coin", pic: "🪙", focus: ["oi", "oy"], heart: ["great"],
        chain: "b|oy t|oy j|oy", spell: "c|oi|n b|oy t|oy", sort: ["oi", "oy", "coin oil point", "boy toy joy"],
        text: "Roy found a coin in the soil. \"A coin!\" said Roy. \"Now I can buy a toy!\" Roy and his mom went to the toy shop in town. Roy points at a toy owl. \"That is a great toy!\" He gives the coin to the man. Roy has a toy owl. What joy!",
        q: [["Where did Roy find the coin?", "in the soil", "in a toy", "in the house"], ["What does Roy buy?", "a toy owl", "a coin", "a cow"], ["How does Roy feel?", "glad", "sad", "mad"]],
      },
      {
        id: "u16l3", title: "Paul and the Hawk", pic: "🦅", focus: ["aw", "au", "ew"],
        chain: "s|aw p|aw j|aw", spell: "s|aw p|aw n|ew", sort: ["aw", "ew", "saw paw draw", "new few chew"],
        text: "Paul likes to draw. He has a new pad. He saw a hawk on the lawn. Paul drew the hawk with its claws. The hawk flew down and sat on his pad! \"Hi, hawk! Do you like it?\" said Paul. The hawk gave a big yawn and flew off. Paul drew a few hawks with big wings.",
        q: [["What does Paul like to do?", "draw", "crawl", "chew"], ["What did Paul see on the lawn?", "a hawk", "a cow", "a mouse"], ["What did the hawk do before it flew off?", "gave a big yawn", "ate a coin", "drew a hawk"]],
      },
    ],
  },
  {
    n: 17, title: "Endings and word pairs", kid: "Word endings like -ed and -ing, and two words that join to make one: sun plus set is sunset!", skill: "Endings -s, -es, -ed, -ing (with doubling and dropping e) and compound words", grade: "2–3", color: "#7c3aed", icon: "🌈",
    graphemes: ["-s", "-es", "-ed", "-ing"],
    words: "jump|ed jump|ing play|ed play|ing wish|es wish|ed box|es fox|es dish|es kick|ed rain|ed rest|ed yell|ed splash|ing get|ting drip|ping pop|ping run|ning hop|ping sit|ting stop|ped hug|ged swim|ming mak|ing rid|ing smil|ed bak|ed splash in|to in|side out|side sun|set cup|cake:🧁 bath|tub hot|dog:🌭 pop|corn:🍿 rain|bow:🌈 snow|man:⛄ sand|box back|pack:🎒 pan|cake:🥞 sail|boat bed|time play|ground foot|ball:🏈 star|fish him|self may|be can|not up|on some|thing",
    hearts: "w|a|t|er!1",
    lessons: [
      {
        id: "u17l1", title: "Splash!", pic: "💦", focus: ["-ed", "-ing"], heart: ["water"],
        chain: "jump|ed jump|ing play|ing", spell: "jump|ed play|ing wish|es", sort: ["-ed says t", "-ed says d", "jumped wished kicked", "played rained yelled"],
        text: "It rained and rained. Kate and Jake jumped into the water. Splash! \"We are getting wet!\" yelled Kate. They kicked and jumped. Jake was splashing and playing. Then Mom yelled, \"Come in! You are dripping!\" Kate and Jake rested inside. They wished it rained each day!",
        q: [["What did Kate and Jake jump into?", "the water", "a sandbox", "a boat"], ["What did Mom yell?", "Come in!", "Go to bed!", "Eat your cake!"], ["What did they wish?", "that it rained each day", "for a cupcake", "for a snowman"]],
      },
      {
        id: "u17l2", title: "The Snowman", pic: "⛄", focus: ["compound"],
        chain: "snow|man sand|box back|pack", spell: "cup|cake rain|bow foot|ball", sort: ["two words in one", "one word", "sunset cupcake bathtub", "snail cloud skunk"],
        text: "It is snowing outside. Max and Kim put on their coats. They make a big snowman. The snowman has a hat and a backpack! \"Maybe he can go to school,\" said Kim. At sunset, they go inside and eat cupcakes. Max looks outside. The snowman is still standing by the playground. \"Good night, snowman!\"",
        q: [["What do Max and Kim make?", "a snowman", "a sandbox", "a rainbow"], ["What does the snowman have?", "a hat and a backpack", "a football", "a cupcake"], ["When do they go inside?", "at sunset", "at noon", "at bedtime"]],
      },
      {
        id: "u17l3", title: "Popcorn Night", pic: "🍿", focus: ["-s", "-es"],
        chain: "pop|corn hot|dog pan|cake", spell: "pop|corn pan|cake bed|time", sort: ["-s", "-es", "cats hats jumps", "boxes wishes dishes"],
        text: "It was game night. Dad was popping popcorn. Pam and Sam played cards. Pam wished for a hotdog. Dad smiled and made hotdogs too. They had popcorn, hotdogs and pancakes! \"Pancakes at night?\" laughed Sam. \"Yes, it is fun!\" said Dad. At bedtime, Pam and Sam went to bed with big smiles.",
        q: [["What was Dad popping?", "popcorn", "pancakes", "hotdogs"], ["What did Pam wish for?", "a hotdog", "a cupcake", "a pancake"], ["Why did Sam laugh?", "pancakes at night", "a snowman", "a skunk"]],
      },
    ],
  },
  {
    n: 18, title: "Big words", kid: "Big words are made of small parts called syllables. Read each part, then put them together!", skill: "Two-syllable words: closed, open, consonant-le, y as long e; prefixes un-, re- and suffixes -ful, -ly", grade: "2–3", color: "#be185d", icon: "🐢",
    graphemes: ["closed", "open", "-le", "-y"],
    words: "rab|bit:🐰 nap|kin kit|ten:🐱 muf|fin:🧁 pic|nic:🧺 bas|ket mag|net:🧲 in|sect:🐞 prob|lem hap|pen un|til up|set ro|bot:🤖 ti|ger:🐯 mu|sic:🎵 pa|per:📄 ba|by:👶 ze|ro:0️⃣ o|pen be|gin le|mon:🍋 sev|en:7️⃣ wag|on riv|er nev|er un|der ap|ple:🍎 ta|ble lit|tle bub|ble pud|dle tur|tle:🐢 can|dle:🕯️ jun|gle pur|ple:🟣 hap|py:😊 fun|ny pup|py sil|ly sun|ny can|dy:🍬 win|dy bun|ny un|lock:🔓 un|pack re|play help|ful use|ful hope|ful sad|ly quick|ly",
    lessons: [
      {
        id: "u18l1", title: "The Rabbit and the Kitten", pic: "🐰", focus: ["closed"],
        chain: "rab|bit kit|ten muf|fin", spell: "rab|bit kit|ten nap|kin", sort: ["1 syllable", "2 syllables", "cat sun bed", "rabbit kitten muffin"],
        text: "A rabbit and a kitten had a picnic. The rabbit packed a basket with muffins and napkins. The kitten had a problem. \"I can not see my muffin!\" The rabbit looked in the basket. Until then, the kitten was upset. The muffin was under a napkin! They had a happy picnic.",
        q: [["What did the rabbit and the kitten have?", "a picnic", "a race", "a nap"], ["What was the kitten's problem?", "it could not see its muffin", "it was wet", "it lost the basket"], ["Where was the muffin?", "under a napkin", "in a wagon", "on a table"]],
      },
      {
        id: "u18l2", title: "A Silly Robot", pic: "🤖", focus: ["open", "-le"],
        chain: "ro|bot ti|ger ba|by", spell: "ro|bot ta|ble ap|ple", sort: ["first part is open", "first part is closed", "robot tiger baby", "rabbit napkin magnet"],
        text: "Ben has a little robot. The robot can open a jar and play music. One day, the robot jumped on the table. It took an apple and a candle! \"Robot, stop!\" said Ben. The robot did a silly spin. The apple fell in a puddle. Ben had to laugh. \"You are a funny robot!\"",
        q: [["What can the robot do?", "open a jar and play music", "bake a cake", "swim in the river"], ["What did the robot take?", "an apple and a candle", "a tiger", "a baby"], ["Where did the apple fall?", "in a puddle", "in the river", "on the robot"]],
      },
      {
        id: "u18l3", title: "A Helpful Puppy", pic: "🐶", focus: ["-y"],
        chain: "hap|py pup|py fun|ny", spell: "pup|py hap|py un|lock", sort: ["un-", "-ful", "unlock unpack upset", "helpful useful hopeful"],
        text: "Jen has a funny puppy. The puppy is very helpful. When Jen has to unpack her backpack, the puppy helps. It is a sunny day. The puppy can unlock the gate with its nose! \"Puppy, you are useful!\" said Jen. They run to the park. The puppy is happy, and so is Jen.",
        q: [["What kind of puppy does Jen have?", "a funny, helpful puppy", "a sad puppy", "a silly kitten"], ["What can the puppy unlock?", "the gate", "a box", "the car"], ["Where do they run?", "to the park", "to the river", "to the jungle"]],
      },
    ],
  },
];
