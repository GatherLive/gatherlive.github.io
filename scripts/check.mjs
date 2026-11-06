import {readdir,readFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {access} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {tsImport} from 'tsx/esm/api';
const {RoomEngine}=await tsImport('../src/shared/quiz/engine.ts',import.meta.url);
async function checkDirectory(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(entry.isDirectory()){
   if(!['vendor','node_modules','learn-data'].includes(entry.name))await checkDirectory(directory+'/'+entry.name);
   continue;
  }
  if(!/\.(?:js|mjs)$/.test(entry.name))continue;
  const result=spawnSync(process.execPath,['--check',directory+'/'+entry.name],{stdio:'inherit'});
  if(result.status)process.exit(result.status);
 }
}
const types=spawnSync('npm',['run','typecheck'],{stdio:'inherit'});if(types.status)process.exit(types.status);
for(const directory of ['public','scripts'])await checkDirectory(directory);
async function checkReferences(directory){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  if(['vendor','learn-data'].includes(entry.name))continue;
  const file=directory+'/'+entry.name;
  if(entry.isDirectory()){await checkReferences(file);continue;}
  if(!/\.(?:js|mjs|css)$/.test(file))continue;
  const source=await readFile(file,'utf8');
  const expression=file.endsWith('.css')?/@import\s+(?:url\(\s*)?['"](\.{1,2}\/[^'"]+)['"]|url\(\s*['"]?(\.{1,2}\/[^)'"\s]+)/g:/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"](\.{1,2}\/[^'"]+)['"]|\bnew\s+URL\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*,\s*import\.meta\.url/g;
  for(const match of source.matchAll(expression)){
   const relative=(match[1]||match[2]).split(/[?#]/)[0];
   if(/[${}]/.test(relative))continue;
   try{await access(resolve(dirname(file),relative));}catch{throw new Error('Missing asset in '+file+': '+relative);}
  }
 }
}
// Validate emitted browser URLs, including lazy-loaded styles and image assets.
const {buildClient}=await import('./client-build.mjs');
const {cp,mkdir,rm}=await import('node:fs/promises');
const generated=resolve('.local/check-client');await rm(generated,{recursive:true,force:true});await mkdir(generated,{recursive:true});await cp('public',generated,{recursive:true});await buildClient(generated);
await checkReferences(generated);
await rm(generated,{recursive:true,force:true});
const html=await readFile('public/index.html','utf8');
for(const path of ['app.js','styles.css','config.js'])if(!html.includes(path))throw new Error(`Missing frontend asset: ${path}`);
const quiz={title:'Reconnect check',questions:['q1','q2'].map(id=>({id,type:'single',prompt:'Choose',timeLimit:30,options:[{id:'yes',text:'Yes'},{id:'no',text:'No'}],correct:['yes']}))};
const room=new RoomEngine({code:'123456',ownerId:'owner',quiz,settings:{participantLimit:1,scoring:'accuracy'}});
const player=room.addPlayer('Alice'),identity={role:'player',playerId:player.playerId};
const host={role:'host',userId:'owner'};
room.command(host,{type:'start'});
room.command(identity,{type:'answer',questionId:'q1',answer:'yes'});
assert.equal(room.progress().answerCount,1);
room.command(host,{type:'reveal'});
assert.equal(room.snapshot(true).leaderboard[0].score,1000);
room.command(host,{type:'next'});
room.command(identity,{type:'answer',questionId:'q2',answer:'yes'});
room.disconnect(player.playerId);
assert.equal(room.snapshot(true).participantCount,0);
assert.equal(room.snapshot(true).players.length,0);
assert.equal(room.progress().answerCount,0);
assert.equal(room.snapshot(true).leaderboard[0].score,1000);
room.addPlayer('Alice',player.playerId,player.resumeToken);
assert.equal(room.progress().participantCount,1);
assert.equal(room.progress().answerCount,1);
room.command(host,{type:'reveal'});
assert.equal(room.snapshot(true).leaderboard[0].score,2000);
const capacityRoom=new RoomEngine({code:'654321',ownerId:'owner',quiz,settings:{participantLimit:1}});
const inactive=capacityRoom.addPlayer('Inactive');capacityRoom.disconnect(inactive.playerId);
assert.ok(capacityRoom.addPlayer('Active'));
const kickedRoom=new RoomEngine({code:'987654',ownerId:'owner',quiz});
const kicked=kickedRoom.addPlayer('Kicked');
kickedRoom.command(host,{type:'kick',playerId:kicked.playerId});
assert.throws(()=>kickedRoom.addPlayer('Kicked',kicked.playerId,kicked.resumeToken),error=>error.code==='RESUME_INVALID');
assert.notEqual(kickedRoom.addPlayer('Kicked').playerId,kicked.playerId);
console.log('TypeScript, emitted module references, entrypoint, and player reconnect checks passed.');
