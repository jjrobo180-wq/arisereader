import { strict as assert } from "node:assert";
import { test } from "node:test";
import { BEGINNER_LESSONS } from "./lessons";
import {
  ORIGINAL_WORD_CHAINS, UNIT_WORD_CHAINS, buildMatches, describeLetterChange,
  getPhonicsActivity, soundHint, tileChoices
} from "./phonics-curriculum";
import { seeds as one } from "./curriculum/unit-1";
import { seeds as two } from "./curriculum/unit-2";
import { seeds as three } from "./curriculum/unit-3";
import { seeds as four } from "./curriculum/unit-4";
import { seeds as five } from "./curriculum/unit-5";
import { seeds as six } from "./curriculum/unit-6";
import { seeds as seven } from "./curriculum/unit-7";
import { seeds as eight } from "./curriculum/unit-8";
import { seeds as nine } from "./curriculum/unit-9";
import { seeds as ten } from "./curriculum/unit-10";
const seeds=[one,two,three,four,five,six,seven,eight,nine,ten];

test("All 112 lesson cards have explicit instruction and THREE complete, achievable word builds",()=>{
  assert.equal(BEGINNER_LESSONS.length,112);
  assert.equal(Object.keys(ORIGINAL_WORD_CHAINS).length,12);
  assert.equal(UNIT_WORD_CHAINS.length,10);
  for(const [i,lesson] of BEGINNER_LESSONS.entries()){
    const x=getPhonicsActivity(lesson,i);
    assert.equal(x.lessonId,lesson.id);
    assert.ok(x.title.length>16&&x.objective.length>35&&x.model.length>40&&x.readingCue.length>25,lesson.title);
    assert.equal(x.wordBuilds.length,3,lesson.title);
    const used=new Set<string>();
    for(const task of x.wordBuilds){
      assert.ok(task.parts.length>=2&&task.parts.length<=7,lesson.title+" bad number of tiles");
      assert.equal(task.parts.join(""),task.word);
      assert.match(task.word,/^[a-z]{2,16}$/i);
      assert.ok(!used.has(task.word),lesson.title+" repeated build: "+task.word);
      used.add(task.word);
      const bank=tileChoices(task,x.wordBuilds);
      assert.ok(bank.length>=task.parts.length+2,lesson.title+" should have decoy tiles");
      assert.equal(new Set(bank.map(x=>x.id)).size,bank.length);
      for(const part of task.parts)assert.ok(bank.some(tile=>tile.text===part),lesson.title+" missing "+part);
      assert.ok(buildMatches(task,task.parts),lesson.title+" cannot complete target");
      assert.equal(buildMatches(task,[...task.parts].reverse()),task.parts.join()===task.parts.slice().reverse().join());
      assert.equal(buildMatches(task,[]),false);
      assert.ok(task.parts.every(p=>soundHint(p,x.unit).length>4),lesson.title+" missing sound cue");
    }
  }
});
test("Each of 100 curriculum lessons keeps its word-building task aligned to its targeted phonics word",()=>{
  for(let unit=1;unit<=9;unit++){
    const rows=seeds[unit-1];
    for(let index=0;index<10;index++){
      const l=BEGINNER_LESSONS[12+(unit-1)*10+index];
      assert.ok(l.id.includes(rows[index].title.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,12))||l.title===rows[index].title,l.id+" reordered without phonics data");
      const a=getPhonicsActivity(l,12+(unit-1)*10+index);
      assert.equal(a.wordBuilds[0].word,rows[index].words[0],l.title+" target doesn't match taught reading word");
    }
  }
});
test("Phonics sequence keeps consonant blends separate and teams together",()=>{
  const a=getPhonicsActivity(BEGINNER_LESSONS[12+40],12+40);
  assert.equal(a.unit,5);
  assert.deepEqual(a.wordBuilds[0].parts,["s","t","o","p"]);
  const digraph=getPhonicsActivity(BEGINNER_LESSONS[12+50],12+50);
  assert.deepEqual(digraph.wordBuilds[0].parts,["sh","o","p"]);
  const magicE=getPhonicsActivity(BEGINNER_LESSONS[12+60],12+60);
  assert.deepEqual(magicE.wordBuilds[0].parts,["g","a","m","e"]);
  assert.match(soundHint("e",7),/Silent e/);
  const vowelTeam=getPhonicsActivity(BEGINNER_LESSONS[12+70],12+70);
  assert.deepEqual(vowelTeam.wordBuilds[0].parts,["r","ai","n"]);
  const syllable=getPhonicsActivity(BEGINNER_LESSONS[12+80],12+80);
  assert.deepEqual(syllable.wordBuilds[0].parts,["ro","bot"]);
  const morphology=getPhonicsActivity(BEGINNER_LESSONS[12+90],12+90);
  assert.deepEqual(morphology.wordBuilds[1].parts,["re","check"]);
});
test("First three phonics units have CVC decoding and single-phoneme word changes",()=>{
  for(let unit=1;unit<=3;unit++){
    for(let i=0;i<10;i++){
      const a=getPhonicsActivity(BEGINNER_LESSONS[12+(unit-1)*10+i],12+(unit-1)*10+i);
      for(const b of a.wordBuilds){
        assert.equal(b.parts.length,3);
        assert.ok(["a","i","o","u","e"].includes(b.parts[1]),b.word);
      }
      for(let j=1;j<3;j++){
        const before=a.wordBuilds[j-1],after=a.wordBuilds[j];
        const diff=before.parts.filter((p,k)=>p!==after.parts[k]).length;
        assert.equal(diff,1,before.word+" to "+after.word+" is not a one-sound change");
        assert.match(describeLetterChange(before,after),/Change the/);
      }
    }
  }
});
test("Heart word instruction marks irregular spellings rather than pretending each letter is fully decodable",()=>{
  const heart=getPhonicsActivity(BEGINNER_LESSONS[12+30+3],12+30+3);
  assert.equal(heart.unit,4);
  assert.match(heart.objective,/unexpected sound/);
  assert.match(soundHint("ai",4),/Tricky part/);
  assert.match(heart.model,/said/);
});
