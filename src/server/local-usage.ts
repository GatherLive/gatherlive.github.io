import type {DataRecord} from '../shared/types.js';
import {readFile,writeFile,rename,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import {DEFAULT_LIMITS,usageLimits,usageApplication,quotaStatus} from '../shared/account/usage.js';
import {resourceCount,storedImages} from '../shared/account/storage.js';
import {HttpError} from '../shared/http/api.js';
export async function createLocalUsage({env,stateDir}){
 const file=join(stateDir,'.usage.json');let state: {version: number; accounts: Record<string,DataRecord>; requestsEnabled: boolean}={version:1,accounts:{},requestsEnabled:true},writes=Promise.resolve();const mutations=new Map();
 try{state=JSON.parse(await readFile(file,'utf8'));if(state.version!==1||!state.accounts||typeof state.accounts!=='object')throw new Error('Invalid local usage data.');}catch(error){if(error.code!=='ENOENT')throw error;}
 const recovered=new Map();
 for(const name of await readdir(stateDir))if(/^\d{6}\.json$/.test(name))try{const row=JSON.parse(await readFile(join(stateDir,name),'utf8')),owner=row.meta?.ownerId,quiz=row.meta?.quizId,at=row.state?.createdAt;if(owner&&quiz&&Number.isFinite(at)){const key=owner+':'+quiz,entry=recovered.get(key)||{owner,quiz,count:0,lastHostedAt:0};entry.count++;entry.lastHostedAt=Math.max(entry.lastHostedAt,at);recovered.set(key,entry);}}catch{}
 let recoveredChanged=false;
 for(const row of recovered.values()){const account=state.accounts[row.owner]||{limits:{...DEFAULT_LIMITS}};account.hosted||={};const previous=account.hosted[row.quiz]||{},next={lastHostedAt:Math.max(previous.lastHostedAt||0,row.lastHostedAt),count:Math.max(previous.count||0,row.count)};if(next.lastHostedAt!==previous.lastHostedAt||next.count!==previous.count)recoveredChanged=true;account.hosted[row.quiz]=next;state.accounts[row.owner]=account;}
 function change(work){const task=writes.then(async()=>{const previous=structuredClone(state);try{const result=work();await writeFile(file+'.tmp',JSON.stringify(state),{mode:0o600});await rename(file+'.tmp',file);return result;}catch(error){state=previous;throw error;}});writes=task.catch(()=>{});return task;}
 if(recoveredChanged)await change(()=>{});
 async function limits(id){await writes;return usageLimits(state.accounts[id]?.limits||DEFAULT_LIMITS);}
 async function usage(user,token){
  const [caps,quizzes,results,images]=await Promise.all([limits(user.id),resourceCount(env,token,user.id,'quizzes'),resourceCount(env,token,user.id,'results'),storedImages(env,token,user.id)]);
  return {limits:caps,requestsEnabled:state.requestsEnabled!==false,notice:state.accounts[user.id]?.notice||null,used:{quizzes,results,images:images.length},request:quotaStatus(state.accounts[user.id]?.request),checkedAt:Date.now()};
 }
 function accountMutation(id,work){const previous=mutations.get(id)||Promise.resolve(),task=previous.then(work),settled=task.catch(()=>{});mutations.set(id,settled);return task.finally(()=>{if(mutations.get(id)===settled)mutations.delete(id);});}
 async function applyUsage(user,input){
  return change(()=>{
   if(state.requestsEnabled===false)throw new HttpError(423,'New requests are paused. Please try again later.');
   const account=state.accounts[user.id]||{limits:{...DEFAULT_LIMITS}},current=account.request;
   if(current?.status==='pending')return quotaStatus(current);
   if(current?.status==='declined'&&Date.now()-current.updatedAt<7*86400000)throw new HttpError(409,'Please wait seven days after a declined request before applying again.');
   const value=usageApplication(input,account.limits),now=Date.now();
   account.request={id:crypto.randomUUID(),userId:user.id,email:user.email,...value,status:'pending',createdAt:now,updatedAt:now,note:''};state.accounts[user.id]=account;return quotaStatus(account.request);
  });
 }
 async function requests({status='pending',page=0,search=''}={}){
  if(!['pending','approved','declined','revoked','all'].includes(status)||!Number.isSafeInteger(page)||page<0||page>10000||typeof search!=='string'||search.length>120)throw new HttpError(400,'Choose a valid request filter.');
  await writes;const all=Object.values(state.accounts).filter(account=>account.request).map(account=>({...account.request,currentLimits:usageLimits(account.limits)})),rows=all.filter(row=>(status==='all'||row.status===status)&&(row.email+' '+row.userId).toLowerCase().includes(search.toLowerCase())).sort((a,b)=>status==='pending'?a.createdAt-b.createdAt:b.updatedAt-a.updatedAt);
  return {requestsEnabled:state.requestsEnabled!==false,requests:rows.slice(page*50,(page+1)*50),total:rows.length,pending:all.filter(row=>row.status==='pending').length,page};
 }
 async function review(input){
  return change(()=>{
   if(!['approved','declined','message'].includes(input.decision))throw new HttpError(400,'Choose approve or decline.');
   const account=state.accounts[input.userId],row=account?.request;
   if(!row||row.id!==input.requestId)throw new HttpError(409,'This request changed. Refresh to try again.');
   const note=typeof input.note==='string'?input.note.trim():'';if(note.length>240||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(note))throw new HttpError(400,'Keep the reply under 240 characters.');
   if(input.decision==='message'){if(row.status==='pending')throw new HttpError(409,'Review this request first.');row.note=note;row.updatedAt=Date.now();account.notice={message:note,updatedAt:Date.now()};return {ok:true};}
   if(row.status===input.decision)return {ok:true,limits:account.limits};
   if(row.status!=='pending')throw new HttpError(409,'This request was already reviewed.');
   if(input.decision==='approved')account.limits=usageLimits(input.limits,account.limits);
   if(input.decision==='approved')account.notice={message:note||'Your usage limits have been increased. Thank you for using Gather.',updatedAt:Date.now()};
   Object.assign(row,{status:input.decision,note,updatedAt:Date.now()});return {ok:true,limits:account.limits};
  });
 }
 async function controls(input: DataRecord={}){if(Object.keys(input).some(key=>key!=='requestsEnabled')||input.requestsEnabled!==undefined&&typeof input.requestsEnabled!=='boolean')throw new HttpError(400,'Choose a valid request setting.');if(input.requestsEnabled!==undefined)await change(()=>{state.requestsEnabled=input.requestsEnabled;});await writes;return {requestsEnabled:state.requestsEnabled!==false};}
 async function revoke(input){return change(()=>{if(typeof input.userId!=='string'||!/^[a-f0-9-]{36}$/i.test(input.userId)||typeof(input.note??'')!=='string'||(input.note||'').length>240)throw new HttpError(400,'Choose a valid account and message.');const account=state.accounts[input.userId];if(!account)throw new HttpError(404,'Account allowance not found.');account.limits={...DEFAULT_LIMITS};account.notice={message:input.note?.trim()||'Your account now uses the standard limits.',updatedAt:Date.now()};if(account.request?.status==='approved')Object.assign(account.request,{status:'revoked',note:account.notice.message,updatedAt:Date.now()});return {ok:true,limits:account.limits};});}
 async function recordHosted(ownerId,quizId,at=Date.now()){return change(()=>{const account=state.accounts[ownerId]||{limits:{...DEFAULT_LIMITS}};account.hosted||={};const row=account.hosted[quizId];account.hosted[quizId]={lastHostedAt:at,count:(row?.count||0)+1};state.accounts[ownerId]=account;return at;});}
 async function hosted(ownerId){await writes;return state.accounts[ownerId]?.hosted||{};}
 async function localAccounts({page=0,search=''}={}){
  if(!Number.isSafeInteger(page)||page<0||page>1000||typeof search!=='string'||search.length>120)throw new HttpError(400,'Choose a valid account search.');
  await writes;return Object.values(state.accounts).filter(account=>account.request&&(account.request.email+' '+account.request.userId).toLowerCase().includes(search.toLowerCase())).slice(page*100,(page+1)*100).map(account=>({id:account.request.userId,email:account.request.email,created_at:null,last_sign_in_at:null,email_confirmed_at:null,quizzes:null,reports:null,usage:{limits:account.limits,notice:account.notice}}));
 }
 async function localAccount(id){await writes;const row=state.accounts[id];return row?.request?{id,email:row.request.email,created_at:null,last_sign_in_at:null,email_confirmed_at:null,usage:{limits:row.limits,notice:row.notice}}:null;}
 return {controls,revoke,hosted,recordHosted,usage,accountMutation,applyUsage,limits,requests,review,localAccounts,localAccount,erase:id=>change(()=>{delete state.accounts[id];return {ok:true};})};
}
