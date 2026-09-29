import assert from 'node:assert/strict';
import {readFile, stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
// Exercise the real production static middleware against the built assets.
const compiled = await build({entryPoints:['server/static.ts'],bundle:true,platform:'node',format:'cjs',external:['express'],write:false});
const runtime = {exports:{}};
new Function('require','module','exports','__dirname',compiled.outputFiles[0].text)(createRequire(import.meta.url),runtime,runtime.exports,resolve('dist'));
const {default:express}=await import('express');
const app=express();runtime.exports.serveStatic(app);
const server=app.listen(0,'127.0.0.1');
await new Promise(resolve=>server.once('listening',resolve));
try{
 const origin=`http://127.0.0.1:${server.address().port}`;
 for(const route of ['/', '/board-game-world', '/board-game-world/', '/board-quest.html']){
   const response=await fetch(origin+route);assert.equal(response.status,200,route);
   const body=await response.text();assert.ok(body.includes('/#/board-game-world'),`${route} must normalize old links to the app route`);
   assert.ok(!body.includes("location.replace('/board-quest.html')"),'must not redirect back to the old flat game');
 }
 const appSource=await readFile('client/src/App.tsx','utf8');
 assert.match(appSource,/import BoardGameWorld from "\.\/pages\/BoardGameWorld"/);
 assert.match(appSource,/<Route path="\/board-game-world">[\s\S]*?<ProtectedRoute><BoardGameWorld\s*\/>/);
 const world=await readFile('client/src/pages/Worlds.tsx','utf8');assert.match(world,/id:"board"[^\n]*path:"\/board-game-world"/);
 const html=await readFile('dist/public/index.html','utf8');const js=html.match(/src="([^\"]+\.js)"/)[1];
 const bundle=await readFile(resolve('dist/public',js.replace(/^\.\//,'')),'utf8');assert.ok(bundle.includes('3D Board Quest world'),'3D component must be included in the production bundle');
 for(const name of ['robin-hood','alice','king-arthur','sherlock-holmes','hercules']){
   const response=await fetch(`${origin}/avatar/characters/${name}.gltf`);assert.equal(response.status,200);
   const gltf=await response.json();assert.equal(gltf.asset.version,'2.0');assert.ok(gltf.meshes.length>0);
   for(const item of [...(gltf.buffers||[]),...(gltf.images||[])])if(item.uri&&!item.uri.startsWith('data:'))await stat(resolve('dist/public/avatar/characters',item.uri));
 }
 console.log('PASS: production routes, legacy redirects, Worlds destination, bundled 3D component, and all five character models.');
}finally{server.close();server.closeAllConnections();}
