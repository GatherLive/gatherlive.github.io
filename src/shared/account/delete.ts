import {HttpError,json,readJson,supabase} from '../http/api.js';
import {IMAGE_BUCKET,storedImages,ownedImage} from './storage.js';
export async function deleteUsageBatch(request,env,rooms,user,token){
 const body=await readJson(request,1024);
 if(!body||!['quizzes','images','results'].includes(body.resource)||body.confirmation!=='DELETE'||Object.keys(body).some(key=>!['resource','confirmation','before'].includes(key)))throw new HttpError(400,'Type DELETE to confirm what you want to remove.');
 const before=body.before===undefined?new Date().toISOString():body.before,cutoff=Date.parse(before);
 if(typeof before!=='string'||!Number.isFinite(cutoff)||cutoff>Date.now()+1000||cutoff<0)throw new HttpError(400,'Refresh Usage before trying again.');
 const resource=body.resource;let deleted=0,done=false;
 if(resource==='images'){
  if((await rooms.list(user.id)).some(room=>room.phase!=='finished'))throw new HttpError(409,'Close your open quiz rooms before deleting all images.');
  const items=await storedImages(env,token,user.id,{page:0,oldest:true});
  const batch=items.filter(image=>Date.parse(image.createdAt)<=cutoff);
  if(batch.some(image=>!ownedImage(image.name,user.id)))throw new HttpError(400,'An image could not be removed safely.');
  if(batch.length){await supabase(env,'/storage/v1/object/'+IMAGE_BUCKET,token,{method:'DELETE',body:JSON.stringify({prefixes:batch.map(image=>image.name)})});deleted=batch.length;}
  done=batch.length<20;
 }else{
  const table=resource==='quizzes'?'giveaway_quizzes':'giveaway_reports';
  const query=new URLSearchParams({owner_id:'eq.'+user.id,created_at:'lte.'+before,select:'id',order:'id',limit:'50'});
  if(resource==='results'){query.set('results->questions','cs.[]');query.set('results->players','cs.[]');}
  const batch=await supabase(env,'/rest/v1/'+table+'?'+query,token);
  if(!Array.isArray(batch))throw new HttpError(503,'Saved data could not be loaded. Please retry.');
  if(batch.length){
   if(!batch.every(row=>typeof row.id==='string'&&/^[a-f0-9-]{36}$/i.test(row.id)))throw new HttpError(503,'Saved data could not be removed safely.');
   const filter=new URLSearchParams({owner_id:'eq.'+user.id,id:'in.('+batch.map(row=>row.id).join(',')+')'});
   await supabase(env,'/rest/v1/'+table+'?'+filter,token,{method:'DELETE'});deleted=batch.length;
  }
  done=batch.length<50;
 }
 return json({resource,deleted,done,before});
}
