import type {Quiz, RoomMeta} from '../../shared/types.js';
import type {WorkerEnv} from '../env.js';
import {CHUNK_SIZE} from '../config.js';
import {DurableObject} from 'cloudflare:workers';
import {RoomMedia} from '../../shared/media/room-media.js';
import {RoomEngine} from '../../shared/quiz/engine.js';
import {RoomConversation} from '../../shared/chat/conversation.js';
import {HttpError} from '../../shared/http/api.js';
import {FINISHED_RETENTION} from '../config.js';
import {LIFETIME} from '../config.js';
import {rpcFailure} from '../http/errors.js';
import {CHAT_ACCESS_REGISTRY} from '../../shared/chat/access.js';
import {chatOwnerKey} from '../../shared/chat/access.js';
import {json} from '../../shared/http/api.js';
import {decodeMessage} from '../../shared/rooms/protocol.js';
import {allowMessage} from '../../shared/rooms/protocol.js';
import {authorize} from '../../shared/rooms/protocol.js';
import {chatCodeRequest} from '../../shared/chat/access.js';
import {safeError} from '../../shared/rooms/protocol.js';
import {CONVERSATION_COMMANDS} from '../../shared/chat/conversation.js';
export function chunks(text){const values=[];for(let start=0;start<text.length;){let end=Math.min(start+CHUNK_SIZE,text.length);const last=text.charCodeAt(end-1);if(end<text.length&&last>=0xd800&&last<=0xdbff)end--;values.push(text.slice(start,end));start=end;}return values;}
// A separate coordination object per six-digit code. No central gameplay bottleneck.
export class GiveawayRoom extends DurableObject<WorkerEnv> {
  declare engine: RoomEngine | null;
  declare meta: RoomMeta | null;
  declare joinBroadcast: ReturnType<typeof setTimeout> | null;
  declare progressTimer: ReturnType<typeof setTimeout> | null;
  declare mediaProgressTimer: ReturnType<typeof setTimeout> | null;
  declare purging: Promise<void> | null;
  declare hostSockets: Set<WebSocket>;
  declare media: RoomMedia;
  declare creating: boolean;

  constructor(ctx: DurableObjectState,env: WorkerEnv) {
    super(ctx,env);
    this.ctx=ctx;this.env=env;this.engine=null;this.meta=null;this.joinBroadcast=null;this.progressTimer=null;this.mediaProgressTimer=null;this.purging=null;this.hostSockets=new Set();this.media=new RoomMedia();
    ctx.blockConcurrencyWhile(async()=>{
      this.initializeStorage();
      const row=ctx.storage.sql.exec<{state: string; meta: string}>('SELECT state,meta FROM checkpoint WHERE id=1').toArray()[0];
      if(row){
        this.meta=JSON.parse(row.meta);
        const parts=ctx.storage.sql.exec<{data: string}>('SELECT data FROM checkpoint_chunks ORDER BY part').toArray();
        const saved=JSON.parse(parts.length?parts.map(p=>p.data).join(''):row.state);
        this.engine=RoomEngine.restore(saved);
        const conversation=ctx.storage.sql.exec<{data: string}>('SELECT data FROM conversation_chunks ORDER BY part').toArray();
        if(this.engine.phase==='finished')ctx.storage.sql.exec('DELETE FROM conversation_chunks');
        else if(conversation.length)this.engine.conversation=new RoomConversation(this.engine.settings,JSON.parse(conversation.map(p=>p.data).join('')),{unlocked:this.engine.chatUnlocked});
        const playerParts=new Map();
        for(const part of ctx.storage.sql.exec<{id: string; data: string}>('SELECT id,data FROM player_chunks ORDER BY id,part').toArray()){if(!playerParts.has(part.id))playerParts.set(part.id,[]);playerParts.get(part.id).push(part.data);}
        for(const player of ctx.storage.sql.exec<{id: string; data: string}>('SELECT id,data FROM players').toArray())this.engine.restorePlayer(JSON.parse(player.data==='null'?(playerParts.get(player.id)||[]).join(''):player.data));
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
  imageInUse(ownerId,url){return !!this.engine&&this.meta?.ownerId===ownerId&&this.expiresAt()>Date.now()&&this.engine.quiz.questions.some(q=>q.image===url||q.options?.some(option=>option.image===url));}
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
  available() {return !!this.engine&&!this.purging&&this.expiresAt()>Date.now();}
  getSummary(ownerId) {
    if(!this.engine||this.purging||this.engine.phase==='finished'||this.expiresAt()<=Date.now()||this.meta.ownerId!==ownerId)return null;
    return {code:this.engine.code,roomId:this.meta.reportId,quizId:this.meta.quizId,title:this.meta.title,phase:this.engine.phase,participants:this.engine.participantCount,expires:this.meta.expiresAt};
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
        try{auth=await authorize(engine,this.meta,this.env,message);if(auth.identity.role==='host')accountChat=await this.accountChatAccess(auth.identity.userId);}
        finally{const current=ws.deserializeAttachment();if(current?.authenticating===authId){delete current.authenticating;ws.serializeAttachment(current);}}
        this.ensure();
        await persistTransition();
        if(this.engine!==engine || this.meta.reportId!==roomId || ws.deserializeAttachment()?.superseded || Date.now()-(identity.acceptedAt || 0)>=10000 || ws.readyState!==1){
          if(auth.identity.playerId && this.engine===engine){engine.disconnect(auth.identity.playerId);this.savePlayer(auth.identity.playerId);}
          ws.serializeAttachment({superseded:true});try{ws.close(4008,'Join timed out.');}catch{}return;
        }
        if(auth.identity.role==='host'&&engine.phase!=='finished'&&engine.chatUnlocked!==accountChat){if(accountChat)engine.authorizeChat({enable:false});else engine.revokeChat();this.checkpoint();this.saveConversation();}
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
