// Room-only text conversation. Never part of quiz scoring or saved reports.
export const CONVERSATION_COMMANDS = new Set(['chat_send','chat_react','chat_delete','chat_clear','chat_settings','chat_unlock','announce']);
export const CHAT_MODES = new Set(['off','lobby','breaks','rounds']);
export const REACTIONS = ['👍','❤️','😂','🎉','👏','😮'];
const fail = (message) => { const error = new Error(message); error.name = 'EngineError'; throw error; };
const copy = value => JSON.parse(JSON.stringify(value));
const text = (value, max) => {
  if(typeof value!=='string'||value.length>max||!value.trim()||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value))fail(`Use 1–${max} characters.`);
  return value.trim();
};
export function chatSettings(raw = {}) {
  const chatMode=raw.chatMode??'off';
  if(!CHAT_MODES.has(chatMode))fail('Choose a valid chat setting.');
  for(const key of ['chatReplies','chatReactions'])if(raw[key]!=null&&typeof raw[key]!=='boolean')fail('Chat options must be true or false.');
  return {chatMode,chatReplies:raw.chatReplies??true,chatReactions:raw.chatReactions??true};
}
export class RoomConversation {
  constructor(settings = {}, saved = null, {unlocked=false}={}) {
    this.unlocked=unlocked===true;
    this.config=chatSettings(saved?.config??settings);
    this.messages=copy(saved?.messages??[]).slice(-60);
    this.announcement=copy(saved?.announcement??null);
    this.revision=saved?.revision??0;
    this.rates=new Map();this.roomRate={at:0,count:0};
  }
  serialize() { return copy({config:this.config,messages:this.messages,announcement:this.announcement,revision:this.revision}); }
  end() {this.messages=[];this.announcement=null;this.rates.clear();this.roomRate={at:0,count:0};this.revision++;}
  visibleAnnouncement(phase) {return ['countdown','question','finished'].includes(phase)?null:copy(this.announcement);}
  metadata(phase) {
    const mode=this.config.chatMode;
    const open=this.unlocked&&mode!=='off'&&!['countdown','question','finished'].includes(phase)&&(phase==='lobby'||mode==='breaks'||mode==='rounds'&&phase==='round_results');
    return {...this.config,unlocked:this.unlocked,open,revision:this.revision};
  }
  actor(identity, players) {
    if(identity.role==='host')return {id:'host',name:'Host',role:'host'};
    const player=identity.role==='player'&&players.get(identity.playerId);
    if(!player)fail('Join the room before chatting.');
    return {id:player.id,name:player.name,role:'player'};
  }
  publicMessage(message, actorId) {
    const {requestId,reactions,...result}=message;
    return {...copy(result),reactions:this.counts(message),myReaction:reactions[actorId]??null};
  }
  counts(message) {
    const counts={};for(const emoji of Object.values(message.reactions))counts[emoji]=(counts[emoji]??0)+1;return counts;
  }
  snapshot(identity, phase) {
    const actorId=identity.role==='host'?'host':identity.playerId;
    return {revision:this.revision,meta:this.metadata(phase),announcement:this.visibleAnnouncement(phase),messages:identity.chatSubscribed===false||!this.unlocked||phase==='finished'?[]:this.messages.map(message=>this.publicMessage(message,actorId))};
  }
  rate(actor, kind, now) {
    const key=actor.id+':'+kind,entry=this.rates.get(key)??{at:now,count:0,last:-Infinity};
    const window=kind==='chat_send'?60000:10000,limit=kind==='chat_send'?15:16;
    if(now-entry.at>=window){entry.at=now;entry.count=0;}
    if(now-entry.last<(kind==='chat_send'?700:200)||entry.count>=limit)fail('Please wait a moment before sending again.');
    if(now-this.roomRate.at>=1000)this.roomRate={at:now,count:0};
    if(this.roomRate.count>=25)fail('Chat is busy. Try again in a moment.');
    entry.last=now;entry.count++;this.rates.set(key,entry);this.roomRate.count++;
  }
  command(identity, message, {phase,players,now}) {
    const actor=this.actor(identity,players),host=actor.role==='host';
    const requestId=typeof message.requestId==='string'&&/^[a-zA-Z0-9-]{1,80}$/.test(message.requestId)?message.requestId:null;
    if(!requestId)fail('A message reference is required.');
    if(phase==='finished')fail('This quiz has ended. Chat has been cleared.');
    let event;
    if(['chat_send','chat_react'].includes(message.type)&&!this.metadata(phase).open)fail('Chat is closed for this part of the quiz.');
    if(message.type==='chat_send'){
      const duplicate=this.messages.find(item=>item.senderId===actor.id&&item.requestId===requestId);
      if(duplicate)return {channel:'conversation',type:'chat_ack',requestId,messageId:duplicate.id};
      const body=text(message.text,400);
      let replyTo=null;
      if(message.replyTo!=null){
        if(!this.config.chatReplies)fail('Replies are turned off.');
        const parent=this.messages.find(item=>item.id===message.replyTo&&!item.deleted);
        if(!parent)fail('That message is no longer available.');
        replyTo=parent.id;
      }
      this.rate(actor,message.type,now);
      const item={id:crypto.randomUUID(),senderId:actor.id,senderName:actor.name,role:actor.role,text:body,replyTo,at:now,requestId,reactions:{}};
      this.messages.push(item);if(this.messages.length>60)this.messages.shift();
      event={type:'chat_message',message:this.publicMessage(item,null)};
    }else if(message.type==='chat_react'){
      if(!this.config.chatReactions||!REACTIONS.includes(message.emoji))fail('Choose an available reaction.');
      const item=this.messages.find(item=>item.id===message.messageId&&!item.deleted);
      if(!item)fail('That message is no longer available.');
      this.rate(actor,message.type,now);
      if(item.reactions[actor.id]===message.emoji)delete item.reactions[actor.id];
      else{
        if(!Object.hasOwn(item.reactions,actor.id)&&Object.keys(item.reactions).length>=1000)fail('This message has reached its reaction limit.');
        item.reactions[actor.id]=message.emoji;
      }
      event={type:'chat_reaction',messageId:item.id,actorId:actor.id,selected:item.reactions[actor.id]??null,reactions:this.counts(item)};
    }else{
      if(!host)fail('Only the host can do that.');
      if(message.type==='announce'){
        if(['countdown','question'].includes(phase))fail('Send announcements between questions.');
        const body=message.text===''?'':text(message.text,240);
        this.rate(actor,'announce',now);
        this.announcement=body?{id:crypto.randomUUID(),text:body,at:now}:null;
        event={type:'announcement',announcement:copy(this.announcement)};
      }else if(message.type==='chat_settings'){
        const config=chatSettings(message.settings);
        if(!this.unlocked&&config.chatMode!=='off')fail('Unlock chat for your account with a 12-digit code.');
        this.config=config;
        event={type:'chat_settings',meta:this.metadata(phase)};
      }else if(message.type==='chat_delete'){
        const item=this.messages.find(item=>item.id===message.messageId);
        if(!item)fail('That message is no longer available.');
        Object.assign(item,{text:'',replyTo:null,reactions:{},deleted:true});
        event={type:'chat_deleted',messageId:item.id};
      }else if(message.type==='chat_clear'){
        this.messages=[];event={type:'chat_cleared'};
      }else fail('Chat command is unsupported.');
    }
    this.revision++;
    return {channel:'conversation',type:'chat_ack',requestId,event:{...event,revision:this.revision}};
  }
}
