import type { Express, RequestHandler } from "express";
import { getAdminSupabase } from "./supabase";
import { initialChessState, applyChessMove, computerChessTurn, tickClock, chessStatusText, type ChessState } from "./chessEngine";

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

async function awardChessWinner(match:any,state:ChessState){
  if(match.rewards_awarded)return;
  const winnerUserId=state.winner===1?match.player1_id:state.winner===2?match.player2_id:null;
  const db=getAdminSupabase();
  if(winnerUserId){
    const {data:user}=await db.from("users").select("total_points,username").eq("id",winnerUserId).single();
    if(user&&!String(user.username||"").startsWith("sample"))await db.from("users").update({total_points:Math.round((Number(user.total_points||0)+10)*10)/10}).eq("id",winnerUserId);
  }
  await db.from("club_arise_matches").update({rewards_awarded:true}).eq("id",match.id).eq("rewards_awarded",false);
}

async function publicMatch(match:any,userId:number){
  const ids=[Number(match.player1_id),Number(match.player2_id)].filter(Boolean);const names=await namesFor(ids);const state=match.state as ChessState;
  return {...match,
    statusText:chessStatusText(state),
    youAre:match.player1_id===userId?1:2,
    players:[
      {user_id:match.player1_id,display_name:names.get(match.player1_id)||"White"},
      state.computer?{user_id:-1,display_name:"A.R.I.S.E. Chess AI"}:{user_id:match.player2_id,display_name:names.get(match.player2_id)||"Black"},
    ]
  };
}

export function registerChessArenaRoutes(app:Express,authMiddleware:RequestHandler){
  const db=()=>getAdminSupabase();

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
      const {data:match,error}=await db().from("club_arise_matches").select("*").eq("id",req.params.id).eq("game_type","chess").single();if(error||!match)return res.status(404).json({message:"Chess match not found."});
      if(match.player1_id!==req.user.id&&match.player2_id!==req.user.id)return res.status(403).json({message:"This is not your match."});
      let state=match.state as ChessState;
      if(match.status==="active"){
        state=tickClock({...match.state,board:(match.state?.board||[]).map((r:any[])=>[...r]),clocks:[...(match.state?.clocks||[])]} as ChessState,Date.now());
        if(state.winner!==null){const winnerUserId=state.winner===1?match.player1_id:state.winner===2?match.player2_id:null;const {data:updated,error:updateError}=await db().from("club_arise_matches").update({state,status:"finished",winner_id:winnerUserId,updated_at:new Date().toISOString()}).eq("id",match.id).select("*").single();if(updateError)throw updateError;await awardChessWinner(updated,state);return res.json(await publicMatch({...updated,rewards_awarded:true},req.user.id));}
      }
      res.set("Cache-Control","no-store");res.json(await publicMatch({...match,state},req.user.id));
    }catch(error:any){console.error("[chess] get",error?.message);res.status(500).json({message:"Could not load the chess match."});}
  });

  app.post("/api/chess/matches/:id/action",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const {data:match,error}=await db().from("club_arise_matches").select("*").eq("id",req.params.id).eq("game_type","chess").single();if(error||!match)return res.status(404).json({message:"Chess match not found."});
      const playerIndex=match.player1_id===req.user.id?1:match.player2_id===req.user.id?2:0;if(!playerIndex)return res.status(403).json({message:"This is not your match."});if(match.status!=="active")return res.status(400).json({message:"Waiting for another reader."});
      let state=applyChessMove(match.state as ChessState,{from:String(req.body?.from||""),to:String(req.body?.to||""),promotion:req.body?.promotion?String(req.body.promotion):undefined},playerIndex as 1|2,Date.now());
      if(state.computer&&state.turn===2&&state.winner===null)state=computerChessTurn(state,Date.now());
      const finished=state.winner!==null;const winnerUserId=state.winner===1?match.player1_id:state.winner===2?match.player2_id:null;
      const {data:updated,error:updateError}=await db().from("club_arise_matches").update({state,status:finished?"finished":"active",winner_id:winnerUserId,updated_at:new Date().toISOString()}).eq("id",match.id).select("*").single();if(updateError)throw updateError;if(finished)await awardChessWinner(updated,state);
      res.json(await publicMatch({...updated,rewards_awarded:finished?true:updated.rewards_awarded},req.user.id));
    }catch(error:any){console.error("[chess] move",error?.message);const msg=String(error?.message||"");res.status(/legal|turn|piece/i.test(msg)?400:500).json({message:msg||"Could not make that move."});}
  });

  app.post("/api/chess/matches/:id/resign",authMiddleware,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const {data:match,error}=await db().from("club_arise_matches").select("*").eq("id",req.params.id).eq("game_type","chess").single();if(error||!match)return res.status(404).json({message:"Chess match not found."});
      const idx=match.player1_id===req.user.id?1:match.player2_id===req.user.id?2:0;if(!idx)return res.status(403).json({message:"This is not your match."});
      if(match.status!=="active"&&match.status!=="waiting")return res.json(await publicMatch(match,req.user.id));
      if(match.status==="waiting"){const {data:cancelled}=await db().from("club_arise_matches").update({status:"cancelled",updated_at:new Date().toISOString()}).eq("id",match.id).select("*").single();return res.json(await publicMatch(cancelled,req.user.id));}
      const state={...(match.state as ChessState),winner:(idx===1?2:1) as 1|2,result:"resignation",legalMoves:[],lastTickAt:Date.now()};const winnerUserId=state.winner===1?match.player1_id:match.player2_id;
      const {data:updated,error:updateError}=await db().from("club_arise_matches").update({state,status:"finished",winner_id:winnerUserId,updated_at:new Date().toISOString()}).eq("id",match.id).select("*").single();if(updateError)throw updateError;await awardChessWinner(updated,state as ChessState);res.json(await publicMatch({...updated,rewards_awarded:true},req.user.id));
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
}
