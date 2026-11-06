import type {AppContext} from '../../app/context.js';
import {quizTags} from '../../core/tags.js';
export const QUIZ_SORTS=[['updated','Recently edited'],['newest','Newest first'],['oldest','Oldest first'],['hosted','Recently hosted'],['name','Name']];
export const HOST_FILTERS=[['all','All quizzes'],['hosted','Hosted'],['new','Not hosted yet']];
export const hasQuizFilters=state=>!!(state.filter||(state.quizHostFilter&&state.quizHostFilter!=='all')||(state.quizSort&&state.quizSort!=='updated'));
export function hostedAt(quiz,history={}){return Math.max(Number(history[quiz.id]?.lastHostedAt)||0,Date.parse(quiz.last_hosted_at||'')||0);}
export function visibleQuizzes(quizzes,{tag='',search='',sort='updated',status='all',history={}}={}){
 const key=value=>String(value).normalize('NFKC').toLocaleLowerCase(),query=key(search).trim();
 return quizzes.filter(quiz=>(!tag||quizTags(quiz).some(value=>key(value)===key(tag)))&&(!query||key([quiz.title,quiz.description,...quizTags(quiz)].join(' ')).includes(query))&&(status==='all'||(status==='hosted')===!!hostedAt(quiz,history))).sort((a,b)=>{
  const stamp=(quiz,field)=>Date.parse(quiz[field]||quiz.updated_at||'')||0;
  return (sort==='name'?a.title.localeCompare(b.title):sort==='hosted'?hostedAt(b,history)-hostedAt(a,history):sort==='oldest'?stamp(a,'created_at')-stamp(b,'created_at'):stamp(b,sort==='newest'?'created_at':'updated_at')-stamp(a,sort==='newest'?'created_at':'updated_at'))||a.id.localeCompare(b.id);
 });
}
export function createLibraryFilters(context: AppContext){
 const S=context.state;
 function syncQuizFilters(){const active=hasQuizFilters(S);document.querySelector<HTMLButtonElement>('[data-action=toggle-quiz-filters]')?.classList.toggle('has-filter',active);const clear=document.querySelector<HTMLButtonElement>('[data-action=clear-quiz-filters]');if(clear)clear.disabled=!active;}
 function closeQuizFilters(focus=false){S.quizFiltersOpen=false;const panel=document.querySelector<HTMLElement>('#quiz-filter-panel'),trigger=document.querySelector<HTMLButtonElement>('[data-action=toggle-quiz-filters]');if(panel)panel.hidden=true;trigger?.setAttribute('aria-expanded','false');if(focus)trigger?.focus();}
 function filterChanged(event){const property={'quiz-sort':'quizSort','quiz-host-filter':'quizHostFilter','quiz-tag-filter':'filter'}[(event.target as HTMLElement).id];if(!property)return false;S[property]=(event.target as HTMLInputElement).value;document.querySelector<HTMLElement>('#quiz-list').innerHTML=context.quizCards();syncQuizFilters();return true;}
 return {syncQuizFilters,actions:{
  'toggle-quiz-search':button=>{S.quizSearchOpen=!S.quizSearchOpen;document.querySelector<HTMLInputElement>('#quiz-search-panel').hidden=!S.quizSearchOpen;button.setAttribute('aria-expanded',String(S.quizSearchOpen));if(S.quizSearchOpen)document.querySelector<HTMLInputElement>('#quiz-search').focus();},
  'toggle-quiz-filters':button=>{S.quizFiltersOpen=!S.quizFiltersOpen;document.querySelector<HTMLElement>('#quiz-filter-panel').hidden=!S.quizFiltersOpen;button.setAttribute('aria-expanded',String(S.quizFiltersOpen));},
  'close-quiz-filters':()=>closeQuizFilters(true),
  'clear-quiz-search':()=>{S.search='';document.querySelector<HTMLInputElement>('#quiz-search').value='';document.querySelector<HTMLElement>('#quiz-list').innerHTML=context.quizCards();document.querySelector<HTMLButtonElement>('[data-action=toggle-quiz-search]')?.classList.remove('has-filter');document.querySelector<HTMLInputElement>('#quiz-search').focus();},
  'clear-quiz-filters':()=>{S.filter='';S.quizSort='updated';S.quizHostFilter='all';for(const [id,value]of [['quiz-sort','updated'],['quiz-host-filter','all'],['quiz-tag-filter','']]){const field=document.getElementById(id) as HTMLSelectElement;if(field)field.value=value;}document.querySelector<HTMLElement>('#quiz-list').innerHTML=context.quizCards();syncQuizFilters();document.querySelector<HTMLSelectElement>('#quiz-sort')?.focus();}
 },changes:[filterChanged],clicks:[event=>{if(S.quizFiltersOpen&&!(event.target as HTMLElement).closest('#quiz-filter-panel,[data-action=toggle-quiz-filters]'))closeQuizFilters();}],keys:[event=>{if(event.key!=='Escape'||!S.quizFiltersOpen)return false;event.preventDefault();closeQuizFilters(true);return true;}]};
}
