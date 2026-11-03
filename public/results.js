import {analyze,hasDetails,answerText,correctText,escapeHTML as esc,seconds,typeLabel,reportBase,OPINION_TYPES} from './results-data.js';
import {reportIcon as icon} from './report-icons.js';
import {exportFile,saveBlob,zipFiles} from './results-export.js';
import {overviewPies,renderPieChart,bindPieCharts} from './report-charts.js';
const fmt=n=>n==null?'—':Number(n).toLocaleString(undefined,{maximumFractionDigits:1});
const rate=n=>n==null?'—':n+'%';
const PAGE=25,RESPONSE_PAGE=10;
const defaults={summary:true,participants:true,questions:true,responses:false,correct:true,explanations:true,rounds:true,scores:true,timing:false,charts:false,names:true,theme:'dark',format:'pdf'};
export function mountResults(root,{report,saved=false,onSave,back='#dashboard',onNotice=null,backIcon=icon('back',14),isActive=()=>root.isConnected}){
  const data=analyze(report),state={tab:'overview',responseView:'questions',question:0,student:'',sort:'name',sortDirection:'ascending',roundPage:0,positions:{},search:'',responseSearch:'',page:0,responsePage:0,notice:'',error:false,saved,saving:false,exporting:false,cancel:false,customOpen:false,scope:'whole',pies:{},options:{...defaults}};
  const pies=overviewPies(data);
  const unbindPies=bindPieCharts(root,{models:pies,selections:state.pies,onSelect:(id,key)=>{state.pies[id]=key;}});
  let expiryTimer,lastCardKey='';
  const expired=()=>!state.saved&&Date.now()>=(report.finishedAt||0)+15*60*1000;
  const idLabel=()=>state.student?data.players.find(p=>p.id===state.student)?.name:'';
  function message(text,error=false){
    state.notice=onNotice&&!error?'':text;state.error=error;
    if(onNotice&&!error)onNotice(text,false);
    const status=root.querySelector('#results-status');if(status){status.textContent=state.notice;status.classList.toggle('error-note',error);}
  }
  function table(headers,rows,className='',empty='No matching responses.',caption=''){
    const heading=header=>{
      const {label,sort}=typeof header==='string'?{label:header}:header,active=sort===state.sort;
      return `<th scope="col"${sort?` aria-sort="${active?state.sortDirection:'none'}"`:''}>${sort?`<button class="report-sort" data-result="sort" data-sort="${sort}" aria-label="Sort by ${esc(label)}">${esc(label)}${active?`<span aria-hidden="true">${state.sortDirection==='ascending'?'↑':'↓'}</span>`:''}</button>`:esc(label)}</th>`;
    };
    return `<div class="table-wrap"${className==='analytics-rounds'?' tabindex="0" role="region" aria-label="Scores across rounds"':''}><table class="analytics-table ${className}">${caption?`<caption class="sr-only">${esc(caption)}</caption>`:''}<thead><tr>${headers.map(heading).join('')}</tr></thead><tbody>${rows.join('')||`<tr><td colspan="${headers.length}" class="muted">${esc(empty)}</td></tr>`}</tbody></table></div>`;
  }
  function pager(total,key,size=PAGE){const page=state[key],last=Math.max(0,Math.ceil(total/size)-1);return total>size?`<div class="analytics-pager"><span class="muted">${page*size+1}–${Math.min((page+1)*size,total)} of ${total}</span><div class="row"><button class="btn" data-result="page" data-key="${key}" data-page="${page-1}" ${page===0?'disabled':''}>Previous</button><button class="btn" data-result="page" data-key="${key}" data-page="${page+1}" ${page>=last?'disabled':''}>Next</button></div></div>`:'';}
  function overview(){
    const polls=data.questionStats.filter(q=>!q.graded&&q.q.type!=='slide');
    const chartModels=data.questionStats.some(q=>q.graded)?pies:pies.filter(p=>p.id==='participation');
    return `<section class="analytics-overview" aria-label="Quiz overview"><dl class="analytics-totals"><div><dt>Participants</dt><dd>${fmt(data.players.length)}</dd></div><div><dt>Questions</dt><dd>${fmt(data.questions.length)}</dd></div>${data.questionStats.some(q=>q.graded)?`<div><dt>Average score</dt><dd>${fmt(data.averageScore)} <span>pts</span></dd></div>`:''}<div><dt>Average response</dt><dd>${seconds(data.averageTime)}</dd></div></dl></section><div class="report-chart-grid ${chartModels.length===1?'single-chart':''}">${chartModels.map(model=>renderPieChart(model,state.pies[model.id])).join('')}</div>${polls.length?`<section class="analytics-panel overview-feedback"><h2>Polls & feedback</h2>${polls.slice(0,3).map(item=>`<button class="analytics-review" data-result="question" data-index="${data.questionStats.indexOf(item)}"><span>${esc(item.q.prompt)}</span><strong>${item.answered} <span>responses</span></strong>${icon('next',16)}</button>`).join('')}</section>`:''}<section class="analytics-panel"><div class="analytics-section-head"><h2>${report.settings?.roundsEnabled?'Overall standings':'Participants'}</h2><button class="quiet-button" data-result="all-participants">View all ${icon('next',16)}</button></div>${participantTable(data.participantStats.slice(0,5))}</section>`;
  }
  function participantTable(rows,enhanced=false){
    const headers=enhanced?[{label:'Participant',sort:'name'},{label:'Points',sort:'score'},{label:'Accuracy',sort:'accuracy'},{label:'Responded',sort:'answered'},'View']:['Participant','Points','Accuracy','Responded','View'];
    return table(headers,rows.map(p=>`<tr><td>${enhanced?`<button class="participant-name" data-result="student" data-id="${esc(p.player.id)}">${esc(p.player.name)}</button>`:esc(p.player.name)}<span class="participant-row-meta">Answered ${p.answered} / ${p.eligible}</span></td><td class="numeric">${fmt(p.score)}</td><td class="numeric">${rate(p.accuracy)}</td><td class="numeric">${p.answered} / ${p.eligible}</td><td><button class="quiet-button" data-result="student" data-id="${esc(p.player.id)}" aria-label="View ${esc(p.player.name)} report"><span class="analytics-view-label">View</span>${icon('next',16)}</button></td></tr>`),'analytics-participants'+(enhanced?' enhanced-participants':''),data.players.length?'No participants match your search.':'No participants in this report.','Participant results');
  }
  function questionPicker(){
    if(!data.questions.length)return '';
    return `<div class="report-question-toolbar"><label class="sr-only" for="results-question">Choose a question</label><select id="results-question" class="input">${data.questionStats.map((item,index)=>`<option value="${index}" ${index===state.question?'selected':''}>Question ${item.q.number}</option>`).join('')}</select><div class="question-stepper"><button class="icon-btn" data-result="question" data-index="${state.question-1}" ${state.question===0?'disabled':''} aria-label="Previous question">${icon('back',16)}</button><button class="icon-btn" data-result="question" data-index="${state.question+1}" ${state.question+1>=data.questions.length?'disabled':''} aria-label="Next question">${icon('next',16)}</button></div></div>`;
  }
  function responses(animateCard=false){
    return `<section class="responses-workspace" aria-label="Quiz responses"><div class="responses-toolbar"><div class="response-view-switch" role="group" aria-label="View responses by">${[['questions','Questions'],['participants','Participants']].map(([view,label])=>`<button data-result="response-view" data-view="${view}" aria-pressed="${state.responseView===view}" aria-controls="response-detail">${label}</button>`).join('')}</div></div><div id="response-detail">${state.responseView==='questions'?questionView(animateCard):participants()}</div></section>`;
  }
  function responseKey(){return state.responseView==='questions'?'question:'+state.question:'participant:'+(state.student||'list');}
  function openResponse(update,focus){
    if(state.tab==='responses')state.positions[responseKey()]=window.scrollY;
    update();state.tab='responses';render();
    const tab=root.querySelector('.analytics-tabs'),top=state.positions[responseKey()]??Math.max(0,tab.getBoundingClientRect().top+window.scrollY-12);
    window.scrollTo({top,behavior:'instant'});root.querySelector(focus)?.focus({preventScroll:true});
  }
  function distributionBars(stat){
    if(['order','pin','open_ended'].includes(stat.q.type)||!stat.distribution.length)return '';
    return `<details class="report-disclosure answer-breakdown"><summary>Answer breakdown ${icon('expand',16)}</summary><div>${stat.distribution.map(entry=>`<div class="breakdown-row"><span dir="auto">${esc(entry.label)}</span><strong>${fmt(entry.count)}</strong></div>`).join('')}</div></details>`;
  }
  function answerKey(q){
    if(OPINION_TYPES.has(q.type))return '';
    return `<section class="question-answer-key"><h3>Correct answer</h3>${q.type==='order'?`<ol>${q.correct.map(id=>`<li dir="auto">${esc(answerText(q,id))}</li>`).join('')}</ol>`:`<p dir="auto">${esc(correctText(q))}</p>`}</section>`;
  }
  function questionView(animateCard=false){
    const stat=data.questionStats[state.question];if(!stat)return '<p class="muted">No questions.</p>';
    const q=stat.q,query=state.responseSearch.toLocaleLowerCase(),rows=stat.rows.filter(row=>(row.player.name+' '+answerText(q,row.answer?.answer)+' '+row.status).toLocaleLowerCase().includes(query));
    const details=answerKey(q)+distributionBars(stat)+(q.explanation?`<details class="report-disclosure"><summary>${stat.graded?'Explanation':'Notes'} ${icon('expand',16)}</summary><p dir="auto">${esc(q.explanation)}</p></details>`:'');
    return `<section class="analytics-panel question-report"><article class="question-card${animateCard?' is-entering':''}" aria-labelledby="results-question-title"><div class="question-card-top"><p class="question-context">${esc(typeLabel(q.type))}${stat.round?' · '+esc(stat.round.title):''}</p>${questionPicker()}</div><div class="question-heading"><h2 id="results-question-title" tabindex="-1" dir="auto">${esc(q.prompt)}</h2></div>${q.type!=='slide'?`<dl class="detail-metrics">${stat.graded?`<div><dt>Accuracy</dt><dd>${rate(stat.accuracy)}</dd></div>`:''}<div><dt>Answered</dt><dd>${stat.answered} <span>/ ${stat.eligible}</span></dd></div><div><dt>Average time</dt><dd>${seconds(stat.averageTime)}</dd></div>${stat.averageValue!=null?`<div><dt>Average answer</dt><dd>${fmt(stat.averageValue)}</dd></div>`:''}</dl>`:''}${details?`<div class="question-card-details">${details}</div>`:''}</article>${q.type==='slide'?'':`<section class="question-responses" aria-labelledby="question-participants-title"><div class="analytics-section-head"><h3 id="question-participants-title">Participants <span>${fmt(rows.length)}</span></h3><input class="input analytics-search" id="results-response-search" type="search" placeholder="Search responses…" aria-label="Search responses" value="${esc(state.responseSearch)}"></div>${table(stat.graded?['Participant','Response','Result','Points']:['Participant','Response'],rows.slice(state.responsePage*RESPONSE_PAGE,(state.responsePage+1)*RESPONSE_PAGE).map(row=>`<tr><td><button class="response-participant" data-result="student" data-id="${esc(row.player.id)}" dir="auto">${esc(row.player.name)}</button><span class="response-time">${seconds(row.answer?.elapsed)}${stat.graded?`<span class="mobile-points"> · ${row.answer?.awarded?fmt(row.answer.points):'0'} pts</span>`:''}</span></td><td class="response-value" dir="auto">${esc(row.eligible?answerText(q,row.answer?.answer):'Not present')}</td>${stat.graded?`<td><span class="analytics-outcome ${row.status==='Correct'?'is-correct':row.status==='Incorrect'?'is-incorrect':''}">${esc(row.status)}</span></td><td class="numeric">${row.answer?.awarded?fmt(row.answer.points):'0'}</td>`:''}</tr>`),'question-response-table'+(!stat.graded?' feedback-response-table':''),'No matching responses.','Participant responses')}${pager(rows.length,'responsePage',RESPONSE_PAGE)}</section>`}</section>`;
  }
  function participantAnswer(row){
    const graded=!OPINION_TYPES.has(row.q.type),index=data.questionStats.findIndex(stat=>stat.q.id===row.q.id);
    return `<article class="participant-answer"><div class="participant-answer-heading"><h4><button data-result="question" data-index="${index}" dir="auto">${row.q.number}. ${esc(row.q.prompt)}</button></h4><span class="analytics-outcome ${row.status==='Correct'?'is-correct':row.status==='Incorrect'?'is-incorrect':''}">${esc(row.status)}</span></div><div class="participant-answer-values"><div><span>Response</span><p dir="auto">${esc(row.eligible?answerText(row.q,row.answer?.answer):'Not present')}</p></div>${graded&&row.status!=='Correct'?`<div><span>Correct answer</span><p dir="auto">${esc(correctText(row.q))}</p></div>`:''}</div>${row.q.explanation?`<details class="report-disclosure"><summary>${graded?'Explanation':'Notes'} ${icon('expand',16)}</summary><p dir="auto">${esc(row.q.explanation)}</p></details>`:''}</article>`;
  }
  function participants(){
    if(state.student){
      const p=data.participantStats.find(item=>item.player.id===state.student);if(!p)return '';
      return `<section class="analytics-panel participant-report"><button class="quiet-button participant-back" data-result="all-participants">${icon('back',16)} Participants</button><div class="participant-heading"><h2 tabindex="-1" dir="auto">${esc(p.player.name)}</h2><button class="btn" data-result="student-export">${icon('download',16)} Download</button></div><dl class="detail-metrics"><div><dt>Points</dt><dd>${fmt(p.score)}</dd></div><div><dt>Accuracy</dt><dd>${rate(p.accuracy)}</dd></div><div><dt>Answered</dt><dd>${p.answered} <span>/ ${p.eligible}</span></dd></div></dl><section class="participant-answers">${p.rows.map(participantAnswer).join('')||'<p class="muted">No responses.</p>'}</section></section>`;
    }
    const query=state.search.toLocaleLowerCase(),rows=data.participantStats.filter(p=>p.player.name.toLocaleLowerCase().includes(query));
    rows.sort((a,b)=>{
      const left=state.sort==='name'?a.player.name:a[state.sort],right=state.sort==='name'?b.player.name:b[state.sort];
      if(left==null||right==null)return left==null?(right==null?0:1):-1;
      const diff=typeof left==='string'?left.localeCompare(right,undefined,{numeric:true,sensitivity:'base'}):left-right;
      return (state.sortDirection==='ascending'?diff:-diff)||a.player.name.localeCompare(b.player.name);
    });
    return `<section class="analytics-panel report-participant-list"><div class="participant-heading"><h2 tabindex="-1">Participants <span>${fmt(rows.length)}</span></h2><button class="btn" data-result="batch-export" ${!data.players.length?'disabled':''}>${icon('download',16)} Reports</button></div><input id="results-participant-search" class="input participant-search" type="search" aria-label="Search participants" placeholder="Search participants…" value="${esc(state.search)}"><div id="participant-rows">${participantTable(rows.slice(state.page*PAGE,(state.page+1)*PAGE),true)}${pager(rows.length,'page')}</div></section>`;
  }
  function rounds(){
    const rows=data.participantStats.slice(state.roundPage*PAGE,(state.roundPage+1)*PAGE);
    return `<section class="analytics-panel rounds-report"><h2>Rounds</h2>${report.settings?.roundsEnabled?`${table(['Participant',...(report.settings.rounds||[]).map(r=>r.title),'Total'],rows.map(p=>`<tr><td><button class="participant-name" data-result="student" data-id="${esc(p.player.id)}">${esc(p.player.name)}</button></td>${p.rounds.map(r=>`<td class="numeric">${fmt(r.score)}</td>`).join('')}<td class="numeric">${fmt(p.score)}</td></tr>`),'analytics-rounds','No participants.','Points across rounds')}${pager(data.participantStats.length,'roundPage')}`:'<p class="muted">No rounds.</p>'}</section>`;
  }
  function downloads(){
    const o=state.options,group=(title,keys)=>`<fieldset><legend>${title}</legend>${keys.filter(key=>key!=='rounds'||report.settings?.roundsEnabled).map(key=>{const label={summary:'Overview',participants:'Participants',questions:'Questions',rounds:'Rounds',responses:'Responses',correct:'Correct answers',explanations:'Explanations',scores:'Points',timing:'Times',charts:'Charts',names:'Names'}[key];return `<label><input type="checkbox" data-result-option="${key}" ${o[key]?'checked':''} ${state.exporting?'disabled':''}>${label}</label>`;}).join('')}</fieldset>`;
    return `<section class="analytics-download-page" id="results-downloads"><h2>Download results</h2><div class="analytics-export-controls"><label class="field" for="results-scope"><span>Report</span><select class="input" id="results-scope" ${state.exporting?'disabled':''}><option value="whole" ${state.scope==='whole'?'selected':''}>Quiz report</option><option value="individual" ${state.scope==='individual'?'selected':''} ${!data.players.length?'disabled':''}>Participant reports · ZIP</option>${state.student?`<option value="student" ${state.scope==='student'?'selected':''}>${esc(idLabel())}</option>`:''}</select></label><label class="field" for="results-format"><span>Format</span><select class="input" id="results-format" ${state.exporting?'disabled':''}>${['pdf','html','csv'].map(format=>`<option value="${format}" ${o.format===format?'selected':''}>${format.toUpperCase()}</option>`).join('')}</select></label><button class="btn primary" data-result="export" ${state.exporting?'disabled':''}>${icon('download',16)} ${state.exporting?'Preparing…':'Download'}</button>${state.exporting?'<button class="quiet-button" data-result="cancel-export">Cancel</button>':''}</div><details class="analytics-customize" id="results-export-options" ${state.customOpen?'open':''}><summary>Customize ${icon('expand',16)}</summary><div class="analytics-options">${group('Sections',['summary','participants','questions','rounds'])}${group('Answers',['responses','correct','explanations'])}${group('Details',['scores','timing','charts','names'])}</div></details><p id="results-export-progress" role="status"></p></section>`;
  }
  function render(){
    if(!isActive())return;
    if(expired()){root.innerHTML=`<main class="page analytics"><a class="quiet-button back-link" href="#dashboard">${backIcon} My quizzes</a><h1>Results expired</h1><p class="muted">Saved reports are in My quizzes → Results.</p></main>`;return;}
    // Animate a new question view, never a participant search or table page change.
    const cardKey=state.tab==='responses'&&state.responseView==='questions'?'question-'+state.question:'';
    const animateCard=!!cardKey&&cardKey!==lastCardKey;
    lastCardKey=cardKey;
    const navScroll=root.querySelector('.analytics-tabs')?.scrollLeft||0;
    const remaining=Math.max(0,Math.ceil(((report.finishedAt||0)+900000-Date.now())/60000));
    root.innerHTML=`<main class="page analytics"><a class="quiet-button back-link" href="${esc(back)}">${backIcon} ${back.startsWith('#room')?'Quiz results':'My quizzes'}</a><header class="analytics-heading"><h1 aria-label="${esc('Detailed results: '+report.title)}">${esc(report.title)}</h1>${onSave?`<div class="report-save-action"><button class="btn ${state.saved?'':'primary'} analytics-save-button" data-result="save" ${state.saving?'disabled':''} title="${state.saved?'Update saved report':'Save detailed results'}" aria-label="${state.saved?'Update saved detailed results':'Save detailed results'}">${icon(state.saved?'check':'save',18)} ${state.saving?'Saving…':state.saved?'Saved':'Save report'}</button>${!state.saved?`<span class="report-expiry">Save within ${remaining} min</span>`:''}</div>`:''}</header><div id="results-status" class="analytics-status ${state.error?'error-note':''}" role="status">${esc(state.notice)}</div><nav class="tabs analytics-tabs" aria-label="Report sections">${[['overview','Overview'],['responses','Responses'],['rounds','Rounds'],['downloads','Download results']].map(([id,title])=>`<button class="tab ${state.tab===id?'active':''}" data-result="tab" data-tab="${id}" aria-current="${state.tab===id?'page':'false'}">${title}</button>`).join('')}</nav><div id="results-content">${state.tab==='overview'?overview():state.tab==='responses'?responses(animateCard):state.tab==='rounds'?rounds():downloads()}</div></main>`;
    const nav=root.querySelector('.analytics-tabs'),tab=nav.querySelector(`[data-tab="${state.tab}"]`);
    nav.scrollLeft=navScroll;
    if(tab){const bounds=nav.getBoundingClientRect(),active=tab.getBoundingClientRect();if(active.right>bounds.right)nav.scrollLeft+=active.right-bounds.right;else if(active.left<bounds.left)nav.scrollLeft-=bounds.left-active.left;}
  }
  async function save(){if(!onSave||state.saving)return;if(expired())return render();state.saving=true;render();try{await onSave(report);state.saved=true;message('Report saved.');}catch(e){message(e.message,true);}finally{state.saving=false;render();}}
  async function exportResults(scope){
    if(state.exporting)return;
    const options={...state.options,theme:'dark'};if(!options.summary&&!options.questions&&!options.participants&&!(options.rounds&&report.settings?.roundsEnabled)){message('Choose at least one report section.',true);return;}
    state.exporting=true;state.cancel=false;state.scope=scope;render();
    const progress=text=>{const el=root.querySelector('#results-export-progress');if(el)el.textContent=text;};
    try{
      if(scope==='individual'){
        if(!data.players.length)throw new Error('There are no participants to export.');
        const files=[],folder=reportBase(report)+' - Participant reports';
        for(const [index,p] of data.players.entries()){
          if(state.cancel||!isActive())throw new Error('Download cancelled.');
          progress(`Preparing report ${index+1} of ${data.players.length}…`);
          const file=await exportFile(report,options,p.id);file.name=folder+'/'+String(index+1).padStart(3,'0')+' - '+file.name;files.push(file);
          await new Promise(resolve=>setTimeout(resolve,0));
        }
        if(state.cancel||!isActive())throw new Error('Download cancelled.');
        saveBlob(folder+'.zip',await zipFiles(files));message(`${files.length} participant reports downloaded in one ZIP.`);
      }else{const file=await exportFile(report,options,scope==='student'?state.student:'');if(state.cancel||!isActive())throw new Error('Download cancelled.');saveBlob(file.name,file.blob);message('Report downloaded.');}
    }catch(e){message(e.message,true);}finally{state.exporting=false;if(isActive())render();}
  }
  function onClick(event){
    const target=event.target.closest('[data-result]');if(!target||target.disabled)return;
    event.preventDefault();const action=target.dataset.result;
    if(action==='cancel-export'){state.cancel=true;return;}
    if(action==='tab'){
      if(state.tab==='responses')state.positions[responseKey()]=window.scrollY;
      state.tab=target.dataset.tab;render();root.querySelector(`[data-result="tab"][data-tab="${state.tab}"]`)?.focus({preventScroll:true});
    }
    if(action==='response-view')openResponse(()=>{state.responseView=target.dataset.view;},`[data-view="${target.dataset.view}"]`);
    if(action==='question'){
      const index=Number(target.dataset.index);if(!Number.isInteger(index)||index<0||index>=data.questions.length)return;
      openResponse(()=>{if(index!==state.question){state.question=index;state.responsePage=0;state.responseSearch='';}state.responseView='questions';},'.question-heading h2');
    }
    if(action==='student')openResponse(()=>{state.student=target.dataset.id;if(!state.student&&state.scope==='student')state.scope='whole';state.responseView='participants';},'.participant-heading h2');
    if(action==='all-participants')openResponse(()=>{state.student='';state.responseView='participants';if(state.scope==='student')state.scope='whole';},'.participant-heading h2');
    if(action==='sort'){
      const sort=target.dataset.sort;if(!['name','score','accuracy','answered'].includes(sort))return;
      state.sortDirection=sort===state.sort&&state.sortDirection==='ascending'?'descending':sort===state.sort?'ascending':sort==='name'?'ascending':'descending';
      state.sort=sort;state.page=0;render();root.querySelector(`[data-sort="${sort}"]`)?.focus({preventScroll:true});
    }
    if(action==='clear-participants'){state.search='';state.page=0;render();root.querySelector('#results-participant-search')?.focus({preventScroll:true});}
    if(action==='page'){
      const key=target.dataset.key;if(!['page','responsePage','roundPage'].includes(key))return;
      state[key]=Number(target.dataset.page);render();const section=root.querySelector(key==='page'?'#participant-rows':key==='roundPage'?'.rounds-report':'.question-responses');
      if(section){
        const label=key==='responsePage'?'Responses':key==='roundPage'?'Round scores':'Participants',range=section.querySelector('.analytics-pager>span')?.textContent||'';
        section.tabIndex=-1;section.setAttribute('role','group');section.setAttribute('aria-label',label+' '+range);section.focus({preventScroll:true});section.scrollIntoView({block:'start'});
      }
    }
    if(action==='save')void save();
    if(['downloads','batch-export','student-export'].includes(action)){
      state.scope=action==='batch-export'?'individual':action==='student-export'?'student':'whole';state.options.responses=state.scope!=='whole';state.tab='downloads';render();root.querySelector('[data-tab="downloads"]')?.scrollIntoView({block:'nearest',inline:'nearest'});
      root.querySelector('#results-format').focus({preventScroll:true});
    }
    if(action==='export')void exportResults(root.querySelector('#results-scope').value);
  }
  root.addEventListener('click',onClick);
  function updateInput(event){
    const el=event.target;if(state.exporting)return;if(el.dataset.resultOption){state.options[el.dataset.resultOption]=el.checked;return;}
    if(el.id==='results-format')state.options.format=el.value;
    if(el.id==='results-scope'){state.scope=el.value;state.options.responses=state.scope!=='whole';const checkbox=root.querySelector('[data-result-option=responses]');if(checkbox)checkbox.checked=state.options.responses;}
    if(el.id==='results-question')openResponse(()=>{state.question=Number(el.value);state.responsePage=0;state.responseSearch='';},'#results-question');
    if(['results-participant-search','results-response-search'].includes(el.id)){
      const cursor=el.selectionStart,id=el.id;state[id==='results-participant-search'?'search':'responseSearch']=el.value;state[id==='results-participant-search'?'page':'responsePage']=0;render();const input=root.querySelector('#'+id);input?.focus();input?.setSelectionRange(cursor,cursor);
    }
  }
  function onToggle(event){if(event.target.isConnected&&event.target.id==='results-export-options')state.customOpen=event.target.open;}
  function onInput(event){if(event.target.type==='search')updateInput(event);}
  root.addEventListener('toggle',onToggle,true);root.addEventListener('change',updateInput);root.addEventListener('input',onInput);
  render();expiryTimer=setInterval(()=>{if(!isActive()){clearInterval(expiryTimer);return;}if(expired())render();else{const note=root.querySelector('.report-expiry');if(note)note.textContent=`Save within ${Math.max(0,Math.ceil(((report.finishedAt||0)+900000-Date.now())/60000))} min`;}},1000);
  return ()=>{clearInterval(expiryTimer);unbindPies();state.cancel=true;root.removeEventListener('click',onClick);root.removeEventListener('change',updateInput);root.removeEventListener('input',onInput);root.removeEventListener('toggle',onToggle,true);report=null;};
}
export {hasDetails};
