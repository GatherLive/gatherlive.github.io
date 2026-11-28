import type {RoomIdentity, DataRecord} from '../types.js';
import {authenticate, HttpError} from '../http/api.js';
export const MAX_MESSAGE_BYTES=16_384;
export function decodeMessage(raw) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_MESSAGE_BYTES) throw new HttpError(400,'Message is too large.');
  let message;
  try { message=JSON.parse(raw); } catch { throw new HttpError(400,'Invalid message.'); }
  if (!message || typeof message !== 'object' || Array.isArray(message) || typeof message.type !== 'string') throw new HttpError(400,'Invalid message.');
  return message;
}
export async function authorize(engine,meta,env,message,verification?: {check?: () => Promise<boolean> | boolean; failed?: () => Promise<unknown> | unknown; active?: () => boolean}): Promise<{identity: RoomIdentity; welcome: DataRecord; chatUnlocked?: boolean; freshPlayer?: boolean}> {
  if (message.type !== 'auth') throw new HttpError(401,'Join the room first.');
  const conversation=message.conversationVersion===1?{conversationVersion:1,chatSubscribed:message.chatSubscribed!==false}:{};
  if (message.role === 'host') {
    if (typeof message.token !== 'string' || message.token.length > 8192) throw new HttpError(401,'Please sign in.');
    const user=await authenticate(env,message.token);
    if (user.id !== meta.ownerId) throw new HttpError(403,'Only the host can control this quiz.');
    return {identity:{role:'host',userId:user.id,...conversation,...([1,2].includes(message.mediaVersion)?{mediaVersion:message.mediaVersion}:{})},welcome:{type:'welcome',role:'host',...([1,2].includes(message.mediaVersion)?{imageManifest:engine.imageManifest()}:{})}};
  }
  if(message.contact_url_confirm!=null&&message.contact_url_confirm!=='')throw new HttpError(400,'This room is not available. Please try again.');
  if (message.role !== 'player') throw new HttpError(400,'Choose host or player.');
  if (engine.isSelfStudy) throw new HttpError(404,'Room is not available.');
  const freshPlayer=message.playerId == null && message.resumeToken == null;
  if (freshPlayer) {
    if (engine.settings.joinVerification && message.verificationCode && verification?.check && !await verification.check()) throw new HttpError(429, 'Too many verification attempts. Wait a minute and retry.');
    try {await engine.verifyJoin(message.verificationCode);}
    catch (error) {if (error.code === 'JOIN_VERIFICATION_FAILED') await verification?.failed?.();throw error;}
  }
  if(verification?.active&&!verification.active())throw new HttpError(408,'Join timed out. Please retry.');
  const result=engine.addPlayer(message.name,message.playerId,message.resumeToken,message.team,message.avatar);
  engine.registerMedia(result.playerId,message.mediaVersion);
  return {identity:{role:'player',playerId:result.playerId,...conversation,...([1,2].includes(message.mediaVersion)?{mediaVersion:message.mediaVersion}:{})},welcome:{type:'welcome',role:'player',...result,...([1,2].includes(message.mediaVersion)?{imageManifest:engine.imageManifest()}:{})},freshPlayer};
}
export function safeError(error, command?: DataRecord) {
  const scope=command?.type==='autoplay'?'autoplay':command?.type==='room_mode'?'room-mode':command?.type==='room_player_results'?'room-player-results':null;
  const reference=scope&&typeof command.requestId==='string'&&command.requestId.length<=80;
  return {type:'error',...(error.name === 'EngineError' ? {code: error.code} : {}),message:error.status || error.name === 'EngineError' ? error.message : 'The room could not complete that action. Please retry.',...(reference?{scope,requestId:command.requestId}:{})};
}
/** Share expensive public state construction, keeping each participant's answer separate. */
export function snapshotBatch(engine, encoded = false) {
  const cache = new Map<string, DataRecord>();
  const messages = new Map<string,string>();
  return (identity: RoomIdentity) => {
    const key = `${identity.role === 'host'}:${identity.mediaVersion || 0}:${identity.conversationVersion === 1}`;
    let common = cache.get(key);
    if (!common) {common = engine.snapshot(identity.role === 'host', null, {media: identity.mediaVersion || false, conversation: identity.conversationVersion === 1});common.role=identity.role==='host'?'host':'player';cache.set(key, common);}
    const me = engine._me(engine.playerIdFor(identity));
    if(encoded){
      let text=messages.get(key);if(!text){text=JSON.stringify({type:'state',state:common});messages.set(key,text);}
      return me?text.slice(0,-2)+',"me":'+JSON.stringify(me)+'}}':text;
    }
    return {...common, role: identity.role === 'host' ? 'host' : 'player', ...(me ? {me} : {})};
  };
}
export function allowMessage(identity,now=Date.now(),type='') {
  if(type==='avatar_update'){
    if(now-(identity.avatarUpdatedAt??-Infinity)<1200)return false;
    identity.avatarUpdatedAt=now;return true;
  }
  // Chat spam must not consume a participant's answer allowance.
  const typing=type==='chat_typing',social=/^(?:chat_|announce$)/.test(type);
  const windowKey=typing?'typingWindowStart':social?'chatWindowStart':'windowStart';
  const countKey=typing?'typingMessages':social?'chatMessages':'messages';
  const windowStart=identity[windowKey] ?? now;
  if (now-windowStart >= 1000) {identity[windowKey]=now;identity[countKey]=1;return true;}
  identity[windowKey]=windowStart;identity[countKey]=(identity[countKey] || 0)+1;
  return identity[countKey] <= (typing ? 8 : identity.role === 'host' ? 25 : social?5:8);
}
export function repeatedFlood(identity,now=Date.now()) {
  if(now-(identity.rateErrorAt||0)>=1000){identity.rateErrorAt=now;identity.rateErrors=0;}
  return (identity.rateErrors=(identity.rateErrors||0)+1)>=3;
}
