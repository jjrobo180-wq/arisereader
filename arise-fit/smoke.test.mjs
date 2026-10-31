import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const src = readFileSync(new URL("./app.js", import.meta.url), "utf8");

function boot(saved) {
  const events = {};
  const storage = new Map(saved ? [["arise-fit-v1", JSON.stringify(saved)]] : []);
  const elements = {
    "#main": { innerHTML: "" },
    "#toast": { textContent:"", hidden:true },
    "#close-dialog": { addEventListener(){} },
    "#import-file": { addEventListener(){}, click(){} },
    "#entry-dialog": { close(){}, showModal(){}, querySelector(){ return {id:"", elements:{namedItem(){return {value:""};}}}; } }
  };
  const document = {
    querySelector(s) { if (!elements[s]) throw Error("Unknown selector " + s); return elements[s]; },
    querySelectorAll() { return []; },
    addEventListener(type, callback) { events[type] = callback; }
  };
  const localStorage = {
    getItem(k){ return storage.get(k) || null; },
    setItem(k,v){storage.set(k,v);}
  };
  const sandbox = {
    document, localStorage, window:{scrollTo(){},addEventListener(){}},
    navigator:{},location:{protocol:"file:"},console,
    setTimeout(){return 1;},clearTimeout(){},Date,Math,Number,
    FormData:class { constructor(form){this.data = form.fields;} entries(){return Object.entries(this.data)[Symbol.iterator]();} }
  };
  runInNewContext(src,sandbox,{filename:"arise-fit/app.js"});
  function submit(id,fields) {
    events.submit({target:{id,fields},preventDefault(){}});
  }
  function click(dataset,kind) {
    events.click({target:{closest(selector){
      return selector === kind ? {dataset} : null;
    }}});
  }
  function current(){return JSON.parse(storage.get("arise-fit-v1"));}
  return {elements,events,submit,click,current};
}

test("renders the standalone dashboard with no stored data",()=>{
  const app=boot();
  assert.match(app.elements["#main"].innerHTML,/Progress starts with showing up/);
  assert.match(app.elements["#main"].innerHTML,/Log food/);
});

test("food entry survives local persistence and is escaped",()=>{
  const app=boot();
  app.submit("food-form",{name:"<script>bad</script>",kcal:"220",protein:"18",carbs:"20",fat:"8",servings:"2",meal:"Lunch"});
  assert.equal(app.current().foods.length,1);
  assert.equal(app.current().foods[0].kcal,440);
  assert.doesNotMatch(app.elements["#main"].innerHTML,/<script>bad<\/script>/);
  assert.match(app.elements["#main"].innerHTML,/&lt;script&gt;bad/);
});

test("water and step goals are saved on device",()=>{
  const app=boot();
  app.click({action:"water"},"[data-action]");
  assert.ok(Object.values(app.current().water).includes(250));
  app.submit("steps-form",{steps:"9050"});
  assert.ok(Object.values(app.current().steps).includes(9050));
});

test("energy is zero without a weigh-in, then estimates after weigh-in",()=>{
  const app=boot();
  app.submit("workout-form",{activity:"0",minutes:"30"});
  assert.equal(app.current().workouts[0].kcal,0);
  app.submit("weight-form",{weight:"180"});
  app.submit("workout-form",{activity:"0",minutes:"30"});
  assert.ok(app.current().workouts[1].kcal>0);
});

test("tab navigation and settings form work",()=>{
  const app=boot();
  app.click({view:"settings"},"[data-view]");
  assert.match(app.elements["#main"].innerHTML,/Daily targets/);
  app.submit("goals-form",{name:"Alex",calories:"2400",protein:"160",water:"2800",steps:"9000",unit:"kg"});
  assert.equal(app.current().settings.name,"Alex");
  assert.equal(app.current().settings.calories,2400);
  app.click({view:"progress"},"[data-view]");
  assert.match(app.elements["#main"].innerHTML,/Food energy/);
});

test("invalid imported storage is ignored rather than causing a crash",()=>{
  const app=boot({version:1,settings:{},foods:[{date:"invalid",name:"garbage"}]});
  app.click({action:"water"},"[data-action]"); // Persist normalized in-memory data.
  assert.equal(app.current().foods.length,0);
  assert.match(app.elements["#main"].innerHTML,/ARISE FIT/);
});
