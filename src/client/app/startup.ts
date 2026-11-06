import type {AppContext} from './context.js';
import { esc } from '../core/dom.js';
export function createAppStartup(context: AppContext) {
    const S = context.state;
    const request = (...args) => context.request(...args);
    const authRequest = (...args) => context.authRequest(...args);
    const saveSession = (...args) => context.saveSession(...args);
    const learningReturn = (...args) => context.learningReturn(...args);
    const refreshToken = (...args) => context.refreshToken(...args);
    const scheduleRefresh = (...args) => context.scheduleRefresh(...args);
    const route = (...args) => context.route(...args);
    const shell = (...args) => context.shell(...args);
    async function boot() {
        try {
            const inline = window.GATHER_CONFIG || {};
            let runtime: import('../../shared/types.js').PublicConfig = {}, sameOriginBackend = false;
            const completeRemote = !!(inline.apiUrl && inline.supabaseUrl && inline.supabaseKey);
            const preferLocal = !inline.apiUrl || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
            if (!completeRemote || preferLocal) {
                try {
                    runtime = await request(new URL('./api/config', location.href)) || {};
                    sameOriginBackend = !!(runtime.supabaseUrl && runtime.supabaseKey);
                }
                catch { }
            }
            if (!sameOriginBackend && !completeRemote && inline.apiUrl) {
                try {
                    runtime = await request(`${inline.apiUrl.replace(/\/$/, '')}/api/config`) || {};
                }
                catch { }
            }
            S.config = { ...runtime, ...Object.fromEntries(Object.entries(inline).filter(([, v]) => v !== '' && v != null)) };
            if (sameOriginBackend)
                S.config.apiUrl = '';
            S.config.apiUrl = (S.config.apiUrl || '').replace(/\/$/, '');
            S.config.supabaseUrl = (S.config.supabaseUrl || '').replace(/\/$/, '');
            window.GATHER_CONFIG = { ...S.config };
            const hash = new URLSearchParams(location.hash.slice(1));
            if (hash.get('access_token')) {
                const token = hash.get('access_token'), user = await authRequest('user', null, 'GET', token);
                saveSession({ access_token: token, refresh_token: hash.get('refresh_token'), expires_at: Math.floor(Date.now() / 1000) + Number(hash.get('expires_in') || 3600), user });
                const recovery = hash.get('type') === 'recovery';
                history.replaceState(null, '', `${location.pathname}${location.search}${recovery ? '#reset' : learningReturn()}`);
            }
            if (S.session) {
                try {
                    if ((S.session.expires_at || 0) * 1000 < Date.now() + 30000)
                        await refreshToken();
                    else
                        scheduleRefresh();
                }
                catch { }
            }
            context.siteNews.start();
            await route();
        }
        catch (error) {
            shell(`<main class="page"><h1 style="font-size:32px">Unable to connect</h1><div class="error-note">${esc(error.message)}</div><a class="btn primary" href="#">Back home</a></main>`);
        }
    }
    return { boot };
}
