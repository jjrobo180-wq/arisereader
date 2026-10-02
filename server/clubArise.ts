import type { Express, RequestHandler } from "express";
import { getAdminSupabase } from "./supabase";
import { storage } from "./storage";
import { clubDay } from "../shared/clubPlay";
import { choiceQuestions, fourAI, fourWinner, rescueGuess, RESCUE_WORDS, tileRounds } from "./arcadeContent";

const SAFE_PHRASES = new Set([
  "Hi!","Want to play?","Good game!","Nice job!","Your turn!",
  "Let's play!","Let's read!","Thanks!","That was fun!","See you later!"
]);

const GAME_TYPES = new Set([
  "four","word_tiles","word_rescue",
  "math_duel","synonym_sprint","pattern_power","sentence_fix","fact_dash"
]);

const CHOICE_GAMES = new Set(["math_duel","synonym_sprint","pattern_power","sentence_fix","fact_dash"]);
const EMOTES = new Set(["dance","jump","flip","silly"]);
const vehiclePresence=new Map<number,{carId:string;driving:boolean;updatedAt:number}>();
const CAR_IDS=new Set(["car-street","car-electric","car-super","car-suv"]);
const HOME_IDS=new Set(["home-basic","home-studio","home-loft","home-modern"]);
type NeighborhoodVisitor={userId:number;displayName:string;characterId:string;petId:string;homeId:string;lot:number;x:number;z:number;facing:number;updatedAt:number};
const neighborhoodVisitors=new Map<number,NeighborhoodVisitor>();
function activeNeighborhoodVisitors(){
  neighborhoodVisitors.forEach((visitor,id)=>{if(Date.now()-visitor.updatedAt>30000)neighborhoodVisitors.delete(id);});
  return Array.from(neighborhoodVisitors.values()).slice(0,24);
}
function activeWorldPet(state:any){
  const id=String(state?.equipped?.pet||"pet-none");
  return id.startsWith("pet-")?id:"pet-none";
}
async function initializeLegacyPetCare(userId:number,state:any){
  const pets=(Array.isArray(state?.purchased)?state.purchased:[]).filter((id:any)=>typeof id==="string"&&id.startsWith("pet-"));
  const needsMigration=pets.some((id:string)=>!state?.petCare?.[id]||state.petCare[id]?.fedUntil!==undefined);
  if(!needsMigration)return state;
  const now=Date.now();
  state.petCare={...(state.petCare||{})};
  for(const id of pets){
    const old=state.petCare[id]||{};
    const legacyUntil=Number(old.fedUntil);
    state.petCare[id]={
      happiness:Number.isFinite(Number(old.happiness))?Math.max(0,Math.min(100,Number(old.happiness))):(Number.isFinite(legacyUntil)&&legacyUntil>now?85:70),
      lastUpdatedAt:Number(old.lastUpdatedAt)||now,
      lastFedAt:Number(old.lastFedAt)||0,
      lastTreatAt:Number(old.lastTreatAt)||0,
      lastWalkAt:Number(old.lastWalkAt)||0,
    };
  }
  await storage.upsertSetting("avatar_world_"+userId,JSON.stringify(state));
  return state;
}
function withVehicles(players:any[]){
  vehiclePresence.forEach((vehicle,id)=>{if(Date.now()-vehicle.updatedAt>30000)vehiclePresence.delete(id);});
  return players.map(player=>{
    const vehicle=vehiclePresence.get(player.user_id);
    return {...player,car_id:vehicle&&Date.now()-vehicle.updatedAt<30000?vehicle.carId:"car-none",driving:!!vehicle&&Date.now()-vehicle.updatedAt<30000&&vehicle.driving};
  });
}

function isStudent(user:any){
  return !!user && !user.isAdmin && user.role==="student" && !user.is_eye_gaze_user;
}

async function readerIdentity(userId:number,fallback:any){
  const {data}=await getAdminSupabase().from("users").select("display_name,username").eq("id",userId).maybeSingle();
  return String(data?.display_name||fallback?.displayName||data?.username||fallback?.username||"Reader");
}

function initialState(gameType:string){
  if(gameType==="four") return {board:Array.from({length:6},()=>Array(7).fill(null)),turn:1,winner:null,lastMove:null};
  if(gameType==="word_rescue"){
    const pick=RESCUE_WORDS[Math.floor(Math.random()*RESCUE_WORDS.length)];
    return {word:pick.word,hint:pick.hint,guessed:[],turn:1,winner:null,misses:0,maxMisses:8};
  }
  if(CHOICE_GAMES.has(gameType)){
    return {round:0,turn:1,scores:[0,0],streaks:[0,0],questions:choiceQuestions(gameType),winner:null,last:null};
  }
  const tiles=tileRounds();
  return {round:0,turn:1,scores:[0,0],prompt:"Find the real word",choices:tiles.choices,real:tiles.real,winner:null,last:null};
}

/** Scores one answer in a question game and moves the round along. Both players answer each round. */
function answerChoice(state:any,playerIndex:number,choice:string){
  const q=state.questions[state.round];
  const correct=choice===q.correct;
  state.scores=[...(state.scores||[0,0])];
  state.streaks=[...(state.streaks||[0,0])];
  const i=playerIndex-1;
  state.streaks[i]=correct?(state.streaks[i]||0)+1:0;
  const points=correct?10+5*Math.min(2,state.streaks[i]-1):0;
  state.scores[i]=(state.scores[i]||0)+points;
  state.last={player:playerIndex,choice,correct,answer:q.correct,points,round:state.round};
  if(playerIndex===2){
    state.round=Number(state.round||0)+1;state.turn=1;
    if(state.round>=state.questions.length)state.winner=state.scores[0]===state.scores[1]?0:(state.scores[0]>state.scores[1]?1:2);
  }else state.turn=2;
}

function answerTile(state:any,playerIndex:number,choice:string){
  const real=String(state.real?.[state.round]||"");
  const correct=!real||choice===real;
  const points=correct?choice.length*2:0;
  state.scores=[...(state.scores||[0,0])];
  state.scores[playerIndex-1]=(state.scores[playerIndex-1]||0)+points;
  state.last={player:playerIndex,choice,correct,answer:real||choice,points,round:state.round};
  if(playerIndex===2){
    state.round=Number(state.round||0)+1;state.turn=1;
    if(state.round>=state.choices.length)state.winner=state.scores[0]===state.scores[1]?0:(state.scores[0]>state.scores[1]?1:2);
  }else state.turn=2;
}

function dropPiece(state:any,column:number,playerIndex:number){
  const board=(state.board||[]).map((r:any[])=>[...r]);
  let row=-1;
  for(let r=5;r>=0;r--)if(!board[r][column]){row=r;break;}
  if(row<0)return false;
  board[row][column]=playerIndex;
  state.board=board;state.lastMove={row,column,player:playerIndex};
  state.winner=fourWinner(board);
  if(!state.winner&&board[0].every((cell:any)=>cell))state.winner=0;
  state.turn=state.winner!==null?playerIndex:(playerIndex===1?2:1);
  return true;
}

function guessLetter(state:any,letter:string,playerIndex:number){
  state.guessed=Array.from(new Set([...(state.guessed||[]),letter]));
  const hit=String(state.word).includes(letter);
  if(!hit)state.misses=Number(state.misses||0)+1;
  state.last={player:playerIndex,choice:letter,correct:hit};
  const solved=String(state.word).split("").every((ch:string)=>state.guessed.includes(ch));
  if(solved)state.winner=playerIndex;
  else if(state.misses>=Number(state.maxMisses||8))state.winner=playerIndex===1?2:1;
  // Guessing a right letter earns another turn.
  else if(!hit)state.turn=playerIndex===1?2:1;
}

/** Strip answers the player should not see yet (current/future rounds, the hidden word). */
function publicMatch(match:any){
  const state=match?.state;
  if(!state||typeof state!=="object")return match;
  const done=match.status==="finished"||(state.winner!==null&&state.winner!==undefined);
  if(done)return match;
  const round=Number(state.round||0);
  const out:any={...state};
  if(Array.isArray(state.questions))out.questions=state.questions.map((q:any,i:number)=>i<round?q:{q:q.q,options:q.options});
  if(Array.isArray(state.real))out.real=state.real.slice(0,round);
  if(typeof state.word==="string")out.word=state.word.split("").map((ch:string)=>(state.guessed||[]).includes(ch)?ch:"_").join("");
  return {...match,state:out};
}

function computerTurn(gameType:string,state:any){
  // The computer keeps its turn after a correct letter, so loop (bounded).
  for(let step=0;step<30;step++){
    if(!state?.computer||Number(state.turn)!==2||(state.winner!==null&&state.winner!==undefined))return state;
    if(gameType==="four"){
      const column=fourAI(state.board||[],2);
      if(column<0){state.winner=0;return state;}
      dropPiece(state,column,2);
    }else if(gameType==="word_rescue"){
      const letter=rescueGuess(String(state.word||""),state.guessed||[]);
      if(!letter){state.winner=0;return state;}
      guessLetter(state,letter,2);
    }else if(CHOICE_GAMES.has(gameType)){
      const q=state.questions?.[state.round];
      if(!q){state.winner=0;return state;}
      const choice=Math.random()<.66?q.correct:q.options[Math.floor(Math.random()*q.options.length)];
      answerChoice(state,2,choice);
    }else{
      const options:string[]=state.choices?.[state.round]||[];
      if(!options.length){state.winner=0;return state;}
      const real=String(state.real?.[state.round]||options[0]);
      answerTile(state,2,Math.random()<.7?real:options[Math.floor(Math.random()*options.length)]);
    }
  }
  return state;
}

async function getClubAccess(userId:number, unrestricted=false){
  if(unrestricted){
    return {
      allowed:true,locked:false,teacherId:null,dailyLimit:null,gamesToday:0,dailyRemaining:null,
      gamesPerPassedQuiz:0,passedQuizzes:0,automaticRemaining:null,weeklyUnlimitedOnPass:true,adminPreview:true
    };
  }
  const db=getAdminSupabase();
  const {data:user}=await db.from("users").select("teacher_id,username").eq("id",userId).single();
  const teacherId=Number(user?.teacher_id||0)||null;
  if(String(user?.username||"").startsWith("sample")){
    return {
      allowed:true,locked:false,teacherId,dailyLimit:null,gamesToday:0,dailyRemaining:null,
      gamesPerPassedQuiz:0,passedQuizzes:0,automaticRemaining:null,weeklyUnlimitedOnPass:true,sample:true
    };
  }
  const {data:control}=await db.from("club_arise_controls").select("*").eq("student_id",userId).maybeSingle();

  const {count:passedCount}=await db.from("attempts")
    .select("id",{count:"exact",head:true})
    .eq("user_id",userId).gt("points_earned",0);

  const {data:finished}=await db.from("club_arise_matches")
    .select("id,updated_at,state")
    .eq("status","finished")
    .or("player1_id.eq."+userId+",player2_id.eq."+userId);

  const allGames=(finished||[]).filter((m:any)=>!m.state?.adminPreview);
  const today=new Date().toISOString().slice(0,10);
  const gamesToday=allGames.filter((m:any)=>String(m.updated_at||"").slice(0,10)===today).length;
  const dailyLimit=control?.daily_game_limit===null||control?.daily_game_limit===undefined?null:Number(control.daily_game_limit);
  const perQuiz=Math.max(0,Number(control?.games_per_passed_quiz||0));
  const quizAllowance=perQuiz>0?(passedCount||0)*perQuiz:null;
  const automaticRemaining=quizAllowance===null?null:Math.max(0,quizAllowance-allGames.length);
  const dailyRemaining=dailyLimit===null?null:Math.max(0,dailyLimit-gamesToday);
  const locked=!!control?.locked;
  const allowed=!locked&&(dailyRemaining===null||dailyRemaining>0)&&(automaticRemaining===null||automaticRemaining>0);

  return {
    allowed,locked,teacherId,dailyLimit,gamesToday,dailyRemaining,
    gamesPerPassedQuiz:perQuiz,passedQuizzes:passedCount||0,automaticRemaining,
    weeklyUnlimitedOnPass:control?.weekly_unlimited_on_pass!==false
  };
}

async function awardFinishedMatch(match:any,state:any){
  if(match.rewards_awarded)return;
  if(state?.adminPreview){
    await getAdminSupabase().from("club_arise_matches").update({rewards_awarded:true}).eq("id",match.id).eq("rewards_awarded",false);
    return;
  }
  const db=getAdminSupabase();
  const winnerIndex=Number(state?.winner||0);
  const winnerUserId=winnerIndex===1?match.player1_id:winnerIndex===2?match.player2_id:null;
  if(winnerUserId){
    const {data:user}=await db.from("users").select("total_points,username,is_admin,role").eq("id",winnerUserId).single();
    if(!user?.is_admin && user?.role!=="admin" && !String(user?.username||"").startsWith("sample")){
      const current=Number(user?.total_points||0);
      await db.from("users").update({total_points:Math.round((current+10)*10)/10}).eq("id",winnerUserId);
    }
  }
  await db.from("club_arise_matches").update({rewards_awarded:true}).eq("id",match.id).eq("rewards_awarded",false);
}

export function registerClubAriseRoutes(app:Express, authMiddleware:RequestHandler){
  const db=()=>getAdminSupabase();

  // ─── Arcade Star Hunt: a few glowing stars a day, each worth bonus Reader Coins ───
  const STARS_PER_DAY=6, COINS_PER_STAR=5;
  const starKey=(userId:number)=>"arcade_stars_"+userId+"_"+clubDay(Date.now());
  const starLocks=new Set<number>();
  app.get("/api/club-arise/stars",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const found=Math.max(0,Number(await storage.getSetting(starKey(req.user.id)))||0);
      res.set("Cache-Control","no-store");
      res.json({found,perDay:STARS_PER_DAY,coinsPerStar:COINS_PER_STAR,remaining:Math.max(0,STARS_PER_DAY-found)});
    }catch(error:any){res.status(500).json({message:"Could not load the star hunt."});}
  });
  app.post("/api/club-arise/stars/collect",authMiddleware,async(req:any,res)=>{
    if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
    if(starLocks.has(req.user.id))return res.status(429).json({message:"One star at a time!"});
    starLocks.add(req.user.id);
    try{
      const key=starKey(req.user.id);
      const found=Math.max(0,Number(await storage.getSetting(key))||0);
      if(found>=STARS_PER_DAY)return res.json({found,perDay:STARS_PER_DAY,coinsPerStar:COINS_PER_STAR,remaining:0,awarded:0});
      await storage.upsertSetting(key,String(found+1));
      const bonusKey="avatar_world_bonus_"+req.user.id;
      const bonus=Math.max(0,Number(await storage.getSetting(bonusKey))||0);
      await storage.upsertSetting(bonusKey,String(bonus+COINS_PER_STAR));
      res.json({found:found+1,perDay:STARS_PER_DAY,coinsPerStar:COINS_PER_STAR,remaining:STARS_PER_DAY-found-1,awarded:COINS_PER_STAR});
    }catch(error:any){
      console.error("[club-arise] star",error?.message);
      res.status(500).json({message:"Could not collect that star."});
    }finally{starLocks.delete(req.user.id);}
  });

  app.get("/api/neighborhood/bootstrap",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"The Block is for student accounts."});
      const raw=await storage.getSetting("avatar_world_"+req.user.id);
      let state:any={};if(raw){try{state=await initializeLegacyPetCare(req.user.id,JSON.parse(raw));}catch{}}
      const displayName=await readerIdentity(req.user.id,req.user);
      const visitors=activeNeighborhoodVisitors();
      const existing=neighborhoodVisitors.get(req.user.id);
      const occupied=new Set(visitors.filter(v=>v.userId!==req.user.id&&v.lot>=0).map(v=>v.lot));
      const lot=existing&&existing.lot>=0?existing.lot:(Array.from({length:10},(_,i)=>i).find(i=>!occupied.has(i))??-1);
      // Arrive on the street just inside the entrance arch, spread out so readers don't stack.
      const lotX=-35+(Math.max(0,lot)%5)*1.8;
      const lotZ=lot>=5?-1.6:1.6;
      const self:NeighborhoodVisitor={userId:req.user.id,displayName,
        characterId:String(state.selectedCharacter||"robin-hood"),petId:activeWorldPet(state),
        homeId:HOME_IDS.has(state.equipped?.home)?state.equipped.home:"home-basic",lot,
        x:existing?.lot===lot?existing.x:lotX,z:existing?.lot===lot?existing.z:lotZ,facing:existing?.facing??0,updatedAt:Date.now()};
      neighborhoodVisitors.set(req.user.id,self);
      res.set("Cache-Control","no-store");res.json({self,players:activeNeighborhoodVisitors()});
    }catch(error:any){console.error("[neighborhood] bootstrap",error?.message);res.status(500).json({message:"Could not enter The Block."});}
  });

  app.post("/api/neighborhood/presence",authMiddleware,async(req:any,res)=>{
    if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
    const current=neighborhoodVisitors.get(req.user.id);
    if(!current)return res.status(409).json({message:"Enter The Block again to reconnect."});
    const x=Number(req.body?.x),z=Number(req.body?.z),facing=Number(req.body?.facing);
    neighborhoodVisitors.set(req.user.id,{...current,
      x:Number.isFinite(x)?Math.max(-44,Math.min(44,x)):current.x,
      z:Number.isFinite(z)?Math.max(-30,Math.min(30,z)):current.z,
      facing:Number.isFinite(facing)?Math.max(-Math.PI,Math.min(Math.PI,facing)):current.facing,
      updatedAt:Date.now()});
    res.set("Cache-Control","no-store");res.json({players:activeNeighborhoodVisitors()});
  });

  app.post("/api/neighborhood/leave",authMiddleware,(req:any,res)=>{
    if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
    neighborhoodVisitors.delete(req.user.id);res.json({ok:true});
  });

  app.get("/api/club-arise/bootstrap", authMiddleware, async(req:any,res)=>{
    try{
      if(!isStudent(req.user)) return res.status(403).json({message:"A.R.I.S.E Arcade is for student accounts."});
      const payload:any=await (async()=>{
        const [displayName,raw]=await Promise.all([
          readerIdentity(req.user.id,req.user),
          storage.getSetting("avatar_world_"+req.user.id)
        ]);
        let state:any={selectedCharacter:"robin-hood"};
        if(raw){try{state=await initializeLegacyPetCare(req.user.id,{...state,...JSON.parse(raw)});}catch{}}
        return {
          displayName,
          characterId:state.selectedCharacter||"robin-hood",
          petId:activeWorldPet(state),
          carId:CAR_IDS.has(state.equipped?.car)?state.equipped.car:"car-none",
          homeId:state.equipped?.home||"home-basic"
        };
      })();

      await db().from("club_arise_presence").upsert({
        user_id:req.user.id,
        display_name:payload.displayName,
        character_id:payload.characterId,
        x:0,z:8,facing:0,pet_id:payload.petId,updated_at:new Date().toISOString(),
      },{onConflict:"user_id"});

      const cutoff=new Date(Date.now()-30000).toISOString();
      const {data:players,error}=await db().from("club_arise_presence")
        .select("user_id,display_name,character_id,pet_id,x,z,facing,phrase,phrase_at,emote,emote_at,updated_at")
        .gte("updated_at",cutoff);
      if(error)throw error;
      res.set("Cache-Control","no-store");
      const access=await getClubAccess(req.user.id, req.adminPreview === "regular");
      res.json({self:{userId:req.user.id,...payload},players:withVehicles(players||[]),safePhrases:Array.from(SAFE_PHRASES),access});
    }catch(error:any){
      console.error("[club-arise] bootstrap",error?.message);
      res.status(500).json({message:"Could not enter A.R.I.S.E Arcade."});
    }
  });

  app.post("/api/club-arise/presence", authMiddleware, async(req:any,res)=>{
    try{
      if(!isStudent(req.user)) return res.status(403).json({message:"Student account required."});
      const x=Math.max(-30,Math.min(30,Number(req.body?.x)||0));
      const z=Math.max(-22,Math.min(22,Number(req.body?.z)||0));
      const facing=Math.max(-Math.PI,Math.min(Math.PI,Number(req.body?.facing)||0));
      const phrase=String(req.body?.phrase||"").trim();
      const emote=String(req.body?.emote||"").trim();
      if(phrase && !SAFE_PHRASES.has(phrase)) return res.status(400).json({message:"That phrase is not available."});
      if(emote && !EMOTES.has(emote)) return res.status(400).json({message:"That emote is not available."});

      const currentRaw=await storage.getSetting("avatar_world_"+req.user.id);
      let selectedCharacter="robin-hood";
      let petId="pet-none";
      let carId="car-none";
      if(currentRaw){try{const parsed=await initializeLegacyPetCare(req.user.id,JSON.parse(currentRaw));selectedCharacter=parsed?.selectedCharacter||selectedCharacter;petId=activeWorldPet(parsed);if(CAR_IDS.has(parsed?.equipped?.car))carId=parsed.equipped.car;}catch{}}
      vehiclePresence.set(req.user.id,{carId,driving:!!req.body?.driving&&carId!=="car-none",updatedAt:Date.now()});
      const displayName=await readerIdentity(req.user.id,req.user);
      const row:any={
        user_id:req.user.id,
        display_name:displayName,
        character_id:selectedCharacter,pet_id:petId,
        x,z,facing,updated_at:new Date().toISOString(),
      };
      if(phrase){row.phrase=phrase;row.phrase_at=new Date().toISOString();}
      if(emote){row.emote=emote;row.emote_at=new Date().toISOString();}
      await db().from("club_arise_presence").upsert(row,{onConflict:"user_id"});

      const cutoff=new Date(Date.now()-30000).toISOString();
      const {data,error}=await db().from("club_arise_presence")
        .select("user_id,display_name,character_id,pet_id,x,z,facing,phrase,phrase_at,emote,emote_at,updated_at")
        .gte("updated_at",cutoff);
      if(error)throw error;
      res.json({players:withVehicles(data||[])});
    }catch(error:any){
      console.error("[club-arise] presence",error?.message);
      res.status(500).json({message:"Could not update the arcade."});
    }
  });

  app.get("/api/teacher/club-arise/profile-rule", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.role!=="teacher"&&!req.user.isAdmin)return res.status(403).json({message:"Teacher access required."});
      let query=db().from("users").select("id").eq("role","student").eq("is_eye_gaze_user",false);
      if(!req.user.isAdmin)query=query.eq("teacher_id",req.user.id);
      const {data:students,error}=await query;
      if(error)throw error;
      const ids=(students||[]).map((s:any)=>s.id);
      const {data:controls,error:controlError}=ids.length
        ? await db().from("club_arise_controls").select("student_id,weekly_unlimited_on_pass").in("student_id",ids)
        : {data:[] as any[],error:null as any};
      if(controlError)throw controlError;
      const map=new Map((controls||[]).map((row:any)=>[row.student_id,row.weekly_unlimited_on_pass!==false]));
      const enabled=ids.every((id:number)=>map.get(id)!==false);
      res.json({enabled,studentCount:ids.length});
    }catch(error:any){
      console.error("[club-arise] profile weekly rule",error?.message);
      res.status(500).json({message:"Could not load the weekly play rule."});
    }
  });

  app.post("/api/teacher/club-arise/profile-rule", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.role!=="teacher"&&!req.user.isAdmin)return res.status(403).json({message:"Teacher access required."});
      const enabled=req.body?.enabled!==false;
      let query=db().from("users").select("id,teacher_id").eq("role","student").eq("is_eye_gaze_user",false);
      if(!req.user.isAdmin)query=query.eq("teacher_id",req.user.id);
      const {data:students,error}=await query;
      if(error)throw error;
      const ids=(students||[]).map((s:any)=>s.id);
      if(ids.length){
        const {data:existing,error:existingError}=await db().from("club_arise_controls").select("*").in("student_id",ids);
        if(existingError)throw existingError;
        const current=new Map((existing||[]).map((row:any)=>[row.student_id,row]));
        const rows=(students||[]).map((student:any)=>{
          const old=current.get(student.id)||{};
          return {
            student_id:student.id,
            teacher_id:student.teacher_id||req.user.id,
            locked:!!old.locked,
            daily_game_limit:old.daily_game_limit??null,
            games_per_passed_quiz:Number(old.games_per_passed_quiz||0),
            weekly_unlimited_on_pass:enabled,
            updated_at:new Date().toISOString()
          };
        });
        const {error:saveError}=await db().from("club_arise_controls").upsert(rows,{onConflict:"student_id"});
        if(saveError)throw saveError;
      }
      res.json({enabled,studentCount:ids.length});
    }catch(error:any){
      console.error("[club-arise] save profile weekly rule",error?.message);
      res.status(500).json({message:"Could not save the weekly play rule."});
    }
  });

  app.get("/api/teacher/club-arise/controls", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.role!=="teacher"&&!req.user.isAdmin) return res.status(403).json({message:"Teacher access required."});
      let query=db().from("users").select("id,display_name,username,teacher_id").eq("role","student").eq("is_eye_gaze_user",false);
      if(!req.user.isAdmin)query=query.eq("teacher_id",req.user.id);
      const {data:students,error}=await query.order("display_name");
      if(error)throw error;
      const ids=(students||[]).map((s:any)=>s.id);
      const {data:controls}=ids.length?await db().from("club_arise_controls").select("*").in("student_id",ids):{data:[] as any[]};
      const map=new Map((controls||[]).map((x:any)=>[x.student_id,x]));
      res.json((students||[]).map((s:any)=>({
        ...s,
        control:map.get(s.id)||{student_id:s.id,teacher_id:s.teacher_id,locked:false,daily_game_limit:null,games_per_passed_quiz:0,weekly_unlimited_on_pass:true}
      })));
    }catch(error:any){
      console.error("[club-arise] teacher controls",error?.message);
      res.status(500).json({message:"Could not load Club controls."});
    }
  });

  app.post("/api/teacher/club-arise/controls/:studentId", authMiddleware, async(req:any,res)=>{
    try{
      if(req.user.role!=="teacher"&&!req.user.isAdmin) return res.status(403).json({message:"Teacher access required."});
      const studentId=Number(req.params.studentId);
      const {data:student}=await db().from("users").select("id,teacher_id,role,is_eye_gaze_user").eq("id",studentId).single();
      if(!student||student.role!=="student"||student.is_eye_gaze_user)return res.status(404).json({message:"Student not found."});
      if(!req.user.isAdmin&&student.teacher_id!==req.user.id)return res.status(403).json({message:"That student is not assigned to you."});

      const locked=!!req.body?.locked;
      const rawLimit=req.body?.dailyGameLimit;
      const dailyGameLimit=rawLimit===null||rawLimit===""||rawLimit===undefined?null:Math.max(0,Math.min(100,Math.floor(Number(rawLimit)||0)));
      const gamesPerPassedQuiz=Math.max(0,Math.min(20,Math.floor(Number(req.body?.gamesPerPassedQuiz)||0)));
      const weeklyUnlimitedOnPass=req.body?.weeklyUnlimitedOnPass!==false;
      const row={
        student_id:studentId,
        teacher_id:student.teacher_id||req.user.id,
        locked,
        daily_game_limit:dailyGameLimit,
        games_per_passed_quiz:gamesPerPassedQuiz,
        weekly_unlimited_on_pass:weeklyUnlimitedOnPass,
        updated_at:new Date().toISOString()
      };
      const {data,error}=await db().from("club_arise_controls").upsert(row,{onConflict:"student_id"}).select("*").single();
      if(error)throw error;
      res.json({control:data,access:await getClubAccess(studentId)});
    }catch(error:any){
      console.error("[club-arise] save controls",error?.message);
      res.status(500).json({message:"Could not save Club controls."});
    }
  });

  app.get("/api/club-arise/players/:id/profile", authMiddleware, async(req:any,res)=>{
    try{
      if(!isStudent(req.user)) return res.status(403).json({message:"Student account required."});
      const userId=Number(req.params.id);
      if(!Number.isInteger(userId)||userId<1) return res.status(400).json({message:"Invalid player."});

      const detail=await storage.getStudentDetail(userId);
      if(!detail) return res.status(404).json({message:"Player not found."});

      const {data:matches,error}=await db().from("club_arise_matches")
        .select("id,game_type,status,player1_id,player2_id,winner_id,state")
        .eq("status","finished")
        .or("player1_id.eq."+userId+",player2_id.eq."+userId);
      if(error)throw error;

      const finished=(matches||[]).filter((m:any)=>!m.state?.adminPreview);
      const won=(m:any)=>m.winner_id===userId||(m.state?.computer&&m.player1_id===userId&&Number(m.state?.winner)===1);
      const tied=(m:any)=>m.state?.computer?Number(m.state?.winner)===0:!m.winner_id;
      const wins=finished.filter(won).length;
      const ties=finished.filter(tied).length;
      const losses=Math.max(0,finished.length-wins-ties);
      const clubScore=wins*100+ties*40+losses*10;
      const byGame:any={};
      for(const type of ["four","word_tiles","word_rescue","math_duel","synonym_sprint","pattern_power","sentence_fix","fact_dash"]){
        const rows=finished.filter((m:any)=>m.game_type===type);
        byGame[type]={
          played:rows.length,
          wins:rows.filter(won).length,
        };
      }

      const raw=await storage.getSetting("avatar_world_"+userId);
      let characterId="robin-hood";
      if(raw){try{characterId=JSON.parse(raw)?.selectedCharacter||characterId;}catch{}}

      res.set("Cache-Control","no-store");
      res.json({
        userId,
        displayName:detail.user?.displayName||"Reader",
        characterId,
        leaderboardPoints:Math.max(0,Number(detail.totalPoints)||0),
        quizzesTaken:Math.max(0,Number(detail.quizzesTaken)||0),
        club:{played:finished.length,wins,ties,losses,score:clubScore,byGame},
      });
    }catch(error:any){
      console.error("[club-arise] profile",error?.message);
      res.status(500).json({message:"Could not load that player."});
    }
  });

  app.post("/api/club-arise/matches/join", authMiddleware, async(req:any,res)=>{
    try{
      if(!isStudent(req.user)) return res.status(403).json({message:"Student account required."});
      const gameType=String(req.body?.gameType||"");
      const computer=!!req.body?.computer;
      if(!GAME_TYPES.has(gameType)) return res.status(400).json({message:"Unknown game."});
      const access=await getClubAccess(req.user.id, req.adminPreview === "regular");
      if(!access.allowed){
        const message=access.locked
          ?"Your teacher has locked Club A.R.I.S.E. games."
          :access.dailyRemaining===0
            ?"You reached today's Club game limit."
            :"Pass another book quiz to unlock more Club games.";
        return res.status(403).json({message,access});
      }

      // Starting a game is always a fresh choice. Cancel any unfinished match
      // this student left behind so an old human/computer turn cannot reopen.
      await db().from("club_arise_matches").update({
        status:"cancelled",updated_at:new Date().toISOString(),
      }).in("status",["waiting","active"])
        .or("player1_id.eq."+req.user.id+",player2_id.eq."+req.user.id);

      if(computer){
        const {data,error}=await db().from("club_arise_matches").insert({
          game_type:gameType,status:"active",player1_id:req.user.id,player2_id:null,
          state:{...initialState(gameType),computer:true,opponentName:"Computer",adminPreview:req.adminPreview==="regular"},
        }).select("*").single();
        if(error)throw error;
        return res.json(publicMatch(data));
      }

      const freshWaitingSince=new Date(Date.now()-15*60*1000).toISOString();
      const {data:waiting}=await db().from("club_arise_matches")
        .select("*").eq("game_type",gameType).eq("status","waiting")
        .neq("player1_id",req.user.id).gte("created_at",freshWaitingSince)
        .order("created_at",{ascending:true}).limit(1);

      if(waiting?.[0]){
        const match=waiting[0];
        const {data,error}=await db().from("club_arise_matches").update({
          player2_id:req.user.id,status:"active",
          state:{...(match.state||{}),adminPreview:!!match.state?.adminPreview||req.adminPreview==="regular"},
          updated_at:new Date().toISOString(),
        }).eq("id",match.id).eq("status","waiting").select("*").single();
        if(error)throw error;
        return res.json(publicMatch(data));
      }

      const {data,error}=await db().from("club_arise_matches").insert({
        game_type:gameType,status:"waiting",player1_id:req.user.id,state:{...initialState(gameType),adminPreview:req.adminPreview==="regular"},
      }).select("*").single();
      if(error)throw error;
      res.json(publicMatch(data));
    }catch(error:any){
      console.error("[club-arise] join",error?.message);
      res.status(500).json({message:"Could not join that game."});
    }
  });

  app.post("/api/club-arise/matches/:id/leave", authMiddleware, async(req:any,res)=>{
    try{
      if(!isStudent(req.user)) return res.status(403).json({message:"Student account required."});
      const {data:match,error}=await db().from("club_arise_matches").select("id,status,player1_id,player2_id").eq("id",req.params.id).single();
      if(error||!match) return res.status(404).json({message:"Game not found."});
      if(match.player1_id!==req.user.id&&match.player2_id!==req.user.id) return res.status(403).json({message:"This is not your game."});
      if(["waiting","active"].includes(match.status)){
        const {error:updateError}=await db().from("club_arise_matches").update({
          status:"cancelled",updated_at:new Date().toISOString(),
        }).eq("id",match.id);
        if(updateError)throw updateError;
      }
      res.json({ok:true});
    }catch(error:any){
      console.error("[club-arise] leave match",error?.message);
      res.status(500).json({message:"Could not leave that game."});
    }
  });

  app.get("/api/club-arise/matches/:id", authMiddleware, async(req:any,res)=>{
    try{
      if(!isStudent(req.user)) return res.status(403).json({message:"Student account required."});
      const {data,error}=await db().from("club_arise_matches").select("*").eq("id",req.params.id).single();
      if(error||!data) return res.status(404).json({message:"Game not found."});
      if(data.player1_id!==req.user.id&&data.player2_id!==req.user.id) return res.status(403).json({message:"This is not your game."});

      const ids=[data.player1_id,data.player2_id].filter(Boolean);
      const {data:players}=await db().from("club_arise_presence").select("user_id,display_name,character_id").in("user_id",ids);
      res.set("Cache-Control","no-store");
      res.json({...publicMatch(data),players:data.state?.computer?[...(players||[]),{user_id:-1,display_name:"Computer",character_id:"computer"}]:(players||[])});
    }catch(error:any){
      res.status(500).json({message:"Could not load game."});
    }
  });

  app.post("/api/club-arise/matches/:id/action", authMiddleware, async(req:any,res)=>{
    try{
      if(!isStudent(req.user)) return res.status(403).json({message:"Student account required."});
      const {data:match,error}=await db().from("club_arise_matches").select("*").eq("id",req.params.id).single();
      if(error||!match) return res.status(404).json({message:"Game not found."});
      const playerIndex=match.player1_id===req.user.id?1:match.player2_id===req.user.id?2:0;
      if(!playerIndex) return res.status(403).json({message:"This is not your game."});
      if(match.status!=="active") return res.status(400).json({message:"Waiting for another player."});

      const state:any={...(match.state||{})};
      if(state.winner!==null&&state.winner!==undefined) return res.json(publicMatch(match));
      if(Number(state.turn)!==playerIndex) return res.status(400).json({message:"Wait for your turn."});

      if(match.game_type==="four"){
        const column=Number(req.body?.column);
        if(!Number.isInteger(column)||column<0||column>6) return res.status(400).json({message:"Pick a column."});
        if(!dropPiece(state,column,playerIndex))return res.status(400).json({message:"That column is full."});
      }else if(match.game_type==="word_rescue"){
        const letter=String(req.body?.letter||"").toUpperCase();
        if(!/^[A-Z]$/.test(letter)) return res.status(400).json({message:"Pick one letter."});
        if((state.guessed||[]).includes(letter))return res.status(400).json({message:"That letter was already picked."});
        guessLetter(state,letter,playerIndex);
      }else if(CHOICE_GAMES.has(match.game_type)){
        const q=state.questions?.[state.round];
        if(!q)return res.status(400).json({message:"This round is complete."});
        const choice=String(req.body?.choice||"");
        if(!q.options.includes(choice))return res.status(400).json({message:"Choose one of the answers."});
        answerChoice(state,playerIndex,choice);
      }else{
        const choice=String(req.body?.choice||"").toUpperCase();
        const options=state.choices?.[state.round]||[];
        if(!options.includes(choice)) return res.status(400).json({message:"Choose one of the word tiles."});
        answerTile(state,playerIndex,choice);
      }

      if(state.computer&&Number(state.turn)===2&&(state.winner===null||state.winner===undefined)){
        computerTurn(match.game_type,state);
      }

      const winnerUserId=state.winner===1?match.player1_id:state.winner===2?match.player2_id:null;
      const status=state.winner!==null&&state.winner!==undefined?"finished":"active";
      const {data,error:updateError}=await db().from("club_arise_matches").update({
        state,status,winner_id:winnerUserId,updated_at:new Date().toISOString(),
      }).eq("id",match.id).select("*").single();
      if(updateError)throw updateError;
      if(status==="finished")await awardFinishedMatch(data,state);
      res.json({...publicMatch(data),rewards_awarded:status==="finished"?true:data.rewards_awarded});
    }catch(error:any){
      console.error("[club-arise] action",error?.message);
      res.status(500).json({message:"Could not make that move."});
    }
  });
}
