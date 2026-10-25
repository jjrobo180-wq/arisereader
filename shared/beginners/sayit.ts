// A.R.I.S.E. Beginners: Say It Studio, the speech practice room (like Speech Blubs). Ari says a word with a moving
// mouth, then the child says it back while a voice bar fills. Any real try fills the bar and earns a sticker,
// which matters for shy, late-talking or autistic children; when the word is also heard right, it earns a gold
// star and counts toward Reader points (shared/beginners/index.ts, POINTS.sayItWords).
//
// Two kinds of sets: everyday themes (first words a child uses every day) and Mouth Gym sets grouped by where
// the sound is made, the way speech therapists group early sounds. Each set has a tip and a conversation starter
// for the grown-up. `check: false` sets (animal noises, sound effects) are never marked wrong, because
// speech-to-text can't spell "baa" or "vroom" reliably; the voice bar alone counts.

export type SayItWord = {
  /** The word or short phrase, as it's shown and said. */
  w: string;
  e: string;
  /** What Ari says after the word, to put it in a sentence. */
  line: string;
  /** Other ways speech-to-text may write it that still count as right. */
  alt?: string[];
};
export type SayItCategory = {
  id: string;
  title: string;
  e: string;
  color: string;
  kind: "theme" | "mouth";
  /** For the grown-up: how to help. */
  tip: string;
  /** For the grown-up: something to ask afterward. */
  starter: string;
  check: boolean;
  words: SayItWord[];
};

const W = (w: string, e: string, line: string, alt?: string[]): SayItWord => ({ w, e, line, ...(alt ? { alt } : {}) });

export const SAYIT_CATEGORIES: SayItCategory[] = [
  {
    id: "fun-sounds", title: "Fun Sounds", e: "🎉", color: "#f97316", kind: "theme", check: false,
    tip: "Animal noises and sound effects are often a child's first words. Make them big and silly, and pause so your child can fill in the sound.",
    starter: "Ask: What does the cow say? Then wait, smiling, for the moo.",
    words: [
      W("moo", "🐄", "The cow says moo."), W("baa", "🐑", "The sheep says baa."), W("woof", "🐶", "The dog says woof."),
      W("meow", "🐱", "The cat says meow."), W("quack", "🦆", "The duck says quack."), W("oink", "🐷", "The pig says oink."),
      W("hoot", "🦉", "The owl says hoot."), W("buzz", "🐝", "The bee says buzz."), W("beep beep", "🚗", "The car says beep beep."),
      W("choo choo", "🚂", "The train says choo choo."), W("pop", "🎈", "The balloon goes pop!"), W("uh oh", "😮", "Uh oh! It fell down."),
      W("wow", "🤩", "Wow! Look at that!"), W("yum", "😋", "Yum! That is good."), W("whee", "🛝", "Whee! Down the slide."),
    ],
  },
  {
    id: "hello-me", title: "Hello and Me", e: "👋", color: "#ec4899", kind: "theme", check: true,
    tip: "Use these words all day: hi and bye at the door, more and all done at snack time. Give your child a moment to say the word before you help.",
    starter: "At snack time, hold up one cracker and wait for more.",
    words: [
      W("hi", "👋", "Hi! Nice to see you.", ["hey", "hello"]), W("bye", "👋", "Bye! See you later.", ["bye bye", "by"]), W("mom", "👩", "I love my mom.", ["mama", "mommy", "mum"]),
      W("dad", "👨", "I love my dad.", ["dada", "daddy"]), W("baby", "👶", "The baby is sleeping."), W("me", "🙋", "Pick me!"),
      W("more", "➕", "More, please!"), W("help", "🆘", "Help me, please."), W("please", "🙏", "Can I have one, please?"),
      W("thank you", "💝", "Thank you very much!", ["thanks"]), W("yes", "👍", "Yes, I want it!", ["yeah", "yep"]), W("no", "🙅", "No, thank you.", ["nope"]),
      W("all done", "🙌", "All done! Time to clean up.", ["done"]), W("my turn", "☝️", "My turn! Can I play?"),
    ],
  },
  {
    id: "animals", title: "Animals", e: "🦁", color: "#16a34a", kind: "theme", check: true,
    tip: "Look at animal books or toys together. Point, name the animal slowly, and let your child try. Any try counts!",
    starter: "Ask: Which animal is your favorite? What sound does it make?",
    words: [
      W("cat", "🐱", "The cat is soft."), W("dog", "🐶", "The dog can run."), W("cow", "🐄", "The cow eats grass."), W("pig", "🐷", "The pig is pink."),
      W("duck", "🦆", "The duck can swim."), W("fish", "🐟", "The fish is in the water."), W("bird", "🐦", "The bird can fly."), W("frog", "🐸", "The frog can hop."),
      W("bee", "🐝", "The bee makes honey."), W("bear", "🐻", "The bear is big."), W("lion", "🦁", "The lion can roar."), W("horse", "🐴", "I can ride a horse."),
      W("monkey", "🐵", "The monkey can climb."), W("bunny", "🐰", "The bunny can hop.", ["bunnies", "rabbit"]), W("turtle", "🐢", "The turtle is slow."),
    ],
  },
  {
    id: "food", title: "Yummy Food", e: "🍎", color: "#dc2626", kind: "theme", check: true,
    tip: "Meals are the best practice. Hold up two choices and let your child name the one they want before you hand it over.",
    starter: "Ask: Do you want the apple or the banana?",
    words: [
      W("apple", "🍎", "The apple is red."), W("banana", "🍌", "The banana is yellow."), W("milk", "🥛", "I drink milk."), W("juice", "🧃", "Can I have juice?"),
      W("water", "💧", "I want water."), W("cookie", "🍪", "The cookie is yummy."), W("egg", "🥚", "I like eggs."), W("cheese", "🧀", "Cheese, please!"),
      W("pizza", "🍕", "I love pizza."), W("cake", "🎂", "Birthday cake!"), W("grapes", "🍇", "The grapes are purple.", ["grape"]), W("carrot", "🥕", "Bunnies like carrots.", ["carrots"]),
      W("bread", "🍞", "I eat bread."), W("ice cream", "🍦", "Ice cream is cold.", ["icecream"]),
    ],
  },
  {
    id: "actions", title: "Action Words", e: "🏃", color: "#2563eb", kind: "theme", check: true,
    tip: "Do the action while you say the word: jump when you say jump. Moving and talking together helps words stick.",
    starter: "Play a game: you say an action, your child does it, then swap.",
    words: [
      W("go", "🟢", "Ready, set, go!"), W("stop", "🛑", "Stop at the red light."), W("up", "⬆️", "Up, up, up!"), W("down", "⬇️", "Sit down, please."),
      W("eat", "🍽️", "Time to eat."), W("drink", "🥤", "I drink my milk."), W("run", "🏃", "I can run fast."), W("jump", "🦘", "I can jump high."),
      W("sit", "🪑", "Sit on the chair."), W("sleep", "😴", "Time to sleep."), W("wash", "🧼", "Wash your hands."), W("open", "📦", "Open the box."),
      W("push", "🫸", "Push the car."), W("kick", "⚽", "Kick the ball."), W("clap", "👏", "Clap your hands."),
    ],
  },
  {
    id: "feelings", title: "Feelings", e: "😊", color: "#a855f7", kind: "theme", check: true,
    tip: "Name feelings when they happen: You look happy! Make the face together in a mirror.",
    starter: "Ask: How do you feel right now? Show me with your face.",
    words: [
      W("happy", "😊", "I feel happy."), W("sad", "😢", "I feel sad."), W("mad", "😠", "I feel mad."), W("tired", "🥱", "I am tired."),
      W("scared", "😨", "I feel scared."), W("silly", "🤪", "I feel silly."), W("hungry", "😋", "I am hungry."), W("love", "❤️", "I love you."),
    ],
  },
  {
    id: "colors", title: "Colors", e: "🎨", color: "#0891b2", kind: "theme", check: true,
    tip: "Find colors around you: your shirt, a car, a crayon. Name one color at a time.",
    starter: "Ask: What color is your shirt?",
    words: [
      W("red", "🟥", "The apple is red."), W("blue", "🟦", "The sky is blue."), W("green", "🟩", "The grass is green."), W("yellow", "🟨", "The sun is yellow."),
      W("orange", "🟧", "The orange is orange."), W("purple", "🟪", "Grapes are purple."), W("pink", "🩷", "The pig is pink."), W("black", "⬛", "The cat is black."),
      W("white", "⬜", "Snow is white."), W("brown", "🟫", "The bear is brown."),
    ],
  },
  {
    id: "numbers", title: "Numbers", e: "🔢", color: "#ca8a04", kind: "theme", check: true,
    tip: "Count real things: steps, crackers, toes. Touch each one as you count.",
    starter: "Count your fingers together, slowly, one at a time.",
    words: [
      W("one", "1️⃣", "One big dog."), W("two", "2️⃣", "Two little cats."), W("three", "3️⃣", "Three red apples."), W("four", "4️⃣", "Four green frogs."),
      W("five", "5️⃣", "Five fingers on my hand."), W("six", "6️⃣", "Six yellow ducks."), W("seven", "7️⃣", "Seven days in a week."), W("eight", "8️⃣", "Eight legs on a spider."),
      W("nine", "9️⃣", "Nine shiny stars."), W("ten", "🔟", "Ten little toes."),
    ],
  },
  {
    id: "lips", title: "Lip Sounds: m, b, p, w", e: "👄", color: "#e11d48", kind: "mouth", check: true,
    tip: "These sounds are made with the lips, so they're easy to see. Press your lips together for m, b and p, and make a little circle for w. Let your child watch your mouth, or use Mirror to watch their own.",
    starter: "Play pop: press your lips and pop them open together. Puh, puh, puh!",
    words: [
      W("mom", "👩", "I love my mom.", ["mama", "mommy"]), W("moon", "🌙", "The moon is up at night."), W("ball", "⚽", "Throw the ball."), W("bubble", "🫧", "Pop the bubble!", ["bubbles"]),
      W("baby", "👶", "The baby is little."), W("pop", "🎈", "Pop goes the balloon."), W("pie", "🥧", "I like apple pie."), W("map", "🗺️", "Look at the map."),
      W("water", "💧", "I drink water."), W("wave", "👋", "Wave hello!"),
    ],
  },
  {
    id: "tongue-tip", title: "Tongue Tip: t, d, n, l", e: "👅", color: "#f59e0b", kind: "mouth", check: true,
    tip: "These sounds are made with the tip of the tongue just behind the top teeth. Show your child where your tongue goes, then say the word slowly.",
    starter: "Make a tick-tock clock sound together: t, t, t.",
    words: [
      W("two", "2️⃣", "Two little feet.", ["to", "too"]), W("toe", "🦶", "Wiggle your toe.", ["toes"]), W("dog", "🐶", "The dog is happy."), W("door", "🚪", "Open the door."),
      W("no", "🙅", "No, thank you.", ["know"]), W("nose", "👃", "Touch your nose."), W("night", "🌃", "Good night!"), W("lamp", "💡", "Turn on the lamp."),
      W("lion", "🦁", "The lion can roar."), W("leaf", "🍃", "The leaf is green."),
    ],
  },
  {
    id: "back-sounds", title: "Back Sounds: k, g", e: "🦒", color: "#7c3aed", kind: "mouth", check: true,
    tip: "K and g are made at the back of the mouth, where you can't see them. Hold your child's hand to your throat so they feel g, and make a little cough-like k together.",
    starter: "Play a game of go and stop: say go, run; say stop, freeze!",
    words: [
      W("cup", "☕", "Drink from the cup."), W("cat", "🐱", "The cat says meow."), W("key", "🔑", "Open the door with a key."), W("car", "🚗", "The car is fast."),
      W("cake", "🎂", "Eat the cake."), W("cookie", "🍪", "Can I have a cookie?"), W("go", "🟢", "Ready, set, go!"), W("girl", "👧", "The girl can run."),
      W("goat", "🐐", "The goat says baa."), W("egg", "🥚", "The egg is white."),
    ],
  },
  {
    id: "air-sounds", title: "Air Sounds: f, s, sh, h", e: "💨", color: "#0d9488", kind: "mouth", check: true,
    tip: "These sounds are long streams of air. Put your child's hand in front of your mouth so they feel the air for f, s, sh and h.",
    starter: "Pretend to be a snake together: sss! Then a quiet library: shh!",
    words: [
      W("fish", "🐟", "The fish can swim."), W("fan", "🪭", "The fan is cool."), W("sun", "☀️", "The sun is hot."), W("sock", "🧦", "Put on your sock.", ["socks"]),
      W("soap", "🧼", "Wash with soap."), W("shoe", "👟", "Put on your shoe.", ["shoes"]), W("ship", "🚢", "The ship is on the sea."), W("hat", "🎩", "I wear a hat."),
      W("house", "🏠", "This is my house."), W("happy", "😊", "I am happy."),
    ],
  },
];

export const sayItCategory = (id: string) => SAYIT_CATEGORIES.find((c) => c.id === id) || null;
/** Finds a word in a set (the server checks recordings against these). */
export function sayItWord(categoryId: string, word: string): SayItWord | null {
  return sayItCategory(categoryId)?.words.find((w) => w.w === word) || null;
}
