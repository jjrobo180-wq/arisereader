export type Level="K-2"|"3-5"|"6-8"|"9-12";
export type Team="blue"|"gold";
export type Hand="rock"|"paper"|"scissors";
export type Q={q:string;a:string[];correct:number};
export const BANK:Record<Level,Q[]>={"K-2":[{q:"What is 4 + 3?",a:["6","7","8","9"],correct:1},{q:"Which word rhymes with cat?",a:["dog","hat","sun","red"],correct:1},{q:"What is 10 - 2?",a:["6","7","8","9"],correct:2}],"3-5":[{q:"What is 8 × 6?",a:["42","46","48","54"],correct:2},{q:"Which is a synonym for happy?",a:["Glad","Angry","Tiny","Slow"],correct:0},{q:"What is 3/4 of 20?",a:["10","12","15","18"],correct:2}],"6-8":[{q:"Solve: 3x + 5 = 20",a:["3","5","7","15"],correct:1},{q:"What is 25% of 80?",a:["10","20","25","40"],correct:1},{q:"Which word is an adjective?",a:["Run","Quickly","Bright","Under"],correct:2}],"9-12":[{q:"Solve x² - 9 = 0. Positive solution?",a:["1","3","6","9"],correct:1},{q:"What is the slope between (0,2) and (4,10)?",a:["1","2","4","8"],correct:1},{q:"Which is a metaphor?",a:["Cold as ice","Time is a thief","He ran quickly","The dog barked"],correct:1}]};
export const EVENTS=['points','safe','steal','shield','power','rps','bonus'] as const;
export type SpaceEvent=typeof EVENTS[number];
export const SPACE_LABELS:Record<SpaceEvent,string>={points:'+50 POINTS',safe:'SAFE SPACE',steal:'POINT STEAL',shield:'SHIELD',power:'POWER +2',rps:'ROCK PAPER SCISSORS',bonus:'JACKPOT +100'};
export const HANDS:Hand[]=['rock','paper','scissors'];
export const TIMING={introPlayer:1100,introHold:700,roll:2800,reveal:900,step:650,landing:1400,reward:3000,countdown:3000,duelResult:2800};
export type Player={id:number;name:string;characterId:string;team:Team;space:number;strikes:number;shield:number;power:number;out:boolean;bot:boolean};
export type Cue={id:number;kind:'move'|'strike'|'duel';startAt:number;actor:number;from:number;to:number;raw:number;bonus:number;steps:number;event:SpaceEvent;rival?:number;hands?:[Hand,Hand];duelWinner?:number|null;title?:string;deltas?:{blue:number;gold:number};blocked?:boolean};
export type Phase='lobby'|'intro'|'question'|'cinematic'|'rps'|'finished';
export type View={code:string;hostId:number;level:Level;players:Player[];turn:number;phase:Phase;phaseAt:number;serverNow:number;scores:Record<Team,number>;cue:Cue|null;question:{id:number;q:string;a:string[]}|null;winner:string|null;rpsReady:number[];rpsDeadline:number;revision:number};
export function moveLandingAt(cue:Cue){return cue.startAt+TIMING.roll+TIMING.reveal+(cue.to-cue.from)*TIMING.step;}
export function rpsWinner(a:Hand,b:Hand):0|1|null{return a===b?null:((a==='rock'&&b==='scissors')||(a==='paper'&&b==='rock')||(a==='scissors'&&b==='paper'))?0:1;}
export const BOARD_LAST_SPACE=55;
const SKY_PATH=[
 [-36,24],[-34,22],[-32,20],[-30,18],[-28,16],[-26,14],[-24,12],[-22,10],[-21,8],[-20,6],[-19,4],
 [-20,1],[-21,-2],[-22,-5],[-23,-8],[-23,-11],[-22,-14],[-20,-17],[-17,-20],
 [-14,-19],[-11,-17],[-8,-15],[-6,-12],[-4,-9],[-3,-6],[-2,-4],[0,-2],
 [4,-3],[8,-4],[12,-5],[16,-6],[19,-7],[22,-8],[25,-9],[27,-10],[29,-9],[30,-7],[31,-5],
 [32,-2],[33,1],[32,4],[30,7],
 [27,10],[24,13],[21,17],[18,20],[15,22],[12,24],[10,25],[8,24],[7,21],
 [12,17],[18,12],[24,6],[30,-2],[38,-14]
] as const;
export function boardPosition(space:number){const p=SKY_PATH[Math.max(0,Math.min(SKY_PATH.length-1,space))];return {x:p[0]*1.18,z:p[1]*1.18};}}
export function cueStage(cue:Cue|null,now:number){
 if(!cue)return 'idle';const t=now-cue.startAt;
 if(cue.kind==='strike')return 'reward';
 if(cue.kind==='duel')return t<TIMING.countdown?'countdown':'duel-result';
 if(t<TIMING.roll)return 'roll';if(t<TIMING.roll+TIMING.reveal)return 'reveal';
 if(now<moveLandingAt(cue))return 'move';if(now<moveLandingAt(cue)+TIMING.landing)return 'landing';return 'reward';
}
