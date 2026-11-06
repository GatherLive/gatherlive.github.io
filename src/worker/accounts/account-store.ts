import type {WorkerEnv} from '../env.js';
import type {LearningProgress, ChatAccessState, RpcResult} from '../../shared/types.js';
import {DurableObject} from 'cloudflare:workers';
import {HttpError} from '../../shared/http/api.js';
import {emptyLearningProgress} from '../../shared/learn/progress.js';
import {mergeLearningProgress} from '../../shared/learn/progress.js';
import {resetLearningProgress} from '../../shared/learn/progress.js';
import {rpcFailure} from '../http/errors.js';
import {REQUEST_PENDING_MS} from '../../shared/site/control.js';
import {REQUEST_REVIEWED_MS} from '../../shared/site/control.js';
import {applicationStatus} from '../../shared/site/control.js';
import {applicationInput} from '../../shared/site/control.js';
import {nextApplication} from '../../shared/site/control.js';
import {validOwnerKey} from '../../shared/site/control.js';
import {announcementInput} from '../../shared/site/control.js';
import {json} from '../../shared/http/api.js';
import {redeemChatCode} from '../../shared/chat/access.js';
// Owner index is separate from live games, used only for listing and account erasure.
export class AccountRooms extends DurableObject<WorkerEnv> {
  declare accessEnv: WorkerEnv;

  constructor(ctx: DurableObjectState,env: WorkerEnv){super(ctx,env);this.ctx=ctx;this.accessEnv=env;ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping','pong'));ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rooms(code TEXT PRIMARY KEY,expires INTEGER NOT NULL)');ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS closing(id INTEGER PRIMARY KEY,until_ms INTEGER NOT NULL)');}
  learning(method,progress): RpcResult<{progress: LearningProgress}>{
    try{
      const sql=this.ctx.storage.sql;
      const closing=sql.exec<{until_ms: number}>('SELECT until_ms FROM closing WHERE id=1').toArray()[0];
      if(closing?.until_ms>Date.now())throw new HttpError(409,'Account deletion is in progress.');
      sql.exec('CREATE TABLE IF NOT EXISTS learning_progress(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL)');
      return this.ctx.storage.transactionSync(()=>{
        const saved=sql.exec<{data: string}>('SELECT data FROM learning_progress WHERE id=1').toArray()[0];
        const current=saved?JSON.parse(saved.data):emptyLearningProgress();
        const next=method==='POST'?mergeLearningProgress(current,progress):method==='DELETE'?resetLearningProgress(current):current;
        const data=JSON.stringify(next);
        if(method!=='GET'&&data!==saved?.data)sql.exec('INSERT OR REPLACE INTO learning_progress(id,data) VALUES(1,?)',data);
        return {ok:true,progress:next};
      });
    }catch(error){return {...rpcFailure(error),...(error.status===409&&error.progress?{progress:error.progress}:{})};}
  }
  applicationTables(){
    const sql=this.ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS chat_applications(owner_key TEXT PRIMARY KEY,user_id TEXT NOT NULL,email TEXT NOT NULL,status TEXT NOT NULL,updated INTEGER NOT NULL,data TEXT NOT NULL)');
    sql.exec('CREATE INDEX IF NOT EXISTS chat_applications_queue ON chat_applications(status,updated)');
    sql.exec('CREATE TABLE IF NOT EXISTS chat_erasure(owner_key TEXT PRIMARY KEY,until_ms INTEGER NOT NULL)');
    sql.exec('DELETE FROM chat_erasure WHERE until_ms<=?',Date.now());
    sql.exec("DELETE FROM chat_applications WHERE (status='pending' AND updated<=?) OR (status!='pending' AND updated<=?)",Date.now()-REQUEST_PENDING_MS,Date.now()-REQUEST_REVIEWED_MS);
    return sql;
  }
  applicationRow(ownerKey){
    const row=this.applicationTables().exec<{data: string}>('SELECT data FROM chat_applications WHERE owner_key=?',ownerKey).toArray()[0];
    return row?JSON.parse(row.data):null;
  }
  saveApplication(row){this.applicationTables().exec('INSERT OR REPLACE INTO chat_applications(owner_key,user_id,email,status,updated,data) VALUES(?,?,?,?,?,?)',row.ownerKey,row.userId,row.email,row.status,row.updatedAt,JSON.stringify(row));}
  chatApplication(ownerKey){return applicationStatus(this.applicationRow(ownerKey));}
  async applyChatApplication(input): Promise<RpcResult<ChatAccessState>>{
    try{
      applicationInput(input?.ownerKey,{id:input?.userId,email:input?.email});
      const alarm=await this.ctx.storage.getAlarm();if(alarm===null||alarm>Date.now()+86400000)await this.ctx.storage.setAlarm(Date.now()+86400000);
      return this.ctx.storage.transactionSync(()=>{
        if(this.applicationTables().exec<{owner_key: string}>('SELECT owner_key FROM chat_erasure WHERE owner_key=?',input.ownerKey).toArray().length)throw new HttpError(409,'Account deletion is in progress.');
        if(this.chatAccessStore().account(input.ownerKey))return {ok:true,unlocked:true,application:null};
        const row=nextApplication(this.applicationRow(input.ownerKey),input);this.saveApplication(row);
        return {ok:true,unlocked:false,application:applicationStatus(row)};
      });
    }catch(error){return rpcFailure(error);}
  }
  listChatApplications({status='pending',page=0,search=''}={}){
    if(!['pending','approved','declined','all'].includes(status)||!Number.isInteger(page)||page<0||page>10000||typeof search!=='string'||search.length>120)throw new HttpError(400,'Choose a valid request filter.');
    const sql=this.applicationTables(),query='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
    const filter="(?='all' OR status=?) AND email LIKE ? ESCAPE '\\'";
    const total=sql.exec<{count: number}>('SELECT count(*) AS count FROM chat_applications WHERE '+filter,status,status,query).toArray()[0].count;
    const pending=sql.exec("SELECT count(*) AS count FROM chat_applications WHERE status='pending'").toArray()[0].count;
    const rows=sql.exec<{data: string}>('SELECT data FROM chat_applications WHERE '+filter+` ORDER BY updated ${status==='pending'?'ASC':'DESC'} LIMIT 50 OFFSET ?`,status,status,query,page*50).toArray().map(row=>JSON.parse(row.data));
    return {requests:rows,total,pending,page};
  }
  setChatAccess(ownerKey,enabled){
    if(!validOwnerKey(ownerKey)||typeof enabled!=='boolean')throw new HttpError(400,'Invalid account access.');
    const store=this.chatAccessStore();
    this.ctx.storage.transactionSync(()=>{
      if(enabled)this.ctx.storage.sql.exec('INSERT OR REPLACE INTO chat_codes(digest,owner_key) VALUES(?,?)',ownerKey,ownerKey);
      else{this.ctx.storage.sql.exec("UPDATE chat_codes SET owner_key='' WHERE owner_key=?",ownerKey);this.ctx.storage.sql.exec('DELETE FROM chat_attempts WHERE owner_key=?',ownerKey);}
      store.saveAttempt(ownerKey,{at:Date.now(),attempts:0});
      const row=this.applicationRow(ownerKey);
      if(row){row.status=enabled?'approved':'declined';row.updatedAt=Date.now();this.saveApplication(row);}
    });
    return {unlocked:enabled};
  }
  reviewChatApplication(ownerKey,requestId,decision){
    if(!validOwnerKey(ownerKey)||!['approved','declined'].includes(decision))throw new HttpError(400,'Choose approve or decline.');
    return this.ctx.storage.transactionSync(()=>{
      const row=this.applicationRow(ownerKey);
      if(!row||row.id!==requestId)throw new HttpError(409,'This request has changed. Refresh the inbox.');
      if(row.status!==decision){
        if(row.status!=='pending')throw new HttpError(409,'This request was already reviewed.');
        if(decision==='approved'){this.chatAccessStore();this.ctx.storage.sql.exec('INSERT OR REPLACE INTO chat_codes(digest,owner_key) VALUES(?,?)',ownerKey,ownerKey);}
        row.status=decision;row.updatedAt=Date.now();this.saveApplication(row);
      }
      return {userId:row.userId,unlocked:this.chatAccessStore().account(ownerKey)};
    });
  }
  eraseChatApplication(ownerKey){const sql=this.applicationTables();this.ctx.storage.transactionSync(()=>{sql.exec('DELETE FROM chat_applications WHERE owner_key=?',ownerKey);sql.exec('INSERT OR REPLACE INTO chat_erasure(owner_key,until_ms) VALUES(?,?)',ownerKey,Date.now()+120000);});}
  siteTable(){this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS site_announcement(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,data TEXT)');}
  siteSnapshot(){
    this.siteTable();let row: {revision: number; data?: string}=this.ctx.storage.sql.exec<{revision: number; data: string}>('SELECT revision,data FROM site_announcement WHERE id=1').toArray()[0];
    let announcement=row?.data?JSON.parse(row.data):null;
    if(announcement?.expiresAt&&announcement.expiresAt<=Date.now()){
      row={revision:row.revision+1};announcement=null;
      this.ctx.storage.sql.exec('UPDATE site_announcement SET revision=?,data=NULL WHERE id=1',row.revision);
      this.broadcastSite({revision:row.revision,announcement:null});
    }
    return {revision:row?.revision||0,announcement};
  }
  async publishSiteAnnouncement(value){
    const input=value===null?null:announcementInput(value);
    return this.ctx.blockConcurrencyWhile(async()=>{
      const previous=this.siteSnapshot();
      if(input?.expiresAt)await this.ctx.storage.setAlarm(input.expiresAt);
      else await this.ctx.storage.deleteAlarm();
      const state={revision:previous.revision+1,announcement:input?{...input,id:crypto.randomUUID(),publishedAt:Date.now()}:null};
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO site_announcement(id,revision,data) VALUES(1,?,?)',state.revision,state.announcement?JSON.stringify(state.announcement):null);
      this.broadcastSite(state);return state;
    });
  }
  broadcastSite(state){
    for(const ws of this.ctx.getWebSockets('site'))try{ws.send(JSON.stringify(state));}catch{try{ws.close(1011,'Please reconnect.');}catch{}}
  }
  fetch(request){
    if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'A WebSocket connection is required.'},426);
    const pair=new WebSocketPair();this.ctx.acceptWebSocket(pair[1],['site']);pair[1].send(JSON.stringify(this.siteSnapshot()));
    return new Response(null,{status:101,webSocket:pair[0]});
  }
  webSocketMessage(ws,message){if(message==='ping'){ws.send('pong');return;}ws.close(1008,'Read-only connection.');}
  webSocketClose(ws,code){try{ws.close(code===1006?1000:code,'');}catch{}}
  webSocketError(ws){try{ws.close(1011,'Please reconnect.');}catch{}}
  chatAccessStore(){
      const sql=this.ctx.storage.sql;
      sql.exec('CREATE TABLE IF NOT EXISTS chat_codes(digest TEXT PRIMARY KEY,owner_key TEXT NOT NULL)');
      sql.exec('CREATE INDEX IF NOT EXISTS chat_codes_owner ON chat_codes(owner_key)');
      sql.exec('CREATE TABLE IF NOT EXISTS chat_attempts(owner_key TEXT PRIMARY KEY,at INTEGER NOT NULL,attempts INTEGER NOT NULL)');
      return {
        prune:before=>sql.exec('DELETE FROM chat_attempts WHERE at < ?',before),
        attempt:key=>sql.exec<{at: number; attempts: number}>('SELECT at,attempts FROM chat_attempts WHERE owner_key=?',key).toArray()[0],
        saveAttempt:(key,value)=>sql.exec('INSERT OR REPLACE INTO chat_attempts(owner_key,at,attempts) VALUES(?,?,?)',key,value.at,value.attempts),
        claim:key=>sql.exec<{owner_key: string}>('SELECT owner_key FROM chat_codes WHERE digest=?',key).toArray()[0]?.owner_key,
        account:key=>sql.exec<{digest: string}>('SELECT digest FROM chat_codes WHERE owner_key=? LIMIT 1',key).toArray().length>0,
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
      return this.ctx.storage.transactionSync(()=>{
        const result=redeemChatCode(this.accessEnv,store,request);
        if(result.ok){const row=this.applicationRow(request.ownerKey);if(row&&row.status!=='approved'){row.status='approved';row.updatedAt=Date.now();this.saveApplication(row);}}
        return result;
      });
    }catch{return {ok:false,status:503,message:'Chat activation is temporarily unavailable.'};}
  }
  add(code,expires){
    const closing=this.ctx.storage.sql.exec<{until_ms: number}>('SELECT until_ms FROM closing WHERE id=1').toArray()[0];
    if(closing?.until_ms>Date.now())return false;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO rooms VALUES(?,?)',code,expires);return true;
  }
  list(){this.ctx.storage.sql.exec('DELETE FROM rooms WHERE expires < ?',Date.now());return this.ctx.storage.sql.exec<{code: string; expires: number}>('SELECT code,expires FROM rooms').toArray();}
  async beginDelete(){const until=Date.now()+120000;this.ctx.storage.sql.exec('INSERT OR REPLACE INTO closing(id,until_ms) VALUES(1,?)',until);await this.ctx.storage.setAlarm(until);return this.list();}
  remove(code,expires){this.ctx.storage.sql.exec('DELETE FROM rooms WHERE code=? AND expires=?',code,expires);}
  clear(){this.ctx.storage.sql.exec('DELETE FROM rooms');this.ctx.storage.sql.exec('DROP TABLE IF EXISTS learning_progress');}
  async alarm(){
    const sql=this.ctx.storage.sql;sql.exec('DELETE FROM closing WHERE until_ms <= ?',Date.now());
    if(sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_applications'").toArray().length){
      this.applicationTables();if(sql.exec<{owner_key: string}>('SELECT owner_key FROM chat_applications LIMIT 1').toArray().length)await this.ctx.storage.setAlarm(Date.now()+86400000);
    }
    if(sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='site_announcement'").toArray().length){const state=this.siteSnapshot();if(state.announcement?.expiresAt)await this.ctx.storage.setAlarm(state.announcement.expiresAt);}
  }
}
