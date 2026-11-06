import type {Quiz, ChatMetadata, ChatMessage, Announcement, DataRecord} from '../../../shared/types.js';
import {announcementText,tickAnnouncement} from './countdown.js';
import {mentionedViewer,mentionText} from './mentions.js';
import {MentionComposer} from './mention-composer.js';
export const CHAT_OPTIONS=[['off','Off'],['lobby','Lobby only'],['breaks','Between questions & rounds'],['rounds','Lobby & round breaks']];
const EMOJI=['👍','❤️','😂','🎉','👏','😮'];
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export class RoomChat {
  declare messages: ChatMessage[];
  declare announcement: Announcement | null;
  declare revision: number;
  declare meta: ChatMetadata | null;
  declare open: boolean;
  declare draft: string;
  declare replyTo: string | null;
  declare emojiFor: string | null;
  declare menuFor: string | null;
  declare pending: Map<string, {type: string; timer: ReturnType<typeof setTimeout>; resolve: (value: DataRecord) => void; reject: (error: Error) => void}>;
  declare unread: number;
  declare sending: boolean;
  declare mentioned: Set<string>;
  declare connected: boolean;
  declare hadConversation: boolean;
  declare reconnectPending: boolean;
  declare identity: string;
  declare mentions: MentionComposer;
  declare hidden: boolean;
  declare viewport: () => void;
  declare keepKeyboard: (event: PointerEvent) => void;
  declare visible: () => void;
  declare pageLock: {y: number; position: string; top: string; width: string; overflow: string} | null;
  declare roomCount: number;
  declare dismissed: string | null;
  declare state: () => DataRecord;
  declare send: (message: DataRecord) => boolean;
  declare notify: (message: string, error?: boolean) => void;
  declare modal: (title: string, body: string, actions?: string) => void;
  declare closeModal: () => void;
  declare id: () => string;
  declare icon: (name: string, size?: number) => string;
  declare accessStatus: () => Promise<DataRecord>;

  constructor({state,send,notify,modal,closeModal,id,icon,accessStatus}) {
    Object.assign(this,{state,send,notify,modal,closeModal,id,icon,accessStatus});
    this.messages=[];this.announcement=null;this.revision=-1;this.meta=null;this.open=false;this.draft='';this.replyTo=null;this.emojiFor=null;this.menuFor=null;this.pending=new Map();this.unread=0;this.sending=false;this.mentioned=new Set();this.connected=false;this.hadConversation=false;this.reconnectPending=false;this.identity=this.actorId();this.mentions=new MentionComposer(this);
    try{this.hidden=localStorage.getItem('gather.chat.hidden')==='true';}catch{this.hidden=false;}
    this.viewport=()=>{const overlay=document.querySelector<HTMLElement>('.chat-overlay');if(overlay&&window.visualViewport){overlay.style.height=window.visualViewport.height+'px';overlay.style.top=window.visualViewport.offsetTop+'px';overlay.style.setProperty('--chat-visible-height',window.visualViewport.height+'px');}};
    this.keepKeyboard=event=>{if((event.target as HTMLElement).closest('#chat-form button[type="submit"],[data-action="chat-mention-select"],[data-action="chat-mention-retry"]')&&document.activeElement?.id==='chat-input')event.preventDefault();};
    window.visualViewport?.addEventListener('resize',this.viewport);
    window.visualViewport?.addEventListener('scroll',this.viewport);
    window.addEventListener('resize',this.viewport);
    document.addEventListener('pointerdown',this.keepKeyboard);
    this.visible=()=>{if(!document.hidden){if(this.open){this.mentioned.clear();this.unread=0;}this.tick(this.state().clock?.now()??Date.now());this.refresh();}};
    document.addEventListener('visibilitychange',this.visible);
  }
  destroy() {this.mentions.destroy();document.removeEventListener('visibilitychange',this.visible);this.close();document.querySelector<HTMLElement>('#room-chat-root')?.replaceChildren();window.visualViewport?.removeEventListener('resize',this.viewport);window.visualViewport?.removeEventListener('scroll',this.viewport);window.removeEventListener('resize',this.viewport);document.removeEventListener('pointerdown',this.keepKeyboard);for(const item of this.pending.values()){clearTimeout(item.timer);item.reject(new Error('Connection closed.'));}this.pending.clear();}
  lockPage(locked) {
    if(locked&&!this.pageLock){
      const style=document.body.style;this.pageLock={y:window.scrollY,position:style.position,top:style.top,width:style.width,overflow:style.overflow};
      Object.assign(style,{position:'fixed',top:-this.pageLock.y+'px',width:'100%',overflow:'hidden'});
    }else if(!locked&&this.pageLock){
      const {y,...style}=this.pageLock;this.pageLock=null;Object.assign(document.body.style,style);window.scrollTo(0,y);
    }
  }
  syncConnection() {
    const connected=this.state().connected===true;
    if(this.connected===connected)return;
    this.connected=connected;this.mentions.close();this.mentions.invalidate();
    if(!connected){
      this.reconnectPending=this.hadConversation;
      // Do not replay mutations: the server may have applied one before its acknowledgement was lost.
      for(const item of this.pending.values()){
        clearTimeout(item.timer);
        item.reject(new Error(item.type==='chat_send'?'Connection lost. Check chat before sending again.':'Connection changed. Please retry after reconnecting.'));
      }
      this.pending.clear();
    }else if(document.activeElement?.id==='chat-input')this.mentions.update(document.activeElement,true);
  }
  noteUnread(item) {
    if(!this.hidden&&(!this.open||document.hidden)&&item.senderId!==this.actorId()){
      this.unread=Math.min(99,this.unread+1);
      if(mentionedViewer(item,this.actorId()))this.mentioned.add(item.id);
    }
  }
  setState(room) {
    const actor=this.actorId();
    if(this.identity&&actor!==this.identity){
      this.messages=[];this.draft='';this.replyTo=null;this.unread=0;this.mentioned.clear();this.mentions.reset();this.mentions.invalidate();this.hadConversation=false;this.reconnectPending=false;
    }
    this.identity=actor;
    const changed=this.roomCount!==room?.participantCount||this.meta?.chatMentions!==room?.chat?.chatMentions;
    this.roomCount=room?.participantCount;
    this.meta=room?.chat??null;this.announcement=room?.announcement??null;
    if(['countdown','question','finished'].includes(room?.phase)&&document.querySelector<HTMLFormElement>('#announcement-form'))this.closeModal();
    if(room?.phase==='finished'){
      this.messages=[];this.announcement=null;this.draft='';this.replyTo=null;this.emojiFor=null;this.menuFor=null;this.unread=0;this.mentioned.clear();this.mentions.reset();this.mentions.invalidate();this.hadConversation=false;this.reconnectPending=false;
      if(document.querySelector<HTMLFormElement>('#chat-settings-form,#chat-unlock-form'))this.closeModal();
    }
    if(this.meta?.unlocked&&document.querySelector<HTMLFormElement>('#chat-unlock-form')){this.closeModal();this.settings();}
    if(!this.meta?.chatReplies)this.replyTo=null;if(!this.meta?.chatReactions)this.emojiFor=null;
    if(!this.available())this.close();
    if(changed)this.mentions.invalidate();
    if(!this.mentions.allowed())this.mentions.close();
  }
  available() {return !this.state().fatalRoomError&&!!this.meta?.open&&!['question','countdown','finished'].includes(this.state().roomState?.phase);}
  actorId() {return this.state().room?.role==='host'?'host':this.state().room?.playerId;}
  isHost() {return this.state().room?.role==='host';}
  request(type,body={}): Promise<DataRecord> {
    const requestId=this.id();
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{this.pending.delete(requestId);reject(new Error('No confirmation received. Please try again.'));},10000);
      this.pending.set(requestId,{resolve,reject,timer,type});
      if(!this.send({type,...body,requestId})){clearTimeout(timer);this.pending.delete(requestId);reject(new Error('Waiting for your connection to return.'));}
    });
  }
  receive(data) {
    if(data.type==='chat_ack'||data.scope==='conversation'){
      const item=this.pending.get(data.requestId);
      if(item){clearTimeout(item.timer);this.pending.delete(data.requestId);data.type==='chat_ack'?item.resolve(data):item.reject(new Error(data.message||'Please try again.'));}
      else if(data.type==='error')this.notify(data.message,true);
      return true;
    }
    if(data.type==='conversation'){
      const finished=this.state().roomState?.phase==='finished';
      const previous=new Set(this.messages.map(item=>item.id));
      const messages=finished||this.hidden?[]:data.state.messages;
      if(this.reconnectPending&&this.hadConversation)for(const item of messages)if(!previous.has(item.id))this.noteUnread(item);
      this.reconnectPending=false;this.hadConversation=!finished;
      this.revision=data.state.revision;this.messages=messages;this.announcement=finished?null:data.state.announcement;this.meta=data.state.meta;this.emojiFor=null;this.menuFor=null;
    }else if(['chat_message','chat_reaction','chat_deleted','chat_cleared','chat_settings','announcement'].includes(data.type)){
      if(this.state().roomState?.phase==='finished')return true;
      if(data.revision<=this.revision)return true;
      this.revision=data.revision;
      if(data.type==='chat_message'){
        if(!this.hidden&&!this.messages.some(item=>item.id===data.message.id)){
          this.messages.push(data.message);this.messages=this.messages.slice(-60);
          this.noteUnread(data.message);
        }
      }else if(data.type==='chat_reaction'){
        const item=this.messages.find(item=>item.id===data.messageId);if(item){item.reactions=data.reactions;if(data.actorId===this.actorId())item.myReaction=data.selected;}
      }else if(data.type==='chat_deleted'){
        const item=this.messages.find(item=>item.id===data.messageId);if(item)Object.assign(item,{deleted:true,text:'',mentions:[],replyTo:null,reactions:{},myReaction:null});
      }else if(data.type==='chat_cleared'){this.messages=[];this.replyTo=null;this.unread=0;this.mentioned.clear();}
      else if(data.type==='chat_settings'){this.meta=data.meta;this.mentions.invalidate();}
      else if(data.type==='announcement')this.announcement=data.announcement;
    }else return false;
    if(!this.meta?.chatReplies||this.replyTo&&!this.messages.some(item=>item.id===this.replyTo&&!item.deleted))this.replyTo=null;
    if(!this.meta?.chatReactions)this.emojiFor=null;
    for(const id of this.mentioned)if(!this.messages.some(item=>item.id===id&&mentionedViewer(item,this.actorId())))this.mentioned.delete(id);
    if(!this.mentions.allowed())this.mentions.close();
    if(!this.available())this.close();this.refresh();return true;
  }
  tools() {
    const phase=this.state().roomState?.phase;if(!this.meta||phase==='finished'||this.state().fatalRoomError)return '';
    const host=this.isHost(),available=this.available(),focus=['countdown','question'].includes(phase);
    return `${host?`<div class="room-host-tools"><button class="quiet-button" data-action="chat-settings">${this.icon('settings',16)} ${this.meta?.unlocked?'Chat settings':'Unlock chat'}</button><button class="quiet-button" data-action="announcement-compose" aria-label="Announcement" ${focus?'disabled':''}>${this.icon('announce',16)} Announce</button></div>`:''}${available?`<button class="quiet-button chat-launch" data-action="${this.hidden?'chat-show':'chat-toggle'}">${this.icon('chat',16)} ${this.hidden?'Show chat':'Chat'}${!this.hidden&&this.mentioned.size?`<span class="chat-mention-badge" aria-hidden="true">${this.mentioned.size}</span><span class="sr-only">${this.mentioned.size} unread mention${this.mentioned.size===1?'':'s'}</span>`:!this.hidden&&this.unread?`<span class="chat-unread">${this.unread}</span>`:''}</button>`:''}`;
  }
  applicationButton(className='quiet-button') {
    const state=this.state(),value=state.chatApplicationOwner===state.session?.user?.id?state.chatApplication:null;
    const pending=value?.status==='pending',waiting=value?.status==='declined'&&value.retryAt>Date.now();
    return `<button class="${className}" type="button" data-action="apply-chat" data-apply-chat ${pending||waiting?'disabled':''}>${pending?'Request pending':waiting?'Request declined':'Apply for chat access'}</button>`;
  }
  announcementView() {
    const item=this.announcement;if(!item||this.dismissed===item.id||['countdown','question','finished'].includes(this.state().roomState?.phase))return '';
    return `<aside class="room-announcement" role="status"><span class="announcement-icon">${this.icon('announce',18)}</span><div><span class="announcement-label">Host</span><p>${announcementText(item,this.state().clock?.now()??Date.now())}</p></div><button class="icon-btn" data-action="announcement-dismiss" aria-label="Dismiss announcement">${this.icon('close',15)}</button></aside>`;
  }
  tick(now) {tickAnnouncement(this.announcement,now);}
  messageView(item,index) {
    const parent=item.replyTo&&this.messages.find(value=>value.id===item.replyTo),own=item.senderId===this.actorId(),ping=mentionedViewer(item,this.actorId());
    const previous=this.messages[index-1],grouped=previous?.senderId===item.senderId&&item.at-previous.at<300000;
    const actions=!item.deleted&&(this.meta?.chatReplies||this.meta?.chatReactions||this.isHost());
    return `<article class="chat-message ${own?'own':''} ${grouped?'grouped':''} ${ping?'is-mentioned':''}" data-message-id="${esc(item.id)}">${!own&&!grouped?`<div class="chat-message-meta"><strong>${esc(item.senderName)}</strong>${item.role==='host'?`<span class="chat-host-label" aria-label="Verified host">${this.icon('check',12)}</span>`:''}</div>`:''}${actions?`<button class="chat-more" data-action="chat-menu" data-id="${esc(item.id)}" aria-label="Message actions" aria-expanded="${this.menuFor===item.id}">${this.icon('more',17)}</button>`:''}${item.replyTo?`<blockquote class="chat-quote">${parent&&!parent.deleted?`<strong>${esc(parent.senderName)}</strong><span>${esc(parent.text.slice(0,100))}</span>`:'Earlier message'}</blockquote>`:''}<p class="chat-text ${item.deleted?'muted':''}" dir="auto">${ping?'<span class="sr-only">You were mentioned. </span>':''}${item.deleted?'Message removed':mentionText(item,this.actorId())}</p><div class="chat-message-footer"><time datetime="${new Date(item.at).toISOString()}">${new Date(item.at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</time>${own?`<span aria-label="Sent">${this.icon('check',12)}</span>`:''}</div>${!item.deleted?`${Object.keys(item.reactions||{}).length?`<div class="chat-reactions">${Object.entries(item.reactions).map(([emoji,count])=>`<button data-action="chat-react" data-id="${esc(item.id)}" data-emoji="${esc(emoji)}" aria-pressed="${item.myReaction===emoji}" ${this.meta?.chatReactions?'':'disabled'}>${esc(emoji)} <span>${count}</span></button>`).join('')}</div>`:''}${this.menuFor===item.id?`<div class="chat-message-actions" role="group" aria-label="Message actions">${this.meta?.chatReplies?`<button type="button" class="chat-reply-button" data-action="chat-reply" data-id="${esc(item.id)}" aria-label="Reply to ${esc(item.senderName)}">${this.icon('reply',18)}<span>Reply</span></button>`:''}${this.meta?.chatReactions?`<button data-action="chat-emojis" data-id="${esc(item.id)}">${this.icon('smile',15)} React</button>`:''}${this.isHost()?`<button data-action="chat-delete" data-id="${esc(item.id)}">${this.icon('trash',14)} Remove</button>`:''}</div>`:''}${this.emojiFor===item.id?`<div class="chat-emoji-picker" role="group" aria-label="Choose reaction">${EMOJI.map(emoji=>`<button data-action="chat-react" data-id="${esc(item.id)}" data-emoji="${emoji}" aria-label="React ${emoji}">${emoji}</button>`).join('')}</div>`:''}`:''}</article>`;
  }
  panel() {
    if(!this.open||this.hidden||!this.available())return '';
    const parent=this.replyTo&&this.messages.find(item=>item.id===this.replyTo&&!item.deleted),count=this.state().roomState?.participantCount??0;
    return `<div class="chat-overlay"><div class="chat-backdrop" data-action="chat-close"></div><aside class="chat-panel" role="dialog" aria-modal="true" aria-labelledby="chat-title" tabindex="-1"><header class="chat-panel-head"><span class="chat-header-mark">${this.icon('chat',23)}</span><div class="chat-header-copy"><h2 id="chat-title">Room chat</h2><p>${count} player${count===1?'':'s'}</p></div><button class="icon-btn" data-action="chat-hide" aria-label="Hide chat" title="Hide chat">${this.icon('hide',17)}</button><button class="icon-btn" data-action="chat-close" aria-label="Close chat">${this.icon('close',18)}</button></header><div class="chat-messages" role="log" aria-label="Messages" aria-live="polite" aria-relevant="additions text">${this.messages.length?this.messages.map((item,index)=>this.messageView(item,index)).join(''):`<div class="chat-empty">${this.icon('chat',30)}<p>Say hello</p></div>`}</div><form id="chat-form" class="chat-composer"><div class="chat-mention-slot"></div><div class="chat-reply-slot">${parent?`<div class="chat-reply-preview"><div><strong>Reply to ${esc(parent.senderName)}</strong><span>${esc(parent.text.slice(0,80))}</span></div><button type="button" class="icon-btn" data-action="chat-cancel-reply" aria-label="Cancel reply">${this.icon('close',14)}</button></div>`:''}</div><div class="chat-compose-row"><label class="sr-only" for="chat-input">Message</label><textarea id="chat-input" placeholder="Message" maxlength="400" rows="1" required enterkeyhint="send">${esc(this.draft)}</textarea><button class="btn primary" type="submit" aria-label="Send message" ${this.sending||!this.state().connected?'disabled':''}>${this.icon('send',19)}</button></div></form></aside></div>`;
  }
  refresh() {
    this.syncConnection();
    if(this.open&&!this.available())this.close();
    const tools=document.querySelector<HTMLElement>('#room-tools');if(tools){tools.innerHTML=this.tools();tools.hidden=!tools.innerHTML;}
    const announcement=document.querySelector<HTMLElement>('#room-announcement');if(announcement){const markup=this.announcementView();if(announcement.innerHTML!==markup)announcement.innerHTML=markup;}
    const root=document.querySelector<HTMLElement>('#room-chat-root');if(!root)return;
    const list=document.querySelector<HTMLElement>('.chat-messages'),scroll=list?.scrollTop??0,atBottom=!list||list.scrollHeight-list.clientHeight-list.scrollTop<70;
    const markup=this.panel();this.lockPage(!!markup);
    if(!markup){root.replaceChildren();this.mentions.close();return;}
    // Keep the focused textarea mounted: replacing it dismisses iOS keyboards
    // and interrupts composition, even when focus is immediately restored.
    if(!root.firstElementChild)root.innerHTML=markup;
    else {
      const template=document.createElement('template');template.innerHTML=markup;
      for(const selector of ['.chat-header-copy p','.chat-messages','.chat-reply-slot']){
        const current=root.querySelector(selector),next=template.content.querySelector(selector);
        if(current&&next&&current.innerHTML!==next.innerHTML)current.innerHTML=next.innerHTML;
      }
    }
    this.viewport();this.mentions.render();
    const next=document.querySelector<HTMLElement>('.chat-messages');if(next)next.scrollTop=atBottom?next.scrollHeight:scroll;
    const compose=document.querySelector<HTMLTextAreaElement>('#chat-input');if(compose){if(compose.value!==this.draft)compose.value=this.draft;compose.style.height='auto';compose.style.height=Math.min(140,compose.scrollHeight)+'px';}
    const send=root.querySelector<HTMLButtonElement>('button[type="submit"]');if(send){send.disabled=this.sending||!this.state().connected;send.setAttribute('aria-busy',String(this.sending));}
  }
  close() {if(document.activeElement?.closest('.chat-panel'))(document.activeElement as HTMLElement).blur();this.open=false;this.emojiFor=null;this.menuFor=null;this.mentions.close();this.lockPage(false);}
  settings() {
    if(this.state().roomState?.phase==='finished')return;
    const config: Partial<ChatMetadata>=this.meta??{};
    if(!config.unlocked){
      if(['countdown','question'].includes(this.state().roomState?.phase)){this.modal('Chat is locked','<p>Enter your invitation code before the quiz or between questions.</p>');return;}
      this.modal('Unlock chat',`<form id="chat-unlock-form"><p>One invitation code enables chat for your account and future quizzes.</p><div class="field"><label for="chat-unlock-code">12-digit code</label><input id="chat-unlock-code" type="password" inputmode="numeric" pattern="[0-9]{12}" minlength="12" maxlength="12" autocomplete="off" required placeholder="••••••••••••"></div><div class="chat-access-actions"><button class="btn primary" type="submit">${this.icon('lock',16)} Unlock chat</button>${this.applicationButton('btn ghost')}</div><p class="small muted" data-chat-application-note hidden></p></form>`);void this.accessStatus?.().catch(()=>{});return;
    }
    this.modal('Chat settings',`<form id="chat-settings-form"><div class="field"><label for="live-chat-mode">When chat opens</label><select id="live-chat-mode">${CHAT_OPTIONS.map(([value,label])=>`<option value="${value}" ${config.chatMode===value?'selected':''}>${label}</option>`).join('')}</select><span class="hint">Always closed during countdowns and questions.</span></div><label class="checkbox-row"><input type="checkbox" id="live-chat-replies" ${config.chatReplies?'checked':''}>Replies</label><label class="checkbox-row"><input type="checkbox" id="live-chat-reactions" ${config.chatReactions?'checked':''}>Emoji reactions</label><label class="checkbox-row"><input type="checkbox" id="live-chat-mentions" ${config.chatMentions?'checked':''}>Participant mentions</label><button class="btn primary full" type="submit">Save</button></form>`,this.messages.length?'<button class="quiet-button" data-action="chat-clear">Clear messages</button>':'');
  }
  composeAnnouncement() {
    this.modal('Announcement',`<form id="announcement-form"><div class="field"><label class="sr-only" for="announcement-text">Announcement</label><textarea id="announcement-text" maxlength="240" placeholder="Quiz starting in {20} minutes" required>${esc(this.announcement?.text||'')}</textarea><span class="hint">Use {time}. Example: Quiz starting in {20} minutes · 1–60 mins</span></div><div id="form-error" role="alert"></div><button class="btn primary full" type="submit">Send to everyone</button></form>`,this.announcement?'<button class="quiet-button" data-action="announcement-clear">Remove announcement</button>':'');
  }
  handleAction(action,element) {
    if(action==='chat-mention-select'){this.mentions.choose(element.dataset.id);return true;}
    if(action==='chat-mention-retry'){const input=document.querySelector<HTMLTextAreaElement>('#chat-input');input?.focus({preventScroll:true});this.mentions.update(input,true);return true;}
    if(!/^(?:chat-|announcement-)/.test(action))return false;
    const run=(type,body)=>this.request(type,body).catch(error=>this.notify(error.message,true));
    if(action==='chat-toggle'){this.open=!this.open;this.unread=0;this.mentioned.clear();this.mentions.close();this.mentions.invalidate();}
    else if(action==='chat-close')this.close();
    else if(action==='chat-hide'||action==='chat-show'){
      this.hidden=action==='chat-hide';this.open=!this.hidden;this.unread=0;this.messages=[];this.mentioned.clear();this.mentions.close();
      try{localStorage.setItem('gather.chat.hidden',String(this.hidden));}catch{}
      this.send({type:'chat_subscribe',enabled:!this.hidden});
    }else if(action==='chat-menu'){this.menuFor=this.menuFor===element.dataset.id?null:element.dataset.id;this.emojiFor=null;}
    else if(action==='chat-reply'){this.replyTo=element.dataset.id;this.emojiFor=null;this.menuFor=null;}
    else if(action==='chat-cancel-reply')this.replyTo=null;
    else if(action==='chat-emojis'){this.emojiFor=this.emojiFor===element.dataset.id?null:element.dataset.id;this.menuFor=null;}
    else if(action==='chat-react'){void run('chat_react',{messageId:element.dataset.id,emoji:element.dataset.emoji});this.emojiFor=null;this.menuFor=null;}
    else if(action==='chat-delete'){void run('chat_delete',{messageId:element.dataset.id});this.menuFor=null;}
    else if(action==='chat-clear')void this.request('chat_clear').then(()=>this.closeModal()).catch(error=>this.notify(error.message,true));
    else if(action==='chat-settings'){this.close();this.settings();}
    else if(action==='announcement-compose'){this.close();this.composeAnnouncement();}
    else if(action==='announcement-dismiss')this.dismissed=this.announcement?.id;
    else if(action==='announcement-clear')void this.request('announce',{text:''}).then(()=>this.closeModal()).catch(error=>this.notify(error.message,true));
    this.refresh();
    if(action==='chat-reply')document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus({preventScroll:true});
    else if(['chat-toggle','chat-show'].includes(action))document.querySelector<HTMLElement>('.chat-panel')?.focus({preventScroll:true});
    return true;
  }
  async submit(form) {
    if(form.id==='chat-form'){
      if(this.sending||!this.state().connected||!this.draft.trim())return;
      const text=this.draft,replyTo=this.replyTo,payload=this.mentions.payload();this.sending=true;this.mentions.close();this.refresh();
      try{await this.request('chat_send',{...payload,replyTo});if(this.draft===text){this.draft='';this.mentions.reset();}if(this.replyTo===replyTo)this.replyTo=null;}
      finally{this.sending=false;this.refresh();document.querySelector<HTMLTextAreaElement>('#chat-input')?.focus({preventScroll:true});}
    }else if(form.id==='chat-unlock-form'){
      await this.request('chat_unlock',{code:document.querySelector<HTMLInputElement>('#chat-unlock-code').value});this.closeModal();this.settings();
    }else if(form.id==='announcement-form'){
      await this.request('announce',{text:document.querySelector<HTMLTextAreaElement>('#announcement-text').value});this.closeModal();
    }else if(form.id==='chat-settings-form'){
      await this.request('chat_settings',{settings:{chatMode:document.querySelector<HTMLSelectElement>('#live-chat-mode').value,chatReplies:document.querySelector<HTMLInputElement>('#live-chat-replies').checked,chatReactions:document.querySelector<HTMLInputElement>('#live-chat-reactions').checked,chatMentions:document.querySelector<HTMLInputElement>('#live-chat-mentions').checked}});this.closeModal();
    }
  }
}
