// Server-only activation. Plaintext codes are never stored in room state.
export const CHAT_ACCESS_REGISTRY='chat-access:registry:v1';
const HEX=/^[a-f0-9]{64}$/;
const WINDOW=15*60*1000;
const failure=(message,status=400)=>Object.assign(new Error(message),{status});
export function configuredChatCodes(env) {
  let hashes;try{hashes=JSON.parse(env.CHAT_CODE_HASHES||'[]');}catch{hashes=[];}
  if(!Array.isArray(hashes)||hashes.length<1||hashes.length>60||hashes.some(hash=>typeof hash!=='string'||!HEX.test(hash)))return [];
  return hashes;
}
async function signer(env) {
  if(!HEX.test(env.CHAT_CODE_PEPPER||''))throw failure('Chat activation is not configured.',503);
  const key=await crypto.subtle.importKey('raw',Uint8Array.from(env.CHAT_CODE_PEPPER.match(/../g),part=>parseInt(part,16)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return async value=>Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(value))),byte=>byte.toString(16).padStart(2,'0')).join('');
}
export async function chatOwnerKey(env,ownerId) {
  if(typeof ownerId!=='string'||!ownerId||ownerId.length>200)throw failure('Invalid chat activation.');
  return (await signer(env))('owner:'+ownerId);
}
export async function chatCodeRequest(env,code,ownerId) {
  if(typeof code!=='string'||!/^\d{12}$/.test(code))throw failure('Enter a 12-digit chat code.');
  if(!configuredChatCodes(env).length)throw failure('Chat activation is not configured.',503);
  const [sign,ownerKey]=await Promise.all([signer(env),chatOwnerKey(env,ownerId)]);
  return {digest:await sign('code:'+code),ownerKey};
}
function same(left,right) {let difference=0;for(let i=0;i<64;i++)difference|=left.charCodeAt(i)^right.charCodeAt(i);return difference===0;}
// Call inside a storage transaction (or the local registry's exclusive queue).
export function redeemChatCode(env,store,request,now=Date.now()) {
  if(!request||!['digest','ownerKey'].every(key=>typeof request[key]==='string'&&HEX.test(request[key])))return {ok:false,status:400,message:'Invalid chat activation.'};
  const {digest,ownerKey}=request;
  if(store.account(ownerKey))return {ok:true};
  const hashes=configuredChatCodes(env);
  if(!hashes.length)return {ok:false,status:503,message:'Chat activation is not configured.'};
  store.prune(now-WINDOW);
  const previous=store.attempt(ownerKey);
  const attempt=previous&&now-previous.at<WINDOW?previous:{at:now,attempts:0};
  if(attempt.attempts>=5)return {ok:false,status:429,message:'Too many code attempts. Try again in 15 minutes.'};
  let valid=false;for(const hash of hashes)valid=same(hash,digest)||valid;
  const claimed=store.claim(digest);
  if(!valid||claimed!==undefined&&claimed!==ownerKey){
    store.saveAttempt(ownerKey,{at:attempt.at,attempts:attempt.attempts+1});
    return {ok:false,status:400,message:'This code is invalid or already used.'};
  }
  if(claimed===undefined)store.saveClaim(digest,ownerKey);
  store.saveAttempt(ownerKey,{at:now,attempts:0});
  return {ok:true};
}
export class MemoryChatCodes {
  constructor(saved={}){this.claims=new Map(saved.claims??[]);this.attempts=new Map(saved.attempts??[]);}
  prune(before){for(const [key,value]of this.attempts)if(value.at<before)this.attempts.delete(key);}
  attempt(key){return this.attempts.get(key);}
  saveAttempt(key,value){this.attempts.set(key,value);}
  claim(key){return this.claims.get(key);}
  account(key){return [...this.claims.values()].includes(key);}
  saveClaim(key,value){this.claims.set(key,value);}
  revoke(key){for(const [digest,owner]of this.claims)if(owner===key)this.claims.set(digest,'');this.attempts.delete(key);}
  serialize(){return {claims:[...this.claims],attempts:[...this.attempts]};}
}
