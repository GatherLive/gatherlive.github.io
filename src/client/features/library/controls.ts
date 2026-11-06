import {esc} from '../../core/dom.js';
import {icon} from '../../core/icons.js';
import {hasQuizFilters,QUIZ_SORTS,HOST_FILTERS} from './filters.js';

export function libraryControls(state,tags){
 const options=(rows,current)=>rows.map(([value,label])=>`<option value="${esc(value)}" ${value===current?'selected':''}>${esc(label)}</option>`).join('');
 return `<div class="library-tools">
  <button class="quiet-button ${state.search?'has-filter':''}" data-action="toggle-quiz-search" aria-expanded="${!!state.quizSearchOpen}" aria-controls="quiz-search-panel">${icon('search',17)} Search</button>
  <button class="quiet-button ${hasQuizFilters(state)?'has-filter':''}" data-action="toggle-quiz-filters" aria-expanded="${!!state.quizFiltersOpen}" aria-controls="quiz-filter-panel">${icon('filter',17)} Filter</button>
  <button class="quiet-button library-refresh" data-action="refresh-quizzes">Refresh</button>
  <section id="quiz-filter-panel" class="library-filter-panel" aria-label="Quiz filters" ${state.quizFiltersOpen?'':'hidden'}>
   <header><strong>Filter</strong><button class="icon-btn" data-action="close-quiz-filters" aria-label="Close filters">${icon('close',16)}</button></header>
   <div class="library-filter-row"><label for="quiz-sort">Sort by</label><select id="quiz-sort">${options(QUIZ_SORTS,state.quizSort||'updated')}</select></div>
   <div class="library-filter-row"><label for="quiz-host-filter">Hosting</label><select id="quiz-host-filter">${options(HOST_FILTERS,state.quizHostFilter||'all')}</select></div>
   ${tags.length?`<div class="library-filter-row"><label for="quiz-tag-filter">Tag</label><select id="quiz-tag-filter"><option value="">All tags</option>${tags.map(tag=>`<option value="${esc(tag)}" ${tag.toLocaleLowerCase()===(state.filter||'').toLocaleLowerCase()?'selected':''}>${esc(tag)}</option>`).join('')}</select></div>`:''}
   <footer><button class="quiet-button" data-action="clear-quiz-filters" ${hasQuizFilters(state)?'':'disabled'}>Clear filters</button></footer>
  </section>
 </div><div id="quiz-search-panel" class="library-search-panel" ${state.quizSearchOpen?'':'hidden'}><div class="search-field">${icon('search',17)}<input class="input" id="quiz-search" aria-label="Search quizzes" placeholder="Find a quiz…" value="${esc(state.search||'')}"><button class="icon-btn" data-action="clear-quiz-search" aria-label="Clear search">${icon('close',15)}</button></div></div>`;
}

export function libraryFooter(){
 return `<footer class="library-footer" aria-label="Quiz tools"><button data-action="sample">Sample quiz</button><label class="file-label">Import quiz<input type="file" accept="application/json,.json" id="import-quiz" aria-label="Import quiz"></label><button data-action="copy-ai-prompt">Copy AI prompt</button></footer>`;
}
