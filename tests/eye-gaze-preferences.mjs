// Run: node tests/eye-gaze-preferences.mjs
// Executes the actual preference/Shorts handlers with in-memory storage and no external requests.
import { build } from 'esbuild';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
const source=await readFile('server/routes.ts','utf8');
const settings=source.slice(source.indexOf('  const EYE_GAZE_FEATURE_PATHS'),source.indexOf("  app.get('/api/eye-gaze/tv-usage'"));
const appearance=source.slice(source.indexOf('  app.get("/api/eye-gaze/appearance"'),source.indexOf('  app.get("/api/eye-gaze/profile-photo"'));
const temp=await mkdtemp(join(tmpdir(),'arise-prefs-'));
const originalFetch=globalThis.fetch;
const apiKey=process.env.YOUTUBE_API_KEY, googleKey=process.env.GOOGLE_API_KEY;
delete process.env.YOUTUBE_API_KEY;delete process.env.GOOGLE_API_KEY;
try{
 await build({stdin:{contents:`import {YOUTUBE_CHANNEL_OPTIONS,normalizeYoutubeChannels,youtubeChannelAllowed} from './shared/youtubeChannels';import {normalizeEyeGazeBackground} from './shared/eyeGazeAppearance';export function setup(app,storage){const authMiddleware=()=>{};const talkerStudent=async req=>req.user;const validTalkerGrownupPass=req=>req.verified;${appearance}\n${settings}\nreturn {normalizeEyeGazeFamilySettings};}`,resolveDir:process.cwd(),loader:'ts'},outfile:join(temp,'routes.mjs'),bundle:true,platform:'node',format:'esm'});
 const routes=new Map(),values=new Map();
 const app={get:(p,...handlers)=>routes.set('GET '+p,handlers.at(-1)),post:(p,...handlers)=>routes.set('POST '+p,handlers.at(-1))};
 const {setup}=await import(join(temp,'routes.mjs'));
 const {normalizeEyeGazeFamilySettings}=setup(app,{getSetting:async key=>values.get(key),upsertSetting:async(key,v)=>values.set(key,v)});
 const call=async(method,path,body={},verified=true,id=1,query={})=>{
  const result={status:200,data:null}; const res={status(n){result.status=n;return this},set(){return this},json(data){result.data=data;return this}};
  await routes.get(method+' '+path)({user:{id,displayName:'Test child'},body,query,verified},res);return result;
 };
 const superSimple='UCLsooMJoIpl_7ux2jvdPB-Q';
 const defaults=normalizeEyeGazeFamilySettings(null);
 assert.ok(defaults.tvChannels.includes(superSimple));
 assert.deepEqual(normalizeEyeGazeFamilySettings({tvChannels:[]}).tvChannels,[]);
 const prefs={...defaults,tvChannels:[superSimple,'fake-channel',superSimple],tvTopics:['animals','music']};
 assert.equal((await call('POST','/api/eye-gaze/family-settings',prefs,false)).status,403);
 assert.deepEqual((await call('POST','/api/eye-gaze/family-settings',prefs)).data.settings.tvChannels,[superSimple]);
 assert.deepEqual((await call('GET','/api/eye-gaze/family-settings')).data.settings.tvChannels,[superSimple]);
 globalThis.fetch=async()=>({ok:true,text:async()=>'<feed></feed>'});
 let feed=await call('GET','/api/eye-gaze/youtube-shorts');
 assert.ok(feed.data.items.length>=2,'Super Simple must work without an API key');
 assert.ok(feed.data.items.every(item=>item.channelId===superSimple),'unselected channels excluded from fallback');
 await call('POST','/api/eye-gaze/family-settings',{...prefs,tvChannels:[]});
 assert.equal((await call('GET','/api/eye-gaze/youtube-shorts')).data.items.length,0,'empty selection must not restore all channels');
 await call('POST','/api/eye-gaze/family-settings',prefs);
 process.env.YOUTUBE_API_KEY='fixture';
 globalThis.fetch=async url=>String(url).includes('/search?')?{ok:true,json:async()=>{assert.equal(new URL(url).searchParams.get('channelId'),superSimple);return {items:[{id:{videoId:'fixture1234'}}]};}}:{ok:true,json:async()=>({items:[{id:'fixture1234',snippet:{channelId:superSimple,channelTitle:'Super Simple Songs',title:'Animal #shorts'},contentDetails:{duration:'PT30S'},status:{embeddable:true}},{id:'spoofed1234',snippet:{channelId:'fake-channel',channelTitle:'Super Simple Songs',title:'Animal #shorts'},contentDetails:{duration:'PT30S'},status:{embeddable:true}}]})};
 feed=await call('GET','/api/eye-gaze/youtube-shorts');assert.deepEqual(feed.data.items.map(i=>i.id),['fixture1234'],'API results checked by channel ID');
 assert.equal((await call('POST','/api/eye-gaze/appearance',{background:'url(evil)'})).status,400);
 assert.equal((await call('POST','/api/eye-gaze/appearance',{background:'#AABBCC'})).data.background,'#aabbcc');
 assert.equal((await call('GET','/api/eye-gaze/appearance')).data.background,'#aabbcc');
 assert.equal((await call('GET','/api/eye-gaze/appearance',{},true,2)).data.background,'#e6f4ee','colors isolated by account');
 console.log('PASS: channel selection persistence, grown-up save check, exact channel filtering in both feeds, empty selections, Super Simple fallback, color validation and account isolation');
}finally{globalThis.fetch=originalFetch;if(apiKey===undefined)delete process.env.YOUTUBE_API_KEY;else process.env.YOUTUBE_API_KEY=apiKey;if(googleKey===undefined)delete process.env.GOOGLE_API_KEY;else process.env.GOOGLE_API_KEY=googleKey;await rm(temp,{recursive:true,force:true});}
