import type { Express } from "express";
import { storage } from "./storage";

const HOME_IDS=new Set(["home-basic","home-studio","home-loft","home-modern"]);
const REGISTRY_KEY="avatar_home_registry_v2";

type HomeRecord={
  ownerId:number;
  displayName:string;
  homeId:string;
  propertyId:string;
  lot:number;
  x:number;
  z:number;
  unlocked:boolean;
  updatedAt:number;
};

type HomeRegistry={version:2;homes:Record<string,HomeRecord>};

const LOTS=Array.from({length:18},(_,i)=>{
  const row=i<9?0:1;
  const col=i%9;
  return {x:-28+col*7,z:row===0?15:-15};
});

async function homeAuth(req:any,res:any,next:any){
  const token=req.headers.authorization?.replace("Bearer ","");
  if(!token)return res.status(401).json({message:"Not authenticated"});
  const session=await storage.getSession(token);
  if(!session)return res.status(401).json({message:"Invalid or expired session"});
  req.user=session.user;req.sessionToken=token;next();
}

function isStudent(user:any){
  return !!user&&!user.isAdmin&&user.role==="student"&&!user.is_eye_gaze_user;
}

async function readRegistry():Promise<HomeRegistry>{
  const raw=await storage.getSetting(REGISTRY_KEY);
  if(raw){
    try{
      const parsed=JSON.parse(raw);
      if(parsed&&parsed.version===2&&parsed.homes&&typeof parsed.homes==="object")return parsed;
    }catch{}
  }
  return {version:2,homes:{}};
}

async function saveRegistry(registry:HomeRegistry){
  await storage.upsertSetting(REGISTRY_KEY,JSON.stringify(registry));
}

async function readAvatarState(userId:number){
  const raw=await storage.getSetting("avatar_world_"+userId);
  if(!raw)return {} as any;
  try{return JSON.parse(raw)||{};}catch{return {} as any;}
}

function ownedHomeId(state:any){
  const purchased=new Set(Array.isArray(state?.purchased)?state.purchased.map(String):[]);
  const equipped=String(state?.equipped?.home||"home-basic");
  // Every regular student owns the free starter home. Premium homes require a purchase.
  if(equipped==="home-basic")return "home-basic";
  if(HOME_IDS.has(equipped)&&purchased.has(equipped))return equipped;
  const first=Array.from(purchased).find(id=>HOME_IDS.has(String(id))&&String(id)!=="home-basic");
  return first?String(first):"home-basic";
}

async function ensureHome(user:any,registry?:HomeRegistry){
  const reg=registry||await readRegistry();
  const state=await readAvatarState(user.id);
  const homeId=ownedHomeId(state);
  const key=String(user.id);
  if(!homeId){
    if(reg.homes[key]){delete reg.homes[key];await saveRegistry(reg);}
    return {registry:reg,home:null as HomeRecord|null};
  }

  const detail=await storage.getStudentDetail(user.id);
  const displayName=detail?.user?.displayName||user.displayName||user.username||"Reader";
  const existing=reg.homes[key];
  if(existing){
    const next={...existing,displayName,homeId,updatedAt:Date.now()};
    reg.homes[key]=next;
    await saveRegistry(reg);
    return {registry:reg,home:next};
  }

  // Property ownership is unlimited. The 18 physical lots are a view window,
  // not a hard cap on how many students may own homes.
  const lot=Math.abs(Number(user.id)||0)%LOTS.length;
  const coords=LOTS[lot];
  const record:HomeRecord={
    ownerId:user.id,displayName,homeId,
    propertyId:`home-${user.id}-${Date.now().toString(36)}`,
    lot,x:coords.x,z:coords.z,unlocked:false,updatedAt:Date.now(),
  };
  reg.homes[key]=record;
  await saveRegistry(reg);
  return {registry:reg,home:record};
}

export function registerHomeWorldRoutes(app:Express){
  app.get("/api/homes/neighborhood",homeAuth,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"The Block is for student accounts."});
      const {registry,home}=await ensureHome(req.user);
      const allHomes=Object.values(registry.homes);
      const others=allHomes
        .filter(item=>item.ownerId!==req.user.id)
        .sort((a,b)=>a.ownerId-b.ownerId)
        .slice(0,Math.max(0,LOTS.length-1));
      const visible=(home?[home,...others]:others).slice(0,LOTS.length).map((item,index)=>({
        ...item,
        lot:index,
        x:LOTS[index].x,
        z:LOTS[index].z,
      }));
      const myHome=visible.find(item=>item.ownerId===req.user.id)||null;
      res.set("Cache-Control","no-store");
      res.json({myHome,homes:visible,capacity:LOTS.length,totalProperties:allHomes.length});
    }catch(error:any){
      console.error("[homes] neighborhood",error?.message);
      res.status(500).json({message:"Could not load neighborhood homes."});
    }
  });

  app.get("/api/homes/:ownerId",homeAuth,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const ownerId=Number(req.params.ownerId);
      if(!Number.isInteger(ownerId)||ownerId<=0)return res.status(400).json({message:"Unknown home."});
      let registry=await readRegistry();
      if(ownerId===req.user.id){
        const ensured=await ensureHome(req.user,registry);registry=ensured.registry;
      }
      const home=registry.homes[String(ownerId)];
      if(!home)return res.status(404).json({message:ownerId===req.user.id?"Buy a home in Avatar World before entering a house.":"That reader does not own a home yet."});
      const isOwner=ownerId===req.user.id;
      if(!isOwner&&!home.unlocked)return res.status(403).json({message:home.displayName+"'s door is locked."});
      const state=await readAvatarState(ownerId);
      const currentHome=ownedHomeId(state);
      if(!currentHome)return res.status(404).json({message:"That home is no longer available."});
      const ownerDetail=await storage.getStudentDetail(ownerId);
      res.set("Cache-Control","no-store");
      res.json({
        isOwner,
        home:{...home,homeId:currentHome,displayName:ownerDetail?.user?.displayName||home.displayName},
        state:{
          selectedCharacter:String(state.selectedCharacter||"robin-hood"),
          equipped:{...(state.equipped||{}),home:currentHome},
          purchased:Array.isArray(state.purchased)?state.purchased:[],
          furniture:Array.isArray(state.furniture)?state.furniture:[],
        }
      });
    }catch(error:any){
      console.error("[homes] enter",error?.message);
      res.status(500).json({message:"Could not enter that home."});
    }
  });

  app.post("/api/homes/door",homeAuth,async(req:any,res)=>{
    try{
      if(!isStudent(req.user))return res.status(403).json({message:"Student account required."});
      const {registry,home}=await ensureHome(req.user);
      if(!home)return res.status(404).json({message:"Buy a home before changing its door settings."});
      const unlocked=req.body?.unlocked===true;
      const next={...home,unlocked,updatedAt:Date.now()};
      registry.homes[String(req.user.id)]=next;
      await saveRegistry(registry);
      res.json({home:next});
    }catch(error:any){
      console.error("[homes] door",error?.message);
      res.status(500).json({message:"Could not change the door setting."});
    }
  });
}
