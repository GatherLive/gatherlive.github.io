import {HttpError,supabase} from '../http/api.js';
export const IMAGE_BUCKET='giveaway-media';
export const IMAGE_BYTES=3*1024*1024;
export function ownedImage(name,userId){
 return typeof name==='string'&&name.length<=512&&name.startsWith(userId+'/')&&!name.includes('\\')&&!/[\u0000-\u001f\u007f]/.test(name)&&name.split('/').every(part=>part&&part!=='.'&&part!=='..');
}
export function imageURL(env,name){return env.SUPABASE_URL+'/storage/v1/object/public/'+IMAGE_BUCKET+'/'+name.split('/').map(encodeURIComponent).join('/');}
export async function storedImages(env,token,userId,{page=null,oldest=false}={}){
 const rows=[];let offset=page==null?0:page*20,limit=page==null?100:20;
 while(true){
  const batch=await supabase(env,'/storage/v1/object/list/'+IMAGE_BUCKET,token,{method:'POST',body:JSON.stringify({prefix:userId+'/',limit,offset,sortBy:{column:'created_at',order:oldest?'asc':'desc'}})});
  if(!Array.isArray(batch))throw new HttpError(503,'Images could not be loaded. Please retry.');
  for(const item of batch)if(item.id)rows.push({id:item.id,name:userId+'/'+item.name,createdAt:item.created_at,bytes:Number(item.metadata?.size)||0,url:imageURL(env,userId+'/'+item.name)});
  if(page!=null||batch.length<limit)break;
  offset+=limit;
  if(offset>=1000000)throw new HttpError(503,'Image usage could not be counted. Please retry.');
 }
 return rows;
}
export async function resourceCount(env,token,userId,resource='quizzes'){
 const table=['results','allResults'].includes(resource)?'giveaway_reports':'giveaway_quizzes',filters=resource==='results'?'&results->questions=cs.[]&results->players=cs.[]':'';
 const response=await fetch(env.SUPABASE_URL+'/rest/v1/'+table+'?owner_id=eq.'+encodeURIComponent(userId)+'&select=id'+filters,{method:'HEAD',headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+token,Prefer:'count=exact'},signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw new HttpError(response.status===401||response.status===403?401:503,'Quiz usage could not be loaded. Please sign in again or retry.');
 const count=response.headers.get('Content-Range')?.match(/\/(\d+)$/)?.[1];
 if(count==null)throw new HttpError(503,'Quiz usage could not be counted. Please retry.');
 return Number(count);
}
export const quizCount=(env,token,userId)=>resourceCount(env,token,userId);
export async function savedImageInUse(env,token,userId,name){
 const url=imageURL(env,name);
 for(const [table,field,payload]of [
  ['giveaway_quizzes','questions',[{image:url}]],['giveaway_quizzes','questions',[{options:[{image:url}]}]],
  ['giveaway_reports','results',{questions:[{image:url}]}],['giveaway_reports','results',{questions:[{options:[{image:url}]}]}]
 ]){
  const query=new URLSearchParams({owner_id:'eq.'+userId,select:'id',limit:'1',[field as string]:'cs.'+JSON.stringify(payload)});
  if((await supabase(env,'/rest/v1/'+table+'?'+query,token))?.length)return true;
 }
 return false;
}
export async function imageBytes(request){
 const mime=request.headers.get('Content-Type')?.split(';')[0];
 if(!['image/jpeg','image/png','image/webp'].includes(mime))throw new HttpError(415,'Choose a JPG, PNG or WebP image.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'Choose an image.');
 const parts=[];let length=0;
 while(true){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>IMAGE_BYTES){await reader.cancel();throw new HttpError(413,'Keep your image under 3 MB.');}parts.push(value);}
 const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
 const signature=mime==='image/png'?bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10:mime==='image/jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:new TextDecoder().decode(bytes.subarray(0,4))==='RIFF'&&new TextDecoder().decode(bytes.subarray(8,12))==='WEBP';
 if(!signature)throw new HttpError(400,'This file is not a valid JPG, PNG or WebP image.');
 return {bytes,mime,extension:{'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[mime]};
}
