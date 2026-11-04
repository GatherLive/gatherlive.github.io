// One public announcement. Dismissal is local to this browser and this publication.
export class SiteNews {
  constructor(apiURL){
    this.preview=this.readPreview();
    this.apiURL=apiURL;this.revision=-1;this.announcement=null;this.dismissed=null;this.socket=null;this.retry=0;
    try{this.dismissed=localStorage.getItem('gather.news.dismissed');}catch{}
    window.addEventListener('storage',event=>{if(event.key==='gather.news.dismissed'){this.dismissed=event.newValue;this.render();}});
    window.addEventListener('online',()=>this.connect());
    document.addEventListener('visibilitychange',()=>{if(!document.hidden){this.render();this.connect();void this.refresh();}});
    window.addEventListener('pageshow',()=>{this.render();this.connect();});
  }
  readPreview(){
    try{
      const raw=new URLSearchParams(location.hash.split('?')[1]||'').get('news-preview');if(!raw||raw.length>8192)return null;
      const value=JSON.parse(raw),url=new URL(value.url);
      if(typeof value.badge!=='string'||!value.badge.trim()||value.badge.length>24||typeof value.headline!=='string'||!value.headline.trim()||value.headline.length>200||!['http:','https:'].includes(url.protocol)||url.username||url.password||value.expiresAt!==null&&(!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=Date.now()))return null;
      return {...value,url:url.href,id:'preview'};
    }catch{return null;}
  }
  slot(){return '<aside class="site-news" data-site-news aria-label="Site news" hidden></aside>';}
  start(){this.started=true;this.connect();void this.refresh();}
  async refresh(){
    if(!this.started||document.hidden)return;
    try{const response=await fetch(this.apiURL('/api/site/announcement'),{cache:'no-store',signal:AbortSignal.timeout(10000)});if(response.ok)this.update(await response.json());}catch{}
  }
  update(value){
    if(!Number.isSafeInteger(value?.revision)||value.revision<this.revision)return;
    const item=value.announcement;
    if(item!==null&&(!item||typeof item.id!=='string'||typeof item.badge!=='string'||typeof item.headline!=='string'||typeof item.url!=='string'))return;
    if(item){try{const url=new URL(item.url);if(!['https:','http:'].includes(url.protocol)||url.username||url.password)return;}catch{return;}}
    this.revision=value.revision;this.announcement=item;clearTimeout(this.expiry);
    this.render();
  }
  render(){
    const root=document.querySelector('[data-site-news]');if(!root)return;
    clearTimeout(this.expiry);
    const item=this.preview||this.announcement,visible=!!item&&(!!this.preview||this.dismissed!==item.id)&&(!item.expiresAt||item.expiresAt>Date.now());
    if(visible&&item.expiresAt)this.expiry=setTimeout(()=>this.render(),Math.max(1,Math.min(2147483647,item.expiresAt-Date.now())));
    root.hidden=!visible;document.documentElement.style.setProperty('--site-announcement-height',visible?'44px':'0px');
    root.replaceChildren();if(!visible)return;
    const inner=document.createElement('div');inner.className='site-news-inner';
    const link=document.createElement('a');link.className='site-news-link';link.href=item.url;link.title=item.headline;
    const badge=document.createElement('span');badge.className='site-news-badge';badge.textContent=(this.preview?'Preview · ':'')+item.badge;
    const text=document.createElement('span');text.className='site-news-headline';text.textContent=item.headline;
    link.append(badge,text);
    const close=document.createElement('button');close.className='site-news-close';close.type='button';close.setAttribute('aria-label','Dismiss announcement');close.textContent='×';
    close.onclick=()=>{if(this.preview){this.preview=null;const [path,query='']=location.hash.split('?'),params=new URLSearchParams(query);params.delete('news-preview');history.replaceState(null,'',location.pathname+location.search+(path||'#')+(params.size?'?'+params.toString():''));this.render();return;}this.dismissed=item.id;try{localStorage.setItem('gather.news.dismissed',item.id);}catch{}this.render();};
    inner.append(link,close);root.append(inner);
  }
  connect(){
    if(!this.started||!navigator.onLine||this.socket&&this.socket.readyState<2)return;
    clearTimeout(this.reconnect);let socket;
    try{const url=new URL(this.apiURL('/api/site/updates'),location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';socket=new WebSocket(url);this.socket=socket;}catch{return;}
    socket.onopen=()=>{
      this.retry=0;this.lastMessage=Date.now();clearInterval(this.heartbeat);
      this.heartbeat=setInterval(()=>{if(this.socket!==socket)return;if(Date.now()-this.lastMessage>65000){socket.close();return;}if(socket.readyState===1)socket.send('ping');},25000);
    };
    socket.onmessage=event=>{if(this.socket!==socket)return;this.lastMessage=Date.now();if(event.data==='pong')return;try{this.update(JSON.parse(event.data));}catch{}};
    socket.onerror=()=>socket.close();
    socket.onclose=()=>{
      if(this.socket!==socket)return;this.socket=null;clearInterval(this.heartbeat);void this.refresh();
      this.reconnect=setTimeout(()=>this.connect(),Math.min(30000,1000*2**Math.min(this.retry++,5))+Math.random()*500);
    };
  }
}
