import {DurableObject} from 'cloudflare:workers';
import {RoomEngine} from '../shared/engine.js';
import {emptyLearningProgress,mergeLearningProgress,resetLearningProgress} from '../shared/learning-progress.js';
import {RoomMedia,mediaRange} from '../shared/media.js';
import {RoomConversation,CONVERSATION_COMMANDS} from '../shared/conversation.js';
import {chatCodeRequest,chatOwnerKey,redeemChatCode,CHAT_ACCESS_REGISTRY} from '../shared/chat-access.js';
import {handleApi, originAllowed, json, HttpError, responseHeaders} from '../shared/api.js';
import {decodeMessage, authorize, safeError, allowMessage} from '../shared/protocol.js';
const LIFETIME=24*60*60*1000;
const FINISHED_RETENTION=15*60*1000;
const CHUNK_SIZE=256*1024;
function chunks(text){const values=[];for(let start=0;start<text.length;){let end=Math.min(start+CHUNK_SIZE,text.length);const last=text.charCodeAt(end-1);if(end<text.length&&last>=0xd800&&last<=0xdbff)end--;values.push(text.slice(start,end));start=end;}return values;}

// A separate coordination object per six-digit code. No central gameplay bottleneck.
export class GiveawayRoom extends DurableObject {
  constructor(ctx,env) {
    super(ctx,env);
    this.ctx=ctx;this.env=env;this.engine=null;this.meta=null;this.joinBroadcast=null;this.progressTimer=null;this.mediaProgressTimer=null;this.purging=null;this.hostSockets=new Set();this.media=new RoomMedia();
    ctx.blockConcurrencyWhile(async()=>{
      this.initializeStorage();
      const row=ctx.storage.sql.exec('SELECT state,meta FROM checkpoint WHERE id=1').toArray()[0];
      if(row){
        this.meta=JSON.parse(row.meta);
        const parts=ctx.storage.sql.exec('SELECT data FROM checkpoint_chunks ORDER BY part').toArray();
        const saved=JSON.parse(parts.length?parts.map(p=>p.data).join(''):row.state);
        this.engine=RoomEngine.restore(saved);
        const conversation=ctx.storage.sql.exec('SELECT data FROM conversation_chunks ORDER BY part').toArray();
        if(this.engine.phase==='finished')ctx.storage.sql.exec('DELETE FROM conversation_chunks');
        else if(conversation.length)this.engine.conversation=new RoomConversation(this.engine.settings,JSON.parse(conversation.map(p=>p.data).join('')),{unlocked:this.engine.chatUnlocked});
        const playerParts=new Map();
        for(const part of ctx.storage.sql.exec('SELECT id,data FROM player_chunks ORDER BY id,part').toArray()){if(!playerParts.has(part.id))playerParts.set(part.id,[]);playerParts.get(part.id).push(part.data);}
        for(const player of ctx.storage.sql.exec('SELECT id,data FROM players').toArray())this.engine.restorePlayer(JSON.parse(player.data==='null'?(playerParts.get(player.id)||[]).join(''):player.data));
        if(this.engine.phase==='finished'&&(saved.conversation?.messages?.length||saved.conversation?.announcement))this.checkpoint();
      }
      if(this.engine?.mediaGate?.hostRequired)this.engine.mediaGate.hostReady=ctx.getWebSockets().some(ws=>{const id=ws.deserializeAttachment();return id?.role==='host'&&!id.superseded&&id.roomId===this.meta?.reportId&&id.mediaReadyToken===this.engine.mediaGate.token;});
      this.hostSockets=new Set(ctx.getWebSockets().filter(ws=>{const identity=ws.deserializeAttachment();return identity?.role==='host'&&!identity.superseded&&identity.roomId===this.meta?.reportId;}));
      ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));
      if(this.engine){
        const alarm=await ctx.storage.getAlarm();
        if(alarm===null||alarm>this.expiresAt())await this.schedule();
      }
    });
  }
  initializeStorage() {
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS checkpoint (id INTEGER PRIMARY KEY CHECK(id=1), state TEXT NOT NULL, meta TEXT NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS players (id TEXT PRIMARY KEY, data TEXT NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS checkpoint_chunks (part INTEGER PRIMARY KEY, data TEXT NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS player_chunks (id TEXT NOT NULL, part INTEGER NOT NULL, data TEXT NOT NULL, PRIMARY KEY(id,part))');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS conversation_chunks (part INTEGER PRIMARY KEY, data TEXT NOT NULL)');
  }
  ensure() {
    if(!this.engine || this.purging || this.expiresAt() <= Date.now())throw new HttpError(404,'Quiz not found or expired.');
  }
  expiresAt(){return this.engine?.phase==='finished'&&Number.isFinite(this.engine.finishedAt)?this.engine.finishedAt+FINISHED_RETENTION:this.meta?.expiresAt;}
  checkpoint() {
    const state=JSON.stringify(this.engine.serialize({includePlayers:false,includeConversation:false}));
    this.ctx.storage.transactionSync(()=>{
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO checkpoint(id,state,meta) VALUES(1,?,?)','null',JSON.stringify(this.meta));
      this.ctx.storage.sql.exec('DELETE FROM checkpoint_chunks');
      chunks(state).forEach((part,index)=>this.ctx.storage.sql.exec('INSERT INTO checkpoint_chunks(part,data) VALUES(?,?)',index,part));
      this.ctx.storage.sql.exec('DELETE FROM players');
      this.ctx.storage.sql.exec('DELETE FROM player_chunks');
      for(const id of this.engine.players.keys())this.writePlayer(id);
      this.writeConversation();
    });
  }
  writeConversation() {
    this.ctx.storage.sql.exec('DELETE FROM conversation_chunks');
    if(this.engine.phase==='finished')return;
    chunks(JSON.stringify(this.engine.conversation.serialize())).forEach((part,index)=>this.ctx.storage.sql.exec('INSERT INTO conversation_chunks(part,data) VALUES(?,?)',index,part));
  }
  saveConversation() {this.ctx.storage.transactionSync(()=>this.writeConversation());}
  writePlayer(id) {
    const player=this.engine.serializePlayer(id);
    if(!player)return;
    const encoded=JSON.stringify(player);
    this.ctx.storage.sql.exec('DELETE FROM player_chunks WHERE id=?',id);
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO players(id,data) VALUES(?,?)',id,encoded.length<=CHUNK_SIZE?encoded:'null');
    if(encoded.length>CHUNK_SIZE)chunks(encoded).forEach((part,index)=>this.ctx.storage.sql.exec('INSERT INTO player_chunks(id,part,data) VALUES(?,?,?)',id,index,part));
  }
  savePlayer(id) {this.ctx.storage.transactionSync(()=>this.writePlayer(id));}
  async schedule() {
    if(!this.engine)return;
    let next=this.expiresAt();
    const deadline=this.engine.nextDeadline();
    if(deadline)next=Math.min(next,deadline);
    for(const ws of this.ctx.getWebSockets()){
      const id=ws.deserializeAttachment();
      if(!id?.role && !id?.superseded)next=Math.min(next,(id?.acceptedAt || Date.now())+10000);
    }
    await this.ctx.storage.setAlarm(Math.max(Date.now()+10,next));
  }
  async create(data) {
    if(this.creating)return {ok:true,created:false};
    this.creating=true;
    try {
      if(this.purging)await this.purging;
      if(this.engine && this.expiresAt() > Date.now())return {ok:true,created:false};
      if(this.meta)await this.purge(this.meta.ownerId);
      const engine=new RoomEngine({...data,mediaOrigin:this.env.SUPABASE_URL});
      if(await this.accountChatAccess(data.ownerId))engine.authorizeChat({enable:false});
      this.closeConnections('This room code has been renewed.');
      this.engine=engine;
      this.meta={ownerId:data.ownerId,quizId:data.quiz.id,title:data.quiz.title,reportId:crypto.randomUUID(),expiresAt:Date.now()+LIFETIME};
      this.checkpoint();await this.schedule();return {ok:true,created:true};
    }catch(error){return rpcFailure(error);}finally{this.creating=false;}
  }
  async accountChatAccess(ownerId){
    if(!this.env.CHAT_CODE_PEPPER)return false;
    try{return (await this.env.ACCOUNTS.getByName(CHAT_ACCESS_REGISTRY).getChatAccess(await chatOwnerKey(this.env,ownerId))).unlocked===true;}catch{return false;}
  }
  async getReport(ownerId) {
    try {
      this.ensure();
      if(ownerId!==this.meta.ownerId)throw new HttpError(403,'This quiz belongs to another host.');
      if(this.engine.phase!=='finished')throw new HttpError(409,'Finish the quiz to save results.');
      return {ok:true,report:{id:this.meta.reportId,quizId:this.meta.quizId,title:this.meta.title,results:this.engine.report()}};
    }catch(error){return rpcFailure(error);}
  }
  getSummary(ownerId) {
    if(!this.engine||this.purging||this.engine.phase==='finished'||this.expiresAt()<=Date.now()||this.meta.ownerId!==ownerId)return null;
    return {code:this.engine.code,roomId:this.meta.reportId,quizId:this.meta.quizId,title:this.meta.title,phase:this.engine.phase,participants:this.engine.players.size,expires:this.meta.expiresAt};
  }
  async closeRoom(ownerId,roomId,unfinishedOnly=false) {
    try{
      this.ensure();
      if(this.meta.ownerId!==ownerId)throw new HttpError(403,'This room belongs to another host.');
      if(this.meta.reportId!==roomId)throw new HttpError(409,'This room has changed. Refresh your rooms.');
      if(unfinishedOnly&&this.engine.phase==='finished')throw new HttpError(409,'This quiz has already finished.');
      await this.purge(ownerId);return {ok:true};
    }catch(error){return rpcFailure(error);}
  }
  closeConnections(reason) {
    this.hostSockets.clear();
    if(this.joinBroadcast){clearTimeout(this.joinBroadcast);this.joinBroadcast=null;}
    if(this.progressTimer){clearTimeout(this.progressTimer);this.progressTimer=null;}
    for(const ws of this.ctx.getWebSockets()){ws.serializeAttachment({superseded:true});try{ws.close(1000,reason);}catch{}}
  }
  async purge(ownerId) {
    if(this.purging){await this.purging;return;}
    if(!this.meta || ownerId!==this.meta.ownerId)return;
    this.closeConnections('This quiz has closed.');
    const code=this.engine.code;
    this.purging=(async()=>{
      if(this.env.ACCOUNTS){
        const index=this.env.ACCOUNTS.getByName(ownerId),entry=(await index.list()).find(room=>room.code===code);
        if(entry)await index.remove(code,entry.expires);
      }
      await this.ctx.storage.deleteAll();this.initializeStorage();this.engine=null;this.meta=null;this.media=new RoomMedia();
    })();
    try{await this.purging;}finally{this.purging=null;}
  }
  async fetch(request) {
    try {
      this.ensure();
      const image=new URL(request.url).pathname.match(/^\/api\/rooms\/\d{6}\/media\/([a-f0-9-]{36})(\/plain)?$/);
      if(image && request.method==='GET'){
        const engine=this.engine;
        const response=await this.media.response(engine,this.env,image[1],!!image[2]);
        this.ensure();
        if(this.engine!==engine)throw new HttpError(404,'Quiz not found.');
        return response;
      }
      if(request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'Use a WebSocket connection.'},426);
      const pair=new WebSocketPair();const [client,server]=Object.values(pair);
      this.ctx.acceptWebSocket(server);
      server.serializeAttachment({acceptedAt:Date.now(),roomId:this.meta.reportId});
      await this.schedule();
      return new Response(null,{status:101,webSocket:client});
    }catch(error){return json({error:error.message},error.status || 500);}
  }
  send(ws,body) {try{ws.send(JSON.stringify(body));}catch{}}
  sendState(ws,identity) {this.send(ws,{type:'state',state:this.engine.snapshot(identity.role==='host',identity.playerId,{media:identity.mediaVersion||false,conversation:identity.conversationVersion===1})});}
  sendConversation(ws,identity) {if(identity.conversationVersion===1)this.send(ws,{type:'conversation',state:this.engine.conversation.snapshot(identity,this.engine.phase)});}
  broadcastConversation(event) {
    if(!this.engine||this.engine.phase==='finished')return;
    for(const ws of this.ctx.getWebSockets()){
      const identity=ws.deserializeAttachment();
      if(identity?.conversationVersion!==1||identity.superseded||identity.roomId!==this.meta.reportId)continue;
      if(identity.chatSubscribed===false&&!['announcement','chat_settings','chat_cleared'].includes(event.type))continue;
      this.send(ws,event);
    }
  }
  broadcastProgress() {
    if(this.progressTimer)return;
    this.progressTimer=setTimeout(()=>{
      this.progressTimer=null;if(!this.engine||this.engine.phase!=='question')return;
      const progress={...this.engine.progress(),questionId:this.engine.question?.id};
      for(const host of this.hostSockets)this.send(host,progress);
    },50);
  }
  broadcastMediaProgress(){
    if(this.mediaProgressTimer)return;this.mediaProgressTimer=setTimeout(()=>{this.mediaProgressTimer=null;if(this.engine?.phase!=='countdown')return;for(const host of this.hostSockets)this.send(host,{type:'media_progress',...this.engine.mediaStatus()});},100);
  }
  broadcast() {
    if(!this.engine)return;
    for(const ws of this.ctx.getWebSockets()){
      const identity=ws.deserializeAttachment();
      if(identity?.role && !identity.superseded && identity.roomId===this.meta.reportId)this.sendState(ws,identity);
    }
  }
  broadcastJoins() {
    if(this.joinBroadcast)return;
    this.joinBroadcast=setTimeout(()=>{this.joinBroadcast=null;this.broadcast();},100);
  }
  async webSocketMessage(ws,raw) {
    const serverReceivedAt=Date.now();let message;
    const observedEngine=this.engine;
    let persistedPhase=observedEngine?.phase;
    // Joins and answers also tick internally; their transitions need full checkpoints.
    const persistTransition=async()=>{
      if(!this.engine || this.purging || this.engine!==observedEngine || this.engine.phase===persistedPhase)return;
      this.checkpoint();this.broadcast();await this.schedule();
      persistedPhase=this.engine.phase;
    };
    try {
      this.ensure();
      message=decodeMessage(raw);
      let identity=ws.deserializeAttachment() || {};
      if(identity.superseded || identity.roomId!==this.meta.reportId){ws.serializeAttachment({superseded:true});try{ws.close(4001,'This connection is no longer active.');}catch{}return;}
      if(!identity.role && Date.now()-(identity.acceptedAt || 0)>=10000){ws.serializeAttachment({superseded:true});ws.close(4008,'Join timed out.');return;}
      if(identity.authenticating)throw new HttpError(409,'Sign-in is already in progress.');
      if(!allowMessage(identity,Date.now(),message.type))throw new HttpError(429,'Please slow down.');
      ws.serializeAttachment(identity);
      this.engine.tick();
      await persistTransition();
      if(!identity.role){
        const engine=this.engine,roomId=this.meta.reportId,authId=crypto.randomUUID();
        ws.serializeAttachment({...identity,authenticating:authId});
        let auth,accountChat=false;
        try{auth=await authorize(engine,this.meta,this.env,message);if(auth.identity.role==='host'&&!engine.chatUnlocked)accountChat=await this.accountChatAccess(auth.identity.userId);}
        finally{const current=ws.deserializeAttachment();if(current?.authenticating===authId){delete current.authenticating;ws.serializeAttachment(current);}}
        this.ensure();
        await persistTransition();
        if(this.engine!==engine || this.meta.reportId!==roomId || ws.deserializeAttachment()?.superseded || Date.now()-(identity.acceptedAt || 0)>=10000 || ws.readyState!==1){
          if(auth.identity.playerId && this.engine===engine){engine.disconnect(auth.identity.playerId);this.savePlayer(auth.identity.playerId);}
          ws.serializeAttachment({superseded:true});try{ws.close(4008,'Join timed out.');}catch{}return;
        }
        if(accountChat&&engine.phase!=='finished'){engine.authorizeChat({enable:false});this.checkpoint();}
        identity={...identity,...auth.identity};ws.serializeAttachment(identity);
        if(identity.role==='host')this.hostSockets.add(ws);
        // A resumed player replaces their old connection to prevent double control.
        if(identity.playerId){
          for(const other of this.ctx.getWebSockets()){
            if(other===ws)continue;
            if(other.deserializeAttachment()?.playerId===identity.playerId){other.serializeAttachment({superseded:true});try{other.close(4001,'Connected on another tab.');}catch{}}
          }
          this.savePlayer(identity.playerId);
        }
        this.send(ws,auth.welcome);this.sendState(ws,identity);this.sendConversation(ws,identity);this.broadcastJoins();await this.schedule();return;
      }
      if(message.type==='ping'){this.send(ws,{type:'pong',...(typeof message.id==='string'&&message.id.length<=80?{id:message.id,serverReceivedAt}:{}),serverNow:Date.now()});return;}
      if(message.type==='chat_subscribe'){
        if(identity.conversationVersion!==1||typeof message.enabled!=='boolean')throw new HttpError(400,'Choose whether to receive chat.');
        identity.chatSubscribed=message.enabled;ws.serializeAttachment(identity);this.sendConversation(ws,identity);return;
      }
      if(message.type==='chat_unlock'){
        if(identity.role!=='host'||identity.userId!==this.meta.ownerId)throw new HttpError(403,'Only the host can unlock chat.');
        if(typeof message.requestId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(message.requestId))throw new HttpError(400,'A message reference is required.');
        if(['countdown','question','finished'].includes(this.engine.phase))throw new HttpError(409,'Unlock chat before starting or between questions.');
        const engine=this.engine,roomId=this.meta.reportId;
        if(!engine.chatUnlocked){
          const request=await chatCodeRequest(this.env,message.code,this.meta.ownerId);
          const grant=await this.env.ACCOUNTS.getByName(CHAT_ACCESS_REGISTRY).redeemCode(request);
          if(!grant?.ok)throw new HttpError(grant?.status||503,grant?.message||'Chat activation is temporarily unavailable.');
          this.ensure();
          if(this.engine!==engine||this.meta.reportId!==roomId||ws.deserializeAttachment()?.superseded)throw new HttpError(409,'This room has changed. Please reconnect.');
          engine.authorizeChat();this.checkpoint();
        }
        this.broadcast();this.sendConversation(ws,identity);
        this.send(ws,{type:'chat_ack',requestId:message.requestId,unlocked:true});return;
      }
      const result=this.engine.command(identity,message);
      if(result?.channel==='conversation'){
        await persistTransition();
        const {event,channel,...ack}=result;
        if(event){this.saveConversation();this.broadcastConversation(event);}
        this.send(ws,ack);
      }else if(message.type==='media_ready'){
        if(result.changed&&identity.role==='host'){identity.mediaReadyToken=message.token;ws.serializeAttachment(identity);}
        await persistTransition();if(result.changed&&identity.playerId)this.savePlayer(identity.playerId);this.send(ws,{type:result.type,token:result.token});if(result.changed)this.broadcastMediaProgress();
      }else if(message.type==='answer'){
        await persistTransition();
        this.savePlayer(identity.playerId);
        this.send(ws,{...result,type:'answer_ack',questionId:message.questionId,accepted:true});
        this.broadcastProgress();
      } else {
        this.checkpoint();persistedPhase=this.engine.phase;
        if(result?.type)this.send(ws,result);
        if(message.type==='kick'){
          for(const client of this.ctx.getWebSockets())if(client.deserializeAttachment()?.playerId===message.playerId){this.send(client,{type:'error',message:'The host removed you from this quiz.'});client.serializeAttachment({superseded:true});try{client.close(4003,'Removed by host.');}catch{}}
        }
        this.broadcast();
      }
      if(message.type!=='answer'&&result?.channel!=='conversation')await this.schedule();
    }catch(error){
      await persistTransition();
      this.send(ws,{...safeError(error),...(CONVERSATION_COMMANDS.has(message?.type)||message?.type==='chat_subscribe'?{scope:'conversation',requestId:message.requestId}:{})});
    }
  }
  async webSocketClose(ws) {
    this.hostSockets.delete(ws);
    const identity=ws.deserializeAttachment();
    if(this.engine && !this.purging && !identity?.superseded && identity?.playerId && identity.roomId===this.meta.reportId){this.engine.disconnect(identity.playerId);if(this.engine.tick()){this.checkpoint();this.broadcast();await this.schedule();}else this.savePlayer(identity.playerId);this.broadcastJoins();}
    try{ws.close(1000,'Connection closed.');}catch{}
  }
  async webSocketError(ws){await this.webSocketClose(ws);}
  async alarm() {
    if(!this.engine)return;
    if(this.expiresAt()<=Date.now()){
      const ownerId=this.meta.ownerId;await this.purge(ownerId);return;
    }
    for(const ws of this.ctx.getWebSockets()){
      const identity=ws.deserializeAttachment();
      if(!identity?.role && !identity?.superseded && Date.now()-(identity?.acceptedAt || 0)>=10000){ws.serializeAttachment({superseded:true});try{ws.close(4008,'Join timed out.');}catch{}}
    }
    if(this.engine.tick()){this.checkpoint();this.broadcast();}await this.schedule();
  }
}

// Owner index is separate from live games, used only for listing and account erasure.
export class AccountRooms extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.accessEnv=env;ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,expires INTEGER NOT NULL)');ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS closing(id INTEGER PRIMARY KEY,until_ms INTEGER NOT NULL)');}
  learning(method,progress){
    try{
      const sql=this.ctx.storage.sql;
      const closing=sql.exec('SELECT until_ms FROM closing WHERE id=1').toArray()[0];
      if(closing?.until_ms>Date.now())throw new HttpError(409,'Account deletion is in progress.');
      sql.exec('CREATE TABLE IF NOT EXISTS learning_progress(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL)');
      return this.ctx.storage.transactionSync(()=>{
        const saved=sql.exec('SELECT data FROM learning_progress WHERE id=1').toArray()[0];
        const current=saved?JSON.parse(saved.data):emptyLearningProgress();
        const next=method==='POST'?mergeLearningProgress(current,progress):method==='DELETE'?resetLearningProgress(current):current;
        const data=JSON.stringify(next);
        if(method!=='GET'&&data!==saved?.data)sql.exec('INSERT OR REPLACE INTO learning_progress(id,data) VALUES(1,?)',data);
        return {ok:true,progress:next};
      });
    }catch(error){return {...rpcFailure(error),...(error.status===409&&error.progress?{progress:error.progress}:{})};}
  }
  chatAccessStore(){
      const sql=this.ctx.storage.sql;
      sql.exec('CREATE TABLE IF NOT EXISTS chat_codes(digest TEXT PRIMARY KEY,owner_key TEXT NOT NULL)');
      sql.exec('CREATE INDEX IF NOT EXISTS chat_codes_owner ON chat_codes(owner_key)');
      sql.exec('CREATE TABLE IF NOT EXISTS chat_attempts(owner_key TEXT PRIMARY KEY,at INTEGER NOT NULL,attempts INTEGER NOT NULL)');
      return {
        prune:before=>sql.exec('DELETE FROM chat_attempts WHERE at < ?',before),
        attempt:key=>sql.exec('SELECT at,attempts FROM chat_attempts WHERE owner_key=?',key).toArray()[0],
        saveAttempt:(key,value)=>sql.exec('INSERT OR REPLACE INTO chat_attempts(owner_key,at,attempts) VALUES(?,?,?)',key,value.at,value.attempts),
        claim:key=>sql.exec('SELECT owner_key FROM chat_codes WHERE digest=?',key).toArray()[0]?.owner_key,
        account:key=>sql.exec('SELECT digest FROM chat_codes WHERE owner_key=? LIMIT 1',key).toArray().length>0,
        saveClaim:(key,owner)=>sql.exec('INSERT INTO chat_codes(digest,owner_key) VALUES(?,?)',key,owner)
      };
  }
  getChatAccess(ownerKey){
    if(typeof ownerKey!=='string'||!/^[a-f0-9]{64}$/.test(ownerKey))return {ok:false,unlocked:false};
    return {ok:true,unlocked:this.chatAccessStore().account(ownerKey)};
  }
  revokeChatAccess(ownerKey){
    if(typeof ownerKey!=='string'||!/^[a-f0-9]{64}$/.test(ownerKey))return;
    this.chatAccessStore();
    this.ctx.storage.transactionSync(()=>{
      this.ctx.storage.sql.exec("UPDATE chat_codes SET owner_key='' WHERE owner_key=?",ownerKey);
      this.ctx.storage.sql.exec('DELETE FROM chat_attempts WHERE owner_key=?',ownerKey);
    });
  }
  redeemCode(request){
    try{
      const store=this.chatAccessStore();
      return this.ctx.storage.transactionSync(()=>redeemChatCode(this.accessEnv,store,request));
    }catch{return {ok:false,status:503,message:'Chat activation is temporarily unavailable.'};}
  }
  add(code,expires){
    const closing=this.ctx.storage.sql.exec('SELECT until_ms FROM closing WHERE id=1').toArray()[0];
    if(closing?.until_ms>Date.now())return false;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO rooms VALUES(?,?)',code,expires);return true;
  }
  list(){this.ctx.storage.sql.exec('DELETE FROM rooms WHERE expires < ?',Date.now());return this.ctx.storage.sql.exec('SELECT code,expires FROM rooms').toArray();}
  async beginDelete(){const until=Date.now()+120000;this.ctx.storage.sql.exec('INSERT OR REPLACE INTO closing(id,until_ms) VALUES(1,?)',until);await this.ctx.storage.setAlarm(until);return this.list();}
  remove(code,expires){this.ctx.storage.sql.exec('DELETE FROM rooms WHERE code=? AND expires=?',code,expires);}
  clear(){this.ctx.storage.sql.exec('DELETE FROM rooms');this.ctx.storage.sql.exec('DROP TABLE IF EXISTS learning_progress');}
  alarm(){this.ctx.storage.sql.exec('DELETE FROM closing WHERE until_ms <= ?',Date.now());}
}
function rpcFailure(error){
  const status=error.status || (error.name==='EngineError'?400:500);
  return {ok:false,status,message:status>=500&&!error.status?'The room could not complete that action. Please retry.':error.message};
}
function unwrapRpc(result,key){if(!result?.ok)throw new HttpError(result?.status || 502,result?.message || 'The room service is unavailable.');return result[key];}
function roomAdapter(env){return {
  async learning(ownerId,method,progress){
    const result=await env.ACCOUNTS.getByName(ownerId).learning(method,progress);
    if(!result?.ok){const error=new HttpError(result?.status||503,result?.message||'Learning sync is temporarily unavailable.');if(result?.progress)error.progress=result.progress;throw error;}
    return result.progress;
  },
  async chatAccess(ownerId){
    if(!env.CHAT_CODE_PEPPER)return false;
    const access=await env.ACCOUNTS.getByName(CHAT_ACCESS_REGISTRY).getChatAccess(await chatOwnerKey(env,ownerId));
    if(!access.ok)throw new HttpError(503,'Chat activation is temporarily unavailable.');
    return access.unlocked===true;
  },
  async unlockChat(ownerId,code){
    const grant=await env.ACCOUNTS.getByName(CHAT_ACCESS_REGISTRY).redeemCode(await chatCodeRequest(env,code,ownerId));
    if(!grant?.ok)throw new HttpError(grant?.status||503,grant?.message||'Chat activation is temporarily unavailable.');
  },
  async create(data){
    for(let attempt=0;attempt<12;attempt++){
      const number=crypto.getRandomValues(new Uint32Array(1))[0];
      // Rejection sampling keeps all six-digit codes equally likely.
      if(number>=4_294_800_000){attempt--;continue;}
      const code=String(100000+number%900000);
      if(unwrapRpc(await env.ROOMS.getByName(code).create({...data,code}),'created')){
        try{if(!await env.ACCOUNTS.getByName(data.ownerId).add(code,Date.now()+LIFETIME))throw new HttpError(409,'Account deletion is in progress. Please retry in two minutes if you kept your account.');}
        catch(error){await env.ROOMS.getByName(code).purge(data.ownerId);throw error;}
        return code;
      }
    }
    throw new HttpError(503,'Could not reserve a room code. Please retry.');
  },
  async list(ownerId){
    const indexed=await env.ACCOUNTS.getByName(ownerId).list(),rooms=[];
    for(let i=0;i<indexed.length;i+=5){const batch=await Promise.all(indexed.slice(i,i+5).map(r=>env.ROOMS.getByName(r.code).getSummary(ownerId)));rooms.push(...batch.filter(Boolean));}
    return rooms.sort((a,b)=>b.expires-a.expires);
  },
  async close(code,ownerId,roomId,{unfinishedOnly=false}={}){
    unwrapRpc(await env.ROOMS.getByName(code).closeRoom(ownerId,roomId,unfinishedOnly));
  },
  async report(code,ownerId){return unwrapRpc(await env.ROOMS.getByName(code).getReport(ownerId),'report');},
  async purgeOwner(ownerId){const index=env.ACCOUNTS.getByName(ownerId);const rooms=await index.beginDelete();await Promise.all(rooms.map(r=>env.ROOMS.getByName(r.code).purge(ownerId)));if(env.CHAT_CODE_PEPPER)await env.ACCOUNTS.getByName(CHAT_ACCESS_REGISTRY).revokeChatAccess(await chatOwnerKey(env,ownerId));await index.clear();}
};}
export default {
  async fetch(request,env,ctx){
    if(!originAllowed(request,env))return responseHeaders(request,env,json({error:'This website origin is not allowed.'},403));
    const url=new URL(request.url);
    const isSocket=/^\/api\/rooms\/\d{6}\/ws$/.test(url.pathname) && request.method==='GET';
    const isMedia=/^\/api\/rooms\/\d{6}\/media\/[a-f0-9-]{36}(?:\/plain)?$/.test(url.pathname) && request.method==='GET';
    const cacheKey=isMedia&&!url.pathname.endsWith('/plain')?new Request(url.origin+url.pathname):null;
    if(cacheKey){try{const cached=await caches.default.match(cacheKey);if(cached)return responseHeaders(request,env,mediaRange(cached,request));}catch{/* Caching must not block an image. */}}
    if(!['/api/health','/api/config'].includes(url.pathname)){
      const ip=request.headers.get('CF-Connecting-IP') || 'unknown';
      // Large groups on one Wi-Fi share an IP. Keep host API and guest joins separate.
      const isMediaPreflight=request.method==='OPTIONS'&&/^\/api\/rooms\/\d{6}\/media\/[a-f0-9-]{36}(?:\/plain)?$/.test(url.pathname);
      const limiter=isSocket||isMedia||isMediaPreflight ? env.CONNECTION_LIMITER : env.API_LIMITER;
      if(limiter && !(await limiter.limit({key:ip})).success)return responseHeaders(request,env,json({error:'Too many requests. Please wait a minute.'},429));
    }
    if(isSocket)return env.ROOMS.getByName(url.pathname.split('/')[3]).fetch(request);
    if(isMedia){
      const response=await env.ROOMS.getByName(url.pathname.split('/')[3]).fetch(request);
      if(cacheKey&&response.status===200)ctx.waitUntil(caches.default.put(cacheKey,response.clone()).catch(()=>{}));
      return responseHeaders(request,env,mediaRange(response,request));
    }
    return handleApi(request,env,roomAdapter(env));
  }
};
