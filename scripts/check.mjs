import {readdir,readFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {RoomEngine} from '../shared/engine.js';
for(const directory of ['public','shared','worker','scripts']){
 for(const name of await readdir(directory)){
  if(!/\.(?:js|mjs)$/.test(name))continue;
  const result=spawnSync(process.execPath,['--check',`${directory}/${name}`],{stdio:'inherit'});
  if(result.status)process.exit(result.status);
 }
}
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
console.log('All JavaScript syntax, entrypoint, and player reconnect checks passed.');
