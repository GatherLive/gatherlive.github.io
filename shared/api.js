import {LEARNING_MAX_BYTES} from './learning-progress.js';
// Shared HTTP API. The same handlers run locally and in Cloudflare Workers.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const json = (body, status = 200) => Response.json(body, {status, headers: {'Cache-Control':'no-store'}});
export function publicConfig(env) {
  return {supabaseUrl: env.SUPABASE_URL, supabaseKey: env.SUPABASE_PUBLISHABLE_KEY};
}
export function originAllowed(request, env) {
  const origin = request.headers.get('Origin');
  if (!origin) return true;
  const url = new URL(request.url);
  if (origin === url.origin) return true;
  return (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).includes(origin);
}
export function responseHeaders(request, env, response) {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  const origin = request.headers.get('Origin');
  if (origin && originAllowed(request, env)) {
    headers.set('Access-Control-Allow-Origin', origin);
    headers.set('Vary', 'Origin');
  }
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  headers.set('Access-Control-Max-Age', '600');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'no-referrer');
  return new Response(response.body, {status:response.status, headers});
}
export function bearer(request) {
  const token = request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9._-]+)$/i)?.[1];
  if (!token || token.length > 8192) throw new HttpError(401, 'Please sign in to host.');
  return token;
}
export async function readJson(request, max = 16_384) {
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, 'A JSON body is required.');
  let size = 0; const parts = [];
  while (true) {
    const {value, done} = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) { await reader.cancel(); throw new HttpError(413, 'Request is too large.'); }
    parts.push(value);
  }
  const bytes = new Uint8Array(size); let offset=0;
  for (const part of parts) { bytes.set(part,offset); offset+=part.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new HttpError(400, 'Invalid JSON.'); }
}
export async function supabase(env, path, token, options = {}) {
  const headers = new Headers(options.headers);
  headers.set('apikey',env.SUPABASE_PUBLISHABLE_KEY);
  headers.set('Authorization',`Bearer ${token}`);
  if (options.body) headers.set('Content-Type','application/json');
  let response;
  try { response = await fetch(`${env.SUPABASE_URL}${path}`, {...options, headers, signal:AbortSignal.timeout(12_000)}); }
  catch { throw new HttpError(503, 'The account service is temporarily unavailable. Please retry.'); }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new HttpError(401,'Your session expired. Please sign in again.');
    const error = new HttpError(502,'The database could not complete this request. Please retry.');
    const detail = await response.json().catch(() => null);
    if (typeof detail?.code === 'string') error.databaseCode = detail.code;
    throw error;
  }
  if (response.status === 204) return null;
  return response.json();
}
export async function authenticate(env, token) {
  const user = await supabase(env, '/auth/v1/user', token);
  if (!user?.id || !user.email) throw new HttpError(401,'Please sign in again.');
  return user;
}
export async function handleApi(request, env, rooms) {
  try {
    if (!originAllowed(request,env)) throw new HttpError(403,'This website origin is not allowed.');
    const {pathname} = new URL(request.url);
    if (request.method === 'OPTIONS') return responseHeaders(request,env,new Response(null,{status:204}));
    let response;
    if (pathname === '/' && request.method === 'GET') response=json({service:'Gather API',ok:true});
    else if (pathname === '/api/config' && request.method === 'GET') response=json(publicConfig(env));
    else if (pathname === '/api/health' && request.method === 'GET') response=json({ok:true,service:'gather',mode:env.LOCAL_DEV ? 'local' : 'cloudflare'});
    else if (pathname === '/api/rooms' && request.method === 'POST') {
      const token = bearer(request), user = await authenticate(env,token);
      const body = await readJson(request);
      if (!/^[0-9a-f-]{36}$/i.test(body.quizId || '')) throw new HttpError(400,'Choose a saved quiz.');
      const quizzes = await supabase(env,`/rest/v1/giveaway_quizzes?id=eq.${body.quizId}&owner_id=eq.${user.id}&select=*`,token);
      if (!quizzes?.[0]) throw new HttpError(404,'Quiz not found.');
      const quiz=quizzes[0];
      const code=await rooms.create({ownerId:user.id,quiz,settings:{...quiz.settings,...body.settings}});
      response=json({code},201);
    } else if (pathname === '/api/rooms' && request.method === 'GET') {
      const user=await authenticate(env,bearer(request));
      response=json({rooms:await rooms.list(user.id)});
    } else if (pathname === '/api/rooms' && request.method === 'DELETE') {
      const user=await authenticate(env,bearer(request)),body=await readJson(request,16_384);
      if(!Array.isArray(body?.rooms)||!body.rooms.length||body.rooms.length>100)throw new HttpError(400,'Choose between 1 and 100 open rooms.');
      const codes=new Set();
      for(const room of body.rooms){
        if(typeof room?.code!=='string'||!/^\d{6}$/.test(room.code)||typeof room?.roomId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(room.roomId)||codes.has(room.code))throw new HttpError(400,'Refresh your open rooms before closing them.');
        codes.add(room.code);
      }
      let closed=0,failed=0;
      for(let i=0;i<body.rooms.length;i+=5){
        const results=await Promise.allSettled(body.rooms.slice(i,i+5).map(room=>rooms.close(room.code,user.id,room.roomId,{unfinishedOnly:true})));
        for(const result of results)if(result.status==='fulfilled')closed++;else failed++;
      }
      response=json({closed,failed});
    } else if (/^\/api\/rooms\/\d{6}$/.test(pathname) && request.method === 'DELETE') {
      const user=await authenticate(env,bearer(request)),code=pathname.split('/')[3],body=await readJson(request,1024);
      if(typeof body?.roomId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(body.roomId))throw new HttpError(400,'Refresh your rooms before closing one.');
      await rooms.close(code,user.id,body.roomId);
      response=json({closed:true});
    } else if (/^\/api\/rooms\/\d{6}\/report$/.test(pathname) && request.method === 'POST') {
      const token=bearer(request), user=await authenticate(env,token), code=pathname.split('/')[3];
      const report=await rooms.report(code,user.id);
      // A live game retains its own quiz copy when the saved set is deleted.
      const quizzes=report.quizId ? await supabase(env,`/rest/v1/giveaway_quizzes?id=eq.${report.quizId}&select=id`,token) : [];
      const payload={id:report.id,owner_id:user.id,quiz_id:quizzes[0]?.id || null,room_code:code,quiz_title:report.title,results:report.results};
      const save=()=>supabase(env,'/rest/v1/giveaway_reports?on_conflict=id',token,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});
      let rows;
      try { rows=await save(); }
      catch(error) {
        // The host may delete the saved set between the lookup and the insert.
        if(error.databaseCode!=='23503' || !payload.quiz_id)throw error;
        payload.quiz_id=null;rows=await save();
      }
      response=json({report:rows?.[0] || {id:report.id}});
    } else if (pathname === '/api/account/learning' && ['GET','POST','DELETE'].includes(request.method)) {
      const user=await authenticate(env,bearer(request));
      const body=request.method==='POST'?await readJson(request,LEARNING_MAX_BYTES+1024):null;
      response=json({progress:await rooms.learning(user.id,request.method,body?.progress)});
    } else if (pathname === '/api/account/chat' && ['GET','POST'].includes(request.method)) {
      const user=await authenticate(env,bearer(request));
      if(request.method==='POST'){
        const body=await readJson(request,1024);
        await rooms.unlockChat(user.id,body?.code);
        response=json({unlocked:true});
      }else response=json({unlocked:await rooms.chatAccess(user.id)});
    } else if (pathname === '/api/account' && request.method === 'DELETE') {
      const token=bearer(request), user=await authenticate(env,token);
      await rooms.purgeOwner(user.id);
      const result=await fetch(`${env.SUPABASE_URL}/functions/v1/delete-account`,{method:'DELETE',headers:{Authorization:`Bearer ${token}`,apikey:env.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(30_000)});
      if (!result.ok) throw new HttpError(502,'Account deletion could not finish. Your account is still available; please retry.');
      response=json({deleted:true});
    } else throw new HttpError(404,'Endpoint not found.');
    return responseHeaders(request,env,response);
  } catch (error) {
    const status=error.status || (error.name === 'EngineError' ? 400 : 500);
    if (status >= 500) console.error(JSON.stringify({event:'api_error',status,name:error.name}));
    return responseHeaders(request,env,json({error:status >= 500 && !error.status ? 'Something went wrong. Please retry.' : error.message,...(status===409&&error.progress?{progress:error.progress}:{})},status));
  }
}
