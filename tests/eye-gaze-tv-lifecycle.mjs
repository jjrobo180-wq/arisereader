// Requires jsdom: npm install --no-save --package-lock=false --ignore-scripts jsdom
// Run: node tests/eye-gaze-tv-lifecycle.mjs
// Reproduces YouTube replacing its target DOM node. No network or real user data.
import { build } from 'esbuild';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
const temp = await mkdtemp(join(tmpdir(), 'arise-tv-'));
const component = process.env.TV_TEST_COMPONENT || resolve('client/src/pages/EyeGazeTV.tsx');
await build({ stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client'; import TV from ${JSON.stringify(component)}; window.root=createRoot(document.getElementById('root')); window.root.render(<React.StrictMode><TV/></React.StrictMode>);`, resolveDir:process.cwd(), loader:'tsx' }, outfile:join(temp,'test.js'), bundle:true, jsx:'automatic', plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^@\/(context\/AuthContext|lib\/queryClient|lib\/parentControls)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:a.path.endsWith('AuthContext') ? 'export const useAuth=()=>({token:"test"});' : a.path.endsWith('queryClient') ? 'export const API_BASE="";' : `export async function fetchFamilySettings(){return {settings:{tvDailyMinutes:0,tvAgeRange:'2-4',tvTopics:['animals'],videos:[]}}} export async function getTvUsage(){return {minutes:0}} export async function addTvUsage(){return {minutes:0}}`,loader:'js'}));
}}]});
const script = await readFile(join(temp,'test.js'), 'utf8');
const errors=[];
const console = new VirtualConsole();
console.on('jsdomError', error=>errors.push(error.message));
const dom=new JSDOM('<div id="root"></div>',{url:'https://arisereader.test',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:console});
const w=dom.window;
const players=[];
w.fetch=async()=>({ok:true,json:async()=>({items:Array.from({length:10},(_,i)=>({id:`video${Math.floor(i / 2)}`,title:`Short ${i}`,channel:'Fixture',topic:'animals'})),automaticDiscovery:false})});
w.HTMLElement.prototype.scrollTo=function({top}){this.scrollTop=top};
w.YT={Player:class {
 constructor(target,options){if(typeof target==='string')target=w.document.getElementById(target);this.options=options;this.frame=w.document.createElement('iframe');target.replaceWith(this.frame);players.push(this);w.setTimeout(()=>options.events.onReady({target:this}),10)}
 getIframe(){return this.frame} destroy(){this.frame.remove()} mute(){this.muted=true} unMute(){this.muted=false} playVideo(){this.plays=(this.plays||0)+1;this.options.events.onStateChange({data:1})} pauseVideo(){this.options.events.onStateChange({data:2})}
}};
const wait=()=>new Promise(r=>setTimeout(r,100));
try {
 w.eval(script); await wait(); await wait();
 assert.ok(players.length>0,'player mounts');
 const scroll=async n=>{const feed=w.document.querySelector('article').parentElement;Object.defineProperty(feed,'clientHeight',{value:800,configurable:true});feed.scrollTop=n*800;feed.dispatchEvent(new w.Event('scroll',{bubbles:true}));await wait();};
 for(const n of [1,2,3,2,1,0]) {await scroll(n);assert.deepEqual(errors,[],"swipe must not trigger DOM removal errors");assert.equal(w.document.querySelectorAll("iframe").length,1,"each feed entry must keep a live player, including duplicate IDs");}
 assert.deepEqual(errors,[], 'swiping must not crash React');
 assert.equal(w.document.querySelectorAll('iframe').length,1);
 players.at(-1).options.events.onError({data:100});await wait();
 assert.deepEqual(errors,[], 'unavailable video skip must not crash');
 assert.equal(w.document.querySelectorAll('iframe').length,1);
 const before=players.length;
 players.at(-1).options.events.onError({data:153});await wait();
 assert.ok(w.document.querySelector('[role="alert"]'));
 assert.equal(players.length,before,'configuration error must not loop');
 [...w.document.querySelectorAll('button')].find(b=>b.textContent==='Try again').click();await wait();
 assert.equal(players.length,before+1);
 const active=players.at(-1);
 assert.ok(active.plays>0, 'Short starts on ready without tapping Play');
 assert.ok(active.frame.getAttribute('allow').includes('autoplay'));
 w.document.querySelector('button[aria-label="Turn sound on"]').click();await wait();
 assert.equal(active.muted,false,'sound tap unmutes immediately');
 const plays=active.plays;
 active.options.events.onAutoplayBlocked({target:active});await wait();
 assert.equal(active.muted,true,'blocked autoplay retries muted');
 assert.equal(active.plays,plays+1,'blocked Short restarts without tapping Play');
 assert.ok(w.document.querySelector('button[aria-label="Pause"]'));
 active.options.events.onAutoplayBlocked({target:active});await wait();
 assert.equal(active.plays,plays+1,'retry must be bounded');
 // Old asynchronous events must not remove or stop a later active player.
 const old=players.at(-1);await scroll(2);
 const count=players.length;old.options.events.onError({data:100});await wait();
 assert.equal(players.length,count);
 w.root.unmount();await wait();
 assert.equal(w.document.querySelectorAll('iframe').length,0);
 assert.deepEqual(errors,[]);
 process.stdout.write('PASS: swipes, failed clip skip, retry, blocked autoplay, stale events, StrictMode, and cleanup\n');
} finally {dom.window.close();await rm(temp,{recursive:true,force:true});}
