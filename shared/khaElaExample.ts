// Kha ELA worksheets: the golden example. It is the worksheet the teacher liked (Pigeons vs. Flamingos: three very
// short poems, a Poet's Toolbox, ten questions in three parts, and a comic), written in the shape the AI must
// send back. It is shown to the AI in the prompt so the first attempt has the same shape and voice, it is the
// sample the teacher can print today, and the tests check it against the same rules as any AI reply.
//
// One thing is fixed from the worksheet it came from: its question 1 said "proud" and "loud" end line 1 and
// line 2. They end line 2 and line 4 of poem 1, and that is what question 1 says here.

export const KHA_EXAMPLE = {
  title: "Pigeons vs. Flamingos",
  subtitle: "A poetry worksheet about being different, and being friends",
  mission: "Read three short bird poems. Find the poet's tools. Figure out the big message. Each question you finish earns a Bird Point. There are 10 questions.",
  poems: [
    {
      title: "The Pink Side of the Pond",
      lines: ["The flamingos stand on one leg,", "pink and proud.", "\"Gray birds don't belong here,\"", "they say out loud.", "The pigeon just pecks at the crumbs on the ground.", "Her feathers are plain, but she makes no sound."],
      scene: {
        setting: "pond",
        birds: [
          { kind: "flamingo", x: 18, size: 1, facing: "right", action: "sway", mood: "proud" },
          { kind: "flamingo", x: 40, size: 0.9, facing: "right", action: "sway", mood: "proud" },
          { kind: "pigeon", x: 76, size: 1, facing: "left", action: "peck", mood: "sad" },
        ],
        props: [{ kind: "sun", x: 86 }, { kind: "cloud", x: 30 }, { kind: "crumbs", x: 66 }],
        bubbles: [{ who: 1, text: "Gray birds don't belong here!" }, { who: 2, text: "I just want some crumbs..." }],
        alt: "Two proud pink flamingos stand by a pond. A small gray pigeon pecks at crumbs and looks sad.",
      },
    },
    {
      title: "The Fence",
      lines: ["Pink on this side. Gray on that side.", "The fence is tall. The fence is wide.", "But the sun does not stop at the wall.", "It shines on pigeons. It shines on all."],
      scene: {
        setting: "divided",
        birds: [
          { kind: "flamingo", x: 16, size: 1, facing: "right", action: "stand", mood: "calm" },
          { kind: "pigeon", x: 82, size: 1, facing: "left", action: "stand", mood: "calm" },
        ],
        props: [{ kind: "fence", x: 50 }, { kind: "sunbeam", x: 50 }],
        bubbles: [],
        alt: "A tall fence splits a pink side with a flamingo from a gray side with a pigeon. Sunlight shines on both.",
      },
    },
    {
      title: "Same Sky",
      lines: ["\"Your legs are long,\" the pigeon said.", "\"Your coo's a song,\" the flamingo said.", "One bird pink. One bird gray.", "Same sky. Same wind. Same day.", "They flew away together."],
      scene: {
        setting: "rainbow",
        birds: [
          { kind: "pigeon", x: 34, size: 1, facing: "right", action: "fly", mood: "happy" },
          { kind: "flamingo", x: 68, size: 0.85, facing: "left", action: "fly", mood: "happy" },
        ],
        props: [{ kind: "rainbow", x: 50 }, { kind: "heart", x: 50 }],
        bubbles: [{ who: 0, text: "Your legs are long!" }, { who: 1, text: "Your coo's a song!" }],
        alt: "A gray pigeon and a pink flamingo fly together under a rainbow and say kind things to each other.",
      },
    },
  ],
  toolbox: [
    { name: "Rhyme", kid: "Words that end with the same sound", example: "cat / hat" },
    { name: "Repetition", kid: "Saying the same word or line again on purpose", example: "\"so, so, so tired\"" },
    { name: "Personification", kid: "Giving a human feeling or action to an animal or thing", example: "\"The wind whispered\"" },
    { name: "Imagery", kid: "Words that help you see, hear or feel something", example: "\"pink and proud\"" },
    { name: "Symbol", kid: "A thing that stands for a bigger idea", example: "A fence can stand for a rule that keeps groups apart" },
    { name: "Contrast", kid: "Showing how two things are different", example: "Pink bird / gray bird" },
    { name: "Theme", kid: "The big message the poem teaches", example: "Be kind to people who look different" },
  ],
  parts: [
    {
      title: "Spot the Poet's Tools",
      questions: [
        { type: "choice", q: "In Poem 1, the last words of line 2 and line 4 are \"proud\" and \"loud.\" What poetry tool is this?", options: ["Rhyme", "Symbol", "Contrast"], answer: 0, poem: 1, tool: "Rhyme", evidence: "pink and proud", why: "Proud and loud end with the same sound, so they rhyme.", standard: "RL.7.4" },
        { type: "choice", q: "In Poem 2, the poet says \"The fence is tall. The fence is wide.\" Which tool is the poet using by saying \"fence\" twice?", options: ["Personification", "Repetition", "Theme"], answer: 1, poem: 2, tool: "Repetition", evidence: "The fence is tall. The fence is wide.", why: "Saying the same word again on purpose is repetition.", standard: "RL.7.4" },
        { type: "choice", q: "In Poem 1, the flamingos \"say out loud\" that gray birds don't belong. Real birds can't talk. What is this called?", options: ["Imagery", "Rhyme", "Personification"], answer: 2, poem: 1, tool: "Personification", evidence: "they say out loud", why: "The poet gives birds a human action, talking. That is personification.", standard: "RL.7.4" },
        { type: "choice", q: "In Poem 2, what does the fence stand for?", options: ["A real fence in a real park", "A rule or idea that keeps groups apart", "A place to hide from the sun"], answer: 1, poem: 2, tool: "Symbol", evidence: "The fence is tall. The fence is wide.", why: "A symbol is a thing that stands for a bigger idea. This fence keeps pink and gray apart.", standard: "RL.7.4" },
      ],
    },
    {
      title: "Read the Clues",
      questions: [
        { type: "write", q: "Poem 1 shows the flamingos as \"pink and proud\" and the pigeon as \"plain.\" Write one way the flamingos treat the pigeon.", starter: "The flamingos treat the pigeon", lines: 2, sample: "The flamingos treat the pigeon like she does not belong. They tell her to go away.", evidence: "Gray birds don't belong here", why: "The flamingos say gray birds do not belong, so they leave her out.", poem: 1, tool: "Imagery", standard: "RL.7.1" },
        { type: "write", q: "The pigeon in Poem 1 \"makes no sound.\" Pick the feeling that fits best, then tell why.", starter: "I think this because", lines: 2, pick: ["sad", "left out", "calm", "angry"], sample: "I picked left out. I think this because the flamingos said she does not belong, and she is quiet.", evidence: "makes no sound", why: "Sad or left out fits best because of what the flamingos say. Accept any feeling with a reason from the poem.", poem: 1, tool: "Imagery", standard: "RL.7.3" },
        { type: "choice", q: "In Poem 2, the sun \"shines on pigeons. It shines on all.\" What is the sun showing us?", options: ["The sun likes pink birds best.", "The sun treats every bird the same.", "The sun is hot."], answer: 1, poem: 2, tool: "Symbol", evidence: "It shines on pigeons. It shines on all.", why: "The sun shines on every bird, so it treats them all the same.", standard: "RL.7.1" },
      ],
    },
    {
      title: "Think Bigger",
      questions: [
        { type: "fill", q: "What changes between Poem 1 and Poem 3? In Poem 1, the flamingos ___. In Poem 3, the birds ___.", blanks: [{ options: ["are mean", "are friendly"], answer: 0 }, { options: ["argue", "give each other compliments"], answer: 1 }], evidence: "\"Your legs are long,\" the pigeon said.", why: "In Poem 1 the flamingos are unkind. In Poem 3 the birds say kind things to each other.", poem: 0, tool: "Contrast", standard: "RL.7.3" },
        { type: "choice", q: "Theme check. A theme is the big message. Which sentence is the best theme for all three poems?", options: ["Pigeons are better than flamingos.", "Being different does not mean one group is better, and everyone deserves respect.", "Birds like to eat bread."], answer: 1, poem: 0, tool: "Theme", evidence: "Same sky. Same wind. Same day.", why: "All three poems show birds who look different and deserve the same respect.", standard: "RL.7.2" },
        { type: "connect", q: "Real-life connection. In class, we are reading poems about how Native Americans were treated and about a girl in an American Girl poem. These bird poems share a similar idea: someone is treated badly because of who they are. Finish the sentence, or draw a picture of the pigeon and flamingo showing the message of Poem 3 and write one sentence about it.", starter: "The bird poems and the class poems are alike because", lines: 3, sample: "The bird poems and the class poems are alike because someone is treated unfairly for being different, and the poems say everyone deserves respect.", evidence: "", why: "Accept any answer that links being treated badly for being different to the class poems.", poem: 0, tool: "Theme", standard: "RL.7.9" },
      ],
    },
  ],
  theme: "Being different does not mean one group is better. Everyone deserves respect.",
  comic: {
    title: "Pigeons vs. Flamingos",
    subtitle: "A poetry comic about being different, and being friends",
    panels: [
      { caption: "Poem 1: The flamingos stand on one leg, pink and proud.", sfx: "", scene: { setting: "pond", birds: [{ kind: "flamingo", x: 28, size: 1, facing: "right", action: "sway", mood: "proud" }, { kind: "flamingo", x: 62, size: 0.9, facing: "left", action: "sway", mood: "proud" }], props: [{ kind: "sun", x: 84 }], bubbles: [], alt: "Two proud pink flamingos stand on one leg." } },
      { caption: "\"Gray birds don't belong here,\" they say out loud.", sfx: "MPPHH!", scene: { setting: "pond", birds: [{ kind: "flamingo", x: 24, size: 1, facing: "right", action: "stand", mood: "angry" }, { kind: "pigeon", x: 76, size: 0.9, facing: "left", action: "stand", mood: "sad" }], props: [{ kind: "cloud", x: 50 }], bubbles: [{ who: 0, text: "Gray birds don't belong here!" }], alt: "A flamingo tells a sad pigeon that gray birds don't belong." } },
      { caption: "The pigeon just pecks at the crumbs on the ground.", sfx: "peck peck", scene: { setting: "meadow", birds: [{ kind: "pigeon", x: 50, size: 1.1, facing: "right", action: "peck", mood: "sad" }], props: [{ kind: "crumbs", x: 62 }], bubbles: [{ who: 0, text: "I just want some crumbs..." }], alt: "A small pigeon pecks at crumbs and says she only wants some crumbs." } },
      { caption: "Poem 2: Pink on this side. Gray on that side. The fence is tall.", sfx: "THUNK!", scene: { setting: "divided", birds: [{ kind: "flamingo", x: 16, size: 1, facing: "right", action: "stand", mood: "calm" }, { kind: "pigeon", x: 84, size: 1, facing: "left", action: "stand", mood: "calm" }], props: [{ kind: "fence", x: 50 }], bubbles: [], alt: "A tall fence between a pink side and a gray side." } },
      { caption: "But the sun does not stop at the wall. It shines on pigeons. It shines on all.", sfx: "SHINE!", scene: { setting: "divided", birds: [{ kind: "flamingo", x: 16, size: 1, facing: "right", action: "stand", mood: "happy" }, { kind: "pigeon", x: 84, size: 1, facing: "left", action: "stand", mood: "happy" }], props: [{ kind: "sunbeam", x: 50 }, { kind: "fence", x: 50 }], bubbles: [], alt: "Sunshine falls on both sides of the fence." } },
      { caption: "Poem 3: \"Your legs are long,\" the pigeon said. \"Your coo's a song,\" the flamingo said.", sfx: "", scene: { setting: "sunset", birds: [{ kind: "pigeon", x: 30, size: 1, facing: "right", action: "stand", mood: "happy" }, { kind: "flamingo", x: 70, size: 0.9, facing: "left", action: "stand", mood: "happy" }], props: [{ kind: "heart", x: 50 }], bubbles: [{ who: 0, text: "Your legs are long!" }, { who: 1, text: "Your coo's a song!" }], alt: "A pigeon and a flamingo share kind words." } },
      { caption: "They flew away together.", sfx: "WHOOSH!", scene: { setting: "rainbow", birds: [{ kind: "pigeon", x: 36, size: 1, facing: "right", action: "fly", mood: "happy" }, { kind: "flamingo", x: 66, size: 0.85, facing: "right", action: "fly", mood: "happy" }], props: [{ kind: "rainbow", x: 50 }], bubbles: [], alt: "A pigeon and a flamingo fly away together under a rainbow." } },
    ],
    bigMessage: "Being different does not mean one group is better. Everyone deserves respect.",
  },
  teacherNotes: [
    "Read each poem aloud once, then let the student read it with a finger under each line. The line numbers help when a question says \"line 2.\"",
    "The class poems about how Native Americans were treated are about real people. These bird poems only show the same idea with animals. Talk about the real history in your own words, plainly and respectfully, before question 10.",
    "Questions with a circle have one right answer. Writing questions take any answer that uses a clue from the poem. Give a Bird Point for trying.",
  ],
};
