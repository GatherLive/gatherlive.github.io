import { $, esc } from '../../core/dom.js';
import { icon } from '../../core/icons.js';
export function createFeaturesResultsPage(context) {
    const S = context.state;
    const activeUser = (...args) => context.activeUser(...args);
    const loading = (...args) => context.loading(...args);
    const backend = (...args) => context.backend(...args);
    const db = (...args) => context.db(...args);
    const shell = (...args) => context.shell(...args);
    const toast = (...args) => context.toast(...args);
    async function showResults(parts, version) {
        loading('Loading host results…');
        try {
            const [source, id] = parts;
            const live = source === 'live' && /^\d{6}$/.test(id || '');
            if (!live && !(source === 'saved' && /^[a-f0-9-]{36}$/i.test(id || '')))
                throw new Error('Choose a result from your dashboard.');
            const owner = activeUser()?.id;
            const record = live ? (await backend(`/api/rooms/${id}/report`, null, 'GET')).report : (await db(`giveaway_reports?id=eq.${id}&owner_id=eq.${owner}&select=*`))[0];
            if (version !== context.routeVersion || owner !== activeUser()?.id)
                return;
            const { mountResults, hasDetails } = await import('./index.js');
            if (version !== context.routeVersion)
                return;
            if (!record || !hasDetails(record.results))
                throw new Error('This result contains a summary only. Detailed answers were not saved.');
            const detailsSaved = !live || (await db(`giveaway_reports?id=eq.${record.id}&owner_id=eq.${owner}&results->>detailVersion=eq.1&select=id`).catch(() => [])).length > 0;
            if (version !== context.routeVersion)
                return;
            if (!document.querySelector('link[data-results-style]')) {
                const link = document.createElement('link');
                link.rel = 'stylesheet';
                link.href = new URL('./styles.css', import.meta.url);
                link.dataset.resultsStyle = 'true';
                document.head.append(link);
            }
            shell('<div id="host-results"></div>');
            const root = $('#host-results');
            S.disposeResults = mountResults(root, { report: { ...record.results, title: record.title || record.quiz_title || record.results.title }, saved: detailsSaved, onNotice: toast, backIcon: icon('back', 14), back: live ? `#room/${id}` : '#dashboard', isActive: () => version === context.routeVersion && root.isConnected,
                ...(live ? { onSave: () => backend(`/api/rooms/${id}/report`, { detailed: true, reportId: record.id }) } : {}) });
        }
        catch (error) {
            if (version === context.routeVersion)
                shell(`<main class="page"><h1>Results unavailable</h1><p class="muted" style="margin:20px 0">${esc(error.message)}</p><a class="btn" href="#dashboard">My quizzes</a></main>`);
        }
        return;
    }
    return { showResults };
}
