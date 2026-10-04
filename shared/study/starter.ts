// Starter study sets: ready to play the first time anyone opens Study Squad,
// with no setup and no AI key needed. Every format is used at least once.
import type { StudyItem, StudySet, StudyGrade, StudySubject } from "./sets";

const c = (prompt: string, answer: string, ...wrong: string[]): StudyItem => ({ kind: "choice", prompt, answer, wrong });
const tf = (prompt: string, answer: boolean, explain?: string): StudyItem => ({ kind: "truefalse", prompt, answer: answer ? "True" : "False", ...(explain ? { explain } : {}) });
const t = (prompt: string, answer: string, ...accept: string[]): StudyItem => ({ kind: "typed", prompt, answer, accept });
const card = (prompt: string, answer: string): StudyItem => ({ kind: "card", prompt, answer });

function starter(id: string, title: string, subject: StudySubject, grade: StudyGrade, description: string, items: StudyItem[]): StudySet {
  return { id: `starter-${id}`, title, subject, grade, description, items, ownerId: 0, ownerName: "Study Squad", ownerRole: "starter", madeWith: "hand", shared: true, updatedAt: 0 };
}

export const STARTER_SETS: StudySet[] = [
  starter("figurative-language", "Figurative Language", "Reading", "3-5", "Similes, metaphors and more. Name the kind of figurative language.", [
    c("\"The snow was a white blanket over the town.\"", "Metaphor", "Simile", "Hyperbole", "Alliteration"),
    c("\"She ran like the wind.\"", "Simile", "Metaphor", "Personification", "Onomatopoeia"),
    c("\"The wind whispered through the trees.\"", "Personification", "Simile", "Hyperbole", "Idiom"),
    c("\"I've told you a million times!\"", "Hyperbole", "Metaphor", "Alliteration", "Personification"),
    c("\"Buzz! Crash! Pop!\"", "Onomatopoeia", "Alliteration", "Simile", "Idiom"),
    c("\"Peter Piper picked a peck of pickled peppers.\"", "Alliteration", "Onomatopoeia", "Hyperbole", "Metaphor"),
    c("\"It's raining cats and dogs.\"", "Idiom", "Simile", "Personification", "Alliteration"),
    c("\"Her smile was as bright as the sun.\"", "Simile", "Metaphor", "Idiom", "Onomatopoeia"),
    c("\"Time is a thief.\"", "Metaphor", "Simile", "Hyperbole", "Alliteration"),
    c("\"The alarm clock yelled at me to wake up.\"", "Personification", "Onomatopoeia", "Idiom", "Simile"),
    tf("A simile compares two things using the words \"like\" or \"as\".", true),
    tf("Hyperbole means saying exactly what happened, with no exaggeration.", false, "Hyperbole is a big exaggeration, like \"I'm so hungry I could eat a horse.\""),
  ]),

  starter("reading-words", "Words Good Readers Use", "Vocabulary", "6-8", "Match each reading word with what it means.", [
    card("Infer", "To figure something out from clues"),
    card("Summarize", "To tell the most important ideas in a few words"),
    card("Theme", "The message or lesson of a story"),
    card("Evidence", "Details from the text that support an idea"),
    card("Analyze", "To look closely at the parts of something"),
    card("Contrast", "To show how things are different"),
    card("Compare", "To show how things are alike"),
    card("Narrator", "The voice that tells the story"),
    card("Setting", "Where and when a story takes place"),
    card("Conflict", "The main problem in a story"),
    card("Predict", "To make a smart guess about what will happen next"),
    card("Point of view", "Who is telling the story and how they see it"),
  ]),

  starter("parts-of-speech", "Parts of Speech", "Reading", "3-5", "Nouns, verbs, adjectives and adverbs.", [
    c("Which word is a noun?", "Mountain", "Quickly", "Jump", "Happy"),
    c("Which word is a verb?", "Whisper", "Purple", "Pencil", "Slowly"),
    c("Which word is an adjective?", "Enormous", "Run", "Table", "Loudly"),
    c("Which word is an adverb?", "Carefully", "Careful", "Care", "Caring"),
    c("In \"The tiny kitten slept,\" which word is the adjective?", "Tiny", "Kitten", "Slept", "The"),
    c("In \"Maya sings beautifully,\" which word is the adverb?", "Beautifully", "Maya", "Sings", "None of them"),
    c("Which word is a pronoun?", "They", "Dog", "Green", "Swim"),
    c("Which word is a proper noun?", "Chicago", "City", "River", "Teacher"),
    tf("A verb can show action.", true),
    tf("An adjective describes a verb.", false, "An adjective describes a noun. An adverb describes a verb."),
    t("What part of speech names a person, place or thing?", "Noun", "A noun", "Nouns"),
    t("What part of speech is the word \"quickly\"?", "Adverb", "An adverb"),
  ]),

  starter("story-elements", "Story Parts", "Reading", "K-2", "Characters, setting and what happens in a story.", [
    c("The people or animals in a story are the…", "Characters", "Setting", "Title", "Pages"),
    c("Where and when a story happens is the…", "Setting", "Problem", "Author", "Ending"),
    c("The person who writes a book is the…", "Author", "Illustrator", "Character", "Reader"),
    c("The person who draws the pictures is the…", "Illustrator", "Author", "Narrator", "Teacher"),
    c("What usually comes at the end of a story?", "The problem is solved", "We meet the characters", "The title", "The cover"),
    tf("The title is the name of the book.", true),
    tf("The setting is the problem in the story.", false, "The setting is where and when the story happens."),
    c("A story that could not really happen is…", "Make-believe", "True", "A list", "A map"),
  ]),

  starter("poetry-terms", "Poetry Words", "Reading", "6-8", "The words poets and readers use to talk about poems.", [
    card("Stanza", "A group of lines in a poem, like a paragraph"),
    card("Rhyme scheme", "The pattern of rhymes at the ends of lines"),
    card("Meter", "The beat made by stressed and unstressed syllables"),
    card("Imagery", "Words that paint a picture for the senses"),
    card("Couplet", "Two lines in a row that rhyme"),
    card("Free verse", "Poetry with no set rhyme or beat"),
    card("Refrain", "A line or lines repeated through a poem"),
    card("Speaker", "The voice that talks in a poem"),
    card("Tone", "The poet's attitude or feeling toward the subject"),
    card("Haiku", "A three-line poem with 5, 7 and 5 syllables"),
  ]),

  starter("add-subtract-20", "Add and Subtract to 20", "Math", "K-2", "Type the answer as fast as you can.", [
    t("7 + 5 =", "12"), t("9 + 6 =", "15"), t("8 + 8 =", "16"), t("14 − 6 =", "8"), t("13 − 5 =", "8"), t("6 + 7 =", "13"),
    t("17 − 9 =", "8"), t("4 + 9 =", "13"), t("20 − 7 =", "13"), t("5 + 8 =", "13"), t("11 − 4 =", "7"), t("9 + 9 =", "18"),
    t("15 − 8 =", "7"), t("3 + 8 =", "11"), t("16 − 7 =", "9"), t("10 + 10 =", "20"),
  ]),

  starter("times-tables", "Times Tables 6 to 9", "Math", "3-5", "The tricky multiplication facts. Type each answer.", [
    t("6 × 7 =", "42"), t("6 × 8 =", "48"), t("6 × 9 =", "54"), t("7 × 7 =", "49"), t("7 × 8 =", "56"), t("7 × 9 =", "63"),
    t("8 × 8 =", "64"), t("8 × 9 =", "72"), t("9 × 9 =", "81"), t("6 × 6 =", "36"), t("9 × 4 =", "36"), t("8 × 4 =", "32"),
    t("7 × 6 =", "42"), t("9 × 6 =", "54"), t("8 × 7 =", "56"), t("12 × 9 =", "108"), t("11 × 8 =", "88"), t("12 × 12 =", "144"),
  ]),

  starter("fractions-decimals-percents", "Fractions, Decimals, Percents", "Math", "6-8", "Move between fractions, decimals and percents.", [
    c("What is 3/4 as a decimal?", "0.75", "0.34", "0.43", "1.33"),
    c("What is 25% as a fraction?", "1/4", "1/25", "2/5", "1/2"),
    c("What is 0.2 as a percent?", "20%", "2%", "0.2%", "200%"),
    c("What is 1/8 as a decimal?", "0.125", "0.18", "0.8", "1.8"),
    c("What is 60% as a fraction in simplest form?", "3/5", "6/10", "60/1", "2/3"),
    c("Which is greatest?", "0.7", "3/5", "65%", "2/3"),
    t("What is 1/2 as a percent?", "50%", "50", "50 percent"),
    t("What is 10% of 250?", "25"),
    t("What is 25% of 80?", "20"),
    tf("0.5 and 1/2 are equal.", true),
    tf("150% is less than 1.", false, "150% is the same as 1.5."),
    c("What is 2/5 as a percent?", "40%", "25%", "20%", "52%"),
  ]),

  starter("water-cycle", "The Water Cycle", "Science", "3-5", "How water moves between the ground, the sea and the sky.", [
    c("When the sun heats water and it turns into a gas, that is…", "Evaporation", "Condensation", "Precipitation", "Collection"),
    c("When water vapor cools and forms clouds, that is…", "Condensation", "Evaporation", "Runoff", "Freezing"),
    c("Rain, snow, sleet and hail are all kinds of…", "Precipitation", "Evaporation", "Condensation", "Erosion"),
    c("What gives the water cycle its energy?", "The Sun", "The Moon", "Wind", "Earth's core"),
    c("Water that flows over the land into rivers is called…", "Runoff", "Vapor", "Dew", "Steam"),
    c("Water as a gas is called…", "Water vapor", "Ice", "Dew", "Sleet"),
    tf("The water cycle has no beginning and no end.", true),
    tf("Clouds are made of smoke.", false, "Clouds are made of tiny drops of water or bits of ice."),
    c("Plants give off water through their leaves. This is called…", "Transpiration", "Precipitation", "Condensation", "Germination"),
    t("What is the solid form of water called?", "Ice"),
  ]),

  starter("cells-and-systems", "Cells and Body Systems", "Science", "6-8", "The parts of a cell and the jobs of the body's systems.", [
    c("Which part of the cell controls its activities and holds the DNA?", "Nucleus", "Cell wall", "Ribosome", "Vacuole"),
    c("Which part of the cell releases energy from food?", "Mitochondria", "Chloroplast", "Nucleus", "Cell membrane"),
    c("Which structure do plant cells have that animal cells do not?", "Cell wall", "Nucleus", "Mitochondria", "Cell membrane"),
    c("Where does photosynthesis happen in a plant cell?", "Chloroplast", "Nucleus", "Ribosome", "Mitochondria"),
    c("Which body system carries blood around the body?", "Circulatory", "Digestive", "Skeletal", "Nervous"),
    c("Which body system brings oxygen into the body?", "Respiratory", "Digestive", "Muscular", "Skeletal"),
    c("Which body system sends messages between the brain and the body?", "Nervous", "Circulatory", "Respiratory", "Digestive"),
    c("Which organ pumps blood?", "Heart", "Lungs", "Liver", "Stomach"),
    tf("All living things are made of cells.", true),
    tf("The cell membrane controls what goes in and out of a cell.", true),
    c("What gas do plants take in for photosynthesis?", "Carbon dioxide", "Oxygen", "Nitrogen", "Hydrogen"),
    t("What is the basic unit of life?", "Cell", "The cell", "Cells"),
  ]),

  starter("states-capitals", "States and Capitals", "Social Studies", "3-5", "Match each U.S. state with its capital city.", [
    card("California", "Sacramento"), card("Texas", "Austin"), card("New York", "Albany"), card("Florida", "Tallahassee"),
    card("Colorado", "Denver"), card("Illinois", "Springfield"), card("Washington", "Olympia"), card("Georgia", "Atlanta"),
    card("Arizona", "Phoenix"), card("Massachusetts", "Boston"), card("Ohio", "Columbus"), card("Utah", "Salt Lake City"),
    card("Tennessee", "Nashville"), card("Michigan", "Lansing"), card("Oregon", "Salem"), card("Pennsylvania", "Harrisburg"),
    card("Nevada", "Carson City"), card("Hawaii", "Honolulu"), card("Alaska", "Juneau"), card("New Mexico", "Santa Fe"),
  ]),

  starter("us-government", "How U.S. Government Works", "Social Studies", "6-8", "The three branches and what each one does.", [
    c("Which branch makes the laws?", "Legislative", "Executive", "Judicial", "Military"),
    c("Which branch carries out the laws?", "Executive", "Legislative", "Judicial", "Local"),
    c("Which branch decides what laws mean?", "Judicial", "Executive", "Legislative", "Federal"),
    c("What are the two parts of Congress?", "The Senate and the House of Representatives", "The Senate and the Supreme Court", "The House and the Cabinet", "The President and the Senate"),
    c("How many senators does each state have?", "2", "1", "4", "It depends on population"),
    c("What is the highest court in the United States?", "The Supreme Court", "The District Court", "The Court of Appeals", "The Senate"),
    c("What do we call the first ten amendments to the Constitution?", "The Bill of Rights", "The Preamble", "The Articles", "The Declaration"),
    c("The system that keeps one branch from becoming too powerful is called…", "Checks and balances", "Majority rule", "Federal reserve", "Popular vote"),
    tf("The President is part of the executive branch.", true),
    tf("Supreme Court justices are elected by voters.", false, "They are chosen by the President and approved by the Senate."),
    t("How many branches of government does the United States have?", "3", "Three"),
    t("How many years is one term for a U.S. President?", "4", "Four"),
  ]),
];

export const starterSet = (id: string) => STARTER_SETS.find((s) => s.id === id) ?? null;
