export type ChessColor = "w" | "b";
export type ChessPieceType = "p" | "n" | "b" | "r" | "q" | "k";
export type ChessPiece = string;
export type ChessMove = { from:string; to:string; promotion?:"q"|"r"|"b"|"n"; capture?:boolean; castle?:"k"|"q"; enPassant?:boolean };
export type ChessState = {
  board:(ChessPiece|null)[][];
  turn:1|2;
  winner:0|1|2|null;
  result:string|null;
  check:boolean;
  castling:{wK:boolean;wQ:boolean;bK:boolean;bQ:boolean};
  enPassant:string|null;
  halfmove:number;
  fullmove:number;
  history:string[];
  moveHistory:string[];
  captured:ChessPiece[];
  legalMoves:ChessMove[];
  lastMove:ChessMove|null;
  computer?:boolean;
  computerLevel?:number;
  timeControlSec:number;
  clocks:[number,number];
  lastTickAt:number;
};

const FILES="abcdefgh";
const DIRS_BISHOP=[[-1,-1],[-1,1],[1,-1],[1,1]] as const;
const DIRS_ROOK=[[-1,0],[1,0],[0,-1],[0,1]] as const;
const KNIGHT=[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]] as const;
const PIECE_VALUE:Record<string,number>={p:100,n:320,b:330,r:500,q:900,k:20000};

function piece(color:ChessColor,type:ChessPieceType):ChessPiece{return color+type.toUpperCase();}
function colorOf(p:ChessPiece|null):ChessColor|null{return p?p[0] as ChessColor:null;}
function typeOf(p:ChessPiece|null):ChessPieceType|null{return p?p[1].toLowerCase() as ChessPieceType:null;}
function other(c:ChessColor):ChessColor{return c==="w"?"b":"w";}
function inBounds(r:number,c:number){return r>=0&&r<8&&c>=0&&c<8;}
export function squareToRC(square:string){const c=FILES.indexOf(square[0]);const rank=Number(square[1]);return {r:8-rank,c};}
export function rcToSquare(r:number,c:number){return FILES[c]+(8-r);}
function cloneBoard(board:(ChessPiece|null)[][]){return board.map(row=>[...row]);}

export function initialChessState(opts?:{computer?:boolean;computerLevel?:number;timeControlSec?:number}):ChessState{
  const board:(ChessPiece|null)[][]=Array.from({length:8},()=>Array(8).fill(null));
  const order:ChessPieceType[]=["r","n","b","q","k","b","n","r"];
  for(let c=0;c<8;c++){
    board[0][c]=piece("b",order[c]);board[1][c]=piece("b","p");
    board[6][c]=piece("w","p");board[7][c]=piece("w",order[c]);
  }
  const sec=Math.max(60,Math.min(3600,Number(opts?.timeControlSec)||600));
  const state:ChessState={board,turn:1,winner:null,result:null,check:false,castling:{wK:true,wQ:true,bK:true,bQ:true},enPassant:null,halfmove:0,fullmove:1,history:[],moveHistory:[],captured:[],legalMoves:[],lastMove:null,computer:!!opts?.computer,computerLevel:Math.max(1,Math.min(4,Number(opts?.computerLevel)||2)),timeControlSec:sec,clocks:[sec*1000,sec*1000],lastTickAt:Date.now()};
  state.history=[positionKey(state)];
  state.legalMoves=generateLegalMoves(state,"w");
  return state;
}

function findKing(board:(ChessPiece|null)[][],color:ChessColor){for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(board[r][c]===piece(color,"k"))return {r,c};return null;}
function pathMoves(board:(ChessPiece|null)[][],r:number,c:number,color:ChessColor,dirs:readonly (readonly [number,number])[]){
  const out:ChessMove[]=[];
  for(const [dr,dc] of dirs){for(let rr=r+dr,cc=c+dc;inBounds(rr,cc);rr+=dr,cc+=dc){const target=board[rr][cc];if(!target)out.push({from:rcToSquare(r,c),to:rcToSquare(rr,cc)});else{if(colorOf(target)!==color)out.push({from:rcToSquare(r,c),to:rcToSquare(rr,cc),capture:true});break;}}}
  return out;
}

export function isSquareAttacked(state:ChessState,r:number,c:number,by:ChessColor){
  const b=state.board;
  const pawnDir=by==="w"?-1:1;
  for(const dc of [-1,1]){const rr=r-pawnDir,cc=c-dc;if(inBounds(rr,cc)&&b[rr][cc]===piece(by,"p"))return true;}
  for(const [dr,dc] of KNIGHT){const rr=r+dr,cc=c+dc;if(inBounds(rr,cc)&&b[rr][cc]===piece(by,"n"))return true;}
  for(const [dr,dc] of DIRS_BISHOP){for(let rr=r+dr,cc=c+dc;inBounds(rr,cc);rr+=dr,cc+=dc){const p=b[rr][cc];if(!p)continue;if(colorOf(p)===by&&(typeOf(p)==="b"||typeOf(p)==="q"))return true;break;}}
  for(const [dr,dc] of DIRS_ROOK){for(let rr=r+dr,cc=c+dc;inBounds(rr,cc);rr+=dr,cc+=dc){const p=b[rr][cc];if(!p)continue;if(colorOf(p)===by&&(typeOf(p)==="r"||typeOf(p)==="q"))return true;break;}}
  for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc){const rr=r+dr,cc=c+dc;if(inBounds(rr,cc)&&b[rr][cc]===piece(by,"k"))return true;}
  return false;
}

export function inCheck(state:ChessState,color:ChessColor){const k=findKing(state.board,color);return !!k&&isSquareAttacked(state,k.r,k.c,other(color));}

function pseudoMoves(state:ChessState,r:number,c:number,includeCastle=true){
  const p=state.board[r][c];if(!p)return [] as ChessMove[];
  const color=colorOf(p)!;const type=typeOf(p)!;const from=rcToSquare(r,c);const out:ChessMove[]=[];
  if(type==="p"){
    const dir=color==="w"?-1:1,start=color==="w"?6:1,promoRow=color==="w"?0:7;
    const one=r+dir;
    if(inBounds(one,c)&&!state.board[one][c]){
      if(one===promoRow)for(const promotion of ["q","r","b","n"] as const)out.push({from,to:rcToSquare(one,c),promotion});
      else out.push({from,to:rcToSquare(one,c)});
      const two=r+dir*2;if(r===start&&!state.board[two][c])out.push({from,to:rcToSquare(two,c)});
    }
    for(const dc of [-1,1]){const rr=r+dir,cc=c+dc;if(!inBounds(rr,cc))continue;const target=state.board[rr][cc];const sq=rcToSquare(rr,cc);
      if(target&&colorOf(target)!==color){if(rr===promoRow)for(const promotion of ["q","r","b","n"] as const)out.push({from,to:sq,promotion,capture:true});else out.push({from,to:sq,capture:true});}
      else if(state.enPassant===sq)out.push({from,to:sq,capture:true,enPassant:true});
    }
  } else if(type==="n"){
    for(const [dr,dc] of KNIGHT){const rr=r+dr,cc=c+dc;if(!inBounds(rr,cc))continue;const target=state.board[rr][cc];if(!target||colorOf(target)!==color)out.push({from,to:rcToSquare(rr,cc),capture:!!target});}
  } else if(type==="b") out.push(...pathMoves(state.board,r,c,color,DIRS_BISHOP));
  else if(type==="r") out.push(...pathMoves(state.board,r,c,color,DIRS_ROOK));
  else if(type==="q") out.push(...pathMoves(state.board,r,c,color,[...DIRS_BISHOP,...DIRS_ROOK]));
  else if(type==="k"){
    for(let dr=-1;dr<=1;dr++)for(let dc=-1;dc<=1;dc++)if(dr||dc){const rr=r+dr,cc=c+dc;if(!inBounds(rr,cc))continue;const target=state.board[rr][cc];if(!target||colorOf(target)!==color)out.push({from,to:rcToSquare(rr,cc),capture:!!target});}
    if(includeCastle&&!inCheck(state,color)){
      const row=color==="w"?7:0,rights=color==="w"?state.castling.wK:state.castling.bK;
      if(r===row&&c===4&&rights&&state.board[row][5]===null&&state.board[row][6]===null&&state.board[row][7]===piece(color,"r")&&!isSquareAttacked(state,row,5,other(color))&&!isSquareAttacked(state,row,6,other(color)))out.push({from,to:rcToSquare(row,6),castle:"k"});
      const qrights=color==="w"?state.castling.wQ:state.castling.bQ;
      if(r===row&&c===4&&qrights&&state.board[row][1]===null&&state.board[row][2]===null&&state.board[row][3]===null&&state.board[row][0]===piece(color,"r")&&!isSquareAttacked(state,row,3,other(color))&&!isSquareAttacked(state,row,2,other(color)))out.push({from,to:rcToSquare(row,2),castle:"q"});
    }
  }
  return out;
}

function applyBoardMove(state:ChessState,move:ChessMove){
  const board=cloneBoard(state.board);const a=squareToRC(move.from),z=squareToRC(move.to);const moving=board[a.r][a.c];if(!moving)throw new Error("No piece on that square.");
  let captured=board[z.r][z.c];
  board[a.r][a.c]=null;
  if(move.enPassant){const capRow=z.r+(colorOf(moving)==="w"?1:-1);captured=board[capRow][z.c];board[capRow][z.c]=null;}
  board[z.r][z.c]=move.promotion?piece(colorOf(moving)!,move.promotion):moving;
  if(move.castle){const row=a.r;if(move.castle==="k"){board[row][5]=board[row][7];board[row][7]=null;}else{board[row][3]=board[row][0];board[row][0]=null;}}
  return {board,captured,moving};
}

export function generateLegalMoves(state:ChessState,color:ChessColor){
  const out:ChessMove[]=[];
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=state.board[r][c];if(colorOf(p)!==color)continue;
    for(const mv of pseudoMoves(state,r,c,true)){
      const {board}=applyBoardMove(state,mv);const test={...state,board} as ChessState;if(!inCheck(test,color))out.push(mv);
    }
  }
  return out;
}

function updateCastleRights(state:ChessState,move:ChessMove,moving:ChessPiece,captured:ChessPiece|null){
  const next={...state.castling};
  if(moving==="wK"){next.wK=false;next.wQ=false;} if(moving==="bK"){next.bK=false;next.bQ=false;}
  if(move.from==="a1"||move.to==="a1"&&captured==="wR")next.wQ=false;
  if(move.from==="h1"||move.to==="h1"&&captured==="wR")next.wK=false;
  if(move.from==="a8"||move.to==="a8"&&captured==="bR")next.bQ=false;
  if(move.from==="h8"||move.to==="h8"&&captured==="bR")next.bK=false;
  return next;
}

function notation(state:ChessState,move:ChessMove,moving:ChessPiece,captured:ChessPiece|null,after:ChessState){
  if(move.castle==="k")return "O-O"+(after.check?"+":"");
  if(move.castle==="q")return "O-O-O"+(after.check?"+":"");
  const t=typeOf(moving)!;const label=t==="p"?"":t.toUpperCase();const capture=captured||move.enPassant?"x":"";const promo=move.promotion?"="+move.promotion.toUpperCase():"";return label+(capture?move.from[0]:"")+capture+move.to+promo+(after.check?"+":"");
}

function positionKey(state:ChessState){
  return state.board.map(row=>row.map(x=>x||"--").join("")).join("/")+":"+state.turn+":"+(state.castling.wK?1:0)+(state.castling.wQ?1:0)+(state.castling.bK?1:0)+(state.castling.bQ?1:0)+":"+(state.enPassant||"-");
}

function insufficient(board:(ChessPiece|null)[][]){
  const pieces:ChessPiece[]=[];for(const row of board)for(const p of row)if(p)pieces.push(p);
  const nonKings=pieces.filter(p=>typeOf(p) !== "k");
  if(nonKings.length===0)return true;
  if(nonKings.length===1&&["b","n"].includes(typeOf(nonKings[0])!))return true;
  if(nonKings.every(p=>typeOf(p)==="b")){
    const squares:number[]=[];for(let r=0;r<8;r++)for(let c=0;c<8;c++)if(typeOf(board[r][c])==="b")squares.push((r+c)%2);
    return squares.every(x=>x===squares[0]);
  }
  return false;
}

function finalizeTurn(state:ChessState,movedBy:1|2){
  const nextColor:ChessColor=state.turn===1?"w":"b";state.check=inCheck(state,nextColor);state.legalMoves=generateLegalMoves(state,nextColor);
  if(state.legalMoves.length===0){if(state.check){state.winner=movedBy;state.result="checkmate";}else{state.winner=0;state.result="stalemate";}return;}
  if(insufficient(state.board)){state.winner=0;state.result="insufficient-material";return;}
  if(state.halfmove>=100){state.winner=0;state.result="fifty-move";return;}
  const key=positionKey(state);state.history=[...state.history,key].slice(-160);if(state.history.filter(x=>x===key).length>=3){state.winner=0;state.result="threefold-repetition";}
}

export function applyChessMove(input:ChessState,moveInput:{from:string;to:string;promotion?:string},playerIndex:1|2,now=Date.now()){
  const state:ChessState={...input,board:cloneBoard(input.board),castling:{...input.castling},history:[...(input.history||[])],moveHistory:[...(input.moveHistory||[])],captured:[...(input.captured||[])],clocks:[...(input.clocks||[600000,600000])] as [number,number]};
  if(state.winner!==null)return state;
  tickClock(state,now);if(state.winner!==null)return state;
  if(state.turn!==playerIndex)throw new Error("Wait for your turn.");
  const color:ChessColor=playerIndex===1?"w":"b";
  const legal=generateLegalMoves(state,color).filter(m=>m.from===moveInput.from&&m.to===moveInput.to);
  if(!legal.length)throw new Error("That move is not legal.");
  let chosen=legal[0];
  if(legal.some(m=>m.promotion)){const promo=(String(moveInput.promotion||"q").toLowerCase()) as "q"|"r"|"b"|"n";chosen=legal.find(m=>m.promotion===promo)||legal.find(m=>m.promotion==="q")||legal[0];}
  const a=squareToRC(chosen.from);const moving=state.board[a.r][a.c]!;const {board,captured}=applyBoardMove(state,chosen);state.board=board;
  state.castling=updateCastleRights(state,chosen,moving,captured||null);
  state.enPassant=null;
  if(typeOf(moving)==="p"){const z=squareToRC(chosen.to);if(Math.abs(z.r-a.r)===2)state.enPassant=rcToSquare((z.r+a.r)/2,a.c);}
  state.halfmove=(typeOf(moving)==="p"||captured)?0:state.halfmove+1;if(playerIndex===2)state.fullmove++;
  if(captured)state.captured.push(captured);
  state.lastMove={...chosen,capture:!!captured||chosen.enPassant};
  state.turn=playerIndex===1?2:1;state.lastTickAt=now;
  const nextColor:ChessColor=state.turn===1?"w":"b";state.check=inCheck(state,nextColor);
  const temp={...state,legalMoves:[]} as ChessState;
  const san=notation(input,chosen,moving,captured||null,temp);
  state.moveHistory.push(san);
  finalizeTurn(state,playerIndex);
  return state;
}

export function tickClock(input:ChessState,now=Date.now()){
  if(input.winner!==null)return input;
  const last=Number(input.lastTickAt||now);const elapsed=Math.max(0,Math.min(300000,now-last));const idx=input.turn-1;input.clocks=[...input.clocks] as [number,number];input.clocks[idx]=Math.max(0,input.clocks[idx]-elapsed);input.lastTickAt=now;
  if(input.clocks[idx]<=0){input.winner=input.turn===1?2:1;input.result="timeout";input.legalMoves=[];input.check=false;}
  return input;
}

function scoreBoard(state:ChessState,perspective:ChessColor){
  if(state.winner===0)return 0;if(state.winner===1)return perspective==="w"?100000:-100000;if(state.winner===2)return perspective==="b"?100000:-100000;
  let score=0;for(let r=0;r<8;r++)for(let c=0;c<8;c++){const p=state.board[r][c];if(!p)continue;const val=PIECE_VALUE[typeOf(p)!]||0;score+=(colorOf(p)===perspective?1:-1)*(val+(typeOf(p)==="p"?(perspective==="w"?(6-r):(r-1))*4:0));}
  return score;
}

function legalForCurrent(state:ChessState){return generateLegalMoves(state,state.turn===1?"w":"b");}
export function computerChessTurn(input:ChessState,now=Date.now()){
  let state={...input,board:cloneBoard(input.board),clocks:[...input.clocks] as [number,number]} as ChessState;
  tickClock(state,now);if(state.winner!==null||!state.computer||state.turn!==2)return state;
  const moves=legalForCurrent(state);if(!moves.length){finalizeTurn(state,1);return state;}
  const level=Math.max(1,Math.min(4,Number(state.computerLevel)||2));
  let chosen=moves[Math.floor(Math.random()*moves.length)];
  if(level>=2){
    const scored=moves.map(m=>{const z=squareToRC(m.to);const target=state.board[z.r][z.c];let s=target?PIECE_VALUE[typeOf(target)!]:0;if(m.promotion)s+=PIECE_VALUE[m.promotion]-100;if(level>=3){try{s+=-scoreBoard(applyChessMove(state,{from:m.from,to:m.to,promotion:m.promotion},2,now),"w")/40;}catch{}}return {m,s:s+Math.random()*(level===2?180:25)};});
    scored.sort((a,b)=>b.s-a.s);chosen=scored[0].m;
    if(level===4){
      let best=-Infinity;
      for(const cand of scored.slice(0,Math.min(12,scored.length))){let after:ChessState;try{after=applyChessMove(state,{from:cand.m.from,to:cand.m.to,promotion:cand.m.promotion},2,now);}catch{continue;}if(after.winner!==null){chosen=cand.m;break;}const replies=generateLegalMoves(after,"w").slice(0,24);let worst=Infinity;for(const reply of replies){try{const replyState=applyChessMove(after,{from:reply.from,to:reply.to,promotion:reply.promotion},1,now);worst=Math.min(worst,scoreBoard(replyState,"b"));}catch{}}const val=(worst===Infinity?scoreBoard(after,"b"):worst)+Math.random()*3;if(val>best){best=val;chosen=cand.m;}}
    }
  }
  return applyChessMove(state,{from:chosen.from,to:chosen.to,promotion:chosen.promotion},2,now+350);
}

export function chessStatusText(state:ChessState){
  if(state.result==="checkmate")return "Checkmate";if(state.result==="stalemate")return "Stalemate";if(state.result==="timeout")return "Time expired";if(state.result==="insufficient-material")return "Draw · insufficient material";if(state.result==="fifty-move")return "Draw · fifty-move rule";if(state.result==="threefold-repetition")return "Draw · repetition";if(state.check)return "Check";return state.turn===1?"White to move":"Black to move";
}
