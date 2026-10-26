import http from 'node:http';
import {readFile,writeFile,appendFile,rename,mkdir,readdir,unlink} from 'node:fs/promises';
import {resolve,extname,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {loadConfig} from './config.mjs';
import {RoomEngine} from '../shared/engine.js';
import {RoomMedia} from '../shared/media.js';
import {RoomConversation,CONVERSATION_COMMANDS} from '../shared/conversation.js';
import {chatCodeRequest,chatOwnerKey,redeemChatCode,MemoryChatCodes} from '../shared/chat-access.js';
import {handleApi,originAllowed,json,HttpError,responseHeaders} from '../shared/api.js';
import {decodeMessage,authorize,safeError,allowMessage,MAX_MESSAGE_BYTES} from '../shared/protocol.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const wrangler=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));
const env={...wrangler.vars,...await loadConfig(),LOCAL_DEV:true};
const args=process.argv.slice(2);
const option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const host=option('--host','127.0.0.1'),port=Number(option('--port',process.env.PORT||8000));
const stateDir=resolve(option('--state-dir',join(root,'.local/rooms')));await mkdir(stateDir,{recursive:true,mode:0o700});
const accessPath=join(stateDir,'.chat-access.json');let accessStore=new MemoryChatCodes(),accessQueue=Promise.resolve();
try{accessStore=new MemoryChatCodes(JSON.parse(await readFile(accessPath,'utf8')));}catch(error){if(error.code!=='ENOENT')throw error;}
function updateAccess(change){
  const task=accessQueue.then(async()=>{
    const saved=accessStore.serialize(),result=change();
    try{await writeFile(accessPath+'.tmp',JSON.stringify(accessStore.serialize()),{mode:0o600});await rename(accessPath+'.tmp',accessPath);}
    catch(error){accessStore=new MemoryChatCodes(saved);throw error;}
    return result;
  });accessQueue=task.catch(()=>{});return task;
}
const redeemLocal=request=>updateAccess(()=>redeemChatCode(env,accessStore,request));
async function accountChatAccess(ownerId){
  if(!env.CHAT_CODE_PEPPER)return false;
  await accessQueue;return accessStore.account(await chatOwnerKey(env,ownerId));
}
const rooms=new Map();const LIFETIME=86400000;
const FINISHED_RETENTION=15*60*1000;
function roomExpires(room){return room.engine?.phase==='finished'&&Number.isFinite(room.engine.finishedAt)?room.engine.finishedAt+FINISHED_RETENTION:room.meta.expiresAt;}
const ROOM_FILES=['.json','.journal','.json.tmp','.conversation.json','.conversation.json.tmp'];
function makeRoom(engine,meta,revision=crypto.randomUUID()){return {engine,meta,revision,closed:false,clients:new Map(),queue:Promise.resolve(),joinTimer:null,progressTimer:null,media:new RoomMedia()};}
for(const name of await readdir(stateDir)){
  if(!/^\d{6}\.json$/.test(name))continue;
  try{
    const saved=JSON.parse(await readFile(join(stateDir,name),'utf8'));
    if(roomExpires({engine:saved.state,meta:saved.meta})<=Date.now()){
      for(const suffix of ROOM_FILES)try{await unlink(join(stateDir,`${name.slice(0,6)}${suffix}`));}catch(error){if(error.code!=='ENOENT')throw error;}
      continue;
    }
    const engine=RoomEngine.restore(saved.state);
    if(engine.phase==='finished'){
      for(const suffix of ['.conversation.json','.conversation.json.tmp'])try{await unlink(join(stateDir,name.slice(0,6)+suffix));}catch(error){if(error.code!=='ENOENT')throw error;}
      // Scrub conversations embedded by earlier local server versions as well.
      if(saved.state.conversation?.messages?.length||saved.state.conversation?.announcement){saved.state=engine.serialize();await writeFile(join(stateDir,name+'.tmp'),JSON.stringify(saved),{mode:0o600});await rename(join(stateDir,name+'.tmp'),join(stateDir,name));}
    }else try{const conversation=JSON.parse(await readFile(join(stateDir,`${name.slice(0,6)}.conversation.json`),'utf8'));if(conversation.revision>=engine.conversation.revision)engine.conversation=new RoomConversation(engine.settings,conversation,{unlocked:engine.chatUnlocked});}catch(error){if(error.code!=='ENOENT')throw error;}
    const revision=saved.revision || 'legacy';
    try{for(const line of (await readFile(join(stateDir,`${name.slice(0,6)}.journal`),'utf8')).split('\n')){if(!line)continue;let entry;try{entry=JSON.parse(line);}catch{continue;}if(entry.revision===revision)engine.restorePlayer(entry.player);}}catch(error){if(error.code!=='ENOENT')throw error;}
    for(const p of engine.players.values())engine.disconnect(p.id);
    rooms.set(name.slice(0,6),makeRoom(engine,saved.meta,revision));
  }catch{console.error('Could not restore one local room.');}
}
async function persist(room){
  const path=join(stateDir,`${room.engine.code}.json`);
  if(room.closed)return;
  const revision=crypto.randomUUID();
  await writeFile(`${path}.tmp`,JSON.stringify({revision,meta:room.meta,state:room.engine.serialize()}),{mode:0o600});
  await rename(`${path}.tmp`,path);
  room.revision=revision;
  await writeFile(join(stateDir,`${room.engine.code}.journal`),'',{mode:0o600});
  if(room.engine.phase==='finished')for(const suffix of ['.conversation.json','.conversation.json.tmp'])try{await unlink(join(stateDir,room.engine.code+suffix));}catch(error){if(error.code!=='ENOENT')throw error;}
}
async function persistPlayer(room,id){
  if(room.closed)return;
  const player=room.engine.serializePlayer(id);
  if(player)await appendFile(join(stateDir,`${room.engine.code}.journal`),JSON.stringify({revision:room.revision,player})+'\n',{mode:0o600});
}
async function persistConversation(room){
  if(room.closed||room.engine.phase==='finished')return;
  const path=join(stateDir,`${room.engine.code}.conversation.json`);
  await writeFile(`${path}.tmp`,JSON.stringify(room.engine.conversation.serialize()),{mode:0o600});
  await rename(`${path}.tmp`,path);
}
function send(ws,message){if(ws.readyState===1){if(ws.bufferedAmount>1024*1024){ws.close(1013,'Connection too slow; reconnect.');return;}ws.send(JSON.stringify(message));}}
function sendState(room,ws,identity){send(ws,{type:'state',state:room.engine.snapshot(identity.role==='host',identity.playerId,{media:identity.mediaVersion===1,conversation:identity.conversationVersion===1})});}
function sendConversation(room,ws,identity){if(identity.conversationVersion===1)send(ws,{type:'conversation',state:room.engine.conversation.snapshot(identity,room.engine.phase)});}
function broadcastConversation(room,event){
  if(room.closed||room.engine.phase==='finished')return;
  for(const [ws,id]of room.clients){
    if(id.conversationVersion!==1||id.superseded)continue;
    if(id.chatSubscribed===false&&!['announcement','chat_settings','chat_cleared'].includes(event.type))continue;
    send(ws,event);
  }
}
function broadcastProgress(room){
  if(room.progressTimer)return;
  room.progressTimer=setTimeout(()=>{room.progressTimer=null;if(room.closed||room.engine.phase!=='question')return;for(const [ws,id]of room.clients)if(id.role==='host'&&!id.superseded)send(ws,{...room.engine.progress(),questionId:room.engine.question?.id});},50);
}
function broadcast(room){if(room.closed)return;for(const [ws,identity] of room.clients)if(identity.role&&!identity.superseded)sendState(room,ws,identity);}
function joinBroadcast(room){if(!room.closed&&!room.joinTimer)room.joinTimer=setTimeout(()=>{room.joinTimer=null;broadcast(room);},100);}
function serial(room,work){const task=room.queue.then(work);room.queue=task.catch(()=>{});return task;}
async function purge(code){
  const room=rooms.get(code);if(!room)return;
  room.closed=true;if(room.joinTimer){clearTimeout(room.joinTimer);room.joinTimer=null;}
  if(room.progressTimer){clearTimeout(room.progressTimer);room.progressTimer=null;}
  for(const [ws,identity] of room.clients){identity.superseded=true;ws.close(1000,'This quiz has closed.');}
  rooms.delete(code);
  for(const suffix of ROOM_FILES)try{await unlink(join(stateDir,`${code}${suffix}`));}catch(error){if(error.code!=='ENOENT')throw error;}
}
const deletingOwners=new Map();
const adapter={
 async chatAccess(ownerId){return accountChatAccess(ownerId);},
 async unlockChat(ownerId,code){
  if((deletingOwners.get(ownerId)||0)>Date.now())throw new HttpError(409,'Account deletion is in progress.');
  const grant=await redeemLocal(await chatCodeRequest(env,code,ownerId));
  if(!grant.ok)throw new HttpError(grant.status,grant.message);
 },
 async create(data){
  if((deletingOwners.get(data.ownerId)||0)>Date.now())throw new HttpError(409,'Account deletion is in progress. Please retry in two minutes if you kept your account.');
  const accountChat=await accountChatAccess(data.ownerId);
  if((deletingOwners.get(data.ownerId)||0)>Date.now())throw new HttpError(409,'Account deletion is in progress.');
  for(let i=0;i<12;i++){
   const n=crypto.getRandomValues(new Uint32Array(1))[0];if(n>=4294800000){i--;continue;}
   const code=String(100000+n%900000);if(rooms.has(code))continue;
   const engine=new RoomEngine({...data,code,mediaOrigin:env.SUPABASE_URL});
   if(accountChat)engine.authorizeChat({enable:false});
   const meta={ownerId:data.ownerId,quizId:data.quiz.id,title:data.quiz.title,reportId:crypto.randomUUID(),expiresAt:Date.now()+LIFETIME};
   const room=makeRoom(engine,meta);rooms.set(code,room);
   try{await serial(room,()=>persist(room));return code;}catch(error){await serial(room,()=>purge(code));throw error;}
  }throw new HttpError(503,'No room code available; retry.');
 },
 async list(ownerId){return [...rooms].filter(([,r])=>!r.closed&&r.engine.phase!=='finished'&&r.meta.ownerId===ownerId&&roomExpires(r)>Date.now()).map(([code,r])=>({code,roomId:r.meta.reportId,quizId:r.meta.quizId,title:r.meta.title,phase:r.engine.phase,participants:r.engine.players.size,expires:r.meta.expiresAt})).sort((a,b)=>b.expires-a.expires);},
 async close(code,ownerId,roomId,{unfinishedOnly=false}={}){
  const room=rooms.get(code);if(!room||room.closed||roomExpires(room)<=Date.now())throw new HttpError(404,'Quiz not found or expired.');
  await serial(room,async()=>{
   if(room.closed||roomExpires(room)<=Date.now())throw new HttpError(404,'Quiz not found or expired.');
   if(room.meta.ownerId!==ownerId)throw new HttpError(403,'This room belongs to another host.');
   if(room.meta.reportId!==roomId)throw new HttpError(409,'This room has changed. Refresh your rooms.');
   if(unfinishedOnly&&room.engine.phase==='finished')throw new HttpError(409,'This quiz has already finished.');
   await purge(code);
  });
 },
 async report(code,ownerId){const r=rooms.get(code);if(!r||r.closed||roomExpires(r)<=Date.now())throw new HttpError(404,'Room not found.');if(r.meta.ownerId!==ownerId)throw new HttpError(403,'This room belongs to another host.');if(r.engine.phase!=='finished')throw new HttpError(409,'Finish the quiz first.');return {id:r.meta.reportId,quizId:r.meta.quizId,title:r.meta.title,results:r.engine.report()};},
 async purgeOwner(ownerId){deletingOwners.set(ownerId,Date.now()+120000);for(const [code,r] of rooms)if(r.meta.ownerId===ownerId)await serial(r,()=>purge(code));if(env.CHAT_CODE_PEPPER){const key=await chatOwnerKey(env,ownerId);if(accessStore.account(key)||accessStore.attempt(key))await updateAccess(()=>accessStore.revoke(key));}}
};
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json','.txt':'text/plain'};
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.workers.dev wss://*.workers.dev ws://localhost:* ws://127.0.0.1:*; font-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";
const rates=new Map();
function rateLimit(req){const key=req.socket.remoteAddress||'local',now=Date.now();let item=rates.get(key);if(!item||now-item.start>=60000){item={start:now,count:0};rates.set(key,item);}return ++item.count<=240;}
function webRequest(req){return new Request(`http://${req.headers.host||`${host}:${port}`}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});}
async function nodeResponse(res,response){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url.startsWith('/api/')){
   if(!rateLimit(req))return nodeResponse(res,json({error:'Too many requests. Please wait a minute.'},429));
   const request=webRequest(req),image=new URL(request.url).pathname.match(/^\/api\/rooms\/(\d{6})\/media\/([a-f0-9-]{36})(\/plain)?$/);
   if(image&&request.method==='GET'){
     if(!originAllowed(request,env))return nodeResponse(res,json({error:'This website origin is not allowed.'},403));
     const room=rooms.get(image[1]);
     if(!room||room.closed||roomExpires(room)<=Date.now())return nodeResponse(res,json({error:'Quiz not found.'},404));
     const response=await room.media.response(room.engine,env,image[2],!!image[3]);
     if(room.closed)return nodeResponse(res,json({error:'Quiz not found.'},404));
     return nodeResponse(res,responseHeaders(request,env,response));
   }
   return nodeResponse(res,await handleApi(request,env,adapter));
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  const publicDir=join(root,'public'),path=resolve(publicDir,`.${pathname==='/'?'/index.html':pathname}`);
  if(!path.startsWith(`${publicDir}${sep}`)){res.writeHead(403);return res.end();}
  let data;try{data=await readFile(path);}catch{res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':csp,'Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch(error){console.error(JSON.stringify({event:'local_http_error',name:error.name}));if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Request could not complete. Please retry.'}));}
});
const wss=new WebSocketServer({noServer:true,maxPayload:MAX_MESSAGE_BYTES});
server.on('upgrade',(req,socket,head)=>{
 let request;try{request=webRequest(req);}catch{socket.destroy();return;}
 const code=new URL(request.url).pathname.match(/^\/api\/rooms\/(\d{6})\/ws$/)?.[1],room=rooms.get(code);
 if(!originAllowed(request,env)||!room||room.closed||roomExpires(room)<=Date.now()||!rateLimit(req)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>{
  const identity={};room.clients.set(ws,identity);
  const authTimer=setTimeout(()=>{if(!identity.role)ws.close(4008,'Join timed out.');},10000);
  const active=()=>!room.closed&&!identity.superseded&&ws.readyState===1&&roomExpires(room)>Date.now();
  const expireAuth=()=>{if(!identity.role && Date.now()-identity.acceptedAt>=10000){identity.superseded=true;ws.close(4008,'Join timed out.');return true;}return false;};
  identity.acceptedAt=Date.now();
  const applyAuth=async(auth)=>{
    if(!active()||expireAuth())return;
    if(auth.chatUnlocked&&auth.identity.role==='host'&&!room.engine.chatUnlocked&&room.engine.phase!=='finished'){room.engine.authorizeChat({enable:false});await persist(room);}
    Object.assign(identity,auth.identity);clearTimeout(authTimer);
    if(identity.playerId){
      for(const [other,id] of room.clients)if(other!==ws&&id.playerId===identity.playerId){id.superseded=true;delete id.playerId;other.close(4001,'Connected on another tab.');}
      await persistPlayer(room,identity.playerId);
    }
    send(ws,auth.welcome);sendState(room,ws,identity);sendConversation(room,ws,identity);joinBroadcast(room);
  };
  ws.on('message',(bytes,isBinary)=>{
    const serverReceivedAt=Date.now();
    let message;
    try{
      if(!active()||expireAuth())return;
      if(!isBinary&&bytes.toString()==='ping'){ws.send('pong');return;}
      if(isBinary)throw new HttpError(400,'Text messages only.');
      message=decodeMessage(bytes.toString());
      if(!allowMessage(identity,Date.now(),message.type))throw new HttpError(429,'Please slow down.');
      if(identity.authenticating)throw new HttpError(409,'Sign-in is already in progress.');
    }catch(error){send(ws,{...safeError(error),...(CONVERSATION_COMMANDS.has(message?.type)||message?.type==='chat_subscribe'?{scope:'conversation',requestId:message.requestId}:{})});return;}
    // Supabase verification must never hold the room's gameplay queue.
    if(!identity.role && message.type==='auth' && message.role==='host'){
      identity.authenticating=true;
      (async()=>{try{const auth=await authorize(room.engine,room.meta,env,message);auth.chatUnlocked=await accountChatAccess(auth.identity.userId);await serial(room,()=>applyAuth(auth));}catch(error){send(ws,safeError(error));}finally{identity.authenticating=false;}})();
      return;
    }
    serial(room,async()=>{
      let persistedPhase=room.engine.phase;
      // addPlayer and command may cross a deadline after the first transport tick.
      const persistTransition=async()=>{
        if(!room.closed&&persistedPhase!==room.engine.phase){await persist(room);persistedPhase=room.engine.phase;broadcast(room);}
      };
      try{
        if(!active()||expireAuth())return;
        room.engine.tick();
        await persistTransition();
        if(!identity.role){
          const auth=await authorize(room.engine,room.meta,env,message);
          await persistTransition();
          await applyAuth(auth);return;
        }
        if(message.type==='ping'){send(ws,{type:'pong',...(typeof message.id==='string'&&message.id.length<=80?{id:message.id,serverReceivedAt}:{}),serverNow:Date.now()});return;}
        if(message.type==='chat_subscribe'){
          if(identity.conversationVersion!==1||typeof message.enabled!=='boolean')throw new HttpError(400,'Choose whether to receive chat.');
          identity.chatSubscribed=message.enabled;sendConversation(room,ws,identity);return;
        }
        if(message.type==='chat_unlock'){
          if(identity.role!=='host'||identity.userId!==room.meta.ownerId)throw new HttpError(403,'Only the host can unlock chat.');
          if(typeof message.requestId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(message.requestId))throw new HttpError(400,'A message reference is required.');
          if(['countdown','question','finished'].includes(room.engine.phase))throw new HttpError(409,'Unlock chat before starting or between questions.');
          if(!room.engine.chatUnlocked){
            const request=await chatCodeRequest(env,message.code,room.meta.ownerId),grant=await redeemLocal(request);
            if(!grant.ok)throw new HttpError(grant.status,grant.message);
            if(!active())return;
            room.engine.authorizeChat();await persist(room);
          }
          broadcast(room);sendConversation(room,ws,identity);send(ws,{type:'chat_ack',requestId:message.requestId,unlocked:true});return;
        }
        const result=room.engine.command(identity,message);
        if(result?.channel==='conversation'){
          await persistTransition();
          const {event,channel,...ack}=result;
          if(event){await persistConversation(room);broadcastConversation(room,event);}
          send(ws,ack);
        }else if(message.type==='answer'){
          await persistTransition();
          await persistPlayer(room,identity.playerId);
          send(ws,{...result,type:'answer_ack',questionId:message.questionId,accepted:true});
          broadcastProgress(room);
        }else{
          await persist(room);persistedPhase=room.engine.phase;
          if(result?.type)send(ws,result);
          if(message.type==='kick')for(const [other,id]of room.clients)if(id.playerId===message.playerId){id.superseded=true;delete id.playerId;send(other,{type:'error',message:'The host removed you from this quiz.'});other.close(4003,'Removed by host.');}
          broadcast(room);
        }
      }catch(error){
        await persistTransition();
        send(ws,{...safeError(error),...(CONVERSATION_COMMANDS.has(message?.type)||message?.type==='chat_subscribe'?{scope:'conversation',requestId:message.requestId}:{})});
      }
    }).catch(()=>{});
  });
  ws.on('close',()=>{clearTimeout(authTimer);serial(room,async()=>{room.clients.delete(ws);if(!room.closed&&identity.playerId){room.engine.disconnect(identity.playerId);await persistPlayer(room,identity.playerId);joinBroadcast(room);}}).catch(()=>{});});
  ws.on('error',()=>{});
 });
});
const ticking=setInterval(()=>{
 for(const [code,room]of rooms){serial(room,async()=>{
  if(roomExpires(room)<=Date.now()){await purge(code);return;}
  if(room.engine.nextDeadline()&&room.engine.nextDeadline()<=Date.now()){room.engine.tick();await persist(room);broadcast(room);}
 }).catch(()=>{});}
 for(const [ip,entry]of rates)if(Date.now()-entry.start>60000)rates.delete(ip);
 for(const [id,until]of deletingOwners)if(until<=Date.now())deletingOwners.delete(id);
},100);
server.listen(port,host,()=>{
 console.log(`\n  Gather — live quizzes\n  Local: http://${host}:${server.address().port}\n  Local room state persists in .local/rooms. Press Ctrl+C to stop.\n`);
});
server.on('error',error=>{console.error(`Could not start Gather: ${error.message}`);process.exit(1);});
async function shutdown(){clearInterval(ticking);for(const room of rooms.values()){if(room.joinTimer)clearTimeout(room.joinTimer);if(room.progressTimer)clearTimeout(room.progressTimer);for(const ws of room.clients.keys())ws.close(1001,'Local server stopping.');}server.close();setTimeout(()=>process.exit(0),300).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
