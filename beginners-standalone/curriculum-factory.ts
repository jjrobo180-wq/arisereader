import type { BeginnerCategory, BeginnerLesson, BeginnerQuestion } from "./lessons";
import { UNIT_WORD_CHAINS, soundHint } from "./phonics-curriculum";

export type CurriculumSeed = {
  title: string;
  subject: string;
  category: BeginnerCategory;
  place: string;
  item: string;
  ending: string;
  story: string;
  // target, matching word, two plausible contrasts. A phonics test is always
  // followed by a meaning check grounded in the original mini-story.
  words: [string,string,string,string];
};
type Unit = {
  number: number;
  level: 1|2|3;
  skill: string;
  pattern: string;
  coaching: string;
  more: string;
  accent: string;
};
export const UNIT_CONFIG: Unit[] = [
  {number:1,level:1,skill:"Blend short A words",pattern:"short /a/",coaching:"Say each sound in the first word slowly. Slide them together without adding an extra vowel sound. Practice the matching word next.",more:"Sound it out, blend it, then read the entire sentence. A word you can decode is a word you can use.",accent:"#6e7cf0"},
  {number:2,level:1,skill:"Blend short I words",pattern:"short /i/",coaching:"Listen for the short /i/ sound in the middle. Touch the first, middle and last sounds in order.",more:"Keep your eyes on the letters. Don't guess from the picture. Blend the sounds together.",accent:"#26a4ba"},
  {number:3,level:1,skill:"Short O, U and E vowels",pattern:"short vowel",coaching:"Read the middle vowel carefully. A one-letter change can turn one word into another.",more:"Say the sounds, blend the word, and check whether it makes sense in the story.",accent:"#db8b5a"},
  {number:4,level:1,skill:"Read common words",pattern:"high-frequency word",coaching:"Read the letters in order. Notice which part is regular and which part you need to remember.",more:"Find the same word in a sentence, then read the whole sentence smoothly.",accent:"#b275d2"},
  {number:5,level:2,skill:"Beginning consonant blends",pattern:"consonant blend",coaching:"A blend keeps both consonant sounds. Say the first sound, then the second, then the rest of the word.",more:"Compare the similar words without dropping a sound. Read them in a sentence once you can blend them.",accent:"#509bdd"},
  {number:6,level:2,skill:"SH, CH, TH and WH teams",pattern:"consonant team",coaching:"Some pairs of letters work as one sound. Find the team, say that sound, then blend the word.",more:"Watch the first and last letters: a little change can make a very different word.",accent:"#d46f90"},
  {number:7,level:2,skill:"Silent E changes vowels",pattern:"silent-e pattern",coaching:"Look for the final e. It often makes the earlier vowel long. Compare the word with one that has a short vowel.",more:"Read the long-vowel word, then read it naturally inside the sentence.",accent:"#678cdf"},
  {number:8,level:2,skill:"Vowel teams and R sounds",pattern:"vowel team or r-controlled vowel",coaching:"Look for the letter team or the r after the vowel. Try that sound before blending the rest of the word.",more:"Check the full spelling; similar-looking words can have different sounds and meanings.",accent:"#48a89c"},
  {number:9,level:3,skill:"Break longer words into parts",pattern:"two-syllable word",coaching:"Long words become easier when you look for the vowel in each chunk. Say the parts and blend them together.",more:"After decoding, use the sentence to check the word's meaning.",accent:"#ad6acb"},
  {number:10,level:3,skill:"Read for evidence and meaning",pattern:"meaning and evidence",coaching:"Find the clue in the text before answering. Distinguish what the passage actually says from what you merely guess.",more:"Reread the sentence that proves your answer. An accurate reader can point to evidence.",accent:"#d09a4f"}
];
const promptA=[
  "Where does this practice story take place?",
  "Which setting appears in the passage?",
  "Where is the main action happening?",
  "Choose the location named in the story.",
  "Which location best matches the reading?",
  "Where does the event begin?",
  "Which place is mentioned?",
  "Read for setting. Where are they?",
  "Where is this scene set?",
  "Find the place in the passage."
];
const promptB=[
  "Which item helps move this story forward?",
  "What item is mentioned in the story?",
  "What object does the reader learn about?",
  "Pick the object named in the passage.",
  "Which item appears in this reading?",
  "What does the character use or notice?",
  "Find the object from the passage.",
  "Which thing is part of the scene?",
  "What item can you find in the text?",
  "Which object matches the details?"
];
const promptC=[
  "How does this story end?",
  "What happens at the end?",
  "Which result is stated in the last part?",
  "Which ending is supported by the passage?",
  "What is the result of the action?",
  "What happens after the main activity?",
  "Which outcome does the text describe?",
  "Pick the ending the writer actually gives.",
  "What is the final result?",
  "What happens last in the story?"
];
function options(right:string,wrong1:string,wrong2:string,slot:number):{choices:[string,string,string];correct:number}{
  const items=[wrong1,wrong2];
  items.splice(slot,0,right);
  return {choices:items as [string,string,string],correct:slot};
}
function question(prompt:string,right:string,wrong1:string,wrong2:string,slot:number,hint:string):BeginnerQuestion{
  return {prompt,...options(right,wrong1,wrong2,slot),hint};
}
function cleanSlug(title:string){return title.toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}

export function makeCurriculumUnit(unitNumber:number, seeds:CurriculumSeed[]):BeginnerLesson[]{
  const unit=UNIT_CONFIG[unitNumber-1];
  if(!unit||seeds.length!==10)throw Error("Curriculum unit must have exactly 10 authored stories: "+unitNumber);
  return seeds.map((seed,index)=>{
    const [target,matching,contrastA,contrastB]=seed.words;
    const other1=seeds[(index+3)%10];
    const other2=seeds[(index+7)%10];
    const chainThirdParts=UNIT_WORD_CHAINS[unitNumber-1][index].split(",")[2].split("|");
    const chainThird=chainThirdParts.join("");
    const advancedMeanings:Record<string,string>={
      evidence:"Which word means facts that help support a claim?",
      compare:"Which word means to look for similarities and differences?",
      sequence:"Which word means the order in which events happen?",
      signal:"Which word means a clue that tells you something is changing?",
      conclude:"Which word means to reach an answer after considering clues?",
      explain:"Which word means to make an idea clear with reasons?",
      preview:"Which word means to look at something before examining it fully?",
      identify:"Which word means to recognize and name something?",
      observe:"Which word means to look closely and notice details?",
      solution:"Which word means an answer to a problem?"
    };
    const phonicsPrompt=unitNumber<=3
      ? "Blend the sounds "+target.split("").map(letter=>soundHint(letter,unitNumber).split(" — ")[0]).join(" ")+". Which word do you read?"
      : unitNumber===4
        ? "Which word exactly matches "+target.toUpperCase().split("").join("-")+"?"
        : unitNumber<=8
          ? "Find the "+unit.pattern+" word practiced in this lesson."
          : unitNumber===9
            ? "Which word is the longer, two-syllable practice word?"
            : advancedMeanings[target];
    const secondPrompt=unitNumber<=3?"Which word rhymes with "+target.toUpperCase()+"?"
      : unitNumber===4?"Read "+matching.toUpperCase().split("").join("-")+". Which word do the letters spell?"
      : unitNumber<=8?"Which word shares the same spelling pattern as "+target.toUpperCase()+"?"
      : unitNumber===9?"Which second word can you divide into two spoken parts?"
      : "Which word is closest in meaning to "+target.toUpperCase()+"?";
    const secondWrong1=unitNumber===4?other1.words[0]:unitNumber<=8?"cat":unitNumber===9?"log":"sing";
    const secondWrong2=unitNumber===4?other2.words[0]:unitNumber<=8?"dog":unitNumber===9?"sun":"sleep";
    // For vowel teams and blends, CAT/DOG are clear non-pattern distractors;
    // for longer words, choose genuinely one-syllable or unrelated meanings.
    const questions:BeginnerQuestion[]=[
      question(phonicsPrompt,target,contrastA,contrastB,(index+unitNumber)%3,"Say the sounds in order, then check every letter."),
      question(secondPrompt,matching,secondWrong1,secondWrong2,(index+unitNumber+1)%3,
        "Read and compare the spelling and sound of the target and its partner."),
      question("Blend the word parts "+chainThirdParts.join(" + ")+". What word do they make?",
        chainThird,contrastA,contrastB,(index+unitNumber+2)%3,
        "Blend each grapheme or syllable from left to right, then read the whole word."),
      question(promptB[index],seed.item,other1.item,other2.item,(index+unitNumber)%3,
        "Look for the object the characters use or notice."),
      question(promptC[index],seed.ending,other1.ending,other2.ending,(index+unitNumber+1)%3,
        "The ending is explicitly stated near the end of the story.")
    ];
    const story=seed.story.trim();
    const instruction=unit.coaching+" Read and compare these examples: "+target+", "+matching+".";
    const again="Read the passage a second time. Name the setting, the important object, and the ending. "
      +"Notice the word "+target+" and its partner "+matching+". "+unit.more;
    return {
      id:"original-"+cleanSlug(seed.title),
      title:seed.title,
      category:seed.category,
      skill:unit.skill,
      level:unit.level,
      points:unit.level*10,
      duration:unit.level===1?6:unit.level===2?8:10,
      hook:story.match(/^[^.!?]+[.!?]/)?.[0] || story.slice(0,130),
      subject:seed.subject,
      imageFile:"",
      accent:unit.accent,
      slides:[
        {heading:"The "+unit.pattern+" challenge",text:story,focus:[target,matching,contrastA,contrastB],
          instruction:"This is an original, imagined reading scenario—not a report about a real person's actions. Read once for the story, then look closely at the words."},
        {heading:"Unlock the reading skill",text:instruction+" "+unit.more,focus:[target,matching],
          instruction:unit.coaching},
        {heading:"Read it again: find the proof",text:again,focus:[target,matching],
          instruction:"Read the original story again. Find the sentence that answers each question instead of guessing."}
      ],
      questions
    };
  });
}
