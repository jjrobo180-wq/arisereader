import {test} from "node:test";
import {strict as assert} from "node:assert";
import {BEGINNER_LESSONS} from "./lessons";
import {exportProgress,importProgress} from "./progress-backup";
const first=BEGINNER_LESSONS[0];
test("Valid backups restore the exact learner-specific scores, themes and saved lessons",()=>{
  const progress={attempts:{[first.id]:{bestScore:100,lastScore:80,attempts:2,passedAt:"2026-10-23T18:00:00.000Z",phonics:{buildsCompleted:3 as const,correctOnFirstCheck:2,checks:4}}},saved:[first.id],theme:"aurora",browseView:"swipe" as const};
  const text=exportProgress("Reader 1",progress);
  const result=importProgress(text);
  assert.equal(result.nickname,"Reader 1");
  assert.deepEqual(result.progress,progress);
});
test("Backups reject corrupted data, out-of-range grades and suspicious pass records",()=>{
  assert.throws(()=>importProgress("not json"));
  assert.throws(()=>importProgress(JSON.stringify({format:"arise-beginners-progress",version:2,nickname:"X",progress:{}})));
  const base=JSON.parse(exportProgress("Test",{attempts:{},saved:[],theme:"reader"}));
  base.progress.attempts[first.id]={bestScore:70,lastScore:70,attempts:1,passedAt:"2026-10-23T18:00:00.000Z"};
  assert.throws(()=>importProgress(JSON.stringify(base)),/at least 80/);
  base.progress.attempts[first.id].bestScore=101;
  assert.throws(()=>importProgress(JSON.stringify(base)),/score/);
});
test("Backups cannot credit unknown lesson IDs",()=>{
  const base=JSON.parse(exportProgress("Reader",{attempts:{},saved:[],theme:"reader"}));
  base.progress.attempts.unknown={bestScore:100,lastScore:100,attempts:1,passedAt:"2026-10-23T18:00:00.000Z"};
  base.progress.saved=["unknown",first.id];
  const result=importProgress(JSON.stringify(base));
  assert.equal(Object.keys(result.progress.attempts).length,0);
  assert.deepEqual(result.progress.saved,[first.id]);
});
