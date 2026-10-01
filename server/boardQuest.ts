import type { Express, RequestHandler } from 'express';
import { randomInt } from 'node:crypto';
import { BoardQuestGame } from './boardQuestEngine';
import { BANK, type Level, type Player, type Team } from '../shared/boardQuest';

export function registerBoardQuestRoutes(app: Express, auth: RequestHandler) {
 const rooms = new Map<string, BoardQuestGame>(), scopes = new Map<string, string>();
 const scope = (user: any) => user.school_id ? `school:${user.school_id}` : user.teacherId ? `teacher:${user.teacherId}` : 'readers';
 const player = (user: any): Player => ({ id: Number(user.id), name: String(user.displayName || user.username || 'Reader').slice(0,30), characterId:'robin-hood', team:'blue', space:0, strikes:0, shield:0, power:0, out:false, bot:false });
 const access: RequestHandler = (req:any,res,next) => { if(req.user.role==='parent'||req.user.is_eye_gaze_user){res.status(403).json({message:'Use a regular student or teacher account for Board Quest.'});return;}next(); };
 const wrap = (action:(req:any,res:any)=>void):RequestHandler => (req,res) => {try{res.set('Cache-Control','no-store');action(req,res);}catch(e){res.status(409).json({message:e instanceof Error?e.message:'Could not update this room.'});}};
 const room = (req:any) => { const game=rooms.get(String(req.params.code).toUpperCase()); if(!game)throw Error('This room has ended. Join a new lobby.');if(!game.member(Number(req.user.id)))throw Error('Join this room first.');game.touch(Number(req.user.id),Date.now());return game; };
 const create = (req:any,publicLobby=false) => {
  const level=(req.body?.level||'6-8') as Level;if(!Object.hasOwn(BANK,level))throw Error('Choose a learning level.');
  if(rooms.size>=200)throw Error('All rooms are busy. Please try again shortly.');
  let code='';do{code=String(randomInt(100000,1000000));}while(rooms.has(code));
  const game=new BoardQuestGame(code,player(req.user),level);game.view.publicLobby=publicLobby;game.touch(Number(req.user.id),Date.now());rooms.set(code,game);scopes.set(code,scope(req.user));return game;
 };
 const timer=setInterval(()=>{const now=Date.now();for(const [code,game]of Array.from(rooms)){game.pruneLobby(now);if(!game.view.players.length||now-game.touched>2*60*60*1000){rooms.delete(code);scopes.delete(code);}else game.tick(now);}},200);timer.unref();
 app.get('/api/board-quest/lobbies',auth,access,wrap((req,res)=>{
  res.json(Array.from(rooms.values()).filter(g=>g.view.publicLobby&&g.view.phase==='lobby'&&g.view.players.length<6&&scopes.get(g.view.code)===scope(req.user)).map(g=>({code:g.view.code,hostName:g.view.players.find(p=>p.id===g.view.hostId)?.name||'Reader',level:g.view.level,players:g.view.players.length,fillCpu:g.view.fillCpu,teamNames:g.view.teamNames})));
 }));
 app.post('/api/board-quest/lobby/queue',auth,access,wrap((req,res)=>{
  const uid=Number(req.user.id),existing=Array.from(rooms.values()).find(g=>g.member(uid)&&g.view.phase!=='finished');
  if(existing){existing.touch(uid,Date.now());return res.json(existing.snapshot(Date.now()));}
  const game=Array.from(rooms.values()).find(g=>g.view.publicLobby&&g.view.phase==='lobby'&&g.view.players.length<6&&scopes.get(g.view.code)===scope(req.user))||create(req,true);
  game.add(player(req.user));game.touch(uid,Date.now());res.json(game.snapshot(Date.now()));
 }));
 app.post('/api/board-quest/rooms',auth,access,wrap((req,res)=>{
  const uid=Number(req.user.id);for(const [code,g]of Array.from(rooms))if(g.member(uid)){if(g.view.phase==='lobby'){g.leave(uid);if(!g.view.players.length){rooms.delete(code);scopes.delete(code);}}else if(g.view.phase!=='finished')throw Error('Leave your current game before starting another.');}
  const game=create(req,req.body?.publicLobby===true);if(req.body?.practice===true)game.start(uid,Date.now());res.json(game.snapshot(Date.now()));
 }));
 app.post('/api/board-quest/rooms/:code/join',auth,access,wrap((req,res)=>{
  const game=rooms.get(String(req.params.code).toUpperCase());if(!game)throw Error('Lobby not found. Join the queue for a new game.');
  if(game.view.publicLobby&&scopes.get(game.view.code)!==scope(req.user))throw Error('Choose a lobby in your school.');
  if(Array.from(rooms.values()).some(g=>g!==game&&g.member(Number(req.user.id))&&g.view.phase!=='finished'))throw Error('Leave your current lobby before joining another.');
  game.add(player(req.user));game.touch(Number(req.user.id),Date.now());res.json(game.snapshot(Date.now()));
 }));
 app.get('/api/board-quest/rooms/:code',auth,access,wrap((req,res)=>res.json(room(req).snapshot(Date.now()))));
 app.post('/api/board-quest/rooms/:code/leave',auth,access,wrap((req,res)=>{
  const game=rooms.get(String(req.params.code).toUpperCase());if(game?.member(Number(req.user.id))){game.leave(Number(req.user.id));if(!game.view.players.length){rooms.delete(game.view.code);scopes.delete(game.view.code);}}res.json({ok:true});
 }));
 app.post('/api/board-quest/rooms/:code/action',auth,access,wrap((req,res)=>{
  const g=room(req),now=Date.now();g.tick(now);const id=Number(req.user.id);
  switch(req.body?.type){
   case 'settings':g.configure(id,{level:req.body.level,fillCpu:req.body.fillCpu});break;
   case 'assign':g.assign(id,Number(req.body.playerId),req.body.team as Team);break;
   case 'captain':g.captain(id,Number(req.body.playerId),req.body.team as Team);break;
   case 'name':g.rename(id,req.body.team as Team,req.body.name);break;
   case 'start':g.start(id,now);break;
   case 'answer':g.answer(id,req.body.questionId,req.body.choice,now);break;
   case 'opening-hand':g.openingChoose(id,req.body.hand,now);break;
   case 'hand':g.choose(id,req.body.hand,req.body.cueId,now);break;
   default:throw Error('Unknown game action.');
  }res.json(g.snapshot(now));
 }));
}
