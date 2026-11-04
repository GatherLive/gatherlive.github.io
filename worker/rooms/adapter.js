import {SITE_CONTROL_REGISTRY} from '../../shared/site/control.js';
import {CHAT_ACCESS_REGISTRY} from '../../shared/chat/access.js';
import {chatOwnerKey} from '../../shared/chat/access.js';
import {applicationInput} from '../../shared/site/control.js';
import {HttpError} from '../../shared/http/api.js';
import {chatCodeRequest} from '../../shared/chat/access.js';
import {unwrapRpc} from '../http/errors.js';
import {LIFETIME} from '../config.js';
export function roomAdapter(env){return {
  async available(code){return env.ROOMS.getByName(code).available();},
  async announcement(){return env.ACCOUNTS.getByName(SITE_CONTROL_REGISTRY).siteSnapshot();},
  async chatApplication(ownerId){if(!env.CHAT_CODE_PEPPER)return null;return env.ACCOUNTS.getByName(CHAT_ACCESS_REGISTRY).chatApplication(await chatOwnerKey(env,ownerId));},
  async applyChat(user){
    const input=applicationInput(await chatOwnerKey(env,user.id),user);
    const result=await env.ACCOUNTS.getByName(CHAT_ACCESS_REGISTRY).applyChatApplication(input);
    if(!result?.ok)throw new HttpError(result?.status||503,result?.message||'Chat applications are temporarily unavailable.');
    return {unlocked:result.unlocked,application:result.application};
  },
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
  async purgeOwner(ownerId){const index=env.ACCOUNTS.getByName(ownerId);const rooms=await index.beginDelete();await Promise.all(rooms.map(r=>env.ROOMS.getByName(r.code).purge(ownerId)));if(env.CHAT_CODE_PEPPER){const key=await chatOwnerKey(env,ownerId),registry=env.ACCOUNTS.getByName(CHAT_ACCESS_REGISTRY);await registry.revokeChatAccess(key);await registry.eraseChatApplication(key);}await index.clear();}
};}
