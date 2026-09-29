import type {Express,RequestHandler} from 'express';
import {randomInt} from 'node:crypto';
import {BoardQuestGame} from './boardQuestEngine';
import {BANK,type Level,type Player} from '../shared/boardQuest';
export function registerBoardQuestRoutes(app:Express,auth:RequestHandler){
 const rooms=new Map<string,BoardQuestGame>();
 const player=(user:any):Player=>({id:Number(user.id),name:String(user.displayName||user.username||'Reader').slice(0,30),characterId:'robin-hood',team:'blue',space:0,strikes:0,shield:0,power:0,out:false,bot:false});
 const access:RequestHandler=(req:any,res,next)=>{if(req.user.role==='parent'||req.user.is_eye_gaze_user){res.status(403).json({message:'Use a regular student or teacher account for Board Quest.'});return;}next();};
 const wrap=(action:(req:any,res:any)=>void):RequestHandler=>(req,res)=>{try{res.set('Cache-Control','no-store');action(req,res);}catch(e){res.status(409).json({message:e instanceof Error?e.message:'Could not update this room.'});}};
 const room=(req:any)=>{const game=rooms.get(String(req.params.code).toUpperCase());if(!game)throw Error('This room has ended. Create or join a new game.');if(!game.member(Number(req.user.id)))throw Error('Join this room first.');game.touch(Number(req.user.id),Date.now());return game;};
 const timer=setInterval(()=>{const now=Date.now();for(const [code,game] of Array.from(rooms)){if(now-game.touched>2*60*60*1000)rooms.delete(code);else game.tick(now);}},200);timer.unref();
 app.post('/api/board-quest/rooms',auth,access,wrap((req,res)=>{
  const level=req.body?.level as Level;if(!Object.hasOwn(BANK,level))throw Error('Choose a learning level.');
  const uid=Number(req.user.id);for(const [code,g]of Array.from(rooms))if(g.view.hostId===uid&&(g.view.phase==='lobby'||g.view.phase==='finished'))rooms.delete(code);
  if(Array.from(rooms.values()).filter(g=>g.member(uid)).length>=3)throw Error('Finish an existing game before creating another room.');if(rooms.size>=200)throw Error('All rooms are busy. Please try again shortly.');
  let code='';do{code=String(randomInt(100000,1000000));}while(rooms.has(code));const game=new BoardQuestGame(code,player(req.user),level);game.touch(uid,Date.now());rooms.set(code,game);if(req.body?.practice===true)game.start(uid,Date.now());res.json(game.snapshot(Date.now()));
 }));
 app.post('/api/board-quest/rooms/:code/join',auth,access,wrap((req,res)=>{const game=rooms.get(String(req.params.code).toUpperCase());if(!game)throw Error('Room not found. Check the six-digit code.');game.add(player(req.user));game.touch(Number(req.user.id),Date.now());res.json(game.snapshot(Date.now()));}));
 app.get('/api/board-quest/rooms/:code',auth,access,wrap((req,res)=>res.json(room(req).snapshot(Date.now()))));
 app.post('/api/board-quest/rooms/:code/action',auth,access,wrap((req,res)=>{const g=room(req),now=Date.now();g.tick(now);const id=Number(req.user.id);switch(req.body?.type){case 'start':g.start(id,now);break;case 'answer':g.answer(id,req.body.questionId,req.body.choice,now);break;case 'hand':g.choose(id,req.body.hand,req.body.cueId,now);break;default:throw Error('Unknown game action.');}res.json(g.snapshot(now));}));
}
