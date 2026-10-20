// English Explorer: an English-language-learner program inside A.R.I.S.E. Reader, from a child's very
// first English words up to academic words and idioms. A teacher or the administrator turns it on for
// the students who need it (server/ariseEnglish.ts); points go on the regular A.R.I.S.E. leaderboard.
//
// How it teaches (the research it follows):
// - Six levels that follow the WIDA English language proficiency levels (Entering → Reaching), so each
//   step is "comprehensible input": a little beyond what the child already knows.
// - Every word comes as a picture, the spoken word (the premium AI voice) and the written word together
//   (dual coding), with a short sentence, so meaning never depends on reading alone.
// - Practice is retrieval: the child recalls the word (hear it → find the picture, see the picture → find
//   the word, spell it, say it) instead of re-reading it, with immediate, kind corrective feedback.
// - Spaced repetition (Leitner boxes): words come back for review after 1, 2, 4, 8 and 16 days; a missed
//   word starts over. A word in box 4 or 5 is "mastered".
// - Home-language support: the Spanish word can be shown and spoken, and look-alike words (cognates such
//   as elephant / elefante) are pointed out, because cognate awareness speeds up vocabulary learning.
// - Speaking practice with feedback: the child says the word; it's transcribed and compared, never stored.
// - Lessons are short (about 5 minutes) and the four skills are tracked separately: listening, reading,
//   writing (spelling and word order) and speaking.

/* ------------------------------------------------------------------ content */

export type Skill = "listening" | "reading" | "writing" | "speaking";
export type EnglishWord = {
  id: string;
  unit: string;
  level: number;
  /** The English word or phrase. */
  w: string;
  /** The picture: an emoji, "scene:<place>" (a ball and a box) or "cal:<Day>" (a calendar page). */
  e: string;
  /** A short sentence using the word. */
  s: string;
  /** The Spanish word or phrase. */
  es: string;
  /** A simple English meaning (levels 4 to 6). */
  m?: string;
  /** For phrases: the word that is blanked out in "fill the blank" (otherwise the word itself). */
  k?: string;
};
export type EnglishUnit = { id: string; level: number; title: string; es: string; icon: string; kind?: "words" | "phrases" | "multi"; words: EnglishWord[] };
export type EnglishLevel = { n: number; title: string; es: string; wida: string; goal: string; color: string; units: EnglishUnit[] };

const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type UnitDef = { id: string; title: string; es: string; icon: string; kind?: EnglishUnit["kind"]; rows: string[] };
type LevelDef = { title: string; es: string; wida: string; goal: string; color: string; units: UnitDef[] };

// Each row: English | picture | sentence | Spanish | meaning (optional) | key word (optional)
const LEVEL_DEFS: LevelDef[] = [
  {
    title: "First Words", es: "Primeras palabras", wida: "WIDA 1 · Entering", color: "#22c55e",
    goal: "Understand and say everyday words with pictures.",
    units: [
      { id: "hello", title: "Hello, Friends", es: "Hola, amigos", icon: "👋", rows: [
        "hello|👋|Hello! My name is Ana.|hola",
        "good morning|🌅|Good morning, class!|buenos días",
        "good night|🌙|Good night, Mom.|buenas noches",
        "thank you|🙏|Thank you for the book.|gracias",
        "yes|👍|Yes, I want to play.|sí",
        "no|👎|No, thank you.|no",
        "friend|🧑‍🤝‍🧑|She is my friend.|amigo / amiga",
        "teacher|🧑‍🏫|My teacher is nice.|maestro / maestra",
      ] },
      { id: "colors", title: "Colors", es: "Colores", icon: "🎨", rows: [
        "red|🔴|The apple is red.|rojo",
        "blue|🔵|The sky is blue.|azul",
        "yellow|🟡|The sun is yellow.|amarillo",
        "green|🟢|The grass is green.|verde",
        "orange|🟠|I have an orange crayon.|anaranjado",
        "purple|🟣|The grapes are purple.|morado",
        "black|⚫|My shoes are black.|negro",
        "white|⚪|Snow is white.|blanco",
      ] },
      { id: "numbers", title: "Numbers 1 to 10", es: "Números del 1 al 10", icon: "🔢", rows: [
        "one|1️⃣|I have one nose.|uno",
        "two|2️⃣|I have two eyes.|dos",
        "three|3️⃣|A triangle has three sides.|tres",
        "four|4️⃣|A dog has four legs.|cuatro",
        "five|5️⃣|I have five fingers on one hand.|cinco",
        "six|6️⃣|I see six stars.|seis",
        "seven|7️⃣|A week has seven days.|siete",
        "eight|8️⃣|A spider has eight legs.|ocho",
        "nine|9️⃣|I am nine years old.|nueve",
        "ten|🔟|I have ten toes.|diez",
      ] },
      { id: "family", title: "My Family", es: "Mi familia", icon: "👨‍👩‍👧", rows: [
        "mom|👩|My mom is kind.|mamá",
        "dad|👨|My dad cooks dinner.|papá",
        "baby|👶|The baby is sleeping.|bebé",
        "brother|👦|My brother plays soccer.|hermano",
        "sister|👧|My sister reads books.|hermana",
        "grandma|👵|My grandma gives me hugs.|abuela",
        "grandpa|👴|My grandpa tells stories.|abuelo",
        "family|👨‍👩‍👧|I love my family.|familia",
      ] },
      { id: "body", title: "My Body", es: "Mi cuerpo", icon: "🧍", rows: [
        "eye|👁️|I close one eye.|ojo",
        "ear|👂|I hear with my ear.|oreja",
        "nose|👃|I smell with my nose.|nariz",
        "mouth|👄|I eat with my mouth.|boca",
        "hand|✋|Raise your hand.|mano",
        "foot|🦶|I kick the ball with my foot.|pie",
        "leg|🦵|My leg is strong.|pierna",
        "tooth|🦷|I lost a tooth!|diente",
      ] },
      { id: "classroom", title: "In the Classroom", es: "En el salón", icon: "🏫", rows: [
        "book|📕|I read a book.|libro",
        "pencil|✏️|I write with a pencil.|lápiz",
        "chair|🪑|Sit on your chair.|silla",
        "scissors|✂️|Cut the paper with the scissors.|tijeras",
        "backpack|🎒|My backpack is heavy.|mochila",
        "crayon|🖍️|I color with a crayon.|crayón",
        "paper|📄|Write your name on the paper.|papel",
        "computer|💻|We use the computer at school.|computadora",
      ] },
      { id: "animals", title: "Animals", es: "Animales", icon: "🐶", rows: [
        "dog|🐶|The dog says woof.|perro",
        "cat|🐱|The cat is soft.|gato",
        "bird|🐦|The bird can fly.|pájaro",
        "fish|🐟|The fish swims in the water.|pez",
        "horse|🐴|The horse runs fast.|caballo",
        "cow|🐮|The cow gives milk.|vaca",
        "duck|🦆|The duck says quack.|pato",
        "rabbit|🐰|The rabbit hops.|conejo",
      ] },
      { id: "food", title: "Food", es: "Comida", icon: "🍎", rows: [
        "apple|🍎|I eat an apple.|manzana",
        "banana|🍌|The banana is yellow.|plátano",
        "bread|🍞|I like bread with butter.|pan",
        "milk|🥛|I drink milk.|leche",
        "water|💧|Drink some water.|agua",
        "egg|🥚|I eat an egg for breakfast.|huevo",
        "rice|🍚|We eat rice and beans.|arroz",
        "pizza|🍕|Pizza is my favorite.|pizza",
      ] },
    ],
  },
  {
    title: "Everyday Words", es: "Palabras de cada día", wida: "WIDA 2 · Emerging", color: "#06b6d4",
    goal: "Name things at home, at school and outside, and say how you feel.",
    units: [
      { id: "clothes", title: "Clothes", es: "La ropa", icon: "👕", rows: [
        "shirt|👕|My shirt is blue.|camisa",
        "pants|👖|I wear pants to school.|pantalones",
        "dress|👗|She has a pretty dress.|vestido",
        "shoes|👟|Tie your shoes.|zapatos",
        "hat|🧢|I wear a hat in the sun.|gorra",
        "coat|🧥|Wear your coat. It is cold.|abrigo",
        "socks|🧦|My socks are warm.|calcetines",
        "gloves|🧤|I wear gloves in the snow.|guantes",
      ] },
      { id: "home", title: "At Home", es: "En casa", icon: "🏠", rows: [
        "house|🏠|This is my house.|casa",
        "bed|🛏️|I sleep in my bed.|cama",
        "door|🚪|Please close the door.|puerta",
        "window|🪟|Look out the window.|ventana",
        "kitchen|🍳|Mom cooks in the kitchen.|cocina",
        "bathroom|🛁|I wash my hands in the bathroom.|baño",
        "sofa|🛋️|We sit on the sofa.|sofá",
        "light|💡|Turn on the light.|luz",
      ] },
      { id: "feelings", title: "Feelings", es: "Sentimientos", icon: "😀", rows: [
        "happy|😀|I am happy today.|feliz",
        "sad|😢|He is sad. He lost his toy.|triste",
        "angry|😠|I feel angry when I lose.|enojado",
        "scared|😨|I am scared of the dark.|asustado",
        "tired|😴|I am tired. I want to sleep.|cansado",
        "sick|🤒|I am sick. I have a fever.|enfermo",
        "excited|🤩|I am excited for my party!|emocionado",
        "calm|😌|Take a breath and be calm.|tranquilo",
      ] },
      { id: "actions", title: "Action Words", es: "Palabras de acción", icon: "🏃", rows: [
        "run|🏃|I run in the park.|correr",
        "walk|🚶|We walk to school.|caminar",
        "swim|🏊|I swim in the pool.|nadar",
        "read|📖|I read every day.|leer",
        "write|✍️|I write my name.|escribir",
        "sing|🎤|We sing a song.|cantar",
        "dance|💃|She likes to dance.|bailar",
        "sleep|🛌|I sleep at night.|dormir",
      ] },
      { id: "weather", title: "Weather", es: "El tiempo", icon: "🌦️", rows: [
        "sun|☀️|The sun is hot.|sol",
        "rain|🌧️|I need an umbrella for the rain.|lluvia",
        "snow|❄️|We play in the snow.|nieve",
        "wind|💨|The wind is strong today.|viento",
        "cloud|☁️|A big cloud is in the sky.|nube",
        "hot|🥵|It is hot outside.|calor",
        "cold|🥶|It is cold. Wear a coat.|frío",
        "rainbow|🌈|I see a rainbow!|arcoíris",
      ] },
      { id: "places", title: "Places", es: "Lugares", icon: "🏞️", rows: [
        "school|🏫|I go to school.|escuela",
        "park|🏞️|We play at the park.|parque",
        "store|🏪|We buy food at the store.|tienda",
        "library|📚|I find books at the library.|biblioteca",
        "hospital|🏥|Doctors work at the hospital.|hospital",
        "restaurant|🍴|We eat at a restaurant.|restaurante",
        "playground|🛝|We play on the playground.|patio de juegos",
        "home|🏡|I go home after school.|casa / hogar",
      ] },
      { id: "travel", title: "Getting Around", es: "Transporte", icon: "🚌", rows: [
        "car|🚗|We go in the car.|carro",
        "bus|🚌|I ride the bus to school.|autobús",
        "bike|🚲|I ride my bike.|bicicleta",
        "train|🚆|The train is long.|tren",
        "airplane|✈️|The airplane flies high.|avión",
        "boat|⛵|The boat is on the water.|barco",
        "truck|🚚|The truck is big.|camión",
        "taxi|🚕|We take a taxi.|taxi",
      ] },
      { id: "shapes", title: "Shapes and Sizes", es: "Figuras y tamaños", icon: "🔺", rows: [
        "circle|⭕|Draw a circle.|círculo",
        "square|🟥|A square has four sides.|cuadrado",
        "triangle|🔺|A triangle has three sides.|triángulo",
        "star|⭐|I see a star.|estrella",
        "heart|❤️|I made a heart for Mom.|corazón",
        "big|🐘|An elephant is big.|grande",
        "small|🐭|A mouse is small.|pequeño",
        "long|🐍|The snake is long.|largo",
      ] },
    ],
  },
  {
    title: "Talking at School", es: "Hablar en la escuela", wida: "WIDA 3 · Developing", color: "#8b5cf6",
    goal: "Ask for help, ask questions and follow directions in class.",
    units: [
      { id: "help", title: "Asking for Help", es: "Pedir ayuda", icon: "🙋", kind: "phrases", rows: [
        "May I go to the bathroom?|🚻|May I go to the bathroom?|¿Puedo ir al baño?||bathroom",
        "I need help.|🙋|I need help.|Necesito ayuda.||help",
        "I don't understand.|🤔|I don't understand.|No entiendo.||understand",
        "Can you say it again?|🔁|Can you say it again?|¿Puede decirlo otra vez?||again",
        "May I get some water?|🚰|May I get some water?|¿Puedo tomar agua?||water",
        "I feel sick.|🤒|I feel sick.|Me siento mal.||sick",
        "Where is the nurse?|🩺|Where is the nurse?|¿Dónde está la enfermera?||nurse",
        "I am finished.|✅|I am finished.|Ya terminé.||finished",
      ] },
      { id: "questions", title: "Question Words", es: "Palabras para preguntar", icon: "❓", rows: [
        "who|🧑|Who is your teacher?|quién",
        "what|❓|What is your name?|qué",
        "where|📍|Where is my pencil?|dónde",
        "when|📅|When is lunch?|cuándo",
        "why|🤷|Why is the sky blue?|por qué",
        "how|🛠️|How do you make a kite?|cómo",
        "which|👉|Which one do you want?|cuál",
        "how many|🔢|How many apples do you have?|cuántos",
      ] },
      { id: "opposites", title: "Opposites", es: "Opuestos", icon: "↕️", rows: [
        "up|⬆️|The balloon goes up.|arriba",
        "down|⬇️|The ball rolls down the hill.|abajo",
        "open|🔓|The door is open.|abierto",
        "closed|🔒|The store is closed.|cerrado",
        "fast|🐇|The rabbit is fast.|rápido",
        "slow|🐢|The turtle is slow.|lento",
        "full|🔋|My battery is full.|lleno",
        "empty|🪫|The glass is empty.|vacío",
      ] },
      { id: "where", title: "Where Is the Ball?", es: "¿Dónde está la pelota?", icon: "📦", rows: [
        "in|scene:in|The ball is in the box.|dentro de",
        "on|scene:on|The ball is on the box.|encima de",
        "under|scene:under|The ball is under the box.|debajo de",
        "next to|scene:next|The ball is next to the box.|al lado de",
        "behind|scene:behind|The ball is behind the box.|detrás de",
        "in front of|scene:front|The ball is in front of the box.|delante de",
        "between|scene:between|The ball is between the boxes.|entre",
        "over|scene:over|The ball flies over the box.|por encima de",
      ] },
      { id: "days", title: "Days of the Week", es: "Los días de la semana", icon: "📅", rows: [
        "Monday|cal:Mon|Today is Monday.|lunes",
        "Tuesday|cal:Tue|On Tuesday we have art.|martes",
        "Wednesday|cal:Wed|Wednesday is the middle of the week.|miércoles",
        "Thursday|cal:Thu|We go to the library on Thursday.|jueves",
        "Friday|cal:Fri|Friday is pizza day!|viernes",
        "Saturday|cal:Sat|On Saturday I play outside.|sábado",
        "Sunday|cal:Sun|On Sunday I visit Grandma.|domingo",
        "weekend|cal:Sat+Sun|The weekend is Saturday and Sunday.|fin de semana",
      ] },
      { id: "helpers", title: "Community Helpers", es: "Trabajadores de la comunidad", icon: "🧑‍🚒", rows: [
        "doctor|🧑‍⚕️|The doctor helps sick people.|doctor",
        "firefighter|🧑‍🚒|The firefighter puts out fires.|bombero",
        "police officer|👮|The police officer keeps us safe.|policía",
        "mail carrier|📬|The mail carrier brings letters.|cartero",
        "farmer|🧑‍🌾|The farmer grows food.|granjero",
        "chef|🧑‍🍳|The chef cooks food.|cocinero",
        "bus driver|🚌|The bus driver takes us to school.|conductor de autobús",
        "dentist|🦷|The dentist checks my teeth.|dentista",
      ] },
      { id: "meals", title: "Mealtime", es: "La hora de comer", icon: "🍽️", rows: [
        "breakfast|🥞|I eat breakfast in the morning.|desayuno",
        "lunch|🥪|We eat lunch at school.|almuerzo",
        "dinner|🍝|My family eats dinner together.|cena",
        "hungry|🤤|I am hungry. Can I have a snack?|hambre",
        "thirsty|🥤|I am thirsty. I want water.|sed",
        "fork|🍴|I eat with a fork.|tenedor",
        "spoon|🥄|I eat soup with a spoon.|cuchara",
        "plate|🍽️|Put the food on the plate.|plato",
      ] },
      { id: "directions", title: "Classroom Directions", es: "Instrucciones en clase", icon: "📢", kind: "phrases", rows: [
        "Sit down.|🪑|Sit down.|Siéntate.||Sit",
        "Stand up.|🧍|Stand up.|Ponte de pie.||Stand",
        "Line up.|🚶|Line up.|Hagan fila.||Line",
        "Raise your hand.|✋|Raise your hand.|Levanta la mano.||hand",
        "Listen.|👂|Listen.|Escucha.||Listen",
        "Look at me.|👀|Look at me.|Mírame.||Look",
        "Open your book.|📖|Open your book.|Abre tu libro.||book",
        "Be quiet, please.|🤫|Be quiet, please.|Silencio, por favor.||quiet",
      ] },
    ],
  },
  {
    title: "Telling Stories", es: "Contar historias", wida: "WIDA 4 · Expanding", color: "#f59e0b",
    goal: "Tell what happened, describe things and explain feelings.",
    units: [
      { id: "yesterday", title: "Yesterday", es: "Ayer", icon: "⏮️", rows: [
        "went|🏞️|Yesterday I went to the park.|fui|the past of go",
        "ate|🍔|I ate a hamburger for lunch.|comí|the past of eat",
        "played|⚽|We played soccer after school.|jugamos|the past of play",
        "saw|👀|I saw a big dog.|vi|the past of see",
        "made|🎨|I made a picture for my teacher.|hice|the past of make",
        "ran|🏃|She ran to the bus.|corrió|the past of run",
        "wrote|✍️|He wrote a story.|escribió|the past of write",
        "had|🎂|I had a party on my birthday.|tuve|the past of have",
      ] },
      { id: "describe", title: "Describing Words", es: "Palabras para describir", icon: "🦒", rows: [
        "tall|🦒|A giraffe is very tall.|alto|very high from bottom to top",
        "tiny|🐜|An ant is tiny.|diminuto|very, very small",
        "heavy|🏋️|The box is too heavy to lift.|pesado|hard to lift",
        "soft|🧸|My teddy bear is soft.|suave|nice and gentle to touch",
        "loud|📢|The music is too loud.|ruidoso|makes a lot of sound",
        "quiet|🤫|The library is quiet.|silencioso|makes little or no sound",
        "beautiful|🌸|The flowers are beautiful.|hermoso|very pretty",
        "wet|💦|My shoes are wet from the rain.|mojado|covered with water",
      ] },
      { id: "sequence", title: "First, Next, Last", es: "Primero, luego, al final", icon: "🔢", rows: [
        "first|1️⃣|First, I wake up.|primero|before all the others",
        "next|➡️|Next, I brush my teeth.|luego|right after that",
        "then|⏭️|Then, I eat breakfast.|después|after that",
        "last|🏁|Last, I go to school.|por último|at the end",
        "before|⏪|Wash your hands before you eat.|antes|earlier than something",
        "after|⏩|I play after school.|después de|later than something",
        "finally|🎉|Finally, the story had a happy ending.|finalmente|at last, at the very end",
        "during|⏳|We stay quiet during the movie.|durante|while something is happening",
      ] },
      { id: "why", title: "Feelings and Why", es: "Sentimientos y por qué", icon: "💭", rows: [
        "proud|🏆|I feel proud because I finished my book.|orgulloso|happy about something you did well",
        "worried|😟|She is worried because her dog is lost.|preocupado|thinking something bad may happen",
        "surprised|😲|I was surprised by the party.|sorprendido|feeling something you did not expect",
        "lonely|😔|He felt lonely because no one played with him.|solo|sad because you are alone",
        "brave|🦸|She was brave when she got a shot.|valiente|not afraid to do something hard",
        "nervous|😬|I am nervous because I have a test.|nervioso|a little scared about what will happen",
        "embarrassed|😳|I was embarrassed when I fell down.|avergonzado|feeling silly in front of others",
        "kind|🤗|It is kind to help a friend.|amable|nice and caring to others",
      ] },
      { id: "nature", title: "Nature", es: "La naturaleza", icon: "🌳", rows: [
        "tree|🌳|The bird is in the tree.|árbol|a tall plant with a trunk and leaves",
        "flower|🌻|The flower smells nice.|flor|the colorful part of a plant",
        "river|🏞️|The river flows to the ocean.|río|a long stream of water",
        "mountain|⛰️|We hiked up the mountain.|montaña|a very high hill",
        "ocean|🌊|Whales live in the ocean.|océano|a very big body of salt water",
        "sky|🌤️|The sky is blue today.|cielo|the space above the earth",
        "rock|🪨|I found a smooth rock.|roca|a hard piece of stone",
        "leaf|🍃|A leaf fell from the tree.|hoja|a flat green part of a plant",
      ] },
      { id: "sports", title: "Sports and Play", es: "Deportes y juegos", icon: "⚽", rows: [
        "soccer|⚽|We play soccer at recess.|fútbol|a game where you kick a ball into a goal",
        "basketball|🏀|He shoots the basketball.|básquetbol|a game where you throw a ball into a hoop",
        "team|👥|Our team works together.|equipo|a group that plays or works together",
        "win|🥇|We want to win the game.|ganar|to come in first",
        "goal|🥅|She kicked the ball into the goal.|gol|the place where you score",
        "coach|📋|The coach teaches us to play.|entrenador|a person who trains a team",
        "practice|🔁|We practice every day.|practicar|to do something again and again to get better",
        "game|🎮|Let's play a game.|juego|something you play for fun",
      ] },
    ],
  },
  {
    title: "Learning Words", es: "Palabras para aprender", wida: "WIDA 5 · Bridging", color: "#ef4444",
    goal: "Use the words of reading, math, science and social studies.",
    units: [
      { id: "thinking", title: "Thinking Words", es: "Palabras para pensar", icon: "🧠", rows: [
        "compare|⚖️|Compare the two stories.|comparar|to tell how things are the same and different",
        "describe|🗣️|Describe your favorite animal.|describir|to tell what something is like",
        "explain|💬|Explain how you got your answer.|explicar|to tell how or why something happens",
        "predict|🔮|Predict what will happen next.|predecir|to guess what will happen, using clues",
        "summarize|📝|Summarize the story in two sentences.|resumir|to tell only the most important parts",
        "infer|🕵️|Use clues to infer how she feels.|inferir|to figure out something the text does not say",
        "identify|🔍|Identify the main character.|identificar|to find and name something",
        "observe|🔬|Observe the plant every day.|observar|to watch carefully",
      ] },
      { id: "science", title: "Science Words", es: "Palabras de ciencias", icon: "🧪", rows: [
        "experiment|🧪|We did an experiment with water.|experimento|a test to find out something",
        "habitat|🏕️|The forest is a habitat for bears.|hábitat|the home where an animal or plant lives",
        "energy|⚡|The sun gives us energy.|energía|the power to make things move or work",
        "magnet|🧲|A magnet pulls on metal.|imán|something that pulls iron and steel",
        "planet|🪐|Earth is a planet.|planeta|a large ball in space that goes around a star",
        "solid|🧊|Ice is a solid.|sólido|matter with its own shape",
        "liquid|💧|Water is a liquid.|líquido|matter that flows and takes the shape of its container",
        "gas|💨|Steam is a gas.|gas|matter that spreads out to fill the space",
      ] },
      { id: "math", title: "Math Words", es: "Palabras de matemáticas", icon: "➗", rows: [
        "add|➕|Add two and three to get five.|sumar|to put numbers together",
        "subtract|➖|Subtract one from four.|restar|to take a number away",
        "multiply|✖️|Multiply three by two.|multiplicar|to add the same number many times",
        "divide|➗|Divide the cookies into two groups.|dividir|to split into equal groups",
        "equal|🟰|Two plus two is equal to four.|igual|the same amount",
        "fraction|🍕|One half is a fraction.|fracción|a part of a whole",
        "total|🧮|The total is ten.|total|the whole amount",
        "half|🌗|I ate half of the sandwich.|mitad|one of two equal parts",
      ] },
      { id: "reading", title: "Reading Words", es: "Palabras de lectura", icon: "📚", rows: [
        "character|🧙|The main character is a brave girl.|personaje|a person or animal in a story",
        "setting|🏰|The setting is a castle.|ambiente|where and when a story happens",
        "plot|🗺️|The plot is full of surprises.|trama|what happens in a story",
        "main idea|💡|The main idea is that friends help each other.|idea principal|what a text is mostly about",
        "title|🏷️|The title of the book is on the cover.|título|the name of a book or story",
        "author|🖊️|The author wrote many books.|autor|the person who writes a book",
        "problem|🧩|The problem is that the dog is lost.|problema|the trouble a character must fix",
        "solution|🔑|The solution is to follow the paw prints.|solución|how the problem gets fixed",
      ] },
      { id: "social", title: "Social Studies Words", es: "Palabras de estudios sociales", icon: "🗺️", rows: [
        "community|🏘️|Our community has a big park.|comunidad|a group of people who live in the same place",
        "map|🗺️|Use the map to find the school.|mapa|a drawing that shows where places are",
        "country|🌎|Mexico is a country.|país|a land with its own government",
        "rule|📏|A school rule is to walk in the hall.|regla|something that tells you what you must do",
        "vote|🗳️|We vote for class president.|votar|to choose in a fair way",
        "history|📜|We learn about history.|historia|what happened in the past",
        "culture|🎎|Music is part of our culture.|cultura|the way a group of people lives",
        "citizen|🪪|A good citizen helps the community.|ciudadano|a person who belongs to a country",
      ] },
    ],
  },
  {
    title: "Word Master", es: "Maestro de palabras", wida: "WIDA 6 · Reaching", color: "#ec4899",
    goal: "Join ideas, use exact words, and understand words with two meanings and idioms.",
    units: [
      { id: "joining", title: "Joining Words", es: "Palabras para unir", icon: "🔗", rows: [
        "because|🤔|I wore a coat because it was cold.|porque|gives the reason",
        "but|↔️|I like apples, but I don't like pears.|pero|shows something different",
        "so|➡️|It was raining, so we stayed inside.|así que|tells what happened as a result",
        "however|🔄|It was sunny. However, it was cold.|sin embargo|but, in a more formal way",
        "although|🌦️|Although it rained, we had fun.|aunque|even if, even though",
        "also|➕|I like to read. I also like to draw.|también|in addition, too",
        "instead|🔀|We read a book instead of watching TV.|en lugar de|in place of something else",
        "for example|👉|I like fruit, for example, mangoes.|por ejemplo|here is one of them",
      ] },
      { id: "twomeanings", title: "Words with Two Meanings", es: "Palabras con dos significados", icon: "🎭", kind: "multi", rows: [
        "bat|🦇|A bat sleeps in a cave.|murciélago|an animal that flies at night",
        "bat|🏏|Hit the ball with the bat.|bate|a stick for hitting a ball",
        "ring|💍|She wears a gold ring.|anillo|jewelry for your finger",
        "ring|🔔|The bells ring at noon.|sonar|to make a bell sound",
        "bark|🐕|Dogs bark at the mail carrier.|ladrar|the sound a dog makes",
        "bark|🪵|Tree bark is rough.|corteza|the outside of a tree",
        "light|💡|Turn off the light.|luz|what helps you see",
        "light|🪶|A feather is light.|ligero|not heavy",
        "watch|⌚|My watch shows the time.|reloj|a small clock you wear",
        "watch|📺|We watch a movie.|mirar|to look at something for a while",
      ] },
      { id: "idioms", title: "Idioms", es: "Modismos", icon: "🐈", kind: "phrases", rows: [
        "raining cats and dogs|🌧️|Take an umbrella, it's raining cats and dogs!|llover a cántaros|raining very hard|cats",
        "break a leg|🎭|Break a leg in your play tonight!|¡mucha suerte!|good luck|leg",
        "a piece of cake|🍰|The test was a piece of cake.|pan comido|very easy|cake",
        "under the weather|🤧|I feel under the weather today.|sentirse mal|feeling a little sick|weather",
        "hit the books|📚|I need to hit the books for my test.|ponerse a estudiar|to study hard|books",
        "costs an arm and a leg|💸|That bike costs an arm and a leg.|cuesta un ojo de la cara|is very expensive|arm",
        "let the cat out of the bag|👜|He let the cat out of the bag about the party.|revelar el secreto|told a secret|bag",
        "on cloud nine|☁️|She was on cloud nine after she won.|muy feliz|very, very happy|nine",
      ] },
      { id: "shades", title: "Exact Feeling Words", es: "Palabras exactas para sentimientos", icon: "🎚️", rows: [
        "furious|😡|He was furious when his bike was stolen.|furioso|very, very angry",
        "delighted|😄|We were delighted with the gift.|encantado|very pleased and happy",
        "exhausted|🥱|I was exhausted after the race.|agotado|extremely tired",
        "terrified|😱|She was terrified of the thunder.|aterrorizado|extremely scared",
        "anxious|😰|I feel anxious before a big test.|ansioso|worried and nervous",
        "grateful|🙏|I am grateful for my friends.|agradecido|thankful",
        "confident|😎|She felt confident about her speech.|seguro de sí mismo|sure you can do it",
        "curious|🧐|The curious cat looked in the box.|curioso|wanting to know or learn",
      ] },
      { id: "wordparts", title: "Word Parts", es: "Partes de palabras", icon: "🧩", rows: [
        "unhappy|☹️|He was unhappy about the rain.|infeliz|not happy (un- means not)",
        "redo|🔁|Please redo the last problem.|rehacer|to do again (re- means again)",
        "preview|🎬|We watched a preview of the movie.|avance|a look before (pre- means before)",
        "careful|⚠️|Be careful on the ice.|cuidadoso|full of care (-ful means full of)",
        "helpless|🫠|The baby bird was helpless.|indefenso|without help (-less means without)",
        "painter|🧑‍🎨|The painter made a mural.|pintor|a person who paints (-er means a person who)",
        "quickly|⚡|She quickly ran home.|rápidamente|in a quick way (-ly means in that way)",
        "impossible|🚫|It is impossible to touch the sun.|imposible|not possible (im- means not)",
      ] },
    ],
  },
];

export const LEVELS: EnglishLevel[] = LEVEL_DEFS.map((ld, li) => {
  const n = li + 1;
  return {
    n, title: ld.title, es: ld.es, wida: ld.wida, goal: ld.goal, color: ld.color,
    units: ld.units.map((ud) => {
      const seen: Record<string, number> = {};
      const words = ud.rows.map((row) => {
        const [w, e, s, es, m, k] = row.split("|");
        const base = slug(w);
        seen[base] = (seen[base] || 0) + 1;
        const id = `${ud.id}.${base}${seen[base] > 1 ? `-${seen[base]}` : ""}`;
        return { id, unit: ud.id, level: n, w, e, s, es, ...(m ? { m } : {}), ...(k ? { k } : {}) } as EnglishWord;
      });
      return { id: ud.id, level: n, title: ud.title, es: ud.es, icon: ud.icon, kind: ud.kind || "words", words };
    }),
  };
});
export const UNITS: EnglishUnit[] = LEVELS.flatMap((l) => l.units);
export const WORDS: EnglishWord[] = UNITS.flatMap((u) => u.words);
const WORD_BY_ID = new Map(WORDS.map((w) => [w.id, w]));
const UNIT_BY_ID = new Map(UNITS.map((u) => [u.id, u]));
export const wordById = (id: string) => WORD_BY_ID.get(id) || null;
export const unitById = (id: string) => UNIT_BY_ID.get(id) || null;
export const MAX_LEVEL = LEVELS.length;

/** Home languages a teacher can choose. Spanish words are built in; for the others the program
 *  still records the language for the teacher, and support is in English with pictures. */
export const HOME_LANGUAGES: { id: string; name: string }[] = [
  { id: "es", name: "Spanish" }, { id: "ar", name: "Arabic" }, { id: "vi", name: "Vietnamese" }, { id: "zh", name: "Chinese" },
  { id: "so", name: "Somali" }, { id: "am", name: "Amharic" }, { id: "ne", name: "Nepali" }, { id: "ru", name: "Russian" },
  { id: "uk", name: "Ukrainian" }, { id: "fr", name: "French" }, { id: "pt", name: "Portuguese" }, { id: "fa", name: "Dari / Farsi" },
  { id: "ps", name: "Pashto" }, { id: "sw", name: "Swahili" }, { id: "other", name: "Another language" },
];
export const languageName = (id: string | null | undefined) => HOME_LANGUAGES.find((l) => l.id === id)?.name || "";

/* ------------------------------------------------------------------ cognates */

const plain = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").trim();
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
/** 0..1: how alike two strings are (1 = the same). */
export function likeness(a: string, b: string): number {
  const x = plain(a), y = plain(b);
  if (!x || !y) return 0;
  return 1 - editDistance(x, y) / Math.max(x.length, y.length);
}
/** A Spanish look-alike (cognate): elephant / elefante, hospital / hospital. */
export function isCognate(word: EnglishWord): boolean {
  const options = word.es.split("/").map((s) => s.trim());
  return plain(word.w).length >= 4 && options.some((o) => likeness(word.w, o) >= 0.6);
}

/* ------------------------------------------------------------------ lessons */

export type Rng = () => number;
export type ItemKind = "listen" | "see" | "name" | "spell" | "blank" | "order" | "meaning" | "define" | "context" | "speak";
export const SKILL_OF: Record<ItemKind, Skill> = {
  listen: "listening", context: "listening", see: "reading", name: "reading", meaning: "reading", define: "reading", blank: "reading",
  spell: "writing", order: "writing", speak: "speaking",
};
export const KIND_LABEL: Record<ItemKind, string> = {
  listen: "Listen and find", see: "Read and find", name: "What is it?", spell: "Spell it", blank: "Fill the blank", order: "Build the sentence",
  meaning: "Which word means…", define: "What does it mean?", context: "Which picture fits?", speak: "Say it",
};
export type Choice = { id: string; text?: string; e?: string };
/** One question. `answer` stays on the server; the page gets everything else. */
export type Item = {
  kind: ItemKind;
  wordId: string;
  /** What to show or say: depends on the kind (the sentence with ___, a meaning, letters, words to order). */
  prompt?: string;
  /** What the voice says for this question (listen, context, speak). */
  say?: string;
  choices?: Choice[];
  /** Letter tiles (spell) or word tiles (order), shuffled. */
  tiles?: string[];
  answer: string;
};
export type PublicItem = Omit<Item, "answer">;
export const publicItem = ({ answer: _a, ...rest }: Item): PublicItem => rest;

export function shuffle<T>(list: readonly T[], rng: Rng): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pick = <T,>(list: readonly T[], n: number, rng: Rng) => shuffle(list, rng).slice(0, n);

/** Three other words to choose from: same unit first, then the same level; never one with the same picture or spelling. */
function distractors(word: EnglishWord, pool: readonly EnglishWord[], rng: Rng, n = 3): EnglishWord[] {
  const ok = (o: EnglishWord) => o.id !== word.id && o.e !== word.e && plain(o.w) !== plain(word.w);
  const sameUnit = shuffle(pool.filter((o) => ok(o) && o.unit === word.unit), rng);
  const out: EnglishWord[] = sameUnit.slice(0, n);
  if (out.length < n) {
    const more = shuffle(WORDS.filter((o) => ok(o) && o.level === word.level && o.unit !== word.unit), rng);
    for (const o of more) { if (out.length >= n) break; if (!out.some((x) => x.e === o.e || plain(x.w) === plain(o.w))) out.push(o); }
  }
  return out;
}
const pictureChoices = (word: EnglishWord, others: EnglishWord[], rng: Rng): Choice[] => shuffle([word, ...others], rng).map((o) => ({ id: o.id, e: o.e }));
const wordChoices = (word: EnglishWord, others: EnglishWord[], rng: Rng): Choice[] => shuffle([word, ...others], rng).map((o) => ({ id: o.id, text: o.w }));
const meaningChoices = (word: EnglishWord, others: EnglishWord[], rng: Rng): Choice[] => shuffle([word, ...others], rng).map((o) => ({ id: o.id, text: o.m || o.w }));

/** The word that gets blanked in "fill the blank". */
export const blankWord = (word: EnglishWord) => word.k || word.w;
/** The sentence with the word blanked out, or null when the word isn't in it. */
export function blanked(word: EnglishWord): string | null {
  const target = blankWord(word);
  const i = word.s.toLowerCase().indexOf(target.toLowerCase());
  if (i < 0) return null;
  return `${word.s.slice(0, i)}___${word.s.slice(i + target.length)}`;
}
/** Words of a sentence as tiles (punctuation stays on its word). */
export const sentenceTiles = (s: string) => s.trim().split(/\s+/);
const canSpell = (word: EnglishWord) => /^[A-Za-z]{2,9}$/.test(word.w);

function itemFor(kind: ItemKind, word: EnglishWord, pool: readonly EnglishWord[], rng: Rng): Item | null {
  switch (kind) {
    case "listen": return { kind, wordId: word.id, say: word.w, choices: pictureChoices(word, distractors(word, pool, rng), rng), answer: word.id };
    case "see": return { kind, wordId: word.id, prompt: word.w, choices: pictureChoices(word, distractors(word, pool, rng), rng), answer: word.id };
    case "name": return { kind, wordId: word.id, choices: wordChoices(word, distractors(word, pool, rng), rng), answer: word.id };
    case "context": return { kind, wordId: word.id, prompt: word.s, say: word.s, choices: pictureChoices(word, distractors(word, pool, rng), rng), answer: word.id };
    case "meaning": return word.m ? { kind, wordId: word.id, prompt: word.m, choices: wordChoices(word, distractors(word, pool, rng), rng), answer: word.id } : null;
    case "define": return word.m ? { kind, wordId: word.id, prompt: word.w, choices: meaningChoices(word, distractors(word, pool, rng).filter((o) => o.m), rng), answer: word.id } : null;
    case "blank": {
      const prompt = blanked(word);
      if (!prompt) return null;
      const others = distractors(word, pool, rng).map((o) => ({ ...o, w: blankWord(o) }));
      return { kind, wordId: word.id, prompt, choices: shuffle([{ id: word.id, text: blankWord(word) }, ...others.map((o) => ({ id: o.id, text: o.w }))], rng), answer: word.id };
    }
    case "spell": {
      if (!canSpell(word)) return null;
      const letters = word.w.split("");
      const extra = pick("abcdefghijklmnoprstuwy".split("").filter((c) => !word.w.toLowerCase().includes(c)), Math.min(3, Math.max(1, 9 - letters.length)), rng);
      return { kind, wordId: word.id, say: word.w, tiles: shuffle([...letters, ...extra], rng), answer: word.w };
    }
    case "order": {
      const tiles = sentenceTiles(word.s);
      if (tiles.length < 3 || tiles.length > 9) return null;
      let mixed = shuffle(tiles, rng);
      for (let t = 0; t < 5 && mixed.join(" ") === tiles.join(" "); t++) mixed = shuffle(tiles, rng);
      return { kind, wordId: word.id, say: word.s, tiles: mixed, answer: tiles.join(" ") };
    }
    case "speak": return { kind, wordId: word.id, say: word.w, prompt: word.w, answer: word.w };
  }
}

/** The practice in each lesson, as two rounds: every word comes up once in each round, taking the
 *  round's kinds in turn. Level 1 starts every word with listening and never needs reading alone. */
export const LEVEL_ROUNDS: Record<number, ItemKind[][]> = {
  1: [["listen"], ["name", "see"]],
  2: [["listen", "see"], ["name", "spell"]],
  3: [["listen", "see"], ["blank", "order"]],
  4: [["listen", "meaning"], ["blank", "spell", "order"]],
  5: [["meaning", "listen"], ["define", "blank"]],
  6: [["define", "meaning"], ["blank", "context"]],
};
const PHRASE_ROUNDS: ItemKind[][] = [["listen", "see"], ["blank", "order"]];
const MULTI_ROUNDS: ItemKind[][] = [["context"], ["define"]];
const IDIOM_ROUNDS: ItemKind[][] = [["define"], ["meaning", "blank"]];
export function roundsFor(unit: EnglishUnit): ItemKind[][] {
  if (unit.kind === "multi") return MULTI_ROUNDS;
  if (unit.kind === "phrases") return unit.level >= 6 ? IDIOM_ROUNDS : PHRASE_ROUNDS;
  return LEVEL_ROUNDS[unit.level] || LEVEL_ROUNDS[1];
}

export const LESSON_SPEAK = 2;
export const REVIEW_SIZE = 10;
const speakable = (w: EnglishWord) => unitById(w.unit)?.kind !== "multi" && w.w.split(" ").length <= 4;

/** A lesson for one unit: every word comes up twice in different ways, then a couple to say aloud. */
export function makeLesson(unit: EnglishUnit, rng: Rng): Item[] {
  const items: Item[] = [];
  for (const kinds of roundsFor(unit)) {
    for (const [i, w] of shuffle(unit.words, rng).entries()) {
      const first = kinds[i % kinds.length];
      for (const k of [first, ...kinds.filter((x) => x !== first), "listen" as ItemKind]) { const it = itemFor(k, w, unit.words, rng); if (it) { items.push(it); break; } }
    }
  }
  for (const w of pick(unit.words.filter(speakable), LESSON_SPEAK, rng)) items.push(itemFor("speak", w, unit.words, rng)!);
  return items;
}

/** A review of words that are due: one question each, in the kind that fits its level. */
export function makeReview(words: EnglishWord[], rng: Rng): Item[] {
  const items: Item[] = [];
  for (const w of words.slice(0, REVIEW_SIZE)) {
    const unit = unitById(w.unit)!;
    const kinds = roundsFor(unit).flat();
    for (const k of [...shuffle(kinds, rng), "listen" as ItemKind]) { const it = itemFor(k, w, unit.words, rng); if (it) { items.push(it); break; } }
  }
  const sayable = words.filter(speakable);
  if (sayable.length) items.push(itemFor("speak", pick(sayable, 1, rng)[0], [], rng)!);
  return items;
}

/* ------------------------------------------------------------------ checking */

export const normalize = (s: string) => String(s || "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
export function checkAnswer(item: Item, answer: string): boolean {
  if (item.kind === "spell" || item.kind === "order") return normalize(answer) === normalize(item.answer);
  return String(answer) === item.answer;
}

const NUMBER_WORDS: Record<string, string> = { "1": "one", "2": "two", "3": "three", "4": "four", "5": "five", "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten" };
const spoken = (s: string) => normalize(s).split(" ").map((t) => NUMBER_WORDS[t] || t).join(" ").replace(/'/g, "");
/** Was what the speech service heard the word or phrase? Kind to accents: close counts. */
export function checkSpeech(target: string, heard: string): { correct: boolean; close: boolean; score: number } {
  const t = spoken(target), h = spoken(heard);
  if (!h) return { correct: false, close: false, score: 0 };
  if (h === t || ` ${h} `.includes(` ${t} `)) return { correct: true, close: true, score: 1 };
  const tw = t.split(" "), hw = h.split(" ");
  let score: number;
  if (tw.length === 1) score = Math.max(...hw.map((x) => 1 - editDistance(x, t) / Math.max(x.length, t.length)));
  else {
    const hits = tw.filter((w) => hw.some((x) => x === w || 1 - editDistance(x, w) / Math.max(x.length, w.length) >= 0.75)).length;
    score = hits / tw.length;
  }
  return { correct: score >= (tw.length === 1 ? 0.75 : 0.8), close: score >= 0.6, score: Math.round(score * 100) / 100 };
}

/* ------------------------------------------------------------------ spaced repetition */

/** Days until a word in each box comes back (box 1 = tomorrow). */
export const BOX_DAYS = [0, 1, 2, 4, 8, 16];
export const MASTERED_BOX = 4;
export type WordProgress = { word_id: string; box: number; right: number; wrong: number; last_at: string | null; due_at: string | null };
export function nextProgress(prev: WordProgress | null, allRight: boolean, wrongCount: number, rightCount: number, nowMs: number, wordId: string): WordProgress {
  const box = allRight ? Math.min(5, Math.max(1, prev?.box || 0) + 1) : 1;
  return {
    word_id: wordId, box,
    right: (prev?.right || 0) + rightCount, wrong: (prev?.wrong || 0) + wrongCount,
    last_at: new Date(nowMs).toISOString(), due_at: new Date(nowMs + BOX_DAYS[box] * 86400_000).toISOString(),
  };
}
export const wordStatus = (p: WordProgress | null | undefined): "new" | "learning" | "mastered" => (!p || !p.box ? "new" : p.box >= MASTERED_BOX ? "mastered" : "learning");

/* ------------------------------------------------------------------ points, stars and unlocking */

export const PASS = 0.6;
export const POINTS = { firstPass: 15, perNewStar: 5, replay: 3, review: 5, speakEach: 1, speakMax: 3, levelUp: 25, dailyCap: 60 };
export function starsFor(score: number, total: number): number {
  if (!total) return 0;
  const p = score / total;
  return p >= 0.9 ? 3 : p >= 0.75 ? 2 : p >= PASS ? 1 : 0;
}
export type UnitProgress = { unit_id: string; stars: number; best: number; plays: number; first_done_at: string | null; last_at: string | null };

/** Points for a finished lesson or review, before the daily cap. */
export function pointsFor(o: { kind: "lesson" | "review"; score: number; total: number; spokenRight: number; before: UnitProgress | null }): { points: number; stars: number; why: string } {
  const stars = starsFor(o.score, o.total);
  const speak = Math.min(POINTS.speakMax, o.spokenRight) * POINTS.speakEach;
  if (o.kind === "review") return { points: (o.total >= 3 && stars > 0 ? POINTS.review : 0) + speak, stars, why: "review" };
  if (!stars) return { points: speak, stars, why: "try again" };
  const had = o.before?.stars || 0;
  if (!had) return { points: POINTS.firstPass + Math.max(0, stars - 1) * POINTS.perNewStar + speak, stars, why: "new unit" };
  if (stars > had) return { points: (stars - had) * POINTS.perNewStar + speak, stars, why: "more stars" };
  return { points: POINTS.replay + speak, stars, why: "practice" };
}

/** The highest level the student can play: their starting level, then each level after one they've finished. */
export function unlockedLevel(startLevel: number, units: Map<string, UnitProgress>): number {
  let level = Math.min(MAX_LEVEL, Math.max(1, startLevel || 1));
  while (level < MAX_LEVEL && LEVELS[level - 1].units.every((u) => (units.get(u.id)?.stars || 0) > 0)) level++;
  return level;
}
/** Can the student open this unit? Levels below the start are all open; otherwise one unit after another. */
export function unitOpen(unit: EnglishUnit, startLevel: number, units: Map<string, UnitProgress>): boolean {
  const top = unlockedLevel(startLevel, units);
  if (unit.level > top) return false;
  if (unit.level < Math.max(1, startLevel)) return true;
  const list = LEVELS[unit.level - 1].units;
  const i = list.findIndex((u) => u.id === unit.id);
  return i <= 0 || (units.get(list[i - 1].id)?.stars || 0) > 0;
}

/* ------------------------------------------------------------------ dates (Mountain Time, like the rest of A.R.I.S.E.) */

export const denverDay = (ms: number) => new Date(ms).toLocaleDateString("en-CA", { timeZone: "America/Denver" });
/** Days in a row with a finished lesson or review, counting today or yesterday as the latest. */
export function streakOf(days: Iterable<string>, nowMs: number): number {
  const set = new Set(days);
  let d = denverDay(nowMs);
  if (!set.has(d)) d = denverDay(nowMs - 86400_000);
  let n = 0;
  let t = Date.parse(`${d}T12:00:00Z`);
  while (set.has(new Date(t).toISOString().slice(0, 10))) { n++; t -= 86400_000; }
  return n;
}

/* ------------------------------------------------------------------ the voice */

/** Things the program says besides the words themselves (the voice only speaks what's in the program). */
export const VOICE_LINES = {
  en: {
    listen: "Listen. Tap the picture.", see: "Read the word. Tap the picture.", name: "What is it? Tap the word.", spell: "Listen and spell the word.",
    blank: "Which word goes in the blank?", order: "Put the words in order.", meaning: "Which word has this meaning?", define: "What does this word mean?",
    context: "Listen. Which picture fits the sentence?", speak: "Now you say it. Tap the microphone.", learn: "Listen and repeat.",
    great: "Great job!", super: "Super!", yes: "Yes! You got it!", awesome: "Awesome!", tryAgain: "Good try! Let's look again.", itIs: "The answer is",
    welcome: "Welcome to English Explorer!", done: "You did it! Lesson complete!", review: "Time to review your words.",
  },
  es: {
    listen: "Escucha. Toca el dibujo.", see: "Lee la palabra. Toca el dibujo.", name: "¿Qué es? Toca la palabra.", spell: "Escucha y escribe la palabra.",
    blank: "¿Qué palabra va en el espacio?", order: "Pon las palabras en orden.", meaning: "¿Qué palabra tiene este significado?", define: "¿Qué significa esta palabra?",
    context: "Escucha. ¿Qué dibujo va con la oración?", speak: "Ahora dilo tú. Toca el micrófono.", learn: "Escucha y repite.",
    great: "¡Muy bien!", super: "¡Súper!", yes: "¡Sí! ¡Lo lograste!", awesome: "¡Increíble!", tryAgain: "¡Buen intento! Vamos a ver otra vez.", itIs: "La respuesta es",
    welcome: "¡Bienvenido a English Explorer!", done: "¡Lo lograste! ¡Terminaste la lección!", review: "Es hora de repasar tus palabras.",
  },
} as const;

/** Everything the voice may say, by language: the words, sentences, meanings and the program's own lines. */
export function voiceTexts(): { en: Set<string>; es: Set<string> } {
  const en = new Set<string>(Object.values(VOICE_LINES.en));
  const es = new Set<string>(Object.values(VOICE_LINES.es));
  for (const w of WORDS) { en.add(w.w); en.add(w.s); if (w.m) en.add(w.m); es.add(w.es); }
  for (const u of UNITS) { en.add(u.title); es.add(u.es); }
  for (const l of LEVELS) { en.add(l.title); es.add(l.es); }
  return { en, es };
}
