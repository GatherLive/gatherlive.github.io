import {authenticate, HttpError} from './api.js';
export const MAX_MESSAGE_BYTES=16_384;
export function decodeMessage(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) throw new HttpError(400,'Message is too large.');
  let message;
  try { message=JSON.parse(raw); } catch { throw new HttpError(400,'Invalid message.'); }
  if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') throw new HttpError(400,'Invalid message.');
  return message;
}
export async function authorize(engine,meta,env,message) {
  if (message.type !== 'auth') throw new HttpError(401,'Join the room first.');
  const conversation=message.conversationVersion===1?{conversationVersion:1,chatSubscribed:message.chatSubscribed!==false}:{};
  if (message.role === 'host') {
    if (typeof message.token !== 'string' || message.token.length > 8192) throw new HttpError(401,'Please sign in.');
    const user=await authenticate(env,message.token);
    if (user.id !== meta.ownerId) throw new HttpError(403,'Only the host can control this quiz.');
    return {identity:{role:'host',userId:user.id,...conversation,...(message.mediaVersion===1?{mediaVersion:1}:{})},welcome:{type:'welcome',role:'host',...(message.mediaVersion===1?{imageManifest:engine.imageManifest()}:{})}};
  }
  if (message.role !== 'player') throw new HttpError(400,'Choose host or player.');
  const result=engine.addPlayer(message.name,message.playerId,message.resumeToken);
  return {identity:{role:'player',playerId:result.playerId,...conversation,...(message.mediaVersion===1?{mediaVersion:1}:{})},welcome:{type:'welcome',role:'player',...result,...(message.mediaVersion===1?{imageManifest:engine.imageManifest()}:{})}};
}
export function safeError(error) {
  return {type:'error',message:error.status || error.name === 'EngineError' ? error.message : 'The room could not complete that action. Please retry.'};
}
export function allowMessage(identity,now=Date.now(),type='') {
  // Chat spam must not consume a participant's answer allowance.
  const social=/^(?:chat_|announce$)/.test(type),windowKey=social?'chatWindowStart':'windowStart',countKey=social?'chatMessages':'messages';
  const windowStart=identity[windowKey] ?? now;
  if (now-windowStart >= 1000) {identity[windowKey]=now;identity[countKey]=1;return true;}
  identity[windowKey]=windowStart;identity[countKey]=(identity[countKey] || 0)+1;
  return identity[countKey] <= (identity.role === 'host' ? 25 : social?5:8);
}
