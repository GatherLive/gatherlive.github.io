import type {AppContext} from '../../app/context.js';
import { esc, dateLabel } from '../../core/dom.js';
import {visibleQuizzes,hostedAt} from './filters.js';
import {libraryControls,libraryFooter} from './controls.js';
import { quizTags } from '../../core/tags.js';
import { icon } from '../../core/icons.js';
export function createFeaturesLibraryPage(context: AppContext) {
    const S = context.state;
    const loading = (...args) => context.loading(...args);
    const db = (...args) => context.db(...args);
    const loadOpenRooms = (...args) => context.loadOpenRooms(...args);
    const shell = (...args) => context.shell(...args);
    const isOpenRoom = (...args) => context.isOpenRoom(...args);
    const openRoomCards = (...args) => context.openRoomCards(...args);
    async function dashboard() {
        loading();
        try {
            const owner=context.activeUser()?.id,version=context.routeVersion;
            const [quizzes] = await Promise.all([db('giveaway_quizzes?select=*&order=updated_at.desc'),loadSavedReports(S.reportPage||0,false),loadOpenRooms(false),context.backend('/api/account/usage',null,'GET').then(data=>{if(context.activeUser()?.id===owner){S.accountUsage=data;S.usageOwner=owner;}}).catch(()=>{})]);
            if(owner!==context.activeUser()?.id||version!==context.routeVersion)return;S.quizzes=quizzes;
            renderDashboard();
        }
        catch (error) {
            if (!S.session) {
                location.hash = '#host';
                return;
            }
            shell(`<main class="page"><h1 style="font-size:32px">Your quiz space</h1><div class="error-note">${esc(error.message)}</div><button class="btn" data-action="reload-dashboard">Try again</button></main>`);
        }
    }
    function renderDashboard() {
        const tags = [...new Map(S.quizzes.flatMap(quizTags).map(tag => [tag.toLocaleLowerCase(), tag])).values()].sort((a,b)=>a.localeCompare(b));
        if(S.filter && !tags.some(tag => tag.toLocaleLowerCase() === S.filter.toLocaleLowerCase())) S.filter = '';
        shell(`<main class="page library-page"><div class="page-head"><div><h1>${S.dashboardTab === 'rooms' ? 'Open rooms' : S.dashboardTab === 'reports' ? 'Results' : 'My quizzes'}</h1></div><button class="btn primary" data-action="new-quiz">${icon('plus', 16)} New quiz</button></div><div class="tabs dashboard-tabs"><button class="tab ${S.dashboardTab === 'quizzes' ? 'active' : ''}" data-action="dashboard-tab" data-tab="quizzes">My quizzes <span class="muted">${S.quizzes.length}</span></button><button class="tab ${S.dashboardTab === 'rooms' ? 'active' : ''}" data-action="dashboard-tab" data-tab="rooms">Open rooms <span class="muted" id="open-room-count">${S.openRooms.filter(isOpenRoom).length}</span></button><button class="tab ${S.dashboardTab === 'reports' ? 'active' : ''}" data-action="dashboard-tab" data-tab="reports">Results <span class="muted">${S.reportTotal??S.reports.length}</span></button></div>${S.dashboardTab === 'quizzes' ? `${libraryControls(S,tags)}<div id="quiz-list">${quizCards()}</div>${libraryFooter()}` : S.dashboardTab === 'rooms' ? `<div id="open-rooms">${openRoomCards()}</div>` : reportList()}</main>`);
    }
    function quizCards() {
        const quizzes=visibleQuizzes(S.quizzes,{tag:S.filter,search:S.search,sort:S.quizSort,status:S.quizHostFilter,history:S.hostedQuizzes});
        if (!quizzes.length)
            return `<div class="empty"><div class="empty-icon">${icon('quiz', 27)}</div><h2>${S.quizzes.length ? 'No matches' : 'No quizzes yet'}</h2><p>${S.quizzes.length ? 'Try another search.' : ''}</p></div>`;
        return `<div class="quiz-grid">${quizzes.map(q => `<article class="quiz-card card ${hostedAt(q,S.hostedQuizzes)?'quiz-hosted':''}"><div class="row between"><div class="quiz-illustration">${icon('quiz', 21)}</div><div class="row" style="align-self:flex-start;gap:1px"><button class="icon-btn" data-action="duplicate-quiz" data-id="${esc(q.id)}" aria-label="Duplicate ${esc(q.title)}" title="Duplicate">${icon('copy', 15)}</button><button class="icon-btn" data-action="delete-quiz" data-id="${esc(q.id)}" aria-label="Delete ${esc(q.title)}" title="Delete">${icon('trash', 15)}</button></div></div><a href="#edit/${q.id}"><h3>${esc(q.title)}</h3></a><div class="quiz-meta">${hostedAt(q,S.hostedQuizzes)?`<span class="hosted-label">${icon('check',12)} Hosted</span>`:''}<span>${q.questions?.length || 0} question${q.questions?.length===1?'':'s'}</span><span>·</span><span>${dateLabel(q.updated_at)}</span>${quizTags(q).slice(0,3).map(tag=>`<span class="quiz-tag">${esc(tag)}</span>`).join('')}${quizTags(q).length>3?`<span class="muted small">+${quizTags(q).length-3}</span>`:''}</div><div class="quiz-card-footer"><a class="quiet-button" style="padding-left:0" href="#edit/${q.id}">Edit ${icon('arrow', 13)}</a><button class="btn small primary" data-action="host-quiz" data-id="${q.id}" ${q.questions?.length ? '' : 'disabled'}>${icon('play', 13)} Host</button></div></article>`).join('')}</div>`;
    }
    function reportList() {
        if (!S.reports.length)
            return `<div class="empty"><div class="empty-icon">${icon('trophy', 27)}</div><h2>No results yet</h2></div>`;
        return `<div class="table-wrap"><table class="report-table" role="table"><caption class="sr-only">Saved quiz results</caption><thead role="rowgroup"><tr role="row"><th id="saved-report-quiz" scope="col" role="columnheader">Quiz</th><th id="saved-report-date" scope="col" role="columnheader">Date</th><th id="saved-report-players" scope="col" role="columnheader">Participants</th><th id="saved-report-actions" scope="col" role="columnheader">Results</th></tr></thead><tbody role="rowgroup">${S.reports.map(r => `<tr role="row"><td role="cell" headers="saved-report-quiz">${esc(r.quiz_title || 'Untitled quiz')}<span class="report-mobile-meta">${dateLabel(r.created_at)} · ${r.participantCount??'—'} participants</span></td><td role="cell" headers="saved-report-date">${dateLabel(r.created_at)}</td><td role="cell" headers="saved-report-players">${r.participantCount??'—'}</td><td role="cell" headers="saved-report-actions"><div class="report-row-actions"><span class="report-kind">${r.isDetailed ? 'Detailed' : 'Summary'}</span><button class="quiet-button" data-action="report-view" data-id="${esc(r.id)}" aria-label="View ${esc(r.quiz_title)} results">View ${icon('arrow', 13)}</button><button class="icon-btn" data-action="report-csv" data-id="${esc(r.id)}" title="Download CSV" aria-label="Download ${esc(r.quiz_title)} CSV">${icon('download', 15)}</button><button class="icon-btn report-delete" data-action="delete-report" data-id="${esc(r.id)}" title="Delete saved results" aria-label="Delete ${esc(r.quiz_title || 'quiz')} results">${icon('trash', 15)}</button></div></td></tr>`).join('')}</tbody></table></div>${(S.reportTotal||0)>25?`<div class="saved-results-pager"><span>${(S.reportPage||0)*25+1}–${Math.min(((S.reportPage||0)+1)*25,S.reportTotal)} of ${S.reportTotal}</span><button class="btn small" data-action="saved-reports-page" data-page="${(S.reportPage||0)-1}" ${!S.reportPage?'disabled':''}>Previous</button><button class="btn small" data-action="saved-reports-page" data-page="${(S.reportPage||0)+1}" ${((S.reportPage||0)+1)*25>=S.reportTotal?'disabled':''}>Next</button></div>`:''}`;
    }
    async function loadSavedReports(page=0,render=true){
        const owner=context.activeUser()?.id,version=context.routeVersion;
        const data=await context.backend('/api/account/results?page='+Math.max(0,page),null,'GET');
        if(owner!==context.activeUser()?.id||version!==context.routeVersion)return;
        if(page>0&&!data.reports.length&&data.total)return loadSavedReports(Math.ceil(data.total/data.pageSize)-1,render);
        S.hostedQuizzes||={};for(const row of data.reports)if(row.quiz_id){const previous=S.hostedQuizzes[row.quiz_id]?.lastHostedAt||0,at=Date.parse(row.created_at)||0;if(at>previous)S.hostedQuizzes[row.quiz_id]={lastHostedAt:at};}
        S.reports=data.reports;S.reportTotal=data.total;S.reportPage=data.page;
        if(render&&location.hash==='#dashboard')renderDashboard();
    }
    async function loadSavedReport(id){
        const owner=context.activeUser()?.id;
        if(!owner||!/^[a-f0-9-]{36}$/i.test(id||''))throw new Error('Choose saved results.');
        const report=(await db(`giveaway_reports?id=eq.${id}&owner_id=eq.${owner}&select=*`))[0];
        if(owner!==context.activeUser()?.id)throw new Error('Your account changed. Please try again.');
        if(!report)throw new Error('These saved results were removed. Refresh the list.');
        return report;
    }
    async function refreshQuizzes(){const owner=context.activeUser()?.id,version=context.routeVersion;const [quizzes]=await Promise.all([db('giveaway_quizzes?select=*&order=updated_at.desc'),loadOpenRooms(false)]);if(owner!==context.activeUser()?.id||version!==context.routeVersion)return;S.quizzes=quizzes;renderDashboard();}
    return { actions:{'refresh-quizzes':refreshQuizzes},loadSavedReports,loadSavedReport, dashboard, renderDashboard, quizCards, reportList };
}
