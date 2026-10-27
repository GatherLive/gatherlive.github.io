import {readImageDownload,saveImageDownload,deleteImageDownload} from './media-store.js';
// Images download as AES-GCM ciphertext. Keys arrive with the active question.
const MAX_IMAGE = 3 * 1024 * 1024;
const MAX_PACKED = MAX_IMAGE + 16384 + 33;
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const bytesFromKey = key => {
  if (!/^[a-f0-9]{64}$/.test(key)) throw new Error('Invalid image key.');
  return Uint8Array.from(key.match(/../g), part => parseInt(part, 16));
};
export async function sealImage(bytes, mime, secret) {
  const type = TYPES.indexOf(mime);
  if (type < 0 || bytes.byteLength > MAX_IMAGE) throw new Error('Unsupported image.');
  const header = new Uint8Array(17);
  header.set([71, 73, 77, 1, type]);
  crypto.getRandomValues(header.subarray(5));
  const key = await crypto.subtle.importKey('raw', bytesFromKey(secret), 'AES-GCM', false, ['encrypt']);
  // Padding conceals exact file sizes, which can identify small public icons.
  const payload = new Uint8Array(Math.ceil((bytes.byteLength + 4) / 16384) * 16384);
  new DataView(payload.buffer).setUint32(0,bytes.byteLength);payload.set(bytes,4);
  const ciphertext = await crypto.subtle.encrypt({name:'AES-GCM', iv:header.subarray(5), additionalData:header.subarray(0,5)}, key, payload);
  const packed = new Uint8Array(header.length + ciphertext.byteLength);
  packed.set(header); packed.set(new Uint8Array(ciphertext), header.length);
  return packed;
}
export async function openImage(packed, secret) {
  const bytes = new Uint8Array(packed);
  if (bytes.length < 37 || bytes.length > MAX_PACKED || bytes[0] !== 71 || bytes[1] !== 73 || bytes[2] !== 77 || bytes[3] !== 1 || !TYPES[bytes[4]]) throw new Error('Invalid image data.');
  const key = await crypto.subtle.importKey('raw', bytesFromKey(secret), 'AES-GCM', false, ['decrypt']);
  const plain = await crypto.subtle.decrypt({name:'AES-GCM', iv:bytes.subarray(5,17), additionalData:bytes.subarray(0,5)}, key, bytes.subarray(17));
  if(plain.byteLength<4)throw new Error('Invalid image data.');
  const length=new DataView(plain).getUint32(0);
  if(length>MAX_IMAGE||length>plain.byteLength-4)throw new Error('Invalid image data.');
  return new Blob([new Uint8Array(plain,4,length)], {type:TYPES[bytes[4]]});
}
const UUID=/^[a-f0-9-]{36}$/;
async function validCipher(bytes,etag){if(bytes.length<37||bytes.length>MAX_PACKED||bytes[0]!==71||bytes[1]!==73||bytes[2]!==77||bytes[3]!==1||!TYPES[bytes[4]])return false;if(/^"[a-f0-9]{64}"$/.test(etag)&&globalThis.crypto?.subtle){const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');return etag==='"'+hash+'"';}return true;}
const MEMORY_BUDGET=32*1024*1024;
const joinParts=state=>{const bytes=new Uint8Array(state.length);let offset=0;for(const part of state.parts){bytes.set(part,offset);offset+=part.byteLength;}return bytes;};
export class RoomImages {
  constructor(apiUrl,code){
    this.base=apiUrl.replace(/\/$/,'');this.code=code;
    this.bytes=new Map();this.requests=new Map();this.keys=new Map();this.urls=new Map();this.decoding=new Map();this.partials=new Map();this.controllers=new Map();
    this.queue=[];this.size=0;this.running=0;this.stopped=false;this.paused=false;this.manifest=new Set();this.urgent=new Set();this.failures=new Map();this.ready=new Set();this.retryTimer=null;this.preparation=null;
    this.online=()=>{for(const failure of this.failures.values())failure.after=0;this.pump();};this.offline=()=>{for(const controller of this.controllers.values())controller.abort();};globalThis.addEventListener?.('online',this.online);globalThis.addEventListener?.('offline',this.offline);
  }
  storageKey(id){return `${this.base}|${this.code}|${id}`;}
  trim(){for(const[id,bytes]of this.bytes){if(this.size<=MEMORY_BUDGET)break;if(!this.urgent.has(id)&&!this.keys.has(id)&&!this.requests.has(id)){this.size-=bytes.byteLength;this.bytes.delete(id);}}for(const[id,state]of this.partials){if(this.size<=MEMORY_BUDGET)break;if(!this.urgent.has(id)&&!this.keys.has(id)&&!this.requests.has(id)){this.size-=state.length;this.partials.delete(id);}}}
  prepare(manifest=[]){
    if(this.stopped||!globalThis.crypto?.subtle)return;
    this.manifest=new Set(manifest.filter(id=>UUID.test(id)));this.queue=this.queue.filter(id=>this.manifest.has(id)||this.urgent.has(id));
    for(const [id,bytes] of this.bytes)if(!this.manifest.has(id)&&!this.urgent.has(id)&&!this.keys.has(id)){this.size-=bytes.byteLength;this.bytes.delete(id);}
    for(const [id,state] of this.partials)if(!this.manifest.has(id)&&!this.urgent.has(id)&&!this.requests.has(id)){this.size-=state.length;this.partials.delete(id);}
    for(const id of this.failures.keys())if(!this.manifest.has(id)&&!this.urgent.has(id))this.failures.delete(id);
    for(const id of this.manifest)if(!this.bytes.has(id)&&!this.ready.has(id)&&!this.requests.has(id)&&!this.queue.includes(id))this.queue.push(id);
    this.pump();
  }
  prepareCurrent(preparation,onReady){
    if(!preparation||!UUID.test(preparation.token)||!Array.isArray(preparation.ids))return;
    const ids=preparation.ids.filter(id=>UUID.test(id)).slice(0,9);
    this.preparation={token:preparation.token,ids,onReady,sent:false};this.urgent=new Set(ids);
    // Evict distant ciphertext from RAM; its encrypted disk checkpoint remains reusable.
    for(const [id,bytes] of this.bytes)if(!this.urgent.has(id)&&this.size>20*1024*1024){this.size-=bytes.byteLength;this.bytes.delete(id);}
    this.queue=[...ids.filter(id=>!this.bytes.has(id)&&!this.ready.has(id)),...this.queue.filter(id=>!this.urgent.has(id))];
    if([...this.urgent].some(id=>!this.bytes.has(id)&&!this.ready.has(id)))for(const [id,controller] of this.controllers)if(!this.urgent.has(id))controller.abort();
    this.checkPrepared();this.pump();
  }
  checkPrepared(){const p=this.preparation;if(p&&!p.sent&&p.ids.every(id=>this.bytes.has(id)||this.ready.has(id))){p.sent=true;p.onReady?.(p.token);}}
  pump(){
    clearTimeout(this.retryTimer);this.retryTimer=null;if(this.stopped||globalThis.navigator?.onLine===false)return;
    const needed=[...this.urgent].some(id=>!this.bytes.has(id)&&!this.ready.has(id));
    const now=Date.now();let next=Infinity;
    for(const [id,failure] of this.failures){if(!this.manifest.has(id)&&!this.urgent.has(id))continue;if(this.requests.has(id))continue;if(failure.after<=now){if(!this.queue.includes(id))this.queue.push(id);}else next=Math.min(next,failure.after);}
    this.queue.sort((a,b)=>Number(this.urgent.has(b))-Number(this.urgent.has(a)));
    const limit=globalThis.navigator?.connection?.saveData?1:2;
    while(this.running<limit&&this.queue.length){
      const index=this.queue.findIndex(id=>!this.requests.has(id)&&(!this.paused||this.urgent.has(id))&&(!needed||this.urgent.has(id))&&(!this.failures.has(id)||this.failures.get(id).after<=now));
      if(index<0||this.size>=MEMORY_BUDGET&&!needed)break;
      const [id]=this.queue.splice(index,1);if(this.bytes.has(id)||this.ready.has(id))continue;this.running++;
      void this.load(id).then(()=>{this.failures.delete(id);this.checkPrepared();}).catch(()=>{if(this.stopped)return;const attempts=(this.failures.get(id)?.attempts||0)+1;this.failures.set(id,{attempts,after:Date.now()+Math.min(15000,500*2**Math.min(5,attempts-1))});}).finally(()=>{this.running--;this.pump();});
    }
    if(next<Infinity)this.retryTimer=setTimeout(()=>this.pump(),Math.max(50,next-now));
  }
  pause(value){this.paused=value;if(value){this.preparation=null;this.urgent.clear();}else this.pump();}
  async load(id){
    if(this.stopped)throw Error('Room closed.');if(this.bytes.has(id))return this.bytes.get(id);if(this.requests.has(id))return this.requests.get(id);
    const task=(async()=>{
      let state=this.partials.get(id);
      if(!state){const saved=await readImageDownload(this.storageKey(id));if(this.stopped)throw Error('Room closed.');state={parts:[],length:0,etag:'',total:0};if(saved&&saved.bytes.byteLength<=MAX_PACKED&&saved.total<=MAX_PACKED){state={parts:[saved.bytes],length:saved.bytes.byteLength,etag:saved.etag,total:saved.total};this.size+=state.length;}this.partials.set(id,state);}
      const checkpoint=()=>{if(state.length)void saveImageDownload(this.storageKey(id),{bytes:joinParts(state),etag:state.etag,total:state.total});};
      if(state.total&&state.length===state.total){const bytes=joinParts(state);if(await validCipher(bytes,state.etag)){this.partials.delete(id);if(this.manifest.has(id)||this.urgent.has(id)||this.keys.has(id))this.bytes.set(id,bytes);else this.size-=bytes.byteLength;return bytes;}this.size-=state.length;state.parts=[];state.length=0;state.total=0;state.etag='';void deleteImageDownload(this.storageKey(id));}
      const controller=new AbortController();this.controllers.set(id,controller);let timeout=setTimeout(()=>controller.abort(),15000),lastSaved=state.length;
      try{
        const resumable=state.length>0&&/^"[a-f0-9]{64}"$/.test(state.etag);
        const response=await fetch(`${this.base}/api/rooms/${this.code}/media/${id}`,{signal:controller.signal,cache:resumable?'no-cache':'force-cache',headers:resumable?{Range:`bytes=${state.length}-`,'If-Range':state.etag}:{}});
        if(response.status===416){this.size-=state.length;state.parts=[];state.length=0;state.etag='';state.total=0;void deleteImageDownload(this.storageKey(id));}if(!response.ok||!response.body)throw Error('Image unavailable.');
        const range=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range')||'');
        if(response.status===206){if(!range||Number(range[1])!==state.length||response.headers.get('ETag')!==state.etag){await response.body.cancel();this.size-=state.length;state.parts=[];state.length=0;state.total=0;state.etag='';void deleteImageDownload(this.storageKey(id));throw Error('Invalid image range.');}state.total=Number(range[3]);}
        else{this.size-=state.length;state.parts=[];state.length=0;state.total=Number(response.headers.get('Content-Length'))||0;state.etag=response.headers.get('ETag')||'';}
        if(state.total>MAX_PACKED){await response.body.cancel();throw Error('Image too large.');}
        const reader=response.body.getReader();
        while(true){clearTimeout(timeout);timeout=setTimeout(()=>controller.abort(),15000);const {value,done}=await reader.read();if(done)break;if(this.stopped)throw Error('Room closed.');if(state.length+value.byteLength>MAX_PACKED){await reader.cancel();throw Error('Image too large.');}state.parts.push(value);state.length+=value.byteLength;this.size+=value.byteLength;this.trim();if(state.length-lastSaved>=512*1024){checkpoint();lastSaved=state.length;}}
        if(state.total&&state.length!==state.total)throw Error('Image download interrupted.');state.total=state.length;
        const bytes=joinParts(state);if(!await validCipher(bytes,state.etag)){this.size-=state.length;state.parts=[];state.length=0;state.total=0;state.etag='';void deleteImageDownload(this.storageKey(id));throw Error('Invalid image data.');}checkpoint();this.partials.delete(id);
        if(this.manifest.has(id)||this.urgent.has(id)||this.keys.has(id))this.bytes.set(id,bytes);else this.size-=bytes.byteLength;
        return bytes;
      }catch(error){checkpoint();throw error;}finally{clearTimeout(timeout);this.controllers.delete(id);}
    })();
    this.requests.set(id,task);try{return await task;}finally{this.requests.delete(id);this.trim();}
  }
  release(keys=[]){for(const entry of keys)if(UUID.test(entry.id)&&/^[a-f0-9]{64}$/.test(entry.key)){this.keys.set(entry.id,entry.key);this.queue=this.queue.filter(id=>id!==entry.id);}}
  cached(path){const match=path.match(/^\/api\/rooms\/(\d{6})\/media\/([a-f0-9-]{36})\/plain$/);return match&&match[1]===this.code&&this.ready.has(match[2])?this.urls.get(match[2]):null;}
  async source(path){
    const match=path.match(/^\/api\/rooms\/(\d{6})\/media\/([a-f0-9-]{36})\/plain$/);if(!match||match[1]!==this.code)return path;
    const id=match[2],fallback=this.base+path;if(!this.keys.has(id)||!globalThis.crypto?.subtle)return fallback;if(this.decoding.has(id))return this.decoding.get(id);if(this.urls.has(id))return this.urls.get(id);
    const task=(async()=>{try{
      const bytes=await this.load(id),blob=await openImage(bytes,this.keys.get(id));if(this.stopped)return fallback;const url=URL.createObjectURL(blob);
      if(typeof Image!=='undefined'){const image=new Image();image.src=url;try{await image.decode();}catch{URL.revokeObjectURL(url);throw Error('Image could not be decoded.');}}
      if(this.stopped||!this.keys.has(id)){URL.revokeObjectURL(url);return fallback;}this.urls.set(id,url);this.ready.add(id);this.size-=this.bytes.get(id)?.byteLength||0;this.bytes.delete(id);this.pump();return url;
    }catch{this.size-=this.bytes.get(id)?.byteLength||0;this.bytes.delete(id);void deleteImageDownload(this.storageKey(id));return fallback;}})();
    this.decoding.set(id,task);try{return await task;}finally{this.decoding.delete(id);}
  }
  retain(paths){const keep=new Set(paths.map(path=>path.match(/\/media\/([a-f0-9-]{36})\/plain$/)?.[1]).filter(Boolean));for(const[id,url]of this.urls)if(!keep.has(id)){URL.revokeObjectURL(url);this.urls.delete(id);this.ready.delete(id);this.keys.delete(id);}for(const id of this.keys.keys())if(!keep.has(id))this.keys.delete(id);}
  close(){this.stopped=true;for(const controller of this.controllers.values())controller.abort();clearTimeout(this.retryTimer);this.retryTimer=null;globalThis.removeEventListener?.('online',this.online);globalThis.removeEventListener?.('offline',this.offline);for(const url of this.urls.values())URL.revokeObjectURL(url);this.urls.clear();this.bytes.clear();this.keys.clear();this.ready.clear();this.manifest.clear();this.failures.clear();this.partials.clear();this.queue=[];this.size=0;}
}
