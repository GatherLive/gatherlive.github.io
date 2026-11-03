// Shared validation for public announcements and private chat applications.
export const SITE_CONTROL_REGISTRY='site-control:v1';
export const REQUEST_RETRY_MS=7*86400000;
export const REQUEST_PENDING_MS=90*86400000;
export const REQUEST_REVIEWED_MS=30*86400000;
export const validOwnerKey=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
export const validAccountId=value=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export function announcementInput(value,now=Date.now()){
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Enter an announcement.');
  const clean=(text,max,label)=>{
    if(typeof text!=='string'||!text.trim()||text.length>max||/[\u0000-\u001f\u007f]/u.test(text))fail(`${label} must be 1–${max} characters.`);
    return text.trim();
  };
  const badge=clean(value.badge??'News',24,'Badge'),headline=clean(value.headline,200,'Headline');
  const rawURL=clean(value.url,2048,'Link');let url;
  try{url=new URL(rawURL);}catch{fail('Enter a complete https:// or http:// link.');}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password)fail('Use an https:// or http:// link without sign-in details.');
  const expiresAt=value.expiresAt??null;
  if(expiresAt!==null&&(!Number.isSafeInteger(expiresAt)||expiresAt<=now||expiresAt>now+366*86400000))fail('Choose an expiry within the next year, or no expiry.');
  return {badge,headline,url:url.href,expiresAt};
}
export function applicationInput(ownerKey,user){
  if(!validOwnerKey(ownerKey)||!validAccountId(user?.id)||typeof user.email!=='string'||user.email.length>320||!user.email.includes('@'))fail('Please sign in again.',401);
  return {ownerKey,userId:user.id,email:user.email};
}
export function applicationStatus(row,now=Date.now()){
  if(!row)return null;
  return {status:row.status,createdAt:row.createdAt,updatedAt:row.updatedAt,...(row.status==='declined'?{retryAt:row.updatedAt+REQUEST_RETRY_MS}:{})};
}
export function nextApplication(previous,input,now=Date.now()){
  if(previous?.status==='pending')return previous;
  if(previous?.status==='declined'&&previous.updatedAt+REQUEST_RETRY_MS>now)fail('You can apply again seven days after a declined request.',429);
  return {...input,id:crypto.randomUUID(),status:'pending',createdAt:now,updatedAt:now};
}
export function applicationExpired(row,now=Date.now()){
  return row.updatedAt+(row.status==='pending'?REQUEST_PENDING_MS:REQUEST_REVIEWED_MS)<=now;
}
