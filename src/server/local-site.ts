import {readFile,writeFile,rename} from 'node:fs/promises';
import {join} from 'node:path';
import {chatOwnerKey} from '../shared/chat/access.js';
import {announcementInput,applicationInput,applicationStatus,nextApplication,applicationExpired,validOwnerKey,validAccountId} from '../shared/site/control.js';
import {HttpError} from '../shared/http/api.js';

export async function createLocalSite({env,stateDir,access,waitAccess,updateAccess}){
  const file=join(stateDir,'.announcement.json'),clients=new Set<import('ws').WebSocket>();
  let state={revision:0,announcement:null},queue: Promise<unknown>=Promise.resolve(),expiryTimer;
  try{state=JSON.parse(await readFile(file,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  function broadcast(){for(const ws of clients)if(ws.readyState===1){if(ws.bufferedAmount>65536)ws.close(1013,'Please reconnect.');else ws.send(JSON.stringify(state));}}
  function arm(){
    clearTimeout(expiryTimer);if(!state.announcement?.expiresAt)return;
    expiryTimer=setTimeout(()=>{void expire().catch(()=>{expiryTimer=setTimeout(()=>arm(),1000);expiryTimer.unref();});},Math.max(1,Math.min(2147483647,state.announcement.expiresAt-Date.now())));expiryTimer.unref();
  }
  function change(work){
    const task=queue.then(async()=>{
      const next=work(state);if(!next)return state;
      await writeFile(file+'.tmp',JSON.stringify(next),{mode:0o600});await rename(file+'.tmp',file);
      state=next;arm();broadcast();return state;
    });queue=task.catch(()=>{});return task;
  }
  const expire=()=>change(current=>current.announcement?.expiresAt&&current.announcement.expiresAt<=Date.now()?{revision:current.revision+1,announcement:null}:null);
  const snapshot=async()=>{await queue;await expire();return state;};
  async function prune(){
    await waitAccess();if([...access().applications.values()].some(row=>applicationExpired(row))||[...access().erasures.values()].some(until=>until<=Date.now()))await updateAccess(()=>{for(const [key,row]of access().applications)if(applicationExpired(row))access().applications.delete(key);for(const [key,until]of access().erasures)if(until<=Date.now())access().erasures.delete(key);});
  }
  const cleanup=setInterval(()=>{void prune().catch(()=>{});},86400000);cleanup.unref();arm();
  const saveAccess=(store,key,enabled)=>{
    if(enabled)store.saveClaim(key,key);else store.revoke(key);
    store.saveAttempt(key,{at:Date.now(),attempts:0});
    const row=store.applications.get(key);if(row)store.applications.set(key,{...row,status:enabled?'approved':'declined',updatedAt:Date.now()});
    return {unlocked:enabled};
  };
  return {
    snapshot,
    async subscribe(ws){
      clients.add(ws);ws.on('close',()=>clients.delete(ws));ws.on('error',()=>clients.delete(ws));
      ws.on('message',message=>{if(String(message)==='ping')ws.send('pong');else ws.close(1008,'Read-only connection.');});
      try{const current=await snapshot();if(ws.readyState===1)ws.send(JSON.stringify(current));}catch{ws.close(1011,'Please reconnect.');}
    },
    publish(value){const input=value===null?null:announcementInput(value);return change(current=>({revision:current.revision+1,announcement:input?{...input,id:crypto.randomUUID(),publishedAt:Date.now()}:null}));},
    async application(ownerId){if(!env.CHAT_CODE_PEPPER)return null;await prune();return applicationStatus(access().applications.get(await chatOwnerKey(env,ownerId)));},
    async apply(user){
      const input=applicationInput(await chatOwnerKey(env,user.id),user);await prune();
      return updateAccess(()=>{
        const store=access();if((store.erasures.get(input.ownerKey)||0)>Date.now())throw new HttpError(409,'Account deletion is in progress.');if(store.account(input.ownerKey))return {unlocked:true,application:null};
        const row=nextApplication(store.applications.get(input.ownerKey),input);store.applications.set(input.ownerKey,row);
        return {unlocked:false,application:applicationStatus(row)};
      });
    },
    async requests({status='pending',page=0,search=''}={}){
      if(!['pending','approved','declined','all'].includes(status)||!Number.isInteger(page)||page<0||page>10000||typeof search!=='string'||search.length>120)throw new HttpError(400,'Choose a valid request filter.');
      await prune();const all=[...access().applications.values()],rows=all.filter(row=>(status==='all'||row.status===status)&&row.email.toLowerCase().includes(search.toLowerCase())).sort((a,b)=>status==='pending'?a.updatedAt-b.updatedAt:b.updatedAt-a.updatedAt);
      return {requests:rows.slice(page*50,(page+1)*50),total:rows.length,pending:all.filter(row=>row.status==='pending').length,page};
    },
    async setAccess(ownerId,enabled){
      const key=await chatOwnerKey(env,ownerId);if(typeof enabled!=='boolean')throw new HttpError(400,'Invalid access.');
      return updateAccess(()=>saveAccess(access(),key,enabled));
    },
    async review({ownerKey,requestId,decision}){
      if(!validOwnerKey(ownerKey)||!['approved','declined'].includes(decision))throw new HttpError(400,'Choose approve or decline.');
      return updateAccess(()=>{
        const store=access(),row=store.applications.get(ownerKey);
        if(!row||row.id!==requestId)throw new HttpError(409,'This request has changed. Refresh the inbox.');
        if(row.status!==decision){
          if(row.status!=='pending')throw new HttpError(409,'This request was already reviewed.');
          if(decision==='approved')saveAccess(store,ownerKey,true);
          store.applications.set(ownerKey,{...row,status:decision,updatedAt:Date.now()});
        }
        return {userId:row.userId,unlocked:store.account(ownerKey)};
      });
    },
    async localAccounts({page=0,search=''}={}){
      if(!Number.isInteger(page)||page<0||page>1000||typeof search!=='string'||search.length>120)throw new HttpError(400,'Invalid account search.');
      await prune();const query=search.toLowerCase();
      return [...access().applications.values()].filter(row=>(row.email+' '+row.userId).toLowerCase().includes(query)).slice(page*100,(page+1)*100).map(row=>({id:row.userId,email:row.email,created_at:null,last_sign_in_at:null,email_confirmed_at:null,quizzes:null,reports:null}));
    },
    async localAccount(ownerId){await prune();const key=await chatOwnerKey(env,ownerId),row=access().applications.get(key);return row?{id:row.userId,email:row.email,created_at:null,last_sign_in_at:null,email_confirmed_at:null}:null;},
    async eraseApplication(ownerId){const key=await chatOwnerKey(env,ownerId);await waitAccess();if(access().applications.has(key)||validAccountId(ownerId))await updateAccess(()=>{access().applications.delete(key);access().erasures.set(key,Date.now()+120000);});}
  };
}
