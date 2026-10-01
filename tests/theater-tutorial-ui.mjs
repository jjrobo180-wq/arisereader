// Run with jsdom installed in the verification environment: node tests/theater-tutorial-ui.mjs
import {build} from 'esbuild';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {JSDOM,VirtualConsole} from 'jsdom';
import assert from 'node:assert/strict';
const temp=await mkdtemp(join(tmpdir(),'arise-theater-ui-'));
const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
const dom=new JSDOM('<div id="root"></div>',{url:'https://arise.test',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
try{
 await build({stdin:{resolveDir:process.cwd(),loader:'tsx',contents:`import React from 'react';import {createRoot} from 'react-dom/client';import Admin from './client/src/components/TheaterAdmin';import Tutorial from './client/src/components/board-quest/BoardTutorial';import {DEFAULT_THEATER_MOVIES} from './shared/theaterDefaults';window.movies=DEFAULT_THEATER_MOVIES;window.root=createRoot(document.getElementById('root'));window.render=mode=>window.root.render(mode==='admin'?<Admin token='admin'/>:<Tutorial key={window.view.tutorialId} view={window.view} myId={10} token='fixture' sound={false} busy={false} offline={false} error='' finish={result=>window.ready(result)}/>);window.render('admin');`},outfile:join(temp,'ui.js'),bundle:true,jsx:'automatic'});
 const w=dom.window;let saved=null,playId=null;
 w.fetch=async(url,init={})=>({ok:true,json:async()=>{
  if(String(url).endsWith('/play')){playId=JSON.parse(init.body).movieId;return {ok:true};}
  if(init.method==='PUT'){saved=JSON.parse(init.body);return {...saved,revision:1};}
  return {revision:0,movies:w.movies};
 }});
 w.confirm=()=>true;
 const wait=()=>new Promise(resolve=>setTimeout(resolve,60));
 const button=text=>[...w.document.querySelectorAll('button')].find(b=>b.textContent.trim()===text);
 const input=label=>[...w.document.querySelectorAll('label')].find(element=>element.textContent.includes(label)).querySelector('input');
 const fill=(el,text)=>{const setter=Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set;setter.call(el,text);el.dispatchEvent(new w.Event('input',{bubbles:true}));};
 w.eval(await readFile(join(temp,'ui.js'),'utf8'));await wait();
 button('Cinema ManagerEdit video links, show titles, and the theatre guide.').click();await wait();await wait();
 assert.equal(w.document.querySelectorAll('article').length,10);
 const netflix=[...w.document.querySelectorAll('a')].find(a=>a.textContent.includes('Sign in to Netflix'));assert.equal(netflix.href,'https://www.netflix.com/login');assert.equal(netflix.target,'_blank');
 fill(input('Show or movie title'),'My custom movie title');await wait();
 fill(input('Video link'),'https://youtu.be/ixbkzsNCgV8');await wait();
 assert.equal(button('Play in theatre now').disabled,true);
 button('Save theatre guide').click();await wait();await wait();
 assert.equal(saved.movies[0].title,'My custom movie title');assert.equal(saved.movies[0].sourceUrl,'https://youtu.be/ixbkzsNCgV8');
 button('Play in theatre now').click();await wait();assert.equal(playId,saved.movies[0].id);
 button('Add show or movie').click();await wait();assert.equal(w.document.querySelectorAll('article').length,11);
 assert.ok(w.document.body.textContent.includes('You have unsaved edits'));
 // A player's completion only changes that player's readiness. The room stays in the tutorial until the other reader finishes.
 w.view={tutorialId:1,tutorialReady:[],tutorialResults:{},players:[{id:10,name:'Reader One',bot:false},{id:20,name:'Reader Two',bot:false}],phase:'tutorial'};
 w.ready=result=>{w.view={...w.view,tutorialReady:[10],tutorialResults:{10:result}};w.render('tutorial');};
 w.render('tutorial');await wait();assert.ok(w.document.body.textContent.includes('Team up. Reach the finish.'));
 button('Skip tutorial').click();await wait();assert.ok(w.document.body.textContent.includes('Waiting for 1 other reader'));
 assert.equal(button('Next'),undefined);assert.ok(w.document.body.textContent.includes('Reader TwoLearning rules'));
 w.view={...w.view,tutorialId:2,tutorialReady:[],tutorialResults:{}};w.render('tutorial');await wait();
 for(let i=0;i<4;i++){button('Next').click();await wait();}
 button('Finish tutorial').click();await wait();assert.equal(w.view.tutorialResults[10],'finished');assert.ok(w.document.body.textContent.includes('Waiting for 1 other reader'));
 assert.deepEqual(errors,[]);w.root.unmount();
 console.log('PASS: admin title/link editing, save, service links, play, add, skip, finish and waiting screen');
}finally{dom.window.close();await rm(temp,{recursive:true,force:true});}
