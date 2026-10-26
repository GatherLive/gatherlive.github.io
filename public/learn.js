import {createProgressStore, recordAnswer, progressStats} from './learn-progress.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const REGIONS = ['World','Africa','Americas','Asia','Europe','Oceania'];
const TOPICS = {flags:{name:'Flags',noun:'flag',question:'Which country does this flag belong to?',color:'lavender'},capitals:{name:'Capitals',noun:'capital',question:'What is the capital?',color:'green'},map:{name:'On the map',noun:'country',question:'Which country is highlighted?',color:'sand'}};
const assetURL = path => { const url=new URL(path,import.meta.url);url.search=new URL(import.meta.url).search;return url.href; };
const localURL = path => assetURL(`./learn-data/${path}`);
let stylesheetPromise;
function loadStyles(){if(!stylesheetPromise)stylesheetPromise=new Promise((resolve,reject)=>{const href=assetURL('./learn.css');const existing=document.querySelector('link[data-gather-learn]');if(existing?.sheet){resolve();return;}const link=existing||document.createElement('link');link.rel='stylesheet';link.href=href;link.dataset.gatherLearn='';link.onload=resolve;link.onerror=()=>{stylesheetPromise=null;link.remove();reject(Error('Learning styles unavailable.'));};if(!existing)document.head.append(link);});return stylesheetPromise;}
const flagURL = code => localURL(`flags/${code}.svg`);
const flag = (country, extra='') => `<img class="learn-flag ${extra}" src="${flagURL(country.code)}" alt="${esc(country.name)} flag" loading="lazy" decoding="async" width="180" height="120">`;
// Material-style filled symbols; rendered locally with the existing icon licence.
const symbol = (name,size=24) => {
  const paths={book:'M480-180q-61-40-132-60t-148-20q-36 0-71 4.5T60-240v-560q34-11 69-15.5t71-4.5q77 0 148 20t132 60q61-40 132-60t148-20q36 0 71 4.5t69 15.5v560q-34-11-69-15.5t-71-4.5q-77 0-148 20T480-180Zm-40-116v-374q-50-30-111-45t-129-15q-16 0-30 .5t-30 3.5v386q16-2 30-3t30-1q68 0 129 12t111 36Zm80 0q50-24 111-36t129-12q16 0 30 1t30 3v-386q-16-3-30-3.5t-30-.5q-68 0-129 15t-111 45v374Z',flag:'M200-80v-760h360l16 80h224v440H520l-16-80H280v320h-80Zm80-400h290l16 80h134v-280H510l-16-80H280v280Z',map:'m600-120-240-84-186 72q-20 8-37-4t-17-33v-560q0-13 7.5-23t19.5-15l213-73 240 84 186-72q20-8 37 4t17 33v560q0 13-7.5 23T813-193l-213 73Zm-40-98v-488l-160-56v488l160 56Zm80-6 120-42v-440l-120 46v436Zm-440 0 120-46v-436l-120 42v440Z',check:'M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z',review:'M480-80q-123 0-222-67T113-324l75-28q35 86 113 139t179 53q134 0 227-93t93-227q0-134-93-227t-227-93q-83 0-155 39t-118 105h113v80H80v-240h80v112q57-82 142-129t178-47q83 0 156 31.5t127 85.5q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm112-232L440-464v-216h80v184l128 128-56 56Z',spark:'m480-40-84-276-276-84 276-84 84-276 84 276 276 84-276 84-84 276Z'};
  return `<svg width="${size}" height="${size}" viewBox="0 -960 960 960" fill="currentColor" aria-hidden="true"><path d="${paths[name]||paths.book}"/></svg>`;
};
function shuffle(list) { const out=[...list];for(let i=out.length-1;i>0;i--){const bytes=new Uint32Array(1);crypto.getRandomValues(bytes);const j=bytes[0]%(i+1);[out[i],out[j]]=[out[j],out[i]];}return out; }
const normalize = text => String(text??'').normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase('en').replace(/&/g,' and ').replace(/[^\p{L}\p{N}]/gu,'').trim();
const countryAnswers = country => [country.name,country.code,...(country.aliases||[])];
const capitalAnswers = country => [...(country.capital||[]),...(country.capitalAliases||[])];
const capitalLabel = country => (country.capital||[]).join(' / ');
const capitalFactLabel = country => country.code==='nr'?'Seat of government':country.code==='ch'?'Federal city':country.code==='bo'?'Capital / seat of government':country.capital.length>1?'Capitals':'Capital';
const capitalQuestion = (country, answerMode) => country.code==='bo'&&answerMode==='choice'?'Which option names Bolivia’s constitutional capital and seat of government?':country.capitalQuestion||(country.capital.length>1?(answerMode==='type'?`Name a capital of ${country.name}.`:`Which are the capitals of ${country.name}?`):`What is the capital of ${country.name}?`);
const matchAnswer = (country,topic,text) => (topic==='capitals'?capitalAnswers(country):countryAnswers(country)).some(answer=>normalize(answer)===normalize(text));
const shortDate = value => new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(new Date(value));

export function createLearning({shell,icon,session,signIn,loadCloud,saveCloud,resetCloud,notify}) {
  let libraryInfo={},countries=[], countryByCode=new Map(), mapData=null, dataPromise, active=false, routeParts=[], topic='flags', mode='explore', region='World', answerMode='choice', count=10, search='', shown=24, selectedCountry='', current=null, lastFinished=null, cleanups=[], pending=false, shownReviewCount=-1;
  const store=createProgressStore({session,loadCloud,saveCloud,resetCloud,notify,changed:()=>{if(active)updateProgressUI();}});
  const back = (href='#learn',label='Learn') => `<a class="quiet-button learn-back" href="${href}">${icon?.('back',16)||'←'} ${label}</a>`;
  const beta = '<span class="learn-beta">beta</span>';
  const signedIn = () => !!(session?.()?.user?.id || session?.()?.id);
  const filtered = () => countries.filter(country=>region==='World'||country.region===region);
  async function loadData() {
    if(!dataPromise) dataPromise=Promise.all([fetch(localURL('countries.json')).then(r=>{if(!r.ok)throw Error('Learning library unavailable.');return r.json();}),fetch(localURL('world.json')).then(r=>{if(!r.ok)throw Error('Map unavailable.');return r.json();})]).then(([data,world])=>{libraryInfo=data;countries=data.countries||data;if(!Array.isArray(countries)||!countries.length)throw Error('Learning library unavailable.');countryByCode=new Map(countries.map(country=>[country.code,country]));mapData=world;return data;}).catch(error=>{dataPromise=null;throw error;});
    return dataPromise;
  }
  function disposeListeners(){for(const cleanup of cleanups)cleanup();cleanups=[];}
  function on(element,name,fn,options){if(!element)return;element.addEventListener(name,fn,options);cleanups.push(()=>element.removeEventListener(name,fn,options));}
  function frame(content,className='') {
    disposeListeners();shell(`<main id="learn-root" class="learn-page ${className}">${content}</main>`);const root=document.getElementById('learn-root');
    on(root,'click',handleClick);on(root,'change',handleChange);on(root,'input',handleInput);on(root,'submit',handleSubmit);on(root,'keydown',handleKeydown);updateProgressUI();
  }
  function progressBar() { return `<div class="learn-save-row"><span id="learn-save-state"></span><span id="learn-save-action"></span></div>`; }
  function updateProgressUI() {
    const state=document.getElementById('learn-save-state'),action=document.getElementById('learn-save-action');if(!state||!action)return;
    state.textContent=store.enabled?({loading:'Connecting…',saving:'Saving…',pending:'Saved on this device',saved:'Synced to your account',error:'Saved on this device · sync paused'}[store.state]||'Saved on this device'):'Progress stays on this device';
    const stats=progressStats(store.value),statNodes=document.querySelectorAll('.learn-stat-strip strong');if(statNodes.length===3){statNodes[0].textContent=stats.practised;statNodes[1].textContent=stats.learned;statNodes[2].textContent=stats.answers?stats.accuracy+'%':'—';}
    const due=reviewEntries().length,reviewLabel=document.querySelector('.learn-review-link small');if(reviewLabel)reviewLabel.textContent=due?`${due} ready to revisit`:'Keep what you learn';
    if(document.querySelector('.learn-review-page')&&!current&&shownReviewCount!==due){reviewView();return;}
    action.innerHTML=!signedIn()?'<button class="quiet-button" data-learn-action="signin">Sign in to sync</button>':!store.enabled?'<button class="quiet-button" data-learn-action="sync-enable">Enable account sync</button>':store.state==='error'?'<button class="quiet-button" data-learn-action="sync-retry">Retry sync</button>':'<button class="quiet-button" data-learn-action="sync-disable">Pause sync</button>';
  }
  const topicIcon = name => symbol(name==='flags'?'flag':name==='capitals'?'book':'map',28);
  function homeView() {
    const stats=progressStats(store.value),due=reviewEntries().length;
    frame(`${back('#','Home')}<header class="learn-heading"><div class="learn-title-line"><h1>Learn</h1>${beta}</div><p>A world to discover. At your own pace.</p></header><section class="learn-topic-grid" aria-label="Learning topics">${Object.entries(TOPICS).map(([key,value])=>`<a href="#learn/${key}" class="learn-topic-card learn-${value.color}"><span class="learn-topic-icon">${topicIcon(key)}</span><span class="learn-card-arrow" aria-hidden="true">↗</span><h2>${value.name}</h2><p>${key==='flags'?'Recognise every flag.':key==='capitals'?'Connect countries and capitals.':'Find your way around the world.'}</p><div class="learn-topic-art" aria-hidden="true">${key==='flags'?'<img src="'+flagURL('jp')+'" alt="" width="80" height="54"><img src="'+flagURL('br')+'" alt="" width="80" height="54"><img src="'+flagURL('za')+'" alt="" width="80" height="54">':key==='capitals'?'<span>Paris</span><span>Tokyo</span><span>Nairobi</span>':symbol('map',82)}</div></a>`).join('')}</section><div class="learn-overview"><section class="learn-stat-strip" aria-label="Your learning progress"><div><strong>${stats.practised}</strong><span>Practised</span></div><div><strong>${stats.learned}</strong><span>Remembered</span></div><div><strong>${stats.answers?stats.accuracy+'%':'—'}</strong><span>Accuracy</span></div></section><a class="learn-review-link" href="#learn/review"><span class="learn-review-mark">${symbol('review',25)}</span><span><strong>Review</strong><small>${due?`${due} ready to revisit`:'Keep what you learn'}</small></span>${icon?.('arrow',19)||'↗'}</a></div>${progressBar()}<footer class="learn-footer"><a href="#learn/sources">Sources &amp; learning notes</a><button class="quiet-button" data-learn-action="reset">Reset progress</button></footer>`);
  }
  function regionSelect() { return `<label class="learn-filter-label"><span class="learn-sr">Region</span><select class="learn-select" id="learn-region" aria-label="Region">${REGIONS.map(name=>`<option${name===region?' selected':''}>${name}</option>`).join('')}</select></label>`; }
  function topicView() {
    const info=TOPICS[topic],pool=filtered();
    frame(`${back()}<header class="learn-heading learn-topic-heading"><div class="learn-title-line"><h1>${info.name}</h1>${beta}</div>${regionSelect()}</header><div class="learn-tabs" role="tablist" aria-label="Learning mode">${[['explore','Explore'],['practice','Practise'],['test','Test']].map(([key,label])=>`<button role="tab" id="learn-tab-${key}" aria-controls="learn-mode-panel" tabindex="${mode===key?0:-1}" aria-selected="${mode===key}" class="learn-tab${mode===key?' learn-active':''}" data-learn-action="mode" data-mode="${key}">${label}</button>`).join('')}</div><section id="learn-mode-panel" role="tabpanel" aria-labelledby="learn-tab-${mode}">${mode==='explore'?exploreContent(pool):setupContent(pool)}</section>${progressBar()}`);
  }
  function exploreContent(pool) {
    if(topic==='map'){
      const country=countryByCode.get(selectedCountry)||pool[0];if(!country)return '<p>No countries in this region.</p>';selectedCountry=country.code;
      return `<section class="learn-atlas"><div class="learn-atlas-selector"><label for="learn-country">Explore a country</label><select id="learn-country" class="learn-select">${[...pool].sort((a,b)=>a.name.localeCompare(b.name)).map(item=>`<option value="${item.code}"${item.code===country.code?' selected':''}>${esc(item.name)}</option>`).join('')}</select></div>${mapMarkup(country,true)}<div class="learn-atlas-caption">${flag(country)}<div><h2>${esc(country.name)}</h2><p>${esc(capitalLabel(country))}</p></div><button class="quiet-button" data-learn-action="country" data-code="${country.code}">Details ${icon?.('arrow',15)||'↗'}</button></div></section>`;
    }
    const results=pool.filter(country=>`${country.name} ${capitalLabel(country)} ${(country.aliases||[]).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
    return `<div class="learn-explore-tools"><label class="learn-search">${icon?.('search',18)||''}<span class="learn-sr">Search countries</span><input id="learn-search" type="search" placeholder="Search countries" value="${esc(search)}" maxlength="80" autocomplete="off"></label><span class="learn-result-count">${results.length} countries</span></div><section class="learn-country-grid" id="learn-country-grid" aria-label="Countries">${countryCards(results.slice(0,shown))}</section>${!results.length?'<p class="learn-empty">No countries found.</p>':''}${results.length>shown?'<div class="learn-more"><button class="btn" data-learn-action="more">Show more</button></div>':''}`;
  }
  function countryCards(pool){return pool.map(country=>`<button class="learn-country-card" data-learn-action="country" data-code="${country.code}">${flag(country)}<span class="learn-country-name">${esc(country.name)}</span>${topic==='capitals'?`<span class="learn-country-capital">${esc(capitalLabel(country))}</span>`:''}</button>`).join('');}
  function setupContent(pool) {
    const test=mode==='test';
    return `<section class="learn-setup"><div class="learn-setup-art learn-${TOPICS[topic].color}">${topicIcon(topic)}</div><h2>${test?'Test yourself':'A little practice'}</h2><p>${test?'A fresh set. Your score at the end.':'Take your time. Learn with every answer.'}</p><fieldset class="learn-setting"><legend>Answer with</legend><div class="learn-segments">${[['choice','Multiple choice'],['type','Typing']].map(([value,label])=>`<button class="learn-segment${answerMode===value?' learn-active':''}" data-learn-action="answer-mode" data-value="${value}" aria-pressed="${answerMode===value}">${label}</button>`).join('')}</div></fieldset><fieldset class="learn-setting"><legend>${topic==='capitals'?'Countries':'Questions'}</legend><div class="learn-segments learn-counts">${[10,20,'all'].map(value=>`<button class="learn-segment${count===value?' learn-active':''}" data-learn-action="count" data-value="${value}" aria-pressed="${count===value}">${value==='all'?`All ${pool.length}`:value}</button>`).join('')}</div></fieldset><button class="btn primary learn-start" data-learn-action="start">${test?'Start test':'Start practising'} ${icon?.('arrow',18)||'↗'}</button></section>`;
  }
  function mapViewport(country) {
    const x=(Number(country.lng)+180)/360*1000,y=(90-Number(country.lat))/180*500;
    const feature=(mapData?.features||[]).find(item=>item.code===country.code);
    const polygons=(feature?.path||'').split('M').filter(Boolean).map(path=>{
      const points=[...path.matchAll(/(-?\d*\.?\d+),(-?\d*\.?\d+)/g)].map(match=>[Number(match[1]),Number(match[2])]);
      if(!points.length)return null;const xs=points.map(point=>point[0]),ys=points.map(point=>point[1]);
      const left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys);
      const distance=Math.max(left-x,0,x-right)**2+Math.max(top-y,0,y-bottom)**2;
      return {left,right,top,bottom,distance,area:(right-left)*(bottom-top)};
    }).filter(Boolean).sort((a,b)=>a.distance-b.distance||b.area-a.area);
    const bounds=polygons[0];
    let width=bounds?Math.max(70,(bounds.right-bounds.left)*1.7,(bounds.bottom-bounds.top)*3.4):70;
    if(width>650)return {x,y,left:0,top:0,width:1000,height:500};
    width=Math.min(1000,width);const height=width/2;
    const centerX=bounds?(bounds.left+bounds.right)/2:x,centerY=bounds?(bounds.top+bounds.bottom)/2:y;
    return {x,y,left:Math.max(0,Math.min(1000-width,centerX-width/2)),top:Math.max(0,Math.min(500-height,centerY-height/2)),width,height};
  }
  function mapMarkup(country,reveal=false) {
    const view=mapViewport(country),circleRadius=view.width*.016,dotRadius=view.width*.005;
    return `<div class="learn-map-wrap"><svg class="learn-world" viewBox="${view.left.toFixed(2)} ${view.top.toFixed(2)} ${view.width.toFixed(2)} ${view.height.toFixed(2)}" role="img" aria-label="${reveal?`Map showing ${esc(country.name)}`:'A country highlighted on a regional map'}"><rect width="1000" height="500" class="learn-map-ocean"/>${(mapData?.features||[]).map(feature=>`<path d="${esc(feature.path)}" vector-effect="non-scaling-stroke" class="learn-map-land${feature.code===country.code?' learn-map-target':''}"/>`).join('')}<circle cx="${view.x.toFixed(2)}" cy="${view.y.toFixed(2)}" r="${circleRadius.toFixed(3)}" vector-effect="non-scaling-stroke" class="learn-map-halo"/><circle cx="${view.x.toFixed(2)}" cy="${view.y.toFixed(2)}" r="${dotRadius.toFixed(3)}" vector-effect="non-scaling-stroke" class="learn-map-marker"/></svg><span class="learn-map-note">Highlighted in purple</span></div>`;
  }
  function showCountry(code) {
    const country=countryByCode.get(code);if(!country)return;document.getElementById('learn-country-dialog')?.remove();
    const dialog=document.createElement('dialog');dialog.id='learn-country-dialog';dialog.className='learn-dialog';
    dialog.innerHTML=`<div class="learn-dialog-head"><span>${esc(country.region)}</span><button class="icon-btn learn-dialog-close" aria-label="Close details">${icon?.('close',20)||'×'}</button></div>${flag(country)}<h2>${esc(country.name)}</h2><dl class="learn-country-facts"><div><dt>${esc(capitalFactLabel(country))}</dt><dd>${esc(capitalLabel(country))}</dd></div></dl>${country.capitalNote?`<p class="learn-note">${esc(country.capitalNote)}</p>`:''}${country.flagNote?`<p class="learn-note">${esc(country.flagNote)}</p>`:''}${mapMarkup(country,true)}<button class="btn primary full learn-dialog-done">Done</button>`;
    document.body.append(dialog);dialog.querySelector('.learn-dialog-close').onclick=()=>dialog.close();dialog.querySelector('.learn-dialog-done').onclick=()=>dialog.close();dialog.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  function reviewEntries() {
    const now=Date.now();return Object.entries(store.value.items).filter(([,value])=>value.nextReviewAt<=now).map(([key,value])=>{const [topic,code]=key.split(':');return {topic,country:countryByCode.get(code),value};}).filter(entry=>entry.country).sort((a,b)=>a.value.nextReviewAt-b.value.nextReviewAt);
  }
  function reviewView() {
    const entries=reviewEntries();shownReviewCount=entries.length;
    frame(`${back()}<header class="learn-heading"><h1>Review</h1><p>${entries.length?'A few familiar faces. Let’s make them stick.':'Your next step starts with a little practice.'}</p></header><section class="learn-review-panel"><span class="learn-review-large">${symbol('review',40)}</span><h2>${entries.length?`${entries.length} ready to revisit`:'You’re all caught up'}</h2><p>${entries.length?'Missed answers return sooner. Remembered ones get more space.':'Practise a topic, then return here to refresh your memory.'}</p>${entries.length?'<button class="btn primary" data-learn-action="review-start">Start review</button>':'<a class="btn primary" href="#learn">Explore topics</a>'}</section>${entries.length?`<div class="learn-review-preview">${entries.slice(0,6).map(entry=>`<span>${esc(TOPICS[entry.topic].name)} <b>·</b> ${esc(entry.country.name)}</span>`).join('')}${entries.length>6?`<span>+${entries.length-6} more</span>`:''}</div>`:''}${progressBar()}`,'learn-review-page');
  }
  function startSession(entries) {
    const pool=filtered();const list=entries||shuffle(pool).slice(0,count==='all'?pool.length:Math.min(count,pool.length)).map(country=>({country,topic}));
    if(!list.length){notify?.('Choose a region with countries to practise.');return;}
    current={id:crypto.randomUUID?.()||String(Date.now()),entries:list,index:0,results:[],answered:false,choice:'',correct:false,mode:entries?'review':mode,answerMode,region,startedAt:Date.now()};
    prepareQuestion();
  }
  function prepareQuestion(){
    if(!current)return;current.answered=false;current.choice='';const entry=current.entries[current.index];
    const targetAnswers=new Set(capitalAnswers(entry.country).map(normalize));
    const pool=countries.filter(country=>country.code!==entry.country.code&&(entry.topic!=='capitals'||!capitalAnswers(country).some(answer=>targetAnswers.has(normalize(answer)))));
    let local=pool.filter(country=>country.region===entry.country.region);if(local.length<3)local=pool;
    current.choices=shuffle([entry.country,...shuffle(local).slice(0,3)]);renderQuestion();window.scrollTo({top:0,behavior:'instant'});
    // Only this public learning exercise is preloaded; private live quiz media is separate.
    if(entry.topic==='flags'){const image=new Image();image.src=flagURL(entry.country.code);}
    const next=current.entries[current.index+1];if(next?.topic==='flags'){const image=new Image();image.src=flagURL(next.country.code);}
  }
  function renderQuestion(){
    const s=current;if(!s)return;const entry=s.entries[s.index],country=entry.country,info=TOPICS[entry.topic];
    frame(`<div class="learn-session-head"><button class="quiet-button" data-learn-action="exit-session">${icon?.('back',16)||'←'} ${s.mode==='review'?'Review':info.name}</button><span>${s.index+1} <span class="learn-muted">/ ${s.entries.length}</span></span></div><div class="learn-session-progress" role="progressbar" aria-label="Session progress" aria-valuenow="${s.index}" aria-valuemin="0" aria-valuemax="${s.entries.length}"><i style="width:${s.index/s.entries.length*100}%"></i></div><section class="learn-exercise"><span class="learn-exercise-label">${s.mode==='test'?'Test':s.mode==='review'?'Review':'Practice'} <span>·</span> ${info.name}</span><h1 tabindex="-1">${entry.topic==='capitals'?esc(capitalQuestion(country,s.answerMode)):info.question}</h1><div class="learn-question-visual ${entry.topic==='map'?'learn-question-map':''}">${entry.topic==='flags'?`<img class="learn-question-flag" src="${flagURL(country.code)}" alt="Flag to identify" width="360" height="240" decoding="async">`:entry.topic==='map'?mapMarkup(country):`<div class="learn-capital-country">${flag(country)}<span>${esc(country.name)}</span></div>`}</div>${s.answerMode==='type'?'<form id="learn-answer-form" class="learn-type-form"><label class="learn-sr" for="learn-answer">Your answer</label><input id="learn-answer" class="learn-answer-input" placeholder="'+(entry.topic==='capitals'?'Type the capital':'Type the country')+'" autocomplete="off" autocapitalize="words" spellcheck="false" maxlength="120" required><button class="btn primary" type="submit">Check answer</button></form>':`<div class="learn-choices" aria-label="Answer choices">${s.choices.map((choice,index)=>`<button class="learn-choice" data-learn-action="answer" data-code="${choice.code}"><span class="learn-choice-letter">${String.fromCharCode(65+index)}</span><span>${esc(entry.topic==='capitals'?capitalLabel(choice):choice.name)}</span><span class="learn-choice-mark" aria-hidden="true"></span></button>`).join('')}</div>`}<div id="learn-feedback" class="learn-feedback" aria-live="polite"></div><div class="learn-question-bottom"><button class="quiet-button" data-learn-action="skip">I’m not sure</button><span>No timer. Take your time.</span></div></section>`,'learn-session');
    if(s.answerMode==='type'&&matchMedia('(min-width:701px)').matches)document.getElementById('learn-answer')?.focus({preventScroll:true});else document.querySelector('.learn-exercise>h1')?.focus({preventScroll:true});
  }
  async function answer(value,isCode=false){
    const s=current;if(!s||s.answered)return;const entry=s.entries[s.index];
    const correct=isCode?value===entry.country.code:matchAnswer(entry.country,entry.topic,value);s.answered=true;s.correct=correct;s.choice=value;s.results.push({topic:entry.topic,country:entry.country,correct});
    await store.update(progress=>recordAnswer(progress,entry.topic,entry.country.code,correct));
    if(current!==s||!active)return;
    const root=document.getElementById('learn-root');root?.querySelectorAll('.learn-choice').forEach(button=>{button.disabled=true;const right=button.dataset.code===entry.country.code,chosen=isCode&&button.dataset.code===value;button.classList.toggle('learn-correct',right);button.classList.toggle('learn-incorrect',chosen&&!correct);if(right)button.querySelector('.learn-choice-mark').innerHTML=symbol('check',20);});
    const input=document.getElementById('learn-answer');if(input){input.disabled=true;const submit=input.form?.querySelector('button');if(submit)submit.disabled=true;}
    const bottom=root?.querySelector('.learn-question-bottom');if(bottom)bottom.hidden=true;
    const label=entry.topic==='capitals'?capitalLabel(entry.country):entry.country.name;
    const feedback=document.getElementById('learn-feedback');if(feedback){feedback.className=`learn-feedback learn-feedback-visible ${correct?'learn-feedback-correct':'learn-feedback-wrong'}`;feedback.innerHTML=`<div><strong>${correct?'That’s right':value?'Keep this one in mind':'A new one to remember'}</strong><p>${esc(label)}${entry.topic!=='capitals'?` <span>·</span> ${esc(capitalLabel(entry.country))}`:''}</p>${entry.country.capitalNote&&entry.topic==='capitals'?`<small>${esc(entry.country.capitalNote)}</small>`:''}${entry.country.flagNote&&entry.topic==='flags'?`<small>${esc(entry.country.flagNote)}</small>`:''}</div><button class="btn ${correct?'green':'primary'}" data-learn-action="next">${s.index+1===s.entries.length?'See results':'Continue'} ${icon?.('arrow',17)||'→'}</button>`;}
    root?.querySelector('.learn-session-progress i')?.style.setProperty('width',`${(s.index+1)/s.entries.length*100}%`);
    root?.querySelector('[role="progressbar"]')?.setAttribute('aria-valuenow',String(s.index+1));
    // Keep the question and flag nodes in place after answering.
    if(matchMedia('(max-width:700px)').matches&&feedback)requestAnimationFrame(()=>{const box=feedback.getBoundingClientRect();if(box.bottom>innerHeight)feedback.scrollIntoView({block:'nearest',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});});
  }
  async function finishSession(){
    const s=current;if(!s||s.finishing)return;s.finishing=true;const next=document.querySelector('[data-learn-action="next"]');if(next)next.disabled=true;const correct=s.results.filter(result=>result.correct).length;
    await store.update(progress=>{progress.tests.push({id:s.id,topic:s.mode==='review'?'review':s.entries[0].topic,region:s.region,total:s.entries.length,correct,at:Date.now()});progress.tests=progress.tests.slice(-20);progress.updatedAt=Date.now();});
    if(current!==s||!active)return;lastFinished=s;current=null;resultsView(s);window.scrollTo({top:0,behavior:'instant'});
  }
  function resultsView(s){
    const correct=s.results.filter(result=>result.correct).length,missed=s.results.filter(result=>!result.correct),percent=Math.round(correct/s.entries.length*100);
    frame(`${back()}<section class="learn-results"><span class="learn-result-emblem">${symbol(percent===100?'spark':'check',39)}</span><p class="learn-exercise-label">${s.mode==='test'?'Test complete':s.mode==='review'?'Review complete':'Practice complete'}</p><h1>${correct}<span> / ${s.entries.length}</span></h1><h2>${percent===100?'Every one remembered.':percent>=70?'A little more familiar.':'A good place to start.'}</h2><p>${missed.length?`${missed.length} ${missed.length===1?'answer':'answers'} to revisit. Every try helps.`:'Come back later to keep them fresh.'}</p><div class="learn-result-actions">${missed.length?'<button class="btn primary" data-learn-action="review-missed">Review missed answers</button>':'<button class="btn primary" data-learn-action="again">Practise again</button>'}<a class="btn ghost" href="#learn">Explore topics</a></div></section>${missed.length?`<section class="learn-missed"><h2>Keep these in mind</h2>${missed.map(entry=>`<div class="learn-missed-row">${flag(entry.country)}<div><strong>${esc(entry.country.name)}</strong><span>${entry.topic==='capitals'?esc(capitalFactLabel(entry.country))+': ':''}${esc(capitalLabel(entry.country))}</span></div><span class="learn-missed-topic">${TOPICS[entry.topic].name}</span></div>`).join('')}</section>`:''}${progressBar()}`);
  }
  function sourcesView(){
    frame(`${back()}<header class="learn-heading"><h1>Sources &amp; notes</h1></header><section class="learn-source-list"><div><h2>Countries &amp; flags</h2><p>195 countries: the 193 United Nations member states, the Holy See and the State of Palestine. Regions follow the UN M49 grouping.</p><p>Flags are local SVG files from <a href="https://github.com/lipis/flag-icons" target="_blank" rel="noopener noreferrer">flag-icons</a>, shared under the MIT licence.</p></div><div><h2>Capitals</h2><p>Country facts are reviewed against UN and official country sources. Some countries have more than one capital or seat of government; accepted answers and notes reflect that distinction.</p><p>Reviewed ${esc(libraryInfo.reviewedAt||'2026-10-26')}. Facts can change; check official sources for current administrative information.</p><details class="learn-source-links"><summary>Official capital references</summary>${(libraryInfo.sources||[]).slice(2).filter(url=>/^https:\/\//.test(url)).map(url=>`<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(url).hostname)}</a>`).join('')}</details></div><div><h2>Maps</h2><p>Map outlines use public-domain <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a> data. Small countries have a location marker. Boundaries and names are for learning and do not express a position on disputes.</p></div><div><h2>Your progress</h2><p>Progress is saved in this browser. Account sync is optional and starts only when you enable it. Each account has its own saved progress. Enabling sync can carry your guest practice into your account.</p><p>“Remembered” means at least two correct answers, with the latest attempt correct. Review intervals grow with practice. Accuracy includes every attempt.</p></div></section>${progressBar()}`);
  }
  function resetPrompt(){
    document.getElementById('learn-reset-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='learn-reset-dialog';dialog.className='learn-dialog learn-reset-dialog';dialog.innerHTML='<h2>Reset learning progress?</h2><p>This clears this profile’s practice history'+(store.enabled?' on this device and your synced account':' on this device')+'. Your quizzes stay as they are.</p><div class="learn-dialog-actions"><button class="btn ghost" data-cancel>Keep progress</button><button class="btn danger" data-confirm>Reset progress</button></div>';document.body.append(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-confirm]').onclick=async()=>{const button=dialog.querySelector('[data-confirm]');button.disabled=true;const cleared=await store.reset();if(cleared!==true){button.disabled=false;return;}dialog.close();homeView();notify?.('Learning progress reset.');};dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  function syncPrompt(){
    document.getElementById('learn-sync-dialog')?.remove();const dialog=document.createElement('dialog');dialog.id='learn-sync-dialog';dialog.className='learn-dialog learn-reset-dialog';dialog.innerHTML='<h2>Save to your account?</h2><p>Sync your learning progress across devices, including guest practice saved here. You can pause sync at any time.</p><div class="learn-dialog-actions"><button class="btn ghost" data-cancel>Not now</button><button class="btn primary" data-confirm>Enable sync</button></div>';document.body.append(dialog);dialog.querySelector('[data-cancel]').onclick=()=>dialog.close();dialog.querySelector('[data-confirm]').onclick=async()=>{dialog.close();await store.enable();};dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
  }
  async function handleClick(event){
    const button=event.target.closest('[data-learn-action]');if(!button)return;const action=button.dataset.learnAction;
    if(action==='mode'){mode=button.dataset.mode;search='';shown=24;topicView();document.getElementById(`learn-tab-${mode}`)?.focus({preventScroll:true});}
    else if(action==='answer-mode'){answerMode=button.dataset.value;topicView();document.querySelector(`[data-learn-action="answer-mode"][data-value="${answerMode}"]`)?.focus({preventScroll:true});}
    else if(action==='count'){count=button.dataset.value==='all'?'all':Number(button.dataset.value);topicView();document.querySelector(`[data-learn-action="count"][data-value="${count}"]`)?.focus({preventScroll:true});}
    else if(action==='more'){shown+=24;topicView();}
    else if(action==='country')showCountry(button.dataset.code);
    else if(action==='start')startSession();
    else if(action==='answer')await answer(button.dataset.code,true);
    else if(action==='skip')await answer('');
    else if(action==='next'){if(current?.answered){if(current.index+1>=current.entries.length)await finishSession();else{current.index++;prepareQuestion();}}}
    else if(action==='exit-session'){if(!current)return;current=null;if(routeParts[0]==='review')reviewView();else topicView();}
    else if(action==='review-start')startSession(shuffle(reviewEntries()).slice(0,30));
    else if(action==='review-missed'&&lastFinished)startSession(shuffle(lastFinished.results.filter(result=>!result.correct).map(({country,topic})=>({country,topic}))));
    else if(action==='again'){if(lastFinished?.entries[0])topic=lastFinished.entries[0].topic;mode='practice';startSession();}
    else if(action==='signin')signIn?.(location.hash||'#learn');
    else if(action==='sync-enable')syncPrompt();
    else if(action==='sync-disable')store.disable();
    else if(action==='sync-retry')await store.retry();
    else if(action==='reset')resetPrompt();
    else if(action==='retry'){await route(routeParts);}
  }
  function handleChange(event){
    if(event.target.id==='learn-region'){region=event.target.value;selectedCountry='';shown=24;topicView();}
    else if(event.target.id==='learn-country'){selectedCountry=event.target.value;topicView();}
  }
  function handleInput(event){
    if(event.target.id==='learn-search'){
      search=event.target.value;shown=24;const results=filtered().filter(country=>`${country.name} ${capitalLabel(country)} ${(country.aliases||[]).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
      const grid=document.getElementById('learn-country-grid');if(grid)grid.innerHTML=countryCards(results.slice(0,shown));const countNode=document.querySelector('.learn-result-count');if(countNode)countNode.textContent=`${results.length} countries`;
      const more=document.querySelector('.learn-more');if(more)more.remove();if(results.length>shown)grid?.insertAdjacentHTML('afterend','<div class="learn-more"><button class="btn" data-learn-action="more">Show more</button></div>');
      document.querySelector('.learn-empty')?.remove();if(!results.length)grid?.insertAdjacentHTML('afterend','<p class="learn-empty">No countries found.</p>');
    }
  }
  function handleKeydown(event){
    const tabs=[...document.querySelectorAll('.learn-tab')];
    if(event.target.classList.contains('learn-tab')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();let index=tabs.indexOf(event.target);index=event.key==='Home'?0:event.key==='End'?tabs.length-1:(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[index].click();document.querySelectorAll('.learn-tab')[index]?.focus();}
    if(current&&!event.target.closest('input,textarea,select,button,a')){if(!current.answered&&/^[1-4]$/.test(event.key)&&current.answerMode==='choice'){event.preventDefault();const choice=current.choices[Number(event.key)-1];if(choice)answer(choice.code,true);}else if(current.answered&&event.key==='Enter'){event.preventDefault();document.querySelector('[data-learn-action="next"]')?.click();}}
  }
  function handleSubmit(event){if(event.target.id==='learn-answer-form'){event.preventDefault();event.stopPropagation();const value=document.getElementById('learn-answer')?.value?.trim();if(value)answer(value);}}
  async function route(parts=[]){
    active=true;routeParts=[...parts];if(routeParts[0]==='learn')routeParts.shift();current=null;
    frame('<div class="learn-loading"><span class="spinner"></span><p>Opening your learning library…</p></div>');pending=true;
    try{await Promise.all([loadData(),loadStyles(),store.init()]);if(!active)return;pending=false;const section=routeParts[0]||'';if(TOPICS[section]){topic=section;mode='explore';search='';shown=24;topicView();}else if(section==='review')reviewView();else if(section==='sources')sourcesView();else if(section==='explore'){topic='flags';mode='explore';topicView();}else homeView();}
    catch(error){if(!active)return;pending=false;frame(`${back()}<section class="learn-review-panel"><h1>Couldn’t open Learn</h1><p>${esc(error.message)}</p><button class="btn primary" data-learn-action="retry">Try again</button></section>`);}
  }
  return {route,destroy(){active=false;disposeListeners();document.querySelectorAll('.learn-dialog').forEach(dialog=>dialog.remove());store.destroy();current=null;},async sessionChanged(){await store.sessionChanged();if(active&&!pending){current=null;if(!routeParts.length)homeView();else if(routeParts[0]==='review')reviewView();else if(TOPICS[routeParts[0]])topicView();}},get progress(){return store.value;}};
}
