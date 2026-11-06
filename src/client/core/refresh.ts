import {icon} from './icons.js';
import {esc} from './dom.js';
const feedbackState=new WeakMap();
function remember(button){if(!feedbackState.has(button))feedbackState.set(button,{html:button.innerHTML,version:0});return feedbackState.get(button);}
export async function refreshFeedback(button,work){
 const action=button.dataset.action,route=location.hash,started=Date.now();
 const pending=element=>{remember(element).version++;element.disabled=true;element.setAttribute('aria-busy','true');element.classList.remove('refresh-complete');element.classList.add('refresh-feedback');element.innerHTML=`<span class="spinner" aria-hidden="true"></span><span>${esc(element.dataset.refreshPending||'Refreshing…')}</span>`;};
 pending(button);
 let success=false;
 try{success=(await work())!==false;return success;}
 finally{
  const current=location.hash===route?(button.isConnected?button:document.querySelector<HTMLElement>(`[data-action="${action}"]`)):null;
  if(current&&current!==button)pending(current);
  const state=current?remember(current):null,version=state?.version;
  await new Promise(resolve=>setTimeout(resolve,Math.max(0,400-(Date.now()-started))));
  if(location.hash===route&&current?.isConnected){
   current.disabled=false;current.removeAttribute('aria-busy');current.classList.remove('refresh-feedback');
   if(success){current.innerHTML=`${icon('check',16)}<span>Updated</span>`;current.classList.add('refresh-complete');setTimeout(()=>{if(current.isConnected&&state.version===version){current.innerHTML=state.html;current.classList.remove('refresh-complete');}},1100);}
   else current.innerHTML=state.html;
  }
 }
}
