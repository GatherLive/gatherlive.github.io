// Each browser profile owns a counter ledger. Max-merge makes retries idempotent.
export const PROGRESS_VERSION=1;
export const TOPICS=['flags','capitals','map'];
const DAY=86400000,MAX_COUNT=1_000_000;
const REGIONS=['World','Africa','Americas','Asia','Europe','Oceania'];
const itemKey=/^(flags|capitals|map):[a-z]{2}$/;
const uuidPattern=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const integer=(value,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(value)&&value>=0?Math.min(value,max):0;
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const uuid=()=>crypto.randomUUID?.()||'10000000-1000-4000-8000-100000000000'.replace(/[018]/g,c=>(Number(c)^crypto.getRandomValues(new Uint8Array(1))[0]&15>>Number(c)/4).toString(16));
export function emptyProgress(generation=0){return project({version:1,generation,updatedAt:0,devices:{},tests:[]});}
function project(progress,writer){
  const items={};
  for(const device of Object.values(progress.devices))for(const [key,t] of Object.entries(device.items)){
    const item=items[key]||={seen:0,correct:0,wrong:0,lastCorrect:0,lastWrong:0,updatedAt:0};
    item.seen+=t[1];item.correct+=t[2];item.wrong+=t[1]-t[2];item.updatedAt=Math.max(item.updatedAt,t[3]);item.lastCorrect=Math.max(item.lastCorrect,t[4]);item.lastWrong=Math.max(item.lastWrong,t[5]);
  }
  for(const item of Object.values(items)){
    item.streak=item.lastCorrect>item.lastWrong?Math.min(item.correct,5):0;
    item.nextReviewAt=item.lastWrong>=item.lastCorrect?item.lastWrong:item.lastCorrect+[1,3,7,14,30][Math.min(4,Math.max(0,item.correct-1))]*DAY;
  }
  Object.defineProperty(progress,'items',{value:items,writable:true,configurable:true,enumerable:false});
  Object.defineProperty(progress,'_writer',{value:writer||progress._writer||'',writable:true,configurable:true,enumerable:false});
  return progress;
}
export function normalizeProgress(input){
  const out={version:1,generation:integer(input?.generation),updatedAt:integer(input?.updatedAt,Date.now()+300000),devices:{},tests:[]};
  if(!object(input))return project(out);
  if(object(input.devices))for(const [id,device] of Object.entries(input.devices).slice(0,32)){
    if(!uuidPattern.test(id)||!object(device?.items))continue;
    const items={};
    for(const [key,t] of Object.entries(device.items).slice(0,750)){
      if(!itemKey.test(key)||!Array.isArray(t)||t.length!==6)continue;
      const tuple=t.map((v,i)=>integer(v,i<3?MAX_COUNT:Date.now()+300000));
      tuple[1]=Math.min(tuple[0],tuple[1]);tuple[2]=Math.min(tuple[1],tuple[2]);items[key]=tuple;
    }
    out.devices[id]={items};
  }
  const tests=new Map();
  for(const test of Array.isArray(input.tests)?input.tests:[]){
    if(!object(test)||typeof test.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(test.id)||![...TOPICS,'review'].includes(test.topic))continue;
    const total=integer(test.total,750);if(!total)continue;
    tests.set(test.id,{id:test.id,topic:test.topic,region:REGIONS.includes(test.region)?test.region:'World',total,correct:integer(test.correct,total),at:integer(test.at,Date.now()+300000)});
  }
  out.tests=[...tests.values()].sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id)).slice(-20);
  return project(out,input._writer);
}
export function mergeProgress(first,second){
  const a=normalizeProgress(first),b=normalizeProgress(second);
  if(a.generation!==b.generation)return a.generation>b.generation?a:b;
  for(const [id,device] of Object.entries(b.devices)){
    a.devices[id]||={items:{}};
    for(const [key,t] of Object.entries(device.items)){
      const old=a.devices[id].items[key];a.devices[id].items[key]=old?t.map((v,i)=>Math.max(v,old[i])):t.slice();
    }
  }
  a.updatedAt=Math.max(a.updatedAt,b.updatedAt);a.tests=[...a.tests,...b.tests];
  return normalizeProgress(a);
}
export function recordAnswer(progress,topic,code,correct,now=Date.now()){
  const key=`${topic}:${code}`;if(!itemKey.test(key))return progress;
  const writer=progress._writer||uuid();progress._writer=writer;progress.devices[writer]||={items:{}};
  const t=progress.devices[writer].items[key]||=[0,0,0,0,0,0];
  t[0]=Math.min(MAX_COUNT,t[0]+1);t[1]=Math.min(MAX_COUNT,t[1]+1);if(correct)t[2]=Math.min(MAX_COUNT,t[2]+1);
  // Keep ordering deterministic even if two attempts share a millisecond.
  const stamp=Math.max(now,t[3]+1);t[3]=stamp;t[correct?4:5]=stamp;progress.updatedAt=stamp;
  return project(progress,writer);
}
export function progressStats(progress,now=Date.now()){
  const values=Object.values(progress.items),answers=values.reduce((sum,item)=>sum+item.seen,0),correct=values.reduce((sum,item)=>sum+item.correct,0);
  return {practised:values.length,learned:values.filter(item=>item.streak>=2).length,answers,correct,accuracy:answers?Math.round(correct/answers*100):0,due:values.filter(item=>item.nextReviewAt<=now).length};
}
export function createProgressStore({session,loadCloud,saveCloud,resetCloud,notify,changed}){
  let identity='',value=emptyProgress(),enabled=false,state='local',epoch=0,timer,busy=false,again=false,alive=true,writer='',initialized=false,resetStamp='',resetting=-1;
  const guestKey='gather.learn.v1.guest';
  const profileKey=()=>identity?`gather.learn.v1.user.${identity}`:guestKey;
  const userId=()=>session?.()?.user?.id||session?.()?.id||'';
  const changedUI=()=>{if(alive)changed?.();};
  const lock=(key,fn)=>globalThis.navigator?.locks?.request?globalThis.navigator.locks.request(`gather-learning:${key}`,fn):Promise.resolve().then(fn);
  const read=key=>{try{return normalizeProgress(JSON.parse(localStorage.getItem(key)||'null'));}catch{return emptyProgress();}};
  const write=(key,progress)=>{try{localStorage.setItem(key,JSON.stringify(progress));return true;}catch{notify?.('Your browser could not save progress. Check available storage.',true);return false;}};
  const preference=(key,name,set)=>{try{if(set===undefined)return localStorage.getItem(`${key}.${name}`);if(set===null)localStorage.removeItem(`${key}.${name}`);else localStorage.setItem(`${key}.${name}`,set);}catch{}return null;};
  function getWriter(key,rotate=false){
    const storage=globalThis.navigator?.locks?.request?localStorage:sessionStorage;
    try{const name=`${key}.writer`,saved=storage.getItem(name);if(!rotate&&uuidPattern.test(saved||''))return saved;const next=uuid();storage.setItem(name,next);return next;}catch{return uuid();}
  }
  function assign(next){value=project(normalizeProgress(next),writer);}
  function invalidate(){clearTimeout(timer);epoch++;again=false;}
  // A local reset has its own marker: account generations belong to the server.
  // Other tabs replace their cached copy when this marker changes.
  function refreshReset(key=profileKey()){
    const stamp=preference(key,'reset')||'';
    if(stamp===resetStamp)return false;
    invalidate();resetStamp=stamp;writer=getWriter(key);assign(read(key));state=enabled?'pending':'local';return true;
  }
  function saveReset(key,next){
    if(!write(key,next))return false;
    const nextWriter=getWriter(key,true),stamp=uuid();preference(key,'reset',stamp);
    if(key===profileKey()){writer=nextWriter;resetStamp=stamp;assign(next);}
    return true;
  }
  function schedule(){if(!enabled||!identity||!alive)return;state='pending';clearTimeout(timer);timer=setTimeout(()=>void flush(),1800);}
  async function accept(remote,token,key,stamp,authoritative=false){
    if(token!==epoch||!alive)return false;
    let accepted=false;
    await lock(key,()=>{
      if(token!==epoch||!alive)return;
      if((preference(key,'reset')||'')!==stamp){refreshReset(key);return;}
      if(authoritative&&normalizeProgress(remote).generation!==value.generation)accepted=saveReset(key,normalizeProgress(remote));
      else{assign(mergeProgress(mergeProgress(value,read(key)),remote));write(key,value);accepted=true;}
    });
    return accepted&&token===epoch&&alive;
  }
  async function flush(){
    clearTimeout(timer);if(!enabled||!identity||!saveCloud||!alive)return;
    refreshReset();
    if(busy){again=true;return;}busy=true;again=false;
    const token=epoch,key=profileKey(),stamp=resetStamp,snapshot=JSON.stringify(value);let conflictHandled=false;state='saving';changedUI();
    try{
      const remote=await saveCloud(JSON.parse(snapshot));
      if(await accept(remote,token,key,stamp))state='saved';
    }catch(error){
      if(token===epoch&&alive){
        if(error.status===409&&error.progress){if(await accept(error.progress,token,key,stamp,true)){conflictHandled=true;state='saved';again=false;notify?.('Learning progress was reset on another device.');}}
        else{state='error';notify?.(error.status===413?'Progress is saved here. Your account sync limit has been reached.':'Progress is saved on this device. Retry sync when connected.',true);}
      }
    }finally{
      busy=false;
      if(token===epoch&&alive){changedUI();if(enabled&&!conflictHandled&&state!=='error'&&(again||JSON.stringify(value)!==snapshot)){again=false;schedule();}}
      else if(alive&&enabled&&again){again=false;schedule();}
    }
  }
  async function pull(){
    if(!identity||!enabled||!loadCloud||!alive)return false;
    refreshReset();const token=epoch,key=profileKey(),stamp=resetStamp;state='loading';changedUI();
    try{const remote=await loadCloud();if(!await accept(remote,token,key,stamp))return false;state='saved';schedule();return true;}
    catch{if(token===epoch&&alive)state='error';return false;}
    finally{if(token===epoch)changedUI();}
  }
  async function changeIdentity(){
    const next=userId();if(initialized&&next===identity)return;
    initialized=true;invalidate();identity=next;resetStamp=preference(profileKey(),'reset')||'';writer=getWriter(profileKey());assign(read(profileKey()));enabled=!!identity&&preference(profileKey(),'sync')==='1';state=enabled?'pending':'local';changedUI();
    if(enabled)await pull();
  }
  async function update(fn){
    if(!alive||resetting===epoch)return;
    const key=profileKey();refreshReset(key);const token=epoch,stamp=resetStamp;
    await lock(key,()=>{
      if(token!==epoch||!alive||resetting===epoch)return;
      if((preference(key,'reset')||'')!==stamp){refreshReset(key);return;}
      assign(mergeProgress(value,read(key)));fn(value);assign(value);write(key,value);
    });
    if(token===epoch&&alive){schedule();changedUI();}
  }
  async function enable(){
    if(!identity||!loadCloud||!alive)return;
    refreshReset();const token=epoch,key=profileKey(),stamp=resetStamp;state='loading';changedUI();
    try{
      const remote=normalizeProgress(await loadCloud());if(!await accept(remote,token,key,stamp))return;
      // Guest imports use the same lock order in every tab and clear their source.
      await lock(guestKey,async()=>{
        if(token!==epoch||!alive)return;
        const guest=read(guestKey);
        await lock(key,()=>{
          if(token!==epoch||!alive)return;
          if((preference(key,'reset')||'')!==stamp){refreshReset(key);return;}
          const imported=normalizeProgress(guest);imported.generation=value.generation;
          assign(mergeProgress(mergeProgress(value,read(key)),imported));
          if(write(key,value)&&(Object.keys(guest.devices).length||guest.tests.length))saveReset(guestKey,emptyProgress(guest.generation+1));
        });
      });
      if(token!==epoch||!alive)return;enabled=true;preference(key,'sync','1');state='pending';await flush();
    }catch{if(token===epoch&&alive){state='error';notify?.('Could not enable sync. Your progress is still saved on this device.',true);}}
    finally{if(token===epoch)changedUI();}
  }
  function disable(){invalidate();enabled=false;preference(profileKey(),'sync',null);state='local';changedUI();}
  async function reset(){
    invalidate();const token=epoch,key=profileKey();resetting=token;
    try{
      const remote=enabled?await resetCloud():emptyProgress(value.generation);
      if(token!==epoch||!alive)return false;
      let saved=false;
      await lock(key,()=>{if(token!==epoch||!alive)return;saved=saveReset(key,remote);});
      if(!saved||token!==epoch||!alive)return false;
      state=enabled?'saved':'local';changedUI();return true;
    }catch{if(token===epoch&&alive){state='error';changedUI();notify?.('Connect to reset your synced progress. Nothing was cleared.',true);}return false;}
    finally{if(resetting===token)resetting=-1;}
  }
  const storageChanged=event=>{
    const key=profileKey();
    if(event.key===`${key}.sync`){invalidate();enabled=!!identity&&preference(key,'sync')==='1';state=enabled?'pending':'local';changedUI();return;}
    if(event.key!==key&&event.key!==`${key}.reset`)return;
    if(!refreshReset(key))assign(mergeProgress(value,read(key)));changedUI();
  };
  const online=()=>{if(enabled)void pull();};
  globalThis.addEventListener?.('storage',storageChanged);globalThis.addEventListener?.('online',online);
  return {
    init:changeIdentity,sessionChanged:changeIdentity,
    get value(){return value;},get enabled(){return enabled;},get state(){return state;},get account(){return !!identity;},
    update,enable,disable,reset,async retry(){if(await pull())await flush();},
    destroy(){clearTimeout(timer);alive=false;epoch++;globalThis.removeEventListener?.('storage',storageChanged);globalThis.removeEventListener?.('online',online);},
  };
}
