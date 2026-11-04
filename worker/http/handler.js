import {originAllowed} from '../../shared/http/api.js';
import {responseHeaders} from '../../shared/http/api.js';
import {json} from '../../shared/http/api.js';
import {mediaRange} from '../../shared/media/room-media.js';
import {SITE_CONTROL_REGISTRY} from '../../shared/site/control.js';
import {handleApi} from '../../shared/http/api.js';
import {roomAdapter} from '../rooms/adapter.js';

export default {
  async fetch(request,env,ctx){
    if(!originAllowed(request,env))return responseHeaders(request,env,json({error:'This website origin is not allowed.'},403));
    const url=new URL(request.url);
    const isSiteSocket=url.pathname==='/api/site/updates'&&request.method==='GET';
    const isSocket=/^\/api\/rooms\/\d{6}\/ws$/.test(url.pathname) && request.method==='GET';
    const isRoomCheck=/^\/api\/rooms\/\d{6}$/.test(url.pathname) && request.method==='GET';
    const isMedia=/^\/api\/rooms\/\d{6}\/media\/[a-f0-9-]{36}(?:\/plain)?$/.test(url.pathname) && request.method==='GET';
    const cacheKey=isMedia&&!url.pathname.endsWith('/plain')?new Request(url.origin+url.pathname):null;
    if(cacheKey){try{const cached=await caches.default.match(cacheKey);if(cached)return responseHeaders(request,env,mediaRange(cached,request));}catch{/* Caching must not block an image. */}}
    if(!['/api/health','/api/config'].includes(url.pathname)){
      const ip=request.headers.get('CF-Connecting-IP') || 'unknown';
      // Large groups on one Wi-Fi share an IP. Keep host API and guest joins separate.
      const isMediaPreflight=request.method==='OPTIONS'&&/^\/api\/rooms\/\d{6}\/media\/[a-f0-9-]{36}(?:\/plain)?$/.test(url.pathname);
      const limiter=isSiteSocket||url.pathname==='/api/site/announcement'||isSocket||isRoomCheck||isMedia||isMediaPreflight ? env.CONNECTION_LIMITER : env.API_LIMITER;
      if(limiter && !(await limiter.limit({key:ip})).success)return responseHeaders(request,env,json({error:'Too many requests. Please wait a minute.'},429));
    }
    if(isSiteSocket)return env.ACCOUNTS.getByName(SITE_CONTROL_REGISTRY).fetch(request);
    if(isSocket)return env.ROOMS.getByName(url.pathname.split('/')[3]).fetch(request);
    if(isMedia){
      const response=await env.ROOMS.getByName(url.pathname.split('/')[3]).fetch(request);
      if(cacheKey&&response.status===200)ctx.waitUntil(caches.default.put(cacheKey,response.clone()).catch(()=>{}));
      return responseHeaders(request,env,mediaRange(response,request));
    }
    return handleApi(request,env,roomAdapter(env));
  }
};
