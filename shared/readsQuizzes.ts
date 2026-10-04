// Library quizzes for the Read on Arise books that weren't in the library yet
// (keyed books in shared/readsCatalog.ts). server/readsSync.ts makes each one a
// normal library book with these 10 questions the first time it's needed.

export type ReadsQuiz = {
  key: string;
  title: string;
  author: string;
  ageGroup: string;
  points: number;
  description: string;
  /** An existing library row to reuse if it has no questions yet. */
  matchTitles?: string[];
  questions: { question: string; options: [string, string, string, string]; correct: string }[];
};

export const READS_QUIZZES: ReadsQuiz[] = [
  {
    key: "sleepy-hollow", title: "The Legend of Sleepy Hollow", author: "Washington Irving", ageGroup: "Ages 9-12", points: 2,
    description: "A nervous schoolteacher, a quiet valley full of ghost stories, and a midnight ride he'll never forget.",
    questions: [
      { question: "What is Ichabod Crane's job in Sleepy Hollow?", options: ["Farmer", "Schoolteacher", "Blacksmith", "Doctor"], correct: "B" },
      { question: "Which famous ghost story do the people of Sleepy Hollow tell most?", options: ["The Headless Horseman", "The Woman in White", "The Phantom Ship", "The Ghost of the Mill"], correct: "A" },
      { question: "Who is the young woman Ichabod hopes to marry?", options: ["Anne Van Ripper", "Katrina Van Tassel", "Hannah Hudson", "Mary Knickerbocker"], correct: "B" },
      { question: "Besides Katrina herself, what makes Ichabod want to marry her so badly?", options: ["Her singing", "Her father's rich farm and plentiful food", "Her horse", "Her books"], correct: "B" },
      { question: "Who is Ichabod's rival, a bold and boisterous young man?", options: ["Hans Van Ripper", "Baltus Van Tassel", "Brom Bones", "Diedrich Knickerbocker"], correct: "C" },
      { question: "What kind of party does Ichabod go to at the Van Tassel farm?", options: ["A harvest party (a quilting frolic)", "A wedding", "A birthday party", "A town fair"], correct: "A" },
      { question: "What is the name of the old horse Ichabod borrows?", options: ["Thunder", "Daredevil", "Gunpowder", "Midnight"], correct: "C" },
      { question: "The Headless Horseman is said to be unable to follow past which place?", options: ["The church bridge", "The old mill", "The schoolhouse door", "The edge of the woods"], correct: "A" },
      { question: "What is found the next morning near the bridge?", options: ["Ichabod's horse and saddle", "Ichabod's hat and a shattered pumpkin", "A sword", "A letter from Katrina"], correct: "B" },
      { question: "At the end, what do many readers suspect really happened?", options: ["Ichabod became the Horseman", "Brom Bones played a trick to scare Ichabod away", "Katrina chased him off", "The schoolhouse burned down"], correct: "B" },
    ],
  },
  {
    key: "canterville-ghost", title: "The Canterville Ghost", author: "Oscar Wilde", ageGroup: "Ages 10-14", points: 2,
    description: "A very old ghost tries everything to scare off the American family who moved into his castle. They are not scared.",
    questions: [
      { question: "Where does the Otis family move at the start of the story?", options: ["A farm in Ohio", "Canterville Chase, an old English house", "A lighthouse", "A castle in Scotland"], correct: "B" },
      { question: "What does the family use to remove the bloodstain that keeps coming back?", options: ["Soap and water", "Pinkerton's Champion Stain Remover", "Paint", "Sand"], correct: "B" },
      { question: "How does Mr. Otis react when he first hears the ghost's rattling chains?", options: ["He screams and runs", "He offers the ghost oil for the chains", "He calls the police", "He hides under the bed"], correct: "B" },
      { question: "Who keep playing pranks on the ghost?", options: ["The twins", "The butler", "Mrs. Umney", "Lord Canterville"], correct: "A" },
      { question: "What is the ghost's name?", options: ["Sir Simon de Canterville", "Lord Edward Otis", "Sir Richard Grey", "Captain Duke"], correct: "A" },
      { question: "Why is the ghost's 'bloodstain' sometimes strange colours, like bright green?", options: ["It is magic", "He uses Virginia's paints to touch it up", "The twins change it", "The rain washes it"], correct: "B" },
      { question: "Which member of the Otis family is kind to the ghost?", options: ["Washington", "Mrs. Otis", "Virginia", "The twins"], correct: "C" },
      { question: "What does the ghost most want?", options: ["To scare everyone forever", "To be allowed to rest and sleep in peace", "To own the house again", "To travel to America"], correct: "B" },
      { question: "According to the old prophecy, what will happen when the almond tree blossoms?", options: ["The house will fall", "The ghost will find peace", "Treasure will appear", "The twins will grow up"], correct: "B" },
      { question: "What does the ghost leave Virginia as thanks?", options: ["A box of beautiful jewels", "A painting", "A key to the castle", "A letter"], correct: "A" },
    ],
  },
  {
    key: "velveteen-rabbit", title: "The Velveteen Rabbit", author: "Margery Williams", ageGroup: "Ages 5-9", points: 1,
    description: "A toy rabbit learns what it means to become Real.",
    matchTitles: ["The Classic Tale of the Velveteen Rabbit"],
    questions: [
      { question: "When does the Boy first get the Velveteen Rabbit?", options: ["On his birthday", "In his Christmas stocking", "At a toy shop", "From a friend at school"], correct: "B" },
      { question: "Which old, wise toy explains what 'Real' means?", options: ["The model boat", "The Skin Horse", "The tin soldier", "The wooden lion"], correct: "B" },
      { question: "According to the Skin Horse, how does a toy become Real?", options: ["By magic words", "When a child loves it for a long, long time", "By being new and shiny", "By winning a race"], correct: "B" },
      { question: "Who gives the Rabbit to the Boy to sleep with one night?", options: ["His mother", "Nana", "The doctor", "His father"], correct: "B" },
      { question: "Where do the Boy and the Rabbit spend happy summer days?", options: ["At the beach", "In the garden and the woods", "In the city", "On a boat"], correct: "B" },
      { question: "Who does the Rabbit meet in the bracken that can hop and run?", options: ["Real rabbits", "Squirrels", "A fox", "Birds"], correct: "A" },
      { question: "Why do the wild rabbits say he isn't Real?", options: ["He can't talk", "He has no hind legs and can't hop", "He is too small", "He is the wrong color"], correct: "B" },
      { question: "What happens after the Boy gets sick with scarlet fever?", options: ["The Rabbit is given away to a friend", "The doctor orders the Rabbit to be burned with the other germy things", "The Rabbit is washed and put on a shelf", "The Rabbit is sent to a toy hospital"], correct: "B" },
      { question: "Who appears when the Rabbit cries a real tear?", options: ["The Skin Horse", "The nursery magic Fairy", "Nana", "The Boy"], correct: "B" },
      { question: "How does the story end for the Rabbit?", options: ["He goes back to the nursery", "He becomes a Real rabbit and lives in the wood", "He is lost forever", "He becomes a horse"], correct: "B" },
    ],
  },
  {
    key: "hound-baskervilles", title: "The Hound of the Baskervilles", author: "Arthur Conan Doyle", ageGroup: "Ages 11-15", points: 11,
    description: "Sherlock Holmes and Dr. Watson investigate a legend of a ghostly hound on the foggy moors of Devonshire.",
    questions: [
      { question: "Who comes to Sherlock Holmes for help at the start of the story?", options: ["Sir Henry Baskerville", "Dr. James Mortimer", "Inspector Lestrade", "Mr. Stapleton"], correct: "B" },
      { question: "What does the old Baskerville legend say haunts the family?", options: ["A headless knight", "A huge, ghostly hound", "A witch", "A curse on the house's well"], correct: "B" },
      { question: "Who has just inherited Baskerville Hall?", options: ["Sir Henry Baskerville", "Dr. Watson", "Barrymore", "Frankland"], correct: "A" },
      { question: "Who does Holmes send to Devonshire to watch over Sir Henry?", options: ["Lestrade", "Dr. Watson", "Mrs. Hudson", "Dr. Mortimer"], correct: "B" },
      { question: "What is strange about Sir Henry's lost boots in London?", options: ["Both were stolen at once", "First a new boot goes missing, then an old one", "They were found in the river", "They were painted black"], correct: "B" },
      { question: "What dangerous land surrounds Baskerville Hall?", options: ["A desert", "The moor, with the deadly Grimpen Mire", "A jungle", "A frozen lake"], correct: "B" },
      { question: "Why does Barrymore signal with a candle at night?", options: ["To call the hound", "To bring food to his wife's brother, an escaped convict", "To scare Watson", "To meet Stapleton"], correct: "B" },
      { question: "Who is secretly living in a stone hut on the moor?", options: ["The convict Selden", "Sherlock Holmes", "Laura Lyons", "Frankland"], correct: "B" },
      { question: "Who turns out to be behind the 'ghostly' hound?", options: ["Barrymore", "Dr. Mortimer", "Jack Stapleton", "Frankland"], correct: "C" },
      { question: "How was the hound made to look supernatural?", options: ["It was painted with a glowing substance", "It wore a costume", "It was a statue", "It was a shadow on the fog"], correct: "A" },
    ],
  },
];
