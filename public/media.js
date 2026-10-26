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
async function boundedBytes(response) {
  if (!response.ok || !response.body) throw new Error('Image unavailable.');
  const reader = response.body.getReader(), parts = [];
  let length = 0;
  while (true) {
    const {done,value} = await reader.read(); if (done) break;
    length += value.byteLength;
    if (length > MAX_PACKED) { await reader.cancel(); throw new Error('Image too large.'); }
    parts.push(value);
  }
  const result = new Uint8Array(length); let offset = 0;
  for (const part of parts) { result.set(part,offset); offset += part.length; }
  return result;
}
export class RoomImages {
  constructor(apiUrl, code) {
    this.base = apiUrl.replace(/\/$/, ''); this.code = code;
    this.bytes = new Map(); this.requests = new Map(); this.keys = new Map(); this.urls = new Map(); this.decoding = new Map();
    this.queue = []; this.size = 0; this.running = 0; this.stopped = false; this.paused = false;
    this.controller = new AbortController();
    this.manifest = new Set(); this.failures = new Map(); this.ready = new Set(); this.retryTimer = null;
  }
  prepare(manifest = []) {
    if (this.stopped || !globalThis.crypto?.subtle) return;
    const remaining=this.manifest=new Set(manifest);this.queue=this.queue.filter(id=>remaining.has(id));
    for(const [id,bytes] of this.bytes)if(!remaining.has(id)&&!this.keys.has(id)){this.size-=bytes.byteLength;this.bytes.delete(id);}
    for(const id of this.failures.keys())if(!remaining.has(id))this.failures.delete(id);
    const known = new Set([...this.bytes.keys(), ...this.urls.keys(), ...this.queue]);
    for (const id of manifest) if (/^[a-f0-9-]{36}$/.test(id) && !known.has(id) && !this.requests.has(id) && !this.failures.has(id)) { this.queue.push(id); known.add(id); }
    this.pump();
  }
  pump() {
    clearTimeout(this.retryTimer);this.retryTimer=null;
    if(this.stopped||this.paused)return;
    const now=Date.now();let next=Infinity;
    for(const [id,failure] of this.failures){
      if(failure.attempts>=3||!this.manifest.has(id)||this.requests.has(id))continue;
      if(failure.after<=now){if(!this.queue.includes(id))this.queue.push(id);}
      else next=Math.min(next,failure.after);
    }
    while (!this.stopped && !this.paused && this.running < 2 && this.queue.length && this.size < 24 * 1024 * 1024) {
      const id = this.queue.shift(); this.running++;
      void this.load(id).then(()=>this.failures.delete(id)).catch(() => {
        const attempts=(this.failures.get(id)?.attempts||0)+1;
        this.failures.set(id,{attempts,after:Date.now()+500*2**(attempts-1)});
      }).finally(() => { this.running--; this.pump(); });
    }
    if(next<Infinity)this.retryTimer=setTimeout(()=>this.pump(),Math.max(0,next-now));
  }
  pause(value) { this.paused=value;if(!value)this.pump(); }
  async load(id) {
    if (this.bytes.has(id)) return this.bytes.get(id);
    if (this.requests.has(id)) return this.requests.get(id);
    const task = (async () => {
      const signal = AbortSignal.any ? AbortSignal.any([this.controller.signal, AbortSignal.timeout(12000)]) : this.controller.signal;
      const response = await fetch(`${this.base}/api/rooms/${this.code}/media/${id}`, {signal, cache:'force-cache'});
      const bytes = await boundedBytes(response);
      if (this.stopped) throw new Error('Room closed.');
      // A later manifest can retire an image while its download is in flight.
      if(this.manifest.has(id)||this.keys.has(id)){this.bytes.set(id, bytes); this.size += bytes.byteLength;}
      return bytes;
    })();
    this.requests.set(id, task);
    try { return await task; } finally { this.requests.delete(id); }
  }
  release(keys = []) {
    // Keep only keys already released by the server, never future image keys.
    for (const entry of keys) if (/^[a-f0-9-]{36}$/.test(entry.id) && /^[a-f0-9]{64}$/.test(entry.key)) {
      this.keys.set(entry.id, entry.key);
      this.queue=this.queue.filter(id=>id!==entry.id);
    }
  }
  cached(path) {
    const id=path.match(/^\/api\/rooms\/(\d{6})\/media\/([a-f0-9-]{36})\/plain$/);
    return id&&id[1]===this.code&&this.ready.has(id[2])?this.urls.get(id[2]):null;
  }
  async source(path) {
    const match = path.match(/^\/api\/rooms\/(\d{6})\/media\/([a-f0-9-]{36})\/plain$/);
    if (!match || match[1] !== this.code) return path;
    const id = match[2], fallback = this.base + path;
    if (!this.keys.has(id) || !globalThis.crypto?.subtle) return fallback;
    if (this.decoding.has(id)) return this.decoding.get(id);
    if (this.urls.has(id)) return this.urls.get(id);
    const task = (async () => {
      try {
        const bytes = await this.load(id), blob = await openImage(bytes, this.keys.get(id));
        if (this.stopped) return fallback;
        const url = URL.createObjectURL(blob);
        // Decode once before mounting; later selections reuse the decoded URL.
        if(typeof Image!=='undefined'){
          const image=new Image();image.src=url;
          try{await image.decode();}catch{URL.revokeObjectURL(url);throw new Error('Image could not be decoded.');}
        }
        if(this.stopped||!this.keys.has(id)){URL.revokeObjectURL(url);return fallback;}
        this.urls.set(id,url);this.ready.add(id);
        this.size -= this.bytes.get(id)?.byteLength || 0; this.bytes.delete(id); this.pump();
        return url;
      } catch { return fallback; }
    })();
    this.decoding.set(id,task);
    try { return await task; } finally { this.decoding.delete(id); }
  }
  retain(paths) {
    const keep = new Set(paths.map(path => path.match(/\/media\/([a-f0-9-]{36})\/plain$/)?.[1]).filter(Boolean));
    for (const [id,url] of this.urls) if (!keep.has(id)) { URL.revokeObjectURL(url); this.urls.delete(id); this.ready.delete(id); this.keys.delete(id); }
    for (const id of this.keys.keys()) if (!keep.has(id)) this.keys.delete(id);
  }
  close() {
    this.stopped = true; this.controller.abort();clearTimeout(this.retryTimer);this.retryTimer=null;
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear(); this.bytes.clear(); this.keys.clear();this.ready.clear();this.manifest.clear();this.failures.clear(); this.queue = []; this.size = 0;
  }
}
