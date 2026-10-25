// A.R.I.S.E. Beginners: the scope and sequence, part 1 (units 1–9).
//
// Each unit teaches a few new spellings, a few heart words (words with a part we learn by heart), and has
// three or four lessons. Every lesson has its own decodable story: every word in it uses only spellings
// already taught, or is a heart word already taught. tests/beginners-content.test.ts checks every story.
//
// Word bank tokens: spelling parts joined by "|", then ":emoji" for a picture, then "=s-o-u-n-d-s" when the
// rules can't work the sounds out. A capital letter marks a name. Heart words: parts, then "!" and the
// tricky part numbers (from 0).
//
// Sort: [left label, right label, left words, right words].
// Questions: [question, right answer, wrong answer, wrong answer] (the order is mixed when played).

export type LessonDef = {
  id: string;
  title: string;
  /** The story's picture. */
  pic: string;
  /** Spellings this lesson works on. */
  focus: string[];
  /** Heart words this lesson teaches. */
  heart?: string[];
  /** Three words to build, each one change from the last. */
  chain: string;
  /** Three words to spell. */
  spell: string;
  sort: [string, string, string, string];
  text: string;
  q: [string, string, string, string][];
};
export type UnitDef = {
  n: number;
  title: string;
  /** What Ari says to open the unit. */
  kid: string;
  /** Teacher-facing: what the unit teaches. */
  skill: string;
  grade: string;
  color: string;
  icon: string;
  graphemes: string[];
  words: string;
  hearts?: string;
  lessons: LessonDef[];
};

export const UNITS_A: UnitDef[] = [
  {
    n: 1, title: "Short a", kid: "Let's learn the sounds for m, s, t, p and short a!", skill: "Short a with m, s, t, p", grade: "K", color: "#f97316", icon: "🍎",
    graphemes: ["a", "m", "s", "t", "p"],
    words: "a|m a|t m|a|t s|a|t p|a|t t|a|p m|a|p:🗺️ s|a|p S|a|m P|a|m P|a|t",
    hearts: "a!0 I!0 th|e!1 i|s!1",
    lessons: [
      {
        id: "u1l1", title: "I Am Sam", pic: "🧒", focus: ["a", "m", "s", "t"], heart: ["a", "I"],
        chain: "a|t s|a|t m|a|t", spell: "a|m s|a|t m|a|t", sort: ["ends with t", "ends with m", "at sat mat", "am Sam"],
        text: "I am Sam. I sat. I sat at a mat. Sam sat at a mat. Sam! Sam! Sam sat at a mat!",
        q: [["Who is in the story?", "Sam", "Pam", "Pat"], ["What did Sam sit at?", "a mat", "a map", "a tap"], ["Who says \"I am Sam\"?", "Sam", "Pam", "a mat"]],
      },
      {
        id: "u1l2", title: "Tap the Map", pic: "🗺️", focus: ["p"], heart: ["the"],
        chain: "m|a|t m|a|p t|a|p", spell: "m|a|p t|a|p p|a|t", sort: ["ends with p", "ends with t", "map tap sap", "mat sat pat"],
        text: "Pam sat at the map. Tap the map, Pam! Tap, tap, tap. Sam sat at the mat. Pat the mat, Sam! Pat, pat, pat.",
        q: [["Where did Pam sit?", "at the map", "at the mat", "at a tap"], ["What did Sam pat?", "the mat", "the map", "Pam"], ["What sound is at the map?", "tap, tap, tap", "pat, pat, pat", "sat, sat, sat"]],
      },
      {
        id: "u1l3", title: "Sam Is at the Map", pic: "🐱", focus: ["a", "p", "m"], heart: ["is"],
        chain: "s|a|p s|a|t p|a|t", spell: "S|a|m P|a|m t|a|p", sort: ["ends with m", "ends with p", "Sam Pam am", "map tap sap"],
        text: "I am Pam. Sam is at the mat. I pat Sam. Pat, pat, pat! Sam is at the map. Tap, tap, tap! Sam sat at the map. I sat at the map. Pat is at the mat.",
        q: [["Who pats Sam?", "Pam", "Pat", "the map"], ["Where did Sam go after the mat?", "the map", "the tap", "a sap"], ["Who is at the mat at the end?", "Pat", "Pam", "Sam"]],
      },
    ],
  },
  {
    n: 2, title: "Short i", kid: "Now short i, and the sounds for n, f and d!", skill: "Short i with n, f, d; adding -s", grade: "K", color: "#eab308", icon: "🐞",
    graphemes: ["i", "n", "f", "d"],
    words: "i|n i|t i|f s|i|t p|i|t t|i|p s|i|p n|i|p p|i|n:📌 t|i|n f|i|n f|i|t d|i|p d|i|d d|i|m m|i|d n|a|p:😴 p|a|n:🍳 m|a|n:👨 t|a|n f|a|n a|n a|n|d m|a|d:😠 s|a|d:😢 d|a|d p|a|d D|a|n N|a|n T|i|m S|i|d P|i|p N|a|t",
    hearts: "t|o!1 g|o!1 n|o!1",
    lessons: [
      {
        id: "u2l1", title: "Tim and Nan", pic: "🍳", focus: ["i", "n"], heart: ["to"],
        chain: "p|i|n t|i|n t|i|p", spell: "p|i|n s|i|t n|a|p", sort: ["a", "i", "nap pan tan", "pin sit tip"],
        text: "Tim and Nan sit. It is a tin pan. Nan tips the pan to Tim. Tip, tip! Tim sips. Sip, sip, sip! Nan sips. Tim and Nan nap. Nap, Tim! Nap, Nan!",
        q: [["Who tips the pan?", "Nan", "Tim", "Dad"], ["What does Tim do with the pan?", "sips", "naps in it", "taps a map"], ["What do Tim and Nan do at the end?", "nap", "sip", "tip"]],
      },
      {
        id: "u2l2", title: "Dad Fans Sid", pic: "😴", focus: ["f", "d"], heart: ["go"],
        chain: "d|i|p d|i|d d|a|d", spell: "f|a|n d|i|p f|i|n", sort: ["f", "d", "fan fin fit", "dad dip did"],
        text: "Dad and Sid sit. Sid is sad. Dad fans Sid. Fan, fan, fan! Sid naps. Tim sits in. Tim is sad. \"Go, Dad! Fan Tim!\" Dad fans Tim. Tim naps. Dad naps. Dad, Sid and Tim nap.",
        q: [["Who is sad first?", "Sid", "Tim", "Dad"], ["What does Dad do to help?", "fans them", "dips a fin", "taps a map"], ["What do they all do at the end?", "nap", "sit", "sip"]],
      },
      {
        id: "u2l3", title: "No, Pip!", pic: "🐶", focus: ["i", "d"], heart: ["no"],
        chain: "s|i|p d|i|p d|i|m", spell: "d|i|d m|a|d a|n|d", sort: ["a", "i", "mad and dad", "did dim mid"],
        text: "Pip dips in a pan. Dip, dip, dip! \"No, Pip!\" Pam is mad. Pip sits in the pan. Pip naps in the pan! \"No, Pip, no!\" Dad is in. Dad tips the pan. Pip is sad. Pam pats Pip. Pip naps at the mat.",
        q: [["Where does Pip nap first?", "in the pan", "at the map", "in a pit"], ["Why is Pam mad?", "Pip is in the pan", "Dad is sad", "Tim is mad"], ["Where does Pip nap at the end?", "at the mat", "in the pan", "at the map"]],
      },
    ],
  },
  {
    n: 3, title: "Short o", kid: "Short o is next, with c, g and h!", skill: "Short o with c, g, h", grade: "K", color: "#22c55e", icon: "🐙",
    graphemes: ["o", "c", "g", "h"],
    words: "o|n n|o|t h|o|t:🔥 p|o|t d|o|t g|o|t t|o|p h|o|p m|o|p p|o|p c|o|t d|o|g:🐶 f|o|g:🌫️ h|o|g c|a|t:🐱 c|a|p:🧢 c|a|n:🥫 g|a|p g|a|s:⛽ h|a|d h|a|m h|a|t:🎩 h|i|m h|i|d h|i|t h|i|p d|i|g:⛏️ f|i|g p|i|g:🐷 t|a|g:🏷️ n|o|d c|o|p m|o|m c|o|g p|o|d T|o|m D|o|t H|a|p",
    hearts: "w|a|s!1,2 h|a|s!2 h|i|s!2 y|ou!1 s|ai|d!1",
    lessons: [
      {
        id: "u3l1", title: "A Hot Pot", pic: "🍲", focus: ["o", "h"], heart: ["was", "has", "his"],
        chain: "h|o|t p|o|t d|o|t", spell: "h|o|t p|o|t t|o|p", sort: ["o", "i", "hot pot top", "hit tip pit"],
        text: "Mom has a pot. The pot is hot! Tom sits at a mat. The pot tips! Hot, hot, hot! Tom got a mop. Mop, mop, mop! It was a hot pot. Mom and Tom mop it. Mom pats Tom.",
        q: [["What does Mom have?", "a hot pot", "a hat", "a dog"], ["What happens to the pot?", "it tips", "it pops", "it naps"], ["How does Tom help?", "Tom mops", "Tom naps", "Tom digs"]],
      },
      {
        id: "u3l2", title: "Hap Can Dig", pic: "🐶", focus: ["c", "g"], heart: ["you"],
        chain: "c|a|t c|o|t d|o|t", spell: "d|o|g c|a|t p|i|g", sort: ["c", "g", "cat cap cot", "got gas gap"],
        text: "Dot has a dog. The dog is Hap. Hap can dig. Dig, dig, dig! Hap got a cap. Dot pats Hap. \"Hap, you can dig!\" Hap digs and digs. Hap got a hat! Dot has a cap and a hat. Hap naps on the hat.",
        q: [["Who is the dog?", "Hap", "Dot", "Tom"], ["What does Hap dig up first?", "a cap", "a hat", "a pot"], ["Where does Hap nap?", "on the hat", "on the cap", "in a pit"]],
      },
      {
        id: "u3l3", title: "Hop to the Top", pic: "🐷", focus: ["o"], heart: ["said"],
        chain: "h|o|p m|o|p t|o|p", spell: "h|o|p c|a|n f|o|g", sort: ["o", "a", "hop mop pop", "hat ham had"],
        text: "Tom and Dot hop. Hop, hop, hop! \"I can hop to the top!\" said Tom. Tom hops to the top. Dot hops to the top. Dot did not tip! \"I did it!\" said Dot. A pig hops in! Hop, hop! \"It can hop to the top!\" said Mom. Tom, Dot and the pig sit on top.",
        q: [["Who hops to the top first?", "Tom", "Dot", "the pig"], ["What did Dot not do?", "tip", "hop", "sit"], ["Who hops in at the end?", "a pig", "a cat", "a dog"]],
      },
    ],
  },
  {
    n: 4, title: "Short e", kid: "Short e, plus b, r and l!", skill: "Short e with b, r, l (b and d can be tricky)", grade: "K–1", color: "#06b6d4", icon: "🥚",
    graphemes: ["e", "b", "r", "l"],
    words: "b|e|d:🛏️ b|e|g b|e|t t|e|n:🔟 h|e|n:🐔 m|e|n p|e|n:🖊️ n|e|t:🥅 p|e|t s|e|t g|e|t l|e|t m|e|t r|e|d:🟥 l|e|d l|e|g:🦵 p|e|g f|e|d d|e|n l|a|b l|a|p l|i|d l|i|p:👄 l|i|t l|o|t l|o|g:🪵 r|i|b r|i|d r|i|p r|i|m r|o|b r|o|d r|o|t r|a|t:🐀 r|a|g r|a|n r|a|m:🐏 b|a|g:👜 b|a|t:🦇 b|a|d b|i|n b|i|g b|i|t b|i|b b|o|g c|a|b:🚕 p|a|l T|e|d B|e|n M|e|g R|o|b B|o|b",
    hearts: "h|e!1 w|e!1 m|e!1 a|r|e!0,2",
    lessons: [
      {
        id: "u4l1", title: "Ten Red Hens", pic: "🐔", focus: ["e", "r"], heart: ["he"],
        chain: "h|e|n t|e|n p|e|n", spell: "h|e|n r|e|d t|e|n", sort: ["e", "i", "hen ten pen", "pin tin bin"],
        text: "Ben has ten red hens. The hens sit in a pen. Ben fed the hens. He fed ten hens! A rat ran in the pen. The hens ran and ran! Ben got the rat. He let it go. The ten red hens sat in the pen.",
        q: [["What does Ben have?", "ten red hens", "ten red bats", "a big rat"], ["What ran in the pen?", "a rat", "a dog", "a pig"], ["What did Ben do with the rat?", "let it go", "fed it", "got in the pen"]],
      },
      {
        id: "u4l2", title: "A Big Bed", pic: "🛏️", focus: ["b", "l"], heart: ["we", "me"],
        chain: "b|e|d b|e|g l|e|g", spell: "b|e|d l|e|g b|a|g", sort: ["b", "d", "bed bat big", "dad dig dot"],
        text: "Meg has a big bed. \"Let me nap!\" said Meg. Meg got in the bed. The dog got in the bed. The cat got in the bed. Ted got in the bed! \"We can not fit!\" said Meg. The bed tips! Meg, Ted, the dog and the cat sit on the mat. \"We can nap on the mat,\" said Ted.",
        q: [["Who gets in the bed last?", "Ted", "the dog", "the cat"], ["What happens to the bed?", "it tips", "it is hot", "it is red"], ["Where do they nap at the end?", "on the mat", "in the bed", "in the pen"]],
      },
      {
        id: "u4l3", title: "Rob the Rat", pic: "🐀", focus: ["e", "l", "r"], heart: ["are"],
        chain: "l|o|g l|o|t r|o|t", spell: "l|o|g r|a|t b|i|g", sort: ["e", "o", "red bed leg", "rod log lot"],
        text: "Rob is a red rat. Rob ran to a log. Rob hid in the log. A big cat sat on the log! \"Are you in the log, rat?\" said the cat. Rob did not let the cat in. The cat had a nap on the log. Rob ran to his bed. He had a nap in his bed.",
        q: [["Where did Rob hide?", "in the log", "in a bag", "in a pot"], ["Who sat on the log?", "a big cat", "a big dog", "a red hen"], ["Where did Rob nap?", "in his bed", "on the log", "in the pen"]],
      },
    ],
  },
  {
    n: 5, title: "Short u", kid: "Short u, with j, k and w!", skill: "Short u with j, k, w", grade: "K–1", color: "#3b82f6", icon: "☂️",
    graphemes: ["u", "j", "k", "w"],
    words: "u|p:⬆️ u|s s|u|n:☀️ r|u|n f|u|n b|u|n b|u|g:🐛 h|u|g:🤗 m|u|g r|u|g t|u|g d|u|g j|u|g c|u|p:☕ p|u|p c|u|t h|u|t n|u|t:🥜 b|u|t t|u|b:🛁 r|u|b c|u|b s|u|b m|u|d g|u|m h|u|m b|u|d b|u|s:🚌 j|a|m j|e|t:✈️ j|o|g j|o|b k|i|d:🧒 k|i|t w|e|t w|e|b:🕸️ w|i|n w|i|g w|a|g J|i|m J|e|n K|e|n K|i|m G|u|s",
    hearts: "sh|e!0,1 b|e!1 m|y!1 o|f!0,1",
    lessons: [
      {
        id: "u5l1", title: "Gus the Bug", pic: "🐛", focus: ["u"], heart: ["she"],
        chain: "b|u|g h|u|g h|u|t", spell: "b|u|g s|u|n c|u|p", sort: ["u", "o", "bug hut sun", "dog hot pot"],
        text: "Gus is a bug. Gus is in a cup. \"Up, up, up!\" said Gus. Gus got up on the rim. Gus sat in the sun. Jen ran up. \"Gus, you are a fun bug!\" she said. She let Gus sit on a bun. Gus and Jen had fun in the sun.",
        q: [["Where is Gus at the start?", "in a cup", "on a bun", "in a tub"], ["Where does Gus sit after he gets up?", "in the sun", "in the mud", "in the tub"], ["What does Jen let Gus sit on?", "a bun", "a rug", "a mug"]],
      },
      {
        id: "u5l2", title: "A Jet in a Web", pic: "✈️", focus: ["j", "k", "w"], heart: ["be", "my"],
        chain: "j|e|t w|e|t w|e|b", spell: "j|e|t w|e|b k|i|d", sort: ["j", "w", "jet jam jug", "web wet wig"],
        text: "Kim has a red jet. It is not a big jet. Kim runs, and the jet is up, up, up! The jet hits a web. The web is wet! Kim gets the jet. \"My jet can not be in a web!\" said Kim. Kim and the jet run in the sun.",
        q: [["What does Kim have?", "a red jet", "a big web", "a wet rug"], ["What does the jet hit?", "a web", "a hut", "a bus"], ["Is the jet big?", "no, it is not big", "yes, it is big", "it is a bus"]],
      },
      {
        id: "u5l3", title: "Pip in the Tub", pic: "🛁", focus: ["u"], heart: ["of"],
        chain: "t|u|b r|u|b r|u|g", spell: "t|u|b p|u|p m|u|d", sort: ["u", "a", "tub rub mud", "tan bad mad"],
        text: "Pip is a pup. Pip ran in the mud. Pip has a lot of mud on him! \"Pip! Get in the tub!\" said Mom. Pip got in the tub. Mom had a rag. Rub, rub, rub! Pip is wet. Pip runs to the rug. Pip rubs on the rug! \"Pip! Not the rug!\"",
        q: [["Why does Pip need the tub?", "Pip ran in mud", "Pip is sad", "Pip is hot"], ["What does Mom rub with?", "a rag", "a mop", "a mug"], ["Where does Pip run at the end?", "to the rug", "to the mud", "to the bed"]],
      },
    ],
  },
  {
    n: 6, title: "x, y, z, v, qu", kid: "Let's meet v, x, y, z and qu!", skill: "v, x, y, z and qu", grade: "K–1", color: "#8b5cf6", icon: "🦓",
    graphemes: ["v", "x", "y", "z", "qu"],
    words: "v|a|n:🚐 v|e|t b|o|x:📦 f|o|x:🦊 o|x:🐂 f|i|x m|i|x s|i|x:6️⃣ w|a|x t|a|x y|e|s y|e|t y|u|m y|a|k y|a|p z|i|p z|a|p z|i|g z|a|g z|i|g|z|a|g qu|i|t qu|i|z M|a|x R|e|x L|i|z Z|e|d",
    hearts: "d|o!1 th|ey!1 h|a|v|e!3",
    lessons: [
      {
        id: "u6l1", title: "Max the Fox", pic: "🦊", focus: ["x", "v"], heart: ["do"],
        chain: "f|o|x b|o|x b|o|g", spell: "f|o|x b|o|x s|i|x", sort: ["ends with x", "ends with t", "fox box six", "fit hot get"],
        text: "Max is a fox. Max has a big box. In the box are six red figs. \"Yum, yum!\" said Max. A van gets to the den. A vet is in the van. \"Max, do you fix vans? Can you fix my van?\" said the vet. \"Yes!\" said Max. Max did fix the van. Max and the vet get the figs. Yum!",
        q: [["What is in the box?", "six red figs", "six red hats", "a van"], ["Who is in the van?", "a vet", "a fox", "a pig"], ["What does Max do for the vet?", "fix the van", "get in the box", "nap"]],
      },
      {
        id: "u6l2", title: "Zed the Yak", pic: "🐂", focus: ["y", "z", "qu"], heart: ["they"],
        chain: "z|i|p z|a|p y|a|p", spell: "z|i|p y|e|s qu|i|z", sort: ["y", "z", "yes yet yak", "zip zap zigzag"],
        text: "Liz has a pet yak. The yak is Zed. Zed can zigzag. Zig, zag! Zig, zag! \"Zed, quit it!\" said Liz. Zed did not quit. Zed ran in the mud! Liz and Mom got Zed in the tub. They rub and rub. \"Yes!\" said Liz. \"Zed is not a mud yak!\"",
        q: [["What pet does Liz have?", "a yak", "a fox", "a pup"], ["What can Zed do?", "zigzag", "fix a van", "quiz"], ["Where does Zed go after the mud?", "in the tub", "in a van", "in a box"]],
      },
      {
        id: "u6l3", title: "Yum, Yum!", pic: "🍯", focus: ["x", "y"], heart: ["have"],
        chain: "s|i|x m|i|x f|i|x", spell: "v|a|n y|u|m m|i|x", sort: ["has x", "has z", "box mix six", "quiz Liz zip"],
        text: "Mom and Max have a big pot. They mix and mix. \"Can we have it yet?\" said Max. \"Not yet,\" said Mom. They mix and mix. \"Can we have it yet?\" \"Yes!\" said Mom. It is a hot jam bun! Yum, yum, yum!",
        q: [["What do Mom and Max do?", "mix", "fix a van", "nap"], ["What does Max ask?", "Can we have it yet?", "Is it a yak?", "Can I go?"], ["What do they make?", "a hot jam bun", "a big box", "a red hat"]],
      },
    ],
  },
  {
    n: 7, title: "Double letters and ck", kid: "Some sounds use two letters: ff, ll, ss, zz and ck!", skill: "FLOSS (ff, ll, ss, zz) and ck", grade: "1", color: "#ec4899", icon: "🦆",
    graphemes: ["ff", "ll", "ss", "zz", "ck"],
    words: "o|ff p|u|ff c|u|ff h|u|ff b|e|ll:🔔 f|e|ll t|e|ll w|e|ll y|e|ll s|e|ll h|i|ll f|i|ll w|i|ll b|i|ll t|i|ll d|o|ll:🪆 g|u|ll d|u|ll h|i|ss k|i|ss:💋 m|i|ss m|e|ss l|e|ss b|o|ss t|o|ss m|o|ss f|u|ss p|a|ss b|u|zz:🐝 f|i|zz f|u|zz j|a|zz:🎷 b|a|ck p|a|ck:🎒 s|a|ck r|a|ck d|e|ck n|e|ck p|e|ck k|i|ck l|i|ck p|i|ck s|i|ck r|o|ck:🪨 s|o|ck:🧦 l|o|ck:🔒 d|o|ck d|u|ck:🦆 l|u|ck t|u|ck y|u|ck qu|a|ck qu|i|ck J|a|ck N|i|ck J|e|ss T|e|ss",
    hearts: "wh|a|t!1 p|u|t!1 c|o|m|e!1,3 s|o|m|e!1,3",
    lessons: [
      {
        id: "u7l1", title: "The Duck and the Bell", pic: "🦆", focus: ["ck", "ll"], heart: ["what"],
        chain: "d|u|ck l|u|ck l|o|ck", spell: "d|u|ck b|e|ll s|o|ck", sort: ["ck", "ll", "duck sock back", "bell hill doll"],
        text: "Jack has a pet duck. The duck has a bell on its neck. Quack, quack! The duck runs up a hill. \"What is the duck up to?\" said Jack. Jack can tell. The bell is on the hill! Jack runs up the hill. The duck is in the moss. Jack picks up the duck. \"Back to the pen, duck!\"",
        q: [["What is on the duck's neck?", "a bell", "a sock", "a lock"], ["Where did the duck run?", "up a hill", "to a dock", "in a sack"], ["What helps Jack find the duck?", "the bell", "a sock", "a rock"]],
      },
      {
        id: "u7l2", title: "Jess and the Bug", pic: "🎷", focus: ["ss", "zz", "ff"], heart: ["put"],
        chain: "b|u|zz f|u|zz f|u|ss", spell: "b|u|zz k|i|ss o|ff", sort: ["ss", "zz", "kiss mess hiss", "buzz fizz jazz"],
        text: "Jess hums jazz on the deck. Buzz! Buzz! A big bug sits on the bell. Jess puts a cup on the bug. \"Off you go, bug!\" said Jess. She lets the bug off on the hill. Buzz, buzz! The bug is off. Jess will not fuss. She hums and hums.",
        q: [["What does Jess hum?", "jazz", "a bell", "a duck"], ["Where does the bug sit?", "on the bell", "on Jess", "in a sock"], ["What does Jess do with the bug?", "lets it off on the hill", "puts it in a sack", "kicks it"]],
      },
      {
        id: "u7l3", title: "Kick the Can", pic: "🥫", focus: ["ck", "ss"], heart: ["come", "some"],
        chain: "p|i|ck p|a|ck b|a|ck", spell: "p|a|ck k|i|ck d|o|ll", sort: ["ck", "ss", "pack kick neck", "miss toss boss"],
        text: "Nick has a tin can. \"Come and kick the can, Bill!\" said Nick. Bill kicks the can. It hits the dock. Some ducks on the dock quack and quack! \"The ducks are mad!\" said Bill. Nick and Bill get the can back. They pack it in a sack and sit on the hill.",
        q: [["What do Nick and Bill kick?", "a tin can", "a rock", "a sock"], ["What does the can hit?", "the dock", "a duck", "a bell"], ["Who quacks?", "some ducks", "Nick", "a dog"]],
      },
    ],
  },
  {
    n: 8, title: "sh, ch, th, wh", kid: "Two letters, one sound: sh, ch, th and wh!", skill: "Digraphs sh, ch, th, wh", grade: "1", color: "#14b8a6", icon: "🚢",
    graphemes: ["sh", "ch", "th", "wh"],
    words: "sh|i|p:🚢 sh|o|p sh|e|d sh|u|t f|i|sh:🐟 d|i|sh:🍽️ w|i|sh r|u|sh c|a|sh:💵 m|a|sh h|u|sh sh|e|ll:🐚 ch|i|p ch|i|n ch|o|p ch|a|t ch|i|ck:🐥 ch|e|ss:♟️ ch|e|ck:✅ r|i|ch m|u|ch s|u|ch b|a|th m|a|th p|a|th m|o|th th|i|n th|i|ck w|i|th th|i|s th|a|t th|e|m th|e|n th|a|n wh|e|n wh|i|p wh|i|ch B|e|th S|e|th J|o|sh Ch|e|n",
    hearts: "o|n|e!0,1,2 t|w|o!1,2 w|a|n|t!1 wh|ere!1",
    lessons: [
      {
        id: "u8l1", title: "A Fish Wish", pic: "🐟", focus: ["sh"], heart: ["one"],
        chain: "f|i|sh d|i|sh w|i|sh", spell: "sh|i|p f|i|sh d|i|sh", sort: ["sh", "s", "ship shop shed", "sip sock sun"],
        text: "Josh has a red fish. The fish is in a dish. Josh has one wish. \"I wish my fish had a pal!\" Josh runs to the shop. The shop has lots of fish. Josh gets one fish. Josh runs back and puts it in the dish. The red fish has a pal! \"Hush,\" said Josh. \"The fish nap.\"",
        q: [["Where is the fish?", "in a dish", "in a ship", "in a shed"], ["What is Josh's wish?", "a pal for his fish", "a ship", "a dish"], ["Where does Josh get a fish?", "at the shop", "in the shed", "on a ship"]],
      },
      {
        id: "u8l2", title: "Chen and the Chicks", pic: "🐥", focus: ["ch", "th"], heart: ["two"],
        chain: "ch|i|p ch|i|n th|i|n", spell: "ch|i|ck ch|i|n b|a|th", sort: ["ch", "th", "chick chip chop", "thin bath path"],
        text: "Chen has two chicks. One chick is thin. One chick is big. The thin chick hops on the path. \"Chick, chick! Come back!\" Chen runs on the path. The chick hops in the mud! Chen picks up the chick. \"You will have a bath,\" said Chen. The thin chick sits in the bath with the big chick. Chen pats them. \"Such fun chicks!\"",
        q: [["How many chicks does Chen have?", "two", "one", "six"], ["Where does the thin chick hop?", "in the mud", "on a ship", "on the deck"], ["What does Chen give the chick?", "a bath", "a chip", "a dish"]],
      },
      {
        id: "u8l3", title: "When Is Dad Back?", pic: "🐚", focus: ["wh", "sh"], heart: ["want", "where"],
        chain: "sh|i|p wh|i|p ch|i|p", spell: "wh|e|n sh|e|ll m|a|th", sort: ["wh", "th", "when whip which", "this that then"],
        text: "Beth and Seth sit on the dock. \"Where is Dad?\" said Beth. \"Dad is on a ship,\" said Seth. \"I want Dad back,\" said Beth. \"When will the ship come?\" Seth picks up a shell. \"Which shell is big?\" They pick shells and chat. Then, a ship! Dad is on the deck. Beth and Seth run to him. \"Dad is back!\"",
        q: [["Where is Dad at the start?", "on a ship", "in the shop", "in the shed"], ["What do Beth and Seth do while they wait?", "pick shells and chat", "fish", "nap"], ["Who is on the deck?", "Dad", "Mom", "a duck"]],
      },
    ],
  },
  {
    n: 9, title: "Blends at the start", kid: "Blends: two sounds side by side, like s-t in stop!", skill: "Beginning blends (s-, r- and l-blends)", grade: "1", color: "#f43f5e", icon: "🐸",
    graphemes: ["st", "sp", "sn", "sl", "sm", "sk", "sw", "tr", "dr", "gr", "br", "cr", "fr", "pr", "bl", "cl", "fl", "gl", "pl"],
    words: "s|t|o|p:🛑 s|t|e|p s|t|i|ll s|t|a|ck s|t|i|ck s|t|u|ck s|p|i|n s|p|o|t s|p|e|ll s|p|i|ll s|n|a|p s|n|a|ck s|n|i|ff s|n|i|p s|l|i|p s|l|a|m s|l|e|d:🛷 s|l|i|d s|m|e|ll s|m|a|sh s|k|i|p s|k|i|n s|w|i|m:🏊 s|w|a|m t|r|i|p t|r|a|p t|r|a|ck t|r|i|m t|r|u|ck:🚚 d|r|u|m:🥁 d|r|o|p:💧 d|r|i|p d|r|e|ss:👗 g|r|i|n:😁 g|r|a|b g|r|a|ss g|r|i|ll b|r|i|ck:🧱 c|r|a|b:🦀 c|r|i|b c|r|a|ck f|r|o|g:🐸 f|r|e|sh p|r|e|ss b|l|a|ck:⬛ b|l|o|ck c|l|a|p:👏 c|l|i|p:📎 c|l|i|ff c|l|a|ss f|l|a|g:🚩 f|l|a|t f|l|i|p f|l|a|sh g|l|a|d p|l|u|g:🔌 p|l|a|n p|l|u|m p|l|u|s:➕ p|l|o|p F|r|a|n B|r|a|d S|t|a|n F|r|e|d",
    hearts: "f|r|o|m!2 y|our!1 th|ere!1 h|ere!1",
    lessons: [
      {
        id: "u9l1", title: "The Frog and the Crab", pic: "🐸", focus: ["fr", "cr", "tr", "gr"], heart: ["from"],
        chain: "t|r|a|p t|r|i|p d|r|i|p", spell: "f|r|o|g c|r|a|b d|r|u|m", sort: ["r blend", "l blend", "frog crab drum", "flag clap black"],
        text: "Fran has a pet frog. The frog can hop, and it can grin. Fran and the frog go on a trip in a red truck. The truck stops at a big rock. The frog hops off. Hop! Hop! It hops on a crab! Snap, snap! The crab is mad. The frog hops from the crab back to Fran in a flash. \"Frog, that was a crab, not a rock!\" said Fran. The frog grins.",
        q: [["What pet does Fran have?", "a frog", "a crab", "a fish"], ["What does the frog hop on?", "a crab", "a truck", "a flag"], ["What does the crab do?", "snaps", "grins", "hops"]],
      },
      {
        id: "u9l2", title: "Stan and the Sled", pic: "🛷", focus: ["sl", "st", "sw", "sn"], heart: ["your"],
        chain: "s|l|e|d s|l|i|d s|l|i|p", spell: "s|l|e|d s|t|o|p s|w|i|m", sort: ["s blend", "r blend", "sled stop snap", "trip drum grin"],
        text: "Stan has a black sled. Stan and Brad go up a hill. \"Get on your sled, Stan!\" said Brad. Stan sits on the sled. The sled slips, and it is quick! \"Stop! Stop!\" Stan slips off the sled. Plop! Stan sits up and grins. \"Brad, get on your sled! It is fun!\"",
        q: [["What color is the sled?", "black", "red", "tan"], ["What happens to Stan?", "he slips off", "he naps", "he swims"], ["How does Stan feel at the end?", "glad", "mad", "sad"]],
      },
      {
        id: "u9l3", title: "The Flag Run", pic: "🚩", focus: ["fl", "cl", "bl", "pl", "gl"], heart: ["there", "here"],
        chain: "f|l|a|g f|l|a|t f|l|i|p", spell: "f|l|a|g c|l|a|p p|l|u|g", sort: ["l blend", "s blend", "flag clap plum", "spot swim sled"],
        text: "Fred and his class plan a flag run. \"Here is the flag!\" said Fred. Fred runs with the flag to the black block. \"There it is, Fran!\" Fran grabs the flag and runs to the big rock. Clap! Clap! The class claps and claps. \"We did it!\" said Fran. Fred and Fran are glad.",
        q: [["What does the class plan?", "a flag run", "a trip", "a nap"], ["Who gets the flag from Fred?", "Fran", "Stan", "Brad"], ["What does the class do at the end?", "claps", "naps", "swims"]],
      },
    ],
  },
];
