import { createResultsTablesView } from './views/tables.js';
import { createResultsOverviewView } from './views/overview.js';
import { createResultsResponsesView } from './views/responses.js';
import { createResultsParticipantsView } from './views/participants.js';
import { createResultsRoundsView } from './views/rounds.js';
import { createResultsDownloadsView } from './views/downloads.js';
import { analyze, hasDetails, answerText, correctText, escapeHTML as esc, seconds, typeLabel, reportBase, OPINION_TYPES } from './data.js';
import { reportIcon as icon } from './icons.js';
import { exportFile, saveBlob, zipFiles } from './export.js';
import { overviewPies, renderPieChart, bindPieCharts } from './charts.js';
const fmt = n => n == null ? '—' : Number(n).toLocaleString(undefined, { maximumFractionDigits: 1 });
const rate = n => n == null ? '—' : n + '%';
const PAGE = 25, RESPONSE_PAGE = 10;
const defaults = { summary: true, participants: true, questions: true, responses: false, correct: true, explanations: true, rounds: true, scores: true, timing: false, charts: false, names: true, theme: 'dark', format: 'pdf' };
export function mountResults(root, { report, saved = false, onSave = null, back = '#dashboard', onNotice = null, backIcon = icon('back', 14), isActive = () => root.isConnected }) {
    const data = analyze(report), state = { tab: 'overview', responseView: 'questions', question: 0, student: '', sort: 'name', sortDirection: 'ascending', roundPage: 0, positions: {}, search: '', responseSearch: '', page: 0, responsePage: 0, notice: '', error: false, saved, saving: false, exporting: false, cancel: false, customOpen: false, scope: 'whole', pies: {}, options: { ...defaults } };
    const pies = overviewPies(data);
    const unbindPies = bindPieCharts(root, { models: pies, selections: state.pies, onSelect: (id, key) => { state.pies[id] = key; } });
    let expiryTimer, lastCardKey = '';
    const expired = () => !state.saved && Date.now() >= (report.finishedAt || 0) + 15 * 60 * 1000;
    const idLabel = () => state.student ? data.players.find(p => p.id === state.student)?.name : '';
    // Live getters keep views connected to this instance, including async route changes.
    const viewContext = { get answerText() { return answerText; }, get correctText() { return correctText; }, get data() { return data; }, get esc() { return esc; }, get fmt() { return fmt; }, get icon() { return icon; }, get idLabel() { return idLabel; }, get OPINION_TYPES() { return OPINION_TYPES; }, get PAGE() { return PAGE; }, get pager() { return pager; }, get participantAnswer() { return participantAnswer; }, get participants() { return participants; }, get participantTable() { return participantTable; }, get pies() { return pies; }, get rate() { return rate; }, get renderPieChart() { return renderPieChart; }, get report() { return report; }, get RESPONSE_PAGE() { return RESPONSE_PAGE; }, get seconds() { return seconds; }, get state() { return state; }, get table() { return table; }, get typeLabel() { return typeLabel; } };
    const { table, pager, participantTable } = createResultsTablesView(viewContext);
    const { overview } = createResultsOverviewView(viewContext);
    const { questionPicker, responses, distributionBars, answerKey, questionView, participantAnswer } = createResultsResponsesView(viewContext);
    const { participants } = createResultsParticipantsView(viewContext);
    const { rounds } = createResultsRoundsView(viewContext);
    const { downloads } = createResultsDownloadsView(viewContext);
    function message(text, error = false) {
        state.notice = onNotice && !error ? '' : text;
        state.error = error;
        if (onNotice && !error)
            onNotice(text, false);
        const status = root.querySelector('#results-status');
        if (status) {
            status.textContent = state.notice;
            status.classList.toggle('error-note', error);
        }
    }
    function responseKey() { return state.responseView === 'questions' ? 'question:' + state.question : 'participant:' + (state.student || 'list'); }
    function openResponse(update, focus) {
        if (state.tab === 'responses')
            state.positions[responseKey()] = window.scrollY;
        update();
        state.tab = 'responses';
        render();
        const tab = root.querySelector('.analytics-tabs'), top = state.positions[responseKey()] ?? Math.max(0, tab.getBoundingClientRect().top + window.scrollY - 12);
        window.scrollTo({ top, behavior: 'instant' });
        root.querySelector(focus)?.focus({ preventScroll: true });
    }
    function render() {
        if (!isActive())
            return;
        if (expired()) {
            root.innerHTML = `<main class="page analytics"><a class="quiet-button back-link" href="#dashboard">${backIcon} My quizzes</a><h1>Results expired</h1><p class="muted">Saved reports are in My quizzes → Results.</p></main>`;
            return;
        }
        // Animate a new question view, never a participant search or table page change.
        const cardKey = state.tab === 'responses' && state.responseView === 'questions' ? 'question-' + state.question : '';
        const animateCard = !!cardKey && cardKey !== lastCardKey;
        lastCardKey = cardKey;
        const navScroll = root.querySelector('.analytics-tabs')?.scrollLeft || 0;
        const remaining = Math.max(0, Math.ceil(((report.finishedAt || 0) + 900000 - Date.now()) / 60000));
        root.innerHTML = `<main class="page analytics"><header class="analytics-heading page-heading ${onSave?'has-save':''}"><a class="quiet-button back-link heading-back" href="${esc(back)}" aria-label="Back to ${back.startsWith('#room')?'quiz results':'My quizzes'}" title="Back to ${back.startsWith('#room')?'quiz results':'My quizzes'}">${backIcon}</a><h1 aria-label="${esc('Detailed results: ' + report.title)}">${esc(report.title)}</h1>${onSave ? `<div class="report-save-action"><button class="btn ${state.saved ? '' : 'primary'} analytics-save-button" data-result="save" ${state.saving ? 'disabled' : ''} title="${state.saved ? 'Update saved report' : 'Save detailed results'}" aria-label="${state.saved ? 'Update saved detailed results' : 'Save detailed results'}">${icon(state.saved ? 'check' : 'save', 18)} ${state.saving ? 'Saving…' : state.saved ? 'Saved' : 'Save report'}</button>${!state.saved ? `<span class="report-expiry">Save within ${remaining} min</span>` : ''}</div>` : ''}</header><div id="results-status" class="analytics-status ${state.error ? 'error-note' : ''}" role="status">${esc(state.notice)}</div><nav class="tabs analytics-tabs" aria-label="Report sections">${[['overview', 'Overview'], ['responses', 'Responses'], ['rounds', 'Rounds'], ['downloads', 'Download results']].map(([id, title]) => `<button class="tab ${state.tab === id ? 'active' : ''}" data-result="tab" data-tab="${id}" aria-current="${state.tab === id ? 'page' : 'false'}">${title}</button>`).join('')}</nav><div id="results-content">${state.tab === 'overview' ? overview() : state.tab === 'responses' ? responses(animateCard) : state.tab === 'rounds' ? rounds() : downloads()}</div></main>`;
        const nav = root.querySelector('.analytics-tabs'), tab = nav.querySelector(`[data-tab="${state.tab}"]`);
        nav.scrollLeft = navScroll;
        if (tab) {
            const bounds = nav.getBoundingClientRect(), active = tab.getBoundingClientRect();
            if (active.right > bounds.right)
                nav.scrollLeft += active.right - bounds.right;
            else if (active.left < bounds.left)
                nav.scrollLeft -= bounds.left - active.left;
        }
    }
    async function save() { if (!onSave || state.saving)
        return; if (expired())
        return render(); state.saving = true; render(); try {
        await onSave(report);
        state.saved = true;
        message('Report saved.');
    }
    catch (e) {
        message(e.message, true);
    }
    finally {
        state.saving = false;
        render();
    } }
    async function exportResults(scope) {
        if (state.exporting)
            return;
        const options = { ...state.options, theme: 'dark' };
        if (!options.summary && !options.questions && !options.participants && !(options.rounds && report.settings?.roundsEnabled)) {
            message('Choose at least one report section.', true);
            return;
        }
        state.exporting = true;
        state.cancel = false;
        state.scope = scope;
        render();
        const progress = text => { const el = root.querySelector('#results-export-progress'); if (el)
            el.textContent = text; };
        try {
            if (scope === 'individual') {
                if (!data.players.length)
                    throw new Error('There are no participants to export.');
                const files = [], folder = reportBase(report) + ' - Participant reports';
                for (const [index, p] of data.players.entries()) {
                    if (state.cancel || !isActive())
                        throw new Error('Download cancelled.');
                    progress(`Preparing report ${index + 1} of ${data.players.length}…`);
                    const file = await exportFile(report, options, p.id);
                    file.name = folder + '/' + String(index + 1).padStart(3, '0') + ' - ' + file.name;
                    files.push(file);
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                if (state.cancel || !isActive())
                    throw new Error('Download cancelled.');
                saveBlob(folder + '.zip', await zipFiles(files));
                message(`${files.length} participant reports downloaded in one ZIP.`);
            }
            else {
                const file = await exportFile(report, options, scope === 'student' ? state.student : '');
                if (state.cancel || !isActive())
                    throw new Error('Download cancelled.');
                saveBlob(file.name, file.blob);
                message('Report downloaded.');
            }
        }
        catch (e) {
            message(e.message, true);
        }
        finally {
            state.exporting = false;
            if (isActive())
                render();
        }
    }
    function onClick(event) {
        const target = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-result]');
        if (!target || target.disabled)
            return;
        event.preventDefault();
        const action = target.dataset.result;
        if (action === 'cancel-export') {
            state.cancel = true;
            return;
        }
        if (action === 'tab') {
            if (state.tab === 'responses')
                state.positions[responseKey()] = window.scrollY;
            state.tab = target.dataset.tab;
            render();
            root.querySelector(`[data-result="tab"][data-tab="${state.tab}"]`)?.focus({ preventScroll: true });
        }
        if (action === 'response-view')
            openResponse(() => { state.responseView = target.dataset.view; }, `[data-view="${target.dataset.view}"]`);
        if (action === 'question') {
            const index = Number(target.dataset.index);
            if (!Number.isInteger(index) || index < 0 || index >= data.questions.length)
                return;
            openResponse(() => { if (index !== state.question) {
                state.question = index;
                state.responsePage = 0;
                state.responseSearch = '';
            } state.responseView = 'questions'; }, '.question-heading h2');
        }
        if (action === 'student')
            openResponse(() => { state.student = target.dataset.id; if (!state.student && state.scope === 'student')
                state.scope = 'whole'; state.responseView = 'participants'; }, '.participant-heading h2');
        if (action === 'all-participants')
            openResponse(() => { state.student = ''; state.responseView = 'participants'; if (state.scope === 'student')
                state.scope = 'whole'; }, '.participant-heading h2');
        if (action === 'sort') {
            const sort = target.dataset.sort;
            if (!['name', 'score', 'accuracy', 'answered'].includes(sort))
                return;
            state.sortDirection = sort === state.sort && state.sortDirection === 'ascending' ? 'descending' : sort === state.sort ? 'ascending' : sort === 'name' ? 'ascending' : 'descending';
            state.sort = sort;
            state.page = 0;
            render();
            root.querySelector(`[data-sort="${sort}"]`)?.focus({ preventScroll: true });
        }
        if (action === 'clear-participants') {
            state.search = '';
            state.page = 0;
            render();
            root.querySelector('#results-participant-search')?.focus({ preventScroll: true });
        }
        if (action === 'page') {
            const key = target.dataset.key;
            if (!['page', 'responsePage', 'roundPage'].includes(key))
                return;
            state[key] = Number(target.dataset.page);
            render();
            const section = root.querySelector(key === 'page' ? '#participant-rows' : key === 'roundPage' ? '.rounds-report' : '.question-responses');
            if (section) {
                const label = key === 'responsePage' ? 'Responses' : key === 'roundPage' ? 'Round scores' : 'Participants', range = section.querySelector('.analytics-pager>span')?.textContent || '';
                section.tabIndex = -1;
                section.setAttribute('role', 'group');
                section.setAttribute('aria-label', label + ' ' + range);
                section.focus({ preventScroll: true });
                section.scrollIntoView({ block: 'start' });
            }
        }
        if (action === 'save')
            void save();
        if (['downloads', 'batch-export', 'student-export'].includes(action)) {
            state.scope = action === 'batch-export' ? 'individual' : action === 'student-export' ? 'student' : 'whole';
            state.options.responses = state.scope !== 'whole';
            state.tab = 'downloads';
            render();
            root.querySelector('[data-tab="downloads"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            root.querySelector('#results-format').focus({ preventScroll: true });
        }
        if (action === 'export')
            void exportResults(root.querySelector('#results-scope').value);
    }
    root.addEventListener('click', onClick);
    function updateInput(event) {
        const el = event.target;
        if (state.exporting)
            return;
        if (el.dataset.resultOption) {
            state.options[el.dataset.resultOption] = el.checked;
            return;
        }
        if (el.id === 'results-format')
            state.options.format = el.value;
        if (el.id === 'results-scope') {
            state.scope = el.value;
            state.options.responses = state.scope !== 'whole';
            const checkbox = root.querySelector('[data-result-option=responses]');
            if (checkbox)
                checkbox.checked = state.options.responses;
        }
        if (el.id === 'results-question')
            openResponse(() => { state.question = Number(el.value); state.responsePage = 0; state.responseSearch = ''; }, '#results-question');
        if (['results-participant-search', 'results-response-search'].includes(el.id)) {
            const cursor = el.selectionStart, id = el.id;
            state[id === 'results-participant-search' ? 'search' : 'responseSearch'] = el.value;
            state[id === 'results-participant-search' ? 'page' : 'responsePage'] = 0;
            render();
            const input = root.querySelector('#' + id);
            input?.focus();
            input?.setSelectionRange(cursor, cursor);
        }
    }
    function onToggle(event) { if ((event.target as HTMLElement).isConnected && (event.target as HTMLElement).id === 'results-export-options')
        state.customOpen = (event.target as HTMLDetailsElement).open; }
    function onInput(event) { if ((event.target as HTMLInputElement).type === 'search')
        updateInput(event); }
    root.addEventListener('toggle', onToggle, true);
    root.addEventListener('change', updateInput);
    root.addEventListener('input', onInput);
    render();
    expiryTimer = setInterval(() => { if (!isActive()) {
        clearInterval(expiryTimer);
        return;
    } if (expired())
        render();
    else {
        const note = root.querySelector('.report-expiry');
        if (note)
            note.textContent = `Save within ${Math.max(0, Math.ceil(((report.finishedAt || 0) + 900000 - Date.now()) / 60000))} min`;
    } }, 1000);
    return () => { clearInterval(expiryTimer); unbindPies(); state.cancel = true; root.removeEventListener('click', onClick); root.removeEventListener('change', updateInput); root.removeEventListener('input', onInput); root.removeEventListener('toggle', onToggle, true); report = null; };
}
export { hasDetails };
