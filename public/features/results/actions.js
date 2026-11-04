import { download, slug, dateLabel, esc, $ } from '../../core/dom.js';
export function createFeaturesResultsActions(context) {
    const S = context.state;
    const csvFor = (...args) => context.csvFor(...args);
    const modal = (...args) => context.modal(...args);
    const roundHistory = (...args) => context.roundHistory(...args);
    const leaderboard = (...args) => context.leaderboard(...args);
    const activeUser = (...args) => context.activeUser(...args);
    const db = (...args) => context.db(...args);
    const closeModal = (...args) => context.closeModal(...args);
    const renderDashboard = (...args) => context.renderDashboard(...args);
    const toast = (...args) => context.toast(...args);
    return { actions: {
            'report-csv': el => { const report = S.reports.find(r => r.id === el.dataset.id); download(`${slug(report.quiz_title || 'quiz')}-results.csv`, csvFor(report.results?.leaderboard || report.results?.players || (Array.isArray(report.results) ? report.results : []), report.results?.roundResults || []), 'text/csv;charset=utf-8'); },
            'report-view': el => { const report = S.reports.find(r => r.id === el.dataset.id); if (report.results?.questions && report.results?.players) {
                location.hash = '#results/saved/' + report.id;
                return;
            } const players = report.results?.leaderboard || report.results?.players || (Array.isArray(report.results) ? report.results : []); modal(report.quiz_title || 'Quiz results', `<p>${dateLabel(report.created_at)} · Code ${esc(report.room_code)}</p><div class="report-detail">${report.results?.roundResults?.length ? roundHistory(report.results.roundResults) : leaderboard(players)}</div>`, `<button class="btn primary" data-action="report-csv" data-id="${report.id}">Download CSV</button>`); },
            'delete-report': el => {
                const report = S.reports.find(item => item.id === el.dataset.id);
                if (!report)
                    return;
                modal('Delete saved results?', `<p>Are you sure you want to delete the saved results for “${esc(report.quiz_title || 'this quiz')}”? This can’t be undone.</p><div id="delete-report-error" role="alert"></div>`, `<button class="btn danger" data-action="confirm-delete-report" data-id="${esc(report.id)}">Delete results</button>`);
            },
            'confirm-delete-report': async (el) => {
                const id = el.dataset.id, owner = activeUser()?.id;
                if (!owner || !S.reports.some(item => item.id === id))
                    throw new Error('Refresh your saved results and try again.');
                await db(`giveaway_reports?id=eq.${encodeURIComponent(id)}&owner_id=eq.${encodeURIComponent(owner)}`, { method: 'DELETE' });
                if (activeUser()?.id !== owner)
                    return;
                S.reports = S.reports.filter(item => item.id !== id);
                if ($('[data-action="confirm-delete-report"]')?.dataset.id === id)
                    closeModal();
                if (location.hash === '#dashboard') {
                    renderDashboard();
                    $('[data-action="dashboard-tab"][data-tab="reports"]')?.focus({ preventScroll: true });
                }
                toast('Saved results deleted.');
            }
        } };
}
