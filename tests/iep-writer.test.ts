import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  IEP_STEPS, areaOptions, assessmentOptions, accOptions, checkRubric, cleanIepDrafts, iepText, isTransition, lreOf, newIepDraft, newNeed,
  scoreRubric, servicesOf, visibleSteps, writeIep, type IepDraft,
} from "../shared/iepWriter";
import { normalizeWorkspace } from "../shared/teacherHub";
import { GUIDE_TEMPLATE } from "../shared/hubGuide";

let n = 0;
const makeId = () => `id${n++}`;

function fullDraft(): IepDraft {
  const d = newIepDraft("Jordan Lee", makeId);
  Object.assign(d.a, {
    age: "12", grade: "7", school: "DSST: Cole", meetingDate: "2026-10-30", prevIep: "2025-11-01", evalDate: "2024-10-15",
    dis1: "Specific Learning Disability", dis2: "Other Health Impairment", referral: "a teacher referral after interventions", studentInput: "a student interest survey",
    parentMethod: "a phone call with the case manager", parentStrengths: "helpful at home", parentAttend: "Yes",
    behaviorImpedes: "No", bip: "No", vision: "No", hearing: "No", deafblind: "No", communication: "No", mll: "No", at: "No", transport: "No", health: "No",
    extraAcc: "No accommodations are needed for extracurricular or non-academic activities.", eeo: "No", indirect: "30 minutes per month", nonacademic: "will take part fully",
    esyRegression: "No", esyEmerging: "No", esyPredictive: "No", esyEligible: "No",
    chkProof: "Yes", chkSignatures: "Yes", chkNotice: "Yes", chkFinal: "Yes", chkReports: "Yes",
  });
  d.m = {
    sldAreas: ["Basic Reading Skills"], strengths: ["creative"], interests: ["sports"], learns: ["with visuals and models"], sources: ["i-Ready Reading", "CMAS", "Attendance"],
    interventions: ["Tier 2 reading intervention"], parentConcerns: ["reading"], accs: ["readaloud", "extratime"], assessments: ["CMAS ELA"],
    participants: ["Parent/guardian", "General education teacher", "Special education teacher / case manager"],
    lreConsidered: ["General education with push-in support", "General education with some pull-out support"],
    optionsRejected: ["Dismissal from special education"], otherFactors: ["Attendance affects access to instruction"],
  };
  const a = newNeed("decode", makeId); Object.assign(a, { baseline: "45", target: "80", minutes: "120", where: "sped" }); d.needs.push(a);
  const b = newNeed("ef", makeId); Object.assign(b, { baseline: "40", target: "80", minutes: "60", where: "gen" }); d.needs.push(b);
  d.prior.push({ id: "p1", area: "Reading", status: "made some progress", data: "From 30% to 45% on decoding probes." });
  return d;
}

test("it starts from the student's name and info, and the drop boxes adjust to the student", () => {
  const d = newIepDraft("  Maya   Torres ", makeId, { grade: "4", dis1: "Speech or Language Impairment" });
  assert.equal(d.student, "Maya Torres");
  assert.equal(d.a.grade, "4");
  // areas of need follow the disability
  assert.equal(areaOptions(d)[0].suggested, true);
  assert.ok(areaOptions(d).filter((o) => o.suggested).some((o) => o.id === "language"));
  assert.ok(!areaOptions(d).filter((o) => o.suggested).some((o) => o.id === "mathcalc"));
  // initial IEPs skip last year's goals; grade 9+ or age 15+ gets transition
  assert.ok(visibleSteps(d).some((s) => s.id === "prior"));
  d.a.type = "Initial IEP";
  assert.ok(!visibleSteps(d).some((s) => s.id === "prior"));
  assert.ok(!isTransition(d) && !visibleSteps(d).some((s) => s.id === "transition"));
  d.a.grade = "9";
  assert.ok(visibleSteps(d).some((s) => s.id === "transition"));
  // assessments follow grade and alternate status
  d.a.grade = "5";
  assert.ok(assessmentOptions(d).includes("CMAS ELA") && assessmentOptions(d).some((x) => x.startsWith("CMAS Science")));
  d.a.eeo = "Yes";
  assert.ok(assessmentOptions(d).includes("CoAlt ELA") && !assessmentOptions(d).includes("CMAS ELA"));
  // accommodations suggested by the needs come first
  d.needs.push(newNeed("mathcalc", makeId));
  assert.deepEqual(new Set(accOptions(d).slice(0, 5)), new Set(["calculator", "multchart", "formula", "extratime", "chunk"]));
});

test("every step's drop boxes are real choices, and every rubric item points to a step", () => {
  const d = fullDraft();
  const ids = new Set(IEP_STEPS.map((s) => s.id));
  for (const s of IEP_STEPS) for (const f of s.fields) if (f.kind === "select") assert.ok(typeof f.options === "function" || (f.options || []).length >= 2, `${s.id}.${f.id}`);
  for (const i of checkRubric(d)) assert.ok(ids.has(i.step), `${i.id} -> ${i.step}`);
});

test("the picks are written into the full IEP in the template's order", () => {
  const d = fullDraft();
  const titles = writeIep(d).map((s) => s.id);
  assert.deepEqual(titles.slice(0, 7), ["strengths", "eval", "current", "progress", "data", "parent", "impact"]);
  const text = iepText(d);
  assert.match(text, /Jordan Lee is a 12-year-old 7th grade student who attends DSST: Cole in Denver, CO\. His primary language is English\./);
  assert.match(text, /By October 29, 2027, when given a list of 20 unfamiliar decodable words, Jordan will decode multisyllable words .* with 80% accuracy, as measured by Really Great Reading decoding surveys collected every two weeks\./);
  assert.match(text, /in 80% of assignments/);
  assert.match(text, /Jordan's Other Health Impairment affects his ability to keep track of assignments/, "each need credits the disability it comes from");
  assert.match(text, /To be delivered for the school year only excluding school breaks, summers, holidays and non-student contact days\./);
  assert.match(text, /Objective 1a: By April 30, 2027/);
  assert.match(text, /Jordan is not eligible for ESY/);
  assert.match(text, /Option considered: Dismissal from special education\. Rejected because/);
  assert.doesNotMatch(text, /undefined|NaN|\{name\}|his or her/);
  // services and LRE add up from the needs
  assert.deepEqual(servicesOf(d).map((r) => [r.where, r.minutes]), [["sped", 120], ["gen", 60]]);
  const lre = lreOf(d);
  assert.equal(lre.outside, 120);
  assert.equal(lre.pct, 94.3);
  assert.match(lre.category, /^1 /);
  // pronouns follow the pick
  d.a.pronouns = "they/them";
  assert.match(iepText(d), /Their primary language/);
});

test("the rubric check scores like the IEP Quality Rubric: N/A items aren't counted, missing items say how to fix them", () => {
  const d = fullDraft();
  const r = scoreRubric(d);
  assert.equal(r.passed, r.applicable, r.items.filter((i) => i.result === false).map((i) => i.id).join(", "));
  assert.equal(r.score, 10);
  assert.match(r.band, /Exceptional/);
  assert.ok(r.items.filter((i) => i.part === "Part 6: Transition").every((i) => i.result === null), "a 7th grader's transition items are N/A");

  const empty = newIepDraft("Sam", makeId);
  const e = scoreRubric(empty);
  assert.ok(e.score < 5 && /deficient/.test(e.band));
  assert.ok(e.items.filter((i) => i.result === false).every((i) => i.fix.length > 5));
  // required items from the rubric are marked
  assert.ok(checkRubric(empty).filter((i) => i.required).length >= 20);

  // behavior that impedes learning needs a goal or a BIP
  d.a.behaviorImpedes = "Yes";
  assert.equal(checkRubric(d).find((i) => i.id === "behavior")!.result, false);
  d.a.bip = "Yes";
  assert.equal(checkRubric(d).find((i) => i.id === "behavior")!.result, true);
  // an accommodation not tied to any need is flagged
  d.m.accs = [...d.m.accs, "calculator"];
  assert.equal(checkRubric(d).find((i) => i.id === "linked")!.result, false);
});

test("drafts are saved with the workspace and cleaned when read", () => {
  const d = fullDraft();
  const ws = normalizeWorkspace({ iepDrafts: [d, { junk: true }, { id: "x", a: { ok: "y", bad: 5 }, m: { list: ["a", 2] }, needs: [{ id: "n", where: "moon" }] }] });
  assert.equal(ws.iepDrafts!.length, 2);
  assert.deepEqual(ws.iepDrafts![0], d);
  assert.deepEqual(ws.iepDrafts![1].a, { ok: "y" });
  assert.deepEqual(ws.iepDrafts![1].m, { list: ["a"] });
  assert.equal(ws.iepDrafts![1].needs[0].where, "");
  assert.deepEqual(cleanIepDrafts("nope"), []);
  assert.ok(JSON.stringify(d).length < 6000, "a draft is small");
});

test("the writer opens from step 7 and from the checklist, and the checklist covers writing the IEP", () => {
  const steps = readFileSync(new URL("../client/src/components/teacher-hub/HubMeetingSteps.tsx", import.meta.url), "utf8");
  assert.match(steps, /step === 7 && meeting && <IepWriterLauncher/);
  const guide = readFileSync(new URL("../client/src/components/teacher-hub/HubGuide.tsx", import.meta.url), "utf8");
  assert.match(guide, /<IepWriterLauncher/);
  const doc = GUIDE_TEMPLATE.find((s) => s.title === "IEP document")!.steps.join(" ");
  for (const word of ["3 weeks", "2.5 weeks", "observations", "special consideration", "2 objectives", "ESY", "Prior Written Notice", "Transition", "rubric", "Proofread"]) assert.ok(doc.includes(word), word);
  assert.ok(GUIDE_TEMPLATE.some((s) => s.title === "After the meeting" && s.steps.some((x) => /within one week/.test(x))));
});
