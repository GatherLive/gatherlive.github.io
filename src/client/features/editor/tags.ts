import type {AppContext} from '../../app/context.js';
import {$,esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import {normalizeTags,quizTags} from '../../core/tags.js';
export function createFeaturesEditorTags(context: AppContext){
 const S=context.state;
 function quizTagEditor(quiz){
  const tags=quizTags(quiz),suggestions=[...new Set(S.quizzes.flatMap(quizTags))].filter(tag=>!tags.some(value=>value.toLocaleLowerCase()===tag.toLocaleLowerCase()));
  return `<div class="quiz-tag-editor"><div id="quiz-tags">${tagChips(tags)}</div><div class="quiz-tag-entry"><input id="quiz-tag-input" class="input" maxlength="80" placeholder="Add a tag" list="quiz-tag-options" autocomplete="off" aria-describedby="quiz-tag-hint"><button type="button" class="btn small" data-action="add-quiz-tag">Add</button></div><datalist id="quiz-tag-options">${suggestions.map(tag=>`<option value="${esc(tag)}">`).join('')}</datalist><span class="hint" id="quiz-tag-hint">Press Enter to add · up to 12 tags</span></div>`;
 }
 function tagChips(tags){return tags.map((tag,index)=>`<span class="quiz-tag editable">${esc(tag)}<button type="button" class="tag-remove" data-action="remove-quiz-tag" data-index="${index}" aria-label="Remove tag ${esc(tag)}">${icon('close',12)}</button></span>`).join('');}
 function commitQuizTag(){
  const input=$('#quiz-tag-input');if(!input?.value.trim()||!S.draft)return;
  const tags=normalizeTags([...quizTags(S.draft),input.value]);
  S.draft.tags=tags;S.draft.settings.tags=tags;S.draft.collection='';context.markDirty();input.value='';$('#quiz-tags').innerHTML=tagChips(tags);
 }
 return {quizTagEditor,commitQuizTag,actions:{
  'add-quiz-tag':()=>{commitQuizTag();$('#quiz-tag-input')?.focus();},
  'remove-quiz-tag':button=>{const tags=quizTags(S.draft);tags.splice(Number(button.dataset.index),1);S.draft.tags=tags;S.draft.settings.tags=tags;S.draft.collection='';context.markDirty();$('#quiz-tags').innerHTML=tagChips(tags);$('#quiz-tag-input')?.focus();}
 },keys:[event=>{if((event.target as HTMLElement).id!=='quiz-tag-input'||event.key!=='Enter'||event.isComposing)return false;event.preventDefault();try{commitQuizTag();}catch(error){context.toast(error.message,true);}return true;}]};
}
