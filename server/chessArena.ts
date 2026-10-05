import type { Express, RequestHandler } from "express";
import { getAdminSupabase } from "./supabase";
import {
  initialChessState, applyChessMove, computerChessTurn, tickClock, chessStatusText, replayChessMoves,
  CHESS_HINTS_PER_GAME, CHESS_UNDOS_PER_GAME, type ChessState,
} from "./chessEngine";
import { pickChessMove } from "./chessAI";
import { runComputer } from "./computerGovernor";
import { awardPoints, decideRewards } from "./arcadeMatches";
import { clashView, forgetClashBoard } from "./chessCompetition";

function isStudent(user:any){return !!user&&!user.isAdmin&&user.role==="student"&&!user.is_eye_gaze_user;}

async function chessAccess(userId:number){
  const db=getAdminSupabase();
  const {data:user}=await db.from("users").select("teacher_id,username").eq("id",userId).single();
  const teacherId=Number(user?.teacher_id||0)||null;
  if(String(user?.username||"").startsWith("sample"))return {allowed:true,locked:false,teacherId,dailyRemaining:null,automaticRemaining:null,sample:true};
  const {data:control}=await db.from("club_arise_controls").select("*").eq("student_id",userId).maybeSingle();
  const {count:passedCount}=await db.from("attempts").select("id",{count:"exact",head:true}).eq("user_id",userId).gt("points_earned",0);
  const {data:finished}=await db.from("club_arise_matches").select("id,updated_at").eq("status","finished").or("player1_id.eq."+userId+",player2_id.eq."+userId);
  const games=finished||[];const today=new Date().toISOString().slice(0,10);const gamesToday=games.filter((m:any)=>String(m.updated_at||"").slice(0,10)===today).length;
  const dailyLimit=control?.daily_game_limit===null||control?.daily_game_limit===undefined?null:Number(control.daily_game_limit);
  const perQuiz=Math.max(0,Number(control?.games_per_passed_quiz||0));const allowance=perQuiz>0?(passedCount||0)*perQuiz:null;
  const dailyRemaining=dailyLimit===null?null:Math.max(0,dailyLimit-gamesToday);const automaticRemaining=allowance===null?null:Math.max(0,allowance-games.length);const locked=!!control?.locked;
  return {allowed:!locked&&(dailyRemaining===null||dailyRemaining>0)&&(automaticRemaining===null||automaticRemaining>0),locked,teacherId,dailyRemaining,automaticRemaining};
}

async function namesFor(ids:number[]){
  if(!ids.length)return new Map<number,string>();
  const {data}=await getAdminSupabase().from("users").select("id,display_name,username").in("id",ids);
  return new Map((data||[]).map((u:any)=>[u.id,String(u.display_name||u.username||"Reader")]));
}

/** What the browser sees: no position history (it grows large), plus how many hints and take-backs are left. */
function publicState(state:ChessState){
  const {history:_history,rewards:_rewards,...rest}=state;
  return {
    ...rest,
    hintsLeft:state.computer?Math.max(0,CHESS_HINTS_PER_GAME-(state.hintsUsed||0)):0,
    undosLeft:state.computer&&Array.isArray(state.uci)?Math.max(0,CHESS_UNDOS_PER_GAME-(state.undosUsed||0)):0,
  };
}

async function publicMatch(match:any,userId:number,extra:Record<string,unknown>={}){
  const ids=[Number(match.player1_id),Number(match.player2_id)].filter(Boolean);const names=await namesFor(ids);const state=match.state as ChessState;
  const youAre=match.player1_id===userId?1:2;
  return {...match,
    state:publicState(state),
    statusText:chessStatusText(state),
    youAre,
    reward:state.rewards?.[String(youAre)]||null,
    players:[
      {user_id:match.player1_id,display_name:names.get(match.player1_id)||"White"},
      state.computer?{user_id:-1,display_name:"A.R.I.S.E. Chess AI"}:{user_id:match.player2_id,display_name:names.get(match.player2_id)||"Black"},
    ],
    ...extra,
  };
}

export function registerChessArenaRoutes(app:Express,authMiddleware:RequestHandler){
  const db=()=>getAdminSupabase();
  const load=async(id:string)=>{const {data,error}=await db().from("club_arise_matches").select("*").eq("id",id).eq("game_type","chess").maybeSingle();if(error)throw error;return data;};

  /** Saves only if nobody else changed the match first (state.v). Older matches without v save plainly. Returns null on a conflict. */
  const save=async(match:any,state:ChessState,patch:Record<string,unknown>={})=>{
    const prevV=typeof match.state?.v==="number"?match.state.v:null;
    let query=db().from("club_arise_matches").update({state:{...state,v:(prevV||0)+1},updated_at:new Date().toISOString(),...patch}).eq("id",match.id).eq("status",match.status);
    if(prevV!==null)query=query.eq("state->>v",String(prevV));
    const {data,error}=await query.select("*");
    if(error)throw error;
    return data&&data.length?data[0]:null;
  };

  /** Ends a match: daily reward caps are decided, then leaderboard points are added once. */
  const finish=async(match:any,state:ChessState)=>{
    const rewards=await decideRewards(match,state);
    const winnerUserId=state.winner===1?match.player1_id:state.winner===2?match.player2_id:null;
    const saved=await save(match,{...state,rewards},{status:"finished",winner_id:winnerUserId});
    if(saved){forgetClashBoard();await awardPoints(saved);}
    return saved;
  };

  const conflict=async(res:any,id:string,userId:number)=>{
    const latest=await load(id);
    res.status(409).json({message:"The board changed. Try that again.",match:latest?await publicMatch(latest,userId):null});
  };

  app.get("/api/chess/bootstrap",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Ultimate Chess is for student accounts."});
      const access=await chessAccess(req.user.id);const names=await namesFor([req.user.id]);
      res.set("Cache-Control","no-store");res.json({self:{userId:req.user.id,displayName:names.get(req.user.id)||"Reader"},access});
    }catch(error:any){console.error("[chess] bootstrap",error?.message);res.status(500).json({message:"Could not enter Ultimate Chess."});}
  });

  app.post("/api/chess/matches/join",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const access=await chessAccess(req.user.id);if(!access.allowed)return res.status(403).json({message:access.locked?"Your teacher has locked game play.":"You need another available game play to start Chess.",access});
      const computer=!!req.body?.computer;const computerLevel=Math.max(1,Math.min(4,Math.floor(Number(req.body?.computerLevel)||2)));const timeControlSec=Math.max(60,Math.min(3600,Math.floor(Number(req.body?.timeControlSec)||600)));
      await db().from("club_arise_matches").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("game_type","chess").in("status",["waiting","active"]).or("player1_id.eq."+req.user.id+",player2_id.eq."+req.user.id);
      if(computer){
        const state=initialChessState({computer:true,computerLevel,timeControlSec});
        const {data,error}=await db().from("club_arise_matches").insert({game_type:"chess",status:"active",player1_id:req.user.id,player2_id:null,state}).select("*").single();if(error)throw error;
        return res.json(await publicMatch(data,req.user.id));
      }
      const since=new Date(Date.now()-15*60*1000).toISOString();
      const {data:waiting}=await db().from("club_arise_matches").select("*").eq("game_type","chess").eq("status","waiting").neq("player1_id",req.user.id).gte("created_at",since).order("created_at",{ascending:true}).limit(1);
      if(waiting?.[0]){
        const state={...(waiting[0].state||initialChessState({timeControlSec})),lastTickAt:Date.now()};
        const {data,error}=await db().from("club_arise_matches").update({player2_id:req.user.id,status:"active",state,updated_at:new Date().toISOString()}).eq("id",waiting[0].id).eq("status","waiting").select("*").single();if(error)throw error;
        return res.json(await publicMatch(data,req.user.id));
      }
      const state=initialChessState({timeControlSec});
      const {data,error}=await db().from("club_arise_matches").insert({game_type:"chess",status:"waiting",player1_id:req.user.id,state}).select("*").single();if(error)throw error;
      res.json(await publicMatch(data,req.user.id));
    }catch(error:any){console.error("[chess] join",error?.message);res.status(500).json({message:"Could not start that chess match."});}
  });

  app.get("/api/chess/matches/:id",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const match=await load(req.params.id);if(!match)return res.status(404).json({message:"Chess match not found."});
      if(match.player1_id!==req.user.id&&match.player2_id!==req.user.id)return res.status(403).json({message:"This is not your match."});
      let state=match.state as ChessState;
      if(match.status==="active"){
        state=tickClock({...match.state,board:(match.state?.board||[]).map((r:any[])=>[...r]),clocks:[...(match.state?.clocks||[])]} as ChessState,Date.now());
        if(state.winner!==null){
          const saved=await finish(match,state);
          const latest=saved||await load(match.id);
          return res.json(await publicMatch(latest,req.user.id));
        }
      }
      res.set("Cache-Control","no-store");res.json(await publicMatch({...match,state},req.user.id));
    }catch(error:any){console.error("[chess] get",error?.message);res.status(500).json({message:"Could not load the chess match."});}
  });

  app.post("/api/chess/matches/:id/action",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const match=await load(req.params.id);if(!match)return res.status(404).json({message:"Chess match not found."});
      const playerIndex=match.player1_id===req.user.id?1:match.player2_id===req.user.id?2:0;if(!playerIndex)return res.status(403).json({message:"This is not your match."});if(match.status!=="active")return res.status(400).json({message:match.status==="waiting"?"Waiting for another reader.":"This game is over."});
      let state=applyChessMove(match.state as ChessState,{from:String(req.body?.from||""),to:String(req.body?.to||""),promotion:req.body?.promotion?String(req.body.promotion):undefined},playerIndex as 1|2,Date.now());
      // Against the computer the reply comes back in the same request; "interim" lets the board show your move first.
      let interim:ChessState|null=null;
      if(state.computer&&state.turn===2&&state.winner===null){interim=state;state=computerChessTurn(state,Date.now(),runComputer);}
      const saved=state.winner!==null?await finish(match,state):await save(match,state);
      if(!saved)return conflict(res,match.id,req.user.id);
      res.json(await publicMatch(saved,req.user.id,interim?{interim:publicState(interim)}:{}));
    }catch(error:any){console.error("[chess] move",error?.message);const msg=String(error?.message||"");res.status(/legal|turn|piece/i.test(msg)?400:500).json({message:msg||"Could not make that move."});}
  });

  // Hints and take-backs are for games against the computer, a few per game.
  app.post("/api/chess/matches/:id/hint",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const match=await load(req.params.id);if(!match)return res.status(404).json({message:"Chess match not found."});
      if(match.player1_id!==req.user.id)return res.status(403).json({message:"This is not your match."});
      const state=match.state as ChessState;
      if(!state.computer)return res.status(400).json({message:"Hints are for games against the computer."});
      if(match.status!=="active"||state.winner!==null||state.turn!==1)return res.status(400).json({message:"Hints work on your turn."});
      if((state.hintsUsed||0)>=CHESS_HINTS_PER_GAME)return res.status(400).json({message:"No hints left in this game."});
      const pick=runComputer(()=>pickChessMove(state,4));
      if(!pick)return res.status(400).json({message:"There is no move to suggest."});
      const saved=await save(match,{...state,hintsUsed:(state.hintsUsed||0)+1});
      if(!saved)return conflict(res,match.id,req.user.id);
      res.json(await publicMatch(saved,req.user.id,{hint:{from:pick.from,to:pick.to}}));
    }catch(error:any){console.error("[chess] hint",error?.message);res.status(500).json({message:"Could not find a hint."});}
  });

  app.post("/api/chess/matches/:id/undo",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const match=await load(req.params.id);if(!match)return res.status(404).json({message:"Chess match not found."});
      if(match.player1_id!==req.user.id)return res.status(403).json({message:"This is not your match."});
      const state=match.state as ChessState;
      if(!state.computer)return res.status(400).json({message:"Take-backs are for games against the computer."});
      if(match.status!=="active"||state.winner!==null)return res.status(400).json({message:"Take-backs work while the game is going."});
      if(!Array.isArray(state.uci))return res.status(400).json({message:"Take-backs work in new games."});
      if(state.turn!==1||state.uci.length<2)return res.status(400).json({message:"There is no move to take back yet."});
      if((state.undosUsed||0)>=CHESS_UNDOS_PER_GAME)return res.status(400).json({message:"No take-backs left in this game."});
      const ticked=tickClock({...state,clocks:[...state.clocks] as [number,number]},Date.now());
      if(ticked.winner!==null){const saved=await finish(match,ticked);return res.json(await publicMatch(saved||await load(match.id),req.user.id));}
      const rebuilt=replayChessMoves({...ticked,undosUsed:(state.undosUsed||0)+1},state.uci.slice(0,-2));
      const saved=await save(match,rebuilt);
      if(!saved)return conflict(res,match.id,req.user.id);
      res.json(await publicMatch(saved,req.user.id));
    }catch(error:any){console.error("[chess] undo",error?.message);res.status(500).json({message:"Could not take that move back."});}
  });

  app.post("/api/chess/matches/:id/resign",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const match=await load(req.params.id);if(!match)return res.status(404).json({message:"Chess match not found."});
      const idx=match.player1_id===req.user.id?1:match.player2_id===req.user.id?2:0;if(!idx)return res.status(403).json({message:"This is not your match."});
      if(match.status!=="active"&&match.status!=="waiting")return res.json(await publicMatch(match,req.user.id));
      if(match.status==="waiting"){const {data:cancelled}=await db().from("club_arise_matches").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",match.id).select("*").single();return res.json(await publicMatch(cancelled,req.user.id));}
      const state={...(match.state as ChessState),winner:(idx===1?2:1) as 1|2,result:"resignation",legalMoves:[],lastTickAt:Date.now()};
      const saved=await finish(match,state);
      if(!saved)return conflict(res,match.id,req.user.id);
      res.json(await publicMatch(saved,req.user.id));
    }catch(error:any){console.error("[chess] resign",error?.message);res.status(500).json({message:"Could not resign that match."});}
  });

  app.post("/api/chess/matches/:id/leave",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});const {data:match}=await db().from("club_arise_matches").select("id,status,player1_id,player2_id").eq("id",req.params.id).eq("game_type","chess").single();if(!match)return res.status(404).json({message:"Match not found."});if(match.player1_id!==req.user.id&&match.player2_id!==req.user.id)return res.status(403).json({message:"This is not your match."});if(match.status==="waiting")await db().from("club_arise_matches").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",match.id);res.json({ok:true});
    }catch(error:any){res.status(500).json({message:"Could not leave the chess match."});}
  });

  app.get("/api/chess/leaderboard",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const {data:matches,error}=await db().from("club_arise_matches").select("id,player1_id,player2_id,state,created_at").eq("game_type","chess").eq("status","finished").order("created_at",{ascending:true});if(error)throw error;
      const stats=new Map<number,{userId:number;wins:number;draws:number;losses:number;games:number;points:number}>();
      const ensure=(id:number)=>{if(!stats.has(id))stats.set(id,{userId:id,wins:0,draws:0,losses:0,games:0,points:0});return stats.get(id)!;};
      for(const match of matches||[]){const p1=Number(match.player1_id||0),p2=Number(match.player2_id||0),winner=Number(match.state?.winner);if(p1){const s=ensure(p1);s.games++;if(winner===1){s.wins++;s.points+=3;}else if(winner===0){s.draws++;s.points+=1;}else s.losses++;}if(p2){const s=ensure(p2);s.games++;if(winner===2){s.wins++;s.points+=3;}else if(winner===0){s.draws++;s.points+=1;}else s.losses++;}}
      const ids=[...stats.keys()];const names=await namesFor(ids);const rows=[...stats.values()].map(s=>({...s,displayName:names.get(s.userId)||"Reader",winRate:s.games?Math.round(s.wins/s.games*100):0})).sort((a,b)=>b.points-a.points||b.wins-a.wins||a.losses-b.losses).map((row,i)=>({...row,rank:i+1}));
      res.set("Cache-Control","no-store");res.json(rows);
    }catch(error:any){console.error("[chess] leaderboard",error?.message);res.status(500).json({message:"Could not load the chess leaderboard."});}
  });

  // The competition: its dates, the top of its board and the reader's own place (shared/chessCompetition.ts).
  app.get("/api/chess/competition",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      res.set("Cache-Control","no-store");res.json(await clashView(db(),req.user.id,Date.now(),req.query?.fresh==="1"));
    }catch(error:any){console.error("[chess] competition",error?.message);res.status(500).json({message:"Could not load the chess competition."});}
  });
}
