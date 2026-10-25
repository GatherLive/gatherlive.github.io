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
  constructor() { this.flights = new Map(); this.active = 0; this.waiters = []; }
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
    if (!this.flights.has(key)) this.flights.set(key,this.slot(async () => {
      try {
        const inline=source.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,(.+)$/);
        const response = inline ? new Response(Uint8Array.from(atob(inline[2]),char=>char.charCodeAt(0)),{headers:{'Content-Type':inline[1]}}) : await fetch(source,{redirect:'error',signal:AbortSignal.timeout(8000)});
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
        return new Response(plain ? bytes : await sealImage(bytes,mime,asset.key),{headers:{'Content-Type':plain ? mime : 'application/octet-stream','Cache-Control':plain ? 'private, no-store' : 'public, max-age=86400, immutable','X-Content-Type-Options':'nosniff'}});
      } catch { return Response.json({error:'Image unavailable. Please retry.'},{status:502,headers:{'Cache-Control':'no-store'}}); }
    }));
    const task = this.flights.get(key);
    try { return (await task).clone(); } finally { if (this.flights.get(key) === task) this.flights.delete(key); }
  }
}
