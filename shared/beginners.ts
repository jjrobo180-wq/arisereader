// A.R.I.S.E. Beginners: age-respectful, culturally engaging foundational reading lessons.
// Teacher-reviewed sample curriculum. These passages are original and not quotes from celebrities.
// The client receives lesson material but NEVER the answer keys; answers are graded by the server.
export type BeginnerCategory = "Sports" | "Music" | "Creators" | "Gaming" | "Style" | "Culture";
export type BeginnerQuestion = { prompt: string; choices: [string, string, string]; correct: number; hint: string };
export type BeginnerSlide = { heading: string; text: string; focus: string[]; instruction: string };
export type BeginnerLesson = {
  id: string; title: string; category: BeginnerCategory; skill: string; level: 1 | 2 | 3;
  points: number; duration: number; hook: string; subject: string; imageFile: string;
  accent: string; slides: BeginnerSlide[]; questions: BeginnerQuestion[];
};
const slide = (heading: string, text: string, focus: string[], instruction: string): BeginnerSlide => ({heading,text,focus,instruction});
const q = (prompt: string, choices: [string,string,string], correct: number, hint: string): BeginnerQuestion => ({prompt, choices, correct, hint});
export const BEGINNER_LESSONS: BeginnerLesson[] = [
  {
    id:"caitlin-court",title:"Caitlin's Big Shot",category:"Sports",skill:"Short-vowel words",level:1,points:25,duration:6,
    hook:"A basketball moment. Five short words. One big win.",subject:"Caitlin Clark",imageFile:"Caitlin Clark three-pointer (cropped).jpg",accent:"#ec4899",
    slides:[
      slide("The court is yours","The fan can clap. The ball can hit the rim. Caitlin can run.",["fan","can","hit","rim","run"],"Listen, then sound out each highlighted word from left to right."),
      slide("Build the word","Say /r/ /i/ /m/. Blend the sounds: rim. Change the first sound to /h/: him.",["rim","him","hit"],"Tap a word to hear it. Blend the sounds before checking.")
    ],
    questions:[
      q("Blend /r/ /i/ /m/. Which word?",["ram","rim","run"],1,"Listen for the short /i/ sound."),
      q("Which word says /f/ /a/ /n/?",["fan","fin","fun"],0,"Blend each sound without guessing."),
      q("Which word rhymes with HIT?",["hat","sit","hot"],1,"Match the ending /it/."),
      q("Which word says /r/ /u/ /n/?",["ran","run","rim"],1,"Listen for short /u/."),
      q("Read: The fan can clap. Who claps?",["the ball","the fan","the rim"],1,"Reread the first sentence.")
    ]
  },
  {
    id:"mrbeast-prize",title:"MrBeast's Big Prize",category:"Creators",skill:"Blend 3 sounds",level:1,points:25,duration:6,
    hook:"Crack the words behind a huge challenge.",subject:"MrBeast",imageFile:"MrBeast 2023.jpg",accent:"#38bdf8",
    slides:[
      slide("The challenge","A fan can win. The fan has a big box. He can get the prize.",["fan","can","win","big","box","get"],"Read the little words first. A grown-up can help with the longer word prize."),
      slide("Change one letter","Read: win, pin, bin. The last two sounds stay the same.",["win","pin","bin"],"Say each sound, blend, then compare the words.")
    ],
    questions:[
      q("Which word says /w/ /i/ /n/?",["win","won","wan"],0,"Short /i/ as in sit."),
      q("Change WIN to PIN. Which letter changes?",["first","middle","last"],0,"Look at the first sound."),
      q("Blend /b/ /o/ /x/. Pick the word.",["box","boy","bag"],0,"Listen for the /ks/ sound at the end."),
      q("Which word rhymes with BIG?",["bag","dig","bug"],1,"Find the /ig/ ending."),
      q("Read: A fan can win. Who can win?",["a fan","a dog","a cat"],0,"Read the sentence again.")
    ]
  },
  {
    id:"olivia-show",title:"Olivia Takes the Stage",category:"Music",skill:"High-frequency words",level:1,points:25,duration:7,
    hook:"Lights up. Music on. Learn words you'll see everywhere.",subject:"Olivia Rodrigo",imageFile:"Olivia Rodrigo at KCA 2022.jpg",accent:"#a78bfa",
    slides:[
      slide("The big show","Olivia is on stage. She has a song. The fans sing with her.",["is","on","has","the","with"],"Point to each word as the passage is read."),
      slide("Words worth knowing","The, is, on, has. Notice their exact spellings. Read them in a new order.",["the","is","on","has"],"Practice identifying these words without using a picture clue.")
    ],
    questions:[
      q("Find the word THE.",["they","the","then"],1,"Look for three letters."),
      q("Which word says IS?",["in","it","is"],2,"Look carefully at the last letter."),
      q("Which word says HAS?",["had","has","hat"],1,"Look at the final /z/ sound."),
      q("Complete: Olivia ___ on stage.",["is","at","an"],0,"Reread the sentence."),
      q("Which word says ON?",["no","on","one"],1,"Two letters, in the right order.")
    ]
  },
  {
    id:"mahomes-drive",title:"Mahomes: Game Day",category:"Sports",skill:"Consonant blends",level:2,points:35,duration:8,
    hook:"Read the play before the defense does.",subject:"Patrick Mahomes",imageFile:"Patrick Mahomes (51615475056).jpg",accent:"#f59e0b",
    slides:[
      slide("The play","The clock ticks. Patrick makes a quick pass. His team runs down the field.",["clock","ticks","quick","pass","runs"],"A blend has two consonant sounds together. Try /k/ /l/ in clock."),
      slide("Start strong","Clap, clip, flag, frog. Hear both starting sounds: /k/ /l/ and /f/ /l/ and /f/ /r/. ",["clap","clip","flag","frog"],"Blend the sounds, then read the whole word.")
    ],
    questions:[
      q("Which word starts with CL?",["clock","block","flock"],0,"Listen for /k/ then /l/."),
      q("Which word starts with FL?",["flag","frog","slug"],0,"Two sounds: /f/ and /l/."),
      q("Find a word that starts with FR.",["flag","frog","glad"],1,"Hear /f/ /r/."),
      q("Which word rhymes with CLAP?",["clip","slap","clock"],1,"The ending is /ap/."),
      q("What does Patrick make in the story?",["a pass","a cake","a map"],0,"Look at the first sentence after the clock.")
    ]
  },
  {
    id:"gamer-final-round",title:"The Final Gaming Round",category:"Gaming",skill:"Read connected sentences",level:2,points:30,duration:8,
    hook:"You don't need to beat the game to beat these words.",subject:"Gaming",imageFile:"",accent:"#818cf8",
    slides:[
      slide("The last level","Max has one life left. He sees the red gate. He jumps and gets the win.",["Max","life","red","gate","jumps","win"],"Read a sentence at a time. Stop at the period."),
      slide("Make sense","Max sees the red gate. The word gate ends with silent e. It changes the vowel sound.",["gate","game","late"],"Compare gate to gat. Say the long /a/ sound.")
    ],
    questions:[
      q("What does Max see?",["a red gate","a big dog","a blue hat"],0,"Reread the second sentence."),
      q("Which word has a long A sound?",["cat","gate","cap"],1,"Look for final silent e."),
      q("Complete: He ___ and gets the win.",["jumps","blue","table"],0,"Which word names an action?"),
      q("Which is a full sentence?",["Max sees the gate.","Max the gate","See red the"],0,"A complete sentence expresses a thought."),
      q("How many lives does Max have left?",["one","two","three"],0,"Read the first sentence.")
    ]
  },
  {
    id:"sneaker-drop",title:"The Sneaker Drop",category:"Style",skill:"SH / CH letter teams",level:2,points:30,duration:7,
    hook:"The shoes just dropped. Can you decode the details?",subject:"Sneaker culture",imageFile:"",accent:"#fb7185",
    slides:[
      slide("The new shoes","Kim is at the shop. She sees fresh shoes. She checks the price.",["shop","shoes","fresh","checks"],"The two letters sh work together to make one sound."),
      slide("Two letter teams","Sh in shop. Ch in check. Read each team as one sound.",["shop","ship","check","chip"],"Do not separate the two letters when you say the beginning sound.")
    ],
    questions:[
      q("Which word begins with SH?",["stop","shop","slip"],1,"Two letters make the /sh/ sound."),
      q("Which word begins with CH?",["chip","ship","trip"],0,"Hear /ch/ at the start."),
      q("Which word rhymes with SHOP?",["ship","chop","shoe"],1,"Listen for /op/."),
      q("What is Kim shopping for?",["shoes","books","games"],0,"Reread the first two sentences."),
      q("Which word has the SH sound at the END?",["fresh","check","chip"],0,"Say each word aloud.")
    ]
  },
  {
    id:"beyonce-beat",title:"Beyoncé's Big Beat",category:"Music",skill:"Reading with expression",level:3,points:40,duration:10,
    hook:"Find the beat and bring the words to life.",subject:"Beyoncé",imageFile:"Beyonce - The Formation World Tour, at Wembley Stadium in London, England.jpg",accent:"#fbbf24",
    slides:[
      slide("The room lights up","The lights shine. The music starts. Beyoncé steps onstage, and the crowd cheers.",["lights","shine","music","starts","crowd"],"Read the sentences aloud. Pause at each period and notice the comma."),
      slide("Give the words meaning","The crowd cheers! The crowd cheers? Say both sentences. How does punctuation change your voice?",["cheers","crowd","shine"],"Practice fluency through expression, not racing.")
    ],
    questions:[
      q("What happens first?",["The music starts.","The crowd leaves.","The show ends."],0,"Look at the beginning of the passage."),
      q("Which mark shows strong excitement?",["?","!",","],1,"An exclamation mark is strong feeling."),
      q("What does the crowd do?",["cheers","sleeps","hides"],0,"Find the final words of the passage."),
      q("Which word rhymes with SHINE?",["fine","shin","shown"],0,"Hear the long /i/ sound."),
      q("Which sentence is a question?",["The crowd cheers.","The crowd cheers!","Does the crowd cheer?"],2,"A question usually ends with ?.")
    ]
  },
  {
    id:"football-focus",title:"Soccer: The Final Goal",category:"Sports",skill:"Read a short story",level:3,points:40,duration:10,
    hook:"The game is tied. One kick can change it.",subject:"Soccer",imageFile:"Adidas soccer ball on a grass pitch (Unsplash).jpg",accent:"#34d399",
    slides:[
      slide("One last chance","The game is tied. The clock has ten seconds left. Ari spots the open net. She kicks the ball. It rolls in!",["game","clock","spots","kicks","rolls"],"Read the whole story. Pause between actions."),
      slide("Put it in order","First the game is tied. Next Ari spots the net. Then she kicks. Finally, the ball rolls in.",["first","next","then","finally"],"Use sequence words to retell what happened.")
    ],
    questions:[
      q("How much time is left?",["ten seconds","ten minutes","one hour"],0,"Look at the second sentence."),
      q("What does Ari spot?",["the net","the bench","the bus"],0,"Reread the sentence before the kick."),
      q("Which word means something happens LAST?",["first","finally","next"],1,"Think about the end."),
      q("What happens just before the ball rolls in?",["Ari kicks.","The game starts.","The crowd goes home."],0,"Retell the actions in order."),
      q("Which title fits the story?",["The Final Goal","A Day at the Zoo","The Lost Shoe"],0,"Choose the main idea.")
    ]
  }
];
export const BEGINNER_PUBLIC_LESSONS = BEGINNER_LESSONS.map(({questions,...lesson}) => ({
  ...lesson,
  questions: questions.map(({correct,hint,...publicQuestion}) => publicQuestion)
}));
export function beginnerLesson(id: string): BeginnerLesson | undefined { return BEGINNER_LESSONS.find((lesson) => lesson.id === id); }
