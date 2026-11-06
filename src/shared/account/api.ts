import {HttpError,json,readJson,supabase} from '../http/api.js';
import {usageApplication} from './usage.js';
import {quizTags,normalizeTags} from '../quiz/tags.js';
import {deleteUsageBatch} from './delete.js';
import {validateQuiz} from '../quiz/engine.js';
import {storedImages,savedImageInUse,imageBytes,imageURL,ownedImage,resourceCount,IMAGE_BUCKET} from './storage.js';
const uuid=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const mutate=(rooms,id,work)=>rooms.accountMutation?rooms.accountMutation(id,work):work();
export async function accountUsage(env,rooms,user,token){
 if(rooms.usage)return rooms.usage(user,token);
 try{return await supabase(env,'/rest/v1/rpc/giveaway_account_usage',token,{method:'POST',body:'{}'});}
 catch(error){if(error.databaseCode==='PGRST202'||error.databaseCode==='42883')throw new HttpError(503,'Usage is temporarily unavailable. Please retry later.');throw error;}
}
export async function accountApi(request,env,rooms,user,token){
 const url=new URL(request.url),path=url.pathname,method=request.method;
 if(path==='/api/account/results'&&method==='GET'){
  const page=Number(url.searchParams.get('page')||0),pageSize=25;if(!Number.isSafeInteger(page)||page<0||page>50000)throw new HttpError(400,'Choose a valid results page.');
  const [rows,total]=await Promise.all([supabase(env,'/rest/v1/giveaway_reports?owner_id=eq.'+user.id+'&select=id,quiz_id,quiz_title,room_code,created_at,participantCount:results->participantCount,leaderboard:results->leaderboard,detailVersion:results->detailVersion,firstQuestion:results->questions->0->id&order=created_at.desc,id.desc&limit='+pageSize+'&offset='+page*pageSize,token),resourceCount(env,token,user.id,'allResults')]);
  return json({reports:rows.map(({leaderboard,firstQuestion,detailVersion,...row})=>({...row,participantCount:row.participantCount??(Array.isArray(leaderboard)?leaderboard.length:null),isDetailed:detailVersion===1||firstQuestion!=null})),total,page,pageSize});
 }
 if(path==='/api/account/usage'&&method==='GET')return json(await accountUsage(env,rooms,user,token));
 if(path==='/api/account/usage/delete'&&method==='POST')return mutate(rooms,user.id,()=>deleteUsageBatch(request,env,rooms,user,token));
 if(path==='/api/account/usage/request'&&method==='POST'){
  const current=await accountUsage(env,rooms,user,token);if(current.requestsEnabled===false)throw new HttpError(423,'New requests are paused. Please try again later.');const input=usageApplication(await readJson(request,4096));
  const result=rooms.applyUsage?await rooms.applyUsage(user,input):await supabase(env,'/rest/v1/rpc/giveaway_request_usage',token,{method:'POST',body:JSON.stringify({input})});
  return json({request:result});
 }
 if(path==='/api/account/images'&&method==='GET'){
  const page=Number(url.searchParams.get('page')||0);if(!Number.isSafeInteger(page)||page<0||page>50000)throw new HttpError(400,'Choose a valid image page.');
  const [images,usage]=await Promise.all([storedImages(env,token,user.id,{page}),accountUsage(env,rooms,user,token)]);
  return json({images,total:usage.used.images,page,pageSize:20});
 }
 if(path==='/api/account/images'&&method==='POST'){
  const image=await imageBytes(request);
  return mutate(rooms,user.id,async()=>{
   const usage=await accountUsage(env,rooms,user,token);
   if(usage.used.images>=usage.limits.images)throw new HttpError(409,'Image limit reached. Remove unused images or request a higher limit in Settings → Usage.');
   const name=user.id+'/'+crypto.randomUUID()+'.'+image.extension;
   await supabase(env,'/storage/v1/object/'+IMAGE_BUCKET+'/'+name,token,{method:'POST',headers:{'Content-Type':image.mime,'x-upsert':'false'},body:image.bytes});
   return json({name,url:imageURL(env,name)},201);
  });
 }
 if(path==='/api/account/images'&&method==='DELETE'){
  const {name}=await readJson(request,1024);if(!ownedImage(name,user.id))throw new HttpError(400,'Choose one of your uploaded images.');
  return mutate(rooms,user.id,async()=>{
   if(await savedImageInUse(env,token,user.id,name)||rooms.imageInUse&&await rooms.imageInUse(user.id,imageURL(env,name)))throw new HttpError(409,'This image is used by a saved quiz, result or open room.');
   await supabase(env,'/storage/v1/object/'+IMAGE_BUCKET,token,{method:'DELETE',body:JSON.stringify({prefixes:[name]})});return json({deleted:true});
  });
 }
 if(path==='/api/account/quizzes'&&method==='POST'){
  const raw=await readJson(request,4600000);
  if(!uuid(raw?.id))throw new HttpError(400,'Choose a valid quiz.');
  const quiz=validateQuiz(raw),settings=raw.settings??{};
  if(!settings||typeof settings!=='object'||Array.isArray(settings)||new TextEncoder().encode(JSON.stringify(settings)).length>131072)throw new HttpError(400,'Quiz settings are too large or invalid.');
  if(new TextEncoder().encode(JSON.stringify(raw.questions)).length>4194304)throw new HttpError(413,'Quiz questions are too large.');
  const tags=raw.tags===undefined?quizTags(raw):normalizeTags(raw.tags);
  const payload={id:quiz.id,owner_id:user.id,title:quiz.title,description:quiz.description,collection:'',questions:raw.questions,settings:{...settings,tags}};
  return mutate(rooms,user.id,async()=>{
   const current=await supabase(env,'/rest/v1/giveaway_quizzes?id=eq.'+raw.id+'&owner_id=eq.'+user.id+'&select=id',token);
   if(!current?.length){const usage=await accountUsage(env,rooms,user,token);if(usage.used.quizzes>=usage.limits.quizzes)throw new HttpError(409,'Quiz limit reached. Delete old quizzes or request a higher limit in Settings → Usage.');}
   const rows=await supabase(env,'/rest/v1/giveaway_quizzes?on_conflict=id',token,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});
   return json({quiz:rows?.[0]},current?.length?200:201);
  });
 }
 if(/^\/api\/account\/quizzes\/[a-f0-9-]{36}$/i.test(path)&&method==='DELETE'){
  const id=path.split('/').at(-1);if(!uuid(id))throw new HttpError(400,'Choose a valid quiz.');
  return mutate(rooms,user.id,async()=>{await supabase(env,'/rest/v1/giveaway_quizzes?id=eq.'+id+'&owner_id=eq.'+user.id,token,{method:'DELETE'});return json({deleted:true});});
 }
 throw new HttpError(404,'Endpoint not found.');
}
