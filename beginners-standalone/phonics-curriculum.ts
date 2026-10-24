import type { BeginnerLesson } from "./lessons";

/**
 * Hand-selected word work, not algorithmically fabricated words. A vertical bar
 * separates one moveable grapheme (or a syllable/morpheme at advanced levels).
 * Letters in a consonant cluster remain separate: s|t|o|p, not st|o|p.
 * The title/story connection is for engagement; high-interest texts are
 * supported reading, NOT falsely labelled as controlled decodable passages.
 */
export const UNIT_WORD_CHAINS: string[][] = [
  [
    "f|a|n,c|a|n,p|a|n","c|a|p,m|a|p,t|a|p","b|a|g,t|a|g,r|a|g",
    "h|a|t,b|a|t,c|a|t","j|a|m,h|a|m,r|a|m","m|a|p,c|a|p,t|a|p",
    "p|a|n,f|a|n,c|a|n","s|a|d,b|a|d,d|a|d","t|a|p,l|a|p,m|a|p",
    "v|a|n,c|a|n,f|a|n"
  ],
  [
    "w|i|n,p|i|n,f|i|n","s|i|t,h|i|t,b|i|t","r|i|m,h|i|m,d|i|m",
    "d|i|g,p|i|g,w|i|g","l|i|p,t|i|p,s|i|p","b|i|g,f|i|g,d|i|g",
    "z|i|p,h|i|p,d|i|p","p|i|n,f|i|n,w|i|n","k|i|d,l|i|d,r|i|d",
    "f|i|t,b|i|t,s|i|t"
  ],
  [
    "h|o|p,m|o|p,p|o|p","d|o|g,f|o|g,l|o|g","l|o|g,f|o|g,d|o|g",
    "b|u|g,r|u|g,h|u|g","s|u|n,f|u|n,r|u|n","n|e|t,p|e|t,w|e|t",
    "j|e|t,p|e|t,w|e|t","r|e|d,b|e|d,f|e|d","c|u|p,p|u|p,p|o|p",
    "h|o|t,p|o|t,d|o|t"
  ],
  [
    "th|e,th|i|s,th|e|m","y|ou,y|our,th|ey","w|a|s,s|ai|d,s|aw",
    "s|ai|d,h|a|v|e,s|ay|s","h|a|v|e,w|i|th,f|r|o|m",
    "f|r|o|m,th|ey,wh|ere","ar|e,w|i|th,wh|ere",
    "th|ey,th|i|s,th|e|m","w|i|th,th|e,sh|e","th|i|s,y|ou,th|a|t"
  ],
  [
    "s|t|o|p,s|t|e|p,s|t|e|m","t|r|i|p,t|r|a|p,t|r|a|m",
    "g|r|i|n,g|r|i|p,g|r|i|d","c|l|a|p,c|l|i|p,s|l|i|p",
    "f|l|a|g,f|l|a|p,f|l|i|p","b|r|a|g,d|r|a|g,d|r|a|b",
    "s|p|i|n,s|p|i|t,s|p|o|t","d|r|u|m,d|r|i|p,d|r|o|p",
    "s|l|i|p,s|l|a|p,s|n|a|p","f|r|o|g,f|r|o|m,p|r|o|m"
  ],
  [
    "sh|o|p,sh|i|p,ch|i|p","ch|i|p,ch|o|p,sh|o|p",
    "th|i|n,ch|i|n,ch|i|p","wh|i|p,ch|i|p,sh|i|p",
    "r|u|sh,r|a|sh,c|a|sh","m|u|ch,s|u|ch,s|u|ck",
    "b|a|th,p|a|th,m|a|th","sh|e|ll,sh|a|ll,sh|i|ll",
    "ch|e|ss,ch|e|s|t,ch|e|ck","th|r|ee,th|r|ew,th|r|ow"
  ],
  [
    "g|a|m|e,n|a|m|e,s|a|m|e","c|a|k|e,l|a|k|e,m|a|k|e",
    "m|i|l|e,p|i|l|e,t|i|l|e","r|i|d|e,s|i|d|e,h|i|d|e",
    "n|o|t|e,n|o|s|e,r|o|s|e","h|o|p|e,r|o|p|e,r|i|p|e",
    "c|u|b|e,t|u|b|e,t|u|n|e","g|a|t|e,l|a|t|e,l|a|k|e",
    "w|a|v|e,s|a|v|e,s|a|f|e","t|u|n|e,d|u|n|e,d|u|d|e"
  ],
  [
    "r|ai|n,p|ai|n,g|ai|n","b|oa|t,c|oa|t,g|oa|t",
    "s|ee|d,n|ee|d,f|ee|d","g|r|ee|n,s|ee|n,t|ee|n",
    "s|t|ar,s|t|ar|t,s|m|ar|t","p|ar|k,d|ar|k,b|ar|k",
    "t|ur|n,b|ur|n,ch|ur|n","b|ir|d,th|ir|d,th|ir|s|t",
    "f|or|k,c|or|k,p|or|k","m|oo|n,s|oo|n,s|p|oo|n"
  ],
  [
    "ro|bot,rob|in,rock|et","tab|let,mag|net,rab|bit",
    "mar|ket,bas|ket,car|pet","art|ist,a|pron,riv|er",
    "rock|et,pock|et,jack|et","play|er,read|er,teach|er",
    "sig|nal,sin|gle,win|ner","mu|sic,pu|pil,ti|ger",
    "hel|met,vel|vet,bas|ket","plan|et,com|et,tick|et"
  ],
  [
    "ev|i|dence,re|check,help|ful","com|pare,re|play,un|fair",
    "se|quence,re|tell,play|er","sig|nal,re|read,care|ful",
    "con|clude,un|lock,help|ful","ex|plain,re|test,hope|ful",
    "pre|view,re|check,un|clear","i|den|ti|fy,re|check,truth|ful",
    "ob|serve,re|watch,un|clear","so|lu|tion,re|think,use|ful"
  ]
];

// The original 12 cover lessons also get taught phonics and three word builds,
// instead of slipping directly into comprehension questions.
export const ORIGINAL_WORD_CHAINS: Record<string, {unit:number;chain:string}> = {
  "caitlin-court":{unit:2,chain:"r|i|m,h|i|m,d|i|m"},
  "mrbeast-prize":{unit:2,chain:"w|i|n,p|i|n,f|i|n"},
  "olivia-show":{unit:4,chain:"th|e,th|i|s,th|e|m"},
  "mahomes-drive":{unit:5,chain:"c|l|a|p,c|l|i|p,s|l|i|p"},
  "gamer-final-round":{unit:7,chain:"g|a|t|e,l|a|t|e,l|a|k|e"},
  "sneaker-drop":{unit:6,chain:"sh|o|p,sh|i|p,ch|i|p"},
  "beyonce-beat":{unit:9,chain:"mu|sic,pu|pil,ti|ger"},
  "football-focus":{unit:8,chain:"g|oa|l,c|oa|l,c|oa|t"},
  "ronaldo-net":{unit:3,chain:"n|e|t,p|e|t,w|e|t"},
  "sabrina-spotlight":{unit:6,chain:"sh|i|p,sh|o|p,ch|o|p"},
  "mark-rober-build":{unit:9,chain:"ro|bot,rock|et,pock|et"},
  "mbappe-final-sprint":{unit:8,chain:"g|oa|l,c|oa|l,c|oa|t"}
};
export type WordBuild = {word:string;parts:string[];unit:number};
export type PhonicsActivity = {
  lessonId:string;
  unit:number;
  title:string;
  objective:string;
  model:string;
  readingCue:string;
  wordBuilds:[WordBuild,WordBuild,WordBuild];
};

const UNIT_INSTRUCTION:Record<number,{title:string;objective:string;model:string;readingCue:string}>={
  1:{
    title:"Short A: map the three sounds",
    objective:"Notice that the letter a stands for the short /ă/ sound. Blend the first, middle and last sound.",
    model:"Watch me: /f/ ... /ă/ ... /n/. Touch f, a, n. Slide them together: fan. Now build another word by changing one sound.",
    readingCue:"A short-A word has one vowel sound. Say each sound smoothly, then the whole word."
  },
  2:{
    title:"Short I: hear the middle sound",
    objective:"Hear /ĭ/ in win and sit. Match each of the three sounds to the correct letter.",
    model:"Listen: /w/ ... /ĭ/ ... /n/. Put w, i, n in order. Blend: win. Change /w/ to /p/ and you get pin.",
    readingCue:"Keep the middle /ĭ/ sound. Don't change it to /ē/."
  },
  3:{
    title:"Short vowels: one letter makes a difference",
    objective:"Hear the middle vowel clearly: /ŏ/ in hop, /ŭ/ in sun, or /ĕ/ in net.",
    model:"Watch: /h/ ... /ŏ/ ... /p/ makes hop. Change h to m: mop. Touch each box as you say its sound.",
    readingCue:"Look at the vowel, blend the word, then read it with meaning."
  },
  4:{
    title:"Heart words: map the regular and tricky parts",
    objective:"Read high-frequency words by noticing each grapheme and any unexpected sound. Don't memorize the whole shape.",
    model:"The word 'said' looks like s + ai + d. The part ai says /ĕ/ in this word. Map the parts and practice writing the word.",
    readingCue:"A few spellings are unusual. Identify the tricky part and connect the letters to the spoken word."
  },
  5:{
    title:"Two consonants, two sounds",
    objective:"In words like stop and clap, both consonant sounds are heard at the start.",
    model:"To build stop, say /s/ /t/ /ŏ/ /p/. Set down four tiles: s, t, o, p. Keep /s/ and /t/ separate.",
    readingCue:"The beginning consonants are two separate phonemes, even when we say them quickly."
  },
  6:{
    title:"Digraphs: two letters can spell one sound",
    objective:"Teams such as sh, ch and th represent one sound. Move their letters together on one tile.",
    model:"To build ship: /sh/ /ĭ/ /p/. Put sh on the first box, i in the middle, and p on the last. Read ship.",
    readingCue:"One grapheme tile may have two letters. It's still one sound when you blend the word."
  },
  7:{
    title:"Silent E: the vowel says its name",
    objective:"An e at the end can change a short vowel to its long sound: cap becomes cape.",
    model:"Look at cake: c + a + k + e. The a says /ā/, and the last e is silent. Build cake and read it aloud.",
    readingCue:"Read the long vowel. Keep the e tile even though you don't pronounce it."
  },
  8:{
    title:"Vowel teams and bossy R",
    objective:"Notice letter teams such as ai, ee, oa and oo, and vowel-r spellings such as ar, ir, or, ur.",
    model:"Rain: r + ai + n. The letters ai work together for /ā/. Don't split that team when you build rain.",
    readingCue:"Check whether the vowel letters form one grapheme before choosing your tiles."
  },
  9:{
    title:"Long words: break into syllables",
    objective:"Read longer words in smaller syllables, then blend them without pausing between each part.",
    model:"Robot has two spoken beats: ro / bot. Place ro and bot together. Read each chunk, then read robot smoothly.",
    readingCue:"These larger tiles are syllables. Say each chunk accurately and put the word back together."
  },
  10:{
    title:"Use syllables, prefixes and suffixes",
    objective:"Build longer reading and evidence words from meaningful parts: re- means again; un- can mean not; -ful means full of.",
    model:"Re + read = reread. Help + ful = helpful. Look for meaningful parts, then read and use the whole word.",
    readingCue:"Some larger tiles are syllables; others are prefixes, bases or suffixes. Say what each part contributes."
  }
};

function parseWords(raw:string,unit:number):[WordBuild,WordBuild,WordBuild]{
  const words=raw.split(",").map(rawWord=>{
    const parts=rawWord.split("|").map(x=>x.trim()).filter(Boolean);
    if(parts.some(p=>!/^[a-z]+$/i.test(p)))throw new Error("Invalid word part: "+rawWord);
    return {word:parts.join(""),parts,unit};
  });
  if(words.length!==3||new Set(words.map(x=>x.word)).size!==3)throw new Error("Each lesson needs three distinct spelling builds: "+raw);
  return words as [WordBuild,WordBuild,WordBuild];
}
export function getPhonicsActivity(lesson:BeginnerLesson,catalogIndex:number):PhonicsActivity {
  const isOriginal=catalogIndex<12;
  const mapping=isOriginal?ORIGINAL_WORD_CHAINS[lesson.id]:null;
  if(isOriginal&&!mapping)throw Error("Original lesson missing phonics: "+lesson.id);
  const unit=mapping?.unit ?? Math.floor((catalogIndex-12)/10)+1;
  const seq=UNIT_INSTRUCTION[unit];
  const raw=mapping?.chain ?? UNIT_WORD_CHAINS[unit-1]?.[(catalogIndex-12)%10];
  if(!seq||!raw)throw Error("Lesson missing phonics word chains: "+lesson.id);
  return {lessonId:lesson.id,unit,...seq,wordBuilds:parseWords(raw,unit)};
}
export function buildMatches(target:WordBuild,selected:string[]):boolean{
  return target.parts.length===selected.length&&target.parts.every((p,i)=>p===selected[i]);
}
export function describeLetterChange(a:WordBuild,b:WordBuild):string {
  if(a.unit>8||a.parts.length!==b.parts.length)return "Build a new word. Check each part carefully.";
  const changed=a.parts.map((p,i)=>p===b.parts[i]?-1:i).filter(i=>i>=0);
  if(changed.length!==1)return "Build a new word. Notice what changes and what stays the same.";
  const position=changed[0]===0?"first":changed[0]===a.parts.length-1?"last":"middle";
  return "Change the "+position+" tile to make the next word.";
}
export function tileChoices(build:WordBuild,all:WordBuild[]):{id:string;text:string}[]{
  const core=build.parts.map((text,i)=>({id:"target-"+i,text}));
  const extras=[...all.flatMap(w=>w.parts),"s","m","p","a","i","o","e","t","sh","ch","ai","ee"]
    .filter(x=>!build.parts.includes(x));
  const extrasUnique=[...new Set(extras)].slice(0,Math.max(2,Math.min(3,6-build.parts.length)));
  const tiles=[...core,...extrasUnique.map((text,i)=>({id:"extra-"+i,text}))];
  // Deterministic alternating order prevents the answer from appearing
  // in perfect left-to-right order while avoiding runtime randomization.
  if(tiles.length>=3){const first=tiles.shift()!;tiles.splice(1,0,first)}
  return tiles;
}
export function soundHint(part:string,unit:number):string{
  if(unit>=9)return "Part: "+part;
  const vowel:Record<string,[string,string]>={
    a:["/ă/","apple"],e:["/ĕ/","edge"],i:["/ĭ/","itch"],o:["/ŏ/","octopus"],u:["/ŭ/","up"],
    ai:["/ā/","rain"],ee:["/ē/","seed"],oa:["/ō/","boat"],oo:["/oo/","moon"],ar:["/ar/","star"],or:["/or/","fork"],ir:["/er/","bird"],ur:["/er/","turn"],
    sh:["/sh/","ship"],ch:["/ch/","chip"],th:["/th/","thin"],wh:["/w/","when"],ck:["/k/","back"],ll:["/l/","bell"],ss:["/s/","chess"],
    ew:["/oo/","threw"],ow:["/ō/","throw"],ay:["/ā/","says (often /ā/; irregular word)"],
    ou:["/oo/","you"],ey:["/ā/","they"],our:["/or/","your"],ere:["/air/","where"]
  };
  if(unit===7&&part==="e")return "Silent e — keep the tile, but don't say a separate sound";
  if(unit===7&&"aeiou".includes(part)&&part.length===1)return "Long /"+part+"/ — the vowel says its name";
  if(unit===4){
    if(part==="ai")return "Tricky part: ai says /ĕ/ in said";
    if(part==="a")return "Listen carefully: 'a' varies in heart words such as was and have";
    if(part==="e")return "Notice the sound (or silence) of this e in the whole word";
    if(part==="th")return "th is voiced in the, this, them and they";
  }
  const consonant:Record<string,[string,string]>={
    b:["/b/","bat"],c:["/k/","cat"],d:["/d/","dog"],f:["/f/","fan"],
    g:["/g/","go"],h:["/h/","hat"],j:["/j/","jam"],k:["/k/","kid"],l:["/l/","lip"],
    m:["/m/","map"],n:["/n/","net"],p:["/p/","pan"],r:["/r/","red"],
    s:["/s/","sun"],t:["/t/","tap"],v:["/v/","van"],w:["/w/","win"],
    y:["/y/","yes"],z:["/z/","zip"]
  };
  const entry=vowel[part]??consonant[part];
  return entry?entry[0]+" — as in "+entry[1]:"Look at "+part+" in the word";
}
