import type {WorkerEnv} from '../env.js';
import {originAllowed} from '../../shared/http/api.js';
import {responseHeaders} from '../../shared/http/api.js';
import {json} from '../../shared/http/api.js';
import {mediaRange} from '../../shared/media/room-media.js';
import {SITE_CONTROL_REGISTRY} from '../../shared/site/control.js';
import {handleApi} from '../../shared/http/api.js';
import {roomAdapter} from '../rooms/adapter.js';
import {networkKey} from '../../shared/rooms/abuse.js';
import {pooledRooms,handleRoomRelay,roomPeerRequestAllowed} from '../../shared/rooms/pool.js';

export default {
  async fetch(request: Request,env: WorkerEnv,ctx: ExecutionContext){
    try{
    if(!originAllowed(request,env))return responseHeaders(request,env,json({error:'This website origin is not allowed.'},403));
    const url=new URL(request.url);
    const isSiteSocket=url.pathname==='/api/site/updates'&&request.method==='GET';
    const isSocket=/^\/api\/rooms\/\d{6}\/ws$/.test(url.pathname) && request.method==='GET';
    const isRoomCheck=/^\/api\/rooms\/\d{6}$/.test(url.pathname) && request.method==='GET';
    const isMedia=/^\/api\/rooms\/\d{6}\/media\/[a-f0-9-]{36}(?:\/plain)?$/.test(url.pathname) && request.method==='GET';
    const cacheKey=isMedia&&!url.pathname.endsWith('/plain')?new Request(url.origin+url.pathname):null;
    if(cacheKey){try{const cached=await caches.default.match(cacheKey);if(cached)return responseHeaders(request,env,mediaRange(cached,request));}catch{/* Caching must not block an image. */}}
    {
      const ip=request.headers.get('CF-Connecting-IP') || 'unknown';
      // Large groups on one Wi-Fi share an IP. Keep host API and guest joins separate.
      const isMediaPreflight=request.method==='OPTIONS'&&/^\/api\/rooms\/\d{6}\/media\/[a-f0-9-]{36}(?:\/plain)?$/.test(url.pathname);
      const limiter=isSiteSocket||['/api/site/announcement','/api/health','/api/config'].includes(url.pathname)||isSocket||isRoomCheck||isMedia||isMediaPreflight ? env.CONNECTION_LIMITER : env.API_LIMITER;
      if(limiter && !(await limiter.limit({key:ip})).success){const response=json({error:'Too many requests. Please wait a minute.'},429);response.headers.set('Retry-After','60');return responseHeaders(request,env,response);}
    }
    const local=roomAdapter(env),rooms=pooledRooms(env,local);
    const relay=await handleRoomRelay(request,env,local,nonce=>env.ROOM_GATE?env.ROOM_GATE.getByName('relay:'+nonce.slice(0,2)).claim(nonce):false);
    if(relay)return responseHeaders(request,env,relay);
    if(!roomPeerRequestAllowed(request,env))return responseHeaders(request,env,json({error:'Endpoint not found.'},404));
    let network='';
    if((isSocket||isRoomCheck||isMedia)&&env.ROOM_GATE){
      network=await networkKey(request.headers.get('CF-Connecting-IP')||'unknown');
      const gate=env.ROOM_GATE.getByName(network),code=url.pathname.split('/')[3],check=await gate.probe(code);
      if(!check.allowed){const response=json({error:'Too many room codes. Wait a minute and retry.'},429);response.headers.set('Retry-After','60');return responseHeaders(request,env,response);}
      const available=check.cached?check.available===true:await rooms.available(code);
      if(!check.cached)await gate.settle(code,available===true);
      if(!available)return responseHeaders(request,env,json({error:'Room is not available.'},404));
      if(isRoomCheck){const discovery=await rooms.discover(code);return responseHeaders(request,env,discovery.available?json(discovery):json({error:'Room is not available.'},404));}
    }
    if(isSiteSocket)return env.ACCOUNTS.getByName(SITE_CONTROL_REGISTRY).fetch(request);
    if(isSocket){const headers=new Headers(request.headers);headers.set('X-Gather-Network',network);return env.ROOMS.getByName(url.pathname.split('/')[3]).fetch(new Request(request,{headers}));}
    if(isMedia){
      const response=await env.ROOMS.getByName(url.pathname.split('/')[3]).fetch(request);
      if(cacheKey&&response.status===200)ctx.waitUntil(caches.default.put(cacheKey,response.clone()).catch(()=>{}));
      return responseHeaders(request,env,mediaRange(response,request));
    }
    return handleApi(request,env,rooms);
    }catch(error){
      console.error(JSON.stringify({event:'service_error',name:error.name}));
      return responseHeaders(request,env,json({error:'The service is temporarily unavailable. Please retry.'},503));
    }
  }
} satisfies ExportedHandler<WorkerEnv>;
