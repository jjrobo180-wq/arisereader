import {BANK,BOARD_LAST_SPACE,EVENTS,HANDS,TIMING,moveLandingAt,rpsWinner,safeTeamName,type Team,type Level,type Player,type Cue,type Hand,type View,type Q,type TutorialResult} from '../shared/boardQuest';
export class BoardQuestGame {
 view:View;private question:Q|null=null;private choices=new Map<number,Hand>();private openingChoices=new Map<number,Hand>();private awarded=false;private nextId=1;
 touched=Date.now();private humansSeen=new Map<number,number>();
 constructor(code:string,host:Player,level:Level,private random:()=>number=Math.random){this.view={code,hostId:host.id,level,players:[host],turn:0,phase:'lobby',phaseAt:0,serverNow:0,scores:{blue:0,gold:0},cue:null,question:null,winner:null,rpsReady:[],rpsDeadline:0,openingRolls:{},openingTotals:{blue:0,gold:0},startingTeam:null,openingReady:[],openingHands:{},openingScores:{},openingWinner:null,openingTied:[],openingRandomized:false,openingDeadline:0,openingResolvedAt:0,revision:0,teamNames:{blue:"Blue Readers",gold:"Golden Hornets"},captains:{blue:host.id,gold:null},fillCpu:true,publicLobby:false,tutorialId:0,tutorialReady:[],tutorialResults:{}};}
 member(id:number){return this.view.players.some(p=>p.id===id&&!p.bot);}
 touch(id:number,now:number){this.touched=now;this.humansSeen.set(id,now);}
 add(p:Player){if(this.member(p.id))return;if(this.view.phase!=='lobby')throw Error('This game has already started.');if(this.view.players.length>=6)throw Error('This room is full.');const blue=this.view.players.filter(x=>x.team==='blue').length,gold=this.view.players.filter(x=>x.team==='gold').length;p.team=blue<=gold?'blue':'gold';this.view.players.push(p);this.syncCaptains();this.view.revision++;}
 private syncCaptains(){for(const team of ['blue','gold'] as Team[]){const members=this.view.players.filter(p=>p.team===team&&!p.bot);if(!members.some(p=>p.id===this.view.captains[team]))this.view.captains[team]=members[0]?.id??null;}const host=this.view.players.find(p=>p.id===this.view.hostId);if(host)this.view.captains[host.team]=host.id;}
 configure(id:number,settings:{level?:Level;fillCpu?:boolean}){if(id!==this.view.hostId)throw Error('Only the first player can change the settings.');if(this.view.phase!=='lobby')throw Error('Settings are locked after the game starts.');if(settings.level!==undefined){if(!Object.hasOwn(BANK,settings.level))throw Error('Choose a learning level.');this.view.level=settings.level;}if(settings.fillCpu!==undefined){if(typeof settings.fillCpu!=='boolean')throw Error('Choose whether to use computer players.');this.view.fillCpu=settings.fillCpu;}this.view.revision++;}
 assign(id:number,playerId:number,team:Team){if(id!==this.view.hostId||this.view.phase!=='lobby')throw Error('Only the host can split the teams in the lobby.');if(!['blue','gold'].includes(team))throw Error('Choose a team.');const p=this.view.players.find(x=>x.id===playerId&&!x.bot);if(!p)throw Error('Player not found.');if(p.id===this.view.hostId&&team!=='blue')throw Error('The host captains the blue side.');if(p.team!==team&&this.view.players.filter(x=>x.team===team).length>=3)throw Error('A team can have up to three players.');p.team=team;this.syncCaptains();this.view.revision++;}
 captain(id:number,playerId:number,team:Team){if(id!==this.view.hostId||this.view.phase!=='lobby')throw Error('Only the host can choose captains.');if(team!=='gold'||!this.view.players.some(p=>p.id===playerId&&p.team===team&&!p.bot))throw Error('Choose a player on the other team.');this.view.captains[team]=playerId;this.view.revision++;}
 rename(id:number,team:Team,name:unknown){if(this.view.phase!=='lobby'||!['blue','gold'].includes(team)||this.view.captains[team]!==id)throw Error('Only that team’s captain can name the team in the lobby.');this.view.teamNames[team]=safeTeamName(name);this.view.revision++;}
 leave(id:number){if(this.view.phase==='lobby'){this.view.players=this.view.players.filter(p=>p.id!==id);this.humansSeen.delete(id);if(this.view.hostId===id){const next=this.view.players[0];if(next){this.view.hostId=next.id;next.team='blue';if(this.view.players.filter(p=>p.team==='blue').length>3){const move=this.view.players.find(p=>p.id!==next.id&&p.team==='blue');if(move)move.team='gold';}}}this.syncCaptains();this.view.revision++;}else{const p=this.view.players.find(p=>p.id===id);if(p){p.bot=true;p.name+=' CPU';this.view.revision++;}}}
 pruneLobby(now:number){if(this.view.phase!=='lobby')return;for(const p of [...this.view.players])if(now-(this.humansSeen.get(p.id)||this.touched)>45000)this.leave(p.id);}
 start(id:number,now:number){
  if(id!==this.view.hostId)throw Error('Only the host can start.');if(!['lobby','finished'].includes(this.view.phase))throw Error('A game is already running.');
  const humans=this.view.players.filter(p=>!p.bot),chars=['robin-hood','alice','king-arthur','sherlock-holmes','hercules','musketeer'],names=['Robin','Alice','Arthur','Sherlock','Hercules','Musketeer'];
  if(!this.view.fillCpu&&(!humans.some(p=>p.team==='blue')||!humans.some(p=>p.team==='gold')))throw Error('Each team needs a player, or turn on computer players.');
  const teams={blue:humans.filter(p=>p.team==='blue'),gold:humans.filter(p=>p.team==='gold')};
  if(this.view.fillCpu)for(const team of ['blue','gold'] as Team[])while(teams[team].length<3){const i=(team==='blue'?0:3)+teams[team].length;teams[team].push({id:-i-1,name:names[i]+' CPU',characterId:chars[i],bot:true,team,space:0,strikes:0,shield:0,power:0,out:false});}
  this.view.players=[];for(let i=0;i<3;i++)for(const team of ['blue','gold'] as Team[])if(teams[team][i])this.view.players.push({...teams[team][i],space:0,strikes:0,shield:0,power:0,out:false});
  this.view.scores={blue:0,gold:0};this.view.winner=null;this.view.turn=0;this.view.question=null;this.question=null;this.view.cue=null;this.view.rpsReady=[];this.view.rpsDeadline=0;this.choices.clear();this.openingChoices.clear();this.awarded=false;
  this.view.openingRolls={};this.view.openingTotals={blue:0,gold:0};this.view.startingTeam=null;this.view.openingReady=[];this.view.openingHands={};this.view.openingScores={};this.view.openingWinner=null;this.view.openingTied=[];this.view.openingRandomized=false;this.view.openingDeadline=0;this.view.openingResolvedAt=0;this.view.tutorialId=this.nextId++;this.view.tutorialReady=this.view.players.filter(p=>p.bot).map(p=>p.id);this.view.tutorialResults={};this.view.phase='tutorial';this.view.phaseAt=now;for(const p of humans)this.humansSeen.set(p.id,now);this.view.revision++;
 }
 tutorialFinish(id:number,tutorialId:number,result:TutorialResult,now:number){
  if(tutorialId!==this.view.tutorialId)throw Error('This tutorial belongs to an earlier game.');
  if(!this.member(id)||!['finished','skipped'].includes(result))throw Error('Finish or skip your own tutorial.');
  if(this.view.tutorialReady.includes(id))return;
  if(this.view.phase!=='tutorial')throw Error('The tutorial has ended.');
  this.view.tutorialReady.push(id);this.view.tutorialResults[id]=result;this.view.revision++;
  this.advanceTutorial(now);
 }
 private advanceTutorial(now:number){
  if(this.view.phase==='tutorial'&&this.view.players.every(p=>p.bot||this.view.tutorialReady.includes(p.id))){this.view.phase='intro';this.view.phaseAt=now;this.view.revision++;}
 }
 openingChoose(id:number,hand:Hand,now:number){
  if(this.view.phase!=='opening-roll'||this.view.openingWinner!==null)throw Error('The opening competition is not accepting choices.');
  const player=this.view.players.find(p=>p.id===id);
  if(!player||!HANDS.includes(hand))throw Error('Choose Rock, Paper, or Scissors.');
  if(this.openingChoices.has(id))return;
  this.openingChoices.set(id,hand);
  this.view.openingReady=Array.from(this.openingChoices.keys());
  this.view.revision++;
  if(this.openingChoices.size===this.view.players.length)this.resolveOpening(now);
 }
 private resolveOpening(now:number){
  if(this.view.openingWinner!==null)return;
  for(const p of this.view.players)if(!this.openingChoices.has(p.id))this.openingChoices.set(p.id,HANDS[Math.floor(this.random()*HANDS.length)]);
  const players=this.view.players;
  const scores:Record<number,number>={};
  for(const p of players)scores[p.id]=0;
  for(let i=0;i<players.length;i++)for(let j=i+1;j<players.length;j++){
    const result=rpsWinner(this.openingChoices.get(players[i].id)!,this.openingChoices.get(players[j].id)!);
    if(result===0)scores[players[i].id]++;
    else if(result===1)scores[players[j].id]++;
  }
  const best=Math.max(...Object.values(scores));
  const tied=players.filter(p=>scores[p.id]===best).map(p=>p.id);
  const winnerId=tied.length===1?tied[0]:tied[Math.floor(this.random()*tied.length)];
  this.view.openingReady=players.map(p=>p.id);
  this.view.openingHands=Object.fromEntries(players.map(p=>[p.id,this.openingChoices.get(p.id)!])) as Record<number,Hand>;
  this.view.openingScores=scores;
  this.view.openingTied=tied;
  this.view.openingRandomized=tied.length>1;
  this.view.openingWinner=winnerId;
  this.view.openingResolvedAt=now;
  this.view.turn=Math.max(0,players.findIndex(p=>p.id===winnerId));
  this.view.revision++;
 }
 private ask(now:number){this.question=BANK[this.view.level][Math.floor(this.random()*BANK[this.view.level].length)];this.view.question={id:this.nextId++,q:this.question.q,a:this.question.a};this.view.phase='question';this.view.phaseAt=now;this.view.cue=null;this.view.rpsReady=[];this.view.rpsDeadline=0;this.choices.clear();this.awarded=false;this.view.revision++;}
 answer(id:number,questionId:number,choice:number,now:number){const p=this.view.players[this.view.turn];if(this.view.phase!=='question'||p.id!==id||questionId!==this.view.question?.id)throw Error('Wait for your current question.');if(!Number.isInteger(choice)||choice<0||choice>3)throw Error('Choose an answer.');const correct=choice===this.question?.correct;this.view.question=null;this.question=null;this.view.phase='cinematic';this.view.phaseAt=now;this.awarded=false;
 if(!correct){const blocked=this.strike(p);this.view.cue={id:this.nextId++,kind:'strike',startAt:now+600,actor:p.id,from:p.space,to:p.space,raw:0,bonus:0,steps:0,event:'safe',blocked,title:blocked?'SHIELD SAVED YOU!':p.out?p.name+' IS OUT':`STRIKE ${p.strikes} OF 3`};}
 else{const raw=1+Math.floor(this.random()*6),bonus=p.power?2:0;p.power=0;const to=Math.min(BOARD_LAST_SPACE,p.space+raw+bonus);this.view.cue={id:this.nextId++,kind:'move',startAt:now+600,actor:p.id,from:p.space,to,raw,bonus,steps:raw+bonus,event:EVENTS[to%EVENTS.length]};}this.view.revision++;}
 private strike(p:Player){if(p.shield){p.shield--;return true;}p.strikes++;p.out=p.strikes>=3;return false;}
 choose(id:number,hand:Hand,cueId:number,now:number){const cue=this.view.cue;if(this.view.phase!=='rps'||!cue||cue.id!==cueId||![cue.actor,cue.rival].includes(id)||!HANDS.includes(hand))throw Error('This battle is not waiting for your choice.');if(this.choices.has(id))return;this.choices.set(id,hand);this.view.rpsReady=Array.from(this.choices.keys());this.view.revision++;if(this.choices.size===2)this.reveal(now);}
 private reveal(now:number){const old=this.view.cue!;const hands:[Hand,Hand]=[this.choices.get(old.actor)!,this.choices.get(old.rival!)!];const winner=rpsWinner(...hands);this.view.cue={...old,id:this.nextId++,kind:'duel',startAt:now+600,hands,duelWinner:winner===null?null:winner===0?old.actor:old.rival};this.view.phase='cinematic';this.awarded=false;this.view.revision++;}
 private reward(now:number){const cue=this.view.cue!,p=this.view.players[this.view.turn];p.space=cue.to;const team=p.team,other=team==='blue'?'gold':'blue';cue.deltas={blue:0,gold:0};
 switch(cue.event){case 'points':case 'bonus':cue.deltas[team]=cue.event==='bonus'?100:50;cue.title=cue.event==='bonus'?'JACKPOT!':'TEAM POINTS!';break;
 case 'steal':{const amount=Math.min(30,this.view.scores[other]);cue.deltas[team]=amount;cue.deltas[other]=-amount;cue.title=amount?`STOLE ${amount} POINTS!`:'NO POINTS TO STEAL';break;}
 case 'shield':p.shield++;cue.title='SHIELD UP!';break;case 'power':p.power++;cue.title='+2 NEXT ROLL!';break;
 case 'rps':{const rivals=this.view.players.filter(x=>x.team!==team&&!x.out);if(rivals.length){cue.rival=rivals[Math.floor(this.random()*rivals.length)].id;this.view.phase='rps';this.view.phaseAt=now;this.view.rpsDeadline=now+12000;this.view.rpsReady=[];this.choices.clear();cue.title='BATTLE! CHOOSE YOUR HAND';}break;}
 default:cue.title='SAFE AND SOUND';}
 this.view.scores.blue+=cue.deltas.blue;this.view.scores.gold+=cue.deltas.gold;this.awarded=true;this.view.revision++;}
 private advance(now:number){const alive=this.view.players.filter(p=>!p.out),p=this.view.players[this.view.turn];const blue=alive.some(x=>x.team==='blue'),gold=alive.some(x=>x.team==='gold');if(!blue||!gold||p.space===BOARD_LAST_SPACE){this.view.winner=this.view.teamNames[!blue?'gold':!gold?'blue':p.team];this.view.phase='finished';this.view.phaseAt=now;this.view.revision++;return;}do{this.view.turn=(this.view.turn+1)%this.view.players.length;}while(this.view.players[this.view.turn].out);this.ask(now);}
 tick(now:number){const v=this.view;v.serverNow=now;if(v.phase==='tutorial'){
  for(const p of v.players)if(!p.bot&&now-(this.humansSeen.get(p.id)??v.phaseAt)>45000)this.leave(p.id);
  this.advanceTutorial(now);return;
 }if(v.phase==='intro'){const blue=v.players.filter(p=>p.team==='blue').length,gold=v.players.filter(p=>p.team==='gold').length,introDuration=TIMING.teamBanner+blue*TIMING.introPlayer+TIMING.introTeamGap+TIMING.teamBanner+gold*TIMING.introPlayer+TIMING.introHold;if(now-v.phaseAt>=introDuration){v.phase='opening-roll';v.phaseAt=now;v.openingDeadline=now+TIMING.openingCountdown;v.revision++;}return;}if(v.phase==='opening-roll'){
  if(v.openingWinner===null){
    for(const p of v.players)if(p.bot&&!this.openingChoices.has(p.id)&&now-v.phaseAt>700+Math.abs(p.id%4)*220)this.openingChoose(p.id,HANDS[Math.floor(this.random()*HANDS.length)],now);
    if(now>=v.openingDeadline)this.resolveOpening(now);
  }else if(now-v.openingResolvedAt>=TIMING.openingResultHold)this.ask(now);
  return;
}const p=v.players[v.turn];if(v.phase==='question'&&this.question){const disconnected=!p.bot&&now-(this.humansSeen.get(p.id)||v.phaseAt)>45000;if((p.bot&&now-v.phaseAt>1800)||now-v.phaseAt>60000||disconnected){const correct=this.question.correct;this.answer(p.id,v.question!.id,p.bot&&this.random()<.7?correct:(correct+1)%4,now);}return;}
 if(v.phase==='rps'){const cue=v.cue!;for(const id of [cue.actor,cue.rival!]){const player=v.players.find(p=>p.id===id)!;if(!this.choices.has(id)&&((player.bot&&now-v.phaseAt>1200)||now>=v.rpsDeadline)){this.choose(id,HANDS[Math.floor(this.random()*3)],cue.id,now);if(v.phase!=='rps')break;}}return;}
 if(v.phase!=='cinematic'||!v.cue)return;const cue=v.cue;
 if(cue.kind==='strike'){if(now>cue.startAt+TIMING.reward)this.advance(now);return;}
 if(cue.kind==='duel'){if(now>=cue.startAt+TIMING.countdown&&!this.awarded){if(cue.duelWinner!==null){const loser=v.players.find(p=>p.id===(cue.duelWinner===cue.actor?cue.rival:cue.actor))!;cue.blocked=this.strike(loser);cue.title=cue.blocked?'SHIELD BLOCKED THE STRIKE!':v.players.find(p=>p.id===cue.duelWinner)!.name+' WINS!';}else cue.title='DRAW! NO STRIKES';this.awarded=true;v.revision++;}if(now>=cue.startAt+TIMING.countdown+TIMING.duelResult)this.advance(now);return;}
 const rewardAt=moveLandingAt(cue)+TIMING.landing;if(now>=rewardAt&&!this.awarded)this.reward(now);if(v.phase==='cinematic'&&now>=rewardAt+TIMING.reward)this.advance(now);
 }
 snapshot(now:number):View{this.tick(now);const data=structuredClone(this.view);if(data.cue?.kind==='duel'&&now<data.cue.startAt+TIMING.countdown){delete data.cue.hands;delete data.cue.duelWinner;}return data;}
}
