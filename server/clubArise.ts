import type { Express, RequestHandler } from "express";
import { getAdminSupabase } from "./supabase";
import { storage } from "./storage";

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

const WORD_BANK = [
  {word:"BOOK",hint:"You read this."},
  {word:"FARM",hint:"A place with animals and crops."},
  {word:"SPACE",hint:"Where stars and planets are."},
  {word:"WATER",hint:"You drink this."},
  {word:"MUSIC",hint:"Songs and sounds."},
  {word:"LEARN",hint:"What you do at school."},
  {word:"STORY",hint:"A tale with characters and events."},
];

const CHOICE_BANKS: Record<string, Array<{q:string;options:string[];correct:string}>> = {
  math_duel:[
    {q:"8 × 6 = ?",options:["42","48","56"],correct:"48"},
    {q:"72 ÷ 8 = ?",options:["8","9","10"],correct:"9"},
    {q:"35 + 27 = ?",options:["52","62","72"],correct:"62"},
    {q:"90 - 46 = ?",options:["44","54","36"],correct:"44"},
  ],
  synonym_sprint:[
    {q:"Which word means almost the same as HAPPY?",options:["Glad","Angry","Slow"],correct:"Glad"},
    {q:"Which word means almost the same as QUICK?",options:["Fast","Quiet","Heavy"],correct:"Fast"},
    {q:"Which word means almost the same as BEGIN?",options:["Start","Finish","Hide"],correct:"Start"},
    {q:"Which word means almost the same as TINY?",options:["Huge","Small","Loud"],correct:"Small"},
  ],
  pattern_power:[
    {q:"2, 4, 6, 8, ?",options:["9","10","12"],correct:"10"},
    {q:"5, 10, 15, 20, ?",options:["25","30","35"],correct:"25"},
    {q:"30, 25, 20, 15, ?",options:["5","10","12"],correct:"10"},
    {q:"3, 6, 12, 24, ?",options:["30","36","48"],correct:"48"},
  ],
  sentence_fix:[
    {q:"Pick the sentence written correctly.",options:["We went to the park.","we went to the park","We Went to the Park"],correct:"We went to the park."},
    {q:"Pick the sentence written correctly.",options:["Where is my book?","Where is my book.","where is my book?"],correct:"Where is my book?"},
    {q:"Pick the sentence written correctly.",options:["I like pizza, tacos, and rice.","I like pizza tacos and rice","i like pizza, tacos, and rice."],correct:"I like pizza, tacos, and rice."},
    {q:"Pick the sentence written correctly.",options:["My dog is fast!","my dog is fast!","My dog is fast"],correct:"My dog is fast!"},
  ],
  fact_dash:[
    {q:"Which planet do we live on?",options:["Mars","Earth","Venus"],correct:"Earth"},
    {q:"Which animal is a mammal?",options:["Dolphin","Shark","Trout"],correct:"Dolphin"},
    {q:"What do plants need to make food?",options:["Sunlight","Plastic","Sand only"],correct:"Sunlight"},
    {q:"Which is the largest ocean?",options:["Atlantic","Pacific","Arctic"],correct:"Pacific"},
  ],
};

function isStudent(user:any){
  return !!user && !user.isAdmin && user.role==="student" && !user.is_eye_gaze_user;
}

function initialState(gameType:string){
  if(gameType==="four") return {
    board:Array.from({length:6},()=>Array(7).fill(null)),
    turn:1,
    winner:null,
  };
  if(gameType==="word_rescue"){
    const pick=WORD_BANK[Math.floor(Math.random()*WORD_BANK.length)];
    return {word:pick.word,hint:pick.hint,guessed:[],turn:1,winner:null,misses:0};
  }
  if(CHOICE_GAMES.has(gameType)){
    return {round:0,turn:1,scores:[0,0],questions:CHOICE_BANKS[gameType]||[],winner:null};
  }
  return {
    round:0,
    turn:1,
    scores:[0,0],
    prompt:"Build the best word",
    choices:[
      ["READ","DEAR","DARE"],
      ["BOOK","LOOK","COOK"],
      ["STAR","ARTS","RATS"],
      ["LEARN","NEAR","REAL"],
    ],
    winner:null,
  };
}

function fourWinner(board:any[][]){
  const dirs=[[1,0],[0,1],[1,1],[1,-1]];
  for(let r=0;r<6;r++)for(let c=0;c<7;c++){
    const p=board[r][c]; if(!p)continue;
    for(const [dr,dc] of dirs){
      let ok=true;
      for(let i=1;i<4;i++){
        const rr=r+dr*i,cc=c+dc*i;
        if(rr<0||rr>=6||cc<0||cc>=7||board[rr][cc]!==p){ok=false;break;}
      }
      if(ok)return p;
    }
  }
  return null;
}

async function getClubAccess(userId:number){
  const db=getAdminSupabase();
  const {data:user}=await db.from("users").select("teacher_id").eq("id",userId).single();
  const teacherId=Number(user?.teacher_id||0)||null;
  const {data:control}=await db.from("club_arise_controls").select("*").eq("student_id",userId).maybeSingle();

  const {count:passedCount}=await db.from("attempts")
    .select("id",{count:"exact",head:true})
    .eq("user_id",userId).gt("points_earned",0);

  const {data:finished}=await db.from("club_arise_matches")
    .select("id,updated_at")
    .eq("status","finished")
    .or("player1_id.eq."+userId+",player2_id.eq."+userId);

  const allGames=finished||[];
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
  const db=getAdminSupabase();
  const winnerIndex=Number(state?.winner||0);
  const winnerUserId=winnerIndex===1?match.player1_id:winnerIndex===2?match.player2_id:null;
  if(winnerUserId){
    const {data:user}=await db.from("users").select("total_points").eq("id",winnerUserId).single();
    const current=Number(user?.total_points||0);
    await db.from("users").update({total_points:Math.round((current+10)*10)/10}).eq("id",winnerUserId);
  }
  await db.from("club_arise_matches").update({rewards_awarded:true}).eq("id",match.id).eq("rewards_awarded",false);
}

export function registerClubAriseRoutes(app:Express, authMiddleware:RequestHandler){
  const db=()=>getAdminSupabase();

  app.get("/api/neighborhood/bootstrap",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"The Block is for student accounts."});
      const raw=await storage.getSetting("avatar_world_"+req.user.id);
      let state:any={};if(raw){try{state=await initializeLegacyPetCare(req.user.id,JSON.parse(raw));}catch{}}
      const detail=await storage.getStudentDetail(req.user.id);
      const visitors=activeNeighborhoodVisitors();
      const existing=neighborhoodVisitors.get(req.user.id);
      const occupied=new Set(visitors.filter(v=>v.userId!==req.user.id&&v.lot>=0).map(v=>v.lot));
      const lot=existing&&existing.lot>=0?existing.lot:(Array.from({length:10},(_,i)=>i).find(i=>!occupied.has(i))??-1);
      const lotX=[0,-12,12,-24,24,0,-12,12,-24,24][lot]??0;
      const lotZ=lot>=5?-9:9;
      const self:NeighborhoodVisitor={userId:req.user.id,displayName:detail?.user?.displayName||req.user.displayName||"Reader",
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
      x:Number.isFinite(x)?Math.max(-31,Math.min(31,x)):current.x,
      z:Number.isFinite(z)?Math.max(-22,Math.min(22,z)):current.z,
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
        const detail=await storage.getStudentDetail(req.user.id);
        const raw=await storage.getSetting("avatar_world_"+req.user.id);
        let state:any={selectedCharacter:"robin-hood"};
        if(raw){try{state=await initializeLegacyPetCare(req.user.id,{...state,...JSON.parse(raw)});}catch{}}
        return {
          displayName:detail?.user?.displayName||req.user.displayName||req.user.username||"Reader",
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
      const access=await getClubAccess(req.user.id);
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
      const detail=await storage.getStudentDetail(req.user.id);
      const row:any={
        user_id:req.user.id,
        display_name:detail?.user?.displayName||req.user.displayName||req.user.username||"Reader",
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
        .select("id,game_type,status,player1_id,player2_id,winner_id")
        .eq("status","finished")
        .or("player1_id.eq."+userId+",player2_id.eq."+userId);
      if(error)throw error;

      const finished=matches||[];
      const wins=finished.filter((m:any)=>m.winner_id===userId).length;
      const ties=finished.filter((m:any)=>!m.winner_id).length;
      const losses=Math.max(0,finished.length-wins-ties);
      const clubScore=wins*100+ties*40+losses*10;
      const byGame:any={};
      for(const type of ["four","word_tiles","word_rescue","math_duel","synonym_sprint","pattern_power","sentence_fix","fact_dash"]){
        const rows=finished.filter((m:any)=>m.game_type===type);
        byGame[type]={
          played:rows.length,
          wins:rows.filter((m:any)=>m.winner_id===userId).length,
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
      if(!GAME_TYPES.has(gameType)) return res.status(400).json({message:"Unknown game."});
      const access=await getClubAccess(req.user.id);
      if(!access.allowed){
        const message=access.locked
          ?"Your teacher has locked Club A.R.I.S.E. games."
          :access.dailyRemaining===0
            ?"You reached today's Club game limit."
            :"Pass another book quiz to unlock more Club games.";
        return res.status(403).json({message,access});
      }

      const {data:existing}=await db().from("club_arise_matches")
        .select("*")
        .eq("game_type",gameType)
        .in("status",["waiting","active"])
        .or("player1_id.eq."+req.user.id+",player2_id.eq."+req.user.id)
        .order("created_at",{ascending:false})
        .limit(1);
      if(existing?.[0]) return res.json(existing[0]);

      const {data:waiting}=await db().from("club_arise_matches")
        .select("*").eq("game_type",gameType).eq("status","waiting")
        .neq("player1_id",req.user.id).order("created_at",{ascending:true}).limit(1);

      if(waiting?.[0]){
        const match=waiting[0];
        const {data,error}=await db().from("club_arise_matches").update({
          player2_id:req.user.id,status:"active",updated_at:new Date().toISOString(),
        }).eq("id",match.id).eq("status","waiting").select("*").single();
        if(error)throw error;
        return res.json(data);
      }

      const {data,error}=await db().from("club_arise_matches").insert({
        game_type:gameType,status:"waiting",player1_id:req.user.id,state:initialState(gameType),
      }).select("*").single();
      if(error)throw error;
      res.json(data);
    }catch(error:any){
      console.error("[club-arise] join",error?.message);
      res.status(500).json({message:"Could not join that game."});
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
      res.json({...data,players:players||[]});
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
      if(state.winner) return res.json(match);
      if(Number(state.turn)!==playerIndex) return res.status(400).json({message:"Wait for your turn."});

      if(match.game_type==="four"){
        const column=Number(req.body?.column);
        if(!Number.isInteger(column)||column<0||column>6) return res.status(400).json({message:"Pick a column."});
        const board=(state.board||[]).map((r:any[])=>[...r]);
        let row=-1;
        for(let r=5;r>=0;r--)if(!board[r][column]){row=r;break;}
        if(row<0)return res.status(400).json({message:"That column is full."});
        board[row][column]=playerIndex;
        state.board=board;
        state.winner=fourWinner(board);
        state.turn=state.winner?playerIndex:(playerIndex===1?2:1);
      }else if(match.game_type==="word_rescue"){
        const letter=String(req.body?.letter||"").toUpperCase();
        if(!/^[A-Z]$/.test(letter)) return res.status(400).json({message:"Pick one letter."});
        state.guessed=Array.from(new Set([...(state.guessed||[]),letter]));
        if(!String(state.word).includes(letter))state.misses=Number(state.misses||0)+1;
        const solved=String(state.word).split("").every((ch:string)=>state.guessed.includes(ch));
        if(solved)state.winner=playerIndex;
        else if(state.misses>=8)state.winner=playerIndex===1?2:1;
        else state.turn=playerIndex===1?2:1;
      }else if(CHOICE_GAMES.has(match.game_type)){
        const q=state.questions?.[state.round];
        if(!q)return res.status(400).json({message:"This round is complete."});
        const choice=String(req.body?.choice||"");
        if(!q.options.includes(choice))return res.status(400).json({message:"Choose one of the answers."});
        state.scores=[...(state.scores||[0,0])];
        if(choice===q.correct)state.scores[playerIndex-1]=(state.scores[playerIndex-1]||0)+10;
        if(playerIndex===2){
          state.round=Number(state.round||0)+1;
          state.turn=1;
          if(state.round>=state.questions.length){
            state.winner=state.scores[0]===state.scores[1]?0:(state.scores[0]>state.scores[1]?1:2);
          }
        }else state.turn=2;
      }else{
        const choice=String(req.body?.choice||"").toUpperCase();
        const options=state.choices?.[state.round]||[];
        if(!options.includes(choice)) return res.status(400).json({message:"Choose one of the word tiles."});
        const points=choice.length;
        state.scores=[...(state.scores||[0,0])];
        state.scores[playerIndex-1]=(state.scores[playerIndex-1]||0)+points;
        if(playerIndex===2){
          state.round=Number(state.round||0)+1;
          state.turn=1;
          if(state.round>=state.choices.length){
            state.winner=state.scores[0]===state.scores[1]?0:(state.scores[0]>state.scores[1]?1:2);
          }
        }else state.turn=2;
      }

      const winnerUserId=state.winner===1?match.player1_id:state.winner===2?match.player2_id:null;
      const status=state.winner!==null&&state.winner!==undefined?"finished":"active";
      const {data,error:updateError}=await db().from("club_arise_matches").update({
        state,status,winner_id:winnerUserId,updated_at:new Date().toISOString(),
      }).eq("id",match.id).select("*").single();
      if(updateError)throw updateError;
      if(status==="finished")await awardFinishedMatch(data,state);
      res.json({...data,rewards_awarded:status==="finished"?true:data.rewards_awarded});
    }catch(error:any){
      console.error("[club-arise] action",error?.message);
      res.status(500).json({message:"Could not make that move."});
    }
  });
}
