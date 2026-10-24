import { test } from "node:test";
import { strict as assert } from "node:assert";
import { BEGINNER_LESSONS } from "./lessons";
import { makeCurriculumUnit, UNIT_CONFIG } from "./curriculum-factory";
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
const UNITS=[one,two,three,four,five,six,seven,eight,nine,ten];

test("A.R.I.S.E. Beginners contains exactly 112 unique reading lessons: 12 original and 100 new",()=>{
  assert.equal(BEGINNER_LESSONS.length,112);
  assert.equal(BEGINNER_LESSONS.filter(l=>l.id.startsWith("original-")).length,100);
  assert.equal(new Set(BEGINNER_LESSONS.map(l=>l.id)).size,112);
  assert.equal(new Set(BEGINNER_LESSONS.map(l=>l.title.toLowerCase())).size,112);
  assert.equal(UNIT_CONFIG.length,10);
});
test("100 new lessons cover ten explicit skill progressions and all pass the content schema",()=>{
  const byLevel:Record<number,number>={1:0,2:0,3:0};
  const seenStories=new Set<string>();
  for(let i=0;i<10;i++){
    const seeds=UNITS[i];
    assert.equal(seeds.length,10,"Each unit must contain exactly 10 authored stories");
    const generated=makeCurriculumUnit(i+1,seeds);
    assert.equal(generated.length,10);
    for(let j=0;j<10;j++){
      const l=generated[j], seed=seeds[j];
      assert.equal(l.skill,UNIT_CONFIG[i].skill,l.title);
      assert.equal(l.level,UNIT_CONFIG[i].level,l.title);
      assert.equal(l.points,l.level*10,l.title);
      byLevel[l.level]++;
      assert.equal(l.questions.length,5,l.title);
      assert.equal(l.slides.length,3,l.title);
      assert.ok(l.slides[0].text.split(/\s+/).length>=45,l.title+" original passage should be substantial");
      assert.ok(l.slides[1].text.split(/\s+/).length>=30,l.title+" instruction should explicitly model the skill");
      assert.ok(l.slides[2].text.length>=100,l.title+" should guide rereading");
      assert.ok(!seenStories.has(l.slides[0].text),l.title+" story is duplicated");
      seenStories.add(l.slides[0].text);
      assert.equal(l.category,seed.category);
      assert.equal(l.subject,seed.subject);
      for(const field of ["place","item","ending"] as const){
        assert.ok(seed.story.toLowerCase().includes(seed[field].toLowerCase()),l.title+" answer has no evidence in the story: "+field);
      }
      for(let q=0;q<5;q++){
        const question=l.questions[q];
        assert.ok(question.prompt.length>=20,l.title+" question "+q+" vague");
        assert.equal(question.choices.length,3);
        assert.ok(Number.isInteger(question.correct)&&question.correct>=0&&question.correct<3);
        assert.equal(new Set(question.choices.map(x=>x.trim().toLowerCase())).size,3,l.title+" duplicated answer options in Q"+q);
        assert.ok(question.hint.length>25,l.title+" missing meaningful hint Q"+q);
      }
      assert.equal(l.questions[2].choices[l.questions[2].correct],seed.place,l.title+" setting answer incorrect");
      assert.equal(l.questions[3].choices[l.questions[3].correct],seed.item,l.title+" object answer incorrect");
      assert.equal(l.questions[4].choices[l.questions[4].correct],seed.ending,l.title+" outcome answer incorrect");
      // The contrasting answers must not also be stated in the story.
      for(let q=2;q<=4;q++){
        for(let c=0;c<3;c++){
          if(c===l.questions[q].correct)continue;
          const wrong=l.questions[q].choices[c].toLowerCase();
          assert.ok(!seed.story.toLowerCase().includes(wrong),l.title+" Q"+q+" ambiguous: "+wrong+" appears in story");
        }
      }
      if(i<3){
        assert.equal(seed.words[0].length,3,l.title+" should test one CVC word");
        assert.equal(seed.words[0].slice(1),seed.words[1].slice(1),l.title+" word pair should rhyme");
      }
      assert.ok(l.slides[0].text.includes(seed.place)&&l.slides[0].text.includes(seed.item));
    }
  }
  assert.deepEqual(byLevel,{1:40,2:40,3:20});
});
test("All 112 published lessons have safe, unambiguous multiple-choice data",()=>{
  const counted:Record<number,number>={1:0,2:0,3:0};
  for(const l of BEGINNER_LESSONS){
    assert.ok(l.id&&l.title&&l.skill&&l.hook&&l.subject,l.id);
    assert.ok(/^#[0-9a-f]{6}$/i.test(l.accent),l.title+" accent must be a hex color");
    assert.equal(l.points,l.level*10,l.title);
    assert.ok(l.slides.length>=2,l.title);
    assert.equal(l.questions.length,5,l.title);
    assert.ok(l.questions.every(q=>q.choices.length===3&&q.correct>=0&&q.correct<=2));
    assert.ok(l.slides.every(s=>s.text.trim().length>=35&&s.focus.length>=2),l.title+" missing focus words or content");
    for(const q of l.questions){
      assert.ok(q.prompt.trim().length>8&&q.hint.trim().length>8,l.title+" missing prompt or explanation");
      assert.equal(new Set(q.choices.map(a=>a.trim().toLowerCase())).size,3,l.title+" duplicate answer options");
    }
    counted[l.level]++;
  }
  assert.deepEqual(counted,{1:44,2:44,3:24});
});
test("Reading skill checks always grade against one answer out of three",()=>{
  for(const l of BEGINNER_LESSONS){
    const perfectAnswers=l.questions.map(q=>q.correct);
    const perfectScore=perfectAnswers.reduce((sum,answer,i)=>sum+(answer===l.questions[i].correct?1:0),0);
    assert.equal(perfectScore,5,l.id);
    // Exactly four of five correct means the 80% pass threshold.
    const missed=perfectAnswers.map((answer,i)=>i===0?(answer+1)%3:answer);
    const passed=missed.filter((answer,i)=>answer===l.questions[i].correct).length;
    assert.equal(passed,4,l.id);
    assert.equal(Math.round(passed/l.questions.length*100),80,l.id);
  }
});
