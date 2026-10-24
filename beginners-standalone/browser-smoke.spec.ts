import { test, expect } from "@playwright/test";
import { BEGINNER_LESSONS, type BeginnerLesson } from "./lessons";
import { getPhonicsActivity, tileChoices } from "./phonics-curriculum";

async function createLearner(page:any,name:string){
  await page.goto("/");
  await page.locator("#nickname").fill(name);
  await page.getByRole("button",{name:/Start Learning/}).click();
  await expect(page.getByText(new RegExp("Hey, "+name))).toBeVisible();
}
async function buildTileWord(page:any,parts:string[]){
  for(let i=0;i<parts.length;i++){
    const present=(await page.locator(".phonics-slots .phonics-slot").nth(i).textContent())?.trim();
    // A true word chain preserves unchanged grapheme tiles between challenges.
    if(present===parts[i])continue;
    const buttons=page.locator(".phonics-tiles .phonics-tile:not([disabled])").filter({hasText:new RegExp("^"+parts[i]+"$")});
    await buttons.first().click();
  }
  await page.getByRole("button",{name:"Check Word"}).click();
  await expect(page.locator(".phonics-feedback.correct")).toContainText("Yes!");
}
async function finishSoundLab(page:any,lesson:BeginnerLesson,wrongOnFirst=false){
  const activity=getPhonicsActivity(lesson,BEGINNER_LESSONS.findIndex(l=>l.id===lesson.id));
  await expect(page.getByRole("heading",{name:activity.title})).toBeVisible();
  await expect(page.locator(".lesson-footer")).toHaveCount(0);
  await page.getByRole("button",{name:/Your Turn: Build Words/}).click();
  for(let i=0;i<3;i++){
    const word=activity.wordBuilds[i];
    if(i===0&&wrongOnFirst){
      const decoy=tileChoices(word,activity.wordBuilds).find(t=>!word.parts.includes(t.text))!;
      await page.getByRole("button",{name:"Add tile "+decoy.text,exact:true}).click();
      for(const part of word.parts.slice(1)){
        await page.locator(".phonics-tiles .phonics-tile:not([disabled])").filter({hasText:new RegExp("^"+part+"$")}).first().click();
      }
      await page.getByRole("button",{name:"Check Word"}).click();
      await expect(page.locator(".phonics-feedback.retry")).toContainText("Not yet.");
      await page.getByRole("button",{name:"Clear"}).click();
    }
    await buildTileWord(page,word.parts);
    await page.getByRole("button",{name:i===2?"Practice Reading":"Next Word"}).click();
    if(i===0&&activity.unit<=8&&word.parts.length===activity.wordBuilds[1].parts.length&&
      word.parts.filter((part,k)=>part!==activity.wordBuilds[1].parts[k]).length===1){
      await expect(page.locator(".phonics-slots .phonics-slot.filled")).toHaveCount(word.parts.length-1);
      await expect(page.locator(".phonics-slots .phonics-slot:not(.filled)")).toHaveCount(1);
    }
  }
  await expect(page.getByRole("heading",{name:"Now read what you built."})).toBeVisible();
  await page.getByRole("button",{name:/Continue to Supported Reading/}).click();
  await expect(page.locator(".lesson-footer")).toBeVisible();
}
async function finishQuiz(page:any,lesson:BeginnerLesson){
  for(let i=0;i<lesson.slides.length;i++){
    await expect(page.getByRole("heading",{name:lesson.slides[i].heading})).toBeVisible();
    await page.getByRole("button",{name:i===lesson.slides.length-1?"Start Skill Check":"Continue",exact:false}).click();
  }
  for(let i=0;i<lesson.questions.length;i++){
    await expect(page.getByRole("heading",{name:lesson.questions[i].prompt})).toBeVisible();
    await page.locator(".options .option").nth(lesson.questions[i].correct).click();
    await page.getByRole("button",{name:i===lesson.questions.length-1?"Finish Lesson":"Continue",exact:false}).click();
  }
}
test("All 112 lessons are browsable; real phonics word building gates the quiz and preserves points",async({page})=>{
  await createLearner(page,"Reading QA");
  await expect(page.getByText("112",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:"Lesson Library",exact:true}).first().click();
  await expect(page.getByText(/112 lessons found/)).toBeVisible();
  await expect(page.locator(".lesson-grid .lesson-card")).toHaveCount(24);
  await page.getByRole("button",{name:/Load 24 more lessons/}).click();
  await expect(page.locator(".lesson-grid .lesson-card")).toHaveCount(48);
  const lesson=BEGINNER_LESSONS.find(l=>l.id==="original-the-caitlin-court-plan")!;
  await page.getByRole("textbox",{name:"Search lessons"}).fill(lesson.title);
  await expect(page.locator(".lesson-grid .lesson-card")).toHaveCount(1);
  await page.getByRole("button",{name:"Start "+lesson.title}).click();
  await expect(page.getByRole("dialog",{name:lesson.title})).toBeVisible();
  await finishSoundLab(page,lesson,true);
  await finishQuiz(page,lesson);
  await expect(page.getByRole("heading",{name:"You earned that win!"})).toBeVisible();
  await expect(page.locator(".earn-note")).toContainText("+10");
  await expect(page.locator(".phonics-score-pill")).toContainText("2/3 first-try builds");
  await page.getByRole("button",{name:/Back to Library/}).click();
  await expect(page.locator(".points-pill strong")).toHaveText("10");
  await page.locator(".header-links").getByRole("button",{name:"Swipe Feed"}).click();
  await expect(page.locator(".swipe-poster")).toBeVisible();
  const initialCounter=await page.locator(".swipe-counter span").last().textContent();
  await page.getByRole("button",{name:"Next lesson",exact:true}).click();
  await expect(page.locator(".swipe-counter span").last()).not.toHaveText(initialCounter||"");
  await page.reload();
  await expect(page.locator(".points-pill strong")).toHaveText("10");
  await page.getByRole("button",{name:"My Progress"}).first().click();
  await expect(page.locator(".progress-row .progress-status.complete")).toHaveCount(1);
  await expect(page.locator(".progress-row").filter({hasText:lesson.title})).toContainText("Word builds 3/3");
});
test("Mobile swipe lessons begin with accessible sound teaching, not immediate quizzes",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await createLearner(page,"Mobile QA");
  await page.locator(".mobile-bottom").getByRole("button",{name:"Swipe"}).click();
  await expect(page.locator(".swipe-poster")).toBeVisible();
  await expect(page.locator(".points-pill strong")).toHaveText("0");
  await page.getByRole("button",{name:"Next lesson",exact:true}).click();
  await expect(page.locator(".swipe-counter span").last()).toContainText("2 /");
  await expect(page.locator(".points-pill strong")).toHaveText("0");
  await page.locator(".swipe-start").click();
  await expect(page.locator(".phonics-lab")).toBeVisible();
  await expect(page.locator(".lesson-footer")).toHaveCount(0);
  await page.getByRole("button",{name:/Your Turn: Build Words/}).click();
  await expect(page.locator(".phonics-sound-grid")).toBeVisible();
  await page.getByRole("button",{name:"Exit Lesson"}).click();
  await page.locator(".mobile-bottom").getByRole("button",{name:"Library"}).click();
  await expect(page.locator(".lesson-grid .lesson-card")).toHaveCount(24);
});
test("Digraphs work as one grapheme tile and same quiz is impossible before three builds",async({page})=>{
  await createLearner(page,"Phonics QA");
  await page.getByRole("button",{name:"Lesson Library",exact:true}).first().click();
  const lesson=BEGINNER_LESSONS.find(l=>l.id==="original-shop-the-new-sound")!;
  await page.getByRole("textbox",{name:"Search lessons"}).fill(lesson.title);
  await page.getByRole("button",{name:"Start "+lesson.title}).click();
  await expect(page.getByRole("heading",{name:/Digraphs: two letters can spell one sound/})).toBeVisible();
  await page.getByRole("button",{name:/Your Turn: Build Words/}).click();
  await expect(page.getByRole("button",{name:"Add tile sh",exact:true})).toBeVisible();
  await expect(page.locator(".lesson-footer")).toHaveCount(0);
  const activity=getPhonicsActivity(lesson,BEGINNER_LESSONS.findIndex(l=>l.id===lesson.id));
  await buildTileWord(page,activity.wordBuilds[0].parts);
  await expect(page.getByRole("button",{name:"Next Word"})).toBeVisible();
});

test("Medium digraph and Hard morphology lessons require phonics practice and award 20/30 only once",async({page})=>{
  await createLearner(page,"Levels QA");
  await page.getByRole("button",{name:"Lesson Library",exact:true}).first().click();
  const medium=BEGINNER_LESSONS.find(l=>l.id==="original-shop-the-new-sound")!;
  const hard=BEGINNER_LESSONS.find(l=>l.id==="original-the-highlight-evidence-hunt")!;
  for(const [lesson,earned] of [[medium,20],[hard,30]] as [BeginnerLesson,number][]){
    await page.getByRole("textbox",{name:"Search lessons"}).fill(lesson.title);
    await page.getByRole("button",{name:"Start "+lesson.title}).click();
    await expect(page.locator(".lesson-footer")).toHaveCount(0);
    await finishSoundLab(page,lesson);
    await finishQuiz(page,lesson);
    await expect(page.locator(".earn-note")).toContainText("+"+earned);
    await page.getByRole("button",{name:/Back to Library/}).click();
  }
  await expect(page.locator(".points-pill strong")).toHaveText("50");
  await page.reload();
  await expect(page.locator(".points-pill strong")).toHaveText("50");
});
test("Offline learner progress can be backed up",async({page})=>{
  await createLearner(page,"Backup QA");
  await page.getByRole("button",{name:"My Progress"}).first().click();
  const dl=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download backup"}).click();
  const file=await dl;
  expect(file.suggestedFilename()).toMatch(/^arise-beginners-.*-progress\.json$/);
  await expect(page.getByRole("status")).toContainText("Backup downloaded");
});