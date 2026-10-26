import {RoomImages} from './media.js';
import {RoomChat,CHAT_OPTIONS} from './conversation.js';
import {RoomClock} from './timing.js';
import {ReorderLists} from './reorder.js';
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;
  const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};
// Material Symbols Rounded by Google, Apache-2.0. See material-symbols.LICENSE.txt.
const materialIcons = {"quiz":{"url":"https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/edit_square/materialsymbolsrounded/edit_square_24px.svg","viewBox":"0 -960 960 960","paths":["M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h261q20 0 30 12.5t10 27.5q0 15-10.5 27.5T460-760H200v560h560v-261q0-20 12.5-30t27.5-10q15 0 27.5 10t12.5 30v261q0 33-23.5 56.5T760-120H200Zm280-360Zm-120 80v-97q0-16 6-30.5t17-25.5l344-344q12-12 27-18t30-6q16 0 30.5 6t26.5 18l56 57q11 12 17 26.5t6 29.5q0 15-5.5 29.5T897-728L553-384q-11 11-25.5 17.5T497-360h-97q-17 0-28.5-11.5T360-400Zm481-384-56-56 56 56ZM440-440h56l232-232-28-28-29-28-231 231v57Zm260-260-29-28 29 28 28 28-28-28Z"]},"chat":{"url":"https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/chat_bubble/materialsymbolsrounded/chat_bubble_fill1_24px.svg","viewBox":"0 -960 960 960","paths":["m240-240-92 92q-19 19-43.5 8.5T80-177v-623q0-33 23.5-56.5T160-880h640q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H240Z"]},"send":{"url":"https://raw.githubusercontent.com/google/material-design-icons/master/symbols/web/send/materialsymbolsrounded/send_fill1_24px.svg","viewBox":"0 -960 960 960","paths":["M176-183q-20 8-38-3.5T120-220v-180l320-80-320-80v-180q0-22 18-33.5t38-3.5l616 260q25 11 25 37t-25 37L176-183Z"]}};
const icon = (name, size = 20) => {
  const material=materialIcons[name];
  if(material)return `<svg width="${size}" height="${size}" viewBox="${material.viewBox}" fill="currentColor" aria-hidden="true">${material.paths.map(path=>`<path d="${path}"/>`).join('')}</svg>`;
  const paths = {grip:'M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01',announce:'m4 9 13-5v16L4 15H2V9h2Zm2 7 1 5h4l-2-4M21 8v8',close:'m6 6 12 12M6 18 18 6',more:'M5 12h.01M12 12h.01M19 12h.01',reply:'m9 10-6 5 6 5v-4h5a7 7 0 0 1 7 4v-3a7 7 0 0 0-7-7H9V6',smile:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0ZM8 9h.01M16 9h.01M8 14a4.5 4.5 0 0 0 8 0',hide:'m3 3 18 18M10.5 10.5a2 2 0 0 0 3 3M9.5 5.3A10.5 10.5 0 0 1 21 12a16 16 0 0 1-3 4M6.5 6.5A16 16 0 0 0 3 12s3 7 9 7a10 10 0 0 0 4.5-1',expand:'M9 3H3v6M15 3h6v6M3 15v6h6m6 0h6v-6',arrow:'M7 17 17 7M7 7h10v10',plus:'M12 5v14M5 12h14',play:'m8 5 11 7-11 7V5Z',users:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',search:'m21 21-4.3-4.3M19 11a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',copy:'M9 9h12v12H9V9ZM3 15V3h12',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7',back:'m12 19-7-7 7-7M5 12h14',check:'m5 12 4 4L19 6',clock:'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',trophy:'M8 3h8v6a4 4 0 0 1-8 0V3ZM8 5H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 1v6m-4 2h8',download:'M12 3v12m-5-5 5 5 5-5M5 16v5h14v-5',image:'M3 3h18v18H3V3Zm0 13 5-5 5 5 3-3 5 5M16 7h.01',lock:'M5 10h14v11H5V10Zm3 0V7a4 4 0 0 1 8 0v3',settings:'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8ZM12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2',spark:'m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z',logout:'M9 3H3v18h6M14 8l5 4-5 4M8 12h11',mail:'M3 5h18v14H3V5Zm0 0 9 7 9-7',shuffle:'m16 3 4 4-4 4M4 7h3c5 0 5 10 10 10h3m-4-4 4 4-4 4M4 17h3c2 0 3-2 4-4m2-2c1-2 2-4 4-4h3'};
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name] || paths.spark}"/></svg>`;
};
const brand = () => `<a class="brand" href="#" aria-label="Gather home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span>gather</a>`;
const TYPES = {single:'Multiple choice',multi:'Multiple answers',true_false:'True or false',short_answer:'Type an answer',poll:'Poll',order:'Put in order',slider:'Number slider',word_cloud:'Word cloud',open_ended:'Open response',pin:'Pin on image',slide:'Information slide'};
const S = {config:{},session:null,quizzes:[],reports:[],dashboardTab:'quizzes',filter:'',search:'',draft:null,questionIndex:0,dirty:false,saving:false,room:null,roomState:null,ws:null,wsGeneration:0,reconnectTimer:null,retries:0,connected:false,selection:null,answerPending:false,answerSent:false,order:[],pin:null,authMode:'login',authMessage:'',loading:false};
let toastTimer, sessionRefresh;
try { S.session = JSON.parse(localStorage.getItem('gather.session') || 'null'); } catch {}
const app = $('#app');
S.reorder=new ReorderLists({move:moveReordered,allowed:reorderAllowed});
const activeUser = () => S.session?.user;
const apiURL = path => `${S.config.apiUrl || ''}${path}`;
function toast(message, error = false) { clearTimeout(toastTimer); $('#toast').innerHTML = `<div class="toast ${error?'error':''}">${esc(message)}</div>`; toastTimer = setTimeout(() => $('#toast').innerHTML = '', 4200); }
function safeImage(value) {
  if(typeof value!=='string')return '';
  if(value.length<=2_800_000&&/^data:image\/(?:png|jpeg|webp|gif);base64,[a-zA-Z0-9+/=]+$/.test(value))return value;
  if(/^\/api\/rooms\/\d{6}\/media\/[a-f0-9-]{36}\/plain$/.test(value))return value;
  try { const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:''; }catch{return '';}
}
function nav() { return `<nav class="site-nav">${brand()}<div class="nav-right">${activeUser()?`<a class="quiet-button" href="#dashboard">My quizzes</a><a class="avatar" href="#account" aria-label="Account settings">${esc(activeUser().email?.[0]?.toUpperCase() || 'G')}</a>`:''}</div></nav>`; }
function shell(content) { app.innerHTML = `<div class="shell">${nav()}${content}</div>`; }
function loading(message = 'Loading…') { shell(`<div class="loading-section"><span class="spinner"></span>${esc(message)}</div>`); }
function modal(title, body, actions = '', onSetup) {
  $('#modal-root').innerHTML = `<div class="modal-backdrop"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><h2 id="modal-title">${esc(title)}</h2>${body}<div class="modal-actions"><button class="btn ghost" data-action="close-modal">Cancel</button>${actions}</div></section></div>`;
  S.previousFocus = document.activeElement; requestAnimationFrame(() => $('.modal input, .modal button')?.focus()); onSetup?.();
}
function closeModal() { $('#modal-root').innerHTML = ''; S.previousFocus?.focus(); }
async function request(url, options = {}) {
  const response = await fetch(url, options); const body = await response.text(); let data;
  try { data = body ? JSON.parse(body) : null; } catch { data = null; }
  if (!response.ok) throw new Error(data?.message || data?.msg || data?.error_description || data?.error || `Request failed (${response.status}).`);
  return data;
}
async function authRequest(path, body, method = 'POST', token) {
  if (!S.config.supabaseUrl || !S.config.supabaseKey) throw new Error('Authentication unavailable. Check the server configuration.');
  return request(`${S.config.supabaseUrl}/auth/v1/${path}`, {method,headers:{apikey:S.config.supabaseKey,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
function saveSession(session) {
  S.session = session; if (session) localStorage.setItem('gather.session',JSON.stringify(session)); else localStorage.removeItem('gather.session'); scheduleRefresh();
}
function scheduleRefresh() {
  clearTimeout(sessionRefresh); if (!S.session?.refresh_token) return;
  const wait = Math.max(1000, ((S.session.expires_at || Date.now()/1000+3600)*1000 - Date.now() - 60000));
  sessionRefresh = setTimeout(() => refreshToken().catch(() => {}), Math.min(wait, 2147483647));
}
let refreshInFlight;
async function refreshToken() {
  if (refreshInFlight) return refreshInFlight;
  if (!S.session?.refresh_token) return null;
  refreshInFlight = authRequest('token?grant_type=refresh_token',{refresh_token:S.session.refresh_token}).then(data => { saveSession(data); return data; }).catch(error => { if (/invalid|expired|not found|already used/i.test(error.message)) saveSession(null); throw error; }).finally(() => refreshInFlight = null);
  return refreshInFlight;
}
async function getToken() { if (!S.session) throw new Error('Please sign in to continue.'); if ((S.session.expires_at || 0)*1000 < Date.now()+30000) await refreshToken(); return S.session?.access_token; }
async function db(path, options = {}) {
  const token = await getToken();
  return request(`${S.config.supabaseUrl}/rest/v1/${path}`,{...options,headers:{apikey:S.config.supabaseKey,Authorization:`Bearer ${token}`,'Content-Type':'application/json',Prefer:'return=representation',...options.headers},...(options.body && typeof options.body !== 'string'?{body:JSON.stringify(options.body)}:{})});
}
async function backend(path, body, method = 'POST', auth = true) {
  return request(apiURL(path),{method,headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${await getToken()}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
function home() {
  shell(`<main class="home"><div class="home-content"><h1>Live quizzes<span>.</span></h1><div class="home-actions"><a href="#host" class="action-card primary"><div class="action-icon">${icon('quiz',36)}</div><span class="arrow">↗</span><h2>Host quiz</h2></a><a href="#join" class="action-card"><div class="action-icon" style="color:var(--green)">${icon('users',36)}</div><span class="arrow">↗</span><h2>Join quiz</h2></a></div></div></main>`);
}
function authView() {
  const signup=S.authMode==='signup',recover=S.authMode==='recover',reset=S.authMode==='reset';
  shell(`<main class="auth-layout"><section class="auth-card"><a class="quiet-button back-link" href="#">${icon('back',15)} Home</a><h1>${reset?'Reset password':recover?'Forgot password?':signup?'Create account':'Sign in'}</h1><form id="auth-form">${reset?'':`<div class="field"><label for="auth-email">Email</label><input id="auth-email" name="email" type="email" autocomplete="email" placeholder="you@example.com" required maxlength="254"></div>`}${recover?'':`<div class="field"><label for="auth-password">${reset?'New password':'Password'}</label><input id="auth-password" name="password" type="password" autocomplete="${signup||reset?'new-password':'current-password'}" placeholder="${signup||reset?'At least 8 characters':'Your password'}" minlength="${signup||reset?8:1}" required maxlength="128"></div>`}${S.authMessage?`<div class="info-note">${esc(S.authMessage)}</div>`:''}<div id="form-error" role="alert"></div><button class="btn primary full" type="submit">${reset?'Save password':recover?'Send reset link':signup?'Create account':'Sign in'} ${icon('arrow',16)}</button></form>${!reset?`<div class="auth-foot"><button class="quiet-button" data-action="auth-mode" data-mode="${signup||recover?'login':'signup'}">${signup||recover?'Sign in':'Create account'}</button>${!signup&&!recover?'<button class="quiet-button" data-action="auth-mode" data-mode="recover">Forgot password?</button>':''}</div>`:''}</section></main>`);
}
function joinView(code='') {
  shell(`<main class="auth-layout"><section class="auth-card"><a class="quiet-button back-link" href="#">${icon('back',15)} Home</a><h1>Join quiz</h1><form id="join-form"><div class="field"><label for="join-code">Code</label><input id="join-code" class="code-input" type="text" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="off" placeholder="000000" value="${esc(code)}" required></div><div class="field"><label for="join-name">Name</label><input id="join-name" name="name" autocomplete="nickname" placeholder="Your name" maxlength="24" minlength="1" value="${esc(localStorage.getItem('gather.name')||'')}" required></div><div id="form-error" role="alert"></div><button type="submit" class="btn primary full">Join ${icon('arrow',16)}</button></form></section></main>`);if(code.length===6)setTimeout(()=>$('#join-name')?.focus(),50);
}
async function dashboard() {
  loading();
  try { [S.quizzes,S.reports] = await Promise.all([db('giveaway_quizzes?select=*&order=updated_at.desc'),db('giveaway_reports?select=*&order=created_at.desc&limit=100')]); renderDashboard(); }
  catch(error) { if(!S.session){location.hash='#host';return;} shell(`<main class="page"><h1 style="font-size:32px">Your quiz space</h1><div class="error-note">${esc(error.message)}</div><button class="btn" data-action="reload-dashboard">Try again</button></main>`); }
}
function renderDashboard() {
  const collections=[...new Set(S.quizzes.map(q=>q.collection).filter(Boolean))].sort();
  shell(`<main class="page"><div class="page-head"><div><h1>My quizzes</h1></div><button class="btn primary" data-action="new-quiz">${icon('plus',16)} New quiz</button></div><div class="tabs"><button class="tab ${S.dashboardTab==='quizzes'?'active':''}" data-action="dashboard-tab" data-tab="quizzes">My quizzes <span class="muted">${S.quizzes.length}</span></button><button class="tab ${S.dashboardTab==='reports'?'active':''}" data-action="dashboard-tab" data-tab="reports">Results <span class="muted">${S.reports.length}</span></button></div>${S.dashboardTab==='quizzes'?`<div class="dashboard-tools"><div class="search-field">${icon('search',16)}<input class="input" id="quiz-search" aria-label="Search quizzes" placeholder="Find a quiz…" value="${esc(S.search)}"></div><select class="input filter-select" id="collection-filter" aria-label="Filter by collection"><option value="">All collections</option>${collections.map(c=>`<option ${S.filter===c?'selected':''}>${esc(c)}</option>`).join('')}</select></div><div id="quiz-list">${quizCards()}</div><div class="secondary-actions"><button class="quiet-button" data-action="sample">${icon('spark',15)} Sample quiz</button><label class="quiet-button file-label">${icon('download',15)} Import quiz<input type="file" accept="application/json,.json" id="import-quiz" aria-label="Import quiz"></label><button class="quiet-button" data-action="copy-ai-prompt">${icon('copy',15)} Copy AI prompt</button></div>`:reportList()}</main>`);
}
function quizCards() {
  const quizzes=S.quizzes.filter(q=>(!S.filter||q.collection===S.filter)&&(!S.search||`${q.title} ${q.description} ${q.collection}`.toLowerCase().includes(S.search.toLowerCase())));
  if(!quizzes.length) return `<div class="empty"><div class="empty-icon">${icon('quiz',27)}</div><h2>${S.quizzes.length?'No matches':'No quizzes yet'}</h2><p>${S.quizzes.length?'Try another search.':''}</p></div>`;
  return `<div class="quiz-grid">${quizzes.map(q=>`<article class="quiz-card card"><div class="row between"><div class="quiz-illustration">${icon('quiz',21)}</div><div class="row" style="align-self:flex-start;gap:1px"><button class="icon-btn" data-action="duplicate-quiz" data-id="${esc(q.id)}" aria-label="Duplicate ${esc(q.title)}" title="Duplicate">${icon('copy',15)}</button><button class="icon-btn" data-action="delete-quiz" data-id="${esc(q.id)}" aria-label="Delete ${esc(q.title)}" title="Delete">${icon('trash',15)}</button></div></div><a href="#edit/${q.id}"><h3>${esc(q.title)}</h3></a><div class="quiz-meta"><span>${q.questions?.length||0} questions</span><span>·</span><span>${dateLabel(q.updated_at)}</span>${q.collection?`<span class="pill">${esc(q.collection)}</span>`:''}</div><div class="quiz-card-footer"><a class="quiet-button" style="padding-left:0" href="#edit/${q.id}">Edit quiz ${icon('arrow',13)}</a><button class="btn small primary" data-action="host-quiz" data-id="${q.id}" ${q.questions?.length?'':'disabled'}>${icon('play',13)} Host</button></div></article>`).join('')}</div>`;
}
function dateLabel(value) { return new Date(value).toLocaleDateString(undefined,{month:'short',day:'numeric'}); }
function reportList() {
  if(!S.reports.length)return `<div class="empty"><div class="empty-icon">${icon('trophy',27)}</div><h2>No results yet</h2></div>`;
  return `<div class="table-wrap"><table class="report-table"><thead><tr><th>Quiz</th><th>Date</th><th>Players</th><th>Results</th></tr></thead><tbody>${S.reports.map(r=>`<tr><td>${esc(r.quiz_title||'Untitled quiz')}</td><td>${dateLabel(r.created_at)}</td><td>${(r.results?.leaderboard||r.results?.players||r.results||[]).length||0}</td><td><button class="quiet-button" data-action="report-view" data-id="${r.id}" aria-label="View ${esc(r.quiz_title)} results">View ${icon('arrow',13)}</button><button class="quiet-button" data-action="report-csv" data-id="${r.id}" aria-label="Download ${esc(r.quiz_title)} CSV">${icon('download',14)}</button></td></tr>`).join('')}</tbody></table></div>`;
}
function defaultSettings() { return {shuffleQuestions:false,shuffleOptions:false,scoring:'accuracy',allowLateJoin:true,showLeaderboard:true,participantLimit:0,questionDelay:3,showQuestionType:false,showAnswerOptions:true,roundsEnabled:false,rounds:[],chatMode:'off',chatReplies:true,chatReactions:true}; }
function chatSettingsEditor(d) {
  return `<div class="editor-chat-settings"><div class="field"><label for="quiz-chat-mode">Room chat</label><select id="quiz-chat-mode" data-sfield="chatMode">${CHAT_OPTIONS.map(([value,label])=>`<option value="${value}" ${d.settings.chatMode===value?'selected':''}>${label}</option>`).join('')}</select><span class="hint">Requires a one-time host code. Closed during questions.</span></div><div class="row wrap">${[['chatReplies','Replies'],['chatReactions','Emoji reactions']].map(([key,label])=>`<label class="checkbox-row"><input type="checkbox" data-sfield="${key}" ${d.settings[key]?'checked':''}>${label}</label>`).join('')}</div></div>`;
}

function questionRound(id,d=S.draft) { return (d.settings.rounds||[]).find(r=>r.questionIds.includes(id)); }
function ensureRounds(d=S.draft) {
  if(!Array.isArray(d.settings.rounds))d.settings.rounds=[];
  if(!d.settings.rounds.length)d.settings.rounds=[{id:uid(),title:'Round 1',reward:'',questionIds:d.questions.map(q=>q.id)}];
  const assigned=new Set(),ids=new Set(d.questions.map(q=>q.id));
  for(const round of d.settings.rounds)round.questionIds=(round.questionIds||[]).filter(id=>ids.has(id)&&!assigned.has(id)&&assigned.add(id));
  d.settings.rounds[0].questionIds.push(...d.questions.filter(q=>!assigned.has(q.id)).map(q=>q.id));
}
function assignQuestion(id,roundId) {
  for(const r of S.draft.settings.rounds)r.questionIds=r.questionIds.filter(qid=>qid!==id);
  const round=S.draft.settings.rounds.find(r=>r.id===roundId);if(round)round.questionIds.push(id);syncRoundOrder();
}
function syncRoundOrder() {
  const order=new Map(S.draft.questions.map((q,i)=>[q.id,i]));
  for(const round of S.draft.settings.rounds||[])round.questionIds.sort((a,b)=>order.get(a)-order.get(b));
}
function cloneQuizQuestions(d) {
  const remap=new Map();d.questions=d.questions.map(q=>{const id=uid();remap.set(q.id,id);return {...q,id};});
  if(Array.isArray(d.settings?.rounds))d.settings.rounds=d.settings.rounds.map(r=>({...r,id:uid(),questionIds:(r.questionIds||[]).map(id=>remap.get(id)).filter(Boolean)}));
  return d;
}
function roundsEditor(d) {
  if(!d.settings.roundsEnabled)return '';
  return `<div class="rounds-editor"><div class="row between"><h3>Rounds</h3><button class="quiet-button" data-action="add-round">${icon('plus',14)} Add round</button></div><div class="round-plan">${d.settings.rounds.map((r,i)=>`<div class="round-plan-row"><span class="question-number">${i+1}</span><div class="round-fields"><input class="input" data-round-id="${r.id}" data-rfield="title" value="${esc(r.title)}" maxlength="80" placeholder="Round ${i+1}" aria-label="Round ${i+1} title"><input class="input" data-round-id="${r.id}" data-rfield="reward" value="${esc(r.reward)}" maxlength="200" placeholder="Reward (optional)" aria-label="Round ${i+1} reward"></div><div class="round-actions"><span class="small muted">${r.questionIds.length} question${r.questionIds.length===1?'':'s'}</span><button class="icon-btn" data-action="move-round" data-id="${r.id}" data-direction="-1" ${i===0?'disabled':''} aria-label="Move round ${i+1} up">↑</button><button class="icon-btn" data-action="move-round" data-id="${r.id}" data-direction="1" ${i===d.settings.rounds.length-1?'disabled':''} aria-label="Move round ${i+1} down">↓</button><button class="icon-btn" data-action="delete-round" data-id="${r.id}" ${d.settings.rounds.length===1?'disabled':''} aria-label="Remove round ${i+1}">${icon('trash',14)}</button></div></div>`).join('')}</div></div>`;
}

function newQuestion(type='single') {
  const options=(type==='true_false'?['True','False']:['','','','']).map(text=>({id:uid(),text,image:''}));
  return {id:uid(),type,prompt:'',image:'',options,correct:type==='order'?options.map(o=>o.id):[],acceptedAnswers:[],min:0,max:100,target:type==='pin'?{x:.5,y:.5}:50,tolerance:type==='pin'?.1:0,timeLimit:20,points:['poll','word_cloud','open_ended','slide'].includes(type)?0:1000,explanation:''};
}
function blankQuiz() { return {id:uid(),owner_id:activeUser().id,title:'Untitled quiz',description:'',collection:'',questions:[newQuestion()],settings:defaultSettings()}; }
async function openEditor(id) {
  if(S.draft?.id===id) {renderEditor();return;}
  let quiz = S.quizzes.find(q=>q.id===id);
  if(!quiz) { loading('Opening your quiz…'); try {quiz=(await db(`giveaway_quizzes?id=eq.${encodeURIComponent(id)}&select=*`))[0];}catch(e){toast(e.message,true);} }
  if(!quiz){location.hash='#dashboard';return;}
  S.draft=structuredClone(quiz);S.draft.settings={...defaultSettings(),...S.draft.settings};S.questionIndex=0;S.dirty=false;renderEditor();
}
function renderEditor() {
  S.editorPanels??=new Map();
  $$('details[data-editor-panel]').forEach(panel=>S.editorPanels.set(panel.dataset.editorPanel,panel.open));
  const previousList=$('.question-list'),scrollLeft=previousList?.scrollLeft??0,scrollTop=previousList?.scrollTop??0;
  S.reorder?.cancel();
  const d=S.draft,q=d.questions[S.questionIndex],previous=$('.editor-settings');
  if(previous)S.settingsOpen=previous.open;if(d.settings.roundsEnabled)ensureRounds(d);
  shell(`<main class="page editor-page"><div class="page-head editor-head"><div><a class="quiet-button back-link" href="#dashboard">${icon('back',14)} My quizzes</a><h1>Edit quiz</h1></div><div class="row"><span class="save-state" id="save-state">${S.dirty?'Unsaved':'Saved'}</span><button class="btn" data-action="export-quiz" aria-label="Export quiz JSON">${icon('download',16)}</button><button class="btn primary" data-action="save-quiz">Save</button><button class="btn" data-action="host-draft">${icon('play',14)} Host</button></div></div><div class="editor-layout"><aside class="question-sidebar"><div class="sidebar-label">Questions <span class="muted">${d.questions.length}</span></div><div class="question-list" data-reorder-list="questions">${d.questions.map((item,i)=>`<div class="question-row" data-reorder-item="${esc(item.id)}"><button class="question-item ${i===S.questionIndex?'active':''}" data-action="select-question" data-index="${i}"><span class="question-number">${i+1}</span><span><strong>${esc(item.prompt||'New question')}</strong><small>${d.settings.roundsEnabled?esc(questionRound(item.id)?.title||'Round')+' · ':''}${item.timeLimit}s</small></span></button>${dragHandle('question '+(i+1))}</div>`).join('')}</div><button class="btn full ghost small" data-action="add-question">${icon('plus',15)} Add question</button></aside><div class="editor-main"><details class="card editor-settings" ${S.settingsOpen||!q?'open':''}><summary>Quiz details & game settings</summary><div class="field"><label for="quiz-title">Title</label><input id="quiz-title" data-dfield="title" value="${esc(d.title)}" maxlength="120" required></div><div class="two-col"><div class="field"><label for="quiz-collection">Collection</label><input id="quiz-collection" data-dfield="collection" value="${esc(d.collection)}" maxlength="80" list="collections"><datalist id="collections">${[...new Set(S.quizzes.map(x=>x.collection).filter(Boolean))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist></div><div class="field"><label for="participant-limit">Player limit</label><input id="participant-limit" type="number" data-sfield="participantLimit" min="0" step="1" value="${d.settings.participantLimit||0}"><span class="hint">0 = unlimited</span></div></div><div class="field"><label for="quiz-description">Description (optional)</label><textarea id="quiz-description" data-dfield="description" maxlength="2000">${esc(d.description)}</textarea></div><div class="two-col"><div class="field"><label for="scoring">Scoring</label><select id="scoring" data-sfield="scoring"><option value="speed" ${d.settings.scoring==='speed'?'selected':''}>Speed + accuracy</option><option value="accuracy" ${d.settings.scoring==='accuracy'?'selected':''}>Accuracy only (equal points)</option></select></div><div class="field"><label for="question-delay">Question countdown (seconds)</label><input id="question-delay" type="number" data-sfield="questionDelay" min="0" max="30" step="1" value="${d.settings.questionDelay}"><span class="hint">0 = off</span></div></div><div class="settings-grid">${[['shuffleQuestions','Shuffle questions'],['shuffleOptions','Shuffle answers'],['allowLateJoin','Allow late joins'],['showLeaderboard','Show leaderboard'],['showQuestionType','Question type hint'],['showAnswerOptions','Show answer choices on participant screens'],['roundsEnabled','Multiple rounds']].map(([key,label])=>`<label class="checkbox-row"><input type="checkbox" data-sfield="${key}" ${d.settings[key]?'checked':''}>${label}</label>`).join('')}</div>${chatSettingsEditor(d)}${roundsEditor(d)}</details>${q?questionEditor(q):`<div class="empty"><h2>No questions</h2><button class="btn primary" data-action="add-question">Add question</button></div>`}</div></div></main>`);
  const list=$('.question-list');if(list){list.scrollLeft=scrollLeft;list.scrollTop=scrollTop;}
  $$('details[data-editor-panel]').forEach(panel=>{if(S.editorPanels.has(panel.dataset.editorPanel))panel.open=S.editorPanels.get(panel.dataset.editorPanel);});
}
function questionEditor(q) {
  const options=['single','multi','true_false','poll','order'].includes(q.type), text=['short_answer','word_cloud','open_ended'].includes(q.type);
  return `<section class="card question-editor"><div class="question-toolbar"><h2>Question ${S.questionIndex+1}</h2><div class="row" style="gap:3px"><button class="icon-btn" data-action="move-question" data-direction="-1" ${S.questionIndex===0?'disabled':''} aria-label="Move question up">↑</button><button class="icon-btn" data-action="move-question" data-direction="1" ${S.questionIndex===S.draft.questions.length-1?'disabled':''} aria-label="Move question down">↓</button><button class="icon-btn" data-action="duplicate-question" aria-label="Duplicate question">${icon('copy',15)}</button><button class="icon-btn" data-action="delete-question" aria-label="Delete question">${icon('trash',15)}</button></div></div>${S.draft.settings.roundsEnabled?`<div class="field"><label for="question-round">Round</label><select id="question-round">${S.draft.settings.rounds.map(r=>`<option value="${r.id}" ${r.questionIds.includes(q.id)?'selected':''}>${esc(r.title||'Round')}</option>`).join('')}</select></div>`:''}<div class="two-col question-controls"><div class="field"><label for="question-type">Question type</label><select id="question-type" data-qfield="type">${Object.entries(TYPES).map(([type,name])=>`<option value="${type}" ${q.type===type?'selected':''}>${name}</option>`).join('')}</select></div><div class="two-col"><div class="field"><label for="time-limit">Time (seconds)</label><input id="time-limit" type="number" data-qfield="timeLimit" min="5" max="300" step="1" value="${q.timeLimit}"></div><div class="field"><label for="question-points">Points</label><select id="question-points" data-qfield="points">${[0,1000,2000].map(p=>`<option value="${p}" ${q.points===p?'selected':''}>${p===0?'No points':p.toLocaleString()}</option>`).join('')}</select></div></div></div><div class="field"><label for="question-prompt">${q.type==='slide'?'Slide text':'Question'}</label><textarea id="question-prompt" data-qfield="prompt" placeholder="Enter question" maxlength="1000">${esc(q.prompt)}</textarea></div><details class="editor-disclosure question-media" data-editor-panel="${esc(q.id)}:image" ${q.image||q.type==='pin'?'open':''}><summary>${q.type==='pin'?'Question image · required':'Question image'}</summary><div class="field"><label class="sr-only" for="question-image">Question image URL</label><div class="upload-row"><input class="input" id="question-image" type="url" data-qfield="image" value="${q.image?.startsWith('data:')?'':esc(q.image)}" placeholder="${q.image?'Paste a new image URL':'Paste image URL'}"><label class="btn small file-label">${icon('image',15)} Upload<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="question" aria-label="Upload question image"></label>${q.image?'<button class="quiet-button small" data-action="remove-question-image">Remove</button>':''}</div><span class="hint">JPG, PNG or WebP · max 3 MB</span>${safeImage(q.image)?`<img class="image-preview" src="${esc(safeImage(q.image))}" alt="Question image preview" loading="lazy">`:''}</div></details>${options?`<div class="field-label" style="margin:25px 0 12px">${q.type==='order'?'Arrange the correct order, top to bottom':q.type==='poll'?'Choices':'Answer choices · select the correct answer'+(q.type==='multi'?'s':'')}</div><div class="options-editor-list" ${q.type==='order'?'data-reorder-list="editor-order"':''}>${q.options.map((o,i)=>`<div class="option-editor ${q.type==='order'?'reorder-option':''}" ${q.type==='order'?`data-reorder-item="${esc(o.id)}"`:''}>${q.type==='order'?dragHandle('answer '+(i+1)):''}${q.type==='poll'||q.type==='order'?`<span class="muted small">${String.fromCharCode(65+i)}</span>`:`<input type="checkbox" data-correct="${o.id}" ${q.correct.includes(o.id)?'checked':''} aria-label="Mark answer ${i+1} correct">`}<input class="input" data-option="${o.id}" data-ofield="text" value="${esc(o.text)}" placeholder="Answer ${i+1}" maxlength="500" aria-label="Answer ${i+1}">${q.type==='order'?`<div class="row" style="gap:0"><button class="icon-btn" data-action="move-option" data-id="${o.id}" data-direction="-1" aria-label="Move answer up" ${i===0?'disabled':''}>↑</button><button class="icon-btn" data-action="move-option" data-id="${o.id}" data-direction="1" aria-label="Move answer down" ${i===q.options.length-1?'disabled':''}>↓</button></div>`:q.type!=='true_false'?`<button class="icon-btn" data-action="remove-option" data-id="${o.id}" aria-label="Remove answer ${i+1}">×</button>`:'<span></span>'}${q.type!=='true_false'?`<details class="option-media" data-editor-panel="${esc(q.id)}:option:${esc(o.id)}" ${o.image?'open':''}><summary>Image</summary><div class="option-extra"><input class="input" type="url" data-option="${o.id}" data-ofield="image" value="${o.image?.startsWith('data:')?'':esc(o.image)}" placeholder="${o.image?'Paste a new image URL':'Image URL'}" aria-label="Answer ${i+1} image URL"><label class="icon-btn file-label" title="Upload answer image">${icon('image',14)}<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${o.id}" aria-label="Upload answer ${i+1} image"></label>${o.image?`<button class="quiet-button small" data-action="remove-answer-image" data-id="${esc(o.id)}" aria-label="Remove answer ${i+1} image">Remove</button>`:''}${safeImage(o.image)?`<img src="${esc(safeImage(o.image))}" alt="Answer ${i+1} preview">`:''}</div></details>`:''}</div>`).join('')}</div>${q.type!=='true_false'&&q.options.length<8?'<button class="quiet-button" data-action="add-option">+ Add an answer</button>':''}`:''}${q.type==='short_answer'?`<div class="field"><label for="accepted-answers">Accepted answers (one per line)</label><textarea id="accepted-answers" data-qfield="acceptedAnswers" placeholder="Hay Day&#10;hayday">${esc(q.acceptedAnswers.join('\n'))}</textarea><span class="hint">Answers ignore capitalization and surrounding spaces.</span></div>`:''}${q.type==='slider'?`<div class="two-col"><div class="field"><label for="slider-min">Minimum</label><input id="slider-min" type="number" data-qfield="min" value="${q.min}"></div><div class="field"><label for="slider-max">Maximum</label><input id="slider-max" type="number" data-qfield="max" value="${q.max}"></div><div class="field"><label for="slider-target">Correct number</label><input id="slider-target" type="number" data-qfield="target" value="${typeof q.target==='number'?q.target:50}"></div><div class="field"><label for="slider-tolerance">Accept within ±</label><input id="slider-tolerance" type="number" data-qfield="tolerance" min="0" value="${q.tolerance}"></div></div>`:''}${q.type==='pin'?`<div class="info-note">Tap the correct spot.</div>${safeImage(q.image)?`<div class="pin-area" id="editor-pin"><img src="${esc(safeImage(q.image))}" alt="Click to set the correct location"><span class="pin-dot target" style="left:${(q.target?.x??.5)*100}%;top:${(q.target?.y??.5)*100}%"></span></div>`:''}<div class="field" style="margin-top:15px"><label for="pin-tolerance">Accepted distance (% of image)</label><input id="pin-tolerance" type="number" min="1" max="100" data-pin-tolerance value="${Math.round((q.tolerance||.1)*100)}"></div>`:''}${text&&q.type!=='short_answer'?'':''}<details class="editor-disclosure explanation-editor" data-editor-panel="${esc(q.id)}:explanation"><summary>Explanation</summary><div class="field"><label class="sr-only" for="question-explanation">Explanation (optional)</label><textarea id="question-explanation" data-qfield="explanation" placeholder="Shown after the answer is revealed" maxlength="2000">${esc(q.explanation)}</textarea></div></details></section>`;
}
function markDirty() { S.dirty=true; const state=$('#save-state'); if(state)state.textContent='Unsaved'; }
function dragHandle(label){return `<button type="button" class="reorder-handle" data-reorder-handle aria-label="Drag ${esc(label)}" title="Drag to reorder · arrow keys also work">${icon('grip',17)}</button>`;}
function reorderAllowed(kind){
  if(kind==='questions')return !!S.draft&&location.hash.startsWith('#edit/');
  if(kind==='editor-order')return !!S.draft&&location.hash.startsWith('#edit/')&&S.draft.questions[S.questionIndex]?.type==='order';
  return kind==='player-order'&&S.room?.role==='player'&&S.connected&&S.roomState?.phase==='question'&&S.roomState.question?.type==='order'&&!S.answerPending&&!S.answerSent&&!$('.live-question[aria-busy="true"]');
}
function moveReordered(kind,id,to){
  if(!reorderAllowed(kind))return;
  const list=kind==='questions'?S.draft.questions:kind==='editor-order'?S.draft.questions[S.questionIndex].options:S.order;
  const from=list.findIndex(item=>kind==='player-order'?item===id:item.id===id);
  if(from<0||to<0||to>=list.length||from===to)return;
  const selected=kind==='questions'?S.draft.questions[S.questionIndex]?.id:null;
  list.splice(to,0,list.splice(from,1)[0]);
  if(kind==='player-order'){const root=$('.order-list');for(const [index,id] of S.order.entries()){const row=$$('[data-reorder-item]',root).find(el=>el.dataset.reorderItem===id);if(row){root.append(row);$('.question-number',row).textContent=index+1;$$('[data-action="player-order"]',row).forEach(el=>{el.dataset.index=index;});}}refreshAnswerUI();}
  else{
    if(kind==='questions'){S.questionIndex=S.draft.questions.findIndex(item=>item.id===selected);syncRoundOrder();}
    else S.draft.questions[S.questionIndex].correct=list.map(item=>item.id);
    markDirty();renderEditor();
  }
  const row=$$(`[data-reorder-list="${kind}"] > [data-reorder-item]`).find(item=>item.dataset.reorderItem===id);
  $('[data-reorder-handle]',row||document)?.focus({preventScroll:true});
  $('#reorder-status').textContent=`${kind==='questions'?'Question':'Answer'} moved to position ${to+1} of ${list.length}.`;
}
function validateDraft(d) {
  if(!d.title.trim())throw new Error('Give your quiz a title first.');
  if(!d.questions.length)throw new Error('Add at least one question.');
  if(d.questions.length>500)throw new Error('A quiz can contain up to 500 questions.');
  for(let i=0;i<d.questions.length;i++) {
    const q=d.questions[i],prefix=`Question ${i+1}: `;
    if(!q.prompt.trim()||q.prompt.length>1000)throw new Error(prefix+'add question text up to 1,000 characters.');
    if(!TYPES[q.type])throw new Error(prefix+'choose a supported question type.');
    if(q.timeLimit<5||q.timeLimit>300||!Number.isFinite(q.timeLimit))throw new Error(prefix+'choose a time from 5 to 300 seconds.');
    if(q.image&&!safeImage(q.image))throw new Error(prefix+'use an HTTPS image URL.');
    if(['single','multi','true_false','poll','order'].includes(q.type)) {
      if(q.options.length<2||q.options.length>8)throw new Error(prefix+'add between 2 and 8 answers.');
      if(q.options.some(o=>!o.text.trim()&&!safeImage(o.image)))throw new Error(prefix+'fill in every answer or add an image.');
      if(q.options.some(o=>o.image&&!safeImage(o.image)))throw new Error(prefix+'answer images need HTTPS URLs.');
      if(['single','true_false'].includes(q.type)&&q.correct.length!==1)throw new Error(prefix+'select exactly one correct answer.');
      if(q.type==='multi'&&!q.correct.length)throw new Error(prefix+'select the correct answers.');
      if(q.type==='order')q.correct=q.options.map(o=>o.id);
    }
    if(q.type==='short_answer'&&!q.acceptedAnswers.filter(x=>x.trim()).length)throw new Error(prefix+'add at least one accepted answer.');
    if(q.type==='slider'&&(!Number.isFinite(q.min)||!Number.isFinite(q.max)||q.min>=q.max||q.target<q.min||q.target>q.max||q.tolerance<0))throw new Error(prefix+'check the slider range and correct number.');
    if(q.type==='pin'&&(!safeImage(q.image)||!Number.isFinite(q.target?.x)||!Number.isFinite(q.target?.y)||q.target.x<0||q.target.x>1||q.target.y<0||q.target.y>1||!Number.isFinite(q.tolerance)||q.tolerance<.001||q.tolerance>1.5))throw new Error(prefix+'add an image and set a valid pin location.');
    if(['poll','word_cloud','open_ended','slide'].includes(q.type))q.points=0;
  }
  if(!Number.isInteger(d.settings.questionDelay)||d.settings.questionDelay<0||d.settings.questionDelay>30)throw new Error('Choose a countdown from 0 to 30 seconds.');
  if(!CHAT_OPTIONS.some(([mode])=>mode===d.settings.chatMode)||['chatReplies','chatReactions'].some(key=>typeof d.settings[key]!=='boolean'))throw new Error('Choose valid room chat settings.');
  if(d.settings.roundsEnabled) {
    if(!Array.isArray(d.settings.rounds)||!d.settings.rounds.length)throw new Error('Add a round.');
    const assigned=[];
    for(let i=0;i<d.settings.rounds.length;i++) {
      const r=d.settings.rounds[i];if(!r.title.trim())throw new Error(`Round ${i+1}: add a title.`);
      if(!r.questionIds.length)throw new Error(`${r.title}: assign at least one question.`);
      assigned.push(...r.questionIds);
    }
    if(assigned.length!==d.questions.length||new Set(assigned).size!==assigned.length||assigned.some(id=>!d.questions.some(q=>q.id===id)))throw new Error('Assign every question to one round.');
  }
  if(JSON.stringify(d).length>4*1024*1024)throw new Error('This quiz is too large. Keep its JSON under 4 MB.');
}
async function saveQuiz(silent = false) {
  if(S.saving)throw new Error('Your quiz is still saving. Try again in a moment.');
  validateDraft(S.draft); S.saving=true; $('#save-state')&&( $('#save-state').textContent='Saving…');
  try {
    const {id,title,description,collection,questions,settings}=S.draft;
    const payload={id,owner_id:activeUser().id,title:title.trim(),description,collection:collection.trim(),questions,settings,updated_at:new Date().toISOString()};
    const result=await db('giveaway_quizzes?on_conflict=id',{method:'POST',body:payload,headers:{Prefer:'resolution=merge-duplicates,return=representation'}});
    const saved=result[0];S.draft=structuredClone(saved);S.dirty=false;
    const idx=S.quizzes.findIndex(q=>q.id===saved.id);if(idx>=0)S.quizzes[idx]=saved;else S.quizzes.unshift(saved);
    if($('#save-state'))$('#save-state').textContent='Saved';if(!silent)toast('Quiz saved.');return saved;
  } finally {S.saving=false;if(S.dirty&&$('#save-state'))$('#save-state').textContent='Unsaved';}
}
async function uploadImage(file, target) {
  if(!file)return;if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('Choose a JPG, PNG or WebP image.');
  if(file.size>3*1024*1024)throw new Error('Keep your image under 3 MB.');
  const q=S.draft.questions[S.questionIndex],draftId=S.draft.id;
  const token=await getToken(),ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  const path=`${activeUser().id}/${uid()}.${ext}`;
  await request(`${S.config.supabaseUrl}/storage/v1/object/giveaway-media/${path}`,{method:'POST',headers:{apikey:S.config.supabaseKey,Authorization:`Bearer ${token}`,'Content-Type':file.type,'x-upsert':'false'},body:file});
  const url=`${S.config.supabaseUrl}/storage/v1/object/public/giveaway-media/${path}`;
  if(S.draft?.id!==draftId)return;
  if(target==='question')q.image=url;else{const o=q.options.find(o=>o.id===target);if(o)o.image=url;}markDirty();renderEditor();toast('Image uploaded.');
}
function download(name, content, type='application/json') {
  const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function slug(title) { return title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'gather-quiz'; }
function exportQuiz() { const {title,description,collection,questions,settings}=S.draft;download(`${slug(title)}.json`,JSON.stringify({format:'gather.quiz',version:1,title,description,collection,questions,settings},null,2)); }
async function copyAIPrompt() {
  const {AI_QUIZ_PROMPT}=await import('./quiz-prompt.js');
  try{await navigator.clipboard.writeText(AI_QUIZ_PROMPT);toast('AI prompt copied.');}
  catch{modal('AI quiz prompt',`<textarea class="input ai-prompt" id="ai-prompt" readonly aria-label="AI quiz prompt">${esc(AI_QUIZ_PROMPT)}</textarea>`,'',()=>{$('#ai-prompt').focus();$('#ai-prompt').select();});}
}
async function importQuiz(file) {
  if(!file)return;if(file.size>4*1024*1024)throw new Error('Choose a quiz JSON file under 4 MB.');
  let data;try{data=JSON.parse(await file.text());}catch{throw new Error('That file is not valid JSON.');}
  if(typeof data.title!=='string'||!Array.isArray(data.questions))throw new Error('Choose a Gather quiz export containing a title and questions.');
  const settings=data.settings||{};
  const draft={...blankQuiz(),title:data.title.slice(0,120),description:String(data.description||'').slice(0,2000),collection:String(data.collection||'').slice(0,80),settings:{questionDelay:settings.questionDelay===undefined?3:Number(settings.questionDelay),showQuestionType:settings.showQuestionType===true,showAnswerOptions:settings.showAnswerOptions!==false,roundsEnabled:!!settings.roundsEnabled,rounds:Array.isArray(settings.rounds)?structuredClone(settings.rounds):[],shuffleQuestions:!!settings.shuffleQuestions,shuffleOptions:!!settings.shuffleOptions,scoring:settings.scoring==='speed'?'speed':'accuracy',allowLateJoin:settings.allowLateJoin!==false,showLeaderboard:settings.showLeaderboard!==false,participantLimit:Math.max(0,Math.floor(Number(settings.participantLimit)||0)),chatMode:settings.chatMode??'off',chatReplies:settings.chatReplies??true,chatReactions:settings.chatReactions??true},questions:data.questions.map(raw=>{
    if(!raw||typeof raw!=='object'||!TYPES[raw.type])throw new Error('Every question needs a supported question type.');
    const q={...newQuestion(raw.type),...raw,id:String(raw.id||uid()),prompt:String(raw.prompt||''),image:String(raw.image||''),explanation:String(raw.explanation||''),options:[],correct:[],acceptedAnswers:Array.isArray(raw.acceptedAnswers)?raw.acceptedAnswers.map(String):[]};
    const remap=new Map();q.options=(Array.isArray(raw.options)?raw.options:[]).map(o=>{const id=uid();remap.set(o.id,id);return {id,text:String(o.text||''),image:String(o.image||'')};});
    q.correct=(Array.isArray(raw.correct)?raw.correct:[]).map(id=>remap.get(id)).filter(Boolean);if(q.type==='order'&&q.correct.length===q.options.length)q.options=q.correct.map(id=>q.options.find(o=>o.id===id));return q;
  })};
  cloneQuizQuestions(draft);validateDraft(draft);S.draft=draft;S.questionIndex=0;S.dirty=true;location.hash=`#edit/${draft.id}`;renderEditor();toast('Quiz imported.');
}
async function sampleQuiz() {
  const {geographyQuestions}=await import('./sample-quiz.js');
  const d=blankQuiz();d.title='Around the world';d.collection='General knowledge';
  d.description='10 questions about our planet, from flags to oceans.';
  d.questions=geographyQuestions(uid);d.settings.showQuestionType=true;
  S.draft=d;S.questionIndex=0;S.dirty=true;location.hash=`#edit/${d.id}`;renderEditor();
}
async function hostQuiz(quizId, settings) {
  toast('Opening room…');
  const quiz=S.quizzes.find(q=>q.id===quizId)||S.draft;
  const result=await backend('/api/rooms',{quizId,settings:{...defaultSettings(),...(quiz?.settings||{}),...(settings||{})}});
  S.room={code:result.code,role:'host'};sessionStorage.setItem(`gather.host.${result.code}`,'1');location.hash=`#room/${result.code}`;connectRoom();
}
function roomLink(code) { return `${location.origin}${location.pathname}#join/${code}`; }
function disconnectRoom() {
  S.syncTimers?.forEach(clearTimeout);S.syncTimers=[];S.chat?.destroy();S.chat=null;
  S.wsGeneration++;clearTimeout(S.reconnectTimer);clearInterval(S.heartbeat);clearTimeout(S.connectTimeout);if(S.ws){S.ws.onclose=null;S.ws.close();}S.ws=null;S.connected=false;S.connectionStatus='disconnected';S.images?.close();S.images=null;
}
function connectRoom() {
  const room=S.room;if(!room)return;disconnectRoom();S.clock=new RoomClock();S.chat=new RoomChat({state:()=>S,send,notify:toast,modal,closeModal,id:uid,icon});S.images=new RoomImages(S.config.apiUrl||'',room.code);S.connectionStatus='connecting';S.roomState=null;S.selection=null;S.answerSent=false;S.answerPending=false;S.retries=0;renderRoom();openSocket();
}
async function openSocket() {
  const room=S.room,generation=++S.wsGeneration;if(!room)return;
  S.syncTimers?.forEach(clearTimeout);S.syncTimers=[];
  clearTimeout(S.reconnectTimer);clearInterval(S.heartbeat);clearTimeout(S.connectTimeout);
  S.connected=false;S.connectionStatus=navigator.onLine===false?'offline':S.retries?'reconnecting':'connecting';updateConnection();
  if(navigator.onLine===false)return;
  const previous=S.ws;if(previous){previous.onclose=null;previous.close();}S.ws=null;
  let token;
  try { if(room.role==='host')token=await getToken(); }catch(error){toast(error.message,true);location.hash='#host';return;}
  if(generation!==S.wsGeneration)return;
  let url;
  try {url=new URL(apiURL(`/api/rooms/${room.code}/ws`),location.href);url.protocol=url.protocol==='https:'?'wss:':'ws:';}
  catch{toast('Check your backend URL in config.js.',true);return;}
  const ws=new WebSocket(url);let firstState=true;S.ws=ws;
  const syncClock=()=>{if(generation===S.wsGeneration&&S.connected&&ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(S.clock.request()));};
  S.connectTimeout=setTimeout(()=>{if(generation===S.wsGeneration&&ws.readyState<2){S.retries++;void openSocket();}},12000);
  ws.onopen=()=>{if(generation!==S.wsGeneration)return;S.lastSocketMessage=Date.now();ws.send(JSON.stringify(room.role==='host'?{type:'auth',role:'host',token,mediaVersion:1,conversationVersion:1,chatSubscribed:!S.chat.hidden}:{type:'auth',role:'player',name:room.name,playerId:room.playerId,resumeToken:room.resumeToken,mediaVersion:1,conversationVersion:1,chatSubscribed:!S.chat.hidden}));
    let heartbeatTicks=0;S.heartbeat=setInterval(()=>{if(generation!==S.wsGeneration)return;if(navigator.onLine===false||Date.now()-S.lastSocketMessage>=7500){S.connected=false;S.connectionStatus=navigator.onLine===false?'offline':'reconnecting';updateConnection();if(navigator.onLine!==false){S.retries++;void openSocket();}else ws.close();return;}if(ws.readyState===WebSocket.OPEN){ws.send('ping');if(++heartbeatTicks%12===0)syncClock();}},2500);
  };
  ws.onmessage=event=>{
    if(generation!==S.wsGeneration)return;S.lastSocketMessage=Date.now();if(event.data==='pong')return;let data;try{data=JSON.parse(event.data);}catch{return;}
    if(data.type==='welcome') {
      room.playerId=data.playerId;room.resumeToken=data.resumeToken;
      if(room.role==='player')sessionStorage.setItem(`gather.player.${room.code}`,JSON.stringify(room));
      S.images?.prepare(data.imageManifest);clearTimeout(S.connectTimeout);
    } else if(S.chat?.receive(data)) {return;
    } else if(data.type==='state') {
      const initialState=firstState;if(firstState){S.answerPending=false;firstState=false;}
      const previousId=S.roomState?.question?.id,newId=data.state?.question?.id,previousPhase=S.roomState?.phase;
      if($('.image-modal')&&(previousId!==newId||previousPhase!==data.state.phase))closeModal();
      S.connected=true;S.connectionStatus='connected';S.retries=0;S.roomState=data.state;S.chat?.setState(data.state);S.clock.observe(data.state.serverNow);S.images?.release(data.state.imageKeys);S.images?.pause(data.state.phase==='question'||data.state.phase==='finished');if(data.state.imageManifest)S.images?.prepare(data.state.imageManifest);else if(data.state.phase==='finished')S.images?.prepare([]);
      if(initialState){syncClock();S.syncTimers=[setTimeout(syncClock,350),setTimeout(syncClock,1000)];}
      if(previousId!==newId) {S.selection=null;S.pin=null;S.order=data.state.question?.options?.map(o=>o.id)||[];S.answerSent=false;S.answerPending=false;}
      if(data.state.me?.answered) {S.answerSent=true;S.answerPending=false;S.selection=data.state.me.answer??S.selection;}
      else if(newId&&room.role==='player') {try{const saved=JSON.parse(sessionStorage.getItem(`gather.answer.${room.code}.${newId}`)||'null');if(saved){S.answerSent=true;S.selection=saved.answer;}}catch{}}
      if(data.state.question?.type==='order'&&Array.isArray(S.selection))S.order=[...S.selection];if(data.state.question?.type==='pin'&&S.selection&&typeof S.selection==='object')S.pin=S.selection;
      renderRoom();if(previousId!==newId||previousPhase!==data.state.phase){window.scrollTo(0,0);if(S.room.role==='player'&&data.state.phase==='question')$('#live-question-title')?.focus({preventScroll:true});}
    } else if(data.type==='progress') {
      if(data.questionId&&data.questionId!==S.roomState?.question?.id)return;
      if(S.roomState)S.roomState.answerCount=data.answerCount;
      $$('[data-answer-count]').forEach(el=>el.textContent=data.answerCount);if(data.me?.answered){S.answerSent=true;S.answerPending=false;refreshAnswerUI();}
    } else if(data.type==='answer_ack') {
      S.answerPending=false;if(data.accepted||data.answered){S.answerSent=true;sessionStorage.setItem(`gather.answer.${room.code}.${data.questionId}`,JSON.stringify({answer:S.selection}));refreshAnswerUI();}else{toast(data.message||'Your answer could not be accepted.',true);refreshAnswerUI();}
    } else if(data.type==='draw') {if(S.roomState)S.roomState.winners=data.winners;renderRoom();}
    else if(data.type==='error') {
      S.answerPending=false;toast(data.message||'Something went wrong. Please try again.',true);
      if((!S.connected&&!S.roomState&&!/temporar|retry|try again|slow down/i.test(data.message||''))||/kick|removed|not found|not exist|expired|unauthorized|invalid.*token|session.*restored/i.test(data.message||'')){S.fatalRoomError=data.message;clearTimeout(S.reconnectTimer);clearInterval(S.heartbeat);clearTimeout(S.connectTimeout);S.wsGeneration++;ws.close();S.connected=false;S.connectionStatus='disconnected';renderRoom();}else renderRoom();
    } else if(data.type==='pong') {if(S.clock.accept(data))updateTimer();}
  };
  ws.onclose=event=>{
    if(generation!==S.wsGeneration)return;clearInterval(S.heartbeat);clearTimeout(S.connectTimeout);S.connected=false;S.connectionStatus=navigator.onLine===false?'offline':'reconnecting';updateConnection();
    if([4001,4003].includes(event.code)||(event.code===1000&&/closed|expired|deleted/i.test(event.reason||''))){S.connectionStatus='disconnected';S.fatalRoomError=event.code===4001?'This player is connected in another tab. Return to that tab to continue.':event.reason||'This quiz has closed.';renderRoom();return;}
    if(navigator.onLine!==false){const delay=Math.min(700*2**S.retries++,5000)+Math.random()*250;S.reconnectTimer=setTimeout(openSocket,delay);}
  };
  ws.onerror=()=>{};
}
function updateConnection() {
  $$('.connection').forEach(el=>{el.classList.toggle('offline',!S.connected);el.dataset.state=S.connectionStatus||'connecting';el.innerHTML=connectionLabel();});
  $$('[data-needs-connection]').forEach(el=>el.disabled=!S.connected||(el.dataset.action==='room-start'&&!(S.roomState?.participantCount??S.roomState?.players?.length)));
  if(!S.connected)$$('.live-question button,.live-question input,.live-question textarea').forEach(el=>el.disabled=true);
  S.chat?.refresh();
}
function connectionLabel(){const text=S.connected?'Connected':({connecting:'Connecting',reconnecting:'Reconnecting',offline:'Offline',disconnected:'Disconnected'}[S.connectionStatus]||'Connecting');return `<span class="connection-dot" aria-hidden="true"></span><span>${text}</span>${!S.connected&&S.room&&!S.fatalRoomError?'<button class="connection-retry" data-action="reconnect" aria-label="Reconnect now" title="Reconnect now">↻</button>':''}`;}
function roomImage(source,classes='',alt='Question image') {const safe=safeImage(source),cached=S.images?.cached(safe);return `<img data-room-image="${esc(safe)}" ${cached?`src="${esc(cached)}" data-ready="true"`:''} class="room-image ${cached?'':'loading-image'} ${classes}" alt="${esc(alt)}" decoding="async" fetchpriority="high">`;}
function fitChoiceQuestion(){
  const screen=$('.live-choice-screen');if(!screen)return;
  const height=window.visualViewport?.height??window.innerHeight,top=screen.getBoundingClientRect().top+window.scrollY;
  screen.style.setProperty('--choice-height',Math.max(160,Math.floor(height-top-12))+'px');
}
function hydrateRoomImages(){
  const images=$$('img[data-room-image]');S.images?.retain(images.map(img=>img.dataset.roomImage));
  const section=$('.live-question'),controls=section?$$('button,input,textarea',section).map(el=>[el,el.disabled]):[];
  const sync=()=>{if(!section?.isConnected)return;const waiting=images.some(img=>img.isConnected&&img.dataset.ready!=='true');const failed=images.some(img=>img.classList.contains('image-failed'));section.setAttribute('aria-busy',String(waiting));section.classList.toggle('media-pending',waiting&&!failed);section.inert=waiting&&!failed;const loading=$('.question-media-status');if(loading){loading.hidden=!waiting;loading.textContent=failed?'Image unavailable. Retry to continue.':'Preparing images…';}for(const[el,disabled]of controls)el.disabled=disabled||!S.connected||waiting;if(S.roomState?.phase==='question')refreshAnswerUI();};
  sync();
  for(const img of images){
    if(img.dataset.ready==='true')continue;
    const source=img.dataset.roomImage;
    const failed=()=>{
      if(!img.isConnected)return;
      img.classList.remove('loading-image');img.classList.add('image-failed');img.alt='Image unavailable';sync();
      const retry=document.createElement('button');retry.className='quiet-button image-retry';retry.type='button';retry.textContent='Retry image';
      retry.onclick=event=>{event.stopPropagation();retry.remove();img.classList.remove('image-failed');img.classList.add('loading-image');sync();load(true);};
      (img.closest('button')?.closest('.answer-grid')||img).after(retry);
    };
    const load=(retry=false)=>void Promise.resolve(S.images?.source(source)||source).then(url=>{
      if(!img.isConnected)return;
      img.onload=()=>{img.classList.remove('loading-image');img.dataset.ready='true';sync();};img.onerror=failed;
      img.src=url+(retry&&!url.startsWith('blob:')?(url.includes('?')?'&':'?')+'retry='+Date.now():'');
    }).catch(failed);
    load();
  }
}
function send(command) {
  if(!S.connected||S.ws?.readyState!==WebSocket.OPEN){toast('Waiting for your connection to return.',true);return false;}
  S.ws.send(JSON.stringify(command));return true;
}
function answerStatus(q,isHost=false) {
  if(isHost||q.type==='slide')return '';
  return `<div class="live-answer-status" role="status">${S.answerSent?`<div class="answer-result neutral">${icon('check',19)} Answer received</div>`:S.answerPending?'<p class="answer-note"><span class="spinner"></span> Sending…</p>':['multi','order','pin'].includes(q.type)?`<p class="answer-note">${q.type==='multi'?'Select all correct answers':q.type==='order'?'Arrange in order':'Tap a location'}</p>`:''}</div>`;
}
function refreshAnswerUI() {
  const st=S.roomState,q=st?.question,section=$('.live-question');
  if(st?.phase!=='question'||!q||!section||S.room?.role==='host')return;
  const blocked=!S.connected||S.answerSent||S.answerPending||section.getAttribute('aria-busy')==='true';
  $$('[data-action="choose-answer"]',section).forEach(el=>{const selected=Array.isArray(S.selection)?S.selection.includes(el.dataset.id):S.selection===el.dataset.id;el.classList.toggle('selected',selected);el.setAttribute('aria-pressed',String(selected));el.disabled=blocked;const mark=$('.option-mark',el);if(mark)mark.textContent=selected?'●':'';});
  $$('[data-action^="submit-"],.text-answer button,#player-text,#player-slider,[data-reorder-handle],[data-action="player-order"]',section).forEach(el=>{
    const action=el.dataset.action;el.disabled=blocked||(action==='submit-multi'&&!S.selection?.length)||(action==='submit-pin'&&!S.pin)||(action==='player-order'&&(Number(el.dataset.index)+Number(el.dataset.direction)<0||Number(el.dataset.index)+Number(el.dataset.direction)>=S.order.length));
  });
  const status=$('.live-answer-status',section);if(status){const next=document.createElement('template');next.innerHTML=answerStatus(q);if(status.innerHTML!==next.content.firstElementChild.innerHTML)status.innerHTML=next.content.firstElementChild.innerHTML;}
}
function sendAnswer(answer) {
  if(!S.connected||S.answerSent||S.answerPending||S.roomState?.phase!=='question')return;
  const questionId=S.roomState.question.id,attempt=S.answerAttempt=(S.answerAttempt||0)+1;
  S.selection=answer;S.answerPending=true;
  if(send({type:'answer',questionId,answer})){refreshAnswerUI();setTimeout(()=>{if(S.answerPending&&S.answerAttempt===attempt&&S.roomState?.question?.id===questionId){S.answerPending=false;refreshAnswerUI();toast('Your answer has not been confirmed. Tap to retry.',true);}},7000);}else{S.answerPending=false;refreshAnswerUI();}
}
function renderRoom() {
  S.reorder?.cancel();
  const focused=document.activeElement?.id,selectionStart=document.activeElement?.selectionStart,selectionEnd=document.activeElement?.selectionEnd;
  const room=S.room,st=S.roomState,isHost=room?.role==='host';if(!room)return;
  app.innerHTML=`<div class="room-wrap"><header class="room-nav">${brand()}<div class="row"><span class="room-code-small"><span class="code-label">Code </span><b>${esc(room.code)}</b></span><div class="connection ${S.connected?'':'offline'}" role="status" aria-live="polite" aria-atomic="true">${connectionLabel()}</div>${st?.me&&st.phase!=='lobby'?`<span class="player-score"><strong>${(st.me.score||0).toLocaleString()}</strong> pts</span>`:''}<button class="icon-btn" data-action="leave-room" title="Leave quiz" aria-label="Leave quiz">${icon('logout',16)}</button></div></header><div id="room-announcement"></div><div id="room-tools" class="room-tools" hidden></div>${S.fatalRoomError?`<div class="waiting-state"><h1>Unable to join</h1><p>${esc(S.fatalRoomError)}</p><a class="btn primary" href="#join" style="margin-top:25px">Try another code</a></div>`:!st?`<div class="loading-section"><span class="spinner"></span>Connecting…</div>`:st.phase==='lobby'?lobbyView(st,isHost):st.phase==='countdown'?countdownView(st,isHost):st.phase==='round_results'?roundResultsView(st,isHost):st.phase==='finished'?resultsView(st,isHost):questionView(st,isHost)}</div>`;
  updateTimer();updateConnection();hydrateRoomImages();if(focused){const el=document.getElementById(focused);if(el){el.focus({preventScroll:true});try{el.setSelectionRange(selectionStart,selectionEnd);}catch{}}}
  fitChoiceQuestion();
}
function lobbyView(st,isHost) {
  const count=st.participantCount??st.players?.length??0;
  if(!isHost)return `<main class="waiting-state player-lobby"><div class="lobby-heading"><p class="lobby-quiz-title">${esc(st.title)}</p><h1>You’re in<span>.</span></h1><p class="lobby-waiting"><span aria-hidden="true"></span>Waiting for host</p></div><div class="waiting-cards"><div class="waiting-card player-badge"><span>Playing as</span><strong>${esc(S.room.name)}</strong></div><div class="waiting-card waiting-count"><span>In the room</span><strong>${count} <small>player${count===1?'':'s'}</small></strong></div></div></main>`;
  return `<main class="lobby-layout"><section class="lobby-main"><h1>${esc(st.title)}</h1><div class="big-code">${esc(st.code)}</div><button class="quiet-button copy-code" data-action="copy-link">${icon('copy',13)} Copy link</button><div><button class="btn primary large" data-action="room-start" data-needs-connection ${!st.players?.length?'disabled':''}>${icon('play',18)} Start quiz</button></div><p class="small muted lobby-meta">${st.totalQuestions} questions${st.round?.total>1?' · '+st.round.total+' rounds':''}</p></section><section class="card participant-card"><div class="row between"><h2>Players <span class="muted">${count}</span></h2><button class="quiet-button" data-action="room-lock">${icon('lock',13)} ${st.locked?'Locked':'Open'}</button></div>${st.players?.length?`<div class="participant-list">${st.players.map(p=>`<span class="participant-chip ${p.connected===false?'disconnected':''}">${esc(p.name)}<button class="icon-btn" data-action="kick-player" data-id="${p.id}" data-name="${esc(p.name)}" aria-label="Remove ${esc(p.name)}">×</button></span>`).join('')}</div>`:'<p class="answer-note">Waiting for players</p>'}</section></main>`;
}
function roundLabel(st) {
  return st.settings?.roundsEnabled&&st.round?`<span class="round-tag">${esc(st.round.title)}<span>${st.round.index+1} / ${st.round.total}</span></span>`:'';
}
function countdownView(st,isHost) {
  const hint=st.questionHint,type=hint&&TYPES[hint.type];
  const label=type?(hint.hasImage&&hint.type!=='pin'?`Image · ${type.toLowerCase()}`:type):'';
  const number=st.round&&st.settings?.roundsEnabled?st.round.questionIndex+1:st.questionIndex+1;
  const total=st.round&&st.settings?.roundsEnabled?st.round.questionCount:st.totalQuestions;
  return `<main class="countdown-state">${roundLabel(st)}<p class="countdown-progress">Question ${number} of ${total}</p><h1>Get ready<span>.</span></h1>${label?`<p class="countdown-hint">${esc(label)}</p>`:''}<div id="countdown-number" role="timer" aria-live="polite">—</div>${isHost?'<button class="quiet-button countdown-end" data-action="room-finish">End quiz</button>':''}</main>`;
}
function roundResultsView(st,isHost) {
  const r=(st.roundResults||[]).find(r=>r.id===st.round?.id)||(st.roundResults||[]).at(-1),hasNext=st.round&&st.round.index+1<st.round.total;
  if(!r)return '<main class="waiting-state"><p>Loading results…</p></main>';
  return `<main class="round-results"><div class="results-head"><p class="round-overline">${esc(r.title)}</p><h1>${r.tied?'Tied for first':r.winners?.length?'Round winner':'Round complete'}</h1>${r.winners?.length?`<div class="round-winners">${r.winners.map(p=>`<div class="round-winner-name">${esc(p.name)}</div>`).join('')}</div>`:'<p>No scoring answers</p>'}${r.reward?`<div class="round-reward">${icon('trophy',17)} ${esc(r.reward)}</div>`:''}</div>${isHost||st.settings?.showLeaderboard?leaderboard(r.leaderboard||[]):''}${isHost?`<div class="round-controls">${r.tied&&!r.tieResolvedAt?'<button class="btn" data-action="draw-round">'+icon('shuffle',15)+' Break tie</button>':''}<button class="btn primary" data-action="${hasNext?'room-next-round':'room-finish-final'}" data-needs-connection>${hasNext?'Next round':'Finish quiz'} ${icon('arrow',16)}</button></div>`:'<p class="answer-note">Waiting for host</p>'}</main>`;
}
function questionView(st,isHost) {
  const q=st.question;if(!q)return `<div class="loading-section">Waiting…</div>`;
  const reveal=st.phase==='reveal',answerable=!isHost&&!reveal&&!S.answerSent&&!S.answerPending,hasOptions=['single','multi','true_false','poll'].includes(q.type),round=st.round,roundEnd=st.settings?.roundsEnabled&&round&&round.questionIndex+1>=round.questionCount;
  const progress=st.settings?.roundsEnabled&&round?`${round.questionIndex+1} / ${round.questionCount}`:`${st.questionIndex+1} / ${st.totalQuestions}`;
  return `<main class="${reveal?'reveal-screen':'live-question-screen'+(hasOptions&&q.options.some(o=>safeImage(o.image))?' live-choice-screen':'')}" style="--answer-rows:${hasOptions?Math.ceil(q.options.length/2):1}"><div class="question-top"><div class="question-progress">${roundLabel(st)}<span>Question <b>${progress}</b></span></div><div class="row">${isHost?`<span class="small muted"><span data-answer-count>${st.answerCount||0}</span> / ${st.participantCount??st.players?.length??0}</span>`:''}<div class="timer ${reveal?'sr-only':''}" id="live-timer">${icon('clock',14)}<span>—</span></div></div></div>${!reveal?'<div class="timer-track"><div id="timer-fill"></div></div><p class="question-media-status" role="status" hidden></p>':''}<section class="live-question"><h1 id="live-question-title" tabindex="-1">${esc(q.prompt)}</h1>${reveal?revealView(st,isHost):`${q.type!=='pin'&&safeImage(q.image)?roomImage(q.image,'live-question-image','Question image'):''}${hasOptions?`${!isHost&&st.settings?.showAnswerOptions===false?'<p class="answer-note">Use the host’s screen to read the choices.</p>':''}<div class="answer-grid ${q.options.some(o=>safeImage(o.image))?'image-choice-grid':''}">${q.options.map((o,i)=>answerOption(o,i,st,isHost,answerable)).join('')}</div>${q.type==='multi'&&answerable?`<button class="btn primary" data-action="submit-multi" ${Array.isArray(S.selection)&&S.selection.length?'':'disabled'}>Submit ${icon('check',16)}</button>`:''}`:q.type==='order'?orderView(q,st,isHost,answerable):q.type==='slider'?sliderView(q,st,isHost,answerable):q.type==='pin'?pinView(q,st,isHost,answerable):q.type==='slide'?'':textAnswerView(q,st,isHost,answerable)}${answerStatus(q,isHost)}`}</section>${isHost?`<div class="host-controls"><button class="quiet-button" data-action="room-finish">End quiz</button>${reveal?`<button class="btn primary" data-action="room-next" data-needs-connection>${roundEnd?'Round results':st.questionIndex+1>=st.totalQuestions?'Results':'Next question'} ${icon('arrow',16)}</button>`:`<button class="btn primary" data-action="room-reveal" data-needs-connection>${q.type==='slide'?'Continue':'Reveal answer'} ${icon('arrow',16)}</button>`}</div>`:''}</main>`;
}
function answerOption(o,i,st,isHost,answerable) {
  const q=st.question,reveal=st.phase==='reveal',correct=reveal&&st.reveal?.correct?.includes(o.id),selected=Array.isArray(S.selection)?S.selection.includes(o.id):S.selection===o.id;
  const dist=st.reveal?.distribution,count=dist?.[o.id]??0,image=!!safeImage(o.image),lettersOnly=!isHost&&!reveal&&st.settings?.showAnswerOptions===false;
  const button=`<button class="answer-option ${lettersOnly?'letter-only':''} ${image?'image-answer':''} ${selected?'selected':''} ${correct?'correct-answer':reveal&&selected&&!correct&&q.type!=='poll'?'wrong-answer':''}" ${!answerable?'disabled':''} data-action="choose-answer" data-id="${esc(o.id)}" aria-pressed="${selected}" aria-label="${esc((reveal&&correct?'Correct: ':'')+(o.text||'Answer '+String.fromCharCode(65+i)))}"><span class="option-letter">${String.fromCharCode(65+i)}</span><span class="option-body">${esc(o.text)}${reveal&&count?`<span class="small muted" style="display:block;margin-top:6px">${count} answer${count===1?'':'s'}</span>`:''}</span>${correct?'<span class="answer-check">✓</span>':selected?'<span class="option-mark" style="color:var(--accent)">●</span>':isHost?`<span class="kbd">${i+1}</span>`:'<span class="option-mark"></span>'}${image?roomImage(o.image,'answer-option-image',o.text||'Answer '+String.fromCharCode(65+i)):''}${reveal&&count?`<span class="distribution" style="width:${Math.round(count/Math.max(1,st.answerCount)*100)}%"></span>`:''}</button>`;
  return image?`<div class="answer-card">${button}<button type="button" class="answer-zoom" data-action="zoom-answer" aria-label="Enlarge answer ${String.fromCharCode(65+i)} image">${icon('expand',17)}</button></div>`:button;
}
function zoomAnswer(element) {
  const image=element.closest('.answer-card')?.querySelector('img[data-ready="true"]');if(!image?.src)return;
  modal(image.alt,`<img class="answer-image-expanded" src="${esc(image.src)}" alt="${esc(image.alt)}">`,'<button class="btn primary" data-action="close-modal">Done</button>');
  $('.modal').classList.add('image-modal');
}
function orderView(q,st,isHost,answerable) {
  const ids=st.phase==='reveal'?(st.reveal?.correct||S.order):S.order;
  return `<div class="order-list" ${answerable?'data-reorder-list="player-order"':''}>${ids.map((id,i)=>{const o=q.options.find(x=>x.id===id);return `<div class="order-item" ${answerable?`data-reorder-item="${esc(id)}"`:''}>${answerable?dragHandle('answer '+(i+1)):''}<span class="question-number">${i+1}</span><span class="order-text">${esc(o?.text||'')}${safeImage(o?.image)?roomImage(o.image,'order-option-image',o.text||'Answer image'):''}</span>${answerable?`<div class="row" style="gap:2px"><button class="icon-btn" data-action="player-order" data-index="${i}" data-direction="-1" ${i===0?'disabled':''} aria-label="Move ${esc(o?.text)} up">↑</button><button class="icon-btn" data-action="player-order" data-index="${i}" data-direction="1" ${i===ids.length-1?'disabled':''} aria-label="Move ${esc(o?.text)} down">↓</button></div>`:''}</div>`;}).join('')}</div>${answerable?'<button class="btn primary" data-action="submit-order">Submit order</button>':''}`;
}
function sliderView(q,st,isHost,answerable) {
  const v=typeof S.selection==='number'?S.selection:(q.min+q.max)/2;
  if(isHost||st.phase==='reveal')return `<div class="range-answer"><output>${st.phase==='reveal'?esc(st.reveal?.target??'—'):`${q.min} — ${q.max}`}</output><p class="small muted">${st.phase==='reveal'?'Correct number':'Range'}</p></div>`;
  return `<div class="range-answer"><output id="slider-output">${esc(v)}</output><input type="range" min="${q.min}" max="${q.max}" step="${(q.max-q.min)<10?.1:1}" value="${v}" id="player-slider" aria-label="Your number" ${!answerable?'disabled':''}><div class="range-labels"><span>${q.min}</span><span>${q.max}</span></div>${answerable?'<button class="btn primary" data-action="submit-slider">Submit</button>':''}</div>`;
}
function pinView(q,st,isHost,answerable) {
  const target=st.phase==='reveal'?st.reveal?.target:S.pin;
  return `<div class="pin-area" ${answerable?'id="player-pin"':''}>${roomImage(q.image,'pin-question-image',answerable?'Tap to choose your location':'Question image')}${target&&typeof target==='object'?`<span class="pin-dot ${st.phase==='reveal'?'target':''}" style="left:${target.x*100}%;top:${target.y*100}%"></span>`:''}</div>${answerable?`<div style="margin-top:20px"><button class="btn primary" data-action="submit-pin" ${!S.pin?'disabled':''}>Submit</button></div>`:''}`;
}
function textAnswerView(q,st,isHost,answerable) {
  if(isHost)return `<p class="answer-note">${q.type==='short_answer'?'Waiting for answers':'Waiting for responses'}</p>`;
  if(!answerable)return S.selection?`<p class="subtle" style="margin:20px">Your answer: ${esc(S.selection)}</p>`:'';
  const input=q.type==='open_ended'?`<textarea id="player-text" class="input" maxlength="1000" placeholder="Your answer…" required>${esc(S.selection||'')}</textarea>`:`<input id="player-text" class="input" maxlength="${q.type==='word_cloud'?60:200}" placeholder="${q.type==='word_cloud'?'A word or two…':'Your answer…'}" value="${esc(S.selection||'')}" autocomplete="off" required>`;
  return `<form id="text-answer-form" class="text-answer"><div class="field"><label class="sr-only" for="player-text">Your answer</label>${input}</div><button type="submit" class="btn primary full">Submit ${icon('arrow',15)}</button></form>`;
}
function revealView(st,isHost) {
  const q=st.question,unscored=['poll','word_cloud','open_ended','slide'].includes(q.type),me=st.me,dist=st.reveal?.distribution;
  const status=unscored?(me?.answered?'Response saved':'No response'):!me?.answered?'No answer':me.correct?'Correct':'Incorrect';
  const choices=['single','multi','true_false'].includes(q.type),correctOptions=choices?q.options.filter(o=>st.reveal?.correct?.includes(o.id)):[];
  const selected=Array.isArray(S.selection)?S.selection:[S.selection],wrongOptions=choices&&!me?.correct&&!isHost?q.options.filter(o=>selected.includes(o.id)&&!st.reveal?.correct?.includes(o.id)):[];
  return `${!isHost&&me&&q.type!=='slide'?`<div class="answer-result reveal-result ${unscored?'neutral':me.correct?'':'wrong'}" role="status"><span class="result-symbol">${unscored?'✓':me.correct?'✓':!me.answered?'—':'×'}</span><div><strong>${status}</strong>${!unscored?`<span class="result-points">+${Number(me.points||0).toLocaleString()} pts</span>`:''}</div></div>`:''}<div class="reveal-answer">${correctOptions.length?`<p class="reveal-label">Correct answer${correctOptions.length===1?'':'s'}</p><div class="correct-answer-list">${correctOptions.map(o=>`<div class="correct-answer-tile">${icon('check',19)}<div>${o.text?`<strong>${esc(o.text)}</strong>`:''}${safeImage(o.image)?`${roomImage(o.image,'',o.text||'Correct answer')}`:''}</div>${isHost&&dist?`<span class="small muted">${dist[o.id]||0}</span>`:''}</div>`).join('')}</div>`:''}${wrongOptions.length?`<div class="your-answer"><span>Your answer</span>${wrongOptions.map(o=>`<div>${esc(o.text)}${safeImage(o.image)?`${roomImage(o.image,'',o.text||'Your answer')}`:''}</div>`).join('')}</div>`:''}${q.type==='short_answer'&&!isHost&&me?.answered&&!me.correct?`<div class="your-answer"><span>Your answer</span>${esc(S.selection||'')}</div>`:''}${q.type==='short_answer'?`<p class="reveal-label">Accepted answer${st.reveal?.acceptedAnswers?.length===1?'':'s'}</p><div class="correct-answer-list">${(st.reveal?.acceptedAnswers||[]).map(a=>`<div class="correct-answer-tile">${icon('check',19)}<strong>${esc(a)}</strong></div>`).join('')}</div>`:''}${q.type==='order'?'<p class="reveal-label">Correct order</p>'+orderView(q,st,isHost,false):''}${q.type==='slider'?'<p class="reveal-label">Correct number</p>'+sliderView(q,st,isHost,false):''}${q.type==='pin'?'<p class="reveal-label">Correct location</p>'+pinView(q,st,isHost,false):''}${q.type==='poll'?`<p class="reveal-label">Responses</p><div class="answer-grid ${q.options.some(o=>safeImage(o.image))?'image-choice-grid':''}">${q.options.map((o,i)=>answerOption(o,i,st,isHost,false)).join('')}</div>`:''}${q.type==='slide'&&safeImage(q.image)?roomImage(q.image,'live-question-image','Slide image'):''}${q.type==='word_cloud'&&dist?`<div class="cloud-words">${Object.entries(dist).map(([word,count])=>`<span style="font-size:${Math.min(34,14+Number(count)*3)}px">${esc(word)}</span>`).join('')}</div>`:''}${q.type==='open_ended'&&st.reveal?.responses?.length?`<div class="leaderboard">${st.reveal.responses.slice(0,100).map(word=>`<div class="leader-row"><span class="leader-name">${esc(word)}</span></div>`).join('')}</div>`:''}${st.reveal?.explanation?`<p class="explanation">${esc(st.reveal.explanation)}</p>`:''}</div>${st.settings?.showLeaderboard&&st.leaderboard?.length&&q.type!=='slide'?`<div class="reveal-leaders"><p class="reveal-label">Leaderboard</p>${leaderboard(st.leaderboard.slice(0,5))}</div>`:''}`;
}
function leaderboard(players) { return `<div class="leaderboard">${players.map((p,i)=>`<div class="leader-row"><span class="leader-rank">${(p.rank??i+1)===1?'✳':String(p.rank??i+1).padStart(2,'0')}</span><span class="leader-name">${esc(p.name)}${p.id===S.room?.playerId?' <span class="muted">(you)</span>':''}</span><span class="leader-points">${Number(p.score||0).toLocaleString()} <span class="muted small">pts</span></span></div>`).join('')}</div>`; }
function resultsView(st,isHost) {
  const rounds=st.roundResults||[],show=st.settings?.showLeaderboard||isHost;
  return `<main><div class="results-head"><h1>Quiz complete</h1><p>${esc(st.title)}</p></div>${rounds.length?roundHistory(rounds,show):show?leaderboard(st.leaderboard||[]):''}${st.winners?.length?`<div class="card draw-card results-controls"><h2>Draw winner${st.winners.length===1?'':'s'}</h2>${st.winners.map(p=>`<div class="winner-name">${esc(p.name)}</div>`).join('')}</div>`:''}${isHost?`<section class="results-controls"><div class="row wrap results-actions"><button class="btn" data-action="save-report">${icon('check',15)} Save results</button><button class="btn" data-action="results-csv">${icon('download',15)} CSV</button><a class="btn primary" href="#dashboard">My quizzes ${icon('arrow',15)}</a></div><details class="card draw-card"><summary>Random draw</summary><form id="draw-form" class="draw-form"><label class="sr-only" for="draw-mode">Eligible group</label><select class="input" id="draw-mode"><option value="all">All players</option><option value="correct">Players with a correct answer</option><option value="top">Top scorers</option></select><label class="sr-only" for="draw-count">Number of winners</label><input class="input" id="draw-count" type="number" min="1" max="50" value="1" required><button class="btn green" type="submit">${icon('shuffle',16)} Draw</button></form></details></section>`:`<div class="results-home"><a class="quiet-button" href="#">Home ${icon('arrow',14)}</a></div>`}</main>`;
}
function roundHistory(rounds,show=true) {
  return `<div class="round-history">${rounds.map(r=>`<section class="card round-history-card"><div class="row between"><h2>${esc(r.title)}</h2>${r.reward?`<span class="round-reward">${icon('trophy',15)} ${esc(r.reward)}</span>`:''}</div><div class="round-history-winners">${r.winners?.length?r.winners.map(p=>esc(p.name)).join(' · '):'No winner'}${r.tied?' <span class="muted">(tied)</span>':''}</div>${show?`<details><summary>Leaderboard</summary>${leaderboard(r.leaderboard||[])}</details>`:''}</section>`).join('')}</div>`;
}
function updateTimer() {
  const st=S.roomState;if(!st)return;
  const remainingMs=st.deadline==null?null:Math.max(0,st.deadline-(S.clock?.now()??Date.now()));
  const remaining=remainingMs==null?null:Math.ceil(remainingMs/1000);
  const countdown=$('#countdown-number');if(st.phase==='countdown'&&countdown){countdown.textContent=remaining??'—';return;}
  const timer=$('#live-timer');if(!timer)return;
  const seconds=st.phase==='question'?remaining??0:0;
  $('span',timer).textContent=st.phase==='reveal'?'✓':st.deadline==null?'∞':seconds;timer.classList.toggle('urgent',seconds<=5&&st.phase==='question');
  const fill=$('#timer-fill');if(fill)fill.style.width=`${st.phase==='question'?Math.max(0,Math.min(100,(remainingMs??0)/((st.question?.timeLimit||20)*1000)*100)):0}%`;
}
setInterval(updateTimer,250);
function accountChatView(unlocked=null,error='') {
  if(error)return `<div class="error-note" role="alert">${esc(error)}</div><button class="btn" data-action="account-chat-refresh">Try again</button>`;
  if(unlocked===null)return '<p class="muted"><span class="spinner"></span> Loading…</p>';
  if(unlocked)return `<p class="account-chat-status">${icon('check',17)} Chat unlocked</p><p class="small muted">Available for all your quizzes.</p>`;
  return `<form id="account-chat-form"><div class="field"><label for="account-chat-code">12-digit invitation code</label><input id="account-chat-code" type="password" inputmode="numeric" pattern="[0-9]{12}" minlength="12" maxlength="12" autocomplete="off" placeholder="••••••••••••" required></div><div id="account-chat-error" role="alert"></div><button class="btn primary" type="submit">${icon('lock',16)} Unlock chat</button></form>`;
}
async function loadAccountChat() {
  const ownerId=activeUser()?.id;
  try{const result=await backend('/api/account/chat',null,'GET');if(location.hash==='#account'&&activeUser()?.id===ownerId&&$('#account-chat-content'))$('#account-chat-content').innerHTML=accountChatView(result.unlocked===true);}
  catch(error){if(location.hash==='#account'&&activeUser()?.id===ownerId&&$('#account-chat-content'))$('#account-chat-content').innerHTML=accountChatView(null,error.message);}
}
function accountView() {
  shell(`<main class="page"><div class="page-head"><div><a class="quiet-button" href="#dashboard" style="padding:0;margin-bottom:15px">${icon('back',14)} My quizzes</a><h1>Account</h1></div></div><section class="card account-section"><h2 style="font-size:22px">Your account</h2><p>Signed in as <span class="subtle">${esc(activeUser()?.email)}</span></p><button class="btn" data-action="sign-out">${icon('logout',15)} Sign out</button></section><section class="card account-section"><h2 style="font-size:22px">Room chat</h2><div id="account-chat-content">${accountChatView()}</div></section><section class="card account-section"><h2 style="font-size:22px">Change your password</h2><form id="password-form"><div class="field"><label for="new-password">New password</label><input id="new-password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></div><button class="btn" type="submit">Update password</button></form></section><section class="card account-section"><h2 style="font-size:22px">Delete your account</h2><p>Permanently deletes your account, quizzes, images and results.</p><button class="btn danger" data-action="delete-account">Delete my account</button></section></main>`);
  void loadAccountChat();
}
function csvFor(players,rounds=[]) {
  const cell=value=>{let s=String(value??'');if(/^[=+\-@\t\r]/.test(s))s="'"+s;return `"${s.replace(/"/g,'""')}"`;};
  const rows=rounds.length?[['Round','Reward','Rank','Player','Points','Winner'],...rounds.flatMap(r=>(r.leaderboard||[]).map((p,i)=>[r.title,r.reward,p.rank??i+1,p.name,p.score||0,(r.winners||[]).some(w=>w.id===p.id)?'Yes':'']))]:[['Rank','Player','Points'],...players.map((p,i)=>[p.rank??i+1,p.name,p.score||0])];
  return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
async function copyLink() {
  const link=roomLink(S.room.code);
  try{await navigator.clipboard.writeText(link);toast('Link copied.');}
  catch{modal('Share link',`<input class="input" value="${esc(link)}" readonly aria-label="Invitation link">`,'',()=>{$('.modal input').select();});}
}
const actions = {
  'close-modal':closeModal,
  'account-chat-refresh':loadAccountChat,
  'zoom-answer':zoomAnswer,
  'auth-mode':el=>{S.authMode=el.dataset.mode;S.authMessage='';authView();},
  'reload-dashboard':dashboard,
  'dashboard-tab':el=>{S.dashboardTab=el.dataset.tab;renderDashboard();},
  'new-quiz':()=>{S.draft=blankQuiz();S.questionIndex=0;S.dirty=true;location.hash=`#edit/${S.draft.id}`;renderEditor();setTimeout(()=>{const details=$('.editor-settings');if(details)details.open=true;$('#quiz-title')?.focus();$('#quiz-title')?.select();},20);},
  'sample':sampleQuiz,
  'remove-question-image':()=>{S.draft.questions[S.questionIndex].image='';markDirty();renderEditor();},
  'remove-answer-image':el=>{const option=S.draft.questions[S.questionIndex].options.find(o=>o.id===el.dataset.id);if(option){option.image='';markDirty();renderEditor();}},
  'copy-ai-prompt':copyAIPrompt,
  'save-quiz':()=>saveQuiz(),
  'host-draft':async()=>{const d=await saveQuiz(true);await hostQuiz(d.id,d.settings);},
  'host-quiz':el=>hostQuiz(el.dataset.id),
  'export-quiz':exportQuiz,
  'select-question':el=>{S.questionIndex=Number(el.dataset.index);S.currentRoundId=questionRound(S.draft.questions[S.questionIndex].id)?.id;renderEditor();},
  'add-question':()=>{if(S.draft.questions.length>=500)throw new Error('A quiz can have up to 500 questions.');const roundId=S.currentRoundId||questionRound(S.draft.questions[S.questionIndex]?.id)?.id||S.draft.settings.rounds?.[0]?.id,q=newQuestion();S.draft.questions.push(q);if(roundId)assignQuestion(q.id,roundId);S.questionIndex=S.draft.questions.length-1;markDirty();renderEditor();},
  'duplicate-question':()=>{const q=structuredClone(S.draft.questions[S.questionIndex]),roundId=questionRound(q.id)?.id;q.id=uid();S.draft.questions.splice(S.questionIndex+1,0,q);if(roundId)assignQuestion(q.id,roundId);S.questionIndex++;markDirty();renderEditor();},
  'delete-question':()=>{const [q]=S.draft.questions.splice(S.questionIndex,1);for(const r of S.draft.settings.rounds||[])r.questionIds=r.questionIds.filter(id=>id!==q.id);S.questionIndex=Math.max(0,S.questionIndex-1);markDirty();renderEditor();},
  'move-question':el=>moveReordered('questions',S.draft.questions[S.questionIndex].id,S.questionIndex+Number(el.dataset.direction)),
  'add-round':()=>{ensureRounds();if(S.draft.settings.rounds.length>=100)throw new Error('A quiz can have up to 100 rounds.');const r={id:uid(),title:`Round ${S.draft.settings.rounds.length+1}`,reward:'',questionIds:[]};S.draft.settings.rounds.push(r);S.currentRoundId=r.id;markDirty();renderEditor();$(`[data-round-id="${r.id}"][data-rfield="title"]`)?.focus();},
  'delete-round':el=>{const rounds=S.draft.settings.rounds,index=rounds.findIndex(r=>r.id===el.dataset.id);if(rounds.length<2||index<0)return;const [removed]=rounds.splice(index,1),target=rounds[Math.max(0,index-1)];target.questionIds.push(...removed.questionIds);S.currentRoundId=target.id;syncRoundOrder();markDirty();renderEditor();},
  'move-round':el=>{const rounds=S.draft.settings.rounds,index=rounds.findIndex(r=>r.id===el.dataset.id),next=index+Number(el.dataset.direction);if(next<0||next>=rounds.length)return;[rounds[index],rounds[next]]=[rounds[next],rounds[index]];markDirty();renderEditor();},
  'add-option':()=>{const q=S.draft.questions[S.questionIndex];if(q.options.length>=8)return;q.options.push({id:uid(),text:'',image:''});if(q.type==='order')q.correct=q.options.map(o=>o.id);markDirty();renderEditor();},
  'remove-option':el=>{const q=S.draft.questions[S.questionIndex];if(q.options.length<=2)throw new Error('Keep at least two answer choices.');q.options=q.options.filter(o=>o.id!==el.dataset.id);q.correct=q.correct.filter(id=>id!==el.dataset.id);markDirty();renderEditor();},
  'move-option':el=>moveReordered('editor-order',el.dataset.id,S.draft.questions[S.questionIndex].options.findIndex(o=>o.id===el.dataset.id)+Number(el.dataset.direction)),
  'duplicate-quiz':async el=>{const quiz=S.quizzes.find(q=>q.id===el.dataset.id),copy=cloneQuizQuestions(structuredClone(quiz));delete copy.created_at;copy.id=uid();copy.title=`${quiz.title.slice(0,110)} (copy)`;copy.updated_at=new Date().toISOString();const result=await db('giveaway_quizzes',{method:'POST',body:copy});S.quizzes.unshift(result[0]);renderDashboard();toast('Quiz duplicated.');},
  'delete-quiz':el=>{const quiz=S.quizzes.find(q=>q.id===el.dataset.id);modal('Delete this quiz?',`<p>“${esc(quiz.title)}” will be permanently deleted. Saved results will stay.</p>`,`<button class="btn danger" data-action="confirm-delete-quiz" data-id="${quiz.id}">Delete quiz</button>`);},
  'confirm-delete-quiz':async el=>{await db(`giveaway_quizzes?id=eq.${encodeURIComponent(el.dataset.id)}`,{method:'DELETE'});S.quizzes=S.quizzes.filter(q=>q.id!==el.dataset.id);closeModal();renderDashboard();toast('Quiz deleted.');},
  'copy-link':copyLink,
  'reconnect':()=>{if(S.room&&!S.fatalRoomError){S.retries=1;return openSocket();}},
  'room-start':()=>send({type:'start'}),
  'room-reveal':()=>send({type:'reveal'}),
  'room-next':()=>send({type:'next'}),
  'room-next-round':()=>send({type:'next_round'}),
  'room-finish-final':()=>send({type:'finish'}),
  'draw-round':()=>send({type:'draw_round'}),
  'room-lock':()=>send({type:'lock',locked:!S.roomState.locked}),
  'room-finish':()=>modal('End quiz?',`<p>Ends the quiz for all players.</p>`,'<button class="btn primary" data-action="confirm-finish">Show results</button>'),
  'confirm-finish':()=>{send({type:'finish'});closeModal();},
  'kick-player':el=>modal('Remove this player?',`<p>${esc(el.dataset.name)} will be removed from this quiz.</p>`,`<button class="btn danger" data-action="confirm-kick" data-id="${el.dataset.id}">Remove player</button>`),
  'confirm-kick':el=>{send({type:'kick',playerId:el.dataset.id});closeModal();},
  'leave-room':()=>modal('Leave quiz?',`<p>${S.room.role==='host'?'Your players will stay in the room. You can come back to this tab and reconnect.':'You can rejoin from this browser while the room is still open.'}</p>`,'<button class="btn primary" data-action="confirm-leave">Leave quiz</button>'),
  'confirm-leave':()=>{closeModal();disconnectRoom();S.room=null;S.roomState=null;S.fatalRoomError=null;location.hash='#';},
  'choose-answer':el=>{const q=S.roomState?.question;if(!S.connected||!q||S.answerSent||S.answerPending||S.room.role==='host')return;if(q.type==='multi'){if(!Array.isArray(S.selection))S.selection=[];S.selection=S.selection.includes(el.dataset.id)?S.selection.filter(id=>id!==el.dataset.id):[...S.selection,el.dataset.id];refreshAnswerUI();}else sendAnswer(el.dataset.id);},
  'submit-multi':()=>{if(S.selection?.length)sendAnswer(S.selection);},
  'submit-order':()=>sendAnswer(S.order),
  'submit-slider':()=>sendAnswer(Number($('#player-slider')?.value??S.selection)),
  'submit-pin':()=>{if(S.pin)sendAnswer(S.pin);},
  'player-order':el=>moveReordered('player-order',S.order[Number(el.dataset.index)],Number(el.dataset.index)+Number(el.dataset.direction)),
  'save-report':async()=>{await backend(`/api/rooms/${S.room.code}/report`,{});toast('Results saved.');},
  'results-csv':()=>download(`${slug(S.roomState.title)}-results.csv`,csvFor(S.roomState.leaderboard||[],S.roomState.roundResults||[]),'text/csv;charset=utf-8'),
  'report-csv':el=>{const report=S.reports.find(r=>r.id===el.dataset.id);download(`${slug(report.quiz_title||'quiz')}-results.csv`,csvFor(report.results?.leaderboard||report.results?.players||(Array.isArray(report.results)?report.results:[]),report.results?.roundResults||[]),'text/csv;charset=utf-8');},
  'report-view':el=>{const report=S.reports.find(r=>r.id===el.dataset.id),players=report.results?.leaderboard||report.results?.players||(Array.isArray(report.results)?report.results:[]);modal(report.quiz_title||'Quiz results',`<p>${dateLabel(report.created_at)} · Code ${esc(report.room_code)}</p><div class="report-detail">${report.results?.roundResults?.length?roundHistory(report.results.roundResults):leaderboard(players)}</div>`,`<button class="btn primary" data-action="report-csv" data-id="${report.id}">Download CSV</button>`);},
  'sign-out':async()=>{try{await authRequest('logout',null,'POST',await getToken());}catch{}saveSession(null);S.quizzes=[];S.reports=[];S.draft=null;S.dirty=false;location.hash='#';home();toast('Signed out.');},
  'delete-account':()=>modal('Delete your account?',`<p>This permanently removes your account, every quiz, your uploaded images and all saved results. This can’t be undone.</p><div class="field"><label for="delete-confirm">Type DELETE to continue</label><input id="delete-confirm" autocomplete="off" placeholder="DELETE"></div><div id="delete-error" role="alert"></div>`,'<button class="btn danger" id="delete-account-button" data-action="confirm-delete-account" disabled>Permanently delete</button>'),
  'confirm-delete-account':async()=>{if($('#delete-confirm')?.value!=='DELETE')return;await backend('/api/account',null,'DELETE');closeModal();saveSession(null);S.draft=null;S.quizzes=[];S.reports=[];S.dirty=false;location.hash='#';home();toast('Your account and data have been deleted.');}
};
document.addEventListener('click',async event=>{
  if(event.target.classList.contains('modal-backdrop')){closeModal();return;}
  const el=event.target.closest('[data-action]');if(!el||el.disabled)return;if(S.chat?.handleAction(el.dataset.action,el)){event.preventDefault();return;}const action=actions[el.dataset.action];if(!action)return;event.preventDefault();
  try {const result=action(el);if(result&&typeof result.then==='function'){el.disabled=true;await result;}}
  catch(error){toast(error.message||'Something went wrong. Please try again.',true);if(el.dataset.action==='confirm-delete-account'&&$('#delete-error'))$('#delete-error').innerHTML=`<div class="error-note">${esc(error.message)}</div>`;}
  finally {if(el.isConnected){if(el.closest('.live-question'))refreshAnswerUI();else if(!['submit-multi','submit-pin'].includes(el.dataset.action))el.disabled=false;}}
});
document.addEventListener('input',event=>{
  const el=event.target;
  if(el.id==='chat-input'){if(S.chat)S.chat.draft=el.value;el.style.height='auto';el.style.height=Math.min(140,el.scrollHeight)+'px';return;}
  if(['chat-unlock-code','account-chat-code'].includes(el.id)){el.value=el.value.replace(/\D/g,'').slice(0,12);return;}
  if(el.id==='delete-confirm'){$('#delete-account-button').disabled=el.value!=='DELETE';return;}
  if(el.id==='join-code'){el.value=el.value.replace(/\D/g,'').slice(0,6);return;}
  if(el.id==='quiz-search'){S.search=el.value;$('#quiz-list').innerHTML=quizCards();return;}
  if(el.id==='player-slider'){S.selection=Number(el.value);$('#slider-output').textContent=el.value;return;}
  if(el.id==='player-text'){S.selection=el.value;return;}
  if(!S.draft)return;
  if(el.dataset.rfield){const round=S.draft.settings.rounds.find(r=>r.id===el.dataset.roundId);if(round){round[el.dataset.rfield]=el.value;markDirty();}return;}
  if(el.dataset.dfield){S.draft[el.dataset.dfield]=el.value;markDirty();}
  if(el.dataset.sfield){S.draft.settings[el.dataset.sfield]=el.type==='checkbox'?el.checked:el.type==='number'?Math.max(0,Math.floor(Number(el.value))):el.value;markDirty();}
  const q=S.draft.questions[S.questionIndex];if(!q)return;
  if(el.dataset.qfield&&el.dataset.qfield!=='type') {const key=el.dataset.qfield;q[key]=key==='acceptedAnswers'?el.value.split('\n').map(s=>s.trim()).filter(Boolean):['min','max','target','tolerance','timeLimit','points'].includes(key)?Number(el.value):el.value;markDirty();const label=$('.question-item.active strong'),meta=$('.question-item.active small');if(label)label.textContent=q.prompt||'Your next question';if(meta)meta.textContent=`${TYPES[q.type]} · ${q.timeLimit}s`;}
  if(el.dataset.option){const option=q.options.find(o=>o.id===el.dataset.option);if(option){option[el.dataset.ofield]=el.value;markDirty();}}
  if(el.hasAttribute('data-pin-tolerance')){q.tolerance=Number(el.value)/100;markDirty();}
});
document.addEventListener('change',async event=>{
  const el=event.target;
  try {
    if(el.id==='collection-filter'){S.filter=el.value;$('#quiz-list').innerHTML=quizCards();return;}
    if(el.id==='import-quiz'){await importQuiz(el.files[0]);el.value='';return;}
    if(el.dataset.upload){el.disabled=true;toast('Uploading your image…');await uploadImage(el.files[0],el.dataset.upload);return;}
    if(!S.draft)return;
    if(el.dataset.sfield==='roundsEnabled'){if(el.checked)ensureRounds();markDirty();renderEditor();return;}
    if(el.id==='question-round'){assignQuestion(S.draft.questions[S.questionIndex].id,el.value);S.currentRoundId=el.value;markDirty();renderEditor();return;}
    const q=S.draft.questions[S.questionIndex];if(!q)return;
    if(el.dataset.qfield==='type'){
      const fresh=newQuestion(el.value);S.draft.questions[S.questionIndex]={...fresh,id:q.id,prompt:q.prompt,image:q.image,timeLimit:q.timeLimit,explanation:q.explanation};markDirty();renderEditor();
    } else if(el.dataset.correct){if(['single','true_false'].includes(q.type))q.correct=el.checked?[el.dataset.correct]:[];else q.correct=el.checked?[...new Set([...q.correct,el.dataset.correct])]:q.correct.filter(id=>id!==el.dataset.correct);markDirty();renderEditor();}
    else if(el.dataset.qfield==='image'||el.dataset.ofield==='image'){renderEditor();}
  }catch(error){toast(error.message,true);el.disabled=false;}
});
document.addEventListener('click',event=>{
  const pin=event.target.closest('#editor-pin, #player-pin');if(!pin)return;const box=pin.getBoundingClientRect(),point={x:Math.max(0,Math.min(1,(event.clientX-box.left)/box.width)),y:Math.max(0,Math.min(1,(event.clientY-box.top)/box.height))};
  if(pin.id==='player-pin'&&(!S.connected||$('img',pin)?.dataset.ready!=='true'))return;
  if(pin.id==='editor-pin'){S.draft.questions[S.questionIndex].target=point;markDirty();}else{if(S.answerSent||S.answerPending||S.roomState?.phase!=='question')return;S.pin=point;const submit=$('[data-action="submit-pin"]');if(submit)submit.disabled=false;}
  let marker=$('.pin-dot',pin);if(!marker){marker=document.createElement('span');marker.className='pin-dot'+(pin.id==='editor-pin'?' target':'');pin.append(marker);}marker.style.left=point.x*100+'%';marker.style.top=point.y*100+'%';
});
document.addEventListener('submit',async event=>{
  const form=event.target;event.preventDefault();if(form.id==='chat-form'){try{await S.chat?.submit(form);}catch(error){toast(error.message,true);}return;}const button=$('button[type="submit"]',form),original=button?.innerHTML;if(button){button.disabled=true;button.innerHTML='<span class="spinner"></span> Loading…';}
  try {
    if(S.chat&&['chat-form','chat-unlock-form','announcement-form','chat-settings-form'].includes(form.id)){await S.chat.submit(form);}
    else if(form.id==='account-chat-form'){
      await backend('/api/account/chat',{code:$('#account-chat-code').value});
      if($('#account-chat-content'))$('#account-chat-content').innerHTML=accountChatView(true);
      toast('Chat unlocked.');
    }else if(form.id==='auth-form'){
      const email=$('#auth-email')?.value.trim(),password=$('#auth-password')?.value;
      if(S.authMode==='recover'){await authRequest(`recover?redirect_to=${encodeURIComponent(location.origin+location.pathname)}`,{email});S.authMessage='Check your inbox for a password reset link.';authView();}
      else if(S.authMode==='reset'){await authRequest('user',{password},'PUT',await getToken());S.authMode='login';toast('New password saved.');location.hash='#dashboard';}
      else{
        const signup=S.authMode==='signup';const data=await authRequest(signup?`signup?redirect_to=${encodeURIComponent(location.origin+location.pathname)}`:'token?grant_type=password',{email,password});
        if(data.access_token){saveSession(data);S.authMessage='';location.hash='#dashboard';}else{S.authMessage='Check your email to confirm your account, then sign in here.';S.authMode='login';authView();}
      }
    } else if(form.id==='join-form'){
      const code=$('#join-code').value,name=$('#join-name').value.trim();if(!/^\d{6}$/.test(code)||!name)throw new Error('Enter a six digit code and your name.');
      let previous;try{previous=JSON.parse(sessionStorage.getItem(`gather.player.${code}`)||'null');}catch{}
      S.room={...previous,code,role:'player',name};localStorage.setItem('gather.name',name);S.fatalRoomError=null;location.hash=`#room/${code}`;connectRoom();
    }else if(form.id==='text-answer-form'){const answer=$('#player-text').value.trim();if(answer)sendAnswer(answer);}
    else if(form.id==='draw-form'){send({type:'draw',mode:$('#draw-mode').value,count:Number($('#draw-count').value)});}
    else if(form.id==='password-form'){await authRequest('user',{password:$('#new-password').value},'PUT',await getToken());form.reset();toast('Your password has been updated.');}
  }catch(error){const target=form.id==='account-chat-form'?$('#account-chat-error'):$('#form-error');if(target)target.innerHTML=`<div class="error-note">${esc(error.message)}</div>`;else toast(error.message,true);}
  finally{if(button?.isConnected){button.innerHTML=original;if(form.id==='text-answer-form')refreshAnswerUI();else button.disabled=false;}}
});
document.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing&&event.target.id==='chat-input'){event.preventDefault();if(!S.chat?.sending&&event.target.value.trim())$('#chat-form')?.requestSubmit();return;}
  if(event.key==='Escape'&&S.chat?.open&&(S.chat.menuFor||S.chat.emojiFor)){S.chat.menuFor=null;S.chat.emojiFor=null;S.chat.refresh();return;}
  if(event.key==='Escape'&&S.chat?.open){S.chat.close();S.chat.refresh();document.querySelector('.chat-launch')?.focus();return;}
  if(event.key==='Escape'&&$('.modal')){closeModal();return;}
  if(event.key==='Tab'&&($('.modal')||$('.chat-panel'))){const all=$$('button:not(:disabled),input:not(:disabled),select,a[href],textarea:not(:disabled)',$('.modal')||$('.chat-panel'));const first=all[0],last=all[all.length-1];if(event.shiftKey&&document.activeElement===first){last?.focus();event.preventDefault();}else if(!event.shiftKey&&document.activeElement===last){first?.focus();event.preventDefault();}}
  if(/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)||$('.modal')||$('.chat-panel'))return;
  if(S.room?.role==='player'&&S.roomState?.phase==='question'&&!S.answerSent&&!S.answerPending&&/^[1-8]$/.test(event.key)){
    const q=S.roomState.question;if(!['single','multi','true_false','poll'].includes(q.type))return;const o=q.options[Number(event.key)-1];if(o){event.preventDefault();const el=$(`[data-action="choose-answer"][data-id="${o.id}"]`);el?.click();}
  }
});
let routeVersion=0;
async function route() {
  const version=++routeVersion,raw=location.hash.slice(1),[path,...parts]=raw.split('/');
  closeModal();window.scrollTo(0,0);
  if(path!=='room'&&S.ws){disconnectRoom();S.roomState=null;}
  if(path==='host'||path==='dashboard'||path==='account'||path==='edit'){
    if(!activeUser()){S.authMode='login';authView();return;}
    if(path==='host'||path==='dashboard'){await dashboard();return;}
    if(path==='account'){accountView();return;}
    if(path==='edit'){await openEditor(parts[0]);return;}
  }
  if(path==='join'){joinView(parts[0]||'');return;}
  if(path==='room'){
    const code=parts[0];if(!/^\d{6}$/.test(code||'')){location.hash='#join';return;}
    if(S.room?.code===code&&S.ws){renderRoom();return;}
    if(!S.room||S.room.code!==code){let player;try{player=JSON.parse(sessionStorage.getItem(`gather.player.${code}`)||'null');}catch{}
      if(sessionStorage.getItem(`gather.host.${code}`)&&activeUser())S.room={code,role:'host'};else if(player)S.room=player;else{location.hash=`#join/${code}`;return;}}
    S.fatalRoomError=null;connectRoom();return;
  }
  if(path==='reset'){S.authMode='reset';authView();return;}
  if(version===routeVersion)home();
}
window.addEventListener('hashchange',()=>route().catch(error=>toast(error.message,true)));
window.addEventListener('resize',fitChoiceQuestion);
window.visualViewport?.addEventListener('resize',fitChoiceQuestion);
document.fonts?.ready.then(fitChoiceQuestion);
window.addEventListener('beforeunload',event=>{if(S.dirty){event.preventDefault();event.returnValue='';}});
window.addEventListener('online',()=>{if(S.room&&!S.fatalRoomError){S.retries=1;void openSocket();}});
window.addEventListener('offline',()=>{if(S.room&&!S.fatalRoomError){S.connected=false;S.connectionStatus='offline';clearTimeout(S.reconnectTimer);clearInterval(S.heartbeat);clearTimeout(S.connectTimeout);S.wsGeneration++;const ws=S.ws;S.ws=null;if(ws){ws.onclose=null;ws.close();}updateConnection();}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&S.room&&!S.fatalRoomError&&(S.ws?.readyState!==WebSocket.OPEN||Date.now()-(S.lastSocketMessage||0)>=7500)){S.retries=1;void openSocket();}});
async function boot() {
  try {
    const inline=window.GATHER_CONFIG||{};let runtime={},sameOriginBackend=false;
    const completeRemote=!!(inline.apiUrl&&inline.supabaseUrl&&inline.supabaseKey);
    const preferLocal=!inline.apiUrl||['localhost','127.0.0.1','[::1]'].includes(location.hostname);
    if(!completeRemote||preferLocal){
      try{runtime=await request(new URL('./api/config',location.href))||{};sameOriginBackend=!!(runtime.supabaseUrl&&runtime.supabaseKey);}catch{}
    }
    if(!sameOriginBackend&&!completeRemote&&inline.apiUrl){try{runtime=await request(`${inline.apiUrl.replace(/\/$/,'')}/api/config`)||{};}catch{}}
    S.config={...runtime,...Object.fromEntries(Object.entries(inline).filter(([,v])=>v!==''&&v!=null))};
    if(sameOriginBackend)S.config.apiUrl='';
    S.config.apiUrl=(S.config.apiUrl||'').replace(/\/$/,'');S.config.supabaseUrl=(S.config.supabaseUrl||'').replace(/\/$/,'');
    window.GATHER_CONFIG={...S.config};
    const hash=new URLSearchParams(location.hash.slice(1));
    if(hash.get('access_token')){
      const token=hash.get('access_token'),user=await authRequest('user',null,'GET',token);
      saveSession({access_token:token,refresh_token:hash.get('refresh_token'),expires_at:Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600),user});
      const recovery=hash.get('type')==='recovery';history.replaceState(null,'',`${location.pathname}${location.search}${recovery?'#reset':'#dashboard'}`);
    }
    if(S.session){try{if((S.session.expires_at||0)*1000<Date.now()+30000)await refreshToken();else scheduleRefresh();}catch{}}
    await route();
  }catch(error){shell(`<main class="page"><h1 style="font-size:32px">Unable to connect</h1><div class="error-note">${esc(error.message)}</div><a class="btn primary" href="#">Back home</a></main>`);}
}
boot();
