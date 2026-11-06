import type {UsageLimits, GameSettings, DataRecord} from '../../shared/types.js';
export const DEFAULT_LIMITS=Object.freeze({images:200,quizzes:100,results:200,participants:500});
export const MAX_LIMITS=Object.freeze({images:1000000,quizzes:100000,results:1000000,participants:1000000});
export const USAGE_LABELS=Object.freeze({images:'Uploaded images',quizzes:'Saved quizzes',results:'Detailed results',participants:'Participants per quiz'});
export const USAGE_ROLES=Object.freeze(['teacher','professor','other']);
const invalid=message=>{throw Object.assign(new Error(message),{status:400});};
export function usageLimits(value: Partial<UsageLimits>={},minimum: UsageLimits=DEFAULT_LIMITS): UsageLimits{
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!Object.hasOwn(DEFAULT_LIMITS,key)))invalid('Choose valid usage limits.');
 const limits={} as UsageLimits;
 for(const key of Object.keys(DEFAULT_LIMITS)){
  const floor=minimum[key]??DEFAULT_LIMITS[key],number=value[key]??floor;
  if(!Number.isSafeInteger(number)||number<floor||number>MAX_LIMITS[key])invalid(`${USAGE_LABELS[key]} must be between ${floor.toLocaleString('en-US')} and ${MAX_LIMITS[key].toLocaleString('en-US')}.`);
  limits[key]=number;
 }
 return limits;
}
export function usageApplication(body: DataRecord,current: UsageLimits=DEFAULT_LIMITS){
 if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['role','otherRole','message','limits','contact_url_confirm'].includes(key)))invalid('Enter a valid request.');
 if(!USAGE_ROLES.includes(body.role))invalid('Choose your role.');
 const message=typeof body.message==='string'?body.message.trim():'';
 if(!message||message.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(message))invalid('Briefly explain what you need, using up to 1,000 characters.');
 const otherRole=body.role==='other'&&typeof body.otherRole==='string'?body.otherRole.trim():'';
 if(otherRole.length>80||/[\u0000-\u001f\u007f]/.test(otherRole))invalid('Keep your role under 80 characters.');
 if(body.contact_url_confirm!=null&&body.contact_url_confirm!=='')invalid('This request could not be completed. Please try again.');
 return {role:body.role,otherRole,message};
}
export function effectiveParticipants(settings: Partial<GameSettings>={},limit: number=DEFAULT_LIMITS.participants){
 const value=settings?.participantLimit??0;
 if(!Number.isSafeInteger(value)||value<0||value>MAX_LIMITS.participants)invalid('Choose a valid participant limit.');
 return value===0?limit:Math.min(value,limit);
}
export function quotaStatus(row){
 if(!row)return null;
 return {id:row.id,status:row.status,role:row.role,otherRole:row.otherRole||'',message:row.message,limits:row.limits,createdAt:row.createdAt,updatedAt:row.updatedAt,note:row.note||''};
}
