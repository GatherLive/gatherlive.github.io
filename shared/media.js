import {sealImage} from '../public/media.js';
const MAX_IMAGE = 3 * 1024 * 1024;
const TYPES = new Set(['image/png','image/jpeg','image/webp','image/gif']);
const secret = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2,'0')).join('');
const preparedSource = (source, origin) => {
  if (/^data:image\/(?:png|jpeg|webp|gif);base64,/.test(source)) return true;
  try { const url = new URL(source); return !!origin && url.origin === new URL(origin).origin && url.pathname.startsWith('/storage/v1/object/public/giveaway-media/') && !url.username && !url.password; } catch { return false; }
};
export function createImagePlan(questions, origin) {
  const seen = new Set(), plan = [];
  questions.forEach((q,question) => {
    const add = (source,option) => {
      if (!source || seen.has(source) || !preparedSource(source,origin)) return;
      seen.add(source); plan.push({id:crypto.randomUUID(),key:secret(),question,option});
    };
    add(q.image,null); q.options?.forEach((o,index) => add(o.image,index));
  });
  return plan;
}
export function imageSource(questions, asset) {
  const q = questions[asset.question];
  return asset.option == null ? q?.image : q?.options?.[asset.option]?.image;
}
export class RoomMedia {
  constructor() { this.flights = new Map(); this.active = 0; this.waiters = []; this.cache = new Map(); this.cachedBytes = 0; }
  packedResponse(value){return new Response(value.bytes,{headers:{'Content-Type':'application/octet-stream','Content-Length':String(value.bytes.byteLength),'ETag':value.etag,'Accept-Ranges':'bytes','Cache-Control':'public, max-age=86400, immutable','X-Content-Type-Options':'nosniff'}});}
  async slot(work) {
    if (this.active >= 2) await new Promise(resolve => this.waiters.push(resolve));
    else this.active++;
    try { return await work(); } finally { const next=this.waiters.shift();if(next)next();else this.active--; }
  }
  async response(engine, env, id, plain = false) {
    const asset = engine.imagePlan.find(item => item.id === id);
    if (!asset) return Response.json({error:'Image not found.'},{status:404});
    if (plain && !engine.imageReleased(asset)) return Response.json({error:'Image is not available yet.'},{status:403,headers:{'Cache-Control':'no-store'}});
    const source = imageSource(engine.quiz.questions,asset);
    if (!preparedSource(source,env.SUPABASE_URL)) return Response.json({error:'Image unavailable.'},{status:404});
    const key = id + (plain ? ':plain' : ':sealed');
    const cached = !plain && this.cache.get(id);
    if(cached){this.cache.delete(id);this.cache.set(id,cached);return this.packedResponse(cached);}
    if (!this.flights.has(key)) this.flights.set(key,this.slot(async () => {
      try {
        const inline=source.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
        const response = inline ? new Response(Uint8Array.from(atob(inline[2]),char=>char.charCodeAt(0)),{headers:{'Content-Type':inline[1]}}) : await fetch(source,{redirect:'manual',signal:AbortSignal.timeout(8000)});
        const mime = response.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase();
        if (!response.ok || !TYPES.has(mime) || !response.body) { await response.body?.cancel(); throw new Error('Unsupported image.'); }
        const reader = response.body.getReader(), parts = []; let length = 0;
        while (true) {
          const {done,value} = await reader.read(); if (done) break;
          length += value.byteLength;
          if (length > MAX_IMAGE) { await reader.cancel(); throw new Error('Image too large.'); }
          parts.push(value);
        }
        const bytes = new Uint8Array(length); let offset = 0;
        for (const part of parts) { bytes.set(part,offset); offset += part.length; }
        if(plain)return new Response(bytes,{headers:{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
        const packed=await sealImage(bytes,mime,asset.key);
        const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',packed));
        const value={bytes:packed,etag:'\"'+Array.from(hash,b=>b.toString(16).padStart(2,'0')).join('')+'\"'};
        while(this.cache.size&&this.cachedBytes+packed.byteLength>8*1024*1024){const oldest=this.cache.keys().next().value;this.cachedBytes-=this.cache.get(oldest).bytes.byteLength;this.cache.delete(oldest);}
        this.cache.set(id,value);this.cachedBytes+=packed.byteLength;
        return this.packedResponse(value);
      } catch { return Response.json({error:'Image unavailable. Please retry.'},{status:502,headers:{'Cache-Control':'no-store'}}); }
    }));
    const task = this.flights.get(key);
    try { return (await task).clone(); } finally { if (this.flights.get(key) === task) this.flights.delete(key); }
  }
}

// Only encrypted representations support resume; plaintext is never publicly cached.
export function mediaRange(response,request){
  const range=request.headers.get('Range');
  if(!range||response.status!==200||response.headers.get('Content-Type')!=='application/octet-stream')return response;
  const etag=response.headers.get('ETag'),ifRange=request.headers.get('If-Range');
  if(ifRange&&ifRange!==etag)return response;
  const length=Number(response.headers.get('Content-Length')),match=/^bytes=(\d+)-(\d*)$/.exec(range);
  const start=match?Number(match[1]):NaN,end=match&&match[2]?Math.min(Number(match[2]),length-1):length-1;
  if(!Number.isSafeInteger(length)||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=length||end<start){
    void response.body?.cancel();return new Response(null,{status:416,headers:{'Content-Range':`bytes */${length}`,'Cache-Control':'no-store'}});
  }
  const headers=new Headers(response.headers);headers.set('Content-Range',`bytes ${start}-${end}/${length}`);headers.set('Content-Length',String(end-start+1));
  const reader=response.body.getReader();let offset=0,closed=false;
  const body=new ReadableStream({
    async pull(controller){try{while(!closed){const {value,done}=await reader.read();if(done){closed=true;controller.close();return;}const from=Math.max(0,start-offset),to=Math.min(value.byteLength,end+1-offset);offset+=value.byteLength;if(to>from)controller.enqueue(value.subarray(from,to));if(offset>end){closed=true;controller.close();await reader.cancel();return;}if(to>from)return;}}catch(error){closed=true;controller.error(error);}},
    async cancel(reason){closed=true;await reader.cancel(reason);}
  });
  return new Response(body,{status:206,headers});
}
