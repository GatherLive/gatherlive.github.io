import {HttpError,supabase} from '../http/api.js';
import {accountUsage} from './api.js';
const detailed=results=>Array.isArray(results?.questions)&&Array.isArray(results?.players);
export async function saveAccountReport(env,rooms,user,token,report,body){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new HttpError(400,'Choose a valid result format.');
 if(body.detailed!=null&&typeof body.detailed!=='boolean')throw new HttpError(400,'Choose a valid result format.');
 if(body.reportId!=null&&body.reportId!==report.id)throw new HttpError(409,'This room changed. Refresh the results.');
 const work=async()=>{
  const previous=await supabase(env,'/rest/v1/giveaway_reports?id=eq.'+report.id+'&owner_id=eq.'+user.id+'&select=results',token);
  let results=report.results;
  if(body.detailed!==true){
   const {players,questions,questionTimings,detailVersion,...summary}=results;
   results=detailed(previous?.[0]?.results)?{...previous[0].results,...summary}:summary;
  }
  if(detailed(results)&&!detailed(previous?.[0]?.results)){
   const usage=await accountUsage(env,rooms,user,token);
   if(usage.used.results>=usage.limits.results)throw new HttpError(409,'Detailed results limit reached. Delete old results or request a higher limit in Settings → Usage.');
  }
  const quizzes=report.quizId?await supabase(env,'/rest/v1/giveaway_quizzes?id=eq.'+report.quizId+'&select=id',token):[];
  const payload={id:report.id,owner_id:user.id,quiz_id:quizzes[0]?.id||null,room_code:report.code,quiz_title:report.title,results};
  const save=()=>supabase(env,'/rest/v1/giveaway_reports?on_conflict=id',token,{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(payload)});
  let rows;try{rows=await save();}catch(error){if(error.databaseCode!=='23503'||!payload.quiz_id)throw error;payload.quiz_id=null;rows=await save();}
  return {report:rows?.[0]||{id:report.id}};
 };
 return rooms.accountMutation?rooms.accountMutation(user.id,work):work();
}
