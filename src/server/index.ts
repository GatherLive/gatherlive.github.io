import http from 'node:http';
import {readFile,writeFile,appendFile,rename,mkdir,readdir,unlink,rmdir} from 'node:fs/promises';
import {resolve,extname,dirname,join,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {WebSocketServer} from 'ws';
import {createLocalSite} from './local-site.js';
import {createLocalUsage} from './local-usage.js';
import {loadConfig} from '../../scripts/config.mjs';
import {clientAsset} from '../../scripts/client-build.mjs';
import type {RoomIdentity} from '../shared/types.js';
import {RoomEngine} from '../shared/quiz/engine.js';
import {RoomMedia,mediaRange} from '../shared/media/room-media.js';
import {RoomConversation,CONVERSATION_COMMANDS} from '../shared/chat/conversation.js';
import {chatCodeRequest,chatOwnerKey,redeemChatCode,MemoryChatCodes} from '../shared/chat/access.js';
import {handleApi,originAllowed,json,HttpError,responseHeaders} from '../shared/http/api.js';
import {decodeMessage,authorize,safeError,allowMessage,snapshotBatch,repeatedFlood,MAX_MESSAGE_BYTES} from '../shared/rooms/protocol.js';
import {RoomProbeWindow} from '../shared/rooms/abuse.js';
import {pooledRooms,handleRoomRelay,roomPeerRequestAllowed,poolChatAccess,poolUnlockChat,poolCode} from '../shared/rooms/pool.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const wrangler=JSON.parse(await readFile(join(root,'wrangler.jsonc'),'utf8'));
const legacyAssets=JSON.parse(await readFile(join(root,'scripts/legacy-assets.json'),'utf8'));
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
const redeemLocal=request=>updateAccess(()=>{const result=redeemChatCode(env,accessStore,request),row=accessStore.applications.get(request.ownerKey);if(result.ok&&row&&row.status!=='approved')accessStore.applications.set(request.ownerKey,{...row,status:'approved',updatedAt:Date.now()});return result;});
async function accountChatAccess(ownerId){
  const remote=await poolChatAccess(env,ownerId);if(remote!==null)return remote;
  if(!env.CHAT_CODE_PEPPER)return false;
  await accessQueue;return accessStore.account(await chatOwnerKey(env,ownerId));
}
const site=await createLocalSite({env,stateDir,access:()=>accessStore,waitAccess:()=>accessQueue,updateAccess});
const usage=await createLocalUsage({env,stateDir});
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
function send(ws,message){if(ws.readyState===1){if(ws.bufferedAmount>1024*1024){ws.close(1013,'Connection too slow; reconnect.');return;}ws.send(typeof message==='string'?message:JSON.stringify(message));}}
function sendState(room,ws,identity){send(ws,{type:'state',state:room.engine.snapshot(identity.role==='host',identity.playerId,{media:identity.mediaVersion||false,conversation:identity.conversationVersion===1})});}
function sendConversation(room,ws,identity){if(identity.conversationVersion===1)send(ws,{type:'conversation',state:room.engine.conversation.snapshot(identity,room.engine.phase)});}
function broadcastConversation(room,event){
  if(!event||room.closed||room.engine.phase==='finished')return;
  const packet=JSON.stringify(event);
  for(const [ws,id]of room.clients){
    if(id.conversationVersion!==1||id.superseded)continue;
    if(id.chatSubscribed===false&&!['announcement','chat_settings','chat_cleared'].includes(event.type))continue;
    if(event.type==='chat_typing'&&(!id.chatViewing||event.senderId===(id.role==='host'?'host':id.playerId)))continue;
    send(ws,packet);
  }
}
function updateTyping(room,ws,identity,message){
  const {conversation,phase,players}=room.engine,now=Date.now(),wasViewing=identity.chatViewing;
  broadcastConversation(room,conversation.updateTyping(identity,message,phase,players,now));
  if(wasViewing||!identity.chatViewing)return;
  for(const [other,id] of room.clients){
    if(other===ws||other.readyState!==1)continue;
    const activity=conversation.typingStatus(id,players,now);
    if(activity)send(ws,activity);
  }
}
function broadcastProgress(room){
  if(room.progressTimer)return;
  room.progressTimer=setTimeout(()=>{room.progressTimer=null;if(room.closed||room.engine.phase!=='question')return;for(const [ws,id]of room.clients)if(id.role==='host'&&!id.superseded)send(ws,{...room.engine.progress(),questionId:room.engine.question?.id});},50);
}
function broadcastMediaProgress(room){if(room.mediaProgressTimer)return;room.mediaProgressTimer=setTimeout(()=>{room.mediaProgressTimer=null;if(room.closed||room.engine.phase!=='countdown')return;for(const [ws,id] of room.clients)if(id.role==='host'&&!id.superseded)send(ws,{type:'media_progress',...room.engine.mediaStatus()});},100);}
function broadcast(room){if(room.closed)return;const message=snapshotBatch(room.engine,true);for(const [ws,identity] of room.clients)if(identity.role&&!identity.superseded)send(ws,message(identity));}
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
// Erase retired local progress only when its owner deletes their account.
async function eraseRetiredProgress(ownerId){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(ownerId));
 const path=join(stateDir,'.learning',Buffer.from(digest).toString('hex')+'.json');
 for(const suffix of ['', '.tmp'])try{await unlink(path+suffix);}catch(error){if(error.code!=='ENOENT')throw error;}
}
const adapter={
 async available(code){const room=rooms.get(code);return !!room&&!room.closed&&roomExpires(room)>Date.now();},
 async announcement(){return site.snapshot();},
 async chatApplication(ownerId){return site.application(ownerId);},
 async applyChat(user){if((deletingOwners.get(user.id)||0)>Date.now())throw new HttpError(409,'Account deletion is in progress.');return site.apply(user);},
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
   const code=poolCode(env);if(rooms.has(code))continue;
   const engine=new RoomEngine({...data,code,mediaOrigin:env.SUPABASE_URL});
   if(accountChat)engine.authorizeChat({enable:false});
   const meta={ownerId:data.ownerId,quizId:data.quiz.id,title:data.quiz.title,reportId:crypto.randomUUID(),expiresAt:Date.now()+LIFETIME};
   const room=makeRoom(engine,meta);rooms.set(code,room);
   try{await serial(room,()=>persist(room));return code;}catch(error){await serial(room,()=>purge(code));throw error;}
  }throw new HttpError(503,'No room code available; retry.');
 },
 async list(ownerId){return [...rooms].filter(([,r])=>!r.closed&&r.engine.phase!=='finished'&&r.meta.ownerId===ownerId&&roomExpires(r)>Date.now()).map(([code,r])=>({code,roomId:r.meta.reportId,quizId:r.meta.quizId,title:r.meta.title,phase:r.engine.phase,participants:r.engine.participantCount,expires:r.meta.expiresAt})).sort((a,b)=>b.expires-a.expires);},
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
 async purgeOwner(ownerId){deletingOwners.set(ownerId,Date.now()+120000);await eraseRetiredProgress(ownerId);for(const [code,r] of rooms)if(r.meta.ownerId===ownerId)await serial(r,()=>purge(code));if(env.CHAT_CODE_PEPPER){const key=await chatOwnerKey(env,ownerId);if(accessStore.account(key)||accessStore.attempt(key))await updateAccess(()=>accessStore.revoke(key));await site.eraseApplication(ownerId);}}
};
Object.assign(adapter,{recordHosted:usage.recordHosted,hosted:usage.hosted,usage:usage.usage,accountMutation:usage.accountMutation,applyUsage:usage.applyUsage,eraseUsage:usage.erase,imageInUse:async(ownerId,url)=>[...rooms.values()].some(room=>!room.closed&&room.meta.ownerId===ownerId&&roomExpires(room)>Date.now()&&room.engine.quiz.questions.some(q=>q.image===url||q.options?.some(o=>o.image===url)))});
const apiAdapter=pooledRooms(env,adapter);
const relayNonces=new Map<string,number>();
function claimRelay(nonce){const now=Date.now();for(const [key,at]of relayNonces)if(now-at>60000)relayNonces.delete(key);if(relayNonces.has(nonce)||relayNonces.size>=10000)return false;relayNonces.set(nonce,now);return true;}
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.ico':'image/x-icon','.json':'application/json','.txt':'text/plain'};
const csp="default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.workers.dev wss://*.workers.dev https://challenges.cloudflare.com http://localhost:* http://127.0.0.1:* ws://localhost:* ws://127.0.0.1:*; frame-src https://challenges.cloudflare.com; font-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'";
const rates=new Map();
function rateLimit(req){const media=/^\/api\/(?:site\/|health|config|rooms\/\d{6}(?:$|\/(?:media\/|ws$)))/.test(req.url),key=(req.socket.remoteAddress||'local')+(media?':media':':api'),now=Date.now();let item=rates.get(key);if(!item||now-item.start>=60000){item={start:now,count:0};rates.set(key,item);}return ++item.count<=(media?3000:240);}
const probes=new Map<string,{window:RoomProbeWindow;touched:number}>();
function probeWindow(req){
 const key=req.socket.remoteAddress||'local',now=Date.now();let item=probes.get(key);
 if(!item){if(probes.size>=10_000)probes.delete(probes.keys().next().value);item={window:new RoomProbeWindow(),touched:now};probes.set(key,item);}item.touched=now;return item.window;
}
async function roomProbe(req,code){
 const window=probeWindow(req),result=window.probe(code);
 if(!result.allowed)throw new HttpError(429,'Too many room codes. Wait a minute and retry.');
 if(result.cached)return result.available;
 const available=await apiAdapter.available(code);window.settle(code,available);return available;
}
const verificationPolicy=req=>({check:()=>probeWindow(req).verification(new URL(req.url,'http://local').pathname.split('/')[3]),failed:()=>probeWindow(req).verification(new URL(req.url,'http://local').pathname.split('/')[3],true)});
function webRequest(req){return new Request(`http://${req.headers.host||`${host}:${port}`}${req.url}`,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});}
async function nodeResponse(res,response){res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}
let localExtension=null;
// Optional development hooks stay in local configuration.
if(port>0&&['127.0.0.1','localhost','::1'].includes(host)){
  const extensionModule=pathToFileURL(join(root,'.local','dev-extension.mjs'));
  let module;try{module=await import(extensionModule.href);}catch(error){if(error.code!=='ERR_MODULE_NOT_FOUND'||error.url!==extensionModule.href)throw error;}
  if(module)localExtension=await module.createDevExtension({env,stateDir,port,site,usage,rooms,adapter,serial,persist,persistConversation,broadcast,sendConversation,roomExpires,accountChatAccess,accessStore,updateAccess});
}
const server=http.createServer(async(req,res)=>{
 try{
  const extensionResponse=localExtension?await localExtension(webRequest(req),req.socket.remoteAddress):null;
  if(extensionResponse)return nodeResponse(res,extensionResponse);
 }catch{return nodeResponse(res,json({error:'The local extension could not complete this request.'},503));}
 try{
  if(req.url.startsWith('/api/')){
   if(!rateLimit(req))return nodeResponse(res,json({error:'Too many requests. Please wait a minute.'},429));
   const request=webRequest(req),url=new URL(request.url),image=url.pathname.match(/^\/api\/rooms\/(\d{6})\/media\/([a-f0-9-]{36})(\/plain)?$/);
   if(!originAllowed(request,env))return nodeResponse(res,json({error:'This website origin is not allowed.'},403));
   const relay=await handleRoomRelay(request,env,adapter,claimRelay);if(relay)return nodeResponse(res,relay);
   if(!roomPeerRequestAllowed(request,env))return nodeResponse(res,json({error:'Endpoint not found.'},404));
   const check=url.pathname.match(/^\/api\/rooms\/(\d{6})$/);
   if(check&&request.method==='GET'){
    try{const discovery=await roomProbe(req,check[1])?await apiAdapter.discover(check[1]):{available:false};return nodeResponse(res,responseHeaders(request,env,discovery.available?json(discovery):json({error:'Room is not available.'},404)));}
    catch(error){const response=json({error:error.message},error.status||503);if(error.status===429)response.headers.set('Retry-After','60');return nodeResponse(res,responseHeaders(request,env,response));}
   }
   if(image&&request.method==='GET'){
     if(!originAllowed(request,env))return nodeResponse(res,json({error:'This website origin is not allowed.'},403));
     try{if(!await roomProbe(req,image[1]))return nodeResponse(res,responseHeaders(request,env,json({error:'Quiz not found.'},404)));}
     catch(error){const response=json({error:error.message},error.status||503);if(error.status===429)response.headers.set('Retry-After','60');return nodeResponse(res,responseHeaders(request,env,response));}
     const room=rooms.get(image[1]);
     if(!room||room.closed||roomExpires(room)<=Date.now())return nodeResponse(res,json({error:'Quiz not found.'},404));
     const response=await room.media.response(room.engine,env,image[2],!!image[3]);
     if(room.closed)return nodeResponse(res,json({error:'Quiz not found.'},404));
     return nodeResponse(res,responseHeaders(request,env,mediaRange(response,request)));
   }
   return nodeResponse(res,await handleApi(request,env,apiAdapter));
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);return res.end();}
  let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);}catch{res.writeHead(400);return res.end();}
  const assetName=pathname.slice(1),legacy=Object.hasOwn(legacyAssets,assetName)?legacyAssets[assetName]:null;
  if(legacy&&(pathname.endsWith('.js')||pathname.endsWith('.css'))){
    const kind=pathname.endsWith('.js')?'text/javascript; charset=utf-8':'text/css; charset=utf-8';
    const content=pathname.endsWith('.js')?`export * from './${legacy}';\n`:`@import url('./${legacy}');\n`;
    res.writeHead(200,{'Content-Type':kind,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff'});return res.end(req.method==='HEAD'?undefined:content);
  }
  const sourceAsset=await clientAsset(legacy?'/'+legacy:pathname);
  if(sourceAsset!==null){res.writeHead(200,{'Content-Type':mime[extname(pathname)]||'text/javascript; charset=utf-8','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':csp});return res.end(req.method==='HEAD'?undefined:sourceAsset);}
  const publicDir=join(root,'public'),path=resolve(publicDir,`.${legacy?'/'+legacy:pathname==='/'?'/index.html':pathname}`);
  if(!path.startsWith(`${publicDir}${sep}`)){res.writeHead(403);return res.end();}
  let data;try{data=await readFile(path);}catch{res.writeHead(404);return res.end('Not found');}
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Content-Security-Policy':csp,'Referrer-Policy':'no-referrer','Permissions-Policy':'camera=(), microphone=(), geolocation=()'});
  res.end(req.method==='HEAD'?undefined:data);
 }catch(error){console.error(JSON.stringify({event:'local_http_error',name:error.name}));if(!res.headersSent)res.writeHead(500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Request could not complete. Please retry.'}));}
});
const siteWss=new WebSocketServer({noServer:true,maxPayload:64});
const wss=new WebSocketServer({noServer:true,maxPayload:MAX_MESSAGE_BYTES});
server.on('upgrade',async(req,socket,head)=>{
 let request;try{request=webRequest(req);}catch{socket.destroy();return;}
 if(!originAllowed(request,env)||!rateLimit(req)){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 if(new URL(request.url).pathname==='/api/site/updates'){
  siteWss.handleUpgrade(req,socket,head,ws=>{void site.subscribe(ws);});return;
 }
 const code=new URL(request.url).pathname.match(/^\/api\/rooms\/(\d{6})\/ws$/)?.[1],room=rooms.get(code);
 try{if(code&&!await roomProbe(req,code)){socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');socket.destroy();return;}}
 catch{socket.write('HTTP/1.1 429 Too Many Requests\r\nRetry-After: 60\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 if(!room||room.closed||roomExpires(room)<=Date.now()){socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');socket.destroy();return;}
 wss.handleUpgrade(req,socket,head,ws=>{
  const identity: RoomIdentity={};room.clients.set(ws,identity);
  let authFailures=0;
  const authFailure=()=>{if(!identity.role&&++authFailures>=5){identity.superseded=true;ws.close(4008,'Too many join attempts. Wait a minute and retry.');}};
  const authTimer=setTimeout(()=>{if(!identity.role)ws.close(4008,'Join timed out.');},10000);
  const active=()=>!room.closed&&!identity.superseded&&ws.readyState===1&&roomExpires(room)>Date.now();
  const expireAuth=()=>{if(!identity.role && Date.now()-identity.acceptedAt>=10000){identity.superseded=true;ws.close(4008,'Join timed out.');return true;}return false;};
  identity.acceptedAt=Date.now();
  const applyAuth=async(auth)=>{
    if(!active()||expireAuth())return;
    if(auth.identity.role==='host'&&room.engine.phase!=='finished'&&room.engine.chatUnlocked!==auth.chatUnlocked){if(auth.chatUnlocked)room.engine.authorizeChat({enable:false});else room.engine.revokeChat();await persist(room);await persistConversation(room);}
    Object.assign(identity,auth.identity);clearTimeout(authTimer);
    if(identity.playerId){
      for(const [other,id] of room.clients)if(other!==ws&&id.playerId===identity.playerId){
        id.superseded=true;
        broadcastConversation(room,room.engine.conversation.stopTyping(id));
        delete id.playerId;other.close(4001,'Connected on another tab.');
      }
      await persistPlayer(room,identity.playerId);
    }
    send(ws,auth.welcome);sendState(room,ws,identity);sendConversation(room,ws,identity);joinBroadcast(room);
  };
  ws.on('message',(bytes,isBinary)=>{
    const serverReceivedAt=Date.now();
    let message;
    try{
      if(!active()||expireAuth())return;
      if(!isBinary&&bytes.toString()==='ping'){if(!allowMessage(identity,Date.now(),'ping'))throw new HttpError(429,'Please slow down.');send(ws,'pong');return;}
      if(isBinary)throw new HttpError(400,'Text messages only.');
      message=decodeMessage(bytes.toString());
      if(!allowMessage(identity,Date.now(),message.type))throw new HttpError(429,'Please slow down.');
      if(identity.authenticating)throw new HttpError(409,'Sign-in is already in progress.');
    }catch(error){if(message?.type!=='chat_typing')send(ws,{...safeError(error),...(CONVERSATION_COMMANDS.has(message?.type)||message?.type==='chat_subscribe'?{scope:'conversation',requestId:message.requestId}:{})});if(error.status===429&&repeatedFlood(identity))ws.close(1008,'Too many messages. Reconnect after a short pause.');return;}
    // Supabase verification must never hold the room's gameplay queue.
    if(!identity.role && message.type==='auth' && message.role==='host'){
      identity.authenticating=true;
      (async()=>{try{const auth=await authorize(room.engine,room.meta,env,message);auth.chatUnlocked=await accountChatAccess(auth.identity.userId);await serial(room,()=>applyAuth(auth));}catch(error){send(ws,safeError(error));authFailure();}finally{identity.authenticating=false;}})();
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
        if(message.type==='chat_typing'){
          if(identity.role)updateTyping(room,ws,identity,message);
          return;
        }
        room.engine.tick();
        await persistTransition();
        if(!identity.role){
          const auth=await authorize(room.engine,room.meta,env,message,verificationPolicy(req));
          await persistTransition();
          await applyAuth(auth);return;
        }
        if(message.type==='join_code_request'){
          if(identity.role!=='host'||identity.userId!==room.meta.ownerId)throw new HttpError(403,'Only the host can view the join verification code.');
          if(room.engine.settings.joinVerification&&room.engine.phase!=='finished')send(ws,{type:'join_code',roomCode:room.engine.code,...await room.engine.joinChallenge()});
          return;
        }
        if(message.type==='ping'){send(ws,{type:'pong',...(typeof message.id==='string'&&message.id.length<=80?{id:message.id,serverReceivedAt}:{}),serverNow:Date.now()});return;}
        if(message.type==='chat_subscribe'){
          if(identity.conversationVersion!==1||typeof message.enabled!=='boolean')throw new HttpError(400,'Choose whether to receive chat.');
          identity.chatSubscribed=message.enabled;
          if(!message.enabled){identity.chatViewing=false;broadcastConversation(room,room.engine.conversation.stopTyping(identity));}
          sendConversation(room,ws,identity);return;
        }
        if(message.type==='chat_unlock'){
          if(identity.role!=='host'||identity.userId!==room.meta.ownerId)throw new HttpError(403,'Only the host can unlock chat.');
          if(typeof message.requestId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(message.requestId))throw new HttpError(400,'A message reference is required.');
          if(['countdown','question','finished'].includes(room.engine.phase))throw new HttpError(409,'Unlock chat before starting or between questions.');
          if(!room.engine.chatUnlocked){
            const remote=await poolUnlockChat(env,room.meta.ownerId,message.code);
            const grant=remote?{ok:true}:await redeemLocal(await chatCodeRequest(env,message.code,room.meta.ownerId));
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
        }else if(message.type==='media_ready'){
          if(result.changed&&identity.role==='host'&&room.engine.phase==='countdown')await persist(room);await persistTransition();if(result.changed&&identity.playerId)await persistPlayer(room,identity.playerId);send(ws,{type:result.type,token:result.token});if(result.changed)broadcastMediaProgress(room);
        }else if(message.type==='answer'){
          await persistTransition();
          await persistPlayer(room,identity.playerId);
          send(ws,{...result,type:'answer_ack',questionId:message.questionId,accepted:true});
          broadcastProgress(room);
        }else{
          await persist(room);persistedPhase=room.engine.phase;
          if(result?.type)send(ws,result);
          if(message.type==='kick')for(const [other,id]of room.clients)if(id.playerId===message.playerId){
            id.superseded=true;
            broadcastConversation(room,room.engine.conversation.stopTyping(id));
            delete id.playerId;send(other,{type:'error',message:'The host removed you from this quiz.'});other.close(4003,'Removed by host.');
          }
          broadcast(room);
        }
      }catch(error){
        authFailure();
        await persistTransition();
        if(message.type!=='chat_typing')send(ws,{...safeError(error),...(CONVERSATION_COMMANDS.has(message?.type)||message?.type==='chat_subscribe'?{scope:'conversation',requestId:message.requestId}:{})});
      }
    }).catch(()=>{});
  });
  ws.on('close',()=>{
    clearTimeout(authTimer);
    serial(room,async()=>{
      room.clients.delete(ws);
      if(room.closed||identity.superseded)return;
      broadcastConversation(room,room.engine.conversation.stopTyping(identity));
      if(identity.playerId){room.engine.disconnect(identity.playerId);if(room.engine.tick()){await persist(room);broadcast(room);}else await persistPlayer(room,identity.playerId);joinBroadcast(room);}
    }).catch(()=>{});
  });
  ws.on('error',()=>{});
 });
});
const ticking=setInterval(()=>{
 for(const [code,room]of rooms){serial(room,async()=>{
  if(roomExpires(room)<=Date.now()){await purge(code);return;}
  if(room.engine.nextDeadline()&&room.engine.nextDeadline()<=Date.now()){room.engine.tick();await persist(room);broadcast(room);}
 }).catch(()=>{});}
 for(const [ip,entry]of rates)if(Date.now()-entry.start>60000)rates.delete(ip);
 for(const [ip,entry]of probes)if(Date.now()-entry.touched>120000)probes.delete(ip);
 for(const [id,until]of deletingOwners)if(until<=Date.now())deletingOwners.delete(id);
},100);
server.listen(port,host,()=>{
 console.log(`\n  Gather — live quizzes\n  Local: http://${host}:${(server.address() as import('node:net').AddressInfo).port}\n  Local room state persists in .local/rooms. Press Ctrl+C to stop.\n`);
});
server.on('error',error=>{console.error(`Could not start Gather: ${error.message}`);process.exit(1);});
async function shutdown(){clearInterval(ticking);for(const room of rooms.values()){if(room.joinTimer)clearTimeout(room.joinTimer);if(room.progressTimer)clearTimeout(room.progressTimer);for(const ws of room.clients.keys())ws.close(1001,'Local server stopping.');}server.close();setTimeout(()=>process.exit(0),300).unref();}
process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
