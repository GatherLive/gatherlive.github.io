import type {AppContext} from '../../app/context.js';
import {$,esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import {accountSettings} from './account.js';
import {aboutSettings} from './about.js';
import {usageSettings,imageList,DELETE_RESOURCES} from './usage.js';
import {releaseArchive} from './changelog.js';
import {usageApplication} from '../../core/usage.js';
import {settingsDestination,settingsBackLabel} from './navigation.js';
import {pageHeading} from '../../core/navigation.js';
export function createFeaturesSettings(context: AppContext){
 const S=context.state;let generation=0,imagePage=0,olderCount=5,usageTimer;
 const current=owner=>context.activeUser()?.id===owner&&location.hash.split('?')[0]==='#settings/usage';
 function settingsView(area=''){
  const owner=context.activeUser()?.id,version=++generation;
  if(!S.settingsReturn)try{S.settingsReturn=settingsDestination(sessionStorage.getItem('gather.settings.return'));}catch{S.settingsReturn='#';}
  if(S.usageOwner!==owner){S.usageOwner=owner;S.accountUsage=null;S.usageImages=[];imagePage=0;}
  S.disposeSettings=()=>{clearTimeout(usageTimer);generation++;S.cancelUsageDelete?.();S.cancelUsageDelete=null;};
  const fromLearn=S.section==='learn',returnTo=fromLearn?(/^#learn(?:\/[a-z-]+)*$/.test(S.learnReturn||'')?S.learnReturn:'#learn'):(S.settingsReturn||'#'),back=area?'#settings':returnTo;
  const headings={account:'Account settings',usage:'Usage',about:'About Gather'},heading=headings[area]||'Settings';
  let content;
  if(area==='account')content=accountSettings(context);
  else if(area==='about')content=aboutSettings();
  else if(area==='usage')content=`<div id="usage-content">${usageSettings(S.accountUsage)}</div>`;
  else content=`<section class="settings-group settings-menu">${[['account','Account settings','Password, room chat and account access','users'],['usage','Usage','Limits and saved data','usage'],['about','About Gather','Version, contact and legal','info']].map(([key,title,detail,symbol])=>`<a class="settings-link" href="#settings/${key}">${icon(symbol,21)}<span><strong>${title}</strong><small>${detail}</small></span>${icon('chevron',18)}</a>`).join('')}<a class="settings-link" href="https://buymeacoffee.com/gatherlive" target="_blank" rel="noopener noreferrer">${icon('coffee',21)}<span><strong>Buy me a coffee</strong><small>Support Gather</small></span>${icon('arrow',18)}</a></section>`;
  const refresh=area==='usage'?`<button class="quiet-button usage-refresh" data-action="refresh-usage" data-refresh-pending="Updating" aria-label="Refresh usage" aria-live="polite">${icon('refresh',17)}<span>Refresh</span></button>`:'';
  context.shell(`<main class="page settings-page" data-ui="settings"><header class="settings-heading" data-area="${area||'general'}">${pageHeading(heading,{href:back,backLabel:area?'Settings':settingsBackLabel(returnTo),action:refresh})}</header>${content}</main>`);
  $('.settings-heading h1')?.focus({preventScroll:true});
  if(area==='about'){olderCount=5;$('#older-releases')?.addEventListener('toggle',event=>{if((event.currentTarget as HTMLDetailsElement).open&&!$('#release-archive').childElementCount)$('#release-archive').innerHTML=releaseArchive(olderCount);});}
  if(area==='account')void context.loadAccountChat();
  if(area==='usage'){bindImages();void refreshUsage(version);}
 }
 function bindImages(){const details=$<HTMLDetailsElement>('#uploaded-images');if(details)details.addEventListener('toggle',()=>{if(details.open)void loadImages();});}
 async function refreshUsage(version=generation){
  const owner=context.activeUser()?.id;if(!owner)return;
  try{
   const data=await context.backend('/api/account/usage',null,'GET');
   if(version!==generation||!current(owner))return;
   S.accountUsage=data;$('#usage-content').innerHTML=usageSettings(data);bindImages();clearTimeout(usageTimer);if(data.request?.status==='pending'){const poll=()=>{if(version!==generation||!current(owner))return;if(!document.hidden&&!document.activeElement?.matches('input,textarea,select')&&!$('#modal-root')?.childElementCount)void refreshUsage(version);else usageTimer=setTimeout(poll,20000);};usageTimer=setTimeout(poll,20000);}
  }catch(error){if(version===generation&&current(owner)&&$('#usage-content'))$('#usage-content').innerHTML=usageSettings(null,error.message);return false;}
 }
 async function loadImages(){
  const version=generation,owner=context.activeUser()?.id,target=$('#usage-images');if(!target||!owner)return;
  target.innerHTML='<p class="settings-load" role="status"><span class="spinner" aria-hidden="true"></span>Loading images…</p>';
  try{const data=await context.backend('/api/account/images?page='+imagePage,null,'GET');if(version!==generation||!current(owner)||!target.isConnected)return;S.usageImages=data.images;target.innerHTML=imageList(data);}
  catch(error){if(target.isConnected)target.innerHTML=`<p class="error-note">${esc(error.message)}</p><button class="quiet-button" data-action="reload-usage-images">Try again</button>`;}
 }
 function confirmDelete(resource){
  const item=DELETE_RESOURCES[resource],count=S.accountUsage?.used?.[resource];if(!item||!count)return;
  context.modal(item.title+'?',`<p>${esc(item.description)}</p><p class="settings-delete-count">${count.toLocaleString()} ${item.noun}</p><div class="field"><label for="usage-delete-confirm">Type DELETE to confirm</label><input class="input" id="usage-delete-confirm" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="DELETE"></div><p id="usage-delete-status" role="status"></p>`,`<button class="btn danger" id="confirm-usage-delete" data-action="confirm-usage-delete" data-resource="${resource}" disabled>${item.title}</button>`);
 }
 async function deleteAll(resource){
  if($('#usage-delete-confirm')?.value!=='DELETE'||!DELETE_RESOURCES[resource])return;
  const owner=context.activeUser()?.id,controller=new AbortController();let cancelled=false,before=$('#confirm-usage-delete')?.dataset.before,removed=Number($('#confirm-usage-delete')?.dataset.removed||0);
  S.cancelUsageDelete=()=>{cancelled=true;controller.abort();};
  $('#usage-delete-confirm').disabled=true;const button=$('#confirm-usage-delete');button.disabled=true;
  try{
   for(let batch=0;batch<50000;batch++){
    if(cancelled||context.activeUser()?.id!==owner||!button.isConnected)return;
    const result=await context.backend('/api/account/usage/delete',{resource,confirmation:'DELETE',...(before?{before}:{})},'POST',true,{signal:controller.signal});
    if(cancelled||context.activeUser()?.id!==owner||!button.isConnected)return;
    before=result.before;removed+=result.deleted;button.dataset.before=before;button.dataset.removed=String(removed);if($('#usage-delete-status'))$('#usage-delete-status').textContent=`${removed.toLocaleString()} deleted…`;
    if(result.done){
     S.cancelUsageDelete=null;
     if(resource==='quizzes'){if(S.draft?.created_at||S.quizzes.some(quiz=>quiz.id===S.draft?.id)){S.draft=null;S.dirty=false;}S.quizzes=[];}
     if(resource==='results'){S.reports=S.reports.filter(report=>!report.isDetailed&&!(report.results?.questions&&report.results?.players));S.reportTotal=null;S.reportPage=0;}
     context.closeModal();imagePage=0;await refreshUsage();context.toast(`${removed.toLocaleString()} ${DELETE_RESOURCES[resource].noun} deleted.`);return;
    }
    if(!result.deleted)throw new Error('Deletion stopped. Refresh Usage to see what remains.');
   }
   throw new Error('Deletion paused. Refresh Usage to continue.');
  }catch(error){
   if(cancelled)return;
   if($('#usage-delete-status'))$('#usage-delete-status').textContent=error.message+' Refresh Usage to see what remains.';
   button.disabled=false;if($('#usage-delete-confirm'))$('#usage-delete-confirm').disabled=false;
  }finally{if(!cancelled)S.cancelUsageDelete=null;}
 }
 async function removeImage(button){
  const image=S.usageImages?.find(row=>row.name===button.dataset.name);if(!image)return;
  if(S.draft?.owner_id===context.activeUser()?.id&&S.draft.questions.some(q=>q.image===image.url||q.options?.some(option=>option.image===image.url))){context.toast('This image is used by your quiz draft. Remove it there first.',true);return;}
  context.modal('Remove this image?','<p>The uploaded image will be permanently removed. Images used by quizzes, results or open rooms cannot be removed individually.</p>',`<button class="btn danger" data-action="confirm-remove-usage-image" data-name="${esc(image.name)}">Remove image</button>`);
 }
 return {settingsView,refreshUsage,actions:{
  'refresh-usage':()=>refreshUsage(),
  'older-releases-more':()=>{olderCount+=5;$('#release-archive').innerHTML=releaseArchive(olderCount);},
  'usage-delete':button=>confirmDelete(button.dataset.resource),
  'confirm-usage-delete':button=>deleteAll(button.dataset.resource),
  'reload-usage-images':loadImages,
  'usage-image-page':button=>{imagePage=Math.max(0,Number(button.dataset.page));return loadImages();},
  'remove-usage-image':removeImage,
  'confirm-remove-usage-image':async button=>{const owner=context.activeUser()?.id;await context.backend('/api/account/images',{name:button.dataset.name},'DELETE');if(!current(owner)||!button.isConnected)return;context.closeModal();await refreshUsage();const details=$<HTMLDetailsElement>('#uploaded-images');if(details)details.open=true;context.toast('Image removed.');}
 },forms:{'usage-request-form':{submit:async form=>{
  const input=usageApplication({role:$('#usage-role').value,otherRole:$('#usage-other-role').value,message:$('#usage-message').value,contact_url_confirm:form.querySelector('[name=contact_url_confirm]')?.value||''});
  const owner=context.activeUser()?.id;await context.backend('/api/account/usage/request',input);if(!current(owner)||!form.isConnected)return;await refreshUsage();context.toast('Request sent.');
 },errorTarget:'#usage-request-error'}},inputs:[event=>{
  if((event.target as HTMLElement).id!=='usage-delete-confirm')return false;
  const button=$('#confirm-usage-delete');if(button)button.disabled=(event.target as HTMLInputElement).value!=='DELETE';return true;
 }],changes:[event=>{if((event.target as HTMLElement).id!=='usage-role')return false;$('#usage-other-role-field').hidden=(event.target as HTMLInputElement).value!=='other';return true;}],keys:[event=>{if((event.target as HTMLElement).id!=='usage-delete-confirm'||event.key!=='Enter')return false;event.preventDefault();$('#confirm-usage-delete:not(:disabled)')?.click();return true;}]};
}
