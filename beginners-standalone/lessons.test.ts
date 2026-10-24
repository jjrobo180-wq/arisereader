import { test } from "node:test";
import { strict as assert } from "node:assert";
import { BEGINNER_LESSONS } from "./lessons";

test("independent A.R.I.S.E. Beginners has 112 unique lesson quizzes", () => {
  assert.equal(BEGINNER_LESSONS.length, 112);
  assert.equal(new Set(BEGINNER_LESSONS.map(l=>l.id)).size, BEGINNER_LESSONS.length);
  for(const l of BEGINNER_LESSONS){
    assert.ok(l.slides.length>=2,l.id+" needs actual teaching");
    assert.equal(l.questions.length,5,l.id+" needs five scored questions");
    assert.ok(l.questions.every(q=>q.choices.length===3&&q.correct>=0&&q.correct<=2));
    assert.ok(l.slides.every(s=>s.text.trim().length>=35&&s.focus.length>=2));
  }
});
test("Easy, Medium, and Hard award exactly 10, 20 and 30 points", () => {
  const points:Record<number,number>={1:10,2:20,3:30};
  const found=new Set<number>();
  for(const l of BEGINNER_LESSONS){assert.equal(l.points,points[l.level],l.id);found.add(l.level)}
  assert.deepEqual([...found].sort(),[1,2,3]);
});
test("Starter topics are varied and reading lessons are distinct",()=>{
  const categories=new Set(BEGINNER_LESSONS.map(l=>l.category));
  assert.ok(categories.has("Sports")&&categories.has("Music")&&categories.has("Creators"));
  assert.equal(new Set(BEGINNER_LESSONS.map(l=>l.title)).size,BEGINNER_LESSONS.length);
  for(const l of BEGINNER_LESSONS){
    assert.ok(!l.slides.some(s=>/arise reader account/i.test(s.text)),l.id);
  }
});
