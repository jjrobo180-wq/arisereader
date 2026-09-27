// Requires jsdom. Run: node tests/eye-gaze-ui.mjs
import {build} from 'esbuild';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import assert from 'node:assert/strict';
const temp=await mkdtemp(join(tmpdir(),'arise-ui-'));
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM('<div id="root"></div>',{url:'https://arise.test/#/eye-gaze-account',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
try{
 await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Shell from './client/src/components/EyeGazeSiteShell';import Account from './client/src/pages/EyeGazeAccount';import Controls from './client/src/pages/EyeGazeParentControls';import Party from './client/src/components/EyeGazeCelebrations';import Home from './client/src/components/QuickHome';import Games from './client/src/pages/EyeGazeGames';window.root=createRoot(document.getElementById('root'));window.render=which=>window.root.render(which==='games'?<Games/>:which==='controls'?<Controls/>:<Shell><Account/><Home/><Party/></Shell>);window.render('profile');`},outfile:join(temp,'ui.js'),bundle:true,jsx:'automatic',plugins:[{name:'fixtures',setup(b){b.onResolve({filter:/^(wouter|@\/context\/AuthContext)$/},a=>({path:a.path,namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path==='wouter'?`export const useLocation=()=>['/eye-gaze-account',path=>window.destination=path];export const Redirect=({to})=>{window.destination=to;return null;};`:`export const useAuth=()=>({user:window.testUser,token:'fixture',logout(){},refreshUser:async()=>{}});`,loader:'js'}));}}]});
 const w=dom.window;
 w.testUser={id:1,role:'student',is_eye_gaze_user:true,displayName:'Test Reader',username:'reader'};
 const settings={enabled:false,allowedPaths:[],tvChannels:['UCLsooMJoIpl_7ux2jvdPB-Q'],tvAgeRange:'2-4',tvTopics:['music'],tvDailyMinutes:0,videos:[]};
 let saved=null;
 w.fetch=async(url,init={})=>({ok:true,json:async()=>{
  if(String(url).includes('family-settings')){if(init.method==='POST')saved=JSON.parse(init.body);return {student:{id:1,name:'Test Reader'},settings:saved||settings};}
  if(String(url).includes('appearance'))return {background:init.method==='POST'?JSON.parse(init.body).background:'#e6f4ee'};
  if(String(url).includes('learning-buddy'))return {type:'preset',preset:'puppy',name:'Buddy',voiceEnabled:false};
  return {};
 }});
 const wait=()=>new Promise(r=>setTimeout(r,80));
 w.eval(await readFile(join(temp,'ui.js'),'utf8'));await wait();await wait();
 assert.deepEqual([...w.document.querySelectorAll('aside button')].slice(0,3).map(b=>b.textContent),['Home','Talker','Games']);
 assert.equal([...w.document.querySelectorAll('aside button')].some(b=>b.textContent==='Lessons'),false);
 const button=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent===text);
 button('Open parent permissions').click();assert.equal(w.destination,'/eye-gaze-parent-controls');
 w.document.querySelector('button[aria-label="Go Home"]').click();assert.equal(w.destination,'/eye-gaze-home');
 w.document.querySelector('button[aria-label="Choose #fff4d6"]').click();await wait();button('Save background').click();await wait();
 assert.equal(w.document.querySelector('[data-eye-gaze-shell]').style.backgroundColor,'rgb(255, 244, 214)');
 for(const style of ['balloons','fireworks','confetti']){w.dispatchEvent(new w.CustomEvent('eye-gaze-celebrate',{detail:{calm:false}}));await wait();assert.equal(w.document.querySelector('[data-testid="eye-gaze-celebration"]').dataset.style,style);}
 w.dispatchEvent(new w.CustomEvent('eye-gaze-celebrate',{detail:{calm:true}}));await wait();assert.equal(w.document.querySelectorAll('.eg-party-particle').length,0);
 w.testUser={...w.testUser,role:'parent'};w.render('controls');await wait();await wait();
 const channels=[...w.document.querySelectorAll('button[aria-pressed]')];assert.equal(channels.length,6);
 channels.find(b=>b.textContent.includes('PBS KIDS')).click();await wait();button('Save').click();await wait();
 assert.ok(saved.tvChannels.includes('UCLsooMJoIpl_7ux2jvdPB-Q'));assert.ok(saved.tvChannels.includes('UCrNnkOwFBnCS1awGjq_iJGQ'));
 button('Clear channels').click();await wait();button('Save').click();await wait();assert.deepEqual(saved.tvChannels,[]);
 saved={...settings,enabled:true,allowedPaths:['/library']};
 w.testUser={...w.testUser,role:'student'};w.render('games');await wait();await wait();
 const tabs=[...w.document.querySelectorAll('[role="tab"]')];
 assert.equal(tabs[0].disabled,true,'restricted Games must stay disabled');
 assert.equal(tabs[1].getAttribute('aria-selected'),'true','lessons-only account can reach lessons in Games');
 assert.ok(w.document.body.textContent.includes('Eye Gaze Lessons'));
 assert.deepEqual(errors,[]);w.root.unmount();
 console.log('PASS: menu order, permissions link, quick Home, saved background, all celebrations, calm mode, channel picker and empty selection');
}finally{dom.window.close();await rm(temp,{recursive:true,force:true});}
