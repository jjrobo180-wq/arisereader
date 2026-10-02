import type { Express, RequestHandler } from "express";
import { randomInt } from "node:crypto";

type Team="cyan"|"magenta";
type Phase="lobby"|"playing"|"finished";
type Player={
  id:number;name:string;team:Team;x:number;z:number;rot:number;moving:boolean;sprinting:boolean;
  tags:number;downs:number;respawnAt:number;lastShotAt:number;bot:boolean;lastSeen:number;
};
type Room={
  code:string;hostId:number;phase:Phase;players:Player[];scores:Record<Team,number>;
  createdAt:number;startedAt:number;endsAt:number;publicLobby:boolean;scope:string;winner:Team|null;
};

const rooms=new Map<string,Room>();
const GAME_MS=5*60*1000;
const ARENA=27;
const clamp=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n));
const scope=(u:any)=>u.school_id?"school:"+u.school_id:u.teacherId?"teacher:"+u.teacherId:"readers";
const spawn=(team:Team,index=0)=>team==="cyan"?{x:-20+(index%3)*2,z:-9+(index%4)*6}:{x:20-(index%3)*2,z:-9+(index%4)*6};

function publicPlayer(p:Player){const {lastShotAt,lastSeen,...rest}=p;return rest;}
function snapshot(room:Room,now=Date.now()){tick(room,now);return {...room,serverNow:now,players:room.players.map(publicPlayer),timeLeft:room.phase==="playing"?Math.max(0,room.endsAt-now):0};}
function member(room:Room,id:number){return room.players.some(p=>p.id===id);}
function makePlayer(user:any,room:Room,bot=false):Player{
  const team:Team=room.players.filter(p=>p.team==="cyan").length<=room.players.filter(p=>p.team==="magenta").length?"cyan":"magenta";
  const pos=spawn(team,room.players.filter(p=>p.team===team).length);
  return {id:bot?-randomInt(100000,999999):Number(user.id),name:bot?(["Pixel","Nova","Bolt","Rocket"][room.players.length%4]+" CPU"):String(user.displayName||user.username||"Reader").slice(0,28),team,...pos,rot:team==="cyan"?Math.PI/2:-Math.PI/2,moving:false,sprinting:false,tags:0,downs:0,respawnAt:0,lastShotAt:0,bot,lastSeen:Date.now()};
}
function tag(room:Room,shooter:Player,target:Player,now:number){if(target.respawnAt||shooter.team===target.team)return false;shooter.tags++;target.downs++;room.scores[shooter.team]++;target.respawnAt=now+1600;target.moving=false;return true;}
function findHit(room:Room,shooter:Player,now:number){
  let best:Player|null=null,bestDist=Infinity;
  for(const t of room.players){
    if(t.id===shooter.id||t.team===shooter.team||t.respawnAt)continue;
    const dx=t.x-shooter.x,dz=t.z-shooter.z,dist=Math.hypot(dx,dz);if(dist>24||dist>=bestDist)continue;
    const aim=Math.atan2(dx,dz),delta=Math.atan2(Math.sin(aim-shooter.rot),Math.cos(aim-shooter.rot));
    if(Math.abs(delta)<.14){best=t;bestDist=dist;}
  }
  return best?tag(room,shooter,best,now):false;
}
function tick(room:Room,now:number){
  if(room.phase==="playing"&&now>=room.endsAt){room.phase="finished";room.winner=room.scores.cyan===room.scores.magenta?null:(room.scores.cyan>room.scores.magenta?"cyan":"magenta");}
  if(room.phase!=="playing")return;
  for(const p of room.players){
    if(p.respawnAt&&p.respawnAt<=now){const pos=spawn(p.team,Math.abs(p.id)%4);p.x=pos.x;p.z=pos.z;p.respawnAt=0;}
    if(!p.bot||p.respawnAt)continue;
    const enemies=room.players.filter(e=>!e.respawnAt&&e.team!==p.team);if(!enemies.length)continue;
    const target=enemies.reduce((best,e)=>Math.hypot(e.x-p.x,e.z-p.z)<Math.hypot(best.x-p.x,best.z-p.z)?e:best,enemies[0]);
    const dx=target.x-p.x,dz=target.z-p.z,dist=Math.max(.01,Math.hypot(dx,dz));p.rot=Math.atan2(dx,dz);
    const step=dist>8?.08:0;p.x=clamp(p.x+dx/dist*step,-ARENA,ARENA);p.z=clamp(p.z+dz/dist*step,-ARENA,ARENA);p.moving=step>0;
    if(dist<18&&now-p.lastShotAt>1200+Math.abs(p.id)%900){p.lastShotAt=now;tag(room,p,target,now);}
  }
}
function cleanup(){const now=Date.now();for(const [code,r] of rooms){r.players=r.players.filter(p=>p.bot||now-p.lastSeen<20*60*1000);if(!r.players.some(p=>!p.bot)||now-r.createdAt>3*60*60*1000)rooms.delete(code);else tick(r,now);}}
const timer=setInterval(cleanup,1000);timer.unref();

export function registerPaintballArenaRoutes(app:Express,auth:RequestHandler){
  const access:RequestHandler=(req:any,res,next)=>{if(req.user.role==="parent"||req.user.is_eye_gaze_user){res.status(403).json({message:"Paintball Arena is for regular student accounts."});return;}next();};
  const wrap=(fn:(req:any,res:any)=>void):RequestHandler=>(req,res)=>{try{res.set("Cache-Control","no-store");fn(req,res);}catch(e){res.status(409).json({message:e instanceof Error?e.message:"Could not update Paintball Arena."});}};
  const getRoom=(req:any)=>{const room=rooms.get(String(req.params.code||"").toUpperCase());if(!room)throw Error("That paintball room has ended.");const id=Number(req.user.id);if(!member(room,id))throw Error("Join the room first.");const p=room.players.find(p=>p.id===id)!;p.lastSeen=Date.now();return room;};
  const start=(room:Room,id:number)=>{if(room.hostId!==id)throw Error("Only the room host can start.");if(room.players.length<2)throw Error("You need at least 2 players.");room.phase="playing";room.startedAt=Date.now();room.endsAt=room.startedAt+GAME_MS;room.scores={cyan:0,magenta:0};room.winner=null;room.players.forEach((p,i)=>{const pos=spawn(p.team,i);Object.assign(p,pos,{tags:0,downs:0,respawnAt:0,lastShotAt:0});});};
  const create=(req:any,isPublic=false,practice=false)=>{let code="";do{code=String(randomInt(100000,1000000));}while(rooms.has(code));const room:Room={code,hostId:Number(req.user.id),phase:"lobby",players:[],scores:{cyan:0,magenta:0},createdAt:Date.now(),startedAt:0,endsAt:0,publicLobby:isPublic,scope:scope(req.user),winner:null};room.players.push(makePlayer(req.user,room));if(practice){while(room.players.length<6)room.players.push(makePlayer(req.user,room,true));start(room,room.hostId);}rooms.set(code,room);return room;};

  app.get("/api/paintball/lobbies",auth,access,wrap((req,res)=>res.json(Array.from(rooms.values()).filter(r=>r.publicLobby&&r.phase==="lobby"&&r.players.length<8&&r.scope===scope(req.user)).map(r=>({code:r.code,hostName:r.players.find(p=>p.id===r.hostId)?.name||"Reader",players:r.players.length})))));
  app.post("/api/paintball/queue",auth,access,wrap((req,res)=>{const id=Number(req.user.id);let room=Array.from(rooms.values()).find(r=>member(r,id)&&r.phase!=="finished");if(!room)room=Array.from(rooms.values()).find(r=>r.publicLobby&&r.phase==="lobby"&&r.players.length<8&&r.scope===scope(req.user));if(!room)room=create(req,true,false);if(!member(room,id))room.players.push(makePlayer(req.user,room));room.players.find(p=>p.id===id)!.lastSeen=Date.now();res.json(snapshot(room));}));
  app.post("/api/paintball/rooms",auth,access,wrap((req,res)=>res.json(snapshot(create(req,req.body?.publicLobby===true,req.body?.practice===true)))));
  app.post("/api/paintball/rooms/:code/join",auth,access,wrap((req,res)=>{const room=rooms.get(String(req.params.code).toUpperCase());if(!room)throw Error("Room not found.");if(room.scope!==scope(req.user)&&room.publicLobby)throw Error("Choose a room in your school.");if(room.phase!=="lobby")throw Error("That match already started.");if(room.players.length>=8)throw Error("That room is full.");if(!member(room,Number(req.user.id)))room.players.push(makePlayer(req.user,room));res.json(snapshot(room));}));
  app.get("/api/paintball/rooms/:code",auth,access,wrap((req,res)=>res.json(snapshot(getRoom(req)))));
  app.post("/api/paintball/rooms/:code/leave",auth,access,wrap((req,res)=>{const room=rooms.get(String(req.params.code).toUpperCase());if(room){room.players=room.players.filter(p=>p.id!==Number(req.user.id));if(room.hostId===Number(req.user.id)){const next=room.players.find(p=>!p.bot);if(next)room.hostId=next.id;}if(!room.players.some(p=>!p.bot))rooms.delete(room.code);}res.json({ok:true});}));
  app.post("/api/paintball/rooms/:code/action",auth,access,wrap((req,res)=>{
    const room=getRoom(req),now=Date.now(),id=Number(req.user.id),p=room.players.find(p=>p.id===id)!;const type=String(req.body?.type||"");
    if(type==="start")start(room,id);
    else if(type==="add-bots"){if(room.hostId!==id||room.phase!=="lobby")throw Error("Only the host can add computer players.");while(room.players.length<Math.min(8,Math.max(2,Number(req.body?.count)||6)))room.players.push(makePlayer(req.user,room,true));}
    else if(type==="switch-team"){if(room.phase!=="lobby")throw Error("Teams are locked after the match starts.");p.team=p.team==="cyan"?"magenta":"cyan";Object.assign(p,spawn(p.team,0));}
    else if(type==="move"){if(room.phase!=="playing"||p.respawnAt)return res.json(snapshot(room,now));const nx=Number(req.body?.x),nz=Number(req.body?.z),rot=Number(req.body?.rot);if(Number.isFinite(nx)&&Number.isFinite(nz)){const maxStep=req.body?.sprinting?2.4:1.7;const dx=clamp(nx-p.x,-maxStep,maxStep),dz=clamp(nz-p.z,-maxStep,maxStep);p.x=clamp(p.x+dx,-ARENA,ARENA);p.z=clamp(p.z+dz,-ARENA,ARENA);}if(Number.isFinite(rot))p.rot=rot;p.moving=!!req.body?.moving;p.sprinting=!!req.body?.sprinting;}
    else if(type==="shoot"){if(room.phase!=="playing"||p.respawnAt)return res.json(snapshot(room,now));if(now-p.lastShotAt<320)return res.json(snapshot(room,now));p.lastShotAt=now;if(Number.isFinite(Number(req.body?.rot)))p.rot=Number(req.body.rot);findHit(room,p,now);}
    else if(type==="restart"){if(room.phase!=="finished")throw Error("Finish the current match first.");start(room,id);}
    else throw Error("Unknown paintball action.");
    res.json(snapshot(room,now));
  }));
}