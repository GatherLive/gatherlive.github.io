import type {AppContext} from '../../app/context.js';
import { icon } from '../../core/icons.js';
export function createFeaturesLearnPage(context: AppContext) {
    const S = context.state;
    const activeUser = (...args) => context.activeUser(...args);
    const getToken = (...args) => context.getToken(...args);
    const request = (...args) => context.request(...args);
    const apiURL = (...args) => context.apiURL(...args);
    const shell = (...args) => context.shell(...args);
    const toast = (...args) => context.toast(...args);
    function learningReturn() {
        try {
            const stored = JSON.parse(sessionStorage.getItem('gather.learn.return') || 'null');
            sessionStorage.removeItem('gather.learn.return');
            if (stored && Date.now() - stored.at < 15 * 60 * 1000 && typeof stored.hash === 'string' && /^#learn(?:\/[a-z-]+)*$/.test(stored.hash))
                return stored.hash;
        }
        catch { }
        return '#dashboard';
    }
    function forgetLearningAccount(userId) {
        const prefix = `gather.learn.v1.user.${userId}`;
        for (const key of Object.keys(localStorage))
            if (key === prefix || key.startsWith(prefix + '.'))
                localStorage.removeItem(key);
    }
    async function learningBackend(body, method = 'POST') {
        const owner = activeUser()?.id;
        if (!owner)
            throw new Error('Please sign in to sync your learning progress.');
        const token = await getToken();
        if (activeUser()?.id !== owner)
            throw new Error('Your account changed. Please retry learning sync.');
        const result = await request(apiURL('/api/account/learning'), { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, ...(body ? { body: JSON.stringify(body) } : {}) });
        return result.progress;
    }
    async function showLearning(parts, version) {
        const { createLearning } = await import('./index.js');
        if (version !== context.routeVersion)
            return;
        if (!S.learning) {
            const instance = createLearning({
                shell: html => { if (S.learning === instance && (location.hash === '#learn' || location.hash.startsWith('#learn/')))
                    shell(html); },
                icon, session: () => S.session, notify: toast,
                signIn: (returnHash = '#learn') => { const hash = /^#learn(?:\/[a-z-]+)*$/.test(returnHash) ? returnHash : '#learn'; sessionStorage.setItem('gather.learn.return', JSON.stringify({ hash, at: Date.now() })); S.authMode = 'login'; S.authMessage = ''; location.hash = '#host'; },
                loadCloud: () => learningBackend(null, 'GET'),
                saveCloud: progress => learningBackend({ progress }),
                resetCloud: () => learningBackend(null, 'DELETE')
            });
            S.learning = instance;
        }
        await S.learning.route(parts);
    }
    return { learningReturn, forgetLearningAccount, learningBackend, showLearning };
}
