import { test, expect } from "@playwright/test";
import { BEGINNER_LESSONS } from "./lessons";

async function createLearner(page:any,name:string){
  await page.goto("/");
  await page.locator("#nickname").fill(name);
  await page.getByRole("button",{name:/Start Learning/}).click();
  await expect(page.getByText(new RegExp("Hey, "+name))).toBeVisible();
}
test("112 lessons: read, score, persist, and switch between library and swipe views",async({page})=>{
  await createLearner(page,"Reading QA");
  await expect(page.getByText("112",{exact:true}).first()).toBeVisible();
  await page.getByRole("button",{name:"Lesson Library",exact:true}).first().click();
  await expect(page.getByText(/112 lessons found/)).toBeVisible();
  await expect(page.locator(".lesson-grid .lesson-card")).toHaveCount(24);
  await page.getByRole("button",{name:/Load 24 more lessons/}).click();
  await expect(page.locator(".lesson-grid .lesson-card")).toHaveCount(48);
  const l=BEGINNER_LESSONS.find(x=>x.id==="original-the-caitlin-court-plan")!;
  await page.getByRole("textbox",{name:"Search lessons"}).fill(l.title);
  await expect(page.locator(".lesson-grid .lesson-card")).toHaveCount(1);
  await page.getByRole("button",{name:"Start "+l.title}).click();
  await expect(page.getByRole("dialog",{name:l.title})).toBeVisible();
  for(let i=0;i<l.slides.length;i++){
    await expect(page.getByRole("heading",{name:l.slides[i].heading})).toBeVisible();
    await page.getByRole("button",{name:i===l.slides.length-1?"Start Skill Check":"Continue",exact:false}).click();
  }
  for(let i=0;i<l.questions.length;i++){
    await expect(page.getByRole("heading",{name:l.questions[i].prompt})).toBeVisible();
    await page.locator(".options .option").nth(l.questions[i].correct).click();
    await page.getByRole("button",{name:i===l.questions.length-1?"Finish Lesson":"Continue",exact:false}).click();
  }
  await expect(page.getByRole("heading",{name:"You earned that win!"})).toBeVisible();
  await expect(page.locator(".earn-note")).toContainText("+10");
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
});
test("Mobile swipe navigation remains accessible and does not award watching points",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await createLearner(page,"Mobile QA");
  await page.locator(".mobile-bottom").getByRole("button",{name:"Swipe"}).click();
  await expect(page.locator(".swipe-poster")).toBeVisible();
  await expect(page.locator(".points-pill strong")).toHaveText("0");
  await page.getByRole("button",{name:"Next lesson",exact:true}).click();
  await expect(page.locator(".swipe-counter span").last()).toContainText("2 /");
  await expect(page.locator(".points-pill strong")).toHaveText("0");
  await page.locator(".swipe-start").click();
  await expect(page.locator(".lesson-overlay")).toBeVisible();
  await page.getByRole("button",{name:"Exit Lesson"}).click();
  await page.locator(".mobile-bottom").getByRole("button",{name:"Library"}).click();
  await expect(page.locator(".lesson-grid .lesson-card")).toHaveCount(24);
});
test("Profile progress can be backed up privately after earning points",async({page})=>{
  await createLearner(page,"Backup QA");
  await page.getByRole("button",{name:"My Progress"}).first().click();
  const dl=page.waitForEvent("download");
  await page.getByRole("button",{name:"Download backup"}).click();
  const file=await dl;
  expect(file.suggestedFilename()).toMatch(/^arise-beginners-.*-progress\.json$/);
  await expect(page.getByRole("status")).toContainText("Backup downloaded");
});