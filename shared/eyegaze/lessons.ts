// The built-in Eye Gazer lessons: a few "learn" cards (big picture, the word, a short sentence
// read aloud), then a 5-question quiz answered by looking at a picture or word.
//
// This file is the one place the lessons are written. When the server starts it saves them into
// eye_gaze_quizzes / eye_gaze_questions (storage.syncEyeGazeLessons) by each lesson's key, so
// changing a lesson here changes it on the site. A lesson removed from here is hidden, never
// deleted, so finished quizzes and points stay. Pure data and helpers: the tests read it too.
//
// Writing rules (tests/eye-gaze-lessons.test.ts checks most of them):
//   * The FIRST choice of every question is the right answer. Answers are moved to a fair,
//     mixed-up place when the lesson is saved, so they are never all in the same spot.
//   * Only one choice can be right. A picture shown with the question never gives the answer away.
//   * Short, plain words. "Find the ___." for finding, "Which one ___?" / "What ___?" for thinking.
//   * Pictures are keys of client/public/eyegaze/pictures/<key>.svg.

import { picturePath, soundPath, type ChoiceStyle, type LessonStep, type QuestionExtras, type SavedLearnCard } from "./lessonSteps";

export type Skill =
  | "identification" | "naming" | "counting" | "listening" | "comprehension"
  | "matching" | "categories" | "comparison" | "reading" | "safety" | "feelings";

export type LearnCard = { word: string; pic: string; say: string; count?: number; pic2?: string; sound?: string };
export type Choice = { text: string; pic?: string };
export type QuestionDef = {
  /** What is printed above the choices. */
  ask: string;
  /** What the voice says, when different from `ask`. */
  say?: string;
  /** A picture shown with the question. */
  pic?: string;
  pic2?: string;
  count?: number;
  /** A word to read, printed big. The voice must not say it. */
  word?: string;
  sound?: string;
  show: ChoiceStyle;
  skill: Skill;
  /** The first one is the right answer. */
  choices: Choice[];
};
export type LessonDef = {
  key: string;
  title: string;
  step: LessonStep;
  blurb: string;
  cover: string;
  learn: LearnCard[];
  quiz: QuestionDef[];
};

const learn = (word: string, pic: string, say: string, more: Partial<LearnCard> = {}): LearnCard => ({ word, pic, say, ...more });
/** A choice whose word and picture key are the same ("dog" → dog.svg). */
const c = (text: string, pic: string = text.replace(/ /g, "_")): Choice => ({ text, pic });
/** A word-only choice. */
const w = (text: string): Choice => ({ text });
/** "Find the ___." with picture-only choices. */
const find = (ask: string, ...choices: Choice[]): QuestionDef => ({ ask, show: "pictures", skill: "identification", choices });
/** Read a printed word and find its picture. The voice never says the word. */
const readWord = (word: string, ...choices: Choice[]): QuestionDef => ({
  ask: "Read the word. Find its picture.", say: "Read the word. Then find its picture.", word, show: "pictures", skill: "reading", choices,
});

export const EYE_GAZE_LESSONS: LessonDef[] = [
  // ── Step 1: Look & Find (3 pictures) ──
  {
    key: "pet-pals", title: "Pet Pals", step: 1, cover: "dog",
    blurb: "Find the dog, cat, fish, bird and bunny.",
    learn: [
      learn("dog", "dog", "This is a dog. A dog says woof!"),
      learn("cat", "cat", "This is a cat. A cat says meow!"),
      learn("fish", "fish", "This is a fish. A fish swims in water."),
      learn("bird", "bird", "This is a bird. A bird can fly."),
      learn("bunny", "bunny", "This is a bunny. A bunny hops."),
    ],
    quiz: [
      find("Find the dog.", c("dog"), c("fish"), c("bird")),
      find("Find the cat.", c("cat"), c("bunny"), c("dog")),
      find("Find the fish.", c("fish"), c("cat"), c("bird")),
      find("Find the bird.", c("bird"), c("dog"), c("bunny")),
      find("Find the bunny.", c("bunny"), c("fish"), c("cat")),
    ],
  },
  {
    key: "snack-attack", title: "Snack Attack", step: 1, cover: "pizza",
    blurb: "Find yummy snacks.",
    learn: [
      learn("apple", "apple", "This is an apple. It is red and crunchy."),
      learn("banana", "banana", "This is a banana. It is yellow."),
      learn("cookie", "cookie", "This is a cookie. Yum!"),
      learn("pizza", "pizza", "This is pizza. It has cheese on top."),
      learn("grapes", "grapes", "These are grapes. They are small and round."),
    ],
    quiz: [
      find("Find the apple.", c("apple"), c("cookie"), c("pizza")),
      find("Find the banana.", c("banana"), c("grapes"), c("apple")),
      find("Find the cookie.", c("cookie"), c("banana"), c("grapes")),
      find("Find the pizza.", c("pizza"), c("apple"), c("cookie")),
      find("Find the grapes.", c("grapes"), c("pizza"), c("banana")),
    ],
  },
  {
    key: "color-pop", title: "Color Pop", step: 1, cover: "palette",
    blurb: "Find red, blue, yellow, green and purple.",
    learn: [
      learn("red", "red", "This is red. A fire truck is red."),
      learn("blue", "blue", "This is blue. The sky is blue."),
      learn("yellow", "yellow", "This is yellow. The sun is yellow."),
      learn("green", "green", "This is green. Grass is green."),
      learn("purple", "purple", "This is purple. Grapes can be purple."),
    ],
    quiz: [
      find("Find red.", c("red"), c("blue"), c("green")),
      find("Find blue.", c("blue"), c("yellow"), c("red")),
      find("Find yellow.", c("yellow"), c("purple"), c("blue")),
      find("Find green.", c("green"), c("red"), c("yellow")),
      find("Find purple.", c("purple"), c("green"), c("red")),
    ],
  },
  {
    key: "feelings-check-in", title: "Feelings Check-In", step: 1, cover: "happy",
    blurb: "Find happy, sad, mad, scared and tired faces.",
    learn: [
      learn("happy", "happy", "This face is happy. It has a big smile."),
      learn("sad", "sad", "This face is sad. It is crying."),
      learn("mad", "mad", "This face is mad."),
      learn("scared", "scared", "This face is scared."),
      learn("tired", "tired", "This face is tired. It is yawning."),
    ],
    quiz: [
      find("Find the happy face.", c("happy"), c("sad"), c("mad")),
      find("Find the sad face.", c("sad"), c("happy"), c("scared")),
      find("Find the mad face.", c("mad"), c("tired"), c("happy")),
      find("Find the scared face.", c("scared"), c("mad"), c("tired")),
      find("Find the tired face.", c("tired"), c("scared"), c("sad")),
    ],
  },
  {
    key: "zoo-crew", title: "Zoo Crew", step: 1, cover: "lion",
    blurb: "Find animals from the zoo.",
    learn: [
      learn("lion", "lion", "This is a lion. A lion can roar!"),
      learn("elephant", "elephant", "This is an elephant. It has a long trunk."),
      learn("monkey", "monkey", "This is a monkey. A monkey can climb."),
      learn("giraffe", "giraffe", "This is a giraffe. It has a long neck."),
      learn("zebra", "zebra", "This is a zebra. It has black and white stripes."),
    ],
    quiz: [
      find("Find the lion.", c("lion"), c("zebra"), c("monkey")),
      find("Find the elephant.", c("elephant"), c("lion"), c("giraffe")),
      find("Find the monkey.", c("monkey"), c("elephant"), c("zebra")),
      find("Find the giraffe.", c("giraffe"), c("monkey"), c("lion")),
      find("Find the zebra.", c("zebra"), c("giraffe"), c("elephant")),
    ],
  },
  {
    key: "wheels-and-wings", title: "Wheels & Wings", step: 1, cover: "airplane",
    blurb: "Find the car, bus, train, airplane and bike.",
    learn: [
      learn("car", "car", "This is a car. A car drives on the road."),
      learn("bus", "bus", "This is a bus. Lots of people ride the bus."),
      learn("train", "train", "This is a train. A train rides on tracks."),
      learn("airplane", "airplane", "This is an airplane. It flies in the sky."),
      learn("bike", "bike", "This is a bike. You pedal a bike."),
    ],
    quiz: [
      find("Find the car.", c("car"), c("airplane"), c("bike")),
      find("Find the bus.", c("bus"), c("train"), c("car")),
      find("Find the train.", c("train"), c("bike"), c("bus")),
      find("Find the airplane.", c("airplane"), c("car"), c("train")),
      find("Find the bike.", c("bike"), c("bus"), c("airplane")),
    ],
  },

  // ── Step 2: Name It (4 choices) ──
  {
    key: "shape-squad", title: "Shape Squad", step: 2, cover: "shape_star",
    blurb: "Find and name the circle, square, triangle, star and heart.",
    learn: [
      learn("circle", "shape_circle", "This is a circle. It is round."),
      learn("square", "shape_square", "This is a square. It has four sides."),
      learn("triangle", "shape_triangle", "This is a triangle. It has three sides."),
      learn("star", "shape_star", "This is a star. It has five points."),
      learn("heart", "shape_heart", "This is a heart."),
    ],
    quiz: [
      find("Find the circle.", c("circle", "shape_circle"), c("square", "shape_square"), c("triangle", "shape_triangle"), c("star", "shape_star")),
      find("Find the triangle.", c("triangle", "shape_triangle"), c("heart", "shape_heart"), c("circle", "shape_circle"), c("square", "shape_square")),
      { ask: "What shape is this?", pic: "shape_square", show: "words", skill: "naming", choices: [w("square"), w("circle"), w("star"), w("heart")] },
      find("Find the heart.", c("heart", "shape_heart"), c("star", "shape_star"), c("triangle", "shape_triangle"), c("circle", "shape_circle")),
      { ask: "What shape is this?", pic: "shape_star", show: "words", skill: "naming", choices: [w("star"), w("triangle"), w("square"), w("circle")] },
    ],
  },
  {
    key: "count-it-up", title: "Count It Up", step: 2, cover: "abacus",
    blurb: "Count from 1 to 5.",
    learn: [
      learn("1", "ball", "One. One ball.", { count: 1 }),
      learn("2", "apple", "Two. One, two.", { count: 2 }),
      learn("3", "duck", "Three. One, two, three.", { count: 3 }),
      learn("4", "star", "Four. One, two, three, four.", { count: 4 }),
      learn("5", "fish", "Five. One, two, three, four, five.", { count: 5 }),
    ],
    quiz: [
      { ask: "How many apples?", pic: "apple", count: 3, show: "words", skill: "counting", choices: [w("3"), w("2"), w("4"), w("5")] },
      { ask: "How many balls?", pic: "ball", count: 2, show: "words", skill: "counting", choices: [w("2"), w("1"), w("3"), w("4")] },
      { ask: "How many stars?", pic: "star", count: 5, show: "words", skill: "counting", choices: [w("5"), w("4"), w("3"), w("2")] },
      { ask: "How many fish?", pic: "fish", count: 1, show: "words", skill: "counting", choices: [w("1"), w("2"), w("3"), w("5")] },
      { ask: "How many ducks?", pic: "duck", count: 4, show: "words", skill: "counting", choices: [w("4"), w("3"), w("5"), w("2")] },
    ],
  },
  {
    key: "head-to-toe", title: "Head to Toe", step: 2, cover: "waving_hand",
    blurb: "What does each body part do?",
    learn: [
      learn("eyes", "eyes", "We see with our eyes."),
      learn("ears", "ear", "We hear with our ears."),
      learn("nose", "nose", "We smell with our nose."),
      learn("mouth", "mouth", "We eat and talk with our mouth."),
      learn("hands", "hand", "We hold things and wave with our hands."),
      learn("feet", "foot", "We walk and kick with our feet."),
    ],
    quiz: [
      { ask: "What do you see with?", show: "both", skill: "comprehension", choices: [c("eyes"), c("ears", "ear"), c("nose"), c("feet", "foot")] },
      { ask: "What do you hear with?", show: "both", skill: "comprehension", choices: [c("ears", "ear"), c("mouth"), c("hands", "hand"), c("eyes")] },
      { ask: "What do you smell with?", show: "both", skill: "comprehension", choices: [c("nose"), c("feet", "foot"), c("eyes"), c("hands", "hand")] },
      { ask: "What do you eat with?", show: "both", skill: "comprehension", choices: [c("mouth"), c("ears", "ear"), c("feet", "foot"), c("eyes")] },
      { ask: "What do you kick a ball with?", show: "both", skill: "comprehension", choices: [c("feet", "foot"), c("ears", "ear"), c("eyes"), c("nose")] },
    ],
  },
  {
    key: "get-dressed", title: "Get Dressed", step: 2, cover: "shirt",
    blurb: "What do we wear, and where does it go?",
    learn: [
      learn("shirt", "shirt", "A shirt goes on your body."),
      learn("pants", "pants", "Pants go on your legs."),
      learn("shoes", "shoes", "Shoes go on your feet."),
      learn("hat", "hat", "A hat goes on your head."),
      learn("gloves", "gloves", "Gloves go on your hands."),
      learn("coat", "coat", "A coat keeps you warm when it is cold."),
    ],
    quiz: [
      { ask: "What goes on your head?", show: "both", skill: "comprehension", choices: [c("hat"), c("shoes"), c("pants"), c("gloves")] },
      { ask: "What goes on your hands?", show: "both", skill: "comprehension", choices: [c("gloves"), c("hat"), c("pants"), c("shoes")] },
      { ask: "What goes on your legs?", show: "both", skill: "comprehension", choices: [c("pants"), c("hat"), c("gloves"), c("shirt")] },
      { ask: "What goes on your feet?", show: "both", skill: "comprehension", choices: [c("shoes"), c("hat"), c("shirt"), c("gloves")] },
      { ask: "It is cold and snowy. What do you wear?", show: "both", skill: "comprehension", choices: [c("coat"), c("shorts"), c("sandals"), c("sunglasses")] },
    ],
  },
  {
    key: "sky-watch", title: "Sky Watch", step: 2, cover: "sun_rain",
    blurb: "Name the weather and what you need for it.",
    learn: [
      learn("sunny", "sun", "It is sunny. The sun is shining."),
      learn("rainy", "rain", "It is rainy. Rain falls from the clouds."),
      learn("snowy", "snow", "It is snowy. Snow is cold."),
      learn("cloudy", "cloud", "It is cloudy. Clouds hide the sun."),
      learn("umbrella", "umbrella", "An umbrella keeps you dry in the rain."),
      learn("sunglasses", "sunglasses", "Sunglasses help your eyes when it is bright."),
    ],
    quiz: [
      { ask: "What is the weather?", pic: "sun", show: "words", skill: "naming", choices: [w("sunny"), w("rainy"), w("snowy"), w("cloudy")] },
      { ask: "What is the weather?", pic: "snow", show: "words", skill: "naming", choices: [w("snowy"), w("sunny"), w("cloudy"), w("rainy")] },
      find("Find rainy weather.", c("rainy", "rain"), c("sunny", "sun"), c("snowy", "snow"), c("cloudy", "cloud")),
      { ask: "It is raining. What do you need?", show: "both", skill: "comprehension", choices: [c("umbrella"), c("sunglasses"), c("kite"), c("sled")] },
      { ask: "It is hot and sunny. What helps your eyes?", show: "both", skill: "comprehension", choices: [c("sunglasses"), c("gloves"), c("coat"), c("socks")] },
    ],
  },
  {
    key: "who-says-that", title: "Who Says That?", step: 2, cover: "cow",
    blurb: "Listen to the sound. Find the animal.",
    learn: [
      learn("cow", "cow", "A cow says moo.", { sound: "cow" }),
      learn("dog", "dog", "A dog says woof.", { sound: "dog" }),
      learn("cat", "cat", "A cat says meow.", { sound: "cat" }),
      learn("duck", "duck", "A duck says quack.", { sound: "duck" }),
      learn("sheep", "sheep", "A sheep says baa.", { sound: "sheep" }),
      learn("rooster", "rooster", "A rooster says cock-a-doodle-doo!", { sound: "rooster" }),
    ],
    quiz: [
      { ask: "Who says “moo”?", say: "Who says moo?", sound: "cow", show: "both", skill: "listening", choices: [c("cow"), c("duck"), c("cat"), c("dog")] },
      { ask: "Who says “woof”?", say: "Who says woof?", sound: "dog", show: "both", skill: "listening", choices: [c("dog"), c("sheep"), c("cow"), c("rooster")] },
      { ask: "Who says “meow”?", say: "Who says meow?", sound: "cat", show: "both", skill: "listening", choices: [c("cat"), c("cow"), c("sheep"), c("duck")] },
      { ask: "Who says “quack”?", say: "Who says quack?", sound: "duck", show: "both", skill: "listening", choices: [c("duck"), c("dog"), c("rooster"), c("cat")] },
      { ask: "Who says “baa”?", say: "Who says baa?", sound: "sheep", show: "both", skill: "listening", choices: [c("sheep"), c("rooster"), c("duck"), c("cow")] },
    ],
  },

  // ── Step 3: Think It Through ──
  {
    key: "what-do-i-need", title: "What Do I Need?", step: 3, cover: "toolbox",
    blurb: "Pick the right thing for the job.",
    learn: [
      learn("cup", "cup", "We drink from a cup."),
      learn("spoon", "spoon", "We eat soup with a spoon."),
      learn("soap", "soap", "Soap cleans our hands."),
      learn("scissors", "scissors", "We cut paper with scissors."),
      learn("toothbrush", "toothbrush", "We brush our teeth with a toothbrush."),
      learn("pencil", "pencil", "We write with a pencil."),
    ],
    quiz: [
      { ask: "I am thirsty. What do I need?", show: "both", skill: "comprehension", choices: [c("cup"), c("pencil"), c("soap"), c("scissors")] },
      { ask: "I want to eat soup. What do I need?", show: "both", skill: "comprehension", choices: [c("spoon"), c("scissors"), c("toothbrush"), c("pencil")] },
      { ask: "My hands are dirty. What do I need?", show: "both", skill: "comprehension", choices: [c("soap"), c("pencil"), c("spoon"), c("scissors")] },
      { ask: "I want to cut paper. What do I need?", show: "both", skill: "comprehension", choices: [c("scissors"), c("cup"), c("soap"), c("toothbrush")] },
      { ask: "I want to brush my teeth. What do I need?", show: "both", skill: "comprehension", choices: [c("toothbrush"), c("pencil"), c("scissors"), c("spoon")] },
    ],
  },
  {
    key: "perfect-pairs", title: "Perfect Pairs", step: 3, cover: "puzzle",
    blurb: "Find two things that go together.",
    learn: [
      learn("socks and shoes", "socks", "Socks and shoes go together.", { pic2: "shoes" }),
      learn("key and lock", "key", "A key opens a lock.", { pic2: "lock" }),
      learn("dog and bone", "dog", "A dog chews a bone.", { pic2: "bone" }),
      learn("bee and honey", "bee", "A bee makes honey.", { pic2: "honey" }),
      learn("pencil and paper", "pencil", "We write on paper with a pencil.", { pic2: "paper" }),
    ],
    quiz: [
      { ask: "What goes with the socks?", pic: "socks", show: "both", skill: "matching", choices: [c("shoes"), c("bone"), c("lock"), c("honey")] },
      { ask: "What goes with the key?", pic: "key", show: "both", skill: "matching", choices: [c("lock"), c("shoes"), c("honey"), c("paper")] },
      { ask: "What goes with the dog?", pic: "dog", show: "both", skill: "matching", choices: [c("bone"), c("paper"), c("lock"), c("honey")] },
      { ask: "What goes with the bee?", pic: "bee", show: "both", skill: "matching", choices: [c("honey"), c("shoes"), c("bone"), c("paper")] },
      { ask: "What goes with the pencil?", pic: "pencil", show: "both", skill: "matching", choices: [c("paper"), c("bone"), c("honey"), c("lock")] },
    ],
  },
  {
    key: "around-the-house", title: "Around the House", step: 3, cover: "home",
    blurb: "Where do we sleep, take a bath and sit?",
    learn: [
      learn("bed", "bed", "We sleep in a bed."),
      learn("bathtub", "bathtub", "We take a bath in the bathtub."),
      learn("couch", "couch", "We sit on the couch."),
      learn("toilet", "toilet", "We use the toilet in the bathroom."),
      learn("trash can", "trash_can", "Trash goes in the trash can."),
      learn("door", "door", "We open the door to go in and out."),
    ],
    quiz: [
      { ask: "Where do you sleep?", show: "both", skill: "comprehension", choices: [c("bed"), c("bathtub"), c("trash can"), c("door")] },
      { ask: "Where do you take a bath?", show: "both", skill: "comprehension", choices: [c("bathtub"), c("couch"), c("bed"), c("door")] },
      { ask: "Where does trash go?", show: "both", skill: "comprehension", choices: [c("trash can"), c("bed"), c("couch"), c("bathtub")] },
      { ask: "Where do you sit to watch TV?", show: "both", skill: "comprehension", choices: [c("couch"), c("bathtub"), c("trash can"), c("door")] },
      { ask: "What do you open to go outside?", show: "both", skill: "comprehension", choices: [c("door"), c("bed"), c("couch"), c("toilet")] },
    ],
  },
  {
    key: "opposite-world", title: "Opposite World", step: 3, cover: "opposites",
    blurb: "Hot or cold? Big or small? Fast or slow?",
    learn: [
      learn("hot and cold", "fire", "Fire is hot. Ice is cold.", { pic2: "ice" }),
      learn("big and small", "elephant", "An elephant is big. A mouse is small.", { pic2: "mouse" }),
      learn("fast and slow", "race_car", "A race car is fast. A snail is slow.", { pic2: "snail" }),
    ],
    quiz: [
      { ask: "Which one is hot?", show: "both", skill: "comparison", choices: [c("fire"), c("ice"), c("snowman"), c("ice cream")] },
      { ask: "Which one is cold?", show: "both", skill: "comparison", choices: [c("ice"), c("fire"), c("sun"), c("hot pepper")] },
      { ask: "Which one is big?", show: "both", skill: "comparison", choices: [c("elephant"), c("mouse"), c("ant"), c("ladybug")] },
      { ask: "Which one is slow?", show: "both", skill: "comparison", choices: [c("snail"), c("race car"), c("rocket"), c("airplane")] },
      { ask: "Which one is fast?", show: "both", skill: "comparison", choices: [c("race car"), c("snail"), c("turtle"), c("sloth")] },
    ],
  },
  {
    key: "helpers-in-town", title: "Helpers in Town", step: 3, cover: "firefighter",
    blurb: "Who helps us in our town?",
    learn: [
      learn("doctor", "doctor", "A doctor helps us when we are sick."),
      learn("firefighter", "firefighter", "A firefighter puts out fires."),
      learn("police officer", "police", "A police officer helps keep us safe."),
      learn("teacher", "teacher", "A teacher helps us learn."),
      learn("farmer", "farmer", "A farmer grows food."),
      learn("cook", "cook", "A cook makes food."),
    ],
    quiz: [
      { ask: "Who helps you when you are sick?", show: "both", skill: "comprehension", choices: [c("doctor"), c("farmer"), c("cook"), c("firefighter")] },
      { ask: "Who puts out fires?", show: "both", skill: "comprehension", choices: [c("firefighter"), c("teacher"), c("doctor"), c("cook")] },
      { ask: "Who helps you learn at school?", show: "both", skill: "comprehension", choices: [c("teacher"), c("farmer"), c("police officer", "police"), c("firefighter")] },
      { ask: "Who grows food on a farm?", show: "both", skill: "comprehension", choices: [c("farmer"), c("teacher"), c("doctor"), c("police officer", "police")] },
      { ask: "Who makes food in a restaurant?", show: "both", skill: "comprehension", choices: [c("cook"), c("firefighter"), c("police officer", "police"), c("teacher")] },
    ],
  },
  {
    key: "sort-it-out", title: "Sort It Out", step: 3, cover: "basket",
    blurb: "Find the fruit, the animal and more.",
    learn: [
      learn("fruit", "strawberry", "A strawberry is a fruit."),
      learn("animal", "horse", "A horse is an animal."),
      learn("wear", "hat", "You can wear a hat."),
      learn("ride", "bike", "You can ride a bike."),
      learn("eat", "sandwich", "You can eat a sandwich."),
    ],
    quiz: [
      { ask: "Which one is a fruit?", show: "both", skill: "categories", choices: [c("strawberry"), c("bus"), c("socks"), c("chair")] },
      { ask: "Which one is an animal?", show: "both", skill: "categories", choices: [c("horse"), c("cup"), c("car"), c("pencil")] },
      { ask: "Which one can you wear?", show: "both", skill: "categories", choices: [c("hat"), c("apple"), c("bike"), c("bed")] },
      { ask: "Which one can you ride?", show: "both", skill: "categories", choices: [c("bike"), c("cookie"), c("shirt"), c("book")] },
      { ask: "Which one can you eat?", show: "both", skill: "categories", choices: [c("sandwich"), c("shoes"), c("car"), c("chair")] },
    ],
  },

  // ── Step 4: Read & Answer ──
  {
    key: "tiny-tales", title: "Tiny Tales", step: 4, cover: "book",
    blurb: "Read a tiny story. Find the answer.",
    learn: [
      learn("ball", "ball", "This is a ball. You can kick a ball."),
      learn("banana", "banana", "This is a banana."),
      learn("bed", "bed", "This is a bed."),
      learn("bus", "bus", "This is a bus."),
      learn("milk", "milk", "This is milk."),
    ],
    quiz: [
      { ask: "Max kicks the ball. What does Max kick?", show: "pictures", skill: "comprehension", choices: [c("ball"), c("cake"), c("bed"), c("book")] },
      { ask: "Ana eats a banana. What does Ana eat?", show: "pictures", skill: "comprehension", choices: [c("banana"), c("pizza"), c("cookie"), c("apple")] },
      { ask: "The cat sleeps on the bed. Where is the cat?", show: "pictures", skill: "comprehension", choices: [c("bed"), c("car"), c("tree"), c("boat")] },
      { ask: "Leo rides the bus to school. What does Leo ride?", show: "pictures", skill: "comprehension", choices: [c("bus"), c("bike"), c("horse"), c("boat")] },
      { ask: "Mia drinks milk. What does Mia drink?", show: "pictures", skill: "comprehension", choices: [c("milk"), c("juice"), c("cocoa"), c("cup")] },
    ],
  },
  {
    key: "who-what-where", title: "Who, What, Where?", step: 4, cover: "magnifier",
    blurb: "Read and answer who, what and where.",
    learn: [
      learn("Dad", "dad", "This is Dad."),
      learn("Grandma", "grandma", "This is Grandma."),
      learn("hat", "hat", "This is a hat."),
      learn("tree", "tree", "This is a tree."),
      learn("water", "water", "This is water."),
    ],
    quiz: [
      { ask: "Dad cooks dinner. Who cooks?", show: "pictures", skill: "comprehension", choices: [c("Dad", "dad"), c("baby"), c("Grandma", "grandma"), c("girl")] },
      { ask: "Grandma reads a book. Who reads?", show: "pictures", skill: "comprehension", choices: [c("Grandma", "grandma"), c("baby"), c("boy"), c("Dad", "dad")] },
      { ask: "Sam puts on his hat. What does Sam put on?", show: "pictures", skill: "comprehension", choices: [c("hat"), c("shoes"), c("coat"), c("gloves")] },
      { ask: "The bird sits in the tree. Where is the bird?", show: "pictures", skill: "comprehension", choices: [c("tree"), c("car"), c("bathtub"), c("bed")] },
      { ask: "The fish swims in the water. Where is the fish?", show: "pictures", skill: "comprehension", choices: [c("water"), c("tree"), c("bed"), c("car")] },
    ],
  },
  {
    key: "read-and-find", title: "Read & Find", step: 4, cover: "abc",
    blurb: "Read the word. Find its picture.",
    learn: [
      learn("cat", "cat", "This word says cat."),
      learn("sun", "sun", "This word says sun."),
      learn("bus", "bus", "This word says bus."),
      learn("hat", "hat", "This word says hat."),
      learn("cup", "cup", "This word says cup."),
    ],
    quiz: [
      readWord("cat", c("cat"), c("dog"), c("fish"), c("bird")),
      readWord("sun", c("sun"), c("moon"), c("star"), c("cloud")),
      readWord("bus", c("bus"), c("car"), c("bike"), c("train")),
      readWord("hat", c("hat"), c("socks"), c("coat"), c("shoes")),
      readWord("cup", c("cup"), c("spoon"), c("fork"), c("bowl")),
    ],
  },
  {
    key: "power-words", title: "Power Words", step: 4, cover: "megaphone",
    blurb: "Match pictures to words we use every day.",
    learn: [
      learn("yes", "yes", "Yes. I want it."),
      learn("no", "no", "No. I do not want it."),
      learn("stop", "stop_sign", "Stop. Stop right now."),
      learn("go", "green", "Go. Green means go."),
      learn("more", "more", "More. I want more, please."),
      learn("help", "help", "Help. I need help, please."),
    ],
    quiz: [
      { ask: "Which word goes with this picture?", pic: "yes", show: "words", skill: "reading", choices: [w("yes"), w("no"), w("more"), w("go")] },
      { ask: "Which word goes with this picture?", pic: "stop_sign", show: "words", skill: "reading", choices: [w("stop"), w("help"), w("yes"), w("more")] },
      { ask: "Which word goes with this picture?", pic: "more", show: "words", skill: "reading", choices: [w("more"), w("stop"), w("no"), w("help")] },
      { ask: "Which word goes with this picture?", pic: "help", show: "words", skill: "reading", choices: [w("help"), w("go"), w("yes"), w("stop")] },
      { ask: "Which word goes with this picture?", pic: "no", show: "words", skill: "reading", choices: [w("no"), w("yes"), w("go"), w("more")] },
    ],
  },
  {
    key: "signs-i-know", title: "Signs I Know", step: 4, cover: "stop_sign",
    blurb: "Know the signs that keep us safe.",
    learn: [
      learn("stop", "stop_sign", "This sign means STOP. Stop and wait."),
      learn("restroom", "restroom", "This sign shows the bathroom."),
      learn("do not enter", "no_entry", "This sign means do not go in."),
      learn("be careful", "warning", "This sign means be careful."),
      learn("hospital", "hospital", "This is a hospital. Doctors help sick people here."),
    ],
    quiz: [
      { ask: "Which sign means STOP?", say: "Which sign means stop?", show: "pictures", skill: "safety", choices: [c("stop sign", "stop_sign"), c("restroom"), c("hospital"), c("be careful", "warning")] },
      { ask: "Which sign shows the bathroom?", show: "pictures", skill: "safety", choices: [c("restroom"), c("stop sign", "stop_sign"), c("do not enter", "no_entry"), c("school")] },
      { ask: "Which sign means DO NOT GO IN?", say: "Which sign means do not go in?", show: "pictures", skill: "safety", choices: [c("do not enter", "no_entry"), c("restroom"), c("be careful", "warning"), c("hospital")] },
      { ask: "Which sign means BE CAREFUL?", say: "Which sign means be careful?", show: "pictures", skill: "safety", choices: [c("be careful", "warning"), c("restroom"), c("hospital"), c("school")] },
      { ask: "Which building is the hospital?", show: "pictures", skill: "safety", choices: [c("hospital"), c("school"), c("stadium"), c("house")] },
    ],
  },
  {
    key: "how-would-you-feel", title: "How Would You Feel?", step: 4, cover: "thinking",
    blurb: "Read what happens. Pick the feeling.",
    learn: [
      learn("happy", "happy", "Happy. I feel happy when I play with a friend."),
      learn("sad", "sad", "Sad. I feel sad when I lose something."),
      learn("mad", "mad", "Mad. I feel mad when someone takes my things."),
      learn("scared", "scared", "Scared. I feel scared in a loud storm."),
      learn("tired", "tired", "Tired. I feel tired when I stay up late."),
      learn("silly", "silly", "Silly. I feel silly when I make funny faces."),
    ],
    quiz: [
      { ask: "It is your birthday. You get a gift. How do you feel?", show: "pictures", skill: "feelings", choices: [c("happy"), c("sad"), c("mad"), c("tired")] },
      { ask: "Your ice cream falls on the ground. How do you feel?", show: "pictures", skill: "feelings", choices: [c("sad"), c("happy"), c("silly"), c("scared")] },
      { ask: "Someone takes your toy without asking. How do you feel?", show: "pictures", skill: "feelings", choices: [c("mad"), c("happy"), c("tired"), c("silly")] },
      { ask: "You hear loud thunder at night. How do you feel?", show: "pictures", skill: "feelings", choices: [c("scared"), c("happy"), c("silly"), c("mad")] },
      { ask: "You went to bed very late. How do you feel in the morning?", show: "pictures", skill: "feelings", choices: [c("tired"), c("happy"), c("mad"), c("scared")] },
    ],
  },
];

/** Titles of the first lesson set (2026), retired in this redo. New lessons never reuse them. */
export const RETIRED_LESSON_TITLES = [
  "Animal Friends", "Colors All Around", "What Do You See?", "Shape Hunt", "Story Time", "Farm Friends",
  "Yummy Fruits", "Body Parts", "Weather Watch", "Vehicle Fun", "Happy Faces", "Counting Fun", "Nature Walk",
  "Clothing Time", "Yummy Vegetables", "Animal Sounds", "Toy Box", "School Time", "Day and Night",
  "Big and Small", "Food Time", "Action Words", "Music Time", "Sports Fun", "Family Faces",
];

// ── Saving ──

const LETTERS = ["A", "B", "C", "D"] as const;

function seeded(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 16777619); }
  let s = (h >>> 0) % 2147483646 + 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}

/** Where each question's right answer goes: spread over every spot, never the same spot twice
 *  in a row, and never the A, B, C, D… pattern. The same lesson always gets the same order. */
export function answerSpots(lesson: Pick<LessonDef, "key" | "quiz">): number[] {
  const random = seeded(lesson.key);
  const counts = lesson.quiz.map(q => q.choices.length);
  for (let attempt = 0; attempt < 500; attempt++) {
    const base = shuffle(Array.from({ length: Math.min(...counts) }, (_, i) => i), random);
    const spots = lesson.quiz.map((_, i) => base[i % base.length]);
    shuffle(spots, random);
    const repeats = spots.some((s, i) => i > 0 && s === spots[i - 1]);
    // No A, B, C (or B, C, D) run either way.
    const stepping = spots.some((s, i) => i > 1 && Math.abs(s - spots[i - 1]) === 1 && s - spots[i - 1] === spots[i - 1] - spots[i - 2]);
    if (!repeats && !stepping && spots.every((s, i) => s < counts[i])) return spots;
  }
  return lesson.quiz.map((_, i) => i % Math.min(...counts));
}

export type SavedQuestion = {
  question_order: number;
  prompt: string;
  visual: string;
  visual_type: "image" | "word" | "";
  option_a: string; option_b: string; option_c: string; option_d: string;
  option_a_image: string | null; option_b_image: string | null; option_c_image: string | null; option_d_image: string | null;
  correct_answer: string;
  skill_type: Skill;
  extras: QuestionExtras;
};
export type SavedLesson = {
  lesson_key: string;
  title: string;
  description: string;
  level: LessonStep;
  sort_order: number;
  cover_visual: string;
  cover_visual_type: "image";
  learn_cards: SavedLearnCard[];
  is_active: true;
};

/** A lesson as the rows saved in eye_gaze_quizzes and eye_gaze_questions. */
export function lessonRows(lesson: LessonDef, sortOrder: number): { quiz: SavedLesson; questions: SavedQuestion[] } {
  const spots = answerSpots(lesson);
  const questions = lesson.quiz.map((q, index): SavedQuestion => {
    const random = seeded(`${lesson.key}:${index}`);
    const [right, ...others] = q.choices;
    const ordered = shuffle([...others], random);
    ordered.splice(spots[index], 0, right);
    const slot = (i: number) => ordered[i];
    const extras: QuestionExtras = { say: q.say || q.ask, show: q.show };
    if (q.count) extras.count = q.count;
    if (q.word) extras.word = q.word;
    if (q.sound) extras.sound = soundPath(q.sound);
    if (q.pic2) extras.picture2 = picturePath(q.pic2);
    return {
      question_order: index + 1,
      prompt: q.ask,
      visual: q.pic ? picturePath(q.pic) : q.word || "",
      visual_type: q.pic ? "image" : q.word ? "word" : "",
      option_a: slot(0)?.text || "", option_b: slot(1)?.text || "", option_c: slot(2)?.text || "", option_d: slot(3)?.text || "",
      option_a_image: slot(0)?.pic ? picturePath(slot(0).pic!) : null,
      option_b_image: slot(1)?.pic ? picturePath(slot(1).pic!) : null,
      option_c_image: slot(2)?.pic ? picturePath(slot(2).pic!) : null,
      option_d_image: slot(3)?.pic ? picturePath(slot(3).pic!) : null,
      correct_answer: LETTERS[spots[index]],
      skill_type: q.skill,
      extras,
    };
  });
  return {
    quiz: {
      lesson_key: lesson.key,
      title: lesson.title,
      description: lesson.blurb,
      level: lesson.step,
      sort_order: sortOrder,
      cover_visual: picturePath(lesson.cover),
      cover_visual_type: "image",
      learn_cards: lesson.learn.map(card => {
        const saved: SavedLearnCard = { word: card.word, picture: picturePath(card.pic), say: card.say };
        if (card.count) saved.count = card.count;
        if (card.pic2) saved.picture2 = picturePath(card.pic2);
        if (card.sound) saved.sound = soundPath(card.sound);
        return saved;
      }),
      is_active: true,
    },
    questions,
  };
}

/** Every picture key the lessons use (each needs client/public/eyegaze/pictures/<key>.svg). */
export function lessonPictureKeys(lessons: LessonDef[] = EYE_GAZE_LESSONS): string[] {
  const keys = new Set<string>();
  for (const lesson of lessons) {
    keys.add(lesson.cover);
    for (const card of lesson.learn) { keys.add(card.pic); if (card.pic2) keys.add(card.pic2); }
    for (const q of lesson.quiz) {
      if (q.pic) keys.add(q.pic);
      if (q.pic2) keys.add(q.pic2);
      for (const choice of q.choices) if (choice.pic) keys.add(choice.pic);
    }
  }
  return [...keys].sort();
}
