import { esc, dateLabel } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
export function createFeaturesLibraryPage(context) {
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
            [S.quizzes, S.reports] = await Promise.all([db('giveaway_quizzes?select=*&order=updated_at.desc'), db('giveaway_reports?select=*&order=created_at.desc&limit=100'), loadOpenRooms(false)]);
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
        const collections = [...new Set(S.quizzes.map(q => q.collection).filter(Boolean))].sort();
        shell(`<main class="page"><div class="page-head"><div><h1>${S.dashboardTab === 'rooms' ? 'Open rooms' : S.dashboardTab === 'reports' ? 'Results' : 'My quizzes'}</h1></div><button class="btn primary" data-action="new-quiz">${icon('plus', 16)} New quiz</button></div><div class="tabs dashboard-tabs"><button class="tab ${S.dashboardTab === 'quizzes' ? 'active' : ''}" data-action="dashboard-tab" data-tab="quizzes">My quizzes <span class="muted">${S.quizzes.length}</span></button><button class="tab ${S.dashboardTab === 'rooms' ? 'active' : ''}" data-action="dashboard-tab" data-tab="rooms">Open rooms <span class="muted" id="open-room-count">${S.openRooms.filter(isOpenRoom).length}</span></button><button class="tab ${S.dashboardTab === 'reports' ? 'active' : ''}" data-action="dashboard-tab" data-tab="reports">Results <span class="muted">${S.reports.length}</span></button></div>${S.dashboardTab === 'quizzes' ? `<div class="dashboard-tools"><div class="search-field">${icon('search', 16)}<input class="input" id="quiz-search" aria-label="Search quizzes" placeholder="Find a quiz…" value="${esc(S.search)}"></div><select class="input filter-select" id="collection-filter" aria-label="Filter by collection"><option value="">All collections</option>${collections.map(c => `<option ${S.filter === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div><div id="quiz-list">${quizCards()}</div><div class="secondary-actions"><button class="quiet-button" data-action="sample">${icon('spark', 15)} Sample quiz</button><label class="quiet-button file-label">${icon('download', 15)} Import quiz<input type="file" accept="application/json,.json" id="import-quiz" aria-label="Import quiz"></label><button class="quiet-button" data-action="copy-ai-prompt">${icon('copy', 15)} Copy AI prompt</button></div>` : S.dashboardTab === 'rooms' ? `<div id="open-rooms">${openRoomCards()}</div>` : reportList()}</main>`);
    }
    function quizCards() {
        const quizzes = S.quizzes.filter(q => (!S.filter || q.collection === S.filter) && (!S.search || `${q.title} ${q.description} ${q.collection}`.toLowerCase().includes(S.search.toLowerCase())));
        if (!quizzes.length)
            return `<div class="empty"><div class="empty-icon">${icon('quiz', 27)}</div><h2>${S.quizzes.length ? 'No matches' : 'No quizzes yet'}</h2><p>${S.quizzes.length ? 'Try another search.' : ''}</p></div>`;
        return `<div class="quiz-grid">${quizzes.map(q => `<article class="quiz-card card"><div class="row between"><div class="quiz-illustration">${icon('quiz', 21)}</div><div class="row" style="align-self:flex-start;gap:1px"><button class="icon-btn" data-action="duplicate-quiz" data-id="${esc(q.id)}" aria-label="Duplicate ${esc(q.title)}" title="Duplicate">${icon('copy', 15)}</button><button class="icon-btn" data-action="delete-quiz" data-id="${esc(q.id)}" aria-label="Delete ${esc(q.title)}" title="Delete">${icon('trash', 15)}</button></div></div><a href="#edit/${q.id}"><h3>${esc(q.title)}</h3></a><div class="quiz-meta"><span>${q.questions?.length || 0} questions</span><span>·</span><span>${dateLabel(q.updated_at)}</span>${q.collection ? `<span class="pill">${esc(q.collection)}</span>` : ''}</div><div class="quiz-card-footer"><a class="quiet-button" style="padding-left:0" href="#edit/${q.id}">Edit quiz ${icon('arrow', 13)}</a><button class="btn small primary" data-action="host-quiz" data-id="${q.id}" ${q.questions?.length ? '' : 'disabled'}>${icon('play', 13)} Host</button></div></article>`).join('')}</div>`;
    }
    function reportList() {
        if (!S.reports.length)
            return `<div class="empty"><div class="empty-icon">${icon('trophy', 27)}</div><h2>No results yet</h2></div>`;
        return `<div class="table-wrap"><table class="report-table" role="table"><caption class="sr-only">Saved quiz results</caption><thead role="rowgroup"><tr role="row"><th id="saved-report-quiz" scope="col" role="columnheader">Quiz</th><th id="saved-report-date" scope="col" role="columnheader">Date</th><th id="saved-report-players" scope="col" role="columnheader">Players</th><th id="saved-report-actions" scope="col" role="columnheader">Results</th></tr></thead><tbody role="rowgroup">${S.reports.map(r => `<tr role="row"><td role="cell" headers="saved-report-quiz">${esc(r.quiz_title || 'Untitled quiz')}<span class="report-mobile-meta">${dateLabel(r.created_at)} · ${(r.results?.leaderboard || r.results?.players || r.results || []).length || 0} participants</span></td><td role="cell" headers="saved-report-date">${dateLabel(r.created_at)}</td><td role="cell" headers="saved-report-players">${(r.results?.leaderboard || r.results?.players || r.results || []).length || 0}</td><td role="cell" headers="saved-report-actions"><div class="report-row-actions"><span class="report-kind">${r.results?.questions && r.results?.players ? 'Detailed' : 'Summary'}</span><button class="quiet-button" data-action="report-view" data-id="${esc(r.id)}" aria-label="View ${esc(r.quiz_title)} results">View ${icon('arrow', 13)}</button><button class="icon-btn" data-action="report-csv" data-id="${esc(r.id)}" title="Download CSV" aria-label="Download ${esc(r.quiz_title)} CSV">${icon('download', 15)}</button><button class="icon-btn report-delete" data-action="delete-report" data-id="${esc(r.id)}" title="Delete saved results" aria-label="Delete ${esc(r.quiz_title || 'quiz')} results">${icon('trash', 15)}</button></div></td></tr>`).join('')}</tbody></table></div>`;
    }
    return { dashboard, renderDashboard, quizCards, reportList };
}
