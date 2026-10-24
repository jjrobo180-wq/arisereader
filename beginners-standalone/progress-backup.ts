// Backups are an explicit, offline user action. They never contact A.R.I.S.E. Reader.
import { BEGINNER_LESSONS } from "./lessons";
export type LocalPhonics = {buildsCompleted:3;correctOnFirstCheck:number;checks:number};
export type LocalAttempt = {bestScore:number;lastScore:number;attempts:number;passedAt:string|null;phonics?:LocalPhonics};
export type LocalProgress = {attempts:Record<string,LocalAttempt>;saved:string[];theme:string;browseView?:"lessons"|"swipe"};
const IDS=new Set(BEGINNER_LESSONS.map(l=>l.id));
const THEMES=new Set(["reader","midnight","aurora","sunset"]);
const MAX_SIZE=1024*1024;
type Backup={format:"arise-beginners-progress";version:1;exportedAt:string;nickname:string;progress:LocalProgress};
export function exportProgress(nickname:string,progress:LocalProgress):string {
  const payload:Backup={format:"arise-beginners-progress",version:1,exportedAt:new Date().toISOString(),nickname:nickname.slice(0,32),progress};
  return JSON.stringify(payload,null,2);
}
function score(value:unknown):number {
  if(!Number.isFinite(value)||typeof value!=="number"||value<0||value>100)throw Error("Invalid lesson score");
  return Math.round(value);
}
export function importProgress(text:string):{nickname:string;progress:LocalProgress}{
  if(typeof text!=="string"||text.length>MAX_SIZE)throw Error("This backup is too large or invalid.");
  let b:any;
  try{b=JSON.parse(text)}catch{throw Error("That file is not valid JSON.")}
  if(b?.format!=="arise-beginners-progress"||b.version!==1||typeof b.nickname!=="string"||!b.progress||typeof b.progress!=="object")throw Error("This is not an A.R.I.S.E. Beginners progress backup.");
  const source=b.progress.attempts;
  if(!source||typeof source!=="object"||Array.isArray(source))throw Error("Invalid lesson progress records.");
  if(Object.keys(source).length>BEGINNER_LESSONS.length)throw Error("Unexpected number of lesson records.");
  const attempts:Record<string,LocalAttempt>={};
  for(const [id,value] of Object.entries(source)){
    if(!IDS.has(id))continue; // Old or unknown lessons do not get credited.
    const rec=value as Record<string,unknown>;
    if(!rec||typeof rec!=="object")throw Error("Invalid lesson record");
    const count=rec.attempts;
    if(typeof count!=="number"||!Number.isInteger(count)||count<0||count>9999)throw Error("Invalid attempt count");
    const passed=rec.passedAt;
    if(passed!==null&&(typeof passed!=="string"||!Number.isFinite(Date.parse(passed))||passed.length>40))throw Error("Invalid pass date");
    attempts[id]={attempts:count,bestScore:score(rec.bestScore),lastScore:score(rec.lastScore),passedAt:passed as string|null};
    if(rec.phonics!==undefined){
      const p=rec.phonics as Record<string,unknown>;
      if(!p||typeof p!=="object"||p.buildsCompleted!==3||
        !Number.isInteger(p.correctOnFirstCheck)||typeof p.correctOnFirstCheck!=="number"||
        p.correctOnFirstCheck<0||p.correctOnFirstCheck>3||
        !Number.isInteger(p.checks)||typeof p.checks!=="number"||p.checks<3||p.checks>10000){
        throw Error("Invalid phonics building record.");
      }
      attempts[id].phonics={buildsCompleted:3,correctOnFirstCheck:p.correctOnFirstCheck,checks:p.checks};
    }
    if(attempts[id].passedAt&&attempts[id].bestScore<80)throw Error("A passed lesson must have a best score of at least 80%.");
  }
  const rawSaved=b.progress.saved;
  if(!Array.isArray(rawSaved)||rawSaved.length>BEGINNER_LESSONS.length||!rawSaved.every(x=>typeof x==="string"))throw Error("Invalid saved lesson list");
  return {nickname:b.nickname.slice(0,32),progress:{
    attempts,
    saved:[...new Set(rawSaved.filter((id:string)=>IDS.has(id)))],
    theme:THEMES.has(b.progress.theme)?b.progress.theme:"reader",
    browseView:b.progress.browseView==="swipe"?"swipe":"lessons"
  }};
}
